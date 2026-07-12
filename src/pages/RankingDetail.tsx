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
  author_name: string;
  poster_id?: string | null;
  is_realname?: boolean;
  agree_count?: number;
  oppose_count?: number;
  joys?: number;
  boost_amount?: number;
  created_at: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const auth = readStoredCreatorAuth();
    const headers = auth?.token ? { Authorization: `Bearer ${auth.token}` } : undefined;
    Promise.all([
      fetch(`${API}/lc/rankings/${encodeURIComponent(id)}`, { signal: controller.signal, headers }),
      fetch(`${API}/lc/rankings/${encodeURIComponent(id)}/comments`, { signal: controller.signal }),
    ]).then(async ([rankingResponse, commentsResponse]) => {
      const [rankingPayload, commentsPayload] = await Promise.all([rankingResponse.json(), commentsResponse.json()]);
      if (!rankingResponse.ok || !rankingPayload.success) throw new Error(rankingPayload.error || '榜单详情加载失败');
      setRanking(rankingPayload.data);
      if (commentsResponse.ok && commentsPayload.success) setComments(commentsPayload.data || []);
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
              <span style={dateStyle}>{formatDate(ranking.created_at)}</span>
            </div>

            <div style={subjectLineStyle}>
              <span>{SUBJECT_LABEL[ranking.subject_type] || ranking.subject_type}{ranking.subject_city ? ` · ${ranking.subject_city}` : ''}</span>
            </div>

            <h1 style={titleStyle}><Link to={subjectUrl} style={titleLinkStyle}>{ranking.subject_name}</Link></h1>
            <p style={contentStyle}>{ranking.content}</p>

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
          </article>

          <aside style={sideStyle}>
            <section style={statsStyle}>
              <h2 style={sideTitleStyle}>公开反馈</h2>
              <div style={statGridStyle}>
                <Stat label="同意" value={ranking.agree_count || 0} />
                <Stat label="反对" value={ranking.oppose_count || 0} />
                <Stat label="欢乐" value={ranking.joys || 0} />
                <Stat label="榜金" value={ranking.boost_amount || 0} />
              </div>
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
const contentStyle: React.CSSProperties = { margin: '18px 0 0', color: 'rgba(31,41,55,0.9)', fontSize: 15, fontWeight: 600, lineHeight: 1.85, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
const contextStyle: React.CSSProperties = { display: 'grid', gap: 5, marginTop: 18, borderTop: '1px solid rgba(31,41,55,0.08)', paddingTop: 14, color: MUTED, fontSize: 12, lineHeight: 1.6 };
const authorStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, color: MUTED, fontSize: 12 };
const sideStyle: React.CSSProperties = { display: 'grid', gap: 12 };
const statsStyle: React.CSSProperties = { border: '1px solid rgba(31,41,55,0.08)', borderRadius: 8, padding: 14, background: '#fff' };
const sideTitleStyle: React.CSSProperties = { margin: 0, color: INK, fontSize: 15 };
const statGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, marginTop: 12 };
const statStyle: React.CSSProperties = { minHeight: 58, display: 'grid', placeContent: 'center', gap: 4, border: '1px solid rgba(39,83,137,0.09)', borderRadius: 7, background: '#f8fbff', color: MUTED, textAlign: 'center', fontSize: 11 };
const interactionLinkStyle: React.CSSProperties = { minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 7, background: BLUE, color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 900 };
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
