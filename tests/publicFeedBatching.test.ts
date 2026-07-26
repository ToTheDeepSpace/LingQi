import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rankingsSource = readFileSync(new URL('../../src/pages/Rankings.tsx', import.meta.url), 'utf8');
const citySource = readFileSync(new URL('../../src/pages/CityReputation.tsx', import.meta.url), 'utf8');

test('web ranking feed matches the compact miniapp batch size', () => {
  assert.match(rankingsSource, /const RANKING_LIST_BATCH = 12/);
  assert.match(rankingsSource, /rankedItems\.slice\(0, visibleCount\)/);
  assert.match(rankingsSource, /继续加载 \{nextRankingBatch\} 条/);
  assert.match(rankingsSource, /已显示 \{displayedRankings\.length\} \/ \{rankedItems\.length\}/);
});

test('city reputation keeps its long object catalog in bounded batches', () => {
  assert.match(citySource, /const CITY_REPUTATION_BATCH = 20/);
  assert.match(citySource, /items\.slice\(0, visibleCount\)/);
  assert.match(citySource, /继续加载 \{nextBatchCount\} 个对象/);
  assert.match(citySource, /已显示 \{displayedItems\.length\} \/ \{items\.length\}/);
});

test('fresh feed results reset each page to its first batch', () => {
  assert.match(rankingsSource, /setVisibleCount\(RANKING_LIST_BATCH\);\s*setItems\(list\)/);
  assert.match(citySource, /setVisibleCount\(CITY_REPUTATION_BATCH\);\s*setItems\(d\.data\?\.items \|\| \[\]\)/);
});
