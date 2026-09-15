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
