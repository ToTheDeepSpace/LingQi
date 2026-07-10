import assert from 'node:assert/strict';
import test from 'node:test';
import { hasRankingEvidence, normalizeRankingRevisionKind, rankingEvidenceIsRequired } from '../api/rankingWorkflow.js';

test('only an explicit evidence revision makes evidence mandatory', () => {
  assert.equal(normalizeRankingRevisionKind('content'), 'content');
  assert.equal(normalizeRankingRevisionKind('evidence'), 'evidence');
  assert.equal(rankingEvidenceIsRequired('content'), false);
  assert.equal(rankingEvidenceIsRequired('evidence'), true);
});

test('accepts only evidence entries with a non-empty URL', () => {
  assert.equal(hasRankingEvidence(undefined), false);
  assert.equal(hasRankingEvidence([]), false);
  assert.equal(hasRankingEvidence([{ name: '空文件', url: '  ' }]), false);
  assert.equal(hasRankingEvidence([{ name: '截图', url: '/uploads/lc-portfolio/proof.jpg' }]), true);
});
