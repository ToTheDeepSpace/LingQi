import type { ScriptCatalogItem, ScriptRoleCatalogItem } from '../types/index.js';

export type ScriptRoleEntry = ScriptRoleCatalogItem & {
  script_id: string;
  script_name: string;
};

export function rolesForScript(script: ScriptCatalogItem) {
  return [...(script.player_roles || []), ...(script.actor_roles || [])]
    .filter(role => role.role_name && role.target_id);
}

export function flattenScriptRoles(scripts: ScriptCatalogItem[]): ScriptRoleEntry[] {
  return scripts.flatMap(script => rolesForScript(script).map(role => ({
    ...role,
    script_id: script.id,
    script_name: script.name,
  })));
}

export function roleKindLabel(role: ScriptRoleCatalogItem) {
  if (role.role_source === 'player' || role.role_kind === 'player') return '玩家角色';
  if (role.role_kind === 'dm') return 'DM';
  if (role.role_kind === 'field_control') return '场控';
  if (role.role_kind === 'npc') return 'NPC';
  if (role.role_kind === 'assistant') return '演绎协作';
  if (role.role_kind === 'actor') return '演绎角色';
  return role.role_kind || '演绎角色';
}

export function matchesRoleSearch(role: ScriptRoleEntry, query: string) {
  const key = query.trim().toLocaleLowerCase('zh-CN');
  if (!key) return true;
  return [role.role_name, role.script_name, roleKindLabel(role)]
    .join(' ')
    .toLocaleLowerCase('zh-CN')
    .includes(key);
}
