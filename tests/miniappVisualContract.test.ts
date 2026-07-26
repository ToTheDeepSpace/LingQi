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
    assert.match(source, /watch\(\[query,\s*city/);
  }
});

test('keeps the miniapp DM directory sorting aligned with the website without mixing chanto into default reputation', () => {
  const source = read('miniapp/jumulu/src/pages/dm/index.vue');
  const sorter = read('miniapp/jumulu/src/utils/dossierSort.ts');

  assert.match(source, /sortDossiers\(filtered,\s*sortMode\.value,\s*chantoFirst\.value\)/);
  assert.match(source, /综合排序/);
  assert.match(source, /缠头优先/);
  assert.match(sorter, /if \(chantoFirst\)/);
  assert.match(sorter, /comprehensiveComparator/);
  assert.match(sorter, /Number\(hasRating\(left\)\).*Number\(hasRating\(right\)\)/);
  assert.match(sorter, /Number\(isVerified\(left\)\).*Number\(isVerified\(right\)\)/);
  assert.match(sorter, /Number\(hasPhoto\(left\)\).*Number\(hasPhoto\(right\)\)/);
});

test('shows the same DM identity and affiliation trust semantics on the miniapp detail', () => {
  const detail = read('miniapp/jumulu/src/pages/dm/detail.vue');
  const presentation = read('miniapp/jumulu/src/utils/dossierPresentation.ts');

  assert.match(detail, /dossierClaimLabel/);
  assert.match(detail, /dossierAffiliationLabel/);
  assert.match(detail, /class="status-row"/);
  assert.match(presentation, /DM 身份已认证/);
  assert.match(presentation, /暂无已确认店家/);
  assert.match(presentation, /社区提供：任职于/);
});

test('keeps stores without a photo compact and exposes claim trust status', () => {
  const detail = read('miniapp/jumulu/src/pages/stores/detail.vue');
  const presentation = read('miniapp/jumulu/src/utils/dossierPresentation.ts');

  assert.match(detail, /v-if="!data\.dossier\.photo_url" class="hero__avatar"/);
  assert.match(detail, /storeClaimLabel/);
  assert.match(detail, /\.hero__avatar\s*\{[\s\S]*width:\s*112rpx;[\s\S]*height:\s*112rpx/);
  assert.match(presentation, /店家已认领/);
  assert.match(presentation, /未认领店家档案/);
});

test('keeps public social profiles available as compact miniapp actions', () => {
  const source = read('miniapp/jumulu/src/pages/profile/detail.vue');

  assert.match(source, /social_links/);
  assert.match(source, /socialEntries/);
  assert.match(source, /social-link--douyin/);
  assert.match(source, /social-link--xiaohongshu/);
  assert.match(source, /setClipboardData/);
});

test('keeps the ranking feed bounded and moves persistent notices behind an explicit action', () => {
  const source = read('miniapp/jumulu/src/pages/rankings/index.vue');

  assert.match(source, /const PAGE_SIZE = 12/);
  assert.match(source, /\.slice\(0, displayLimit\.value\)/);
  assert.match(source, /继续加载/);
  assert.match(source, /ⓘ 发布须知/);
  assert.doesNotMatch(source, /class="responsibility"/);
});

test('keeps long-lived account histories bounded in the miniapp', () => {
  const source = read('miniapp/jumulu/src/pages/mine/account-status.vue');

  assert.match(source, /const ACCOUNT_LIST_BATCH = 20/);
  assert.match(source, /displayedNotices/);
  assert.match(source, /displayedSubmissions/);
  assert.match(source, /继续加载/);
});
