export const DOSSIER_EDIT_OWNER_RESPONSE_DAYS = 7;

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
