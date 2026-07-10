export type RankingRevisionKind = 'content' | 'evidence';

export function normalizeRankingRevisionKind(value: unknown): RankingRevisionKind {
  return value === 'evidence' ? 'evidence' : 'content';
}

export function rankingEvidenceIsRequired(value: unknown) {
  return normalizeRankingRevisionKind(value) === 'evidence';
}

export function hasRankingEvidence(value: unknown) {
  return Array.isArray(value) && value.some(item => {
    if (!item || typeof item !== 'object') return false;
    const url = 'url' in item && typeof item.url === 'string' ? item.url.trim() : '';
    return Boolean(url);
  });
}
