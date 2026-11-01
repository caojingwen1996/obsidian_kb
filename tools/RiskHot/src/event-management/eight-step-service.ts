import {validateEightStepIdentity} from './eight-step-identity.js';
import {Reviews} from './reviews.js';
import {saveAssociationSnapshot,validateAssociationSnapshot} from './associations.js';
import {eventSnapshot,eventDigest} from './snapshot.js';
import {eventAccess} from './store.js';
import {enqueueBusinessJob} from '../platform/business-queue.js';
import {randomUUID} from 'node:crypto';
import {transaction} from '../platform/db.js';
import {DomainError} from '../platform/types.js';
import {dispatchCurrentExecution} from '../platform/current-dispatch.js';
import type {Repository} from '../information-ingestion/processing/repository.js';
import {IngestionRepository} from '../information-ingestion/processing/current-repository.js';
import {modelConfig,type TaskInput} from '../information-ingestion/processing/model.js';
import {digest,type IdentityProposal} from './contracts.js';
import {permission,candidateSourcesPermission,candidate as readCandidate,type EventOptions} from './store.js';
import {prepareIdentity,validateIdentity} from './identity.js';
import {TargetIdentity,targetPackage} from './target-identity.js';
import {prepareTargetRecognition,acceptTargetRecognition} from './target-recognition.js';
import {type RecognitionInput,type RecognitionOutput} from './target-recognition-contracts.js';
import {readDefinitions} from './definitions.js';
import {mapFactToEvent} from './current-contracts.js';
import {confirmInitialFact,validateVariableExtraction,validateMeaning,type SavedFact} from './variable-extraction.js';
import {advanceEightStep,eightStepManifest,type EightStepPorts,type NodeKey,type NodeResult} from './eight-step.js';
import {loadEightStepTask} from './eight-step-packages.js';
import {commitEightStep} from './eight-step-commit.js';
async function candidate(...args:Parameters<typeof readCandidate>){const row=await readCandidate(...args);const v=row as typeof row & {actor:string;event_options:EventOptions};if(!v.actor||!v.event_options)throw new DomainError('EVENT_CONTEXT_REQUIRED',409);return v;}
export type BusinessModel=(repo:Repository,id:string,generation:number,input:TaskInput)=>Promise<unknown>;
export const nodeReviewDigest=(row:{node_key:string;input_digest:string;result:unknown})=>digest({node_key:row.node_key,input_digest:row.input_digest,result:row.result});
const coreNodes:NodeKey[]=['map_event','recognize_targets','resolve_event','resolve_target','establish_initial','extract_variables','assess_meaning','classify_usage'];
export class EightStepService {
 constructor(public repo:Repository,public modelCall?:BusinessModel){}
 async start(materialId:string,actor:string,options:EventOptions,key:string){
  if(options.task_manifest_id!==eightStepManifest||options.method_version!=='text-draft-v1'||!options.reason?.trim()||!options.definition_ref||!Object.keys(options.assessment_scope??{}).length||!Object.keys(options.research_horizon??{}).length)throw new DomainError('EVENT_CONTEXT_REQUIRED',422);
  return this.repo.action(actor,'eight-step-start',key,{materialId,options},tx=>permission(this.repo,tx,materialId,actor,'event_submit',true),async tx=>{
   const m=await new IngestionRepository(this.repo).material(actor,materialId);if(m.extraction_result?.candidate_count===undefined)throw new DomainError('EXTRACTION_NOT_COMPLETED',409);
   const rows=(await tx.query("SELECT * FROM information.event_candidates WHERE material_id=$1 AND material_version=$2 AND material_digest=$3 FOR UPDATE",[materialId,m.version,m.content_digest])).rows;
   for(const c of rows){if(c.event_options?.task_manifest_id&&c.event_options.task_manifest_id!==eightStepManifest)throw new DomainError('LEGACY_RUNNING_CANDIDATE',409);await tx.query("UPDATE information.event_candidates SET actor=$2,event_options=$3 WHERE id=$1",[c.id,actor,{...options,model_binding:modelConfig()}]);await dispatchCurrentExecution(tx,{kind:'candidate',owner_id:c.id,generation:Number(c.execution_generation),workflow_id:`eight-step/${c.id}/${c.execution_generation}`,input:{candidate_id:c.id,generation:Number(c.execution_generation)},manifest_ref:eightStepManifest},'pg-boss');}
   return {material_id:materialId,candidate_ids:rows.map(c=>c.id),status:rows.length?'accepted':'completed'};
  });
 }
 async context(id:string){
  const c=await candidate(this.repo.db,id);if(c.status==='dismissed')throw new DomainError('STALE_EXECUTION',409);await permission(this.repo,this.repo.db,c.processing_id,c.actor as string,'event_submit',true);
  const f=(await this.repo.db.query('SELECT f.* FROM information.fact f JOIN information.candidate_fact cf ON cf.fact_id=f.id WHERE cf.candidate_id=$1',[id])).rows[0] as SavedFact&{event_id:string|null};if(!f)throw new DomainError('FACT_REQUIRED',409);
  const materials=(await this.repo.db.query('SELECT m.id AS material_id,m.version,m.content_digest FROM information.fact_material fm JOIN infomation.ingestion_material m ON m.id=fm.material_id WHERE fm.fact_id=$1 ORDER BY m.id',[f.id])).rows;
  for(const m of materials)await transaction(this.repo.db,tx=>new IngestionRepository(this.repo).assertBasis(tx,c.actor as string,m));
  const options=(c as any).event_options as EventOptions;
  return {manifest_ref:options.task_manifest_id,generation:Number(c.execution_generation),input_digest:digest({fact:{id:f.id,...mapFactToEvent(f)},materials,options}),event_id:f.event_id??null};
 }
 async read(id:string,actor:string){
  const c=await candidate(this.repo.db,id);await permission(this.repo,this.repo.db,c.processing_id,actor,'read');
  const sourceMaterials=(await this.repo.db.query('SELECT fm.material_id FROM information.candidate_fact cf JOIN information.fact_material fm ON fm.fact_id=cf.fact_id WHERE cf.candidate_id=$1',[id])).rows;
  for(const source of sourceMaterials)await permission(this.repo,this.repo.db,source.material_id,actor,'read');
  const nodes=(await this.repo.db.query("SELECT node_key,state,result,input_digest,reason_code FROM information.candidate_step_results WHERE candidate_id=$1 AND generation=$2 AND manifest_ref=$3 ORDER BY node_key",[id,c.proposal_generation,eightStepManifest])).rows;
  const f=(await this.repo.db.query('SELECT f.event_id FROM information.fact f JOIN information.candidate_fact cf ON cf.fact_id=f.id WHERE cf.candidate_id=$1',[id])).rows[0];
  const projected=nodes.map(n=>({...n,review_digest:nodeReviewDigest(n)}));
  if(f?.event_id){const run=(await this.repo.db.query("SELECT runtime_state,result_ref,next_eligible_at FROM platform.task_runs WHERE task_type='events.enrich' AND owner_ref->>'id'=$1 ORDER BY created_at DESC LIMIT 1",[id])).rows[0];projected.push({node_key:'associate_events',state:run?.runtime_state??'pending',result:run?.result_ref??{reason:'关联等待执行'},input_digest:'',reason_code:run?.result_ref?.reason??null,review_digest:null});}
  return {candidate:c,nodes:projected,saved_event_id:f?.event_id??null};
 }
 private async result(id:string,node:NodeKey){const c=await candidate(this.repo.db,id);return (await this.repo.db.query('SELECT * FROM information.candidate_step_results WHERE candidate_id=$1 AND generation=$2 AND node_key=$3 AND manifest_ref=$4',[id,c.proposal_generation,node,eightStepManifest])).rows[0]??null;}
 private async approved(id:string,node:NodeKey,row:any){const c=await candidate(this.repo.db,id);return (await this.repo.db.query('SELECT * FROM platform.review_decisions WHERE candidate_id=$1 AND generation=$2 AND scope=$3 AND proposal_digest=$4 AND policy_version=$5 AND decision=\'APPROVE\' ORDER BY created_at DESC LIMIT 1',[id,c.proposal_generation,node==='commit_event'?'commit':node==='resolve_event'?'identity':'relations',nodeReviewDigest(row),eightStepManifest])).rows[0];}
 private async call(id:string,generation:number,task:string,context:unknown){
  if(!this.modelCall)throw new DomainError('BUSINESS_MODEL_NOT_CONFIGURED',503);
  await this.noDisposition(id);
  const c=await candidate(this.repo.db,id),m=await new IngestionRepository(this.repo).material(c.actor as string,c.processing_id),p=loadEightStepTask(task);
  const material_refs=(await this.repo.db.query('SELECT m.id AS material_id,m.version,m.content_digest FROM information.candidate_fact cf JOIN information.fact_material fm ON fm.fact_id=cf.fact_id JOIN infomation.ingestion_material m ON m.id=fm.material_id WHERE cf.candidate_id=$1 ORDER BY m.id',[id])).rows;
  return this.modelCall(this.repo,id,generation,{material_refs,version_id:m.id,material_ref:{material_id:m.id,version:m.version,content_digest:m.content_digest},material:m.content,manifest:{provider:(c as any).event_options.model_binding??modelConfig(),prompt:p.prompt,task_id:task,output_schema:p.schema,task_package:p},context});
 }
 async advance(id:string,generation:number){
  const initial=await candidate(this.repo.db,id);
  const disposition=(await this.repo.db.query("SELECT 1 FROM platform.review_decisions WHERE candidate_id=$1 AND generation=$2 AND scope='disposition'",[id,initial.proposal_generation])).rowCount;
  if(disposition){const receipt=await new Reviews(this.repo).disposeCandidate(id,generation);return {state:'completed' as const,node_key:'commit_event' as const,reason:receipt.result_kind};}
  const ports:EightStepPorts={context:()=>this.context(id),result:(_id,node)=>this.result(id,node),execute:(_id,node)=>this.execute(id,node,generation),save:async(_id,node,_g,inputDigest,r)=>{
   await transaction(this.repo.db,async tx=>{const c=await candidate(tx,id,true);if(c.status==='dismissed'||Number(c.execution_generation)!==generation)throw new DomainError('STALE_EXECUTION',409);
    await tx.query("INSERT INTO information.candidate_step_results(candidate_id,generation,node_key,object_ref,manifest_ref,input_digest,context,state,result,reason_code) VALUES($1,$2,$3,'',$4,$5,'{}',$6,$7,$8) ON CONFLICT(candidate_id,generation,node_key,object_ref) DO UPDATE SET input_digest=EXCLUDED.input_digest,state=EXCLUDED.state,result=EXCLUDED.result,reason_code=EXCLUDED.reason_code",[id,c.proposal_generation,node,eightStepManifest,inputDigest,r.state,r.result,r.reason??null]);
    await tx.query('UPDATE information.event_candidates SET status=$2,reason_code=$3 WHERE id=$1',[id,r.state==='review'?'review':r.state==='recoverable'?'recoverable':node==='commit_event'?'completed':'processing',r.reason??null]);
   });
  }};return advanceEightStep(id,generation,ports);
 }
 private async execute(id:string,node:NodeKey,generation:number):Promise<NodeResult>{
  const c=await candidate(this.repo.db,id),old=await this.result(id,node),ctx=await this.context(id);
  const fact=(await this.repo.db.query('SELECT f.* FROM information.fact f JOIN information.candidate_fact cf ON cf.fact_id=f.id WHERE cf.candidate_id=$1',[id])).rows[0];
  const success=(result:unknown):NodeResult=>({state:'succeeded',result});
  if(node==='map_event')return success(mapFactToEvent(fact));
  if(node==='recognize_targets'){
   let input:RecognitionInput,value:unknown;const approval=old&&await this.approved(id,node,old);
   if(approval){input=await prepareTargetRecognition(this.repo,c.actor,fact.id,eightStepManifest);if(digest({...input,contexts:undefined})!==digest(old.result.input))throw new DomainError('MATERIAL_BASIS_CHANGED',409);value=old.result.output;}else {input=await prepareTargetRecognition(this.repo,c.actor as string,fact.id,eightStepManifest);value=await this.call(id,generation,'AI-08',input);}
   return transaction(this.repo.db,async tx=>{const result=await acceptTargetRecognition(this.repo,c.actor as string,input,value,{tx,runIdentity:id,...(approval?{semanticEvidenceRefs:input.evidence_catalog.map(e=>e.evidence_ref)}:{})});
    if(['review','fact_correction'].includes(result.status))return {state:'review',result:{input:{...input,contexts:undefined},output:result.output},reason:result.status==='fact_correction'?'FACT_CORRECTION_REQUIRED':'TARGET_SEMANTIC_REVIEW_REQUIRED'};
    await tx.query("INSERT INTO information.target_object_sets(candidate_id,generation,payload,input_digest,actor,reason) VALUES($1,$2,$3,$4,$5,'AI-08接纳') ON CONFLICT(candidate_id,generation) DO UPDATE SET payload=EXCLUDED.payload,input_digest=EXCLUDED.input_digest",[id,c.proposal_generation,{objects:result.objects,explicit_no_objects:result.status==='no_targets',reason:'AI-08接纳'},digest(result.objects),c.actor]);return success({input:{...input,contexts:undefined},output:result.output,objects:result.objects});});
  }
  if(node==='resolve_event'){
   if(old?.state==='review'&&await this.approved(id,node,old)){if(old.result.context.catalog_epoch!==Number((await this.repo.db.query("SELECT catalog_epoch FROM information.event_identity_catalog WHERE scope_key='l0-event-catalog'")).rows[0].catalog_epoch))throw new DomainError('IDENTITY_BASIS_CHANGED',409);return success(old.result);}
   const context=await prepareIdentity(this.repo,id,generation),value=await this.call(id,generation,'AI-02',{candidate:c.payload,retrieval:context});
   const sources=(await this.repo.db.query('SELECT m.* FROM information.fact_material fm JOIN infomation.ingestion_material m ON m.id=fm.material_id WHERE fm.fact_id=$1',[fact.id])).rows;const proposal=validateEightStepIdentity(context,value,sources);return {state:'review',result:{decision:proposal.decision,context,proposal},reason:'IDENTITY_REVIEW_REQUIRED'};
  }
  if(node==='resolve_target'){
   await this.repo.db.query('UPDATE information.event_candidates SET resume_step=3 WHERE id=$1',[id]);
   const target=new TargetIdentity(this.repo),next=await target.advance(id,generation);
   if(next.input){const value=await this.call(id,generation,'AI-07',next.input.context);await target.accept(id,generation,next.input.context as any,value);return {state:'review',result:await target.read(id,c.actor as string),reason:'TARGET_REVIEW_REQUIRED'};}
   if(next.waiting)return {state:'review',result:await target.read(id,c.actor as string),reason:'TARGET_REVIEW_REQUIRED'};
   const targets=(await this.repo.db.query("SELECT target_id,target_version FROM information.target_identity_runs WHERE candidate_id=$1 AND generation=$2 AND state='approved'",[id,c.proposal_generation])).rows;
   return success({targets,no_targets:!targets.length});
  }
  if(node==='establish_initial')return success(confirmInitialFact(fact,(await this.result(id,'map_event')).result));
  const evidence=(await this.repo.db.query('SELECT * FROM information.fact_evidence WHERE fact_id=$1',[fact.id])).rows;
  if(node==='extract_variables'){
   const definitions=await readDefinitions(this.repo,c.event_options.definition_ref);
   await transaction(this.repo.db,async tx=>{for(const d of definitions.variables.filter(v=>v.status==='active')){await tx.query("INSERT INTO information.definition_snapshots(kind,definition_id,definition_version,payload,digest) VALUES('variable',$1,$2,$3,$4) ON CONFLICT(kind,definition_id,definition_version) DO NOTHING",[d.id,d.version,d,digest(d)]);const snapshot=(await tx.query("SELECT id FROM information.definition_snapshots WHERE kind='variable' AND definition_id=$1 AND definition_version=$2 AND digest=$3",[d.id,d.version,digest(d)])).rows[0];if(!snapshot)throw new DomainError('DEFINITION_VERSION_CONFLICT',409);d.definition_snapshot_id=snapshot.id;}});
   const targets=(await this.result(id,'resolve_target')).result.targets;
   const input={fact_ids:[fact.id],evidence_ids:evidence.map(e=>e.id),target_ids:targets.map((t:any)=>t.target_id),variable_ids:definitions.variables.filter(v=>v.status==='active').map(v=>v.id),change_refs:[]};
   const value=await this.call(id,generation,'AI-05',{fact,evidence,definitions,targets,initial:(await this.result(id,'establish_initial')).result});return success(validateVariableExtraction(input,value));
  }
  if(node==='assess_meaning'){
   const o=(c as any).event_options;const input={mode:'text-draft' as const,method_version:o.method_version,assessment_scope:o.assessment_scope,research_horizon:o.research_horizon,evidence_ids:evidence.map(e=>e.id)};
   return success(validateMeaning(input,await this.call(id,generation,'AI-09',{...input,fact,evidence,variables:(await this.result(id,'extract_variables')).result})));
  }
  if(node==='classify_usage')return {state:'skipped',result:{status:'waiting_rules'},reason:'USAGE_RULE_NOT_PUBLISHED'};
  if(node==='commit_event'){
   const steps=[];for(const key of coreNodes){const r=await this.result(id,key);steps.push({node_key:key,input_digest:r.input_digest,result:r.result,state:r.state});}
   const result={context_digest:ctx.input_digest,steps_digest:digest(steps)};
   if(!old||digest(old.result)!==digest(result)||!await this.approved(id,node,{...old,result}))return {state:'review',result,reason:'COMMIT_REVIEW_REQUIRED'};
   return success(await commitEightStep(this.repo,id,generation,ctx.input_digest,c.actor as string));
  }
  throw new DomainError('NODE_NOT_IMPLEMENTED',409);
 }
 async associate(id:string,generation:number):Promise<{state:'succeeded'|'waiting'|'recoverable';snapshot_id?:string;message_id?:string;reason?:string}>{
  const c=await candidate(this.repo.db,id);if(Number(c.execution_generation)!==generation||c.status!=='completed')throw new DomainError('FORMAL_EVENT_REQUIRED',409);
  const eventId=(await this.repo.db.query('SELECT f.event_id FROM information.fact f JOIN information.candidate_fact cf ON cf.fact_id=f.id WHERE cf.candidate_id=$1',[id])).rows[0]?.event_id;if(!eventId)throw new DomainError('FORMAL_EVENT_REQUIRED',409);
  const events=(await this.repo.db.query('SELECT id FROM information.event ORDER BY id LIMIT 101')).rows;if(events.length>100)return {state:'waiting',reason:'ASSOCIATION_SCOPE_REQUIRED'};
  const members=[];for(const e of events){try{await eventAccess(this.repo,this.repo.db,e.id,c.actor);const snapshot=await eventSnapshot(this.repo.db,e.id);members.push({event_id:e.id,fact_ids:snapshot.facts.map(f=>f.id),basis_digest:await eventDigest(this.repo.db,e.id)});}catch(error){if(!(error instanceof DomainError&&error.code==='FORBIDDEN'))throw error;}}
  const end=new Date().toISOString().slice(0,10),start=new Date(Date.now()-31*86400000).toISOString().slice(0,10),window={start,end};
  const input={scope:JSON.stringify(c.event_options.assessment_scope),window,retrieval:{complete:true,truncated:false,digest:digest(members)},members};const inputDigest=digest(input),operation_key=`association/${id}/${inputDigest}`;
  const saved=(await this.repo.db.query('SELECT * FROM information.event_association_snapshots WHERE operation_key=$1',[operation_key])).rows[0];if(saved){const result=await transaction(this.repo.db,tx=>saveAssociationSnapshot(tx,{event_id:eventId,actor:c.actor,operation_key,manifest_ref:saved.manifest_ref,input_digest:saved.input_digest,payload:saved.payload}));return {state:'succeeded',...result};}
  try{
   const raw=await this.call(id,generation,'AI-04',{...input,events:await Promise.all(members.map(m=>eventSnapshot(this.repo.db,m.event_id)))}),payload=validateAssociationSnapshot(raw);
   if(digest(payload.members)!==digest(members)||digest(payload.window)!==digest(window)||payload.retrieval.digest!==input.retrieval.digest||payload.scope!==input.scope)throw new DomainError('ASSOCIATION_REFERENCE_INVALID',422);
   if(payload.unresolved.length)return {state:'waiting',reason:'ASSOCIATION_REVIEW_REQUIRED'};
   const result=await transaction(this.repo.db,async tx=>{const latest=await candidate(tx,id,true);if(Number(latest.execution_generation)!==generation)throw new DomainError('STALE_EXECUTION',409);return saveAssociationSnapshot(tx,{event_id:eventId,actor:c.actor,operation_key,manifest_ref:eightStepManifest,input_digest:inputDigest,payload});});return {state:'succeeded',...result};
  }catch(error){if(!(error instanceof DomainError))throw error;return {state:'recoverable',reason:error.code};}
 }
 async review(id:string,actor:string,body:{node_key:string;proposal_digest:string;reason:string},key:string){
  if(!['recognize_targets','resolve_event','resolve_target','commit_event'].includes(body.node_key)||!body.reason?.trim())throw new DomainError('REVIEW_INVALID',422);
  await this.noDisposition(id);
  const node=body.node_key as NodeKey;
  if(node==='resolve_target'){
   const row=await this.result(id,node);
   if(row?.state==='review'&&nodeReviewDigest(row)===body.proposal_digest){
    const target=new TargetIdentity(this.repo);for(const run of row.result.runs??[])if(run.state==='review')await target.approve(id,actor,run.id,run.review_digest,body.reason,digest({key,run:run.id}));
   }
  }
  return this.repo.action(actor,'eight-step-review',key,{id,body},async tx=>{await candidateSourcesPermission(this.repo,tx,id,actor,node==='commit_event'?'event_commit':'event_review',true);},async tx=>{
   const row=await this.result(id,node);
   if(!row||row.state!=='review'||nodeReviewDigest(row)!==body.proposal_digest)throw new DomainError('STALE_PROPOSAL',409);
   const fresh=await candidate(tx,id,true);const current=(await tx.query('SELECT * FROM information.candidate_step_results WHERE candidate_id=$1 AND generation=$2 AND node_key=$3 FOR UPDATE',[id,fresh.proposal_generation,node])).rows[0];if(nodeReviewDigest(current)!==body.proposal_digest)throw new DomainError('STALE_PROPOSAL',409);
   await tx.query("INSERT INTO platform.review_decisions(candidate_id,scope,proposal_digest,generation,actor,decision,reason,policy_version) VALUES($1,$2,$3,$4,$5,'APPROVE',$6,$7)",[id,node==='commit_event'?'commit':node==='resolve_event'?'identity':'relations',body.proposal_digest,fresh.proposal_generation,actor,body.reason,eightStepManifest]);
   const next=Number(fresh.execution_generation)+1;await tx.query("UPDATE information.event_candidates SET execution_generation=$2,status='processing' WHERE id=$1",[id,next]);if(node==='commit_event'){await enqueueBusinessJob(tx,{task_type:'events.commit',payload_version:1,run_id:randomUUID(),owner_module:'F02',owner_ref:{id},operation_key:`commit/${id}/${next}`,execution_generation:next,input_digest:digest({candidate_id:id,generation:next}),manifest_ref:eightStepManifest,correlation_id:randomUUID(),causation_id:null,trigger_kind:'approved',payload:{candidate_id:id,generation:next}});}else await dispatchCurrentExecution(tx,{kind:'candidate',owner_id:id,generation:next,workflow_id:`eight-step/${id}/${next}`,input:{candidate_id:id,generation:next},manifest_ref:eightStepManifest},'pg-boss');return {candidate_id:id,generation:next,status:'accepted'};
  });
 }
 private async noDisposition(id:string){const c=await candidate(this.repo.db,id);if((await this.repo.db.query("SELECT 1 FROM platform.review_decisions WHERE candidate_id=$1 AND generation=$2 AND scope='disposition'",[id,c.proposal_generation])).rowCount)throw new DomainError('DISPOSITION_PENDING',409);}
 async resume(id:string,actor:string,key:string){await this.noDisposition(id);const c=await candidate(this.repo.db,id);
  if(c.status==='completed')return this.repo.action(actor,'eight-step-association-resume',key,{id},tx=>permission(this.repo,tx,c.processing_id,actor,'event_retry',true),async tx=>{
   const run=(await tx.query("SELECT * FROM platform.task_runs WHERE task_type='events.enrich' AND owner_ref->>'id'=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[id])).rows[0];
   if(!run)throw new DomainError('ASSOCIATION_RUN_UNAVAILABLE',409);if(run.runtime_state==='succeeded')return {candidate_id:id,status:'completed',branch:'association'};
   if(!['recoverable','waiting'].includes(run.runtime_state))throw new DomainError('OPERATION_RUNNING',409);
   await tx.query("UPDATE platform.task_runs SET runtime_state='recoverable',next_eligible_at=NULL WHERE run_id=$1",[run.run_id]);
   const seq=Number((await tx.query('SELECT COALESCE(max(dispatch_seq),0)+1 AS n FROM platform.task_dispatches WHERE run_id=$1 AND generation=$2',[run.run_id,run.execution_generation])).rows[0].n);
   await enqueueBusinessJob(tx,{task_type:run.task_type,payload_version:run.payload_version,run_id:run.run_id,owner_module:run.owner_module,owner_ref:run.owner_ref,operation_key:run.operation_key,execution_generation:Number(run.execution_generation),input_digest:run.input_digest,manifest_ref:run.manifest_ref,correlation_id:run.correlation_id,causation_id:run.causation_id,trigger_kind:'manual-retry',payload:run.input_payload},{dispatch_seq:seq});return {candidate_id:id,status:'accepted',branch:'association'};
  });
  return this.repo.action(actor,'eight-step-resume',key,{id},tx=>permission(this.repo,tx,c.processing_id,actor,'event_retry',true),async tx=>{const row=await candidate(tx,id,true);if(!['recoverable','review'].includes(row.status))throw new DomainError('CANDIDATE_NOT_RECOVERABLE',409);const next=Number(row.execution_generation)+1;await tx.query("UPDATE information.event_candidates SET execution_generation=$2,status='processing' WHERE id=$1",[id,next]);await dispatchCurrentExecution(tx,{kind:'candidate',owner_id:id,generation:next,workflow_id:`eight-step/${id}/${next}`,input:{candidate_id:id,generation:next},manifest_ref:eightStepManifest},'pg-boss');return {candidate_id:id,generation:next,status:'accepted'};});}
}
