import assert from 'node:assert/strict';
import test from 'node:test';
import { rankingActivityTime, rankingRecentDiscussionScore, sortRankingFeed } from '../api/rankingFeed.js';

test('latest feed uses meaningful activity instead of paid boost value', () => {
  const rows = [
    { id: 'old-rich', created_at: '2026-01-01T00:00:00Z', last_activity_at: '2026-01-01T00:00:00Z', boost_amount: 9999 },
    { id: 'new', created_at: '2026-07-01T00:00:00Z', last_activity_at: '2026-07-01T00:00:00Z', boost_amount: 0 },
  ];
  assert.deepEqual(sortRankingFeed(rows, 'latest').map(row => row.id), ['new', 'old-rich']);
});

test('activity falls back to creation time for historical rows', () => {
  const row = { created_at: '2026-06-01T12:00:00Z' };
  assert.equal(rankingActivityTime(row), new Date(row.created_at).getTime());
});

test('recent discussion uses unique free-vote participation with time decay', () => {
  const now = new Date('2026-07-14T00:00:00Z').getTime();
  const active = { created_at: '2026-07-13T00:00:00Z', agree_count: 8, oppose_count: 2, joys: 1 };
  const stale = { created_at: '2026-04-01T00:00:00Z', agree_count: 500, oppose_count: 0, joys: 0 };
  assert.ok(rankingRecentDiscussionScore(active, now) > rankingRecentDiscussionScore(stale, now));
});

test('feed accepts PostgreSQL Date objects before JSON serialization', () => {
  const now = new Date('2026-07-14T00:00:00.000Z').getTime();
  const rows = [
    { id: 'fresh', last_activity_at: new Date('2026-07-13T00:00:00.000Z'), agree_count: 0 },
    { id: 'discussed', last_activity_at: new Date('2026-07-12T00:00:00.000Z'), agree_count: 2 },
  ];

  assert.equal(sortRankingFeed(rows, 'discussed', now)[0].id, 'discussed');
});
