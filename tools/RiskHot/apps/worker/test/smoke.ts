import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createPool, defaultDatabaseUrl, transaction } from '../../../packages/platform/database/index.js';
import { connectTemporal } from '../../../packages/platform/workflow/client.js';
import { taskWorkflowId, temporalScheduleId } from '../../../packages/platform/workflow/contracts.js';
import type { Data, RecordRow } from '../../../packages/platform/core/types.js';
import { migrate } from '../../../tooling/migrate.js';
import { createWorker } from '../src/main.js';
import { runRelayOnce } from '../../outbox-relay/src/relay.js';

async function until<T>(read: () => Promise<T>, accepts: (value: T) => boolean, label: string): Promise<T> {
  const deadline = Date.now() + 30_000;
  do {
    const value = await read();
    if (accepts(value)) return value;
    await setTimeout(100);
  } while (Date.now() < deadline);
  throw new Error(`Timed out: ${label}`);
}

export async function smoke() {
  const name = `riskhot_temporal_smoke_${randomUUID().replaceAll('-', '')}`;
  const base = process.env.DATABASE_URL || defaultDatabaseUrl;
  const checked = new URL(base);
  assert.ok(
    ['127.0.0.1', 'localhost'].includes(checked.hostname),
    'Smoke tests only run against local PostgreSQL',
  );
  const admin = createPool(base);
  const url = new URL(base);
  url.pathname = '/' + name;
  await admin.query(`CREATE DATABASE "${name}"`);
  const pool = createPool(url.toString());
  const { client, connection } = await connectTemporal();
  const queue = 'riskhot-smoke-' + name;
  const originalProvider = process.env.MODEL_PROVIDER,
    originalModel = process.env.MODEL_ID;
  let running: Awaited<ReturnType<typeof createWorker>> | undefined;
  let runPromise: Promise<void> | undefined;
  let scheduleId: string | undefined;
  async function startWorker() {
    running = await createWorker(
      pool,
      {
        async generate() {
          return {
            provider: 'openai',
            model: 'smoke-test-adapter',
            output: { summary: 'test fixture only', source_refs: [] },
            usage: { test: true },
            request_id: 'test-request',
          };
        },
      },
      queue,
    );
    runPromise = running.worker.run();
  }
  async function stopWorker() {
    if (running) {
      running.worker.shutdown();
      await runPromise;
      await running.connection.close();
      running = undefined;
    }
  }
  async function drain() {
    for (let count = 0; count < 20 && (await runRelayOnce(pool, client, queue)); count += 1) {
      /* bounded drain */
    }
  }
  const getTask = (id: string) => transaction(pool, (db) => db.get('operations', id));
  async function task(type: string, provider = 'manual') {
    return transaction(pool, async (db) => {
      const row = await db.create(
        'operations',
        'task',
        {
          type,
          input: { smoke: true },
          owner_id: 'smoke',
          generation: 1,
          commit_eligible: true,
          attempts: 0,
          stage: 'accepted',
          progress: 0,
          model_provider: provider,
          model_id: provider === 'manual' ? null : 'smoke-test-adapter',
        },
        'queued',
      );
      await db.emit('task.start', row.id, { task_id: row.id, generation: 1 });
      return row;
    });
  }
  async function cancel(row: RecordRow) {
    await transaction(pool, async (db) => {
      const current = await db.get('operations', row.id, true);
      await db.update(
        'operations',
        row.id,
        current.version,
        { ...current.data, generation: Number(current.data.generation) + 1, commit_eligible: false },
        'cancelled',
      );
      await db.emit('task.cancel', row.id, { task_id: row.id });
    });
    await drain();
    const result = (await client.workflow
      .getHandle(taskWorkflowId(row.id, Number(row.data.attempts || 0)))
      .result()) as { status: string };
    assert.equal(result.status, 'cancelled');
  }
  try {
    await migrate(url.toString());
    await startWorker();
    const manual = await task('extract');
    await transaction(pool, (db) => db.emit('task.start', manual.id, { task_id: manual.id, generation: 1 }));
    await drain();
    await until(
      () => getTask(manual.id),
      (row) => row.status === 'awaiting_input',
      'manual task awaiting input',
    );
    assert.equal((await getTask(manual.id)).data.proposal, undefined);
    const before = await client.workflow.getHandle(taskWorkflowId(manual.id, 0)).describe();
    assert.equal(before.status.name, 'RUNNING');
    const dispatchCount = await pool.query(
      "SELECT count(*)::int AS n FROM operations.records WHERE kind='workflow_dispatch' AND data->>'task_id'=$1",
      [manual.id],
    );
    assert.equal(dispatchCount.rows[0].n, 1);
    await stopWorker();
    await startWorker();
    assert.equal((await getTask(manual.id)).status, 'awaiting_input');
    await cancel(manual);
    assert.equal((await getTask(manual.id)).data.commit_eligible, false);
    console.log('PASS real workflow: manual wait, duplicate start, worker restart, PG-gated cancellation');

    process.env.MODEL_PROVIDER = 'openai';
    process.env.MODEL_ID = 'smoke-test-adapter';
    const generated = await task('identify', 'openai');
    await drain();
    const proposed = await until(
      () => getTask(generated.id),
      (row) => row.status === 'awaiting_review',
      'structured proposal',
    );
    assert.equal((proposed.data.proposal as Data).summary, 'test fixture only');
    assert.equal((proposed.data.model_result as Data).request_id, 'test-request');
    await transaction(pool, async (db) => {
      const current = await db.get('operations', generated.id, true);
      await db.update(
        'operations',
        current.id,
        current.version,
        { ...current.data, stage: 'completed', progress: 100, commit_eligible: false },
        'completed',
      );
      await db.emit('task.completed', current.id, { task_id: current.id });
      await db.emit('task.completed', current.id, { task_id: current.id });
    });
    await drain();
    assert.equal(
      ((await client.workflow.getHandle(taskWorkflowId(generated.id, 0)).result()) as { status: string })
        .status,
      'completed',
    );
    console.log(
      'PASS real workflow with injected model test adapter: proposal metadata and duplicate domain-completed signals',
    );

    const analysis = await task('analysis');
    await drain();
    await until(
      () => getTask(analysis.id),
      (row) => row.status === 'awaiting_input',
      'analysis manual wait',
    );
    await transaction(pool, async (db) => {
      const snapshot = await db.create(
        'analysis',
        'snapshot',
        { task_id: analysis.id, task_generation: 1 },
        'approved',
      );
      await db.emit('analysis.approved', snapshot.id, { snapshot_id: snapshot.id, task_id: analysis.id });
      await db.emit('analysis.approved', snapshot.id, { snapshot_id: snapshot.id, task_id: analysis.id });
    });
    await drain();
    assert.equal(
      ((await client.workflow.getHandle(taskWorkflowId(analysis.id, 0)).result()) as { status: string })
        .status,
      'completed',
    );
    assert.equal((await getTask(analysis.id)).data.commit_eligible, false);
    console.log('PASS approved snapshot reconciliation: database qualification and idempotent completion');

    const plan = await transaction(pool, async (db) => {
      const owner = await db.create(
        'identity',
        'user',
        {
          name: 'Temporal smoke test',
          username: 'smoke',
          roles: ['admin', 'researcher', 'reviewer'],
          evidence_access: true,
        },
        'active',
      );
      const row = await db.create(
        'operations',
        'schedule',
        {
          name: 'Smoke plan',
          type: 'report',
          timezone: 'Asia/Shanghai',
          interval_minutes: 60,
          next_at: new Date(Date.now() + 3_600_000).toISOString(),
          input: { type: 'daily' },
          owner_id: owner.id,
        },
        'enabled',
      );
      await db.emit('schedule.changed', row.id, { schedule_id: row.id, version: row.version, enabled: true });
      return row;
    });
    scheduleId = temporalScheduleId(plan.id);
    await drain();
    const handle = client.schedule.getHandle(scheduleId);
    assert.equal((await handle.describe()).state.paused, false);
    await handle.trigger('SKIP');
    const scheduled = await until(
      async () =>
        (await transaction(pool, (db) => db.list('operations', 'task'))).find(
          (row) => (row.data.input as Data).schedule_id === plan.id,
        ),
      (row) => row?.status === 'completed',
      'schedule produces a report draft',
    );
    const reports = await transaction(pool, (db) => db.list('publication', 'report'));
    assert.equal(reports.length, 1);
    assert.equal(reports[0]!.status, 'draft');
    assert.equal(scheduled!.data.result_id, reports[0]!.id);
    await handle.trigger('SKIP');
    await setTimeout(1500);
    assert.equal((await transaction(pool, (db) => db.list('publication', 'report'))).length, 1);
    console.log('PASS real Temporal Schedule: creates one report draft per window and never auto-publishes');
  } finally {
    if (scheduleId)
      await client.schedule
        .getHandle(scheduleId)
        .delete()
        .catch(() => undefined);
    if (originalProvider === undefined) delete process.env.MODEL_PROVIDER;
    else process.env.MODEL_PROVIDER = originalProvider;
    if (originalModel === undefined) delete process.env.MODEL_ID;
    else process.env.MODEL_ID = originalModel;
    await stopWorker();
    await connection.close();
    await pool.end();
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await smoke();
