import test from 'node:test';
import assert from 'node:assert/strict';
import { openFixture } from './fixture.js';
import { ExecutionStore } from '../src/l0/execution.js';
import { Pool } from 'pg';
import { readCatalog } from '../src/m1/catalog.js';

test('a due schedule is durable, concurrent ticks submit once, restart skips in-flight work and disabled sources', async () => {
  const c = await openFixture();
  try {
    const { Scheduler } = await import('../src/runtime/scheduler.js');
    const io = new Pool({ connectionString: c.urlFor('IO_DATABASE_URL') });
    try {
      await c.db.query("INSERT INTO platform.actors VALUES('riskhot-scheduler',ARRAY['read','submit','retry','auto_retry'],ARRAY['*'])");
      await c.db.query("UPDATE information.operations SET status='completed'");
      const repo = new ExecutionStore(io, c.artifacts);
      let notices = 0; const notify = async () => { notices++; };
      const config = { intervalSeconds: 3600, maxInFlight: 2, sources: ['wiki-source-001'] };
      const s = new Scheduler(repo, notify, config);
      const now = new Date();
      await s.initialize(now);
      await c.db.query("UPDATE platform.source_schedules SET next_run_at=$1", [now]);
      await Promise.all([s.tick(now), new Scheduler(repo, notify, config).tick(now)]);
      assert.equal((await c.db.query('SELECT count(*)::int AS n FROM platform.schedule_runs')).rows[0].n, 1);
      assert.equal((await c.db.query("SELECT count(*)::int AS n FROM information.operations WHERE actor='riskhot-scheduler'")).rows[0].n, 1);
      await new Scheduler(repo, notify, config).tick(new Date(now.getTime() + 7200_000));
      assert.equal((await c.db.query('SELECT count(*)::int AS n FROM platform.schedule_runs')).rows[0].n, 1, 'in-flight source is not resubmitted after restart');
      assert.equal(notices, 0, 'ordinary acceptance stays quiet');
      await c.db.query("UPDATE information.operations SET status='completed'");
      await c.db.query("UPDATE m1.sources SET state='DISABLED'");
      await s.tick(new Date(now.getTime() + 10800_000));
      assert.equal((await c.db.query('SELECT count(*)::int AS n FROM platform.schedule_runs')).rows[0].n, 1);
    } finally { await io.end(); }
  } finally { await c.dispose(); }
});

test('alerts stay quiet on success, deduplicate persistence, resolve, recur and retain failed notification delivery', async () => {
  const c = await openFixture();
  try {
    const { AlertStore } = await import('../src/platform/notifications.js');
    let delivered = 0; const alerts = new AlertStore(c.db, async () => { delivered++; });
    await alerts.reconcile([]);
    assert.equal(delivered, 0);
    const issue = { key: 'model-login', code: 'MODEL_LOGIN_REQUIRED', owner: null };
    await alerts.reconcile([issue]); await new AlertStore(c.db, async () => { delivered++; }).reconcile([issue]);
    assert.equal(delivered, 1);
    await alerts.reconcile([]);
    assert.equal((await c.db.query("SELECT count(*)::int AS n FROM platform.runtime_alerts WHERE resolved_at IS NULL")).rows[0].n, 0);
    await alerts.reconcile([issue]); assert.equal(delivered, 2);
    const bad = new AlertStore(c.db, async () => { throw new Error('controlled delivery failure'); });
    await bad.reconcile([{ key: 'source-failure', code: 'SOURCE_ACCESS_BLOCKED', owner: null }]);
    const row = (await c.db.query("SELECT * FROM platform.runtime_alerts WHERE issue_key='source-failure' AND resolved_at IS NULL")).rows[0];
    assert.equal(row.delivery_status, 'failed'); assert.equal(row.delivery_attempts, 1);
  } finally { await c.dispose(); }
});

test('automatic recovery is fenced, atomically limited and cannot bypass output review or a model pause', async () => {
  const c = await openFixture();
  try {
    const { id, material, version } = await c.processing();
    await c.db.query("INSERT INTO platform.actors VALUES('riskhot-scheduler',ARRAY['read','submit','retry','auto_retry'],ARRAY['*'])");
    await c.db.query('UPDATE information.processing_runs SET input_artifact_id=NULL,manifest_artifact_id=NULL WHERE id=$1', [id]);
    await c.repo.prepare(id, 1, { version_id: version, material, manifest: { provider: { protocol: 'codex-exec', endpoint: 'codex://local', model: 'controlled' }, prompt: 'controlled' } });
    await c.repo.extractionFailed(id, 1, 'MODEL_QUOTA_EXHAUSTED');
    await c.db.query("UPDATE platform.model_budget_windows SET deadline=now()-interval '1 second' WHERE processing_id=$1", [id]);
    const results = await Promise.allSettled([c.repo.retryExtraction(id, 'riskhot-scheduler', 'automatic subscription recovery', true, 1, 'auto1', true), c.repo.retryExtraction(id, 'riskhot-scheduler', 'automatic subscription recovery', true, 1, 'auto2', true)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await c.db.query('SELECT count(*)::int AS n FROM platform.automatic_recoveries WHERE processing_id=$1', [id])).rows[0].n, 1);
    await c.repo.extractionFailed(id, 2, 'MODEL_QUOTA_EXHAUSTED');
    await c.db.query("UPDATE platform.model_budget_windows SET deadline=now()-interval '1 second' WHERE processing_id=$1", [id]);
    await assert.rejects(() => c.repo.retryExtraction(id, 'riskhot-scheduler', 'another automatic window', true, 2, 'auto3', true), /AUTO_RECOVERY_LIMIT/);
    const attempt = await c.repo.retryExtraction(id, 'review-operator', 'manual recovery stays explicit', true, 2, 'manual');
    await c.db.query("INSERT INTO platform.model_service_state(protocol,reason_code,blocked_until) VALUES('codex-exec','MODEL_QUOTA_EXHAUSTED',now()+interval '6 hours')");
    const reserved = await c.repo.reserveAttempt(id, attempt);
    assert.equal((await c.model.query('SELECT * FROM platform.claim_model_call($1)', [reserved.id])).rows[0].reason_code, 'MODEL_QUOTA_EXHAUSTED');
    await c.repo.extractionFailed(id, attempt, 'MODEL_SCHEMA_INVALID');
    await assert.rejects(() => c.repo.retryExtraction(id, 'riskhot-scheduler', 'review forbidden', false, attempt, 'auto4', true), /OUTPUT_REVIEW_REQUIRED/);
  } finally { await c.dispose(); }
});

test('a committed pending slot resumes without a new slot, and all sources share the in-flight ceiling', async () => {
  const c = await openFixture();
  try {
    const { Scheduler } = await import('../src/runtime/scheduler.js');
    await c.repo.seedCatalog((await readCatalog('src/data/source-catalog.js')).slice(0, 3));
    await c.db.query("INSERT INTO platform.actors VALUES('riskhot-scheduler',ARRAY['read','submit','retry','auto_retry'],ARRAY['*'])");
    await c.db.query("UPDATE information.operations SET status='completed'");
    const s = new Scheduler(c.repo, async () => undefined); const now = new Date(); await s.initialize(now);
    await c.db.query('UPDATE platform.source_schedules SET next_run_at=$1', [now]);
    await c.db.query('INSERT INTO platform.schedule_runs(source_id,scheduled_at) VALUES($1,$2)', [c.parent.source_id, new Date(now.getTime()-1)]);
    await s.tick(now);
    assert.equal((await c.db.query("SELECT count(*)::int AS n FROM platform.schedule_runs WHERE operation_id IS NOT NULL")).rows[0].n, 2);
    await s.tick(new Date(now.getTime()+3600_000));
    assert.equal((await c.db.query("SELECT count(*)::int AS n FROM information.operations WHERE actor='riskhot-scheduler'")).rows[0].n, 2);
  } finally { await c.dispose(); }
});

test('scheduler does not steal a generation while the workflow still has a live retry window', async () => {
  const c = await openFixture();
  try {
    const { Scheduler } = await import('../src/runtime/scheduler.js');
    const p = await c.processing();
    await c.db.query("INSERT INTO platform.actors VALUES('riskhot-scheduler',ARRAY['read','submit','retry','auto_retry'],ARRAY['*'])");
    await c.db.query("UPDATE information.processing_runs SET provider_protocol='codex-exec' WHERE id=$1", [p.id]);
    await c.repo.extractionFailed(p.id, 1, 'MODEL_NETWORK_ERROR');
    // Freeze a real subscription manifest for recovery, without executing a model.
    const artifact = await c.repo.putJson({ version_id:p.version, material:p.material, manifest:{provider:{protocol:'codex-exec',endpoint:'codex://local',model:'controlled'},prompt:'controlled'} }, 'model-input');
    await c.db.query('UPDATE information.processing_runs SET input_artifact_id=$2 WHERE id=$1', [p.id, artifact]);
    await new Scheduler(c.repo, async () => undefined).tick();
    assert.equal(Number((await c.repo.processing(p.id)).generation), 1);
  } finally { await c.dispose(); }
});

test('supervisor failure stays visible without PostgreSQL and quiet across repeated restarts', async () => {
  const { serviceFailure, serviceHealthy } = await import('../src/platform/notifications.js');
  const c = await openFixture();
  try {
    let notices = 0; const notify = async () => { notices++; };
    await serviceFailure(c.folder, 'scheduler', notify); await serviceFailure(c.folder, 'scheduler', notify);
    assert.equal(notices, 1);
    await serviceHealthy(c.folder); await serviceFailure(c.folder, 'api', notify);
    assert.equal(notices, 2);
  } finally { await c.dispose(); }
});
