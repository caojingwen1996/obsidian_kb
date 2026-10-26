import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { openSync, closeSync } from 'node:fs';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { Pool } from 'pg';
import Long from 'long';
import { Connection } from '@temporalio/client';
import { ExecutionStore } from '../l0/execution.js';
import { ArtifactStore } from '../platform/artifacts.js';
import { parsePbc } from '../l0/pbc.js';
import { grantRuntimeRoles } from '../platform/grants.js';
import { runtimeEnvironment, type RuntimeRole } from '../runtime/environment.js';

async function until(check: () => Promise<boolean>, milliseconds: number) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) { if (await check()) return; await setTimeout(200); }
  throw new Error('Condition deadline exceeded');
}

test('real Temporal resumes a durable retry after worker restart and saves a multi-candidate set once', { timeout: 120_000 }, async () => {
  const admin = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const name = `riskhot_wf_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const dbUrl = new URL(process.env.ADMIN_DATABASE_URL!); dbUrl.pathname = `/${name}`;
  const db = new Pool({ connectionString: dbUrl.href });
  const folder = await mkdtemp(join(tmpdir(), 'riskhot-temporal-'));
  const connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS });
  const namespace = `riskhot-test-${randomUUID()}`;
  await connection.workflowService.registerNamespace({ namespace, workflowExecutionRetentionPeriod: { seconds: Long.fromNumber(86_400) } });
  let requests = 0;
  const server = createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    requests++;
    if (requests === 1) { response.writeHead(503); response.end('{"error":"controlled temporary failure"}'); return; }
    const input = JSON.parse(JSON.parse(body).messages[1].content);
    const segments: { id: string; text: string }[] = input.material.segments;
    const candidates = segments.map((segment, index) => ({ title: `虚构行动${index + 1}`, description: segment.text, subject_name: '虚构机构', action: '宣布措施', stage: '宣布', time: null, uncertainties: [], evidence: [{ segment_id: segment.id, quote: segment.text, start_cp: null, end_cp: null }] }));
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ candidates, covered_segment_ids: segments.map(x => x.id), no_event_reason: null, warnings: [] }) } }] }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const children: ChildProcess[] = [];
  const roleUrl = (key: string) => { const url = new URL(process.env[key]!); url.pathname = dbUrl.pathname; return url.href; };
  const environment = { ...process.env, DATABASE_URL: roleUrl('DATABASE_URL'), IO_DATABASE_URL: roleUrl('IO_DATABASE_URL'), MODEL_DATABASE_URL: roleUrl('MODEL_DATABASE_URL'), RELAY_DATABASE_URL: roleUrl('RELAY_DATABASE_URL'), ARTIFACT_ROOT: join(folder, 'artifacts'), TEMPORAL_NAMESPACE: namespace, MODEL_PROTOCOL: 'openai-chat', MODEL_ENDPOINT: `http://127.0.0.1:${address.port}`, MODEL_NAME: 'controlled-test-model', MODEL_API_KEY: 'controlled-local-only-key' };
  const start = (file: string, role?: string) => {
    const output = openSync(join(folder, `${role ?? 'relay'}.log`), 'a');
    const child = spawn(process.execPath, ['--import', 'tsx', file, ...(role ? [role] : [])], { env: runtimeEnvironment((role || 'relay') as RuntimeRole, environment), stdio: ['ignore', output, output] });
    closeSync(output); children.push(child); return child;
  };
  try {
    await db.query(await readFile('src/db/001-init.sql', 'utf8'));
    await grantRuntimeRoles(db);
    const repo = new ExecutionStore(db, new ArtifactStore(environment.ARTIFACT_ROOT));
    await repo.seedCatalog([{ id: 'wiki-source-001', name: '中国人民银行', url: 'https://www.pbc.gov.cn/', tier: 'T1', group: '虚构测试', focus: '虚构测试', context: '虚构测试' }]);
    await db.query("INSERT INTO platform.actors VALUES('workflow-test',ARRAY['submit','read','retry','model_budget'],ARRAY['wiki-source-001'])");
    const parent = await repo.submit({ source_key: 'wiki-source-001', limit: 1 }, 'workflow-test', 'durable-test');
    const url = 'https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/9999999999999999/index.html';
    const [child] = await repo.recordDiscovery(parent.id, 1, [{ url, title: '虚构测试' }], Buffer.from('controlled test listing'));
    assert.ok(child);
    const raw = Buffer.from('<meta name="ArticleTitle" content="虚构测试"><div id="zoom"><p>虚构机构甲宣布利率下调。</p><p>虚构机构乙宣布准备金调整。</p></div>');
    await repo.recordRaw(child, 1, raw); await repo.recordNormalized(child, 1, parsePbc(raw, url)); await repo.saveMaterial(child, 1);
    await db.query("UPDATE platform.execution_intents SET state='started' WHERE kind IN ('discovery','material')");
    let workflow = start('src/runtime/worker.ts', 'workflow');
    start('src/runtime/worker.ts', 'io'); start('src/runtime/worker.ts', 'model'); start('src/runtime/relay.ts');
    await until(async () => (await db.query("SELECT 1 FROM information.processing_runs WHERE error_code='MODEL_HTTP_503'")).rowCount === 1, 40_000);
    const processing = (await db.query('SELECT * FROM information.processing_runs')).rows[0];
    assert.equal(processing.candidate_count, null);
    workflow.kill('SIGKILL'); await once(workflow, 'exit');
    workflow = start('src/runtime/worker.ts', 'workflow');
    await until(async () => (await repo.processing(processing.id)).extraction_status === 'completed', 65_000);
    assert.equal((await repo.processing(processing.id)).candidate_count, 2);
    assert.equal((await repo.processing(processing.id)).result_status, 'pending');
    assert.equal((await repo.candidates(processing.id)).length, 2);
    assert.equal(requests, 2);
    assert.equal((await repo.operation(parent.id)).slice_status, 'completed');
    await repo.acceptSet(processing.id, 1, { covered_segment_ids: [], candidates: [], no_event_reason: 'late result', warnings: [] });
    assert.equal((await repo.candidates(processing.id)).length, 2);
  } catch (error) {
    for (const role of ['workflow', 'io', 'model', 'relay']) {
      const log = await readFile(join(folder, `${role}.log`), 'utf8').catch(() => '');
      console.error(`${role} diagnostic tail: ${log.slice(-2500)}`);
    }
    throw error;
  } finally {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await Promise.all(children.map(async child => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      await Promise.race([once(child, 'exit'), setTimeout(5000)]);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }));
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    await connection.close(); await db.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`); await admin.end();
    await rm(folder, { recursive: true, force: true });
  }
});
