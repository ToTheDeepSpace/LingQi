import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import ImageUpload from '../components/ImageUpload';
import type { Creator, Service, Portfolio, AuthData } from '../types';

const API  = '/api';
const C    = '#0b1a30';
const C2   = '#0f2239';
const GOLD = '#d9a857';

function getToken(): string {
  try {
    const stored = localStorage.getItem('lc_creator');
    return stored ? (JSON.parse(stored) as AuthData).token : '';
  } catch { return ''; }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch { return true; }
}

const TABS = [
  { id: 'profile',      label: '资料',   icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0z M12 14c-3.3 0-6 1.8-6 4v1h12v-1c0-2.2-2.7-4-6-4z' },
  { id: 'services',    label: '服务',   icon: 'M4 6h16M4 10h16M4 14h12 M8 18l2 2 4-4' },
  { id: 'availability',label: '档期',   icon: 'M8 2v4M16 2v4M3 10h18M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7' },
  { id: 'portfolio',   label: '作品',   icon: 'M4 16l4.6-4.6 3.4 3.4L18 9l4 4V6a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2h12 M6 7h.01' },
] as const;

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [creator, setCreator]   = useState<Creator | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [tab, setTab]           = useState('profile');
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(true);

  const [form, setForm] = useState({ display_name: '', bio: '', city: '', wechat: '', tags: '' });
  const [newSvc, setNewSvc] = useState({ service_type: '', price: '', duration: '', description: '' });
  const [availDates, setAvailDates] = useState<string[]>([]);

  const token = getToken();

  useEffect(() => {
    const stored = localStorage.getItem('lc_creator');
    if (!stored) { navigate('/login'); return; }
    let data: AuthData;
    try { data = JSON.parse(stored); } catch { navigate('/login'); return; }
    if (!data.id || !data.token) { navigate('/login'); return; }
    if (isTokenExpired(data.token)) {
      localStorage.removeItem('lc_creator');
      navigate('/login');
      return;
    }

    Promise.all([
      fetch(`${API}/lc/creators/${data.id}`).then(r => r.json()),
      fetch(`${API}/lc/creators/${data.id}/availability`).then(r => r.json()),
    ]).then(([profileData, availData]) => {
      if (profileData.success && profileData.data) {
        const { services: svc, portfolio: port, ...profile } = profileData.data;
        setCreator(profile);
        setServices(svc || []);
        setPortfolio(port || []);
        setForm({
          display_name: profile.display_name || '',
          bio: profile.bio || '',
          city: profile.city || '',
          wechat: profile.wechat || '',
          tags: (profile.tags || []).join(', '),
        });
      } else { setError(profileData.error || '加载失败'); }
      if (availData.success) setAvailDates((availData.data || []).map((a: { date: string }) => a.date));
    }).catch(() => setError('网络错误')).finally(() => setLoading(false));
  }, [navigate]);

  const saveProfile = async () => {
    if (!creator) return;
    setSaving(true); setError('');
    try {
      const tags = form.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      const r = await fetch(`${API}/lc/creators/${creator.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, tags }),
      });
      const d = await r.json();
      if (d.success) { setMsg('已保存'); setTimeout(() => setMsg(''), 2500); }
      else setError(d.error || '保存失败');
    } catch { setError('网络错误，请重试'); }
    finally { setSaving(false); }
  };

  const addService = async () => {
    if (!creator || !newSvc.service_type || !newSvc.price) return;
    setError('');
    const r = await fetch(`${API}/lc/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ creatorId: creator.id, serviceType: newSvc.service_type, price: parseFloat(newSvc.price), duration: newSvc.duration, description: newSvc.description }),
    });
    const d = await r.json();
    if (d.success) { setServices([...services, d.data]); setNewSvc({ service_type: '', price: '', duration: '', description: '' }); }
    else setError(d.error || '添加失败');
  };

  const deleteService = async (id: string) => {
    const r = await fetch(`${API}/lc/services/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (d.success) setServices(services.filter(s => s.id !== id));
  };

  const addPortfolio = async (url: string) => {
    if (!creator) return;
    const r = await fetch(`${API}/lc/portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ creatorId: creator.id, imageUrl: url }),
    });
    const d = await r.json();
    if (d.success) setPortfolio([...portfolio, d.data]);
  };

  const deletePortfolio = async (id: string) => {
    const r = await fetch(`${API}/lc/portfolio/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (d.success) setPortfolio(portfolio.filter(p => p.id !== id));
  };

  const toggleDate = async (date: Date) => {
    if (!creator) return;
    const dateStr = date.toISOString().split('T')[0];
    const isSet = availDates.includes(dateStr);
    if (isSet) {
      const { data } = await fetch(`${API}/lc/creators/${creator.id}/availability`).then(r => r.json());
      const item = (data || []).find((a: { date: string; id: string }) => a.date === dateStr);
      if (item) {
        const r = await fetch(`${API}/lc/availability/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (d.success) setAvailDates(availDates.filter(ds => ds !== dateStr));
      }
    } else {
      const r = await fetch(`${API}/lc/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ creatorId: creator.id, date: dateStr, startTime: '09:00', endTime: '22:00' }),
      });
      const d = await r.json();
      if (d.success) setAvailDates([...availDates, dateStr]);
    }
  };

  const logout = () => {
    localStorage.removeItem('lc_creator');
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

  if (!creator) return (
    <div style={{ backgroundColor: C, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.3 }}>🌊</div>
        <p style={{ color: 'rgba(186,207,231,0.7)', marginBottom: 20 }}>{error || '加载失败'}</p>
        <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: GOLD, cursor: 'pointer', textDecoration: 'underline', fontSize: '0.875rem' }}>返回登录</button>
      </div>
    </div>
  );

  const tabBtn = (id: string, label: string, iconPath: string) => (
    <button key={id} onClick={() => setTab(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
        fontWeight: 600, fontSize: '0.875rem', textAlign: 'left', width: '100%',
        background: tab === id ? `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)` : 'transparent',
        color: tab === id ? C : 'rgba(186,207,231,0.7)',
        transition: 'all 0.2s',
      }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={iconPath} />
      </svg>
      {label}
    </button>
  );

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: '#fff' }}>

      {/* Header */}
      <div style={{ backgroundColor: C2, borderBottom: '1px solid rgba(201,146,46,0.12)', padding: '24px 20px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 4 }}>我的主页</h1>
            <p style={{ fontSize: '0.85rem', color: 'rgba(186,207,231,0.65)' }}>{creator.display_name}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link to={`/explore/${creator.id}`}
              style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.25)', color: GOLD, fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>
              查看公开页 →
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

        {/* 审核状态 banner */}
        {!creator.is_visible && (
          <div style={{
            padding: '14px 18px', borderRadius: 12, marginBottom: 20,
            backgroundColor: creator.reject_reason ? 'rgba(248,113,113,0.08)' : 'rgba(201,146,46,0.08)',
            border: `1px solid ${creator.reject_reason ? 'rgba(248,113,113,0.25)' : 'rgba(201,146,46,0.25)'}`,
            fontSize: '0.875rem',
            color: creator.reject_reason ? '#f87171' : GOLD,
          }}>
            {creator.reject_reason
              ? `您的入驻申请已被拒绝。原因：${creator.reject_reason}`
              : '您的主页当前未公开。账号仍可正常使用，发布到红黑榜的内容会单独进入人工审核。'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* ── 左侧 Tab 栏 ── */}
          <div style={{ width: 180, flexShrink: 0, ...card, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map(t => tabBtn(t.id, t.label, t.icon))}
          </div>

          {/* ── 主内容区 ── */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* 资料 */}
            {tab === 'profile' && (
              <div style={card}>
                <h2 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 24, color: 'rgba(186,207,231,0.9)' }}>编辑资料</h2>
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  marginBottom: 20,
                  backgroundColor: creator.is_realname ? 'rgba(201,146,46,0.08)' : 'rgba(255,255,255,0.035)',
                  border: `1px solid ${creator.is_realname ? 'rgba(201,146,46,0.25)' : 'rgba(255,255,255,0.08)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: creator.is_realname ? GOLD : 'rgba(186,207,231,0.65)', fontWeight: 800, fontSize: '0.9rem' }}>
                      {creator.is_realname ? '⭐ 已完成实名认证' : '未完成实名认证'}
                    </span>
                  </div>
                  <p style={{ color: 'rgba(186,207,231,0.6)', fontSize: '0.8rem', lineHeight: 1.7 }}>
                    实名由后台审核，前台只显示星标和昵称，不公开真实姓名。需要认证时请联系管理员提交材料。
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>昵称 / 艺名</label>
                    <input type="text" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>城市</label>
                    <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="如：上海" style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>简介</label>
                  <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={4}
                    style={{ ...inputStyle, resize: 'none' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  <div>
                    <label style={labelStyle}>标签（逗号分隔）</label>
                    <input type="text" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                      placeholder="恋陪, 情感本, 日系" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>微信</label>
                    <input type="text" value={form.wechat} onChange={e => setForm({ ...form, wechat: e.target.value })}
                      placeholder="粉丝通过申请后可见" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button onClick={saveProfile} disabled={saving}
                    style={{
                      padding: '11px 28px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                      background: saving ? 'rgba(255,255,255,0.07)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                      color: saving ? 'rgba(186,207,231,0.5)' : C, fontWeight: 700, fontSize: '0.9rem',
                    }}>
                    {saving ? '保存中...' : '保存资料'}
                  </button>
                  {msg && <span style={{ fontSize: '0.875rem', color: '#34d399', fontWeight: 600 }}>{msg}</span>}
                </div>
              </div>
            )}

            {/* 服务 */}
            {tab === 'services' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {services.map(s => (
                  <div key={s.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.service_type}</span>
                      {s.duration && <span style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.6)', marginLeft: 8 }}>· {s.duration}</span>}
                      {s.description && <p style={{ fontSize: '0.8rem', color: 'rgba(186,207,231,0.6)', marginTop: 4 }}>{s.description}</p>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontWeight: 700, color: GOLD }}>¥{s.price}</span>
                      <button onClick={() => deleteService(s.id)}
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.82rem' }}>删除</button>
                    </div>
                  </div>
                ))}
                <div style={{ ...card, border: '1px dashed rgba(201,146,46,0.25)' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: 'rgba(186,207,231,0.85)' }}>添加服务</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <input type="text" value={newSvc.service_type} onChange={e => setNewSvc({ ...newSvc, service_type: e.target.value })}
                      placeholder="服务类型" style={inputStyle} />
                    <input type="number" value={newSvc.price} onChange={e => setNewSvc({ ...newSvc, price: e.target.value })}
                      placeholder="价格（元）" style={inputStyle} />
                  </div>
                  <input type="text" value={newSvc.duration} onChange={e => setNewSvc({ ...newSvc, duration: e.target.value })}
                    placeholder="时长（如：2小时）" style={{ ...inputStyle, marginBottom: 16 }} />
                  <button onClick={addService}
                    style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, fontWeight: 700, fontSize: '0.875rem' }}>
                    添加
                  </button>
                </div>
              </div>
            )}

            {/* 档期 */}
            {tab === 'availability' && (
              <div style={card}>
                <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8, color: 'rgba(186,207,231,0.85)' }}>点击选择可约日期</p>
                <p style={{ fontSize: '0.8rem', color: 'rgba(186,207,231,0.55)', marginBottom: 20 }}>已选中的日期将显示在你的公开主页上</p>
                <div style={{ maxWidth: 380 }}>
                  <Calendar
                    onClickDay={toggleDate}
                    tileClassName={({ date }) => {
                      const ds = date.toISOString().split('T')[0];
                      return availDates.includes(ds) ? 'avail-tile' : '';
                    }}
                    className="dark-cal"
                    minDate={new Date()}
                  />
                </div>
                <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {availDates.map(d => (
                    <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, fontSize: '0.78rem', background: 'rgba(201,146,46,0.1)', border: '1px solid rgba(201,146,46,0.25)', color: GOLD }}>
                      {d}
                      <button onClick={() => toggleDate(new Date(d + 'T00:00:00'))}
                        style={{ background: 'none', border: 'none', color: 'rgba(217,168,87,0.6)', cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
                    </span>
                  ))}
                  {availDates.length === 0 && (
                    <p style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.45)' }}>还没有标记可约日期</p>
                  )}
                </div>
              </div>
            )}

            {/* 作品集 */}
            {tab === 'portfolio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {portfolio.length > 0 && (
                  <div style={card}>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: 'rgba(186,207,231,0.85)' }}>已上传作品</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                      {portfolio.map(p => (
                        <div key={p.id} style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', position: 'relative', border: '1px solid rgba(201,146,46,0.15)' }}
                          onMouseEnter={e => { const btn = e.currentTarget.querySelector('button') as HTMLElement | null; if (btn) btn.style.opacity = '1'; }}
                          onMouseLeave={e => { const btn = e.currentTarget.querySelector('button') as HTMLElement | null; if (btn) btn.style.opacity = '0'; }}>
                          <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button onClick={() => deletePortfolio(p.id)}
                            style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', opacity: 0, transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ ...card, border: '1px dashed rgba(201,146,46,0.25)' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: 'rgba(186,207,231,0.85)' }}>上传作品</p>
                  <ImageUpload onUploaded={addPortfolio} token={token} api={API} />
                  <p style={{ fontSize: '0.78rem', color: 'rgba(186,207,231,0.45)', marginTop: 12 }}>支持 JPG、PNG、GIF，最大 10MB</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Dark calendar overrides */
        .dark-cal { background: transparent !important; border: none !important; width: 100% !important; color: #fff !important; }
        .dark-cal .react-calendar__navigation { background: transparent !important; margin-bottom: 12px; }
        .dark-cal .react-calendar__navigation button { color: rgba(186,207,231,0.85) !important; background: transparent !important; font-size: 0.9rem !important; font-weight: 600 !important; border-radius: 8px !important; }
        .dark-cal .react-calendar__navigation button:hover { background: rgba(255,255,255,0.06) !important; }
        .dark-cal .react-calendar__navigation button:disabled { color: rgba(186,207,231,0.3) !important; }
        .dark-cal .react-calendar__month-view__weekdays { color: rgba(186,207,231,0.5) !important; font-size: 0.72rem !important; }
        .dark-cal .react-calendar__tile { background: transparent !important; color: rgba(186,207,231,0.8) !important; border-radius: 8px !important; padding: 8px !important; }
        .dark-cal .react-calendar__tile:hover { background: rgba(255,255,255,0.07) !important; }
        .dark-cal .react-calendar__tile--now { background: rgba(201,146,46,0.12) !important; color: ${GOLD} !important; }
        .dark-cal .react-calendar__tile--active { background: rgba(201,146,46,0.12) !important; }
        .dark-cal .react-calendar__tile.avail-tile { background: rgba(201,146,46,0.2) !important; color: ${GOLD} !important; font-weight: 700 !important; border: 1px solid rgba(201,146,46,0.4) !important; }
        .dark-cal .react-calendar__month-view__days__day--neighboringMonth { color: rgba(186,207,231,0.2) !important; }
        .dark-cal abbr { text-decoration: none !important; }
      `}</style>
    </div>
  );
}
