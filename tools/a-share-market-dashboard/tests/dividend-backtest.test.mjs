import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dividendWorkbookPayload, runDividendBacktest } from '../src/dividend-backtest.mjs';
import { DIVIDEND_DEFAULT_STRATEGY } from '../src/dividend-scoring.mjs';
import { renderDividendBacktest, loadDividendBacktestData, dividendBacktestCompletionNotice } from '../src/app.mjs';

const dates = Array.from({ length: 90 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));
const prices = dates.map((date, i) => ({ date, close: 100 + i }));
const record = (i = 0, overrides = {}) => ({ dates: { index: dates[i], percentile: dates[i], bond: dates[i] }, recordDate: dates[i],
  input: { percentile: 70, dividendYield: 5, bondYield: 2 }, sourceKey: '中证官方指数推算', reference: true, kind: 'legacy', ...overrides });
const run = (records, points = prices, strategy = DIVIDEND_DEFAULT_STRATEGY) => runDividendBacktest({ records, tradingDates: dates }, points, strategy);
const localLocation = { protocol: 'http:', hostname: '127.0.0.1' };

test('completion notice identifies successful calculation, time, sample counts and actual data source', () => {
  const result = run([record(), record(1)]);
  const completed = new Date('2026-10-15T08:30:42Z');
  const live = dividendBacktestCompletionNotice(result, '2026-10-15T07:14:49Z', completed);
  assert.match(live, /回测完成（16:30:42）/);
  assert.match(live, /读取 2 条Excel记录，2 条可用信号/);
  assert.match(live, /结果见下方/);
  assert.match(live, /当前Excel磁盘文件/);
  assert.doesNotMatch(live, /构建时的Excel快照/);
  assert.match(live, /本次填写的策略参数/);
  const withoutTime = dividendBacktestCompletionNotice(result, undefined, completed);
  assert.match(withoutTime, /当前Excel磁盘文件/);
  assert.doesNotMatch(withoutTime, /文件修改时间/);
});

test('signals start after collection and end at the Excel cutoff, ignoring later prices', () => {
  const points = prices.map(point => ({ ...point }));
  points[2].close = 110; points[3].close = 99;
  const result = run([record(), record(6)], points);
  const observation = result.rows[0].observation;
  assert.equal(observation.entryDate, dates[1]);
  assert.equal(observation.exitDate, dates[6]);
  assert.equal(observation.returnPct, (106 / 101 - 1) * 100);
  assert.ok(Math.abs(observation.drawdownPct + 10) < 1e-10);
  assert.equal(result.coverage.dailyEligible, 0, 'retrospective Excel data never becomes an actual daily confirmation');
  assert.equal(result.coverage.usableSamples, 2);
  assert.deepEqual(result.period, { startDate: dates[0], endDate: dates[6], tradingDays: 7 });
  assert.equal(result.coverage.priceLastDate, dates[6]);
  assert.equal(result.coverage.priceCount, 7);
  assert.equal(result.referenceSummary.length, 1);
  assert.equal(result.referenceSummary[0].completed, 1);
  assert.equal(result.referenceSummary[0].pending, 1);
});

test('pending outcomes and missing or conflicting prices never become zero returns', () => {
  const pending = run([record(88), record(89)]).rows[0].observation;
  assert.equal(pending.status, '后续交易日不足');
  assert.equal(pending.returnPct, undefined);
  const gap = run([record(), record(89)], prices.filter((_, i) => i !== 3));
  assert.equal(gap.rows[0].observation.status, '价格缺失');
  assert.equal(gap.referenceSummary[0].meanReturnPct, null);
  const conflict = run([record(), record(89)], [...prices, { date: dates[3], close: 1 }]);
  assert.equal(conflict.coverage.conflictingPrices, 1);
  assert.equal(conflict.rows[0].observation.status, '价格缺失');
  const noNextDay = run([record(89)]).rows[0].observation;
  assert.equal(noNextDay.status, '后续交易日不足');
  assert.equal(noNextDay.returnPct, undefined);
});

test('weekend collection enters the next actual session and uses the common Excel end date', () => {
  const calendar = ['2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-12'];
  const result = runDividendBacktest({ records: [record(0, { dates: { index: calendar[0], percentile: calendar[0], bond: calendar[0] }, recordDate: '2026-01-03' }), record(0, { dates: { index: calendar.at(-1), percentile: calendar.at(-1), bond: calendar.at(-1) }, recordDate: calendar.at(-1) })], tradingDates: calendar },
    calendar.map((date, i) => ({ date, close: 100 + i })), DIVIDEND_DEFAULT_STRATEGY);
  const outcome = result.rows[0].observation;
  assert.equal(outcome.entryDate, '2026-01-05');
  assert.equal(outcome.exitDate, '2026-01-12');
});

test('bad inputs, unavailable dates and inconsistent dates are excluded with reasons', () => {
  const result = run([record(0, { input: { percentile: null, dividendYield: 5, bondYield: 2 } }),
    record(1, { dates: { index: dates[1], percentile: dates[2], bond: dates[1] } }),
    record(2, { recordDate: null }), record(3, { sourceKey: '' })]);
  assert.equal(result.coverage.usableSamples, 0);
  assert.equal(result.coverage.reasonCounts['指标缺失或无效'], 1);
  assert.equal(result.coverage.reasonCounts['指标日期未对齐'], 1);
  assert.equal(result.coverage.reasonCounts['输入晚于记录日期'], 1);
  assert.equal(result.coverage.reasonCounts['记录日期缺失'], 1);
  assert.equal(result.coverage.reasonCounts['来源缺失'], 1);
  assert.ok(result.rows.every(row => row.observation === null));
});

test('duplicate valuation dates keep earliest collection and source groups stay separate', () => {
  const result = run([record(0, { recordDate: dates[3], input: { percentile: 100, dividendYield: 7, bondYield: 1 } }), record(0), record(1, { sourceKey: '理杏仁公开页面' })]);
  assert.equal(result.coverage.duplicates, 1);
  assert.equal(result.rows[0].availableDate, dates[0]);
  assert.equal(result.rows[0].input.percentile, 70);
  assert.equal(new Set(result.referenceSummary.map(row => row.sourceKey)).size, 2);
});

test('current parameters recompute grades without mutating data or configuration', () => {
  const input = [record()];
  const original = structuredClone(input);
  const strategy = structuredClone(DIVIDEND_DEFAULT_STRATEGY);
  strategy.thresholds.B = 50;
  assert.equal(run(input).rows[0].grade, 'C');
  assert.equal(run(input, prices, strategy).rows[0].grade, 'B');
  assert.deepEqual(input, original);
  assert.equal(DIVIDEND_DEFAULT_STRATEGY.thresholds.B, 60);
  assert.throws(() => run(input, prices, { ...strategy, confirmationDays: 0 }), /确认天数/);
});

test('component values and scores follow edited anchors and weights, retaining missing and zero values', () => {
  const strategy = structuredClone(DIVIDEND_DEFAULT_STRATEGY);
  strategy.anchors.absolute[2][1] = 70;
  const result = run([record(), record(1, { input: { percentile: null, dividendYield: 5, bondYield: 2 } }), record(2, { input: { percentile: 0, dividendYield: 3, bondYield: 3 } }), record(89)], prices, strategy);
  const complete = result.rows[0];
  assert.equal(complete.components.percentile.score, 60);
  assert.equal(complete.components.absolute.score, 70);
  assert.equal(complete.components.ratio.score, 50);
  assert.equal(complete.score, 60 * .45 + 70 * .30 + 50 * .25);
  assert.equal(result.rows[1].score, null);
  assert.equal(result.rows[1].components.percentile.score, null);
  assert.equal(result.rows[1].components.absolute.score, 70);
  assert.equal(result.rows[2].components.percentile.score, 0);
  assert.equal(result.rows[2].components.absolute.score, 0);
  const rendered = renderDividendBacktest(result);
  assert.match(rendered, /<th>历史分位及得分<\/th><th>绝对股息率及得分<\/th><th>股债倍数及得分<\/th>/);
  assert.match(rendered, /data-dividend-component="percentile">70\.00% \/ 60\.0分<\/td>/);
  assert.match(rendered, /data-dividend-component="absolute">5\.00% \/ 70\.0分<\/td>/);
  assert.match(rendered, /data-dividend-component="ratio">2\.50倍 \/ 50\.0分<\/td>/);
  assert.match(rendered, /data-dividend-component="percentile">— \/ —<\/td>/);
  assert.match(rendered, /data-dividend-component="percentile">0\.00% \/ 0\.0分<\/td>/);
  assert.match(rendered, /data-dividend-component="ratio">1\.00倍 \/ 0\.0分<\/td>/);
  assert.match(rendered, /历史分位得分 × 45%/);
  assert.doesNotMatch(rendered, /NaN|undefined/);
});

test('Excel adapter reads source metrics, supports date formats and preserves row identifiers', () => {
  const headers = ['run_date__record_date', 'index_date__index_valuation_date', 'akshare_dividend_yield_2', 'bond_10y_yield', 'bond_date__china_10y_yield_date', 'lixinger_percentile_10y', 'lixinger_date__percentile_source_date', 'lixinger_source'];
  const payload = dividendWorkbookPayload([headers, ['中文表头'], [], ['2026/1/1', '2026/1/1', '5', '2', '2026/1/1', '70', '2026/1/1', '来源']], prices);
  assert.equal(payload.records[0].workbookRow, 4);
  assert.equal(payload.records[0].input.percentile, 70);
  assert.equal(payload.records[0].dates.index, dates[0]);
  assert.equal(runDividendBacktest(payload, prices, DIVIDEND_DEFAULT_STRATEGY).rows[0].grade, 'C');
  const blank = dividendWorkbookPayload([headers, [], ['2026/1/1', '2026/1/1', '', 0, '2026/1/1', '', '2026/1/1', '来源']], prices);
  assert.equal(blank.records[0].input.percentile, null);
  assert.throws(() => dividendWorkbookPayload([[], [], []], prices), /缺少/);
});

test('full history renders a common cutoff, exclusions and complete sample counts', () => {
  const records = [record(), record(1), record(2, { sourceKey: '' }), record(89)];
  const result = run(records);
  assert.equal(result.coverage.rawRecords, records.length);
  assert.equal(result.coverage.uniqueRecords + result.coverage.duplicates, result.coverage.rawRecords);
  assert.ok(result.coverage.completeInputs <= result.coverage.uniqueRecords);
  assert.equal(Object.values(result.coverage.gradeCounts).reduce((sum, value) => sum + value, 0), result.coverage.usableSamples);
  const rendered = renderDividendBacktest(result);
  assert.match(rendered, /Excel全区间/);
  assert.ok(rendered.includes(`统一截至 ${result.period.endDate}`));
  assert.match(rendered, /逐条信号|未纳入原因|参数快照/);
  assert.doesNotMatch(rendered, /NaN|Infinity|undefined|未满期|观察期/);
  const details = rendered.match(/<details class="dividend-backtest-details">[\s\S]*?<\/details>/)[0];
  assert.doesNotMatch(details, /<th>记录日期<\/th>/);
  assert.equal((details.match(/<th>/g) ?? []).length, 10);
  const detailRows = details.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].match(/<tr>[\s\S]*?<\/tr>/g);
  assert.equal(detailRows.length, records.length);
  assert.ok(detailRows.every(row => (row.match(/<td\b/g) ?? []).length === 10));
  assert.doesNotMatch(readFileSync(new URL('../src/index.html', import.meta.url), 'utf8'), /dividend-backtest-horizon/);
  assert.ok(result.rows.filter(row => row.observation?.status === '已完成').every(row => row.observation.exitDate === result.period.endDate));
});

test('backtest UI and build have no embedded workbook fallback', () => {
  for (const path of ['../src/index.html', '../src/app.mjs', '../scripts/build.mjs', '../a-share-market-dashboard.html']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /backtest-snapshot|CSI_DIVIDEND_WORKBOOK_ROWS|dividendWorkbookRows|useSnapshot|使用构建快照/);
    assert.doesNotMatch(source, /dividend-backtest-dialog|backtestDialog/);
  }
});

test('missing Excel end-date prices are explicit failures instead of an earlier silent cutoff', () => {
  assert.throws(() => runDividendBacktest({ records: [record(), record(89)], tradingDates: dates.slice(0, -1) }, prices.slice(0, -1), DIVIDEND_DEFAULT_STRATEGY), /未覆盖Excel最后估值日/);
  const result = run([record(), record(89)], prices.filter((_, i) => i !== 89));
  assert.equal(result.rows[0].observation.status, '价格缺失');
  assert.equal(result.referenceSummary[0].meanReturnPct, null);
});

test('live data loader never substitutes stale data after service errors', async () => {
  assert.deepEqual(await loadDividendBacktestData(async (url, options) => {
    assert.equal(url, '/api/dividend-backtest-data'); assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => ({ schemaVersion: 1, rows: [], indexPoints: [] }) };
  }, localLocation), { schemaVersion: 1, rows: [], indexPoints: [] });
  await assert.rejects(loadDividendBacktestData(async () => ({ ok: false, json: async () => ({ error: '文件已损坏' }) }), localLocation), /文件已损坏/);
  let requests = 0;
  const fetcher = async () => {
    requests += 1;
    return { ok: true, json: async () => ({ schemaVersion: 1, rows: [[requests]], indexPoints: [] }) };
  };
  assert.deepEqual((await loadDividendBacktestData(fetcher, localLocation)).rows, [[1]]);
  assert.deepEqual((await loadDividendBacktestData(fetcher, localLocation)).rows, [[2]]);
  await assert.rejects(loadDividendBacktestData(() => assert.fail('file mode must not use cached data or request a relative URL'), { protocol: 'file:', hostname: '' }), /启动面板/);
});
