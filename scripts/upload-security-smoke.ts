import assert from 'node:assert/strict';
import sharp from 'sharp';
import { sanitizeUploadedImageFile } from '../api/uploadSecurity.js';

const png = await sharp({
  create: {
    width: 2,
    height: 2,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
}).png().toBuffer();

const payload = Buffer.concat([png, Buffer.from('<script>alert(1)</script>')]);
const sanitized = await sanitizeUploadedImageFile({ buffer: payload, mimetype: 'image/png' });

assert.equal(sanitized.ext, 'jpg');
assert.equal(sanitized.contentType, 'image/jpeg');
assert.equal(sanitized.width, 2);
assert.equal(sanitized.height, 2);
assert.equal(sanitized.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])), true);
assert.equal(sanitized.buffer.includes(Buffer.from('<script>')), false);

await assert.rejects(
  () => sanitizeUploadedImageFile({ buffer: Buffer.from('<svg></svg>'), mimetype: 'image/svg+xml' }),
  /png、jpg 或 webp/,
);

await assert.rejects(
  () => sanitizeUploadedImageFile({ buffer: png, mimetype: 'image/jpeg' }),
  /类型不匹配/,
);

console.log('lingqi upload security smoke passed');
