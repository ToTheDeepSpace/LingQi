const GENERIC_CITY_VALUES = new Set(['all', 'preferred', '全部', '全部城市', '我的城市']);

export function cityReputationTitle(city?: string | null) {
  const value = String(city || '').trim();
  if (!value || GENERIC_CITY_VALUES.has(value)) return '城市口碑';
  if (value.endsWith('口碑')) return value;
  return `${value}口碑`;
}
