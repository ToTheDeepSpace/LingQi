/// <reference types="node" />
// 剧幕录 API
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { createTencentPgClient, tencentPgPool } from './tencentPgSupabase.js';
import { summarizeDmRatingRows } from './dmRatingSummary.js';
import {
  conflictsWhenMergingDmDossiers,
  conflictsWhenMergingStoreDossiers,
  preferredPublicDmAffiliation,
} from './dmAffiliationWorkflow.js';
import { hasRankingEvidence, normalizeRankingRevisionKind } from './rankingWorkflow.js';
import {
  findSharedRole,
  findSharedScript,
  normalizeSharedCatalog,
  type SharedCatalogScript,
} from './sharedScriptCatalog.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { createDecipheriv, createHash, createSign, createVerify, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sanitizeUploadedImageFile } from './uploadSecurity.js';
import {
  MAX_DOSSIER_CLAIM_PROOFS,
  privateClaimRootFromPublicUploadRoot,
  publicClaimProofMetadata,
  readDossierClaimProof,
  removeDossierClaimProofs,
  saveDossierClaimProofs,
  type DossierClaimProofFile,
} from './dossierClaimStorage.js';
import {
  buildLingqiCosObjectKey,
  createTencentCosUploadTransport,
  getLingqiCosUploadConfig,
  normalizeUploadRelativePath,
  saveLingqiSanitizedUploadImage,
} from './uploadStorage.js';
import {
  identityRolesFromServices,
  mergeIdentityRoles,
} from '../src/lib/serviceCategories.js';

function envValue(name: string) {
  const direct = process.env[name];
  if (direct) return direct;
  const file = process.env[`${name}_FILE`];
  if (!file) return '';
  try {
    return readFileSync(file, 'utf8').trim();
  } catch (e) {
    console.error(`[env] failed to read ${name}_FILE`, e instanceof Error ? e.message : String(e));
    return '';
  }
}

// --- 环境变量 ---
const JWT_SECRET = process.env.JWT_SECRET || 'lingqi-dev-secret-change-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const JUZHANGGUI_TENANT_ID = process.env.JUZHANGGUI_TENANT_ID || 'f0d6e011-6e75-4c14-95e9-dc61b26871e3';
const JUZHANGGUI_API_URL = (process.env.JUZHANGGUI_API_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const SHARED_SCRIPT_LIBRARY_TOKEN = envValue('SHARED_SCRIPT_LIBRARY_TOKEN');
const AUTH_CODE_PEPPER = process.env.AUTH_CODE_PEPPER || JWT_SECRET;
const SMS_CODE_TTL_MINUTES = Number(process.env.SMS_CODE_TTL_MINUTES || 5);
const SMS_CODE_COOLDOWN_SECONDS = Number(process.env.SMS_CODE_COOLDOWN_SECONDS || 60);
const EMAIL_CODE_TTL_MINUTES = Number(process.env.EMAIL_CODE_TTL_MINUTES || 10);
const EMAIL_CODE_COOLDOWN_SECONDS = Number(process.env.EMAIL_CODE_COOLDOWN_SECONDS || 60);
const TENCENT_SMS_REGION = process.env.TENCENT_SMS_REGION || 'ap-guangzhou';
const TENCENT_SMS_SDK_APP_ID = process.env.TENCENT_SMS_SDK_APP_ID || '';
const TENCENT_SMS_SIGN_NAME = process.env.TENCENT_SMS_SIGN_NAME || '';
const TENCENT_SMS_TEMPLATE_ID = process.env.TENCENT_SMS_TEMPLATE_ID || '';
const TENCENTCLOUD_SECRET_ID = process.env.TENCENTCLOUD_SECRET_ID || '';
const TENCENTCLOUD_SECRET_KEY = process.env.TENCENTCLOUD_SECRET_KEY || '';
const TENCENT_SES_REGION = process.env.TENCENT_SES_REGION || 'ap-hongkong';
const TENCENT_SES_FROM_EMAIL = process.env.TENCENT_SES_FROM_EMAIL || 'no-reply@mail.jusichen.com';
const TENCENT_SES_REPLY_TO = process.env.TENCENT_SES_REPLY_TO || 'basara-twenty@foxmail.com';
const TENCENT_SES_TEMPLATE_ID = process.env.TENCENT_SES_TEMPLATE_ID || '';
const TENCENT_SES_ALLOW_SIMPLE = process.env.TENCENT_SES_ALLOW_SIMPLE === 'true';
const LINGQI_SITE_URL = (process.env.LINGQI_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://jumulu.jusichen.com').replace(/\/$/, '');
const WECHAT_OPEN_APP_ID = process.env.WECHAT_OPEN_APP_ID || '';
const WECHAT_OPEN_APP_SECRET = process.env.WECHAT_OPEN_APP_SECRET || '';
const LINGQI_WECHAT_MINI_APP_ID = process.env.LINGQI_WECHAT_MINI_APP_ID || process.env.WECHAT_MINI_APP_ID || '';
const LINGQI_WECHAT_MINI_APP_SECRET = process.env.LINGQI_WECHAT_MINI_APP_SECRET || process.env.WECHAT_MINI_APP_SECRET || '';
const WECHAT_REDIRECT_URI = process.env.WECHAT_REDIRECT_URI || `${LINGQI_SITE_URL}/api/lc/auth/wechat/callback`;
const WECHAT_MP_TOKEN = process.env.WECHAT_MP_TOKEN || '';
const WECHAT_MP_ENCODING_AES_KEY = process.env.WECHAT_MP_ENCODING_AES_KEY || '';
const ALIPAY_APP_ID = process.env.ALIPAY_APP_ID || '';
const ALIPAY_PRIVATE_KEY = envValue('ALIPAY_PRIVATE_KEY');
const ALIPAY_PUBLIC_KEY = envValue('ALIPAY_PUBLIC_KEY');
const ALIPAY_GATEWAY = process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';
const ALIPAY_NOTIFY_URL = process.env.ALIPAY_NOTIFY_URL || `${LINGQI_SITE_URL}/api/lc/wallet/alipay/notify`;
const ALIPAY_RETURN_URL = process.env.ALIPAY_RETURN_URL || `${LINGQI_SITE_URL}/wallet?alipay=return`;
const ALIPAY_SELLER_ID = process.env.ALIPAY_SELLER_ID || '';
const RAW_PAYMENT_ORDER_TTL_MINUTES = Number(process.env.PAYMENT_ORDER_TTL_MINUTES || 30);
const PAYMENT_ORDER_TTL_MINUTES = Number.isFinite(RAW_PAYMENT_ORDER_TTL_MINUTES)
  ? Math.max(1, RAW_PAYMENT_ORDER_TTL_MINUTES)
  : 30;
const WECHAT_PAY_APP_ID = process.env.WECHAT_PAY_APP_ID || '';
const WECHAT_PAY_MCH_ID = process.env.WECHAT_PAY_MCH_ID || '';
const WECHAT_PAY_MCH_SERIAL_NO = process.env.WECHAT_PAY_MCH_SERIAL_NO || '';
const WECHAT_PAY_API_V3_KEY = envValue('WECHAT_PAY_API_V3_KEY');
const WECHAT_PAY_PRIVATE_KEY = envValue('WECHAT_PAY_PRIVATE_KEY');
const WECHAT_PAY_PUBLIC_KEY_ID = process.env.WECHAT_PAY_PUBLIC_KEY_ID || '';
const WECHAT_PAY_PUBLIC_KEY = envValue('WECHAT_PAY_PUBLIC_KEY');
const WECHAT_PAY_GATEWAY = (process.env.WECHAT_PAY_GATEWAY || 'https://api.mch.weixin.qq.com').replace(/\/$/, '');
const WECHAT_PAY_NOTIFY_URL = process.env.WECHAT_PAY_NOTIFY_URL || `${LINGQI_SITE_URL}/api/lc/wallet/wechat/notify`;

type TencentSmsStatus = { Code?: string; Message?: string; SerialNo?: string };
type TencentSmsClient = {
  SendSms(params: Record<string, unknown>): Promise<{ SendStatusSet?: TencentSmsStatus[] }>;
};
type TencentEmailClient = {
  SendEmail(params: Record<string, unknown>): Promise<{ MessageId?: string }>;
};
type TencentCloudSdk = {
  sms: {
    v20210111: {
      Client: new (config: Record<string, unknown>) => TencentSmsClient;
    };
  };
  ses: {
    v20201002: {
      Client: new (config: Record<string, unknown>) => TencentEmailClient;
    };
  };
};

const useTencentPg = Boolean(process.env.DATABASE_URL || process.env.PGHOST);
const supabase = useTencentPg ? createTencentPgClient() : createClient(SUPABASE_URL, SUPABASE_KEY);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const LOCAL_UPLOAD_ROOT = process.env.LOCAL_UPLOAD_ROOT || `${process.cwd()}/public/uploads`;
const PRIVATE_UPLOAD_ROOT = process.env.PRIVATE_UPLOAD_ROOT || privateClaimRootFromPublicUploadRoot(LOCAL_UPLOAD_ROOT);
const LINGQI_COS_UPLOAD_CONFIG = getLingqiCosUploadConfig(process.env);
const LINGQI_COS_UPLOAD_TRANSPORT = LINGQI_COS_UPLOAD_CONFIG ? createTencentCosUploadTransport(LINGQI_COS_UPLOAD_CONFIG) : null;

let sharedScriptCatalogCache: { data: SharedCatalogScript[]; expiresAt: number } | null = null;
let sharedScriptCatalogPromise: Promise<SharedCatalogScript[]> | null = null;

async function loadSharedScriptCatalog(force = false) {
  if (!force && sharedScriptCatalogCache && sharedScriptCatalogCache.expiresAt > Date.now()) return sharedScriptCatalogCache.data;
  if (!force && sharedScriptCatalogPromise) return sharedScriptCatalogPromise;
  sharedScriptCatalogPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${JUZHANGGUI_API_URL}/api/shared/script-library`, { signal: controller.signal });
      const body = await response.json() as { success?: boolean; data?: unknown; error?: unknown };
      if (!response.ok || !body.success) throw new Error(cleanText(body.error, 300) || '剧司辰公共剧本库读取失败');
      const data = normalizeSharedCatalog(body.data);
      sharedScriptCatalogCache = { data, expiresAt: Date.now() + 30_000 };
      return data;
    } catch (error) {
      if (sharedScriptCatalogCache?.data.length) {
        console.error('[shared-script-library] using stale memory cache', getErrorText(error));
        return sharedScriptCatalogCache.data;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      sharedScriptCatalogPromise = null;
    }
  })();
  return sharedScriptCatalogPromise;
}

async function submitSharedScriptContribution(contribution: Record<string, unknown>, roles: CarpoolRoleDraft[], credits: Record<string, string[]>) {
  if (!SHARED_SCRIPT_LIBRARY_TOKEN) throw new Error('共享剧本库服务密钥未配置');
  const response = await fetch(`${JUZHANGGUI_API_URL}/api/shared/script-library/contributions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shared-Library-Token': SHARED_SCRIPT_LIBRARY_TOKEN,
    },
    body: JSON.stringify({
      contributionId: cleanText(contribution.id, 120),
      scriptId: cleanText(contribution.script_id, 80) || null,
      legacyScriptId: cleanText(contribution.script_id, 80) || null,
      scriptName: cleanText(contribution.script_name, 160),
      playerRoles: roles,
      credits,
      contributorName: cleanText(contribution.profile_name, 80),
    }),
  });
  const body = await response.json() as { success?: boolean; data?: unknown; error?: unknown };
  if (!response.ok || !body.success) throw new Error(cleanText(body.error, 300) || '写入剧司辰公共剧本库失败');
  const [script] = normalizeSharedCatalog([body.data]);
  if (!script) throw new Error('剧司辰公共剧本库没有返回有效剧本');
  sharedScriptCatalogCache = null;
  return script;
}

const app = express();
app.use(cors());
app.get(/^\/uploads\/lc-portfolio\/(.+)$/, async (req, res, next) => {
  if (!LINGQI_COS_UPLOAD_CONFIG || !LINGQI_COS_UPLOAD_TRANSPORT?.getObject) return next();
  try {
    const rawRelativePath = String((req.params as Record<string, string>)['0'] || '');
    const bucketPath = normalizeUploadRelativePath(`lc-portfolio/${rawRelativePath}`);
    if (!bucketPath) return res.status(400).json(err(new Error('图片路径不合法')));

    const object = await LINGQI_COS_UPLOAD_TRANSPORT.getObject(buildLingqiCosObjectKey(LINGQI_COS_UPLOAD_CONFIG, bucketPath));
    if (object.status === 404) return next();
    if (!object.ok) throw new Error(`COS 图片读取失败：${object.status}`);

    res.setHeader('Content-Type', object.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', object.cacheControl || 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(object.body);
  } catch (e) {
    next(e);
  }
});
app.use('/uploads', express.static(LOCAL_UPLOAD_ROOT));
app.use(express.json({
  limit: '25mb',
  verify: (req, _res, buf) => {
    (req as Record<string, unknown>).rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

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

function singleQueryValue(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
}

function sha1Sorted(parts: string[]): string {
  return createHash('sha1').update(parts.slice().sort().join('')).digest('hex');
}

function safeEqualText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function extractWechatMpEncrypted(body: unknown, rawBody: string): string {
  if (body && typeof body === 'object') {
    const data = body as Record<string, unknown>;
    const encrypted = data.Encrypt || data.encrypt;
    if (typeof encrypted === 'string') return encrypted;
  }
  const match = rawBody.match(/<Encrypt><!\[CDATA\[([\s\S]*?)\]\]><\/Encrypt>|<Encrypt>([\s\S]*?)<\/Encrypt>/);
  return (match?.[1] || match?.[2] || '').trim();
}

function verifyWechatMpRequest(req: express.Request, encrypted = ''): boolean {
  if (!WECHAT_MP_TOKEN) return false;
  const timestamp = singleQueryValue(req.query.timestamp);
  const nonce = singleQueryValue(req.query.nonce);
  const msgSignature = singleQueryValue(req.query.msg_signature);
  const signature = msgSignature || singleQueryValue(req.query.signature);
  if (!timestamp || !nonce || !signature) return false;
  const expected = msgSignature && encrypted
    ? sha1Sorted([WECHAT_MP_TOKEN, timestamp, nonce, encrypted])
    : sha1Sorted([WECHAT_MP_TOKEN, timestamp, nonce]);
  return safeEqualText(expected, signature);
}

function getWechatMpConfigError(): string {
  if (!WECHAT_MP_TOKEN) return 'wechat mp token not configured';
  if (WECHAT_MP_ENCODING_AES_KEY && WECHAT_MP_ENCODING_AES_KEY.length !== 43) return 'wechat mp aes key invalid';
  return '';
}

function isWechatMiniLoginConfigured() {
  return Boolean(LINGQI_WECHAT_MINI_APP_ID && LINGQI_WECHAT_MINI_APP_SECRET);
}

// --- JWT 鉴权中间件 ---
async function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json(err(new Error('请先登录')));
  }
  let decoded: { creatorId: string; role?: string };
  try {
    decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { creatorId: string; role?: string };
  } catch {
    return res.status(401).json(err(new Error('登录已过期，请重新登录')));
  }

  (req as Record<string, unknown>).creatorId = decoded.creatorId;
  (req as Record<string, unknown>).role = decoded.role || 'creator';

  try {
    if (decoded.role !== 'admin') {
      const { data: profile, error: profileErr } = await supabase.from('lc_profiles')
        .select('is_banned, ban_reason')
        .eq('id', decoded.creatorId)
        .maybeSingle();
      if (profileErr && !isMissingRelation(profileErr, 'is_banned')) throw profileErr;
      if (profile?.is_banned) {
        await logSecurityEvent(req, {
          action: 'auth_blocked_banned_user',
          actorId: decoded.creatorId,
          actorRole: decoded.role || 'creator',
          targetType: 'profile',
          targetId: decoded.creatorId,
          metadata: { reason: profile.ban_reason || null },
        });
        return res.status(403).json(err(new Error('账号已被限制发布，请联系管理员申诉')));
      }
    }
    next();
  } catch (profileErr) {
    console.error('[auth] profile status check failed', getErrorText(profileErr));
    return res.status(500).json(err(new Error('账号状态检查失败，请稍后重试')));
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

function publicStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(item => cleanText(item, 80)).filter(Boolean);
}

function publicRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function sanitizeProfile(profile: Record<string, unknown>, isOwner = false) {
  const safe = { ...profile };
  if (isOwner) safe.has_password = Boolean(profile.password_hash);
  delete safe.password_hash;
  safe.tags = publicStringArray(profile.tags);
  safe.available_cities = publicStringArray(profile.available_cities);
  safe.preferred_story_lines = publicStringArray(profile.preferred_story_lines);
  safe.identity_roles = profileIdentityRoles(profile);
  safe.social_links = publicRecord(profile.social_links);
  safe.social_snapshots = publicRecord(profile.social_snapshots);
  safe.is_realname = Boolean(profile.is_realname);
  safe.verified_dm = Boolean(profile.verified_dm);
  safe.verified_shop = Boolean(profile.verified_shop);
  if (!isOwner) {
    delete safe.phone;
    delete safe.email;
    delete safe.wechat;
    delete safe.balance;
    delete safe.paid_balance;
    delete safe.bonus_balance;
    delete safe.contact_phone;
    delete safe.contact_wechat;
    delete safe.phone_verified_at;
    delete safe.email_verified_at;
    delete safe.auth_provider;
    delete safe.wechat_openid;
    delete safe.wechat_mini_openid;
    delete safe.wechat_unionid;
    delete safe.wechat_avatar;
    delete safe.wechat_nickname;
    delete safe.wechat_bound_at;
    delete safe.is_banned;
    delete safe.ban_reason;
    delete safe.banned_at;
  }
  return safe;
}

const PROFILE_IDENTITY_ROLES = ['player', 'creator', 'dm', 'shop', 'store', 'photographer', 'makeup', 'costume', 'prop', 'coser'];

function normalizeProfileIdentityRole(value: unknown) {
  const raw = cleanText(value, 40).toLowerCase();
  if (raw === 'store') return 'shop';
  if (!PROFILE_IDENTITY_ROLES.includes(raw)) return '';
  return raw;
}

function profileIdentityRoles(profile: Record<string, unknown> | null | undefined, additions: string[] = []) {
  const roles: string[] = [];
  const pushRole = (value: unknown) => {
    const role = normalizeProfileIdentityRole(value);
    if (role && !roles.includes(role)) roles.push(role);
  };

  const existing = profile?.identity_roles;
  if (Array.isArray(existing)) existing.forEach(pushRole);
  pushRole(profile?.role_type);
  pushRole(profile?.role);
  if (profile?.verified_dm) pushRole('dm');
  if (profile?.verified_shop) pushRole('shop');
  additions.forEach(pushRole);
  if (roles.length === 0) roles.push('player');
  return roles;
}

function profileIdentityPatch(profile: Record<string, unknown> | null | undefined, additions: string[]) {
  const identityRoles = profileIdentityRoles(profile, additions);
  const currentRoleType = normalizeProfileIdentityRole(profile?.role_type);
  return {
    identity_roles: identityRoles,
    role_type: currentRoleType || identityRoles[0] || 'player',
  };
}

async function addProfileIdentityRoles(profileId: string, additions: string[]) {
  const normalizedAdditions = additions.map(normalizeProfileIdentityRole).filter(Boolean);
  if (normalizedAdditions.length === 0) return;
  const { data: profile, error: profileErr } = await supabase
    .from('lc_profiles')
    .select('role, role_type, identity_roles, verified_dm, verified_shop')
    .eq('id', profileId)
    .maybeSingle();
  if (profileErr) throw profileErr;
  const patch = profileIdentityPatch(profile || {}, normalizedAdditions);
  const { error: updateErr } = await supabase.from('lc_profiles').update({
    ...patch,
    updated_at: new Date().toISOString(),
  }).eq('id', profileId);
  if (updateErr) throw updateErr;
}

function profileAuthRole(profile: Record<string, unknown> | null | undefined) {
  return cleanText(profile?.role, 40).toLowerCase() === 'admin' ? 'admin' : 'creator';
}

function signProfileAuthToken(profile: Record<string, unknown>) {
  return jwt.sign({ creatorId: String(profile.id), role: profileAuthRole(profile) }, JWT_SECRET, { expiresIn: '7d' });
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

function makeSocialSnapshots(socialLinks: Record<string, string> | null | undefined) {
  const links = socialLinks || {};
  const entries = Object.entries(links).filter(([, url]) => typeof url === 'string' && url.trim());
  return entries.reduce<Record<string, { url: string; platform: string; title: string; description: string; captured_at: string }>>((acc, [key, url]) => {
    const platform = key === 'douyin' ? '抖音' : key === 'xiaohongshu' ? '小红书' : '社交主页';
    acc[key] = {
      url: url.trim(),
      platform,
      title: `${platform}主页`,
      description: '已添加到公开主页，后续可接入真实网页快照服务。',
      captured_at: new Date().toISOString(),
    };
    return acc;
  }, {});
}

type AuthedProfile = {
  id: string;
  display_name?: string | null;
  is_realname?: boolean | null;
  balance?: number | null;
  paid_balance?: number | null;
  bonus_balance?: number | null;
  is_banned?: boolean | null;
  ban_reason?: string | null;
  avatar?: string | null;
  phone?: string | null;
  phone_verified_at?: string | null;
  email?: string | null;
  email_verified_at?: string | null;
  gender?: string | null;
  role?: string | null;
  role_type?: string | null;
  identity_roles?: string[] | null;
  verified_dm?: boolean | null;
  verified_shop?: boolean | null;
  referral_code?: string | null;
  community_role?: string | null;
  community_role_expires_at?: string | null;
};

async function getAuthedProfile(req: express.Request): Promise<AuthedProfile | null> {
  const creatorId = getReq(req, 'creatorId');
  const { data } = await supabase.from('lc_profiles')
    .select('id, display_name, is_realname, balance, paid_balance, bonus_balance, is_banned, ban_reason, avatar, phone, phone_verified_at, email, email_verified_at, gender, role, role_type, identity_roles, verified_dm, verified_shop, referral_code, community_role, community_role_expires_at')
    .eq('id', creatorId)
    .single();
  return data as AuthedProfile | null;
}

function getSpeakBlockReason(profile: { phone_verified_at?: string | null; email_verified_at?: string | null } | null) {
  if (!profile) return '用户不存在';
  if (!profile.phone_verified_at && !profile.email_verified_at) return '发言前请先完成手机号或邮箱验证';
  return '';
}

const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type ReferralRecord = {
  id: string;
  referrer_id: string;
  invitee_id: string;
  referral_code: string;
  status: 'registered' | 'qualified' | 'converted' | 'rejected';
  invitee_bonus_awarded_at?: string | null;
  stage1_awarded_at?: string | null;
  stage2_awarded_at?: string | null;
};

type ReferralProfile = {
  id: string;
  display_name?: string | null;
  avatar?: string | null;
  phone_verified_at?: string | null;
  referral_code?: string | null;
  community_role?: string | null;
  community_role_expires_at?: string | null;
};

type WalletCreditResult = {
  transaction_id: string;
  balance: number;
  applied: boolean;
};

type WalletSpendResult = {
  transaction_id: string;
  balance: number;
  paid_balance: number;
  bonus_balance: number;
  paid_spent: number;
  bonus_spent: number;
  applied: boolean;
};

type GuidePurchaseResult = {
  purchase_id: string;
  guide_id: string;
  transaction_id?: string | null;
  balance: number;
  creator_income_id?: string | null;
  already_purchased: boolean;
};

function normalizeReferralCode(input: unknown) {
  return cleanText(input, 40).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

function makeReferralCode() {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += REFERRAL_CODE_ALPHABET[randomInt(0, REFERRAL_CODE_ALPHABET.length)];
  }
  return `LQ${suffix}`;
}

async function applyWalletCredit(args: {
  profileId: string;
  amount: number;
  description: string;
  refType: string;
  refId: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabase.rpc('lc_apply_wallet_credit', {
    p_profile_id: args.profileId,
    p_amount: args.amount,
    p_description: args.description,
    p_ref_type: args.refType,
    p_ref_id: args.refId,
    p_idempotency_key: args.idempotencyKey,
    p_metadata: args.metadata || {},
  });
  if (error) throw error;
  return firstRpcRow(data as WalletCreditResult | WalletCreditResult[] | null);
}

async function spendWalletBalance(args: {
  profileId: string;
  amount: number;
  description: string;
  refType?: string | null;
  refId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabase.rpc('lc_spend_wallet_balance', {
    p_profile_id: args.profileId,
    p_amount: args.amount,
    p_description: args.description,
    p_ref_type: args.refType || null,
    p_ref_id: args.refId || null,
    p_idempotency_key: args.idempotencyKey || null,
    p_metadata: args.metadata || {},
  });
  if (error) throw error;
  return firstRpcRow(data as WalletSpendResult | WalletSpendResult[] | null);
}

async function ensureReferralCodeForProfile(profileOrId: ReferralProfile | string) {
  const profileId = typeof profileOrId === 'string' ? profileOrId : profileOrId.id;
  const existingCode = typeof profileOrId === 'string' ? '' : normalizeReferralCode(profileOrId.referral_code);
  if (existingCode) return existingCode;

  const { data: existing } = await supabase.from('lc_profiles')
    .select('id, referral_code')
    .eq('id', profileId)
    .maybeSingle();
  const existingDbCode = normalizeReferralCode(existing?.referral_code);
  if (existingDbCode) return existingDbCode;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = makeReferralCode();
    const { data, error } = await supabase.from('lc_profiles')
      .update({ referral_code: code, updated_at: new Date().toISOString() })
      .eq('id', profileId)
      .is('referral_code', null)
      .select('referral_code')
      .maybeSingle();
    if (data?.referral_code) return normalizeReferralCode(data.referral_code);
    if (error && !getErrorText(error).includes('duplicate key')) throw error;

    const { data: afterRace } = await supabase.from('lc_profiles')
      .select('referral_code')
      .eq('id', profileId)
      .maybeSingle();
    const afterRaceCode = normalizeReferralCode(afterRace?.referral_code);
    if (afterRaceCode) return afterRaceCode;
  }

  throw new Error('邀请码生成失败，请稍后重试');
}

async function findReferralOwner(codeInput: unknown) {
  const code = normalizeReferralCode(codeInput);
  if (!code) return null;
  const { data } = await supabase.from('lc_profiles')
    .select('id, display_name, referral_code')
    .eq('referral_code', code)
    .maybeSingle();
  return data as ReferralProfile | null;
}

function nextReferralMilestone(validInvites: number) {
  if (validInvites < 3) return { target: 3, title: '社区推荐人', remaining: 3 - validInvites };
  if (validInvites < 10) return { target: 10, title: '社区观察员 · 7天', remaining: 10 - validInvites };
  if (validInvites < 30) return { target: 30, title: '社区观察员 · 30天', remaining: 30 - validInvites };
  if (validInvites < 100) return { target: 100, title: '创始推荐人 / 城市共建人', remaining: 100 - validInvites };
  return { target: 100, title: '创始推荐人 / 城市共建人', remaining: 0 };
}

async function refreshCommunityRole(referrerId: string) {
  const { data: rows } = await supabase.from('lc_referrals')
    .select('stage1_awarded_at, stage2_awarded_at')
    .eq('referrer_id', referrerId);
  const validInvites = (rows || []).filter((row: { stage1_awarded_at?: string | null; stage2_awarded_at?: string | null }) => row.stage1_awarded_at || row.stage2_awarded_at).length;
  const now = Date.now();
  let communityRole: string | null = null;
  let expiresAt: string | null = null;

  if (validInvites >= 100) {
    communityRole = 'founding_referrer';
  } else if (validInvites >= 30) {
    communityRole = 'community_observer';
    expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  } else if (validInvites >= 10) {
    communityRole = 'community_observer';
    expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (validInvites >= 3) {
    communityRole = 'community_referrer';
  }

  await supabase.from('lc_profiles')
    .update({ community_role: communityRole, community_role_expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq('id', referrerId);

  return { validInvites, communityRole, expiresAt, nextMilestone: nextReferralMilestone(validInvites) };
}

async function registerReferralForNewProfile(profile: ReferralProfile, referralCodeInput: unknown) {
  const code = normalizeReferralCode(referralCodeInput);
  if (!code) return null;
  const referrer = await findReferralOwner(code);
  if (!referrer || referrer.id === profile.id) return null;

  await supabase.from('lc_profiles')
    .update({
      referred_by: referrer.id,
      referral_source_code: normalizeReferralCode(referrer.referral_code) || code,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
    .is('referred_by', null);

  let referral: ReferralRecord | null;
  const { data: inserted, error: insertErr } = await supabase.from('lc_referrals').insert({
    referrer_id: referrer.id,
    invitee_id: profile.id,
    referral_code: normalizeReferralCode(referrer.referral_code) || code,
    status: 'registered',
    metadata: { source: 'signup' },
  }).select('*').maybeSingle();

  if (insertErr) {
    const { data: existing } = await supabase.from('lc_referrals')
      .select('*')
      .eq('invitee_id', profile.id)
      .maybeSingle();
    referral = existing as ReferralRecord | null;
  } else {
    referral = inserted as ReferralRecord | null;
  }

  if (!referral) return null;

  const credit = await applyWalletCredit({
    profileId: profile.id,
    amount: 10,
    description: '受邀注册额外赠送 10 契约币',
    refType: 'referral_invitee_bonus',
    refId: referral.id,
    idempotencyKey: `referral:invitee:${referral.id}`,
    metadata: { referrer_id: referrer.id, referral_code: code },
  });

  if (credit) {
    await supabase.from('lc_referrals')
      .update({ invitee_bonus_awarded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', referral.id)
      .is('invitee_bonus_awarded_at', null);
  }

  await maybeAwardReferralStage1(profile.id);
  return { referral, referrer, inviteeBonusApplied: Boolean(credit?.applied) };
}

async function getReferralForInvitee(inviteeId: string) {
  const { data } = await supabase.from('lc_referrals')
    .select('*')
    .eq('invitee_id', inviteeId)
    .maybeSingle();
  return data as ReferralRecord | null;
}

async function maybeAwardReferralStage1(inviteeId: string) {
  const referral = await getReferralForInvitee(inviteeId);
  if (!referral || referral.stage1_awarded_at) return null;

  const { data: invitee } = await supabase.from('lc_profiles')
    .select('id, display_name, phone_verified_at')
    .eq('id', inviteeId)
    .maybeSingle();
  if (!invitee?.phone_verified_at) return null;

  const credit = await applyWalletCredit({
    profileId: referral.referrer_id,
    amount: 10,
    description: '邀请好友完成手机号验证奖励 10 契约币',
    refType: 'referral_stage1',
    refId: referral.id,
    idempotencyKey: `referral:stage1:${referral.id}`,
    metadata: { invitee_id: inviteeId },
  });

  await supabase.from('lc_referrals')
    .update({ stage1_awarded_at: new Date().toISOString(), status: referral.stage2_awarded_at ? 'converted' : 'qualified', updated_at: new Date().toISOString() })
    .eq('id', referral.id)
    .is('stage1_awarded_at', null);
  await refreshCommunityRole(referral.referrer_id);
  return credit;
}

async function maybeAwardReferralStage2(inviteeId: string | null | undefined, reason: string) {
  if (!inviteeId) return null;
  await maybeAwardReferralStage1(inviteeId);
  const referral = await getReferralForInvitee(inviteeId);
  if (!referral || referral.stage2_awarded_at) return null;

  const credit = await applyWalletCredit({
    profileId: referral.referrer_id,
    amount: 20,
    description: '邀请好友完成有效互动奖励 20 契约币',
    refType: 'referral_stage2',
    refId: referral.id,
    idempotencyKey: `referral:stage2:${referral.id}`,
    metadata: { invitee_id: inviteeId, reason },
  });

  await supabase.from('lc_referrals')
    .update({ stage2_awarded_at: new Date().toISOString(), stage2_reason: reason, status: 'converted', updated_at: new Date().toISOString() })
    .eq('id', referral.id)
    .is('stage2_awarded_at', null);
  await refreshCommunityRole(referral.referrer_id);
  return credit;
}

async function runReferralSideEffect<T>(label: string, task: () => Promise<T>) {
  try {
    return await task();
  } catch (referralErr) {
    console.error(`[referral] ${label} failed`, getErrorText(referralErr));
    return null;
  }
}

type RelatedProofFile = { name: string; url: string; type?: string };
type SubsidyMode = 'none' | 'asking' | 'offering';
type CarpoolSubsidyType = 'none' | 'half_price' | 'free_ticket' | 'discount' | 'a_subsidy' | 'fixed_deduct' | 'custom';
const CARPOOL_SUBSIDY_TYPES: CarpoolSubsidyType[] = ['none', 'half_price', 'free_ticket', 'discount', 'a_subsidy', 'fixed_deduct', 'custom'];
type ReportTargetType = 'carpool' | 'ranking' | 'comment' | 'commission' | 'profile';
const REPORT_TARGET_TYPES: ReportTargetType[] = ['carpool', 'ranking', 'comment', 'commission', 'profile'];
type ModerationDecision = 'safe' | 'hide' | 'needs_more_evidence' | 'privacy_risk' | 'legal_risk' | 'duplicate' | 'unclear';
const MODERATION_DECISIONS: ModerationDecision[] = ['safe', 'hide', 'needs_more_evidence', 'privacy_risk', 'legal_risk', 'duplicate', 'unclear'];
const TEMPORARY_HIDE_REASON = '收到有效举报后临时折叠，等待管理员复核';

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

function getClientIp(req: express.Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || null;
}

function getUserAgent(req: express.Request) {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua.join(' ') : ua || null;
}

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function normalizeChinaPhone(input: unknown) {
  const phone = typeof input === 'string' ? input.replace(/\D/g, '') : '';
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error('请填写正确的中国大陆手机号');
  return phone;
}

function normalizeEmail(input: unknown) {
  const email = cleanText(input, 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('请填写正确的邮箱');
  return email;
}

function makeAuthPhoneHash(phone: string) {
  return sha256(`auth-phone:${phone}`);
}

function makeAuthCodeHash(phone: string, code: string) {
  return sha256(`auth-code:${AUTH_CODE_PEPPER}:${phone}:${code}`);
}

function makeAuthEmailHash(email: string) {
  return sha256(`auth-email:${email.toLowerCase()}`);
}

function makeAuthEmailCodeHash(email: string, code: string) {
  return sha256(`auth-email-code:${AUTH_CODE_PEPPER}:${email.toLowerCase()}:${code}`);
}

function makeSmsCode() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

function makeEmailCode() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  const left = name.length <= 2 ? `${name[0] || '*'}*` : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${left}@${domain || ''}`;
}

function isTencentSmsConfigured() {
  return Boolean(TENCENTCLOUD_SECRET_ID && TENCENTCLOUD_SECRET_KEY && TENCENT_SMS_SDK_APP_ID && TENCENT_SMS_SIGN_NAME && TENCENT_SMS_TEMPLATE_ID);
}

function isTencentEmailConfigured() {
  return Boolean(
    TENCENTCLOUD_SECRET_ID &&
    TENCENTCLOUD_SECRET_KEY &&
    TENCENT_SES_FROM_EMAIL &&
    (TENCENT_SES_TEMPLATE_ID || TENCENT_SES_ALLOW_SIMPLE)
  );
}

function isSmsCodeLoginAvailable() {
  return isTencentSmsConfigured() || process.env.NODE_ENV !== 'production';
}

function isEmailCodeLoginAvailable() {
  return isTencentEmailConfigured() || process.env.NODE_ENV !== 'production';
}

async function sendTencentSmsCode(phone: string, code: string) {
  if (!isTencentSmsConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('短信服务未配置');
    console.log(`[短信验证码][dev] ${phone}: ${code}`);
    return { provider: 'dev-log' };
  }

  const imported = await import('tencentcloud-sdk-nodejs') as unknown as TencentCloudSdk & { default?: TencentCloudSdk };
  const tencentcloud = imported.default || imported;
  const SmsClient = tencentcloud.sms.v20210111.Client;
  const client = new SmsClient({
    credential: {
      secretId: TENCENTCLOUD_SECRET_ID,
      secretKey: TENCENTCLOUD_SECRET_KEY,
    },
    region: TENCENT_SMS_REGION,
    profile: {
      httpProfile: {
        endpoint: 'sms.tencentcloudapi.com',
        reqMethod: 'POST',
        reqTimeout: 10,
      },
    },
  });

  const response = await client.SendSms({
    SmsSdkAppId: TENCENT_SMS_SDK_APP_ID,
    SignName: TENCENT_SMS_SIGN_NAME,
    TemplateId: TENCENT_SMS_TEMPLATE_ID,
    TemplateParamSet: [code, String(SMS_CODE_TTL_MINUTES)],
    PhoneNumberSet: [`+86${phone}`],
  });
  const status = response?.SendStatusSet?.[0];
  if (status && status.Code && status.Code !== 'Ok') {
    throw new Error(status.Message || `短信发送失败：${status.Code}`);
  }
  return { provider: 'tencentcloud', serialNo: status?.SerialNo || null };
}

async function sendTencentEmailCode(email: string, code: string) {
  if (!isTencentEmailConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('邮箱验证码服务未配置');
    console.log(`[邮箱验证码][dev] ${email}: ${code}`);
    return { provider: 'dev-log', messageId: null };
  }

  const imported = await import('tencentcloud-sdk-nodejs') as unknown as TencentCloudSdk & { default?: TencentCloudSdk };
  const tencentcloud = imported.default || imported;
  const SesClient = tencentcloud.ses.v20201002.Client;
  const client = new SesClient({
    credential: {
      secretId: TENCENTCLOUD_SECRET_ID,
      secretKey: TENCENTCLOUD_SECRET_KEY,
    },
    region: TENCENT_SES_REGION,
    profile: {
      httpProfile: {
        endpoint: 'ses.tencentcloudapi.com',
        reqMethod: 'POST',
        reqTimeout: 10,
      },
    },
  });

  const params: Record<string, unknown> = {
    FromEmailAddress: TENCENT_SES_FROM_EMAIL,
    ReplyToAddresses: TENCENT_SES_REPLY_TO,
    Destination: [email],
    Subject: '剧幕录邮箱验证码',
    TriggerType: 1,
  };

  if (TENCENT_SES_TEMPLATE_ID) {
    params.Template = {
      TemplateID: Number(TENCENT_SES_TEMPLATE_ID),
      TemplateData: JSON.stringify({
        code,
        ttl: String(EMAIL_CODE_TTL_MINUTES),
        product: '剧幕录',
      }),
    };
  } else {
    const text = `您的剧幕录验证码是：${code}。${EMAIL_CODE_TTL_MINUTES} 分钟内有效。若非本人操作，请忽略本邮件。`;
    const html = `<html><body><p>您的剧幕录验证码是：</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p><p>${EMAIL_CODE_TTL_MINUTES} 分钟内有效。若非本人操作，请忽略本邮件。</p></body></html>`;
    params.Simple = {
      Text: Buffer.from(text, 'utf8').toString('base64'),
      Html: Buffer.from(html, 'utf8').toString('base64'),
    };
  }

  const response = await client.SendEmail(params);
  return { provider: 'tencentcloud-ses', messageId: response?.MessageId || null };
}

async function createAndSendPhoneCode(req: express.Request, project: 'lingqi' | 'juzhanggui', purpose: string, rawPhone: unknown) {
  const phone = normalizeChinaPhone(rawPhone);
  const phoneHash = makeAuthPhoneHash(phone);
  const { data: latest, error: latestErr } = await supabase.from('lc_auth_verification_codes')
    .select('id, created_at')
    .eq('project', project)
    .eq('purpose', purpose)
    .eq('phone_hash', phoneHash)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr && !isMissingRelation(latestErr, 'lc_auth_verification_codes')) throw latestErr;
  if (latest?.created_at && Date.now() - new Date(latest.created_at).getTime() < SMS_CODE_COOLDOWN_SECONDS * 1000) {
    throw new Error(`验证码已发送，请 ${SMS_CODE_COOLDOWN_SECONDS} 秒后再试`);
  }

  const code = makeSmsCode();
  const expiresAt = new Date(Date.now() + SMS_CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const { data: row, error: insertErr } = await supabase.from('lc_auth_verification_codes').insert({
    project,
    purpose,
    phone_hash: phoneHash,
    phone_last4: phone.slice(-4),
    code_hash: makeAuthCodeHash(phone, code),
    ip_address: getClientIp(req),
    user_agent: getUserAgent(req),
    expires_at: expiresAt,
  }).select('id').single();
  if (insertErr) throw insertErr;

  try {
    const result = await sendTencentSmsCode(phone, code);
    return { phone, expiresAt, provider: result.provider };
  } catch (sendErr) {
    if (row?.id) await supabase.from('lc_auth_verification_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);
    throw sendErr;
  }
}

async function createAndSendEmailCode(req: express.Request, project: 'lingqi' | 'juzhanggui', purpose: string, rawEmail: unknown) {
  const email = normalizeEmail(rawEmail);
  const emailHash = makeAuthEmailHash(email);
  const { data: latest, error: latestErr } = await supabase.from('lc_auth_verification_codes')
    .select('id, created_at')
    .eq('project', project)
    .eq('purpose', purpose)
    .eq('email_hash', emailHash)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) throw latestErr;
  if (latest?.created_at && Date.now() - new Date(latest.created_at).getTime() < EMAIL_CODE_COOLDOWN_SECONDS * 1000) {
    throw new Error(`邮箱验证码已发送，请 ${EMAIL_CODE_COOLDOWN_SECONDS} 秒后再试`);
  }

  const code = makeEmailCode();
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const domain = email.split('@')[1] || '';
  const { data: row, error: insertErr } = await supabase.from('lc_auth_verification_codes').insert({
    project,
    purpose,
    phone_hash: emailHash,
    phone_last4: null,
    email_hash: emailHash,
    email_mask: maskEmail(email),
    email_domain: domain,
    code_hash: makeAuthEmailCodeHash(email, code),
    ip_address: getClientIp(req),
    user_agent: getUserAgent(req),
    expires_at: expiresAt,
  }).select('id').single();
  if (insertErr) throw insertErr;

  try {
    const result = await sendTencentEmailCode(email, code);
    return { email, expiresAt, provider: result.provider };
  } catch (sendErr) {
    if (row?.id) await supabase.from('lc_auth_verification_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);
    throw sendErr;
  }
}

async function verifyPhoneCode(project: 'lingqi' | 'juzhanggui', purpose: string, rawPhone: unknown, rawCode: unknown) {
  const phone = normalizeChinaPhone(rawPhone);
  const code = typeof rawCode === 'string' ? rawCode.replace(/\D/g, '') : '';
  if (!/^\d{4,8}$/.test(code)) throw new Error('请填写正确的验证码');
  const phoneHash = makeAuthPhoneHash(phone);
  const { data: row, error: qErr } = await supabase.from('lc_auth_verification_codes')
    .select('id, code_hash, expires_at, attempts')
    .eq('project', project)
    .eq('purpose', purpose)
    .eq('phone_hash', phoneHash)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (qErr) throw qErr;
  if (!row) throw new Error('请先获取验证码');
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error('验证码已过期，请重新获取');
  if ((row.attempts || 0) >= 5) throw new Error('验证码错误次数过多，请重新获取');
  if (row.code_hash !== makeAuthCodeHash(phone, code)) {
    await supabase.from('lc_auth_verification_codes').update({ attempts: (row.attempts || 0) + 1 }).eq('id', row.id);
    throw new Error('验证码错误');
  }
  await supabase.from('lc_auth_verification_codes').update({
    attempts: (row.attempts || 0) + 1,
    consumed_at: new Date().toISOString(),
  }).eq('id', row.id);
  return phone;
}

async function verifyEmailCode(project: 'lingqi' | 'juzhanggui', purpose: string, rawEmail: unknown, rawCode: unknown) {
  const email = normalizeEmail(rawEmail);
  const code = typeof rawCode === 'string' ? rawCode.replace(/\D/g, '') : '';
  if (!/^\d{4,8}$/.test(code)) throw new Error('请填写正确的邮箱验证码');
  const emailHash = makeAuthEmailHash(email);
  const { data: row, error: qErr } = await supabase.from('lc_auth_verification_codes')
    .select('id, code_hash, expires_at, attempts')
    .eq('project', project)
    .eq('purpose', purpose)
    .eq('email_hash', emailHash)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (qErr) throw qErr;
  if (!row) throw new Error('请先获取邮箱验证码');
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error('邮箱验证码已过期，请重新获取');
  if ((row.attempts || 0) >= 5) throw new Error('邮箱验证码错误次数过多，请重新获取');
  if (row.code_hash !== makeAuthEmailCodeHash(email, code)) {
    await supabase.from('lc_auth_verification_codes').update({ attempts: (row.attempts || 0) + 1 }).eq('id', row.id);
    throw new Error('邮箱验证码错误');
  }
  await supabase.from('lc_auth_verification_codes').update({
    attempts: (row.attempts || 0) + 1,
    consumed_at: new Date().toISOString(),
  }).eq('id', row.id);
  return email;
}

function isWechatLoginConfigured() {
  return Boolean(WECHAT_OPEN_APP_ID && WECHAT_OPEN_APP_SECRET);
}

function safeFrontendRedirect(input: unknown) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
  return raw.slice(0, 120);
}

function makeWechatAuthorizeUrl(redirectPath: string, referralCode?: string) {
  const normalizedReferralCode = normalizeReferralCode(referralCode);
  const state = jwt.sign({ kind: 'lc_wechat_login', redirectPath, referralCode: normalizedReferralCode || undefined }, JWT_SECRET, { expiresIn: '10m' });
  const params = new URLSearchParams({
    appid: WECHAT_OPEN_APP_ID,
    redirect_uri: WECHAT_REDIRECT_URI,
    response_type: 'code',
    scope: 'snsapi_login',
    state,
  });
  return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`;
}

function normalizePemBlock(raw: string, label: 'PRIVATE KEY' | 'PUBLIC KEY') {
  const text = raw.trim().replace(/\\n/g, '\n');
  if (!text) return '';
  if (text.includes('-----BEGIN ')) return text;
  const compact = text.replace(/\s+/g, '');
  const lines = compact.match(/.{1,64}/g)?.join('\n') || compact;
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}

function isAlipayConfigured() {
  return Boolean(ALIPAY_APP_ID && ALIPAY_PRIVATE_KEY && ALIPAY_PUBLIC_KEY);
}

function formatAlipayTimestamp(date = new Date()) {
  const china = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return china.toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeAlipayParams(input: unknown) {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return Object.entries(body).reduce<Record<string, string>>((acc, [key, value]) => {
    if (Array.isArray(value)) acc[key] = String(value[0] ?? '');
    else if (value !== undefined && value !== null) acc[key] = String(value);
    else acc[key] = '';
    return acc;
  }, {});
}

function buildAlipaySignContent(params: Record<string, string>) {
  return Object.keys(params)
    .filter(key => key !== 'sign' && params[key] !== '')
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
}

function signAlipayParams(params: Record<string, string>) {
  const signer = createSign('RSA-SHA256');
  signer.update(buildAlipaySignContent(params), 'utf8');
  signer.end();
  return signer.sign(normalizePemBlock(ALIPAY_PRIVATE_KEY, 'PRIVATE KEY'), 'base64');
}

function verifyAlipayParams(params: Record<string, string>) {
  if (!params.sign || !ALIPAY_PUBLIC_KEY) return false;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(buildAlipaySignContent(params), 'utf8');
  verifier.end();
  return verifier.verify(normalizePemBlock(ALIPAY_PUBLIC_KEY, 'PUBLIC KEY'), params.sign, 'base64');
}

function makeAlipayOrderNo() {
  return `LQ${Date.now()}${randomInt(100000, 1000000)}`;
}

function parseRechargeAmount(input: unknown) {
  const amount = Number(input);
  if (!Number.isInteger(amount) || amount < 10) throw new Error('充值最低 10 契约币');
  if (amount > 500) throw new Error('单次充值最多 500 契约币');
  return amount;
}

function makePaymentExpiresAt(date = new Date()) {
  return new Date(date.getTime() + PAYMENT_ORDER_TTL_MINUTES * 60 * 1000);
}

function formatWechatPayTimeExpire(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function makeAlipayPayUrl(outTradeNo: string, amount: number) {
  const subject = `剧幕录契约币充值 ${amount}`;
  const params: Record<string, string> = {
    app_id: ALIPAY_APP_ID,
    method: 'alipay.trade.page.pay',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatAlipayTimestamp(),
    version: '1.0',
    notify_url: ALIPAY_NOTIFY_URL,
    return_url: ALIPAY_RETURN_URL,
    biz_content: JSON.stringify({
      out_trade_no: outTradeNo,
      total_amount: amount.toFixed(2),
      subject,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      timeout_express: `${PAYMENT_ORDER_TTL_MINUTES}m`,
    }),
  };
  params.sign = signAlipayParams(params);
  return {
    payUrl: `${ALIPAY_GATEWAY}?${new URLSearchParams(params).toString()}`,
    subject,
    totalAmount: amount.toFixed(2),
  };
}

function makeSafeAlipayPayload(params: Record<string, string>) {
  const allowlist = [
    'app_id', 'out_trade_no', 'trade_no', 'trade_status', 'total_amount',
    'receipt_amount', 'buyer_id', 'buyer_logon_id', 'seller_id',
    'notify_id', 'notify_time', 'gmt_payment',
  ];
  return allowlist.reduce<Record<string, string>>((acc, key) => {
    if (params[key]) acc[key] = params[key];
    return acc;
  }, {});
}

function isWechatPayConfigured() {
  return Boolean(
    WECHAT_PAY_APP_ID &&
    WECHAT_PAY_MCH_ID &&
    WECHAT_PAY_MCH_SERIAL_NO &&
    WECHAT_PAY_API_V3_KEY &&
    WECHAT_PAY_PRIVATE_KEY &&
    WECHAT_PAY_PUBLIC_KEY_ID &&
    WECHAT_PAY_PUBLIC_KEY,
  );
}

function assertWechatPayConfigured() {
  if (!isWechatPayConfigured()) throw new Error('微信支付尚未配置');
  if (Buffer.byteLength(WECHAT_PAY_API_V3_KEY, 'utf8') !== 32) {
    throw new Error('微信支付 APIv3 密钥长度必须为 32 字节');
  }
}

function makeWechatPayOrderNo() {
  return `LQWX${Date.now()}${randomInt(10000, 100000)}`;
}

function makeWechatPayNonce() {
  return randomBytes(16).toString('hex');
}

function signWechatPayRequest(method: string, pathWithQuery: string, body: string) {
  assertWechatPayConfigured();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = makeWechatPayNonce();
  const message = `${method.toUpperCase()}\n${pathWithQuery}\n${timestamp}\n${nonce}\n${body}\n`;
  const signer = createSign('RSA-SHA256');
  signer.update(message, 'utf8');
  signer.end();
  const signature = signer.sign(normalizePemBlock(WECHAT_PAY_PRIVATE_KEY, 'PRIVATE KEY'), 'base64');
  return `WECHATPAY2-SHA256-RSA2048 mchid="${WECHAT_PAY_MCH_ID}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${WECHAT_PAY_MCH_SERIAL_NO}"`;
}

function verifyWechatPaySignature(serial: string, signature: string, timestamp: string, nonce: string, body: string) {
  if (!serial || !signature || !timestamp || !nonce) return false;
  if (serial !== WECHAT_PAY_PUBLIC_KEY_ID) return false;
  const signedAt = Number(timestamp);
  if (!Number.isFinite(signedAt) || Math.abs(Date.now() / 1000 - signedAt) > 5 * 60) return false;
  const message = `${timestamp}\n${nonce}\n${body}\n`;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(message, 'utf8');
  verifier.end();
  return verifier.verify(normalizePemBlock(WECHAT_PAY_PUBLIC_KEY, 'PUBLIC KEY'), signature, 'base64');
}

function verifyWechatPayFetchResponse(headers: Headers, body: string) {
  return verifyWechatPaySignature(
    headers.get('wechatpay-serial') || '',
    headers.get('wechatpay-signature') || '',
    headers.get('wechatpay-timestamp') || '',
    headers.get('wechatpay-nonce') || '',
    body,
  );
}

async function wechatPayRequest<T>(method: 'GET' | 'POST', pathWithQuery: string, bodyParams?: Record<string, unknown>) {
  const body = bodyParams ? JSON.stringify(bodyParams) : '';
  const resp = await fetch(`${WECHAT_PAY_GATEWAY}${pathWithQuery}`, {
    method,
    headers: {
      Authorization: signWechatPayRequest(method, pathWithQuery, body),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Jumulu/1.0',
    },
    body: body || undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    let detail: string;
    try {
      const parsed = JSON.parse(text) as { message?: string; code?: string };
      detail = parsed.message || parsed.code || text || resp.statusText;
    } catch {
      detail = text || resp.statusText;
    }
    throw new Error(`微信支付接口失败(${resp.status})：${detail || resp.statusText}`);
  }
  if (!verifyWechatPayFetchResponse(resp.headers, text)) {
    throw new Error('微信支付应答验签失败');
  }
  return (text ? JSON.parse(text) : null) as T;
}

function makeWechatPayDescription(amount: number) {
  return `剧幕录契约币充值 ${amount}`;
}

async function createWechatPayNativeOrder(outTradeNo: string, amount: number, expiresAt = makePaymentExpiresAt()) {
  const description = makeWechatPayDescription(amount);
  const totalFee = amount * 100;
  const data = await wechatPayRequest<{ code_url?: string }>('POST', '/v3/pay/transactions/native', {
    appid: WECHAT_PAY_APP_ID,
    mchid: WECHAT_PAY_MCH_ID,
    description,
    out_trade_no: outTradeNo,
    time_expire: formatWechatPayTimeExpire(expiresAt),
    notify_url: WECHAT_PAY_NOTIFY_URL,
    attach: 'lingqi_wallet_recharge',
    amount: {
      total: totalFee,
      currency: 'CNY',
    },
  });
  if (!data?.code_url) throw new Error('微信支付未返回二维码链接');
  return { codeUrl: data.code_url, description, totalFee, expiresAt };
}

function decryptWechatPayResource(resource: Record<string, unknown>) {
  if (resource.algorithm !== 'AEAD_AES_256_GCM') throw new Error('微信支付回调加密算法不支持');
  const ciphertext = String(resource.ciphertext || '');
  const nonce = String(resource.nonce || '');
  const associatedData = String(resource.associated_data || '');
  if (!ciphertext || !nonce) throw new Error('微信支付回调密文缺失');
  const encrypted = Buffer.from(ciphertext, 'base64');
  if (encrypted.length <= 16) throw new Error('微信支付回调密文无效');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(WECHAT_PAY_API_V3_KEY, 'utf8'),
    Buffer.from(nonce, 'utf8'),
  );
  if (associatedData) decipher.setAAD(Buffer.from(associatedData, 'utf8'));
  decipher.setAuthTag(encrypted.subarray(encrypted.length - 16));
  const decrypted = Buffer.concat([
    decipher.update(encrypted.subarray(0, encrypted.length - 16)),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(decrypted) as Record<string, unknown>;
}

function makeSafeWechatPayPayload(transaction: Record<string, unknown>, notification: Record<string, unknown>) {
  return {
    appid: transaction.appid || null,
    mchid: transaction.mchid || null,
    out_trade_no: transaction.out_trade_no || null,
    transaction_id: transaction.transaction_id || null,
    trade_type: transaction.trade_type || null,
    trade_state: transaction.trade_state || null,
    trade_state_desc: transaction.trade_state_desc || null,
    bank_type: transaction.bank_type || null,
    success_time: transaction.success_time || null,
    payer: transaction.payer || null,
    amount: transaction.amount || null,
    notify_id: notification.id || null,
    notify_time: notification.create_time || null,
    event_type: notification.event_type || null,
  };
}

async function expireStalePaymentRecharges(profileId?: string | null) {
  try {
    const { data, error } = await supabase.rpc('lc_expire_stale_payment_recharges', {
      p_profile_id: profileId || null,
      p_ttl_minutes: PAYMENT_ORDER_TTL_MINUTES,
    });
    if (error) {
      if (!isMissingRelation(error, 'lc_expire_stale_payment_recharges')) {
        console.error('[wallet] expire stale payments failed', getErrorText(error));
      }
      return 0;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return Number(row?.expired_count || 0);
  } catch (expireErr) {
    console.error('[wallet] expire stale payments failed', getErrorText(expireErr));
    return 0;
  }
}

async function logSecurityEvent(req: express.Request, args: {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const actorId = args.actorId ?? ((req as Record<string, unknown>).creatorId as string | undefined) ?? null;
    const actorRole = args.actorRole ?? ((req as Record<string, unknown>).role as string | undefined) ?? 'anonymous';
    const { error: logErr } = await supabase.from('lc_security_events').insert({
      actor_id: actorId,
      actor_role: actorRole,
      action: args.action,
      target_type: args.targetType || null,
      target_id: args.targetId || null,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      request_path: req.originalUrl || req.url,
      metadata: args.metadata || {},
    });
    if (logErr && !isMissingRelation(logErr, 'lc_security_events')) {
      console.error('[security-log] insert failed', getErrorText(logErr));
    }
  } catch (logErr) {
    console.error('[security-log] insert failed', getErrorText(logErr));
  }
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

const OPTIONAL_URL_PLACEHOLDERS = new Set(['?', '？', '-', '—', '无', '没有', '暂无', '待补', '不填']);

function normalizeOptionalPublicUrl(value: unknown, max: number, allowUploadPath = false) {
  const raw = cleanText(value, max);
  if (!raw || OPTIONAL_URL_PLACEHOLDERS.has(raw)) return '';
  if (allowUploadPath && /^\/uploads\/[A-Za-z0-9%_./-]+(?:\?[^\s]*)?$/i.test(raw)) return raw;
  const candidate = /^https?:\/\//i.test(raw)
    ? raw
    : /^(?:www\.)?[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:[/:?#]|$)/.test(raw)
      ? `https://${raw}`
      : '';
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function isOptionalUrlPlaceholder(value: unknown) {
  const raw = cleanText(value, 800);
  return !raw || OPTIONAL_URL_PLACEHOLDERS.has(raw);
}

type ModerationPrecheckDecision = 'pass' | 'review' | 'block';
type ModerationPrecheckMatch = {
  label: string;
  severity: ModerationPrecheckDecision;
  field: string;
  excerpt: string;
};

type ModerationPrecheckInput = {
  scene: string;
  targetType: string;
  texts: Record<string, unknown>;
  files?: unknown;
  allowContact?: boolean;
};

const LOCAL_MODERATION_RULES: Array<{
  label: string;
  severity: ModerationPrecheckDecision;
  pattern: RegExp;
}> = [
  { label: 'identity_number', severity: 'block', pattern: /\b[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g },
  { label: 'doxxing_or_privacy', severity: 'block', pattern: /(开盒|人肉|身份证|家庭住址|户籍|住址|泄露隐私|偷拍视频|偷拍视频|偷拍视频)/g },
  { label: 'illegal_or_crime', severity: 'block', pattern: /(诈骗|赌博|毒品|枪支|卖淫|嫖娼|性交易|洗钱|套现|代开票|伪造证件|网暴|威胁恐吓)/g },
  { label: 'minor_high_risk', severity: 'block', pattern: /(未成年|小学生|初中生|未满十八|未满18|萝莉|正太).{0,12}(约|睡|性|黄色|陪睡|裸)/g },
  { label: 'phone_or_contact', severity: 'review', pattern: /(?:\+?86[-\s]?)?1[3-9]\d{9}/g },
  { label: 'wechat_or_qq', severity: 'review', pattern: /(微信|VX|vx|V信|企鹅|QQ|qq)[:：\s-]*[A-Za-z0-9_-]{5,}/g },
  { label: 'abuse_or_attack', severity: 'review', pattern: /(傻逼|煞笔|贱人|死妈|滚蛋|垃圾人|去死|婊子|人渣|烂人|畜生)/g },
  { label: 'rumor_or_defamation_risk', severity: 'review', pattern: /(听说|据说|群里说|别人说|网传|瓜说|没有证据|纯主观|造谣|挂人)/g },
  { label: 'sexual_content', severity: 'review', pattern: /(约炮|陪睡|裸聊|口交|做爱|上床|黄色服务|擦边|包夜)/g },
];

function maskModerationExcerpt(value: string) {
  return value
    .replace(/\b([1-9]\d{5})(\d{8})(\d{3}[\dXx])\b/g, '$1********$3')
    .replace(/(1[3-9])\d{4}(\d{4})/g, '$1****$2')
    .slice(0, 80);
}

function moderationDecisionRank(decision: ModerationPrecheckDecision) {
  return decision === 'block' ? 3 : decision === 'review' ? 2 : 1;
}

function collectImageEvidenceStats(files: unknown) {
  const list = Array.isArray(files) ? files : [];
  const images = list.filter(item => {
    if (typeof item === 'string') return item.startsWith('data:image/') || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(item);
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    const url = cleanText(record.url, 100);
    const type = cleanText(record.type, 100);
    return url.startsWith('data:image/') || type.startsWith('image/') || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);
  });
  const dataUrlBytes = images.reduce((sum, item) => {
    const url = typeof item === 'string' ? item : cleanText((item as Record<string, unknown>).url, 8 * 1024 * 1024);
    return sum + (url.startsWith('data:image/') ? Math.ceil(url.length * 0.75) : 0);
  }, 0);
  return { image_count: images.length, data_url_bytes: dataUrlBytes };
}

function runLocalModerationPrecheck(input: ModerationPrecheckInput) {
  const matches: ModerationPrecheckMatch[] = [];
  for (const [field, value] of Object.entries(input.texts)) {
    const text = cleanText(value, 6000);
    if (!text) continue;
    for (const rule of LOCAL_MODERATION_RULES) {
      if (input.allowContact && (rule.label === 'phone_or_contact' || rule.label === 'wechat_or_qq')) continue;
      const found = Array.from(text.matchAll(rule.pattern)).slice(0, 3);
      for (const item of found) {
        matches.push({
          label: rule.label,
          severity: rule.severity,
          field,
          excerpt: maskModerationExcerpt(item[0] || ''),
        });
      }
    }
  }

  const imageStats = collectImageEvidenceStats(input.files);
  if (imageStats.image_count > 0) {
    matches.push({
      label: 'image_needs_manual_review',
      severity: 'review',
      field: 'files',
      excerpt: `${imageStats.image_count} 张图片，当前仅做本地留痕，需人工查看打码和内容`,
    });
  }

  const decision = matches.reduce<ModerationPrecheckDecision>(
    (current, item) => moderationDecisionRank(item.severity) > moderationDecisionRank(current) ? item.severity : current,
    'pass',
  );
  const labels = Array.from(new Set(matches.map(item => item.label)));
  const textForHash = Object.entries(input.texts)
    .map(([field, value]) => `${field}:${cleanText(value, 6000)}`)
    .join('\n');
  const score = Math.min(100, matches.reduce((sum, item) => sum + (item.severity === 'block' ? 40 : 18), 0));
  return {
    version: 'local_rules_v1',
    provider: 'local',
    scene: input.scene,
    target_type: input.targetType,
    decision,
    risk_score: score,
    risk_labels: labels,
    matches: matches.slice(0, 20),
    summary: decision === 'pass'
      ? '本地预审未发现明显风险'
      : decision === 'block'
        ? '本地预审发现高风险内容，建议人工优先复核'
        : '本地预审发现需关注内容，建议人工审核时重点查看',
    image_count: imageStats.image_count,
    data_url_bytes: imageStats.data_url_bytes,
    checked_at: new Date().toISOString(),
    text_hash: sha256(textForHash),
    paid_provider: 'not_enabled',
  };
}

function normalizeDmLookupText(value: unknown) {
  return cleanText(value, 240)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s·•・._—–/\\|,，、()（）【】-]+/g, '')
    .replaceAll('[', '')
    .replaceAll(']', '');
}

function dmLookupBigrams(value: string) {
  if (value.length < 2) return value ? [value] : [];
  return Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2));
}

function dmLookupSimilarity(left: unknown, right: unknown) {
  const a = normalizeDmLookupText(left);
  const b = normalizeDmLookupText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.82;
  const leftPairs = dmLookupBigrams(a);
  const rightPairs = dmLookupBigrams(b);
  if (!leftPairs.length || !rightPairs.length) return 0;
  const counts = new Map<string, number>();
  rightPairs.forEach(pair => counts.set(pair, (counts.get(pair) || 0) + 1));
  let overlap = 0;
  leftPairs.forEach(pair => {
    const count = counts.get(pair) || 0;
    if (count > 0) {
      overlap += 1;
      counts.set(pair, count - 1);
    }
  });
  return (2 * overlap) / (leftPairs.length + rightPairs.length);
}

function rankSimilarDmDossiers(
  source: Record<string, unknown>,
  candidates: Record<string, unknown>[],
) {
  return candidates
    .filter(candidate => String(candidate.id || '') !== String(source.id || ''))
    .map(candidate => {
      const nameScore = dmLookupSimilarity(source.dm_name, candidate.dm_name);
      const workplaceScore = dmLookupSimilarity(source.workplace, candidate.workplace);
      const sameCity = normalizeDmLookupText(source.city) === normalizeDmLookupText(candidate.city);
      const score = Math.round((nameScore * 70) + (workplaceScore * 18) + (sameCity ? 12 : 0));
      return {
        id: candidate.id,
        dm_name: candidate.dm_name,
        city: candidate.city,
        workplace: candidate.workplace,
        photo_url: candidate.photo_url,
        score,
      };
    })
    .filter(candidate => candidate.score >= 38)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function dmRatingContentFingerprint(value: unknown) {
  const normalized = cleanText(value, 2400)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
  return normalized ? sha256(normalized) : '';
}

function dmRatingIpHash(req: express.Request) {
  return sha256(`${AUTH_CODE_PEPPER}:dm-rating:${getClientIp(req)}`);
}

function storeRatingIpHash(req: express.Request) {
  return sha256(`${AUTH_CODE_PEPPER}:store-rating:${getClientIp(req)}`);
}

type PublicReviewTargetType =
  | 'profile_update'
  | 'service_create'
  | 'portfolio_create'
  | 'availability_create'
  | 'tag_create'
  | 'script_rating_upsert'
  | 'entity_rating_upsert';

type PublicReviewRecord = {
  id: string;
  target_type: PublicReviewTargetType;
  profile_id?: string | null;
  profile_name?: string | null;
  title?: string | null;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  status?: 'pending' | 'approved' | 'rejected';
  moderation_precheck?: ReturnType<typeof runLocalModerationPrecheck> | null;
};

async function createPublicReview(input: {
  targetType: PublicReviewTargetType;
  profile: Record<string, unknown>;
  title: string;
  summary?: string;
  payload: Record<string, unknown>;
  moderationPrecheck?: ReturnType<typeof runLocalModerationPrecheck> | null;
}) {
  const { data, error: insertErr } = await supabase.from('lc_public_reviews').insert({
    target_type: input.targetType,
    profile_id: input.profile.id,
    profile_name: cleanText(input.profile.display_name, 120) || '用户',
    title: cleanText(input.title, 160),
    summary: cleanText(input.summary, 1000) || null,
    payload: input.payload,
    status: 'pending',
    moderation_precheck: input.moderationPrecheck || null,
  }).select('*').single();
  if (insertErr && isMissingRelation(insertErr, 'lc_public_reviews')) {
    throw new Error('公开内容审核表尚未初始化');
  }
  if (insertErr) throw insertErr;
  return data;
}

function publicReviewAcceptedResponse(review: Record<string, unknown>) {
  return {
    id: review.id,
    review_id: review.id,
    status: 'pending',
    message: '已提交审核，通过后才会公开展示',
  };
}

function objectPayload(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function payloadItems(payload: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(payload.items)
    ? payload.items.filter(item => item && typeof item === 'object').map(item => item as Record<string, unknown>)
    : [payload];
}

function normalizePositiveIntegerField(value: unknown, max = 999999) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value <= 0 || value > max) return null;
    return value;
  }
  const text = cleanText(value, 20);
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= max ? parsed : null;
}

function normalizeDateString(value: unknown) {
  const text = cleanText(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const [year, month, day] = text.split('-').map(Number);
  return buildDateString(year, month, day);
}

function addDaysToDateString(dateText: string, days: number) {
  const base = normalizeDateString(dateText) || todayChinaDateString();
  const [year, month, day] = base.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return buildDateString(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function normalizeAvailabilityDateList(input: unknown, fallback?: unknown) {
  const raw = Array.isArray(input) ? input : [fallback];
  const seen = new Set<string>();
  const today = todayChinaDateString();
  const dates: string[] = [];
  const expiredDates: string[] = [];
  const invalidDates: string[] = [];
  for (const item of raw) {
    const date = normalizeDateString(item);
    if (!date) {
      const text = cleanText(item, 40);
      if (text) invalidDates.push(text);
      continue;
    }
    if (date < today) {
      expiredDates.push(date);
      continue;
    }
    if (!seen.has(date)) {
      seen.add(date);
      dates.push(date);
    }
  }
  return { dates, expiredDates, invalidDates };
}

function normalizeServiceSubmission(input: Record<string, unknown>, creatorId: string) {
  const serviceType = cleanText(input.serviceType ?? input.service_type, 80);
  const price = normalizePositiveIntegerField(input.price, 999999);
  if (!serviceType || price === null) return null;
  return {
    creator_id: creatorId,
    service_type: serviceType,
    price,
    duration: cleanText(input.duration, 120) || null,
    description: cleanText(input.description, 1000) || null,
  };
}

async function applyProfileUpdateReview(review: PublicReviewRecord) {
  const payload = review.payload || {};
  const profilePatch = (payload.profile_patch && typeof payload.profile_patch === 'object')
    ? payload.profile_patch as Record<string, unknown>
    : {};
  const rolePreferences = Array.isArray(payload.role_preferences) ? payload.role_preferences as Record<string, unknown>[] : null;
  if (!review.profile_id) throw new Error('审核记录缺少用户 ID');
  if (Object.keys(profilePatch).length > 0) {
    const { error: profileErr } = await supabase.from('lc_profiles').update({
      ...profilePatch,
      updated_at: new Date().toISOString(),
    }).eq('id', review.profile_id);
    if (profileErr) throw profileErr;
  }
  if (rolePreferences) {
    const { error: deleteErr } = await supabase.from('lc_profile_role_preferences')
      .delete()
      .eq('profile_id', review.profile_id);
    if (deleteErr && !isMissingRelation(deleteErr, 'lc_profile_role_preferences')) throw deleteErr;
    if (!deleteErr && rolePreferences.length > 0) {
      const { error: insertErr } = await supabase.from('lc_profile_role_preferences').insert(
        rolePreferences.map((item, index) => ({
          profile_id: review.profile_id,
          script_id: item.script_id,
          script_name: item.script_name,
          role_name: item.role_name,
          role_gender: item.role_gender,
          role_tags: item.role_tags,
          is_recommended: item.is_recommended,
          note: item.note,
          sort_order: index,
          updated_at: new Date().toISOString(),
        })),
      );
      if (insertErr) throw insertErr;
    }
  }
}

async function applyPublicReview(review: PublicReviewRecord) {
  const payload = objectPayload(review.payload);
  if (review.target_type === 'profile_update') {
    await applyProfileUpdateReview(review);
    if (review.profile_id) await runReferralSideEffect('stage1-after-profile-review-approved', () => maybeAwardReferralStage1(String(review.profile_id)));
    return;
  }
  if (review.target_type === 'service_create') {
    const items = payloadItems(payload);
    const rows = items.map(item => {
      const price = normalizePositiveIntegerField(item.price, 999999);
      return {
        creator_id: cleanText(item.creator_id ?? payload.creator_id, 80),
        service_type: cleanText(item.service_type ?? item.serviceType, 80),
        price,
        duration: cleanText(item.duration, 120) || null,
        description: cleanText(item.description, 1000) || null,
      };
    }).filter(item => item.creator_id && item.service_type && item.price !== null);
    if (rows.length === 0) throw new Error('审核记录缺少服务项目');
    const { error: insertErr } = await supabase.from('lc_services').insert(rows);
    if (insertErr) throw insertErr;
    const creatorIds = Array.from(new Set(rows.map(row => row.creator_id)));
    for (const creatorId of creatorIds) {
      await addProfileIdentityRoles(creatorId, identityRolesFromServices(rows.filter(row => row.creator_id === creatorId).map(row => row.service_type)));
    }
    return;
  }
  if (review.target_type === 'portfolio_create') {
    const { error: insertErr } = await supabase.from('lc_portfolio').insert({
      creator_id: payload.creator_id,
      image_url: payload.image_url,
      caption: payload.caption || null,
    });
    if (insertErr) throw insertErr;
    return;
  }
  if (review.target_type === 'availability_create') {
    const items = payloadItems(payload);
    const rows = items.map(item => ({
      creator_id: cleanText(item.creator_id, 80),
      date: normalizeDateString(item.date),
      start_time: normalizeClockTime(item.start_time, '09:00'),
      end_time: normalizeClockTime(item.end_time, '22:00'),
      note: cleanText(item.note, 500) || null,
      city: cleanText(item.city, 80) || null,
      location: cleanText(item.location, 120) || null,
      is_booked: false,
      source: cleanText(item.source, 40) || 'manual',
      source_id: cleanText(item.source_id, 160) || null,
      source_payload: item.source_payload || null,
    })).filter(item => item.creator_id && item.date);
    if (rows.length === 0) throw new Error('审核记录缺少档期日期');
    const dedupedRows = [];
    for (const row of rows) {
      const { data: existing, error: existingErr } = await supabase.from('lc_availability')
        .select('id')
        .eq('creator_id', row.creator_id)
        .eq('date', row.date)
        .eq('is_booked', false)
        .maybeSingle();
      if (existingErr) throw existingErr;
      if (!existing) dedupedRows.push(row);
    }
    if (dedupedRows.length === 0) return;
    const { error: insertErr } = await supabase.from('lc_availability').insert(dedupedRows);
    if (insertErr) throw insertErr;
    return;
  }
  if (review.target_type === 'tag_create') {
    const existing = await supabase.from('lc_entity_tags')
      .select('id')
      .eq('target_type', payload.target_type)
      .eq('target_id', payload.target_id)
      .eq('normalized_tag', payload.normalized_tag)
      .maybeSingle();
    if (existing.error && !isMissingRelation(existing.error, 'lc_entity_tags')) throw existing.error;
    if (existing.data) return;
    const { error: insertErr } = await supabase.from('lc_entity_tags').insert({
      target_type: payload.target_type,
      target_id: payload.target_id,
      tag: payload.tag,
      normalized_tag: payload.normalized_tag,
      creator_id: payload.creator_id,
      creator_name: payload.creator_name,
      status: 'approved',
    });
    if (insertErr) throw insertErr;
    return;
  }
  if (review.target_type === 'script_rating_upsert') {
    const { error: upsertErr } = await supabase.from('lc_script_ratings').upsert({
      script_id: payload.script_id,
      script_name: payload.script_name,
      profile_id: payload.profile_id,
      profile_name: payload.profile_name,
      rating: payload.rating,
      content: payload.content || '',
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      status: 'approved',
      moderation_precheck: review.moderation_precheck || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'script_id,profile_id' });
    if (upsertErr) throw upsertErr;
    return;
  }
  if (review.target_type === 'entity_rating_upsert') {
    const { error: upsertErr } = await supabase.from('lc_entity_ratings').upsert({
      target_type: payload.target_type,
      target_id: payload.target_id,
      target_title: payload.target_title,
      profile_id: payload.profile_id,
      profile_name: payload.profile_name,
      rating: payload.rating,
      content: payload.content || '',
      spoiler_level: payload.spoiler_level || 'none',
      entity_metadata: payload.entity_metadata || {},
      status: 'approved',
      moderation_precheck: review.moderation_precheck || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'target_type,target_id,profile_id' });
    if (upsertErr) throw upsertErr;
    return;
  }
  throw new Error('未知公开审核类型');
}

function getChinaNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value || '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
  };
}

function dateText(value: unknown) {
  const text = cleanText(value, 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function isPastDate(dateValue: unknown, timeValue?: unknown) {
  const date = dateText(dateValue);
  if (!date) return false;
  const now = getChinaNow();
  if (date < now.date) return true;
  if (date > now.date) return false;
  const time = cleanText(timeValue, 8);
  return /^\d{2}:\d{2}$/.test(time) && time < now.time;
}

function isCommissionExpired(row: Record<string, unknown>) {
  return isPastDate(row.needed_date);
}

function isCarpoolExpired(row: Record<string, unknown>) {
  if (dateText(row.deadline_date)) return isPastDate(row.deadline_date, row.deadline_time);
  return isPastDate(row.event_date);
}

function withCommissionExpiration(rows: Record<string, unknown>[]) {
  return rows.map(row => ({ ...row, is_expired: isCommissionExpired(row) }));
}

function withCarpoolExpiration(rows: Record<string, unknown>[]) {
  return rows.map(row => ({ ...row, is_expired: isCarpoolExpired(row) }));
}

const PROFILE_GENDER_OPTIONS = ['男', '女', '其他', '不公开'];
const PROFILE_ORIENTATION_OPTIONS = ['异性恋', '同性恋', '双性恋', '泛性恋', '无性恋', '其他', '不公开'];

type CarpoolRoleStatus = 'needed' | 'seated';
type CarpoolRoleDraft = {
  role_name: string;
  gender: string | null;
  tags: string[];
  status: CarpoolRoleStatus;
  player_name?: string | null;
  player_gender?: string | null;
};

type ProfileRolePreferenceDraft = {
  script_id: string | null;
  script_name: string;
  role_name: string;
  role_gender: string | null;
  role_tags: string[];
  is_recommended: boolean;
  note: string;
  sort_order: number;
};

const SCRIPT_CONTRIBUTION_REWARD = 5;
const CERTIFICATION_TYPES = ['realname', 'dm', 'shop'];
const REALNAME_WATERMARK_TEXT = '仅用于剧幕录实名认证';

function cleanChoice(value: unknown, allowed: string[]) {
  const text = cleanText(value, 40);
  if (!text) return null;
  return allowed.includes(text) ? text : '其他';
}

function cleanTextArray(value: unknown, maxItems = 12, maxLength = 24) {
  const raw = Array.isArray(value)
    ? value
    : (typeof value === 'string' ? value.split(/[，,、/\n]/) : []);
  return Array.from(new Set(raw
    .map(item => cleanText(item, maxLength))
    .filter(Boolean)))
    .slice(0, maxItems);
}

const SCRIPT_CREDIT_FIELDS = [
  'authors',
  'publisher',
  'supervisor',
] as const;

function sanitizeScriptCredits(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const record = input as Record<string, unknown>;
  return SCRIPT_CREDIT_FIELDS.reduce<Record<string, string[]>>((acc, key) => {
    const values = cleanTextArray(record[key], 16, 60);
    if (values.length > 0) acc[key] = values;
    return acc;
  }, {});
}

function normalizeRoleKey(value: unknown) {
  return cleanText(value, 80).replace(/\s+/g, '').toLowerCase();
}

function uuidText(value: unknown) {
  const text = cleanText(value, 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : '';
}

function sanitizeCarpoolRoles(input: unknown, fallbackRoleName?: string, fallbackRoleNote?: string): CarpoolRoleDraft[] {
  const source = Array.isArray(input) ? input : [];
  const roles = source.map((raw) => {
    const item = raw as Record<string, unknown>;
    const roleName = cleanText(item.role_name ?? item.name ?? item.roleName, 80);
    if (!roleName) return null;
    const status = item.status === 'seated' ? 'seated' : 'needed';
    return {
      role_name: roleName,
      gender: cleanText(item.gender ?? item.role_gender ?? item.roleGender, 20) || null,
      tags: cleanTextArray(item.tags, 8, 18),
      status,
      player_name: cleanText(item.player_name ?? item.playerName, 60) || null,
      player_gender: cleanText(item.player_gender ?? item.playerGender, 20) || null,
    };
  }).filter(Boolean) as CarpoolRoleDraft[];

  if (roles.length > 0) {
    return roles.slice(0, 30);
  }

  const roleName = cleanText(fallbackRoleName, 80);
  if (!roleName) return [];
  return [{
    role_name: roleName,
    gender: null,
    tags: [],
    status: 'needed',
    player_name: cleanText(fallbackRoleNote, 60) || null,
    player_gender: null,
  }];
}

function hasMissingScriptContributionGender(roles: CarpoolRoleDraft[]) {
  return roles.some(role => !role.gender);
}

function roleSummary(roles: CarpoolRoleDraft[], status: CarpoolRoleStatus) {
  return roles
    .filter(role => role.status === status)
    .map(role => role.gender ? `${role.role_name}(${role.gender})` : role.role_name)
    .join('、');
}

type RatingSummary = { avg: number | null; count: number };
type ScriptRoleSource = 'player' | 'actor';
type ScriptRoleEntity = {
  targetId: string;
  scriptId: string;
  scriptName: string;
  roleId: string;
  roleName: string;
  roleGender: string | null;
  roleKind: string;
  roleSource: ScriptRoleSource;
  targetTitle: string;
};

function summarizeRatingValues(values: number[]): RatingSummary {
  const cleanValues = values.filter(value => Number.isFinite(value) && value >= 1 && value <= 5);
  if (cleanValues.length === 0) return { avg: null, count: 0 };
  const sum = cleanValues.reduce((total, value) => total + value, 0);
  return {
    avg: Math.round((sum / cleanValues.length) * 10) / 10,
    count: cleanValues.length,
  };
}

function roleKindLabel(kindInput: unknown) {
  const kind = cleanText(kindInput, 40);
  if (kind === 'player') return '玩家角色';
  if (kind === 'dm') return 'DM';
  if (kind === 'field_control') return '场控';
  if (kind === 'npc') return 'NPC';
  if (kind === 'assistant') return '演绎协作';
  if (kind === 'actor') return '演绎角色';
  return kind || '角色';
}

function buildRatingMap(rows: Record<string, unknown>[] | null | undefined, idField = 'target_id') {
  const buckets = new Map<string, number[]>();
  for (const row of rows || []) {
    const id = cleanText(row[idField], 120);
    if (!id) continue;
    const list = buckets.get(id) || [];
    list.push(Number(row.rating || 0));
    buckets.set(id, list);
  }
  return new Map(Array.from(buckets.entries()).map(([id, values]) => [id, summarizeRatingValues(values)]));
}

async function getScriptRoleEntity(targetIdInput: unknown): Promise<ScriptRoleEntity | null> {
  const targetId = cleanText(targetIdInput, 160);
  if (targetId.startsWith('shared:')) {
    const found = findSharedRole(await loadSharedScriptCatalog(), targetId);
    if (!found) return null;
    const { script, role } = found;
    const targetTitle = `${script.name} · ${role.role_name} · ${roleKindLabel(role.role_kind)}`;
    return {
      targetId,
      scriptId: script.id,
      scriptName: script.name,
      roleId: role.id,
      roleName: role.role_name,
      roleGender: role.gender || null,
      roleKind: role.role_kind,
      roleSource: role.role_source,
      targetTitle,
    };
  }
  const [source, roleId] = targetId.split(':');
  if ((source !== 'player' && source !== 'actor') || !uuidText(roleId)) return null;

  const table = source === 'player' ? 'script_player_roles' : 'script_actor_roles';
  const select = source === 'player'
    ? 'id, script_id, role_name, gender, tags'
    : 'id, script_id, role_name, gender, role_kind';
  const { data: role, error: roleErr } = await supabase.from(table)
    .select(select)
    .eq('id', roleId)
    .maybeSingle();
  if (roleErr && isMissingRelation(roleErr, table)) return null;
  if (roleErr && source === 'actor' && getErrorText(roleErr).includes('role_kind')) {
    const fallback = await supabase.from(table)
      .select('id, script_id, role_name, gender')
      .eq('id', roleId)
      .maybeSingle();
    if (fallback.error && isMissingRelation(fallback.error, table)) return null;
    if (fallback.error) throw fallback.error;
    return getScriptRoleEntityFromRow(targetId, source, fallback.data as Record<string, unknown> | null);
  }
  if (roleErr) throw roleErr;
  return getScriptRoleEntityFromRow(targetId, source, role as Record<string, unknown> | null);
}

async function getScriptRoleEntityFromRow(targetId: string, source: ScriptRoleSource, role: Record<string, unknown> | null) {
  if (!role) return null;
  const scriptId = uuidText(role.script_id);
  const roleName = cleanText(role.role_name, 120);
  if (!scriptId || !roleName) return null;
  const { data: script, error: scriptErr } = await supabase.from('scripts')
    .select('id, name')
    .eq('tenant_id', JUZHANGGUI_TENANT_ID)
    .eq('id', scriptId)
    .maybeSingle();
  if (scriptErr && isMissingRelation(scriptErr, 'scripts')) return null;
  if (scriptErr) throw scriptErr;
  if (!script) return null;
  const scriptName = cleanText((script as Record<string, unknown>).name, 160) || '未命名剧本';
  const roleKind = source === 'player' ? 'player' : cleanText(role.role_kind, 40) || 'dm';
  const targetTitle = `${scriptName} · ${roleName} · ${roleKindLabel(roleKind)}`;
  return {
    targetId,
    scriptId,
    scriptName,
    roleId: cleanText(role.id, 80),
    roleName,
    roleGender: cleanText(role.gender, 20) || null,
    roleKind,
    roleSource: source,
    targetTitle,
  };
}

async function sanitizeProfileRolePreferences(input: unknown): Promise<ProfileRolePreferenceDraft[]> {
  const source = Array.isArray(input) ? input : [];
  const scriptIds = Array.from(new Set(source
    .map(raw => uuidText((raw as Record<string, unknown>).script_id ?? (raw as Record<string, unknown>).scriptId))
    .filter(Boolean)));
  if (scriptIds.length === 0) return [];

  const catalog = await loadSharedScriptCatalog();
  const scriptMap = new Map<string, { id: string; name: string; roles: CarpoolRoleDraft[] }>(catalog
    .filter(script => scriptIds.includes(script.id))
    .map(script => [script.id, {
      id: script.id,
      name: script.name,
      roles: script.player_roles.map(role => ({
        role_name: role.role_name,
        gender: role.gender || '',
        tags: role.tags || [],
        status: 'needed' as const,
      })),
    }]));
  const seen = new Map<string, ProfileRolePreferenceDraft>();

  source.slice(0, 50).forEach((raw, index) => {
    const item = raw as Record<string, unknown>;
    const scriptId = uuidText(item.script_id ?? item.scriptId);
    const script = scriptMap.get(scriptId);
    const roleName = cleanText(item.role_name ?? item.roleName, 80);
    if (!script || !roleName) return;
    const role = script.roles.find(candidate => normalizeRoleKey(candidate.role_name) === normalizeRoleKey(roleName));
    if (!role) return;
    const key = `${script.id}:${normalizeRoleKey(role.role_name)}`;
    const draft: ProfileRolePreferenceDraft = {
      script_id: script.id,
      script_name: script.name,
      role_name: role.role_name,
      role_gender: role.gender || null,
      role_tags: role.tags || [],
      is_recommended: item.is_recommended === true || item.recommended === true,
      note: cleanText(item.note, 200),
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : index,
    };
    const existing = seen.get(key);
    if (existing) {
      seen.set(key, {
        ...existing,
        role_gender: existing.role_gender || draft.role_gender,
        role_tags: Array.from(new Set([...existing.role_tags, ...draft.role_tags])).slice(0, 8),
        is_recommended: existing.is_recommended || draft.is_recommended,
        note: existing.note || draft.note,
      });
    } else {
      seen.set(key, draft);
    }
  });

  return Array.from(seen.values())
    .slice(0, 40)
    .map((item, index) => ({ ...item, sort_order: index }));
}

async function loadProfileRolePreferences(profileId: string) {
  const { data, error: qErr } = await supabase.from('lc_profile_role_preferences')
    .select('id, profile_id, script_id, script_name, role_name, role_gender, role_tags, is_recommended, note, sort_order')
    .eq('profile_id', profileId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (qErr && isMissingRelation(qErr, 'lc_profile_role_preferences')) return [];
  if (qErr) throw qErr;
  return data || [];
}

async function getActiveStore(storeIdInput: unknown) {
  const storeId = cleanText(storeIdInput, 80);
  if (!storeId) return null;
  const { data, error: qErr } = await supabase.from('jzg_stores')
    .select('id, name, city, address, status')
    .eq('id', storeId)
    .eq('status', 'active')
    .maybeSingle();
  if (qErr && isMissingRelation(qErr, 'jzg_stores')) return null;
  if (qErr) throw qErr;
  return data as Record<string, unknown> | null;
}

async function ensureSharedScriptForCarpool(scriptIdInput: unknown, scriptNameInput: unknown, rolesInput: CarpoolRoleDraft[]) {
  const requestedScriptId = cleanText(scriptIdInput, 80);
  const requestedScriptName = cleanText(scriptNameInput, 100);
  const script = findSharedScript(await loadSharedScriptCatalog(), requestedScriptId, requestedScriptName);
  if (!script) {
    if (!requestedScriptName) throw new Error('请填写本名');
    return {
      scriptId: null,
      scriptName: requestedScriptName,
      scriptRoles: rolesInput,
    };
  }

  const catalogRoles: CarpoolRoleDraft[] = script.player_roles.map(role => ({
    role_name: role.role_name,
    gender: role.gender || '',
    tags: role.tags || [],
    status: 'needed',
  }));
  const catalogByName = new Map(catalogRoles.map(role => [normalizeRoleKey(role.role_name), role]));
  const finalRoles = rolesInput.length > 0
    ? rolesInput.map(role => {
        const catalogRole = catalogByName.get(normalizeRoleKey(role.role_name));
        return {
          ...catalogRole,
          ...role,
          gender: role.gender || catalogRole?.gender || '',
          tags: Array.from(new Set([...(catalogRole?.tags || []), ...(role.tags || [])])).slice(0, 8),
        };
      })
    : catalogRoles;
  return {
    scriptId: script.id,
    scriptName: script.name,
    scriptRoles: finalRoles,
  };
}

async function applyScriptContribution(contribution: Record<string, unknown>) {
  const roles = sanitizeCarpoolRoles(contribution.player_roles);
  const creditsPatch = sanitizeScriptCredits(contribution.credits_patch);
  const script = await submitSharedScriptContribution(contribution, roles, creditsPatch);
  return {
    scriptId: script.id,
    scriptName: script.name,
    scriptRoles: script.player_roles,
    creditsPatch,
  };
}

async function attachCarpoolApplications(carpools: Record<string, unknown>[]) {
  const ids = carpools.map(item => String(item.id || '')).filter(Boolean);
  if (ids.length === 0) return carpools;
  const { data, error: appErr } = await supabase.from('lc_carpool_applications')
    .select('id, carpool_id, applicant_id, applicant_name, applicant_is_realname, applicant_avatar, applicant_gender, role_name, role_gender, status, created_at')
    .in('carpool_id', ids)
    .eq('status', 'accepted')
    .order('created_at', { ascending: true });
  if (appErr && isMissingRelation(appErr, 'lc_carpool_applications')) return carpools;
  if (appErr) throw appErr;

  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const app of data || []) {
    const key = String(app.carpool_id || '');
    grouped.set(key, [...(grouped.get(key) || []), app as Record<string, unknown>]);
  }
  return carpools.map(item => ({
    ...item,
    applications: grouped.get(String(item.id || '')) || [],
  }));
}

async function refreshAcceptedCarpoolCount(carpoolId: string) {
  const { count } = await supabase.from('lc_carpool_applications')
    .select('id', { count: 'exact', head: true })
    .eq('carpool_id', carpoolId)
    .eq('status', 'accepted');
  const { data: carpool } = await supabase.from('lc_carpools')
    .select('script_roles, seated_roles')
    .eq('id', carpoolId)
    .maybeSingle();
  const scriptRoles = Array.isArray(carpool?.script_roles) ? carpool.script_roles as Record<string, unknown>[] : [];
  const seatedRoles = Array.isArray(carpool?.seated_roles) ? carpool.seated_roles as Record<string, unknown>[] : [];
  const initialSeatedCount = seatedRoles.length || scriptRoles.filter(role => role.status === 'seated').length;
  const joinedCount = initialSeatedCount + (count || 0);
  await supabase.from('lc_carpools')
    .update({ joined_count: joinedCount, updated_at: new Date().toISOString() })
    .eq('id', carpoolId);
  return joinedCount;
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
      subject_dossier_id: row.subject_dossier_id,
      event_date: row.event_date,
      event_script_id: row.event_script_id,
      event_script_name: row.event_script_name,
      event_store_dossier_id: row.event_store_dossier_id,
      event_store_name: row.event_store_name,
      content: row.content,
      author_name: row.author_name,
      is_realname: row.is_realname,
      initial_amount: row.initial_amount,
      likes: row.likes,
      dislikes: row.dislikes,
      joys: row.joys,
      boost_amount: row.boost_amount,
      negative_boost_amount: row.negative_boost_amount,
      agree_count: row.agree_count,
      oppose_count: row.oppose_count,
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
    store_id: row.store_id,
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
  subject_dossier_id: '关联档案',
  content: '正文内容',
  expires_at: '黑榜到期时间',
};

const RANKING_SUBJECT_TYPES = ['creator', 'dm', 'store', 'takeaway', 'player'];
const REPUTATION_TAGS = [
  '加戏', '陪伴', '控场', '刀法', '亡夫', 'CP', '边界', '沟通',
  '迟到', '失约', '车头', '补贴', '环境', '隔音', '空调', '服务',
  '妆造', '细节', '价格', '新本', '角色', '停车',
];

function normalizeActivityCities(value: unknown, fallback?: unknown) {
  const raw = [
    ...(Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\s，、;；]+/) : []),
    ...(fallback ? [fallback] : []),
  ];
  const seen = new Set<string>();
  const cities: string[] = [];
  raw.forEach(item => {
    const city = cleanText(item, 40);
    if (!city || seen.has(city)) return;
    seen.add(city);
    cities.push(city);
  });
  return cities.slice(0, 8);
}

function isPublicRankingVisible(row: Record<string, unknown>, now = Date.now()) {
  if (row.type !== 'black') return true;
  if (row.expiry_override) return true;
  const expiresAt = row.expires_at
    ? new Date(String(row.expires_at)).getTime()
    : new Date(String(row.created_at)).getTime() + 30 * 24 * 60 * 60 * 1000;
  return Number.isFinite(expiresAt) && expiresAt > now;
}

function reputationSubjectKey(row: Record<string, unknown>) {
  const dossierId = cleanText(row.subject_dossier_id, 80);
  if (dossierId) return `${cleanText(row.subject_type, 40) || 'unknown'}::dossier::${dossierId}`;
  return [
    cleanText(row.subject_type, 40) || 'unknown',
    cleanText(row.subject_name, 120) || '未命名对象',
    cleanText(row.subject_city, 80) || '',
  ].join('::');
}

function metricNumber(value: unknown, fallback = 0) {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? Math.max(0, Math.trunc(num)) : fallback;
}

function rankingMetrics(row: Record<string, unknown>): RankingMetrics {
  const legacyLikes = metricNumber(row.likes);
  const boostAmount = row.boost_amount === undefined || row.boost_amount === null
    ? (row.type === 'black' ? 0 : legacyLikes)
    : metricNumber(row.boost_amount);
  const negativeBoostAmount = metricNumber(row.negative_boost_amount);
  const agreeCount = metricNumber(row.agree_count);
  const opposeCount = metricNumber(row.oppose_count);
  const joys = metricNumber(row.joys);

  return {
    boost_amount: boostAmount,
    negative_boost_amount: negativeBoostAmount,
    agree_count: agreeCount,
    oppose_count: opposeCount,
    likes: boostAmount + agreeCount,
    dislikes: negativeBoostAmount + opposeCount,
    joys,
  };
}

function withRankingMetrics<T extends Record<string, unknown>>(row: T): T & RankingMetrics {
  return {
    ...row,
    ...rankingMetrics(row),
  };
}

function reputationPraiseValue(row: Record<string, unknown>) {
  const metrics = rankingMetrics(row);
  if (row.type === 'red' || row.type === 'white') return metrics.boost_amount;
  return 0;
}

function reputationTags(rows: Record<string, unknown>[]) {
  const text = rows.map(row => `${row.subject_name || ''} ${row.content || ''}`).join(' ');
  return REPUTATION_TAGS.filter(tag => text.includes(tag)).slice(0, 6);
}

function buildReputationSummary(
  rows: Record<string, unknown>[],
  votes: Record<string, unknown>[] = [],
  comments: Record<string, unknown>[] = [],
  transactions: Record<string, unknown>[] = [],
) {
  const rankingIds = new Set(rows.map(row => String(row.id)));
  const relatedVotes = votes.filter(vote => rankingIds.has(String(vote.ranking_id)));
  const relatedComments = comments.filter(comment => rankingIds.has(String(comment.ranking_id)));
  const relatedTransactions = transactions.filter(tx => rankingIds.has(String(tx.ref_id)));
  const praiseVoters = new Set<string>();
  relatedVotes.forEach(vote => {
    if (vote.source !== 'legacy_paid_boost') return;
    if (vote.vote_type !== 'like') return;
    const voterKey = cleanText(vote.voter_id, 80) || cleanText(vote.voter_name, 80);
    if (voterKey) praiseVoters.add(voterKey);
  });
  relatedTransactions.forEach(tx => {
    if (!['ranking_paid_boost', 'ranking_vote'].includes(cleanText(tx.ref_type, 80))) return;
    if (Number(tx.amount || 0) >= 0) return;
    const voterKey = cleanText(tx.profile_id, 80);
    if (voterKey) praiseVoters.add(voterKey);
  });
  rows.forEach(row => {
    if (row.type !== 'red') return;
    const authorKey = cleanText(row.poster_id, 80) || cleanText(row.author_name, 80);
    if (authorKey) praiseVoters.add(authorKey);
  });

  const redCount = rows.filter(row => row.type === 'red').length;
  const whiteCount = rows.filter(row => row.type === 'white').length;
  const blackCount = rows.filter(row => row.type === 'black').length;
  const praiseValue = rows.reduce((sum, row) => sum + reputationPraiseValue(row), 0);
  const praisePeople = praiseVoters.size;
  const commentCount = relatedComments.length;
  const latestAt = rows.reduce((latest, row) => {
    const time = new Date(String(row.created_at || '')).getTime();
    return Number.isFinite(time) ? Math.max(latest, time) : latest;
  }, 0);
  const recentDays = latestAt > 0 ? Math.max(0, Math.min(30, Math.ceil((Date.now() - latestAt) / (24 * 60 * 60 * 1000)))) : 30;
  const recentScore = Math.max(0, 30 - recentDays);
  const reputationValue = Math.max(0, Math.round(
    praisePeople * 6
    + redCount * 10
    + whiteCount * 3
    + commentCount * 2
    + Math.min(praiseValue, 200) * 0.45
    + recentScore * 0.8
    - blackCount * 8
  ));

  return {
    praise_value: praiseValue,
    reputation_value: reputationValue,
    praise_people: praisePeople,
    comment_count: commentCount,
    event_count: rows.length,
    red_count: redCount,
    white_count: whiteCount,
    black_count: blackCount,
    latest_at: latestAt > 0 ? new Date(latestAt).toISOString() : null,
    tags: reputationTags(rows),
  };
}

function publicRankingPayload(row: Record<string, unknown>) {
  const metrics = rankingMetrics(row);
  return {
    id: row.id,
    type: row.type,
    subject_name: row.subject_name,
    subject_type: row.subject_type,
    subject_city: row.subject_city,
    subject_url: row.subject_url,
    subject_dossier_id: row.subject_dossier_id || null,
    event_date: row.event_date || null,
    event_script_id: row.event_script_id || null,
    event_script_name: row.event_script_name || null,
    event_store_dossier_id: row.event_store_dossier_id || null,
    event_store_name: row.event_store_name || null,
    content: row.content,
    author_name: row.author_name,
    poster_id: row.poster_id || null,
    is_realname: !!row.is_realname,
    lc_profiles: row.lc_profiles || null,
    initial_amount: row.initial_amount || 0,
    likes: metrics.likes,
    dislikes: metrics.dislikes,
    joys: metrics.joys,
    boost_amount: metrics.boost_amount,
    negative_boost_amount: metrics.negative_boost_amount,
    agree_count: metrics.agree_count,
    oppose_count: metrics.oppose_count,
    created_at: row.created_at,
    expires_at: row.expires_at,
    expiry_override: row.expiry_override,
  };
}

function reportRiskLevel(reason: string, description = ''): 'normal' | 'high' | 'urgent' {
  const text = `${reason} ${description}`;
  if (/泄露|隐私|未打码|身份证|住址|手机号|微信号|未成年|人肉/i.test(text)) return 'urgent';
  if (/诈骗|违法|犯罪|威胁|恐吓|色情|性交易|冒用|造谣|诽谤/i.test(text)) return 'high';
  return 'normal';
}

function moderationReviewerRole(profile: Record<string, unknown> | null | undefined) {
  if (!profile) return '';
  if (cleanText(profile.role, 40).toLowerCase() === 'admin') return 'admin';
  const communityRole = cleanText(profile.community_role, 60);
  const expiresAt = cleanText(profile.community_role_expires_at, 80);
  const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
  if (communityRole === 'founding_referrer') return 'founding_referrer';
  if (communityRole === 'community_observer' && !expired) return 'community_observer';
  return '';
}

function reportThreshold(targetType: ReportTargetType) {
  if (targetType === 'ranking') return 4;
  if (targetType === 'profile') return 2;
  return 3;
}

async function moderationEngagement(targetType: ReportTargetType, targetId: string) {
  try {
    if (targetType === 'ranking') {
      const { data } = await supabase.from('lc_rankings')
        .select('initial_amount, likes, dislikes, joys')
        .eq('id', targetId)
        .maybeSingle();
      return Math.max(0, Number(data?.likes || 0) + Number(data?.dislikes || 0) + Number(data?.joys || 0) + Math.min(Number(data?.initial_amount || 0), 20));
    }
    if (targetType === 'comment') {
      const { data } = await supabase.from('lc_comments')
        .select('likes')
        .eq('id', targetId)
        .maybeSingle();
      return Math.max(0, Number(data?.likes || 0));
    }
    if (targetType === 'carpool') {
      const { data } = await supabase.from('lc_carpools')
        .select('joined_count, boost_amount')
        .eq('id', targetId)
        .maybeSingle();
      return Math.max(0, Number(data?.joined_count || 0) + Math.min(Number(data?.boost_amount || 0), 20));
    }
  } catch (e) {
    console.error('[moderation] engagement failed', getErrorText(e));
  }
  return 0;
}

async function currentTargetStatus(targetType: ReportTargetType, targetId: string) {
  if (targetType === 'ranking') {
    const { data } = await supabase.from('lc_rankings').select('status').eq('id', targetId).maybeSingle();
    return cleanText(data?.status, 40) || null;
  }
  if (targetType === 'comment') {
    const { data } = await supabase.from('lc_comments').select('status').eq('id', targetId).maybeSingle();
    return cleanText(data?.status, 40) || null;
  }
  if (targetType === 'commission') {
    const { data } = await supabase.from('lc_commissions').select('status').eq('id', targetId).maybeSingle();
    return cleanText(data?.status, 40) || null;
  }
  if (targetType === 'carpool') {
    const { data } = await supabase.from('lc_carpools').select('status').eq('id', targetId).maybeSingle();
    return cleanText(data?.status, 40) || null;
  }
  const { data } = await supabase.from('lc_profiles').select('is_visible').eq('id', targetId).maybeSingle();
  return data?.is_visible ? 'visible' : 'hidden';
}

async function setTargetTemporaryHidden(targetType: ReportTargetType, targetId: string, reason = TEMPORARY_HIDE_REASON) {
  const before = await currentTargetStatus(targetType, targetId);
  const now = new Date().toISOString();
  if (targetType === 'ranking' && before === 'approved') {
    await supabase.from('lc_rankings').update({ status: 'rejected' }).eq('id', targetId);
  } else if (targetType === 'comment' && before === 'approved') {
    await supabase.from('lc_comments').update({ status: 'rejected' }).eq('id', targetId);
  } else if (targetType === 'commission' && before === 'approved') {
    await supabase.from('lc_commissions').update({ status: 'rejected', reject_reason: reason, updated_at: now }).eq('id', targetId);
  } else if (targetType === 'carpool' && before === 'approved') {
    await supabase.from('lc_carpools').update({ status: 'rejected', reject_reason: reason, updated_at: now }).eq('id', targetId);
  } else if (targetType === 'profile' && before === 'visible') {
    await supabase.from('lc_profiles').update({ is_visible: false, reject_reason: reason, updated_at: now }).eq('id', targetId);
  }
  const after = await currentTargetStatus(targetType, targetId);
  return { before, after };
}

async function restoreTargetAfterReport(targetType: ReportTargetType, targetId: string) {
  const before = await currentTargetStatus(targetType, targetId);
  const now = new Date().toISOString();
  if (targetType === 'ranking') {
    await supabase.from('lc_rankings').update({ status: 'approved' }).eq('id', targetId);
  } else if (targetType === 'comment') {
    await supabase.from('lc_comments').update({ status: 'approved' }).eq('id', targetId);
  } else if (targetType === 'commission') {
    await supabase.from('lc_commissions').update({ status: 'approved', reject_reason: null, updated_at: now }).eq('id', targetId);
  } else if (targetType === 'carpool') {
    await supabase.from('lc_carpools').update({ status: 'approved', reject_reason: null, updated_at: now }).eq('id', targetId);
  } else {
    await supabase.from('lc_profiles').update({ is_visible: true, reject_reason: null, updated_at: now }).eq('id', targetId);
  }
  const after = await currentTargetStatus(targetType, targetId);
  return { before, after };
}

function buildReviewerSummary(reviews: Array<{ decision?: string; risk_labels?: string[] | null }>) {
  const decisions: Record<string, number> = {};
  const labels: Record<string, number> = {};
  reviews.forEach(review => {
    const decision = cleanText(review.decision, 60) || 'unclear';
    decisions[decision] = (decisions[decision] || 0) + 1;
    (Array.isArray(review.risk_labels) ? review.risk_labels : []).forEach(labelRaw => {
      const label = cleanText(labelRaw, 40);
      if (label) labels[label] = (labels[label] || 0) + 1;
    });
  });
  const hideVotes = (decisions.hide || 0) + (decisions.privacy_risk || 0) + (decisions.legal_risk || 0);
  const safeVotes = decisions.safe || 0;
  return {
    total: reviews.length,
    decisions,
    labels,
    hide_votes: hideVotes,
    safe_votes: safeVotes,
    updated_at: new Date().toISOString(),
  };
}

async function refreshReportReviewerSummary(targetType: ReportTargetType, targetId: string) {
  const { data, error } = await supabase.from('lc_moderation_reviews')
    .select('decision, risk_labels')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('status', 'active');
  if (error) {
    if (isMissingRelation(error, 'lc_moderation_reviews')) return {};
    throw error;
  }
  const summary = buildReviewerSummary((data || []) as Array<{ decision?: string; risk_labels?: string[] | null }>);
  const { error: updErr } = await supabase.from('lc_reports')
    .update({ reviewer_summary: summary, updated_at: new Date().toISOString() })
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('status', 'pending');
  if (updErr && !isMissingRelation(updErr, 'reviewer_summary')) throw updErr;
  return summary;
}

async function evaluateReportModeration(req: express.Request, args: {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description: string;
}) {
  const { data: reports, error: reportErr } = await supabase.from('lc_reports')
    .select('id, reporter_id, reason, reporter_trust_score')
    .eq('target_type', args.targetType)
    .eq('target_id', args.targetId)
    .eq('status', 'pending');
  if (reportErr) throw reportErr;

  const rows = reports || [];
  const effectiveReporters = new Set(rows.map(row => String(row.reporter_id || '')).filter(Boolean));
  const effectiveCount = effectiveReporters.size || rows.length;
  const riskLevels = rows.map(row => reportRiskLevel(cleanText(row.reason, 120)));
  const ownRisk = reportRiskLevel(args.reason, args.description);
  const riskLevel = riskLevels.includes('urgent') || ownRisk === 'urgent'
    ? 'urgent'
    : (riskLevels.includes('high') || ownRisk === 'high' ? 'high' : 'normal');
  const engagement = await moderationEngagement(args.targetType, args.targetId);
  const reportRatio = effectiveCount / Math.max(1, effectiveCount + engagement);
  const threshold = reportThreshold(args.targetType);

  const shouldTemporaryHide =
    riskLevel === 'urgent'
    || (riskLevel === 'high' && effectiveCount >= 2)
    || (effectiveCount >= threshold && reportRatio >= 0.25);
  const shouldQueuePriority = !shouldTemporaryHide && (riskLevel === 'high' || effectiveCount >= 2);

  let action: 'none' | 'temporary_hidden' | 'queued_priority' = 'none';
  let statusChange: { before: string | null; after: string | null } = { before: null, after: null };
  let reason = '';
  if (shouldTemporaryHide) {
    action = 'temporary_hidden';
    reason = riskLevel === 'urgent'
      ? '命中隐私、未打码、违法或人身安全等高风险举报，先临时折叠等待管理员复核'
      : `收到 ${effectiveCount} 个有效举报，先临时折叠等待管理员复核`;
    statusChange = await setTargetTemporaryHidden(args.targetType, args.targetId, reason);
    await logSecurityEvent(req, {
      action: 'report_auto_temporary_hidden',
      targetType: args.targetType,
      targetId: args.targetId,
      metadata: { report_count: effectiveCount, report_ratio: reportRatio, risk_level: riskLevel, before: statusChange.before, after: statusChange.after },
    });
  } else if (shouldQueuePriority) {
    action = 'queued_priority';
    reason = riskLevel === 'high' ? '高风险举报，进入优先复核队列' : '多名用户举报，进入优先复核队列';
  }

  const patch = {
    risk_level: riskLevel,
    auto_action: action,
    auto_action_reason: reason || null,
    auto_action_at: action === 'none' ? null : new Date().toISOString(),
    target_status_before: statusChange.before,
    target_status_after: statusChange.after,
    report_group_count: effectiveCount,
    updated_at: new Date().toISOString(),
  };
  const { error: updErr } = await supabase.from('lc_reports')
    .update(patch)
    .eq('target_type', args.targetType)
    .eq('target_id', args.targetId)
    .eq('status', 'pending');
  if (updErr && !isMissingRelation(updErr, 'risk_level')) throw updErr;

  return {
    risk_level: riskLevel,
    auto_action: action,
    auto_action_reason: reason || null,
    report_group_count: effectiveCount,
    report_ratio: reportRatio,
    target_status_before: statusChange.before,
    target_status_after: statusChange.after,
  };
}

function groupReportsForModerationQueue(reports: Record<string, unknown>[], ownReviews: Record<string, unknown>[] = []) {
  const ownReviewByTarget = new Map(ownReviews.map(review => [`${review.target_type}:${review.target_id}`, review]));
  const map = new Map<string, Record<string, unknown> & { reasons: string[]; report_ids: string[]; report_count: number }>();
  reports.forEach(report => {
    const key = `${report.target_type}:${report.target_id}`;
    const current = map.get(key) || {
      target_type: report.target_type,
      target_id: report.target_id,
      target_title: report.target_title,
      target_snapshot: report.target_snapshot || {},
      risk_level: report.risk_level || 'normal',
      auto_action: report.auto_action || 'none',
      auto_action_reason: report.auto_action_reason || null,
      reviewer_summary: report.reviewer_summary || {},
      created_at: report.created_at,
      updated_at: report.updated_at,
      reasons: [],
      report_ids: [],
      report_count: 0,
      my_review: null,
    };
    const reason = cleanText(report.reason, 80);
    if (reason && !current.reasons.includes(reason)) current.reasons.push(reason);
    current.report_ids.push(String(report.id));
    current.report_count = Math.max(Number(current.report_count || 0), Number(report.report_group_count || 0), current.report_ids.length);
    if (report.auto_action === 'temporary_hidden') current.auto_action = 'temporary_hidden';
    else if (current.auto_action !== 'temporary_hidden' && report.auto_action === 'queued_priority') current.auto_action = 'queued_priority';
    if (report.risk_level === 'urgent') current.risk_level = 'urgent';
    else if (current.risk_level !== 'urgent' && report.risk_level === 'high') current.risk_level = 'high';
    current.my_review = ownReviewByTarget.get(key) || null;
    map.set(key, current);
  });
  return Array.from(map.values()).sort((a, b) => {
    const actionScore = (value: unknown) => value === 'temporary_hidden' ? 2 : value === 'queued_priority' ? 1 : 0;
    const byAction = actionScore(b.auto_action) - actionScore(a.auto_action);
    if (byAction !== 0) return byAction;
    return new Date(String(b.updated_at || b.created_at || 0)).getTime() - new Date(String(a.updated_at || a.created_at || 0)).getTime();
  });
}

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
    `来源：剧幕录拼车区`,
    `拼车ID：${carpool.id}`,
    `标题：${carpool.title || ''}`,
    `城市：${carpool.city || ''}`,
    `角色：${carpool.role_name || '未指定'}`,
    `截止：${carpool.deadline_date || '未填'}${carpool.deadline_time ? ` ${carpool.deadline_time}` : ''}`,
    `车头联系方式：${carpool.leader_contact || '未填'}`,
    `店家：${carpool.store_name || '未填'}${carpool.store_city ? `（${carpool.store_city}）` : ''}`,
    `补贴：${formatCarpoolSubsidy(carpool)}`,
    `说明：${carpool.content || ''}`,
  ];
  return lines.join('\n').slice(0, 1800);
}

async function syncCarpoolToJuzhanggui(carpool: Record<string, unknown>) {
  if (carpool.juzhanggui_schedule_id) {
    return { ok: true, scheduleId: String(carpool.juzhanggui_schedule_id), reused: true };
  }
  if (!SHARED_SCRIPT_LIBRARY_TOKEN) throw new Error('共享剧本库服务密钥未配置');
  const response = await fetch(`${JUZHANGGUI_API_URL}/api/shared/script-library/carpool-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shared-Library-Token': SHARED_SCRIPT_LIBRARY_TOKEN,
    },
    body: JSON.stringify({
      carpoolId: cleanText(carpool.id, 120),
      scriptId: cleanText(carpool.script_id, 80) || null,
      scriptName: cleanText(carpool.script_name, 160),
      scriptRoles: sanitizeCarpoolRoles(carpool.script_roles, cleanText(carpool.role_name, 80), cleanText(carpool.role_note, 200)),
      city: cleanText(carpool.city, 40),
      eventDate: cleanText(carpool.event_date, 20),
      startTime: normalizeClockTime(carpool.start_time, '19:30'),
      neededCount: Number(carpool.needed_count || 0) || 0,
      storeName: cleanText(carpool.store_name, 100),
      customerName: `剧幕录拼车 · ${cleanText(carpool.poster_name, 40) || '车头'}`,
      note: buildJuzhangguiScheduleNote(carpool),
    }),
  });
  const body = await response.json() as { success?: boolean; data?: Record<string, unknown>; error?: unknown };
  if (!response.ok || !body.success) throw new Error(cleanText(body.error, 300) || '同步剧司辰失败');
  return {
    ok: true,
    scheduleId: cleanText(body.data?.scheduleId, 120) || null,
    reused: body.data?.reused === true,
  };
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
type RankingMetrics = {
  likes: number;
  dislikes: number;
  joys: number;
  boost_amount: number;
  negative_boost_amount: number;
  agree_count: number;
  oppose_count: number;
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
  boost_amount?: number;
  negative_boost_amount?: number;
  agree_count?: number;
  oppose_count?: number;
  balance: number;
  balance_delta?: number;
  refunded?: number;
  vote_id?: string;
  vote_type?: RankingVoteType;
  vote_created_at?: string;
  is_duplicate?: boolean;
};
type RankingPaidBoostRpcResult = RankingMetrics & {
  balance: number;
  paid_amount: number;
  transaction_id?: string;
};

const VOTE_CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

function voteRefundAmount() {
  return 0;
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
    refund_amount: canCancel ? voteRefundAmount() : 0,
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
app.get('/api/health', (_req, res) => res.json(ok({ status: '剧幕录服务正常' })));

app.get('/api/wechat/mp/events', (req, res) => {
  const configError = getWechatMpConfigError();
  const echostr = singleQueryValue(req.query.echostr);
  if (configError) return res.status(503).type('text/plain').send(configError);
  if (!echostr) return res.status(400).type('text/plain').send('missing echostr');
  if (!verifyWechatMpRequest(req)) return res.status(403).type('text/plain').send('invalid signature');
  return res.status(200).type('text/plain').send(echostr);
});

app.post('/api/wechat/mp/events', express.text({ type: ['text/*', 'application/xml', 'text/xml'], limit: '2mb' }), (req, res) => {
  const configError = getWechatMpConfigError();
  if (configError) return res.status(503).type('text/plain').send(configError);
  const rawBody = typeof req.body === 'string'
    ? req.body
    : String((req as Record<string, unknown>).rawBody || JSON.stringify(req.body || {}));
  const encrypted = extractWechatMpEncrypted(req.body, rawBody);
  if (!verifyWechatMpRequest(req, encrypted)) {
    console.error('[wechat-mp] event signature invalid', {
      has_msg_signature: Boolean(singleQueryValue(req.query.msg_signature)),
      has_encrypt: Boolean(encrypted),
    });
    return res.status(403).type('text/plain').send('invalid signature');
  }
  return res.status(200).type('text/plain').send('success');
});

// ==================== 创作者认证 ====================

function parseConfirmedAuthPassword(rawPassword: unknown, rawConfirm: unknown, required: boolean) {
  const password = cleanText(rawPassword, 200);
  const confirm = cleanText(rawConfirm, 200);
  if (!password && !confirm && !required) return '';
  if (!password || password.length < 6) throw new Error('密码至少6位');
  if (password !== confirm) throw new Error('两次输入的密码不一致');
  return password;
}

function normalizeAuthLoginAccount(rawAccount: unknown) {
  const account = cleanText(rawAccount, 160);
  if (!account) throw new Error('请填写手机号或邮箱');
  if (account.includes('@')) {
    const email = normalizeEmail(account);
    return { kind: 'email' as const, value: email, column: 'email' as const, hash: makeAuthEmailHash(email) };
  }
  const phone = normalizeChinaPhone(account);
  return { kind: 'phone' as const, value: phone, column: 'phone' as const, hash: makeAuthPhoneHash(phone) };
}

function profileLoginPayload(profile: Record<string, unknown>, token: string, extra: Record<string, unknown> = {}) {
  return {
    id: profile.id,
    display_name: String(profile.display_name || '用户'),
    phone: profile.phone || '',
    phone_verified_at: profile.phone_verified_at || null,
    email: profile.email || '',
    email_verified_at: profile.email_verified_at || null,
    role: profile.role,
    city: profile.city || null,
    available_cities: profile.available_cities || [],
    has_password: Boolean(profile.password_hash),
    token,
    ...extra,
  };
}

app.post('/api/lc/auth/send-code', async (req, res) => {
  try {
    const result = await createAndSendPhoneCode(req, 'lingqi', 'login', req.body?.phone);
    await logSecurityEvent(req, {
      action: 'auth_phone_code_sent',
      metadata: { phone_hash: makeAuthPhoneHash(result.phone), provider: result.provider, expires_at: result.expiresAt },
    });
    res.json(ok({ sent: true, expires_at: result.expiresAt }));
  } catch (e) { res.status(400).json(err(e)); }
});

app.get('/api/lc/auth/config', async (_req, res) => {
  res.json(ok({
    smsEnabled: isSmsCodeLoginAvailable(),
    emailCodeEnabled: isEmailCodeLoginAvailable(),
    wechatEnabled: isWechatLoginConfigured(),
    wechatMiniEnabled: isWechatMiniLoginConfigured(),
  }));
});

app.post('/api/lc/auth/identify', async (req, res) => {
  try {
    const account = normalizeAuthLoginAccount(req.body?.account);
    const { data: profile, error } = await supabase.from('lc_profiles')
      .select('id, password_hash, is_banned, auth_provider, wechat_openid, wechat_unionid')
      .eq(account.column, account.value)
      .maybeSingle();
    if (error) throw error;

    await logSecurityEvent(req, {
      action: 'auth_account_identified',
      targetType: profile ? 'profile' : 'auth_account',
      targetId: profile?.id || null,
      metadata: {
        account_kind: account.kind,
        account_hash: account.hash,
        exists: Boolean(profile),
        has_password: Boolean(profile?.password_hash),
      },
    });

    res.json(ok({
      kind: account.kind,
      exists: Boolean(profile),
      has_password: Boolean(profile?.password_hash),
      auth_provider: profile?.auth_provider || null,
      has_wechat: Boolean(profile?.wechat_openid || profile?.wechat_unionid),
      is_banned: Boolean(profile?.is_banned),
    }));
  } catch (e) { res.status(400).json(err(e)); }
});

app.post('/api/lc/auth/email/send-code', async (req, res) => {
  try {
    const result = await createAndSendEmailCode(req, 'lingqi', 'email_login', req.body?.email);
    await logSecurityEvent(req, {
      action: 'auth_email_code_sent',
      metadata: { email_hash: makeAuthEmailHash(result.email), provider: result.provider, expires_at: result.expiresAt },
    });
    res.json(ok({ sent: true, expires_at: result.expiresAt, email_mask: maskEmail(result.email) }));
  } catch (e) { res.status(400).json(err(e)); }
});

app.post('/api/lc/auth/phone', async (req, res) => {
  try {
    const { displayName, activityCities, referralCode } = req.body;
    const activityCityList = normalizeActivityCities(activityCities, req.body?.city);
    const primaryCity = activityCityList[0] || null;
    const rawPhone = normalizeChinaPhone(req.body?.phone);
    const { data: existing } = await supabase.from('lc_profiles').select('*').eq('phone', rawPhone).maybeSingle();
    if (existing) {
      return res.status(409).json(err(new Error(existing.password_hash
        ? '该账号已经注册，直接输入密码登录就行'
        : '该账号已经注册，但还没有设置网页登录密码，请点忘记密码后设置密码'
      )));
    }
    const passwordToSet = parseConfirmedAuthPassword(req.body?.password, req.body?.passwordConfirm, true);
    const phone = await verifyPhoneCode('lingqi', 'login', rawPhone, req.body?.code);
    const nowIso = new Date().toISOString();

    const profileRole = 'player';
    const { data: profile } = await supabase.from('lc_profiles').insert({
      phone,
      display_name: displayName && String(displayName).trim() ? String(displayName).trim().slice(0, 80) : `用户${phone.slice(-4)}`,
      role: profileRole,
      role_type: profileRole,
      identity_roles: [profileRole],
      password_hash: await bcrypt.hash(passwordToSet, 10),
      is_visible: true,
      balance: 30,
      paid_balance: 0,
      bonus_balance: 30,
      phone_verified_at: nowIso,
      auth_provider: 'phone',
      city: primaryCity,
      available_cities: activityCityList,
    }).select().single();
    if (!profile) return res.status(500).json(err(new Error('注册失败')));

    await supabase.from('lc_transactions').insert({
      profile_id: profile.id,
      type: 'recharge',
      amount: 30,
      paid_amount: 0,
      bonus_amount: 30,
      description: '新用户注册赠送 30 契约币',
      status: 'approved',
      balance_before: 0,
      balance_after: 30,
      paid_balance_before: 0,
      paid_balance_after: 0,
      bonus_balance_before: 0,
      bonus_balance_after: 30,
    });
    const referralResult = await runReferralSideEffect('phone-signup', () => registerReferralForNewProfile(profile, referralCode));
    const token = signProfileAuthToken(profile);
    await logSecurityEvent(req, {
      action: 'auth_phone_register_success',
      targetType: 'profile',
      targetId: profile.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { welcome_credit: 30, phone_verified_at: nowIso, activity_cities_count: activityCityList.length, referral_applied: Boolean(referralResult?.referral) },
    });
    res.json(ok({
      id: profile.id,
      display_name: profile.display_name,
      phone: profile.phone,
      role: profile.role,
      city: profile.city || null,
      available_cities: profile.available_cities || [],
      phone_verified_at: nowIso,
      has_password: true,
      token,
      new_user: true,
    }));
  } catch (e) { res.status(400).json(err(e)); }
});

app.post('/api/lc/auth/email', async (req, res) => {
  try {
    const { displayName, activityCities, referralCode } = req.body;
    const activityCityList = normalizeActivityCities(activityCities, req.body?.city);
    const primaryCity = activityCityList[0] || null;
    const rawEmail = normalizeEmail(req.body?.email);
    const { data: existing } = await supabase.from('lc_profiles').select('*').eq('email', rawEmail).maybeSingle();
    if (existing) {
      return res.status(409).json(err(new Error(existing.password_hash
        ? '该账号已经注册，直接输入密码登录就行'
        : '该账号已经注册，但还没有设置网页登录密码，请点忘记密码后设置密码'
      )));
    }
    const passwordToSet = parseConfirmedAuthPassword(req.body?.password, req.body?.passwordConfirm, true);
    const email = await verifyEmailCode('lingqi', 'email_login', rawEmail, req.body?.code);
    const nowIso = new Date().toISOString();
    const emailPrefix = email.split('@')[0]?.slice(0, 24) || 'email';

    const profileRole = 'player';
    const { data: profile } = await supabase.from('lc_profiles').insert({
      email,
      display_name: displayName && String(displayName).trim() ? String(displayName).trim().slice(0, 80) : `用户${emailPrefix}`,
      role: profileRole,
      role_type: profileRole,
      identity_roles: [profileRole],
      password_hash: await bcrypt.hash(passwordToSet, 10),
      is_visible: true,
      balance: 30,
      paid_balance: 0,
      bonus_balance: 30,
      email_verified_at: nowIso,
      auth_provider: 'email',
      city: primaryCity,
      available_cities: activityCityList,
    }).select().single();
    if (!profile) return res.status(500).json(err(new Error('注册失败')));

    await supabase.from('lc_transactions').insert({
      profile_id: profile.id,
      type: 'recharge',
      amount: 30,
      paid_amount: 0,
      bonus_amount: 30,
      description: '新用户注册赠送 30 契约币',
      status: 'approved',
      balance_before: 0,
      balance_after: 30,
      paid_balance_before: 0,
      paid_balance_after: 0,
      bonus_balance_before: 0,
      bonus_balance_after: 30,
    });
    const referralResult = await runReferralSideEffect('email-signup', () => registerReferralForNewProfile(profile, referralCode));
    const token = signProfileAuthToken(profile);
    await logSecurityEvent(req, {
      action: 'auth_email_register_success',
      targetType: 'profile',
      targetId: profile.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { welcome_credit: 30, email_hash: makeAuthEmailHash(email), email_verified_at: nowIso, activity_cities_count: activityCityList.length, referral_applied: Boolean(referralResult?.referral) },
    });
    res.json(ok({
      id: profile.id,
      display_name: profile.display_name,
      phone: profile.phone || '',
      phone_verified_at: profile.phone_verified_at || null,
      email: profile.email,
      email_verified_at: nowIso,
      role: profile.role,
      city: profile.city || null,
      available_cities: profile.available_cities || [],
      has_password: true,
      token,
      new_user: true,
    }));
  } catch (e) { res.status(400).json(err(e)); }
});

app.post('/api/lc/auth/reset-password', async (req, res) => {
  try {
    const account = normalizeAuthLoginAccount(req.body?.account);
    const { data: existing, error: existingErr } = await supabase.from('lc_profiles')
      .select('*')
      .eq(account.column, account.value)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (!existing) return res.status(404).json(err(new Error('该账号还没有注册，请先注册')));
    if (existing.is_banned) {
      await logSecurityEvent(req, {
        action: 'auth_reset_password_blocked_banned_user',
        targetType: 'profile',
        targetId: existing.id,
        actorId: existing.id,
        actorRole: existing.role || 'creator',
        metadata: { reason: existing.ban_reason || null },
      });
      return res.status(403).json(err(new Error('账号已被限制登录，请联系管理员申诉')));
    }

    const passwordToSet = parseConfirmedAuthPassword(req.body?.password, req.body?.passwordConfirm, true);
    const nowIso = new Date().toISOString();
    const verifiedAccount = account.kind === 'phone'
      ? await verifyPhoneCode('lingqi', 'login', account.value, req.body?.code)
      : await verifyEmailCode('lingqi', 'email_login', account.value, req.body?.code);

    const patch: Record<string, unknown> = {
      password_hash: await bcrypt.hash(passwordToSet, 10),
      auth_provider: existing.auth_provider || account.kind,
      ...profileIdentityPatch(existing, ['player']),
    };
    if (account.kind === 'phone') {
      patch.phone = verifiedAccount;
      patch.phone_verified_at = nowIso;
    } else {
      patch.email = verifiedAccount;
      patch.email_verified_at = nowIso;
      if (!existing.display_name) patch.display_name = `用户${String(verifiedAccount).split('@')[0]?.slice(0, 24) || 'email'}`;
    }

    await supabase.from('lc_profiles').update(patch).eq('id', existing.id);
    const nextProfile = { ...existing, ...patch, password_hash: patch.password_hash };
    const token = signProfileAuthToken(nextProfile);
    await logSecurityEvent(req, {
      action: 'auth_password_reset',
      targetType: 'profile',
      targetId: existing.id,
      actorId: existing.id,
      actorRole: existing.role || 'creator',
      metadata: {
        account_kind: account.kind,
        account_hash: account.hash,
        verified_at: nowIso,
      },
    });

    res.json(ok(profileLoginPayload(nextProfile, token, {
      has_password: true,
      new_user: false,
    })));
  } catch (e) { res.status(400).json(err(e)); }
});

app.post('/api/lc/auth/bind-phone', authMiddleware, async (req, res) => {
  try {
    const creatorId = getReq(req, 'creatorId');
    const phone = await verifyPhoneCode('lingqi', 'login', req.body?.phone, req.body?.code);
    const nowIso = new Date().toISOString();

    const [{ data: current }, { data: existing }] = await Promise.all([
      supabase.from('lc_profiles').select('*').eq('id', creatorId).single(),
      supabase.from('lc_profiles').select('*').eq('phone', phone).maybeSingle(),
    ]);
    if (!current) return res.status(404).json(err(new Error('当前账号不存在')));
    if (current.is_banned) return res.status(403).json(err(new Error('账号已被限制登录，请联系管理员申诉')));
    if (existing && existing.id !== creatorId) {
      return res.status(409).json(err(new Error('该手机号已绑定其他剧幕录账号，请先用该手机号登录或联系客服合并账号')));
    }

    const patch = {
      phone,
      phone_verified_at: nowIso,
      auth_provider: current.auth_provider || 'phone',
      ...profileIdentityPatch(current, ['player']),
    };
    await supabase.from('lc_profiles').update(patch).eq('id', creatorId);
    await runReferralSideEffect('stage1-after-bind-phone', () => maybeAwardReferralStage1(creatorId));

    const nextProfile = { ...current, ...patch };
    const token = signProfileAuthToken(nextProfile);
    await logSecurityEvent(req, {
      action: 'auth_phone_bound',
      targetType: 'profile',
      targetId: creatorId,
      actorId: creatorId,
      actorRole: current.role || 'creator',
      metadata: { phone_hash: makeAuthPhoneHash(phone), phone_verified_at: nowIso },
    });

    res.json(ok({
      id: nextProfile.id,
      display_name: nextProfile.display_name,
      phone,
      phone_verified_at: nowIso,
      city: nextProfile.city || null,
      available_cities: nextProfile.available_cities || [],
      role: nextProfile.role,
      role_type: nextProfile.role_type,
      identity_roles: nextProfile.identity_roles || [],
      token,
      has_password: Boolean(nextProfile.password_hash),
    }));
  } catch (e) { res.status(400).json(err(e)); }
});

app.post('/api/lc/auth/set-password', authMiddleware, async (req, res) => {
  try {
    const creatorId = getReq(req, 'creatorId');
    const password = cleanText(req.body?.password, 200);
    if (!password || password.length < 4) return res.status(400).json(err(new Error('密码至少4位')));

    const { data: current } = await supabase.from('lc_profiles').select('*').eq('id', creatorId).single();
    if (!current) return res.status(404).json(err(new Error('当前账号不存在')));
    if (current.is_banned) return res.status(403).json(err(new Error('账号已被限制登录，请联系管理员申诉')));
    if (!current.phone_verified_at && !current.email_verified_at) {
      return res.status(400).json(err(new Error('请先完成手机号或邮箱验证，再设置网页登录密码')));
    }

    const verifiedTimes = [current.phone_verified_at, current.email_verified_at]
      .map(value => value ? new Date(value).getTime() : 0)
      .filter(value => Number.isFinite(value) && value > 0);
    const recentlyVerified = verifiedTimes.some(value => Date.now() - value < 15 * 60 * 1000);
    if (!recentlyVerified) {
      const verificationType = cleanText(req.body?.verificationType, 20);
      const verificationCode = cleanText(req.body?.verificationCode, 20);
      if (verificationType === 'phone') {
        if (!current.phone || !current.phone_verified_at) {
          return res.status(400).json(err(new Error('当前账号没有可用于验证的手机号')));
        }
        await verifyPhoneCode('lingqi', 'login', current.phone, verificationCode);
      } else if (verificationType === 'email') {
        if (!current.email || !current.email_verified_at) {
          return res.status(400).json(err(new Error('当前账号没有可用于验证的邮箱')));
        }
        await verifyEmailCode('lingqi', 'email_login', current.email, verificationCode);
      } else {
        return res.status(400).json(err(new Error('修改密码前请先验证当前手机号或邮箱')));
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await supabase.from('lc_profiles').update({ password_hash: passwordHash }).eq('id', creatorId);
    await logSecurityEvent(req, {
      action: 'auth_password_set',
      targetType: 'profile',
      targetId: creatorId,
      actorId: creatorId,
      actorRole: current.role || 'creator',
      metadata: {
        phone_hash: current.phone ? makeAuthPhoneHash(current.phone) : null,
        email_hash: current.email ? makeAuthEmailHash(current.email) : null,
        verification_required: !recentlyVerified,
      },
    });

    res.json(ok({ has_password: true }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/auth/wechat/url', async (req, res) => {
  try {
    if (!isWechatLoginConfigured()) return res.status(503).json(err(new Error('微信扫码登录尚未配置')));
    const redirectPath = safeFrontendRedirect(req.query.redirect);
    res.json(ok({ enabled: true, url: makeWechatAuthorizeUrl(redirectPath, String(req.query.ref || '')) }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/auth/wechat/start', async (req, res) => {
  try {
    if (!isWechatLoginConfigured()) return res.status(503).json(err(new Error('微信扫码登录尚未配置')));
    res.redirect(makeWechatAuthorizeUrl(safeFrontendRedirect(req.query.redirect), String(req.query.ref || '')));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/auth/wechat/callback', async (req, res) => {
  try {
    if (!isWechatLoginConfigured()) throw new Error('微信扫码登录尚未配置');
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) throw new Error('微信登录参数缺失');
    const statePayload = jwt.verify(state, JWT_SECRET) as { kind?: string; redirectPath?: string; referralCode?: string };
    if (statePayload.kind !== 'lc_wechat_login') throw new Error('微信登录状态无效');

    const tokenUrl = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
    tokenUrl.search = new URLSearchParams({
      appid: WECHAT_OPEN_APP_ID,
      secret: WECHAT_OPEN_APP_SECRET,
      code,
      grant_type: 'authorization_code',
    }).toString();
    const tokenResp = await fetch(tokenUrl);
    const tokenData = await tokenResp.json() as Record<string, unknown>;
    if (!tokenResp.ok || tokenData.errcode) throw new Error(String(tokenData.errmsg || '微信登录授权失败'));

    const userUrl = new URL('https://api.weixin.qq.com/sns/userinfo');
    userUrl.search = new URLSearchParams({
      access_token: String(tokenData.access_token),
      openid: String(tokenData.openid),
      lang: 'zh_CN',
    }).toString();
    const userResp = await fetch(userUrl);
    const wxUser = await userResp.json() as Record<string, unknown>;
    if (!userResp.ok || wxUser.errcode) throw new Error(String(wxUser.errmsg || '微信用户信息获取失败'));

    const openid = String(tokenData.openid || wxUser.openid || '');
    const unionid = tokenData.unionid || wxUser.unionid || null;
    if (!openid) throw new Error('微信登录缺少 openid');
    const nickname = cleanText(wxUser.nickname, 80) || `微信用户${openid.slice(-4)}`;
    const avatar = cleanText(wxUser.headimgurl, 800) || null;
    const nowIso = new Date().toISOString();

    let query = supabase.from('lc_profiles').select('*');
    if (unionid) query = query.eq('wechat_unionid', unionid);
    else query = query.eq('wechat_openid', openid);
    let { data: profile } = await query.maybeSingle();

    if (profile?.is_banned) {
      await logSecurityEvent(req, {
        action: 'auth_wechat_login_blocked_banned_user',
        targetType: 'profile',
        targetId: profile.id,
        actorId: profile.id,
        actorRole: profile.role || 'creator',
        metadata: { reason: profile.ban_reason || null },
      });
      throw new Error('账号已被限制登录，请联系管理员申诉');
    }

    if (profile) {
      await supabase.from('lc_profiles').update({
        wechat_openid: openid,
        wechat_unionid: unionid,
        wechat_nickname: nickname,
        wechat_avatar: avatar,
        wechat_bound_at: nowIso,
        auth_provider: profile.auth_provider || 'wechat',
        display_name: profile.display_name || nickname,
        avatar: profile.avatar || avatar,
        ...profileIdentityPatch(profile, ['player']),
      }).eq('id', profile.id);
    } else {
      const inserted = await supabase.from('lc_profiles').insert({
        phone: null,
        display_name: nickname,
        avatar,
        role: 'player',
        role_type: 'player',
        identity_roles: ['player'],
        password_hash: null,
        is_visible: true,
        balance: 30,
        paid_balance: 0,
        bonus_balance: 30,
        auth_provider: 'wechat',
        wechat_openid: openid,
        wechat_unionid: unionid,
        wechat_nickname: nickname,
        wechat_avatar: avatar,
        wechat_bound_at: nowIso,
      }).select().single();
      if (!inserted.data) throw inserted.error || new Error('微信登录创建账号失败');
      profile = inserted.data;
      await supabase.from('lc_transactions').insert({
        profile_id: profile.id,
        type: 'recharge',
        amount: 30,
        paid_amount: 0,
        bonus_amount: 30,
        description: '新用户注册赠送 30 契约币',
        status: 'approved',
        balance_before: 0,
        balance_after: 30,
        paid_balance_before: 0,
        paid_balance_after: 0,
        bonus_balance_before: 0,
        bonus_balance_after: 30,
      });
      await runReferralSideEffect('wechat-signup', () => registerReferralForNewProfile(profile, statePayload.referralCode));
    }

    const token = signProfileAuthToken(profile);
    await logSecurityEvent(req, {
      action: 'auth_wechat_login_success',
      targetType: 'profile',
      targetId: profile.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { has_unionid: Boolean(unionid), wechat_bound_at: nowIso },
    });

    const payload = Buffer.from(JSON.stringify({
      id: profile.id,
      display_name: profile.display_name || nickname,
      phone: profile.phone || '',
      city: profile.city || null,
      available_cities: profile.available_cities || [],
      role: profile.role,
      token,
      auth_provider: 'wechat',
    })).toString('base64url');
    const redirectPath = safeFrontendRedirect(statePayload.redirectPath);
    res.redirect(`${LINGQI_SITE_URL}/login?wechat_login=${encodeURIComponent(payload)}&redirect=${encodeURIComponent(redirectPath)}`);
  } catch (e) {
    res.redirect(`${LINGQI_SITE_URL}/login?auth_error=${encodeURIComponent(err(e).error || '微信登录失败')}`);
  }
});

app.post('/api/lc/miniapp/auth/wechat', async (req, res) => {
  try {
    if (!isWechatMiniLoginConfigured()) return res.status(503).json(err(new Error('微信小程序登录尚未配置')));
    const code = cleanText(req.body?.code, 200);
    const displayNameInput = cleanText(req.body?.displayName, 80);
    const avatarInput = cleanText(req.body?.avatar, 800);
    const referralCode = cleanText(req.body?.referralCode, 16).toUpperCase();
    if (!code) return res.status(400).json(err(new Error('缺少微信登录 code')));

    const sessionUrl = new URL('https://api.weixin.qq.com/sns/jscode2session');
    sessionUrl.search = new URLSearchParams({
      appid: LINGQI_WECHAT_MINI_APP_ID,
      secret: LINGQI_WECHAT_MINI_APP_SECRET,
      js_code: code,
      grant_type: 'authorization_code',
    }).toString();
    const sessionResp = await fetch(sessionUrl);
    const sessionData = await sessionResp.json() as Record<string, unknown>;
    if (!sessionResp.ok || sessionData.errcode) {
      throw new Error(String(sessionData.errmsg || '微信小程序登录失败'));
    }

    const openid = cleanText(sessionData.openid, 120);
    const unionid = cleanText(sessionData.unionid, 120) || null;
    if (!openid) throw new Error('微信小程序登录缺少 openid');

    const nowIso = new Date().toISOString();
    let query = supabase.from('lc_profiles').select('*');
    if (unionid) query = query.eq('wechat_unionid', unionid);
    else query = query.eq('wechat_mini_openid', openid);
    const profileResult = await query.maybeSingle();
    let profile = profileResult.data;
    const profileErr = profileResult.error;
    if (profileErr && isMissingRelation(profileErr, 'wechat_mini_openid')) {
      return res.status(503).json(err(new Error('微信小程序登录字段尚未初始化')));
    }
    if (profileErr) throw profileErr;

    if (profile?.is_banned) {
      await logSecurityEvent(req, {
        action: 'auth_miniapp_login_blocked_banned_user',
        targetType: 'profile',
        targetId: profile.id,
        actorId: profile.id,
        actorRole: profile.role || 'creator',
        metadata: { reason: profile.ban_reason || null },
      });
      return res.status(403).json(err(new Error('账号已被限制登录，请联系管理员申诉')));
    }

    const displayName = displayNameInput || profile?.display_name || `微信用户${openid.slice(-4)}`;
    if (profile) {
      const patch: Record<string, unknown> = {
        wechat_mini_openid: openid,
        wechat_unionid: unionid || profile.wechat_unionid || null,
        wechat_bound_at: nowIso,
        auth_provider: profile.auth_provider || 'wechat_miniapp',
        display_name: profile.display_name || displayName,
        avatar: profile.avatar || avatarInput || null,
        ...profileIdentityPatch(profile, ['player']),
      };
      await supabase.from('lc_profiles').update(patch).eq('id', profile.id);
      profile = { ...profile, ...patch };
    } else {
      const inserted = await supabase.from('lc_profiles').insert({
        phone: null,
        display_name: displayName,
        avatar: avatarInput || null,
        role: 'player',
        role_type: 'player',
        identity_roles: ['player'],
        password_hash: null,
        is_visible: true,
        balance: 30,
        paid_balance: 0,
        bonus_balance: 30,
        auth_provider: 'wechat_miniapp',
        wechat_mini_openid: openid,
        wechat_unionid: unionid,
        wechat_bound_at: nowIso,
      }).select().single();
      if (!inserted.data) throw inserted.error || new Error('微信小程序登录创建账号失败');
      profile = inserted.data;
      await supabase.from('lc_transactions').insert({
        profile_id: profile.id,
        type: 'recharge',
        amount: 30,
        paid_amount: 0,
        bonus_amount: 30,
        description: '新用户注册赠送 30 契约币',
        status: 'approved',
        balance_before: 0,
        balance_after: 30,
        paid_balance_before: 0,
        paid_balance_after: 0,
        bonus_balance_before: 0,
        bonus_balance_after: 30,
      });
      await runReferralSideEffect('miniapp-signup', () => registerReferralForNewProfile(profile, referralCode));
    }

    const token = signProfileAuthToken(profile);
    await logSecurityEvent(req, {
      action: 'auth_miniapp_login_success',
      targetType: 'profile',
      targetId: profile.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { has_unionid: Boolean(unionid), wechat_bound_at: nowIso },
    });

    res.json(ok({
      id: profile.id,
      display_name: profile.display_name || displayName,
      avatar: profile.avatar || avatarInput || null,
      phone: profile.phone || '',
      phone_verified_at: profile.phone_verified_at || null,
      city: profile.city || null,
      available_cities: profile.available_cities || [],
      role: profile.role,
      token,
      auth_provider: 'wechat_miniapp',
      has_password: Boolean(profile.password_hash),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/auth', async (req, res) => {
  try {
    const { phone, account, password, displayName, activityCities } = req.body;
    const activityCityList = normalizeActivityCities(activityCities, req.body?.city);
    const primaryCity = activityCityList[0] || null;
    const rawAccount = cleanText(account || phone, 160);
    if (!rawAccount || !password) {
      return res.status(400).json(err(new Error('请填写手机号或邮箱和密码')));
    }

    const isEmailLogin = rawAccount.includes('@');
    const loginAccount = isEmailLogin ? normalizeEmail(rawAccount) : normalizeChinaPhone(rawAccount);
    const loginColumn = isEmailLogin ? 'email' : 'phone';
    const { data: existing } = await supabase.from('lc_profiles').select('*').eq(loginColumn, loginAccount).maybeSingle();

    if (existing) {
      if (!existing.password_hash) {
        await logSecurityEvent(req, {
          action: 'auth_legacy_password_missing',
          targetType: 'profile',
          targetId: existing.id,
          actorId: existing.id,
          actorRole: existing.role || 'creator',
          metadata: isEmailLogin ? { email_hash: makeAuthEmailHash(loginAccount) } : { phone_hash: makeAuthPhoneHash(loginAccount) },
        });
        return res.status(409).json(err(new Error('该账号已通过验证码或微信注册；如忘记密码，请用手机号或邮箱验证码重新验证并设置新密码')));
      }
      if (existing.is_banned) {
        await logSecurityEvent(req, {
          action: 'auth_login_blocked_banned_user',
          targetType: 'profile',
          targetId: existing.id,
          actorId: existing.id,
          actorRole: existing.role || 'creator',
          metadata: { reason: existing.ban_reason || null },
        });
        return res.status(403).json(err(new Error('账号已被限制登录，请联系管理员申诉')));
      }
      const valid = await bcrypt.compare(password, existing.password_hash);
      if (!valid) {
        await logSecurityEvent(req, {
          action: 'auth_login_failed',
          targetType: 'profile',
          targetId: existing.id,
          actorId: existing.id,
          actorRole: existing.role || 'creator',
          metadata: { ...(isEmailLogin ? { email_hash: makeAuthEmailHash(loginAccount) } : { phone_hash: makeAuthPhoneHash(loginAccount) }), reason: 'bad_password' },
        });
        return res.status(401).json(err(new Error('密码错误')));
      }

      const profilePatch: Record<string, unknown> = profileIdentityPatch(existing, ['player']);
      if (displayName) profilePatch.display_name = displayName;
      if (activityCityList.length > 0) {
        profilePatch.available_cities = activityCityList;
        if (!existing.city && primaryCity) profilePatch.city = primaryCity;
      }
      if (Object.keys(profilePatch).length > 0) {
        await supabase.from('lc_profiles').update(profilePatch).eq('id', existing.id);
      }

      const token = signProfileAuthToken(existing);
      const isShop = existing.role === 'shop';
      await logSecurityEvent(req, {
        action: 'auth_login_success',
        targetType: 'profile',
        targetId: existing.id,
        actorId: existing.id,
        actorRole: existing.role || 'creator',
      });
      return res.json(ok({
        id: existing.id,
        display_name: String(profilePatch.display_name || existing.display_name),
        phone: existing.phone || '',
        email: existing.email || '',
        city: profilePatch.city || existing.city || null,
        available_cities: profilePatch.available_cities || existing.available_cities || [],
        phone_verified_at: existing.phone_verified_at || null,
        email_verified_at: existing.email_verified_at || null,
        has_password: true,
        role: existing.role,
        token,
        ...(isShop ? { juzhanggui_link: 'https://jusichen.com' } : {}),
      }));
    }

    await logSecurityEvent(req, {
      action: 'auth_legacy_register_blocked',
      metadata: { ...(isEmailLogin ? { email_hash: makeAuthEmailHash(loginAccount) } : { phone_hash: makeAuthPhoneHash(loginAccount) }), reason: 'password_signup_disabled' },
    });
    return res.status(404).json(err(new Error('该账号还没有注册。请先用手机号或邮箱验证码注册，并在注册时设置登录密码。')));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/me', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabase.from('lc_profiles')
      .select('id, display_name, avatar, phone, phone_verified_at, email, email_verified_at, password_hash, is_realname, city, available_cities, role, role_type, identity_roles, verified_dm, verified_shop, referral_code, community_role, community_role_expires_at')
      .eq('id', getReq(req, 'creatorId'))
      .single();
    res.json(ok(data ? sanitizeProfile(data, true) : null));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/referrals/resolve/:code', async (req, res) => {
  try {
    const owner = await findReferralOwner(req.params.code);
    if (!owner) return res.json(ok(null));
    res.json(ok({
      referral_code: normalizeReferralCode(owner.referral_code),
      display_name: owner.display_name || '受邀用户',
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/referrals/me', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req) as ReferralProfile & { balance?: number };
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));

    const referralCode = await ensureReferralCodeForProfile(profile);
    const { data: referralRows, error: referralErr } = await supabase.from('lc_referrals')
      .select('id, invitee_id, referral_code, status, invitee_bonus_awarded_at, stage1_awarded_at, stage2_awarded_at, stage2_reason, created_at')
      .eq('referrer_id', profile.id)
      .order('created_at', { ascending: false });
    if (referralErr) throw referralErr;

    const inviteeIds = Array.from(new Set((referralRows || []).map((row: { invitee_id: string }) => row.invitee_id).filter(Boolean)));
    let inviteeMap = new Map<string, { id: string; display_name?: string | null; avatar?: string | null; created_at?: string | null }>();
    if (inviteeIds.length > 0) {
      const { data: invitees, error: inviteeErr } = await supabase.from('lc_profiles')
        .select('id, display_name, avatar, created_at')
        .in('id', inviteeIds);
      if (inviteeErr) throw inviteeErr;
      inviteeMap = new Map((invitees || []).map((item: { id: string; display_name?: string | null; avatar?: string | null; created_at?: string | null }) => [item.id, item]));
    }

    const referrals = (referralRows || []).map((row: {
      id: string;
      invitee_id: string;
      status: string;
      invitee_bonus_awarded_at?: string | null;
      stage1_awarded_at?: string | null;
      stage2_awarded_at?: string | null;
      stage2_reason?: string | null;
      created_at: string;
    }) => {
      const invitee = inviteeMap.get(row.invitee_id);
      return {
        id: row.id,
        status: row.status,
        invitee: {
          id: row.invitee_id,
          display_name: invitee?.display_name || '新用户',
          avatar: invitee?.avatar || null,
        },
        invitee_bonus_awarded_at: row.invitee_bonus_awarded_at || null,
        stage1_awarded_at: row.stage1_awarded_at || null,
        stage2_awarded_at: row.stage2_awarded_at || null,
        stage2_reason: row.stage2_reason || null,
        created_at: row.created_at,
      };
    });

    const validInvites = referrals.filter(row => row.stage1_awarded_at || row.stage2_awarded_at).length;
    const convertedInvites = referrals.filter(row => row.stage2_awarded_at).length;
    const inviteeBonusCount = referrals.filter(row => row.invitee_bonus_awarded_at).length;
    const stage1RewardCount = referrals.filter(row => row.stage1_awarded_at).length;
    const stage2RewardCount = referrals.filter(row => row.stage2_awarded_at).length;
    const nextMilestone = nextReferralMilestone(validInvites);
    const communityRoleExpiresAt = profile.community_role_expires_at || null;
    const communityRoleExpired = communityRoleExpiresAt ? new Date(communityRoleExpiresAt).getTime() < Date.now() : false;

    res.json(ok({
      referral_code: referralCode,
      share_url: `${LINGQI_SITE_URL}/login?ref=${encodeURIComponent(referralCode)}`,
      community_role: communityRoleExpired ? null : (profile.community_role || null),
      community_role_expires_at: communityRoleExpired ? null : communityRoleExpiresAt,
      stats: {
        registered_invites: referrals.length,
        valid_invites: validInvites,
        converted_invites: convertedInvites,
        invitee_bonus_count: inviteeBonusCount,
        referrer_reward_total: stage1RewardCount * 10 + stage2RewardCount * 20,
        next_milestone: nextMilestone,
      },
      rules: {
        new_user_base_bonus: 30,
        invitee_extra_bonus: 10,
        referrer_stage1_bonus: 10,
        referrer_stage2_bonus: 20,
      },
      referrals,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/profile/:id/realname', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { value } = req.body;
    await supabase.from('lc_profiles').update({ is_realname: !!value }).eq('id', req.params.id);
    if (value) {
      await runReferralSideEffect('stage2-after-realname', () => maybeAwardReferralStage2(req.params.id, 'realname_approved'));
    }
    await logSecurityEvent(req, {
      action: value ? 'admin_profile_realname_marked' : 'admin_profile_realname_unmarked',
      targetType: 'profile',
      targetId: req.params.id,
      metadata: { is_realname: !!value },
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 创作者列表（分页） ====================

app.get('/api/lc/creators', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const city = cleanText(req.query.city, 60);

    const { data: serviceRows, error: serviceErr } = await supabase
      .from('lc_services')
      .select('creator_id, service_type')
      .eq('is_active', true);
    if (serviceErr) throw serviceErr;

    const serviceCreatorIds = Array.from(new Set((serviceRows || [])
      .map((row: { creator_id?: string | null }) => row.creator_id)
      .filter((id): id is string => Boolean(id))));
    const serviceTypesByCreator = new Map<string, string[]>();
    for (const row of (serviceRows || []) as Array<{ creator_id?: string | null; service_type?: string | null }>) {
      if (!row.creator_id) continue;
      const current = serviceTypesByCreator.get(row.creator_id) || [];
      current.push(row.service_type || '');
      serviceTypesByCreator.set(row.creator_id, current);
    }

    if (serviceCreatorIds.length === 0) {
      return res.json(ok({
        items: [],
        total: 0,
        page,
        totalPages: 1,
      }));
    }

    const { data } = await supabase
      .from('lc_profiles')
      .select('*')
      .eq('is_visible', true)
      .in('id', serviceCreatorIds)
      .order('created_at', { ascending: false })
      .limit(500);

    const visibleProfiles = (data || []).filter((profile: Record<string, unknown>) => {
      if (!city) return true;
      const availableCities = Array.isArray(profile.available_cities) ? profile.available_cities : [];
      return profile.city === city || availableCities.includes(city);
    });
    const total = visibleProfiles.length;
    const offset = (page - 1) * limit;
    const pagedItems = visibleProfiles.slice(offset, offset + limit);

    res.json(ok({
      items: pagedItems.map(profile => {
        const serviceRoles = identityRolesFromServices(serviceTypesByCreator.get(String(profile.id)) || []);
        return sanitizeProfile({
          ...profile,
          identity_roles: mergeIdentityRoles(profile.identity_roles, serviceRoles),
        });
      }),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
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

    const [{ data: services }, { data: portfolio }, { data: pendingCerts }, { data: pendingDmClaims }, rolePreferences] = await Promise.all([
      supabase.from('lc_services').select('*').eq('creator_id', req.params.id).eq('is_active', true),
      supabase.from('lc_portfolio').select('*').eq('creator_id', req.params.id).order('created_at', { ascending: false }),
      supabase.from('lc_certifications').select('type, status').eq('profile_id', req.params.id).eq('status', 'pending'),
      supabase.from('lc_dm_dossier_claims').select('id').eq('claimant_id', req.params.id).eq('entity_type', 'dm').eq('status', 'pending').limit(1),
      loadProfileRolePreferences(req.params.id),
    ]);

    const hasPendingShopCert = (pendingCerts || []).some((c: { type: string }) => c.type === 'shop');
    const hasPendingDmCert = (pendingCerts || []).some((c: { type: string }) => c.type === 'dm') || (pendingDmClaims || []).length > 0;
    const serviceRoles = identityRolesFromServices((services || []).map((service: { service_type?: string | null }) => service.service_type || ''));

    res.json(ok({
      ...profilePayload,
      identity_roles: mergeIdentityRoles(profilePayload.identity_roles, serviceRoles),
      services: services || [],
      portfolio: portfolio || [],
      role_preferences: rolePreferences || [],
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
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const {
      display_name, avatar, bio, tags, city, social_links, wechat,
      available_cities, travel_status, contact_unlock_enabled, contact_intent_amount,
      gender, sexual_orientation, preferred_story_lines, role_preferences,
    } = req.body;
    const socialSnapshots = makeSocialSnapshots(social_links);
    const rolePreferences = await sanitizeProfileRolePreferences(role_preferences);
    const normalizedTravelStatus = travel_status === '常驻本地'
      ? '常驻所在城市'
      : (travel_status || '常驻所在城市');
    const profilePatch = {
      display_name, avatar, bio, tags, city, social_links, wechat,
      gender: cleanChoice(gender, PROFILE_GENDER_OPTIONS),
      sexual_orientation: cleanChoice(sexual_orientation, PROFILE_ORIENTATION_OPTIONS),
      preferred_story_lines: cleanTextArray(preferred_story_lines),
      available_cities: Array.isArray(available_cities) ? available_cities : [],
      travel_status: normalizedTravelStatus,
      contact_unlock_enabled: !!contact_unlock_enabled,
      contact_intent_amount: Math.max(0, parseInt(contact_intent_amount || 0) || 0),
      social_snapshots: socialSnapshots,
    };
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'profile_update_submit',
      targetType: 'profile_update',
      texts: {
        display_name,
        bio,
        tags: Array.isArray(tags) ? tags.join(' ') : '',
        city,
        wechat,
        social_links: JSON.stringify(social_links || {}),
        preferred_story_lines: cleanTextArray(preferred_story_lines).join(' '),
        available_cities: Array.isArray(available_cities) ? available_cities.join(' ') : '',
        role_preferences: rolePreferences.map(item => `${item.script_name} ${item.role_name} ${item.note || ''}`).join('\n'),
      },
      files: avatar ? [{ url: avatar, type: 'image/*' }] : [],
      allowContact: true,
    });
    const review = await createPublicReview({
      targetType: 'profile_update',
      profile,
      title: '主页资料修改',
      summary: '昵称、头像、简介、社交链接、服务设置或可接角色修改',
      payload: {
        profile_patch: profilePatch,
        role_preferences: Array.isArray(role_preferences) ? rolePreferences.map((item, index) => ({
          script_id: item.script_id,
          script_name: item.script_name,
          role_name: item.role_name,
          role_gender: item.role_gender,
          role_tags: item.role_tags,
          is_recommended: item.is_recommended,
          note: item.note,
          sort_order: index,
        })) : null,
      },
      moderationPrecheck,
    });
    await logSecurityEvent(req, {
      action: 'profile_update_submitted_for_review',
      targetType: 'public_review',
      targetId: review?.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { review_type: 'profile_update', moderation: moderationPrecheck },
    });
    res.json(ok(publicReviewAcceptedResponse(review as Record<string, unknown>)));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 档期管理（需登录） ====================

app.get('/api/lc/creators/:id/availability', async (req, res) => {
  try {
    const from = normalizeDateString(req.query.from) || todayChinaDateString();
    let to = normalizeDateString(req.query.to) || addDaysToDateString(from, 120);
    if (to < from) to = from;
    const { data } = await supabase.from('lc_availability').select('*')
      .eq('creator_id', req.params.id)
      .gte('date', from)
      .lte('date', to)
      .order('date');
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/availability', authMiddleware, async (req, res) => {
  try {
    const { creatorId, date, dates: rawDates, startTime, endTime, note, city, location } = req.body;
    if (getReq(req, 'creatorId') !== creatorId) {
      return res.status(403).json(err(new Error('只能管理自己的档期')));
    }
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { dates, expiredDates, invalidDates } = normalizeAvailabilityDateList(rawDates, date);
    if (dates.length === 0) {
      const reason = expiredDates.length > 0
        ? `这些日期已经过期，不能提交公开档期：${expiredDates.join('、')}`
        : invalidDates.length > 0
          ? `日期格式不正确：${invalidDates.join('、')}`
          : '请选择要提交的可约日期';
      return res.status(400).json(err(new Error(reason)));
    }

    const { data: existingRows, error: existingErr } = await supabase.from('lc_availability')
      .select('date')
      .eq('creator_id', creatorId)
      .eq('is_booked', false)
      .in('date', dates);
    if (existingErr) throw existingErr;
    const duplicateDates = new Set((existingRows || []).map((item: Record<string, unknown>) => cleanText(item.date, 20)).filter(Boolean));

    const { data: pendingRows, error: pendingErr } = await supabase.from('lc_public_reviews')
      .select('payload')
      .eq('profile_id', creatorId)
      .eq('target_type', 'availability_create')
      .eq('status', 'pending')
      .limit(500);
    if (pendingErr && !isMissingRelation(pendingErr, 'lc_public_reviews')) throw pendingErr;
    for (const row of (pendingRows || []) as Array<Record<string, unknown>>) {
      const pendingPayload = objectPayload(row.payload);
      for (const item of payloadItems(pendingPayload)) {
        const pendingCreatorId = cleanText(item.creator_id, 80);
        const pendingDate = normalizeDateString(item.date);
        if (pendingCreatorId === creatorId && pendingDate && dates.includes(pendingDate)) duplicateDates.add(pendingDate);
      }
    }

    const finalDates = dates.filter(item => !duplicateDates.has(item));
    if (finalDates.length === 0) {
      return res.status(409).json(err(new Error(`这些日期已经公开或正在审核：${dates.join('、')}`)));
    }

    const items = finalDates.map(dateItem => ({
      creator_id: creatorId,
      date: dateItem,
      start_time: normalizeClockTime(startTime, '09:00'),
      end_time: normalizeClockTime(endTime, '22:00'),
      note: cleanText(note, 500) || null,
      city: cleanText(city, 80) || null,
      location: cleanText(location, 120) || null,
      source: 'manual',
    }));
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'availability_submit',
      targetType: 'availability',
      texts: { dates: finalDates.join('、'), startTime, endTime, note, city, location },
    });
    const review = await createPublicReview({
      targetType: 'availability_create',
      profile,
      title: finalDates.length === 1 ? `档期：${finalDates[0]}` : `可约档期：${finalDates.length} 天`,
      summary: `${cleanText(city, 80) || '未填城市'} ${cleanText(location, 120) || ''}`.trim(),
      payload: { items },
      moderationPrecheck,
    });
    await logSecurityEvent(req, {
      action: 'availability_submitted_for_review',
      targetType: 'public_review',
      targetId: review?.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { dates: finalDates, skipped_dates: Array.from(duplicateDates), expired_dates: expiredDates, moderation: moderationPrecheck },
    });
    res.json(ok({
      ...publicReviewAcceptedResponse(review as Record<string, unknown>),
      dates: finalDates,
      skipped_dates: dates.filter(item => duplicateDates.has(item)),
    }));
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
        message: '没有在剧司辰卡司表里找到同手机号或同昵称的卡司。请先在剧司辰卡司档案里补齐手机号，或把卡司名改成剧幕录昵称。',
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
      const item = {
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
      };
      imported.push(item);
    }

    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'availability_screenshot_submit',
      targetType: 'availability',
      texts: { rawText, city, location },
      files: screenshotUrl ? [{ url: screenshotUrl, type: 'image/*' }] : [],
    });
    const review = await createPublicReview({
      targetType: 'availability_create',
      profile,
      title: `截图档期导入：${dates.length} 天`,
      summary: `${city || '未填城市'} ${location || ''}`.trim(),
      payload: { items: imported },
      moderationPrecheck,
    });
    await logSecurityEvent(req, {
      action: 'availability_screenshot_submitted_for_review',
      targetType: 'public_review',
      targetId: review?.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { dates, expiredDates, moderation: moderationPrecheck },
    });
    res.json(ok({ ...publicReviewAcceptedResponse(review as Record<string, unknown>), imported: 0, items: [], dates, expiredDates }));
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
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const rawServices = Array.isArray(req.body?.services)
      ? req.body.services as unknown[]
      : [{ serviceType, price, duration, description }];
    const seen = new Set<string>();
    const items = rawServices.map(item => normalizeServiceSubmission(objectPayload(item), creatorId))
      .filter((item): item is NonNullable<ReturnType<typeof normalizeServiceSubmission>> => Boolean(item))
      .filter(item => {
        const key = `${item.service_type}|${item.price}|${item.duration || ''}|${item.description || ''}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (items.length === 0) return res.status(400).json(err(new Error('请填写服务类型和纯数字价格')));
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'service_submit',
      targetType: 'service',
      texts: {
        serviceTypes: items.map(item => item.service_type).join('、'),
        durations: items.map(item => item.duration || '').filter(Boolean).join('、'),
        descriptions: items.map(item => item.description || '').filter(Boolean).join('\n'),
      },
      allowContact: true,
    });
    const review = await createPublicReview({
      targetType: 'service_create',
      profile,
      title: items.length === 1 ? `服务上线：${items[0].service_type}` : `服务上线：${items.length} 项`,
      summary: items.map(item => `${item.service_type}${item.duration ? ` · ${item.duration}` : ''}`).join('；'),
      payload: { creator_id: creatorId, items },
      moderationPrecheck,
    });
    await logSecurityEvent(req, {
      action: 'service_submitted_for_review',
      targetType: 'public_review',
      targetId: review?.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { service_count: items.length, moderation: moderationPrecheck },
    });
    res.json(ok({
      ...publicReviewAcceptedResponse(review as Record<string, unknown>),
      service_count: items.length,
    }));
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
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    if (!imageUrl) return res.status(400).json(err(new Error('请先上传作品图片')));
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'portfolio_submit',
      targetType: 'portfolio',
      texts: { caption },
      files: [{ url: imageUrl, type: 'image/*' }],
    });
    const review = await createPublicReview({
      targetType: 'portfolio_create',
      profile,
      title: '作品图片',
      summary: caption || '作品集图片',
      payload: { creator_id: creatorId, image_url: imageUrl, caption: caption || null },
      moderationPrecheck,
    });
    await logSecurityEvent(req, {
      action: 'portfolio_submitted_for_review',
      targetType: 'public_review',
      targetId: review?.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { moderation: moderationPrecheck },
    });
    res.json(ok(publicReviewAcceptedResponse(review as Record<string, unknown>)));
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

    const image = await sanitizeUploadedImageFile({ buffer: file.buffer, mimetype: file.mimetype });
    const scope = sanitizeUploadScope(req.body?.scope);
    const digest = createHash('sha256').update(file.buffer).digest('hex').slice(0, 16);
    const result = await saveLingqiSanitizedUploadImage(image, `${getReq(req, 'creatorId')}/${scope}`, {
      env: process.env,
      localUploadRoot: LOCAL_UPLOAD_ROOT,
      siteUrl: LINGQI_SITE_URL,
      randomId: () => `${Date.now()}-${digest}`,
      cosTransport: LINGQI_COS_UPLOAD_TRANSPORT,
    });

    res.json(ok({
      url: result.url,
      path: result.relativePath,
      name: file.originalname,
      type: image.contentType,
      size: image.buffer.length,
      width: image.width,
      height: image.height,
    }));
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
    const city = cleanText(req.query.city, 40);
    const targetType = cleanText(req.query.targetType, 40);
    const scriptId = cleanText(req.query.scriptId, 80);
    const script = cleanText(req.query.script, 80);
    let query = supabase.from('lc_commissions')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (city && city !== 'all') query = query.eq('city', city);
    if (targetType && targetType !== 'all') query = query.eq('target_type', targetType);
    if (scriptId && scriptId !== 'all') query = query.eq('script_id', scriptId);
    else if (script && script !== 'all') query = query.ilike('script_name', `%${script}%`);
    const { data, error: qErr } = await query;
    if (qErr) throw qErr;
    res.json(ok(withCommissionExpiration((data || []) as Record<string, unknown>[])));
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
    res.json(ok(withCommissionExpiration((data || []) as Record<string, unknown>[])));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/commissions', authMiddleware, async (req, res) => {
  try {
    const {
      title, content, desiredRole, targetType, neededDate,
      city, location, budget, contactNote, aiAssistContext,
    } = req.body;
    const scriptIdInput = cleanText(req.body.scriptId, 80);
    let scriptName = cleanText(req.body.scriptName, 100);
    let scriptId: string | null = null;
    if (!title || !content) return res.status(400).json(err(new Error('请填写标题和需求内容')));

    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'commission_submit',
      targetType: 'commission',
      texts: { title, content, desiredRole, targetType, city, location, budget, contactNote, scriptName },
      files: req.body?.files,
      allowContact: true,
    });

    if (scriptIdInput) {
      const scriptRow = findSharedScript(await loadSharedScriptCatalog(), scriptIdInput);
      if (!scriptRow) return res.status(400).json(err(new Error('选择的剧本不存在')));
      scriptId = scriptRow.id;
      scriptName = scriptRow.name;
    }

    const { data, error: insErr } = await supabase.from('lc_commissions').insert({
      poster_id: profile.id,
      poster_name: profile.display_name,
      poster_is_realname: !!profile.is_realname,
      title,
      content,
      script_id: scriptId,
      script_name: scriptName || null,
      desired_role: desiredRole || null,
      target_type: targetType || null,
      needed_date: neededDate || null,
      city: city || null,
      location: location || null,
      budget: budget || null,
      contact_note: contactNote || null,
      ai_assist_context: aiAssistContext || {},
      moderation_precheck: moderationPrecheck,
    }).select().single();
    if (insErr) throw insErr;

    await logSecurityEvent(req, {
      action: 'commission_submitted',
      targetType: 'commission',
      targetId: data?.id,
      metadata: { city: city || null, target_type: targetType || null, script_id: scriptId, script_name: scriptName || null, moderation: moderationPrecheck },
    });
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
    await logSecurityEvent(req, {
      action: 'commission_closed_by_author',
      targetType: 'commission',
      targetId: req.params.id,
    });
    res.json(ok({ id: req.params.id, status: 'closed' }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 拼车区 ====================

app.get('/api/lc/scripts', async (_req, res) => {
  try {
    const data = await loadSharedScriptCatalog();
    const scriptIds = data.map(script => script.id);
    let ratingMap = new Map<string, RatingSummary>();
    if (scriptIds.length) {
      const { data: ratings, error: ratingErr } = await supabase.from('lc_script_ratings')
        .select('script_id, rating')
        .in('script_id', scriptIds)
        .eq('status', 'approved');
      if (ratingErr && !isMissingRelation(ratingErr, 'lc_script_ratings')) throw ratingErr;
      ratingMap = buildRatingMap(ratings as Record<string, unknown>[] | null | undefined, 'script_id');
    }

    const roleTargetIds = new Set(data.flatMap(script => [...script.player_roles, ...script.actor_roles].map(role => role.target_id).filter(Boolean)));

    let roleRatingMap = new Map<string, RatingSummary>();
    if (roleTargetIds.size > 0) {
      const { data: roleRatings, error: roleRatingErr } = await supabase.from('lc_entity_ratings')
        .select('target_id, rating')
        .eq('target_type', 'script_role')
        .in('target_id', Array.from(roleTargetIds))
        .eq('status', 'approved');
      if (roleRatingErr && !isMissingRelation(roleRatingErr, 'lc_entity_ratings')) throw roleRatingErr;
      roleRatingMap = buildRatingMap(roleRatings as Record<string, unknown>[] | null | undefined, 'target_id');
    }

    res.json(ok(data.map(script => ({
      id: script.id,
      name: script.name,
      duration_minutes: script.duration_minutes || null,
      min_duration_hours: script.min_duration_hours || null,
      max_duration_hours: script.max_duration_hours || null,
      credits: sanitizeScriptCredits(script.credits),
      rating_avg: ratingMap.get(script.id)?.avg || null,
      rating_count: ratingMap.get(script.id)?.count || 0,
      player_roles: script.player_roles.map(role => {
        const summary = roleRatingMap.get(role.target_id) || { avg: null, count: 0 };
        return {
          ...role,
          role_kind: 'player',
          role_source: 'player',
          rating_avg: summary.avg,
          rating_count: summary.count,
        };
      }),
      actor_roles: script.actor_roles.map(role => {
        const summary = roleRatingMap.get(role.target_id) || { avg: null, count: 0 };
        return {
          ...role,
          rating_avg: summary.avg,
          rating_count: summary.count,
        };
      }),
    }))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/tags', async (req, res) => {
  try {
    const targetType = cleanText(req.query.targetType, 40);
    const targetId = cleanText(req.query.targetId, 120);
    if (!targetType || !targetId) return res.status(400).json(err(new Error('缺少标签对象')));
    const creatorId = getOptionalCreatorId(req);
    const { data, error: qErr } = await supabase.from('lc_entity_tags')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('status', 'approved')
      .order('likes', { ascending: false })
      .order('created_at', { ascending: true });
    if (qErr && isMissingRelation(qErr, 'lc_entity_tags')) return res.json(ok([]));
    if (qErr) throw qErr;
    let liked = new Set<string>();
    if (creatorId && (data || []).length) {
      const { data: votes } = await supabase.from('lc_entity_tag_votes')
        .select('tag_id')
        .in('tag_id', (data || []).map((tag: Record<string, unknown>) => String(tag.id)))
        .eq('voter_id', creatorId);
      liked = new Set((votes || []).map((vote: Record<string, unknown>) => String(vote.tag_id)));
    }
    res.json(ok((data || []).map((tag: Record<string, unknown>) => ({ ...tag, liked_by_me: liked.has(String(tag.id)) }))));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/lc/tags', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    const blockReason = getSpeakBlockReason(profile);
    if (blockReason) return res.status(403).json(err(new Error(blockReason)));
    const targetType = cleanText(req.body?.targetType, 40);
    const targetId = cleanText(req.body?.targetId, 120);
    const tag = cleanText(req.body?.tag, 24);
    if (!targetType || !targetId || !tag) return res.status(400).json(err(new Error('请填写标签')));
    const normalizedTag = tag.toLowerCase();
    const existingQuery = await supabase.from('lc_entity_tags')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('normalized_tag', normalizedTag)
      .eq('status', 'approved')
      .maybeSingle();
    if (existingQuery.error && !isMissingRelation(existingQuery.error, 'lc_entity_tags')) throw existingQuery.error;
    if (existingQuery.data) return res.json(ok(existingQuery.data));
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'tag_submit',
      targetType: 'tag',
      texts: { tag, targetType, targetId },
    });
    const review = await createPublicReview({
      targetType: 'tag_create',
      profile,
      title: `标签：${tag}`,
      summary: `${targetType} / ${targetId}`,
      payload: {
        target_type: targetType,
        target_id: targetId,
        tag,
        normalized_tag: normalizedTag,
        creator_id: profile.id,
        creator_name: profile.display_name || '用户',
      },
      moderationPrecheck,
    });
    await logSecurityEvent(req, {
      action: 'tag_submitted_for_review',
      targetType: 'public_review',
      targetId: review?.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { target_type: targetType, target_id: targetId, moderation: moderationPrecheck },
    });
    res.json(ok(publicReviewAcceptedResponse(review as Record<string, unknown>)));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/lc/tags/:id/like', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    const blockReason = getSpeakBlockReason(profile);
    if (blockReason) return res.status(403).json(err(new Error(blockReason)));
    const tagId = cleanText(req.params.id, 80);
    const { data: tag, error: tagErr } = await supabase.from('lc_entity_tags').select('id').eq('id', tagId).maybeSingle();
    if (tagErr && isMissingRelation(tagErr, 'lc_entity_tags')) return res.status(503).json(err(new Error('标签表尚未初始化')));
    if (tagErr) throw tagErr;
    if (!tag) return res.status(404).json(err(new Error('标签不存在')));
    const vote = await supabase.from('lc_entity_tag_votes').insert({ tag_id: tagId, voter_id: profile.id }).select().maybeSingle();
    if (vote.error && !String(vote.error.message || '').includes('duplicate') && !String(vote.error.code || '').includes('23505')) throw vote.error;
    const { count } = await supabase.from('lc_entity_tag_votes').select('*', { count: 'exact', head: true }).eq('tag_id', tagId);
    await supabase.from('lc_entity_tags').update({ likes: count || 0, updated_at: new Date().toISOString() }).eq('id', tagId);
    res.json(ok({ id: tagId, likes: count || 0 }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.get('/api/lc/scripts/:id/ratings', async (req, res) => {
  try {
    const scriptId = cleanText(req.params.id, 120);
    const creatorId = getOptionalCreatorId(req);
    const { data, error: qErr } = await supabase.from('lc_script_ratings')
      .select('*')
      .eq('script_id', scriptId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(50);
    if (qErr && isMissingRelation(qErr, 'lc_script_ratings')) return res.json(ok({ ratings: [], mine: null, summary: { avg: null, count: 0 } }));
    if (qErr) throw qErr;
    const values = (data || []).map((row: Record<string, unknown>) => Number(row.rating || 0)).filter(Boolean);
    const mine = creatorId ? (data || []).find((row: Record<string, unknown>) => String(row.profile_id) === creatorId) || null : null;
    res.json(ok({
      ratings: data || [],
      mine,
      summary: {
        avg: values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null,
        count: values.length,
      },
    }));
  } catch (e) { res.status(500).json(err(e)); }
});
app.post('/api/lc/scripts/:id/ratings', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    const blockReason = getSpeakBlockReason(profile);
    if (blockReason) return res.status(403).json(err(new Error(blockReason)));
    const scriptId = cleanText(req.params.id, 120);
    const rawRating = Number(req.body?.rating || 0);
    if (!Number.isFinite(rawRating) || rawRating < 1 || rawRating > 5) return res.status(400).json(err(new Error('请选择 1-5 分评分')));
    const rating = Math.round(rawRating);
    const content = cleanText(req.body?.content, 1000);
    const tags = cleanTextArray(req.body?.tags, 8, 20);
    const script = findSharedScript(await loadSharedScriptCatalog(), scriptId);
    if (!script) return res.status(404).json(err(new Error('剧本不存在或尚未进入公共剧本库')));
    const scriptName = script.name;
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'script_rating_submit',
      targetType: 'script_rating',
      texts: { scriptName, content, tags: tags.join(' ') },
    });
    const payload = {
      script_id: scriptId,
      script_name: scriptName,
      profile_id: profile.id,
      profile_name: profile.display_name || '用户',
      rating,
      content,
      tags,
      status: 'pending',
      moderation_precheck: moderationPrecheck,
      updated_at: new Date().toISOString(),
    };
    const review = await createPublicReview({
      targetType: 'script_rating_upsert',
      profile,
      title: `剧本评分：${scriptName}`,
      summary: `${rating} 分${content ? ` · ${content.slice(0, 80)}` : ''}`,
      payload,
      moderationPrecheck,
    });
    await logSecurityEvent(req, {
      action: 'script_rating_submitted_for_review',
      targetType: 'public_review',
      targetId: review?.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { script_id: scriptId, rating, moderation: moderationPrecheck },
    });
    res.json(ok(publicReviewAcceptedResponse(review as Record<string, unknown>)));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/entity-ratings', async (req, res) => {
  try {
    const targetType = cleanText(req.query.targetType, 40);
    const targetId = cleanText(req.query.targetId, 120);
    if (targetType !== 'script_role' || !targetId) return res.status(400).json(err(new Error('缺少评分对象')));
    const creatorId = getOptionalCreatorId(req);
    const { data, error: qErr } = await supabase.from('lc_entity_ratings')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(50);
    if (qErr && isMissingRelation(qErr, 'lc_entity_ratings')) return res.json(ok({ ratings: [], mine: null, summary: { avg: null, count: 0 } }));
    if (qErr) throw qErr;
    const rows = (data || []) as Record<string, unknown>[];
    const values = rows.map(row => Number(row.rating || 0));
    const mine = creatorId ? rows.find(row => String(row.profile_id) === creatorId) || null : null;
    res.json(ok({
      ratings: rows,
      mine,
      summary: summarizeRatingValues(values),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/entity-ratings', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    const blockReason = getSpeakBlockReason(profile);
    if (blockReason) return res.status(403).json(err(new Error(blockReason)));
    const targetType = cleanText(req.body?.targetType ?? req.body?.target_type, 40);
    const targetId = cleanText(req.body?.targetId ?? req.body?.target_id, 120);
    if (targetType !== 'script_role' || !targetId) return res.status(400).json(err(new Error('缺少角色对象')));
    const rawRating = Number(req.body?.rating || 0);
    if (!Number.isFinite(rawRating) || rawRating < 1 || rawRating > 5) return res.status(400).json(err(new Error('请选择 1-5 分评分')));
    const rating = Math.round(rawRating);
    const content = cleanText(req.body?.content, 1200);
    if (!content) return res.status(400).json(err(new Error('请写一句评分理由')));
    const spoilerLevel = cleanText(req.body?.spoilerLevel ?? req.body?.spoiler_level, 20) === 'spoiler' ? 'spoiler' : 'none';
    const entity = await getScriptRoleEntity(targetId);
    if (!entity) return res.status(404).json(err(new Error('角色不存在或暂不可评分')));
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'entity_rating_submit',
      targetType: 'entity_rating',
      texts: {
        targetTitle: entity.targetTitle,
        content,
        spoilerLevel,
      },
    });
    const payload = {
      target_type: targetType,
      target_id: entity.targetId,
      target_title: entity.targetTitle,
      profile_id: profile.id,
      profile_name: profile.display_name || '用户',
      rating,
      content,
      spoiler_level: spoilerLevel,
      entity_metadata: {
        script_id: entity.scriptId,
        script_name: entity.scriptName,
        role_id: entity.roleId,
        role_name: entity.roleName,
        role_gender: entity.roleGender,
        role_kind: entity.roleKind,
        role_source: entity.roleSource,
      },
    };
    const review = await createPublicReview({
      targetType: 'entity_rating_upsert',
      profile,
      title: `角色评分：${entity.targetTitle}`,
      summary: `${rating} 分 · ${content.slice(0, 80)}`,
      payload,
      moderationPrecheck,
    });
    await logSecurityEvent(req, {
      action: 'entity_rating_submitted_for_review',
      targetType: 'public_review',
      targetId: review?.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { target_type: targetType, target_id: entity.targetId, rating, moderation: moderationPrecheck },
    });
    res.json(ok(publicReviewAcceptedResponse(review as Record<string, unknown>)));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/stores', async (req, res) => {
  try {
    const city = cleanText(req.query.city, 40);
    const includeReputationCatalog = cleanText(req.query.catalog, 40) === 'reputation';
    const { data, error: qErr } = await supabase.from('jzg_stores')
      .select('id, name, city, address, status, created_at')
      .eq('status', 'active')
      .order('name', { ascending: true })
      .limit(200);
    if (qErr && isMissingRelation(qErr, 'jzg_stores')) return res.json(ok([]));
    if (qErr) throw qErr;

    const libraryRows = (data || []).map((store: Record<string, unknown>) => ({
      id: cleanText(store.id, 80),
      linked_store_id: cleanText(store.id, 80) || null,
      source: 'store_library',
      source_id: cleanText(store.id, 80),
      name: cleanText(store.name, 100),
      city: cleanText(store.city, 40) || null,
      address: cleanText(store.address, 160) || null,
    }));

    if (includeReputationCatalog) {
      const [dossierResult, rankingResult] = await Promise.all([
        supabase.from('lc_dm_dossiers')
          .select('id, dm_name, city, workplace')
          .eq('entity_type', 'store')
          .eq('status', 'approved')
          .limit(500),
        supabase.from('lc_rankings')
          .select('id, subject_name, subject_city')
          .eq('subject_type', 'store')
          .eq('status', 'approved')
          .limit(500),
      ]);
      if (dossierResult.error && !isMissingRelation(dossierResult.error, 'lc_dm_dossiers')) throw dossierResult.error;
      if (rankingResult.error && !isMissingRelation(rankingResult.error, 'lc_rankings')) throw rankingResult.error;

      const reputationRows = [
        ...((dossierResult.data || []).map((store: Record<string, unknown>) => ({
          id: `dossier:${cleanText(store.id, 80)}`,
          linked_store_id: null,
          source: 'store_dossier',
          source_id: cleanText(store.id, 80),
          name: cleanText(store.dm_name, 100),
          city: cleanText(store.city, 40) || null,
          address: cleanText(store.workplace, 160) || null,
        }))),
        ...((rankingResult.data || []).map((store: Record<string, unknown>) => ({
          id: `ranking:${cleanText(store.id, 80)}`,
          linked_store_id: null,
          source: 'ranking',
          source_id: cleanText(store.id, 80),
          name: cleanText(store.subject_name, 100),
          city: cleanText(store.subject_city, 40) || null,
          address: null,
        }))),
      ].filter(store => store.name);

      const deduped = new Map<string, typeof libraryRows[number]>();
      for (const store of [...libraryRows, ...reputationRows]) {
        const key = `${normalizeDmLookupText(store.name)}|${normalizeDmLookupText(store.city)}`;
        const existing = deduped.get(key);
        if (!existing || (!existing.linked_store_id && store.linked_store_id)) deduped.set(key, store);
      }
      libraryRows.splice(0, libraryRows.length, ...deduped.values());
    }

    const rows = libraryRows
      .filter((store: Record<string, unknown>) => {
        const storeCity = cleanText(store.city, 40);
        if (!city || city === 'all') return true;
        return !storeCity || storeCity === city || storeCity === '未设置';
      })
      .sort((left, right) => cleanText(left.name, 100).localeCompare(cleanText(right.name, 100), 'zh-CN'))
      .slice(0, 200);
    res.json(ok(rows));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/scripts/contributions/mine', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data, error: qErr } = await supabase.from('lc_script_contributions')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (qErr && isMissingRelation(qErr, 'lc_script_contributions')) return res.json(ok([]));
    if (qErr) throw qErr;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/scripts/contributions', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));

    const scriptId = cleanText(req.body.scriptId, 80);
    let scriptName = cleanText(req.body.scriptName, 100);
    const roles = sanitizeCarpoolRoles(req.body.playerRoles ?? req.body.scriptRoles);
    const creditsPatch = sanitizeScriptCredits(req.body.creditsPatch ?? req.body.credits);
    const note = cleanText(req.body.note, 800);
    if (!scriptId && !scriptName) return res.status(400).json(err(new Error('请填写或选择剧本名')));
    if (scriptId) {
      const selectedScript = findSharedScript(await loadSharedScriptCatalog(), scriptId);
      if (!selectedScript) return res.status(400).json(err(new Error('选择的剧本不存在或尚未进入公共剧本库')));
      scriptName = selectedScript.name;
    }
    if (roles.length === 0) return res.status(400).json(err(new Error('请至少维护一个玩家角色和角色性别')));
    if (hasMissingScriptContributionGender(roles)) return res.status(400).json(err(new Error('请给每个角色填写性别')));
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'script_contribution_submit',
      targetType: 'script_contribution',
      texts: {
        scriptName,
        note,
        roles: roles.map(role => `${role.role_name} ${role.gender || ''} ${(role.tags || []).join(' ')}`).join('\n'),
        credits: Object.values(creditsPatch).flat().join(' '),
      },
    });

    const { data, error: insErr } = await supabase.from('lc_script_contributions').insert({
      profile_id: profile.id,
      profile_name: profile.display_name,
      script_id: scriptId || null,
      script_name: scriptName,
      player_roles: roles,
      credits_patch: creditsPatch,
      note: note || null,
      status: 'pending',
      reward_amount: SCRIPT_CONTRIBUTION_REWARD,
      moderation_precheck: moderationPrecheck,
    }).select('*').single();
    if (insErr && isMissingRelation(insErr, 'lc_script_contributions')) return res.status(503).json(err(new Error('剧本库共建表尚未初始化')));
    if (insErr) throw insErr;

    await logSecurityEvent(req, {
      action: 'script_contribution_submitted',
      targetType: 'script_contribution',
      targetId: data?.id,
      metadata: { script_id: scriptId || null, script_name: scriptName || null, role_count: roles.length, credit_fields: Object.keys(creditsPatch), moderation: moderationPrecheck },
    });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/carpools', async (req, res) => {
  try {
    const city = req.query.city as string;
    const date = req.query.date as string;
    const script = req.query.script as string;
    let query = supabase.from('lc_carpools')
      .select(`
        id, poster_id, poster_name, poster_is_realname, title, city,
        event_date, start_time, deadline_date, deadline_time,
        script_id, script_name, role_name, role_note, script_roles, seated_roles,
        store_id, store_name, store_city, store_address, store_source_url, store_suggestion_status,
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
    const withApplications = await attachCarpoolApplications((data || []) as Record<string, unknown>[]);
    res.json(ok(withCarpoolExpiration(withApplications as Record<string, unknown>[])));
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
    res.json(ok(withCarpoolExpiration((data || []) as Record<string, unknown>[])));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/carpools', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));

    const title = cleanText(req.body.title, 80);
    const city = cleanText(req.body.city, 40);
    const eventDate = cleanText(req.body.eventDate, 20);
    const startTime = cleanText(req.body.startTime, 20);
    const deadlineDate = cleanText(req.body.deadlineDate, 20);
    const deadlineTime = cleanText(req.body.deadlineTime, 20);
    let scriptName = cleanText(req.body.scriptName, 80);
    const scriptIdInput = cleanText(req.body.scriptId, 80);
    const roleName = cleanText(req.body.roleName, 80);
    const roleNote = cleanText(req.body.roleNote, 400);
    const storeIdInput = cleanText(req.body.storeId, 80);
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
    const submittedRoles = sanitizeCarpoolRoles(req.body.scriptRoles, roleName, roleNote);
    const requestedNeededCount = Math.min(20, Math.max(1, parseCoinAmount(req.body.neededCount, 1)));
    const boostAmount = parseCoinAmount(req.body.boostAmount, 0);

    if (!city || !eventDate || !deadlineDate || (!scriptName && !scriptIdInput) || !leaderContact || !content) {
      return res.status(400).json(err(new Error('请填写城市、日期、截止日期、本名、车头联系方式和拼车说明')));
    }
    if (boostAmount > 100) return res.status(400).json(err(new Error('加权展示最多 100 契约币')));
    if (boostAmount > 0 && (profile.balance || 0) < boostAmount) {
      return res.status(402).json(err(new Error('契约币不足，请先充值')));
    }
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'carpool_submit',
      targetType: 'carpool',
      texts: {
        title,
        city,
        scriptName,
        roleName,
        roleNote,
        storeName,
        storeAddress,
        storeVerifyNote,
        contactNote,
        content,
        subsidyNote,
        rawMessage,
        generatedMessage,
      },
      files: req.body?.files,
      allowContact: true,
    });

    const sharedScript = await ensureSharedScriptForCarpool(scriptIdInput, scriptName, submittedRoles);
    scriptName = sharedScript.scriptName;
    const scriptRoles = sharedScript.scriptRoles.length > 0 ? sharedScript.scriptRoles : submittedRoles;
    const seatedRoles = scriptRoles.filter(role => role.status === 'seated');
    const neededRoles = scriptRoles.filter(role => role.status !== 'seated');
    const finalRoleName = roleSummary(scriptRoles, 'needed') || roleName || null;
    const finalRoleNote = roleNote || [
      roleSummary(scriptRoles, 'seated') ? `已上车：${roleSummary(scriptRoles, 'seated')}` : '',
      finalRoleName ? `缺人：${finalRoleName}` : '',
    ].filter(Boolean).join('；');
    const neededCount = neededRoles.length > 0 ? Math.min(20, neededRoles.length) : requestedNeededCount;
    const joinedCount = seatedRoles.length;

    const linkedStore = await getActiveStore(storeIdInput);
    if (storeIdInput && !linkedStore) return res.status(400).json(err(new Error('选择的店家不存在或未启用')));
    const finalStoreId = linkedStore ? cleanText(linkedStore.id, 80) : null;
    const finalStoreName = linkedStore ? cleanText(linkedStore.name, 100) : storeName;
    const finalStoreCity = linkedStore ? (cleanText(linkedStore.city, 40) || city) : storeCity;
    const finalStoreAddress = linkedStore ? cleanText(linkedStore.address, 160) : storeAddress;
    const finalStoreSuggestionStatus = linkedStore ? 'linked' : (finalStoreName ? 'pending' : 'none');

    let walletSpend: WalletSpendResult | null = null;
    if (boostAmount > 0) {
      walletSpend = await spendWalletBalance({
        profileId: profile.id,
        amount: boostAmount,
        description: `拼车区加权展示：${scriptName}`,
        refType: 'carpool_boost',
        metadata: { script_name: scriptName, city, event_date: eventDate },
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
      script_id: sharedScript.scriptId,
      script_name: scriptName,
      role_name: finalRoleName,
      role_note: finalRoleNote || null,
      script_roles: scriptRoles,
      seated_roles: seatedRoles,
      store_id: finalStoreId,
      store_name: finalStoreName || null,
      store_city: finalStoreName ? finalStoreCity : null,
      store_address: finalStoreAddress || null,
      store_source_url: linkedStore ? null : (storeSourceUrl || null),
      store_verify_note: storeVerifyNote || null,
      store_suggestion_status: finalStoreSuggestionStatus,
      subsidy_mode: subsidyMode,
      subsidy_type: subsidyType,
      subsidy_amount: subsidyAmount,
      subsidy_discount: subsidyDiscount,
      subsidy_note: subsidyNote || null,
      needed_count: neededCount,
      joined_count: joinedCount,
      leader_contact: leaderContact,
      contact_note: contactNote || null,
      content,
      boost_amount: boostAmount,
      status: 'pending',
      juzhanggui_sync_status: 'pending',
      ai_assist_context: {
        source: 'lingqi_carpool_form',
        moderation: 'pre_publish',
        moderation_precheck: moderationPrecheck,
        juzhanggui_sync: 'pending_manual_or_background_sync',
        subsidy_unit: 'cash_or_ticket_discount',
        raw_message: rawMessage || null,
        generated_message: generatedMessage || null,
        shared_script_id: sharedScript.scriptId,
        linked_store_id: finalStoreId,
        script_roles: scriptRoles,
      },
      moderation_precheck: moderationPrecheck,
    }).select('*').single();
    if (insErr) {
      if (isMissingRelation(insErr, 'lc_carpools')) return res.status(503).json(err(new Error('拼车区数据表尚未初始化，请先执行 Supabase migration')));
      throw insErr;
    }

    await logSecurityEvent(req, {
      action: 'carpool_submitted_for_review',
      targetType: 'carpool',
      targetId: data?.id,
      metadata: { city, event_date: eventDate, script_name: scriptName, boost_amount: boostAmount, moderation: moderationPrecheck },
    });
    res.json(ok({ id: data?.id, status: 'pending', balance: walletSpend?.balance ?? (profile.balance || 0), message: '已提交审核，通过后才会公开展示并同步剧司辰' }));
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
    await logSecurityEvent(req, {
      action: 'carpool_contact_viewed',
      targetType: 'carpool',
      targetId: req.params.id,
      metadata: { own_item: carpool.poster_id === profile.id },
    });
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

    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'report_submit',
      targetType: 'report',
      texts: { reason, description, targetTitle, targetPreview: cleanText(snapshot.content_preview, 500) },
      allowContact: false,
    });

    const { data, error: insErr } = await supabase.from('lc_reports').upsert({
      target_type: targetType,
      target_id: targetId,
      target_title: targetTitle,
      reporter_id: profile.id,
      reporter_name: profile.display_name,
      reason,
      description: description || null,
      target_snapshot: snapshot,
      moderation_precheck: moderationPrecheck,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'target_type,target_id,reporter_id' }).select('id').single();
    if (insErr) {
      if (isMissingRelation(insErr, 'lc_reports')) return res.status(503).json(err(new Error('举报表尚未初始化，请先执行 Supabase migration')));
      throw insErr;
    }
    const moderation = await evaluateReportModeration(req, {
      targetType,
      targetId,
      reason,
      description,
    });
    await logSecurityEvent(req, {
      action: 'report_submitted',
      targetType,
      targetId,
      metadata: { report_id: data?.id, reason, target_title: targetTitle, moderation, precheck: moderationPrecheck },
    });
    res.json(ok({ id: data?.id, moderation }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/moderation/queue', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const reviewerRole = moderationReviewerRole(profile);
    if (!reviewerRole) return res.status(403).json(err(new Error('当前账号不是社区观察员，暂不能参与众审')));

    const { data: reports, error: qErr } = await supabase.from('lc_reports')
      .select('id, target_type, target_id, target_title, reason, target_snapshot, risk_level, auto_action, auto_action_reason, report_group_count, reviewer_summary, created_at, updated_at')
      .eq('status', 'pending')
      .in('auto_action', ['temporary_hidden', 'queued_priority'])
      .order('updated_at', { ascending: false })
      .limit(120);
    if (qErr) throw qErr;
    const targetPairs = (reports || []).map(report => ({
      target_type: String(report.target_type || ''),
      target_id: String(report.target_id || ''),
    }));
    let ownReviews: Record<string, unknown>[] = [];
    if (targetPairs.length > 0) {
      const { data: reviews, error: reviewErr } = await supabase.from('lc_moderation_reviews')
        .select('id, target_type, target_id, decision, risk_labels, note, created_at, updated_at')
        .eq('reviewer_id', profile.id)
        .eq('status', 'active');
      if (reviewErr && !isMissingRelation(reviewErr, 'lc_moderation_reviews')) throw reviewErr;
      ownReviews = (reviews || []).filter(review => targetPairs.some(pair => pair.target_type === review.target_type && pair.target_id === review.target_id));
    }

    res.json(ok({
      reviewer_role: reviewerRole,
      items: groupReportsForModerationQueue((reports || []) as Record<string, unknown>[], ownReviews),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/moderation/reviews', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const reviewerRole = moderationReviewerRole(profile);
    if (!reviewerRole) return res.status(403).json(err(new Error('当前账号不是社区观察员，暂不能参与众审')));

    const targetType = REPORT_TARGET_TYPES.includes(req.body.targetType) ? req.body.targetType as ReportTargetType : null;
    const targetId = cleanText(req.body.targetId, 80);
    const decision = MODERATION_DECISIONS.includes(req.body.decision) ? req.body.decision as ModerationDecision : null;
    const note = cleanText(req.body.note, 800);
    const riskLabels = cleanTextArray(req.body.riskLabels, 8, 24);
    if (!targetType || !targetId || !decision) return res.status(400).json(err(new Error('请选择众审对象和建议结论')));

    const { data: report, error: reportErr } = await supabase.from('lc_reports')
      .select('target_title, target_snapshot, status')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();
    if (reportErr) throw reportErr;
    if (!report) return res.status(404).json(err(new Error('这个内容当前没有待处理举报')));

    const { data, error: upsertErr } = await supabase.from('lc_moderation_reviews').upsert({
      target_type: targetType,
      target_id: targetId,
      reviewer_id: profile.id,
      reviewer_name: profile.display_name,
      reviewer_role: reviewerRole,
      decision,
      risk_labels: riskLabels,
      note: note || null,
      target_snapshot: report.target_snapshot || {},
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'target_type,target_id,reviewer_id' }).select('id, decision, risk_labels, note, updated_at').single();
    if (upsertErr) {
      if (isMissingRelation(upsertErr, 'lc_moderation_reviews')) return res.status(503).json(err(new Error('众审表尚未初始化，请先执行 Supabase migration')));
      throw upsertErr;
    }

    const summary = await refreshReportReviewerSummary(targetType, targetId);
    await logSecurityEvent(req, {
      action: 'community_moderation_review_submitted',
      targetType,
      targetId,
      metadata: { review_id: data?.id, decision, risk_labels: riskLabels, reviewer_role: reviewerRole, summary },
    });
    res.json(ok({ review: data, summary }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/site-messages', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const allowedCategories = ['suggestion', 'dm_correction', 'appeal', 'account', 'bug', 'cooperation', 'general'];
    const rawCategory = cleanText(req.body?.category, 40);
    const category = allowedCategories.includes(rawCategory) ? rawCategory : 'general';
    const subject = cleanText(req.body?.subject, 80);
    const content = cleanText(req.body?.content, 2000);
    const contact = cleanText(req.body?.contact, 300);
    if (!subject || !content) return res.status(400).json(err(new Error('请填写站内信标题和内容')));
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'site_feedback_submit',
      targetType: 'site_message',
      texts: { category, subject, content, contact },
      allowContact: true,
    });

    const { data, error: insErr } = await supabase.from('lc_site_messages').insert({
      sender_id: profile.id,
      sender_name: profile.display_name,
      category,
      subject,
      content,
      contact: contact || null,
      status: 'pending',
      moderation_precheck: moderationPrecheck,
    }).select('id').single();
    if (insErr) {
      if (isMissingRelation(insErr, 'lc_site_messages')) return res.status(503).json(err(new Error('站内信表尚未初始化，请先执行 Supabase migration')));
      throw insErr;
    }
    await logSecurityEvent(req, {
      action: 'site_message_submitted',
      targetType: 'site_message',
      targetId: data?.id,
      metadata: { category, subject, moderation: moderationPrecheck },
    });
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

app.put('/api/lc/carpools/applications/:id/accept', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: application, error: appErr } = await supabase.from('lc_carpool_applications')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (appErr && isMissingRelation(appErr, 'lc_carpool_applications')) return res.status(503).json(err(new Error('拼车申请表尚未初始化')));
    if (appErr) throw appErr;
    if (!application) return res.status(404).json(err(new Error('上车申请不存在')));

    const { data: carpool, error: cErr } = await supabase.from('lc_carpools')
      .select('id, poster_id, status, needed_count')
      .eq('id', application.carpool_id)
      .single();
    if (cErr && isMissingRelation(cErr, 'lc_carpools')) return res.status(503).json(err(new Error('拼车区数据表尚未初始化')));
    if (cErr) throw cErr;
    if (!carpool) return res.status(404).json(err(new Error('拼车不存在')));
    if (carpool.poster_id !== profile.id) return res.status(403).json(err(new Error('只有车头可以确认上车')));
    if (!['approved', 'pending'].includes(carpool.status)) return res.status(400).json(err(new Error('当前拼车状态不能确认上车')));

    if (application.status !== 'accepted') {
      const { count: acceptedCount } = await supabase.from('lc_carpool_applications')
        .select('id', { count: 'exact', head: true })
        .eq('carpool_id', application.carpool_id)
        .eq('status', 'accepted');
      if ((acceptedCount || 0) >= Math.max(1, Number(carpool.needed_count || 1))) {
        return res.status(400).json(err(new Error('这辆车已满，不能继续确认上车')));
      }
      const roleName = cleanText(application.role_name, 80);
      if (roleName) {
        const { count: roleTaken } = await supabase.from('lc_carpool_applications')
          .select('id', { count: 'exact', head: true })
          .eq('carpool_id', application.carpool_id)
          .eq('role_name', roleName)
          .eq('status', 'accepted')
          .neq('id', application.id);
        if ((roleTaken || 0) > 0) return res.status(409).json(err(new Error('这个角色已经确认上车了')));
      }
    }

    const { data: updated, error: updErr } = await supabase.from('lc_carpool_applications')
      .update({
        status: 'accepted',
        review_message: cleanText(req.body?.reviewMessage, 500) || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;
    const joinedCount = await refreshAcceptedCarpoolCount(application.carpool_id);
    await logSecurityEvent(req, {
      action: 'carpool_application_accepted_by_poster',
      targetType: 'carpool_application',
      targetId: req.params.id,
      metadata: { carpool_id: application.carpool_id, joined_count: joinedCount },
    });
    res.json(ok({ application: updated, joined_count: joinedCount }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/carpools/applications/:id/reject', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: application, error: appErr } = await supabase.from('lc_carpool_applications')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (appErr && isMissingRelation(appErr, 'lc_carpool_applications')) return res.status(503).json(err(new Error('拼车申请表尚未初始化')));
    if (appErr) throw appErr;
    if (!application) return res.status(404).json(err(new Error('上车申请不存在')));

    const { data: carpool, error: cErr } = await supabase.from('lc_carpools')
      .select('id, poster_id')
      .eq('id', application.carpool_id)
      .single();
    if (cErr && isMissingRelation(cErr, 'lc_carpools')) return res.status(503).json(err(new Error('拼车区数据表尚未初始化')));
    if (cErr) throw cErr;
    if (!carpool) return res.status(404).json(err(new Error('拼车不存在')));
    if (carpool.poster_id !== profile.id) return res.status(403).json(err(new Error('只有车头可以拒绝上车申请')));

    const { data: updated, error: updErr } = await supabase.from('lc_carpool_applications')
      .update({
        status: 'rejected',
        review_message: cleanText(req.body?.reviewMessage, 500) || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;
    const joinedCount = await refreshAcceptedCarpoolCount(application.carpool_id);
    await logSecurityEvent(req, {
      action: 'carpool_application_rejected_by_poster',
      targetType: 'carpool_application',
      targetId: req.params.id,
      metadata: { carpool_id: application.carpool_id, joined_count: joinedCount },
    });
    res.json(ok({ application: updated, joined_count: joinedCount }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/carpools/:id/applications', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const message = cleanText(req.body.message, 1200);
    const roleName = cleanText(req.body.roleName, 80);
    const roleGender = cleanText(req.body.roleGender, 20);
    if (!message) return res.status(400).json(err(new Error('请填写上车申请')));

    const { data: carpool, error: cErr } = await supabase.from('lc_carpools')
      .select('id, poster_id, status, event_date, deadline_date, deadline_time')
      .eq('id', req.params.id)
      .single();
    if (cErr && isMissingRelation(cErr, 'lc_carpools')) return res.status(503).json(err(new Error('拼车区数据表尚未初始化')));
    if (!carpool) return res.status(404).json(err(new Error('拼车不存在')));
    if (carpool.status !== 'approved') return res.status(400).json(err(new Error('只能申请已公开的拼车')));
    if (isCarpoolExpired(carpool as Record<string, unknown>)) return res.status(400).json(err(new Error('这条拼车已过期，不能继续上车')));
    if (carpool.poster_id === profile.id) return res.status(400).json(err(new Error('不能申请自己的拼车')));

    const { data, error: insErr } = await supabase.from('lc_carpool_applications').insert({
      carpool_id: req.params.id,
      applicant_id: profile.id,
      applicant_name: profile.display_name,
      applicant_is_realname: !!profile.is_realname,
      applicant_avatar: profile.avatar || null,
      applicant_gender: profile.gender || null,
      role_name: roleName || null,
      role_gender: roleGender || null,
      message,
    }).select('id').single();
    if (insErr) {
      if (insErr.code === '23505') return res.status(409).json(err(new Error('你已经提交过上车申请了')));
      throw insErr;
    }
    await logSecurityEvent(req, {
      action: 'carpool_application_submitted',
      targetType: 'carpool',
      targetId: req.params.id,
      metadata: { application_id: data?.id, role_name: roleName || null, role_gender: roleGender || null },
    });
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
    await logSecurityEvent(req, {
      action: 'carpool_closed_by_author',
      targetType: 'carpool',
      targetId: req.params.id,
    });
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
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));

    const { data: commission } = await supabase.from('lc_commissions')
      .select('id, poster_id, status, needed_date')
      .eq('id', req.params.id)
      .single();
    if (!commission) return res.status(404).json(err(new Error('委托需求不存在')));
    if (commission.status !== 'approved') return res.status(400).json(err(new Error('只能申请已上墙的委托需求')));
    if (isCommissionExpired(commission as Record<string, unknown>)) return res.status(400).json(err(new Error('这条委托已过期，不能继续接单')));
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

// ==================== 攻略交易 ====================

const GUIDE_SPOILER_LEVELS = ['none', 'light', 'heavy', 'played_only'];
const GUIDE_TYPES = ['script', 'role', 'city', 'carpool', 'photo', 'store_dm', 'other'];
const GUIDE_TARGET_TYPES = ['script', 'script_role', 'dm_role', 'city', 'store', 'dm', 'carpool_leader', 'creator', 'custom'];

function normalizeGuideChoice(value: unknown, allowed: string[], fallback: string) {
  const text = cleanText(value, 40);
  return allowed.includes(text) ? text : fallback;
}

function normalizeGuidePrice(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(500, Math.trunc(num)));
}

function isGuideReader(row: Record<string, unknown>, profile?: AuthedProfile | null, purchases: Record<string, unknown>[] = []) {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (row.author_id === profile.id) return true;
  return purchases.some(item => item.buyer_id === profile.id && item.status === 'approved');
}

function publicGuidePayload(row: Record<string, unknown>, canRead = false) {
  const payload: Record<string, unknown> = {
    id: row.id,
    author_id: row.author_id,
    author_name: row.author_name,
    title: row.title,
    summary: row.summary,
    price: row.price || 0,
    spoiler_level: row.spoiler_level || 'none',
    guide_type: row.guide_type || 'other',
    target_type: row.target_type || 'custom',
    target_id: row.target_id || null,
    target_name: row.target_name || '',
    status: row.status,
    sale_status: row.sale_status,
    purchase_count: row.purchase_count || 0,
    gift_count: row.gift_count || 0,
    gift_amount: row.gift_amount || 0,
    moderation_precheck: row.moderation_precheck || null,
    reject_reason: row.reject_reason || null,
    admin_note: row.admin_note || null,
    approved_at: row.approved_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    can_read_content: canRead,
  };
  if (canRead) payload.content = row.content || '';
  return payload;
}

async function loadGuidePurchasesForProfile(guideIds: string[], profile?: AuthedProfile | null) {
  if (!profile || guideIds.length === 0) return [];
  const { data, error: qErr } = await supabase.from('lc_guide_purchases')
    .select('id, guide_id, buyer_id, status')
    .in('guide_id', guideIds)
    .eq('buyer_id', profile.id)
    .eq('status', 'approved');
  if (qErr && isMissingRelation(qErr, 'lc_guide_purchases')) return [];
  if (qErr) throw qErr;
  return data || [];
}

async function refreshWithdrawableIncome(profileId: string) {
  await supabase.from('lc_creator_income_entries')
    .update({ status: 'withdrawable', updated_at: new Date().toISOString() })
    .eq('creator_id', profileId)
    .eq('status', 'frozen')
    .lte('available_at', new Date().toISOString());
}

app.get('/api/lc/guides', async (req, res) => {
  try {
    const type = cleanText(req.query.type, 40);
    const targetType = cleanText(req.query.targetType, 40);
    const queryText = cleanText(req.query.q, 80).toLowerCase();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 24));
    const offset = (page - 1) * limit;

    let query = supabase.from('lc_guides')
      .select('*', { count: 'exact' })
      .eq('status', 'approved')
      .eq('sale_status', 'on_sale')
      .order('created_at', { ascending: false });
    if (GUIDE_TYPES.includes(type)) query = query.eq('guide_type', type);
    if (GUIDE_TARGET_TYPES.includes(targetType)) query = query.eq('target_type', targetType);
    query = query.range(offset, offset + limit - 1);

    const { data, error: qErr, count } = await query;
    if (qErr && isMissingRelation(qErr, 'lc_guides')) return res.json(ok({ items: [], total: 0, page, totalPages: 1 }));
    if (qErr) throw qErr;

    const rows = (data || []).filter(row => {
      if (!queryText) return true;
      return [row.title, row.summary, row.target_name, row.author_name].join(' ').toLowerCase().includes(queryText);
    });
    res.json(ok({
      items: rows.map(row => publicGuidePayload(row, false)),
      total: count || rows.length,
      page,
      totalPages: Math.max(1, Math.ceil((count || rows.length) / limit)),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/guides/mine', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data, error: qErr } = await supabase.from('lc_guides')
      .select('*')
      .eq('author_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (qErr && isMissingRelation(qErr, 'lc_guides')) return res.json(ok([]));
    if (qErr) throw qErr;
    res.json(ok((data || []).map(row => publicGuidePayload(row, true))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/guides/income/me', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    await refreshWithdrawableIncome(profile.id);
    const [{ data: entries, error: eErr }, { data: withdrawals, error: wErr }] = await Promise.all([
      supabase.from('lc_creator_income_entries').select('*').eq('creator_id', profile.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('lc_creator_withdrawals').select('*').eq('creator_id', profile.id).order('created_at', { ascending: false }).limit(50),
    ]);
    if (eErr && isMissingRelation(eErr, 'lc_creator_income_entries')) return res.json(ok({ entries: [], withdrawals: [], totals: {} }));
    if (wErr && isMissingRelation(wErr, 'lc_creator_withdrawals')) return res.json(ok({ entries: entries || [], withdrawals: [], totals: {} }));
    if (eErr) throw eErr;
    if (wErr) throw wErr;
    const totals = (entries || []).reduce((acc: Record<string, number>, item: Record<string, unknown>) => {
      const status = cleanText(item.status, 40) || 'unknown';
      acc[status] = (acc[status] || 0) + Number(item.creator_amount || 0);
      return acc;
    }, {});
    res.json(ok({ entries: entries || [], withdrawals: withdrawals || [], totals }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/guides/withdrawals', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    await refreshWithdrawableIncome(profile.id);

    const amount = Math.max(0, Math.trunc(Number(req.body?.amount || 0)));
    const accountType = normalizeGuideChoice(req.body?.accountType, ['alipay', 'wechat', 'bank', 'other'], 'alipay');
    const accountName = cleanText(req.body?.accountName, 80);
    const accountIdentifier = cleanText(req.body?.accountIdentifier, 160);
    if (amount < 30) return res.status(400).json(err(new Error('提现金额最低 30')));
    if (!accountName || !accountIdentifier) return res.status(400).json(err(new Error('请填写提现账号和姓名')));

    const { data: entries, error: eErr } = await supabase.from('lc_creator_income_entries')
      .select('id, creator_amount')
      .eq('creator_id', profile.id)
      .eq('status', 'withdrawable')
      .order('created_at', { ascending: true });
    if (eErr) throw eErr;
    const available = (entries || []).reduce((sum, item) => sum + Number(item.creator_amount || 0), 0);
    if (available < amount) return res.status(400).json(err(new Error('可提现收入不足')));
    if (available !== amount) return res.status(400).json(err(new Error('第一版提现请一次性申请全部可提现收入，避免拆分流水对账出错')));

    const selected = (entries || []).map(item => item.id);

    const { data: withdrawal, error: wErr } = await supabase.from('lc_creator_withdrawals').insert({
      creator_id: profile.id,
      amount,
      account_type: accountType,
      account_name: accountName,
      account_identifier: accountIdentifier,
      status: 'pending',
    }).select('*').single();
    if (wErr) throw wErr;

    if (selected.length > 0) {
      await supabase.from('lc_creator_income_entries')
        .update({ status: 'withdraw_requested', withdrawal_id: withdrawal.id, updated_at: new Date().toISOString() })
        .in('id', selected);
    }

    await logSecurityEvent(req, {
      action: 'guide_income_withdrawal_requested',
      targetType: 'creator_withdrawal',
      targetId: withdrawal.id,
      metadata: { amount, account_type: accountType },
    });
    res.json(ok(withdrawal));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/guides/:id', async (req, res) => {
  try {
    const authHeader = (req.headers.authorization || '').replace('Bearer ', '').trim();
    let profile: AuthedProfile | null = null;
    if (authHeader) {
      try {
        const decoded = jwt.verify(authHeader, JWT_SECRET) as { id?: string; creatorId?: string };
        const profileId = decoded?.creatorId || decoded?.id;
        if (profileId) {
          const { data } = await supabase.from('lc_profiles')
            .select('id, display_name, role, phone_verified_at, email_verified_at')
            .eq('id', profileId)
            .maybeSingle();
          profile = data as AuthedProfile | null;
        }
      } catch {
        profile = null;
      }
    }
    const { data: guide, error: qErr } = await supabase.from('lc_guides')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (qErr && isMissingRelation(qErr, 'lc_guides')) return res.status(404).json(err(new Error('攻略功能尚未初始化')));
    if (qErr) throw qErr;
    if (!guide) return res.status(404).json(err(new Error('攻略不存在')));
    const purchases = await loadGuidePurchasesForProfile([req.params.id], profile);
    const canRead = isGuideReader(guide, profile, purchases) || Number(guide.price || 0) === 0;
    const publicAllowed = guide.status === 'approved' && guide.sale_status === 'on_sale';
    if (!publicAllowed && !isGuideReader(guide, profile, purchases)) return res.status(404).json(err(new Error('攻略不存在或未上架')));
    res.json(ok(publicGuidePayload(guide, canRead)));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/guides', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));

    const title = cleanText(req.body?.title, 80);
    const summary = cleanText(req.body?.summary, 500);
    const content = cleanText(req.body?.content, 12000);
    const price = normalizeGuidePrice(req.body?.price);
    const spoilerLevel = normalizeGuideChoice(req.body?.spoilerLevel, GUIDE_SPOILER_LEVELS, 'none');
    const guideType = normalizeGuideChoice(req.body?.guideType, GUIDE_TYPES, 'other');
    const targetType = normalizeGuideChoice(req.body?.targetType, GUIDE_TARGET_TYPES, 'custom');
    const targetId = cleanText(req.body?.targetId, 120) || null;
    const targetName = cleanText(req.body?.targetName, 120);
    const copyrightConfirmed = !!req.body?.copyrightConfirmed;

    if (!title) return res.status(400).json(err(new Error('请填写攻略标题')));
    if (!summary) return res.status(400).json(err(new Error('请填写攻略摘要')));
    if (content.length < 80) return res.status(400).json(err(new Error('攻略正文至少 80 字')));
    if (!copyrightConfirmed) return res.status(400).json(err(new Error('请确认未上传盗版、谜底、线索卡或未授权素材')));

    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'guide_publish',
      targetType: 'guide',
      texts: { title, summary, content, targetName },
    });
    const { data, error: insErr } = await supabase.from('lc_guides').insert({
      author_id: profile.id,
      author_name: profile.display_name || '用户',
      title,
      summary,
      content,
      price,
      spoiler_level: spoilerLevel,
      guide_type: guideType,
      target_type: targetType,
      target_id: targetId,
      target_name: targetName,
      status: 'pending',
      sale_status: 'draft',
      copyright_confirmed: copyrightConfirmed,
      moderation_precheck: moderationPrecheck,
    }).select('*').single();
    if (insErr && isMissingRelation(insErr, 'lc_guides')) return res.status(503).json(err(new Error('攻略交易数据表尚未初始化')));
    if (insErr) throw insErr;
    await logSecurityEvent(req, {
      action: 'guide_submitted',
      targetType: 'guide',
      targetId: data.id,
      metadata: { price, spoiler_level: spoilerLevel, guide_type: guideType, moderation: moderationPrecheck.decision },
    });
    res.json(ok(publicGuidePayload(data, true)));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/guides/:id/purchase', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const { data, error: rpcErr } = await supabase.rpc('lc_purchase_guide', {
      p_buyer_id: profile.id,
      p_guide_id: req.params.id,
    });
    if (rpcErr) return res.status(/不足/.test(rpcErr.message || '') ? 402 : 400).json(err(new Error(rpcErr.message || '购买失败')));
    const result = firstRpcRow<GuidePurchaseResult>(data);
    await logSecurityEvent(req, {
      action: result?.already_purchased ? 'guide_purchase_duplicate' : 'guide_purchased',
      targetType: 'guide',
      targetId: req.params.id,
      metadata: { purchase_id: result?.purchase_id || null, transaction_id: result?.transaction_id || null },
    });
    res.json(ok(result));
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
      await logSecurityEvent(req, {
        action: 'admin_login_failed',
        actorRole: 'admin',
        targetType: 'admin',
        targetId: 'admin',
      });
      return res.status(401).json(err(new Error('密码错误')));
    }
    const token = jwt.sign({ creatorId: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    await logSecurityEvent(req, {
      action: 'admin_login_success',
      actorId: 'admin',
      actorRole: 'admin',
      targetType: 'admin',
      targetId: 'admin',
    });
    res.json(ok({ authed: true, token }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/admin/pending', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const [{ data: profiles }, { data: requests }, { data: rankings }, { data: approvedRankings }, { data: comments }, { data: claims }, { data: commissions }, { data: transactions }, { data: certifications }, { data: carpools }, { data: reports }, { data: siteMessages }, { data: scriptContributions }, { data: securityEvents }, dmDossiersResult, approvedDmDossiersResult, dmRatingsResult, storeRatingsResult, dmIdentityWithdrawalsResult, publicReviewsResult, guidesResult, withdrawalsResult] = await Promise.all([
      supabase.from('lc_profiles').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('lc_contact_requests').select('*, lc_profiles!inner(display_name)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_rankings').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_rankings').select('*').eq('status', 'approved').order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_comments').select('*, lc_rankings(subject_name, type)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_claims').select('*, lc_rankings(subject_name, type)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_commissions').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_transactions').select('*, lc_profiles(display_name, phone)').eq('type', 'recharge').eq('status', 'pending').is('gateway', null).order('created_at', { ascending: false }),
      supabase.from('lc_certifications').select('*, lc_profiles!inner(display_name, phone)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_carpools').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_reports').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_site_messages').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_script_contributions').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_security_events')
        .select('id, actor_id, actor_role, action, target_type, target_id, ip_address, user_agent, request_path, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(150),
      supabase.from('lc_dm_dossiers').select('*').or('status.eq.pending,claim_status.eq.pending').order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_dm_dossiers').select('id, entity_type, dm_name, city, workplace, employment_status, employer_store_id, photo_url, status').eq('status', 'approved').order('approved_at', { ascending: false }).limit(1000),
      supabase.from('lc_dm_ratings').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(200),
      supabase.from('lc_store_ratings').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(200),
      supabase.from('lc_dm_identity_withdrawals').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_public_reviews').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(200),
      supabase.from('lc_guides').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_creator_withdrawals').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(100),
    ]);
    const dmClaimsResult = await supabase.from('lc_dm_dossier_claims')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);
    if (dmDossiersResult.error && !isMissingRelation(dmDossiersResult.error, 'lc_dm_dossiers')) throw dmDossiersResult.error;
    if (dmClaimsResult.error && !isMissingRelation(dmClaimsResult.error, 'lc_dm_dossier_claims')) throw dmClaimsResult.error;
    if (approvedDmDossiersResult.error && !isMissingRelation(approvedDmDossiersResult.error, 'lc_dm_dossiers')) throw approvedDmDossiersResult.error;
    if (dmRatingsResult.error && !isMissingRelation(dmRatingsResult.error, 'lc_dm_ratings')) throw dmRatingsResult.error;
    if (storeRatingsResult.error && !isMissingRelation(storeRatingsResult.error, 'lc_store_ratings')) throw storeRatingsResult.error;
    if (dmIdentityWithdrawalsResult.error && !isMissingRelation(dmIdentityWithdrawalsResult.error, 'lc_dm_identity_withdrawals')) throw dmIdentityWithdrawalsResult.error;
    if (publicReviewsResult.error && !isMissingRelation(publicReviewsResult.error, 'lc_public_reviews')) throw publicReviewsResult.error;
    if (guidesResult.error && !isMissingRelation(guidesResult.error, 'lc_guides')) throw guidesResult.error;
    if (withdrawalsResult.error && !isMissingRelation(withdrawalsResult.error, 'lc_creator_withdrawals')) throw withdrawalsResult.error;
    const approvedDossiers = approvedDmDossiersResult.error ? [] : (approvedDmDossiersResult.data || []) as Record<string, unknown>[];
    const approvedDmDossiers = approvedDossiers.filter(dossier => dossier.entity_type === 'dm');
    const approvedStoreDossiers = approvedDossiers.filter(dossier => dossier.entity_type === 'store');
    const pendingClaimByDossier = new Map<string, Record<string, unknown>>();
    if (!dmClaimsResult.error) {
      ((dmClaimsResult.data || []) as Record<string, unknown>[]).forEach(claim => {
        const dossierId = String(claim.dossier_id || '');
        if (dossierId && !pendingClaimByDossier.has(dossierId)) pendingClaimByDossier.set(dossierId, claim);
      });
    }
    const pendingDmDossiers: Record<string, unknown>[] = dmDossiersResult.error ? [] : ((dmDossiersResult.data || []) as Record<string, unknown>[]).map(dossier => ({
      ...dossier,
      claim_submission: pendingClaimByDossier.has(String(dossier.id || '')) ? (() => {
        const claim = pendingClaimByDossier.get(String(dossier.id || '')) as Record<string, unknown>;
        return {
          id: claim.id,
          claimant_id: claim.claimant_id,
          proof_type: claim.proof_type,
          claim_note: claim.claim_note,
          proof_files: publicClaimProofMetadata(claim.proof_files),
          created_at: claim.created_at,
        };
      })() : null,
      similar_candidates: dossier.status === 'pending'
        ? rankSimilarDmDossiers(dossier, dossier.entity_type === 'store' ? approvedStoreDossiers : approvedDmDossiers)
        : [],
    }) as Record<string, unknown>);
    const dmDossierLookup = new Map<string, Record<string, unknown>>(
      [...approvedDossiers, ...pendingDmDossiers]
        .map(dossier => [String(dossier.id || ''), dossier] as const)
        .filter(([id]) => Boolean(id)),
    );
    const pendingDmRatings = dmRatingsResult.error ? [] : ((dmRatingsResult.data || []) as Record<string, unknown>[]).map(rating => ({
      ...rating,
      dm_dossier: dmDossierLookup.get(String(rating.dm_dossier_id || '')) || null,
    }));
    const pendingStoreRatings = storeRatingsResult.error ? [] : ((storeRatingsResult.data || []) as Record<string, unknown>[]).map(rating => ({
      ...rating,
      store_dossier: dmDossierLookup.get(String(rating.store_dossier_id || '')) || null,
    }));
    const pendingDmIdentityWithdrawals = dmIdentityWithdrawalsResult.error ? [] : ((dmIdentityWithdrawalsResult.data || []) as Record<string, unknown>[]).map(withdrawal => ({
      ...withdrawal,
      dm_dossier: dmDossierLookup.get(String(withdrawal.dm_dossier_id || '')) || null,
    }));
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
      siteMessages: siteMessages || [],
      scriptContributions: scriptContributions || [],
      securityEvents: securityEvents || [],
      dmDossiers: pendingDmDossiers,
      dossierOptions: approvedDossiers,
      dmRatings: pendingDmRatings,
      storeRatings: pendingStoreRatings,
      dmIdentityWithdrawals: pendingDmIdentityWithdrawals,
      publicReviews: publicReviewsResult.error ? [] : (publicReviewsResult.data || []),
      guides: guidesResult.error ? [] : (guidesResult.data || []),
      guideWithdrawals: withdrawalsResult.error ? [] : (withdrawalsResult.data || []),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/guides/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const adminNote = cleanText(req.body?.adminNote, 500);
    const { data: updated, error: updErr } = await supabase.from('lc_guides')
      .update({
        status: 'approved',
        sale_status: 'on_sale',
        admin_note: adminNote || null,
        reject_reason: null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('status', 'pending')
      .select('*')
      .single();
    if (updErr && isMissingRelation(updErr, 'lc_guides')) return res.status(503).json(err(new Error('攻略交易数据表尚未初始化')));
    if (updErr) throw updErr;
    await logSecurityEvent(req, {
      action: 'admin_guide_approved',
      targetType: 'guide',
      targetId: req.params.id,
      metadata: { admin_note: adminNote || null },
    });
    res.json(ok(updated));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/guides/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = cleanText(req.body?.rejectReason, 500) || '不符合攻略发布规则';
    const { error: updErr } = await supabase.from('lc_guides')
      .update({
        status: 'rejected',
        sale_status: 'draft',
        reject_reason: rejectReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('status', 'pending');
    if (updErr && isMissingRelation(updErr, 'lc_guides')) return res.status(503).json(err(new Error('攻略交易数据表尚未初始化')));
    if (updErr) throw updErr;
    await logSecurityEvent(req, {
      action: 'admin_guide_rejected',
      targetType: 'guide',
      targetId: req.params.id,
      metadata: { reject_reason: rejectReason },
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/guide-withdrawals/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const adminNote = cleanText(req.body?.adminNote, 500);
    const { data: withdrawal, error: findErr } = await supabase.from('lc_creator_withdrawals')
      .select('*')
      .eq('id', req.params.id)
      .eq('status', 'pending')
      .single();
    if (findErr && isMissingRelation(findErr, 'lc_creator_withdrawals')) return res.status(503).json(err(new Error('提现数据表尚未初始化')));
    if (findErr) throw findErr;
    if (!withdrawal) return res.status(404).json(err(new Error('提现申请不存在')));

    const { data: updated, error: updErr } = await supabase.from('lc_creator_withdrawals')
      .update({
        status: 'paid',
        admin_note: adminNote || null,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;
    await supabase.from('lc_creator_income_entries')
      .update({ status: 'withdraw_paid', updated_at: new Date().toISOString() })
      .eq('withdrawal_id', req.params.id)
      .eq('status', 'withdraw_requested');
    await logSecurityEvent(req, {
      action: 'admin_guide_withdrawal_paid',
      targetType: 'creator_withdrawal',
      targetId: req.params.id,
      metadata: { amount: withdrawal.amount, admin_note: adminNote || null },
    });
    res.json(ok(updated));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/guide-withdrawals/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = cleanText(req.body?.rejectReason, 500) || '提现申请未通过';
    const { data: updated, error: updErr } = await supabase.from('lc_creator_withdrawals')
      .update({
        status: 'rejected',
        admin_note: rejectReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('status', 'pending')
      .select('*')
      .single();
    if (updErr && isMissingRelation(updErr, 'lc_creator_withdrawals')) return res.status(503).json(err(new Error('提现数据表尚未初始化')));
    if (updErr) throw updErr;
    await supabase.from('lc_creator_income_entries')
      .update({ status: 'withdrawable', withdrawal_id: null, updated_at: new Date().toISOString() })
      .eq('withdrawal_id', req.params.id)
      .eq('status', 'withdraw_requested');
    await logSecurityEvent(req, {
      action: 'admin_guide_withdrawal_rejected',
      targetType: 'creator_withdrawal',
      targetId: req.params.id,
      metadata: { reject_reason: rejectReason },
    });
    res.json(ok(updated));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/public-reviews/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const { data: review, error: findErr } = await supabase.from('lc_public_reviews')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (findErr && isMissingRelation(findErr, 'lc_public_reviews')) return res.status(503).json(err(new Error('公开内容审核表尚未初始化')));
    if (findErr) throw findErr;
    if (!review) return res.status(404).json(err(new Error('审核记录不存在')));
    if (review.status !== 'pending') return res.status(400).json(err(new Error('这条审核记录已经处理过了')));

    await applyPublicReview(review as PublicReviewRecord);
    const { data: updated, error: updErr } = await supabase.from('lc_public_reviews')
      .update({
        status: 'approved',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_note: cleanText(req.body?.reviewNote, 500) || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('status', 'pending')
      .select('*')
      .single();
    if (updErr) throw updErr;
    await logSecurityEvent(req, {
      action: 'admin_public_review_approved',
      targetType: 'public_review',
      targetId: req.params.id,
      metadata: { review_type: review.target_type, review_note: cleanText(req.body?.reviewNote, 500) || null },
    });
    res.json(ok(updated));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/public-reviews/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const rejectReason = cleanText(req.body?.rejectReason, 500) || '不符合公开展示规则';
    const { error: updErr } = await supabase.from('lc_public_reviews')
      .update({
        status: 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_note: rejectReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('status', 'pending');
    if (updErr && isMissingRelation(updErr, 'lc_public_reviews')) return res.status(503).json(err(new Error('公开内容审核表尚未初始化')));
    if (updErr) throw updErr;
    await logSecurityEvent(req, {
      action: 'admin_public_review_rejected',
      targetType: 'public_review',
      targetId: req.params.id,
      metadata: { reject_reason: rejectReason },
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/dm-dossiers/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const { data: dossier, error: findErr } = await supabase.from('lc_dm_dossiers').select('*').eq('id', req.params.id).single();
    if (findErr && isMissingRelation(findErr, 'lc_dm_dossiers')) return res.status(503).json(err(new Error('卡司评分数据表尚未初始化')));
    if (findErr) throw findErr;
    if (!dossier) return res.status(404).json(err(new Error('档案不存在')));

    if (dossier.status !== 'pending' && dossier.claim_status === 'pending') {
      const reviewed = await finalizeDossierClaimReview({ dossierId: req.params.id, outcome: 'approved', reviewerId });
      await logSecurityEvent(req, {
        action: 'admin_dm_dossier_claim_approved',
        targetType: 'dm_dossier_claim',
        targetId: reviewed.claimId || req.params.id,
        metadata: { dossier_id: req.params.id, entity_type: dossier.entity_type || 'dm' },
      });
      return res.json(ok(reviewed.dossier));
    }
    if (dossier.status !== 'pending') return res.status(400).json(err(new Error('这条档案审核已经处理过了')));

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    patch.status = 'approved';
    patch.approved_by = reviewerId;
    patch.approved_at = new Date().toISOString();
    patch.reject_reason = null;

    const { data: updated, error: updErr } = await supabase.from('lc_dm_dossiers')
      .update(patch)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;
    await logSecurityEvent(req, {
      action: 'admin_dm_dossier_approved',
      targetType: 'dm_dossier',
      targetId: req.params.id,
      metadata: { approved_status: patch.status || dossier.status, approved_claim: patch.claim_status || dossier.claim_status },
    });
    res.json(ok(updated));
  } catch (e) { res.status(500).json(err(e)); }
});

async function mergeDmDossierInto(sourceId: string, targetId: string, reviewerId: string | null) {
  if (sourceId === targetId) throw new Error('不能把档案合并到自己');
  if (useTencentPg) {
    const client = await tencentPgPool.connect();
    try {
      await client.query('BEGIN');
      const dossierResult = await client.query(
        `select * from lc_dm_dossiers where id = any($1::uuid[]) for update`,
        [[sourceId, targetId]],
      );
      const source = dossierResult.rows.find(row => String(row.id) === sourceId);
      const target = dossierResult.rows.find(row => String(row.id) === targetId);
      if (!source) throw new Error('待合并DM档案不存在');
      if (!target || target.entity_type !== 'dm' || target.status !== 'approved') throw new Error('目标DM档案不存在或尚未公开');

      const ratingsResult = await client.query(
        `select * from lc_dm_ratings where dm_dossier_id = $1 for update`,
        [sourceId],
      );
      let movedCount = 0;
      let rejectedDuplicateCount = 0;
      for (const rating of ratingsResult.rows) {
        const duplicate = await client.query(
          `select id from lc_dm_ratings
           where dm_dossier_id = $1
             and profile_id is not distinct from $2
             and script_key = $3
             and played_on = $4
             and replay_number = $5
             and status <> 'rejected'
           limit 1`,
          [targetId, rating.profile_id, rating.script_key, rating.played_on, rating.replay_number],
        );
        if (duplicate.rowCount) {
          await client.query(
            `update lc_dm_ratings
             set status = 'rejected', review_note = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
             where id = $1`,
            [rating.id, '合并DM档案时发现同一场体验已存在', reviewerId],
          );
          rejectedDuplicateCount += 1;
        } else {
          await client.query(
            `update lc_dm_ratings set dm_dossier_id = $2, updated_at = now() where id = $1`,
            [rating.id, targetId],
          );
          movedCount += 1;
        }
      }

      await client.query(
        `insert into lc_dm_aliases(dm_dossier_id, alias_name, city, workplace, source_dossier_id)
         values ($1, $2, $3, $4, $5)
         on conflict do nothing`,
        [targetId, source.dm_name, source.city, source.workplace, sourceId],
      );
      await client.query(
        `update lc_rankings
         set subject_dossier_id = $2, subject_name = $3, subject_city = coalesce($4, subject_city)
         where subject_dossier_id = $1`,
        [sourceId, targetId, target.dm_name, target.city],
      );
      await client.query(
        `delete from lc_dm_store_affiliations source_affiliation
          where source_affiliation.dm_dossier_id = $1
            and exists (
              select 1 from lc_dm_store_affiliations target_affiliation
               where target_affiliation.dm_dossier_id = $2
                 and target_affiliation.status = source_affiliation.status
                 and (
                   source_affiliation.status in ('approved', 'pending')
                   or (
                     source_affiliation.status = 'legacy_unverified'
                     and target_affiliation.store_dossier_id = source_affiliation.store_dossier_id
                   )
                 )
            )`,
        [sourceId, targetId],
      );
      await client.query(
        `update lc_dm_store_affiliations
            set dm_dossier_id = $2, updated_at = now()
          where dm_dossier_id = $1`,
        [sourceId, targetId],
      );
      await client.query(
        `update lc_dm_dossiers
         set status = 'hidden', merged_into = $2, reject_reason = $3, updated_at = now()
         where id = $1`,
        [sourceId, targetId, `已合并到DM档案：${target.dm_name}`],
      );
      await client.query('COMMIT');
      return { source, target, movedCount, rejectedDuplicateCount };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const [{ data: source, error: sourceErr }, { data: target, error: targetErr }] = await Promise.all([
    supabase.from('lc_dm_dossiers').select('*').eq('id', sourceId).maybeSingle(),
    supabase.from('lc_dm_dossiers').select('*').eq('id', targetId).eq('entity_type', 'dm').eq('status', 'approved').maybeSingle(),
  ]);
  if (sourceErr) throw sourceErr;
  if (targetErr) throw targetErr;
  if (!source) throw new Error('待合并DM档案不存在');
  if (!target) throw new Error('目标DM档案不存在或尚未公开');
  const { data: sourceRatings, error: ratingErr } = await supabase.from('lc_dm_ratings').select('*').eq('dm_dossier_id', sourceId);
  if (ratingErr && !isMissingRelation(ratingErr, 'lc_dm_ratings')) throw ratingErr;
  let movedCount = 0;
  let rejectedDuplicateCount = 0;
  for (const rating of sourceRatings || []) {
    const duplicate = await supabase.from('lc_dm_ratings').select('id')
      .eq('dm_dossier_id', targetId)
      .eq('profile_id', rating.profile_id)
      .eq('script_key', rating.script_key)
      .eq('played_on', rating.played_on)
      .eq('replay_number', rating.replay_number)
      .not('status', 'eq', 'rejected')
      .maybeSingle();
    if (duplicate.error) throw duplicate.error;
    if (duplicate.data) {
      const rejected = await supabase.from('lc_dm_ratings').update({
        status: 'rejected',
        review_note: '合并DM档案时发现同一场体验已存在',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', rating.id);
      if (rejected.error) throw rejected.error;
      rejectedDuplicateCount += 1;
    } else {
      const moved = await supabase.from('lc_dm_ratings').update({ dm_dossier_id: targetId, updated_at: new Date().toISOString() }).eq('id', rating.id);
      if (moved.error) throw moved.error;
      movedCount += 1;
    }
  }
  const aliasResult = await supabase.from('lc_dm_aliases').insert({
    dm_dossier_id: targetId,
    alias_name: source.dm_name,
    city: source.city || null,
    workplace: source.workplace || null,
    source_dossier_id: sourceId,
  });
  if (aliasResult.error && aliasResult.error.code !== '23505') throw aliasResult.error;
  const rankingMove = await supabase.from('lc_rankings').update({
    subject_dossier_id: targetId,
    subject_name: target.dm_name,
    subject_city: target.city || source.city || null,
  }).eq('subject_dossier_id', sourceId);
  if (rankingMove.error) throw rankingMove.error;
  const sourceAffiliations = await supabase.from('lc_dm_store_affiliations').select('*').eq('dm_dossier_id', sourceId);
  const targetAffiliations = await supabase.from('lc_dm_store_affiliations').select('*').eq('dm_dossier_id', targetId);
  if (sourceAffiliations.error && !isMissingRelation(sourceAffiliations.error, 'lc_dm_store_affiliations')) throw sourceAffiliations.error;
  if (targetAffiliations.error && !isMissingRelation(targetAffiliations.error, 'lc_dm_store_affiliations')) throw targetAffiliations.error;
  if (!sourceAffiliations.error && !targetAffiliations.error) {
    for (const affiliation of sourceAffiliations.data || []) {
      const action = conflictsWhenMergingDmDossiers(affiliation, targetAffiliations.data || [])
        ? supabase.from('lc_dm_store_affiliations').delete().eq('id', affiliation.id)
        : supabase.from('lc_dm_store_affiliations').update({ dm_dossier_id: targetId, updated_at: new Date().toISOString() }).eq('id', affiliation.id);
      const result = await action;
      if (result.error) throw result.error;
    }
  }
  const hiddenResult = await supabase.from('lc_dm_dossiers').update({
    status: 'hidden',
    merged_into: targetId,
    reject_reason: `已合并到DM档案：${target.dm_name}`,
    updated_at: new Date().toISOString(),
  }).eq('id', sourceId);
  if (hiddenResult.error) throw hiddenResult.error;
  return { source, target, movedCount, rejectedDuplicateCount };
}

app.put('/api/lc/admin/dm-dossiers/:id/merge', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const targetId = cleanText(req.body?.targetId ?? req.body?.target_id, 120);
    if (!targetId) return res.status(400).json(err(new Error('请选择要合并到的DM档案')));
    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const result = await mergeDmDossierInto(req.params.id, targetId, reviewerId);
    await logSecurityEvent(req, {
      action: 'admin_dm_dossier_merged',
      targetType: 'dm_dossier',
      targetId: req.params.id,
      metadata: { target_id: targetId, moved_ratings: result.movedCount, rejected_duplicate_ratings: result.rejectedDuplicateCount },
    });
    res.json(ok({
      source_id: req.params.id,
      target_id: targetId,
      target_name: result.target.dm_name,
      moved_ratings: result.movedCount,
      rejected_duplicate_ratings: result.rejectedDuplicateCount,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

async function mergeStoreDossierInto(sourceId: string, targetId: string, reviewerId: string | null) {
  if (sourceId === targetId) throw new Error('不能把档案合并到自己');
  if (useTencentPg) {
    const client = await tencentPgPool.connect();
    try {
      await client.query('BEGIN');
      const dossierResult = await client.query(
        `select * from lc_dm_dossiers where id = any($1::uuid[]) for update`,
        [[sourceId, targetId]],
      );
      const source = dossierResult.rows.find(row => String(row.id) === sourceId);
      const target = dossierResult.rows.find(row => String(row.id) === targetId);
      if (!source || source.entity_type !== 'store') throw new Error('待合并店家档案不存在');
      if (!target || target.entity_type !== 'store' || target.status !== 'approved') throw new Error('目标店家档案不存在或尚未公开');

      const ratingsResult = await client.query(
        `select * from lc_store_ratings where store_dossier_id = $1 for update`,
        [sourceId],
      );
      let movedCount = 0;
      let rejectedDuplicateCount = 0;
      for (const rating of ratingsResult.rows) {
        const duplicate = await client.query(
          `select id from lc_store_ratings
           where store_dossier_id = $1
             and profile_id is not distinct from $2
             and script_key = $3
             and visited_on = $4
             and status <> 'rejected'
           limit 1`,
          [targetId, rating.profile_id, rating.script_key, rating.visited_on],
        );
        if (duplicate.rowCount) {
          await client.query(
            `update lc_store_ratings
             set status = 'rejected', review_note = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
             where id = $1`,
            [rating.id, '合并店家档案时发现同一次到店体验已存在', reviewerId],
          );
          rejectedDuplicateCount += 1;
        } else {
          await client.query(
            `update lc_store_ratings set store_dossier_id = $2, updated_at = now() where id = $1`,
            [rating.id, targetId],
          );
          movedCount += 1;
        }
      }
      await client.query(
        `update lc_rankings
         set subject_dossier_id = $2, subject_name = $3, subject_city = coalesce($4, subject_city)
         where subject_dossier_id = $1 and subject_type = 'store'`,
        [sourceId, targetId, target.dm_name, target.city],
      );
      await client.query(
        `update lc_rankings set event_store_dossier_id = $2, event_store_name = $3 where event_store_dossier_id = $1`,
        [sourceId, targetId, target.dm_name],
      );
      await client.query(
        `update lc_rankings set dm_employer_store_id_suggestion = $2 where dm_employer_store_id_suggestion = $1`,
        [sourceId, targetId],
      );
      await client.query(
        `update lc_dm_dossiers set employer_store_id = $2, workplace = $3, updated_at = now() where employer_store_id = $1`,
        [sourceId, targetId, target.dm_name],
      );
      await client.query(
        `delete from lc_dm_store_affiliations source_affiliation
          where source_affiliation.store_dossier_id = $1
            and source_affiliation.status = 'legacy_unverified'
            and exists (
              select 1 from lc_dm_store_affiliations target_affiliation
               where target_affiliation.store_dossier_id = $2
                 and target_affiliation.dm_dossier_id = source_affiliation.dm_dossier_id
                 and target_affiliation.status = 'legacy_unverified'
            )`,
        [sourceId, targetId],
      );
      await client.query(
        `update lc_dm_store_affiliations
            set store_dossier_id = $2, updated_at = now()
          where store_dossier_id = $1`,
        [sourceId, targetId],
      );
      await client.query(
        `update lc_dm_dossiers
         set status = 'hidden', merged_into = $2, reject_reason = $3, updated_at = now()
         where id = $1`,
        [sourceId, targetId, `已合并到店家档案：${target.dm_name}`],
      );
      await client.query('COMMIT');
      return { source, target, movedCount, rejectedDuplicateCount };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const [{ data: source, error: sourceErr }, { data: target, error: targetErr }] = await Promise.all([
    supabase.from('lc_dm_dossiers').select('*').eq('id', sourceId).eq('entity_type', 'store').maybeSingle(),
    supabase.from('lc_dm_dossiers').select('*').eq('id', targetId).eq('entity_type', 'store').eq('status', 'approved').maybeSingle(),
  ]);
  if (sourceErr) throw sourceErr;
  if (targetErr) throw targetErr;
  if (!source) throw new Error('待合并店家档案不存在');
  if (!target) throw new Error('目标店家档案不存在或尚未公开');
  const { data: sourceRatings, error: ratingErr } = await supabase.from('lc_store_ratings').select('*').eq('store_dossier_id', sourceId);
  if (ratingErr && !isMissingRelation(ratingErr, 'lc_store_ratings')) throw ratingErr;
  let movedCount = 0;
  let rejectedDuplicateCount = 0;
  for (const rating of sourceRatings || []) {
    const duplicate = await supabase.from('lc_store_ratings').select('id')
      .eq('store_dossier_id', targetId)
      .eq('profile_id', rating.profile_id)
      .eq('script_key', rating.script_key)
      .eq('visited_on', rating.visited_on)
      .not('status', 'eq', 'rejected')
      .maybeSingle();
    if (duplicate.error) throw duplicate.error;
    if (duplicate.data) {
      const rejected = await supabase.from('lc_store_ratings').update({
        status: 'rejected',
        review_note: '合并店家档案时发现同一次到店体验已存在',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', rating.id);
      if (rejected.error) throw rejected.error;
      rejectedDuplicateCount += 1;
    } else {
      const moved = await supabase.from('lc_store_ratings').update({ store_dossier_id: targetId, updated_at: new Date().toISOString() }).eq('id', rating.id);
      if (moved.error) throw moved.error;
      movedCount += 1;
    }
  }
  const rankingMove = await supabase.from('lc_rankings').update({
    subject_dossier_id: targetId,
    subject_name: target.dm_name,
    subject_city: target.city || source.city || null,
  }).eq('subject_dossier_id', sourceId).eq('subject_type', 'store');
  if (rankingMove.error) throw rankingMove.error;
  const eventMove = await supabase.from('lc_rankings').update({
    event_store_dossier_id: targetId,
    event_store_name: target.dm_name,
  }).eq('event_store_dossier_id', sourceId);
  if (eventMove.error) throw eventMove.error;
  const suggestionMove = await supabase.from('lc_rankings').update({ dm_employer_store_id_suggestion: targetId }).eq('dm_employer_store_id_suggestion', sourceId);
  if (suggestionMove.error) throw suggestionMove.error;
  const dmMove = await supabase.from('lc_dm_dossiers').update({ employer_store_id: targetId, workplace: target.dm_name, updated_at: new Date().toISOString() }).eq('employer_store_id', sourceId);
  if (dmMove.error) throw dmMove.error;
  const sourceAffiliations = await supabase.from('lc_dm_store_affiliations').select('*').eq('store_dossier_id', sourceId);
  const targetAffiliations = await supabase.from('lc_dm_store_affiliations').select('*').eq('store_dossier_id', targetId);
  if (sourceAffiliations.error && !isMissingRelation(sourceAffiliations.error, 'lc_dm_store_affiliations')) throw sourceAffiliations.error;
  if (targetAffiliations.error && !isMissingRelation(targetAffiliations.error, 'lc_dm_store_affiliations')) throw targetAffiliations.error;
  if (!sourceAffiliations.error && !targetAffiliations.error) {
    for (const affiliation of sourceAffiliations.data || []) {
      const action = conflictsWhenMergingStoreDossiers(affiliation, targetAffiliations.data || [])
        ? supabase.from('lc_dm_store_affiliations').delete().eq('id', affiliation.id)
        : supabase.from('lc_dm_store_affiliations').update({ store_dossier_id: targetId, updated_at: new Date().toISOString() }).eq('id', affiliation.id);
      const result = await action;
      if (result.error) throw result.error;
    }
  }
  const hiddenResult = await supabase.from('lc_dm_dossiers').update({
    status: 'hidden',
    merged_into: targetId,
    reject_reason: `已合并到店家档案：${target.dm_name}`,
    updated_at: new Date().toISOString(),
  }).eq('id', sourceId);
  if (hiddenResult.error) throw hiddenResult.error;
  return { source, target, movedCount, rejectedDuplicateCount };
}

app.put('/api/lc/admin/store-dossiers/:id/merge', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const targetId = cleanText(req.body?.targetId ?? req.body?.target_id, 120);
    if (!targetId) return res.status(400).json(err(new Error('请选择要合并到的店家档案')));
    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const result = await mergeStoreDossierInto(req.params.id, targetId, reviewerId);
    await logSecurityEvent(req, {
      action: 'admin_store_dossier_merged',
      targetType: 'dm_dossier',
      targetId: req.params.id,
      metadata: { target_id: targetId, moved_ratings: result.movedCount, rejected_duplicate_ratings: result.rejectedDuplicateCount },
    });
    res.json(ok({
      source_id: req.params.id,
      target_id: targetId,
      target_name: result.target.dm_name,
      moved_ratings: result.movedCount,
      rejected_duplicate_ratings: result.rejectedDuplicateCount,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/dm-ratings/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const { data: rating, error: ratingErr } = await supabase.from('lc_dm_ratings').select('*').eq('id', req.params.id).maybeSingle();
    if (ratingErr && isMissingRelation(ratingErr, 'lc_dm_ratings')) return res.status(503).json(err(new Error('DM评分表尚未初始化')));
    if (ratingErr) throw ratingErr;
    if (!rating) return res.status(404).json(err(new Error('评分不存在')));
    if (rating.status !== 'pending') return res.status(400).json(err(new Error('这条评分已经处理过了')));
    const { data: dossier, error: dossierErr } = await supabase.from('lc_dm_dossiers').select('id, status, merged_into').eq('id', rating.dm_dossier_id).maybeSingle();
    if (dossierErr) throw dossierErr;
    const resolvedDmId = dossier?.status === 'hidden' && dossier?.merged_into ? dossier.merged_into : dossier?.id;
    if (!resolvedDmId) return res.status(409).json(err(new Error('请先创建或合并这条DM档案')));
    if (dossier?.status !== 'approved' && !dossier?.merged_into) return res.status(409).json(err(new Error('请先审核DM档案，再通过评分')));
    const { data: updated, error: updateErr } = await supabase.from('lc_dm_ratings').update({
      dm_dossier_id: resolvedDmId,
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_note: cleanText(req.body?.reviewNote, 500) || null,
      updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).eq('status', 'pending').select('*').single();
    if (updateErr) throw updateErr;
    await logSecurityEvent(req, {
      action: 'admin_dm_rating_approved',
      targetType: 'dm_rating',
      targetId: req.params.id,
      metadata: { dm_id: resolvedDmId, review_note: cleanText(req.body?.reviewNote, 500) || null },
    });
    res.json(ok(updated));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/dm-ratings/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const rejectReason = cleanText(req.body?.rejectReason, 500) || '不符合DM评分公开规则';
    const { data: updated, error: updateErr } = await supabase.from('lc_dm_ratings').update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_note: rejectReason,
      updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).eq('status', 'pending').select('*').single();
    if (updateErr && isMissingRelation(updateErr, 'lc_dm_ratings')) return res.status(503).json(err(new Error('DM评分表尚未初始化')));
    if (updateErr) throw updateErr;
    await logSecurityEvent(req, {
      action: 'admin_dm_rating_rejected',
      targetType: 'dm_rating',
      targetId: req.params.id,
      metadata: { reject_reason: rejectReason },
    });
    res.json(ok(updated));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/store-ratings/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const { data: rating, error: ratingErr } = await supabase.from('lc_store_ratings').select('*').eq('id', req.params.id).maybeSingle();
    if (ratingErr && isMissingRelation(ratingErr, 'lc_store_ratings')) return res.status(503).json(err(new Error('店家评分表尚未初始化')));
    if (ratingErr) throw ratingErr;
    if (!rating) return res.status(404).json(err(new Error('评分不存在')));
    if (rating.status !== 'pending') return res.status(400).json(err(new Error('这条评分已经处理过了')));
    const { data: dossier, error: dossierErr } = await supabase.from('lc_dm_dossiers').select('id, entity_type, status, merged_into').eq('id', rating.store_dossier_id).maybeSingle();
    if (dossierErr) throw dossierErr;
    const resolvedStoreId = dossier?.status === 'hidden' && dossier?.merged_into ? dossier.merged_into : dossier?.id;
    if (!resolvedStoreId || dossier?.entity_type !== 'store') return res.status(409).json(err(new Error('请先创建或合并这条店家档案')));
    if (dossier?.status !== 'approved' && !dossier?.merged_into) return res.status(409).json(err(new Error('请先审核店家档案，再通过评分')));
    const { data: updated, error: updateErr } = await supabase.from('lc_store_ratings').update({
      store_dossier_id: resolvedStoreId,
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_note: cleanText(req.body?.reviewNote, 500) || null,
      updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).eq('status', 'pending').select('*').single();
    if (updateErr) throw updateErr;
    await logSecurityEvent(req, {
      action: 'admin_store_rating_approved',
      targetType: 'store_rating',
      targetId: req.params.id,
      metadata: { store_dossier_id: resolvedStoreId, review_note: cleanText(req.body?.reviewNote, 500) || null },
    });
    res.json(ok(updated));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/store-ratings/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const rejectReason = cleanText(req.body?.rejectReason, 500) || '不符合店家评分公开规则';
    const { data: updated, error: updateErr } = await supabase.from('lc_store_ratings').update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_note: rejectReason,
      updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).eq('status', 'pending').select('*').single();
    if (updateErr && isMissingRelation(updateErr, 'lc_store_ratings')) return res.status(503).json(err(new Error('店家评分表尚未初始化')));
    if (updateErr) throw updateErr;
    await logSecurityEvent(req, {
      action: 'admin_store_rating_rejected',
      targetType: 'store_rating',
      targetId: req.params.id,
      metadata: { reject_reason: rejectReason },
    });
    res.json(ok(updated));
  } catch (e) { res.status(500).json(err(e)); }
});

function profileWithoutDmIdentity(profile: Record<string, unknown>) {
  const filtered = Array.isArray(profile.identity_roles)
    ? profile.identity_roles.map(normalizeProfileIdentityRole).filter(role => role && role !== 'dm')
    : [];
  const sanitized = {
    ...profile,
    verified_dm: false,
    identity_roles: filtered,
    role_type: normalizeProfileIdentityRole(profile.role_type) === 'dm' ? 'player' : profile.role_type,
    role: normalizeProfileIdentityRole(profile.role) === 'dm' ? 'creator' : profile.role,
  };
  const identityRoles = profileIdentityRoles(sanitized).filter(role => role !== 'dm');
  return {
    verified_dm: false,
    identity_roles: identityRoles.length > 0 ? identityRoles : ['player'],
    role_type: normalizeProfileIdentityRole(sanitized.role_type) || identityRoles[0] || 'player',
    role: sanitized.role || 'creator',
  };
}

app.put('/api/lc/admin/dm-identity-withdrawals/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const now = new Date().toISOString();
    if (useTencentPg) {
      const client = await tencentPgPool.connect();
      try {
        await client.query('BEGIN');
        const withdrawalResult = await client.query(
          `select * from lc_dm_identity_withdrawals where id = $1 and status = 'pending' for update`,
          [req.params.id],
        );
        const withdrawal = withdrawalResult.rows[0];
        if (!withdrawal) throw new Error('撤销认证申请不存在或已经处理');
        const dossierResult = await client.query(
          `select * from lc_dm_dossiers where id = $1 for update`,
          [withdrawal.dm_dossier_id],
        );
        const dossier = dossierResult.rows[0];
        if (!dossier || dossier.entity_type !== 'dm') throw new Error('DM 档案不存在');
        if (String(dossier.claimed_by || '') !== String(withdrawal.profile_id || '')) throw new Error('申请账号与当前档案认领人不一致');
        await client.query(
          `update lc_dm_identity_withdrawals
              set status = 'approved', reviewed_by = $2, reviewed_at = $3,
                  reject_reason = null, updated_at = $3
            where id = $1`,
          [req.params.id, reviewerId, now],
        );
        await client.query(
          `update lc_dm_store_affiliations
              set status = case when status = 'approved' then 'ended' else 'cancelled' end,
                  ended_at = $2, ended_by_profile_id = $3,
                  end_reason = 'DM 身份认证已撤销', updated_at = $2
            where dm_dossier_id = $1 and status in ('approved', 'pending')`,
          [dossier.id, now, reviewerId],
        );
        await client.query(
          `update lc_dm_dossiers
              set claim_status = 'withdrawn', claimed_by = null,
                  employment_status = 'unknown', employer_store_id = null,
                  workplace = null, reject_reason = null,
                  claim_note = '原认证人主动申请撤销身份认证', updated_at = $2
            where id = $1`,
          [dossier.id, now],
        );
        const remainingResult = await client.query(
          `select count(*)::int as count
             from lc_dm_dossiers
            where claimed_by = $1 and entity_type = 'dm'
              and status = 'approved' and claim_status = 'approved'`,
          [withdrawal.profile_id],
        );
        if (Number(remainingResult.rows[0]?.count || 0) === 0 && withdrawal.profile_id) {
          const profileResult = await client.query(
            `select role, role_type, identity_roles, verified_dm, verified_shop
               from lc_profiles where id = $1 for update`,
            [withdrawal.profile_id],
          );
          if (profileResult.rows[0]) {
            const patch = profileWithoutDmIdentity(profileResult.rows[0]);
            await client.query(
              `update lc_profiles
                  set verified_dm = false, identity_roles = $2,
                      role_type = $3, role = $4, updated_at = $5
                where id = $1`,
              [withdrawal.profile_id, patch.identity_roles, patch.role_type, patch.role, now],
            );
          }
        }
        await client.query('COMMIT');
        await logSecurityEvent(req, {
          action: 'admin_dm_identity_withdrawal_approved', targetType: 'dm_identity_withdrawal', targetId: req.params.id,
          metadata: { dm_dossier_id: dossier.id, profile_id: withdrawal.profile_id },
        });
        return res.json(ok());
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    const withdrawalResult = await supabase.from('lc_dm_identity_withdrawals')
      .select('*').eq('id', req.params.id).eq('status', 'pending').maybeSingle();
    if (withdrawalResult.error) throw withdrawalResult.error;
    const withdrawal = withdrawalResult.data;
    if (!withdrawal) return res.status(404).json(err(new Error('撤销认证申请不存在或已经处理')));
    const dossierResult = await supabase.from('lc_dm_dossiers').select('*').eq('id', withdrawal.dm_dossier_id).maybeSingle();
    if (dossierResult.error) throw dossierResult.error;
    const dossier = dossierResult.data;
    if (!dossier || String(dossier.claimed_by || '') !== String(withdrawal.profile_id || '')) return res.status(409).json(err(new Error('申请账号与当前档案认领人不一致')));
    const withdrawalUpdate = await supabase.from('lc_dm_identity_withdrawals').update({
      status: 'approved', reviewed_by: reviewerId, reviewed_at: now, reject_reason: null, updated_at: now,
    }).eq('id', req.params.id).eq('status', 'pending');
    if (withdrawalUpdate.error) throw withdrawalUpdate.error;
    const affiliationUpdate = await supabase.from('lc_dm_store_affiliations').update({
      status: 'ended', ended_at: now, ended_by_profile_id: reviewerId,
      end_reason: 'DM 身份认证已撤销', updated_at: now,
    }).eq('dm_dossier_id', dossier.id).eq('status', 'approved');
    if (affiliationUpdate.error && !isMissingRelation(affiliationUpdate.error, 'lc_dm_store_affiliations')) throw affiliationUpdate.error;
    const pendingUpdate = await supabase.from('lc_dm_store_affiliations').update({
      status: 'cancelled', ended_at: now, ended_by_profile_id: reviewerId,
      end_reason: 'DM 身份认证已撤销', updated_at: now,
    }).eq('dm_dossier_id', dossier.id).eq('status', 'pending');
    if (pendingUpdate.error && !isMissingRelation(pendingUpdate.error, 'lc_dm_store_affiliations')) throw pendingUpdate.error;
    const dossierUpdate = await supabase.from('lc_dm_dossiers').update({
      claim_status: 'withdrawn', claimed_by: null, employment_status: 'unknown', employer_store_id: null,
      workplace: null, reject_reason: null, claim_note: '原认证人主动申请撤销身份认证', updated_at: now,
    }).eq('id', dossier.id);
    if (dossierUpdate.error) throw dossierUpdate.error;
    const remaining = await supabase.from('lc_dm_dossiers').select('id', { count: 'exact', head: true })
      .eq('claimed_by', withdrawal.profile_id).eq('entity_type', 'dm').eq('status', 'approved').eq('claim_status', 'approved');
    if (remaining.error) throw remaining.error;
    if ((remaining.count || 0) === 0 && withdrawal.profile_id) {
      const profileResult = await supabase.from('lc_profiles')
        .select('role, role_type, identity_roles, verified_dm, verified_shop')
        .eq('id', withdrawal.profile_id).maybeSingle();
      if (profileResult.error) throw profileResult.error;
      if (profileResult.data) {
        const patch = profileWithoutDmIdentity(profileResult.data as Record<string, unknown>);
        const profileUpdate = await supabase.from('lc_profiles').update({ ...patch, updated_at: now }).eq('id', withdrawal.profile_id);
        if (profileUpdate.error) throw profileUpdate.error;
      }
    }
    await logSecurityEvent(req, {
      action: 'admin_dm_identity_withdrawal_approved', targetType: 'dm_identity_withdrawal', targetId: req.params.id,
      metadata: { dm_dossier_id: dossier.id, profile_id: withdrawal.profile_id },
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/dm-identity-withdrawals/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const rejectReason = cleanText(req.body?.reason ?? req.body?.rejectReason, 500) || '暂不符合撤销认证条件';
    const now = new Date().toISOString();
    const result = await supabase.from('lc_dm_identity_withdrawals').update({
      status: 'rejected', reviewed_by: reviewerId, reviewed_at: now,
      reject_reason: rejectReason, updated_at: now,
    }).eq('id', req.params.id).eq('status', 'pending').select('id').single();
    if (result.error && isMissingRelation(result.error, 'lc_dm_identity_withdrawals')) return res.status(503).json(err(new Error('认证撤销表尚未初始化')));
    if (result.error) throw result.error;
    await logSecurityEvent(req, {
      action: 'admin_dm_identity_withdrawal_rejected', targetType: 'dm_identity_withdrawal', targetId: req.params.id,
      metadata: { reason: rejectReason },
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/dm-dossiers/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = cleanText(req.body?.rejectReason, 500) || '不符合卡司评分公开规则';
    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const { data: dossier, error: findErr } = await supabase.from('lc_dm_dossiers').select('*').eq('id', req.params.id).single();
    if (findErr && isMissingRelation(findErr, 'lc_dm_dossiers')) return res.status(503).json(err(new Error('卡司评分数据表尚未初始化')));
    if (findErr) throw findErr;
    if (!dossier) return res.status(404).json(err(new Error('档案不存在')));

    if (dossier.status !== 'pending' && dossier.claim_status === 'pending') {
      const reviewed = await finalizeDossierClaimReview({
        dossierId: req.params.id,
        outcome: 'rejected',
        reviewerId,
        rejectReason,
      });
      await logSecurityEvent(req, {
        action: 'admin_dm_dossier_claim_rejected',
        targetType: 'dm_dossier_claim',
        targetId: reviewed.claimId || req.params.id,
        metadata: { dossier_id: req.params.id, reason: rejectReason, entity_type: dossier.entity_type || 'dm' },
      });
      return res.json(ok(reviewed.dossier));
    }
    if (dossier.status !== 'pending') return res.status(400).json(err(new Error('这条档案审核已经处理过了')));

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      reject_reason: rejectReason,
    };
    patch.status = 'rejected';

    const { data: updated, error: updErr } = await supabase.from('lc_dm_dossiers')
      .update(patch)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;
    await logSecurityEvent(req, {
      action: 'admin_dm_dossier_rejected',
      targetType: 'dm_dossier',
      targetId: req.params.id,
      metadata: { reason: rejectReason },
    });
    res.json(ok(updated));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/script-contributions/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data: contribution, error: cErr } = await supabase.from('lc_script_contributions')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (cErr && isMissingRelation(cErr, 'lc_script_contributions')) return res.status(503).json(err(new Error('剧本库共建表尚未初始化')));
    if (cErr) throw cErr;
    if (!contribution) return res.status(404).json(err(new Error('投稿不存在')));
    if (contribution.status !== 'pending') return res.status(400).json(err(new Error('这条投稿已经处理过了')));

    const roles = sanitizeCarpoolRoles(contribution.player_roles);
    if (roles.length === 0) return res.status(400).json(err(new Error('这条维护缺少角色名和角色性别，不能通过发币')));
    if (hasMissingScriptContributionGender(roles)) return res.status(400).json(err(new Error('这条维护还有角色性别未定义，不能通过发币')));

    const applied = await applyScriptContribution(contribution as Record<string, unknown>);
    const rewardAmount = Math.max(0, Number(contribution.reward_amount || SCRIPT_CONTRIBUTION_REWARD) || SCRIPT_CONTRIBUTION_REWARD);
    let credit = null;
    if (contribution.profile_id && rewardAmount > 0) {
      credit = await applyWalletCredit({
        profileId: contribution.profile_id,
        amount: rewardAmount,
        description: `维护剧本库奖励：${cleanText(contribution.script_name, 80) || '剧本角色'}`,
        refType: 'script_contribution',
        refId: contribution.id,
        idempotencyKey: `script-contribution:${contribution.id}`,
        metadata: { script_id: applied.scriptId, script_name: applied.scriptName },
      });
    }

    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const { data: updated, error: updErr } = await supabase.from('lc_script_contributions')
      .update({
        status: 'approved',
        script_id: applied.scriptId,
        script_name: applied.scriptName,
        reward_amount: rewardAmount,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_note: cleanText(req.body?.reviewNote, 500) || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('status', 'pending')
      .select('*')
      .single();
    if (updErr) throw updErr;

    await logSecurityEvent(req, {
      action: 'admin_script_contribution_approved',
      targetType: 'script_contribution',
      targetId: req.params.id,
      metadata: { script_id: applied.scriptId, reward_amount: rewardAmount, credit },
    });
    res.json(ok({ contribution: updated, script: applied, credit }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/script-contributions/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const { error: updErr } = await supabase.from('lc_script_contributions')
      .update({
        status: 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_note: cleanText(req.body?.reviewNote, 500) || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('status', 'pending');
    if (updErr && isMissingRelation(updErr, 'lc_script_contributions')) return res.status(503).json(err(new Error('剧本库共建表尚未初始化')));
    if (updErr) throw updErr;
    await logSecurityEvent(req, {
      action: 'admin_script_contribution_rejected',
      targetType: 'script_contribution',
      targetId: req.params.id,
      metadata: { review_note: cleanText(req.body?.reviewNote, 500) || null },
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/profile/:id/flag', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = req.body?.rejectReason || null;
    await supabase.from('lc_profiles').update({ is_visible: false, reject_reason: rejectReason }).eq('id', req.params.id);
    await logSecurityEvent(req, {
      action: 'admin_profile_hidden',
      targetType: 'profile',
      targetId: req.params.id,
      metadata: { reject_reason: rejectReason },
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/profile/:id/unflag', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_profiles').update({ is_visible: true }).eq('id', req.params.id);
    await logSecurityEvent(req, {
      action: 'admin_profile_restored',
      targetType: 'profile',
      targetId: req.params.id,
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/site-messages/:id/resolve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const adminNote = cleanText(req.body?.adminNote, 800);
    const { data, error: updErr } = await supabase.from('lc_site_messages')
      .update({ status: 'resolved', admin_note: adminNote || null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id')
      .single();
    if (updErr) {
      if (isMissingRelation(updErr, 'lc_site_messages')) return res.status(503).json(err(new Error('站内信表尚未初始化')));
      throw updErr;
    }
    await logSecurityEvent(req, {
      action: 'site_message_resolved',
      actorRole: 'admin',
      targetType: 'site_message',
      targetId: data?.id || req.params.id,
    });
    res.json(ok({ id: data?.id || req.params.id, status: 'resolved' }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/profile/:id/ban', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reason = cleanText(req.body?.reason || req.body?.rejectReason, 300) || '违反平台规则，限制账号功能';
    const { error: updErr } = await supabase.from('lc_profiles').update({
      is_banned: true,
      ban_reason: reason,
      banned_at: new Date().toISOString(),
      is_visible: false,
      reject_reason: reason,
    }).eq('id', req.params.id);
    if (updErr) throw updErr;
    await logSecurityEvent(req, {
      action: 'admin_profile_banned',
      targetType: 'profile',
      targetId: req.params.id,
      metadata: { reason },
    });
    res.json(ok({ id: req.params.id, is_banned: true }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/profile/:id/unban', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { error: updErr } = await supabase.from('lc_profiles').update({
      is_banned: false,
      ban_reason: null,
      banned_at: null,
    }).eq('id', req.params.id);
    if (updErr) throw updErr;
    await logSecurityEvent(req, {
      action: 'admin_profile_unbanned',
      targetType: 'profile',
      targetId: req.params.id,
    });
    res.json(ok({ id: req.params.id, is_banned: false }));
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

function normalizeRankingEvidenceFiles(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((raw, index) => {
    const file = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const url = normalizeOptionalPublicUrl(file.url, 1000, true);
    if (!url) return null;
    return {
      name: cleanText(file.name, 120) || `证据图片 ${index + 1}`,
      url,
      type: cleanText(file.type, 80) || 'image/jpeg',
      size: Math.max(0, Number(file.size || 0) || 0),
    };
  }).filter(Boolean);
}

async function findRankingDossier(idInput: unknown, entityType: 'dm' | 'store', allowPending = false) {
  const id = cleanText(idInput, 80);
  if (!id) return null;
  let query = supabase.from('lc_dm_dossiers').select('*').eq('id', id).eq('entity_type', entityType);
  query = allowPending ? query.in('status', ['approved', 'pending']) : query.eq('status', 'approved');
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(entityType === 'dm' ? '选择的DM档案不存在或尚未公开' : '选择的店家档案不存在或尚未公开');
  return data as Record<string, unknown>;
}

async function resolveDmEmployment(input: Record<string, unknown>, fallbackWorkplace = '') {
  const requestedStatus = cleanText(input.employmentStatus ?? input.employment_status, 40);
  const employerStoreId = cleanText(input.employerStoreId ?? input.employer_store_id, 80);
  if (requestedStatus === 'freelance') {
    return { employment_status: 'freelance', employer_store_id: null, workplace: null };
  }
  if (employerStoreId) {
    const store = await findRankingDossier(employerStoreId, 'store');
    return {
      employment_status: 'store_affiliated',
      employer_store_id: store?.id || null,
      workplace: cleanText(store?.dm_name, 160) || fallbackWorkplace || null,
    };
  }
  const workplace = cleanText(input.workplace, 160) || cleanText(fallbackWorkplace, 160);
  if (requestedStatus === 'store_affiliated' && !workplace) throw new Error('请选择受雇店家');
  if (!workplace) throw new Error('请选择受雇店家，或选择“无受雇店家（自由DM）”');
  return { employment_status: 'unknown', employer_store_id: null, workplace };
}

async function resolveRankingSubjectDossier(input: {
  subjectType: string;
  subjectName: string;
  subjectCity: string;
  subjectDossierId: unknown;
  newSubject: unknown;
  profile: Record<string, unknown>;
  allowPending?: boolean;
}) {
  if (input.subjectType !== 'dm' && input.subjectType !== 'store') return null;
  if (cleanText(input.subjectDossierId, 80)) {
    return findRankingDossier(input.subjectDossierId, input.subjectType, !!input.allowPending);
  }
  const source = input.newSubject && typeof input.newSubject === 'object'
    ? input.newSubject as Record<string, unknown>
    : null;
  if (!source) throw new Error(`请选择已有${input.subjectType === 'dm' ? 'DM' : '店家'}档案，或提交一个待审档案`);
  const workplace = cleanText(source.workplace ?? source.address, 160);
  let employment: { employment_status: string; employer_store_id: unknown; workplace: string | null } = {
    employment_status: 'unknown',
    employer_store_id: null,
    workplace: workplace || null,
  };
  if (input.subjectType === 'dm') employment = await resolveDmEmployment(source, workplace);
  if (input.subjectType === 'store' && !workplace) throw new Error('请填写店家地址、商圈或常驻位置');
  const moderationPrecheck = runLocalModerationPrecheck({
    scene: input.subjectType === 'dm' ? 'dm_dossier_submit_with_ranking' : 'store_dossier_submit_with_ranking',
    targetType: 'dm_dossier',
    texts: {
      name: input.subjectName,
      city: input.subjectCity,
      workplace: employment.workplace || workplace,
      note: cleanText(source.note, 600),
    },
  });
  const { data, error } = await supabase.from('lc_dm_dossiers').insert({
    entity_type: input.subjectType,
    dm_name: input.subjectName,
    city: input.subjectCity,
    workplace: input.subjectType === 'dm' ? employment.workplace : workplace,
    employment_status: input.subjectType === 'dm' ? employment.employment_status : 'unknown',
    employer_store_id: input.subjectType === 'dm' ? employment.employer_store_id : null,
    note: cleanText(source.note, 600) || null,
    tags: [],
    submitted_by: input.profile.id,
    submitted_by_name: input.profile.display_name,
    status: 'pending',
    claim_status: 'unclaimed',
    moderation_precheck: moderationPrecheck,
  }).select('*').single();
  if (error) throw error;
  return data as Record<string, unknown>;
}

async function resolveRankingEventContext(body: Record<string, unknown>) {
  const rawEventDate = cleanText(body.eventDate ?? body.event_date, 30);
  const eventDate = rawEventDate ? normalizeDateString(rawEventDate) : '';
  if (rawEventDate && !eventDate) throw new Error('事件日期格式不正确');

  const eventScriptId = cleanText(body.eventScriptId ?? body.event_script_id, 80);
  let eventScriptName = cleanText(body.eventScriptName ?? body.event_script_name, 160);
  if (eventScriptId) {
    const script = findSharedScript(await loadSharedScriptCatalog(), eventScriptId);
    if (!script) throw new Error('选择的剧本不存在');
    eventScriptName = script.name;
  }

  const eventStoreDossierId = cleanText(body.eventStoreDossierId ?? body.event_store_dossier_id, 80);
  let eventStoreName = cleanText(body.eventStoreName ?? body.event_store_name, 160);
  if (eventStoreDossierId) {
    const store = await findRankingDossier(eventStoreDossierId, 'store');
    eventStoreName = cleanText(store?.dm_name, 160);
  }
  return {
    event_date: eventDate || null,
    event_script_id: eventScriptId || null,
    event_script_name: eventScriptName || null,
    event_store_dossier_id: eventStoreDossierId || null,
    event_store_name: eventStoreName || null,
  };
}

async function resolveDmEmploymentSuggestion(body: Record<string, unknown>, subjectType: string) {
  if (subjectType !== 'dm') return { dm_employment_status_suggestion: null, dm_employer_store_id_suggestion: null };
  const status = cleanText(body.subjectEmploymentStatus ?? body.subject_employment_status, 40);
  if (!status) return { dm_employment_status_suggestion: null, dm_employer_store_id_suggestion: null };
  if (status === 'freelance') return { dm_employment_status_suggestion: 'freelance', dm_employer_store_id_suggestion: null };
  if (status !== 'store_affiliated') throw new Error('DM受雇状态不正确');
  const storeId = cleanText(body.subjectEmployerStoreId ?? body.subject_employer_store_id, 80);
  if (!storeId) throw new Error('请选择DM的受雇店家');
  const store = await findRankingDossier(storeId, 'store');
  return { dm_employment_status_suggestion: 'store_affiliated', dm_employer_store_id_suggestion: store?.id || null };
}

type PublicDmAffiliationStatus = 'approved' | 'pending' | 'legacy_unverified';

function publicDmAffiliationPayload(
  affiliation: Record<string, unknown> | null | undefined,
  store: Record<string, unknown> | null | undefined,
) {
  const status = cleanText(affiliation?.status, 40) as PublicDmAffiliationStatus;
  if (!['approved', 'pending', 'legacy_unverified'].includes(status)) return null;
  return {
    id: affiliation?.id || null,
    status,
    store_dossier_id: affiliation?.store_dossier_id || null,
    store_name: store?.dm_name || null,
    store_city: store?.city || null,
    confirmed_at: status === 'approved' ? affiliation?.started_at || affiliation?.reviewed_at || null : null,
  };
}

app.get('/api/lc/reputation/city', async (req, res) => {
  try {
    const city = cleanText(req.query.city, 80);
    const subjectType = cleanText(req.query.subjectType, 40);
    const sort = cleanText(req.query.sort, 40) || 'composite';

    let query = supabase
      .from('lc_rankings')
      .select('id, type, subject_name, subject_type, subject_city, subject_url, subject_dossier_id, event_date, event_script_id, event_script_name, event_store_dossier_id, event_store_name, content, author_name, poster_id, is_realname, initial_amount, likes, dislikes, joys, boost_amount, negative_boost_amount, agree_count, oppose_count, status, expires_at, expiry_override, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(500);

    if (city && city !== 'all') query = query.eq('subject_city', city);
    if (subjectType && subjectType !== 'all') query = query.eq('subject_type', subjectType);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).filter(row => isPublicRankingVisible(row as Record<string, unknown>)) as Record<string, unknown>[];
    const rankingIds = rows.map(row => String(row.id)).filter(Boolean);
    const [{ data: votes }, { data: comments }, { data: transactions }] = rankingIds.length > 0
      ? await Promise.all([
          supabase.from('lc_votes').select('ranking_id, vote_type, voter_id, voter_name, source, created_at').in('ranking_id', rankingIds).limit(2000),
          supabase.from('lc_comments').select('ranking_id, id, likes, created_at').in('ranking_id', rankingIds).eq('status', 'approved').limit(2000),
          supabase.from('lc_transactions').select('ref_id, profile_id, ref_type, amount, status').in('ref_id', rankingIds).in('ref_type', ['ranking_paid_boost', 'ranking_vote']).eq('status', 'approved').lt('amount', 0).limit(3000),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

    let storeDossiers: Record<string, unknown>[] = [];
    let storeRatingRows: Record<string, unknown>[] = [];
    if (!subjectType || subjectType === 'all' || subjectType === 'store') {
      let storeQuery = supabase.from('lc_dm_dossiers')
        .select('id, dm_name, city, workplace, profile_url, photo_url, tags, approved_at, created_at')
        .eq('entity_type', 'store')
        .eq('status', 'approved')
        .order('approved_at', { ascending: false, nullsFirst: false })
        .limit(300);
      if (city && city !== 'all') storeQuery = storeQuery.eq('city', city);
      const storeResult = await storeQuery;
      if (storeResult.error && !isMissingRelation(storeResult.error, 'lc_dm_dossiers')) throw storeResult.error;
      storeDossiers = storeResult.error ? [] : (storeResult.data || []) as Record<string, unknown>[];
      const storeIds = storeDossiers.map(store => String(store.id || '')).filter(Boolean);
      if (storeIds.length > 0) {
        const storeRatingsResult = await supabase.from('lc_store_ratings')
          .select('id, store_dossier_id, profile_id, rating')
          .in('store_dossier_id', storeIds)
          .eq('status', 'approved')
          .limit(5000);
        if (storeRatingsResult.error && !isMissingRelation(storeRatingsResult.error, 'lc_store_ratings')) throw storeRatingsResult.error;
        storeRatingRows = storeRatingsResult.error ? [] : (storeRatingsResult.data || []) as Record<string, unknown>[];
      }
    }

    const grouped = new Map<string, Record<string, unknown>[]>();
    rows.forEach(row => {
      const key = reputationSubjectKey(row);
      grouped.set(key, [...(grouped.get(key) || []), row]);
    });

    const items: Record<string, unknown>[] = [...grouped.entries()].map(([key, subjectRows]) => {
      const first = subjectRows[0] || {};
      const summary = buildReputationSummary(subjectRows, votes || [], comments || [], transactions || []);
      const latestEvents = [...subjectRows]
        .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
        .slice(0, 3)
        .map(publicRankingPayload);
      return {
        key,
        subject_name: first.subject_name,
        subject_type: first.subject_type,
        subject_city: first.subject_city,
        subject_url: first.subject_url,
        subject_dossier_id: first.subject_dossier_id || null,
        ...summary,
        latest_events: latestEvents,
      };
    });

    const storeRatingsByDossier = new Map<string, Record<string, unknown>[]>();
    storeRatingRows.forEach(row => {
      const dossierId = String(row.store_dossier_id || '');
      const values = storeRatingsByDossier.get(dossierId) || [];
      values.push(row);
      storeRatingsByDossier.set(dossierId, values);
    });
    const storeItemByDossier = new Map(items
      .filter(item => item.subject_type === 'store' && item.subject_dossier_id)
      .map(item => [String(item.subject_dossier_id), item]));
    const storeItemByName = new Map(items
      .filter(item => item.subject_type === 'store')
      .map(item => [`${normalizeDmLookupText(item.subject_name)}|${normalizeDmLookupText(item.subject_city)}`, item]));
    storeDossiers.forEach(store => {
      const dossierId = String(store.id || '');
      const nameKey = `${normalizeDmLookupText(store.dm_name)}|${normalizeDmLookupText(store.city)}`;
      const existing = storeItemByDossier.get(dossierId) || storeItemByName.get(nameKey);
      const ratingSummary = summarizeDmRatingRows(storeRatingsByDossier.get(dossierId) || []);
      if (existing) {
        existing.subject_dossier_id = dossierId;
        existing.rating_summary = ratingSummary;
        return;
      }
      items.push({
        key: `store-dossier:${dossierId}`,
        subject_name: store.dm_name,
        subject_type: 'store',
        subject_city: store.city,
        subject_url: store.profile_url,
        subject_dossier_id: dossierId,
        praise_value: 0,
        reputation_value: 0,
        praise_people: 0,
        event_count: 0,
        red_count: 0,
        white_count: 0,
        black_count: 0,
        comment_count: 0,
        latest_at: store.approved_at || store.created_at,
        tags: store.tags || [],
        latest_events: [],
        rating_summary: ratingSummary,
      });
    });

    const sortedItems = items.sort((a, b) => {
      if (sort === 'praise') return Number(b.praise_value || 0) - Number(a.praise_value || 0) || Number(b.praise_people || 0) - Number(a.praise_people || 0);
      if (sort === 'people') return Number(b.praise_people || 0) - Number(a.praise_people || 0) || Number(b.reputation_value || 0) - Number(a.reputation_value || 0);
      if (sort === 'new') return new Date(String(b.latest_at || 0)).getTime() - new Date(String(a.latest_at || 0)).getTime();
      return Number(b.reputation_value || 0) - Number(a.reputation_value || 0) || Number(b.praise_value || 0) - Number(a.praise_value || 0);
    }).slice(0, 100);

    res.json(ok({ city: city || 'all', subject_type: subjectType || 'all', sort, items: sortedItems }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/reputation/dossier', async (req, res) => {
  try {
    const subjectName = cleanText(req.query.subjectName, 120);
    const subjectType = cleanText(req.query.subjectType, 40);
    const city = cleanText(req.query.city, 80);
    const subjectDossierId = cleanText(req.query.subjectDossierId ?? req.query.subject_dossier_id, 80);
    if ((!subjectName && !subjectDossierId) || !subjectType) return res.status(400).json(err(new Error('缺少口碑对象')));

    let query = supabase
      .from('lc_rankings')
      .select('id, type, subject_name, subject_type, subject_city, subject_url, subject_dossier_id, event_date, event_script_id, event_script_name, event_store_dossier_id, event_store_name, content, author_name, poster_id, is_realname, initial_amount, likes, dislikes, joys, boost_amount, negative_boost_amount, agree_count, oppose_count, status, expires_at, expiry_override, created_at')
      .eq('status', 'approved')
      .eq('subject_type', subjectType)
      .order('created_at', { ascending: false })
      .limit(200);
    if (subjectDossierId) query = query.eq('subject_dossier_id', subjectDossierId);
    else query = query.eq('subject_name', subjectName);
    if (city) query = query.eq('subject_city', city);

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []).filter(row => isPublicRankingVisible(row as Record<string, unknown>)) as Record<string, unknown>[];
    const rankingIds = rows.map(row => String(row.id)).filter(Boolean);
    const [{ data: votes }, { data: comments }, { data: transactions }] = rankingIds.length > 0
      ? await Promise.all([
          supabase.from('lc_votes').select('ranking_id, vote_type, voter_id, voter_name, source, created_at').in('ranking_id', rankingIds).limit(2000),
          supabase.from('lc_comments').select('ranking_id, id, content, author_name, is_realname, is_pinned, pin_label, likes, created_at').in('ranking_id', rankingIds).eq('status', 'approved').limit(2000),
          supabase.from('lc_transactions').select('ref_id, profile_id, ref_type, amount, status').in('ref_id', rankingIds).in('ref_type', ['ranking_paid_boost', 'ranking_vote']).eq('status', 'approved').lt('amount', 0).limit(3000),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

    let profilePayload: Record<string, unknown> | null = null;
    let availability: Record<string, unknown>[] = [];
    let rolePreferences: Record<string, unknown>[] = [];
    if (['dm', 'creator', 'player'].includes(subjectType)) {
      const { data: profile } = await supabase.from('lc_profiles')
        .select('*')
        .eq('display_name', subjectName)
        .eq('is_visible', true)
        .order('verified_dm', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (profile?.id) {
        profilePayload = sanitizeProfile(profile);
        const [{ data: slots }, prefs] = await Promise.all([
          supabase.from('lc_availability').select('*')
            .eq('creator_id', profile.id)
            .gte('date', todayChinaDateString())
            .order('date')
            .limit(12),
          loadProfileRolePreferences(profile.id),
        ]);
        availability = (slots || []) as Record<string, unknown>[];
        rolePreferences = (prefs || []) as Record<string, unknown>[];
      }
    }

    const summary = buildReputationSummary(rows, votes || [], comments || [], transactions || []);
    const events = rows.map(publicRankingPayload);
    const commentsByRanking = (comments || []).reduce((map: Record<string, unknown[]>, comment: Record<string, unknown>) => {
      const key = String(comment.ranking_id || '');
      map[key] = [...(map[key] || []), comment];
      return map;
    }, {});

    res.json(ok({
      subject_name: subjectName || rows[0]?.subject_name || '',
      subject_type: subjectType,
      subject_city: city || rows[0]?.subject_city || null,
      subject_url: rows.find(row => row.subject_url)?.subject_url || null,
      metrics: summary,
      profile: profilePayload,
      availability,
      role_preferences: rolePreferences,
      events,
      comments_by_ranking: commentsByRanking,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/dm-dossiers', async (req, res) => {
  try {
    const city = cleanText(req.query.city, 80);
    const entityType = cleanText(req.query.entityType ?? req.query.entity_type, 20);
    const q = cleanText(req.query.q, 80);
    let query = supabase
      .from('lc_dm_dossiers')
      .select('*')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(120);
    if (city && city !== 'all') query = query.eq('city', city);
    if (entityType === 'dm' || entityType === 'store') query = query.eq('entity_type', entityType);
    if (q) query = query.ilike('dm_name', `%${q}%`);
    const { data, error } = await query;
    if (error) {
      if (isMissingRelation(error, 'lc_dm_dossiers')) return res.json(ok([]));
      throw error;
    }
    const dossierRows = (data || []) as Record<string, unknown>[];
    const dossierIds = dossierRows.map(row => String(row.id || '')).filter(Boolean);
    let dmRatingRows: Record<string, unknown>[] = [];
    let storeRatingRows: Record<string, unknown>[] = [];
    let affiliationRows: Record<string, unknown>[] = [];
    let affiliationStores: Record<string, unknown>[] = [];
    if (dossierIds.length > 0) {
      const [dmRatingResult, storeRatingResult, affiliationResult] = await Promise.all([
        supabase.from('lc_dm_ratings')
          .select('id, dm_dossier_id, profile_id, rating')
          .in('dm_dossier_id', dossierIds)
          .eq('status', 'approved')
          .limit(5000),
        supabase.from('lc_store_ratings')
          .select('id, store_dossier_id, profile_id, rating')
          .in('store_dossier_id', dossierIds)
          .eq('status', 'approved')
          .limit(5000),
        supabase.from('lc_dm_store_affiliations')
          .select('id, dm_dossier_id, store_dossier_id, status, reviewed_at, started_at, created_at, updated_at')
          .in('dm_dossier_id', dossierIds)
          .in('status', ['approved', 'pending', 'legacy_unverified'])
          .order('created_at', { ascending: false })
          .limit(1000),
      ]);
      if (dmRatingResult.error && !isMissingRelation(dmRatingResult.error, 'lc_dm_ratings')) throw dmRatingResult.error;
      if (storeRatingResult.error && !isMissingRelation(storeRatingResult.error, 'lc_store_ratings')) throw storeRatingResult.error;
      if (affiliationResult.error && !isMissingRelation(affiliationResult.error, 'lc_dm_store_affiliations')) throw affiliationResult.error;
      dmRatingRows = dmRatingResult.error ? [] : (dmRatingResult.data || []) as Record<string, unknown>[];
      storeRatingRows = storeRatingResult.error ? [] : (storeRatingResult.data || []) as Record<string, unknown>[];
      affiliationRows = affiliationResult.error ? [] : (affiliationResult.data || []) as Record<string, unknown>[];
      const storeIds = Array.from(new Set(affiliationRows.map(row => String(row.store_dossier_id || '')).filter(Boolean)));
      if (storeIds.length > 0) {
        const storeResult = await supabase.from('lc_dm_dossiers')
          .select('id, dm_name, city')
          .in('id', storeIds)
          .eq('entity_type', 'store');
        if (storeResult.error) throw storeResult.error;
        affiliationStores = (storeResult.data || []) as Record<string, unknown>[];
      }
    }
    const dmRatingsByDossier = new Map<string, Record<string, unknown>[]>();
    dmRatingRows.forEach(row => {
      const key = String(row.dm_dossier_id || '');
      const values = dmRatingsByDossier.get(key) || [];
      values.push(row);
      dmRatingsByDossier.set(key, values);
    });
    const storeRatingsByDossier = new Map<string, Record<string, unknown>[]>();
    storeRatingRows.forEach(row => {
      const key = String(row.store_dossier_id || '');
      const values = storeRatingsByDossier.get(key) || [];
      values.push(row);
      storeRatingsByDossier.set(key, values);
    });
    const affiliationsByDm = new Map<string, Record<string, unknown>[]>();
    affiliationRows.forEach(row => {
      const key = String(row.dm_dossier_id || '');
      const values = affiliationsByDm.get(key) || [];
      values.push(row);
      affiliationsByDm.set(key, values);
    });
    const storesById = new Map(affiliationStores.map(store => [String(store.id || ''), store]));
    res.json(ok(dossierRows.map((row: Record<string, unknown>) => {
      const isDm = (row.entity_type || 'dm') === 'dm';
      const affiliation = isDm ? preferredPublicDmAffiliation(affiliationsByDm.get(String(row.id || '')) || []) : null;
      const publicAffiliation = affiliation
        ? publicDmAffiliationPayload(affiliation, storesById.get(String(affiliation.store_dossier_id || '')))
        : null;
      const confirmedStore = publicAffiliation?.status === 'approved' ? storesById.get(String(publicAffiliation.store_dossier_id || '')) : null;
      const employmentStatus = confirmedStore
        ? 'store_affiliated'
        : row.employment_status === 'freelance' ? 'freelance' : 'unknown';
      return {
        id: row.id,
        entity_type: row.entity_type || 'dm',
        dm_name: row.dm_name,
        city: row.city,
        workplace: confirmedStore?.dm_name || (employmentStatus === 'freelance' ? null : row.workplace),
        employment_status: employmentStatus,
        employer_store_id: confirmedStore?.id || null,
        affiliation: publicAffiliation,
        profile_url: row.profile_url,
        photo_url: row.photo_url,
        note: row.note,
        tags: row.tags || [],
        claim_status: row.claim_status,
        claimed_by: row.claim_status === 'approved' ? row.claimed_by : null,
        created_at: row.created_at,
        rating_summary: summarizeDmRatingRows(
          row.entity_type === 'store'
            ? storeRatingsByDossier.get(String(row.id || '')) || []
            : dmRatingsByDossier.get(String(row.id || '')) || [],
        ),
      };
    })));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/dm-dossiers/:id', async (req, res) => {
  try {
    const { data: dossier, error: dossierErr } = await supabase.from('lc_dm_dossiers')
      .select('*')
      .eq('id', req.params.id)
      .eq('entity_type', 'dm')
      .eq('status', 'approved')
      .maybeSingle();
    if (dossierErr && isMissingRelation(dossierErr, 'lc_dm_dossiers')) return res.status(503).json(err(new Error('DM档案表尚未初始化')));
    if (dossierErr) throw dossierErr;
    if (!dossier) return res.status(404).json(err(new Error('DM档案不存在或尚未公开')));

    const ratingResult = await supabase.from('lc_dm_ratings')
      .select('*')
      .eq('dm_dossier_id', req.params.id)
      .eq('status', 'approved')
      .order('played_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    if (ratingResult.error && !isMissingRelation(ratingResult.error, 'lc_dm_ratings')) throw ratingResult.error;
    const rows = ratingResult.error ? [] : (ratingResult.data || []) as Record<string, unknown>[];
    const rankingResult = await supabase.from('lc_rankings')
      .select('*')
      .eq('subject_dossier_id', req.params.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(100);
    if (rankingResult.error) throw rankingResult.error;
    const rankingRows = ((rankingResult.data || []) as Record<string, unknown>[])
      .filter(row => isPublicRankingVisible(row));
    const affiliationResult = await supabase.from('lc_dm_store_affiliations')
      .select('*')
      .eq('dm_dossier_id', req.params.id)
      .in('status', ['approved', 'pending', 'legacy_unverified'])
      .order('created_at', { ascending: false })
      .limit(10);
    if (affiliationResult.error && !isMissingRelation(affiliationResult.error, 'lc_dm_store_affiliations')) throw affiliationResult.error;
    const affiliation = affiliationResult.error
      ? null
      : preferredPublicDmAffiliation((affiliationResult.data || []) as Record<string, unknown>[]);
    let affiliationStore: Record<string, unknown> | null = null;
    if (affiliation?.store_dossier_id) {
      const storeResult = await supabase.from('lc_dm_dossiers')
        .select('id, dm_name, city')
        .eq('id', affiliation.store_dossier_id)
        .eq('entity_type', 'store')
        .maybeSingle();
      if (storeResult.error) throw storeResult.error;
      affiliationStore = storeResult.data as Record<string, unknown> | null;
    }
    const publicAffiliation = publicDmAffiliationPayload(affiliation, affiliationStore);
    const confirmedStore = publicAffiliation?.status === 'approved' ? affiliationStore : null;
    const employmentStatus = confirmedStore
      ? 'store_affiliated'
      : dossier.employment_status === 'freelance' ? 'freelance' : 'unknown';
    res.json(ok({
      dossier: {
        id: dossier.id,
        dm_name: dossier.dm_name,
        city: dossier.city,
        workplace: confirmedStore?.dm_name || (employmentStatus === 'freelance' ? null : dossier.workplace),
        employment_status: employmentStatus,
        employer_store_id: confirmedStore?.id || null,
        affiliation: publicAffiliation,
        profile_url: dossier.profile_url,
        photo_url: dossier.photo_url,
        note: dossier.note,
        tags: dossier.tags || [],
        claim_status: dossier.claim_status,
        claimed_by: dossier.claim_status === 'approved' ? dossier.claimed_by : null,
      },
      summary: summarizeDmRatingRows(rows),
      reputation_summary: buildReputationSummary(rankingRows),
      reputation_events: rankingRows.map(publicRankingPayload),
      ratings: rows.map(row => ({
        id: row.id,
        profile_name: row.profile_name || '匿名玩家',
        script_id: row.script_id,
        script_name: row.script_name,
        store_id: row.store_id,
        store_name: row.store_name,
        played_on: row.played_on,
        replay_number: row.replay_number,
        rating: row.rating,
        content: row.content,
        tags: row.tags || [],
        created_at: row.created_at,
      })),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/store-dossiers/:id', async (req, res) => {
  try {
    const { data: dossier, error: dossierErr } = await supabase.from('lc_dm_dossiers')
      .select('*')
      .eq('id', req.params.id)
      .eq('entity_type', 'store')
      .eq('status', 'approved')
      .maybeSingle();
    if (dossierErr && isMissingRelation(dossierErr, 'lc_dm_dossiers')) return res.status(503).json(err(new Error('店家档案表尚未初始化')));
    if (dossierErr) throw dossierErr;
    if (!dossier) return res.status(404).json(err(new Error('店家档案不存在或尚未公开')));

    const ratingResult = await supabase.from('lc_store_ratings')
      .select('*')
      .eq('store_dossier_id', req.params.id)
      .eq('status', 'approved')
      .order('visited_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    if (ratingResult.error && !isMissingRelation(ratingResult.error, 'lc_store_ratings')) throw ratingResult.error;
    const rows = ratingResult.error ? [] : (ratingResult.data || []) as Record<string, unknown>[];
    const rankingResult = await supabase.from('lc_rankings')
      .select('*')
      .eq('subject_dossier_id', req.params.id)
      .eq('subject_type', 'store')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(100);
    if (rankingResult.error) throw rankingResult.error;
    const rankingRows = ((rankingResult.data || []) as Record<string, unknown>[])
      .filter(row => isPublicRankingVisible(row));
    res.json(ok({
      dossier: {
        id: dossier.id,
        name: dossier.dm_name,
        city: dossier.city,
        address: dossier.workplace,
        profile_url: dossier.profile_url,
        photo_url: dossier.photo_url,
        note: dossier.note,
        tags: dossier.tags || [],
        claim_status: dossier.claim_status,
        claimed_by: dossier.claim_status === 'approved' ? dossier.claimed_by : null,
      },
      summary: summarizeDmRatingRows(rows),
      reputation_summary: buildReputationSummary(rankingRows),
      reputation_events: rankingRows.map(publicRankingPayload),
      ratings: rows.map(row => ({
        id: row.id,
        profile_name: row.profile_name || '匿名玩家',
        script_id: row.script_id,
        script_name: row.script_name,
        visited_on: row.visited_on,
        rating: row.rating,
        content: row.content,
        tags: row.tags || [],
        created_at: row.created_at,
      })),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/dm-dossiers', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));

    const entityType = cleanText(req.body?.entityType ?? req.body?.entity_type, 20) === 'store' ? 'store' : 'dm';
    const entityLabel = entityType === 'store' ? '店家' : 'DM';
    const dmName = cleanText(req.body?.dmName ?? req.body?.dm_name ?? req.body?.name, 80);
    const city = cleanText(req.body?.city, 80);
    const requestedWorkplace = cleanText(req.body?.workplace, 160);
    const rawProfileUrl = req.body?.profileUrl ?? req.body?.profile_url;
    const profileUrl = normalizeOptionalPublicUrl(rawProfileUrl, 600);
    const note = cleanText(req.body?.note, 600);
    const tags = cleanTextArray(req.body?.tags, 10, 18);
    const rawFiles = Array.isArray(req.body?.photoFiles ?? req.body?.photo_files) ? (req.body?.photoFiles ?? req.body?.photo_files) : [];
    const photoFiles = rawFiles.slice(0, 4).map((file: Record<string, unknown>) => ({
      name: cleanText(file.name, 120) || `${entityLabel} 照片`,
      url: normalizeOptionalPublicUrl(file.url, 800, true),
      type: cleanText(file.type, 80) || null,
    })).filter((file: { url: string }) => file.url);
    const rawPhotoUrl = req.body?.photoUrl ?? req.body?.photo_url;
    const photoUrl = normalizeOptionalPublicUrl(rawPhotoUrl, 800, true) || photoFiles[0]?.url || '';
    const employment = entityType === 'dm'
      ? await resolveDmEmployment(req.body as Record<string, unknown>, requestedWorkplace)
      : { employment_status: 'unknown', employer_store_id: null, workplace: requestedWorkplace || null };
    const workplace = cleanText(employment.workplace, 160);

    if (!dmName) return res.status(400).json(err(new Error(`请填写${entityLabel}名称`)));
    if (!city) return res.status(400).json(err(new Error('请选择城市')));
    if (entityType === 'store' && !workplace) return res.status(400).json(err(new Error('请填写店家地址、商圈或常驻位置')));
    if (!isOptionalUrlPlaceholder(rawProfileUrl) && !profileUrl) return res.status(400).json(err(new Error('个人主页链接格式不正确，不填写时请直接留空')));
    if (!isOptionalUrlPlaceholder(rawPhotoUrl) && !photoUrl) return res.status(400).json(err(new Error('照片链接格式不正确，也可以直接使用上传按钮')));

    const moderationPrecheck = runLocalModerationPrecheck({
      scene: entityType === 'store' ? 'store_dossier_submit' : 'dm_dossier_submit',
      targetType: 'dm_dossier',
      texts: { dmName, city, workplace, profileUrl, note, tags: tags.join(' ') },
      files: photoFiles,
    });

    const { data, error: insErr } = await supabase.from('lc_dm_dossiers').insert({
      entity_type: entityType,
      dm_name: dmName,
      city,
      workplace: workplace || null,
      employment_status: employment.employment_status,
      employer_store_id: employment.employer_store_id,
      profile_url: profileUrl || null,
      photo_url: photoUrl || null,
      photo_files: photoFiles,
      note,
      tags,
      submitted_by: profile.id,
      submitted_by_name: profile.display_name,
      status: 'pending',
      claim_status: 'unclaimed',
      moderation_precheck: moderationPrecheck,
    }).select('id').single();
    if (insErr) {
      if (isMissingRelation(insErr, 'lc_dm_dossiers')) return res.status(503).json(err(new Error('卡司评分数据表尚未初始化')));
      throw insErr;
    }

    await logSecurityEvent(req, {
      action: entityType === 'store' ? 'store_dossier_submitted' : 'dm_dossier_submitted',
      targetType: 'dm_dossier',
      targetId: data?.id,
      metadata: { entity_type: entityType, dm_name: dmName, city, moderation: moderationPrecheck },
    });
    res.json(ok({ id: data?.id, entity_type: entityType, status: 'pending' }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/dm-ratings', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));

    if (cleanText(req.body?.website, 200)) {
      await logSecurityEvent(req, {
        action: 'dm_rating_bot_honeypot_triggered',
        targetType: 'dm_rating',
        actorId: profile.id,
        actorRole: profile.role || 'creator',
      });
      return res.status(202).json(ok({ status: 'pending', message: '已提交审核' }));
    }

    const rawRating = Number(req.body?.rating || 0);
    if (!Number.isInteger(rawRating) || rawRating < 1 || rawRating > 5) return res.status(400).json(err(new Error('请选择 1-5 星综合评分')));
    const rating = rawRating;
    const playedOn = normalizeDateString(req.body?.playedOn ?? req.body?.played_on);
    if (!playedOn) return res.status(400).json(err(new Error('请选择实际体验日期')));
    if (playedOn > getChinaNow().date) return res.status(400).json(err(new Error('体验日期不能晚于今天')));
    const replayNumber = Number(req.body?.replayNumber ?? req.body?.replay_number ?? 0);
    if (!Number.isInteger(replayNumber) || replayNumber < 1 || replayNumber > 99) return res.status(400).json(err(new Error('请填写这是你第几刷')));
    const content = cleanText(req.body?.content, 2400);
    if (content.length < 12) return res.status(400).json(err(new Error('请至少写 12 个字说明这次体验')));
    const tags = cleanTextArray(req.body?.tags, 8, 20);

    const scriptId = cleanText(req.body?.scriptId ?? req.body?.script_id, 120);
    let scriptName = cleanText(req.body?.scriptName ?? req.body?.script_name, 160);
    if (scriptId) {
      const scriptResult = findSharedScript(await loadSharedScriptCatalog(), scriptId);
      if (!scriptResult) return res.status(400).json(err(new Error('选择的剧本不存在')));
      scriptName = scriptResult.name;
    }
    if (!scriptName) return res.status(400).json(err(new Error('请选择或填写本次体验的剧本')));
    const scriptKey = normalizeDmLookupText(scriptName);

    const storeId = cleanText(req.body?.storeId ?? req.body?.store_id, 120);
    let storeName = cleanText(req.body?.storeName ?? req.body?.store_name, 160);
    if (storeId) {
      const storeResult = await supabase.from('jzg_stores').select('id, name, city, status').eq('id', storeId).maybeSingle();
      if (storeResult.error) throw storeResult.error;
      if (!storeResult.data || storeResult.data.status !== 'active') return res.status(400).json(err(new Error('选择的店家不存在或不可用')));
      storeName = cleanText(storeResult.data.name, 160);
    }
    if (!storeName) return res.status(400).json(err(new Error('请选择或填写本次体验的店家或场地')));

    let dmId = cleanText(req.body?.dmId ?? req.body?.dm_id, 120);
    let dmName = '';
    let newDmCandidates: ReturnType<typeof rankSimilarDmDossiers> = [];
    const newDm = req.body?.newDm && typeof req.body.newDm === 'object' ? req.body.newDm as Record<string, unknown> : null;
    if (dmId) {
      const dmResult = await supabase.from('lc_dm_dossiers')
        .select('*')
        .eq('id', dmId)
        .eq('entity_type', 'dm')
        .eq('status', 'approved')
        .maybeSingle();
      if (dmResult.error) throw dmResult.error;
      if (!dmResult.data) return res.status(400).json(err(new Error('选择的DM不存在或尚未公开')));
      dmName = cleanText(dmResult.data.dm_name, 80);
    } else if (newDm) {
      dmName = cleanText(newDm.dmName ?? newDm.dm_name ?? newDm.name, 80);
      const city = cleanText(newDm.city, 80);
      const employment = await resolveDmEmployment(newDm);
      const workplace = cleanText(employment.workplace, 160);
      const rawProfileUrl = newDm.profileUrl ?? newDm.profile_url;
      const rawPhotoUrl = newDm.photoUrl ?? newDm.photo_url;
      const profileUrl = normalizeOptionalPublicUrl(rawProfileUrl, 600);
      const photoUrl = normalizeOptionalPublicUrl(rawPhotoUrl, 800, true);
      const photoFiles = photoUrl ? [{ name: `${dmName || 'DM'}照片`, url: photoUrl, type: 'image/jpeg' }] : [];
      if (!dmName) return res.status(400).json(err(new Error('请填写DM名称')));
      if (!city) return res.status(400).json(err(new Error('请填写DM所在城市')));
      if (!isOptionalUrlPlaceholder(rawProfileUrl) && !profileUrl) return res.status(400).json(err(new Error('个人主页链接格式不正确，不填写时请直接留空')));
      if (!isOptionalUrlPlaceholder(rawPhotoUrl) && !photoUrl) return res.status(400).json(err(new Error('照片链接格式不正确，也可以直接使用上传按钮')));
      const dmPrecheck = runLocalModerationPrecheck({
        scene: 'dm_dossier_submit_with_rating',
        targetType: 'dm_dossier',
        texts: { dmName, city, workplace, profileUrl },
        files: photoFiles,
      });
      const { data: insertedDm, error: dmInsertErr } = await supabase.from('lc_dm_dossiers').insert({
        entity_type: 'dm',
        dm_name: dmName,
        city,
        workplace: workplace || null,
        employment_status: employment.employment_status,
        employer_store_id: employment.employer_store_id,
        profile_url: profileUrl || null,
        photo_url: photoUrl || null,
        photo_files: photoFiles,
        note: cleanText(newDm.note, 600) || null,
        tags: cleanTextArray(newDm.tags, 8, 18),
        submitted_by: profile.id,
        submitted_by_name: profile.display_name,
        status: 'pending',
        claim_status: 'unclaimed',
        moderation_precheck: dmPrecheck,
      }).select('*').single();
      if (dmInsertErr) {
        if (isMissingRelation(dmInsertErr, 'lc_dm_dossiers')) return res.status(503).json(err(new Error('DM档案表尚未初始化')));
        throw dmInsertErr;
      }
      dmId = cleanText(insertedDm.id, 120);
      const candidatesResult = await supabase.from('lc_dm_dossiers')
        .select('id, dm_name, city, workplace, photo_url')
        .eq('entity_type', 'dm')
        .eq('status', 'approved')
        .eq('city', city)
        .limit(500);
      if (!candidatesResult.error) newDmCandidates = rankSimilarDmDossiers(insertedDm as Record<string, unknown>, (candidatesResult.data || []) as Record<string, unknown>[]);
    } else {
      return res.status(400).json(err(new Error('请选择DM，或者提交一个新的DM档案')));
    }

    const ipHash = dmRatingIpHash(req);
    const contentFingerprint = dmRatingContentFingerprint(content);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [accountHour, accountDay, ipHour, sameContent, duplicateEvent] = await Promise.all([
      supabase.from('lc_dm_ratings').select('*', { count: 'exact', head: true }).eq('profile_id', profile.id).gte('created_at', oneHourAgo),
      supabase.from('lc_dm_ratings').select('*', { count: 'exact', head: true }).eq('profile_id', profile.id).gte('created_at', oneDayAgo),
      supabase.from('lc_dm_ratings').select('*', { count: 'exact', head: true }).eq('submit_ip_hash', ipHash).gte('created_at', oneHourAgo),
      supabase.from('lc_dm_ratings').select('*', { count: 'exact', head: true }).eq('content_fingerprint', contentFingerprint).gte('created_at', oneDayAgo),
      supabase.from('lc_dm_ratings').select('id, status')
        .eq('profile_id', profile.id)
        .eq('dm_dossier_id', dmId)
        .eq('script_key', scriptKey)
        .eq('played_on', playedOn)
        .eq('replay_number', replayNumber)
        .not('status', 'eq', 'rejected')
        .maybeSingle(),
    ]);
    if (duplicateEvent.error && !isMissingRelation(duplicateEvent.error, 'lc_dm_ratings')) throw duplicateEvent.error;
    if (duplicateEvent.data) return res.status(409).json(err(new Error('这一场体验已经提交过评分，请不要重复提交')));
    if ((accountHour.count || 0) >= 12 || (accountDay.count || 0) >= 40 || (ipHour.count || 0) >= 30) {
      await logSecurityEvent(req, {
        action: 'dm_rating_rate_limited',
        targetType: 'dm_rating',
        targetId: dmId,
        actorId: profile.id,
        actorRole: profile.role || 'creator',
        metadata: { account_hour: accountHour.count || 0, account_day: accountDay.count || 0, ip_hour: ipHour.count || 0 },
      });
      return res.status(429).json(err(new Error('提交过于频繁，请稍后再试')));
    }

    const startedAt = Number((req.body?.formStartedAt ?? req.body?.form_started_at) || 0);
    const elapsedMs = Number.isFinite(startedAt) && startedAt > 0 ? Date.now() - startedAt : null;
    const automationLabels: string[] = [];
    let automationScore = 0;
    if (elapsedMs !== null && elapsedMs >= 0 && elapsedMs < 2500) {
      automationScore += 35;
      automationLabels.push('submitted_too_fast');
    }
    if ((sameContent.count || 0) > 0) {
      automationScore += 45;
      automationLabels.push('duplicate_content_recently_seen');
    }
    if ((accountHour.count || 0) >= 6) {
      automationScore += 25;
      automationLabels.push('high_account_velocity');
    }
    if ((ipHour.count || 0) >= 15) {
      automationScore += 35;
      automationLabels.push('high_ip_velocity');
    }
    const antiAbuse = {
      version: 'dm_rating_abuse_v1',
      risk_score: Math.min(100, automationScore),
      risk_labels: automationLabels,
      elapsed_ms: elapsedMs,
      account_hour_count: accountHour.count || 0,
      account_day_count: accountDay.count || 0,
      ip_hour_count: ipHour.count || 0,
      duplicate_content_count: sameContent.count || 0,
      checked_at: new Date().toISOString(),
    };
    const basePrecheck = runLocalModerationPrecheck({
      scene: 'dm_rating_submit',
      targetType: 'dm_rating',
      texts: { dmName, scriptName, storeName, content, tags: tags.join(' ') },
    });
    const moderationPrecheck = automationScore >= 40 && basePrecheck.decision === 'pass'
      ? {
          ...basePrecheck,
          decision: 'review' as const,
          risk_score: Math.max(basePrecheck.risk_score, automationScore),
          risk_labels: Array.from(new Set([...basePrecheck.risk_labels, 'suspected_automation', ...automationLabels])),
          summary: '自动预审发现疑似批量或脚本提交信号，需人工重点复核',
        }
      : basePrecheck;

    const { data: inserted, error: insertErr } = await supabase.from('lc_dm_ratings').insert({
      dm_dossier_id: dmId,
      profile_id: profile.id,
      profile_name: profile.display_name || '匿名玩家',
      script_id: scriptId || null,
      script_name: scriptName,
      script_key: scriptKey,
      store_id: storeId || null,
      store_name: storeName,
      played_on: playedOn,
      replay_number: replayNumber,
      rating,
      content,
      tags,
      status: 'pending',
      moderation_precheck: moderationPrecheck,
      anti_abuse: antiAbuse,
      content_fingerprint: contentFingerprint,
      submit_ip_hash: ipHash,
    }).select('id, status').single();
    if (insertErr) {
      if (isMissingRelation(insertErr, 'lc_dm_ratings')) return res.status(503).json(err(new Error('DM评分表尚未初始化')));
      if (insertErr.code === '23505') return res.status(409).json(err(new Error('这一场体验已经提交过评分')));
      throw insertErr;
    }
    await logSecurityEvent(req, {
      action: 'dm_rating_submitted_for_review',
      targetType: 'dm_rating',
      targetId: inserted.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { dm_id: dmId, script_id: scriptId || null, played_on: playedOn, replay_number: replayNumber, moderation: moderationPrecheck, anti_abuse: antiAbuse },
    });
    res.json(ok({
      id: inserted.id,
      status: 'pending',
      dm_id: dmId,
      new_dm: !!newDm,
      similar_candidates: newDmCandidates,
      message: '评分和DM资料已提交审核，通过后公开并计入综合分',
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/store-ratings', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));

    if (cleanText(req.body?.website, 200)) {
      await logSecurityEvent(req, {
        action: 'store_rating_bot_honeypot_triggered',
        targetType: 'store_rating',
        actorId: profile.id,
        actorRole: profile.role || 'creator',
      });
      return res.status(202).json(ok({ status: 'pending', message: '已提交审核' }));
    }

    const rawRating = Number(req.body?.rating || 0);
    if (!Number.isInteger(rawRating) || rawRating < 1 || rawRating > 5) return res.status(400).json(err(new Error('请选择 1-5 星综合评分')));
    const rating = rawRating;
    const visitedOn = normalizeDateString(req.body?.visitedOn ?? req.body?.visited_on);
    if (!visitedOn) return res.status(400).json(err(new Error('请选择实际到店日期')));
    if (visitedOn > getChinaNow().date) return res.status(400).json(err(new Error('到店日期不能晚于今天')));
    const content = cleanText(req.body?.content, 2400);
    if (content.length < 12) return res.status(400).json(err(new Error('请至少写 12 个字说明这次到店体验')));
    const tags = cleanTextArray(req.body?.tags, 8, 20);

    const scriptId = cleanText(req.body?.scriptId ?? req.body?.script_id, 120);
    let scriptName = cleanText(req.body?.scriptName ?? req.body?.script_name, 160);
    if (scriptId) {
      const scriptResult = findSharedScript(await loadSharedScriptCatalog(), scriptId);
      if (!scriptResult) return res.status(400).json(err(new Error('选择的剧本不存在')));
      scriptName = scriptResult.name;
    }
    if (!scriptName) return res.status(400).json(err(new Error('请选择或填写本次体验的剧本')));
    const scriptKey = normalizeDmLookupText(scriptName);

    let storeDossierId = cleanText(req.body?.storeDossierId ?? req.body?.store_dossier_id ?? req.body?.storeId, 120);
    let storeName = '';
    let newStoreCandidates: ReturnType<typeof rankSimilarDmDossiers> = [];
    const newStore = req.body?.newStore && typeof req.body.newStore === 'object' ? req.body.newStore as Record<string, unknown> : null;
    if (storeDossierId) {
      const storeResult = await supabase.from('lc_dm_dossiers')
        .select('*')
        .eq('id', storeDossierId)
        .eq('entity_type', 'store')
        .eq('status', 'approved')
        .maybeSingle();
      if (storeResult.error) throw storeResult.error;
      if (!storeResult.data) return res.status(400).json(err(new Error('选择的店家不存在或尚未公开')));
      storeName = cleanText(storeResult.data.dm_name, 100);
    } else if (newStore) {
      storeName = cleanText(newStore.storeName ?? newStore.name, 100);
      const city = cleanText(newStore.city, 80);
      const workplace = cleanText(newStore.workplace ?? newStore.address, 160);
      const rawProfileUrl = newStore.profileUrl ?? newStore.profile_url;
      const rawPhotoUrl = newStore.photoUrl ?? newStore.photo_url;
      const profileUrl = normalizeOptionalPublicUrl(rawProfileUrl, 600);
      const photoUrl = normalizeOptionalPublicUrl(rawPhotoUrl, 800, true);
      const photoFiles = photoUrl ? [{ name: `${storeName || '店家'}照片`, url: photoUrl, type: 'image/jpeg' }] : [];
      if (!storeName) return res.status(400).json(err(new Error('请填写店家名称')));
      if (!city) return res.status(400).json(err(new Error('请选择店家所在城市')));
      if (!workplace) return res.status(400).json(err(new Error('请填写店家地址、商圈或常驻位置')));
      if (!isOptionalUrlPlaceholder(rawProfileUrl) && !profileUrl) return res.status(400).json(err(new Error('店铺主页链接格式不正确，不填写时请直接留空')));
      if (!isOptionalUrlPlaceholder(rawPhotoUrl) && !photoUrl) return res.status(400).json(err(new Error('店铺照片链接格式不正确，也可以直接留空')));
      const storePrecheck = runLocalModerationPrecheck({
        scene: 'store_dossier_submit_with_rating',
        targetType: 'dm_dossier',
        texts: { storeName, city, workplace, profileUrl },
        files: photoFiles,
      });
      const { data: insertedStore, error: storeInsertErr } = await supabase.from('lc_dm_dossiers').insert({
        entity_type: 'store',
        dm_name: storeName,
        city,
        workplace,
        employment_status: 'unknown',
        employer_store_id: null,
        profile_url: profileUrl || null,
        photo_url: photoUrl || null,
        photo_files: photoFiles,
        note: cleanText(newStore.note, 600) || null,
        tags: cleanTextArray(newStore.tags, 8, 18),
        submitted_by: profile.id,
        submitted_by_name: profile.display_name,
        status: 'pending',
        claim_status: 'unclaimed',
        moderation_precheck: storePrecheck,
      }).select('*').single();
      if (storeInsertErr) {
        if (isMissingRelation(storeInsertErr, 'lc_dm_dossiers')) return res.status(503).json(err(new Error('店家档案表尚未初始化')));
        throw storeInsertErr;
      }
      storeDossierId = cleanText(insertedStore.id, 120);
      const candidatesResult = await supabase.from('lc_dm_dossiers')
        .select('id, dm_name, city, workplace, photo_url')
        .eq('entity_type', 'store')
        .eq('status', 'approved')
        .eq('city', city)
        .limit(500);
      if (!candidatesResult.error) newStoreCandidates = rankSimilarDmDossiers(insertedStore as Record<string, unknown>, (candidatesResult.data || []) as Record<string, unknown>[]);
    } else {
      return res.status(400).json(err(new Error('请选择店家，或者提交一个新的店家档案')));
    }

    const ipHash = storeRatingIpHash(req);
    const contentFingerprint = dmRatingContentFingerprint(content);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [accountHour, accountDay, ipHour, sameContent, duplicateVisit] = await Promise.all([
      supabase.from('lc_store_ratings').select('*', { count: 'exact', head: true }).eq('profile_id', profile.id).gte('created_at', oneHourAgo),
      supabase.from('lc_store_ratings').select('*', { count: 'exact', head: true }).eq('profile_id', profile.id).gte('created_at', oneDayAgo),
      supabase.from('lc_store_ratings').select('*', { count: 'exact', head: true }).eq('submit_ip_hash', ipHash).gte('created_at', oneHourAgo),
      supabase.from('lc_store_ratings').select('*', { count: 'exact', head: true }).eq('content_fingerprint', contentFingerprint).gte('created_at', oneDayAgo),
      supabase.from('lc_store_ratings').select('id, status')
        .eq('profile_id', profile.id)
        .eq('store_dossier_id', storeDossierId)
        .eq('script_key', scriptKey)
        .eq('visited_on', visitedOn)
        .not('status', 'eq', 'rejected')
        .maybeSingle(),
    ]);
    if (duplicateVisit.error && !isMissingRelation(duplicateVisit.error, 'lc_store_ratings')) throw duplicateVisit.error;
    if (duplicateVisit.data) return res.status(409).json(err(new Error('这次到店体验已经提交过评分，请不要重复提交')));
    if ((accountHour.count || 0) >= 12 || (accountDay.count || 0) >= 40 || (ipHour.count || 0) >= 30) {
      await logSecurityEvent(req, {
        action: 'store_rating_rate_limited',
        targetType: 'store_rating',
        targetId: storeDossierId,
        actorId: profile.id,
        actorRole: profile.role || 'creator',
        metadata: { account_hour: accountHour.count || 0, account_day: accountDay.count || 0, ip_hour: ipHour.count || 0 },
      });
      return res.status(429).json(err(new Error('提交过于频繁，请稍后再试')));
    }

    const startedAt = Number((req.body?.formStartedAt ?? req.body?.form_started_at) || 0);
    const elapsedMs = Number.isFinite(startedAt) && startedAt > 0 ? Date.now() - startedAt : null;
    const automationLabels: string[] = [];
    let automationScore = 0;
    if (elapsedMs !== null && elapsedMs >= 0 && elapsedMs < 2500) {
      automationScore += 35;
      automationLabels.push('submitted_too_fast');
    }
    if ((sameContent.count || 0) > 0) {
      automationScore += 45;
      automationLabels.push('duplicate_content_recently_seen');
    }
    if ((accountHour.count || 0) >= 6) {
      automationScore += 25;
      automationLabels.push('high_account_velocity');
    }
    if ((ipHour.count || 0) >= 15) {
      automationScore += 35;
      automationLabels.push('high_ip_velocity');
    }
    const antiAbuse = {
      version: 'store_rating_abuse_v1',
      risk_score: Math.min(100, automationScore),
      risk_labels: automationLabels,
      elapsed_ms: elapsedMs,
      account_hour_count: accountHour.count || 0,
      account_day_count: accountDay.count || 0,
      ip_hour_count: ipHour.count || 0,
      duplicate_content_count: sameContent.count || 0,
      checked_at: new Date().toISOString(),
    };
    const basePrecheck = runLocalModerationPrecheck({
      scene: 'store_rating_submit',
      targetType: 'store_rating',
      texts: { storeName, scriptName, content, tags: tags.join(' ') },
    });
    const moderationPrecheck = automationScore >= 40 && basePrecheck.decision === 'pass'
      ? {
          ...basePrecheck,
          decision: 'review' as const,
          risk_score: Math.max(basePrecheck.risk_score, automationScore),
          risk_labels: Array.from(new Set([...basePrecheck.risk_labels, 'suspected_automation', ...automationLabels])),
          summary: '自动预审发现疑似批量或脚本提交信号，需人工重点复核',
        }
      : basePrecheck;

    const { data: inserted, error: insertErr } = await supabase.from('lc_store_ratings').insert({
      store_dossier_id: storeDossierId,
      profile_id: profile.id,
      profile_name: profile.display_name || '匿名玩家',
      script_id: scriptId || null,
      script_name: scriptName,
      script_key: scriptKey,
      visited_on: visitedOn,
      rating,
      content,
      tags,
      status: 'pending',
      moderation_precheck: moderationPrecheck,
      anti_abuse: antiAbuse,
      content_fingerprint: contentFingerprint,
      submit_ip_hash: ipHash,
    }).select('id, status').single();
    if (insertErr) {
      if (isMissingRelation(insertErr, 'lc_store_ratings')) return res.status(503).json(err(new Error('店家评分表尚未初始化')));
      if (insertErr.code === '23505') return res.status(409).json(err(new Error('这次到店体验已经提交过评分')));
      throw insertErr;
    }
    await logSecurityEvent(req, {
      action: 'store_rating_submitted_for_review',
      targetType: 'store_rating',
      targetId: inserted.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { store_dossier_id: storeDossierId, script_id: scriptId || null, visited_on: visitedOn, moderation: moderationPrecheck, anti_abuse: antiAbuse },
    });
    res.json(ok({
      id: inserted.id,
      status: 'pending',
      store_dossier_id: storeDossierId,
      new_store: !!newStore,
      similar_candidates: newStoreCandidates,
      message: '评分和店家资料已提交审核，通过后公开并计入综合分',
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

type DossierClaimProofType = 'social_account' | 'employment' | 'business_license' | 'store_backend' | 'other';

type DossierClaimReviewOutcome = 'approved' | 'rejected';

function normalizeDossierClaimProofType(entityType: 'dm' | 'store', value: unknown): DossierClaimProofType | null {
  const proofType = cleanText(value, 40) as DossierClaimProofType;
  const allowed = entityType === 'store'
    ? new Set<DossierClaimProofType>(['business_license', 'store_backend', 'other'])
    : new Set<DossierClaimProofType>(['social_account', 'employment', 'other']);
  return allowed.has(proofType) ? proofType : null;
}

function internalClaimProofFiles(value: unknown) {
  if (!Array.isArray(value)) return [] as DossierClaimProofFile[];
  return value.filter(item => item && typeof item === 'object') as DossierClaimProofFile[];
}

async function createDossierClaimRecord(input: {
  claimId: string;
  dossierId: string;
  claimantId: string;
  entityType: 'dm' | 'store';
  proofType: DossierClaimProofType;
  claimNote: string;
  proofFiles: DossierClaimProofFile[];
}) {
  if (useTencentPg) {
    const client = await tencentPgPool.connect();
    try {
      await client.query('BEGIN');
      const dossierResult = await client.query(
        `select id, status, claim_status
           from lc_dm_dossiers
          where id = $1
          for update`,
        [input.dossierId],
      );
      const dossier = dossierResult.rows[0];
      if (!dossier || dossier.status !== 'approved') throw new Error('档案不存在或尚未公开');
      if (dossier.claim_status === 'approved') throw new Error('这个档案已经被认领');
      if (dossier.claim_status === 'pending') throw new Error('这份档案已经有认领申请正在审核');

      await client.query(
        `insert into lc_dm_dossier_claims
          (id, dossier_id, claimant_id, entity_type, proof_type, claim_note, proof_files, status)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending')`,
        [input.claimId, input.dossierId, input.claimantId, input.entityType, input.proofType, input.claimNote, JSON.stringify(input.proofFiles)],
      );
      const updatedResult = await client.query(
        `update lc_dm_dossiers
            set claimed_by = $2,
                claim_status = 'pending',
                claim_note = $3,
                updated_at = now()
          where id = $1
          returning *`,
        [input.dossierId, input.claimantId, input.claimNote],
      );
      await client.query('COMMIT');
      return updatedResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const { error: claimErr } = await supabase.from('lc_dm_dossier_claims').insert({
    id: input.claimId,
    dossier_id: input.dossierId,
    claimant_id: input.claimantId,
    entity_type: input.entityType,
    proof_type: input.proofType,
    claim_note: input.claimNote,
    proof_files: input.proofFiles,
    status: 'pending',
  });
  if (claimErr) throw claimErr;
  const { data: updated, error: dossierErr } = await supabase.from('lc_dm_dossiers').update({
    claimed_by: input.claimantId,
    claim_status: 'pending',
    claim_note: input.claimNote,
    updated_at: new Date().toISOString(),
  }).eq('id', input.dossierId).select('*').single();
  if (dossierErr) {
    await supabase.from('lc_dm_dossier_claims').delete().eq('id', input.claimId);
    throw dossierErr;
  }
  return updated;
}

async function finalizeDossierClaimReview(input: {
  dossierId: string;
  outcome: DossierClaimReviewOutcome;
  reviewerId: string | null;
  rejectReason?: string;
}) {
  const reviewedAt = new Date().toISOString();
  const rejectReason = input.outcome === 'rejected' ? input.rejectReason || '认领材料不足，暂未通过' : null;
  if (useTencentPg) {
    const client = await tencentPgPool.connect();
    try {
      await client.query('BEGIN');
      const dossierResult = await client.query(
        `select * from lc_dm_dossiers where id = $1 for update`,
        [input.dossierId],
      );
      const dossier = dossierResult.rows[0];
      if (!dossier) throw new Error('档案不存在');
      if (dossier.claim_status !== 'pending') throw new Error('这份认领申请已经处理过了');
      const claimResult = await client.query(
        `select * from lc_dm_dossier_claims
          where dossier_id = $1 and status = 'pending'
          order by created_at desc
          limit 1
          for update`,
        [input.dossierId],
      );
      const claim = claimResult.rows[0] || null;
      const claimantId = claim?.claimant_id || dossier.claimed_by || null;
      const entityType = claim?.entity_type || dossier.entity_type || 'dm';
      if (claim) {
        await client.query(
          `update lc_dm_dossier_claims
              set status = $2,
                  reviewed_by = $3,
                  reviewed_at = $4,
                  reject_reason = $5,
                  updated_at = $4
            where id = $1`,
          [claim.id, input.outcome, input.reviewerId, reviewedAt, rejectReason],
        );
      }
      const updatedResult = await client.query(
        `update lc_dm_dossiers
            set claim_status = $2,
                reject_reason = $3,
                claim_note = case when $4::boolean then claim_note else coalesce($3, claim_note) end,
                updated_at = $5
          where id = $1
          returning *`,
        [input.dossierId, input.outcome, rejectReason, Boolean(claim), reviewedAt],
      );
      if (input.outcome === 'approved' && entityType === 'dm' && claimantId) {
        const profileResult = await client.query(
          `select role, role_type, identity_roles, verified_dm, verified_shop
             from lc_profiles
            where id = $1
            for update`,
          [claimantId],
        );
        const profile = profileResult.rows[0] || null;
        if (profile) {
          const identityPatch = profileIdentityPatch(profile, ['dm']);
          await client.query(
            `update lc_profiles
                set verified_dm = true,
                    identity_roles = $2,
                    role_type = $3,
                    updated_at = $4
              where id = $1`,
            [claimantId, identityPatch.identity_roles, identityPatch.role_type, reviewedAt],
          );
        }
      }
      await client.query('COMMIT');
      return { dossier: updatedResult.rows[0], claimId: claim?.id || null };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const claimResult = await supabase.from('lc_dm_dossier_claims')
    .select('*')
    .eq('dossier_id', input.dossierId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (claimResult.error && !isMissingRelation(claimResult.error, 'lc_dm_dossier_claims')) throw claimResult.error;
  const claim = claimResult.error ? null : claimResult.data;
  if (claim) {
    const claimUpdate = await supabase.from('lc_dm_dossier_claims').update({
      status: input.outcome,
      reviewed_by: input.reviewerId,
      reviewed_at: reviewedAt,
      reject_reason: rejectReason,
      updated_at: reviewedAt,
    }).eq('id', claim.id).eq('status', 'pending');
    if (claimUpdate.error) throw claimUpdate.error;
  }
  const dossierPatch: Record<string, unknown> = {
    claim_status: input.outcome,
    reject_reason: rejectReason,
    updated_at: reviewedAt,
  };
  if (!claim && rejectReason) dossierPatch.claim_note = rejectReason;
  const dossierUpdate = await supabase.from('lc_dm_dossiers')
    .update(dossierPatch)
    .eq('id', input.dossierId)
    .eq('claim_status', 'pending')
    .select('*')
    .single();
  if (dossierUpdate.error) {
    if (claim) {
      await supabase.from('lc_dm_dossier_claims').update({
        status: 'pending', reviewed_by: null, reviewed_at: null, reject_reason: null, updated_at: new Date().toISOString(),
      }).eq('id', claim.id);
    }
    throw dossierUpdate.error;
  }
  const claimantId = claim?.claimant_id || dossierUpdate.data?.claimed_by || null;
  const entityType = claim?.entity_type || dossierUpdate.data?.entity_type || 'dm';
  if (input.outcome === 'approved' && entityType === 'dm' && claimantId) {
    const { data: profile, error: profileErr } = await supabase.from('lc_profiles')
      .select('role, role_type, identity_roles, verified_dm, verified_shop')
      .eq('id', claimantId)
      .maybeSingle();
    const identityPatch = profile ? profileIdentityPatch(profile, ['dm']) : null;
    const { error: identityErr } = identityPatch
      ? await supabase.from('lc_profiles').update({
        verified_dm: true,
        ...identityPatch,
        updated_at: reviewedAt,
      }).eq('id', claimantId)
      : { error: null };
    if (profileErr || identityErr) {
      await supabase.from('lc_dm_dossiers').update({
        claim_status: 'pending', reject_reason: null, updated_at: new Date().toISOString(),
      }).eq('id', input.dossierId).eq('claim_status', input.outcome);
      if (claim) {
        await supabase.from('lc_dm_dossier_claims').update({
          status: 'pending', reviewed_by: null, reviewed_at: null, reject_reason: null, updated_at: new Date().toISOString(),
        }).eq('id', claim.id).eq('status', input.outcome);
      }
      throw profileErr || identityErr;
    }
  }
  return { dossier: dossierUpdate.data, claimId: claim?.id || null };
}

async function findOwnedVerifiedDmDossier(profileId: string, dossierId: string) {
  const result = await supabase.from('lc_dm_dossiers')
    .select('*')
    .eq('id', dossierId)
    .eq('entity_type', 'dm')
    .eq('status', 'approved')
    .eq('claim_status', 'approved')
    .eq('claimed_by', profileId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error('你没有管理这份 DM 档案的权限');
  return result.data as Record<string, unknown>;
}

async function findClaimedStoreDossiers(profileId: string) {
  const result = await supabase.from('lc_dm_dossiers')
    .select('id, dm_name, city, workplace, claimed_by, claim_status, status')
    .eq('entity_type', 'store')
    .eq('status', 'approved')
    .eq('claim_status', 'approved')
    .eq('claimed_by', profileId)
    .order('approved_at', { ascending: false });
  if (result.error) throw result.error;
  return (result.data || []) as Record<string, unknown>[];
}

function enrichAffiliations(
  rows: Record<string, unknown>[],
  dmDossiers: Record<string, unknown>[],
  storeDossiers: Record<string, unknown>[],
): Record<string, unknown>[] {
  const dmById = new Map(dmDossiers.map(row => [String(row.id || ''), row]));
  const storeById = new Map(storeDossiers.map(row => [String(row.id || ''), row]));
  return rows.map(row => ({
    ...row,
    dm_dossier: dmById.get(String(row.dm_dossier_id || '')) || null,
    store_dossier: storeById.get(String(row.store_dossier_id || '')) || null,
  }) as Record<string, unknown>);
}

app.get('/api/lc/dm/identity-management', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const dossierResult = await supabase.from('lc_dm_dossiers')
      .select('*')
      .eq('entity_type', 'dm')
      .eq('status', 'approved')
      .eq('claimed_by', profile.id)
      .order('approved_at', { ascending: false });
    if (dossierResult.error) throw dossierResult.error;
    const dossiers = (dossierResult.data || []) as Record<string, unknown>[];
    const dossierIds = dossiers.map(row => String(row.id || '')).filter(Boolean);
    let affiliations: Record<string, unknown>[] = [];
    let withdrawals: Record<string, unknown>[] = [];
    if (dossierIds.length > 0) {
      const [affiliationResult, withdrawalResult] = await Promise.all([
        supabase.from('lc_dm_store_affiliations')
          .select('*')
          .in('dm_dossier_id', dossierIds)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('lc_dm_identity_withdrawals')
          .select('*')
          .in('dm_dossier_id', dossierIds)
          .eq('profile_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (affiliationResult.error && !isMissingRelation(affiliationResult.error, 'lc_dm_store_affiliations')) throw affiliationResult.error;
      if (withdrawalResult.error && !isMissingRelation(withdrawalResult.error, 'lc_dm_identity_withdrawals')) throw withdrawalResult.error;
      affiliations = affiliationResult.error ? [] : (affiliationResult.data || []) as Record<string, unknown>[];
      withdrawals = withdrawalResult.error ? [] : (withdrawalResult.data || []) as Record<string, unknown>[];
    }
    const storeResult = await supabase.from('lc_dm_dossiers')
      .select('id, dm_name, city, workplace, claim_status')
      .eq('entity_type', 'store')
      .eq('status', 'approved')
      .order('dm_name')
      .limit(1000);
    if (storeResult.error) throw storeResult.error;
    const stores = (storeResult.data || []) as Record<string, unknown>[];
    const enriched = enrichAffiliations(affiliations, dossiers, stores);
    res.json(ok({
      dossiers: dossiers.map(dossier => ({
        ...dossier,
        affiliations: enriched.filter(row => row.dm_dossier_id === dossier.id),
        withdrawal: withdrawals.find(row => row.dm_dossier_id === dossier.id && row.status === 'pending')
          || withdrawals.find(row => row.dm_dossier_id === dossier.id)
          || null,
      })),
      stores,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/dm-dossiers/:id/affiliations', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const dossier = await findOwnedVerifiedDmDossier(profile.id, req.params.id);
    const storeDossierId = cleanText(req.body?.storeDossierId ?? req.body?.store_dossier_id, 120);
    const requestNote = cleanText(req.body?.requestNote ?? req.body?.request_note, 500);
    if (!storeDossierId) return res.status(400).json(err(new Error('请选择要申请确认的店家')));
    const storeResult = await supabase.from('lc_dm_dossiers')
      .select('id, dm_name, city, status, entity_type')
      .eq('id', storeDossierId)
      .eq('entity_type', 'store')
      .eq('status', 'approved')
      .maybeSingle();
    if (storeResult.error) throw storeResult.error;
    if (!storeResult.data) return res.status(400).json(err(new Error('选择的店家不存在或尚未公开')));
    const existingResult = await supabase.from('lc_dm_store_affiliations')
      .select('*')
      .eq('dm_dossier_id', dossier.id)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false });
    if (existingResult.error && !isMissingRelation(existingResult.error, 'lc_dm_store_affiliations')) throw existingResult.error;
    const existing = (existingResult.data || []) as Record<string, unknown>[];
    if (existing.some(row => row.status === 'pending')) return res.status(409).json(err(new Error('已有一条店家确认申请正在处理')));
    if (existing.some(row => row.status === 'approved' && row.store_dossier_id === storeDossierId)) return res.status(409).json(err(new Error('当前店家已经确认这段任职关系')));
    const requestKind = existing.some(row => row.status === 'approved') ? 'change' : 'join';
    const insertResult = await supabase.from('lc_dm_store_affiliations').insert({
      dm_dossier_id: dossier.id,
      store_dossier_id: storeDossierId,
      dm_profile_id: profile.id,
      requested_by_profile_id: profile.id,
      requested_by_role: 'dm',
      request_kind: requestKind,
      request_note: requestNote || null,
      status: 'pending',
    }).select('*').single();
    if (insertResult.error) {
      if (isMissingRelation(insertResult.error, 'lc_dm_store_affiliations')) return res.status(503).json(err(new Error('任职关系表尚未初始化')));
      if (insertResult.error.code === '23505') return res.status(409).json(err(new Error('已有一条店家确认申请正在处理')));
      throw insertResult.error;
    }
    await logSecurityEvent(req, {
      action: 'dm_store_affiliation_requested',
      targetType: 'dm_store_affiliation',
      targetId: insertResult.data?.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { dm_dossier_id: dossier.id, store_dossier_id: storeDossierId, request_kind: requestKind },
    });
    res.json(ok(insertResult.data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/dm-dossiers/:id/affiliations/freelance', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const dossier = await findOwnedVerifiedDmDossier(profile.id, req.params.id);
    const reason = cleanText(req.body?.reason, 500) || 'DM 本人解除店家关联并声明为自由 DM';
    const now = new Date().toISOString();
    if (useTencentPg) {
      const client = await tencentPgPool.connect();
      try {
        await client.query('BEGIN');
        const locked = await client.query(
          `select id from lc_dm_dossiers
            where id = $1 and entity_type = 'dm' and claimed_by = $2
              and status = 'approved' and claim_status = 'approved'
            for update`,
          [dossier.id, profile.id],
        );
        if (!locked.rows[0]) throw new Error('你没有管理这份 DM 档案的权限');
        await client.query(
          `update lc_dm_store_affiliations
              set status = case when status = 'approved' then 'ended' else 'cancelled' end,
                  ended_at = $2, ended_by_profile_id = $3,
                  end_reason = $4, updated_at = $2
            where dm_dossier_id = $1 and status in ('approved', 'pending')`,
          [dossier.id, now, profile.id, reason],
        );
        await client.query(
          `update lc_dm_dossiers
              set employment_status = 'freelance', employer_store_id = null,
                  workplace = null, updated_at = $2
            where id = $1`,
          [dossier.id, now],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      const pendingResult = await supabase.from('lc_dm_store_affiliations').update({
        status: 'cancelled', ended_at: now, ended_by_profile_id: profile.id, end_reason: reason, updated_at: now,
      }).eq('dm_dossier_id', dossier.id).eq('status', 'pending');
      if (pendingResult.error && !isMissingRelation(pendingResult.error, 'lc_dm_store_affiliations')) throw pendingResult.error;
      const activeResult = await supabase.from('lc_dm_store_affiliations').update({
        status: 'ended', ended_at: now, ended_by_profile_id: profile.id, end_reason: reason, updated_at: now,
      }).eq('dm_dossier_id', dossier.id).eq('status', 'approved');
      if (activeResult.error && !isMissingRelation(activeResult.error, 'lc_dm_store_affiliations')) throw activeResult.error;
      const dossierResult = await supabase.from('lc_dm_dossiers').update({
        employment_status: 'freelance', employer_store_id: null, workplace: null, updated_at: now,
      }).eq('id', dossier.id);
      if (dossierResult.error) throw dossierResult.error;
    }
    await logSecurityEvent(req, {
      action: 'dm_store_affiliation_ended_by_dm',
      targetType: 'dm_dossier',
      targetId: String(dossier.id || ''),
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { next_status: 'freelance', reason },
    });
    res.json(ok({ employment_status: 'freelance' }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/dm-dossiers/:id/affiliations/:affiliationId/cancel', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    await findOwnedVerifiedDmDossier(profile.id, req.params.id);
    const now = new Date().toISOString();
    const result = await supabase.from('lc_dm_store_affiliations').update({
      status: 'cancelled', ended_at: now, ended_by_profile_id: profile.id, end_reason: 'DM 取消店家确认申请', updated_at: now,
    }).eq('id', req.params.affiliationId).eq('dm_dossier_id', req.params.id).eq('status', 'pending').select('id').maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return res.status(404).json(err(new Error('待处理申请不存在')));
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/dm-dossiers/:id/withdraw-certification', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const dossier = await findOwnedVerifiedDmDossier(profile.id, req.params.id);
    const reason = cleanText(req.body?.reason, 600);
    if (reason.length < 6) return res.status(400).json(err(new Error('请至少填写 6 个字说明撤销原因')));
    const existing = await supabase.from('lc_dm_identity_withdrawals')
      .select('id')
      .eq('dm_dossier_id', dossier.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing.error && !isMissingRelation(existing.error, 'lc_dm_identity_withdrawals')) throw existing.error;
    if (existing.data) return res.status(409).json(err(new Error('撤销认证申请正在审核')));
    const result = await supabase.from('lc_dm_identity_withdrawals').insert({
      dm_dossier_id: dossier.id,
      profile_id: profile.id,
      reason,
      status: 'pending',
    }).select('*').single();
    if (result.error) {
      if (isMissingRelation(result.error, 'lc_dm_identity_withdrawals')) return res.status(503).json(err(new Error('认证撤销表尚未初始化')));
      if (result.error.code === '23505') return res.status(409).json(err(new Error('撤销认证申请正在审核')));
      throw result.error;
    }
    await logSecurityEvent(req, {
      action: 'dm_identity_withdrawal_requested',
      targetType: 'dm_identity_withdrawal',
      targetId: result.data?.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { dm_dossier_id: dossier.id },
    });
    res.json(ok(result.data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/dm-dossiers/:id/my-claim', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const result = await supabase.from('lc_dm_dossier_claims')
      .select('id, dossier_id, proof_type, claim_note, status, reject_reason, created_at, reviewed_at')
      .eq('dossier_id', req.params.id)
      .eq('claimant_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error && isMissingRelation(result.error, 'lc_dm_dossier_claims')) return res.json(ok(null));
    if (result.error) throw result.error;
    res.json(ok(result.data || null));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/admin/dm-dossier-claims/:claimId/proofs/:fileId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await supabase.from('lc_dm_dossier_claims')
      .select('id, proof_files')
      .eq('id', req.params.claimId)
      .maybeSingle();
    if (result.error && isMissingRelation(result.error, 'lc_dm_dossier_claims')) return res.status(404).json(err(new Error('认领材料不存在')));
    if (result.error) throw result.error;
    if (!result.data) return res.status(404).json(err(new Error('认领材料不存在')));
    const proof = internalClaimProofFiles(result.data.proof_files).find(file => file.id === req.params.fileId);
    if (!proof) return res.status(404).json(err(new Error('认领材料不存在')));
    const body = readDossierClaimProof(PRIVATE_UPLOAD_ROOT, proof.relative_path);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="claim-proof-${proof.id}.jpg"`);
    res.send(body);
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/dm-dossiers/:id/claim', authMiddleware, upload.array('proofFiles', MAX_DOSSIER_CLAIM_PROOFS), async (req, res) => {
  let savedProofs: DossierClaimProofFile[] = [];
  let claimId = '';
  let claimCommitted = false;
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const claimNote = cleanText(req.body?.claimNote ?? req.body?.claim_note, 600);
    const truthConfirmed = String((req.body?.truthConfirmed ?? req.body?.truth_confirmed) || '') === 'true';
    const rawFiles = Array.isArray(req.files) ? req.files : [];
    const { data: dossier, error: findErr } = await supabase.from('lc_dm_dossiers')
      .select('id, status, entity_type, dm_name, claim_status')
      .eq('id', req.params.id)
      .single();
    if (findErr) {
      if (isMissingRelation(findErr, 'lc_dm_dossiers')) return res.status(503).json(err(new Error('卡司评分数据表尚未初始化')));
      throw findErr;
    }
    if (!dossier || dossier.status !== 'approved') return res.status(404).json(err(new Error('档案不存在或尚未公开')));
    if (dossier.claim_status === 'approved') return res.status(400).json(err(new Error('这个档案已经被认领')));
    if (dossier.claim_status === 'pending') return res.status(409).json(err(new Error('这份档案已经有认领申请正在审核')));
    const entityType = dossier.entity_type === 'store' ? 'store' : 'dm';
    const proofType = normalizeDossierClaimProofType(entityType, req.body?.proofType ?? req.body?.proof_type);
    if (!proofType) return res.status(400).json(err(new Error('请选择有效的证明类型')));
    if (claimNote.length < 6) return res.status(400).json(err(new Error('请至少写6个字说明你与这份档案的关系')));
    if (!truthConfirmed) return res.status(400).json(err(new Error('请确认材料真实且你有权提交')));
    if (rawFiles.length < 1 || rawFiles.length > MAX_DOSSIER_CLAIM_PROOFS) {
      return res.status(400).json(err(new Error(`请上传1-${MAX_DOSSIER_CLAIM_PROOFS}张身份凭证截图`)));
    }

    const sanitizedFiles = await Promise.all(rawFiles.map(async file => ({
      originalName: file.originalname,
      image: await sanitizeUploadedImageFile({ buffer: file.buffer, mimetype: file.mimetype }),
    })));
    claimId = randomUUID();
    savedProofs = saveDossierClaimProofs({
      root: PRIVATE_UPLOAD_ROOT,
      dossierId: dossier.id,
      claimId,
      files: sanitizedFiles,
    });

    await createDossierClaimRecord({
      claimId,
      dossierId: dossier.id,
      claimantId: profile.id,
      entityType,
      proofType,
      claimNote,
      proofFiles: savedProofs,
    });
    claimCommitted = true;

    await logSecurityEvent(req, {
      action: dossier.entity_type === 'store' ? 'store_dossier_claim_submitted' : 'dm_dossier_claim_submitted',
      targetType: 'dm_dossier',
      targetId: req.params.id,
      metadata: {
        entity_type: dossier.entity_type || 'dm',
        dm_name: dossier.dm_name,
        claim_id: claimId,
        proof_type: proofType,
        proof_count: savedProofs.length,
      },
    });
    res.json(ok({ id: req.params.id, claim_id: claimId, claim_status: 'pending' }));
  } catch (e) {
    if (!claimCommitted && claimId && savedProofs.length > 0) {
      try { removeDossierClaimProofs(PRIVATE_UPLOAD_ROOT, req.params.id, claimId); } catch { /* cleanup best effort */ }
    }
    const errorRecord = e && typeof e === 'object' ? e as { code?: string; message?: string } : {};
    if (errorRecord.code === '23505' || errorRecord.message?.includes('已经有认领申请')) {
      return res.status(409).json(err(new Error('这份档案已经有认领申请正在审核')));
    }
    if (isMissingRelation(errorRecord, 'lc_dm_dossier_claims')) {
      return res.status(503).json(err(new Error('认领审核表尚未初始化')));
    }
    res.status(500).json(err(e));
  }
});

app.get('/api/lc/rankings', async (req, res) => {
  try {
    const type = req.query.type as string;
    const city = req.query.city as string;
    const cities = normalizeActivityCities(req.query.cities);
    const subjectType = req.query.subjectType as string;
    const expiredOnly = type === 'black' && req.query.expired === 'true';
    const viewerId = getOptionalCreatorId(req);
    let query = supabase
      .from('lc_rankings')
      .select('*, lc_profiles!poster_id(display_name, avatar, verified_dm, verified_shop, role)')
      .eq('status', 'approved');
    if (type && type !== 'all') query = query.eq('type', type);
    if (subjectType && subjectType !== 'all') query = query.eq('subject_type', subjectType);
    if (cities.length > 0) query = query.in('subject_city', cities);
    else if (city && city !== 'all') query = query.eq('subject_city', city);
    if (type === 'black') query = query.order('boost_amount', { ascending: false }).order('negative_boost_amount', { ascending: false }).order('agree_count', { ascending: false }).order('created_at', { ascending: false });
    else query = query.order('boost_amount', { ascending: false }).order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const now = Date.now();
    const visibleRows = (data || []).map((row: Record<string, unknown>) => withRankingMetrics(row)).filter((row: Record<string, unknown>) => {
      if (row.type !== 'black') return true;
      if (row.expiry_override) return !expiredOnly;
      const expiresAt = row.expires_at
        ? new Date(row.expires_at as string).getTime()
        : new Date(row.created_at as string).getTime() + 30 * 24 * 60 * 60 * 1000;
      const isExpired = Number.isFinite(expiresAt) && expiresAt <= now;
      return expiredOnly ? isExpired : !isExpired;
    });
    const visible = visibleRows.map((row: Record<string, unknown>) => publicRankingPayload(row));

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
      ...withRankingMetrics(row),
      pinned_comments: pinnedByRanking.get(String(row.id)) || [],
    }));

    if (!viewerId || withPinnedComments.length === 0) return res.json(ok(withPinnedComments));

    const { data: myVotes, error: myVoteErr } = await supabase.from('lc_votes')
      .select('id, ranking_id, vote_type, created_at')
      .in('ranking_id', rankingIds)
      .eq('voter_id', viewerId)
      .eq('source', 'free_vote');
    if (myVoteErr) throw myVoteErr;

    const voteByRanking = new Map((myVotes || []).map((vote: RankingVoteRow) => [vote.ranking_id, vote]));
    const withMyVotes = withPinnedComments.map((row: Record<string, unknown>) => ({
      ...row,
      my_vote: voteByRanking.get(String(row.id))
        ? serializeMyVote(voteByRanking.get(String(row.id)) as RankingVoteRow)
        : null,
    }));

    res.json(ok(withMyVotes));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/rankings/mine', authMiddleware, async (req, res) => {
  try {
    const posterId = getReq(req, 'creatorId');
    const { data, error } = await supabase.from('lc_rankings')
      .select('id, type, subject_name, subject_type, subject_city, subject_url, subject_dossier_id, event_date, event_script_id, event_script_name, event_store_dossier_id, event_store_name, dm_employment_status_suggestion, dm_employer_store_id_suggestion, content, files, evidence_required, revision_kind, revision_requested_at, revision_count, initial_amount, likes, dislikes, joys, boost_amount, negative_boost_amount, agree_count, oppose_count, status, reject_reason, created_at')
      .eq('poster_id', posterId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(ok((data || []).map((row: Record<string, unknown>) => withRankingMetrics(row))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings', authMiddleware, async (req, res) => {
  try {
    const { type, subjectName, subjectType, subjectCity, subjectUrl, content, initialAmount, paymentProof, newSubject } = req.body;
    if (!type || !subjectName || !subjectType || !content) {
      return res.status(400).json(err(new Error('缺少必填字段')));
    }
    if (!['red', 'black', 'white'].includes(type)) return res.status(400).json(err(new Error('无效榜单类型')));
    if (!RANKING_SUBJECT_TYPES.includes(subjectType)) return res.status(400).json(err(new Error('无效对象分类')));
    const amount = type === 'red' ? parseInt(initialAmount) : 0;
    if (type === 'red' && (!Number.isFinite(amount) || amount < 10 || amount > 100)) return res.status(400).json(err(new Error('红榜初始投入须在10~100契约币之间')));

    // 契约币支付
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    if (amount > 0 && (profile.balance || 0) < amount) return res.status(402).json(err(new Error('契约币不足，请先充值')));
    const files = normalizeRankingEvidenceFiles(req.body?.files);
    const subjectDossier = await resolveRankingSubjectDossier({
      subjectType,
      subjectName: cleanText(subjectName, 120),
      subjectCity: cleanText(subjectCity, 80),
      subjectDossierId: req.body?.subjectDossierId ?? req.body?.subject_dossier_id,
      newSubject,
      profile,
    });
    const finalSubjectName = cleanText(subjectDossier?.dm_name, 120) || cleanText(subjectName, 120);
    const finalSubjectCity = cleanText(subjectDossier?.city, 80) || cleanText(subjectCity, 80);
    const eventContext = await resolveRankingEventContext(req.body as Record<string, unknown>);
    const employmentSuggestion = await resolveDmEmploymentSuggestion(req.body as Record<string, unknown>, subjectType);
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'ranking_submit',
      targetType: 'ranking',
      texts: { type, subjectName: finalSubjectName, subjectType, subjectCity: finalSubjectCity, subjectUrl, content },
      files,
      allowContact: false,
    });

    const posterId = getReq(req, 'creatorId');

    if (amount > 0) {
      await spendWalletBalance({
        profileId: profile.id,
        amount,
        description: `发布红榜：${subjectName}`,
        refType: 'ranking_submit',
        metadata: { ranking_type: type, subject_type: subjectType, subject_city: subjectCity || null, subject_name: subjectName },
      });
    }

    const row: Record<string, unknown> = {
      type, subject_name: finalSubjectName, subject_type: subjectType, subject_city: finalSubjectCity || null,
      subject_url: subjectUrl || null, content,
      author_name: profile.display_name, poster_id: posterId,
      status: 'pending',
      reject_reason: null,
      subject_dossier_id: subjectDossier?.id || null,
      ...eventContext,
      ...employmentSuggestion,
      evidence_required: false,
      revision_kind: null,
      revision_requested_at: null,
      initial_amount: amount, payment_proof: paymentProof || null,
      is_realname: !!profile.is_realname, real_name: null,
      files: files || [],
      moderation_precheck: moderationPrecheck,
      boost_amount: type === 'red' ? amount : 0,
      negative_boost_amount: 0,
      agree_count: 0,
      oppose_count: 0,
      likes: type === 'red' ? amount : 0,
      dislikes: 0,
      joys: 0,
    };

    // 黑榜 30 天过期
    if (type === 'black') {
      row.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: ranking, error: insErr } = await supabase.from('lc_rankings').insert(row).select().single();

    if (insErr) throw insErr;

    if (!subjectDossier && newSubject && ranking && newSubject.name) {
      await supabase.from('lc_submitted_subjects').insert({
        name: newSubject.name, subject_type: newSubject.subject_type || subjectType,
        city: newSubject.city || subjectCity, description: newSubject.description || null,
        contact: newSubject.contact || null, ranking_id: ranking.id,
      });
    }

    await logSecurityEvent(req, {
      action: 'ranking_submitted',
      targetType: 'ranking',
      targetId: ranking?.id,
      metadata: { ranking_type: type, subject_type: subjectType, subject_city: subjectCity || null, subject_dossier_id: subjectDossier?.id || null, amount, evidence_count: files.length, moderation: moderationPrecheck },
    });
    res.json(ok({ id: ranking?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/rankings/:id/resubmit', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: existing, error: findErr } = await supabase.from('lc_rankings')
      .select('*')
      .eq('id', req.params.id)
      .eq('poster_id', profile.id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json(err(new Error('没有找到这条红黑榜记录')));
    if (existing.status !== 'rejected') return res.status(400).json(err(new Error('只有被打回的记录可以重新提交')));

    const subjectType = cleanText(req.body?.subjectType ?? req.body?.subject_type ?? existing.subject_type, 40);
    const subjectName = cleanText(req.body?.subjectName ?? req.body?.subject_name, 120);
    const subjectCity = cleanText(req.body?.subjectCity ?? req.body?.subject_city, 80);
    const content = cleanText(req.body?.content, 4000);
    if (!subjectName || !subjectType || !content) return res.status(400).json(err(new Error('请补齐对象和正文内容')));
    if (!RANKING_SUBJECT_TYPES.includes(subjectType)) return res.status(400).json(err(new Error('无效对象分类')));
    const files = normalizeRankingEvidenceFiles(req.body?.files);
    if (existing.evidence_required && !hasRankingEvidence(files)) {
      return res.status(400).json(err(new Error('管理员要求补充证据，请至少上传一张证据图片')));
    }

    const subjectDossier = await resolveRankingSubjectDossier({
      subjectType,
      subjectName,
      subjectCity,
      subjectDossierId: req.body?.subjectDossierId ?? req.body?.subject_dossier_id ?? existing.subject_dossier_id,
      newSubject: req.body?.newSubject,
      profile,
      allowPending: true,
    });
    const finalSubjectName = cleanText(subjectDossier?.dm_name, 120) || subjectName;
    const finalSubjectCity = cleanText(subjectDossier?.city, 80) || subjectCity;
    const eventContext = await resolveRankingEventContext(req.body as Record<string, unknown>);
    const employmentSuggestion = await resolveDmEmploymentSuggestion(req.body as Record<string, unknown>, subjectType);
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'ranking_resubmit',
      targetType: 'ranking',
      texts: { type: existing.type, subjectName: finalSubjectName, subjectType, subjectCity: finalSubjectCity, subjectUrl: req.body?.subjectUrl, content },
      files,
      allowContact: false,
    });
    const { data: updated, error: updateErr } = await supabase.from('lc_rankings').update({
      subject_name: finalSubjectName,
      subject_type: subjectType,
      subject_city: finalSubjectCity || null,
      subject_url: cleanText(req.body?.subjectUrl ?? req.body?.subject_url, 500) || null,
      subject_dossier_id: subjectDossier?.id || null,
      ...eventContext,
      ...employmentSuggestion,
      content,
      files,
      status: 'pending',
      reject_reason: null,
      evidence_required: false,
      revision_kind: null,
      revision_requested_at: null,
      moderation_precheck: moderationPrecheck,
    }).eq('id', existing.id).select('*').single();
    if (updateErr) throw updateErr;
    await logSecurityEvent(req, {
      action: 'ranking_resubmitted',
      targetType: 'ranking',
      targetId: existing.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { prior_revision_kind: existing.revision_kind || null, evidence_count: files.length, subject_dossier_id: subjectDossier?.id || null, moderation: moderationPrecheck },
    });
    res.json(ok({ id: updated?.id, status: updated?.status, message: '已重新提交审核，不会重复扣除契约币' }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/rankings/:id/withdraw', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: ranking } = await supabase.from('lc_rankings')
      .select('id, poster_id, status, initial_amount, likes, dislikes, joys, boost_amount, negative_boost_amount, agree_count, oppose_count')
      .eq('id', req.params.id)
      .single();
    if (!ranking) return res.status(404).json(err(new Error('内容不存在')));
    if (ranking.poster_id !== profile.id) return res.status(403).json(err(new Error('只能撤回自己的内容')));
    if (ranking.status !== 'pending') return res.status(400).json(err(new Error('只有待审核内容可以撤回')));
    if ((ranking.initial_amount || 0) > 0) return res.status(400).json(err(new Error('付费内容撤回涉及契约币退款，请联系管理员处理')));
    const metrics = rankingMetrics(ranking as Record<string, unknown>);
    if (metrics.likes > 0 || metrics.dislikes > 0 || metrics.joys > 0) {
      return res.status(400).json(err(new Error('已有互动记录的内容不能自助撤回')));
    }

    const { error: updErr } = await supabase.from('lc_rankings')
      .update({ status: 'withdrawn' })
      .eq('id', req.params.id)
      .eq('poster_id', profile.id)
      .eq('status', 'pending');
    if (updErr) throw updErr;
    await logSecurityEvent(req, {
      action: 'ranking_withdrawn_by_author',
      targetType: 'ranking',
      targetId: req.params.id,
    });
    res.json(ok({ id: req.params.id, status: 'withdrawn' }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/paid-boost', authMiddleware, async (req, res) => {
  try {
    const direction = cleanText(req.body?.direction, 40);
    const amount = parseCoinAmount(req.body?.amount, 0);
    const attachedComment = cleanText(req.body?.comment, 600);
    if (!['boost', 'negative_boost'].includes(direction)) return res.status(400).json(err(new Error('无效打榜方向')));
    if (amount <= 0) return res.status(400).json(err(new Error('请输入大于 0 的契约币数量')));

    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));

    const { data: targetRanking, error: targetErr } = await supabase.from('lc_rankings')
      .select('id, type, status, subject_name')
      .eq('id', req.params.id)
      .maybeSingle();
    if (targetErr) throw targetErr;
    if (!targetRanking) return res.status(404).json(err(new Error('帖子不存在')));
    if (targetRanking.status !== 'approved') return res.status(400).json(err(new Error('只有已公开内容可以打榜')));

    const { data, error: boostErr } = await supabase.rpc('lc_apply_ranking_paid_boost', {
      p_ranking_id: req.params.id,
      p_profile_id: profile.id,
      p_direction: direction,
      p_amount: amount,
      p_actor_name: profile.display_name,
    });
    if (boostErr) return res.status(rankingVoteRpcStatus(boostErr.message || '')).json(err(new Error(boostErr.message || '打榜失败')));

    const row = firstRpcRow<RankingPaidBoostRpcResult>(data);
    if (!row) throw new Error('打榜结果为空');

    let attachedCommentId: string | null = null;
    let attachedCommentError = '';
    if (attachedComment) {
      const moderationPrecheck = runLocalModerationPrecheck({
        scene: 'ranking_vote_attached_comment',
        targetType: 'comment',
        texts: { content: attachedComment },
      });
      const { data: comment, error: commentErr } = await supabase.from('lc_comments').insert({
        ranking_id: req.params.id,
        content: attachedComment,
        author_id: profile.id,
        author_name: profile.display_name,
        is_realname: !!profile.is_realname,
        real_name: null,
        moderation_precheck: moderationPrecheck,
      }).select('id').single();
      if (commentErr) attachedCommentError = getErrorText(commentErr);
      else attachedCommentId = comment?.id || null;
    }

    await logSecurityEvent(req, {
      action: direction === 'negative_boost' ? 'ranking_negative_boost_applied' : 'ranking_paid_boost_applied',
      targetType: 'ranking',
      targetId: req.params.id,
      metadata: {
        direction,
        amount,
        transaction_id: row.transaction_id || null,
        attached_comment_id: attachedCommentId,
        attached_comment_error: attachedCommentError || null,
      },
    });

    res.json(ok({
      likes: row.likes,
      dislikes: row.dislikes,
      joys: row.joys,
      boost_amount: row.boost_amount,
      negative_boost_amount: row.negative_boost_amount,
      agree_count: row.agree_count,
      oppose_count: row.oppose_count,
      balance: row.balance,
      paidAmount: row.paid_amount,
      transactionId: row.transaction_id || null,
      comment: attachedCommentId ? { id: attachedCommentId, status: 'pending' } : null,
      commentError: attachedCommentError || null,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/rankings/:id/boosts', async (req, res) => {
  try {
    const { data: ranking, error: rankingErr } = await supabase.from('lc_rankings')
      .select('id, type, status, initial_amount, author_name, is_realname, created_at')
      .eq('id', req.params.id)
      .maybeSingle();
    if (rankingErr) throw rankingErr;
    if (!ranking || ranking.status !== 'approved') return res.status(404).json(err(new Error('帖子不存在')));

    const [{ data: transactions, error: txErr }, { data: legacyVotes, error: legacyErr }] = await Promise.all([
      supabase.from('lc_transactions')
        .select('id, profile_id, amount, created_at, metadata, lc_profiles(display_name, is_realname)')
        .eq('ref_id', req.params.id)
        .eq('ref_type', 'ranking_paid_boost')
        .eq('status', 'approved')
        .lt('amount', 0)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('lc_votes')
        .select('id, vote_type, voter_name, voter_is_realname, created_at')
        .eq('ranking_id', req.params.id)
        .eq('source', 'legacy_paid_boost')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    if (txErr) throw txErr;
    if (legacyErr) throw legacyErr;

    const records: Record<string, unknown>[] = [];
    const initialAmount = Math.max(0, Number(ranking.initial_amount || 0));
    if (initialAmount > 0) {
      records.push({
        id: `initial-${ranking.id}`,
        direction: 'boost',
        contributor_name: ranking.author_name || '发布人',
        contributor_is_realname: !!ranking.is_realname,
        amount: initialAmount,
        created_at: ranking.created_at,
        is_initial: true,
      });
    }

    for (const raw of transactions || []) {
      const tx = raw as Record<string, unknown>;
      const metadata = tx.metadata && typeof tx.metadata === 'object' ? tx.metadata as Record<string, unknown> : {};
      const profileValue = tx.lc_profiles;
      const profile = Array.isArray(profileValue)
        ? profileValue[0] as Record<string, unknown> | undefined
        : profileValue as Record<string, unknown> | undefined;
      const amount = Math.abs(Number(tx.amount || 0));
      if (amount <= 0) continue;
      records.push({
        id: tx.id,
        direction: metadata.direction === 'negative_boost' ? 'negative_boost' : 'boost',
        contributor_name: cleanText(metadata.actor_name, 80) || cleanText(profile?.display_name, 80) || '匿名用户',
        contributor_is_realname: !!profile?.is_realname,
        amount,
        created_at: tx.created_at,
        is_initial: false,
      });
    }

    for (const raw of legacyVotes || []) {
      const vote = raw as Record<string, unknown>;
      records.push({
        id: `legacy-${vote.id}`,
        direction: vote.vote_type === 'dislike' ? 'negative_boost' : 'boost',
        contributor_name: cleanText(vote.voter_name, 80) || '匿名用户',
        contributor_is_realname: !!vote.voter_is_realname,
        amount: 1,
        created_at: vote.created_at,
        is_initial: false,
      });
    }

    records.sort((a, b) => {
      const amountDiff = Number(b.amount || 0) - Number(a.amount || 0);
      if (amountDiff !== 0) return amountDiff;
      return new Date(String(b.created_at || '')).getTime() - new Date(String(a.created_at || '')).getTime();
    });

    res.json(ok(records));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/vote', authMiddleware, async (req, res) => {
  try {
    const voteType = req.body.voteType as RankingVoteType;
    const attachedComment = cleanText(req.body?.comment, 600);
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    if (!['like', 'dislike', 'joy'].includes(voteType)) return res.status(400).json(err(new Error('无效投票类型')));

    const { data: targetRanking, error: targetErr } = await supabase.from('lc_rankings')
      .select('id, type, status, subject_name')
      .eq('id', req.params.id)
      .maybeSingle();
    if (targetErr) throw targetErr;
    if (!targetRanking) return res.status(404).json(err(new Error('帖子不存在')));
    if (targetRanking.status !== 'approved') return res.status(400).json(err(new Error('只有已公开内容可以互动')));

    const { data, error: voteErr } = await supabase.rpc('lc_apply_ranking_vote', {
      p_ranking_id: req.params.id,
      p_voter_id: profile.id,
      p_vote_type: voteType,
      p_voter_ip: (req.headers['x-forwarded-for'] as string) || req.ip || null,
      p_voter_name: profile.display_name,
      p_voter_is_realname: !!profile.is_realname,
    });
    if (voteErr) {
      const message = voteErr.message || '';
      if (message.includes('duplicate key') || message.includes('lc_votes_ranking_voter')) {
        const { data: existingVote } = await supabase.from('lc_votes')
          .select('id, vote_type, created_at')
          .eq('ranking_id', req.params.id)
          .eq('voter_id', profile.id)
          .eq('source', 'free_vote')
          .maybeSingle();
        const myVote = existingVote ? serializeMyVote(existingVote as RankingVoteRow) : null;
        return res.status(409).json({
          ...err(new Error('你已经投过票了，请刷新后撤销或改票')),
          data: { myVote },
        });
      }
      return res.status(rankingVoteRpcStatus(message)).json(err(new Error(message || '投票失败')));
    }

    const row = firstRpcRow<RankingVoteRpcResult>(data);
    if (!row || !row.vote_id || !row.vote_type || !row.vote_created_at) throw new Error('投票结果为空');
    const myVote = serializeMyVote({ id: row.vote_id, vote_type: row.vote_type, created_at: row.vote_created_at });

    if (row.is_duplicate) {
      await logSecurityEvent(req, {
        action: 'ranking_vote_duplicate',
        targetType: 'ranking',
        targetId: req.params.id,
        metadata: { vote_type: voteType },
      });
      return res.status(409).json({
        ...err(new Error('你已经投过票了')),
        data: { myVote },
      });
    }

    let attachedCommentId: string | null = null;
    let attachedCommentError = '';
    if (attachedComment) {
      const { data: comment, error: commentErr } = await supabase.from('lc_comments').insert({
        ranking_id: req.params.id,
        content: attachedComment,
        author_id: profile.id,
        author_name: profile.display_name,
        is_realname: !!profile.is_realname,
        real_name: null,
      }).select('id').single();
      if (commentErr) attachedCommentError = getErrorText(commentErr);
      else attachedCommentId = comment?.id || null;
    }

    await logSecurityEvent(req, {
      action: 'ranking_vote_applied',
      targetType: 'ranking',
      targetId: req.params.id,
      metadata: { vote_type: voteType, balance_delta: row.balance_delta || 0, attached_comment_id: attachedCommentId, attached_comment_error: attachedCommentError || null },
    });
    res.json(ok({
      likes: row.likes,
      dislikes: row.dislikes,
      joys: row.joys,
      boost_amount: row.boost_amount,
      negative_boost_amount: row.negative_boost_amount,
      agree_count: row.agree_count,
      oppose_count: row.oppose_count,
      myVote,
      balance: row.balance,
      balanceDelta: row.balance_delta || 0,
      comment: attachedCommentId ? { id: attachedCommentId, status: 'pending' } : null,
      commentError: attachedCommentError || null,
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

    await logSecurityEvent(req, {
      action: 'ranking_vote_cancelled',
      targetType: 'ranking',
      targetId: req.params.id,
      metadata: { refunded: row.refunded || 0 },
    });
    res.json(ok({
      likes: row.likes,
      dislikes: row.dislikes,
      joys: row.joys,
      boost_amount: row.boost_amount,
      negative_boost_amount: row.negative_boost_amount,
      agree_count: row.agree_count,
      oppose_count: row.oppose_count,
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
      .eq('source', 'free_vote')
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
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'ranking_comment_submit',
      targetType: 'comment',
      texts: { content },
      allowContact: false,
    });

    const { data, error: insErr } = await supabase.from('lc_comments').insert({
      ranking_id: req.params.id, content, author_id: profile.id, author_name: profile.display_name,
      is_realname: !!profile.is_realname, real_name: null,
      moderation_precheck: moderationPrecheck,
    }).select().single();
    if (insErr) throw insErr;
    await logSecurityEvent(req, {
      action: 'ranking_comment_submitted',
      targetType: 'comment',
      targetId: data?.id,
      metadata: { ranking_id: req.params.id, moderation: moderationPrecheck },
    });
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/comments/:cid/related-certify', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const relatedNote = typeof req.body?.relatedNote === 'string' ? req.body.relatedNote.trim().slice(0, 1000) : '';
    const relatedFiles = sanitizeRelatedFiles(req.body?.relatedFiles);
    if (!relatedNote && relatedFiles.length === 0) {
      return res.status(400).json(err(new Error('请提交能证明你是相关方的说明或图片材料')));
    }
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'related_party_certification',
      targetType: 'comment',
      texts: { relatedNote },
      files: relatedFiles,
      allowContact: true,
    });

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
        moderation_precheck: moderationPrecheck,
      })
      .eq('id', req.params.cid);
    if (updErr && isRelatedProofSchemaMiss(updErr)) {
      const { error: fallbackErr } = await supabase.from('lc_comments')
        .update({
          status: 'pending',
          is_pinned: true,
          pin_label: '相关方回应',
          payment_proof: encodeRelatedProofFallback(relatedNote, relatedFiles),
          moderation_precheck: moderationPrecheck,
        })
        .eq('id', req.params.cid);
      if (fallbackErr) throw fallbackErr;
      await logSecurityEvent(req, {
        action: 'related_party_certification_submitted',
        targetType: 'comment',
        targetId: req.params.cid,
        metadata: { ranking_id: req.params.id, storage: 'fallback', file_count: relatedFiles.length, moderation: moderationPrecheck },
      });
      return res.json(ok({ id: req.params.cid, storage: 'fallback' }));
    }
    if (updErr) throw updErr;
    await logSecurityEvent(req, {
      action: 'related_party_certification_submitted',
      targetType: 'comment',
      targetId: req.params.cid,
      metadata: { ranking_id: req.params.id, storage: 'columns', file_count: relatedFiles.length, moderation: moderationPrecheck },
    });
    res.json(ok({ id: req.params.cid }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/comments/:cid/like', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const { data: c } = await supabase.from('lc_comments').select('likes').eq('id', req.params.cid).eq('ranking_id', req.params.id).single();
    if (!c) return res.status(404).json(err(new Error('评论不存在')));
    const { error: voteErr } = await supabase.from('lc_comment_votes').insert({ comment_id: req.params.cid, voter_id: profile.id });
    if (voteErr) {
      if (voteErr.code === '23505') return res.status(409).json(err(new Error('你已经赞过这条评论了')));
      throw voteErr;
    }
    const newLikes = (c.likes || 0) + 1;
    await supabase.from('lc_comments').update({ likes: newLikes }).eq('id', req.params.cid);
    await logSecurityEvent(req, {
      action: 'ranking_comment_liked',
      targetType: 'comment',
      targetId: req.params.cid,
      metadata: { ranking_id: req.params.id },
    });
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

    const nextStatus = 'deleted_by_author';

    const { data: deleted, error: updErr } = await supabase.from('lc_comments')
      .update({ status: nextStatus, is_pinned: false })
      .eq('id', req.params.cid)
      .eq('author_id', profile.id)
      .select('*')
      .single();
    if (updErr) throw updErr;

    const audit = await appendAuditEntry({
      targetType: 'comment',
      targetId: req.params.cid,
      eventType: 'comment_deleted_by_author',
      payload: auditPayload('comment', deleted),
      actorId: profile.id,
      actorRole: 'creator',
      metadata: { refund_amount: 0, reason: 'comments_are_free' },
    });
    await logSecurityEvent(req, {
      action: 'ranking_comment_deleted_by_author',
      targetType: 'comment',
      targetId: req.params.cid,
      metadata: { ranking_id: req.params.id, refunded: 0, reason: 'comments_are_free' },
    });
    res.json(ok({ id: req.params.cid, refunded: false, audit }));
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
    await logSecurityEvent(req, {
      action: 'legacy_related_claim_submitted',
      targetType: 'ranking',
      targetId: req.params.id,
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ── 管理 ──

app.put('/api/lc/admin/rankings/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const targetType = ['red', 'black', 'white'].includes(req.body?.targetType) ? req.body.targetType : null;
    const { data: r } = await supabase.from('lc_rankings').select('type, initial_amount, subject_type, subject_dossier_id, dm_employment_status_suggestion, dm_employer_store_id_suggestion').eq('id', req.params.id).single();
    if (!r) return res.status(404).json(err(new Error('帖子不存在')));
    if (['dm', 'store'].includes(String(r.subject_type || '')) && r.subject_dossier_id) {
      await findRankingDossier(r.subject_dossier_id, r.subject_type as 'dm' | 'store');
    }
    if (r.subject_type === 'dm' && r.subject_dossier_id && r.dm_employment_status_suggestion) {
      if (r.dm_employment_status_suggestion === 'freelance') {
        const result = await supabase.from('lc_dm_dossiers').update({
          employment_status: 'freelance',
          employer_store_id: null,
          workplace: null,
          updated_at: new Date().toISOString(),
        }).eq('id', r.subject_dossier_id);
        if (result.error) throw result.error;
      } else {
        const store = await findRankingDossier(r.dm_employer_store_id_suggestion, 'store');
        const result = await supabase.from('lc_dm_dossiers').update({
          employment_status: 'store_affiliated',
          employer_store_id: store?.id || null,
          workplace: store?.dm_name || null,
          updated_at: new Date().toISOString(),
        }).eq('id', r.subject_dossier_id);
        if (result.error) throw result.error;
      }
    }
    const nextType = targetType || r.type;
    const patch: Record<string, unknown> = {
      status: 'approved',
      type: nextType,
      reject_reason: null,
      evidence_required: false,
      revision_kind: null,
      revision_requested_at: null,
      dm_employment_status_suggestion: null,
      dm_employer_store_id_suggestion: null,
      boost_amount: nextType === 'red' ? r.initial_amount : 0,
      negative_boost_amount: 0,
      agree_count: 0,
      oppose_count: 0,
      likes: nextType === 'red' ? r.initial_amount : 0,
      dislikes: 0,
      joys: 0,
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
    await runReferralSideEffect('stage2-after-ranking-approved', () => maybeAwardReferralStage2(approved?.poster_id, 'ranking_approved'));
    await logSecurityEvent(req, {
      action: 'admin_ranking_approved',
      targetType: 'ranking',
      targetId: req.params.id,
      metadata: { original_type: r.type, approved_type: nextType, audit_entry_hash: audit?.entry_hash || null },
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
    if ('subject_dossier_id' in body) {
      const dossierId = cleanText(body.subject_dossier_id, 80);
      const dossierType = cleanText(patch.subject_type || before.subject_type, 40);
      if (dossierId) {
        if (dossierType !== 'dm' && dossierType !== 'store') return res.status(400).json(err(new Error('只有DM或店家帖子可以绑定档案')));
        const dossier = await findRankingDossier(dossierId, dossierType);
        patch.subject_dossier_id = dossier.id;
        patch.subject_name = dossier.dm_name;
        patch.subject_city = dossier.city || before.subject_city || null;
      } else {
        patch.subject_dossier_id = null;
      }
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
    await logSecurityEvent(req, {
      action: 'admin_ranking_edited',
      targetType: 'ranking',
      targetId: req.params.id,
      metadata: { changed_fields: changedFields, audit_entry_hash: audit?.entry_hash || null },
    });
    res.json(ok({ item: updated, changes, audit }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/rankings/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = cleanText(req.body?.rejectReason, 300);
    const revisionKind = normalizeRankingRevisionKind(req.body?.revisionKind ?? req.body?.revision_kind);
    const { data: current, error: findErr } = await supabase.from('lc_rankings')
      .select('revision_count')
      .eq('id', req.params.id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!current) return res.status(404).json(err(new Error('帖子不存在')));
    const { error: updateErr } = await supabase.from('lc_rankings').update({
      status: 'rejected',
      reject_reason: rejectReason || (revisionKind === 'evidence' ? '请补充能够支撑这条记录的证据图片并重新提交' : '请按审核要求修改后重新提交'),
      evidence_required: revisionKind === 'evidence',
      revision_kind: revisionKind,
      revision_requested_at: new Date().toISOString(),
      revision_count: Math.max(0, Number(current.revision_count || 0)) + 1,
    }).eq('id', req.params.id);
    if (updateErr) throw updateErr;
    await logSecurityEvent(req, {
      action: 'admin_ranking_rejected',
      targetType: 'ranking',
      targetId: req.params.id,
      metadata: { reject_reason: rejectReason || null, revision_kind: revisionKind },
    });
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
    await runReferralSideEffect('stage2-after-comment-approved', () => maybeAwardReferralStage2(approved?.author_id, 'comment_approved'));
    await logSecurityEvent(req, {
      action: approved?.is_pinned ? 'admin_related_reply_approved' : 'admin_comment_approved',
      targetType: 'comment',
      targetId: req.params.id,
      metadata: { audit_entry_hash: audit?.entry_hash || null },
    });
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
    await logSecurityEvent(req, {
      action: comment?.is_pinned ? 'admin_related_reply_rejected' : 'admin_comment_rejected',
      targetType: 'comment',
      targetId: req.params.id,
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/claims/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_claims').update({ status: 'approved' }).eq('id', req.params.id);
    await logSecurityEvent(req, {
      action: 'admin_legacy_related_claim_approved',
      targetType: 'claim',
      targetId: req.params.id,
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/claims/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_claims').update({ status: 'rejected' }).eq('id', req.params.id);
    await logSecurityEvent(req, {
      action: 'admin_legacy_related_claim_rejected',
      targetType: 'claim',
      targetId: req.params.id,
    });
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
    await runReferralSideEffect('stage2-after-commission-approved', () => maybeAwardReferralStage2(approved?.poster_id, 'commission_approved'));
    await logSecurityEvent(req, {
      action: 'admin_commission_approved',
      targetType: 'commission',
      targetId: req.params.id,
      metadata: { audit_entry_hash: audit?.entry_hash || null },
    });
    res.json(ok({ audit }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/commissions/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = req.body?.rejectReason || null;
    await supabase.from('lc_commissions')
      .update({ status: 'rejected', reject_reason: rejectReason, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    await logSecurityEvent(req, {
      action: 'admin_commission_rejected',
      targetType: 'commission',
      targetId: req.params.id,
      metadata: { reject_reason: rejectReason || null },
    });
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
    await runReferralSideEffect('stage2-after-carpool-approved', () => maybeAwardReferralStage2(approved?.poster_id, 'carpool_approved'));
    await logSecurityEvent(req, {
      action: 'admin_carpool_approved',
      targetType: 'carpool',
      targetId: req.params.id,
      metadata: { sync: syncResult, audit_entry_hash: audit?.entry_hash || null },
    });
    res.json(ok({ sync: syncResult, audit }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/carpools/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = req.body?.rejectReason || null;
    await supabase.from('lc_carpools')
      .update({ status: 'rejected', reject_reason: rejectReason, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    await logSecurityEvent(req, {
      action: 'admin_carpool_rejected',
      targetType: 'carpool',
      targetId: req.params.id,
      metadata: { reject_reason: rejectReason || null },
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/reports/:id/resolve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const action = req.body?.action === 'dismissed' ? 'dismissed' : 'resolved';
    const handlerNote = cleanText(req.body?.handlerNote, 500);
    const hideTarget = !!req.body?.hideTarget;
    const restoreTarget = !!req.body?.restoreTarget;
    const rejectReason = cleanText(req.body?.rejectReason, 300) || '举报处理后下架';
    const { data: report, error: rErr } = await supabase.from('lc_reports')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (rErr) throw rErr;
    if (!report) return res.status(404).json(err(new Error('举报不存在')));

    let statusChange: { before: string | null; after: string | null } = { before: null, after: null };
    if (restoreTarget) {
      statusChange = await restoreTargetAfterReport(report.target_type, report.target_id);
    } else if (hideTarget) {
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
      statusChange = {
        before: report.target_status_before || null,
        after: await currentTargetStatus(report.target_type, report.target_id),
      };
    }

    await supabase.from('lc_reports')
      .update({
        status: action,
        handler_id: getReq(req, 'creatorId'),
        handler_note: handlerNote || (restoreTarget ? '复核后恢复展示' : hideTarget ? rejectReason : null),
        target_status_after: statusChange.after || report.target_status_after || null,
        updated_at: new Date().toISOString(),
      })
      .eq('target_type', report.target_type)
      .eq('target_id', report.target_id)
      .eq('status', 'pending');
    await logSecurityEvent(req, {
      action: restoreTarget ? 'admin_report_resolved_and_target_restored' : hideTarget ? 'admin_report_resolved_and_target_hidden' : `admin_report_${action}`,
      targetType: report.target_type,
      targetId: report.target_id,
      metadata: {
        report_id: req.params.id,
        hide_target: hideTarget,
        restore_target: restoreTarget,
        handler_note: handlerNote || null,
        before: statusChange.before,
        after: statusChange.after,
      },
    });
    res.json(ok({ status: action, hidden: hideTarget, restored: restoreTarget, statusChange }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/transactions/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data: tx, error: txErr } = await supabase.from('lc_transactions')
      .select('gateway')
      .eq('id', req.params.id)
      .maybeSingle();
    if (txErr) throw txErr;
    if (tx?.gateway) {
      return res.status(400).json(err(new Error('自动支付流水不能人工到账，请等待支付平台异步通知')));
    }
    const { data, error } = await supabase.rpc('approve_lc_recharge', { p_transaction_id: req.params.id });
    if (error) throw error;
    const result = firstRpcRow(data as { profile_id?: string } | { profile_id?: string }[] | null);
    await runReferralSideEffect('stage2-after-manual-recharge', () => maybeAwardReferralStage2(result?.profile_id, 'wallet_recharge_approved'));
    await logSecurityEvent(req, {
      action: 'admin_wallet_recharge_approved',
      targetType: 'transaction',
      targetId: req.params.id,
    });
    res.json(ok(data?.[0] || null));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/transactions/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data: tx, error: txErr } = await supabase.from('lc_transactions')
      .select('gateway')
      .eq('id', req.params.id)
      .maybeSingle();
    if (txErr) throw txErr;
    if (tx?.gateway) {
      return res.status(400).json(err(new Error('自动支付流水不能人工拒绝，请按支付平台订单状态处理')));
    }
    const rejectReason = req.body?.rejectReason || null;
    await supabase.from('lc_transactions')
      .update({ status: 'rejected', reject_reason: rejectReason, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('type', 'recharge')
      .eq('status', 'pending');
    await logSecurityEvent(req, {
      action: 'admin_wallet_recharge_rejected',
      targetType: 'transaction',
      targetId: req.params.id,
      metadata: { reject_reason: rejectReason || null },
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ── 钱包 ──

app.get('/api/lc/wallet', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    await expireStalePaymentRecharges(profile.id);
    const { data: walletProfile } = await supabase.from('lc_profiles')
      .select('balance, paid_balance, bonus_balance')
      .eq('id', profile.id)
      .single();
    const { data: txs } = await supabase.from('lc_transactions')
      .select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(100);
    res.json(ok({
      balance: walletProfile?.balance || 0,
      paid_balance: walletProfile?.paid_balance || 0,
      bonus_balance: walletProfile?.bonus_balance || 0,
      transactions: txs || [],
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/wallet/recharge', authMiddleware, async (req, res) => {
  try {
    const { amount, paymentProof } = req.body;
    if (!amount || amount < 10) return res.status(400).json(err(new Error('充值金额最低 10 契约币')));
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: tx, error: txErr } = await supabase.from('lc_transactions').insert({
      profile_id: profile.id, type: 'recharge', amount: parseInt(amount),
      description: '契约币充值', payment_proof: paymentProof || null,
      status: 'pending',
    }).select('id, amount').single();
    if (txErr) throw txErr;
    await logSecurityEvent(req, {
      action: 'wallet_recharge_submitted',
      targetType: 'transaction',
      targetId: tx?.id,
      metadata: { amount: tx?.amount || parseInt(amount) },
    });
    res.json(ok({ message: '充值申请已提交，管理员审核后到账' }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/wallet/alipay/create', authMiddleware, async (req, res) => {
  try {
    if (!isAlipayConfigured()) return res.status(503).json(err(new Error('支付宝支付尚未配置')));
    const amount = parseRechargeAmount(req.body?.amount);
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));

    const outTradeNo = makeAlipayOrderNo();
    const expiresAt = makePaymentExpiresAt();
    const { payUrl, subject, totalAmount } = makeAlipayPayUrl(outTradeNo, amount);
    const { data: tx, error: txErr } = await supabase.from('lc_transactions').insert({
      profile_id: profile.id,
      type: 'recharge',
      amount,
      description: `支付宝充值 · ${amount} 契约币`,
      payment_proof: null,
      status: 'pending',
      gateway: 'alipay',
      external_order_no: outTradeNo,
      ref_type: 'alipay_order',
      idempotency_key: `alipay:${outTradeNo}`,
      metadata: {
        provider: 'alipay_pc',
        notify_url: ALIPAY_NOTIFY_URL,
        return_url: ALIPAY_RETURN_URL,
        expires_at: expiresAt.toISOString(),
      },
    }).select('id').single();
    if (txErr) throw txErr;

    const { data: order, error: orderErr } = await supabase.from('lc_alipay_orders').insert({
      profile_id: profile.id,
      transaction_id: tx.id,
      out_trade_no: outTradeNo,
      amount,
      total_amount: totalAmount,
      subject,
      status: 'created',
      expires_at: expiresAt.toISOString(),
    }).select('id, out_trade_no').single();
    if (orderErr) throw orderErr;

    await supabase.from('lc_transactions')
      .update({ ref_id: order.id })
      .eq('id', tx.id);

    await logSecurityEvent(req, {
      action: 'wallet_alipay_order_created',
      targetType: 'transaction',
      targetId: tx.id,
      metadata: { amount, out_trade_no: outTradeNo, order_id: order.id },
    });

    res.json(ok({ pay_url: payUrl, out_trade_no: outTradeNo, transaction_id: tx.id }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/wallet/wechat/create', authMiddleware, async (req, res) => {
  let txId = '';
  let orderId = '';
  try {
    if (!isWechatPayConfigured()) return res.status(503).json(err(new Error('微信支付尚未配置')));
    assertWechatPayConfigured();
    const amount = parseRechargeAmount(req.body?.amount);
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));

    const outTradeNo = makeWechatPayOrderNo();
    const description = makeWechatPayDescription(amount);
    const totalFee = amount * 100;
    const expiresAt = makePaymentExpiresAt();
    const { data: tx, error: txErr } = await supabase.from('lc_transactions').insert({
      profile_id: profile.id,
      type: 'recharge',
      amount,
      description: `微信支付充值 · ${amount} 契约币`,
      payment_proof: null,
      status: 'pending',
      gateway: 'wechat_pay',
      external_order_no: outTradeNo,
      ref_type: 'wechat_pay_order',
      idempotency_key: `wechat_pay:${outTradeNo}`,
      metadata: {
        provider: 'wechat_pay_native',
        notify_url: WECHAT_PAY_NOTIFY_URL,
        expires_at: expiresAt.toISOString(),
      },
    }).select('id').single();
    if (txErr) throw txErr;
    txId = tx.id;

    const { data: order, error: orderErr } = await supabase.from('lc_wechat_pay_orders').insert({
      profile_id: profile.id,
      transaction_id: tx.id,
      out_trade_no: outTradeNo,
      amount,
      total_fee: totalFee,
      description,
      status: 'created',
      expires_at: expiresAt.toISOString(),
    }).select('id, out_trade_no').single();
    if (orderErr) throw orderErr;
    orderId = order.id;

    await supabase.from('lc_transactions')
      .update({ ref_id: order.id })
      .eq('id', tx.id);

    let codeUrl = '';
    try {
      const created = await createWechatPayNativeOrder(outTradeNo, amount, expiresAt);
      codeUrl = created.codeUrl;
    } catch (payErr) {
      await supabase.from('lc_wechat_pay_orders')
        .update({
          status: 'failed',
          notify_payload: { create_error: getErrorText(payErr) },
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
      await supabase.from('lc_transactions')
        .update({
          status: 'rejected',
          reject_reason: getErrorText(payErr),
          metadata: { provider: 'wechat_pay_native', create_error: getErrorText(payErr) },
          updated_at: new Date().toISOString(),
        })
        .eq('id', tx.id);
      throw payErr;
    }

    await supabase.from('lc_wechat_pay_orders')
      .update({ code_url: codeUrl, updated_at: new Date().toISOString() })
      .eq('id', order.id);

    await logSecurityEvent(req, {
      action: 'wallet_wechat_pay_order_created',
      targetType: 'transaction',
      targetId: tx.id,
      metadata: { amount, out_trade_no: outTradeNo, order_id: order.id },
    });

    res.json(ok({ code_url: codeUrl, out_trade_no: outTradeNo, transaction_id: tx.id }));
  } catch (e) {
    await logSecurityEvent(req, {
      action: 'wallet_wechat_pay_order_create_failed',
      targetType: 'transaction',
      targetId: txId || null,
      metadata: { order_id: orderId || null, error: getErrorText(e) },
    });
    res.status(500).json(err(e));
  }
});

app.post('/api/lc/wallet/alipay/notify', async (req, res) => {
  const reply = (text: 'success' | 'failure') => res.status(200).type('text/plain').send(text);
  try {
    const params = normalizeAlipayParams(req.body);
    if (!verifyAlipayParams(params)) {
      console.error('[alipay] notify signature invalid', { out_trade_no: params.out_trade_no || null });
      return reply('failure');
    }
    if (params.app_id !== ALIPAY_APP_ID) {
      console.error('[alipay] notify app_id mismatch', { app_id: params.app_id || null });
      return reply('failure');
    }
    if (ALIPAY_SELLER_ID && params.seller_id !== ALIPAY_SELLER_ID) {
      console.error('[alipay] notify seller_id mismatch', { seller_id: params.seller_id || null });
      return reply('failure');
    }
    if (!params.out_trade_no || !params.trade_no || !params.total_amount) {
      console.error('[alipay] notify missing fields', { out_trade_no: params.out_trade_no || null });
      return reply('failure');
    }

    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(params.trade_status)) {
      return reply('success');
    }

    const payload = makeSafeAlipayPayload(params);
    const { data, error: rpcErr } = await supabase.rpc('lc_confirm_alipay_recharge', {
      p_out_trade_no: params.out_trade_no,
      p_trade_no: params.trade_no,
      p_total_amount: Number(params.total_amount),
      p_payload: payload,
    });
    if (rpcErr) throw rpcErr;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.already_processed) {
      await runReferralSideEffect('stage2-after-alipay-recharge', () => maybeAwardReferralStage2(result?.profile_id, 'wallet_alipay_paid'));
    }
    await logSecurityEvent(req, {
      action: 'wallet_alipay_notify_paid',
      targetType: 'transaction',
      targetId: result?.transaction_id || null,
      actorRole: 'alipay',
      metadata: {
        out_trade_no: params.out_trade_no,
        trade_no: params.trade_no,
        trade_status: params.trade_status,
        already_processed: Boolean(result?.already_processed),
      },
    });
    return reply('success');
  } catch (e) {
    console.error('[alipay] notify failed', getErrorText(e));
    return reply('failure');
  }
});

app.post('/api/lc/wallet/wechat/notify', async (req, res) => {
  const fail = (status: number, message: string) => res.status(status).json({ code: 'FAIL', message });
  try {
    if (!isWechatPayConfigured()) return fail(500, '微信支付未配置');
    assertWechatPayConfigured();
    const rawBody = String((req as Record<string, unknown>).rawBody || JSON.stringify(req.body || {}));
    const serial = req.get('Wechatpay-Serial') || '';
    const signature = req.get('Wechatpay-Signature') || '';
    const timestamp = req.get('Wechatpay-Timestamp') || '';
    const nonce = req.get('Wechatpay-Nonce') || '';
    if (!verifyWechatPaySignature(serial, signature, timestamp, nonce, rawBody)) {
      console.error('[wechat-pay] notify signature invalid', { serial, sign_test: signature.startsWith('WECHATPAY/SIGNTEST/') });
      return fail(401, '签名错误');
    }

    const notification = req.body && typeof req.body === 'object'
      ? req.body as Record<string, unknown>
      : JSON.parse(rawBody) as Record<string, unknown>;
    if (notification.event_type !== 'TRANSACTION.SUCCESS') return res.status(204).send();
    const resource = notification.resource && typeof notification.resource === 'object'
      ? notification.resource as Record<string, unknown>
      : null;
    if (!resource) return fail(400, '通知资源缺失');
    const transaction = decryptWechatPayResource(resource);
    if (transaction.appid !== WECHAT_PAY_APP_ID || transaction.mchid !== WECHAT_PAY_MCH_ID) {
      console.error('[wechat-pay] notify merchant mismatch', { appid: transaction.appid || null, mchid: transaction.mchid || null });
      return fail(400, '商户信息不匹配');
    }
    if (transaction.trade_state !== 'SUCCESS') return res.status(204).send();

    const amount = transaction.amount && typeof transaction.amount === 'object'
      ? transaction.amount as Record<string, unknown>
      : {};
    const totalFee = Number(amount.total);
    const outTradeNo = String(transaction.out_trade_no || '');
    const transactionId = String(transaction.transaction_id || '');
    if (!outTradeNo || !transactionId || !Number.isInteger(totalFee)) {
      console.error('[wechat-pay] notify missing fields', { outTradeNo, transactionId, totalFee });
      return fail(400, '通知字段缺失');
    }

    const payload = makeSafeWechatPayPayload(transaction, notification);
    const { data, error: rpcErr } = await supabase.rpc('lc_confirm_wechat_pay_recharge', {
      p_out_trade_no: outTradeNo,
      p_transaction_id_wechat: transactionId,
      p_total_fee: totalFee,
      p_payload: payload,
    });
    if (rpcErr) throw rpcErr;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.already_processed) {
      await runReferralSideEffect('stage2-after-wechat-pay-recharge', () => maybeAwardReferralStage2(result?.profile_id, 'wallet_wechat_pay_paid'));
    }
    await logSecurityEvent(req, {
      action: 'wallet_wechat_pay_notify_paid',
      targetType: 'transaction',
      targetId: result?.transaction_id || null,
      actorRole: 'wechat_pay',
      metadata: {
        out_trade_no: outTradeNo,
        transaction_id: transactionId,
        trade_state: transaction.trade_state,
        already_processed: Boolean(result?.already_processed),
      },
    });
    return res.status(204).send();
  } catch (e) {
    console.error('[wechat-pay] notify failed', getErrorText(e));
    return fail(500, '处理失败');
  }
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
    if (!profile?.verified_shop) return res.status(403).json(err(new Error('非认证店家账号')));
    const shopName = profile.shop_name || profile.display_name;
    const storeDossiers = await findClaimedStoreDossiers(String(creatorId));
    const storeIds = storeDossiers.map(row => String(row.id || '')).filter(Boolean);
    const [dossierReviewResult, nameReviewResult] = await Promise.all([
      storeIds.length > 0
        ? supabase.from('lc_rankings').select('*').eq('subject_type', 'store').in('subject_dossier_id', storeIds).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.from('lc_rankings').select('*').eq('subject_type', 'store').eq('subject_name', shopName).order('created_at', { ascending: false }),
    ]);
    if (dossierReviewResult.error) throw dossierReviewResult.error;
    if (nameReviewResult.error) throw nameReviewResult.error;
    const reviewById = new Map<string, Record<string, unknown>>();
    [...(dossierReviewResult.data || []), ...(nameReviewResult.data || [])].forEach(review => reviewById.set(String(review.id), review as Record<string, unknown>));
    const reviews = Array.from(reviewById.values()).sort((left, right) => new Date(String(right.created_at)).getTime() - new Date(String(left.created_at)).getTime());
    const reviewIds = (reviews || []).map((r: { id: string }) => r.id);
    let comments: Record<string, unknown>[] = [];
    if (reviewIds.length > 0) {
      const { data: cmts } = await supabase.from('lc_comments')
        .select('*')
        .in('ranking_id', reviewIds)
        .order('created_at', { ascending: true });
      comments = cmts || [];
    }
    let dmAffiliations: Record<string, unknown>[] = [];
    if (storeIds.length > 0) {
      const affiliationResult = await supabase.from('lc_dm_store_affiliations')
        .select('*')
        .in('store_dossier_id', storeIds)
        .in('status', ['pending', 'approved', 'ended', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(500);
      if (affiliationResult.error && !isMissingRelation(affiliationResult.error, 'lc_dm_store_affiliations')) throw affiliationResult.error;
      const affiliationRows = affiliationResult.error ? [] : (affiliationResult.data || []) as Record<string, unknown>[];
      const dmIds = Array.from(new Set(affiliationRows.map(row => String(row.dm_dossier_id || '')).filter(Boolean)));
      let dmDossiers: Record<string, unknown>[] = [];
      if (dmIds.length > 0) {
        const dmResult = await supabase.from('lc_dm_dossiers')
          .select('id, dm_name, city, photo_url, claimed_by, claim_status, status')
          .in('id', dmIds)
          .eq('entity_type', 'dm');
        if (dmResult.error) throw dmResult.error;
        dmDossiers = (dmResult.data || []) as Record<string, unknown>[];
      }
      dmAffiliations = enrichAffiliations(affiliationRows, dmDossiers, storeDossiers);
    }
    res.json(ok({ profile, reviews: reviews || [], comments, store_dossiers: storeDossiers, dm_affiliations: dmAffiliations }));
  } catch (e) { res.status(500).json(err(e)); }
});

async function ensureShopOwnsAffiliation(profileId: string, affiliationId: string, requiredStatus: string) {
  const stores = await findClaimedStoreDossiers(profileId);
  const storeIds = new Set(stores.map(row => String(row.id || '')));
  const affiliationResult = await supabase.from('lc_dm_store_affiliations')
    .select('*')
    .eq('id', affiliationId)
    .eq('status', requiredStatus)
    .maybeSingle();
  if (affiliationResult.error) throw affiliationResult.error;
  if (!affiliationResult.data || !storeIds.has(String(affiliationResult.data.store_dossier_id || ''))) {
    throw new Error('你没有处理这条任职关系的权限');
  }
  const store = stores.find(row => String(row.id || '') === String(affiliationResult.data.store_dossier_id || '')) || null;
  return { affiliation: affiliationResult.data as Record<string, unknown>, store };
}

app.put('/api/lc/shop/dm-affiliations/:id/approve', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile?.verified_shop) return res.status(403).json(err(new Error('非认证店家账号')));
    const { affiliation, store } = await ensureShopOwnsAffiliation(profile.id, req.params.id, 'pending');
    const now = new Date().toISOString();
    if (useTencentPg) {
      const client = await tencentPgPool.connect();
      try {
        await client.query('BEGIN');
        const locked = await client.query(
          `select * from lc_dm_store_affiliations where id = $1 and status = 'pending' for update`,
          [req.params.id],
        );
        if (!locked.rows[0]) throw new Error('这条任职申请已经处理过了');
        await client.query(
          `update lc_dm_store_affiliations
              set status = 'ended', ended_at = $2, ended_by_profile_id = $3,
                  end_reason = $4, updated_at = $2
            where dm_dossier_id = $1 and status = 'approved'`,
          [affiliation.dm_dossier_id, now, profile.id, `已切换至${store?.dm_name || '新店家'}`],
        );
        await client.query(
          `update lc_dm_store_affiliations
              set status = 'approved', reviewed_by_profile_id = $2, reviewed_at = $3,
                  started_at = $3, reject_reason = null, updated_at = $3
            where id = $1 and status = 'pending'`,
          [req.params.id, profile.id, now],
        );
        await client.query(
          `update lc_dm_dossiers
              set employment_status = 'store_affiliated', employer_store_id = $2,
                  workplace = $3, updated_at = $4
            where id = $1 and entity_type = 'dm'`,
          [affiliation.dm_dossier_id, affiliation.store_dossier_id, store?.dm_name || null, now],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      const activeResult = await supabase.from('lc_dm_store_affiliations').update({
        status: 'ended', ended_at: now, ended_by_profile_id: profile.id,
        end_reason: `已切换至${store?.dm_name || '新店家'}`, updated_at: now,
      }).eq('dm_dossier_id', affiliation.dm_dossier_id).eq('status', 'approved');
      if (activeResult.error) throw activeResult.error;
      const approveResult = await supabase.from('lc_dm_store_affiliations').update({
        status: 'approved', reviewed_by_profile_id: profile.id, reviewed_at: now,
        started_at: now, reject_reason: null, updated_at: now,
      }).eq('id', req.params.id).eq('status', 'pending').select('*').single();
      if (approveResult.error) throw approveResult.error;
      const dossierResult = await supabase.from('lc_dm_dossiers').update({
        employment_status: 'store_affiliated', employer_store_id: affiliation.store_dossier_id,
        workplace: store?.dm_name || null, updated_at: now,
      }).eq('id', affiliation.dm_dossier_id).eq('entity_type', 'dm');
      if (dossierResult.error) throw dossierResult.error;
    }
    await logSecurityEvent(req, {
      action: 'dm_store_affiliation_approved_by_store',
      targetType: 'dm_store_affiliation',
      targetId: req.params.id,
      actorId: profile.id,
      actorRole: profile.role || 'shop',
      metadata: { dm_dossier_id: affiliation.dm_dossier_id, store_dossier_id: affiliation.store_dossier_id },
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/shop/dm-affiliations/:id/reject', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile?.verified_shop) return res.status(403).json(err(new Error('非认证店家账号')));
    const { affiliation } = await ensureShopOwnsAffiliation(profile.id, req.params.id, 'pending');
    const rejectReason = cleanText(req.body?.reason, 500) || '店家未确认这段任职关系';
    const now = new Date().toISOString();
    const result = await supabase.from('lc_dm_store_affiliations').update({
      status: 'rejected', reviewed_by_profile_id: profile.id, reviewed_at: now,
      reject_reason: rejectReason, updated_at: now,
    }).eq('id', req.params.id).eq('status', 'pending').select('id').single();
    if (result.error) throw result.error;
    await logSecurityEvent(req, {
      action: 'dm_store_affiliation_rejected_by_store', targetType: 'dm_store_affiliation', targetId: req.params.id,
      actorId: profile.id, actorRole: profile.role || 'shop',
      metadata: { dm_dossier_id: affiliation.dm_dossier_id, store_dossier_id: affiliation.store_dossier_id, reason: rejectReason },
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/shop/dm-affiliations/:id/end', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile?.verified_shop) return res.status(403).json(err(new Error('非认证店家账号')));
    const { affiliation } = await ensureShopOwnsAffiliation(profile.id, req.params.id, 'approved');
    const reason = cleanText(req.body?.reason, 500) || '店家解除任职关系';
    const now = new Date().toISOString();
    if (useTencentPg) {
      const client = await tencentPgPool.connect();
      try {
        await client.query('BEGIN');
        const ended = await client.query(
          `update lc_dm_store_affiliations
              set status = 'ended', ended_at = $2, ended_by_profile_id = $3,
                  end_reason = $4, updated_at = $2
            where id = $1 and status = 'approved'
            returning id`,
          [req.params.id, now, profile.id, reason],
        );
        if (!ended.rows[0]) throw new Error('这段任职关系已经结束');
        await client.query(
          `update lc_dm_dossiers
              set employment_status = 'unknown', employer_store_id = null,
                  workplace = null, updated_at = $3
            where id = $1 and employer_store_id = $2`,
          [affiliation.dm_dossier_id, affiliation.store_dossier_id, now],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      const endResult = await supabase.from('lc_dm_store_affiliations').update({
        status: 'ended', ended_at: now, ended_by_profile_id: profile.id, end_reason: reason, updated_at: now,
      }).eq('id', req.params.id).eq('status', 'approved').select('id').single();
      if (endResult.error) throw endResult.error;
      const dossierResult = await supabase.from('lc_dm_dossiers').update({
        employment_status: 'unknown', employer_store_id: null, workplace: null, updated_at: now,
      }).eq('id', affiliation.dm_dossier_id).eq('employer_store_id', affiliation.store_dossier_id);
      if (dossierResult.error) throw dossierResult.error;
    }
    await logSecurityEvent(req, {
      action: 'dm_store_affiliation_ended_by_store', targetType: 'dm_store_affiliation', targetId: req.params.id,
      actorId: profile.id, actorRole: profile.role || 'shop',
      metadata: { dm_dossier_id: affiliation.dm_dossier_id, store_dossier_id: affiliation.store_dossier_id, reason },
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/shop/profile', authMiddleware, async (req, res) => {
  try {
    const creatorId = getReq(req, 'creatorId');
    const { data: profile } = await supabase.from('lc_profiles').select('role, verified_shop').eq('id', creatorId).single();
    if (!profile?.verified_shop) return res.status(403).json(err(new Error('非认证店家账号')));
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
    if (!profile?.verified_shop) return res.status(403).json(err(new Error('非认证店家账号')));
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
    if (!profile?.verified_shop) return res.status(403).json(err(new Error('非认证店家账号')));
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
    if (!type || !CERTIFICATION_TYPES.includes(type)) {
      return res.status(400).json(err(new Error('请选择认证类型')));
    }
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json(err(new Error('请上传认证材料')));
    }
    if (files.length > 6) return res.status(400).json(err(new Error('认证材料最多上传 6 张')));
    if (type === 'realname') {
      const hasWatermark = files.every((file: Record<string, unknown>) => file?.watermark === REALNAME_WATERMARK_TEXT);
      if (!hasWatermark) return res.status(400).json(err(new Error('实名认证材料必须先加“仅用于剧幕录实名认证”水印')));
    }
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
    await logSecurityEvent(req, {
      action: 'certification_submitted',
      targetType: 'certification',
      targetId: data?.id,
      metadata: { certification_type: type, file_count: files.length },
    });
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

    if (cert.type === 'realname') {
      await supabase.from('lc_profiles')
        .update({ is_realname: true })
        .eq('id', cert.profile_id);
    } else if (cert.type === 'dm') {
      const { data: profile } = await supabase.from('lc_profiles')
        .select('role, role_type, identity_roles, verified_dm, verified_shop')
        .eq('id', cert.profile_id)
        .maybeSingle();
      await supabase.from('lc_profiles').update({
        verified_dm: true,
        ...profileIdentityPatch(profile || {}, ['dm']),
      }).eq('id', cert.profile_id);
    } else if (cert.type === 'shop') {
      const { data: profile } = await supabase.from('lc_profiles')
        .select('role, role_type, identity_roles, verified_dm, verified_shop')
        .eq('id', cert.profile_id)
        .maybeSingle();
      await supabase.from('lc_profiles').update({
        verified_shop: true,
        role: 'shop',
        ...profileIdentityPatch(profile || { role: 'shop' }, ['shop']),
      }).eq('id', cert.profile_id);
    }
    const referralReason = cert.type === 'realname' ? 'realname_approved' : `certification_${cert.type}_approved`;
    await runReferralSideEffect('stage2-after-certification-approved', () => maybeAwardReferralStage2(cert.profile_id, referralReason));

    await logSecurityEvent(req, {
      action: 'admin_certification_approved',
      targetType: 'certification',
      targetId: req.params.id,
      metadata: { certification_type: cert.type, profile_id: cert.profile_id },
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/certifications/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rejectReason } = req.body;
    await supabase.from('lc_certifications')
      .update({ status: 'rejected', reject_reason: rejectReason || null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    await logSecurityEvent(req, {
      action: 'admin_certification_rejected',
      targetType: 'certification',
      targetId: req.params.id,
      metadata: { reject_reason: rejectReason || null },
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

export default app;
