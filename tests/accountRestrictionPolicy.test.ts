import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accountAccessDecision,
  restrictionBlocksLogin,
  restrictionHasExpired,
} from '../api/accountRestrictionPolicy.js';

test('merged accounts are not treated as moderation restrictions', () => {
  const decision = accountAccessDecision({ is_banned: true, merged_into: 'target-id' }, 'POST');
  assert.deepEqual(decision, { allowed: false, state: 'merged', code: 'ACCOUNT_MERGED' });
  assert.equal(restrictionBlocksLogin({ is_banned: true, merged_into: 'target-id' }), false);
});

test('publish restriction allows reads but blocks writes and login remains available', () => {
  const profile = { is_banned: true, restriction_scope: 'publish' };
  assert.equal(accountAccessDecision(profile, 'GET').allowed, true);
  assert.equal(accountAccessDecision(profile, 'POST').allowed, false);
  assert.equal(restrictionBlocksLogin(profile), false);
});

test('account restriction blocks reads, writes, and login', () => {
  const profile = { is_banned: true, restriction_scope: 'account' };
  assert.equal(accountAccessDecision(profile, 'GET').allowed, false);
  assert.equal(accountAccessDecision(profile, 'POST').allowed, false);
  assert.equal(restrictionBlocksLogin(profile), true);
});

test('expired restriction is treated as active access until persistence catches up', () => {
  const now = Date.parse('2026-07-23T10:00:00.000Z');
  const profile = {
    is_banned: true,
    restriction_scope: 'account',
    restriction_ends_at: '2026-07-23T09:59:59.000Z',
  };
  assert.equal(restrictionHasExpired(profile, now), true);
  assert.equal(accountAccessDecision(profile, 'POST', now).state, 'expired');
  assert.equal(restrictionBlocksLogin(profile, now), false);
});
