import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  MAX_UPLOAD_BYTES,
  sanitizeUploadedImageFile,
  UploadImageValidationError,
  uploadImageValidationStatus,
} from '../api/uploadSecurity.js';

test('classifies image upload validation failures as client errors', () => {
  const badType = new UploadImageValidationError('bad type');
  const tooLarge = new UploadImageValidationError('too large', 413);
  assert.equal(uploadImageValidationStatus(badType), 400);
  assert.equal(uploadImageValidationStatus(tooLarge), 413);
  assert.equal(uploadImageValidationStatus(new Error('database failed')), null);
});

test('rejects unsupported, empty, oversized, and mismatched images before decoding', async () => {
  await assert.rejects(
    sanitizeUploadedImageFile({ buffer: Buffer.from('not-an-image'), mimetype: 'text/plain' }),
    (error: unknown) => uploadImageValidationStatus(error) === 400,
  );
  await assert.rejects(
    sanitizeUploadedImageFile({ buffer: Buffer.alloc(0), mimetype: 'image/png' }),
    (error: unknown) => uploadImageValidationStatus(error) === 400,
  );
  await assert.rejects(
    sanitizeUploadedImageFile({ buffer: Buffer.alloc(MAX_UPLOAD_BYTES + 1), mimetype: 'image/png' }),
    (error: unknown) => uploadImageValidationStatus(error) === 413,
  );
  await assert.rejects(
    sanitizeUploadedImageFile({ buffer: Buffer.from([0xff, 0xd8, 0xff]), mimetype: 'image/png' }),
    (error: unknown) => uploadImageValidationStatus(error) === 400,
  );
});

test('every direct image upload route returns typed validation failures directly', () => {
  const source = readFileSync('api/index.ts', 'utf8');
  const imageUpload = readFileSync('src/components/ImageUpload.tsx', 'utf8');
  const certification = readFileSync('src/pages/CertificationPage.tsx', 'utf8');
  const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
  assert.equal(
    source.match(/if \(sendUploadValidationError\(res, e\)\) return;/g)?.length,
    10,
  );
  assert.match(imageUpload, /file\.size > 8 \* 1024 \* 1024/);
  assert.doesNotMatch(imageUpload, /文件大小不能超过 10MB/);
  assert.match(certification, /file\.size > 8 \* 1024 \* 1024/);
  assert.match(certification, /uploadFile\.size > 8 \* 1024 \* 1024/);
  assert.doesNotMatch(certification, /超过 10MB/);
  assert.match(source, /fileSize: MAX_UPLOAD_BYTES/);
  assert.match(source, /files: MAX_RANKING_EVIDENCE_FILES/);
  assert.equal(source.match(/enforceMultipartUploadTotal,/g)?.length, 4);
  assert.match(source, /文件不能超过 8MB/);
  assert.match(source, /本次上传的图片合计不能超过 18MB/);
  assert.match(source, /await removeLingqiSavedUpload\(savedUpload/);
  assert.match(dashboard, /支持 JPG、PNG、WebP，最大 8MB/);
  assert.doesNotMatch(dashboard, /支持 JPG、PNG、GIF/);
});
