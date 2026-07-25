export type RankingFeedRow = Record<string, unknown> & {
  created_at?: string | Date | null;
  last_activity_at?: string | Date | null;
  agree_count?: number | null;
  oppose_count?: number | null;
  joys?: number | null;
  participant_count?: number | null;
};

function timestamp(value: unknown) {
  const parsed = value instanceof Date
    ? value.getTime()
    : typeof value === 'string'
      ? new Date(value).getTime()
      : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function rankingActivityTime(row: RankingFeedRow) {
  return timestamp(row.last_activity_at) || timestamp(row.created_at);
}

export function rankingRecentDiscussionScore(row: RankingFeedRow, now = Date.now()) {
  const explicitParticipantCount = Number(row.participant_count);
  const participants = Number.isFinite(explicitParticipantCount)
    ? Math.max(0, explicitParticipantCount)
    : Math.max(0,
      Number(row.agree_count || 0)
      + Number(row.oppose_count || 0)
      + Number(row.joys || 0));
  const ageDays = Math.max(0, (now - rankingActivityTime(row)) / (24 * 60 * 60 * 1000));
  return Math.log1p(participants) * Math.exp(-ageDays / 7);
}

function rankRows<T extends RankingFeedRow>(rows: T[], now: number) {
  return rows.map((row, index) => ({
    row,
    index,
    activityTime: rankingActivityTime(row),
    discussionScore: rankingRecentDiscussionScore(row, now),
  }));
}

export function sortRankingFeedLatest<T extends RankingFeedRow>(rows: T[], now = Date.now()) {
  const ranked = rankRows(rows, now);
  ranked.sort((left, right) => {
    const activityDelta = right.activityTime - left.activityTime;
    return activityDelta || left.index - right.index;
  });
  return ranked.map(item => item.row);
}

export function sortRankingFeedDiscussed<T extends RankingFeedRow>(rows: T[], now = Date.now()) {
  const ranked = rankRows(rows, now);
  ranked.sort((left, right) => {
    const scoreDelta = right.discussionScore - left.discussionScore;
    if (Math.abs(scoreDelta) > 0.000001) return scoreDelta;
    const activityDelta = right.activityTime - left.activityTime;
    return activityDelta || left.index - right.index;
  });
  return ranked.map(item => item.row);
}

export function sortRankingFeed<T extends RankingFeedRow>(rows: T[], mode: 'latest' | 'discussed', now = Date.now()) {
  return mode === 'discussed'
    ? sortRankingFeedDiscussed(rows, now)
    : sortRankingFeedLatest(rows, now);
}
