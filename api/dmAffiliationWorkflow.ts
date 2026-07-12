export type DmAffiliationStatus = 'approved' | 'pending' | 'legacy_unverified' | 'rejected' | 'ended' | 'cancelled';

export type DmAffiliationLike = {
  status?: string | null;
  dm_dossier_id?: string | null;
  store_dossier_id?: string | null;
};

const PUBLIC_STATUS_PRIORITY: DmAffiliationStatus[] = ['pending', 'approved', 'legacy_unverified'];

export function preferredPublicDmAffiliation<T extends DmAffiliationLike>(rows: T[]): T | null {
  for (const status of PUBLIC_STATUS_PRIORITY) {
    const match = rows.find(row => row.status === status);
    if (match) return match;
  }
  return null;
}

export function isStoreConfirmedAffiliation(row?: DmAffiliationLike | null) {
  return row?.status === 'approved';
}

export function conflictsWhenMergingDmDossiers(source: DmAffiliationLike, targetRows: DmAffiliationLike[]) {
  return targetRows.some(target => (
    target.status === source.status
    && (
      source.status === 'approved'
      || source.status === 'pending'
      || (source.status === 'legacy_unverified' && target.store_dossier_id === source.store_dossier_id)
    )
  ));
}

export function conflictsWhenMergingStoreDossiers(source: DmAffiliationLike, targetRows: DmAffiliationLike[]) {
  return source.status === 'legacy_unverified'
    && targetRows.some(target => (
      target.status === 'legacy_unverified'
      && target.dm_dossier_id === source.dm_dossier_id
    ));
}
