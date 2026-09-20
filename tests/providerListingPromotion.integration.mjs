// Run only in a newly created isolated database; never against production.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
const { approveProviderListing, getListingPromotion } = await import(process.env.PROMOTION_MODULE || '../dist-server/api/providerListingPromotion.js');
if (!/^jumulu_listing_test_[a-z0-9_]+$/.test(process.env.PGDATABASE || '')) throw new Error('An isolated jumulu_listing_test_* database is required');
process.env.PROVIDER_LISTING_FREE_CAMPAIGN_ENABLED = '1';
const pool = new pg.Pool({ max: 16 });
const draft = { poster_url: 'https://example.test/poster.png', headline: '测试', description: '', height_cm: null, weight_kg: null, role_types: ['演绎'] };
async function applicant(phone) {
  const profileId = randomUUID(), reviewId = randomUUID();
  await pool.query('insert into lc_profiles(id,phone,phone_verified_at) values($1,$2,now())', [profileId,phone || profileId]);
  await pool.query('insert into lc_public_reviews(id) values($1)', [reviewId]);
  return { profileId,reviewId,draft,businessContact:'test-only',contactAvailable:true,active:true };
}
async function approve(input, abort = false) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("set local statement_timeout='15s'");
    await client.query('set local role lingqi_app');
    await approveProviderListing(client,input);
    if (abort) throw new Error('test rollback');
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
try {
  const database = (await pool.query('select current_database() as name')).rows[0].name;
  assert.equal(database, process.env.PGDATABASE);
  await pool.query(`create table lc_profiles(id uuid primary key,phone text,phone_verified_at timestamptz,merged_into uuid,is_banned boolean);
    create table lc_public_reviews(id uuid primary key);
    create table lc_service_purchases(id uuid primary key,profile_id uuid,target_id uuid,product_type text,status text);
    create table lc_provider_listings(profile_id uuid primary key,poster_url text,headline text,description text,height_cm smallint,weight_kg smallint,role_types text[],is_active boolean,initial_purchase_id uuid,updated_at timestamptz);
    create table lc_provider_contacts(profile_id uuid primary key,business_contact text,is_available boolean,reviewed_at timestamptz,updated_at timestamptz);
    grant select,insert,update on lc_profiles,lc_public_reviews,lc_service_purchases,lc_provider_listings,lc_provider_contacts to lingqi_app;`);
  // Model production DEFAULT PRIVILEGES: the migration must still forbid updates/deletes.
  await pool.query('alter default privileges in schema public grant all on tables to lingqi_app');
  const migration = await readFile(process.env.PROMOTION_MIGRATION || 'supabase/migrations/20260920120946_provider_listing_first_100_year.sql','utf8');
  await pool.query(migration);
  await pool.query(migration); // migration is safely repeatable.
  const first = await applicant('identity-first');
  process.env.PROVIDER_LISTING_FREE_CAMPAIGN_ENABLED = '0';
  assert.equal((await getListingPromotion(pool,{id:first.profileId})).eligible,false);
  await assert.rejects(approve(first),/尚未开放/);
  process.env.PROVIDER_LISTING_FREE_CAMPAIGN_ENABLED = '1';
  await Promise.all([approve(first),approve(first)]);
  const initial = (await pool.query('select * from lc_provider_listing_free_grants where profile_id=$1',[first.profileId])).rows[0];
  assert.equal(initial.slot,1);
  assert.equal(initial.expires_at - initial.started_at,365*86400000);
  await approve({...first,active:false}); await approve({...first,active:true});
  assert.equal((await pool.query('select expires_at from lc_provider_listing_free_grants where profile_id=$1',[first.profileId])).rows[0].expires_at.toISOString(),initial.expires_at.toISOString());
  await assert.rejects(approve(await applicant('identity-first')),/已使用免费名额/);
  const rollback = await applicant();
  await assert.rejects(approve(rollback,true),/test rollback/);
  assert.equal((await pool.query('select count(*)::int as n from lc_provider_listing_free_grants')).rows[0].n,1);
  assert.equal((await pool.query('select count(*)::int as n from lc_provider_listings where profile_id=$1',[rollback.profileId])).rows[0].n,0);
  const legacy = await applicant();
  await pool.query('insert into lc_provider_listings(profile_id,poster_url,is_active) values($1,$2,true)',[legacy.profileId,draft.poster_url]);
  await approve(legacy);
  const paid = await applicant();
  await pool.query("insert into lc_service_purchases values($1,$2,$2,'provider_listing','paid')",[randomUUID(),paid.profileId]);
  await approve(paid);
  assert.equal((await pool.query('select count(*)::int as n from lc_provider_listing_free_grants')).rows[0].n,1);
  const candidates = await Promise.all(Array.from({length:100},()=>applicant()));
  const outcomes = await Promise.allSettled(candidates.map(input=>approve(input)));
  assert.equal(outcomes.filter(item=>item.status==='fulfilled').length,99);
  assert.equal(outcomes.filter(item=>item.status==='rejected').length,1);
  const summary = (await pool.query('select count(*)::int as count,max(slot)::int as max from lc_provider_listing_free_grants')).rows[0];
  assert.deepEqual(summary,{count:100,max:100});
  const failed = candidates[outcomes.findIndex(item=>item.status==='rejected')];
  await pool.query("insert into lc_service_purchases values($1,$2,$2,'provider_listing','paid')",[randomUUID(),failed.profileId]);
  await approve(failed);
  assert.equal((await getListingPromotion(pool,{id:failed.profileId})).remaining,0);
  // Only this isolated test database is altered to model expiry.
  await pool.query("update lc_provider_listing_free_grants set started_at=now()-interval '366 days',expires_at=now()-interval '1 day' where profile_id=$1",[first.profileId]);
  await pool.query("update lc_provider_listings set free_listing_expires_at=now()-interval '1 day' where profile_id=$1",[first.profileId]);
  await assert.rejects(approve(first),/免费上架已到期/);
  assert.equal((await pool.query("select has_table_privilege('lingqi_app','lc_provider_listing_free_grants','DELETE') as allowed")).rows[0].allowed,false);
  console.log('PASS: real PostgreSQL grants, application-role permissions, 100-way concurrency, idempotency, identity deduplication, rollback, 365-day expiry, legacy/paid protection and late payment.');
} finally { await pool.end(); }
