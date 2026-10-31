import { ingestionSchemaVersion } from '../platform/ingestion-migration.js';
import type {PoolClient,Pool} from 'pg';import {DomainError} from '../platform/types.js';import type {Repository} from '../information-ingestion/processing/repository.js';
export type DB=Pool|PoolClient;
export interface EventOptions {task_manifest_id:string;definition_ref:string;assessment_scope:Record<string,unknown>;research_horizon:Record<string,unknown>;method_version:string;reason:string;model_binding?:import('../information-ingestion/processing/model.js').ModelConfig}
export interface Processing {id:string;version_id:string;generation:string;paused:boolean;actor:string;event_options:EventOptions;extraction_status:string;processing_scope:string;parent_processing_id:string;candidate_count:number|null;result_status:string;input_artifact_id:string|null;manifest_artifact_id:string|null}
export interface CandidateRow {material_id?:string;material_version?:number;material_digest?:string;id:string;processing_id:string;status:string;payload:import('./contracts.js').FullCandidate;proposal_generation:string;execution_generation:string;resume_step:number|null;reason_code:string|null;commit_key:string|null;commit_artifact_id:string|null;commit_digest:string|null;saved_result_refs:unknown}
export async function currentModel(db:DB):Promise<boolean>{return await ingestionSchemaVersion(db)===5;}
export async function materialTable(db:DB):Promise<string>{return await currentModel(db)?'infomation.ingestion_material':'information.materials';}
export async function permission(repo:Repository,db:DB,versionId:string,actor:string,action:string,write=false){
 if(await currentModel(db)){
  await db.query('SELECT platform.lock_permission_epoch()');
  const source=(await db.query('SELECT s.catalog_key,s.state FROM infomation.ingestion_material m CROSS JOIN LATERAL platform.lock_source(m.source_id) s WHERE m.id=$1 FOR SHARE OF m',[versionId])).rows[0];
  if(!source)throw new DomainError('NOT_FOUND',404);
  await repo.authorize(actor,action,source.catalog_key,db);
  if(write&&source.state!=='ACTIVE')throw new DomainError('SOURCE_DISABLED',409);return;
 }
 await db.query('SELECT platform.lock_permission_epoch()');
 const row=(await db.query('SELECT s.catalog_key,s.state FROM information.material_versions v JOIN information.materials m ON m.id=v.material_id JOIN m1.sources s ON s.id=m.source_id WHERE v.id=$1',[versionId])).rows[0];if(!row)throw new DomainError('NOT_FOUND',404);
 await repo.authorize(actor,action,row.catalog_key,db);if(write){const source=(await db.query('SELECT * FROM platform.lock_source((SELECT source_id FROM information.materials WHERE id=(SELECT material_id FROM information.material_versions WHERE id=$1)))',[versionId])).rows[0];row.state=source?.state;}if(write&&row.state!=='ACTIVE')throw new DomainError('SOURCE_DISABLED',409);
}
export async function processing(db:DB,id:string,lock=false):Promise<Processing>{if(await currentModel(db)){
 const row=(await db.query(`SELECT m.id,m.version,m.content_digest,m.extraction_result,c.actor,c.event_options FROM infomation.ingestion_material m JOIN information.event_candidates c ON c.material_id=m.id AND c.material_version=m.version AND c.material_digest=m.content_digest WHERE m.id=$1 ORDER BY c.ordinal LIMIT 1 ${lock?'FOR UPDATE OF m':''}`,[id])).rows[0];
 if(!row)throw new DomainError('MATERIAL_EVENT_CONTEXT_NOT_FOUND',404);
 return {id:row.id,version_id:row.id,generation:String(row.version),paused:false,actor:row.actor,event_options:row.event_options,extraction_status:row.extraction_result?.candidate_count===undefined?'pending':'completed',processing_scope:'FULL_EVENT',parent_processing_id:'',candidate_count:row.extraction_result?.candidate_count??null,result_status:'derived',input_artifact_id:null,manifest_artifact_id:null};
}const p=(await db.query<Processing>(`SELECT * FROM information.processing_runs WHERE id=$1 ${lock?'FOR UPDATE':''}`,[id])).rows[0];if(!p||p.processing_scope!=='FULL_EVENT')throw new DomainError('EVENT_PROCESSING_NOT_FOUND',404);return p;}
export async function candidate(db:DB,id:string,lock=false):Promise<CandidateRow>{if(await currentModel(db)){
 const row=(await db.query(`SELECT c.*,c.material_id AS processing_id,m.version AS current_version,m.content_digest AS current_digest FROM information.event_candidates c JOIN infomation.ingestion_material m ON m.id=c.material_id WHERE c.id=$1 ${lock?'FOR UPDATE OF c,m':''}`,[id])).rows[0];
 if(!row)throw new DomainError('NOT_FOUND',404);
 if(row.material_version!==row.current_version||row.material_digest!==row.current_digest)throw new DomainError('MATERIAL_BASIS_CHANGED',409);
 return row as CandidateRow;
}const row=(await db.query<CandidateRow>(`SELECT * FROM information.event_candidates WHERE id=$1 ${lock?'FOR UPDATE':''}`,[id])).rows[0];if(!row)throw new DomainError('NOT_FOUND',404);return row;}
export function guard(p:Processing,generation?:number){if(p.paused||(generation!==undefined&&Number(p.generation)!==generation))throw new DomainError('STALE_EXECUTION',409);}
export async function candidateGuard(db:DB,c:CandidateRow,execution?:number){if(['completed','dismissed'].includes(c.status))throw new DomainError('CANDIDATE_TERMINAL',409);if(execution!==undefined&&Number(c.execution_generation)!==execution)throw new DomainError('STALE_EXECUTION',409);if((await db.query("SELECT 1 FROM platform.review_decisions WHERE candidate_id=$1 AND generation=$2 AND scope='disposition'",[c.id,c.proposal_generation])).rowCount)throw new DomainError('DISPOSITION_PENDING',409);}
export async function aggregate(db:DB,id:string){if(await currentModel(db))return;await db.query(`UPDATE information.processing_runs p SET result_status=CASE WHEN candidate_count=0 THEN 'completed' WHEN NOT EXISTS(SELECT 1 FROM information.event_candidates WHERE processing_id=p.id AND status NOT IN ('completed','dismissed')) THEN 'completed' WHEN EXISTS(SELECT 1 FROM information.event_candidates WHERE processing_id=p.id AND status IN ('completed','dismissed')) THEN 'partial' WHEN EXISTS(SELECT 1 FROM information.event_candidates WHERE processing_id=p.id AND status='review') THEN 'review' WHEN EXISTS(SELECT 1 FROM information.event_candidates WHERE processing_id=p.id AND status='recoverable') THEN 'recoverable' ELSE 'processing' END WHERE id=$1 AND extraction_status='completed'`,[id]);}
export async function enqueue(db:DB,kind:'event-extract'|'candidate',id:string,generation:number){await db.query("INSERT INTO platform.execution_intents(kind,owner_id,generation,workflow_id) VALUES($1::text,$2::uuid,$3::bigint,$1::text||'-'||$2::text||'-'||$3::text) ON CONFLICT(kind,owner_id,generation) DO NOTHING",[kind,id,generation]);}

export async function eventAccess(repo:Repository,db:DB,id:string,actor:string){await repo.authorize(actor,'read',undefined,db);if(!(await db.query('SELECT 1 FROM information.event WHERE id=$1',[id])).rowCount)throw new DomainError('NOT_FOUND',404);if((await db.query(`SELECT 1 FROM information.event_fact es JOIN information.fact_information fi ON fi.fact_id=es.fact_id JOIN ${await materialTable(db)} m ON m.id=fi.information_id JOIN m1.sources s ON s.id=m.source_id JOIN platform.actors a ON a.subject=$2 WHERE es.event_id=$1 AND NOT('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys))`,[id,actor])).rowCount)throw new DomainError('FORBIDDEN',403);}
