type ProfileRecord = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function maskAdminPhone(value: unknown) {
  const phone = text(value);
  if (!phone) return null;
  if (phone.length <= 7) return `${phone.slice(0, 2)}***${phone.slice(-2)}`;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export function maskAdminEmail(value: unknown) {
  const email = text(value);
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at <= 0) return `${email.slice(0, 2)}***`;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export function maskAdminAccountName(value: unknown) {
  const name = text(value);
  if (!name) return null;
  if (name.length === 1) return `${name}***`;
  return `${name.slice(0, 1)}***${name.slice(-1)}`;
}

export function adminProfileListPayload(profile: ProfileRecord) {
  return {
    id: profile.id,
    display_name: profile.display_name,
    phone: maskAdminPhone(profile.phone),
    email: maskAdminEmail(profile.email),
    wechat_nickname: maskAdminAccountName(profile.wechat_nickname),
    auth_provider: profile.auth_provider,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    is_visible: profile.is_visible,
    is_realname: Boolean(profile.is_realname),
    is_banned: Boolean(profile.is_banned),
    is_merged: Boolean(profile.merged_into),
    ban_reason: profile.ban_reason,
    banned_at: profile.banned_at,
    merged_at: profile.merged_at,
    restriction_scope: profile.restriction_scope,
    restriction_ends_at: profile.restriction_ends_at,
    reject_reason: profile.reject_reason,
    role: profile.role,
    role_type: profile.role_type,
    identity_roles: profile.identity_roles,
    verified_dm: Boolean(profile.verified_dm),
    verified_shop: Boolean(profile.verified_shop),
    avatar: profile.avatar,
  };
}

export function adminPrivateAccountPayload(profile: ProfileRecord) {
  return {
    id: profile.id,
    display_name: profile.display_name,
    phone: text(profile.phone) || null,
    email: text(profile.email) || null,
    wechat: text(profile.wechat) || null,
    wechat_nickname: text(profile.wechat_nickname) || null,
    auth_provider: text(profile.auth_provider) || null,
  };
}
