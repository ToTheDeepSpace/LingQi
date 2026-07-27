import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;
const apiBase = String(process.env.LINGQI_INTERNAL_API_BASE || 'http://127.0.0.1:3002/api').replace(/\/+$/, '');
const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;
const imageUrl = String(process.env.WECHAT_TEST_IMAGE_URL || '').trim();
const miniAppId = process.env.LINGQI_WECHAT_MINI_APP_ID;
const miniAppSecret = process.env.LINGQI_WECHAT_MINI_APP_SECRET;
const imageCallbackWaitMs = Math.max(10_000, Number(process.env.WECHAT_IMAGE_CALLBACK_WAIT_MS || 31 * 60_000));

if (!databaseUrl || !jwtSecret) {
  throw new Error('DATABASE_URL and JWT_SECRET are required');
}

const pool = new Pool({ connectionString: databaseUrl });

async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyImageCallback(profile) {
  if (!imageUrl) return null;
  if (!miniAppId || !miniAppSecret) {
    throw new Error('LINGQI_WECHAT_MINI_APP_ID and LINGQI_WECHAT_MINI_APP_SECRET are required for image verification');
  }

  const tokenUrl = new URL('https://api.weixin.qq.com/cgi-bin/token');
  tokenUrl.search = new URLSearchParams({
    grant_type: 'client_credential',
    appid: miniAppId,
    secret: miniAppSecret,
  }).toString();
  const tokenResponse = await fetch(tokenUrl, { signal: AbortSignal.timeout(15_000) });
  const tokenPayload = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error(`WeChat access token request failed: ${JSON.stringify({
      errcode: tokenPayload.errcode,
      errmsg: tokenPayload.errmsg,
    })}`);
  }

  const submissionResponse = await fetch(
    `https://api.weixin.qq.com/wxa/media_check_async?access_token=${encodeURIComponent(tokenPayload.access_token)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        media_url: imageUrl,
        media_type: 2,
        version: 2,
        scene: 1,
        openid: profile.wechat_mini_openid,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const submission = await submissionResponse.json();
  if (!submissionResponse.ok || Number(submission.errcode || 0) !== 0 || !submission.trace_id) {
    throw new Error(`WeChat image check submission failed: ${JSON.stringify({
      errcode: submission.errcode,
      errmsg: submission.errmsg,
    })}`);
  }

  const resourceHash = createHash('sha256').update(imageUrl).digest('hex');
  const auditResult = await pool.query(
    `insert into lc_wechat_content_checks
       (profile_id, check_type, business_scene, target_type, resource_hash, status, trace_id, errcode)
     values ($1, 'image', 'production_acceptance_image', 'preflight', $2, 'pending', $3, 0)
     returning id, status, trace_id, created_at`,
    [profile.id, resourceHash, submission.trace_id],
  );
  const audit = auditResult.rows[0];
  const deadline = Date.now() + imageCallbackWaitMs;
  while (Date.now() < deadline) {
    const statusResult = await pool.query(
      `select status, suggest, label, errcode, checked_at
       from lc_wechat_content_checks
       where id = $1`,
      [audit.id],
    );
    const current = statusResult.rows[0];
    if (current?.status !== 'pending') {
      if (current.status !== 'pass') {
        throw new Error(`Image callback completed without a pass verdict: ${JSON.stringify(current)}`);
      }
      return {
        audit_id: audit.id,
        audit_status: current.status,
        checked_at: current.checked_at,
      };
    }
    await sleep(2_000);
  }
  throw new Error(`Image check was accepted but no callback arrived within ${imageCallbackWaitMs}ms; WeChat documents a delivery window of up to 30 minutes; audit_id=${audit.id}`);
}

try {
  const profileResult = await pool.query(
    `select id, role, session_version, wechat_mini_openid
     from lc_profiles
     where wechat_mini_openid is not null
       and wechat_mini_openid <> ''
       and merged_into is null
     order by wechat_bound_at desc nulls last, created_at desc
     limit 1`,
  );
  const profile = profileResult.rows[0];
  if (!profile) throw new Error('No active WeChat miniapp profile is available for verification');

  const authToken = jwt.sign({
    creatorId: String(profile.id),
    role: String(profile.role || '').toLowerCase() === 'admin' ? 'admin' : 'creator',
    sessionVersion: Number(profile.session_version || 1),
    authClient: 'wechat-miniapp',
  }, jwtSecret, { expiresIn: '5m' });

  const marker = `剧幕录微信内容安全生产验收 ${new Date().toISOString()}`;
  const response = await fetch(`${apiBase}/lc/miniapp/content-check`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${authToken}`,
      'content-type': 'application/json',
      'x-lc-client': 'wechat-miniapp',
    },
    body: JSON.stringify({
      content: marker,
      scene: 'production_acceptance',
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success || payload?.data?.checked !== true) {
    throw new Error(`Content check failed with HTTP ${response.status}: ${JSON.stringify(payload)}`);
  }

  const resourceHash = createHash('sha256').update(marker).digest('hex');
  const auditResult = await pool.query(
    `select id, status, check_type, business_scene, checked_at
     from lc_wechat_content_checks
     where profile_id = $1
       and resource_hash = $2
     order by created_at desc
     limit 1`,
    [profile.id, resourceHash],
  );
  const audit = auditResult.rows[0];
  if (!audit || audit.status !== 'pass' || audit.check_type !== 'text') {
    throw new Error(`Expected a passed text audit row, received: ${JSON.stringify(audit || null)}`);
  }
  const imageVerification = await verifyImageCallback(profile);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    http_status: response.status,
    audit_id: audit.id,
    audit_status: audit.status,
    business_scene: audit.business_scene,
    checked_at: audit.checked_at,
    image: imageVerification,
  })}\n`);
} finally {
  await pool.end();
}
