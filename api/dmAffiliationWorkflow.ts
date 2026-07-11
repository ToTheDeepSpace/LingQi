export type DmAffiliationStatus = 'approved' | 'pending' | 'legacy_unverified' | 'rejected' | 'ended' | 'cancelled';

export type DmAffiliationLike = {
  status?: string | null;
};

const PUBLIC_STATUS_PRIORITY: DmAffiliationStatus[] = ['approved', 'pending', 'legacy_unverified'];

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
