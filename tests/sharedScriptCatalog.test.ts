import assert from 'node:assert/strict';
import test from 'node:test';
import { findSharedRole, findSharedScript, normalizeSharedCatalog } from '../api/sharedScriptCatalog.js';

const catalog = normalizeSharedCatalog([{
  id: '8dce5b84-35e2-46f4-9a2e-ba7913725f0f',
  name: '归途七万里',
  canonical_key: '归途七万里',
  player_roles: [{
    target_id: 'shared:8dce5b84-35e2-46f4-9a2e-ba7913725f0f:player:abc',
    role_name: '容葵',
    gender: '女',
  }],
}]);

test('finds the canonical script by id or normalized name', () => {
  assert.equal(findSharedScript(catalog, catalog[0].id)?.name, '归途七万里');
  assert.equal(findSharedScript(catalog, '', ' 归途七万里 ')?.id, catalog[0].id);
});

test('finds a stable shared role target', () => {
  const targetId = catalog[0].player_roles[0].target_id;
  const result = findSharedRole(catalog, targetId);
  assert.equal(result?.script.name, '归途七万里');
  assert.equal(result?.role.role_name, '容葵');
});
