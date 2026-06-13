export type StoredCreatorAuth = {
  id?: string;
  display_name?: string;
  phone?: string;
  email?: string;
  email_verified_at?: string | null;
  phone_verified_at?: string | null;
  city?: string | null;
  available_cities?: string[] | null;
  token?: string;
  role?: string;
  role_type?: string;
  identity_roles?: string[];
};

type JwtPayload = {
  id?: string;
  exp?: number;
  creatorId?: string;
  sub?: string;
};

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(decodeBase64Url(payload)) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token?: string | null) {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 < Date.now();
}

export function readStoredCreatorAuth(): StoredCreatorAuth | null {
  try {
    const stored = localStorage.getItem('lc_creator');
    if (!stored) return null;
    const data = JSON.parse(stored) as StoredCreatorAuth;
    if (!data.token || isTokenExpired(data.token)) return null;
    const payload = decodeJwtPayload(data.token);
    const id = data.id || payload?.id || payload?.creatorId || payload?.sub;
    if (!id) return null;
    return { ...data, id };
  } catch {
    return null;
  }
}

export function creatorEntryPath() {
  return readStoredCreatorAuth() ? '/dashboard' : '/login';
}
