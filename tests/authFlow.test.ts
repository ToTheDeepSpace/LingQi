import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAuthAccountKind,
  getNextAuthStep,
  normalizeAuthAccount,
  shouldShowWechatLogin,
} from '../src/lib/authFlow.js';
import {
  getPostLoginRedirect,
  nextOnboardingViewCount,
  shouldShowOnboarding,
} from '../src/lib/postLoginFlow.js';

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

test('defaults ordinary login to rankings while respecting safe redirects', () => {
  assert.equal(getPostLoginRedirect(null), '/rankings');
  assert.equal(getPostLoginRedirect(''), '/rankings');
  assert.equal(getPostLoginRedirect('https://evil.example'), '/rankings');
  assert.equal(getPostLoginRedirect('//evil.example'), '/rankings');
  assert.equal(getPostLoginRedirect('/guides/new'), '/guides/new');
});

test('limits onboarding to three automatic views and allows early dismissal', () => {
  assert.equal(shouldShowOnboarding({ pending: true, dismissed: false, viewCount: 0 }), true);
  assert.equal(nextOnboardingViewCount(0), 1);
  assert.equal(nextOnboardingViewCount(2), 3);
  assert.equal(shouldShowOnboarding({ pending: true, dismissed: false, viewCount: 3 }), false);
  assert.equal(shouldShowOnboarding({ pending: true, dismissed: true, viewCount: 1 }), false);
  assert.equal(shouldShowOnboarding({ pending: false, dismissed: false, viewCount: 0 }), false);
});
