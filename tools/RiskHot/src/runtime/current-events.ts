import {targetObjectSchema} from '../event-management/target-identity-contracts.js';
import {TargetIdentity} from '../event-management/target-identity.js';
import {chooseDisplayTime,displayTimeRank,displaySortValue,timelineSources,type TimelineEvidence} from '../event-management/timeline.js';
import type {FastifyInstance} from 'fastify';
import type {Repository} from '../information-ingestion/processing/repository.js';
import {IngestionRepository} from '../information-ingestion/processing/current-repository.js';
import {EventProcessing} from '../event-management/processing.js';
import {Reviews,resumeToken,type ReviewCommand} from '../event-management/reviews.js';
import {eventAccess} from '../event-management/store.js';
import {eventSnapshot} from '../event-management/snapshot.js';
import {DomainError} from '../platform/types.js';
import type {EventOptions} from '../event-management/store.js';
import {registerCurrentDelivery} from './current-delivery.js';
const key=(headers:Record<string,unknown>)=>{const value=headers['idempotency-key'];if(typeof value!=='string'||!/^\S{1,128}$/.test(value))throw new DomainError('IDEMPOTENCY_KEY_INVALID',400);return value;};
const uuid={type:'string',pattern:'^[a-f0-9-]{36}$'},text={type:'string',minLength:1,maxLength:2000};
const params={type:'object',additionalProperties:false,required:['id'],properties:{id:uuid}};
export function registerCurrentEvents(app:FastifyInstance,repo:Repository){
 registerCurrentDelivery(app,repo);
 const targets=new TargetIdentity(repo);
 app.get('/api/v1/l0/candidates/:id/targets',{schema:{params}},async request=>targets.read((request.params as {id:string}).id,request.actor));
 app.post('/api/v1/l0/candidates/:id/targets/objects',{schema:{params,body:{type:'object',additionalProperties:false,required:['generation','objects'],properties:{generation:{type:'integer',minimum:1},objects:{type:'object',additionalProperties:false,required:['objects','explicit_no_objects','reason'],properties:{objects:{type:'array',maxItems:50,items:targetObjectSchema},explicit_no_objects:{type:'boolean'},reason:text}}}}}},async request=>{const b=request.body as {generation:number;objects:import('../event-management/target-identity.js').ObjectSet};return targets.setObjects((request.params as {id:string}).id,request.actor,b.objects,b.generation,key(request.headers));});
 app.post('/api/v1/l0/candidates/:id/targets/approve',{schema:{params,body:{type:'object',additionalProperties:false,required:['run_id','review_digest','reason'],properties:{run_id:uuid,review_digest:{type:'string',pattern:'^[a-f0-9]{64}$'},reason:text}}}},async request=>{const b=request.body as {run_id:string;review_digest:string;reason:string};return targets.approve((request.params as {id:string}).id,request.actor,b.run_id,b.review_digest,b.reason,key(request.headers));});
 const store=new IngestionRepository(repo),processing=new EventProcessing(repo),reviews=new Reviews(repo);
 app.get('/api/v1/l0/event-settings',async request=>{await repo.authorize(request.actor,'read');return {task_manifest_id:'f02-fact-draft-v2',available_task_manifests:['f02-fact-draft-v2','f02-target-identity-v3'],method_version:'text-draft-v1',definitions:(await repo.db.query("SELECT ref,owner,version FROM information.definition_sets WHERE coverage_status='complete' ORDER BY ref")).rows};});
 app.get('/api/v1/l0/material/:id/candidates',{schema:{params}},async request=>{
  const material=await store.material(request.actor,(request.params as {id:string}).id);
  return {material_id:material.id,version:material.version,content_digest:material.content_digest,extraction_result:material.extraction_result,items:(await repo.db.query('SELECT * FROM information.event_candidates WHERE material_id=$1 AND material_version=$2 AND material_digest=$3 ORDER BY ordinal',[material.id,material.version,material.content_digest])).rows};
 });
 app.post('/api/v1/l0/material/:id/events/start',{schema:{params,body:{type:'object',additionalProperties:false,required:['task_manifest_id','definition_ref','assessment_scope','research_horizon','method_version','reason'],properties:{task_manifest_id:text,definition_ref:text,assessment_scope:{type:'object'},research_horizon:{type:'object'},method_version:{const:'text-draft-v1'},reason:text}}}},async(request,reply)=>reply.code(202).send(await processing.startFullProcessing((request.params as {id:string}).id,request.actor,request.body as EventOptions,key(request.headers))));
 app.get('/api/v1/l0/candidates/:id',{schema:{params}},async request=>{
  const id=(request.params as {id:string}).id;
  const candidate=(await repo.db.query('SELECT * FROM information.event_candidates WHERE id=$1',[id])).rows[0];
  if(!candidate)throw new DomainError('NOT_FOUND',404);await store.material(request.actor,candidate.material_id);
  const bases:Record<string,string|null>={};for(const scope of ['identity','relations','commit','disposition'] as const){try{bases[scope]=await reviews.basis(id,scope);}catch(error){if(!(error instanceof DomainError))throw error;bases[scope]=null;}}
  return {candidate,pending_disposition:Boolean((await repo.db.query("SELECT 1 FROM platform.review_decisions WHERE candidate_id=$1 AND generation=$2 AND scope='disposition'",[id,candidate.proposal_generation])).rowCount),steps:(await repo.db.query('SELECT step_no,generation,state,result,reason_code FROM information.candidate_step_results WHERE candidate_id=$1 AND generation=$2 ORDER BY step_no',[id,candidate.proposal_generation])).rows,review_bases:bases,resume_token:resumeToken({...candidate,processing_id:candidate.material_id})};
 });
 app.post('/api/v1/l0/candidates/:id/reviews',{schema:{params,body:{type:'object',additionalProperties:false,required:['scope','proposal_generation','proposal_digest','decision','reason'],properties:{scope:{enum:['identity','relations','commit','disposition']},proposal_generation:{type:'integer',minimum:1},proposal_digest:{type:'string',pattern:'^[a-f0-9]{64}$'},decision:text,reason:text,event_id:{anyOf:[uuid,{type:'null'}]}}}}},async(request,reply)=>reply.code(202).send(await reviews.recordReview((request.params as {id:string}).id,request.actor,request.body as ReviewCommand,key(request.headers))));
 app.post('/api/v1/l0/candidates/:id/retry',{schema:{params,body:{type:'object',additionalProperties:false,required:['resume_token','reason','open_budget'],properties:{resume_token:text,reason:text,open_budget:{type:'boolean'}}}}},async(request,reply)=>{const body=request.body as {resume_token:string;reason:string;open_budget:boolean};return reply.code(202).send(await reviews.resumeCandidate((request.params as {id:string}).id,request.actor,body.resume_token,body.reason,key(request.headers),body.open_budget));});
 app.post('/api/v1/l0/material/:id/extraction/retry',{schema:{params,body:{type:'object',additionalProperties:false,required:['version','content_digest','reason','open_budget'],properties:{version:{type:'integer',minimum:1},content_digest:{type:'string',pattern:'^[a-f0-9]{64}$'},reason:text,open_budget:{type:'boolean'}}}}},async(request,reply)=>{
  const id=(request.params as {id:string}).id,body=request.body as {version:number;content_digest:string;reason:string;open_budget:boolean};
  const result=await repo.action(request.actor,'material-extraction-retry',key(request.headers),{id,...body},async tx=>{await store.assertBasis(tx,request.actor,{material_id:id,version:body.version,content_digest:body.content_digest},'retry');},async tx=>{
   const material=(await tx.query('SELECT * FROM infomation.ingestion_material WHERE id=$1 FOR UPDATE',[id])).rows[0];if(material.extraction_result?.candidate_count!==undefined)return {material_id:id,status:'completed'};
   if(!['recoverable','review'].includes(material.extraction_result?.status??''))throw new DomainError('EXTRACTION_NOT_RECOVERABLE',409);
   if(material.extraction_result.status==='review')await store.assertBasis(tx,request.actor,{material_id:id,version:body.version,content_digest:body.content_digest},'model_review');
   const budget=(await tx.query("SELECT * FROM platform.model_budget_windows WHERE owner_kind='material' AND owner_id=$1 AND task_id='AI-01' AND subject_ref=$2::jsonb ORDER BY generation DESC LIMIT 1 FOR UPDATE",[id,{material_id:id,version:body.version,content_digest:body.content_digest}])).rows[0];const exhausted=budget&&(budget.used>=3||new Date(budget.deadline).getTime()<=Date.now());
   if(exhausted&&!body.open_budget)throw new DomainError('MODEL_BUDGET_EXHAUSTED',409);
   if(body.open_budget){await store.assertBasis(tx,request.actor,{material_id:id,version:body.version,content_digest:body.content_digest},'model_budget');if(!exhausted)throw new DomainError('BUDGET_NOT_EXHAUSTED',409);await tx.query("INSERT INTO platform.model_budget_windows(owner_kind,owner_id,task_id,generation,actor,reason,subject_ref) SELECT 'material',$1,'AI-01',COALESCE(MAX(generation),0)+1,$2,$3,$4 FROM platform.model_budget_windows WHERE owner_kind='material' AND owner_id=$1 AND task_id='AI-01'",[id,request.actor,body.reason,{material_id:id,version:body.version,content_digest:body.content_digest}]);}
   const next=Number((await tx.query("SELECT COALESCE(MAX(generation),0)+1 AS n FROM platform.execution_intents WHERE kind='material-extract' AND owner_id=$1",[id])).rows[0].n);
   await tx.query("INSERT INTO platform.execution_intents(kind,owner_id,generation,workflow_id,input) VALUES('material-extract',$1,$2,$3,$4)",[id,next,`material/${id}/retry/${next}`,{material_id:id,version:body.version,content_digest:body.content_digest,actor:request.actor}]);
   await tx.query("UPDATE infomation.ingestion_material SET extraction_result=jsonb_build_object('version',version,'content_digest',content_digest,'status','pending') WHERE id=$1",[id]);
   await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'material-extraction-retry',$2,$3)",[request.actor,id,body]);return {material_id:id,status:'accepted'};
  });return reply.code(202).send(result);
 });
 app.get('/api/v1/events',async request=>{
  await repo.authorize(request.actor,'read');
  const items=(await repo.db.query("SELECT e.*,COALESCE((SELECT jsonb_agg(DISTINCT jsonb_build_object('material_id',m.id,'version_id',m.id::text||':'||fe.material_version::text,'source_id',s.id,'catalog_key',s.catalog_key,'name',s.name,'relation_created_at',fi.created_at,'first_collected_at',CASE WHEN fe.material_version=m.version AND fe.material_digest=m.content_digest THEN m.collected_at END,'published_at_text',CASE WHEN fe.material_version=m.version AND fe.material_digest=m.content_digest THEN m.published_at_text END)) FROM information.event_fact ef JOIN information.fact_information fi ON fi.fact_id=ef.fact_id JOIN information.fact_evidence fe ON fe.fact_id=fi.fact_id AND fe.information_id=fi.information_id JOIN infomation.ingestion_material m ON m.id=fi.information_id JOIN m1.sources s ON s.id=m.source_id WHERE ef.event_id=e.id),'[]') AS evidence_basis FROM information.event e WHERE NOT EXISTS(SELECT 1 FROM information.event_fact ef JOIN information.fact_information fi ON fi.fact_id=ef.fact_id JOIN infomation.ingestion_material m ON m.id=fi.information_id JOIN m1.sources s ON s.id=m.source_id JOIN platform.actors a ON a.subject=$1 WHERE ef.event_id=e.id AND NOT ('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys))) ORDER BY e.updated_at DESC,e.id",[request.actor])).rows;
  const query=request.query as {offset?:string;limit?:string};const offset=Number(query.offset??0),limit=Number(query.limit??30);
  if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw new DomainError('PAGINATION_INVALID',400);
  const projected=items.map(item=>{const basis=chooseDisplayTime(item.evidence_basis as TimelineEvidence[]);const {time_version_id,...time}=basis;const {evidence_basis,...event}=item;return {...event,...time,sources:timelineSources(item.evidence_basis,basis.time_source_id)};});
  projected.sort((a,b)=>displayTimeRank(a)-displayTimeRank(b)||displaySortValue(b)-displaySortValue(a)||new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime()||a.id.localeCompare(b.id));
  return {items:projected.slice(offset,offset+limit),total:projected.length,offset,limit,next_offset:offset+limit<projected.length?offset+limit:null};
 });
 app.get('/api/v1/events/:id',{schema:{params}},async request=>{const id=(request.params as {id:string}).id;await eventAccess(repo,repo.db,id,request.actor);return eventSnapshot(repo.db,id);});
}
