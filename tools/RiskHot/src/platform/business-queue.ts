import PgBoss from 'pg-boss';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
export interface JobEnvelope {
 task_type:string; payload_version:number; run_id:string; owner_module:string; owner_ref:Record<string,unknown>; operation_key:string;
 execution_generation:number; input_digest:string; manifest_ref:string; correlation_id:string|null; causation_id:string|null; trigger_kind:string; payload:Record<string,unknown>;
}
export interface DispatchReceipt {run_id:string; dispatch_id:string; job_id:string}
export const BUSINESS_QUEUES = ['sources.fetch','information.extract','events.process','events.commit','events.enrich','deliveries.send','ops.recover','ops.alerts'] as const;
// This instance never starts, migrates, or opens a connection: send receives the caller's transaction.
const sender = new PgBoss({ db:{executeSql:async()=>{throw new Error('QUEUE_TRANSACTION_REQUIRED');}}, schedule:false, supervise:false, migrate:false });
export async function enqueueBusinessJob(tx:PoolClient,envelope:JobEnvelope,options:{dispatch_seq?:number;startAfter?:Date}={}):Promise<DispatchReceipt>{
 const e=envelope; const seq=options.dispatch_seq??1;
 if(!BUSINESS_QUEUES.includes(e.task_type as typeof BUSINESS_QUEUES[number]) || e.payload_version!==1 || !Number.isSafeInteger(e.execution_generation) || e.execution_generation<1 || !Number.isSafeInteger(seq) || seq<1 || !e.operation_key || !e.input_digest || !e.manifest_ref)throw new Error('JOB_ENVELOPE_INVALID');
 await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify([e.owner_module,e.task_type,e.operation_key])]);
 await tx.query(`INSERT INTO platform.task_runs(run_id,task_type,payload_version,owner_module,owner_ref,operation_key,execution_generation,input_digest,manifest_ref,correlation_id,causation_id,input_payload,engine)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pg-boss') ON CONFLICT(owner_module,task_type,operation_key) DO NOTHING`,[e.run_id,e.task_type,e.payload_version,e.owner_module,e.owner_ref,e.operation_key,e.execution_generation,e.input_digest,e.manifest_ref,e.correlation_id,e.causation_id,e.payload]);
 const run=(await tx.query('SELECT * FROM platform.task_runs WHERE owner_module=$1 AND task_type=$2 AND operation_key=$3 FOR UPDATE',[e.owner_module,e.task_type,e.operation_key])).rows[0];
 if(run.engine!=='pg-boss')throw new Error('ENGINE_FENCE');
 if(Number(run.execution_generation)!==e.execution_generation)throw new Error('GENERATION_FENCE');
 if(run.input_digest!==e.input_digest || run.manifest_ref!==e.manifest_ref || !isDeepStrictEqual(run.owner_ref,e.owner_ref) || !isDeepStrictEqual(run.input_payload,e.payload))throw new Error('INPUT_DIGEST_CONFLICT');
 const existing=(await tx.query('SELECT run_id,dispatch_id,job_id FROM platform.task_dispatches WHERE run_id=$1 AND generation=$2 AND dispatch_seq=$3',[run.run_id,e.execution_generation,seq])).rows[0];
 if(existing)return existing;
 if(['succeeded','cancelled','superseded','waiting'].includes(run.runtime_state))throw new Error('RUN_NOT_DISPATCHABLE');
 const last=(await tx.query('SELECT job_id FROM platform.task_dispatches WHERE run_id=$1 AND generation=$2 ORDER BY dispatch_seq DESC LIMIT 1',[run.run_id,e.execution_generation])).rows[0];
 if(last){
  const job=await sender.getJobById(e.task_type,last.job_id,{includeArchive:false,db:{executeSql:(sql,values)=>tx.query(sql,values)}});
  if(job && ['created','active','retry'].includes(job.state))throw new Error('DISPATCH_STILL_ACTIVE');
 }
 const dispatch_id=randomUUID();
 const job_id=await sender.send(e.task_type,{...e,run_id:run.run_id,dispatch_id},{db:{executeSql:(sql,values)=>tx.query(sql,values)},startAfter:options.startAfter,expireInSeconds:960,retryLimit:4,retryDelay:2,retryBackoff:true});
 if(!job_id)throw new Error('QUEUE_SEND_NOT_ACCEPTED');
 await tx.query('INSERT INTO platform.task_dispatches(dispatch_id,run_id,generation,dispatch_seq,job_id) VALUES($1,$2,$3,$4,$5)',[dispatch_id,run.run_id,e.execution_generation,seq,job_id]);
 return {run_id:run.run_id,dispatch_id,job_id};
}
export function modelProcessEnvironment(parent:NodeJS.ProcessEnv,credentials:Record<string,string>):NodeJS.ProcessEnv {
 const env:NodeJS.ProcessEnv={};
 for(const key of ['PATH','LANG','LC_ALL','TZ','TMPDIR'])if(parent[key])env[key]=parent[key];
 for(const [key,value] of Object.entries(credentials)){
  if(!['OPENAI_API_KEY','OPENAI_BASE_URL','ANTHROPIC_API_KEY','ANTHROPIC_BASE_URL','MODEL_API_KEY','MODEL_BASE_URL'].includes(key))throw new Error('MODEL_ENV_KEY_FORBIDDEN');
  env[key]=value;
 }
 return env;
}
