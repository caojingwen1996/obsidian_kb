import type {ExecutionStore} from './execution.js';
import {DomainError} from '../../platform/types.js';

/** Counts persisted results, not attempts or the currently paginated task rows. */
export class TaskResults {
 constructor(private repo:ExecutionStore){}
 async read(actor:string,batchId?:string){
  await this.repo.authorize(actor,'read');
  if(batchId){
   const visible=await this.repo.db.query(`SELECT 1 FROM m1.sources s JOIN platform.actors a ON a.subject=$1
    WHERE ('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys)) AND
    (EXISTS(SELECT 1 FROM platform.task_batch_sources bs WHERE bs.batch_id=$2 AND bs.source_id=s.id)
     OR EXISTS(SELECT 1 FROM information.operations o WHERE o.id=$2 AND o.kind='batch' AND o.source_id=s.id)) LIMIT 1`,[actor,batchId]);
   if(!visible.rowCount)throw new DomainError('NOT_FOUND',404);
  }
  const result=(await this.repo.db.query(`WITH
   allowed_materials AS (
    SELECT m.id FROM information.materials m JOIN m1.sources s ON s.id=m.source_id JOIN platform.actors a ON a.subject=$1
    WHERE '*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys)
   ), versions AS (
    SELECT v.id FROM information.material_versions v JOIN allowed_materials m ON m.id=v.material_id
    WHERE $2::uuid IS NULL OR EXISTS(
     SELECT 1 FROM information.operations o WHERE o.version_id=v.id AND
      (o.parent_id=$2 OR o.parent_id IN(SELECT operation_id FROM platform.task_batch_sources WHERE batch_id=$2))
    )
   ), extraction AS (
    SELECT DISTINCT ON(p.version_id) p.* FROM information.processing_runs p JOIN versions v ON v.id=p.version_id
    WHERE p.processing_scope='EXTRACTION_ONLY' ORDER BY p.version_id,p.created_at DESC,p.id DESC
   ), full_processing AS (
    SELECT DISTINCT ON(p.version_id) p.* FROM information.processing_runs p JOIN versions v ON v.id=p.version_id
    WHERE p.processing_scope='FULL_EVENT' ORDER BY p.version_id,p.created_at DESC,p.id DESC
   ), visible_facts AS (
    SELECT f.id FROM information.fact f WHERE EXISTS(
     SELECT 1 FROM information.fact_evidence fe JOIN versions v ON v.id=fe.information_version_id WHERE fe.fact_id=f.id
    ) AND NOT EXISTS(SELECT 1 FROM information.fact_information fi WHERE fi.fact_id=f.id AND NOT EXISTS(SELECT 1 FROM allowed_materials m WHERE m.id=fi.information_id))
   ), visible_events AS (
    SELECT DISTINCT ef.event_id FROM information.event_fact ef JOIN visible_facts f ON f.id=ef.fact_id
    WHERE NOT EXISTS(SELECT 1 FROM information.event_fact other JOIN information.fact_information fi ON fi.fact_id=other.fact_id
     WHERE other.event_id=ef.event_id AND NOT EXISTS(SELECT 1 FROM allowed_materials m WHERE m.id=fi.information_id))
   )
   SELECT now() AS updated_at,
    (SELECT count(*)::int FROM versions) AS saved_versions,
    (SELECT count(*)::int FROM extraction WHERE extraction_status='completed') AS extraction_completed,
    (SELECT count(*)::int FROM extraction WHERE extraction_status='completed' AND candidate_count=0) AS no_event,
    (SELECT count(*)::int FROM extraction WHERE extraction_status='recoverable') AS extraction_recoverable,
    (SELECT count(*)::int FROM extraction WHERE extraction_status='review') AS extraction_review,
    (SELECT count(*)::int FROM versions v WHERE NOT EXISTS(SELECT 1 FROM extraction p WHERE p.version_id=v.id AND p.extraction_status IN('completed','recoverable','review'))) AS extraction_pending,
    (SELECT count(*)::int FROM visible_facts) AS facts,
    (SELECT count(*)::int FROM full_processing) AS full_processing_versions,
    (SELECT count(*)::int FROM information.event_candidates c JOIN full_processing p ON p.id=c.processing_id) AS full_processing_candidates,
    (SELECT count(*)::int FROM visible_events) AS events`,[actor,batchId??null])).rows[0];
  return {...result,scope:batchId?'batch':'all',batch_id:batchId??null};
 }
}
