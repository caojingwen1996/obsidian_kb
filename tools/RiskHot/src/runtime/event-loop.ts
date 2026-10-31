import type {EventAdvance} from './event-workflows.js';
export const eventIterationLimit=200; // 50个Object各3次预算，加上后续步骤及收尾。
export async function runEventLoop(io:{advance(callKey:string):Promise<EventAdvance>;consume(attemptId:string):Promise<EventAdvance>;fail():Promise<void>},invoke:(id:string,remaining:number)=>Promise<void>,pause:(milliseconds:number)=>Promise<void>,now=Date.now){
 try{
  for(let step=0;step<eventIterationLimit;step++){
   const next=await io.advance(`iteration/${step}`);if(next.stop)return;if(!next.attempt)continue;
   const remaining=next.attempt.deadline_ms-now();if(remaining<=0){await io.fail();return;}
   await invoke(next.attempt.id,remaining);const outcome=await io.consume(next.attempt.id);if(outcome.stop)return;if(outcome.retry)await pause(next.attempt.window_used===1?30000:120000);
  }
 }catch{await io.fail();return;}
 await io.fail();
}
