import type { Express, Request, RequestHandler, Response } from 'express';
import { recipientHash, type NotifyConfig, type NotifyPool, type NotifySql } from './wechatNotifications.js';

type Identity = { id: string; miniapp: boolean; merged: boolean };
type Dependencies = {
  pool: NotifyPool; config: NotifyConfig; auth: RequestHandler; rateLimit: RequestHandler;
  getIdentity(req: Request): Identity | null;
  error(error: unknown): unknown;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

export function registerWechatNotificationRoutes(app: Express, deps: Dependencies) {
  function identity(req: Request, miniapp = false) {
    const user = deps.getIdentity(req);
    if (!user) throw fail('请先登录', 401);
    if (user.merged) throw fail('账号已合并，请重新登录', 401);
    if (miniapp && !user.miniapp) throw fail('请在微信小程序重新登录后订阅提醒', 403);
    return user;
  }
  async function binding(db: NotifySql, id: string) {
    const row = (await db.query('select wechat_mini_openid,merged_into from lc_profiles where id=$1', [id])).rows[0];
    if (!row?.wechat_mini_openid || row.merged_into) throw fail('请先在微信小程序登录并绑定当前账号', 403);
    return recipientHash(String(row.wechat_mini_openid));
  }
  function configured() {
    if (!deps.config.enabled) throw fail('微信提醒尚未配置完成，站内通知仍可正常查看', 503);
  }
  function handle(fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
    return (req, res) => {
      res.setHeader('Cache-Control', 'private, no-store');
      void fn(req, res).catch(error => res.status(Number(error?.statusCode || 500)).json(deps.error(error)));
    };
  }
  app.get('/api/lc/account/wechat-notifications', deps.auth, handle(async (req, res) => {
    const user = identity(req);
    if (!deps.config.enabled) return res.json({ success: true, data: { available: false, state: 'unconfigured' } });
    const hash = await binding(deps.pool, user.id);
    const row = (await deps.pool.query(`select state,authorized_at,updated_at from lc_wechat_notification_subscriptions
      where profile_id=$1 and template_id=$2 and recipient_hash=$3`, [user.id, deps.config.templateId, hash])).rows[0];
    const latest = (await deps.pool.query(`select state,reason,completed_at from lc_wechat_notification_deliveries
      where profile_id=$1 and template_id=$2 and recipient_hash=$3 and attempts>0 order by created_at desc limit 1`, [user.id, deps.config.templateId, hash])).rows[0];
    return res.json({ success: true, data: { available: true, state: row?.state || 'none', authorizedAt: row?.authorized_at || null, latest: latest || null } });
  }));
  app.post('/api/lc/account/wechat-notifications/requests', deps.auth, deps.rateLimit, handle(async (req, res) => {
    const user = identity(req, true);
    configured();
    const hash = await binding(deps.pool, user.id);
    const existing = (await deps.pool.query(`select id,template_id,expires_at from lc_wechat_notification_requests
      where profile_id=$1 and template_id=$2 and recipient_hash=$3 and consumed_at is null and expires_at>now()+interval '30 seconds'
      order by created_at desc limit 1`, [user.id, deps.config.templateId, hash])).rows[0];
    const request = existing || (await deps.pool.query(`insert into lc_wechat_notification_requests(profile_id,template_id,recipient_hash)
      values($1,$2,$3) returning id,template_id,expires_at`, [user.id, deps.config.templateId, hash])).rows[0];
    return res.json({ success: true, data: request });
  }));
  app.post('/api/lc/account/wechat-notifications/confirm', deps.auth, deps.rateLimit, handle(async (req, res) => {
    const user = identity(req, true);
    configured();
    const { requestId, result } = req.body || {};
    if (typeof requestId !== 'string' || !uuid.test(requestId) || !['accept', 'reject', 'ban'].includes(result)) throw fail('订阅结果不正确', 400);
    const db = await deps.pool.connect();
    try {
      await db.query('begin');
      const hash = await binding(db, user.id);
      const used = await db.query(`update lc_wechat_notification_requests set consumed_at=now(),result=$5
        where id=$1 and profile_id=$2 and template_id=$3 and recipient_hash=$4 and consumed_at is null and expires_at>now() returning id`,
      [requestId, user.id, deps.config.templateId, hash, result]);
      if (!used.rows[0]) {
        const saved = (await db.query(`select id from lc_wechat_notification_requests where id=$1 and profile_id=$2
          and template_id=$3 and recipient_hash=$4 and consumed_at is not null and result=$5`,
        [requestId, user.id, deps.config.templateId, hash, result])).rows[0];
        if (!saved) throw fail('本次订阅已过期或结果冲突，请重新订阅', 409);
        // A lost HTTP response may be retried, but must never restore paused/revoked consent.
        await db.query('commit');
        return res.json({ success: true, data: { recorded: true } });
      }
      // The client callback is only a preference hint. WeChat, not this record, enforces actual grants.
      await db.query(`insert into lc_wechat_notification_subscriptions(profile_id,template_id,recipient_hash,state,authorized_at)
        values($1,$2,$3,$4,case when $4='accepted' then now() else null end)
        on conflict(profile_id) do update set template_id=excluded.template_id,recipient_hash=excluded.recipient_hash,
          state=excluded.state,authorized_at=excluded.authorized_at,version=lc_wechat_notification_subscriptions.version+1,updated_at=now()`,
      [user.id, deps.config.templateId, hash, result === 'accept' ? 'accepted' : 'rejected']);
      await db.query('commit');
      return res.json({ success: true, data: { state: result === 'accept' ? 'accepted' : 'rejected' } });
    } catch (error) { await db.query('rollback'); throw error; }
    finally { db.release(); }
  }));
  app.put('/api/lc/account/wechat-notifications/pause', deps.auth, deps.rateLimit, handle(async (req, res) => {
    const user = identity(req);
    configured();
    await deps.pool.query("update lc_wechat_notification_subscriptions set state='off',version=version+1,updated_at=now() where profile_id=$1", [user.id]);
    return res.json({ success: true, data: { state: 'off' } });
  }));
  app.get('/api/lc/account/notifications/:id', deps.auth, handle(async (req, res) => {
    const user = identity(req);
    if (!uuid.test(String(req.params.id))) throw fail('通知不存在', 404);
    const row = (await deps.pool.query(`select id,title,content,read_at,created_at,action_url,related_type,related_id
      from lc_account_notifications where id=$1 and profile_id=$2`, [req.params.id, user.id])).rows[0];
    if (!row) throw fail('通知不存在或不属于当前账号', 404);
    return res.json({ success: true, data: row });
  }));
}

// Called only AFTER the existing WeChat callback signature verification.
export async function applyWechatNotificationRejection(db: NotifySql, body: unknown, raw: string, templateId: string) {
  const text = (xml: string, tag: string) => {
    const match = xml.match(new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`, 'i'));
    return (match?.[1] || match?.[2] || '').trim();
  };
  const object = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  if (String(object.Event || text(raw, 'Event')).toLowerCase() !== 'subscribe_msg_change_event') return false;
  const openid = String(object.FromUserName || text(raw, 'FromUserName'));
  const time = Number(object.CreateTime || text(raw, 'CreateTime'));
  if (!openid || !Number.isFinite(time) || time <= 0 || time > Date.now() / 1000 + 300 || !templateId) return true;
  const list = object.List ? (Array.isArray(object.List) ? object.List : [object.List])
    : [...raw.matchAll(/<List>([\s\S]*?)<\/List>/g)].map(match => ({ TemplateId: text(match[1], 'TemplateId'), SubscribeStatusString: text(match[1], 'SubscribeStatusString') }));
  if (list.some(item => item && typeof item === 'object' && item.TemplateId === templateId && item.SubscribeStatusString === 'reject')) {
    await db.query(`update lc_wechat_notification_subscriptions set state='rejected',version=version+1,updated_at=now()
      where recipient_hash=$1 and template_id=$2 and updated_at<to_timestamp($3)+interval '1 second'`, [recipientHash(openid), templateId, time]);
  }
  return true;
}
