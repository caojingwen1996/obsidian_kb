export interface TaskBinding {
  taskId: string;
  generation: number;
  attempt: number;
  workflowId: string;
}

export interface TaskState {
  status: string;
  stage: string;
}

export interface ScheduleRun {
  scheduleId: string;
  scheduleVersion: number;
  workflowId: string;
  scheduledAt: string;
}

export interface ExecutionFailure {
  code: string;
  message: string;
  retryable: boolean;
}

export const reviewSignalName = 'business-review-completed';
export const taskStateQueryName = 'task-state';
export const workflowNames = { task: 'researchTask', schedule: 'scheduleTick' } as const;

export function taskWorkflowId(taskId: string, attempt: number): string {
  return `riskhot-task/${taskId}/attempt/${attempt}`;
}

export function temporalScheduleId(scheduleId: string): string {
  return `riskhot-schedule/${scheduleId}`;
}
