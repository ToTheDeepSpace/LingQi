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
  assert.match(detail, /v-if="!activePhoto" class="hero__avatar"/);
  assert.match(detail, /\.hero__identity\.compact\s*\{[\s\S]*grid-template-columns:\s*112rpx minmax\(0, 1fr\)/);
  assert.doesNotMatch(detail, /\.hero__image,\s*\.hero__avatar\s*\{[\s\S]*height:\s*500rpx/);
  assert.match(detail, /class="secondary-button claim-action"/);
  assert.match(detail, /\.hero-actions \.claim-action\s*\{[\s\S]*width:\s*auto/);
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
  assert.match(detail, /class="secondary-button claim-action"/);
  assert.match(detail, /\.hero-actions \.claim-action\s*\{[\s\S]*width:\s*auto/);
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

test('uses the same bonus balance language on the website and miniapp', () => {
  const checkin = read('miniapp/jumulu/src/components/DailyCheckinView.vue');
  const mine = read('miniapp/jumulu/src/pages/mine/index.vue');

  assert.match(checkin, /赠送榜金/);
  assert.match(mine, /领取赠送榜金/);
  assert.doesNotMatch(`${checkin}\n${mine}`, /助力金币/);
});

test('uses the same joy vote language across public website and miniapp surfaces', () => {
  const dashboard = read('src/pages/Dashboard.tsx');
  const dossier = read('src/pages/ReputationDossier.tsx');
  const miniRanking = read('miniapp/jumulu/src/components/RankingCard.vue');

  assert.ok(dashboard.includes('反对${item.oppose_count ?? 0} 欢乐'));
  assert.ok(dossier.includes('<span>欢乐 {event.joys || 0}</span>'));
  assert.ok(miniRanking.includes('欢乐 {{ item.joys || 0 }}'));
});

test('keeps the website reputation dossier on the shared compact content shell', () => {
  const dossier = read('src/pages/ReputationDossier.tsx');
  const styles = read('src/App.css');

  assert.match(dossier, /JumuluPageFrame currentLabel="对象档案"/);
  assert.doesNotMatch(dossier, /cityReputationTitle|reputation-dossier-hero|linear-gradient/);
  assert.match(styles, /\.reputation-dossier-metrics\s*\{[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.reputation-dossier-metrics\s*\{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
});

test('keeps the website commission publisher on the compact cross-platform task shell', () => {
  const publisher = read('src/pages/CreateCommission.tsx');

  assert.match(publisher, /JumuluPageFrame currentLabel="发布委托"/);
  assert.match(publisher, /JumuluCompactHeader/);
  assert.match(publisher, /ResponsibilityNotice compact/);
  assert.match(publisher, /className="commission-create-form"/);
  assert.doesNotMatch(publisher, /← 返回委托需求墙|linear-gradient/);
});

test('keeps publishing responsibility notices compact and uses the shared page back action', () => {
  const app = read('src/App.tsx');
  const notice = read('src/components/ResponsibilityNotice.tsx');
  const ranking = read('src/pages/CreateRanking.tsx');
  const carpool = read('src/pages/CreateCarpool.tsx');
  const guide = read('src/pages/CreateGuide.tsx');

  assert.match(app, /const showNavbar = pathname !== '\/login'/);
  assert.match(notice, /<details className=/);
  assert.match(notice, /查看责任说明/);
  assert.doesNotMatch(ranking, /← 返回红黑榜/);
  assert.doesNotMatch(carpool, /← 返回拼车区/);
  assert.doesNotMatch(guide, /‹ 返回攻略交易/);
  assert.match(guide, /JumuluPageFrame currentLabel="发布攻略"/);
  assert.match(guide, /JumuluCompactHeader/);
  assert.match(guide, /className="guide-create-grid"/);
  assert.match(guide, /MobileTaskAction/);
  assert.doesNotMatch(guide, /linear-gradient/);
});

test('keeps rating publishers on one page-level back action and the compact header', () => {
  const store = read('src/pages/StoreRating.tsx');
  const role = read('src/pages/RateScriptRole.tsx');

  assert.doesNotMatch(store, />返回店家评分<\/Link>/);
  assert.match(store, />取消评分<\/Link>/);
  assert.doesNotMatch(role, />返回角色评分<\/Link>/);
  assert.match(store, /JumuluCompactHeader/);
  assert.match(role, /JumuluCompactHeader/);
});

test('keeps follow settings compact and searchable across website and miniapp', () => {
  const website = read('src/pages/FollowSettings.tsx');
  const miniapp = read('miniapp/jumulu/src/pages/follows/index.vue');

  assert.match(website, /JumuluPageFrame currentLabel="关注设置"/);
  assert.match(website, /JumuluCompactHeader/);
  assert.match(website, /CitySearchSelect/);
  assert.match(website, /className="follow-settings-grid"/);
  assert.doesNotMatch(website, /返回我的主页/);
  assert.doesNotMatch(website, /CITIES\.map|matched\.map/);
  assert.match(miniapp, /CitySearchPicker/);
  assert.match(miniapp, /搜索并添加城市/);
  assert.match(miniapp, /class="settings-panel surface"/);
  assert.match(miniapp, /\{\{ cities\.length \}\}\/5/);
});

test('keeps creator income on the compact shell without a duplicate page return', () => {
  const source = read('src/pages/GuideIncome.tsx');

  assert.match(source, /JumuluPageFrame currentLabel="创作者收入"/);
  assert.match(source, /JumuluCompactHeader/);
  assert.match(source, /className="guide-income-metrics"/);
  assert.match(source, /className="guide-income-grid"/);
  assert.doesNotMatch(source, /返回我的主页|linear-gradient/);
});

test('keeps footer roadmap and boundary voting on the shared compact shell', () => {
  const roadmap = read('src/pages/Roadmap.tsx');
  const boundaryVotes = read('src/pages/BoundaryVotes.tsx');
  const styles = read('src/App.css');

  assert.match(roadmap, /JumuluPageFrame currentLabel="口碑路线图"/);
  assert.match(roadmap, /JumuluCompactHeader/);
  assert.doesNotMatch(roadmap, /返回红黑白榜|linear-gradient/);
  assert.match(boundaryVotes, /JumuluPageFrame currentLabel="边界投票"/);
  assert.match(boundaryVotes, /JumuluCompactHeader/);
  assert.doesNotMatch(boundaryVotes, /返回口碑路线图|linear-gradient/);
  assert.match(styles, /\.boundary-topic-grid[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.boundary-topic-grid[\s\S]*minmax\(0, 1fr\)/);
});

test('keeps website feedback aligned with the compact miniapp task flow', () => {
  const website = read('src/pages/Contact.tsx');
  const autosave = read('src/components/DraftAutosaveNotice.tsx');
  const miniapp = read('miniapp/jumulu/src/pages/feedback/index.vue');
  const styles = read('src/App.css');

  assert.match(website, /JumuluPageFrame currentLabel="建议反馈"/);
  assert.match(website, /JumuluCompactHeader/);
  assert.match(website, /className="contact-page-grid"/);
  assert.match(website, /MobileTaskAction/);
  assert.doesNotMatch(website, /linear-gradient|borderRadius: 16/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.site-feedback-float\s*\{\s*display:\s*none;/);
  assert.match(autosave, /InfoTip/);
  assert.match(autosave, /自动保存/);
  assert.match(miniapp, /问题说明/);
  assert.match(miniapp, /提交反馈/);
});

test('keeps the website carpool workbench message-first and compact', () => {
  const page = read('src/pages/CreateCarpool.tsx');
  const miniPage = read('miniapp/jumulu/src/pages/carpools/create.vue');

  assert.match(page, /JumuluPageFrame currentLabel="发布拼车"/);
  assert.match(page, /title="拼车工作台"/);
  assert.match(page, /className="carpool-create-primary-grid"/);
  assert.match(page, /<ResponsibilityNotice compact \/>/);
  assert.doesNotMatch(page, /linear-gradient\(135deg, #eef6ff, #fffaf2\)/);
  assert.match(miniPage, /title="拼车工作台"/);
  assert.match(miniPage, /parseCarpoolMessage/);
  assert.match(miniPage, /粘贴车头消息/);
  assert.match(miniPage, /生成转发消息/);
  assert.match(miniPage, /subsidyType/);
});

test('exposes public provider availability without turning the miniapp profile into a calendar', () => {
  const source = read('miniapp/jumulu/src/pages/profile/detail.vue');

  assert.match(source, /\/availability/);
  assert.match(source, /近期可约/);
  assert.match(source, /availableSlots\.value\.slice\(0, 20\)/);
  assert.match(source, /class="availability" scroll-x/);
  assert.match(source, /v-if="availableSlots\.length"/);
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

test('keeps long admin safety identifiers inside narrow review cards', () => {
  const source = read('src/pages/Admin.tsx');

  assert.match(source, /function Meta[\s\S]*?overflowWrap: 'anywhere'/);
  assert.match(source, /function ContentBox[\s\S]*?overflowWrap: 'anywhere'/);
  assert.match(source, /function Proof[\s\S]*?overflowWrap: 'anywhere'/);
});
