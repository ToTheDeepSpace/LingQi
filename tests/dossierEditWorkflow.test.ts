import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dossierEditAdminReviewReady,
  effectiveDossierOwnerResponseStatus,
  initialDossierEditWorkflow,
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

test('他人修改已认领档案时给认领人七天确认期', () => {
  const workflow = initialDossierEditWorkflow({ ownerProfileId: 'owner', submitterProfileId: 'editor', now: NOW });
  assert.equal(workflow.requiresOwnerResponse, true);
  assert.equal(workflow.ownerResponseStatus, 'pending');
  assert.equal(workflow.ownerResponseDueAt, '2026-07-18T12:00:00.000Z');
  assert.equal(dossierEditAdminReviewReady({ status: workflow.ownerResponseStatus, dueAt: workflow.ownerResponseDueAt, now: NOW }), false);
});

test('本人同意、反对或超时后都转由管理员最终审核', () => {
  assert.equal(dossierEditAdminReviewReady({ status: 'agreed', now: NOW }), true);
  assert.equal(dossierEditAdminReviewReady({ status: 'opposed', now: NOW }), true);
  assert.equal(effectiveDossierOwnerResponseStatus({ status: 'pending', dueAt: '2026-07-11T11:59:59.000Z', now: NOW }), 'expired');
  assert.equal(dossierEditAdminReviewReady({ status: 'pending', dueAt: '2026-07-11T11:59:59.000Z', now: NOW }), true);
});
