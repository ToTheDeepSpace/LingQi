export const RANKING_AUTHOR_EDITABLE_FIELDS = [
  'content',
  'subject_url',
  'event_date',
  'event_script_name',
  'event_store_name',
] as const;

export type RankingAuthorEditableField = typeof RANKING_AUTHOR_EDITABLE_FIELDS[number];

export type RankingAuthorEditChange = {
  field: RankingAuthorEditableField;
  label: string;
  before: unknown;
  after: unknown;
};

export type RankingAuthorEditAssessment = {
  allowed: boolean;
  reason: string | null;
  patch: Partial<Record<RankingAuthorEditableField, string | null>>;
  changes: RankingAuthorEditChange[];
  metrics: {
    originalLength: number;
    nextLength: number;
    retainedCharacterRatio: number;
    retainedBigramRatio: number;
    addedCharacters: number;
    removedCharacters: number;
  };
};

const FIELD_LABELS: Record<RankingAuthorEditableField, string> = {
  content: '正文内容',
  subject_url: '社交主页',
  event_date: '事件日期',
  event_script_name: '相关剧本',
  event_store_name: '相关店家',
};

function normalizedText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\r\n/g, '\n').trim().slice(0, maxLength);
}

function comparableText(value: unknown) {
  return normalizedText(value, 4000)
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function multisetOverlapRatio(original: string, next: string) {
  if (!original) return next ? 0 : 1;
  const counts = new Map<string, number>();
  for (const char of next) counts.set(char, (counts.get(char) || 0) + 1);
  let common = 0;
  for (const char of original) {
    const remaining = counts.get(char) || 0;
    if (remaining <= 0) continue;
    common += 1;
    counts.set(char, remaining - 1);
  }
  return common / original.length;
}

function ngrams(value: string, size = 2) {
  if (!value) return [];
  if (value.length < size) return [value];
  return Array.from({ length: value.length - size + 1 }, (_, index) => value.slice(index, index + size));
}

function multisetContainmentRatio(original: string, next: string) {
  const originalGrams = ngrams(original);
  if (originalGrams.length === 0) return next ? 0 : 1;
  const counts = new Map<string, number>();
  for (const gram of ngrams(next)) counts.set(gram, (counts.get(gram) || 0) + 1);
  let common = 0;
  for (const gram of originalGrams) {
    const remaining = counts.get(gram) || 0;
    if (remaining <= 0) continue;
    common += 1;
    counts.set(gram, remaining - 1);
  }
  return common / originalGrams.length;
}

function sameValue(a: unknown, b: unknown) {
  return normalizedText(a, 4000) === normalizedText(b, 4000);
}

function editablePatch(input: Record<string, unknown>) {
  const patch: Partial<Record<RankingAuthorEditableField, string | null>> = {};
  for (const field of RANKING_AUTHOR_EDITABLE_FIELDS) {
    if (!(field in input)) continue;
    const maxLength = field === 'content' ? 4000 : field === 'subject_url' ? 500 : 160;
    const value = normalizedText(input[field], maxLength);
    patch[field] = value || null;
  }
  return patch;
}

export function assessRankingAuthorEdit(
  before: Record<string, unknown>,
  input: Record<string, unknown>,
): RankingAuthorEditAssessment {
  const forbiddenFields = ['type', 'subject_name', 'subject_type', 'subject_city', 'subject_dossier_id', 'poster_id', 'author_name'];
  const attemptedForbidden = forbiddenFields.filter(field => field in input);
  const patch = editablePatch(input);
  const changes = (Object.keys(patch) as RankingAuthorEditableField[])
    .filter(field => !sameValue(before[field], patch[field]))
    .map(field => ({ field, label: FIELD_LABELS[field], before: before[field] ?? null, after: patch[field] ?? null }));

  const original = comparableText(before.content);
  const next = comparableText('content' in patch ? patch.content : before.content);
  const retainedCharacterRatio = multisetOverlapRatio(original, next);
  const retainedBigramRatio = multisetContainmentRatio(original, next);
  const addedCharacters = Math.max(0, next.length - original.length);
  const removedCharacters = Math.max(0, original.length - next.length);
  const metrics = {
    originalLength: original.length,
    nextLength: next.length,
    retainedCharacterRatio,
    retainedBigramRatio,
    addedCharacters,
    removedCharacters,
  };

  if (attemptedForbidden.length > 0) {
    return { allowed: false, reason: '榜单类型、评价对象、所在城市、关联档案和发布人不能通过修改申请变更', patch, changes, metrics };
  }
  if (changes.length === 0) return { allowed: false, reason: '没有检测到需要提交的修改', patch, changes, metrics };
  if ('content' in patch && !next) return { allowed: false, reason: '正文不能为空', patch, changes, metrics };
  if (patch.event_date && !/^\d{4}-\d{2}-\d{2}$/.test(patch.event_date)) {
    return { allowed: false, reason: '事件日期请使用 YYYY-MM-DD 格式', patch, changes, metrics };
  }

  if (changes.some(change => change.field === 'content')) {
    const maxAddition = original.length < 40 ? 30 : Math.max(60, Math.ceil(original.length * 0.5));
    const maxRemoval = Math.max(12, Math.ceil(original.length * 0.4));
    const shortOriginal = original.length < 8;
    const preservesCore = shortOriginal
      ? retainedCharacterRatio >= 0.5
      : retainedCharacterRatio >= 0.65 && retainedBigramRatio >= 0.45;
    if (!preservesCore || addedCharacters > maxAddition || removedCharacters > maxRemoval) {
      return {
        allowed: false,
        reason: '修改幅度过大。这里只能订正错字、补充上下文或删除少量不准确内容；请下架原帖后另发新帖',
        patch,
        changes,
        metrics,
      };
    }
  }

  return { allowed: true, reason: null, patch, changes, metrics };
}
