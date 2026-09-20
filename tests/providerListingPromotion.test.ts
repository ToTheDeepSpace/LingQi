import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { FREE_LISTING_DAYS, FREE_LISTING_LIMIT, listingEntitlementActive, listingIdentityKeys, listingPromotionEnabled } from '../api/providerListingPromotion.js';

test('free listing is limited to 100 identities for 365 days', () => {
  assert.equal(FREE_LISTING_LIMIT, 100);
  assert.equal(FREE_LISTING_DAYS, 365);
});
test('campaign requires an explicit release activation', () => {
  const previous = process.env.PROVIDER_LISTING_FREE_CAMPAIGN_ENABLED;
  try {
    delete process.env.PROVIDER_LISTING_FREE_CAMPAIGN_ENABLED;
    assert.equal(listingPromotionEnabled(), false);
    process.env.PROVIDER_LISTING_FREE_CAMPAIGN_ENABLED = '1';
    assert.equal(listingPromotionEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env.PROVIDER_LISTING_FREE_CAMPAIGN_ENABLED;
    else process.env.PROVIDER_LISTING_FREE_CAMPAIGN_ENABLED = previous;
  }
});
test('preserves historical rights but fails closed for expired or malformed grants', () => {
  const now = Date.parse('2026-09-20T00:00:00Z');
  assert.equal(listingEntitlementActive(null, now), false);
  assert.equal(listingEntitlementActive({}, now), true);
  assert.equal(listingEntitlementActive({ free_listing_expires_at: null }, now), true);
  assert.equal(listingEntitlementActive({ free_listing_expires_at: '2027-09-20T00:00:00Z' }, now), true);
  assert.equal(listingEntitlementActive({ free_listing_expires_at: '2026-09-20T00:00:00Z' }, now), false);
  assert.equal(listingEntitlementActive({ free_listing_expires_at: 'invalid' }, now), false);
});
test('known shared verified credentials identify repeat applicants without storing plaintext', () => {
  const a = listingIdentityKeys({ id: 'a', phone: '13800000000', phone_verified_at: 'verified' });
  const b = listingIdentityKeys({ id: 'b', phone: '13800000000', phone_verified_at: 'verified' });
  assert.ok(a.some(key => b.includes(key)));
  assert.ok(a.every(key => /^[a-f0-9]{64}$/.test(key)));
  assert.equal(listingIdentityKeys({ id: 'a', phone: '13800000000' }).length, 1);
});
test('free grants are atomically approved and never assigned by the submission client', () => {
  const source = readFileSync('api/providerListingPromotion.ts', 'utf8');
  assert.match(source, /pg_advisory_xact_lock/);
  assert.ok(source.indexOf('pg_advisory_xact_lock') < source.indexOf('const profile ='));
  assert.match(source, /identity_keys && \$2::text\[\]/);
  assert.match(source, /on conflict\(profile_id\) do update/);
  assert.doesNotMatch(source, /delete from|update lc_provider_listing_free_grants/i);
});
test('message entry is independent of private consultation and navigation is reactive', () => {
  const prototype = readFileSync('prototypes/banxijian-mobile/src/Prototype.tsx', 'utf8');
  const header = prototype.slice(prototype.indexOf('function Header('), prototype.indexOf('function Tabs('));
  assert.match(header, /screen\('messages'\)/);
  assert.doesNotMatch(header, /screen\('chat'/);
  const nav = readFileSync('miniapp/jumulu/src/components/MiniNavBar.vue', 'utf8');
  assert.match(nav, /const showBack = computed/);
  assert.match(nav, /width: 44px; height: 44px/);
  const home = readFileSync('miniapp/jumulu/src/pages/index/index.vue', 'utf8');
  assert.match(home, /@back="leaveCategory"/);
  assert.match(home, /散场后，那段没说完的事/);
});
test('scoreboard uses reviewed community ratings, not paid signals', () => {
  const source = readFileSync('miniapp/jumulu/src/components/DossierScoreBoard.vue', 'utf8');
  assert.match(source, /rating_summary\?\.player_count/);
  assert.match(source, /rating_summary\?\.avg/);
  assert.doesNotMatch(source, /chanto_summary|depositFen|verified_shop/);
});
