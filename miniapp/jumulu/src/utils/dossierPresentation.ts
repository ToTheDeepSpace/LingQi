import type { Dossier } from '../types'

export function dossierClaimLabel(status?: string | null) {
  if (status === 'approved') return 'DM 身份已认证'
  if (status === 'pending') return '身份认证审核中'
  if (status === 'withdrawn') return '原身份认证已撤销'
  return '未认领 DM 档案'
}

export function storeClaimLabel(status?: string | null) {
  if (status === 'approved') return '店家已认领'
  if (status === 'pending') return '经营者认领审核中'
  if (status === 'withdrawn') return '原经营者认领已撤销'
  return '未认领店家档案'
}

export function dossierAffiliationLabel(dossier: Dossier) {
  const affiliation = dossier.affiliation
  const storeName = affiliation?.store_name || '店家'

  if (affiliation?.status === 'approved') return `${storeName} 已确认任职`
  if (affiliation?.status === 'pending') {
    if (affiliation.source === 'community_unverified') return `社区提供：任职于 ${storeName}`
    if (affiliation.source === 'self_declared' && dossier.claim_status === 'approved') return `DM本人提供：任职于 ${storeName}`
    return `资料提供：任职于 ${storeName}`
  }
  if (affiliation?.status === 'legacy_unverified') return `社区提供：任职于 ${storeName}`
  if (dossier.employment_status === 'freelance' && dossier.claim_status === 'approved') return 'DM本人提供：自由 DM'
  if (dossier.claim_status === 'approved') return '暂无已确认店家'
  return '暂无受雇店家资料'
}
