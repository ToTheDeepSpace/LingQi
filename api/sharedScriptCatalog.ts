export type SharedCatalogRole = {
  id: string;
  target_id: string;
  role_name: string;
  gender: string;
  tags: string[];
  role_kind: string;
  role_source: 'player' | 'actor';
};

export type SharedCatalogScript = {
  id: string;
  name: string;
  canonical_key: string;
  duration_minutes: number | null;
  min_duration_hours: number | null;
  max_duration_hours: number | null;
  player_count: number | null;
  player_selection_rule: string | null;
  credits: Record<string, string[]>;
  player_roles: SharedCatalogRole[];
  actor_roles: SharedCatalogRole[];
  boards: unknown[];
  updated_at: string | null;
};

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanRole(input: unknown, source: 'player' | 'actor'): SharedCatalogRole | null {
  const row = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const roleName = cleanText(row.role_name, 120);
  const targetId = cleanText(row.target_id ?? row.id, 160);
  if (!roleName || !targetId) return null;
  return {
    id: targetId,
    target_id: targetId,
    role_name: roleName,
    gender: cleanText(row.gender, 40),
    tags: Array.isArray(row.tags) ? row.tags.map(tag => cleanText(tag, 24)).filter(Boolean).slice(0, 8) : [],
    role_kind: source === 'player' ? 'player' : (cleanText(row.role_kind, 40) || 'dm'),
    role_source: source,
  };
}

export function normalizeSharedCatalog(input: unknown): SharedCatalogScript[] {
  const rows = Array.isArray(input) ? input : [];
  return rows.map(raw => {
    const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const creditsSource = row.credits && typeof row.credits === 'object' && !Array.isArray(row.credits)
      ? row.credits as Record<string, unknown>
      : {};
    const credits = Object.entries(creditsSource).reduce<Record<string, string[]>>((result, [key, value]) => {
      if (!Array.isArray(value)) return result;
      const values = value.map(item => cleanText(item, 100)).filter(Boolean).slice(0, 16);
      if (values.length) result[key] = values;
      return result;
    }, {});
    return {
      id: cleanText(row.id, 80),
      name: cleanText(row.name, 160),
      canonical_key: cleanText(row.canonical_key, 160),
      duration_minutes: Number(row.duration_minutes || 0) || null,
      min_duration_hours: Number(row.min_duration_hours || 0) || null,
      max_duration_hours: Number(row.max_duration_hours || 0) || null,
      player_count: Number(row.player_count || 0) || null,
      player_selection_rule: cleanText(row.player_selection_rule, 300) || null,
      credits,
      player_roles: (Array.isArray(row.player_roles) ? row.player_roles : []).map(role => cleanRole(role, 'player')).filter(Boolean) as SharedCatalogRole[],
      actor_roles: (Array.isArray(row.actor_roles) ? row.actor_roles : []).map(role => cleanRole(role, 'actor')).filter(Boolean) as SharedCatalogRole[],
      boards: Array.isArray(row.boards) ? row.boards : [],
      updated_at: cleanText(row.updated_at, 80) || null,
    };
  }).filter(script => script.id && script.name);
}

export function findSharedScript(catalog: SharedCatalogScript[], idInput: unknown, nameInput?: unknown) {
  const id = cleanText(idInput, 80);
  if (id) {
    const byId = catalog.find(script => script.id === id);
    if (byId) return byId;
  }
  const name = cleanText(nameInput, 160)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s·•・._—–/\\|,，、()（）【】-]+/g, '')
    .replaceAll('[', '')
    .replaceAll(']', '');
  return name ? catalog.find(script => script.canonical_key === name) || null : null;
}

export function findSharedRole(catalog: SharedCatalogScript[], targetIdInput: unknown) {
  const targetId = cleanText(targetIdInput, 160);
  if (!targetId) return null;
  for (const script of catalog) {
    const role = [...script.player_roles, ...script.actor_roles].find(candidate => candidate.target_id === targetId);
    if (role) return { script, role };
  }
  return null;
}
