import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import type { PoolClient } from 'pg';
import { database, required, transaction } from '../platform/db.js';
import { ArtifactStore } from '../platform/artifacts.js';
import { DomainError } from '../platform/types.js';
import { AlertStore, type Notifier, type RuntimeIssue, systemNotification } from '../platform/notifications.js';
import { ExecutionStore } from '../l0/execution.js';
import { CodexModelClient } from '../l0/codex.js';

interface SchedulerConfig { intervalSeconds: number; maxInFlight: number; sources?: string[] }
export function schedulerSettings(env: NodeJS.ProcessEnv = process.env): SchedulerConfig {
  const sources = env.SCHEDULE_SOURCES?.split(',').map(x=>x.trim()).filter(Boolean);
  if(sources?.some(key=>!/^wiki-source-\d{3}$/.test(key)))throw new DomainError('SCHEDULE_SOURCE_INVALID');
  return { intervalSeconds:Number(env.SCHEDULE_INTERVAL_SECONDS??3600), maxInFlight:2, sources:sources?.length?sources:undefined };
}
export const SCHEDULER_ACTOR = 'riskhot-scheduler';
const codeOf = (error: unknown) => error instanceof DomainError ? error.code : 'SCHEDULER_UNAVAILABLE';
export class Scheduler {
  private alerts: AlertStore;
  constructor(private repo: ExecutionStore, notify: Notifier = systemNotification, private config: SchedulerConfig = { intervalSeconds: 3600, maxInFlight: 2 }) {
    if (!Number.isInteger(config.intervalSeconds) || config.intervalSeconds < 60 || config.intervalSeconds > 86400 || !Number.isInteger(config.maxInFlight) || config.maxInFlight < 1 || config.maxInFlight > 2) throw new DomainError('SCHEDULE_CONFIG_INVALID');
    this.alerts = new AlertStore(repo.db, notify);
  }
  async initialize(now = new Date()): Promise<void> {
    await this.repo.db.query(`INSERT INTO platform.source_schedules(source_id,interval_seconds,next_run_at)
      SELECT s.id,$1::integer,$2::timestamptz+make_interval(secs=>$1::integer) FROM m1.sources s JOIN m1.source_versions v ON v.source_id=s.id AND v.version=s.version
      WHERE s.state='ACTIVE' AND (v.config->'connection'->>'readiness'='ready' OR v.config->>'connector'='pbc-html-1.0.0')
      AND ($3::text[] IS NULL OR s.catalog_key=ANY($3)) ON CONFLICT DO NOTHING`, [this.config.intervalSeconds, now, this.config.sources ?? null]);
  }
  async tick(now = new Date()): Promise<void> {
    const lock = await this.repo.db.connect();
    try {
      if (!(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('riskhot-scheduler',0)) AS locked")).rows[0].locked) return;
      const paused = (await lock.query("SELECT reason_code FROM platform.model_service_state WHERE protocol='codex-exec' AND blocked_until>$1", [now])).rows[0];
      let slots = this.config.maxInFlight - await this.inFlight(lock);
      if (!paused && slots > 0) {
        // Resume fixed material before creating new work; never reopen review automatically.
        const recoverable = (await lock.query<{ id: string; generation: string; exhausted: boolean }>(`SELECT p.id,p.generation,(w.used>=3 OR w.deadline<=$1) AS exhausted
          FROM information.processing_runs p JOIN information.material_versions v ON v.id=p.version_id JOIN information.materials m ON m.id=v.material_id JOIN m1.sources s ON s.id=m.source_id
          LEFT JOIN LATERAL(SELECT used,deadline FROM platform.model_budget_windows WHERE processing_id=p.id ORDER BY generation DESC LIMIT 1) w ON true
          WHERE p.extraction_status='recoverable' AND s.state='ACTIVE' AND ($2::text[] IS NULL OR s.catalog_key=ANY($2))
          AND ((p.input_artifact_id IS NULL AND p.error_code='MODEL_NOT_CONFIGURED') OR (p.provider_protocol='codex-exec' AND p.error_code IN ('MODEL_QUOTA_EXHAUSTED','MODEL_LOGIN_REQUIRED','MODEL_NETWORK_ERROR','MODEL_BUDGET_EXHAUSTED') AND (w.used>=3 OR w.deadline<=$1)))
          AND NOT EXISTS(SELECT 1 FROM platform.automatic_recoveries a WHERE a.processing_id=p.id AND a.created_at>$1-interval '24 hours')
          ORDER BY p.created_at LIMIT $3`, [now, this.config.sources ?? null, slots])).rows;
        for (const row of recoverable) {
          try { await this.repo.retryExtraction(row.id, SCHEDULER_ACTOR, 'standing subscription recovery policy v1', Boolean(row.exhausted), Number(row.generation), `auto/${row.id}/${row.generation}`, true); slots--; }
          catch (error) { if (!(error instanceof DomainError)) throw error; }
        }
        const pending = (await lock.query<{ id: string; catalog_key: string }>(`SELECT r.id,s.catalog_key FROM platform.schedule_runs r JOIN m1.sources s ON s.id=r.source_id WHERE r.status='pending' AND s.state='ACTIVE' AND ($1::text[] IS NULL OR s.catalog_key=ANY($1)) ORDER BY r.scheduled_at LIMIT $2`, [this.config.sources ?? null, slots])).rows;
        for (const run of pending) if(await this.submitRun(run.id, run.catalog_key)) slots--;
        if (slots > 0) {
          const due = (await lock.query<{ source_id: string; catalog_key: string; next_run_at: Date; interval_seconds: number }>(`SELECT q.*,s.catalog_key FROM platform.source_schedules q JOIN m1.sources s ON s.id=q.source_id JOIN m1.source_versions v ON v.source_id=s.id AND v.version=s.version
            WHERE q.enabled AND q.next_run_at<=$1 AND s.state='ACTIVE' AND (v.config->'connection'->>'readiness'='ready' OR v.config->>'connector'='pbc-html-1.0.0')
            AND ($2::text[] IS NULL OR s.catalog_key=ANY($2))
            AND NOT EXISTS(SELECT 1 FROM platform.schedule_runs r WHERE r.source_id=s.id AND r.status IN ('pending','running'))
            AND NOT EXISTS(SELECT 1 FROM information.operations o WHERE o.source_id=s.id AND o.status IN ('queued','running') AND (o.kind='material' OR NOT EXISTS(SELECT 1 FROM information.operations c WHERE c.parent_id=o.id)))
            ORDER BY q.next_run_at,s.catalog_key LIMIT $3`, [now, this.config.sources ?? null, slots])).rows;
          for (const source of due) {
            const id = await transaction(this.repo.db, async tx => {
              const run = (await tx.query<{id:string}>('INSERT INTO platform.schedule_runs(source_id,scheduled_at) VALUES($1,$2) ON CONFLICT(source_id,scheduled_at) DO UPDATE SET source_id=EXCLUDED.source_id RETURNING id', [source.source_id, source.next_run_at])).rows[0]!;
              await tx.query("UPDATE platform.source_schedules SET next_run_at=$2::timestamptz+(interval_seconds::text||' seconds')::interval,updated_at=now() WHERE source_id=$1", [source.source_id, now]);
              return run.id;
            });
            await this.submitRun(id, source.catalog_key);
          }
        }
      }
      await this.monitor(now);
    } finally {
      await lock.query("SELECT pg_advisory_unlock(hashtextextended('riskhot-scheduler',0))"); lock.release();
    }
  }
  private async inFlight(client: PoolClient): Promise<number> {
    const result = await client.query<{ n: number }>(`SELECT (SELECT count(*) FROM information.processing_runs WHERE extraction_status='pending') +
      (SELECT count(*) FROM information.operations o WHERE o.status IN ('queued','running') AND o.processing_id IS NULL AND
        (o.kind='material' OR (o.kind='batch' AND NOT EXISTS(SELECT 1 FROM information.operations c WHERE c.parent_id=o.id)))) AS n`);
    return Number(result.rows[0]!.n);
  }
  private async submitRun(id: string, source: string): Promise<boolean> {
    try {
      const operation = await this.repo.submit({ source_key: source, limit: 1 }, SCHEDULER_ACTOR, `schedule/${id}`);
      await this.repo.db.query("UPDATE platform.schedule_runs SET operation_id=$2,status='running',error_code=NULL WHERE id=$1", [id, operation.id]);
      return true;
    } catch (error) {
      await this.repo.db.query('UPDATE platform.schedule_runs SET error_code=$2,status=$3 WHERE id=$1', [id, codeOf(error),error instanceof DomainError&&!error.retryable?'blocked':'pending']);
      if (!(error instanceof DomainError)) throw error;
      return false;
    }
  }
  async monitor(now = new Date()): Promise<void> {
    const issues: RuntimeIssue[] = [];
    const service = (await this.repo.db.query("SELECT reason_code FROM platform.model_service_state WHERE protocol='codex-exec'")).rows[0];
    if (service?.reason_code) issues.push({ key: `model:${service.reason_code}`, code: service.reason_code, owner: null });
    const runs = (await this.repo.db.query<{ id: string; operation_id: string | null; source_id: string; error_code: string | null }>("SELECT r.* FROM platform.schedule_runs r WHERE r.status IN ('pending','running') OR r.id IN (SELECT DISTINCT ON(source_id) id FROM platform.schedule_runs ORDER BY source_id,scheduled_at DESC) ORDER BY r.scheduled_at")).rows;
    for (const run of runs) {
      if (!run.operation_id) { if (run.error_code) issues.push({ key: `schedule:${run.source_id}:${run.error_code}`, code: run.error_code, owner: run.id }); continue; }
      const operation = await this.repo.operation(run.operation_id);
      if (['completed','review','recoverable','partial','waiting_config'].includes(operation.slice_status!)) {
        const code = operation.reason_code ?? operation.children?.find(c => c.reason_code)?.reason_code ?? null;
        await this.repo.db.query('UPDATE platform.schedule_runs SET status=$2,error_code=$3 WHERE id=$1', [run.id, operation.slice_status, code]);
      }
    }
    // A queued retry is not recovery. Retain the last terminal source outcome until success.
    const latest = (await this.repo.db.query<{id:string;source_id:string;status:string;error_code:string|null}>(`SELECT DISTINCT ON(source_id) id,source_id,status,error_code FROM platform.schedule_runs WHERE status NOT IN ('pending','running','queued') ORDER BY source_id,scheduled_at DESC`)).rows;
    for (const run of latest) if (['blocked','review','recoverable','partial','waiting_config'].includes(run.status) && run.error_code && !['MODEL_QUOTA_EXHAUSTED','MODEL_LOGIN_REQUIRED','MODEL_SUBSCRIPTION_REQUIRED'].includes(run.error_code)) issues.push({ key: `source:${run.source_id}:${run.error_code}`, code: run.status === 'review' ? 'OUTPUT_REVIEW_REQUIRED' : run.error_code, owner: run.id });
    const processings=(await this.repo.db.query<{id:string;source_id:string;extraction_status:string;error_code:string}>(`SELECT p.id,m.source_id,p.extraction_status,p.error_code FROM information.processing_runs p JOIN information.material_versions v ON v.id=p.version_id JOIN information.materials m ON m.id=v.material_id
      LEFT JOIN LATERAL(SELECT used,deadline FROM platform.model_budget_windows WHERE processing_id=p.id ORDER BY generation DESC LIMIT 1) w ON true
      WHERE p.extraction_status IN ('review','recoverable') AND p.error_code IS NOT NULL AND p.error_code NOT IN ('MODEL_NOT_CONFIGURED','MODEL_QUOTA_EXHAUSTED','MODEL_LOGIN_REQUIRED','MODEL_SUBSCRIPTION_REQUIRED')
      AND (p.error_code NOT IN ('MODEL_NETWORK_ERROR','MODEL_BUDGET_EXHAUSTED') OR w.used>=3 OR w.deadline<=$1)`,[now])).rows;
    for(const p of processings)issues.push({key:`source:${p.source_id}:${p.error_code}`,code:p.extraction_status==='review'?'OUTPUT_REVIEW_REQUIRED':p.error_code,owner:p.id});
    const retrying=(await this.repo.db.query<{issue_key:string;code:string;owner_id:string}>("SELECT a.issue_key,a.code,a.owner_id FROM platform.runtime_alerts a JOIN information.processing_runs p ON p.id=a.owner_id WHERE a.resolved_at IS NULL AND p.extraction_status='pending'")).rows;
    for(const a of retrying)issues.push({key:a.issue_key,code:a.code,owner:a.owner_id});
    await this.alerts.reconcile(issues, now);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const db = database('IO_DATABASE_URL'); const repo = new ExecutionStore(db, new ArtifactStore(required('ARTIFACT_ROOT')));
  const scheduler = new Scheduler(repo, systemNotification, schedulerSettings());
  let stopping = false; process.on('SIGTERM', () => { stopping = true; }); process.on('SIGINT', () => { stopping = true; });
  try {
    await scheduler.initialize();
    while (!stopping) {
      try {
        const state = (await db.query("SELECT reason_code,blocked_until FROM platform.model_service_state WHERE protocol='codex-exec'")).rows[0];
        if (state?.reason_code && state.reason_code !== 'MODEL_QUOTA_EXHAUSTED') {
          try { await new CodexModelClient().authenticated(); await db.query("UPDATE platform.model_service_state SET reason_code=NULL,blocked_until=NULL,updated_at=now() WHERE protocol='codex-exec'"); }
          catch { await db.query("UPDATE platform.model_service_state SET blocked_until=now()+interval '5 minutes',updated_at=now() WHERE protocol='codex-exec'"); }
        }
        await scheduler.tick();
      } catch { await new AlertStore(db).reconcile([{ key: 'scheduler', code: 'SCHEDULER_UNAVAILABLE', owner: null }]); }
      if (!stopping) await setTimeout(30_000);
    }
  } finally { await db.end(); }
}
