import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeProviderListingDraft,
  providerInquiryPayload,
  publicProviderListing,
} from '../api/providerMarketplace.js';

test('provider listing enforces integer measurement ranges and normalizes role types', () => {
  const draft = normalizeProviderListingDraft({
    posterUrl: '/uploads/provider.jpg',
    heightCm: '178',
    weightKg: 65,
    roleTypes: '强势位，温柔陪伴, 强势位',
  });
  assert.equal(draft.height_cm, 178);
  assert.equal(draft.weight_kg, 65);
  assert.deepEqual(draft.role_types, ['强势位', '温柔陪伴']);
  assert.throws(() => normalizeProviderListingDraft({ posterUrl: 'x', heightCm: 178.5 }), /整数/);
  assert.throws(() => normalizeProviderListingDraft({ posterUrl: 'x', weightKg: 301 }), /30-300/);
});

test('public provider listing has an explicit allowlist', () => {
  const publicRow = publicProviderListing({
    profile_id: 'profile-1',
    poster_url: '/uploads/provider.jpg',
    headline: '周末可约',
    role_types: ['情感位'],
    private_contact: 'never-public',
    internal_note: 'never-public',
  });
  assert.equal(publicRow.profile_id, 'profile-1');
  assert.equal('private_contact' in publicRow, false);
  assert.equal('internal_note' in publicRow, false);
});

test('provider inquiry contacts unlock only after acceptance', () => {
  const submitted = providerInquiryPayload(
    { id: 'i-1', provider_id: 'p-1', requester_id: 'r-1', requester_name: '泡泡', message: '想约周末', status: 'submitted' },
    { requester: 'requester-contact', provider: 'provider-contact' },
  );
  assert.equal(submitted.contacts, null);

  const accepted = providerInquiryPayload(
    { id: 'i-1', provider_id: 'p-1', requester_id: 'r-1', requester_name: '泡泡', message: '想约周末', status: 'accepted' },
    { requester: 'requester-contact', provider: 'provider-contact' },
  );
  assert.deepEqual(accepted.contacts, { requester: 'requester-contact', provider: 'provider-contact' });
});
