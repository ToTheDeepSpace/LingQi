import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adminPrivateAccountPayload,
  adminProfileListPayload,
  maskAdminEmail,
  maskAdminPhone,
} from '../api/adminPrivacy.js';

test('admin account list masks login identifiers and excludes private account fields', () => {
  const payload = adminProfileListPayload({
    id: 'profile-1',
    display_name: '泡泡',
    phone: '15802723241',
    email: 'hnnkkk@qq.com',
    wechat: 'private-wechat-id',
    wechat_nickname: '清徽',
    wechat_openid: 'openid-secret',
    balance: 999,
    created_at: '2026-07-12T00:00:00Z',
  });

  assert.equal(payload.phone, '158****3241');
  assert.equal(payload.email, 'hn***@qq.com');
  assert.equal(payload.wechat_nickname, '清***徽');
  assert.equal('wechat' in payload, false);
  assert.equal('wechat_openid' in payload, false);
  assert.equal('balance' in payload, false);
});

test('private account payload is explicit and limited to requested account identifiers', () => {
  const payload = adminPrivateAccountPayload({
    id: 'profile-1',
    display_name: '泡泡',
    phone: '15802723241',
    email: 'hnnkkk@qq.com',
    wechat: 'private-wechat-id',
    wechat_nickname: '清徽',
    auth_provider: 'phone',
    balance: 999,
    wechat_openid: 'openid-secret',
  });

  assert.equal(payload.phone, '15802723241');
  assert.equal(payload.email, 'hnnkkk@qq.com');
  assert.equal('balance' in payload, false);
  assert.equal('wechat_openid' in payload, false);
});

test('mask helpers handle short and missing identifiers', () => {
  assert.equal(maskAdminPhone('1234567'), '12***67');
  assert.equal(maskAdminPhone(''), null);
  assert.equal(maskAdminEmail('a@example.com'), 'a***@example.com');
  assert.equal(maskAdminEmail(null), null);
});
