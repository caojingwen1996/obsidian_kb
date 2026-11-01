import {DomainError} from '../platform/types.js';
export const eightStepManifest='f02-eight-step-v1';
export const nodeTasks={map_event:null,recognize_targets:'AI-08',resolve_event:'AI-02',resolve_target:'AI-07',establish_initial:null,extract_variables:'AI-05',assess_meaning:'AI-09',classify_usage:'AI-10',commit_event:null,associate_events:'AI-04'} as const;
export type NodeKey=keyof typeof nodeTasks;
export interface NodeResult {state:'succeeded'|'skipped'|'review'|'recoverable';result:unknown;reason?:string}
export interface EightStepContext {manifest_ref:string;generation:number;input_digest:string;event_id:string|null}
export interface EightStepPorts {
 context(candidateId:string):Promise<EightStepContext>;
 result(candidateId:string,node:NodeKey,generation:number):Promise<{state:string;input_digest:string;result:unknown}|null>;
 execute(candidateId:string,node:NodeKey,generation:number):Promise<NodeResult>;
 save(candidateId:string,node:NodeKey,generation:number,inputDigest:string,result:NodeResult):Promise<void>;
}
export interface AdvanceResult {state:'completed'|'waiting'|'recoverable';node_key:NodeKey;reason:string|null}
export async function advanceEightStep(id:string,generation:number,ports:EightStepPorts,branch:'core'|'association'='core'):Promise<AdvanceResult>{
 const context=await ports.context(id);
 if(context.manifest_ref!==eightStepManifest)throw new DomainError('TASK_PACKAGE_SEMANTICS_MISMATCH',409);
 if(context.generation!==generation)throw new DomainError('STALE_EXECUTION',409);
 const nodes:NodeKey[]=branch==='association'?['associate_events']:['map_event','recognize_targets','resolve_event','resolve_target','establish_initial','extract_variables','assess_meaning','classify_usage','commit_event'];
 if(branch==='association'&&!context.event_id)throw new DomainError('FORMAL_EVENT_REQUIRED',409);
 for(const node of nodes){
  const current=await ports.context(id);if(current.generation!==generation||current.input_digest!==context.input_digest)throw new DomainError('STALE_EXECUTION',409);
  let saved=await ports.result(id,node,generation);
  if(saved&&saved.input_digest===context.input_digest&&['succeeded','skipped'].includes(saved.state)){
   if(node==='resolve_event'&&(saved.result as {decision?:string})?.decision!=='NEW')return {state:'waiting',node_key:node,reason:'REUSE_IMPLEMENTATION_PENDING'};
   continue;
  }
  const result=await ports.execute(id,node,generation);
  if(result.state==='skipped'&&!result.reason?.trim())throw new DomainError('SKIP_REASON_REQUIRED',422);
  await ports.save(id,node,generation,context.input_digest,result);
  if(result.state==='review'||result.state==='recoverable')return {state:result.state==='review'?'waiting':'recoverable',node_key:node,reason:result.reason??null};
  if(node==='resolve_event'&&(result.result as {decision?:string})?.decision!=='NEW')return {state:'waiting',node_key:node,reason:'REUSE_IMPLEMENTATION_PENDING'};
 }
 return {state:'completed',node_key:nodes[nodes.length-1]!,reason:null};
}
