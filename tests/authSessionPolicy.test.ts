import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('password changes sign the database-returned session version', () => {
  const source = readFileSync('api/index.ts', 'utf8');
  const resetPassword = source.slice(
    source.indexOf("app.post('/api/lc/auth/reset-password'"),
    source.indexOf("app.post('/api/lc/auth/bind-phone'"),
  );
  const setPassword = source.slice(
    source.indexOf("app.post('/api/lc/auth/set-password'"),
    source.indexOf("app.get('/api/lc/auth/wechat/url'"),
  );

  for (const endpoint of [resetPassword, setPassword]) {
    assert.match(endpoint, /\.update\([\s\S]+?\.select\('\*'\)\s*\.single\(\)/);
    assert.match(endpoint, /if \(updateError\) throw updateError/);
  }
  assert.match(resetPassword, /signProfileAuthToken\(nextProfile\)/);
  assert.match(setPassword, /signProfileAuthToken\(updatedProfile,\s*authClientForToken\(req\)\)/);
  assert.doesNotMatch(setPassword, /nextSessionVersion\(current\.session_version\)/);
});
