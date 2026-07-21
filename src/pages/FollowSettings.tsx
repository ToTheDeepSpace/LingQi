import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CITIES } from '../constants/cities';
import { readStoredCreatorAuth } from '../lib/authSession';

const API = '/api';

type FollowedStore = {
  id: string;
  dm_name: string;
  city?: string | null;
  workplace?: string | null;
};

export default function FollowSettings() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [stores, setStores] = useState<FollowedStore[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const auth = readStoredCreatorAuth();
    if (!auth?.token) {
      navigate('/login');
      return;
    }
    const controller = new AbortController();
    fetch(`${API}/lc/follows`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      signal: controller.signal,
    }).then(response => response.json()).then(payload => {
      if (!payload.success) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '关注设置加载失败');
      setSelected(Array.isArray(payload.data?.cities) ? payload.data.cities : []);
      setStores(Array.isArray(payload.data?.stores) ? payload.data.stores : []);
    }).catch(loadError => {
      if (loadError?.name !== 'AbortError') setError(loadError instanceof Error ? loadError.message : '关注设置加载失败');
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [navigate]);

  const matched = useMemo(() => {
    const keyword = query.trim();
    return (keyword ? CITIES.filter(city => city.includes(keyword)) : CITIES).slice(0, 180);
  }, [query]);

  const toggleCity = (city: string) => {
    setError('');
    setSelected(current => {
      if (current.includes(city)) return current.filter(item => item !== city);
      if (current.length >= 5) {
        setError('最多关注 5 个城市');
        return current;
      }
      return [...current, city];
    });
  };

  const save = async () => {
    const auth = readStoredCreatorAuth();
    if (!auth?.token) return navigate('/login');
    if (selected.length === 0) return setError('请至少关注一个城市');
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API}/lc/follows/cities`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cities: selected }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '保存失败');
      window.dispatchEvent(new CustomEvent('lc-follows-changed', { detail: payload.data }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const unfollowStore = async (store: FollowedStore) => {
    const auth = readStoredCreatorAuth();
    if (!auth?.token) return navigate('/login');
    const response = await fetch(`${API}/lc/follows/stores/${encodeURIComponent(store.id)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ following: false }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) return setError(typeof payload.error === 'string' ? payload.error : payload.error?.message || '取消关注失败');
    setStores(current => current.filter(item => item.id !== store.id));
  };

  return (
    <main style={{ minHeight: '72vh', background: '#fffdf8', color: '#1f2937', padding: '28px 20px 64px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <Link to="/dashboard" style={{ color: '#275389', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>返回我的主页</Link>
        <header style={{ margin: '18px 0 22px' }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>关注设置</h1>
          <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.65 }}>城市决定首页和同城内容的默认范围；店家可以在其档案页关注或取消。</p>
        </header>
        {loading ? <p style={{ color: '#64748b' }}>正在读取关注设置...</p> : <>
          <section style={{ padding: '18px 0 24px', borderTop: '1px solid rgba(31,41,55,0.1)' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 17 }}>关注城市 <span style={{ color: '#64748b', fontSize: 12 }}>最多 5 个</span></h2>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索城市" style={{ width: '100%', minHeight: 42, padding: '9px 11px', borderRadius: 7, border: '1px solid rgba(31,41,55,0.14)' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
              {selected.map(city => <button key={city} type="button" onClick={() => toggleCity(city)} style={{ border: '1px solid rgba(185,120,31,0.35)', borderRadius: 7, background: '#fff5df', color: '#8b5919', padding: '7px 9px', fontWeight: 800 }}>{city} ×</button>)}
            </div>
            <div style={{ maxHeight: 270, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6, marginTop: 12 }}>
              {matched.map(city => <button key={city} type="button" onClick={() => toggleCity(city)} style={{ minHeight: 38, borderRadius: 7, border: '1px solid rgba(31,41,55,0.1)', background: selected.includes(city) ? '#fff5df' : '#fff', color: selected.includes(city) ? '#8b5919' : '#475569', fontWeight: selected.includes(city) ? 800 : 600 }}>{city}</button>)}
            </div>
            <button type="button" onClick={() => void save()} disabled={saving || selected.length === 0} style={{ marginTop: 16, minHeight: 42, padding: '9px 18px', border: 0, borderRadius: 7, background: '#b9781f', color: '#fff', fontWeight: 900 }}>{saving ? '保存中...' : '保存城市'}</button>
          </section>
          <section style={{ padding: '18px 0 0', borderTop: '1px solid rgba(31,41,55,0.1)' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 17 }}>关注店家</h2>
            {stores.length === 0 ? <p style={{ color: '#64748b' }}>还没有关注店家，可以去店家档案页添加。</p> : stores.map(store => (
              <div key={store.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(31,41,55,0.08)' }}>
                <Link to={`/stores/${store.id}`} style={{ color: '#27364a', textDecoration: 'none', fontWeight: 850 }}>{store.dm_name}<span style={{ marginLeft: 8, color: '#64748b', fontSize: 12, fontWeight: 600 }}>{store.city || '城市待补'}</span></Link>
                <button type="button" onClick={() => void unfollowStore(store)} style={{ border: '1px solid rgba(31,41,55,0.14)', borderRadius: 7, background: '#fff', color: '#64748b', padding: '7px 10px' }}>取消关注</button>
              </div>
            ))}
          </section>
        </>}
        {error && <p style={{ color: '#b42318', fontSize: 13 }}>{error}</p>}
      </div>
    </main>
  );
}
