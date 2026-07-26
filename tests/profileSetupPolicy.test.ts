import test from 'node:test';
import assert from 'node:assert/strict';
import { profileSetupBlockReason } from '../api/profileSetupPolicy.js';

test('legacy profiles remain publication-ready when the setup flag is absent', () => {
  assert.equal(profileSetupBlockReason({}), '');
  assert.equal(profileSetupBlockReason({ profile_setup_completed: true }), '');
});

test('new miniapp profiles cannot publish before the reviewed nickname is applied', () => {
  assert.match(
    profileSetupBlockReason({ profile_setup_completed: false }),
    /设置公开昵称/,
  );
});
