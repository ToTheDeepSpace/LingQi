import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DossierClaimModal from '../components/DossierClaimModal';
import { generatedAvatarDataUrl } from '../lib/avatar';
import { readStoredCreatorAuth } from '../lib/authSession';

const API = '/api';
const BG = '#fffdf8';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.72)';
const GOLD = '#a66a1f';

type DmDetail = {
  dossier: { id: string; dm_name: string; city?: string | null; workplace?: string | null; employment_status?: 'unknown' | 'store_affiliated' | 'freelance'; photo_url?: string | null; note?: string | null; tags?: string[]; claim_status?: string };
  summary: { avg: number | null; review_count: number; player_count: number; sample_status: 'insufficient' | 'stable' };
  ratings: Array<{ id: string; profile_name: string; script_name: string; store_name: string; played_on: string; replay_number: number; rating: number; content: string; tags?: string[] }>;
  reputation_summary: { event_count: number; red_count: number; black_count: number; white_count: number };
  reputation_events: Array<{ id: string; type: 'red' | 'black' | 'white'; content: string; author_name: string; event_date?: string | null; event_script_name?: string | null; event_store_name?: string | null; created_at: string }>;
};

export default function DmProfile() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<DmDetail | null>(null);
  const [error, setError] = useState('');
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');

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

  const { dossier, summary, ratings, reputation_summary: reputationSummary = { event_count: 0, red_count: 0, black_count: 0, white_count: 0 }, reputation_events: reputationEvents = [] } = data;
  const scoreText = summary.player_count === 0 ? '暂无评分' : `${summary.avg?.toFixed(1)} / 5`;
  const auth = readStoredCreatorAuth();
  const claimStatusLabel = dossier.claim_status === 'approved' ? '已认领DM' : dossier.claim_status === 'pending' ? '认领审核中' : '未认领DM档案';

  const openClaim = () => {
    if (!auth?.token) {
      navigate('/login');
      return;
    }
    setClaimOpen(true);
  };

  return (
    <main style={{ minHeight: '100vh', background: BG, color: INK }}>
      <section style={{ padding: '34px 20px 28px', borderBottom: '1px solid rgba(31,41,55,0.09)', background: '#fff' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 18, alignItems: 'center' }}>
          <img src={dossier.photo_url || generatedAvatarDataUrl(dossier.dm_name, dossier.id)} alt="" style={{ width: 112, height: 112, objectFit: 'cover', borderRadius: 8, background: '#fffaf2' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
              <p style={{ margin: 0, color: GOLD, fontSize: 13, fontWeight: 900 }}>{claimStatusLabel}</p>
              {dossier.claim_status !== 'approved' && dossier.claim_status !== 'pending' && <button type="button" onClick={openClaim} style={claimButtonStyle}>本人认领</button>}
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontFamily: 'var(--font-serif)' }}>{dossier.dm_name}</h1>
            <p style={{ margin: '9px 0 0', color: MUTED }}>{dossier.city || '城市待补'} · {dossier.employment_status === 'freelance' ? '无受雇店家（自由DM）' : dossier.workplace || '受雇店家待补'}</p>
            {claimMessage && <p style={{ margin: '8px 0 0', color: '#15803d', fontSize: 12, fontWeight: 800 }}>{claimMessage}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <Link to={`/dm/rate?dmId=${encodeURIComponent(dossier.id)}`} style={primaryButton}>给TA评分</Link>
              <Link to={`/rankings/new?subjectType=dm&subjectDossierId=${encodeURIComponent(dossier.id)}`} style={secondaryButton}>发布红黑榜记录</Link>
              <Link to="/contact?category=dm_correction" style={secondaryButton}>资料纠错 / 申诉</Link>
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
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: 14, border: '1px solid rgba(31,41,55,0.09)', borderRadius: 8, background: '#fff' }}><div style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>{label}</div><div style={{ marginTop: 6, fontSize: 20, fontWeight: 900 }}>{value}</div></div>;
}

const cardStyle = { padding: 18, border: '1px solid rgba(31,41,55,0.09)', borderRadius: 8, background: '#fff' };
const headingStyle = { margin: '0 0 14px', fontSize: 18 };
const noticeStyle = { padding: '11px 13px', borderRadius: 7, background: '#fff7ed', color: '#9a5b18', border: '1px solid rgba(154,91,24,0.18)', lineHeight: 1.65, fontSize: 13 };
const primaryButton = { borderRadius: 7, background: INK, color: '#fff', padding: '10px 14px', fontWeight: 900, textDecoration: 'none' };
const secondaryButton = { borderRadius: 7, border: '1px solid rgba(31,41,55,0.14)', background: '#fff', color: INK, padding: '9px 13px', fontWeight: 850, textDecoration: 'none' };
const claimButtonStyle = { padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(166,106,31,0.22)', background: '#fff', color: '#8a5a19', fontSize: 11, fontWeight: 900, cursor: 'pointer' };
const tagStyle = { padding: '3px 7px', borderRadius: 999, background: '#eff6ff', color: '#275389', fontSize: 12, fontWeight: 800 };
