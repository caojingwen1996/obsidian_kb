import {TargetIdentity} from './target-identity.js';
import {currentInputDigest,isCurrentReference,readCurrentInput,type CurrentModelReference} from './current-model.js';
import {currentModel} from './store.js';
import {currentizeSchema,validateCurrentTask} from './current-contracts.js';
import {IngestionRepository} from '../information-ingestion/processing/current-repository.js';
import {eventSnapshot,eventDigest} from './snapshot.js';
import {queueEventFile} from './files.js';
import {transaction} from '../platform/db.js';import {DomainError} from '../platform/types.js';import type {Repository} from '../information-ingestion/processing/repository.js';import {decodeModelResponse,modelConfig,type TaskInput,type TransportResponse} from '../information-ingestion/processing/model.js';import {candidate,processing,permission,guard,candidateGuard,aggregate,eventAccess} from './store.js';import {EventProcessing} from './processing.js';import {loadTaskPackage,bindTaskSchema} from './task-packages.js';import {prepareIdentity,validateIdentity,type IdentityContext} from './identity.js';import {readDefinitions,type DefinitionSnapshot} from './definitions.js';import {validateRelations} from './relations.js';import {validateIncrement,type IncrementContext} from './increments.js';import {validateRating,type RatingInput} from './ratings.js';import {digest,validateTaskOutput,type Step,type TaskId,type IdentityProposal,type RelationsProposal,type IncrementProposal,type RatingProposal,type ValidationContext} from './contracts.js';
export interface StepContext {input:TaskInput;validation:ValidationContext;identity?:IdentityContext;definitions?:DefinitionSnapshot;increment?:IncrementContext;rating?:RatingInput}
export class CandidateSteps{
 constructor(public repo:Repository){}
 private async hydrate(context:StepContext,id:string):Promise<StepContext>{
  if(!await currentModel(this.repo.db))return context;
  const c=await candidate(this.repo.db,id),p=await processing(this.repo.db,c.processing_id),material=await new IngestionRepository(this.repo).material(p.actor,p.id);
  return {...context,input:{...context.input,version_id:material.id,material_ref:{material_id:material.id,version:material.version,content_digest:material.content_digest},material:material.content},validation:{...context.validation,version_id:material.id,segments:material.content.segments}};
 }
 private async stored(context:StepContext):Promise<unknown>{
  if(!await currentModel(this.repo.db))return context;
  const {material,version_id,...input}=context.input;
  const {segments,version_id:legacyId,...validation}=context.validation;
  return {...context,input:{...input,material_id:version_id},validation};
 }

 async prepare(id:string,step:Step,execution:number):Promise<StepContext>{
  const c=await candidate(this.repo.db,id),p=await processing(this.repo.db,c.processing_id);guard(p);await candidateGuard(this.repo.db,c,execution);await permission(this.repo,this.repo.db,p.version_id,p.actor,'event_submit',true);
  const prior=(await this.repo.db.query('SELECT * FROM information.candidate_step_results WHERE candidate_id=$1 AND step_no=$2 AND generation=$3',[id,step,c.proposal_generation])).rows[0];if(prior&&prior.state!=='superseded')return this.hydrate(prior.context as StepContext,id);
  const packet=await new EventProcessing(this.repo).material(p.id);const validation:ValidationContext={version_id:p.version_id,segments:packet.material.segments,event_ids:[],target_ids:[],variable_ids:[]};const context:StepContext={input:{version_id:p.version_id,material:packet.material,manifest:{provider:p.event_options.model_binding??modelConfig(),prompt:'',task_id:`AI-0${step}`,output_schema:{}}},validation};
  if(await currentModel(this.repo.db)){const m=await new IngestionRepository(this.repo).material(p.actor,p.id);context.input.material_ref={material_id:m.id,version:m.version,content_digest:m.content_digest};}
  let payload:Record<string,unknown>={candidate:c.payload};
  if(step===2){context.identity=await prepareIdentity(this.repo,id,execution);validation.event_ids=context.identity.events.map(e=>e.id);payload={...payload,identity:context.identity};}
  else{
   const identity=(await this.repo.db.query('SELECT * FROM information.identity_decisions WHERE candidate_id=$1 AND generation=$2',[id,c.proposal_generation])).rows[0];if(!identity||identity.decision==='UNRESOLVED')throw new DomainError('IDENTITY_REVIEW_REQUIRED',409);
   if(identity.event_id)await eventAccess(this.repo,this.repo.db,identity.event_id,p.actor);
   const snapshot=identity.event_id?await eventSnapshot(this.repo.db,identity.event_id):null;
   if(identity.event_id&&await eventDigest(this.repo.db,identity.event_id)!==identity.expected_digest)throw new DomainError('EVENT_CONTEXT_CHANGED',409);
   payload={...payload,identity,event:snapshot};
   if(step===3){context.definitions=await new TargetIdentity(this.repo).definitions(id,await readDefinitions(this.repo,p.event_options.definition_ref));validation.target_ids=context.definitions.targets.filter(d=>d.status==='active').map(d=>d.id);validation.variable_ids=context.definitions.variables.filter(d=>d.status==='active').map(d=>d.id);payload={...payload,definitions:context.definitions};}
   if(step===4){context.increment={is_new:identity.decision==='NEW',facts:snapshot?.facts??[],event:snapshot?.event,candidate:c.payload};const relations=(await this.repo.db.query('SELECT result FROM information.candidate_step_results WHERE candidate_id=$1 AND step_no=3 AND generation=$2 AND state=\'succeeded\'',[id,c.proposal_generation])).rows[0];if(!relations)throw new DomainError('STEP_DEPENDENCY_REQUIRED',409);payload={...payload,relations:relations.result,history:context.increment};}
   if(step===5){const increment=(await this.repo.db.query('SELECT result FROM information.candidate_step_results WHERE candidate_id=$1 AND step_no=4 AND generation=$2 AND state=\'succeeded\'',[id,c.proposal_generation])).rows[0];if(!increment?.result.needs_rating)throw new DomainError('RATING_NOT_REQUIRED',409);context.rating={assessment_scope:p.event_options.assessment_scope,research_horizon:p.event_options.research_horizon,method_version:p.event_options.method_version};payload={...payload,rating:context.rating,increment:increment.result};}
  }
  const task=loadTaskPackage(`AI-0${step}` as TaskId,p.event_options.task_manifest_id);context.input.manifest={provider:p.event_options.model_binding??modelConfig(),prompt:task.prompt,task_id:task.task_id,output_schema:bindTaskSchema(task.task_id,payload.rating as Record<string,unknown>|undefined).schema,task_package:task};if(await currentModel(this.repo.db)){context.input.manifest.output_schema=currentizeSchema(context.input.manifest.output_schema!);context.input.manifest.prompt+= '\n当前证据只使用material_id、version与content_digest，不使用information_version_id或version_id。每个引文携带当前资料完整依据。';}context.input.manifest.output_schema_digest=digest(context.input.manifest.output_schema);context.input.context=payload;
  await transaction(this.repo.db,async tx=>{await permission(this.repo,tx,p.version_id,p.actor,'event_submit',true);await processing(tx,p.id,true);const current=await candidate(tx,id,true);guard(await processing(tx,p.id));await candidateGuard(tx,current,execution);if(current.proposal_generation!==c.proposal_generation||Number(current.resume_step)!==step)throw new DomainError('STALE_PROPOSAL',409);await tx.query("INSERT INTO information.candidate_step_results(candidate_id,step_no,generation,input_digest,context,state) VALUES($1,$2,$3,$4,$5,'pending') ON CONFLICT(candidate_id,step_no,generation) DO UPDATE SET input_digest=EXCLUDED.input_digest,context=EXCLUDED.context,state='pending',result=NULL,proposal_id=NULL,reason_code=NULL WHERE candidate_step_results.state='superseded'",[id,step,c.proposal_generation,currentInputDigest(context.input),await this.stored(context)]);await tx.query("UPDATE information.event_candidates SET status='processing',reason_code=NULL WHERE id=$1",[id]);});
  return this.hydrate((await this.repo.db.query('SELECT context FROM information.candidate_step_results WHERE candidate_id=$1 AND step_no=$2 AND generation=$3',[id,step,c.proposal_generation])).rows[0].context,id);
 }
 async restoreRelationReview(id:string,execution:number,context:StepContext):Promise<boolean>{
  const a=(await this.repo.db.query("SELECT * FROM platform.model_attempts WHERE owner_kind='event' AND owner_id=$1 AND task_id='AI-03' AND input_digest=$2 ORDER BY attempt_no DESC LIMIT 1",[id,currentInputDigest(context.input)])).rows[0];
  if(!a||a.status!=='rejected'||a.error_code!=='RELATION_REVIEW_REQUIRED'||!a.response_artifact_id)return false;
  const reference=await this.repo.json<TaskInput|CurrentModelReference>(a.request_artifact_id),input=isCurrentReference(reference)?await readCurrentInput(this.repo,reference):reference;
  if(currentInputDigest(input)!==a.input_digest)throw new DomainError('INPUT_DIGEST_MISMATCH',409);
  const response=decodeModelResponse(await this.repo.json<TransportResponse>(a.response_artifact_id));
  if(!response.complete)throw new DomainError('MODEL_INCOMPLETE',422);
  await this.accept(id,3,execution,response.data,a.id);return true;
 }
 async accept(id:string,step:Step,execution:number,payload:unknown,restoredAttemptId?:string){
  const pre=await candidate(this.repo.db,id),p=await processing(this.repo.db,pre.processing_id);const saved=(await this.repo.db.query('SELECT * FROM information.candidate_step_results WHERE candidate_id=$1 AND step_no=$2 AND generation=$3',[id,step,pre.proposal_generation])).rows[0];if(!saved)throw new DomainError('STEP_NOT_PREPARED',409);
  const context=await this.hydrate(saved.context as StepContext,id);const validation=await currentModel(this.repo.db)?validateCurrentTask(`AI-0${step}` as TaskId,payload,context.validation,await new IngestionRepository(this.repo).material(p.actor,p.id)):validateTaskOutput(`AI-0${step}` as TaskId,payload,context.validation);if(!validation.valid)throw new DomainError(validation.errors[0]!,422);
  let result:unknown=payload;
  if(step===2)result=validateIdentity(context.identity!,payload as IdentityProposal);
  if(step===3){result=validateRelations(context.definitions!,payload as RelationsProposal,true);if(p.event_options.task_manifest_id==='f02-target-identity-v3'&&context.definitions!.targets.some(t=>!(payload as RelationsProposal).targets.some(r=>r.target_id===t.id)))throw new DomainError('TARGET_RELATION_COVERAGE_REQUIRED',422);}
  if(step===4)result=validateIncrement(context.increment!,payload as IncrementProposal);
  if(step===5)result=validateRating(context.rating!,payload as RatingProposal);
  const artifact=await this.repo.putJson(payload,'event-task-proposal');
  await transaction(this.repo.db,async tx=>{await permission(this.repo,tx,p.version_id,p.actor,'event_submit',true);await processing(tx,p.id,true);const c=await candidate(tx,id,true);guard(await processing(tx,p.id));await candidateGuard(tx,c,execution);if(c.proposal_generation!==pre.proposal_generation)throw new DomainError('STALE_PROPOSAL',409);
   const current=(await tx.query('SELECT * FROM information.candidate_step_results WHERE candidate_id=$1 AND step_no=$2 AND generation=$3 FOR UPDATE',[id,step,c.proposal_generation])).rows[0];if(['succeeded','skipped','review'].includes(current.state))return;
   if(restoredAttemptId){
    const a=(await tx.query("SELECT * FROM platform.model_attempts WHERE id=$1 FOR UPDATE",[restoredAttemptId])).rows[0];
    if(step!==3||!a||a.owner_id!==id||a.task_id!=='AI-03'||a.input_digest!==current.input_digest||a.status!=='rejected'||a.error_code!=='RELATION_REVIEW_REQUIRED')throw new DomainError('STALE_EXECUTION',409);
    const response=decodeModelResponse(await this.repo.json<TransportResponse>(a.response_artifact_id));
    if(!response.complete||digest(response.data)!==digest(payload))throw new DomainError('INPUT_DIGEST_MISMATCH',409);
    await tx.query("UPDATE platform.model_attempts SET status='accepted',error_code=NULL,finish_reason=$2 WHERE id=$1",[a.id,response.finishReason]);
    await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'event-response-revalidated',$2,$3)",[p.actor,id,{attempt_id:a.id,previous_error:'RELATION_REVIEW_REQUIRED',input_digest:a.input_digest,rule:'explicit-relations-review-v1'}]);
   }
   const proposal=(await tx.query(`INSERT INTO platform.task_proposals(${await currentModel(tx)?'material_id':'processing_id'},candidate_id,task_id,generation,input_digest,manifest,output_artifact_id,validation) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[p.id,id,`AI-0${step}`,c.proposal_generation,current.input_digest,context.input.manifest,artifact,validation])).rows[0];
   await queueEventFile(tx,p.id,`events/candidates/${id}/generations/${c.proposal_generation}/steps/${step}/proposal.json`,{schema_version:'riskhot.event-proposal.v1',task_id:`AI-0${step}`,candidate_id:id,generation:Number(c.proposal_generation),input_digest:current.input_digest,manifest:context.input.manifest,payload,validated_result:result,validation});
   const review=step===2||(step===3&&(payload as RelationsProposal).unresolved_issues.length>0)||(step===4&&(result as {review_required:boolean}).review_required);await tx.query('UPDATE information.candidate_step_results SET state=$4,result=$5,proposal_id=$6 WHERE candidate_id=$1 AND step_no=$2 AND generation=$3',[id,step,c.proposal_generation,review?'review':'succeeded',result,proposal.id]);
   if(step===3)for(const d of (payload as RelationsProposal).definition_candidates)await tx.query('INSERT INTO information.definition_candidates(candidate_id,generation,payload) VALUES($1,$2,$3)',[id,c.proposal_generation,d]);
   let next=review?step:step+1;
   if(step===4&&!review&&!(result as {needs_rating:boolean}).needs_rating){next=6;await tx.query("INSERT INTO information.candidate_step_results(candidate_id,step_no,generation,input_digest,context,state,result) VALUES($1,5,$2,$3,$4,'skipped',$5) ON CONFLICT DO NOTHING",[id,c.proposal_generation,digest({classification:(payload as IncrementProposal).classification}),{},{reason:'NO_RATING_REQUIRED'}]);}
   await tx.query('UPDATE information.event_candidates SET status=$2,resume_step=$3,reason_code=$4 WHERE id=$1',[id,review?'review':'processing',next,review?(step===2?'IDENTITY_REVIEW_REQUIRED':step===3?'RELATION_REVIEW_REQUIRED':'INCREMENT_REVIEW_REQUIRED'):null]);await aggregate(tx,p.id);
  });
 }
}
