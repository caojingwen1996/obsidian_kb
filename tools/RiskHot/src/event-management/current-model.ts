import type {Repository} from '../information-ingestion/processing/repository.js';
import type {TaskInput} from '../information-ingestion/processing/model.js';
import type {MaterialBasis,CurrentMaterial} from '../information-ingestion/processing/current-repository.js';
import {IngestionRepository} from '../information-ingestion/processing/current-repository.js';
import {transaction} from '../platform/db.js';
import {DomainError} from '../platform/types.js';
import {digest} from './contracts.js';
export interface CurrentModelReference {schema_version:'riskhot.model-reference.v1';material_ref:MaterialBasis;manifest:TaskInput['manifest'];context?:unknown}
export const isCurrentReference=(value:unknown):value is CurrentModelReference=>Boolean(value&&typeof value==='object'&&(value as {schema_version?:string}).schema_version==='riskhot.model-reference.v1');
export function currentInputDigest(input:TaskInput):string{
 if(!input.material_ref)return digest(input);
 const {normalizerVersion,...material}=input.material;
 return digest({material_ref:input.material_ref,material,manifest:input.manifest,context:input.context});
}
export async function readCurrentInput(repo:Repository,reference:CurrentModelReference,attemptId?:string):Promise<TaskInput>{
 let content:CurrentMaterial['content'];
 if(attemptId)content=(await repo.db.query('SELECT platform.current_model_material($1) AS content',[attemptId])).rows[0]?.content;
 else {const row=(await repo.db.query<CurrentMaterial>('SELECT * FROM infomation.ingestion_material WHERE id=$1',[reference.material_ref.material_id])).rows[0];if(!row||row.version!==reference.material_ref.version||row.content_digest!==reference.material_ref.content_digest)throw new DomainError('MATERIAL_BASIS_CHANGED',409);content=row.content;}
 if(!content)throw new DomainError('MODEL_CALL_NOT_PERMITTED',409);
 return {version_id:reference.material_ref.material_id,material_ref:reference.material_ref,material:content,manifest:reference.manifest,...(reference.context===undefined?{}:{context:reference.context})};
}
export async function reserveCurrentModel(repo:Repository,actor:string,basis:MaterialBasis,ownerKind:'material'|'event',ownerId:string,generation:number,input:TaskInput,callKey?:string){
 const objectRef=input.manifest.task_id==='AI-07'?(input.context as {object_ref:string}).object_ref:'';
 if(input.manifest.task_id==='AI-07'&&!objectRef)throw new DomainError('TARGET_OBJECT_REQUIRED',422);
 if(objectRef&&callKey)callKey=JSON.stringify([objectRef,callKey]);
 basis={material_id:basis.material_id,version:basis.version,content_digest:basis.content_digest};
 if(!input.manifest.task_id)throw new DomainError('TASK_INPUT_MISMATCH',409);
 if(Buffer.byteLength(JSON.stringify(input))+Buffer.byteLength(JSON.stringify(input.manifest.output_schema??{}))>24000)throw new DomainError('INPUT_BUDGET_EXCEEDED',422);
 const reference:CurrentModelReference={schema_version:'riskhot.model-reference.v1',material_ref:basis,manifest:input.manifest,...(input.context===undefined?{}:{context:input.context})};
 const request=await repo.putJson(reference,'model-request-reference');
 return transaction(repo.db,async tx=>{
  await new IngestionRepository(repo).assertBasis(tx,actor,basis,ownerKind==='event'?'event_submit':'submit');
  if(ownerKind==='event'){const c=(await tx.query('SELECT * FROM information.event_candidates WHERE id=$1 FOR UPDATE',[ownerId])).rows[0];if(!c||Number(c.execution_generation)!==generation||['completed','dismissed','review'].includes(c.status))throw new DomainError('STALE_EXECUTION',409);}
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`model-budget:${ownerKind}:${ownerId}:${input.manifest.task_id}`]);
  const prior=callKey?(await tx.query('SELECT a.id,w.deadline,w.used FROM platform.model_attempts a JOIN platform.model_budget_windows w ON w.id=a.window_id WHERE a.owner_kind=$1 AND a.owner_id=$2 AND a.task_id=$3 AND a.generation=$4 AND a.call_key=$5 AND a.subject_ref=$6::jsonb AND a.object_ref=$7',[ownerKind,ownerId,input.manifest.task_id,generation,callKey,basis,objectRef])).rows[0]:null;
  if(prior)return {id:prior.id,deadline_ms:new Date(prior.deadline).getTime(),window_used:prior.used};
  let window=(await tx.query('SELECT * FROM platform.model_budget_windows WHERE owner_kind=$1 AND owner_id=$2 AND task_id=$3 AND subject_ref=$4::jsonb AND object_ref=$5 ORDER BY generation DESC LIMIT 1 FOR UPDATE',[ownerKind,ownerId,input.manifest.task_id,basis,objectRef])).rows[0];
  if(!window)window=(await tx.query("INSERT INTO platform.model_budget_windows(owner_kind,owner_id,task_id,generation,actor,reason,subject_ref,object_ref) SELECT $1,$2,$3,COALESCE(MAX(generation),0)+1,$4,'node initial budget',$5,$6 FROM platform.model_budget_windows WHERE owner_kind=$1 AND owner_id=$2 AND task_id=$3 RETURNING *",[ownerKind,ownerId,input.manifest.task_id,actor,basis,objectRef])).rows[0];
  if(window.used>=3||new Date(window.deadline).getTime()<=Date.now())throw new DomainError('MODEL_BUDGET_EXHAUSTED',409);
  const attempt=(await tx.query('INSERT INTO platform.model_attempts(owner_kind,owner_id,task_id,window_id,generation,attempt_no,request_artifact_id,input_digest,call_key,subject_ref,provider_protocol,object_ref) SELECT $1,$2,$3,$4,$5,COALESCE(MAX(attempt_no),0)+1,$6,$7,$8,$9,$10,$11 FROM platform.model_attempts WHERE owner_kind=$1 AND owner_id=$2 AND task_id=$3 RETURNING id',[ownerKind,ownerId,input.manifest.task_id,window.id,generation,request,currentInputDigest(input),callKey??null,basis,input.manifest.provider.protocol,objectRef])).rows[0];
  await tx.query('UPDATE platform.model_budget_windows SET used=used+1 WHERE id=$1',[window.id]);return {id:attempt.id,deadline_ms:new Date(window.deadline).getTime(),window_used:window.used+1};
 });
}
