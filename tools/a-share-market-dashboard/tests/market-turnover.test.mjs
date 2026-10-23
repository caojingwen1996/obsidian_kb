import test from 'node:test';
import assert from 'node:assert/strict';
import { marketTurnoverRequestError, parseMarketTurnover, renderMarketTurnoverCard } from '../src/app.mjs';

const payload = {
  scope: '沪深股票', unit: '亿元', startDate: '2025-09-04', today: '2026-09-04',
  points: [{ date: '2026-09-03', amount: 17606.91 }, { date: '2025-09-04', amount: 22000 }],
};

test('turnover displays the actionable API error and escapes it in the card', () => {
  const error = marketTurnoverRequestError({ source: 'tushare-token', error: '请设置 TUSHARE_TOKEN <提示>' }, 503);
  assert.equal(error, '请设置 TUSHARE_TOKEN <提示>');
  assert.match(renderMarketTurnoverCard({ status: 'missing', error }), /TUSHARE_TOKEN &lt;提示&gt;/);
  for (const missing of [null, {}, { error: '' }, { error: '  ' }, { error: 1 }]) {
    assert.equal(marketTurnoverRequestError(missing, 502), '成交额加载失败：HTTP 502');
  }
});

test('turnover validates units, scope, dates and positive values before sorting', () => {
  const data = parseMarketTurnover({ ...payload, points: [...payload.points,
    { date: '2025-09-03', amount: 90000 }, { date: '2026-09-05', amount: 90000 },
    { date: '2026-02-30', amount: 90000 }, { date: '2026-09-02', amount: null },
    { date: '2026-09-02', amount: 0 }, { date: '2026-09-02', amount: Infinity },
  ] });
  assert.deepEqual(data.points.map(p => p.date), ['2025-09-04', '2026-09-03']);
  assert.throws(() => parseMarketTurnover({ ...payload, unit: '千元' }));
  assert.throws(() => parseMarketTurnover({ ...payload, scope: '中证全指' }));
  assert.throws(() => parseMarketTurnover({ ...payload, points: [] }));
});

test('turnover displays the latest completed trading day with its curve and extrema', () => {
  const html = renderMarketTurnoverCard({ status: 'latest', data: parseMarketTurnover(payload) });
  assert.match(html, /最近交易日成交额 · 2026-09-03<\/small><strong>17,606.91/);
  assert.match(html, /截至前一天 · 已发布日度统计/);
  assert.doesNotMatch(html, /今日成交额|待更新|日度数据尚未发布/);
  assert.match(html, /近一年最高<\/small><strong>22,000/);
  assert.match(html, /近一年最低<\/small><strong>17,606.91/);
  assert.match(html, /<svg/);
  assert.match(html, /type="range" min="0" max="1"/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('turnover excludes even published current-day values from the headline, curve, slider and extrema', () => {
  const data = parseMarketTurnover({ ...payload, points: [...payload.points, { date: payload.today, amount: 99999 }] });
  assert.equal(data.points.length, 2);
  const html = renderMarketTurnoverCard({ status: 'latest', data });
  assert.match(html, /最近交易日成交额 · 2026-09-03<\/small><strong>17,606.91/);
  assert.match(html, /近一年最高<\/small><strong>22,000/);
  assert.match(html, /type="range" min="0" max="1" value="1"/);
  assert.doesNotMatch(html, /2026-09-04|99,999/);
  assert.throws(() => parseMarketTurnover({ ...payload, points: [{ date: payload.today, amount: 99999 }] }), /截至前一天暂无有效/);
});

test('turnover falls back to Friday on a weekend and handles a one-point chart', () => {
  const data = parseMarketTurnover({ ...payload, today: '2026-09-06', points: [{ date: '2026-09-04', amount: 12345.67 }] });
  const html = renderMarketTurnoverCard({ status: 'latest', data });
  assert.match(html, /最近交易日成交额 · 2026-09-04<\/small><strong>12,345.67/);
  assert.match(html, /已发布日度统计/);
  assert.match(html, /type="range" min="0" max="0" value="0"/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('turnover loading, missing and failed-refresh states disclose gaps', () => {
  assert.match(renderMarketTurnoverCard(), /正在加载/);
  assert.match(renderMarketTurnoverCard({ status: 'missing', error: '<timeout>' }), /&lt;timeout&gt;/);
  const html = renderMarketTurnoverCard({ status: 'missing', error: 'HTTP 502', data: { ...parseMarketTurnover(payload), incompleteDays: 2 } });
  assert.match(html, /2 日缺少单边数据，已排除/);
  assert.match(html, /刷新失败，保留上次结果：HTTP 502/);
});
