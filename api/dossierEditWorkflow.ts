export const DOSSIER_EDIT_OWNER_RESPONSE_DAYS = 3;

export type DossierOwnerResponseStatus = 'not_required' | 'pending' | 'agreed' | 'opposed' | 'expired';

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
