import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeDmRatingRows } from '../api/dmRatingSummary.js';

test('weights each player once after averaging that player reviews', () => {
  const summary = summarizeDmRatingRows([
    { id: 'a-1', profile_id: 'player-a', rating: 5 },
    { id: 'a-2', profile_id: 'player-a', rating: 1 },
    { id: 'b-1', profile_id: 'player-b', rating: 5 },
  ]);

  assert.deepEqual(summary, {
    avg: 4,
    review_count: 3,
    player_count: 2,
    sample_status: 'insufficient',
  });
});

test('marks the score stable from three independent players', () => {
  const summary = summarizeDmRatingRows([
    { id: 'a-1', profile_id: 'player-a', rating: 5 },
    { id: 'b-1', profile_id: 'player-b', rating: 4 },
    { id: 'c-1', profile_id: 'player-c', rating: 3 },
  ]);

  assert.equal(summary.avg, 4);
  assert.equal(summary.player_count, 3);
  assert.equal(summary.sample_status, 'stable');
});
