import {TargetIdentity} from './target-identity.js';
import {currentModel} from './store.js';
import {assertCurrentEvidence,type MaterialEvidence} from './current-contracts.js';
import type {CurrentMaterial} from '../information-ingestion/processing/current-repository.js';
import {Reviews} from './reviews.js';
import {readFact,addFactEvidence} from './facts.js';
import {eventSnapshot,eventDigest} from './snapshot.js';
export {eventSnapshot} from './snapshot.js';
import {queueEventFile} from './files.js';
import {randomUUID} from 'node:crypto';import {transaction} from '../platform/db.js';import {DomainError} from '../platform/types.js';import type {Repository} from '../information-ingestion/processing/repository.js';import {candidate,processing,permission,guard,candidateGuard,aggregate,eventAccess,type DB} from './store.js';import {digest,type FullCandidate,type Evidence,type IdentityProposal,type RelationsProposal} from './contracts.js';import type {IncrementPlan} from './increments.js';import type {RatingPlan} from './ratings.js';import type {DefinitionSnapshot} from './definitions.js';import {readDefinitions} from './definitions.js';
export interface CommitReceipt {commit_key:string;candidate_id:string;proposal_generation:number;result_kind:string;effects:Record<string,unknown>[];review_decision_id?:string}
interface CommitProposal {schema_version:string;candidate_id:string;processing_id:string;generation:number;commit_key:string;version_id:string;payload:FullCandidate;identity:{id:string;decision:'NEW'|'REUSE';event_id:string|null;expected_digest:string|null;retrieval_snapshot_id:string;review_id:string};relations:RelationsProposal;definitions:DefinitionSnapshot;increment:IncrementPlan;rating:RatingPlan|null;step_digest:string}
export class EventCommit {
 constructor(public repo:Repository){}
 async prepareCommit(id:string,execution:number){
  const c=await candidate(this.repo.db,id),p=await processing(this.repo.db,c.processing_id);guard(p);await candidateGuard(this.repo.db,c,execution);await permission(this.repo,this.repo.db,p.version_id,p.actor,'event_submit',true);
  if(c.commit_artifact_id)return {artifact_id:c.commit_artifact_id,digest:c.commit_digest!,commit_key:c.commit_key!};
  const steps=(await this.repo.db.query('SELECT * FROM information.candidate_step_results WHERE candidate_id=$1 AND generation=$2 ORDER BY step_no',[id,c.proposal_generation])).rows;if(steps.length!==4||steps.some(s=>!['succeeded','skipped'].includes(s.state)))throw new DomainError('COMMIT_NOT_ELIGIBLE',409);
  const identity=(await this.repo.db.query('SELECT * FROM information.identity_decisions WHERE candidate_id=$1 AND generation=$2',[id,c.proposal_generation])).rows[0];if(!identity||identity.decision==='UNRESOLVED')throw new DomainError('IDENTITY_REVIEW_REQUIRED',409);
  const third=steps.find(s=>s.step_no===3)!,fourth=steps.find(s=>s.step_no===4)!,fifth=steps.find(s=>s.step_no===5)!;
  const proposal:CommitProposal={schema_version:'riskhot.event-commit.v2',candidate_id:id,processing_id:p.id,generation:Number(c.proposal_generation),commit_key:randomUUID(),version_id:p.version_id,payload:c.payload,identity,relations:third.result,definitions:third.context.definitions,increment:fourth.result,rating:fifth.state==='skipped'?null:fifth.result,step_digest:digest(steps.map(s=>({step:s.step_no,input:s.input_digest,result:s.result,state:s.state})))};
  if(await currentModel(this.repo.db)){const ref=proposal as unknown as Record<string,unknown>;delete ref.processing_id;delete ref.version_id;ref.schema_version='riskhot.event-commit.v3';ref.material_id=p.id;}
  const artifact=await this.repo.putJson(proposal,'event-commit-proposal'),hash=digest(proposal);
  await transaction(this.repo.db,async tx=>{await permission(this.repo,tx,p.version_id,p.actor,'event_submit',true);await processing(tx,p.id,true);const current=await candidate(tx,id,true);guard(await processing(tx,p.id));await candidateGuard(tx,current,execution);if(current.proposal_generation!==c.proposal_generation)throw new DomainError('STALE_PROPOSAL',409);if(current.commit_artifact_id)return;await tx.query("UPDATE information.event_candidates SET commit_artifact_id=COALESCE(commit_artifact_id,$2),commit_digest=COALESCE(commit_digest,$3),commit_key=COALESCE(commit_key,$4),status='review',reason_code='COMMIT_REVIEW_REQUIRED',resume_step=6 WHERE id=$1",[id,artifact,hash,proposal.commit_key]);await queueEventFile(tx,p.id,`events/candidates/${id}/generations/${c.proposal_generation}/commit.json`,proposal);await aggregate(tx,p.id);});
  const current=await candidate(this.repo.db,id);return {artifact_id:current.commit_artifact_id!,digest:current.commit_digest!,commit_key:current.commit_key!};
 }
 async commitCandidate(id:string,execution:number,key:string):Promise<CommitReceipt>{
  const pre=await candidate(this.repo.db,id),parent=await processing(this.repo.db,pre.processing_id);
  const packet=pre.commit_artifact_id?await this.repo.json<CommitProposal>(pre.commit_artifact_id):null;
  return transaction(this.repo.db,async tx=>{await permission(this.repo,tx,parent.version_id,parent.actor,'event_submit',true);const p=await processing(tx,parent.id,true),c=await candidate(tx,id,true);
   if(['completed','dismissed'].includes(c.status))return c.saved_result_refs as CommitReceipt;
   const invalid=(await tx.query("SELECT reason_code FROM information.candidate_step_results WHERE candidate_id=$1 AND reason_details->>'commit_key'=$2",[id,key])).rows[0];if(invalid)return {commit_key:key,candidate_id:id,proposal_generation:Number(c.proposal_generation),result_kind:invalid.reason_code,effects:[]};
   guard(p);await candidateGuard(tx,c,execution);if(!packet||packet.schema_version!==(await currentModel(tx)?'riskhot.event-commit.v3':'riskhot.event-commit.v2')||c.commit_key!==key||c.commit_digest!==digest(packet)||Number(c.proposal_generation)!==packet.generation)throw new DomainError('STALE_PROPOSAL',409);
   const rows=(await tx.query('SELECT * FROM information.candidate_step_results WHERE candidate_id=$1 AND generation=$2 ORDER BY step_no',[id,c.proposal_generation])).rows;
   if(rows.length!==4||rows.some(s=>!['succeeded','skipped'].includes(s.state))||digest(rows.map(s=>({step:s.step_no,input:s.input_digest,result:s.result,state:s.state})))!==packet.step_digest)throw new DomainError('COMMIT_NOT_ELIGIBLE',409);
   const approval=(await tx.query("SELECT * FROM platform.review_decisions WHERE candidate_id=$1 AND generation=$2 AND scope='commit' AND decision='APPROVE' AND proposal_digest=$3 ORDER BY created_at DESC LIMIT 1",[id,c.proposal_generation,c.commit_digest])).rows[0];if(!approval)throw new DomainError('COMMIT_REVIEW_REQUIRED',409);
   await permission(this.repo,tx,p.version_id,approval.actor,'event_commit',true);
   const identityApproval=(await tx.query("SELECT r.* FROM platform.review_decisions r JOIN information.identity_decisions d ON d.review_id=r.id WHERE d.id=$1 AND d.candidate_id=$2 AND d.generation=$3",[packet.identity.id,id,c.proposal_generation])).rows[0];if(!identityApproval)throw new DomainError('IDENTITY_REVIEW_REQUIRED',409);await permission(this.repo,tx,p.version_id,identityApproval.actor,'event_review',true);
   if(packet.relations.unresolved_issues.length){
    const basis=await new Reviews(this.repo).basis(id,'relations',tx);
    const review=(await tx.query("SELECT * FROM platform.review_decisions WHERE candidate_id=$1 AND generation=$2 AND scope='relations' AND decision='APPROVE' AND proposal_digest=$3 ORDER BY created_at DESC LIMIT 1",[id,c.proposal_generation,basis])).rows[0];
    if(!review)throw new DomainError('RELATION_REVIEW_REQUIRED',409);
    await permission(this.repo,tx,p.version_id,review.actor,'event_review',true);
    if(packet.identity.event_id)await eventAccess(this.repo,tx,packet.identity.event_id,review.actor);
   }
   const catalog=(await tx.query("SELECT * FROM information.event_identity_catalog WHERE scope_key='l0-event-catalog' FOR UPDATE")).rows[0];if(!catalog)throw new DomainError('IDENTITY_CATALOG_REQUIRED',503);
   const snap=(await tx.query('SELECT * FROM information.event_identity_snapshots WHERE id=$1 AND candidate_id=$2 AND generation=$3',[packet.identity.retrieval_snapshot_id,id,c.proposal_generation])).rows[0];const permissionEpoch=(await tx.query('SELECT epoch FROM platform.permission_epochs WHERE id')).rows[0].epoch;
   if(!snap||snap.permission_epoch!==permissionEpoch||(packet.identity.decision==='NEW'&&(snap.catalog_epoch!==catalog.catalog_epoch||snap.coverage_status!=='complete'||snap.retrieval_truncated)))return this.invalidate(tx,c.id,p.id,c.proposal_generation,key,'IDENTITY_SNAPSHOT_STALE');
   let event=packet.identity.event_id?(await tx.query('SELECT * FROM information.event WHERE id=$1 FOR UPDATE',[packet.identity.event_id])).rows[0]:null;
   if(packet.identity.decision==='REUSE'&&(!event||await eventDigest(tx,event.id)!==packet.identity.expected_digest))return this.invalidate(tx,c.id,p.id,c.proposal_generation,key,'EVENT_CONTEXT_CHANGED');
   if(packet.identity.event_id){await eventAccess(this.repo,tx,packet.identity.event_id,p.actor);await eventAccess(this.repo,tx,packet.identity.event_id,approval.actor);await eventAccess(this.repo,tx,packet.identity.event_id,identityApproval.actor);}
   let currentDefinitions:DefinitionSnapshot;try{currentDefinitions=await new TargetIdentity(this.repo).definitions(id,await readDefinitions(this.repo,p.event_options.definition_ref,tx),tx);}catch(error){if(error instanceof DomainError&&error.code==='TARGET_BASIS_CHANGED')return this.invalidate(tx,c.id,p.id,c.proposal_generation,key,'TARGET_BASIS_CHANGED');throw error;}if(currentDefinitions.digest!==packet.definitions.digest)throw new DomainError('DEFINITION_INVALID',409);
   const evidence:Evidence[]=[];function collect(o:unknown){if(Array.isArray(o)){o.forEach(collect);return;}if(o&&typeof o==='object'){if('quote'in o)evidence.push(o as Evidence);else Object.values(o).forEach(collect);}}collect([packet.payload,packet.relations,packet.increment,packet.rating]);
   if(await currentModel(tx)){const material=(await tx.query<CurrentMaterial>('SELECT * FROM infomation.ingestion_material WHERE id=$1 FOR SHARE',[p.id])).rows[0]!;for(const ref of evidence)assertCurrentEvidence(material,ref as unknown as MaterialEvidence);}
   else {const material=(await tx.query('SELECT material_id FROM information.material_versions WHERE id=$1',[p.version_id])).rows[0];for(const e of evidence){const segment=(await tx.query('SELECT text FROM information.material_segments WHERE id=$1 AND version_id=$2',[e.segment_id,e.information_version_id])).rows[0];if(e.information_version_id!==p.version_id||!segment||e.start_cp<0||e.end_cp>Array.from(segment.text).length||e.end_cp<=e.start_cp||Array.from(segment.text).slice(e.start_cp,e.end_cp).join('')!==e.quote)throw new DomainError('EVIDENCE_MISMATCH',409);}}

   const isNew=packet.identity.decision==='NEW',eventId=event?.id??randomUUID(),changeKinds:string[]=[];
   const fact=await readFact(tx,id);
   const before=event?await eventSnapshot(tx,eventId):null;
   const existingBinding=(await tx.query('SELECT event_id FROM information.event_fact WHERE fact_id=$1',[fact.id])).rows[0];
   if(existingBinding&&existingBinding.event_id!==eventId)throw new DomainError('FACT_ALREADY_ASSIGNED',409);
   const duplicate=packet.increment.classification==='DUPLICATE';
   if(duplicate&&!existingBinding)throw new DomainError('DUPLICATE_FACT_UNMATCHED',409);
   const current=packet.increment.current_event;
   if(isNew){
    if(!current?.subject?.trim()||!current.action?.trim())throw new DomainError('EVENT_IDENTITY_REQUIRED',409);
    await tx.query('INSERT INTO information.event(id,title,description,subject,action,event_status,event_time) VALUES($1,$2,$3,$4,$5,$6,$7)',[eventId,current.title,current.description,current.subject,current.action,current.event_status,current.event_time]);changeKinds.push('event_created');
   }else if(current){
    const updated=await tx.query('UPDATE information.event SET title=$2,description=$3,subject=$4,action=$5,event_status=$6,event_time=$7,updated_at=now() WHERE id=$1 AND (title,description,subject,action,event_status,event_time) IS DISTINCT FROM ($2,$3,$4,$5,$6,$7)',[eventId,current.title,current.description,current.subject,current.action,current.event_status,current.event_time]);
    if(updated.rowCount)changeKinds.push('event_updated');
   }
   if(!duplicate){
    await addFactEvidence(tx,fact.id,evidence);
    const role=({NEW_EVENT:'initial',EVENT_PROGRESS:'progress',MATERIAL_ADDITION:'supplement',CORRECTION:'correction',SOURCE_ADDITION:'corroboration'} as Record<string,string>)[packet.increment.classification];
    if(!role)throw new DomainError('INCREMENT_REVIEW_REQUIRED',409);
    const attached=await tx.query('INSERT INTO information.event_fact(event_id,fact_id,relation_role,relation_note) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[eventId,fact.id,role,packet.increment.reason]);
    if(attached.rowCount&&!isNew)changeKinds.push(role==='corroboration'?'event_source_attached':'event_updated');
   }
   const definition=async(kind:'target'|'variable',id:string,version:string)=>{
    const d=packet.definitions[kind==='target'?'targets':'variables'].find(d=>d.id===id&&d.version===version&&d.status==='active');
    if(!d)throw new DomainError('DEFINITION_INVALID');
    const inserted=await tx.query('INSERT INTO information.definition_snapshots(kind,definition_id,definition_version,payload,digest) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id',[kind,id,version,d,digest(d)]);
    const sid=inserted.rows[0]?.id??(await tx.query('SELECT id FROM information.definition_snapshots WHERE kind=$1 AND definition_id=$2 AND definition_version=$3 AND digest=$4',[kind,id,version,digest(d)])).rows[0]?.id;
    if(!sid)throw new DomainError('DEFINITION_VERSION_CONFLICT');return sid;
   };
   if(duplicate||packet.increment.classification==='SOURCE_ADDITION'){
    for(const t of packet.relations.targets)if(!before?.targets.some(x=>x.target_id===t.target_id&&x.relation_note===t.relation_note&&before.definitions.some(d=>d.id===x.definition_snapshot_id&&d.definition_version===t.definition_version)))throw new DomainError('INCREMENT_RELATIONS_CONFLICT',409);
    for(const v of packet.relations.variables)if(!before?.variables.some(x=>x.target_id===v.target_id&&x.variable_id===v.variable_id&&x.description===v.description&&x.relation_type===v.relation_type&&x.change_direction===v.change_direction&&x.impact_status===v.impact_status&&before.definitions.some(d=>d.id===x.definition_snapshot_id&&d.definition_version===v.definition_version)))throw new DomainError('INCREMENT_RELATIONS_CONFLICT',409);
   }
   if(!duplicate){
    for(const t of packet.relations.targets){
     const sid=await definition('target',t.target_id,t.definition_version);
     await tx.query('INSERT INTO information.event_target(event_id,target_id,relation_note) VALUES($1,$2,$3) ON CONFLICT(event_id,target_id) DO UPDATE SET relation_note=EXCLUDED.relation_note,updated_at=now() WHERE event_target.relation_note IS DISTINCT FROM EXCLUDED.relation_note',[eventId,t.target_id,t.relation_note]);
     await tx.query('INSERT INTO information.event_target_definition VALUES($1,$2,$3) ON CONFLICT(event_id,target_id) DO UPDATE SET definition_snapshot_id=EXCLUDED.definition_snapshot_id',[eventId,t.target_id,sid]);
     await tx.query('INSERT INTO information.event_target_fact VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[eventId,t.target_id,fact.id]);
    }
    for(const v of packet.relations.variables){
     const sid=await definition('variable',v.variable_id,v.definition_version);
     await tx.query('INSERT INTO information.event_target_variable(event_id,target_id,variable_id,relation_type,change_direction,impact_status,description) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(event_id,target_id,variable_id) DO UPDATE SET relation_type=EXCLUDED.relation_type,change_direction=EXCLUDED.change_direction,impact_status=EXCLUDED.impact_status,description=EXCLUDED.description,updated_at=now()',[eventId,v.target_id,v.variable_id,v.relation_type,v.change_direction,v.impact_status,v.description]);
     await tx.query('INSERT INTO information.event_variable_definition VALUES($1,$2,$3,$4) ON CONFLICT(event_id,target_id,variable_id) DO UPDATE SET definition_snapshot_id=EXCLUDED.definition_snapshot_id',[eventId,v.target_id,v.variable_id,sid]);
     await tx.query('INSERT INTO information.event_variable_fact VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[eventId,v.target_id,v.variable_id,fact.id]);
    }
   }
   const ratingIds:string[]=[];
   if(packet.rating&&!duplicate&&packet.increment.needs_rating){
    const r=packet.rating,rid=randomUUID();ratingIds.push(rid);
    await tx.query('INSERT INTO information.event_rating(id,assessment_scope,research_horizon,method_version,m,dimension_scores,financial_usages,reasoning_summary,limitations,rating_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[rid,r.assessment_scope,r.research_horizon,r.method_version,r.m,JSON.stringify(r.dimensions),JSON.stringify(r.financial_usages),r.reasoning_summary,JSON.stringify(r.limitations),r.rating_status]);
    await tx.query('INSERT INTO information.event_rating_relation VALUES($1,$2)',[rid,eventId]);await tx.query('INSERT INTO information.event_rating_fact VALUES($1,$2,$3)',[eventId,rid,fact.id]);changeKinds.push('event_rating_updated');
   }
   let effects:Record<string,unknown>[]=[];
   const after=await eventSnapshot(tx,eventId);
   if(!isNew&&digest(before)!==digest(after)&&!changeKinds.length)changeKinds.push('event_source_attached');
   if(changeKinds.length){
    if(!isNew)await tx.query('UPDATE information.event SET updated_at=now() WHERE id=$1',[eventId]);
    const snapshot=await eventSnapshot(tx,eventId);
    await tx.query("UPDATE information.event_identity_catalog SET catalog_epoch=catalog_epoch+1 WHERE scope_key='l0-event-catalog'");
    const payload={schema_version:'riskhot.event-commit.v2',event_id:eventId,commit_key:key,change_kinds:[...new Set(changeKinds)],fact_ids:[fact.id],content:snapshot};
    const predecessor=(await tx.query("SELECT m.id FROM platform.messages m WHERE m.event_id=$1 AND m.message_type='event.facts.committed.v2' AND NOT EXISTS(SELECT 1 FROM platform.event_message_dependencies d WHERE d.predecessor_id=m.id)",[eventId])).rows[0]?.id??null;
    const message=(await tx.query("INSERT INTO platform.messages(message_type,event_id,payload,payload_digest) VALUES('event.facts.committed.v2',$1,$2,$3) RETURNING id",[eventId,payload,digest(payload)])).rows[0];
    await tx.query('INSERT INTO platform.event_message_dependencies VALUES($1,$2)',[message.id,predecessor]);
    await tx.query('INSERT INTO platform.message_deliveries(message_id,consumer_id) SELECT $1,id FROM platform.event_consumers WHERE enabled',[message.id]);
    effects=[{event_id:eventId,fact_id:fact.id,message_id:message.id,rating_ids:ratingIds}];
    await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'event-facts-committed',$2,$3)",[approval.actor,eventId,{commit_key:key,candidate_id:id,fact_id:fact.id,classification:packet.increment.classification,reason:packet.increment.reason,before,after:snapshot}]);
   }
   if(isNew)await tx.query('UPDATE information.identity_decisions SET consumed_event_id=$2 WHERE id=$1 AND consumed_event_id IS NULL',[packet.identity.id,eventId]);
   const receipt:CommitReceipt={commit_key:key,candidate_id:id,proposal_generation:Number(c.proposal_generation),result_kind:effects.length?'COMMITTED':'NO_CHANGE',effects,review_decision_id:approval.id};await tx.query('INSERT INTO platform.commit_receipts(commit_key,candidate_id,proposal_generation,result_kind,effects,review_decision_id) VALUES($1,$2,$3,$4,$5,$6)',[key,id,c.proposal_generation,receipt.result_kind,JSON.stringify(effects),approval.id]);await tx.query("UPDATE information.event_candidates SET status='completed',resume_step=NULL,reason_code=NULL,saved_result_refs=$2 WHERE id=$1",[id,receipt]);await aggregate(tx,p.id);return receipt;
  });
 }
 private async invalidate(tx:DB,id:string,processingId:string,generation:string,key:string,reason:string):Promise<CommitReceipt>{await tx.query("UPDATE information.candidate_step_results SET state='superseded',reason_code=$3,reason_details=$4 WHERE candidate_id=$1 AND generation=$2",[id,generation,reason,{commit_key:key}]);await tx.query("UPDATE information.event_candidates SET proposal_generation=proposal_generation+1,execution_generation=execution_generation+1,status='review',resume_step=2,reason_code=$2,commit_key=NULL,commit_artifact_id=NULL,commit_digest=NULL WHERE id=$1",[id,reason]);await aggregate(tx,processingId);return {commit_key:key,candidate_id:id,proposal_generation:Number(generation),result_kind:reason,effects:[]};}
}
