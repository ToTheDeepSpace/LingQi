import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { saveLingqiSanitizedUploadImage, normalizeUploadRelativePath } from '../api/uploadStorage.js';

const onePixelJpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x03, 0x02, 0x02, 0x03, 0x02,
  0x02, 0x03, 0x03, 0x03, 0x03, 0x04, 0x03, 0x03, 0x04, 0x05, 0x08, 0x05,
  0x05, 0x04, 0x04, 0x05, 0x0a, 0x07, 0x07, 0x06, 0x08, 0x0c, 0x0a, 0x0c,
  0x0c, 0x0b, 0x0a, 0x0b, 0x0b, 0x0d, 0x0e, 0x12, 0x10, 0x0d, 0x0e, 0x11,
  0x0e, 0x0b, 0x0b, 0x10, 0x16, 0x10, 0x11, 0x13, 0x14, 0x15, 0x15, 0x15,
  0x0c, 0x0f, 0x17, 0x18, 0x16, 0x14, 0x18, 0x12, 0x14, 0x15, 0x14, 0xff,
  0xc9, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
  0xff, 0xcc, 0x00, 0x06, 0x00, 0x10, 0x10, 0x05, 0xff, 0xda, 0x00, 0x08,
  0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xd2, 0xcf, 0x20, 0xff, 0xd9,
]);

const image = {
  buffer: onePixelJpeg,
  ext: 'jpg' as const,
  contentType: 'image/jpeg' as const,
  width: 1,
  height: 1,
};

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lingqi-upload-storage-'));

const localResult = await saveLingqiSanitizedUploadImage(image, 'creator-1/avatar', {
  env: {},
  localUploadRoot: tmpRoot,
  siteUrl: 'https://lingqi.example',
  now: new Date('2026-06-23T03:04:05.000Z'),
  randomId: () => 'local-id',
});

assert.equal(localResult.storage, 'local');
assert.equal(localResult.relativePath, 'creator-1/avatar/2026-06-23/local-id.jpg');
assert.equal(localResult.bucketPath, 'lc-portfolio/creator-1/avatar/2026-06-23/local-id.jpg');
assert.equal(localResult.url, 'https://lingqi.example/uploads/lc-portfolio/creator-1/avatar/2026-06-23/local-id.jpg');
assert.equal(fs.existsSync(path.join(tmpRoot, localResult.bucketPath)), true);

const cosCalls: Array<{ key: string; body: Buffer; contentType: string }> = [];
const cosResult = await saveLingqiSanitizedUploadImage(image, 'creator-2/portfolio', {
  env: {
    LINGQI_COS_SECRET_ID: 'secret-id',
    LINGQI_COS_SECRET_KEY: 'secret-key',
    LINGQI_COS_BUCKET: 'jusichen-prod-assets-1434761838',
    LINGQI_COS_REGION: 'ap-nanjing',
  },
  localUploadRoot: tmpRoot,
  siteUrl: 'https://lingqi.example',
  now: new Date('2026-06-23T03:04:05.000Z'),
  randomId: () => 'cos-id',
  cosTransport: {
    async putObject(input) {
      cosCalls.push(input);
    },
  },
});

assert.equal(cosResult.storage, 'cos');
assert.equal(cosResult.relativePath, 'creator-2/portfolio/2026-06-23/cos-id.jpg');
assert.equal(cosResult.bucketPath, 'lc-portfolio/creator-2/portfolio/2026-06-23/cos-id.jpg');
assert.equal(cosResult.key, 'lingqi/uploads/lc-portfolio/creator-2/portfolio/2026-06-23/cos-id.jpg');
assert.equal(cosResult.url, 'https://lingqi.example/uploads/lc-portfolio/creator-2/portfolio/2026-06-23/cos-id.jpg');
assert.deepEqual(cosCalls.map(call => ({ key: call.key, contentType: call.contentType })), [
  {
    key: 'lingqi/uploads/lc-portfolio/creator-2/portfolio/2026-06-23/cos-id.jpg',
    contentType: 'image/jpeg',
  },
]);
assert.equal(fs.existsSync(path.join(tmpRoot, cosResult.bucketPath)), false);

assert.equal(normalizeUploadRelativePath('/lc-portfolio/creator-1/avatar/a.jpg'), 'lc-portfolio/creator-1/avatar/a.jpg');
assert.equal(normalizeUploadRelativePath('../secret.env'), null);
assert.equal(normalizeUploadRelativePath('lc-portfolio/../../secret.env'), null);

console.log('lingqi upload storage smoke passed');
