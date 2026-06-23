import assert from 'node:assert/strict';
import test from 'node:test';
import {
  identityRolesFromServices,
  primaryDisplayIdentityRole,
  normalizeServiceCategory,
  serviceCategoryLabel,
} from '../src/lib/serviceCategories.js';

test('normalizes service names into LingQi hall identity categories', () => {
  assert.equal(normalizeServiceCategory('摄影服务'), 'photographer');
  assert.equal(normalizeServiceCategory('约拍跟拍'), 'photographer');
  assert.equal(normalizeServiceCategory('妆造'), 'makeup');
  assert.equal(normalizeServiceCategory('服装租赁'), 'costume');
  assert.equal(normalizeServiceCategory('道具定制'), 'prop');
  assert.equal(normalizeServiceCategory('角色陪伴'), 'creator');
  assert.equal(normalizeServiceCategory('自由DM'), 'dm');
});

test('keeps unknown services custom without polluting hall filters', () => {
  assert.equal(normalizeServiceCategory('奇怪但合法的新服务'), 'custom');
  assert.equal(serviceCategoryLabel('custom'), '其他服务');
});

test('derives stable identity roles from approved service names', () => {
  assert.deepEqual(identityRolesFromServices(['摄影服务', '妆造', '自由DM', '奇怪但合法的新服务']), [
    'photographer',
    'makeup',
    'dm',
  ]);
});

test('prefers service identities over plain player for hall display', () => {
  assert.equal(primaryDisplayIdentityRole('player', ['player', 'photographer']), 'photographer');
  assert.equal(primaryDisplayIdentityRole('creator', ['creator', 'photographer']), 'creator');
  assert.equal(primaryDisplayIdentityRole('', ['player']), 'player');
});
