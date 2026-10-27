import test from 'node:test';
import assert from 'node:assert/strict';
import { openFixture } from './fixture.js';
import { applyHandoffMigration } from '../platform/handoff-migration.js';
import { parsePbc } from '../information-ingestion/processing/pbc.js';

test('handoff migration is repeatable and preserves existing runtime identities and source states', async () => {
  const c = await openFixture();
  try {
    const before = await c.db.query('SELECT id,state,version FROM m1.sources ORDER BY id');
    await applyHandoffMigration(c.db); await applyHandoffMigration(c.db);
    assert.deepEqual((await c.db.query('SELECT id,state,version FROM m1.sources ORDER BY id')).rows, before.rows);
    assert.equal((await c.db.query('SELECT version FROM platform.schema_versions WHERE version=2')).rowCount, 1);
  } finally { await c.dispose(); }
});

test('freezes original acquisition and config when a later operation reuses a saved version', async () => {
  const c = await openFixture();
  try {
    const [child] = await c.repo.recordDiscovery(c.parent.id, 1, [{ url: c.url, title: 'test' }], Buffer.from('listing'));
    await c.repo.recordRaw(child!, 1, c.raw); const material = parsePbc(c.raw, c.url);
    await c.repo.recordNormalized(child!, 1, material); const v = await c.repo.saveMaterial(child!, 1);
    const origin = (await c.db.query('SELECT * FROM information.material_version_origins WHERE version_id=$1', [v])).rows[0];
    assert.equal(origin.operation_id, child); assert.equal(origin.source_version, 1);
    assert.equal(origin.collected_at.getTime(), (await c.db.query('SELECT acquired_at FROM information.acquisitions WHERE id=$1', [origin.acquisition_id])).rows[0].acquired_at.getTime());
    await c.db.query('INSERT INTO m1.source_versions(source_id,version,config) SELECT source_id,2,config FROM m1.source_versions WHERE source_id=$1 AND version=1', [origin.source_id]);
    await c.db.query('UPDATE m1.sources SET version=2 WHERE id=$1', [origin.source_id]);
    const parent = await c.repo.submit({ source_key: 'wiki-source-001', limit: 1 }, 'review-operator', 'second-config');
    const [again] = await c.repo.recordDiscovery(parent.id, 1, [{ url: c.url, title: '' }], Buffer.from('listing2'));
    await c.repo.recordRaw(again!, 1, c.raw); await c.repo.recordNormalized(again!, 1, material);
    assert.equal(await c.repo.saveMaterial(again!, 1), v);
    assert.deepEqual((await c.db.query('SELECT * FROM information.material_version_origins WHERE version_id=$1', [v])).rows[0], origin);
    assert.equal((await c.db.query('SELECT * FROM information.material_deliveries WHERE version_id=$1', [v])).rowCount, 1);
  } finally { await c.dispose(); }
});
