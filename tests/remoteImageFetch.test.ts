import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchBoundedTrustedImage,
  remoteImageFetchStatus,
} from '../api/remoteImageFetch.js';
import { MAX_UPLOAD_BYTES, uploadImageValidationStatus } from '../api/uploadSecurity.js';

const SITE = 'https://jumulu.jusichen.com';

function validateOfficialUpload(value: string | URL) {
  const url = new URL(String(value), SITE);
  if (url.origin !== SITE || !url.pathname.startsWith('/uploads/')) throw new Error('untrusted image URL');
  return url;
}

test('trusted image fetch follows only revalidated redirects', async () => {
  const calls: string[] = [];
  const result = await fetchBoundedTrustedImage({
    sourceUrl: `${SITE}/uploads/old.jpg`,
    validateUrl: validateOfficialUpload,
    fetchImpl: async value => {
      calls.push(String(value));
      if (calls.length === 1) {
        return new Response(null, { status: 302, headers: { location: '/uploads/new.jpg' } });
      }
      return new Response(Buffer.from('image'), { status: 200, headers: { 'content-type': 'image/jpeg' } });
    },
  });
  assert.deepEqual(calls, [`${SITE}/uploads/old.jpg`, `${SITE}/uploads/new.jpg`]);
  assert.equal(result.buffer.toString(), 'image');
  assert.equal(result.mimetype, 'image/jpeg');

  await assert.rejects(
    fetchBoundedTrustedImage({
      sourceUrl: `${SITE}/uploads/old.jpg`,
      validateUrl: validateOfficialUpload,
      fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/internal' } }),
    }),
    /图片读取失败/,
  );
});

test('trusted image fetch rejects declared and streamed bodies above the upload limit', async () => {
  await assert.rejects(
    fetchBoundedTrustedImage({
      sourceUrl: `${SITE}/uploads/large.jpg`,
      validateUrl: validateOfficialUpload,
      fetchImpl: async () => new Response(Buffer.from('x'), {
        status: 200,
        headers: { 'content-length': String(MAX_UPLOAD_BYTES + 1) },
      }),
    }),
    (error: unknown) => uploadImageValidationStatus(error) === 413,
  );

  const oversizedBody = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_UPLOAD_BYTES));
      controller.enqueue(new Uint8Array([1]));
      controller.close();
    },
  });
  await assert.rejects(
    fetchBoundedTrustedImage({
      sourceUrl: `${SITE}/uploads/streamed-large.jpg`,
      validateUrl: validateOfficialUpload,
      fetchImpl: async () => new Response(oversizedBody, { status: 200 }),
    }),
    (error: unknown) => uploadImageValidationStatus(error) === 413,
  );
});

test('trusted image fetch turns a stalled request into a gateway timeout', async () => {
  await assert.rejects(
    fetchBoundedTrustedImage({
      sourceUrl: `${SITE}/uploads/slow.jpg`,
      validateUrl: validateOfficialUpload,
      timeoutMs: 5,
      fetchImpl: async (_value, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      }),
    }),
    (error: unknown) => remoteImageFetchStatus(error) === 504,
  );
});
