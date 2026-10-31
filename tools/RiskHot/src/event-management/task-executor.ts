import {currentModel} from './store.js';
import {reserveCurrentModel} from './current-model.js';
import {IngestionRepository} from '../information-ingestion/processing/current-repository.js';
import {transaction} from '../platform/db.js';import {DomainError} from '../platform/types.js';import type {Repository} from '../information-ingestion/processing/repository.js';import {permission,processing,candidate,guard,candidateGuard} from './store.js';import {digest,type TaskId} from './contracts.js';import type {TaskInput} from '../information-ingestion/processing/model.js';
export class EventExecutor {
 constructor(public repo:Repository){}
 async reserve(processingId:string,candidateId:string|null,generation:number,taskId:TaskId,input:TaskInput,callKey?:string){
  if(await currentModel(this.repo.db)){
   if(!candidateId)throw new DomainError('MATERIAL_EXTRACTION_USES_CURRENT_WORKFLOW',409);
   const c=await candidate(this.repo.db,candidateId),p=await processing(this.repo.db,c.processing_id),m=await new IngestionRepository(this.repo).material(p.actor,p.id);
   const basis={material_id:m.id,version:m.version,content_digest:m.content_digest};input={...input,material_ref:basis};
   return reserveCurrentModel(this.repo,p.actor,basis,'event',candidateId,generation,input,callKey);
  }
  if(input.manifest.task_id!==taskId)throw new DomainError('TASK_INPUT_MISMATCH',409);
  // UTF-8 byte count is a conservative upper bound for supported byte-level tokenizer inputs.
  if(Buffer.byteLength(JSON.stringify(input))+Buffer.byteLength(JSON.stringify(input.manifest.output_schema??{}))>24000)throw new DomainError('INPUT_BUDGET_EXCEEDED',422);
  const request=await this.repo.putJson(input,'event-model-request');
  return transaction(this.repo.db,async tx=>{const pre=await processing(tx,processingId);await permission(this.repo,tx,pre.version_id,pre.actor,'event_submit',true);const p=await processing(tx,processingId,true);guard(p,candidateId?undefined:generation);
   if(candidateId){const c=await candidate(tx,candidateId,true);if(c.processing_id!==processingId)throw new DomainError('UNKNOWN_REFERENCE');await candidateGuard(tx,c,generation);}
   const owner=candidateId??processingId;
   const stableKey=callKey?`${owner}:${taskId}:${callKey}`:null;if(stableKey){const prior=(await tx.query('SELECT a.id,w.deadline,w.used FROM platform.model_attempts a JOIN platform.model_budget_windows w ON w.id=a.window_id WHERE a.processing_id=$1 AND a.generation=$2 AND a.call_key=$3',[processingId,generation,stableKey])).rows[0];if(prior)return {id:prior.id,deadline_ms:new Date(prior.deadline).getTime(),window_used:prior.used};}
   let w=(await tx.query("SELECT * FROM platform.model_budget_windows WHERE owner_kind='event' AND owner_id=$1 AND task_id=$2 ORDER BY generation DESC LIMIT 1 FOR UPDATE",[owner,taskId])).rows[0];
   if(!w)w=(await tx.query("INSERT INTO platform.model_budget_windows(processing_id,generation,actor,reason,owner_kind,owner_id,task_id) SELECT $1,COALESCE(MAX(generation),0)+1,$2,'event node initial budget','event',$3,$4 FROM platform.model_budget_windows WHERE processing_id=$1 RETURNING *",[processingId,p.actor,owner,taskId])).rows[0];
   if(w.used>=3||new Date(w.deadline).getTime()<=Date.now())throw new DomainError('MODEL_BUDGET_EXHAUSTED',409);
   const a=(await tx.query("INSERT INTO platform.model_attempts(processing_id,window_id,generation,attempt_no,request_artifact_id,owner_kind,owner_id,task_id,input_digest,call_key) SELECT $1,$2,$3,COALESCE(MAX(attempt_no),0)+1,$4,'event',$5,$6,$7,$8 FROM platform.model_attempts WHERE processing_id=$1 RETURNING id",[processingId,w.id,generation,request,owner,taskId,digest(input),stableKey])).rows[0];
   await tx.query('UPDATE platform.model_budget_windows SET used=used+1 WHERE id=$1',[w.id]);return {id:a.id,deadline_ms:new Date(w.deadline).getTime(),window_used:w.used+1};
  });
 }
}
