import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMarketTurnover, renderMarketTurnoverCard } from '../src/app.mjs';

const payload = {
  scope: '沪深股票', unit: '亿元', startDate: '2025-09-04', today: '2026-09-04',
  points: [{ date: '2026-09-03', amount: 17606.91 }, { date: '2025-09-04', amount: 22000 }],
};

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

test('turnover renders a year curve and extrema without presenting yesterday as today', () => {
  const html = renderMarketTurnoverCard({ status: 'latest', data: parseMarketTurnover(payload) }, '2026-09-04');
  assert.match(html, /今日成交额 · 2026-09-04<\/small><strong>待更新/);
  assert.match(html, /最近 2026-09-03：17,606.91/);
  assert.match(html, /近一年最高<\/small><strong>22,000/);
  assert.match(html, /近一年最低<\/small><strong>17,606.91/);
  assert.match(html, /<svg/);
  assert.match(html, /type="range" min="0" max="1"/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('turnover uses today only when dated today and handles a flat one-point chart', () => {
  const data = parseMarketTurnover({ ...payload, points: [{ date: '2026-09-04', amount: 12345.67 }] });
  const html = renderMarketTurnoverCard({ status: 'latest', data }, '2026-09-04');
  assert.match(html, /今日成交额 · 2026-09-04<\/small><strong>12,345.67/);
  assert.match(html, /已发布日度统计/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('turnover loading, missing and failed-refresh states disclose gaps', () => {
  assert.match(renderMarketTurnoverCard(), /正在加载/);
  assert.match(renderMarketTurnoverCard({ status: 'missing', error: '<timeout>' }), /&lt;timeout&gt;/);
  const html = renderMarketTurnoverCard({ status: 'missing', error: 'HTTP 502', data: { ...parseMarketTurnover(payload), incompleteDays: 2 } });
  assert.match(html, /2 日缺少单边数据，已排除/);
  assert.match(html, /刷新失败，保留上次结果：HTTP 502/);
});
