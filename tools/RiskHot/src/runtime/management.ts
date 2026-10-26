import type { FastifyInstance } from 'fastify';
import { DomainError } from '../platform/types.js';
import type { ExecutionStore } from '../information-ingestion/processing/execution.js';
import { SourceManagement, type Profile } from '../information-ingestion/sources/management.js';
import { TaskManagement } from '../information-ingestion/processing/tasks.js';

const keyOf = (headers: Record<string, unknown>): string => {
  const key = headers['idempotency-key'];
  if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key)) throw new DomainError('IDEMPOTENCY_KEY_INVALID', 400);
  return key;
};
const text = { type: 'string', maxLength: 2000 };
const profile = { type: 'object', additionalProperties: false, required: ['name', 'url'], properties: {
  ...Object.fromEntries(['name', 'url', 'tier', 'group', 'focus', 'context', 'publisher', 'category', 'channel', 'allowed_scope', 'material_type', 'identity_basis', 'priority', 'frequency'].map(key => [key, text])),
  dims: { type: 'array', maxItems: 20, uniqueItems: true, items: text }, levels: { type: 'array', maxItems: 20, uniqueItems: true, items: text },
} };
const sourceKey = { type: 'string', pattern: '^(wiki-source-[0-9]{3}|custom-source-[a-f0-9-]{36})$' };
const sourceParams = { type: 'object', additionalProperties: false, required: ['key'], properties: { key: sourceKey } };
const taskParams = { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', pattern: '^[a-f0-9-]{36}$' } } };

export function registerManagement(app: FastifyInstance, repo: ExecutionStore) {
  const sources = new SourceManagement(repo), tasks = new TaskManagement(repo);
  app.get('/api/v1/session', async request => {
    await repo.authorize(request.actor, 'read');
    return (await repo.db.query('SELECT subject AS actor,permissions,source_keys FROM platform.actors WHERE subject=$1', [request.actor])).rows[0];
  });
  app.post('/api/v1/m1/sources', { schema: { body: { type: 'object', additionalProperties: false, required: ['profile'], properties: { profile } } } }, async (request, reply) => {
    const row = await sources.create(request.actor, keyOf(request.headers), (request.body as { profile: Profile }).profile);
    return reply.code(201).send(row);
  });
  app.put('/api/v1/m1/sources/:key', { schema: { params: sourceParams, body: { type: 'object', additionalProperties: false, required: ['expected_version', 'profile'], properties: { expected_version: { type: 'integer', minimum: 1 }, profile, reason: text } } } }, async request => sources.edit(request.actor, (request.params as { key: string }).key, request.body as { expected_version: number; profile: Profile; reason?: string }, keyOf(request.headers)));
  app.get('/api/v1/m1/sources/:key/history', { schema: { params: sourceParams } }, async request => sources.history(request.actor, (request.params as { key: string }).key));
  app.patch('/api/v1/m1/sources/:key', { schema: { params: sourceParams, body: { type: 'object', additionalProperties: false, required: ['state'], properties: { state: { enum: ['ACTIVE', 'DISABLED'] }, expected_version: { type: 'integer', minimum: 1 }, reason: text } } } }, async request => sources.state(request.actor, (request.params as { key: string }).key, request.body as { state: string; expected_version?: number; reason?: string }, keyOf(request.headers)));
  app.get('/api/v1/l0/task-batches', { schema: { querystring: { type: 'object', additionalProperties: false, properties: { from: { type: 'string', maxLength: 10 }, to: { type: 'string', maxLength: 10 }, q: { type: 'string', maxLength: 100 }, status: { enum: ['queued', 'running', 'completed', 'paused', 'partial', 'blocked', 'recoverable', 'review', 'waiting_config', 'failed', 'attention'] } } } } }, async request => tasks.list(request.actor, request.query as { from?: string; to?: string; status?: string; q?: string }));
  app.post('/api/v1/l0/task-batches', { schema: { body: { type: 'object', additionalProperties: false, required: ['source_keys', 'limit'], properties: { source_keys: { type: 'array', minItems: 1, maxItems: 40, uniqueItems: true, items: sourceKey }, limit: { type: 'integer', minimum: 1, maximum: 5 } } } } }, async (request, reply) => reply.code(202).send(await tasks.create(request.actor, keyOf(request.headers), request.body as { source_keys: string[]; limit: number })));
  app.post('/api/v1/l0/task-batches/:id/control', { schema: { params: taskParams, body: { type: 'object', additionalProperties: false, required: ['action', 'expected_version', 'reason'], properties: { action: { enum: ['pause', 'resume'] }, expected_version: { type: 'integer', minimum: 1 }, reason: { type: 'string', minLength: 1, maxLength: 2000 } } } } }, async request => tasks.control(request.actor, (request.params as { id: string }).id, keyOf(request.headers), request.body as { action: 'pause' | 'resume'; expected_version: number; reason: string }));
  app.patch('/api/v1/l0/schedules/:key', { schema: { params: sourceParams, body: { type: 'object', additionalProperties: false, required: ['enabled', 'interval_seconds', 'expected_updated_at'], properties: { enabled: { type: 'boolean' }, interval_seconds: { type: 'integer', minimum: 60, maximum: 86400 }, expected_updated_at: { anyOf: [{ type: 'null' }, { type: 'string', maxLength: 40 }] } } } } }, async request => tasks.schedule(request.actor, (request.params as { key: string }).key, keyOf(request.headers), request.body as { enabled: boolean; interval_seconds: number; expected_updated_at: string | null }));
}
