import { randomUUID } from 'node:crypto';
import type { Express, Request, RequestHandler, Response } from 'express';
import { createStoreCode, lockActiveStore, lockStoreEntitlements, reserveStoreCode, revokeStoreEntitlement, type StoreSql } from './storeCertification.js';

type Profile = { id: string; phone_verified_at?: string | null; wechat_mini_openid?: string | null };
type Pool = StoreSql & { connect(): Promise<StoreSql & { release(): void }> };
type Dependencies = {
  pool: Pool; auth: RequestHandler; admin: RequestHandler; rateLimit: RequestHandler;
  getProfile(req: Request): Promise<Profile | null>;
  audit(req: Request, event: { action: string; targetType: string; targetId?: string; metadata?: Record<string, unknown> }): Promise<unknown>;
  error(error: unknown): unknown;
};

export function registerStoreCertificationRoutes(app: Express, deps: Dependencies) {
  async function transaction<T>(fn: (db: StoreSql) => Promise<T>) {
    const db = await deps.pool.connect();
    try {
      await db.query('begin');
      await lockStoreEntitlements(db);
      const result = await fn(db);
      await db.query('commit');
      return result;
    } catch (error) {
      await db.query('rollback');
      throw error;
    } finally { db.release(); }
  }
  async function owner(req: Request) {
    const profile = await deps.getProfile(req);
    if (!profile) throw Object.assign(new Error('请先登录'),{statusCode:401});
    return profile;
  }
  function handle(fn: (req: Request,res: Response) => Promise<unknown>): RequestHandler {
    return (req,res) => {
      res.setHeader('Cache-Control','private, no-store');
      if (req.params.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(req.params.id))) {
        res.status(400).json(deps.error(new Error('对象编号不正确')));
        return;
      }
      void fn(req,res).catch(error => {
      res.status(Number(error?.statusCode || 500)).json(deps.error(error));
    }); };
  }
  function paidIdentity(profile: Profile) {
    if (!profile.phone_verified_at || !profile.wechat_mini_openid) {
      throw Object.assign(new Error('请先在微信小程序登录并完成手机号验证'),{statusCode:403});
    }
  }

  app.get('/api/lc/store-certifications/mine',deps.auth,handle(async(req,res) => {
    const profile = await owner(req);
    const stores = await deps.pool.query(
      `select c.store_dossier_id,c.status,c.source,c.approved_at,c.revoke_reason,d.dm_name as name,d.city
       from lc_store_certifications c join lc_dm_dossiers d on d.id=c.store_dossier_id where c.profile_id=$1 order by c.created_at`, [profile.id]);
    const batches = await deps.pool.query(
      `select b.id,b.store_dossier_id,b.source,b.status,b.revealed_at,b.created_at,
        p.id as purchase_id,p.status as payment_status
       from lc_store_certification_code_batches b left join lc_service_purchases p on p.target_id=b.id
        and p.product_type='store_code_pack' and p.profile_id=b.profile_id
       where b.profile_id=$1 order by b.created_at desc`, [profile.id]);
    const codes = await deps.pool.query(
      `select c.id,c.batch_id,c.slot,c.last_four,c.status,c.used_at,c.reserved_at,d.dm_name as dm_name
       from lc_store_certification_codes c join lc_store_certification_code_batches b on b.id=c.batch_id
       left join lc_dm_dossiers d on d.id=c.dm_dossier_id where b.profile_id=$1 order by c.slot`, [profile.id]);
    res.setHeader('Cache-Control','private, no-store');
    return res.json({success:true,data:{stores:stores.rows,batches:batches.rows,codes:codes.rows}});
  }));

  app.post('/api/lc/store-certifications/:id/code-packs',deps.auth,deps.rateLimit,handle(async(req,res) => {
    const profile = await owner(req);
    paidIdentity(profile);
    const batch = await transaction(async db => {
      await lockActiveStore(db,String(req.params.id),profile.id);
      // Serialize taps per owner/store, reusing a still-unpaid pack.
      await db.query('select pg_advisory_xact_lock(hashtext($1))',['store-pack:'+req.params.id]);
      const existing = await db.query(
        `select id from lc_store_certification_code_batches where store_dossier_id=$1 and profile_id=$2
         and source='addon' and status='pending' order by created_at desc limit 1`,[req.params.id,profile.id]);
      if (existing.rows[0]) return existing.rows[0];
      const id = randomUUID();
      const result = await db.query(
        `insert into lc_store_certification_code_batches(id,store_dossier_id,profile_id,source,entitlement_key)
         values($1,$2,$3,'addon',$4) returning id`,[id,req.params.id,profile.id,'addon:'+id]);
      return result.rows[0];
    });
    await deps.audit(req,{action:'store_code_pack_created',targetType:'store_code_batch',targetId:String(batch.id)});
    return res.json({success:true,data:{...batch,amount_yuan:'90.00',quantity:11}});
  }));

  app.post('/api/lc/store-code-batches/:id/reveal',deps.auth,deps.rateLimit,handle(async(req,res) => {
    const profile = await owner(req);
    const revealed = await transaction(async db => {
      const found = await db.query('select store_dossier_id from lc_store_certification_code_batches where id=$1 and profile_id=$2',[req.params.id,profile.id]);
      if (!found.rows[0]) throw Object.assign(new Error('认证码批次不存在'),{statusCode:404});
      await lockActiveStore(db,String(found.rows[0].store_dossier_id),profile.id);
      const batch = await db.query('select * from lc_store_certification_code_batches where id=$1 for update',[req.params.id]);
      if (batch.rows[0].status !== 'issued') throw Object.assign(new Error('加购包尚未支付或已撤销'),{statusCode:409});
      const slots = await db.query('select id from lc_store_certification_codes where batch_id=$1 and code_hash is null and status=\'unused\' order by slot for update',[req.params.id]);
      const result: Array<{id:string;code:string}> = [];
      for (const slot of slots.rows) {
        const generated = createStoreCode();
        await db.query('update lc_store_certification_codes set code_hash=$2,last_four=$3,updated_at=now() where id=$1',[slot.id,generated.hash,generated.lastFour]);
        result.push({id:String(slot.id),code:generated.code});
      }
      await db.query('update lc_store_certification_code_batches set revealed_at=coalesce(revealed_at,now()) where id=$1',[req.params.id]);
      return result;
    });
    await deps.audit(req,{action:'store_codes_revealed',targetType:'store_code_batch',targetId:String(req.params.id),metadata:{count:revealed.length}});
    res.setHeader('Cache-Control','private, no-store');
    return res.json({success:true,data:{codes:revealed}});
  }));

  app.post('/api/lc/store-codes/:id/regenerate',deps.auth,deps.rateLimit,handle(async(req,res) => {
    const profile = await owner(req);
    const result = await transaction(async db => {
      const found = await db.query(`select b.store_dossier_id from lc_store_certification_codes c
        join lc_store_certification_code_batches b on b.id=c.batch_id where c.id=$1 and b.profile_id=$2 and b.status='issued'`,[req.params.id,profile.id]);
      if (!found.rows[0]) throw Object.assign(new Error('认证码不存在'),{statusCode:404});
      await lockActiveStore(db,String(found.rows[0].store_dossier_id),profile.id);
      const code = createStoreCode();
      const updated = await db.query(`update lc_store_certification_codes set code_hash=$2,last_four=$3,updated_at=now()
        where id=$1 and status='unused' returning id`,[req.params.id,code.hash,code.lastFour]);
      if (!updated.rows[0]) throw Object.assign(new Error('只有未使用、未预留的码可以重置'),{statusCode:409});
      return {id:String(updated.rows[0].id),code:code.code};
    });
    await deps.audit(req,{action:'store_code_regenerated',targetType:'store_code',targetId:result.id});
    res.setHeader('Cache-Control','private, no-store');
    return res.json({success:true,data:result});
  }));

  app.post('/api/lc/dm-dossiers/:id/store-code-preview',deps.auth,deps.rateLimit,handle(async(req,res) => {
    const profile = await owner(req);
    paidIdentity(profile);
    const result = await transaction(async db => {
      const dossier = await db.query(`select id from lc_dm_dossiers where id=$1 and entity_type='dm'
        and status='approved' and claim_status not in ('approved','pending') for update`,[req.params.id]);
      if (!dossier.rows[0]) throw Object.assign(new Error('DM档案不可认领'),{statusCode:409});
      return reserveStoreCode(db,{code:String(req.body?.code || ''),profileId:profile.id,dossierId:String(req.params.id),preview:true});
    });
    return res.json({success:true,data:result ? {store_name:result.storeName} : null});
  }));

  app.put('/api/lc/admin/store-certifications/:id/revoke',deps.auth,deps.admin,handle(async(req,res) => {
    const reason = String(req.body?.reason || '').trim().slice(0,500);
    if (reason.length < 6) throw Object.assign(new Error('请至少写6个字说明撤销原因'),{statusCode:400});
    await transaction(db => revokeStoreEntitlement(db,String(req.params.id),reason));
    await deps.audit(req,{action:'store_certification_revoked',targetType:'store_dossier',targetId:String(req.params.id),metadata:{reason}});
    return res.json({success:true});
  }));
}
