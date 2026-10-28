import test from 'node:test';
import assert from 'node:assert/strict';
import { openFixture } from './fixture.js';
import { applyHandoffMigration } from '../platform/handoff-migration.js';
import { parsePbc } from '../information-ingestion/processing/pbc.js';
import { InformationDelivery } from '../information-ingestion/processing/handoff.js';

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

test('legacy inbox identities survive backfill and missing acquisition provenance is not invented',async()=>{
  const c=await openFixture();
  try{
    const p=await c.processing(),delivery=new InformationDelivery(c.repo);
    const before=(await c.db.query('SELECT * FROM platform.inbox WHERE processing_id=$1',[p.id])).rows[0];
    await c.db.query('DELETE FROM information.material_version_origins WHERE version_id=$1',[p.version]);
    await applyHandoffMigration(c.db);
    const origin=(await c.db.query('SELECT * FROM information.material_version_origins WHERE version_id=$1',[p.version])).rows[0];
    assert.equal(origin.basis,'legacy_matching_artifacts');assert.equal(origin.operation_id,p.child);
    assert.deepEqual((await c.db.query('SELECT * FROM platform.inbox WHERE processing_id=$1',[p.id])).rows[0],before);
    await c.db.query('DELETE FROM information.material_version_origins WHERE version_id=$1',[p.version]);
    await c.db.query('UPDATE information.operations SET normalized_artifact_id=NULL WHERE id=$1',[p.child]);
    await applyHandoffMigration(c.db);
    assert.equal((await c.db.query('SELECT * FROM information.material_version_origins WHERE version_id=$1',[p.version])).rowCount,0);
    await assert.rejects(()=>delivery.ensure(p.version),/HANDOFF_PROVENANCE_REQUIRED/);
  }finally{await c.dispose();}
});

test('confirmed source revisions retain an explicit previous version',async()=>{
  const c=await openFixture();
  try{
    const [child]=await c.repo.recordDiscovery(c.parent.id,1,[{url:c.url,title:''}],Buffer.from('list'));
    await c.repo.recordRaw(child!,1,c.raw);const material={...parsePbc(c.raw,c.url),publishedAtText:'2026-10-25'};
    await c.repo.recordNormalized(child!,1,material);const first=await c.repo.saveMaterial(child!,1);
    const parent=await c.repo.submit({source_key:'wiki-source-001',limit:1},'review-operator','new-revision');
    const [next]=await c.repo.recordDiscovery(parent.id,1,[{url:c.url,title:''}],Buffer.from('new list'));
    await c.repo.recordRaw(next!,1,c.raw);await c.repo.recordNormalized(next!,1,{...material,publishedAtText:'2026-10-26'});
    const second=await c.repo.saveMaterial(next!,1);
    const origin=(await c.db.query('SELECT * FROM information.material_version_origins WHERE version_id=$1',[second])).rows[0];
    assert.equal(origin.previous_version_id,first);assert.equal(origin.version_kind,'source_revision');
  }finally{await c.dispose();}
});

test('legacy backfill excludes a later acquisition even when its operation was created first',async()=>{
  const c=await openFixture();
  try{
    const [a]=await c.repo.recordDiscovery(c.parent.id,1,[{url:c.url,title:''}],Buffer.from('A'));
    await c.db.query('INSERT INTO m1.source_versions(source_id,version,config) SELECT source_id,2,config FROM m1.source_versions WHERE source_id=$1 AND version=1',[c.parent.source_id]);
    await c.db.query('UPDATE m1.sources SET version=2 WHERE id=$1',[c.parent.source_id]);
    const bParent=await c.repo.submit({source_key:'wiki-source-001',limit:1},'review-operator','B');
    const [b]=await c.repo.recordDiscovery(bParent.id,1,[{url:c.url,title:''}],Buffer.from('B'));
    const material=parsePbc(c.raw,c.url);
    await c.repo.recordRaw(b!,1,c.raw);await c.repo.recordNormalized(b!,1,material);const v=await c.repo.saveMaterial(b!,1);
    await c.repo.recordRaw(a!,1,c.raw);await c.repo.recordNormalized(a!,1,material);assert.equal(await c.repo.saveMaterial(a!,1),v);
    await c.db.query('DELETE FROM information.material_version_origins WHERE version_id=$1',[v]);await applyHandoffMigration(c.db);
    const restored=(await c.db.query('SELECT * FROM information.material_version_origins WHERE version_id=$1',[v])).rows[0];
    assert.equal(restored.operation_id,b);assert.equal(restored.source_version,2);
    await c.db.query('DELETE FROM information.material_version_origins WHERE version_id=$1',[v]);
    await c.db.query('UPDATE information.operations SET normalized_artifact_id=NULL WHERE id=$1',[b]);await applyHandoffMigration(c.db);
    assert.equal((await c.db.query('SELECT * FROM information.material_version_origins WHERE version_id=$1',[v])).rowCount,0,'a later matching recapture cannot replace missing original provenance');
  }finally{await c.dispose();}
});

test('ambiguous legacy acquisitions before a save are left unresolved',async()=>{
  const c=await openFixture();
  try{
    const [a]=await c.repo.recordDiscovery(c.parent.id,1,[{url:c.url,title:''}],Buffer.from('A'));
    const material=parsePbc(c.raw,c.url);await c.repo.recordRaw(a!,1,c.raw);await c.repo.recordNormalized(a!,1,material);
    const parent=await c.repo.submit({source_key:'wiki-source-001',limit:1},'review-operator','B');
    const [b]=await c.repo.recordDiscovery(parent.id,1,[{url:c.url,title:''}],Buffer.from('B'));
    await c.repo.recordRaw(b!,1,c.raw);await c.repo.recordNormalized(b!,1,material);const v=await c.repo.saveMaterial(b!,1);await c.repo.saveMaterial(a!,1);
    await c.db.query('DELETE FROM information.material_version_origins WHERE version_id=$1',[v]);await applyHandoffMigration(c.db);
    assert.equal((await c.db.query('SELECT * FROM information.material_version_origins WHERE version_id=$1',[v])).rowCount,0);
  }finally{await c.dispose();}
});

test('资料迁移重跑跳过事件消息，不为无资料版本的消息建立交付',async()=>{
 const {eventFixture,preparedCandidate}=await import('./event-fixture.js');const f=await eventFixture();try{
  await f.service.acceptExtraction(f.full.id,1,{candidates:[f.candidate],warnings:[]});const c=await preparedCandidate(f);await c.commit.commitCandidate(c.id,c.generation,c.key);
  const before=(await f.db.query('SELECT version_id,message_id FROM information.material_deliveries ORDER BY version_id')).rows;
  await applyHandoffMigration(f.db);await applyHandoffMigration(f.db);
  assert.deepEqual((await f.db.query('SELECT version_id,message_id FROM information.material_deliveries ORDER BY version_id')).rows,before);
 }finally{await f.dispose();}
});
