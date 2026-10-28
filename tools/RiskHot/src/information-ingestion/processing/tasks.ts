import type { PoolClient } from 'pg';
import { DomainError } from '../../platform/types.js';
import type { ExecutionStore } from './execution.js';
import type { OperationRow } from './repository.js';
import { requireConnector } from './sources.js';

interface SourceResult {
  source_key: string; name: string; operation_id: string | null; status: string; stage: string;
  reason_code: string | null; saved_count: number; children: OperationRow[]; completed_at?: Date | null;
}
interface Batch {
  id: string; scheduled_at: Date; version: number; paused: boolean; sources: SourceResult[];
  status: string; saved_count: number; completed_sources: number; error_sources: number; has_error: boolean;
  scope_complete: boolean; trigger?: string; schedule_run_id?: string; controllable?: boolean; unstarted?: boolean; parent_batch_id?: string;
}
const errors = new Set(['partial', 'failed', 'blocked', 'review', 'recoverable', 'waiting_config']);
const phase = ['source', 'discovered', 'acquired', 'normalized', 'identified', 'saved', 'extract', 'candidates_saved'];
function stateOf(statuses: string[], fallback = 'queued'): string {
  if (!statuses.length) return fallback;
  if (statuses.every(x => x === 'completed')) return 'completed';
  if (statuses.includes('running')) return 'running';
  if (statuses.includes('queued') || statuses.includes('pending')) return statuses.some(x => x === 'completed' || x === 'partial') ? 'running' : 'queued';
  if (statuses.includes('completed') || statuses.includes('partial')) return 'partial';
  return ['review', 'recoverable', 'waiting_config', 'blocked', 'failed', 'paused', 'skipped'].find(x => statuses.includes(x)) ?? fallback;
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
  async list(actor: string, query: { from?: string; to?: string; status?: string; q?: string; source?: string; batch?: string } = {}) {
    const result=await this.load(actor,query);
    return {...result,items:result.items.slice(0,100),limit:100};
  }
  private async load(actor: string, query: { from?: string; to?: string; status?: string; q?: string; source?: string; batch?: string } = {}) {
    await this.repo.authorize(actor, 'read');
    if (query.source) await this.repo.authorize(actor, 'read', query.source);
    const from = dateBound(query.from), to = dateBound(query.to, true);
    if (from && to && from >= to) throw new DomainError('DATE_RANGE_INVALID', 400);
    const operations = (await this.repo.db.query<OperationRow & { name: string; source_key: string; children: OperationRow[]; grouped: boolean; schedule_run_id: string | null; completed_at:Date|null }>(`SELECT o.*,COALESCE(sr.scheduled_at,o.scheduled_at) AS scheduled_at,sr.id AS schedule_run_id,s.catalog_key AS source_key,s.name,
      CASE WHEN count(c.id)=0 AND o.status='completed' THEN o.updated_at ELSE MAX(c.updated_at) END AS completed_at,
      EXISTS(SELECT 1 FROM platform.task_batch_sources bs WHERE bs.operation_id=o.id) AS grouped,
      COALESCE(jsonb_agg(to_jsonb(c)||jsonb_build_object('status',CASE WHEN p.extraction_status='completed' THEN 'completed' WHEN p.extraction_status='review' THEN 'review' WHEN p.extraction_status='recoverable' AND p.error_code='MODEL_NOT_CONFIGURED' THEN 'waiting_config' WHEN p.extraction_status='recoverable' THEN 'recoverable' WHEN d.error_code IS NOT NULL THEN 'recoverable' ELSE c.status END,'delivery_error',d.error_code,'reason_code',COALESCE(p.error_code,d.error_code,c.reason_code))) FILTER(WHERE c.id IS NOT NULL),'[]') AS children
      FROM information.operations o JOIN m1.sources s ON s.id=o.source_id JOIN platform.actors a ON a.subject=$1
      LEFT JOIN LATERAL (SELECT id,scheduled_at FROM platform.schedule_runs WHERE operation_id=o.id ORDER BY scheduled_at,id LIMIT 1) sr ON true
      LEFT JOIN information.operations c ON c.parent_id=o.id LEFT JOIN information.processing_runs p ON p.id=c.processing_id LEFT JOIN information.material_deliveries d ON d.version_id=c.version_id
      WHERE o.kind='batch' AND ('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys))
      AND ($2::timestamptz IS NULL OR COALESCE(sr.scheduled_at,o.scheduled_at)>=$2) AND ($3::timestamptz IS NULL OR COALESCE(sr.scheduled_at,o.scheduled_at)<$3)
      GROUP BY o.id,s.catalog_key,s.name,sr.id,sr.scheduled_at ORDER BY COALESCE(sr.scheduled_at,o.scheduled_at) DESC,o.id DESC`, [actor, from, to])).rows;
    const results = new Map<string, SourceResult>();
    for (const op of operations) {
      const children = op.children ?? [];
      const active = children.filter(child => child.status !== 'completed');
      const stage = children.length ? (active.length ? active : children).reduce((a, b) => phase.indexOf(a.stage) < phase.indexOf(b.stage) ? a : b).stage : op.stage;
      results.set(op.id, { source_key: op.source_key, name: op.name, operation_id: op.id,
        status: op.paused ? 'paused' : stateOf(children.map(child => child.paused ? 'paused' : child.status), op.status),
        stage, reason_code: op.reason_code ?? children.find(child => child.reason_code)?.reason_code ?? null,
        saved_count: new Set(children.map(child => child.version_id).filter(Boolean)).size, children,completed_at:op.completed_at });
    }
    const rows = (await this.repo.db.query<{ id: string; scheduled_at: Date; version: number; paused: boolean; catalog_key: string; source_id: string; name: string; operation_id: string | null; status: string; reason_code: string | null; scope_complete: boolean }>(`SELECT b.*,s.catalog_key,bs.source_id,s.name,bs.operation_id,bs.status,bs.reason_code,
      NOT EXISTS(SELECT 1 FROM platform.task_batch_sources other JOIN m1.sources os ON os.id=other.source_id WHERE other.batch_id=b.id AND NOT ('*'=ANY(a.source_keys) OR os.catalog_key=ANY(a.source_keys))) AS scope_complete
      FROM platform.task_batches b JOIN platform.task_batch_sources bs ON bs.batch_id=b.id JOIN m1.sources s ON s.id=bs.source_id JOIN platform.actors a ON a.subject=$1
      WHERE ('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys)) AND ($2::timestamptz IS NULL OR b.scheduled_at>=$2) AND ($3::timestamptz IS NULL OR b.scheduled_at<$3)
      ORDER BY b.scheduled_at DESC,b.id,s.catalog_key`, [actor, from, to])).rows;
    const grouped = new Map<string, Omit<Batch, 'status' | 'saved_count' | 'completed_sources' | 'error_sources' | 'has_error'>>();
    for (const row of rows) {
      if (!grouped.has(row.id)) grouped.set(row.id, { id: row.id, scheduled_at: row.scheduled_at, version: row.version, paused: row.paused, trigger: 'manual', sources: [], scope_complete: row.scope_complete });
      grouped.get(row.id)!.sources.push(row.operation_id && results.has(row.operation_id) ? results.get(row.operation_id)! : { source_key: row.catalog_key, name: row.name, operation_id: row.operation_id, status: row.status, stage: 'source', reason_code: row.reason_code, saved_count: 0, children: [] });
    }
    const slots = query.status==='active'?[]:(await this.repo.db.query<{id:string; source_key:string; name:string; scheduled_at:Date; operation_id:string|null; status:string; error_code:string|null}>(`SELECT r.*,s.catalog_key AS source_key,s.name
      FROM platform.schedule_runs r JOIN m1.sources s ON s.id=r.source_id JOIN platform.actors a ON a.subject=$1
      WHERE ('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys))
      AND ($2::timestamptz IS NULL OR r.scheduled_at>=$2) AND ($3::timestamptz IS NULL OR r.scheduled_at<$3)
      ORDER BY r.scheduled_at DESC,r.id DESC`,[actor,from,to])).rows;
    const automatic = new Map(slots.filter(slot=>slot.operation_id).map(slot=>[slot.operation_id,slot]));
    const all = [...grouped.values()].map(decorate);
    for (const op of operations) if (!op.grouped) {
      const slot=automatic.get(op.id);
      const result=decorate({ id: op.id, scheduled_at: slot?.scheduled_at??op.scheduled_at, version: Number(op.generation), paused: Boolean(op.paused), sources: [results.get(op.id)!], scope_complete: true, trigger: slot?'automatic':'direct', ...(slot?{schedule_run_id:slot.id}:{}) });
      if(slot?.error_code&&result.status!=='completed'){result.has_error=true;result.sources[0]!.reason_code??=slot.error_code;}
      all.push(result);
    }
    for(const slot of slots.filter(slot=>!slot.operation_id)) {
      const result=decorate({ id:slot.id,scheduled_at:slot.scheduled_at,version:0,paused:false,scope_complete:true,trigger:'automatic',schedule_run_id:slot.id,unstarted:true,controllable:false,sources:[{source_key:slot.source_key,name:slot.name,operation_id:null,status:slot.status,stage:'source',reason_code:slot.error_code,saved_count:0,children:[]}] });
      if(slot.error_code)result.has_error=true;
      all.push(result);
    }
    const scoped=all.filter(row=>(!query.batch||row.id===query.batch)&&(!query.source||row.sources.some(source=>source.source_key===query.source)));
    scoped.sort((a, b) => +new Date(b.scheduled_at) - +new Date(a.scheduled_at) || b.id.localeCompare(a.id));
    const ongoing = (row: Batch) => ['queued','pending','running','paused'].includes(row.status) || row.sources.some(source => ['queued','pending','running','paused'].includes(source.status));
    const selected = scoped.filter(row => (!query.status || (query.status === 'active' ? grouped.has(row.id) && ongoing(row) : query.status === 'attention' ? row.has_error : row.status === query.status)) && (!query.q || row.id.toLowerCase().includes(query.q.toLowerCase())));
    return { items: selected, total: selected.length, timezone: 'Asia/Shanghai', ...(query.status === 'active' ? { latest_batch: scoped.find(row => grouped.has(row.id)) ?? null } : {}), metrics: { total: scoped.length, running: scoped.filter(x => x.status === 'running').length, errors: scoped.filter(x => x.has_error).length, attention: scoped.filter(x => x.has_error).length, paused: scoped.filter(x => x.status === 'paused').length, queued: scoped.filter(x => x.status === 'queued').length } };
  }
  async overview(actor:string){
    await this.repo.authorize(actor,'read');
    const plans=(await this.repo.db.query<{catalog_key:string;name:string;source_state:string;enabled:boolean;interval_seconds:number;next_run_at:Date}>(`SELECT s.catalog_key,s.name,s.state AS source_state,q.enabled,q.interval_seconds,q.next_run_at
      FROM platform.source_schedules q JOIN m1.sources s ON s.id=q.source_id JOIN platform.actors a ON a.subject=$1
      WHERE '*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys) ORDER BY s.catalog_key`,[actor])).rows;
    const tasks=(await this.load(actor)).items;
    const bySource=new Map<string,{batch:Batch;source:SourceResult}[]>();
    for(const batch of tasks)for(const source of batch.sources){
      const entries=bySource.get(source.source_key)||[];entries.push({batch,source});bySource.set(source.source_key,entries);
    }
    const active=new Set(['running','queued','pending','paused']);
    const project=({batch,source}:{batch:Batch;source:SourceResult})=>({id:batch.id,status:batch.paused&&source.status!=='completed'?'paused':source.status,
      scheduled_at:batch.scheduled_at,finished_at:source.status==='completed'?source.completed_at??null:null,
      saved_count:source.saved_count,material_count:source.children.length,reason_code:source.status==='completed'?null:source.reason_code,trigger:batch.trigger});
    const items=plans.map(plan=>{
      const entries=bySource.get(plan.catalog_key)||[];
      const current=entries.find(({batch,source})=>active.has(source.status)||(batch.paused&&source.status!=='completed'));
      const latest=entries.find(({batch,source})=>!active.has(source.status)&&!(batch.paused&&source.status!=='completed'))??entries[0];
      const status=current?project(current).status:latest&&errors.has(latest.source.status)?latest.source.status:latest?'idle':'never';
      return {...plan,status,current:current?project(current):null,latest:latest?project(latest):null};
    });
    return {items,total:items.length,updated_at:new Date(),timezone:'Asia/Shanghai'};
  }
  async detail(actor: string, id: string): Promise<Batch> {
    await this.repo.authorize(actor, 'read');
    // Old source-operation links resolve to their existing whole task.
    const parent=(await this.repo.db.query<{batch_id:string}>(`SELECT bs.batch_id FROM platform.task_batch_sources bs
      JOIN m1.sources s ON s.id=bs.source_id JOIN platform.actors a ON a.subject=$1
      WHERE bs.operation_id=$2 AND ('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys))`,[actor,id])).rows[0];
    const target=parent?.batch_id??id;
    const task=(await this.list(actor,{q:target})).items.find(row=>row.id===target);
    if(!task)throw new DomainError('NOT_FOUND',404);
    return task;
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
