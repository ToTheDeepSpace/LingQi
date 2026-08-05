import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

test('keeps the selected streak-first check-in experience and conversion-based rewards', () => {
  const source = read('miniapp/jumulu/src/components/DailyCheckinView.vue');

  assert.match(source, /签到与奖励/);
  assert.match(source, /已连续/);
  assert.match(source, /签到并保住连签/);
  assert.match(source, /今天 23:59 前有效/);
  assert.match(source, /邀请好友完成验证/);
  assert.match(source, /好友完成首次有效互动/);
  assert.match(source, /赠送榜金仅用于站内功能，不可提现/);
  assert.doesNotMatch(source, /分享(?:成功|一次).{0,8}(?:奖励|到账|赠送)/);
});

test('preserves referral attribution from miniapp entry through login and later shares', () => {
  const app = read('miniapp/jumulu/src/App.vue');
  const auth = read('miniapp/jumulu/src/utils/auth.ts');
  const share = read('miniapp/jumulu/src/utils/share.ts');

  assert.match(app, /rememberIncomingReferral\(options\?\.query\)/);
  assert.match(auth, /referralCode:\s*readIncomingReferral\(\)/);
  assert.match(auth, /clearIncomingReferral\(\)/);
  assert.match(share, /ref=\$\{encodeURIComponent\(code\)\}/);
  assert.match(share, /jumulu-share-default\.jpg/);
});

test('shares rankings, individual ratings, and a store DM roster as deep links', () => {
  const ranking = read('miniapp/jumulu/src/pages/rankings/detail.vue');
  const dm = read('miniapp/jumulu/src/pages/dm/detail.vue');
  const store = read('miniapp/jumulu/src/pages/stores/detail.vue');
  const server = read('api/index.ts');

  assert.match(ranking, /imageUrl:\s*shareImage\(images\.value\[0\]\)/);
  assert.match(dm, /ratingId=\$\{encoded\(dataset\.ratingId\)\}/);
  assert.match(dm, /data-share-kind="dm-rating"/);
  assert.match(store, /view=dms/);
  assert.match(store, /data-share-kind="store-dms"/);
  assert.match(store, /data-share-kind="store-rating"/);
  assert.match(server, /\.eq\('store_dossier_id', req\.params\.id\)[\s\S]*?\.eq\('status', 'approved'\)/);
  assert.match(server, /dms:\s*affiliatedDms/);
});

test('only paid balance can fund creator-withdrawable guide purchases', () => {
  const migration = read('supabase/migrations/20260802213000_paid_only_creator_monetization.sql');
  const purchaseFunction = migration.slice(migration.indexOf('create or replace function public.lc_purchase_guide'));

  assert.match(migration, /create or replace function public\.lc_spend_paid_wallet_balance/);
  assert.match(migration, /if profile_row\.paid_balance < p_amount/);
  assert.match(migration, /付费攻略不能使用赠送榜金/);
  assert.match(purchaseFunction, /public\.lc_spend_paid_wallet_balance/);
  assert.doesNotMatch(purchaseFunction, /public\.lc_spend_wallet_balance\(/);
  assert.match(purchaseFunction, /'funding_source', 'paid_only'/);
});
