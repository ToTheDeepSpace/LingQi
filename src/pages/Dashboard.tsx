import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import ImageUpload from '../components/ImageUpload';
import { generatedAvatarDataUrl } from '../lib/avatar';
import type { Creator, Service, Portfolio, AuthData, Availability } from '../types';

const API  = '/api';
const C    = '#fffdf8';
const C2   = '#eef6ff';
const GOLD = '#d9a857';
const INK  = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

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
  { id: 'posts',       label: '我的发布', icon: 'M4 5h16M4 12h16M4 19h10' },
] as const;

type MyRanking = {
  id: string;
  type: 'red' | 'black' | 'white';
  subject_name: string;
  subject_city?: string | null;
  initial_amount: number;
  likes: number;
  dislikes: number;
  joys: number;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  created_at: string;
};

type MyCommission = {
  id: string;
  title: string;
  city?: string | null;
  needed_date?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'closed';
  created_at: string;
};

type MyCarpool = {
  id: string;
  title: string;
  city: string;
  event_date: string;
  deadline_date?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'closed';
  juzhanggui_sync_status?: 'pending' | 'synced' | 'failed' | 'disabled';
  created_at: string;
};

const card: React.CSSProperties = {
  backgroundColor: '#fffaf2',
  border: '1px solid rgba(201,146,46,0.22)',
  borderRadius: 16, padding: 24,
  boxShadow: '0 14px 34px rgba(31,41,55,0.06)',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px solid rgba(201,146,46,0.2)', outline: 'none',
  backgroundColor: '#fff', color: INK,
  fontSize: '0.875rem', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600,
  color: 'rgba(71,85,105,0.78)', marginBottom: 8,
};

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [creator, setCreator]   = useState<Creator | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [myRankings, setMyRankings] = useState<MyRanking[]>([]);
  const [myCommissions, setMyCommissions] = useState<MyCommission[]>([]);
  const [myCarpools, setMyCarpools] = useState<MyCarpool[]>([]);
  const [tab, setTab]           = useState('profile');
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(true);

  const [form, setForm] = useState({
    display_name: '', avatar: '', bio: '', city: '', wechat: '', tags: '',
    douyin: '', xiaohongshu: '', available_cities: '', travel_status: '常驻本地',
    contact_unlock_enabled: false, contact_intent_amount: '',
  });
  const [newSvc, setNewSvc] = useState({ service_type: '', price: '', duration: '', description: '' });
  const [availDates, setAvailDates] = useState<string[]>([]);
  const [availItems, setAvailItems] = useState<Availability[]>([]);
  const [availCity, setAvailCity] = useState('');
  const [availLocation, setAvailLocation] = useState('');
  const [syncingJzg, setSyncingJzg] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [screenshotText, setScreenshotText] = useState('');
  const [importingScreenshot, setImportingScreenshot] = useState(false);

  const token = getToken();

  const applyAvailability = (items: Availability[]) => {
    setAvailItems(items || []);
    setAvailDates((items || []).filter(a => !a.is_booked).map(a => a.date));
  };

  useEffect(() => {
    const stored = localStorage.getItem('lc_creator');
    if (!stored) { navigate('/login'); return; }
    let data: AuthData;
    try { data = JSON.parse(stored); } catch { navigate('/login'); return; }
    if (!data.id || !data.token) { navigate('/login'); return; }
    if (isTokenExpired(data.token)) {
      localStorage.removeItem('lc_creator');
      window.dispatchEvent(new Event('lc-auth-changed'));
      navigate('/login');
      return;
    }

    Promise.all([
      fetch(`${API}/lc/creators/${data.id}`, { headers: { Authorization: `Bearer ${data.token}` } }).then(r => r.json()),
      fetch(`${API}/lc/creators/${data.id}/availability`).then(r => r.json()),
      fetch(`${API}/lc/rankings/mine`, { headers: { Authorization: `Bearer ${data.token}` } }).then(r => r.json()),
      fetch(`${API}/lc/commissions/mine`, { headers: { Authorization: `Bearer ${data.token}` } }).then(r => r.json()),
      fetch(`${API}/lc/carpools/mine`, { headers: { Authorization: `Bearer ${data.token}` } }).then(r => r.json()),
    ]).then(([profileData, availData, rankingsData, commissionsData, carpoolsData]) => {
      if (profileData.success && profileData.data) {
        const { services: svc, portfolio: port, ...profile } = profileData.data;
        setCreator(profile);
        setServices(svc || []);
        setPortfolio(port || []);
        setForm({
          display_name: profile.display_name || '',
          avatar: profile.avatar || '',
          bio: profile.bio || '',
          city: profile.city || '',
          wechat: profile.wechat || '',
          tags: (profile.tags || []).join(', '),
          douyin: profile.social_links?.douyin || '',
          xiaohongshu: profile.social_links?.xiaohongshu || '',
          available_cities: (profile.available_cities || []).join(', '),
          travel_status: profile.travel_status || '常驻本地',
          contact_unlock_enabled: !!profile.contact_unlock_enabled,
          contact_intent_amount: profile.contact_intent_amount ? String(profile.contact_intent_amount) : '',
        });
      } else { setError(profileData.error || '加载失败'); }
      if (availData.success) {
        applyAvailability(availData.data || []);
      }
      if (rankingsData.success) setMyRankings(rankingsData.data || []);
      if (commissionsData.success) setMyCommissions(commissionsData.data || []);
      if (carpoolsData.success) setMyCarpools(carpoolsData.data || []);
    }).catch(() => setError('网络错误')).finally(() => setLoading(false));
  }, [navigate]);

  const saveProfile = async (avatarOverride?: string) => {
    if (!creator) return;
    setSaving(true); setError('');
    try {
      const tags = form.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      const available_cities = form.available_cities.split(',').map((t: string) => t.trim()).filter(Boolean);
      const social_links = {
        douyin: form.douyin.trim(),
        xiaohongshu: form.xiaohongshu.trim(),
      };
      const r = await fetch(`${API}/lc/creators/${creator.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          display_name: form.display_name,
          avatar: avatarOverride ?? form.avatar,
          bio: form.bio,
          city: form.city,
          wechat: form.wechat,
          tags,
          social_links,
          available_cities,
          travel_status: form.travel_status,
          contact_unlock_enabled: form.contact_unlock_enabled,
          contact_intent_amount: form.contact_intent_amount,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setCreator(prev => prev ? { ...prev, avatar: avatarOverride ?? form.avatar, display_name: form.display_name } : prev);
        setMsg('已保存');
        setTimeout(() => setMsg(''), 2500);
      }
      else setError(d.error || '保存失败');
    } catch { setError('网络错误，请重试'); }
    finally { setSaving(false); }
  };

  const handleAvatarUploaded = (url: string) => {
    setForm(prev => ({ ...prev, avatar: url }));
    setCreator(prev => prev ? { ...prev, avatar: url } : prev);
    void saveProfile(url);
  };

  const refreshAvailability = async () => {
    if (!creator) return;
    const r = await fetch(`${API}/lc/creators/${creator.id}/availability`);
    const d = await r.json();
    if (d.success) applyAvailability(d.data || []);
  };

  const syncJuzhangguiAvailability = async () => {
    if (!creator) return;
    setSyncingJzg(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/availability/sync-juzhanggui`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!d.success) {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '同步失败');
        setError(msg);
        return;
      }
      await refreshAvailability();
      setMsg(d.data?.matched === false ? d.data.message : `已同步 ${d.data?.imported || 0} 条剧司辰档期`);
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSyncingJzg(false);
    }
  };

  const importScreenshotAvailability = async () => {
    if (!creator || !screenshotText.trim()) {
      setError('请粘贴截图中的文字');
      return;
    }
    setImportingScreenshot(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/availability/import-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rawText: screenshotText,
          screenshotUrl,
          city: availCity || form.city || null,
          location: availLocation || null,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '导入失败');
        setError(msg);
        return;
      }
      await refreshAvailability();
      setMsg(d.data?.message || `已从截图文字导入 ${d.data?.imported || 0} 条可约档期`);
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setImportingScreenshot(false);
    }
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

  const closeCarpool = async (id: string) => {
    if (!confirm('确定关闭这条拼车吗？关闭后不会继续公开展示。')) return;
    setError('');
    try {
      const r = await fetch(`${API}/lc/carpools/${id}/close`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) {
        setMyCarpools(prev => prev.map(item => item.id === id ? { ...item, status: 'closed' } : item));
        setMsg('拼车已关闭');
        setTimeout(() => setMsg(''), 2500);
      } else {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '关闭失败');
        setError(msg);
      }
    } catch {
      setError('网络错误，请重试');
    }
  };

  const withdrawRanking = async (id: string) => {
    if (!confirm('确定撤回这条待审核口碑吗？撤回后不会进入审核队列。')) return;
    setError('');
    try {
      const r = await fetch(`${API}/lc/rankings/${id}/withdraw`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) {
        setMyRankings(prev => prev.map(item => item.id === id ? { ...item, status: 'withdrawn' } : item));
        setMsg('口碑已撤回');
        setTimeout(() => setMsg(''), 2500);
      } else {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '撤回失败');
        setError(msg);
      }
    } catch {
      setError('网络错误，请重试');
    }
  };

  const closeCommission = async (id: string) => {
    if (!confirm('确定关闭这条委托需求吗？关闭后不会继续公开展示。')) return;
    setError('');
    try {
      const r = await fetch(`${API}/lc/commissions/${id}/close`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) {
        setMyCommissions(prev => prev.map(item => item.id === id ? { ...item, status: 'closed' } : item));
        setMsg('委托需求已关闭');
        setTimeout(() => setMsg(''), 2500);
      } else {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '关闭失败');
        setError(msg);
      }
    } catch {
      setError('网络错误，请重试');
    }
  };

  const toggleDate = async (date: Date) => {
    if (!creator) return;
    const dateStr = formatDateKey(date);
    const isSet = availDates.includes(dateStr);
    if (isSet) {
      const item = availItems.find(a => !a.is_booked && a.date === dateStr);
      if (item) {
        const r = await fetch(`${API}/lc/availability/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (d.success) {
          setAvailDates(availDates.filter(ds => ds !== dateStr));
          setAvailItems(availItems.filter(a => a.id !== item.id));
        }
      }
    } else {
      const r = await fetch(`${API}/lc/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          creatorId: creator.id, date: dateStr, startTime: '09:00', endTime: '22:00',
          city: availCity || form.city || null,
          location: availLocation || null,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setAvailDates([...availDates, dateStr]);
        setAvailItems([...availItems, d.data]);
      }
    }
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
        <p style={{ color: MUTED }}>加载中...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!creator) return (
    <div style={{ backgroundColor: C, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.3 }}>🌊</div>
        <p style={{ color: MUTED, marginBottom: 20 }}>{error || '加载失败'}</p>
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
        color: tab === id ? INK : 'rgba(71,85,105,0.74)',
        transition: 'all 0.2s',
      }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={iconPath} />
      </svg>
      {label}
    </button>
  );

  const profileAvatarUrl = form.avatar || generatedAvatarDataUrl(form.display_name || creator.display_name, creator.id);
  const phoneVerified = !!creator.phone_verified_at;
  const hasUploadedAvatar = !!form.avatar;
  const availableItems = availItems.filter(item => !item.is_booked);
  const busyItems = availItems.filter(item => item.is_booked);
  const busyDateSet = new Set(busyItems.map(item => item.date));

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: INK }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C2}, #fffaf2)`, borderBottom: '1px solid rgba(201,146,46,0.2)', padding: '24px 20px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 4 }}>我的主页</h1>
            <p style={{ fontSize: '0.85rem', color: MUTED }}>{creator.display_name}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link to={`/explore/${creator.id}`}
              style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.28)', color: '#925f18', background: 'rgba(255,255,255,0.72)', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>
              查看公开页 →
            </Link>
            <button onClick={logout}
              style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(220,38,38,0.22)', background: 'rgba(254,242,242,0.78)', color: '#b91c1c', cursor: 'pointer', fontSize: '0.82rem' }}>
              退出
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' }}>

        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(254,242,242,0.92)', border: '1px solid rgba(220,38,38,0.24)', borderRadius: 10, fontSize: '0.875rem', color: '#b91c1c', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* 审核状态 banner */}
        {!creator.is_visible && (
          <div style={{
            padding: '14px 18px', borderRadius: 12, marginBottom: 20,
            backgroundColor: creator.reject_reason ? 'rgba(254,242,242,0.92)' : 'rgba(201,146,46,0.1)',
            border: `1px solid ${creator.reject_reason ? 'rgba(220,38,38,0.24)' : 'rgba(201,146,46,0.25)'}`,
            fontSize: '0.875rem',
            color: creator.reject_reason ? '#b91c1c' : '#925f18',
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
                <h2 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 24, color: INK }}>编辑资料</h2>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
                  padding: '16px', borderRadius: 14, marginBottom: 20,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(239,246,255,0.82))',
                  border: '1px solid rgba(125,147,170,0.16)',
                }}>
                  <div style={{
                    width: 86, height: 86, borderRadius: 22, overflow: 'hidden', flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(217,168,87,0.24), rgba(107,63,160,0.16))',
                    border: '2px solid rgba(217,168,87,0.32)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#925f18', fontSize: 28, fontWeight: 900,
                  }}>
                    <img src={profileAvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div>
                    <p style={{ color: INK, fontWeight: 800, fontSize: '0.92rem', marginBottom: 8 }}>主页头像</p>
                    <ImageUpload onUploaded={handleAvatarUploaded} token={token} api={API} scope="avatar" label="上传头像" />
                    <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.78rem', marginTop: 8 }}>
                      未上传时会显示系统生成头像；发布、评论、投票和接单前必须上传本人头像。
                    </p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    backgroundColor: phoneVerified ? 'rgba(220,252,231,0.78)' : 'rgba(254,242,242,0.82)',
                    border: `1px solid ${phoneVerified ? 'rgba(22,163,74,0.18)' : 'rgba(185,28,28,0.18)'}`,
                    color: phoneVerified ? '#15803d' : '#b91c1c',
                    fontSize: '0.82rem',
                    lineHeight: 1.65,
                    fontWeight: 700,
                  }}>
                    {phoneVerified ? '手机号已验证，可以参与公开发言。' : '手机号未验证：请用手机号验证码登录一次，否则不能发布、评论、投票或接单。'}
                  </div>
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    backgroundColor: hasUploadedAvatar ? 'rgba(220,252,231,0.78)' : 'rgba(255,247,237,0.92)',
                    border: `1px solid ${hasUploadedAvatar ? 'rgba(22,163,74,0.18)' : 'rgba(217,168,87,0.24)'}`,
                    color: hasUploadedAvatar ? '#15803d' : '#925f18',
                    fontSize: '0.82rem',
                    lineHeight: 1.65,
                    fontWeight: 700,
                  }}>
                    {hasUploadedAvatar ? '头像已上传，可以参与公开发言。' : '头像未上传：当前只是默认头像，上传后才能公开发言。'}
                  </div>
                </div>
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  marginBottom: 20,
                  backgroundColor: creator.is_realname ? 'rgba(201,146,46,0.1)' : 'rgba(255,255,255,0.72)',
                  border: `1px solid ${creator.is_realname ? 'rgba(201,146,46,0.25)' : 'rgba(125,147,170,0.16)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: creator.is_realname ? '#925f18' : 'rgba(71,85,105,0.72)', fontWeight: 800, fontSize: '0.9rem' }}>
                      {creator.is_realname ? '⭐ 已完成实名认证' : '未完成实名认证'}
                    </span>
                  </div>
                  <p style={{ color: 'rgba(71,85,105,0.64)', fontSize: '0.8rem', lineHeight: 1.7 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>流动状态</label>
                    <select value={form.travel_status} onChange={e => setForm({ ...form, travel_status: e.target.value })} style={inputStyle}>
                      <option value="常驻本地">常驻本地</option>
                      <option value="全国流动">全国流动</option>
                      <option value="巡游中">巡游中</option>
                      <option value="远程可接">远程可接</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>可接城市（逗号分隔）</label>
                    <input type="text" value={form.available_cities} onChange={e => setForm({ ...form, available_cities: e.target.value })} placeholder="北京, 上海, 杭州" style={inputStyle} />
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>抖音主页链接</label>
                    <input type="url" value={form.douyin} onChange={e => setForm({ ...form, douyin: e.target.value })} placeholder="https://v.douyin.com/..." style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>小红书主页链接</label>
                    <input type="url" value={form.xiaohongshu} onChange={e => setForm({ ...form, xiaohongshu: e.target.value })} placeholder="https://www.xiaohongshu.com/..." style={inputStyle} />
                  </div>
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 12, marginBottom: 24, backgroundColor: 'rgba(217,168,87,0.07)', border: '1px solid rgba(217,168,87,0.18)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(71,85,105,0.82)', fontSize: '0.86rem', fontWeight: 700, marginBottom: 12 }}>
                    <input type="checkbox" checked={form.contact_unlock_enabled} onChange={e => setForm({ ...form, contact_unlock_enabled: e.target.checked })} />
                    开启预约意向金
                  </label>
                  <input type="number" value={form.contact_intent_amount} onChange={e => setForm({ ...form, contact_intent_amount: e.target.value })} placeholder="意向金金额，0 表示不收" style={inputStyle} />
                  <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.78rem', lineHeight: 1.7, marginTop: 10 }}>
                    这不是“加微信门槛费”，页面会写成预约意向确认，用来减少无效打扰。
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button onClick={() => saveProfile()} disabled={saving}
                    style={{
                      padding: '11px 28px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                      background: saving ? 'rgba(241,245,249,0.86)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                      color: saving ? 'rgba(71,85,105,0.52)' : INK, fontWeight: 700, fontSize: '0.9rem',
                    }}>
                    {saving ? '保存中...' : '保存资料'}
                  </button>
                  {msg && <span style={{ fontSize: '0.875rem', color: '#15803d', fontWeight: 600 }}>{msg}</span>}
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
                      {s.duration && <span style={{ fontSize: '0.82rem', color: 'rgba(71,85,105,0.62)', marginLeft: 8 }}>· {s.duration}</span>}
                      {s.description && <p style={{ fontSize: '0.8rem', color: 'rgba(71,85,105,0.62)', marginTop: 4 }}>{s.description}</p>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontWeight: 700, color: GOLD }}>¥{s.price}</span>
                      <button onClick={() => deleteService(s.id)}
                        style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.82rem' }}>删除</button>
                    </div>
                  </div>
                ))}
                <div style={{ ...card, border: '1px dashed rgba(201,146,46,0.25)' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: INK }}>添加服务</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <input type="text" value={newSvc.service_type} onChange={e => setNewSvc({ ...newSvc, service_type: e.target.value })}
                      placeholder="服务类型" style={inputStyle} />
                    <input type="number" value={newSvc.price} onChange={e => setNewSvc({ ...newSvc, price: e.target.value })}
                      placeholder="价格（元）" style={inputStyle} />
                  </div>
                  <input type="text" value={newSvc.duration} onChange={e => setNewSvc({ ...newSvc, duration: e.target.value })}
                    placeholder="时长（如：2小时）" style={{ ...inputStyle, marginBottom: 16 }} />
                  <button onClick={addService}
                    style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: INK, fontWeight: 700, fontSize: '0.875rem' }}>
                    添加
                  </button>
                </div>
              </div>
            )}

            {/* 档期 */}
            {tab === 'availability' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={card}>
                  <p style={{ fontWeight: 800, fontSize: '0.96rem', marginBottom: 8, color: INK }}>手动标记可约日期</p>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(71,85,105,0.58)', marginBottom: 16 }}>金色日期会显示在公开主页上，代表可以被委托人预约。</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 560, marginBottom: 18 }}>
                    <input value={availCity} onChange={e => setAvailCity(e.target.value)} placeholder="这批档期所在城市（默认用常驻城市）" style={inputStyle} />
                    <input value={availLocation} onChange={e => setAvailLocation(e.target.value)} placeholder="地点补充，如展会/区县/可商量" style={inputStyle} />
                  </div>
                  <div style={{ maxWidth: 400 }}>
                    <Calendar
                      onClickDay={toggleDate}
                      tileClassName={({ date }) => {
                        const ds = formatDateKey(date);
                        if (availDates.includes(ds)) return 'avail-tile';
                        if (busyDateSet.has(ds)) return 'busy-tile';
                        return '';
                      }}
                      className="dark-cal"
                      minDate={new Date()}
                    />
                  </div>
                  <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {availableItems.map(item => (
                      <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, fontSize: '0.78rem', background: 'rgba(201,146,46,0.1)', border: '1px solid rgba(201,146,46,0.25)', color: '#925f18' }}>
                        {item.date}{item.city ? ` · ${item.city}` : ''}{item.location ? ` · ${item.location}` : ''}{item.source === 'screenshot' ? ' · 截图导入' : ''}
                        <button onClick={() => toggleDate(new Date(item.date + 'T00:00:00'))}
                          style={{ background: 'none', border: 'none', color: 'rgba(146,95,24,0.62)', cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
                      </span>
                    ))}
                    {availableItems.length === 0 && (
                      <p style={{ fontSize: '0.82rem', color: 'rgba(71,85,105,0.52)' }}>还没有标记可约日期</p>
                    )}
                  </div>
                </div>

                <div style={{ ...card, border: '1px solid rgba(59,130,246,0.18)', background: 'linear-gradient(135deg, rgba(239,246,255,0.86), rgba(255,250,242,0.96))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: '0.96rem', color: INK, marginBottom: 4 }}>剧司辰已排档期</p>
                      <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.8rem', lineHeight: 1.7 }}>这里同步的是已排班/忙碌时间，不会当成可约日期展示。</p>
                    </div>
                    <button onClick={syncJuzhangguiAvailability} disabled={syncingJzg}
                      style={{
                        padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(59,130,246,0.24)',
                        background: syncingJzg ? 'rgba(241,245,249,0.86)' : 'rgba(255,255,255,0.86)',
                        color: syncingJzg ? 'rgba(71,85,105,0.52)' : '#1d4ed8',
                        cursor: syncingJzg ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '0.84rem',
                      }}>
                      {syncingJzg ? '同步中...' : '同步剧司辰'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {busyItems.map(item => (
                      <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, fontSize: '0.78rem', background: 'rgba(59,130,246,0.09)', border: '1px solid rgba(59,130,246,0.18)', color: '#1e40af' }}>
                        {item.date}{item.start_time ? ` ${item.start_time.slice(0, 5)}` : ''}{item.city ? ` · ${item.city}` : ''}{item.location ? ` · ${item.location}` : ''}{item.note ? ` · ${item.note.replace(/^剧司辰同步：/, '')}` : ''}
                      </span>
                    ))}
                    {busyItems.length === 0 && (
                      <p style={{ fontSize: '0.82rem', color: 'rgba(71,85,105,0.52)' }}>还没有同步到剧司辰已排档期</p>
                    )}
                  </div>
                </div>

                <div style={{ ...card, border: '1px dashed rgba(201,146,46,0.25)' }}>
                  <p style={{ fontWeight: 800, fontSize: '0.96rem', marginBottom: 8, color: INK }}>截图快速导入</p>
                  <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.8rem', lineHeight: 1.7, marginBottom: 14 }}>上传档期截图留档，再粘贴截图中的文字，系统会把未过期日期导入为可约档期。</p>
                  <div style={{ display: 'grid', gap: 12, maxWidth: 620 }}>
                    <ImageUpload onUploaded={setScreenshotUrl} token={token} api={API} scope="availability-screenshot" label="上传档期截图" />
                    {screenshotUrl && <p style={{ color: '#15803d', fontSize: '0.78rem', fontWeight: 700 }}>截图已上传</p>}
                    <textarea value={screenshotText} onChange={e => setScreenshotText(e.target.value)} rows={5}
                      placeholder="粘贴截图里的档期文字，比如：6.11 上海 可约 / 6月14日 北京可接"
                      style={{ ...inputStyle, resize: 'vertical', minHeight: 110 }} />
                    <button onClick={importScreenshotAvailability} disabled={importingScreenshot}
                      style={{
                        justifySelf: 'start', padding: '10px 18px', borderRadius: 10, border: 'none',
                        cursor: importingScreenshot ? 'not-allowed' : 'pointer',
                        background: importingScreenshot ? 'rgba(241,245,249,0.86)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                        color: importingScreenshot ? 'rgba(71,85,105,0.52)' : INK,
                        fontWeight: 800, fontSize: '0.84rem',
                      }}>
                      {importingScreenshot ? '导入中...' : '导入截图档期'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 作品集 */}
            {tab === 'portfolio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {portfolio.length > 0 && (
                  <div style={card}>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: INK }}>已上传作品</p>
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
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: INK }}>上传作品</p>
                  <ImageUpload onUploaded={addPortfolio} token={token} api={API} scope="portfolio" label="上传作品" />
                  <p style={{ fontSize: '0.78rem', color: 'rgba(71,85,105,0.52)', marginTop: 12 }}>支持 JPG、PNG、GIF，最大 10MB</p>
                </div>
              </div>
            )}

            {tab === 'posts' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <MineSection title="红黑白榜" emptyText="还没有发布过口碑">
                  {myRankings.map(item => (
                    <MineRow key={item.id}
                      title={item.subject_name}
                      meta={`${item.type === 'red' ? '红榜' : item.type === 'black' ? '黑榜' : '白榜'} · ${item.subject_city || '未填城市'} · ${item.initial_amount === 0 ? '免费' : `${item.initial_amount} 契约币`} · 赞${item.likes || 0} 踩${item.dislikes || 0} 欢乐${item.joys || 0}`}
                      status={item.status}
                      to="/rankings"
                      action={item.status === 'pending' && item.initial_amount === 0 ? (
                        <button onClick={() => withdrawRanking(item.id)} style={miniButtonStyle}>
                          撤回
                        </button>
                      ) : null}
                    />
                  ))}
                </MineSection>

                <MineSection title="委托需求" emptyText="还没有发布过委托">
                  {myCommissions.map(item => (
                    <MineRow key={item.id}
                      title={item.title}
                      meta={`${item.city || '未填城市'}${item.needed_date ? ` · ${item.needed_date}` : ''}`}
                      status={item.status}
                      to="/commissions"
                      action={item.status === 'approved' || item.status === 'pending' ? (
                        <button onClick={() => closeCommission(item.id)} style={miniButtonStyle}>
                          关闭
                        </button>
                      ) : null}
                    />
                  ))}
                </MineSection>

                <MineSection title="拼车" emptyText="还没有发布过拼车">
                  {myCarpools.map(item => (
                    <MineRow key={item.id}
                      title={item.title}
                      meta={`${item.city} · ${item.event_date}${item.deadline_date ? ` · 截止 ${item.deadline_date}` : ''}${item.juzhanggui_sync_status === 'synced' ? ' · 已同步剧司辰' : item.juzhanggui_sync_status === 'failed' ? ' · 同步失败' : ''}`}
                      status={item.status}
                      to="/carpools"
                      action={item.status === 'approved' || item.status === 'pending' ? (
                        <button onClick={() => closeCarpool(item.id)} style={miniButtonStyle}>
                          关闭
                        </button>
                      ) : null}
                    />
                  ))}
                </MineSection>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Light calendar overrides */
        .dark-cal { background: transparent !important; border: none !important; width: 100% !important; color: #1f2937 !important; }
        .dark-cal .react-calendar__navigation { background: transparent !important; margin-bottom: 12px; }
        .dark-cal .react-calendar__navigation button { color: rgba(71,85,105,0.85) !important; background: transparent !important; font-size: 0.9rem !important; font-weight: 600 !important; border-radius: 8px !important; }
        .dark-cal .react-calendar__navigation button:hover { background: rgba(217,168,87,0.10) !important; }
        .dark-cal .react-calendar__navigation button:disabled { color: rgba(71,85,105,0.3) !important; }
        .dark-cal .react-calendar__month-view__weekdays { color: rgba(71,85,105,0.55) !important; font-size: 0.72rem !important; }
        .dark-cal .react-calendar__tile { background: transparent !important; color: rgba(71,85,105,0.82) !important; border-radius: 8px !important; padding: 8px !important; }
        .dark-cal .react-calendar__tile:hover { background: rgba(217,168,87,0.10) !important; }
        .dark-cal .react-calendar__tile--now { background: rgba(201,146,46,0.12) !important; color: ${GOLD} !important; }
        .dark-cal .react-calendar__tile--active { background: rgba(201,146,46,0.12) !important; }
        .dark-cal .react-calendar__tile.avail-tile { background: rgba(201,146,46,0.2) !important; color: ${GOLD} !important; font-weight: 700 !important; border: 1px solid rgba(201,146,46,0.4) !important; }
        .dark-cal .react-calendar__tile.busy-tile { background: rgba(59,130,246,0.12) !important; color: #1d4ed8 !important; font-weight: 700 !important; border: 1px solid rgba(59,130,246,0.25) !important; }
        .dark-cal .react-calendar__month-view__days__day--neighboringMonth { color: rgba(71,85,105,0.25) !important; }
        .dark-cal abbr { text-decoration: none !important; }
      `}</style>
    </div>
  );
}

function MineSection({ title, emptyText, children }: { title: string; emptyText: string; children: React.ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section style={card}>
      <h2 style={{ fontWeight: 800, fontSize: '1rem', color: INK, marginBottom: 14 }}>{title}</h2>
      {hasItems ? <div style={{ display: 'grid', gap: 10 }}>{children}</div> : <p style={{ color: MUTED, fontSize: '0.86rem' }}>{emptyText}</p>}
    </section>
  );
}

const miniButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(100,116,139,0.2)',
  background: 'rgba(241,245,249,0.85)',
  color: '#475569',
  borderRadius: 8,
  padding: '5px 9px',
  cursor: 'pointer',
  fontSize: '0.76rem',
  fontWeight: 800,
};

function MineRow({ title, meta, status, to, action }: { title: string; meta: string; status: string; to: string; action?: React.ReactNode }) {
  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: '待审核', color: '#925f18', bg: 'rgba(217,168,87,0.12)' },
    approved: { label: '已公开', color: '#15803d', bg: 'rgba(220,252,231,0.78)' },
    rejected: { label: '未通过', color: '#b91c1c', bg: 'rgba(254,242,242,0.9)' },
    closed: { label: '已关闭', color: '#64748b', bg: 'rgba(241,245,249,0.9)' },
    withdrawn: { label: '已撤回', color: '#64748b', bg: 'rgba(241,245,249,0.9)' },
  };
  const item = statusMap[status] || statusMap.pending;
  return (
    <article style={{ borderRadius: 12, border: '1px solid rgba(201,146,46,0.16)', background: '#fff', padding: 14, display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ fontWeight: 800, fontSize: '0.92rem', color: INK, marginBottom: 5 }}>{title}</h3>
        <p style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.78rem', lineHeight: 1.6 }}>{meta}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ padding: '4px 8px', borderRadius: 999, background: item.bg, color: item.color, fontSize: '0.74rem', fontWeight: 800 }}>{item.label}</span>
        {action}
        <Link to={to} style={{ color: '#925f18', fontSize: '0.8rem', fontWeight: 800, textDecoration: 'none' }}>查看</Link>
      </div>
    </article>
  );
}
