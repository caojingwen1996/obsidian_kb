import {validateEightStepIdentity} from './eight-step-identity.js';
import {enqueueBusinessJob} from '../platform/business-queue.js';
import {readDefinitions} from './definitions.js';
import {randomUUID} from 'node:crypto';
import type {Repository} from '../information-ingestion/processing/repository.js';
import {transaction} from '../platform/db.js';
import {DomainError} from '../platform/types.js';
import {digest} from './contracts.js';
import {validateIdentity,type IdentityContext} from './identity.js';
import type {IdentityProposal} from './contracts.js';
import {confirmInitialFact,validateVariableExtraction,validateMeaning,type VariableResult,type EventDraft} from './variable-extraction.js';
import {assertCurrentEvidence,type MaterialEvidence} from './current-contracts.js';
import type {CurrentMaterial} from '../information-ingestion/processing/current-repository.js';
import {eventSnapshot} from './snapshot.js';
import {queueEventFile} from './files.js';
export const commitNodes=['map_event','recognize_targets','resolve_event','resolve_target','establish_initial','extract_variables','assess_meaning','classify_usage'] as const;
export function eightStepCommitReviewDigest(contextDigest:string,steps:{node_key:string;input_digest:string;result:unknown;state:string}[]){
 const ordered=commitNodes.map(node=>{const s=steps.find(s=>s.node_key===node);if(!s)throw new DomainError('COMMIT_NOT_ELIGIBLE',409);return {node_key:s.node_key,input_digest:s.input_digest,result:s.result,state:s.state};});
 return digest({node_key:'commit_event',input_digest:contextDigest,result:{context_digest:contextDigest,steps_digest:digest(ordered)}});
}
/** 首批只保存经分别批准的NEW。未支持分支不得改为新事件。 */
export async function commitEightStep(repo:Repository,id:string,generation:number,contextDigest:string,actor:string,reviewDigest?:string){
 return transaction(repo.db,async tx=>{
  await tx.query('SELECT platform.lock_permission_epoch()');
  const catalog=(await tx.query("SELECT catalog_epoch FROM information.event_identity_catalog WHERE scope_key='l0-event-catalog' FOR UPDATE")).rows[0];
  const c=(await tx.query('SELECT * FROM information.event_candidates WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!c)throw new DomainError('NOT_FOUND',404);
  const hasQueue=Boolean((await tx.query("SELECT to_regclass('platform.task_runs') AS t")).rows[0].t);
  const run=hasQueue?(await tx.query("SELECT * FROM platform.task_runs WHERE owner_module='F02' AND owner_ref->>'id'=$1 AND task_type IN ('events.process','events.commit') AND execution_generation=$2 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[id,generation])).rows[0]:null;
  if(run&&(run.engine!=='pg-boss'||['cancelled','superseded'].includes(run.runtime_state)))throw new DomainError('RUN_NOT_DISPATCHABLE',409);
  const proposalGeneration=Number(c.proposal_generation);
  const prior=(await tx.query('SELECT * FROM platform.commit_receipts WHERE candidate_id=$1 AND proposal_generation=$2',[id,proposalGeneration])).rows[0];
  if(prior){
   if(!prior.effects.every((e:{context_digest?:string})=>e.context_digest===contextDigest))throw new DomainError('STALE_PROPOSAL',409);
   const sources=(await tx.query('SELECT DISTINCT s.catalog_key FROM information.candidate_fact cf JOIN information.fact_material fm ON fm.fact_id=cf.fact_id JOIN infomation.ingestion_material m ON m.id=fm.material_id JOIN m1.sources s ON s.id=m.source_id WHERE cf.candidate_id=$1',[id])).rows;
   for(const source of sources)await repo.authorize(actor,'event_submit',source.catalog_key,tx);return prior;
  }
  if(Number(c.execution_generation)!==generation||c.status==='dismissed')throw new DomainError('STALE_EXECUTION',409);
  if((await tx.query("SELECT 1 FROM platform.review_decisions WHERE candidate_id=$1 AND generation=$2 AND scope='disposition'",[id,c.proposal_generation])).rowCount)throw new DomainError('DISPOSITION_PENDING',409);
  if(c.event_options.task_manifest_id!=='f02-eight-step-v1')throw new DomainError('TASK_PACKAGE_SEMANTICS_MISMATCH',409);
  const steps=(await tx.query("SELECT node_key,input_digest,result,state FROM information.candidate_step_results WHERE candidate_id=$1 AND generation=$2 AND object_ref='' AND manifest_ref='f02-eight-step-v1'",[id,proposalGeneration])).rows;
  for(const key of commitNodes){const s=steps.find(s=>s.node_key===key);if(!s||s.input_digest!==contextDigest||!['succeeded','skipped'].includes(s.state))throw new DomainError('COMMIT_NOT_ELIGIBLE',409);}
  const result=(key:string)=>steps.find(s=>s.node_key===key)!.result;
  const expectedReview=eightStepCommitReviewDigest(contextDigest,steps);if(reviewDigest&&reviewDigest!==expectedReview)throw new DomainError('STALE_PROPOSAL',409);
  const identity=result('resolve_event') as {decision:string;context:IdentityContext;proposal:IdentityProposal};
  if(identity.decision!=='NEW'||identity.proposal.decision!=='NEW')throw new DomainError('REUSE_IMPLEMENTATION_PENDING',409);
  validateIdentity(identity.context,identity.proposal);
  if(!catalog||Number(catalog.catalog_epoch)!==identity.context.catalog_epoch)throw new DomainError('IDENTITY_CATALOG_CHANGED',409);
  const snapshot=(await tx.query('SELECT * FROM information.event_identity_snapshots WHERE id=$1 AND candidate_id=$2 AND generation=$3',[identity.context.retrieval_snapshot_id,id,proposalGeneration])).rows[0];
  const permissionEpoch=Number((await tx.query('SELECT epoch FROM platform.permission_epochs WHERE id')).rows[0].epoch);
  if(!snapshot||snapshot.manifest_digest!==identity.context.manifest_digest||Number(snapshot.catalog_epoch)!==identity.context.catalog_epoch||Number(snapshot.permission_epoch)!==permissionEpoch)throw new DomainError('IDENTITY_CONTEXT_CHANGED',409);
  const approvals=[];
  for(const [scope,hash] of [['identity',digest({node_key:'resolve_event',input_digest:contextDigest,result:identity})],['commit',expectedReview]]){
   const approval=(await tx.query("SELECT * FROM platform.review_decisions WHERE candidate_id=$1 AND generation=$2 AND scope=$3 AND proposal_digest=$4 AND policy_version='f02-eight-step-v1' AND decision='APPROVE' ORDER BY created_at DESC,id DESC LIMIT 1 FOR SHARE",[id,proposalGeneration,scope,hash])).rows[0];
   if(!approval)throw new DomainError(scope==='commit'?'COMMIT_APPROVAL_REQUIRED':'IDENTITY_APPROVAL_REQUIRED',409);approvals.push(approval);
  }
  const fact=(await tx.query('SELECT f.* FROM information.fact f JOIN information.candidate_fact cf ON cf.fact_id=f.id WHERE cf.candidate_id=$1 FOR UPDATE OF f',[id])).rows[0];
  if(!fact||fact.event_id)throw new DomainError('FACT_ALREADY_ASSIGNED',409);
  const initial=result('establish_initial') as {current_event:EventDraft};confirmInitialFact(fact,initial.current_event);
  const evidence=(await tx.query('SELECT * FROM information.fact_evidence WHERE fact_id=$1 ORDER BY material_id,id',[fact.id])).rows;
  if(!evidence.length)throw new DomainError('FACT_EVIDENCE_REQUIRED',409);
  const materials=(await tx.query<CurrentMaterial>('SELECT m.* FROM infomation.ingestion_material m JOIN information.fact_material fm ON fm.material_id=m.id WHERE fm.fact_id=$1 ORDER BY m.id FOR SHARE OF m',[fact.id])).rows;
  validateEightStepIdentity(identity.context,identity.proposal,materials);
  for(const material of materials){
   const source=(await tx.query('SELECT catalog_key,state FROM m1.sources WHERE id=$1 FOR SHARE',[material.source_id])).rows[0];
   if(source?.state!=='ACTIVE')throw new DomainError('SOURCE_DISABLED',409);
   for(const subject of new Set([actor,c.actor]))await repo.authorize(subject,'event_submit',source.catalog_key,tx);
   await repo.authorize(approvals[0]!.actor,'event_review',source.catalog_key,tx);
   await repo.authorize(approvals[1]!.actor,'event_commit',source.catalog_key,tx);
   for(const fe of evidence.filter(e=>e.material_id===material.id))assertCurrentEvidence(material,{material_id:fe.material_id,version:fe.material_version,content_digest:fe.material_digest,segment_id:fe.segment_id,start_cp:fe.start_cp,end_cp:fe.end_cp,quote:fe.quote} as MaterialEvidence);
  }
  const targetResult=result('resolve_target') as {targets:{target_id:string}[];no_targets:boolean};
  if(!Array.isArray(targetResult.targets)||targetResult.targets.length===0&&!targetResult.no_targets)throw new DomainError('TARGET_UNRESOLVED',409);
  const targetIds=[...new Set(targetResult.targets.map(t=>t.target_id))].sort();
  const targets=[];
  for(const targetId of targetIds){
   const t=(await tx.query('SELECT * FROM information.target WHERE id=$1 AND is_active FOR SHARE',[targetId])).rows[0];
   const approved=(await tx.query("SELECT 1 FROM information.target_identity_runs WHERE candidate_id=$1 AND generation=$2 AND state='approved' AND target_id=$3 AND target_version=$4 AND approval_actor IS NOT NULL AND approval_digest IS NOT NULL",[id,proposalGeneration,targetId,t?.definition_version])).rowCount;
   if(!t||!approved)throw new DomainError('TARGET_BASIS_CHANGED',409);targets.push(t);
  }
  const variables=result('extract_variables') as VariableResult;
  const definitions=(await tx.query("SELECT * FROM information.definition_snapshots WHERE kind='variable' AND id=ANY($1::uuid[])",[variables.items.map(i=>i.definition_snapshot_id).filter(Boolean)])).rows;
  validateVariableExtraction({fact_ids:[fact.id],evidence_ids:evidence.map(e=>e.id),target_ids:targetIds,variable_ids:definitions.map(d=>d.definition_id),change_refs:[]},variables);
  const liveDefinitions=await readDefinitions(repo,c.event_options.definition_ref,tx);
  for(const item of variables.items)if(item.variable_id&&!definitions.some(d=>d.id===item.definition_snapshot_id&&d.definition_id===item.variable_id&&liveDefinitions.variables.some(v=>v.id===item.variable_id&&v.status==='active'&&v.version===d.definition_version&&digest(v)===d.digest)))throw new DomainError('DEFINITION_INVALID',409);
  const meaning=result('assess_meaning') as {method_version:string;m:number|null;rating_status:string;dimensions:unknown[];assessment_scope:unknown;research_horizon:unknown;reasoning_summary:string;limitations:string[]};
  if(meaning.method_version!=='text-draft-v1'||meaning.m!==null||meaning.rating_status!=='draft'||!meaning.reasoning_summary?.trim()||!Array.isArray(meaning.limitations)||!meaning.limitations.length)throw new DomainError('RATING_METHOD_UNAPPROVED',409);
  validateMeaning({mode:'text-draft',method_version:'text-draft-v1',assessment_scope:meaning.assessment_scope as Record<string,unknown>,research_horizon:meaning.research_horizon as Record<string,unknown>,evidence_ids:evidence.map(e=>e.id)},{dimensions:meaning.dimensions,reasoning_summary:meaning.reasoning_summary,limitations:meaning.limitations});
  const eventId=randomUUID(),key=c.commit_key??randomUUID(),draft=initial.current_event;
  await tx.query('INSERT INTO information.event(id,title,description,subject,action,object,event_status,event_time) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[eventId,draft.title,draft.description,draft.subject,draft.action,draft.object??null,draft.event_status,draft.event_time]);
  await tx.query("UPDATE information.fact SET event_id=$2,event_relation_role='initial',event_relation_note=$3,event_assigned_at=now() WHERE id=$1",[fact.id,eventId,'新事件初始事实经分别复核']);
  for(const t of targets){
   const ds=(await tx.query("INSERT INTO information.definition_snapshots(kind,definition_id,definition_version,payload,digest) VALUES('target',$1,$2,$3,$4) ON CONFLICT(kind,definition_id,definition_version) DO NOTHING RETURNING id",[t.id,String(t.definition_version),t,digest(t)])).rows[0]??(await tx.query("SELECT id FROM information.definition_snapshots WHERE kind='target' AND definition_id=$1 AND definition_version=$2 AND digest=$3",[t.id,String(t.definition_version),digest(t)])).rows[0];
   if(!ds)throw new DomainError('DEFINITION_VERSION_CONFLICT',409);
   await tx.query('INSERT INTO information.event_target(event_id,target_id,relation_note) VALUES($1,$2,$3)',[eventId,t.id,'已核定原文作用对象']);
   await tx.query('INSERT INTO information.event_target_definition VALUES($1,$2,$3)',[eventId,t.id,ds.id]);
   await tx.query('INSERT INTO information.event_target_fact VALUES($1,$2,$3)',[eventId,t.id,fact.id]);
  }
  const extractionId=randomUUID();
  await tx.query('INSERT INTO information.event_variable_extractions(id,candidate_id,generation,event_id,input_digest,manifest_ref,operation_key,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[extractionId,id,proposalGeneration,eventId,contextDigest,'f02-eight-step-v1',`${id}/${proposalGeneration}/variables`,variables]);
  const observationIds:string[]=[];
  for(const item of variables.items.filter(i=>i.relation_status==='ready'))for(const targetRef of item.target_refs.filter(t=>t.kind==='target')){
   await tx.query("INSERT INTO information.event_target_variable(event_id,target_id,variable_id,relation_type,change_direction,impact_status,description) VALUES($1,$2,$3,'direct_involvement','unknown','unknown',$4) ON CONFLICT DO NOTHING",[eventId,targetRef.ref,item.variable_id,item.reason]);
   await tx.query('INSERT INTO information.event_variable_definition VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[eventId,targetRef.ref,item.variable_id,item.definition_snapshot_id]);
   await tx.query('INSERT INTO information.event_variable_fact VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[eventId,targetRef.ref,item.variable_id,fact.id]);
   const adopted=definitions.find(d=>d.id===item.definition_snapshot_id)!.payload;
   for(const value of item.values){
    const type=adopted.data_type;const expected=type==='numeric'?'number':type==='boolean'?'boolean':['categorical','state','temporal'].includes(type)?'string':null;
    if(!expected||typeof value.value!==expected||adopted.unit!==undefined&&value.unit!==adopted.unit)throw new DomainError('OBSERVATION_DEFINITION_MISMATCH',422);
    const oid=randomUUID();observationIds.push(oid);await tx.query('INSERT INTO information.variable_observation_records(id,event_id,target_id,variable_id,definition_snapshot_id,value,unit,value_nature,value_time,acquisition_method,derivation_basis,basis) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[oid,eventId,targetRef.ref,item.variable_id,item.definition_snapshot_id,JSON.stringify(value.value),value.unit,value.value_nature,value.value_time,value.acquisition_method,value.derivation_basis,JSON.stringify(value.basis)]);}
  }
  const ratingId=randomUUID();
  await tx.query("INSERT INTO information.event_rating(id,assessment_scope,research_horizon,method_version,m,dimension_scores,financial_usages,reasoning_summary,limitations,rating_status) VALUES($1,$2,$3,'text-draft-v1',NULL,$4,'[]',$5,$6,'draft')",[ratingId,meaning.assessment_scope,meaning.research_horizon,JSON.stringify(meaning.dimensions),meaning.reasoning_summary,JSON.stringify(meaning.limitations)]);
  await tx.query('INSERT INTO information.event_rating_relation VALUES($1,$2)',[ratingId,eventId]);await tx.query('INSERT INTO information.event_rating_fact VALUES($1,$2,$3)',[eventId,ratingId,fact.id]);
  await tx.query("UPDATE information.event_identity_catalog SET catalog_epoch=catalog_epoch+1 WHERE scope_key='l0-event-catalog'");
  const content={...await eventSnapshot(tx,eventId),usage_status:result('classify_usage')};
  const payload={schema_version:'riskhot.event-commit.v2',event_id:eventId,commit_key:key,change_kinds:['event_created','event_rating_updated'],fact_ids:[fact.id],content};
  const message=(await tx.query("INSERT INTO platform.messages(message_type,event_id,payload,payload_digest) VALUES('event.facts.committed.v2',$1,$2,$3) RETURNING id",[eventId,payload,digest(payload)])).rows[0];
  await tx.query('INSERT INTO platform.event_message_dependencies(message_id) VALUES($1)',[message.id]);
  await tx.query('INSERT INTO platform.message_deliveries(message_id,consumer_id) SELECT $1,id FROM platform.event_consumers WHERE enabled',[message.id]);
  await queueEventFile(tx,c.material_id,`events/${eventId}/${key}.json`,content);
  if(run){
   await enqueueBusinessJob(tx,{task_type:'events.enrich',payload_version:1,run_id:randomUUID(),owner_module:'F02',owner_ref:{id},operation_key:`association/${id}/${generation}`,execution_generation:generation,input_digest:digest({id,saved:eventId,generation}),manifest_ref:'f02-eight-step-v1',correlation_id:run.correlation_id,causation_id:run.run_id,trigger_kind:'event-saved',payload:{candidate_id:id,event_id:eventId}});
   await enqueueBusinessJob(tx,{task_type:'deliveries.send',payload_version:1,run_id:randomUUID(),owner_module:'F02',owner_ref:{id:message.id},operation_key:`delivery/${message.id}`,execution_generation:1,input_digest:digest(payload),manifest_ref:'event-delivery-v2',correlation_id:run.correlation_id,causation_id:run.run_id,trigger_kind:'event-saved',payload:{message_id:message.id}});
  }
  const effects=[{context_digest:contextDigest,event_id:eventId,fact_id:fact.id,message_id:message.id,rating_ids:[ratingId],extraction_id:extractionId,observation_ids:observationIds}];
  const receipt=(await tx.query("INSERT INTO platform.commit_receipts(commit_key,candidate_id,proposal_generation,result_kind,effects,review_decision_id) VALUES($1,$2,$3,'COMMITTED',$4,$5) RETURNING *",[key,id,proposalGeneration,JSON.stringify(effects),approvals[1]!.id])).rows[0];
  await tx.query("UPDATE information.event_candidates SET status='completed',commit_key=$2,resume_step=NULL,saved_result_refs=$3 WHERE id=$1",[id,key,receipt]);
  await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'f02-eight-step-committed',$2,$3)",[actor,eventId,{candidate_id:id,generation,context_digest:contextDigest,commit_key:key}]);
  return receipt;
 });
}
