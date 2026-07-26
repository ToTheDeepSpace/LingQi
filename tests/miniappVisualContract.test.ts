import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

type MiniappPages = {
  globalStyle?: {
    navigationStyle?: string;
    backgroundColor?: string;
  };
  tabBar?: {
    backgroundColor?: string;
    list?: Array<{ pagePath?: string; text?: string }>;
  };
};

test('keeps the miniapp navigation aligned with the public product language', () => {
  const pages = JSON.parse(read('miniapp/jumulu/src/pages.json')) as MiniappPages;
  const tabs = pages.tabBar?.list || [];

  assert.deepEqual(tabs.map((item) => item.text), ['百科', '红黑榜', '委托', '拼车', '我的']);
  assert.deepEqual(tabs.map((item) => item.pagePath), [
    'pages/index/index',
    'pages/rankings/index',
    'pages/commissions/index',
    'pages/carpools/index',
    'pages/mine/index',
  ]);
  assert.equal(pages.globalStyle?.navigationStyle, 'custom');
  assert.equal(pages.globalStyle?.backgroundColor?.toLowerCase(), '#fffdf8');
  assert.equal(pages.tabBar?.backgroundColor?.toLowerCase(), '#fffdf8');
});

test('keeps shared visual tokens and compact form actions in the miniapp', () => {
  const app = read('miniapp/jumulu/src/App.vue').toLowerCase();

  assert.match(app, /background:\s*#fffdf8/);
  assert.match(app, /\.primary-button\s*\{\s*background:\s*#275389/);
  assert.match(app, /\.sticky-submit\s*\{[\s\S]*position:\s*sticky/);

  for (const path of [
    'miniapp/jumulu/src/pages/rankings/create.vue',
    'miniapp/jumulu/src/pages/carpools/create.vue',
    'miniapp/jumulu/src/pages/commissions/create.vue',
  ]) {
    const source = read(path);
    assert.match(source, /class="sticky-submit"/, `${path} must keep its main action reachable`);
    assert.match(source, /class="[^"]*primary-button[^"]*"/, `${path} must use the shared primary action`);
  }
});

test('keeps long carpool copy compact without discarding the original text', () => {
  const source = read('miniapp/jumulu/src/pages/carpools/index.vue');

  assert.match(source, /expandedIds/);
  assert.match(source, /展开全部/);
  assert.match(source, /收起说明/);
  assert.match(source, /\.listing__content\.collapsed/);
  assert.match(source, /-webkit-line-clamp:\s*3/);
});

test('renders public dossier directories in bounded batches', () => {
  for (const path of [
    'miniapp/jumulu/src/pages/dm/index.vue',
    'miniapp/jumulu/src/pages/stores/index.vue',
  ]) {
    const source = read(path);
    assert.match(source, /const PAGE_SIZE = 20/);
    assert.match(source, /\.slice\(0, displayLimit\.value\)/);
    assert.match(source, /继续加载/);
    assert.match(source, /watch\(\[query, city\]/);
  }
});

test('keeps the ranking feed bounded and moves persistent notices behind an explicit action', () => {
  const source = read('miniapp/jumulu/src/pages/rankings/index.vue');

  assert.match(source, /const PAGE_SIZE = 12/);
  assert.match(source, /\.slice\(0, displayLimit\.value\)/);
  assert.match(source, /继续加载/);
  assert.match(source, /ⓘ 发布须知/);
  assert.doesNotMatch(source, /class="responsibility"/);
});
