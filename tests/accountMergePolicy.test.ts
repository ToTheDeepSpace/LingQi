import assert from 'node:assert/strict';
import test from 'node:test';
import {
  miniappAccountMergeErrorMessage,
  miniappAccountMergePreflight,
} from '../api/accountMergePolicy.js';

const source = {
  id: 'mini',
  auth_provider: 'wechat_miniapp',
  wechat_mini_openid: 'mini-openid',
  wechat_unionid: 'union-id',
  phone: null,
  email: null,
  password_hash: null,
  balance: 30,
  paid_balance: 0,
  bonus_balance: 30,
};

const target = {
  id: 'website',
  phone: '13800000000',
  phone_verified_at: '2026-07-21T00:00:00.000Z',
  is_banned: false,
  wechat_mini_openid: null,
  wechat_unionid: null,
};

test('allows only a pristine temporary miniapp account to merge into the website account', () => {
  assert.equal(miniappAccountMergePreflight(source, target), null);
  assert.match(miniappAccountMergePreflight({ ...source, bonus_balance: 40 }, target) || '', /余额变化/);
  assert.match(miniappAccountMergePreflight({ ...source, password_hash: 'hash' }, target) || '', /其他登录方式/);
});

test('blocks overwriting a different WeChat identity on the website account', () => {
  assert.match(
    miniappAccountMergePreflight(source, { ...target, wechat_mini_openid: 'other-openid' }) || '',
    /其他小程序微信/,
  );
  assert.match(
    miniappAccountMergePreflight(source, { ...target, wechat_unionid: 'other-union' }) || '',
    /其他微信身份/,
  );
});

test('maps database guard failures to user-facing messages', () => {
  assert.match(miniappAccountMergeErrorMessage({ message: 'MINIAPP_ACCOUNT_HAS_ACTIVITY' }), /已有发布/);
  assert.match(miniappAccountMergeErrorMessage({ message: 'TARGET_PHONE_MISMATCH' }), /手机号验证结果/);
});
