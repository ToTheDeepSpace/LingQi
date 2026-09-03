import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const guardedPages = [
  'miniapp/jumulu/src/pages/rankings/create.vue',
  'miniapp/jumulu/src/pages/carpools/create.vue',
  'miniapp/jumulu/src/pages/commissions/create.vue',
  'miniapp/jumulu/src/pages/commissions/provider-edit.vue',
  'miniapp/jumulu/src/pages/dm/rate.vue',
  'miniapp/jumulu/src/pages/stores/rate.vue',
  'miniapp/jumulu/src/pages/dm/claim.vue',
  'miniapp/jumulu/src/pages/feedback/index.vue',
  'miniapp/jumulu/src/pages/mine/account.vue',
  'miniapp/jumulu/src/pages/mine/account-status.vue',
  'miniapp/jumulu/src/pages/report/index.vue',
];

test('dedicated miniapp write forms hide their fields until login', () => {
  for (const file of guardedPages) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /import AuthFormGate from /, `${file} must import AuthFormGate`);
    assert.match(source, /<AuthFormGate\b/, `${file} must wrap its form in AuthFormGate`);
  }
});

test('the shared form gate redirects before rendering its slot', () => {
  const source = readFileSync('miniapp/jumulu/src/components/AuthFormGate.vue', 'utf8');
  assert.match(source, /const authenticated = ref\(Boolean\(readAuth\(\)\?\.token\)\)/);
  assert.match(source, /onMounted\([\s\S]*?setTimeout\([\s\S]*?requireLogin\(\)/);
  assert.match(source, /uni\.\$on\('jumulu:auth-changed', syncAuth\)/);
  assert.match(source, /if \(authenticated\.value && redirectTimer\)[\s\S]*?clearTimeout\(redirectTimer\)/);
  assert.match(source, /onUnmounted\([\s\S]*?uni\.\$off\('jumulu:auth-changed', syncAuth\)/);
  assert.match(source, /onUnmounted\([\s\S]*?if \(redirectTimer\) clearTimeout\(redirectTimer\)/);
  assert.match(source, /<slot v-if="authenticated"/);
  assert.match(source, /<view v-else class="auth-form-gate"/);
});

test('private form pages do not request account data before login', () => {
  const feedback = readFileSync('miniapp/jumulu/src/pages/feedback/index.vue', 'utf8');
  const provider = readFileSync('miniapp/jumulu/src/pages/commissions/provider-edit.vue', 'utf8');
  const claim = readFileSync('miniapp/jumulu/src/pages/dm/claim.vue', 'utf8');

  assert.match(feedback, /if \(readAuth\(\)\?\.token\) void load\(\)/);
  assert.match(provider, /onShow\(\(\) => \{[\s\S]*?if \(readAuth\(\)\?\.token\) void load\(\)/);
  assert.match(claim, /onShow\(\(\) => \{ if \(id\.value && readAuth\(\)\?\.token && !submitting\.value\) void load\(\)/);
});

test('public discovery pages require login before opening write flows', () => {
  const rankings = readFileSync('miniapp/jumulu/src/pages/rankings/index.vue', 'utf8');
  const dmIndex = readFileSync('miniapp/jumulu/src/pages/dm/index.vue', 'utf8');
  const storeIndex = readFileSync('miniapp/jumulu/src/pages/stores/index.vue', 'utf8');
  const dmDetail = readFileSync('miniapp/jumulu/src/pages/dm/detail.vue', 'utf8');
  const storeDetail = readFileSync('miniapp/jumulu/src/pages/stores/detail.vue', 'utf8');
  const profileDetail = readFileSync('miniapp/jumulu/src/pages/profile/detail.vue', 'utf8');

  assert.match(rankings, /function createRanking\(\) \{ void requireLogin\(\)\.then\([\s\S]*?\/pages\/rankings\/create/);
  assert.match(dmIndex, /function rate\(\) \{ void requireLogin\(\)\.then\([\s\S]*?\/pages\/dm\/rate/);
  assert.match(dmIndex, /function create\([\s\S]*?requireLogin\(\)\.then/);
  assert.match(storeIndex, /function openRate\(\) \{ void requireLogin\(\)\.then\([\s\S]*?\/pages\/stores\/rate/);
  assert.match(storeIndex, /function create\([\s\S]*?requireLogin\(\)\.then/);
  for (const source of [dmDetail, storeDetail]) {
    assert.match(source, /function (?:goRate|openRate)\(\) \{ void requireLogin\(\)\.then/);
    assert.match(source, /function (?:goRanking|createRanking)\(\)[\s\S]*?requireLogin\(\)\.then/);
    assert.match(source, /function (?:goClaim|openClaim)\(\)[\s\S]*?requireLogin\(\)\.then/);
  }
  assert.match(profileDetail, /function editListing\(\)[\s\S]*?requireLogin\(\)\.then\([\s\S]*?\/pages\/commissions\/provider-edit/);
});

test('inline review and comment composers require login before accepting text', () => {
  const roles = readFileSync('miniapp/jumulu/src/pages/roles/detail.vue', 'utf8');
  const rankings = readFileSync('miniapp/jumulu/src/pages/rankings/detail.vue', 'utf8');

  assert.match(roles, /async function openComposer\(\)[\s\S]*?await requireLogin\(\)[\s\S]*?composerOpen\.value = true/);
  assert.match(roles, /@tap="openComposer"/);
  assert.match(rankings, /v-if="readAuth\(\)\?\.token" class="composer surface"/);
  assert.match(rankings, /v-else class="secondary-button login-comment"/);
});
