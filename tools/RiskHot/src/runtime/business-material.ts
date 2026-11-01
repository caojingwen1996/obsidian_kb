import type {Repository} from '../information-ingestion/processing/repository.js';
import {decodeModelResponse,type TransportResponse} from '../information-ingestion/processing/model.js';
import {DomainError} from '../platform/types.js';
import {currentExtractionActivities} from './current-extraction.js';
import {invokeReservedBusinessModel} from './business-model.js';
import {withBusinessModelPermit,type BusinessResult} from './business-worker.js';

/** One explicitly dispatched attempt. Recovery never loops or resets the shared model window. */
export async function advanceBusinessMaterialExtraction(repo:Repository,id:string,generation:number):Promise<BusinessResult>{
 return withBusinessModelPermit(async()=>{
  const activities=currentExtractionActivities(repo);
  const before=(await repo.db.query('SELECT extraction_result FROM infomation.ingestion_material WHERE id=$1',[id])).rows[0]?.extraction_result;
  if(before?.candidate_count!==undefined)return {state:'succeeded',result_ref:before};
  if(before?.status==='review')return {state:'waiting',result_ref:before};
  const attempts=(await repo.db.query("SELECT id,call_key,status,started_at,response_artifact_id FROM platform.model_attempts WHERE owner_kind='material' AND owner_id=$1 AND generation=$2 AND task_id='AI-01' ORDER BY attempt_no DESC",[id,generation])).rows;
  let attemptId:string|undefined;
  let reuse=false;
  for(const attempt of attempts){
   if(!attempt.response_artifact_id||!['response_received','accepted'].includes(attempt.status))continue;
   try{if(decodeModelResponse(await repo.json<TransportResponse>(attempt.response_artifact_id)).complete){attemptId=attempt.id;reuse=true;break;}}catch{/* Failed transport is retained for audit, never treated as a successful response. */}
  }
  if(!attemptId){
   const prepared=attempts.find(a=>a.status==='prepared'&&!a.started_at);
   if(prepared)attemptId=prepared.id;
   else{
    const index=attempts.reduce((max,a)=>Math.max(max,Number(/^workflow-(\d+)$/.exec(a.call_key??'')?.[1]??-1)),-1)+1;
    const next=await activities.prepareCurrentExtraction(id,generation,index);attemptId=next.attempt?.id;
   }
  }
  if(attemptId){
   if(!reuse){try{await invokeReservedBusinessModel(repo,attemptId,{permitHeld:true});}catch(error){if(!(error instanceof DomainError))throw error;}}
   // Even a failed/unknown invocation must publish the durable recovery reason instead of remaining pending.
   await activities.consumeCurrentExtraction(id,generation,attemptId);
  }
  const result=(await repo.db.query('SELECT extraction_result FROM infomation.ingestion_material WHERE id=$1',[id])).rows[0]?.extraction_result??{status:'recoverable',error_code:'MODEL_RESULT_UNAVAILABLE'};
  return {state:result.candidate_count!==undefined?'succeeded':result.status==='review'?'waiting':'recoverable',result_ref:result};
 });
}
