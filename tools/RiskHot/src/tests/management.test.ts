import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';
import { decodeJwt } from 'jose';
import { openFixture } from './fixture.js';
import { buildServer } from '../runtime/server.js';
import { ExecutionStore } from '../information-ingestion/processing/execution.js';
import { readCatalog } from '../information-ingestion/sources/catalog.js';
import { parsePbc } from '../information-ingestion/processing/pbc.js';
import { setTimeout } from 'node:timers/promises';
import { ioActivities } from '../runtime/activities.js';

async function setup() {
  const c = await openFixture();
  const response = await fetch(`${process.env.OIDC_ISSUER}/protocol/openid-connect/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: process.env.OIDC_CLIENT_ID!, client_secret: process.env.OIDC_CLIENT_SECRET!, username: process.env.OPERATOR_USERNAME!, password: process.env.OPERATOR_PASSWORD! }) });
  const token = (await response.json()).access_token as string; assert.ok(token);
  const actor = decodeJwt(token).sub!;
  await c.repo.seedCatalog((await readCatalog('src/data/source-catalog.js')).slice(0, 3));
  await c.db.query("INSERT INTO platform.actors VALUES($1,ARRAY['read','submit','source_admin','retry','model_budget'],ARRAY['*'])", [actor]);
  const apiDb = new Pool({ connectionString: c.urlFor('DATABASE_URL') });
  const app = await buildServer(new ExecutionStore(apiDb, c.artifacts), { mode: 'oidc' });
  const request = (method: string, url: string, payload?: unknown, key = randomUUID()) => app.inject({ method: method as 'POST', url, headers: { authorization: `Bearer ${token}`, 'idempotency-key': key, 'content-type': 'application/json' }, ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }) });
  return { ...c, app, actor, request, async close() { await app.close(); await apiDb.end(); await c.dispose(); } };
}

test('manual page history filters real manual batches before pagination and validates trigger',async()=>{
 const c=await setup();
 try{
  const batch=(await c.request('POST','/api/v1/l0/task-batches',{source_keys:['wiki-source-001'],limit:1})).json();
  await c.db.query("INSERT INTO platform.schedule_runs(source_id,scheduled_at,status) SELECT $1,now()+make_interval(secs=>n),'blocked' FROM generate_series(1,105) n",[c.parent.source_id]);
  const result=await c.request('GET','/api/v1/l0/task-batches?trigger=manual');assert.equal(result.statusCode,200);assert.equal(result.json().total,1);assert.equal(result.json().items[0].id,batch.id);assert.equal(result.json().items[0].trigger,'manual');
  assert.equal((await c.request('GET','/api/v1/l0/task-batches?trigger=invalid')).statusCode,400);
 }finally{await c.close();}
});

test('schedule history exposes authorized fixed results and distinguishes queued slots from saved material',async()=>{
  const c=await setup();
  try{
    const material=await c.processing();
    await c.db.query("INSERT INTO platform.schedule_runs(source_id,scheduled_at,operation_id,status) VALUES($1,now()-interval '1 hour',$2,'running'),($1,now(),NULL,'pending')",[c.parent.source_id,c.parent.id]);
    const response=await c.request('GET','/api/v1/l0/schedules/wiki-source-001/runs');
    assert.equal(response.statusCode,200,response.body);
    assert.equal(response.json().items.length,2);
    assert.equal(response.json().items[0].operation_id,null);assert.equal(response.json().items[0].saved_count,0);
    assert.equal(response.json().items[1].operation_id,c.parent.id);assert.equal(response.json().items[1].saved_count,1);
    assert.ok(material.version);assert.equal(response.json().limit,50);
    await c.db.query("UPDATE platform.actors SET source_keys=ARRAY['wiki-source-002'] WHERE subject=$1",[c.actor]);
    assert.equal((await c.request('GET','/api/v1/l0/schedules/wiki-source-001/runs')).statusCode,403);
  }finally{await c.close();}
});

test('plan summary reflects the paused operation instead of a stale scheduler status',async()=>{
  const c=await setup();
  try{
    await c.request('PATCH','/api/v1/l0/schedules/wiki-source-001',{enabled:true,interval_seconds:3600,expected_updated_at:null});
    await c.db.query("INSERT INTO platform.schedule_runs(source_id,scheduled_at,operation_id,status) VALUES($1,now(),$2,'running')",[c.parent.source_id,c.parent.id]);
    const pause=await c.request('POST',`/api/v1/l0/task-batches/${c.parent.id}/control`,{action:'pause',expected_version:1,reason:'受控暂停'});assert.equal(pause.statusCode,200,pause.body);
    const monitor=(await c.request('GET','/api/v1/l0/monitor')).json();
    assert.equal(monitor.schedules.find((row:{catalog_key:string})=>row.catalog_key==='wiki-source-001').latest_status,'paused');
  }finally{await c.close();}
});

test('resuming a paused batch rechecks source eligibility and preserves pause when the source is disabled', async () => {
  const c = await setup();
  try {
    const batch=(await c.request('POST','/api/v1/l0/task-batches',{source_keys:['wiki-source-001'],limit:1})).json();
    const paused=(await c.request('POST',`/api/v1/l0/task-batches/${batch.id}/control`,{action:'pause',expected_version:batch.version,reason:'暂停'})).json();
    await c.request('PATCH','/api/v1/m1/sources/wiki-source-001',{state:'DISABLED'});
    const resumed=await c.request('POST',`/api/v1/l0/task-batches/${batch.id}/control`,{action:'resume',expected_version:paused.version,reason:'继续'});
    assert.equal(resumed.statusCode,409,resumed.body);
    assert.equal((await c.request('GET',`/api/v1/l0/task-batches?q=${batch.id}`)).json().items[0].status,'paused');
  } finally {await c.close();}
});

test('source relations expose real saved versions and keep unavailable indicator references distinct from zero', async () => {
  const c=await setup();
  try {
    const material=await c.processing();
    const response=await c.request('GET','/api/v1/m1/sources/wiki-source-001/relations');
    assert.equal(response.statusCode,200,response.body);
    assert.ok(response.json().materials.items.some((row:{version_id:string})=>row.version_id===material.version));
    assert.equal(response.json().allowed_indicators.status,'unavailable');
    assert.equal(response.json().allowed_indicators.count,null);
    await c.db.query("UPDATE platform.actors SET source_keys=ARRAY['wiki-source-002'] WHERE subject=$1",[c.actor]);
    assert.equal((await c.request('GET','/api/v1/m1/sources/wiki-source-001/relations')).statusCode,403);
  } finally {await c.close();}
});

test('catalog synchronization preserves an edited profile and its independent connector configuration', async () => {
  const c = await setup();
  try {
    const rows = (await readCatalog('src/data/source-catalog.js')).slice(0, 3);
    const source = (await c.request('GET', '/api/v1/m1/sources')).json().items.find((x: { catalog_key: string }) => x.catalog_key === 'wiki-source-001');
    const result = await c.request('PUT', '/api/v1/m1/sources/wiki-source-001', { expected_version: source.version, profile: { name: source.name, url: source.url, focus: '人工维护的业务范围', dims: ['流动性'] } });
    assert.equal(result.statusCode, 200, result.body);
    await c.repo.seedCatalog(rows);
    const current = (await c.request('GET', '/api/v1/m1/sources')).json().items.find((x: { catalog_key: string }) => x.catalog_key === 'wiki-source-001');
    assert.equal(current.profile.focus, '人工维护的业务范围');
    assert.equal(current.connection.id, source.connection.id);
  } finally { await c.close(); }
});

test('an incomplete new source cannot be enabled; verified manual eligibility does not imply an automatic connector', async () => {
  const c = await setup();
  try {
    const source = (await c.request('POST', '/api/v1/m1/sources', { profile: { name: '受控人工出处', url: '' } })).json();
    assert.equal((await c.request('PATCH', `/api/v1/m1/sources/${source.catalog_key}`, { state: 'ACTIVE', expected_version: 1 })).statusCode, 409);
    const updated = await c.request('PUT', `/api/v1/m1/sources/${source.catalog_key}`, { expected_version: 1, profile: { name: '受控人工出处', url: '', publisher: '受控发布机构', identity_basis: '已核对出处', allowed_scope: '公开资料' } });
    assert.equal(updated.statusCode, 200, updated.body);
    assert.equal((await c.request('PATCH', `/api/v1/m1/sources/${source.catalog_key}`, { state: 'ACTIVE', expected_version: 2 })).statusCode, 200);
    assert.equal((await c.request('POST', '/api/v1/l0/source-fetches', { source_key: source.catalog_key, limit: 1 })).statusCode, 409);
  } finally { await c.close(); }
});

test('session and profile writes preserve revisions, reject stale edits and duplicate identity, and cannot configure a connector', async () => {
  const c = await setup();
  try {
    const session = await c.request('GET', '/api/v1/session'); assert.equal(session.statusCode, 200, session.body);
    assert.equal(session.json().actor, c.actor); assert.ok(session.json().permissions.includes('source_admin'));
    const profile = { name: '受控新增来源', url: 'https://example.test/research', publisher: '受控机构', dims: ['流动性'], levels: ['国家'] };
    const key = randomUUID(); const created = await c.request('POST', '/api/v1/m1/sources', { profile }, key);
    assert.equal(created.statusCode, 201, created.body); const source = created.json();
    assert.equal(source.state, 'DISABLED'); assert.equal(source.connector_configured, false); assert.equal(source.profile.tier, undefined);
    assert.equal((await c.request('POST', '/api/v1/m1/sources', { profile }, key)).json().catalog_key, source.catalog_key);
    assert.equal((await c.request('POST', '/api/v1/m1/sources', { profile })).statusCode, 409);
    assert.equal((await c.request('POST', '/api/v1/m1/sources', { profile: { ...profile, name: '另一来源', url: 'https://EXAMPLE.test/research#duplicate' } })).statusCode, 409);
    assert.equal((await c.request('POST', '/api/v1/m1/sources', { profile: { ...profile, url: 'javascript:alert(1)' } })).statusCode, 400);
    const edited = await c.request('PUT', `/api/v1/m1/sources/${source.catalog_key}`, { expected_version: 1, profile: { ...profile, focus: '修订观察范围' }, reason: '完善档案' });
    assert.equal(edited.statusCode, 200, edited.body); assert.equal(edited.json().version, 2);
    assert.equal((await c.request('PUT', `/api/v1/m1/sources/${source.catalog_key}`, { expected_version: 1, profile })).statusCode, 409);
    const history = await c.request('GET', `/api/v1/m1/sources/${source.catalog_key}/history`);
    assert.deepEqual(history.json().items.map((x: { version: number }) => x.version), [2, 1]);
    assert.equal(history.json().items[0].profile.focus, '修订观察范围'); assert.ok(history.json().audit.some((x: { actor: string }) => x.actor === c.actor));
    const sources = await c.request('GET', '/api/v1/m1/sources'); assert.equal(sources.json().items.find((x: { catalog_key: string }) => x.catalog_key === source.catalog_key).profile.focus, '修订观察范围');
    assert.equal((await c.request('POST', '/api/v1/l0/source-fetches', { source_key: source.catalog_key, limit: 1 })).statusCode, 409);
    assert.equal((await c.request('PATCH', '/api/v1/m1/sources/wiki-source-001', { state: 'DISABLED', expected_version: 999, reason: 'stale' })).statusCode, 409);
  } finally { await c.close(); }
});

test('active task lookup retains paused and old manual batches, excludes scheduled operations, and respects source access',async()=>{
  const c=await setup();
  try{
    let response=await c.request('GET','/api/v1/l0/task-batches?status=active');
    assert.equal(response.statusCode,200,response.body);assert.equal(response.json().total,0,'standalone scheduled operations do not lock the manual start action');
    const batch=(await c.request('POST','/api/v1/l0/task-batches',{source_keys:['wiki-source-001'],limit:1})).json();
    await c.db.query("UPDATE platform.task_batches SET scheduled_at=now()-interval '2 days' WHERE id=$1",[batch.id]);
    await c.db.query("UPDATE information.operations SET scheduled_at=now()-interval '2 days' WHERE id=$1",[batch.sources[0].operation_id]);
    response=await c.request('GET','/api/v1/l0/task-batches?status=active');
    assert.equal(response.json().items[0].id,batch.id);
    const paused=await c.request('POST',`/api/v1/l0/task-batches/${batch.id}/control`,{action:'pause',expected_version:1,reason:'受控暂停'});assert.equal(paused.statusCode,200,paused.body);
    assert.equal((await c.request('GET','/api/v1/l0/task-batches?status=active')).json().items[0].status,'paused');
    await c.db.query("INSERT INTO platform.task_batch_sources(batch_id,source_id,source_version,status) SELECT $1,id,version,'completed' FROM m1.sources WHERE catalog_key='wiki-source-002'",[batch.id]);
    await c.db.query('UPDATE platform.task_batches SET paused=false WHERE id=$1',[batch.id]);
    response=await c.request('GET','/api/v1/l0/task-batches?status=active');
    assert.equal(response.json().items[0].status,'partial','a completed source must not hide another source that is still paused');
    await c.request('POST',`/api/v1/l0/task-batches/${batch.id}/control`,{action:'resume',expected_version:2,reason:'受控继续'});
    await c.db.query("UPDATE information.operations SET status='completed',paused=false WHERE id=$1",[batch.sources[0].operation_id]);
    response=await c.request('GET','/api/v1/l0/task-batches?status=active');
    assert.equal(response.json().total,0);assert.equal(response.json().latest_batch.id,batch.id);assert.equal(response.json().latest_batch.status,'completed');
    await c.db.query("UPDATE platform.actors SET source_keys=ARRAY['wiki-source-003'] WHERE subject=$1",[c.actor]);
    response=await c.request('GET','/api/v1/l0/task-batches?status=active');
    assert.equal(response.json().total,0);assert.equal(response.json().latest_batch,null);
  }finally{await c.close();}
});

test('one durable multi-source task counts partial eligibility once, replays safely, and filters only rows while metrics cover the date range', async () => {
  const c = await setup();
  try {
    await c.db.query("UPDATE m1.sources SET state='DISABLED' WHERE catalog_key='wiki-source-002'");
    const body = { source_keys: ['wiki-source-001', 'wiki-source-002'], limit: 1 }; const key = randomUUID();
    const accepted = await c.request('POST', '/api/v1/l0/task-batches', body, key); assert.equal(accepted.statusCode, 202, accepted.body);
    const batch = accepted.json(); assert.equal(batch.sources.length, 2); assert.equal(batch.sources[0].status, 'queued');
    assert.equal(batch.sources[1].reason_code, 'SOURCE_DISABLED'); assert.equal(batch.saved_count, 0);
    assert.equal((await c.request('POST', '/api/v1/l0/task-batches', body, key)).json().id, batch.id);
    assert.equal((await c.request('POST', '/api/v1/l0/task-batches', { ...body, limit: 2 }, key)).statusCode, 409);
    assert.equal((await c.db.query('SELECT count(*)::int n FROM information.operations WHERE actor=$1', [c.actor])).rows[0].n, 1);
    const listing = await c.request('GET', `/api/v1/l0/task-batches?q=${batch.id}`); assert.equal(listing.statusCode, 200, listing.body);
    assert.equal(listing.json().total, 1); assert.equal(listing.json().metrics.total, 2, 'the unrelated legacy fixture batch remains in range metrics');
    const empty = await c.request('GET', '/api/v1/l0/task-batches?q=not-found'); assert.equal(empty.json().total, 0); assert.equal(empty.json().metrics.total, 2);
    assert.equal((await c.request('GET', '/api/v1/l0/task-batches?from=2026-02-30')).statusCode, 400);
    assert.equal((await c.request('POST', '/api/v1/l0/task-batches', { source_keys: ['wiki-source-001', 'wiki-source-001'], limit: 1 })).statusCode, 400);
  } finally { await c.close(); }
});

test('pausing fences late discovery and material commits, resumes fixed checkpoints and retains the original scheduled time', async () => {
  const c = await setup();
  try {
    const created = await c.request('POST', '/api/v1/l0/task-batches', { source_keys: ['wiki-source-001'], limit: 1 }); assert.equal(created.statusCode, 202, created.body);
    const batch = created.json(); const operation = batch.sources[0].operation_id;
    const [child] = await c.repo.recordDiscovery(operation, 1, [{ url: c.url, title: '受控资料' }], Buffer.from('fixed list'));
    await c.repo.recordRaw(child!, 1, c.raw);
    const before = await c.repo.rawOperation(child!); const material = parsePbc(c.raw, c.url);
    const pauseKey = randomUUID(); const paused = await c.request('POST', `/api/v1/l0/task-batches/${batch.id}/control`, { action: 'pause', expected_version: batch.version, reason: '用户暂停' }, pauseKey);
    assert.equal(paused.statusCode, 200, paused.body); assert.equal(paused.json().status, 'paused');
    assert.equal((await c.request('POST', `/api/v1/l0/task-batches/${batch.id}/control`, { action: 'pause', expected_version: batch.version, reason: '用户暂停' }, pauseKey)).json().version, paused.json().version);
    await assert.rejects(() => c.repo.recordNormalized(child!, 1, material), /STALE_EXECUTION|TASK_PAUSED/);
    await assert.rejects(() => c.repo.recordDiscovery(operation, 1, [{ url: c.url, title: 'late' }], Buffer.from('late')), /STALE_EXECUTION|TASK_PAUSED/);
    assert.equal((await c.request('POST', `/api/v1/l0/task-batches/${batch.id}/control`, { action: 'resume', expected_version: batch.version, reason: 'stale' })).statusCode, 409);
    const resumed = await c.request('POST', `/api/v1/l0/task-batches/${batch.id}/control`, { action: 'resume', expected_version: paused.json().version, reason: '继续' }); assert.equal(resumed.statusCode, 200, resumed.body);
    assert.equal(resumed.json().scheduled_at, batch.scheduled_at);
    const current = await c.repo.rawOperation(child!); assert.equal(current.raw_artifact_id, before.raw_artifact_id); assert.equal(current.normalized_artifact_id, null);
    await c.repo.recordNormalized(child!, Number(current.generation), material); await c.repo.saveMaterial(child!, Number(current.generation));
    const listed = (await c.request('GET', `/api/v1/l0/task-batches?q=${batch.id}`)).json().items[0]; assert.equal(listed.saved_count, 1);
    assert.equal((await c.db.query("SELECT count(*)::int n FROM platform.execution_intents WHERE owner_id=$1 AND kind='material'", [child])).rows[0].n, 2);
  } finally { await c.close(); }
});

test('paused extraction cannot claim or accept old model work and resume retains fixed input and existing errors', async () => {
  const c = await setup();
  try {
    const response = await c.request('POST', '/api/v1/l0/task-batches', { source_keys: ['wiki-source-001'], limit: 1 }); assert.equal(response.statusCode, 202, response.body);
    const batch = response.json(); const [child] = await c.repo.recordDiscovery(batch.sources[0].operation_id, 1, [{ url: c.url, title: '受控资料' }], Buffer.from('fixed list'));
    const material = parsePbc(c.raw, c.url); await c.repo.recordRaw(child!, 1, c.raw); await c.repo.recordNormalized(child!, 1, material); const version = await c.repo.saveMaterial(child!, 1); await c.repo.deliverPending();
    const id = (await c.repo.rawOperation(child!)).processing_id!;
    await c.repo.prepare(id, 1, { version_id: version, material, manifest: { prompt: '受控', provider: { protocol: 'openai-chat', model: 'controlled', endpoint: 'http://127.0.0.1:1' } } });
    const input = (await c.repo.processing(id)).input_artifact_id; const attempt = await c.repo.reserveAttempt(id, 1);
    const paused = await c.request('POST', `/api/v1/l0/task-batches/${batch.id}/control`, { action: 'pause', expected_version: batch.version, reason: '暂停模型阶段' }); assert.equal(paused.statusCode, 200, paused.body);
    assert.equal((await c.model.query('SELECT * FROM platform.claim_model_call($1)', [attempt.id])).rows[0].allowed, false);
    await assert.rejects(() => c.repo.acceptSet(id, 1, { covered_segment_ids: material.segments.map(x => x.id), candidates: [], no_event_reason: '背景', warnings: [] }), /STALE_EXECUTION|TASK_PAUSED/);
    await c.repo.extractionFailed(id, 1, 'LATE_ERROR'); assert.notEqual((await c.repo.processing(id)).error_code, 'LATE_ERROR');
    const resumed = await c.request('POST', `/api/v1/l0/task-batches/${batch.id}/control`, { action: 'resume', expected_version: paused.json().version, reason: '继续模型阶段' }); assert.equal(resumed.statusCode, 200, resumed.body);
    const processing = await c.repo.processing(id); assert.equal(processing.input_artifact_id, input); assert.equal(processing.extraction_status, 'pending');
    await c.repo.acceptSet(id, Number(processing.generation), { covered_segment_ids: material.segments.map(x => x.id), candidates: [], no_event_reason: '背景', warnings: [] });
    assert.equal((await c.request('GET', `/api/v1/l0/task-batches?q=${batch.id}`)).json().items[0].status, 'completed');
  } finally { await c.close(); }
});

test('source-limited actors cannot read or control another source through batch aggregation or history', async () => {
  const c = await setup();
  try {
    const accepted = await c.request('POST', '/api/v1/l0/task-batches', { source_keys: ['wiki-source-001', 'wiki-source-002'], limit: 1 }); assert.equal(accepted.statusCode, 202, accepted.body);
    const batch = accepted.json(); await c.db.query("UPDATE platform.actors SET source_keys=ARRAY['wiki-source-001'] WHERE subject=$1", [c.actor]);
    const listing = await c.request('GET', '/api/v1/l0/task-batches'); assert.ok(listing.json().items.every((x: { sources: { source_key: string }[] }) => x.sources.every(y => y.source_key === 'wiki-source-001')));
    assert.equal((await c.request('GET', '/api/v1/m1/sources/wiki-source-002/history')).statusCode, 403);
    assert.equal((await c.request('POST', `/api/v1/l0/task-batches/${batch.id}/control`, { action: 'pause', expected_version: batch.version, reason: '越权' })).statusCode, 403);
    assert.equal((await c.request('POST', '/api/v1/l0/task-batches', { source_keys: ['wiki-source-001', 'wiki-source-002'], limit: 1 })).statusCode, 403);
    assert.equal((await c.request('POST', '/api/v1/m1/sources', { profile: { name: '不能创建全局来源', url: '' } })).statusCode, 403);
    await c.db.query("UPDATE platform.actors SET permissions=ARRAY['read'] WHERE subject=$1", [c.actor]);
    assert.equal((await c.request('POST', '/api/v1/l0/task-batches', { source_keys: ['wiki-source-001'], limit: 1 })).statusCode, 403);
    const session = randomUUID(); await c.db.query("INSERT INTO platform.auth_sessions(token_hash,subject,expires_at) VALUES($1,$2,now()+interval '1 minute')", [createHash('sha256').update(session).digest('hex'), c.actor]);
    assert.equal((await c.app.inject({ url: '/api/v1/session', headers: { cookie: `riskhot_session=${session}` } })).statusCode, 200);
    await c.db.query('UPDATE platform.auth_sessions SET expires_at=now()-interval \'1 second\'');
    assert.equal((await c.app.inject({ url: '/api/v1/session', headers: { cookie: `riskhot_session=${session}` } })).statusCode, 401);
  } finally { await c.close(); }
});

test('persisted schedule switches are independent from source switches and revisions survive scheduler initialization', async () => {
  const c = await setup();
  try {
    const { Scheduler } = await import('../runtime/scheduler.js');
    const created = await c.request('PATCH', '/api/v1/l0/schedules/wiki-source-001', { enabled: false, interval_seconds: 7200, expected_updated_at: null }); assert.equal(created.statusCode, 200, created.body);
    const schedule = created.json(); assert.equal(schedule.enabled, false);
    await new Scheduler(c.repo, async () => undefined).initialize();
    assert.equal((await c.db.query('SELECT enabled FROM platform.source_schedules WHERE source_id=$1', [c.parent.source_id])).rows[0].enabled, false);
    await c.request('PATCH', '/api/v1/m1/sources/wiki-source-001', { state: 'DISABLED' });
    const enabled = await c.request('PATCH', '/api/v1/l0/schedules/wiki-source-001', { enabled: true, interval_seconds: 7200, expected_updated_at: schedule.updated_at }); assert.equal(enabled.statusCode, 200, enabled.body);
    assert.equal((await c.db.query('SELECT state FROM m1.sources WHERE id=$1', [c.parent.source_id])).rows[0].state, 'DISABLED');
    assert.equal((await c.request('PATCH', '/api/v1/l0/schedules/wiki-source-001', { enabled: false, interval_seconds: 7200, expected_updated_at: schedule.updated_at })).statusCode, 409);
    await c.db.query("INSERT INTO platform.actors VALUES('riskhot-scheduler',ARRAY['read','submit','retry','auto_retry'],ARRAY['*'])");
    await c.db.query("UPDATE information.operations SET status='completed'");
    await c.db.query("UPDATE m1.sources SET state='ACTIVE' WHERE catalog_key='wiki-source-001'");
    const disabled = await c.request('PATCH', '/api/v1/l0/schedules/wiki-source-001', { enabled: false, interval_seconds: 7200, expected_updated_at: enabled.json().updated_at }); assert.equal(disabled.statusCode, 200, disabled.body);
    await c.db.query('INSERT INTO platform.schedule_runs(source_id,scheduled_at) VALUES($1,now()-interval \'1 hour\')', [c.parent.source_id]);
    await new Scheduler(c.repo, async () => undefined).tick(); assert.equal((await c.db.query("SELECT count(*)::int n FROM information.operations WHERE actor='riskhot-scheduler' AND source_id=$1", [c.parent.source_id])).rows[0].n, 0, 'disabled plans must not submit an already pending slot');
  } finally { await c.close(); }
});

async function savedChild(c: Awaited<ReturnType<typeof setup>>, root: string) {
  const [child] = await c.repo.recordDiscovery(root, 1, [{ url: c.url, title: '受控资料' }], Buffer.from('fixed list'));
  await c.repo.recordRaw(child!, 1, c.raw);
  await c.repo.recordNormalized(child!, 1, parsePbc(c.raw, c.url));
  await c.repo.saveMaterial(child!, 1);
  return child!;
}

// Real database triggers hold an in-flight mutation before commit, allowing the
// management request to race against discovery/delivery without mocking either.
async function mutationGate(c: Awaited<ReturnType<typeof setup>>, when: string) {
  const key = Math.floor(Math.random() * 1_000_000_000) + 1;
  const gate = await c.db.connect();
  await gate.query('SELECT pg_advisory_lock($1)', [key]);
  await c.db.query(`CREATE FUNCTION platform.management_test_gate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(${key}); RETURN NEW; END $$;
    CREATE TRIGGER management_test_gate BEFORE UPDATE ON information.operations FOR EACH ROW WHEN (${when}) EXECUTE FUNCTION platform.management_test_gate()`);
  const blocked = async (minimum: number) => {
    const until = Date.now() + 5000;
    while (Date.now() < until) {
      const n = Number((await c.db.query("SELECT count(*) n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")).rows[0].n);
      if (n >= minimum) return;
      await setTimeout(10);
    }
    throw new Error(`EXPECTED_${minimum}_BLOCKED_TRANSACTIONS`);
  };
  return { blocked, async release() { await gate.query('SELECT pg_advisory_unlock($1)', [key]); gate.release(); } };
}

for (const stage of ['discovery', 'delivery'] as const) test(`pause fences ${stage} already committing when the control request starts`, async () => {
  const c = await setup(); let gate: Awaited<ReturnType<typeof mutationGate>> | undefined;
  let mutation: Promise<unknown> | undefined, pause: ReturnType<typeof c.request> | undefined;
  try {
    const batch = (await c.request('POST', '/api/v1/l0/task-batches', { source_keys: ['wiki-source-001'], limit: 1 })).json();
    const root = batch.sources[0].operation_id;
    if (stage === 'delivery') await savedChild(c, root);
    gate = await mutationGate(c, stage === 'discovery' ? `NEW.id='${root}' AND NEW.raw_artifact_id IS NOT NULL` : 'NEW.processing_id IS NOT NULL AND OLD.processing_id IS NULL');
    mutation = stage === 'discovery' ? c.repo.recordDiscovery(root, 1, [{ url: c.url, title: '受控资料' }], Buffer.from('fixed list')) : c.repo.deliverPending();
    await gate.blocked(1);
    pause = c.request('POST', `/api/v1/l0/task-batches/${batch.id}/control`, { action: 'pause', expected_version: batch.version, reason: '并发暂停' });
    // Fastify injection is lazy until it is consumed.
    const pauseResult = Promise.resolve(pause); await gate.blocked(2);
    await gate.release(); gate = undefined;
    await mutation; const response = await pauseResult;
    assert.equal(response.statusCode, 200, response.body);
    const children = (await c.db.query('SELECT * FROM information.operations WHERE parent_id=$1', [root])).rows;
    assert.equal(children.length, 1); assert.ok(children.every(child => child.paused), 'every committed child must be fenced');
    if (stage === 'delivery') {
      const processing = await c.repo.processing(children[0].processing_id);
      assert.equal(processing.paused, true, 'a concurrently attached processing must be fenced');
      assert.equal(Number(processing.generation), 2);
    }
  } finally {
    await gate?.release(); await Promise.allSettled([mutation, pause]); await c.close();
  }
});

test('shared processing chooses an active owner when the oldest batch is paused', async () => {
  const c = await setup();
  try {
    const original = await c.processing();
    const batch = (await c.request('POST', '/api/v1/l0/task-batches', { source_keys: ['wiki-source-001'], limit: 1 })).json();
    await savedChild(c, batch.sources[0].operation_id); await c.repo.deliverPending();
    const paused = await c.request('POST', `/api/v1/l0/task-batches/${c.parent.id}/control`, { action: 'pause', expected_version: 1, reason: '只暂停最早批次' });
    assert.equal(paused.statusCode, 200, paused.body);
    assert.equal((await c.repo.processing(original.id)).paused, false);
    assert.equal(await ioActivities(c.repo).prepareExtraction(original.id, 1), true);
    assert.equal((await c.repo.processing(original.id)).extraction_status, 'pending');
  } finally { await c.close(); }
});

test('a later active owner resumes shared paused processing without unpausing the original batch', async () => {
  const c = await setup();
  try {
    const original = await c.processing();
    const paused = await c.request('POST', `/api/v1/l0/task-batches/${c.parent.id}/control`, { action: 'pause', expected_version: 1, reason: '暂停独占抽取' });
    assert.equal(paused.statusCode, 200, paused.body); assert.equal((await c.repo.processing(original.id)).paused, true);
    const batch = (await c.request('POST', '/api/v1/l0/task-batches', { source_keys: ['wiki-source-001'], limit: 1 })).json();
    const child = await savedChild(c, batch.sources[0].operation_id); await c.repo.deliverPending();
    const processing = await c.repo.processing(original.id);
    assert.equal((await c.repo.rawOperation(child)).processing_id, original.id);
    assert.equal(processing.paused, false); assert.equal(Number(processing.generation), 3);
    assert.equal((await c.repo.rawOperation(c.parent.id)).paused, true);
    assert.equal((await c.db.query("SELECT count(*)::int n FROM platform.execution_intents WHERE kind='extract' AND owner_id=$1 AND generation=$2", [original.id, processing.generation])).rows[0].n, 1);
  } finally { await c.close(); }
});

test('nested partial source outcomes remain partial batches with confirmed unique saves', async () => {
  const c = await setup();
  try {
    const batch = (await c.request('POST', '/api/v1/l0/task-batches', { source_keys: ['wiki-source-001'], limit: 2 })).json();
    const root = batch.sources[0].operation_id;
    const children = await c.repo.recordDiscovery(root, 1, [{ url: c.url, title: '第一份' }, { url: c.url.replace('9999999999999999', '8888888888888888'), title: '第二份' }], Buffer.from('list'));
    await c.db.query("UPDATE information.operations SET status=CASE WHEN id=$2 THEN 'completed' ELSE 'recoverable' END,reason_code=CASE WHEN id=$2 THEN NULL ELSE 'SOURCE_UNAVAILABLE' END WHERE parent_id=$1", [root, children[0]]);
    const item = (await c.request('GET', `/api/v1/l0/task-batches?q=${batch.id}`)).json().items[0];
    assert.equal(item.sources[0].status, 'partial'); assert.equal(item.status, 'partial');
    assert.equal((await c.request('GET', `/api/v1/l0/task-batches?status=partial&q=${batch.id}`)).json().total, 1);
    assert.equal(item.has_error, true); assert.equal(item.error_sources, 1);
  } finally { await c.close(); }
});

for (const kind of ['pending', 'due'] as const) test(`disabling a plan after selecting its ${kind} slot prevents submission and schedule overwrite`, async () => {
  const c = await setup();
  try {
    const { Scheduler } = await import('../runtime/scheduler.js');
    await c.db.query("INSERT INTO platform.actors VALUES('riskhot-scheduler',ARRAY['read','submit','retry','auto_retry'],ARRAY['*'])");
    await c.db.query("UPDATE information.operations SET status='completed'");
    const schedule = (await c.request('PATCH', '/api/v1/l0/schedules/wiki-source-001', { enabled: true, interval_seconds: 60, expected_updated_at: null })).json();
    await c.db.query("UPDATE platform.source_schedules SET next_run_at=now()-interval '1 hour' WHERE source_id=$1", [c.parent.source_id]);
    if (kind === 'pending') await c.db.query("INSERT INTO platform.schedule_runs(source_id,scheduled_at) VALUES($1,now()-interval '1 hour')", [c.parent.source_id]);
    let interrupted = false; let disabledNext: string | undefined;
    const connection = await c.db.connect(); const query = connection.query;
    connection.query = new Proxy(query, { apply(target, receiver, args) {
      const result = Reflect.apply(target, receiver, args);
      if (typeof args[0] === 'string' && args[0].includes(kind === 'pending' ? 'SELECT r.id,s.catalog_key' : 'SELECT q.*,s.catalog_key')) return result.then(async (rows: unknown) => {
        if (!interrupted) {
          interrupted = true;
          const disabled = await c.request('PATCH', '/api/v1/l0/schedules/wiki-source-001', { enabled: false, interval_seconds: 7200, expected_updated_at: schedule.updated_at });
          assert.equal(disabled.statusCode, 200, disabled.body); disabledNext = disabled.json().next_run_at;
        }
        return rows;
      });
      return result;
    } });
    // The scheduler's first connection is its candidate-selection session.
    connection.release();
    try { await new Scheduler(c.repo, async () => undefined).tick(); }
    finally { connection.query = query; }
    assert.equal(interrupted, true);
    assert.equal((await c.db.query("SELECT count(*)::int n FROM information.operations WHERE actor='riskhot-scheduler'")).rows[0].n, 0);
    const current = (await c.db.query('SELECT * FROM platform.source_schedules WHERE source_id=$1', [c.parent.source_id])).rows[0];
    assert.equal(current.next_run_at.toISOString(), disabledNext);
  } finally { await c.close(); }
});


test('unified runs preserve scheduler slots without duplicate operations and scope metrics by source',async()=>{
 const c=await setup();try{
  const row=(await c.db.query("INSERT INTO platform.schedule_runs(source_id,scheduled_at,operation_id,status) VALUES($1,now(),$2,'running') RETURNING id",[c.parent.source_id,c.parent.id])).rows[0];
  const queued=(await c.db.query("INSERT INTO platform.schedule_runs(source_id,scheduled_at,status) VALUES($1,now()+interval '1 second','pending') RETURNING id",[c.parent.source_id])).rows[0];
  const failure=(await c.db.query("INSERT INTO platform.schedule_runs(source_id,scheduled_at,status,error_code) VALUES($1,now()+interval '2 seconds','failed','SOURCE_DISABLED') RETURNING id",[c.parent.source_id])).rows[0];
  const response=await c.request('GET','/api/v1/l0/task-batches?source=wiki-source-001');assert.equal(response.statusCode,200,response.body);
  const data=response.json();assert.equal(data.total,3);assert.equal(data.metrics.total,3);assert.equal(data.items.filter((x:{id:string})=>x.id===c.parent.id).length,1);
  assert.equal(data.items.find((x:{id:string})=>x.id===c.parent.id).schedule_run_id,row.id);assert.equal(data.items.find((x:{id:string})=>x.id===queued.id).unstarted,true);assert.equal(data.items.find((x:{id:string})=>x.id===failure.id).controllable,false);
  assert.equal((await c.request('GET',`/api/v1/l0/task-batches?status=attention&source=wiki-source-001`)).json().total,1);
  assert.equal((await c.request('GET','/api/v1/l0/task-batches?source=wiki-source-002')).json().metrics.total,0);
  await c.db.query("UPDATE platform.actors SET source_keys=ARRAY['wiki-source-002'] WHERE subject=$1",[c.actor]);assert.equal((await c.request('GET','/api/v1/l0/task-batches?source=wiki-source-001')).statusCode,403);
 }finally{await c.close();}
});

test('batch filtering retains one whole task and details retain blocked source items',async()=>{
 const c=await setup();try{
  const batch=(await c.request('POST','/api/v1/l0/task-batches',{source_keys:['wiki-source-001','wiki-source-002'],limit:1})).json();
  await c.db.query("UPDATE platform.task_batch_sources SET operation_id=NULL,status='blocked',reason_code='SOURCE_DISABLED' WHERE batch_id=$1 AND source_id=(SELECT id FROM m1.sources WHERE catalog_key='wiki-source-002')",[batch.id]);
  const response=await c.request('GET',`/api/v1/l0/task-batches?batch=${batch.id}&status=attention`);assert.equal(response.statusCode,200,response.body);assert.equal(response.json().total,1);assert.equal(response.json().items[0].id,batch.id);assert.equal(response.json().items[0].sources.length,2);assert.equal(response.json().metrics.total,1);
  const detail=await c.request('GET',`/api/v1/l0/task-batches/${batch.id}`);assert.equal(detail.statusCode,200,detail.body);assert.equal(detail.json().sources.length,2);assert.equal(detail.json().sources[1].operation_id,null);
  const oldLink=await c.request('GET',`/api/v1/l0/task-batches/${batch.sources[0].operation_id}`);assert.equal(oldLink.statusCode,200,oldLink.body);assert.equal(oldLink.json().id,batch.id);
  await c.db.query("UPDATE platform.actors SET source_keys=ARRAY['wiki-source-003'] WHERE subject=$1",[c.actor]);assert.equal((await c.request('GET',`/api/v1/l0/task-batches/${batch.id}`)).statusCode,404);
 }finally{await c.close();}
});


test('automatic run date uses its schedule slot across Shanghai midnight and ignores resolved scheduler errors',async()=>{
 const c=await setup();try{
  await c.db.query("UPDATE information.operations SET scheduled_at='2026-10-27T16:01:00Z',status='completed' WHERE id=$1",[c.parent.id]);
  await c.db.query("INSERT INTO platform.schedule_runs(source_id,scheduled_at,operation_id,status,error_code) VALUES($1,'2026-10-27T15:59:00Z',$2,'failed','MODEL_BUDGET_EXHAUSTED')",[c.parent.source_id,c.parent.id]);
  let response=await c.request('GET','/api/v1/l0/task-batches?from=2026-10-27&to=2026-10-27&source=wiki-source-001');assert.equal(response.statusCode,200,response.body);assert.equal(response.json().total,1);assert.equal(response.json().items[0].id,c.parent.id);assert.equal(response.json().items[0].status,'completed');assert.equal(response.json().metrics.attention,0);
  response=await c.request('GET','/api/v1/l0/task-batches?from=2026-10-28&to=2026-10-28&source=wiki-source-001');assert.equal(response.json().total,0);
 }finally{await c.close();}
});
