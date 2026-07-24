export type AccountSubmissionState = 'pending' | 'approved' | 'action' | 'closed';
export type AccountSubmissionGroup = 'publication' | 'rating' | 'interaction' | 'governance' | 'profile';

export type AccountSubmissionItem = {
  id: string;
  kind: string;
  group: AccountSubmissionGroup;
  type_label: string;
  title: string;
  content: string;
  status: string;
  state: AccountSubmissionState;
  created_at: string;
  updated_at: string | null;
  reject_reason: string | null;
  thumbnail_url: string | null;
  action_url: string | null;
  related_type: string | null;
  related_id: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

export type AccountSubmissionSummary = {
  total: number;
  pending: number;
  approved: number;
  action_required: number;
  closed: number;
};

const PENDING_STATUSES = new Set(['pending', 'pending_owner', 'submitted', 'processing']);
const ACTION_STATUSES = new Set(['rejected', 'needs_submission', 'needs_info']);
const APPROVED_STATUSES = new Set(['approved', 'resolved', 'replied', 'on_sale', 'paid']);

export function normalizeSubmissionState(status: unknown): AccountSubmissionState {
  const value = String(status || '').trim().toLowerCase();
  if (PENDING_STATUSES.has(value)) return 'pending';
  if (ACTION_STATUSES.has(value)) return 'action';
  if (APPROVED_STATUSES.has(value)) return 'approved';
  return 'closed';
}

function timestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortAccountSubmissions<T extends Pick<AccountSubmissionItem, 'created_at' | 'updated_at'>>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = timestamp(left.updated_at) || timestamp(left.created_at);
    const rightTime = timestamp(right.updated_at) || timestamp(right.created_at);
    return rightTime - leftTime;
  });
}

export function summarizeAccountSubmissions(items: Pick<AccountSubmissionItem, 'state'>[]): AccountSubmissionSummary {
  return {
    total: items.length,
    pending: items.filter(item => item.state === 'pending').length,
    approved: items.filter(item => item.state === 'approved').length,
    action_required: items.filter(item => item.state === 'action').length,
    closed: items.filter(item => item.state === 'closed').length,
  };
}

function imageUrlFromObject(value: Record<string, unknown>) {
  for (const key of ['url', 'photo_url', 'poster_url', 'cover_url', 'image_url', 'main_image_url']) {
    const candidate = typeof value[key] === 'string' ? value[key].trim() : '';
    if (candidate.startsWith('/') || /^https?:\/\//i.test(candidate)) return candidate;
  }
  return null;
}

export function firstPublicImage(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const candidate = value.trim();
      if (candidate.startsWith('/') || /^https?:\/\//i.test(candidate)) return candidate;
      continue;
    }
    if (Array.isArray(value)) {
      const nested = firstPublicImage(...value);
      if (nested) return nested;
      continue;
    }
    if (value && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      const direct = imageUrlFromObject(object);
      if (direct) return direct;
      const nested = firstPublicImage(object.files, object.images, object.photos, object.display_files);
      if (nested) return nested;
    }
  }
  return null;
}
