/// <reference types="node" />
// 灵契 API — Vercel Serverless
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { createHash } from 'node:crypto';

// --- 环境变量 ---
const JWT_SECRET = process.env.JWT_SECRET || 'lingqi-dev-secret-change-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const JUZHANGGUI_TENANT_ID = process.env.JUZHANGGUI_TENANT_ID || 'f0d6e011-6e75-4c14-95e9-dc61b26871e3';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// --- 工具函数 ---
function ok(d?: unknown) { return { success: true, data: d }; }
function err(e: unknown) {
  if (e instanceof Error) return { success: false, error: e.message };
  if (typeof e === 'string') return { success: false, error: e };
  if (e && typeof e === 'object' && 'message' in (e as Record<string,unknown>)) {
    return { success: false, error: String((e as Record<string,unknown>).message) };
  }
  return { success: false, error: '服务器错误' };
}

// --- JWT 鉴权中间件 ---
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json(err(new Error('请先登录')));
  }
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { creatorId: string; role?: string };
    (req as Record<string, unknown>).creatorId = decoded.creatorId;
    (req as Record<string, unknown>).role = decoded.role || 'creator';
    next();
  } catch {
    return res.status(401).json(err(new Error('登录已过期，请重新登录')));
  }
}

function getOptionalCreatorId(req: express.Request) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { creatorId?: string };
    return decoded.creatorId || null;
  } catch {
    return null;
  }
}

function sanitizeProfile(profile: Record<string, unknown>, isOwner = false) {
  const safe = { ...profile };
  delete safe.password_hash;
  if (!isOwner) {
    delete safe.phone;
    delete safe.wechat;
    delete safe.balance;
    delete safe.contact_phone;
    delete safe.contact_wechat;
  }
  return safe;
}

function adminMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if ((req as Record<string, unknown>).role !== 'admin') {
    return res.status(403).json(err(new Error('无管理员权限')));
  }
  next();
}

function getReq<T extends string = string>(req: express.Request, key: string): T {
  return (req as Record<string, unknown>)[key] as T;
}

function sanitizeUploadScope(scope: unknown) {
  const raw = typeof scope === 'string' ? scope.trim() : '';
  if (!raw) return 'general';
  const safe = raw.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 40);
  return safe || 'general';
}

function safeFileExt(filename: string, mimetype: string) {
  const raw = filename.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  if (raw) return raw.slice(0, 12);
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.includes('png')) return 'png';
  if (mimetype.includes('webp')) return 'webp';
  if (mimetype.includes('jpeg') || mimetype.includes('jpg')) return 'jpg';
  return 'bin';
}

function makeSocialSnapshots(socialLinks: Record<string, string> | null | undefined) {
  const links = socialLinks || {};
  const entries = Object.entries(links).filter(([, url]) => typeof url === 'string' && url.trim());
  return entries.reduce<Record<string, { url: string; platform: string; title: string; description: string; captured_at: string }>>((acc, [key, url]) => {
    const platform = key === 'douyin' ? '抖音' : key === 'xiaohongshu' ? '小红书' : '社交主页';
    acc[key] = {
      url: url.trim(),
      platform,
      title: `${platform}主页`,
      description: '已添加到灵契主页，后续可接入真实网页快照服务。',
      captured_at: new Date().toISOString(),
    };
    return acc;
  }, {});
}

async function getAuthedProfile(req: express.Request) {
  const creatorId = getReq(req, 'creatorId');
  const { data } = await supabase.from('lc_profiles')
    .select('id, display_name, is_realname, balance')
    .eq('id', creatorId)
    .single();
  return data;
}

type RelatedProofFile = { name: string; url: string; type?: string };
type SubsidyMode = 'none' | 'asking' | 'offering';
type CarpoolSubsidyType = 'none' | 'half_price' | 'free_ticket' | 'discount' | 'a_subsidy' | 'fixed_deduct' | 'custom';
const CARPOOL_SUBSIDY_TYPES: CarpoolSubsidyType[] = ['none', 'half_price', 'free_ticket', 'discount', 'a_subsidy', 'fixed_deduct', 'custom'];
type ReportTargetType = 'carpool' | 'ranking' | 'comment' | 'commission' | 'profile';
const REPORT_TARGET_TYPES: ReportTargetType[] = ['carpool', 'ranking', 'comment', 'commission', 'profile'];

function sanitizeRelatedFiles(input: unknown): RelatedProofFile[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 4).map((file) => {
    const item = file as Record<string, unknown>;
    const name = typeof item.name === 'string' ? item.name.trim().slice(0, 120) : '认证图片';
    const url = typeof item.url === 'string' ? item.url.trim() : '';
    const type = typeof item.type === 'string' ? item.type.trim().slice(0, 80) : undefined;
    return { name: name || '认证图片', url, type };
  }).filter((file) => {
    if (!file.url || file.url.length > 6 * 1024 * 1024) return false;
    if (!file.url.startsWith('data:image/')) return false;
    return true;
  });
}

function getErrorText(e: unknown) {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const item = e as Record<string, unknown>;
    return [item.message, item.details, item.hint, item.code].filter(Boolean).join(' ');
  }
  return '';
}

function isRelatedProofSchemaMiss(e: unknown) {
  const text = getErrorText(e);
  return text.includes('schema cache') && (text.includes('related_note') || text.includes('related_files'));
}

function isMissingRelation(e: unknown, relation: string) {
  return getErrorText(e).includes(relation);
}

function encodeRelatedProofFallback(note: string, files: RelatedProofFile[]) {
  return JSON.stringify({
    kind: 'related_party_certification',
    related_note: note,
    related_files: files,
  });
}

function cleanText(value: unknown, max = 1200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

type AuditTargetType = 'ranking' | 'comment' | 'commission' | 'carpool';

function normalizeAuditValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => normalizeAuditValue(item));
  const record = value as Record<string, unknown>;
  return Object.keys(record).sort().reduce<Record<string, unknown>>((acc, key) => {
    const normalized = normalizeAuditValue(record[key]);
    if (normalized !== undefined) acc[key] = normalized;
    return acc;
  }, {});
}

function stableJson(value: unknown) {
  return JSON.stringify(normalizeAuditValue(value));
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function hashLooseValue(value: unknown) {
  const text = typeof value === 'string' ? value : stableJson(value);
  return sha256(text || '');
}

function summarizeAuditFiles(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((file, index) => {
    const item = file as Record<string, unknown>;
    const url = typeof item.url === 'string' ? item.url : '';
    return {
      index,
      name: cleanText(item.name, 120) || 'file',
      type: cleanText(item.type, 80) || null,
      size: url.length,
      url_hash: url ? hashLooseValue(url) : null,
    };
  });
}

function auditPayload(targetType: AuditTargetType, row: Record<string, unknown>) {
  if (targetType === 'ranking') {
    return {
      id: row.id,
      type: row.type,
      subject_name: row.subject_name,
      subject_type: row.subject_type,
      subject_city: row.subject_city,
      subject_url: row.subject_url,
      content: row.content,
      author_name: row.author_name,
      is_realname: row.is_realname,
      initial_amount: row.initial_amount,
      likes: row.likes,
      dislikes: row.dislikes,
      joys: row.joys,
      status: row.status,
      files: summarizeAuditFiles(row.files),
      expires_at: row.expires_at,
      created_at: row.created_at,
    };
  }
  if (targetType === 'comment') {
    return {
      id: row.id,
      ranking_id: row.ranking_id,
      content: row.content,
      author_name: row.author_name,
      is_realname: row.is_realname,
      status: row.status,
      is_pinned: row.is_pinned,
      pin_label: row.pin_label,
      related_note: row.related_note,
      related_files: summarizeAuditFiles(row.related_files),
      created_at: row.created_at,
    };
  }
  if (targetType === 'commission') {
    return {
      id: row.id,
      poster_name: row.poster_name,
      poster_is_realname: row.poster_is_realname,
      title: row.title,
      content: row.content,
      desired_role: row.desired_role,
      target_type: row.target_type,
      needed_date: row.needed_date,
      city: row.city,
      location: row.location,
      budget: row.budget,
      status: row.status,
      created_at: row.created_at,
    };
  }
  return {
    id: row.id,
    poster_name: row.poster_name,
    poster_is_realname: row.poster_is_realname,
    title: row.title,
    city: row.city,
    event_date: row.event_date,
    start_time: row.start_time,
    deadline_date: row.deadline_date,
    deadline_time: row.deadline_time,
    script_name: row.script_name,
    role_name: row.role_name,
    subsidy_mode: row.subsidy_mode,
    subsidy_amount: row.subsidy_amount,
    needed_count: row.needed_count,
    store_name: row.store_name,
    store_city: row.store_city,
    content: row.content,
    boost_amount: row.boost_amount,
    status: row.status,
    juzhanggui_sync_status: row.juzhanggui_sync_status,
    juzhanggui_schedule_id: row.juzhanggui_schedule_id,
    created_at: row.created_at,
  };
}

async function refreshAuditDailyRoot(chainDate: string) {
  const { data: entries, error } = await supabase.from('lc_audit_chain_entries')
    .select('entry_hash')
    .eq('chain_date', chainDate)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  const hashes = (entries || []).map((entry: { entry_hash: string }) => entry.entry_hash);
  if (hashes.length === 0) return null;
  const rootHash = sha256(stableJson({ version: 'lc-audit-root-v1', chainDate, hashes }));
  const firstHash = hashes[0];
  const lastHash = hashes[hashes.length - 1];
  const { error: upsertErr } = await supabase.from('lc_audit_daily_roots').upsert({
    audit_date: chainDate,
    root_hash: rootHash,
    entry_count: hashes.length,
    first_entry_hash: firstHash,
    last_entry_hash: lastHash,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'audit_date' });
  if (upsertErr) throw upsertErr;
  return { rootHash, entryCount: hashes.length, firstHash, lastHash };
}

async function appendAuditEntry(args: {
  targetType: AuditTargetType;
  targetId: string;
  eventType: string;
  payload: unknown;
  actorId?: string | null;
  actorRole?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const createdAt = new Date().toISOString();
    const chainDate = createdAt.slice(0, 10);
    const canonicalPayload = normalizeAuditValue(args.payload);
    const contentHash = sha256(stableJson(canonicalPayload));
    const { data: latest, error: latestErr } = await supabase.from('lc_audit_chain_entries')
      .select('entry_hash')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestErr) throw latestErr;
    const previousHash = latest?.entry_hash || null;
    const actorRole = args.actorRole || 'system';
    const entryBase = {
      version: 'lc-audit-entry-v1',
      target_type: args.targetType,
      target_id: args.targetId,
      event_type: args.eventType,
      content_hash: contentHash,
      previous_hash: previousHash,
      canonical_payload: canonicalPayload,
      actor_id: args.actorId || null,
      actor_role: actorRole,
      created_at: createdAt,
    };
    const entryHash = sha256(stableJson(entryBase));
    const { data, error: insertErr } = await supabase.from('lc_audit_chain_entries').insert({
      target_type: args.targetType,
      target_id: args.targetId,
      event_type: args.eventType,
      content_hash: contentHash,
      previous_hash: previousHash,
      entry_hash: entryHash,
      canonical_payload: canonicalPayload,
      actor_id: args.actorId || null,
      actor_role: actorRole,
      metadata: args.metadata || {},
      chain_date: chainDate,
      created_at: createdAt,
    }).select('id, entry_hash, content_hash, chain_date, created_at').single();
    if (insertErr) throw insertErr;
    await refreshAuditDailyRoot(chainDate);
    return data;
  } catch (auditErr) {
    console.error('[audit-chain] append failed', getErrorText(auditErr));
    return null;
  }
}

async function auditApprovedTarget(
  targetType: AuditTargetType,
  row: Record<string, unknown> | null | undefined,
  eventType: string,
  actorId: string | null,
  metadata?: Record<string, unknown>
) {
  if (!row?.id) return null;
  return appendAuditEntry({
    targetType,
    targetId: String(row.id),
    eventType,
    payload: auditPayload(targetType, row),
    actorId,
    actorRole: 'admin',
    metadata,
  });
}

const RANKING_EDIT_LABELS: Record<string, string> = {
  type: '榜单类型',
  subject_name: '对象名称',
  subject_type: '对象分类',
  subject_city: '所在城市',
  subject_url: '社交主页',
  content: '正文内容',
  expires_at: '黑榜到期时间',
};

const RANKING_SUBJECT_TYPES = ['creator', 'dm', 'store', 'player'];

function auditComparable(value: unknown) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  return value;
}

function auditValuesEqual(a: unknown, b: unknown) {
  return stableJson(auditComparable(a)) === stableJson(auditComparable(b));
}

function buildRankingChanges(before: Record<string, unknown>, after: Record<string, unknown>, fields: string[]) {
  return fields
    .filter(field => !auditValuesEqual(before[field], after[field]))
    .map(field => ({
      field,
      label: RANKING_EDIT_LABELS[field] || field,
      before: before[field] ?? null,
      after: after[field] ?? null,
    }));
}

type PublicAuditProof = {
  event_type: string;
  entry_hash: string;
  content_hash: string;
  chain_date: string;
  created_at: string;
};

async function attachAuditProof<T extends Record<string, unknown>>(targetType: AuditTargetType, rows: T[]) {
  if (rows.length === 0) return rows;
  try {
    const ids = rows.map(row => String(row.id)).filter(Boolean);
    const { data, error } = await supabase.from('lc_audit_chain_entries')
      .select('target_id, event_type, entry_hash, content_hash, chain_date, created_at')
      .eq('target_type', targetType)
      .in('target_id', ids)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const proofById = new Map<string, PublicAuditProof>();
    (data || []).forEach((entry: PublicAuditProof & { target_id: string }) => {
      if (!proofById.has(entry.target_id)) {
        proofById.set(entry.target_id, {
          event_type: entry.event_type,
          entry_hash: entry.entry_hash,
          content_hash: entry.content_hash,
          chain_date: entry.chain_date,
          created_at: entry.created_at,
        });
      }
    });
    return rows.map(row => ({ ...row, audit_proof: proofById.get(String(row.id)) || null }));
  } catch (auditErr) {
    console.error('[audit-chain] attach proof failed', getErrorText(auditErr));
    return rows.map(row => ({ ...row, audit_proof: null }));
  }
}

async function backfillAuditTargets(targetType: AuditTargetType, table: string, limit: number) {
  const { data: existing, error: auditErr } = await supabase.from('lc_audit_chain_entries')
    .select('target_id')
    .eq('target_type', targetType)
    .limit(10000);
  if (auditErr) throw auditErr;
  const audited = new Set((existing || []).map((entry: { target_id: string }) => entry.target_id));
  const { data, error } = await supabase.from(table)
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  let created = 0;
  for (const row of (data || []) as Record<string, unknown>[]) {
    if (!row.id || audited.has(String(row.id))) continue;
    const result = await auditApprovedTarget(targetType, row, 'legacy_approved_snapshot', 'admin', { source: 'admin_backfill' });
    if (result) created += 1;
  }
  return { scanned: data?.length || 0, created };
}

function parseCoinAmount(value: unknown, fallback = 0) {
  const amount = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(amount) ? Math.max(0, amount) : fallback;
}

function normalizeClockTime(value: unknown, fallback = '19:30') {
  const text = cleanText(value, 20);
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function addHoursToClock(time: string, hours: number) {
  const [h, m] = time.split(':').map(Number);
  const total = ((h || 0) * 60 + (m || 0) + hours * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatCarpoolSubsidy(carpool: Record<string, unknown>) {
  const subsidyType = cleanText(carpool.subsidy_type, 40) as CarpoolSubsidyType;
  const note = cleanText(carpool.subsidy_note, 300);
  if (subsidyType === 'half_price') return note || '半价';
  if (subsidyType === 'free_ticket') return note || '免票';
  if (subsidyType === 'discount') return note || `${Number(carpool.subsidy_discount || 0) || ''}折`;
  if (subsidyType === 'a_subsidy') return note || (Number(carpool.subsidy_amount || 0) > 0 ? `A补 ${Number(carpool.subsidy_amount || 0)}` : 'A补');
  if (subsidyType === 'fixed_deduct') return note || (Number(carpool.subsidy_amount || 0) > 0 ? `减 ${Number(carpool.subsidy_amount || 0)}` : '减价');
  if (subsidyType === 'custom') return note || '补贴说明';
  if (carpool.subsidy_mode === 'none') return '无补贴';
  const label = carpool.subsidy_mode === 'asking' ? '想吃补' : '车头出补';
  const amount = Number(carpool.subsidy_amount || 0);
  const amountText = amount > 0 ? `${amount} 元` : '';
  if (amountText && note) return `${label} ${amountText} · ${note}`;
  if (amountText) return `${label} ${amountText}`;
  if (note) return `${label} · ${note}`;
  return label;
}

function buildJuzhangguiScheduleNote(carpool: Record<string, unknown>) {
  const lines = [
    `来源：灵契拼车区`,
    `拼车ID：${carpool.id}`,
    `标题：${carpool.title || ''}`,
    `城市：${carpool.city || ''}`,
    `角色：${carpool.role_name || '未指定'}`,
    `截止：${carpool.deadline_date || '未填'}${carpool.deadline_time ? ` ${carpool.deadline_time}` : ''}`,
    `车头联系方式：${carpool.leader_contact || '未填'}`,
    `补贴：${formatCarpoolSubsidy(carpool)}`,
    `说明：${carpool.content || ''}`,
  ];
  return lines.join('\n').slice(0, 1800);
}

async function syncCarpoolToJuzhanggui(carpool: Record<string, unknown>) {
  if (carpool.juzhanggui_schedule_id) {
    return { ok: true, scheduleId: String(carpool.juzhanggui_schedule_id), reused: true };
  }

  const scriptName = cleanText(carpool.script_name, 100);
  if (!scriptName) throw new Error('缺少剧本名，无法同步剧司辰');

  const { data: existingScript, error: scriptQueryErr } = await supabase.from('scripts')
    .select('id')
    .eq('tenant_id', JUZHANGGUI_TENANT_ID)
    .eq('name', scriptName)
    .maybeSingle();
  if (scriptQueryErr) throw scriptQueryErr;

  let scriptId = existingScript?.id;
  if (!scriptId) {
    const { data: script, error: scriptErr } = await supabase.from('scripts').insert({
      name: scriptName,
      duration_minutes: 240,
      min_duration_hours: 4,
      max_duration_hours: 4,
      tenant_id: JUZHANGGUI_TENANT_ID,
    }).select('id').single();
    if (scriptErr) throw scriptErr;
    scriptId = script?.id;
  }

  const roleName = cleanText(carpool.role_name, 80);
  if (scriptId && roleName) {
    const { data: existingRole } = await supabase.from('script_player_roles')
      .select('id')
      .eq('script_id', scriptId)
      .eq('role_name', roleName)
      .maybeSingle();
    if (!existingRole) {
      await supabase.from('script_player_roles').insert({ script_id: scriptId, role_name: roleName, gender: '' });
    }
  }

  const roomName = cleanText(carpool.store_name, 100) || `灵契拼车-${cleanText(carpool.city, 40) || '待定城市'}`;
  const { data: existingRoom, error: roomQueryErr } = await supabase.from('rooms')
    .select('id')
    .eq('tenant_id', JUZHANGGUI_TENANT_ID)
    .eq('name', roomName)
    .maybeSingle();
  if (roomQueryErr) throw roomQueryErr;

  let roomId = existingRoom?.id;
  if (!roomId) {
    const { data: room, error: roomErr } = await supabase.from('rooms').insert({
      name: roomName,
      capacity: Number(carpool.needed_count || 0) || 0,
      tenant_id: JUZHANGGUI_TENANT_ID,
      status: 'active',
    }).select('id').single();
    if (roomErr) throw roomErr;
    roomId = room?.id;
  }

  const startTime = normalizeClockTime(carpool.start_time, '19:30');
  const endTime = addHoursToClock(startTime, 4);
  const { data: schedule, error: scheduleErr } = await supabase.from('schedules').insert({
    script_id: scriptId,
    room_id: roomId || null,
    scheduled_date: carpool.event_date,
    start_time: startTime,
    end_time: endTime,
    status: 'pending',
    player_count: Number(carpool.needed_count || 0) || 0,
    customer_name: `灵契拼车 · ${cleanText(carpool.poster_name, 40) || '车头'}`,
    note: buildJuzhangguiScheduleNote(carpool),
    tenant_id: JUZHANGGUI_TENANT_ID,
  }).select('id').single();
  if (scheduleErr) throw scheduleErr;

  return { ok: true, scheduleId: schedule?.id || null, reused: false };
}

function todayChinaDateString() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function buildDateString(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseAvailabilityDatesFromText(text: string) {
  const today = todayChinaDateString();
  const year = Number(today.slice(0, 4));
  const found = new Set<string>();
  const expired = new Set<string>();
  const addDate = (date: string) => {
    if (!date) return;
    if (date < today) expired.add(date);
    else found.add(date);
  };

  const fullDateRe = /(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/g;
  let fullMatch: RegExpExecArray | null;
  while ((fullMatch = fullDateRe.exec(text)) !== null) {
    addDate(buildDateString(Number(fullMatch[1]), Number(fullMatch[2]), Number(fullMatch[3])));
  }

  const shortDateRe = /(?:^|[^\d])(\d{1,2})[./月](\d{1,2})(?:日)?(?!\d)/g;
  let shortMatch: RegExpExecArray | null;
  while ((shortMatch = shortDateRe.exec(text)) !== null) {
    addDate(buildDateString(year, Number(shortMatch[1]), Number(shortMatch[2])));
  }

  return { dates: [...found].sort(), expiredDates: [...expired].sort() };
}

async function upsertAvailabilityBySource(row: {
  creator_id: string;
  date: string;
  start_time: string;
  end_time: string;
  city?: string | null;
  location?: string | null;
  note?: string | null;
  is_booked: boolean;
  source: string;
  source_id: string;
  source_payload?: Record<string, unknown>;
}) {
  const payload = {
    creator_id: row.creator_id,
    date: row.date,
    start_time: row.start_time,
    end_time: row.end_time,
    city: row.city || null,
    location: row.location || null,
    note: row.note || null,
    is_booked: row.is_booked,
    source: row.source,
    source_id: row.source_id,
    source_payload: row.source_payload || {},
  };

  const { data: existing, error: findErr } = await supabase.from('lc_availability')
    .select('id')
    .eq('creator_id', row.creator_id)
    .eq('source', row.source)
    .eq('source_id', row.source_id)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing?.id) {
    const { data, error } = await supabase.from('lc_availability')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from('lc_availability')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

type RankingVoteType = 'like' | 'dislike' | 'joy';
type RankingVoteRow = {
  id: string;
  ranking_id?: string;
  vote_type: RankingVoteType;
  created_at: string;
};
type PinnedCommentRow = {
  id: string;
  ranking_id: string;
  content: string;
  author_id?: string | null;
  author_name: string;
  is_realname: boolean;
  is_pinned: boolean;
  pin_label?: string | null;
  likes: number;
  created_at: string;
};
type RankingVoteRpcResult = {
  likes: number;
  dislikes: number;
  joys: number;
  balance: number;
  balance_delta?: number;
  refunded?: number;
  vote_id?: string;
  vote_type?: RankingVoteType;
  vote_created_at?: string;
  is_duplicate?: boolean;
};

const VOTE_CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

function voteRefundAmount(voteType: RankingVoteType) {
  return voteType === 'joy' ? 0 : 1;
}

function serializeMyVote(vote: RankingVoteRow) {
  const createdAt = new Date(vote.created_at).getTime();
  const cancelDeadlineMs = createdAt + VOTE_CANCEL_WINDOW_MS;
  const canCancel = Number.isFinite(createdAt) && Date.now() <= cancelDeadlineMs;
  return {
    id: vote.id,
    vote_type: vote.vote_type,
    created_at: vote.created_at,
    cancel_deadline: new Date(cancelDeadlineMs).toISOString(),
    can_cancel: canCancel,
    refund_amount: canCancel ? voteRefundAmount(vote.vote_type) : 0,
  };
}

function firstRpcRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function rankingVoteRpcStatus(message: string) {
  if (message.includes('契约币不足')) return 402;
  if (message.includes('不存在') || message.includes('未上线') || message.includes('还没有')) return 404;
  if (message.includes('无效') || message.includes('超过24小时')) return 400;
  return 500;
}

// --- 健康检查 ---
app.get('/api/health', (_req, res) => res.json(ok({ status: '灵契 running' })));

// ==================== 创作者认证 ====================

app.post('/api/lc/auth', async (req, res) => {
  try {
    const { phone, password, displayName } = req.body;
    const profileRole = 'player';
    if (!phone || !password) {
      return res.status(400).json(err(new Error('请填写手机号和密码')));
    }

    const { data: existing } = await supabase.from('lc_profiles').select('*').eq('phone', phone).maybeSingle();

    if (existing) {
      if (!existing.password_hash) {
        return res.status(409).json(err(new Error('该手机号已注册')));
      }
      const valid = await bcrypt.compare(password, existing.password_hash);
      if (!valid) return res.status(401).json(err(new Error('密码错误')));

      if (displayName) {
        await supabase.from('lc_profiles').update({ display_name: displayName }).eq('id', existing.id);
      }

      const token = jwt.sign({ creatorId: existing.id, role: 'creator' }, JWT_SECRET, { expiresIn: '7d' });
      const isShop = existing.role === 'shop';
      return res.json(ok({
        id: existing.id, display_name: displayName || existing.display_name, phone: existing.phone,
        role: existing.role, token,
        ...(isShop ? { juzhanggui_link: 'https://jusichen.com' } : {}),
      }));
    }

    // 注册
    const passwordHash = await bcrypt.hash(password, 10);
    const insertData: Record<string, unknown> = {
      phone, display_name: displayName || '用户', role: profileRole,
      password_hash: passwordHash, is_visible: true, balance: 30,
    };
    const { data: profile } = await supabase.from('lc_profiles')
      .insert(insertData)
      .select().single();

    if (!profile) return res.status(500).json(err(new Error('注册失败')));

    await supabase.from('lc_transactions').insert({
      profile_id: profile.id,
      type: 'recharge',
      amount: 30,
      description: '新用户注册赠送 30 契约币',
      status: 'approved',
    });

    const token = jwt.sign({ creatorId: profile.id, role: 'creator' }, JWT_SECRET, { expiresIn: '7d' });
    res.json(ok({
      id: profile.id, display_name: profile.display_name, phone: profile.phone, role: profile.role, token,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/me', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabase.from('lc_profiles').select('id, display_name, is_realname, city').eq('id', getReq(req, 'creatorId')).single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/profile/:id/realname', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { value } = req.body;
    await supabase.from('lc_profiles').update({ is_realname: !!value }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 创作者列表（分页） ====================

app.get('/api/lc/creators', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const { data, count } = await supabase
      .from('lc_profiles')
      .select('*', { count: 'exact' })
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    res.json(ok({
      items: (data || []).map(profile => sanitizeProfile(profile)),
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 单个创作者详情 ====================

app.get('/api/lc/creators/:id', async (req, res) => {
  try {
    const { data: profile } = await supabase.from('lc_profiles').select('*').eq('id', req.params.id).single();
    if (!profile) return res.status(404).json(err(new Error('创作者不存在')));
    const viewerId = getOptionalCreatorId(req);
    const profilePayload = sanitizeProfile(profile, viewerId === profile.id);

    const [{ data: services }, { data: portfolio }, { data: pendingCerts }] = await Promise.all([
      supabase.from('lc_services').select('*').eq('creator_id', req.params.id).eq('is_active', true),
      supabase.from('lc_portfolio').select('*').eq('creator_id', req.params.id).order('created_at', { ascending: false }),
      supabase.from('lc_certifications').select('type, status').eq('profile_id', req.params.id).eq('status', 'pending'),
    ]);

    const hasPendingShopCert = (pendingCerts || []).some((c: { type: string }) => c.type === 'shop');
    const hasPendingDmCert = (pendingCerts || []).some((c: { type: string }) => c.type === 'dm');

    res.json(ok({
      ...profilePayload,
      services: services || [],
      portfolio: portfolio || [],
      has_pending_shop_cert: hasPendingShopCert,
      has_pending_dm_cert: hasPendingDmCert,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 更新创作者资料（需登录） ====================

app.put('/api/lc/creators/:id', authMiddleware, async (req, res) => {
  try {
    if (getReq(req, 'creatorId') !== req.params.id) {
      return res.status(403).json(err(new Error('只能修改自己的资料')));
    }
    const {
      display_name, avatar, bio, tags, city, social_links, wechat,
      available_cities, travel_status, contact_unlock_enabled, contact_intent_amount,
    } = req.body;
    const socialSnapshots = makeSocialSnapshots(social_links);

    await supabase.from('lc_profiles').update({
      display_name, avatar, bio, tags, city, social_links, wechat,
      available_cities: Array.isArray(available_cities) ? available_cities : [],
      travel_status: travel_status || '常驻本地',
      contact_unlock_enabled: !!contact_unlock_enabled,
      contact_intent_amount: Math.max(0, parseInt(contact_intent_amount || 0) || 0),
      social_snapshots: socialSnapshots,
      updated_at: new Date().toISOString(),
    }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 档期管理（需登录） ====================

app.get('/api/lc/creators/:id/availability', async (req, res) => {
  try {
    const { data } = await supabase.from('lc_availability').select('*')
      .eq('creator_id', req.params.id)
      .gte('date', todayChinaDateString()).order('date');
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/availability', authMiddleware, async (req, res) => {
  try {
    const { creatorId, date, startTime, endTime, note, city, location } = req.body;
    if (getReq(req, 'creatorId') !== creatorId) {
      return res.status(403).json(err(new Error('只能管理自己的档期')));
    }
    const { data } = await supabase.from('lc_availability').insert({
      creator_id: creatorId, date, start_time: startTime, end_time: endTime, note,
      city: city || null, location: location || null,
      is_booked: false, source: 'manual',
    }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/availability/sync-juzhanggui', authMiddleware, async (req, res) => {
  try {
    const creatorId = getReq(req, 'creatorId');
    const { data: profile, error: profileErr } = await supabase.from('lc_profiles')
      .select('id, phone, display_name, city')
      .eq('id', creatorId)
      .single();
    if (profileErr) throw profileErr;
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));

    const phone = cleanText(profile.phone, 40);
    const displayName = cleanText(profile.display_name, 120);
    let actor: Record<string, unknown> | null = null;

    if (phone) {
      const { data: actorByPhone, error: phoneErr } = await supabase.from('actors')
        .select('id, name, phone')
        .eq('tenant_id', JUZHANGGUI_TENANT_ID)
        .eq('phone', phone)
        .maybeSingle();
      if (phoneErr) throw phoneErr;
      actor = actorByPhone;
    }

    if (!actor && displayName) {
      const { data: actorByName, error: nameErr } = await supabase.from('actors')
        .select('id, name, phone')
        .eq('tenant_id', JUZHANGGUI_TENANT_ID)
        .eq('name', displayName)
        .maybeSingle();
      if (nameErr) throw nameErr;
      actor = actorByName;
    }

    if (!actor?.id) {
      return res.json(ok({
        matched: false,
        imported: 0,
        updated: [],
        message: '没有在剧司辰卡司表里找到同手机号或同昵称的卡司。请先在剧司辰卡司档案里补齐手机号，或把卡司名改成灵契昵称。',
      }));
    }

    const today = todayChinaDateString();
    const { data: rows, error: schedErr } = await supabase.from('schedule_actors')
      .select('id,role_name,start_time,end_time,schedules!inner(id,tenant_id,scheduled_date,start_time,end_time,status,customer_name,scripts(name),rooms(name))')
      .eq('actor_id', String(actor.id))
      .eq('schedules.tenant_id', JUZHANGGUI_TENANT_ID)
      .gte('schedules.scheduled_date', today)
      .not('schedules.status', 'eq', 'cancelled');
    if (schedErr) throw schedErr;

    const imported = [];
    for (const row of (rows || []) as Array<Record<string, unknown>>) {
      const schedule = Array.isArray(row.schedules) ? row.schedules[0] : row.schedules as Record<string, unknown> | undefined;
      if (!schedule?.id || !schedule.scheduled_date) continue;
      const script = Array.isArray(schedule.scripts) ? schedule.scripts[0] : schedule.scripts as Record<string, unknown> | undefined;
      const room = Array.isArray(schedule.rooms) ? schedule.rooms[0] : schedule.rooms as Record<string, unknown> | undefined;
      const scriptName = cleanText(script?.name, 120) || '未命名剧本';
      const roleName = cleanText(row.role_name, 80) || '卡司';
      const roomName = cleanText(room?.name, 120);
      const date = cleanText(schedule.scheduled_date, 20);
      const startTime = normalizeClockTime(row.start_time || schedule.start_time, '09:00');
      const endTime = normalizeClockTime(row.end_time || schedule.end_time, addHoursToClock(startTime, 4));
      const sourceId = `juzhanggui:${schedule.id}:${row.id}`;
      const item = await upsertAvailabilityBySource({
        creator_id: creatorId,
        date,
        start_time: startTime,
        end_time: endTime,
        city: cleanText(profile.city, 80) || null,
        location: roomName || null,
        note: `剧司辰同步：${scriptName} · ${roleName}`,
        is_booked: true,
        source: 'juzhanggui',
        source_id: sourceId,
        source_payload: {
          actor_id: actor.id,
          actor_name: actor.name,
          schedule_id: schedule.id,
          schedule_actor_id: row.id,
          script_name: scriptName,
          room_name: roomName || null,
          status: schedule.status || null,
        },
      });
      imported.push(item);
    }

    res.json(ok({ matched: true, actor, imported: imported.length, items: imported }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/availability/import-text', authMiddleware, async (req, res) => {
  try {
    const creatorId = getReq(req, 'creatorId');
    const rawText = cleanText(req.body?.rawText, 6000);
    const screenshotUrl = cleanText(req.body?.screenshotUrl, 1000);
    const city = cleanText(req.body?.city, 80);
    const location = cleanText(req.body?.location, 120);
    if (!rawText) return res.status(400).json(err(new Error('请粘贴截图中的文字，第一版暂不做纯图片 OCR')));

    const { dates, expiredDates } = parseAvailabilityDatesFromText(rawText);
    if (dates.length === 0) {
      return res.json(ok({
        imported: 0,
        dates: [],
        expiredDates,
        message: expiredDates.length > 0 ? '截图里识别到的日期都已经过期，没有自动导入。' : '没有识别到日期，请用 6.11、6月11日 或 2026-06-11 这种格式。',
      }));
    }

    const rawHash = hashLooseValue(`${creatorId}:${rawText}:${screenshotUrl}`).slice(0, 16);
    const imported = [];
    for (const date of dates) {
      const item = await upsertAvailabilityBySource({
        creator_id: creatorId,
        date,
        start_time: normalizeClockTime(req.body?.startTime, '09:00'),
        end_time: normalizeClockTime(req.body?.endTime, '22:00'),
        city: city || null,
        location: location || null,
        note: '截图快速导入',
        is_booked: false,
        source: 'screenshot',
        source_id: `screenshot:${rawHash}:${date}`,
        source_payload: { raw_text: rawText, screenshot_url: screenshotUrl || null },
      });
      imported.push(item);
    }

    res.json(ok({ imported: imported.length, items: imported, dates, expiredDates }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.delete('/api/lc/availability/:id', authMiddleware, async (req, res) => {
  try {
    const { data: item } = await supabase.from('lc_availability').select('creator_id,is_booked,source').eq('id', req.params.id).single();
    if (!item) return res.status(404).json(err(new Error('档期不存在')));
    if (getReq(req, 'creatorId') !== item.creator_id) {
      return res.status(403).json(err(new Error('只能删除自己的档期')));
    }
    if (item.is_booked || item.source === 'juzhanggui') {
      return res.status(400).json(err(new Error('剧司辰同步的忙碌档期请在剧司辰修改后重新同步')));
    }
    await supabase.from('lc_availability').delete().eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 服务管理（需登录） ====================

app.post('/api/lc/services', authMiddleware, async (req, res) => {
  try {
    const { creatorId, serviceType, price, duration, description } = req.body;
    if (getReq(req, 'creatorId') !== creatorId) {
      return res.status(403).json(err(new Error('只能管理自己的服务')));
    }
    const { data } = await supabase.from('lc_services').insert({
      creator_id: creatorId, service_type: serviceType, price: parseFloat(price), duration, description,
    }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.delete('/api/lc/services/:id', authMiddleware, async (req, res) => {
  try {
    const { data: item } = await supabase.from('lc_services').select('creator_id').eq('id', req.params.id).single();
    if (!item) return res.status(404).json(err(new Error('服务不存在')));
    if (getReq(req, 'creatorId') !== item.creator_id) {
      return res.status(403).json(err(new Error('只能删除自己的服务')));
    }
    await supabase.from('lc_services').delete().eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 作品管理（需登录） ====================

app.post('/api/lc/portfolio', authMiddleware, async (req, res) => {
  try {
    const { creatorId, imageUrl, caption } = req.body;
    if (getReq(req, 'creatorId') !== creatorId) {
      return res.status(403).json(err(new Error('只能管理自己的作品')));
    }
    const { data } = await supabase.from('lc_portfolio').insert({
      creator_id: creatorId, image_url: imageUrl, caption,
    }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.delete('/api/lc/portfolio/:id', authMiddleware, async (req, res) => {
  try {
    const { data: item } = await supabase.from('lc_portfolio').select('creator_id').eq('id', req.params.id).single();
    if (!item) return res.status(404).json(err(new Error('作品不存在')));
    if (getReq(req, 'creatorId') !== item.creator_id) {
      return res.status(403).json(err(new Error('只能删除自己的作品')));
    }
    await supabase.from('lc_portfolio').delete().eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 本地上传（需登录） ====================

app.post('/api/lc/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json(err(new Error('请选择文件')));

    const ext = safeFileExt(file.originalname, file.mimetype);
    const scope = sanitizeUploadScope(req.body?.scope);
    const digest = createHash('sha256').update(file.buffer).digest('hex').slice(0, 16);
    const path = `${getReq(req, 'creatorId')}/${scope}/${Date.now()}-${digest}.${ext}`;

    const { error } = await supabase.storage.from('lc-portfolio').upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from('lc-portfolio').getPublicUrl(path);
    res.json(ok({ url: urlData.publicUrl, path, name: file.originalname, type: file.mimetype, size: file.size }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 联系申请 ====================

app.post('/api/lc/contact-request', async (req, res) => {
  try {
    const { creatorId, requesterName, requesterWechat, message, intentAmount, paymentProof } = req.body;
    if (!creatorId || !requesterName || !requesterWechat) {
      return res.status(400).json(err(new Error('缺少必填信息')));
    }
    const { data } = await supabase.from('lc_contact_requests').insert({
      creator_id: creatorId, requester_name: requesterName, requester_wechat: requesterWechat, requester_message: message || null,
      intent_amount: Math.max(0, parseInt(intentAmount || 0) || 0),
      payment_proof: paymentProof || null,
    }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 委托需求墙 ====================

app.get('/api/lc/commissions', async (req, res) => {
  try {
    const city = req.query.city as string;
    const targetType = req.query.targetType as string;
    let query = supabase.from('lc_commissions')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (city && city !== 'all') query = query.eq('city', city);
    if (targetType && targetType !== 'all') query = query.eq('target_type', targetType);
    const { data, error: qErr } = await query;
    if (qErr) throw qErr;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/commissions/mine', authMiddleware, async (req, res) => {
  try {
    const posterId = getReq(req, 'creatorId');
    const { data, error: qErr } = await supabase.from('lc_commissions')
      .select('*')
      .eq('poster_id', posterId)
      .order('created_at', { ascending: false });
    if (qErr) throw qErr;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/commissions', authMiddleware, async (req, res) => {
  try {
    const {
      title, content, desiredRole, targetType, neededDate,
      city, location, budget, contactNote, aiAssistContext,
    } = req.body;
    if (!title || !content) return res.status(400).json(err(new Error('请填写标题和需求内容')));

    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));

    const { data, error: insErr } = await supabase.from('lc_commissions').insert({
      poster_id: profile.id,
      poster_name: profile.display_name,
      poster_is_realname: !!profile.is_realname,
      title,
      content,
      desired_role: desiredRole || null,
      target_type: targetType || null,
      needed_date: neededDate || null,
      city: city || null,
      location: location || null,
      budget: budget || null,
      contact_note: contactNote || null,
      ai_assist_context: aiAssistContext || {},
    }).select().single();
    if (insErr) throw insErr;

    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/commissions/:id/close', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: commission, error: cErr } = await supabase.from('lc_commissions')
      .select('id, poster_id, status')
      .eq('id', req.params.id)
      .single();
    if (cErr && isMissingRelation(cErr, 'lc_commissions')) return res.status(503).json(err(new Error('委托需求表尚未初始化')));
    if (!commission) return res.status(404).json(err(new Error('委托需求不存在')));
    if (commission.poster_id !== profile.id) return res.status(403).json(err(new Error('只能关闭自己的委托需求')));
    if (!['pending', 'approved'].includes(commission.status)) return res.status(400).json(err(new Error('当前状态不能关闭')));

    const { error: updErr } = await supabase.from('lc_commissions')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('poster_id', profile.id);
    if (updErr) throw updErr;
    res.json(ok({ id: req.params.id, status: 'closed' }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 拼车区 ====================

app.get('/api/lc/carpools', async (req, res) => {
  try {
    const city = req.query.city as string;
    const date = req.query.date as string;
    const script = req.query.script as string;
    let query = supabase.from('lc_carpools')
      .select(`
        id, poster_id, poster_name, poster_is_realname, title, city,
        event_date, start_time, deadline_date, deadline_time,
        script_name, role_name, role_note,
        store_name, store_city, store_address, store_suggestion_status,
        subsidy_mode, subsidy_type, subsidy_amount, subsidy_discount, subsidy_note,
        needed_count, joined_count, content, boost_amount, status, reject_reason,
        juzhanggui_sync_status, juzhanggui_schedule_id, created_at, updated_at
      `)
      .eq('status', 'approved')
      .order('boost_amount', { ascending: false })
      .order('event_date', { ascending: true })
      .order('created_at', { ascending: false });
    if (city && city !== 'all') query = query.eq('city', city);
    if (date) query = query.eq('event_date', date);
    if (script) query = query.ilike('script_name', `%${script}%`);
    const { data, error: qErr } = await query;
    if (qErr && isMissingRelation(qErr, 'lc_carpools')) return res.json(ok([]));
    if (qErr) throw qErr;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/carpools/mine', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data, error: qErr } = await supabase.from('lc_carpools')
      .select('*')
      .eq('poster_id', profile.id)
      .order('created_at', { ascending: false });
    if (qErr && isMissingRelation(qErr, 'lc_carpools')) return res.json(ok([]));
    if (qErr) throw qErr;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/carpools', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));

    const title = cleanText(req.body.title, 80);
    const city = cleanText(req.body.city, 40);
    const eventDate = cleanText(req.body.eventDate, 20);
    const startTime = cleanText(req.body.startTime, 20);
    const deadlineDate = cleanText(req.body.deadlineDate, 20);
    const deadlineTime = cleanText(req.body.deadlineTime, 20);
    const scriptName = cleanText(req.body.scriptName, 80);
    const roleName = cleanText(req.body.roleName, 80);
    const roleNote = cleanText(req.body.roleNote, 400);
    const storeName = cleanText(req.body.storeName, 100);
    const storeCity = cleanText(req.body.storeCity, 40) || city;
    const storeAddress = cleanText(req.body.storeAddress, 160);
    const storeSourceUrl = cleanText(req.body.storeSourceUrl, 500);
    const storeVerifyNote = cleanText(req.body.storeVerifyNote, 500);
    const leaderContact = cleanText(req.body.leaderContact, 300);
    const contactNote = cleanText(req.body.contactNote, 300);
    const content = cleanText(req.body.content, 1600);
    const subsidyMode = (['none', 'asking', 'offering'].includes(req.body.subsidyMode) ? req.body.subsidyMode : 'none') as SubsidyMode;
    const subsidyType = (CARPOOL_SUBSIDY_TYPES.includes(req.body.subsidyType) ? req.body.subsidyType : 'none') as CarpoolSubsidyType;
    const subsidyAmount = subsidyType === 'none' && subsidyMode === 'none' ? 0 : parseCoinAmount(req.body.subsidyAmount, 0);
    const rawDiscount = Number.parseFloat(String(req.body.subsidyDiscount ?? ''));
    const subsidyDiscount = subsidyType === 'discount' && Number.isFinite(rawDiscount) && rawDiscount > 0 && rawDiscount <= 10 ? rawDiscount : null;
    const subsidyNote = subsidyType === 'none' && subsidyMode === 'none' ? '' : cleanText(req.body.subsidyNote, 300);
    const rawMessage = cleanText(req.body.rawMessage, 2000);
    const generatedMessage = cleanText(req.body.generatedMessage, 2000);
    const neededCount = Math.min(20, Math.max(1, parseCoinAmount(req.body.neededCount, 1)));
    const boostAmount = parseCoinAmount(req.body.boostAmount, 0);

    if (!city || !eventDate || !deadlineDate || !scriptName || !leaderContact || !content) {
      return res.status(400).json(err(new Error('请填写城市、日期、截止日期、本名、车头联系方式和拼车说明')));
    }
    if (boostAmount > 100) return res.status(400).json(err(new Error('加权展示最多 100 契约币')));
    if (boostAmount > 0 && (profile.balance || 0) < boostAmount) {
      return res.status(402).json(err(new Error('契约币不足，请先充值')));
    }

    if (boostAmount > 0) {
      await supabase.from('lc_profiles').update({ balance: (profile.balance || 0) - boostAmount }).eq('id', profile.id);
      await supabase.from('lc_transactions').insert({
        profile_id: profile.id,
        type: 'spend',
        amount: -boostAmount,
        description: `拼车区加权展示：${scriptName}`,
        status: 'approved',
      });
    }

    const { data, error: insErr } = await supabase.from('lc_carpools').insert({
      poster_id: profile.id,
      poster_name: profile.display_name,
      poster_is_realname: !!profile.is_realname,
      title: title || `${eventDate} · ${city} · ${scriptName}`,
      city,
      event_date: eventDate,
      start_time: startTime || null,
      deadline_date: deadlineDate,
      deadline_time: deadlineTime || null,
      script_name: scriptName,
      role_name: roleName || null,
      role_note: roleNote || null,
      store_name: storeName || null,
      store_city: storeName ? storeCity : null,
      store_address: storeAddress || null,
      store_source_url: storeSourceUrl || null,
      store_verify_note: storeVerifyNote || null,
      store_suggestion_status: storeName ? 'pending' : 'none',
      subsidy_mode: subsidyMode,
      subsidy_type: subsidyType,
      subsidy_amount: subsidyAmount,
      subsidy_discount: subsidyDiscount,
      subsidy_note: subsidyNote || null,
      needed_count: neededCount,
      leader_contact: leaderContact,
      contact_note: contactNote || null,
      content,
      boost_amount: boostAmount,
      status: 'approved',
      juzhanggui_sync_status: 'pending',
      ai_assist_context: {
        source: 'lingqi_carpool_form',
        moderation: 'post_publish',
        juzhanggui_sync: 'pending_manual_or_background_sync',
        subsidy_unit: 'cash_or_ticket_discount',
        raw_message: rawMessage || null,
        generated_message: generatedMessage || null,
      },
    }).select('*').single();
    if (insErr) {
      if (isMissingRelation(insErr, 'lc_carpools')) return res.status(503).json(err(new Error('拼车区数据表尚未初始化，请先执行 Supabase migration')));
      throw insErr;
    }

    try {
      await auditApprovedTarget('carpool', data as Record<string, unknown>, 'carpool_auto_published', profile.id, { moderation: 'post_publish' });
    } catch {
      // 审计链失败不阻断强时效拼车发布；后台巡检再补。
    }

    res.json(ok({ id: data?.id, status: 'approved', balance: (profile.balance || 0) - boostAmount }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/carpools/:id/contact', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: carpool, error: cErr } = await supabase.from('lc_carpools')
      .select('id, poster_id, status, leader_contact, contact_note')
      .eq('id', req.params.id)
      .single();
    if (cErr && isMissingRelation(cErr, 'lc_carpools')) return res.status(503).json(err(new Error('拼车区数据表尚未初始化')));
    if (cErr) throw cErr;
    if (!carpool) return res.status(404).json(err(new Error('拼车不存在')));
    if (carpool.status !== 'approved' && carpool.poster_id !== profile.id) {
      return res.status(403).json(err(new Error('这条拼车尚未公开')));
    }
    res.json(ok({
      leader_contact: carpool.leader_contact || '',
      contact_note: carpool.contact_note || null,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/reports', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const targetType = REPORT_TARGET_TYPES.includes(req.body.targetType) ? req.body.targetType as ReportTargetType : null;
    const targetId = cleanText(req.body.targetId, 80);
    const reason = cleanText(req.body.reason, 80);
    const description = cleanText(req.body.description, 800);
    if (!targetType || !targetId || !reason) {
      return res.status(400).json(err(new Error('请选择举报对象和举报原因')));
    }

    let targetTitle = '';
    let snapshot: Record<string, unknown> = {};
    if (targetType === 'carpool') {
      const { data: item, error: qErr } = await supabase.from('lc_carpools')
        .select('id, title, poster_id, poster_name, city, event_date, script_name, role_name, content, status')
        .eq('id', targetId)
        .single();
      if (qErr && isMissingRelation(qErr, 'lc_carpools')) return res.status(503).json(err(new Error('拼车区数据表尚未初始化')));
      if (qErr) throw qErr;
      if (!item) return res.status(404).json(err(new Error('举报对象不存在')));
      if (!['approved', 'pending'].includes(item.status)) return res.status(400).json(err(new Error('这条拼车已不在公开处理范围内')));
      targetTitle = item.title;
      snapshot = {
        city: item.city,
        event_date: item.event_date,
        script_name: item.script_name,
        role_name: item.role_name,
        poster_name: item.poster_name,
        content_preview: cleanText(item.content, 240),
      };
    } else if (targetType === 'ranking') {
      const { data: item, error: qErr } = await supabase.from('lc_rankings')
        .select('id, type, subject_name, subject_type, subject_city, author_name, content, status')
        .eq('id', targetId)
        .single();
      if (qErr && isMissingRelation(qErr, 'lc_rankings')) return res.status(503).json(err(new Error('红黑榜数据表尚未初始化')));
      if (qErr) throw qErr;
      if (!item) return res.status(404).json(err(new Error('举报对象不存在')));
      if (item.status !== 'approved') return res.status(400).json(err(new Error('只能举报已公开内容')));
      targetTitle = item.subject_name;
      snapshot = {
        ranking_type: item.type,
        subject_type: item.subject_type,
        city: item.subject_city,
        poster_name: item.author_name,
        content_preview: cleanText(item.content, 240),
      };
    } else if (targetType === 'comment') {
      const { data: item, error: qErr } = await supabase.from('lc_comments')
        .select('id, ranking_id, author_name, content, status, is_pinned, pin_label, lc_rankings(subject_name, type)')
        .eq('id', targetId)
        .single();
      if (qErr && isMissingRelation(qErr, 'lc_comments')) return res.status(503).json(err(new Error('评论数据表尚未初始化')));
      if (qErr) throw qErr;
      if (!item) return res.status(404).json(err(new Error('举报对象不存在')));
      if (item.status !== 'approved') return res.status(400).json(err(new Error('只能举报已公开评论')));
      const ranking = item.lc_rankings as { subject_name?: string; type?: string } | null;
      targetTitle = `${ranking?.subject_name || '红黑榜'}的评论`;
      snapshot = {
        ranking_id: item.ranking_id,
        ranking_title: ranking?.subject_name || null,
        ranking_type: ranking?.type || null,
        poster_name: item.author_name,
        is_pinned: !!item.is_pinned,
        pin_label: item.pin_label,
        content_preview: cleanText(item.content, 240),
      };
    } else if (targetType === 'commission') {
      const { data: item, error: qErr } = await supabase.from('lc_commissions')
        .select('id, title, poster_name, city, needed_date, target_type, content, status')
        .eq('id', targetId)
        .single();
      if (qErr && isMissingRelation(qErr, 'lc_commissions')) return res.status(503).json(err(new Error('委托需求表尚未初始化')));
      if (qErr) throw qErr;
      if (!item) return res.status(404).json(err(new Error('举报对象不存在')));
      if (item.status !== 'approved') return res.status(400).json(err(new Error('只能举报已公开委托需求')));
      targetTitle = item.title;
      snapshot = {
        city: item.city,
        needed_date: item.needed_date,
        target_type: item.target_type,
        poster_name: item.poster_name,
        content_preview: cleanText(item.content, 240),
      };
    } else if (targetType === 'profile') {
      const { data: item, error: qErr } = await supabase.from('lc_profiles')
        .select('id, display_name, role_type, city, bio, is_visible')
        .eq('id', targetId)
        .single();
      if (qErr && isMissingRelation(qErr, 'lc_profiles')) return res.status(503).json(err(new Error('用户档案表尚未初始化')));
      if (qErr) throw qErr;
      if (!item) return res.status(404).json(err(new Error('举报对象不存在')));
      if (!item.is_visible) return res.status(400).json(err(new Error('只能举报已公开主页')));
      targetTitle = item.display_name;
      snapshot = {
        display_name: item.display_name,
        role_type: item.role_type,
        city: item.city,
        content_preview: cleanText(item.bio, 240),
      };
    }

    const { data, error: insErr } = await supabase.from('lc_reports').upsert({
      target_type: targetType,
      target_id: targetId,
      target_title: targetTitle,
      reporter_id: profile.id,
      reporter_name: profile.display_name,
      reason,
      description: description || null,
      target_snapshot: snapshot,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'target_type,target_id,reporter_id' }).select('id').single();
    if (insErr) {
      if (isMissingRelation(insErr, 'lc_reports')) return res.status(503).json(err(new Error('举报表尚未初始化，请先执行 Supabase migration')));
      throw insErr;
    }
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/carpools/applications/sent', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data, error: qErr } = await supabase.from('lc_carpool_applications')
      .select('id, carpool_id, status, created_at')
      .eq('applicant_id', profile.id)
      .order('created_at', { ascending: false });
    if (qErr && isMissingRelation(qErr, 'lc_carpool_applications')) return res.json(ok([]));
    if (qErr) throw qErr;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/carpools/applications/received', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: carpools, error: cErr } = await supabase.from('lc_carpools')
      .select('id, title, city, event_date')
      .eq('poster_id', profile.id);
    if (cErr && isMissingRelation(cErr, 'lc_carpools')) return res.json(ok([]));
    if (cErr) throw cErr;
    const ids = (carpools || []).map(item => item.id);
    if (ids.length === 0) return res.json(ok([]));

    const meta = new Map((carpools || []).map(item => [item.id, item]));
    const { data, error: qErr } = await supabase.from('lc_carpool_applications')
      .select('*')
      .in('carpool_id', ids)
      .order('created_at', { ascending: false });
    if (qErr && isMissingRelation(qErr, 'lc_carpool_applications')) return res.json(ok([]));
    if (qErr) throw qErr;
    res.json(ok((data || []).map(item => ({ ...item, carpool: meta.get(item.carpool_id) || null }))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/carpools/:id/applications', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const message = cleanText(req.body.message, 1200);
    const roleName = cleanText(req.body.roleName, 80);
    if (!message) return res.status(400).json(err(new Error('请填写上车申请')));

    const { data: carpool, error: cErr } = await supabase.from('lc_carpools')
      .select('id, poster_id, status')
      .eq('id', req.params.id)
      .single();
    if (cErr && isMissingRelation(cErr, 'lc_carpools')) return res.status(503).json(err(new Error('拼车区数据表尚未初始化')));
    if (!carpool) return res.status(404).json(err(new Error('拼车不存在')));
    if (carpool.status !== 'approved') return res.status(400).json(err(new Error('只能申请已公开的拼车')));
    if (carpool.poster_id === profile.id) return res.status(400).json(err(new Error('不能申请自己的拼车')));

    const { data, error: insErr } = await supabase.from('lc_carpool_applications').insert({
      carpool_id: req.params.id,
      applicant_id: profile.id,
      applicant_name: profile.display_name,
      applicant_is_realname: !!profile.is_realname,
      role_name: roleName || null,
      message,
    }).select('id').single();
    if (insErr) {
      if (insErr.code === '23505') return res.status(409).json(err(new Error('你已经提交过上车申请了')));
      throw insErr;
    }
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/carpools/:id/close', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));

    const { data: carpool, error: cErr } = await supabase.from('lc_carpools')
      .select('id, poster_id, status')
      .eq('id', req.params.id)
      .single();
    if (cErr && isMissingRelation(cErr, 'lc_carpools')) return res.status(503).json(err(new Error('拼车区数据表尚未初始化')));
    if (!carpool) return res.status(404).json(err(new Error('拼车不存在')));
    if (carpool.poster_id !== profile.id) return res.status(403).json(err(new Error('只能关闭自己的拼车')));
    if (carpool.status === 'closed') return res.json(ok({ closed: true }));
    if (!['pending', 'approved'].includes(carpool.status)) return res.status(400).json(err(new Error('当前状态不能关闭')));

    const { error: updErr } = await supabase.from('lc_carpools')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    if (updErr) throw updErr;
    res.json(ok({ closed: true }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/carpools/assistant/compensation', async (req, res) => {
  try {
    const city = cleanText(req.query.city, 40);
    const script = cleanText(req.query.script, 80);
    const role = cleanText(req.query.role, 80);
    const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    let query = supabase.from('lc_carpools')
      .select('city, script_name, role_name, subsidy_mode, subsidy_type, subsidy_amount, subsidy_discount, subsidy_note, event_date')
      .eq('status', 'approved')
      .gte('created_at', since)
      .neq('subsidy_mode', 'none')
      .limit(200);
    if (city && city !== 'all') query = query.eq('city', city);
    if (script) query = query.ilike('script_name', `%${script}%`);
    if (role) query = query.ilike('role_name', `%${role}%`);
    const { data, error: qErr } = await query;
    if (qErr && isMissingRelation(qErr, 'lc_carpools')) return res.json(ok({ samples: [], summary: [] }));
    if (qErr) throw qErr;

    const groups = new Map<string, { city: string; script_name: string; role_name: string; asking: number[]; offering: number[]; count: number }>();
    for (const row of data || []) {
      const key = `${row.city || '未知'}|${row.script_name || '未知'}|${row.role_name || '未标注角色'}`;
      const current = groups.get(key) || { city: row.city || '未知', script_name: row.script_name || '未知', role_name: row.role_name || '未标注角色', asking: [], offering: [], count: 0 };
      current.count += 1;
      const amount = Number(row.subsidy_amount || 0);
      if (row.subsidy_mode === 'asking' && amount > 0) current.asking.push(amount);
      if (row.subsidy_mode === 'offering' && amount > 0) current.offering.push(amount);
      groups.set(key, current);
    }
    const avg = (items: number[]) => items.length ? Math.round(items.reduce((a, b) => a + b, 0) / items.length) : null;
    const summary = Array.from(groups.values())
      .map(item => ({ ...item, asking_avg: avg(item.asking), offering_avg: avg(item.offering), asking: undefined, offering: undefined }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
    res.json(ok({ samples: data || [], summary }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/commissions/applications/received', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));

    const { data: commissions, error: cErr } = await supabase.from('lc_commissions')
      .select('id, title, city, needed_date')
      .eq('poster_id', profile.id);
    if (cErr) throw cErr;
    const ids = (commissions || []).map(item => item.id);
    if (ids.length === 0) return res.json(ok([]));

    const meta = new Map((commissions || []).map(item => [item.id, item]));
    const { data, error: qErr } = await supabase.from('lc_commission_applications')
      .select('*')
      .in('commission_id', ids)
      .order('created_at', { ascending: false });
    if (qErr && isMissingRelation(qErr, 'lc_commission_applications')) return res.json(ok([]));
    if (qErr) throw qErr;
    res.json(ok((data || []).map(item => ({ ...item, commission: meta.get(item.commission_id) || null }))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/commissions/applications/sent', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data, error: qErr } = await supabase.from('lc_commission_applications')
      .select('id, commission_id, status, created_at')
      .eq('applicant_id', profile.id)
      .order('created_at', { ascending: false });
    if (qErr && isMissingRelation(qErr, 'lc_commission_applications')) return res.json(ok([]));
    if (qErr) throw qErr;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/commissions/:id/applications', authMiddleware, async (req, res) => {
  try {
    const letter = typeof req.body?.letter === 'string' ? req.body.letter.trim().slice(0, 1200) : '';
    if (!letter) return res.status(400).json(err(new Error('请填写申请信')));

    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));

    const { data: commission } = await supabase.from('lc_commissions')
      .select('id, poster_id, status')
      .eq('id', req.params.id)
      .single();
    if (!commission) return res.status(404).json(err(new Error('委托需求不存在')));
    if (commission.status !== 'approved') return res.status(400).json(err(new Error('只能申请已上墙的委托需求')));
    if (commission.poster_id === profile.id) return res.status(400).json(err(new Error('不能接自己的委托需求')));

    const { data, error: insErr } = await supabase.from('lc_commission_applications').insert({
      commission_id: req.params.id,
      applicant_id: profile.id,
      applicant_name: profile.display_name,
      applicant_is_realname: !!profile.is_realname,
      letter,
    }).select('id').single();
    if (insErr) {
      if (insErr.code === '23505') return res.status(409).json(err(new Error('你已经提交过接单申请了')));
      if (isMissingRelation(insErr, 'lc_commission_applications')) return res.status(503).json(err(new Error('接单申请数据表尚未初始化，请先执行 Supabase migration')));
      throw insErr;
    }
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.delete('/api/lc/commissions/:id', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('请先登录')));

    const { data: item } = await supabase.from('lc_commissions').select('poster_id').eq('id', req.params.id).single();
    if (!item) return res.status(404).json(err(new Error('委托不存在')));
    if (item.poster_id !== profile.id && getReq(req, 'role') !== 'admin') {
      return res.status(403).json(err(new Error('无权删除')));
    }

    await supabase.from('lc_commissions').delete().eq('id', req.params.id);
    res.json(ok({ deleted: true }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/contact-requests/:creatorId', authMiddleware, async (req, res) => {
  try {
    if (getReq(req, 'creatorId') !== req.params.creatorId && getReq(req, 'role') !== 'admin') {
      return res.status(403).json(err(new Error('无权查看')));
    }
    const { data } = await supabase.from('lc_contact_requests').select('*')
      .eq('creator_id', req.params.creatorId).order('created_at', { ascending: false });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 管理员 ====================

app.post('/api/lc/admin/login', async (req, res) => {
  try {
    if (req.body.password !== ADMIN_PASSWORD) {
      return res.status(401).json(err(new Error('密码错误')));
    }
    const token = jwt.sign({ creatorId: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json(ok({ authed: true, token }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/admin/pending', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const [{ data: profiles }, { data: requests }, { data: rankings }, { data: approvedRankings }, { data: comments }, { data: claims }, { data: commissions }, { data: transactions }, { data: certifications }, { data: carpools }, { data: reports }] = await Promise.all([
      supabase.from('lc_profiles').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('lc_contact_requests').select('*, lc_profiles!inner(display_name)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_rankings').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_rankings').select('*').eq('status', 'approved').order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_comments').select('*, lc_rankings(subject_name, type)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_claims').select('*, lc_rankings(subject_name, type)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_commissions').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_transactions').select('*, lc_profiles(display_name, phone)').eq('type', 'recharge').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_certifications').select('*, lc_profiles!inner(display_name, phone)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_carpools').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_reports').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    ]);
    res.json(ok({
      profiles: (profiles || []).map(profile => sanitizeProfile(profile, true)),
      contactRequests: requests || [],
      rankings: rankings || [],
      approvedRankings: approvedRankings || [],
      comments: comments || [],
      claims: claims || [],
      commissions: commissions || [],
      transactions: transactions || [],
      certifications: certifications || [],
      carpools: carpools || [],
      reports: reports || [],
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/profile/:id/flag', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = req.body?.rejectReason || null;
    await supabase.from('lc_profiles').update({ is_visible: false, reject_reason: rejectReason }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/profile/:id/unflag', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_profiles').update({ is_visible: true }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/contact-requests/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data } = await supabase.from('lc_contact_requests').update({ status: 'approved' }).eq('id', req.params.id).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/contact-requests/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_contact_requests').update({ status: 'rejected' }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 防篡改审计链 ====================

app.get('/api/lc/audit/:targetType/:id', async (req, res) => {
  try {
    const targetType = req.params.targetType as AuditTargetType;
    if (!['ranking', 'comment', 'commission', 'carpool'].includes(targetType)) {
      return res.status(400).json(err(new Error('无效审计对象')));
    }
    const selectFields = targetType === 'ranking'
      ? 'id,target_type,target_id,event_type,content_hash,previous_hash,entry_hash,chain_date,created_at,canonical_payload,metadata'
      : 'id,target_type,target_id,event_type,content_hash,previous_hash,entry_hash,chain_date,created_at';
    const { data: rawEntries, error: qErr } = await supabase.from('lc_audit_chain_entries')
      .select(selectFields)
      .eq('target_type', targetType)
      .eq('target_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (qErr && isMissingRelation(qErr, 'lc_audit_chain_entries')) {
      return res.json(ok({ entries: [], daily_roots: [], target: null }));
    }
    if (qErr) throw qErr;
    const entries = (rawEntries || []) as unknown as Array<Record<string, unknown> & { chain_date: string }>;

    let target: Record<string, unknown> | null = null;
    if (targetType === 'ranking') {
      const { data: ranking, error: targetErr } = await supabase.from('lc_rankings')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();
      if (targetErr) throw targetErr;
      target = ranking ? auditPayload('ranking', ranking) : null;
    }

    const dates = Array.from(new Set(entries.map(entry => entry.chain_date).filter(Boolean)));
    let roots: Record<string, unknown>[] = [];
    if (dates.length > 0) {
      const { data: dailyRoots, error: rootErr } = await supabase.from('lc_audit_daily_roots')
        .select('audit_date, root_hash, entry_count, first_entry_hash, last_entry_hash, generated_at')
        .in('audit_date', dates);
      if (rootErr) throw rootErr;
      roots = dailyRoots || [];
    }
    res.json(ok({ entries: entries || [], daily_roots: roots, target }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/admin/audit/backfill', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseCoinAmount(req.body?.limit, 200)));
    const target = cleanText(req.body?.target, 40);
    const allJobs: Array<[AuditTargetType, string]> = [
      ['ranking', 'lc_rankings'],
      ['comment', 'lc_comments'],
      ['commission', 'lc_commissions'],
      ['carpool', 'lc_carpools'],
    ];
    const jobs = allJobs.filter(([type]) => !target || target === type);
    const results: Record<string, { scanned: number; created: number }> = {};
    for (const [targetType, table] of jobs) {
      results[targetType] = await backfillAuditTargets(targetType, table, limit);
    }
    res.json(ok(results));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 红黑榜 ====================

app.get('/api/lc/rankings', async (req, res) => {
  try {
    const type = req.query.type as string;
    const city = req.query.city as string;
    const subjectType = req.query.subjectType as string;
    const viewerId = getOptionalCreatorId(req);
    let query = supabase
      .from('lc_rankings')
      .select('*, lc_profiles!poster_id(verified_dm, verified_shop, role)')
      .eq('status', 'approved')
      .order('likes', { ascending: false })
      .order('created_at', { ascending: false });
    if (type && type !== 'all') query = query.eq('type', type);
    if (subjectType && subjectType !== 'all') query = query.eq('subject_type', subjectType);
    if (city && city !== 'all') query = query.eq('subject_city', city);

    const { data, error } = await query;
    if (error) throw error;

    const now = Date.now();
    const visible = (data || []).filter((row: Record<string, unknown>) => {
      if (row.type !== 'black') return true;
      if (row.expiry_override) return true;
      const expiresAt = row.expires_at
        ? new Date(row.expires_at as string).getTime()
        : new Date(row.created_at as string).getTime() + 30 * 24 * 60 * 60 * 1000;
      return Number.isFinite(expiresAt) && expiresAt > now;
    });

    const visibleWithAudit = await attachAuditProof('ranking', visible);
    const rankingIds = visibleWithAudit.map((row: Record<string, unknown>) => String(row.id)).filter(Boolean);
    let pinnedByRanking = new Map<string, PinnedCommentRow[]>();
    if (rankingIds.length > 0) {
      const { data: pinnedComments, error: pinnedErr } = await supabase.from('lc_comments')
        .select('id, ranking_id, content, author_id, author_name, is_realname, is_pinned, pin_label, likes, created_at')
        .in('ranking_id', rankingIds)
        .eq('status', 'approved')
        .eq('is_pinned', true)
        .order('created_at', { ascending: false });
      if (pinnedErr) throw pinnedErr;
      pinnedByRanking = (pinnedComments || []).reduce((map: Map<string, PinnedCommentRow[]>, comment: PinnedCommentRow) => {
        const list = map.get(comment.ranking_id) || [];
        list.push(comment);
        map.set(comment.ranking_id, list);
        return map;
      }, new Map<string, PinnedCommentRow[]>());
    }

    const withPinnedComments = visibleWithAudit.map((row: Record<string, unknown>) => ({
      ...row,
      pinned_comments: pinnedByRanking.get(String(row.id)) || [],
    }));

    if (!viewerId || withPinnedComments.length === 0) return res.json(ok(withPinnedComments));

    const { data: myVotes, error: myVoteErr } = await supabase.from('lc_votes')
      .select('id, ranking_id, vote_type, created_at')
      .in('ranking_id', rankingIds)
      .eq('voter_id', viewerId);
    if (myVoteErr) throw myVoteErr;

    const voteByRanking = new Map(
      (myVotes || []).map((vote: RankingVoteRow) => [vote.ranking_id, serializeMyVote(vote)])
    );
    const withMyVotes = withPinnedComments.map((row: Record<string, unknown>) => ({
      ...row,
      my_vote: voteByRanking.get(String(row.id)) || null,
    }));

    res.json(ok(withMyVotes));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/rankings/mine', authMiddleware, async (req, res) => {
  try {
    const posterId = getReq(req, 'creatorId');
    const { data, error } = await supabase.from('lc_rankings')
      .select('id, type, subject_name, subject_type, subject_city, initial_amount, likes, dislikes, joys, status, created_at')
      .eq('poster_id', posterId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings', authMiddleware, async (req, res) => {
  try {
    const { type, subjectName, subjectType, subjectCity, subjectUrl, content, initialAmount, paymentProof, newSubject, files } = req.body;
    if (!type || !subjectName || !subjectType || !content) {
      return res.status(400).json(err(new Error('缺少必填字段')));
    }
    if (!['red', 'black', 'white'].includes(type)) return res.status(400).json(err(new Error('无效榜单类型')));
    if (type !== 'white' && (!Array.isArray(files) || files.length === 0)) return res.status(400).json(err(new Error('请至少上传一份证据文件')));
    const amount = type === 'white' ? 0 : parseInt(initialAmount);
    if (type !== 'white' && (amount < 10 || amount > 100)) return res.status(400).json(err(new Error('契约币须在10~100之间')));

    // 契约币支付
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    if (amount > 0 && (profile.balance || 0) < amount) return res.status(402).json(err(new Error('契约币不足，请先充值')));

    const posterId = getReq(req, 'creatorId');

    if (amount > 0) {
      await supabase.from('lc_profiles')
        .update({ balance: (profile.balance || 0) - amount })
        .eq('id', profile.id);

      await supabase.from('lc_transactions').insert({
        profile_id: profile.id, type: 'spend', amount: -amount,
        description: `发布${type === 'red' ? '红榜' : type === 'black' ? '黑榜' : '白榜'}：${subjectName}`,
        status: 'approved',
      });
    }

    const row: Record<string, unknown> = {
      type, subject_name: subjectName, subject_type: subjectType, subject_city: subjectCity || null,
      subject_url: subjectUrl || null, content,
      author_name: profile.display_name, poster_id: posterId,
      initial_amount: amount, payment_proof: paymentProof || null,
      is_realname: !!profile.is_realname, real_name: null,
      files: files || [],
    };

    // 黑榜 30 天过期
    if (type === 'black') {
      row.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: ranking, error: insErr } = await supabase.from('lc_rankings').insert(row).select().single();

    if (insErr) throw insErr;

    if (newSubject && ranking && newSubject.name) {
      await supabase.from('lc_submitted_subjects').insert({
        name: newSubject.name, subject_type: newSubject.subject_type || subjectType,
        city: newSubject.city || subjectCity, description: newSubject.description || null,
        contact: newSubject.contact || null, ranking_id: ranking.id,
      });
    }

    res.json(ok({ id: ranking?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/rankings/:id/withdraw', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: ranking } = await supabase.from('lc_rankings')
      .select('id, poster_id, status, initial_amount, likes, dislikes, joys')
      .eq('id', req.params.id)
      .single();
    if (!ranking) return res.status(404).json(err(new Error('内容不存在')));
    if (ranking.poster_id !== profile.id) return res.status(403).json(err(new Error('只能撤回自己的内容')));
    if (ranking.status !== 'pending') return res.status(400).json(err(new Error('只有待审核内容可以撤回')));
    if ((ranking.initial_amount || 0) > 0) return res.status(400).json(err(new Error('付费内容撤回涉及契约币退款，请联系管理员处理')));
    if ((ranking.likes || 0) > 0 || (ranking.dislikes || 0) > 0 || (ranking.joys || 0) > 0) {
      return res.status(400).json(err(new Error('已有互动记录的内容不能自助撤回')));
    }

    const { error: updErr } = await supabase.from('lc_rankings')
      .update({ status: 'withdrawn' })
      .eq('id', req.params.id)
      .eq('poster_id', profile.id)
      .eq('status', 'pending');
    if (updErr) throw updErr;
    res.json(ok({ id: req.params.id, status: 'withdrawn' }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/vote', authMiddleware, async (req, res) => {
  try {
    const voteType = req.body.voteType as RankingVoteType;
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    if (!['like', 'dislike', 'joy'].includes(voteType)) return res.status(400).json(err(new Error('无效投票类型')));

    const { data, error: voteErr } = await supabase.rpc('lc_apply_ranking_vote', {
      p_ranking_id: req.params.id,
      p_voter_id: profile.id,
      p_vote_type: voteType,
      p_voter_ip: (req.headers['x-forwarded-for'] as string) || req.ip || null,
      p_voter_name: profile.display_name,
      p_voter_is_realname: !!profile.is_realname,
    });
    if (voteErr) return res.status(rankingVoteRpcStatus(voteErr.message || '')).json(err(new Error(voteErr.message || '投票失败')));

    const row = firstRpcRow<RankingVoteRpcResult>(data);
    if (!row || !row.vote_id || !row.vote_type || !row.vote_created_at) throw new Error('投票结果为空');
    const myVote = serializeMyVote({ id: row.vote_id, vote_type: row.vote_type, created_at: row.vote_created_at });

    if (row.is_duplicate) {
      return res.status(409).json({
        ...err(new Error('你已经投过票了')),
        data: { myVote },
      });
    }

    res.json(ok({
      likes: row.likes,
      dislikes: row.dislikes,
      joys: row.joys,
      myVote,
      balance: row.balance,
      balanceDelta: row.balance_delta || 0,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.delete('/api/lc/rankings/:id/vote', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));

    const { data, error: cancelErr } = await supabase.rpc('lc_cancel_ranking_vote', {
      p_ranking_id: req.params.id,
      p_voter_id: profile.id,
    });
    if (cancelErr) return res.status(rankingVoteRpcStatus(cancelErr.message || '')).json(err(new Error(cancelErr.message || '撤销失败')));

    const row = firstRpcRow<RankingVoteRpcResult>(data);
    if (!row) throw new Error('撤销结果为空');

    res.json(ok({
      likes: row.likes,
      dislikes: row.dislikes,
      joys: row.joys,
      myVote: null,
      refunded: row.refunded || 0,
      balance: row.balance,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/rankings/:id/votes', async (req, res) => {
  try {
    const { data } = await supabase.from('lc_votes')
      .select('id, vote_type, voter_name, voter_is_realname, created_at')
      .eq('ranking_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(100);
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

// ── 评论 ──

app.get('/api/lc/rankings/:id/comments', async (req, res) => {
  try {
    const { data } = await supabase.from('lc_comments')
      .select('id, content, author_id, author_name, is_realname, real_name, is_pinned, pin_label, likes, created_at')
      .eq('ranking_id', req.params.id).eq('status', 'approved')
      .order('is_pinned', { ascending: false })
      .order('likes', { ascending: false })
      .order('created_at', { ascending: true });
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json(err(new Error('缺少评论内容')));
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    if ((profile.balance || 0) < 1) return res.status(402).json(err(new Error('契约币不足，请先充值')));

    // 扣 1 契约币
    await supabase.from('lc_profiles').update({ balance: (profile.balance || 0) - 1 }).eq('id', profile.id);
    await supabase.from('lc_transactions').insert({
      profile_id: profile.id, type: 'spend', amount: -1,
      description: '发表红黑榜评论 · 1 契约币',
      status: 'approved',
    });

    const { data, error: insErr } = await supabase.from('lc_comments').insert({
      ranking_id: req.params.id, content, author_id: profile.id, author_name: profile.display_name,
      is_realname: !!profile.is_realname, real_name: null,
    }).select().single();
    if (insErr) throw insErr;
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/comments/:cid/related-certify', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const relatedNote = typeof req.body?.relatedNote === 'string' ? req.body.relatedNote.trim().slice(0, 1000) : '';
    const relatedFiles = sanitizeRelatedFiles(req.body?.relatedFiles);
    if (!relatedNote && relatedFiles.length === 0) {
      return res.status(400).json(err(new Error('请提交能证明你是相关方的说明或图片材料')));
    }

    const { data: comment } = await supabase.from('lc_comments')
      .select('id, author_id, status')
      .eq('id', req.params.cid)
      .eq('ranking_id', req.params.id)
      .single();
    if (!comment) return res.status(404).json(err(new Error('评论不存在')));
    if (comment.author_id !== profile.id) return res.status(403).json(err(new Error('只能认证自己的评论')));
    if (comment.status !== 'approved') return res.status(400).json(err(new Error('评论审核通过后才能认证为相关方回应')));

    const { error: updErr } = await supabase.from('lc_comments')
      .update({
        status: 'pending',
        is_pinned: true,
        pin_label: '相关方回应',
        related_note: relatedNote || null,
        related_files: relatedFiles,
      })
      .eq('id', req.params.cid);
    if (updErr && isRelatedProofSchemaMiss(updErr)) {
      const { error: fallbackErr } = await supabase.from('lc_comments')
        .update({
          status: 'pending',
          is_pinned: true,
          pin_label: '相关方回应',
          payment_proof: encodeRelatedProofFallback(relatedNote, relatedFiles),
        })
        .eq('id', req.params.cid);
      if (fallbackErr) throw fallbackErr;
      return res.json(ok({ id: req.params.cid, storage: 'fallback' }));
    }
    if (updErr) throw updErr;
    res.json(ok({ id: req.params.cid }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/comments/:cid/like', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: c } = await supabase.from('lc_comments').select('likes').eq('id', req.params.cid).eq('ranking_id', req.params.id).single();
    if (!c) return res.status(404).json(err(new Error('评论不存在')));
    const { error: voteErr } = await supabase.from('lc_comment_votes').insert({ comment_id: req.params.cid, voter_id: profile.id });
    if (voteErr) {
      if (voteErr.code === '23505') return res.status(409).json(err(new Error('你已经赞过这条评论了')));
      throw voteErr;
    }
    const newLikes = (c.likes || 0) + 1;
    await supabase.from('lc_comments').update({ likes: newLikes }).eq('id', req.params.cid);
    res.json(ok({ likes: newLikes }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.delete('/api/lc/rankings/:id/comments/:cid', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: comment, error: qErr } = await supabase.from('lc_comments')
      .select('id, author_id, author_name, content, status, created_at')
      .eq('id', req.params.cid)
      .eq('ranking_id', req.params.id)
      .maybeSingle();
    if (qErr) throw qErr;
    if (!comment) return res.status(404).json(err(new Error('评论不存在')));
    if (comment.author_id !== profile.id) return res.status(403).json(err(new Error('只能删除自己的评论')));
    if (String(comment.status || '').startsWith('deleted')) return res.status(400).json(err(new Error('评论已经删除')));

    const createdAt = new Date(comment.created_at).getTime();
    const withinRefundWindow = Number.isFinite(createdAt) && Date.now() - createdAt <= 24 * 60 * 60 * 1000;
    const nextStatus = withinRefundWindow ? 'deleted_by_author_refunded' : 'deleted_by_author';

    const { data: deleted, error: updErr } = await supabase.from('lc_comments')
      .update({ status: nextStatus, is_pinned: false })
      .eq('id', req.params.cid)
      .eq('author_id', profile.id)
      .select('*')
      .single();
    if (updErr) throw updErr;

    if (withinRefundWindow) {
      await supabase.from('lc_profiles')
        .update({ balance: (profile.balance || 0) + 1 })
        .eq('id', profile.id);
      await supabase.from('lc_transactions').insert({
        profile_id: profile.id,
        type: 'refund',
        amount: 1,
        description: '24小时内删除红黑榜评论退回 · 1 契约币',
        status: 'approved',
        ref_type: 'comment_delete_refund',
        ref_id: req.params.cid,
        idempotency_key: `comment-delete-refund:${req.params.cid}`,
      });
    }

    const audit = await appendAuditEntry({
      targetType: 'comment',
      targetId: req.params.cid,
      eventType: 'comment_deleted_by_author',
      payload: auditPayload('comment', deleted),
      actorId: profile.id,
      actorRole: 'creator',
      metadata: { refund_amount: withinRefundWindow ? 1 : 0, refund_window_hours: 24 },
    });
    res.json(ok({ id: req.params.cid, refunded: withinRefundWindow, audit }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ── 我是相关方 ──

app.post('/api/lc/rankings/:id/claim', authMiddleware, async (req, res) => {
  try {
    const { contact, message } = req.body;
    if (!contact) return res.status(400).json(err(new Error('请填写联系方式')));
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    await supabase.from('lc_claims').insert({
      ranking_id: req.params.id, contact, message: message || null,
      claimant_id: profile.id, claimant_name: profile.display_name,
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ── 管理 ──

app.put('/api/lc/admin/rankings/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const targetType = ['red', 'black', 'white'].includes(req.body?.targetType) ? req.body.targetType : null;
    const { data: r } = await supabase.from('lc_rankings').select('type, initial_amount').eq('id', req.params.id).single();
    if (!r) return res.status(404).json(err(new Error('帖子不存在')));
    const nextType = targetType || r.type;
    const patch: Record<string, unknown> = {
      status: 'approved',
      type: nextType,
      likes: r.type === 'white' && targetType ? 0 : r.initial_amount,
    };
    if (nextType === 'black') {
      patch.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    const { data: approved, error: updErr } = await supabase.from('lc_rankings')
      .update(patch)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;
    const audit = await auditApprovedTarget('ranking', approved, targetType ? 'ranking_reclassified_approved' : 'ranking_approved', getReq(req, 'creatorId'), {
      target_type_override: targetType,
    });
    res.json(ok({ audit }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/rankings/:id/edit', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data: before, error: findErr } = await supabase.from('lc_rankings')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (findErr) throw findErr;
    if (!before) return res.status(404).json(err(new Error('帖子不存在')));

    const patch: Record<string, unknown> = {};
    const body = req.body || {};

    if ('type' in body) {
      const nextType = cleanText(body.type, 20);
      if (!['red', 'black', 'white'].includes(nextType)) return res.status(400).json(err(new Error('无效榜单类型')));
      patch.type = nextType;
    }
    if ('subject_name' in body) {
      const value = cleanText(body.subject_name, 120);
      if (!value) return res.status(400).json(err(new Error('对象名称不能为空')));
      patch.subject_name = value;
    }
    if ('subject_type' in body) {
      const value = cleanText(body.subject_type, 40);
      if (!RANKING_SUBJECT_TYPES.includes(value)) return res.status(400).json(err(new Error('无效对象分类')));
      patch.subject_type = value;
    }
    if ('subject_city' in body) {
      patch.subject_city = cleanText(body.subject_city, 80) || null;
    }
    if ('subject_url' in body) {
      patch.subject_url = cleanText(body.subject_url, 500) || null;
    }
    if ('content' in body) {
      const value = cleanText(body.content, 4000);
      if (!value) return res.status(400).json(err(new Error('正文不能为空')));
      patch.content = value;
    }

    const nextType = String(patch.type || before.type || '');
    if (nextType === 'black' && before.type !== 'black') {
      patch.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (nextType !== 'black' && before.type === 'black') {
      patch.expires_at = null;
    }

    const changedFields = Object.keys(patch).filter(field => !auditValuesEqual(before[field], patch[field]));
    if (changedFields.length === 0) {
      return res.json(ok({ item: before, changes: [] }));
    }

    const { data: updated, error: updErr } = await supabase.from('lc_rankings')
      .update(patch)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;

    const changes = buildRankingChanges(before, updated, changedFields);
    const audit = await auditApprovedTarget('ranking', updated, 'ranking_admin_edited', getReq(req, 'creatorId'), {
      before: auditPayload('ranking', before),
      after: auditPayload('ranking', updated),
      changes,
    });
    res.json(ok({ item: updated, changes, audit }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/rankings/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_rankings').update({ status: 'rejected' }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/comments/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data: approved, error: updErr } = await supabase.from('lc_comments')
      .update({ status: 'approved' })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;
    const audit = await auditApprovedTarget('comment', approved, approved?.is_pinned ? 'related_reply_pinned' : 'comment_approved', getReq(req, 'creatorId'));
    res.json(ok({ audit }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/comments/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data: comment } = await supabase.from('lc_comments')
      .select('id, is_pinned')
      .eq('id', req.params.id)
      .single();
    if (comment?.is_pinned) {
      const { error: updErr } = await supabase.from('lc_comments')
        .update({
          status: 'approved',
          is_pinned: false,
          pin_label: null,
          related_note: null,
          related_files: [],
          payment_proof: null,
        })
        .eq('id', req.params.id);
      if (updErr && isRelatedProofSchemaMiss(updErr)) {
        const { error: fallbackErr } = await supabase.from('lc_comments')
          .update({ status: 'approved', is_pinned: false, pin_label: null, payment_proof: null })
          .eq('id', req.params.id);
        if (fallbackErr) throw fallbackErr;
      } else if (updErr) {
        throw updErr;
      }
    } else {
      await supabase.from('lc_comments').update({ status: 'rejected' }).eq('id', req.params.id);
    }
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/claims/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_claims').update({ status: 'approved' }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/claims/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_claims').update({ status: 'rejected' }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/commissions/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data: approved, error: updErr } = await supabase.from('lc_commissions')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;
    const audit = await auditApprovedTarget('commission', approved, 'commission_approved', getReq(req, 'creatorId'));
    res.json(ok({ audit }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/commissions/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = req.body?.rejectReason || null;
    await supabase.from('lc_commissions')
      .update({ status: 'rejected', reject_reason: rejectReason, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/carpools/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data: carpool, error: cErr } = await supabase.from('lc_carpools')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (cErr) throw cErr;
    if (!carpool) return res.status(404).json(err(new Error('拼车不存在')));

    let syncResult: { ok: boolean; scheduleId?: string | null; reused?: boolean; error?: string } = { ok: false };
    try {
      const synced = await syncCarpoolToJuzhanggui(carpool as Record<string, unknown>);
      syncResult = { ok: true, scheduleId: synced.scheduleId, reused: synced.reused };
    } catch (syncErr) {
      syncResult = { ok: false, error: getErrorText(syncErr) || '同步剧司辰失败' };
    }

    const { data: approved, error: updErr } = await supabase.from('lc_carpools')
      .update({
        status: 'approved',
        juzhanggui_sync_status: syncResult.ok ? 'synced' : 'failed',
        juzhanggui_schedule_id: syncResult.scheduleId || carpool.juzhanggui_schedule_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;
    const audit = await auditApprovedTarget('carpool', approved, 'carpool_approved', getReq(req, 'creatorId'), { sync: syncResult });
    res.json(ok({ sync: syncResult, audit }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/carpools/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = req.body?.rejectReason || null;
    await supabase.from('lc_carpools')
      .update({ status: 'rejected', reject_reason: rejectReason, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/reports/:id/resolve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const action = req.body?.action === 'dismissed' ? 'dismissed' : 'resolved';
    const handlerNote = cleanText(req.body?.handlerNote, 500);
    const hideTarget = !!req.body?.hideTarget;
    const rejectReason = cleanText(req.body?.rejectReason, 300) || '举报处理后下架';
    const { data: report, error: rErr } = await supabase.from('lc_reports')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (rErr) throw rErr;
    if (!report) return res.status(404).json(err(new Error('举报不存在')));

    if (hideTarget) {
      if (report.target_type === 'carpool') {
        await supabase.from('lc_carpools')
          .update({ status: 'rejected', reject_reason: rejectReason, updated_at: new Date().toISOString() })
          .eq('id', report.target_id);
      } else if (report.target_type === 'ranking') {
        await supabase.from('lc_rankings')
          .update({ status: 'rejected' })
          .eq('id', report.target_id);
      } else if (report.target_type === 'comment') {
        await supabase.from('lc_comments')
          .update({ status: 'rejected' })
          .eq('id', report.target_id);
      } else if (report.target_type === 'commission') {
        await supabase.from('lc_commissions')
          .update({ status: 'rejected', reject_reason: rejectReason, updated_at: new Date().toISOString() })
          .eq('id', report.target_id);
      } else if (report.target_type === 'profile') {
        await supabase.from('lc_profiles')
          .update({ is_visible: false, reject_reason: rejectReason, updated_at: new Date().toISOString() })
          .eq('id', report.target_id);
      }
    }

    await supabase.from('lc_reports')
      .update({
        status: action,
        handler_id: getReq(req, 'creatorId'),
        handler_note: handlerNote || (hideTarget ? rejectReason : null),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);
    res.json(ok({ status: action, hidden: hideTarget }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/transactions/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('approve_lc_recharge', { p_transaction_id: req.params.id });
    if (error) throw error;
    res.json(ok(data?.[0] || null));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/transactions/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = req.body?.rejectReason || null;
    await supabase.from('lc_transactions')
      .update({ status: 'rejected', reject_reason: rejectReason, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('type', 'recharge')
      .eq('status', 'pending');
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ── 钱包 ──

app.get('/api/lc/wallet', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: txs } = await supabase.from('lc_transactions')
      .select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(50);
    res.json(ok({ balance: profile.balance || 0, transactions: txs || [] }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/wallet/recharge', authMiddleware, async (req, res) => {
  try {
    const { amount, paymentProof } = req.body;
    if (!amount || amount < 10) return res.status(400).json(err(new Error('充值金额最低 10 契约币')));
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    await supabase.from('lc_transactions').insert({
      profile_id: profile.id, type: 'recharge', amount: parseInt(amount),
      description: '契约币充值', payment_proof: paymentProof || null,
      status: 'pending',
    });
    res.json(ok({ message: '充值申请已提交，管理员审核后到账' }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ── 艾特解析 ──

app.get('/api/lc/profiles/lookup', async (req, res) => {
  try {
    const name = req.query.name as string;
    if (!name) return res.status(400).json(err(new Error('缺少 name 参数')));
    const { data } = await supabase.from('lc_profiles')
      .select('id, display_name').eq('display_name', name).maybeSingle();
    res.json(ok(data || null));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 店家后台 ====================

app.get('/api/lc/shop/dashboard', authMiddleware, async (req, res) => {
  try {
    const creatorId = getReq(req, 'creatorId');
    const { data: profile } = await supabase.from('lc_profiles').select('*').eq('id', creatorId).single();
    if (!profile || profile.role !== 'shop' || !profile.verified_shop) return res.status(403).json(err(new Error('非认证店家账号')));
    const shopName = profile.shop_name || profile.display_name;
    const { data: reviews } = await supabase.from('lc_rankings')
      .select('*')
      .eq('subject_type', 'store')
      .eq('subject_name', shopName)
      .order('created_at', { ascending: false });
    const reviewIds = (reviews || []).map((r: { id: string }) => r.id);
    let comments: Record<string, unknown>[] = [];
    if (reviewIds.length > 0) {
      const { data: cmts } = await supabase.from('lc_comments')
        .select('*')
        .in('ranking_id', reviewIds)
        .order('created_at', { ascending: true });
      comments = cmts || [];
    }
    res.json(ok({ profile, reviews: reviews || [], comments }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/shop/profile', authMiddleware, async (req, res) => {
  try {
    const creatorId = getReq(req, 'creatorId');
    const { data: profile } = await supabase.from('lc_profiles').select('role, verified_shop').eq('id', creatorId).single();
    if (!profile || profile.role !== 'shop' || !profile.verified_shop) return res.status(403).json(err(new Error('非认证店家账号')));
    const { shop_name, shop_description, contact_phone, contact_wechat, address, juzhanggui_link } = req.body;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (shop_name !== undefined) update.shop_name = shop_name;
    if (shop_description !== undefined) update.shop_description = shop_description;
    if (contact_phone !== undefined) update.contact_phone = contact_phone;
    if (contact_wechat !== undefined) update.contact_wechat = contact_wechat;
    if (address !== undefined) update.address = address;
    if (juzhanggui_link !== undefined) update.juzhanggui_link = juzhanggui_link;
    await supabase.from('lc_profiles').update(update).eq('id', creatorId);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/shop/review/:id/reply', authMiddleware, async (req, res) => {
  try {
    const creatorId = getReq(req, 'creatorId');
    const { data: profile } = await supabase.from('lc_profiles').select('role, verified_shop, shop_name, display_name').eq('id', creatorId).single();
    if (!profile || profile.role !== 'shop' || !profile.verified_shop) return res.status(403).json(err(new Error('非认证店家账号')));
    const { data: review } = await supabase.from('lc_rankings').select('*').eq('id', req.params.id).single();
    if (!review) return res.status(404).json(err(new Error('评价不存在')));
    const shopName = profile.shop_name || profile.display_name;
    if (review.subject_type !== 'store' || review.subject_name !== shopName) return res.status(403).json(err(new Error('无权回复此评价')));
    const { replyText } = req.body;
    if (!replyText) return res.status(400).json(err(new Error('请输入回复内容')));
    await supabase.from('lc_rankings').update({ shop_reply: replyText }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/shop/review/:id/appeal', authMiddleware, async (req, res) => {
  try {
    const creatorId = getReq(req, 'creatorId');
    const { data: profile } = await supabase.from('lc_profiles').select('role, verified_shop, shop_name, display_name').eq('id', creatorId).single();
    if (!profile || profile.role !== 'shop' || !profile.verified_shop) return res.status(403).json(err(new Error('非认证店家账号')));
    const { data: review } = await supabase.from('lc_rankings').select('*').eq('id', req.params.id).single();
    if (!review) return res.status(404).json(err(new Error('评价不存在')));
    const shopName = profile.shop_name || profile.display_name;
    if (review.subject_type !== 'store' || review.subject_name !== shopName) return res.status(403).json(err(new Error('无权申诉此评价')));
    const { reason } = req.body;
    if (!reason) return res.status(400).json(err(new Error('请输入申诉理由')));
    await supabase.from('lc_rankings').update({ appeal_status: 'pending', appeal_reason: reason }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/shop/appeal/:id/resolve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['approved', 'rejected'].includes(status)) return res.status(400).json(err(new Error('无效状态')));
    await supabase.from('lc_rankings').update({ appeal_status: status }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ── 认证 ──

app.post('/api/lc/certifications', authMiddleware, async (req, res) => {
  try {
    const { type, files, description } = req.body;
    if (!type || !['dm', 'shop'].includes(type)) {
      return res.status(400).json(err(new Error('请选择认证类型')));
    }
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json(err(new Error('请上传认证材料')));
    }
    if (files.length > 6) return res.status(400).json(err(new Error('认证材料最多上传 6 张')));
    const totalBytes = JSON.stringify(files).length;
    if (totalBytes > 18 * 1024 * 1024) return res.status(413).json(err(new Error('认证材料太大，请压缩后上传')));
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));

    const { data, error: insErr } = await supabase.from('lc_certifications').insert({
      profile_id: profile.id,
      type,
      files,
      description: description || null,
    }).select().single();

    if (insErr) throw insErr;
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/certifications/my', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));

    const { data } = await supabase.from('lc_certifications')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false });

    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/admin/certifications', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const { data } = await supabase.from('lc_certifications')
      .select('*, lc_profiles!inner(display_name, phone)')
      .order('created_at', { ascending: false });

    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/certifications/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data: cert } = await supabase.from('lc_certifications')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!cert) return res.status(404).json(err(new Error('认证记录不存在')));

    await supabase.from('lc_certifications')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (cert.type === 'dm') {
      await supabase.from('lc_profiles').update({ verified_dm: true }).eq('id', cert.profile_id);
    } else if (cert.type === 'shop') {
      await supabase.from('lc_profiles').update({ verified_shop: true, role: 'shop' }).eq('id', cert.profile_id);
    }

    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/certifications/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rejectReason } = req.body;
    await supabase.from('lc_certifications')
      .update({ status: 'rejected', reject_reason: rejectReason || null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

export default app;
