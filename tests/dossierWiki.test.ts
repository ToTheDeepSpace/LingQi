import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dossierComparableValue,
  dossierFieldComparableValue,
  dossierPatchForOwnerConsent,
  dossierOwnerLockedFields,
  normalizeDossierFieldProvenance,
  stampDossierFieldProvenance,
  normalizeDossierIntegerInput,
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
  const patch = { bio: '人物简介', birth_year: 1998, height_cm: 170, photo_files: [{ url: '/a.jpg' }], mbti: 'INTJ', tags: ['情感本'] };
  const pending = dossierPatchForOwnerConsent(patch, { submitterIsOwner: false, ownerResponseStatus: 'expired' });
  assert.deepEqual(pending.appliedPatch, { bio: '人物简介', tags: ['情感本'] });
  assert.deepEqual(pending.omittedSensitiveFields, ['birth_year', 'height_cm', 'photo_files', 'mbti']);

  const agreed = dossierPatchForOwnerConsent(patch, { submitterIsOwner: false, ownerResponseStatus: 'agreed' });
  assert.deepEqual(agreed.appliedPatch, patch);
  assert.deepEqual(agreed.omittedSensitiveFields, []);
});

test('本人提供的字段形成字段级锁定，社区字段保持可编辑', () => {
  const provenance = stampDossierFieldProvenance({
    current: { city: { source: 'community' } },
    fields: ['height_cm', 'weight_kg'],
    source: 'owner',
    actorId: 'owner-1',
    updatedAt: '2026-07-13T00:00:00.000Z',
  });
  assert.deepEqual(dossierOwnerLockedFields(provenance), ['height_cm', 'weight_kg']);
  assert.equal(normalizeDossierFieldProvenance(provenance).city.source, 'community');
  assert.equal(provenance.height_cm.actor_id, 'owner-1');
});

test('对象与数组比较不受键顺序影响', () => {
  assert.equal(
    dossierComparableValue([{ id: 'one', name: '泡泡' }]),
    dossierComparableValue([{ name: '泡泡', id: 'one' }]),
  );
});

test('照片缺省焦点与默认焦点在审核冲突检测中视为相同', () => {
  const legacy = [{ url: 'https://example.com/a.jpg', name: 'DM照片', type: 'image/*' }];
  const normalized = [{
    url: 'https://example.com/a.jpg',
    name: 'DM照片',
    type: 'image/*',
    caption: null,
    focus_x: 50,
    focus_y: 25,
  }];
  const changed = [{ ...normalized[0], focus_x: 56.03, focus_y: 10.95 }];

  assert.equal(dossierFieldComparableValue('photo_files', legacy), dossierFieldComparableValue('photo_files', normalized));
  assert.notEqual(dossierFieldComparableValue('photo_files', legacy), dossierFieldComparableValue('photo_files', changed));
});

test('身高体重只接受范围内的十进制整数', () => {
  assert.equal(normalizeDossierIntegerInput('170', 100, 250, '身高'), 170);
  assert.equal(normalizeDossierIntegerInput(60, 30, 300, '体重'), 60);
  assert.throws(() => normalizeDossierIntegerInput('170.5', 100, 250, '身高'), /必须填写整数/);
  assert.throws(() => normalizeDossierIntegerInput('1e2', 30, 300, '体重'), /必须填写整数/);
  assert.throws(() => normalizeDossierIntegerInput('29', 30, 300, '体重'), /格式不正确/);
  assert.throws(() => normalizeDossierIntegerInput('251', 100, 250, '身高'), /格式不正确/);
});
