import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateDividendWeeklyBollinger, dividendBollingerPosition, loadDividendBollingerHistory, mergeDividendIndexHistory } from '../src/dividend-bollinger.mjs';
import { renderDividendBollingerStrategy, renderDividendSignalDetail } from '../src/app.mjs';

const asOf = new Date('2026-06-15T09:00:00Z');
const localLocation = { protocol: 'http:', hostname: '127.0.0.1', origin: 'http://127.0.0.1:49888' };
const weeklyCloses = Array.from({ length: 20 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 0, 9 + i * 7)).toISOString().slice(0, 10), close: i + 1,
}));

test('weekly bands use the final daily close of each trading week and population deviation', () => {
  const mondays = weeklyCloses.map(point => ({ date: new Date(Date.parse(point.date) - 4 * 86400000).toISOString().slice(0, 10), close: 999 }));
  const input = [...weeklyCloses, ...mondays].reverse();
  const before = structuredClone(input);
  const result = calculateDividendWeeklyBollinger(input, { asOf });
  assert.equal(result.status, 'ready');
  assert.equal(result.weeks, 20);
  assert.equal(result.middle, 10.5);
  assert.ok(Math.abs(result.deviation - Math.sqrt(33.25)) < 1e-12);
  assert.ok(Math.abs(result.upper - (10.5 + 2 * Math.sqrt(33.25))) < 1e-12);
  assert.ok(Math.abs(result.lower - (10.5 - 2 * Math.sqrt(33.25))) < 1e-12);
  assert.equal(result.close, 20);
  assert.equal(result.label, '中轨至上轨');
  assert.equal(result.isPartialWeek, false);
  assert.equal(result.windowStart, '2026-01-09');
  assert.deepEqual(input, before);
});

test('week aggregation crosses years, skips empty holiday weeks and rejects invalid or future observations', () => {
  const points = [
    { date: '2025-12-29', close: 10 }, { date: '2026-01-02', close: 12 },
    { date: '2026-01-16', close: 15 }, { date: '2026-01-16', close: 16 },
    { date: '2026-02-30', close: 30 }, { date: '2026-01-17', close: 100 },
    { date: '2026-06-16', close: 100 }, { date: '2026-01-20', close: null },
    { date: '2026-01-21', close: -1 }, { date: '2026-01-22', close: Infinity },
    { date: '2026-01-23', close: '20' }, null,
  ];
  const result = calculateDividendWeeklyBollinger(points, { asOf });
  assert.equal(result.status, 'insufficient');
  assert.equal(result.weeks, 2);
  assert.equal(result.date, '2026-01-16');
  assert.equal(result.close, 16);
  assert.equal(result.upper, undefined);
  assert.equal(calculateDividendWeeklyBollinger([], { asOf }).status, 'missing');
  const merged = mergeDividendIndexHistory(weeklyCloses, [{ date: '2026-05-22', close: 25 }]);
  assert.equal(merged.length, 20);
  assert.equal(merged.at(-1).close, 25);
});

test('current week participates as a dynamic bar until Friday close in Shanghai time', () => {
  const dynamic = [...weeklyCloses.slice(0, -1), { date: '2026-05-20', close: 20 }];
  const wednesday = new Date('2026-05-20T09:00:00Z');
  assert.equal(calculateDividendWeeklyBollinger(dynamic, { asOf: wednesday }).isPartialWeek, true);
  assert.equal(calculateDividendWeeklyBollinger(weeklyCloses, { asOf: new Date('2026-05-22T06:59:00Z') }).isPartialWeek, true);
  assert.equal(calculateDividendWeeklyBollinger(weeklyCloses, { asOf: new Date('2026-05-22T07:00:00Z') }).isPartialWeek, false);
  assert.equal(calculateDividendWeeklyBollinger(weeklyCloses, { asOf: new Date('2026-05-23T09:00:00Z') }).isPartialWeek, false);
  assert.match(renderDividendBollingerStrategy(dynamic, { asOf: wednesday }), /本周未收盘（动态值）/);
  assert.doesNotMatch(renderDividendBollingerStrategy(weeklyCloses, { asOf }), /本周未收盘/);
});

test('position preserves exact boundaries, excursions beyond both bands and zero-width bands', () => {
  const bands = { lower: 100, middle: 150, upper: 200 };
  for (const [close, label, percentB] of [[90, '下轨下方', -10], [100, '位于下轨', 0], [125, '下轨至中轨', 25],
    [150, '位于中轨', 50], [175, '中轨至上轨', 75], [200, '位于上轨', 100], [220, '上轨上方', 120]]) {
    assert.deepEqual(dividendBollingerPosition(close, bands), { label, percentB });
  }
  const constant = weeklyCloses.map(point => ({ ...point, close: 100 }));
  const result = calculateDividendWeeklyBollinger(constant, { asOf });
  assert.equal(result.label, '三轨重合');
  assert.equal(result.percentB, null);
  assert.equal(result.upper, 100);
  assert.equal(result.lower, 100);
  assert.doesNotMatch(renderDividendBollingerStrategy(constant, { asOf }), /NaN|Infinity/);
});

test('live loader requests a full history for 000922 and reports failed or insufficient data', async () => {
  const data = weeklyCloses.map(point => ({ tradeDate: point.date.replaceAll('-', ''), indexCode: '000922', close: point.close }));
  const history = await loadDividendBollingerHistory({ asOf, location: localLocation, fetcher: async (url, timeout) => {
    const query = new URL(url);
    assert.equal(query.origin, localLocation.origin);
    assert.equal(query.pathname, '/api/csindex-performance');
    assert.equal(query.searchParams.get('indexCode'), '000922');
    assert.equal(query.searchParams.get('startDate'), '20250511');
    assert.equal(query.searchParams.get('endDate'), '20260615');
    assert.equal(timeout, 60000);
    return { data };
  } });
  assert.deepEqual(history, weeklyCloses);
  await assert.rejects(loadDividendBollingerHistory({ asOf, location: localLocation, fetcher: async () => { throw new Error('HTTP 503'); } }), /503/);
  for (const payload of [{ data: data.slice(1) }, { data: [] }, { error: 'failed' }, { success: false, data }, { code: '500', data }, { data: [{ ...data[0], indexCode: '000300' }] }]) {
    await assert.rejects(loadDividendBollingerHistory({ asOf, location: localLocation, fetcher: async () => payload }), /不足20周|格式或指数代码无效/);
  }
  await assert.rejects(loadDividendBollingerHistory({ asOf, location: { protocol: 'file:' }, fetcher: () => assert.fail('unexpected network request') }), /启动面板/);
});

test('cards retain snapshot values after a failed refresh and work independently of dividend score data', () => {
  const html = renderDividendSignalDetail(null, { indexHistory: weeklyCloses, asOf, indexStatus: 'error', indexError: 'HTTP 503 <unavailable>' });
  assert.match(html, /data-status="ready"/);
  assert.match(html, /收盘日 2026-05-22/);
  assert.match(html, /<small>周线中轨<\/small><strong>10.5<\/strong>/);
  assert.match(html, /%B /);
  assert.match(html, /更新失败：HTTP 503 &lt;unavailable&gt;/);
  assert.match(html, /保留本地数据/);
  assert.doesNotMatch(html, /数据未接入|NaN|Infinity/);
  const missing = renderDividendBollingerStrategy(weeklyCloses.slice(1), { asOf });
  assert.match(missing, /有效历史仅19周/);
  assert.match(missing, /<small>周线上轨<\/small><strong>—<\/strong>/);
});

test('Bollinger overview keeps its values and defers units, formula and source details', () => {
  const html = renderDividendBollingerStrategy(weeklyCloses, { asOf });
  const details = html.match(/<details[^>]+data-dividend-disclosure="bollinger-method"[^>]*>[\s\S]*?<\/details>/)[0];
  const primary = html.replace(details, '');
  assert.match(primary, /中轨至上轨/);
  assert.match(primary, /收盘日 2026-05-22/);
  assert.match(primary, /<small>周线中轨<\/small><strong>10.5<\/strong>/);
  assert.match(primary, /class="dividend-band-position"/);
  assert.doesNotMatch(primary, /已接入|20周均线|标准差|下轨0%|计算窗口|来源：/);
  assert.match(details, /<summary>详情<\/summary>/);
  assert.doesNotMatch(details.split('>')[0], /\bopen\b/);
  assert.match(details, /20周均线 ± 2倍标准差/);
  assert.match(details, /%B以下轨为0%、上轨为100%/);
  assert.match(details, /来源：中证指数官网日线/);
});

test('built dashboard computes real weekly bands from its embedded official history', () => {
  const html = readFileSync(new URL('../a-share-market-dashboard.html', import.meta.url), 'utf8');
  const runtime = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(runtime);
  // Pin this historical expectation to its last priced day as newer daily rows are appended.
  const { bands, card, count } = new Function(`${runtime}\nconst bands = calculateDividendWeeklyBollinger(CSI_DIVIDEND_INDEX_HISTORY, { asOf: new Date('2026-10-14T09:00:00Z') }); return { bands, count: CSI_DIVIDEND_INDEX_HISTORY.length, card: renderDividendBollingerStrategy(CSI_DIVIDEND_INDEX_HISTORY, { asOf: new Date('2026-10-14T09:00:00Z') }) };`)();
  assert.ok(count >= 200);
  assert.equal(bands.status, 'ready');
  assert.equal(bands.date, '2026-10-14');
  assert.equal(bands.close, 5672.93);
  assert.ok(bands.upper > bands.middle && bands.middle > bands.lower);
  assert.ok(Math.abs(bands.upper - 5828.583453022601) < 1e-6);
  assert.ok(Math.abs(bands.middle - 5478.306) < 1e-6);
  assert.ok(Math.abs(bands.lower - 5128.0285469774) < 1e-6);
  assert.equal(bands.label, '中轨至上轨');
  assert.match(card, /data-status="ready"/);
  assert.match(card, /本周未收盘/);
});


test('position graphic keeps true out-of-band values and never invents a marker for missing bands', () => {
  const points = weeklyCloses.map((point, i) => ({...point, close: i === 19 ? 1000 : 100}));
  const bands = calculateDividendWeeklyBollinger(points, {asOf});
  assert.ok(bands.percentB > 100);
  const html = renderDividendBollingerStrategy(points, {asOf});
  assert.match(html, /--position:100%/);
  const shown = Number(html.match(/aria-label="当前轨道位置：[^\"]*%B ([\d.]+)%"/)[1]);
  assert.ok(Math.abs(shown - bands.percentB) <= 0.05);
  assert.match(html, /%B保留轨道外的实际值/);
  assert.doesNotMatch(renderDividendBollingerStrategy([], {asOf}), /class="dividend-band-position"|--position:/);
});
