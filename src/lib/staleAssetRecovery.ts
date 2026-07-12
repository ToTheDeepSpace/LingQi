const STALE_ASSET_RELOAD_KEY = 'jumulu:stale-asset-reload-at';
const RELOAD_GUARD_MS = 30_000;
let inMemoryReloadAt = 0;

export function isStaleAssetError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /ChunkLoadError|Loading chunk .+ failed|Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS|error loading dynamically imported module/i.test(message);
}

export function recoverFromStaleAssetError(error: unknown) {
  if (!isStaleAssetError(error) || typeof window === 'undefined') return false;
  let lastReload = inMemoryReloadAt;
  try {
    lastReload = Math.max(lastReload, Number(window.sessionStorage.getItem(STALE_ASSET_RELOAD_KEY) || 0));
  } catch { /* storage can be unavailable in restrictive browser modes */ }
  if (Number.isFinite(lastReload) && Date.now() - lastReload < RELOAD_GUARD_MS) return false;
  inMemoryReloadAt = Date.now();
  try { window.sessionStorage.setItem(STALE_ASSET_RELOAD_KEY, String(inMemoryReloadAt)); } catch { /* guarded in memory */ }
  window.location.reload();
  return true;
}

export function installStaleAssetRecovery() {
  if (typeof window === 'undefined') return () => undefined;
  const handlePreloadError = (event: Event) => {
    const payload = event as Event & { payload?: unknown };
    const recovered = recoverFromStaleAssetError(payload.payload || new Error('Failed to fetch dynamically imported module'));
    if (recovered) event.preventDefault();
  };
  window.addEventListener('vite:preloadError', handlePreloadError);
  return () => window.removeEventListener('vite:preloadError', handlePreloadError);
}
