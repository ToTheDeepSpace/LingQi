export type AccountRestrictionScope = 'publish' | 'account';

export type AccountRestrictionProfile = {
  is_banned?: boolean | null;
  merged_into?: string | null;
  restriction_scope?: string | null;
  restriction_ends_at?: string | null;
};

export type AccountAccessDecision = {
  allowed: boolean;
  state: 'active' | 'merged' | 'restricted' | 'expired';
  code?: 'ACCOUNT_MERGED' | 'ACCOUNT_RESTRICTED';
  scope?: AccountRestrictionScope;
};

export function normalizeRestrictionScope(value: unknown): AccountRestrictionScope {
  return value === 'publish' ? 'publish' : 'account';
}

export function restrictionHasExpired(profile: AccountRestrictionProfile, now = Date.now()) {
  if (!profile.is_banned || !profile.restriction_ends_at) return false;
  const endsAt = Date.parse(profile.restriction_ends_at);
  return Number.isFinite(endsAt) && endsAt <= now;
}

export function accountAccessDecision(
  profile: AccountRestrictionProfile,
  method: string,
  now = Date.now(),
): AccountAccessDecision {
  if (profile.merged_into) {
    return { allowed: false, state: 'merged', code: 'ACCOUNT_MERGED' };
  }
  if (!profile.is_banned) return { allowed: true, state: 'active' };
  if (restrictionHasExpired(profile, now)) return { allowed: true, state: 'expired' };

  const scope = normalizeRestrictionScope(profile.restriction_scope);
  const readOnly = method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD';
  if (scope === 'publish' && readOnly) return { allowed: true, state: 'restricted', scope };
  return { allowed: false, state: 'restricted', code: 'ACCOUNT_RESTRICTED', scope };
}

export function restrictionBlocksLogin(profile: AccountRestrictionProfile, now = Date.now()) {
  if (profile.merged_into) return false;
  if (!profile.is_banned || restrictionHasExpired(profile, now)) return false;
  return normalizeRestrictionScope(profile.restriction_scope) === 'account';
}
