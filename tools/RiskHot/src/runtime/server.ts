import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { access, constants, mkdir } from 'node:fs/promises';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { Authentication } from '../platform/auth.js';
import { DomainError } from '../platform/types.js';
import { database, required } from '../platform/db.js';
import { ArtifactStore } from '../platform/artifacts.js';
import { ExecutionStore } from '../l0/execution.js';
import { connectorFor } from '../m1/connectors.js';
import { modelCredentialsConfigured } from '../l0/model.js';
import {serviceStatus} from '../platform/notifications.js';
import type { FetchCommand } from '../l0/repository.js';

declare module 'fastify' { interface FastifyRequest { actor: string } }
const uuid = { type: 'string', pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' };
const params = (...names: string[]) => ({ type: 'object', additionalProperties: false, required: names, properties: Object.fromEntries(names.map(name => [name, uuid])) });
const keyOf = (headers: Record<string, unknown>): string => {
  const value = headers['idempotency-key'];
  if (typeof value !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(value)) throw new DomainError('IDEMPOTENCY_KEY_INVALID', 400);
  return value;
};

function boundary(value: string | undefined, end: boolean): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const utc = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== value) throw new DomainError('DATE_INVALID', 400);
    return new Date(utc.getTime() - 8 * 3_600_000 + (end ? 86_400_000 : 0));
  }
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new DomainError('DATE_INVALID', 400);
  return new Date(value);
}

export async function buildServer(repo: ExecutionStore) {
  const app = Fastify({ logger: false, bodyLimit: 2_097_152 });
  const validator = new Ajv2020({ strict: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
  app.setValidatorCompiler(({ schema }) => validator.compile(schema as object));
  await app.register(cookie);
  const auth = new Authentication(repo.db); await auth.initialize();
  app.decorateRequest('actor', '');
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) return reply.code(error.status).send({ error: { code: error.code, retryable: error.retryable } });
    const record = error as { statusCode?: number; validation?: unknown };
    const status = record.statusCode && record.statusCode >= 400 && record.statusCode < 500 ? record.statusCode : record.validation ? 400 : 500;
    return reply.code(status).send({ error: { code: status === 413 ? 'REQUEST_TOO_LARGE' : status < 500 ? 'REQUEST_INVALID' : 'INTERNAL_ERROR' } });
  });
  app.addHook('onRequest', async request => {
    if (request.url.startsWith('/api/')) request.actor = await auth.subject(request);
  });
  const sourceForVersion = async (actor: string, versionId: string) => {
    const row = (await repo.db.query<{ catalog_key: string; material_id: string; raw_artifact_id: string; normalized_artifact_id: string }>('SELECT s.catalog_key,v.material_id,v.raw_artifact_id,v.normalized_artifact_id FROM information.material_versions v JOIN information.materials m ON m.id=v.material_id JOIN m1.sources s ON s.id=m.source_id WHERE v.id=$1', [versionId])).rows[0];
    if (!row) throw new DomainError('NOT_FOUND', 404);
    await repo.authorize(actor, 'read', row.catalog_key); return row;
  };
  const processingView = async (actor: string, id: string) => {
    const processing = await repo.processing(id); await sourceForVersion(actor, processing.version_id);
    const attempts = (await repo.db.query('SELECT id,attempt_no,generation,status,finish_reason,error_code,created_at,started_at,completed_at FROM platform.model_attempts WHERE processing_id=$1 ORDER BY attempt_no', [id])).rows;
    const budget = (await repo.db.query('SELECT id,generation,used,deadline FROM platform.model_budget_windows WHERE processing_id=$1 ORDER BY generation DESC LIMIT 1', [id])).rows[0] ?? null;
    return { ...processing, attempts, budget_window: budget, output_review_basis: processing.extraction_status === 'review' ? await repo.reviewBasis(id) : null };
  };
  app.get('/', async () => ({ name: 'RiskHot', stage: 'source-to-candidates', login: '/auth/login', sources: '/api/v1/m1/sources', runs: '/api/v1/l0/runs' }));
  app.get('/auth/login', async (_request, reply) => auth.login(reply));
  app.get('/auth/callback', async (request, reply) => auth.callback(request, reply));
  app.post('/auth/logout', async (request, reply) => auth.logout(request, reply));
  app.get('/health/live', async () => ({ live: true }));
  app.get('/health/ready', async (_request, reply) => {
    try {
      await repo.db.query('SELECT version FROM platform.schema_versions WHERE version=1');
      await mkdir(required('ARTIFACT_ROOT'), { recursive: true }); await access(required('ARTIFACT_ROOT'), constants.W_OK);
      return { ready: true, model_configured: Boolean(process.env.MODEL_PROTOCOL && process.env.MODEL_ENDPOINT && process.env.MODEL_NAME && modelCredentialsConfigured()) };
    } catch { return reply.code(503).send({ ready: false }); }
  });
  app.get('/api/v1/m1/sources', async request => {
    await repo.authorize(request.actor, 'read');
    const rows = (await repo.db.query("SELECT s.*,v.config->'connection' AS connection,last_op.id AS last_operation_id FROM m1.sources s JOIN m1.source_versions v ON v.source_id=s.id AND v.version=s.version JOIN platform.actors a ON a.subject=$1 LEFT JOIN LATERAL(SELECT id FROM information.operations o WHERE o.source_id=s.id AND o.kind='batch' ORDER BY o.created_at DESC,o.id DESC LIMIT 1) last_op ON true WHERE '*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys) ORDER BY s.catalog_key", [request.actor])).rows;
    return {items:await Promise.all(rows.map(async row=>{
      const connection=row.connection??connectorFor(row.catalog_key);
      const last=row.last_operation_id?await repo.operation(row.last_operation_id):null;
      return {...row,connection,connector_configured:connection.readiness==='ready',last_status:last?.slice_status??null,last_reason:last?.reason_code??last?.children?.find(child=>child.reason_code)?.reason_code??null};
    }))};
  });
  app.get('/api/v1/l0/monitor', async request => {
    await repo.authorize(request.actor, 'read');
    const schedules = (await repo.db.query(`SELECT q.*,s.catalog_key,r.id AS latest_run_id,r.status AS latest_status,r.error_code AS latest_error,r.operation_id
      FROM platform.source_schedules q JOIN m1.sources s ON s.id=q.source_id JOIN platform.actors a ON a.subject=$1
      LEFT JOIN LATERAL(SELECT * FROM platform.schedule_runs WHERE source_id=s.id ORDER BY scheduled_at DESC LIMIT 1) r ON true
      WHERE '*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys) ORDER BY s.catalog_key`, [request.actor])).rows;
    const alerts = (await repo.db.query(`SELECT x.* FROM platform.runtime_alerts x JOIN platform.actors a ON a.subject=$1
      WHERE x.resolved_at IS NULL AND ('*'=ANY(a.source_keys) OR EXISTS(SELECT 1 FROM platform.schedule_runs r JOIN m1.sources s ON s.id=r.source_id WHERE r.id=x.owner_id AND s.catalog_key=ANY(a.source_keys))
      OR EXISTS(SELECT 1 FROM information.processing_runs p JOIN information.material_versions v ON v.id=p.version_id JOIN information.materials m ON m.id=v.material_id JOIN m1.sources s ON s.id=m.source_id WHERE p.id=x.owner_id AND s.catalog_key=ANY(a.source_keys))) ORDER BY x.opened_at DESC`, [request.actor])).rows;
    const full=(await repo.db.query("SELECT '*'=ANY(source_keys) AS full FROM platform.actors WHERE subject=$1",[request.actor])).rows[0]?.full;
    return { schedules, alerts, background_service:full?await serviceStatus(process.cwd()):null, model_service: (await repo.db.query('SELECT protocol,reason_code,blocked_until,updated_at FROM platform.model_service_state')).rows, notification_semantics: 'submitted means handed to the OS; display is controlled by system settings' };
  });
  app.patch('/api/v1/m1/sources/:key', { schema: { params: { type: 'object', additionalProperties: false, required: ['key'], properties: { key: { type: 'string', pattern: '^wiki-source-[0-9]{3}$' } } }, body: { type: 'object', additionalProperties: false, required: ['state'], properties: { state: { enum: ['ACTIVE', 'DISABLED'] } } } } }, async request => {
    const { key } = request.params as { key: string }; const { state } = request.body as { state: string };
    return repo.action(request.actor, 'source-state', keyOf(request.headers), { key, state }, tx => repo.authorize(request.actor, 'source_admin', key, tx), async tx => {
      const source = (await tx.query<{ id: string; version: number; state: string }>('SELECT id,version,state FROM m1.sources WHERE catalog_key=$1 FOR UPDATE', [key])).rows[0];
      if (!source) throw new DomainError('NOT_FOUND', 404);
      if (source.state === state) return { key, state, version: source.version };
      const next = source.version + 1;
      await tx.query('INSERT INTO m1.source_versions(source_id,version,config) SELECT source_id,$3,config||jsonb_build_object(\'state\',$4::text) FROM m1.source_versions WHERE source_id=$1 AND version=$2', [source.id, source.version, next, state]);
      await tx.query('UPDATE m1.sources SET state=$2,version=$3 WHERE id=$1', [source.id, state, next]);
      await tx.query('INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,\'source-state\',$2,$3)', [request.actor, source.id, { state, version: next }]);
      return { key, state, version: next };
    });
  });
  app.post('/api/v1/l0/source-fetches', { schema: { body: { type: 'object', additionalProperties: false, required: ['source_key', 'limit'], properties: { source_key: { type: 'string', pattern: '^wiki-source-[0-9]{3}$' }, limit: { type: 'integer', minimum: 1, maximum: 5 }, url: { type: 'string', maxLength: 2048 } } } } }, async (request, reply) => {
    const input = request.body as FetchCommand;
    const operation = await repo.submit(input, request.actor, keyOf(request.headers));
    return reply.code(202).send({ operation_id: operation.id, status_url: `/api/v1/l0/operations/${operation.id}` });
  });
  app.get('/api/v1/l0/operations/:id', { schema: { params: params('id') } }, async request => {
    const operation = await repo.operation((request.params as { id: string }).id);
    await repo.authorize(request.actor, 'read', operation.source_key);
    return { ...operation, processing: operation.processing_id ? await processingView(request.actor, operation.processing_id) : null };
  });
  app.get('/api/v1/l0/runs', { schema: { querystring: { type: 'object', additionalProperties: false, properties: { from: { type: 'string' }, to: { type: 'string' }, status: { enum: ['queued', 'running', 'completed', 'partial', 'review', 'recoverable', 'waiting_config'] } } } } }, async request => {
    await repo.authorize(request.actor, 'read');
    const query = request.query as { from?: string; to?: string; status?: string };
    const from = boundary(query.from, false), to = boundary(query.to, true);
    if (from && to && from >= to) throw new DomainError('DATE_RANGE_INVALID', 400);
    const rows = await repo.db.query<{ id: string }>(`WITH batches AS (
      SELECT o.id,o.scheduled_at,CASE WHEN c.total=0 THEN o.status
        WHEN c.done=c.total THEN 'completed' WHEN c.done>0 THEN 'partial' WHEN c.review THEN 'review'
        WHEN c.broken THEN 'recoverable' WHEN c.waiting THEN 'waiting_config' ELSE 'running' END AS slice_status
      FROM information.operations o JOIN m1.sources s ON s.id=o.source_id JOIN platform.actors a ON a.subject=$1
      LEFT JOIN LATERAL (SELECT count(*) AS total,count(*) FILTER(WHERE child.status='completed' OR p.extraction_status='completed') AS done,
        bool_or(child.status='recoverable') AS broken,bool_or(child.status='waiting_config') AS waiting,bool_or(child.status='review') AS review
        FROM information.operations child LEFT JOIN information.processing_runs p ON p.id=child.processing_id WHERE child.parent_id=o.id) c ON true
      WHERE o.kind='batch' AND ('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys))
        AND ($2::timestamptz IS NULL OR o.scheduled_at>=$2) AND ($3::timestamptz IS NULL OR o.scheduled_at<$3)
    ) SELECT id FROM batches WHERE ($4::text IS NULL OR slice_status=$4) ORDER BY scheduled_at DESC,id DESC LIMIT 100`, [request.actor, from, to, query.status ?? null]);
    const items = await Promise.all(rows.rows.map(row => repo.operation(row.id)));
    return { items, limit: 100, timezone: 'Asia/Shanghai', coverage: 'latest 100 matching-filter batches' };
  });
  app.get('/api/v1/l0/processings/:id', { schema: { params: params('id'), querystring: { type: 'object', additionalProperties: false, properties: { cursor: { type: 'string', pattern: '^\\d{1,3}$' }, limit: { type: 'string', pattern: '^[1-9][0-9]{0,2}$' } } } } }, async request => {
    const processing = await processingView(request.actor, (request.params as { id: string }).id);
    const query = request.query as { cursor?: string; limit?: string };
    const start = Number(query.cursor ?? 0), limit = Number(query.limit ?? 20);
    if (limit > 100) throw new DomainError('PAGE_LIMIT', 400);
    const all = await repo.candidates(processing.id);
    return { ...processing, candidates: all.slice(start, start + limit), next_cursor: start + limit < all.length ? String(start + limit) : null };
  });
  app.get('/api/v1/l0/candidates/:id', { schema: { params: params('id') } }, async request => {
    const candidate = (await repo.db.query<{ processing_id: string; payload: unknown }>('SELECT * FROM information.event_candidates WHERE id=$1', [(request.params as { id: string }).id])).rows[0];
    if (!candidate) throw new DomainError('NOT_FOUND', 404);
    const processing = await repo.processing(candidate.processing_id); await sourceForVersion(request.actor, processing.version_id);
    return { ...candidate, version_id: processing.version_id };
  });
  app.get('/api/v1/l0/versions/:id', { schema: { params: params('id') } }, async request => {
    const id = (request.params as { id: string }).id; const version = await sourceForVersion(request.actor, id);
    return { version_id: id, material_id: version.material_id, material: await repo.json(version.normalized_artifact_id), raw_url: `/api/v1/l0/versions/${id}/raw` };
  });
  app.get('/api/v1/l0/versions/:id/raw', { schema: { params: params('id') } }, async (request, reply) => {
    const id = (request.params as { id: string }).id; const version = await sourceForVersion(request.actor, id);
    return reply.header('content-type', 'application/octet-stream').header('content-disposition', `attachment; filename="source-${id}.html"`).header('content-security-policy', "sandbox; default-src 'none'").send(await repo.bytes(version.raw_artifact_id));
  });
  app.post('/api/v1/l0/processings/:id/retry', { schema: { params: params('id'), body: { type: 'object', additionalProperties: false, required: ['expected_generation', 'reason', 'open_budget'], properties: { expected_generation: { type: 'integer', minimum: 1 }, reason: { type: 'string', minLength: 1, maxLength: 2000 }, open_budget: { type: 'boolean' } } } } }, async (request, reply) => {
    const key = keyOf(request.headers);
    const body = request.body as { expected_generation: number; reason: string; open_budget: boolean };
    const generation = await repo.retryExtraction((request.params as { id: string }).id, request.actor, body.reason, body.open_budget, body.expected_generation, key);
    return reply.code(202).send({ generation });
  });
  app.post('/api/v1/l0/operations/:id/retry', { schema: { params: params('id'), body: { type: 'object', additionalProperties: false, required: ['expected_generation', 'reason'], properties: { expected_generation: { type: 'integer', minimum: 1 }, reason: { type: 'string', minLength: 1, maxLength: 2000 } } } } }, async (request, reply) => {
    const body = request.body as { expected_generation: number; reason: string };
    const generation = await repo.retryOperation((request.params as { id: string }).id, request.actor, body.reason, body.expected_generation, keyOf(request.headers));
    return reply.code(202).send({ generation });
  });
  app.post('/api/v1/l0/processings/:id/reviews', { schema: { params: params('id'), body: { type: 'object', additionalProperties: false, required: ['expected_generation', 'basis_digest', 'decision', 'reason'], properties: { expected_generation: { type: 'integer', minimum: 1 }, basis_digest: { type: 'string', pattern: '^[a-f0-9]{64}$' }, decision: { const: 'RETRY_FIXED_INPUT' }, reason: { type: 'string', minLength: 1, maxLength: 2000 } } } } }, async (request, reply) => {
    const body = request.body as { expected_generation: number; basis_digest: string; reason: string };
    const generation = await repo.reviewOutput((request.params as { id: string }).id, request.actor, body.reason, body.expected_generation, body.basis_digest, keyOf(request.headers));
    return reply.code(202).send({ generation, status: 'recoverable', next_action: 'retry' });
  });
  return app;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const db = database(); const app = await buildServer(new ExecutionStore(db, new ArtifactStore(required('ARTIFACT_ROOT'))));
  await app.listen({ port: Number(new URL(required('API_ORIGIN')).port || 18081), host: '127.0.0.1' });
  console.log(`RiskHot API ready at ${required('API_ORIGIN')}`);
  const close = async () => { await app.close(); await db.end(); };
  process.on('SIGINT', close); process.on('SIGTERM', close);
}
