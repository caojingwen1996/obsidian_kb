import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderStartupChecks, runStartupChecks, startupCheckSummary } from '../src/startup-checks.mjs';

test('startup reports real progress and completes independent checks once each', async () => {
  let release;
  let runs = 0;
  const wait = new Promise(resolve => { release = resolve; });
  const updates = [];
  const result = runStartupChecks([
    { id: 'quick', label: '连接', run: () => { runs++; return { status: 'passed', detail: '已连接' }; } },
    { id: 'slow', label: '数据', run: async report => { runs++; report('已完成 1 / 2'); await wait; return { status: 'passed', detail: '数据有效' }; } },
  ], { onUpdate: items => updates.push(items) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(runs, 2);
  assert.equal(updates[0].every(item => item.status === 'loading'), true);
  assert.ok(updates.some(items => items[0].status === 'passed' && items[1].status === 'loading'));
  assert.ok(updates.some(items => items[1].detail === '已完成 1 / 2'));
  release();
  assert.deepEqual(startupCheckSummary(await result), { completed: 2, total: 2, issues: 0, ready: true, passed: true });
  assert.equal(updates[0][0].status, 'loading', 'previous snapshots must not mutate');
});

test('failures, cached data and malformed results never become a successful startup', async () => {
  const items = await runStartupChecks([
    { id: 'failed', run: () => { throw new Error('HTTP 503'); } },
    { id: 'cached', run: () => ({ status: 'warning', detail: '本地快照' }) },
    { id: 'invalid', run: () => undefined },
    { id: 'ok', run: () => ({ status: 'passed', detail: '成功' }) },
  ]);
  assert.deepEqual(items.map(item => item.status), ['failed', 'warning', 'failed', 'passed']);
  assert.equal(items[0].detail, 'HTTP 503');
  assert.deepEqual(startupCheckSummary(items), { completed: 4, total: 4, issues: 3, ready: true, passed: false });
});

test('slow checks have a deadline and late completion cannot rewrite a timeout as passed', async () => {
  let finish;
  let reportLate;
  const pending = new Promise(resolve => { finish = resolve; });
  let updates = 0;
  const items = await runStartupChecks([{ id: 'slow', run: report => { reportLate = report; return pending; } }], { timeoutMs: 10, onUpdate: () => updates++ });
  assert.equal(items[0].status, 'warning');
  assert.match(items[0].detail, /超时.*后台仍在读取/);
  const count = updates;
  reportLate('不应改写超时结果');
  finish({ status: 'passed' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(updates, count);
  assert.equal(items[0].status, 'warning');
});

test('each invocation runs fresh checks and duplicate ids are rejected before running', async () => {
  let calls = 0;
  const check = { id: 'one', run: () => { calls++; return { status: 'passed' }; } };
  await runStartupChecks([check]);
  await runStartupChecks([check]);
  assert.equal(calls, 2);
  await assert.rejects(runStartupChecks([check, check]), /项目重复/);
  assert.equal(calls, 2);
  assert.equal(startupCheckSummary([]).passed, false);
});

test('startup escapes labels, errors and data and uses an allowlist for state classes', () => {
  const html = renderStartupChecks([{ label: '<img src=x>', status: 'failed" onclick="bad', detail: '<script>secret</script>' }]);
  assert.match(html, /is-failed/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.match(html, /&lt;script&gt;secret&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|<img|onclick/);
});

test('console markers preserve distinct loading, successful, warning and failed states without relying on color', () => {
  for (const [status, marker, label] of [['loading', '[··]', '检查中'], ['passed', '[OK]', '通过'], ['warning', '[待验证]', '待验证'], ['failed', '[失败]', '失败']]) {
    const html = renderStartupChecks([{ label: '成交额接口', status, detail: '数据状态' }]);
    assert.ok(html.includes(`aria-label="${label}">${marker}</span>`));
    assert.ok(html.includes('成交额接口...'));
    assert.ok(html.includes('class="startup-check-detail">数据状态</span>'));
  }
});

test('the startup screen precedes and hides the dashboard before JavaScript runs', async () => {
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('id="startup-screen"') < html.indexOf('id="dashboard-shell"'));
  assert.match(html, /id="dashboard-shell" hidden inert/);
  assert.match(html, /id="startup-summary" role="status" aria-live="polite"/);
  assert.match(html, /<noscript>/);
  for (const id of ['startup-screen', 'startup-enter', 'startup-retry', 'startup-checks']) assert.equal(html.match(new RegExp(`id="${id}"`, 'g')).length, 1);
});
