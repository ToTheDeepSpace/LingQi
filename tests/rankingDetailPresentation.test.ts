import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../src/pages/RankingDetail.tsx', import.meta.url), 'utf8');

test('ranking detail keeps a single page-level back action', () => {
  assert.doesNotMatch(source, />返回红黑榜</);
  assert.match(source, /currentLabel="榜单详情"/);
});

test('ranking detail keeps reporting available without promoting it', () => {
  assert.match(source, /<ReportFlagButton/);
  assert.match(source, /targetType="ranking"/);
  assert.match(source, /targetId=\{ranking\.id\}/);
});

test('ranking detail uses an edge-to-edge mobile reading surface', () => {
  assert.match(source, /\.ranking-detail-article/);
  assert.match(source, /border-right: 0 !important/);
  assert.match(source, /padding: 12px 4px !important/);
});
