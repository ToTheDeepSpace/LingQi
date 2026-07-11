import assert from 'node:assert/strict';
import test from 'node:test';
import { flattenScriptRoles, matchesRoleSearch, roleKindLabel } from '../src/lib/scriptRoleCatalog.js';
import type { ScriptCatalogItem } from '../src/types/index.js';

const scripts: ScriptCatalogItem[] = [{
  id: 'script-1',
  name: '琳琅',
  player_roles: [{
    target_id: 'role-player',
    role_name: '祝魇',
    role_kind: 'player',
    role_source: 'player',
    rating_avg: 4.8,
    rating_count: 3,
  }],
  actor_roles: [{
    target_id: 'role-dm',
    role_name: '司礼',
    role_kind: 'dm',
    role_source: 'actor',
  }],
}];

test('flattens player and actor roles with their script', () => {
  const roles = flattenScriptRoles(scripts);
  assert.equal(roles.length, 2);
  assert.equal(roles[0].script_name, '琳琅');
  assert.equal(roles[1].script_id, 'script-1');
});

test('searches by role, script, and role type', () => {
  const roles = flattenScriptRoles(scripts);
  assert.equal(matchesRoleSearch(roles[0], '祝魇'), true);
  assert.equal(matchesRoleSearch(roles[0], '琳琅'), true);
  assert.equal(matchesRoleSearch(roles[1], 'DM'), true);
  assert.equal(matchesRoleSearch(roles[1], '不存在'), false);
});

test('uses readable role type labels', () => {
  const roles = flattenScriptRoles(scripts);
  assert.equal(roleKindLabel(roles[0]), '玩家角色');
  assert.equal(roleKindLabel(roles[1]), 'DM');
});
