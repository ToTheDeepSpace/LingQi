type UnknownRecord = Record<string, unknown>;

const PUBLIC_PROFILE_FIELDS = [
  'id',
  'display_name',
  'avatar',
  'avatar_focus_x',
  'avatar_focus_y',
  'bio',
  'tags',
  'city',
  'gender',
  'sexual_orientation',
  'preferred_story_lines',
  'role',
  'role_type',
  'identity_roles',
  'social_links',
  'social_snapshots',
  'available_cities',
  'travel_status',
  'contact_unlock_enabled',
  'contact_intent_amount',
  'is_visible',
  'is_realname',
  'verified_dm',
  'verified_shop',
  'created_at',
  'services',
] as const;

const DATABASE_ERROR_PATTERN = /(?:invalid input syntax|duplicate key|violates? (?:foreign key|unique|check|not-null)|relation .* does not exist|column .* does not exist|permission denied for|syntax error at or near|current transaction is aborted|deadlock detected|could not serialize access|ON CONFLICT specification|schema cache)/i;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}

export function publicProfileAllowlist(profile: UnknownRecord): UnknownRecord {
  const result: UnknownRecord = {};
  for (const field of PUBLIC_PROFILE_FIELDS) {
    if (profile[field] !== undefined) result[field] = profile[field];
  }
  return result;
}

export function isInternalApiError(error: unknown): boolean {
  const record = asRecord(error);
  if (record.code || record.details || record.hint || record.constraint || record.routine || record.table) return true;
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : typeof record.message === 'string'
        ? record.message
        : '';
  return DATABASE_ERROR_PATTERN.test(message);
}

export function publicApiErrorMessage(error: unknown, production: boolean): string {
  if (production && isInternalApiError(error)) return '服务器暂时无法处理该请求，请稍后重试';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  const record = asRecord(error);
  return typeof record.message === 'string' ? record.message : '服务器错误';
}

export function publicAuditMetadata(metadata: unknown): UnknownRecord {
  const record = asRecord(metadata);
  const rawChanges = Array.isArray(record.changes) ? record.changes : [];
  const changes = rawChanges
    .map(change => asRecord(change))
    .map(change => ({
      field: typeof change.field === 'string' ? change.field : '',
      label: typeof change.label === 'string' ? change.label : undefined,
    }))
    .filter(change => change.field);
  return {
    changed_fields: changes.map(change => change.field),
    changes,
  };
}

export function allowedWebOrigin(origin: string | undefined, extraOrigins: string[] = []): boolean {
  if (!origin) return true;
  const fixed = new Set([
    'https://jumulu.jusichen.com',
    'https://lingqi.jusichen.com',
    'https://jusichen.com',
    'https://www.jusichen.com',
    ...extraOrigins,
  ]);
  if (fixed.has(origin)) return true;
  return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
}
