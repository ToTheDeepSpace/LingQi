import test from 'node:test';
import assert from 'node:assert/strict';
import { dmAffiliationLabel, dmClaimLabel } from '../src/lib/dmDossierPresentation.js';

test('unclaimed dossiers never describe employment as a DM self declaration', () => {
  assert.equal(dmClaimLabel('unclaimed'), '未认领');
  assert.equal(dmAffiliationLabel({ claimStatus: 'unclaimed', employmentStatus: 'freelance' }), '暂无受雇店家资料');
});

test('community and owner affiliation sources use current provenance wording', () => {
  assert.equal(dmAffiliationLabel({
    claimStatus: 'unclaimed',
    affiliation: { status: 'pending', store_name: '止行剧场', source: 'community_unverified' },
  }), '社区提供：任职于 止行剧场');
  assert.equal(dmAffiliationLabel({
    claimStatus: 'approved',
    affiliation: { status: 'pending', store_name: '止行剧场', source: 'self_declared' },
  }), 'DM本人提供：任职于 止行剧场');
});

test('confirmed and legacy relationships use their current public wording', () => {
  assert.equal(dmAffiliationLabel({ affiliation: { status: 'approved', store_name: '止行剧场' } }), '止行剧场 已确认任职');
  assert.equal(dmAffiliationLabel({ affiliation: { status: 'legacy_unverified', store_name: '止行剧场' } }), '社区提供：任职于 止行剧场');
});
