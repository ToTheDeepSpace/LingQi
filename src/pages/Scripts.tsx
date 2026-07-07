import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import EntityTags from '../components/EntityTags';
import { ReputationBadge, ReputationButton, ReputationHubShell, ReputationPanel } from '../components/ReputationHubChrome';
import { readStoredCreatorAuth } from '../lib/authSession';
import type { ScriptCatalogItem, ScriptRoleCatalogItem } from '../types';

const API = '/api';
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

type EntityRatingItem = {
  id: string;
  profile_name: string;
  target_title?: string | null;
  rating: number;
  content?: string | null;
  spoiler_level?: string | null;
  created_at: string;
};

type EntityRatingPayload = {
  ratings: EntityRatingItem[];
  mine: EntityRatingItem | null;
  summary: { avg: number | null; count: number };
};

function scriptRoles(script: ScriptCatalogItem | null) {
  if (!script) return [];
  return [...(script.player_roles || []), ...(script.actor_roles || [])].filter(role => role.role_name && role.target_id);
}

function firstRole(script: ScriptCatalogItem | null) {
  return scriptRoles(script)[0] || null;
}

function roleKindLabel(role: ScriptRoleCatalogItem) {
  if (role.role_source === 'player' || role.role_kind === 'player') return '玩家角色';
  if (role.role_kind === 'dm') return 'DM';
  if (role.role_kind === 'field_control') return '场控';
  if (role.role_kind === 'npc') return 'NPC';
  if (role.role_kind === 'assistant') return '演绎协作';
  if (role.role_kind === 'actor') return '演绎角色';
  return role.role_kind || '演绎角色';
}

function ratingText(avg?: number | null, count?: number | null) {
  return avg ? `${avg} 分 · ${count || 0} 条评分` : '暂无评分';
}

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

export default function Scripts() {
  const [scripts, setScripts] = useState<ScriptCatalogItem[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ScriptCatalogItem | null>(null);
  const [selectedRole, setSelectedRole] = useState<ScriptRoleCatalogItem | null>(null);
  const [ratings, setRatings] = useState<RatingPayload | null>(null);
  const [roleRatings, setRoleRatings] = useState<EntityRatingPayload | null>(null);
  const [ratingDraft, setRatingDraft] = useState({ rating: 5, content: '', tags: '' });
  const [roleRatingDraft, setRoleRatingDraft] = useState({ rating: 5, content: '', spoiler: false });
  const [scriptMessage, setScriptMessage] = useState('');
  const [roleMessage, setRoleMessage] = useState('');
  const auth = readStoredCreatorAuth();
  const token = auth?.token || '';

  const visibleScripts = useMemo(() => {
    const key = query.trim().toLowerCase();
    if (!key) return scripts;
    return scripts.filter(script => [
      script.name,
      ...scriptRoles(script).map(role => role.role_name),
    ].join(' ').toLowerCase().includes(key));
  }, [query, scripts]);

  const selectedRoles = useMemo(() => scriptRoles(selected), [selected]);

  const pickScript = useCallback((script: ScriptCatalogItem) => {
    setSelected(script);
    setSelectedRole(firstRole(script));
    setRoleRatings(null);
    setScriptMessage('');
    setRoleMessage('');
  }, []);

  const loadScripts = useCallback(async (autoSelect = false) => {
    try {
      const r = await fetch(`${API}/lc/scripts`);
      if (!r.ok) return;
      const d = await r.json();
      if (d.success) {
        const nextScripts = d.data || [];
        setScripts(nextScripts);
        if (autoSelect && nextScripts.length) {
          setSelected(nextScripts[0]);
          setSelectedRole(firstRole(nextScripts[0]));
        }
      }
    } catch {
      setScripts([]);
    }
  }, []);

  const loadRatings = useCallback(async (script: ScriptCatalogItem | null) => {
    if (!script) return;
    try {
      const r = await fetch(`${API}/lc/scripts/${script.id}/ratings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) return;
      const d = await r.json();
      if (d.success) {
        setRatings(d.data);
        const mine = d.data?.mine;
        if (mine) setRatingDraft({ rating: mine.rating || 5, content: mine.content || '', tags: (mine.tags || []).join(', ') });
        else setRatingDraft({ rating: 5, content: '', tags: '' });
      }
    } catch {
      setRatings({ ratings: [], mine: null, summary: { avg: null, count: 0 } });
    }
  }, [token]);

  const loadRoleRatings = useCallback(async (role: ScriptRoleCatalogItem | null) => {
    if (!role?.target_id) {
      setRoleRatings(null);
      return;
    }
    try {
      const r = await fetch(`${API}/lc/entity-ratings?targetType=script_role&targetId=${encodeURIComponent(role.target_id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) return;
      const d = await r.json();
      if (d.success) {
        setRoleRatings(d.data);
        const mine = d.data?.mine;
        if (mine) setRoleRatingDraft({ rating: mine.rating || 5, content: mine.content || '', spoiler: mine.spoiler_level === 'spoiler' });
        else setRoleRatingDraft({ rating: 5, content: '', spoiler: false });
      }
    } catch {
      setRoleRatings({ ratings: [], mine: null, summary: { avg: null, count: 0 } });
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

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRoleRatings(selectedRole), 0);
    return () => window.clearTimeout(timer);
  }, [loadRoleRatings, selectedRole]);

  const submitRating = async () => {
    setScriptMessage('');
    if (!selected) return;
    if (!auth?.token) {
      setScriptMessage('登录并完成手机号或邮箱验证后可给剧本评分');
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
      setScriptMessage(d.error || '评分失败');
      return;
    }
    setScriptMessage(d.data?.message || '评分已提交审核，通过后才会公开展示');
  };

  const submitRoleRating = async () => {
    setRoleMessage('');
    if (!selectedRole?.target_id) return;
    if (!auth?.token) {
      setRoleMessage('登录并完成手机号或邮箱验证后可给角色评分');
      return;
    }
    if (!roleRatingDraft.content.trim()) {
      setRoleMessage('请写一句评分理由');
      return;
    }
    const r = await fetch(`${API}/lc/entity-ratings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({
        targetType: 'script_role',
        targetId: selectedRole.target_id,
        rating: roleRatingDraft.rating,
        content: roleRatingDraft.content,
        spoilerLevel: roleRatingDraft.spoiler ? 'spoiler' : 'none',
      }),
    });
    const d = await r.json();
    if (!r.ok || !d.success) {
      setRoleMessage(d.error || '评分失败');
      return;
    }
    setRoleMessage(d.data?.message || '角色评分已提交审核，通过后才会公开展示');
  };

  return (
    <ReputationHubShell active="roles">
      <section style={rolesHeroStyle}>
        <ReputationPanel style={heroCopyStyle}>
          <ReputationBadge>红黑榜 / 角色点评</ReputationBadge>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(2.1rem, 4vw, 2.7rem)', lineHeight: 1.08 }}>
            角色点评
          </h1>
          <p style={{ margin: 0, maxWidth: 760, color: 'rgba(31,41,55,0.76)', lineHeight: 1.65, fontSize: 15, fontWeight: 600 }}>
            剧本里的玩家角色、DM、场控、NPC 等都可以评分，也都可以被打 tag。评分写理由，tag 让社区慢慢把共识投出来。
          </p>
        </ReputationPanel>
        <aside style={searchCardStyle}>
          <strong style={{ color: '#a66a1f', fontSize: 13 }}>搜剧本 / 角色</strong>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="琳琅 / 祝魇 / 场控"
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid rgba(166,106,31,0.16)', borderRadius: 8, padding: '12px 13px', fontSize: 14, background: '#fff' }}
          />
          <ReputationButton to="/scripts/contribute" tone="gold">维护剧本库</ReputationButton>
        </aside>
      </section>

      <div style={rolesBodyStyle}>
          <ReputationPanel>
            <div style={{ display: 'grid', gap: 10, maxHeight: '68vh', overflow: 'auto' }}>
              {visibleScripts.map(script => (
                <button
                  key={script.id}
                  type="button"
                  onClick={() => pickScript(script)}
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
                    {ratingText(script.rating_avg, script.rating_count)} · {scriptRoles(script).length} 个角色
                  </p>
                </button>
              ))}
            </div>
          </ReputationPanel>

          {selected && (
            <ReputationPanel style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 28 }}>{selected.name}</h2>
                  <p style={{ margin: '6px 0 0', color: 'rgba(71,85,105,0.68)' }}>
                    {ratingText(ratings?.summary.avg ?? selected.rating_avg, ratings?.summary.count ?? selected.rating_count)}
                  </p>
                </div>
                <a href="/scripts/contribute" style={{ color: GOLD, fontWeight: 900, textDecoration: 'none' }}>维护剧本资料</a>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={subheadStyle}>剧本标签</h3>
                <EntityTags targetType="script" targetId={selected.id} />
              </div>

              <div style={{ marginBottom: 20, borderTop: '1px solid rgba(148,163,184,0.18)', paddingTop: 18 }}>
                <h3 style={subheadStyle}>角色口碑</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 12 }}>
                  {selectedRoles.map(role => {
                    const active = selectedRole?.target_id === role.target_id;
                    return (
                      <article
                        key={role.target_id}
                        style={{
                          border: active ? '1px solid rgba(217,168,87,0.74)' : '1px solid rgba(148,163,184,0.18)',
                          borderRadius: 14,
                          background: active ? 'rgba(217,168,87,0.1)' : '#fff',
                          padding: 12,
                          display: 'grid',
                          gap: 10,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRole(role);
                            setRoleMessage('');
                          }}
                          style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                        >
                          <span style={roleMetaStyle}>{roleKindLabel(role)}{role.gender ? ` · ${role.gender}` : ''}</span>
                          <strong style={{ display: 'block', marginTop: 5, fontSize: 17 }}>{role.role_name}</strong>
                          <span style={{ display: 'block', marginTop: 5, color: active ? '#925f18' : 'rgba(71,85,105,0.64)', fontSize: 12, fontWeight: 800 }}>
                            {ratingText(role.rating_avg, role.rating_count)}
                          </span>
                        </button>
                        <EntityTags targetType="script_role" targetId={role.target_id} compact />
                      </article>
                    );
                  })}
                  {selectedRoles.length === 0 && <span style={{ color: 'rgba(71,85,105,0.62)', fontSize: 13 }}>暂无角色资料</span>}
                </div>
              </div>

              {selectedRole && (
                <div style={{ marginBottom: 20, borderTop: '1px solid rgba(148,163,184,0.18)', paddingTop: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                    <h3 style={{ ...subheadStyle, margin: 0 }}>给「{selectedRole.role_name}」评分</h3>
                    <span style={{ color: 'rgba(71,85,105,0.62)', fontSize: 12 }}>{roleKindLabel(selectedRole)} · {ratingText(roleRatings?.summary.avg ?? selectedRole.rating_avg, roleRatings?.summary.count ?? selectedRole.rating_count)}</span>
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <select value={roleRatingDraft.rating} onChange={event => setRoleRatingDraft({ ...roleRatingDraft, rating: Number(event.target.value) })} style={inputStyle}>
                      {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} 分</option>)}
                    </select>
                    <textarea
                      value={roleRatingDraft.content}
                      onChange={event => setRoleRatingDraft({ ...roleRatingDraft, content: event.target.value })}
                      placeholder="评分理由必填。可以写这个角色好玩、牢、难演、人生角色，或者为什么不推荐。"
                      style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(71,85,105,0.78)', fontWeight: 800 }}>
                      <input
                        type="checkbox"
                        checked={roleRatingDraft.spoiler}
                        onChange={event => setRoleRatingDraft({ ...roleRatingDraft, spoiler: event.target.checked })}
                      />
                      理由里含剧透
                    </label>
                    <button onClick={() => void submitRoleRating()} style={{ border: 0, borderRadius: 12, padding: '11px 14px', background: '#1f2937', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>提交角色评分</button>
                    {roleMessage && <p style={{ margin: 0, color: '#b45309', fontSize: 13 }}>{roleMessage}</p>}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <h3 style={subheadStyle}>这个角色的最近评价</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {(roleRatings?.ratings || []).map(item => (
                    <article key={item.id} style={reviewStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <strong>{item.profile_name || '用户'}</strong>
                        <span style={{ color: GOLD, fontWeight: 900 }}>{item.rating} 分</span>
                      </div>
                      {item.content && <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: 'rgba(31,41,55,0.82)' }}>{item.content}</p>}
                      <p style={{ margin: 0, fontSize: 12, color: 'rgba(71,85,105,0.62)' }}>
                        {item.spoiler_level === 'spoiler' ? '含剧透 · ' : ''}{shortDate(item.created_at)}
                      </p>
                    </article>
                  ))}
                  {!roleRatings?.ratings?.length && <p style={{ color: 'rgba(71,85,105,0.62)' }}>还没有角色评价。</p>}
                </div>
              </div>

              <div style={{ marginBottom: 20, borderTop: '1px solid rgba(148,163,184,0.18)', paddingTop: 18 }}>
                <h3 style={subheadStyle}>给这个本评分</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  <select value={ratingDraft.rating} onChange={event => setRatingDraft({ ...ratingDraft, rating: Number(event.target.value) })} style={inputStyle}>
                    {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} 分</option>)}
                  </select>
                  <textarea value={ratingDraft.content} onChange={event => setRatingDraft({ ...ratingDraft, content: event.target.value })} placeholder="短评，可空" style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }} />
                  <input value={ratingDraft.tags} onChange={event => setRatingDraft({ ...ratingDraft, tags: event.target.value })} placeholder="短评标签，用逗号分隔" style={inputStyle} />
                  <button onClick={() => void submitRating()} style={{ border: 0, borderRadius: 12, padding: '11px 14px', background: '#1f2937', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>保存剧本评分</button>
                  {scriptMessage && <p style={{ margin: 0, color: '#b45309', fontSize: 13 }}>{scriptMessage}</p>}
                </div>
              </div>

              <div>
                <h3 style={subheadStyle}>剧本最近短评</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {(ratings?.ratings || []).map(item => (
                    <article key={item.id} style={reviewStyle}>
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
            </ReputationPanel>
          )}
      </div>
    </ReputationHubShell>
  );
}

const subheadStyle: React.CSSProperties = { margin: '0 0 10px', fontSize: 15, color: '#334155' };
const roleMetaStyle: React.CSSProperties = { color: 'rgba(71,85,105,0.62)', fontSize: 12, fontWeight: 900 };
const inputStyle: React.CSSProperties = { border: '1px solid rgba(148,163,184,0.28)', borderRadius: 12, padding: '10px 12px', fontSize: 14, color: INK, background: '#fff' };
const reviewStyle: React.CSSProperties = { border: '1px solid rgba(148,163,184,0.18)', borderRadius: 12, padding: 12, background: '#fff' };
const rolesHeroStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 18, alignItems: 'stretch' };
const heroCopyStyle: React.CSSProperties = { display: 'grid', gap: 14, alignContent: 'center' };
const searchCardStyle: React.CSSProperties = { borderRadius: 14, background: '#fff8e8', border: '1px solid rgba(217,168,87,0.24)', padding: 18, display: 'grid', gap: 12, alignContent: 'start' };
const rolesBodyStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 18, alignItems: 'start' };
