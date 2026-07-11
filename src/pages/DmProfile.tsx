import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DossierClaimModal from '../components/DossierClaimModal';
import DossierEditModal from '../components/DossierEditModal';
import DmGiftModal from '../components/DmGiftModal';
import { generatedAvatarDataUrl } from '../lib/avatar';
import { readStoredCreatorAuth } from '../lib/authSession';

const API = '/api';
const BG = '#fffdf8';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.72)';

type DmDetail = {
  dossier: {
    id: string;
    dm_name: string;
    city?: string | null;
    workplace?: string | null;
    employment_status?: 'unknown' | 'store_affiliated' | 'freelance';
    employer_store_id?: string | null;
    profile_url?: string | null;
    photo_url?: string | null;
    photo_focus_x?: number | null;
    photo_focus_y?: number | null;
    note?: string | null;
    tags?: string[];
    claim_status?: string;
    claimed_by?: string | null;
    affiliation?: {
      status: 'approved' | 'pending' | 'legacy_unverified';
      store_dossier_id?: string | null;
      store_name?: string | null;
      store_city?: string | null;
      confirmed_at?: string | null;
    } | null;
  };
  summary: { avg: number | null; review_count: number; player_count: number; sample_status: 'insufficient' | 'stable' };
  ratings: Array<{ id: string; profile_name: string; script_name: string; store_name: string; played_on: string; replay_number: number; rating: number; content: string; tags?: string[] }>;
  reputation_summary: { event_count: number; red_count: number; black_count: number; white_count: number };
  reputation_events: Array<{ id: string; type: 'red' | 'black' | 'white'; content: string; author_name: string; event_date?: string | null; event_script_name?: string | null; event_store_name?: string | null; created_at: string }>;
  chanto_summary?: { total: number; gift_count: number; supporter_count: number; recent: Array<{ id: string; amount: number; supporter_name: string; created_at: string }> };
};

export default function DmProfile() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<DmDetail | null>(null);
  const [error, setError] = useState('');
  const [claimOpen, setClaimOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [giftMessage, setGiftMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/lc/dm-dossiers/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async response => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok || !body.success) throw new Error(body.error || 'DM档案加载失败');
        setData(body.data);
      })
      .catch(reason => {
        if (reason?.name !== 'AbortError') setError(reason instanceof Error ? reason.message : 'DM档案加载失败');
      });
    return () => controller.abort();
  }, [id]);

  if (error) return <main style={{ minHeight: '72vh', padding: '84px 20px', background: BG, color: INK }}><div style={{ maxWidth: 760, margin: '0 auto' }}>{error}</div></main>;
  if (!data) return <main style={{ minHeight: '72vh', padding: '84px 20px', background: BG, color: MUTED }}><div style={{ maxWidth: 760, margin: '0 auto' }}>加载中...</div></main>;

  const { dossier, summary, ratings, reputation_summary: reputationSummary = { event_count: 0, red_count: 0, black_count: 0, white_count: 0 }, reputation_events: reputationEvents = [], chanto_summary: chantoSummary = { total: 0, gift_count: 0, supporter_count: 0, recent: [] } } = data;
  const scoreText = summary.player_count === 0 ? '暂无评分' : `${summary.avg?.toFixed(1)} / 5`;
  const auth = readStoredCreatorAuth();
  const isOwner = Boolean(dossier.claimed_by && dossier.claimed_by === auth?.id);
  const claimStatusLabel = dossier.claim_status === 'approved'
    ? 'DM 身份已认证'
    : dossier.claim_status === 'pending' ? '身份认证审核中'
      : dossier.claim_status === 'withdrawn' ? '原身份认证已撤销' : '未认证 DM 档案';
  const affiliationLabel = dossier.affiliation?.status === 'approved'
    ? `${dossier.affiliation.store_name || '店家'}已确认任职`
    : dossier.affiliation?.status === 'pending'
      ? `等待${dossier.affiliation.store_name || '店家'}确认任职`
      : dossier.affiliation?.status === 'legacy_unverified'
        ? `${dossier.affiliation.store_name || '历史店家'}关联待确认`
        : dossier.employment_status === 'freelance' ? '自由 DM（本人声明）' : '暂无已确认店家';

  const openClaim = () => {
    if (!auth?.token) {
      navigate('/login');
      return;
    }
    setClaimOpen(true);
  };

  return (
    <main style={{ minHeight: '100vh', background: BG, color: INK }}>
      <section className="dm-profile-hero" style={{ padding: '24px 20px 26px', borderBottom: '1px solid rgba(31,41,55,0.09)', background: '#fff' }}>
        <div className="dm-profile-hero-inner" style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)', gap: 32, alignItems: 'stretch' }}>
          <div className="dm-profile-portrait" style={{ width: '100%', aspectRatio: '4 / 5', maxHeight: 350, overflow: 'hidden', borderRadius: 8, border: '1px solid rgba(31,41,55,0.09)', background: '#fffaf2' }}>
            <img src={dossier.photo_url || generatedAvatarDataUrl(dossier.dm_name, dossier.id)} alt="" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', objectPosition: `${dossier.photo_focus_x ?? 50}% ${dossier.photo_focus_y ?? 25}%` }} />
          </div>
          <div className="dm-profile-info" style={{ minWidth: 0, minHeight: 350, padding: '5px 0', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className="dm-profile-status-row" style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid rgba(166,106,31,0.16)', background: '#fff8e8', color: '#8a5a19', fontSize: 12, fontWeight: 900 }}>{claimStatusLabel}</span>
              {dossier.claim_status !== 'approved' && dossier.claim_status !== 'pending' && dossier.claim_status !== 'withdrawn' && <button type="button" onClick={openClaim} style={claimButtonStyle}>本人认领</button>}
              <button type="button" onClick={() => auth?.token ? setEditOpen(true) : navigate(`/login?redirect=${encodeURIComponent(`/dm/${dossier.id}`)}`)} style={editButtonStyle}>
                {isOwner ? '编辑我的档案' : '补充 / 纠错资料'}
              </button>
            </div>
            <h1 className="dm-profile-name" style={{ margin: '18px 0 0', fontSize: 'clamp(2.25rem, 5vw, 3.35rem)', lineHeight: 1.08, fontFamily: 'var(--font-serif)', overflowWrap: 'anywhere' }}>{dossier.dm_name}</h1>
            <div className="dm-profile-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <span style={{ color: MUTED, fontSize: 14, fontWeight: 750 }}>{dossier.city || '城市待补'}</span>
              <span aria-hidden="true" style={{ color: 'rgba(71,85,105,0.34)' }}>·</span>
              <span style={affiliationBadgeStyle(dossier.affiliation?.status || (dossier.employment_status === 'freelance' ? 'freelance' : 'unknown'))}>{affiliationLabel}</span>
              {dossier.affiliation?.status === 'approved' && dossier.affiliation.confirmed_at && <span style={{ color: MUTED, fontSize: 11 }}>确认于 {dossier.affiliation.confirmed_at.slice(0, 10)}</span>}
            </div>
            {claimMessage && <p style={{ margin: '8px 0 0', color: '#15803d', fontSize: 12, fontWeight: 800 }}>{claimMessage}</p>}
            {editMessage && <p style={{ margin: '8px 0 0', color: '#15803d', fontSize: 12, fontWeight: 800 }}>{editMessage}</p>}
            {giftMessage && <p style={{ margin: '8px 0 0', color: '#15803d', fontSize: 12, fontWeight: 800 }}>{giftMessage}</p>}
            <div className="dm-profile-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 20 }}>
              <Link to={`/dm/rate?dmId=${encodeURIComponent(dossier.id)}`} style={primaryButton}>给TA评分</Link>
              {dossier.claim_status === 'approved' && dossier.claimed_by && !isOwner && <button type="button" onClick={() => auth?.token ? setGiftOpen(true) : navigate(`/login?redirect=${encodeURIComponent(`/dm/${dossier.id}`)}`)} style={giftButton}>送缠头</button>}
              <Link to={`/rankings/new?subjectType=dm&subjectDossierId=${encodeURIComponent(dossier.id)}`} style={secondaryButton}>发布红黑榜记录</Link>
              {isOwner && <Link to="/income" style={secondaryButton}>我的收入</Link>}
            </div>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '22px 20px 72px', display: 'grid', gap: 16 }}>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
          <Stat label="综合评分" value={scoreText} />
          <Stat label="体验评价" value={`${summary.review_count} 条`} />
          <Stat label="独立玩家" value={`${summary.player_count} 人`} />
          <Stat label="红黑榜记录" value={`${reputationSummary?.event_count || 0} 条`} />
          <Stat label="收到缠头" value={`${chantoSummary.total || 0}`} />
        </section>
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ ...headingStyle, marginBottom: 4 }}>缠头支持</h2>
              <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>{chantoSummary.supporter_count || 0} 人支持 · {chantoSummary.gift_count || 0} 次缠头</p>
            </div>
            <Link to={`/chanto?city=${encodeURIComponent(dossier.city || '')}`} style={smallLinkStyle}>查看缠头榜</Link>
          </div>
          {chantoSummary.recent.length > 0 && <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
            {chantoSummary.recent.map(item => <span key={item.id} style={supportChipStyle}>{item.supporter_name} · {item.amount}</span>)}
          </div>}
        </section>
        {summary.sample_status === 'insufficient' && summary.player_count > 0 && <div style={noticeStyle}>当前少于3名独立玩家，分数会正常显示，但同时标记为样本较少。综合分始终按独立玩家计权。</div>}
        {dossier.note && <section style={cardStyle}><h2 style={headingStyle}>档案说明</h2><p style={{ margin: 0, lineHeight: 1.75, color: MUTED }}>{dossier.note}</p></section>}
        <section style={cardStyle}>
          <h2 style={headingStyle}>体验评价</h2>
          {ratings.length === 0 ? <p style={{ color: MUTED }}>暂无审核通过的评分。</p> : <div style={{ display: 'grid', gap: 12 }}>
            {ratings.map(item => <article key={item.id} style={{ borderTop: '1px solid rgba(31,41,55,0.09)', paddingTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
                <div><strong>{item.profile_name}</strong><div style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>{item.script_name} · {item.store_name} · {item.played_on} · 第{item.replay_number}刷</div></div>
                <strong style={{ color: '#8a5a19' }}>{item.rating} / 5</strong>
              </div>
              <p style={{ margin: '10px 0 0', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{item.content}</p>
              {item.tags && item.tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>{item.tags.map(tag => <span key={tag} style={tagStyle}>#{tag}</span>)}</div>}
            </article>)}
          </div>}
        </section>
        <section style={cardStyle}>
          <h2 style={headingStyle}>红黑榜记录</h2>
          <p style={{ margin: '-6px 0 14px', color: MUTED, fontSize: 13 }}>红榜、黑榜和白榜是事件口碑，不参与上方五星综合分。</p>
          {reputationEvents.length === 0 ? <p style={{ color: MUTED }}>暂无关联到这份DM档案的红黑榜记录。</p> : <div style={{ display: 'grid', gap: 12 }}>
            {reputationEvents.map(item => (
              <article key={item.id} style={{ borderTop: '1px solid rgba(31,41,55,0.09)', paddingTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <strong style={{ color: item.type === 'red' ? '#b91c1c' : item.type === 'black' ? '#334155' : '#8a5a19' }}>{item.type === 'red' ? '红榜' : item.type === 'black' ? '黑榜' : '白榜'}</strong>
                  <span style={{ color: MUTED, fontSize: 13 }}>{item.author_name} · {item.created_at?.slice(0, 10)}</span>
                </div>
                {(item.event_date || item.event_script_name || item.event_store_name) && <div style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>{[item.event_date, item.event_script_name, item.event_store_name].filter(Boolean).join(' · ')}</div>}
                <p style={{ margin: '9px 0 0', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{item.content}</p>
              </article>
            ))}
          </div>}
        </section>
      </div>
      <DossierClaimModal
        open={claimOpen}
        dossier={{ id: dossier.id, name: dossier.dm_name, entityType: 'dm' }}
        token={auth?.token || ''}
        displayName={auth?.display_name || '当前用户'}
        onClose={() => setClaimOpen(false)}
        onSubmitted={() => {
          setClaimOpen(false);
          setClaimMessage('认领申请已提交，审核通过后会绑定到你的账号。');
          setData(current => current ? { ...current, dossier: { ...current.dossier, claim_status: 'pending' } } : current);
        }}
      />
      {editOpen && <DossierEditModal
        open={editOpen}
        dossier={{
          id: dossier.id,
          entityType: 'dm',
          name: dossier.dm_name,
          city: dossier.city,
          workplace: dossier.workplace,
          employmentStatus: dossier.employment_status,
          employerStoreId: dossier.employer_store_id,
          profileUrl: dossier.profile_url,
          photoUrl: dossier.photo_url,
          note: dossier.note,
          tags: dossier.tags,
          claimedBy: dossier.claimed_by,
        }}
        token={auth?.token || ''}
        currentUserId={auth?.id}
        onClose={() => setEditOpen(false)}
        onSubmitted={message => {
          setEditOpen(false);
          setEditMessage(message);
        }}
      />}
      <DmGiftModal
        open={giftOpen}
        token={auth?.token || ''}
        dossierId={dossier.id}
        dmName={dossier.dm_name}
        onClose={() => setGiftOpen(false)}
        onSuccess={({ amount }) => {
          setGiftMessage(`已送出 ${amount} 缠头。`);
          setData(current => current ? {
            ...current,
            chanto_summary: {
              total: (current.chanto_summary?.total || 0) + amount,
              gift_count: (current.chanto_summary?.gift_count || 0) + 1,
              supporter_count: current.chanto_summary?.supporter_count || 1,
              recent: current.chanto_summary?.recent || [],
            },
          } : current);
        }}
      />
      <style>{`
        @media (max-width: 700px) {
          .dm-profile-hero {
            padding: 12px 12px 18px !important;
          }
          .dm-profile-hero-inner {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
          .dm-profile-portrait {
            width: 100% !important;
            max-height: 320px !important;
            aspect-ratio: 4 / 3 !important;
          }
          .dm-profile-info {
            min-height: 0 !important;
            padding: 0 !important;
          }
          .dm-profile-name {
            margin-top: 12px !important;
            font-size: 2rem !important;
          }
          .dm-profile-meta {
            margin-top: 9px !important;
          }
          .dm-profile-actions {
            width: 100% !important;
            margin-top: 14px !important;
            padding-top: 0 !important;
            flex-wrap: nowrap !important;
          }
          .dm-profile-actions a,
          .dm-profile-actions button {
            flex: 1 1 0 !important;
            min-width: 0 !important;
            text-align: center !important;
            padding-left: 9px !important;
            padding-right: 9px !important;
            font-size: 13px !important;
          }
        }
      `}</style>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: 14, border: '1px solid rgba(31,41,55,0.09)', borderRadius: 8, background: '#fff' }}><div style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>{label}</div><div style={{ marginTop: 6, fontSize: 20, fontWeight: 900 }}>{value}</div></div>;
}

function affiliationBadgeStyle(status: 'approved' | 'pending' | 'legacy_unverified' | 'freelance' | 'unknown') {
  const approved = status === 'approved';
  const pending = status === 'pending' || status === 'legacy_unverified';
  return {
    padding: '4px 8px',
    borderRadius: 999,
    border: approved ? '1px solid rgba(22,101,52,0.16)' : pending ? '1px solid rgba(217,168,87,0.24)' : '1px solid rgba(39,83,137,0.14)',
    background: approved ? '#ECFDF3' : pending ? '#FFF8E8' : '#EEF6FF',
    color: approved ? '#166534' : pending ? '#8A5A19' : '#275389',
    fontSize: 11,
    fontWeight: 900,
  };
}

const cardStyle = { padding: 18, border: '1px solid rgba(31,41,55,0.09)', borderRadius: 8, background: '#fff' };
const headingStyle = { margin: '0 0 14px', fontSize: 18 };
const noticeStyle = { padding: '11px 13px', borderRadius: 7, background: '#fff7ed', color: '#9a5b18', border: '1px solid rgba(154,91,24,0.18)', lineHeight: 1.65, fontSize: 13 };
const primaryButton = { borderRadius: 7, background: INK, color: '#fff', padding: '10px 14px', fontWeight: 900, textDecoration: 'none' };
const secondaryButton = { borderRadius: 7, border: '1px solid rgba(31,41,55,0.14)', background: '#fff', color: INK, padding: '9px 13px', fontWeight: 850, textDecoration: 'none' };
const giftButton = { borderRadius: 7, border: '1px solid rgba(166,106,31,0.28)', background: '#fff4d6', color: '#8a5a19', padding: '9px 13px', fontWeight: 900, cursor: 'pointer' };
const claimButtonStyle = { padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(166,106,31,0.22)', background: '#fff', color: '#8a5a19', fontSize: 11, fontWeight: 900, cursor: 'pointer' };
const editButtonStyle = { padding: '3px 5px', border: 0, background: 'transparent', color: '#64748b', fontSize: 11, fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' };
const tagStyle = { padding: '3px 7px', borderRadius: 999, background: '#eff6ff', color: '#275389', fontSize: 12, fontWeight: 800 };
const smallLinkStyle = { color: '#8a5a19', fontSize: 12, fontWeight: 900, textDecoration: 'none' };
const supportChipStyle = { padding: '5px 8px', borderRadius: 999, background: '#fff8e8', border: '1px solid rgba(166,106,31,0.14)', color: '#8a5a19', fontSize: 12, fontWeight: 800 };
