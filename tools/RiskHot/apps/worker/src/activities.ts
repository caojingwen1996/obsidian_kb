import { createHash } from 'node:crypto';
import type pg from 'pg';
import { Context as ActivityContext, ApplicationFailure } from '@temporalio/activity';
import { RemoteModel, type ModelAdapter } from '../../../packages/platform/agent-runtime/index.js';
import {
  BusinessError,
  object,
  type Actor,
  type Data,
  type RecordRow,
} from '../../../packages/platform/core/types.js';
import { transaction, type Store } from '../../../packages/platform/database/index.js';
import { executeCommand } from '../../../packages/application/commands.js';
import { scheduleCommand } from '../../../packages/platform/workflow/schedule-input.js';
import type {
  ExecutionFailure,
  ScheduleRun,
  TaskBinding,
  TaskState,
} from '../../../packages/platform/workflow/contracts.js';

const serviceActor: Actor = {
  id: 'temporal-worker',
  name: 'Temporal Worker',
  roles: [],
  active: true,
  evidence_access: false,
};
const terminal = new Set(['completed', 'cancelled', 'failed']);
const stateOf = (row: RecordRow): TaskState => ({
  status: row.status,
  stage: String(row.data.stage || row.status),
});
const digest = (data: Data) => createHash('sha256').update(JSON.stringify(data)).digest('hex');

function eligible(row: RecordRow, binding: TaskBinding) {
  return (
    row.kind === 'task' &&
    row.data.commit_eligible === true &&
    row.data.generation === binding.generation &&
    Number(row.data.attempts || 0) === binding.attempt &&
    !terminal.has(row.status)
  );
}

async function change(db: Store, task: RecordRow, data: Data, status: string) {
  const out = await db.update('operations', task.id, task.version, { ...task.data, ...data }, status);
  await db.audit(serviceActor, 'execution.' + status, 'operations', task.id, {
    version: out.version,
    stage: out.data.stage || status,
  });
  return out;
}

function activityFailure(error: unknown): never {
  if (error instanceof BusinessError) {
    const retryable = error.status >= 500 || error.code === 'MODEL_RATE_LIMIT';
    throw ApplicationFailure.create({ message: error.message, type: error.code, nonRetryable: !retryable });
  }
  throw error;
}

export function createActivities(pool: pg.Pool, model: ModelAdapter = new RemoteModel()) {
  return {
    async prepareTask(binding: TaskBinding): Promise<TaskState> {
      return transaction(pool, async (db) => {
        const row = await db.get('operations', binding.taskId, true);
        if (!eligible(row, binding)) return stateOf(row);
        if (row.data.proposal || ['awaiting_input', 'awaiting_review'].includes(row.status))
          return stateOf(row);
        const input = object(row.data, 'input');
        return stateOf(
          await change(
            db,
            row,
            {
              workflow_id: binding.workflowId,
              stage: 'preparing',
              progress: 10,
              execution_manifest: {
                task_id: row.id,
                generation: binding.generation,
                attempt: binding.attempt,
                input_hash: digest(input),
                schema_version: '1.0.0',
                workflow_version: 'research-v1',
                worker_build_id: process.env.WORKER_BUILD_ID || 'local-development',
                provider: row.data.model_provider || 'manual',
                model: row.data.model_id || null,
                frozen_at:
                  row.data.execution_manifest && typeof row.data.execution_manifest === 'object'
                    ? (row.data.execution_manifest as Data).frozen_at || new Date().toISOString()
                    : new Date().toISOString(),
              },
            },
            'running',
          ),
        );
      });
    },

    async propose(binding: TaskBinding): Promise<TaskState> {
      try {
        const row = await transaction(pool, (db) => db.get('operations', binding.taskId));
        if (
          !eligible(row, binding) ||
          row.data.proposal ||
          ['awaiting_input', 'awaiting_review'].includes(row.status)
        )
          return stateOf(row);
        if (row.data.type === 'schedule') {
          const input = object(row.data, 'input');
          const plan = await transaction(pool, (db) => db.get('operations', String(input.schedule_id)));
          if (
            plan.status !== 'enabled' ||
            (input.schedule_version && input.schedule_version !== plan.version)
          ) {
            throw new BusinessError(
              'SCHEDULE_NO_LONGER_ELIGIBLE',
              '计划已暂停或被新版本替代，本次执行不得继续',
              422,
            );
          }
          const command = scheduleCommand(
            String(input.type),
            object(input, 'input'),
            String(row.data.scheduled_at || row.created_at),
            String(plan.data.timezone),
          );
          if (!command)
            return transaction(pool, async (db) => {
              const current = await db.get('operations', binding.taskId, true);
              if (!eligible(current, binding)) return stateOf(current);
              return stateOf(
                await change(
                  db,
                  current,
                  {
                    stage: 'collection-input-required',
                    progress: 20,
                    message:
                      '该采集计划没有配置原文内容或已接通的抓取适配器，请补充合法来源与原文后重新执行。',
                  },
                  'awaiting_input',
                ),
              );
            });
          await executeCommand(
            pool,
            { ...serviceActor, id: String(row.data.owner_id) },
            command.name,
            command.input,
            `schedule-task:${binding.taskId}`,
            undefined,
            binding,
          );
          return transaction(pool, async (db) => stateOf(await db.get('operations', binding.taskId)));
        }
        if (!['extract', 'identify', 'analysis'].includes(String(row.data.type))) {
          throw new BusinessError('UNSUPPORTED_TASK', '不支持的任务类型', 422);
        }
        if (row.data.model_provider === 'manual') {
          return transaction(pool, async (db) => {
            const current = await db.get('operations', binding.taskId, true);
            if (!eligible(current, binding)) return stateOf(current);
            return stateOf(
              await change(
                db,
                current,
                {
                  stage: 'manual-input-required',
                  progress: 20,
                  message: '未配置模型。请在对应领域录入并审核结构化建议；没有自动生成研究结果。',
                },
                'awaiting_input',
              ),
            );
          });
        }
        if (
          row.data.model_provider !== process.env.MODEL_PROVIDER ||
          row.data.model_id !== (process.env.MODEL_ID || null)
        ) {
          throw new BusinessError(
            'MODEL_MANIFEST_MISMATCH',
            '当前模型配置与任务固定清单不同；请显式重算或恢复原模型配置',
            422,
          );
        }
        const activity = ActivityContext.current();
        activity.heartbeat({ stage: 'model-request', task_id: binding.taskId });
        const timer = setInterval(
          () => activity.heartbeat({ stage: 'model-request', task_id: binding.taskId }),
          5000,
        );
        try {
          // No transaction is held while contacting a model. Cancellation closes the PG commit gate.
          const result = await model.generate(String(row.data.type), object(row.data, 'input'));
          activity.cancellationSignal.throwIfAborted();
          return await transaction(pool, async (db) => {
            const current = await db.get('operations', binding.taskId, true);
            if (!eligible(current, binding) || current.data.proposal) return stateOf(current);
            if (!result.output || typeof result.output !== 'object' || Array.isArray(result.output)) {
              throw new BusinessError('MODEL_INVALID_OUTPUT', '模型建议必须是结构化对象', 502);
            }
            return stateOf(
              await change(
                db,
                current,
                {
                  proposal: result.output,
                  stage: 'business-review-required',
                  progress: 70,
                  proposal_hash: digest(result.output),
                  proposal_generated_at: new Date().toISOString(),
                  model_result: {
                    provider: result.provider,
                    model: result.model,
                    usage: result.usage,
                    request_id: result.request_id,
                    input_hash: digest(object(current.data, 'input')),
                  },
                },
                'awaiting_review',
              ),
            );
          });
        } finally {
          clearInterval(timer);
        }
      } catch (error) {
        return activityFailure(error);
      }
    },

    async readTask(binding: TaskBinding): Promise<TaskState> {
      return transaction(pool, async (db) => stateOf(await db.get('operations', binding.taskId)));
    },

    async acknowledgeCancellation(binding: TaskBinding): Promise<TaskState> {
      return transaction(pool, async (db) => {
        const row = await db.get('operations', binding.taskId, true);
        if (row.status === 'completed') return stateOf(row);
        if (row.status === 'cancelled')
          return stateOf(
            await change(
              db,
              row,
              { stage: 'cancelled', cancellation_acknowledged_at: new Date().toISOString() },
              'cancelled',
            ),
          );
        if (!eligible(row, binding)) return stateOf(row);
        return stateOf(
          await change(
            db,
            row,
            {
              commit_eligible: false,
              generation: binding.generation + 1,
              stage: 'cancelled',
              cancellation_reason: '执行平台收到取消请求',
              cancellation_acknowledged_at: new Date().toISOString(),
            },
            'cancelled',
          ),
        );
      });
    },

    async failTask(binding: TaskBinding, detail: ExecutionFailure): Promise<TaskState> {
      return transaction(pool, async (db) => {
        const row = await db.get('operations', binding.taskId, true);
        if (!eligible(row, binding)) return stateOf(row);
        const out = await change(
          db,
          row,
          {
            stage: 'failed',
            error: { ...detail },
            retryable: detail.retryable,
            failed_at: new Date().toISOString(),
          },
          'failed',
        );
        const key = `task-issue:${binding.workflowId}`;
        if (!(await db.findClaim(key))) {
          const issue = await db.create(
            'operations',
            'issue',
            {
              task_id: row.id,
              code: detail.code,
              message: detail.message,
              retryable: detail.retryable,
              workflow_id: binding.workflowId,
            },
            'open',
          );
          await db.claim(key, issue.id);
        }
        return stateOf(out);
      });
    },

    async acceptScheduleRun(run: ScheduleRun): Promise<TaskBinding | null> {
      return transaction(pool, async (db) => {
        const plan = await db.get('operations', run.scheduleId, true);
        if (plan.kind !== 'schedule' || plan.status !== 'enabled' || plan.version !== run.scheduleVersion)
          return null;
        const period = Number(plan.data.interval_minutes) * 60_000;
        const anchor = Date.parse(String(plan.data.next_at));
        const slot = Math.floor((Date.parse(run.scheduledAt) - anchor) / period);
        const key = `schedule-window:${plan.id}:${anchor + slot * period}`;
        const previous = await db.findClaim(key);
        if (previous) return null;
        const row = await db.create(
          'operations',
          'task',
          {
            type: 'schedule',
            input: {
              schedule_id: plan.id,
              schedule_version: plan.version,
              window: String(anchor + slot * period),
              type: plan.data.type!,
              input: plan.data.input!,
            },
            owner_id: plan.data.owner_id || 'schedule',
            generation: 1,
            commit_eligible: true,
            attempts: 0,
            stage: 'accepted',
            progress: 0,
            model_provider: 'manual',
            model_id: null,
            workflow_id: run.workflowId,
            scheduled_at: run.scheduledAt,
          },
          'queued',
        );
        await db.claim(key, row.id);
        await db.audit(serviceActor, 'schedule.triggered', 'operations', row.id, {
          schedule_id: plan.id,
          window: String(slot),
        });
        return { taskId: row.id, generation: 1, attempt: 0, workflowId: run.workflowId };
      });
    },
  };
}
