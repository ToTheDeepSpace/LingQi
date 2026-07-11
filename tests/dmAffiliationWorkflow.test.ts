import assert from 'node:assert/strict';
import test from 'node:test';
import { isStoreConfirmedAffiliation, preferredPublicDmAffiliation } from '../api/dmAffiliationWorkflow.js';

test('prefers a store-confirmed relationship over pending and historical rows', () => {
  const selected = preferredPublicDmAffiliation([
    { id: 'legacy', status: 'legacy_unverified' },
    { id: 'pending', status: 'pending' },
    { id: 'approved', status: 'approved' },
  ]);

  assert.equal(selected?.id, 'approved');
  assert.equal(isStoreConfirmedAffiliation(selected), true);
});

test('never treats a historical store field as store confirmation', () => {
  const selected = preferredPublicDmAffiliation([
    { id: 'ended', status: 'ended' },
    { id: 'legacy', status: 'legacy_unverified' },
  ]);

  assert.equal(selected?.id, 'legacy');
  assert.equal(isStoreConfirmedAffiliation(selected), false);
});

test('does not expose rejected, ended or cancelled rows as current affiliation', () => {
  assert.equal(preferredPublicDmAffiliation([
    { status: 'rejected' },
    { status: 'ended' },
    { status: 'cancelled' },
  ]), null);
});
