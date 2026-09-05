import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { notificationPage, notificationSummary, notifyConfig, recipientHash, sendOutcome, wechatNotificationPayload } from '../api/wechatNotifications.js';

const templateId = 'b36niF4nvnAF3k4K7ju4J1joO2jzpsEhqfOQMhKrcyU';
test('notification configuration is explicitly enabled and validates the template', () => {
  assert.equal(notifyConfig({}).enabled, false);
  assert.equal(notifyConfig({ LINGQI_WECHAT_NOTIFY_ENABLED: 'true' }).enabled, false);
  assert.equal(notifyConfig({ LINGQI_WECHAT_NOTIFY_TEMPLATE_ID: templateId }).enabled, false);
  assert.equal(notifyConfig({ LINGQI_WECHAT_NOTIFY_ENABLED: 'true', LINGQI_WECHAT_NOTIFY_TEMPLATE_ID: templateId }).enabled, true);
  assert.throws(() => notifyConfig({ LINGQI_WECHAT_NOTIFY_PAGE_STATE: 'wrong' }));
});
test('WeChat payload only contains bounded static summaries and an internal notice link', () => {
  for (const type of ['commission_applied', 'provider_inquiry', 'carpool_application', 'restriction_started', 'appeal_reviewed', 'site_message_resolved', 'service_payment_succeeded', 'private input should never appear']) {
    const summary = notificationSummary(type);
    assert.ok([...summary.kind].length <= 5);
    assert.ok([...summary.summary].length <= 20);
  }
  const payload = wechatNotificationPayload({
    id: '12345678-1234-1234-1234-123456789abc', type: 'private secret', createdAt: '2026-09-05T20:30:00Z', openid: 'test-openid',
    config: { enabled: true, templateId, pageState: 'trial' },
  });
  assert.equal(payload.data.date3.value, '2026-09-06 04:30');
  assert.match(payload.page, /^pages\/mine\/account-status\?notice=/);
  assert.equal(payload.miniprogram_state, 'trial');
  assert.ok(!JSON.stringify(payload).includes('private secret'));
  assert.throws(() => notificationPage('https://other.site/'));
  assert.match(recipientHash('test-openid'), /^[a-f0-9]{64}$/);
});
test('definitive provider errors only retry a bounded number of times', () => {
  assert.equal(sendOutcome(0, 1).state, 'api_accepted');
  for (const code of [40001, 40014, 42001, 43108, -1]) {
    assert.equal(sendOutcome(code, 1).retry, true);
    assert.equal(sendOutcome(code, 3).retry, false);
  }
  for (const code of [43101, 43107, 40003, 40037, 47003, 45168]) assert.equal(sendOutcome(code, 1).retry, false);
});
test('miniapp uses an explicit gesture, describes one-time permission, and retains notification failures', () => {
  const ui = readFileSync('miniapp/jumulu/src/components/WechatNotificationPanel.vue', 'utf8');
  const tap = ui.slice(ui.indexOf('function subscribe()'), ui.indexOf('async function pause()'));
  assert.ok(!tap.slice(0, tap.indexOf('uni.requestSubscribeMessage({')).includes('await '));
  assert.match(ui, /一次订阅对应一条提醒/);
  assert.match(ui, /重试保存订阅/);
  assert.match(ui, /微信订阅未完成/);
  const routes = readFileSync('api/index.ts', 'utf8');
  assert.match(routes, /miniapp: \(req as Record<string, unknown>\)\.authClient === 'wechat-miniapp'/);
});
