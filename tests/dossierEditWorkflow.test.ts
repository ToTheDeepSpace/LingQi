import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dossierEditAdminReviewReady,
  effectiveDossierOwnerResponseStatus,
  initialDossierEditWorkflow,
  ownerLoggedInDuringDossierResponseWindow,
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
