import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_MULTIPART_UPLOAD_BYTES,
  totalFileBytes,
} from '../src/lib/uploadLimits.js';

test('shared upload limits preserve an 8MB per-image and 18MB multipart budget', () => {
  assert.equal(MAX_IMAGE_UPLOAD_BYTES, 8 * 1024 * 1024);
  assert.equal(MAX_MULTIPART_UPLOAD_BYTES, 18 * 1024 * 1024);
  assert.equal(totalFileBytes([{ size: 3 }, { size: 5 }]), 8);
});
