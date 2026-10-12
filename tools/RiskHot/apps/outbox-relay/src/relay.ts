import type pg from 'pg';
import {
  type Client,
  type ScheduleOptions,
  ScheduleAlreadyRunning,
  ScheduleNotFoundError,
  WorkflowExecutionAlreadyStartedError,
  WorkflowNotFoundError,
} from '@temporalio/client';
import { BusinessError, type Data, type RecordRow } from '../../../packages/platform/core/types.js';
import { transaction, type Store } from '../../../packages/platform/database/index.js';
import { temporalTaskQueue } from '../../../packages/platform/workflow/client.js';
import {
  reviewSignalName,
  taskWorkflowId,
  temporalScheduleId,
  workflowNames,
  type TaskBinding,
} from '../../../packages/platform/workflow/contracts.js';

const supportedEvents = [
  'task.start',
  'task.retry',
  'task.cancel',
  'task.completed',
  'analysis.approved',
  'schedule.changed',
];
interface Delivery {
  id: string;
  type: string;
  aggregate_id: string;
  payload: Data;
  attempts: number;
}

async function claimDelivery(pool: pg.Pool): Promise<Delivery | undefined> {
  return transaction(pool, async (db) => {
    const result = await db.client.query<Delivery>(
      `
      WITH candidate AS (
        SELECT id FROM platform.outbox
        WHERE type = ANY($1) AND status IN ('pending','processing')
          AND (lease_until IS NULL OR lease_until < now())
        ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      UPDATE platform.outbox o SET status='processing', attempts=o.attempts+1,
        lease_until=now()+interval '60 seconds'
      FROM candidate c WHERE o.id=c.id RETURNING o.*`,
      [supportedEvents],
    );
    return result.rows[0];
  });
}

async function dispatchRecord(db: Store, binding: TaskBinding): Promise<RecordRow> {
  const key = `workflow-dispatch:${binding.workflowId}`;
  const id = await db.findClaim(key);
  if (id) return db.get('operations', id, true);
  const record = await db.create(
    'operations',
    'workflow_dispatch',
    {
      task_id: binding.taskId,
      workflow_id: binding.workflowId,
      generation: binding.generation,
      attempt: binding.attempt,
      first_attempt_at: new Date().toISOString(),
    },
    'starting',
  );
  if (!(await db.claim(key, record.id)))
    throw new BusinessError('DISPATCH_CONFLICT', '启动记录正被其他 Relay 处理', 503);
  return record;
}

async function startTask(pool: pg.Pool, client: Client, event: Delivery, queue: string) {
  const prepared = await transaction(pool, async (db) => {
    const task = await db.get('operations', String(event.payload.task_id), true);
    const attempt = event.type === 'task.retry' ? Number(event.payload.attempt) : 0;
    if (
      task.kind !== 'task' ||
      task.data.commit_eligible !== true ||
      Number(task.data.attempts || 0) !== attempt ||
      ['cancelled', 'completed', 'failed'].includes(task.status)
    )
      return null;
    const binding: TaskBinding = {
      taskId: task.id,
      generation: Number(task.data.generation),
      attempt,
      workflowId: taskWorkflowId(task.id, attempt),
    };
    const dispatch = await dispatchRecord(db, binding);
    return { binding, dispatch };
  });
  if (!prepared || prepared.dispatch.status === 'started') return;
  const { binding, dispatch } = prepared;
  let temporalRunId: string;
  try {
    const known = await client.workflow.getHandle(binding.workflowId).describe();
    temporalRunId = known.runId;
  } catch (error) {
    if (!(error instanceof WorkflowNotFoundError)) throw error;
    // A long-unresolved start may have outlived server retention. It needs reconciliation, not a blind restart.
    if (Date.now() - Date.parse(String(dispatch.data.first_attempt_at)) > 24 * 60 * 60_000) {
      throw new BusinessError(
        'START_RECONCILIATION_REQUIRED',
        '启动意图超过24小时且历史不可查，请人工对账后恢复',
        422,
      );
    }
    try {
      const handle = await client.workflow.start(workflowNames.task, {
        workflowId: binding.workflowId,
        taskQueue: queue,
        args: [binding],
        workflowIdReusePolicy: 'REJECT_DUPLICATE',
        workflowIdConflictPolicy: 'FAIL',
      });
      temporalRunId = handle.firstExecutionRunId;
    } catch (startError) {
      if (!(startError instanceof WorkflowExecutionAlreadyStartedError)) throw startError;
      temporalRunId = (await client.workflow.getHandle(binding.workflowId).describe()).runId;
    }
  }
  await transaction(pool, async (db) => {
    const current = await db.get('operations', dispatch.id, true);
    if (current.status !== 'started')
      await db.update(
        'operations',
        current.id,
        current.version,
        { ...current.data, temporal_run_id: temporalRunId, started_at: new Date().toISOString() },
        'started',
      );
  });
}

async function cancelTask(pool: pg.Pool, client: Client, event: Delivery) {
  const task = await transaction(pool, (db) => db.get('operations', String(event.payload.task_id)));
  if (task.status !== 'cancelled' || task.data.commit_eligible !== false) return;
  const id = String(task.data.workflow_id || taskWorkflowId(task.id, Number(task.data.attempts || 0)));
  try {
    await client.workflow.getHandle(id).cancel();
  } catch (error) {
    if (!(error instanceof WorkflowNotFoundError)) throw error;
  }
}

export async function completeApprovedTask(
  pool: pg.Pool,
  payload: Data,
): Promise<{ taskId: string; workflowId: string } | null> {
  return transaction(pool, async (db) => {
    // Same lock order as analysis.approve: snapshot then task.
    const snapshot = await db.get('analysis', String(payload.snapshot_id), true);
    if (
      snapshot.kind !== 'snapshot' ||
      snapshot.status !== 'approved' ||
      snapshot.data.task_id !== payload.task_id
    )
      return null;
    const task = await db.get('operations', String(payload.task_id), true);
    if (task.kind !== 'task' || task.data.type !== 'analysis') return null;
    if (task.status !== 'completed') {
      if (
        task.status === 'cancelled' ||
        task.data.commit_eligible !== true ||
        task.data.generation !== snapshot.data.task_generation
      )
        return null;
      await db.update(
        'operations',
        task.id,
        task.version,
        {
          ...task.data,
          stage: 'completed',
          progress: 100,
          result_id: snapshot.id,
          completed_at: new Date().toISOString(),
          commit_eligible: false,
        },
        'completed',
      );
    }
    return {
      taskId: task.id,
      workflowId: String(task.data.workflow_id || taskWorkflowId(task.id, Number(task.data.attempts || 0))),
    };
  });
}

async function approved(pool: pg.Pool, client: Client, event: Delivery) {
  const completed = await completeApprovedTask(pool, event.payload);
  if (!completed) return;
  try {
    await client.workflow.getHandle(completed.workflowId).signal(reviewSignalName, event.id);
  } catch (error) {
    if (!(error instanceof WorkflowNotFoundError)) throw error;
  }
}

async function completedTask(pool: pg.Pool, client: Client, event: Delivery) {
  const task = await transaction(pool, (db) => db.get('operations', String(event.payload.task_id)));
  if (task.kind !== 'task' || task.status !== 'completed' || task.data.commit_eligible !== false) return;
  const workflowId = String(
    task.data.workflow_id || taskWorkflowId(task.id, Number(task.data.attempts || 0)),
  );
  try {
    await client.workflow.getHandle(workflowId).signal(reviewSignalName, event.id);
  } catch (error) {
    if (!(error instanceof WorkflowNotFoundError)) throw error;
  }
}

export async function syncSchedule(
  pool: pg.Pool,
  client: Client,
  scheduleId: string,
  queue = temporalTaskQueue(),
) {
  const plan = await transaction(pool, (db) => db.get('operations', scheduleId));
  if (plan.kind !== 'schedule') throw new BusinessError('INVALID_SCHEDULE', '计划记录不存在');
  const period = Number(plan.data.interval_minutes) * 60_000;
  const nextAt = new Date(String(plan.data.next_at));
  if (!Number.isFinite(period) || period < 60_000 || !Number.isFinite(nextAt.getTime())) {
    throw new BusinessError('INVALID_SCHEDULE', '计划周期或开始时间无效');
  }
  const id = temporalScheduleId(plan.id);
  const options: ScheduleOptions = {
    scheduleId: id,
    spec: {
      intervals: [{ every: period, offset: nextAt.getTime() % period }],
      startAt: nextAt,
      timezone: String(plan.data.timezone),
    },
    action: {
      type: 'startWorkflow',
      workflowType: workflowNames.schedule,
      taskQueue: queue,
      args: [{ scheduleId: plan.id, scheduleVersion: plan.version }],
      workflowId: `${id}/tick`,
    },
    policies: { overlap: 'SKIP', catchupWindow: '1 minute', pauseOnFailure: true },
    state: { paused: plan.status !== 'enabled', note: '仅受理研究任务；正式业务结果必须由领域审核命令保存' },
  };
  const handle = client.schedule.getHandle(id);
  try {
    await handle.describe();
    await handle.update(() => ({
      spec: options.spec,
      action: options.action,
      policies: options.policies,
      state: options.state || {},
    }));
  } catch (error) {
    if (!(error instanceof ScheduleNotFoundError)) throw error;
    try {
      await client.schedule.create(options);
    } catch (createError) {
      if (!(createError instanceof ScheduleAlreadyRunning)) throw createError;
    }
  }
  const current = await transaction(pool, (db) => db.get('operations', plan.id));
  if (current.version !== plan.version)
    throw new BusinessError('SCHEDULE_CHANGED_DURING_SYNC', '计划同步期间发生变化，将按新版本重试', 503);
}

export async function runRelayOnce(
  pool: pg.Pool,
  client: Client,
  queue = temporalTaskQueue(),
): Promise<boolean> {
  const event = await claimDelivery(pool);
  if (!event) return false;
  const lease = setInterval(() => {
    void pool
      .query(
        `UPDATE platform.outbox SET lease_until=now()+interval '60 seconds'
      WHERE id=$1 AND attempts=$2 AND status='processing'`,
        [event.id, event.attempts],
      )
      .catch(() => undefined);
  }, 15_000);
  try {
    if (event.type === 'task.start' || event.type === 'task.retry')
      await startTask(pool, client, event, queue);
    else if (event.type === 'task.cancel') await cancelTask(pool, client, event);
    else if (event.type === 'task.completed') await completedTask(pool, client, event);
    else if (event.type === 'analysis.approved') await approved(pool, client, event);
    else if (event.type === 'schedule.changed')
      await syncSchedule(pool, client, String(event.payload.schedule_id), queue);
    await pool.query(
      `UPDATE platform.outbox SET status='delivered',delivered_at=now(),lease_until=NULL,last_error=NULL
      WHERE id=$1 AND attempts=$2 AND status='processing'`,
      [event.id, event.attempts],
    );
  } catch (error) {
    const code = error instanceof BusinessError ? error.code : 'DELIVERY_FAILED';
    const permanent = error instanceof BusinessError && error.status < 500;
    const dead = permanent || event.attempts >= 8;
    // Persist a bounded code, never provider responses or connection strings that may contain credentials.
    await transaction(pool, async (db) => {
      const changed = await db.client.query(
        `UPDATE platform.outbox SET status=$3,last_error=$4,
        lease_until=now()+interval '10 seconds' WHERE id=$1 AND attempts=$2 AND status='processing' RETURNING id`,
        [event.id, event.attempts, dead ? 'failed' : 'pending', code],
      );
      if (changed.rowCount && dead) {
        const key = `outbox-issue:${event.id}`;
        if (!(await db.findClaim(key))) {
          const issue = await db.create(
            'operations',
            'issue',
            {
              task_id: event.payload.task_id || null,
              outbox_id: event.id,
              code,
              message: '可靠交接失败，需要检查执行平台连接或人工对账',
              retryable: !permanent,
            },
            'open',
          );
          await db.claim(key, issue.id);
        }
      }
    });
  } finally {
    clearInterval(lease);
  }
  return true;
}
