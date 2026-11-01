import type { Pool, PoolClient } from 'pg';
import type PgBoss from 'pg-boss';
import { spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
let businessShutdownRequested=false;
const activeControllers=new Set<AbortController>();
const activeModelStops=new Set<()=>void>();
export function cancelActiveBusinessJobs():void{businessShutdownRequested=true;for(const controller of activeControllers)controller.abort();for(const stop of activeModelStops)stop();}
import { BUSINESS_QUEUES, modelProcessEnvironment, type JobEnvelope } from '../platform/business-queue.js';
import { transaction } from '../platform/db.js';

export interface BusinessResult {state:'succeeded'|'waiting'|'recoverable';result_ref?:Record<string,unknown>;resume_ref?:Record<string,unknown>}
export interface BusinessJobContext {
 signal:AbortSignal;
 commit(work:(tx:PoolClient)=>Promise<BusinessResult>):Promise<BusinessResult>;
}
export type BusinessHandler=(envelope:JobEnvelope,context:BusinessJobContext)=>Promise<BusinessResult>;
async function lockRun(tx:PoolClient,e:JobEnvelope){
 const run=(await tx.query('SELECT * FROM platform.task_runs WHERE run_id=$1 FOR UPDATE',[e.run_id])).rows[0];
 if(!run || run.engine!=='pg-boss')throw new Error('ENGINE_FENCE');
 if(Number(run.execution_generation)!==e.execution_generation)throw new Error('GENERATION_FENCE');
 if(run.input_digest!==e.input_digest || run.manifest_ref!==e.manifest_ref || run.task_type!==e.task_type || run.payload_version!==e.payload_version || !isDeepStrictEqual(run.input_payload,e.payload) || !isDeepStrictEqual(run.owner_ref,e.owner_ref))throw new Error('INPUT_DIGEST_CONFLICT');
 if(['cancelled','superseded'].includes(run.runtime_state))throw new Error('RUN_NOT_DISPATCHABLE');
 return run;
}
export async function executeBusinessJob(db:Pool,envelope:JobEnvelope,handler:BusinessHandler):Promise<BusinessResult>{
 const e=envelope; const controller=new AbortController();activeControllers.add(controller);
 const timeout=setTimeout(()=>controller.abort(new Error('BUSINESS_JOB_TIMEOUT')),900_000);
 const lease=await db.connect(); let acquired=false;
 try{
  acquired=(await lease.query('SELECT pg_try_advisory_lock(hashtextextended($1,1)) AS locked',[e.run_id])).rows[0].locked;
  if(!acquired)throw new Error('RUN_BUSY');
  const prior=await transaction(db,tx=>lockRun(tx,e));
  if(['succeeded','waiting'].includes(prior.runtime_state))return {state:prior.runtime_state,result_ref:prior.result_ref??undefined};
  let committed=false;
  const result=await handler(e,{signal:controller.signal,commit:async work=>transaction(db,async tx=>{
   if(controller.signal.aborted)throw new Error('BUSINESS_JOB_TIMEOUT');
   const run=await lockRun(tx,e);
   if(run.runtime_state==='succeeded')return {state:'succeeded',result_ref:run.result_ref??undefined};
   const result=await work(tx);
   if(controller.signal.aborted)throw new Error('BUSINESS_JOB_TIMEOUT');
   await tx.query('UPDATE platform.task_runs SET runtime_state=$2,result_ref=$3,resume_ref=$4,updated_at=now() WHERE run_id=$1',[e.run_id,result.state,result.result_ref??null,result.resume_ref??null]);
   committed=true;return result;
  })});
  if(!committed)throw new Error('BUSINESS_RESULT_NOT_COMMITTED');
  return result;
 }finally{
  clearTimeout(timeout);activeControllers.delete(controller);
  if(acquired)await lease.query('SELECT pg_advisory_unlock(hashtextextended($1,1))',[e.run_id]);
  lease.release();
 }
}

// One model permit per Worker process. Deploy exactly one model-capable Worker until a shared lease is implemented.
let modelTail:Promise<void>=Promise.resolve();
export async function withBusinessModelPermit<T>(work:()=>Promise<T>):Promise<T>{
 const prior=modelTail;let release!:()=>void;modelTail=new Promise(resolve=>{release=resolve;});await prior;try{if(businessShutdownRequested)throw new Error('MODEL_PROCESS_CANCELLED');return await work();}finally{release();}
}
export async function runModelProcess(options:{args:string[];input:unknown;credentials:Record<string,string>;timeoutMs:number;signal?:AbortSignal;permitHeld?:boolean;authentication?:{home:string;codexHome:string;executable?:string}}):Promise<unknown>{
 if(!options.permitHeld)return withBusinessModelPermit(()=>runModelProcess({...options,permitHeld:true}));
 try{
  if(options.signal?.aborted)throw new Error('MODEL_PROCESS_CANCELLED');
  if(!Number.isFinite(options.timeoutMs)||options.timeoutMs<=0||options.timeoutMs>120_000)throw new Error('MODEL_PROCESS_TIMEOUT_INVALID');
  return await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,options.args,{env:{...modelProcessEnvironment(process.env,options.credentials),...(options.authentication?{HOME:options.authentication.home,CODEX_HOME:options.authentication.codexHome,CODEX_EXECUTABLE:options.authentication.executable}:{})},detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});
   let output='';let bytes=0;let failure:Error|undefined;
   const stop=(error:Error)=>{failure=error;try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{/* Already exited. */}};
   const timer=setTimeout(()=>stop(new Error('MODEL_PROCESS_TIMEOUT')),options.timeoutMs);
   const abort=()=>stop(new Error('MODEL_PROCESS_CANCELLED'));activeModelStops.add(abort); options.signal?.addEventListener('abort',abort,{once:true});
   child.stdout.setEncoding('utf8');
   child.stdout.on('data',(chunk:string)=>{bytes+=Buffer.byteLength(chunk);if(bytes>2_000_000)stop(new Error('MODEL_PROCESS_OUTPUT_LIMIT'));else output+=chunk;});
   child.stderr.resume();
   child.stdin.on('error',()=>{});
   child.once('error',error=>{failure=error;});
   child.once('close',code=>{
    clearTimeout(timer);activeModelStops.delete(abort);options.signal?.removeEventListener('abort',abort);
    if(failure)return reject(failure);
    if(code!==0)return reject(new Error('MODEL_PROCESS_FAILED'));
    try{resolve(JSON.parse(output));}catch{reject(new Error('MODEL_PROCESS_INVALID_JSON'));}
   });
   child.stdin.end(JSON.stringify(options.input));
  });
 }finally{/* The caller releases the shared model permit after response persistence. */}
}

export type PeriodicHandler=()=>Promise<Record<string,number>>;
const PERIODIC = {
 'sources.schedule':{cron:'* * * * *',minutes:1},
 'ops.recover':{cron:'* * * * *',minutes:1},
 'ops.alerts':{cron:'*/5 * * * *',minutes:5}
} as const;

async function executePeriodic(db:Pool,key:string,at:string,handler:PeriodicHandler):Promise<void>{
 const lease=await db.connect();let acquired=false;
 try{
  acquired=(await lease.query('SELECT pg_try_advisory_lock(hashtextextended($1,2)) AS locked',[key])).rows[0].locked;
  if(!acquired)throw new Error('SCAN_BUSY');
  const id=(await lease.query(`INSERT INTO platform.job_runs(id,schedule_key,scheduled_at,started_at,status,policy_version)
   VALUES(gen_random_uuid(),$1,$2,now(),'running','s01-v1') ON CONFLICT(schedule_key,scheduled_at) DO UPDATE SET started_at=now(),status='running'
   WHERE platform.job_runs.status<>'succeeded' RETURNING id`,[key,at])).rows[0]?.id;
  if(!id)return;
  try{
   const counts=await handler();
   await lease.query("UPDATE platform.job_runs SET status='succeeded',counts=$2,finished_at=now(),error_code=null WHERE id=$1",[id,counts]);
  }catch(error){
   await lease.query("UPDATE platform.job_runs SET status='failed',error_code='SCAN_FAILED',finished_at=now() WHERE id=$1",[id]);throw error;
  }
 }finally{if(acquired)await lease.query('SELECT pg_advisory_unlock(hashtextextended($1,2))',[key]);lease.release();}
}

/** Explicit registration only: importing this module never starts a Worker or changes engine ownership. */
export async function registerBusinessWorker(
 boss:PgBoss,db:Pool,handlers:Partial<Record<typeof BUSINESS_QUEUES[number],BusinessHandler>>,
 periodic:Record<keyof typeof PERIODIC,PeriodicHandler>,options:{sourceScheduleEnabled?:boolean}={}
):Promise<()=>Promise<void>>{
 businessShutdownRequested=false;
 const sourceScheduleEnabled=options.sourceScheduleEnabled??process.env.SCHEDULE_ENABLED==='true';
 const registrations:{name:string;id:string}[]=[];
 for(const name of [...BUSINESS_QUEUES,'sources.schedule'] as const){
  if(!(await boss.getQueues()).some(queue=>queue.name===name))throw new Error(`QUEUE_NOT_PROVISIONED:${name}`);
  const concurrency=['sources.fetch','deliveries.send'].includes(name)?2:1;
  for(let i=0;i<concurrency;i++){
   const id=await boss.work<JobEnvelope|{schedule_key:string;scheduled_at?:string}>(name,{batchSize:1,pollingIntervalSeconds:0.5},async jobs=>{
    for(const job of jobs){
     if('schedule_key' in job.data){
      const key=job.data.schedule_key as keyof typeof PERIODIC;
      if(key==='sources.schedule'&&!sourceScheduleEnabled)return;
      if(!(key in PERIODIC)||key!==name)throw new Error('SCHEDULE_PAYLOAD_INVALID');
      const interval=PERIODIC[key].minutes*60_000;
      const at=job.data.scheduled_at??new Date(Math.floor(Date.now()/interval)*interval).toISOString();
      await executePeriodic(db,key,at,periodic[key]);
     }else{
      if(job.data.task_type!==name || job.data.payload_version!==1)throw new Error('JOB_ENVELOPE_INVALID');
      const handler=handlers[name as typeof BUSINESS_QUEUES[number]];
      if(!handler)throw new Error('QUEUE_HANDLER_NOT_REGISTERED');
      await executeBusinessJob(db,job.data,handler);
     }
    }
   });registrations.push({name,id});
  }
 }
 for(const [name,config] of Object.entries(PERIODIC)){
  if(name==='sources.schedule'&&!sourceScheduleEnabled){await boss.unschedule(name);continue;}
  await boss.schedule(name,config.cron,{schedule_key:name},{tz:'Asia/Shanghai',retryLimit:4,retryDelay:2,expireInSeconds:60});
  await db.query(`INSERT INTO platform.schedule_registrations(schedule_key,policy_version,cron,timezone,applied_at)
   VALUES($1,'s01-v1',$2,'Asia/Shanghai',now()) ON CONFLICT(schedule_key) DO UPDATE SET policy_version=EXCLUDED.policy_version,cron=EXCLUDED.cron,timezone=EXCLUDED.timezone,applied_at=now()`,[name,config.cron]);
  const interval=config.minutes*60_000;
  const at=new Date(Math.floor(Date.now()/interval)*interval).toISOString();
  await boss.send(name,{schedule_key:name,scheduled_at:at},{singletonKey:at,singletonSeconds:config.minutes*60,retryLimit:4,retryDelay:2,expireInSeconds:60});
 }
 return async()=>{for(const {name,id} of registrations)await boss.offWork({id});};
}

/** Publishing account only: pg-boss creates partition tables here. Never call from runtime credentials. */
export async function provisionBusinessQueues(boss:PgBoss):Promise<void>{
 for(const name of [...BUSINESS_QUEUES,'sources.schedule'])await boss.createQueue(name);
}
