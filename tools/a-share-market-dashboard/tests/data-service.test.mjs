import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMemoryStorage,
  loadDomain,
  refreshDomains,
  createExampleSnapshot,
} from '../src/data-service.mjs';

test('a successful provider stores source and timestamps', async () => {
  const storage = createMemoryStorage();
  const result = await loadDomain({
    id: 'position',
    providers: [{ name: 'primary', load: async () => ({ ok: true }) }],
    validate: data => data.ok === true,
    storage,
    now: () => 1000,
    maxAgeMs: 500,
  });
  assert.equal(result.status, 'latest');
  assert.equal(result.source, 'primary');
  assert.equal(result.fetchedAt, 1000);
  assert.deepEqual(JSON.parse(storage.getItem('a-share-dashboard:position')).data, { ok: true });
});

test('provider failure returns a non-expired snapshot', async () => {
  const storage = createMemoryStorage({
    'a-share-dashboard:position': JSON.stringify({ data: { cached: true }, source: 'old', savedAt: 900, dataAt: 900 }),
  });
  const result = await loadDomain({
    id: 'position',
    providers: [{ name: 'primary', load: async () => { throw new Error('offline'); } }],
    storage,
    now: () => 1000,
    maxAgeMs: 500,
  });
  assert.equal(result.status, 'snapshot');
  assert.deepEqual(result.data, { cached: true });
  assert.match(result.errors[0], /primary: offline/);
});

test('an expired snapshot is marked expired instead of current', async () => {
  const storage = createMemoryStorage({
    'a-share-dashboard:position': JSON.stringify({ data: {}, source: 'old', savedAt: 1, dataAt: 1 }),
  });
  const result = await loadDomain({
    id: 'position',
    providers: [],
    storage,
    now: () => 1000,
    maxAgeMs: 500,
  });
  assert.equal(result.status, 'expired');
});

test('invalid provider data does not overwrite a valid cache', async () => {
  const storage = createMemoryStorage({
    'a-share-dashboard:position': JSON.stringify({ data: { cached: true }, source: 'old', savedAt: 900, dataAt: 900 }),
  });
  const result = await loadDomain({
    id: 'position',
    providers: [{ name: 'bad', load: async () => ({ ok: false }) }],
    validate: data => data.ok === true,
    storage,
    now: () => 1000,
    maxAgeMs: 500,
  });
  assert.equal(result.status, 'snapshot');
  assert.deepEqual(result.data, { cached: true });
  assert.match(result.errors[0], /validation failed/);
});

test('refreshDomains isolates a failed domain from successful peers', async () => {
  const storage = createMemoryStorage();
  const result = await refreshDomains([
    { id: 'good', providers: [{ name: 'good-source', load: async () => [1] }], validate: Array.isArray, maxAgeMs: 100 },
    { id: 'bad', providers: [{ name: 'bad-source', load: async () => { throw new Error('down'); } }], maxAgeMs: 100 },
  ], { storage, now: () => 1000 });
  assert.equal(result.good.status, 'latest');
  assert.equal(result.bad.status, 'missing');
});

test('example snapshot is deterministic, long enough for ten years, and explicitly marked', () => {
  const first = createExampleSnapshot();
  const second = createExampleSnapshot();
  assert.equal(first.mode, 'example');
  assert.equal(first.domains.shanghaiHistory.data.length, 2750);
  assert.equal(first.domains.csi300History.data.length, 2750);
  assert.equal(first.domains.csiAllHistory.data.length, 2750);
  assert.deepEqual(first, second);
});
