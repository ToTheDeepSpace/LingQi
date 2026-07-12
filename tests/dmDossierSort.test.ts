import assert from 'node:assert/strict';
import test from 'node:test';
import { sortDmDossiers, type SortableDmDossier } from '../src/lib/dmDossierSort.js';

function dm(id: string, patch: Partial<SortableDmDossier> = {}): SortableDmDossier {
  return { id, dm_name: id, created_at: '2026-01-01T00:00:00.000Z', ...patch };
}

test('comprehensive sorting prioritizes rated, verified and photographed dossiers in that order', () => {
  const items = [
    dm('plain'),
    dm('photo', { photo_url: '/photo.jpg' }),
    dm('verified', { claim_status: 'approved' }),
    dm('rated', { rating_summary: { avg: 3.5, player_count: 1, review_count: 1 } }),
  ];

  assert.deepEqual(sortDmDossiers(items, 'comprehensive').map(item => item.id), [
    'rated', 'verified', 'photo', 'plain',
  ]);
});

test('rating sorting uses score before the default qualification signals', () => {
  const items = [
    dm('verified-low', { claim_status: 'approved', rating_summary: { avg: 3.8, player_count: 4, review_count: 4 } }),
    dm('high', { rating_summary: { avg: 4.9, player_count: 1, review_count: 1 } }),
    dm('unrated-photo', { photo_url: '/photo.jpg' }),
  ];

  assert.deepEqual(sortDmDossiers(items, 'rating').map(item => item.id), [
    'high', 'verified-low', 'unrated-photo',
  ]);
});

test('chanto priority is an independent switch and does not affect comprehensive order when off', () => {
  const rated = dm('rated', { rating_summary: { avg: 4.2, player_count: 2, review_count: 2 } });
  const supported = dm('supported', { chanto_summary: { total: 100, gift_count: 1, supporter_count: 1 } });

  assert.deepEqual(sortDmDossiers([supported, rated], 'comprehensive', false).map(item => item.id), ['rated', 'supported']);
  assert.deepEqual(sortDmDossiers([rated, supported], 'comprehensive', true).map(item => item.id), ['supported', 'rated']);
});

test('chanto priority sorts supported dossiers by approved total before the selected mode', () => {
  const items = [
    dm('ten', { chanto_summary: { total: 10, gift_count: 1, supporter_count: 1 } }),
    dm('hundred', { chanto_summary: { total: 100, gift_count: 2, supporter_count: 2 } }),
    dm('none', { rating_summary: { avg: 5, player_count: 2, review_count: 2 } }),
  ];

  assert.deepEqual(sortDmDossiers(items, 'rating', true).map(item => item.id), ['hundred', 'ten', 'none']);
});
