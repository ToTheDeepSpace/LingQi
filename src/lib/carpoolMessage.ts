import type { CarpoolSubsidyType } from '../types';

export type ParsedCarpoolMessage = {
  title?: string;
  eventDate?: string;
  startTime?: string;
  dateExpired: boolean;
  dateWarning?: string;
  scriptName?: string;
  roleName?: string;
  roleNote?: string;
  subsidyType: CarpoolSubsidyType;
  subsidyMode: 'none' | 'asking' | 'offering';
  subsidyAmount: number;
  subsidyDiscount: number | null;
  subsidyNote: string;
  leaderContact?: string;
  content: string;
  warnings: string[];
};

export type GenerateCarpoolMessageInput = {
  eventDate: string;
  startTime?: string;
  city?: string;
  scriptName: string;
  roleName?: string;
  neededCount?: number;
  subsidyType: CarpoolSubsidyType;
  subsidyAmount?: number;
  subsidyDiscount?: number | null;
  subsidyNote?: string;
  deadlineDate?: string;
  deadlineTime?: string;
  leaderContact?: string;
  content?: string;
};

const CN_NUM: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toLocalDate(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function normalizeText(text: string) {
  return text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

function parseChineseDiscount(text: string): number | null {
  if (/^\d(?:\.\d)?$/.test(text)) return Number(text);
  if (text.length === 1) return CN_NUM[text] || null;
  if (text.length === 2 && CN_NUM[text[0]] && CN_NUM[text[1]]) {
    return Number(`${CN_NUM[text[0]]}.${CN_NUM[text[1]]}`);
  }
  return null;
}

function extractDate(text: string, now: Date) {
  const match = text.match(/(?:^|[^\d])(\d{1,2})[.月/-](\d{1,2})(?:日)?/);
  if (!match) return { warnings: ['没有识别到日期，请手动选择。'] };
  const month = Number(match[1]);
  const day = Number(match[2]);
  const parsed = new Date(now.getFullYear(), month - 1, day);
  if (parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return { warnings: ['日期格式看起来不对，请手动确认。'] };
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (parsed < today) {
    return {
      dateExpired: true,
      dateWarning: `${month}.${day} 已经过了，默认认为这辆车不需要继续拼；如仍有效，请手动改日期。`,
      warnings: [`${month}.${day} 已过期，没有自动续到下一年。`],
    };
  }
  return { eventDate: toLocalDate(parsed), dateExpired: false, warnings: [] };
}

function extractTime(text: string) {
  const clock = text.match(/(\d{1,2})[:：](\d{2})/);
  if (clock) {
    const hour = Math.min(23, Math.max(0, Number(clock[1])));
    const minute = Math.min(59, Math.max(0, Number(clock[2])));
    return `${pad(hour)}:${pad(minute)}`;
  }
  if (/早场/.test(text)) return '10:00';
  if (/午场|中午/.test(text)) return '12:00';
  if (/下午场/.test(text)) return '14:00';
  if (/晚场|夜场/.test(text)) return '19:00';
  return '';
}

function extractScriptName(text: string) {
  const bracket = text.match(/《([^》]{1,80})》/);
  if (bracket) return bracket[1].trim();
  const beforeEq = text.split(/[=＝]/)[0] || '';
  const cleaned = beforeEq
    .replace(/🚗/g, '')
    .replace(/(?:^|[^\d])\d{1,2}[.月/-]\d{1,2}(?:日)?/g, ' ')
    .replace(/\d{1,2}[:：]\d{2}/g, ' ')
    .replace(/早场|午场|下午场|晚场|夜场|中午/g, ' ')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1]?.slice(0, 80) || '';
}

function collectSubsidy(text: string) {
  const matches: { index: number; priority: number; text: string; type: CarpoolSubsidyType; amount?: number; discount?: number }[] = [];
  const add = (regex: RegExp, type: CarpoolSubsidyType, priority: number, read?: (match: RegExpExecArray) => { amount?: number; discount?: number } | null) => {
    for (const match of text.matchAll(regex)) {
      const maybeExtra = read?.(match as RegExpExecArray);
      if (maybeExtra === null) continue;
      const extra = maybeExtra || {};
      matches.push({ index: match.index || 0, priority, text: match[0].trim(), type, ...extra });
    }
  };

  add(/(?:各|全员|每人)?(?:免票|免单|免车费)/g, 'free_ticket', 1);
  add(/(?:各|全员|每人)?(?:半价|半票)/g, 'half_price', 2);
  add(/([0-9](?:\.[0-9])?|[一二三四五六七八九]{1,2})折/g, 'discount', 3, m => ({ discount: parseChineseDiscount(m[1]) || undefined }));
  add(/[AaＡａ]\s*补\s*(\d+)?/g, 'a_subsidy', 4, m => ({ amount: m[1] ? Number(m[1]) : undefined }));
  add(/(?:补贴|补|减)\s*(\d+)/g, 'fixed_deduct', 5, m => {
    const prefix = text.slice(Math.max(0, (m.index || 0) - 3), m.index || 0);
    if (/[AaＡａ]\s*$/.test(prefix)) return null;
    return { amount: Number(m[1]) };
  });

  matches.sort((a, b) => a.index - b.index || a.priority - b.priority);
  const first = matches[0];
  const note = Array.from(new Set(matches.map(item => item.text))).join(' / ');
  return {
    subsidyType: first?.type || 'none',
    subsidyAmount: first?.amount || 0,
    subsidyDiscount: first?.discount || null,
    subsidyNote: note,
  };
}

function modeFromType(type: CarpoolSubsidyType): 'none' | 'asking' | 'offering' {
  if (type === 'none') return 'none';
  if (type === 'a_subsidy') return 'asking';
  return 'offering';
}

function extractRole(text: string, subsidyNote: string) {
  const afterEq = text.split(/[=＝]/).slice(1).join('=').split('\n')[0] || '';
  if (!afterEq.trim()) return '';
  let role = afterEq.replace(/[（(][^）)]*[）)]/g, ' ');
  role = role.replace(/(?:车头微信|微信|wx|vx|VX|WX|联系)[:：\s]*([A-Za-z0-9_-]{5,}|[^\s，,。；;]{3,})/g, ' ');
  for (const note of subsidyNote.split(' / ').filter(Boolean)) {
    role = role.replace(note, ' ');
  }
  return role.replace(/\s+/g, ' ').trim().slice(0, 100);
}

function extractContact(text: string) {
  const match = text.match(/(?:车头微信|微信|wx|vx|VX|WX|联系)[:：\s]*([A-Za-z0-9_-]{5,}|[^\s，,。；;]{3,})/);
  return match?.[1]?.trim() || '';
}

function extractContent(text: string, parsed: { scriptName?: string; roleName?: string; subsidyNote?: string; leaderContact?: string }) {
  const kept: string[] = [];
  for (const rawLine of text.split('\n')) {
    let line = rawLine.trim();
    if (!line) continue;
    line = line.replace(/(?:车头微信|微信|wx|vx|VX|WX|联系)[:：\s]*([A-Za-z0-9_-]{5,}|[^\s，,。；;]{3,})/g, ' ');
    line = line.replace(/🚗/g, ' ');
    line = line.replace(/(?:^|[^\d])\d{1,2}[.月/-]\d{1,2}(?:日)?/g, ' ');
    line = line.replace(/\d{1,2}[:：]\d{2}/g, ' ');
    line = line.replace(/早场|午场|下午场|晚场|夜场|中午/g, ' ');
    if (parsed.scriptName) line = line.replace(`《${parsed.scriptName}》`, ' ').replace(parsed.scriptName, ' ');
    if (parsed.roleName) line = line.replace(parsed.roleName, ' ');
    for (const note of (parsed.subsidyNote || '').split(' / ').filter(Boolean)) {
      line = line.replace(note, ' ');
    }
    line = line.replace(/[=＝（）()【】[\]：:]/g, ' ').replace(/\s+/g, ' ').trim();
    if (line.length > 1) kept.push(line);
  }
  return Array.from(new Set(kept)).join('\n');
}

export function parseCarpoolMessage(raw: string, now = new Date()): ParsedCarpoolMessage {
  const text = normalizeText(raw);
  const date = extractDate(text, now);
  const subsidy = collectSubsidy(text);
  const scriptName = extractScriptName(text);
  const roleName = extractRole(text, subsidy.subsidyNote);
  const leaderContact = extractContact(text);
  const content = extractContent(text, { scriptName, roleName, subsidyNote: subsidy.subsidyNote, leaderContact });
  const warnings = [...(date.warnings || [])];
  if (!scriptName) warnings.push('没有识别到本名，请手动填写。');
  if (!leaderContact) warnings.push('没有识别到车头微信，请手动填写。');
  return {
    title: date.eventDate && scriptName ? `${date.eventDate} · ${scriptName}` : scriptName,
    eventDate: date.eventDate,
    startTime: extractTime(text),
    dateExpired: !!date.dateExpired,
    dateWarning: date.dateWarning,
    scriptName,
    roleName,
    roleNote: roleName,
    subsidyType: subsidy.subsidyType,
    subsidyMode: modeFromType(subsidy.subsidyType),
    subsidyAmount: subsidy.subsidyAmount,
    subsidyDiscount: subsidy.subsidyDiscount,
    subsidyNote: subsidy.subsidyNote,
    leaderContact,
    content,
    warnings,
  };
}

export function formatDetailedSubsidy(input: {
  subsidy_type?: CarpoolSubsidyType | null;
  subsidy_mode?: 'none' | 'asking' | 'offering';
  subsidy_amount?: number | null;
  subsidy_discount?: number | null;
  subsidy_note?: string | null;
}) {
  const type = input.subsidy_type || 'none';
  const note = input.subsidy_note?.trim();
  if (type === 'half_price') return note || '半价';
  if (type === 'free_ticket') return note || '免票';
  if (type === 'discount') return note || `${input.subsidy_discount || ''}折`;
  if (type === 'a_subsidy') return note || (input.subsidy_amount ? `A补 ${input.subsidy_amount}` : 'A补');
  if (type === 'fixed_deduct') return note || (input.subsidy_amount ? `减 ${input.subsidy_amount}` : '减价');
  if (type === 'custom') return note || '补贴说明';
  if (!input.subsidy_mode || input.subsidy_mode === 'none') return '无补贴';
  const label = input.subsidy_mode === 'asking' ? '想吃补' : '车头出补';
  const amount = input.subsidy_amount ? `${input.subsidy_amount} 元` : '';
  if (amount && note) return `${label} ${amount} · ${note}`;
  if (amount) return `${label} ${amount}`;
  return note ? `${label} · ${note}` : label;
}

function formatDateForMessage(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return `${month}.${day}`;
}

export function generateCarpoolMessage(input: GenerateCarpoolMessageInput) {
  const lines: string[] = [];
  const first = [`🚗${formatDateForMessage(input.eventDate)}`];
  if (input.startTime) first.push(input.startTime);
  if (input.city) first.push(input.city);
  if (input.scriptName) first.push(`《${input.scriptName}》`);
  lines.push(first.filter(Boolean).join(' '));
  if (input.roleName) lines.push(`缺/约：${input.roleName}${input.neededCount && input.neededCount > 1 ? `（${input.neededCount}人）` : ''}`);
  const subsidy = formatDetailedSubsidy({
    subsidy_type: input.subsidyType,
    subsidy_amount: input.subsidyAmount || 0,
    subsidy_discount: input.subsidyDiscount || null,
    subsidy_note: input.subsidyNote || null,
  });
  if (subsidy !== '无补贴') lines.push(`补贴：${subsidy}`);
  if (input.content?.trim()) lines.push(`说明：${input.content.trim()}`);
  if (input.deadlineDate) lines.push(`截止：${formatDateForMessage(input.deadlineDate)}${input.deadlineTime ? ` ${input.deadlineTime}` : ''}`);
  if (input.leaderContact) lines.push(`联系：${input.leaderContact}`);
  return lines.filter(Boolean).join('\n');
}
