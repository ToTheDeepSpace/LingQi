import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WECHAT_IMAGE_CALLBACK_STALE_MS,
  wechatSafetyMatchesFilter,
  wechatSafetyStatusPresentation,
} from '../src/lib/wechatSafetyPresentation.js';

test('marks only stale pending images as callback timeouts', () => {
  const now = Date.parse('2026-07-28T00:30:00+08:00');
  const fresh = new Date(now - WECHAT_IMAGE_CALLBACK_STALE_MS + 1).toISOString();
  const stale = new Date(now - WECHAT_IMAGE_CALLBACK_STALE_MS).toISOString();

  assert.equal(wechatSafetyStatusPresentation('pending', 'image', fresh, now).label, '检查中');
  assert.equal(wechatSafetyStatusPresentation('pending', 'image', stale, now).label, '回调超时');
  assert.equal(wechatSafetyStatusPresentation('pending', 'text', stale, now).label, '检查中');
  assert.match(wechatSafetyStatusPresentation('pending', 'image', stale, now).note, /消息推送配置/);
});

test('keeps ordinary WeChat check statuses readable', () => {
  assert.equal(wechatSafetyStatusPresentation('pass', 'text').label, '通过');
  assert.equal(wechatSafetyStatusPresentation('review', 'image').label, '需复核');
  assert.equal(wechatSafetyStatusPresentation('risky', 'image').label, '风险');
  assert.equal(wechatSafetyStatusPresentation('error', 'text').label, '调用异常');
});

test('filters WeChat safety records around moderator actions', () => {
  const now = Date.UTC(2026, 6, 28, 0, 0, 0);
  const fresh = new Date(now - 60_000).toISOString();
  const stale = new Date(now - WECHAT_IMAGE_CALLBACK_STALE_MS - 1).toISOString();
  assert.equal(wechatSafetyMatchesFilter('pending', 'image', stale, 'attention', now), true);
  assert.equal(wechatSafetyMatchesFilter('review', 'text', fresh, 'attention', now), true);
  assert.equal(wechatSafetyMatchesFilter('pending', 'image', fresh, 'attention', now), false);
  assert.equal(wechatSafetyMatchesFilter('pending', 'image', fresh, 'pending', now), true);
  assert.equal(wechatSafetyMatchesFilter('pass', 'text', fresh, 'pass', now), true);
  assert.equal(wechatSafetyMatchesFilter('risky', 'image', fresh, 'all', now), true);
});
