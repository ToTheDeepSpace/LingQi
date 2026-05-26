import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API = '/api';
const C = '#0F1117';
const C2 = '#1A1D27';
const GOLD = '#d9a857';
const RED = '#f87171';
const RED2 = '#dc2626';
const BLK = '#94a3b8';

const SUBJECT_LABEL: Record<string, string> = {
  creator: '灵契师（委托师）',
  dm: 'DM（卡司）',
  store: '店家',
  player: '玩家',
};

type AuthSession = {
  token: string;
  displayName: string;
};

type Ranking = {
  id: string;
  type: 'red' | 'black';
  subject_name: string;
  subject_type: string;
  subject_city: string | null;
  subject_url: string | null;
  content: string;
  author_name: string;
  is_realname: boolean;
  initial_amount: number;
  likes: number;
  dislikes: number;
  created_at: string;
};

type Comment = {
  id: string;
  content: string;
  author_name: string;
  is_realname: boolean;
  likes: number;
  created_at: string;
};

type VoteRecord = {
  id: string;
  vote_type: 'like' | 'dislike';
  voter_name: string;
  voter_is_realname: boolean;
  created_at: string;
};

type VoteModal = { id: string; voteType: 'like' | 'dislike' } | null;
type ClaimModal = { rankingId: string; subjectName: string } | null;
type CommentModal = { rankingId: string } | null;

const card: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(201,146,46,0.15)',
  borderRadius: 16,
  padding: '20px 24px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid rgba(201,146,46,0.2)',
  outline: 'none',
  backgroundColor: 'rgba(255,255,255,0.05)',
  color: '#fff',
  fontSize: '0.875rem',
  boxSizing: 'border-box',
};

function getAuth(): AuthSession | null {
  try {
    const stored = localStorage.getItem('lc_creator');
    if (!stored) return null;
    const data = JSON.parse(stored);
    if (!data?.token) return null;
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) return null;
    return { token: data.token, displayName: data.display_name || '用户' };
  } catch {
    return null;
  }
}

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export default function Rankings() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'red' | 'black'>('red');
  const [items, setItems] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);

  const [voteModal, setVoteModal] = useState<VoteModal>(null);
  const [proof, setProof] = useState('');
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState('');

  const [claimModal, setClaimModal] = useState<ClaimModal>(null);
  const [claimContact, setClaimContact] = useState('');
  const [claimMsg, setClaimMsg] = useState('');
  const [claimDone, setClaimDone] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');

  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({});
  const [commentModal, setCommentModal] = useState<CommentModal>(null);
  const [commentText, setCommentText] = useState('');
  const [commentProof, setCommentProof] = useState('');
  const [commentDone, setCommentDone] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [likingComment, setLikingComment] = useState('');

  const [openVotes, setOpenVotes] = useState<Set<string>>(new Set());
  const [votesMap, setVotesMap] = useState<Record<string, VoteRecord[]>>({});

  const auth = getAuth();

  const requireAuth = (): AuthSession | null => {
    const current = getAuth();
    if (!current) navigate('/login');
    return current;
  };

  useEffect(() => {
    let alive = true;
    const loadRankings = async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API}/lc/rankings?type=${tab}`);
        const d = await r.json();
        if (alive && d.success) setItems(d.data || []);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void loadRankings();
    return () => {
      alive = false;
    };
  }, [tab]);

  const fetchComments = (rankingId: string) => {
    fetch(`${API}/lc/rankings/${rankingId}/comments`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setCommentsMap(prev => ({ ...prev, [rankingId]: d.data || [] }));
      });
  };

  const fetchVotes = (rankingId: string) => {
    fetch(`${API}/lc/rankings/${rankingId}/votes`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setVotesMap(prev => ({ ...prev, [rankingId]: d.data || [] }));
      });
  };

  const toggleComments = (id: string) => {
    const next = new Set(openComments);
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      fetchComments(id);
    }
    setOpenComments(next);
  };

  const toggleVotes = (id: string) => {
    const next = new Set(openVotes);
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      fetchVotes(id);
    }
    setOpenVotes(next);
  };

  const submitVote = async () => {
    if (!voteModal || !proof.trim()) return;
    const current = requireAuth();
    if (!current) return;
    setVoting(true);
    setVoteError('');
    try {
      const r = await fetch(`${API}/lc/rankings/${voteModal.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` },
        body: JSON.stringify({ voteType: voteModal.voteType, paymentProof: proof.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        setItems(prev => prev.map(i => i.id === voteModal.id ? { ...i, likes: d.data.likes, dislikes: d.data.dislikes } : i));
        fetchVotes(voteModal.id);
        setVoteModal(null);
        setProof('');
      } else {
        setVoteError(d.error || '提交失败');
      }
    } catch {
      setVoteError('网络错误，请重试');
    } finally {
      setVoting(false);
    }
  };

  const submitClaim = async () => {
    if (!claimModal || !claimContact.trim()) return;
    const current = requireAuth();
    if (!current) return;
    setClaiming(true);
    setClaimError('');
    try {
      const r = await fetch(`${API}/lc/rankings/${claimModal.rankingId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` },
        body: JSON.stringify({ contact: claimContact.trim(), message: claimMsg.trim() }),
      });
      const d = await r.json();
      if (d.success) setClaimDone(true);
      else setClaimError(d.error || '提交失败');
    } catch {
      setClaimError('网络错误，请重试');
    } finally {
      setClaiming(false);
    }
  };

  const submitComment = async () => {
    if (!commentModal || !commentText.trim() || !commentProof.trim()) return;
    const current = requireAuth();
    if (!current) return;
    setSubmittingComment(true);
    setCommentError('');
    try {
      const r = await fetch(`${API}/lc/rankings/${commentModal.rankingId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` },
        body: JSON.stringify({ content: commentText.trim(), paymentProof: commentProof.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        setCommentDone(true);
        fetchComments(commentModal.rankingId);
      } else {
        setCommentError(d.error || '提交失败');
      }
    } catch {
      setCommentError('网络错误，请重试');
    } finally {
      setSubmittingComment(false);
    }
  };

  const likeComment = async (rankingId: string, commentId: string) => {
    const current = requireAuth();
    if (!current) return;
    setLikingComment(commentId);
    try {
      const r = await fetch(`${API}/lc/rankings/${rankingId}/comments/${commentId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${current.token}` },
      });
      const d = await r.json();
      if (d.success) {
        setCommentsMap(prev => ({
          ...prev,
          [rankingId]: (prev[rankingId] || []).map(c => c.id === commentId ? { ...c, likes: d.data.likes } : c),
        }));
      }
    } finally {
      setLikingComment('');
    }
  };

  const openVoteModal = (id: string, voteType: 'like' | 'dislike') => {
    const current = requireAuth();
    if (!current) return;
    setVoteModal({ id, voteType });
    setProof('');
    setVoteError('');
  };

  const openCommentModal = (rankingId: string) => {
    const current = requireAuth();
    if (!current) return;
    setCommentModal({ rankingId });
    setCommentDone(false);
    setCommentText('');
    setCommentProof('');
    setCommentError('');
  };

  const openClaimModal = (rankingId: string, subjectName: string) => {
    const current = requireAuth();
    if (!current) return;
    setClaimModal({ rankingId, subjectName });
    setClaimDone(false);
    setClaimContact('');
    setClaimMsg('');
    setClaimError('');
  };

  const tabBtn = (t: 'red' | 'black', label: string, color: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        flex: 1,
        padding: '12px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: '1rem',
        transition: 'all 0.2s',
        background: tab === t ? color : 'transparent',
        color: tab === t ? '#fff' : 'rgba(186,207,231,0.55)',
        boxShadow: tab === t ? `0 4px 16px ${color}50` : 'none',
      }}
    >
      {label}
    </button>
  );

  const renderName = (name: string, isRealname: boolean) => isRealname
    ? (
      <>
        <span style={{ color: GOLD, fontWeight: 700 }}>⭐ {name}</span>
        <span style={{ color: 'rgba(201,146,46,0.5)', fontSize: '0.7rem' }}>实名</span>
      </>
    )
    : name;

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: '#fff' }}>
      <div style={{ backgroundColor: C2, borderBottom: '1px solid rgba(201,146,46,0.12)', padding: '48px 20px 40px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ width: 48, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginBottom: 20 }} />
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 8 }}>
            灵契红黑榜
          </h1>
          <p style={{ color: 'rgba(186,207,231,0.65)', fontSize: '0.95rem' }}>
            真实评价 · 社群共识 · 每条内容均经审核上线
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ flex: 1, display: 'flex', gap: 4, padding: 4, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,146,46,0.12)', borderRadius: 14 }}>
            {tabBtn('red', '🏅 红榜', '#dc2626')}
            {tabBtn('black', '👎 黑榜', '#475569')}
          </div>
          <Link
            to="/rankings/new"
            style={{ padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', flexShrink: 0 }}
          >
            + 发布
          </Link>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 36, height: 36, border: '2px solid rgba(201,146,46,0.3)', borderTopColor: GOLD, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: 'rgba(186,207,231,0.55)' }}>加载中...</p>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.3 }}>{tab === 'red' ? '🏅' : '👎'}</div>
            <p style={{ color: 'rgba(186,207,231,0.5)', marginBottom: 20 }}>
              {tab === 'red' ? '红榜暂无内容' : '黑榜暂无内容'}
            </p>
            <Link to="/rankings/new" style={{ color: GOLD, fontSize: '0.875rem', textDecoration: 'underline' }}>
              成为第一个发布的人
            </Link>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {items.map((item, idx) => {
              const accentColor = item.type === 'red' ? RED2 : BLK;
              const comments = commentsMap[item.id] || [];
              const votes = votesMap[item.id] || [];
              const showComments = openComments.has(item.id);
              const showVotes = openVotes.has(item.id);

              return (
                <div
                  key={item.id}
                  style={{
                    ...card,
                    borderLeft: `3px solid ${accentColor}`,
                    borderColor: item.type === 'red' ? 'rgba(220,38,38,0.3)' : 'rgba(148,163,184,0.2)',
                    borderLeftColor: accentColor,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        flexShrink: 0,
                        background: item.type === 'red' ? 'linear-gradient(135deg, #dc2626, #ef4444)' : 'linear-gradient(135deg, #374151, #4b5563)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '0.82rem',
                        color: '#fff',
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{item.subject_name}</span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: item.type === 'red' ? 'rgba(220,38,38,0.12)' : 'rgba(148,163,184,0.12)',
                            color: item.type === 'red' ? '#f87171' : BLK,
                            border: `1px solid ${item.type === 'red' ? 'rgba(220,38,38,0.25)' : 'rgba(148,163,184,0.2)'}`,
                          }}
                        >
                          {SUBJECT_LABEL[item.subject_type] || item.subject_type}
                        </span>
                        {item.subject_city && (
                          <span style={{ fontSize: '0.75rem', color: 'rgba(186,207,231,0.55)' }}>📍 {item.subject_city}</span>
                        )}
                        {item.subject_url && (
                          <a
                            href={normalizeUrl(item.subject_url)}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: '0.75rem', color: GOLD, textDecoration: 'none' }}
                          >
                            社交主页 ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.9rem', color: 'rgba(186,207,231,0.85)', lineHeight: 1.8, marginBottom: 16 }}>
                    {item.content}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(186,207,231,0.45)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      — {renderName(item.author_name, item.is_realname)}
                      <span>· {item.created_at?.slice(0, 10)}</span>
                      <span>· 初始值 {item.initial_amount}</span>
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => openVoteModal(item.id, 'like')}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.08)', color: '#34d399', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                      >
                        👍 {item.likes} <span style={{ fontSize: '0.7rem', color: 'rgba(52,211,153,0.6)' }}>¥1</span>
                      </button>
                      <button
                        onClick={() => openVoteModal(item.id, 'dislike')}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.07)', color: RED, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                      >
                        👎 {item.dislikes} <span style={{ fontSize: '0.7rem', color: 'rgba(248,113,113,0.5)' }}>¥1</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid rgba(201,146,46,0.08)' }}>
                    <button
                      onClick={() => toggleComments(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(186,207,231,0.5)', fontSize: '0.8rem', padding: '4px 0', transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(186,207,231,0.5)')}
                    >
                      💬 {showComments ? '收起评论' : `评论${comments.length ? ` (${comments.length})` : ''}`}
                    </button>
                    <button
                      onClick={() => openCommentModal(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(186,207,231,0.5)', fontSize: '0.8rem', padding: '4px 0', transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(186,207,231,0.5)')}
                    >
                      + 发评论
                    </button>
                    <button
                      onClick={() => toggleVotes(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(186,207,231,0.5)', fontSize: '0.8rem', padding: '4px 0', transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(186,207,231,0.5)')}
                    >
                      {showVotes ? '收起口碑' : '公开口碑'}
                    </button>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => openClaimModal(item.id, item.subject_name)}
                      style={{ background: 'rgba(201,146,46,0.06)', border: '1px solid rgba(201,146,46,0.2)', borderRadius: 8, cursor: 'pointer', color: 'rgba(201,146,46,0.6)', fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', transition: 'all 0.2s' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = GOLD;
                        e.currentTarget.style.borderColor = GOLD;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = 'rgba(201,146,46,0.6)';
                        e.currentTarget.style.borderColor = 'rgba(201,146,46,0.2)';
                      }}
                    >
                      我是相关方
                    </button>
                  </div>

                  {showVotes && (
                    <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {votes.length === 0 ? (
                        <span style={{ fontSize: '0.78rem', color: 'rgba(186,207,231,0.35)' }}>暂无公开口碑</span>
                      ) : votes.map(v => (
                        <span
                          key={v.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: '0.74rem',
                            color: v.vote_type === 'like' ? '#34d399' : RED,
                            background: v.vote_type === 'like' ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
                            border: `1px solid ${v.vote_type === 'like' ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'}`,
                          }}
                        >
                          {v.vote_type === 'like' ? '👍' : '👎'} {v.voter_is_realname ? `⭐ ${v.voter_name}` : v.voter_name}
                        </span>
                      ))}
                    </div>
                  )}

                  {showComments && (
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {comments.length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: 'rgba(186,207,231,0.35)', textAlign: 'center', padding: '12px 0' }}>暂无评论，等待审核中...</p>
                      ) : comments.map(c => (
                        <div key={c.id} style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px', fontSize: '0.84rem' }}>
                          <p style={{ color: 'rgba(186,207,231,0.85)', lineHeight: 1.7, marginBottom: 6 }}>{c.content}</p>
                          <span style={{ fontSize: '0.72rem', color: 'rgba(186,207,231,0.4)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            — {renderName(c.author_name, c.is_realname)}
                            · {c.created_at?.slice(0, 10)}
                            <button
                              onClick={() => likeComment(item.id, c.id)}
                              disabled={likingComment === c.id}
                              style={{ marginLeft: 'auto', border: 'none', background: 'none', color: '#34d399', cursor: 'pointer', fontSize: '0.75rem' }}
                            >
                              👍 {c.likes}
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {voteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: '#0d1f38', border: '1px solid rgba(201,146,46,0.2)', borderRadius: 20, padding: 32, maxWidth: 420, width: '100%' }}>
            <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>
              {voteModal.voteType === 'like' ? '👍 点赞' : '👎 点踩'} · ¥1
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(186,207,231,0.65)', lineHeight: 1.7, marginBottom: 12 }}>
              以 <strong style={{ color: GOLD }}>{auth?.displayName || '当前账号'}</strong> 的身份提交。每个账号对同一条记录只能投一次。
            </p>
            <p style={{ fontSize: '0.85rem', color: 'rgba(186,207,231,0.65)', lineHeight: 1.7, marginBottom: 20 }}>
              请支付 <strong style={{ color: GOLD }}>¥1</strong>，填写转账备注或时间作为凭证，提交后管理员核实。
            </p>
            <div style={{ width: 160, height: 160, borderRadius: 12, border: '1px dashed rgba(201,146,46,0.3)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)' }}>
              <p style={{ color: 'rgba(186,207,231,0.35)', fontSize: '0.78rem', textAlign: 'center', padding: '0 12px' }}>管理员在此放置<br />收款二维码</p>
            </div>
            <input value={proof} onChange={e => setProof(e.target.value)} placeholder="填写转账备注 / 时间，如：灵契投票 14:32" style={{ ...inputStyle, marginBottom: 12 }} />
            {voteError && <p style={{ color: RED, fontSize: '0.8rem', marginBottom: 12 }}>{voteError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setVoteModal(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'rgba(186,207,231,0.6)', cursor: 'pointer', fontSize: '0.875rem' }}>
                取消
              </button>
              <button
                onClick={submitVote}
                disabled={!proof.trim() || voting}
                style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', cursor: proof.trim() ? 'pointer' : 'not-allowed', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, fontWeight: 700, fontSize: '0.875rem', opacity: proof.trim() ? 1 : 0.5 }}
              >
                {voting ? '提交中...' : '已支付，提交凭证'}
              </button>
            </div>
          </div>
        </div>
      )}

      {claimModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: '#0d1f38', border: '1px solid rgba(201,146,46,0.2)', borderRadius: 20, padding: 32, maxWidth: 420, width: '100%' }}>
            {claimDone ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>相关方申请已提交</h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(186,207,231,0.65)', lineHeight: 1.7, marginBottom: 20 }}>管理员会联系你核实身份。</p>
                <button onClick={() => setClaimModal(null)} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, fontWeight: 700, cursor: 'pointer' }}>
                  关闭
                </button>
              </div>
            ) : (
              <>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 4 }}>我是相关方</h3>
                <p style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.55)', marginBottom: 20 }}>
                  针对「{claimModal.subjectName}」这条记录，以 <strong style={{ color: GOLD }}>{auth?.displayName || '当前账号'}</strong> 的身份提交相关方申请。
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(186,207,231,0.7)', marginBottom: 6 }}>
                      联系方式 <span style={{ color: RED }}>*</span>
                    </label>
                    <input value={claimContact} onChange={e => setClaimContact(e.target.value)} placeholder="微信 / 微博 / 小红书 / 抖音主页" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(186,207,231,0.7)', marginBottom: 6 }}>补充说明（可选）</label>
                    <textarea value={claimMsg} onChange={e => setClaimMsg(e.target.value)} placeholder="可以附上能证明身份的信息..." rows={3} style={{ ...inputStyle, resize: 'none' }} />
                  </div>
                </div>
                {claimError && <p style={{ color: RED, fontSize: '0.8rem', marginTop: 12 }}>{claimError}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setClaimModal(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'rgba(186,207,231,0.6)', cursor: 'pointer', fontSize: '0.875rem' }}>
                    取消
                  </button>
                  <button
                    onClick={submitClaim}
                    disabled={!claimContact.trim() || claiming}
                    style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', cursor: claimContact.trim() ? 'pointer' : 'not-allowed', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, fontWeight: 700, fontSize: '0.875rem', opacity: claimContact.trim() ? 1 : 0.5 }}
                  >
                    {claiming ? '提交中...' : '提交相关方申请'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {commentModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: '#0d1f38', border: '1px solid rgba(201,146,46,0.2)', borderRadius: 20, padding: 32, maxWidth: 440, width: '100%' }}>
            {commentDone ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>评论已提交</h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(186,207,231,0.65)', lineHeight: 1.7, marginBottom: 20 }}>审核通过后将显示在帖子下方。</p>
                <button onClick={() => setCommentModal(null)} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, fontWeight: 700, cursor: 'pointer' }}>
                  关闭
                </button>
              </div>
            ) : (
              <>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>发表评论 · ¥1</h3>
                <p style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.55)', marginBottom: 16 }}>
                  以 <strong style={{ color: GOLD }}>{auth?.displayName || '当前账号'}</strong> 的身份评论。实名星标由后台认证决定，前台不填写真实姓名。
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(186,207,231,0.7)', marginBottom: 6 }}>
                      评论内容 <span style={{ color: RED }}>*</span>
                    </label>
                    <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="写下你的看法..." rows={4} style={{ ...inputStyle, resize: 'none' }} />
                  </div>
                  <div style={{ borderTop: '1px solid rgba(201,146,46,0.1)', paddingTop: 14 }}>
                    <div style={{ width: 120, height: 120, borderRadius: 10, border: '1px dashed rgba(201,146,46,0.25)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <p style={{ color: 'rgba(186,207,231,0.3)', fontSize: '0.72rem', textAlign: 'center', padding: '0 10px' }}>收款码</p>
                    </div>
                    <input value={commentProof} onChange={e => setCommentProof(e.target.value)} placeholder="支付凭证（转账时间 / 备注）" style={inputStyle} />
                  </div>
                </div>
                {commentError && <p style={{ color: RED, fontSize: '0.8rem', marginTop: 12 }}>{commentError}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setCommentModal(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'rgba(186,207,231,0.6)', cursor: 'pointer', fontSize: '0.875rem' }}>
                    取消
                  </button>
                  <button
                    onClick={submitComment}
                    disabled={!commentText.trim() || !commentProof.trim() || submittingComment}
                    style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', cursor: (commentText.trim() && commentProof.trim()) ? 'pointer' : 'not-allowed', background: (commentText.trim() && commentProof.trim()) ? `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)` : 'rgba(255,255,255,0.06)', color: (commentText.trim() && commentProof.trim()) ? C : 'rgba(186,207,231,0.4)', fontWeight: 700, fontSize: '0.875rem' }}
                  >
                    {submittingComment ? '提交中...' : '提交评论'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
