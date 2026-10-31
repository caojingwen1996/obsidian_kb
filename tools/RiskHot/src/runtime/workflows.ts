import { proxyActivities, sleep, ApplicationFailure } from '@temporalio/workflow';
import type { IOActivities, ModelActivities } from './activities.js';

const io = proxyActivities<IOActivities>({ taskQueue: 'riskhot-l0-io', startToCloseTimeout: '60 seconds', retry: { maximumAttempts: 5, initialInterval: '2 seconds', maximumInterval: '30 seconds' } });

export async function SourceFetchWorkflow(id: string, generation: number): Promise<void> { await io.discover(id, generation); }
export async function MaterialIngestionWorkflow(id: string, generation: number): Promise<void> {
  await io.acquire(id, generation); await io.normalize(id, generation); await io.save(id, generation);
}
export async function EventExtractionWorkflow(id: string, generation: number): Promise<void> {
  if (!await io.prepareExtraction(id, generation)) return;
  try {
    for (let index = 1; index <= 3; index++) {
      const attempt = await io.reserve(id, generation, index);
      const remaining = attempt.deadline_ms - Date.now();
      if (remaining <= 0) { await io.failedExtraction(id, generation, 'MODEL_BUDGET_EXHAUSTED'); return; }
      const model = proxyActivities<ModelActivities>({ taskQueue: 'riskhot-l0-model', scheduleToCloseTimeout: remaining, startToCloseTimeout: Math.min(180_000, remaining), heartbeatTimeout: Math.min(45_000, remaining), retry: { maximumAttempts: 1 } });
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
export {FullEventExtractionWorkflow,EventCandidateWorkflow} from './event-workflows.js';

export async function IngestionWorkflow(id: string, revision: number): Promise<void> {
  const current = proxyActivities<import('./current-activities.js').CurrentIngestionActivities>({ taskQueue: 'riskhot-l0-io', startToCloseTimeout: '15 minutes', heartbeatTimeout: '45 seconds', retry: { maximumAttempts: 3, initialInterval: '5 seconds', maximumInterval: '30 seconds' } });
  await current.ingestCurrent(id, revision);
}

export async function MaterialExtractionWorkflow(id:string,generation:number):Promise<void>{
 const current=proxyActivities<import('./current-extraction.js').CurrentExtractionActivities>({taskQueue:'riskhot-l0-io',startToCloseTimeout:'60 seconds',retry:{maximumAttempts:3,initialInterval:'2 seconds',maximumInterval:'30 seconds'}});
 for(let index=1;index<=3;index++){
  const prepared=await current.prepareCurrentExtraction(id,generation,index);if(!('attempt' in prepared)||!prepared.attempt)return;
  const remaining=prepared.attempt.deadline_ms-Date.now();if(remaining<=0)return;
  const model=proxyActivities<ModelActivities>({taskQueue:'riskhot-l0-model',scheduleToCloseTimeout:remaining,startToCloseTimeout:Math.min(180000,remaining),heartbeatTimeout:Math.min(45000,remaining),retry:{maximumAttempts:1}});
  await model.invoke(prepared.attempt.id);
  const result=await current.consumeCurrentExtraction(id,generation,prepared.attempt.id);if(result.stop)return;
  await sleep(index===1?'30 seconds':'120 seconds');
 }
}
