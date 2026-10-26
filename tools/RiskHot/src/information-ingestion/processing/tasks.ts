import type { PoolClient } from 'pg';
import { DomainError } from '../../platform/types.js';
import type { ExecutionStore } from './execution.js';
import type { OperationRow } from './repository.js';
import { requireConnector } from './sources.js';

interface SourceResult {
  source_key: string; name: string; operation_id: string | null; status: string; stage: string;
  reason_code: string | null; saved_count: number; children: OperationRow[];
}
interface Batch {
  id: string; scheduled_at: Date; version: number; paused: boolean; sources: SourceResult[];
  status: string; saved_count: number; completed_sources: number; error_sources: number; has_error: boolean;
  scope_complete: boolean;
}
const errors = new Set(['partial', 'failed', 'blocked', 'review', 'recoverable', 'waiting_config']);
const phase = ['source', 'discovered', 'acquired', 'normalized', 'identified', 'saved', 'extract', 'candidates_saved'];
function stateOf(statuses: string[], fallback = 'queued'): string {
  if (!statuses.length) return fallback;
  if (statuses.every(x => x === 'completed')) return 'completed';
  if (statuses.includes('running')) return 'running';
  if (statuses.includes('queued') || statuses.includes('pending')) return statuses.some(x => x === 'completed' || x === 'partial') ? 'running' : 'queued';
  if (statuses.includes('completed') || statuses.includes('partial')) return 'partial';
  return ['review', 'recoverable', 'waiting_config', 'blocked', 'failed', 'paused'].find(x => statuses.includes(x)) ?? fallback;
}
function decorate(batch: Omit<Batch, 'status' | 'saved_count' | 'completed_sources' | 'error_sources' | 'has_error'>): Batch {
  const status = stateOf(batch.sources.map(x => x.status));
  const versions = new Set(batch.sources.flatMap(x => x.children.map(child => child.version_id).filter(Boolean)));
  return { ...batch, status: batch.paused && status !== 'completed' ? 'paused' : status, saved_count: versions.size,
    completed_sources: batch.sources.filter(x => x.status === 'completed').length,
    error_sources: batch.sources.filter(x => errors.has(x.status)).length,
    has_error: batch.sources.some(x => errors.has(x.status) || x.children.some(child => Boolean(child.reason_code))) };
}
function dateBound(value: string | undefined, end = false): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new DomainError('DATE_INVALID', 400);
  return new Date(Date.parse(`${value}T00:00:00Z`) - 8 * 3600_000 + (end ? 86400_000 : 0));
}

export class TaskManagement {
  constructor(private repo: ExecutionStore) {}
  async list(actor: string, query: { from?: string; to?: string; status?: string; q?: string } = {}) {
    await this.repo.authorize(actor, 'read');
    const from = dateBound(query.from), to = dateBound(query.to, true);
    if (from && to && from >= to) throw new DomainError('DATE_RANGE_INVALID', 400);
    const operations = (await this.repo.db.query<OperationRow & { name: string; source_key: string; children: OperationRow[]; grouped: boolean }>(`SELECT o.*,s.catalog_key AS source_key,s.name,
      EXISTS(SELECT 1 FROM platform.task_batch_sources bs WHERE bs.operation_id=o.id) AS grouped,
      COALESCE(jsonb_agg(to_jsonb(c)||jsonb_build_object('status',CASE WHEN p.extraction_status='completed' THEN 'completed' WHEN p.extraction_status='review' THEN 'review' WHEN p.extraction_status='recoverable' AND p.error_code='MODEL_NOT_CONFIGURED' THEN 'waiting_config' WHEN p.extraction_status='recoverable' THEN 'recoverable' ELSE c.status END,'reason_code',COALESCE(p.error_code,c.reason_code))) FILTER(WHERE c.id IS NOT NULL),'[]') AS children
      FROM information.operations o JOIN m1.sources s ON s.id=o.source_id JOIN platform.actors a ON a.subject=$1
      LEFT JOIN information.operations c ON c.parent_id=o.id LEFT JOIN information.processing_runs p ON p.id=c.processing_id
      WHERE o.kind='batch' AND ('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys))
      AND ($2::timestamptz IS NULL OR o.scheduled_at>=$2) AND ($3::timestamptz IS NULL OR o.scheduled_at<$3)
      GROUP BY o.id,s.catalog_key,s.name ORDER BY o.scheduled_at DESC,o.id DESC`, [actor, from, to])).rows;
    const results = new Map<string, SourceResult>();
    for (const op of operations) {
      const children = op.children ?? [];
      const active = children.filter(child => child.status !== 'completed');
      const stage = children.length ? (active.length ? active : children).reduce((a, b) => phase.indexOf(a.stage) < phase.indexOf(b.stage) ? a : b).stage : op.stage;
      results.set(op.id, { source_key: op.source_key, name: op.name, operation_id: op.id,
        status: op.paused ? 'paused' : stateOf(children.map(child => child.paused ? 'paused' : child.status), op.status),
        stage, reason_code: op.reason_code ?? children.find(child => child.reason_code)?.reason_code ?? null,
        saved_count: new Set(children.map(child => child.version_id).filter(Boolean)).size, children });
    }
    const rows = (await this.repo.db.query<{ id: string; scheduled_at: Date; version: number; paused: boolean; catalog_key: string; name: string; operation_id: string | null; status: string; reason_code: string | null; scope_complete: boolean }>(`SELECT b.*,s.catalog_key,s.name,bs.operation_id,bs.status,bs.reason_code,
      NOT EXISTS(SELECT 1 FROM platform.task_batch_sources other JOIN m1.sources os ON os.id=other.source_id WHERE other.batch_id=b.id AND NOT ('*'=ANY(a.source_keys) OR os.catalog_key=ANY(a.source_keys))) AS scope_complete
      FROM platform.task_batches b JOIN platform.task_batch_sources bs ON bs.batch_id=b.id JOIN m1.sources s ON s.id=bs.source_id JOIN platform.actors a ON a.subject=$1
      WHERE ('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys)) AND ($2::timestamptz IS NULL OR b.scheduled_at>=$2) AND ($3::timestamptz IS NULL OR b.scheduled_at<$3)
      ORDER BY b.scheduled_at DESC,b.id,s.catalog_key`, [actor, from, to])).rows;
    const grouped = new Map<string, Omit<Batch, 'status' | 'saved_count' | 'completed_sources' | 'error_sources' | 'has_error'>>();
    for (const row of rows) {
      if (!grouped.has(row.id)) grouped.set(row.id, { id: row.id, scheduled_at: row.scheduled_at, version: row.version, paused: row.paused, sources: [], scope_complete: row.scope_complete });
      grouped.get(row.id)!.sources.push(row.operation_id && results.has(row.operation_id) ? results.get(row.operation_id)! : { source_key: row.catalog_key, name: row.name, operation_id: row.operation_id, status: row.status, stage: 'source', reason_code: row.reason_code, saved_count: 0, children: [] });
    }
    const all = [...grouped.values()].map(decorate);
    for (const op of operations) if (!op.grouped) all.push(decorate({ id: op.id, scheduled_at: op.scheduled_at, version: Number(op.generation), paused: Boolean(op.paused), sources: [results.get(op.id)!], scope_complete: true }));
    all.sort((a, b) => +new Date(b.scheduled_at) - +new Date(a.scheduled_at) || b.id.localeCompare(a.id));
    const ongoing = (row: Batch) => ['queued','pending','running','paused'].includes(row.status) || row.sources.some(source => ['queued','pending','running','paused'].includes(source.status));
    const selected = all.filter(row => (!query.status || (query.status === 'active' ? grouped.has(row.id) && ongoing(row) : query.status === 'attention' ? row.has_error : row.status === query.status)) && (!query.q || row.id.toLowerCase().includes(query.q.toLowerCase())));
    return { items: selected.slice(0, 100), total: selected.length, limit: 100, timezone: 'Asia/Shanghai', ...(query.status === 'active' ? { latest_batch: all.find(row => grouped.has(row.id)) ?? null } : {}), metrics: { total: all.length, running: all.filter(x => x.status === 'running').length, errors: all.filter(x => x.has_error).length, attention: all.filter(x => x.has_error).length, paused: all.filter(x => x.status === 'paused').length, queued: all.filter(x => x.status === 'queued').length } };
  }
  async create(actor: string, key: string, input: { source_keys: string[]; limit: number }): Promise<Batch> {
    const accepted = await this.repo.action(actor, 'task-batch-create', key, input, async tx => {
      for (const source of input.source_keys) await this.repo.authorize(actor, 'submit', source, tx);
    }, async tx => {
      const batch = (await tx.query<{ id: string }>('INSERT INTO platform.task_batches(actor) VALUES($1) RETURNING id', [actor])).rows[0]!;
      for (const sourceKey of [...input.source_keys].sort()) {
        const source = (await tx.query<{ id: string; version: number; state: string }>('SELECT id,version,state FROM m1.sources WHERE catalog_key=$1 FOR SHARE', [sourceKey])).rows[0];
        if (!source) throw new DomainError('SOURCE_UNKNOWN', 404);
        let operation: OperationRow | undefined, reason: string | null = null;
        if (source.state !== 'ACTIVE') reason = 'SOURCE_DISABLED';
        else {
          try { operation = await this.repo.submit({ source_key: sourceKey, limit: input.limit }, actor, `task/${batch.id}/${sourceKey}`, tx); }
          catch (error) { if (!(error instanceof DomainError) || error.status >= 500) throw error; reason = error.code; }
        }
        await tx.query('INSERT INTO platform.task_batch_sources(batch_id,source_id,source_version,operation_id,status,reason_code) VALUES($1,$2,$3,$4,$5,$6)', [batch.id, source.id, source.version, operation?.id ?? null, operation ? 'queued' : 'blocked', reason]);
      }
      await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'task-batch-create',$2,$3)", [actor, batch.id, input]);
      return batch;
    });
    const batch = (await this.list(actor, { q: accepted.id })).items[0];
    if (!batch) throw new DomainError('NOT_FOUND', 404); return batch;
  }
  private async scope(actor: string, id: string, permission: string, tx: PoolClient): Promise<void> {
    const sources = (await tx.query<{ catalog_key: string }>(`SELECT s.catalog_key FROM platform.task_batch_sources bs JOIN m1.sources s ON s.id=bs.source_id WHERE bs.batch_id=$1
      UNION SELECT s.catalog_key FROM information.operations o JOIN m1.sources s ON s.id=o.source_id WHERE o.id=$1 AND o.kind='batch'`, [id])).rows;
    if (!sources.length) throw new DomainError('NOT_FOUND', 404);
    for (const source of sources) { await this.repo.authorize(actor, 'read', source.catalog_key, tx); await this.repo.authorize(actor, permission, source.catalog_key, tx); }
  }
  async control(actor: string, id: string, key: string, input: { action: 'pause' | 'resume'; expected_version: number; reason: string }): Promise<Batch> {
    await this.repo.action(actor, 'task-batch-control', key, { id, ...input }, tx => this.scope(actor, id, 'submit', tx), async tx => {
      await this.repo.lockTaskGraph(tx);
      const batch = (await tx.query<{ version: number; paused: boolean }>('SELECT version,paused FROM platform.task_batches WHERE id=$1 FOR UPDATE', [id])).rows[0];
      const roots = batch ? (await tx.query<{ id: string }>('SELECT operation_id AS id FROM platform.task_batch_sources WHERE batch_id=$1 AND operation_id IS NOT NULL ORDER BY operation_id', [id])).rows.map(x => x.id) : [id];
      const legacy = batch ? undefined : await this.repo.rawOperation(id, tx);
      if ((batch?.version ?? Number(legacy!.generation)) !== input.expected_version) throw new DomainError('VERSION_CONFLICT', 409);
      let all = (await tx.query<OperationRow>('SELECT * FROM information.operations WHERE id=ANY($1::uuid[]) OR parent_id=ANY($1::uuid[]) ORDER BY id', [roots])).rows;
      if (input.action === 'resume') {
        const needed = all.filter(op => roots.includes(op.id) && (all.some(child => child.parent_id === op.id) ? all.some(child => child.parent_id === op.id && child.status !== 'completed') : op.status !== 'completed'));
        const sources = (await tx.query<{id:string;version:number;state:string}>('SELECT id,version,state FROM m1.sources WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE', [[...new Set(needed.map(op => op.source_id))]])).rows;
        for (const source of sources) {
          if (source.state !== 'ACTIVE') throw new DomainError('SOURCE_DISABLED', 409);
          requireConnector(await this.repo.connectionFor({ source_id: source.id, source_version: source.version }, tx));
        }
      }
      const ids = all.map(x => x.id), processingIds = [...new Set(all.map(x => x.processing_id).filter((x): x is string => Boolean(x)))].sort();
      // Model acceptance locks the processing first; controls use the same order.
      const processings = processingIds.length ? (await tx.query<{ id: string; generation: string; extraction_status: string; paused: boolean }>('SELECT * FROM information.processing_runs WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [processingIds])).rows : [];
      all = (await tx.query<OperationRow>('SELECT * FROM information.operations WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [ids])).rows;
      const pause = input.action === 'pause';
      for (const processing of processings) {
        if (['completed', 'review'].includes(processing.extraction_status)) continue;
        const shared = (await tx.query('SELECT 1 FROM information.operations WHERE processing_id=$1 AND NOT (id=ANY($2::uuid[])) AND NOT paused', [processing.id, ids])).rowCount;
        if (shared || (pause && processing.paused) || (!pause && !processing.paused && !all.some(op => op.paused))) continue;
        const generation = Number(processing.generation) + 1;
        await tx.query('UPDATE information.processing_runs SET paused=$2,generation=$3 WHERE id=$1', [processing.id, pause, generation]);
        if (!pause && processing.extraction_status === 'pending') await this.repo.intent(tx, 'extract', processing.id, generation);
      }
      for (const operation of all) {
        if (operation.status === 'completed' || operation.paused === pause) continue;
        const generation = Number(operation.generation) + 1;
        await tx.query('UPDATE information.operations SET paused=$2,generation=$3,updated_at=now() WHERE id=$1', [operation.id, pause, generation]);
        if (!pause && !operation.processing_id && !errors.has(operation.status)) {
          if (operation.kind === 'material' || !all.some(child => child.parent_id === operation.id)) await this.repo.intent(tx, operation.kind === 'batch' ? 'discovery' : 'material', operation.id, generation);
        }
      }
      if (batch) await tx.query('UPDATE platform.task_batches SET paused=$2,version=version+1 WHERE id=$1', [id, pause]);
      await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'task-batch-control',$2,$3)", [actor, id, input]);
      return { id };
    });
    const result = (await this.list(actor, { q: id })).items[0];
    if (!result) throw new DomainError('NOT_FOUND', 404); return result;
  }
  async schedule(actor: string, source: string, key: string, input: { enabled: boolean; interval_seconds: number; expected_updated_at: string | null }) {
    return this.repo.action(actor, 'schedule-edit', key, { source, ...input }, tx => this.repo.authorize(actor, 'submit', source, tx), async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`schedule:${source}`]);
      const owner = (await tx.query<{ id: string }>('SELECT id FROM m1.sources WHERE catalog_key=$1 FOR SHARE', [source])).rows[0];
      if (!owner) throw new DomainError('NOT_FOUND', 404);
      const current = (await tx.query<{ updated_at: Date }>('SELECT updated_at FROM platform.source_schedules WHERE source_id=$1 FOR UPDATE', [owner.id])).rows[0];
      if (current ? !input.expected_updated_at || current.updated_at.getTime() !== Date.parse(input.expected_updated_at) : input.expected_updated_at !== null) throw new DomainError('SCHEDULE_VERSION_CHANGED', 409);
      const row = (await tx.query(`INSERT INTO platform.source_schedules(source_id,enabled,interval_seconds,next_run_at) VALUES($1,$2,$3,clock_timestamp()+make_interval(secs=>$3::integer))
        ON CONFLICT(source_id) DO UPDATE SET enabled=$2,interval_seconds=$3,next_run_at=clock_timestamp()+make_interval(secs=>$3::integer),updated_at=clock_timestamp() RETURNING *`, [owner.id, input.enabled, input.interval_seconds])).rows[0];
      await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'schedule-edit',$2,$3)", [actor, owner.id, input]);
      return row;
    });
  }
  async history(actor: string, source: string) {
    await this.repo.authorize(actor,'read',source);
    const owner=(await this.repo.db.query<{id:string}>('SELECT id FROM m1.sources WHERE catalog_key=$1',[source])).rows[0];
    if(!owner)throw new DomainError('NOT_FOUND',404);
    const rows=(await this.repo.db.query<{id:string;scheduled_at:Date;operation_id:string|null;status:string;error_code:string|null}>('SELECT id,scheduled_at,operation_id,status,error_code FROM platform.schedule_runs WHERE source_id=$1 ORDER BY scheduled_at DESC,id DESC LIMIT 50',[owner.id])).rows;
    const items=await Promise.all(rows.map(async row=>{
      if(!row.operation_id)return {...row,saved_count:0};
      const operation=await this.repo.operation(row.operation_id);
      const children=operation.children?.length?operation.children:[operation];
      return {...row,status:operation.paused?'paused':operation.slice_status,error_code:operation.reason_code??children.find(child=>child.reason_code)?.reason_code??row.error_code,saved_count:new Set(children.map(child=>child.version_id).filter(Boolean)).size};
    }));
    return {source_key:source,items,limit:50};
  }
}
