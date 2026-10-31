import {runEventLoop} from './event-loop.js';
import {proxyActivities,sleep} from '@temporalio/workflow';
export interface EventAdvance {attempt?:{id:string;deadline_ms:number;window_used:number};stop?:boolean;retry?:boolean}
const io=proxyActivities<{advanceEvent(id:string,generation:number,extract:boolean,callKey?:string):Promise<EventAdvance>;failEvent(id:string,generation:number,extract:boolean):Promise<void>;consumeEvent(id:string,generation:number,extract:boolean,attemptId:string):Promise<EventAdvance>}>({taskQueue:'riskhot-l0-io',startToCloseTimeout:'60 seconds',retry:{maximumAttempts:5,initialInterval:'2 seconds',maximumInterval:'30 seconds'}});
async function run(id:string,generation:number,extract:boolean){
 await runEventLoop({advance:key=>io.advanceEvent(id,generation,extract,key),consume:attempt=>io.consumeEvent(id,generation,extract,attempt),fail:()=>io.failEvent(id,generation,extract)},async(attemptId,remaining)=>{
  const model=proxyActivities<{invoke(attemptId:string):Promise<void>}>({taskQueue:'riskhot-l0-model',scheduleToCloseTimeout:remaining,startToCloseTimeout:Math.min(180000,remaining),heartbeatTimeout:45000,retry:{maximumAttempts:1}});
  await model.invoke(attemptId);
 },milliseconds=>sleep(milliseconds));
}
export async function FullEventExtractionWorkflow(id:string,generation:number){await run(id,generation,true);}
export async function EventCandidateWorkflow(id:string,generation:number){await run(id,generation,false);}
