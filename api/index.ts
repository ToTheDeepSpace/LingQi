/// <reference types="node" />
// 灵契 API — Vercel Serverless
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';

// --- 环境变量 ---
const JWT_SECRET = process.env.JWT_SECRET || 'lingqi-dev-secret-change-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json());

// --- 工具函数 ---
function ok(d?: unknown) { return { success: true, data: d }; }
function err(e: unknown) { return { success: false, error: e instanceof Error ? e.message : String(e) }; }

// --- JWT 鉴权中间件 ---
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json(err(new Error('请先登录')));
  }
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { creatorId: string; role?: string };
    (req as Record<string, unknown>).creatorId = decoded.creatorId;
    (req as Record<string, unknown>).role = decoded.role || 'creator';
    next();
  } catch {
    return res.status(401).json(err(new Error('登录已过期，请重新登录')));
  }
}

function adminMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if ((req as Record<string, unknown>).role !== 'admin') {
    return res.status(403).json(err(new Error('无管理员权限')));
  }
  next();
}

function getReq<T extends string = string>(req: express.Request, key: string): T {
  return (req as Record<string, unknown>)[key] as T;
}

// --- 健康检查 ---
app.get('/api/health', (_req, res) => res.json(ok({ status: '灵契 running' })));

// ==================== 创作者认证 ====================

app.post('/api/lc/auth', async (req, res) => {
  try {
    const { phone, password, displayName } = req.body;
    if (!phone || !password) {
      return res.status(400).json(err(new Error('请填写手机号和密码')));
    }

    const { data: existing } = await supabase.from('lc_profiles').select('*').eq('phone', phone).maybeSingle();

    if (existing) {
      if (!existing.password_hash) {
        return res.status(401).json(err(new Error('该账号未设置密码，请先注册')));
      }
      const valid = await bcrypt.compare(password, existing.password_hash);
      if (!valid) return res.status(401).json(err(new Error('密码错误')));

      if (displayName) {
        await supabase.from('lc_profiles').update({ display_name: displayName }).eq('id', existing.id);
      }

      const token = jwt.sign({ creatorId: existing.id, role: 'creator' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json(ok({ id: existing.id, display_name: displayName || existing.display_name, phone: existing.phone, token }));
    }

    // 注册
    const passwordHash = await bcrypt.hash(password, 10);
    const { data: profile } = await supabase.from('lc_profiles')
      .insert({ phone, display_name: displayName || '用户', password_hash: passwordHash })
      .select().single();

    if (!profile) return res.status(500).json(err(new Error('注册失败')));

    const token = jwt.sign({ creatorId: profile.id, role: 'creator' }, JWT_SECRET, { expiresIn: '7d' });
    res.json(ok({ id: profile.id, display_name: profile.display_name, phone: profile.phone, token }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 创作者列表（分页） ====================

app.get('/api/lc/creators', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const { data, count } = await supabase
      .from('lc_profiles')
      .select('*', { count: 'exact' })
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    res.json(ok({
      items: data || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 单个创作者详情 ====================

app.get('/api/lc/creators/:id', async (req, res) => {
  try {
    const { data: profile } = await supabase.from('lc_profiles').select('*').eq('id', req.params.id).single();
    if (!profile) return res.status(404).json(err(new Error('创作者不存在')));

    const [{ data: services }, { data: portfolio }] = await Promise.all([
      supabase.from('lc_services').select('*').eq('creator_id', req.params.id).eq('is_active', true),
      supabase.from('lc_portfolio').select('*').eq('creator_id', req.params.id).order('created_at', { ascending: false }),
    ]);

    res.json(ok({ ...profile, services: services || [], portfolio: portfolio || [] }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 更新创作者资料（需登录） ====================

app.put('/api/lc/creators/:id', authMiddleware, async (req, res) => {
  try {
    if (getReq(req, 'creatorId') !== req.params.id) {
      return res.status(403).json(err(new Error('只能修改自己的资料')));
    }
    const { display_name, avatar, bio, tags, city, social_links, wechat } = req.body;

    await supabase.from('lc_profiles').update({
      display_name, avatar, bio, tags, city, social_links, wechat,
      updated_at: new Date().toISOString(),
    }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 档期管理（需登录） ====================

app.get('/api/lc/creators/:id/availability', async (req, res) => {
  try {
    const { data } = await supabase.from('lc_availability').select('*')
      .eq('creator_id', req.params.id).eq('is_booked', false)
      .gte('date', new Date().toISOString().split('T')[0]).order('date');
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/availability', authMiddleware, async (req, res) => {
  try {
    const { creatorId, date, startTime, endTime, note } = req.body;
    if (getReq(req, 'creatorId') !== creatorId) {
      return res.status(403).json(err(new Error('只能管理自己的档期')));
    }
    const { data } = await supabase.from('lc_availability').insert({
      creator_id: creatorId, date, start_time: startTime, end_time: endTime, note,
    }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.delete('/api/lc/availability/:id', authMiddleware, async (req, res) => {
  try {
    const { data: item } = await supabase.from('lc_availability').select('creator_id').eq('id', req.params.id).single();
    if (!item) return res.status(404).json(err(new Error('档期不存在')));
    if (getReq(req, 'creatorId') !== item.creator_id) {
      return res.status(403).json(err(new Error('只能删除自己的档期')));
    }
    await supabase.from('lc_availability').delete().eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 服务管理（需登录） ====================

app.post('/api/lc/services', authMiddleware, async (req, res) => {
  try {
    const { creatorId, serviceType, price, duration, description } = req.body;
    if (getReq(req, 'creatorId') !== creatorId) {
      return res.status(403).json(err(new Error('只能管理自己的服务')));
    }
    const { data } = await supabase.from('lc_services').insert({
      creator_id: creatorId, service_type: serviceType, price: parseFloat(price), duration, description,
    }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.delete('/api/lc/services/:id', authMiddleware, async (req, res) => {
  try {
    const { data: item } = await supabase.from('lc_services').select('creator_id').eq('id', req.params.id).single();
    if (!item) return res.status(404).json(err(new Error('服务不存在')));
    if (getReq(req, 'creatorId') !== item.creator_id) {
      return res.status(403).json(err(new Error('只能删除自己的服务')));
    }
    await supabase.from('lc_services').delete().eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 作品管理（需登录） ====================

app.post('/api/lc/portfolio', authMiddleware, async (req, res) => {
  try {
    const { creatorId, imageUrl, caption } = req.body;
    if (getReq(req, 'creatorId') !== creatorId) {
      return res.status(403).json(err(new Error('只能管理自己的作品')));
    }
    const { data } = await supabase.from('lc_portfolio').insert({
      creator_id: creatorId, image_url: imageUrl, caption,
    }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.delete('/api/lc/portfolio/:id', authMiddleware, async (req, res) => {
  try {
    const { data: item } = await supabase.from('lc_portfolio').select('creator_id').eq('id', req.params.id).single();
    if (!item) return res.status(404).json(err(new Error('作品不存在')));
    if (getReq(req, 'creatorId') !== item.creator_id) {
      return res.status(403).json(err(new Error('只能删除自己的作品')));
    }
    await supabase.from('lc_portfolio').delete().eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 本地上传（需登录） ====================

app.post('/api/lc/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json(err(new Error('请选择文件')));

    const ext = file.originalname.split('.').pop() || 'png';
    const path = `${getReq(req, 'creatorId')}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from('lc-portfolio').upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from('lc-portfolio').getPublicUrl(path);
    res.json(ok({ url: urlData.publicUrl }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 联系申请 ====================

app.post('/api/lc/contact-request', async (req, res) => {
  try {
    const { creatorId, requesterName, requesterWechat, message } = req.body;
    if (!creatorId || !requesterName || !requesterWechat) {
      return res.status(400).json(err(new Error('缺少必填信息')));
    }
    const { data } = await supabase.from('lc_contact_requests').insert({
      creator_id: creatorId, requester_name: requesterName, requester_wechat: requesterWechat, requester_message: message || null,
    }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/contact-requests/:creatorId', authMiddleware, async (req, res) => {
  try {
    if (getReq(req, 'creatorId') !== req.params.creatorId && getReq(req, 'role') !== 'admin') {
      return res.status(403).json(err(new Error('无权查看')));
    }
    const { data } = await supabase.from('lc_contact_requests').select('*')
      .eq('creator_id', req.params.creatorId).order('created_at', { ascending: false });
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 管理员 ====================

app.post('/api/lc/admin/login', async (req, res) => {
  try {
    if (req.body.password !== ADMIN_PASSWORD) {
      return res.status(401).json(err(new Error('密码错误')));
    }
    const token = jwt.sign({ creatorId: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json(ok({ authed: true, token }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/admin/pending', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const [{ data: profiles }, { data: requests }] = await Promise.all([
      supabase.from('lc_profiles').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('lc_contact_requests').select('*, lc_profiles!inner(display_name)').eq('status', 'pending').order('created_at', { ascending: false }),
    ]);
    res.json(ok({ profiles: profiles || [], contactRequests: requests || [] }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/profile/:id/flag', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_profiles').update({ is_visible: false }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/profile/:id/unflag', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_profiles').update({ is_visible: true }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/contact-requests/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data } = await supabase.from('lc_contact_requests').update({ status: 'approved' }).eq('id', req.params.id).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/contact-requests/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_contact_requests').update({ status: 'rejected' }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

export default app;
