import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dividendBuyPointGrade, renderDividendYieldChart } from '../src/app.mjs';

function chartPlot(html, layout) {
  const svg = html.match(new RegExp(`<svg[^>]+data-chart-layout="${layout}"[^>]*>[\\s\\S]*?<\\/svg>`))?.[0];
  assert.ok(svg, `${layout} chart exists`);
  return svg;
}

test('buy points use only explicit A/B conclusions and exact historical buy labels', () => {
  for (const text of ['A', ' A（重点买入） ', 'A · 重点买入', '重点买入']) {
    assert.equal(dividendBuyPointGrade(text), 'A', text);
  }
  for (const text of ['B', 'B(加大买入)', 'B：加大买入', '加大买入', '加大买入区间']) {
    assert.equal(dividendBuyPointGrade(text), 'B', text);
  }
  for (const text of ['', null, 'C（小额定投）', 'D', '吸引力偏弱', '未进入加大买入区间',
    '历史分位点待验证，暂不判定加大买入区间', '待验证 A', 'AB', 'BUY']) {
    assert.equal(dividendBuyPointGrade(text), '', String(text));
  }
});

test('chart places every A/B point on the index line using the price axis, not the yield axis', () => {
  const html = renderDividendYieldChart([
    { date: '2026-10-03', value: 4, headline: 'C（小额定投）' },
    { date: '2026-10-02', value: 5, headline: 'B（加大买入）' },
    { date: '2026-10-01', value: 6, headline: 'A（重点买入）' },
    { date: '2026-10-04', value: 'invalid', headline: 'A' },
  ], [
    { date: '2026-10-03', close: 300 },
    { date: '2026-10-01', close: 100 },
    { date: '2026-10-02', close: 200 },
  ]);
  const markers = [...chartPlot(html, 'desktop').matchAll(/<circle class="dividend-buy-point[^>]+>/g)].map(match => match[0]);
  assert.equal(markers.length, 2);
  assert.match(markers[0], /data-buy-date="2026-10-01" data-buy-grade="A" data-buy-close="100" cx="78.0" cy="237.0"/);
  assert.match(markers[1], /data-buy-date="2026-10-02" data-buy-grade="B" data-buy-close="200" cx="460.0" cy="172.0"/);
  assert.match(html, /class="dividend-index-line" d="M78.00,237.00 L460.00,172.00 L842.00,107.00"/);
  assert.match(html, /class="dividend-yield-line" d="M78.00,79.14/);
  assert.match(html, /指数 100 点 · 股息率 6%/);
  assert.match(html, /中证红利指数（左轴）/);
  assert.match(html, /股息率（右轴）/);
  assert.match(html, /2 个买点/);
  assert.match(html, /买点 A · 综合结论：A（重点买入）/);
  assert.match(html, /买点 B · 综合结论：B（加大买入）/);
  assert.match(html, /买点 B · 加大买入<\/text>/);
  assert.match(html, /dividend-hover-tooltip[\s\S]*height="80"/);
  assert.ok(html.indexOf('dividend-buy-markers') < html.indexOf('dividend-hover-hit'));
});

test('missing conclusions, C/D and unverified conclusions never create buy markers', () => {
  const html = renderDividendYieldChart([
    { date: '2026-10-01', value: 4.2, absoluteSignal: 'A', compositeGrade: 'A' },
    { date: '2026-10-02', value: 4.3, headline: '未进入加大买入区间' },
    { date: '2026-10-03', value: 4.4, headline: '历史分位点待验证，暂不判定加大买入区间' },
  ]);
  assert.doesNotMatch(html, /<circle class="dividend-buy-point/);
  assert.match(html, /0 个买点/);
  assert.match(renderDividendYieldChart([]), /暂无可绘制/);
  const single = renderDividendYieldChart([{ date: '2026-10-01', value: 4.2, headline: 'A' }],
    [{ date: '2026-10-01', close: 100 }]);
  assert.match(single, /1 个买点/);
  assert.doesNotMatch(single, /NaN|Infinity/);
});

test('missing prices never move buy markers to the yield line or a neighbouring trading day', () => {
  const points = [
    { date: '2026-10-01', value: 4.2, headline: 'A' },
    { date: '2026-10-02', value: 4.3, headline: 'B' },
    { date: '2026-10-03', value: 4.4, headline: 'B' },
  ];
  const html = renderDividendYieldChart(points, [
    { date: '2026-10-01', close: 100 }, { date: '2026-10-03', close: null },
    { date: '2026-10-02', close: 0 }, { date: '2026-10-03', close: 'invalid' },
  ]);
  for (const layout of ['desktop', 'mobile']) {
    assert.equal((chartPlot(html, layout).match(/<circle class="dividend-buy-point/g) ?? []).length, 1);
  }
  assert.match(html, /2 条因当日指数点位缺失未标记/);
  assert.doesNotMatch(html, /data-buy-date="2026-10-0[23]"/);
  const missing = renderDividendYieldChart(points);
  assert.doesNotMatch(missing, /<circle class="dividend-buy-point|<path class="dividend-index-line"/);
  assert.match(missing, /指数点位暂缺/);
  assert.match(missing, /0 个买点/);
});

test('mobile chart keeps exact series and price-axis buy points with readable geometry', () => {
  const html = renderDividendYieldChart([
    { date: '2026-10-01', value: 6, headline: 'A' },
    { date: '2026-10-02', value: 5, headline: 'B' },
    { date: '2026-10-03', value: 4, headline: 'C' },
  ], [
    { date: '2026-10-01', close: 100 },
    { date: '2026-10-02', close: 200 },
    { date: '2026-10-03', close: 300 },
  ]);
  const mobile = chartPlot(html, 'mobile');
  assert.match(mobile, /viewBox="0 0 360 300"/);
  assert.match(mobile, /class="dividend-index-line" d="M58.00,202.50 L179.00,147.00 L300.00,91.50"/);
  assert.match(mobile, /data-buy-date="2026-10-01" data-buy-grade="A" data-buy-close="100" cx="58.0" cy="202.5"/);
  assert.match(mobile, /data-buy-date="2026-10-02" data-buy-grade="B" data-buy-close="200" cx="179.0" cy="147.0"/);
  assert.doesNotMatch(mobile, /data-buy-date="2026-10-03"|rotate\(/);
  for (const date of ['2026-10-01', '2026-10-02', '2026-10-03']) assert.match(mobile, new RegExp(date));
  assert.doesNotMatch(mobile, /NaN|Infinity/);
});

test('mobile date labels remain sparse and tooltips stay inside the plot at both edges', () => {
  const points = Array.from({ length: 31 }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, '0')}`, value: 4 + index / 30, headline: 'B' }));
  const html = renderDividendYieldChart(points, points.map((point, index) => ({ date: point.date, close: 100 + index })));
  const mobile = chartPlot(html, 'mobile');
  assert.equal((mobile.match(/class="x-label"/g) ?? []).length, 4);
  assert.equal((mobile.match(/class="dividend-hover-point"/g) ?? []).length, 31);
  assert.equal((mobile.match(/<circle class="dividend-buy-point/g) ?? []).length, 31);
  for (const match of mobile.matchAll(/class="dividend-hover-tooltip" transform="translate\(([\d.]+) ([\d.]+)\)"/g)) {
    const x = Number(match[1]), y = Number(match[2]);
    assert.ok(x >= 0 && x + 200 <= 360);
    assert.ok(y >= 0 && y + 100 <= 300);
  }
});

test('both series share date coordinates and retain index days without a yield record', () => {
  const html = renderDividendYieldChart([
    { date: '2026-10-01', value: 6, headline: 'A' },
    { date: '2026-10-03', value: 4, headline: 'B' },
  ], [
    { date: '2026-09-30', close: 9999 },
    { date: '2026-10-01', close: 100 },
    { date: '2026-10-02', close: 200 },
    { date: '2026-10-03', close: 300 },
    { date: '2026-10-04', close: 9999 },
  ]);
  assert.match(html, /class="dividend-index-line" d="M78.00,237.00 L460.00,172.00 L842.00,107.00"/);
  assert.match(html, /2026-10-02 · 指数 200 点 · 股息率 —/);
  assert.match(html, /最新指数点位<\/small><strong>300<\/strong>/);
  assert.doesNotMatch(html, /9999|NaN|Infinity/);
});

test('built dashboard retains workbook conclusions in its historical chart data', () => {
  const artifact = readFileSync(new URL('../a-share-market-dashboard.html', import.meta.url), 'utf8');
  const runtime = artifact.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const points = new Function(`${runtime}\nreturn CSI_DIVIDEND_YIELD_HISTORY;`)();
  const indexPoints = new Function(`${runtime}\nreturn CSI_DIVIDEND_INDEX_HISTORY;`)();
  assert.ok(points.length > 0);
  assert.ok(points.every(point => typeof point.headline === 'string'));
  assert.ok(points.some(point => point.headline.length > 0));
  assert.ok(indexPoints.length > 0);
  const html = renderDividendYieldChart(points, indexPoints);
  assert.match(html, /class="dividend-index-line"/);
  assert.match(html, /class="dividend-yield-line"/);
  const closes = new Map(indexPoints.map(point => [point.date, point.close]));
  const expectedBuyPoints = points.filter(point => dividendBuyPointGrade(point.headline) && closes.has(point.date));
  for (const layout of ['desktop', 'mobile']) {
    const markers = chartPlot(html, layout).match(/<circle class="dividend-buy-point/g) ?? [];
    assert.equal(markers.length, expectedBuyPoints.length);
  }
  for (const match of html.matchAll(/data-buy-date="([^"]+)" data-buy-grade="[AB]" data-buy-close="([^"]+)"/g)) {
    assert.equal(Number(match[2]), closes.get(match[1]));
  }
});
