import test from 'node:test';
import assert from 'node:assert/strict';
import { openFixture } from './fixture.js';
import { buildServer } from '../runtime/server.js';
import Fastify from 'fastify';
import { registerWeb } from '../runtime/web.js';
import { readFile } from 'node:fs/promises';

test('pipeline serves only explicit assets and source documents with the existing CSP', async () => {
  const app = Fastify(); registerWeb(app);
  try {
    const shell = await app.inject('/pipeline');
    assert.equal(shell.statusCode, 200); assert.match(shell.body, /nav-config/);
    assert.match(String(shell.headers['content-security-policy']), /script-src 'self'; style-src 'self'/);
    for (const asset of ['pipeline.js', 'pipeline-state.js', 'pipeline-view.js', 'pipeline-layout.js', 'pipeline-data.js', 'pipeline-tasks.js', 'pipeline.css', 'pipeline-document.css']) {
      const response = await app.inject('/pipeline/' + asset);
      assert.equal(response.statusCode, 200, asset);
      assert.match(String(response.headers['content-type']), asset.endsWith('.css') ? /text\/css/ : /text\/javascript/);
    }
    const documents = JSON.parse(await readFile('src/data/pipeline-documents.json', 'utf8'));
    for (const key of Object.keys(documents)) {
      const document = await app.inject('/pipeline/documents/' + key);
      assert.equal(document.statusCode, 200); assert.match(document.body, /当前来源原文/);
      assert.doesNotMatch(document.body, /<script[\s>]/i);
    }
    for (const path of ['/pipeline/.env', '/pipeline/constructor', '/pipeline/pipeline-documents.json', '/pipeline/documents/constructor', '/pipeline/documents/0000000000000000', '/pipeline/documents/%2e%2e%2f.env']) {
      assert.equal((await app.inject(path)).statusCode, 404, path);
    }
    assert.equal((await app.inject('/pipeline/')).headers.location, '/pipeline');
  } finally { await app.close(); }
});

test('M1 shell and controller are served with restrictive headers while APIs still require identity', async () => {
  const c = await openFixture(); const app = await buildServer(c.repo, { mode: 'oidc' });
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
