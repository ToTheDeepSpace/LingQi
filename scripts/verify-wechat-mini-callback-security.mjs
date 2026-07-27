import { createHash, randomBytes } from 'node:crypto';

const token = String(process.env.LINGQI_WECHAT_MINI_MSG_TOKEN || '').trim();
const callbackUrl = String(
  process.env.WECHAT_MINI_EVENT_URL
  || `${String(process.env.LINGQI_SITE_URL || 'https://jumulu.jusichen.com').replace(/\/+$/, '')}/api/wechat/mini/events`,
).trim();

if (!token) throw new Error('LINGQI_WECHAT_MINI_MSG_TOKEN is required');

async function probe(timestampSeconds) {
  const timestamp = String(timestampSeconds);
  const nonce = randomBytes(12).toString('hex');
  const echostr = randomBytes(16).toString('hex');
  const signature = createHash('sha1')
    .update([token, timestamp, nonce].sort().join(''))
    .digest('hex');
  const url = new URL(callbackUrl);
  url.search = new URLSearchParams({ timestamp, nonce, signature, echostr }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  return {
    status: response.status,
    bodyMatches: await response.text() === echostr,
  };
}

const nowSeconds = Math.floor(Date.now() / 1000);
const fresh = await probe(nowSeconds);
const stale = await probe(nowSeconds - 11 * 60);

if (fresh.status !== 200 || !fresh.bodyMatches) {
  throw new Error(`Fresh callback signature was rejected with HTTP ${fresh.status}`);
}
if (stale.status !== 403) {
  throw new Error(`Stale callback signature was not rejected; received HTTP ${stale.status}`);
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  callback_url: callbackUrl,
  fresh_status: fresh.status,
  stale_status: stale.status,
})}\n`);
