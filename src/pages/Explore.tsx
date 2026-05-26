import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Creator, PaginatedResponse } from '../types';
import { CITIES } from '../constants/cities';

const API = '/api';

const FILTERS = [
  { key: 'all',          label: '全部' },
  { key: 'creator',      label: '🎭 卡司/DM' },
  { key: 'coser',        label: '⭐ cos委托人' },
  { key: 'photographer', label: '📸 摄影师' },
  { key: 'makeup',       label: '💄 妆造师' },
];

const ROLE_EMOJI: Record<string, string> = {
  creator: '🎭', coser: '⭐', photographer: '📸', makeup: '💄',
};
const ROLE_LABEL: Record<string, string> = {
  creator: '卡司/DM', coser: 'cos委托人', photographer: '摄影师', makeup: '妆造师',
};

const C    = '#0b1a30';
const C2   = '#0f2239';
const GOLD = '#d9a857';

export default function Explore() {
  const [creators, setCreators]     = useState<Creator[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [filter, setFilter]         = useState('all');
  const [city, setCity]             = useState('all');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cityOpen, setCityOpen]     = useState(false);

  useEffect(() => {
    let alive = true;
    const loadCreators = async () => {
      setLoading(true);
      setError('');
      const cityParam = city !== 'all' ? `&city=${encodeURIComponent(city)}` : '';
      try {
        const r = await fetch(`${API}/lc/creators?page=${page}&limit=12${cityParam}`);
        if (!r.ok) throw new Error(`请求失败 (${r.status})`);
        const d = await r.json();
        if (!alive) return;
        if (d.success) {
          const paged = d.data as PaginatedResponse<Creator>;
          setCreators(paged.items || []);
          setTotalPages(paged.totalPages || 1);
        } else setError(d.error || '加载失败');
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : '网络错误');
      } finally {
        if (alive) setLoading(false);
      }
    };
    void loadCreators();
    return () => {
      alive = false;
    };
  }, [page, city]);

  const setFilterAndReset = (f: string) => { setFilter(f); setPage(1); };
  const setCityAndReset   = (c: string) => { setCity(c); setPage(1); setCityOpen(false); };

  const filtered = filter === 'all' ? creators : creators.filter(c => c.role_type === filter);

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: '#fff' }}>

      {/* ── 顶部 Header ── */}
      <div style={{ backgroundColor: C2, borderBottom: '1px solid rgba(201,146,46,0.12)', padding: '48px 20px 40px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div className="gold-line" style={{ marginBottom: 16 }} />
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 8 }}>
            灵契大厅
          </h1>
          <p style={{ color: 'rgba(186,207,231,0.65)', fontSize: '1rem' }}>
            找到你喜欢的卡司、cos委托人、摄影师、妆造师
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* ── 职业筛选 + 城市选择 ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>

          {/* 职业筛选 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1 }}>
            {FILTERS.map(({ key, label }) => {
              const active = filter === key;
              return (
                <button key={key} onClick={() => setFilterAndReset(key)}
                  style={{
                    padding: '8px 18px', borderRadius: 999, fontSize: '0.875rem', cursor: 'pointer',
                    fontWeight: active ? 600 : 400, border: 'none', transition: 'all 0.2s',
                    background: active
                      ? `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`
                      : 'rgba(255,255,255,0.06)',
                    color: active ? C : 'rgba(186,207,231,0.65)',
                    boxShadow: active ? '0 2px 12px rgba(201,146,46,0.3)' : 'none',
                  }}>
                  {label}
                </button>
              );
            })}
          </div>

          {/* 城市下拉 */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setCityOpen(!cityOpen)}
              style={{
                padding: '8px 16px', borderRadius: 999, fontSize: '0.875rem', cursor: 'pointer',
                border: city !== 'all' ? `1px solid ${GOLD}` : '1px solid rgba(201,146,46,0.25)',
                background: city !== 'all' ? 'rgba(201,146,46,0.1)' : 'rgba(255,255,255,0.06)',
                color: city !== 'all' ? GOLD : 'rgba(186,207,231,0.65)',
                display: 'flex', alignItems: 'center', gap: 6, fontWeight: city !== 'all' ? 600 : 400,
              }}>
              📍 {city === 'all' ? '全部城市' : city}
              <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>▼</span>
            </button>

            {cityOpen && (
              <div style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 50,
                backgroundColor: '#0d1f38', border: '1px solid rgba(201,146,46,0.2)',
                borderRadius: 14, padding: '8px', width: 280,
                maxHeight: 320, overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}>
                <button onClick={() => setCityAndReset('all')}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: city === 'all' ? 'rgba(201,146,46,0.12)' : 'transparent', color: city === 'all' ? GOLD : 'rgba(186,207,231,0.75)', fontSize: '0.85rem', marginBottom: 4, fontWeight: city === 'all' ? 600 : 400 }}>
                  全部城市
                </button>
                <div style={{ height: 1, backgroundColor: 'rgba(201,146,46,0.1)', margin: '4px 0 8px' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  {CITIES.map(c => (
                    <button key={c} onClick={() => setCityAndReset(c)}
                      style={{ padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: city === c ? 'rgba(201,146,46,0.12)' : 'transparent', color: city === c ? GOLD : 'rgba(186,207,231,0.7)', fontSize: '0.82rem', textAlign: 'left', fontWeight: city === c ? 600 : 400 }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 点击其他地方关闭城市下拉 */}
        {cityOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setCityOpen(false)} />
        )}

        {/* ── 错误 ── */}
        {error && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ color: '#f87171', marginBottom: 16 }}>{error}</p>
            <button onClick={() => window.location.reload()}
              style={{ background: 'none', border: 'none', color: GOLD, textDecoration: 'underline', cursor: 'pointer', fontSize: '0.875rem' }}>
              重新加载
            </button>
          </div>
        )}

        {/* ── 加载中 ── */}
        {loading && !error && (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <div style={{ width: 40, height: 40, border: `2px solid rgba(201,146,46,0.3)`, borderTopColor: GOLD, borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: 'rgba(186,207,231,0.55)' }}>正在召唤创作者...</p>
          </div>
        )}

        {/* ── 空状态 ── */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.3 }}>🌌</div>
            <p style={{ color: 'rgba(186,207,231,0.55)', fontSize: '1.05rem', marginBottom: 24 }}>
              {city !== 'all' ? `${city} 暂无创作者` : filter === 'all' ? '还没有创作者入驻' : '该职业暂无创作者'}
            </p>
            <Link to="/login" className="btn-gold" style={{ display: 'inline-block', padding: '10px 28px', fontSize: '0.9rem' }}>
              成为第一个 →
            </Link>
          </div>
        )}

        {/* ── 创作者卡片网格 ── */}
        {!loading && !error && filtered.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {filtered.map((c) => (
                <Link key={c.id} to={`/explore/${c.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,146,46,0.12)',
                    borderRadius: 16, padding: '20px', transition: 'all 0.25s', cursor: 'pointer',
                  }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.07)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,146,46,0.3)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.04)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,146,46,0.12)';
                      (e.currentTarget as HTMLElement).style.transform = 'none';
                    }}>

                    {/* 头像 + 名字 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                        background: 'linear-gradient(135deg, rgba(201,146,46,0.2) 0%, rgba(201,146,46,0.1) 100%)',
                        border: '1px solid rgba(201,146,46,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', fontSize: 22,
                      }}>
                        {c.avatar
                          ? <img src={c.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : ROLE_EMOJI[c.role_type || ''] || '🎭'
                        }
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.display_name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'rgba(186,207,231,0.6)', marginTop: 3 }}>
                          {c.city || '未知城市'} · {ROLE_LABEL[c.role_type || ''] || c.role_type}
                        </div>
                      </div>
                    </div>

                    {/* 简介 */}
                    {c.bio && (
                      <p style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.65)', lineHeight: 1.7, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {c.bio}
                      </p>
                    )}

                    {/* 标签 */}
                    {c.tags && c.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {c.tags.slice(0, 4).map((t, i) => (
                          <span key={i} style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem', background: 'rgba(201,146,46,0.1)', border: '1px solid rgba(201,146,46,0.2)', color: GOLD }}>
                            {t}
                          </span>
                        ))}
                        {c.tags.length > 4 && (
                          <span style={{ fontSize: '0.72rem', color: 'rgba(186,207,231,0.45)', alignSelf: 'center' }}>
                            +{c.tags.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* ── 翻页 ── */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 48 }}>
                <PageBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>← 上一页</PageBtn>
                <span style={{ fontSize: '0.875rem', color: 'rgba(186,207,231,0.55)' }}>{page} / {totalPages}</span>
                <PageBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>下一页 →</PageBtn>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PageBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: '9px 22px', borderRadius: 10, fontSize: '0.875rem', cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,146,46,0.15)',
        color: disabled ? 'rgba(186,207,231,0.3)' : 'rgba(186,207,231,0.75)',
        transition: 'all 0.2s',
      }}>
      {children}
    </button>
  );
}
