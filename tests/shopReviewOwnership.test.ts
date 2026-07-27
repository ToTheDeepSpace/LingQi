import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedShopIdentity, shopCanManageRanking } from '../api/shopReviewOwnership.js';

const profile = {
  id: 'profile-a',
  shop_name: 'O·G 沉浸式剧场',
  display_name: 'OG 店家账号',
};
const ownedStores = [
  { id: 'store-a', dm_name: 'O·G沉浸式剧场' },
];

test('store dossier id is authoritative when a ranking is linked', () => {
  assert.equal(shopCanManageRanking(profile, {
    subject_type: 'store',
    subject_dossier_id: 'store-a',
    subject_name: '另一个名字',
  }, ownedStores), true);
  assert.equal(shopCanManageRanking(profile, {
    subject_type: 'store',
    subject_dossier_id: 'store-b',
    subject_name: 'O·G沉浸式剧场',
  }, ownedStores), false);
});

test('legacy rankings fall back only to names on an owned store account', () => {
  assert.equal(shopCanManageRanking(profile, {
    subject_type: 'store',
    subject_name: 'Ｏ·Ｇ 沉浸式剧场',
  }, ownedStores), true);
  assert.equal(shopCanManageRanking(profile, {
    subject_type: 'store',
    subject_name: '同名但未认领的店家',
  }, ownedStores), false);
  assert.equal(shopCanManageRanking(profile, {
    subject_type: 'store',
    subject_name: 'O·G沉浸式剧场',
  }, []), false);
});

test('non-store rankings are never manageable from the shop dashboard', () => {
  assert.equal(shopCanManageRanking(profile, {
    subject_type: 'dm',
    subject_dossier_id: 'store-a',
    subject_name: 'O·G沉浸式剧场',
  }, ownedStores), false);
});

test('shop name normalization handles full-width text and whitespace only', () => {
  assert.equal(normalizedShopIdentity(' Ｏ·Ｇ  沉浸式剧场 '), 'o·g沉浸式剧场');
  assert.notEqual(normalizedShopIdentity('O-G沉浸式剧场'), normalizedShopIdentity('O·G沉浸式剧场'));
});
