import {recoverEnrichmentRuns,scheduleEnrichmentRecovery} from './business-recovery.js';
import {advanceBusinessMaterialExtraction} from './business-material.js';
import {reconcileEventFiles} from '../event-management/files.js';
import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {ExecutionStore} from '../information-ingestion/processing/execution.js';
import {ArtifactStore} from '../platform/artifacts.js';
import {required,transaction} from '../platform/db.js';
import {enqueueBusinessJob,type JobEnvelope} from '../platform/business-queue.js';
import {digest} from '../event-management/contracts.js';
import {EightStepService} from '../event-management/eight-step-service.js';
import {EventDelivery} from '../event-management/delivery.js';
import {callBusinessModel,invokeReservedBusinessModel} from './business-model.js';
import {withBusinessModelPermit,type BusinessHandler} from './business-worker.js';
import {currentIngestionActivities} from './current-activities.js';
import {currentExtractionActivities} from './current-extraction.js';
import {currentScheduleTick} from './current-scheduler.js';
import {DomainError} from '../platform/types.js';
export async function createHandlers(db:Pool){
 const repo=new ExecutionStore(db,new ArtifactStore(required('ARTIFACT_ROOT'))),service=new EightStepService(repo,callBusinessModel),delivery=new EventDelivery(repo);
 const identify=(e:JobEnvelope)=>String(e.payload.candidate_id??e.owner_ref.id??'');
 const process:BusinessHandler=async(e,context)=>{
  const id=identify(e);
  try{
   const result=await service.advance(id,e.execution_generation);
   return context.commit(async tx=>{
    if(result.state==='completed'){
     const saved=(await service.read(id,String((await db.query('SELECT actor FROM information.event_candidates WHERE id=$1',[id])).rows[0].actor))).saved_event_id;
     if(saved)await enqueueBusinessJob(tx,{task_type:'events.enrich',payload_version:1,run_id:randomUUID(),owner_module:'F02',owner_ref:{id},operation_key:`association/${id}/${e.execution_generation}`,execution_generation:e.execution_generation,input_digest:digest({id,saved,generation:e.execution_generation}),manifest_ref:'f02-eight-step-v1',correlation_id:e.correlation_id,causation_id:e.run_id,trigger_kind:'event-saved',payload:{candidate_id:id,event_id:saved}});
    }else await tx.query('UPDATE information.event_candidates SET status=$2,reason_code=$3 WHERE id=$1 AND execution_generation=$4',[id,result.state==='waiting'?'review':'recoverable',result.reason,e.execution_generation]);
    return {state:result.state==='completed'?'succeeded':result.state==='waiting'?'waiting':'recoverable',result_ref:{...result}};
   });
  }catch(error){if(!(error instanceof DomainError))throw error;return context.commit(async tx=>{await tx.query("UPDATE information.event_candidates SET status='recoverable',reason_code=$2 WHERE id=$1 AND execution_generation=$3 AND status<>'completed'",[id,error.code,e.execution_generation]);return {state:'recoverable',result_ref:{reason:error.code}};});}
 };
 const recover=async()=>{
   await reconcileEventFiles(repo);
   const messages=(await db.query("SELECT m.id,m.payload_digest FROM platform.messages m WHERE m.state='pending' AND (NOT EXISTS(SELECT 1 FROM platform.task_runs r WHERE r.task_type='deliveries.send' AND r.owner_ref->>'id'=m.id::text) OR EXISTS(SELECT 1 FROM platform.task_runs r WHERE r.task_type='deliveries.send' AND r.owner_ref->>'id'=m.id::text AND r.runtime_state='recoverable' AND r.next_eligible_at<=now())) ORDER BY m.created_at,m.id LIMIT 100")).rows;
   let dispatched=0;
   for(const m of messages){try{await transaction(db,async tx=>{
    const run=(await tx.query("SELECT * FROM platform.task_runs WHERE owner_module='F02' AND task_type='deliveries.send' AND operation_key=$1 FOR UPDATE",[`delivery/${m.id}`])).rows[0];
    const envelope:JobEnvelope=run?{task_type:run.task_type,payload_version:run.payload_version,run_id:run.run_id,owner_module:run.owner_module,owner_ref:run.owner_ref,operation_key:run.operation_key,execution_generation:Number(run.execution_generation),input_digest:run.input_digest,manifest_ref:run.manifest_ref,correlation_id:run.correlation_id,causation_id:run.causation_id,trigger_kind:'recover',payload:run.input_payload}:{task_type:'deliveries.send',payload_version:1,run_id:randomUUID(),owner_module:'F02',owner_ref:{id:m.id},operation_key:`delivery/${m.id}`,execution_generation:1,input_digest:m.payload_digest,manifest_ref:'event-delivery-v2',correlation_id:randomUUID(),causation_id:null,trigger_kind:'recover',payload:{message_id:m.id}};
    const seq=run?Number((await tx.query('SELECT COALESCE(max(dispatch_seq),0)+1 n FROM platform.task_dispatches WHERE run_id=$1 AND generation=$2',[run.run_id,run.execution_generation])).rows[0].n):1;
    await enqueueBusinessJob(tx,envelope,{dispatch_seq:seq});
   });dispatched++;}catch(error){if(!(error instanceof Error)||!['DISPATCH_STILL_ACTIVE','RUN_NOT_DISPATCHABLE'].includes(error.message))throw error;}}
   return {messages:dispatched,enrichments:await recoverEnrichmentRuns(db)};
 };
 const business:Record<string,BusinessHandler>={
  'sources.fetch':async(e,ctx)=>{await currentIngestionActivities(repo).ingestCurrent(String(e.owner_ref.id),e.execution_generation);return ctx.commit(async()=>({state:'succeeded'}));},
  'information.extract':async(e,ctx)=>{
   const result=await advanceBusinessMaterialExtraction(repo,String(e.owner_ref.id),e.execution_generation);
   return ctx.commit(async()=>result);
  },
  'events.process':process,
  'events.commit':process,
  'events.enrich':async(e,ctx)=>{
   let result;try{result=await service.associate(identify(e),e.execution_generation);}catch(error){if(!(error instanceof DomainError))throw error;result={state:'recoverable' as const,reason:error.code};}
   return ctx.commit(async tx=>{await scheduleEnrichmentRecovery(tx,e,result.state);return {state:result.state,result_ref:result};});
  },
  'deliveries.send':async(e,ctx)=>{
   const id=String(e.payload.message_id??e.owner_ref.id),message=(await db.query('SELECT message_type FROM platform.messages WHERE id=$1',[id])).rows[0];
   if(!message)throw new DomainError('NOT_FOUND',404);
   if(message.message_type!=='event.facts.committed.v2')return ctx.commit(async()=>({state:'waiting',result_ref:{message_id:id,reason:'RESULT_CONSUMER_NOT_CONNECTED'}}));
   await delivery.publishMessage(id);
   await delivery.reconcile(id);
   const exhausted=Boolean((await db.query("SELECT 1 FROM platform.message_deliveries WHERE message_id=$1 AND ((status<>'received' AND attempts-window_start_attempts>=10) OR (files_state<>'ready' AND file_attempts-file_window_start>=10))",[id])).rowCount);
   const pending=Boolean((await db.query("SELECT 1 FROM platform.message_deliveries WHERE message_id=$1 AND (status<>'received' OR files_state<>'ready')",[id])).rowCount);
   return ctx.commit(async tx=>{await tx.query("UPDATE platform.messages SET state=$2 WHERE id=$1",[id,pending?'pending':'completed']);await tx.query("UPDATE platform.task_runs SET next_eligible_at=CASE WHEN $2 THEN now()+interval '30 seconds' ELSE NULL END WHERE run_id=$1",[e.run_id,pending&&!exhausted]);return {state:pending?'recoverable':'succeeded',result_ref:{message_id:id}};});
  },
  'ops.recover':async(_e,ctx)=>{const result=await recover();return ctx.commit(async()=>({state:'succeeded',result_ref:result}));},
  'ops.alerts':async(_e,ctx)=>ctx.commit(async()=>({state:'succeeded',result_ref:{checked:0}}))
 };
 return {business,periodic:{
  'sources.schedule':async()=>{await currentScheduleTick(repo,required('SCHEDULER_ACTOR'),new Date(),2);return {scanned:1};},
  'ops.recover':recover,
  'ops.alerts':async()=>({recoverable:Number((await db.query("SELECT count(*)::int AS n FROM platform.task_runs WHERE runtime_state='recoverable'")).rows[0].n)})
 }};
}
