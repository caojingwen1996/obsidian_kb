import test from 'node:test';
import assert from 'node:assert/strict';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { savedFixture } from './handoff-fixture.js';
import { parsePbc } from '../information-ingestion/processing/pbc.js';
import { InformationDelivery } from '../information-ingestion/processing/handoff.js';

test('concurrent repeated deliveries reuse receipt, processing and workflow identity', async () => {
  const c = await savedFixture();
  try {
    const receipts = await Promise.all(Array.from({length:3},()=>c.delivery.accept(c.message)));
    assert.equal(new Set(receipts.map(x=>x.processing_id)).size,1);
    assert.deepEqual(receipts[0],receipts[1]);
    assert.equal((await c.db.query('SELECT * FROM platform.inbox')).rowCount,1);
    assert.equal((await c.db.query("SELECT * FROM platform.execution_intents WHERE kind='extract'")).rowCount,1);
    const packet = await c.delivery.readAccepted(receipts[0]!.processing_id);
    assert.deepEqual(packet.material,c.material); assert.equal(packet.information.version_id,c.version);
    assert.equal((await c.repo.processing(receipts[0]!.processing_id)).candidate_count,null);
  } finally { await c.dispose(); }
});

test('unreadable source bytes and mismatched input never create a receipt or extraction intent', async () => {
  const c = await savedFixture();
  try {
    const raw = (await c.db.query('SELECT a.sha256 FROM information.material_versions v JOIN platform.artifact_objects a ON a.id=v.raw_artifact_id WHERE v.id=$1',[c.version])).rows[0].sha256;
    await unlink(join(c.folder,raw.slice(0,2),raw));
    await assert.rejects(()=>c.delivery.accept(c.message),/ARTIFACT_UNAVAILABLE/);
    assert.equal((await c.db.query('SELECT * FROM platform.inbox')).rowCount,0);
    assert.equal((await c.db.query('SELECT * FROM information.processing_runs')).rowCount,0);
  } finally { await c.dispose(); }
});

test('delivery recovery has its own generation and budget, checks current source and keeps message identity', async () => {
  const c = await savedFixture();
  try {
    await c.db.query("UPDATE m1.sources SET state='DISABLED'");
    await assert.rejects(()=>c.delivery.accept(c.message),/SOURCE_DISABLED/);
    await c.db.query("UPDATE m1.sources SET state='ACTIVE'");
    await c.db.query('UPDATE information.material_deliveries SET attempts=10,error_code=\'TEST_FAILURE\'');
    await c.db.query("UPDATE platform.messages SET state='blocked'");
    const recovered = await c.delivery.retry(c.message,'review-operator',{expected_generation:1,reason:'恢复原交付'},'recovery-1');
    assert.equal(recovered.generation,2);assert.equal(recovered.delivery_id,c.message);
    await assert.rejects(()=>c.delivery.retry(c.message,'review-operator',{expected_generation:1,reason:'old'},'recovery-2'),/STALE_DELIVERY/);
    assert.equal((await c.db.query('SELECT * FROM platform.model_budget_windows')).rowCount,0);
    await c.delivery.accept(c.message);
    assert.equal((await c.delivery.retry(c.message,'review-operator',{expected_generation:1,reason:'receipt'},'recovery-3')).status,'received');
  } finally { await c.dispose(); }
});
