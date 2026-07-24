import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { findRecoverableProviderPoster } from '../api/providerListingRecovery.js';

const PROFILE_ID = '19577ab6-28ee-46c5-9b4b-9551d2702bef';

test('provider listing recovery selects the upload closest to payment time', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'provider-recovery-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const uploadDir = path.join(root, 'lc-portfolio', PROFILE_ID, 'commission-provider', '2026-07-24');
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, '1784882000000-old.jpg'), 'old');
  await fs.writeFile(path.join(uploadDir, '1784882648806-match.jpg'), 'match');

  const recovered = await findRecoverableProviderPoster({
    localUploadRoot: root,
    profileId: PROFILE_ID,
    paidAt: '2026-07-24T08:44:42.000Z',
    siteUrl: 'https://jumulu.jusichen.com/',
  });

  assert.equal(
    recovered?.url,
    `https://jumulu.jusichen.com/uploads/lc-portfolio/${PROFILE_ID}/commission-provider/2026-07-24/1784882648806-match.jpg`,
  );
  assert.ok((recovered?.distance_ms || Number.POSITIVE_INFINITY) < 60_000);
});

test('provider listing recovery rejects invalid profile paths and stale uploads', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'provider-recovery-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  const invalid = await findRecoverableProviderPoster({
    localUploadRoot: root,
    profileId: '../../etc',
    paidAt: '2026-07-24T08:44:42.000Z',
    siteUrl: 'https://jumulu.jusichen.com',
  });
  assert.equal(invalid, null);

  const uploadDir = path.join(root, 'lc-portfolio', PROFILE_ID, 'commission-provider', '2026-01-01');
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, '1767225600000-stale.jpg'), 'stale');
  const stale = await findRecoverableProviderPoster({
    localUploadRoot: root,
    profileId: PROFILE_ID,
    paidAt: '2026-07-24T08:44:42.000Z',
    siteUrl: 'https://jumulu.jusichen.com',
  });
  assert.equal(stale, null);
});
