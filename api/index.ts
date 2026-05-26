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

function makeSocialSnapshots(socialLinks: Record<string, string> | null | undefined) {
  const links = socialLinks || {};
  const entries = Object.entries(links).filter(([, url]) => typeof url === 'string' && url.trim());
  return entries.reduce<Record<string, { url: string; platform: string; title: string; description: string; captured_at: string }>>((acc, [key, url]) => {
    const platform = key === 'douyin' ? '抖音' : key === 'xiaohongshu' ? '小红书' : '社交主页';
    acc[key] = {
      url: url.trim(),
      platform,
      title: `${platform}主页`,
      description: '已添加到灵契主页，后续可接入真实网页快照服务。',
      captured_at: new Date().toISOString(),
    };
    return acc;
  }, {});
}

async function getAuthedProfile(req: express.Request) {
  const creatorId = getReq(req, 'creatorId');
  const { data } = await supabase.from('lc_profiles')
    .select('id, display_name, is_realname')
    .eq('id', creatorId)
    .single();
  return data;
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
      .insert({ phone, display_name: displayName || '用户', password_hash: passwordHash, is_visible: true })
      .select().single();

    if (!profile) return res.status(500).json(err(new Error('注册失败')));

    const token = jwt.sign({ creatorId: profile.id, role: 'creator' }, JWT_SECRET, { expiresIn: '7d' });
    res.json(ok({ id: profile.id, display_name: profile.display_name, phone: profile.phone, token }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/me', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabase.from('lc_profiles').select('id, display_name, is_realname, city').eq('id', getReq(req, 'creatorId')).single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/profile/:id/realname', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { value } = req.body;
    await supabase.from('lc_profiles').update({ is_realname: !!value }).eq('id', req.params.id);
    res.json(ok());
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
    const {
      display_name, avatar, bio, tags, city, social_links, wechat,
      available_cities, travel_status, contact_unlock_enabled, contact_intent_amount,
    } = req.body;
    const socialSnapshots = makeSocialSnapshots(social_links);

    await supabase.from('lc_profiles').update({
      display_name, avatar, bio, tags, city, social_links, wechat,
      available_cities: Array.isArray(available_cities) ? available_cities : [],
      travel_status: travel_status || '常驻本地',
      contact_unlock_enabled: !!contact_unlock_enabled,
      contact_intent_amount: Math.max(0, parseInt(contact_intent_amount || 0) || 0),
      social_snapshots: socialSnapshots,
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
    const { creatorId, date, startTime, endTime, note, city, location } = req.body;
    if (getReq(req, 'creatorId') !== creatorId) {
      return res.status(403).json(err(new Error('只能管理自己的档期')));
    }
    const { data } = await supabase.from('lc_availability').insert({
      creator_id: creatorId, date, start_time: startTime, end_time: endTime, note,
      city: city || null, location: location || null,
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
    const { creatorId, requesterName, requesterWechat, message, intentAmount, paymentProof } = req.body;
    if (!creatorId || !requesterName || !requesterWechat) {
      return res.status(400).json(err(new Error('缺少必填信息')));
    }
    const { data } = await supabase.from('lc_contact_requests').insert({
      creator_id: creatorId, requester_name: requesterName, requester_wechat: requesterWechat, requester_message: message || null,
      intent_amount: Math.max(0, parseInt(intentAmount || 0) || 0),
      payment_proof: paymentProof || null,
    }).select().single();
    res.json(ok(data));
  } catch (e) { res.status(500).json(err(e)); }
});

// ==================== 委托需求墙 ====================

app.get('/api/lc/commissions', async (req, res) => {
  try {
    const city = req.query.city as string;
    const targetType = req.query.targetType as string;
    let query = supabase.from('lc_commissions')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (city && city !== 'all') query = query.eq('city', city);
    if (targetType && targetType !== 'all') query = query.eq('target_type', targetType);
    const { data, error: qErr } = await query;
    if (qErr) throw qErr;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/commissions/mine', authMiddleware, async (req, res) => {
  try {
    const posterId = getReq(req, 'creatorId');
    const { data, error: qErr } = await supabase.from('lc_commissions')
      .select('*')
      .eq('poster_id', posterId)
      .order('created_at', { ascending: false });
    if (qErr) throw qErr;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/commissions', authMiddleware, async (req, res) => {
  try {
    const {
      title, content, desiredRole, targetType, neededDate,
      city, location, budget, contactNote, aiAssistContext,
    } = req.body;
    if (!title || !content) return res.status(400).json(err(new Error('请填写标题和需求内容')));

    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));

    const { data, error: insErr } = await supabase.from('lc_commissions').insert({
      poster_id: profile.id,
      poster_name: profile.display_name,
      poster_is_realname: !!profile.is_realname,
      title,
      content,
      desired_role: desiredRole || null,
      target_type: targetType || null,
      needed_date: neededDate || null,
      city: city || null,
      location: location || null,
      budget: budget || null,
      contact_note: contactNote || null,
      ai_assist_context: aiAssistContext || {},
    }).select().single();
    if (insErr) throw insErr;

    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.delete('/api/lc/commissions/:id', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('请先登录')));

    const { data: item } = await supabase.from('lc_commissions').select('poster_id').eq('id', req.params.id).single();
    if (!item) return res.status(404).json(err(new Error('委托不存在')));
    if (item.poster_id !== profile.id && getReq(req, 'role') !== 'admin') {
      return res.status(403).json(err(new Error('无权删除')));
    }

    await supabase.from('lc_commissions').delete().eq('id', req.params.id);
    res.json(ok({ deleted: true }));
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
    const [{ data: profiles }, { data: requests }, { data: rankings }, { data: comments }, { data: claims }, { data: commissions }] = await Promise.all([
      supabase.from('lc_profiles').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('lc_contact_requests').select('*, lc_profiles!inner(display_name)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_rankings').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_comments').select('*, lc_rankings(subject_name, type)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_claims').select('*, lc_rankings(subject_name, type)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('lc_commissions').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    ]);
    res.json(ok({
      profiles: profiles || [],
      contactRequests: requests || [],
      rankings: rankings || [],
      comments: comments || [],
      claims: claims || [],
      commissions: commissions || [],
    }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/profile/:id/flag', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = req.body?.rejectReason || null;
    await supabase.from('lc_profiles').update({ is_visible: false, reject_reason: rejectReason }).eq('id', req.params.id);
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

// ==================== 红黑榜 ====================

app.get('/api/lc/rankings', async (req, res) => {
  try {
    const type = req.query.type as string;
    const city = req.query.city as string;
    const subjectType = req.query.subjectType as string;
    let query = supabase.from('lc_rankings').select('*').eq('status', 'approved').order('created_at', { ascending: false });
    if (type && type !== 'all') query = query.eq('type', type);
    if (subjectType && subjectType !== 'all') query = query.eq('subject_type', subjectType);
    if (city && city !== 'all') query = query.eq('subject_city', city);

    // 过滤已过期的黑榜（除非被豁免）
    query = query.or(
      `type.eq.red,and(type.eq.black,or(expires_at.gt.now(),expiry_override.not.is.null))`
    );

    const { data } = await query;
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings', authMiddleware, async (req, res) => {
  try {
    const { type, subjectName, subjectType, subjectCity, subjectUrl, content, initialAmount, paymentProof, newSubject, files } = req.body;
    if (!type || !subjectName || !subjectType || !content || !initialAmount) {
      return res.status(400).json(err(new Error('缺少必填字段')));
    }
    const amount = parseInt(initialAmount);
    if (amount < 10 || amount > 100) return res.status(400).json(err(new Error('金额须在10~100元之间')));

    // 余额支付
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    if ((profile.balance || 0) < amount) return res.status(402).json(err(new Error('余额不足，请先充值')));

    const posterId = getReq(req, 'creatorId');

    // 扣款
    await supabase.from('lc_profiles')
      .update({ balance: (profile.balance || 0) - amount })
      .eq('id', profile.id);

    await supabase.from('lc_transactions').insert({
      profile_id: profile.id, type: 'spend', amount: -amount,
      description: `发布${type === 'red' ? '红榜' : '黑榜'}：${subjectName}`,
      status: 'approved',
    });

    const row: Record<string, unknown> = {
      type, subject_name: subjectName, subject_type: subjectType, subject_city: subjectCity || null,
      subject_url: subjectUrl || null, content,
      author_name: profile.display_name, poster_id: posterId,
      initial_amount: amount, payment_proof: paymentProof || null,
      is_realname: !!profile.is_realname, real_name: null,
      files: files || [],
    };

    // 黑榜 30 天过期
    if (type === 'black') {
      row.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: ranking, error: insErr } = await supabase.from('lc_rankings').insert(row).select().single();

    if (insErr) throw insErr;

    if (newSubject && ranking && newSubject.name) {
      await supabase.from('lc_submitted_subjects').insert({
        name: newSubject.name, subject_type: newSubject.subject_type || subjectType,
        city: newSubject.city || subjectCity, description: newSubject.description || null,
        contact: newSubject.contact || null, ranking_id: ranking.id,
      });
    }

    res.json(ok({ id: ranking?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/vote', authMiddleware, async (req, res) => {
  try {
    const { voteType } = req.body;
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    if (!['like', 'dislike'].includes(voteType)) return res.status(400).json(err(new Error('无效投票类型')));
    if ((profile.balance || 0) < 1) return res.status(402).json(err(new Error('余额不足，请先充值')));

    const { data: current } = await supabase.from('lc_rankings').select('likes, dislikes, status').eq('id', req.params.id).single();
    if (!current || current.status !== 'approved') return res.status(404).json(err(new Error('帖子不存在或未上线')));

    const { data: existingVote } = await supabase.from('lc_votes')
      .select('id')
      .eq('ranking_id', req.params.id)
      .eq('voter_id', profile.id)
      .maybeSingle();
    if (existingVote) return res.status(409).json(err(new Error('你已经投过票了')));

    // 扣款 ¥1
    await supabase.from('lc_profiles').update({ balance: (profile.balance || 0) - 1 }).eq('id', profile.id);
    await supabase.from('lc_transactions').insert({
      profile_id: profile.id, type: 'spend', amount: -1,
      description: `${voteType === 'like' ? '点赞' : '点踩'}红黑榜`,
      status: 'approved',
    });

    const { error: voteErr } = await supabase.from('lc_votes').insert({
      ranking_id: req.params.id, vote_type: voteType,
      voter_ip: req.headers['x-forwarded-for'] as string || req.ip,
      voter_id: profile.id,
      voter_name: profile.display_name,
      voter_is_realname: !!profile.is_realname,
    });
    if (voteErr) {
      if (voteErr.code === '23505') return res.status(409).json(err(new Error('你已经投过票了')));
      throw voteErr;
    }

    const field = voteType === 'like' ? 'likes' : 'dislikes';
    const val   = voteType === 'like' ? (current.likes || 0) + 1 : (current.dislikes || 0) + 1;
    await supabase.from('lc_rankings').update({ [field]: val }).eq('id', req.params.id);

    res.json(ok({ likes: voteType === 'like' ? val : current.likes, dislikes: voteType === 'dislike' ? val : current.dislikes }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.get('/api/lc/rankings/:id/votes', async (req, res) => {
  try {
    const { data } = await supabase.from('lc_votes')
      .select('id, vote_type, voter_name, voter_is_realname, created_at')
      .eq('ranking_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(100);
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

// ── 评论 ──

app.get('/api/lc/rankings/:id/comments', async (req, res) => {
  try {
    const { data } = await supabase.from('lc_comments')
      .select('id, content, author_name, is_realname, real_name, likes, created_at')
      .eq('ranking_id', req.params.id).eq('status', 'approved')
      .order('created_at', { ascending: true });
    res.json(ok(data || []));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json(err(new Error('缺少评论内容')));
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    if ((profile.balance || 0) < 1) return res.status(402).json(err(new Error('余额不足，请先充值')));

    // 扣款 ¥1
    await supabase.from('lc_profiles').update({ balance: (profile.balance || 0) - 1 }).eq('id', profile.id);
    await supabase.from('lc_transactions').insert({
      profile_id: profile.id, type: 'spend', amount: -1,
      description: '发表红黑榜评论',
      status: 'approved',
    });

    const { data, error: insErr } = await supabase.from('lc_comments').insert({
      ranking_id: req.params.id, content, author_id: profile.id, author_name: profile.display_name,
      is_realname: !!profile.is_realname, real_name: null,
    }).select().single();
    if (insErr) throw insErr;
    res.json(ok({ id: data?.id }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/rankings/:id/comments/:cid/like', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: c } = await supabase.from('lc_comments').select('likes').eq('id', req.params.cid).eq('ranking_id', req.params.id).single();
    if (!c) return res.status(404).json(err(new Error('评论不存在')));
    const { error: voteErr } = await supabase.from('lc_comment_votes').insert({ comment_id: req.params.cid, voter_id: profile.id });
    if (voteErr) {
      if (voteErr.code === '23505') return res.status(409).json(err(new Error('你已经赞过这条评论了')));
      throw voteErr;
    }
    const newLikes = (c.likes || 0) + 1;
    await supabase.from('lc_comments').update({ likes: newLikes }).eq('id', req.params.cid);
    res.json(ok({ likes: newLikes }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ── 我是相关方 ──

app.post('/api/lc/rankings/:id/claim', authMiddleware, async (req, res) => {
  try {
    const { contact, message } = req.body;
    if (!contact) return res.status(400).json(err(new Error('请填写联系方式')));
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    await supabase.from('lc_claims').insert({
      ranking_id: req.params.id, contact, message: message || null,
      claimant_id: profile.id, claimant_name: profile.display_name,
    });
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ── 管理 ──

app.put('/api/lc/admin/rankings/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data: r } = await supabase.from('lc_rankings').select('initial_amount').eq('id', req.params.id).single();
    if (!r) return res.status(404).json(err(new Error('帖子不存在')));
    await supabase.from('lc_rankings').update({ status: 'approved', likes: r.initial_amount }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/rankings/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_rankings').update({ status: 'rejected' }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/comments/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_comments').update({ status: 'approved' }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/comments/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_comments').update({ status: 'rejected' }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/claims/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_claims').update({ status: 'approved' }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/claims/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_claims').update({ status: 'rejected' }).eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/commissions/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await supabase.from('lc_commissions')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

app.put('/api/lc/admin/commissions/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rejectReason = req.body?.rejectReason || null;
    await supabase.from('lc_commissions')
      .update({ status: 'rejected', reject_reason: rejectReason, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    res.json(ok());
  } catch (e) { res.status(500).json(err(e)); }
});

// ── 钱包 ──

app.get('/api/lc/wallet', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    const { data: txs } = await supabase.from('lc_transactions')
      .select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(50);
    res.json(ok({ balance: profile.balance || 0, transactions: txs || [] }));
  } catch (e) { res.status(500).json(err(e)); }
});

app.post('/api/lc/wallet/recharge', authMiddleware, async (req, res) => {
  try {
    const { amount, paymentProof } = req.body;
    if (!amount || amount < 10) return res.status(400).json(err(new Error('充值金额最低 ¥10')));
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('用户不存在')));
    await supabase.from('lc_transactions').insert({
      profile_id: profile.id, type: 'recharge', amount: parseInt(amount),
      description: '余额充值', payment_proof: paymentProof || null,
      status: 'pending',
    });
    res.json(ok({ message: '充值申请已提交，管理员审核后到账' }));
  } catch (e) { res.status(500).json(err(e)); }
});

// ── 艾特解析 ──

app.get('/api/lc/profiles/lookup', async (req, res) => {
  try {
    const name = req.query.name as string;
    if (!name) return res.status(400).json(err(new Error('缺少 name 参数')));
    const { data } = await supabase.from('lc_profiles')
      .select('id, display_name').eq('display_name', name).maybeSingle();
    res.json(ok(data || null));
  } catch (e) { res.status(500).json(err(e)); }
});

// ── 文件上传 ──

app.post('/api/lc/upload', authMiddleware, async (req, res) => {
  try {
    const profile = await getAuthedProfile(req);
    if (!profile) return res.status(401).json(err(new Error('请先登录')));
    // 简单文件大小检查（由前端限制 + 此处兜底）
    res.json(ok({ message: '上传功能请在客户端通过 Supabase Storage 直接上传' }));
  } catch (e) { res.status(500).json(err(e)); }
});

export default app;
