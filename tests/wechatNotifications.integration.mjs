// Isolated PostgreSQL engine; never connects to production or sends to WeChat.
// npm run build:server && JUMULU_TEST_PGLITE_MODULE=/path/to/pglite/dist/index.js node --test tests/wechatNotifications.integration.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { drainWechatNotifications, recipientHash } from '../dist-server/api/wechatNotifications.js';
import { registerWechatNotificationRoutes, applyWechatNotificationRejection } from '../dist-server/api/wechatNotificationRoutes.js';
const { PGlite } = await import(process.env.JUMULU_TEST_PGLITE_MODULE || '@electric-sql/pglite');
const migration = ['20260905210000_wechat_notification_delivery.sql', '20260905220000_wechat_notification_scopes.sql', '20260905221000_wechat_notification_decision_types.sql']
  .map(file => readFileSync(new URL('../supabase/migrations/'+file, import.meta.url), 'utf8')).join('\n');
const config = { enabled: true, templateId: 'test_template_1234567890', pageState: 'formal' };
const owner = randomUUID(), other = randomUUID();
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role lingqi_app bypassrls; create role jusichen_app; create role service_role;
    alter default privileges in schema public grant all on tables to lingqi_app,jusichen_app;
    create table lc_profiles(id uuid primary key,wechat_mini_openid text,merged_into uuid);
    create table lc_account_notifications(id uuid primary key default gen_random_uuid(),profile_id uuid references lc_profiles,
      type text,title text,content text,action_url text,related_type text,related_id uuid,read_at timestamptz,created_at timestamptz default now());`);
  await db.query('insert into lc_profiles values($1,$2,null),($3,$4,null)', [owner, 'openid-owner', other, 'openid-other']);
  await db.exec(readFileSync(new URL('../supabase/migrations/20260724165500_expand_account_notification_types.sql',import.meta.url),'utf8'));
  // Simulate an additional existing production type, which the widening migration must preserve.
  const original=(await db.query("select pg_get_expr(conbin,conrelid) as expression from pg_constraint where conname='lc_account_notifications_type_check'")).rows[0].expression;
  await db.exec(`alter table lc_account_notifications drop constraint lc_account_notifications_type_check;
    alter table lc_account_notifications add constraint lc_account_notifications_type_check check ((${original}) or type='future_unsupported');`);
  await db.exec(migration);
  return db;
}
const poolFor = db => ({ query: db.query.bind(db), connect: async () => ({ query: db.query.bind(db), release() {} }) });
function routesFor(db, options = {}) {
  const routes = new Map();
  const app = Object.fromEntries(['get','post','put'].map(method => [method,(path,...handlers) => routes.set(method+' '+path,handlers.at(-1))]));
  registerWechatNotificationRoutes(app, { pool: poolFor(db), config, auth() {}, rateLimit() {},
    getIdentity: req => ({ id: req.owner || owner, miniapp: req.miniapp !== false, merged: Boolean(req.merged) }),
    error: error => ({ success: false, error: error.message }), ...options });
  return (method, suffix, args = {}) => new Promise(resolve => {
    const res = { code: 200, headers: {}, status(code) { this.code=code; return this; }, setHeader(k,v) { this.headers[k]=v; },
      json(body) { resolve({ status: this.code, body, headers: this.headers }); } };
    routes.get(method+' /api/lc/account/'+suffix)({ params: { id: args.id }, ...args }, res);
  });
}
async function consent(db, who = owner, scopes = ['commission', 'account', 'service']) {
  const call = routesFor(db);
  const request = await call('post','wechat-notifications/requests',{ owner: who, body: { scopes } });
  assert.equal(request.status,200);
  const result = await call('post','wechat-notifications/confirm',{ owner: who, body: { requestId: request.body.data.id, result: 'accept' } });
  assert.equal(result.status,200);
  return request.body.data.id;
}
async function notice(db, type = 'commission_application_received') {
  return (await db.query("insert into lc_account_notifications(profile_id,type,title,content) values($1,$2,'private title','private evidence') returning id",[owner,type])).rows[0].id;
}
async function state(db, id) { return (await db.query('select * from lc_wechat_notification_deliveries where notification_id=$1',[id])).rows[0]; }
async function drain(db, request, extra = {}) {
  return drainWechatNotifications({ pool: poolFor(db), config, getAccessToken: async () => 'test-token', invalidateToken() {}, request, ...extra });
}
const ok = () => Promise.resolve(new Response(JSON.stringify({ errcode: 0 })));

test('selected modules share one subscription and unselected notices never call WeChat', async () => {
  const db=await setup();
  try {
    const call=routesFor(db);
    for (const scopes of [[], null, ['marketing'], ['carpool'], 'commission', ['account',null]]) {
      assert.equal((await call('post','wechat-notifications/requests',{body:{scopes}})).status,400);
    }
    const request=(await call('post','wechat-notifications/requests',{body:{scopes:['commission']}})).body.data;
    const same=(await call('post','wechat-notifications/requests',{body:{scopes:['commission']}})).body.data;
    const different=(await call('post','wechat-notifications/requests',{body:{scopes:['service']}})).body.data;
    assert.equal(request.id,same.id);
    assert.notEqual(request.id,different.id,'do not reuse a nonce for a different selection');
    await call('post','wechat-notifications/confirm',{body:{requestId:request.id,result:'accept',scopes:['account']}});
    assert.deepEqual((await call('get','wechat-notifications')).body.data.scopes,['commission'],'confirmation uses the prepared snapshot only');
    const feedback=await notice(db,'site_message_resolved');
    const account=await notice(db,'appeal_approved');
    const fallback=await notice(db,'future_unsupported');
    for(const id of [feedback,account,fallback]) assert.equal((await state(db,id)).reason,'module_disabled');
    const commission=await notice(db);
    const provider=await notice(db,'provider_inquiry_received');
    let sends=0;
    await drain(db,()=>{sends++;return sends===1 ? ok() : Promise.resolve(new Response(JSON.stringify({errcode:43101})));});
    assert.equal(sends,2,'only selected notifications attempt sends; WeChat enforces the shared quota');
    assert.equal((await state(db,commission)).state,'api_accepted');
    assert.equal((await state(db,provider)).reason,'subscription_required');
    assert.equal((await db.query('select count(*)::int as n from lc_account_notifications')).rows[0].n,5,'in-app notices remain intact');
    await consent(db,owner,['service']);
    assert.equal((await state(db,feedback)).state,'skipped','changing scopes never backfills old notices');
    const newFeedback=await notice(db,'site_message_resolved');
    await drain(db,ok);
    assert.equal((await state(db,newFeedback)).state,'api_accepted');
    await assert.rejects(db.query("update lc_wechat_notification_subscriptions set scopes='{}' where profile_id=$1",[owner]),/check constraint/);
    await assert.rejects(db.query("update lc_wechat_notification_requests set scopes=array['unknown'] where id=$1",[request.id]),/check constraint/);
  } finally {await db.close();}
});

test('migration admits actual commission decision notifications without dropping existing types', async () => {
  const db=await setup();
  try {
    const expression=async()=>(await db.query("select pg_get_expr(conbin,conrelid) as expression from pg_constraint where conname='lc_account_notifications_type_check'")).rows[0].expression;
    const before=await expression();
    await db.exec(migration);
    assert.equal(await expression(),before,'repeat migrations must not grow the check expression');
    await consent(db,owner,['commission']);
    for(const type of ['provider_inquiry_accepted','provider_inquiry_rejected','commission_application_accepted','commission_application_rejected']) {
      const id=await notice(db,type);
      assert.equal((await state(db,id)).state,'pending');
    }
    const legacy=await notice(db,'future_unsupported');
    assert.equal((await state(db,legacy)).reason,'module_disabled','preexisting extra types remain allowed but are not sent by default');
    await assert.rejects(notice(db,'not_allowed'),/check constraint/);
  } finally {await db.close();}
});

test('scope is rechecked for queued notices and again after token acquisition', async () => {
  const db=await setup();
  try {
    await consent(db);
    const queued=await notice(db);
    await db.query("update lc_wechat_notification_subscriptions set scopes=array['service'] where profile_id=$1",[owner]);
    await drain(db,()=>{throw new Error('excluded module must not send');});
    assert.equal((await state(db,queued)).reason,'module_disabled');
    await consent(db);
    const raced=await notice(db);
    await drain(db,()=>{throw new Error('excluded module must not send');},{getAccessToken:async()=>{
      await db.query("update lc_wechat_notification_subscriptions set scopes=array['account'] where profile_id=$1",[owner]);
      return 'token';
    }});
    assert.equal((await state(db,raced)).reason,'module_disabled');
  } finally {await db.close();}
});

test('migration is repeatable, least privilege and trigger participates in business rollback', async () => {
  const db = await setup();
  try {
    await db.exec(migration);
    for (const table of ['lc_wechat_notification_subscriptions','lc_wechat_notification_requests','lc_wechat_notification_deliveries']) {
      assert.deepEqual((await db.query(`select has_table_privilege('lingqi_app',$1,'SELECT') as r,
        has_table_privilege('lingqi_app',$1,'DELETE') as d,has_table_privilege('lingqi_app',$1,'TRUNCATE') as t,
        has_table_privilege('jusichen_app',$1,'SELECT') as cross_app,has_table_privilege('anon',$1,'SELECT') as anon`,[table])).rows[0],
      { r: true, d: false, t: false, cross_app: false, anon: false });
    }
    const before = await notice(db);
    assert.equal((await state(db,before)).reason,'no_subscription');
    await consent(db);
    assert.equal((await state(db,before)).state,'skipped','no historical backfill');
    await db.query('begin'); const aborted = await notice(db); await db.query('rollback');
    assert.equal(await state(db,aborted),undefined);
    const queued = await notice(db); assert.equal((await state(db,queued)).state,'pending');
    await db.exec('set role anon'); await assert.rejects(db.query('select * from lc_wechat_notification_subscriptions'),/permission denied/); await db.exec('reset role');
  } finally { await db.close(); }
});
test('owner-only, miniapp-only, expiring nonce, safe idempotent confirmation and pause', async () => {
  const db=await setup();
  try {
    const call=routesFor(db);
    assert.equal((await call('post','wechat-notifications/requests',{miniapp:false})).status,403);
    assert.equal((await call('post','wechat-notifications/requests',{merged:true})).status,401);
    const request=(await call('post','wechat-notifications/requests')).body.data;
    assert.equal((await call('post','wechat-notifications/confirm',{owner:other,body:{requestId:request.id,result:'accept'}})).status,409);
    await db.query("update lc_wechat_notification_requests set expires_at=now()-interval '1 second' where id=$1",[request.id]);
    assert.equal((await call('post','wechat-notifications/confirm',{body:{requestId:request.id,result:'accept'}})).status,409);
    const id=await consent(db);
    const version=(await db.query('select version from lc_wechat_notification_subscriptions')).rows[0].version;
    await call('post','wechat-notifications/confirm',{body:{requestId:id,result:'accept'}});
    assert.equal((await db.query('select version from lc_wechat_notification_subscriptions')).rows[0].version,version);
    const n=await notice(db);
    assert.equal((await call('get','notifications/:id',{id:n,owner:other})).status,404);
    assert.equal((await call('get','notifications/:id',{id:n})).body.data.content,'private evidence');
    await call('put','wechat-notifications/pause');
    await call('post','wechat-notifications/confirm',{body:{requestId:id,result:'accept'}});
    assert.equal((await db.query('select state from lc_wechat_notification_subscriptions')).rows[0].state,'off');
    await drain(db,()=>{throw new Error('must not send');}); assert.equal((await state(db,n)).state,'skipped');
    await db.query('update lc_profiles set wechat_mini_openid=$2 where id=$1',[owner,'changed-openid']);
    assert.equal((await call('get','wechat-notifications')).body.data.state,'none');
  } finally { await db.close(); }
});
test('one job per notice, no private payload, read skip, revoked binding recheck, ambiguous send never retries', async () => {
  const db=await setup();
  try {
    await consent(db); let sends=0;
    const id=await notice(db);
    await drain(db,async (_url,options)=>{sends++; assert.ok(!options.body.includes('private')); return ok();});
    await drain(db,async()=>{sends++; return ok();});
    assert.equal(sends,1); assert.equal((await state(db,id)).state,'api_accepted');
    const read=await notice(db); await db.query('update lc_account_notifications set read_at=now() where id=$1',[read]);
    await drain(db,ok); assert.equal((await state(db,read)).reason,'already_read');
    const ambiguous=await notice(db); await drain(db,async()=>{sends++; throw new Error('timeout');});
    await drain(db,async()=>{sends++; return ok();});
    assert.equal(sends,2); assert.equal((await state(db,ambiguous)).state,'unknown');
    const malformed=await notice(db); await drain(db,async()=>new Response('null'));
    assert.equal((await state(db,malformed)).reason,'ambiguous_response');
    const rebound=await notice(db);
    await drain(db,async()=>{throw new Error('must not send');},{getAccessToken:async()=>{await db.query("update lc_profiles set wechat_mini_openid='changed' where id=$1",[owner]); return 'token';}});
    assert.equal((await state(db,rebound)).reason,'account_changed');
  } finally { await db.close(); }
});
test('quota exhaustion cannot overwrite fresh consent and token failure retries are bounded', async () => {
  const db=await setup();
  try {
    await consent(db); const n=await notice(db);
    await drain(db,async()=>{await consent(db); return new Response(JSON.stringify({errcode:43101}));});
    assert.equal((await state(db,n)).reason,'subscription_required');
    assert.equal((await db.query('select state from lc_wechat_notification_subscriptions')).rows[0].state,'accepted');
    const exhausted=await notice(db); await drain(db,async()=>new Response(JSON.stringify({errcode:43101})));
    assert.equal((await state(db,exhausted)).state,'failed');
    assert.equal((await db.query('select state from lc_wechat_notification_subscriptions')).rows[0].state,'exhausted');
    await consent(db); const retry=await notice(db);
    for(let i=0;i<3;i++) {
      await db.query('update lc_wechat_notification_deliveries set available_at=now() where notification_id=$1',[retry]);
      await drain(db,ok,{getAccessToken:async()=>{throw new Error('no token');}});
    }
    assert.equal((await state(db,retry)).state,'failed'); assert.equal((await state(db,retry)).attempts,3);
  } finally { await db.close(); }
});
test('signed callback handler supports JSON and XML revocation, ignores unrelated and old events', async () => {
  const db=await setup();
  try {
    await consent(db);
    const event={Event:'subscribe_msg_change_event',FromUserName:'openid-owner',CreateTime:Math.floor(Date.now()/1000)-30,List:{TemplateId:config.templateId,SubscribeStatusString:'reject'}};
    await applyWechatNotificationRejection(db,event,'',config.templateId);
    assert.equal((await db.query('select state from lc_wechat_notification_subscriptions')).rows[0].state,'accepted');
    event.CreateTime=Math.floor(Date.now()/1000);
    await applyWechatNotificationRejection(db,event,'',config.templateId);
    assert.equal((await db.query('select state from lc_wechat_notification_subscriptions')).rows[0].state,'rejected');
    await consent(db);
    await applyWechatNotificationRejection(db,null,`<xml><Event><![CDATA[subscribe_msg_change_event]]></Event><FromUserName>openid-owner</FromUserName><CreateTime>${Math.floor(Date.now()/1000)}</CreateTime><List><TemplateId><![CDATA[${config.templateId}]]></TemplateId><SubscribeStatusString>reject</SubscribeStatusString></List></xml>`,config.templateId);
    assert.equal((await db.query('select state from lc_wechat_notification_subscriptions')).rows[0].state,'rejected');
    assert.equal(await applyWechatNotificationRejection(db,{Event:'xpay_order'},'',config.templateId),false);
    assert.equal((await db.query('select recipient_hash from lc_wechat_notification_subscriptions')).rows[0].recipient_hash,recipientHash('openid-owner'));
  } finally { await db.close(); }
});
