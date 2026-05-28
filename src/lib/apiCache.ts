type CachedJson<T> = {
  ok: boolean;
  status: number;
  data: T;
};

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<CachedJson<T>>;
};

const jsonCache = new Map<string, CacheEntry<unknown>>();

function headerValue(init: RequestInit | undefined, name: string) {
  const headers = init?.headers;
  if (!headers) return '';
  if (headers instanceof Headers) return headers.get(name) || '';
  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return found?.[1] || '';
  }
  const record = headers as Record<string, string>;
  return record[name] || record[name.toLowerCase()] || '';
}

function cacheKey(url: string, init?: RequestInit) {
  return `${url}::auth=${headerValue(init, 'Authorization')}`;
}

export async function getJsonCached<T>(url: string, init?: RequestInit, ttlMs = 15_000): Promise<CachedJson<T>> {
  const method = (init?.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    const response = await fetch(url, init);
    return {
      ok: response.ok,
      status: response.status,
      data: await response.json() as T,
    };
  }

  const key = cacheKey(url, init);
  const now = Date.now();
  const cached = jsonCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = fetch(url, init)
    .then(async response => {
      const data = await response.json() as T;
      if (!response.ok) jsonCache.delete(key);
      return { ok: response.ok, status: response.status, data };
    })
    .catch(error => {
      jsonCache.delete(key);
      throw error;
    });

  jsonCache.set(key, { expiresAt: now + ttlMs, promise });
  return promise;
}

export function invalidateJsonCache(prefix?: string) {
  if (!prefix) {
    jsonCache.clear();
    return;
  }
  for (const key of jsonCache.keys()) {
    if (key.startsWith(prefix)) jsonCache.delete(key);
  }
}
