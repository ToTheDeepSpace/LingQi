export type DmRatingSummary = {
  avg: number | null;
  review_count: number;
  player_count: number;
  sample_status: 'insufficient' | 'stable';
};

export function summarizeDmRatingRows(rows: Record<string, unknown>[]): DmRatingSummary {
  const byPlayer = new Map<string, number[]>();
  rows.forEach(row => {
    const value = Number(row.rating || 0);
    if (!Number.isFinite(value) || value < 1 || value > 5) return;
    const profileId = typeof row.profile_id === 'string' ? row.profile_id.trim().slice(0, 120) : '';
    const reviewId = typeof row.id === 'string' ? row.id.trim().slice(0, 120) : '';
    const playerKey = profileId || `review:${reviewId}`;
    const values = byPlayer.get(playerKey) || [];
    values.push(value);
    byPlayer.set(playerKey, values);
  });
  const playerAverages = Array.from(byPlayer.values()).map(values => (
    values.reduce((sum, value) => sum + value, 0) / values.length
  ));
  const avg = playerAverages.length
    ? Math.round((playerAverages.reduce((sum, value) => sum + value, 0) / playerAverages.length) * 10) / 10
    : null;
  return {
    avg,
    review_count: rows.length,
    player_count: playerAverages.length,
    sample_status: playerAverages.length >= 3 ? 'stable' : 'insufficient',
  };
}
