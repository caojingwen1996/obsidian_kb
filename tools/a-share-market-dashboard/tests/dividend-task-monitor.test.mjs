import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDividendTaskMonitor, renderDividendTaskSummary, dividendTaskStatus, dividendTaskSteps } from '../src/dividend-task-monitor.mjs';

function payload() {
  return {
    current: { status: 'verified', source: 'artifact', runDate: '2026-10-21', recordedAt: '2026-10-21T12:07:55+08:00' },
    checkedAt: '2026-10-21T12:16:00+08:00', schedule: { time: '09:00', graceMinutes: 30 },
    validation: { ok: true, dates: { index: '2026-10-20', bond: '2026-10-20', quote: '2026-10-21' }, recordDate: '2026-10-21', strategyVersion: 'r5',
      artifacts: [{ name: '最新信号.md', href: '/sources/最新信号.md', ok: true, message: '文件可读' }], checks: [{ label: '当日记录唯一', ok: true, detail: '1条' }], warnings: [] },
    history: [{ id: 'failed-1', runDate: '2026-10-21', status: 'failed', source: 'execution', error: '<script>alert(1)</script>', stage: '写入Excel' }],
    boundary: '历史执行过程未记录', errors: [],
  };
}

test('previous-day inputs and legacy provenance remain visible without invented completion times', () => {
  const html = renderDividendTaskMonitor(payload());
  assert.match(html, /产物已核验/);
  assert.match(html, /2026-10-20/);
  assert.match(html, /历史未记录/);
  assert.match(html, /信号记录时间/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('refresh failure keeps the snapshot explicitly labelled and summary links to the same page', () => {
  assert.match(renderDividendTaskMonitor(payload(), '服务离线'), /当前保留上次读取结果/);
  const summary = renderDividendTaskSummary(payload());
  assert.match(summary, /data-dividend-view="dividend-task-monitor-view"/);
  assert.match(summary, /12:07/);
  assert.match(renderDividendTaskSummary(payload(), '读取失败'), /读取失败/);
});

test('empty state, in-progress and unconfirmed labels are distinct', () => {
  assert.match(renderDividendTaskMonitor(null), /正在读取任务状态/);
  assert.match(renderDividendTaskMonitor(null, '请通过启动面板打开'), /请通过启动面板打开/);
  assert.equal(dividendTaskStatus('running')[0], '正在执行');
  assert.equal(dividendTaskStatus('overdue')[0], '逾期未确认');
  assert.equal(dividendTaskStatus('verified-warning')[0], '产物已核验·有提醒');
  assert.equal(dividendTaskStatus('unknown')[0], '状态待确认');
});

test('legacy artifacts only complete the verified step, never the execution steps', () => {
  const p = payload();
  assert.deepEqual(dividendTaskSteps(p.current, p.validation).map(step => step.state), ['unknown', 'unknown', 'unknown', 'done']);
  const html = renderDividendTaskMonitor(p);
  assert.match(html, /class="task-state-badge is-success"/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow="1"/);
  assert.match(html, /datetime="2026-10-20"/);
  assert.match(html, /<details class="task-overview-details"/);
});

test('the stepper stops at the real running, failed or interrupted stage', () => {
  assert.deepEqual(dividendTaskSteps({ source: 'execution', status: 'running', stage: '写入评分记录' }, {}).map(step => step.state), ['done', 'done', 'active', 'pending']);
  assert.deepEqual(dividendTaskSteps({ source: 'execution', status: 'partial', stage: '写入每日信号Excel' }, {}).map(step => step.state), ['done', 'done', 'failed', 'pending']);
  assert.deepEqual(dividendTaskSteps({ source: 'execution', status: 'unconfirmed', stage: '核验输出文件' }, {}).map(step => step.state), ['done', 'done', 'done', 'paused']);
  assert.deepEqual(dividendTaskSteps({ source: 'none', status: 'overdue' }, {}).map(step => step.state), ['pending', 'pending', 'pending', 'pending']);
  assert.deepEqual(dividendTaskSteps({ source: 'execution', status: 'success', stage: '校验完成' }, {}).map(step => step.state), ['done', 'done', 'done', 'done']);
});

test('missing or malformed source dates show a warning tag without breaking monitoring', () => {
  const p = payload();
  p.validation.dates.quote = null;
  p.validation.dates.index = 20261020;
  const html = renderDividendTaskMonitor(p);
  assert.match(html, /is-missing/);
  assert.match(html, /待核验/);
  assert.match(html, /未取得/);
});
