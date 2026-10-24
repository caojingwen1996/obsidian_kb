import { randomUUID } from 'node:crypto';
import { Repository } from './repository.js';
import { transaction } from '../platform/db.js';
import { DomainError } from '../platform/types.js';
import type { TaskInput } from './model.js';

export interface ReservedAttempt { id: string; attempt_no: number; window_used: number; request_artifact_id: string }
export class ExecutionStore extends Repository {
  async prepare(id: string, generation: number, input: TaskInput): Promise<void> {
    const manifest = await this.putJson(input.manifest, 'task-manifest');
    const request = await this.putJson(input, 'model-input');
    await transaction(this.db, async client => {
      const processing = await this.processing(id, client, true); this.guard(processing, generation);
      if (processing.extraction_status === 'completed') return;
      if (processing.version_id !== input.version_id) throw new DomainError('INPUT_VERSION_MISMATCH');
      await client.query('UPDATE information.processing_runs SET manifest_artifact_id=COALESCE(manifest_artifact_id,$2),input_artifact_id=COALESCE(input_artifact_id,$3),extraction_status=\'pending\',error_code=NULL WHERE id=$1', [id, manifest, request]);
      if (!(await client.query('SELECT 1 FROM platform.model_budget_windows WHERE processing_id=$1', [id])).rowCount) {
        await client.query('INSERT INTO platform.model_budget_windows(processing_id,generation,actor,reason) VALUES($1,$2,\'system\',\'initial task budget\')', [id, generation]);
      }
    });
  }
  async reserveAttempt(id: string, generation: number, callKey: string = randomUUID()): Promise<ReservedAttempt> {
    return transaction(this.db, async client => {
      const processing = await this.processing(id, client, true); this.guard(processing, generation);
      if (processing.extraction_status === 'completed') throw new DomainError('ALREADY_COMPLETED', 409);
      if (!processing.input_artifact_id) throw new DomainError('TASK_NOT_PREPARED');
      const prior = (await client.query<ReservedAttempt>('SELECT a.id,a.attempt_no,a.request_artifact_id,w.used AS window_used FROM platform.model_attempts a JOIN platform.model_budget_windows w ON w.id=a.window_id WHERE a.processing_id=$1 AND a.generation=$2 AND a.call_key=$3', [id, generation, callKey])).rows[0];
      if (prior) return prior;
      const window = (await client.query<{ id: string; used: number; deadline: Date }>('SELECT * FROM platform.model_budget_windows WHERE processing_id=$1 ORDER BY generation DESC LIMIT 1 FOR UPDATE', [id])).rows[0];
      if (!window || window.used >= 3 || window.deadline.getTime() <= Date.now()) throw new DomainError('MODEL_BUDGET_EXHAUSTED', 409);
      const attempt = (await client.query<ReservedAttempt>('INSERT INTO platform.model_attempts(processing_id,window_id,generation,attempt_no,request_artifact_id,call_key) SELECT $1,$2,$3,COALESCE(MAX(attempt_no),0)+1,$4,$5 FROM platform.model_attempts WHERE processing_id=$1 RETURNING id,attempt_no,request_artifact_id', [id, window.id, generation, processing.input_artifact_id, callKey])).rows[0]!;
      await client.query('UPDATE platform.model_budget_windows SET used=used+1 WHERE id=$1', [window.id]);
      return { ...attempt, window_used: window.used + 1 };
    });
  }
  async extractionFailed(id: string, generation: number, code: string, waiting = false): Promise<void> {
    await transaction(this.db, async client => {
      const processing = await this.processing(id, client, true);
      if (Number(processing.generation) !== generation || processing.extraction_status === 'completed') return;
      await client.query('UPDATE information.processing_runs SET extraction_status=\'recoverable\',error_code=$2 WHERE id=$1', [id, code]);
      await client.query('UPDATE information.operations SET status=$2,reason_code=$3,updated_at=now() WHERE processing_id=$1', [id, waiting ? 'waiting_config' : 'recoverable', code]);
    });
  }
  async retryExtraction(id: string, actor: string, reason: string, openBudget: boolean, expected: number): Promise<number> {
    if (!reason.trim()) throw new DomainError('RETRY_REASON_REQUIRED', 400);
    return transaction(this.db, async client => {
      const processing = await this.processing(id, client, true);
      const op = (await client.query<{ catalog_key: string; state: string }>('SELECT s.catalog_key,s.state FROM information.material_versions v JOIN information.materials m ON m.id=v.material_id JOIN m1.sources s ON s.id=m.source_id WHERE v.id=$1 FOR SHARE OF s', [processing.version_id])).rows[0]!;
      await this.authorize(actor, openBudget ? 'model_budget' : 'retry', op.catalog_key, client);
      if (op.state !== 'ACTIVE') throw new DomainError('SOURCE_DISABLED', 409);
      if (processing.extraction_status === 'completed') return Number(processing.generation);
      if (Number(processing.generation) !== expected) throw new DomainError('STALE_EXECUTION', 409);
      const window = (await client.query<{ used: number; deadline: Date }>('SELECT used,deadline FROM platform.model_budget_windows WHERE processing_id=$1 ORDER BY generation DESC LIMIT 1', [id])).rows[0];
      const exhausted = window && (window.used >= 3 || window.deadline.getTime() <= Date.now());
      if (exhausted && !openBudget) throw new DomainError('MODEL_BUDGET_EXHAUSTED', 409);
      if (openBudget && !exhausted) throw new DomainError('BUDGET_NOT_EXHAUSTED', 409);
      const next = expected + 1;
      if (openBudget) await client.query('INSERT INTO platform.model_budget_windows(processing_id,generation,actor,reason) VALUES($1,$2,$3,$4)', [id, next, actor, reason]);
      await client.query('UPDATE information.processing_runs SET generation=$2,extraction_status=\'pending\',error_code=NULL WHERE id=$1', [id, next]);
      await client.query('UPDATE information.operations SET status=\'queued\',reason_code=NULL,updated_at=now() WHERE processing_id=$1', [id]);
      await client.query('INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,\'retry-extraction\',$2,$3)', [actor, id, { reason, openBudget, previous_generation: expected, generation: next }]);
      await this.intent(client, 'extract', id, next);
      return next;
    });
  }
}
