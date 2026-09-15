import test from 'node:test';
import assert from 'node:assert/strict';
import { riskStateModel } from '../src/risk-state.mjs';

test('risk state monitoring exposes no unverified scores, contribution weights or history', () => {
  for (const mode of [undefined, 'monitor', 'unknown']) {
    const model = riskStateModel(mode);
    assert.equal(model.aggregate, null);
    assert.equal(model.highCount, null);
    assert.equal(model.risingCount, null);
    assert.equal(model.largest, null);
    assert.deepEqual(model.dates, []);
    assert.equal(model.dimensions.length, 4);
    for (const dimension of model.dimensions) {
      assert.equal(dimension.score, null);
      assert.deepEqual(dimension.history, []);
      assert.deepEqual(dimension.events, []);
      assert.ok(dimension.sources.every(([, weight]) => weight === null));
      assert.ok(dimension.links.every(([, strength]) => strength === '待评估'));
      assert.ok(dimension.assets.every(([, level]) => level === '待核验'));
    }
  }
});

test('risk state example summary and historical observations match the supplied prototype', () => {
  const model = riskStateModel('demo');
  assert.equal(model.aggregate, 82);
  assert.equal(model.highCount, 2);
  assert.equal(model.risingCount, 3);
  assert.equal(model.largest, '流动性');
  assert.deepEqual(model.dimensions.map(item => item.score), [90, 82, 78, 65]);
  for (const dimension of model.dimensions) {
    assert.equal(dimension.score, dimension.history.at(-1));
    assert.equal(dimension.history.length, model.dates.length);
    assert.equal(dimension.events.length, model.dates.length);
    assert.equal(dimension.sources.reduce((sum, [, value]) => sum + value, 0), 100);
  }
  assert.equal(riskStateModel().aggregate, null);
});
