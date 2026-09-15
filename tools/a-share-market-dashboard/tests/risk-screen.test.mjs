import test from 'node:test';
import assert from 'node:assert/strict';
import { riskSourceRows, riskSourceReadings } from '../src/risk-screen.mjs';

test('monitoring never inherits example scores, directions or asserted drivers', () => {
  for (const mode of [undefined, 'monitor', 'unexpected']) {
    const rows = riskSourceRows(mode);
    assert.equal(rows.length, 8);
    assert.equal(new Set(rows.map(row => row.id)).size, 8);
    assert.ok(rows.every(row => row.score === null && row.trend === null && row.accel === null));
    assert.equal(rows.find(row => row.id === 'capital').driver, '汇率与跨境资金');
  }
});

test('explicit design mode retains user numbers, ranks descending and does not rewrite conflicting directions', () => {
  const demo = riskSourceRows('demo');
  assert.deepEqual(demo.map(row => row.score), [91, 86, 84, 79, 77, 73, 62, 58]);
  assert.deepEqual(demo.slice(0, 3).map(row => row.id), ['money', 'commodity', 'structure']);
  assert.equal(demo.at(-1).trend, '↓');
  assert.equal(demo.at(-1).accel, 3);
  assert.ok(riskSourceRows().every(row => row.score === null));
});

test('all source paths have indicators, counterevidence and the four secondary-market dimensions', () => {
  for (const row of riskSourceRows()) {
    assert.ok(row.nodes.length > 1);
    assert.ok(row.nodes.every(node => node.length === 5 && node.every(value => typeof value === 'string' && value.length > 0)));
    assert.deepEqual(row.impact.map(item => item[0]).sort(), ['基本面', '流动性', '估值', '情绪'].sort());
    assert.equal(row.events.length, 4);
    assert.ok(row.assets.every(asset => asset[2].length > 0));
  }
});

test('snapshots reject examples, expired or missing data, undated readings and non-numeric values', () => {
  const entry = { value: 4.96, date: '2026-09-11', status: 'fresh' };
  assert.equal(riskSourceReadings({ usTreasury10y: entry })[0].text, '4.96%');
  for (const status of ['example', 'expired', 'missing', 'error']) {
    assert.equal(riskSourceReadings({ usTreasury10y: { ...entry, status } })[0].value, null);
  }
  assert.equal(riskSourceReadings({ label: '示例', usTreasury10y: entry })[0].value, null);
  assert.equal(riskSourceReadings({ usTreasury10y: { ...entry, date: null } })[0].value, null);
  for (const value of [null, undefined, NaN, Infinity, '4.96']) {
    assert.equal(riskSourceReadings({ usTreasury10y: { ...entry, value } })[0].value, null);
  }
  const failure = riskSourceReadings({ usdJpy: { status: 'missing', errors: ['upstream returned empty'] } })[2];
  assert.deepEqual(failure.errors, ['upstream returned empty']);
  assert.equal(failure.note, '数据缺失');
});
