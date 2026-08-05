import assert from 'node:assert/strict';
import test from 'node:test';
import { privacyReportDetailError } from '../src/lib/reportPolicy.js';
import {
  reportInformationGap,
  reportSnapshotEntries,
  reportTargetLocation,
  reportTargetPath,
} from '../src/lib/reportPresentation.js';
import {
  decideReportTargetRestore,
  reportHandlingHidTarget,
  reportReopenConfirmation,
} from '../src/lib/reportReopenPolicy.js';

test('privacy reports must identify the privacy item and its location', () => {
  assert.match(privacyReportDetailError('侵犯隐私', ''), /具体隐私项/);
  assert.match(privacyReportDetailError('侵犯隐私', '侵犯我的隐私'), /至少 10 个字/);
  assert.equal(privacyReportDetailError('侵犯隐私', '公开主页的个人简介里展示了我的真实手机号'), '');
  assert.equal(privacyReportDetailError('虚假信息', ''), '');
});

test('legacy privacy reports without details are visibly marked as insufficient', () => {
  const report = {
    id: 'report-1',
    target_type: 'profile',
    target_id: 'profile-1',
    reason: '侵犯隐私',
    description: null,
    evidence_files: [],
    target_snapshot: { display_name: '白羊', role_type: 'player', content_preview: '' },
  };

  assert.match(reportInformationGap(report), /信息不足/);
  assert.equal(reportTargetLocation(report), '整个公开主页（未标注具体字段）');
  assert.equal(reportTargetPath(report), '/explore/profile-1');
  assert.deepEqual(reportSnapshotEntries(report.target_snapshot), [
    { key: 'display_name', label: '主页昵称', value: '白羊' },
    { key: 'role_type', label: '用户身份', value: '玩家' },
  ]);
});

test('report target links use the containing public page when the report targets a comment', () => {
  assert.equal(reportTargetPath({
    id: 'report-2',
    target_type: 'comment',
    target_id: 'comment-1',
    reason: '辱骂攻击',
    target_snapshot: { ranking_id: 'ranking-1' },
  }), '/rankings/ranking-1');
});

test('reopening a report only restores content that still has the recorded handled status', () => {
  assert.equal(reportHandlingHidTarget({
    targetType: 'ranking',
    before: 'approved',
    after: 'rejected',
  }), true);
  assert.deepEqual(decideReportTargetRestore({
    targetType: 'ranking',
    before: 'approved',
    after: 'rejected',
    current: 'rejected',
    handledContentFingerprint: 'same-fingerprint',
    currentContentFingerprint: 'same-fingerprint',
  }), { restore: true, reason: 'restore' });
  assert.deepEqual(decideReportTargetRestore({
    targetType: 'ranking',
    before: 'approved',
    after: 'rejected',
    current: 'pending',
    handledContentFingerprint: 'same-fingerprint',
    currentContentFingerprint: 'same-fingerprint',
  }), { restore: false, reason: 'target_changed' });
});

test('legacy report history without target statuses reopens without changing content', () => {
  assert.deepEqual(decideReportTargetRestore({
    targetType: 'profile',
    before: null,
    after: null,
    current: 'hidden',
  }), { restore: false, reason: 'missing_status_history' });
  assert.match(reportReopenConfirmation({
    targetType: 'profile',
    before: null,
    after: null,
  }), /不会改动原内容/);
});

test('reopening never restores a target whose public content changed after handling', () => {
  assert.deepEqual(decideReportTargetRestore({
    targetType: 'commission',
    before: 'approved',
    after: 'rejected',
    current: 'rejected',
    handledContentFingerprint: 'handled-version',
    currentContentFingerprint: 'newer-version',
  }), { restore: false, reason: 'target_content_changed' });
  assert.deepEqual(decideReportTargetRestore({
    targetType: 'commission',
    before: 'approved',
    after: 'rejected',
    current: 'rejected',
  }), { restore: false, reason: 'missing_content_fingerprint' });
});

test('reopening a prior restore does not hide the target again', () => {
  assert.deepEqual(decideReportTargetRestore({
    targetType: 'profile',
    before: 'hidden',
    after: 'visible',
    current: 'visible',
  }), { restore: false, reason: 'no_target_hide' });
});
