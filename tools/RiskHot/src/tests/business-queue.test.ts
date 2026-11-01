import {grantBusinessQueueRole} from '../platform/business-grants.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import PgBoss from 'pg-boss';
import { transaction } from '../platform/db.js';
import { enqueueBusinessJob, modelProcessEnvironment, type JobEnvelope } from '../platform/business-queue.js';

const envelope = (): JobEnvelope => ({ task_type:'events.process', payload_version:1, run_id:randomUUID(), owner_module:'F02', owner_ref:{ candidate_id:randomUUID() }, operation_key:randomUUID(), execution_generation:1, input_digest:'digest-1', manifest_ref:'f02-v2', correlation_id:randomUUID(), causation_id:null, trigger_kind:'manual', payload:{} });
async function fixture() {
  const admin = new Pool({ connectionString:process.env.ADMIN_DATABASE_URL });
  const name = `riskhot_queue_${randomUUID().replaceAll('-','')}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(process.env.ADMIN_DATABASE_URL!); url.pathname = `/${name}`;
  const db = new Pool({ connectionString:url.href });
  const boss = new PgBoss({connectionString:url.href, schedule:false, supervise:false});
  boss.on('error', () => {});
  await boss.start(); await boss.createQueue('events.process');
  await db.query(await readFile('src/db/009-business-queue.sql','utf8'));
  await db.query('CREATE TABLE public.effects(id text PRIMARY KEY)');
  return {db,boss, async dispose(){await boss.stop({wait:true}); await db.end(); await admin.query(`DROP DATABASE ${name}`); await admin.end();}};
}

test('业务写入、运行、投递、Job随事务一起回滚',async()=>{
  const f=await fixture(); try {
    await assert.rejects(()=>transaction(f.db,async tx=>{await tx.query("INSERT INTO effects VALUES('one')"); await enqueueBusinessJob(tx,envelope()); throw new Error('ROLLBACK_PROBE');}),/ROLLBACK_PROBE/);
    for(const table of ['effects','platform.task_runs','platform.task_dispatches','pgboss.job']) assert.equal((await f.db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,0,table);
  } finally {await f.dispose();}
});

test('确认丢失及队列清理后复用永久回执，同键异摘要拒绝',async()=>{
  const f=await fixture(); try {
    const e=envelope(); const first=await transaction(f.db,tx=>enqueueBusinessJob(tx,e));
    const retry=await transaction(f.db,tx=>enqueueBusinessJob(tx,{...e,run_id:randomUUID()})); assert.deepEqual(retry,first);
    await assert.rejects(()=>transaction(f.db,tx=>enqueueBusinessJob(tx,{...e,input_digest:'changed'})),/INPUT_DIGEST_CONFLICT/);
    await f.boss.deleteJob(e.task_type,first.job_id);
    assert.deepEqual(await transaction(f.db,tx=>enqueueBusinessJob(tx,e)),first);
    assert.equal((await f.db.query('SELECT count(*)::int AS n FROM platform.task_runs')).rows[0].n,1);
    assert.equal((await f.db.query('SELECT count(*)::int AS n FROM pgboss.job')).rows[0].n,0);
    const recovered=await transaction(f.db,tx=>enqueueBusinessJob(tx,e,{dispatch_seq:2})); assert.notEqual(recovered.job_id,first.job_id);
  } finally {await f.dispose();}
});

test('旧引擎与旧代次不能入队，同步并发受理只产生一份运行',async()=>{
  const f=await fixture(); try {
    const e=envelope(); const receipts=await Promise.all(Array.from({length:4},()=>transaction(f.db,tx=>enqueueBusinessJob(tx,e))));
    for(const r of receipts)assert.deepEqual(r,receipts[0]);
    await f.db.query("UPDATE platform.task_runs SET engine='temporal' WHERE run_id=$1",[e.run_id]);
    await assert.rejects(()=>transaction(f.db,tx=>enqueueBusinessJob(tx,e)),/ENGINE_FENCE/);
    await f.db.query("UPDATE platform.task_runs SET engine='pg-boss',execution_generation=2 WHERE run_id=$1",[e.run_id]);
    await assert.rejects(()=>transaction(f.db,tx=>enqueueBusinessJob(tx,e)),/GENERATION_FENCE/);
  } finally {await f.dispose();}
});

test('模型进程只继承允许的运行环境及明确供应凭据',()=>{
  const env=modelProcessEnvironment({PATH:'/bin',HOME:'/private',DATABASE_URL:'secret',PGPASSWORD:'secret',APPROVAL_TOKEN:'secret',OPENAI_API_KEY:'model',NODE_OPTIONS:'--inspect'},{OPENAI_API_KEY:'model'});
  assert.deepEqual(env,{PATH:'/bin',OPENAI_API_KEY:'model'});
  assert.throws(()=>modelProcessEnvironment({}, {DATABASE_URL:'secret'}),/MODEL_ENV_KEY_FORBIDDEN/);
});

test('消费完成但确认丢失的重投不再次写业务副作用，旧代次不能消费',async()=>{
 const {executeBusinessJob}=await import('../runtime/business-worker.js');
 const f=await fixture();try{
  const e=envelope();await transaction(f.db,tx=>enqueueBusinessJob(tx,e));
  let calls=0;
  const handler=async (_e:JobEnvelope,context:import('../runtime/business-worker.js').BusinessJobContext)=>context.commit(async tx=>{
   calls++;await tx.query("INSERT INTO effects VALUES('saved')");return {state:'succeeded' as const,result_ref:{receipt:'fixed'}};
  });
  await executeBusinessJob(f.db,e,handler);
  await executeBusinessJob(f.db,e,handler);
  assert.equal(calls,1);assert.equal((await f.db.query('SELECT * FROM effects')).rowCount,1);
  await assert.rejects(()=>executeBusinessJob(f.db,{...e,execution_generation:2},handler),/GENERATION_FENCE/);
 }finally{await f.dispose();}
});

test('受控模型子进程不继承数据库凭据并支持超时取消',async()=>{
 const {runModelProcess}=await import('../runtime/business-worker.js');
 const result=await runModelProcess({args:['-e',"process.stdout.write(JSON.stringify({db:process.env.DATABASE_URL??null,key:process.env.MODEL_API_KEY}))"],input:{},credentials:{MODEL_API_KEY:'model-only'},timeoutMs:2000});
 assert.deepEqual(result,{db:null,key:'model-only'});
 await assert.rejects(()=>runModelProcess({args:['-e','setInterval(()=>{},1000)'],input:{},credentials:{},timeoutMs:30}),/MODEL_PROCESS_TIMEOUT/);
});

test('业务队列注册后实际消费，周期注册记录配置并重启补一次扫描',async()=>{
 const {registerBusinessWorker,provisionBusinessQueues}=await import('../runtime/business-worker.js');
 const f=await fixture();try{
  await provisionBusinessQueues(f.boss);
  let handled=0;let scanned=0;
  const handler:import('../runtime/business-worker.js').BusinessHandler=async(_e,c)=>c.commit(async()=>{handled++;return {state:'succeeded'};});
  const stop=await registerBusinessWorker(f.boss,f.db,{'events.process':handler},{'sources.schedule':async()=>{scanned++;return {accepted:1};},'ops.recover':async()=>({accepted:0}),'ops.alerts':async()=>({accepted:0})},{sourceScheduleEnabled:true});
  await transaction(f.db,tx=>enqueueBusinessJob(tx,envelope()));
  for(let i=0;i<100&&(handled===0||scanned===0);i++)await new Promise(r=>setTimeout(r,30));
  assert.equal(handled,1);assert.equal(scanned,1);
  assert.equal((await f.db.query("SELECT * FROM platform.job_runs WHERE schedule_key='sources.schedule' AND status='succeeded'")).rowCount,1);
  const schedules=await f.boss.getSchedules();assert.equal(schedules.length,3);
  await stop();
 }finally{await f.dispose();}
});

test('无DDL运行角色能够同事务入队领取确认，但不能建表',async()=>{
 const f=await fixture();const role=`queue_runtime_${randomUUID().replaceAll('-','')}`;
 try{
  await f.db.query(`CREATE ROLE ${role} NOLOGIN`);
  await grantBusinessQueueRole(f.db,role);
  const e=envelope();
  const receipt=await transaction(f.db,async tx=>{await tx.query(`SET LOCAL ROLE ${role}`);return enqueueBusinessJob(tx,e);});
  await transaction(f.db,async tx=>{
   await tx.query(`SET LOCAL ROLE ${role}`);
   const options={db:{executeSql:(sql:string,values:unknown[])=>tx.query(sql,values)}};
   const jobs=await f.boss.fetch('events.process',options);assert.equal(jobs[0]?.id,receipt.job_id);
   await f.boss.complete('events.process',receipt.job_id,options);
  });
  await assert.rejects(()=>transaction(f.db,async tx=>{await tx.query(`SET LOCAL ROLE ${role}`);await tx.query('CREATE TABLE platform.forbidden(id int)');}),/permission denied/);
 }finally{await f.db.query(`DROP OWNED BY ${role}`);await f.db.query(`DROP ROLE ${role}`);await f.dispose();}
});

test('永久输入不能以相同摘要改写；显式引擎受理不写旧启动intent',async()=>{
 const {dispatchCurrentExecution,readCurrentExecutionInput}=await import('../platform/current-dispatch.js');
 const f=await fixture();try{
  await f.db.query('CREATE TABLE platform.execution_intents(kind text,owner_id uuid,generation bigint,workflow_id text,input jsonb,UNIQUE(kind,owner_id,generation))');
  const owner=randomUUID();const args={kind:'candidate' as const,owner_id:owner,generation:1,workflow_id:'candidate/test',input:{id:owner},manifest_ref:'f02-v2'};
  await transaction(f.db,tx=>dispatchCurrentExecution(tx,args,'pg-boss'));
  assert.equal((await f.db.query('SELECT * FROM platform.execution_intents')).rowCount,0);
  assert.deepEqual(await readCurrentExecutionInput(f.db,'candidate',owner,1,'pg-boss'),{id:owner});
  await assert.rejects(()=>transaction(f.db,tx=>dispatchCurrentExecution(tx,{...args,input:{id:'changed'}},'pg-boss')),/INPUT_DIGEST_CONFLICT/);
  const e=envelope();await transaction(f.db,tx=>enqueueBusinessJob(tx,e));
  await assert.rejects(()=>transaction(f.db,tx=>enqueueBusinessJob(tx,{...e,payload:{changed:true}})),/INPUT_DIGEST_CONFLICT/);
 }finally{await f.dispose();}
});

test('新引擎启动只选择业务Worker与API，默认仍是原进程组且凭据隔离',async()=>{
 const {runtimeProcesses,runtimeEnvironment}=await import('../runtime/environment.js');
 assert.deepEqual(runtimeProcesses({}).map(p=>p.name),['workflow','io','model','relay','api']);
 assert.deepEqual(runtimeProcesses({EXECUTION_ENGINE:'pg-boss'}).map(p=>p.name),['business','api']);
 const env=runtimeEnvironment('business',{EXECUTION_ENGINE:'pg-boss',SCHEDULER_ACTOR:'operator',SCHEDULE_ENABLED:'false',BUSINESS_DATABASE_URL:'limited',ADMIN_DATABASE_URL:'admin',OIDC_CLIENT_SECRET:'approval',MODEL_API_KEY:'model',BUSINESS_HANDLERS_MODULE:'src/runtime/test-adapter.ts'});
 assert.equal(env.SCHEDULER_ACTOR,'operator');assert.equal(env.SCHEDULE_ENABLED,'false');assert.equal(env.BUSINESS_DATABASE_URL,'limited');assert.equal(env.ADMIN_DATABASE_URL,undefined);assert.equal(env.OIDC_CLIENT_SECRET,undefined);
});

test('受控进程输出在UTF8字符中间分块时仍保留中文',async()=>{
 const {runModelProcess}=await import('../runtime/business-worker.js');
 const result=await runModelProcess({args:['-e',"const b=Buffer.from(JSON.stringify({text:'中文'}));process.stdout.write(b.subarray(0,10));setTimeout(()=>process.stdout.write(b.subarray(10)),30)"],input:{},credentials:{},timeoutMs:2000});
 assert.deepEqual(result,{text:'中文'});
});

test('停止Worker会结束正在运行的受控模型进程',async()=>{
 const {runModelProcess,cancelActiveBusinessJobs}=await import('../runtime/business-worker.js');
 const job=runModelProcess({args:['-e','setInterval(()=>{},1000)'],input:{},credentials:{},timeoutMs:2000});
 const waiting=runModelProcess({args:['-e',"process.stdout.write('{}')"],input:{},credentials:{},timeoutMs:2000});
 const timer=setTimeout(()=>cancelActiveBusinessJobs(),30);
 try{await assert.rejects(()=>job,/MODEL_PROCESS_CANCELLED/);await assert.rejects(()=>waiting,/MODEL_PROCESS_CANCELLED/);}finally{clearTimeout(timer);}
});

test('关闭信源周期时不调用信源扫描，恢复告警仍登记',async()=>{
 const {registerBusinessWorker,provisionBusinessQueues}=await import('../runtime/business-worker.js');const f=await fixture();try{
  await provisionBusinessQueues(f.boss);let sourceCalls=0;
  const stop=await registerBusinessWorker(f.boss,f.db,{}, {'sources.schedule':async()=>{sourceCalls++;throw new Error('MISSING_DISABLED_CONFIG');},'ops.recover':async()=>({}),'ops.alerts':async()=>({})},{sourceScheduleEnabled:false});
  await new Promise(r=>setTimeout(r,650));assert.equal(sourceCalls,0);
  const schedules=await f.boss.getSchedules();assert.equal(schedules.length,2);assert.ok(schedules.every(s=>s.name!=='sources.schedule'));
  await stop();
 }finally{await f.dispose();}
});
test('业务模型父进程可执行受控资料读取函数，API队列角色不获得该权限',async()=>{const f=await fixture(),role=`queue_material_${randomUUID().replaceAll('-','')}`;try{
 await f.db.query(`CREATE ROLE ${role} NOLOGIN`);await f.db.query("CREATE FUNCTION platform.current_model_material(uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$; CREATE FUNCTION platform.current_model_materials(uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$; REVOKE ALL ON FUNCTION platform.current_model_material(uuid),platform.current_model_materials(uuid) FROM PUBLIC");
 await grantBusinessQueueRole(f.db,role,true);
 const privileges=(await f.db.query("SELECT has_function_privilege($1,'platform.current_model_material(uuid)','EXECUTE') AS one,has_function_privilege($1,'platform.current_model_materials(uuid)','EXECUTE') AS many",[role])).rows[0];assert.deepEqual(privileges,{one:true,many:true});
 }finally{await f.db.query(`DROP OWNED BY ${role}`);await f.db.query(`DROP ROLE ${role}`);await f.dispose();}});
