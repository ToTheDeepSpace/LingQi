export type ReportTargetRestoreDecision =
  | 'restore'
  | 'no_target_hide'
  | 'missing_status_history'
  | 'missing_content_fingerprint'
  | 'target_missing_or_unsupported'
  | 'target_content_changed'
  | 'target_changed';

type ReportStatusInput = {
  targetType: string;
  before?: string | null;
  after?: string | null;
};

type ReportRestoreInput = ReportStatusInput & {
  current?: string | null;
  handledContentFingerprint?: string | null;
  currentContentFingerprint?: string | null;
};

const RESTORABLE_BEFORE_STATUSES: Record<string, ReadonlySet<string>> = {
  ranking: new Set(['approved', 'pending']),
  comment: new Set(['approved', 'pending']),
  commission: new Set(['approved', 'pending']),
  carpool: new Set(['approved', 'pending']),
  profile: new Set(['visible']),
  dm_affiliation: new Set(['approved', 'pending', 'legacy_unverified']),
};

function normalizedStatus(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

export function reportHandlingHidTarget({ targetType, before, after }: ReportStatusInput) {
  const normalizedBefore = normalizedStatus(before);
  const normalizedAfter = normalizedStatus(after);
  if (!normalizedBefore || !normalizedAfter || normalizedBefore === normalizedAfter) return false;
  if (!RESTORABLE_BEFORE_STATUSES[targetType]?.has(normalizedBefore)) return false;
  if (targetType === 'profile') return normalizedAfter === 'hidden';
  return normalizedAfter === 'rejected';
}

export function decideReportTargetRestore({
  targetType,
  before,
  after,
  current,
  handledContentFingerprint,
  currentContentFingerprint,
}: ReportRestoreInput): { restore: boolean; reason: ReportTargetRestoreDecision } {
  const normalizedBefore = normalizedStatus(before);
  const normalizedAfter = normalizedStatus(after);
  const normalizedCurrent = normalizedStatus(current);

  if (!normalizedBefore || !normalizedAfter) {
    return { restore: false, reason: 'missing_status_history' };
  }
  if (!reportHandlingHidTarget({ targetType, before: normalizedBefore, after: normalizedAfter })) {
    return { restore: false, reason: 'no_target_hide' };
  }
  if (!normalizedStatus(handledContentFingerprint)) {
    return { restore: false, reason: 'missing_content_fingerprint' };
  }
  if (!normalizedStatus(currentContentFingerprint)) {
    return { restore: false, reason: 'target_missing_or_unsupported' };
  }
  if (normalizedStatus(currentContentFingerprint) !== normalizedStatus(handledContentFingerprint)) {
    return { restore: false, reason: 'target_content_changed' };
  }
  if (!normalizedCurrent) {
    return { restore: false, reason: 'target_missing_or_unsupported' };
  }
  if (normalizedCurrent !== normalizedAfter) {
    return { restore: false, reason: 'target_changed' };
  }
  return { restore: true, reason: 'restore' };
}

export function reportReopenConfirmation(input: ReportStatusInput) {
  if (reportHandlingHidTarget(input)) {
    return '将把这条举报重新放回待处理。如果原内容仍保持上次处理后的下架状态，还会恢复到处理前状态；如果内容后来又被修改或处理过，则不会覆盖当前状态。确定撤销处理吗？';
  }
  return '将把这条举报重新放回待处理，不会改动原内容。确定撤销处理吗？';
}
