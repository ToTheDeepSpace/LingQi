export type DmDossierSortMode = 'comprehensive' | 'rating' | 'verified' | 'photo' | 'newest';

export type SortableDmDossier = {
  id: string;
  dm_name: string;
  claim_status?: string | null;
  photo_url?: string | null;
  photo_files?: unknown[] | null;
  created_at?: string | null;
  rating_summary?: {
    avg: number | null;
    player_count: number;
    review_count: number;
  } | null;
  chanto_summary?: {
    total: number;
    gift_count: number;
    supporter_count: number;
  } | null;
};

function compareNumberDesc(left: number, right: number) {
  return right - left;
}

function hasRating(item: SortableDmDossier) {
  return item.rating_summary?.avg !== null && Number(item.rating_summary?.player_count || 0) > 0;
}

function hasPhoto(item: SortableDmDossier) {
  return Boolean(item.photo_url?.trim() || item.photo_files?.length);
}

function isVerified(item: SortableDmDossier) {
  return item.claim_status === 'approved';
}

function comprehensiveComparator(left: SortableDmDossier, right: SortableDmDossier) {
  return compareNumberDesc(Number(hasRating(left)), Number(hasRating(right)))
    || compareNumberDesc(Number(isVerified(left)), Number(isVerified(right)))
    || compareNumberDesc(Number(hasPhoto(left)), Number(hasPhoto(right)))
    || compareNumberDesc(Number(left.rating_summary?.avg || 0), Number(right.rating_summary?.avg || 0))
    || compareNumberDesc(Number(left.rating_summary?.player_count || 0), Number(right.rating_summary?.player_count || 0));
}

function selectedComparator(mode: DmDossierSortMode, left: SortableDmDossier, right: SortableDmDossier) {
  if (mode === 'rating') {
    return compareNumberDesc(Number(hasRating(left)), Number(hasRating(right)))
      || compareNumberDesc(Number(left.rating_summary?.avg || 0), Number(right.rating_summary?.avg || 0))
      || compareNumberDesc(Number(left.rating_summary?.player_count || 0), Number(right.rating_summary?.player_count || 0))
      || comprehensiveComparator(left, right);
  }
  if (mode === 'verified') {
    return compareNumberDesc(Number(isVerified(left)), Number(isVerified(right)))
      || comprehensiveComparator(left, right);
  }
  if (mode === 'photo') {
    return compareNumberDesc(Number(hasPhoto(left)), Number(hasPhoto(right)))
      || comprehensiveComparator(left, right);
  }
  if (mode === 'newest') {
    return String(right.created_at || '').localeCompare(String(left.created_at || ''))
      || comprehensiveComparator(left, right);
  }
  return comprehensiveComparator(left, right);
}

export function sortDmDossiers<T extends SortableDmDossier>(
  items: readonly T[],
  mode: DmDossierSortMode,
  chantoFirst = false,
) {
  return [...items].sort((left, right) => {
    if (chantoFirst) {
      const byHasChanto = compareNumberDesc(
        Number(Number(left.chanto_summary?.total || 0) > 0),
        Number(Number(right.chanto_summary?.total || 0) > 0),
      );
      if (byHasChanto) return byHasChanto;
      const byChantoTotal = compareNumberDesc(
        Number(left.chanto_summary?.total || 0),
        Number(right.chanto_summary?.total || 0),
      );
      if (byChantoTotal) return byChantoTotal;
    }

    return selectedComparator(mode, left, right)
      || String(left.dm_name || '').localeCompare(String(right.dm_name || ''), 'zh-CN')
      || left.id.localeCompare(right.id);
  });
}
