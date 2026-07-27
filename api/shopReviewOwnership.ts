function text(value: unknown, max = 180) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function normalizedShopIdentity(value: unknown) {
  return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

export function shopCanManageRanking(
  profile: Record<string, unknown>,
  ranking: Record<string, unknown>,
  ownedStores: Record<string, unknown>[],
) {
  if (ranking.subject_type !== 'store' || ownedStores.length === 0) return false;
  const ownedIds = new Set(ownedStores.map(store => text(store.id, 80)).filter(Boolean));
  const subjectDossierId = text(ranking.subject_dossier_id, 80);
  if (subjectDossierId) return ownedIds.has(subjectDossierId);
  const ownedNames = new Set([
    ...ownedStores.map(store => normalizedShopIdentity(store.dm_name)),
    normalizedShopIdentity(profile.shop_name),
    normalizedShopIdentity(profile.display_name),
  ].filter(Boolean));
  return ownedNames.has(normalizedShopIdentity(ranking.subject_name));
}
