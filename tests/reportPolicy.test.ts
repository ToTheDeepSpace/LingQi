import assert from 'node:assert/strict';
import test from 'node:test';
import { privacyReportDetailError } from '../src/lib/reportPolicy.js';
import {
  reportInformationGap,
  reportSnapshotEntries,
  reportTargetLocation,
  reportTargetPath,
} from '../src/lib/reportPresentation.js';

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
