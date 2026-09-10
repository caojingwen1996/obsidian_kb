import test from 'node:test';
import assert from 'node:assert/strict';
import { fundamentalStatusToneClass } from '../src/app.mjs';

test('uses overall fundamentals rather than a positive individual metric', () => {
  assert.equal(fundamentalStatusToneClass('现金流：改善；综合：走弱；利润增长'), 'is-weakening');
  assert.equal(fundamentalStatusToneClass('综合：改善（报告期）；存量为6月末'), 'is-improving');
  assert.equal(fundamentalStatusToneClass('基本面状态：稳定；现金流下降'), 'is-stable');
});

test('qualified or missing conclusions remain pending', () => {
  assert.equal(fundamentalStatusToneClass('改善但待确认：利润增长'), 'is-pending');
  assert.equal(fundamentalStatusToneClass('现金流改善，净负债扩大'), 'is-pending');
  assert.equal(fundamentalStatusToneClass('未获取到'), 'is-pending');
  assert.equal(fundamentalStatusToneClass(''), 'is-pending');
});
