import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {eventFixture,preparedCandidate} from './event-fixture.js';
import {TaskResults} from '../information-ingestion/processing/task-results.js';
import {TaskManagement} from '../information-ingestion/processing/tasks.js';
import {ExecutionStore} from '../information-ingestion/processing/execution.js';
import {buildServer} from '../runtime/server.js';

test('持久结果按版本、Fact、Event去重，任务范围不混入累计且遵守读取权限',async()=>{
 const f=await eventFixture();const runtime=new Pool({connectionString:f.urlFor('DATABASE_URL')});let app:Awaited<ReturnType<typeof buildServer>>|undefined;
 try{
  const results=new TaskResults(new ExecutionStore(runtime,f.artifacts));
  let row=await results.read('review-operator');assert.equal(row.saved_versions,1);assert.equal(row.extraction_pending,1);assert.equal(row.events,0);
  await f.db.query("UPDATE information.processing_runs SET extraction_status='completed',candidate_count=1 WHERE id=$1",[f.old.id]);
  await f.service.acceptExtraction(f.full.id,1,{candidates:[f.candidate],warnings:[]});
  const candidate=await preparedCandidate(f);await candidate.commit.commitCandidate(candidate.id,candidate.generation,candidate.key);
  // A retry operation refers to the same fixed version, so it cannot double the results.
  await f.db.query("INSERT INTO information.operations(parent_id,kind,source_id,source_version,actor,command_artifact_id,url,version_id,processing_id) SELECT parent_id,kind,source_id,source_version,actor,command_artifact_id,url||'?retry',version_id,processing_id FROM information.operations WHERE id=$1",[f.old.child]);
  row=await results.read('review-operator',f.parent.id);assert.equal(row.saved_versions,1);assert.equal(row.facts,1);assert.equal(row.events,1);assert.equal(row.extraction_completed,1);assert.equal(row.no_event,0);assert.equal(row.full_processing_versions,1);assert.equal(row.full_processing_candidates,1);
  const fresh=await new TaskManagement(f.repo).create('review-operator',randomUUID(),{source_keys:['wiki-source-001'],limit:1});
  assert.equal((await results.read('review-operator',fresh.id)).saved_versions,0);assert.equal((await results.read('review-operator')).events,1);
  await f.db.query("INSERT INTO platform.actors SELECT 'riskhot-local-operator',permissions,source_keys FROM platform.actors WHERE subject='review-operator'");
  app=await buildServer(new ExecutionStore(runtime,f.artifacts),{mode:'local',origin:'http://localhost:18081'});
  const get=(url:string)=>app!.inject({url,headers:{host:'localhost:18081'}});
  const response=await get('/api/v1/l0/task-results');assert.equal(response.statusCode,200,response.body);assert.equal(response.json().facts,1);
  assert.equal((await get(`/api/v1/l0/task-batches/${f.parent.id}/results`)).json().events,1);
  assert.equal((await get('/api/v1/l0/task-batches/not-valid/results')).statusCode,400);
  await f.db.query("UPDATE platform.actors SET source_keys='{}' WHERE subject='review-operator'");
  row=await results.read('review-operator');for(const field of ['saved_versions','facts','events','full_processing_versions'])assert.equal(row[field],0,field);
  await assert.rejects(()=>results.read('review-operator',f.parent.id),(error:any)=>error.status===404);
 }finally{await app?.close();await runtime.end();await f.dispose();}
});

test('每份资料只取最新抽取状态，失败与待复核不计为无事件',async()=>{
 const f=await eventFixture();try{
  const results=new TaskResults(f.repo);
  await f.db.query("UPDATE information.processing_runs SET extraction_status='completed',candidate_count=0 WHERE id=$1",[f.old.id]);
  let row=await results.read('review-operator');assert.equal(row.no_event,1);assert.equal(row.extraction_completed,1);
  const newRun=(await f.db.query("INSERT INTO information.processing_runs(version_id,analysis_key,processing_scope,extraction_status,candidate_count,created_at) VALUES($1,'RETEST','EXTRACTION_ONLY','recoverable',NULL,now()+interval '1 second') RETURNING id",[f.old.version])).rows[0];
  row=await results.read('review-operator');assert.equal(row.no_event,0);assert.equal(row.extraction_completed,0);assert.equal(row.extraction_recoverable,1);assert.equal(row.extraction_pending,0);
  await f.db.query("UPDATE information.processing_runs SET extraction_status='review' WHERE id=$1",[newRun.id]);
  row=await results.read('review-operator');assert.equal(row.extraction_review,1);assert.equal(row.no_event,0);assert.equal(row.saved_versions,1);
 }finally{await f.dispose();}
});
