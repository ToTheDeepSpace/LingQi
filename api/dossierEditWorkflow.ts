export const DOSSIER_EDIT_OWNER_RESPONSE_DAYS = 3;

export const DOSSIER_NO_ADMIN_REVIEW_FIELDS = ['birth_year', 'height_cm', 'weight_kg', 'mbti', 'zodiac'] as const;
export const DOSSIER_POST_ADMIN_REVIEW_FIELDS = ['city'] as const;
export const DOSSIER_OWNER_CONFIRMATION_FIELDS = [
  'profile_url',
  'photo_url',
  'photo_files',
  'birth_year',
  'height_cm',
  'weight_kg',
  'mbti',
  'zodiac',
] as const;

export type DossierOwnerResponseStatus = 'not_required' | 'pending' | 'agreed' | 'opposed' | 'expired';

export function partitionDossierEditPatch(patch: Record<string, unknown>) {
  const noAdminReviewPatch: Record<string, unknown> = {};
  const postAdminReviewPatch: Record<string, unknown> = {};
  const preAdminReviewPatch: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(patch)) {
    if ((DOSSIER_NO_ADMIN_REVIEW_FIELDS as readonly string[]).includes(field)) {
      noAdminReviewPatch[field] = value;
    } else if ((DOSSIER_POST_ADMIN_REVIEW_FIELDS as readonly string[]).includes(field)) {
      postAdminReviewPatch[field] = value;
    } else {
      preAdminReviewPatch[field] = value;
    }
  }
  return { noAdminReviewPatch, postAdminReviewPatch, preAdminReviewPatch };
}

export function dossierOwnerConfirmationFields(patch: Record<string, unknown>) {
  return DOSSIER_OWNER_CONFIRMATION_FIELDS.filter(field => Object.prototype.hasOwnProperty.call(patch, field));
}

export function dossierAdminReviewMode(input: {
  preAdminReviewPatch?: Record<string, unknown> | null;
  postAdminReviewPatch?: Record<string, unknown> | null;
}) {
  const hasPreReview = Object.keys(input.preAdminReviewPatch || {}).length > 0;
  const hasPostReview = Object.keys(input.postAdminReviewPatch || {}).length > 0;
  if (hasPreReview && hasPostReview) return 'admin_mixed' as const;
  if (hasPreReview) return 'admin_pre' as const;
  if (hasPostReview) return 'admin_post' as const;
  return 'none' as const;
}

export function initialDossierEditWorkflow(input: {
  ownerProfileId?: string | null;
  submitterProfileId: string;
  now?: Date;
}) {
  const ownerProfileId = String(input.ownerProfileId || '').trim();
  const submitterProfileId = String(input.submitterProfileId || '').trim();
  const requiresOwnerResponse = Boolean(ownerProfileId && ownerProfileId !== submitterProfileId);
  const now = input.now || new Date();
  return {
    requiresOwnerResponse,
    ownerResponseStatus: (requiresOwnerResponse ? 'pending' : 'not_required') as DossierOwnerResponseStatus,
    ownerResponseDueAt: requiresOwnerResponse
      ? new Date(now.getTime() + DOSSIER_EDIT_OWNER_RESPONSE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : null,
  };
}

export function effectiveDossierOwnerResponseStatus(input: {
  status?: string | null;
  dueAt?: string | null;
  now?: Date;
}): DossierOwnerResponseStatus {
  const status = input.status as DossierOwnerResponseStatus;
  if (status !== 'pending') {
    return ['not_required', 'agreed', 'opposed', 'expired'].includes(status) ? status : 'not_required';
  }
  const dueAt = input.dueAt ? new Date(input.dueAt).getTime() : Number.NaN;
  if (Number.isFinite(dueAt) && dueAt <= (input.now || new Date()).getTime()) return 'expired';
  return 'pending';
}

export function dossierEditAdminReviewReady(input: {
  status?: string | null;
  dueAt?: string | null;
  now?: Date;
}) {
  return effectiveDossierOwnerResponseStatus(input) !== 'pending';
}

export function ownerLoggedInDuringDossierResponseWindow(input: {
  createdAt?: string | null;
  dueAt?: string | null;
  ownerLastSeenAt?: string | null;
}) {
  const createdAt = input.createdAt ? new Date(input.createdAt).getTime() : Number.NaN;
  const dueAt = input.dueAt ? new Date(input.dueAt).getTime() : Number.NaN;
  const lastSeenAt = input.ownerLastSeenAt ? new Date(input.ownerLastSeenAt).getTime() : Number.NaN;
  return Number.isFinite(createdAt)
    && Number.isFinite(dueAt)
    && Number.isFinite(lastSeenAt)
    && lastSeenAt >= createdAt
    && lastSeenAt <= dueAt;
}
