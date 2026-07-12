import assert from 'node:assert/strict';
import test from 'node:test';
import {
  conflictsWhenMergingDmDossiers,
  conflictsWhenMergingStoreDossiers,
  isStoreConfirmedAffiliation,
  preferredPublicDmAffiliation,
} from '../api/dmAffiliationWorkflow.js';

test('prefers the latest active declaration while a store confirmation is pending', () => {
  const selected = preferredPublicDmAffiliation([
    { id: 'legacy', status: 'legacy_unverified' },
    { id: 'pending', status: 'pending' },
    { id: 'approved', status: 'approved' },
  ]);

  assert.equal(selected?.id, 'pending');
  assert.equal(isStoreConfirmedAffiliation(selected), false);
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

test('keeps the target active relationship when duplicate DM dossiers are merged', () => {
  assert.equal(conflictsWhenMergingDmDossiers(
    { status: 'approved', store_dossier_id: 'store-b' },
    [{ status: 'approved', store_dossier_id: 'store-a' }],
  ), true);
  assert.equal(conflictsWhenMergingDmDossiers(
    { status: 'pending', store_dossier_id: 'store-b' },
    [{ status: 'approved', store_dossier_id: 'store-a' }],
  ), false);
});

test('deduplicates only the same historical DM-store pair during dossier merges', () => {
  assert.equal(conflictsWhenMergingDmDossiers(
    { status: 'legacy_unverified', store_dossier_id: 'store-a' },
    [{ status: 'legacy_unverified', store_dossier_id: 'store-a' }],
  ), true);
  assert.equal(conflictsWhenMergingDmDossiers(
    { status: 'legacy_unverified', store_dossier_id: 'store-b' },
    [{ status: 'legacy_unverified', store_dossier_id: 'store-a' }],
  ), false);
  assert.equal(conflictsWhenMergingStoreDossiers(
    { status: 'legacy_unverified', dm_dossier_id: 'dm-a' },
    [{ status: 'legacy_unverified', dm_dossier_id: 'dm-a' }],
  ), true);
});
