import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  privateClaimRootFromPublicUploadRoot,
  publicClaimProofMetadata,
  readDossierClaimProof,
  removeDossierClaimProofs,
  saveDossierClaimProofs,
} from '../api/dossierClaimStorage.js';

const DOSSIER_ID = '11111111-1111-4111-8111-111111111111';
const CLAIM_ID = '22222222-2222-4222-8222-222222222222';

test('认领凭证保存到公开目录之外，并可按受限路径读取', () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'lingqi-claim-proof-'));
  try {
    const publicRoot = path.join(sandbox, 'LingQi', 'public', 'uploads');
    const privateRoot = privateClaimRootFromPublicUploadRoot(publicRoot);
    const imageBuffer = Buffer.from('sanitized-jpeg-test');
    const saved = saveDossierClaimProofs({
      root: privateRoot,
      dossierId: DOSSIER_ID,
      claimId: CLAIM_ID,
      randomId: () => 'proof-file-1',
      files: [{
        originalName: '../后台截图.jpg',
        image: { buffer: imageBuffer, width: 1200, height: 900, ext: 'jpg', contentType: 'image/jpeg' },
      }],
    });

    assert.equal(saved.length, 1);
    assert.equal(saved[0].name, '后台截图.jpg');
    assert.equal(readDossierClaimProof(privateRoot, saved[0].relative_path).toString(), imageBuffer.toString());
    assert.equal(saved[0].relative_path.startsWith('dm-dossier-claims/'), true);
    assert.equal(path.resolve(privateRoot).startsWith(path.resolve(publicRoot)), false);
    assert.equal(path.resolve(privateRoot).startsWith(`${path.resolve(sandbox, 'LingQi', 'public')}${path.sep}`), false);

    const publicMetadata = publicClaimProofMetadata(saved);
    assert.deepEqual(Object.keys(publicMetadata[0]).sort(), ['height', 'id', 'name', 'size', 'type', 'width']);
    assert.equal('relative_path' in publicMetadata[0], false);

    removeDossierClaimProofs(privateRoot, DOSSIER_ID, CLAIM_ID);
    assert.equal(fs.existsSync(path.join(privateRoot, 'dm-dossier-claims', DOSSIER_ID, CLAIM_ID)), false);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('认领凭证读取拒绝目录穿越', () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'lingqi-claim-proof-'));
  try {
    assert.throws(() => readDossierClaimProof(sandbox, '../outside.jpg'), /路径不合法/);
    assert.throws(() => readDossierClaimProof(sandbox, 'dm-dossier-claims/../../outside.jpg'), /路径不合法/);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});
