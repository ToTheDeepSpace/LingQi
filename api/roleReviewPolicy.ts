export type RoleReviewLane = 'experience' | 'deep_spoiler';

export type RoleReviewRow = {
  id?: unknown;
  profile_id?: unknown;
  rating?: unknown;
  review_lane?: unknown;
};

export function normalizeRoleReviewLane(value: unknown): RoleReviewLane {
  return value === 'deep_spoiler' ? 'deep_spoiler' : 'experience';
}

function summarizeValues(values: number[]) {
  const valid = values.filter(value => Number.isFinite(value) && value >= 1 && value <= 5);
  if (valid.length === 0) return { avg: null, count: 0 };
  return {
    avg: Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10,
    count: valid.length,
  };
}

export function summarizeRoleReviewRows(rows: RoleReviewRow[]) {
  const byPlayer = new Map<string, number[]>();
  for (const row of rows) {
    const playerKey = String(row.profile_id || `anonymous:${row.id || ''}`);
    const rating = Number(row.rating || 0);
    if (!playerKey || !Number.isFinite(rating) || rating < 1 || rating > 5) continue;
    const values = byPlayer.get(playerKey) || [];
    values.push(rating);
    byPlayer.set(playerKey, values);
  }
  const playerValues = Array.from(byPlayer.values()).map(values => values.reduce((sum, value) => sum + value, 0) / values.length);
  return summarizeValues(playerValues);
}

export function summarizeRoleReviewLanes(rows: RoleReviewRow[]) {
  const experience = rows.filter(row => normalizeRoleReviewLane(row.review_lane) === 'experience');
  const deepSpoiler = rows.filter(row => normalizeRoleReviewLane(row.review_lane) === 'deep_spoiler');
  return {
    experience: summarizeValues(experience.map(row => Number(row.rating || 0))),
    deep_spoiler: summarizeValues(deepSpoiler.map(row => Number(row.rating || 0))),
  };
}
