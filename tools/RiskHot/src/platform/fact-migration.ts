import {readFile} from 'node:fs/promises';
import type {Pool} from 'pg';
import {transaction} from './db.js';
import {DomainError} from './types.js';
import {legacyEventTime} from '../event-management/time.js';
import {eventSnapshot} from '../event-management/snapshot.js';
import {digest} from '../event-management/contracts.js';
import {randomUUID} from 'node:crypto';
import {saveFact,addFactEvidence} from '../event-management/facts.js';
import {convertLegacyCandidate} from '../event-management/legacy-candidate.js';
import {aggregate} from '../event-management/store.js';

const oldTables=['events','event_sources','event_evidence','event_targets','event_target_variables','event_updates','event_update_supersedes','event_ratings','event_revisions','event_target_evidence','event_variable_evidence','event_update_evidence','event_rating_evidence'];
export async function applyFactMigration(db:Pool){
 await transaction(db,async tx=>{
  await tx.query("SELECT pg_advisory_xact_lock(hashtext('riskhot-schema-4'))");
  if((await tx.query('SELECT 1 FROM platform.schema_versions WHERE version=4')).rowCount)return;
  if((await tx.query("SELECT 1 FROM platform.model_attempts WHERE owner_kind='event' AND status='calling'")).rowCount)throw new DomainError('MIGRATION_MODEL_CALL_ACTIVE',409);
  await tx.query(await readFile(new URL('../db/004-facts.sql',import.meta.url),'utf8'));
  await tx.query('CREATE SCHEMA f02_legacy');
  await tx.query('CREATE TABLE f02_legacy.candidate_payloads AS SELECT id,payload,proposal_generation,saved_result_refs FROM information.event_candidates');
  const candidates=(await tx.query('SELECT c.*,p.version_id,p.processing_scope FROM information.event_candidates c JOIN information.processing_runs p ON p.id=c.processing_id ORDER BY c.id')).rows;
  for(const c of candidates){
   const payload=convertLegacyCandidate(c.payload,c.version_id);
   if(!payload.evidence_refs.length)throw new DomainError('MIGRATION_CANDIDATE_EVIDENCE_REQUIRED',409);
   await saveFact(tx,c.id,payload);
   if(c.processing_scope==='FULL_EVENT')await tx.query('UPDATE information.event_candidates SET payload=$2 WHERE id=$1',[c.id,payload]);
  }
  for(const e of (await tx.query('SELECT * FROM information.events')).rows){
   if(!e.subject_name?.trim()||!e.action_code?.trim())throw new DomainError('MIGRATION_EVENT_IDENTITY_REQUIRED',409);
   await tx.query('INSERT INTO information.event(id,title,description,subject,action,event_status,event_time,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[e.id,e.title,e.description,e.subject_name,e.action_code,e.event_status,legacyEventTime(e.event_time_value,e.action_code),e.created_at,e.updated_at]);
   const bindings=(await tx.query("SELECT DISTINCT cf.fact_id FROM information.candidate_fact cf JOIN platform.commit_receipts r ON r.candidate_id=cf.candidate_id CROSS JOIN LATERAL jsonb_array_elements(r.effects) effect WHERE effect->>'event_id'=$1",[e.id])).rows;
   if(!bindings.length)throw new DomainError('MIGRATION_EVENT_FACT_UNRESOLVED',409);
   for(const f of bindings)await tx.query("INSERT INTO information.event_fact(event_id,fact_id,relation_role,relation_note) VALUES($1,$2,'initial','依据已批准的原提交迁移；原处理决定保留')",[e.id,f.fact_id]);
   for(const evidence of (await tx.query('SELECT * FROM information.event_evidence WHERE event_id=$1',[e.id])).rows){
    if((await tx.query('SELECT 1 FROM information.fact_evidence fe JOIN information.event_fact ef ON ef.fact_id=fe.fact_id WHERE ef.event_id=$1 AND fe.information_version_id=$2 AND fe.segment_id=$3 AND fe.start_cp=$4 AND fe.end_cp=$5',[e.id,evidence.version_id,evidence.segment_id,evidence.start_cp,evidence.end_cp])).rowCount)continue;
    const possible=(await tx.query('SELECT DISTINCT fe.fact_id FROM information.fact_evidence fe JOIN information.event_fact ef ON ef.fact_id=fe.fact_id WHERE ef.event_id=$1 AND fe.information_version_id=$2',[e.id,evidence.version_id])).rows;
    if(possible.length!==1)throw new DomainError('MIGRATION_EVIDENCE_UNRESOLVED',409);
    await addFactEvidence(tx,possible[0].fact_id,[{information_version_id:evidence.version_id,segment_id:evidence.segment_id,start_cp:evidence.start_cp,end_cp:evidence.end_cp,quote:evidence.quote}]);
   }
   // Every previously attached source must still be traceable through a candidate.
   const lost=(await tx.query('SELECT 1 FROM information.event_sources es WHERE es.event_id=$1 AND NOT EXISTS(SELECT 1 FROM information.event_fact ef JOIN information.fact_information fi ON fi.fact_id=ef.fact_id WHERE ef.event_id=es.event_id AND fi.information_id=es.information_id)',[e.id])).rowCount;
   if(lost)throw new DomainError('MIGRATION_SOURCE_UNRESOLVED',409);
  }
  await tx.query(`INSERT INTO information.event_target(event_id,target_id,relation_note) SELECT event_id,target_id,relation_note FROM information.event_targets;
   INSERT INTO information.event_target_definition SELECT event_id,target_id,definition_snapshot_id FROM information.event_targets;
   INSERT INTO information.event_target_variable(event_id,target_id,variable_id,relation_type,change_direction,impact_status,description) SELECT event_id,target_id,variable_id,relation_type,change_direction,impact_status,'' FROM information.event_target_variables;
   INSERT INTO information.event_variable_definition SELECT event_id,target_id,variable_id,definition_snapshot_id FROM information.event_target_variables;
   INSERT INTO information.event_rating(id,assessment_scope,research_horizon,method_version,m,dimension_scores,financial_usages,reasoning_summary,limitations,rating_status) SELECT id,assessment_scope,research_horizon,method_version,m,dimension_scores,financial_usages,reasoning_summary,limitations,rating_status FROM information.event_ratings;
   INSERT INTO information.event_rating_relation SELECT id,event_id FROM information.event_ratings;`);
  for(const relation of (await tx.query('SELECT * FROM information.event_target_variable')).rows){
   const descriptions=(await tx.query("SELECT v->>'description' AS description FROM information.candidate_step_results s JOIN information.candidate_fact cf ON cf.candidate_id=s.candidate_id JOIN information.event_fact ef ON ef.fact_id=cf.fact_id CROSS JOIN LATERAL jsonb_array_elements(s.result->'variables') v WHERE ef.event_id=$1 AND s.step_no=3 AND s.state='succeeded' AND v->>'target_id'=$2 AND v->>'variable_id'=$3 ORDER BY s.generation DESC",[relation.event_id,relation.target_id,relation.variable_id])).rows;
   if(!descriptions[0]?.description?.trim())throw new DomainError('MIGRATION_RELATION_DESCRIPTION_REQUIRED',409);
   await tx.query('UPDATE information.event_target_variable SET description=$4 WHERE event_id=$1 AND target_id=$2 AND variable_id=$3',[relation.event_id,relation.target_id,relation.variable_id,descriptions[0].description]);
  }
  for(const [old,target,cols] of [['event_target_evidence','event_target_fact','event_id,target_id'],['event_variable_evidence','event_variable_fact','event_id,target_id,variable_id'],['event_rating_evidence','event_rating_fact','event_id,rating_id']]){
   await tx.query(`INSERT INTO information.${target}(${cols},fact_id) SELECT DISTINCT ${cols!.split(',').map(c=>'r.'+c).join(',')},fe.fact_id FROM information.${old} r JOIN information.event_evidence oe ON oe.id=r.evidence_id JOIN information.fact_evidence fe ON fe.information_version_id=oe.version_id AND fe.segment_id=oe.segment_id AND fe.start_cp=oe.start_cp AND fe.end_cp=oe.end_cp JOIN information.event_fact ef ON ef.event_id=r.event_id AND ef.fact_id=fe.fact_id ON CONFLICT DO NOTHING`);
  }
  // A text-only rating may have no dimension evidence; its approved candidate is its basis.
  await tx.query(`INSERT INTO information.event_rating_fact(event_id,rating_id,fact_id)
   SELECT DISTINCT rr.event_id,rr.rating_id,cf.fact_id FROM information.event_rating_relation rr JOIN platform.commit_receipts cr ON EXISTS(SELECT 1 FROM jsonb_array_elements(cr.effects) effect WHERE effect->'rating_ids' ? rr.rating_id::text) JOIN information.candidate_fact cf ON cf.candidate_id=cr.candidate_id JOIN information.event_fact ef ON ef.event_id=rr.event_id AND ef.fact_id=cf.fact_id ON CONFLICT DO NOTHING`);
  for(const table of ['identity_decisions','messages','event_consumer_inbox','event_consumer_progress']){
   const schema=table==='identity_decisions'?'information':'platform';
   const constraints=(await tx.query("SELECT conname FROM pg_constraint WHERE conrelid=$1::regclass AND contype='f' AND confrelid IN ('information.events'::regclass,'information.event_revisions'::regclass)",[schema+'.'+table])).rows;
   for(const c of constraints)await tx.query(`ALTER TABLE ${schema}.${table} DROP CONSTRAINT "${c.conname.replaceAll('"','""')}"`);
  }
  await tx.query(`ALTER TABLE information.identity_decisions DROP COLUMN expected_revision, ADD COLUMN expected_digest text;
   ALTER TABLE information.identity_decisions ADD FOREIGN KEY(event_id) REFERENCES information.event(id), ADD FOREIGN KEY(consumed_event_id) REFERENCES information.event(id);
   CREATE TABLE f02_legacy.messages AS SELECT * FROM platform.messages WHERE event_id IS NOT NULL;
   CREATE TABLE f02_legacy.message_deliveries AS SELECT * FROM platform.message_deliveries;
   CREATE TABLE f02_legacy.consumer_inbox AS SELECT * FROM platform.event_consumer_inbox;
   CREATE TABLE f02_legacy.consumer_progress AS SELECT * FROM platform.event_consumer_progress;
   DELETE FROM platform.message_deliveries;
   DELETE FROM platform.event_consumer_inbox;
   DELETE FROM platform.event_consumer_progress;
   ALTER TABLE platform.messages DROP CONSTRAINT event_message_binding;
   DROP INDEX platform.event_revision_message;
   ALTER TABLE platform.messages DROP COLUMN revision_no;
   ALTER TABLE platform.messages ADD FOREIGN KEY(event_id) REFERENCES information.event(id);
   ALTER TABLE platform.event_consumer_inbox DROP COLUMN revision_no;
   ALTER TABLE platform.event_consumer_inbox ADD FOREIGN KEY(event_id) REFERENCES information.event(id);
   ALTER TABLE platform.event_consumer_progress DROP COLUMN revision_no;
   ALTER TABLE platform.event_consumer_progress ADD COLUMN last_message_id uuid REFERENCES platform.messages(id), ADD FOREIGN KEY(event_id) REFERENCES information.event(id);
   ALTER TABLE platform.messages ADD CONSTRAINT event_message_binding CHECK((message_type='information.version.ready.v1' AND version_id IS NOT NULL AND event_id IS NULL) OR (message_type IN ('event.revision.committed.v1','event.facts.committed.v2') AND version_id IS NULL AND event_id IS NOT NULL AND payload IS NOT NULL AND payload_digest IS NOT NULL));
   UPDATE information.candidate_step_results s SET state='superseded' FROM information.event_candidates c WHERE c.id=s.candidate_id AND c.status NOT IN ('completed','dismissed');
   UPDATE information.event_candidates c SET status='review',resume_step=2,reason_code='MODEL_CHANGED_REVIEW_REQUIRED',proposal_generation=proposal_generation+1,execution_generation=execution_generation+1,commit_key=NULL,commit_artifact_id=NULL,commit_digest=NULL FROM information.processing_runs p WHERE p.id=c.processing_id AND p.processing_scope='FULL_EVENT' AND c.status NOT IN ('completed','dismissed');
   UPDATE information.processing_runs SET event_options=jsonb_set(event_options,'{task_manifest_id}','"f02-fact-draft-v2"') WHERE processing_scope='FULL_EVENT';
   UPDATE information.processing_runs SET input_artifact_id=NULL,manifest_artifact_id=NULL,generation=generation+1 WHERE processing_scope='FULL_EVENT' AND extraction_status<>'completed';`);
  for(const p of (await tx.query("SELECT id FROM information.processing_runs WHERE processing_scope='FULL_EVENT' AND extraction_status='completed'")).rows)await aggregate(tx,p.id);
  // Translate already approved current results into an explicit migration baseline.
  // Historical messages/files stay immutable and are never reinterpreted as v2.
  for(const e of (await tx.query('SELECT id FROM information.event ORDER BY id')).rows){
   const content=await eventSnapshot(tx,e.id),key=randomUUID();
   const payload={schema_version:'riskhot.event-commit.v2',event_id:e.id,commit_key:key,change_kinds:['migration_baseline'],fact_ids:content.facts.map(f=>f.id),content,migration:{from_schema:3,authorization:'existing-approved-records'}};
   const m=(await tx.query("INSERT INTO platform.messages(message_type,event_id,payload,payload_digest) VALUES('event.facts.committed.v2',$1,$2,$3) RETURNING id",[e.id,payload,digest(payload)])).rows[0];
   await tx.query('INSERT INTO platform.event_message_dependencies(message_id) VALUES($1)',[m.id]);
   await tx.query('INSERT INTO platform.message_deliveries(message_id,consumer_id) SELECT $1,id FROM platform.event_consumers WHERE enabled',[m.id]);
  }
  for(const table of oldTables)await tx.query(`ALTER TABLE information.${table} SET SCHEMA f02_legacy`);
  await tx.query("INSERT INTO platform.audit_log(actor,action,detail) VALUES('schema-migration','fact-model-migration',$1)",[{schema:4,candidates:candidates.length,archive:'f02_legacy',pending_policy:'reprepare_identity'}]);
  await tx.query('INSERT INTO platform.schema_versions(version) VALUES(4)');
 });
}
