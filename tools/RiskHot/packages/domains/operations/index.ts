import { createHash } from 'node:crypto';
import {
  ensure,
  expected,
  iso,
  object,
  permit,
  text,
  type CommandHandler,
  type Context,
  type Data,
  type RecordRow,
} from '../../platform/core/types.js';
const json = (x: unknown) => JSON.parse(JSON.stringify(x));
export async function enqueueTask(c: Context, type: string, input: Data): Promise<RecordRow> {
  const key = 'task:' + type + ':' + createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const old = await c.db.findClaim(key);
  if (old) return c.db.get('operations', old);
  const task = await c.db.create(
    'operations',
    'task',
    {
      type,
      input,
      owner_id: c.actor.id,
      initiator_roles: c.actor.roles,
      generation: 1,
      commit_eligible: true,
      attempts: 0,
      stage: 'accepted',
      model_provider: process.env.MODEL_PROVIDER || 'manual',
      model_id: process.env.MODEL_ID || null,
      rule: 'manual-review',
      progress: 0,
    },
    'queued',
  );
  ensure(await c.db.claim(key, task.id), 'DUPLICATE_TASK', '同输入任务已受理', 409);
  await c.db.emit('task.start', task.id, { task_id: task.id, generation: 1 });
  return task;
}
function owns(c: Context, t: RecordRow) {
  ensure(
    t.data.owner_id === c.actor.id || c.actor.roles.some((x) => x === 'reviewer' || x === 'admin'),
    'FORBIDDEN',
    '无权管理他人的任务',
    403,
  );
}
const cancel: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer', 'admin');
  const t = await c.db.get('operations', text(i, 'id'), true);
  ensure(t.kind === 'task', 'INVALID_REFERENCE', '任务不存在');
  owns(c, t);
  ensure(!['completed', 'cancelled'].includes(t.status), 'TASK_TERMINAL', '任务已结束');
  const out = await c.db.update(
    'operations',
    t.id,
    expected(i),
    {
      ...t.data,
      commit_eligible: false,
      generation: Number(t.data.generation) + 1,
      cancellation_reason: text(i, 'reason'),
      cancelled_at: c.now,
    },
    'cancelled',
  );
  await c.db.emit('task.cancel', t.id, { task_id: t.id });
  return json(out);
};
const retry: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer', 'admin');
  const t = await c.db.get('operations', text(i, 'id'), true);
  owns(c, t);
  ensure(
    t.kind === 'task' && t.status === 'failed',
    'NOT_RETRYABLE',
    '仅失败任务可技术重试；待人工判断请处理原任务',
  );
  ensure(t.data.retryable !== false, 'NOT_RETRYABLE', '该错误需修正输入后重算');
  const out = await c.db.update(
    'operations',
    t.id,
    expected(i),
    { ...t.data, attempts: Number(t.data.attempts) + 1, retry_reason: text(i, 'reason'), stage: 'accepted' },
    'queued',
  );
  await c.db.emit('task.retry', t.id, { task_id: t.id, attempt: out.data.attempts! });
  return json(out);
};
const recompute: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const t = await c.db.get('operations', text(i, 'id'));
  owns(c, t);
  return json(
    await c.enqueue(text(t.data, 'type'), {
      ...object(t.data, 'input'),
      recompute_of: t.id,
      recompute_reason: text(i, 'reason'),
      recompute_operation_id: c.operationId,
    }),
  );
};
const assign: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const d = object(i, 'data');
  for (const key of ['domain', 'object_id', 'assignee_id']) text(d, key);
  const reviewer = await c.db.get('identity', text(d, 'assignee_id'));
  ensure(
    reviewer.kind === 'user' &&
      reviewer.status === 'active' &&
      Array.isArray(reviewer.data.roles) &&
      reviewer.data.roles.includes('reviewer'),
    'INVALID_REVIEWER',
    '只能指派有效审核员',
  );
  await c.db.get(text(d, 'domain') as import('../../platform/core/types.js').Domain, text(d, 'object_id'));
  return json(
    await c.db.create('operations', 'review_assignment', { ...d, assigned_by: c.actor.id }, 'assigned'),
  );
};
const review: CommandHandler = async (c, i) => {
  permit(c, 'reviewer');
  const d = object(i, 'data');
  ensure(
    ['return', 'reject'].includes(text(d, 'decision')),
    'INVALID_DECISION',
    '批准操作请在对应领域执行；此入口仅退回或驳回',
  );
  return json(
    await c.db.create(
      'operations',
      'review_decision',
      { ...d, reason: text(i, 'reason'), decided_by: c.actor.id },
      'recorded',
    ),
  );
};
function validSchedule(d: Data) {
  ensure(['collect', 'analysis', 'report'].includes(text(d, 'type')), 'INVALID_PLAN', '计划类型无效');
  text(d, 'name');
  text(d, 'timezone');
  try {
    new Intl.DateTimeFormat('zh-CN', { timeZone: text(d, 'timezone') }).format();
  } catch {
    ensure(false, 'INVALID_TIMEZONE', '时区无效');
  }
  ensure(
    typeof d.interval_minutes === 'number' && d.interval_minutes >= 1,
    'INVALID_INTERVAL',
    '间隔至少一分钟',
  );
  object(d, 'input');
  iso(text(d, 'next_at'));
}
const schedule: CommandHandler = async (c, i) => {
  permit(c, 'admin');
  const d = object(i, 'data');
  validSchedule(d);
  if (i.id) {
    const r = await c.db.get('operations', text(i, 'id'), true);
    ensure(r.kind === 'schedule', 'INVALID_REFERENCE', '计划不存在');
    ensure(r.status === 'disabled', 'PLAN_ENABLED', '先暂停计划再修改');
    return json(await c.db.update('operations', r.id, expected(i), d, 'disabled'));
  }
  return json(await c.db.create('operations', 'schedule', { ...d, owner_id: c.actor.id }, 'disabled'));
};
const scheduleStatus: CommandHandler = async (c, i) => {
  permit(c, 'admin');
  const r = await c.db.get('operations', text(i, 'id'), true);
  validSchedule(r.data);
  const out = await c.db.update(
    'operations',
    r.id,
    expected(i),
    r.data,
    i.enabled === true ? 'enabled' : 'disabled',
  );
  await c.db.emit('schedule.changed', r.id, {
    schedule_id: r.id,
    version: out.version,
    enabled: i.enabled === true,
  });
  return json(out);
};
const scheduleRun: CommandHandler = async (c, i) => {
  permit(c, 'admin');
  const r = await c.db.get('operations', text(i, 'id'));
  ensure(r.kind === 'schedule' && r.status === 'enabled', 'PLAN_DISABLED', '计划未启用');
  const key = `schedule-window:${r.id}:${text(i, 'run_key')}`;
  const old = await c.db.findClaim(key);
  if (old) return json(await c.db.get('operations', old));
  const task = await c.enqueue('schedule', {
    schedule_id: r.id,
    window: text(i, 'run_key'),
    type: r.data.type!,
    input: r.data.input!,
  });
  ensure(await c.db.claim(key, task.id), 'DUPLICATE_WINDOW', '该周期已受理', 409);
  return json(task);
};
const issue: CommandHandler = async (c, i) => {
  permit(c, 'admin');
  const r = await c.db.get('operations', text(i, 'id'), true);
  ensure(r.kind === 'issue', 'INVALID_REFERENCE', '异常事项不存在');
  const decision = text(i, 'decision');
  ensure(['acknowledge', 'resolve'].includes(decision), 'INVALID_DECISION', '决定无效');
  if (decision === 'resolve') {
    const task = await c.db.get('operations', text(r.data, 'task_id'));
    ensure(
      ['completed', 'awaiting_review', 'awaiting_input'].includes(task.status),
      'NOT_RECOVERED',
      '任务仍未恢复，不能仅凭确认关闭异常',
    );
  }
  return json(
    await c.db.update(
      'operations',
      r.id,
      expected(i),
      { ...r.data, reason: text(i, 'reason') },
      decision === 'resolve' ? 'resolved' : 'acknowledged',
    ),
  );
};
const feedback: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  ensure(
    ['in_progress', 'handled', 'declined'].includes(text(i, 'status')),
    'INVALID_STATE',
    '反馈处理状态无效',
  );
  return json(
    await c.db.create(
      'operations',
      'feedback_decision',
      {
        feedback_id: text(i, 'id'),
        expected_version: expected(i),
        status: text(i, 'status'),
        reason: text(i, 'reason'),
        actor_id: c.actor.id,
      },
      'recorded',
    ),
  );
};
export const operationCommands: Record<string, CommandHandler> = {
  'operations.cancel': cancel,
  'operations.retry': retry,
  'operations.recompute': recompute,
  'operations.assign': assign,
  'operations.review': review,
  'operations.schedule': schedule,
  'operations.schedule_status': scheduleStatus,
  'operations.schedule_run': scheduleRun,
  'operations.issue': issue,
  'operations.feedback': feedback,
};
