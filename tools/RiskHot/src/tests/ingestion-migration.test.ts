import { setTimeout } from 'node:timers/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { applyEventMigration } from '../platform/event-migration.js';
import { applyHandoffMigration } from '../platform/handoff-migration.js';
import { applyIngestionMigration, rebuildIngestionSchema, ingestionSchemaVersion } from '../platform/ingestion-migration.js';

async function fixture(legacy = true) {
  const admin = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const name = `riskhot_ingestion_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(process.env.ADMIN_DATABASE_URL!); url.pathname = `/${name}`;
  const db = new Pool({ connectionString: url.href });
  if (legacy) {
    await db.query(await readFile('src/db/001-init.sql', 'utf8'));
    await applyHandoffMigration(db); await applyEventMigration(db);
    await db.query(`INSERT INTO m1.sources(catalog_key,name,url,metadata,state,version) VALUES
      ('source-preserve','保留中文信源','https://example.invalid/', '{"tier":"T1","group":"政策"}','ACTIVE',2),
      ('source-disabled','暂停信源','', '{"tier":"T3","group":"研究"}','DISABLED',1)`);
    await db.query("INSERT INTO m1.source_versions(source_id,version,config) SELECT id,version,jsonb_build_object('state',state,'profile',metadata,'connection',jsonb_build_object('kind','blocked','readiness','needs_adapter')) FROM m1.sources");
    await db.query("INSERT INTO platform.actors VALUES('old-actor',ARRAY['read'],ARRAY['*'])");
    await db.query("INSERT INTO platform.audit_log(actor,action) VALUES('old-actor','old-marker')");
  }
  return { db, async dispose() { await db.end();
    for (let i=0; i<100 && (await admin.query('SELECT 1 FROM pg_stat_activity WHERE datname=$1',[name])).rowCount; i++) await setTimeout(10);
    await admin.query(`DROP DATABASE ${name}`); await admin.end(); } };
}

test('schema4显式重建保留全部信源字段，删除旧数据与取消表，并为每源建立关闭计划', async () => {
  const c = await fixture();
  try {
    const before = (await c.db.query('SELECT * FROM m1.sources ORDER BY id')).rows;
    await assert.rejects(() => applyIngestionMigration(c.db), /INGESTION_EXPLICIT_REBUILD_REQUIRED/);
    await rebuildIngestionSchema(c.db, { workflowFence: 'isolated-fixture-no-workflows' });
    assert.equal(await ingestionSchemaVersion(c.db), 5);
    const after = (await c.db.query('SELECT * FROM m1.sources ORDER BY id')).rows;
    for (let i = 0; i < before.length; i++) for (const key of Object.keys(before[i]!)) assert.deepEqual(after[i]![key], before[i]![key]);
    assert.equal((await c.db.query("SELECT count(*)::integer AS n FROM platform.audit_log WHERE action='old-marker'")).rows[0].n, 0);
    assert.equal((await c.db.query("SELECT count(*)::integer AS n FROM platform.actors WHERE subject='old-actor'")).rows[0].n, 0);
    for (const table of ['information.operations','information.processing_runs','information.acquisitions','information.materials','information.material_versions','information.material_deliveries','m1.source_versions','platform.task_batches','platform.task_batch_sources','platform.source_schedules','platform.schedule_runs']) assert.equal((await c.db.query('SELECT to_regclass($1) AS t', [table])).rows[0].t, null, table);
    assert.equal((await c.db.query('SELECT * FROM infomation.ingestion_schedules WHERE NOT enabled AND interval_seconds=86400')).rowCount, 2);
    assert.equal('current_config' in after[0]!, false);
  } finally { await c.dispose(); }
});

test('schema5普通重复初始化保留新资料，只有显式重建能清空', async () => {
  const c = await fixture();
  try {
    await rebuildIngestionSchema(c.db, { workflowFence: 'isolated-fixture' });
    await c.db.query("INSERT INTO infomation.ingestion_material(source_id,identity,content,content_digest,normalizer_rule) SELECT id,'current','{\"text\":\"正文\"}','digest','test-v1' FROM m1.sources LIMIT 1");
    await applyIngestionMigration(c.db); await applyIngestionMigration(c.db);
    assert.equal((await c.db.query('SELECT * FROM infomation.ingestion_material')).rowCount, 1);
    await rebuildIngestionSchema(c.db, { workflowFence: 'isolated-fixture' });
    assert.equal((await c.db.query('SELECT * FROM infomation.ingestion_material')).rowCount, 0);
  } finally { await c.dispose(); }
});

test('重建末尾失败回滚DDL、旧数据及信源新字段', async () => {
  const c = await fixture();
  try {
    const before = (await c.db.query('SELECT * FROM m1.sources ORDER BY id')).rows;
    await assert.rejects(() => rebuildIngestionSchema(c.db, { workflowFence: 'isolated-fixture', beforeCommit: async () => { throw new Error('INJECTED_FAILURE'); } }), /INJECTED_FAILURE/);
    assert.equal(await ingestionSchemaVersion(c.db), 4);
    assert.deepEqual((await c.db.query('SELECT * FROM m1.sources ORDER BY id')).rows, before);
    assert.equal((await c.db.query("SELECT * FROM platform.audit_log WHERE action='old-marker'")).rowCount, 1);
  } finally { await c.dispose(); }
});

test('空库可安全初始化，关系表只有身份并拒绝跨信源关联', async () => {
  const c = await fixture(false);
  try {
    await applyIngestionMigration(c.db);
    await c.db.query("INSERT INTO m1.sources(catalog_key,name,url,metadata,state) VALUES('a','甲','','{}','ACTIVE'),('b','乙','','{}','ACTIVE')");
    await c.db.query("INSERT INTO platform.actors VALUES('operator',ARRAY['read','submit'],ARRAY['*'])");
    const task = (await c.db.query("INSERT INTO infomation.ingestion_tasks(source_id,trigger_type,actor) SELECT id,'manual','operator' FROM m1.sources WHERE catalog_key='a' RETURNING id")).rows[0];
    const material = (await c.db.query("INSERT INTO infomation.ingestion_material(source_id,identity,content,content_digest,normalizer_rule) SELECT id,'one','{}','hash','v1' FROM m1.sources WHERE catalog_key='b' RETURNING id")).rows[0];
    await assert.rejects(() => c.db.query('INSERT INTO infomation.ingestion_task_material VALUES($1,$2)', [task.id, material.id]), /TASK_MATERIAL_SOURCE_MISMATCH/);
    const columns = (await c.db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='infomation' AND table_name='ingestion_task_material' ORDER BY ordinal_position")).rows.map(r => r.column_name);
    assert.deepEqual(columns, ['task_id', 'material_id']);
  } finally { await c.dispose(); }
});

test('旧迁移入口在schema5直接返回，运行权限不能读取旧表或跨入模型资料', async () => {
  const c = await fixture();
  try {
    await rebuildIngestionSchema(c.db, { workflowFence: 'isolated-fixture' });
    await applyHandoffMigration(c.db); await applyEventMigration(c.db);
    const { grantRuntimeRoles } = await import('../platform/grants.js');
    await grantRuntimeRoles(c.db);
    assert.equal((await c.db.query("SELECT to_regclass('information.material_versions') AS t")).rows[0].t, null);
    assert.equal((await c.db.query("SELECT has_table_privilege('riskhot_api','infomation.ingestion_material','SELECT') AS allowed")).rows[0].allowed, true);
    assert.equal((await c.db.query("SELECT has_table_privilege('riskhot_api','infomation.ingestion_material','INSERT') AS allowed")).rows[0].allowed, false);
    assert.equal((await c.db.query("SELECT has_table_privilege('riskhot_model','infomation.ingestion_material','SELECT') AS allowed")).rows[0].allowed, false);
  } finally { await c.dispose(); }
});

test('新任务多选逐源受理、重放复用；同计划时点只有一个自动任务', async () => {
  const c = await fixture(false);
  try {
    await applyIngestionMigration(c.db);
    const { Repository } = await import('../information-ingestion/processing/repository.js');
    const { IngestionRepository } = await import('../information-ingestion/processing/current-repository.js');
    const { ArtifactStore } = await import('../platform/artifacts.js');
    const service = new IngestionRepository(new Repository(c.db, new ArtifactStore('/tmp/riskhot-ingestion-unused')));
    await service.seedCatalog(['wiki-source-001','wiki-source-002'].map(id => ({ id, name: id, url: 'https://example.invalid/', tier: 'T1', group: '受控测试', focus: '', context: '' })));
    await c.db.query("UPDATE m1.sources SET state='ACTIVE'");
    await c.db.query("INSERT INTO platform.actors VALUES('operator',ARRAY['read','submit','event_submit'],ARRAY['*'])");
    const input = { source_keys: ['wiki-source-001','wiki-source-002'], limit: 1 };
    const first = await service.submitMany('operator', 'many-test', input);
    const second = await service.submitMany('operator', 'many-test', input);
    assert.equal(first.items.length, 2);
    assert.ok(first.items.every(r => r.accepted));
    assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)));
    assert.equal((await c.db.query('SELECT * FROM infomation.ingestion_tasks')).rowCount, 2);
    await c.db.query('UPDATE infomation.ingestion_schedules SET enabled=true');
    const scheduled = new Date('2026-10-29T00:00:00Z');
    const submissions = await Promise.allSettled([service.submit('operator','auto-a',{source_key:'wiki-source-001',limit:1},{scheduled_at:scheduled}), service.submit('operator','auto-b',{source_key:'wiki-source-001',limit:1},{scheduled_at:scheduled})]);
    for (const result of submissions) if(result.status==='rejected') throw result.reason;
    const [a,b] = submissions.map(result => result.status==='fulfilled' ? result.value : null)!;
    assert.equal(a!.id,b!.id);
    assert.equal((await c.db.query("SELECT * FROM platform.execution_intents WHERE owner_id=$1", [a!.id])).rowCount, 1);
  } finally { await c.dispose(); }
});

test('资料重复不增版本、正文变化递增、零候选有最小结果且旧依据与撤权均拒绝', async () => {
  const c = await fixture(false);
  try {
    await applyIngestionMigration(c.db);
    const { Repository } = await import('../information-ingestion/processing/repository.js');
    const { IngestionRepository } = await import('../information-ingestion/processing/current-repository.js');
    const { ArtifactStore } = await import('../platform/artifacts.js');
    const { transaction } = await import('../platform/db.js');
    const service = new IngestionRepository(new Repository(c.db, new ArtifactStore('/tmp/riskhot-ingestion-unused')));
    await service.seedCatalog([{id:'wiki-source-001',name:'受控',url:'https://www.pbc.gov.cn/',tier:'T1',group:'受控',focus:'',context:''}]);
    await c.db.query("INSERT INTO platform.actors VALUES('operator',ARRAY['read','submit','event_submit'],ARRAY['*'])");
    const task = await service.submit('operator','material',{source_key:'wiki-source-001',limit:1});
    const material = {title:'资料',publishedAtText:null,url:'https://www.pbc.gov.cn/test',normalizerVersion:'test-v1',segments:[{id:randomUUID(),text:'原始正文',rawLocator:'p:0',kind:'paragraph' as const}]};
    const a = await service.saveMaterial(task.id,1,material);
    const b = await service.saveMaterial(task.id,1,material);
    assert.equal(a.version,1); assert.equal(b.version,1); assert.equal(a!.id,b!.id);
    const old = {material_id:a.id,version:a.version,content_digest:a.content_digest};
    await service.acceptExtraction('operator',old,{candidates:[],no_event_reason:'原文不包含事件'});
    assert.equal((await service.material('operator',a.id)).extraction_result?.candidate_count,0);
    const updated = await service.saveMaterial(task.id,1,{...material,title:'已修订'});
    assert.equal(updated.version,2); assert.equal(updated.extraction_result,null);
    await assert.rejects(() => transaction(c.db, tx => service.assertBasis(tx,'operator',old)), /MATERIAL_BASIS_CHANGED/);
    await c.db.query("UPDATE platform.actors SET permissions=ARRAY['read'] WHERE subject='operator'");
    await assert.rejects(() => transaction(c.db, tx => service.assertBasis(tx,'operator',{material_id:updated.id,version:updated.version,content_digest:updated.content_digest})), /FORBIDDEN/);
    assert.equal((await c.db.query("SELECT (result_summary->>'saved_count')::integer AS saved FROM infomation.ingestion_tasks WHERE id=$1",[task.id])).rows[0].saved,1);
  } finally { await c.dispose(); }
});

test('当前档案与历史profile不一致时拒绝重建，不丢失未核对字段', async () => {
  const c = await fixture();
  try {
    await c.db.query("UPDATE m1.source_versions SET config=jsonb_set(config,'{profile,unverified_field}','\"不可丢失\"')");
    await assert.rejects(() => rebuildIngestionSchema(c.db, { workflowFence: 'isolated-fixture' }), /INGESTION_CURRENT_PROFILE_MISMATCH/);
    assert.equal(await ingestionSchemaVersion(c.db), 4);
    assert.equal((await c.db.query('SELECT * FROM m1.source_versions')).rowCount, 2);
  } finally { await c.dispose(); }
});

test('新信源无配置版本，一源一关闭计划，修改仅按更新时间拒绝过期保存', async () => {
  const c = await fixture(false);
  try {
    await applyIngestionMigration(c.db);
    const { Repository } = await import('../information-ingestion/processing/repository.js');
    const { ArtifactStore } = await import('../platform/artifacts.js');
    const { CurrentSourceManagement } = await import('../information-ingestion/sources/current-management.js');
    const management = new CurrentSourceManagement(new Repository(c.db,new ArtifactStore('/tmp/riskhot-ingestion-unused')));
    await c.db.query("INSERT INTO platform.actors VALUES('operator',ARRAY['read','source_admin'],ARRAY['*'])");
    const source = await management.create('operator','create',{name:'测试信源',url:'https://example.invalid/'});
    assert.equal('version' in source,false);assert.deepEqual(source.financial_attributes,[]);
    const plan=(await c.db.query('SELECT enabled,interval_seconds FROM infomation.ingestion_schedules WHERE source_id=$1',[source.id])).rows[0];assert.equal(plan.enabled,false);assert.equal(plan.interval_seconds,3600);
    const edited = await management.edit('operator',source.catalog_key,{expected_updated_at:source.updated_at.toISOString(),profile:{name:'新名称',url:source.url}},'edit');
    assert.equal(edited.name,'新名称');
    await assert.rejects(() => management.edit('operator',source.catalog_key,{expected_updated_at:source.updated_at.toISOString(),profile:{name:'旧窗口',url:source.url}},'stale-edit'),/SOURCE_UPDATED_AT_CHANGED/);
    assert.equal((await c.db.query("SELECT to_regclass('m1.source_versions') AS t")).rows[0].t,null);
  } finally { await c.dispose(); }
});

test('schema5实际管理接口受理单信源任务，读取当前资料并拒绝旧身份入口', async () => {
  const c = await fixture(false);
  let close: (() => Promise<void>) | undefined;
  try {
    await applyIngestionMigration(c.db);
    const { ExecutionStore } = await import('../information-ingestion/processing/execution.js');
    const { IngestionRepository } = await import('../information-ingestion/processing/current-repository.js');
    const { ArtifactStore } = await import('../platform/artifacts.js');
    const { buildServer } = await import('../runtime/server.js');
    const repo = new ExecutionStore(c.db,new ArtifactStore('/tmp/riskhot-ingestion-unused'));
    const store = new IngestionRepository(repo);
    await store.seedCatalog(['wiki-source-001','wiki-source-002'].map(id=>({id,name:id,url:'https://example.invalid/',tier:'T1',group:'受控',focus:'',context:''})));
    await c.db.query("UPDATE m1.sources SET state='ACTIVE'");
    await c.db.query("INSERT INTO platform.actors VALUES('riskhot-local-operator',ARRAY['read','submit','event_submit','source_admin'],ARRAY['*'])");
    const app = await buildServer(repo,{mode:'local',origin:'http://127.0.0.1:18081'}); close=()=>app.close();
    const headers = {host:'127.0.0.1:18081',origin:'http://127.0.0.1:18081','idempotency-key':'current-api'};
    const response=await app.inject({method:'POST',url:'/api/v1/l0/tasks',headers,payload:{source_keys:['wiki-source-001','wiki-source-002'],limit:1}});
    assert.equal(response.statusCode,202,response.body);
    const tasks=response.json().items;
    assert.equal(tasks.length,2);assert.ok(tasks.every((t:{accepted:boolean})=>t.accepted));
    const list=await app.inject({method:'GET',url:'/api/v1/l0/tasks',headers});assert.equal(list.statusCode,200,list.body);assert.equal(list.json().items.length,2);
    const material=await store.saveMaterial(tasks[0].task.id,1,{title:'当前正文',publishedAtText:null,url:'https://www.pbc.gov.cn/test',normalizerVersion:'v1',segments:[{id:randomUUID(),text:'可读取正文',rawLocator:'p:0',kind:'paragraph'}]});
    const read=await app.inject({method:'GET',url:`/api/v1/l0/material/${material.id}`,headers});assert.equal(read.statusCode,200,read.body);assert.equal(read.json().content.segments[0].text,'可读取正文');
    const old=await app.inject({method:'GET',url:`/api/v1/l0/versions/${material.id}`,headers});assert.equal(old.statusCode,410);
    assert.equal((await app.inject({method:'GET',url:'/api/v1/session',headers})).json().schema_version,5);
  } finally { await close?.(); await c.dispose(); }
});

test('新采集运行保存正文并确认下游可读，模型未配置或抽取失败不反转采集完成', async () => {
  const c=await fixture(false);
  try {
    await applyIngestionMigration(c.db);
    const {Repository}=await import('../information-ingestion/processing/repository.js');
    const {IngestionRepository}=await import('../information-ingestion/processing/current-repository.js');
    const {ArtifactStore}=await import('../platform/artifacts.js');
    const {currentIngestionActivities}=await import('../runtime/current-activities.js');
    const repo=new Repository(c.db,new ArtifactStore('/tmp/riskhot-ingestion-unused')),store=new IngestionRepository(repo);
    await store.seedCatalog([{id:'wiki-source-001',name:'受控',url:'https://www.pbc.gov.cn/',tier:'T1',group:'受控',focus:'',context:''}]);
    await c.db.query("INSERT INTO platform.actors VALUES('operator',ARRAY['read','submit'],ARRAY['*'])");
    const url='https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/9999999999999999/index.html';
    const task=await store.submit('operator','ingest',{source_key:'wiki-source-001',limit:1,url});
    const fetcher:typeof fetch=async()=>new Response('<meta name="ArticleTitle" content="受控正文"><div id="zoom"><p>虚构机构宣布一项措施。</p></div>',{headers:{'content-type':'text/html'}});
    await currentIngestionActivities(repo,fetcher).ingestCurrent(task.id,1);
    assert.equal((await store.task(task.id)).status,'completed');
    const material=(await c.db.query('SELECT * FROM infomation.ingestion_material')).rows[0];
    assert.equal(material.availability_state,'available');
    assert.equal((await store.material('operator',material.id)).content.segments[0]!.text,'虚构机构宣布一项措施。');
    const basis={material_id:material.id,version:material.version,content_digest:material.content_digest};
    await store.extractionFailed('operator',basis,'MODEL_NOT_CONFIGURED');
    assert.equal((await store.task(task.id)).status,'completed');
    assert.equal((await store.material('operator',material.id)).extraction_result?.error_code,'MODEL_NOT_CONFIGURED');
    await store.extractionFailed('operator',basis,'OUTPUT_SCHEMA_INVALID');
    assert.equal((await store.task(task.id)).status,'completed');
    assert.equal((await store.material('operator',material.id)).availability_state,'available');
    assert.equal((await c.db.query('SELECT * FROM platform.artifact_objects')).rowCount,0);
  }finally{await c.dispose();}
});

test('schema5候选完成原归组复核与步骤3至5，最终审批后保存事件且没有分析总记录',async()=>{
 const c=await fixture(false);
 try{
  await applyIngestionMigration(c.db);
  const {Repository}=await import('../information-ingestion/processing/repository.js');const {IngestionRepository}=await import('../information-ingestion/processing/current-repository.js');const {ArtifactStore}=await import('../platform/artifacts.js');
  const {CandidateSteps}=await import('../event-management/candidate-steps.js');const {Reviews}=await import('../event-management/reviews.js');const {EventCommit}=await import('../event-management/commit.js');const {EventProcessing}=await import('../event-management/processing.js');const {digest}=await import('../event-management/contracts.js');
  const repo=new Repository(c.db,new ArtifactStore('/tmp/riskhot-ingestion-current-events')),store=new IngestionRepository(repo);
  await store.seedCatalog([{id:'wiki-source-001',name:'受控',url:'https://www.pbc.gov.cn/',tier:'T1',group:'受控',focus:'',context:''}]);
  await c.db.query("INSERT INTO platform.actors VALUES('operator',ARRAY['read','submit','event_submit','event_review','event_commit','candidate_disposition','event_retry'],ARRAY['*'])");
  const task=await store.submit('operator','event-test',{source_key:'wiki-source-001',limit:1});const segment={id:randomUUID(),text:'虚构机构宣布一项措施。',rawLocator:'p:0',kind:'paragraph' as const};
  const material=await store.saveMaterial(task.id,1,{title:'测试事件',publishedAtText:null,url:'https://www.pbc.gov.cn/test',normalizerVersion:'v1',segments:[segment]});
  const basis={material_id:material.id,version:material.version,content_digest:material.content_digest};const evidence={...basis,segment_id:segment.id,start_cp:0,end_cp:5,quote:'虚构机构宣'};
  const payload={local_key:'one',title:'机构宣布措施',description:segment.text,subject:'虚构机构',action:'宣布',target_clues:[],event_status:'announced',event_time:null,evidence_refs:[evidence],missing_fields:[]};
  await store.acceptExtraction('operator',basis,{candidates:[payload],warnings:[]});const defs={targets:[],variables:[]};await c.db.query("INSERT INTO information.definition_sets VALUES('empty','test','1','complete',$1,$2)",[defs,digest(defs)]);
  const options={task_manifest_id:'f02-fact-draft-v2',definition_ref:'empty',assessment_scope:{jurisdiction:'中国'},research_horizon:{term:'短期'},method_version:'text-draft-v1',reason:'受控集成测试'};
  await new EventProcessing(repo).startFullProcessing(material.id,'operator',options,'start-current');
  const candidate=(await c.db.query('SELECT * FROM information.event_candidates')).rows[0];const steps=new CandidateSteps(repo),reviews=new Reviews(repo);let generation=Number(candidate.execution_generation);
  await steps.prepare(candidate.id,2,generation);await steps.accept(candidate.id,2,generation,{decision:'NEW',matched_event_id:null,comparisons:[],reason:'独立事件',evidence_refs:[evidence],unresolved_issues:[]});
  await reviews.recordReview(candidate.id,'operator',{scope:'identity',proposal_generation:1,proposal_digest:await reviews.basis(candidate.id,'identity'),decision:'APPROVE',reason:'核对归组'},'review-identity');generation++;
  await steps.prepare(candidate.id,3,generation);await steps.accept(candidate.id,3,generation,{targets:[],variables:[],definition_candidates:[],unresolved_issues:['关系需人工核对']});
  await reviews.recordReview(candidate.id,'operator',{scope:'relations',proposal_generation:1,proposal_digest:await reviews.basis(candidate.id,'relations'),decision:'APPROVE',reason:'真实关系复核'},'review-relations');generation++;
  assert.equal((await c.db.query("SELECT * FROM platform.review_decisions WHERE scope='relations'")).rowCount,1);
  await steps.prepare(candidate.id,4,generation);await steps.accept(candidate.id,4,generation,{classification:'NEW_EVENT',current_event:{title:payload.title,description:payload.description,subject:payload.subject,action:payload.action,event_status:payload.event_status,event_time:null},changes:[{local_key:'change',update_type:'NEW_EVENT',summary:payload.description,previous_status:null,current_status:'announced',effective_time:null,basis_fact_ids:[],evidence_refs:[evidence]}],source_evidence_refs:[evidence],reason:'新事件',unresolved_issues:[]});
  await steps.prepare(candidate.id,5,generation);await steps.accept(candidate.id,5,generation,{assessment_scope:options.assessment_scope,research_horizon:options.research_horizon,method_version:options.method_version,dimensions:[],financial_usages:[],reasoning_summary:'文字观察',limitations:['未批准量化方法']});
  const commit=new EventCommit(repo),proposal=await commit.prepareCommit(candidate.id,generation);await reviews.recordReview(candidate.id,'operator',{scope:'commit',proposal_generation:1,proposal_digest:proposal.digest,decision:'APPROVE',reason:'最终核对'},'review-commit');generation++;
  const receipt=await commit.commitCandidate(candidate.id,generation,proposal.commit_key);assert.equal(receipt.result_kind,'COMMITTED');assert.equal((await c.db.query('SELECT * FROM information.event')).rowCount,1);
  assert.equal((await c.db.query("SELECT to_regclass('information.processing_runs') AS t")).rows[0].t,null);
  const contexts=(await c.db.query('SELECT context FROM information.candidate_step_results')).rows;assert.ok(contexts.every(row=>!row.context.input?.material));
 }finally{await c.dispose();}
});

test('新模型认领通过隔离模型角色临时读取正文，审计只存引用，零候选不建分析表',async()=>{
 const c=await fixture(false);let model:Pool|undefined;
 try{
  await applyIngestionMigration(c.db);const {grantIngestionRoles}=await import('../platform/ingestion-grants.js');await grantIngestionRoles(c.db);
  const {Repository}=await import('../information-ingestion/processing/repository.js');const {IngestionRepository}=await import('../information-ingestion/processing/current-repository.js');const {ArtifactStore}=await import('../platform/artifacts.js');const {currentIngestionActivities}=await import('../runtime/current-activities.js');const {currentExtractionActivities}=await import('../runtime/current-extraction.js');
  const repo=new Repository(c.db,new ArtifactStore('/tmp/riskhot-ingestion-current-model')),store=new IngestionRepository(repo);
  await store.seedCatalog([{id:'wiki-source-001',name:'受控',url:'https://www.pbc.gov.cn/',tier:'T1',group:'受控',focus:'',context:''}]);await c.db.query("INSERT INTO platform.actors VALUES('operator',ARRAY['read','submit'],ARRAY['*'])");
  const task=await store.submit('operator','model-test',{source_key:'wiki-source-001',limit:1,url:'https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/9999999999999999/index.html'});
  await currentIngestionActivities(repo,async()=>new Response('<meta name="ArticleTitle" content="数据"><div id="zoom"><p>完整且可读的受控正文。</p></div>',{headers:{'content-type':'text/html'}})).ingestCurrent(task.id,1);
  const intent=(await c.db.query("SELECT * FROM platform.execution_intents WHERE kind='material-extract'")).rows[0],activities=currentExtractionActivities(repo);
  const prepared=await activities.prepareCurrentExtraction(intent.owner_id,Number(intent.generation),1);assert.ok('attempt' in prepared&&prepared.attempt);
  if(!('attempt'in prepared)||!prepared.attempt)throw new Error('EXPECTED_ATTEMPT');
  const a=(await c.db.query('SELECT * FROM platform.model_attempts WHERE id=$1',[prepared.attempt.id])).rows[0];const reference=await repo.json<Record<string,unknown>>(a.request_artifact_id);assert.equal('material'in reference,false);assert.equal('version_id'in reference,false);
  const database=(await c.db.query('SELECT current_database() AS name')).rows[0].name;const url=new URL(process.env.MODEL_DATABASE_URL!);url.pathname=`/${database}`;model=new Pool({connectionString:url.href});
  const permit=(await model.query('SELECT * FROM platform.claim_model_call($1)',[a.id])).rows[0];assert.equal(permit.allowed,true,JSON.stringify(permit));
  assert.equal((await model.query('SELECT platform.current_model_material($1) AS content',[a.id])).rows[0].content.segments[0].text,'完整且可读的受控正文。');await assert.rejects(()=>model!.query('SELECT * FROM infomation.ingestion_material'),/permission denied/);
  const response=await repo.putJson({status:200,body:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({candidates:[],warnings:[]})}}]})},'controlled-response');await c.db.query("UPDATE platform.model_attempts SET response_artifact_id=$2,status='response_received' WHERE id=$1",[a.id,response]);
  assert.equal((await activities.consumeCurrentExtraction(intent.owner_id,Number(intent.generation),a.id)).stop,true);
  const material=await store.material('operator',intent.owner_id);assert.equal(material.extraction_result?.candidate_count,0,JSON.stringify(material.extraction_result));assert.equal((await store.task(task.id)).status,'completed');assert.equal((await c.db.query("SELECT to_regclass('information.processing_runs') AS t")).rows[0].t,null);
 }finally{await model?.end();await c.dispose();}
});

test('实际API/IO/relay角色运行采集并显示启动失败，资料与候选均可授权恢复',async()=>{
 const c=await fixture(false);let apiDb:Pool|undefined,ioDb:Pool|undefined,relayDb:Pool|undefined,app:Awaited<ReturnType<typeof import('../runtime/server.js').buildServer>>|undefined;
 try{
  await applyIngestionMigration(c.db);const {grantIngestionRoles}=await import('../platform/ingestion-grants.js');await grantIngestionRoles(c.db);
  const {ExecutionStore}=await import('../information-ingestion/processing/execution.js');const {IngestionRepository}=await import('../information-ingestion/processing/current-repository.js');const {ArtifactStore}=await import('../platform/artifacts.js');const {currentIngestionActivities}=await import('../runtime/current-activities.js');const {markCurrentIntentFailure}=await import('../runtime/current-relay.js');const {buildServer}=await import('../runtime/server.js');const {digest}=await import('../event-management/contracts.js');
  const folder='/tmp/riskhot-ingestion-roles';const adminRepo=new ExecutionStore(c.db,new ArtifactStore(folder)),store=new IngestionRepository(adminRepo);
  await store.seedCatalog([{id:'wiki-source-001',name:'受控',url:'https://www.pbc.gov.cn/',tier:'T1',group:'受控',focus:'',context:''}]);await c.db.query("INSERT INTO platform.actors VALUES('riskhot-local-operator',ARRAY['read','submit','retry','model_review','event_submit','event_retry','event_review','event_commit'],ARRAY['*'])");
  const database=(await c.db.query('SELECT current_database() AS n')).rows[0].n;const connection=(name:string)=>{const url=new URL(process.env[name]!);url.pathname=`/${database}`;return url.href;};apiDb=new Pool({connectionString:connection('DATABASE_URL')});ioDb=new Pool({connectionString:connection('IO_DATABASE_URL')});relayDb=new Pool({connectionString:connection('RELAY_DATABASE_URL')});
  const apiRepo=new ExecutionStore(apiDb,new ArtifactStore(folder)),ioRepo=new ExecutionStore(ioDb,new ArtifactStore(folder));
  app=await buildServer(apiRepo,{mode:'local',origin:'http://127.0.0.1:18081'});const headers={host:'127.0.0.1:18081',origin:'http://127.0.0.1:18081','idempotency-key':'roles-submit'};
  const accepted=await app.inject({method:'POST',url:'/api/v1/l0/tasks',headers,payload:{source_keys:['wiki-source-001'],limit:1}});assert.equal(accepted.statusCode,202,accepted.body);const task=accepted.json().items[0].task;
  await currentIngestionActivities(ioRepo,async(input)=>new Response(String(input).includes('/125475/')?'<meta name="ArticleTitle" content="正文"><div id="zoom"><p>虚构机构宣布一项措施。</p></div>':'<a href="/zhengcehuobisi/125207/125213/125431/125475/9999999999999999/index.html">受控公告</a>',{headers:{'content-type':'text/html'}})).ingestCurrent(task.id,1);
  const intent=(await c.db.query("SELECT * FROM platform.execution_intents WHERE kind='material-extract'")).rows[0];await markCurrentIntentFailure(relayDb,intent);
  assert.equal((await store.task(task.id)).status,'completed');const material=await store.material('riskhot-local-operator',intent.owner_id);assert.equal(material.extraction_result?.error_code,'WORKFLOW_START_UNAVAILABLE');
  const retried=await app.inject({method:'POST',url:`/api/v1/l0/material/${material.id}/extraction/retry`,headers:{...headers,'idempotency-key':'roles-material-retry'},payload:{version:material.version,content_digest:material.content_digest,reason:'核对启动故障后恢复',open_budget:false}});assert.equal(retried.statusCode,202,retried.body);
  const basis={material_id:material.id,version:material.version,content_digest:material.content_digest},segment=material.content.segments[0]!,evidence={...basis,segment_id:segment.id,start_cp:0,end_cp:5,quote:'虚构机构宣'};
  await new IngestionRepository(ioRepo).acceptExtraction('riskhot-local-operator',basis,{candidates:[{local_key:'one',title:'机构措施',description:segment.text,subject:'虚构机构',action:'宣布',target_clues:[],event_status:'announced',event_time:null,evidence_refs:[evidence],missing_fields:[]}]});
  const defs={targets:[],variables:[]};await c.db.query("INSERT INTO information.definition_sets VALUES('empty','test','1','complete',$1,$2)",[defs,digest(defs)]);
  const started=await app.inject({method:'POST',url:`/api/v1/l0/material/${material.id}/events/start`,headers:{...headers,'idempotency-key':'roles-events'},payload:{task_manifest_id:'f02-fact-draft-v2',definition_ref:'empty',assessment_scope:{jurisdiction:'中国'},research_horizon:{term:'短期'},method_version:'text-draft-v1',reason:'受控验证'}});assert.equal(started.statusCode,202,started.body);
  const candidate=(await c.db.query('SELECT * FROM information.event_candidates')).rows[0];await markCurrentIntentFailure(relayDb,{kind:'candidate',owner_id:candidate.id,generation:candidate.execution_generation});
  const detail=await app.inject({method:'GET',url:`/api/v1/l0/candidates/${candidate.id}`,headers});assert.equal(detail.statusCode,200,detail.body);assert.equal(detail.json().candidate.reason_code,'WORKFLOW_START_UNAVAILABLE');
  const resumed=await app.inject({method:'POST',url:`/api/v1/l0/candidates/${candidate.id}/retry`,headers:{...headers,'idempotency-key':'roles-candidate-retry'},payload:{resume_token:detail.json().resume_token,reason:'恢复候选',open_budget:false}});assert.equal(resumed.statusCode,202,resumed.body);
  await c.db.query("UPDATE platform.actors SET permissions=ARRAY['read'] WHERE subject='riskhot-local-operator'");
  const denied=await app.inject({method:'POST',url:`/api/v1/l0/candidates/${candidate.id}/retry`,headers:{...headers,'idempotency-key':'roles-candidate-retry'},payload:{resume_token:detail.json().resume_token,reason:'恢复候选',open_budget:false}});assert.equal(denied.statusCode,403);
 }finally{await app?.close();await apiDb?.end();await ioDb?.end();await relayDb?.end();await c.dispose();}
});


test('应用初始化不依赖共享测试库或Temporal凭据，重复运行保留新资料',async()=>{
 const c=await fixture(false);
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const folder=await mkdtemp(join(tmpdir(),'riskhot-setup-'));
 try{
  const target=(await c.db.query('SELECT current_database() AS name')).rows[0].name;
  const url=new URL(process.env.ADMIN_DATABASE_URL!);url.pathname='/'+target;
  const env:NodeJS.ProcessEnv={...process.env,ADMIN_DATABASE_URL:url.href,TEST_DATABASE_URL:'postgresql://invalid:invalid@127.0.0.1:1/unavailable',ARTIFACT_ROOT:folder};
  delete env.TEMPORAL_DB_PASSWORD;
  const run=()=>promisify(execFile)(process.execPath,['--import','tsx','src/scripts/setup.ts'],{env,timeout:30000});
  await run();assert.equal(await ingestionSchemaVersion(c.db),5);
  const source=(await c.db.query('SELECT id FROM m1.sources LIMIT 1')).rows[0];
  await c.db.query("INSERT INTO infomation.ingestion_material(source_id,identity,content,content_digest,normalizer_rule) VALUES($1,'setup-replay','{}','digest','test')",[source.id]);
  await run();assert.equal((await c.db.query("SELECT 1 FROM infomation.ingestion_material WHERE identity='setup-replay'")).rowCount,1);
 }finally{await rm(folder,{recursive:true,force:true});await c.dispose();}
});

async function currentReviewFixture(){
 const c=await fixture(false);await applyIngestionMigration(c.db);
 const {ExecutionStore}=await import('../information-ingestion/processing/execution.js');const {IngestionRepository}=await import('../information-ingestion/processing/current-repository.js');const {ArtifactStore}=await import('../platform/artifacts.js');
 const repo=new ExecutionStore(c.db,new ArtifactStore('/tmp/riskhot-ingestion-review')),store=new IngestionRepository(repo);
 await store.seedCatalog(['wiki-source-001','wiki-source-002'].map(id=>({id,name:id,url:'https://www.pbc.gov.cn/',tier:'T1',group:'测试',focus:'',context:''})));
 await c.db.query("UPDATE m1.sources SET state='ACTIVE'");await c.db.query("INSERT INTO platform.actors VALUES('riskhot-local-operator',ARRAY['read','submit','retry','model_budget','model_review','event_submit','event_review','event_retry','event_commit','candidate_disposition'],ARRAY['*']),('riskhot-scheduler',ARRAY['read','submit'],ARRAY['*'])");
 const actor='riskhot-local-operator',body={title:'当前资料',publishedAtText:null,url:'https://www.pbc.gov.cn/test',normalizerVersion:'v1',segments:[{id:randomUUID(),text:'机构发布措施。',rawLocator:'p:0',kind:'paragraph' as const}]};
 return {...c,repo,store,actor,body};
}

test('八并发多选释放外层连接，原键重放与同键异体冲突，单源接受url',async()=>{
 const c=await currentReviewFixture();const pool=new Pool({connectionString:c.db.options.connectionString,max:8,connectionTimeoutMillis:1500});
 try{
  const {IngestionRepository}=await import('../information-ingestion/processing/current-repository.js');const {ExecutionStore}=await import('../information-ingestion/processing/execution.js');
  const store=new IngestionRepository(new ExecutionStore(pool,c.repo.artifacts)),input={source_keys:['wiki-source-001','wiki-source-002'],limit:1};
  const results=await Promise.all(Array.from({length:8},(_,i)=>store.submitMany(c.actor,`concurrent-${i}`,input)));assert.ok(results.every(r=>r.items.every(i=>i.accepted)));
  assert.equal((await c.db.query('SELECT * FROM infomation.ingestion_tasks')).rowCount,16);
  await store.submitMany(c.actor,'concurrent-0',input);assert.equal((await c.db.query('SELECT * FROM infomation.ingestion_tasks')).rowCount,16);
  await assert.rejects(()=>store.submitMany(c.actor,'concurrent-0',{...input,limit:2}),/IDEMPOTENCY/);
  assert.ok((await store.submitMany(c.actor,'single-url',{source_keys:['wiki-source-001'],limit:1,url:'https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/9999999999999999/index.html'})).items[0]!.accepted);
 }finally{await pool.end();await c.dispose();}
});

test('资料预算按当前版本隔离：旧版到期不阻止新版，同版恢复耗尽拒绝且只显式重开',async()=>{
 const c=await currentReviewFixture();let app:Awaited<ReturnType<typeof import('../runtime/server.js').buildServer>>|undefined;
 try{
  const {reserveCurrentModel}=await import('../event-management/current-model.js');const {buildServer}=await import('../runtime/server.js');
  const task=await c.store.submit(c.actor,'budget',{source_key:'wiki-source-001',limit:1});let material=await c.store.saveMaterial(task.id,1,c.body);
  const input=()=>({version_id:material.id,material_ref:{material_id:material.id,version:material.version,content_digest:material.content_digest},material:material.content,manifest:{task_id:'AI-01' as const,prompt:'test',provider:{protocol:'openai-chat' as const,model:'test',endpoint:'http://127.0.0.1:1'}}});
  await reserveCurrentModel(c.repo,c.actor,input().material_ref,'material',material.id,1,input(),'old');await c.db.query("UPDATE platform.model_budget_windows SET deadline=now()-interval '1 second'");
  material=await c.store.saveMaterial(task.id,1,{...c.body,title:'新版'});
  app=await buildServer(c.repo,{mode:'local',origin:'http://127.0.0.1:18081'});
  await c.store.extractionFailed(c.actor,input().material_ref,'MODEL_NETWORK_ERROR');
  const initialRetry=await app.inject({method:'POST',url:`/api/v1/l0/material/${material.id}/extraction/retry`,headers:{host:'127.0.0.1:18081',origin:'http://127.0.0.1:18081','idempotency-key':'new-basis-initial'},payload:{version:material.version,content_digest:material.content_digest,reason:'新版首次受理',open_budget:false}});assert.equal(initialRetry.statusCode,202,initialRetry.body);
  const first=await reserveCurrentModel(c.repo,c.actor,input().material_ref,'material',material.id,2,input(),'new');assert.equal(first.window_used,1);
  await reserveCurrentModel(c.repo,c.actor,input().material_ref,'material',material.id,3,input(),'retry-1');await reserveCurrentModel(c.repo,c.actor,input().material_ref,'material',material.id,4,input(),'retry-2');
  await assert.rejects(()=>reserveCurrentModel(c.repo,c.actor,input().material_ref,'material',material.id,5,input(),'exhausted'),/MODEL_BUDGET_EXHAUSTED/);assert.equal((await c.db.query('SELECT * FROM platform.model_budget_windows')).rowCount,2);
  await c.store.extractionFailed(c.actor,input().material_ref,'MODEL_BUDGET_EXHAUSTED');
  const retry=(open_budget:boolean,key:string)=>app!.inject({method:'POST',url:`/api/v1/l0/material/${material.id}/extraction/retry`,headers:{host:'127.0.0.1:18081',origin:'http://127.0.0.1:18081','idempotency-key':key},payload:{version:material.version,content_digest:material.content_digest,reason:'明确授权',open_budget}});
  assert.equal((await retry(false,'no-open')).statusCode,409);assert.equal((await retry(true,'open')).statusCode,202);const next=await reserveCurrentModel(c.repo,c.actor,input().material_ref,'material',material.id,6,input(),'opened');assert.equal(next.window_used,1);
 }finally{await app?.close();await c.dispose();}
});

test('采集恢复固定原发现入口，保存后并发版本更新不投递旧版或误标新版可读',async()=>{
 const c=await currentReviewFixture();const {currentIngestionActivities}=await import('../runtime/current-activities.js');const {IngestionRepository}=await import('../information-ingestion/processing/current-repository.js');
 const original=IngestionRepository.prototype.saveMaterial;
 try{
  const a='/zhengcehuobisi/125207/125213/125431/125475/9999999999999991/index.html',b=a.replace('9999999999999991','9999999999999992');let fail=true;const reads:string[]=[];
  const task=await c.store.submit(c.actor,'fixed-discovery',{source_key:'wiki-source-001',limit:1});
  const fetcher:typeof fetch=async input=>{const url=String(input);reads.push(url);if(url.includes('/125475/')){if(fail)throw new Error('controlled failure');return new Response('<div id="zoom"><p>机构发布措施。</p></div>');}return new Response(`<a href="${fail?a:b}">测试</a>`);};
  await currentIngestionActivities(c.repo,fetcher).ingestCurrent(task.id,1);assert.equal((await c.store.task(task.id)).status,'recoverable');fail=false;reads.length=0;
  await currentIngestionActivities(c.repo,fetcher).ingestCurrent(task.id,1);assert.deepEqual(reads,[`https://www.pbc.gov.cn${a}`]);assert.equal((await c.store.task(task.id)).status,'completed');
  const task2=await c.store.submit(c.actor,'concurrent-basis',{source_key:'wiki-source-001',limit:1,url:`https://www.pbc.gov.cn${b}`});
  IngestionRepository.prototype.saveMaterial=async function(...args){const old=await original.apply(this,args);await original.call(this,args[0],args[1],{...args[2],title:'并发更新'});return old;};
  await currentIngestionActivities(c.repo,fetcher).ingestCurrent(task2.id,1);
  const current=(await c.db.query('SELECT m.* FROM infomation.ingestion_material m JOIN infomation.ingestion_task_material t ON t.material_id=m.id WHERE t.task_id=$1',[task2.id])).rows[0];assert.equal(current.version,2);assert.notEqual(current.availability_state,'available');assert.equal((await c.db.query("SELECT * FROM platform.execution_intents WHERE kind='material-extract' AND owner_id=$1",[current.id])).rowCount,0);assert.equal((await c.store.task(task2.id)).status,'partial');
 }finally{IngestionRepository.prototype.saveMaterial=original;await c.dispose();}
});

test('真实管理入口历史跨100条、来源过滤、monitor授权过滤与ready依赖失败503',async()=>{
 const c=await currentReviewFixture();let app:Awaited<ReturnType<typeof import('../runtime/server.js').buildServer>>|undefined;const root=process.env.ARTIFACT_ROOT;
 try{
  const {buildServer}=await import('../runtime/server.js');app=await buildServer(c.repo,{mode:'local',origin:'http://127.0.0.1:18081'});const headers={host:'127.0.0.1:18081'};
  await c.db.query("INSERT INTO infomation.ingestion_tasks(source_id,trigger_type,actor) SELECT s.id,'manual',$1 FROM m1.sources s CROSS JOIN generate_series(1,105) WHERE catalog_key='wiki-source-001'",[c.actor]);await c.store.submit(c.actor,'other',{source_key:'wiki-source-002',limit:1});
  const first=(await app.inject({url:'/api/v1/l0/tasks?source=wiki-source-001',headers})).json();assert.equal(first.total,105);assert.equal(first.next_offset,100);const next=(await app.inject({url:'/api/v1/l0/tasks?source=wiki-source-001&offset=100',headers})).json();assert.equal(next.items.length,5);assert.ok(next.items.every((t:{catalog_key:string})=>t.catalog_key==='wiki-source-001'));assert.equal(next.coverage.source,'wiki-source-001');
  await c.db.query("UPDATE platform.actors SET source_keys=ARRAY['wiki-source-002'] WHERE subject=$1",[c.actor]);const monitor=await app.inject({url:'/api/v1/l0/monitor',headers});assert.equal(monitor.statusCode,200,monitor.body);assert.equal(monitor.json().tasks.length,1);assert.equal(monitor.json().plans.length,1);
  process.env.ARTIFACT_ROOT='/dev/null/riskhot-unavailable';assert.equal((await app.inject({url:'/health/ready'})).statusCode,503);process.env.ARTIFACT_ROOT=root;
  const query=c.repo.db.query;c.repo.db.query=(()=>Promise.reject(new Error('DB unavailable'))) as typeof query;try{assert.equal((await app.inject({url:'/health/ready'})).statusCode,503);}finally{c.repo.db.query=query;}
 }finally{if(root===undefined)delete process.env.ARTIFACT_ROOT;else process.env.ARTIFACT_ROOT=root;await app?.close();await c.dispose();}
});

test('schema5 Scheduler.tick两周期，任务暂停继续代际隔离，reconcile覆盖closed/missing/running/unknown',async()=>{
 const c=await currentReviewFixture();let app:Awaited<ReturnType<typeof import('../runtime/server.js').buildServer>>|undefined;
 try{
  const {Scheduler}=await import('../runtime/scheduler.js');const {reconcileCurrentExecutions}=await import('../runtime/current-relay.js');const {buildServer}=await import('../runtime/server.js');
  const scheduler=new Scheduler(c.repo,async()=>{}, {intervalSeconds:60,maxInFlight:2,sources:['wiki-source-001']});const now=new Date();await c.db.query("UPDATE infomation.ingestion_schedules SET enabled=true,interval_seconds=60,next_run_at=$1 WHERE source_id=(SELECT id FROM m1.sources WHERE catalog_key='wiki-source-001')",[now]);
  await scheduler.tick(now);await scheduler.tick(now);assert.equal((await c.db.query("SELECT * FROM infomation.ingestion_tasks WHERE trigger_type='automatic'")).rowCount,1);await c.db.query("UPDATE infomation.ingestion_tasks SET status='completed'");await scheduler.tick(new Date(now.getTime()+61000));assert.equal((await c.db.query("SELECT * FROM infomation.ingestion_tasks WHERE trigger_type='automatic'")).rowCount,2);
  const task=await c.store.submit(c.actor,'control',{source_key:'wiki-source-001',limit:1});app=await buildServer(c.repo,{mode:'local',origin:'http://127.0.0.1:18081'});
  const control=(action:string,revision:number)=>app!.inject({method:'POST',url:`/api/v1/l0/tasks/${task.id}/control`,headers:{host:'127.0.0.1:18081',origin:'http://127.0.0.1:18081','idempotency-key':action},payload:{action,control_revision:revision,reason:'受控测试'}});
  assert.equal((await control('pause',1)).statusCode,200);await assert.rejects(()=>c.store.saveMaterial(task.id,1,c.body),/STALE_EXECUTION/);assert.equal((await control('resume',2)).statusCode,200);await assert.rejects(()=>c.store.saveMaterial(task.id,2,c.body),/STALE_EXECUTION/);await c.store.saveMaterial(task.id,3,c.body);
  await c.db.query("UPDATE platform.execution_intents SET state='recoverable'");const ids:Record<string,string>={};for(const state of ['closed','missing','running','unknown']){const t=await c.store.submit(c.actor,state,{source_key:'wiki-source-002',limit:1});ids[state]=t.id;await c.db.query("UPDATE platform.execution_intents SET state='started',workflow_id=$2,next_attempt_at=now() WHERE owner_id=$1",[t.id,state]);}
  await reconcileCurrentExecutions(c.db,async workflow=>workflow as 'closed'|'missing'|'running'|'unknown');for(const state of Object.keys(ids)){const t=await c.store.task(ids[state]!);assert.equal(t.status,['closed','missing'].includes(state)?'recoverable':'queued');assert.equal(t.reason_code,['closed','missing'].includes(state)?'WORKFLOW_TERMINATED':null);}

  const material=(await c.db.query('SELECT * FROM infomation.ingestion_material LIMIT 1')).rows[0];
  await c.db.query("INSERT INTO platform.execution_intents(kind,owner_id,generation,workflow_id,input,state) VALUES('material-extract',$1,1,'closed-material',$2,'started')",[material.id,{material_id:material.id,version:material.version,content_digest:material.content_digest,actor:c.actor}]);
  const candidate=(await c.db.query("INSERT INTO information.event_candidates(material_id,material_version,material_digest,actor,ordinal,payload) VALUES($1,$2,$3,$4,0,'{}') RETURNING id",[material.id,material.version,material.content_digest,c.actor])).rows[0];
  await c.db.query("INSERT INTO platform.execution_intents(kind,owner_id,generation,workflow_id,input,state) VALUES('candidate',$1,1,'missing-candidate','{}','started')",[candidate.id]);
  await reconcileCurrentExecutions(c.db,async workflow=>workflow.startsWith('closed')?'closed':'missing');
  assert.equal((await c.store.material(c.actor,material.id)).extraction_result?.error_code,'WORKFLOW_TERMINATED');assert.equal((await c.db.query('SELECT reason_code FROM information.event_candidates WHERE id=$1',[candidate.id])).rows[0].reason_code,'WORKFLOW_TERMINATED');
 }finally{await app?.close();await c.dispose();}
});

test('金融属性增量迁移回填旧分类，保留资料与信源原字段，重复运行不覆盖新值', async () => {
  const c = await fixture(false);
  try {
    await applyIngestionMigration(c.db);
    await c.db.query('ALTER TABLE m1.sources DROP COLUMN financial_attributes');
    await c.db.query(`INSERT INTO m1.sources(catalog_key,name,url,metadata,state) VALUES
      ('financial-array','多值信源','','{"dims":["钱的数量","钱的流向"]}','ACTIVE'),
      ('financial-missing','未分类信源','','{}','DISABLED'),
      ('financial-string','历史单值信源','','{"dims":"钱的价格"}','DISABLED'),
      ('financial-blank-array','历史空白数组','','{"dims":["","  "," 钱的数量 "]}','DISABLED'),
      ('financial-blank-string','历史空白单值','','{"dims":"   "}','DISABLED')`);
    await c.db.query("INSERT INTO infomation.ingestion_material(source_id,identity,content,content_digest,normalizer_rule) SELECT id,'kept','{}','digest','test-v1' FROM m1.sources LIMIT 1");
    const before = (await c.db.query('SELECT to_jsonb(s) AS value FROM m1.sources s ORDER BY catalog_key')).rows;
    await applyIngestionMigration(c.db);
    const after = (await c.db.query('SELECT to_jsonb(s)-\'financial_attributes\' AS value FROM m1.sources s ORDER BY catalog_key')).rows;
    assert.deepEqual(after,before);
    const rows = (await c.db.query('SELECT catalog_key,financial_attributes FROM m1.sources ORDER BY catalog_key')).rows;
    assert.deepEqual(rows.map(row=>row.financial_attributes),[['钱的数量','钱的流向'],['钱的数量'],[],[],['钱的价格']]);
    await c.db.query("UPDATE m1.sources SET financial_attributes='{}' WHERE catalog_key='financial-array'");
    await applyIngestionMigration(c.db);await applyIngestionMigration(c.db);
    assert.deepEqual((await c.db.query("SELECT financial_attributes FROM m1.sources WHERE catalog_key='financial-array'")).rows[0].financial_attributes,[]);
    assert.equal((await c.db.query('SELECT * FROM infomation.ingestion_material')).rowCount,1);
    await assert.rejects(()=>c.db.query("UPDATE m1.sources SET financial_attributes=NULL"),/not-null constraint/);
    await assert.rejects(()=>c.db.query("UPDATE m1.sources SET financial_attributes=ARRAY[NULL]::text[]"),/check constraint/);
  } finally { await c.dispose(); }
});

test('金融属性新增编辑写独立列，查询兼容现有分类，省略保留与清空均不会复活旧值', async () => {
  const c = await fixture(false);
  let close: (() => Promise<void>) | undefined;
  try {
    await applyIngestionMigration(c.db);
    const { ExecutionStore } = await import('../information-ingestion/processing/execution.js');
    const { ArtifactStore } = await import('../platform/artifacts.js');
    const { buildServer } = await import('../runtime/server.js');
    await c.db.query("INSERT INTO platform.actors VALUES('riskhot-local-operator',ARRAY['read','source_admin'],ARRAY['*'])");
    const app = await buildServer(new ExecutionStore(c.db,new ArtifactStore('/tmp/riskhot-ingestion-unused')),{mode:'local',origin:'http://127.0.0.1:18081'});close=()=>app.close();
    const headers = {host:'127.0.0.1:18081',origin:'http://127.0.0.1:18081','idempotency-key':'financial-create'};
    const created = await app.inject({method:'POST',url:'/api/v1/m1/sources',headers,payload:{profile:{name:'金融分类信源',url:'',dims:['钱的数量','钱的价格','钱的数量']}}});
    assert.equal(created.statusCode,201,created.body);let source=created.json();
    assert.deepEqual(source.financial_attributes,['钱的数量','钱的价格']);
    assert.deepEqual(source.metadata.dims,source.financial_attributes);
    assert.deepEqual(source.profile.dims,source.financial_attributes);
    let stored = (await c.db.query('SELECT * FROM m1.sources WHERE id=$1',[source.id])).rows[0];
    assert.deepEqual(stored.financial_attributes,source.financial_attributes);assert.equal('dims' in stored.metadata,false);
    const edit = async(dims?:string[])=>{
      const response=await app.inject({method:'PUT',url:`/api/v1/m1/sources/${source.catalog_key}`,headers:{...headers,'idempotency-key':randomUUID()},payload:{expected_updated_at:source.updated_at,profile:{name:source.name,url:source.url,...(dims===undefined?{}:{dims})}}});
      assert.equal(response.statusCode,200,response.body);source=response.json();return source;
    };
    await edit(['钱的流向']);assert.deepEqual(source.financial_attributes,['钱的流向']);
    await edit();assert.deepEqual(source.financial_attributes,['钱的流向']);
    await c.db.query("UPDATE m1.sources SET metadata=metadata||'{\"dims\":[\"旧分类\"]}'::jsonb,financial_attributes='{}' WHERE id=$1",[source.id]);
    const read=await app.inject({method:'GET',url:'/api/v1/m1/sources',headers});assert.equal(read.statusCode,200,read.body);
    const item=read.json().items[0];assert.deepEqual(item.financial_attributes,[]);assert.deepEqual(item.metadata.dims,[]);assert.deepEqual(item.profile.dims,[]);
    await edit();assert.deepEqual(source.financial_attributes,[]);
    await edit(['钱的数量','钱的流向']);await edit([]);assert.deepEqual(source.financial_attributes,[]);
    stored=(await c.db.query('SELECT * FROM m1.sources WHERE id=$1',[source.id])).rows[0];assert.deepEqual(stored.financial_attributes,[]);
    for(const dims of ['钱的数量',[null],[''],['   '],Array(21).fill('钱的数量')]){
      const invalid=await app.inject({method:'POST',url:'/api/v1/m1/sources',headers:{...headers,'idempotency-key':randomUUID()},payload:{profile:{name:'非法分类',url:'',dims}}});assert.equal(invalid.statusCode,400,invalid.body);
    }
  } finally { await close?.();await c.dispose(); }
});
