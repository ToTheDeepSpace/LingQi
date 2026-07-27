import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  removeLingqiSavedUpload,
  saveLingqiSanitizedUploadImage,
  type CosUploadTransport,
} from '../api/uploadStorage.js';

const image = {
  buffer: Buffer.from('sanitized-image'),
  ext: 'jpg' as const,
  contentType: 'image/jpeg' as const,
  width: 100,
  height: 80,
};

test('saved local uploads can be removed after a downstream rejection', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lingqi-upload-'));
  try {
    const saved = await saveLingqiSanitizedUploadImage(image, 'user/avatar', {
      localUploadRoot: root,
      siteUrl: 'https://jumulu.jusichen.com',
      now: new Date('2026-07-28T00:00:00.000Z'),
      randomId: () => 'rejected-image',
      env: {},
    });
    const absolutePath = path.join(root, saved.bucketPath);
    assert.equal(fs.existsSync(absolutePath), true);
    await removeLingqiSavedUpload(saved, { localUploadRoot: root, env: {} });
    assert.equal(fs.existsSync(absolutePath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('saved COS uploads use the same object key for rejection cleanup', async () => {
  const calls: string[] = [];
  const transport: CosUploadTransport = {
    async putObject(input) { calls.push(`put:${input.key}`); },
    async deleteObject(key) { calls.push(`delete:${key}`); },
  };
  const env = {
    LINGQI_COS_SECRET_ID: 'id',
    LINGQI_COS_SECRET_KEY: 'key',
    LINGQI_COS_BUCKET: 'bucket',
    LINGQI_COS_REGION: 'ap-beijing',
    LINGQI_COS_UPLOAD_PREFIX: 'jumulu/uploads',
  };
  const saved = await saveLingqiSanitizedUploadImage(image, 'user/avatar', {
    localUploadRoot: '/unused',
    siteUrl: 'https://jumulu.jusichen.com',
    now: new Date('2026-07-28T00:00:00.000Z'),
    randomId: () => 'rejected-image',
    env,
    cosTransport: transport,
  });
  await removeLingqiSavedUpload(saved, {
    localUploadRoot: '/unused',
    env,
    cosTransport: transport,
  });
  assert.deepEqual(calls, [
    'put:jumulu/uploads/lc-portfolio/user/avatar/2026-07-28/rejected-image.jpg',
    'delete:jumulu/uploads/lc-portfolio/user/avatar/2026-07-28/rejected-image.jpg',
  ]);
});
