import PgBoss from 'pg-boss';
import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';import {readFile,mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createServer} from 'node:http';
import {applyF02Migration} from '../platform/f02-migration.js';
import {Pool} from 'pg';import {ArtifactStore} from '../platform/artifacts.js';import {Repository} from '../information-ingestion/processing/repository.js';import type {TaskInput} from '../information-ingestion/processing/model.js';

test('业务模型实际受限子进程调用、永久响应复用，失败计次且不自动重试',async()=>{
 const {callBusinessModel,invokeReservedBusinessModel}=await import('../runtime/business-model.js');
 const admin=new Pool({connectionString:process.env.ADMIN_DATABASE_URL});const name=`riskhot_business_model_${randomUUID().replaceAll('-','')}`;
 await admin.query(`CREATE DATABASE ${name}`);const url=new URL(process.env.ADMIN_DATABASE_URL!);url.pathname=`/${name}`;const db=new Pool({connectionString:url.href});const folder=await mkdtemp(join(tmpdir(),'riskhot-business-model-'));
 let calls=0;let fail=false;
 const server=createServer((req,res)=>{calls++;assert.equal(req.headers.authorization,'Bearer controlled-model-key');res.setHeader('Content-Type','application/json');res.statusCode=fail?503:200;res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({answer:'saved'})}}]}));});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as {port:number}).port;
 const oldKey=process.env.MODEL_API_KEY;process.env.MODEL_API_KEY='controlled-model-key';
 try{
  await db.query(await readFile('src/db/005-ingestion.sql','utf8'));await applyF02Migration(db);await db.query(await readFile('src/db/009-business-queue.sql','utf8'));
  await db.query("INSERT INTO platform.actors VALUES('model-reader',ARRAY['read','submit','event_submit'],ARRAY['*'])");
  const source=(await db.query("INSERT INTO m1.sources(catalog_key,name,url,metadata,state) VALUES('test','测试','','{}','ACTIVE') RETURNING id")).rows[0].id;
  const material={title:'模型测试',url:'',normalizerVersion:'test',publishedAtText:null,segments:[{id:randomUUID(),kind:'paragraph' as const,text:'央行发布政策',rawLocator:'1'}]};
  const m=(await db.query("INSERT INTO infomation.ingestion_material(source_id,identity,content,content_digest,normalizer_rule) VALUES($1,'test',$2,'digest','test') RETURNING *",[source,material])).rows[0];
  const c=(await db.query("INSERT INTO information.event_candidates(material_id,material_version,material_digest,actor,ordinal,payload) VALUES($1,1,'digest','model-reader',0,'{}') RETURNING id",[m.id])).rows[0].id;
  const repo=new Repository(db,new ArtifactStore(folder));const input:TaskInput={version_id:m.id,material_ref:{material_id:m.id,version:1,content_digest:'digest'},material,manifest:{task_id:'AI-08',prompt:'test',provider:{protocol:'openai-chat',endpoint:`http://127.0.0.1:${port}`,model:'controlled'}}};
  assert.deepEqual(await callBusinessModel(repo,c,1,input),{answer:'saved'});
  assert.deepEqual(await callBusinessModel(repo,c,1,input),{answer:'saved'});assert.equal(calls,1);
  fail=true;
  for(const prompt of ['retry','retry'])await assert.rejects(()=>callBusinessModel(repo,c,1,{...input,manifest:{...input.manifest,prompt}}),/MODEL_HTTP_503/);
  assert.equal(calls,3);
  await assert.rejects(()=>callBusinessModel(repo,c,1,{...input,manifest:{...input.manifest,prompt:'four'}}),/MODEL_BUDGET_EXHAUSTED/);
  assert.equal(calls,3);assert.equal((await db.query('SELECT sum(used)::int AS n FROM platform.model_budget_windows')).rows[0].n,3);
  fail=false;
  const {reserveCurrentModel}=await import('../event-management/current-model.js');
  const reserved=await reserveCurrentModel(repo,'model-reader',input.material_ref!,'material',m.id,1,input);
  await invokeReservedBusinessModel(repo,reserved.id);await invokeReservedBusinessModel(repo,reserved.id);
  assert.equal(calls,4);assert.equal((await db.query("SELECT used FROM platform.model_budget_windows WHERE owner_kind='material'")).rows[0].used,1);
  const {loadEightStepTask}=await import('../event-management/eight-step-packages.js');const associationPackage=loadEightStepTask('AI-04');
  const associationInput={...input,manifest:{...input.manifest,task_id:'AI-04',prompt:associationPackage.prompt,output_schema:associationPackage.schema,task_package:associationPackage}};
  await db.query("UPDATE information.event_candidates SET status='completed' WHERE id=$1",[c]);
  await assert.rejects(()=>callBusinessModel(repo,c,1,associationInput),/STALE_EXECUTION/);
  const {transaction}=await import('../platform/db.js');let formalEventId='';
  await transaction(db,async tx=>{
   const eid=(await tx.query("INSERT INTO information.event(title,description,subject,action,event_status) VALUES('正式事件','说明','主体','行动','announced') RETURNING id")).rows[0].id;formalEventId=eid;
   const fid=(await tx.query("INSERT INTO information.fact(title,description,subject,action,event_status,event_id,event_relation_role,event_relation_note,event_assigned_at) VALUES('事实','说明','主体','行动','announced',$1,'initial','首次',now()) RETURNING id",[eid])).rows[0].id;
   await tx.query("INSERT INTO information.fact_material(fact_id,material_id,relation_role) VALUES($1,$2,'supporting')",[fid,m.id]);
   await tx.query("INSERT INTO infomation.ingestion_material_segments VALUES($1,$2,0,$3,'{}')",[m.id,material.segments[0]!.id,material.segments[0]!.text]);
   await tx.query("INSERT INTO information.fact_evidence(fact_id,information_id,material_id,material_version,material_digest,segment_id,start_cp,end_cp,quote,evidence_role) VALUES($1,$2,$2,1,'digest',$3,0,6,'央行发布政策','supporting')",[fid,m.id,material.segments[0]!.id]);
   await tx.query('INSERT INTO information.candidate_fact(candidate_id,fact_id) VALUES($1,$2)',[c,fid]);
  });
  await assert.rejects(()=>callBusinessModel(repo,c,1,input),/STALE_EXECUTION/);
  assert.deepEqual(await callBusinessModel(repo,c,1,associationInput),{answer:'saved'});assert.equal(calls,5);

  const {recoverEnrichmentRuns,scheduleEnrichmentRecovery}=await import('../runtime/business-recovery.js');
  const {enqueueBusinessJob}=await import('../platform/business-queue.js');
  const boss=new PgBoss({connectionString:url.href,schedule:false,supervise:false});boss.on('error',()=>{});await boss.start();await boss.createQueue('events.enrich');
  try{
   const e={task_type:'events.enrich',payload_version:1,run_id:randomUUID(),owner_module:'F02',owner_ref:{id:c},operation_key:'association/'+c,execution_generation:1,input_digest:'fixed',manifest_ref:'f02-eight-step-v1',correlation_id:null,causation_id:null,trigger_kind:'event-saved',payload:{candidate_id:c,event_id:formalEventId}};
   let receipt=await transaction(db,tx=>enqueueBusinessJob(tx,e));
   for(let n=1;n<=3;n++){
    await boss.deleteJob(e.task_type,receipt.job_id);
    await db.query("UPDATE platform.task_runs SET runtime_state='recoverable' WHERE run_id=$1",[e.run_id]);
    await transaction(db,tx=>scheduleEnrichmentRecovery(tx,e,'recoverable'));
    await db.query("UPDATE platform.task_runs SET next_eligible_at=now()-interval '1 second' WHERE run_id=$1 AND next_eligible_at IS NOT NULL",[e.run_id]);
    const results=await Promise.all([recoverEnrichmentRuns(db),recoverEnrichmentRuns(db)]);
    assert.equal(results.reduce((a,b)=>a+b,0),n<3?1:0);
    const last=(await db.query('SELECT run_id,dispatch_id,job_id FROM platform.task_dispatches WHERE run_id=$1 ORDER BY dispatch_seq DESC LIMIT 1',[e.run_id])).rows[0];receipt=last;
   }
   assert.equal((await db.query('SELECT count(*)::int n FROM platform.task_dispatches WHERE run_id=$1',[e.run_id])).rows[0].n,3);
  }finally{await boss.stop({wait:true});}
  await db.query("UPDATE platform.actors SET source_keys=ARRAY['denied'] WHERE subject='model-reader'");
  await assert.rejects(()=>callBusinessModel(repo,c,1,input),/FORBIDDEN/);assert.equal(calls,5);
 }finally{
  if(oldKey===undefined)delete process.env.MODEL_API_KEY;else process.env.MODEL_API_KEY=oldKey;
  await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));await db.end();await admin.query(`DROP DATABASE ${name}`);await admin.end();await rm(folder,{recursive:true,force:true});
 }
});

test('完成候选仅正式归属的新AI04包可保留模型调用，其他任务和旧包继续拒绝',async()=>{
 const {isPostCommitAssociation}=await import('../event-management/current-model.js');
 const {loadEightStepTask}=await import('../event-management/eight-step-packages.js');
 const p=loadEightStepTask('AI-04');
 const input={manifest:{task_id:'AI-04',prompt:p.prompt,output_schema:p.schema,task_package:p}} as unknown as TaskInput;
 assert.equal(isPostCommitAssociation(input),true);
 assert.equal(isPostCommitAssociation({...input,manifest:{...input.manifest,task_id:'AI-05'}}),false);
 assert.equal(isPostCommitAssociation({...input,manifest:{...input.manifest,task_package:{...p,version:'f02-fact-draft-v2'}}}),false);
 assert.equal(isPostCommitAssociation({...input,manifest:{...input.manifest,prompt:'old semantics'}}),false);
});

test('新包按o200k_base计量，31KB中文prompt可用，真实超Token或96KB拒绝',async()=>{
 const {measureCurrentModelInput}=await import('../event-management/current-model.js');
 const {loadEightStepTask}=await import('../event-management/eight-step-packages.js');const p=loadEightStepTask('AI-01');
 const input={material:{title:'',url:'',normalizerVersion:'v1',segments:[],publishedAtText:null},material_ref:{material_id:randomUUID(),version:1,content_digest:'a'.repeat(64)},version_id:randomUUID(),manifest:{task_id:'AI-01',prompt:p.prompt,output_schema:p.schema,task_package:p,provider:{protocol:'openai-chat',endpoint:'http://127.0.0.1:1',model:'test'}}} satisfies TaskInput;
 const measured=measureCurrentModelInput(input);assert.equal(measured.encoding,'o200k_base');assert.ok(measured.bytes>31000);assert.ok(measured.tokens<24000);
 assert.throws(()=>measureCurrentModelInput({...input,manifest:{...input.manifest,prompt:'𓀀'.repeat(9000)}}),/INPUT_TOKEN_BUDGET_EXCEEDED/);
 assert.throws(()=>measureCurrentModelInput({...input,manifest:{...input.manifest,prompt:'a'.repeat(96001)}}),/INPUT_BYTE_BUDGET_EXCEEDED/);
});
