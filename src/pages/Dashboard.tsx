import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import ImageUpload from '../components/ImageUpload';
import type { Creator, Service, Portfolio, AuthData } from '../types';

const API = '/api';

type ValuePiece = Date | null;
type CalendarValue = ValuePiece | [ValuePiece, ValuePiece];

function getToken(): string {
  try {
    const stored = localStorage.getItem('lc_creator');
    return stored ? (JSON.parse(stored) as AuthData).token : '';
  } catch { return ''; }
}

const TABS = [
  { id: 'profile', label: '资料', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0z M12 14c-3.3 0-6 1.8-6 4v1h12v-1c0-2.2-2.7-4-6-4z' },
  { id: 'services', label: '服务', icon: 'M4 6h16M4 10h16M4 14h12 M8 18l2 2 4-4' },
  { id: 'availability', label: '档期', icon: 'M8 2v4M16 2v4M3 10h18M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7' },
  { id: 'portfolio', label: '作品', icon: 'M4 16l4.6-4.6 3.4 3.4L18 9l4 4V6a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2h12 M6 7h.01' },
] as const;

export default function Dashboard() {
  const navigate = useNavigate();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [tab, setTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ display_name: '', bio: '', city: '', wechat: '', tags: '' });
  const [newSvc, setNewSvc] = useState({ service_type: '', price: '', duration: '', description: '' });
  const [availDates, setAvailDates] = useState<string[]>([]);

  const token = getToken();

  useEffect(() => {
    const stored = localStorage.getItem('lc_creator');
    if (!stored) { navigate('/login'); return; }
    const data: AuthData = JSON.parse(stored);
    if (!data.id) { navigate('/login'); return; }

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
      } else {
        setError(profileData.error || '加载创作者数据失败');
      }
      if (availData.success) {
        setAvailDates((availData.data || []).map((a: { date: string }) => a.date));
      }
    }).catch(() => setError('网络错误，请检查后端是否在运行')).finally(() => setLoading(false));
  }, [navigate]);

  const saveProfile = async () => {
    if (!creator) return;
    setSaving(true);
    setError('');
    const tags = form.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    const r = await fetch(`${API}/lc/creators/${creator.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, tags }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.success) { setMsg('已保存'); setTimeout(() => setMsg(''), 2000); }
    else setError(d.error || '保存失败');
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
    else setError(d.error || '删除失败');
  };

  const addPortfolio = async (url: string) => {
    if (!creator) return;
    setError('');
    const r = await fetch(`${API}/lc/portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ creatorId: creator.id, imageUrl: url }),
    });
    const d = await r.json();
    if (d.success) setPortfolio([...portfolio, d.data]);
    else setError(d.error || '添加失败');
  };

  const deletePortfolio = async (id: string) => {
    const r = await fetch(`${API}/lc/portfolio/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (d.success) setPortfolio(portfolio.filter(p => p.id !== id));
    else setError(d.error || '删除失败');
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
        if (d.success) setAvailDates(availDates.filter(d => d !== dateStr));
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

  if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gold-300 border-t-gold-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-base text-ink-300">加载中...</p>
      </div>
    </div>
  );

  if (!creator) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-5 opacity-25">🌊</div>
        <p className="text-base text-ink-400 mb-4">{error || '加载失败'}</p>
        <button onClick={() => navigate('/login')} className="text-sm text-gold-600 underline hover:text-gold-500">返回登录</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-6xl mx-auto px-5 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-ink-900">我的主页</h1>
            <p className="text-sm text-ink-400 mt-1">{creator.display_name}</p>
          </div>
          <Link to={`/explore/${creator.id}`}
            className="text-sm text-gold-600 hover:text-gold-500 transition-colors">
            查看公开页 →
          </Link>
        </div>

        {error && (
          <div className="mb-5 p-4 bg-red-50 text-red-600 rounded-[0.75rem] text-sm border border-red-100">{error}</div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar tabs */}
          <div className="lg:w-52 shrink-0">
            <div className="flex lg:flex-col gap-1 bg-warm-white rounded-[1rem] p-1.5 border border-gold-200/40 shadow-gold overflow-x-auto lg:overflow-visible">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2.5 flex-1 lg:flex-none py-2.5 px-4 text-sm font-medium rounded-[0.75rem] transition-colors whitespace-nowrap ${
                    tab === t.id
                      ? 'bg-ink-800 text-white'
                      : 'text-ink-500 hover:text-ink-700 hover:bg-gold-50'
                  }`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={t.icon} />
                  </svg>
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">

            {/* ======== Profile ======== */}
            {tab === 'profile' && (
              <div className="bg-warm-white rounded-[1rem] p-6 lg:p-8 border border-gold-200/40 shadow-gold space-y-5">
                <h2 className="text-base font-semibold text-ink-800">编辑资料</h2>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs text-ink-500 mb-2 block font-medium">昵称 / 艺名</label>
                    <input type="text" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gold-200 rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-ink-500 mb-2 block font-medium">城市</label>
                    <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gold-200 rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition-colors"
                      placeholder="如：上海" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-ink-500 mb-2 block font-medium">简介</label>
                  <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gold-200 rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition-colors h-24 resize-none" />
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs text-ink-500 mb-2 block font-medium">标签</label>
                    <input type="text" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gold-200 rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition-colors"
                      placeholder="用逗号分隔，如：恋陪, 情感本, 日系" />
                  </div>
                  <div>
                    <label className="text-xs text-ink-500 mb-2 block font-medium">微信</label>
                    <input type="text" value={form.wechat} onChange={e => setForm({ ...form, wechat: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gold-200 rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition-colors"
                      placeholder="粉丝可通过申请联系你" />
                    <p className="text-xs text-ink-400 mt-1.5">粉丝需要通过申请才能看到你的微信</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-1">
                  <button onClick={saveProfile} disabled={saving}
                    className="px-6 py-2.5 bg-ink-800 text-white text-sm rounded-[0.75rem] hover:bg-ink-700 disabled:opacity-50 transition-colors">
                    {saving ? '保存中...' : '保存资料'}
                  </button>
                  {msg && <span className="text-sm text-green-600">{msg}</span>}
                </div>
              </div>
            )}

            {/* ======== Services ======== */}
            {tab === 'services' && (
              <div className="space-y-4">
                {services.map(s => (
                  <div key={s.id}
                    className="bg-warm-white rounded-[1rem] p-5 border border-gold-200/40 shadow-gold flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-ink-800">{s.service_type}</span>
                      {s.duration && <span className="text-sm text-ink-400 ml-2">· {s.duration}</span>}
                      {s.description && <p className="text-xs text-ink-400 mt-0.5">{s.description}</p>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-base font-bold text-gold-600">¥{s.price}</span>
                      <button onClick={() => deleteService(s.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors">删除</button>
                    </div>
                  </div>
                ))}
                <div className="bg-warm-white rounded-[1rem] p-5 border border-gold-200/40 border-dashed shadow-gold space-y-4">
                  <p className="text-sm font-semibold text-ink-800">添加服务</p>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" value={newSvc.service_type} onChange={e => setNewSvc({ ...newSvc, service_type: e.target.value })}
                      className="px-4 py-2.5 border border-gold-200 rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream focus:outline-none focus:border-gold-400 transition-colors"
                      placeholder="服务类型" />
                    <input type="number" value={newSvc.price} onChange={e => setNewSvc({ ...newSvc, price: e.target.value })}
                      className="px-4 py-2.5 border border-gold-200 rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream focus:outline-none focus:border-gold-400 transition-colors"
                      placeholder="价格（元）" />
                  </div>
                  <input type="text" value={newSvc.duration} onChange={e => setNewSvc({ ...newSvc, duration: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gold-200 rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream focus:outline-none focus:border-gold-400 transition-colors"
                    placeholder="时长" />
                  <button onClick={addService}
                    className="px-5 py-2 bg-gold-50 text-gold-700 text-sm rounded-[0.75rem] hover:bg-gold-100 transition-colors border border-gold-200/60">
                    添加
                  </button>
                </div>
              </div>
            )}

            {/* ======== Availability ======== */}
            {tab === 'availability' && (
              <div className="bg-warm-white rounded-[1rem] p-6 border border-gold-200/40 shadow-gold">
                <p className="text-sm font-semibold text-ink-800 mb-5">点击选择可约日期</p>
                <div className="max-w-md">
                  <Calendar
                    onClickDay={toggleDate}
                    tileClassName={({ date }) => {
                      const dateStr = date.toISOString().split('T')[0];
                      return availDates.includes(dateStr) ? 'bg-gold-100 text-gold-700 rounded-full font-bold' : '';
                    }}
                    className="border-0 w-full"
                    minDate={new Date()}
                  />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {availDates.map(d => (
                    <span key={d} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold-50 text-gold-700 text-sm rounded-lg border border-gold-200/60">
                      {d}
                      <button onClick={() => { const date = new Date(d + 'T00:00:00'); toggleDate(date); }}
                        className="ml-1 hover:text-red-500 transition-colors">✕</button>
                    </span>
                  ))}
                </div>
                {availDates.length === 0 && <p className="text-sm text-ink-300 mt-5">还没有标记可约日期</p>}
              </div>
            )}

            {/* ======== Portfolio ======== */}
            {tab === 'portfolio' && (
              <div className="space-y-5">
                {portfolio.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                    {portfolio.map(p => (
                      <div key={p.id}
                        className="aspect-square rounded-lg bg-gold-100 overflow-hidden relative group">
                        <img src={p.image_url} alt={p.caption || ''} className="w-full h-full object-cover" />
                        <button onClick={() => deletePortfolio(p.id)}
                          className="absolute top-1.5 right-1.5 bg-red-500 text-white w-6 h-6 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="bg-warm-white rounded-[1rem] p-6 border border-gold-200/40 border-dashed shadow-gold space-y-4">
                  <p className="text-sm font-semibold text-ink-800">添加作品</p>
                  <ImageUpload onUploaded={addPortfolio} token={token} api={API} />
                  <p className="text-xs text-ink-400">支持 JPG、PNG、GIF，最大 10MB</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
