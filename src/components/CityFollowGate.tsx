import { useEffect, useMemo, useState } from 'react';
import { CITIES } from '../constants/cities';
import { readStoredCreatorAuth } from '../lib/authSession';

const API = '/api';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.74)';
const GOLD = '#b9781f';

type FollowPayload = {
  cities?: string[];
  onboarding_required?: boolean;
};

export default function CityFollowGate() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const auth = readStoredCreatorAuth();
      if (!auth?.token) {
        if (alive) setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(`${API}/lc/follows`, { headers: { Authorization: `Bearer ${auth.token}` } });
        const payload = await response.json();
        if (!alive || !payload.success) return;
        const cities = Array.isArray(payload.data?.cities) ? payload.data.cities : [];
        setSelected(cities.length > 0 ? cities : auth.city && CITIES.includes(auth.city) ? [auth.city] : []);
        setOpen(Boolean((payload.data as FollowPayload)?.onboarding_required));
        setError('');
      } catch {
        if (alive) setError('关注城市加载失败，请重试');
      } finally {
        if (alive) setLoading(false);
      }
    };
    void check();
    window.addEventListener('lc-auth-changed', check);
    return () => {
      alive = false;
      window.removeEventListener('lc-auth-changed', check);
    };
  }, []);

  const matched = useMemo(() => {
    const keyword = query.trim();
    return (keyword ? CITIES.filter(city => city.includes(keyword)) : CITIES).slice(0, 180);
  }, [query]);

  if (!open) return null;

  const toggle = (city: string) => {
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
    if (!auth?.token) return setOpen(false);
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
      setOpen(false);
      window.dispatchEvent(new CustomEvent('lc-follows-changed', { detail: payload.data }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="follow-city-title" style={overlayStyle}>
      <section style={panelStyle}>
        <header style={{ padding: '20px 22px 14px', borderBottom: '1px solid rgba(31,41,55,0.09)' }}>
          <p style={{ margin: '0 0 5px', color: '#925f18', fontSize: 12, fontWeight: 900 }}>内容偏好</p>
          <h2 id="follow-city-title" style={{ margin: 0, color: INK, fontSize: 22, fontWeight: 900 }}>先选择你关注的城市</h2>
          <p style={{ margin: '8px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.65 }}>用于默认展示本地红黑榜、拼车、委托和公开主页，之后可以随时修改。</p>
        </header>
        <div style={{ padding: '16px 22px 18px' }}>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索城市" style={inputStyle} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, minHeight: 34, marginTop: 12 }}>
            {selected.map(city => <button key={city} type="button" onClick={() => toggle(city)} style={selectedStyle}>{city} ×</button>)}
          </div>
          <div style={{ maxHeight: 250, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 12, paddingRight: 3 }}>
            {matched.map(city => {
              const active = selected.includes(city);
              return <button key={city} type="button" onClick={() => toggle(city)} style={cityStyle(active)}>{city}</button>;
            })}
          </div>
          {loading && <p style={messageStyle}>正在读取关注设置...</p>}
          {error && <p style={{ ...messageStyle, color: '#b42318' }}>{error}</p>}
        </div>
        <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '13px 22px calc(13px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(31,41,55,0.09)', background: '#fffdf8' }}>
          <span style={{ color: MUTED, fontSize: 12 }}>已选 {selected.length}/5</span>
          <button type="button" onClick={save} disabled={saving || loading || selected.length === 0} style={saveStyle(saving || loading || selected.length === 0)}>{saving ? '保存中...' : '保存并继续'}</button>
        </footer>
      </section>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: 'rgba(31,41,55,0.56)',
};

const panelStyle: React.CSSProperties = {
  width: 'min(100%, 560px)',
  maxHeight: 'min(720px, calc(100vh - 32px))',
  overflow: 'hidden',
  borderRadius: 8,
  border: '1px solid rgba(217,168,87,0.26)',
  background: '#fff',
  boxShadow: '0 24px 72px rgba(31,41,55,0.24)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 42,
  padding: '9px 11px',
  borderRadius: 7,
  border: '1px solid rgba(31,41,55,0.14)',
  color: INK,
  outline: 'none',
};

const selectedStyle: React.CSSProperties = {
  border: '1px solid rgba(185,120,31,0.35)',
  borderRadius: 7,
  background: '#fff5df',
  color: '#8b5919',
  padding: '7px 9px',
  cursor: 'pointer',
  fontWeight: 800,
};

const cityStyle = (active: boolean): React.CSSProperties => ({
  minHeight: 38,
  padding: '7px 8px',
  borderRadius: 7,
  border: active ? '1px solid rgba(185,120,31,0.38)' : '1px solid rgba(31,41,55,0.1)',
  background: active ? '#fff5df' : '#fff',
  color: active ? '#8b5919' : '#475569',
  cursor: 'pointer',
  fontWeight: active ? 800 : 600,
});

const messageStyle: React.CSSProperties = { margin: '12px 0 0', color: MUTED, fontSize: 12 };

const saveStyle = (disabled: boolean): React.CSSProperties => ({
  minHeight: 40,
  padding: '9px 16px',
  border: 0,
  borderRadius: 7,
  background: disabled ? '#e5e7eb' : GOLD,
  color: disabled ? '#94a3b8' : '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontWeight: 900,
});
