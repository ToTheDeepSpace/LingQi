export const MAX_DOSSIER_PHOTOS = 9;
export const MAX_DOSSIER_COMMON_SCRIPTS = 20;
export const MAX_DOSSIER_CAREER_ENTRIES = 12;
export const MAX_DOSSIER_RELATED_ENTITIES = 12;

export const DOSSIER_SENSITIVE_FIELDS = ['birth_year', 'height_cm', 'weight_kg'] as const;

export type DossierSensitiveField = typeof DOSSIER_SENSITIVE_FIELDS[number];

export type DossierPhoto = {
  url: string;
  name?: string | null;
  type?: string | null;
  caption?: string | null;
  focus_x?: number | null;
  focus_y?: number | null;
};

export type DossierNamedRef = {
  id: string;
  name: string;
};

export type DossierCareerEntry = {
  store_dossier_id?: string | null;
  store_name: string;
  started_month?: string | null;
  ended_month?: string | null;
  role_title?: string | null;
  note?: string | null;
};

function compactText(value: unknown, maxLength: number) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function finiteFocus(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : fallback;
}

export function normalizeDossierIntegerInput(value: unknown, min: number, max: number, label: string) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' && !/^\d+$/.test(String(value).trim())) throw new Error(`${label}必须填写整数`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${label}格式不正确`);
  return parsed;
}

export function normalizeDossierMonth(value: unknown) {
  const text = compactText(value, 10);
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}`;
}

export function normalizeDossierPhotos(input: unknown, fallbackUrl?: unknown): DossierPhoto[] {
  const rows = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const photos: DossierPhoto[] = [];
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const url = compactText(row.url, 800);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    photos.push({
      url,
      name: compactText(row.name, 120) || null,
      type: compactText(row.type, 80) || null,
      caption: compactText(row.caption, 160) || null,
      focus_x: finiteFocus(row.focus_x ?? row.focusX, 50),
      focus_y: finiteFocus(row.focus_y ?? row.focusY, 25),
    });
    if (photos.length >= MAX_DOSSIER_PHOTOS) break;
  }
  const fallback = compactText(fallbackUrl, 800);
  if (photos.length === 0 && fallback) {
    photos.push({ url: fallback, name: null, type: null, caption: null, focus_x: 50, focus_y: 25 });
  }
  return photos;
}

export function normalizeDossierNamedRefs(input: unknown, max = MAX_DOSSIER_RELATED_ENTITIES): DossierNamedRef[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const refs: DossierNamedRef[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = compactText(row.id, 120);
    const name = compactText(row.name, 100);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    refs.push({ id, name });
    if (refs.length >= max) break;
  }
  return refs;
}

export function normalizeDossierCareerHistory(input: unknown): DossierCareerEntry[] {
  if (!Array.isArray(input)) return [];
  const entries: DossierCareerEntry[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const storeName = compactText(row.store_name ?? row.storeName, 100);
    if (!storeName) continue;
    const startedMonth = normalizeDossierMonth(row.started_month ?? row.startedMonth);
    const endedMonth = normalizeDossierMonth(row.ended_month ?? row.endedMonth);
    if (startedMonth && endedMonth && endedMonth < startedMonth) continue;
    entries.push({
      store_dossier_id: compactText(row.store_dossier_id ?? row.storeDossierId, 120) || null,
      store_name: storeName,
      started_month: startedMonth,
      ended_month: endedMonth,
      role_title: compactText(row.role_title ?? row.roleTitle, 60) || null,
      note: compactText(row.note, 240) || null,
    });
    if (entries.length >= MAX_DOSSIER_CAREER_ENTRIES) break;
  }
  return entries;
}

export function dossierSensitiveFieldsInPatch(patch: Record<string, unknown>) {
  return DOSSIER_SENSITIVE_FIELDS.filter(field => Object.prototype.hasOwnProperty.call(patch, field));
}

export function dossierPatchForOwnerConsent(
  patch: Record<string, unknown>,
  input: { submitterIsOwner: boolean; ownerResponseStatus?: string | null },
) {
  const ownerConsented = input.submitterIsOwner || input.ownerResponseStatus === 'agreed';
  const appliedPatch: Record<string, unknown> = {};
  const omittedSensitiveFields: DossierSensitiveField[] = [];
  for (const [field, value] of Object.entries(patch)) {
    if (!ownerConsented && (DOSSIER_SENSITIVE_FIELDS as readonly string[]).includes(field)) {
      omittedSensitiveFields.push(field as DossierSensitiveField);
      continue;
    }
    appliedPatch[field] = value;
  }
  return { appliedPatch, omittedSensitiveFields, ownerConsented };
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]));
  }
  return value === undefined ? null : value;
}

export function dossierComparableValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'object') return JSON.stringify(stableValue(value));
  return String(value);
}
