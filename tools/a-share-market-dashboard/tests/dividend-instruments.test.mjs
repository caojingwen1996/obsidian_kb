import test from 'node:test';
import assert from 'node:assert/strict';
import { DIVIDEND_DEFAULT_STRATEGY } from '../src/dividend-scoring.mjs';
import { createMemoryStorage } from '../src/data-service.mjs';
import { dividendInstrument, dividendInstrumentStrategyKey, readInstrumentStrategy, saveInstrumentStrategy,
  normalizeDividendInstrumentData, loadDividendInstrumentData, dividendInstrumentDayCounts } from '../src/dividend-instruments.mjs';
import { spDividendModel, renderSpDividendIndexView, renderSpDividendManagement, renderSpDividendMonitor } from '../src/app.mjs';

const base = { schemaVersion: 1, instrumentId: '515450', priceBasis: 'qfq', source: 'ETF测试源', sourceUrl: 'https://example.test/index',
  daily: [], records: [], valuation: null, lastPoint: { instrumentId: '515450', date: '2026-10-30', close: 1.491 },
  sourceStatus: { error: 'ETF行情更新失败', daily: 'ETF历史尚未取得', valuation: 'ETF现金分红未取得' } };
const daily = [];
for (let day = new Date('2025-01-02T00:00:00Z'); day <= new Date('2026-10-30T00:00:00Z'); day.setUTCDate(day.getUTCDate() + 1)) {
  if (![0, 6].includes(day.getUTCDay())) daily.push({ date: day.toISOString().slice(0, 10), close: 1 + daily.length / 1000 });
}

test('515450 resolves to ETF and migrates the old index picker and independent strategy storage', () => {
  assert.equal(dividendInstrument('515450').id, '515450');
  assert.equal(dividendInstrument('SPCLLHCP').id, '515450');
  assert.equal(dividendInstrument('515450').kind, 'etf');
  assert.equal(dividendInstrument('000922').id, '000922');
  assert.notEqual(dividendInstrumentStrategyKey('515450'), dividendInstrumentStrategyKey('000922'));
  const storage = createMemoryStorage();
  const csi = readInstrumentStrategy(storage, '000922');
  const sp = readInstrumentStrategy(storage, '515450');
  sp.weights = { absolute: 90, ratio: 10 };
  saveInstrumentStrategy(storage, '515450', sp);
  assert.deepEqual(readInstrumentStrategy(storage, '000922'), csi);
  assert.deepEqual(readInstrumentStrategy(storage, '515450').weights, { absolute: 90, ratio: 10 });
  assert.deepEqual(DIVIDEND_DEFAULT_STRATEGY.weights, { absolute: 92, ratio: 8 });
});

test('index data and index dividend yield cannot masquerade as ETF data', () => {
  for (const instrumentId of ['000922', 'SPCLLHCP', 'H30269']) assert.throws(() => normalizeDividendInstrumentData({ ...base, instrumentId }), /身份不一致/);
  assert.throws(() => normalizeDividendInstrumentData({ ...base, lastPoint: { ...base.lastPoint, instrumentId: 'SPCLLHCP' } }), /515450/);
  assert.throws(() => normalizeDividendInstrumentData({ ...base, valuation: { basis: 'fund-distribution-yield', dividendYield: 5, date: '2026-10-30', sourceUrl: 'https://example.test' } }), /分红率口径/);
});

test('daily input rejects future dates, weekends, invalid prices and conflicting duplicates', () => {
  for (const point of [{ date: '2026-11-03', close: 3000 }, { date: '2026-10-31', close: 3000 },
    { date: '2026-10-30', close: 0 }, { date: '2026-10-30', close: NaN }]) {
    assert.throws(() => normalizeDividendInstrumentData({ ...base, daily: [point] }, '515450', new Date('2026-11-02')), /日线/);
  }
  assert.throws(() => normalizeDividendInstrumentData({ ...base, daily: [{ date: '2026-10-30', close: 3000 }, { date: '2026-10-30', close: 3001 }] }), /冲突/);
});

test('missing ETF evidence stays missing in score, bands, calendar, management and task status', () => {
  const data = normalizeDividendInstrumentData(base);
  const model = spDividendModel(data, undefined, { value: 1.65, date: '2026-10-30' });
  assert.equal(model.score.score, null);
  assert.equal(model.annual, null);
  const view = renderSpDividendIndexView(model);
  assert.match(view, /515450/); assert.match(view, /ETF/); assert.match(view, /ETF行情更新失败/);
  assert.match(view, /ETF/); assert.match(view, /待验证/);
  assert.doesNotMatch(view, /000922|H30269|中证红利日线|参考评分 A/);
  const manager = renderSpDividendManagement(model);
  assert.match(manager, /data-sp-backtest disabled/);
  assert.doesNotMatch(manager, /data-dividend-apply|data-open-dividend-source|读取Excel/);
  assert.match(renderSpDividendMonitor(data), /尚未配置/);
});

test('complete ETF data drives its own score, bands and annual prices', () => {
  const data = normalizeDividendInstrumentData({ ...base, daily, valuation: { basis: 'fund-distribution-yield-ttm', dividendYield: 5.2,
    date: '2026-10-30', sourceUrl: 'https://example.test/valuation' } });
  const model = spDividendModel(data, undefined, { value: 1.65, date: '2026-10-30' });
  assert.equal(model.score.components.absolute.value, 5.2);
  assert.equal(model.score.reference, true);
  assert.equal(model.annual.source, base.source);
  const current = daily.filter(point => point.date.startsWith('2026'));
  assert.ok(Math.abs(model.annual.rows.at(-1).annualReturn - (current.at(-1).close / current[0].close - 1) * 100) < 1e-8);
  const view = renderSpDividendIndexView(model, { calendar: { mode: 'year' } });
  assert.match(view, /data-spdividend-calendar-mode="year" aria-pressed="true"/);
  assert.match(view, /data-status="ready"/);
  assert.doesNotMatch(view, /000922|中证指数官网日线/);
});

test('invalid independent parameters produce pending evidence instead of breaking rendering', () => {
  const strategy = structuredClone(DIVIDEND_DEFAULT_STRATEGY);
  strategy.weights.absolute = NaN;
  const model = spDividendModel(normalizeDividendInstrumentData(base), strategy);
  assert.equal(model.score.score, null);
  assert.match(renderSpDividendManagement(model), /data-sp-save disabled/);
  assert.doesNotThrow(() => renderSpDividendIndexView(model));
});

test('source loader queries only its own code and rejects a substituted CSI payload', async () => {
  const location = { protocol: 'http:', hostname: '127.0.0.1', origin: 'http://127.0.0.1:49888' };
  const data = await loadDividendInstrumentData('515450', { location, fetcher: async url => {
    assert.equal(new URL(url).pathname, '/api/dividend-signal');
    assert.equal(new URL(url).searchParams.get('code'), '515450');
    return base;
  } });
  assert.equal(data.instrumentId, '515450');
  await assert.rejects(loadDividendInstrumentData('515450', { location, fetcher: async () => ({ ...base, instrumentId: '000922' }) }), /身份不一致/);
});

test('ETF valuation records require the same fund, an actual collection date and a source', () => {
  for (const record of [{ instrumentId: '000922' }, { instrumentId: '515450' },
    { instrumentId: '515450', recordDate: '2026-10-30', dates: { index: '2026-10-30' } }]) {
    assert.throws(() => normalizeDividendInstrumentData({ ...base, records: [record] }), /历史评分记录/);
  }
});

test('day distribution uses only the selected index and counts threshold boundaries as flat', () => {
  const data = normalizeDividendInstrumentData({ ...base, daily: [
    { date: '2026-10-26', close: 100 }, { date: '2026-10-27', close: 100.5 },
    { date: '2026-10-28', close: 102 }, { date: '2026-10-29', close: 100 },
  ] });
  assert.deepEqual(dividendInstrumentDayCounts(data), [{ year: 2026, up: 1, flat: 1, down: 1, total: 3 }]);
});

test('a partial first year is displayed as sample-period performance even when it is the current year', () => {
  const data = normalizeDividendInstrumentData({ ...base, daily: [{ date: '2026-07-01', close: 3000 }, { date: '2026-10-30', close: 3300 }] });
  const model = spDividendModel(data);
  assert.equal(model.annual.rows[0].status, '样本首年');
  assert.match(renderSpDividendIndexView(model), /样本期累计收益/);
});


test('recent price window is identified and never reported as full-year history', () => {
  const data = normalizeDividendInstrumentData({ ...base, source: 'ETF测试源', daily,
    lastPoint: { ...base.lastPoint, kind: 'marketscreener-close' }, historyCoverage: 'recent-window',
    sourceStatus: { error: 'HTTP 403，使用缓存', daily: '仅近期行情' } });
  const model = spDividendModel(data);
  assert.equal(model.annual, null);
  const view = renderSpDividendIndexView(model);
  assert.match(view, /ETF/);
  assert.match(view, /HTTP 403，使用缓存/);
  assert.doesNotMatch(view, /data-status="ready"|官方页面点位快照/);
});

test('browser history with unresolved dates cannot produce bands, annual statistics or backtests', () => {
  const data = normalizeDividendInstrumentData({ ...base, daily,
    historyCoverage: 'partial-history', collection: { method: 'browser-dom' },
    dataQuality: { note: '异常日期已隔离，完整性待核验' } });
  const model = spDividendModel(data);
  assert.equal(model.annual, null);
  assert.equal(data.collection.method, 'browser-dom');
  const view = renderSpDividendIndexView(model);
  assert.match(view, /异常日期已隔离，完整性待核验/);
  assert.match(view, /完整性待核验/);
  assert.doesNotMatch(view, /data-status="ready"|样本交易日/);
  assert.match(renderSpDividendManagement(model), /data-sp-backtest disabled/);
});


test('ETF view reuses the CSI module structure and keeps source details in the management disclosure', () => {
  const data = normalizeDividendInstrumentData({ ...base, daily, valuation: { basis: 'fund-distribution-yield-ttm', dividendYield: 3.69, date: '2026-10-30', sourceUrl: 'https://example.test' } });
  const model = spDividendModel(data, undefined, { value: 1.62, date: '2026-10-30' });
  const view = renderSpDividendIndexView(model);
  for (const marker of ['task-summary-line', 'dividend-buy-decision', 'dividend-detail-hero', 'dividend-detail-metrics', 'dividend-yield-chart-card', 'score-breakdown', 'dividend-history-disclosure', 'index-day-chart']) assert.ok(view.includes(marker), marker);
  assert.doesNotMatch(view, /spdividend-source-panel|<h3>ETF现金分红记录/);
  const manager = renderSpDividendManagement(model);
  for (const marker of ['dividend-strategy-panel', 'dividend-backtest-panel', 'dividend-source-disclosure', 'data-sp-param=', 'data-sp-save', 'data-sp-backtest disabled']) assert.ok(manager.includes(marker), marker);
  assert.doesNotMatch(manager, /data-dividend-param=|data-dividend-save|data-open-dividend-source/);
  const monitor = renderSpDividendMonitor(data);
  for (const marker of ['task-monitor-toolbar', 'task-monitor-panel', 'task-stepper', 'task-artifacts', 'task-history-panel']) assert.ok(monitor.includes(marker), marker);
  assert.match(monitor, /尚未配置/);
});
