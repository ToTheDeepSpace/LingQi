export const PROVIDER_ROLE_TYPE_LIMIT = 12;

export type ProviderListingDraft = {
  poster_url: string;
  headline: string;
  description: string;
  height_cm: number | null;
  weight_kg: number | null;
  role_types: string[];
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function optionalInteger(value: unknown, min: number, max: number, label: string) {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) {
    throw new Error(`${label}需填写 ${min}-${max} 之间的整数`);
  }
  return numberValue;
}

export function normalizeProviderRoleTypes(value: unknown) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[，,\n]/)
      : [];
  const result: string[] = [];
  for (const raw of source) {
    const item = cleanText(raw, 30);
    if (item && !result.includes(item)) result.push(item);
    if (result.length >= PROVIDER_ROLE_TYPE_LIMIT) break;
  }
  return result;
}

export function normalizeProviderListingDraft(value: unknown): ProviderListingDraft {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const posterUrl = cleanText(input.posterUrl ?? input.poster_url, 1200);
  if (!posterUrl) throw new Error('请上传一张委托条主图');
  return {
    poster_url: posterUrl,
    headline: cleanText(input.headline, 80),
    description: cleanText(input.description, 1200),
    height_cm: optionalInteger(input.heightCm ?? input.height_cm, 100, 250, '身高'),
    weight_kg: optionalInteger(input.weightKg ?? input.weight_kg, 30, 300, '体重'),
    role_types: normalizeProviderRoleTypes(input.roleTypes ?? input.role_types),
  };
}

export function publicProviderListing(row: Record<string, unknown>) {
  return {
    profile_id: cleanText(row.profile_id, 80),
    poster_url: cleanText(row.poster_url, 1200),
    headline: cleanText(row.headline, 80) || null,
    description: cleanText(row.description, 1200) || null,
    height_cm: optionalInteger(row.height_cm, 100, 250, '身高'),
    weight_kg: optionalInteger(row.weight_kg, 30, 300, '体重'),
    role_types: normalizeProviderRoleTypes(row.role_types),
    is_active: row.is_active !== false,
    created_at: cleanText(row.created_at, 80) || null,
    updated_at: cleanText(row.updated_at, 80) || null,
  };
}

export function providerInquiryPayload(
  row: Record<string, unknown>,
  contacts?: { requester: unknown; provider: unknown },
) {
  const accepted = row.status === 'accepted';
  return {
    id: cleanText(row.id, 80),
    provider_id: cleanText(row.provider_id, 80),
    requester_id: cleanText(row.requester_id, 80),
    requester_name: cleanText(row.requester_name, 120) || '用户',
    message: cleanText(row.message, 1200),
    status: row.status === 'accepted' || row.status === 'rejected' ? row.status : 'submitted',
    created_at: cleanText(row.created_at, 80) || null,
    decided_at: cleanText(row.decided_at, 80) || null,
    contacts: accepted && contacts
      ? {
          requester: cleanText(contacts.requester, 300),
          provider: cleanText(contacts.provider, 300),
        }
      : null,
  };
}
