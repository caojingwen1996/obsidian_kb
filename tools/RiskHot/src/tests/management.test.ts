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

async function setup() {
  const c = await openFixture();
  const response = await fetch(`${process.env.OIDC_ISSUER}/protocol/openid-connect/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: process.env.OIDC_CLIENT_ID!, client_secret: process.env.OIDC_CLIENT_SECRET!, username: process.env.OPERATOR_USERNAME!, password: process.env.OPERATOR_PASSWORD! }) });
  const token = (await response.json()).access_token as string; assert.ok(token);
  const actor = decodeJwt(token).sub!;
  await c.repo.seedCatalog((await readCatalog('src/data/source-catalog.js')).slice(0, 3));
  await c.db.query("INSERT INTO platform.actors VALUES($1,ARRAY['read','submit','source_admin','retry','model_budget'],ARRAY['*'])", [actor]);
  const apiDb = new Pool({ connectionString: c.urlFor('DATABASE_URL') });
  const app = await buildServer(new ExecutionStore(apiDb, c.artifacts));
  const request = (method: string, url: string, payload?: unknown, key = randomUUID()) => app.inject({ method: method as 'POST', url, headers: { authorization: `Bearer ${token}`, 'idempotency-key': key, 'content-type': 'application/json' }, ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }) });
  return { ...c, app, actor, request, async close() { await app.close(); await apiDb.end(); await c.dispose(); } };
}

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
