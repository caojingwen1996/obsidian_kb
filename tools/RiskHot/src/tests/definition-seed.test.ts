import test from 'node:test';
import assert from 'node:assert/strict';
import { openFixture } from './fixture.js';
import { rebuildIngestionSchema } from '../platform/ingestion-migration.js';
import { seedLocalDefinitions } from '../event-management/definition-seed.js';
import { readDefinitions } from '../event-management/definitions.js';

test('重建后登记明确本地定义范围，重复初始化保留其他定义且不覆盖冲突', async () => {
  const fixture = await openFixture();
  try {
    await rebuildIngestionSchema(fixture.db, { workflowFence: 'isolated-definition-test' });
    await seedLocalDefinitions(fixture.db);
    const definition = await readDefinitions(fixture.repo, 'riskhot-local-formal-inventory-20261027-v1');
    assert.match(definition.owner, /本地正式定义登记范围.*外部M2尚未接入/);
    assert.deepEqual(definition.targets, []);
    await fixture.db.query("INSERT INTO information.definition_sets SELECT 'other',owner,version,coverage_status,payload,digest FROM information.definition_sets LIMIT 1");
    await seedLocalDefinitions(fixture.db);
    assert.equal((await fixture.db.query('SELECT count(*) AS n FROM information.definition_sets')).rows[0].n, '2');
    await fixture.db.query("UPDATE information.definition_sets SET digest='conflict' WHERE ref=$1", [definition.ref]);
    await assert.rejects(() => seedLocalDefinitions(fixture.db), /DEFINITION_SEED_CONFLICT/);
    assert.equal((await fixture.db.query('SELECT digest FROM information.definition_sets WHERE ref=$1', [definition.ref])).rows[0].digest, 'conflict');
  } finally { await fixture.dispose(); }
});
