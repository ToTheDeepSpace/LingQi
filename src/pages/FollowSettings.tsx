import { useEffect, useState } from 'react';
import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CitySearchSelect from '../components/CitySearchSelect';
import { JumuluCompactHeader, JumuluPageFrame } from '../components/JumuluPageChrome';
import { readStoredCreatorAuth } from '../lib/authSession';
import {
  jumuluCardStyle,
  jumuluPrimaryLinkStyle,
  jumuluSecondaryLinkStyle,
} from '../styles/jumuluPageStyles';

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
  const [candidate, setCandidate] = useState('');
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

  const addCity = (city: string) => {
    setCandidate('');
    if (!city || selected.includes(city)) return;
    toggleCity(city);
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
    <JumuluPageFrame currentLabel="关注设置" maxWidth={980}>
      <JumuluCompactHeader
        eyebrow="我的内容范围"
        title="关注设置"
        description="关注城市决定首页和同城内容的默认范围；店家可在档案页随时关注或取消。"
      />

      {loading ? <p style={loadingStyle}>正在读取关注设置...</p> : (
        <div className="follow-settings-grid">
          <section style={panelStyle}>
            <div style={sectionHeadingStyle}>
              <div>
                <h2 style={sectionTitleStyle}>关注城市</h2>
                <p style={sectionNoteStyle}>至少 1 个，最多 5 个</p>
              </div>
              <strong style={countStyle}>{selected.length}/5</strong>
            </div>

            <CitySearchSelect
              value={candidate}
              onChange={addCity}
              allowAll={false}
              placeholder="搜索并添加城市"
            />

            <div style={selectedCitiesStyle}>
              {selected.length === 0 ? (
                <span style={emptyInlineStyle}>还没有选择城市</span>
              ) : selected.map(city => (
                <button key={city} type="button" onClick={() => toggleCity(city)} style={selectedCityStyle}>
                  {city}<span aria-hidden="true">×</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || selected.length === 0}
              style={{ ...jumuluPrimaryLinkStyle, width: '100%', opacity: saving || selected.length === 0 ? 0.52 : 1 }}
            >
              {saving ? '保存中...' : '保存城市'}
            </button>
          </section>

          <section style={panelStyle}>
            <div style={sectionHeadingStyle}>
              <div>
                <h2 style={sectionTitleStyle}>关注店家</h2>
                <p style={sectionNoteStyle}>从店家档案页添加</p>
              </div>
              <strong style={countStyle}>{stores.length}</strong>
            </div>

            {stores.length === 0 ? (
              <div style={emptyStyle}>还没有关注店家。</div>
            ) : (
              <div style={storeListStyle}>
                {stores.map(store => (
                  <div key={store.id} style={storeRowStyle}>
                    <Link to={`/stores/${store.id}`} style={storeLinkStyle}>
                      <strong>{store.dm_name}</strong>
                      <span>{store.city || '城市待补'}{store.workplace ? ` · ${store.workplace}` : ''}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => void unfollowStore(store)}
                      style={{ ...jumuluSecondaryLinkStyle, minHeight: 32, padding: '0 10px', flex: '0 0 auto' }}
                    >
                      取消
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {error && <p role="alert" style={errorStyle}>{error}</p>}
    </JumuluPageFrame>
  );
}

const panelStyle: React.CSSProperties = { ...jumuluCardStyle, minWidth: 0, padding: 16 };
const loadingStyle: React.CSSProperties = { color: '#64748b', padding: '24px 0' };
const sectionHeadingStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 };
const sectionTitleStyle: React.CSSProperties = { margin: 0, color: '#27364a', fontSize: 17, fontWeight: 900 };
const sectionNoteStyle: React.CSSProperties = { margin: '3px 0 0', color: '#64748b', fontSize: 12 };
const countStyle: React.CSSProperties = { color: '#a66a1f', fontSize: 13 };
const selectedCitiesStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 7, minHeight: 72, margin: '12px 0' };
const selectedCityStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, margin: 0, padding: '0 10px', border: '1px solid rgba(166,106,31,0.26)', borderRadius: 7, background: '#fff5df', color: '#8b5919', fontSize: 13, fontWeight: 800 };
const emptyInlineStyle: React.CSSProperties = { color: '#94a3b8', fontSize: 13, alignSelf: 'center' };
const emptyStyle: React.CSSProperties = { padding: '24px 0', color: '#64748b', fontSize: 13 };
const storeListStyle: React.CSSProperties = { display: 'grid' };
const storeRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 58, borderBottom: '1px solid rgba(31,41,55,0.08)' };
const storeLinkStyle: React.CSSProperties = { display: 'grid', gap: 3, minWidth: 0, color: '#27364a', textDecoration: 'none' };
const errorStyle: React.CSSProperties = { margin: 0, padding: '10px 12px', border: '1px solid rgba(180,35,24,0.18)', borderRadius: 7, background: '#fff6f5', color: '#b42318', fontSize: 13 };
