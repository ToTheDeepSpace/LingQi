import assert from 'node:assert/strict';
import test from 'node:test';
import { assessRankingAuthorEdit } from '../api/rankingAuthorEditPolicy.js';

const base = {
  content: '这家店的沙发很舒服，工作人员处理问题也很及时。',
  subject_url: null,
  event_date: '2026-07-10',
  event_script_name: '旧日回响',
  event_store_name: '沉浸剧场',
};

test('allows typo corrections and a small contextual addition', () => {
  const result = assessRankingAuthorEdit(base, {
    content: '这家店的沙发很舒服，工作人员处理问题也很及时。补充：当天是周末晚场。',
  });
  assert.equal(result.allowed, true);
  assert.equal(result.changes[0]?.field, 'content');
});

test('rejects replacing the original account with a different story', () => {
  const result = assessRankingAuthorEdit(base, {
    content: '另一位DM迟到了两个小时，还临时更换了剧本和角色。',
  });
  assert.equal(result.allowed, false);
  assert.match(result.reason || '', /幅度过大/);
});

test('rejects attempts to change immutable identity fields', () => {
  const result = assessRankingAuthorEdit(base, {
    content: base.content,
    subject_name: '另一家店',
  });
  assert.equal(result.allowed, false);
  assert.match(result.reason || '', /评价对象/);
});

test('allows correcting event context without changing the body', () => {
  const result = assessRankingAuthorEdit(base, {
    event_date: '2026-07-11',
    event_script_name: '旧日回声',
  });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.changes.map(change => change.field), ['event_date', 'event_script_name']);
});

