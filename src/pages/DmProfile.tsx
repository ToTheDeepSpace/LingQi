import { useEffect, useState } from 'react';
import type React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DossierClaimModal from '../components/DossierClaimModal';
import DossierEditModal from '../components/DossierEditModal';
import ProfileNameLink from '../components/ProfileNameLink';
import DmGiftModal from '../components/DmGiftModal';
import RatingDiscussion from '../components/RatingDiscussion';
import type { RatingOfficialResponse, RatingReaction } from '../components/RatingDiscussion';
import AffiliationDisputeModal from '../components/AffiliationDisputeModal';
import { generatedAvatarDataUrl } from '../lib/avatar';
import { readStoredCreatorAuth } from '../lib/authSession';
import type { DossierCareerEntry, DossierNamedRef, DossierPhoto } from '../lib/dossierWiki';

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
    photo_files?: DossierPhoto[];
    note?: string | null;
    tags?: string[];
    dm_started_month?: string | null;
    birth_year?: number | null;
    height_cm?: number | null;
    weight_kg?: number | null;
    mbti?: string | null;
    zodiac?: string | null;
    bio?: string | null;
    common_scripts?: DossierNamedRef[];
    career_history?: Array<DossierCareerEntry & { verification_status?: 'store_confirmed' | 'platform_reviewed' }>;
    related_profiles?: DossierNamedRef[];
    related_stores?: DossierNamedRef[];
    claim_status?: string;
    claimed_by?: string | null;
    affiliation?: {
      id?: string | null;
      status: 'approved' | 'pending' | 'legacy_unverified';
      store_dossier_id?: string | null;
      store_name?: string | null;
      store_city?: string | null;
      source?: 'store_confirmed' | 'self_declared' | 'community_unverified' | 'legacy_unverified';
      confirmed_at?: string | null;
    } | null;
  };
  summary: { avg: number | null; review_count: number; player_count: number; sample_status: 'insufficient' | 'stable' };
  ratings: Array<{ id: string; profile_id?: string | null; profile_name: string; script_name: string; store_dossier_id?: string | null; store_name: string; played_on: string; replay_number: number; rating: number; content: string; tags?: string[]; reaction: RatingReaction; official_response?: RatingOfficialResponse | null }>;
  reputation_summary: { event_count: number; red_count: number; black_count: number; white_count: number };
  reputation_events: Array<{ id: string; type: 'red' | 'black' | 'white'; content: string; author_name: string; poster_id?: string | null; event_date?: string | null; event_script_name?: string | null; event_store_name?: string | null; created_at: string }>;
  chanto_summary?: { total: number; gift_count: number; supporter_count: number; recent: Array<{ id: string; amount: number; supporter_name: string; created_at: string }> };
};

export default function DmProfile() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const auth = readStoredCreatorAuth();
  const [data, setData] = useState<DmDetail | null>(null);
  const [error, setError] = useState('');
  const [claimOpen, setClaimOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [disputeMessage, setDisputeMessage] = useState('');
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [lightboxPhoto, setLightboxPhoto] = useState<DossierPhoto | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/lc/dm-dossiers/${encodeURIComponent(id)}`, {
      signal: controller.signal,
      headers: auth?.token ? { Authorization: `Bearer ${auth.token}` } : undefined,
    })
      .then(async response => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok || !body.success) throw new Error(body.error || 'DM档案加载失败');
        setData(body.data);
        setSelectedPhotoIndex(0);
      })
      .catch(reason => {
        if (reason?.name !== 'AbortError') setError(reason instanceof Error ? reason.message : 'DM档案加载失败');
      });
    return () => controller.abort();
  }, [id, auth?.token]);

  useEffect(() => {
    if (!lightboxPhoto) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxPhoto(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [lightboxPhoto]);

  if (error) return <main style={{ minHeight: '72vh', padding: '84px 20px', background: BG, color: INK }}><div style={{ maxWidth: 760, margin: '0 auto' }}>{error}</div></main>;
  if (!data) return <main style={{ minHeight: '72vh', padding: '84px 20px', background: BG, color: MUTED }}><div style={{ maxWidth: 760, margin: '0 auto' }}>加载中...</div></main>;

  const { dossier, summary, ratings, reputation_summary: reputationSummary = { event_count: 0, red_count: 0, black_count: 0, white_count: 0 }, reputation_events: reputationEvents = [], chanto_summary: chantoSummary = { total: 0, gift_count: 0, supporter_count: 0, recent: [] } } = data;
  const scoreText = summary.player_count === 0 ? '暂无评分' : `${summary.avg?.toFixed(1)} / 5`;
  const isOwner = Boolean(dossier.claimed_by && dossier.claimed_by === auth?.id);
  const claimStatusLabel = dossier.claim_status === 'approved'
    ? 'DM 身份已认证'
    : dossier.claim_status === 'pending' ? '身份认证审核中'
      : dossier.claim_status === 'withdrawn' ? '原身份认证已撤销' : '未认证 DM 档案';
  const affiliationLabel = dossier.affiliation?.status === 'approved'
    ? `${dossier.affiliation.store_name || '店家'}已确认任职`
    : dossier.affiliation?.status === 'pending'
      ? dossier.affiliation.source === 'community_unverified'
        ? `社区补充：任职于${dossier.affiliation.store_name || '店家'}（未核验）`
        : `本人声明任职于${dossier.affiliation.store_name || '店家'}（未核验）`
      : dossier.affiliation?.status === 'legacy_unverified'
        ? `历史资料：任职于${dossier.affiliation.store_name || '店家'}（未核验）`
        : dossier.employment_status === 'freelance' ? '自由 DM（本人声明）' : '暂无已确认店家';
  const photos = dossier.photo_files && dossier.photo_files.length > 0
    ? dossier.photo_files
    : [{ url: dossier.photo_url || generatedAvatarDataUrl(dossier.dm_name, dossier.id), caption: null, focus_x: dossier.photo_focus_x ?? 50, focus_y: dossier.photo_focus_y ?? 25 }];
  const activePhoto = photos[Math.min(selectedPhotoIndex, photos.length - 1)];
  const currentYear = new Date().getFullYear();
  const age = dossier.birth_year ? Math.max(0, currentYear - dossier.birth_year) : null;
  const dmExperience = dossier.dm_started_month ? formatMonthDuration(dossier.dm_started_month) : null;

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
          <div className="dm-profile-gallery" style={{ minWidth: 0 }}>
            <button type="button" className="dm-profile-portrait" onClick={() => setLightboxPhoto(activePhoto)} aria-label="查看大图" style={{ width: '100%', aspectRatio: '4 / 5', maxHeight: 350, display: 'block', overflow: 'hidden', padding: 0, borderRadius: 8, border: '1px solid rgba(31,41,55,0.09)', background: '#fffaf2', cursor: 'zoom-in' }}>
              <img src={activePhoto.url} alt={activePhoto.caption || ''} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', objectPosition: `${activePhoto.focus_x ?? 50}% ${activePhoto.focus_y ?? 25}%` }} />
            </button>
            {photos.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6, marginTop: 7 }}>
                {photos.slice(0, 9).map((photo, index) => (
                  <button type="button" key={`${photo.url}-${index}`} onClick={() => setSelectedPhotoIndex(index)} aria-label={`查看第${index + 1}张照片`} style={{ aspectRatio: '1 / 1', overflow: 'hidden', padding: 0, borderRadius: 6, border: index === selectedPhotoIndex ? '2px solid #a66a1f' : '1px solid rgba(31,41,55,0.11)', background: '#fff', cursor: 'pointer' }}>
                    <img src={photo.url} alt="" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', objectPosition: `${photo.focus_x ?? 50}% ${photo.focus_y ?? 25}%` }} />
                  </button>
                ))}
              </div>
            )}
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
              {dossier.affiliation?.id && <button type="button" onClick={() => auth?.token ? setDisputeOpen(true) : navigate(`/login?redirect=${encodeURIComponent(`/dm/${dossier.id}`)}`)} style={disputeButtonStyle}>对此任职有异议</button>}
            </div>
            {claimMessage && <p style={{ margin: '8px 0 0', color: '#15803d', fontSize: 12, fontWeight: 800 }}>{claimMessage}</p>}
            {editMessage && <p style={{ margin: '8px 0 0', color: '#15803d', fontSize: 12, fontWeight: 800 }}>{editMessage}</p>}
            {giftMessage && <p style={{ margin: '8px 0 0', color: '#15803d', fontSize: 12, fontWeight: 800 }}>{giftMessage}</p>}
            {disputeMessage && <p style={{ margin: '8px 0 0', color: '#15803d', fontSize: 12, fontWeight: 800 }}>{disputeMessage}</p>}
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
        <section style={cardStyle}>
          <h2 style={headingStyle}>DM 百科</h2>
          <div className="dm-wiki-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(240px, 0.75fr)', gap: 22, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              {dossier.bio ? <p style={{ margin: 0, lineHeight: 1.85, color: '#334155', whiteSpace: 'pre-wrap' }}>{dossier.bio}</p> : <p style={{ margin: 0, color: MUTED }}>人物简介待补充。</p>}
              {dossier.common_scripts && dossier.common_scripts.length > 0 && (
                <WikiSection title="常开剧本">
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{dossier.common_scripts.map(script => <span key={script.id} style={tagStyle}>{script.name}</span>)}</div>
                </WikiSection>
              )}
              {dossier.career_history && dossier.career_history.length > 0 && (
                <WikiSection title="任职履历">
                  <div style={{ display: 'grid', gap: 10 }}>
                    {dossier.career_history.map((entry, index) => (
                      <div key={`${entry.store_dossier_id || entry.store_name}-${index}`} style={{ display: 'grid', gridTemplateColumns: '104px minmax(0, 1fr)', gap: 12, paddingTop: index === 0 ? 0 : 10, borderTop: index === 0 ? 0 : '1px solid rgba(31,41,55,0.09)' }}>
                        <span style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>{formatCareerRange(entry.started_month, entry.ended_month)}</span>
                        <div>
                          {entry.store_dossier_id ? <Link to={`/stores/${entry.store_dossier_id}`} style={wikiLinkStyle}>{entry.store_name}</Link> : <strong>{entry.store_name}</strong>}
                          {entry.role_title && <span style={{ color: MUTED, marginLeft: 7, fontSize: 12 }}>{entry.role_title}</span>}
                          <span style={{ ...verificationBadgeStyle, marginLeft: 7 }}>{entry.verification_status === 'store_confirmed' ? '店家已确认' : '平台已审核'}</span>
                          {entry.note && <p style={{ margin: '5px 0 0', color: MUTED, lineHeight: 1.6, fontSize: 13 }}>{entry.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </WikiSection>
              )}
              {(dossier.related_profiles?.length || dossier.related_stores?.length) ? (
                <WikiSection title="关联人物与店家">
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {dossier.related_profiles?.map(profile => <Link key={profile.id} to={`/explore/${profile.id}`} style={relatedLinkStyle}>@{profile.name}</Link>)}
                    {dossier.related_stores?.map(store => <Link key={store.id} to={`/stores/${store.id}`} style={relatedLinkStyle}>#{store.name}</Link>)}
                  </div>
                </WikiSection>
              ) : null}
            </div>
            <aside style={{ paddingLeft: 18, borderLeft: '1px solid rgba(31,41,55,0.10)' }}>
              <InfoRow label="所在城市" value={dossier.city || '待补充'} />
              <InfoRow label="DM 入行" value={dossier.dm_started_month ? `${formatMonth(dossier.dm_started_month)} · ${dmExperience}` : '待补充'} />
              <InfoRow label="年龄" value={age !== null ? `${age} 岁` : '本人未公开'} />
              <InfoRow label="身高" value={dossier.height_cm ? `${dossier.height_cm} cm` : '本人未公开'} />
              <InfoRow label="体重" value={dossier.weight_kg ? `${dossier.weight_kg} kg` : '本人未公开'} />
              <InfoRow label="MBTI" value={dossier.mbti || '待补充'} />
              <InfoRow label="星座" value={dossier.zodiac || '待补充'} />
              <InfoRow label="任职状态" value={affiliationLabel} />
              {dossier.tags && dossier.tags.length > 0 && <div style={{ marginTop: 12 }}><span style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>标签</span><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>{dossier.tags.map(tag => <span key={tag} style={tagStyle}>#{tag}</span>)}</div></div>}
            </aside>
          </div>
        </section>
        {dossier.note && <section style={cardStyle}><h2 style={headingStyle}>档案说明</h2><p style={{ margin: 0, lineHeight: 1.75, color: MUTED }}>{dossier.note}</p></section>}
        <section style={cardStyle}>
          <h2 style={headingStyle}>体验评价</h2>
          {ratings.length === 0 ? <p style={{ color: MUTED }}>暂无审核通过的评分。</p> : <div style={{ display: 'grid', gap: 12 }}>
            {ratings.map(item => <article key={item.id} style={{ borderTop: '1px solid rgba(31,41,55,0.09)', paddingTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
                <div><strong><ProfileNameLink profileId={item.profile_id}>{item.profile_name}</ProfileNameLink></strong><div style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>{item.script_name} · {item.store_dossier_id ? <Link to={`/stores/${item.store_dossier_id}`} style={inlineStoreLinkStyle}>{item.store_name}</Link> : item.store_name} · {item.played_on} · 第{item.replay_number}刷</div></div>
                <strong style={{ color: '#8a5a19' }}>{item.rating} / 5</strong>
              </div>
              <p style={{ margin: '10px 0 0', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{item.content}</p>
              {item.tags && item.tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>{item.tags.map(tag => <span key={tag} style={tagStyle}>#{tag}</span>)}</div>}
              <RatingDiscussion
                ratingType="dm"
                ratingId={item.id}
                token={auth?.token}
                reaction={item.reaction}
                officialResponse={item.official_response}
                canOfficialRespond={isOwner}
                canFollowUp={Boolean(auth?.id && item.profile_id === auth.id)}
              />
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
                  <span style={{ color: MUTED, fontSize: 13 }}><ProfileNameLink profileId={item.poster_id}>{item.author_name}</ProfileNameLink> · {item.created_at?.slice(0, 10)}</span>
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
          photoFiles: dossier.photo_files,
          note: dossier.note,
          tags: dossier.tags,
          claimedBy: dossier.claimed_by,
          dmStartedMonth: dossier.dm_started_month,
          birthYear: dossier.birth_year,
          heightCm: dossier.height_cm,
          weightKg: dossier.weight_kg,
          mbti: dossier.mbti,
          zodiac: dossier.zodiac,
          bio: dossier.bio,
          commonScripts: dossier.common_scripts,
          careerHistory: dossier.career_history,
          relatedProfiles: dossier.related_profiles,
          relatedStores: dossier.related_stores,
        }}
        token={auth?.token || ''}
        currentUserId={auth?.id}
        onClose={() => setEditOpen(false)}
        onSubmitted={message => {
          setEditOpen(false);
          setEditMessage(message);
        }}
      />}
      {disputeOpen && dossier.affiliation?.id && <AffiliationDisputeModal
        affiliationId={dossier.affiliation.id}
        title={`${dossier.dm_name} · ${dossier.affiliation.store_name || '任职店家'}`}
        token={auth?.token || ''}
        onClose={() => setDisputeOpen(false)}
        onSubmitted={message => {
          setDisputeOpen(false);
          setDisputeMessage(message);
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
      {lightboxPhoto && (
        <div role="dialog" aria-modal="true" aria-label="查看照片大图" onMouseDown={event => { if (event.target === event.currentTarget) setLightboxPhoto(null); }} style={lightboxStyle}>
          <button type="button" onClick={() => setLightboxPhoto(null)} aria-label="关闭大图" title="关闭" style={lightboxCloseStyle}>×</button>
          <figure style={{ maxWidth: 'min(94vw, 1500px)', margin: 0, display: 'grid', justifyItems: 'center', gap: 10 }}>
            <img src={lightboxPhoto.url} alt={lightboxPhoto.caption || ''} style={{ maxWidth: '100%', maxHeight: '84vh', display: 'block', objectFit: 'contain' }} />
            {lightboxPhoto.caption && <figcaption style={{ color: '#fff', fontSize: 13, textAlign: 'center' }}>{lightboxPhoto.caption}</figcaption>}
          </figure>
        </div>
      )}
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
          .dm-wiki-layout {
            grid-template-columns: 1fr !important;
          }
          .dm-wiki-layout aside {
            padding-left: 0 !important;
            padding-top: 14px !important;
            border-left: 0 !important;
            border-top: 1px solid rgba(31,41,55,0.10) !important;
          }
        }
      `}</style>
    </main>
  );
}

function WikiSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(31,41,55,0.09)' }}><h3 style={{ margin: '0 0 10px', fontSize: 14 }}>{title}</h3>{children}</section>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '76px minmax(0, 1fr)', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(31,41,55,0.08)' }}><span style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>{label}</span><strong style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{value}</strong></div>;
}

function formatMonth(value: string) {
  const [year, month] = value.slice(0, 7).split('-');
  return year && month ? `${year}年${Number(month)}月` : value;
}

function formatMonthDuration(value: string) {
  const [year, month] = value.slice(0, 7).split('-').map(Number);
  if (!year || !month) return '从业时间待核验';
  const now = new Date();
  const months = Math.max(0, (now.getFullYear() - year) * 12 + now.getMonth() + 1 - month);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${Math.max(1, rest)}个月`;
  return rest > 0 ? `${years}年${rest}个月` : `${years}年`;
}

function formatCareerRange(start?: string | null, end?: string | null) {
  if (!start && !end) return '时间待补';
  return `${start ? formatMonth(start) : '开始待补'} - ${end ? formatMonth(end) : '至今'}`;
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
const disputeButtonStyle = { padding: 0, border: 0, background: 'transparent', color: '#64748b', fontSize: 11, fontWeight: 750, cursor: 'pointer', textDecoration: 'underline' };
const editButtonStyle = { padding: '3px 5px', border: 0, background: 'transparent', color: '#64748b', fontSize: 11, fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' };
const tagStyle = { padding: '3px 7px', borderRadius: 999, background: '#eff6ff', color: '#275389', fontSize: 12, fontWeight: 800 };
const smallLinkStyle = { color: '#8a5a19', fontSize: 12, fontWeight: 900, textDecoration: 'none' };
const supportChipStyle = { padding: '5px 8px', borderRadius: 999, background: '#fff8e8', border: '1px solid rgba(166,106,31,0.14)', color: '#8a5a19', fontSize: 12, fontWeight: 800 };
const wikiLinkStyle = { color: '#275389', fontWeight: 900, textDecoration: 'none' };
const inlineStoreLinkStyle = { color: '#275389', fontWeight: 800, textDecoration: 'none' };
const relatedLinkStyle = { padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#334155', fontSize: 12, fontWeight: 850, textDecoration: 'none' };
const verificationBadgeStyle = { display: 'inline-flex', padding: '2px 5px', borderRadius: 5, background: '#ecfdf3', color: '#166534', fontSize: 10, fontWeight: 900 };
const lightboxStyle = { position: 'fixed' as const, inset: 0, zIndex: 1500, display: 'grid', placeItems: 'center', padding: 24, background: 'rgba(3,7,18,0.92)' };
const lightboxCloseStyle = { position: 'fixed' as const, top: 16, right: 18, width: 38, height: 38, display: 'grid', placeItems: 'center', padding: 0, borderRadius: 7, border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(15,23,42,0.72)', color: '#fff', fontSize: 24, cursor: 'pointer' };
