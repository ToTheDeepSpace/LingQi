export type CommissionCityMatch = 'local' | 'expedition' | null;

type ProfileCityData = {
  city?: unknown;
  available_cities?: unknown;
};

function cleanCity(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function availableCities(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanCity).filter(Boolean);
}

export function commissionCityMatch(profile: ProfileCityData, targetCity: unknown): CommissionCityMatch {
  const target = cleanCity(targetCity);
  if (!target) return null;
  if (cleanCity(profile.city) === target) return 'local';
  return availableCities(profile.available_cities).includes(target) ? 'expedition' : null;
}

export function canApplyToCommission(
  profile: ProfileCityData,
  commission: { city?: unknown; accept_expedition?: unknown },
) {
  const target = cleanCity(commission.city);
  if (!target) return true;
  const match = commissionCityMatch(profile, target);
  if (match === 'local') return true;
  return commission.accept_expedition === true && match === 'expedition';
}
