import {DomainError} from '../platform/types.js';
import type {Repository} from '../information-ingestion/processing/repository.js';
import {IngestionRepository} from '../information-ingestion/processing/current-repository.js';
import {assertCurrentEvidence,type MaterialEvidence} from './current-contracts.js';
import {transaction} from '../platform/db.js';
import {candidate,processing,permission,candidateGuard,enqueue,type DB} from './store.js';
import {digest} from './contracts.js';
import {loadTaskPackage} from './task-packages.js';
import {modelConfig,type TaskInput} from '../information-ingestion/processing/model.js';
import {categoryVersion,targetRuleVersion,validateTargetObject,validateTargetInput,validateTargetOutput,type TargetInput,type TargetObject,type TargetDefinition} from './target-identity-contracts.js';
import type {DefinitionSnapshot} from './definitions.js';
export const targetPackage='f02-target-identity-v3';
export interface ObjectSet {objects:TargetObject[];explicit_no_objects:boolean;reason:string}
const stale=()=>new DomainError('TARGET_BASIS_CHANGED',409);
const asDefinition=(t:TargetDefinition)=>({category_version:categoryVersion,version:String(t.definition_version),name:t.target_name,status:t.is_active?'active':'disabled',...t});
async function catalog(db:DB){
 // 主表覆盖全局目标目录：任一旧定义或历史关系尚无主表身份时，不允许声明完整召回。
 if((await db.query(`SELECT 1 FROM (
 SELECT value->>'id' AS id FROM information.definition_sets CROSS JOIN LATERAL jsonb_array_elements(payload->'targets')
 UNION SELECT target_id::text FROM information.event_target
 ) legacy WHERE NOT EXISTS(SELECT 1 FROM information.target t WHERE t.id::text=legacy.id) LIMIT 1`)).rowCount)throw new DomainError('TARGET_LEGACY_MIGRATION_REQUIRED',409);
const rows=(await db.query<TargetDefinition>('SELECT id,target_name,aliases,categories,jurisdiction,scope_definition,is_active,definition_version FROM information.target ORDER BY id LIMIT 101')).rows;if(rows.length>100)throw new DomainError('TARGET_RETRIEVAL_INCOMPLETE',409);return rows;}
export class TargetIdentity {
 constructor(public repo:Repository){}
 private async resetDownstream(db:DB,id:string,generation:string){
  const rows=(await db.query("SELECT * FROM information.candidate_step_results WHERE candidate_id=$1 AND generation=$2 AND step_no>=3 AND state<>'superseded'",[id,generation])).rows;
  if(rows.length){await db.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES('target-identity','target-downstream-invalidated',$1,$2)",[id,{generation,steps:rows}]);await db.query("UPDATE information.candidate_step_results SET state='superseded',reason_code='TARGET_BASIS_CHANGED' WHERE candidate_id=$1 AND generation=$2 AND step_no>=3",[id,generation]);}
  await db.query("UPDATE information.event_candidates SET resume_step=3,commit_key=NULL,commit_artifact_id=NULL,commit_digest=NULL WHERE id=$1",[id]);
 }

 async setObjects(id:string,actor:string,body:ObjectSet,generation:number,key:string){
  if(!body||Object.keys(body).some(k=>!['objects','explicit_no_objects','reason'].includes(k))||!Array.isArray(body.objects)||body.objects.length>50||typeof body.explicit_no_objects!=='boolean'||typeof body.reason!=='string'||!body.reason.trim()||body.explicit_no_objects===Boolean(body.objects.length)||new Set(body.objects.map(o=>o.object_ref)).size!==body.objects.length)throw new DomainError('TARGET_OBJECT_SET_INVALID',422);
  body.objects.forEach(validateTargetObject);
  return this.repo.action(actor,'target-objects',key,{id,body,generation},async tx=>{const c=await candidate(tx,id);await permission(this.repo,tx,c.processing_id,actor,'event_review',true);},async tx=>{
   const c=await candidate(tx,id,true),p=await processing(tx,c.processing_id);await candidateGuard(tx,c);if(p.event_options.task_manifest_id!==targetPackage||Number(c.proposal_generation)!==generation||c.resume_step!==3)throw new DomainError('TARGET_OBJECTS_NOT_EDITABLE',409);
   if((await tx.query('SELECT 1 FROM information.candidate_step_results WHERE candidate_id=$1 AND generation=$2 AND step_no>=3',[id,generation])).rowCount)throw new DomainError('TARGET_DOWNSTREAM_ALREADY_PREPARED',409);
   const m=(await tx.query('SELECT * FROM infomation.ingestion_material WHERE id=$1 FOR SHARE',[p.id])).rows[0];for(const o of body.objects)for(const e of o.evidence_refs)assertCurrentEvidence(m,e as unknown as MaterialEvidence);
   await tx.query('INSERT INTO information.target_object_sets(candidate_id,generation,payload,input_digest,actor,reason) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(candidate_id,generation) DO UPDATE SET payload=EXCLUDED.payload,input_digest=EXCLUDED.input_digest,actor=EXCLUDED.actor,reason=EXCLUDED.reason',[id,generation,body,digest(body),actor,body.reason]);
   await tx.query("UPDATE information.event_candidates SET execution_generation=execution_generation+1,status='processing',reason_code=NULL WHERE id=$1",[id]);await enqueue(tx,'candidate',id,Number(c.execution_generation)+1);
   await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'target-object-evidence',$2,$3)",[actor,id,{generation,input_digest:digest(body),reason:body.reason}]);return {candidate_id:id,generation};
  });
 }
 private async input(id:string,o:TargetObject,db:DB=this.repo.db):Promise<TargetInput>{
  const c=await candidate(db,id),m=(await db.query('SELECT * FROM infomation.ingestion_material WHERE id=$1',[c.processing_id])).rows[0];
  for(const e of o.evidence_refs)assertCurrentEvidence(m,e as unknown as MaterialEvidence);
  const facts=(await db.query('SELECT fact_id FROM information.candidate_fact WHERE candidate_id=$1',[id])).rows;if(!facts.length)throw new DomainError('TARGET_FACT_REQUIRED',409);
  const candidates=await catalog(db),basis_catalog:TargetInput['basis_catalog']=o.evidence_refs.map((e,i)=>({basis_ref:`object:${o.object_ref}:${i}`,owner_ref:o.object_ref,kind:'object',version:`${m.id}:${m.version}:${m.content_digest}`,content:JSON.stringify(e)}));
  for(const t of candidates)basis_catalog.push({basis_ref:`target:${t.id}:${t.definition_version}`,owner_ref:t.id,kind:'target',version:String(t.definition_version),content:JSON.stringify(t)});
  const input:TargetInput={rule_version:targetRuleVersion,category_version:categoryVersion,object_ref:o.object_ref,object:o,fact_context:{fact_ids:facts.map(f=>f.fact_id),candidate:c.payload,material_id:m.id,material_version:m.version,material_digest:m.content_digest},retrieval:{complete:true,truncated:false,snapshot_ref:digest(candidates)},candidates,basis_catalog};validateTargetInput(input);return input;
 }
 async advance(id:string,execution:number):Promise<{input?:TaskInput;waiting?:boolean}>{
  const c=await candidate(this.repo.db,id),p=await processing(this.repo.db,c.processing_id);if(p.event_options.task_manifest_id!==targetPackage)return {};
  await candidateGuard(this.repo.db,c,execution);await permission(this.repo,this.repo.db,p.id,p.actor,'event_submit',true);
  const set=(await this.repo.db.query('SELECT * FROM information.target_object_sets WHERE candidate_id=$1 AND generation=$2',[id,c.proposal_generation])).rows[0];
  if(!set)throw new DomainError('TARGET_OBJECT_INPUT_REQUIRED',409);
  if(set.payload.explicit_no_objects)return {};
  let waiting=false;
  for(const o of (set.payload as ObjectSet).objects){
   const approved=(await this.repo.db.query("SELECT * FROM information.target_identity_runs WHERE candidate_id=$1 AND generation=$2 AND object_ref=$3 AND state='approved' ORDER BY created_at DESC LIMIT 1",[id,c.proposal_generation,o.object_ref])).rows[0];
   if(approved&&digest(approved.input.object)===digest(o)){try{await this.validateApproval(approved,this.repo.db);continue;}catch(error){if(!(error instanceof DomainError)||!['TARGET_BASIS_CHANGED','FORBIDDEN'].includes(error.code))throw error;await transaction(this.repo.db,async tx=>{const current=await candidate(tx,id,true);await candidateGuard(tx,current,execution);if(current.proposal_generation!==c.proposal_generation)throw new DomainError('STALE_PROPOSAL',409);await this.resetDownstream(tx,id,c.proposal_generation);await tx.query("UPDATE information.target_identity_runs SET state=$2 WHERE id=$1",[approved.id,error.code==='FORBIDDEN'?'review':'superseded']);});if(error.code==='FORBIDDEN'){waiting=true;continue;}}}
   const input=await this.input(id,o),hash=digest(input);let run=(await this.repo.db.query('SELECT * FROM information.target_identity_runs WHERE candidate_id=$1 AND generation=$2 AND object_ref=$3 AND input_digest=$4',[id,c.proposal_generation,o.object_ref,hash])).rows[0];
   if(run?.result){waiting=true;continue;}
   if(!run)run=(await this.repo.db.query('INSERT INTO information.target_identity_runs(candidate_id,generation,object_ref,input_digest,input,task_version) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(candidate_id,generation,object_ref,input_digest) DO UPDATE SET input_digest=EXCLUDED.input_digest RETURNING *',[id,c.proposal_generation,o.object_ref,hash,input,targetPackage])).rows[0];
   const m=await new IngestionRepository(this.repo).material(p.actor,p.id),task=loadTaskPackage('AI-07',targetPackage);
   return {input:{version_id:m.id,material_ref:{material_id:m.id,version:m.version,content_digest:m.content_digest},material:m.content,manifest:{provider:p.event_options.model_binding??modelConfig(),prompt:task.prompt,task_id:'AI-07',output_schema:task.schema,output_schema_digest:digest(task.schema),task_package:task},context:input}};
  }
  if(waiting)await this.repo.db.query("UPDATE information.event_candidates SET status='review',reason_code='TARGET_REVIEW_REQUIRED' WHERE id=$1 AND execution_generation=$2",[id,execution]);
  return {waiting};
 }
 async accept(id:string,execution:number,input:TargetInput,payload:unknown){
  const result=validateTargetOutput(input,payload);
  await transaction(this.repo.db,async tx=>{const c=await candidate(tx,id,true),p=await processing(tx,c.processing_id);await candidateGuard(tx,c,execution);await permission(this.repo,tx,p.id,p.actor,'event_submit',true);
   const set=(await tx.query('SELECT payload FROM information.target_object_sets WHERE candidate_id=$1 AND generation=$2',[id,c.proposal_generation])).rows[0]?.payload as ObjectSet|undefined;
   if(!set?.objects.some(o=>digest(o)===digest(input.object))||digest(await this.input(id,input.object,tx))!==digest(input))throw stale();
   const r=await tx.query("UPDATE information.target_identity_runs SET result=$5,state='review' WHERE candidate_id=$1 AND generation=$2 AND object_ref=$3 AND input_digest=$4 AND state='pending' RETURNING id",[id,c.proposal_generation,input.object_ref,digest(input),result]);
   if(!r.rowCount&&! (await tx.query('SELECT 1 FROM information.target_identity_runs WHERE candidate_id=$1 AND generation=$2 AND input_digest=$3 AND result=$4::jsonb',[id,c.proposal_generation,digest(input),result])).rowCount)throw stale();
  });
 }
 async approve(id:string,actor:string,runId:string,approvalDigest:string,reason:string,key:string){
  if(!reason?.trim())throw new DomainError('REASON_REQUIRED',422);
  return this.repo.action(actor,'target-approve',key,{id,runId,approvalDigest,reason},async tx=>{const c=await candidate(tx,id);await permission(this.repo,tx,c.processing_id,actor,'event_review',true);},async tx=>{
   const c=await candidate(tx,id,true);await candidateGuard(tx,c);
   await tx.query('LOCK TABLE information.target IN SHARE ROW EXCLUSIVE MODE');
   const r=(await tx.query('SELECT * FROM information.target_identity_runs WHERE id=$1 AND candidate_id=$2 AND generation=$3 FOR UPDATE',[runId,id,c.proposal_generation])).rows[0];if(!r||digest({input:r.input_digest,result:r.result})!==approvalDigest)throw stale();
   if(r.state==='approved'){try{await this.validateApproval(r,tx);return {target_id:r.target_id};}catch(error){if(!(error instanceof DomainError)||error.code!=='FORBIDDEN')throw error;}}
   if(!r.result||r.result.decision==='UNRESOLVED')throw new DomainError('TARGET_UNRESOLVED',409);
   const set=(await tx.query('SELECT payload FROM information.target_object_sets WHERE candidate_id=$1 AND generation=$2',[id,c.proposal_generation])).rows[0]?.payload as ObjectSet;
   if(!set.objects.some(o=>digest(o)===digest(r.input.object)))throw stale();
   if(r.target_id)await this.validateApproval({...r,approval_actor:actor},tx);else if(digest(await this.input(id,r.input.object,tx))!==r.input_digest)throw stale();
   const result=validateTargetOutput(r.input,r.result);let target:TargetDefinition;
   if(r.target_id)target=(await tx.query<TargetDefinition>('SELECT * FROM information.target WHERE id=$1',[r.target_id])).rows[0]!;
   else if(result.decision==='NEW'){if((await catalog(tx)).length>=100)throw new DomainError('TARGET_CATALOG_CAPACITY_EXCEEDED',409);const o=r.input.object as TargetObject;target=(await tx.query<TargetDefinition>('INSERT INTO information.target(target_name,categories,jurisdiction,scope_definition) VALUES($1,$2,$3,$4) RETURNING *',[o.name,JSON.stringify(o.categories),o.jurisdiction,o.scope_definition])).rows[0]!;}
   else target=(await tx.query<TargetDefinition>('SELECT * FROM information.target WHERE id=$1 AND is_active FOR SHARE',[result.matched_target_id])).rows[0]!;
   if(!target)throw stale();
   await this.resetDownstream(tx,id,c.proposal_generation);
   await tx.query("UPDATE information.target_identity_runs SET state='approved',target_id=$2,target_version=$3,approval_actor=$4,approval_reason=$5,approval_digest=$6 WHERE id=$1",[r.id,target.id,target.definition_version,actor,reason,approvalDigest]);
   await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'target-identity-approved',$2,$3)",[actor,id,{run_id:r.id,target_id:target.id,decision:result.decision,reason,approval_digest:approvalDigest}]);
   await tx.query("UPDATE information.event_candidates SET execution_generation=execution_generation+1,status='processing',reason_code=NULL WHERE id=$1",[id]);await enqueue(tx,'candidate',id,Number(c.execution_generation)+1);return {target_id:target.id};
  });
 }
 private async validateApproval(r:any,db:DB){
  const c=await candidate(db,r.candidate_id);await permission(this.repo,db,c.processing_id,r.approval_actor,'event_review',true);
  if(r.approval_digest!==digest({input:r.input_digest,result:r.result}))throw stale();
  const t=(await db.query<TargetDefinition>('SELECT * FROM information.target WHERE id=$1 FOR SHARE',[r.target_id])).rows[0];if(!t?.is_active||t.definition_version!==r.target_version)throw stale();
  // 对已批准运行，允许目录新增；原召回定义仍必须逐项保持。
  const now=await catalog(db);for(const old of (r.input as TargetInput).candidates){if(digest(now.find(t=>t.id===old.id))!==digest(old))throw stale();}
  const fresh=await this.input(r.candidate_id,r.input.object,db);if(digest(fresh.fact_context)!==digest(r.input.fact_context))throw stale();return t;
 }
 async definitions(id:string,base:DefinitionSnapshot,db:DB=this.repo.db):Promise<DefinitionSnapshot>{
  const c=await candidate(db,id),p=await processing(db,c.processing_id);if(p.event_options.task_manifest_id!==targetPackage)return base;
  const set=(await db.query('SELECT payload FROM information.target_object_sets WHERE candidate_id=$1 AND generation=$2',[id,c.proposal_generation])).rows[0]?.payload as ObjectSet|undefined;if(!set)throw new DomainError('TARGET_OBJECT_INPUT_REQUIRED',409);
  const targets=[];for(const o of set.objects){const rows=(await db.query("SELECT * FROM information.target_identity_runs WHERE candidate_id=$1 AND generation=$2 AND object_ref=$3 AND state='approved' ORDER BY created_at DESC",[id,c.proposal_generation,o.object_ref])).rows;const r=rows.find(r=>digest(r.input.object)===digest(o));if(!r)throw new DomainError('TARGET_REVIEW_REQUIRED',409);targets.push(asDefinition(await this.validateApproval(r,db)));}
  const unique=[...new Map(targets.map(t=>[t.id,t])).values()].sort((a,b)=>a.id.localeCompare(b.id));return {...base,targets:unique,digest:digest({base:base.digest,targets:unique})};
 }
 async read(id:string,actor:string){const c=await candidate(this.repo.db,id);await permission(this.repo,this.repo.db,c.processing_id,actor,'read');return {object_set:(await this.repo.db.query('SELECT * FROM information.target_object_sets WHERE candidate_id=$1 AND generation=$2',[id,c.proposal_generation])).rows[0]??null,runs:(await this.repo.db.query('SELECT * FROM information.target_identity_runs WHERE candidate_id=$1 AND generation=$2 ORDER BY created_at',[id,c.proposal_generation])).rows.map(r=>({...r,review_digest:r.result?digest({input:r.input_digest,result:r.result}):null}))};}
}
