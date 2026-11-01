import {mkdtemp,copyFile,rm,mkdir,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import type {Repository} from '../information-ingestion/processing/repository.js';
import {IngestionRepository} from '../information-ingestion/processing/current-repository.js';
import {assertModelCandidate,currentInputDigest,reserveCurrentModel,readCurrentInput,type CurrentModelReference} from '../event-management/current-model.js';
import {decodeModelResponse,type TaskInput,type TransportResponse} from '../information-ingestion/processing/model.js';
import {transaction} from '../platform/db.js';import {DomainError} from '../platform/types.js';
import {runModelProcess,withBusinessModelPermit} from './business-worker.js';

export async function callBusinessModel(repo:Repository,candidateId:string,generation:number,input:TaskInput):Promise<unknown>{
 return withBusinessModelPermit(async()=>{
  if(!input.material_ref)throw new DomainError('INPUT_REFERENCE_INVALID',422);
  const basis=input.material_ref;const inputDigest=currentInputDigest(input);
  const validate=()=>transaction(repo.db,async tx=>{
   for(const ref of input.material_refs??[basis])await new IngestionRepository(repo).assertBasis(tx,c.actor,ref,'event_submit');
   await assertModelCandidate(tx,candidateId,generation,input);
  });
  const c=(await repo.db.query('SELECT * FROM information.event_candidates WHERE id=$1',[candidateId])).rows[0];if(!c)throw new DomainError('NOT_FOUND',404);
  await validate();
  const prior=(await repo.db.query(`SELECT response_artifact_id,request_artifact_id FROM platform.model_attempts WHERE owner_kind='event' AND owner_id=$1 AND generation=$2 AND task_id=$3 AND input_digest=$4 AND response_artifact_id IS NOT NULL AND status IN ('response_received','accepted') ORDER BY attempt_no DESC LIMIT 1`,[candidateId,generation,input.manifest.task_id,inputDigest])).rows[0];
  if(prior){
   const reference=await repo.json<CurrentModelReference>(prior.request_artifact_id);
   if(currentInputDigest(await readCurrentInput(repo,reference))!==inputDigest)throw new DomainError('INPUT_DIGEST_MISMATCH',409);
   const decoded=decodeModelResponse(await repo.json<TransportResponse>(prior.response_artifact_id));if(!decoded.complete)throw new DomainError('MODEL_INCOMPLETE',422);await validate();return decoded.data;
  }
  const attempt=await reserveCurrentModel(repo,c.actor,basis,'event',candidateId,generation,input);
  try{
   const transport=await invokeReservedBusinessModel(repo,attempt.id,{permitHeld:true});
   const response=decodeModelResponse(transport);if(!response.complete)throw new DomainError('MODEL_INCOMPLETE',422);
   await validate();return response.data;
  }catch(error){await recordModelFailure(repo,attempt.id,error);throw error;}

 });
}

async function recordModelFailure(repo:Repository,id:string,error:unknown):Promise<string>{
 const code=error instanceof DomainError?error.code:error instanceof Error&&error.message==='MODEL_PROCESS_TIMEOUT'?'MODEL_BUDGET_EXHAUSTED':'MODEL_PROCESS_FAILED';
 await repo.db.query("UPDATE platform.model_attempts SET status=CASE WHEN response_artifact_id IS NOT NULL AND $2 IN ('FORBIDDEN','STALE_EXECUTION','MATERIAL_BASIS_CHANGED') THEN status ELSE 'failed' END,error_code=$2,completed_at=now() WHERE id=$1",[id,code]);
 return code;
}
export async function invokeReservedBusinessModel(repo:Repository,attemptId:string,options:{permitHeld?:boolean}={}):Promise<TransportResponse>{
 if(!options.permitHeld)return withBusinessModelPermit(()=>invokeReservedBusinessModel(repo,attemptId,{permitHeld:true}));
 const attempt=(await repo.db.query('SELECT a.*,w.actor FROM platform.model_attempts a JOIN platform.model_budget_windows w ON w.id=a.window_id WHERE a.id=$1',[attemptId])).rows[0];
 if(!attempt)throw new DomainError('ATTEMPT_NOT_FOUND',404);
 if(attempt.response_artifact_id){
  const reference=await repo.json<CurrentModelReference>(attempt.request_artifact_id);
  for(const ref of reference.material_refs??[reference.material_ref])await transaction(repo.db,tx=>new IngestionRepository(repo).assertBasis(tx,attempt.actor,ref,attempt.owner_kind==='event'?'event_submit':'submit'));
  const cachedInput=await readCurrentInput(repo,reference);
  if(attempt.owner_kind==='event')await transaction(repo.db,tx=>assertModelCandidate(tx,attempt.owner_id,Number(attempt.generation),cachedInput));
  if(currentInputDigest(cachedInput)!==attempt.input_digest)throw new DomainError('INPUT_DIGEST_MISMATCH',409);
  return repo.json<TransportResponse>(attempt.response_artifact_id);
 }
  let authFolder:string|undefined;
  try{
   const permit=(await repo.db.query("SELECT * FROM platform.claim_business_model_call($1)",[attemptId])).rows[0];
   if(!permit?.allowed)throw new DomainError(permit?.reason_code??'MODEL_CALL_NOT_PERMITTED',409);

   const prepared=await readCurrentInput(repo,await repo.json<CurrentModelReference>(attempt.request_artifact_id),attemptId);
   if(currentInputDigest(prepared)!==attempt.input_digest)throw new DomainError('INPUT_DIGEST_MISMATCH',409);
   if(attempt.owner_kind==='event')await transaction(repo.db,tx=>assertModelCandidate(tx,attempt.owner_id,Number(attempt.generation),prepared));
   const deadlineMs=Math.min(new Date(permit.deadline).getTime(),Date.now()+120_000);
   let authentication:{home:string;codexHome:string;executable?:string}|undefined;
   if(prepared.manifest.provider.protocol==='codex-exec'){
    if(!process.env.BUSINESS_MODEL_CODEX_HOME)throw new DomainError('MODEL_AUTH_DIRECTORY_REQUIRED',503);
    authFolder=await mkdtemp(join(tmpdir(),'riskhot-model-auth-'));const codexHome=join(authFolder,'codex');await mkdir(codexHome,{mode:0o700});
    // Copy only auth into an ephemeral home; the configured source authentication directory is read only.
    await copyFile(join(process.env.BUSINESS_MODEL_CODEX_HOME,'auth.json'),join(codexHome,'auth.json'));await chmod(join(codexHome,'auth.json'),0o600);
    authentication={home:authFolder,codexHome,executable:process.env.CODEX_EXECUTABLE};
   }else if(!process.env.MODEL_API_KEY)throw new DomainError('MODEL_NOT_CONFIGURED',503);
   const result=await runModelProcess({args:['--import','tsx',fileURLToPath(new URL('./business-model-child.ts',import.meta.url))],input:{input:prepared,deadlineMs},credentials:prepared.manifest.provider.protocol!=='codex-exec'&&process.env.MODEL_API_KEY?{MODEL_API_KEY:process.env.MODEL_API_KEY}:{},authentication,timeoutMs:Math.max(1,deadlineMs-Date.now()),permitHeld:true}) as {response?:TransportResponse;error_code?:string};
   if(result.error_code||!result.response)throw new DomainError(result.error_code??'MODEL_PROCESS_FAILED',502);
   const artifact=await repo.putJson(result.response,'model-response');
   await repo.db.query("UPDATE platform.model_attempts SET status='response_received',response_artifact_id=$2,completed_at=now() WHERE id=$1 AND response_artifact_id IS NULL",[attemptId,artifact]);
   return result.response;
  }catch(error){
   const code=await recordModelFailure(repo,attemptId,error);
   throw error instanceof DomainError?error:new DomainError(code,502);
  }finally{if(authFolder)await rm(authFolder,{recursive:true,force:true});}
}
