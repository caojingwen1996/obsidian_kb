import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {eventFixture,preparedCandidate} from './event-fixture.js';import {buildServer} from '../runtime/server.js';
test('完整事件API提供真实进度和复核依据，越权及非法写请求被拒绝',async()=>{const f=await eventFixture();await f.db.query("INSERT INTO platform.actors SELECT 'riskhot-local-operator',permissions,source_keys FROM platform.actors WHERE subject='review-operator'");const app=await buildServer(f.repo,{mode:'local',origin:'http://localhost:18081'});const headers={host:'localhost:18081',origin:'http://localhost:18081','idempotency-key':randomUUID()};try{await f.service.acceptExtraction(f.full.id,1,{candidates:[f.candidate],warnings:[]});let r=await app.inject({url:`/api/v1/l0/event-processings/${f.full.id}`,headers});assert.equal(r.statusCode,200,r.body);assert.equal(r.json().counts.pending,1);const c=r.json().candidates[0].id;r=await app.inject({url:`/api/v1/l0/candidates/${c}`,headers});assert.equal(r.statusCode,200,r.body);assert.match(r.json().disposition_basis_digest,/^[a-f0-9]{64}$/);assert.equal((await app.inject({url:'/api/v1/l0/events?limit=101',headers})).statusCode,422);await f.db.query("UPDATE platform.actors SET permissions=ARRAY['read'] WHERE subject='riskhot-local-operator'");assert.equal((await app.inject({method:'POST',url:`/api/v1/l0/candidates/${c}/reviews`,headers,payload:{scope:'disposition',proposal_generation:1,proposal_digest:r.json().disposition_basis_digest,decision:'CONFIRM_NOT_EVENT',reason:'test'}})).statusCode,403);await f.db.query("UPDATE platform.actors SET source_keys=ARRAY['other'] WHERE subject='riskhot-local-operator'");assert.equal((await app.inject({url:`/api/v1/l0/event-processings/${f.full.id}`,headers})).statusCode,403);}finally{await app.close();await f.dispose();}});
test('授权重算另建父处理身份，取消和文件重试保留原结果',async()=>{const f=await eventFixture();await f.db.query("INSERT INTO platform.actors SELECT 'riskhot-local-operator',permissions||ARRAY['event_recompute'],source_keys FROM platform.actors WHERE subject='review-operator'");const app=await buildServer(f.repo,{mode:'local',origin:'http://localhost:18081'});const headers={host:'localhost:18081',origin:'http://localhost:18081','idempotency-key':randomUUID()};try{const response=await app.inject({method:'POST',url:`/api/v1/l0/processings/${f.full.id}/recomputations`,headers,payload:{reason:'受控授权重算',task_manifest_id:'f02-fact-draft-v2'}});assert.equal(response.statusCode,202,response.body);assert.notEqual(response.json().id,f.full.id);const row=(await f.db.query('SELECT * FROM information.processing_runs WHERE id=$1',[response.json().id])).rows[0];assert.equal(row.parent_processing_id,f.full.id);assert.equal(row.processing_scope,'FULL_EVENT');assert.ok(await f.service.material(row.id));}finally{await app.close();await f.dispose();}});

test('正式事件、关联事实、交付列表和下载均使用新模型',async()=>{const f=await eventFixture();let app:Awaited<ReturnType<typeof buildServer>>|undefined;try{await f.db.query("INSERT INTO platform.actors SELECT 'riskhot-local-operator',permissions,source_keys FROM platform.actors WHERE subject='review-operator'");await f.service.acceptExtraction(f.full.id,1,{candidates:[f.candidate],warnings:[]});const c=await preparedCandidate(f),receipt=await c.commit.commitCandidate(c.id,c.generation,c.key),effect=receipt.effects[0]!;const {EventDelivery}=await import('../event-management/delivery.js');await new EventDelivery(f.repo).reconcile();app=await buildServer(f.repo,{mode:'local',origin:'http://localhost:18081'});const headers={host:'localhost:18081',origin:'http://localhost:18081'};for(const path of [`events/${effect.event_id}`,`events/${effect.event_id}/deliveries`,`events/${effect.event_id}/file`,`facts/${effect.fact_id}`,`versions/${f.old.version}/facts`,`event-deliveries/${effect.message_id}/files/event`]){const response:{statusCode:number;body:string}=await app.inject({url:'/api/v1/l0/'+path,headers});assert.equal(response.statusCode,200,response.body);}const deliveries=(await app.inject({url:`/api/v1/l0/events/${effect.event_id}/deliveries`,headers})).json();assert.equal(deliveries.items[0].application_status,'applied');assert.equal((await app.inject({url:`/api/v1/l0/events/${effect.event_id}/revisions`,headers})).statusCode,404);}finally{await app?.close();await f.dispose();}});

test('时间线全局排序后偏移分页，多Fact/修订去重，权限与详情一致',async()=>{
 const {seedTimeline}=await import('./event-timeline-fixture.js');
 const f=await eventFixture();let app:Awaited<ReturnType<typeof buildServer>>|undefined;
 try{
  const seeded=await seedTimeline(f);
  await f.db.query("INSERT INTO platform.actors VALUES('riskhot-local-operator',ARRAY['read'],ARRAY['*'])");
  app=await buildServer(f.repo,{mode:'local',origin:'http://localhost:18081'});const headers={host:'localhost:18081'};
  const first=await app.inject({url:'/api/v1/l0/events',headers});assert.equal(first.statusCode,200,first.body);
  const page=first.json(),second=(await app.inject({url:`/api/v1/l0/events?cursor=${page.next_cursor}`,headers})).json();
  assert.equal(page.items.length,20);assert.equal(second.items.length,5);assert.equal(second.next_cursor,null);
  const all=[...page.items,...second.items];assert.equal(new Set(all.map(x=>x.id)).size,25);
  assert.equal(all.at(-1).id,seeded.ids[0]);assert.equal(all.at(-1).display_time,'2026-01-01T00:00:00.000Z');
  assert.equal(all[0].id,seeded.ids[1]);assert.equal(all[0].event_time,'2026');
  const multi=all.find(x=>x.id===seeded.ids[2]);assert.equal(multi.sources.length,2);assert.equal(multi.sources[0].name,multi.sources[1].name);assert.notEqual(multi.sources[0].id,multi.sources[1].id);assert.equal(multi.time_version_id,seeded.versions[2]);assert.equal(multi.first_collected_at,'2026-10-25T08:00:00.000Z');
  await f.db.query("UPDATE information.event SET updated_at=now() WHERE id=$1",[seeded.ids[0]]);
  assert.equal((await app.inject({url:'/api/v1/l0/events?cursor=20',headers})).json().items.at(-1).id,seeded.ids[0]);
  await f.db.query("UPDATE platform.actors SET source_keys=ARRAY['wiki-source-001'] WHERE subject='riskhot-local-operator'");
  const limited=(await app.inject({url:'/api/v1/l0/events?limit=100',headers})).json();assert.equal(limited.items.length,24);assert.ok(!limited.items.some((x:any)=>x.id===multi.id));assert.ok(!JSON.stringify(limited).includes('wiki-source-002'));
  assert.equal((await app.inject({url:`/api/v1/l0/events/${multi.id}`,headers})).statusCode,403);
 }finally{await app?.close();await f.dispose();}
});

test('首次收录链缺失或工件、时间、操作不一致时接口采用同版原文时间',async()=>{
 const {seedTimeline}=await import('./event-timeline-fixture.js');const f=await eventFixture();let app:Awaited<ReturnType<typeof buildServer>>|undefined;
 try{
  const {ids,versions}=await seedTimeline(f,5);
  await f.db.query("INSERT INTO platform.actors VALUES('riskhot-local-operator',ARRAY['read'],ARRAY['*'])");
  await f.db.query('DELETE FROM information.material_version_origins WHERE version_id=$1',[versions[0]]);
  await f.db.query('UPDATE information.acquisitions a SET raw_artifact_id=v.normalized_artifact_id FROM information.material_version_origins o JOIN information.material_versions v ON v.id=o.version_id WHERE a.id=o.acquisition_id AND o.version_id=$1',[versions[1]]);
  await f.db.query("UPDATE information.material_version_origins SET collected_at=collected_at+interval '1 second' WHERE version_id=$1",[versions[3]]);
  await f.db.query('UPDATE information.material_version_origins SET operation_id=$2 WHERE version_id=$1',[versions[4],f.parent.id]);
  app=await buildServer(f.repo,{mode:'local',origin:'http://localhost:18081'});
  const response=await app.inject({url:'/api/v1/l0/events',headers:{host:'localhost:18081'}});assert.equal(response.statusCode,200,response.body);
  for(const index of [0,1,3,4]){
   const item=response.json().items.find((x:any)=>x.id===ids[index]);
   const {published_at_text:p}=(await f.db.query('SELECT published_at_text FROM information.material_versions WHERE id=$1',[versions[index]])).rows[0];
   assert.equal(item.time_version_id,versions[index]);assert.equal(item.first_collected_at,null);assert.equal(item.display_time_basis,'published');assert.equal(item.display_time,new Date(p).toISOString());assert.equal(item.published_at_text,p);assert.match(item.display_time_reason,/首次收录时间待核实/);
  }
 }finally{await app?.close();await f.dispose();}
});

test('较早无事件证据版本不贡献C或P，接口按实际证据后版配对',async()=>{
 const {seedTimeline}=await import('./event-timeline-fixture.js');const f=await eventFixture();let app:Awaited<ReturnType<typeof buildServer>>|undefined;
 try{
  const {ids,versions}=await seedTimeline(f,1),old=versions[0]!,version=randomUUID(),operation=randomUUID(),acquisition=randomUUID();
  const client=await f.db.connect();try{await client.query('BEGIN');
   await client.query(`INSERT INTO information.material_versions(id,material_id,version_no,raw_artifact_id,normalized_artifact_id,content_digest,normalizer_version,title,published_at_text) SELECT $1,material_id,version_no+1,raw_artifact_id,normalized_artifact_id,$2,normalizer_version,title,'2026-10-27T09:00:00Z' FROM information.material_versions WHERE id=$3`,[version,randomUUID(),old]);
   await client.query('INSERT INTO information.material_segments SELECT $1,id,ordinal,text,raw_locator,kind FROM information.material_segments WHERE version_id=$2',[version,old]);
   await client.query(`INSERT INTO information.operations(id,kind,source_id,source_version,actor,command_artifact_id,raw_artifact_id,normalized_artifact_id,version_id) SELECT $1,p.kind,p.source_id,p.source_version,p.actor,p.command_artifact_id,p.raw_artifact_id,p.normalized_artifact_id,$2 FROM information.operations p JOIN information.material_version_origins o ON o.operation_id=p.id WHERE o.version_id=$3`,[operation,version,old]);
   await client.query("INSERT INTO information.acquisitions(id,operation_id,raw_artifact_id,acquired_at) SELECT $1,$2,raw_artifact_id,'2026-10-27T10:00:00Z' FROM information.material_versions WHERE id=$3",[acquisition,operation,version]);
   await client.query("INSERT INTO information.material_version_origins(version_id,source_id,source_version,operation_id,acquisition_id,collected_at,previous_version_id,version_kind,basis) SELECT $1,source_id,source_version,$2,$3,'2026-10-27T10:00:00Z',version_id,'source_revision','saved' FROM information.material_version_origins WHERE version_id=$4",[version,operation,acquisition,old]);
   await client.query('UPDATE information.fact_evidence SET information_version_id=$1 WHERE information_version_id=$2',[version,old]);
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  await f.db.query("INSERT INTO platform.actors VALUES('riskhot-local-operator',ARRAY['read'],ARRAY['*'])");app=await buildServer(f.repo,{mode:'local',origin:'http://localhost:18081'});
  const response=await app.inject({url:'/api/v1/l0/events',headers:{host:'localhost:18081'}});assert.equal(response.statusCode,200,response.body);
  const item=response.json().items.find((x:any)=>x.id===ids[0]);assert.equal(item.time_version_id,version);assert.equal(item.first_collected_at,'2026-10-27T10:00:00.000Z');assert.equal(item.published_at,'2026-10-27T09:00:00.000Z');assert.equal(item.display_time,item.first_collected_at);assert.equal(item.display_time_basis,'first_collected');
 }finally{await app?.close();await f.dispose();}
});

test('接口先排完整日期再排较新月年及未知，分层后分页无跨层错位',async()=>{
 const {seedTimeline}=await import('./event-timeline-fixture.js');const f=await eventFixture();let app:Awaited<ReturnType<typeof buildServer>>|undefined;
 try{
  const {ids}=await seedTimeline(f,5),values=['2020-01-01','2019-01-01T08:00:00Z','2031','2030-12',null];
  await f.db.query('DELETE FROM information.material_version_origins');
  for(let i=0;i<ids.length;i++)await f.db.query('UPDATE information.material_versions SET published_at_text=$2 WHERE id IN(SELECT fe.information_version_id FROM information.event_fact ef JOIN information.fact_evidence fe ON fe.fact_id=ef.fact_id WHERE ef.event_id=$1)',[ids[i],values[i]]);
  await f.db.query("INSERT INTO platform.actors VALUES('riskhot-local-operator',ARRAY['read'],ARRAY['*'])");app=await buildServer(f.repo,{mode:'local',origin:'http://localhost:18081'});
  type TimelinePage={items:Array<{id:string;display_time_precision:string}>;next_cursor:number|null};
  const pages:TimelinePage[]=[];for(const cursor of [0,2,4]){const response:{statusCode:number;body:string;json:()=>TimelinePage}=await app.inject({url:`/api/v1/l0/events?limit=2&cursor=${cursor}`,headers:{host:'localhost:18081'}});assert.equal(response.statusCode,200,response.body);pages.push(response.json());}
  assert.deepEqual(pages.flatMap(p=>p.items.map((x:any)=>x.id)),ids);assert.deepEqual(pages.map(p=>p.next_cursor),[2,4,null]);assert.deepEqual(pages.flatMap(p=>p.items.map((x:any)=>x.display_time_precision)),['day','instant','year','month','unknown']);
 }finally{await app?.close();await f.dispose();}
});
