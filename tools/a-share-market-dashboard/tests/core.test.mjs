import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clamp,
  percentileRank,
  deviationSeries,
  calculatePositionMetric,
  tradingDaysForWindow,
  calculateValuationMetrics,
  calculateGreedMetrics,
  calculateWeightedScore,
  conclusionForScore,
} from '../src/core.mjs';

test('clamp constrains values to the default range', () => {
  assert.equal(clamp(-5), 0);
  assert.equal(clamp(42.5), 42.5);
  assert.equal(clamp(105), 100);
});

test('percentileRank uses the inclusive empirical rank', () => {
  assert.equal(percentileRank([1, 2, 3, 4], 2), 50);
});

test('deviationSeries starts only after the moving-average warmup', () => {
  const points = Array.from({ length: 252 }, (_, index) => ({
    date: `d${index}`,
    close: index + 1,
  }));
  const result = deviationSeries(points, 250);
  assert.equal(result.length, 3);
  assert.equal(result[0].date, 'd249');
});

test('calculatePositionMetric reverses a high deviation percentile', () => {
  const points = Array.from({ length: 260 }, (_, index) => ({
    date: `d${index}`,
    close: index === 259 ? 200 : 100,
  }));
  const result = calculatePositionMetric(points, 1, 250);
  assert.equal(result.percentile, 100);
  assert.equal(result.score, 0);
});

test('window labels map to explicit trading-day counts', () => {
  assert.deepEqual([1, 3, 5, 10].map(tradingDaysForWindow), [250, 750, 1250, 2500]);
});

test('window labels reject non-numeric object keys', () => {
  assert.throws(() => tradingDaysForWindow('1'), RangeError);
  assert.throws(() => tradingDaysForWindow('toString'), RangeError);
});

test('valuation calculates earnings yield and ERP in percentage points', () => {
  const result = calculateValuationMetrics({
    ttmPeHistory: [10, 12, 15],
    forwardPeHistory: [10, 12.5, 20],
    bond10yHistory: [2, 2, 2],
  });
  assert.equal(result.forwardEarningsYield.value, 5);
  assert.equal(result.erp.value, 3);
  assert.equal(result.ttmPe.score, 0);
});

test('valuation leaves forward earnings yield and ERP missing without forward PE', () => {
  const result = calculateValuationMetrics({
    ttmPeHistory: [10, 12, 15],
    forwardPeHistory: [],
    bond10yHistory: [2, 2, 2],
  });
  assert.equal(result.forwardEarningsYield, null);
  assert.equal(result.erp, null);
});

test('emotion converts weighted greed into a reversed buy-point score', () => {
  const result = calculateGreedMetrics({
    advancers: 20,
    decliners: 80,
    limitUp: 1,
    limitDown: 9,
    turnoverPercentile: 30,
    marginChangePercentile: 40,
  });
  assert.equal(result.greed, 24.8);
  assert.equal(result.buyScore, 75.2);
  assert.equal(result.coverage, 25);
});

test('emotion removes an unavailable limit balance without inventing a value', () => {
  const result = calculateGreedMetrics({
    advancers: 50,
    decliners: 50,
    limitUp: 0,
    limitDown: 0,
    turnoverPercentile: 50,
    marginChangePercentile: 50,
  });
  assert.equal(result.components.limitBalance.score, null);
  assert.equal(result.coverage, 19);
  assert.equal(result.greed, 50);
});

test('missing metrics are removed and remaining weights are normalized', () => {
  const result = calculateWeightedScore([
    { id: 'a', score: 80, weight: 60 },
    { id: 'b', score: null, weight: 40 },
  ]);
  assert.equal(result.score, 80);
  assert.equal(result.coverage, 60);
  assert.equal(result.items[0].effectiveWeight, 100);
  assert.equal(result.items[0].contribution, 80);
  assert.equal(result.items[1].effectiveWeight, 0);
});

test('coverage below 70 suppresses an action conclusion', () => {
  assert.equal(conclusionForScore(90, 69).label, '数据不足，暂不判断');
  assert.equal(conclusionForScore(82, 100).label, '别人恐惧，可以贪婪');
  assert.equal(conclusionForScore(70, 100).label, '偏便宜，分批关注');
  assert.equal(conclusionForScore(50, 100).label, '中性，等待赔率改善');
  assert.equal(conclusionForScore(30, 100).label, '偏贵，控制冲动');
  assert.equal(conclusionForScore(20, 100).label, '市场贪婪，应该恐惧');
});
