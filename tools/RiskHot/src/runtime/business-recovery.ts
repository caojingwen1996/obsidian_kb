import type {Pool,PoolClient} from 'pg';
import {transaction} from '../platform/db.js';
import {enqueueBusinessJob,type JobEnvelope} from '../platform/business-queue.js';

export async function scheduleEnrichmentRecovery(tx:PoolClient,e:JobEnvelope,state:string):Promise<void>{
 const count=Number((await tx.query('SELECT count(*) n FROM platform.task_dispatches WHERE run_id=$1 AND generation=$2',[e.run_id,e.execution_generation])).rows[0].n);
 await tx.query("UPDATE platform.task_runs SET next_eligible_at=CASE WHEN $2 AND $3<3 THEN now()+interval '30 seconds' ELSE NULL END WHERE run_id=$1",[e.run_id,state==='recoverable',count]);
}
export async function recoverEnrichmentRuns(db:Pool):Promise<number>{
 const candidates=(await db.query("SELECT run_id FROM platform.task_runs WHERE task_type='events.enrich' AND engine='pg-boss' AND runtime_state='recoverable' AND next_eligible_at<=now() ORDER BY next_eligible_at,run_id LIMIT 100")).rows;
 let dispatched=0;
 for(const candidate of candidates){
  try{
   const accepted=await transaction(db,async tx=>{
    const run=(await tx.query("SELECT * FROM platform.task_runs WHERE run_id=$1 AND runtime_state='recoverable' AND next_eligible_at<=now() FOR UPDATE",[candidate.run_id])).rows[0];if(!run)return false;
    const valid=(await tx.query("SELECT 1 FROM information.event_candidates c JOIN information.candidate_fact cf ON cf.candidate_id=c.id JOIN information.fact f ON f.id=cf.fact_id WHERE c.id=$1 AND c.execution_generation=$2 AND c.status='completed' AND f.event_id=$3",[run.owner_ref.id,run.execution_generation,run.input_payload.event_id])).rowCount;
    const count=Number((await tx.query('SELECT count(*) n FROM platform.task_dispatches WHERE run_id=$1 AND generation=$2',[run.run_id,run.execution_generation])).rows[0].n);
    if(!valid||count>=3){await tx.query('UPDATE platform.task_runs SET next_eligible_at=NULL WHERE run_id=$1',[run.run_id]);return false;}
    const e:JobEnvelope={task_type:run.task_type,payload_version:run.payload_version,run_id:run.run_id,owner_module:run.owner_module,owner_ref:run.owner_ref,operation_key:run.operation_key,execution_generation:Number(run.execution_generation),input_digest:run.input_digest,manifest_ref:run.manifest_ref,correlation_id:run.correlation_id,causation_id:run.causation_id,trigger_kind:'recover',payload:run.input_payload};
    const seq=Number((await tx.query('SELECT COALESCE(MAX(dispatch_seq),0)+1 n FROM platform.task_dispatches WHERE run_id=$1 AND generation=$2',[run.run_id,run.execution_generation])).rows[0].n);
    await enqueueBusinessJob(tx,e,{dispatch_seq:seq});await tx.query('UPDATE platform.task_runs SET next_eligible_at=NULL WHERE run_id=$1',[run.run_id]);return true;
   });if(accepted)dispatched++;
  }catch(error){if(!(error instanceof Error)||!['DISPATCH_STILL_ACTIVE','RUN_NOT_DISPATCHABLE'].includes(error.message))throw error;}
 }
 return dispatched;
}
