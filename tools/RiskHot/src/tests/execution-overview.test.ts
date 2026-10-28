import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openFixture} from './fixture.js';
import {TaskManagement} from '../information-ingestion/processing/tasks.js';

test('execution overview keeps independent plan, active manual run and last outcome separate',async()=>{
 const c=await openFixture();
 try{
  const tasks=new TaskManagement(c.repo);
  await c.db.query('INSERT INTO platform.source_schedules(source_id,next_run_at) VALUES($1,now()+interval \'1 hour\')',[c.parent.source_id]);
  let item=(await tasks.overview('review-operator')).items[0]!;
  assert.equal(item.status,'queued');assert.equal(item.current?.id,c.parent.id);
  await c.db.query("UPDATE information.operations SET status='completed' WHERE id=$1",[c.parent.id]);
  item=(await tasks.overview('review-operator')).items[0]!;
  assert.equal(item.status,'idle');assert.equal(item.latest?.material_count,0);assert.equal(item.latest?.saved_count,0);assert.ok(item.latest?.finished_at);
  const batch=await tasks.create('review-operator',randomUUID(),{source_keys:['wiki-source-001'],limit:1});
  await c.db.query('UPDATE platform.source_schedules SET enabled=false WHERE source_id=$1',[c.parent.source_id]);
  item=(await tasks.overview('review-operator')).items[0]!;
  assert.equal(item.enabled,false);assert.equal(item.status,'queued');assert.equal(item.current?.id,batch.id);assert.equal(item.current?.trigger,'manual');assert.equal(item.latest?.id,c.parent.id);
  await tasks.control('review-operator',batch.id,randomUUID(),{action:'pause',expected_version:batch.version,reason:'controlled pause'});
  item=(await tasks.overview('review-operator')).items[0]!;assert.equal(item.status,'paused');assert.equal(item.current?.id,batch.id);
 }finally{await c.dispose();}
});

test('overview includes sources older than 100 history rows and never leaks unauthorized plans',async()=>{
 const c=await openFixture();
 try{
  const tasks=new TaskManagement(c.repo);
  await c.repo.seedCatalog([{id:'wiki-source-002',name:'受限信源',url:'https://example.test/',tier:'T1',group:'test',focus:'test',context:'test'}]);
  await c.db.query("INSERT INTO platform.actors VALUES('overview-admin',ARRAY['read'],ARRAY['*'])");
  await c.db.query("INSERT INTO platform.source_schedules(source_id,next_run_at) SELECT id,now()+interval '1 hour' FROM m1.sources");
  await c.db.query("INSERT INTO platform.schedule_runs(source_id,scheduled_at,status,error_code) SELECT s.id,now()+make_interval(secs=>n),'blocked','SOURCE_DISABLED' FROM m1.sources s CROSS JOIN generate_series(1,110) n WHERE s.catalog_key='wiki-source-002'");
  assert.equal((await tasks.list('overview-admin')).items.length,100);
  let overview=await tasks.overview('overview-admin');assert.equal(overview.items.length,2);assert.equal(overview.items.find(x=>x.catalog_key==='wiki-source-001')?.current?.id,c.parent.id);
  assert.equal(overview.items.find(x=>x.catalog_key==='wiki-source-002')?.status,'blocked');
  overview=await tasks.overview('review-operator');assert.deepEqual(overview.items.map(x=>x.catalog_key),['wiki-source-001']);
 }finally{await c.dispose();}
});

test('overview distinguishes never run, failed and successful empty discovery without changing plans',async()=>{
 const c=await openFixture();
 try{
  const tasks=new TaskManagement(c.repo);
  await c.repo.seedCatalog([{id:'wiki-source-002',name:'未执行信源',url:'https://example.test/',tier:'T1',group:'test',focus:'test',context:'test'}]);
  await c.db.query("UPDATE platform.actors SET source_keys=ARRAY['*'] WHERE subject='review-operator'");
  await c.db.query("INSERT INTO platform.source_schedules(source_id,next_run_at) SELECT id,now()+interval '1 hour' FROM m1.sources");
  await c.db.query("UPDATE information.operations SET status='recoverable',reason_code='FETCH_FAILED' WHERE id=$1",[c.parent.id]);
  let overview=await tasks.overview('review-operator');assert.equal(overview.items[0]?.status,'recoverable');assert.equal(overview.items[0]?.current,null);assert.equal(overview.items[0]?.latest?.reason_code,'FETCH_FAILED');assert.equal(overview.items[1]?.status,'never');assert.equal(overview.items[1]?.latest,null);
  await c.db.query("UPDATE information.operations SET status='completed' WHERE id=$1",[c.parent.id]);
  overview=await tasks.overview('review-operator');assert.equal(overview.items[0]?.status,'idle');assert.equal(overview.items[0]?.latest?.reason_code,null);
  assert.equal((await c.db.query('SELECT count(*)::int AS n FROM platform.source_schedules WHERE enabled AND interval_seconds=3600')).rows[0].n,2);
 }finally{await c.dispose();}
});

test('reused extraction completion time does not replace this execution result time',async()=>{
 const c=await openFixture();
 try{
  const processing=await c.processing();
  await c.repo.acceptSet(processing.id,1,{covered_segment_ids:processing.material.segments.map(s=>s.id),candidates:[],no_event_reason:'controlled background',warnings:[]});
  await c.db.query("UPDATE information.processing_runs SET completed_at='2020-01-01T00:00:00Z' WHERE id=$1",[processing.id]);
  await c.db.query("INSERT INTO platform.source_schedules(source_id,next_run_at) VALUES($1,now()+interval '1 hour')",[c.parent.source_id]);
  const item=(await new TaskManagement(c.repo).overview('review-operator')).items[0]!;
  assert.equal(item.status,'idle');assert.ok(item.latest?.finished_at);assert.ok(new Date(item.latest!.finished_at!).getTime()>=new Date(c.parent.scheduled_at).getTime());
 }finally{await c.dispose();}
});
