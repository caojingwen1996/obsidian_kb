import {createServer} from 'node:http';
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {readFile,mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Pool} from 'pg';import PgBoss from 'pg-boss';import Fastify from 'fastify';
import {Repository} from '../information-ingestion/processing/repository.js';import {ArtifactStore} from '../platform/artifacts.js';
import {applyF02Migration} from '../platform/f02-migration.js';import {transaction} from '../platform/db.js';
import {dispatchCurrentExecution,readCurrentExecutionInput} from '../platform/current-dispatch.js';
import {registerCurrentEvents} from '../runtime/current-events.js';
import {reserveCurrentModel,readCurrentInput,type CurrentModelReference} from '../event-management/current-model.js';

test('新引擎实际资料重试接口原子投递新代次Job并从永久输入还原资料',async()=>{
 const admin=new Pool({connectionString:process.env.ADMIN_DATABASE_URL});const name=`riskhot_material_retry_${randomUUID().replaceAll('-','')}`;await admin.query(`CREATE DATABASE ${name}`);
 const url=new URL(process.env.ADMIN_DATABASE_URL!);url.pathname=`/${name}`;const db=new Pool({connectionString:url.href});const folder=await mkdtemp(join(tmpdir(),'riskhot-material-retry-'));
 const boss=new PgBoss({connectionString:url.href,schedule:false,supervise:false});boss.on('error',()=>{});const app=Fastify();const prior=process.env.EXECUTION_ENGINE;process.env.EXECUTION_ENGINE='pg-boss';
 try{
  await db.query(await readFile('src/db/005-ingestion.sql','utf8'));await applyF02Migration(db);await db.query(await readFile('src/db/009-business-queue.sql','utf8'));await boss.start();await boss.createQueue('information.extract');
  await db.query("INSERT INTO platform.actors VALUES('retry-actor',ARRAY['read','submit','retry'],ARRAY['*'])");
  const sid=(await db.query("INSERT INTO m1.sources(catalog_key,name,url,metadata,state) VALUES('test','测试','','{}','ACTIVE') RETURNING id")).rows[0].id;
  const content={title:'测试',url:'',normalizerVersion:'v1',publishedAtText:null,segments:[{id:randomUUID(),text:'正文',kind:'paragraph',rawLocator:'1'}]};
  const m=(await db.query("INSERT INTO infomation.ingestion_material(source_id,identity,content,content_digest,normalizer_rule,extraction_result) VALUES($1,'test',$2,repeat('a',64),'v1','{\"status\":\"recoverable\"}') RETURNING *",[sid,content])).rows[0];
  const repo=new Repository(db,new ArtifactStore(folder));
  await transaction(db,tx=>dispatchCurrentExecution(tx,{kind:'material-extract',owner_id:m.id,generation:1,workflow_id:'material/first',input:{material_id:m.id,version:1,content_digest:m.content_digest,actor:'retry-actor'}}));
  app.decorateRequest('actor','retry-actor');registerCurrentEvents(app,repo);
  const response=await app.inject({method:'POST',url:`/api/v1/l0/material/${m.id}/extraction/retry`,headers:{'idempotency-key':randomUUID()},payload:{version:1,content_digest:m.content_digest,reason:'恢复',open_budget:false}});
  assert.equal(response.statusCode,202,response.body);
  assert.equal((await db.query('SELECT * FROM platform.execution_intents')).rowCount,0);
  const jobs=await boss.fetch<{execution_generation:number}>('information.extract',{batchSize:5});assert.ok(jobs.some(j=>j.data.execution_generation===2));
  const basis=await readCurrentExecutionInput(db,'material-extract',m.id,2);assert.equal(basis?.material_id,m.id);
  assert.equal(await readCurrentExecutionInput(db,'material-extract',m.id,1),undefined);
  const material_ref={material_id:m.id,version:1,content_digest:m.content_digest};
  const {advanceBusinessMaterialExtraction}=await import('../runtime/business-material.js');
  let calls=0;let fail=true;
  const http=createServer((_req,res)=>{calls++;res.statusCode=fail?503:200;res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({candidates:[],warnings:[]})}}]}));});
  await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));const endpoint='http://127.0.0.1:'+(http.address() as {port:number}).port;
  const saved=Object.fromEntries(['MODEL_API_KEY','MODEL_PROTOCOL','MODEL_ENDPOINT','MODEL_NAME'].map(k=>[k,process.env[k]]));
  Object.assign(process.env,{MODEL_API_KEY:'controlled',MODEL_PROTOCOL:'openai-chat',MODEL_ENDPOINT:endpoint,MODEL_NAME:'test'});
  const a=await reserveCurrentModel(repo,'retry-actor',material_ref,'material',m.id,2,{version_id:m.id,material_ref,material:m.content,manifest:{task_id:'AI-01',prompt:'受控测试',provider:{protocol:'openai-chat',endpoint,model:'test'}}},'workflow-0');
  const row=(await db.query('SELECT request_artifact_id FROM platform.model_attempts WHERE id=$1',[a.id])).rows[0];
  const restored=await readCurrentInput(repo,await repo.json<CurrentModelReference>(row.request_artifact_id));assert.equal(restored.material_ref?.material_id,m.id);assert.deepEqual(restored.material,m.content);

  try{
   const failed=await advanceBusinessMaterialExtraction(repo,m.id,2);assert.equal(failed.state,'recoverable');assert.equal(calls,1);
   const again=await advanceBusinessMaterialExtraction(repo,m.id,2);assert.equal(again.state,'recoverable');assert.equal(calls,2,JSON.stringify(again));
   fail=false;
   const {currentExtractionActivities}=await import('../runtime/current-extraction.js');const prepared=await currentExtractionActivities(repo).prepareCurrentExtraction(m.id,2,2);
   const {invokeReservedBusinessModel}=await import('../runtime/business-model.js');await invokeReservedBusinessModel(repo,prepared.attempt!.id);assert.equal(calls,3);
   const complete=await advanceBusinessMaterialExtraction(repo,m.id,2);assert.equal(complete.state,'succeeded');assert.equal(calls,3);
   assert.equal((await advanceBusinessMaterialExtraction(repo,m.id,2)).state,'succeeded');assert.equal(calls,3);
   assert.equal((await db.query("SELECT used FROM platform.model_budget_windows WHERE owner_kind='material' AND owner_id=$1 AND task_id='AI-01'",[m.id])).rows[0].used,3);
  }finally{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await new Promise<void>((r,j)=>http.close(e=>e?j(e):r()));}
 }finally{if(prior===undefined)delete process.env.EXECUTION_ENGINE;else process.env.EXECUTION_ENGINE=prior;await app.close();await boss.stop({wait:true});await db.end();await admin.query(`DROP DATABASE ${name}`);await admin.end();await rm(folder,{recursive:true,force:true});}
});
