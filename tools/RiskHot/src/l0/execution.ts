import { randomUUID } from 'node:crypto';
import { Repository, digest } from './repository.js';
import type { Pool, PoolClient } from 'pg';
import { transaction } from '../platform/db.js';
import { DomainError } from '../platform/types.js';
import type { TaskInput } from './model.js';
import { requiresOutputReview } from './policy.js';

export interface ReservedAttempt { id: string; attempt_no: number; window_used: number; request_artifact_id: string; deadline_ms: number }
export class ExecutionStore extends Repository {
  async prepare(id: string, generation: number, input: TaskInput): Promise<void> {
    const manifest = await this.putJson(input.manifest, 'task-manifest');
    const request = await this.putJson(input, 'model-input');
    await transaction(this.db, async client => {
      const processing = await this.processing(id, client, true); this.guard(processing, generation);
      if (processing.extraction_status === 'completed') return;
      if (processing.extraction_status === 'review') throw new DomainError('OUTPUT_REVIEW_REQUIRED', 409);
      if (processing.version_id !== input.version_id) throw new DomainError('INPUT_VERSION_MISMATCH');
      await client.query('UPDATE information.processing_runs SET manifest_artifact_id=COALESCE(manifest_artifact_id,$2),input_artifact_id=COALESCE(input_artifact_id,$3),provider_protocol=CASE WHEN input_artifact_id IS NULL THEN $4 ELSE provider_protocol END,extraction_status=\'pending\',error_code=NULL WHERE id=$1', [id, manifest, request, input.manifest.provider.protocol]);
      if (!(await client.query('SELECT 1 FROM platform.model_budget_windows WHERE processing_id=$1', [id])).rowCount) {
        await client.query('INSERT INTO platform.model_budget_windows(processing_id,generation,actor,reason) VALUES($1,$2,\'system\',\'initial task budget\')', [id, generation]);
      }
    });
  }
  async reserveAttempt(id: string, generation: number, callKey: string = randomUUID()): Promise<ReservedAttempt> {
    return transaction(this.db, async client => {
      const processing = await this.processing(id, client, true); this.guard(processing, generation);
      if (processing.extraction_status === 'completed') throw new DomainError('ALREADY_COMPLETED', 409);
      if (processing.extraction_status === 'review') throw new DomainError('OUTPUT_REVIEW_REQUIRED', 409);
      if (!processing.input_artifact_id) throw new DomainError('TASK_NOT_PREPARED');
      const prior = (await client.query<ReservedAttempt>('SELECT a.id,a.attempt_no,a.request_artifact_id,w.used AS window_used,(extract(epoch from w.deadline)*1000)::float8 AS deadline_ms FROM platform.model_attempts a JOIN platform.model_budget_windows w ON w.id=a.window_id WHERE a.processing_id=$1 AND a.generation=$2 AND a.call_key=$3', [id, generation, callKey])).rows[0];
      if (prior) return prior;
      const window = (await client.query<{ id: string; used: number; deadline: Date }>('SELECT * FROM platform.model_budget_windows WHERE processing_id=$1 ORDER BY generation DESC LIMIT 1 FOR UPDATE', [id])).rows[0];
      if (!window || window.used >= 3 || window.deadline.getTime() <= Date.now()) throw new DomainError('MODEL_BUDGET_EXHAUSTED', 409);
      const attempt = (await client.query<ReservedAttempt>('INSERT INTO platform.model_attempts(processing_id,window_id,generation,attempt_no,request_artifact_id,call_key) SELECT $1,$2,$3,COALESCE(MAX(attempt_no),0)+1,$4,$5 FROM platform.model_attempts WHERE processing_id=$1 RETURNING id,attempt_no,request_artifact_id', [id, window.id, generation, processing.input_artifact_id, callKey])).rows[0]!;
      await client.query('UPDATE platform.model_budget_windows SET used=used+1 WHERE id=$1', [window.id]);
      return { ...attempt, window_used: window.used + 1, deadline_ms: window.deadline.getTime() };
    });
  }
  async extractionFailed(id: string, generation: number, code: string, waiting = false, attemptId?: string): Promise<void> {
    await transaction(this.db, async client => {
      const processing = await this.processing(id, client, true);
      if (Number(processing.generation) !== generation || processing.extraction_status === 'completed') return;
      if (processing.extraction_status === 'review') return;
      const state = requiresOutputReview(code) ? 'review' : 'recoverable';
      await client.query('UPDATE information.processing_runs SET extraction_status=$2,error_code=$3,review_attempt_id=CASE WHEN $2=\'review\' THEN COALESCE($4::uuid,(SELECT id FROM platform.model_attempts WHERE processing_id=$1 AND generation=$5 ORDER BY attempt_no DESC LIMIT 1)) ELSE NULL END WHERE id=$1', [id, state, code, attemptId ?? null, generation]);
      await client.query('UPDATE information.operations SET status=$2,reason_code=$3,updated_at=now() WHERE processing_id=$1', [id, waiting ? 'waiting_config' : state, code]);
    });
  }
  async retryExtraction(id: string, actor: string, reason: string, openBudget: boolean, expected: number, key: string = randomUUID(), automatic = false): Promise<number> {
    if (!reason.trim()) throw new DomainError('RETRY_REASON_REQUIRED', 400);
    return this.action(actor, 'retry-extraction', key, { id, reason, openBudget, expected }, async client => {
      const op = (await client.query<{ catalog_key: string; state: string }>('SELECT s.catalog_key,s.state FROM information.processing_runs p JOIN information.material_versions v ON v.id=p.version_id JOIN information.materials m ON m.id=v.material_id CROSS JOIN LATERAL platform.lock_source(m.source_id) s WHERE p.id=$1', [id])).rows[0];
      if (!op) throw new DomainError('NOT_FOUND', 404);
      await this.authorize(actor, automatic ? 'auto_retry' : openBudget ? 'model_budget' : 'retry', op.catalog_key, client);
      if (op.state !== 'ACTIVE') throw new DomainError('SOURCE_DISABLED', 409);
    }, async client => {
      const processing = await this.processing(id, client, true);
      if (processing.extraction_status === 'completed') return Number(processing.generation);
      if (processing.extraction_status === 'review') throw new DomainError('OUTPUT_REVIEW_REQUIRED', 409);
      if (Number(processing.generation) !== expected) throw new DomainError('STALE_EXECUTION', 409);
      const window = (await client.query<{ used: number; deadline: Date }>('SELECT used,deadline FROM platform.model_budget_windows WHERE processing_id=$1 ORDER BY generation DESC LIMIT 1', [id])).rows[0];
      const exhausted = window && (window.used >= 3 || window.deadline.getTime() <= Date.now());
      if (exhausted && !openBudget) throw new DomainError('MODEL_BUDGET_EXHAUSTED', 409);
      if (openBudget && !exhausted) throw new DomainError('BUDGET_NOT_EXHAUSTED', 409);
      const next = expected + 1;
      if (automatic) {
        const protocol = processing.input_artifact_id ? (await this.json<TaskInput>(processing.input_artifact_id)).manifest.provider.protocol : null;
        if (!(protocol === null && processing.error_code === 'MODEL_NOT_CONFIGURED') && !(protocol === 'codex-exec' && ['MODEL_NETWORK_ERROR','MODEL_CAPACITY_UNAVAILABLE','MODEL_LOGIN_REQUIRED','MODEL_QUOTA_EXHAUSTED','MODEL_BUDGET_EXHAUSTED'].includes(processing.error_code ?? ''))) throw new DomainError('AUTO_RECOVERY_NOT_ALLOWED', 409);
        if (protocol === 'codex-exec' && !exhausted) throw new DomainError('AUTO_RECOVERY_WINDOW_ACTIVE', 409);
        if ((await client.query("SELECT 1 FROM platform.model_service_state WHERE protocol='codex-exec' AND blocked_until>clock_timestamp()")).rowCount) throw new DomainError('MODEL_SERVICE_PAUSED', 409);
        if (openBudget) {
          if ((await client.query("SELECT 1 FROM platform.automatic_recoveries WHERE processing_id=$1 AND created_at>clock_timestamp()-interval '24 hours'", [id])).rowCount) throw new DomainError('AUTO_RECOVERY_LIMIT', 409);
          await client.query('INSERT INTO platform.automatic_recoveries(processing_id,generation) VALUES($1,$2)', [id, next]);
        }
      }
      if (openBudget) await client.query('INSERT INTO platform.model_budget_windows(processing_id,generation,actor,reason) VALUES($1,$2,$3,$4)', [id, next, actor, reason]);
      await client.query('UPDATE information.processing_runs SET generation=$2,extraction_status=\'pending\',error_code=NULL WHERE id=$1', [id, next]);
      await client.query('UPDATE information.operations SET status=\'queued\',reason_code=NULL,updated_at=now() WHERE processing_id=$1', [id]);
      await client.query('INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,\'retry-extraction\',$2,$3)', [actor, id, { reason, openBudget, automatic, previous_generation: expected, generation: next }]);
      await this.intent(client, 'extract', id, next);
      return next;
    });
  }
  async reviewBasis(id: string, client: Pool | PoolClient = this.db): Promise<{ digest: string; attempt_id: string; error_code: string | null }> {
    const processing = await this.processing(id, client);
    if (processing.extraction_status !== 'review') throw new DomainError('OUTPUT_REVIEW_NOT_PENDING', 409);
    const attempt = (await client.query<{ id: string; generation: string; status: string; error_code: string | null; response_artifact_id: string | null }>('SELECT id,generation,status,error_code,response_artifact_id FROM platform.model_attempts WHERE id=$1 AND processing_id=$2', [processing.review_attempt_id, id])).rows[0];
    if (!attempt || Number(attempt.generation) !== Number(processing.generation)) throw new DomainError('REVIEW_BASIS_UNAVAILABLE', 409);
    return { digest: digest({ id, generation: processing.generation, input: processing.input_artifact_id, manifest: processing.manifest_artifact_id, version: processing.version_id, error: processing.error_code, attempt }), attempt_id: attempt.id, error_code: processing.error_code };
  }
  async reviewOutput(id: string, actor: string, reason: string, expected: number, basis: string, key: string): Promise<number> {
    if (!reason.trim()) throw new DomainError('REVIEW_REASON_REQUIRED', 400);
    return this.action(actor, 'review-output', key, { id, reason, expected, basis, decision: 'RETRY_FIXED_INPUT' }, async client => {
      const source = (await client.query<{ catalog_key: string; state: string }>('SELECT s.catalog_key,s.state FROM information.processing_runs p JOIN information.material_versions v ON v.id=p.version_id JOIN information.materials m ON m.id=v.material_id JOIN m1.sources s ON s.id=m.source_id WHERE p.id=$1 FOR SHARE OF s', [id])).rows[0];
      if (!source) throw new DomainError('NOT_FOUND', 404);
      await this.authorize(actor, 'read', source.catalog_key, client); await this.authorize(actor, 'model_review', source.catalog_key, client);
      if (source.state !== 'ACTIVE') throw new DomainError('SOURCE_DISABLED', 409);
    }, async client => {
      const processing = await this.processing(id, client, true); this.guard(processing, expected);
      if ((await this.reviewBasis(id, client)).digest !== basis) throw new DomainError('REVIEW_BASIS_CHANGED', 409);
      const next = expected + 1;
      await client.query('INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,\'review-output\',$2,$3)', [actor, id, { reason, basis, attempt_id: processing.review_attempt_id, decision: 'RETRY_FIXED_INPUT', previous_generation: expected, generation: next }]);
      await client.query('UPDATE information.processing_runs SET generation=$2,extraction_status=\'recoverable\',error_code=NULL,review_attempt_id=NULL WHERE id=$1', [id, next]);
      await client.query('UPDATE information.operations SET status=\'recoverable\',reason_code=\'OUTPUT_REVIEW_APPROVED\',updated_at=now() WHERE processing_id=$1', [id]);
      return next;
    });
  }
  async retryOperation(id: string, actor: string, reason: string, expected: number, key: string): Promise<number> {
    return this.action(actor, 'retry-operation', key, { id, reason, expected }, async client => {
      const op = await this.rawOperation(id, client);
      const source = (await client.query<{ catalog_key: string }>('SELECT catalog_key FROM m1.sources WHERE id=$1', [op.source_id])).rows[0]!;
      await this.authorize(actor, 'retry', source.catalog_key, client); await this.checkSource(op, client);
    }, async client => {
      const op = await this.rawOperation(id, client, true);
      if (op.status === 'completed') return Number(op.generation);
      this.guard(op, expected);
      if (op.processing_id) throw new DomainError('USE_EXTRACTION_RETRY', 409);
      if (op.kind === 'batch' && (await client.query('SELECT 1 FROM information.operations WHERE parent_id=$1', [id])).rowCount) throw new DomainError('RETRY_FAILED_CHILD', 409);
      if (!['recoverable', 'waiting_config'].includes(op.status)) throw new DomainError('NOT_RECOVERABLE', 409);
      const next = expected + 1;
      await client.query('UPDATE information.operations SET generation=$2,status=\'queued\',reason_code=NULL,updated_at=now() WHERE id=$1', [id, next]);
      await this.intent(client, op.kind === 'batch' ? 'discovery' : 'material', id, next);
      await client.query('INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,\'retry-operation\',$2,$3)', [actor, id, { reason, generation: next }]);
      return next;
    });
  }
}
