import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

const publicSharePages = [
  'pages/index/index.vue',
  'pages/dm/index.vue',
  'pages/dm/detail.vue',
  'pages/stores/index.vue',
  'pages/stores/detail.vue',
  'pages/roles/index.vue',
  'pages/roles/script-detail.vue',
  'pages/roles/detail.vue',
  'pages/rankings/index.vue',
  'pages/rankings/detail.vue',
  'pages/carpools/index.vue',
  'pages/commissions/index.vue',
  'pages/profile/detail.vue',
].map((path) => `miniapp/jumulu/src/${path}`);

const friendSharePages = [
  ...publicSharePages,
  'miniapp/jumulu/src/pages/mine/index.vue',
];

const privateOrWritePages = [
  'pages/dm/claim.vue',
  'pages/dm/rate.vue',
  'pages/stores/rate.vue',
  'pages/rankings/create.vue',
  'pages/carpools/create.vue',
  'pages/commissions/create.vue',
  'pages/commissions/provider-edit.vue',
  'pages/follows/index.vue',
  'pages/mine/content.vue',
  'pages/mine/account.vue',
  'pages/mine/account-status.vue',
  'pages/feedback/index.vue',
  'pages/report/index.vue',
].map((path) => `miniapp/jumulu/src/${path}`);

test('every public discovery page can be sent to a WeChat friend from the top-right menu', () => {
  for (const path of friendSharePages) {
    assert.match(read(path), /onShareAppMessage\s*\(/, `${path} must register onShareAppMessage`);
  }
});

test('every public discovery page can be shared to WeChat Moments', () => {
  for (const path of publicSharePages) {
    assert.match(read(path), /onShareTimeline\s*\(/, `${path} must register onShareTimeline`);
  }
});

test('friend and Moments payloads preserve referral attribution and a default share image', () => {
  const source = read('miniapp/jumulu/src/utils/share.ts');

  assert.match(source, /export function pageSharePayload/);
  assert.match(source, /path:\s*sharePath\(path\)/);
  assert.match(source, /export function shareQuery/);
  assert.match(source, /query:\s*shareQuery\(query\)/);
  assert.match(source, /imageUrl:\s*shareImage\(preferredImage\)/);
});

test('write, account, moderation, and private pages do not expose top-right sharing', () => {
  for (const path of privateOrWritePages) {
    assert.doesNotMatch(read(path), /onShare(?:AppMessage|Timeline)\s*\(/, `${path} must remain private`);
  }
});
