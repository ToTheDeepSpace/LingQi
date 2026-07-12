export type DmClaimStatus = 'unclaimed' | 'pending' | 'approved' | 'rejected' | 'withdrawn' | string | null | undefined;

export type PublicDmAffiliation = {
  status: 'approved' | 'pending' | 'legacy_unverified';
  store_dossier_id?: string | null;
  store_name?: string | null;
  source?: 'store_confirmed' | 'self_declared' | 'community_unverified' | 'legacy_unverified';
};

export function dmClaimLabel(status: DmClaimStatus) {
  if (status === 'approved') return '已认证';
  if (status === 'pending') return '认领审核中';
  if (status === 'withdrawn') return '认证已撤销';
  return '未认领';
}

export function dmAffiliationLabel(input: {
  affiliation?: PublicDmAffiliation | null;
  claimStatus?: DmClaimStatus;
  employmentStatus?: 'unknown' | 'store_affiliated' | 'freelance' | string | null;
}) {
  const { affiliation, claimStatus, employmentStatus } = input;
  const storeName = affiliation?.store_name || '店家';
  if (affiliation?.status === 'approved') return `${storeName} 已确认任职`;
  if (affiliation?.status === 'pending') {
    if (affiliation.source === 'community_unverified') return `社区提供：任职于 ${storeName}`;
    if (affiliation.source === 'self_declared' && claimStatus === 'approved') return `DM本人提供：任职于 ${storeName}`;
    return `资料提供：任职于 ${storeName}`;
  }
  if (affiliation?.status === 'legacy_unverified') return `社区提供：任职于 ${storeName}`;
  if (employmentStatus === 'freelance' && claimStatus === 'approved') return 'DM本人提供：自由 DM';
  if (claimStatus === 'approved') return '暂无已确认店家';
  return '暂无受雇店家资料';
}
