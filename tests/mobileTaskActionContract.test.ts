import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const webPages = [
  'src/pages/CreateRanking.tsx',
  'src/pages/DmRating.tsx',
  'src/pages/StoreRating.tsx',
  'src/pages/CreateCommission.tsx',
  'src/pages/CreateCarpool.tsx',
];

const miniappPages = [
  'miniapp/jumulu/src/pages/rankings/create.vue',
  'miniapp/jumulu/src/pages/dm/rate.vue',
  'miniapp/jumulu/src/pages/stores/rate.vue',
  'miniapp/jumulu/src/pages/commissions/create.vue',
  'miniapp/jumulu/src/pages/carpools/create.vue',
];

test('core web publishing forms keep a compact mobile primary action reachable', () => {
  for (const path of webPages) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /MobileTaskAction/, `${path} must expose its primary action on mobile`);
  }
});

test('matching miniapp publishing forms keep their sticky primary action', () => {
  for (const path of miniappPages) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /class="sticky-submit"/, `${path} must keep its primary action reachable`);
  }
});

test('the shared mobile action is fixed only on narrow screens', () => {
  const source = readFileSync('src/components/MobileTaskAction.css', 'utf8');
  assert.match(source, /@media \(max-width: 720px\)/);
  assert.match(source, /position: fixed/);
  assert.match(source, /min-height: 44px/);
});
