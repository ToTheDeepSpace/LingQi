import { createHash, randomInt } from 'node:crypto';

export const STORE_CODE_PACK_SIZE = 11;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export type StoreSql = {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};
// All entitlement mutations acquire this before row locks. Payment callbacks,
// reviews, redemption, rotation and refunds use the same lock ordering.
export async function lockStoreEntitlements(db: StoreSql) {
  await db.query("select pg_advisory_xact_lock(hashtext('jumulu_store_entitlements'))");
}
const failure = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });

export function normalizeStoreCode(value: unknown) {
  return String(value || '').trim().toUpperCase();
}
export function hashStoreCode(value: unknown) {
  const code = normalizeStoreCode(value);
  if (!/^JML-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)) throw failure('请输入完整的店家认证码', 400);
  return createHash('sha256').update(code).digest('hex');
}
export function createStoreCode() {
  const random = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  const code = 'JML-' + random.slice(0, 4) + '-' + random.slice(4);
  return { code, hash: hashStoreCode(code), lastFour: random.slice(-4) };
}

export async function lockActiveStore(db: StoreSql, storeId: string, ownerId?: string) {
  const result = await db.query(
    `select c.*, d.dm_name from lc_store_certifications c
       join lc_dm_dossiers d on d.id=c.store_dossier_id
       join lc_profiles p on p.id=c.profile_id
      where c.store_dossier_id=$1 and c.status='approved'
        and d.status='approved' and d.claim_status='approved' and d.claimed_by=c.profile_id
        and coalesce(p.is_banned,false)=false and p.merged_into is null
        and ($2::uuid is null or c.profile_id=$2)
      for share of c`, [storeId, ownerId || null],
  );
  if (!result.rows[0]) throw failure('店家未完成有效认证，或你不是该店经营者', 403);
  return result.rows[0];
}

// Slots are allocated during fulfillment. Plaintext codes are minted only in the
// owner's one-time reveal response; callbacks never persist usable plaintext.
export async function allocateStoreCodeSlots(db: StoreSql, batchId: string) {
  await db.query(
    `insert into lc_store_certification_codes(batch_id, slot)
     select $1, n from generate_series(1,11) n on conflict(batch_id,slot) do nothing`, [batchId],
  );
}

export async function grantStoreCertification(db: StoreSql, input: {
  storeId: string; profileId: string; purchaseId: string; reviewerId: string | null;
}) {
  const paid = await db.query(
    `select id from lc_service_purchases where id=$1 and profile_id=$2 and target_id=$3
       and product_type='store_certification' and amount_fen=9000 and status='paid' for update`,
    [input.purchaseId, input.profileId, input.storeId],
  );
  if (!paid.rows[0]) throw failure('店家认证需要已确认的90元订单');
  const cert = await db.query(
    `insert into lc_store_certifications(store_dossier_id,profile_id,status,source,purchase_id,reviewed_by,approved_at)
     values($1,$2,'approved','payment',$3,$4,now())
     on conflict(store_dossier_id) do update set status='approved', purchase_id=excluded.purchase_id,
       reviewed_by=excluded.reviewed_by, approved_at=now(), updated_at=now()
       where lc_store_certifications.profile_id=excluded.profile_id
         and lc_store_certifications.status <> 'revoked'
     returning store_dossier_id`, [input.storeId,input.profileId,input.purchaseId,input.reviewerId],
  );
  if (!cert.rows[0]) throw failure('店家认证归属冲突或已撤销，请管理员核对');
  await db.query(
    `update lc_profiles set verified_shop=true,
       identity_roles=array(select distinct unnest(coalesce(identity_roles,'{}'::text[]) || array['shop'])),
       updated_at=now() where id=$1`, [input.profileId],
  );
  const batch = await db.query(
    `insert into lc_store_certification_code_batches(store_dossier_id,profile_id,source,status,purchase_id,entitlement_key)
     values($1::uuid,$2,'initial','issued',$3,'initial:' || ($1::uuid)::text)
     on conflict(entitlement_key) do update set entitlement_key=excluded.entitlement_key returning id`,
    [input.storeId,input.profileId,input.purchaseId],
  );
  await allocateStoreCodeSlots(db, String(batch.rows[0].id));
}

export async function fulfillStoreCodePack(db: StoreSql, purchase: {
  id: string; profile_id: string; target_id: string; product_type: string;
}) {
  if (purchase.product_type !== 'store_code_pack') return;
  const paid = await db.query(
    `select id from lc_service_purchases where id=$1 and profile_id=$2 and target_id=$3
      and product_type='store_code_pack' and amount_fen=9000 and status='paid' for update`,
    [purchase.id,purchase.profile_id,purchase.target_id],
  );
  if (!paid.rows[0]) throw failure('加购需要已确认的90元订单');
  const found = await db.query('select store_dossier_id from lc_store_certification_code_batches where id=$1', [purchase.target_id]);
  if (!found.rows[0]) throw failure('加购包不存在');
  // A payment already settled before suspension must still be recorded exactly
  // once. Revoked stores cannot reveal/redeem; moderation can refund the order.
  const batch = await db.query(
    `update lc_store_certification_code_batches
      set status=case when status='revoked' then 'revoked' else 'issued' end,purchase_id=$2,updated_at=now()
      where id=$1 and profile_id=$3 and source='addon'
      returning id,status`, [purchase.target_id,purchase.id,purchase.profile_id],
  );
  if (!batch.rows[0]) throw failure('加购包状态或归属不正确');
  if (batch.rows[0].status === 'issued') await allocateStoreCodeSlots(db, purchase.target_id);
}

export async function reserveStoreCode(db: StoreSql, input: {
  code?: string; profileId: string; dossierId: string; preview?: boolean;
}) {
  const existing = await db.query(
    `select c.id,b.store_dossier_id from lc_store_certification_codes c
       join lc_store_certification_code_batches b on b.id=c.batch_id
      where c.claimant_id=$1 and c.dm_dossier_id=$2 and c.status='reserved'`,
    [input.profileId,input.dossierId],
  );
  const candidate = input.code
    ? await db.query(
      `select c.id,b.store_dossier_id from lc_store_certification_codes c
       join lc_store_certification_code_batches b on b.id=c.batch_id where c.code_hash=$1`, [hashStoreCode(input.code)])
    : existing;
  if (!candidate.rows[0]) {
    if (input.code) throw failure('认证码无效或不可用', 400);
    return null;
  }
  if (existing.rows[0] && existing.rows[0].id !== candidate.rows[0].id) throw failure('已有绑定本档案的认证码，请直接补材料重提');
  const storeId = String(candidate.rows[0].store_dossier_id);
  const store = await lockActiveStore(db, storeId);
  const conflict = await db.query(
    `select id from lc_dm_store_affiliations where dm_dossier_id=$1
      and status in ('approved','pending') and store_dossier_id<>$2`, [input.dossierId,storeId],
  );
  if (conflict.rows[0]) throw failure('已有其他店家的有效关系或待审申请，请先结束旧关系');
  const code = await db.query(
    `select c.*, b.status as batch_status from lc_store_certification_codes c
       join lc_store_certification_code_batches b on b.id=c.batch_id
       where c.id=$1 for update of c`, [candidate.rows[0].id],
  );
  const row = code.rows[0];
  if (!row || row.batch_status !== 'issued'
    || (input.code && row.code_hash !== hashStoreCode(input.code))
    || (row.status !== 'unused' && !(row.status === 'reserved' && row.claimant_id === input.profileId && row.dm_dossier_id === input.dossierId))) {
    throw failure('认证码已使用、已预留或已失效');
  }
  if (!input.preview) await db.query(
    `update lc_store_certification_codes set status='reserved',claimant_id=$2,dm_dossier_id=$3,
       reserved_at=coalesce(reserved_at,now()),updated_at=now() where id=$1`,
    [row.id,input.profileId,input.dossierId],
  );
  return { id: String(row.id), storeId, storeName: String(store.dm_name) };
}

export async function revokeStoreEntitlement(db: StoreSql, storeId: string, reason: string) {
  const cert = await db.query(
    `update lc_store_certifications set status='revoked',revoked_at=now(),revoke_reason=$2,updated_at=now()
       where store_dossier_id=$1 returning profile_id`, [storeId,reason],
  );
  if (!cert.rows[0]) return;
  await db.query(
    `update lc_store_certification_code_batches set status='revoked',updated_at=now() where store_dossier_id=$1`, [storeId],
  );
  await db.query(
    `update lc_store_certification_codes c set status='revoked',updated_at=now()
       from lc_store_certification_code_batches b where c.batch_id=b.id and b.store_dossier_id=$1
       and c.status in ('unused','reserved')`, [storeId],
  );
  await db.query(
    `update lc_profiles p set verified_shop=exists(select 1 from lc_store_certifications c
       where c.profile_id=p.id and c.status='approved'),updated_at=now() where p.id=$1`, [cert.rows[0].profile_id],
  );
  await db.query(
    `update lc_dm_dossiers set claim_status='withdrawn',updated_at=now()
       where id=$1 and claimed_by=$2`, [storeId,cert.rows[0].profile_id],
  );
}

export async function revokeRefundedStorePurchase(db: StoreSql, purchaseId: string) {
  const cert = await db.query('select store_dossier_id from lc_store_certifications where purchase_id=$1', [purchaseId]);
  if (cert.rows[0]) await revokeStoreEntitlement(db,String(cert.rows[0].store_dossier_id),'认证订单已全额退款');
  await db.query(
    `update lc_store_certification_code_batches set status='revoked',updated_at=now() where purchase_id=$1`, [purchaseId],
  );
  await db.query(
    `update lc_store_certification_codes c set status='revoked',updated_at=now()
       from lc_store_certification_code_batches b where c.batch_id=b.id and b.purchase_id=$1
       and c.status in ('unused','reserved')`, [purchaseId],
  );
}

export async function consumeStoreCode(db: StoreSql, input: {
  codeId: string; profileId: string; dossierId: string; reviewerId: string | null;
}) {
  const found = await db.query(
    `select b.store_dossier_id from lc_store_certification_codes c
       join lc_store_certification_code_batches b on b.id=c.batch_id where c.id=$1`, [input.codeId],
  );
  if (!found.rows[0]) throw failure('认证码记录不存在');
  const storeId = String(found.rows[0].store_dossier_id);
  const store = await lockActiveStore(db, storeId);
  const code = await db.query(
    `select c.*,b.status as batch_status from lc_store_certification_codes c
       join lc_store_certification_code_batches b on b.id=c.batch_id where c.id=$1 for update of c`, [input.codeId],
  );
  const row = code.rows[0];
  if (!row || row.status !== 'reserved' || row.batch_status !== 'issued'
    || row.claimant_id !== input.profileId || row.dm_dossier_id !== input.dossierId) throw failure('认证码不可用于此申请');
  const conflict = await db.query(
    `select id from lc_dm_store_affiliations where dm_dossier_id=$1
       and status in ('approved','pending') and store_dossier_id<>$2`, [input.dossierId,storeId],
  );
  if (conflict.rows[0]) throw failure('DM已有其他店家的有效关系，请先处理冲突');
  await db.query(
    `update lc_dm_store_affiliations set status='cancelled',updated_at=now()
       where dm_dossier_id=$1 and store_dossier_id=$2 and status='pending'`, [input.dossierId,storeId],
  );
  await db.query(
    `insert into lc_dm_store_affiliations(dm_dossier_id,store_dossier_id,dm_profile_id,
       requested_by_profile_id,requested_by_role,request_kind,request_note,status,reviewed_by_profile_id,reviewed_at,started_at)
       select $1,$2,$3,$4,'store','join','店家认证码邀请，平台人工核验通过','approved',$5,now(),now()
       where not exists(select 1 from lc_dm_store_affiliations where dm_dossier_id=$1 and status='approved')`,
    [input.dossierId,storeId,input.profileId,store.profile_id,input.reviewerId],
  );
  await db.query(
    `update lc_dm_dossiers set employment_status='store_affiliated',employer_store_id=$2,workplace=$3,updated_at=now()
       where id=$1`, [input.dossierId,storeId,store.dm_name],
  );
  await db.query(
    `update lc_store_certification_codes set status='used',used_at=now(),updated_at=now() where id=$1`, [input.codeId],
  );
}
