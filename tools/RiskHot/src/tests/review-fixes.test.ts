import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { setTimeout } from 'node:timers/promises';
import { Repository } from '../information-ingestion/processing/repository.js';
import { parsePbc } from '../information-ingestion/processing/pbc.js';
import { HttpModelClient } from '../information-ingestion/processing/model.js';
import { openFixture } from './fixture.js';

test('runtime children receive only their own database and identity credentials', async () => {
  const { runtimeEnvironment } = await import('../runtime/environment.js');
  const base = { PATH: '/usr/bin', ADMIN_DATABASE_URL: 'controlled-admin', DATABASE_URL: 'controlled-api', IO_DATABASE_URL: 'controlled-io', MODEL_DATABASE_URL: 'controlled-model', MODEL_API_KEY: 'controlled-model-key', OIDC_CLIENT_SECRET: 'controlled-identity' };
  assert.equal(runtimeEnvironment('model', base).MODEL_API_KEY, 'controlled-model-key');
  assert.equal(runtimeEnvironment('model', base).ADMIN_DATABASE_URL, undefined);
  assert.equal(runtimeEnvironment('model', base).OIDC_CLIENT_SECRET, undefined);
  assert.equal(runtimeEnvironment('io', base).MODEL_API_KEY, undefined);
  assert.equal(runtimeEnvironment('io', base).MODEL_CREDENTIAL_READY, 'true');
  assert.equal(runtimeEnvironment('api', base).OIDC_CLIENT_SECRET, 'controlled-identity');
  assert.equal(runtimeEnvironment('api', base).IO_DATABASE_URL, undefined);
});

test('the actual model database role can register response artifacts without UPDATE privileges', async () => {
  const context = await openFixture();
  try {
    const repo = new Repository(context.model, context.artifacts);
    const ref = await context.artifacts.put(Buffer.from('controlled model response'), 'model-response');
    const id = await repo.artifact(ref);
    assert.equal(await repo.artifact(ref), id);
    assert.equal((await repo.bytes(id)).toString(), 'controlled model response');
  } finally { await context.dispose(); }
});

test('raw and discovered snapshots recover after publication but before any acquisition transaction commits', async () => {
  const context = await openFixture();
  try {
    const { repo, db, parent, url, raw } = context;
    await db.query(`CREATE FUNCTION platform.reject_discovery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.parent_id='${parent.id}'::uuid THEN RAISE EXCEPTION 'INJECTED_DISCOVERY_FAILURE'; END IF; RETURN NEW; END $$`);
    await db.query('CREATE TRIGGER reject_discovery BEFORE INSERT ON information.operations FOR EACH ROW EXECUTE FUNCTION platform.reject_discovery()');
    await assert.rejects(() => repo.recordDiscovery(parent.id, 1, [{ url, title: 'original listing' }], Buffer.from('original listing')), /INJECTED_DISCOVERY_FAILURE/);
    await db.query('DROP TRIGGER reject_discovery ON information.operations');
    const restored = await repo.recoverDiscovery(parent.id, 1);
    assert.ok(restored?.length === 1);
    const child = restored[0]!;
    assert.equal((await repo.operation(child)).url, url);
    assert.equal((await repo.bytes((await repo.rawOperation(parent.id)).raw_artifact_id!)).toString(), 'original listing');
    await db.query(`CREATE FUNCTION platform.reject_acquisition() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.operation_id='${child}'::uuid THEN RAISE EXCEPTION 'INJECTED_ACQUISITION_FAILURE'; END IF; RETURN NEW; END $$`);
    await db.query('CREATE TRIGGER reject_acquisition BEFORE INSERT ON information.acquisitions FOR EACH ROW EXECUTE FUNCTION platform.reject_acquisition()');
    await assert.rejects(() => repo.recordRaw(child, 1, raw), /INJECTED_ACQUISITION_FAILURE/);
    await db.query('DROP TRIGGER reject_acquisition ON information.acquisitions');
    assert.equal(await repo.recoverRaw(child, 1), true);
    await repo.recordRaw(child, 1, Buffer.from('the website changed after the crash'));
    assert.deepEqual(await repo.bytes((await repo.rawOperation(child)).raw_artifact_id!), raw);
    const again = await repo.recordDiscovery(parent.id, 1, [{ url: url.replace('9999999999999999', '8888888888888888'), title: 'new listing' }], Buffer.from('changed listing'));
    assert.deepEqual(again, restored);
  } finally { await context.dispose(); }
});

test('an HTTP call is aborted when its remaining processing budget expires', async () => {
  const server = createServer(async (_request, response) => { await setTimeout(150); response.end('{"choices":[]}'); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  try {
    await assert.rejects(() => new HttpModelClient().execute({ version_id: 'controlled', material: { url: '', title: null, publishedAtText: null, normalizerVersion: 'test', segments: [] }, manifest: { prompt: 'controlled', provider: { protocol: 'openai-chat', model: 'controlled', endpoint: `http://127.0.0.1:${address.port}` } } }, 'controlled-local-key', { deadlineMs: Date.now() + 25 }), /MODEL_BUDGET_EXHAUSTED/);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('queued calls require a current generation, source authorization and an unexpired budget at actual execution', async () => {
  const context = await openFixture();
  try {
    const { repo, db, model } = context;
    const { id } = await context.processing();
    const attempt = await repo.reserveAttempt(id, 1);
    const claim = async () => (await model.query('SELECT * FROM platform.claim_model_call($1)', [attempt.id])).rows[0];
    await db.query("UPDATE platform.model_budget_windows SET deadline=now()-interval '1 second' WHERE processing_id=$1", [id]);
    assert.equal((await claim()).reason_code, 'MODEL_BUDGET_EXHAUSTED');
    await db.query("UPDATE platform.model_budget_windows SET deadline=now()+interval '10 minutes' WHERE processing_id=$1", [id]);
    await db.query("UPDATE m1.sources SET state='DISABLED'");
    assert.equal((await claim()).reason_code, 'SOURCE_DISABLED');
    await db.query("UPDATE m1.sources SET state='ACTIVE'");
    await db.query('UPDATE information.processing_runs SET generation=2 WHERE id=$1', [id]);
    assert.equal((await claim()).reason_code, 'STALE_EXECUTION');
    await db.query('UPDATE information.processing_runs SET generation=1 WHERE id=$1', [id]);
    await db.query("UPDATE platform.actors SET permissions=ARRAY['read'] WHERE subject='review-operator'");
    assert.equal((await claim()).reason_code, 'FORBIDDEN');
    await db.query("UPDATE platform.actors SET permissions=ARRAY['read','submit','retry'] WHERE subject='review-operator'");
    assert.equal((await claim()).allowed, true);
    assert.equal((await claim()).allowed, false, 'A call permit is claimed only once');
  } finally { await context.dispose(); }
});

test('equivalent PBC URL spellings reuse one material version and one processing identity', async () => {
  const context = await openFixture();
  try {
    const { repo, url, raw } = context;
    const original = await context.processing();
    const variant = url.replace('https://www.pbc.gov.cn/', 'https://WWW.PBC.GOV.CN:443/');
    assert.equal(parsePbc(raw, variant).url, url);
    assert.deepEqual(parsePbc(raw, variant).segments, parsePbc(raw, url).segments);
    const parent = await repo.submit({ source_key: 'wiki-source-001', limit: 1, url: variant }, 'review-operator', randomUUID());
    const [child] = await repo.recordDiscovery(parent.id, 1, [{ url: variant, title: 'same document' }], Buffer.from('alias list'));
    await repo.recordRaw(child!, 1, raw); await repo.recordNormalized(child!, 1, parsePbc(raw, variant));
    assert.equal(await repo.saveMaterial(child!, 1), original.version);
    await repo.deliverPending();
    assert.equal((await repo.operation(child!)).processing_id, original.id);
    assert.equal((await context.db.query('SELECT count(*)::int AS n FROM information.materials')).rows[0].n, 1);
  } finally { await context.dispose(); }
});

test('a 200 login or access gate retaining the article container is not an extractable announcement', () => {
  const url = 'https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/9999999999999999/index.html';
  assert.throws(() => parsePbc(Buffer.from('<title>用户登录</title><div id="zoom"><form><p>请先登录再查看公告</p><input type="password"></form></div>'), url), /SOURCE_AUTH_REQUIRED/);
  assert.throws(() => parsePbc(Buffer.from('<title>安全验证</title><div id="zoom"><p>请输入验证码后继续访问。</p></div>'), url), /SOURCE_ACCESS_BLOCKED/);
});

test('schema and forged-evidence failures require a basis-bound authorized review before any retry window', async () => {
  for (const code of ['MODEL_SCHEMA_INVALID', 'MODEL_EVIDENCE_INVALID']) {
    const context = await openFixture();
    try {
      const { repo, db } = context; const { id } = await context.processing();
      const attempt = await repo.reserveAttempt(id, 1);
      const artifact = await repo.putJson({ status: 200, body: 'controlled rejected output' }, 'model-response');
      await db.query("UPDATE platform.model_attempts SET status='rejected',error_code=$2,response_artifact_id=$3 WHERE id=$1", [attempt.id, code, artifact]);
      await repo.extractionFailed(id, 1, code);
      assert.equal((await repo.processing(id)).extraction_status, 'review');
      await assert.rejects(() => repo.retryExtraction(id, 'review-operator', 'ordinary retry', false, 1), /OUTPUT_REVIEW_REQUIRED/);
      await assert.rejects(() => repo.retryExtraction(id, 'review-operator', 'new budget', true, 1), /OUTPUT_REVIEW_REQUIRED/);
      const basis = await repo.reviewBasis(id);
      await assert.rejects(() => repo.reviewOutput(id, 'review-operator', '允许基于固定输入再次尝试', 1, basis.digest, randomUUID()), /FORBIDDEN/);
      await db.query("UPDATE platform.actors SET permissions=array_append(permissions,'model_review') WHERE subject='review-operator'");
      await assert.rejects(() => repo.reviewOutput(id, 'review-operator', 'stale basis', 1, '0'.repeat(64), randomUUID()), /REVIEW_BASIS_CHANGED/);
      assert.equal(await repo.reviewOutput(id, 'review-operator', '允许基于固定输入再次尝试', 1, basis.digest, randomUUID()), 2);
      assert.equal((await repo.processing(id)).candidate_count, null);
      assert.equal(await repo.retryExtraction(id, 'review-operator', 'review approved', false, 2), 3);
      assert.equal((await repo.candidates(id)).length, 0);
    } finally { await context.dispose(); }
  }
});
