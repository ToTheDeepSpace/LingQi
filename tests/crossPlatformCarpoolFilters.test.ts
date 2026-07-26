import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('website carpool filters apply automatically in a compact mobile grid', () => {
  const source = readFileSync('src/pages/Carpools.tsx', 'utf8');
  const styles = readFileSync('src/pages/Carpools.css', 'utf8');

  assert.match(source, /carpool-filter-grid/);
  assert.doesNotMatch(source, />筛选<\/button>/);
  assert.match(source, /setTimeout\(\(\) => void loadPublic\(\), 250\)/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
});

test('miniapp carpool filters keep city, date, and script or role search together', () => {
  const source = readFileSync('miniapp/jumulu/src/pages/carpools/index.vue', 'utf8');

  assert.match(source, /const filterDate = ref\(''\)/);
  assert.match(source, /mode="date"/);
  assert.match(source, /filterDate \|\| '全部日期'/);
  assert.match(source, /搜索剧本或角色/);
  assert.match(source, /String\(item\.event_date \|\| ''\)\.slice\(0, 10\) === filterDate\.value/);
});
