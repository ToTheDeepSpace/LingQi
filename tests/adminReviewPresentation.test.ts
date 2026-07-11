import assert from 'node:assert/strict';
import test from 'node:test';
import { ADMIN_REVIEW_ACTIONS, summarizeProfileReviewPayload } from '../src/lib/adminReviewPresentation.js';

test('profile review summary hides internal fields and shows readable before/after values', () => {
  const lines = summarizeProfileReviewPayload({
    profile_patch: {
      display_name: '新昵称',
      tags: ['推理', '情感'],
      social_links: {},
      social_snapshots: {},
      avatar_focus_x: 50,
      avatar_focus_y: 25,
      contact_unlock_enabled: false,
    },
    before_snapshot: {
      display_name: '旧昵称',
      tags: [],
      social_links: {},
      avatar_focus_x: 40,
      avatar_focus_y: 20,
      contact_unlock_enabled: true,
    },
    changed_fields: ['display_name', 'tags', 'social_links', 'social_snapshots', 'avatar_focus_x', 'avatar_focus_y', 'contact_unlock_enabled'],
  });

  assert.deepEqual(lines, [
    '昵称：旧昵称 → 新昵称',
    '个人标签：未填写 → 推理、情感',
    '头像展示位置：已调整',
    '联系方式解锁：开启 → 关闭',
  ]);
  assert.equal(lines.some(line => line.includes('social_snapshots')), false);
});

test('legacy profile review still hides database field names', () => {
  const lines = summarizeProfileReviewPayload({
    profile_patch: {
      display_name: '用户',
      travel_status: '常驻所在城市',
      avatar_focus_x: 50,
      avatar_focus_y: 25,
      social_snapshots: {},
    },
  });
  assert.deepEqual(lines, ['昵称：用户', '常驻状态：常驻所在城市', '头像展示位置：已调整']);
});

test('admin review action map covers public and DM review history', () => {
  assert.equal(ADMIN_REVIEW_ACTIONS.admin_public_review_approved.outcome, 'approved');
  assert.equal(ADMIN_REVIEW_ACTIONS.admin_dm_rating_rejected.label, 'DM评分审核');
});
