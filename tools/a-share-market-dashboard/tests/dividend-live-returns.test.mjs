import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDividendLiveReturnHistory, loadDividendLiveReturns, renderDividendAnnualPerformance, storedDividendMonthlyReturns } from '../src/app.mjs';

const asOf = new Date('2026-11-02T06:00:00Z');
const location = { protocol: 'http:', hostname: '127.0.0.1', origin: 'http://127.0.0.1:49888' };
const points = [];
for (let day = new Date('2026-01-05T00:00:00Z'); day <= new Date('2026-10-30T00:00:00Z'); day.setUTCDate(day.getUTCDate() + 1)) {
  if (![0, 6].includes(day.getUTCDay())) points.push({ date: day.toISOString().slice(0, 10), close: points.length === 0 ? 100 : 120 });
}
points.find(point => point.date === '2026-06-01').close = 150;
const saved = { year: 2026, startDate: '2026-01-05', endDate: '2026-10-30', annualReturn: 20, maxDrawdown: -20, status: '年内' };
const old = { year: 2025, startDate: '2025-01-02', endDate: '2025-12-31', annualReturn: 12, maxDrawdown: -5, status: '完整年度' };
const snapshot = { firstDate: old.startDate, lastDate: saved.endDate, rows: [old, saved] };
const quote = { code: '000922', price: 110, quoteTimestamp: new Date('2026-11-02T05:59:00Z').getTime() / 1000 };
const fetcher = async url => new URL(url).pathname === '/api/stock-quote' ? { data: quote } : { data: points };

test('live annual return and drawdown use the current quote while retaining the annual starting baseline', () => {
  const original = structuredClone({ snapshot, points });
  const result = buildDividendLiveReturnHistory(snapshot, points, { asOf, quote });
  const row = result.rows.at(-1);
  assert.ok(Math.abs(row.annualReturn - 10) < 1e-10);
  assert.ok(Math.abs(row.maxDrawdown - (110 / 150 - 1) * 100) < 1e-10);
  assert.equal(row.endDate, '2026-11-02');
  assert.equal(row.isIntraday, true);
  assert.equal(result.quoteAt, '2026-11-02T05:59:00.000Z');
  assert.deepEqual(result.rows[0], old);
  assert.ok(storedDividendMonthlyReturns(row));
  const monthly = renderDividendAnnualPerformance(result, { metric: 'drawdown' });
  assert.equal((monthly.match(/class="dividend-month-card /g) ?? []).length, 12);
  assert.doesNotMatch(monthly, /正在读取所选年份/);
  assert.deepEqual({ snapshot, points }, original);
});

test('same-date quote replaces the provisional daily endpoint and cannot accumulate duplicate trading days', () => {
  const daily = [...points, { date: '2026-11-02', close: 160 }];
  const result = buildDividendLiveReturnHistory(snapshot, daily, { asOf, quote });
  assert.ok(Math.abs(result.rows.at(-1).annualReturn - 10) < 1e-10);
  // The superseded provisional endpoint must not become an invented annual high.
  assert.ok(Math.abs(result.rows.at(-1).maxDrawdown - (110 / 150 - 1) * 100) < 1e-10);
});

test('invalid, wrong-index, future and older-than-daily quotes are rejected', () => {
  for (const invalid of [
    { ...quote, code: '000300' }, { ...quote, price: 0 }, { ...quote, price: NaN },
    { ...quote, quoteTimestamp: Infinity }, { ...quote, quoteTimestamp: asOf.getTime() / 1000 + 1000 },
    { ...quote, quoteTimestamp: new Date('2026-10-29T06:00:00Z').getTime() / 1000 },
  ]) assert.throws(() => buildDividendLiveReturnHistory(snapshot, points, { asOf, quote: invalid }), /报价/);
});

test('partial history never silently changes the annual baseline or fills missing yearly values', () => {
  assert.throws(() => buildDividendLiveReturnHistory(snapshot, points.slice(1), { asOf, quote }), /未覆盖年度起点/);
  assert.throws(() => buildDividendLiveReturnHistory(snapshot, [
    { date: old.startDate, close: 100 }, { date: old.endDate, close: 112 }, ...points.slice(1),
  ], { asOf, quote }), /未覆盖年度起点/);
  assert.throws(() => buildDividendLiveReturnHistory(snapshot, [], { asOf, quote }), /有效指数日线/);
});

test('new year starts from its own first trading close and historical status closes after rollover', () => {
  const result = buildDividendLiveReturnHistory(snapshot, [...points, { date: '2026-12-31', close: 125 },
    { date: '2027-01-04', close: 200 }, { date: '2027-01-05', close: 210 }], { asOf: new Date('2027-01-05T08:00:00Z') });
  assert.equal(result.rows.at(-2).status, '完整年度');
  assert.equal(result.rows.at(-1).year, 2027);
  assert.ok(Math.abs(result.rows.at(-1).annualReturn - 5) < 1e-10);
  assert.equal(result.rows.at(-1).isIntraday, false);
});

test('loader uses existing routes and keeps the quote out of the official daily series', async () => {
  const urls = [];
  const result = await loadDividendLiveReturns({ snapshot, baseHistory: points, asOf, location, fetcher: async (url, timeout) => {
    urls.push(url); assert.equal(timeout, 60000); return fetcher(url);
  } });
  assert.equal(new URL(urls[0]).pathname, '/api/csindex-performance');
  assert.equal(new URL(urls[1]).searchParams.get('secid'), '1.000922');
  assert.equal(result.indexHistory.at(-1).date, '2026-10-30');
  assert.equal(result.history.lastDate, '2026-11-02');
  assert.deepEqual(result.warnings, []);
});

test('quote failure falls back to daily data with a warning; daily failure never pretends to be live', async () => {
  const result = await loadDividendLiveReturns({ snapshot, baseHistory: points, asOf, location, fetcher: async url => {
    if (new URL(url).pathname === '/api/stock-quote') throw new Error('HTTP 503');
    return fetcher(url);
  } });
  assert.equal(result.history.lastDate, '2026-10-30');
  assert.equal(result.history.quoteAt, null);
  assert.match(result.warnings[0], /实时报价读取失败/);
  await assert.rejects(loadDividendLiveReturns({ snapshot, baseHistory: points, asOf, location, fetcher: async url => {
    if (new URL(url).pathname === '/api/csindex-performance') throw new Error('HTTP 503');
    return fetcher(url);
  } }), /日线读取失败/);
  await assert.rejects(loadDividendLiveReturns({ snapshot, asOf, location: { protocol: 'file:' } }), /启动面板/);
});

test('a later quote failure retains the last successful intraday result instead of relabeling it as daily data', async () => {
  const live = buildDividendLiveReturnHistory(snapshot, points, { asOf, quote });
  const result = await loadDividendLiveReturns({ snapshot: live, baseHistory: points, asOf, location, fetcher: async url => {
    if (new URL(url).pathname === '/api/stock-quote') throw new Error('HTTP 503');
    return fetcher(url);
  } });
  assert.equal(result.history, live);
  assert.equal(result.history.quoteAt, live.quoteAt);
  assert.match(result.warnings[0], /实时报价读取失败/);
  assert.throws(() => buildDividendLiveReturnHistory(live, points, { asOf, quote: { ...quote, quoteTimestamp: quote.quoteTimestamp - 10 } }), /早于上次/);
});

test('calendar explicitly labels snapshot, loading, dynamic, failure and retry states', () => {
  const dynamic = buildDividendLiveReturnHistory(snapshot, points, { asOf, quote });
  for (const [liveState, expected] of [
    [{ status: 'snapshot' }, /本地快照/], [{ status: 'loading' }, /刷新中…/],
    [{ status: 'loaded', warnings: [] }, /盘中动态估算/],
    [{ status: 'error', error: '<HTTP 503>' }, /更新失败：&lt;HTTP 503&gt;；保留截至2026-11-02的数据/],
  ]) {
    const html = renderDividendAnnualPerformance(dynamic, { mode: 'year', liveState });
    assert.match(html, expected);
    assert.match(html, /data-dividend-calendar-refresh/);
    assert.match(html, /不统计分时最低点回撤/);
  }
});
