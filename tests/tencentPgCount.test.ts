import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveExactSelectCount } from '../api/tencentPgCount.js';

test('returns the database total instead of the current page size', () => {
  assert.equal(resolveExactSelectCount(true, 149), 149);
  assert.equal(resolveExactSelectCount(true, '149'), 149);
  assert.equal(resolveExactSelectCount(false, 149), null);
});
