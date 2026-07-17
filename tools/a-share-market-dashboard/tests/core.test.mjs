import test from 'node:test';
import assert from 'node:assert/strict';

import { clamp } from '../src/core.mjs';

test('clamp constrains values to the default range', () => {
  assert.equal(clamp(-5), 0);
  assert.equal(clamp(42.5), 42.5);
  assert.equal(clamp(105), 100);
});
