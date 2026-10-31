import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Repository } from '../information-ingestion/processing/repository.js';
import { EventDelivery } from '../event-management/delivery.js';
import { EventFiles, eventContentPath, messagePath } from '../event-management/files.js';
import { eventAccess } from '../event-management/store.js';
import { eventSnapshot } from '../event-management/snapshot.js';
import { DomainError } from '../platform/types.js';

const uuid = { type: 'string', pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' };
const params = { type: 'object', additionalProperties: false, required: ['id'], properties: { id: uuid } };
function download(reply: FastifyReply, bytes: Buffer, name: string) {
  return reply.type('application/json; charset=utf-8').header('content-disposition', `attachment; filename="${name}"`).header('cache-control', 'no-store').header('content-security-policy', "sandbox; default-src 'none'").send(bytes);
}
export function registerCurrentDelivery(app: FastifyInstance, repo: Repository): void {
  const delivery = new EventDelivery(repo), files = new EventFiles(repo);
  const authorizeMessage = async (id: string, actor: string) => {
    const message = await delivery.message(id);
    await eventAccess(repo, repo.db, message.event_id, actor);
    return message;
  };
  app.get('/api/v1/l0/events/:id/file', { schema: { params } }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    await eventAccess(repo, repo.db, id, request.actor);
    return download(reply, files.bytes(await eventSnapshot(repo.db, id)), 'event.json');
  });
  app.get('/api/v1/l0/events/:id/deliveries', { schema: { params } }, async request => {
    const id = (request.params as { id: string }).id;
    await eventAccess(repo, repo.db, id, request.actor);
    const rows = (await repo.db.query("SELECT d.* FROM platform.message_deliveries d JOIN platform.messages m ON m.id=d.message_id WHERE m.event_id=$1 AND m.message_type='event.facts.committed.v2' ORDER BY m.created_at,d.consumer_id", [id])).rows;
    return { items: await Promise.all(rows.map(async row => ({ ...row, ...await delivery.applicationView(row.message_id, row.consumer_id) }))) };
  });
  for (const isFiles of [false, true]) app.post(`/api/v1/l0/event-deliveries/:id/${isFiles ? 'files/retry' : 'retry'}`, {
    schema: { params, body: { type: 'object', additionalProperties: false, required: ['consumer_id', 'expected_generation', 'reason'], properties: { consumer_id: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,40}$' }, expected_generation: { type: 'integer', minimum: 1 }, reason: { type: 'string', minLength: 1, maxLength: 2000 } } } },
  }, async (request, reply) => {
    const id = (request.params as { id: string }).id, body = request.body as { consumer_id: string; expected_generation: number; reason: string };
    await authorizeMessage(id, request.actor);
    const key = request.headers['idempotency-key'];
    if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key)) throw new DomainError('IDEMPOTENCY_KEY_INVALID', 400);
    return reply.code(202).send(await delivery.retry(id, body.consumer_id, body.expected_generation, request.actor, body.reason, key, isFiles));
  });
  app.get('/api/v1/l0/event-deliveries/:id/files/:name', {
    schema: { params: { ...params, required: ['id', 'name'], properties: { id: uuid, name: { enum: ['event', 'message', 'receipt'] } } } },
  }, async (request, reply) => {
    const { id, name } = request.params as { id: string; name: string }, query = request.query as { consumer_id?: string };
    const message = await authorizeMessage(id, request.actor);
    if (name === 'event') return download(reply, await files.read(eventContentPath(id), message.payload.content), 'event.json');
    if (name === 'message') return download(reply, await files.read(messagePath(id), delivery.envelope(message)), 'message.json');
    if (!query.consumer_id) throw new DomainError('CONSUMER_REQUIRED', 422);
    const row = (await repo.db.query('SELECT receipt FROM platform.event_consumer_inbox WHERE message_id=$1 AND consumer_id=$2', [id, query.consumer_id])).rows[0];
    if (!row) throw new DomainError('RECEIPT_UNAVAILABLE', 503);
    return download(reply, await files.read(messagePath(id, query.consumer_id), row.receipt), 'receipt.json');
  });
}
