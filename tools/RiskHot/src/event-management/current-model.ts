import {Tiktoken} from 'js-tiktoken/lite';
import o200kBase from 'js-tiktoken/ranks/o200k_base';
import {modelInputEnvelope} from '../information-ingestion/processing/model.js';
import {loadEightStepTask} from './eight-step-packages.js';
import {isDeepStrictEqual} from 'node:util';
import type {Repository} from '../information-ingestion/processing/repository.js';
import type {TaskInput} from '../information-ingestion/processing/model.js';
import type {MaterialBasis,CurrentMaterial} from '../information-ingestion/processing/current-repository.js';
import {IngestionRepository} from '../information-ingestion/processing/current-repository.js';
import {transaction} from '../platform/db.js';
import {DomainError} from '../platform/types.js';
import {digest} from './contracts.js';
export interface CurrentModelReference {schema_version:'riskhot.model-reference.v1'|'riskhot.model-reference.v2';material_refs?:MaterialBasis[];actor?:string;permission?:string;rebuild_contexts?:boolean;material_ref:MaterialBasis;manifest:TaskInput['manifest'];context?:unknown}
export const isCurrentReference=(value:unknown):value is CurrentModelReference=>Boolean(value&&typeof value==='object'&&['riskhot.model-reference.v1','riskhot.model-reference.v2'].includes((value as {schema_version:string}).schema_version));
let inputEncoder:Tiktoken|undefined;
/** Policy accounting only; this encoding is not a claim about a supplier's billing tokenizer. */
export function measureCurrentModelInput(input:TaskInput):{encoding:'o200k_base';tokens:number;bytes:number}{
 const serialized=JSON.stringify({input:modelInputEnvelope(input),prompt:input.manifest.prompt,output_schema:input.manifest.output_schema??{}});
 const bytes=Buffer.byteLength(serialized);if(bytes>96000)throw new DomainError('INPUT_BYTE_BUDGET_EXCEEDED',422);
 inputEncoder??=new Tiktoken(o200kBase);
 const tokens=inputEncoder.encode(serialized,[],[]).length;if(tokens>24000)throw new DomainError('INPUT_TOKEN_BUDGET_EXCEEDED',422);
 return {encoding:'o200k_base',tokens,bytes};
}
function compactCurrentInput(input:TaskInput):TaskInput{
 const p=input.manifest.task_package as {task_id?:string;version?:string;digest?:string}|undefined;
 if(p?.version!=='f02-eight-step-v1')return input;
 return {...input,manifest:{...input.manifest,task_package:{task_id:p.task_id,version:p.version,digest:p.digest}}};
}
export function currentInputDigest(input:TaskInput):string{
 input=compactCurrentInput(input);
 if(!input.material_ref)return digest(input);
 const {normalizerVersion,...material}=input.material;
 return digest({material_ref:input.material_ref,...(input.material_refs?{material_refs:[...input.material_refs].sort((a,b)=>a.material_id.localeCompare(b.material_id))}:{}),material,manifest:input.manifest,context:input.context});
}
export async function readCurrentInput(repo:Repository,reference:CurrentModelReference,attemptId?:string):Promise<TaskInput>{
 if(reference.schema_version==='riskhot.model-reference.v2')return readMultiCurrentInput(repo,reference,attemptId);
 let content:CurrentMaterial['content'];
 if(attemptId)content=(await repo.db.query('SELECT platform.current_model_material($1) AS content',[attemptId])).rows[0]?.content;
 else {const row=(await repo.db.query<CurrentMaterial>('SELECT * FROM infomation.ingestion_material WHERE id=$1',[reference.material_ref.material_id])).rows[0];if(!row||row.version!==reference.material_ref.version||row.content_digest!==reference.material_ref.content_digest)throw new DomainError('MATERIAL_BASIS_CHANGED',409);content=row.content;}
 if(!content)throw new DomainError('MODEL_CALL_NOT_PERMITTED',409);
 return {version_id:reference.material_ref.material_id,material_ref:reference.material_ref,material:content,manifest:reference.manifest,...(reference.context===undefined?{}:{context:reference.context})};
}
export function isPostCommitAssociation(input:TaskInput):boolean{
 if(input.manifest.task_id!=='AI-04')return false;
 const p=input.manifest.task_package as {version?:string;digest?:string}|undefined;
 if(p?.version!=='f02-eight-step-v1')return false;
 const current=loadEightStepTask('AI-04');
 return p.digest===current.digest && input.manifest.prompt===current.prompt && isDeepStrictEqual(input.manifest.output_schema,current.schema);
}
export async function assertModelCandidate(tx:import('pg').PoolClient,id:string,generation:number,input:TaskInput):Promise<void>{
 const c=(await tx.query('SELECT * FROM information.event_candidates WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(!c||Number(c.execution_generation)!==generation||['dismissed','review'].includes(c.status))throw new DomainError('STALE_EXECUTION',409);
 if(c.status==='completed' && (!isPostCommitAssociation(input)||!(await tx.query('SELECT 1 FROM information.candidate_fact cf JOIN information.fact f ON f.id=cf.fact_id JOIN information.event e ON e.id=f.event_id WHERE cf.candidate_id=$1',[id])).rowCount))throw new DomainError('STALE_EXECUTION',409);
}
export async function reserveCurrentModel(repo:Repository,actor:string,basis:MaterialBasis,ownerKind:'material'|'event',ownerId:string,generation:number,input:TaskInput,callKey?:string){
 input=compactCurrentInput(input);
 const objectRef=input.manifest.task_id==='AI-07'?(input.context as {object_ref:string}).object_ref:'';
 if(input.manifest.task_id==='AI-07'&&!objectRef)throw new DomainError('TARGET_OBJECT_REQUIRED',422);
 if(objectRef&&callKey)callKey=JSON.stringify([objectRef,callKey]);
 basis={material_id:basis.material_id,version:basis.version,content_digest:basis.content_digest};
 if(!input.manifest.task_id)throw new DomainError('TASK_INPUT_MISMATCH',409);
 if((input.manifest.task_package as {version?:string}|undefined)?.version==='f02-eight-step-v1')measureCurrentModelInput(input);
 else if(Buffer.byteLength(JSON.stringify(input))+Buffer.byteLength(JSON.stringify(input.manifest.output_schema??{}))>24000)throw new DomainError('INPUT_BUDGET_EXCEEDED',422);
 const materialRefs=input.material_refs;
 if(materialRefs&&(!materialRefs.length||new Set(materialRefs.map(m=>m.material_id)).size!==materialRefs.length||!materialRefs.some(m=>digest(m)===digest(basis))))throw new DomainError('INPUT_REFERENCE_INVALID',422);
 const subjectRef={...(materialRefs?{...basis,material_refs:materialRefs}:basis),...(isPostCommitAssociation(input)?{post_commit_package:{task_id:'AI-04',version:'f02-eight-step-v1',digest:(input.manifest.task_package as {digest:string}).digest}}:{})};
 const rebuildContexts=Boolean(materialRefs&&input.context&&typeof input.context==='object'&&Object.hasOwn(input.context,'contexts'));
 const context=rebuildContexts?{...input.context as Record<string,unknown>,contexts:undefined}:input.context;
 const reference:CurrentModelReference={schema_version:materialRefs?'riskhot.model-reference.v2':'riskhot.model-reference.v1',...(materialRefs?{material_refs:materialRefs,actor,rebuild_contexts:rebuildContexts,permission:ownerKind==='event'?'event_submit':'submit'}:{}),material_ref:basis,manifest:input.manifest,...(context===undefined?{}:{context})};
 const request=await repo.putJson(reference,'model-request-reference');
 return transaction(repo.db,async tx=>{
  for(const ref of materialRefs??[basis])await new IngestionRepository(repo).assertBasis(tx,actor,ref,ownerKind==='event'?'event_submit':'submit');
  if(ownerKind==='event')await assertModelCandidate(tx,ownerId,generation,input);
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`model-budget:${ownerKind}:${ownerId}:${input.manifest.task_id}`]);
  const prior=callKey?(await tx.query('SELECT a.id,w.deadline,w.used FROM platform.model_attempts a JOIN platform.model_budget_windows w ON w.id=a.window_id WHERE a.owner_kind=$1 AND a.owner_id=$2 AND a.task_id=$3 AND a.generation=$4 AND a.call_key=$5 AND a.subject_ref=$6::jsonb AND a.object_ref=$7',[ownerKind,ownerId,input.manifest.task_id,generation,callKey,subjectRef,objectRef])).rows[0]:null;
  if(prior)return {id:prior.id,deadline_ms:new Date(prior.deadline).getTime(),window_used:prior.used};
  let window=(await tx.query('SELECT * FROM platform.model_budget_windows WHERE owner_kind=$1 AND owner_id=$2 AND task_id=$3 AND subject_ref=$4::jsonb AND object_ref=$5 ORDER BY generation DESC LIMIT 1 FOR UPDATE',[ownerKind,ownerId,input.manifest.task_id,subjectRef,objectRef])).rows[0];
  if(!window)window=(await tx.query("INSERT INTO platform.model_budget_windows(owner_kind,owner_id,task_id,generation,actor,reason,subject_ref,object_ref) SELECT $1,$2,$3,COALESCE(MAX(generation),0)+1,$4,'node initial budget',$5,$6 FROM platform.model_budget_windows WHERE owner_kind=$1 AND owner_id=$2 AND task_id=$3 RETURNING *",[ownerKind,ownerId,input.manifest.task_id,actor,subjectRef,objectRef])).rows[0];
  if(window.used>=3||new Date(window.deadline).getTime()<=Date.now())throw new DomainError('MODEL_BUDGET_EXHAUSTED',409);
  const attempt=(await tx.query('INSERT INTO platform.model_attempts(owner_kind,owner_id,task_id,window_id,generation,attempt_no,request_artifact_id,input_digest,call_key,subject_ref,provider_protocol,object_ref) SELECT $1,$2,$3,$4,$5,COALESCE(MAX(attempt_no),0)+1,$6,$7,$8,$9,$10,$11 FROM platform.model_attempts WHERE owner_kind=$1 AND owner_id=$2 AND task_id=$3 RETURNING id',[ownerKind,ownerId,input.manifest.task_id,window.id,generation,request,currentInputDigest(input),callKey??null,subjectRef,input.manifest.provider.protocol,objectRef])).rows[0];
  await tx.query('UPDATE platform.model_budget_windows SET used=used+1 WHERE id=$1',[window.id]);return {id:attempt.id,deadline_ms:new Date(window.deadline).getTime(),window_used:window.used+1};
 });
}

async function readMultiCurrentInput(repo:Repository,reference:CurrentModelReference,attemptId?:string):Promise<TaskInput>{
 const refs=reference.material_refs;
 if(!refs?.length||new Set(refs.map(m=>m.material_id)).size!==refs.length)throw new DomainError('INPUT_REFERENCE_INVALID',422);
 const materials=attemptId ? (await repo.db.query('SELECT platform.current_model_materials($1) AS materials',[attemptId])).rows[0]?.materials as {material_ref:MaterialBasis;content:CurrentMaterial['content']}[] : await transaction(repo.db,async tx=>{
  if(!reference.actor)throw new DomainError('MODEL_CALL_NOT_PERMITTED',409);
  const result=[];for(const basis of refs){const m=await new IngestionRepository(repo).assertBasis(tx,reference.actor,basis,reference.permission??'event_submit');result.push({material_ref:basis,content:m.content});}return result;
 });
 if(!materials||materials.length!==refs.length||refs.some(r=>!materials.some(m=>digest(m.material_ref)===digest(r))))throw new DomainError('MATERIAL_BASIS_CHANGED',409);
 const primary=materials.find(m=>digest(m.material_ref)===digest(reference.material_ref));if(!primary)throw new DomainError('INPUT_REFERENCE_INVALID',422);
 const context=reference.rebuild_contexts&&reference.context&&typeof reference.context==='object'?{...reference.context as object,contexts:materials.map(m=>({...m.material_ref,segments:m.content.segments.map(({id,text})=>({id,text}))})).sort((a,b)=>a.material_id.localeCompare(b.material_id))}:reference.context;
 return {version_id:reference.material_ref.material_id,material_ref:reference.material_ref,material_refs:refs,material:primary.content,manifest:reference.manifest,...(context===undefined?{}:{context})};
}
