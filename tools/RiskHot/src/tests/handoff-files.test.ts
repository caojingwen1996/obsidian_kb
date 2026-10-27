import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { ArtifactStore } from '../platform/artifacts.js';
import { HandoffFiles } from '../platform/handoff-files.js';
import { validateInformationHandoff, jsonBytes } from '../information-ingestion/processing/handoff-contract.js';

test('JSONB round trips preserve identical immutable receipt bytes despite object key ordering',()=>{
  assert.deepEqual(jsonBytes({status:'received',payload:{z:1,a:2}}),jsonBytes({payload:{a:2,z:1},status:'received'}));
});

test('rejects unknown handoff schemas and invalid identities before reading content', () => {
  assert.throws(() => validateInformationHandoff({ schema_version: 'unknown' }), /HANDOFF_SCHEMA_INVALID/);
  assert.throws(() => validateInformationHandoff({ schema_version: 'riskhot.information-handoff.v1', delivery_id: '../outside' }), /HANDOFF_SCHEMA_INVALID/);
});

test('publishes private complete files idempotently, repairs missing aliases and refuses overwrites', async () => {
  const root = await mkdtemp(join(tmpdir(), 'handoff-files-'));
  try {
    const store = new ArtifactStore(root), files = new HandoffFiles(store), id = randomUUID();
    const bytes = Buffer.from('{"delivered":true}\n'), ref = await store.put(bytes, 'handoff');
    const name = await files.publish(id, 'information', ref);
    assert.deepEqual(await readFile(join(root, name)), bytes);
    assert.equal((await stat(join(root, name))).mode & 0o077, 0);
    assert.equal(await files.publish(id, 'information', ref), name);
    await unlink(join(root, name));
    await files.publish(id, 'information', ref);
    await assert.rejects(() => files.publish(id, 'information', { ...ref, size: ref.size + 1 }), /HANDOFF_SIZE_MISMATCH/);
    const different = await store.put(Buffer.from('{}\n'), 'handoff');
    await assert.rejects(() => files.publish(id, 'information', different), /HANDOFF_FILE_CONFLICT/);
    await assert.rejects(() => files.publish('../outside', 'information', ref), /HANDOFF_PATH_INVALID/);
    await assert.rejects(() => files.publish(id, 'candidates', ref), /HANDOFF_PATH_INVALID/);
    await assert.rejects(() => files.publish(id, 'information', { ...ref, sha256: 'a'.repeat(64) }), /ARTIFACT_UNAVAILABLE/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
