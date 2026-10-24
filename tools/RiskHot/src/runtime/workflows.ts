import { proxyActivities, sleep, ApplicationFailure } from '@temporalio/workflow';
import type { IOActivities, ModelActivities } from './activities.js';

const io = proxyActivities<IOActivities>({ taskQueue: 'riskhot-l0-io', startToCloseTimeout: '60 seconds', retry: { maximumAttempts: 5, initialInterval: '2 seconds', maximumInterval: '30 seconds' } });
const model = proxyActivities<ModelActivities>({ taskQueue: 'riskhot-l0-model', startToCloseTimeout: '180 seconds', heartbeatTimeout: '45 seconds', retry: { maximumAttempts: 1 } });

export async function SourceFetchWorkflow(id: string, generation: number): Promise<void> { await io.discover(id, generation); }
export async function MaterialIngestionWorkflow(id: string, generation: number): Promise<void> {
  await io.acquire(id, generation); await io.normalize(id, generation); await io.save(id, generation);
}
export async function EventExtractionWorkflow(id: string, generation: number): Promise<void> {
  if (!await io.prepareExtraction(id, generation)) return;
  try {
    for (let index = 1; index <= 3; index++) {
      const attempt = await io.reserve(id, generation, index);
      await model.invoke(attempt.id);
      const result = await io.consume(id, generation, attempt.id);
      if (result.accepted || !result.retryable || attempt.window_used >= 3) return;
      await sleep(attempt.window_used === 1 ? '30 seconds' : '120 seconds');
    }
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    const code = cause instanceof ApplicationFailure ? cause.type ?? 'EXTRACTION_EXECUTION_FAILED' : 'EXTRACTION_EXECUTION_FAILED';
    await io.failedExtraction(id, generation, code);
  }
}
