import assert from 'node:assert/strict';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createStoreCode,reserveStoreCode,consumeStoreCode,fulfillStoreCodePack,revokeRefundedStorePurchase,lockStoreEntitlements } from '../dist-server/api/storeCertification.js';
assert.match(process.env.JML_TEST_SOCKET || '', /^\/tmp\/jumulu-release-[A-Za-z0-9.-]+\/pgsocket$/, 'Requires a disposable release-test PostgreSQL socket; never use production');
const pool=new pg.Pool({host:process.env.JML_TEST_SOCKET,port:55448,user:'postgres',database:'postgres',max:6,statement_timeout:5000});
async function tx(fn) {
  const c=await pool.connect();
  try {await c.query('begin');await lockStoreEntitlements(c);const result=await fn(c);await c.query('commit');return result;}
  catch(e){await c.query('rollback');throw e;} finally{c.release();}
}
const legacyOwner='19577ab6-28ee-46c5-9b4b-9551d2702bef',store='64946687-714e-40f8-9c00-614f282e7221';
try {
  await pool.query(`
    create role anon; create role authenticated; create role lingqi_app bypassrls;
    create table lc_profiles(id uuid primary key,identity_roles text[] default '{}',verified_shop boolean default false,
      is_banned boolean default false,merged_into uuid,updated_at timestamptz,role text,ban_reason text,is_realname boolean,verified_dm boolean);
    create table lc_dm_dossiers(id uuid primary key,dm_name text,city text,entity_type text,status text default 'approved',
      claimed_by uuid references lc_profiles,claim_status text default 'unclaimed',employment_status text,
      employer_store_id uuid references lc_dm_dossiers,workplace text,updated_at timestamptz);
    create table lc_service_purchases(id uuid primary key default gen_random_uuid(),profile_id uuid references lc_profiles,
      target_id uuid,product_type text,amount_fen int,status text,unique(profile_id,product_type,target_id));
    create table lc_service_payment_attempts(id uuid primary key,amount_fen int,product_id text);
    create table lc_dm_dossier_claims(id uuid primary key);
    create table lc_dm_store_affiliations(id uuid primary key default gen_random_uuid(),
      dm_dossier_id uuid references lc_dm_dossiers,store_dossier_id uuid references lc_dm_dossiers,
      dm_profile_id uuid references lc_profiles,requested_by_profile_id uuid references lc_profiles,
      requested_by_role text,request_kind text,request_note text,status text,reviewed_by_profile_id uuid references lc_profiles,
      reviewed_at timestamptz,started_at timestamptz,updated_at timestamptz);
    create unique index one_approved on lc_dm_store_affiliations(dm_dossier_id) where status='approved';
    create unique index one_pending on lc_dm_store_affiliations(dm_dossier_id) where status='pending';
    insert into lc_profiles(id) values('${legacyOwner}');
    insert into lc_dm_dossiers(id,dm_name,city,entity_type,claimed_by,claim_status)
      values('${store}','test','北京','store','${legacyOwner}','approved');
  `);
  await pool.query(readFileSync(new URL('../supabase/migrations/20260721120000_critical_change_journal.sql',import.meta.url),'utf8'));
  await pool.query(readFileSync(new URL('../supabase/migrations/20260904090000_store_certification_codes.sql',import.meta.url),'utf8'));
  const batch=(await pool.query('select id from lc_store_certification_code_batches')).rows[0].id;
  const dm=async()=>{const profileId=randomUUID(),dossierId=randomUUID();await pool.query('insert into lc_profiles(id) values($1)',[profileId]);await pool.query("insert into lc_dm_dossiers(id,dm_name,entity_type) values($1,'DM','dm')",[dossierId]);return{profileId,dossierId};};
  const mint=async slot=>{const value=createStoreCode();const row=await pool.query('update lc_store_certification_codes set code_hash=$3,last_four=$4 where batch_id=$1 and slot=$2 returning id',[batch,slot,value.hash,value.lastFour]);return{...value,id:row.rows[0].id};};
  const a=await dm(),b=await dm(),code=await mint(1);
  const races=await Promise.allSettled([a,b].map(person=>tx(c=>reserveStoreCode(c,{...person,code:code.code}))));
  assert.equal(races.filter(x=>x.status==='fulfilled').length,1);
  const winner=races[0].status==='fulfilled'?a:b;
  const approvals=await Promise.allSettled([1,2].map(()=>tx(c=>consumeStoreCode(c,{...winner,codeId:code.id,reviewerId:legacyOwner}))));
  assert.equal(approvals.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(Number((await pool.query('select count(*) as n from lc_dm_store_affiliations')).rows[0].n),1);
  console.log('PASS concurrent single-code reservation and duplicate approval');
  const rotating=await mint(2),customer=await dm();
  const outcomes=await Promise.allSettled([
    tx(c=>reserveStoreCode(c,{...customer,code:rotating.code})),
    tx(async c=>{const fresh=createStoreCode();const result=await c.query("update lc_store_certification_codes set code_hash=$2,last_four=$3 where id=$1 and status='unused' returning id",[rotating.id,fresh.hash,fresh.lastFour]);return result.rows.length;})
  ]);
  const row=(await pool.query('select status,code_hash from lc_store_certification_codes where id=$1',[rotating.id])).rows[0];
  assert.ok(row.status==='reserved'?row.code_hash===rotating.hash:outcomes[0].status==='rejected');
  console.log('PASS concurrent rotation and reservation');
  const pack=randomUUID(),purchaseId=randomUUID();
  await pool.query("insert into lc_store_certification_code_batches(id,store_dossier_id,profile_id,source,entitlement_key) values($1,$2,$3,'addon',$4)",[pack,store,legacyOwner,'addon:'+pack]);
  await pool.query("insert into lc_service_purchases(id,profile_id,target_id,product_type,amount_fen,status) values($1,$2,$3,'store_code_pack',9000,'paid')",[purchaseId,legacyOwner,pack]);
  const purchase={id:purchaseId,profile_id:legacyOwner,target_id:pack,product_type:'store_code_pack'};
  await Promise.all([1,2,3,4].map(()=>tx(c=>fulfillStoreCodePack(c,purchase))));
  assert.equal(Number((await pool.query('select count(*) as n from lc_store_certification_codes where batch_id=$1',[pack])).rows[0].n),11);
  console.log('PASS concurrent duplicate payment fulfillment grants eleven slots');
  const rc=createStoreCode(),person=await dm();
  const rid=(await pool.query('update lc_store_certification_codes set code_hash=$2,last_four=$3 where batch_id=$1 and slot=1 returning id',[pack,rc.hash,rc.lastFour])).rows[0].id;
  await tx(c=>reserveStoreCode(c,{...person,code:rc.code}));
  await Promise.allSettled([
    tx(c=>consumeStoreCode(c,{...person,codeId:rid,reviewerId:legacyOwner})),
    tx(async c=>{await c.query("update lc_service_purchases set status='refunded' where id=$1",[purchaseId]);await revokeRefundedStorePurchase(c,purchaseId);}),
  ]);
  const final=(await pool.query('select status from lc_store_certification_codes where id=$1',[rid])).rows[0].status;
  const affiliations=Number((await pool.query("select count(*) as n from lc_dm_store_affiliations where dm_dossier_id=$1 and status='approved'",[person.dossierId])).rows[0].n);
  assert.ok(final==='used'?affiliations===1:final==='revoked'&&affiliations===0);
  assert.equal((await pool.query('select status from lc_store_certification_code_batches where id=$1',[pack])).rows[0].status,'revoked');
  assert.equal(Number((await pool.query("select count(*) as n from lc_store_certification_codes where batch_id=$1 and status in ('unused','reserved')",[pack])).rows[0].n),0);
  console.log('PASS concurrent refund and approval preserve consistent relationship and non-reusable quota');
  const audit=(await pool.query('select new_snapshot from lc_critical_change_journal')).rows;
  assert.ok(!JSON.stringify(audit).includes('JML-'));
  console.log('PASS no plaintext codes in real PostgreSQL audit');
} finally { await pool.end(); }
