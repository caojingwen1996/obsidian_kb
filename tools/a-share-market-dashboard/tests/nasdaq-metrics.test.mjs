import test from 'node:test';
import assert from 'node:assert/strict';
import { renderNasdaq100Card } from '../src/app.mjs';

test('Nasdaq card shows calendar returns and valuation gaps without fabricated zeros', () => {
  const html = renderNasdaq100Card({ status: 'latest', data: {
    currentPoint: 110, highPoint: 120, drawdownPercent: -8.33,
    dayChangePercent: 0, weekChangePercent: -2, monthChangePercent: 3,
    ma200: 100, ma200DeviationPercent: 10, yearDrawdownPercent: -5,
    marketDate: '2026-09-10', updatedText: '2026-09-11 04:00',
  } });
  for (const expected of ['当日涨跌', '0.00%', '-2.00%', '+3.00%', 'PE-TTM：待验证',
    '近10年分位：待验证', '200日均线：100点', '2026年内当前回撤：-5.00%', 'data-open-nasdaq-grid']) {
    assert.ok(html.includes(expected), expected);
  }
});
