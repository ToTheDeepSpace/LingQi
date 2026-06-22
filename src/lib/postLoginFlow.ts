export const DEFAULT_POST_LOGIN_PATH = '/rankings';
export const ONBOARDING_PENDING_KEY = 'lc_onboarding_pending';
export const ONBOARDING_DISMISSED_KEY = 'lc_onboarding_dismissed';
export const ONBOARDING_VIEW_COUNT_KEY = 'lc_onboarding_view_count';
export const MAX_ONBOARDING_VIEWS = 3;

export function getPostLoginRedirect(rawRedirect?: string | null) {
  const value = String(rawRedirect || '').trim();
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_POST_LOGIN_PATH;
  return value;
}

export function normalizeOnboardingViewCount(value: unknown) {
  const count = typeof value === 'number' ? value : Number(value || 0);
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.floor(count);
}

export function nextOnboardingViewCount(current: unknown) {
  return Math.min(MAX_ONBOARDING_VIEWS, normalizeOnboardingViewCount(current) + 1);
}

export function shouldShowOnboarding(input: { pending: boolean; dismissed: boolean; viewCount: unknown }) {
  return input.pending && !input.dismissed && normalizeOnboardingViewCount(input.viewCount) < MAX_ONBOARDING_VIEWS;
}
