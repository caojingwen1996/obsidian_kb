import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { ArtifactStore } from '../src/platform/artifacts.js';
import { ExecutionStore } from '../src/l0/execution.js';
import { HttpModelClient, decodeModelResponse } from '../src/l0/model.js';
import { parsePbc } from '../src/l0/pbc.js';

test('retains real transport responses and distinguishes stop, truncation, HTTP errors and invalid JSON', async () => {
  let scenario = 'stop';
  const server = createServer(async (request, response) => {
    let input = ''; for await (const chunk of request) input += chunk;
    assert.equal(JSON.parse(input).model, 'controlled-test-model');
    if (scenario === 'http') { response.writeHead(429); response.end('{"error":"rate limited"}'); return; }
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ choices: [{ finish_reason: scenario === 'truncated' ? 'length' : 'stop', message: { content: scenario === 'invalid' ? '{' : '{"candidates":[]}' } }] }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const client = new HttpModelClient();
  const input = { manifest: { provider: { protocol: 'openai-chat', endpoint: `http://127.0.0.1:${address.port}`, model: 'controlled-test-model' }, prompt: 'Return JSON' }, material: { title: null, publishedAtText: null, url: '', normalizerVersion: 'test', segments: [] }, version_id: 'test' };
  try {
    assert.equal(decodeModelResponse(await client.execute(input, 'controlled-local-key')).complete, true);
    scenario = 'truncated'; assert.equal(decodeModelResponse(await client.execute(input, 'controlled-local-key')).complete, false);
    scenario = 'invalid';
    async function invalid() { return decodeModelResponse(await client.execute(input, 'controlled-local-key')); }
    // The invalid response is persisted by callers before decoding it.
    const awaitResult = await client.execute(input, 'controlled-local-key');
    assert.throws(() => decodeModelResponse(awaitResult), /JSON/);
    await assert.rejects(invalid, /JSON/);
    scenario = 'http';
    const awaitResultHttp = await client.execute(input, 'controlled-local-key');
    assert.throws(() => decodeModelResponse(awaitResultHttp), /HTTP_429/);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('enforces persistent model budgets and fences late attempts after authorized recovery', async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(connectionString && new URL(connectionString).pathname === '/riskhot_test');
  const db = new Pool({ connectionString });
  const folder = await mkdtemp(join(tmpdir(), 'riskhot-execution-'));
  try {
    const repo = new ExecutionStore(db, new ArtifactStore(folder));
    await repo.seedCatalog([{ id: 'wiki-source-001', name: '中国人民银行', url: 'https://www.pbc.gov.cn/', tier: 'T1', group: '测试', focus: '测试', context: '测试' }]);
    await db.query("INSERT INTO platform.actors(subject,permissions,source_keys) VALUES('pipeline-operator',ARRAY['submit','read','retry','model_budget'],ARRAY['wiki-source-001']) ON CONFLICT(subject) DO NOTHING");
    const parent = await repo.submit({ source_key: 'wiki-source-001', limit: 1 }, 'pipeline-operator', `pipeline-${Date.now()}`);
    const url = `https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/${Date.now()}/index.html`;
    const [child] = await repo.recordDiscovery(parent.id, 1, [{ url, title: '测试' }], Buffer.from('test list'));
    assert.ok(child);
    const raw = Buffer.from('<div id="zoom"><p>虚构机构宣布两项措施。</p></div>');
    const material = parsePbc(raw, url);
    await repo.recordRaw(child, 1, raw); await repo.recordNormalized(child, 1, material); await repo.saveMaterial(child, 1); await repo.deliverPending();
    const processingId = (await repo.operation(child)).processing_id!;
    await repo.prepare(processingId, 1, { version_id: (await repo.processing(processingId)).version_id, material, manifest: { provider: { protocol: 'openai-chat', endpoint: 'http://127.0.0.1:1', model: 'controlled-test-model' }, prompt: 'Return JSON' } });
    for (let i = 0; i < 3; i++) await repo.reserveAttempt(processingId, 1);
    await assert.rejects(() => repo.reserveAttempt(processingId, 1), /BUDGET_EXHAUSTED/);
    assert.equal((await repo.processing(processingId)).candidate_count, null);
    await assert.rejects(() => repo.retryExtraction(processingId, 'pipeline-operator', 'ordinary retry', false, 1), /BUDGET_EXHAUSTED/);
    const recoveryKey = `budget-${processingId}`;
    const next = await repo.retryExtraction(processingId, 'pipeline-operator', '服务恢复，授权再次尝试', true, 1, recoveryKey);
    assert.equal(next, 2);
    assert.equal(await repo.retryExtraction(processingId, 'pipeline-operator', '服务恢复，授权再次尝试', true, 1, recoveryKey), 2);
    const attempt = await repo.reserveAttempt(processingId, 2);
    assert.equal(attempt.attempt_no, 4);
    const result = { covered_segment_ids: material.segments.map(x => x.id), candidates: [], no_event_reason: '受控测试', warnings: [] };
    await assert.rejects(() => repo.acceptSet(processingId, 1, result), /STALE_EXECUTION/);
    await repo.acceptSet(processingId, 2, result);
    assert.equal((await repo.processing(processingId)).candidate_count, 0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM platform.model_budget_windows WHERE processing_id=$1', [processingId])).rows[0].n, 2);
  } finally { await db.end(); await rm(folder, { recursive: true, force: true }); }
});
