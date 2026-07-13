import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  publicRankingEvidenceMetadata,
  readRankingEvidenceFile,
  removeRankingEvidenceFiles,
  saveRankingEvidenceFiles,
} from '../api/rankingEvidenceStorage.js';

const RANKING_ID = '11111111-1111-4111-8111-111111111111';

test('榜单审核材料保存在私密目录，公开元数据不泄露路径', () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ranking-evidence-'));
  try {
    const privateRoot = path.join(sandbox, 'private');
    const body = Buffer.from('sanitized-ranking-evidence');
    const files = saveRankingEvidenceFiles({
      root: privateRoot,
      rankingId: RANKING_ID,
      randomId: () => 'evidence-1',
      files: [{ originalName: '../聊天截图.jpg', image: { buffer: body, width: 800, height: 600, ext: 'jpg', contentType: 'image/jpeg' } }],
    });
    assert.equal(files[0].name, '聊天截图.jpg');
    assert.equal(readRankingEvidenceFile(privateRoot, files[0].relative_path).toString(), body.toString());
    assert.deepEqual(Object.keys(publicRankingEvidenceMetadata(files)[0]).sort(), ['height', 'id', 'name', 'size', 'type', 'width']);
    removeRankingEvidenceFiles(privateRoot, files);
    assert.equal(fs.existsSync(path.join(privateRoot, files[0].relative_path)), false);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('榜单审核材料拒绝目录穿越和超量上传', () => {
  assert.throws(() => readRankingEvidenceFile('/tmp', '../outside.jpg'), /路径不合法/);
  assert.throws(() => saveRankingEvidenceFiles({
    root: '/tmp',
    rankingId: RANKING_ID,
    existingCount: 8,
    files: [{ originalName: 'x.jpg', image: { buffer: Buffer.from('x'), width: 1, height: 1, ext: 'jpg', contentType: 'image/jpeg' } }],
  }), /最多上传8张/);
});
