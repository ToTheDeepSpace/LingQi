export type WechatImageCheckRow = {
  resource_hash: string;
  status: string;
  created_at?: string | null;
};

export type WechatImageSubmissionAction = 'reuse' | 'submit' | 'block';
export type WechatImageApprovalIssue = 'unsafe' | 'incomplete' | null;

export const WECHAT_IMAGE_PENDING_STALE_MS = 35 * 60 * 1000;

export function wechatImageSubmissionAction(
  latest: WechatImageCheckRow | undefined,
  nowMs = Date.now(),
): WechatImageSubmissionAction {
  if (!latest || latest.status === 'error') return 'submit';
  if (latest.status === 'pass') return 'reuse';
  if (latest.status === 'review' || latest.status === 'risky') return 'block';
  if (latest.status !== 'pending') return 'submit';

  const createdAt = Date.parse(String(latest.created_at || ''));
  if (!Number.isFinite(createdAt) || nowMs - createdAt >= WECHAT_IMAGE_PENDING_STALE_MS) return 'submit';
  return 'reuse';
}

export function wechatImageApprovalIssue(
  resourceHashes: string[],
  rowsNewestFirst: WechatImageCheckRow[],
): WechatImageApprovalIssue {
  const hashes = Array.from(new Set(resourceHashes.filter(Boolean)));
  if (hashes.length === 0) return null;
  const latest = new Map<string, string>();
  for (const row of rowsNewestFirst) {
    if (hashes.includes(row.resource_hash) && !latest.has(row.resource_hash)) {
      latest.set(row.resource_hash, row.status);
    }
  }

  // No tracked image means the review came from the website and remains on the
  // platform's ordinary manual-review path.
  if (latest.size === 0) return null;
  if (latest.size !== hashes.length) return 'incomplete';
  if ([...latest.values()].some(status => status === 'review' || status === 'risky')) return 'unsafe';
  if ([...latest.values()].some(status => status !== 'pass')) return 'incomplete';
  return null;
}
