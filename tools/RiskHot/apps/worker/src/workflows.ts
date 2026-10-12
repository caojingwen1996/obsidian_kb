import {
  ApplicationFailure,
  CancellationScope,
  condition,
  defineQuery,
  defineSignal,
  isCancellation,
  proxyActivities,
  setHandler,
  workflowInfo,
} from '@temporalio/workflow';
import type { createActivities } from './activities.js';
import {
  reviewSignalName,
  taskStateQueryName,
  type ExecutionFailure,
  type ScheduleRun,
  type TaskBinding,
  type TaskState,
} from '../../../packages/platform/workflow/contracts.js';

const activities = proxyActivities<ReturnType<typeof createActivities>>({
  startToCloseTimeout: '4 minutes',
  scheduleToCloseTimeout: '12 minutes',
  heartbeatTimeout: '30 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '30 seconds',
    backoffCoefficient: 4,
    maximumInterval: '2 minutes',
  },
});
const reviewed = defineSignal<[string]>(reviewSignalName);
const stateQuery = defineQuery<TaskState>(taskStateQueryName);

function failureDetails(error: unknown): ExecutionFailure {
  const outer = error as { cause?: unknown; message?: string };
  const cause = (outer?.cause || error) as { type?: string; nonRetryable?: boolean; message?: string };
  return {
    code: cause?.type || 'EXECUTION_FAILED',
    message: cause?.message || outer?.message || '执行失败，需检查任务记录',
    retryable: cause?.nonRetryable !== true,
  };
}

async function executeTask(binding: TaskBinding): Promise<TaskState> {
  let state: TaskState = { status: 'queued', stage: 'accepted' };
  let wakeRevision = 0;
  setHandler(reviewed, () => {
    wakeRevision += 1;
  });
  setHandler(stateQuery, () => state);
  try {
    state = await activities.prepareTask(binding);
    if (['completed', 'cancelled', 'failed'].includes(state.status)) return state;
    state = await activities.propose(binding);
    while (['awaiting_input', 'awaiting_review'].includes(state.status)) {
      const observed = wakeRevision;
      state = await activities.readTask(binding);
      if (!['awaiting_input', 'awaiting_review'].includes(state.status)) break;
      // A durable timer also reconciles a lost notification without rerunning the model.
      await condition(() => wakeRevision !== observed, '1 day');
    }
    return state;
  } catch (error) {
    if (isCancellation(error)) {
      return CancellationScope.nonCancellable(() => activities.acknowledgeCancellation(binding));
    }
    const detail = failureDetails(error);
    await activities.failTask(binding, detail);
    throw ApplicationFailure.create({ ...detail, type: detail.code, nonRetryable: true });
  }
}

export async function researchTask(binding: TaskBinding): Promise<TaskState> {
  return executeTask(binding);
}

export async function scheduleTick(
  input: Pick<ScheduleRun, 'scheduleId' | 'scheduleVersion'>,
): Promise<TaskState> {
  const info = workflowInfo();
  const scheduledAt = info.searchAttributes.TemporalScheduledStartTime?.[0];
  const binding = await activities.acceptScheduleRun({
    ...input,
    workflowId: info.workflowId,
    scheduledAt: scheduledAt instanceof Date ? scheduledAt.toISOString() : new Date().toISOString(),
  });
  if (!binding) return { status: 'skipped', stage: 'schedule-disabled-or-stale' };
  return executeTask(binding);
}
