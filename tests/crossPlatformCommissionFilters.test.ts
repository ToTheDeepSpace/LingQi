import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('website commission filters use compact date and text discovery controls', () => {
  const source = readFileSync('src/pages/Commissions.tsx', 'utf8');
  const styles = readFileSync('src/pages/Commissions.css', 'utf8');

  assert.match(source, /placeholder="搜索剧本或角色"/);
  assert.match(source, /type="date"/);
  assert.match(source, /itemEnd < dateStart/);
  assert.match(source, /itemStart > dateEnd/);
  assert.match(source, /discoverScope === 'expedition' && !item\.accept_expedition/);
  assert.match(source, />本地需求<\/ViewButton>/);
  assert.match(source, />接受远征<\/ViewButton>/);
  assert.doesNotMatch(source, /剧本选单/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /commission-target-scroll/);
});

test('miniapp commission filters keep the same core city, date, and query semantics', () => {
  const source = readFileSync('miniapp/jumulu/src/pages/commissions/index.vue', 'utf8');

  assert.match(source, /CitySearchPicker/);
  assert.match(source, /const dateStart = ref\(''\)/);
  assert.match(source, /const dateEnd = ref\(''\)/);
  assert.match(source, /搜索剧本或角色/);
  assert.match(source, /needed_end_date \|\| item\.needed_date/);
});
