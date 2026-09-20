import { createHash } from 'node:crypto';
import type { ProviderListingDraft } from './providerMarketplace.js';

export const FREE_LISTING_LIMIT = 100;
export const FREE_LISTING_DAYS = 365;
// Enable only after the compatible miniapp release is public. Existing grants survive a pause.
export const listingPromotionEnabled = () => process.env.PROVIDER_LISTING_FREE_CAMPAIGN_ENABLED === '1';
type Row = Record<string, unknown>;
export type ListingSql = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Row[] }> };
const fail = (message: string) => Object.assign(new Error(message), { statusCode: 409 });

// Derived only from server-authenticated identifiers, never from request payload.
export function listingIdentityKeys(profile: Row): string[] {
  const keys = [`profile:${profile.id}`];
  if (profile.reputation_identity_id) keys.push(`identity:${profile.reputation_identity_id}`);
  if (profile.phone_verified_at && profile.phone) keys.push(`phone:${profile.phone}`);
  if (profile.wechat_unionid) keys.push(`union:${profile.wechat_unionid}`);
  if (profile.wechat_mini_openid) keys.push(`mini:${profile.wechat_mini_openid}`);
  return keys.map(key => createHash('sha256').update(`jumulu-listing-v1:${key}`).digest('hex'));
}

export function listingEntitlementActive(listing: Row | null | undefined, now = Date.now()): boolean {
  if (!listing) return false;
  if (listing.free_listing_expires_at == null) return true; // Preserve historical paid/legacy rights.
  const expires = new Date(String(listing.free_listing_expires_at)).getTime();
  return Number.isFinite(expires) && expires > now;
}

export async function getListingPromotion(db: ListingSql, profile: Row) {
  const result = await db.query(
    `select (select count(*)::int from lc_provider_listing_free_grants) as used,
       (select row_to_json(g) from lc_provider_listing_free_grants g where g.profile_id=$1) as grant,
       exists(select 1 from lc_provider_listing_free_grants where profile_id<>$1 and identity_keys && $2::text[]) as identity_used`,
    [profile.id, listingIdentityKeys(profile)],
  );
  const row = result.rows[0];
  const grant = row?.grant as Row | null;
  return {
    limit: FREE_LISTING_LIMIT, days: FREE_LISTING_DAYS,
    remaining: Math.max(0, FREE_LISTING_LIMIT - Number(row?.used || 0)),
    enabled: listingPromotionEnabled(),
    eligible: listingPromotionEnabled() && !grant && !row?.identity_used && Number(row?.used || 0) < FREE_LISTING_LIMIT,
    started_at: grant?.started_at || null,
    expires_at: grant?.expires_at || null,
    slot: grant?.slot || null,
    identity_used: Boolean(row?.identity_used),
  };
}

// Caller owns BEGIN/COMMIT. Grant and both public/private listing records are atomic.
export async function approveProviderListing(db: ListingSql, input: {
  profileId: string; reviewId: string; draft: ProviderListingDraft;
  businessContact: string; contactAvailable: boolean; active: boolean;
}) {
  await db.query("select pg_advisory_xact_lock(hashtext('jumulu_listing_first_100_v1'))");
  const profile = (await db.query('select * from lc_profiles where id=$1 for update', [input.profileId])).rows[0];
  if (!profile || profile.merged_into || profile.is_banned) throw fail('账号不可用，请重新核对审核对象');
  const listing = (await db.query('select * from lc_provider_listings where profile_id=$1 for update', [input.profileId])).rows[0];
  const paid = (await db.query(
    `select id from lc_service_purchases where profile_id=$1 and target_id=$1
       and product_type='provider_listing' and status='paid' for share`, [input.profileId],
  )).rows[0];
  let expiresAt: unknown = listing?.free_listing_expires_at || null;
  if (paid) expiresAt = null;
  else if (!listingEntitlementActive(listing)) {
    const promotion = await getListingPromotion(db, profile);
    if (promotion.expires_at) {
      if (new Date(String(promotion.expires_at)).getTime() <= Date.now()) throw fail('免费上架已到期，请用户确认续费后再审核；不会自动扣费');
      expiresAt = promotion.expires_at;
    } else {
      if (!promotion.enabled) throw fail('免费上架活动尚未开放，请完成上架支付后再审核');
      if (promotion.identity_used) throw fail('该服务者已使用免费名额，请核对关联账号；不得重复领取');
      if (!promotion.eligible) throw fail('100个免费名额已用完，请用户完成上架支付后再审核；当前内容仍保持待审');
      const granted = await db.query(
        `insert into lc_provider_listing_free_grants(profile_id,identity_keys,slot,review_id,started_at,expires_at)
         values($1,$2,$3,$4,now(),now()+interval '365 days') returning expires_at`,
        [input.profileId, listingIdentityKeys(profile), FREE_LISTING_LIMIT - promotion.remaining + 1, input.reviewId],
      );
      expiresAt = granted.rows[0].expires_at;
    }
  }
  const draft = input.draft;
  await db.query(
    `insert into lc_provider_listings(profile_id,poster_url,headline,description,height_cm,weight_kg,role_types,is_active,initial_purchase_id,free_listing_expires_at,updated_at)
     values($1,$2,$3,$4,$5,$6,$7::text[],$8,$9,$10,now())
     on conflict(profile_id) do update set poster_url=excluded.poster_url,headline=excluded.headline,
       description=excluded.description,height_cm=excluded.height_cm,weight_kg=excluded.weight_kg,
       role_types=excluded.role_types,is_active=excluded.is_active,
       initial_purchase_id=coalesce(excluded.initial_purchase_id,lc_provider_listings.initial_purchase_id),
       free_listing_expires_at=excluded.free_listing_expires_at,updated_at=now()`,
    [input.profileId,draft.poster_url,draft.headline,draft.description,draft.height_cm,draft.weight_kg,
      draft.role_types,input.active,paid?.id || null,expiresAt],
  );
  await db.query(
    `insert into lc_provider_contacts(profile_id,business_contact,is_available,reviewed_at,updated_at)
     values($1,$2,$3,now(),now()) on conflict(profile_id) do update set business_contact=excluded.business_contact,
       is_available=excluded.is_available,reviewed_at=now(),updated_at=now()`,
    [input.profileId,input.businessContact,input.contactAvailable],
  );
}
