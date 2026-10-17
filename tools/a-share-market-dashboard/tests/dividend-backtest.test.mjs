import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dividendWorkbookPayload, runDividendBacktest } from '../src/dividend-backtest.mjs';
import { DIVIDEND_DEFAULT_STRATEGY } from '../src/dividend-scoring.mjs';
import { renderDividendBacktest, renderDividendBacktestSignalTable, sortDividendBacktestRows, loadDividendBacktestData, dividendBacktestCompletionNotice } from '../src/app.mjs';

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
  const details = renderDividendBacktest({ ...result, workbookUpdatedAt: '2026-10-15T07:14:49Z' });
  assert.match(details, /当前Excel磁盘文件/);
  assert.match(details, /Excel文件修改时间/);
  assert.doesNotMatch(live, /构建时的Excel快照/);
  assert.match(details, /本次填写的策略参数/);
  assert.doesNotMatch(details, /confirmationDays/);
  assert.equal(result.strategy.confirmationDays, DIVIDEND_DEFAULT_STRATEGY.confirmationDays);
  const withoutTime = dividendBacktestCompletionNotice(result, undefined, completed);
  assert.match(withoutTime, /回测完成/);
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
  assert.equal(outcome.entryPreviousDate, '2026-01-02');
  assert.equal(outcome.entryPreviousClose, 100);
  assert.ok(Math.abs(outcome.entryChangePct - 1) < 1e-10);
  assert.equal(outcome.exitDate, '2026-01-12');
});

test('bad inputs, unavailable dates and inconsistent bond dates are excluded with reasons', () => {
  const result = run([record(0, { input: { dividendYield: null, bondYield: 2 } }), record(1, { dates: { index: dates[1], bond: dates[2] } }), record(2, { recordDate: null })]);
  assert.equal(result.coverage.usableSamples, 0);
  for (const reason of ['指标缺失或无效', '指标日期未对齐', '输入晚于记录日期', '记录日期缺失']) assert.equal(result.coverage.reasonCounts[reason], 1);
  assert.ok(result.rows.every(row => row.observation === null));
});

test('duplicate valuation dates retain the earliest collection and retired source labels do not split groups', () => {
  const result = run([record(0, { recordDate: dates[2] }), record(0), record(1, { sourceKey: '理杏仁公开页面' })]);
  assert.equal(result.coverage.duplicates, 1);
  assert.equal(result.rows[0].availableDate, dates[0]);
  assert.equal(result.referenceSummary.length, 1);
  assert.deepEqual(Object.keys(result.rows[0].components), ['absolute', 'ratio']);
});

test('current parameters recompute grades without mutating data or configuration', () => {
  const input = [record()]; const strategy = structuredClone(DIVIDEND_DEFAULT_STRATEGY); strategy.thresholds.A = 61;
  const original = JSON.stringify(input);
  assert.equal(run(input).rows[0].grade, 'B');
  assert.equal(run(input, prices, strategy).rows[0].grade, 'A');
  assert.equal(JSON.stringify(input), original);
  assert.equal(DIVIDEND_DEFAULT_STRATEGY.thresholds.A, 65);
});

test('two components retain missing and zero values and expose independent sort controls', () => {
  const result = run([record(), record(1, { input: { dividendYield: 5 } }), record(2, { input: { dividendYield: 0, bondYield: 3 } }), record(89)]);
  assert.equal(result.rows[0].components.absolute.score, 60);
  assert.equal(result.rows[0].components.ratio.score, 80);
  assert.equal(result.rows[0].score, 61.6);
  assert.equal(result.rows[1].score, null);
  assert.equal(result.rows[2].score, 0);
  const html = renderDividendBacktest(result);
  for (const name of ['绝对股息率', '股债倍数']) {
    assert.ok(html.includes(`aria-label="按${name}指标值升序排序"`));
    assert.ok(html.includes(`aria-label="按${name}得分升序排序"`));
  }
  assert.match(html, /绝对股息率得分 × 92%/);
  assert.doesNotMatch(html, /历史分位|percentile|NaN|undefined/);
});

test('Excel adapter reads source metrics, supports date formats and preserves row identifiers', () => {
  const headers = ['run_date__record_date', 'index_date__index_valuation_date', 'akshare_dividend_yield_2', 'bond_10y_yield', 'bond_date__china_10y_yield_date', 'lixinger_percentile_10y', 'lixinger_date__percentile_source_date', 'lixinger_source'];
  const payload = dividendWorkbookPayload([headers, ['中文表头'], [], ['2026/1/1', '2026/1/1', '5', '2', '2026/1/1', '70', '2026/1/1', '来源']], prices);
  assert.equal(payload.records[0].workbookRow, 4);
  assert.equal(Object.hasOwn(payload.records[0].input, 'percentile'), false);
  assert.equal(payload.records[0].dates.index, dates[0]);
  assert.equal(runDividendBacktest(payload, prices, DIVIDEND_DEFAULT_STRATEGY).rows[0].grade, 'B');
  const blank = dividendWorkbookPayload([headers, [], ['2026/1/1', '2026/1/1', '', 0, '2026/1/1', '', '2026/1/1', '来源']], prices);
  assert.equal(blank.records[0].input.dividendYield, null);
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
  assert.equal((details.match(/<th\b/g) ?? []).length, 11);
  const detailRows = details.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g);
  assert.equal(detailRows.length, records.length);
  assert.ok(detailRows.every(row => (row.match(/<td\b/g) ?? []).length === 11));
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


test('result prioritizes six readable columns while retaining sample diagnostics and definitions', () => {
  const result = run([record(), record(1), record(88), record(89)]);
  const html = renderDividendBacktest(result);
  const table = html.match(/<table[^>]+aria-label="各等级信号后续表现"[\s\S]*?<\/table>/)[0];
  assert.equal((table.match(/scope="col"/g) ?? []).length, 6);
  assert.match(table, /计入收益 \/ 全部/);
  assert.match(table, /2 \/ 4/);
  assert.match(table, /2 条待观察/);
  assert.match(html, /怎么看这张表？/);
  assert.match(html, /它不等于最终亏损/);
  assert.match(html, /仅使用股息率与股债倍数/);
  assert.match(html, /等级与评分口径/);
  assert.match(html, /股息率与股债倍数/);
  assert.doesNotMatch(html, /中证官方指数推算/);
  assert.match(html, /平均收益不代表策略资金收益/);
  assert.match(html, /<details[^>]*><summary>样本与数据检查/);
  assert.match(html, /<details class="dividend-backtest-details"><summary>逐条信号/);
});

test('result preserves unknown returns and escapes source labels instead of inventing outcomes', () => {
  const result = run([record(89, {sourceKey: '<img src=x onerror=alert(1)>'})]);
  const html = renderDividendBacktest(result);
  const table = html.match(/<table[^>]+aria-label="各等级信号后续表现"[\s\S]*?<\/table>/)[0];
  assert.match(table, /0 \/ 1/);
  assert.match(table, /1 条待观察/);
  assert.doesNotMatch(table, /0\.00%|<img/);
  assert.doesNotMatch(table, /onerror/);
  assert.match(table, /data-label="平均收益"[^>]*>—/);
  const excluded = renderDividendBacktest(run([record(1, {input: {}})]));
  assert.match(excluded, /没有满足日期、来源与输入要求的样本/);
  assert.doesNotMatch(excluded, /NaN|undefined|Infinity/);
});

test('signal sorting uses real numeric values, keeps missing values last in both directions and is stable', () => {
  const rows = [
    { workbookRow: 10, score: 9, observation: { returnPct: -12.5 } },
    { workbookRow: 2, score: 100, observation: { returnPct: 0 } },
    { workbookRow: 3, score: 9, observation: { returnPct: 5 } },
    { workbookRow: 4, score: null, observation: { returnPct: null } },
    { workbookRow: 5, score: NaN },
  ];
  const original = structuredClone(rows);
  const order = (key, direction) => sortDividendBacktestRows(rows, { key, direction }).map(row => row.workbookRow);
  assert.deepEqual(order('workbookRow', 'asc'), [2, 3, 4, 5, 10]);
  assert.deepEqual(order('score', 'asc'), [10, 3, 2, 4, 5]);
  assert.deepEqual(order('score', 'desc'), [2, 10, 3, 4, 5]);
  assert.deepEqual(order('returnPct', 'asc'), [10, 2, 3, 4, 5]);
  assert.deepEqual(order('returnPct', 'desc'), [3, 2, 10, 4, 5]);
  assert.deepEqual(sortDividendBacktestRows(rows, { key: '__proto__' }), rows);
  assert.deepEqual(rows, original);
});

test('date, grade, status, drawdown and each component value/score can be sorted independently', () => {
  const rows = [
    { id: 1, date: '2026-02-01', grade: 'A', reasons: [], observation: { drawdownPct: -2, status: '已完成' } },
    { id: 2, date: '2026-01-02', grade: 'D', reasons: ['未纳入'], observation: { drawdownPct: -10, status: '待观察' } },
    { id: 3, date: '', grade: '', reasons: [] },
  ];
  for (const key of ['absolute', 'ratio']) {
    rows[0].components = { ...rows[0].components, [key]: { value: 10, score: 20 } };
    rows[1].components = { ...rows[1].components, [key]: { value: 2, score: 90 } };
    assert.deepEqual(sortDividendBacktestRows(rows, { key: `${key}.value` }).map(row => row.id), [2, 1, 3]);
    assert.deepEqual(sortDividendBacktestRows(rows, { key: `${key}.score` }).map(row => row.id), [1, 2, 3]);
  }
  for (const key of ['date', 'grade', 'drawdownPct']) {
    assert.deepEqual(sortDividendBacktestRows(rows, { key }).map(row => row.id), [2, 1, 3]);
    assert.deepEqual(sortDividendBacktestRows(rows, { key, direction: 'desc' }).map(row => row.id), [1, 2, 3]);
  }
  const statuses = sortDividendBacktestRows(rows, { key: 'status' }).map(row => row.reasons.join('；') || row.observation?.status);
  assert.deepEqual(statuses.slice(0, 2), ['已完成', '未纳入'].sort((a, b) => a.localeCompare(b, 'zh-CN')));
  assert.equal(statuses[2], undefined);
});

test('signal table moves calculation dates to the end, aligns data and exposes current sort direction', () => {
  const result = run([record(), record(1), record(89)]);
  const html = renderDividendBacktestSignalTable(result, { key: 'returnPct', direction: 'desc' });
  const headers = html.match(/<thead>([\s\S]*?)<\/thead>/)[1];
  assert.match(headers, /<th scope="col">收益计算区间<\/th><\/tr>$/);
  assert.equal((headers.match(/data-dividend-signal-sort=/g) ?? []).length, 13);
  assert.equal((headers.match(/aria-sort=/g) ?? []).length, 1);
  assert.match(headers, /aria-sort="descending"[^>]*><button[^>]*data-dividend-signal-sort="returnPct"/);
  assert.match(headers, /aria-label="按信号后收益升序排序"/);
  assert.match(headers, /场外买入/);
  assert.match(headers, /指数收盘参考/);
  const bodyRows = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g);
  const expected = sortDividendBacktestRows(result.rows, { key: 'returnPct', direction: 'desc' });
  bodyRows.forEach((row, index) => {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(match => match[1]);
    const observation = expected[index].observation ?? {};
    assert.equal(cells.length, 11);
    assert.ok(cells[1].includes(expected[index].date));
    assert.equal(cells[5], observation.entryDate || '—');
    assert.ok(cells[6].startsWith(Number.isFinite(observation.entryClose) ? observation.entryClose.toFixed(2) + ' 点' : '—'));
    assert.ok(cells[6].includes('较前日 '));
    assert.equal(cells[10], observation.entryDate ? `${observation.entryDate} ～ ${observation.exitDate}` : '—');
  });
});


test('hypothetical buy date sorts chronologically with missing dates last', () => {
  const rows = [{ id: 'missing' }, { id: 'later', observation: { entryDate: '2026-07-01' } }, { id: 'earlier', observation: { entryDate: '2026-06-30' } }];
  assert.deepEqual(sortDividendBacktestRows(rows, { key: 'entryDate', direction: 'asc' }).map(r => r.id), ['earlier', 'later', 'missing']);
  assert.deepEqual(sortDividendBacktestRows(rows, { key: 'entryDate', direction: 'desc' }).map(r => r.id), ['later', 'earlier', 'missing']);
});


test('hypothetical buy price sorts by unrounded numeric close and leaves missing values last', () => {
 const rows = [{id:'missing'}, {id:'ten', observation:{entryClose:10}}, {id:'two', observation:{entryClose:2}}, {id:'near', observation:{entryClose:2.001}}];
 assert.deepEqual(sortDividendBacktestRows(rows,{key:'entryClose',direction:'asc'}).map(r=>r.id), ['two','near','ten','missing']);
 assert.deepEqual(sortDividendBacktestRows(rows,{key:'entryClose',direction:'desc'}).map(r=>r.id), ['ten','near','two','missing']);
 const html = renderDividendBacktestSignalTable({rows:[]});
 assert.ok(html.indexOf('data-dividend-signal-sort="entryDate"') < html.indexOf('data-dividend-signal-sort="entryClose"'));
 assert.ok(html.indexOf('data-dividend-signal-sort="entryClose"') < html.indexOf('data-dividend-signal-sort="returnPct"'));
});


test('buy-day change uses previous session close, preserving losses, zero and missing history', () => {
  const points = prices.map(p => ({...p}));
  points[1].close = 98;
  const negative = run([record(), record(6)], points).rows[0].observation;
  assert.ok(Math.abs(negative.entryChangePct + 2) < 1e-10);
  points[1].close = 100;
  assert.equal(run([record(), record(6)], points).rows[0].observation.entryChangePct, 0);
  const missing = run([record(), record(6)], points.slice(1)).rows[0].observation;
  assert.equal(missing.status, '已完成');
  assert.equal(missing.entryChangePct, null);
  const html = renderDividendBacktestSignalTable(run([record(), record(6)], points.slice(1)));
  assert.match(html, /较前日 —/);
});

test('signal rows expose bounded grade styling while keeping unknown values safe', () => {
  const rows = ['A', 'B', 'C', 'D', 'unexpected'].map(grade => ({ grade, reasons: [] }));
  const html = renderDividendBacktestSignalTable({ rows });
  for (const grade of ['A', 'B', 'C', 'D', 'unknown']) assert.ok(html.includes(`data-signal-grade="${grade}"`));
  assert.equal((html.match(/class="dividend-grade-label"/g) ?? []).length, 5);
});

test('two-factor backtest ignores inactive percentile dates and groups historical source labels together', () => {
  const strategy = structuredClone(DIVIDEND_DEFAULT_STRATEGY);
  strategy.weights = { percentile: 0, absolute: 92, ratio: 8 };
  const input = [record(0, { dates: { index: dates[0], bond: dates[0], percentile: dates[20] }, sourceKey: '' }), record(1, { dates: { index: dates[1], bond: dates[1] }, input: { dividendYield: 5, bondYield: 2 }, sourceKey: '理杏仁公开页面' })];
  const result = run(input, prices, strategy);
  assert.equal(result.coverage.usableSamples, 2);
  assert.equal(result.referenceSummary.length, 1);
  assert.equal(result.referenceSummary[0].sourceKey, '股息率与股债倍数');
  assert.match(renderDividendBacktest(result), /等级与评分口径/);
  assert.doesNotMatch(renderDividendBacktest(result), /历史分位/);
  assert.ok(result.rows.every(r => r.reasons.length === 0));
});
