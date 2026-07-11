import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dossierComparableValue,
  dossierPatchForOwnerConsent,
  normalizeDossierCareerHistory,
  normalizeDossierNamedRefs,
  normalizeDossierPhotos,
} from '../src/lib/dossierWiki.js';

test('图库最多保留九张、去重并保留封面焦点', () => {
  const photos = normalizeDossierPhotos([
    { url: 'https://example.com/a.jpg', caption: '封面', focusX: 35, focusY: 18 },
    { url: 'https://example.com/a.jpg' },
    ...Array.from({ length: 10 }, (_, index) => ({ url: `https://example.com/${index}.jpg` })),
  ]);
  assert.equal(photos.length, 9);
  assert.equal(photos[0].caption, '封面');
  assert.equal(photos[0].focus_x, 35);
  assert.equal(photos[0].focus_y, 18);
});

test('圈人圈店按 ID 去重，履历拒绝结束早于开始', () => {
  assert.deepEqual(normalizeDossierNamedRefs([
    { id: 'one', name: '泡泡' },
    { id: 'one', name: '重复名字' },
    { id: 'two', name: '止行剧场' },
  ]), [
    { id: 'one', name: '泡泡' },
    { id: 'two', name: '止行剧场' },
  ]);
  assert.deepEqual(normalizeDossierCareerHistory([
    { storeDossierId: 'store-1', storeName: '止行剧场', startedMonth: '2024-03', endedMonth: '2024-02' },
    { storeDossierId: 'store-2', storeName: '玩聚', startedMonth: '2024-04' },
  ]), [{
    store_dossier_id: 'store-2',
    store_name: '玩聚',
    started_month: '2024-04',
    ended_month: null,
    role_title: null,
    note: null,
  }]);
});

test('敏感资料只有本人提交或本人明确同意时才进入应用补丁', () => {
  const patch = { bio: '人物简介', birth_year: 1998, height_cm: 170, tags: ['情感本'] };
  const pending = dossierPatchForOwnerConsent(patch, { submitterIsOwner: false, ownerResponseStatus: 'expired' });
  assert.deepEqual(pending.appliedPatch, { bio: '人物简介', tags: ['情感本'] });
  assert.deepEqual(pending.omittedSensitiveFields, ['birth_year', 'height_cm']);

  const agreed = dossierPatchForOwnerConsent(patch, { submitterIsOwner: false, ownerResponseStatus: 'agreed' });
  assert.deepEqual(agreed.appliedPatch, patch);
  assert.deepEqual(agreed.omittedSensitiveFields, []);
});

test('对象与数组比较不受键顺序影响', () => {
  assert.equal(
    dossierComparableValue([{ id: 'one', name: '泡泡' }]),
    dossierComparableValue([{ name: '泡泡', id: 'one' }]),
  );
});
