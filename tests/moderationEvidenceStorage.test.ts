import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  publicModerationEvidenceMetadata,
  readModerationEvidenceFile,
  removeModerationEvidenceFile,
  saveModerationEvidenceFile,
} from '../api/moderationEvidenceStorage.js';

const REPORT_ID = '11111111-1111-4111-8111-111111111111';

test('举报证据保存为私密文件，公开元数据不泄露路径', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lingqi-moderation-evidence-'));
  try {
    const imageBuffer = Buffer.from('sanitized-private-jpeg');
    const saved = saveModerationEvidenceFile({
      root,
      kind: 'report',
      recordId: REPORT_ID,
      originalName: '../聊天证据.jpg',
      randomId: () => 'report-proof-1',
      image: {
        buffer: imageBuffer,
        width: 900,
        height: 1200,
        ext: 'jpg',
        contentType: 'image/jpeg',
      },
    });

    assert.equal(saved.name, '聊天证据.jpg');
    assert.equal(saved.relative_path.startsWith(`moderation-evidence/report/${REPORT_ID}/`), true);
    assert.equal(readModerationEvidenceFile(root, 'report', REPORT_ID, saved.relative_path).toString(), imageBuffer.toString());

    const metadata = publicModerationEvidenceMetadata([saved]);
    assert.deepEqual(Object.keys(metadata[0]).sort(), ['height', 'id', 'name', 'size', 'type', 'width']);
    assert.equal('relative_path' in metadata[0], false);

    removeModerationEvidenceFile(root, saved.relative_path);
    assert.equal(fs.existsSync(path.join(root, saved.relative_path)), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('举报证据读取拒绝跨类型、跨记录和目录穿越', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lingqi-moderation-evidence-'));
  try {
    assert.throws(
      () => readModerationEvidenceFile(root, 'report', REPORT_ID, '../outside.jpg'),
      /路径不合法/,
    );
    assert.throws(
      () => readModerationEvidenceFile(root, 'feedback', REPORT_ID, `moderation-evidence/report/${REPORT_ID}/proof.jpg`),
      /路径不合法/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
