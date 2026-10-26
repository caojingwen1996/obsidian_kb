import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { openFixture } from './fixture.js';
import { ExecutionStore } from '../information-ingestion/processing/execution.js';
import { buildServer } from '../runtime/server.js';

test('local workbench reads and manages sources without credentials and keeps a stable audit actor', async () => {
  const c = await openFixture();
  await c.db.query("INSERT INTO platform.actors VALUES('riskhot-local-operator',ARRAY['read','submit','source_admin','retry','model_budget','model_review'],ARRAY['*'])");
  const db = new Pool({ connectionString: c.urlFor('DATABASE_URL') });
  const app = await buildServer(new ExecutionStore(db, c.artifacts), { mode: 'local', origin: 'http://localhost:18081' });
  const headers = { host: 'localhost:18081', origin: 'http://localhost:18081', 'idempotency-key': randomUUID() };
  try {
    const session = await app.inject({ url: '/api/v1/session', headers: { host: headers.host } });
    assert.equal(session.statusCode, 200, session.body);
    assert.equal(session.json().actor, 'riskhot-local-operator'); assert.equal(session.json().authentication, 'local');
    const created = await app.inject({ method: 'POST', url: '/api/v1/m1/sources', headers, payload: { profile: { name: '免登录受控来源', url: '' } } });
    assert.equal(created.statusCode, 201, created.body);
    const replay = await app.inject({ method: 'POST', url: '/api/v1/m1/sources', headers, payload: { profile: { name: '免登录受控来源', url: '' } } });
    assert.equal(replay.json().catalog_key, created.json().catalog_key);
    const history = await app.inject({ url: `/api/v1/m1/sources/${created.json().catalog_key}/history`, headers });
    assert.ok(history.json().audit.some((row: { actor: string }) => row.actor === 'riskhot-local-operator'));
    assert.equal((await app.inject({ url: '/api/v1/session', headers: { host: headers.host, cookie: 'riskhot_session=expired' } })).statusCode, 200);
    assert.equal((await app.inject({ url: '/auth/login', headers })).headers.location, '/m1');
    assert.equal((await app.inject({ url: '/auth/callback?state=obsolete', headers })).headers.location, '/m1');
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/m1/sources', headers: { ...headers, origin: 'https://other.test' }, payload: { profile: { name: '拒绝跨站', url: '' } } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/m1/sources', headers: { host: headers.host }, payload: { profile: { name: '拒绝无来源写入', url: '' } } })).statusCode, 403);
    assert.equal((await app.inject({ url: '/api/v1/session', headers: { host: 'other.test:18081' } })).statusCode, 403);
    assert.equal((await app.inject({ url: '/api/v1/session', headers, remoteAddress: '192.0.2.1' })).statusCode, 403);
  } finally { await app.close(); await db.end(); await c.dispose(); }
});

test('local mode starts without the identity service or OIDC configuration', async () => {
  const c = await openFixture(); const old = process.env.OIDC_ISSUER;
  try {
    delete process.env.OIDC_ISSUER;
    const app = await buildServer(c.repo, { mode: 'local', origin: 'http://localhost:18081' });
    try { assert.equal((await app.inject('/m1')).statusCode, 200); } finally { await app.close(); }
  } finally { process.env.OIDC_ISSUER = old; await c.dispose(); }
});
