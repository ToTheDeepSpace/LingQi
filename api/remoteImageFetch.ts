import { MAX_UPLOAD_BYTES, UploadImageValidationError } from './uploadSecurity.js';

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

type FetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class RemoteImageFetchError extends Error {
  readonly statusCode: 502 | 504;

  constructor(message: string, statusCode: 502 | 504) {
    super(message);
    this.name = 'RemoteImageFetchError';
    this.statusCode = statusCode;
  }
}

export function remoteImageFetchStatus(error: unknown) {
  return error instanceof RemoteImageFetchError ? error.statusCode : null;
}

function declaredResponseSize(response: Response) {
  const value = response.headers.get('content-length');
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const size = Number(value);
  return Number.isSafeInteger(size) ? size : null;
}

async function readBoundedResponseBody(response: Response) {
  const declaredSize = declaredResponseSize(response);
  if (declaredSize !== null && declaredSize > MAX_UPLOAD_BYTES) {
    throw new UploadImageValidationError('图片不能超过 8MB', 413);
  }
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      const chunk = Buffer.from(item.value);
      total += chunk.length;
      if (total > MAX_UPLOAD_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new UploadImageValidationError('图片不能超过 8MB', 413);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

export async function fetchBoundedTrustedImage(input: {
  sourceUrl: string | URL;
  fallbackType?: string;
  validateUrl: (value: string | URL) => URL;
  timeoutMs?: number;
  fetchImpl?: FetchImplementation;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const fetchImpl = input.fetchImpl || ((value, init) => fetch(value, init));

  try {
    let currentUrl = input.validateUrl(input.sourceUrl);
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      const response = await fetchImpl(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
      });
      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new RemoteImageFetchError('图片跳转地址无效', 502);
        if (redirectCount >= MAX_REDIRECTS) throw new RemoteImageFetchError('图片跳转次数过多', 502);
        currentUrl = input.validateUrl(new URL(location, currentUrl));
        continue;
      }
      if (!response.ok) throw new RemoteImageFetchError('图片读取失败', 502);
      const buffer = await readBoundedResponseBody(response);
      return {
        buffer,
        mimetype: response.headers.get('content-type') || input.fallbackType || 'application/octet-stream',
        sourceUrl: currentUrl,
      };
    }
    throw new RemoteImageFetchError('图片跳转次数过多', 502);
  } catch (error) {
    if (error instanceof UploadImageValidationError || error instanceof RemoteImageFetchError) throw error;
    if (controller.signal.aborted || (error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError')) {
      throw new RemoteImageFetchError('图片读取超时，请稍后重试', 504);
    }
    throw new RemoteImageFetchError('图片读取失败，请稍后重试', 502);
  } finally {
    clearTimeout(timer);
  }
}
