import {proxyActivities,sleep} from '@temporalio/workflow';
export interface EventAdvance {attempt?:{id:string;deadline_ms:number;window_used:number};stop?:boolean;retry?:boolean}
const io=proxyActivities<{advanceEvent(id:string,generation:number,extract:boolean):Promise<EventAdvance>;consumeEvent(id:string,generation:number,extract:boolean,attemptId:string):Promise<EventAdvance>}>({taskQueue:'riskhot-l0-io',startToCloseTimeout:'60 seconds',retry:{maximumAttempts:5,initialInterval:'2 seconds',maximumInterval:'30 seconds'}});
async function run(id:string,generation:number,extract:boolean){for(let step=0;step<20;step++){
 const next=await io.advanceEvent(id,generation,extract);if(next.stop)return;
 if(!next.attempt)continue;
 const remaining=next.attempt.deadline_ms-Date.now();if(remaining<=0)return;
 const model=proxyActivities<{invoke(attemptId:string):Promise<void>}>({taskQueue:'riskhot-l0-model',scheduleToCloseTimeout:remaining,startToCloseTimeout:Math.min(180000,remaining),heartbeatTimeout:45000,retry:{maximumAttempts:1}});
 await model.invoke(next.attempt.id);const outcome=await io.consumeEvent(id,generation,extract,next.attempt.id);if(outcome.stop)return;if(outcome.retry)await sleep(next.attempt.window_used===1?'30 seconds':'120 seconds');
}}
export async function FullEventExtractionWorkflow(id:string,generation:number){await run(id,generation,true);}
export async function EventCandidateWorkflow(id:string,generation:number){await run(id,generation,false);}
