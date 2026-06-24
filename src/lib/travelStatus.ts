export const RESIDENT_TRAVEL_STATUS = '常驻所在城市';

export function normalizeTravelStatus(value?: string | null) {
  if (!value || value === '常驻本地') return RESIDENT_TRAVEL_STATUS;
  return value;
}

export function formatTravelStatus(value?: string | null, city?: string | null) {
  const normalized = normalizeTravelStatus(value);
  if (normalized !== RESIDENT_TRAVEL_STATUS) return normalized;
  const cleanCity = (city || '').trim();
  return cleanCity ? `常驻${cleanCity}` : RESIDENT_TRAVEL_STATUS;
}
