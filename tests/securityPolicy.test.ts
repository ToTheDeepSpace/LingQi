import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allowedWebOrigin,
  publicApiErrorMessage,
  publicAuditMetadata,
  publicProfileAllowlist,
} from '../api/securityPolicy.js';

test('public profile uses an allowlist and drops future private fields', () => {
  const profile = publicProfileAllowlist({
    id: 'profile-1',
    display_name: '泡泡',
    city: '保定',
    address: '不应公开',
    referral_code: 'SECRET',
    last_seen_at: '2026-07-20T00:00:00Z',
    password_hash: 'hash',
  });
  assert.deepEqual(profile, { id: 'profile-1', display_name: '泡泡', city: '保定' });
});

test('production errors hide database details but keep user-facing errors', () => {
  assert.equal(
    publicApiErrorMessage({ code: '22P02', message: 'invalid input syntax for type uuid: bad' }, true),
    '服务器暂时无法处理该请求，请稍后重试',
  );
  assert.equal(publicApiErrorMessage(new Error('请先登录'), true), '请先登录');
});

test('public audit metadata never returns before or after content', () => {
  assert.deepEqual(publicAuditMetadata({
    before: { content: '原始敏感内容' },
    after: { content: '编辑后内容' },
    changes: [{ field: 'content', label: '正文内容', before: '原始敏感内容', after: '编辑后内容' }],
  }), {
    changed_fields: ['content'],
    changes: [{ field: 'content', label: '正文内容' }],
  });
});

test('cors accepts first-party and local development origins only', () => {
  assert.equal(allowedWebOrigin('https://jumulu.jusichen.com'), true);
  assert.equal(allowedWebOrigin('http://localhost:5173'), true);
  assert.equal(allowedWebOrigin('https://attacker.example'), false);
});
