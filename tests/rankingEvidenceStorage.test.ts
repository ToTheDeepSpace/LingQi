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
  validateRankingEvidencePublicCopy,
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
    assert.deepEqual(Object.keys(publicRankingEvidenceMetadata(files)[0]).sort(), ['height', 'id', 'name', 'public_copy', 'size', 'type', 'width']);
    const promotedMetadata = publicRankingEvidenceMetadata([{ ...files[0], public_copy: {
      url: 'https://jumulu.jusichen.com/uploads/public-copy.jpg',
      published_at: '2026-07-13T12:00:00.000Z',
      published_by: 'admin-id',
      processing_note: '内部处理说明',
      edit_actions: ['遮挡'],
    } }])[0];
    assert.deepEqual(promotedMetadata.public_copy, {
      url: 'https://jumulu.jusichen.com/uploads/public-copy.jpg',
      published_at: '2026-07-13T12:00:00.000Z',
    });
    assert.equal('relative_path' in promotedMetadata, false);
    assert.equal('processing_note' in promotedMetadata, false);
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

test('私密材料只能通过已处理副本和二次确认转公开', () => {
  assert.deepEqual(validateRankingEvidencePublicCopy({
    confirmed: true,
    processingNote: '已遮盖第三方手机号',
    hasProcessedImage: true,
    publicImageCount: 2,
    alreadyPublished: false,
    editActions: ['裁剪', '遮挡'],
  }), { processingNote: '已遮盖第三方手机号', editActions: ['裁剪', '遮挡'] });
  assert.throws(() => validateRankingEvidencePublicCopy({ confirmed: false, processingNote: '已打码', hasProcessedImage: true, publicImageCount: 0, alreadyPublished: false, editActions: ['遮挡'] }), /确认/);
  assert.throws(() => validateRankingEvidencePublicCopy({ confirmed: true, processingNote: '已打码', hasProcessedImage: false, publicImageCount: 0, alreadyPublished: false, editActions: ['遮挡'] }), /上传/);
  assert.throws(() => validateRankingEvidencePublicCopy({ confirmed: true, processingNote: '已打码', hasProcessedImage: true, publicImageCount: 0, alreadyPublished: true, editActions: ['遮挡'] }), /已经生成过/);
  assert.throws(() => validateRankingEvidencePublicCopy({ confirmed: true, processingNote: '已打码', hasProcessedImage: true, publicImageCount: 0, alreadyPublished: false, editActions: [] }), /前端编辑器/);
});
