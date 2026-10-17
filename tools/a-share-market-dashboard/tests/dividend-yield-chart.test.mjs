import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dividendBuyPointGrade, renderDividendYieldChart } from '../src/app.mjs';

const point = (date, value, headline, recordDate = date) => ({ date, value, headline, recordDate });
const prices = [
  { date: '2026-10-01', close: 100 },
  { date: '2026-10-02', close: 200 },
  { date: '2026-10-03', close: 300 },
];

function chartPlot(html, layout = 'desktop') {
  const svg = html.match(new RegExp(`<svg[^>]+data-chart-layout="${layout}"[^>]*>[\\s\\S]*?<\\/svg>`))?.[0];
  assert.ok(svg, `${layout} chart exists`);
  return svg;
}

function markers(html, layout = 'desktop') {
  return [...chartPlot(html, layout).matchAll(/<circle class="dividend-buy-point[^>]+>/g)].map(match => match[0]);
}

test('buy points use only composite A conclusions including exact legacy A labels', () => {
  for (const text of ['A', ' A（重点买入） ', 'A · 重点买入', '重点买入', '重点配置区间', '买入区间', 'A · 买入区间']) {
    assert.equal(dividendBuyPointGrade(text), 'A', text);
  }
  for (const text of ['B', 'B(加大买入)', 'B：加大买入', '加大买入', '加大买入区间', '', null,
    'C（小额定投）', 'D', '吸引力偏弱', '未进入加大买入区间', '历史分位点待验证，暂不判定加大买入区间', '待验证 A', 'AB', 'BUY']) {
    assert.equal(dividendBuyPointGrade(text), '', String(text));
  }
});

test('A markers use the next trading close after collection, while curves retain valuation dates', () => {
  const html = renderDividendYieldChart([
    point('2026-10-03', 4, 'C（小额定投）'),
    point('2026-10-02', 5, 'B（加大买入）'),
    point('2026-10-01', 6, 'A（重点买入）'),
    point('2026-10-04', 'invalid', 'A'),
  ], prices);
  const buys = markers(html);
  assert.equal(buys.length, 1);
  assert.match(buys[0], /data-buy-date="2026-10-02" data-buy-grade="A" data-buy-close="200"/);
  assert.match(buys[0], /data-signal-date="2026-10-01" data-record-date="2026-10-01"/);
  assert.match(buys[0], /cx="460.0" cy="172.0"/);
  assert.doesNotMatch(html, /data-buy-grade="B"|买点 B|B 买点|加大买入/);
  assert.match(html, /class="dividend-index-line" d="M78.00,237.00 L460.00,172.00 L842.00,107.00"/);
  assert.match(html, /class="dividend-yield-line" d="M78.00,79.14/);
  assert.match(html, /2026-10-02 · 指数 200 点 · 股息率 5% · （假设）买入日 2026-10-02 · 场外买入 · A级信号估值日 2026-10-01 · 记录日 2026-10-01 · 信号股息率 6%/);
  assert.match(html, /当日股息率 5%<\/text>/);
  assert.match(html, /A估值日 2026-10-01<\/text>/);
  assert.match(html, /A · 场外假设买入点/);
  assert.match(html, /1条A级信号 · 1个假设买入日/);
  assert.ok(html.indexOf('dividend-buy-markers') < html.indexOf('dividend-hover-hit'));
});

test('missing conclusions and non-A grades never buy, and end-of-range signals stay pending', () => {
  const html = renderDividendYieldChart([
    { ...point('2026-10-01', 4.2, ''), absoluteSignal: 'A', compositeGrade: 'A' },
    point('2026-10-02', 4.3, '未进入加大买入区间'),
    point('2026-10-03', 4.4, '历史分位点待验证，暂不判定加大买入区间'),
  ], prices);
  assert.equal(markers(html).length, 0);
  assert.match(html, /0条A级信号 · 0个假设买入日/);
  assert.match(renderDividendYieldChart([]), /暂无可绘制/);
  const single = renderDividendYieldChart([point('2026-10-01', 4.2, 'A')], prices);
  assert.equal(markers(single).length, 0);
  assert.match(single, /1条A级信号 · 0个假设买入日/);
  assert.match(single, /1条尚无区间内下一交易日/);
  assert.doesNotMatch(single, /NaN|Infinity/);
  const inRange = renderDividendYieldChart([point('2026-10-01', 4.2, 'A'), point('2026-10-02', 4.3, 'C')], prices);
  assert.equal(markers(inRange).length, 1);
  assert.match(markers(inRange)[0], /data-buy-date="2026-10-02"/);
});

test('weekends and late collection use the first session strictly after the record date', () => {
  const sessions = [
    { date: '2026-06-18', close: 100 },
    { date: '2026-06-22', close: 110 },
    { date: '2026-06-23', close: 120 },
  ];
  for (const [recordDate, entryDate] of [
    ['2026-06-18', '2026-06-22'], ['2026-06-20', '2026-06-22'], ['2026-06-22', '2026-06-23'],
  ]) {
    const html = renderDividendYieldChart([
      point('2026-06-18', 5.5, 'A', recordDate), point('2026-06-23', 5, 'C'),
    ], sessions);
    assert.equal(markers(html).length, 1);
    assert.match(markers(html)[0], new RegExp(`data-buy-date="${entryDate}"`));
    assert.match(markers(html)[0], new RegExp(`data-record-date="${recordDate}"`));
  }
  for (const recordDate of [null, 'invalid', '2026-06-17']) {
    const html = renderDividendYieldChart([
      point('2026-06-18', 5.5, 'A', recordDate), point('2026-06-23', 5, 'C'),
    ], sessions);
    assert.equal(markers(html).length, 0);
    assert.match(html, /1条记录日期或交易日信息无效/);
  }
});

test('duplicate valuation dates keep the earliest record, including its original non-A grade', () => {
  const source = [
    point('2026-10-01', 6.1, 'A', '2026-10-02'),
    point('2026-10-01', 6, 'A', '2026-10-01'),
    point('2026-10-03', 4, 'C'),
  ];
  const html = renderDividendYieldChart(source, prices);
  assert.equal(markers(html).length, 1);
  assert.match(markers(html)[0], /data-buy-date="2026-10-02"/);
  assert.match(html, /信号股息率 6% · 场外/);
  source[1].headline = 'B';
  assert.equal(markers(renderDividendYieldChart(source, prices)).length, 0);
});

test('signals sharing a purchase day produce one marker and retain every source in the tooltip', () => {
  const html = renderDividendYieldChart([
    point('2026-10-01', 6, 'A', '2026-10-02'),
    point('2026-10-02', 5.5, 'A'),
    point('2026-10-03', 4, 'C'),
  ], prices);
  assert.equal(markers(html).length, 1);
  assert.match(markers(html)[0], /data-buy-date="2026-10-03"/);
  assert.match(markers(html)[0], /data-signal-count="2"/);
  assert.match(html, /2条A级信号 · 1个假设买入日/);
  assert.match(html, /A级信号估值日 2026-10-01[\s\S]*A级信号估值日 2026-10-02/);
  assert.match(html, /另有1条A级信号对应此买入日/);
});

test('missing purchase prices never move markers to a later session or onto the yield line', () => {
  const source = [
    point('2026-10-01', 4.2, 'A'), point('2026-10-02', 4.3, 'A'),
    point('2026-10-03', 4.4, 'A'), point('2026-10-04', 4.5, 'C'),
  ];
  const html = renderDividendYieldChart(source, [
    ...prices.slice(0, 2), { date: '2026-10-03', close: null }, { date: '2026-10-04', close: 0 },
  ]);
  for (const layout of ['desktop', 'mobile']) {
    assert.equal(markers(html, layout).length, 1);
    assert.match(markers(html, layout)[0], /data-buy-date="2026-10-02"/);
  }
  assert.match(html, /2条买入日缺收盘价/);
  const missing = renderDividendYieldChart(source);
  assert.equal(markers(missing).length, 0);
  assert.doesNotMatch(missing, /<path class="dividend-index-line"/);
  assert.match(missing, /指数点位暂缺/);
});

test('mobile chart preserves both curves and puts buy markers at the purchase close', () => {
  const html = renderDividendYieldChart([
    point('2026-10-01', 6, 'A'), point('2026-10-02', 5, 'B'), point('2026-10-03', 4, 'C'),
  ], prices);
  const mobile = chartPlot(html, 'mobile');
  assert.match(mobile, /viewBox="0 0 360 300"/);
  assert.match(mobile, /class="dividend-index-line" d="M58.00,202.50 L179.00,147.00 L300.00,91.50"/);
  assert.match(markers(html, 'mobile')[0], /data-buy-date="2026-10-02" data-buy-grade="A" data-buy-close="200"/);
  assert.match(markers(html, 'mobile')[0], /cx="179.0" cy="147.0"/);
  assert.doesNotMatch(mobile, /data-buy-date="2026-10-0[13]"|data-buy-grade="B"|rotate\(/);
  assert.doesNotMatch(mobile, /NaN|Infinity/);
});

test('mobile labels remain sparse and expanded source-date tooltips stay within the chart', () => {
  const source = Array.from({ length: 31 }, (_, index) => point(`2026-10-${String(index + 1).padStart(2, '0')}`, 4 + index / 30, 'A'));
  const html = renderDividendYieldChart(source, source.map((item, index) => ({ date: item.date, close: 100 + index })));
  const mobile = chartPlot(html, 'mobile');
  assert.equal((mobile.match(/class="x-label"/g) ?? []).length, 4);
  assert.equal((mobile.match(/class="dividend-hover-point"/g) ?? []).length, 31);
  assert.equal(markers(html, 'mobile').length, 30);
  assert.match(html, /1条尚无区间内下一交易日/);
  const tooltips = [...mobile.matchAll(/class="dividend-hover-tooltip" transform="translate\(([\d.]+) ([\d.]+)\)"[^>]*>\s*<rect width="(\d+)" height="(\d+)"/g)];
  assert.equal(tooltips.length, 31);
  for (const match of tooltips) {
    const [x, y, width, height] = match.slice(1).map(Number);
    assert.ok(x >= 0 && x + width <= 360);
    assert.ok(y >= 0 && y + height <= 300);
  }
});

test('purchase dates without a yield record still have markers and source-date tooltips', () => {
  const html = renderDividendYieldChart([
    point('2026-10-01', 6, 'A'), point('2026-10-03', 4, 'B'),
  ], [{ date: '2026-09-30', close: 9999 }, ...prices, { date: '2026-10-04', close: 9999 }]);
  assert.match(markers(html)[0], /data-buy-date="2026-10-02"/);
  assert.match(html, /class="dividend-index-line" d="M78.00,237.00 L460.00,172.00 L842.00,107.00"/);
  assert.match(html, /2026-10-02 · 指数 200 点 · 股息率 — · （假设）买入日 2026-10-02/);
  assert.match(html, /最新指数点位<\/small><strong>300<\/strong>/);
  assert.doesNotMatch(html, /9999|NaN|Infinity/);
});

test('built workbook history retains collection dates and agrees with backtest purchase dates', () => {
  const artifact = readFileSync(new URL('../a-share-market-dashboard.html', import.meta.url), 'utf8');
  const runtime = artifact.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const { source, indexPoints } = new Function(`${runtime}\nreturn {source: CSI_DIVIDEND_YIELD_HISTORY, indexPoints: CSI_DIVIDEND_INDEX_HISTORY};`)();
  assert.ok(source.length > 0);
  assert.ok(source.every(item => typeof item.headline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.recordDate)));
  const html = renderDividendYieldChart(source, indexPoints);
  const ordered = [...source].sort((a, b) => a.recordDate.localeCompare(b.recordDate));
  const earliest = new Map();
  for (const item of ordered) if (!earliest.has(item.date)) earliest.set(item.date, item);
  const bounds = source.map(item => item.date).sort();
  const calendar = [...new Set(indexPoints.map(item => item.date).filter(date => date >= bounds[0] && date <= bounds.at(-1)))].sort();
  const closes = new Map(indexPoints.map(item => [item.date, item.close]));
  const expectedDates = new Set([...earliest.values()].filter(item => dividendBuyPointGrade(item.headline) && item.recordDate >= item.date && calendar.includes(item.date))
    .map(item => calendar.find(date => date > item.recordDate)).filter(date => closes.get(date) > 0));
  for (const layout of ['desktop', 'mobile']) {
    assert.equal(markers(html, layout).length, expectedDates.size);
    for (const marker of markers(html, layout)) {
      const date = marker.match(/data-buy-date="([^"]+)"/)[1];
      assert.ok(expectedDates.has(date));
      assert.equal(Number(marker.match(/data-buy-close="([^"]+)"/)[1]), closes.get(date));
    }
  }
  assert.match(html, /data-buy-date="2026-06-30" data-buy-grade="A" data-buy-close="5022.46" data-signal-date="2026-06-29"/);
  assert.doesNotMatch(html, /data-buy-date="2026-06-18"/);
});
