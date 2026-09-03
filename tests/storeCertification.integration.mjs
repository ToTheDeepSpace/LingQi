// Isolated PostgreSQL-engine test. No production connection or credentials.
// npm run build:server; JUMULU_TEST_PGLITE_MODULE=/tmp/.../dist/index.js node --test tests/storeCertification.integration.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createStoreCode, grantStoreCertification, fulfillStoreCodePack, reserveStoreCode, consumeStoreCode, revokeRefundedStorePurchase, revokeStoreEntitlement, lockStoreEntitlements } from '../dist-server/api/storeCertification.js';
import { registerStoreCertificationRoutes } from '../dist-server/api/storeCertificationRoutes.js';

const { PGlite } = await import(process.env.JUMULU_TEST_PGLITE_MODULE || '@electric-sql/pglite');
const { pgcrypto } = await import(process.env.JUMULU_TEST_PGLITE_MODULE
  ? process.env.JUMULU_TEST_PGLITE_MODULE.replace('/dist/index.js','/dist/contrib/pgcrypto.js')
  : '@electric-sql/pglite/contrib/pgcrypto');
const journalMigration = readFileSync(new URL('../supabase/migrations/20260721120000_critical_change_journal.sql', import.meta.url),'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20260904090000_store_certification_codes.sql', import.meta.url), 'utf8');
const legacyStore = '64946687-714e-40f8-9c00-614f282e7221';
const legacyOwner = '19577ab6-28ee-46c5-9b4b-9551d2702bef';

async function setup() {
  const db = new PGlite({ extensions:{ pgcrypto } });
  await db.exec(`
    create role anon; create role authenticated; create role lingqi_app bypassrls;
    create table lc_profiles(id uuid primary key, identity_roles text[] default '{}',
      verified_shop boolean default false, is_banned boolean default false, merged_into uuid, updated_at timestamptz,
      role text,ban_reason text,is_realname boolean default false,verified_dm boolean default false);
    create table lc_dm_dossiers(id uuid primary key, dm_name text, city text, entity_type text, status text default 'approved',
      claimed_by uuid references lc_profiles, claim_status text default 'unclaimed'
      check(claim_status in ('unclaimed','pending','approved','rejected','withdrawn')),
      employment_status text, employer_store_id uuid references lc_dm_dossiers, workplace text, updated_at timestamptz);
    create table lc_service_purchases(id uuid primary key default gen_random_uuid(),profile_id uuid references lc_profiles,
      target_id uuid,product_type text,amount_fen int,status text,unique(profile_id,product_type,target_id));
    create table lc_service_payment_attempts(id uuid primary key,amount_fen int,product_id text);
    create table lc_dm_dossier_claims(id uuid primary key);
    create table lc_dm_store_affiliations(id uuid primary key default gen_random_uuid(),
      dm_dossier_id uuid references lc_dm_dossiers,store_dossier_id uuid references lc_dm_dossiers,
      dm_profile_id uuid references lc_profiles,requested_by_profile_id uuid references lc_profiles,
      requested_by_role text check(requested_by_role in ('dm','store','admin','legacy')),
      request_kind text check(request_kind in ('join','change','legacy')),request_note text,
      status text check(status in ('pending','approved','rejected','ended','cancelled','legacy_unverified')),
      reviewed_by_profile_id uuid references lc_profiles,reviewed_at timestamptz,started_at timestamptz,updated_at timestamptz);
    create unique index one_approved on lc_dm_store_affiliations(dm_dossier_id) where status='approved';
    create unique index one_pending on lc_dm_store_affiliations(dm_dossier_id) where status='pending';
    insert into lc_profiles(id) values('${legacyOwner}');
    insert into lc_dm_dossiers(id,dm_name,city,entity_type,claimed_by,claim_status)
      values('${legacyStore}','test','北京','store','${legacyOwner}','approved');
  `);
  await db.exec(journalMigration);
  await db.exec(migration);
  return db;
}
async function count(db, table) { return Number((await db.query('select count(*) as n from ' + table)).rows[0].n); }
async function tx(db, fn) { return db.transaction(async client => { await lockStoreEntitlements(client); return fn(client); }); }
async function newDm(db) {
  const profileId = randomUUID(), dossierId = randomUUID();
  await db.query('insert into lc_profiles(id) values($1)',[profileId]);
  await db.query("insert into lc_dm_dossiers(id,dm_name,entity_type) values($1,'测试DM','dm')",[dossierId]);
  return { profileId, dossierId };
}
function routesFor(db) {
  const routes = new Map();
  const app = Object.fromEntries(['get','post','put'].map(method => [method,(path,...handlers) => routes.set(method+' '+path,handlers.at(-1))]));
  registerStoreCertificationRoutes(app,{
    pool:{ query:db.query.bind(db), connect:async () => ({query:db.query.bind(db),release(){}}) },
    auth(){},admin(){},rateLimit(){},
    getProfile:async req => ({id:req.owner || legacyOwner,phone_verified_at:'2026-09-04',wechat_mini_openid:'test'}),
    audit:async () => {},error:error => ({success:false,error:error.message}),
  });
  return (method,path,{id,owner,body}={}) => new Promise(resolve => {
    const res = {code:200,headers:{},status(code){this.code=code;return this;},setHeader(k,v){this.headers[k]=v;},json(body){resolve({status:this.code,body,headers:this.headers});}};
    routes.get(method+' '+path)({params:{id},owner,body},res);
  });
}

test('migration is idempotent, legacy grant is exact, no fake payment, protected tables and prices', async () => {
  const db = await setup();
  try {
    await db.exec(migration);
    assert.equal(await count(db,'lc_store_certifications'),1);
    assert.equal(await count(db,'lc_store_certification_code_batches'),1);
    assert.equal(await count(db,'lc_store_certification_codes'),11);
    assert.equal(await count(db,'lc_service_purchases'),0);
    assert.equal((await db.query('select source,nominal_amount_fen from lc_store_certifications')).rows[0].source,'legacy_credit');
    assert.equal((await db.query('select verified_shop from lc_profiles')).rows[0].verified_shop,true);
    assert.equal((await db.query("select row_id from lc_critical_change_journal where table_name='lc_store_certifications' limit 1")).rows[0].row_id,legacyStore);
    for (const price of [1,900,888]) await assert.rejects(db.query(
      "insert into lc_service_purchases(profile_id,target_id,product_type,amount_fen,status) values($1,$2,'store_certification',$3,'paid')",
      [legacyOwner,randomUUID(),price]),/check constraint/);
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from lc_store_certification_codes'),/permission denied/);
    await db.exec('reset role');
  } finally { await db.close(); }
});

test('owner-only one-time reveal, rotation invalidates old codes, single-use reservation and manual approval binding', async () => {
  const db = await setup();
  try {
    const call = routesFor(db);
    const batchId = (await db.query('select id from lc_store_certification_code_batches')).rows[0].id;
    const dm = await newDm(db), other = await newDm(db);
    const stolen = await call('post','/api/lc/store-code-batches/:id/reveal',{id:batchId,owner:other.profileId});
    assert.equal(stolen.status,404);
    const first = await call('post','/api/lc/store-code-batches/:id/reveal',{id:batchId});
    assert.equal(first.body.data.codes.length,11);
    assert.ok(!JSON.stringify((await db.query('select new_snapshot from lc_critical_change_journal')).rows).includes('JML-'),'audit must never contain plaintext codes');
    assert.match(first.headers['Cache-Control'],/no-store/);
    assert.equal((await call('post','/api/lc/store-code-batches/:id/reveal',{id:batchId})).body.data.codes.length,0);
    const original = first.body.data.codes[0];
    const rotated = await call('post','/api/lc/store-codes/:id/regenerate',{id:original.id});
    assert.notEqual(rotated.body.data.code,original.code);
    await assert.rejects(tx(db,c => reserveStoreCode(c,{...dm,code:original.code})),/认证码/);
    const preview = await tx(db,c => reserveStoreCode(c,{...dm,code:rotated.body.data.code,preview:true}));
    assert.equal(preview.storeName,'test');
    assert.equal((await db.query('select status from lc_store_certification_codes where id=$1',[original.id])).rows[0].status,'unused');
    const reserved = await tx(db,c => reserveStoreCode(c,{...dm,code:rotated.body.data.code}));
    assert.equal(await count(db,'lc_dm_store_affiliations'),0,'submitting code must not bypass review');
    await assert.rejects(tx(db,c => reserveStoreCode(c,{...other,code:rotated.body.data.code})),/已使用|已预留/);
    assert.equal((await tx(db,c => reserveStoreCode(c,dm))).id,reserved.id,'rejected proof may reuse reservation without code');
    assert.equal((await call('post','/api/lc/store-codes/:id/regenerate',{id:reserved.id})).body.success,false);
    await tx(db,c => consumeStoreCode(c,{...dm,codeId:reserved.id,reviewerId:legacyOwner}));
    assert.equal(await count(db,'lc_dm_store_affiliations'),1);
    assert.equal((await db.query('select employer_store_id from lc_dm_dossiers where id=$1',[dm.dossierId])).rows[0].employer_store_id,legacyStore);
    await assert.rejects(tx(db,c => consumeStoreCode(c,{...dm,codeId:reserved.id,reviewerId:legacyOwner})),/不可用于/);
    await db.query("update lc_dm_store_affiliations set status='ended'");
    assert.equal((await db.query('select status from lc_store_certification_codes where id=$1',[reserved.id])).rows[0].status,'used');
  } finally { await db.close(); }
});

test('paid store grants exactly eleven, addon replay is idempotent, refund revokes unused slots without replenishing used codes', async () => {
  const db = await setup();
  try {
    const storeId=randomUUID(),purchaseId=randomUUID();
    await db.query("insert into lc_dm_dossiers(id,dm_name,entity_type,claimed_by,claim_status) values($1,'付费店家','store',$2,'pending')",[storeId,legacyOwner]);
    await db.query("insert into lc_service_purchases(id,profile_id,target_id,product_type,amount_fen,status) values($1,$2,$3,'store_certification',9000,'unpaid')",[purchaseId,legacyOwner,storeId]);
    const grant = c => grantStoreCertification(c,{storeId,profileId:legacyOwner,purchaseId,reviewerId:legacyOwner});
    await assert.rejects(tx(db,grant),/90元订单/);
    await db.query("update lc_service_purchases set status='paid' where id=$1",[purchaseId]);
    await tx(db,grant); await tx(db,grant);
    assert.equal(await count(db,'lc_store_certification_codes'),22);
    await db.query("update lc_dm_dossiers set claim_status='approved' where id=$1",[storeId]);
    const call=routesFor(db);
    const pack=(await call('post','/api/lc/store-certifications/:id/code-packs',{id:storeId})).body.data;
    const same=(await call('post','/api/lc/store-certifications/:id/code-packs',{id:storeId})).body.data;
    assert.equal(pack.id,same.id);
    assert.equal(pack.quantity,11); assert.equal(pack.amount_yuan,'90.00');
    const addonId=randomUUID();
    await db.query("insert into lc_service_purchases(id,profile_id,target_id,product_type,amount_fen,status) values($1,$2,$3,'store_code_pack',9000,'paid')",[addonId,legacyOwner,pack.id]);
    const purchase={id:addonId,profile_id:legacyOwner,target_id:pack.id,product_type:'store_code_pack'};
    await tx(db,c=>fulfillStoreCodePack(c,purchase)); await tx(db,c=>fulfillStoreCodePack(c,purchase));
    assert.equal(await count(db,'lc_store_certification_codes'),33);
    const codes=(await call('post','/api/lc/store-code-batches/:id/reveal',{id:pack.id})).body.data.codes;
    const dm=await newDm(db);
    const reserved=await tx(db,c=>reserveStoreCode(c,{...dm,code:codes[0].code}));
    await tx(db,c=>consumeStoreCode(c,{...dm,codeId:reserved.id,reviewerId:legacyOwner}));
    await tx(db,c=>revokeRefundedStorePurchase(c,addonId));
    const statuses=await db.query('select status,count(*)::int as n from lc_store_certification_codes where batch_id=$1 group by status',[pack.id]);
    assert.deepEqual(Object.fromEntries(statuses.rows.map(x=>[x.status,x.n])),{used:1,revoked:10});
    await assert.rejects(tx(db,c=>reserveStoreCode(c,{...dm,code:codes[1].code})),/认证码/);
    await tx(db,c=>revokeRefundedStorePurchase(c,purchaseId));
    assert.equal((await db.query('select status from lc_store_certifications where store_dossier_id=$1',[storeId])).rows[0].status,'revoked');
    assert.equal((await db.query('select verified_shop from lc_profiles where id=$1',[legacyOwner])).rows[0].verified_shop,true,'other active legacy store retains verified_shop');
  } finally { await db.close(); }
});

test('failed proof transaction rolls back reservation; conflicting store affiliation rejects code', async () => {
  const db=await setup();
  try {
    const dm=await newDm(db),generated=createStoreCode();
    const codeId=(await db.query('select id from lc_store_certification_codes limit 1')).rows[0].id;
    await db.query('update lc_store_certification_codes set code_hash=$2,last_four=$3 where id=$1',[codeId,generated.hash,generated.lastFour]);
    await assert.rejects(tx(db,async c=>{ await reserveStoreCode(c,{...dm,code:generated.code}); throw new Error('proof insert failed'); }),/proof insert/);
    assert.equal((await db.query('select status from lc_store_certification_codes where id=$1',[codeId])).rows[0].status,'unused');
    const otherStore=randomUUID();
    await db.query("insert into lc_dm_dossiers(id,dm_name,entity_type) values($1,'另一家店','store')",[otherStore]);
    await db.query("insert into lc_dm_store_affiliations(dm_dossier_id,store_dossier_id,status) values($1,$2,'approved')",[dm.dossierId,otherStore]);
    await assert.rejects(tx(db,c=>reserveStoreCode(c,{...dm,code:generated.code})),/先结束旧关系/);
  } finally { await db.close(); }
});

test('payment arriving after store revocation is recorded without restoring codes', async () => {
  const db=await setup();
  try {
    const call=routesFor(db);
    const pack=(await call('post','/api/lc/store-certifications/:id/code-packs',{id:legacyStore})).body.data;
    const purchaseId=randomUUID();
    await db.query("insert into lc_service_purchases(id,profile_id,target_id,product_type,amount_fen,status) values($1,$2,$3,'store_code_pack',9000,'unpaid')",[purchaseId,legacyOwner,pack.id]);
    const purchase={id:purchaseId,profile_id:legacyOwner,target_id:pack.id,product_type:'store_code_pack'};
    await assert.rejects(tx(db,c=>fulfillStoreCodePack(c,purchase)),/90元订单/);
    await tx(db,c=>revokeStoreEntitlement(c,legacyStore,'违规经营人工撤销认证'));
    await db.query("update lc_service_purchases set status='paid' where id=$1",[purchaseId]);
    await tx(db,c=>fulfillStoreCodePack(c,purchase));
    await tx(db,c=>fulfillStoreCodePack(c,purchase));
    const row=(await db.query('select status,purchase_id from lc_store_certification_code_batches where id=$1',[pack.id])).rows[0];
    assert.equal(row.status,'revoked'); assert.equal(row.purchase_id,purchaseId);
    assert.equal(Number((await db.query('select count(*) as n from lc_store_certification_codes where batch_id=$1',[pack.id])).rows[0].n),0);
    assert.equal((await call('post','/api/lc/store-code-batches/:id/reveal',{id:pack.id})).status,403);
  } finally { await db.close(); }
});
