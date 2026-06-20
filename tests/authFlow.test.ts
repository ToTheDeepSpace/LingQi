import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAuthAccountKind,
  getNextAuthStep,
  normalizeAuthAccount,
  shouldShowWechatLogin,
} from '../src/lib/authFlow.js';

test('normalizes phone and email accounts', () => {
  assert.equal(getAuthAccountKind('158 0272 3241'), 'phone');
  assert.equal(normalizeAuthAccount('158 0272 3241', 'phone'), '15802723241');
  assert.equal(getAuthAccountKind('HNNKKK@qq.com'), 'email');
  assert.equal(normalizeAuthAccount('HNNKKK@qq.com', 'email'), 'hnnkkk@qq.com');
});

test('moves an existing password account to password login', () => {
  const next = getNextAuthStep({ exists: true, hasPassword: true });
  assert.equal(next.step, 'password');
  assert.match(next.message, /已经注册/);
});

test('moves a new account to verification registration', () => {
  const next = getNextAuthStep({ exists: false, hasPassword: false });
  assert.equal(next.step, 'register');
  assert.match(next.message, /还没有注册/);
});

test('moves an existing account without password to password reset', () => {
  const next = getNextAuthStep({ exists: true, hasPassword: false });
  assert.equal(next.step, 'reset');
  assert.match(next.message, /设置密码/);
});

test('shows wechat login only when backend config enables it', () => {
  assert.equal(shouldShowWechatLogin({ wechatEnabled: true }), true);
  assert.equal(shouldShowWechatLogin({ wechatEnabled: false }), false);
  assert.equal(shouldShowWechatLogin(null), false);
});
