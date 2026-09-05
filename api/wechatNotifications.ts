import { createHash } from 'node:crypto';

export type NotifyConfig = { enabled: boolean; templateId: string; pageState: 'formal'|'trial'|'developer' };
export function notifyConfig(env: Record<string,string|undefined>): NotifyConfig {
  const templateId=(env.LINGQI_WECHAT_NOTIFY_TEMPLATE_ID||'').trim();
  const state=env.LINGQI_WECHAT_NOTIFY_PAGE_STATE||'formal';
  if(!['formal','trial','developer'].includes(state)) throw new Error('Invalid WeChat notification page state');
  return {enabled:env.LINGQI_WECHAT_NOTIFY_ENABLED==='true' && /^[A-Za-z0-9_-]{20,128}$/.test(templateId),templateId,pageState:state as NotifyConfig['pageState']};
}
export const recipientHash = (openid: string) => createHash('sha256').update(openid).digest('hex');
export const notificationScopes = ['commission', 'account', 'service'] as const;
export type NotificationScope = typeof notificationScopes[number];
export function parseNotificationScopes(value: unknown): NotificationScope[] | null {
  if (!Array.isArray(value) || !value.length || value.length > notificationScopes.length
    || value.some(scope => !notificationScopes.includes(scope))) return null;
  return notificationScopes.filter(scope => value.includes(scope));
}
export function notificationScope(type: string): NotificationScope | null {
  if (type.startsWith('commission_') || type.startsWith('provider_')) return 'commission';
  if (type.startsWith('restriction_') || type.startsWith('appeal_')) return 'account';
  if (type === 'service_payment_succeeded' || type === 'site_message_resolved') return 'service';
  return null;
}
const includesScope = (scopes: unknown, type: unknown) =>
  Array.isArray(scopes) && scopes.includes(notificationScope(String(type || '')));
export const notificationPage = (id: string) => {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid notification id');
  return 'pages/mine/account-status?notice='+encodeURIComponent(id);
};

// Static summaries only: never copy private user text, names, evidence or contacts.
export function notificationSummary(type: string) {
  if(type.startsWith('commission_')) return {kind:'委托消息',summary:'委托申请有新进展，请进入查看'};
  if(type.startsWith('provider_')) return {kind:'委托消息',summary:'收到委托咨询或处理结果'};
  if(type.startsWith('carpool_')) return {kind:'拼车消息',summary:'拼车申请有新进展，请进入查看'};
  if(type.startsWith('restriction_') || type.startsWith('appeal_')) return {kind:'账号通知',summary:'账号服务有新进展，请进入查看'};
  if(type==='site_message_resolved') return {kind:'反馈回复',summary:'你的反馈已有回复，请进入查看'};
  if(type==='service_payment_succeeded') return {kind:'服务通知',summary:'服务购买结果已更新，请进入查看'};
  return {kind:'站内通知',summary:'你有一条新的站内通知，请查看'};
}
export function wechatNotificationPayload(input:{id:string;type:string;createdAt:string;openid:string;config:NotifyConfig}) {
  const {kind,summary}=notificationSummary(input.type);
  const date=new Date(input.createdAt);
  if(!Number.isFinite(date.getTime())) throw new Error('Invalid notification date');
  const china=new Date(date.getTime()+8*3600_000).toISOString().slice(0,16).replace('T',' ');
  return {touser:input.openid,template_id:input.config.templateId,page:notificationPage(input.id),
    miniprogram_state:input.config.pageState,lang:'zh_CN',
    data:{phrase4:{value:kind},thing5:{value:summary},date3:{value:china}}};
}
export function sendOutcome(code: number, attempts: number) {
  if(code===0) return {state:'api_accepted',reason:'wechat_api_accepted',retry:false};
  if(code===43101) return {state:'failed',reason:'subscription_required',retry:false};
  if([40001,40014,42001,43108,-1].includes(code) && attempts<3) return {state:'pending',reason:'wechat_retryable',retry:true};
  return {state:'failed',reason:code===43107?'capability_blocked':code===40037?'template_invalid':code===47003?'template_data_invalid':'wechat_rejected',retry:false};
}

export type NotifySql = {query(text:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[];rowCount?:number|null}>};
export type NotifyPool = NotifySql & {connect():Promise<NotifySql & {release(destroy?:boolean):void}>};
type DeliveryRow={notification_id:string;profile_id:string;template_id:string;recipient_hash:string;subscription_version:number;attempts:number};

export async function drainWechatNotifications(input:{pool:NotifyPool;config:NotifyConfig;getAccessToken:()=>Promise<string>;invalidateToken:(token:string)=>void;request?:typeof fetch}) {
  if(!input.config.enabled)return;
  const db=await input.pool.connect();
  let locked=false;
  try {
    // Session lock covers only this worker; no business transaction stays open during HTTP.
    locked=Boolean((await db.query("select pg_try_advisory_lock(hashtext('jumulu:wechat-notify-worker')) as locked")).rows[0]?.locked);
    if(!locked)return;
    await db.query("update lc_wechat_notification_deliveries set state='unknown',reason='interrupted_dispatch',completed_at=now() where state='processing' and started_at<now()-interval '2 minutes'");
    for(let i=0;i<20;i++) {
      const claimed=await db.query(`update lc_wechat_notification_deliveries set state='processing',started_at=now(),attempts=attempts+1
        where notification_id=(select notification_id from lc_wechat_notification_deliveries where state='pending' and available_at<=now()
          order by created_at limit 1 for update skip locked) returning *`);
      const job=claimed.rows[0] as DeliveryRow|undefined;
      if(!job)break;
      const finish=async(state:string,reason:string,code:number|null=null)=>db.query(
        "update lc_wechat_notification_deliveries set state=$2,reason=$3,error_code=$4,completed_at=now() where notification_id=$1 and state='processing'",[job.notification_id,state,reason,code]);
      const row=(await db.query(`select n.type,n.created_at,n.read_at,p.wechat_mini_openid,p.merged_into,
        s.state as subscription_state,s.scopes,s.version,s.template_id as current_template,s.recipient_hash as current_recipient,
        n.created_at < now()-interval '24 hours' as expired
        from lc_account_notifications n join lc_profiles p on p.id=n.profile_id
        left join lc_wechat_notification_subscriptions s on s.profile_id=n.profile_id
        where n.id=$1 and n.profile_id=$2`,[job.notification_id,job.profile_id])).rows[0];
      if(!row || row.read_at || row.expired) {await finish('skipped',row?.read_at?'already_read':'expired_or_missing');continue;}
      const openid=String(row.wechat_mini_openid||'');
      if(row.merged_into || !openid || recipientHash(openid)!==job.recipient_hash || row.current_recipient!==job.recipient_hash) {await finish('skipped','account_changed');continue;}
      if(row.subscription_state!=='accepted') {await finish('skipped','subscription_inactive');continue;}
      if(!includesScope(row.scopes,row.type)) {await finish('skipped','module_disabled');continue;}
      if(job.template_id!==input.config.templateId || row.current_template!==job.template_id) {await finish('failed','template_changed');continue;}
      let token:string;
      try { token=await input.getAccessToken(); }
      catch { // No send attempted, so retrying token acquisition cannot duplicate a message.
        await db.query("update lc_wechat_notification_deliveries set state=case when attempts<3 then 'pending' else 'failed' end,reason='token_unavailable',available_at=now()+interval '60 seconds',completed_at=now() where notification_id=$1",[job.notification_id]);
        continue;
      }
      // Consent might have been revoked while acquiring a token. Recheck just before dispatch.
      const current=(await db.query(`select s.state,s.scopes,s.recipient_hash,s.version,s.template_id,p.wechat_mini_openid,p.merged_into,
        n.read_at,n.created_at<s.authorized_at as predates_consent from lc_wechat_notification_subscriptions s
        join lc_profiles p on p.id=s.profile_id join lc_account_notifications n on n.profile_id=p.id
        where s.profile_id=$1 and n.id=$2`,[job.profile_id,job.notification_id])).rows[0];
      if(current?.state!=='accepted' || current.recipient_hash!==job.recipient_hash || current.predates_consent || current.read_at){await finish('skipped','subscription_inactive');continue;}
      if(current.merged_into || current.wechat_mini_openid!==openid || current.template_id!==job.template_id){await finish('skipped','account_changed');continue;}
      if(!includesScope(current.scopes,row.type)){await finish('skipped','module_disabled');continue;}
      let response:Response;
      let payload:{errcode?:number};
      try {
        response=await (input.request||fetch)('https://api.weixin.qq.com/cgi-bin/message/subscribe/send?'+new URLSearchParams({access_token:token}),{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify(wechatNotificationPayload({id:job.notification_id,type:String(row.type),createdAt:String(row.created_at),openid,config:input.config})),
          signal:AbortSignal.timeout(8000),
        });
        payload=await response.json();
      } catch {await finish('unknown','ambiguous_network_result');continue;}
      if(!payload || typeof payload.errcode!=='number' || (!response.ok && payload.errcode===0)){await finish('unknown','ambiguous_response');continue;}
      const outcome=sendOutcome(payload.errcode,job.attempts);
      if([40001,40014,42001].includes(payload.errcode))input.invalidateToken(token);
      if(outcome.retry)await db.query("update lc_wechat_notification_deliveries set state='pending',reason=$2,error_code=$3,available_at=now()+interval '60 seconds' where notification_id=$1",[job.notification_id,outcome.reason,payload.errcode]);
      else await finish(outcome.state,outcome.reason,payload.errcode);
      if(payload.errcode===43101)await db.query("update lc_wechat_notification_subscriptions set state='exhausted',updated_at=now() where profile_id=$1 and version=$2 and state='accepted'",[job.profile_id,current.version]);
    }
  } finally {
    let destroy = false;
    if(locked){try{await db.query("select pg_advisory_unlock(hashtext('jumulu:wechat-notify-worker'))");}catch{destroy = true;}}
    db.release(destroy);
  }
}
