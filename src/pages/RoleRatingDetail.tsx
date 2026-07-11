import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ReputationButton, ReputationHubShell } from '../components/ReputationHubChrome';
import { readStoredCreatorAuth } from '../lib/authSession';
import { flattenScriptRoles, roleKindLabel } from '../lib/scriptRoleCatalog';
import type { ScriptCatalogItem } from '../types';

const API = '/api';
const INK = '#1f2937';
const GOLD = '#a66a1f';
const BLUE = '#275389';
const MUTED = 'rgba(71,85,105,0.7)';

type RatingItem = {
  id: string;
  profile_name: string;
  rating: number;
  content?: string | null;
  spoiler_level?: string | null;
  created_at: string;
};

type RatingPayload = {
  ratings: RatingItem[];
  summary: { avg: number | null; count: number };
};

export default function RoleRatingDetail() {
  const { targetId = '' } = useParams();
  const [scripts, setScripts] = useState<ScriptCatalogItem[]>([]);
  const [ratings, setRatings] = useState<RatingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const token = readStoredCreatorAuth()?.token || '';

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [catalogResponse, ratingsResponse] = await Promise.all([
          fetch(`${API}/lc/scripts`, { signal: controller.signal }),
          fetch(`${API}/lc/entity-ratings?targetType=script_role&targetId=${encodeURIComponent(targetId)}`, {
            signal: controller.signal,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }),
        ]);
        const [catalogPayload, ratingsPayload] = await Promise.all([catalogResponse.json(), ratingsResponse.json()]);
        if (!catalogResponse.ok || !catalogPayload.success) throw new Error(catalogPayload.error || '角色资料加载失败');
        if (!ratingsResponse.ok || !ratingsPayload.success) throw new Error(ratingsPayload.error || '角色评价加载失败');
        setScripts(catalogPayload.data || []);
        setRatings(ratingsPayload.data);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : '角色评价加载失败');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [targetId, token]);

  const role = useMemo(
    () => flattenScriptRoles(scripts).find(item => item.target_id === targetId) || null,
    [scripts, targetId],
  );
  const ratingCount = ratings?.summary.count ?? role?.rating_count ?? 0;
  const ratingAverage = ratings?.summary.avg ?? role?.rating_avg ?? null;

  return (
    <ReputationHubShell
      active="roles"
      currentLabel="角色评分详情"
      actions={<ReputationButton to={`/scripts/rate?role=${encodeURIComponent(targetId)}`} tone="gold">添加评分</ReputationButton>}
    >
      <Link to="/scripts" style={backLinkStyle}>返回全部角色</Link>

      {loading && <StatePanel>正在加载角色评价...</StatePanel>}
      {!loading && loadError && <StatePanel tone="error">{loadError}</StatePanel>}
      {!loading && !loadError && !role && <StatePanel tone="error">没有找到这个角色，资料可能已更新。</StatePanel>}

      {!loading && !loadError && role && (
        <>
          <section style={summaryStyle}>
            <div style={{ minWidth: 0 }}>
              <span style={metaStyle}>{roleKindLabel(role)}{role.gender ? ` · ${role.gender}` : ''}</span>
              <h1 style={titleStyle}>{role.role_name}</h1>
              <p style={scriptStyle}>《{role.script_name}》</p>
            </div>
            <div style={scoreStyle}>
              {ratingCount > 0 && ratingAverage ? (
                <div><strong style={{ fontSize: 34, lineHeight: 1 }}>{Number(ratingAverage).toFixed(1)}</strong><span style={{ marginLeft: 5, color: GOLD, fontSize: 20 }}>★</span></div>
              ) : (
                <strong style={{ fontSize: 16 }}>暂无评分</strong>
              )}
              <small style={{ display: 'block', marginTop: 7, color: MUTED, fontWeight: 800 }}>{ratingCount} 人评分</small>
            </div>
          </section>

          <section>
            <div style={sectionHeadStyle}>
              <h2 style={{ margin: 0, fontSize: 18 }}>全部评价</h2>
              <span style={{ color: MUTED, fontSize: 12 }}>{ratings?.summary.count || 0} 条</span>
            </div>
            <div style={reviewListStyle}>
              {(ratings?.ratings || []).map(item => {
                const isSpoiler = item.spoiler_level === 'spoiler';
                const showContent = !isSpoiler || revealed[item.id];
                return (
                  <article key={item.id} style={reviewStyle}>
                    <div style={reviewHeadStyle}>
                      <strong>{item.profile_name || '用户'}</strong>
                      <span style={reviewScoreStyle}>{item.rating} 分</span>
                    </div>
                    {showContent ? (
                      <p style={reviewContentStyle}>{item.content}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRevealed(current => ({ ...current, [item.id]: true }))}
                        style={spoilerButtonStyle}
                      >
                        这条评价含剧透，点击查看
                      </button>
                    )}
                    <p style={reviewDateStyle}>{isSpoiler ? '含剧透 · ' : ''}{formatDate(item.created_at)}</p>
                  </article>
                );
              })}
              {!ratings?.ratings?.length && (
                <StatePanel>
                  <strong>还没有公开评价</strong>
                  <Link to={`/scripts/rate?role=${encodeURIComponent(targetId)}`} style={emptyActionStyle}>提交第一条评分</Link>
                </StatePanel>
              )}
            </div>
          </section>
        </>
      )}
    </ReputationHubShell>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function StatePanel({ children, tone = 'normal' }: { children: React.ReactNode; tone?: 'normal' | 'error' }) {
  return <section style={{ ...statePanelStyle, color: tone === 'error' ? '#b91c1c' : INK }}>{children}</section>;
}

const backLinkStyle: React.CSSProperties = { width: 'fit-content', color: BLUE, fontSize: 13, fontWeight: 900, textDecoration: 'none' };
const summaryStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, padding: '22px 4px', borderBottom: '1px solid rgba(31,41,55,0.09)' };
const metaStyle: React.CSSProperties = { color: '#657383', fontSize: 12, fontWeight: 900 };
const titleStyle: React.CSSProperties = { margin: '8px 0 0', fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.05, overflowWrap: 'anywhere' };
const scriptStyle: React.CSSProperties = { margin: '10px 0 0', color: BLUE, fontSize: 15, fontWeight: 850 };
const scoreStyle: React.CSSProperties = { flex: '0 0 auto', textAlign: 'right', color: INK };
const sectionHeadStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, margin: '4px 0 10px' };
const reviewListStyle: React.CSSProperties = { display: 'grid', gap: 10 };
const reviewStyle: React.CSSProperties = { border: '1px solid rgba(31,41,55,0.09)', borderRadius: 8, padding: 16, background: '#fff' };
const reviewHeadStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' };
const reviewScoreStyle: React.CSSProperties = { color: GOLD, fontWeight: 900 };
const reviewContentStyle: React.CSSProperties = { margin: '12px 0 0', color: 'rgba(31,41,55,0.84)', whiteSpace: 'pre-wrap', lineHeight: 1.7, overflowWrap: 'anywhere' };
const reviewDateStyle: React.CSSProperties = { margin: '12px 0 0', color: MUTED, fontSize: 12 };
const spoilerButtonStyle: React.CSSProperties = { width: '100%', marginTop: 12, border: '1px dashed rgba(166,106,31,0.28)', borderRadius: 7, padding: 12, background: '#fff8e8', color: '#7a4d14', fontWeight: 850, cursor: 'pointer' };
const statePanelStyle: React.CSSProperties = { minHeight: 150, display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 10, border: '1px dashed rgba(39,83,137,0.22)', borderRadius: 8, background: '#fff', padding: 24, textAlign: 'center' };
const emptyActionStyle: React.CSSProperties = { minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, padding: '0 14px', background: BLUE, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 900 };
