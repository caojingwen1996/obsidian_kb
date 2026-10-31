import type { FastifyInstance } from 'fastify';
import { DomainError } from '../platform/types.js';
import type { Repository } from '../information-ingestion/processing/repository.js';
import { IngestionRepository } from '../information-ingestion/processing/current-repository.js';
import { CurrentSourceManagement, currentSourceView } from '../information-ingestion/sources/current-management.js';
import type { Profile } from '../information-ingestion/sources/management.js';
import { connectorFor } from '../information-ingestion/sources/connectors.js';

function key(headers: Record<string, unknown>): string {
  const value = headers['idempotency-key'];
  if (typeof value !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(value)) throw new DomainError('IDEMPOTENCY_KEY_INVALID', 400);
  return value;
}
const uuid = { type: 'string', pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' };
const text = { type: 'string', minLength: 1, maxLength: 2000 };
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const idParams = object({ id: uuid });
const sourceParams = object({ key: text });
export function registerCurrentManagement(app: FastifyInstance, repo: Repository, authentication: string) {
  const store = new IngestionRepository(repo), sources = new CurrentSourceManagement(repo);
  app.get('/api/v1/session', async request => {
    await repo.authorize(request.actor, 'read');
    return { ...(await repo.db.query('SELECT subject AS actor,permissions,source_keys FROM platform.actors WHERE subject=$1', [request.actor])).rows[0], authentication, schema_version: 5 };
  });
  app.get('/api/v1/m1/sources', async request => {
    await repo.authorize(request.actor, 'read');
    const items = (await repo.db.query(`SELECT s.id,s.catalog_key,s.name,s.url,s.metadata,s.financial_attributes,s.state,s.updated_at FROM m1.sources s JOIN platform.actors a ON a.subject=$1 WHERE '*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys) ORDER BY s.catalog_key`, [request.actor])).rows;
    return { items: items.map(source => { let connection; try { connection = connectorFor(source.catalog_key); } catch { connection = { readiness: 'needs_adapter', kind: 'blocked', reason: 'CONNECTOR_NOT_CONFIGURED' }; } return { ...currentSourceView(source), profile: currentSourceView(source).metadata, connection, connector_configured: connection.readiness === 'ready' }; }) };
  });
  const profile = { type: 'object', required: ['name', 'url'], maxProperties: 30, properties: { name: text, url: { type: 'string', maxLength: 2000 }, dims: { type: 'array', maxItems: 20, items: text } }, additionalProperties: { anyOf: [{ type: 'string', maxLength: 2000 }, { type: 'array', maxItems: 20, items: text }] } };
  app.post('/api/v1/m1/sources', { schema: { body: object({ profile }) } }, async (request, reply) => reply.code(201).send(await sources.create(request.actor, key(request.headers), (request.body as { profile: Profile }).profile)));
  app.put('/api/v1/m1/sources/:key', { schema: { params: sourceParams, body: object({ expected_updated_at: text, profile, reason: text }, ['expected_updated_at', 'profile']) } }, async request => sources.edit(request.actor, (request.params as { key: string }).key, request.body as { expected_updated_at: string; profile: Profile; reason?: string }, key(request.headers)));
  app.patch('/api/v1/m1/sources/:key', { schema: { params: sourceParams, body: object({ state: { enum: ['ACTIVE', 'DISABLED'] }, expected_updated_at: text, reason: text }, ['state', 'expected_updated_at']) } }, async request => sources.state(request.actor, (request.params as { key: string }).key, request.body as { state: string; expected_updated_at: string; reason?: string }, key(request.headers)));
  app.get('/api/v1/l0/monitor',async request=>{
    await repo.authorize(request.actor,'read');
    const scope=`JOIN m1.sources s ON s.id=q.source_id JOIN platform.actors a ON a.subject=$1 WHERE '*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys)`;
    const plans=(await repo.db.query(`SELECT q.*,s.catalog_key FROM infomation.ingestion_schedules q ${scope} ORDER BY s.catalog_key`,[request.actor])).rows;
    const tasks=(await repo.db.query(`SELECT q.*,s.catalog_key FROM infomation.ingestion_tasks q ${scope} ORDER BY q.scheduled_at DESC,q.id LIMIT 100`,[request.actor])).rows;
    const material=(await repo.db.query(`SELECT q.id,q.source_id,q.version,q.content_digest,q.availability_state,q.availability_error,q.extraction_result,s.catalog_key FROM infomation.ingestion_material q ${scope} ORDER BY q.collected_at DESC,q.id LIMIT 100`,[request.actor])).rows;
    const alerts=(await repo.db.query(`SELECT r.* FROM platform.runtime_alerts r JOIN platform.actors a ON a.subject=$1 WHERE r.resolved_at IS NULL AND (r.owner_id IS NULL OR EXISTS(SELECT 1 FROM infomation.ingestion_tasks t JOIN m1.sources s ON s.id=t.source_id WHERE t.id=r.owner_id AND ('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys))) OR EXISTS(SELECT 1 FROM infomation.ingestion_material m JOIN m1.sources s ON s.id=m.source_id WHERE m.id=r.owner_id AND ('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys))) OR EXISTS(SELECT 1 FROM information.event_candidates c JOIN infomation.ingestion_material m ON m.id=c.material_id JOIN m1.sources s ON s.id=m.source_id WHERE c.id=r.owner_id AND ('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys)))) ORDER BY r.opened_at DESC`,[request.actor])).rows;
    return {schema_version:5,plans,tasks,material,alerts,coverage:{tasks:'latest 100',material:'latest 100',source_keys:(await repo.db.query('SELECT source_keys FROM platform.actors WHERE subject=$1',[request.actor])).rows[0].source_keys}};
  });
  app.get('/api/v1/l0/tasks', async request => {
    await repo.authorize(request.actor, 'read');
    const query = request.query as { source?: string; trigger?: string; status?: string; offset?:string; limit?:string };
    const offset=Number(query.offset??0),limit=Number(query.limit??100);
    if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw new DomainError('PAGINATION_INVALID',400);
    const values=[request.actor,query.source??null,query.trigger??null,query.status??null];
    const from=`FROM infomation.ingestion_tasks t JOIN m1.sources s ON s.id=t.source_id JOIN platform.actors a ON a.subject=$1 WHERE ('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys)) AND ($2::text IS NULL OR s.catalog_key=$2) AND ($3::text IS NULL OR t.trigger_type=$3) AND ($4::text IS NULL OR t.status=$4)`;
    const total=Number((await repo.db.query(`SELECT count(*) AS n ${from}`,values)).rows[0].n);
    const items=(await repo.db.query(`SELECT t.*,s.catalog_key,s.name ${from} ORDER BY t.scheduled_at DESC,t.id DESC LIMIT $5 OFFSET $6`,[...values,limit,offset])).rows;
    return {items,total,offset,limit,next_offset:offset+limit<total?offset+limit:null,timezone:'Asia/Shanghai',coverage:{source:query.source??null,trigger:query.trigger??null,status:query.status??null}};
  });
  app.post('/api/v1/l0/tasks', { schema: { body: object({ source_keys: { type: 'array', minItems: 1, maxItems: 40, uniqueItems: true, items: text }, limit: { type: 'integer', minimum: 1, maximum: 5 },url:{type:'string',minLength:1,maxLength:2000} },['source_keys','limit']) } }, async (request, reply) => reply.code(202).send(await store.submitMany(request.actor, key(request.headers), request.body as { source_keys: string[]; limit: number; url?:string })));
  app.get('/api/v1/l0/tasks/:id', { schema: { params: idParams } }, async request => {
    const task = await store.task((request.params as { id: string }).id);
    const source = (await repo.db.query('SELECT catalog_key FROM m1.sources WHERE id=$1', [task.source_id])).rows[0];
    await repo.authorize(request.actor, 'read', source.catalog_key);
    const materials = (await repo.db.query(`SELECT m.id AS material_id,m.title,m.version,m.content_digest,m.canonical_url,m.collected_at,m.availability_state FROM infomation.ingestion_task_material tm JOIN infomation.ingestion_material m ON m.id=tm.material_id WHERE tm.task_id=$1 ORDER BY m.collected_at,m.id`, [task.id])).rows;
    return { task, materials, content_notice: '资料显示当前正文，版本可能已在后续采集中更新。' };
  });
  app.post('/api/v1/l0/tasks/:id/control', { schema: { params: idParams, body: object({ action: { enum: ['pause', 'resume', 'retry'] }, control_revision: { type: 'integer', minimum: 1 }, reason: text }) } }, async request => {
    const id = (request.params as { id: string }).id, body = request.body as { action: string; control_revision: number; reason: string };
    return repo.action(request.actor, 'ingestion-control', key(request.headers), { id, ...body }, async tx => {
      const task = await store.task(id, tx);
      const source = (await tx.query('SELECT catalog_key FROM m1.sources WHERE id=$1', [task.source_id])).rows[0];
      await repo.authorize(request.actor, body.action === 'retry' ? 'retry' : 'submit', source.catalog_key, tx);
    }, async tx => {
      const task = await store.task(id, tx, true);
      if (Number(task.control_revision) !== body.control_revision) throw new DomainError('STALE_EXECUTION', 409);
      if (['completed', 'failed'].includes(task.status)) throw new DomainError('TASK_TERMINAL', 409);
      if (body.action !== 'pause') await store.checkTask(id, body.control_revision, tx, body.action === 'resume');
      const result = (await tx.query("UPDATE infomation.ingestion_tasks SET paused=$2,control_revision=control_revision+1,status=CASE WHEN $2 THEN status ELSE 'queued' END,reason_code=NULL,updated_at=clock_timestamp() WHERE id=$1 RETURNING *", [id, body.action === 'pause'])).rows[0];
      if (body.action !== 'pause') {
        const input = (await tx.query("SELECT input FROM platform.execution_intents WHERE kind='ingestion' AND owner_id=$1 ORDER BY generation DESC LIMIT 1", [id])).rows[0]?.input;
        if (!input) throw new DomainError('TASK_INPUT_UNAVAILABLE', 409);
        await tx.query("INSERT INTO platform.execution_intents(kind,owner_id,generation,workflow_id,input) VALUES('ingestion',$1,$2,$3,$4)", [id, result.control_revision, `ingestion/${id}/${result.control_revision}`, input]);
      }
      await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'ingestion-control',$2,$3)", [request.actor, id, body]);
      return result;
    });
  });
  app.get('/api/v1/l0/material/:id', { schema: { params: idParams } }, request => store.material(request.actor, (request.params as { id: string }).id));
  app.get('/api/v1/l0/schedules', async request => {
    await repo.authorize(request.actor, 'read');
    return { items: (await repo.db.query("SELECT q.*,s.catalog_key,s.name,s.state AS source_state FROM infomation.ingestion_schedules q JOIN m1.sources s ON s.id=q.source_id JOIN platform.actors a ON a.subject=$1 WHERE '*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys) ORDER BY s.catalog_key", [request.actor])).rows };
  });
  app.patch('/api/v1/l0/schedules/:key', { schema: { params: sourceParams, body: object({ enabled: { type: 'boolean' }, interval_seconds: { type: 'integer', minimum: 60, maximum: 86400 }, expected_updated_at: text }) } }, async request => {
    const source = (request.params as { key: string }).key, body = request.body as { enabled: boolean; interval_seconds: number; expected_updated_at: string };
    return repo.action(request.actor, 'ingestion-schedule', key(request.headers), { source, ...body }, tx => repo.authorize(request.actor, 'submit', source, tx), async tx => {
      const row = (await tx.query(`UPDATE infomation.ingestion_schedules q SET enabled=$2,interval_seconds=$3,next_run_at=clock_timestamp()+make_interval(secs=>$3::integer),updated_at=date_trunc('milliseconds',clock_timestamp()) FROM m1.sources s WHERE s.id=q.source_id AND s.catalog_key=$1 AND q.updated_at=$4::timestamptz RETURNING q.*`, [source, body.enabled, body.interval_seconds, body.expected_updated_at])).rows[0];
      if (!row) throw new DomainError('SCHEDULE_VERSION_CHANGED', 409); return row;
    });
  });
  // 旧身份不能被当成新的资料或任务重新解释。
  for (const path of ['/api/v1/l0/versions/:id', '/api/v1/l0/operations/:id', '/api/v1/l0/processings/:id', '/api/v1/l0/task-batches/:id']) app.get(path, { schema: { params: idParams } }, async (_request, reply) => reply.code(410).send({ error: { code: 'RESOURCE_RESET_BY_SCHEMA5' } }));
}
