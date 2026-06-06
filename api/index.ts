/// <reference types="node" />
// 灵契 API — Vercel Serverless
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { createDecipheriv, createHash, createSign, createVerify, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';

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
const AUTH_CODE_PEPPER = process.env.AUTH_CODE_PEPPER || JWT_SECRET;
const SMS_CODE_TTL_MINUTES = Number(process.env.SMS_CODE_TTL_MINUTES || 5);
const SMS_CODE_COOLDOWN_SECONDS = Number(process.env.SMS_CODE_COOLDOWN_SECONDS || 60);
const TENCENT_SMS_REGION = process.env.TENCENT_SMS_REGION || 'ap-guangzhou';
const TENCENT_SMS_SDK_APP_ID = process.env.TENCENT_SMS_SDK_APP_ID || '';
const TENCENT_SMS_SIGN_NAME = process.env.TENCENT_SMS_SIGN_NAME || '';
const TENCENT_SMS_TEMPLATE_ID = process.env.TENCENT_SMS_TEMPLATE_ID || '';
const TENCENTCLOUD_SECRET_ID = process.env.TENCENTCLOUD_SECRET_ID || '';
const TENCENTCLOUD_SECRET_KEY = process.env.TENCENTCLOUD_SECRET_KEY || '';
const LINGQI_SITE_URL = (process.env.LINGQI_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://lingqi.jusichen.com').replace(/\/$/, '');
const WECHAT_OPEN_APP_ID = process.env.WECHAT_OPEN_APP_ID || '';
const WECHAT_OPEN_APP_SECRET = process.env.WECHAT_OPEN_APP_SECRET || '';
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
type TencentCloudSdk = {
  sms: {
    v20210111: {
      Client: new (config: Record<string, unknown>) => TencentSmsClient;
    };
  };
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const app = express();
app.use(cors());
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

function sanitizeProfile(profile: Record<string, unknown>, isOwner = false) {
  const safe = { ...profile };
  delete safe.password_hash;
  if (!isOwner) {
    delete safe.phone;
    delete safe.wechat;
    delete safe.balance;
    delete safe.contact_phone;
    delete safe.contact_wechat;
    delete safe.phone_verified_at;
    delete safe.auth_provider;
    delete safe.wechat_openid;
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
    .select('id, display_name, is_realname, balance, is_banned, ban_reason, avatar, phone, phone_verified_at, gender, role, role_type, identity_roles, referral_code, community_role, community_role_expires_at')
    .eq('id', creatorId)
    .single();
  return data;
}

function getSpeakBlockReason(profile: { avatar?: string | null; phone_verified_at?: string | null } | null) {
  if (!profile) return '用户不存在';
  if (!profile.phone_verified_at) return '发言前请先用手机号验证码完成认证';
  if (!profile.avatar) return '发言前请先到个人后台上传头像';
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
    .select('id, display_name, avatar, phone_verified_at')
    .eq('id', inviteeId)
    .maybeSingle();
  if (!invitee?.phone_verified_at || !invitee.avatar) return null;

  const credit = await applyWalletCredit({
    profileId: referral.referrer_id,
    amount: 10,
    description: '邀请好友完成手机号验证和头像奖励 10 契约币',
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

function makeAuthPhoneHash(phone: string) {
  return sha256(`auth-phone:${phone}`);
}

function makeAuthCodeHash(phone: string, code: string) {
  return sha256(`auth-code:${AUTH_CODE_PEPPER}:${phone}:${code}`);
}

function makeSmsCode() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

function isTencentSmsConfigured() {
  return Boolean(TENCENTCLOUD_SECRET_ID && TENCENTCLOUD_SECRET_KEY && TENCENT_SMS_SDK_APP_ID && TENCENT_SMS_SIGN_NAME && TENCENT_SMS_TEMPLATE_ID);
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
  const subject = `灵契契约币充值 ${amount}`;
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
      'User-Agent': 'LingQi/1.0',
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
  return `灵契契约币充值 ${amount}`;
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
const REALNAME_WATERMARK_TEXT = '仅用于灵契实名认证';

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

function hasScriptCredits(input: Record<string, string[]>) {
  return Object.values(input).some(value => Array.isArray(value) && value.length > 0);
}

function mergeScriptCredits(existing: unknown, patch: Record<string, string[]>) {
  const current = sanitizeScriptCredits(existing);
  for (const key of SCRIPT_CREDIT_FIELDS) {
    const values = patch[key];
    if (values?.length) current[key] = values;
  }
  return current;
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

function existingScriptRoles(script: Record<string, unknown> | null | undefined): CarpoolRoleDraft[] {
  const roleRows = Array.isArray(script?.script_player_roles) ? script.script_player_roles as Record<string, unknown>[] : [];
  return roleRows.map(role => ({
    role_name: cleanText(role.role_name, 80),
    gender: cleanText(role.gender, 20) || null,
    tags: cleanTextArray(role.tags),
    status: 'needed' as CarpoolRoleStatus,
    player_name: null,
    player_gender: null,
  })).filter(role => role.role_name);
}

async function sanitizeProfileRolePreferences(input: unknown): Promise<ProfileRolePreferenceDraft[]> {
  const source = Array.isArray(input) ? input : [];
  const scriptIds = Array.from(new Set(source
    .map(raw => uuidText((raw as Record<string, unknown>).script_id ?? (raw as Record<string, unknown>).scriptId))
    .filter(Boolean)));
  if (scriptIds.length === 0) return [];

  const { data: scripts, error: scriptsErr } = await supabase.from('scripts')
    .select('id, name, script_player_roles(role_name, gender, tags)')
    .eq('tenant_id', JUZHANGGUI_TENANT_ID)
    .in('id', scriptIds);
  if (scriptsErr && isMissingRelation(scriptsErr, 'scripts')) return [];
  if (scriptsErr) throw scriptsErr;

  const scriptMap = new Map((scripts || []).map(script => {
    const row = script as Record<string, unknown>;
    return [String(row.id), {
      id: String(row.id),
      name: cleanText(row.name, 120),
      roles: existingScriptRoles(row),
    }];
  }));
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
  let script: Record<string, unknown> | null = null;

  if (requestedScriptId) {
    const { data, error: byIdErr } = await supabase.from('scripts')
      .select('id, name, script_player_roles(role_name, gender, tags)')
      .eq('tenant_id', JUZHANGGUI_TENANT_ID)
      .eq('id', requestedScriptId)
      .maybeSingle();
    if (byIdErr) throw byIdErr;
    script = (data as Record<string, unknown> | null) || null;
  }

  if (!script && requestedScriptName) {
    const { data, error: byNameErr } = await supabase.from('scripts')
      .select('id, name, script_player_roles(role_name, gender, tags)')
      .eq('tenant_id', JUZHANGGUI_TENANT_ID)
      .eq('name', requestedScriptName)
      .maybeSingle();
    if (byNameErr) throw byNameErr;
    script = (data as Record<string, unknown> | null) || null;
  }

  if (!script) {
    if (!requestedScriptName) throw new Error('请填写本名');
    const { data: created, error: createErr } = await supabase.from('scripts').insert({
      name: requestedScriptName,
      duration_minutes: 240,
      min_duration_hours: 4,
      max_duration_hours: 4,
      tenant_id: JUZHANGGUI_TENANT_ID,
    }).select('id, name').single();
    if (createErr) throw createErr;
    script = (created as Record<string, unknown>) || null;
  }

  const existingRoles = existingScriptRoles(script);
  const roles = rolesInput.length > 0 ? rolesInput : existingRoles;
  const known = new Set(existingRoles.map(role => normalizeRoleKey(role.role_name)));
  const missingRoles = roles
    .filter(role => role.role_name && !known.has(normalizeRoleKey(role.role_name)))
    .map(role => ({
      script_id: script?.id,
      role_name: role.role_name,
      gender: role.gender || '',
      tags: role.tags || [],
    }));

  if (missingRoles.length > 0) {
    const { error: roleErr } = await supabase.from('script_player_roles').insert(missingRoles);
    if (roleErr) throw roleErr;
  }
  for (const role of roles) {
    const patch: Record<string, unknown> = {};
    if (role.gender) patch.gender = role.gender;
    if (role.tags?.length) patch.tags = role.tags;
    if (Object.keys(patch).length === 0) continue;
    await supabase.from('script_player_roles')
      .update(patch)
      .eq('script_id', script?.id)
      .eq('role_name', role.role_name);
  }

  const finalRoles = roles.length > 0 ? roles : existingRoles;
  return {
    scriptId: script?.id ? String(script.id) : null,
    scriptName: cleanText(script?.name, 100) || requestedScriptName,
    scriptRoles: finalRoles,
  };
}

async function applyScriptContribution(contribution: Record<string, unknown>) {
  const roles = sanitizeCarpoolRoles(contribution.player_roles);
  const creditsPatch = sanitizeScriptCredits(contribution.credits_patch);
  const shared = await ensureSharedScriptForCarpool(contribution.script_id, contribution.script_name, roles);
  if (shared.scriptId) {
    for (const role of roles) {
      const patch: Record<string, unknown> = {};
      if (role.gender) patch.gender = role.gender;
      if (role.tags?.length) patch.tags = role.tags;
      if (Object.keys(patch).length === 0) continue;
      await supabase.from('script_player_roles')
        .update(patch)
        .eq('script_id', shared.scriptId)
        .eq('role_name', role.role_name);
    }
    if (hasScriptCredits(creditsPatch)) {
      const { data: script, error: scriptErr } = await supabase.from('scripts')
        .select('credits')
        .eq('tenant_id', JUZHANGGUI_TENANT_ID)
        .eq('id', shared.scriptId)
        .maybeSingle();
      if (scriptErr) throw scriptErr;
      const nextCredits = mergeScriptCredits(script?.credits, creditsPatch);
      const { error: updateErr } = await supabase.from('scripts')
        .update({ credits: nextCredits })
        .eq('tenant_id', JUZHANGGUI_TENANT_ID)
        .eq('id', shared.scriptId);
      if (updateErr) throw updateErr;
    }
  }
  return { ...shared, creditsPatch };
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
  return [
    cleanText(row.subject_type, 40) || 'unknown',
    cleanText(row.subject_name, 120) || '未命名对象',
    cleanText(row.subject_city, 80) || '',
  ].join('::');
}

function reputationPraiseValue(row: Record<string, unknown>) {
  const likes = Number(row.likes || 0);
  const initial = Number(row.initial_amount || 0);
  if (row.type === 'red') return Math.max(0, likes + initial);
  if (row.type === 'white') return Math.max(0, likes);
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
) {
  const rankingIds = new Set(rows.map(row => String(row.id)));
  const relatedVotes = votes.filter(vote => rankingIds.has(String(vote.ranking_id)));
  const relatedComments = comments.filter(comment => rankingIds.has(String(comment.ranking_id)));
  const praiseVoters = new Set<string>();
  relatedVotes.forEach(vote => {
    if (vote.vote_type !== 'like') return;
    const voterKey = cleanText(vote.voter_id, 80) || cleanText(vote.voter_name, 80);
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
  return {
    id: row.id,
    type: row.type,
    subject_name: row.subject_name,
    subject_type: row.subject_type,
    subject_city: row.subject_city,
    subject_url: row.subject_url,
    content: row.content,
    author_name: row.author_name,
    is_realname: !!row.is_realname,
    initial_amount: row.initial_amount || 0,
    likes: row.likes || 0,
    dislikes: row.dislikes || 0,
    joys: row.joys || 0,
    created_at: row.created_at,
    expires_at: row.expires_at,
    expiry_override: row.expiry_override,
    files: row.files || [],
  };
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
    `来源：灵契拼车区`,
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

  const scriptName = cleanText(carpool.script_name, 100);
  if (!scriptName) throw new Error('缺少剧本名，无法同步剧司辰');

  let scriptId = cleanText(carpool.script_id, 80) || null;
  if (!scriptId) {
    const { data: existingScript, error: scriptQueryErr } = await supabase.from('scripts')
      .select('id')
      .eq('tenant_id', JUZHANGGUI_TENANT_ID)
      .eq('name', scriptName)
      .maybeSingle();
    if (scriptQueryErr) throw scriptQueryErr;
    scriptId = existingScript?.id;
  }
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

  const roles = sanitizeCarpoolRoles(carpool.script_roles, cleanText(carpool.role_name, 80), cleanText(carpool.role_note, 200));
  if (scriptId && roles.length > 0) {
    for (const role of roles) {
      const { data: existingRole } = await supabase.from('script_player_roles')
        .select('id')
        .eq('script_id', scriptId)
        .eq('role_name', role.role_name)
        .maybeSingle();
      if (!existingRole) {
        await supabase.from('script_player_roles').insert({ script_id: scriptId, role_name: role.role_name, gender: role.gender || '', tags: role.tags || [] });
      } else if (role.tags?.length) {
        await supabase.from('script_player_roles')
          .update({ tags: role.tags })
          .eq('id', existingRole.id);
      }
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

app.post('/api/lc/auth/phone', async (req, res) => {
  try {
    const { displayName, activityCities, referralCode } = req.body;
    const activityCityList = normalizeActivityCities(activityCities, req.body?.city);
    const primaryCity = activityCityList[0] || null;
    const phone = await verifyPhoneCode('lingqi', 'login', req.body?.phone, req.body?.code);
    const nowIso = new Date().toISOString();
    const { data: existing } = await supabase.from('lc_profiles').select('*').eq('phone', phone).maybeSingle();

    if (existing) {
      if (existing.is_banned) {
        await logSecurityEvent(req, {
          action: 'auth_phone_login_blocked_banned_user',
          targetType: 'profile',
          targetId: existing.id,
          actorId: existing.id,
          actorRole: existing.role || 'creator',
          metadata: { reason: existing.ban_reason || null },
        });
        return res.status(403).json(err(new Error('账号已被限制登录，请联系管理员申诉')));
      }
      const patch: Record<string, unknown> = {
        phone_verified_at: nowIso,
        auth_provider: existing.auth_provider || 'phone',
        ...profileIdentityPatch(existing, ['player']),
      };
      if (displayName && String(displayName).trim()) patch.display_name = String(displayName).trim().slice(0, 80);
      if (activityCityList.length > 0) {
        patch.available_cities = activityCityList;
        if (!existing.city && primaryCity) patch.city = primaryCity;
      }
      await supabase.from('lc_profiles').update(patch).eq('id', existing.id);
      await runReferralSideEffect('stage1-after-phone-login', () => maybeAwardReferralStage1(existing.id));
      const token = signProfileAuthToken(existing);
      await logSecurityEvent(req, {
        action: 'auth_phone_login_success',
        targetType: 'profile',
        targetId: existing.id,
        actorId: existing.id,
        actorRole: existing.role || 'creator',
        metadata: { phone_verified_at: nowIso, activity_cities_count: activityCityList.length },
      });
      return res.json(ok({
        id: existing.id,
        display_name: String(patch.display_name || existing.display_name || `用户${phone.slice(-4)}`),
        phone,
        role: existing.role,
        city: patch.city || existing.city || null,
        available_cities: patch.available_cities || existing.available_cities || [],
        token,
        new_user: false,
      }));
    }

    const profileRole = 'player';
    const { data: profile } = await supabase.from('lc_profiles').insert({
      phone,
      display_name: displayName && String(displayName).trim() ? String(displayName).trim().slice(0, 80) : `用户${phone.slice(-4)}`,
      role: profileRole,
      role_type: profileRole,
      identity_roles: [profileRole],
      password_hash: null,
      is_visible: true,
      balance: 30,
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
      description: '新用户注册赠送 30 契约币',
      status: 'approved',
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
      token,
      new_user: true,
    }));
  } catch (e) { res.status(400).json(err(e)); }
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
        description: '新用户注册赠送 30 契约币',
        status: 'approved',
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

app.post('/api/lc/auth', async (req, res) => {
  try {
    const { phone, password, displayName, activityCities, referralCode } = req.body;
    const activityCityList = normalizeActivityCities(activityCities, req.body?.city);
    const primaryCity = activityCityList[0] || null;
    const profileRole = 'player';
    if (!phone || !password) {
      return res.status(400).json(err(new Error('请填写手机号和密码')));
    }

    const { data: existing } = await supabase.from('lc_profiles').select('*').eq('phone', phone).maybeSingle();

    if (existing) {
      if (!existing.password_hash) {
        await logSecurityEvent(req, {
          action: 'auth_legacy_password_missing',
          targetType: 'profile',
          targetId: existing.id,
          actorId: existing.id,
          actorRole: existing.role || 'creator',
          metadata: { phone_hash: sha256(String(phone)) },
        });
        return res.status(409).json(err(new Error('该手机号已注册')));
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
          metadata: { phone_hash: sha256(String(phone)), reason: 'bad_password' },
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
        phone: existing.phone,
        city: profilePatch.city || existing.city || null,
        available_cities: profilePatch.available_cities || existing.available_cities || [],
        role: existing.role,
        token,
        ...(isShop ? { juzhanggui_link: 'https://jusichen.com' } : {}),
      }));
    }

    // 注册
    const passwordHash = await bcrypt.hash(password, 10);
    const insertData: Record<string, unknown> = {
      phone, display_name: displayName || '用户', role: profileRole,
      role_type: profileRole, identity_roles: [profileRole],
      password_hash: passwordHash, is_visible: true, balance: 30,
      city: primaryCity,
      available_cities: activityCityList,
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
    const referralResult = await runReferralSideEffect('password-signup', () => registerReferralForNewProfile(profile, referralCode));

    const token = signProfileAuthToken(profile);
    await logSecurityEvent(req, {
      action: 'auth_register_success',
      targetType: 'profile',
      targetId: profile.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { welcome_credit: 30, activity_cities_count: activityCityList.length, referral_applied: Boolean(referralResult?.referral) },
    });
    res.json(ok({
      id: profile.id,
      display_name: profile.display_name,
      phone: profile.phone,
      city: profile.city || null,
      available_cities: profile.available_cities || [],
      role: profile.role,
      token,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/me', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabase.from('lc_profiles')
      .select('id, display_name, avatar, phone, phone_verified_at, is_realname, city, available_cities, role, role_type, identity_roles, verified_dm, verified_shop, referral_code, community_role, community_role_expires_at')
      .eq('id', getReq(req, 'creatorId'))
      .single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/referrals/resolve/:code', async (req, res) => {
  try {
    const owner = await findReferralOwner(req.params.code);
    if (!owner) return res.json(ok(null));
    res.json(ok({
      referral_code: normalizeReferralCode(owner.referral_code),
      display_name: owner.display_name || '灵契用户',
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
          display_name: invitee?.display_name || '灵契新用户',
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

    const [{ data: services }, { data: portfolio }, { data: pendingCerts }, rolePreferences] = await Promise.all([
      supabase.from('lc_services').select('*').eq('creator_id', req.params.id).eq('is_active', true),
      supabase.from('lc_portfolio').select('*').eq('creator_id', req.params.id).order('created_at', { ascending: false }),
      supabase.from('lc_certifications').select('type, status').eq('profile_id', req.params.id).eq('status', 'pending'),
      loadProfileRolePreferences(req.params.id),
    ]);

    const hasPendingShopCert = (pendingCerts || []).some((c: { type: string }) => c.type === 'shop');
    const hasPendingDmCert = (pendingCerts || []).some((c: { type: string }) => c.type === 'dm');

    res.json(ok({
      ...profilePayload,
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
    const {
      display_name, avatar, bio, tags, city, social_links, wechat,
      available_cities, travel_status, contact_unlock_enabled, contact_intent_amount,
      gender, sexual_orientation, preferred_story_lines, role_preferences,
    } = req.body;
    const socialSnapshots = makeSocialSnapshots(social_links);
    const rolePreferences = await sanitizeProfileRolePreferences(role_preferences);

    const { error: profileErr } = await supabase.from('lc_profiles').update({
      display_name, avatar, bio, tags, city, social_links, wechat,
      gender: cleanChoice(gender, PROFILE_GENDER_OPTIONS),
      sexual_orientation: cleanChoice(sexual_orientation, PROFILE_ORIENTATION_OPTIONS),
      preferred_story_lines: cleanTextArray(preferred_story_lines),
      available_cities: Array.isArray(available_cities) ? available_cities : [],
      travel_status: travel_status || '常驻本地',
      contact_unlock_enabled: !!contact_unlock_enabled,
      contact_intent_amount: Math.max(0, parseInt(contact_intent_amount || 0) || 0),
      social_snapshots: socialSnapshots,
      updated_at: new Date().toISOString(),
    }).eq('id', req.params.id);
    if (profileErr) throw profileErr;

    if (Array.isArray(role_preferences)) {
      const { error: deleteErr } = await supabase.from('lc_profile_role_preferences')
        .delete()
        .eq('profile_id', req.params.id);
      if (deleteErr && !isMissingRelation(deleteErr, 'lc_profile_role_preferences')) throw deleteErr;
      if (!deleteErr && rolePreferences.length > 0) {
        const { error: insertErr } = await supabase.from('lc_profile_role_preferences').insert(
          rolePreferences.map((item, index) => ({
            profile_id: req.params.id,
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
    await runReferralSideEffect('stage1-after-profile-update', () => maybeAwardReferralStage1(req.params.id));
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

    if (scriptIdInput) {
      const { data: scriptRow, error: scriptErr } = await supabase.from('scripts')
        .select('id, name')
        .eq('id', scriptIdInput)
        .eq('tenant_id', JUZHANGGUI_TENANT_ID)
        .maybeSingle();
      if (scriptErr && isMissingRelation(scriptErr, 'scripts')) return res.status(503).json(err(new Error('剧本库尚未初始化')));
      if (scriptErr) throw scriptErr;
      if (!scriptRow) return res.status(400).json(err(new Error('选择的剧本不存在')));
      scriptId = scriptRow.id;
      scriptName = cleanText(scriptRow.name, 100);
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
    }).select().single();
    if (insErr) throw insErr;

    await logSecurityEvent(req, {
      action: 'commission_submitted',
      targetType: 'commission',
      targetId: data?.id,
      metadata: { city: city || null, target_type: targetType || null, script_id: scriptId, script_name: scriptName || null },
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
    const { data, error: qErr } = await supabase.from('scripts')
      .select('id, name, duration_minutes, min_duration_hours, max_duration_hours, credits, script_player_roles(role_name, gender, tags)')
      .eq('tenant_id', JUZHANGGUI_TENANT_ID)
      .order('name', { ascending: true });
    if (qErr && isMissingRelation(qErr, 'scripts')) return res.json(ok([]));
    if (qErr) throw qErr;
    res.json(ok((data || []).map((script: Record<string, unknown>) => ({
      id: script.id,
      name: script.name,
      duration_minutes: script.duration_minutes || null,
      min_duration_hours: script.min_duration_hours || null,
      max_duration_hours: script.max_duration_hours || null,
      credits: sanitizeScriptCredits(script.credits),
      player_roles: existingScriptRoles(script).map(role => ({
        role_name: role.role_name,
        gender: role.gender || '',
        tags: role.tags || [],
      })),
    }))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/stores', async (req, res) => {
  try {
    const city = cleanText(req.query.city, 40);
    const { data, error: qErr } = await supabase.from('jzg_stores')
      .select('id, name, city, address, status, created_at')
      .eq('status', 'active')
      .order('name', { ascending: true })
      .limit(200);
    if (qErr && isMissingRelation(qErr, 'jzg_stores')) return res.json(ok([]));
    if (qErr) throw qErr;

    const rows = (data || [])
      .filter((store: Record<string, unknown>) => {
        const storeCity = cleanText(store.city, 40);
        if (!city || city === 'all') return true;
        return !storeCity || storeCity === city || storeCity === '未设置';
      })
      .map((store: Record<string, unknown>) => ({
        id: store.id,
        name: store.name,
        city: store.city || null,
        address: store.address || null,
      }));
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
    const scriptName = cleanText(req.body.scriptName, 100);
    const roles = sanitizeCarpoolRoles(req.body.playerRoles ?? req.body.scriptRoles);
    const creditsPatch = sanitizeScriptCredits(req.body.creditsPatch ?? req.body.credits);
    const note = cleanText(req.body.note, 800);
    if (!scriptId && !scriptName) return res.status(400).json(err(new Error('请填写或选择剧本名')));
    if (roles.length === 0) return res.status(400).json(err(new Error('请至少维护一个玩家角色和角色性别')));
    if (hasMissingScriptContributionGender(roles)) return res.status(400).json(err(new Error('请给每个角色填写性别')));

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
    }).select('*').single();
    if (insErr && isMissingRelation(insErr, 'lc_script_contributions')) return res.status(503).json(err(new Error('剧本库共建表尚未初始化')));
    if (insErr) throw insErr;

    await logSecurityEvent(req, {
      action: 'script_contribution_submitted',
      targetType: 'script_contribution',
      targetId: data?.id,
      metadata: { script_id: scriptId || null, script_name: scriptName || null, role_count: roles.length, credit_fields: Object.keys(creditsPatch) },
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
      status: 'approved',
      juzhanggui_sync_status: 'pending',
      ai_assist_context: {
        source: 'lingqi_carpool_form',
        moderation: 'post_publish',
        juzhanggui_sync: 'pending_manual_or_background_sync',
        subsidy_unit: 'cash_or_ticket_discount',
        raw_message: rawMessage || null,
        generated_message: generatedMessage || null,
        shared_script_id: sharedScript.scriptId,
        linked_store_id: finalStoreId,
        script_roles: scriptRoles,
      },
    }).select('*').single();
    if (insErr) {
      if (isMissingRelation(insErr, 'lc_carpools')) return res.status(503).json(err(new Error('拼车区数据表尚未初始化，请先执行 Supabase migration')));
      throw insErr;
    }

    let publishedCarpool = data as Record<string, unknown>;
    let syncResult: { ok: boolean; scheduleId?: string | null; reused?: boolean; error?: string } = { ok: false };
    try {
      const synced = await syncCarpoolToJuzhanggui(publishedCarpool);
      syncResult = { ok: true, scheduleId: synced.scheduleId, reused: synced.reused };
    } catch (syncErr) {
      syncResult = { ok: false, error: getErrorText(syncErr) || '同步剧司辰失败' };
    }
    const { data: syncUpdated } = await supabase.from('lc_carpools')
      .update({
        juzhanggui_sync_status: syncResult.ok ? 'synced' : 'failed',
        juzhanggui_schedule_id: syncResult.scheduleId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data?.id)
      .select('*')
      .maybeSingle();
    if (syncUpdated) publishedCarpool = syncUpdated as Record<string, unknown>;

    try {
      await auditApprovedTarget('carpool', publishedCarpool, 'carpool_auto_published', profile.id, { moderation: 'post_publish', sync: syncResult });
    } catch {
      // 审计链失败不阻断强时效拼车发布；后台巡检再补。
    }

    await logSecurityEvent(req, {
      action: 'carpool_submitted_auto_published',
      targetType: 'carpool',
      targetId: data?.id,
      metadata: { city, event_date: eventDate, script_name: scriptName, boost_amount: boostAmount, sync: syncResult },
    });
    res.json(ok({ id: data?.id, status: 'approved', balance: (profile.balance || 0) - boostAmount, sync: syncResult }));
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
    await logSecurityEvent(req, {
      action: 'report_submitted',
      targetType,
      targetId,
      metadata: { report_id: data?.id, reason, target_title: targetTitle },
    });
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/site-messages', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const subject = cleanText(req.body?.subject, 80);
    const content = cleanText(req.body?.content, 2000);
    const contact = cleanText(req.body?.contact, 300);
    if (!subject || !content) return res.status(400).json(err(new Error('请填写站内信标题和内容')));

    const { data, error: insErr } = await supabase.from('lc_site_messages').insert({
      sender_id: profile.id,
      sender_name: profile.display_name,
      subject,
      content,
      contact: contact || null,
      status: 'pending',
    }).select('id').single();
    if (insErr) {
      if (isMissingRelation(insErr, 'lc_site_messages')) return res.status(503).json(err(new Error('站内信表尚未初始化，请先执行 Supabase migration')));
      throw insErr;
    }
    await logSecurityEvent(req, {
      action: 'site_message_submitted',
      targetType: 'site_message',
      targetId: data?.id,
      metadata: { subject },
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
    const [{ data: profiles }, { data: requests }, { data: rankings }, { data: approvedRankings }, { data: comments }, { data: claims }, { data: commissions }, { data: transactions }, { data: certifications }, { data: carpools }, { data: reports }, { data: siteMessages }, { data: scriptContributions }, { data: securityEvents }, dmDossiersResult] = await Promise.all([
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
    ]);
    if (dmDossiersResult.error && !isMissingRelation(dmDossiersResult.error, 'lc_dm_dossiers')) throw dmDossiersResult.error;
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
      dmDossiers: dmDossiersResult.error ? [] : (dmDossiersResult.data || []),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/dm-dossiers/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reviewerId = /^[0-9a-f-]{36}$/i.test(String(getReq(req, 'creatorId') || '')) ? String(getReq(req, 'creatorId')) : null;
    const { data: dossier, error: findErr } = await supabase.from('lc_dm_dossiers').select('*').eq('id', req.params.id).single();
    if (findErr && isMissingRelation(findErr, 'lc_dm_dossiers')) return res.status(503).json(err(new Error('爱D墙数据表尚未初始化')));
    if (findErr) throw findErr;
    if (!dossier) return res.status(404).json(err(new Error('档案不存在')));

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dossier.status === 'pending') {
      patch.status = 'approved';
      patch.approved_by = reviewerId;
      patch.approved_at = new Date().toISOString();
      patch.reject_reason = null;
    }
    if (dossier.claim_status === 'pending') {
      patch.claim_status = 'approved';
    }

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

app.put('/api/lc/admin/dm-dossiers/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = cleanText(req.body?.rejectReason, 500) || '不符合爱D墙公开规则';
    const { data: dossier, error: findErr } = await supabase.from('lc_dm_dossiers').select('*').eq('id', req.params.id).single();
    if (findErr && isMissingRelation(findErr, 'lc_dm_dossiers')) return res.status(503).json(err(new Error('爱D墙数据表尚未初始化')));
    if (findErr) throw findErr;
    if (!dossier) return res.status(404).json(err(new Error('档案不存在')));

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      reject_reason: rejectReason,
    };
    if (dossier.status === 'pending') patch.status = 'rejected';
    else if (dossier.claim_status === 'pending') {
      patch.claim_status = 'rejected';
      patch.claim_note = rejectReason;
    }

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

app.get('/api/lc/reputation/city', async (req, res) => {
  try {
    const city = cleanText(req.query.city, 80);
    const subjectType = cleanText(req.query.subjectType, 40);
    const sort = cleanText(req.query.sort, 40) || 'composite';

    let query = supabase
      .from('lc_rankings')
      .select('id, type, subject_name, subject_type, subject_city, subject_url, content, author_name, poster_id, is_realname, initial_amount, likes, dislikes, joys, status, expires_at, expiry_override, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(500);

    if (city && city !== 'all') query = query.eq('subject_city', city);
    if (subjectType && subjectType !== 'all') query = query.eq('subject_type', subjectType);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).filter(row => isPublicRankingVisible(row as Record<string, unknown>)) as Record<string, unknown>[];
    const rankingIds = rows.map(row => String(row.id)).filter(Boolean);
    const [{ data: votes }, { data: comments }] = rankingIds.length > 0
      ? await Promise.all([
          supabase.from('lc_votes').select('ranking_id, vote_type, voter_id, voter_name, created_at').in('ranking_id', rankingIds).limit(2000),
          supabase.from('lc_comments').select('ranking_id, id, likes, created_at').in('ranking_id', rankingIds).eq('status', 'approved').limit(2000),
        ])
      : [{ data: [] }, { data: [] }];

    const grouped = new Map<string, Record<string, unknown>[]>();
    rows.forEach(row => {
      const key = reputationSubjectKey(row);
      grouped.set(key, [...(grouped.get(key) || []), row]);
    });

    const items = [...grouped.entries()].map(([key, subjectRows]) => {
      const first = subjectRows[0] || {};
      const summary = buildReputationSummary(subjectRows, votes || [], comments || []);
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
        ...summary,
        latest_events: latestEvents,
      };
    }).sort((a, b) => {
      if (sort === 'praise') return (b.praise_value || 0) - (a.praise_value || 0) || (b.praise_people || 0) - (a.praise_people || 0);
      if (sort === 'people') return (b.praise_people || 0) - (a.praise_people || 0) || (b.reputation_value || 0) - (a.reputation_value || 0);
      if (sort === 'new') return new Date(String(b.latest_at || 0)).getTime() - new Date(String(a.latest_at || 0)).getTime();
      return (b.reputation_value || 0) - (a.reputation_value || 0) || (b.praise_value || 0) - (a.praise_value || 0);
    }).slice(0, 100);

    res.json(ok({ city: city || 'all', subject_type: subjectType || 'all', sort, items }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/reputation/dossier', async (req, res) => {
  try {
    const subjectName = cleanText(req.query.subjectName, 120);
    const subjectType = cleanText(req.query.subjectType, 40);
    const city = cleanText(req.query.city, 80);
    if (!subjectName || !subjectType) return res.status(400).json(err(new Error('缺少口碑对象')));

    let query = supabase
      .from('lc_rankings')
      .select('id, type, subject_name, subject_type, subject_city, subject_url, content, author_name, poster_id, is_realname, initial_amount, likes, dislikes, joys, status, expires_at, expiry_override, created_at, files')
      .eq('status', 'approved')
      .eq('subject_name', subjectName)
      .eq('subject_type', subjectType)
      .order('created_at', { ascending: false })
      .limit(200);
    if (city) query = query.eq('subject_city', city);

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []).filter(row => isPublicRankingVisible(row as Record<string, unknown>)) as Record<string, unknown>[];
    const rankingIds = rows.map(row => String(row.id)).filter(Boolean);
    const [{ data: votes }, { data: comments }] = rankingIds.length > 0
      ? await Promise.all([
          supabase.from('lc_votes').select('ranking_id, vote_type, voter_id, voter_name, created_at').in('ranking_id', rankingIds).limit(2000),
          supabase.from('lc_comments').select('ranking_id, id, content, author_name, is_realname, is_pinned, pin_label, likes, created_at').in('ranking_id', rankingIds).eq('status', 'approved').limit(2000),
        ])
      : [{ data: [] }, { data: [] }];

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

    const summary = buildReputationSummary(rows, votes || [], comments || []);
    const events = rows.map(publicRankingPayload);
    const commentsByRanking = (comments || []).reduce((map: Record<string, unknown[]>, comment: Record<string, unknown>) => {
      const key = String(comment.ranking_id || '');
      map[key] = [...(map[key] || []), comment];
      return map;
    }, {});

    res.json(ok({
      subject_name: subjectName,
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
    res.json(ok((data || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      entity_type: row.entity_type || 'dm',
      dm_name: row.dm_name,
      city: row.city,
      workplace: row.workplace,
      profile_url: row.profile_url,
      photo_url: row.photo_url,
      note: row.note,
      tags: row.tags || [],
      claim_status: row.claim_status,
      claimed_by: row.claim_status === 'approved' ? row.claimed_by : null,
      created_at: row.created_at,
    }))));
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
    const workplace = cleanText(req.body?.workplace, 160);
    const profileUrl = cleanText(req.body?.profileUrl ?? req.body?.profile_url, 600);
    const note = cleanText(req.body?.note, 600);
    const tags = cleanTextArray(req.body?.tags, 10, 18);
    const rawFiles = Array.isArray(req.body?.photoFiles ?? req.body?.photo_files) ? (req.body?.photoFiles ?? req.body?.photo_files) : [];
    const photoFiles = rawFiles.slice(0, 4).map((file: Record<string, unknown>) => ({
      name: cleanText(file.name, 120) || `${entityLabel} 照片`,
      url: cleanText(file.url, 800),
      type: cleanText(file.type, 80) || null,
    })).filter((file: { url: string }) => file.url);
    const photoUrl = cleanText(req.body?.photoUrl ?? req.body?.photo_url, 800) || photoFiles[0]?.url || '';

    if (!dmName) return res.status(400).json(err(new Error(`请填写${entityLabel}名称`)));
    if (!city) return res.status(400).json(err(new Error('请选择城市')));
    if (!workplace) return res.status(400).json(err(new Error(entityType === 'store' ? '请填写店家地址、商圈或常驻位置' : '请填写工作地点或常驻店家')));
    if (entityType === 'dm' && !profileUrl) return res.status(400).json(err(new Error('请填写 DM 个人主页链接')));
    if (entityType === 'dm' && !photoUrl) return res.status(400).json(err(new Error('请上传一张 DM 照片')));

    const { data, error: insErr } = await supabase.from('lc_dm_dossiers').insert({
      entity_type: entityType,
      dm_name: dmName,
      city,
      workplace,
      profile_url: profileUrl,
      photo_url: photoUrl,
      photo_files: photoFiles,
      note,
      tags,
      submitted_by: profile.id,
      submitted_by_name: profile.display_name,
      status: 'pending',
      claim_status: 'unclaimed',
    }).select('id').single();
    if (insErr) {
      if (isMissingRelation(insErr, 'lc_dm_dossiers')) return res.status(503).json(err(new Error('爱D墙数据表尚未初始化')));
      throw insErr;
    }

    await logSecurityEvent(req, {
      action: entityType === 'store' ? 'store_dossier_submitted' : 'dm_dossier_submitted',
      targetType: 'dm_dossier',
      targetId: data?.id,
      metadata: { entity_type: entityType, dm_name: dmName, city },
    });
    res.json(ok({ id: data?.id, entity_type: entityType, status: 'pending' }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/dm-dossiers/:id/claim', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const claimNote = cleanText(req.body?.claimNote ?? req.body?.claim_note, 600);
    const { data: dossier, error: findErr } = await supabase.from('lc_dm_dossiers')
      .select('id, status, entity_type, dm_name, claim_status')
      .eq('id', req.params.id)
      .single();
    if (findErr) {
      if (isMissingRelation(findErr, 'lc_dm_dossiers')) return res.status(503).json(err(new Error('爱D墙数据表尚未初始化')));
      throw findErr;
    }
    if (!dossier || dossier.status !== 'approved') return res.status(404).json(err(new Error('档案不存在或尚未公开')));
    if (dossier.claim_status === 'approved') return res.status(400).json(err(new Error('这个档案已经被认领')));

    const { error: updErr } = await supabase.from('lc_dm_dossiers').update({
      claimed_by: profile.id,
      claim_status: 'pending',
      claim_note: claimNote,
      updated_at: new Date().toISOString(),
    }).eq('id', req.params.id);
    if (updErr) throw updErr;

    await logSecurityEvent(req, {
      action: dossier.entity_type === 'store' ? 'store_dossier_claim_submitted' : 'dm_dossier_claim_submitted',
      targetType: 'dm_dossier',
      targetId: req.params.id,
      metadata: { entity_type: dossier.entity_type || 'dm', dm_name: dossier.dm_name },
    });
    res.json(ok({ id: req.params.id, claim_status: 'pending' }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/rankings', async (req, res) => {
  try {
    const type = req.query.type as string;
    const city = req.query.city as string;
    const cities = normalizeActivityCities(req.query.cities);
    const subjectType = req.query.subjectType as string;
    const viewerId = getOptionalCreatorId(req);
    let query = supabase
      .from('lc_rankings')
      .select('*, lc_profiles!poster_id(display_name, avatar, verified_dm, verified_shop, role)')
      .eq('status', 'approved')
      .order('likes', { ascending: false })
      .order('created_at', { ascending: false });
    if (type && type !== 'all') query = query.eq('type', type);
    if (subjectType && subjectType !== 'all') query = query.eq('subject_type', subjectType);
    if (cities.length > 0) query = query.in('subject_city', cities);
    else if (city && city !== 'all') query = query.eq('subject_city', city);

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
    if (!RANKING_SUBJECT_TYPES.includes(subjectType)) return res.status(400).json(err(new Error('无效对象分类')));
    if (type !== 'white' && (!Array.isArray(files) || files.length === 0)) return res.status(400).json(err(new Error('请至少上传一份证据文件')));
    const amount = type === 'white' ? 0 : parseInt(initialAmount);
    if (type !== 'white' && (amount < 10 || amount > 100)) return res.status(400).json(err(new Error('契约币须在10~100之间')));

    // 契约币支付
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
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

    await logSecurityEvent(req, {
      action: 'ranking_submitted',
      targetType: 'ranking',
      targetId: ranking?.id,
      metadata: { ranking_type: type, subject_type: subjectType, subject_city: subjectCity || null, amount },
    });
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
    await logSecurityEvent(req, {
      action: 'ranking_withdrawn_by_author',
      targetType: 'ranking',
      targetId: req.params.id,
    });
    res.json(ok({ id: req.params.id, status: 'withdrawn' }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/vote', authMiddleware, async (req, res) => {
  try {
    const voteType = req.body.voteType as RankingVoteType;
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
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

    await logSecurityEvent(req, {
      action: 'ranking_vote_applied',
      targetType: 'ranking',
      targetId: req.params.id,
      metadata: { vote_type: voteType, balance_delta: row.balance_delta || 0 },
    });
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
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
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
    await logSecurityEvent(req, {
      action: 'ranking_comment_submitted',
      targetType: 'comment',
      targetId: data?.id,
      metadata: { ranking_id: req.params.id },
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
      await logSecurityEvent(req, {
        action: 'related_party_certification_submitted',
        targetType: 'comment',
        targetId: req.params.cid,
        metadata: { ranking_id: req.params.id, storage: 'fallback', file_count: relatedFiles.length },
      });
      return res.json(ok({ id: req.params.cid, storage: 'fallback' }));
    }
    if (updErr) throw updErr;
    await logSecurityEvent(req, {
      action: 'related_party_certification_submitted',
      targetType: 'comment',
      targetId: req.params.cid,
      metadata: { ranking_id: req.params.id, storage: 'columns', file_count: relatedFiles.length },
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
    await logSecurityEvent(req, {
      action: 'ranking_comment_deleted_by_author',
      targetType: 'comment',
      targetId: req.params.cid,
      metadata: { ranking_id: req.params.id, refunded: withinRefundWindow ? 1 : 0 },
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
    await supabase.from('lc_rankings').update({ status: 'rejected' }).eq('id', req.params.id);
    await logSecurityEvent(req, {
      action: 'admin_ranking_rejected',
      targetType: 'ranking',
      targetId: req.params.id,
      metadata: { reject_reason: rejectReason || null },
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
    await logSecurityEvent(req, {
      action: hideTarget ? 'admin_report_resolved_and_target_hidden' : `admin_report_${action}`,
      targetType: report.target_type,
      targetId: report.target_id,
      metadata: { report_id: req.params.id, hide_target: hideTarget, handler_note: handlerNote || null },
    });
    res.json(ok({ status: action, hidden: hideTarget }));
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
      .select('balance')
      .eq('id', profile.id)
      .single();
    const { data: txs } = await supabase.from('lc_transactions')
      .select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(100);
    res.json(ok({ balance: walletProfile?.balance || 0, transactions: txs || [] }));
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
    if (!type || !CERTIFICATION_TYPES.includes(type)) {
      return res.status(400).json(err(new Error('请选择认证类型')));
    }
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json(err(new Error('请上传认证材料')));
    }
    if (files.length > 6) return res.status(400).json(err(new Error('认证材料最多上传 6 张')));
    if (type === 'realname') {
      const hasWatermark = files.every((file: Record<string, unknown>) => file?.watermark === REALNAME_WATERMARK_TEXT);
      if (!hasWatermark) return res.status(400).json(err(new Error('实名认证材料必须先加“仅用于灵契实名认证”水印')));
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
