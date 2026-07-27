import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;
const apiBase = String(process.env.LINGQI_INTERNAL_API_BASE || 'http://127.0.0.1:3002/api').replace(/\/+$/, '');
const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (!databaseUrl || !jwtSecret) {
  throw new Error('DATABASE_URL and JWT_SECRET are required');
}

const pool = new Pool({ connectionString: databaseUrl });

try {
  const profileResult = await pool.query(
    `select id, role, session_version
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

  process.stdout.write(`${JSON.stringify({
    ok: true,
    http_status: response.status,
    audit_id: audit.id,
    audit_status: audit.status,
    business_scene: audit.business_scene,
    checked_at: audit.checked_at,
  })}\n`);
} finally {
  await pool.end();
}
