import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authSessionMatches,
  nextSessionVersion,
  sessionVersionOf,
} from '../api/authSessionPolicy.js';

test('normalizes valid profile session versions', () => {
  assert.equal(sessionVersionOf(3), 3);
  assert.equal(sessionVersionOf('4'), 4);
  assert.equal(sessionVersionOf(null), 1);
  assert.equal(sessionVersionOf(0), 1);
});

test('rejects legacy and stale tokens', () => {
  assert.equal(authSessionMatches(undefined, 1), false);
  assert.equal(authSessionMatches(1, 2), false);
  assert.equal(authSessionMatches(2, 2), true);
});

test('calculates the token version returned after a security change', () => {
  assert.equal(nextSessionVersion(1), 2);
  assert.equal(nextSessionVersion('7'), 8);
});
