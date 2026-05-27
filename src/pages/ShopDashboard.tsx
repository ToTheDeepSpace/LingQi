import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { AuthData } from '../types';

const API  = '/api';
const C    = '#0F1117';
const C2   = '#1A1D27';
const GOLD = '#d9a857';
const GOLD2 = '#c9922e';

function getAuth(): AuthData | null {
  try {
    const stored = localStorage.getItem('lc_creator');
    if (!stored) return null;
    const data = JSON.parse(stored) as AuthData & { role?: string };
    if (!data.token) return null;
    try {
      const payload = JSON.parse(atob(data.token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) return null;
    } catch { return null; }
    return data;
  } catch { return null; }
}

const card: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(201,146,46,0.18)',
  borderRadius: 16, padding: 24,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px solid rgba(201,146,46,0.2)', outline: 'none',
  backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
  fontSize: '0.875rem', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600,
  color: 'rgba(186,207,231,0.7)', marginBottom: 8,
};

interface ShopProfile {
  id: string;
  display_name: string;
  shop_name: string | null;
  shop_description: string | null;
  contact_phone: string | null;
  contact_wechat: string | null;
  address: string | null;
  juzhanggui_link: string | null;
  role: string;
}

interface Review {
  id: string;
  type: string;
  subject_name: string;
  subject_type: string;
  content: string;
  author_name: string;
  author_is_realname: boolean;
  likes: number;
  dislikes: number;
  shop_reply: string | null;
  appeal_status: string | null;
  appeal_reason: string | null;
  created_at: string;
  status: string;
}

interface Comment {
  id: string;
  ranking_id: string;
  content: string;
  author_name: string;
  created_at: string;
}

export default function ShopDashboard() {
  const navigate = useNavigate();
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    shop_name: '', shop_description: '', contact_phone: '', contact_wechat: '', address: '', juzhanggui_link: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  const [appealOpenId, setAppealOpenId] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [appealSending, setAppealSending] = useState(false);

  const auth = useMemo(() => getAuth(), []);
  const token = auth?.token || '';

  useEffect(() => {
    if (!auth) { navigate('/login'); return; }
    fetch(`${API}/lc/shop/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json().then(d => ({ ok: r.ok, status: r.status, ...d })))
      .then(({ success, status, data, error: errMsg }) => {
        if (!success) {
          if (status === 403) { setError('此功能仅限店家使用'); return; }
          setError(errMsg || '加载失败');
          return;
        }
        const { profile, reviews: revs, comments: cmts } = data;
        if (profile.role !== 'shop') { setError('此功能仅限店家使用'); return; }
        setShop(profile);
        setReviews(revs || []);
        setComments(cmts || []);
        setForm({
          shop_name: profile.shop_name || '',
          shop_description: profile.shop_description || '',
          contact_phone: profile.contact_phone || '',
          contact_wechat: profile.contact_wechat || '',
          address: profile.address || '',
          juzhanggui_link: profile.juzhanggui_link || '',
        });
      })
      .catch(() => setError('网络错误'))
      .finally(() => setLoading(false));
  }, [navigate, auth, token]);

  const saveProfile = async () => {
    if (!shop) return;
    setSaving(true); setSaveMsg('');
    try {
      const r = await fetch(`${API}/lc/shop/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (d.success) { setSaveMsg('已保存'); setTimeout(() => setSaveMsg(''), 2500); }
      else setError(d.error || '保存失败');
    } catch { setError('网络错误'); }
    finally { setSaving(false); }
  };

  const submitReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    setReplySending(true);
    try {
      const r = await fetch(`${API}/lc/shop/review/${reviewId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ replyText: replyText.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        setReviews(prev => prev.map(rv => rv.id === reviewId ? { ...rv, shop_reply: replyText.trim() } : rv));
        setReplyOpenId(null);
        setReplyText('');
      } else { alert(d.error || '回复失败'); }
    } catch { alert('网络错误'); }
    finally { setReplySending(false); }
  };

  const submitAppeal = async (reviewId: string) => {
    if (!appealReason.trim()) return;
    setAppealSending(true);
    try {
      const r = await fetch(`${API}/lc/shop/review/${reviewId}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: appealReason.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        setReviews(prev => prev.map(rv => rv.id === reviewId ? { ...rv, appeal_status: 'pending', appeal_reason: appealReason.trim() } : rv));
        setAppealOpenId(null);
        setAppealReason('');
        alert('已提交申诉');
      } else { alert(d.error || '申诉失败'); }
    } catch { alert('网络错误'); }
    finally { setAppealSending(false); }
  };

  const logout = () => {
    localStorage.removeItem('lc_creator');
    window.dispatchEvent(new Event('lc-auth-changed'));
    navigate('/login');
  };

  if (loading) return (
    <div style={{ backgroundColor: C, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '2px solid rgba(201,146,46,0.3)', borderTopColor: GOLD, borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'rgba(186,207,231,0.65)' }}>加载中...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!shop) return (
    <div style={{ backgroundColor: C, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.3 }}>🏪</div>
        <p style={{ color: 'rgba(186,207,231,0.7)', marginBottom: 20 }}>{error || '此功能仅限店家使用'}</p>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: GOLD, cursor: 'pointer', textDecoration: 'underline', fontSize: '0.875rem' }}>返回首页</button>
      </div>
    </div>
  );

  const reviewComments = (reviewId: string) => comments.filter(c => c.ranking_id === reviewId);

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: '#e0e0e0' }}>

      <div style={{ backgroundColor: C2, borderBottom: '1px solid rgba(201,146,46,0.12)', padding: '24px 20px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 4 }}>
              店家后台
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'rgba(186,207,231,0.65)' }}>{shop.display_name}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link to="/dashboard"
              style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.25)', color: GOLD, fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>
              用户主页 →
            </Link>
            <button onClick={logout}
              style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'rgba(186,207,231,0.55)', cursor: 'pointer', fontSize: '0.82rem' }}>
              退出
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' }}>

        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, fontSize: '0.875rem', color: '#f87171', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* ── 主页信息编辑区 ── */}
        <div style={{ ...card, marginBottom: 32 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 24, color: 'rgba(186,207,231,0.9)' }}>主页信息</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>店名</label>
              <input type="text" value={form.shop_name} onChange={e => setForm({ ...form, shop_name: e.target.value })} placeholder="你的店名" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>联系电话</label>
              <input type="text" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} placeholder="手机号" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>微信</label>
              <input type="text" value={form.contact_wechat} onChange={e => setForm({ ...form, contact_wechat: e.target.value })} placeholder="微信号" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>地址</label>
              <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="店铺地址" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>店铺简介</label>
            <textarea value={form.shop_description} onChange={e => setForm({ ...form, shop_description: e.target.value })} rows={4}
              style={{ ...inputStyle, resize: 'none' }} placeholder="介绍你的店铺特色..." />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>剧司辰主页链接</label>
            <input type="url" value={form.juzhanggui_link} onChange={e => setForm({ ...form, juzhanggui_link: e.target.value })} placeholder="https://jusichen.com/..." style={inputStyle} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={saveProfile} disabled={saving}
              style={{
                padding: '11px 28px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                background: saving ? 'rgba(255,255,255,0.07)' : `linear-gradient(135deg, ${GOLD} 0%, ${GOLD2} 100%)`,
                color: saving ? 'rgba(186,207,231,0.5)' : C, fontWeight: 700, fontSize: '0.9rem',
              }}>
              {saving ? '保存中...' : '保存信息'}
            </button>
            {saveMsg && <span style={{ fontSize: '0.875rem', color: '#34d399', fontWeight: 600 }}>{saveMsg}</span>}
          </div>
        </div>

        {/* ── 剧司辰链接展示 ── */}
        {shop.juzhanggui_link && (
          <div style={{ ...card, marginBottom: 32 }}>
            <h2 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 16, color: 'rgba(186,207,231,0.9)' }}>剧司辰主页</h2>
            <a href={shop.juzhanggui_link} target="_blank" rel="noopener noreferrer"
              style={{ color: GOLD, textDecoration: 'none', fontSize: '0.9rem', wordBreak: 'break-all' }}>
              {shop.juzhanggui_link} ↗
            </a>
          </div>
        )}

        {/* ── 评价列表 ── */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 20, color: 'rgba(186,207,231,0.9)' }}>收到的评价</h2>
          {reviews.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
              <p style={{ color: 'rgba(186,207,231,0.45)', fontSize: '0.9rem' }}>暂无评价</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {reviews.map(review => (
                <div key={review.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px', borderRadius: 4,
                        fontSize: '0.72rem', fontWeight: 700,
                        background: review.type === 'red' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                        color: review.type === 'red' ? '#34d399' : '#f87171',
                        marginRight: 8,
                      }}>
                        {review.type === 'red' ? '红榜' : '黑榜'}
                      </span>
                      <span style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.65)', fontWeight: 600 }}>
                        {review.author_name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '0.78rem', color: 'rgba(52,211,153,0.8)' }}>👍 {review.likes || 0}</span>
                      <span style={{ fontSize: '0.78rem', color: 'rgba(248,113,113,0.8)' }}>👎 {review.dislikes || 0}</span>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(186,207,231,0.4)' }}>
                        {new Date(review.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'rgba(226,238,252,0.82)', lineHeight: 1.7, marginBottom: 10 }}>
                    {review.content}
                  </p>

                  {/* 该评价的评论 */}
                  {reviewComments(review.id).length > 0 && (
                    <div style={{ marginBottom: 10, paddingLeft: 12, borderLeft: '2px solid rgba(201,146,46,0.15)' }}>
                      {reviewComments(review.id).map(cmt => (
                        <div key={cmt.id} style={{ marginBottom: 6 }}>
                          <span style={{ fontSize: '0.78rem', color: 'rgba(186,207,231,0.6)', fontWeight: 600 }}>{cmt.author_name}：</span>
                          <span style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.7)' }}>{cmt.content}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 店家回复 */}
                  {review.shop_reply && (
                    <div style={{
                      marginBottom: 10, padding: '10px 14px', borderRadius: 10,
                      backgroundColor: 'rgba(201,146,46,0.08)', border: '1px solid rgba(201,146,46,0.2)',
                    }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: GOLD, marginRight: 6 }}>店家回复</span>
                      <span style={{ fontSize: '0.84rem', color: 'rgba(226,238,252,0.8)' }}>{review.shop_reply}</span>
                    </div>
                  )}

                  {/* 申诉状态 */}
                  {review.appeal_status === 'pending' && (
                    <div style={{ marginBottom: 10, padding: '8px 14px', borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', fontSize: '0.78rem', color: '#fbbf24' }}>
                      申诉处理中...
                    </div>
                  )}
                  {review.appeal_status === 'approved' && (
                    <div style={{ marginBottom: 10, padding: '8px 14px', borderRadius: 8, backgroundColor: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', fontSize: '0.78rem', color: '#34d399' }}>
                      申诉已通过
                    </div>
                  )}
                  {review.appeal_status === 'rejected' && (
                    <div style={{ marginBottom: 10, padding: '8px 14px', borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', fontSize: '0.78rem', color: '#f87171' }}>
                      申诉已驳回
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    {!review.shop_reply && replyOpenId !== review.id && (
                      <button
                        onClick={() => { setReplyOpenId(review.id); setReplyText(''); }}
                        style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: '0.82rem',
                          background: 'none', border: '1px solid rgba(201,146,46,0.3)', color: GOLD, cursor: 'pointer',
                        }}>
                        回复
                      </button>
                    )}
                    {replyOpenId === review.id && (
                      <div style={{ width: '100%' }}>
                        <textarea
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="输入回复内容..."
                          rows={3}
                          style={{ ...inputStyle, marginBottom: 8, resize: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => submitReply(review.id)} disabled={replySending}
                            style={{
                              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: replySending ? 'not-allowed' : 'pointer',
                              background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD2} 100%)`, color: C, fontWeight: 600, fontSize: '0.82rem',
                            }}>
                            {replySending ? '发送中...' : '提交回复'}
                          </button>
                          <button onClick={() => { setReplyOpenId(null); setReplyText(''); }}
                            style={{ padding: '6px 16px', borderRadius: 8, background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(186,207,231,0.6)', cursor: 'pointer', fontSize: '0.82rem' }}>
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                    {!review.appeal_status && appealOpenId !== review.id && (
                      <button
                        onClick={() => { setAppealOpenId(review.id); setAppealReason(''); }}
                        style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: '0.82rem',
                          background: 'none', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', cursor: 'pointer',
                        }}>
                        申诉
                      </button>
                    )}
                    {appealOpenId === review.id && (
                      <div style={{ width: '100%' }}>
                        <textarea
                          value={appealReason}
                          onChange={e => setAppealReason(e.target.value)}
                          placeholder="输入申诉理由..."
                          rows={3}
                          style={{ ...inputStyle, marginBottom: 8, resize: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => submitAppeal(review.id)} disabled={appealSending}
                            style={{
                              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: appealSending ? 'not-allowed' : 'pointer',
                              background: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)', color: '#fff', fontWeight: 600, fontSize: '0.82rem',
                            }}>
                            {appealSending ? '提交中...' : '提交申诉'}
                          </button>
                          <button onClick={() => { setAppealOpenId(null); setAppealReason(''); }}
                            style={{ padding: '6px 16px', borderRadius: 8, background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(186,207,231,0.6)', cursor: 'pointer', fontSize: '0.82rem' }}>
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
