const assert = require('node:assert/strict');
const { calculateKelly } = require('./calculate-kelly.cjs');
const result = calculateKelly({ price: 100, low: 50, high: 150, probability: 0.6 });
assert.ok(Math.abs(result.full - 0.4) < 1e-12);
assert.ok(Math.abs(result.half - 0.2) < 1e-12);
assert.equal(result.breakEvenProbability, 0.5);
// Independently verify the maximum of expected log wealth on a fine grid.
const growth = (f) => 0.6 * Math.log(1 + f * 0.5) + 0.4 * Math.log(1 - f * 0.5);
for (let i = 0; i <= 1000; i++) assert.ok(growth(result.full) >= growth(i / 1000) - 1e-12);
assert.equal(calculateKelly({ price: 100, low: 50, high: 150, probability: 0.3 }).full, 0);
assert.equal(calculateKelly({ price: 100, low: 50, high: 150, probability: 0.9 }).full, 1);
for (const price of [50, 150, 40, 160]) assert.equal(calculateKelly({ price, low: 50, high: 150, probability: 0.6 }).full, null);
assert.throws(() => calculateKelly({ price: 100, low: 50, high: 150, probability: 1.1 }));
assert.throws(() => calculateKelly({ price: 100, low: 150, high: 50, probability: 0.6 }));
console.log('Kelly calculation tests passed');
