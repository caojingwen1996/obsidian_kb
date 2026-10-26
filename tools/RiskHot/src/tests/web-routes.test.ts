import test from 'node:test';
import assert from 'node:assert/strict';
import { openFixture } from './fixture.js';
import { buildServer } from '../runtime/server.js';

test('M1 shell and controller are served with restrictive headers while APIs still require identity', async () => {
  const c = await openFixture(); const app = await buildServer(c.repo);
  try {
    const root = await app.inject('/'); assert.equal(root.statusCode, 302); assert.equal(root.headers.location, '/m1');
    const shell = await app.inject('/m1'); assert.equal(shell.statusCode, 200);
    assert.match(String(shell.headers['content-type']), /text\/html/); assert.match(shell.body, /\/m1\/app.js/);
    assert.match(String(shell.headers['content-security-policy']), /script-src 'self'/);
    assert.equal((await app.inject('/m1/app.js')).statusCode, 200);
    assert.equal((await app.inject('/m1/styles.css')).statusCode, 200);
    assert.equal((await app.inject('/m1/.env')).statusCode, 404);
    assert.equal((await app.inject('/m1/../platform/db.ts')).statusCode, 404);
    assert.equal((await app.inject('/api/v1/session')).statusCode, 401);
  } finally { await app.close(); await c.dispose(); }
});
