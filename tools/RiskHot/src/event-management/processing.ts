import {randomUUID} from 'node:crypto';import {transaction} from '../platform/db.js';import {DomainError} from '../platform/types.js';import type {Repository} from '../information-ingestion/processing/repository.js';import {InformationDelivery} from '../information-ingestion/processing/handoff.js';import {loadTaskPackage} from './task-packages.js';import {validateTaskOutput,digest,type FullCandidate,type ValidationContext} from './contracts.js';import {permission,processing,guard,enqueue,type EventOptions} from './store.js';import {modelConfig,type TaskInput} from '../information-ingestion/processing/model.js';
export class EventProcessing {
 constructor(public repo:Repository){}
 async startFullProcessing(versionId:string,actor:string,options:EventOptions,key:string){
  loadTaskPackage('AI-01',options.task_manifest_id);
  if(!options.reason?.trim()||!options.definition_ref||!Object.keys(options.assessment_scope??{}).length||!Object.keys(options.research_horizon??{}).length||options.method_version!=='text-draft-v1')throw new DomainError('EVENT_CONTEXT_REQUIRED',422);
  const parent=(await this.repo.db.query("SELECT id FROM information.processing_runs WHERE version_id=$1 AND processing_scope='EXTRACTION_ONLY'",[versionId])).rows[0];if(!parent)throw new DomainError('INFORMATION_NOT_RECEIVED',409);
  await new InformationDelivery(this.repo).readAccepted(parent.id);
  return this.repo.action(actor,'event-processing',key,{versionId,options},tx=>permission(this.repo,tx,versionId,actor,'event_submit',true),async tx=>{
   const prior=(await tx.query("SELECT id FROM information.processing_runs WHERE version_id=$1 AND analysis_key='INITIAL'",[versionId])).rows[0];if(prior)return prior;
   const row=(await tx.query("INSERT INTO information.processing_runs(version_id,analysis_key,processing_scope,parent_processing_id,event_options,actor) VALUES($1,'INITIAL','FULL_EVENT',$2,$3,$4) ON CONFLICT(version_id,analysis_key) DO NOTHING RETURNING id",[versionId,parent.id,options,actor])).rows[0]??(await tx.query("SELECT id FROM information.processing_runs WHERE version_id=$1 AND analysis_key='INITIAL'",[versionId])).rows[0];await enqueue(tx,'event-extract',row.id,1);return row;
  });
 }
 async material(processingId:string){const p=await processing(this.repo.db,processingId);return new InformationDelivery(this.repo).readAccepted(p.parent_processing_id);}
 async extractionInput(id:string,generation:number):Promise<TaskInput>{
  const p=await processing(this.repo.db,id);guard(p,generation);await permission(this.repo,this.repo.db,p.version_id,p.actor,'event_submit',true);
  if(p.input_artifact_id)return this.repo.json<TaskInput>(p.input_artifact_id);
  const packet=await this.material(id);const task=loadTaskPackage('AI-01',p.event_options.task_manifest_id);
  const input:TaskInput={version_id:p.version_id,material:packet.material,manifest:{provider:modelConfig(),prompt:task.prompt,task_id:'AI-01',output_schema:task.schema,task_package:task},context:{event_type_dictionary:[],definitions_ref:p.event_options.definition_ref}};
  const artifact=await this.repo.putJson(input,'full-event-input');
  await transaction(this.repo.db,async tx=>{await permission(this.repo,tx,p.version_id,p.actor,'event_submit',true);const current=await processing(tx,id,true);guard(current,generation);await tx.query('UPDATE information.processing_runs SET input_artifact_id=COALESCE(input_artifact_id,$2),manifest_artifact_id=COALESCE(manifest_artifact_id,$3) WHERE id=$1',[id,artifact,await this.repo.putJson(task,'event-task-manifest')]);await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'event-input-verified',$2,$3)",[p.actor,id,{version_id:p.version_id,material_digest:digest(packet.material),delivery_id:packet.delivery_id,generation}]);});
  return this.repo.json<TaskInput>((await this.repo.db.query('SELECT input_artifact_id FROM information.processing_runs WHERE id=$1',[id])).rows[0].input_artifact_id);
 }
 async validationContext(id:string):Promise<ValidationContext>{const packet=await this.material(id);return {version_id:packet.information.version_id,segments:packet.material.segments,event_ids:[],target_ids:[],variable_ids:[]};}
 async acceptExtraction(id:string,generation:number,result:{candidates:FullCandidate[];warnings:string[]}){
  const validation=validateTaskOutput('AI-01',result,await this.validationContext(id));if(!validation.valid)throw new DomainError(validation.errors[0]!,422);
  const artifact=await this.repo.putJson(result,'full-candidate-result');
  await transaction(this.repo.db,async tx=>{const pre=await processing(tx,id);await permission(this.repo,tx,pre.version_id,pre.actor,'event_submit',true);const p=await processing(tx,id,true);guard(p,generation);if(p.extraction_status==='completed')return;
   for(const [ordinal,payload] of result.candidates.entries()){const cid=randomUUID();await tx.query('INSERT INTO information.event_candidates(id,processing_id,ordinal,payload) VALUES($1,$2,$3,$4)',[cid,id,ordinal,payload]);await enqueue(tx,'candidate',cid,1);}
   await tx.query("UPDATE information.processing_runs SET candidate_count=$2,extraction_status='completed',result_status=$3,validated_result_artifact_id=$4,completed_at=CASE WHEN $2=0 THEN now() ELSE NULL END WHERE id=$1",[id,result.candidates.length,result.candidates.length?'processing':'completed',artifact]);
  });
 }
}
