/// <reference types="node" />
// 剧幕录 API
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { createTencentPgClient, tencentPgPool } from './tencentPgSupabase.js';
import { summarizeDmRatingRows } from './dmRatingSummary.js';
import { normalizeRoleReviewLane, summarizeRoleReviewLanes, summarizeRoleReviewRows } from './roleReviewPolicy.js';
import {
  conflictsWhenMergingDmDossiers,
  conflictsWhenMergingStoreDossiers,
  preferredPublicDmAffiliation,
} from './dmAffiliationWorkflow.js';
import { normalizeRankingRevisionKind } from './rankingWorkflow.js';
import { sortRankingFeedDiscussed, sortRankingFeedLatest } from './rankingFeed.js';
import { assessRankingAuthorEdit, RANKING_AUTHOR_EDITABLE_FIELDS } from './rankingAuthorEditPolicy.js';
import {
  reputationVoteBlockReason,
  reputationVoteIdentityKind,
  type ReputationVoteType,
} from './reputationVotePolicy.js';
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
  MAX_MODERATION_EVIDENCE_FILES,
  internalModerationEvidenceFiles,
  publicModerationEvidenceMetadata,
  readModerationEvidenceFile,
  removeModerationEvidenceFile,
  saveModerationEvidenceFile,
} from './moderationEvidenceStorage.js';
import {
  MAX_RANKING_EVIDENCE_FILES,
  internalRankingEvidenceFiles,
  publicRankingEvidenceMetadata,
  readRankingEvidenceFile,
  removeRankingEvidenceFiles,
  resolveLegacyRankingEvidenceSourceUrl,
  saveRankingEvidenceFiles,
  validateRankingEvidencePublicCopy,
  type RankingEvidenceFile,
} from './rankingEvidenceStorage.js';
import {
  dossierAdminReviewMode,
  dossierEditAdminReviewReady,
  effectiveDossierOwnerResponseStatus,
  initialDossierEditWorkflow,
  ownerLoggedInDuringDossierResponseWindow,
  partitionDossierEditPatch,
} from './dossierEditWorkflow.js';
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
import {
  dossierFieldComparableValue,
  dossierOwnerLockedFields,
  dossierPatchForOwnerConsent,
  dossierSensitiveFieldsInPatch,
  MAX_DOSSIER_COMMON_SCRIPTS,
  MAX_DOSSIER_PHOTOS,
  normalizeDossierCareerHistory,
  normalizeDossierIntegerInput,
  normalizeDossierMonth,
  normalizeDossierNamedRefs,
  normalizeDossierPhotos,
  normalizeDossierFieldProvenance,
  stampDossierFieldProvenance,
  type DossierCareerEntry,
  type DossierNamedRef,
  type DossierPhoto,
} from '../src/lib/dossierWiki.js';
import { extractSharedUrl } from '../src/lib/socialLinks.js';
import { CHANTO_MAX_AMOUNT, CHANTO_MIN_AMOUNT, isValidChantoAmount } from '../src/lib/chanto.js';
import { CITIES } from '../src/constants/cities.js';
import { adminPrivateAccountPayload, adminProfileListPayload } from './adminPrivacy.js';
import {
  allowedWebOrigin,
  publicApiErrorMessage,
  publicAuditMetadata,
  publicProfileAllowlist,
} from './securityPolicy.js';
import {
  authSessionMatches,
  sessionVersionOf,
} from './authSessionPolicy.js';
import {
  interpretWechatContentCheck,
  interpretWechatMediaCallback,
  interpretWechatMediaSubmission,
  splitWechatSafetyText,
  wechatSafetySceneNumber,
  type WechatContentCheckPayload,
  type WechatMediaCallbackPayload,
  type WechatMediaCheckSubmissionPayload,
} from './wechatMiniContentSafety.js';
import { WechatAccessTokenCache } from './wechatAccessTokenCache.js';
import {
  wechatImageApprovalIssue,
  wechatImageSubmissionAction,
  type WechatImageCheckRow,
} from './wechatImageSafetyPolicy.js';
import {
  miniappAccountMergeErrorMessage,
  miniappAccountMergePreflight,
} from './accountMergePolicy.js';
import {
  accountAccessDecision,
  normalizeRestrictionScope,
  restrictionBlocksLogin,
  restrictionHasExpired,
  type AccountRestrictionProfile,
  type AccountRestrictionScope,
} from './accountRestrictionPolicy.js';
import { profileSetupBlockReason } from './profileSetupPolicy.js';
import {
  firstPublicImage,
  normalizeSubmissionState,
  sortAccountSubmissions,
  summarizeAccountSubmissions,
  type AccountSubmissionGroup,
  type AccountSubmissionItem,
} from './accountSubmissions.js';
import { canApplyToCommission, commissionCityMatch } from './commissionTravel.js';
import {
  normalizeProviderListingDraft,
  providerInquiryPayload,
  publicProviderListing,
} from './providerMarketplace.js';
import { findRecoverableProviderPoster } from './providerListingRecovery.js';
import {
  SERVICE_FEE_FEN,
  SERVICE_FEE_YUAN,
  assertServicePaymentEnvelope,
  assertServicePaymentOwnership,
  createMiniappPaymentParams,
  normalizeServiceProductType,
  serviceProductDescription,
  servicePurchaseGrantsAccess,
  type ServiceProductType,
} from './servicePayments.js';

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
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') throw new Error('Missing JWT_SECRET');
  console.warn('JWT_SECRET is not set; using local development fallback.');
  return 'lingqi-dev-secret-change-in-production';
})();
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
const LINGQI_WECHAT_MINI_MSG_TOKEN = process.env.LINGQI_WECHAT_MINI_MSG_TOKEN || '';
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
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 8,
    parts: 10,
    fieldSize: 64 * 1024,
  },
});
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

type RateLimitEntry = { count: number; resetAt: number };

function createRateLimiter(name: string, windowMs: number, max: number) {
  const entries = new Map<string, RateLimitEntry>();
  let requestsSinceCleanup = 0;
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    requestsSinceCleanup += 1;
    if (requestsSinceCleanup >= 500 || entries.size > 10_000) {
      requestsSinceCleanup = 0;
      for (const [key, entry] of entries) {
        if (entry.resetAt <= now) entries.delete(key);
      }
    }
    const key = `${name}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const current = entries.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    entry.count += 1;
    entries.set(key, entry);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return res.status(429).json(err(new Error('操作太频繁，请稍后再试')));
    }
    next();
  };
}

const authRateLimit = createRateLimiter('auth', 15 * 60 * 1000, 40);
const verificationRateLimit = createRateLimiter('verification', 10 * 60 * 1000, 6);
const uploadRateLimit = createRateLimiter('upload', 10 * 60 * 1000, 30);
const contactRateLimit = createRateLimiter('contact', 60 * 60 * 1000, 10);
const reportRateLimit = createRateLimiter('report', 60 * 60 * 1000, 20);
const paymentRateLimit = createRateLimiter('payment', 15 * 60 * 1000, 20);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
const extraCorsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(item => item.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (allowedWebOrigin(origin, extraCorsOrigins)) return callback(null, true);
    callback(new Error('CORS origin denied'));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Shared-Library-Token'],
  maxAge: 86400,
}));
app.use((req, res, next) => {
  const path = req.path;
  if (path === '/api/lc/auth/send-code' || path === '/api/lc/auth/email/send-code') {
    return verificationRateLimit(req, res, next);
  }
  if ((path.startsWith('/api/lc/auth') && path !== '/api/lc/auth/config') || path === '/api/lc/admin/login') {
    return authRateLimit(req, res, next);
  }
  if (path === '/api/lc/upload') return uploadRateLimit(req, res, next);
  if (path === '/api/lc/contact-request') return contactRateLimit(req, res, next);
  if (path === '/api/lc/reports' || path === '/api/lc/site-messages') return reportRateLimit(req, res, next);
  if (req.method === 'POST' && (
    path.includes('/purchase')
    || path === '/api/lc/service-payments/create'
    || path === '/api/lc/wallet/recharge'
    || path === '/api/lc/wallet/alipay/create'
    || path === '/api/lc/wallet/wechat/create'
  )) {
    return paymentRateLimit(req, res, next);
  }
  next();
});
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
  limit: '2mb',
  verify: (req, _res, buf) => {
    (req as Record<string, unknown>).rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// --- 工具函数 ---
function ok(d?: unknown) { return { success: true, data: d }; }
function err(e: unknown) {
  const message = publicApiErrorMessage(e, process.env.NODE_ENV === 'production').replaceAll('契约币', '榜金');
  return { success: false, error: message };
}

function codedErr(e: unknown, code: string, details?: Record<string, unknown>) {
  return { ...err(e), code, ...(details ? { details } : {}) };
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

function verifyWechatMiniEventRequest(req: express.Request): boolean {
  if (!LINGQI_WECHAT_MINI_MSG_TOKEN) return false;
  const timestamp = singleQueryValue(req.query.timestamp);
  const nonce = singleQueryValue(req.query.nonce);
  const signature = singleQueryValue(req.query.signature);
  if (!timestamp || !nonce || !signature) return false;
  return safeEqualText(
    sha1Sorted([LINGQI_WECHAT_MINI_MSG_TOKEN, timestamp, nonce]),
    signature,
  );
}

function xmlText(rawXml: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = rawXml.match(new RegExp(
    `<${escaped}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${escaped}>`,
    'i',
  ));
  return (match?.[1] || match?.[2] || '').trim();
}

function parseWechatMiniMediaEvent(body: unknown, rawBody: string): WechatMediaCallbackPayload {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as WechatMediaCallbackPayload;
  }
  const errcodeText = xmlText(rawBody, 'errcode');
  const labelText = xmlText(rawBody, 'label');
  return {
    Event: xmlText(rawBody, 'Event') || xmlText(rawBody, 'event'),
    appid: xmlText(rawBody, 'appid') || xmlText(rawBody, 'AppId'),
    trace_id: xmlText(rawBody, 'trace_id'),
    errcode: errcodeText ? Number(errcodeText) : 0,
    errmsg: xmlText(rawBody, 'errmsg'),
    result: {
      suggest: xmlText(rawBody, 'suggest'),
      label: labelText ? Number(labelText) : undefined,
    },
  };
}

function getWechatMpConfigError(): string {
  if (!WECHAT_MP_TOKEN) return 'wechat mp token not configured';
  if (WECHAT_MP_ENCODING_AES_KEY && WECHAT_MP_ENCODING_AES_KEY.length !== 43) return 'wechat mp aes key invalid';
  return '';
}

function isWechatMiniLoginConfigured() {
  return Boolean(LINGQI_WECHAT_MINI_APP_ID && LINGQI_WECHAT_MINI_APP_SECRET);
}

const wechatMiniAccessTokenCache = new WechatAccessTokenCache();
const WECHAT_MINI_API_TIMEOUT_MS = 8_000;

function wechatMiniApiSignal() {
  return AbortSignal.timeout(WECHAT_MINI_API_TIMEOUT_MS);
}

async function getWechatMiniAccessToken() {
  if (!isWechatMiniLoginConfigured()) throw new Error('微信小程序服务尚未配置');
  return wechatMiniAccessTokenCache.get(async () => {
    const tokenUrl = new URL('https://api.weixin.qq.com/cgi-bin/token');
    tokenUrl.search = new URLSearchParams({
      grant_type: 'client_credential',
      appid: LINGQI_WECHAT_MINI_APP_ID,
      secret: LINGQI_WECHAT_MINI_APP_SECRET,
    }).toString();
    const response = await fetch(tokenUrl, { signal: wechatMiniApiSignal() });
    const payload = await response.json() as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };
    if (!response.ok || !payload.access_token) throw new Error(payload.errmsg || '微信内容安全服务授权失败');
    return { token: payload.access_token, expiresInSeconds: Number(payload.expires_in || 7200) };
  });
}

async function checkWechatMiniText(content: string, openid: string, scene: 1 | 2 | 3 | 4) {
  let payload: WechatContentCheckPayload = {};
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getWechatMiniAccessToken();
    const response = await fetch(`https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, version: 2, scene, openid }),
      signal: wechatMiniApiSignal(),
    });
    payload = await response.json() as WechatContentCheckPayload;
    if (payload.errcode !== 40014 && payload.errcode !== 42001) break;
    wechatMiniAccessTokenCache.invalidate(token);
  }
  return interpretWechatContentCheck(payload);
}

async function submitWechatMiniMediaCheck(mediaUrl: string, openid: string, scene: 1 | 2 | 3 | 4) {
  let payload: WechatMediaCheckSubmissionPayload = {};
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getWechatMiniAccessToken();
    const response = await fetch(`https://api.weixin.qq.com/wxa/media_check_async?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        media_url: mediaUrl,
        media_type: 2,
        version: 2,
        scene,
        openid,
      }),
      signal: wechatMiniApiSignal(),
    });
    payload = await response.json() as WechatMediaCheckSubmissionPayload;
    if (payload.errcode !== 40014 && payload.errcode !== 42001) break;
    wechatMiniAccessTokenCache.invalidate(token);
  }
  return interpretWechatMediaSubmission(payload);
}

type AuthClientChannel = 'web' | 'wechat-miniapp';

function authClientForToken(req: express.Request): AuthClientChannel {
  const authenticatedClient = (req as Record<string, unknown>).authClient;
  if (authenticatedClient === 'wechat-miniapp') return 'wechat-miniapp';
  if (authenticatedClient === 'web') return 'web';
  return req.header('X-LC-Client') === 'wechat-miniapp' ? 'wechat-miniapp' : 'web';
}

function isWechatMiniClient(req: express.Request) {
  const authenticatedClient = (req as Record<string, unknown>).authClient;
  if (authenticatedClient === 'wechat-miniapp' || authenticatedClient === 'web') {
    return authenticatedClient === 'wechat-miniapp';
  }
  // Legacy tokens are upgraded by /miniapp/auth/refresh on the next app launch.
  return req.header('X-LC-Client') === 'wechat-miniapp';
}

function wechatSafetyStatusFromSuggestion(suggest: string) {
  if (suggest === 'pass' || suggest === 'review' || suggest === 'risky') return suggest;
  return 'error';
}

async function insertWechatContentCheck(input: {
  profileId: string | null;
  checkType: 'text' | 'image';
  businessScene: string;
  targetType: string;
  targetId?: string | null;
  resourceHash: string;
  status: 'pending' | 'pass' | 'review' | 'risky' | 'error';
  suggest?: string | null;
  label?: number | null;
  traceId?: string | null;
  errcode?: number;
  errorMessage?: string | null;
}) {
  const nowIso = new Date().toISOString();
  const result = await supabase.from('lc_wechat_content_checks').insert({
    profile_id: input.profileId,
    check_type: input.checkType,
    business_scene: cleanText(input.businessScene, 80),
    target_type: cleanText(input.targetType, 80) || null,
    target_id: cleanText(input.targetId, 120) || null,
    resource_hash: input.resourceHash,
    status: input.status,
    suggest: cleanText(input.suggest, 20) || null,
    label: Number.isFinite(input.label) ? input.label : null,
    trace_id: cleanText(input.traceId, 160) || null,
    errcode: Number(input.errcode || 0),
    error_message: cleanText(input.errorMessage, 300) || null,
    checked_at: input.status === 'pending' ? null : nowIso,
    updated_at: nowIso,
  }).select('id, status, trace_id').single();
  if (result.error) throw result.error;
  return result.data;
}

async function runWechatMiniTextSafetyCheck(req: express.Request, input: {
  businessScene: string;
  targetType: string;
  targetId?: string | null;
  content: string;
}) {
  const profile = await getAuthedProfile(req);
  if (!profile) throw new Error('用户不存在');
  if (!profile.wechat_mini_openid) throw new Error('请先使用微信小程序重新登录');
  const chunks = splitWechatSafetyText([input.content]);
  if (chunks.length === 0) throw new Error('缺少待检查内容');
  const content = chunks.join('');
  const resourceHash = sha256(content);
  try {
    let verdict: Awaited<ReturnType<typeof checkWechatMiniText>> | null = null;
    const traceIds: string[] = [];
    for (const chunk of chunks) {
      verdict = await checkWechatMiniText(
        chunk,
        profile.wechat_mini_openid,
        wechatSafetySceneNumber(input.businessScene),
      );
      if (verdict.traceId) traceIds.push(verdict.traceId);
      if (!verdict.allowed) break;
    }
    if (!verdict) throw new Error('微信内容安全服务未返回检查结果');
    if (traceIds.length > 1) verdict = { ...verdict, traceId: traceIds.join(',') };
    const row = await insertWechatContentCheck({
      profileId: profile.id,
      checkType: 'text',
      businessScene: input.businessScene,
      targetType: input.targetType,
      targetId: input.targetId,
      resourceHash,
      status: wechatSafetyStatusFromSuggestion(verdict.suggest),
      suggest: verdict.suggest,
      label: verdict.label,
      traceId: verdict.traceId,
      errcode: verdict.errcode,
      errorMessage: verdict.reason,
    });
    return { profile, verdict, row };
  } catch (error) {
    await insertWechatContentCheck({
      profileId: profile.id,
      checkType: 'text',
      businessScene: input.businessScene,
      targetType: input.targetType,
      targetId: input.targetId,
      resourceHash,
      status: 'error',
      errcode: -1,
      errorMessage: getErrorText(error) || '微信内容安全服务暂时不可用',
    }).catch(logError => console.error('[wechat-safety] text audit failed', getErrorText(logError)));
    throw error;
  }
}

function wechatMiniTextSafetyMiddleware(input: {
  businessScene: string;
  targetType: string;
  content: (req: express.Request) => unknown[];
}) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!isWechatMiniClient(req)) return next();
    const content = splitWechatSafetyText(input.content(req)).join('');
    if (!content) return next();
    try {
      const result = await runWechatMiniTextSafetyCheck(req, {
        businessScene: input.businessScene,
        targetType: input.targetType,
        targetId: req.params.id || null,
        content,
      });
      if (!result.verdict.allowed) {
        return res.status(result.verdict.retryable ? 503 : 400).json(err(new Error(result.verdict.reason)));
      }
      (req as Record<string, unknown>).wechatContentCheckId = result.row?.id || null;
      return next();
    } catch (error) {
      console.error('[wechat-safety] text check failed', getErrorText(error));
      return res.status(503).json(err(new Error('微信内容安全服务暂时不可用，请稍后重试')));
    }
  };
}

async function startWechatMiniImageSafetyCheck(req: express.Request, input: {
  mediaUrl: string;
  businessScene: string;
  targetType: string;
  targetId?: string | null;
}) {
  if (!isWechatMiniClient(req)) return null;
  const profile = await getAuthedProfile(req);
  if (!profile) throw new Error('用户不存在');
  if (!profile.wechat_mini_openid) throw new Error('请先使用微信小程序重新登录');
  const resourceHash = sha256(input.mediaUrl);
  try {
    const submission = await submitWechatMiniMediaCheck(
      input.mediaUrl,
      profile.wechat_mini_openid,
      wechatSafetySceneNumber(input.businessScene),
    );
    const row = await insertWechatContentCheck({
      profileId: profile.id,
      checkType: 'image',
      businessScene: input.businessScene,
      targetType: input.targetType,
      targetId: input.targetId,
      resourceHash,
      status: submission.accepted ? 'pending' : 'error',
      traceId: submission.traceId,
      errcode: submission.errcode,
      errorMessage: submission.reason,
    });
    if (!submission.accepted) throw new Error(submission.reason);
    return { id: row.id, status: row.status, traceId: submission.traceId };
  } catch (error) {
    const message = getErrorText(error) || '微信图片内容安全任务提交失败';
    console.error('[wechat-safety] image task failed', message);
    throw new Error('微信图片内容安全服务暂时不可用，请稍后重试', { cause: error });
  }
}

async function ensureWechatMiniImageSafetyChecks(req: express.Request, input: {
  urls: unknown[];
  businessScene: string;
  targetType: string;
  targetId?: string | null;
}) {
  if (!isWechatMiniClient(req)) return;
  const profile = await getAuthedProfile(req);
  if (!profile) throw new Error('用户不存在');
  const urls = Array.from(new Set(
    input.urls
      .map(url => normalizeOptionalPublicUrl(url, 2000, true))
      .filter((url): url is string => Boolean(url)),
  ));
  if (urls.length === 0) return;

  const hashes = urls.map(url => sha256(url));
  const existingResult = await supabase.from('lc_wechat_content_checks')
    .select('resource_hash, status, created_at')
    .eq('profile_id', profile.id)
    .eq('check_type', 'image')
    .in('resource_hash', hashes)
    .order('created_at', { ascending: false });
  if (existingResult.error) throw existingResult.error;
  const latest = new Map<string, WechatImageCheckRow>();
  for (const row of (existingResult.data || []) as WechatImageCheckRow[]) {
    if (!latest.has(row.resource_hash)) latest.set(row.resource_hash, row);
  }

  for (const url of urls) {
    const action = wechatImageSubmissionAction(latest.get(sha256(url)));
    if (action === 'reuse') continue;
    if (action === 'block') {
      throw new Error('图片未通过微信内容安全检查，请更换后重试');
    }
    await startWechatMiniImageSafetyCheck(req, {
      mediaUrl: url,
      businessScene: input.businessScene,
      targetType: input.targetType,
      targetId: input.targetId,
    });
  }
}

async function assertWechatImageChecksAllowApproval(urls: unknown[]) {
  const hashes = Array.from(new Set(urls.map(url => cleanText(url, 2000)).filter(Boolean).map(url => sha256(url))));
  if (hashes.length === 0) return;
  const result = await supabase.from('lc_wechat_content_checks')
    .select('resource_hash, status, created_at')
    .eq('check_type', 'image')
    .in('resource_hash', hashes)
    .order('created_at', { ascending: false });
  if (result.error) throw result.error;
  const issue = wechatImageApprovalIssue(hashes, (result.data || []) as WechatImageCheckRow[]);
  if (issue === 'unsafe') {
    throw new Error('图片未通过微信内容安全检查，不能公开');
  }
  if (issue === 'incomplete') {
    throw new Error('图片仍在等待微信内容安全检查，请稍后再审核');
  }
}

function collectPotentialPublicImageUrls(value: unknown, depth = 0): string[] {
  if (depth > 5 || value === null || value === undefined) return [];
  if (typeof value === 'string') {
    const normalized = normalizeOptionalPublicUrl(value, 2000, true);
    return normalized ? [normalized] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(item => collectPotentialPublicImageUrls(item, depth + 1));
  }
  if (typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    if (!/(avatar|image|photo|poster|file|url)/i.test(key) && typeof child === 'string') return [];
    return collectPotentialPublicImageUrls(child, depth + 1);
  });
}

type AccountStateProfile = Record<string, unknown> & AccountRestrictionProfile & {
  id: string;
  role?: string | null;
  ban_reason?: string | null;
  banned_at?: string | null;
  merged_at?: string | null;
  session_version?: number | null;
};

async function expireAccountRestriction(profile: AccountStateProfile): Promise<AccountStateProfile> {
  if (!restrictionHasExpired(profile)) return profile;
  const nowIso = new Date().toISOString();

  if (!useTencentPg) {
    const activeResult = await supabase.from('lc_account_restrictions')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('status', 'active')
      .maybeSingle();
    await supabase.from('lc_profiles').update({
      is_banned: false,
      ban_reason: null,
      banned_at: null,
      restriction_scope: null,
      restriction_ends_at: null,
    }).eq('id', profile.id);
    if (activeResult.data?.id) {
      await supabase.from('lc_account_restrictions').update({ status: 'expired', updated_at: nowIso }).eq('id', activeResult.data.id);
      await supabase.from('lc_account_notifications').insert({
        profile_id: profile.id,
        type: 'restriction_expired',
        title: '账号限制已到期',
        content: '账号限制已自动解除，你可以继续使用相应功能。',
        action_url: '/account-status',
        related_type: 'account_restriction',
        related_id: activeResult.data.id,
      });
    }
    return { ...profile, is_banned: false, ban_reason: null, banned_at: null, restriction_scope: null, restriction_ends_at: null };
  }

  const client = await tencentPgPool.connect();
  try {
    await client.query('begin');
    const activeResult = await client.query<{ id: string }>(
      `select id
       from lc_account_restrictions
       where profile_id = $1 and status = 'active'
       for update`,
      [profile.id],
    );
    const updateResult = await client.query<AccountStateProfile>(
      `update lc_profiles
       set is_banned = false,
           ban_reason = null,
           banned_at = null,
           restriction_scope = null,
           restriction_ends_at = null,
           updated_at = now()
       where id = $1
         and is_banned = true
         and restriction_ends_at is not null
         and restriction_ends_at <= now()
       returning *`,
      [profile.id],
    );
    const restrictionId = activeResult.rows[0]?.id;
    if (updateResult.rowCount && restrictionId) {
      await client.query(
        `update lc_account_restrictions
         set status = 'expired', updated_at = now()
         where id = $1 and status = 'active'`,
        [restrictionId],
      );
      await client.query(
        `insert into lc_account_notifications
           (profile_id, type, title, content, action_url, related_type, related_id)
         values ($1, 'restriction_expired', '账号限制已到期',
           '账号限制已自动解除，你可以继续使用相应功能。',
           '/account-status', 'account_restriction', $2)`,
        [profile.id, restrictionId],
      );
    }
    await client.query('commit');
    return updateResult.rows[0] || { ...profile, is_banned: false, ban_reason: null, banned_at: null, restriction_scope: null, restriction_ends_at: null };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function loadAuthenticatedAccount(req: express.Request, res: express.Response): Promise<AccountStateProfile | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json(err(new Error('请先登录')));
    return null;
  }
  let decoded: { creatorId: string; role?: string; sessionVersion?: number; authClient?: AuthClientChannel };
  try {
    decoded = jwt.verify(auth.slice(7), JWT_SECRET) as {
      creatorId: string;
      role?: string;
      sessionVersion?: number;
      authClient?: AuthClientChannel;
    };
  } catch {
    res.status(401).json(err(new Error('登录已过期，请重新登录')));
    return null;
  }

  try {
    if (!decoded.creatorId || decoded.creatorId === 'admin') {
      res.status(401).json(err(new Error('旧管理员登录已停用，请使用管理员账号重新登录')));
      return null;
    }
    const { data: rawProfile, error: profileErr } = await supabase.from('lc_profiles')
      .select('id, role, is_banned, ban_reason, banned_at, merged_into, merged_at, restriction_scope, restriction_ends_at, last_seen_at, session_version')
      .eq('id', decoded.creatorId)
      .maybeSingle();
    if (profileErr && !isMissingRelation(profileErr, 'is_banned')) throw profileErr;
    if (!rawProfile) {
      res.status(401).json(err(new Error('账号不存在，请重新登录')));
      return null;
    }
    const profile = await expireAccountRestriction(rawProfile as AccountStateProfile);

    const actualRole = profileAuthRole(profile);
    (req as Record<string, unknown>).creatorId = decoded.creatorId;
    (req as Record<string, unknown>).role = actualRole;
    (req as Record<string, unknown>).accountProfile = profile;
    if (decoded.authClient === 'web' || decoded.authClient === 'wechat-miniapp') {
      (req as Record<string, unknown>).authClient = decoded.authClient;
    }

    if (!profile.merged_into && !authSessionMatches(decoded.sessionVersion, profile.session_version)) {
      res.status(401).json(err(new Error('登录状态已失效，请重新登录')));
      return null;
    }
    if (!profile.merged_into) {
      const seenResult = await supabase.from('lc_profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', decoded.creatorId);
      if (seenResult.error && !isMissingRelation(seenResult.error, 'last_seen_at')) throw seenResult.error;
    }
    return profile;
  } catch (profileErr) {
    console.error('[auth] profile status check failed', getErrorText(profileErr));
    res.status(500).json(err(new Error('账号状态检查失败，请稍后重试')));
    return null;
  }
}

function publishRestrictionAllowsWrite(path: string) {
  return path === '/api/lc/auth/bind-phone'
    || path === '/api/lc/auth/set-password'
    || path === '/api/lc/follows/cities'
    || path.startsWith('/api/lc/follows/stores/');
}

// --- JWT 鉴权中间件 ---
async function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const profile = await loadAuthenticatedAccount(req, res);
  if (!profile) return;
  const decision = accountAccessDecision(profile, req.method);
  if (decision.state === 'merged') {
    return res.status(409).json(codedErr(
      new Error('这个微信临时账号已经合并到原网站账号，请重新登录'),
      'ACCOUNT_MERGED',
      { reauthenticate: true },
    ));
  }
  if (!decision.allowed && !(decision.scope === 'publish' && publishRestrictionAllowsWrite(req.path))) {
    await logSecurityEvent(req, {
      action: 'auth_blocked_restricted_user',
      actorId: profile.id,
      actorRole: profileAuthRole(profile),
      targetType: 'profile',
      targetId: profile.id,
      metadata: { reason: profile.ban_reason || null, scope: decision.scope || 'account' },
    });
    const message = decision.scope === 'publish'
      ? '账号当前被限制发布，请到账号状态页查看原因或提交申诉'
      : '账号功能当前受限，请到账号状态页查看原因或提交申诉';
    return res.status(403).json(codedErr(new Error(message), 'ACCOUNT_RESTRICTED', {
      scope: decision.scope || 'account',
      action_url: '/account-status',
    }));
  }
  next();
}

async function accountStateMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const profile = await loadAuthenticatedAccount(req, res);
  if (!profile) return;
  next();
}

function accountProfileFromRequest(req: express.Request) {
  return (req as Record<string, unknown>).accountProfile as AccountStateProfile;
}

async function activeAccountRestriction(profileId: string) {
  const { data, error } = await supabase.from('lc_account_restrictions')
    .select('id, scope, reason, status, starts_at, ends_at, created_at, updated_at')
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

function publicAccountRestriction(profile: AccountStateProfile, restriction: Record<string, unknown> | null) {
  if (!profile.is_banned || profile.merged_into) return null;
  return restriction || {
    id: null,
    scope: normalizeRestrictionScope(profile.restriction_scope),
    reason: profile.ban_reason || '账号功能受限',
    status: 'active',
    starts_at: profile.banned_at || null,
    ends_at: profile.restriction_ends_at || null,
  };
}

function normalizeAccountEvidenceUrls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .map(item => normalizeOptionalPublicUrl(item, 1200, true))
    .filter(Boolean)))
    .slice(0, 6);
}

app.get('/api/lc/account/status', accountStateMiddleware, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const profile = accountProfileFromRequest(req);
    if (profile.merged_into) {
      return res.json(ok({
        state: 'merged',
        message: '这个微信临时账号已经合并到原网站账号，请重新登录。',
        merged_at: profile.merged_at || null,
        reauthenticate: true,
        restriction: null,
        appeal: null,
        unread_count: 0,
      }));
    }

    const [restriction, appealResult, unreadResult] = await Promise.all([
      activeAccountRestriction(profile.id),
      supabase.from('lc_account_appeals')
        .select('id, restriction_id, content, evidence_urls, status, admin_reply, reviewed_at, created_at, updated_at')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase.from('lc_account_notifications')
        .select('id')
        .eq('profile_id', profile.id)
        .is('read_at', null)
        .limit(100),
    ]);
    if (appealResult.error) throw appealResult.error;
    if (unreadResult.error) throw unreadResult.error;
    res.json(ok({
      state: profile.is_banned ? 'restricted' : 'active',
      message: profile.is_banned ? '账号当前有生效中的功能限制。' : '账号状态正常。',
      restriction: publicAccountRestriction(profile, restriction),
      appeal: appealResult.data?.[0] || null,
      unread_count: unreadResult.data?.length || 0,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/account/notifications', accountStateMiddleware, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const profile = accountProfileFromRequest(req);
    if (profile.merged_into) return res.json(ok([]));
    const { data, error } = await supabase.from('lc_account_notifications')
      .select('id, type, title, content, action_url, related_type, related_id, read_at, created_at')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/account/notifications/read-all', accountStateMiddleware, async (req, res) => {
  try {
    const profile = accountProfileFromRequest(req);
    if (profile.merged_into) return res.status(409).json(codedErr(new Error('账号已合并，请重新登录'), 'ACCOUNT_MERGED'));
    const readAt = new Date().toISOString();
    const { error } = await supabase.from('lc_account_notifications')
      .update({ read_at: readAt })
      .eq('profile_id', profile.id)
      .is('read_at', null);
    if (error) throw error;
    res.json(ok({ read_at: readAt }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/account/notifications/:id/read', accountStateMiddleware, async (req, res) => {
  try {
    const profile = accountProfileFromRequest(req);
    if (profile.merged_into) return res.status(409).json(codedErr(new Error('账号已合并，请重新登录'), 'ACCOUNT_MERGED'));
    const { data, error } = await supabase.from('lc_account_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('profile_id', profile.id)
      .select('id, read_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json(err(new Error('通知不存在')));
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post(
  '/api/lc/account/appeals',
  accountStateMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'account_appeal',
    targetType: 'account_appeal',
    content: req => [req.body?.content],
  }),
  async (req, res) => {
  try {
    const profile = accountProfileFromRequest(req);
    if (profile.merged_into) return res.status(409).json(codedErr(new Error('账号已合并，请重新登录'), 'ACCOUNT_MERGED'));
    if (!profile.is_banned) return res.status(409).json(err(new Error('当前账号没有生效中的限制')));
    const content = cleanText(req.body?.content, 2000);
    if (content.length < 10) return res.status(400).json(err(new Error('请至少填写 10 个字的申诉说明')));
    const restriction = await activeAccountRestriction(profile.id);
    if (!restriction?.id) return res.status(409).json(err(new Error('当前限制记录尚未初始化，请联系管理员处理')));
    const evidenceUrls = normalizeAccountEvidenceUrls(req.body?.evidenceUrls);
    const existingOpenResult = await supabase.from('lc_account_appeals')
      .select('id, status')
      .eq('profile_id', profile.id)
      .in('status', ['pending', 'needs_info'])
      .maybeSingle();
    if (existingOpenResult.error) throw existingOpenResult.error;
    if (existingOpenResult.data?.status === 'pending') {
      return res.status(409).json(err(new Error('已有申诉正在处理中，请勿重复提交')));
    }
    const appealMutation = existingOpenResult.data?.status === 'needs_info'
      ? supabase.from('lc_account_appeals').update({
          content,
          evidence_urls: evidenceUrls,
          status: 'pending',
          reviewed_by: null,
          reviewed_at: null,
          updated_at: new Date().toISOString(),
        }).eq('id', existingOpenResult.data.id)
      : supabase.from('lc_account_appeals').insert({
          restriction_id: restriction.id,
          profile_id: profile.id,
          content,
          evidence_urls: evidenceUrls,
          status: 'pending',
        });
    const { data, error } = await appealMutation
      .select('id, restriction_id, content, evidence_urls, status, created_at, updated_at')
      .single();
    if (error) {
      if (String((error as { code?: string }).code || '') === '23505') {
        return res.status(409).json(err(new Error('已有申诉正在处理中，请勿重复提交')));
      }
      throw error;
    }
    await supabase.from('lc_account_notifications').insert({
      profile_id: profile.id,
      type: 'appeal_submitted',
      title: '账号申诉已提交',
      content: '管理员可以在后台查看你的说明。处理结果会通过站内通知同步。',
      action_url: '/account-status',
      related_type: 'account_appeal',
      related_id: data.id,
    });
    await logSecurityEvent(req, {
      action: 'account_appeal_submitted',
      actorId: profile.id,
      actorRole: profileAuthRole(profile),
      targetType: 'account_appeal',
      targetId: data.id,
      metadata: { restriction_id: restriction.id, evidence_count: evidenceUrls.length },
    });
    res.status(201).json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
  },
);

async function getOptionalCreatorId(req: express.Request) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { creatorId?: string; sessionVersion?: number };
    if (!decoded.creatorId) return null;
    const { data: profile, error } = await supabase.from('lc_profiles')
      .select('id, is_banned, merged_into, restriction_scope, restriction_ends_at, session_version')
      .eq('id', decoded.creatorId)
      .maybeSingle();
    if (error || !profile) return null;
    const decision = accountAccessDecision(profile as AccountRestrictionProfile, 'GET');
    if (!decision.allowed || decision.state === 'merged') return null;
    return authSessionMatches(decoded.sessionVersion, profile.session_version) ? decoded.creatorId : null;
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
  const safe = isOwner ? { ...profile } : publicProfileAllowlist(profile);
  if (isOwner) {
    safe.has_password = Boolean(profile.password_hash);
    delete safe.password_hash;
  }
  safe.tags = publicStringArray(profile.tags);
  safe.available_cities = publicStringArray(profile.available_cities);
  safe.preferred_story_lines = publicStringArray(profile.preferred_story_lines);
  safe.identity_roles = profileIdentityRoles(profile);
  safe.social_links = publicRecord(profile.social_links);
  safe.social_snapshots = publicRecord(profile.social_snapshots);
  safe.is_realname = Boolean(profile.is_realname);
  safe.verified_dm = Boolean(profile.verified_dm);
  safe.verified_shop = Boolean(profile.verified_shop);
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

function signProfileAuthToken(profile: Record<string, unknown>, authClient: AuthClientChannel = 'web') {
  return jwt.sign({
    creatorId: String(profile.id),
    role: profileAuthRole(profile),
    sessionVersion: sessionVersionOf(profile.session_version),
    authClient,
  }, JWT_SECRET, { expiresIn: '7d' });
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
  bio?: string | null;
  phone?: string | null;
  phone_verified_at?: string | null;
  email?: string | null;
  email_verified_at?: string | null;
  gender?: string | null;
  city?: string | null;
  available_cities?: string[] | null;
  role?: string | null;
  role_type?: string | null;
  identity_roles?: string[] | null;
  verified_dm?: boolean | null;
  verified_shop?: boolean | null;
  referral_code?: string | null;
  community_role?: string | null;
  community_role_expires_at?: string | null;
  wechat_mini_openid?: string | null;
  wechat_unionid?: string | null;
  reputation_identity_id?: string | null;
  profile_setup_completed?: boolean | null;
};

async function getAuthedProfile(req: express.Request): Promise<AuthedProfile | null> {
  const creatorId = getReq(req, 'creatorId');
  const { data } = await supabase.from('lc_profiles')
    .select('id, display_name, is_realname, balance, paid_balance, bonus_balance, is_banned, ban_reason, avatar, bio, phone, phone_verified_at, email, email_verified_at, gender, city, available_cities, role, role_type, identity_roles, verified_dm, verified_shop, referral_code, community_role, community_role_expires_at, wechat_mini_openid, wechat_unionid, reputation_identity_id, profile_setup_completed')
    .eq('id', creatorId)
    .single();
  return data as AuthedProfile | null;
}

function getSpeakBlockReason(profile: {
  phone_verified_at?: string | null;
  email_verified_at?: string | null;
  profile_setup_completed?: boolean | null;
} | null) {
  if (!profile) return '用户不存在';
  const setupBlock = profileSetupBlockReason(profile);
  if (setupBlock) return setupBlock;
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

type DailyCheckinClaimResult = {
  checkin_id: string;
  checkin_date: string;
  streak: number;
  daily_reward: number;
  streak_bonus: number;
  reward: number;
  balance: number;
  bonus_balance: number;
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

type DmGiftRpcResult = {
  gift_id: string;
  transaction_id: string;
  income_entry_id: string;
  balance: number;
  paid_balance: number;
  bonus_balance: number;
  gross_amount: number;
  platform_fee: number;
  receiver_amount: number;
  available_at: string;
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
    description: '受邀注册额外赠送 10 榜金',
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
    description: '邀请好友完成手机号验证奖励 10 榜金',
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
    description: '邀请好友完成有效互动奖励 20 榜金',
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
type ReportTargetType =
  | 'carpool'
  | 'ranking'
  | 'comment'
  | 'commission'
  | 'profile'
  | 'dm_affiliation'
  | 'dossier'
  | 'dossier_image'
  | 'dm_rating'
  | 'store_rating'
  | 'role_rating'
  | 'rating_reply'
  | 'provider_listing'
  | 'guide'
  | 'service'
  | 'portfolio'
  | 'portfolio_image';
const REPORT_TARGET_TYPES: ReportTargetType[] = [
  'carpool',
  'ranking',
  'comment',
  'commission',
  'profile',
  'dm_affiliation',
  'dossier',
  'dossier_image',
  'dm_rating',
  'store_rating',
  'role_rating',
  'rating_reply',
  'provider_listing',
  'guide',
  'service',
  'portfolio',
  'portfolio_image',
];
type ModerationDecision = 'safe' | 'hide' | 'needs_more_evidence' | 'privacy_risk' | 'legal_risk' | 'duplicate' | 'unclear';
const MODERATION_DECISIONS: ModerationDecision[] = ['safe', 'hide', 'needs_more_evidence', 'privacy_risk', 'legal_risk', 'duplicate', 'unclear'];

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

function makeWechatBindAuthorizeUrl(profileId: string, redirectPath: string) {
  const state = jwt.sign({
    kind: 'lc_wechat_bind',
    profileId,
    redirectPath,
  }, JWT_SECRET, { expiresIn: '10m' });
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
  if (!Number.isInteger(amount) || amount < 10) throw new Error('充值最低 10 榜金');
  if (amount > 500) throw new Error('单次充值最多 500 榜金');
  return amount;
}

function makePaymentExpiresAt(date = new Date()) {
  return new Date(date.getTime() + PAYMENT_ORDER_TTL_MINUTES * 60 * 1000);
}

function formatWechatPayTimeExpire(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function makeAlipayPayUrl(outTradeNo: string, amount: number) {
  const subject = `剧幕录榜金充值 ${amount}`;
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
    WECHAT_PAY_PUBLIC_KEY &&
    WECHAT_PAY_NOTIFY_URL,
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
  return `剧幕录榜金充值 ${amount}`;
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

function makeServicePayOrderNo() {
  return `JMLS${Date.now()}${randomInt(10000, 100000)}`;
}

async function createWechatPayMiniappOrder(input: {
  outTradeNo: string;
  productType: ServiceProductType;
  openid: string;
  expiresAt: Date;
}) {
  const description = serviceProductDescription(input.productType);
  const data = await wechatPayRequest<{ prepay_id?: string }>('POST', '/v3/pay/transactions/jsapi', {
    appid: WECHAT_PAY_APP_ID,
    mchid: WECHAT_PAY_MCH_ID,
    description,
    out_trade_no: input.outTradeNo,
    time_expire: formatWechatPayTimeExpire(input.expiresAt),
    notify_url: WECHAT_PAY_NOTIFY_URL,
    attach: 'jumulu_service_purchase',
    amount: {
      total: SERVICE_FEE_FEN,
      currency: 'CNY',
    },
    payer: {
      openid: input.openid,
    },
  });
  if (!data?.prepay_id) throw new Error('微信支付未返回预支付信息');
  return {
    prepayId: data.prepay_id,
    payParams: createMiniappPaymentParams({
      appId: WECHAT_PAY_APP_ID,
      prepayId: data.prepay_id,
      privateKey: WECHAT_PAY_PRIVATE_KEY,
    }),
    description,
  };
}

type ServicePurchaseRow = {
  id: string;
  profile_id: string;
  product_type: ServiceProductType;
  target_id: string;
  amount_fen: number;
  status: 'unpaid' | 'paid' | 'refunded';
  paid_at?: string | null;
  refunded_at?: string | null;
};

type ServicePaymentAttemptRow = {
  id: string;
  purchase_id: string;
  out_trade_no: string;
  prepay_id?: string | null;
  amount_fen: number;
  status: 'created' | 'paid' | 'failed' | 'expired' | 'duplicate_paid' | 'refunded';
  expires_at: string;
  paid_at?: string | null;
};

function publicServicePurchase(purchase: ServicePurchaseRow, extra: Record<string, unknown> = {}) {
  return {
    id: purchase.id,
    product_type: purchase.product_type,
    target_id: purchase.target_id,
    amount_fen: SERVICE_FEE_FEN,
    amount_yuan: SERVICE_FEE_YUAN,
    status: purchase.status,
    paid: servicePurchaseGrantsAccess(purchase.status),
    paid_at: purchase.paid_at || null,
    refunded_at: purchase.refunded_at || null,
    ...extra,
  };
}

async function findServicePurchase(profileId: string, productType: ServiceProductType, targetId: string) {
  const result = await supabase.from('lc_service_purchases')
    .select('*')
    .eq('profile_id', profileId)
    .eq('product_type', productType)
    .eq('target_id', targetId)
    .maybeSingle();
  if (result.error && !isMissingRelation(result.error, 'lc_service_purchases')) throw result.error;
  return result.error ? null : result.data as ServicePurchaseRow | null;
}

async function ensureServicePurchase(profileId: string, productType: ServiceProductType, targetId: string) {
  const existing = await findServicePurchase(profileId, productType, targetId);
  if (existing) return existing;
  const result = await supabase.from('lc_service_purchases').insert({
    profile_id: profileId,
    product_type: productType,
    target_id: targetId,
    amount_fen: SERVICE_FEE_FEN,
    status: 'unpaid',
  }).select('*').single();
  if (result.error) {
    if (result.error.code === '23505') {
      const raced = await findServicePurchase(profileId, productType, targetId);
      if (raced) return raced;
    }
    if (isMissingRelation(result.error, 'lc_service_purchases')) throw new Error('付费服务数据表尚未初始化');
    throw result.error;
  }
  return result.data as ServicePurchaseRow;
}

async function paidServicePurchase(profileId: string, productType: ServiceProductType, targetId: string) {
  const purchase = await findServicePurchase(profileId, productType, targetId);
  return purchase && servicePurchaseGrantsAccess(purchase.status) ? purchase : null;
}

async function providerBusinessContact(providerId: string) {
  const result = await supabase.from('lc_provider_contacts')
    .select('business_contact, is_available, reviewed_at, updated_at')
    .eq('profile_id', providerId)
    .maybeSingle();
  if (result.error && !isMissingRelation(result.error, 'lc_provider_contacts')) throw result.error;
  return result.error ? null : result.data;
}

async function servicePurchaseStatusPayload(purchase: ServicePurchaseRow) {
  if (purchase.product_type !== 'provider_contact' || !servicePurchaseGrantsAccess(purchase.status)) {
    return publicServicePurchase(purchase);
  }
  const contact = await providerBusinessContact(purchase.target_id);
  return publicServicePurchase(purchase, {
    contact_available: Boolean(contact?.is_available && contact?.business_contact),
    business_contact: contact?.is_available ? cleanText(contact.business_contact, 300) || null : null,
    contact_updated_at: contact?.updated_at || null,
  });
}

async function validateServicePurchaseTarget(profile: AuthedProfile, productType: ServiceProductType, requestedTargetId: string) {
  if (productType === 'provider_listing') return profile.id;
  if (!/^[0-9a-f-]{36}$/i.test(requestedTargetId)) throw Object.assign(new Error('付费服务对象不正确'), { statusCode: 400 });
  if (productType === 'dossier_claim') {
    const result = await supabase.from('lc_dm_dossiers')
      .select('id, status, claim_status, claimed_by')
      .eq('id', requestedTargetId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data || result.data.status !== 'approved') throw Object.assign(new Error('档案不存在或尚未公开'), { statusCode: 404 });
    if (result.data.claim_status === 'approved' && result.data.claimed_by !== profile.id) {
      throw Object.assign(new Error('这个档案已经被认领'), { statusCode: 409 });
    }
    if (result.data.claim_status === 'pending' && result.data.claimed_by !== profile.id) {
      throw Object.assign(new Error('这份档案已有认领申请正在审核'), { statusCode: 409 });
    }
    return requestedTargetId;
  }
  if (requestedTargetId === profile.id) throw Object.assign(new Error('不能付费解锁自己的联系方式'), { statusCode: 400 });
  const [listingResult, contact] = await Promise.all([
    supabase.from('lc_provider_listings')
      .select('profile_id, is_active')
      .eq('profile_id', requestedTargetId)
      .eq('is_active', true)
      .maybeSingle(),
    providerBusinessContact(requestedTargetId),
  ]);
  if (listingResult.error) throw listingResult.error;
  if (!listingResult.data) throw Object.assign(new Error('这位委托师当前没有公开委托条'), { statusCode: 404 });
  if (!contact?.is_available || !cleanText(contact.business_contact, 300)) {
    throw Object.assign(new Error('这位委托师暂未开放联系方式'), { statusCode: 409 });
  }
  return requestedTargetId;
}

async function confirmServicePayment(input: {
  outTradeNo: string;
  transactionId: string;
  totalFee: number;
  currency: string;
  appId: string;
  mchId: string;
  payerOpenid: string;
  payload: Record<string, unknown>;
}) {
  assertServicePaymentEnvelope({
    appId: input.appId,
    mchId: input.mchId,
    currency: input.currency,
    payerOpenid: input.payerOpenid,
    expectedAppId: WECHAT_PAY_APP_ID,
    expectedMchId: WECHAT_PAY_MCH_ID,
  });
  if (useTencentPg) {
    const client = await tencentPgPool.connect();
    try {
      await client.query('begin');
      const attemptResult = await client.query<ServicePaymentAttemptRow & { profile_id: string; product_type: ServiceProductType; target_id: string; purchase_status: string; wechat_mini_openid: string | null }>(
        `select attempt.*,
                purchase.profile_id,
                purchase.product_type,
                purchase.target_id,
                purchase.status as purchase_status,
                profile.wechat_mini_openid
           from lc_service_payment_attempts attempt
           join lc_service_purchases purchase on purchase.id = attempt.purchase_id
           join lc_profiles profile on profile.id = purchase.profile_id
          where attempt.out_trade_no = $1
          for update of attempt, purchase`,
        [input.outTradeNo],
      );
      const attempt = attemptResult.rows[0];
      if (!attempt) {
        await client.query('rollback');
        return null;
      }
      assertServicePaymentOwnership({
        totalFee: input.totalFee,
        attemptAmountFen: Number(attempt.amount_fen),
        payerOpenid: input.payerOpenid,
        expectedPayerOpenid: attempt.wechat_mini_openid,
      });
      if (attempt.status === 'paid' || attempt.status === 'duplicate_paid') {
        await client.query('commit');
        return { ...attempt, newlyPaid: false, duplicatePaid: attempt.status === 'duplicate_paid' };
      }
      const duplicatePaid = attempt.purchase_status === 'paid';
      await client.query(
        `update lc_service_payment_attempts
            set status = $2,
                wechat_transaction_id = $3,
                notify_payload = $4::jsonb,
                paid_at = now(),
                updated_at = now()
          where id = $1`,
        [attempt.id, duplicatePaid ? 'duplicate_paid' : 'paid', input.transactionId, JSON.stringify(input.payload)],
      );
      if (!duplicatePaid) {
        await client.query(
          `update lc_service_purchases
              set status = 'paid',
                  paid_attempt_id = $2,
                  paid_at = now(),
                  refunded_at = null,
                  refund_reason = null,
                  updated_at = now()
            where id = $1`,
          [attempt.purchase_id, attempt.id],
        );
      }
      await client.query('commit');
      return { ...attempt, newlyPaid: !duplicatePaid, duplicatePaid };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  const attemptResult = await supabase.from('lc_service_payment_attempts')
    .select('*')
    .eq('out_trade_no', input.outTradeNo)
    .maybeSingle();
  if (attemptResult.error && !isMissingRelation(attemptResult.error, 'lc_service_payment_attempts')) throw attemptResult.error;
  const attempt = attemptResult.error ? null : attemptResult.data as ServicePaymentAttemptRow | null;
  if (!attempt) return null;
  const purchaseResult = await supabase.from('lc_service_purchases')
    .select('*, lc_profiles!profile_id(wechat_mini_openid)')
    .eq('id', attempt.purchase_id)
    .single();
  if (purchaseResult.error) throw purchaseResult.error;
  const purchase = purchaseResult.data as ServicePurchaseRow;
  const purchaseProfile = (purchaseResult.data as Record<string, unknown>).lc_profiles as { wechat_mini_openid?: string | null } | null;
  assertServicePaymentOwnership({
    totalFee: input.totalFee,
    attemptAmountFen: Number(attempt.amount_fen),
    payerOpenid: input.payerOpenid,
    expectedPayerOpenid: purchaseProfile?.wechat_mini_openid || null,
  });
  if (attempt.status === 'paid' || attempt.status === 'duplicate_paid') {
    return { ...attempt, profile_id: purchase.profile_id, product_type: purchase.product_type, target_id: purchase.target_id, newlyPaid: false, duplicatePaid: attempt.status === 'duplicate_paid' };
  }
  const duplicatePaid = purchase.status === 'paid';
  const attemptUpdate = await supabase.from('lc_service_payment_attempts').update({
    status: duplicatePaid ? 'duplicate_paid' : 'paid',
    wechat_transaction_id: input.transactionId,
    notify_payload: input.payload,
    paid_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', attempt.id);
  if (attemptUpdate.error) throw attemptUpdate.error;
  if (!duplicatePaid) {
    const purchaseUpdate = await supabase.from('lc_service_purchases').update({
      status: 'paid',
      paid_attempt_id: attempt.id,
      paid_at: new Date().toISOString(),
      refunded_at: null,
      refund_reason: null,
      updated_at: new Date().toISOString(),
    }).eq('id', purchase.id);
    if (purchaseUpdate.error) throw purchaseUpdate.error;
  }
  return { ...attempt, profile_id: purchase.profile_id, product_type: purchase.product_type, target_id: purchase.target_id, newlyPaid: !duplicatePaid, duplicatePaid };
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
  const raw = cleanText(value, Math.max(max, 4000));
  if (!raw || OPTIONAL_URL_PLACEHOLDERS.has(raw)) return '';
  if (allowUploadPath && /^\/uploads\/[A-Za-z0-9%_./-]+(?:\?[^\s]*)?$/i.test(raw)) return raw;
  return extractSharedUrl(raw, max);
}

function normalizeImageFocus(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(cleanText(value, 20));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, Math.round(parsed * 100) / 100));
}

function normalizeProfileSocialLinks(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((result, [key, raw]) => {
    const safeKey = cleanText(key, 40).toLowerCase();
    if (!['douyin', 'xiaohongshu', 'weibo', 'dianping'].includes(safeKey)) return result;
    const url = normalizeOptionalPublicUrl(raw, 1000);
    if (url) result[safeKey] = url;
    return result;
  }, {});
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
  | 'dossier_update'
  | 'provider_listing_update'
  | 'service_create'
  | 'portfolio_create'
  | 'availability_create'
  | 'tag_create'
  | 'script_rating_upsert'
  | 'entity_rating_upsert'
  | 'rating_discussion_create';

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
  created_at?: string | null;
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

const DOSSIER_EDIT_FIELD_LABELS: Record<string, string> = {
  dm_name: '名称',
  city: '城市',
  workplace: '店家 / 地址',
  employment_status: '受雇状态',
  employer_store_id: '受雇店家',
  profile_url: '主页链接',
  photo_url: '封面照片',
  photo_files: '照片图库',
  note: '档案说明',
  tags: '标签',
  dm_started_month: 'DM 入行时间',
  birth_year: '出生年份',
  height_cm: '身高',
  weight_kg: '体重',
  bio: '人物简介',
  common_scripts: '常开剧本',
  career_history: '任职履历',
  related_profiles: '圈人',
  related_stores: '圈店',
  mbti: 'MBTI',
  zodiac: '星座',
};

const DM_MBTI_VALUES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;
const DM_ZODIAC_VALUES = [
  '白羊座', '金牛座', '双子座', '巨蟹座',
  '狮子座', '处女座', '天秤座', '天蝎座',
  '射手座', '摩羯座', '水瓶座', '双鱼座',
] as const;
const DOSSIER_CITY_VALUES = new Set(CITIES);
const DOSSIER_SENSITIVE_FIELDS_FOR_REVIEW = new Set(['birth_year', 'height_cm', 'weight_kg']);

function normalizeDmPersonalityValue(value: unknown, allowed: readonly string[], label: string) {
  const normalized = cleanText(value, 20);
  if (!normalized) return null;
  if (!allowed.includes(normalized)) throw new Error(`${label}选项无效`);
  return normalized;
}

const DM_AFFILIATION_EDIT_FIELDS = new Set(['workplace', 'employment_status', 'employer_store_id']);
const DOSSIER_JSONB_EDIT_FIELDS = new Set(['photo_files', 'common_scripts', 'career_history', 'related_profiles', 'related_stores']);

function dossierEditComparableValue(field: string, value: unknown) {
  return dossierFieldComparableValue(field, value);
}

function dossierEditAdminBlockReason(payload: Record<string, unknown>, now = new Date()) {
  const status = effectiveDossierOwnerResponseStatus({
    status: cleanText(payload.owner_response_status, 40),
    dueAt: cleanText(payload.owner_response_due_at, 80),
    now,
  });
  if (status !== 'pending') return '';
  const dueAt = cleanText(payload.owner_response_due_at, 80);
  return dueAt ? `仍在等待认领人确认，截止时间为 ${dueAt}` : '仍在等待认领人确认';
}

async function applyDossierUpdateReview(
  review: PublicReviewRecord,
  payload: Record<string, unknown>,
  reviewerId: string | null,
) {
  const dossierId = cleanText(payload.dossier_id, 80);
  const entityType = cleanText(payload.entity_type, 20) === 'store' ? 'store' : 'dm';
  const patch = objectPayload(payload.patch);
  const beforeSnapshot = objectPayload(payload.before_snapshot);
  if (!dossierId || Object.keys(patch).length === 0) throw new Error('档案修改审核缺少必要数据');
  const blockReason = dossierEditAdminBlockReason(payload);
  if (blockReason) throw new Error(blockReason);

  const { data: dossier, error: dossierErr } = await supabase.from('lc_dm_dossiers')
    .select('*')
    .eq('id', dossierId)
    .eq('entity_type', entityType)
    .eq('status', 'approved')
    .maybeSingle();
  if (dossierErr) throw dossierErr;
  if (!dossier) throw new Error(entityType === 'store' ? '店家档案不存在或已下架' : 'DM档案不存在或已下架');

  const originalOwnerId = cleanText(payload.owner_profile_id, 80);
  const currentOwnerId = dossier.claim_status === 'approved' ? cleanText(dossier.claimed_by, 80) : '';
  if (currentOwnerId && currentOwnerId !== originalOwnerId && currentOwnerId !== cleanText(review.profile_id, 80)) {
    throw new Error('档案认领人已经变化，需要由新认领人重新确认');
  }

  const effectiveOwnerStatus = effectiveDossierOwnerResponseStatus({
    status: cleanText(payload.owner_response_status, 40),
    dueAt: cleanText(payload.owner_response_due_at, 80),
  });
  const consentResult = dossierPatchForOwnerConsent(patch, {
    submitterIsOwner: Boolean(payload.submitter_is_owner),
    ownerResponseStatus: effectiveOwnerStatus,
  });
  if (Object.keys(consentResult.appliedPatch).length === 0 && consentResult.omittedSensitiveFields.length > 0) {
    throw new Error('照片、主页链接及个人资料必须由 DM 本人明确同意后才能公开');
  }

  let payloadChanged = false;
  if (effectiveOwnerStatus === 'expired' && payload.owner_response_status !== 'expired') {
    payload.owner_response_status = 'expired';
    payload.owner_responded_at = null;
    payloadChanged = true;
  }
  if (consentResult.omittedSensitiveFields.length > 0) {
    payload.omitted_sensitive_fields = consentResult.omittedSensitiveFields;
    payloadChanged = true;
  }
  if (payloadChanged) {
    const payloadUpdate = await supabase.from('lc_public_reviews').update({ payload, updated_at: new Date().toISOString() }).eq('id', review.id);
    if (payloadUpdate.error) throw payloadUpdate.error;
  }

  const allowedFields = Object.keys(DOSSIER_EDIT_FIELD_LABELS);
  const safePatch: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (!(field in consentResult.appliedPatch)) continue;
    if (dossierEditComparableValue(field, dossier[field]) === dossierEditComparableValue(field, consentResult.appliedPatch[field])) {
      continue;
    }
    if (dossierEditComparableValue(field, dossier[field]) !== dossierEditComparableValue(field, beforeSnapshot[field])) {
      throw new Error(`${DOSSIER_EDIT_FIELD_LABELS[field]}已被其他审核更新，请重新提交修改`);
    }
    safePatch[field] = consentResult.appliedPatch[field];
  }
  if (Object.keys(safePatch).length === 0) return;
  const nowIso = new Date().toISOString();
  const fieldSource = payload.submission_source === 'owner' ? 'owner' : 'community';
  const fieldProvenance = stampDossierFieldProvenance({
    current: dossier.field_provenance,
    fields: Object.keys(safePatch),
    source: fieldSource,
    actorId: cleanText(review.profile_id, 80) || null,
    updatedAt: nowIso,
  });
  if ('photo_files' in safePatch) {
    const photos = normalizeDossierPhotoSubmission(
      safePatch.photo_files,
      safePatch.photo_url ?? dossier.photo_url,
      entityType === 'store' ? '店家' : 'DM',
    );
    const cover = photos[0] || null;
    safePatch.photo_files = photos;
    safePatch.photo_url = cover?.url || null;
    safePatch.photo_focus_x = cover?.focus_x ?? 50;
    safePatch.photo_focus_y = cover?.focus_y ?? 25;
  } else if ('photo_url' in safePatch) {
    safePatch.photo_files = safePatch.photo_url
      ? [{ name: `${entityType === 'store' ? '店家' : 'DM'}照片`, url: safePatch.photo_url, type: 'image/*', focus_x: 50, focus_y: 25 }]
      : [];
  }

  const employmentFieldsTouched = entityType === 'dm'
    && Object.keys(safePatch).some(field => DM_AFFILIATION_EDIT_FIELDS.has(field));
  if (employmentFieldsTouched) {
    const requestedEmploymentStatus = cleanText(
      safePatch.employment_status ?? dossier.employment_status,
      40,
    ) || 'unknown';
    const requestedStoreId = cleanText(
      safePatch.employer_store_id ?? dossier.employer_store_id,
      80,
    );
    if (!['store_affiliated', 'freelance', 'unknown'].includes(requestedEmploymentStatus)) {
      throw new Error('任职状态无效，请重新提交修改');
    }
    if (requestedEmploymentStatus === 'store_affiliated' && !requestedStoreId) {
      throw new Error('任职店家信息不完整，请重新提交修改');
    }

    const now = nowIso;
    const requestReason = cleanText(
      `档案修改审核通过：${cleanText(payload.edit_reason, 420) || '社区用户补充任职信息'}（审核单 ${review.id}）`,
      500,
    );
    const affiliationPatch: Record<string, unknown> = {};
    const regularPatch = { ...safePatch };
    for (const field of DM_AFFILIATION_EDIT_FIELDS) {
      if (field in regularPatch) {
        affiliationPatch[field] = regularPatch[field];
        delete regularPatch[field];
      }
    }

    if (useTencentPg) {
      const client = await tencentPgPool.connect();
      try {
        await client.query('BEGIN');
        const lockedResult = await client.query(
          `select * from lc_dm_dossiers
            where id = $1 and entity_type = 'dm' and status = 'approved'
            for update`,
          [dossierId],
        );
        const lockedDossier = lockedResult.rows[0] as Record<string, unknown> | undefined;
        if (!lockedDossier) throw new Error('DM档案不存在或已下架');
        const lockedOwnerId = lockedDossier.claim_status === 'approved'
          ? cleanText(lockedDossier.claimed_by, 80)
          : '';
        if (lockedOwnerId && lockedOwnerId !== originalOwnerId && lockedOwnerId !== cleanText(review.profile_id, 80)) {
          throw new Error('档案认领人已经变化，需要由新认领人重新确认');
        }
        for (const field of Object.keys(consentResult.appliedPatch)) {
          if (dossierEditComparableValue(field, lockedDossier[field]) === dossierEditComparableValue(field, consentResult.appliedPatch[field])) {
            continue;
          }
          if (dossierEditComparableValue(field, lockedDossier[field]) !== dossierEditComparableValue(field, beforeSnapshot[field])) {
            throw new Error(`${DOSSIER_EDIT_FIELD_LABELS[field] || field}已被其他审核更新，请重新提交修改`);
          }
        }

        const affiliationResult = await client.query(
          `select * from lc_dm_store_affiliations
            where dm_dossier_id = $1 and status in ('pending', 'approved')
            order by created_at desc
            for update`,
          [dossierId],
        );
        const affiliations = affiliationResult.rows as Record<string, unknown>[];
        const pendingAffiliation = affiliations.find(row => row.status === 'pending');
        const approvedAffiliation = affiliations.find(row => row.status === 'approved');

        if (requestedEmploymentStatus === 'store_affiliated') {
          const storeResult = await client.query(
            `select id, dm_name from lc_dm_dossiers
              where id = $1 and entity_type = 'store' and status = 'approved'`,
            [requestedStoreId],
          );
          const store = storeResult.rows[0] as Record<string, unknown> | undefined;
          if (!store) throw new Error('选择的任职店家不存在或尚未公开');
          if (pendingAffiliation && String(pendingAffiliation.store_dossier_id || '') !== requestedStoreId) {
            throw new Error('已有另一条任职确认申请正在处理，请处理后再审核这次修改');
          }
          if (String(approvedAffiliation?.store_dossier_id || '') === requestedStoreId) {
            regularPatch.employment_status = 'store_affiliated';
            regularPatch.employer_store_id = requestedStoreId;
            regularPatch.workplace = store.dm_name || null;
          } else if (!pendingAffiliation) {
            await client.query(
              `insert into lc_dm_store_affiliations (
                  dm_dossier_id, store_dossier_id, dm_profile_id,
                  requested_by_profile_id, requested_by_role, request_kind,
                  request_note, status, created_at, updated_at
                ) values ($1, $2, $3, $4, 'admin', $5, $6, 'pending', $7, $7)`,
              [
                dossierId,
                requestedStoreId,
                lockedOwnerId || null,
                reviewerId,
                approvedAffiliation ? 'change' : 'join',
                requestReason,
                now,
              ],
            );
          }
        } else {
          await client.query(
            `update lc_dm_store_affiliations
                set status = case when status = 'approved' then 'ended' else 'cancelled' end,
                    ended_at = $2, ended_by_profile_id = $3,
                    end_reason = $4, updated_at = $2
              where dm_dossier_id = $1 and status in ('approved', 'pending')`,
            [dossierId, now, reviewerId, requestReason],
          );
          Object.assign(regularPatch, affiliationPatch);
        }

        const patchEntries = Object.entries(regularPatch);
        if (patchEntries.length > 0) {
          regularPatch.field_provenance = stampDossierFieldProvenance({
            current: lockedDossier.field_provenance,
            fields: Object.keys(regularPatch),
            source: fieldSource,
            actorId: cleanText(review.profile_id, 80) || null,
            updatedAt: now,
          });
        }
        if (Object.keys(regularPatch).length > 0) {
          const patchEntries = Object.entries(regularPatch);
          const values: unknown[] = [dossierId];
          const assignments = patchEntries.map(([field, value]) => {
            values.push(DOSSIER_JSONB_EDIT_FIELDS.has(field) || field === 'field_provenance' ? JSON.stringify(value) : value);
            const cast = DOSSIER_JSONB_EDIT_FIELDS.has(field) || field === 'field_provenance' ? '::jsonb' : field === 'tags' ? '::text[]' : '';
            return `${field} = $${values.length}${cast}`;
          });
          values.push(now);
          assignments.push(`updated_at = $${values.length}`);
          await client.query(
            `update lc_dm_dossiers set ${assignments.join(', ')} where id = $1 and status = 'approved'`,
            values,
          );
        }
        await client.query('COMMIT');
        return;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    const affiliationResult = await supabase.from('lc_dm_store_affiliations')
      .select('*')
      .eq('dm_dossier_id', dossierId)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false });
    if (affiliationResult.error && !isMissingRelation(affiliationResult.error, 'lc_dm_store_affiliations')) {
      throw affiliationResult.error;
    }
    const affiliations = affiliationResult.error ? [] : (affiliationResult.data || []) as Record<string, unknown>[];
    const pendingAffiliation = affiliations.find(row => row.status === 'pending');
    const approvedAffiliation = affiliations.find(row => row.status === 'approved');
    if (requestedEmploymentStatus === 'store_affiliated') {
      const storeResult = await supabase.from('lc_dm_dossiers')
        .select('id, dm_name')
        .eq('id', requestedStoreId)
        .eq('entity_type', 'store')
        .eq('status', 'approved')
        .maybeSingle();
      if (storeResult.error) throw storeResult.error;
      if (!storeResult.data) throw new Error('选择的任职店家不存在或尚未公开');
      if (pendingAffiliation && String(pendingAffiliation.store_dossier_id || '') !== requestedStoreId) {
        throw new Error('已有另一条任职确认申请正在处理，请处理后再审核这次修改');
      }
      if (String(approvedAffiliation?.store_dossier_id || '') === requestedStoreId) {
        regularPatch.employment_status = 'store_affiliated';
        regularPatch.employer_store_id = requestedStoreId;
        regularPatch.workplace = storeResult.data.dm_name || null;
      } else if (!pendingAffiliation) {
        const insertResult = await supabase.from('lc_dm_store_affiliations').insert({
          dm_dossier_id: dossierId,
          store_dossier_id: requestedStoreId,
          dm_profile_id: currentOwnerId || null,
          requested_by_profile_id: reviewerId,
          requested_by_role: 'admin',
          request_kind: approvedAffiliation ? 'change' : 'join',
          request_note: requestReason,
          status: 'pending',
          created_at: now,
          updated_at: now,
        });
        if (insertResult.error) throw insertResult.error;
      }
    } else {
      if (!affiliationResult.error) {
        const pendingUpdate = await supabase.from('lc_dm_store_affiliations').update({
          status: 'cancelled', ended_at: now, ended_by_profile_id: reviewerId,
          end_reason: requestReason, updated_at: now,
        }).eq('dm_dossier_id', dossierId).eq('status', 'pending');
        if (pendingUpdate.error) throw pendingUpdate.error;
        const approvedUpdate = await supabase.from('lc_dm_store_affiliations').update({
          status: 'ended', ended_at: now, ended_by_profile_id: reviewerId,
          end_reason: requestReason, updated_at: now,
        }).eq('dm_dossier_id', dossierId).eq('status', 'approved');
        if (approvedUpdate.error) throw approvedUpdate.error;
      }
      Object.assign(regularPatch, affiliationPatch);
    }
    if (Object.keys(regularPatch).length > 0) {
      const updateResult = await supabase.from('lc_dm_dossiers').update({
        ...regularPatch,
        field_provenance: stampDossierFieldProvenance({
          current: dossier.field_provenance,
          fields: Object.keys(regularPatch),
          source: fieldSource,
          actorId: cleanText(review.profile_id, 80) || null,
          updatedAt: now,
        }),
        updated_at: now,
      }).eq('id', dossierId).eq('status', 'approved');
      if (updateResult.error) throw updateResult.error;
    }
    return;
  }

  const { error: updateErr } = await supabase.from('lc_dm_dossiers').update({
    ...safePatch,
    field_provenance: fieldProvenance,
    updated_at: nowIso,
  }).eq('id', dossierId).eq('status', 'approved');
  if (updateErr) throw updateErr;
}

function dossierReviewPartitions(payload: Record<string, unknown>) {
  const fallback = partitionDossierEditPatch(objectPayload(payload.patch));
  return {
    noAdminReviewPatch: Object.keys(objectPayload(payload.no_admin_review_patch)).length > 0
      ? objectPayload(payload.no_admin_review_patch)
      : fallback.noAdminReviewPatch,
    postAdminReviewPatch: Object.keys(objectPayload(payload.post_admin_review_patch)).length > 0
      ? objectPayload(payload.post_admin_review_patch)
      : fallback.postAdminReviewPatch,
    preAdminReviewPatch: Object.keys(objectPayload(payload.pre_admin_review_patch)).length > 0
      ? objectPayload(payload.pre_admin_review_patch)
      : fallback.preAdminReviewPatch,
  };
}

async function applyDossierPatchSubset(
  review: PublicReviewRecord,
  payload: Record<string, unknown>,
  patch: Record<string, unknown>,
  reviewerId: string | null,
) {
  if (Object.keys(patch).length === 0) return;
  const subsetPayload = {
    ...payload,
    patch,
    changed_fields: Object.keys(patch),
    submitter_is_owner: true,
    owner_response_status: 'agreed',
  };
  await applyDossierUpdateReview({ ...review, payload: subsetPayload }, subsetPayload, reviewerId);
}

async function advanceDossierReviewAfterOwner(
  review: PublicReviewRecord,
  payload: Record<string, unknown>,
  ownerStatus: 'agreed' | 'expired',
  reviewerId: string | null,
  now = new Date(),
) {
  const partitions = dossierReviewPartitions(payload);
  const submitterIsOwner = Boolean(payload.submitter_is_owner);
  const consentInput = { submitterIsOwner, ownerResponseStatus: ownerStatus };
  const immediateConsent = dossierPatchForOwnerConsent({
    ...partitions.noAdminReviewPatch,
    ...partitions.postAdminReviewPatch,
  }, consentInput);
  const preReviewConsent = dossierPatchForOwnerConsent(partitions.preAdminReviewPatch, consentInput);
  const omittedSensitiveFields = Array.from(new Set([
    ...immediateConsent.omittedSensitiveFields,
    ...preReviewConsent.omittedSensitiveFields,
  ]));
  const appliedImmediatePatch = immediateConsent.appliedPatch;
  const appliedPostReviewPatch = Object.fromEntries(Object.entries(partitions.postAdminReviewPatch)
    .filter(([field]) => Object.prototype.hasOwnProperty.call(appliedImmediatePatch, field)));
  const pendingPreReviewPatch = preReviewConsent.appliedPatch;

  await applyDossierPatchSubset(review, payload, appliedImmediatePatch, reviewerId);

  const mode = dossierAdminReviewMode({
    preAdminReviewPatch: pendingPreReviewPatch,
    postAdminReviewPatch: appliedPostReviewPatch,
  });
  const pendingChangedFields = Array.from(new Set([
    ...Object.keys(appliedPostReviewPatch),
    ...Object.keys(pendingPreReviewPatch),
  ]));
  payload.owner_response_status = ownerStatus;
  payload.owner_response_due_at = ownerStatus === 'agreed' ? null : payload.owner_response_due_at;
  payload.no_admin_review_patch = partitions.noAdminReviewPatch;
  payload.post_admin_review_patch = appliedPostReviewPatch;
  payload.pre_admin_review_patch = pendingPreReviewPatch;
  payload.patch = pendingPreReviewPatch;
  payload.changed_fields = pendingChangedFields;
  payload.submitted_sensitive_fields = Array.isArray(payload.submitted_sensitive_fields)
    ? payload.submitted_sensitive_fields
    : Array.isArray(payload.sensitive_fields) ? payload.sensitive_fields : [];
  payload.sensitive_fields = pendingChangedFields.filter(field => DOSSIER_SENSITIVE_FIELDS_FOR_REVIEW.has(field));
  payload.applied_immediate_fields = Object.keys(appliedImmediatePatch);
  payload.omitted_sensitive_fields = omittedSensitiveFields;
  payload.review_mode = mode;
  if (Object.keys(appliedPostReviewPatch).length > 0) payload.post_review_applied_at = now.toISOString();

  const pendingAdminReview = mode !== 'none';
  const updateResult = await supabase.from('lc_public_reviews').update({
    payload,
    status: pendingAdminReview ? 'pending' : 'approved',
    reviewed_by: pendingAdminReview ? null : reviewerId,
    reviewed_at: pendingAdminReview ? null : now.toISOString(),
    review_note: pendingAdminReview
      ? null
      : ownerStatus === 'expired'
        ? '认领人在提交后3天内未上线，符合规则的受限字段已自动生效'
        : '认领人确认后，受限字段已按规则生效',
    updated_at: now.toISOString(),
  }).eq('id', review.id).eq('status', 'pending');
  if (updateResult.error) throw updateResult.error;
  return {
    status: pendingAdminReview ? 'pending' as const : 'approved' as const,
    reviewMode: mode,
    appliedImmediateFields: Object.keys(appliedImmediatePatch),
    pendingChangedFields,
    omittedSensitiveFields,
  };
}

async function rollbackDossierPostReview(review: PublicReviewRecord, payload: Record<string, unknown>) {
  const postReviewPatch = objectPayload(payload.post_admin_review_patch);
  if (Object.keys(postReviewPatch).length === 0) return payload;
  const dossierId = cleanText(payload.dossier_id, 80);
  const entityType = cleanText(payload.entity_type, 20) === 'store' ? 'store' : 'dm';
  const beforeSnapshot = objectPayload(payload.before_snapshot);
  const beforeProvenance = normalizeDossierFieldProvenance(payload.before_field_provenance);
  const dossierResult = await supabase.from('lc_dm_dossiers')
    .select('*')
    .eq('id', dossierId)
    .eq('entity_type', entityType)
    .eq('status', 'approved')
    .maybeSingle();
  if (dossierResult.error) throw dossierResult.error;
  if (!dossierResult.data) throw new Error('后审字段对应的档案不存在或已下架');

  const rollbackPatch: Record<string, unknown> = {};
  const skippedFields: string[] = [];
  for (const [field, appliedValue] of Object.entries(postReviewPatch)) {
    if (dossierEditComparableValue(field, dossierResult.data[field]) !== dossierEditComparableValue(field, appliedValue)) {
      skippedFields.push(field);
      continue;
    }
    rollbackPatch[field] = beforeSnapshot[field] ?? null;
  }
  if (Object.keys(rollbackPatch).length > 0) {
    const restoredProvenance = normalizeDossierFieldProvenance(dossierResult.data.field_provenance);
    for (const field of Object.keys(rollbackPatch)) {
      if (beforeProvenance[field]) restoredProvenance[field] = beforeProvenance[field];
      else delete restoredProvenance[field];
    }
    const rollbackResult = await supabase.from('lc_dm_dossiers').update({
      ...rollbackPatch,
      field_provenance: restoredProvenance,
      updated_at: new Date().toISOString(),
    }).eq('id', dossierId).eq('status', 'approved');
    if (rollbackResult.error) throw rollbackResult.error;
  }
  payload.post_review_rolled_back_fields = Object.keys(rollbackPatch);
  payload.post_review_rollback_skipped_fields = skippedFields;
  payload.post_review_rolled_back_at = new Date().toISOString();
  review.payload = payload;
  return payload;
}

let dueDossierOwnerReviewsCheckedAt = 0;

async function processDueDossierOwnerReviews(now = new Date()) {
  if (now.getTime() - dueDossierOwnerReviewsCheckedAt < 30_000) return;
  dueDossierOwnerReviewsCheckedAt = now.getTime();
  const result = await supabase.from('lc_public_reviews')
    .select('*')
    .eq('target_type', 'dossier_update')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200);
  if (result.error && isMissingRelation(result.error, 'lc_public_reviews')) return;
  if (result.error) throw result.error;

  const dueReviews = ((result.data || []) as PublicReviewRecord[]).filter(review => {
    const payload = objectPayload(review.payload);
    if (cleanText(payload.review_mode, 30) !== 'owner') return false;
    if (cleanText(payload.owner_response_status, 40) !== 'pending') return false;
    const dueAt = new Date(cleanText(payload.owner_response_due_at, 80)).getTime();
    return Number.isFinite(dueAt) && dueAt <= now.getTime();
  });
  if (dueReviews.length === 0) return;

  const ownerIds = Array.from(new Set(dueReviews
    .map(review => cleanText(objectPayload(review.payload).owner_profile_id, 80))
    .filter(Boolean)));
  const profileResult = ownerIds.length > 0
    ? await supabase.from('lc_profiles').select('id, last_seen_at').in('id', ownerIds)
    : { data: [], error: null };
  if (profileResult.error) throw profileResult.error;
  const ownerLastSeen = new Map(((profileResult.data || []) as Record<string, unknown>[])
    .map(profile => [cleanText(profile.id, 80), cleanText(profile.last_seen_at, 80)]));

  for (const review of dueReviews) {
    const payload = objectPayload(review.payload);
    const ownerProfileId = cleanText(payload.owner_profile_id, 80);
    const dueAt = cleanText(payload.owner_response_due_at, 80);
    const ownerWasOnline = ownerLoggedInDuringDossierResponseWindow({
      createdAt: review.created_at,
      dueAt,
      ownerLastSeenAt: ownerLastSeen.get(ownerProfileId) || null,
    });

    if (ownerWasOnline) {
      payload.owner_login_detected = true;
      payload.owner_login_detected_at = ownerLastSeen.get(ownerProfileId) || now.toISOString();
      payload.owner_response_due_at = null;
      const presenceUpdate = await supabase.from('lc_public_reviews').update({
        payload,
        updated_at: now.toISOString(),
      }).eq('id', review.id).eq('status', 'pending');
      if (presenceUpdate.error) throw presenceUpdate.error;
      continue;
    }

    payload.owner_response_status = 'expired';
    payload.owner_response_due_at = dueAt;
    payload.owner_login_detected = false;
    review.payload = payload;
    try {
      await advanceDossierReviewAfterOwner(review, payload, 'expired', null, now);
    } catch (autoApplyError) {
      console.error('[dossier-edit] auto apply failed', review.id, getErrorText(autoApplyError));
      payload.owner_response_status = 'pending';
      payload.owner_response_due_at = null;
      payload.auto_apply_failed_at = now.toISOString();
      payload.auto_apply_error = cleanText(getErrorText(autoApplyError), 300);
      const failedUpdate = await supabase.from('lc_public_reviews').update({
        payload,
        updated_at: now.toISOString(),
      }).eq('id', review.id).eq('status', 'pending');
      if (failedUpdate.error) throw failedUpdate.error;
    }
  }
}

const dossierOwnerReviewTimer = setInterval(() => {
  void processDueDossierOwnerReviews().catch(error => {
    console.error('[dossier-edit] scheduled processing failed', getErrorText(error));
  });
}, 60_000);
dossierOwnerReviewTimer.unref();

async function applyPublicReview(review: PublicReviewRecord, reviewerId: string | null = null) {
  const payload = objectPayload(review.payload);
  if (review.target_type === 'profile_update') {
    await applyProfileUpdateReview(review);
    if (review.profile_id) await runReferralSideEffect('stage1-after-profile-review-approved', () => maybeAwardReferralStage1(String(review.profile_id)));
    return;
  }
  if (review.target_type === 'dossier_update') {
    await applyDossierUpdateReview(review, payload, reviewerId);
    return;
  }
  if (review.target_type === 'provider_listing_update') {
    const draft = normalizeProviderListingDraft(payload);
    const profileId = cleanText(payload.profile_id || review.profile_id, 80);
    const businessContact = cleanText(payload.business_contact, 300);
    const initialPurchaseId = cleanText(payload.initial_purchase_id, 80) || null;
    if (!profileId) throw new Error('审核记录缺少委托师账号');
    if (!businessContact) throw new Error('审核记录缺少委托师业务联系方式');
    const { error: upsertErr } = await supabase.from('lc_provider_listings').upsert({
      profile_id: profileId,
      ...draft,
      is_active: payload.is_active !== false,
      initial_purchase_id: initialPurchaseId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' });
    if (upsertErr) throw upsertErr;
    const { error: contactErr } = await supabase.from('lc_provider_contacts').upsert({
      profile_id: profileId,
      business_contact: businessContact,
      is_available: payload.contact_available !== false,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' });
    if (contactErr) throw contactErr;
    await addProfileIdentityRoles(profileId, ['creator']);
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
        is_active: true,
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
      review_lane: payload.review_lane === 'deep_spoiler' || payload.spoiler_level === 'spoiler' ? 'deep_spoiler' : 'experience',
      entity_metadata: payload.entity_metadata || {},
      status: 'approved',
      moderation_precheck: review.moderation_precheck || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'target_type,target_id,profile_id,review_lane' });
    if (upsertErr) throw upsertErr;
    return;
  }
  if (review.target_type === 'rating_discussion_create') {
    const nodeId = cleanText(payload.node_id, 80);
    if (!nodeId) throw new Error('审核记录缺少评价回应节点');
    const { error: updateErr } = await supabase.from('lc_rating_discussion_nodes').update({
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_note: null,
      updated_at: new Date().toISOString(),
    }).eq('id', nodeId).eq('status', 'pending');
    if (updateErr) throw updateErr;
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
  return isPastDate(row.needed_end_date || row.needed_date);
}

function isCarpoolExpired(row: Record<string, unknown>) {
  if (dateText(row.deadline_date)) return isPastDate(row.deadline_date, row.deadline_time);
  return isPastDate(row.event_date);
}

function publicCommissionRow(row: Record<string, unknown>) {
  const { private_contact: privateContact, ...safe } = row;
  return { ...safe, has_private_contact: Boolean(cleanText(privateContact, 300)) };
}

function withCommissionExpiration(rows: Record<string, unknown>[]) {
  return rows.map(row => ({ ...publicCommissionRow(row), is_expired: isCommissionExpired(row) }));
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

function buildRoleRatingMap(rows: Record<string, unknown>[] | null | undefined) {
  const buckets = new Map<string, Record<string, unknown>[]>();
  for (const row of rows || []) {
    const targetId = cleanText(row.target_id, 160);
    if (!targetId) continue;
    const values = buckets.get(targetId) || [];
    values.push(row);
    buckets.set(targetId, values);
  }
  return new Map(Array.from(buckets.entries()).map(([id, values]) => [id, summarizeRoleReviewRows(values)]));
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
      display_files: summarizeAuditFiles(row.display_files),
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

async function appendAuditEntryOnTencent(args: {
  targetType: AuditTargetType;
  targetId: string;
  eventType: string;
  payload: unknown;
  actorId?: string | null;
  actorRole?: string;
  metadata?: Record<string, unknown>;
}) {
  const client = await tencentPgPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`select pg_advisory_xact_lock(hashtext('lc_audit_chain_entries'))`);
    const createdAt = new Date().toISOString();
    const chainDate = createdAt.slice(0, 10);
    const canonicalPayload = normalizeAuditValue(args.payload);
    const contentHash = sha256(stableJson(canonicalPayload));
    const latestResult = await client.query(
      `select entry_hash from lc_audit_chain_entries order by created_at desc, id desc limit 1`,
    );
    const previousHash = latestResult.rows[0]?.entry_hash || null;
    const actorRole = args.actorRole || 'system';
    const entryHash = sha256(stableJson({
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
    }));
    const inserted = await client.query(
      `insert into lc_audit_chain_entries
        (target_type, target_id, event_type, content_hash, previous_hash, entry_hash,
         canonical_payload, actor_id, actor_role, metadata, chain_date, created_at)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11, $12)
       returning id, entry_hash, content_hash, chain_date, created_at`,
      [
        args.targetType,
        args.targetId,
        args.eventType,
        contentHash,
        previousHash,
        entryHash,
        JSON.stringify(canonicalPayload),
        args.actorId || null,
        actorRole,
        JSON.stringify(args.metadata || {}),
        chainDate,
        createdAt,
      ],
    );
    const hashResult = await client.query(
      `select entry_hash from lc_audit_chain_entries
        where chain_date = $1 order by created_at, id`,
      [chainDate],
    );
    const hashes = hashResult.rows.map((row: { entry_hash: string }) => row.entry_hash);
    const rootHash = sha256(stableJson({ version: 'lc-audit-root-v1', chainDate, hashes }));
    await client.query(
      `insert into lc_audit_daily_roots
        (audit_date, root_hash, entry_count, first_entry_hash, last_entry_hash, generated_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (audit_date) do update
         set root_hash = excluded.root_hash,
             entry_count = excluded.entry_count,
             first_entry_hash = excluded.first_entry_hash,
             last_entry_hash = excluded.last_entry_hash,
             generated_at = excluded.generated_at`,
      [chainDate, rootHash, hashes.length, hashes[0], hashes[hashes.length - 1], createdAt],
    );
    await client.query('COMMIT');
    return inserted.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
    if (useTencentPg) return await appendAuditEntryOnTencent(args);
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
  const supportVoters = new Set<string>();
  const participants = new Set<string>();
  relatedVotes.forEach(vote => {
    if (vote.source !== 'free_vote') return;
    const voterKey = cleanText(vote.reputation_identity_id, 80)
      || cleanText(vote.voter_id, 80)
      || cleanText(vote.voter_name, 80);
    if (!voterKey) return;
    participants.add(voterKey);
    if (vote.vote_type === 'like') supportVoters.add(voterKey);
  });
  rows.forEach(row => {
    const authorKey = cleanText(row.poster_id, 80) || cleanText(row.author_name, 80);
    if (!authorKey) return;
    participants.add(authorKey);
    if (row.type === 'red') supportVoters.add(authorKey);
  });

  const redCount = rows.filter(row => row.type === 'red').length;
  const whiteCount = rows.filter(row => row.type === 'white').length;
  const blackCount = rows.filter(row => row.type === 'black').length;
  const praisePeople = supportVoters.size;
  const participantCount = participants.size;
  const commentCount = relatedComments.length;
  const latestAt = rows.reduce((latest, row) => {
    const time = new Date(String(row.last_activity_at || row.created_at || '')).getTime();
    return Number.isFinite(time) ? Math.max(latest, time) : latest;
  }, 0);
  const recentDays = latestAt > 0 ? Math.max(0, Math.min(30, Math.ceil((Date.now() - latestAt) / (24 * 60 * 60 * 1000)))) : 30;
  const recentScore = Math.max(0, 30 - recentDays);
  const reputationValue = Math.max(0, Math.round(
    praisePeople * 6
    + redCount * 10
    + whiteCount * 3
    + commentCount * 2
    + Math.min(participantCount, 200) * 1.5
    + recentScore * 0.8
    - blackCount * 8
  ));

  return {
    // Keep praise_value for old clients, but it now means unique free supporters.
    praise_value: praisePeople,
    reputation_value: reputationValue,
    praise_people: praisePeople,
    participant_count: participantCount,
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
    display_files: normalizeRankingDisplayFiles(row.display_files),
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
    last_activity_at: row.last_activity_at || row.created_at,
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
  if (targetType === 'dm_affiliation') {
    const { data } = await supabase.from('lc_dm_store_affiliations').select('status').eq('id', targetId).maybeSingle();
    return cleanText(data?.status, 40) || null;
  }
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
  if (targetType === 'profile') {
    const { data } = await supabase.from('lc_profiles').select('is_visible').eq('id', targetId).maybeSingle();
    return data?.is_visible ? 'visible' : 'hidden';
  }
  return null;
}

async function restoreTargetAfterReport(targetType: ReportTargetType, targetId: string) {
  const before = await currentTargetStatus(targetType, targetId);
  const now = new Date().toISOString();
  if (targetType === 'dm_affiliation') {
    await supabase.from('lc_dm_store_affiliations').update({ status: 'pending', reject_reason: null, updated_at: now }).eq('id', targetId);
  } else if (targetType === 'ranking') {
    await supabase.from('lc_rankings').update({ status: 'approved' }).eq('id', targetId);
  } else if (targetType === 'comment') {
    await supabase.from('lc_comments').update({ status: 'approved' }).eq('id', targetId);
  } else if (targetType === 'commission') {
    await supabase.from('lc_commissions').update({ status: 'approved', reject_reason: null, updated_at: now }).eq('id', targetId);
  } else if (targetType === 'carpool') {
    await supabase.from('lc_carpools').update({ status: 'approved', reject_reason: null, updated_at: now }).eq('id', targetId);
  } else if (targetType === 'profile') {
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
  const action = 'none' as const;
  const statusChange: { before: string | null; after: string | null } = { before: null, after: null };
  const reason = '已进入管理员举报队列，不自动隐藏或删除内容';

  const patch = {
    risk_level: riskLevel,
    auto_action: action,
    auto_action_reason: reason,
    auto_action_at: null,
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
    auto_action_reason: reason,
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

const RANKING_VERSION_FIELDS = [
  'id', 'type', 'subject_name', 'subject_type', 'subject_city', 'subject_url', 'subject_dossier_id',
  'event_date', 'event_script_id', 'event_script_name', 'event_store_dossier_id', 'event_store_name',
  'content', 'display_files', 'author_name', 'poster_id', 'is_realname', 'status', 'expires_at',
  'created_at', 'last_activity_at',
] as const;

function rankingVersionSnapshot(row: Record<string, unknown>) {
  return RANKING_VERSION_FIELDS.reduce<Record<string, unknown>>((snapshot, field) => {
    snapshot[field] = field === 'display_files'
      ? normalizeRankingDisplayFiles(row[field])
      : row[field] ?? null;
    return snapshot;
  }, {});
}

function publicRankingVersionSnapshot(value: unknown) {
  const snapshot = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return rankingVersionSnapshot(snapshot);
}

async function ensureInitialRankingVersion(row: Record<string, unknown>, actorId?: string | null) {
  const rankingId = cleanText(row.id, 80);
  if (!rankingId) return;
  const snapshot = rankingVersionSnapshot(row);
  if (useTencentPg) {
    await tencentPgPool.query(
      `insert into lc_ranking_versions
        (ranking_id, version_number, source, snapshot, changes, actor_id)
       values ($1, 1, 'original', $2::jsonb, '[]'::jsonb, $3)
       on conflict (ranking_id, version_number) do nothing`,
      [rankingId, JSON.stringify(snapshot), actorId || null],
    );
    return;
  }
  const existing = await supabase.from('lc_ranking_versions')
    .select('id')
    .eq('ranking_id', rankingId)
    .eq('version_number', 1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return;
  const inserted = await supabase.from('lc_ranking_versions').insert({
    ranking_id: rankingId,
    version_number: 1,
    source: 'original',
    snapshot,
    changes: [],
    actor_id: actorId || null,
  });
  if (inserted.error) throw inserted.error;
}

async function appendRankingVersion(args: {
  row: Record<string, unknown>;
  source: 'author_edit' | 'admin_edit' | 'restore';
  changes?: unknown[];
  actorId?: string | null;
  editRequestId?: string | null;
}) {
  const rankingId = cleanText(args.row.id, 80);
  if (!rankingId) return null;
  const snapshot = rankingVersionSnapshot(args.row);
  if (useTencentPg) {
    const result = await tencentPgPool.query(
      `insert into lc_ranking_versions
        (ranking_id, version_number, source, snapshot, changes, actor_id, edit_request_id)
       select $1, coalesce(max(version_number), 0) + 1, $2, $3::jsonb, $4::jsonb, $5, $6
         from lc_ranking_versions
        where ranking_id = $1
       returning *`,
      [rankingId, args.source, JSON.stringify(snapshot), JSON.stringify(args.changes || []), args.actorId || null, args.editRequestId || null],
    );
    return result.rows[0] || null;
  }
  const existing = await supabase.from('lc_ranking_versions')
    .select('version_number')
    .eq('ranking_id', rankingId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  const inserted = await supabase.from('lc_ranking_versions').insert({
    ranking_id: rankingId,
    version_number: Number(existing.data?.version_number || 0) + 1,
    source: args.source,
    snapshot,
    changes: args.changes || [],
    actor_id: args.actorId || null,
    edit_request_id: args.editRequestId || null,
  }).select('*').single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function finalizeRankingEditRequestOnTencent(requestId: string, reviewerId: string | null) {
  const client = await tencentPgPool.connect();
  try {
    await client.query('BEGIN');
    const requestResult = await client.query(
      `select * from lc_ranking_edit_requests where id = $1 and status = 'pending' for update`,
      [requestId],
    );
    const editRequest = requestResult.rows[0] as Record<string, unknown> | undefined;
    if (!editRequest) throw new Error('修改或恢复申请不存在，或已经处理过');
    const rankingResult = await client.query(
      `select * from lc_rankings where id = $1 for update`,
      [editRequest.ranking_id],
    );
    const ranking = rankingResult.rows[0] as Record<string, unknown> | undefined;
    if (!ranking) throw new Error('原帖不存在');
    if (ranking.poster_id !== editRequest.author_id) throw new Error('申请人与原发布人不一致，已停止处理');

    const requestKind = String(editRequest.request_kind || 'edit');
    const beforeSnapshot = objectPayload(editRequest.before_snapshot);
    const now = new Date().toISOString();
    let updated: Record<string, unknown>;
    let changes: unknown[];
    let versionSource: 'author_edit' | 'restore';

    if (requestKind === 'restore') {
      if (ranking.status !== 'withdrawn') throw new Error('原帖当前不是已下架状态，不能恢复');
      const originalSnapshot = rankingVersionSnapshot({ ...ranking, status: 'approved' });
      await client.query(
        `insert into lc_ranking_versions
          (ranking_id, version_number, source, snapshot, changes, actor_id)
         values ($1, 1, 'original', $2::jsonb, '[]'::jsonb, $3)
         on conflict (ranking_id, version_number) do nothing`,
        [ranking.id, JSON.stringify(originalSnapshot), editRequest.author_id || null],
      );
      const restoreResult = await client.query(
        `update lc_rankings
            set status = 'approved', withdrawn_at = null, withdrawn_by = null, withdrawal_reason = null,
                last_activity_at = $2,
                expires_at = case when type = 'black' then $3 else expires_at end
          where id = $1 and status = 'withdrawn'
          returning *`,
        [ranking.id, now, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()],
      );
      if (!restoreResult.rows[0]) throw new Error('原帖状态已变化，恢复失败');
      updated = restoreResult.rows[0] as Record<string, unknown>;
      changes = [{ field: 'status', label: '公开状态', before: 'withdrawn', after: 'approved' }];
      versionSource = 'restore';
    } else {
      if (ranking.status !== 'approved') throw new Error('原帖已不在公开状态，不能应用修改');
      const staleFields = RANKING_AUTHOR_EDITABLE_FIELDS.filter(field => !auditValuesEqual(ranking[field], beforeSnapshot[field]));
      if (staleFields.length > 0) throw new Error('原帖在申请后又发生了变化，请驳回本次申请并让发布人重新提交');
      const proposedPatch = objectPayload(editRequest.proposed_patch);
      const assessment = assessRankingAuthorEdit(ranking, proposedPatch);
      if (!assessment.allowed) throw new Error(assessment.reason || '修改已不符合当前规则');
      await client.query(
        `insert into lc_ranking_versions
          (ranking_id, version_number, source, snapshot, changes, actor_id)
         values ($1, 1, 'original', $2::jsonb, '[]'::jsonb, $3)
         on conflict (ranking_id, version_number) do nothing`,
        [ranking.id, JSON.stringify(rankingVersionSnapshot(ranking)), editRequest.author_id || null],
      );
      const patchJson = JSON.stringify(assessment.patch);
      const updateResult = await client.query(
        `update lc_rankings
            set content = case when $2::jsonb ? 'content' then $2::jsonb ->> 'content' else content end,
                subject_url = case when $2::jsonb ? 'subject_url' then nullif($2::jsonb ->> 'subject_url', '') else subject_url end,
                event_date = case when $2::jsonb ? 'event_date' then nullif($2::jsonb ->> 'event_date', '')::date else event_date end,
                event_script_name = case when $2::jsonb ? 'event_script_name' then nullif($2::jsonb ->> 'event_script_name', '') else event_script_name end,
                event_store_name = case when $2::jsonb ? 'event_store_name' then nullif($2::jsonb ->> 'event_store_name', '') else event_store_name end,
                last_activity_at = $3
          where id = $1 and status = 'approved'
          returning *`,
        [ranking.id, patchJson, now],
      );
      if (!updateResult.rows[0]) throw new Error('原帖状态已变化，修改失败');
      updated = updateResult.rows[0] as Record<string, unknown>;
      changes = assessment.changes;
      versionSource = 'author_edit';
    }

    await client.query(
      `insert into lc_ranking_versions
        (ranking_id, version_number, source, snapshot, changes, actor_id, edit_request_id)
       select $1, coalesce(max(version_number), 0) + 1, $2, $3::jsonb, $4::jsonb, $5, $6
         from lc_ranking_versions where ranking_id = $1`,
      [ranking.id, versionSource, JSON.stringify(rankingVersionSnapshot(updated)), JSON.stringify(changes), requestKind === 'restore' ? reviewerId : editRequest.author_id, requestId],
    );
    await client.query(
      `update lc_ranking_edit_requests
          set status = 'approved', reject_reason = null, reviewed_by = $2, reviewed_at = $3, updated_at = $3
        where id = $1 and status = 'pending'`,
      [requestId, reviewerId, now],
    );
    await client.query('COMMIT');
    return { editRequest, ranking, requestKind, beforeSnapshot, updated, changes };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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

type RankingVoteType = ReputationVoteType;
type RankingVoteRow = {
  id: string;
  ranking_id?: string;
  vote_type: RankingVoteType;
  vote_channel?: 'stance' | 'joy';
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

async function getRankingVoteState(profileId: string, rankingId: string) {
  const profileResult = await supabase.from('lc_profiles')
    .select('reputation_identity_id')
    .eq('id', profileId)
    .maybeSingle();
  if (profileResult.error) throw profileResult.error;
  const identityId = cleanText(profileResult.data?.reputation_identity_id, 80);
  if (!identityId) return { myVote: null, myJoyVote: null };

  const voteResult = await supabase.from('lc_votes')
    .select('id, ranking_id, vote_type, vote_channel, created_at')
    .eq('ranking_id', rankingId)
    .eq('reputation_identity_id', identityId)
    .eq('source', 'free_vote');
  if (voteResult.error) throw voteResult.error;
  const votes = (voteResult.data || []) as RankingVoteRow[];
  const stanceVote = votes.find(vote => vote.vote_channel === 'stance' && vote.vote_type !== 'joy') || null;
  const joyVote = votes.find(vote => vote.vote_channel === 'joy' && vote.vote_type === 'joy') || null;
  return {
    myVote: stanceVote ? serializeMyVote(stanceVote) : null,
    myJoyVote: joyVote ? serializeMyVote(joyVote) : null,
  };
}

function firstRpcRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function rankingVoteRpcStatus(message: string) {
  if (message.includes('验证手机号') || message.includes('UnionID')) return 403;
  if (message.includes('身份绑定冲突') || message.includes('重复历史票') || message.includes('账号已合并')) return 409;
  if (message.includes('榜金不足') || message.includes('契约币不足')) return 402;
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

app.get('/api/wechat/mini/events', (req, res) => {
  const echostr = singleQueryValue(req.query.echostr);
  if (!LINGQI_WECHAT_MINI_MSG_TOKEN) return res.status(503).type('text/plain').send('wechat mini message token not configured');
  if (!echostr) return res.status(400).type('text/plain').send('missing echostr');
  if (!verifyWechatMiniEventRequest(req)) return res.status(403).type('text/plain').send('invalid signature');
  return res.status(200).type('text/plain').send(echostr);
});

app.post('/api/wechat/mini/events', express.text({ type: ['text/*', 'application/xml', 'text/xml'], limit: '2mb' }), async (req, res) => {
  try {
    if (!LINGQI_WECHAT_MINI_MSG_TOKEN) return res.status(503).type('text/plain').send('wechat mini message token not configured');
    if (!verifyWechatMiniEventRequest(req)) return res.status(403).type('text/plain').send('invalid signature');
    const rawBody = typeof req.body === 'string'
      ? req.body
      : String((req as Record<string, unknown>).rawBody || JSON.stringify(req.body || {}));
    let parsedBody: unknown = req.body;
    if (typeof parsedBody === 'string' && parsedBody.trim().startsWith('{')) {
      try {
        parsedBody = JSON.parse(parsedBody);
      } catch {
        parsedBody = null;
      }
    }
    const payload = parseWechatMiniMediaEvent(parsedBody, rawBody);
    if (payload.appid && payload.appid !== LINGQI_WECHAT_MINI_APP_ID) {
      return res.status(403).type('text/plain').send('invalid appid');
    }
    const verdict = interpretWechatMediaCallback(payload);
    if (!verdict.valid || !verdict.traceId) {
      console.error('[wechat-safety] invalid media callback', {
        event: payload.Event || payload.event || null,
        has_trace_id: Boolean(payload.trace_id),
      });
      return res.status(200).type('text/plain').send('success');
    }
    const nowIso = new Date().toISOString();
    const updateResult = await supabase.from('lc_wechat_content_checks').update({
      status: verdict.status,
      suggest: verdict.suggest,
      label: verdict.label,
      errcode: verdict.errcode,
      error_message: verdict.reason || null,
      checked_at: nowIso,
      updated_at: nowIso,
    }).eq('trace_id', verdict.traceId).eq('check_type', 'image').select('id, profile_id, target_type, target_id').maybeSingle();
    if (updateResult.error) throw updateResult.error;
    if (!updateResult.data) {
      console.error('[wechat-safety] media callback trace not found', { trace_id: verdict.traceId });
    }
    return res.status(200).type('text/plain').send('success');
  } catch (error) {
    console.error('[wechat-safety] media callback failed', getErrorText(error));
    return res.status(500).type('text/plain').send('error');
  }
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
    const { activityCities, referralCode } = req.body;
    const displayName = cleanText(req.body?.displayName, 30);
    if (!displayName) return res.status(400).json(err(new Error('请填写昵称')));
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
      display_name: displayName,
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
      description: '新用户注册赠送 30 榜金',
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
    const { activityCities, referralCode } = req.body;
    const displayName = cleanText(req.body?.displayName, 30);
    if (!displayName) return res.status(400).json(err(new Error('请填写昵称')));
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
    const profileRole = 'player';
    const { data: profile } = await supabase.from('lc_profiles').insert({
      email,
      display_name: displayName,
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
      description: '新用户注册赠送 30 榜金',
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
    if (restrictionBlocksLogin(existing)) {
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

    const { data: nextProfile, error: updateError } = await supabase.from('lc_profiles')
      .update(patch)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (updateError) throw updateError;
    if (!nextProfile) throw new Error('密码更新失败，请稍后重试');
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
    if (restrictionBlocksLogin(current)) return res.status(403).json(err(new Error('账号功能当前受限，请联系管理员申诉')));
    if (existing && existing.id !== creatorId) {
      const preflightError = miniappAccountMergePreflight(current, existing);
      if (preflightError) return res.status(409).json(err(new Error(preflightError)));

      const { error: mergeError } = await supabase.rpc('lc_merge_pristine_miniapp_profile', {
        p_source_profile_id: creatorId,
        p_target_profile_id: existing.id,
        p_verified_phone: phone,
      });
      if (mergeError) {
        return res.status(409).json(err(new Error(miniappAccountMergeErrorMessage(mergeError))));
      }

      const { data: mergedProfile, error: mergedProfileError } = await supabase.from('lc_profiles')
        .select('*')
        .eq('id', existing.id)
        .single();
      if (mergedProfileError || !mergedProfile) throw mergedProfileError || new Error('合并后的账号不存在');
      const authClient = authClientForToken(req);
      const token = signProfileAuthToken(mergedProfile, authClient);
      await logSecurityEvent(req, {
        action: 'auth_miniapp_account_merged',
        targetType: 'profile',
        targetId: existing.id,
        actorId: creatorId,
        actorRole: current.role || 'creator',
        metadata: {
          source_profile_id: creatorId,
          target_profile_id: existing.id,
          phone_hash: makeAuthPhoneHash(phone),
          duplicate_welcome_credit_removed: 30,
        },
      });

      return res.json(ok({
        id: mergedProfile.id,
        display_name: mergedProfile.display_name,
        avatar: mergedProfile.avatar || null,
        phone: mergedProfile.phone,
        phone_verified_at: mergedProfile.phone_verified_at,
        email: mergedProfile.email || '',
        email_verified_at: mergedProfile.email_verified_at || null,
        city: mergedProfile.city || null,
        available_cities: mergedProfile.available_cities || [],
        role: mergedProfile.role,
        role_type: mergedProfile.role_type,
        identity_roles: mergedProfile.identity_roles || [],
        token,
        auth_client: authClient,
        has_password: Boolean(mergedProfile.password_hash),
        account_merged: true,
      }));
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
    const authClient = authClientForToken(req);
    const token = signProfileAuthToken(nextProfile, authClient);
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
      auth_client: authClient,
      has_password: Boolean(nextProfile.password_hash),
      account_merged: false,
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
    if (restrictionBlocksLogin(current)) return res.status(403).json(err(new Error('账号功能当前受限，请联系管理员申诉')));
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
    const { data: updatedProfile, error: updateError } = await supabase.from('lc_profiles')
      .update({ password_hash: passwordHash })
      .eq('id', creatorId)
      .select('*')
      .single();
    if (updateError) throw updateError;
    if (!updatedProfile) throw new Error('密码更新失败，请稍后重试');
    const token = signProfileAuthToken(updatedProfile, authClientForToken(req));
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

    res.json(ok({ has_password: true, token }));
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

app.get('/api/lc/auth/wechat/bind-url', authMiddleware, async (req, res) => {
  try {
    if (!isWechatLoginConfigured()) return res.status(503).json(err(new Error('微信扫码绑定尚未配置')));
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const redirectPath = safeFrontendRedirect(req.query.redirect || '/dashboard/account');
    res.json(ok({
      enabled: true,
      url: makeWechatBindAuthorizeUrl(profile.id, redirectPath),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/auth/wechat/callback', async (req, res) => {
  try {
    if (!isWechatLoginConfigured()) throw new Error('微信扫码登录尚未配置');
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) throw new Error('微信登录参数缺失');
    const statePayload = jwt.verify(state, JWT_SECRET) as {
      kind?: string;
      redirectPath?: string;
      referralCode?: string;
      profileId?: string;
    };
    if (!['lc_wechat_login', 'lc_wechat_bind'].includes(statePayload.kind || '')) {
      throw new Error('微信登录状态无效');
    }

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
    const identityResult = await query.maybeSingle();
    if (identityResult.error) throw identityResult.error;
    let profile = identityResult.data;

    if (statePayload.kind === 'lc_wechat_bind') {
      const profileId = cleanText(statePayload.profileId, 80);
      if (!profileId) throw new Error('微信绑定状态无效');
      if (profile && profile.id !== profileId) throw new Error('该微信已绑定其他剧幕录账号');
      const targetResult = await supabase.from('lc_profiles').select('*').eq('id', profileId).maybeSingle();
      if (targetResult.error) throw targetResult.error;
      const targetProfile = targetResult.data;
      if (!targetProfile) throw new Error('要绑定的账号不存在');
      if (restrictionBlocksLogin(targetProfile)) throw new Error('账号已被限制登录，请联系管理员申诉');
      const updateResult = await supabase.from('lc_profiles').update({
        wechat_openid: openid,
        wechat_unionid: unionid || targetProfile.wechat_unionid || null,
        wechat_nickname: nickname,
        wechat_avatar: avatar,
        wechat_bound_at: nowIso,
      }).eq('id', targetProfile.id);
      if (updateResult.error) throw updateResult.error;
      await logSecurityEvent(req, {
        action: 'auth_wechat_bound',
        targetType: 'profile',
        targetId: targetProfile.id,
        actorId: targetProfile.id,
        actorRole: targetProfile.role || 'creator',
        metadata: { has_unionid: Boolean(unionid), wechat_bound_at: nowIso },
      });
      const redirectPath = safeFrontendRedirect(statePayload.redirectPath || '/dashboard/account');
      const joiner = redirectPath.includes('?') ? '&' : '?';
      return res.redirect(`${LINGQI_SITE_URL}${redirectPath}${joiner}wechat_bound=1`);
    }

    if (profile && restrictionBlocksLogin(profile)) {
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
        is_visible: false,
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
        description: '新用户注册赠送 30 榜金',
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

    if (profile && restrictionBlocksLogin(profile)) {
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

    const displayName = displayNameInput || profile?.display_name || '新用户';
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
        profile_setup_completed: false,
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
        description: '新用户注册赠送 30 榜金',
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

    const token = signProfileAuthToken(profile, 'wechat-miniapp');
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
      auth_client: 'wechat-miniapp',
      has_password: Boolean(profile.password_hash),
      profile_setup_completed: profile.profile_setup_completed !== false,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/miniapp/auth/refresh', authMiddleware, async (req, res) => {
  try {
    if (req.header('X-LC-Client') !== 'wechat-miniapp') {
      return res.status(403).json(err(new Error('该接口仅供微信小程序使用')));
    }
    const profile = await getAuthedProfile(req);
    if (!profile?.wechat_mini_openid) {
      return res.status(409).json(err(new Error('请先使用微信小程序重新登录')));
    }
    const token = signProfileAuthToken(profile, 'wechat-miniapp');
    return res.json(ok({ token, auth_client: 'wechat-miniapp' }));
  } catch (e) { return res.status(500).json(err(e)); }
});

app.post('/api/lc/miniapp/content-check', authMiddleware, async (req, res) => {
  try {
    if (!isWechatMiniClient(req)) return res.status(403).json(err(new Error('该接口仅供微信小程序使用')));
    const content = splitWechatSafetyText([req.body?.content]).join('');
    const scene = cleanText(req.body?.scene, 80) || 'ugc';
    if (!content) return res.status(400).json(err(new Error('缺少待检查内容')));
    const result = await runWechatMiniTextSafetyCheck(req, {
      businessScene: scene,
      targetType: 'preflight',
      content,
    });
    if (!result.verdict.allowed) {
      await logSecurityEvent(req, {
        action: 'miniapp_content_check_blocked',
        targetType: 'profile',
        targetId: result.profile.id,
        actorId: result.profile.id,
        actorRole: result.profile.role || 'creator',
        metadata: {
          scene,
          label: result.verdict.label,
          retryable: result.verdict.retryable,
          trace_id: result.verdict.traceId,
        },
      });
      return res.status(result.verdict.retryable ? 503 : 400).json(err(new Error(result.verdict.reason)));
    }
    res.json(ok({ checked: true, trace_id: result.verdict.traceId }));
  } catch (e) {
    console.error('[miniapp-content-check]', e instanceof Error ? e.message : String(e));
    res.status(503).json(err(new Error('微信内容安全服务暂时不可用，请稍后重试')));
  }
});

app.post('/api/lc/service-payments/create', authMiddleware, async (req, res) => {
  let attemptId = '';
  try {
    if (req.header('X-LC-Client') !== 'wechat-miniapp') {
      return res.status(409).json(err(new Error('当前付费服务请在剧幕录微信小程序内完成')));
    }
    if (!isWechatPayConfigured()) return res.status(503).json(err(new Error('微信支付尚未配置')));
    assertWechatPayConfigured();
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    if (!profile.wechat_mini_openid) return res.status(409).json(err(new Error('请先使用微信小程序重新登录')));
    const productType = normalizeServiceProductType(req.body?.productType ?? req.body?.product_type);
    if (!productType) return res.status(400).json(err(new Error('付费服务类型不正确')));
    const requestedTargetId = cleanText(req.body?.targetId ?? req.body?.target_id, 80);
    const targetId = await validateServicePurchaseTarget(profile, productType, requestedTargetId);
    let purchase = await ensureServicePurchase(profile.id, productType, targetId);
    if (purchase.status === 'refunded') {
      const resetResult = await supabase.from('lc_service_purchases').update({
        status: 'unpaid',
        paid_attempt_id: null,
        paid_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', purchase.id).eq('status', 'refunded').select('*').single();
      if (resetResult.error) throw resetResult.error;
      purchase = resetResult.data as ServicePurchaseRow;
    }
    if (servicePurchaseGrantsAccess(purchase.status)) {
      return res.json(ok({
        purchase: await servicePurchaseStatusPayload(purchase),
        already_paid: true,
      }));
    }

    await supabase.from('lc_service_payment_attempts').update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    }).eq('purchase_id', purchase.id).eq('status', 'created').lt('expires_at', new Date().toISOString());

    const activeResult = await supabase.from('lc_service_payment_attempts')
      .select('*')
      .eq('purchase_id', purchase.id)
      .eq('status', 'created')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeResult.error && !isMissingRelation(activeResult.error, 'lc_service_payment_attempts')) throw activeResult.error;
    let attempt = activeResult.error ? null : activeResult.data as ServicePaymentAttemptRow | null;

    if (!attempt) {
      const expiresAt = makePaymentExpiresAt();
      const insertResult = await supabase.from('lc_service_payment_attempts').insert({
        purchase_id: purchase.id,
        out_trade_no: makeServicePayOrderNo(),
        amount_fen: SERVICE_FEE_FEN,
        status: 'created',
        expires_at: expiresAt.toISOString(),
      }).select('*').single();
      if (insertResult.error) {
        if (insertResult.error.code === '23505') {
          const raced = await supabase.from('lc_service_payment_attempts')
            .select('*')
            .eq('purchase_id', purchase.id)
            .eq('status', 'created')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (raced.error) throw raced.error;
          attempt = raced.data as ServicePaymentAttemptRow;
        } else {
          throw insertResult.error;
        }
      } else {
        attempt = insertResult.data as ServicePaymentAttemptRow;
      }
    }
    attemptId = attempt.id;

    let prepayId = cleanText(attempt.prepay_id, 120);
    if (!prepayId) {
      try {
        const created = await createWechatPayMiniappOrder({
          outTradeNo: attempt.out_trade_no,
          productType,
          openid: profile.wechat_mini_openid,
          expiresAt: new Date(attempt.expires_at),
        });
        prepayId = created.prepayId;
        const prepayUpdate = await supabase.from('lc_service_payment_attempts').update({
          prepay_id: prepayId,
          updated_at: new Date().toISOString(),
        }).eq('id', attempt.id).eq('status', 'created');
        if (prepayUpdate.error) throw prepayUpdate.error;
      } catch (paymentError) {
        await supabase.from('lc_service_payment_attempts').update({
          status: 'failed',
          notify_payload: { create_error: cleanText(getErrorText(paymentError), 500) },
          updated_at: new Date().toISOString(),
        }).eq('id', attempt.id);
        throw paymentError;
      }
    }

    const payParams = createMiniappPaymentParams({
      appId: WECHAT_PAY_APP_ID,
      prepayId,
      privateKey: WECHAT_PAY_PRIVATE_KEY,
    });
    await logSecurityEvent(req, {
      action: 'service_payment_created',
      actorId: profile.id,
      actorRole: profileAuthRole(profile),
      targetType: productType,
      targetId,
      metadata: { purchase_id: purchase.id, attempt_id: attempt.id, amount_fen: SERVICE_FEE_FEN },
    });
    res.status(201).json(ok({
      purchase: publicServicePurchase(purchase),
      already_paid: false,
      payment: {
        ...payParams,
        out_trade_no: attempt.out_trade_no,
        expires_at: attempt.expires_at,
      },
    }));
  } catch (e) {
    await logSecurityEvent(req, {
      action: 'service_payment_create_failed',
      targetType: 'service_payment_attempt',
      targetId: attemptId || null,
      metadata: { error: cleanText(getErrorText(e), 500) },
    });
    const statusCode = Number((e as { statusCode?: number })?.statusCode || 500);
    res.status(statusCode).json(err(e));
  }
});

app.get('/api/lc/service-payments/:id/status', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const purchaseResult = await supabase.from('lc_service_purchases')
      .select('*')
      .eq('id', req.params.id)
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (purchaseResult.error && isMissingRelation(purchaseResult.error, 'lc_service_purchases')) return res.status(503).json(err(new Error('付费服务数据表尚未初始化')));
    if (purchaseResult.error) throw purchaseResult.error;
    if (!purchaseResult.data) return res.status(404).json(err(new Error('支付订单不存在')));
    let purchase = purchaseResult.data as ServicePurchaseRow;

    if (!servicePurchaseGrantsAccess(purchase.status) && req.query.refresh === '1' && isWechatPayConfigured()) {
      const attemptResult = await supabase.from('lc_service_payment_attempts')
        .select('*')
        .eq('purchase_id', purchase.id)
        .in('status', ['created', 'expired'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (attemptResult.error && !isMissingRelation(attemptResult.error, 'lc_service_payment_attempts')) throw attemptResult.error;
      const attempt = attemptResult.error ? null : attemptResult.data as ServicePaymentAttemptRow | null;
      if (attempt) {
        const transaction = await wechatPayRequest<Record<string, unknown>>(
          'GET',
          `/v3/pay/transactions/out-trade-no/${encodeURIComponent(attempt.out_trade_no)}?mchid=${encodeURIComponent(WECHAT_PAY_MCH_ID)}`,
        );
        if (transaction.trade_state === 'SUCCESS') {
          const amount = transaction.amount && typeof transaction.amount === 'object'
            ? transaction.amount as Record<string, unknown>
            : {};
          await confirmServicePayment({
            outTradeNo: String(transaction.out_trade_no || ''),
            transactionId: String(transaction.transaction_id || ''),
            totalFee: Number(amount.total),
            currency: String(amount.currency || ''),
            appId: String(transaction.appid || ''),
            mchId: String(transaction.mchid || ''),
            payerOpenid: cleanText((transaction.payer as Record<string, unknown> | null)?.openid, 120),
            payload: makeSafeWechatPayPayload(transaction, { event_type: 'ORDER.QUERY' }),
          });
          const refreshed = await supabase.from('lc_service_purchases').select('*').eq('id', purchase.id).single();
          if (refreshed.error) throw refreshed.error;
          purchase = refreshed.data as ServicePurchaseRow;
        }
      }
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(ok(await servicePurchaseStatusPayload(purchase)));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/service-payments/mine', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const result = await supabase.from('lc_service_purchases')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (result.error && isMissingRelation(result.error, 'lc_service_purchases')) return res.json(ok([]));
    if (result.error) throw result.error;
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(ok(await Promise.all((result.data || []).map(row => servicePurchaseStatusPayload(row as ServicePurchaseRow)))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/account/submissions', accountStateMiddleware, async (req, res) => {
  try {
    await processDueDossierOwnerReviews();
    const profile = accountProfileFromRequest(req);
    if (profile.merged_into) return res.json(ok({ items: [], summary: summarizeAccountSubmissions([]) }));

    const [
      rankingsResult,
      carpoolsResult,
      commissionsResult,
      dmRatingsResult,
      storeRatingsResult,
      commentsResult,
      reportsResult,
      publicReviewsResult,
      scriptContributionsResult,
      guidesResult,
      siteMessagesResult,
      certificationsResult,
      dossierClaimsResult,
      dossiersResult,
      providerPurchaseResult,
      providerListingResult,
    ] = await Promise.all([
      supabase.from('lc_rankings').select('*').eq('poster_id', profile.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_carpools').select('*').eq('poster_id', profile.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_commissions').select('*').eq('poster_id', profile.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_dm_ratings').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_store_ratings').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_comments').select('*').eq('author_id', profile.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_reports').select('*').eq('reporter_id', profile.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_public_reviews').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('lc_script_contributions').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_guides').select('*').eq('author_id', profile.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_site_messages').select('*').eq('sender_id', profile.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_certifications').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_dm_dossier_claims').select('*').eq('claimant_id', profile.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_dm_dossiers').select('*').eq('submitted_by', profile.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_service_purchases').select('id, status, paid_at, created_at')
        .eq('profile_id', profile.id)
        .eq('product_type', 'provider_listing')
        .eq('target_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('lc_provider_listings').select('profile_id, is_active, poster_url, headline, created_at, updated_at')
        .eq('profile_id', profile.id)
        .maybeSingle(),
    ]);

    const results = [
      [rankingsResult, 'lc_rankings'],
      [carpoolsResult, 'lc_carpools'],
      [commissionsResult, 'lc_commissions'],
      [dmRatingsResult, 'lc_dm_ratings'],
      [storeRatingsResult, 'lc_store_ratings'],
      [commentsResult, 'lc_comments'],
      [reportsResult, 'lc_reports'],
      [publicReviewsResult, 'lc_public_reviews'],
      [scriptContributionsResult, 'lc_script_contributions'],
      [guidesResult, 'lc_guides'],
      [siteMessagesResult, 'lc_site_messages'],
      [certificationsResult, 'lc_certifications'],
      [dossierClaimsResult, 'lc_dm_dossier_claims'],
      [dossiersResult, 'lc_dm_dossiers'],
      [providerPurchaseResult, 'lc_service_purchases'],
      [providerListingResult, 'lc_provider_listings'],
    ] as const;
    for (const [result, relation] of results) {
      if (result.error && !isMissingRelation(result.error, relation)) throw result.error;
    }

    const rows = (result: { data: unknown; error: unknown }) => (
      result.error || !Array.isArray(result.data) ? [] : result.data
    ) as Record<string, unknown>[];
    const text = (value: unknown, max = 500) => cleanText(value, max);
    const dossierIds = new Set<string>();
    const addDossierId = (value: unknown) => {
      const id = text(value, 80);
      if (id) dossierIds.add(id);
    };
    for (const row of rows(dmRatingsResult)) addDossierId(row.dm_dossier_id);
    for (const row of rows(storeRatingsResult)) addDossierId(row.store_dossier_id);
    for (const row of rows(dossierClaimsResult)) addDossierId(row.dossier_id);
    for (const row of rows(publicReviewsResult)) {
      const payload = objectPayload(row.payload);
      addDossierId(payload.dossier_id);
    }

    let relatedDossiers: Record<string, unknown>[] = [];
    if (dossierIds.size > 0) {
      const result = await supabase.from('lc_dm_dossiers')
        .select('id, entity_type, dm_name, city, photo_url, photo_files, status')
        .in('id', Array.from(dossierIds));
      if (result.error && !isMissingRelation(result.error, 'lc_dm_dossiers')) throw result.error;
      relatedDossiers = result.error ? [] : (result.data || []) as Record<string, unknown>[];
    }
    const dossierById = new Map<string, Record<string, unknown>>();
    for (const row of [...rows(dossiersResult), ...relatedDossiers]) {
      const id = text(row.id, 80);
      if (id) dossierById.set(id, row);
    }

    const submission = (
      row: Record<string, unknown>,
      input: {
        kind: string;
        group: AccountSubmissionGroup;
        typeLabel: string;
        title: string;
        content?: string;
        status?: string;
        rejectReason?: string | null;
        thumbnailUrl?: string | null;
        actionUrl?: string | null;
        relatedType?: string | null;
        relatedId?: string | null;
        metadata?: Record<string, string | number | boolean | null>;
      },
    ): AccountSubmissionItem => {
      const status = input.status || text(row.status, 40) || 'pending';
      return {
        id: text(row.id, 80),
        kind: input.kind,
        group: input.group,
        type_label: input.typeLabel,
        title: input.title,
        content: input.content ?? text(row.content || row.summary || row.note || row.description, 2400),
        status,
        state: normalizeSubmissionState(status),
        created_at: text(row.created_at, 80),
        updated_at: text(row.updated_at, 80) || null,
        reject_reason: input.rejectReason ?? (text(row.reject_reason || row.review_note || row.admin_note, 500) || null),
        thumbnail_url: input.thumbnailUrl ?? firstPublicImage(row.display_files, row.photo_files, row.files, row.photo_url, row.main_image_url),
        action_url: input.actionUrl || null,
        related_type: input.relatedType || null,
        related_id: input.relatedId || null,
        metadata: input.metadata || {},
      };
    };

    const items: AccountSubmissionItem[] = [];
    const rankingLabels: Record<string, string> = { red: '红榜', black: '黑榜', white: '白榜' };
    for (const row of rows(rankingsResult)) {
      const label = rankingLabels[text(row.type, 20)] || '榜单';
      items.push(submission(row, {
        kind: 'ranking',
        group: 'publication',
        typeLabel: label,
        title: `${label} · ${text(row.subject_name, 120) || '未命名对象'}`,
        actionUrl: `/rankings/${text(row.id, 80)}`,
        relatedType: 'ranking',
        relatedId: text(row.id, 80),
      }));
    }
    for (const row of rows(carpoolsResult)) {
      items.push(submission(row, {
        kind: 'carpool',
        group: 'publication',
        typeLabel: '拼车',
        title: `拼车 · ${text(row.script_name || row.title, 120) || '未命名活动'}`,
        actionUrl: '/carpools',
        relatedType: 'carpool',
        relatedId: text(row.id, 80),
      }));
    }
    for (const row of rows(commissionsResult)) {
      items.push(submission(row, {
        kind: 'commission',
        group: 'publication',
        typeLabel: '委托需求',
        title: `委托需求 · ${text(row.title, 120) || '未命名委托'}`,
        actionUrl: '/commissions?view=mine',
        relatedType: 'commission',
        relatedId: text(row.id, 80),
      }));
    }
    for (const row of rows(dmRatingsResult)) {
      const dossierId = text(row.dm_dossier_id, 80);
      const dossier = dossierById.get(dossierId) || {};
      const dmName = text(dossier.dm_name, 120) || 'DM';
      const scriptName = text(row.script_name, 120) || '体验记录';
      items.push(submission(row, {
        kind: 'dm_rating',
        group: 'rating',
        typeLabel: 'DM评分',
        title: `DM评分 · ${dmName} · 《${scriptName}》`,
        thumbnailUrl: firstPublicImage(dossier.photo_files, dossier.photo_url),
        actionUrl: dossierId ? `/dm/${dossierId}` : '/dm',
        relatedType: 'dm_dossier',
        relatedId: dossierId || null,
        metadata: { dossier_id: dossierId || null },
      }));
    }
    for (const row of rows(storeRatingsResult)) {
      const dossierId = text(row.store_dossier_id, 80);
      const dossier = dossierById.get(dossierId) || {};
      const storeName = text(dossier.dm_name, 120) || '店家';
      const scriptName = text(row.script_name, 120) || '到店记录';
      items.push(submission(row, {
        kind: 'store_rating',
        group: 'rating',
        typeLabel: '店家评分',
        title: `店家评分 · ${storeName} · 《${scriptName}》`,
        thumbnailUrl: firstPublicImage(dossier.photo_files, dossier.photo_url),
        actionUrl: dossierId ? `/stores/${dossierId}` : '/stores',
        relatedType: 'store_dossier',
        relatedId: dossierId || null,
        metadata: { dossier_id: dossierId || null },
      }));
    }
    for (const row of rows(commentsResult)) {
      const rankingId = text(row.ranking_id, 80);
      items.push(submission(row, {
        kind: 'comment',
        group: 'interaction',
        typeLabel: '评论',
        title: '红黑榜评论',
        actionUrl: rankingId ? `/rankings/${rankingId}` : '/rankings',
        relatedType: 'ranking',
        relatedId: rankingId || null,
        metadata: { ranking_id: rankingId || null },
      }));
    }
    for (const row of rows(reportsResult)) {
      items.push(submission(row, {
        kind: 'report',
        group: 'governance',
        typeLabel: '举报',
        title: `举报 · ${text(row.target_title, 120) || '内容记录'}`,
        content: text(row.reason || row.content, 2400),
        actionUrl: '/contact',
        relatedType: text(row.target_type, 80) || 'report',
        relatedId: text(row.target_id, 80) || null,
      }));
    }
    for (const row of rows(scriptContributionsResult)) {
      items.push(submission(row, {
        kind: 'script_contribution',
        group: 'publication',
        typeLabel: '剧本共建',
        title: `剧本共建 · 《${text(row.script_name, 120) || '未命名剧本'}》`,
        content: text(row.note, 2400),
        actionUrl: '/scripts',
        relatedType: 'script',
        relatedId: text(row.script_id, 80) || null,
        metadata: { script_id: text(row.script_id, 80) || null },
      }));
    }
    for (const row of rows(guidesResult)) {
      items.push(submission(row, {
        kind: 'guide',
        group: 'publication',
        typeLabel: '攻略',
        title: `攻略 · ${text(row.title, 160) || '未命名攻略'}`,
        content: text(row.summary || row.content, 2400),
        actionUrl: '/guides',
        relatedType: 'guide',
        relatedId: text(row.id, 80),
      }));
    }
    for (const row of rows(siteMessagesResult)) {
      items.push(submission(row, {
        kind: 'feedback',
        group: 'governance',
        typeLabel: '建议反馈',
        title: `建议反馈 · ${text(row.subject, 160) || '未命名反馈'}`,
        actionUrl: '/contact',
        relatedType: 'site_message',
        relatedId: text(row.id, 80),
      }));
    }
    for (const row of rows(certificationsResult)) {
      const label = text(row.type, 30) === 'shop' ? '店家认证' : text(row.type, 30) === 'realname' ? '实名验证' : 'DM认证';
      items.push(submission(row, {
        kind: 'certification',
        group: 'profile',
        typeLabel: label,
        title: label,
        actionUrl: '/dashboard/certification',
        relatedType: 'certification',
        relatedId: text(row.id, 80),
      }));
    }
    for (const row of rows(dossierClaimsResult)) {
      const dossierId = text(row.dossier_id, 80);
      const dossier = dossierById.get(dossierId) || {};
      const isStore = text(row.entity_type, 30) === 'store';
      items.push(submission(row, {
        kind: 'dossier_claim',
        group: 'profile',
        typeLabel: isStore ? '店家认领' : 'DM认领',
        title: `${isStore ? '店家认领' : 'DM认领'} · ${text(dossier.dm_name, 120) || '未命名档案'}`,
        content: text(row.claim_note, 2400),
        thumbnailUrl: firstPublicImage(dossier.photo_files, dossier.photo_url),
        actionUrl: dossierId ? `/${isStore ? 'stores' : 'dm'}/${dossierId}` : `/${isStore ? 'stores' : 'dm'}`,
        relatedType: isStore ? 'store_dossier' : 'dm_dossier',
        relatedId: dossierId || null,
        metadata: { dossier_id: dossierId || null, entity_type: isStore ? 'store' : 'dm' },
      }));
    }
    for (const row of rows(dossiersResult)) {
      const isStore = text(row.entity_type, 30) === 'store';
      const dossierId = text(row.id, 80);
      items.push(submission(row, {
        kind: isStore ? 'store_dossier' : 'dm_dossier',
        group: 'publication',
        typeLabel: isStore ? '店家建档' : 'DM建档',
        title: `${isStore ? '店家建档' : 'DM建档'} · ${text(row.dm_name, 120) || '未命名档案'}`,
        content: text(row.note, 2400),
        actionUrl: `/${isStore ? 'stores' : 'dm'}/${dossierId}`,
        relatedType: isStore ? 'store_dossier' : 'dm_dossier',
        relatedId: dossierId,
        metadata: { dossier_id: dossierId, entity_type: isStore ? 'store' : 'dm' },
      }));
    }

    const publicReviewLabels: Record<string, {
      kind: string;
      group: AccountSubmissionGroup;
      typeLabel: string;
      actionUrl: string;
    }> = {
      profile_update: { kind: 'profile_update', group: 'profile', typeLabel: '主页资料', actionUrl: '/dashboard/profile' },
      dossier_update: { kind: 'dossier_edit', group: 'profile', typeLabel: '档案修改', actionUrl: '/dm' },
      provider_listing_update: { kind: 'provider_listing', group: 'publication', typeLabel: '委托条', actionUrl: '/dashboard/services' },
      service_create: { kind: 'service_create', group: 'profile', typeLabel: '服务资料', actionUrl: '/dashboard/services' },
      portfolio_create: { kind: 'portfolio_create', group: 'profile', typeLabel: '作品资料', actionUrl: '/dashboard/services/works' },
      availability_create: { kind: 'availability_create', group: 'profile', typeLabel: '可约时间', actionUrl: '/dashboard/services/availability' },
      tag_create: { kind: 'tag_create', group: 'profile', typeLabel: '标签共建', actionUrl: '/dashboard/profile' },
      script_rating_upsert: { kind: 'script_rating', group: 'rating', typeLabel: '剧本评分', actionUrl: '/scripts' },
      entity_rating_upsert: { kind: 'role_rating', group: 'rating', typeLabel: '角色点评', actionUrl: '/scripts' },
      rating_discussion_create: { kind: 'rating_discussion', group: 'interaction', typeLabel: '评分讨论', actionUrl: '/scripts' },
    };
    for (const row of rows(publicReviewsResult)) {
      const targetType = text(row.target_type, 80);
      const definition = publicReviewLabels[targetType];
      if (!definition) continue;
      const payload = objectPayload(row.payload);
      const dossierId = text(payload.dossier_id, 80);
      const dossier = dossierById.get(dossierId) || {};
      const entityMetadata = objectPayload(payload.entity_metadata);
      const targetId = text(payload.target_id, 120);
      const roleName = text(entityMetadata.role_name, 120);
      const scriptName = text(entityMetadata.script_name || payload.script_name, 120);
      const isStore = text(payload.entity_type, 30) === 'store' || text(dossier.entity_type, 30) === 'store';
      let actionUrl = definition.actionUrl;
      if (targetType === 'dossier_update' && dossierId) actionUrl = `/${isStore ? 'stores' : 'dm'}/${dossierId}`;
      if (targetType === 'entity_rating_upsert' && targetId) actionUrl = `/scripts/roles/${targetId}`;
      const title = targetType === 'dossier_update'
        ? `档案修改 · ${text(payload.dossier_name || dossier.dm_name, 120) || '资料修改'}`
        : targetType === 'entity_rating_upsert'
          ? `角色点评 · ${scriptName ? `《${scriptName}》` : ''}${roleName || text(payload.target_title, 120) || '角色'}`
          : text(row.title, 180) || definition.typeLabel;
      items.push(submission(row, {
        kind: definition.kind,
        group: definition.group,
        typeLabel: definition.typeLabel,
        title,
        content: text(row.summary || payload.content || payload.edit_reason, 2400),
        thumbnailUrl: firstPublicImage(payload.photo_files, payload.display_files, payload.files, payload.photo_url, dossier.photo_files, dossier.photo_url),
        actionUrl,
        relatedType: targetType,
        relatedId: dossierId || targetId || text(payload.script_id, 120) || text(row.id, 80),
        metadata: {
          dossier_id: dossierId || null,
          entity_type: isStore ? 'store' : 'dm',
          target_id: targetId || null,
          script_id: text(entityMetadata.script_id || payload.script_id, 120) || null,
        },
      }));
    }

    const providerReviews = items.filter(item => item.kind === 'provider_listing');
    const providerPurchase = providerPurchaseResult.data && typeof providerPurchaseResult.data === 'object'
      ? providerPurchaseResult.data as Record<string, unknown>
      : null;
    if (providerReviews.length === 0 && !providerListingResult.data && text(providerPurchase?.status, 30) === 'paid') {
      const paidAt = text(providerPurchase?.paid_at || providerPurchase?.created_at, 80);
      items.push({
        id: text(providerPurchase?.id, 80),
        kind: 'provider_listing',
        group: 'publication',
        type_label: '委托条',
        title: '委托条 · 已付费待补交',
        content: '付款资格已经保留，请补齐主图、资料和业务联系方式后提交审核。',
        status: 'needs_submission',
        state: 'action',
        created_at: paidAt,
        updated_at: null,
        reject_reason: null,
        thumbnail_url: null,
        action_url: '/dashboard/services',
        related_type: 'provider_listing',
        related_id: text(profile.id, 80),
        metadata: {},
      });
    }

    const sortedItems = sortAccountSubmissions(items);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(ok({ items: sortedItems, summary: summarizeAccountSubmissions(sortedItems) }));
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
      if (restrictionBlocksLogin(existing)) {
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
      .select('id, display_name, avatar, phone, phone_verified_at, email, email_verified_at, password_hash, is_realname, city, available_cities, role, role_type, identity_roles, verified_dm, verified_shop, referral_code, community_role, community_role_expires_at, profile_setup_completed, wechat_openid, wechat_unionid, wechat_mini_openid, wechat_nickname, wechat_bound_at')
      .eq('id', getReq(req, 'creatorId'))
      .single();
    if (!data) return res.json(ok(null));
    const ownerProfile = sanitizeProfile(data, true);
    delete ownerProfile.wechat_openid;
    delete ownerProfile.wechat_unionid;
    delete ownerProfile.wechat_mini_openid;
    res.json(ok({
      ...ownerProfile,
      wechat_bound: Boolean(data.wechat_openid || data.wechat_unionid || data.wechat_mini_openid),
      wechat_web_binding_available: isWechatLoginConfigured(),
      wechat_nickname: data.wechat_nickname || null,
      wechat_bound_at: data.wechat_bound_at || null,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/follows', authMiddleware, async (req, res) => {
  try {
    const profileId = getReq(req, 'creatorId');
    const [cityResult, storeResult] = await Promise.all([
      supabase.from('lc_profile_city_follows').select('city, created_at').eq('profile_id', profileId).order('created_at', { ascending: true }),
      supabase.from('lc_store_follows').select('store_dossier_id, created_at').eq('profile_id', profileId).order('created_at', { ascending: false }),
    ]);
    if (cityResult.error && !isMissingRelation(cityResult.error, 'lc_profile_city_follows')) throw cityResult.error;
    if (storeResult.error && !isMissingRelation(storeResult.error, 'lc_store_follows')) throw storeResult.error;
    const cities = cityResult.error ? [] : (cityResult.data || []).map(item => cleanText(item.city, 40)).filter(Boolean);
    const storeIds = storeResult.error ? [] : (storeResult.data || []).map(item => item.store_dossier_id).filter(Boolean);
    const dossierResult = storeIds.length > 0
      ? await supabase.from('lc_dm_dossiers').select('id, dm_name, city, workplace, photo_url, status, entity_type').in('id', storeIds).eq('entity_type', 'store').eq('status', 'approved')
      : { data: [], error: null };
    if (dossierResult.error) throw dossierResult.error;
    const dossierMap = new Map((dossierResult.data || []).map(item => [item.id, item]));
    res.json(ok({
      cities,
      stores: storeIds.map(id => dossierMap.get(id)).filter(Boolean),
      onboarding_required: cities.length === 0,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/follows/cities', authMiddleware, async (req, res) => {
  const client = await tencentPgPool.connect();
  try {
    const profileId = getReq(req, 'creatorId');
    const cities = normalizeActivityCities(req.body?.cities).filter(city => DOSSIER_CITY_VALUES.has(city)).slice(0, 5);
    if (cities.length === 0) return res.status(400).json(err(new Error('请至少关注一个城市')));
    await client.query('BEGIN');
    await client.query('DELETE FROM lc_profile_city_follows WHERE profile_id = $1', [profileId]);
    await client.query(
      `INSERT INTO lc_profile_city_follows (profile_id, city)
       SELECT $1, city FROM unnest($2::text[]) AS city`,
      [profileId, cities],
    );
    await client.query('COMMIT');
    await logSecurityEvent(req, {
      action: 'followed_cities_updated',
      actorId: profileId,
      targetType: 'profile_city_follows',
      targetId: profileId,
      metadata: { city_count: cities.length },
    });
    res.json(ok({ cities, onboarding_required: false }));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    res.status(500).json(err(e));
  } finally {
    client.release();
  }
});

app.put('/api/lc/follows/stores/:id', authMiddleware, async (req, res) => {
  try {
    const profileId = getReq(req, 'creatorId');
    const following = req.body?.following !== false;
    const { data: store, error: storeErr } = await supabase.from('lc_dm_dossiers')
      .select('id, dm_name, city, workplace, photo_url, status, entity_type')
      .eq('id', req.params.id)
      .eq('entity_type', 'store')
      .eq('status', 'approved')
      .maybeSingle();
    if (storeErr) throw storeErr;
    if (!store) return res.status(404).json(err(new Error('店家档案不存在')));
    const result = following
      ? await supabase.from('lc_store_follows').upsert({ profile_id: profileId, store_dossier_id: store.id }, { onConflict: 'profile_id,store_dossier_id' })
      : await supabase.from('lc_store_follows').delete().eq('profile_id', profileId).eq('store_dossier_id', store.id);
    if (result.error && isMissingRelation(result.error, 'lc_store_follows')) return res.status(503).json(err(new Error('关注店家数据表尚未初始化')));
    if (result.error) throw result.error;
    await logSecurityEvent(req, {
      action: following ? 'store_followed' : 'store_unfollowed',
      actorId: profileId,
      targetType: 'store_dossier',
      targetId: store.id,
    });
    res.json(ok({ following, store }));
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

app.get('/api/lc/admin/wechat-content-checks', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const status = cleanText(req.query.status, 20);
    const checkType = cleanText(req.query.check_type ?? req.query.checkType, 20);
    const limit = Math.min(200, Math.max(1, Number.parseInt(cleanText(req.query.limit, 8), 10) || 80));
    let query = supabase.from('lc_wechat_content_checks')
      .select('id, profile_id, check_type, business_scene, target_type, target_id, provider, status, suggest, label, trace_id, errcode, error_message, checked_at, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (['pending', 'pass', 'review', 'risky', 'error'].includes(status)) query = query.eq('status', status);
    if (['text', 'image'].includes(checkType)) query = query.eq('check_type', checkType);
    const result = await query;
    if (result.error && isMissingRelation(result.error, 'lc_wechat_content_checks')) {
      return res.status(503).json(err(new Error('微信内容安全审计表尚未初始化')));
    }
    if (result.error) throw result.error;
    const profileIds = Array.from(new Set((result.data || [])
      .map(row => cleanText(row.profile_id, 80))
      .filter(Boolean)));
    const profileResult = profileIds.length > 0
      ? await supabase.from('lc_profiles').select('id, display_name').in('id', profileIds)
      : { data: [], error: null };
    if (profileResult.error) throw profileResult.error;
    const names = new Map((profileResult.data || []).map(row => [String(row.id), cleanText(row.display_name, 80) || '用户']));
    res.json(ok((result.data || []).map(row => ({
      ...row,
      profile_name: names.get(String(row.profile_id || '')) || null,
    }))));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 委托师委托条与私密联系 ====================

function publicProviderProfile(profile: Record<string, unknown>) {
  return sanitizeProfile(profile);
}

async function notifyProfile(input: {
  profileId: string;
  type: string;
  title: string;
  content: string;
  relatedType: string;
  relatedId?: string | null;
  actionUrl?: string;
}) {
  const { error: notificationErr } = await supabase.from('lc_account_notifications').insert({
    profile_id: input.profileId,
    type: input.type,
    title: input.title,
    content: input.content,
    action_url: input.actionUrl || '/commissions?view=mine',
    related_type: input.relatedType,
    related_id: input.relatedId || null,
  });
  if (notificationErr && !isMissingRelation(notificationErr, 'lc_account_notifications')) {
    console.error('[provider-notification] failed to create notification', notificationErr);
  }
}

app.get('/api/lc/provider-listings', async (req, res) => {
  try {
    const city = cleanText(req.query.city, 60);
    const query = cleanText(req.query.query, 120).toLocaleLowerCase('zh-CN');
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30));
    const listingResult = await supabase.from('lc_provider_listings')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(300);
    if (listingResult.error && isMissingRelation(listingResult.error, 'lc_provider_listings')) return res.json(ok([]));
    if (listingResult.error) throw listingResult.error;
    const profileIds = (listingResult.data || []).map(item => item.profile_id).filter(Boolean);
    if (profileIds.length === 0) return res.json(ok([]));
    const profileResult = await supabase.from('lc_profiles').select('*').in('id', profileIds).eq('is_visible', true);
    if (profileResult.error) throw profileResult.error;
    const profileMap = new Map((profileResult.data || []).map(profile => [String(profile.id), profile as Record<string, unknown>]));
    const items = (listingResult.data || []).flatMap(row => {
      const profile = profileMap.get(String(row.profile_id));
      if (!profile) return [];
      const availableCities = publicStringArray(profile.available_cities);
      if (city && city !== '全部城市' && profile.city !== city && !availableCities.includes(city)) return [];
      const listing = publicProviderListing(row as Record<string, unknown>);
      if (query) {
        const haystack = [
          profile.display_name,
          profile.city,
          profile.bio,
          listing.headline,
          listing.description,
          ...listing.role_types,
        ].map(value => cleanText(value, 1200)).join(' ').toLocaleLowerCase('zh-CN');
        if (!haystack.includes(query)) return [];
      }
      const safeProfile = publicProviderProfile(profile);
      if (city && city !== '全部城市') safeProfile.commission_match = commissionCityMatch(profile, city);
      return [{ ...listing, profile: safeProfile }];
    }).slice(0, limit);
    res.json(ok(items));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/provider-listings/mine', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const [listingResult, reviewResult, contactResult, purchase, dossierDefaultsResult, servicesResult] = await Promise.all([
      supabase.from('lc_provider_listings').select('*').eq('profile_id', profile.id).maybeSingle(),
      supabase.from('lc_public_reviews')
        .select('id, status, summary, created_at, reviewed_at, review_note')
        .eq('target_type', 'provider_listing_update')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('lc_provider_contacts')
        .select('business_contact, is_available, reviewed_at, updated_at')
        .eq('profile_id', profile.id)
        .maybeSingle(),
      findServicePurchase(profile.id, 'provider_listing', profile.id),
      supabase.from('lc_dm_dossiers')
        .select('photo_url, height_cm, weight_kg, bio')
        .eq('claimed_by', profile.id)
        .eq('claim_status', 'approved')
        .eq('entity_type', 'dm')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('lc_services')
        .select('service_type, description')
        .eq('creator_id', profile.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(12),
    ]);
    if (listingResult.error && isMissingRelation(listingResult.error, 'lc_provider_listings')) {
      return res.status(503).json(err(new Error('委托条数据表尚未初始化')));
    }
    if (listingResult.error) throw listingResult.error;
    if (reviewResult.error && !isMissingRelation(reviewResult.error, 'lc_public_reviews')) throw reviewResult.error;
    if (contactResult.error && !isMissingRelation(contactResult.error, 'lc_provider_contacts')) throw contactResult.error;
    if (dossierDefaultsResult.error && !isMissingRelation(dossierDefaultsResult.error, 'lc_dm_dossiers')) throw dossierDefaultsResult.error;
    if (servicesResult.error && !isMissingRelation(servicesResult.error, 'lc_services')) throw servicesResult.error;
    const feePaid = Boolean(listingResult.data || (purchase && servicePurchaseGrantsAccess(purchase.status)));
    const dossierDefaults = dossierDefaultsResult.error ? null : dossierDefaultsResult.data;
    const serviceRows = servicesResult.error ? [] : servicesResult.data || [];
    res.json(ok({
      listing: listingResult.data ? publicProviderListing(listingResult.data as Record<string, unknown>) : null,
      latest_review: reviewResult.error ? null : reviewResult.data,
      business_contact: contactResult.error ? null : contactResult.data?.business_contact || null,
      contact_available: contactResult.error ? false : contactResult.data?.is_available !== false,
      initial_fee_paid: feePaid,
      initial_fee_yuan: SERVICE_FEE_YUAN,
      profile_defaults: {
        headline: cleanText(dossierDefaults?.bio || profile.bio, 80) || null,
        description: null,
        height_cm: dossierDefaults?.height_cm ?? null,
        weight_kg: dossierDefaults?.weight_kg ?? null,
        role_types: Array.from(new Set(serviceRows.map(item => cleanText(item.service_type, 30)).filter(Boolean))).slice(0, 12),
      },
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post(
  '/api/lc/provider-listings/mine',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'provider_listing_submit',
    targetType: 'provider_listing',
    content: req => [
      req.body?.headline,
      req.body?.description,
      req.body?.roleTypes ?? req.body?.role_types,
    ],
  }),
  async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    let draft;
    try {
      draft = normalizeProviderListingDraft(req.body);
    } catch (validationError) {
      return res.status(400).json(err(validationError));
    }
    const posterUrl = normalizeOptionalPublicUrl(draft.poster_url, 1200, true);
    if (!posterUrl) return res.status(400).json(err(new Error('委托条主图地址不正确，请重新上传')));
    draft.poster_url = posterUrl;
    const businessContact = cleanText(req.body?.businessContact ?? req.body?.business_contact, 300);
    if (!businessContact) return res.status(400).json(err(new Error('请填写用于付费解锁的业务联系方式')));

    const [pendingResult, listingResult, paidPurchase] = await Promise.all([
      supabase.from('lc_public_reviews')
        .select('id')
        .eq('target_type', 'provider_listing_update')
        .eq('profile_id', profile.id)
        .eq('status', 'pending')
        .maybeSingle(),
      supabase.from('lc_provider_listings').select('profile_id').eq('profile_id', profile.id).maybeSingle(),
      paidServicePurchase(profile.id, 'provider_listing', profile.id),
    ]);
    if (pendingResult.error && !isMissingRelation(pendingResult.error, 'lc_public_reviews')) throw pendingResult.error;
    if (pendingResult.data) return res.status(409).json(err(new Error('你已有一版委托条正在审核，请等待处理后再修改')));
    if (listingResult.error && !isMissingRelation(listingResult.error, 'lc_provider_listings')) throw listingResult.error;
    if (!listingResult.data && !paidPurchase) {
      return res.status(402).json(codedErr(
        new Error(`首次上架委托条需在微信小程序支付 ${SERVICE_FEE_YUAN} 元，后续修改不再收费但仍需审核`),
        'SERVICE_PAYMENT_REQUIRED',
        { product_type: 'provider_listing', target_id: profile.id, amount_fen: SERVICE_FEE_FEN },
      ));
    }

    await ensureWechatMiniImageSafetyChecks(req, {
      urls: [draft.poster_url],
      businessScene: 'provider_listing_image_submit',
      targetType: 'provider_listing_update',
    });
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'provider_listing_submit',
      targetType: 'provider_listing',
      texts: {
        headline: draft.headline,
        description: draft.description,
        role_types: draft.role_types.join(' '),
      },
      files: [{ url: draft.poster_url, type: 'image/*' }],
    });
    const review = await createPublicReview({
      targetType: 'provider_listing_update',
      profile,
      title: '委托师委托条',
      summary: '委托条主图、身高体重与擅长角色类型',
      payload: {
        profile_id: profile.id,
        ...draft,
        business_contact: businessContact,
        contact_available: req.body?.contactAvailable !== false && req.body?.contact_available !== false,
        initial_purchase_id: paidPurchase?.id || null,
        is_active: true,
      },
      moderationPrecheck,
    });
    await logSecurityEvent(req, {
      action: 'provider_listing_submitted_for_review',
      actorId: profile.id,
      actorRole: profileAuthRole(profile),
      targetType: 'public_review',
      targetId: review?.id,
      metadata: { review_type: 'provider_listing_update', moderation: moderationPrecheck.decision },
    });
    res.status(201).json(ok({ review_id: review?.id, status: 'pending' }));
  } catch (e) { res.status(500).json(err(e)); }
  },
);

app.put('/api/lc/provider-listings/mine/active', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const active = req.body?.active !== false;
    const { data, error: updateErr } = await supabase.from('lc_provider_listings')
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq('profile_id', profile.id)
      .select('*')
      .maybeSingle();
    if (updateErr && isMissingRelation(updateErr, 'lc_provider_listings')) return res.status(503).json(err(new Error('委托条数据表尚未初始化')));
    if (updateErr) throw updateErr;
    if (!data) return res.status(404).json(err(new Error('你还没有审核通过的委托条')));
    await logSecurityEvent(req, {
      action: active ? 'provider_listing_published' : 'provider_listing_hidden',
      actorId: profile.id,
      targetType: 'provider_listing',
      targetId: profile.id,
    });
    res.json(ok(publicProviderListing(data as Record<string, unknown>)));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/provider-listings/mine/contact-available', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const available = req.body?.available !== false;
    const result = await supabase.from('lc_provider_contacts')
      .update({ is_available: available, updated_at: new Date().toISOString() })
      .eq('profile_id', profile.id)
      .select('business_contact, is_available, updated_at')
      .maybeSingle();
    if (result.error && isMissingRelation(result.error, 'lc_provider_contacts')) return res.status(503).json(err(new Error('委托师联系方式数据表尚未初始化')));
    if (result.error) throw result.error;
    if (!result.data) return res.status(404).json(err(new Error('请先提交并通过委托条审核')));
    await logSecurityEvent(req, {
      action: available ? 'provider_contact_resumed' : 'provider_contact_paused',
      actorId: profile.id,
      targetType: 'provider_listing',
      targetId: profile.id,
    });
    res.json(ok({ contact_available: result.data.is_available, updated_at: result.data.updated_at }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/provider-listings/:id/contact-access', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    if (profile.id === req.params.id) {
      const contact = await providerBusinessContact(profile.id);
      return res.json(ok({
        paid: true,
        owner: true,
        contact_available: Boolean(contact?.is_available && contact?.business_contact),
        business_contact: contact?.is_available ? cleanText(contact.business_contact, 300) || null : null,
      }));
    }
    const purchase = await findServicePurchase(profile.id, 'provider_contact', req.params.id);
    if (!purchase || !servicePurchaseGrantsAccess(purchase.status)) {
      return res.json(ok({
        paid: false,
        owner: false,
        amount_fen: SERVICE_FEE_FEN,
        amount_yuan: SERVICE_FEE_YUAN,
        business_contact: null,
      }));
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(ok(await servicePurchaseStatusPayload(purchase)));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/provider-listings/:id/inquiries-legacy-disabled', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    if (profile.id === req.params.id) return res.status(400).json(err(new Error('不能向自己发起联系申请')));
    const message = cleanText(req.body?.message, 1200);
    const privateContact = cleanText(req.body?.privateContact ?? req.body?.private_contact, 300);
    if (!message) return res.status(400).json(err(new Error('请填写想咨询的内容')));
    if (!privateContact) return res.status(400).json(err(new Error('请留下同意后用于联系的方式')));
    const listingResult = await supabase.from('lc_provider_listings')
      .select('profile_id, is_active')
      .eq('profile_id', req.params.id)
      .eq('is_active', true)
      .maybeSingle();
    if (listingResult.error && isMissingRelation(listingResult.error, 'lc_provider_listings')) return res.status(503).json(err(new Error('委托条数据表尚未初始化')));
    if (listingResult.error) throw listingResult.error;
    if (!listingResult.data) return res.status(404).json(err(new Error('这位委托师当前没有公开委托条')));
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'provider_inquiry_send',
      targetType: 'provider_inquiry',
      texts: { message, private_contact: privateContact },
      allowContact: true,
    });
    if (moderationPrecheck.decision === 'block') {
      return res.status(400).json(err(new Error('申请内容包含不适合发送的信息，请修改后再试')));
    }
    const { data, error: insertErr } = await supabase.from('lc_provider_inquiries').insert({
      provider_id: req.params.id,
      requester_id: profile.id,
      requester_name: cleanText(profile.display_name, 120) || '用户',
      message,
      requester_private_contact: privateContact,
    }).select('*').single();
    if (insertErr) {
      if (insertErr.code === '23505') return res.status(409).json(err(new Error('你已有一条等待对方处理的联系申请')));
      if (isMissingRelation(insertErr, 'lc_provider_inquiries')) return res.status(503).json(err(new Error('委托联系数据表尚未初始化')));
      throw insertErr;
    }
    await notifyProfile({
      profileId: req.params.id,
      type: 'provider_inquiry_received',
      title: '收到新的委托咨询',
      content: `${cleanText(profile.display_name, 120) || '一位用户'}向你的委托条发起了联系申请。`,
      relatedType: 'provider_inquiry',
      relatedId: data?.id,
    });
    await logSecurityEvent(req, {
      action: 'provider_inquiry_submitted',
      actorId: profile.id,
      actorRole: profileAuthRole(profile),
      targetType: 'provider_inquiry',
      targetId: data?.id,
      metadata: { provider_id: req.params.id, moderation: moderationPrecheck.decision },
    });
    res.status(201).json(ok(providerInquiryPayload(data as Record<string, unknown>)));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/provider-inquiries/received', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const result = await supabase.from('lc_provider_inquiries')
      .select('*')
      .eq('provider_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (result.error && isMissingRelation(result.error, 'lc_provider_inquiries')) return res.json(ok([]));
    if (result.error) throw result.error;
    res.json(ok((result.data || []).map(row => providerInquiryPayload(row as Record<string, unknown>, {
      requester: row.requester_private_contact,
      provider: row.provider_private_contact,
    }))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/provider-inquiries/sent', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const result = await supabase.from('lc_provider_inquiries')
      .select('*')
      .eq('requester_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (result.error && isMissingRelation(result.error, 'lc_provider_inquiries')) return res.json(ok([]));
    if (result.error) throw result.error;
    const providerIds = Array.from(new Set((result.data || []).map(row => row.provider_id).filter(Boolean)));
    const providerResult = providerIds.length > 0
      ? await supabase.from('lc_profiles').select('id, display_name, avatar, city').in('id', providerIds)
      : { data: [], error: null };
    if (providerResult.error) throw providerResult.error;
    const providerMap = new Map((providerResult.data || []).map(item => [String(item.id), item]));
    res.json(ok((result.data || []).map(row => ({
      ...providerInquiryPayload(row as Record<string, unknown>, {
        requester: row.requester_private_contact,
        provider: row.provider_private_contact,
      }),
      provider: providerMap.get(String(row.provider_id)) || null,
    }))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/provider-inquiries/:id/decision', authMiddleware, async (req, res) => {
  const client = await tencentPgPool.connect();
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const decision = cleanText(req.body?.decision, 20);
    if (decision !== 'accepted' && decision !== 'rejected') {
      return res.status(400).json(err(new Error('请选择同意或拒绝')));
    }
    const providerContact = decision === 'accepted'
      ? cleanText(req.body?.privateContact ?? req.body?.private_contact, 300)
      : '';
    if (decision === 'accepted' && !providerContact) {
      return res.status(400).json(err(new Error('同意前请留下你的联系方式')));
    }
    await client.query('begin');
    const locked = await client.query<{
      id: string;
      provider_id: string;
      requester_id: string;
      requester_name: string;
      message: string;
      requester_private_contact: string;
      provider_private_contact: string | null;
      status: string;
      created_at: string;
    }>(
      `select *
         from lc_provider_inquiries
        where id = $1
        for update`,
      [req.params.id],
    );
    const row = locked.rows[0];
    if (!row) throw Object.assign(new Error('联系申请不存在'), { statusCode: 404 });
    if (row.provider_id !== profile.id) throw Object.assign(new Error('只能处理发给自己的联系申请'), { statusCode: 403 });
    if (row.status !== 'submitted') throw Object.assign(new Error('这条申请已经处理过'), { statusCode: 409 });
    const updated = await client.query<Record<string, unknown>>(
      `update lc_provider_inquiries
          set status = $2,
              provider_private_contact = case when $2 = 'accepted' then $3 else null end,
              decided_at = now(),
              contact_unlocked_at = case when $2 = 'accepted' then now() else null end,
              updated_at = now()
        where id = $1
        returning *`,
      [req.params.id, decision, providerContact || null],
    );
    await client.query(
      `insert into lc_account_notifications
         (profile_id, type, title, content, action_url, related_type, related_id)
       values ($1, $2, $3, $4, '/commissions?view=mine', 'provider_inquiry', $5)`,
      [
        row.requester_id,
        decision === 'accepted' ? 'provider_inquiry_accepted' : 'provider_inquiry_rejected',
        decision === 'accepted' ? '委托师已同意联系' : '委托师暂未接受联系',
        decision === 'accepted'
          ? '双方联系方式已经解锁，可以在“委托-申请与处理”中查看。'
          : '对方暂未接受这次联系申请，你可以继续浏览其他委托师。',
        req.params.id,
      ],
    );
    await client.query('commit');
    const responseRow = updated.rows[0];
    await logSecurityEvent(req, {
      action: decision === 'accepted' ? 'provider_inquiry_accepted' : 'provider_inquiry_rejected',
      actorId: profile.id,
      actorRole: profileAuthRole(profile),
      targetType: 'provider_inquiry',
      targetId: req.params.id,
    });
    res.json(ok(providerInquiryPayload(responseRow, {
      requester: responseRow.requester_private_contact,
      provider: responseRow.provider_private_contact,
    })));
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    const statusCode = e && typeof e === 'object' && 'statusCode' in e
      ? Number((e as { statusCode?: unknown }).statusCode) || 500
      : 500;
    res.status(statusCode).json(err(e));
  } finally {
    client.release();
  }
});

// ==================== 创作者列表（分页） ====================

app.get('/api/lc/creators', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const city = cleanText(req.query.city, 60);
    const followedCities = normalizeActivityCities(req.query.cities).filter(item => DOSSIER_CITY_VALUES.has(item));
    const serviceOnly = req.query.serviceOnly === 'true';

    const { data: serviceRows, error: serviceErr } = await supabase
      .from('lc_services')
      .select('id, creator_id, service_type, price, duration, description, is_active')
      .eq('is_active', true);
    if (serviceErr) throw serviceErr;

    const serviceTypesByCreator = new Map<string, string[]>();
    const servicesByCreator = new Map<string, Record<string, unknown>[]>();
    for (const row of (serviceRows || []) as Array<Record<string, unknown>>) {
      if (!row.creator_id) continue;
      const creatorId = String(row.creator_id);
      const current = serviceTypesByCreator.get(creatorId) || [];
      current.push(cleanText(row.service_type, 80));
      serviceTypesByCreator.set(creatorId, current);
      const creatorServices = servicesByCreator.get(creatorId) || [];
      creatorServices.push({
        id: row.id,
        creator_id: creatorId,
        service_type: cleanText(row.service_type, 80),
        price: row.price,
        duration: cleanText(row.duration, 120) || null,
        description: cleanText(row.description, 1000) || null,
        is_active: true,
      });
      servicesByCreator.set(creatorId, creatorServices);
    }
    const providerListingResult = await supabase.from('lc_provider_listings')
      .select('*')
      .eq('is_active', true);
    if (providerListingResult.error && !isMissingRelation(providerListingResult.error, 'lc_provider_listings')) {
      throw providerListingResult.error;
    }
    const providerListingsByCreator = new Map<string, ReturnType<typeof publicProviderListing>>();
    if (!providerListingResult.error) {
      for (const row of (providerListingResult.data || []) as Array<Record<string, unknown>>) {
        const creatorId = cleanText(row.profile_id, 80);
        if (creatorId) providerListingsByCreator.set(creatorId, publicProviderListing(row));
      }
    }

    const { data } = await supabase
      .from('lc_profiles')
      .select('*')
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .limit(500);

    const visibleProfiles = (data || []).filter((profile: Record<string, unknown>) => {
      if (serviceOnly && !servicesByCreator.has(String(profile.id)) && !providerListingsByCreator.has(String(profile.id))) return false;
      const requestedCities = city ? [city] : followedCities;
      if (requestedCities.length === 0) return true;
      const availableCities = Array.isArray(profile.available_cities) ? profile.available_cities : [];
      return requestedCities.some(item => profile.city === item || availableCities.includes(item));
    }).sort((left: Record<string, unknown>, right: Record<string, unknown>) => {
      const score = (profile: Record<string, unknown>) =>
        (cleanText(profile.avatar, 1000) ? 4 : 0)
        + (cleanText(profile.bio, 1000) ? 3 : 0)
        + (publicStringArray(profile.tags).length > 0 ? 2 : 0)
        + ((servicesByCreator.get(String(profile.id)) || []).length > 0 ? 3 : 0)
        + (providerListingsByCreator.has(String(profile.id)) ? 4 : 0);
      const scoreDiff = score(right) - score(left);
      if (scoreDiff !== 0) return scoreDiff;
      return cleanText(right.created_at, 80).localeCompare(cleanText(left.created_at, 80));
    });
    const total = visibleProfiles.length;
    const offset = (page - 1) * limit;
    const pagedItems = visibleProfiles.slice(offset, offset + limit);

    res.json(ok({
      items: pagedItems.map(profile => {
        const serviceRoles = identityRolesFromServices(serviceTypesByCreator.get(String(profile.id)) || []);
        const safeProfile = sanitizeProfile({
          ...profile,
          identity_roles: mergeIdentityRoles(profile.identity_roles, serviceRoles),
          services: servicesByCreator.get(String(profile.id)) || [],
        });
        safeProfile.provider_listing = providerListingsByCreator.get(String(profile.id)) || null;
        const requestedCity = city || (followedCities.length === 1 ? followedCities[0] : '');
        if (requestedCity) safeProfile.commission_match = commissionCityMatch(profile, requestedCity);
        return safeProfile;
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
    const viewerId = await getOptionalCreatorId(req);
    if (!profile.is_visible && viewerId !== profile.id) return res.status(404).json(err(new Error('该主页暂未公开')));
    const profilePayload = sanitizeProfile(profile);

    const [{ data: services }, { data: portfolio }, { data: pendingCerts }, { data: pendingDmClaims }, rolePreferences, providerListingResult] = await Promise.all([
      supabase.from('lc_services').select('*').eq('creator_id', req.params.id).eq('is_active', true),
      supabase.from('lc_portfolio').select('*').eq('creator_id', req.params.id).order('created_at', { ascending: false }),
      supabase.from('lc_certifications').select('type, status').eq('profile_id', req.params.id).eq('status', 'pending'),
      supabase.from('lc_dm_dossier_claims').select('id').eq('claimant_id', req.params.id).eq('entity_type', 'dm').eq('status', 'pending').limit(1),
      loadProfileRolePreferences(req.params.id),
      supabase.from('lc_provider_listings').select('*').eq('profile_id', req.params.id).eq('is_active', true).maybeSingle(),
    ]);
    if (providerListingResult.error && !isMissingRelation(providerListingResult.error, 'lc_provider_listings')) throw providerListingResult.error;

    const hasPendingShopCert = (pendingCerts || []).some((c: { type: string }) => c.type === 'shop');
    const hasPendingDmCert = (pendingCerts || []).some((c: { type: string }) => c.type === 'dm') || (pendingDmClaims || []).length > 0;
    const serviceRoles = identityRolesFromServices((services || []).map((service: { service_type?: string | null }) => service.service_type || ''));

    res.json(ok({
      ...profilePayload,
      identity_roles: mergeIdentityRoles(profilePayload.identity_roles, serviceRoles),
      services: services || [],
      portfolio: portfolio || [],
      role_preferences: rolePreferences || [],
      provider_listing: providerListingResult.error || !providerListingResult.data
        ? null
        : publicProviderListing(providerListingResult.data as Record<string, unknown>),
      has_pending_shop_cert: hasPendingShopCert,
      has_pending_dm_cert: hasPendingDmCert,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 更新创作者资料（需登录） ====================

const PROFILE_REVIEW_FIELD_LABELS: Record<string, string> = {
  display_name: '昵称', avatar: '头像', bio: '个人简介', tags: '个人标签', city: '常驻城市',
  social_links: '社交主页', wechat: '微信号', available_cities: '可服务城市', travel_status: '活动状态',
  contact_unlock_enabled: '联系方式解锁', contact_intent_amount: '联系意向金额', gender: '性别',
  sexual_orientation: '性取向', preferred_story_lines: '偏好故事线', avatar_focus_x: '头像展示位置',
  avatar_focus_y: '头像展示位置',
};

function profileReviewComparableValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  if (Array.isArray(value)) return value.length > 0 ? JSON.stringify(value) : '';
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined && item !== null && item !== '');
    return entries.length > 0 ? JSON.stringify(Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)))) : '';
  }
  return String(value);
}

app.put(
  '/api/lc/creators/:id',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'profile_update',
    targetType: 'profile',
    content: req => [
      req.body?.display_name,
      req.body?.bio,
      req.body?.tags,
      req.body?.city,
      req.body?.available_cities,
      req.body?.preferred_story_lines,
    ],
  }),
  async (req, res) => {
  try {
    if (getReq(req, 'creatorId') !== req.params.id) {
      return res.status(403).json(err(new Error('只能修改自己的资料')));
    }
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    if (profile.profile_setup_completed === false) {
      const pendingSetup = await supabase.from('lc_public_reviews')
        .select('id')
        .eq('target_type', 'profile_update')
        .eq('profile_id', profile.id)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle();
      if (pendingSetup.error && !isMissingRelation(pendingSetup.error, 'lc_public_reviews')) throw pendingSetup.error;
      if (pendingSetup.data) {
        return res.status(409).json(err(new Error('公开昵称正在审核，请等待处理后再提交')));
      }
    }
    const {
      display_name, avatar, bio, tags, city, social_links, wechat,
      available_cities, travel_status, contact_unlock_enabled, contact_intent_amount,
      gender, sexual_orientation, preferred_story_lines, role_preferences,
      avatar_focus_x, avatar_focus_y,
    } = req.body;
    const hasField = (field: string) => Object.prototype.hasOwnProperty.call(req.body || {}, field);
    const normalizedSocialLinks = hasField('social_links') ? normalizeProfileSocialLinks(social_links) : undefined;
    const socialSnapshots = normalizedSocialLinks ? makeSocialSnapshots(normalizedSocialLinks) : undefined;
    const rolePreferences = await sanitizeProfileRolePreferences(role_preferences);
    const normalizedTravelStatus = !hasField('travel_status') ? undefined : travel_status === '常驻本地'
      ? '常驻所在城市'
      : (travel_status || '常驻所在城市');
    const normalizedDisplayName = hasField('display_name') ? cleanText(display_name, 30) : undefined;
    if (hasField('display_name') && (!normalizedDisplayName || normalizedDisplayName.length < 2)) {
      return res.status(400).json(err(new Error('公开昵称请填写 2 至 30 个字符')));
    }
    if (profile.profile_setup_completed === false && !normalizedDisplayName) {
      return res.status(400).json(err(new Error('请先设置公开昵称')));
    }
    const candidatePatch: Record<string, unknown> = {
      display_name: normalizedDisplayName,
      avatar: hasField('avatar') ? avatar : undefined,
      bio: hasField('bio') ? bio : undefined,
      tags: hasField('tags') ? (Array.isArray(tags) ? tags : []) : undefined,
      city: hasField('city') ? city : undefined,
      social_links: normalizedSocialLinks,
      wechat: hasField('wechat') ? wechat : undefined,
      avatar_focus_x: hasField('avatar_focus_x') ? normalizeImageFocus(avatar_focus_x, Number((profile as unknown as Record<string, unknown>).avatar_focus_x ?? 50)) : undefined,
      avatar_focus_y: hasField('avatar_focus_y') ? normalizeImageFocus(avatar_focus_y, Number((profile as unknown as Record<string, unknown>).avatar_focus_y ?? 25)) : undefined,
      gender: hasField('gender') ? cleanChoice(gender, PROFILE_GENDER_OPTIONS) : undefined,
      sexual_orientation: hasField('sexual_orientation') ? cleanChoice(sexual_orientation, PROFILE_ORIENTATION_OPTIONS) : undefined,
      preferred_story_lines: hasField('preferred_story_lines') ? cleanTextArray(preferred_story_lines) : undefined,
      available_cities: hasField('available_cities') ? (Array.isArray(available_cities) ? available_cities : []) : undefined,
      travel_status: normalizedTravelStatus,
      contact_unlock_enabled: hasField('contact_unlock_enabled') ? !!contact_unlock_enabled : undefined,
      contact_intent_amount: hasField('contact_intent_amount') ? Math.max(0, parseInt(contact_intent_amount || 0) || 0) : undefined,
    };
    const profilePatch: Record<string, unknown> = {};
    const beforeSnapshot: Record<string, unknown> = {};
    const changedFields: string[] = [];
    for (const [field, value] of Object.entries(candidatePatch)) {
      if (value === undefined || profileReviewComparableValue(profile[field]) === profileReviewComparableValue(value)) continue;
      profilePatch[field] = value;
      beforeSnapshot[field] = profile[field] ?? null;
      changedFields.push(field);
    }
    if (profile.profile_setup_completed === false && changedFields.includes('display_name')) {
      profilePatch.profile_setup_completed = true;
      profilePatch.is_visible = true;
    }
    if (changedFields.includes('social_links') && socialSnapshots) profilePatch.social_snapshots = socialSnapshots;

    let reviewedRolePreferences: Record<string, unknown>[] | null = null;
    let beforeRolePreferences: Record<string, unknown>[] | null = null;
    if (Array.isArray(role_preferences)) {
      const currentRolesResult = await supabase.from('lc_profile_role_preferences')
        .select('script_id, script_name, role_name, role_gender, role_tags, is_recommended, note, sort_order')
        .eq('profile_id', profile.id)
        .order('sort_order', { ascending: true });
      if (currentRolesResult.error && !isMissingRelation(currentRolesResult.error, 'lc_profile_role_preferences')) throw currentRolesResult.error;
      const normalizeRole = (item: Record<string, unknown>, index: number) => ({
        script_id: item.script_id || null,
        script_name: cleanText(item.script_name, 120),
        role_name: cleanText(item.role_name, 80),
        role_gender: cleanText(item.role_gender, 20) || null,
        role_tags: Array.isArray(item.role_tags) ? item.role_tags : [],
        is_recommended: !!item.is_recommended,
        note: cleanText(item.note, 200),
        sort_order: index,
      });
      const nextRoles = rolePreferences.map((item, index) => normalizeRole(item as Record<string, unknown>, index));
      const currentRoles = (currentRolesResult.error ? [] : (currentRolesResult.data || []))
        .map((item: Record<string, unknown>, index: number) => normalizeRole(item, index));
      if (JSON.stringify(nextRoles) !== JSON.stringify(currentRoles)) {
        reviewedRolePreferences = nextRoles;
        beforeRolePreferences = currentRoles;
      }
    }
    if (changedFields.length === 0 && !reviewedRolePreferences) return res.status(400).json(err(new Error('没有检测到需要审核的资料修改')));
    if (changedFields.includes('avatar')) {
      await ensureWechatMiniImageSafetyChecks(req, {
        urls: [profilePatch.avatar],
        businessScene: 'profile_avatar_submit',
        targetType: 'profile_update',
      });
    }
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'profile_update_submit',
      targetType: 'profile_update',
      texts: {
        display_name,
        bio,
        tags: Array.isArray(tags) ? tags.join(' ') : '',
        city,
        wechat,
        social_links: JSON.stringify(normalizedSocialLinks || {}),
        preferred_story_lines: cleanTextArray(preferred_story_lines).join(' '),
        available_cities: Array.isArray(available_cities) ? available_cities.join(' ') : '',
        role_preferences: (reviewedRolePreferences || []).map(item => `${item.script_name} ${item.role_name} ${item.note || ''}`).join('\n'),
      },
      files: changedFields.includes('avatar') && avatar ? [{ url: avatar, type: 'image/*' }] : [],
      allowContact: true,
    });
    const changedLabels = Array.from(new Set(changedFields.map(field => PROFILE_REVIEW_FIELD_LABELS[field]).filter(Boolean)));
    if (reviewedRolePreferences) changedLabels.push('可接角色');
    const review = await createPublicReview({
      targetType: 'profile_update',
      profile,
      title: '主页资料修改',
      summary: `修改内容：${changedLabels.join('、')}`,
      payload: {
        profile_patch: profilePatch,
        before_snapshot: beforeSnapshot,
        changed_fields: changedFields,
        role_preferences: reviewedRolePreferences,
        before_role_preferences: beforeRolePreferences,
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
  },
);

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

app.post(
  '/api/lc/services',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'service_submit',
    targetType: 'service',
    content: req => {
      const services = Array.isArray(req.body?.services) ? req.body.services : [];
      return [
        req.body?.serviceType,
        req.body?.duration,
        req.body?.description,
        ...services.flatMap((service: unknown) => {
          const item = objectPayload(service);
          return [item.serviceType, item.service_type, item.duration, item.description];
        }),
      ];
    },
  }),
  async (req, res) => {
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
  },
);

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

app.post(
  '/api/lc/portfolio',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'portfolio_submit',
    targetType: 'portfolio',
    content: req => [req.body?.caption],
  }),
  async (req, res) => {
  try {
    const { creatorId, imageUrl, caption } = req.body;
    if (getReq(req, 'creatorId') !== creatorId) {
      return res.status(403).json(err(new Error('只能管理自己的作品')));
    }
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    if (!imageUrl) return res.status(400).json(err(new Error('请先上传作品图片')));
    await ensureWechatMiniImageSafetyChecks(req, {
      urls: [imageUrl],
      businessScene: 'portfolio_image_submit',
      targetType: 'portfolio',
    });
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
  },
);

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
    const contentCheck = await startWechatMiniImageSafetyCheck(req, {
      mediaUrl: result.url,
      businessScene: `${scope}_image_upload`,
      targetType: scope,
    });

    res.json(ok({
      url: result.url,
      path: result.relativePath,
      name: file.originalname,
      type: image.contentType,
      size: image.buffer.length,
      width: image.width,
      height: image.height,
      content_check: contentCheck ? {
        id: contentCheck.id,
        status: contentCheck.status,
        trace_id: contentCheck.traceId,
      } : null,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 联系申请 ====================

app.post('/api/lc/contact-request', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));

    const creatorId = cleanText(req.body?.creatorId, 80);
    const requesterWechat = cleanText(req.body?.requesterWechat, 80);
    const message = cleanText(req.body?.message, 1000);
    const paymentProof = cleanText(req.body?.paymentProof, 500);
    if (!creatorId || !requesterWechat) {
      return res.status(400).json(err(new Error('缺少必填信息')));
    }
    if (/^(?:data|blob):/i.test(paymentProof)) {
      return res.status(400).json(err(new Error('支付凭证请填写简短备注，不要粘贴图片数据')));
    }
    const { data: creator, error: creatorErr } = await supabase.from('lc_profiles')
      .select('id, contact_unlock_enabled, contact_intent_amount')
      .eq('id', creatorId)
      .maybeSingle();
    if (creatorErr) throw creatorErr;
    if (!creator) return res.status(404).json(err(new Error('服务者不存在')));

    const { data, error: insertErr } = await supabase.from('lc_contact_requests').insert({
      creator_id: creatorId,
      requester_name: cleanText(profile.display_name, 80) || '已登录用户',
      requester_wechat: requesterWechat,
      requester_message: message || null,
      intent_amount: creator.contact_unlock_enabled ? Math.max(0, Number(creator.contact_intent_amount || 0)) : 0,
      payment_proof: paymentProof || null,
    }).select().single();
    if (insertErr) throw insertErr;
    await logSecurityEvent(req, {
      action: 'contact_request_created',
      actorId: profile.id,
      actorRole: profileAuthRole(profile),
      targetType: 'contact_request',
      targetId: String(data?.id || ''),
      metadata: { creator_id: creatorId },
    });
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

app.post(
  '/api/lc/commissions',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'commission_submit',
    targetType: 'commission',
    content: req => [
      req.body?.title,
      req.body?.content,
      req.body?.desiredRole,
      req.body?.desired_role,
      req.body?.targetType,
      req.body?.target_type,
      req.body?.location,
      req.body?.budget,
      req.body?.contactNote,
      req.body?.contact_note,
      req.body?.scriptName,
      req.body?.script_name,
    ],
  }),
  async (req, res) => {
  try {
    const {
      title, content, desiredRole, targetType, neededDate, neededEndDate,
      city, location, budget, contactNote, aiAssistContext,
    } = req.body;
    const privateContact = cleanText(req.body?.privateContact ?? req.body?.private_contact, 300);
    const commissionCity = cleanText(city, 40);
    const acceptExpedition = req.body?.acceptExpedition === true || req.body?.accept_expedition === true;
    const scriptIdInput = cleanText(req.body.scriptId, 80);
    let scriptName = cleanText(req.body.scriptName, 100);
    let scriptId: string | null = null;
    if (!title || !content) return res.status(400).json(err(new Error('请填写标题和需求内容')));
    if (!privateContact) return res.status(400).json(err(new Error('请留下接受申请后用于联系的方式')));
    if (!commissionCity || !DOSSIER_CITY_VALUES.has(commissionCity)) return res.status(400).json(err(new Error('请选择委托执行城市')));
    const commissionNeededDate = neededDate ? dateText(neededDate) : '';
    const commissionNeededEndDate = neededEndDate ? dateText(neededEndDate) : '';
    if (neededDate && !commissionNeededDate) return res.status(400).json(err(new Error('委托开始日期格式不正确')));
    if (neededEndDate && !commissionNeededEndDate) return res.status(400).json(err(new Error('委托结束日期格式不正确')));
    if (commissionNeededEndDate && !commissionNeededDate) return res.status(400).json(err(new Error('请先选择委托开始日期')));
    if (commissionNeededDate && commissionNeededEndDate && commissionNeededEndDate < commissionNeededDate) {
      return res.status(400).json(err(new Error('委托结束日期不能早于开始日期')));
    }

    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'commission_submit',
      targetType: 'commission',
      texts: { title, content, desiredRole, targetType, city: commissionCity, location, budget, contactNote, scriptName },
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
      needed_date: commissionNeededDate || null,
      needed_end_date: commissionNeededEndDate || null,
      city: commissionCity,
      accept_expedition: acceptExpedition,
      location: location || null,
      budget: budget || null,
      contact_note: contactNote || null,
      private_contact: privateContact,
      ai_assist_context: aiAssistContext || {},
      moderation_precheck: moderationPrecheck,
    }).select().single();
    if (insErr) throw insErr;

    await logSecurityEvent(req, {
      action: 'commission_submitted',
      targetType: 'commission',
      targetId: data?.id,
      metadata: {
        city: commissionCity,
        needed_date: commissionNeededDate || null,
        needed_end_date: commissionNeededEndDate || null,
        accept_expedition: acceptExpedition,
        target_type: targetType || null,
        script_id: scriptId,
        script_name: scriptName || null,
        moderation: moderationPrecheck,
      },
    });
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
  },
);

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
        .select('id, target_id, profile_id, rating')
        .eq('target_type', 'script_role')
        .in('target_id', Array.from(roleTargetIds))
        .eq('status', 'approved');
      if (roleRatingErr && !isMissingRelation(roleRatingErr, 'lc_entity_ratings')) throw roleRatingErr;
      roleRatingMap = buildRoleRatingMap(roleRatings as Record<string, unknown>[] | null | undefined);
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
    const creatorId = await getOptionalCreatorId(req);
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
    const creatorId = await getOptionalCreatorId(req);
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
app.post(
  '/api/lc/scripts/:id/ratings',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'script_rating_submit',
    targetType: 'script_rating',
    content: req => [req.body?.content, req.body?.tags],
  }),
  async (req, res) => {
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
  },
);

app.get('/api/lc/entity-ratings', async (req, res) => {
  try {
    const targetType = cleanText(req.query.targetType, 40);
    const targetId = cleanText(req.query.targetId, 120);
    if (targetType !== 'script_role' || !targetId) return res.status(400).json(err(new Error('缺少评分对象')));
    const creatorId = await getOptionalCreatorId(req);
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
    const mineRows = creatorId ? rows.filter(row => String(row.profile_id) === creatorId) : [];
    res.json(ok({
      ratings: rows,
      mine: {
        experience: mineRows.find(row => row.review_lane !== 'deep_spoiler') || null,
        deep_spoiler: mineRows.find(row => row.review_lane === 'deep_spoiler') || null,
      },
      summary: summarizeRoleReviewRows(rows),
      lane_summaries: summarizeRoleReviewLanes(rows),
      has_experienced_role: mineRows.length > 0,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post(
  '/api/lc/entity-ratings',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'entity_rating_submit',
    targetType: 'entity_rating',
    content: req => [req.body?.content, req.body?.tags],
  }),
  async (req, res) => {
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
    const requestedLane = cleanText(
      req.body?.reviewLane ?? req.body?.review_lane ?? (req.body?.spoilerLevel === 'spoiler' || req.body?.spoiler_level === 'spoiler' ? 'deep_spoiler' : 'experience'),
      30,
    );
    const reviewLane = normalizeRoleReviewLane(requestedLane);
    const spoilerLevel = reviewLane === 'deep_spoiler' ? 'spoiler' : 'none';
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
      review_lane: reviewLane,
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
      title: `${reviewLane === 'deep_spoiler' ? '剧透深评' : '无剧透体验'}：${entity.targetTitle}`,
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
      metadata: { target_type: targetType, target_id: entity.targetId, review_lane: reviewLane, rating, moderation: moderationPrecheck },
    });
    res.json(ok(publicReviewAcceptedResponse(review as Record<string, unknown>)));
  } catch (e) { res.status(500).json(err(e)); }
  },
);

type PlayerScriptExperience = {
  script_id: string;
  script_name: string;
  is_hidden: boolean;
  sources: Set<string>;
  roles: Map<string, { target_id: string; role_name: string; review_lanes: Set<string> }>;
  updated_at: string | null;
};

function playerExperienceSourceLabel(source: string) {
  if (source === 'manual') return '手动登记';
  if (source === 'role_rating') return '角色评价';
  if (source === 'script_rating') return '剧本评价';
  if (source === 'dm_rating') return 'DM 评价';
  if (source === 'ranking') return '红黑榜';
  if (source === 'ranking_comment') return '榜单评论';
  return source;
}

app.get('/api/lc/creators/:id/experiences', async (req, res) => {
  try {
    const profileId = cleanText(req.params.id, 120);
    const viewerId = await getOptionalCreatorId(req);
    const isOwner = viewerId === profileId;
    const [manualResult, roleResult, scriptResult, dmResult, rankingResult, commentResult] = await Promise.all([
      supabase.from('lc_player_script_records').select('*').eq('profile_id', profileId),
      supabase.from('lc_entity_ratings').select('id, target_id, rating, review_lane, entity_metadata, updated_at').eq('profile_id', profileId).eq('target_type', 'script_role').eq('status', 'approved'),
      supabase.from('lc_script_ratings').select('id, script_id, script_name, updated_at').eq('profile_id', profileId).eq('status', 'approved'),
      supabase.from('lc_dm_ratings').select('id, script_id, script_name, updated_at').eq('profile_id', profileId).eq('status', 'approved'),
      supabase.from('lc_rankings').select('id, event_script_id, event_script_name, created_at').eq('poster_id', profileId).eq('status', 'approved'),
      supabase.from('lc_comments').select('id, ranking_id, created_at').eq('author_id', profileId).eq('status', 'approved'),
    ]);
    for (const result of [manualResult, roleResult, scriptResult, dmResult, rankingResult, commentResult]) {
      if (result.error) throw result.error;
    }

    const commentRankingIds = (commentResult.data || []).map(row => cleanText(row.ranking_id, 120)).filter(Boolean);
    const commentRankingsResult = commentRankingIds.length > 0
      ? await supabase.from('lc_rankings').select('id, event_script_id, event_script_name, created_at').in('id', commentRankingIds).eq('status', 'approved')
      : { data: [], error: null };
    if (commentRankingsResult.error && !isMissingRelation(commentRankingsResult.error, 'lc_rankings')) throw commentRankingsResult.error;

    const hiddenByScript = new Map<string, boolean>();
    for (const row of manualResult.data || []) hiddenByScript.set(cleanText(row.script_id, 120), !!row.is_hidden);
    const grouped = new Map<string, PlayerScriptExperience>();
    const add = (scriptIdInput: unknown, scriptNameInput: unknown, source: string, updatedAt?: unknown) => {
      const scriptId = cleanText(scriptIdInput, 120);
      const scriptName = cleanText(scriptNameInput, 160);
      if (!scriptId || !scriptName) return null;
      const existing = grouped.get(scriptId) || {
        script_id: scriptId,
        script_name: scriptName,
        is_hidden: hiddenByScript.get(scriptId) || false,
        sources: new Set<string>(),
        roles: new Map(),
        updated_at: null,
      };
      existing.sources.add(source);
      const nextUpdatedAt = cleanText(updatedAt, 60);
      if (nextUpdatedAt && (!existing.updated_at || nextUpdatedAt > existing.updated_at)) existing.updated_at = nextUpdatedAt;
      grouped.set(scriptId, existing);
      return existing;
    };

    for (const row of manualResult.data || []) {
      if (row.is_manual) add(row.script_id, row.script_name, 'manual', row.updated_at);
    }
    for (const row of roleResult.data || []) {
      const metadata = publicRecord(row.entity_metadata);
      const item = add(metadata.script_id, metadata.script_name, 'role_rating', row.updated_at);
      const targetId = cleanText(row.target_id, 160);
      const roleName = cleanText(metadata.role_name, 120);
      if (!item || !targetId || !roleName) continue;
      const role = item.roles.get(targetId) || { target_id: targetId, role_name: roleName, review_lanes: new Set<string>() };
      role.review_lanes.add(row.review_lane === 'deep_spoiler' ? 'deep_spoiler' : 'experience');
      item.roles.set(targetId, role);
    }
    for (const row of scriptResult.data || []) add(row.script_id, row.script_name, 'script_rating', row.updated_at);
    for (const row of dmResult.data || []) add(row.script_id, row.script_name, 'dm_rating', row.updated_at);
    for (const row of rankingResult.data || []) add(row.event_script_id, row.event_script_name, 'ranking', row.created_at);
    for (const row of commentRankingsResult.data || []) add(row.event_script_id, row.event_script_name, 'ranking_comment', row.created_at);

    const items = Array.from(grouped.values())
      .filter(item => isOwner || !item.is_hidden)
      .map(item => ({
        script_id: item.script_id,
        script_name: item.script_name,
        is_hidden: item.is_hidden,
        sources: Array.from(item.sources).map(source => ({ key: source, label: playerExperienceSourceLabel(source) })),
        roles: Array.from(item.roles.values()).map(role => ({ ...role, review_lanes: Array.from(role.review_lanes) })),
        updated_at: item.updated_at,
      }))
      .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || '')) || left.script_name.localeCompare(right.script_name, 'zh-CN'));
    res.json(ok({ items, is_owner: isOwner }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/player-script-records', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    const scriptId = cleanText(req.body?.scriptId ?? req.body?.script_id, 120);
    const script = findSharedScript(await loadSharedScriptCatalog(), scriptId);
    if (!script) return res.status(404).json(err(new Error('剧本不存在或尚未进入公共剧本库')));
    const { data, error } = await supabase.from('lc_player_script_records').upsert({
      profile_id: profile.id,
      script_id: script.id,
      script_name: script.name,
      is_manual: true,
      is_hidden: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,script_id' }).select().single();
    if (error) throw error;
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.patch('/api/lc/player-script-records/:scriptId', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    const scriptId = cleanText(req.params.scriptId, 120);
    const script = findSharedScript(await loadSharedScriptCatalog(), scriptId);
    if (!script) return res.status(404).json(err(new Error('剧本不存在')));
    const isHidden = req.body?.isHidden === true || req.body?.is_hidden === true;
    const existing = await supabase.from('lc_player_script_records').select('is_manual').eq('profile_id', profile.id).eq('script_id', script.id).maybeSingle();
    if (existing.error) throw existing.error;
    const { data, error } = await supabase.from('lc_player_script_records').upsert({
      profile_id: profile.id,
      script_id: script.id,
      script_name: script.name,
      is_manual: !!existing.data?.is_manual,
      is_hidden: isHidden,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,script_id' }).select().single();
    if (error) throw error;
    res.json(ok(data));
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
      linked_store_dossier_id: null,
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
          linked_store_dossier_id: cleanText(store.id, 80) || null,
          source: 'store_dossier',
          source_id: cleanText(store.id, 80),
          name: cleanText(store.dm_name, 100),
          city: cleanText(store.city, 40) || null,
          address: cleanText(store.workplace, 160) || null,
        }))),
        ...((rankingResult.data || []).map((store: Record<string, unknown>) => ({
          id: `ranking:${cleanText(store.id, 80)}`,
          linked_store_id: null,
          linked_store_dossier_id: null,
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

app.post(
  '/api/lc/carpools',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'carpool_submit',
    targetType: 'carpool',
    content: req => [
      req.body?.title,
      req.body?.scriptName,
      req.body?.script_name,
      req.body?.roleName,
      req.body?.role_name,
      req.body?.roleNote,
      req.body?.role_note,
      req.body?.storeName,
      req.body?.store_name,
      req.body?.storeVerifyNote,
      req.body?.store_verify_note,
      req.body?.contactNote,
      req.body?.contact_note,
      req.body?.content,
      req.body?.subsidyNote,
      req.body?.subsidy_note,
      req.body?.rawMessage,
      req.body?.raw_message,
      req.body?.generatedMessage,
      req.body?.generated_message,
    ],
  }),
  async (req, res) => {
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
    if (boostAmount > 100) return res.status(400).json(err(new Error('加权展示最多 100 榜金')));
    if (boostAmount > 0 && (profile.balance || 0) < boostAmount) {
      return res.status(402).json(err(new Error('榜金不足，请先充值')));
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
  },
);

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

app.post(
  '/api/lc/reports',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'report_submit',
    targetType: 'report',
    content: req => [req.body?.reason, req.body?.description],
  }),
  async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const targetType = REPORT_TARGET_TYPES.includes(req.body.targetType) ? req.body.targetType as ReportTargetType : null;
    const targetId = cleanText(req.body.targetId, 80);
    const targetSubId = cleanText(req.body.targetSubId ?? req.body.target_sub_id, 300);
    const reason = cleanText(req.body.reason, 80);
    const description = cleanText(req.body.description, 800);
    if (!targetType || !targetId || !reason) {
      return res.status(400).json(err(new Error('请选择举报对象和举报原因')));
    }
    if (targetType === 'dm_affiliation') {
      return res.status(400).json(err(new Error('任职关系异议必须通过专用入口提交证据')));
    }

    let targetTitle = '';
    let snapshot: Record<string, unknown> = {};
    let targetOwnerId = '';
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
      targetOwnerId = cleanText(item.poster_id, 80);
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
        .select('id, type, subject_name, subject_type, subject_city, author_name, poster_id, content, status')
        .eq('id', targetId)
        .single();
      if (qErr && isMissingRelation(qErr, 'lc_rankings')) return res.status(503).json(err(new Error('红黑榜数据表尚未初始化')));
      if (qErr) throw qErr;
      if (!item) return res.status(404).json(err(new Error('举报对象不存在')));
      if (item.status !== 'approved') return res.status(400).json(err(new Error('只能举报已公开内容')));
      targetTitle = item.subject_name;
      targetOwnerId = cleanText(item.poster_id, 80);
      snapshot = {
        ranking_type: item.type,
        subject_type: item.subject_type,
        city: item.subject_city,
        poster_name: item.author_name,
        image_reference: targetSubId || null,
        content_preview: cleanText(item.content, 240),
      };
    } else if (targetType === 'comment') {
      const { data: item, error: qErr } = await supabase.from('lc_comments')
        .select('id, ranking_id, author_id, author_name, content, status, is_pinned, pin_label, lc_rankings(subject_name, type)')
        .eq('id', targetId)
        .single();
      if (qErr && isMissingRelation(qErr, 'lc_comments')) return res.status(503).json(err(new Error('评论数据表尚未初始化')));
      if (qErr) throw qErr;
      if (!item) return res.status(404).json(err(new Error('举报对象不存在')));
      if (item.status !== 'approved') return res.status(400).json(err(new Error('只能举报已公开评论')));
      const ranking = item.lc_rankings as { subject_name?: string; type?: string } | null;
      targetTitle = `${ranking?.subject_name || '红黑榜'}的评论`;
      targetOwnerId = cleanText(item.author_id, 80);
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
        .select('id, title, poster_id, poster_name, city, needed_date, needed_end_date, target_type, content, status')
        .eq('id', targetId)
        .single();
      if (qErr && isMissingRelation(qErr, 'lc_commissions')) return res.status(503).json(err(new Error('委托需求表尚未初始化')));
      if (qErr) throw qErr;
      if (!item) return res.status(404).json(err(new Error('举报对象不存在')));
      if (item.status !== 'approved') return res.status(400).json(err(new Error('只能举报已公开委托需求')));
      targetTitle = item.title;
      targetOwnerId = cleanText(item.poster_id, 80);
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
      targetOwnerId = cleanText(item.id, 80);
      snapshot = {
        display_name: item.display_name,
        role_type: item.role_type,
        city: item.city,
        content_preview: cleanText(item.bio, 240),
      };
    } else if (targetType === 'dossier' || targetType === 'dossier_image') {
      const { data: item, error: qErr } = await supabase.from('lc_dm_dossiers')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();
      if (qErr) throw qErr;
      if (!item || item.status !== 'approved') return res.status(404).json(err(new Error('档案不存在或尚未公开')));
      targetTitle = `${item.entity_type === 'store' ? '店家' : 'DM'}档案 · ${item.dm_name}`;
      targetOwnerId = cleanText(item.claimed_by, 80);
      snapshot = {
        entity_type: item.entity_type,
        city: item.city,
        workplace: item.workplace,
        image_reference: targetType === 'dossier_image' ? targetSubId || null : null,
        content_preview: cleanText(item.bio || item.note, 240),
      };
    } else if (targetType === 'dm_rating' || targetType === 'store_rating') {
      const table = targetType === 'dm_rating' ? 'lc_dm_ratings' : 'lc_store_ratings';
      const { data: item, error: qErr } = await supabase.from(table).select('*').eq('id', targetId).maybeSingle();
      if (qErr) throw qErr;
      if (!item || item.status !== 'approved') return res.status(404).json(err(new Error('评价不存在或尚未公开')));
      targetTitle = `${targetType === 'dm_rating' ? 'DM' : '店家'}评价 · ${cleanText(item.script_name, 120) || '体验记录'}`;
      targetOwnerId = cleanText(item.profile_id, 80);
      snapshot = {
        profile_name: item.profile_name,
        script_name: item.script_name,
        rating: item.rating,
        content_preview: cleanText(item.content, 240),
      };
    } else if (targetType === 'role_rating') {
      const { data: item, error: qErr } = await supabase.from('lc_entity_ratings').select('*').eq('id', targetId).maybeSingle();
      if (qErr) throw qErr;
      if (!item || item.status !== 'approved') return res.status(404).json(err(new Error('角色点评不存在或尚未公开')));
      const metadata = objectPayload(item.entity_metadata);
      targetTitle = `角色点评 · ${cleanText(metadata.role_name, 120) || cleanText(item.target_name, 120) || '角色体验'}`;
      targetOwnerId = cleanText(item.profile_id, 80);
      snapshot = {
        profile_name: item.profile_name,
        review_lane: item.review_lane,
        rating: item.rating,
        content_preview: cleanText(item.content, 240),
      };
    } else if (targetType === 'rating_reply') {
      const { data: item, error: qErr } = await supabase.from('lc_rating_discussion_nodes').select('*').eq('id', targetId).maybeSingle();
      if (qErr) throw qErr;
      if (!item || item.status !== 'approved') return res.status(404).json(err(new Error('评价回复不存在或尚未公开')));
      targetTitle = item.node_type === 'official_response' ? '评价相关方回应' : '评价补充回复';
      targetOwnerId = cleanText(item.profile_id, 80);
      snapshot = {
        rating_type: item.rating_type,
        rating_id: item.rating_id,
        node_type: item.node_type,
        profile_name: item.is_anonymous ? '匿名用户' : item.profile_name,
        content_preview: cleanText(item.content, 240),
      };
    } else if (targetType === 'provider_listing') {
      const [listingResult, profileResult] = await Promise.all([
        supabase.from('lc_provider_listings').select('*').eq('profile_id', targetId).eq('is_active', true).maybeSingle(),
        supabase.from('lc_profiles').select('id, display_name, city').eq('id', targetId).maybeSingle(),
      ]);
      if (listingResult.error) throw listingResult.error;
      if (profileResult.error) throw profileResult.error;
      if (!listingResult.data || !profileResult.data) return res.status(404).json(err(new Error('委托条不存在或已下架')));
      targetTitle = `委托条 · ${profileResult.data.display_name || '委托师'}`;
      targetOwnerId = cleanText(targetId, 80);
      snapshot = {
        city: profileResult.data.city,
        headline: listingResult.data.headline,
        role_types: listingResult.data.role_types,
        content_preview: cleanText(listingResult.data.description, 240),
      };
    } else if (targetType === 'guide') {
      const { data: item, error: qErr } = await supabase.from('lc_guides').select('*').eq('id', targetId).maybeSingle();
      if (qErr) throw qErr;
      if (!item || item.status !== 'approved') return res.status(404).json(err(new Error('攻略不存在或尚未公开')));
      targetTitle = `攻略 · ${item.title}`;
      targetOwnerId = cleanText(item.author_id, 80);
      snapshot = {
        author_name: item.author_name,
        guide_type: item.guide_type,
        target_name: item.target_name,
        content_preview: cleanText(item.summary || item.content, 240),
      };
    } else if (targetType === 'service') {
      const { data: item, error: qErr } = await supabase.from('lc_services').select('*').eq('id', targetId).maybeSingle();
      if (qErr) throw qErr;
      if (!item || item.is_active === false) return res.status(404).json(err(new Error('服务不存在或已下架')));
      targetTitle = `服务 · ${cleanText(item.service_type, 120) || '服务项目'}`;
      targetOwnerId = cleanText(item.creator_id, 80);
      snapshot = {
        service_type: item.service_type,
        price: item.price,
        duration: item.duration,
        content_preview: cleanText(item.description, 240),
      };
    } else if (targetType === 'portfolio' || targetType === 'portfolio_image') {
      const { data: item, error: qErr } = await supabase.from('lc_portfolio').select('*').eq('id', targetId).maybeSingle();
      if (qErr) throw qErr;
      if (!item) return res.status(404).json(err(new Error('作品不存在或已删除')));
      targetTitle = targetType === 'portfolio_image' ? '作品图片' : `作品 · ${cleanText(item.title, 120) || '未命名作品'}`;
      targetOwnerId = cleanText(item.creator_id, 80);
      snapshot = {
        image_reference: targetType === 'portfolio_image' ? targetSubId || cleanText(item.image_url, 300) || null : null,
        content_preview: cleanText(item.description || item.title, 240),
      };
    }
    if (targetOwnerId && targetOwnerId === profile.id) {
      return res.status(400).json(err(new Error('自己的内容请使用编辑、撤回或下架入口')));
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
      target_sub_id: targetSubId,
      target_title: targetTitle,
      reporter_id: profile.id,
      reporter_name: profile.display_name,
      reason,
      description: description || null,
      target_snapshot: snapshot,
      moderation_precheck: moderationPrecheck,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'target_type,target_id,target_sub_id,reporter_id' }).select('id').single();
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
  },
);

app.post('/api/lc/reports/:id/evidence', authMiddleware, upload.single('file'), async (req, res) => {
  let savedFile: ReturnType<typeof saveModerationEvidenceFile> | null = null;
  let evidenceCommitted = false;
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const file = req.file;
    if (!file) return res.status(400).json(err(new Error('请选择证据图片')));
    const result = await supabase.from('lc_reports')
      .select('id, reporter_id, status, evidence_files')
      .eq('id', req.params.id)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return res.status(404).json(err(new Error('举报记录不存在')));
    if (result.data.reporter_id !== profile.id) return res.status(403).json(err(new Error('只能补充自己的举报材料')));
    if (result.data.status !== 'pending') return res.status(400).json(err(new Error('这条举报已经处理，不能继续补充图片')));
    const currentFiles = internalModerationEvidenceFiles(result.data.evidence_files);
    if (currentFiles.length >= MAX_MODERATION_EVIDENCE_FILES) {
      return res.status(400).json(err(new Error(`最多上传 ${MAX_MODERATION_EVIDENCE_FILES} 张证据图片`)));
    }
    const image = await sanitizeUploadedImageFile({ buffer: file.buffer, mimetype: file.mimetype });
    savedFile = saveModerationEvidenceFile({
      root: PRIVATE_UPLOAD_ROOT,
      kind: 'report',
      recordId: result.data.id,
      originalName: file.originalname,
      image,
    });
    const nextFiles = [...currentFiles, savedFile];
    const updateResult = await supabase.from('lc_reports')
      .update({ evidence_files: nextFiles, updated_at: new Date().toISOString() })
      .eq('id', result.data.id)
      .eq('reporter_id', profile.id);
    if (updateResult.error) throw updateResult.error;
    evidenceCommitted = true;
    await logSecurityEvent(req, {
      action: 'report_private_evidence_uploaded',
      targetType: 'report',
      targetId: result.data.id,
      metadata: { file_id: savedFile.id, file_count: nextFiles.length },
    });
    res.json(ok({ file: publicModerationEvidenceMetadata([savedFile])[0] }));
  } catch (e) {
    if (savedFile && !evidenceCommitted) removeModerationEvidenceFile(PRIVATE_UPLOAD_ROOT, savedFile.relative_path);
    res.status(500).json(err(e));
  }
});

app.get('/api/lc/admin/reports/:id/evidence/:fileId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await supabase.from('lc_reports')
      .select('id, target_type, evidence_files')
      .eq('id', req.params.id)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data || result.data.target_type === 'dm_affiliation') {
      return res.status(404).json(err(new Error('举报材料不存在')));
    }
    const file = internalModerationEvidenceFiles(result.data.evidence_files)
      .find(item => item.id === req.params.fileId);
    if (!file) return res.status(404).json(err(new Error('举报材料不存在')));
    const body = readModerationEvidenceFile(PRIVATE_UPLOAD_ROOT, 'report', result.data.id, file.relative_path);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="report-evidence-${file.id}.jpg"`);
    res.send(body);
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

app.post(
  '/api/lc/site-messages',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'feedback_submit',
    targetType: 'site_message',
    content: req => [req.body?.subject, req.body?.content],
  }),
  async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const allowedCategories = [
      'suggestion',
      'dm_correction',
      'dossier_correction',
      'appeal',
      'account',
      'bug',
      'cooperation',
      'invalid_contact',
      'payment_refund',
      'report_abuse',
      'other',
      'general',
    ];
    const rawCategory = cleanText(req.body?.category, 40);
    const category = allowedCategories.includes(rawCategory) ? rawCategory : 'general';
    const subject = cleanText(req.body?.subject, 80);
    const content = cleanText(req.body?.content, 2000);
    const contact = cleanText(req.body?.contact, 300);
    const paymentPurchaseId = cleanText(req.body?.paymentPurchaseId ?? req.body?.payment_purchase_id, 80);
    if (!subject || !content) return res.status(400).json(err(new Error('请填写站内信标题和内容')));
    if (paymentPurchaseId) {
      const purchaseResult = await supabase.from('lc_service_purchases')
        .select('id')
        .eq('id', paymentPurchaseId)
        .eq('profile_id', profile.id)
        .maybeSingle();
      if (purchaseResult.error) throw purchaseResult.error;
      if (!purchaseResult.data) return res.status(400).json(err(new Error('关联的支付订单不存在')));
    }
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
      evidence_files: [],
      payment_purchase_id: paymentPurchaseId || null,
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
  },
);

app.post('/api/lc/site-messages/:id/evidence', authMiddleware, upload.single('file'), async (req, res) => {
  let savedFile: ReturnType<typeof saveModerationEvidenceFile> | null = null;
  let evidenceCommitted = false;
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const file = req.file;
    if (!file) return res.status(400).json(err(new Error('请选择反馈图片')));
    const result = await supabase.from('lc_site_messages')
      .select('id, sender_id, status, evidence_files')
      .eq('id', req.params.id)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return res.status(404).json(err(new Error('反馈记录不存在')));
    if (result.data.sender_id !== profile.id) return res.status(403).json(err(new Error('只能补充自己的反馈图片')));
    if (result.data.status !== 'pending') return res.status(400).json(err(new Error('这条反馈已经处理，不能继续补充图片')));
    const currentFiles = internalModerationEvidenceFiles(result.data.evidence_files);
    if (currentFiles.length >= MAX_MODERATION_EVIDENCE_FILES) {
      return res.status(400).json(err(new Error(`最多上传 ${MAX_MODERATION_EVIDENCE_FILES} 张反馈图片`)));
    }
    const image = await sanitizeUploadedImageFile({ buffer: file.buffer, mimetype: file.mimetype });
    savedFile = saveModerationEvidenceFile({
      root: PRIVATE_UPLOAD_ROOT,
      kind: 'feedback',
      recordId: result.data.id,
      originalName: file.originalname,
      image,
    });
    const nextFiles = [...currentFiles, savedFile];
    const updateResult = await supabase.from('lc_site_messages')
      .update({ evidence_files: nextFiles, updated_at: new Date().toISOString() })
      .eq('id', result.data.id)
      .eq('sender_id', profile.id);
    if (updateResult.error) throw updateResult.error;
    evidenceCommitted = true;
    await logSecurityEvent(req, {
      action: 'feedback_private_evidence_uploaded',
      targetType: 'site_message',
      targetId: result.data.id,
      metadata: { file_id: savedFile.id, file_count: nextFiles.length },
    });
    res.json(ok({ file: publicModerationEvidenceMetadata([savedFile])[0] }));
  } catch (e) {
    if (savedFile && !evidenceCommitted) removeModerationEvidenceFile(PRIVATE_UPLOAD_ROOT, savedFile.relative_path);
    res.status(500).json(err(e));
  }
});

app.get('/api/lc/admin/site-messages/:id/evidence/:fileId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await supabase.from('lc_site_messages')
      .select('id, evidence_files')
      .eq('id', req.params.id)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return res.status(404).json(err(new Error('反馈图片不存在')));
    const file = internalModerationEvidenceFiles(result.data.evidence_files)
      .find(item => item.id === req.params.fileId);
    if (!file) return res.status(404).json(err(new Error('反馈图片不存在')));
    const body = readModerationEvidenceFile(PRIVATE_UPLOAD_ROOT, 'feedback', result.data.id, file.relative_path);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="feedback-evidence-${file.id}.jpg"`);
    res.send(body);
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/site-messages/mine', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const result = await supabase.from('lc_site_messages')
      .select('id, category, subject, content, status, evidence_files, payment_purchase_id, admin_reply, replied_at, created_at, updated_at')
      .eq('sender_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (result.error && isMissingRelation(result.error, 'lc_site_messages')) return res.json(ok([]));
    if (result.error) throw result.error;
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(ok((result.data || []).map(item => ({
      ...item,
      evidence_files: publicModerationEvidenceMetadata(item.evidence_files),
    }))));
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

app.post(
  '/api/lc/carpools/:id/applications',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'carpool_application',
    targetType: 'carpool_application',
    content: req => [req.body?.message, req.body?.roleName, req.body?.role_name],
  }),
  async (req, res) => {
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
  },
);

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
      .select('id, title, city, needed_date, needed_end_date, accept_expedition, private_contact')
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
    res.json(ok((data || []).map(item => {
      const commission = meta.get(item.commission_id) as Record<string, unknown> | undefined;
      const accepted = item.status === 'accepted';
      const { private_contact: applicantContact, ...safeApplication } = item as Record<string, unknown>;
      return {
        ...safeApplication,
        commission: commission ? publicCommissionRow(commission) : null,
        contacts: accepted ? {
          poster: cleanText(commission?.private_contact, 300),
          applicant: cleanText(applicantContact, 300),
        } : null,
      };
    })));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/commissions/applications/sent', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data, error: qErr } = await supabase.from('lc_commission_applications')
      .select('*')
      .eq('applicant_id', profile.id)
      .order('created_at', { ascending: false });
    if (qErr && isMissingRelation(qErr, 'lc_commission_applications')) return res.json(ok([]));
    if (qErr) throw qErr;
    const commissionIds = Array.from(new Set((data || []).map(item => item.commission_id).filter(Boolean)));
    const commissionResult = commissionIds.length > 0
      ? await supabase.from('lc_commissions').select('id, title, city, needed_date, needed_end_date, accept_expedition, private_contact').in('id', commissionIds)
      : { data: [], error: null };
    if (commissionResult.error) throw commissionResult.error;
    const commissionMap = new Map((commissionResult.data || []).map(item => [item.id, item]));
    res.json(ok((data || []).map(item => {
      const commission = commissionMap.get(item.commission_id) as Record<string, unknown> | undefined;
      const accepted = item.status === 'accepted';
      const safeApplication = { ...(item as Record<string, unknown>) };
      const applicantContact = safeApplication.private_contact;
      delete safeApplication.private_contact;
      return {
        ...safeApplication,
        commission: commission ? publicCommissionRow(commission) : null,
        contacts: accepted ? {
          poster: cleanText(commission?.private_contact, 300),
          applicant: cleanText(applicantContact, 300),
        } : null,
      };
    })));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post(
  '/api/lc/commissions/:id/applications',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'commission_application',
    targetType: 'commission_application',
    content: req => [req.body?.letter],
  }),
  async (req, res) => {
  try {
    const letter = typeof req.body?.letter === 'string' ? req.body.letter.trim().slice(0, 1200) : '';
    const privateContact = cleanText(req.body?.privateContact ?? req.body?.private_contact, 300);
    if (!letter) return res.status(400).json(err(new Error('请填写申请信')));
    if (!privateContact) return res.status(400).json(err(new Error('请留下申请通过后用于联系的方式')));

    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));

    const { data: commission } = await supabase.from('lc_commissions')
      .select('id, poster_id, status, needed_date, needed_end_date, city, accept_expedition')
      .eq('id', req.params.id)
      .single();
    if (!commission) return res.status(404).json(err(new Error('委托需求不存在')));
    if (commission.status !== 'approved') return res.status(400).json(err(new Error('只能申请已上墙的委托需求')));
    if (isCommissionExpired(commission as Record<string, unknown>)) return res.status(400).json(err(new Error('这条委托已过期，不能继续接单')));
    if (commission.poster_id === profile.id) return res.status(400).json(err(new Error('不能接自己的委托需求')));
    const commissionTravel = { city: commission.city, accept_expedition: commission.accept_expedition === true };
    const cityMatch = commissionCityMatch(profile, commission.city);
    if (!canApplyToCommission(profile, commissionTravel)) {
      const message = commission.accept_expedition
        ? `这条委托只接受${commission.city}本地，或已在主页声明可服务${commission.city}的委托师`
        : `发布人暂不接受异地远征，仅限常驻${commission.city}的委托师申请`;
      return res.status(400).json(err(new Error(message)));
    }

    const { data, error: insErr } = await supabase.from('lc_commission_applications').insert({
      commission_id: req.params.id,
      applicant_id: profile.id,
      applicant_name: profile.display_name,
      applicant_is_realname: !!profile.is_realname,
      letter,
      private_contact: privateContact,
    }).select('id').single();
    if (insErr) {
      if (insErr.code === '23505') return res.status(409).json(err(new Error('你已经提交过接单申请了')));
      if (isMissingRelation(insErr, 'lc_commission_applications')) return res.status(503).json(err(new Error('接单申请数据表尚未初始化，请先执行 Supabase migration')));
      throw insErr;
    }
    await logSecurityEvent(req, {
      action: 'commission_application_submitted',
      actorId: profile.id,
      actorRole: profileAuthRole(profile),
      targetType: 'commission_application',
      targetId: String(data?.id || ''),
      metadata: { commission_id: req.params.id, city_match: cityMatch },
    });
    await notifyProfile({
      profileId: commission.poster_id,
      type: 'commission_application_received',
      title: '收到新的接单申请',
      content: `${cleanText(profile.display_name, 120) || '一位委托师'}申请承接你的委托。`,
      relatedType: 'commission_application',
      relatedId: data?.id,
    });
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
  },
);

app.put('/api/lc/commissions/applications/:id/decision', authMiddleware, async (req, res) => {
  try {
    const decision = cleanText(req.body?.decision, 20);
    if (decision !== 'accepted' && decision !== 'rejected') {
      return res.status(400).json(err(new Error('请选择接受或拒绝申请')));
    }
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const client = await tencentPgPool.connect();
    let commissionId = '';
    let posterContact = '';
    let applicantContact = '';
    try {
      await client.query('BEGIN');
      const locked = await client.query<{
        application_status: string;
        application_contact: string | null;
        applicant_id: string;
        commission_id: string;
        poster_id: string;
        poster_contact: string | null;
      }>(
        `SELECT a.status AS application_status,
                a.private_contact AS application_contact,
                a.applicant_id,
                c.id AS commission_id,
                c.poster_id,
                c.private_contact AS poster_contact
           FROM lc_commission_applications a
           JOIN lc_commissions c ON c.id = a.commission_id
          WHERE a.id = $1
          FOR UPDATE OF a, c`,
        [req.params.id],
      );
      const row = locked.rows[0];
      if (!row) throw Object.assign(new Error('接单申请不存在'), { statusCode: 404 });
      if (row.poster_id !== profile.id) throw Object.assign(new Error('只能处理发给自己委托的申请'), { statusCode: 403 });
      if (row.application_status !== 'submitted') throw Object.assign(new Error('这条申请已经处理过'), { statusCode: 409 });
      commissionId = row.commission_id;
      posterContact = cleanText(row.poster_contact, 300);
      applicantContact = cleanText(row.application_contact, 300);
      if (decision === 'accepted' && !posterContact) {
        posterContact = cleanText(req.body?.privateContact ?? req.body?.private_contact, 300);
        if (!posterContact) throw Object.assign(new Error('接受前请留下你的联系方式'), { statusCode: 400 });
        await client.query('UPDATE lc_commissions SET private_contact = $1, updated_at = NOW() WHERE id = $2 AND poster_id = $3', [posterContact, commissionId, profile.id]);
      }
      if (decision === 'accepted' && !applicantContact) throw Object.assign(new Error('申请人尚未留下联系方式，请对方补充后再接受'), { statusCode: 409 });
      await client.query(
        `UPDATE lc_commission_applications
            SET status = $1,
                decided_at = NOW(),
                decided_by = $2,
                contact_unlocked_at = CASE WHEN $1 = 'accepted' THEN NOW() ELSE NULL END,
                updated_at = NOW()
          WHERE id = $3 AND status = 'submitted'`,
        [decision, profile.id, req.params.id],
      );
      await client.query(
        `insert into lc_account_notifications
           (profile_id, type, title, content, action_url, related_type, related_id)
         values ($1, $2, $3, $4, '/commissions?view=mine', 'commission_application', $5)`,
        [
          row.applicant_id,
          decision === 'accepted' ? 'commission_application_accepted' : 'commission_application_rejected',
          decision === 'accepted' ? '委托申请已通过' : '委托申请暂未通过',
          decision === 'accepted'
            ? '双方联系方式已经解锁，可以在“委托-申请与处理”中查看。'
            : '委托人暂未接受这次申请。',
          req.params.id,
        ],
      );
      await client.query('COMMIT');
    } catch (decisionError) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw decisionError;
    } finally {
      client.release();
    }
    await logSecurityEvent(req, {
      action: decision === 'accepted' ? 'commission_application_accepted' : 'commission_application_rejected',
      actorId: profile.id,
      actorRole: profileAuthRole(profile),
      targetType: 'commission_application',
      targetId: req.params.id,
      metadata: { commission_id: commissionId },
    });
    res.json(ok({
      id: req.params.id,
      status: decision,
      contacts: decision === 'accepted' ? { poster: posterContact, applicant: applicantContact } : null,
    }));
  } catch (e) {
    const statusCode = e && typeof e === 'object' && 'statusCode' in e && Number.isInteger(Number((e as { statusCode?: unknown }).statusCode))
      ? Number((e as { statusCode: number }).statusCode)
      : 500;
    res.status(statusCode).json(err(e));
  }
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

async function requestCreatorWithdrawalOnTencent(args: {
  creatorId: string;
  amount: number;
  accountType: string;
  accountName: string;
  accountIdentifier: string;
}) {
  const client = await tencentPgPool.connect();
  try {
    await client.query('BEGIN');
    const profileResult = await client.query(
      `select id from lc_profiles where id = $1 for update`,
      [args.creatorId],
    );
    if (!profileResult.rows[0]) throw new Error('用户不存在');
    await client.query(
      `update lc_creator_income_entries
          set status = 'withdrawable', updated_at = now()
        where creator_id = $1 and status = 'frozen' and available_at <= now()`,
      [args.creatorId],
    );
    const entriesResult = await client.query(
      `select id, creator_amount from lc_creator_income_entries
        where creator_id = $1 and status = 'withdrawable'
        order by created_at for update`,
      [args.creatorId],
    );
    const available = entriesResult.rows.reduce((sum: number, row: { creator_amount: number }) => sum + Number(row.creator_amount || 0), 0);
    if (available < args.amount) throw new Error('可提现收入不足');
    if (available !== args.amount) throw new Error('第一版提现请一次性申请全部可提现收入，避免拆分流水对账出错');
    const withdrawalResult = await client.query(
      `insert into lc_creator_withdrawals
        (creator_id, amount, account_type, account_name, account_identifier, status)
       values ($1, $2, $3, $4, $5, 'pending')
       returning *`,
      [args.creatorId, args.amount, args.accountType, args.accountName, args.accountIdentifier],
    );
    const withdrawal = withdrawalResult.rows[0];
    const entryIds = entriesResult.rows.map((row: { id: string }) => row.id);
    if (entryIds.length) {
      const updatedEntries = await client.query(
        `update lc_creator_income_entries
            set status = 'withdraw_requested', withdrawal_id = $2, updated_at = now()
          where id = any($1::uuid[]) and creator_id = $3 and status = 'withdrawable'
          returning id`,
        [entryIds, withdrawal.id, args.creatorId],
      );
      if (updatedEntries.rowCount !== entryIds.length) throw new Error('收入状态发生变化，请重新提交提现申请');
    }
    await client.query('COMMIT');
    return withdrawal;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function decideCreatorWithdrawalOnTencent(args: {
  withdrawalId: string;
  decision: 'paid' | 'rejected';
  adminNote: string | null;
}) {
  const client = await tencentPgPool.connect();
  try {
    await client.query('BEGIN');
    const withdrawalResult = await client.query(
      `select * from lc_creator_withdrawals where id = $1 and status = 'pending' for update`,
      [args.withdrawalId],
    );
    const withdrawal = withdrawalResult.rows[0];
    if (!withdrawal) throw new Error('提现申请不存在或已经处理');
    const updatedResult = await client.query(
      `update lc_creator_withdrawals
          set status = $2,
              admin_note = $3,
              paid_at = case when $2 = 'paid' then now() else paid_at end,
              updated_at = now()
        where id = $1 and status = 'pending'
        returning *`,
      [args.withdrawalId, args.decision, args.adminNote],
    );
    const nextIncomeStatus = args.decision === 'paid' ? 'withdraw_paid' : 'withdrawable';
    const clearWithdrawal = args.decision === 'rejected';
    await client.query(
      `update lc_creator_income_entries
          set status = $2,
              withdrawal_id = case when $3 then null else withdrawal_id end,
              updated_at = now()
        where withdrawal_id = $1 and status = 'withdraw_requested'`,
      [args.withdrawalId, nextIncomeStatus, clearWithdrawal],
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
    if (!useTencentPg) return res.status(503).json(err(new Error('提现当前只允许在正式 PostgreSQL 主库执行')));
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const amount = Math.max(0, Math.trunc(Number(req.body?.amount || 0)));
    const accountType = normalizeGuideChoice(req.body?.accountType, ['alipay', 'wechat', 'bank', 'other'], 'alipay');
    const accountName = cleanText(req.body?.accountName, 80);
    const accountIdentifier = cleanText(req.body?.accountIdentifier, 160);
    if (amount < 30) return res.status(400).json(err(new Error('提现金额最低 30')));
    if (!accountName || !accountIdentifier) return res.status(400).json(err(new Error('请填写提现账号和姓名')));

    const withdrawal = await requestCreatorWithdrawalOnTencent({
      creatorId: profile.id,
      amount,
      accountType,
      accountName,
      accountIdentifier,
    });

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

type ProviderListingRecoveryLoadResult =
  | {
      ok: true;
      purchase: Record<string, unknown>;
      profile: Record<string, unknown>;
      poster: Awaited<ReturnType<typeof findRecoverableProviderPoster>>;
      defaults: {
        headline: string;
        description: string;
        height_cm: number | null;
        weight_kg: number | null;
        role_types: string[];
        business_contact: string;
        contact_available: boolean;
      };
    }
  | { ok: false; status: number; message: string };

async function loadProviderListingRecovery(purchaseId: string): Promise<ProviderListingRecoveryLoadResult> {
  const purchaseResult = await supabase.from('lc_service_purchases')
    .select('id, profile_id, product_type, target_id, amount_fen, status, paid_at, created_at')
    .eq('id', purchaseId)
    .maybeSingle();
  if (purchaseResult.error) throw purchaseResult.error;
  if (!purchaseResult.data) return { ok: false, status: 404, message: '付费订单不存在' };
  const purchase = purchaseResult.data as Record<string, unknown>;
  const profileId = cleanText(purchase.profile_id, 80);
  const targetId = cleanText(purchase.target_id, 80);
  if (purchase.product_type !== 'provider_listing') {
    return { ok: false, status: 400, message: '这笔订单不是委托条上架服务' };
  }
  if (purchase.status !== 'paid') {
    return { ok: false, status: 409, message: '只有已支付的委托条订单可以恢复资料' };
  }
  if (!profileId || (targetId && targetId !== profileId)) {
    return { ok: false, status: 409, message: '订单关联账号不一致，不能自动恢复' };
  }

  const [profileResult, dossierResult, servicesResult, contactResult, listingResult, reviewsResult] = await Promise.all([
    supabase.from('lc_profiles').select('*').eq('id', profileId).maybeSingle(),
    supabase.from('lc_dm_dossiers')
      .select('photo_url, height_cm, weight_kg, bio')
      .eq('claimed_by', profileId)
      .eq('claim_status', 'approved')
      .eq('entity_type', 'dm')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('lc_services')
      .select('service_type, description')
      .eq('creator_id', profileId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase.from('lc_provider_contacts')
      .select('business_contact, is_available')
      .eq('profile_id', profileId)
      .maybeSingle(),
    supabase.from('lc_provider_listings')
      .select('profile_id, initial_purchase_id')
      .eq('profile_id', profileId)
      .maybeSingle(),
    supabase.from('lc_public_reviews')
      .select('id, status, payload, created_at')
      .eq('target_type', 'provider_listing_update')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (!profileResult.data) return { ok: false, status: 404, message: '订单关联账号不存在' };
  if (dossierResult.error && !isMissingRelation(dossierResult.error, 'lc_dm_dossiers')) throw dossierResult.error;
  if (servicesResult.error && !isMissingRelation(servicesResult.error, 'lc_services')) throw servicesResult.error;
  if (contactResult.error && !isMissingRelation(contactResult.error, 'lc_provider_contacts')) throw contactResult.error;
  if (listingResult.error && !isMissingRelation(listingResult.error, 'lc_provider_listings')) throw listingResult.error;
  if (reviewsResult.error && !isMissingRelation(reviewsResult.error, 'lc_public_reviews')) throw reviewsResult.error;
  if (listingResult.data) {
    return { ok: false, status: 409, message: '该账号已经有正式委托条，不需要恢复历史订单' };
  }
  const existingReview = (reviewsResult.error ? [] : reviewsResult.data || []).find(review =>
    cleanText(objectPayload(review.payload).initial_purchase_id, 80) === purchaseId);
  if (existingReview) {
    return {
      ok: false,
      status: 409,
      message: existingReview.status === 'pending'
        ? '这笔订单已经生成待审资料，请直接在待审列表处理'
        : '这笔订单已经有审核记录，不能重复恢复',
    };
  }

  const poster = await findRecoverableProviderPoster({
    localUploadRoot: LOCAL_UPLOAD_ROOT,
    profileId,
    paidAt: cleanText(purchase.paid_at, 80) || cleanText(purchase.created_at, 80),
    siteUrl: LINGQI_SITE_URL,
  });
  const dossier = dossierResult.error ? null : dossierResult.data;
  const services = servicesResult.error ? [] : servicesResult.data || [];
  return {
    ok: true,
    purchase,
    profile: profileResult.data as Record<string, unknown>,
    poster,
    defaults: {
      headline: cleanText(dossier?.bio || profileResult.data.bio, 80),
      description: '',
      height_cm: normalizePositiveIntegerField(dossier?.height_cm, 250),
      weight_kg: normalizePositiveIntegerField(dossier?.weight_kg, 300),
      role_types: Array.from(new Set(services.map(item => cleanText(item.service_type, 30)).filter(Boolean))).slice(0, 12),
      business_contact: contactResult.error ? '' : cleanText(contactResult.data?.business_contact, 300),
      contact_available: contactResult.error ? true : contactResult.data?.is_available !== false,
    },
  };
}

app.post('/api/lc/admin/login', async (req, res) => {
  res.status(410).json(err(new Error('独立管理密码已停用，请使用管理员手机号或邮箱在普通登录页登录')));
});

app.get('/api/lc/admin/service-purchases/:id/provider-recovery', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const recovery = await loadProviderListingRecovery(req.params.id);
    if ('status' in recovery) return res.status(recovery.status).json(err(new Error(recovery.message)));
    res.json(ok({
      purchase_id: recovery.purchase.id,
      profile_name: cleanText(recovery.profile.display_name, 120) || '用户',
      poster_url: recovery.poster?.url || null,
      poster_uploaded_at: recovery.poster?.uploaded_at || null,
      poster_payment_distance_ms: recovery.poster?.distance_ms ?? null,
      ...recovery.defaults,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/admin/service-purchases/:id/provider-recovery', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const recovery = await loadProviderListingRecovery(req.params.id);
    if ('status' in recovery) return res.status(recovery.status).json(err(new Error(recovery.message)));
    if (!recovery.poster?.url) {
      return res.status(409).json(err(new Error('没有找到这笔订单付款前上传的委托条主图，不能直接恢复')));
    }
    const businessContact = cleanText(req.body?.businessContact ?? req.body?.business_contact, 300);
    if (businessContact.length < 2) {
      return res.status(400).json(err(new Error('请补录至少 2 个字的委托师业务联系方式')));
    }
    let draft;
    try {
      draft = normalizeProviderListingDraft({
        posterUrl: recovery.poster.url,
        headline: req.body?.headline ?? recovery.defaults.headline,
        description: req.body?.description ?? recovery.defaults.description,
        heightCm: req.body?.heightCm ?? req.body?.height_cm ?? recovery.defaults.height_cm,
        weightKg: req.body?.weightKg ?? req.body?.weight_kg ?? recovery.defaults.weight_kg,
        roleTypes: req.body?.roleTypes ?? req.body?.role_types ?? recovery.defaults.role_types,
      });
    } catch (validationError) {
      return res.status(400).json(err(validationError));
    }
    const posterUrl = normalizeOptionalPublicUrl(draft.poster_url, 1200, true);
    if (!posterUrl) return res.status(400).json(err(new Error('找回的委托条主图地址无效')));
    draft.poster_url = posterUrl;
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'provider_listing_admin_recovery',
      targetType: 'provider_listing',
      texts: {
        headline: draft.headline,
        description: draft.description,
        role_types: draft.role_types.join(' '),
      },
      files: [{ url: draft.poster_url, type: 'image/*' }],
    });
    const review = await createPublicReview({
      targetType: 'provider_listing_update',
      profile: recovery.profile,
      title: '委托师委托条',
      summary: '管理员从异常支付订单恢复的委托条资料',
      payload: {
        profile_id: recovery.profile.id,
        ...draft,
        business_contact: businessContact,
        contact_available: req.body?.contactAvailable !== false && req.body?.contact_available !== false,
        initial_purchase_id: recovery.purchase.id,
        is_active: true,
        recovered_by_admin: true,
        recovered_poster_uploaded_at: recovery.poster.uploaded_at,
      },
      moderationPrecheck,
    });
    await logSecurityEvent(req, {
      action: 'admin_provider_listing_submission_recovered',
      targetType: 'public_review',
      targetId: review?.id,
      metadata: {
        purchase_id: recovery.purchase.id,
        profile_id: recovery.profile.id,
        poster_uploaded_at: recovery.poster.uploaded_at,
        poster_payment_distance_ms: recovery.poster.distance_ms,
        moderation: moderationPrecheck.decision,
      },
    });
    res.status(201).json(ok({
      review_id: review?.id,
      status: 'pending',
      message: '异常订单资料已恢复并进入正式审核',
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/admin/profiles', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const page = Math.max(1, parseInt(String(req.query.page || '1')) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(String(req.query.limit || '50')) || 50));
    const offset = (page - 1) * limit;
    const q = cleanText(req.query.q, 80).replace(/[,_%]/g, '').trim();
    let query = supabase.from('lc_profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (q) {
      const pattern = `%${q}%`;
      query = query.or(`display_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern},wechat_nickname.ilike.${pattern}`);
    }
    const { data, error: queryErr, count } = await query.range(offset, offset + limit - 1);
    if (queryErr) throw queryErr;
    const total = count || 0;
    res.json(ok({
      profiles: (data || []).map(profile => adminProfileListPayload(profile)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/admin/profiles/:id/private-access', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const reason = cleanText(req.body?.reason, 200);
    if (reason.length < 4) return res.status(400).json(err(new Error('请填写至少 4 个字的查看原因')));
    const { data: profile, error: profileErr } = await supabase.from('lc_profiles')
      .select('id, display_name, phone, email, wechat, wechat_nickname, auth_provider')
      .eq('id', req.params.id)
      .maybeSingle();
    if (profileErr) throw profileErr;
    if (!profile) return res.status(404).json(err(new Error('账号不存在')));
    const fields = ['phone', 'email', 'wechat', 'wechat_nickname'].filter(field => cleanText(profile[field], 200));
    const { error: auditErr } = await supabase.from('lc_security_events').insert({
      actor_id: getReq(req, 'creatorId') || null,
      actor_role: getReq(req, 'role') || 'admin',
      action: 'admin_profile_private_view',
      target_type: 'profile',
      target_id: req.params.id,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      request_path: req.originalUrl || req.url,
      metadata: { reason, fields },
    });
    if (auditErr) throw new Error('审计日志写入失败，已拒绝查看隐私信息');
    res.json(ok(adminPrivateAccountPayload(profile)));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/admin/pending', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    await processDueDossierOwnerReviews();
    const [{ data: profiles }, { data: requests }, { data: rankings }, { data: approvedRankings }, rankingEditRequestsResult, { data: comments }, { data: claims }, { data: commissions }, { data: transactions }, { data: certifications }, { data: carpools }, { data: reports }, { data: siteMessages }, { data: scriptContributions }, { data: securityEvents }, dmDossiersResult, approvedDmDossiersResult, dmRatingsResult, storeRatingsResult, dmIdentityWithdrawalsResult, publicReviewsResult, reviewHistoryResult, guidesResult, withdrawalsResult] = await Promise.all([
      supabase.from('lc_profiles').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('lc_contact_requests').select('*, lc_profiles!inner(display_name)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_rankings').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_rankings').select('*').eq('status', 'approved').order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_ranking_edit_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(200),
      supabase.from('lc_comments').select('*, lc_rankings(subject_name, type)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_claims').select('*, lc_rankings(subject_name, type)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_commissions').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_transactions').select('*, lc_profiles(display_name)').eq('type', 'recharge').eq('status', 'pending').is('gateway', null).order('created_at', { ascending: false }),
      supabase.from('lc_certifications').select('*, lc_profiles!inner(display_name)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_carpools').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_reports').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_site_messages').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_script_contributions').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_security_events')
        .select('id, actor_id, actor_role, action, target_type, target_id, ip_address, user_agent, request_path, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('lc_dm_dossiers').select('*').or('status.eq.pending,claim_status.eq.pending').order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_dm_dossiers').select('id, entity_type, dm_name, city, workplace, employment_status, employer_store_id, photo_url, status').eq('status', 'approved').order('approved_at', { ascending: false }).limit(1000),
      supabase.from('lc_dm_ratings').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(200),
      supabase.from('lc_store_ratings').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(200),
      supabase.from('lc_dm_identity_withdrawals').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_public_reviews').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(200),
      supabase.from('lc_public_reviews').select('*').neq('status', 'pending').order('reviewed_at', { ascending: false }).limit(200),
      supabase.from('lc_guides').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(100),
      supabase.from('lc_creator_withdrawals').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(100),
    ]);
    const dmClaimsResult = await supabase.from('lc_dm_dossier_claims')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);
    const accountAppealsResult = await supabase.from('lc_account_appeals')
      .select('*')
      .in('status', ['pending', 'needs_info'])
      .order('created_at', { ascending: false })
      .limit(200);
    const servicePurchasesResult = await supabase.from('lc_service_purchases')
      .select('id, profile_id, product_type, target_id, amount_fen, currency, status, paid_at, refunded_at, refund_reason, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (dmDossiersResult.error && !isMissingRelation(dmDossiersResult.error, 'lc_dm_dossiers')) throw dmDossiersResult.error;
    if (rankingEditRequestsResult.error && !isMissingRelation(rankingEditRequestsResult.error, 'lc_ranking_edit_requests')) throw rankingEditRequestsResult.error;
    if (dmClaimsResult.error && !isMissingRelation(dmClaimsResult.error, 'lc_dm_dossier_claims')) throw dmClaimsResult.error;
    if (approvedDmDossiersResult.error && !isMissingRelation(approvedDmDossiersResult.error, 'lc_dm_dossiers')) throw approvedDmDossiersResult.error;
    if (dmRatingsResult.error && !isMissingRelation(dmRatingsResult.error, 'lc_dm_ratings')) throw dmRatingsResult.error;
    if (storeRatingsResult.error && !isMissingRelation(storeRatingsResult.error, 'lc_store_ratings')) throw storeRatingsResult.error;
    if (dmIdentityWithdrawalsResult.error && !isMissingRelation(dmIdentityWithdrawalsResult.error, 'lc_dm_identity_withdrawals')) throw dmIdentityWithdrawalsResult.error;
    if (publicReviewsResult.error && !isMissingRelation(publicReviewsResult.error, 'lc_public_reviews')) throw publicReviewsResult.error;
    if (reviewHistoryResult.error && !isMissingRelation(reviewHistoryResult.error, 'lc_public_reviews')) throw reviewHistoryResult.error;
    if (guidesResult.error && !isMissingRelation(guidesResult.error, 'lc_guides')) throw guidesResult.error;
    if (withdrawalsResult.error && !isMissingRelation(withdrawalsResult.error, 'lc_creator_withdrawals')) throw withdrawalsResult.error;
    if (accountAppealsResult.error && !isMissingRelation(accountAppealsResult.error, 'lc_account_appeals')) throw accountAppealsResult.error;
    if (servicePurchasesResult.error && !isMissingRelation(servicePurchasesResult.error, 'lc_service_purchases')) throw servicePurchasesResult.error;
    const accountAppeals = accountAppealsResult.error ? [] : (accountAppealsResult.data || []) as Record<string, unknown>[];
    const appealProfileIds = Array.from(new Set(accountAppeals.map(item => cleanText(item.profile_id, 80)).filter(Boolean)));
    const appealRestrictionIds = Array.from(new Set(accountAppeals.map(item => cleanText(item.restriction_id, 80)).filter(Boolean)));
    const [appealProfilesResult, appealRestrictionsResult] = await Promise.all([
      appealProfileIds.length > 0
        ? supabase.from('lc_profiles').select('id, display_name').in('id', appealProfileIds)
        : Promise.resolve({ data: [], error: null }),
      appealRestrictionIds.length > 0
        ? supabase.from('lc_account_restrictions').select('id, scope, reason, starts_at, ends_at, status').in('id', appealRestrictionIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (appealProfilesResult.error) throw appealProfilesResult.error;
    if (appealRestrictionsResult.error) throw appealRestrictionsResult.error;
    const appealProfileMap = new Map((appealProfilesResult.data || []).map(item => [String(item.id), item]));
    const appealRestrictionMap = new Map((appealRestrictionsResult.data || []).map(item => [String(item.id), item]));
    const servicePurchaseRows = servicePurchasesResult.error
      ? []
      : (servicePurchasesResult.data || []) as Record<string, unknown>[];
    const servicePurchaseIds = servicePurchaseRows.map(item => cleanText(item.id, 80)).filter(Boolean);
    const serviceProfileIds = Array.from(new Set(servicePurchaseRows.flatMap(item => {
      const ids = [cleanText(item.profile_id, 80)];
      if (item.product_type === 'provider_listing' || item.product_type === 'provider_contact') {
        ids.push(cleanText(item.target_id, 80));
      }
      return ids.filter(Boolean);
    })));
    const serviceDossierIds = Array.from(new Set(servicePurchaseRows
      .filter(item => item.product_type === 'dossier_claim')
      .map(item => cleanText(item.target_id, 80))
      .filter(Boolean)));
    const [serviceProfilesResult, serviceDossiersResult, serviceClaimsResult, providerListingsResult] = await Promise.all([
      serviceProfileIds.length > 0
        ? supabase.from('lc_profiles').select('id, display_name').in('id', serviceProfileIds)
        : Promise.resolve({ data: [], error: null }),
      serviceDossierIds.length > 0
        ? supabase.from('lc_dm_dossiers').select('id, dm_name, entity_type').in('id', serviceDossierIds)
        : Promise.resolve({ data: [], error: null }),
      servicePurchaseIds.length > 0
        ? supabase.from('lc_dm_dossier_claims')
          .select('id, payment_purchase_id, status, created_at, reviewed_at')
          .in('payment_purchase_id', servicePurchaseIds)
          .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      servicePurchaseIds.length > 0
        ? supabase.from('lc_provider_listings')
          .select('profile_id, initial_purchase_id, updated_at')
          .in('initial_purchase_id', servicePurchaseIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (serviceProfilesResult.error) throw serviceProfilesResult.error;
    if (serviceDossiersResult.error && !isMissingRelation(serviceDossiersResult.error, 'lc_dm_dossiers')) throw serviceDossiersResult.error;
    if (serviceClaimsResult.error && !isMissingRelation(serviceClaimsResult.error, 'lc_dm_dossier_claims')) throw serviceClaimsResult.error;
    if (providerListingsResult.error && !isMissingRelation(providerListingsResult.error, 'lc_provider_listings')) throw providerListingsResult.error;
    const serviceProfileMap = new Map((serviceProfilesResult.data || []).map(item => [String(item.id), item]));
    const serviceDossierMap = new Map((serviceDossiersResult.data || []).map(item => [String(item.id), item]));
    const serviceClaimMap = new Map((serviceClaimsResult.data || []).map(item => [String(item.payment_purchase_id), item]));
    const providerListingMap = new Map((providerListingsResult.data || []).map(item => [String(item.initial_purchase_id), item]));
    const providerReviewMap = new Map<string, Record<string, unknown>>();
    [
      ...(publicReviewsResult.error ? [] : (publicReviewsResult.data || [])),
      ...(reviewHistoryResult.error ? [] : (reviewHistoryResult.data || [])),
    ].forEach(rawReview => {
      const review = rawReview as Record<string, unknown>;
      if (review.target_type !== 'provider_listing_update') return;
      const purchaseId = cleanText(objectPayload(review.payload).initial_purchase_id, 80);
      if (!purchaseId) return;
      const current = providerReviewMap.get(purchaseId);
      if (!current || String(review.created_at || '') > String(current.created_at || '')) {
        providerReviewMap.set(purchaseId, review);
      }
    });
    const servicePurchases = servicePurchaseRows.map(purchase => {
      const purchaseId = cleanText(purchase.id, 80);
      const productType = cleanText(purchase.product_type, 40);
      const claim = serviceClaimMap.get(purchaseId);
      const providerReview = providerReviewMap.get(purchaseId);
      const providerListing = providerListingMap.get(purchaseId);
      let submissionStatus = 'not_submitted';
      let submissionId: string | null = null;
      if (productType === 'provider_contact' && purchase.status === 'paid') {
        submissionStatus = 'access_granted';
      } else if (productType === 'dossier_claim' && claim) {
        submissionStatus = cleanText(claim.status, 40) || 'not_submitted';
        submissionId = cleanText(claim.id, 80) || null;
      } else if (productType === 'provider_listing' && providerReview) {
        submissionStatus = cleanText(providerReview.status, 40) || 'not_submitted';
        submissionId = cleanText(providerReview.id, 80) || null;
      } else if (productType === 'provider_listing' && providerListing) {
        submissionStatus = 'approved';
      }
      const targetProfile = serviceProfileMap.get(cleanText(purchase.target_id, 80));
      const targetDossier = serviceDossierMap.get(cleanText(purchase.target_id, 80));
      return {
        ...purchase,
        profile_name: serviceProfileMap.get(cleanText(purchase.profile_id, 80))?.display_name || '未知用户',
        target_name: productType === 'dossier_claim'
          ? targetDossier?.dm_name || '未知档案'
          : targetProfile?.display_name || '未知用户',
        target_entity_type: targetDossier?.entity_type || null,
        submission_status: submissionStatus,
        submission_id: submissionId,
      };
    });
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
      profiles: (profiles || []).map(profile => adminProfileListPayload(profile)),
      contactRequests: requests || [],
      rankings: (rankings || []).map((ranking: Record<string, unknown>) => ({
        ...ranking,
        display_files: normalizeRankingDisplayFiles(ranking.display_files),
        private_evidence_files: publicRankingEvidenceMetadata(ranking.private_evidence_files),
      })),
      approvedRankings: (approvedRankings || []).map((ranking: Record<string, unknown>) => ({
        ...ranking,
        display_files: normalizeRankingDisplayFiles(ranking.display_files),
        private_evidence_files: publicRankingEvidenceMetadata(ranking.private_evidence_files),
      })),
      rankingEditRequests: rankingEditRequestsResult.error ? [] : (rankingEditRequestsResult.data || []),
      comments: comments || [],
      claims: claims || [],
      commissions: (commissions || []).map((item: Record<string, unknown>) => publicCommissionRow(item)),
      transactions: transactions || [],
      certifications: certifications || [],
      carpools: carpools || [],
      reports: (reports || []).map((report: Record<string, unknown>) => ({
        ...report,
        evidence_files: report.target_type === 'dm_affiliation'
          ? publicClaimProofMetadata(report.evidence_files)
          : publicModerationEvidenceMetadata(report.evidence_files),
      })),
      siteMessages: (siteMessages || []).map((message: Record<string, unknown>) => ({
        ...message,
        evidence_files: publicModerationEvidenceMetadata(message.evidence_files),
      })),
      accountAppeals: accountAppeals.map(item => ({
        ...item,
        profile_name: appealProfileMap.get(String(item.profile_id))?.display_name || '未知用户',
        restriction: appealRestrictionMap.get(String(item.restriction_id)) || null,
      })),
      scriptContributions: scriptContributions || [],
      securityEvents: securityEvents || [],
      dmDossiers: pendingDmDossiers,
      dossierOptions: approvedDossiers,
      dmRatings: pendingDmRatings,
      storeRatings: pendingStoreRatings,
      dmIdentityWithdrawals: pendingDmIdentityWithdrawals,
      publicReviews: publicReviewsResult.error ? [] : (publicReviewsResult.data || [])
        .map((review: Record<string, unknown>) => {
        if (review.target_type !== 'dossier_update') return review;
        const payload = objectPayload(review.payload);
        return {
          ...review,
          payload: {
            ...payload,
            owner_response_status: effectiveDossierOwnerResponseStatus({
              status: cleanText(payload.owner_response_status, 40),
              dueAt: cleanText(payload.owner_response_due_at, 80),
            }),
          },
        };
      }),
      reviewHistory: reviewHistoryResult.error ? [] : (reviewHistoryResult.data || []),
      servicePurchases,
      guides: guidesResult.error ? [] : (guidesResult.data || []),
      guideWithdrawals: withdrawalsResult.error ? [] : (withdrawalsResult.data || []),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/admin/commission-applications', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 200));
    const { data: applications, error: applicationErr } = await supabase.from('lc_commission_applications')
      .select('id, commission_id, applicant_id, applicant_name, applicant_is_realname, letter, status, decided_at, contact_unlocked_at, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (applicationErr && isMissingRelation(applicationErr, 'lc_commission_applications')) return res.json(ok([]));
    if (applicationErr) throw applicationErr;
    const commissionIds = Array.from(new Set((applications || []).map(item => item.commission_id).filter(Boolean)));
    const commissionResult = commissionIds.length > 0
      ? await supabase.from('lc_commissions').select('id, poster_id, poster_name, title, city, needed_date, needed_end_date, status').in('id', commissionIds)
      : { data: [], error: null };
    if (commissionResult.error) throw commissionResult.error;
    const commissionMap = new Map((commissionResult.data || []).map(item => [item.id, item]));
    await logSecurityEvent(req, {
      action: 'admin_commission_applications_viewed',
      actorId: getReq(req, 'creatorId'),
      actorRole: getReq(req, 'role') || 'admin',
      targetType: 'commission_application',
      metadata: { returned_count: (applications || []).length },
    });
    res.json(ok((applications || []).map(item => ({ ...item, commission: commissionMap.get(item.commission_id) || null }))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/admin/provider-inquiries', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 200));
    const inquiryResult = await supabase.from('lc_provider_inquiries')
      .select('id, provider_id, requester_id, requester_name, message, status, decided_at, contact_unlocked_at, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (inquiryResult.error && isMissingRelation(inquiryResult.error, 'lc_provider_inquiries')) return res.json(ok([]));
    if (inquiryResult.error) throw inquiryResult.error;
    const profileIds = Array.from(new Set((inquiryResult.data || [])
      .flatMap(item => [item.provider_id, item.requester_id])
      .filter(Boolean)));
    const profileResult = profileIds.length > 0
      ? await supabase.from('lc_profiles').select('id, display_name').in('id', profileIds)
      : { data: [], error: null };
    if (profileResult.error) throw profileResult.error;
    const profileMap = new Map((profileResult.data || []).map(item => [String(item.id), cleanText(item.display_name, 120) || '用户']));
    await logSecurityEvent(req, {
      action: 'admin_provider_inquiries_viewed',
      actorId: getReq(req, 'creatorId'),
      actorRole: getReq(req, 'role') || 'admin',
      targetType: 'provider_inquiry',
      metadata: { returned_count: (inquiryResult.data || []).length, private_contacts_returned: false },
    });
    res.json(ok((inquiryResult.data || []).map(item => ({
      ...item,
      provider_name: profileMap.get(String(item.provider_id)) || '委托师',
      requester_name: profileMap.get(String(item.requester_id)) || cleanText(item.requester_name, 120) || '用户',
    }))));
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
    if (!useTencentPg) return res.status(503).json(err(new Error('提现审核当前只允许在正式 PostgreSQL 主库执行')));
    const adminNote = cleanText(req.body?.adminNote, 500);
    const updated = await decideCreatorWithdrawalOnTencent({
      withdrawalId: req.params.id,
      decision: 'paid',
      adminNote: adminNote || null,
    });
    await logSecurityEvent(req, {
      action: 'admin_guide_withdrawal_paid',
      targetType: 'creator_withdrawal',
      targetId: req.params.id,
      metadata: { amount: updated.amount, admin_note: adminNote || null },
    });
    res.json(ok(updated));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/guide-withdrawals/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (!useTencentPg) return res.status(503).json(err(new Error('提现审核当前只允许在正式 PostgreSQL 主库执行')));
    const rejectReason = cleanText(req.body?.rejectReason, 500) || '提现申请未通过';
    const updated = await decideCreatorWithdrawalOnTencent({
      withdrawalId: req.params.id,
      decision: 'rejected',
      adminNote: rejectReason,
    });
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
    await assertWechatImageChecksAllowApproval(collectPotentialPublicImageUrls(review.payload));
    if (review.target_type === 'dossier_update') {
      const payload = objectPayload(review.payload);
      if (cleanText(payload.review_mode, 30) === 'owner') {
        return res.status(409).json(err(new Error('已认领档案由认领人处理，不进入管理员审核')));
      }
      if (!dossierEditAdminReviewReady({
        status: cleanText(payload.owner_response_status, 40),
        dueAt: cleanText(payload.owner_response_due_at, 80),
      })) {
        return res.status(409).json(err(new Error(dossierEditAdminBlockReason(payload))));
      }
      const consentResult = dossierPatchForOwnerConsent(objectPayload(payload.patch), {
        submitterIsOwner: Boolean(payload.submitter_is_owner),
        ownerResponseStatus: effectiveDossierOwnerResponseStatus({
          status: cleanText(payload.owner_response_status, 40),
          dueAt: cleanText(payload.owner_response_due_at, 80),
        }),
      });
      if (Object.keys(consentResult.appliedPatch).length === 0 && consentResult.omittedSensitiveFields.length > 0) {
        return res.status(409).json(err(new Error('出生年份、身高和体重必须由 DM 本人明确同意后才能公开')));
      }
    }

    const dossierReviewMode = review.target_type === 'dossier_update'
      ? cleanText(objectPayload(review.payload).review_mode, 30)
      : '';
    if (dossierReviewMode !== 'admin_post') {
      await applyPublicReview(review as PublicReviewRecord, reviewerId);
    }
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
    const reviewResult = await supabase.from('lc_public_reviews').select('*').eq('id', req.params.id).maybeSingle();
    if (reviewResult.error) throw reviewResult.error;
    if (!reviewResult.data || reviewResult.data.status !== 'pending') return res.status(404).json(err(new Error('审核记录不存在或已经处理')));
    if (reviewResult.data.target_type === 'dossier_update'
      && cleanText(objectPayload(reviewResult.data.payload).review_mode, 30) === 'owner') {
      return res.status(409).json(err(new Error('已认领档案由认领人处理，不进入管理员审核')));
    }
    let rejectedPayload = objectPayload(reviewResult.data.payload);
    if (reviewResult.data.target_type === 'dossier_update'
      && ['admin_post', 'admin_mixed'].includes(cleanText(rejectedPayload.review_mode, 30))) {
      rejectedPayload = await rollbackDossierPostReview(reviewResult.data as PublicReviewRecord, rejectedPayload);
    }
    if (reviewResult.data.target_type === 'rating_discussion_create') {
      const nodeId = cleanText(rejectedPayload.node_id, 80);
      if (nodeId) {
        const nodeResult = await supabase.from('lc_rating_discussion_nodes').update({
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          review_note: rejectReason,
          updated_at: new Date().toISOString(),
        }).eq('id', nodeId).eq('status', 'pending');
        if (nodeResult.error) throw nodeResult.error;
      }
    }
    const { error: updErr } = await supabase.from('lc_public_reviews')
      .update({
        payload: rejectedPayload,
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
    await assertWechatImageChecksAllowApproval(collectPotentialPublicImageUrls({
      photo_url: dossier.photo_url,
      photo_files: dossier.photo_files,
    }));

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
    const adminReply = cleanText(req.body?.adminReply ?? req.body?.admin_reply, 1000);
    const { data, error: updErr } = await supabase.from('lc_site_messages')
      .update({
        status: 'resolved',
        admin_note: adminNote || null,
        admin_reply: adminReply || null,
        replied_at: adminReply ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('id, sender_id, subject')
      .single();
    if (updErr) {
      if (isMissingRelation(updErr, 'lc_site_messages')) return res.status(503).json(err(new Error('站内信表尚未初始化')));
      throw updErr;
    }
    if (data?.sender_id) {
      await notifyProfile({
        profileId: data.sender_id,
        type: 'site_message_resolved',
        title: '反馈已有处理结果',
        content: adminReply || `你提交的“${cleanText(data.subject, 80) || '反馈'}”已处理，可在“我的反馈”中查看。`,
        relatedType: 'site_message',
        relatedId: data.id,
        actionUrl: '/contact',
      });
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
  const client = await tencentPgPool.connect();
  try {
    const reason = cleanText(req.body?.reason || req.body?.rejectReason, 600) || '违反平台规则，限制账号功能';
    const scope: AccountRestrictionScope = req.body?.scope === 'account' ? 'account' : 'publish';
    const rawEndsAt = cleanText(req.body?.endsAt, 80);
    const endsAt = rawEndsAt ? new Date(rawEndsAt) : null;
    if (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt.getTime() <= Date.now())) {
      return res.status(400).json(err(new Error('限制结束时间必须晚于当前时间')));
    }
    const adminId = getReq(req, 'creatorId');
    await client.query('begin');
    const profileResult = await client.query<{
      id: string;
      is_visible: boolean;
      is_banned: boolean;
      merged_into: string | null;
      restriction_scope: string | null;
    }>('select id, is_visible, is_banned, merged_into, restriction_scope from lc_profiles where id = $1 for update', [req.params.id]);
    const profile = profileResult.rows[0];
    if (!profile) {
      await client.query('rollback');
      return res.status(404).json(err(new Error('账号不存在')));
    }
    if (profile.merged_into) {
      await client.query('rollback');
      return res.status(409).json(err(new Error('这是已合并的历史账号，不能设置或解除处罚')));
    }
    const activeResult = await client.query<{ id: string; profile_was_visible: boolean }>(
      `select id, profile_was_visible
       from lc_account_restrictions
       where profile_id = $1 and status = 'active'
       for update`,
      [req.params.id],
    );
    const active = activeResult.rows[0];
    const profileWasVisible = active?.profile_was_visible ?? profile.is_visible;
    let restrictionId = active?.id || '';
    if (active) {
      await client.query(
        `update lc_account_restrictions
         set scope = $2, reason = $3, ends_at = $4, updated_at = now()
         where id = $1`,
        [active.id, scope, reason, endsAt?.toISOString() || null],
      );
    } else {
      const inserted = await client.query<{ id: string }>(
        `insert into lc_account_restrictions
           (profile_id, scope, reason, ends_at, profile_was_visible, created_by)
         values ($1, $2, $3, $4, $5, $6)
         returning id`,
        [req.params.id, scope, reason, endsAt?.toISOString() || null, profile.is_visible, adminId],
      );
      restrictionId = inserted.rows[0].id;
    }
    const nextVisible = scope === 'account'
      ? false
      : profile.restriction_scope === 'account'
        ? profileWasVisible
        : profile.is_visible;
    await client.query(
      `update lc_profiles
       set is_banned = true,
           ban_reason = $2,
           banned_at = coalesce(banned_at, now()),
           restriction_scope = $3,
           restriction_ends_at = $4,
           is_visible = $5,
           updated_at = now()
       where id = $1`,
      [req.params.id, reason, scope, endsAt?.toISOString() || null, nextVisible],
    );
    const scopeLabel = scope === 'publish' ? '发布功能' : '账号功能';
    const endLabel = endsAt ? `，至 ${endsAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}` : '，长期有效';
    await client.query(
      `insert into lc_account_notifications
         (profile_id, type, title, content, action_url, related_type, related_id)
       values ($1, $2, $3, $4, '/account-status', 'account_restriction', $5)`,
      [
        req.params.id,
        active ? 'restriction_changed' : 'restriction_started',
        active ? '账号限制已调整' : '账号功能受到限制',
        `${scopeLabel}已被限制${endLabel}。原因：${reason}`,
        restrictionId,
      ],
    );
    await client.query('commit');
    await logSecurityEvent(req, {
      action: active ? 'admin_profile_restriction_changed' : 'admin_profile_banned',
      targetType: 'profile',
      targetId: req.params.id,
      metadata: { reason, scope, ends_at: endsAt?.toISOString() || null, restriction_id: restrictionId },
    });
    res.json(ok({ id: req.params.id, is_banned: true, restriction_scope: scope, restriction_ends_at: endsAt?.toISOString() || null }));
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    res.status(500).json(err(e));
  } finally { client.release(); }
});

app.put('/api/lc/admin/profile/:id/unban', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await tencentPgPool.connect();
  try {
    const restoreProfile = req.body?.restoreProfile === true;
    const adminNote = cleanText(req.body?.adminNote, 600) || '管理员解除账号限制';
    const adminId = getReq(req, 'creatorId');
    await client.query('begin');
    const profileResult = await client.query<{ id: string; is_visible: boolean; merged_into: string | null; ban_reason: string | null; reject_reason: string | null }>(
      'select id, is_visible, merged_into, ban_reason, reject_reason from lc_profiles where id = $1 for update',
      [req.params.id],
    );
    const profile = profileResult.rows[0];
    if (!profile) {
      await client.query('rollback');
      return res.status(404).json(err(new Error('账号不存在')));
    }
    if (profile.merged_into) {
      await client.query('rollback');
      return res.status(409).json(err(new Error('这是已合并的历史账号，不能解除处罚')));
    }
    const activeResult = await client.query<{ id: string; profile_was_visible: boolean }>(
      `select id, profile_was_visible
       from lc_account_restrictions
       where profile_id = $1 and status = 'active'
       for update`,
      [req.params.id],
    );
    const active = activeResult.rows[0];
    const nextVisible = restoreProfile ? (active?.profile_was_visible ?? true) : profile.is_visible;
    if (active) {
      await client.query(
        `update lc_account_restrictions
         set status = 'lifted', lifted_by = $2, lifted_at = now(), admin_note = $3,
             restore_profile_on_lift = $4, updated_at = now()
         where id = $1`,
        [active.id, adminId, adminNote, restoreProfile],
      );
    }
    await client.query(
      `update lc_profiles
       set is_banned = false,
           ban_reason = null,
           banned_at = null,
           restriction_scope = null,
           restriction_ends_at = null,
           is_visible = $2,
           reject_reason = case when $3 and reject_reason = ban_reason then null else reject_reason end,
           updated_at = now()
       where id = $1`,
      [req.params.id, nextVisible, restoreProfile],
    );
    await client.query(
      `insert into lc_account_notifications
         (profile_id, type, title, content, action_url, related_type, related_id)
       values ($1, 'restriction_lifted', '账号限制已解除', $2, '/account-status', 'account_restriction', $3)`,
      [req.params.id, adminNote, active?.id || null],
    );
    await client.query('commit');
    await logSecurityEvent(req, {
      action: 'admin_profile_unbanned',
      targetType: 'profile',
      targetId: req.params.id,
      metadata: { restore_profile: restoreProfile, restriction_id: active?.id || null },
    });
    res.json(ok({ id: req.params.id, is_banned: false, is_visible: nextVisible }));
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    res.status(500).json(err(e));
  } finally { client.release(); }
});

app.put('/api/lc/admin/account-appeals/:id/review', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await tencentPgPool.connect();
  try {
    const decision = cleanText(req.body?.decision, 40);
    if (!['approved', 'rejected', 'needs_info'].includes(decision)) {
      return res.status(400).json(err(new Error('请选择通过、维持限制或要求补充说明')));
    }
    const adminReply = cleanText(req.body?.adminReply, 1200);
    if (adminReply.length < 2) return res.status(400).json(err(new Error('请填写处理说明')));
    const restoreProfile = req.body?.restoreProfile === true;
    const adminId = getReq(req, 'creatorId');
    await client.query('begin');
    const appealResult = await client.query<{
      id: string;
      profile_id: string;
      restriction_id: string;
      status: string;
    }>('select id, profile_id, restriction_id, status from lc_account_appeals where id = $1 for update', [req.params.id]);
    const appeal = appealResult.rows[0];
    if (!appeal) {
      await client.query('rollback');
      return res.status(404).json(err(new Error('申诉不存在')));
    }
    if (!['pending', 'needs_info'].includes(appeal.status)) {
      await client.query('rollback');
      return res.status(409).json(err(new Error('这条申诉已经处理')));
    }
    await client.query(
      `update lc_account_appeals
       set status = $2, admin_reply = $3, reviewed_by = $4,
           reviewed_at = case when $2 = 'needs_info' then null else now() end,
           updated_at = now()
       where id = $1`,
      [appeal.id, decision, adminReply, adminId],
    );

    if (decision === 'approved') {
      const restrictionResult = await client.query<{ id: string; status: string; profile_was_visible: boolean }>(
        'select id, status, profile_was_visible from lc_account_restrictions where id = $1 for update',
        [appeal.restriction_id],
      );
      const restriction = restrictionResult.rows[0];
      if (restriction?.status === 'active') {
        await client.query(
          `update lc_account_restrictions
           set status = 'lifted', lifted_by = $2, lifted_at = now(), admin_note = $3,
               restore_profile_on_lift = $4, updated_at = now()
           where id = $1`,
          [restriction.id, adminId, adminReply, restoreProfile],
        );
        await client.query(
          `update lc_profiles
           set is_banned = false,
               ban_reason = null,
               banned_at = null,
               restriction_scope = null,
               restriction_ends_at = null,
               is_visible = case when $2 then $3 else is_visible end,
               updated_at = now()
           where id = $1`,
          [appeal.profile_id, restoreProfile, restriction.profile_was_visible],
        );
      }
    }

    const notificationType = decision === 'approved'
      ? 'appeal_approved'
      : decision === 'needs_info'
        ? 'appeal_needs_info'
        : 'appeal_rejected';
    const notificationTitle = decision === 'approved'
      ? '账号申诉已通过'
      : decision === 'needs_info'
        ? '账号申诉需要补充说明'
        : '账号申诉处理完成';
    await client.query(
      `insert into lc_account_notifications
         (profile_id, type, title, content, action_url, related_type, related_id)
       values ($1, $2, $3, $4, '/account-status', 'account_appeal', $5)`,
      [appeal.profile_id, notificationType, notificationTitle, adminReply, appeal.id],
    );
    await client.query('commit');
    await logSecurityEvent(req, {
      action: 'admin_account_appeal_reviewed',
      targetType: 'account_appeal',
      targetId: appeal.id,
      metadata: { decision, restore_profile: restoreProfile, restriction_id: appeal.restriction_id },
    });
    res.json(ok({ id: appeal.id, status: decision, admin_reply: adminReply }));
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    res.status(500).json(err(e));
  } finally { client.release(); }
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
    const selectFields = 'id,target_type,target_id,event_type,content_hash,previous_hash,entry_hash,chain_date,created_at,metadata';
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
    let target: Record<string, unknown> | null = null;
    let publicTarget = false;
    if (targetType === 'ranking') {
      const { data: ranking, error: targetErr } = await supabase.from('lc_rankings')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();
      if (targetErr) throw targetErr;
      publicTarget = Boolean(ranking && ranking.status === 'approved' && isPublicRankingVisible(ranking));
      target = publicTarget && ranking ? publicRankingPayload(ranking) : null;
    } else {
      const table = targetType === 'comment'
        ? 'lc_comments'
        : targetType === 'commission'
          ? 'lc_commissions'
          : 'lc_carpools';
      const { data: row, error: targetErr } = await supabase.from(table)
        .select('id,status')
        .eq('id', req.params.id)
        .maybeSingle();
      if (targetErr) throw targetErr;
      publicTarget = Boolean(row && ['approved', 'open', 'closed'].includes(String(row.status || '')));
    }
    if (!publicTarget) return res.status(404).json(err(new Error('公开审计记录不存在')));

    const entries = ((rawEntries || []) as unknown as Array<Record<string, unknown> & { chain_date: string }>).map(entry => ({
      id: entry.id,
      target_type: entry.target_type,
      target_id: entry.target_id,
      event_type: entry.event_type,
      content_hash: entry.content_hash,
      previous_hash: entry.previous_hash,
      entry_hash: entry.entry_hash,
      chain_date: entry.chain_date,
      created_at: entry.created_at,
      metadata: publicAuditMetadata(entry.metadata),
    }));
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

app.get('/api/lc/admin/audit/:targetType/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const targetType = req.params.targetType as AuditTargetType;
    if (!['ranking', 'comment', 'commission', 'carpool'].includes(targetType)) {
      return res.status(400).json(err(new Error('无效审计对象')));
    }
    const { data, error: queryErr } = await supabase.from('lc_audit_chain_entries')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (queryErr) throw queryErr;
    await logSecurityEvent(req, {
      action: 'admin_audit_detail_viewed',
      targetType,
      targetId: req.params.id,
      metadata: { entry_count: data?.length || 0 },
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json(ok({ entries: data || [] }));
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

function normalizeRankingDisplayFiles(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).map((raw, index) => {
    const file = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const url = normalizeOptionalPublicUrl(file.url, 1000, true);
    if (!url) return null;
    return {
      name: cleanText(file.name, 120) || `正文配图 ${index + 1}`,
      url,
      type: cleanText(file.type, 80) || 'image/jpeg',
      size: Math.max(0, Number(file.size || 0) || 0),
    };
  }).filter(Boolean);
}

function rankingRequestBody(req: express.Request) {
  if (typeof req.body?.payload !== 'string') return (req.body || {}) as Record<string, unknown>;
  try {
    const parsed = JSON.parse(req.body.payload);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('提交内容格式不正确');
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error('提交内容格式不正确');
  }
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
  if (requestedStatus === 'unknown' && !workplace) {
    return { employment_status: 'unknown', employer_store_id: null, workplace: null };
  }
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
  if (input.subjectType === 'dm') {
    const requestedStatus = cleanText(source.employmentStatus ?? source.employment_status, 40);
    const requestedEmployer = cleanText(source.employerStoreId ?? source.employer_store_id, 80);
    employment = !workplace && !requestedEmployer
      ? { employment_status: requestedStatus === 'freelance' ? 'freelance' : 'unknown', employer_store_id: null, workplace: null }
      : await resolveDmEmployment(source, workplace);
  }
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
    source: status === 'approved'
      ? 'store_confirmed'
      : affiliation?.requested_by_role === 'dm'
        ? 'self_declared'
        : affiliation?.requested_by_role === 'community'
          ? 'community_unverified'
          : 'legacy_unverified',
    confirmed_at: status === 'approved' ? affiliation?.started_at || affiliation?.reviewed_at || null : null,
  };
}

function publicDossierPhotoFiles(dossier: Record<string, unknown>): DossierPhoto[] {
  return normalizeDossierPhotos(dossier.photo_files, dossier.photo_url).map(photo => ({
    url: photo.url,
    name: photo.name || null,
    type: photo.type || 'image/*',
    caption: photo.caption || null,
    focus_x: normalizeImageFocus(photo.focus_x, 50),
    focus_y: normalizeImageFocus(photo.focus_y, 25),
  }));
}

function publicDossierWikiPayload(
  dossier: Record<string, unknown>,
  affiliation?: { status?: string; store_dossier_id?: unknown } | null,
) {
  const confirmedStoreId = affiliation?.status === 'approved' ? cleanText(affiliation.store_dossier_id, 120) : '';
  const careerHistory = normalizeDossierCareerHistory(dossier.career_history).map(entry => ({
    ...entry,
    verification_status: confirmedStoreId && entry.store_dossier_id === confirmedStoreId
      ? 'store_confirmed'
      : 'platform_reviewed',
  }));
  const numberOrNull = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const fieldProvenance = Object.fromEntries(Object.entries(normalizeDossierFieldProvenance(dossier.field_provenance))
    .map(([field, entry]) => [field, { source: entry.source, updated_at: entry.updated_at || null }]));
  return {
    photo_files: publicDossierPhotoFiles(dossier),
    dm_started_month: normalizeDossierMonth(dossier.dm_started_month),
    birth_year: numberOrNull(dossier.birth_year),
    height_cm: numberOrNull(dossier.height_cm),
    weight_kg: numberOrNull(dossier.weight_kg),
    mbti: normalizeDmPersonalityValue(dossier.mbti, DM_MBTI_VALUES, 'MBTI'),
    zodiac: normalizeDmPersonalityValue(dossier.zodiac, DM_ZODIAC_VALUES, '星座'),
    bio: cleanText(dossier.bio, 3000) || null,
    common_scripts: normalizeDossierNamedRefs(dossier.common_scripts, MAX_DOSSIER_COMMON_SCRIPTS) as DossierNamedRef[],
    career_history: careerHistory as Array<DossierCareerEntry & { verification_status: string }>,
    related_profiles: normalizeDossierNamedRefs(dossier.related_profiles) as DossierNamedRef[],
    related_stores: normalizeDossierNamedRefs(dossier.related_stores) as DossierNamedRef[],
    field_provenance: fieldProvenance,
  };
}

app.get('/api/lc/reputation/city', async (req, res) => {
  try {
    const city = cleanText(req.query.city, 80);
    const subjectType = cleanText(req.query.subjectType, 40);
    const sort = cleanText(req.query.sort, 40) || 'composite';

    let query = supabase
      .from('lc_rankings')
      .select('id, type, subject_name, subject_type, subject_city, subject_url, subject_dossier_id, event_date, event_script_id, event_script_name, event_store_dossier_id, event_store_name, content, author_name, poster_id, is_realname, initial_amount, likes, dislikes, joys, boost_amount, negative_boost_amount, agree_count, oppose_count, status, expires_at, expiry_override, created_at, last_activity_at')
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
          supabase.from('lc_votes').select('ranking_id, vote_type, reputation_identity_id, voter_id, voter_name, source, created_at').in('ranking_id', rankingIds).limit(2000),
          supabase.from('lc_comments').select('ranking_id, id, likes, created_at').in('ranking_id', rankingIds).eq('status', 'approved').limit(2000),
        ])
      : [{ data: [] }, { data: [] }];

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
      const summary = buildReputationSummary(subjectRows, votes || [], comments || []);
      const latestEvents = [...subjectRows]
        .sort((a, b) => new Date(String(b.last_activity_at || b.created_at)).getTime() - new Date(String(a.last_activity_at || a.created_at)).getTime())
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
        participant_count: 0,
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
      if (sort === 'praise') return Number(b.praise_people || 0) - Number(a.praise_people || 0) || Number(b.reputation_value || 0) - Number(a.reputation_value || 0);
      if (sort === 'people') return Number(b.praise_people || 0) - Number(a.praise_people || 0) || Number(b.reputation_value || 0) - Number(a.reputation_value || 0);
      if (sort === 'new') return new Date(String(b.latest_at || 0)).getTime() - new Date(String(a.latest_at || 0)).getTime();
      return Number(b.reputation_value || 0) - Number(a.reputation_value || 0) || Number(b.praise_people || 0) - Number(a.praise_people || 0);
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
      .select('id, type, subject_name, subject_type, subject_city, subject_url, subject_dossier_id, event_date, event_script_id, event_script_name, event_store_dossier_id, event_store_name, content, author_name, poster_id, is_realname, initial_amount, likes, dislikes, joys, boost_amount, negative_boost_amount, agree_count, oppose_count, status, expires_at, expiry_override, created_at, last_activity_at')
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
    const [{ data: votes }, { data: comments }] = rankingIds.length > 0
      ? await Promise.all([
          supabase.from('lc_votes').select('ranking_id, vote_type, reputation_identity_id, voter_id, voter_name, source, created_at').in('ranking_id', rankingIds).limit(2000),
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

function collectPublicRatingTags(rows: Record<string, unknown>[]) {
  const seen = new Set<string>();
  const tags: string[] = [];
  rows.forEach(row => {
    cleanTextArray(row.tags, 8, 20).forEach(tag => {
      const key = tag.toLocaleLowerCase('zh-CN');
      if (seen.has(key)) return;
      seen.add(key);
      tags.push(tag);
    });
  });
  return tags;
}

type RatingDiscussionType = 'dm' | 'store';
type RatingReactionTargetType = 'dm_rating' | 'store_rating' | 'discussion_node';

function ratingSource(type: RatingDiscussionType) {
  return type === 'dm'
    ? { table: 'lc_dm_ratings', dossierColumn: 'dm_dossier_id', dossierType: 'dm', label: 'DM' }
    : { table: 'lc_store_ratings', dossierColumn: 'store_dossier_id', dossierType: 'store', label: '店家' };
}

function publicRatingReaction(votes: Record<string, unknown>[], profileId: string | null) {
  return {
    likes: votes.filter(vote => vote.vote_type === 'like').length,
    dislikes: votes.filter(vote => vote.vote_type === 'dislike').length,
    my_vote: profileId ? (votes.find(vote => vote.profile_id === profileId)?.vote_type || null) : null,
  };
}

async function loadRatingDiscussionPayload(
  ratingType: RatingDiscussionType,
  ratingRows: Record<string, unknown>[],
  profileId: string | null,
) {
  const ratingIds = ratingRows.map(row => String(row.id || '')).filter(Boolean);
  const empty = new Map<string, Record<string, unknown>>();
  if (ratingIds.length === 0) return empty;

  const nodeResult = await supabase.from('lc_rating_discussion_nodes')
    .select('*')
    .eq('rating_type', ratingType)
    .in('rating_id', ratingIds)
    .eq('status', 'approved')
    .order('created_at', { ascending: true });
  if (nodeResult.error && !isMissingRelation(nodeResult.error, 'lc_rating_discussion_nodes')) throw nodeResult.error;
  const nodes = nodeResult.error ? [] : (nodeResult.data || []) as Record<string, unknown>[];
  const ratingTargetType = ratingType === 'dm' ? 'dm_rating' : 'store_rating';
  const nodeIds = nodes.map(node => String(node.id || '')).filter(Boolean);
  const voteTargetIds = [...ratingIds, ...nodeIds];
  const voteResult = await supabase.from('lc_rating_reaction_votes')
    .select('target_type, target_id, profile_id, vote_type')
    .in('target_id', voteTargetIds)
    .limit(10000);
  if (voteResult.error && !isMissingRelation(voteResult.error, 'lc_rating_reaction_votes')) throw voteResult.error;
  const votes = voteResult.error ? [] : (voteResult.data || []) as Record<string, unknown>[];
  const votesFor = (targetType: RatingReactionTargetType, targetId: string) => votes.filter(vote => vote.target_type === targetType && vote.target_id === targetId);

  const result = new Map<string, Record<string, unknown>>();
  ratingRows.forEach(row => {
    const ratingId = String(row.id || '');
    const official = nodes.find(node => node.rating_id === ratingId && node.node_type === 'official_response');
    const followup = official
      ? nodes.find(node => node.parent_id === official.id && node.node_type === 'reviewer_followup')
      : null;
    const publicNode = (node: Record<string, unknown> | null | undefined) => node ? {
      id: node.id,
      content: node.content,
      profile_id: node.is_anonymous ? null : node.profile_id,
      profile_name: node.is_anonymous ? '匿名玩家' : node.profile_name,
      created_at: node.created_at,
      reaction: publicRatingReaction(votesFor('discussion_node', String(node.id || '')), profileId),
    } : null;
    result.set(ratingId, {
      reaction: publicRatingReaction(votesFor(ratingTargetType, ratingId), profileId),
      official_response: official ? {
        ...publicNode(official),
        reviewer_followup: publicNode(followup),
      } : null,
    });
  });
  return result;
}

async function findPublicRating(type: RatingDiscussionType, ratingId: string) {
  const source = ratingSource(type);
  const ratingResult = await supabase.from(source.table).select('*').eq('id', ratingId).eq('status', 'approved').maybeSingle();
  if (ratingResult.error) throw ratingResult.error;
  if (!ratingResult.data) return null;
  const dossierId = cleanText(ratingResult.data[source.dossierColumn], 80);
  const dossierResult = await supabase.from('lc_dm_dossiers').select('id, dm_name, entity_type, claim_status, claimed_by, status')
    .eq('id', dossierId).eq('entity_type', source.dossierType).eq('status', 'approved').maybeSingle();
  if (dossierResult.error) throw dossierResult.error;
  if (!dossierResult.data) return null;
  return { rating: ratingResult.data as Record<string, unknown>, dossier: dossierResult.data as Record<string, unknown>, source };
}

async function createRatingDiscussionNode(req: express.Request, res: express.Response, nodeType: 'official_response' | 'reviewer_followup') {
  const ratingType = cleanText(req.params.ratingType, 20) as RatingDiscussionType;
  if (ratingType !== 'dm' && ratingType !== 'store') return res.status(400).json(err(new Error('评价类型不正确')));
  const profile = await getAuthedProfile(req);
  if (!profile) return res.status(401).json(err(new Error('用户不存在')));
  const speakBlock = getSpeakBlockReason(profile);
  if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
  const content = cleanText(req.body?.content, 1000);
  if (content.length < 4) return res.status(400).json(err(new Error('回应至少填写 4 个字')));
  const target = await findPublicRating(ratingType, req.params.ratingId);
  if (!target) return res.status(404).json(err(new Error('评价不存在或尚未公开')));

  let parentId: string | null = null;
  let isAnonymous = false;
  if (nodeType === 'official_response') {
    if (target.dossier.claim_status !== 'approved' || target.dossier.claimed_by !== profile.id) {
      return res.status(403).json(err(new Error(`只有这份${target.source.label}档案的已认证认领人可以回应`)));
    }
  } else {
    if (target.rating.profile_id !== profile.id) return res.status(403).json(err(new Error('只有原评价发布人可以补充回应')));
    const officialResult = await supabase.from('lc_rating_discussion_nodes').select('id')
      .eq('rating_type', ratingType).eq('rating_id', req.params.ratingId)
      .eq('node_type', 'official_response').eq('status', 'approved').maybeSingle();
    if (officialResult.error) throw officialResult.error;
    if (!officialResult.data) return res.status(409).json(err(new Error('对方回应审核通过后才能补充回应')));
    parentId = String(officialResult.data.id);
    isAnonymous = cleanText(target.rating.profile_name, 120) === '匿名玩家';
  }

  const existingQuery = supabase.from('lc_rating_discussion_nodes').select('id, status')
    .eq('rating_type', ratingType).eq('rating_id', req.params.ratingId).eq('node_type', nodeType).neq('status', 'rejected');
  const existingResult = parentId ? await existingQuery.eq('parent_id', parentId).maybeSingle() : await existingQuery.maybeSingle();
  if (existingResult.error) throw existingResult.error;
  if (existingResult.data) return res.status(409).json(err(new Error(existingResult.data.status === 'pending' ? '这条回应正在审核中' : '这条评价已经回应过了')));

  const moderationPrecheck = runLocalModerationPrecheck({
    scene: nodeType === 'official_response' ? 'rating_official_response' : 'rating_reviewer_followup',
    targetType: 'rating_discussion',
    texts: { content },
  });
  const nodeResult = await supabase.from('lc_rating_discussion_nodes').insert({
    rating_type: ratingType,
    rating_id: req.params.ratingId,
    node_type: nodeType,
    parent_id: parentId,
    profile_id: profile.id,
    profile_name: cleanText(profile.display_name, 120) || '用户',
    is_anonymous: isAnonymous,
    content,
    status: 'pending',
    moderation_precheck: moderationPrecheck,
  }).select('*').single();
  if (nodeResult.error) throw nodeResult.error;
  try {
    const review = await createPublicReview({
      targetType: 'rating_discussion_create',
      profile,
      title: `${target.source.label}${nodeType === 'official_response' ? '回应评价' : '评价人补充回应'}：${cleanText(target.dossier.dm_name, 80)}`,
      summary: content,
      payload: {
        node_id: nodeResult.data.id,
        rating_type: ratingType,
        rating_id: req.params.ratingId,
        node_type: nodeType,
        dossier_id: target.dossier.id,
        dossier_name: target.dossier.dm_name,
        content,
      },
      moderationPrecheck,
    });
    return res.status(202).json(ok(publicReviewAcceptedResponse(review)));
  } catch (reviewError) {
    await supabase.from('lc_rating_discussion_nodes').delete().eq('id', nodeResult.data.id);
    throw reviewError;
  }
}

async function loadDmChantoListSummaries(dossierIds: string[]) {
  if (dossierIds.length === 0) return [] as Record<string, unknown>[];
  if (useTencentPg) {
    const result = await tencentPgPool.query(
      `select dm_dossier_id,
              coalesce(sum(amount), 0)::integer as total,
              count(*)::integer as gift_count,
              count(distinct sender_id)::integer as supporter_count
         from lc_dm_gifts
        where status = 'approved' and dm_dossier_id = any($1::uuid[])
        group by dm_dossier_id`,
      [dossierIds],
    );
    return result.rows as Record<string, unknown>[];
  }

  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const result = await supabase.from('lc_dm_gifts')
      .select('dm_dossier_id, sender_id, amount')
      .in('dm_dossier_id', dossierIds)
      .eq('status', 'approved')
      .range(offset, offset + pageSize - 1);
    if (result.error && isMissingRelation(result.error, 'lc_dm_gifts')) return [];
    if (result.error) throw result.error;
    const page = (result.data || []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  const aggregate = new Map<string, { total: number; giftCount: number; supporters: Set<string> }>();
  rows.forEach(row => {
    const dossierId = String(row.dm_dossier_id || '');
    if (!dossierId) return;
    const current = aggregate.get(dossierId) || { total: 0, giftCount: 0, supporters: new Set<string>() };
    current.total += Number(row.amount || 0);
    current.giftCount += 1;
    if (row.sender_id) current.supporters.add(String(row.sender_id));
    aggregate.set(dossierId, current);
  });
  return Array.from(aggregate.entries()).map(([dmDossierId, value]) => ({
    dm_dossier_id: dmDossierId,
    total: value.total,
    gift_count: value.giftCount,
    supporter_count: value.supporters.size,
  }));
}

app.get('/api/lc/dm-dossiers', async (req, res) => {
  try {
    await processDueDossierOwnerReviews();
    const city = cleanText(req.query.city, 80);
    const entityType = cleanText(req.query.entityType ?? req.query.entity_type, 20);
    const q = cleanText(req.query.q, 80);
    let query = supabase
      .from('lc_dm_dossiers')
      .select('*')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (city && city !== 'all') query = query.eq('city', city);
    if (entityType === 'dm' || entityType === 'store') query = query.eq('entity_type', entityType);
    if (q) query = query.ilike('dm_name', `%${q}%`);
    const { data, error } = await query;
    if (error) {
      if (isMissingRelation(error, 'lc_dm_dossiers')) return res.json(ok([]));
      throw error;
    }
    let dossierRows = (data || []) as Record<string, unknown>[];
    if (entityType === 'dm') {
      dossierRows = [...dossierRows].sort((left, right) => {
        const leftHasImage = Boolean(cleanText(left.photo_url, 600) || publicDossierPhotoFiles(left).length);
        const rightHasImage = Boolean(cleanText(right.photo_url, 600) || publicDossierPhotoFiles(right).length);
        return Number(rightHasImage) - Number(leftHasImage);
      });
    }
    dossierRows = dossierRows.slice(0, 120);
    const dossierIds = dossierRows.map(row => String(row.id || '')).filter(Boolean);
    let dmRatingRows: Record<string, unknown>[] = [];
    let storeRatingRows: Record<string, unknown>[] = [];
    let affiliationRows: Record<string, unknown>[] = [];
    let affiliationStores: Record<string, unknown>[] = [];
    let chantoRows: Record<string, unknown>[] = [];
    if (dossierIds.length > 0) {
      const [dmRatingResult, storeRatingResult, affiliationResult, chantoSummaryRows] = await Promise.all([
        supabase.from('lc_dm_ratings')
          .select('id, dm_dossier_id, profile_id, rating, tags')
          .in('dm_dossier_id', dossierIds)
          .eq('status', 'approved')
          .limit(5000),
        supabase.from('lc_store_ratings')
          .select('id, store_dossier_id, profile_id, rating, tags')
          .in('store_dossier_id', dossierIds)
          .eq('status', 'approved')
          .limit(5000),
        supabase.from('lc_dm_store_affiliations')
          .select('id, dm_dossier_id, store_dossier_id, status, requested_by_role, reviewed_at, started_at, created_at, updated_at')
          .in('dm_dossier_id', dossierIds)
          .in('status', ['approved', 'pending', 'legacy_unverified'])
          .order('created_at', { ascending: false })
          .limit(1000),
        entityType === 'dm' ? loadDmChantoListSummaries(dossierIds) : Promise.resolve([]),
      ]);
      if (dmRatingResult.error && !isMissingRelation(dmRatingResult.error, 'lc_dm_ratings')) throw dmRatingResult.error;
      if (storeRatingResult.error && !isMissingRelation(storeRatingResult.error, 'lc_store_ratings')) throw storeRatingResult.error;
      if (affiliationResult.error && !isMissingRelation(affiliationResult.error, 'lc_dm_store_affiliations')) throw affiliationResult.error;
      dmRatingRows = dmRatingResult.error ? [] : (dmRatingResult.data || []) as Record<string, unknown>[];
      storeRatingRows = storeRatingResult.error ? [] : (storeRatingResult.data || []) as Record<string, unknown>[];
      affiliationRows = affiliationResult.error ? [] : (affiliationResult.data || []) as Record<string, unknown>[];
      chantoRows = chantoSummaryRows;
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
    const chantoByDm = new Map(chantoRows.map(row => [String(row.dm_dossier_id || ''), row]));
    const storesById = new Map(affiliationStores.map(store => [String(store.id || ''), store]));
    res.json(ok(dossierRows.map((row: Record<string, unknown>) => {
      const isDm = (row.entity_type || 'dm') === 'dm';
      const affiliation = isDm ? preferredPublicDmAffiliation(affiliationsByDm.get(String(row.id || '')) || []) : null;
      const publicAffiliation = affiliation
        ? publicDmAffiliationPayload(affiliation, storesById.get(String(affiliation.store_dossier_id || '')))
        : null;
      const displayStore = publicAffiliation ? storesById.get(String(publicAffiliation.store_dossier_id || '')) : null;
      const employmentStatus = displayStore ? 'store_affiliated' : row.employment_status === 'freelance' ? 'freelance' : 'unknown';
      const ratingRows = row.entity_type === 'store'
        ? storeRatingsByDossier.get(String(row.id || '')) || []
        : dmRatingsByDossier.get(String(row.id || '')) || [];
      const chanto = chantoByDm.get(String(row.id || ''));
      return {
        id: row.id,
        entity_type: row.entity_type || 'dm',
        dm_name: row.dm_name,
        city: row.city,
        workplace: displayStore?.dm_name || (employmentStatus === 'freelance' ? null : row.workplace),
        employment_status: employmentStatus,
        employer_store_id: displayStore?.id || null,
        affiliation: publicAffiliation,
        profile_url: row.profile_url,
        photo_url: row.photo_url,
        photo_focus_x: normalizeImageFocus(row.photo_focus_x, 50),
        photo_focus_y: normalizeImageFocus(row.photo_focus_y, 25),
        ...publicDossierWikiPayload(row, publicAffiliation),
        note: row.note,
        tags: row.tags || [],
        claim_status: row.claim_status,
        claimed_by: row.claim_status === 'approved' ? row.claimed_by : null,
        created_at: row.created_at,
        rating_summary: summarizeDmRatingRows(ratingRows),
        chanto_summary: {
          total: Number(chanto?.total || 0),
          gift_count: Number(chanto?.gift_count || 0),
          supporter_count: Number(chanto?.supporter_count || 0),
        },
        rating_tags: collectPublicRatingTags(ratingRows),
      };
    })));
  } catch (e) { res.status(500).json(err(e)); }
});

async function loadDmChantoSummary(dmDossierId: string) {
  if (useTencentPg) {
    const [summaryResult, recentResult] = await Promise.all([
      tencentPgPool.query(
        `select coalesce(sum(g.amount), 0)::integer as total,
                count(*)::integer as gift_count,
                count(distinct g.sender_id)::integer as supporter_count
           from lc_dm_gifts g
          where g.dm_dossier_id = $1 and g.status = 'approved'`,
        [dmDossierId],
      ),
      tencentPgPool.query(
        `select g.id, g.amount, g.is_anonymous, g.created_at,
                case when g.is_anonymous then null else p.display_name end as supporter_name
           from lc_dm_gifts g
           left join lc_profiles p on p.id = g.sender_id
          where g.dm_dossier_id = $1 and g.status = 'approved'
          order by g.created_at desc
          limit 10`,
        [dmDossierId],
      ),
    ]);
    return {
      total: Number(summaryResult.rows[0]?.total || 0),
      gift_count: Number(summaryResult.rows[0]?.gift_count || 0),
      supporter_count: Number(summaryResult.rows[0]?.supporter_count || 0),
      recent: recentResult.rows.map(row => ({
        id: row.id,
        amount: Number(row.amount || 0),
        supporter_name: row.supporter_name || '匿名支持者',
        created_at: row.created_at,
      })),
    };
  }

  const giftResult = await supabase.from('lc_dm_gifts')
    .select('id, sender_id, amount, is_anonymous, created_at')
    .eq('dm_dossier_id', dmDossierId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(500);
  if (giftResult.error && isMissingRelation(giftResult.error, 'lc_dm_gifts')) {
    return { total: 0, gift_count: 0, supporter_count: 0, recent: [] };
  }
  if (giftResult.error) throw giftResult.error;
  const gifts = (giftResult.data || []) as Record<string, unknown>[];
  const senderIds = Array.from(new Set(gifts.filter(gift => !gift.is_anonymous).map(gift => cleanText(gift.sender_id, 80)).filter(Boolean)));
  const profileResult = senderIds.length > 0
    ? await supabase.from('lc_profiles').select('id, display_name').in('id', senderIds)
    : { data: [], error: null };
  if (profileResult.error) throw profileResult.error;
  const nameById = new Map(((profileResult.data || []) as Record<string, unknown>[]).map(profile => [String(profile.id), cleanText(profile.display_name, 80)]));
  return {
    total: gifts.reduce((sum, gift) => sum + Number(gift.amount || 0), 0),
    gift_count: gifts.length,
    supporter_count: new Set(gifts.map(gift => String(gift.sender_id))).size,
    recent: gifts.slice(0, 10).map(gift => ({
      id: gift.id,
      amount: Number(gift.amount || 0),
      supporter_name: gift.is_anonymous ? '匿名支持者' : nameById.get(String(gift.sender_id)) || '用户',
      created_at: gift.created_at,
    })),
  };
}

app.get('/api/lc/dm-dossiers/:id', async (req, res) => {
  try {
    await processDueDossierOwnerReviews();
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
    const ratingDiscussions = await loadRatingDiscussionPayload('dm', rows, await getOptionalCreatorId(req));
    const rankingResult = await supabase.from('lc_rankings')
      .select('*')
      .eq('subject_dossier_id', req.params.id)
      .eq('status', 'approved')
      .order('last_activity_at', { ascending: false, nullsFirst: false })
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
    const displayStore = publicAffiliation ? affiliationStore : null;
    const employmentStatus = displayStore ? 'store_affiliated' : dossier.employment_status === 'freelance' ? 'freelance' : 'unknown';
    const chantoSummary = await loadDmChantoSummary(req.params.id);
    res.json(ok({
      dossier: {
        id: dossier.id,
        dm_name: dossier.dm_name,
        city: dossier.city,
        workplace: displayStore?.dm_name || (employmentStatus === 'freelance' ? null : dossier.workplace),
        employment_status: employmentStatus,
        employer_store_id: displayStore?.id || null,
        affiliation: publicAffiliation,
        profile_url: dossier.profile_url,
        photo_url: dossier.photo_url,
        photo_focus_x: normalizeImageFocus(dossier.photo_focus_x, 50),
        photo_focus_y: normalizeImageFocus(dossier.photo_focus_y, 25),
        ...publicDossierWikiPayload(dossier, publicAffiliation),
        note: dossier.note,
        tags: dossier.tags || [],
        claim_status: dossier.claim_status,
        claimed_by: dossier.claim_status === 'approved' ? dossier.claimed_by : null,
      },
      summary: summarizeDmRatingRows(rows),
      reputation_summary: buildReputationSummary(rankingRows),
      reputation_events: rankingRows.map(publicRankingPayload),
      chanto_summary: chantoSummary,
      ratings: rows.map(row => ({
        id: row.id,
        profile_id: row.profile_id || null,
        profile_name: row.profile_name || '匿名玩家',
        script_id: row.script_id,
        script_name: row.script_name,
        store_id: row.store_id,
        store_dossier_id: row.store_dossier_id,
        store_name: row.store_name,
        played_on: row.played_on,
        replay_number: row.replay_number,
        rating: row.rating,
        content: row.content,
        tags: row.tags || [],
        created_at: row.created_at,
        ...(ratingDiscussions.get(String(row.id || '')) || {}),
      })),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/dm-dossiers/:id/gifts', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));

    const amount = parseCoinAmount(req.body?.amount, 0);
    const message = cleanText(req.body?.message, 200);
    const ratingId = cleanText(req.body?.ratingId ?? req.body?.rating_id, 80) || null;
    const requestKey = cleanText(req.body?.requestKey ?? req.body?.request_key, 100);
    if (!isValidChantoAmount(amount)) {
      return res.status(400).json(err(new Error(`单次缠头须为 ${CHANTO_MIN_AMOUNT}-${CHANTO_MAX_AMOUNT} 榜金`)));
    }
    if (!requestKey) return res.status(400).json(err(new Error('缺少请求标识，请刷新后重试')));

    const { data, error: giftErr } = await supabase.rpc('lc_send_dm_gift', {
      p_sender_id: profile.id,
      p_dm_dossier_id: req.params.id,
      p_amount: amount,
      p_message: message || null,
      p_is_anonymous: !!req.body?.isAnonymous,
      p_rating_id: ratingId,
      p_idempotency_key: requestKey,
    });
    if (giftErr) {
      const messageText = giftErr.message || '缠头发送失败';
      const status = /不足/.test(messageText) ? 402 : /上限/.test(messageText) ? 429 : 400;
      return res.status(status).json(err(new Error(messageText)));
    }
    const result = firstRpcRow<DmGiftRpcResult>(data);
    if (!result) throw new Error('缠头入账结果为空');

    await logSecurityEvent(req, {
      action: result.applied ? 'dm_gift_sent' : 'dm_gift_duplicate_request',
      targetType: 'dm_dossier',
      targetId: req.params.id,
      metadata: {
        gift_id: result.gift_id,
        amount: result.gross_amount,
        platform_fee: result.platform_fee,
        receiver_amount: result.receiver_amount,
        rating_id: ratingId,
        anonymous: !!req.body?.isAnonymous,
      },
    });
    res.json(ok(result));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/dm-gifts/leaderboard', async (req, res) => {
  try {
    const city = cleanText(req.query.city, 80);
    const period = cleanText(req.query.period, 20) === 'all' ? 'all' : 'month';
    const limit = Math.min(100, Math.max(1, parseCoinAmount(req.query.limit, 50)));

    if (useTencentPg) {
      const values: unknown[] = [];
      const conditions = [`g.status = 'approved'`, `d.entity_type = 'dm'`, `d.status = 'approved'`, `d.claim_status = 'approved'`];
      if (city) {
        values.push(city);
        conditions.push(`d.city = $${values.length}`);
      }
      if (period === 'month') {
        conditions.push(`g.created_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai')`);
      }
      values.push(limit);
      const result = await tencentPgPool.query(
        `select d.id, d.dm_name, d.city, d.workplace, d.photo_url, d.photo_focus_x, d.photo_focus_y,
                sum(g.amount)::integer as chanto_total,
                count(*)::integer as gift_count,
                count(distinct g.sender_id)::integer as supporter_count
           from lc_dm_gifts g
           join lc_dm_dossiers d on d.id = g.dm_dossier_id
          where ${conditions.join(' and ')}
          group by d.id, d.dm_name, d.city, d.workplace, d.photo_url, d.photo_focus_x, d.photo_focus_y
          order by chanto_total desc, supporter_count desc, d.dm_name asc
          limit $${values.length}`,
        values,
      );
      return res.json(ok({
        period,
        city: city || null,
        items: result.rows.map((row, index) => ({
          rank: index + 1,
          id: row.id,
          dm_name: row.dm_name,
          city: row.city,
          workplace: row.workplace,
          photo_url: row.photo_url,
          photo_focus_x: normalizeImageFocus(row.photo_focus_x, 50),
          photo_focus_y: normalizeImageFocus(row.photo_focus_y, 25),
          chanto_total: Number(row.chanto_total || 0),
          gift_count: Number(row.gift_count || 0),
          supporter_count: Number(row.supporter_count || 0),
        })),
      }));
    }

    let giftQuery = supabase.from('lc_dm_gifts')
      .select('dm_dossier_id, sender_id, amount, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (period === 'month') {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      giftQuery = giftQuery.gte('created_at', start);
    }
    const giftResult = await giftQuery;
    if (giftResult.error && isMissingRelation(giftResult.error, 'lc_dm_gifts')) return res.json(ok({ period, city: city || null, items: [] }));
    if (giftResult.error) throw giftResult.error;
    const gifts = (giftResult.data || []) as Record<string, unknown>[];
    const dossierIds = Array.from(new Set(gifts.map(gift => cleanText(gift.dm_dossier_id, 80)).filter(Boolean)));
    if (dossierIds.length === 0) return res.json(ok({ period, city: city || null, items: [] }));
    let dossierQuery = supabase.from('lc_dm_dossiers')
      .select('id, dm_name, city, workplace, photo_url, photo_focus_x, photo_focus_y')
      .in('id', dossierIds)
      .eq('entity_type', 'dm')
      .eq('status', 'approved')
      .eq('claim_status', 'approved');
    if (city) dossierQuery = dossierQuery.eq('city', city);
    const dossierResult = await dossierQuery;
    if (dossierResult.error) throw dossierResult.error;
    const dossierById = new Map(((dossierResult.data || []) as Record<string, unknown>[]).map(dossier => [String(dossier.id), dossier]));
    const aggregate = new Map<string, { total: number; count: number; supporters: Set<string> }>();
    for (const gift of gifts) {
      const dossierId = String(gift.dm_dossier_id || '');
      if (!dossierById.has(dossierId)) continue;
      const current = aggregate.get(dossierId) || { total: 0, count: 0, supporters: new Set<string>() };
      current.total += Number(gift.amount || 0);
      current.count += 1;
      current.supporters.add(String(gift.sender_id || ''));
      aggregate.set(dossierId, current);
    }
    const items = Array.from(aggregate.entries())
      .map(([dossierId, value]) => ({ dossier: dossierById.get(dossierId) || {}, value }))
      .sort((a, b) => b.value.total - a.value.total || b.value.supporters.size - a.value.supporters.size)
      .slice(0, limit)
      .map(({ dossier, value }, index) => ({
        rank: index + 1,
        ...dossier,
        photo_focus_x: normalizeImageFocus(dossier.photo_focus_x, 50),
        photo_focus_y: normalizeImageFocus(dossier.photo_focus_y, 25),
        chanto_total: value.total,
        gift_count: value.count,
        supporter_count: value.supporters.size,
      }));
    res.json(ok({ period, city: city || null, items }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/store-dossiers/:id', async (req, res) => {
  try {
    await processDueDossierOwnerReviews();
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
    const ratingDiscussions = await loadRatingDiscussionPayload('store', rows, await getOptionalCreatorId(req));
    const rankingResult = await supabase.from('lc_rankings')
      .select('*')
      .eq('subject_dossier_id', req.params.id)
      .eq('subject_type', 'store')
      .eq('status', 'approved')
      .order('last_activity_at', { ascending: false, nullsFirst: false })
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
        photo_focus_x: normalizeImageFocus(dossier.photo_focus_x, 50),
        photo_focus_y: normalizeImageFocus(dossier.photo_focus_y, 25),
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
        profile_id: row.profile_id || null,
        profile_name: row.profile_name || '匿名玩家',
        script_id: row.script_id,
        script_name: row.script_name,
        visited_on: row.visited_on,
        rating: row.rating,
        content: row.content,
        tags: row.tags || [],
        created_at: row.created_at,
        ...(ratingDiscussions.get(String(row.id || '')) || {}),
      })),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rating-discussions/:ratingType/:ratingId/official-response', authMiddleware, async (req, res) => {
  try {
    await createRatingDiscussionNode(req, res, 'official_response');
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rating-discussions/:ratingType/:ratingId/follow-up', authMiddleware, async (req, res) => {
  try {
    await createRatingDiscussionNode(req, res, 'reviewer_followup');
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/rating-reactions/:targetType/:targetId', authMiddleware, async (req, res) => {
  try {
    const targetType = cleanText(req.params.targetType, 30) as RatingReactionTargetType;
    const targetId = cleanText(req.params.targetId, 80);
    const voteType = cleanText(req.body?.voteType ?? req.body?.vote_type, 20);
    if (!['dm_rating', 'store_rating', 'discussion_node'].includes(targetType)) {
      return res.status(400).json(err(new Error('赞踩对象不正确')));
    }
    if (voteType !== 'like' && voteType !== 'dislike') return res.status(400).json(err(new Error('请选择赞或踩')));
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));

    if (targetType === 'discussion_node') {
      const nodeResult = await supabase.from('lc_rating_discussion_nodes').select('id, rating_type, rating_id')
        .eq('id', targetId).eq('status', 'approved').maybeSingle();
      if (nodeResult.error) throw nodeResult.error;
      if (!nodeResult.data || !await findPublicRating(nodeResult.data.rating_type as RatingDiscussionType, String(nodeResult.data.rating_id))) {
        return res.status(404).json(err(new Error('回应不存在或尚未公开')));
      }
    } else {
      const ratingType: RatingDiscussionType = targetType === 'dm_rating' ? 'dm' : 'store';
      if (!await findPublicRating(ratingType, targetId)) return res.status(404).json(err(new Error('评价不存在或尚未公开')));
    }

    const existingResult = await supabase.from('lc_rating_reaction_votes').select('id, vote_type')
      .eq('target_type', targetType).eq('target_id', targetId).eq('profile_id', profile.id).maybeSingle();
    if (existingResult.error) throw existingResult.error;
    let myVote: string | null = voteType;
    if (existingResult.data?.vote_type === voteType) {
      const deleteResult = await supabase.from('lc_rating_reaction_votes').delete().eq('id', existingResult.data.id);
      if (deleteResult.error) throw deleteResult.error;
      myVote = null;
    } else {
      const upsertResult = await supabase.from('lc_rating_reaction_votes').upsert({
        target_type: targetType,
        target_id: targetId,
        profile_id: profile.id,
        vote_type: voteType,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'target_type,target_id,profile_id' });
      if (upsertResult.error) throw upsertResult.error;
    }
    const aggregateResult = await supabase.from('lc_rating_reaction_votes').select('profile_id, vote_type')
      .eq('target_type', targetType).eq('target_id', targetId).limit(10000);
    if (aggregateResult.error) throw aggregateResult.error;
    res.json(ok({ ...publicRatingReaction((aggregateResult.data || []) as Record<string, unknown>[], profile.id), my_vote: myVote }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post(
  '/api/lc/dm-dossiers',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'dossier_submit',
    targetType: 'dm_dossier',
    content: req => [
      req.body?.dmName,
      req.body?.dm_name,
      req.body?.name,
      req.body?.city,
      req.body?.workplace,
      req.body?.note,
      req.body?.tags,
    ],
  }),
  async (req, res) => {
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
    const rawPhotoUrl = req.body?.photoUrl ?? req.body?.photo_url;
    const photoFiles = normalizeDossierPhotoSubmission(req.body?.photoFiles ?? req.body?.photo_files, rawPhotoUrl, entityLabel);
    const photoUrl = photoFiles[0]?.url || '';
    const photoFocusX = normalizeImageFocus(req.body?.photoFocusX ?? req.body?.photo_focus_x, 50);
    const photoFocusY = normalizeImageFocus(req.body?.photoFocusY ?? req.body?.photo_focus_y, 25);
    const employment = entityType === 'dm'
      ? await resolveDmEmployment(req.body as Record<string, unknown>, requestedWorkplace)
      : { employment_status: 'unknown', employer_store_id: null, workplace: requestedWorkplace || null };
    const workplace = cleanText(employment.workplace, 160);

    if (!dmName) return res.status(400).json(err(new Error(`请填写${entityLabel}名称`)));
    if (!city) return res.status(400).json(err(new Error('请选择城市')));
    if (entityType === 'store' && !workplace) return res.status(400).json(err(new Error('请填写店家地址、商圈或常驻位置')));
    if (!isOptionalUrlPlaceholder(rawProfileUrl) && !profileUrl) return res.status(400).json(err(new Error('个人主页链接格式不正确，不填写时请直接留空')));
    if (!isOptionalUrlPlaceholder(rawPhotoUrl) && !photoUrl) return res.status(400).json(err(new Error('照片链接格式不正确，也可以直接使用上传按钮')));

    await ensureWechatMiniImageSafetyChecks(req, {
      urls: photoFiles.map(file => file.url),
      businessScene: entityType === 'store' ? 'store_dossier_image_submit' : 'dm_dossier_image_submit',
      targetType: 'dm_dossier',
    });
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
      photo_focus_x: photoFocusX,
      photo_focus_y: photoFocusY,
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
  },
);

function hasOwnInput(input: Record<string, unknown>, ...keys: string[]) {
  return keys.some(key => Object.prototype.hasOwnProperty.call(input, key));
}

function optionalDossierInteger(value: unknown, min: number, max: number, label: string) {
  return normalizeDossierIntegerInput(value, min, max, label);
}

function optionalStoredDossierInteger(value: unknown, min: number, max: number, label: string) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${label}格式不正确`);
  return parsed;
}

function optionalDossierMonth(value: unknown, label: string) {
  if (value === null || value === undefined || value === '') return null;
  const month = normalizeDossierMonth(value);
  if (!month) throw new Error(`${label}格式不正确`);
  return `${month}-01`;
}

function normalizeDossierPhotoSubmission(input: unknown, fallbackUrl: unknown, entityLabel: string) {
  const rawRows = Array.isArray(input) ? input : [];
  const rows = rawRows.slice(0, MAX_DOSSIER_PHOTOS).map((item, index) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const rawUrl = row.url;
    const url = normalizeOptionalPublicUrl(rawUrl, 800, true);
    if (!isOptionalUrlPlaceholder(rawUrl) && !url) throw new Error(`第${index + 1}张照片链接格式不正确`);
    return {
      url,
      name: cleanText(row.name, 120) || `${entityLabel}照片 ${index + 1}`,
      type: cleanText(row.type, 80) || 'image/*',
      caption: cleanText(row.caption, 160) || null,
      focus_x: normalizeImageFocus(row.focus_x ?? row.focusX, 50),
      focus_y: normalizeImageFocus(row.focus_y ?? row.focusY, 25),
    };
  }).filter(row => row.url);
  const fallback = normalizeOptionalPublicUrl(fallbackUrl, 800, true);
  return normalizeDossierPhotos(rows, fallback);
}

async function canonicalDossierProfileRefs(input: unknown) {
  const refs = normalizeDossierNamedRefs(input);
  if (refs.length === 0) return [];
  const profileRefs = refs.filter(ref => ref.type !== 'dm');
  const dmRefs = refs.filter(ref => ref.type === 'dm');
  const [profileResult, dmResult] = await Promise.all([
    profileRefs.length > 0
      ? supabase.from('lc_profiles').select('id, display_name').in('id', profileRefs.map(ref => ref.id)).eq('is_visible', true)
      : Promise.resolve({ data: [], error: null }),
    dmRefs.length > 0
      ? supabase.from('lc_dm_dossiers').select('id, dm_name').in('id', dmRefs.map(ref => ref.id)).eq('entity_type', 'dm').eq('status', 'approved')
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (dmResult.error) throw dmResult.error;
  const profiles = new Map((profileResult.data || []).map(row => [String(row.id || ''), cleanText(row.display_name, 100)]));
  const dms = new Map((dmResult.data || []).map(row => [String(row.id || ''), cleanText(row.dm_name, 100)]));
  const invalid = refs.find(ref => ref.type === 'dm' ? !dms.has(ref.id) : !profiles.has(ref.id));
  if (invalid) throw new Error(`引用对象“${invalid.name}”不存在或未公开`);
  return refs.map(ref => ref.type === 'dm'
    ? { id: ref.id, name: dms.get(ref.id) || ref.name, type: 'dm' as const }
    : { id: ref.id, name: profiles.get(ref.id) || ref.name, type: 'profile' as const });
}

async function canonicalDossierStoreData(relatedInput: unknown, careerInput: unknown) {
  const related = normalizeDossierNamedRefs(relatedInput);
  const career = normalizeDossierCareerHistory(careerInput);
  const ids = Array.from(new Set([
    ...related.map(ref => ref.id),
    ...career.map(entry => cleanText(entry.store_dossier_id, 120)).filter(Boolean),
  ]));
  if (ids.length === 0) return { related, career };
  const result = await supabase.from('lc_dm_dossiers')
    .select('id, dm_name')
    .in('id', ids)
    .eq('entity_type', 'store')
    .eq('status', 'approved');
  if (result.error) throw result.error;
  const stores = new Map((result.data || []).map(row => [String(row.id || ''), cleanText(row.dm_name, 100)]));
  const invalidRelated = related.find(ref => !stores.has(ref.id));
  if (invalidRelated) throw new Error(`圈选店家“${invalidRelated.name}”不存在或未公开`);
  const invalidCareer = career.find(entry => entry.store_dossier_id && !stores.has(String(entry.store_dossier_id)));
  if (invalidCareer) throw new Error(`任职店家“${invalidCareer.store_name}”不存在或未公开`);
  return {
    related: related.map(ref => ({ id: ref.id, name: stores.get(ref.id) || ref.name, type: 'store' as const })),
    career: career.map(entry => ({
      ...entry,
      store_name: entry.store_dossier_id ? stores.get(String(entry.store_dossier_id)) || entry.store_name : entry.store_name,
    })),
  };
}

async function canonicalDossierScripts(input: unknown) {
  const refs = normalizeDossierNamedRefs(input, MAX_DOSSIER_COMMON_SCRIPTS);
  if (refs.length === 0) return [];
  const catalog = await loadSharedScriptCatalog();
  return refs.map(ref => {
    const script = findSharedScript(catalog, ref.id, ref.name);
    if (!script) throw new Error(`常开剧本“${ref.name}”不在共用剧本库中`);
    return { id: String(script.id), name: cleanText(script.name, 100) };
  });
}

function dossierEditSnapshot(dossier: Record<string, unknown>) {
  return {
    dm_name: cleanText(dossier.dm_name, 80),
    city: cleanText(dossier.city, 80),
    workplace: cleanText(dossier.workplace, 160) || null,
    employment_status: cleanText(dossier.employment_status, 40) || 'unknown',
    employer_store_id: cleanText(dossier.employer_store_id, 80) || null,
    profile_url: cleanText(dossier.profile_url, 600) || null,
    photo_url: cleanText(dossier.photo_url, 800) || null,
    photo_files: normalizeDossierPhotos(dossier.photo_files, dossier.photo_url),
    note: cleanText(dossier.note, 600) || null,
    tags: cleanTextArray(dossier.tags, 10, 18),
    dm_started_month: optionalDossierMonth(dossier.dm_started_month, 'DM 入行时间'),
    birth_year: optionalStoredDossierInteger(dossier.birth_year, 1900, 2100, '出生年份'),
    height_cm: optionalStoredDossierInteger(dossier.height_cm, 100, 250, '身高'),
    weight_kg: optionalStoredDossierInteger(dossier.weight_kg, 30, 300, '体重'),
    mbti: normalizeDmPersonalityValue(dossier.mbti, DM_MBTI_VALUES, 'MBTI'),
    zodiac: normalizeDmPersonalityValue(dossier.zodiac, DM_ZODIAC_VALUES, '星座'),
    bio: cleanText(dossier.bio, 3000) || null,
    common_scripts: normalizeDossierNamedRefs(dossier.common_scripts, MAX_DOSSIER_COMMON_SCRIPTS),
    career_history: normalizeDossierCareerHistory(dossier.career_history),
    related_profiles: normalizeDossierNamedRefs(dossier.related_profiles),
    related_stores: normalizeDossierNamedRefs(dossier.related_stores),
  };
}

async function normalizeDossierEditProposal(dossier: Record<string, unknown>, body: Record<string, unknown>) {
  const entityType = dossier.entity_type === 'store' ? 'store' : 'dm';
  const entityLabel = entityType === 'store' ? '店家' : 'DM';
  const rawProfileUrl = hasOwnInput(body, 'profileUrl', 'profile_url')
    ? body.profileUrl ?? body.profile_url
    : dossier.profile_url;
  const profileUrl = normalizeOptionalPublicUrl(rawProfileUrl, 600);
  if (!isOptionalUrlPlaceholder(rawProfileUrl) && !profileUrl) throw new Error('主页链接格式不正确，不填写时请直接留空');
  const existingPhotos = normalizeDossierPhotos(dossier.photo_files, dossier.photo_url);
  const rawPhotoUrl = body.photoUrl ?? body.photo_url;
  const hasPhotoFiles = hasOwnInput(body, 'photoFiles', 'photo_files');
  let photoFiles = hasPhotoFiles
    ? normalizeDossierPhotoSubmission(body.photoFiles ?? body.photo_files, rawPhotoUrl, entityLabel)
    : existingPhotos;
  if (!hasPhotoFiles && hasOwnInput(body, 'photoUrl', 'photo_url')) {
    const coverUrl = normalizeOptionalPublicUrl(rawPhotoUrl, 800, true);
    if (!isOptionalUrlPlaceholder(rawPhotoUrl) && !coverUrl) throw new Error('照片链接格式不正确，也可以直接使用上传按钮');
    photoFiles = coverUrl
      ? normalizeDossierPhotos([
        { ...(existingPhotos.find(photo => photo.url === coverUrl) || {}), url: coverUrl },
        ...existingPhotos.filter(photo => photo.url !== coverUrl),
      ])
      : [];
  }
  const photoUrl = photoFiles[0]?.url || null;

  const proposed: Record<string, unknown> = {
    dm_name: hasOwnInput(body, 'dmName', 'dm_name', 'name')
      ? cleanText(body.dmName ?? body.dm_name ?? body.name, 80)
      : cleanText(dossier.dm_name, 80),
    city: hasOwnInput(body, 'city') ? cleanText(body.city, 80) : cleanText(dossier.city, 80),
    profile_url: profileUrl || null,
    photo_url: photoUrl,
    photo_files: photoFiles,
    note: hasOwnInput(body, 'note') ? cleanText(body.note, 600) || null : cleanText(dossier.note, 600) || null,
    tags: hasOwnInput(body, 'tags') ? cleanTextArray(body.tags, 10, 18) : cleanTextArray(dossier.tags, 10, 18),
  };
  if (!proposed.dm_name) throw new Error(`请填写${entityLabel}名称`);
  if (!proposed.city) throw new Error('请选择城市');
  const currentCity = cleanText(dossier.city, 80);
  if (proposed.city !== currentCity && !DOSSIER_CITY_VALUES.has(String(proposed.city))) {
    throw new Error('城市必须从固定城市列表中选择');
  }

  if (entityType === 'store') {
    const workplace = hasOwnInput(body, 'workplace', 'address')
      ? cleanText(body.workplace ?? body.address, 160)
      : cleanText(dossier.workplace, 160);
    if (!workplace) throw new Error('请填写店家地址、商圈或常驻位置');
    proposed.workplace = workplace;
  } else {
    const hasEmploymentInput = hasOwnInput(body, 'employmentStatus', 'employment_status', 'employerStoreId', 'employer_store_id', 'workplace');
    const requestedStatus = cleanText(body.employmentStatus ?? body.employment_status, 40);
    const employment = !hasEmploymentInput
      ? {
          employment_status: cleanText(dossier.employment_status, 40) || 'unknown',
          employer_store_id: cleanText(dossier.employer_store_id, 80) || null,
          workplace: cleanText(dossier.workplace, 160) || null,
        }
      : requestedStatus === 'unknown'
        ? { employment_status: 'unknown', employer_store_id: null, workplace: cleanText(body.workplace, 160) || null }
        : await resolveDmEmployment(body, cleanText(dossier.workplace, 160));
    proposed.workplace = employment.workplace || null;
    proposed.employment_status = employment.employment_status;
    proposed.employer_store_id = employment.employer_store_id || null;
    const relatedStoreInput = hasOwnInput(body, 'relatedStores', 'related_stores')
      ? body.relatedStores ?? body.related_stores
      : dossier.related_stores;
    const careerInput = hasOwnInput(body, 'careerHistory', 'career_history')
      ? body.careerHistory ?? body.career_history
      : dossier.career_history;
    const storeData = await canonicalDossierStoreData(relatedStoreInput, careerInput);
    proposed.dm_started_month = hasOwnInput(body, 'dmStartedMonth', 'dm_started_month')
      ? optionalDossierMonth(body.dmStartedMonth ?? body.dm_started_month, 'DM 入行时间')
      : optionalDossierMonth(dossier.dm_started_month, 'DM 入行时间');
    proposed.birth_year = hasOwnInput(body, 'birthYear', 'birth_year')
      ? optionalDossierInteger(body.birthYear ?? body.birth_year, 1900, new Date().getFullYear(), '出生年份')
      : optionalStoredDossierInteger(dossier.birth_year, 1900, 2100, '出生年份');
    proposed.height_cm = hasOwnInput(body, 'heightCm', 'height_cm')
      ? optionalDossierInteger(body.heightCm ?? body.height_cm, 100, 250, '身高')
      : optionalStoredDossierInteger(dossier.height_cm, 100, 250, '身高');
    proposed.weight_kg = hasOwnInput(body, 'weightKg', 'weight_kg')
      ? optionalDossierInteger(body.weightKg ?? body.weight_kg, 30, 300, '体重')
      : optionalStoredDossierInteger(dossier.weight_kg, 30, 300, '体重');
    proposed.mbti = hasOwnInput(body, 'mbti')
      ? normalizeDmPersonalityValue(body.mbti, DM_MBTI_VALUES, 'MBTI')
      : normalizeDmPersonalityValue(dossier.mbti, DM_MBTI_VALUES, 'MBTI');
    proposed.zodiac = hasOwnInput(body, 'zodiac')
      ? normalizeDmPersonalityValue(body.zodiac, DM_ZODIAC_VALUES, '星座')
      : normalizeDmPersonalityValue(dossier.zodiac, DM_ZODIAC_VALUES, '星座');
    proposed.bio = hasOwnInput(body, 'bio') ? cleanText(body.bio, 3000) || null : cleanText(dossier.bio, 3000) || null;
    proposed.common_scripts = hasOwnInput(body, 'commonScripts', 'common_scripts')
      ? await canonicalDossierScripts(body.commonScripts ?? body.common_scripts)
      : normalizeDossierNamedRefs(dossier.common_scripts, MAX_DOSSIER_COMMON_SCRIPTS);
    proposed.career_history = storeData.career;
    proposed.related_profiles = hasOwnInput(body, 'relatedProfiles', 'related_profiles')
      ? await canonicalDossierProfileRefs(body.relatedProfiles ?? body.related_profiles)
      : normalizeDossierNamedRefs(dossier.related_profiles);
    proposed.related_stores = storeData.related;
  }

  const beforeSnapshot = dossierEditSnapshot(dossier);
  const patch: Record<string, unknown> = {};
  const changedFields: string[] = [];
  for (const [field, value] of Object.entries(proposed)) {
    if (dossierEditComparableValue(field, beforeSnapshot[field as keyof typeof beforeSnapshot]) === dossierEditComparableValue(field, value)) continue;
    patch[field] = value;
    changedFields.push(field);
  }
  if (changedFields.length === 0) throw new Error('资料没有发生变化');
  return { entityType, entityLabel, beforeSnapshot, patch, changedFields };
}

function publicDossierEditReview(review: Record<string, unknown>) {
  const payload = objectPayload(review.payload);
  return {
    id: review.id,
    dossier_id: payload.dossier_id,
    entity_type: payload.entity_type,
    dossier_name: payload.dossier_name,
    changed_fields: Array.isArray(payload.changed_fields) ? payload.changed_fields : [],
    sensitive_fields: Array.isArray(payload.sensitive_fields) ? payload.sensitive_fields : [],
    owner_confirmation_fields: Array.isArray(payload.owner_confirmation_fields) ? payload.owner_confirmation_fields : [],
    omitted_sensitive_fields: Array.isArray(payload.omitted_sensitive_fields) ? payload.omitted_sensitive_fields : [],
    patch: objectPayload(payload.patch),
    before_snapshot: objectPayload(payload.before_snapshot),
    edit_reason: payload.edit_reason,
    submitter_name: review.profile_name || '用户',
    review_mode: cleanText(payload.review_mode, 30) || 'admin',
    owner_login_detected: Boolean(payload.owner_login_detected),
    owner_response_status: effectiveDossierOwnerResponseStatus({
      status: cleanText(payload.owner_response_status, 40),
      dueAt: cleanText(payload.owner_response_due_at, 80),
    }),
    owner_response_due_at: payload.owner_response_due_at || null,
    owner_response_reason: payload.owner_response_reason || null,
    created_at: review.created_at,
  };
}

async function createCommunityDmAffiliation(input: {
  dossier: Record<string, unknown>;
  storeDossierId: string;
  profile: AuthedProfile;
  note: string;
}) {
  const storeResult = await supabase.from('lc_dm_dossiers')
    .select('id, dm_name, city')
    .eq('id', input.storeDossierId)
    .eq('entity_type', 'store')
    .eq('status', 'approved')
    .maybeSingle();
  if (storeResult.error) throw storeResult.error;
  if (!storeResult.data) throw new Error('选择的店家不存在或尚未公开');
  const existingResult = await supabase.from('lc_dm_store_affiliations')
    .select('*')
    .eq('dm_dossier_id', input.dossier.id)
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: false });
  if (existingResult.error && !isMissingRelation(existingResult.error, 'lc_dm_store_affiliations')) throw existingResult.error;
  const active = ((existingResult.data || []) as Record<string, unknown>[])[0];
  if (active) {
    if (String(active.store_dossier_id || '') === input.storeDossierId) return active;
    throw new Error('这份档案已经关联其他店家；如信息不实，请在公开页发起异议并提交证据');
  }
  const insertResult = await supabase.from('lc_dm_store_affiliations').insert({
    dm_dossier_id: input.dossier.id,
    store_dossier_id: input.storeDossierId,
    dm_profile_id: null,
    requested_by_profile_id: input.profile.id,
    requested_by_role: 'community',
    request_kind: 'join',
    request_note: input.note || '社区用户补充任职信息',
    status: 'pending',
  }).select('*').single();
  if (insertResult.error) throw insertResult.error;
  return insertResult.data as Record<string, unknown>;
}

app.post('/api/lc/dossier-edits/:dossierId', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const editReason = cleanText(req.body?.editReason ?? req.body?.edit_reason, 600);
    if (editReason.length < 6) return res.status(400).json(err(new Error('请至少写6个字说明修改依据')));

    const { data: dossier, error: dossierErr } = await supabase.from('lc_dm_dossiers')
      .select('*')
      .eq('id', req.params.dossierId)
      .eq('status', 'approved')
      .maybeSingle();
    if (dossierErr && isMissingRelation(dossierErr, 'lc_dm_dossiers')) return res.status(503).json(err(new Error('档案表尚未初始化')));
    if (dossierErr) throw dossierErr;
    if (!dossier) return res.status(404).json(err(new Error('档案不存在或尚未公开')));

    const existingResult = await supabase.from('lc_public_reviews')
      .select('id, payload, created_at')
      .eq('target_type', 'dossier_update')
      .eq('profile_id', profile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);
    if (existingResult.error && !isMissingRelation(existingResult.error, 'lc_public_reviews')) throw existingResult.error;
    const existingReview = (existingResult.data || []).find((item: Record<string, unknown>) => cleanText(objectPayload(item.payload).dossier_id, 80) === dossier.id) as Record<string, unknown> | undefined;

    const normalized = await normalizeDossierEditProposal(dossier as Record<string, unknown>, req.body as Record<string, unknown>);
    const ownerProfileId = dossier.claim_status === 'approved' ? cleanText(dossier.claimed_by, 80) : '';
    if (ownerProfileId !== profile.id) {
      const lockedFields = new Set(dossierOwnerLockedFields(dossier.field_provenance));
      const blockedFields = normalized.changedFields.filter(field => lockedFields.has(field));
      if (blockedFields.length > 0) {
        return res.status(409).json(err(new Error(`以下资料由 DM 本人提供，其他用户不能修改：${blockedFields.map(field => DOSSIER_EDIT_FIELD_LABELS[field] || field).join('、')}`)));
      }
    }
    let communityAffiliation: Record<string, unknown> | null = null;
    if (!ownerProfileId && normalized.entityType === 'dm' && normalized.patch.employment_status === 'store_affiliated') {
      const storeDossierId = cleanText(normalized.patch.employer_store_id, 80);
      if (storeDossierId) {
        communityAffiliation = await createCommunityDmAffiliation({
          dossier: dossier as Record<string, unknown>,
          storeDossierId,
          profile,
          note: editReason,
        });
        for (const field of DM_AFFILIATION_EDIT_FIELDS) delete normalized.patch[field];
        normalized.changedFields = normalized.changedFields.filter(field => !DM_AFFILIATION_EDIT_FIELDS.has(field));
      }
    }
    if (normalized.changedFields.length === 0) {
      await logSecurityEvent(req, {
        action: 'dm_store_affiliation_community_added',
        targetType: 'dm_store_affiliation',
        targetId: cleanText(communityAffiliation?.id, 80) || undefined,
        actorId: profile.id,
        actorRole: profile.role || 'creator',
        metadata: { dm_dossier_id: dossier.id, store_dossier_id: communityAffiliation?.store_dossier_id },
      });
      return res.json(ok({
        status: 'published',
        affiliation: communityAffiliation,
        message: '任职店家已作为社区补充立即展示；如有异议，异议方需提交证据',
      }));
    }
    if (existingReview) {
      if (communityAffiliation) return res.json(ok({
        status: 'partial',
        affiliation: communityAffiliation,
        message: '任职店家已立即展示；其他资料已有修改正在审核，本次未重复提交',
      }));
      const existingPayload = objectPayload(existingReview.payload);
      const submittedAt = cleanText(existingReview.created_at, 80);
      const mode = cleanText(existingPayload.review_mode, 30);
      const ownerDetected = Boolean(existingPayload.owner_login_detected);
      const dueAt = cleanText(existingPayload.owner_response_due_at, 80);
      const stage = mode === 'owner'
        ? ownerDetected || !dueAt
          ? '正在等待 DM 本人明确同意或反对'
          : `正在等待 DM 本人确认，确认期至 ${new Date(dueAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`
        : '正在等待管理员审核';
      const time = submittedAt
        ? new Date(submittedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
        : '此前';
      return res.status(409).json(err(new Error(`这份档案已有一条你在 ${time} 提交的修改，${stage}。请到“我的主页－认证身份－我提交的档案修改”撤回后再重新提交`)));
    }
    const sensitiveFields = dossierSensitiveFieldsInPatch(normalized.patch);
    const submitterIsOwner = ownerProfileId === profile.id;
    const ownerConfirmationFields = ownerProfileId && !submitterIsOwner ? normalized.changedFields : [];
    const workflow = initialDossierEditWorkflow({
      ownerProfileId: ownerProfileId || null,
      submitterProfileId: profile.id,
    });
    const classifiedPatch = partitionDossierEditPatch(normalized.patch);
    const partitions = classifiedPatch;
    const reviewMode = submitterIsOwner ? 'direct' : ownerProfileId ? 'owner' : 'direct';
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: normalized.entityType === 'store' ? 'store_dossier_update_submit' : 'dm_dossier_update_submit',
      targetType: 'dossier_update',
      texts: {
        name: normalized.patch.dm_name,
        city: normalized.patch.city,
        workplace: normalized.patch.workplace,
        profileUrl: normalized.patch.profile_url,
        note: normalized.patch.note,
        bio: normalized.patch.bio,
        tags: Array.isArray(normalized.patch.tags) ? normalized.patch.tags.join(' ') : '',
        commonScripts: Array.isArray(normalized.patch.common_scripts)
          ? normalized.patch.common_scripts.map(item => cleanText(objectPayload(item).name, 100)).join(' ')
          : '',
        editReason,
      },
      files: Array.isArray(normalized.patch.photo_files)
        ? normalized.patch.photo_files.map(item => ({
          url: cleanText(objectPayload(item).url, 800),
          type: cleanText(objectPayload(item).type, 80) || 'image/*',
        })).filter(item => item.url)
        : normalized.patch.photo_url ? [{ url: normalized.patch.photo_url, type: 'image/*' }] : [],
    });
    const review = await createPublicReview({
      targetType: 'dossier_update',
      profile,
      title: `${cleanText(dossier.dm_name, 80)} · ${normalized.entityLabel}档案修改`,
      summary: `${reviewMode === 'owner' ? '等待认领人确认；' : submitterIsOwner ? '认领人本人修改；' : '社区用户补充；'}修改字段：${normalized.changedFields.map(field => DOSSIER_EDIT_FIELD_LABELS[field] || field).join('、')}`,
      payload: {
        dossier_id: dossier.id,
        entity_type: normalized.entityType,
        dossier_name: dossier.dm_name,
        before_snapshot: normalized.beforeSnapshot,
        before_field_provenance: normalizeDossierFieldProvenance(dossier.field_provenance),
        patch: normalized.patch,
        changed_fields: normalized.changedFields,
        submitted_changed_fields: normalized.changedFields,
        sensitive_fields: sensitiveFields,
        owner_confirmation_fields: ownerConfirmationFields,
        submitted_sensitive_fields: sensitiveFields,
        no_admin_review_patch: partitions.noAdminReviewPatch,
        post_admin_review_patch: partitions.postAdminReviewPatch,
        pre_admin_review_patch: partitions.preAdminReviewPatch,
        edit_reason: editReason,
        owner_profile_id: ownerProfileId || null,
        review_mode: reviewMode,
        submitter_is_owner: submitterIsOwner,
        submission_source: submitterIsOwner ? 'owner' : 'community',
        owner_response_status: submitterIsOwner ? 'agreed' : workflow.ownerResponseStatus,
        owner_response_due_at: reviewMode === 'owner' ? workflow.ownerResponseDueAt : null,
        owner_response_reason: null,
        owner_responded_at: null,
      },
      moderationPrecheck,
    });
    let directResult: Awaited<ReturnType<typeof advanceDossierReviewAfterOwner>> | null = null;
    if (reviewMode === 'direct') {
      directResult = await advanceDossierReviewAfterOwner(
        review as PublicReviewRecord,
        objectPayload(review.payload),
        'agreed',
        profile.id,
      );
    }
    await logSecurityEvent(req, {
      action: 'dossier_update_submitted_for_review',
      targetType: 'public_review',
      targetId: review?.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: {
        dossier_id: dossier.id,
        entity_type: normalized.entityType,
        changed_fields: normalized.changedFields,
        owner_response_status: workflow.ownerResponseStatus,
        owner_response_due_at: workflow.ownerResponseDueAt,
        moderation: moderationPrecheck,
      },
    });
    const responseStatus = directResult?.status || 'pending';
    const directMessage = directResult?.status === 'approved'
      ? '资料已更新'
      : (directResult?.appliedImmediateFields.length || 0) > 0
        ? '结构化资料已更新；城市后审和自由填写内容已按规则进入管理员审核'
        : '自由填写内容已提交管理员审核，通过后公开';
    res.json(ok({
      ...publicReviewAcceptedResponse(review as Record<string, unknown>),
      status: responseStatus,
      review_mode: directResult?.reviewMode || reviewMode,
      applied_immediate_fields: directResult?.appliedImmediateFields || [],
      pending_changed_fields: directResult?.pendingChangedFields || normalized.changedFields,
      owner_response_status: submitterIsOwner ? 'agreed' : workflow.ownerResponseStatus,
      owner_response_due_at: reviewMode === 'owner' ? workflow.ownerResponseDueAt : null,
      message: reviewMode === 'direct'
        ? directMessage
        : reviewMode === 'owner'
          ? '修改已提交；认领人确认后结构化资料按规则生效，自由填写内容仍需管理员审核'
          : '结构化资料已按规则更新；自由填写内容会在管理员审核通过后公开',
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/dossier-edits/my', authMiddleware, async (req, res) => {
  try {
    await processDueDossierOwnerReviews();
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const result = await supabase.from('lc_public_reviews')
      .select('*')
      .eq('target_type', 'dossier_update')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(200);
    if (result.error && isMissingRelation(result.error, 'lc_public_reviews')) return res.json(ok({ awaiting_owner_response: [], my_submissions: [] }));
    if (result.error) throw result.error;
    const rows = (result.data || []) as Record<string, unknown>[];
    const awaitingOwnerResponse = rows.filter(row => {
      const payload = objectPayload(row.payload);
      return cleanText(payload.owner_profile_id, 80) === profile.id
        && effectiveDossierOwnerResponseStatus({ status: cleanText(payload.owner_response_status, 40), dueAt: cleanText(payload.owner_response_due_at, 80) }) === 'pending';
    }).map(publicDossierEditReview);
    const mySubmissions = rows.filter(row => cleanText(row.profile_id, 80) === profile.id).map(publicDossierEditReview);
    res.json(ok({ awaiting_owner_response: awaitingOwnerResponse, my_submissions: mySubmissions }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.delete('/api/lc/dossier-edits/:id', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const reviewResult = await supabase.from('lc_public_reviews')
      .select('*')
      .eq('id', req.params.id)
      .eq('target_type', 'dossier_update')
      .eq('status', 'pending')
      .maybeSingle();
    if (reviewResult.error) throw reviewResult.error;
    const review = reviewResult.data as Record<string, unknown> | null;
    if (!review) return res.status(404).json(err(new Error('这条档案修改不存在或已经处理')));
    if (cleanText(review.profile_id, 80) !== profile.id) return res.status(403).json(err(new Error('只能撤回自己提交的档案修改')));
    const payload = objectPayload(review.payload);
    payload.submitter_withdrawn = true;
    payload.withdrawn_at = new Date().toISOString();
    const updateResult = await supabase.from('lc_public_reviews').update({
      payload,
      status: 'rejected',
      reviewed_by: profile.id,
      reviewed_at: payload.withdrawn_at,
      review_note: '提交人主动撤回',
      updated_at: payload.withdrawn_at,
    }).eq('id', review.id).eq('status', 'pending');
    if (updateResult.error) throw updateResult.error;
    await logSecurityEvent(req, {
      action: 'dossier_update_withdrawn_by_submitter',
      targetType: 'public_review',
      targetId: cleanText(review.id, 80),
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { dossier_id: payload.dossier_id },
    });
    res.json(ok({ id: review.id, status: 'withdrawn', message: '档案修改已撤回，可以重新提交' }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/dossier-edits/:id/owner-response', authMiddleware, async (req, res) => {
  try {
    await processDueDossierOwnerReviews();
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const decision = cleanText(req.body?.decision, 20);
    if (decision !== 'agree' && decision !== 'oppose') return res.status(400).json(err(new Error('请选择同意或反对')));
    const responseReason = cleanText(req.body?.reason, 500);
    if (decision === 'oppose' && responseReason.length < 4) return res.status(400).json(err(new Error('请说明反对原因')));

    const { data: review, error: reviewErr } = await supabase.from('lc_public_reviews')
      .select('*')
      .eq('id', req.params.id)
      .eq('target_type', 'dossier_update')
      .eq('status', 'pending')
      .maybeSingle();
    if (reviewErr) throw reviewErr;
    if (!review) return res.status(404).json(err(new Error('档案修改申请不存在或已经处理')));
    const payload = objectPayload(review.payload);
    if (cleanText(payload.owner_profile_id, 80) !== profile.id) return res.status(403).json(err(new Error('只有当前档案认领人可以确认')));
    const effectiveStatus = effectiveDossierOwnerResponseStatus({
      status: cleanText(payload.owner_response_status, 40),
      dueAt: cleanText(payload.owner_response_due_at, 80),
    });
    if (cleanText(payload.review_mode, 30) !== 'owner') return res.status(409).json(err(new Error('这条修改不需要认领人确认')));
    if (effectiveStatus === 'expired') return res.status(409).json(err(new Error('3天确认期已经结束，资料已按规则自动处理')));
    if (effectiveStatus !== 'pending') return res.status(409).json(err(new Error('这条修改申请已经确认过了')));

    const { data: dossier, error: dossierErr } = await supabase.from('lc_dm_dossiers')
      .select('id, claim_status, claimed_by')
      .eq('id', cleanText(payload.dossier_id, 80))
      .maybeSingle();
    if (dossierErr) throw dossierErr;
    if (!dossier || dossier.claim_status !== 'approved' || cleanText(dossier.claimed_by, 80) !== profile.id) {
      return res.status(409).json(err(new Error('你已不是这份档案的当前认领人')));
    }

    payload.owner_response_status = decision === 'agree' ? 'agreed' : 'opposed';
    payload.owner_response_reason = responseReason || null;
    payload.owner_responded_at = new Date().toISOString();
    let ownerAdvanceResult: Awaited<ReturnType<typeof advanceDossierReviewAfterOwner>> | null = null;
    if (decision === 'agree') {
      ownerAdvanceResult = await advanceDossierReviewAfterOwner(
        review as PublicReviewRecord,
        payload,
        'agreed',
        profile.id,
      );
    } else {
      const updateResult = await supabase.from('lc_public_reviews').update({
        payload,
        status: 'rejected',
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        review_note: responseReason,
        updated_at: new Date().toISOString(),
      }).eq('id', review.id).eq('status', 'pending');
      if (updateResult.error) throw updateResult.error;
    }
    await logSecurityEvent(req, {
      action: decision === 'agree' ? 'dossier_update_agreed_by_owner' : 'dossier_update_opposed_by_owner',
      targetType: 'public_review',
      targetId: review.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { dossier_id: payload.dossier_id, response_reason: responseReason || null },
    });
    res.json(ok({
      owner_response_status: payload.owner_response_status,
      status: decision === 'agree' ? ownerAdvanceResult?.status || 'pending' : 'rejected',
      review_mode: ownerAdvanceResult?.reviewMode || 'owner',
      message: decision === 'agree'
        ? ownerAdvanceResult?.status === 'pending'
          ? '已同意修改；受限字段按规则生效，自由填写内容和城市后审已转管理员处理'
          : '已同意修改，受限字段已经生效'
        : '已反对这次修改',
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post(
  '/api/lc/dm-ratings',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'dm_rating_submit',
    targetType: 'dm_rating',
    content: req => [
      req.body?.content,
      req.body?.tags,
      req.body?.scriptName,
      req.body?.script_name,
      req.body?.storeName,
      req.body?.store_name,
      req.body?.dmName,
      req.body?.dm_name,
    ],
  }),
  async (req, res) => {
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
    let storeDossierId = cleanText(req.body?.storeDossierId ?? req.body?.store_dossier_id, 120);
    let storeName = cleanText(req.body?.storeName ?? req.body?.store_name, 160);
    let createdStoreDossierId = '';
    const newStore = req.body?.newStore && typeof req.body.newStore === 'object'
      ? req.body.newStore as Record<string, unknown>
      : null;
    if (storeId) {
      const storeResult = await supabase.from('jzg_stores').select('id, name, city, status').eq('id', storeId).maybeSingle();
      if (storeResult.error) throw storeResult.error;
      if (!storeResult.data || storeResult.data.status !== 'active') return res.status(400).json(err(new Error('选择的店家不存在或不可用')));
      storeName = cleanText(storeResult.data.name, 160);
    }
    if (storeDossierId) {
      const dossierResult = await supabase.from('lc_dm_dossiers')
        .select('id, dm_name, status, entity_type')
        .eq('id', storeDossierId)
        .eq('entity_type', 'store')
        .eq('status', 'approved')
        .maybeSingle();
      if (dossierResult.error) throw dossierResult.error;
      if (!dossierResult.data) return res.status(400).json(err(new Error('选择的店家档案不存在或尚未公开')));
      storeName = cleanText(dossierResult.data.dm_name, 160);
    } else if (newStore) {
      storeName = cleanText(newStore.storeName ?? newStore.name, 100);
      const city = cleanText(newStore.city, 80);
      const workplace = cleanText(newStore.workplace ?? newStore.address, 160);
      const rawPhotoUrl = newStore.photoUrl ?? newStore.photo_url;
      const photoUrl = normalizeOptionalPublicUrl(rawPhotoUrl, 800, true);
      const photoFiles = photoUrl ? [{ name: `${storeName || '店家'}照片`, url: photoUrl, type: 'image/jpeg' }] : [];
      if (!storeName) return res.status(400).json(err(new Error('请填写店家名称')));
      if (!city) return res.status(400).json(err(new Error('请选择店家所在城市')));
      if (!workplace) return res.status(400).json(err(new Error('请填写店家地址、商圈或常驻位置')));
      if (!isOptionalUrlPlaceholder(rawPhotoUrl) && !photoUrl) return res.status(400).json(err(new Error('店铺照片链接格式不正确，也可以直接留空')));
      const storePrecheck = runLocalModerationPrecheck({
        scene: 'store_dossier_submit_with_dm_rating',
        targetType: 'dm_dossier',
        texts: { storeName, city, workplace, note: cleanText(newStore.note, 600) },
        files: photoFiles,
      });
      const { data: insertedStore, error: storeInsertErr } = await supabase.from('lc_dm_dossiers').insert({
        entity_type: 'store',
        dm_name: storeName,
        city,
        workplace,
        employment_status: 'unknown',
        employer_store_id: null,
        photo_url: photoUrl || null,
        photo_files: photoFiles,
        note: cleanText(newStore.note, 600) || null,
        tags: cleanTextArray(newStore.tags, 8, 18),
        submitted_by: profile.id,
        submitted_by_name: profile.display_name,
        status: 'pending',
        claim_status: 'unclaimed',
        moderation_precheck: storePrecheck,
      }).select('id').single();
      if (storeInsertErr) throw storeInsertErr;
      storeDossierId = cleanText(insertedStore.id, 120);
      createdStoreDossierId = storeDossierId;
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
      const photoFocusX = normalizeImageFocus(newDm.photoFocusX ?? newDm.photo_focus_x, 50);
      const photoFocusY = normalizeImageFocus(newDm.photoFocusY ?? newDm.photo_focus_y, 25);
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
        photo_focus_x: photoFocusX,
        photo_focus_y: photoFocusY,
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
      store_dossier_id: storeDossierId || null,
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
      new_store: Boolean(createdStoreDossierId),
      similar_candidates: newDmCandidates,
      message: '评分和DM资料已提交审核，通过后公开并计入综合分',
    }));
  } catch (e) { res.status(500).json(err(e)); }
  },
);

app.post(
  '/api/lc/store-ratings',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'store_rating_submit',
    targetType: 'store_rating',
    content: req => [
      req.body?.content,
      req.body?.tags,
      req.body?.scriptName,
      req.body?.script_name,
      req.body?.storeName,
      req.body?.store_name,
    ],
  }),
  async (req, res) => {
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
      const photoFocusX = normalizeImageFocus(newStore.photoFocusX ?? newStore.photo_focus_x, 50);
      const photoFocusY = normalizeImageFocus(newStore.photoFocusY ?? newStore.photo_focus_y, 25);
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
        photo_focus_x: photoFocusX,
        photo_focus_y: photoFocusY,
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
  },
);

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
  paymentPurchaseId: string;
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
          (id, dossier_id, claimant_id, entity_type, proof_type, claim_note, proof_files, payment_purchase_id, status)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'pending')`,
        [input.claimId, input.dossierId, input.claimantId, input.entityType, input.proofType, input.claimNote, JSON.stringify(input.proofFiles), input.paymentPurchaseId],
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
    payment_purchase_id: input.paymentPurchaseId,
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

app.post('/api/lc/dm-affiliations/:id/disputes', authMiddleware, upload.array('evidenceFiles', MAX_DOSSIER_CLAIM_PROOFS), async (req, res) => {
  let savedProofs: DossierClaimProofFile[] = [];
  let reportId = '';
  let dmDossierId = '';
  let committed = false;
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const reason = cleanText(req.body?.reason, 800);
    const truthConfirmed = String(req.body?.truthConfirmed || '') === 'true';
    const rawFiles = Array.isArray(req.files) ? req.files : [];
    if (reason.length < 6) return res.status(400).json(err(new Error('请至少写6个字说明异议原因')));
    if (!truthConfirmed) return res.status(400).json(err(new Error('请确认异议和证据真实')));
    if (rawFiles.length < 1 || rawFiles.length > MAX_DOSSIER_CLAIM_PROOFS) {
      return res.status(400).json(err(new Error(`发起异议必须上传1-${MAX_DOSSIER_CLAIM_PROOFS}张证据截图`)));
    }
    const affiliationResult = await supabase.from('lc_dm_store_affiliations').select('*')
      .eq('id', req.params.id).in('status', ['pending', 'approved', 'legacy_unverified']).maybeSingle();
    if (affiliationResult.error) throw affiliationResult.error;
    if (!affiliationResult.data) return res.status(404).json(err(new Error('任职关系不存在或已经结束')));
    const affiliation = affiliationResult.data as Record<string, unknown>;
    dmDossierId = String(affiliation.dm_dossier_id || '');
    const [dmResult, storeResult, existingResult] = await Promise.all([
      supabase.from('lc_dm_dossiers').select('id, dm_name').eq('id', affiliation.dm_dossier_id).maybeSingle(),
      supabase.from('lc_dm_dossiers').select('id, dm_name').eq('id', affiliation.store_dossier_id).maybeSingle(),
      supabase.from('lc_reports').select('*').eq('target_type', 'dm_affiliation').eq('target_id', req.params.id).eq('reporter_id', profile.id).maybeSingle(),
    ]);
    if (dmResult.error) throw dmResult.error;
    if (storeResult.error) throw storeResult.error;
    if (existingResult.error && !isMissingRelation(existingResult.error, 'evidence_files')) throw existingResult.error;
    if (existingResult.data?.status === 'pending') return res.status(409).json(err(new Error('你已经提交过这条任职关系的异议')));
    reportId = String(existingResult.data?.id || randomUUID());
    if (existingResult.data) removeDossierClaimProofs(PRIVATE_UPLOAD_ROOT, dmDossierId, reportId);
    const sanitizedFiles = await Promise.all(rawFiles.map(async file => ({
      originalName: file.originalname,
      image: await sanitizeUploadedImageFile({ buffer: file.buffer, mimetype: file.mimetype }),
    })));
    savedProofs = saveDossierClaimProofs({
      root: PRIVATE_UPLOAD_ROOT,
      dossierId: dmDossierId,
      claimId: reportId,
      files: sanitizedFiles,
    });
    const targetTitle = `${cleanText(dmResult.data?.dm_name, 80) || 'DM'}任职于${cleanText(storeResult.data?.dm_name, 80) || '店家'}`;
    const reportPayload = {
      id: reportId,
      target_type: 'dm_affiliation',
      target_id: req.params.id,
      target_title: targetTitle,
      reporter_id: profile.id,
      reporter_name: profile.display_name || '用户',
      reason: '任职关系异议',
      description: reason,
      evidence_files: savedProofs,
      target_snapshot: {
        dm_dossier_id: affiliation.dm_dossier_id,
        store_dossier_id: affiliation.store_dossier_id,
        relation_source: affiliation.requested_by_role,
      },
      status: 'pending',
      updated_at: new Date().toISOString(),
    };
    const writeResult = existingResult.data
      ? await supabase.from('lc_reports').update(reportPayload).eq('id', reportId)
      : await supabase.from('lc_reports').insert(reportPayload);
    if (writeResult.error) throw writeResult.error;
    committed = true;
    await logSecurityEvent(req, {
      action: 'dm_store_affiliation_disputed',
      targetType: 'dm_affiliation',
      targetId: req.params.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { report_id: reportId, evidence_count: savedProofs.length },
    });
    res.json(ok({ id: reportId, status: 'pending', message: '异议和证据已提交，任职关系在管理员处理前继续展示' }));
  } catch (e) {
    if (!committed && reportId && savedProofs.length > 0) {
      try { removeDossierClaimProofs(PRIVATE_UPLOAD_ROOT, dmDossierId, reportId); } catch { /* cleanup best effort */ }
    }
    res.status(500).json(err(e));
  }
});

app.get('/api/lc/admin/dm-affiliation-reports/:reportId/proofs/:fileId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await supabase.from('lc_reports').select('id, target_snapshot, evidence_files')
      .eq('id', req.params.reportId).eq('target_type', 'dm_affiliation').maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return res.status(404).json(err(new Error('异议证据不存在')));
    const proof = internalClaimProofFiles(result.data.evidence_files).find(file => file.id === req.params.fileId);
    if (!proof) return res.status(404).json(err(new Error('异议证据不存在')));
    const dossierId = cleanText(objectPayload(result.data.target_snapshot).dm_dossier_id, 80);
    const body = readDossierClaimProof(PRIVATE_UPLOAD_ROOT, proof.relative_path);
    if (!dossierId) return res.status(404).json(err(new Error('异议证据索引不完整')));
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(body);
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
    const [result, purchase] = await Promise.all([
      supabase.from('lc_dm_dossier_claims')
        .select('id, dossier_id, proof_type, claim_note, status, reject_reason, created_at, reviewed_at')
        .eq('dossier_id', req.params.id)
        .eq('claimant_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      findServicePurchase(profile.id, 'dossier_claim', req.params.id),
    ]);
    if (result.error && isMissingRelation(result.error, 'lc_dm_dossier_claims')) return res.json(ok(null));
    if (result.error) throw result.error;
    res.json(ok({
      claim: result.data || null,
      payment: purchase ? await servicePurchaseStatusPayload(purchase) : {
        paid: false,
        amount_fen: SERVICE_FEE_FEN,
        amount_yuan: SERVICE_FEE_YUAN,
        product_type: 'dossier_claim',
        target_id: req.params.id,
      },
    }));
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
    const paidPurchase = await paidServicePurchase(profile.id, 'dossier_claim', dossier.id);
    if (!paidPurchase) {
      return res.status(402).json(codedErr(
        new Error(`提交本人认领前需在微信小程序支付 ${SERVICE_FEE_YUAN} 元认证审核服务费`),
        'SERVICE_PAYMENT_REQUIRED',
        { product_type: 'dossier_claim', target_id: dossier.id, amount_fen: SERVICE_FEE_FEN },
      ));
    }
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
      paymentPurchaseId: paidPurchase.id,
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
    const feedMode = cleanText(req.query.sort, 20).toLowerCase() === 'discussed' ? 'discussed' : 'latest';
    res.setHeader('X-Ranking-Feed-Mode', feedMode);
    const viewerId = await getOptionalCreatorId(req);
    let query = supabase
      .from('lc_rankings')
      .select('*, lc_profiles!poster_id(display_name, avatar, verified_dm, verified_shop, role)')
      .eq('status', 'approved');
    if (type && type !== 'all') query = query.eq('type', type);
    if (subjectType && subjectType !== 'all') query = query.eq('subject_type', subjectType);
    if (cities.length > 0) query = query.in('subject_city', cities);
    else if (city && city !== 'all') query = query.eq('subject_city', city);
    query = query.order('last_activity_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });

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
    let participantCountByRanking = new Map<string, number>();
    if (rankingIds.length > 0) {
      const [pinnedResult, participantResult] = await Promise.all([
        supabase.from('lc_comments')
          .select('id, ranking_id, content, author_id, author_name, is_realname, is_pinned, pin_label, likes, created_at')
          .in('ranking_id', rankingIds)
          .eq('status', 'approved')
          .eq('is_pinned', true)
          .order('created_at', { ascending: false }),
        supabase.from('lc_votes')
          .select('ranking_id, reputation_identity_id, voter_id')
          .in('ranking_id', rankingIds)
          .eq('source', 'free_vote'),
      ]);
      const { data: pinnedComments, error: pinnedErr } = pinnedResult;
      if (pinnedErr) throw pinnedErr;
      if (participantResult.error) throw participantResult.error;
      pinnedByRanking = (pinnedComments || []).reduce((map: Map<string, PinnedCommentRow[]>, comment: PinnedCommentRow) => {
        const list = map.get(comment.ranking_id) || [];
        list.push(comment);
        map.set(comment.ranking_id, list);
        return map;
      }, new Map<string, PinnedCommentRow[]>());
      const participantKeysByRanking = (participantResult.data || []).reduce((map: Map<string, Set<string>>, vote: Record<string, unknown>) => {
        const rankingId = cleanText(vote.ranking_id, 80);
        const participantKey = cleanText(vote.reputation_identity_id, 80) || cleanText(vote.voter_id, 80);
        if (!rankingId || !participantKey) return map;
        const keys = map.get(rankingId) || new Set<string>();
        keys.add(participantKey);
        map.set(rankingId, keys);
        return map;
      }, new Map<string, Set<string>>());
      participantCountByRanking = new Map(
        Array.from(participantKeysByRanking.entries()).map(([rankingId, keys]) => [rankingId, keys.size]),
      );
    }

    const feedRows = visibleWithAudit.map((row: Record<string, unknown>) => ({
      ...withRankingMetrics(row),
      pinned_comments: pinnedByRanking.get(String(row.id)) || [],
      participant_count: participantCountByRanking.get(String(row.id)) || 0,
    }));
    const withPinnedComments = feedMode === 'discussed'
      ? sortRankingFeedDiscussed(feedRows)
      : sortRankingFeedLatest(feedRows);

    if (!viewerId || withPinnedComments.length === 0) return res.json(ok(withPinnedComments));

    const identityResult = await supabase.from('lc_profiles')
      .select('reputation_identity_id')
      .eq('id', viewerId)
      .maybeSingle();
    if (identityResult.error) throw identityResult.error;
    const reputationIdentityId = cleanText(identityResult.data?.reputation_identity_id, 80);
    if (!reputationIdentityId) return res.json(ok(withPinnedComments));

    const { data: myVotes, error: myVoteErr } = await supabase.from('lc_votes')
      .select('id, ranking_id, vote_type, vote_channel, created_at')
      .in('ranking_id', rankingIds)
      .eq('reputation_identity_id', reputationIdentityId)
      .eq('source', 'free_vote');
    if (myVoteErr) throw myVoteErr;

    const stanceVoteByRanking = new Map(
      ((myVotes || []) as RankingVoteRow[])
        .filter(vote => vote.vote_channel === 'stance' && vote.vote_type !== 'joy')
        .map(vote => [vote.ranking_id, vote]),
    );
    const joyVoteByRanking = new Map(
      ((myVotes || []) as RankingVoteRow[])
        .filter(vote => vote.vote_channel === 'joy' && vote.vote_type === 'joy')
        .map(vote => [vote.ranking_id, vote]),
    );
    const withMyVotes = withPinnedComments.map((row: Record<string, unknown>) => ({
      ...row,
      my_vote: stanceVoteByRanking.get(String(row.id))
        ? serializeMyVote(stanceVoteByRanking.get(String(row.id)) as RankingVoteRow)
        : null,
      my_joy_vote: joyVoteByRanking.get(String(row.id))
        ? serializeMyVote(joyVoteByRanking.get(String(row.id)) as RankingVoteRow)
        : null,
    }));

    res.json(ok(withMyVotes));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/rankings/mine', authMiddleware, async (req, res) => {
  try {
    const posterId = getReq(req, 'creatorId');
    const [rankingResult, editRequestResult] = await Promise.all([
      supabase.from('lc_rankings')
        .select('id, type, subject_name, subject_type, subject_city, subject_url, subject_dossier_id, event_date, event_script_id, event_script_name, event_store_dossier_id, event_store_name, dm_employment_status_suggestion, dm_employer_store_id_suggestion, content, files, display_files, private_evidence_files, evidence_required, revision_kind, revision_requested_at, revision_count, initial_amount, likes, dislikes, joys, boost_amount, negative_boost_amount, agree_count, oppose_count, status, reject_reason, withdrawn_at, withdrawal_reason, created_at, last_activity_at')
        .eq('poster_id', posterId)
        .order('created_at', { ascending: false }),
      supabase.from('lc_ranking_edit_requests')
        .select('id, ranking_id, request_kind, status, reject_reason, changes, proposed_patch, created_at, reviewed_at')
        .eq('author_id', posterId)
        .order('created_at', { ascending: false })
        .limit(300),
    ]);
    if (rankingResult.error) throw rankingResult.error;
    if (editRequestResult.error && !isMissingRelation(editRequestResult.error, 'lc_ranking_edit_requests')) throw editRequestResult.error;
    const latestRequestByRanking = new Map<string, Record<string, unknown>>();
    ((editRequestResult.data || []) as Record<string, unknown>[]).forEach(request => {
      const rankingId = String(request.ranking_id || '');
      if (rankingId && !latestRequestByRanking.has(rankingId)) latestRequestByRanking.set(rankingId, request);
    });
    const data = rankingResult.data || [];
    res.json(ok((data || []).map((row: Record<string, unknown>) => withRankingMetrics({
      ...row,
      display_files: normalizeRankingDisplayFiles(row.display_files),
      private_evidence_files: publicRankingEvidenceMetadata(row.private_evidence_files),
      latest_edit_request: latestRequestByRanking.get(String(row.id)) || null,
    }))));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/rankings/:id', async (req, res) => {
  try {
    const viewerId = await getOptionalCreatorId(req);
    const { data, error } = await supabase.from('lc_rankings')
      .select('*, lc_profiles!poster_id(display_name, avatar, verified_dm, verified_shop, role)')
      .eq('id', req.params.id)
      .eq('status', 'approved')
      .maybeSingle();
    if (error) throw error;
    if (!data || !isPublicRankingVisible(data as Record<string, unknown>)) {
      return res.status(404).json(err(new Error('榜单不存在或尚未公开')));
    }
    const [withAudit] = await attachAuditProof('ranking', [publicRankingPayload(withRankingMetrics(data as Record<string, unknown>))]);
    let myVote = null;
    let myJoyVote = null;
    if (viewerId) {
      const voteState = await getRankingVoteState(viewerId, req.params.id);
      myVote = voteState.myVote;
      myJoyVote = voteState.myJoyVote;
    }
    res.json(ok({ ...withRankingMetrics(withAudit), my_vote: myVote, my_joy_vote: myJoyVote }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/rankings/:id/versions', async (req, res) => {
  try {
    const rankingResult = await supabase.from('lc_rankings')
      .select('*')
      .eq('id', req.params.id)
      .eq('status', 'approved')
      .maybeSingle();
    if (rankingResult.error) throw rankingResult.error;
    if (!rankingResult.data || !isPublicRankingVisible(rankingResult.data as Record<string, unknown>)) {
      return res.status(404).json(err(new Error('榜单不存在或尚未公开')));
    }
    const versionResult = await supabase.from('lc_ranking_versions')
      .select('id, version_number, source, snapshot, changes, created_at')
      .eq('ranking_id', req.params.id)
      .order('version_number', { ascending: false });
    if (versionResult.error && !isMissingRelation(versionResult.error, 'lc_ranking_versions')) throw versionResult.error;
    const versions = versionResult.error || !versionResult.data?.length
      ? [{
          id: `current-${req.params.id}`,
          version_number: 1,
          source: 'original',
          snapshot: rankingVersionSnapshot(rankingResult.data as Record<string, unknown>),
          changes: [],
          created_at: rankingResult.data.created_at,
        }]
      : (versionResult.data || []).map(version => ({
          ...version,
          snapshot: publicRankingVersionSnapshot(version.snapshot),
          changes: Array.isArray(version.changes) ? version.changes : [],
        }));
    res.json(ok(versions));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/edit-requests', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const rankingResult = await supabase.from('lc_rankings')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (rankingResult.error) throw rankingResult.error;
    const ranking = rankingResult.data as Record<string, unknown> | null;
    if (!ranking) return res.status(404).json(err(new Error('内容不存在')));
    if (ranking.poster_id !== profile.id) return res.status(403).json(err(new Error('只能修改自己发布的内容')));
    if (ranking.status !== 'approved') return res.status(400).json(err(new Error('只有已发布内容可以申请修改')));

    const pendingResult = await supabase.from('lc_ranking_edit_requests')
      .select('id, request_kind')
      .eq('ranking_id', req.params.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (pendingResult.error) throw pendingResult.error;
    if (pendingResult.data) return res.status(409).json(err(new Error('这条内容已有修改或恢复申请正在审核')));

    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    const assessment = assessRankingAuthorEdit(ranking, body);
    if (!assessment.allowed) return res.status(400).json(err(new Error(assessment.reason || '修改不符合要求')));
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'ranking_author_edit',
      targetType: 'ranking_edit',
      texts: {
        content: assessment.patch.content ?? ranking.content,
        subjectUrl: assessment.patch.subject_url ?? ranking.subject_url,
        eventScriptName: assessment.patch.event_script_name ?? ranking.event_script_name,
        eventStoreName: assessment.patch.event_store_name ?? ranking.event_store_name,
      },
      files: normalizeRankingDisplayFiles(ranking.display_files),
      allowContact: false,
    });
    await ensureInitialRankingVersion(ranking, profile.id);
    const requestId = randomUUID();
    const insertResult = await supabase.from('lc_ranking_edit_requests').insert({
      id: requestId,
      ranking_id: req.params.id,
      author_id: profile.id,
      request_kind: 'edit',
      before_snapshot: rankingVersionSnapshot(ranking),
      proposed_patch: assessment.patch,
      changes: assessment.changes,
      change_metrics: assessment.metrics,
      moderation_precheck: moderationPrecheck,
      status: 'pending',
    }).select('*').single();
    if (insertResult.error) throw insertResult.error;
    await logSecurityEvent(req, {
      action: 'ranking_author_edit_submitted',
      targetType: 'ranking',
      targetId: req.params.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { edit_request_id: requestId, changed_fields: assessment.changes.map(change => change.field), moderation: moderationPrecheck },
    });
    res.json(ok({ id: requestId, status: 'pending', message: '修改申请已提交，审核通过前继续展示当前版本' }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/restore-request', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const rankingResult = await supabase.from('lc_rankings').select('*').eq('id', req.params.id).maybeSingle();
    if (rankingResult.error) throw rankingResult.error;
    const ranking = rankingResult.data as Record<string, unknown> | null;
    if (!ranking) return res.status(404).json(err(new Error('内容不存在')));
    if (ranking.poster_id !== profile.id) return res.status(403).json(err(new Error('只能恢复自己发布的内容')));
    if (ranking.status !== 'withdrawn') return res.status(400).json(err(new Error('只有已下架内容可以申请恢复')));
    const pendingResult = await supabase.from('lc_ranking_edit_requests')
      .select('id')
      .eq('ranking_id', req.params.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (pendingResult.error) throw pendingResult.error;
    if (pendingResult.data) return res.status(409).json(err(new Error('这条内容已有申请正在审核')));
    const requestId = randomUUID();
    const insertResult = await supabase.from('lc_ranking_edit_requests').insert({
      id: requestId,
      ranking_id: req.params.id,
      author_id: profile.id,
      request_kind: 'restore',
      before_snapshot: rankingVersionSnapshot(ranking),
      proposed_patch: {},
      changes: [],
      change_metrics: {},
      status: 'pending',
    }).select('id').single();
    if (insertResult.error) throw insertResult.error;
    await logSecurityEvent(req, {
      action: 'ranking_restore_requested',
      targetType: 'ranking',
      targetId: req.params.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { edit_request_id: requestId },
    });
    res.json(ok({ id: requestId, status: 'pending', message: '恢复申请已提交，管理员通过后重新公开' }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post(
  '/api/lc/rankings',
  authMiddleware,
  upload.array('evidenceFiles', MAX_RANKING_EVIDENCE_FILES),
  wechatMiniTextSafetyMiddleware({
    businessScene: 'ranking_submit',
    targetType: 'ranking',
    content: req => {
      const body = rankingRequestBody(req);
      return [
        body.subjectName,
        body.subject_name,
        body.subjectCity,
        body.subject_city,
        body.content,
        body.eventScriptName,
        body.event_script_name,
        body.eventStoreName,
        body.event_store_name,
      ];
    },
  }),
  async (req, res) => {
  let savedEvidenceFiles: RankingEvidenceFile[] = [];
  let rankingCommitted = false;
  try {
    const body = rankingRequestBody(req);
    const type = cleanText(body.type, 20);
    const subjectName = cleanText(body.subjectName ?? body.subject_name, 120);
    const subjectType = cleanText(body.subjectType ?? body.subject_type, 40);
    const subjectCity = cleanText(body.subjectCity ?? body.subject_city, 80);
    const subjectUrl = cleanText(body.subjectUrl ?? body.subject_url, 500);
    const content = cleanText(body.content, 4000);
    const paymentProof = cleanText(body.paymentProof ?? body.payment_proof, 1000);
    const newSubject = body.newSubject && typeof body.newSubject === 'object' && !Array.isArray(body.newSubject)
      ? body.newSubject as Record<string, unknown>
      : null;
    if (!type || !subjectName || !subjectType || !content) {
      return res.status(400).json(err(new Error('缺少必填字段')));
    }
    if (!['red', 'black', 'white'].includes(type)) return res.status(400).json(err(new Error('无效榜单类型')));
    if (!RANKING_SUBJECT_TYPES.includes(subjectType)) return res.status(400).json(err(new Error('无效对象分类')));
    const amount = 0;

    // 榜金支付
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const displayFiles = normalizeRankingDisplayFiles(body.displayFiles ?? body.display_files);
    const legacyEvidenceFiles = normalizeRankingDisplayFiles(body.files);
    const rawEvidenceFiles = Array.isArray(req.files) ? req.files : [];
    const subjectDossier = await resolveRankingSubjectDossier({
      subjectType,
      subjectName,
      subjectCity,
      subjectDossierId: body.subjectDossierId ?? body.subject_dossier_id,
      newSubject,
      profile,
    });
    const finalSubjectName = cleanText(subjectDossier?.dm_name, 120) || subjectName;
    const finalSubjectCity = cleanText(subjectDossier?.city, 80) || subjectCity;
    const eventContext = await resolveRankingEventContext(body);
    const employmentSuggestion = await resolveDmEmploymentSuggestion(body, String(subjectType));
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'ranking_submit',
      targetType: 'ranking',
      texts: { type, subjectName: finalSubjectName, subjectType, subjectCity: finalSubjectCity, subjectUrl, content },
      files: displayFiles,
      allowContact: false,
    });
    await ensureWechatMiniImageSafetyChecks(req, {
      urls: displayFiles.map(file => file.url),
      businessScene: 'ranking_display_image_submit',
      targetType: 'ranking',
    });

    const posterId = getReq(req, 'creatorId');
    const rankingId = randomUUID();
    if (rawEvidenceFiles.length > 0) {
      const sanitizedFiles = await Promise.all(rawEvidenceFiles.map(async file => ({
        originalName: file.originalname,
        image: await sanitizeUploadedImageFile({ buffer: file.buffer, mimetype: file.mimetype }),
      })));
      savedEvidenceFiles = saveRankingEvidenceFiles({ root: PRIVATE_UPLOAD_ROOT, rankingId, files: sanitizedFiles });
    }

    const row: Record<string, unknown> = {
      id: rankingId,
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
      files: legacyEvidenceFiles,
      display_files: displayFiles,
      private_evidence_files: savedEvidenceFiles,
      moderation_precheck: moderationPrecheck,
      boost_amount: 0,
      negative_boost_amount: 0,
      agree_count: 0,
      oppose_count: 0,
      likes: 0,
      dislikes: 0,
      joys: 0,
    };

    // 黑榜 30 天过期
    if (type === 'black') {
      row.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: ranking, error: insErr } = await supabase.from('lc_rankings').insert(row).select().single();

    if (insErr) throw insErr;
    rankingCommitted = true;

    if (!subjectDossier && newSubject && ranking && cleanText(newSubject.name, 120)) {
      await supabase.from('lc_submitted_subjects').insert({
        name: cleanText(newSubject.name, 120), subject_type: cleanText(newSubject.subject_type, 40) || subjectType,
        city: cleanText(newSubject.city, 80) || subjectCity, description: cleanText(newSubject.description, 500) || null,
        contact: cleanText(newSubject.contact, 200) || null, ranking_id: ranking.id,
      });
    }

    await logSecurityEvent(req, {
      action: 'ranking_submitted',
      targetType: 'ranking',
      targetId: ranking?.id,
      metadata: { ranking_type: type, subject_type: subjectType, subject_city: subjectCity || null, subject_dossier_id: subjectDossier?.id || null, amount, display_image_count: displayFiles.length, evidence_count: legacyEvidenceFiles.length + savedEvidenceFiles.length, moderation: moderationPrecheck },
    });
    res.json(ok({ id: ranking?.id }));
  } catch (e) {
    if (!rankingCommitted && savedEvidenceFiles.length > 0) removeRankingEvidenceFiles(PRIVATE_UPLOAD_ROOT, savedEvidenceFiles);
    res.status(500).json(err(e));
  }
  },
);

app.put('/api/lc/rankings/:id/resubmit', authMiddleware, upload.array('evidenceFiles', MAX_RANKING_EVIDENCE_FILES), async (req, res) => {
  let savedEvidenceFiles: RankingEvidenceFile[] = [];
  let updateCommitted = false;
  try {
    const body = rankingRequestBody(req);
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

    const subjectType = cleanText(body.subjectType ?? body.subject_type ?? existing.subject_type, 40);
    const subjectName = cleanText(body.subjectName ?? body.subject_name, 120);
    const subjectCity = cleanText(body.subjectCity ?? body.subject_city, 80);
    const content = cleanText(body.content, 4000);
    if (!subjectName || !subjectType || !content) return res.status(400).json(err(new Error('请补齐对象和正文内容')));
    if (!RANKING_SUBJECT_TYPES.includes(subjectType)) return res.status(400).json(err(new Error('无效对象分类')));
    const displayFiles = normalizeRankingDisplayFiles(body.displayFiles ?? body.display_files);
    const legacyEvidenceFiles = normalizeRankingDisplayFiles(existing.files);
    const existingEvidenceFiles = internalRankingEvidenceFiles(existing.private_evidence_files);
    const rawEvidenceFiles = Array.isArray(req.files) ? req.files : [];
    if (existingEvidenceFiles.length + rawEvidenceFiles.length > MAX_RANKING_EVIDENCE_FILES) {
      return res.status(400).json(err(new Error(`审核材料最多上传${MAX_RANKING_EVIDENCE_FILES}张`)));
    }
    if (existing.evidence_required && legacyEvidenceFiles.length + existingEvidenceFiles.length + rawEvidenceFiles.length === 0) {
      return res.status(400).json(err(new Error('管理员要求补充证据，请至少上传一张证据图片')));
    }

    const subjectDossier = await resolveRankingSubjectDossier({
      subjectType,
      subjectName,
      subjectCity,
      subjectDossierId: body.subjectDossierId ?? body.subject_dossier_id ?? existing.subject_dossier_id,
      newSubject: body.newSubject,
      profile,
      allowPending: true,
    });
    const finalSubjectName = cleanText(subjectDossier?.dm_name, 120) || subjectName;
    const finalSubjectCity = cleanText(subjectDossier?.city, 80) || subjectCity;
    const eventContext = await resolveRankingEventContext(body);
    const employmentSuggestion = await resolveDmEmploymentSuggestion(body, subjectType);
    const moderationPrecheck = runLocalModerationPrecheck({
      scene: 'ranking_resubmit',
      targetType: 'ranking',
      texts: { type: existing.type, subjectName: finalSubjectName, subjectType, subjectCity: finalSubjectCity, subjectUrl: body.subjectUrl, content },
      files: displayFiles,
      allowContact: false,
    });
    if (rawEvidenceFiles.length > 0) {
      const sanitizedFiles = await Promise.all(rawEvidenceFiles.map(async file => ({
        originalName: file.originalname,
        image: await sanitizeUploadedImageFile({ buffer: file.buffer, mimetype: file.mimetype }),
      })));
      savedEvidenceFiles = saveRankingEvidenceFiles({
        root: PRIVATE_UPLOAD_ROOT,
        rankingId: existing.id,
        existingCount: existingEvidenceFiles.length,
        files: sanitizedFiles,
      });
    }
    const { data: updated, error: updateErr } = await supabase.from('lc_rankings').update({
      subject_name: finalSubjectName,
      subject_type: subjectType,
      subject_city: finalSubjectCity || null,
      subject_url: cleanText(body.subjectUrl ?? body.subject_url, 500) || null,
      subject_dossier_id: subjectDossier?.id || null,
      ...eventContext,
      ...employmentSuggestion,
      content,
      display_files: displayFiles,
      private_evidence_files: [...existingEvidenceFiles, ...savedEvidenceFiles],
      status: 'pending',
      reject_reason: null,
      evidence_required: false,
      revision_kind: null,
      revision_requested_at: null,
      moderation_precheck: moderationPrecheck,
    }).eq('id', existing.id).select('*').single();
    if (updateErr) throw updateErr;
    updateCommitted = true;
    await logSecurityEvent(req, {
      action: 'ranking_resubmitted',
      targetType: 'ranking',
      targetId: existing.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { prior_revision_kind: existing.revision_kind || null, display_image_count: displayFiles.length, evidence_count: legacyEvidenceFiles.length + existingEvidenceFiles.length + savedEvidenceFiles.length, subject_dossier_id: subjectDossier?.id || null, moderation: moderationPrecheck },
    });
    res.json(ok({ id: updated?.id, status: updated?.status, message: '已重新提交审核，发布评价不扣榜金' }));
  } catch (e) {
    if (!updateCommitted && savedEvidenceFiles.length > 0) removeRankingEvidenceFiles(PRIVATE_UPLOAD_ROOT, savedEvidenceFiles);
    res.status(500).json(err(e));
  }
});

app.put('/api/lc/rankings/:id/withdraw', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: ranking } = await supabase.from('lc_rankings')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (!ranking) return res.status(404).json(err(new Error('内容不存在')));
    if (ranking.poster_id !== profile.id) return res.status(403).json(err(new Error('只能撤回自己的内容')));
    if (!['pending', 'approved', 'rejected'].includes(String(ranking.status))) {
      return res.status(400).json(err(new Error(ranking.status === 'withdrawn' ? '这条内容已经下架' : '当前状态不能下架')));
    }

    if (ranking.status === 'approved') await ensureInitialRankingVersion(ranking as Record<string, unknown>, profile.id);
    const now = new Date().toISOString();
    const reason = cleanText(req.body?.reason, 300) || (ranking.status === 'approved' ? '原发布人主动下架' : '原发布人撤回');

    const { error: updErr } = await supabase.from('lc_rankings')
      .update({ status: 'withdrawn', withdrawn_at: now, withdrawn_by: profile.id, withdrawal_reason: reason })
      .eq('id', req.params.id)
      .eq('poster_id', profile.id)
      .eq('status', ranking.status);
    if (updErr) throw updErr;
    const cancelResult = await supabase.from('lc_ranking_edit_requests')
      .update({ status: 'cancelled', reject_reason: '原发布人已下架内容', reviewed_at: now, updated_at: now })
      .eq('ranking_id', req.params.id)
      .eq('status', 'pending');
    if (cancelResult.error && !isMissingRelation(cancelResult.error, 'lc_ranking_edit_requests')) throw cancelResult.error;
    const audit = await appendAuditEntry({
      targetType: 'ranking',
      targetId: req.params.id,
      eventType: 'ranking_withdrawn_by_author',
      payload: auditPayload('ranking', { ...ranking, status: 'withdrawn' }),
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { prior_status: ranking.status, reason, public_removed: ranking.status === 'approved' },
    });
    await logSecurityEvent(req, {
      action: 'ranking_withdrawn_by_author',
      targetType: 'ranking',
      targetId: req.params.id,
      actorId: profile.id,
      actorRole: profile.role || 'creator',
      metadata: { prior_status: ranking.status, reason, audit_entry_hash: audit?.entry_hash || null },
    });
    res.json(ok({ id: req.params.id, status: 'withdrawn', public_removed: ranking.status === 'approved' }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/paid-boost', authMiddleware, async (req, res) => {
  res.status(410).json(err(new Error('事件帖付费打榜已经下线；支持DM请前往其档案送缠头')));
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

app.post(
  '/api/lc/rankings/:id/vote',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'ranking_vote_comment',
    targetType: 'ranking_comment',
    content: req => [req.body?.comment],
  }),
  async (req, res) => {
  try {
    const voteType = req.body.voteType as RankingVoteType;
    const attachedComment = cleanText(req.body?.comment, 600);
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const speakBlock = getSpeakBlockReason(profile);
    if (speakBlock) return res.status(403).json(err(new Error(speakBlock)));
    const voteBlock = reputationVoteBlockReason(profile);
    if (voteBlock) {
      return res.status(403).json(codedErr(
        new Error(voteBlock),
        'REPUTATION_IDENTITY_REQUIRED',
        { action_url: '/dashboard' },
      ));
    }
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
      if (message.includes('duplicate key') || message.includes('lc_votes_one_reputation_vote')) {
        const voteState = await getRankingVoteState(profile.id, req.params.id);
        const currentChannelVote = voteType === 'joy' ? voteState.myJoyVote : voteState.myVote;
        if (currentChannelVote?.vote_type === voteType) {
          return res.json(ok({
            ...voteState,
            unchanged: true,
          }));
        }
        return res.status(409).json({
          ...err(new Error('你已经投过票了，请刷新后撤销或改票')),
          data: voteState,
        });
      }
      return res.status(rankingVoteRpcStatus(message)).json(err(new Error(message || '投票失败')));
    }

    const row = firstRpcRow<RankingVoteRpcResult>(data);
    if (!row || !row.vote_id || !row.vote_type || !row.vote_created_at) throw new Error('投票结果为空');
    const voteState = await getRankingVoteState(profile.id, req.params.id);

    if (row.is_duplicate) {
      await logSecurityEvent(req, {
        action: 'ranking_vote_duplicate',
        targetType: 'ranking',
        targetId: req.params.id,
        metadata: { vote_type: voteType },
      });
      return res.json(ok({
        likes: row.likes,
        dislikes: row.dislikes,
        joys: row.joys,
        boost_amount: row.boost_amount,
        negative_boost_amount: row.negative_boost_amount,
        agree_count: row.agree_count,
        oppose_count: row.oppose_count,
        ...voteState,
        balance: row.balance,
        balanceDelta: 0,
        unchanged: true,
      }));
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
      metadata: {
        vote_type: voteType,
        identity_kind: reputationVoteIdentityKind(profile),
        balance_delta: row.balance_delta || 0,
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
      ...voteState,
      balance: row.balance,
      balanceDelta: row.balance_delta || 0,
      comment: attachedCommentId ? { id: attachedCommentId, status: 'pending' } : null,
      commentError: attachedCommentError || null,
    }));
  } catch (e) { res.status(500).json(err(e)); }
  },
);

app.delete('/api/lc/rankings/:id/vote', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const voteBlock = reputationVoteBlockReason(profile);
    if (voteBlock) {
      return res.status(403).json(codedErr(
        new Error(voteBlock),
        'REPUTATION_IDENTITY_REQUIRED',
        { action_url: '/dashboard' },
      ));
    }
    const voteType = cleanText(req.body?.voteType ?? req.query?.voteType, 20) as RankingVoteType;
    if (!['like', 'dislike', 'joy'].includes(voteType)) {
      return res.status(400).json(err(new Error('请选择要撤销的口碑票')));
    }

    const { data, error: cancelErr } = await supabase.rpc('lc_cancel_ranking_vote', {
      p_ranking_id: req.params.id,
      p_voter_id: profile.id,
      p_vote_type: voteType,
    });
    if (cancelErr) return res.status(rankingVoteRpcStatus(cancelErr.message || '')).json(err(new Error(cancelErr.message || '撤销失败')));

    const row = firstRpcRow<RankingVoteRpcResult>(data);
    if (!row) throw new Error('撤销结果为空');
    const voteState = await getRankingVoteState(profile.id, req.params.id);

    await logSecurityEvent(req, {
      action: 'ranking_vote_cancelled',
      targetType: 'ranking',
      targetId: req.params.id,
      metadata: { vote_type: voteType, identity_kind: reputationVoteIdentityKind(profile), refunded: row.refunded || 0 },
    });
    res.json(ok({
      likes: row.likes,
      dislikes: row.dislikes,
      joys: row.joys,
      boost_amount: row.boost_amount,
      negative_boost_amount: row.negative_boost_amount,
      agree_count: row.agree_count,
      oppose_count: row.oppose_count,
      ...voteState,
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

app.post(
  '/api/lc/rankings/:id/comments',
  authMiddleware,
  wechatMiniTextSafetyMiddleware({
    businessScene: 'ranking_comment_submit',
    targetType: 'ranking_comment',
    content: req => [req.body?.content],
  }),
  async (req, res) => {
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
  },
);

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

app.get('/api/lc/admin/rankings/:rankingId/evidence/:fileId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await supabase.from('lc_rankings')
      .select('id, private_evidence_files')
      .eq('id', req.params.rankingId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return res.status(404).json(err(new Error('榜单或审核材料不存在')));
    const file = internalRankingEvidenceFiles(result.data.private_evidence_files).find(item => item.id === req.params.fileId);
    if (!file) return res.status(404).json(err(new Error('审核材料不存在')));
    const body = readRankingEvidenceFile(PRIVATE_UPLOAD_ROOT, file.relative_path);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="ranking-evidence-${file.id}.jpg"`);
    res.send(body);
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/admin/rankings/:id/evidence/:fileId/public-copy', authMiddleware, adminMiddleware, upload.single('processedImage'), async (req, res) => {
  try {
    const result = await supabase.from('lc_rankings').select('*').eq('id', req.params.id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return res.status(404).json(err(new Error('帖子不存在')));
    const ranking = result.data as Record<string, unknown>;
    const privateFiles = internalRankingEvidenceFiles(ranking.private_evidence_files);
    const evidenceIndex = privateFiles.findIndex(file => file.id === req.params.fileId);
    if (evidenceIndex < 0) return res.status(404).json(err(new Error('审核材料不存在')));
    const evidence = privateFiles[evidenceIndex];
    const displayFiles = normalizeRankingDisplayFiles(ranking.display_files) as Array<{ name: string; url: string; type: string; size: number }>;
    let editActionsInput: unknown = [];
    try { editActionsInput = JSON.parse(String(req.body?.editActions || '[]')); } catch { editActionsInput = []; }
    let validatedPublicCopy: ReturnType<typeof validateRankingEvidencePublicCopy>;
    try {
      validatedPublicCopy = validateRankingEvidencePublicCopy({
        confirmed: String(req.body?.confirmed || '').toLowerCase() === 'true',
        processingNote: req.body?.processingNote,
        hasProcessedImage: !!req.file,
        publicImageCount: displayFiles.length,
        alreadyPublished: !!evidence.public_copy,
        editActions: editActionsInput,
      });
    } catch (validationError) {
      return res.status(400).json(err(validationError));
    }
    const { processingNote, editActions } = validatedPublicCopy;
    const processedFile = req.file!;
    const image = await sanitizeUploadedImageFile({ buffer: processedFile.buffer, mimetype: processedFile.mimetype });
    const digest = createHash('sha256').update(processedFile.buffer).digest('hex').slice(0, 16);
    const adminId = getReq(req, 'creatorId');
    const saved = await saveLingqiSanitizedUploadImage(image, `${adminId}/ranking-display-redacted`, {
      env: process.env,
      localUploadRoot: LOCAL_UPLOAD_ROOT,
      siteUrl: LINGQI_SITE_URL,
      randomId: () => `${Date.now()}-${digest}`,
      cosTransport: LINGQI_COS_UPLOAD_TRANSPORT,
    });
    const publishedAt = new Date().toISOString();
    const publicImage = {
      name: cleanText(processedFile.originalname, 120) || `处理后的${evidence.name}`,
      url: saved.url,
      type: image.contentType,
      size: image.buffer.length,
    };
    const nextPrivateFiles = privateFiles.map((file, index) => index === evidenceIndex ? {
      ...file,
      public_copy: {
        url: saved.url,
        published_at: publishedAt,
        published_by: adminId,
        processing_note: processingNote,
        edit_actions: editActions,
      },
    } : file);
    const nextDisplayFiles = [...displayFiles, publicImage];
    const { data: updated, error: updateErr } = await supabase.from('lc_rankings').update({
      display_files: nextDisplayFiles,
      private_evidence_files: nextPrivateFiles,
      ...(ranking.status === 'approved' ? { last_activity_at: publishedAt } : {}),
    }).eq('id', req.params.id).select('*').single();
    if (updateErr) throw updateErr;
    let audit = null;
    if (ranking.status === 'approved') {
      audit = await auditApprovedTarget('ranking', updated, 'ranking_private_evidence_redacted_copy_published', adminId, {
        before: auditPayload('ranking', ranking),
        after: auditPayload('ranking', updated),
        source_evidence_id: evidence.id,
        public_image: { name: publicImage.name, url: publicImage.url },
        processing_note: processingNote,
        edit_actions: editActions,
      });
    }
    await logSecurityEvent(req, {
      action: 'admin_ranking_private_evidence_redacted_copy_published',
      targetType: 'ranking',
      targetId: req.params.id,
      metadata: {
        source_evidence_id: evidence.id,
        public_image_url: publicImage.url,
        processing_note: processingNote,
        edit_actions: editActions,
        audit_entry_hash: audit?.entry_hash || null,
      },
    });
    res.json(ok({
      display_files: nextDisplayFiles,
      private_evidence_files: publicRankingEvidenceMetadata(nextPrivateFiles),
      audit,
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/rankings/:id/display-files/:index/private', authMiddleware, adminMiddleware, async (req, res) => {
  let savedFiles: RankingEvidenceFile[] = [];
  let committed = false;
  try {
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0) return res.status(400).json(err(new Error('配图序号不合法')));
    const result = await supabase.from('lc_rankings').select('*').eq('id', req.params.id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return res.status(404).json(err(new Error('帖子不存在')));
    const ranking = result.data as Record<string, unknown>;
    const displayFiles = normalizeRankingDisplayFiles(ranking.display_files) as Array<{ name: string; url: string; type: string; size: number }>;
    const target = displayFiles[index];
    if (!target) return res.status(404).json(err(new Error('正文配图不存在')));
    const privateFiles = internalRankingEvidenceFiles(ranking.private_evidence_files);
    const sourceEvidenceIndex = privateFiles.findIndex(file => file.public_copy?.url === target.url);
    if (sourceEvidenceIndex < 0 && privateFiles.length >= MAX_RANKING_EVIDENCE_FILES) return res.status(400).json(err(new Error(`审核材料最多上传${MAX_RANKING_EVIDENCE_FILES}张`)));

    if (sourceEvidenceIndex < 0) {
      const siteOrigin = new URL(LINGQI_SITE_URL).origin;
      const sourceUrl = new URL(target.url, LINGQI_SITE_URL);
      if (sourceUrl.origin !== siteOrigin) return res.status(400).json(err(new Error('只有本站上传的配图可以转为审核材料')));
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error('正文配图读取失败');
      const sourceBuffer = Buffer.from(await response.arrayBuffer());
      const image = await sanitizeUploadedImageFile({ buffer: sourceBuffer, mimetype: response.headers.get('content-type') || target.type });
      savedFiles = saveRankingEvidenceFiles({
        root: PRIVATE_UPLOAD_ROOT,
        rankingId: String(ranking.id),
        existingCount: privateFiles.length,
        files: [{ originalName: target.name, image }],
      });
    }
    const nextDisplayFiles = displayFiles.filter((_, fileIndex) => fileIndex !== index);
    const nextPrivateFiles = sourceEvidenceIndex >= 0
      ? privateFiles.map((file, fileIndex) => fileIndex === sourceEvidenceIndex ? { ...file, public_copy: null } : file)
      : [...privateFiles, ...savedFiles];
    const { data: updated, error: updateErr } = await supabase.from('lc_rankings').update({
      display_files: nextDisplayFiles,
      private_evidence_files: nextPrivateFiles,
    }).eq('id', req.params.id).select('*').single();
    if (updateErr) throw updateErr;
    committed = true;
    let audit = null;
    if (ranking.status === 'approved') {
      audit = await auditApprovedTarget('ranking', updated, 'ranking_public_image_moved_private', getReq(req, 'creatorId'), {
        before: auditPayload('ranking', ranking),
        after: auditPayload('ranking', updated),
        removed_public_image: { name: target.name, index, restored_source_evidence: sourceEvidenceIndex >= 0 },
      });
    }
    await logSecurityEvent(req, {
      action: 'admin_ranking_public_image_moved_private',
      targetType: 'ranking',
      targetId: req.params.id,
      metadata: { image_name: target.name, image_index: index, restored_source_evidence: sourceEvidenceIndex >= 0, audit_entry_hash: audit?.entry_hash || null },
    });
    res.json(ok({
      display_files: nextDisplayFiles,
      private_evidence_files: publicRankingEvidenceMetadata(nextPrivateFiles),
      audit,
    }));
  } catch (e) {
    if (!committed && savedFiles.length > 0) removeRankingEvidenceFiles(PRIVATE_UPLOAD_ROOT, savedFiles);
    res.status(500).json(err(e));
  }
});

app.post('/api/lc/admin/rankings/:id/legacy-evidence/:index/adopt', authMiddleware, adminMiddleware, async (req, res) => {
  let savedFiles: RankingEvidenceFile[] = [];
  let committed = false;
  try {
    const legacyIndex = Number(req.params.index);
    if (!Number.isInteger(legacyIndex) || legacyIndex < 0) return res.status(400).json(err(new Error('旧版材料序号不合法')));
    const result = await supabase.from('lc_rankings').select('id, files, private_evidence_files').eq('id', req.params.id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return res.status(404).json(err(new Error('帖子不存在')));
    const legacyFiles = normalizeRankingDisplayFiles(result.data.files) as Array<{ name: string; url: string; type: string; size: number }>;
    const target = legacyFiles[legacyIndex];
    if (!target) return res.status(404).json(err(new Error('旧版审核材料不存在')));
    const privateFiles = internalRankingEvidenceFiles(result.data.private_evidence_files);
    const existing = privateFiles.find(file => file.legacy_source?.index === legacyIndex && file.legacy_source?.url === target.url);
    if (existing) return res.json(ok({ file: publicRankingEvidenceMetadata([existing])[0], private_evidence_files: publicRankingEvidenceMetadata(privateFiles), adopted: false }));
    if (privateFiles.length >= MAX_RANKING_EVIDENCE_FILES) return res.status(400).json(err(new Error(`私密审核材料最多${MAX_RANKING_EVIDENCE_FILES}张`)));

    let sourceUrl: URL;
    try { sourceUrl = resolveLegacyRankingEvidenceSourceUrl(target.url, LINGQI_SITE_URL); }
    catch (sourceError) { return res.status(400).json(err(sourceError)); }
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error('旧版审核材料读取失败');
    const sourceBuffer = Buffer.from(await response.arrayBuffer());
    const image = await sanitizeUploadedImageFile({ buffer: sourceBuffer, mimetype: response.headers.get('content-type') || target.type });
    savedFiles = saveRankingEvidenceFiles({
      root: PRIVATE_UPLOAD_ROOT,
      rankingId: String(result.data.id),
      existingCount: privateFiles.length,
      files: [{ originalName: target.name, image }],
    });
    const adminId = getReq(req, 'creatorId');
    const adoptedAt = new Date().toISOString();
    const adopted = {
      ...savedFiles[0],
      legacy_source: { index: legacyIndex, url: target.url, adopted_at: adoptedAt, adopted_by: adminId },
    };
    const nextPrivateFiles = [...privateFiles, adopted];
    const updateResult = await supabase.from('lc_rankings').update({ private_evidence_files: nextPrivateFiles }).eq('id', req.params.id);
    if (updateResult.error) throw updateResult.error;
    committed = true;
    await logSecurityEvent(req, {
      action: 'admin_ranking_legacy_evidence_adopted',
      targetType: 'ranking',
      targetId: req.params.id,
      metadata: { legacy_index: legacyIndex, legacy_url: target.url, evidence_id: adopted.id },
    });
    res.json(ok({ file: publicRankingEvidenceMetadata([adopted])[0], private_evidence_files: publicRankingEvidenceMetadata(nextPrivateFiles), adopted: true }));
  } catch (e) {
    if (!committed && savedFiles.length > 0) removeRankingEvidenceFiles(PRIVATE_UPLOAD_ROOT, savedFiles);
    res.status(500).json(err(e));
  }
});

app.put('/api/lc/admin/rankings/batch-approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ids = Array.from(new Set((Array.isArray(req.body?.ids) ? req.body.ids : [])
      .map((item: unknown) => cleanText(item, 80))
      .filter(Boolean)))
      .slice(0, 50);
    if (ids.length === 0) return res.status(400).json(err(new Error('请选择要批量通过的帖子')));
    const result = await supabase.from('lc_rankings').select('*').in('id', ids).eq('status', 'pending');
    if (result.error) throw result.error;
    const approvedIds: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];
    for (const row of (result.data || []) as Record<string, unknown>[]) {
      const rowId = cleanText(row.id, 80);
      const precheck = objectPayload(row.moderation_precheck);
      if (precheck.decision !== 'pass') {
        skipped.push({ id: rowId, reason: '本地预审不是直接通过' });
        continue;
      }
      if (row.dm_employment_status_suggestion) {
        skipped.push({ id: rowId, reason: '包含DM任职关系修改' });
        continue;
      }
      try {
        await assertWechatImageChecksAllowApproval(collectPotentialPublicImageUrls(row.display_files));
        if (['dm', 'store'].includes(cleanText(row.subject_type, 40))) {
          if (!row.subject_dossier_id) throw new Error('尚未关联公开档案');
          await findRankingDossier(row.subject_dossier_id, row.subject_type as 'dm' | 'store');
        }
        const nextType = cleanText(row.type, 20);
        const now = new Date().toISOString();
        const patch: Record<string, unknown> = {
          status: 'approved',
          reject_reason: null,
          evidence_required: false,
          revision_kind: null,
          revision_requested_at: null,
          boost_amount: nextType === 'red' ? Number(row.initial_amount || 0) : 0,
          negative_boost_amount: 0,
          agree_count: 0,
          oppose_count: 0,
          likes: nextType === 'red' ? Number(row.initial_amount || 0) : 0,
          dislikes: 0,
          joys: 0,
          last_activity_at: now,
        };
        if (nextType === 'black') patch.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const updateResult = await supabase.from('lc_rankings').update(patch).eq('id', rowId).eq('status', 'pending').select('*').single();
        if (updateResult.error) throw updateResult.error;
        await ensureInitialRankingVersion(updateResult.data as Record<string, unknown>, getReq(req, 'creatorId'));
        const audit = await auditApprovedTarget('ranking', updateResult.data, 'ranking_batch_approved', getReq(req, 'creatorId'));
        await runReferralSideEffect('stage2-after-ranking-approved', () => maybeAwardReferralStage2(updateResult.data?.poster_id, 'ranking_approved'));
        await logSecurityEvent(req, {
          action: 'admin_ranking_batch_approved',
          targetType: 'ranking',
          targetId: rowId,
          metadata: { audit_entry_hash: audit?.entry_hash || null },
        });
        approvedIds.push(rowId);
      } catch (approvalError) {
        skipped.push({ id: rowId, reason: getErrorText(approvalError) || '批量通过失败' });
      }
    }
    res.json(ok({ approved_ids: approvedIds, skipped }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/rankings/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const targetType = ['red', 'black', 'white'].includes(req.body?.targetType) ? req.body.targetType : null;
    const { data: r } = await supabase.from('lc_rankings').select('type, initial_amount, subject_type, subject_dossier_id, dm_employment_status_suggestion, dm_employer_store_id_suggestion, display_files').eq('id', req.params.id).single();
    if (!r) return res.status(404).json(err(new Error('帖子不存在')));
    await assertWechatImageChecksAllowApproval(collectPotentialPublicImageUrls(r.display_files));
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
      last_activity_at: new Date().toISOString(),
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
    await ensureInitialRankingVersion(approved as Record<string, unknown>, getReq(req, 'creatorId'));
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
    if (before.status === 'approved') patch.last_activity_at = new Date().toISOString();
    if (before.status === 'approved') await ensureInitialRankingVersion(before as Record<string, unknown>, getReq(req, 'creatorId'));

    const { data: updated, error: updErr } = await supabase.from('lc_rankings')
      .update(patch)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (updErr) throw updErr;

    const changes = buildRankingChanges(before, updated, changedFields);
    if (before.status === 'approved') {
      await appendRankingVersion({
        row: updated as Record<string, unknown>,
        source: 'admin_edit',
        changes,
        actorId: getReq(req, 'creatorId'),
      });
    }
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

app.put('/api/lc/admin/ranking-edits/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (useTencentPg) {
      const reviewerId = getReq(req, 'creatorId');
      const finalized = await finalizeRankingEditRequestOnTencent(req.params.id, reviewerId);
      const audit = await auditApprovedTarget(
        'ranking',
        finalized.updated,
        finalized.requestKind === 'restore' ? 'ranking_restore_approved' : 'ranking_author_edit_approved',
        reviewerId,
        { edit_request_id: req.params.id, before: finalized.beforeSnapshot, after: auditPayload('ranking', finalized.updated), changes: finalized.changes },
      );
      await logSecurityEvent(req, {
        action: finalized.requestKind === 'restore' ? 'admin_ranking_restore_approved' : 'admin_ranking_author_edit_approved',
        targetType: 'ranking',
        targetId: String(finalized.ranking.id),
        metadata: { edit_request_id: req.params.id, audit_entry_hash: audit?.entry_hash || null },
      });
      return res.json(ok({ item: finalized.updated, changes: finalized.changes, audit }));
    }
    const requestResult = await supabase.from('lc_ranking_edit_requests')
      .select('*')
      .eq('id', req.params.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (requestResult.error) throw requestResult.error;
    const editRequest = requestResult.data as Record<string, unknown> | null;
    if (!editRequest) return res.status(404).json(err(new Error('修改或恢复申请不存在，或已经处理过')));
    const rankingResult = await supabase.from('lc_rankings')
      .select('*')
      .eq('id', editRequest.ranking_id)
      .maybeSingle();
    if (rankingResult.error) throw rankingResult.error;
    const ranking = rankingResult.data as Record<string, unknown> | null;
    if (!ranking) return res.status(404).json(err(new Error('原帖不存在')));
    if (ranking.poster_id !== editRequest.author_id) return res.status(409).json(err(new Error('申请人与原发布人不一致，已停止处理')));

    const reviewerId = getReq(req, 'creatorId');
    const now = new Date().toISOString();
    const requestKind = String(editRequest.request_kind || 'edit');
    const beforeSnapshot = objectPayload(editRequest.before_snapshot);
    let updated: Record<string, unknown>;
    let changes: unknown[] = [];

    if (requestKind === 'restore') {
      if (ranking.status !== 'withdrawn') return res.status(409).json(err(new Error('原帖当前不是已下架状态，不能恢复')));
      await ensureInitialRankingVersion({ ...ranking, status: 'approved' }, editRequest.author_id as string);
      const restorePatch: Record<string, unknown> = {
        status: 'approved',
        withdrawn_at: null,
        withdrawn_by: null,
        withdrawal_reason: null,
        last_activity_at: now,
      };
      if (ranking.type === 'black') restorePatch.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const updateResult = await supabase.from('lc_rankings')
        .update(restorePatch)
        .eq('id', ranking.id)
        .eq('status', 'withdrawn')
        .select('*')
        .single();
      if (updateResult.error) throw updateResult.error;
      updated = updateResult.data as Record<string, unknown>;
      changes = [{ field: 'status', label: '公开状态', before: 'withdrawn', after: 'approved' }];
      await appendRankingVersion({ row: updated, source: 'restore', changes, actorId: reviewerId, editRequestId: req.params.id });
    } else {
      if (ranking.status !== 'approved') return res.status(409).json(err(new Error('原帖已不在公开状态，不能应用修改')));
      const staleFields = RANKING_AUTHOR_EDITABLE_FIELDS.filter(field => !auditValuesEqual(ranking[field], beforeSnapshot[field]));
      if (staleFields.length > 0) {
        return res.status(409).json(err(new Error('原帖在申请后又发生了变化，请驳回本次申请并让发布人重新提交')));
      }
      const proposedPatch = objectPayload(editRequest.proposed_patch);
      const assessment = assessRankingAuthorEdit(ranking, proposedPatch);
      if (!assessment.allowed) return res.status(409).json(err(new Error(assessment.reason || '修改已不符合当前规则')));
      await ensureInitialRankingVersion(ranking, editRequest.author_id as string);
      const updateResult = await supabase.from('lc_rankings')
        .update({ ...assessment.patch, last_activity_at: now })
        .eq('id', ranking.id)
        .eq('status', 'approved')
        .select('*')
        .single();
      if (updateResult.error) throw updateResult.error;
      updated = updateResult.data as Record<string, unknown>;
      changes = assessment.changes;
      await appendRankingVersion({ row: updated, source: 'author_edit', changes, actorId: editRequest.author_id as string, editRequestId: req.params.id });
    }

    const requestUpdate = await supabase.from('lc_ranking_edit_requests').update({
      status: 'approved',
      reject_reason: null,
      reviewed_by: reviewerId,
      reviewed_at: now,
      updated_at: now,
    }).eq('id', req.params.id).eq('status', 'pending');
    if (requestUpdate.error) throw requestUpdate.error;
    const audit = await auditApprovedTarget(
      'ranking',
      updated,
      requestKind === 'restore' ? 'ranking_restore_approved' : 'ranking_author_edit_approved',
      reviewerId,
      { edit_request_id: req.params.id, before: beforeSnapshot, after: auditPayload('ranking', updated), changes },
    );
    await logSecurityEvent(req, {
      action: requestKind === 'restore' ? 'admin_ranking_restore_approved' : 'admin_ranking_author_edit_approved',
      targetType: 'ranking',
      targetId: String(ranking.id),
      metadata: { edit_request_id: req.params.id, audit_entry_hash: audit?.entry_hash || null },
    });
    res.json(ok({ item: updated, changes, audit }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/ranking-edits/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = cleanText(req.body?.rejectReason ?? req.body?.reason, 500);
    if (rejectReason.length < 2) return res.status(400).json(err(new Error('请填写驳回原因')));
    const now = new Date().toISOString();
    const requestResult = await supabase.from('lc_ranking_edit_requests')
      .update({
        status: 'rejected',
        reject_reason: rejectReason,
        reviewed_by: getReq(req, 'creatorId'),
        reviewed_at: now,
        updated_at: now,
      })
      .eq('id', req.params.id)
      .eq('status', 'pending')
      .select('id, ranking_id, request_kind')
      .single();
    if (requestResult.error) throw requestResult.error;
    await logSecurityEvent(req, {
      action: requestResult.data?.request_kind === 'restore' ? 'admin_ranking_restore_rejected' : 'admin_ranking_author_edit_rejected',
      targetType: 'ranking',
      targetId: String(requestResult.data?.ranking_id || ''),
      metadata: { edit_request_id: req.params.id, reason: rejectReason },
    });
    res.json(ok());
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
    if (approved?.is_pinned && approved?.ranking_id) {
      const touchResult = await supabase.from('lc_rankings')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', approved.ranking_id)
        .eq('status', 'approved');
      if (touchResult.error) throw touchResult.error;
    }
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
      } else if (report.target_type === 'dm_affiliation') {
        await supabase.from('lc_dm_store_affiliations')
          .update({ status: 'rejected', reject_reason: rejectReason, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
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

async function loadDailyCheckinState(profileId: string) {
  const today = getChinaNow().date;
  const yesterdayDate = new Date(`${today}T00:00:00.000Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  const [checkinResult, profileResult, transactionResult] = await Promise.all([
    supabase.from('lc_daily_checkins')
      .select('id, checkin_date, streak, daily_reward, streak_bonus, reward, created_at')
      .eq('profile_id', profileId)
      .order('checkin_date', { ascending: false })
      .limit(31),
    supabase.from('lc_profiles')
      .select('balance, bonus_balance')
      .eq('id', profileId)
      .single(),
    supabase.from('lc_transactions')
      .select('id, amount, description, metadata, created_at')
      .eq('profile_id', profileId)
      .eq('ref_type', 'daily_checkin')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  if (checkinResult.error) throw checkinResult.error;
  if (profileResult.error) throw profileResult.error;
  if (transactionResult.error) throw transactionResult.error;
  const checkins = (checkinResult.data || []) as Array<Record<string, unknown>>;
  const latest = checkins[0];
  const latestDate = dateText(latest?.checkin_date);
  return {
    today,
    checked_in: latestDate === today,
    current_streak: latestDate === today || latestDate === yesterday ? Number(latest?.streak || 0) : 0,
    balance: Number(profileResult.data?.balance || 0),
    bonus_balance: Number(profileResult.data?.bonus_balance || 0),
    checkins,
    transactions: transactionResult.data || [],
  };
}

app.get('/api/lc/daily-checkin', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    res.json(ok(await loadDailyCheckinState(profile.id)));
  } catch (e) {
    if (isMissingRelation(e, 'lc_daily_checkins')) return res.status(503).json(err(new Error('每日签到尚未初始化')));
    res.status(500).json(err(e));
  }
});

app.post('/api/lc/daily-checkin', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data, error: claimError } = await supabase.rpc('lc_claim_daily_checkin', {
      p_profile_id: profile.id,
    });
    if (claimError) throw claimError;
    const claim = firstRpcRow(data as DailyCheckinClaimResult | DailyCheckinClaimResult[] | null);
    await logSecurityEvent(req, {
      action: claim?.applied ? 'daily_checkin_claimed' : 'daily_checkin_duplicate',
      targetType: 'daily_checkin',
      targetId: claim?.checkin_id || null,
      metadata: {
        checkin_date: claim?.checkin_date || getChinaNow().date,
        streak: claim?.streak || 0,
        reward: claim?.reward || 0,
      },
    });
    res.json(ok({ claim, ...(await loadDailyCheckinState(profile.id)) }));
  } catch (e) {
    if (isMissingRelation(e, 'lc_daily_checkins')) return res.status(503).json(err(new Error('每日签到尚未初始化')));
    res.status(500).json(err(e));
  }
});

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
    if (!amount || amount < 10) return res.status(400).json(err(new Error('充值金额最低 10 榜金')));
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: tx, error: txErr } = await supabase.from('lc_transactions').insert({
      profile_id: profile.id, type: 'recharge', amount: parseInt(amount),
      description: '榜金充值', payment_proof: paymentProof || null,
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
      description: `支付宝充值 · ${amount} 榜金`,
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
      description: `微信支付充值 · ${amount} 榜金`,
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
    const servicePayment = await confirmServicePayment({
      outTradeNo,
      transactionId,
      totalFee,
      currency: String(amount.currency || ''),
      appId: String(transaction.appid || ''),
      mchId: String(transaction.mchid || ''),
      payerOpenid: cleanText((transaction.payer as Record<string, unknown> | null)?.openid, 120),
      payload,
    });
    if (servicePayment) {
      if (servicePayment.newlyPaid) {
        await notifyProfile({
          profileId: servicePayment.profile_id,
          type: 'service_payment_succeeded',
          title: '支付成功',
          content: `${serviceProductDescription(servicePayment.product_type)}已支付成功，权益已经生效。`,
          relatedType: servicePayment.product_type,
          relatedId: servicePayment.target_id,
        });
      }
      await logSecurityEvent(req, {
        action: servicePayment.duplicatePaid ? 'service_payment_duplicate_paid' : 'service_payment_notify_paid',
        targetType: servicePayment.product_type,
        targetId: servicePayment.target_id,
        actorRole: 'wechat_pay',
        metadata: {
          purchase_id: servicePayment.purchase_id,
          out_trade_no: outTradeNo,
          transaction_id: transactionId,
          amount_fen: totalFee,
          newly_paid: servicePayment.newlyPaid,
        },
      });
      return res.status(204).send();
    }
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

app.get('/api/lc/dossier-references/search', async (req, res) => {
  try {
    const q = cleanText(req.query.q, 60);
    let profileQuery = supabase.from('lc_profiles')
      .select('id, display_name, city')
      .eq('is_visible', true)
      .order('display_name')
      .limit(8);
    let dossierQuery = supabase.from('lc_dm_dossiers')
      .select('id, dm_name, city, entity_type, tags')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false, nullsFirst: false })
      .limit(120);
    if (q) {
      profileQuery = profileQuery.ilike('display_name', `%${q}%`);
      dossierQuery = dossierQuery.ilike('dm_name', `%${q}%`);
    }
    const [profileResult, dossierResult, tagDossierResult, entityTagResult] = await Promise.all([
      profileQuery,
      dossierQuery,
      supabase.from('lc_dm_dossiers').select('tags').eq('status', 'approved').limit(500),
      supabase.from('lc_entity_tags').select('tag, likes').eq('status', 'approved').order('likes', { ascending: false }).limit(200),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (dossierResult.error) throw dossierResult.error;
    if (tagDossierResult.error) throw tagDossierResult.error;
    if (entityTagResult.error && !isMissingRelation(entityTagResult.error, 'lc_entity_tags')) throw entityTagResult.error;
    const entities = [
      ...(dossierResult.data || []).slice(0, 12).map(row => ({
        id: row.id,
        name: row.dm_name,
        type: row.entity_type === 'store' ? 'store' : 'dm',
        city: row.city || null,
      })),
      ...(profileResult.data || []).map(row => ({ id: row.id, name: row.display_name, type: 'profile', city: row.city || null })),
    ].slice(0, 16);
    const normalizedQuery = q.toLowerCase();
    const tagCounts = new Map<string, { name: string; score: number }>();
    const addTag = (value: unknown, score = 0) => {
      const name = cleanText(value, 24);
      if (!name || (normalizedQuery && !name.toLowerCase().includes(normalizedQuery))) return;
      const key = name.toLowerCase();
      const current = tagCounts.get(key);
      tagCounts.set(key, { name: current?.name || name, score: (current?.score || 0) + score + 1 });
    };
    (tagDossierResult.data || []).forEach(row => cleanTextArray(row.tags, 10, 24).forEach(tag => addTag(tag, 1)));
    if (!entityTagResult.error) (entityTagResult.data || []).forEach(row => addTag(row.tag, Number(row.likes || 0)));
    const tags = Array.from(tagCounts.values())
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'zh-CN'))
      .slice(0, 12)
      .map(item => item.name);
    res.json(ok({ entities, tags }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/profiles/search', async (req, res) => {
  try {
    const q = cleanText(req.query.q, 80);
    if (!q) return res.json(ok([]));
    const result = await supabase.from('lc_profiles')
      .select('id, display_name, city, avatar')
      .eq('is_visible', true)
      .ilike('display_name', `%${q}%`)
      .order('display_name')
      .limit(20);
    if (result.error) throw result.error;
    res.json(ok((result.data || []).map(profile => ({
      id: profile.id,
      name: profile.display_name,
      city: profile.city || null,
      avatar: profile.avatar || null,
    }))));
  } catch (e) { res.status(500).json(err(e)); }
});

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
      .select('*, lc_profiles!inner(display_name)')
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

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(error);
  const message = error instanceof Error ? error.message : String(error || '');
  if (error instanceof multer.MulterError) {
    const multerError = error as multer.MulterError;
    const status = multerError.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json(err(new Error(multerError.code === 'LIMIT_FILE_SIZE' ? '文件不能超过 10MB' : '上传内容不符合要求')));
  }
  if (/request entity too large/i.test(message)) {
    return res.status(413).json(err(new Error('提交内容过大')));
  }
  if (/CORS origin denied/i.test(message)) {
    return res.status(403).json(err(new Error('当前来源不允许访问此接口')));
  }
  if (error instanceof SyntaxError) {
    return res.status(400).json(err(new Error('请求内容格式不正确')));
  }
  console.error('[api] unhandled middleware error', message);
  return res.status(500).json(err({ code: 'INTERNAL_ERROR', message }));
});

export default app;
