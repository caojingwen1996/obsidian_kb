import { ensure, strings, text, type Context, type RecordRow } from './types.js';

export async function taskCommitGate(
  c: Context,
  id: string,
  type: string,
  generation?: number,
): Promise<RecordRow> {
  const task = await c.db.get('operations', id, true);
  ensure(task.kind === 'task' && task.data.type === type, 'INVALID_TASK', '任务类型不匹配');
  ensure(
    task.data.commit_eligible === true &&
      !['cancelled', 'completed', 'failed'].includes(task.status) &&
      (generation === undefined || task.data.generation === generation),
    'COMMIT_REVOKED',
    '任务已结束、取消或执行代次已失效',
  );
  const initiator = await c.db.get('identity', text(task.data, 'owner_id'));
  ensure(
    initiator.status === 'active' &&
      strings(initiator.data, 'roles').some((r) => ['researcher', 'reviewer'].includes(r)),
    'COMMIT_REVOKED',
    '任务发起人已失去执行权限',
  );
  return task;
}
export async function finishTask(c: Context, task: RecordRow, resultId: string) {
  await c.db.update(
    'operations',
    task.id,
    task.version,
    {
      ...task.data,
      commit_eligible: false,
      result_id: resultId,
      progress: 100,
      stage: 'completed',
      completed_at: c.now,
    },
    'completed',
  );
  await c.db.emit('task.completed', task.id, { task_id: task.id, result_id: resultId });
}
