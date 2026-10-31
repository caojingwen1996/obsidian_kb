import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm, readFile } from 'node:fs/promises';
import { openFixture } from './fixture.js';
import { rebuildIngestionSchema } from '../platform/ingestion-migration.js';
import { IngestionRepository } from '../information-ingestion/processing/current-repository.js';
import { currentIngestionActivities } from '../runtime/current-activities.js';
import { buildServer } from '../runtime/server.js';
import { runCurrentCommand } from '../scripts/current-command.js';
import { transaction } from '../platform/db.js';
import { digest } from '../event-management/contracts.js';
import { eventSnapshot } from '../event-management/snapshot.js';
import { EventDelivery } from '../event-management/delivery.js';
const renderEvent: (snapshot: unknown, deliveries: unknown[], permissions: string[], back: string) => string = (await import(new URL('../web/events.js', import.meta.url).href)).renderEvent;

async function currentFixture() {
  const f = await openFixture();
  await rebuildIngestionSchema(f.db, { workflowFence: 'isolated-entrypoint-test' });
  await f.db.query("INSERT INTO platform.actors VALUES('riskhot-local-operator',ARRAY['read','submit','retry','event_retry','event_submit'],ARRAY['*'])");
  const store = new IngestionRepository(f.repo), key = randomUUID();
  const input = { source_keys: ['wiki-source-001'], limit: 1, url: f.url };
  const accepted = await store.submitMany('riskhot-local-operator', key, input);
  const task = accepted.items[0]!;
  if (!task.accepted || !task.task) throw new Error('FIXTURE_NOT_ACCEPTED');
  await currentIngestionActivities(f.repo, async () => new Response(f.raw, { headers: { 'content-type': 'text/html' } })).ingestCurrent(task.task.id, 1);
  const material = (await f.db.query('SELECT * FROM infomation.ingestion_material')).rows[0];
  return { ...f, store, key, input, task: task.task, material };
}

test('新采集命令按原键复用任务并按资料依据恢复抽取，输出不依赖旧操作身份', async () => {
  const f = await currentFixture();
  let app: Awaited<ReturnType<typeof buildServer>> | undefined;
  try {
    app = await buildServer(f.repo, { mode: 'local', origin: 'http://127.0.0.1:18490' });
    const address = await app.listen({ host: '127.0.0.1', port: 18490 });
    const headers = { origin: 'http://127.0.0.1:18490', 'content-type': 'application/json' };
    const flags = new Map([['--source', 'wiki-source-001'], ['--url', f.url]]);
    assert.equal(await runCurrentCommand(address, headers, flags, f.key), 0);
    assert.equal((await f.db.query('SELECT count(*) AS n FROM infomation.ingestion_tasks')).rows[0].n, '1');
    await f.store.extractionFailed('riskhot-local-operator', { material_id: f.material.id, version: f.material.version, content_digest: f.material.content_digest }, 'MODEL_NOT_CONFIGURED');
    assert.equal(await runCurrentCommand(address, headers, new Map([['--watch', f.task.id], ['--retry', f.material.id], ['--reason', '完成配置后恢复']]), randomUUID()), 0);
    assert.equal((await f.store.material('riskhot-local-operator', f.material.id)).extraction_result?.status, 'pending');
    const output = JSON.parse(await readFile(`.riskhot/runs/${f.task.id}.json`, 'utf8'));
    assert.equal(output.task.id, f.task.id);
    assert.equal(output.materials[0].material_id, f.material.id);
    assert.equal(output.operation, undefined);
  } finally { await app?.close(); await rm(`.riskhot/runs/${f.task.id}.json`, { force: true }); await f.dispose(); }
});

test('schema5正式事件保留详情、下载与交付恢复入口并按来源撤权', async () => {
  const f = await currentFixture();
  let app: Awaited<ReturnType<typeof buildServer>> | undefined;
  try {
    const segment = f.material.content.segments[0];
    const evidence = { material_id: f.material.id, version: f.material.version, content_digest: f.material.content_digest, segment_id: segment.id, start_cp: 0, end_cp: Array.from(segment.text).length, quote: segment.text };
    const payload = { local_key: 'one', title: '受控事件', description: segment.text, subject: '虚构机构', action: '宣布', target_clues: [], event_status: 'announced' as const, event_time: null, evidence_refs: [evidence], missing_fields: [] };
    await f.store.acceptExtraction('riskhot-local-operator', evidence, { candidates: [payload] });
    const event = await transaction(f.db, async tx => {
      const row = (await tx.query("INSERT INTO information.event(title,description,subject,action,event_status) VALUES($1,$2,$3,$4,'announced') RETURNING id", [payload.title, payload.description, payload.subject, payload.action])).rows[0];
      await tx.query("INSERT INTO information.event_fact SELECT $1,fact_id,'initial','受控归属' FROM information.candidate_fact", [row.id]);
      return row.id as string;
    });
    const snapshot = await eventSnapshot(f.db, event);
    const messagePayload = { schema_version: 'riskhot.event-commit.v2', event_id: event, commit_key: randomUUID(), fact_ids: snapshot.facts.map(row => row.id), content: snapshot };
    const message = (await f.db.query("INSERT INTO platform.messages(message_type,event_id,payload,payload_digest) VALUES('event.facts.committed.v2',$1,$2,$3) RETURNING id", [event, messagePayload, digest(messagePayload)])).rows[0].id;
    await f.db.query('INSERT INTO platform.event_message_dependencies(message_id) VALUES($1)', [message]);
    await f.db.query("INSERT INTO platform.message_deliveries(message_id,consumer_id) VALUES($1,'event-audit')", [message]);
    await new EventDelivery(f.repo).reconcile();
    app = await buildServer(f.repo, { mode: 'local', origin: 'http://127.0.0.1:18081' });
    const headers = { host: '127.0.0.1:18081', origin: 'http://127.0.0.1:18081', 'idempotency-key': randomUUID() };
    const list = await app.inject({ url: `/api/v1/l0/events/${event}/deliveries`, headers });
    assert.equal(list.statusCode, 200, list.body);
    assert.equal(list.json().items[0].application_status, 'applied');
    const detail = (await app.inject({ url: `/api/v1/events/${event}`, headers })).json();
    const html = renderEvent(detail, list.json().items, ['event_retry'], '#events');
    for (const label of ['主体', '观测对象', '金融意义', '结果交付与下载']) assert.ok(html.includes(label));
    assert.ok(html.includes(`/m1#material/${f.material.id}`));
    assert.ok(!html.includes('/versions/undefined'));
    const file = await app.inject({ url: `/api/v1/l0/events/${event}/file`, headers });
    assert.equal(file.statusCode, 200);
    assert.equal(file.json().event.id, event);
    for (const name of ['message', 'event', 'receipt']) {
      const response: { statusCode: number; body: string } = await app.inject({ url: `/api/v1/l0/event-deliveries/${message}/files/${name}?consumer_id=event-audit`, headers });
      assert.equal(response.statusCode, 200, response.body);
    }
    const row = list.json().items[0];
    const retried = await app.inject({ method: 'POST', url: `/api/v1/l0/event-deliveries/${message}/files/retry`, headers, payload: { consumer_id: 'event-audit', expected_generation: Number(row.file_generation), reason: '核对文件后恢复' } });
    assert.equal(retried.statusCode, 202, retried.body);
    await f.db.query("UPDATE platform.actors SET source_keys=ARRAY[]::text[] WHERE subject='riskhot-local-operator'");
    assert.equal((await app.inject({ url: `/api/v1/l0/events/${event}/file`, headers })).statusCode, 403);
    assert.equal((await app.inject({ url: `/api/v1/l0/event-deliveries/${message}/files/event`, headers })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: `/api/v1/l0/event-deliveries/${message}/files/retry`, headers, payload: { consumer_id: 'event-audit', expected_generation: Number(row.file_generation), reason: '核对文件后恢复' } })).statusCode, 403);
  } finally { await app?.close(); await f.dispose(); }
});
