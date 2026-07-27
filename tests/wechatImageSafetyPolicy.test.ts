import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WECHAT_IMAGE_PENDING_STALE_MS,
  wechatImageApprovalIssue,
  wechatImageSubmissionAction,
} from '../api/wechatImageSafetyPolicy.js';

test('reuses fresh image checks and retries stale pending checks', () => {
  const now = Date.parse('2026-07-28T00:00:00+08:00');
  assert.equal(wechatImageSubmissionAction(undefined, now), 'submit');
  assert.equal(wechatImageSubmissionAction({ resource_hash: 'a', status: 'pass' }, now), 'reuse');
  assert.equal(wechatImageSubmissionAction({ resource_hash: 'a', status: 'risky' }, now), 'block');
  assert.equal(wechatImageSubmissionAction({
    resource_hash: 'a',
    status: 'pending',
    created_at: new Date(now - WECHAT_IMAGE_PENDING_STALE_MS + 1).toISOString(),
  }, now), 'reuse');
  assert.equal(wechatImageSubmissionAction({
    resource_hash: 'a',
    status: 'pending',
    created_at: new Date(now - WECHAT_IMAGE_PENDING_STALE_MS).toISOString(),
  }, now), 'submit');
});

test('requires every image in a miniapp batch to pass before approval', () => {
  const hashes = ['a', 'b'];
  assert.equal(wechatImageApprovalIssue(hashes, []), 'incomplete');
  assert.equal(wechatImageApprovalIssue(hashes, [
    { resource_hash: 'a', status: 'pass' },
  ]), 'incomplete');
  assert.equal(wechatImageApprovalIssue(hashes, [
    { resource_hash: 'a', status: 'pass' },
    { resource_hash: 'b', status: 'pending' },
  ]), 'incomplete');
  assert.equal(wechatImageApprovalIssue(hashes, [
    { resource_hash: 'a', status: 'pass' },
    { resource_hash: 'b', status: 'risky' },
  ]), 'unsafe');
  assert.equal(wechatImageApprovalIssue(hashes, [
    { resource_hash: 'a', status: 'pass' },
    { resource_hash: 'b', status: 'pass' },
  ]), null);
});

test('uses the newest result when an image was resubmitted', () => {
  assert.equal(wechatImageApprovalIssue(['a'], [
    { resource_hash: 'a', status: 'pass' },
    { resource_hash: 'a', status: 'pending' },
  ]), null);
});
