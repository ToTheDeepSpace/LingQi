import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import EntityTags from '../components/EntityTags';
import { readStoredCreatorAuth } from '../lib/authSession';
import type { ScriptCatalogItem } from '../types';

const API = '/api';
const BG = '#fffdf8';
const INK = '#1f2937';
const GOLD = '#d9a857';

type RatingItem = {
  id: string;
  profile_name: string;
  rating: number;
  content?: string | null;
  tags?: string[];
  created_at: string;
};

type RatingPayload = {
  ratings: RatingItem[];
  mine: RatingItem | null;
  summary: { avg: number | null; count: number };
};

export default function Scripts() {
  const [scripts, setScripts] = useState<ScriptCatalogItem[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ScriptCatalogItem | null>(null);
  const [ratings, setRatings] = useState<RatingPayload | null>(null);
  const [ratingDraft, setRatingDraft] = useState({ rating: 5, content: '', tags: '' });
  const [message, setMessage] = useState('');
  const auth = readStoredCreatorAuth();
  const token = auth?.token || '';

  const visibleScripts = useMemo(() => {
    const key = query.trim().toLowerCase();
    if (!key) return scripts;
    return scripts.filter(script => [
      script.name,
      ...(script.player_roles || []).map(role => role.role_name),
    ].join(' ').toLowerCase().includes(key));
  }, [query, scripts]);

  const loadScripts = useCallback(async (autoSelect = false) => {
    const r = await fetch(`${API}/lc/scripts`);
    const d = await r.json();
    if (d.success) {
      setScripts(d.data || []);
      if (autoSelect && (d.data || []).length) setSelected(d.data[0]);
    }
  }, []);

  const loadRatings = useCallback(async (script: ScriptCatalogItem | null) => {
    if (!script) return;
    const r = await fetch(`${API}/lc/scripts/${script.id}/ratings`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const d = await r.json();
    if (d.success) {
      setRatings(d.data);
      const mine = d.data?.mine;
      if (mine) setRatingDraft({ rating: mine.rating || 5, content: mine.content || '', tags: (mine.tags || []).join(', ') });
      else setRatingDraft({ rating: 5, content: '', tags: '' });
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadScripts(true), 0);
    return () => window.clearTimeout(timer);
  }, [loadScripts]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRatings(selected), 0);
    return () => window.clearTimeout(timer);
  }, [loadRatings, selected]);

  const submitRating = async () => {
    setMessage('');
    if (!selected) return;
    if (!auth?.token) {
      setMessage('登录并完成手机号或邮箱验证后可给剧本评分');
      return;
    }
    const r = await fetch(`${API}/lc/scripts/${selected.id}/ratings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({
        rating: ratingDraft.rating,
        content: ratingDraft.content,
        tags: ratingDraft.tags.split(/[，,、\s]+/).map(tag => tag.trim()).filter(Boolean),
        scriptName: selected.name,
      }),
    });
    const d = await r.json();
    if (!r.ok || !d.success) {
      setMessage(d.error || '评分失败');
      return;
    }
    setMessage(d.data?.message || '评分已提交审核，通过后才会公开展示');
  };

  return (
    <main style={{ minHeight: '100vh', background: BG, color: INK, padding: '42px 18px 72px' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <p style={{ margin: 0, color: GOLD, fontWeight: 900, letterSpacing: 0 }}>剧本口碑</p>
          <h1 style={{ margin: '8px 0 10px', fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 3.8rem)', letterSpacing: 0 }}>
            剧本库从剧司辰来，口碑沉淀在灵契。
          </h1>
          <p style={{ margin: 0, maxWidth: 780, color: 'rgba(71,85,105,0.78)', lineHeight: 1.8 }}>
            先记录评分、短评和标签；后面再长出人生角色榜、最牢角色榜、剧透区和吃瓜大事记。
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 18, alignItems: 'start' }}>
          <section style={panelStyle}>
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜索剧本名 / 角色名"
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 12, padding: '12px 13px', fontSize: 14, marginBottom: 12 }}
            />
            <div style={{ display: 'grid', gap: 10, maxHeight: '68vh', overflow: 'auto' }}>
              {visibleScripts.map(script => (
                <button
                  key={script.id}
                  type="button"
                  onClick={() => setSelected(script)}
                  style={{
                    textAlign: 'left',
                    border: selected?.id === script.id ? '1px solid rgba(217,168,87,0.7)' : '1px solid rgba(148,163,184,0.18)',
                    borderRadius: 12,
                    padding: 12,
                    background: selected?.id === script.id ? 'rgba(217,168,87,0.12)' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <strong>{script.name}</strong>
                  <p style={{ margin: '6px 0 0', color: 'rgba(71,85,105,0.66)', fontSize: 12 }}>
                    {script.rating_avg ? `${script.rating_avg} 分 · ${script.rating_count || 0} 条评分` : '暂无评分'}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {selected && (
            <section style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 28 }}>{selected.name}</h2>
                  <p style={{ margin: '6px 0 0', color: 'rgba(71,85,105,0.68)' }}>
                    {ratings?.summary.avg ? `${ratings.summary.avg} 分 · ${ratings.summary.count} 条评分` : '暂无评分'}
                  </p>
                </div>
                <a href="/scripts/contribute" style={{ color: GOLD, fontWeight: 900, textDecoration: 'none' }}>维护剧本资料</a>
              </div>

              <div style={{ marginBottom: 18 }}>
                <h3 style={subheadStyle}>角色</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(selected.player_roles || []).map(role => (
                    <span key={`${role.role_name}-${role.gender}`} style={pillStyle}>{role.role_name}{role.gender ? ` · ${role.gender}` : ''}</span>
                  ))}
                  {!selected.player_roles?.length && <span style={{ color: 'rgba(71,85,105,0.62)', fontSize: 13 }}>暂无角色资料</span>}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={subheadStyle}>大家给它的标签</h3>
                <EntityTags targetType="script" targetId={selected.id} />
              </div>

              <div style={{ marginBottom: 20, borderTop: '1px solid rgba(148,163,184,0.18)', paddingTop: 18 }}>
                <h3 style={subheadStyle}>给这个本评分</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  <select value={ratingDraft.rating} onChange={event => setRatingDraft({ ...ratingDraft, rating: Number(event.target.value) })} style={inputStyle}>
                    {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} 分</option>)}
                  </select>
                  <textarea value={ratingDraft.content} onChange={event => setRatingDraft({ ...ratingDraft, content: event.target.value })} placeholder="短评，可空" style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }} />
                  <input value={ratingDraft.tags} onChange={event => setRatingDraft({ ...ratingDraft, tags: event.target.value })} placeholder="短评标签，用逗号分隔" style={inputStyle} />
                  <button onClick={() => void submitRating()} style={{ border: 0, borderRadius: 12, padding: '11px 14px', background: '#1f2937', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>保存评分</button>
                  {message && <p style={{ margin: 0, color: '#b45309', fontSize: 13 }}>{message}</p>}
                </div>
              </div>

              <div>
                <h3 style={subheadStyle}>最近短评</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {(ratings?.ratings || []).map(item => (
                    <article key={item.id} style={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: 12, padding: 12, background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <strong>{item.profile_name || '用户'}</strong>
                        <span style={{ color: GOLD, fontWeight: 900 }}>{item.rating} 分</span>
                      </div>
                      {item.content && <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: 'rgba(31,41,55,0.82)' }}>{item.content}</p>}
                      {(item.tags || []).length > 0 && <p style={{ margin: 0, fontSize: 12, color: 'rgba(71,85,105,0.62)' }}>#{(item.tags || []).join(' #')}</p>}
                    </article>
                  ))}
                  {!ratings?.ratings?.length && <p style={{ color: 'rgba(71,85,105,0.62)' }}>还没有短评。</p>}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

const panelStyle: React.CSSProperties = {
  border: '1px solid rgba(148,163,184,0.18)',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.86)',
  padding: 18,
  boxShadow: '0 16px 44px rgba(31,41,55,0.07)',
};

const subheadStyle: React.CSSProperties = { margin: '0 0 10px', fontSize: 15, color: '#334155' };
const pillStyle: React.CSSProperties = { borderRadius: 999, background: 'rgba(217,168,87,0.1)', color: '#925f18', padding: '6px 10px', fontSize: 13, fontWeight: 800 };
const inputStyle: React.CSSProperties = { border: '1px solid rgba(148,163,184,0.28)', borderRadius: 12, padding: '10px 12px', fontSize: 14, color: INK, background: '#fff' };
