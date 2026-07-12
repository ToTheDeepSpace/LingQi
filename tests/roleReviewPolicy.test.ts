import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRoleReviewLane, summarizeRoleReviewLanes, summarizeRoleReviewRows } from '../api/roleReviewPolicy.js';

test('allows one player to publish one review in each lane without double weighting the total', () => {
  const rows = [
    { id: 'a-1', profile_id: 'player-a', rating: 5, review_lane: 'experience' },
    { id: 'a-2', profile_id: 'player-a', rating: 3, review_lane: 'deep_spoiler' },
    { id: 'b-1', profile_id: 'player-b', rating: 2, review_lane: 'experience' },
  ];

  assert.deepEqual(summarizeRoleReviewRows(rows), { avg: 3, count: 2 });
  assert.deepEqual(summarizeRoleReviewLanes(rows), {
    experience: { avg: 3.5, count: 2 },
    deep_spoiler: { avg: 3, count: 1 },
  });
});

test('maps legacy reviews to the no-spoiler experience lane', () => {
  assert.equal(normalizeRoleReviewLane(undefined), 'experience');
  assert.equal(normalizeRoleReviewLane('deep_spoiler'), 'deep_spoiler');
});
