import type { Repository } from '../information-ingestion/processing/repository.js';
import { IngestionRepository } from '../information-ingestion/processing/current-repository.js';
import { DomainError } from '../platform/types.js';
export async function currentScheduleTick(repo: Repository, actor: string, now: Date, maxInFlight: number, sources?: string[]): Promise<void> {
  const lock = await repo.db.connect();
  try {
    if (!(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('riskhot-schema5-scheduler',0)) AS locked")).rows[0].locked) return;
    const active = Number((await lock.query("SELECT count(*) AS n FROM infomation.ingestion_tasks WHERE status IN ('queued','running') AND NOT paused")).rows[0].n);
    const slots = Math.max(0,maxInFlight-active);
    if (!slots) return;
    const due = (await lock.query(`SELECT q.source_id,q.next_run_at,q.updated_at,s.catalog_key FROM infomation.ingestion_schedules q JOIN m1.sources s ON s.id=q.source_id WHERE q.enabled AND q.next_run_at<=$1 AND s.state='ACTIVE' AND ($2::text[] IS NULL OR s.catalog_key=ANY($2)) AND NOT EXISTS(SELECT 1 FROM infomation.ingestion_tasks t WHERE t.source_id=s.id AND t.status IN ('queued','running') AND NOT t.paused) ORDER BY q.next_run_at,s.catalog_key LIMIT $3`, [now,sources??null,slots])).rows;
    const store = new IngestionRepository(repo);
    for (const plan of due) {
      try {
        await store.submit(actor,`auto/${plan.source_id}/${new Date(plan.next_run_at).toISOString()}`,{source_key:plan.catalog_key,limit:1},{scheduled_at:new Date(plan.next_run_at)});
        await lock.query("UPDATE infomation.ingestion_schedules SET next_run_at=$2::timestamptz+make_interval(secs=>interval_seconds),updated_at=date_trunc('milliseconds',clock_timestamp()) WHERE source_id=$1 AND enabled AND updated_at=$3",[plan.source_id,now,plan.updated_at]);
      } catch (error) { if (!(error instanceof DomainError)) throw error; }
    }
  } finally { await lock.query("SELECT pg_advisory_unlock(hashtextextended('riskhot-schema5-scheduler',0))");lock.release(); }
}
