import { useEffect, useState } from 'react';
import type React from 'react';
import { Link, useParams } from 'react-router-dom';
import ProfileNameLink from '../components/ProfileNameLink';
import { ReputationHubShell } from '../components/ReputationHubChrome';
import { readStoredCreatorAuth } from '../lib/authSession';

const API = '/api';
const INK = '#1f2937';
const BLUE = '#275389';
const GOLD = '#a66a1f';
const MUTED = 'rgba(71,85,105,0.7)';

type Ranking = {
  id: string;
  type: 'red' | 'black' | 'white';
  subject_name: string;
  subject_type: string;
  subject_city?: string | null;
  subject_url?: string | null;
  subject_dossier_id?: string | null;
  event_date?: string | null;
  event_script_name?: string | null;
  event_store_name?: string | null;
  content: string;
  display_files?: Array<{ name: string; url: string }>;
  author_name: string;
  poster_id?: string | null;
  is_realname?: boolean;
  agree_count?: number;
  oppose_count?: number;
  joys?: number;
  boost_amount?: number;
  created_at: string;
  last_activity_at?: string | null;
};

type Comment = {
  id: string;
  content: string;
  author_id?: string | null;
  author_name: string;
  is_realname?: boolean;
  is_pinned?: boolean;
  pin_label?: string | null;
  likes?: number;
  created_at: string;
};

type RankingVersion = {
  id: string;
  version_number: number;
  source: 'original' | 'author_edit' | 'admin_edit' | 'restore';
  snapshot: Record<string, unknown>;
  changes: Array<{ field: string; label: string; before: unknown; after: unknown }>;
  created_at: string;
};

const SUBJECT_LABEL: Record<string, string> = {
  dm: 'DM',
  store: '店家',
  player: '玩家',
  other: '其他',
};

export default function RankingDetail() {
  const { id = '' } = useParams();
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [versions, setVersions] = useState<RankingVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const auth = readStoredCreatorAuth();
    const headers = auth?.token ? { Authorization: `Bearer ${auth.token}` } : undefined;
    Promise.all([
      fetch(`${API}/lc/rankings/${encodeURIComponent(id)}`, { signal: controller.signal, headers }),
      fetch(`${API}/lc/rankings/${encodeURIComponent(id)}/comments`, { signal: controller.signal }),
      fetch(`${API}/lc/rankings/${encodeURIComponent(id)}/versions`, { signal: controller.signal }),
    ]).then(async ([rankingResponse, commentsResponse, versionsResponse]) => {
      const [rankingPayload, commentsPayload, versionsPayload] = await Promise.all([rankingResponse.json(), commentsResponse.json(), versionsResponse.json()]);
      if (!rankingResponse.ok || !rankingPayload.success) throw new Error(rankingPayload.error || '榜单详情加载失败');
      setRanking(rankingPayload.data);
      if (commentsResponse.ok && commentsPayload.success) setComments(commentsPayload.data || []);
      if (versionsResponse.ok && versionsPayload.success) setVersions(versionsPayload.data || []);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '榜单详情加载失败');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [id]);

  const subjectUrl = ranking ? dossierUrl(ranking) : '/rankings';
  const kind = ranking ? rankingKind(ranking.type) : rankingKind('white');

  return (
    <ReputationHubShell active="rankings" currentLabel="榜单详情">
      <Link to="/rankings" style={backLinkStyle}>返回红黑榜</Link>

      {loading && <StatePanel>正在加载完整内容...</StatePanel>}
      {!loading && error && <StatePanel tone="error">{error}</StatePanel>}

      {!loading && !error && ranking && (
        <div className="ranking-detail-layout" style={layoutStyle}>
          <article style={{ ...articleStyle, borderColor: kind.border }}>
            <div style={articleHeaderStyle}>
              <span style={{ ...kindBadgeStyle, color: kind.color, background: kind.background, borderColor: kind.border }}>{kind.label}</span>
              <span style={dateStyle}>更新于 {formatDate(ranking.last_activity_at || ranking.created_at)}</span>
            </div>

            <div style={subjectLineStyle}>
              <span>{SUBJECT_LABEL[ranking.subject_type] || ranking.subject_type}{ranking.subject_city ? ` · ${ranking.subject_city}` : ''}</span>
            </div>

            <h1 style={titleStyle}><Link to={subjectUrl} style={titleLinkStyle}>{ranking.subject_name}</Link></h1>
            {ranking.subject_url && <a href={normalizeExternalUrl(ranking.subject_url)} target="_blank" rel="noreferrer" style={externalLinkStyle}>对象社交主页 ↗</a>}
            <p style={contentStyle}>{ranking.content}</p>

            {!!ranking.display_files?.length && (
              <section style={galleryStyle} aria-label="正文配图">
                {ranking.display_files.map((file, index) => (
                  <a key={`${file.url}-${index}`} href={file.url} target="_blank" rel="noreferrer" style={galleryLinkStyle}>
                    <img src={file.url} alt={file.name || `正文配图 ${index + 1}`} style={galleryImageStyle} />
                  </a>
                ))}
              </section>
            )}

            {(ranking.event_date || ranking.event_script_name || ranking.event_store_name) && (
              <div style={contextStyle}>
                <strong>事件背景</strong>
                <span>{[ranking.event_date, ranking.event_script_name, ranking.event_store_name].filter(Boolean).join(' · ')}</span>
              </div>
            )}

            <div style={authorStyle}>
              <span>发布人</span>
              <ProfileNameLink profileId={ranking.poster_id}>{ranking.is_realname ? `实名 · ${ranking.author_name}` : ranking.author_name}</ProfileNameLink>
            </div>

            {versions.length > 1 && (
              <details style={versionHistoryStyle}>
                <summary style={versionSummaryStyle}>修改记录 · {versions.length - 1} 次</summary>
                <div style={versionListStyle}>
                  {versions.filter(version => version.source !== 'original').map(version => (
                    <section key={version.id} style={versionItemStyle}>
                      <div style={versionHeaderStyle}>
                        <strong>第 {version.version_number} 版 · {versionSourceLabel(version.source)}</strong>
                        <span>{formatDate(version.created_at)}</span>
                      </div>
                      {(version.changes || []).map(change => (
                        <div key={`${version.id}-${change.field}`} className="ranking-version-diff" style={versionDiffStyle}>
                          <div style={versionBeforeStyle}><span>{change.label || change.field} · 原版</span><s>{versionValue(change.before)}</s></div>
                          <div style={versionAfterStyle}><span>{change.label || change.field} · 修改版</span><p>{versionValue(change.after)}</p></div>
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              </details>
            )}
          </article>

          <aside style={sideStyle}>
            <section style={statsStyle}>
              <h2 style={sideTitleStyle}>公开反馈</h2>
              <div style={statGridStyle}>
                <Stat label="同意" value={ranking.agree_count || 0} />
                <Stat label="反对" value={ranking.oppose_count || 0} />
                <Stat label="欢乐" value={ranking.joys || 0} />
                <Stat label="历史打榜" value={ranking.boost_amount || 0} />
              </div>
              {(ranking.boost_amount || 0) > 0 && <p style={historyNoteStyle}>事件帖打榜已经下线，此处只保留过去产生的记录，不再影响列表排序。</p>}
              <Link to={`/rankings#ranking-${encodeURIComponent(ranking.id)}`} style={interactionLinkStyle}>返回榜单参与互动</Link>
            </section>
          </aside>

          <section style={commentsStyle}>
            <div style={commentsHeaderStyle}>
              <h2 style={sideTitleStyle}>公开评论</h2>
              <span style={dateStyle}>{comments.length} 条</span>
            </div>
            <div style={commentListStyle}>
              {comments.map(comment => (
                <div key={comment.id} style={{ ...commentStyle, ...(comment.is_pinned ? pinnedCommentStyle : {}) }}>
                  {comment.is_pinned && <span style={pinnedLabelStyle}>{comment.pin_label || '相关方回应'}</span>}
                  <p style={commentContentStyle}>{comment.content}</p>
                  <div style={commentMetaStyle}>
                    <ProfileNameLink profileId={comment.author_id}>{comment.is_realname ? `实名 · ${comment.author_name}` : comment.author_name}</ProfileNameLink>
                    <span>{formatDate(comment.created_at)}</span>
                    {!!comment.likes && <span>赞 {comment.likes}</span>}
                  </div>
                </div>
              ))}
              {comments.length === 0 && <p style={emptyCommentsStyle}>还没有公开评论。</p>}
            </div>
          </section>
        </div>
      )}
      <style>{`
        @media (max-width: 760px) {
          .ranking-detail-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .ranking-version-diff {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </ReputationHubShell>
  );
}

function rankingKind(type: Ranking['type']) {
  if (type === 'red') return { label: '红榜', color: '#8f3732', background: '#f8eee7', border: '#e6c7bd' };
  if (type === 'black') return { label: '黑榜', color: '#303846', background: '#f2f4f7', border: '#d7dce4' };
  return { label: '白榜', color: '#925f18', background: '#fff8e8', border: '#e4d4b3' };
}

function dossierUrl(item: Ranking) {
  if (item.subject_dossier_id && item.subject_type === 'dm') return `/dm/${item.subject_dossier_id}`;
  if (item.subject_dossier_id && item.subject_type === 'store') return `/stores/${item.subject_dossier_id}`;
  return item.subject_url || '/rankings';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN');
}

function normalizeExternalUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function versionSourceLabel(source: RankingVersion['source']) {
  if (source === 'author_edit') return '原发布人修改';
  if (source === 'admin_edit') return '管理员校正';
  if (source === 'restore') return '恢复公开';
  return '原始版本';
}

function versionValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '未填写';
  if (Array.isArray(value)) return value.length ? value.map(versionValue).join('、') : '未填写';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div style={statStyle}><strong>{value}</strong><span>{label}</span></div>;
}

function StatePanel({ children, tone = 'normal' }: { children: React.ReactNode; tone?: 'normal' | 'error' }) {
  return <section style={{ ...stateStyle, color: tone === 'error' ? '#b91c1c' : INK }}>{children}</section>;
}

const backLinkStyle: React.CSSProperties = { width: 'fit-content', color: BLUE, fontSize: 13, fontWeight: 900, textDecoration: 'none' };
const layoutStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 300px)', gap: 12, alignItems: 'start' };
const articleStyle: React.CSSProperties = { minWidth: 0, border: '1px solid', borderRadius: 8, padding: 18, background: '#fff' };
const articleHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 };
const kindBadgeStyle: React.CSSProperties = { display: 'inline-flex', border: '1px solid', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 950 };
const dateStyle: React.CSSProperties = { color: MUTED, fontSize: 12 };
const subjectLineStyle: React.CSSProperties = { display: 'flex', gap: 7, alignItems: 'baseline', flexWrap: 'wrap', marginTop: 14, color: MUTED, fontSize: 12, fontWeight: 750 };
const titleStyle: React.CSSProperties = { margin: '14px 0 0', color: INK, fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.55rem, 4vw, 2.15rem)', lineHeight: 1.25, overflowWrap: 'anywhere' };
const titleLinkStyle: React.CSSProperties = { color: INK, textDecoration: 'none' };
const externalLinkStyle: React.CSSProperties = { display: 'inline-flex', marginTop: 8, color: BLUE, fontSize: 12, fontWeight: 800, textDecoration: 'none' };
const contentStyle: React.CSSProperties = { margin: '18px 0 0', color: 'rgba(31,41,55,0.9)', fontSize: 15, fontWeight: 600, lineHeight: 1.85, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
const galleryStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 8, marginTop: 16 };
const galleryLinkStyle: React.CSSProperties = { display: 'block', minWidth: 0 };
const galleryImageStyle: React.CSSProperties = { display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(31,41,55,0.1)', background: '#f8fafc' };
const contextStyle: React.CSSProperties = { display: 'grid', gap: 5, marginTop: 18, borderTop: '1px solid rgba(31,41,55,0.08)', paddingTop: 14, color: MUTED, fontSize: 12, lineHeight: 1.6 };
const authorStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, color: MUTED, fontSize: 12 };
const versionHistoryStyle: React.CSSProperties = { marginTop: 16, borderTop: '1px solid rgba(31,41,55,0.08)', paddingTop: 12 };
const versionSummaryStyle: React.CSSProperties = { width: 'fit-content', cursor: 'pointer', color: BLUE, fontSize: 12, fontWeight: 900 };
const versionListStyle: React.CSSProperties = { display: 'grid', gap: 9, marginTop: 10 };
const versionItemStyle: React.CSSProperties = { border: '1px solid rgba(39,83,137,0.1)', borderRadius: 8, padding: 10, background: '#fbfdff' };
const versionHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, color: MUTED, fontSize: 11 };
const versionDiffStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, marginTop: 8 };
const versionBeforeStyle: React.CSSProperties = { minWidth: 0, borderRadius: 7, padding: 9, background: '#fff5f5', color: '#7f1d1d', fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: 'grid', gap: 4 };
const versionAfterStyle: React.CSSProperties = { minWidth: 0, borderRadius: 7, padding: 9, background: '#f0fdf4', color: '#166534', fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: 'grid', gap: 4 };
const sideStyle: React.CSSProperties = { display: 'grid', gap: 12 };
const statsStyle: React.CSSProperties = { border: '1px solid rgba(31,41,55,0.08)', borderRadius: 8, padding: 14, background: '#fff' };
const sideTitleStyle: React.CSSProperties = { margin: 0, color: INK, fontSize: 15 };
const statGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, marginTop: 12 };
const statStyle: React.CSSProperties = { minHeight: 58, display: 'grid', placeContent: 'center', gap: 4, border: '1px solid rgba(39,83,137,0.09)', borderRadius: 7, background: '#f8fbff', color: MUTED, textAlign: 'center', fontSize: 11 };
const interactionLinkStyle: React.CSSProperties = { minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 7, background: BLUE, color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 900 };
const historyNoteStyle: React.CSSProperties = { margin: '9px 0 0', color: MUTED, fontSize: 11, lineHeight: 1.55 };
const commentsStyle: React.CSSProperties = { gridColumn: '1 / -1', border: '1px solid rgba(31,41,55,0.08)', borderRadius: 8, padding: 16, background: '#fff' };
const commentsHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 };
const commentListStyle: React.CSSProperties = { display: 'grid', gap: 8, marginTop: 12 };
const commentStyle: React.CSSProperties = { borderTop: '1px solid rgba(31,41,55,0.07)', padding: '12px 0 4px' };
const pinnedCommentStyle: React.CSSProperties = { border: '1px solid rgba(166,106,31,0.18)', borderRadius: 7, padding: 12, background: '#fffaf2' };
const pinnedLabelStyle: React.CSSProperties = { display: 'inline-flex', marginBottom: 7, color: GOLD, fontSize: 11, fontWeight: 900 };
const commentContentStyle: React.CSSProperties = { margin: 0, color: 'rgba(31,41,55,0.86)', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
const commentMetaStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, color: MUTED, fontSize: 11 };
const emptyCommentsStyle: React.CSSProperties = { margin: 0, color: MUTED, fontSize: 13 };
const stateStyle: React.CSSProperties = { minHeight: 220, display: 'grid', placeContent: 'center', border: '1px dashed rgba(39,83,137,0.2)', borderRadius: 8, background: '#fff', padding: 24, textAlign: 'center' };
