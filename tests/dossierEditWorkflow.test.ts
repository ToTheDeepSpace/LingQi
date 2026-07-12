import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dossierAdminReviewMode,
  dossierEditAdminReviewReady,
  effectiveDossierOwnerResponseStatus,
  initialDossierEditWorkflow,
  ownerLoggedInDuringDossierResponseWindow,
  partitionDossierEditPatch,
  dossierOwnerConfirmationFields,
} from '../api/dossierEditWorkflow.js';

const NOW = new Date('2026-07-11T12:00:00.000Z');

test('未认领档案和认领人本人修改不需要等待本人确认', () => {
  const unclaimed = initialDossierEditWorkflow({ submitterProfileId: 'user-1', now: NOW });
  assert.equal(unclaimed.requiresOwnerResponse, false);
  assert.equal(unclaimed.ownerResponseStatus, 'not_required');
  assert.equal(unclaimed.ownerResponseDueAt, null);

  const ownerEdit = initialDossierEditWorkflow({ ownerProfileId: 'user-1', submitterProfileId: 'user-1', now: NOW });
  assert.equal(ownerEdit.requiresOwnerResponse, false);
  assert.equal(ownerEdit.ownerResponseStatus, 'not_required');
});

test('only personal and likeness fields require dossier owner confirmation', () => {
  assert.deepEqual(dossierOwnerConfirmationFields({
    city: '上海',
    workplace: 'OG剧场',
    common_scripts: [],
    photo_files: [],
    profile_url: 'https://example.com',
    mbti: 'INTJ',
  }), ['profile_url', 'photo_files', 'mbti']);
});

test('他人修改已认领档案时给认领人三天确认期', () => {
  const workflow = initialDossierEditWorkflow({ ownerProfileId: 'owner', submitterProfileId: 'editor', now: NOW });
  assert.equal(workflow.requiresOwnerResponse, true);
  assert.equal(workflow.ownerResponseStatus, 'pending');
  assert.equal(workflow.ownerResponseDueAt, '2026-07-14T12:00:00.000Z');
  assert.equal(dossierEditAdminReviewReady({ status: workflow.ownerResponseStatus, dueAt: workflow.ownerResponseDueAt, now: NOW }), false);
});

test('确认状态能正确识别同意、反对和超时', () => {
  assert.equal(dossierEditAdminReviewReady({ status: 'agreed', now: NOW }), true);
  assert.equal(dossierEditAdminReviewReady({ status: 'opposed', now: NOW }), true);
  assert.equal(effectiveDossierOwnerResponseStatus({ status: 'pending', dueAt: '2026-07-11T11:59:59.000Z', now: NOW }), 'expired');
  assert.equal(dossierEditAdminReviewReady({ status: 'pending', dueAt: '2026-07-11T11:59:59.000Z', now: NOW }), true);
});

test('只把提交后三天窗口内的上线记录视为本人已上线', () => {
  const base = {
    createdAt: '2026-07-11T12:00:00.000Z',
    dueAt: '2026-07-14T12:00:00.000Z',
  };
  assert.equal(ownerLoggedInDuringDossierResponseWindow({ ...base, ownerLastSeenAt: '2026-07-12T08:00:00.000Z' }), true);
  assert.equal(ownerLoggedInDuringDossierResponseWindow({ ...base, ownerLastSeenAt: '2026-07-11T11:59:59.000Z' }), false);
  assert.equal(ownerLoggedInDuringDossierResponseWindow({ ...base, ownerLastSeenAt: '2026-07-14T12:00:01.000Z' }), false);
  assert.equal(ownerLoggedInDuringDossierResponseWindow({ ...base, ownerLastSeenAt: null }), false);
});

test('档案字段按免审、后审和前审拆分', () => {
  const partition = partitionDossierEditPatch({
    birth_year: 1998,
    height_cm: 170,
    weight_kg: 60,
    mbti: 'INTJ',
    zodiac: '天蝎座',
    city: '保定',
    bio: '自由填写的人物简介',
    tags: ['情感本'],
  });
  assert.deepEqual(partition.noAdminReviewPatch, {
    birth_year: 1998,
    height_cm: 170,
    weight_kg: 60,
    mbti: 'INTJ',
    zodiac: '天蝎座',
  });
  assert.deepEqual(partition.postAdminReviewPatch, { city: '保定' });
  assert.deepEqual(partition.preAdminReviewPatch, { bio: '自由填写的人物简介', tags: ['情感本'] });
  assert.equal(dossierAdminReviewMode(partition), 'admin_mixed');
  assert.equal(dossierAdminReviewMode({ preAdminReviewPatch: {}, postAdminReviewPatch: { city: '上海' } }), 'admin_post');
  assert.equal(dossierAdminReviewMode({ preAdminReviewPatch: {}, postAdminReviewPatch: {} }), 'none');
});
