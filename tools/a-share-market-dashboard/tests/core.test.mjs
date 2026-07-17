import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clamp,
  percentileRank,
  deviationSeries,
  calculatePositionMetric,
  tradingDaysForWindow,
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
