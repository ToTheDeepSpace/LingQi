import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const webSource = readFileSync(new URL('../../src/pages/AccountStatus.tsx', import.meta.url), 'utf8');
const miniSource = readFileSync(new URL('../../miniapp/jumulu/src/pages/mine/account-status.vue', import.meta.url), 'utf8');

test('web and miniapp account centers render growing histories in bounded batches', () => {
  for (const source of [webSource, miniSource]) {
    assert.match(source, /ACCOUNT_LIST_BATCH = 20/);
    assert.match(source, /\.slice\(0,/);
    assert.match(source, /继续加载/);
    assert.match(source, /已显示/);
  }
});

test('account center filters reset the visible submission batch', () => {
  assert.match(webSource, /setSubmissionLimit\(ACCOUNT_LIST_BATCH\)/);
  assert.match(miniSource, /watch\(\[activeTab, stateFilter\]/);
  assert.match(miniSource, /submissionLimit\.value = ACCOUNT_LIST_BATCH/);
});
