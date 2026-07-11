import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateChantoSplit, isValidChantoAmount } from '../src/lib/chanto.js';

test('accepts only integer chanto amounts within the public limits', () => {
  assert.equal(isValidChantoAmount(1), true);
  assert.equal(isValidChantoAmount(1000), true);
  assert.equal(isValidChantoAmount(0), false);
  assert.equal(isValidChantoAmount(1001), false);
  assert.equal(isValidChantoAmount(10.5), false);
});

test('takes a 20 percent platform fee and preserves the gross total', () => {
  assert.deepEqual(calculateChantoSplit(100), { grossAmount: 100, platformFee: 20, receiverAmount: 80 });
  assert.deepEqual(calculateChantoSplit(9), { grossAmount: 9, platformFee: 1, receiverAmount: 8 });
});
