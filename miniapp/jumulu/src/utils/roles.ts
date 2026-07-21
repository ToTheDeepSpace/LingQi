import type { Script, ScriptRole } from '../types'

export type RoleEntry = ScriptRole & { target_id: string; script_id: string; script_name: string }

export function flattenRoles(scripts: Script[]): RoleEntry[] {
  return scripts.flatMap(script => [...(script.player_roles || []), ...(script.actor_roles || [])]
    .filter(role => role.role_name && role.target_id)
    .map(role => ({ ...role, target_id: role.target_id as string, script_id: script.id, script_name: script.name })))
}

export function roleKind(role: ScriptRole) {
  if (role.role_source === 'player' || role.role_kind === 'player') return '玩家角色'
  if (role.role_kind === 'dm') return 'DM'
  if (role.role_kind === 'field_control') return '场控'
  if (role.role_kind === 'npc') return 'NPC'
  if (role.role_kind === 'assistant') return '演绎协作'
  return role.role_kind || '演绎角色'
}
