import test from 'node:test';
import assert from 'node:assert/strict';
import { riskIndicatorRows, renderRiskIndicatorTable } from '../src/risk-indicators.mjs';

test('indicator groups follow the eight macro risk sources with scoped observations', () => {
  const groups = { macro: '经济增长风险', commodity: '通胀与供给风险', money: '货币政策风险', fiscal: '财政与主权债务风险', credit: '信用与金融体系风险', capital: '汇率与跨境资本风险', structure: '市场结构与资金供需风险', event: '地缘政治与政策事件风险' };
  for (const [id, name] of Object.entries(groups)) {
    const rows = riskIndicatorRows(id, 'demo');
    assert.equal(rows.length, 4);
    assert.ok(rows.every(row => row.category === name && row.scope && row.provider && row.period && row.previousPeriod));
    assert.equal(new Set(rows.map(row => row.name)).size, 4);
  }
  assert.deepEqual(riskIndicatorRows('unknown'), []);
});

test('example differences use basis points or percentage points correctly, including negative values', () => {
  const money = riskIndicatorRows('money', 'demo');
  assert.equal(money[0].change, '+25 bp');
  assert.equal(money[1].change, '+22 个百分点');
  assert.equal(money[3].change, '0 bp');
  assert.equal(riskIndicatorRows('credit', 'demo')[0].change, '-0.3 个百分点');
  assert.equal(riskIndicatorRows('structure', 'demo')[3].change, '-245 亿元');
  const event = riskIndicatorRows('event', 'demo')[1];
  assert.equal(event.quantitative, false);
  assert.equal(event.change, '范围扩大');
});

test('example observations and dates never appear in monitoring mode', () => {
  for (const mode of [undefined, 'monitor', 'unknown']) {
    for (const id of ['macro', 'commodity', 'money', 'fiscal', 'credit', 'capital', 'structure', 'event']) {
      assert.ok(riskIndicatorRows(id, mode).every(row => !row.demo && row.latest === '待接入' && row.previous === '—' && row.change === '—' && row.period === '待接入' && row.previousPeriod === '—'));
      assert.doesNotMatch(renderRiskIndicatorTable(id, mode), /2026-/);
    }
  }
  assert.match(renderRiskIndicatorTable('money', 'demo'), /虚构数据/);
  assert.match(renderRiskIndicatorTable('money', 'demo'), /拟接入来源/);
});

test('disabled Wind observations are ignored rather than shown as current readings', () => {
  const data = {'pending-money-0': {value: 4, previous: 4.25, unit: '%', date: '2026-09-17', previousDate: '2026-06-18', status: 'stale', error: 'Wind积分不足（402）', fetchedAt: '2026-11-06T01:00:00Z'},
    'pending-structure-3': {value: 0, previous: null, date: '2026-11-05', status: 'ok', unit: '亿元'}};
  const rows = riskIndicatorRows('money', 'monitor', data);
  assert.equal(rows[0].change, '—');
  assert.equal(rows[0].period, '待接入');
  assert.equal(rows[3].latest, '待接入');
  const etf = riskIndicatorRows('structure', 'monitor', data)[3];
  assert.equal(etf.latest, '待接入');
  assert.equal(etf.previous, '—');
  assert.match(etf.scope, /份额变化×净值/);
  const html = renderRiskIndicatorTable('money', 'monitor', data);
  assert.doesNotMatch(html, /402|2026-09-17|2026-11-06/);
  assert.doesNotMatch(renderRiskIndicatorTable('money', 'demo', data), /402/);
});
