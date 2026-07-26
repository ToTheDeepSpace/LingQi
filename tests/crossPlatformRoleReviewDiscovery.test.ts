import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('website role reviews open on rated roles instead of an unreviewed script directory', () => {
  const source = readFileSync('src/pages/Scripts.tsx', 'utf8');
  const detail = readFileSync('src/pages/RoleRatingDetail.tsx', 'utf8');

  assert.match(source, /flattenScriptRoles\(scripts\)/);
  assert.match(source, /filter\(role => Number\(role\.rating_count \|\| 0\) > 0\)/);
  assert.match(source, /title="角色点评"/);
  assert.match(source, /已有角色评分/);
  assert.doesNotMatch(detail, /返回全部角色/);
  assert.match(detail, /currentLabel="角色评分详情"/);
});

test('miniapp role reviews use the same rated-role-first discovery model', () => {
  const source = readFileSync('miniapp/jumulu/src/pages/roles/index.vue', 'utf8');
  const detail = readFileSync('miniapp/jumulu/src/pages/roles/detail.vue', 'utf8');

  assert.match(source, /flattenRoles\(scripts\.value\)/);
  assert.match(source, /filter\(role => Number\(role\.rating_count \|\| 0\) > 0\)/);
  assert.match(source, /activeView = ref<'rated' \| 'scripts'>\('rated'\)/);
  assert.match(source, />已有点评 <text>/);
  assert.match(source, />全部剧本 <text>/);
  assert.match(source, /class="role-row"/);
  assert.doesNotMatch(source, /等待第一条角色评价/);
  assert.match(detail, /const composerOpen = ref\(false\)/);
  assert.match(detail, /v-if="!composerOpen" class="secondary-button write-review"/);
  assert.match(detail, /v-else class="composer surface"/);
});
