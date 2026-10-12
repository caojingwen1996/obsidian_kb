import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type pg from 'pg';
import {
  ensure,
  text,
  object,
  number,
  type Actor,
  type CommandHandler,
  type Context,
  type Data,
  type Domain,
  type Json,
  type RecordRow,
  type Role,
} from '../platform/core/types.js';
import { transaction } from '../platform/database/index.js';
import { taskCommitGate, finishTask } from '../platform/core/task-commit.js';
import { actorFrom } from '../domains/identity/index.js';
import { referenceCommands, referenceReview } from '../domains/reference/index.js';
import { observationCommands } from '../domains/observations/index.js';
import { informationCommands, informationReview } from '../domains/information/index.js';
import { registryCommands, registryReview } from '../domains/registry/index.js';
import { analysisCommands, analysisReview } from '../domains/analysis/index.js';
import { publicationCommands, publicationReview } from '../domains/publication/index.js';
import { operationCommands, enqueueTask } from '../domains/operations/index.js';
import { identityCommands } from '../domains/identity/index.js';

export const contracts = JSON.parse(
  readFileSync(new URL('../contracts/commands.json', import.meta.url), 'utf8'),
) as Record<string, Data>;
const handlers: Record<string, CommandHandler> = {
  ...referenceCommands,
  ...observationCommands,
  ...informationCommands,
  ...registryCommands,
  ...analysisCommands,
  ...publicationCommands,
  ...operationCommands,
  ...identityCommands,
};
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validators = Object.fromEntries(
  Object.entries(contracts).map(([name, schema]) => [name, ajv.compile(schema)]),
);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export async function executeCommand(
  pool: pg.Pool,
  actor: Actor,
  command: string,
  input: Data,
  key: string,
  now = new Date().toISOString(),
  execution?: { taskId: string; generation: number; attempt: number },
): Promise<Json> {
  const schema = contracts[command],
    handler = handlers[command],
    validate = validators[command];
  ensure(
    Object.hasOwn(contracts, command) && Object.hasOwn(handlers, command),
    'UNKNOWN_COMMAND',
    '命令不存在',
    404,
  );
  ensure(
    typeof key === 'string' && key.length >= 1 && key.length <= 200,
    'IDEMPOTENCY_REQUIRED',
    '需要有效的幂等请求标识',
    400,
  );
  ensure(
    validate(input),
    'INVALID_INPUT',
    (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('；'),
    400,
  );
  return transaction(pool, async (db) => {
    // The initial single-instance deployment serializes short business commits; no I/O or model call runs here.
    await db.client.query("SELECT pg_advisory_xact_lock(hashtextextended('riskhot-command-write', 0))");
    const current = actorFrom(await db.get('identity', actor.id));
    ensure(current.active, 'ACCOUNT_DISABLED', '账号已停用', 403);
    ensure(
      (schema['x-roles'] as Role[]).some((role) => current.roles.includes(role)),
      'FORBIDDEN',
      '当前账号没有此操作权限',
      403,
    );
    const receiptKey = `${current.id}:${command}:${key}`;
    const digest = createHash('sha256').update(canonical(input)).digest('hex');
    const old = await db.client.query('SELECT digest,response FROM platform.operations WHERE key=$1', [
      receiptKey,
    ]);
    if (old.rows[0]) {
      ensure(old.rows[0].digest === digest, 'IDEMPOTENCY_CONFLICT', '相同请求标识不能用于不同内容', 409);
      return old.rows[0].response as Json;
    }
    const context: Context = {
      db,
      actor: current,
      now: new Date(now).toISOString(),
      operationId: randomUUID(),
      enqueue: (type, data) => enqueueTask(context, type, data),
    };
    const task = execution
      ? await taskCommitGate(context, execution.taskId, 'schedule', execution.generation)
      : undefined;
    if (task) ensure(task.data.attempts === execution!.attempt, 'COMMIT_REVOKED', '计划运行已被重试替代');
    if (command === 'operations.review') {
      const review = object(input, 'data');
      const transitions: Record<string, typeof analysisReview> = {
        analysis: analysisReview,
        publication: publicationReview,
        reference: referenceReview,
        registry: registryReview,
        information: informationReview,
      };
      const domain = text(review, 'domain');
      ensure(Object.hasOwn(transitions, domain), 'INVALID_REVIEW_DOMAIN', '该模块不支持业务审核退回');
      const revised = await transitions[domain]!(
        context,
        text(review, 'object_id'),
        number(review, 'expected_version'),
        text(review, 'decision'),
        text(input, 'reason'),
      );
      if (review.decision === 'reject' && revised.data.task_id) {
        const rejectedTask = await taskCommitGate(
          context,
          String(revised.data.task_id),
          domain === 'analysis' ? 'analysis' : 'identify',
          Number(revised.data.task_generation),
        );
        await finishTask(context, rejectedTask, revised.id);
      }
    }
    const response = await handler(context, input);
    if (task) await finishTask(context, task, String((response as Data)?.id ?? context.operationId));
    await db.client.query(
      'INSERT INTO platform.operations(key,actor_id,command,digest,response) VALUES($1,$2,$3,$4,$5)',
      [receiptKey, current.id, command, digest, JSON.stringify(response)],
    );
    const row = response as unknown as Partial<RecordRow>;
    await db.audit(
      current,
      command,
      schema['x-domain'] as Domain,
      row?.id ?? String(input.id ?? context.operationId),
      { operation_id: context.operationId, input_digest: digest, resulting_version: row?.version ?? null },
    );
    return response;
  });
}
