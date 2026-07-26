import type { Dossier } from '../types'

export type DossierSortMode = 'comprehensive' | 'rating' | 'verified' | 'photo' | 'newest'

function compareNumberDesc(left: number, right: number) {
  return right - left
}

function hasRating(item: Dossier) {
  return item.rating_summary?.avg !== null && Number(item.rating_summary?.player_count || 0) > 0
}

function hasPhoto(item: Dossier) {
  return Boolean(item.photo_url?.trim() || item.photo_files?.length)
}

function isVerified(item: Dossier) {
  return item.claim_status === 'approved'
}

function comprehensiveComparator(left: Dossier, right: Dossier) {
  return compareNumberDesc(Number(hasRating(left)), Number(hasRating(right)))
    || compareNumberDesc(Number(isVerified(left)), Number(isVerified(right)))
    || compareNumberDesc(Number(hasPhoto(left)), Number(hasPhoto(right)))
    || compareNumberDesc(Number(left.rating_summary?.avg || 0), Number(right.rating_summary?.avg || 0))
    || compareNumberDesc(Number(left.rating_summary?.player_count || 0), Number(right.rating_summary?.player_count || 0))
}

function selectedComparator(mode: DossierSortMode, left: Dossier, right: Dossier) {
  if (mode === 'rating') {
    return compareNumberDesc(Number(hasRating(left)), Number(hasRating(right)))
      || compareNumberDesc(Number(left.rating_summary?.avg || 0), Number(right.rating_summary?.avg || 0))
      || compareNumberDesc(Number(left.rating_summary?.player_count || 0), Number(right.rating_summary?.player_count || 0))
      || comprehensiveComparator(left, right)
  }
  if (mode === 'verified') {
    return compareNumberDesc(Number(isVerified(left)), Number(isVerified(right)))
      || comprehensiveComparator(left, right)
  }
  if (mode === 'photo') {
    return compareNumberDesc(Number(hasPhoto(left)), Number(hasPhoto(right)))
      || comprehensiveComparator(left, right)
  }
  if (mode === 'newest') {
    return String(right.created_at || '').localeCompare(String(left.created_at || ''))
      || comprehensiveComparator(left, right)
  }
  return comprehensiveComparator(left, right)
}

export function sortDossiers<T extends Dossier>(
  items: readonly T[],
  mode: DossierSortMode,
  chantoFirst = false,
) {
  return [...items].sort((left, right) => {
    if (chantoFirst) {
      const byHasChanto = compareNumberDesc(
        Number(Number(left.chanto_summary?.total || 0) > 0),
        Number(Number(right.chanto_summary?.total || 0) > 0),
      )
      if (byHasChanto) return byHasChanto

      const byChantoTotal = compareNumberDesc(
        Number(left.chanto_summary?.total || 0),
        Number(right.chanto_summary?.total || 0),
      )
      if (byChantoTotal) return byChantoTotal
    }

    return selectedComparator(mode, left, right)
      || String(left.dm_name || '').localeCompare(String(right.dm_name || ''), 'zh-CN')
      || left.id.localeCompare(right.id)
  })
}
