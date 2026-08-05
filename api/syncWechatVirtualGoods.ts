import {
  WECHAT_VIRTUAL_SANDBOX_GOOD,
  WECHAT_VIRTUAL_GOODS,
  normalizeWechatVirtualPayEnv,
  requestWechatXpay,
  type WechatVirtualPayEnv,
} from './wechatVirtualPayment.js';

const appId = process.env.LINGQI_WECHAT_MINI_APP_ID || process.env.WECHAT_MINI_APP_ID || '';
const appSecret = process.env.LINGQI_WECHAT_MINI_APP_SECRET || process.env.WECHAT_MINI_APP_SECRET || '';
const env = normalizeWechatVirtualPayEnv(
  process.argv.find(arg => arg.startsWith('--env='))?.split('=')[1]
    ?? process.env.LINGQI_WECHAT_VIRTUAL_PAY_ENV,
);
const appKey = env === 1
  ? process.env.LINGQI_WECHAT_VIRTUAL_PAY_SANDBOX_APP_KEY || ''
  : process.env.LINGQI_WECHAT_VIRTUAL_PAY_APP_KEY || '';
const siteUrl = (process.env.LINGQI_SITE_URL || 'https://jumulu.jusichen.com').replace(/\/$/, '');

function requireConfig() {
  const missing = [
    !appId && 'LINGQI_WECHAT_MINI_APP_ID',
    !appSecret && 'LINGQI_WECHAT_MINI_APP_SECRET',
    !appKey && (env === 1 ? 'LINGQI_WECHAT_VIRTUAL_PAY_SANDBOX_APP_KEY' : 'LINGQI_WECHAT_VIRTUAL_PAY_APP_KEY'),
  ].filter(Boolean);
  if (missing.length) throw new Error(`缺少环境变量：${missing.join(', ')}`);
}

async function getAccessToken() {
  const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
  url.search = new URLSearchParams({
    grant_type: 'client_credential',
    appid: appId,
    secret: appSecret,
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  const payload = await response.json() as {
    access_token?: string;
    errcode?: number;
    errmsg?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.errmsg || '获取微信 access_token 失败');
  }
  return payload.access_token;
}

function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function requestXpayWithBackoff<T extends Record<string, unknown>>(
  action: string,
  request: () => Promise<T>,
) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      const errcode = Number((error as { errcode?: number })?.errcode);
      const message = error instanceof Error ? error.message : String(error);
      const retryable = errcode === -1 || errcode === 45009 || message.includes('频率限制');
      if (!retryable || attempt === 3) throw error;
      await sleep([2_000, 5_000, 10_000][attempt]);
    }
  }
  throw lastError || new Error(`微信虚拟道具${action}失败`);
}

async function waitForTask(
  accessToken: string,
  uri: '/xpay/query_upload_goods' | '/xpay/query_publish_goods',
  action: '上传' | '发布',
) {
  await sleep(2_000);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const payload = await requestXpayWithBackoff(action, () => requestWechatXpay({
        accessToken,
        appKey,
        uri,
        body: { env },
      }));
    const status = Number(payload.status);
    if (status === 3) return;
    if (status === 2) {
      const itemKey = action === '上传' ? 'upload_item' : 'publish_item';
      const itemStatusKey = action === '上传' ? 'upload_status' : 'publish_status';
      const items = Array.isArray(payload[itemKey])
        ? payload[itemKey] as Record<string, unknown>[]
        : [];
      if (
        items.length > 0
        && items.every(item => [1, 2].includes(Number(item[itemStatusKey])))
      ) return;
      const detail = items.map(item => ({
        id: item.id,
        status: item[itemStatusKey],
        errmsg: item.errmsg,
      }));
      throw new Error(`微信虚拟道具${action}失败：${JSON.stringify(detail)}`);
    }
    await sleep(2_000);
  }
  throw new Error(`微信虚拟道具${action}超时，请稍后查询任务状态`);
}

async function syncGood(
  accessToken: string,
  good: (typeof WECHAT_VIRTUAL_GOODS)[keyof typeof WECHAT_VIRTUAL_GOODS],
  targetEnv: WechatVirtualPayEnv,
) {
  await requestXpayWithBackoff('上传', () => requestWechatXpay({
    accessToken,
    appKey,
    uri: '/xpay/start_upload_goods',
    body: {
      upload_item: [{
        id: good.id,
        name: good.name,
        price: good.price,
        remark: good.remark,
        item_url: `${siteUrl}/api/wechat/virtual-pay/goods-image`,
      }],
      env: targetEnv,
    },
  }));
  await waitForTask(accessToken, '/xpay/query_upload_goods', '上传');

  await requestXpayWithBackoff('发布', () => requestWechatXpay({
    accessToken,
    appKey,
    uri: '/xpay/start_publish_goods',
    body: {
      publish_item: [{ id: good.id }],
      env: targetEnv,
    },
  }));
  await waitForTask(accessToken, '/xpay/query_publish_goods', '发布');
  process.stdout.write(`已同步：${good.id} ${good.name} ${good.price}分\n`);
}

async function main() {
  requireConfig();
  const accessToken = await getAccessToken();
  const goods = env === 1
    ? [WECHAT_VIRTUAL_SANDBOX_GOOD]
    : Object.values(WECHAT_VIRTUAL_GOODS);
  for (const good of goods) {
    await syncGood(accessToken, good, env);
    await sleep(2_000);
  }
  process.stdout.write(`微信虚拟道具同步完成，环境 env=${env}\n`);
}

main().catch(error => {
  const errcode = Number((error as { errcode?: number })?.errcode);
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${Number.isFinite(errcode) && errcode ? `[${errcode}] ` : ''}${detail}\n`);
  process.exitCode = 1;
});
