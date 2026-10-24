import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { ArtifactStore } from '../src/platform/artifacts.js';
import { Repository } from '../src/l0/repository.js';
import { parsePbc } from '../src/l0/pbc.js';

const url = 'https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026102308535522110/index.html';
const bytes = Buffer.from('<meta name="ArticleTitle" content="测试"><div id="zoom"><p>测试机构宣布实施两项措施。</p></div>');

test('publishes immutable bytes and detects damaged artifacts', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'riskhot-artifacts-'));
  try {
    const store = new ArtifactStore(folder);
    const first = await store.put(Buffer.from('原始😀'), 'raw');
    const second = await store.put(Buffer.from('原始😀'), 'raw');
    assert.equal(first.sha256, second.sha256);
    assert.equal((await store.read(first.sha256)).toString(), '原始😀');
    await writeFile(join(folder, first.sha256.slice(0, 2), first.sha256), 'damaged');
    await assert.rejects(() => store.read(first.sha256), /ARTIFACT_INTEGRITY/);
    await assert.rejects(() => store.read('../escape'), /ARTIFACT_REF/);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('persists complete commands and reuses concurrent submissions and fixed candidate sets', async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(connectionString && new URL(connectionString).pathname === '/riskhot_test', 'Dedicated test database is required');
  const db = new Pool({ connectionString });
  const folder = await mkdtemp(join(tmpdir(), 'riskhot-storage-'));
  try {
    const repo = new Repository(db, new ArtifactStore(folder));
    await repo.seedCatalog([{ id: 'wiki-source-001', name: '中国人民银行', url: 'https://www.pbc.gov.cn/', tier: 'T1', group: '测试', focus: '测试', context: '测试' }]);
    await db.query("INSERT INTO platform.actors(subject,permissions,source_keys) VALUES('storage-operator',ARRAY['submit','read','source_admin','retry'],ARRAY['wiki-source-001']) ON CONFLICT(subject) DO NOTHING");
    const key = `storage-${Date.now()}`;
    const command = { source_key: 'wiki-source-001', limit: 1 };
    const results = await Promise.all(Array.from({ length: 5 }, () => repo.submit(command, 'storage-operator', key)));
    assert.equal(new Set(results.map(x => x.id)).size, 1);
    await assert.rejects(() => repo.submit({ ...command, limit: 2 }, 'storage-operator', key), /IDEMPOTENCY_CONFLICT/);
    const parent = results[0]!;
    const savedCommand = await repo.json<{ source_id: string; source_version: number; source_key: string }>(parent.command_artifact_id);
    assert.equal(savedCommand.source_key, 'wiki-source-001');
    assert.equal(savedCommand.source_id, parent.source_id);
    assert.equal(savedCommand.source_version, parent.source_version);
    const runUrl = url.replace('2026102308535522110', Date.now().toString());
    const children = await repo.recordDiscovery(parent.id, 1, [{ url: runUrl, title: '测试' }], Buffer.from('saved listing'));
    const repeatedDiscovery = await repo.recordDiscovery(parent.id, 1, [{ url: url.replace('2026102308535522110', '2026102200000000000'), title: 'late item' }], Buffer.from('changed listing'));
    assert.deepEqual(repeatedDiscovery, children, 'A saved discovery set must not grow during a retry');
    const child = children[0]!;
    await db.query(`CREATE OR REPLACE FUNCTION platform.reject_raw_checkpoint() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${child}'::uuid AND NEW.raw_artifact_id IS NOT NULL AND OLD.raw_artifact_id IS NULL THEN RAISE EXCEPTION 'INJECTED_CHECKPOINT_FAILURE'; END IF; RETURN NEW; END $$`);
    await db.query('CREATE TRIGGER reject_raw_checkpoint BEFORE UPDATE ON information.operations FOR EACH ROW EXECUTE FUNCTION platform.reject_raw_checkpoint()');
    try {
      await assert.rejects(() => repo.recordRaw(child, 1, bytes), /INJECTED_CHECKPOINT_FAILURE/);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM information.acquisitions WHERE operation_id=$1', [child])).rows[0].n, 1, 'A published acquisition receipt survives a later operation checkpoint failure');
    } finally {
      await db.query('DROP TRIGGER reject_raw_checkpoint ON information.operations');
      await db.query('DROP FUNCTION platform.reject_raw_checkpoint()');
    }
    assert.equal(await repo.recoverRaw(child, 1), true);
    await repo.recordRaw(child, 1, bytes);
    await repo.recordNormalized(child, 1, parsePbc(bytes, runUrl));
    const versions = await Promise.all([repo.saveMaterial(child, 1), repo.saveMaterial(child, 1)]);
    assert.equal(versions[0], versions[1]);
    await db.query("UPDATE m1.sources SET state='DISABLED' WHERE catalog_key='wiki-source-001'");
    await repo.deliverPending();
    assert.equal((await repo.operation(child)).processing_id, null, 'Delivery must recheck current source eligibility');
    await db.query("UPDATE m1.sources SET state='ACTIVE' WHERE catalog_key='wiki-source-001'");
    await repo.deliverPending();
    const operation = await repo.operation(child);
    assert.ok(operation.processing_id);
    assert.equal((await repo.processing(operation.processing_id!)).candidate_count, null);
    await db.query("UPDATE information.processing_runs SET extraction_status='recoverable',error_code='MODEL_NOT_CONFIGURED' WHERE id=$1", [operation.processing_id]);
    await repo.failOperation(child, 1, 'MODEL_NOT_CONFIGURED', true);
    const duplicateBatch = await repo.submit(command, 'storage-operator', `${key}-same-version`);
    const [duplicateChild] = await repo.recordDiscovery(duplicateBatch.id, 1, [{ url: runUrl, title: 'same source version' }], Buffer.from('saved duplicate listing'));
    assert.ok(duplicateChild);
    await repo.recordRaw(duplicateChild, 1, bytes); await repo.recordNormalized(duplicateChild, 1, parsePbc(bytes, runUrl)); await repo.saveMaterial(duplicateChild, 1); await repo.deliverPending();
    assert.equal((await repo.operation(duplicateChild)).processing_id, operation.processing_id);
    assert.equal((await repo.operation(duplicateBatch.id)).slice_status, 'waiting_config', 'Reusing an existing processing must preserve its waiting state');
    await repo.failOperation(child, 1, 'INJECTED_FAILURE');
    assert.equal((await repo.processing(operation.processing_id!)).candidate_count, null);
    const material = parsePbc(bytes, runUrl);
    const data = { covered_segment_ids: material.segments.map(x => x.id), candidates: [], no_event_reason: '测试无事件', warnings: [] };
    await repo.acceptSet(operation.processing_id!, 1, data);
    await repo.acceptSet(operation.processing_id!, 1, data);
    const saved = await repo.processing(operation.processing_id!);
    assert.equal(saved.candidate_count, 0);
    assert.equal(saved.extraction_status, 'completed');
    assert.equal((await repo.operation(parent.id)).slice_status, 'completed');
  } finally { await db.query("UPDATE m1.sources SET state='ACTIVE' WHERE catalog_key='wiki-source-001'"); await db.end(); await rm(folder, { recursive: true, force: true }); }
});
