import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../src/pages/Stores.tsx', import.meta.url), 'utf8');

test('web store directory renders its growing catalog in bounded batches', () => {
  assert.match(source, /const STORE_LIST_BATCH = 20/);
  assert.match(source, /sortedItems\.slice\(0, visibleCount\)/);
  assert.match(source, /继续加载 \{nextBatchCount\} 家/);
  assert.match(source, /已显示 \{displayedItems\.length\} \/ \{sortedItems\.length\}/);
});

test('new store directory results reset the visible batch', () => {
  assert.match(source, /setVisibleCount\(STORE_LIST_BATCH\)/);
  assert.match(source, /setVisibleCount\(STORE_LIST_BATCH\);\s*setItems\(payload\.data \|\| \[\]\)/);
});

test('web and miniapp prioritize stores with more independent reputation evidence', () => {
  const miniappSource = readFileSync(new URL('../../miniapp/jumulu/src/pages/stores/index.vue', import.meta.url), 'utf8');

  for (const directorySource of [source, miniappSource]) {
    assert.match(directorySource, /rating_summary\?\.player_count/);
    assert.match(directorySource, /rating_summary\?\.review_count/);
    assert.match(directorySource, /rating_summary\?\.avg/);
    assert.match(directorySource, /localeCompare\(right\.dm_name, 'zh-CN'\)/);
  }
});
