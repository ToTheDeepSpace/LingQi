import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CITIES } from '../constants/cities';

const API = '/api';
const C = '#f6efe4';
const GOLD = '#a66a1f';
const RED = '#f87171';
const RED2 = '#dc2626';
const BLK = '#94a3b8';

const SUBJECT_LABEL: Record<string, string> = {
  creator: '委托师',
  dm: '卡司',
  store: '店家',
  player: '玩家',
};

const SUBJECT_TYPES = ['creator', 'dm', 'store', 'player'] as const;
const POPULAR_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '重庆', '武汉', '南京', '长沙', '西安', '天津'];

type AuthSession = { token: string; displayName: string };

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
  expires_at?: string;
  expiry_override?: string;
  files?: { name: string; url: string; type?: string }[];
  lc_profiles?: { verified_dm?: boolean; verified_shop?: boolean; role?: string };
};

type Comment = {
  id: string;
  content: string;
  author_name: string;
  is_realname: boolean;
  is_pinned?: boolean;
  pin_label?: string | null;
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
type RelatedModal = { rankingId: string; subjectName: string } | null;
type CommentModal = { rankingId: string } | null;

const card: React.CSSProperties = {
  backgroundColor: '#fffdf8',
  border: '1px solid rgba(166,106,31,0.18)',
  borderRadius: 12,
  padding: '14px 16px',
  boxShadow: '0 10px 26px rgba(102,70,30,0.07)',
};

const cityPanelScroll: React.CSSProperties = {
  maxHeight: 240,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  WebkitOverflowScrolling: 'touch',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px solid rgba(166,106,31,0.22)', outline: 'none',
  backgroundColor: '#fffdf8', color: '#1f2937',
  fontSize: '0.875rem', boxSizing: 'border-box',
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
  } catch { return null; }
}

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function parseMentions(text: string): { text: string; mention: boolean; name: string }[] {
  const parts: { text: string; mention: boolean; name: string }[] = [];
  const re = /@([\u4e00-\u9fa5\w]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), mention: false, name: '' });
    parts.push({ text: m[0], mention: true, name: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mention: false, name: '' });
  return parts;
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      style={{
        minHeight: 34,
        padding: '7px 13px',
        borderRadius: 999,
        cursor: 'pointer',
        fontSize: '0.78rem',
        fontWeight: active ? 800 : 600,
        border: active ? `1px solid ${GOLD}` : '1px solid rgba(166,106,31,0.14)',
        background: active ? 'rgba(166,106,31,0.12)' : 'rgba(255,253,248,0.82)',
        color: active ? GOLD : 'rgba(51,65,85,0.74)',
        whiteSpace: 'nowrap',
      }}>
      {children}
    </button>
  );
}

function CityFilter({
  city, open, query, options, onToggle, onQuery, onSelect, onClose,
}: {
  city: string;
  open: boolean;
  query: string;
  options: string[];
  onToggle: () => void;
  onQuery: (value: string) => void;
  onSelect: (city: string) => void;
  onClose: () => void;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={onToggle}
        style={{
          minHeight: 34,
          padding: '7px 13px',
          borderRadius: 999,
          cursor: 'pointer',
          border: city !== 'all' ? `1px solid ${GOLD}` : '1px solid rgba(166,106,31,0.18)',
          background: city !== 'all' ? 'rgba(166,106,31,0.12)' : '#fffdf8',
          color: city !== 'all' ? GOLD : 'rgba(51,65,85,0.76)',
          fontSize: '0.78rem',
          fontWeight: 800,
          whiteSpace: 'nowrap',
        }}>
        📍 {city === 'all' ? '全部城市' : city} ▾
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={onClose} />
          <div style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            zIndex: 50,
            width: 'min(340px, calc(100vw - 32px))',
            padding: 12,
            borderRadius: 12,
            background: '#fffdf8',
            border: '1px solid rgba(166,106,31,0.22)',
            boxShadow: '0 18px 48px rgba(102,70,30,0.18)',
          }}
            onWheel={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}>
            <input
              autoFocus
              value={query}
              onChange={e => onQuery(e.target.value)}
              placeholder="搜索城市，例如：保定、上海"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid rgba(166,106,31,0.22)',
                background: '#fffaf2',
                color: '#1f2937',
                outline: 'none',
                marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <FilterPill active={city === 'all'} onClick={() => onSelect('all')}>全部</FilterPill>
              {POPULAR_CITIES.map(c => (
                <FilterPill key={c} active={city === c} onClick={() => onSelect(c)}>{c}</FilterPill>
              ))}
            </div>
            <div style={{ height: 1, background: 'rgba(217,168,87,0.12)', marginBottom: 8 }} />
            <div style={{ ...cityPanelScroll, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4 }}>
              {options.length > 0 ? options.map(c => (
                <button key={c} onClick={() => onSelect(c)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    background: city === c ? 'rgba(217,168,87,0.16)' : 'transparent',
                    color: city === c ? GOLD : 'rgba(31,41,55,0.78)',
                    fontSize: '0.84rem',
                    fontWeight: city === c ? 800 : 500,
                    textAlign: 'left',
                  }}>
                  {c}
                </button>
              )) : (
                <p style={{ gridColumn: '1 / -1', color: 'rgba(71,85,105,0.72)', fontSize: '0.84rem', padding: '16px 4px' }}>
                  没搜到这个城市，可以先看全部城市。
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Rankings() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'red' | 'black'>('red');
  const [subjectTab, setSubjectTab] = useState<string>('all');
  const [city, setCity] = useState('all');
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [items, setItems] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mentionMap, setMentionMap] = useState<Record<string, string>>({});

  const [balance, setBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const [voteModal, setVoteModal] = useState<VoteModal>(null);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState('');

  const [relatedModal, setRelatedModal] = useState<RelatedModal>(null);
  const [relatedText, setRelatedText] = useState('');
  const [relatedDone, setRelatedDone] = useState(false);
  const [submittingRelated, setSubmittingRelated] = useState(false);
  const [relatedError, setRelatedError] = useState('');

  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({});
  const [commentModal, setCommentModal] = useState<CommentModal>(null);
  const [commentText, setCommentText] = useState('');
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

  const fetchWallet = useCallback(() => {
    const current = getAuth();
    if (!current) return;
    setWalletLoading(true);
    fetch(`${API}/lc/wallet`, { headers: { Authorization: `Bearer ${current.token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setBalance(d.data.balance); })
      .finally(() => setWalletLoading(false));
  }, []);

  const fetchMentions = async (list: Ranking[]) => {
    const names = new Set<string>();
    list.forEach(item => {
      parseMentions(item.content).forEach(p => { if (p.mention) names.add(p.name); });
    });
    if (names.size === 0) return;
    const results: Record<string, string> = {};
    await Promise.all([...names].map(async name => {
      try {
        const r = await fetch(`${API}/lc/profiles/lookup?name=${encodeURIComponent(name)}`);
        const d = await r.json();
        if (d.success && d.data) results[name] = d.data.id;
      } catch { /* ignore */ }
    }));
    setMentionMap(results);
  };

  const fetchComments = useCallback(async (rankingId: string) => {
    return fetch(`${API}/lc/rankings/${rankingId}/comments`)
      .then(r => r.json())
      .then(d => { if (d.success) setCommentsMap(prev => ({ ...prev, [rankingId]: d.data || [] })); });
  }, []);

  const preloadComments = useCallback(async (list: Ranking[]) => {
    await Promise.all(list.slice(0, 40).map(item => fetchComments(item.id).catch(() => undefined)));
  }, [fetchComments]);

  useEffect(() => {
    let alive = true;
    const loadRankings = async () => {
      setLoading(true);
      setError('');
      fetchWallet();
      try {
        const params = new URLSearchParams({ type: tab });
        if (subjectTab !== 'all') params.set('subjectType', subjectTab);
        if (city !== 'all') params.set('city', city);
        const r = await fetch(`${API}/lc/rankings?${params}`);
        if (!r.ok) throw new Error(`请求失败 (${r.status})`);
        const d = await r.json();
        if (alive && d.success) {
          const list = d.data || [];
          setItems(list);
          void fetchMentions(list);
          void preloadComments(list);
        } else if (alive) {
          setError(d.error || '加载失败');
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : '网络错误');
      } finally {
        if (alive) setLoading(false);
      }
    };
    void loadRankings();
    return () => { alive = false; };
  }, [tab, subjectTab, city, fetchWallet, preloadComments]);

  const setCityAndClose = (nextCity: string) => {
    setCity(nextCity);
    setCityOpen(false);
    setCityQuery('');
  };

  const cityOptions = useMemo(() => {
    const q = cityQuery.trim();
    if (!q) return CITIES;
    return CITIES.filter(c => c.includes(q));
  }, [cityQuery]);

  const rankedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const byLikes = (b.likes || 0) - (a.likes || 0);
      if (byLikes !== 0) return byLikes;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [items]);

  const daysLeft = (item: Ranking) => {
    if (item.type !== 'black' || !item.expires_at) return null;
    if (item.expiry_override) return null;
    // eslint-disable-next-line react-hooks/purity
    const left = Math.ceil((new Date(item.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return left;
  };

  const renderContent = (text: string) => {
    const parts = parseMentions(text);
    return parts.map((p, i) => {
      if (!p.mention) return <span key={i}>{p.text}</span>;
      const profileId = mentionMap[p.name];
      if (profileId) {
        return <Link key={i} to={`/explore/${profileId}`} style={{ color: GOLD, fontWeight: 600, textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
          {p.text}
        </Link>;
      }
      return <span key={i} style={{ color: 'rgba(201,146,46,0.6)' }}>{p.text}</span>;
    });
  };

  const fetchVotes = (rankingId: string) => {
    fetch(`${API}/lc/rankings/${rankingId}/votes`)
      .then(r => r.json())
      .then(d => { if (d.success) setVotesMap(prev => ({ ...prev, [rankingId]: d.data || [] })); });
  };

  const toggleComments = (id: string) => {
    const next = new Set(openComments);
    if (next.has(id)) next.delete(id);
    else { next.add(id); fetchComments(id); }
    setOpenComments(next);
  };

  const toggleVotes = (id: string) => {
    const next = new Set(openVotes);
    if (next.has(id)) next.delete(id);
    else { next.add(id); fetchVotes(id); }
    setOpenVotes(next);
  };

  const submitVote = async () => {
    if (!voteModal) return;
    const current = requireAuth();
    if (!current) return;
    setVoting(true);
    setVoteError('');
    try {
      const r = await fetch(`${API}/lc/rankings/${voteModal.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` },
        body: JSON.stringify({ voteType: voteModal.voteType }),
      });
      const d = await r.json();
      if (d.success) {
        setItems(prev => prev.map(i => i.id === voteModal.id ? { ...i, likes: d.data.likes, dislikes: d.data.dislikes } : i));
        fetchVotes(voteModal.id);
        fetchWallet();
        setVoteModal(null);
      } else {
        setVoteError(d.error || '操作失败');
      }
    } catch { setVoteError('网络错误'); }
    finally { setVoting(false); }
  };

  const submitRelatedComment = async () => {
    if (!relatedModal || !relatedText.trim()) return;
    const current = requireAuth();
    if (!current) return;
    setSubmittingRelated(true);
    setRelatedError('');
    try {
      const r = await fetch(`${API}/lc/rankings/${relatedModal.rankingId}/related-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` },
        body: JSON.stringify({ content: relatedText.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        setRelatedDone(true);
        fetchComments(relatedModal.rankingId);
        fetchWallet();
      } else setRelatedError(d.error || '提交失败');
    } catch { setRelatedError('网络错误'); }
    finally { setSubmittingRelated(false); }
  };

  const submitComment = async () => {
    if (!commentModal || !commentText.trim()) return;
    const current = requireAuth();
    if (!current) return;
    setSubmittingComment(true);
    setCommentError('');
    try {
      const r = await fetch(`${API}/lc/rankings/${commentModal.rankingId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        setCommentDone(true);
        fetchComments(commentModal.rankingId);
        fetchWallet();
      } else {
        setCommentError(d.error || '提交失败');
      }
    } catch { setCommentError('网络错误'); }
    finally { setSubmittingComment(false); }
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
    } finally { setLikingComment(''); }
  };

  const openVoteModal = (id: string, voteType: 'like' | 'dislike') => {
    const current = requireAuth();
    if (!current) return;
    setVoteModal({ id, voteType });
    setVoteError('');
  };

  const openCommentModal = (rankingId: string) => {
    const current = requireAuth();
    if (!current) return;
    setCommentModal({ rankingId });
    setCommentDone(false);
    setCommentText('');
    setCommentError('');
  };

  const openRelatedModal = (rankingId: string, subjectName: string) => {
    const current = requireAuth();
    if (!current) return;
    setRelatedModal({ rankingId, subjectName });
    setRelatedDone(false);
    setRelatedText('');
    setRelatedError('');
  };

  const tabBtn = (t: 'red' | 'black', label: string, color: string) => (
    <button onClick={() => setTab(t)}
      style={{
        flex: 1, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
        fontWeight: 700, fontSize: '1rem', transition: 'all 0.2s',
        background: tab === t ? color : 'transparent',
        color: tab === t ? '#fff' : 'rgba(71,85,105,0.70)',
        boxShadow: tab === t ? `0 4px 16px ${color}50` : 'none',
      }}>{label}</button>
  );

  const renderName = (name: string, isRealname: boolean) => isRealname
    ? <><span style={{ color: GOLD, fontWeight: 700 }}>⭐ {name}</span><span style={{ color: 'rgba(201,146,46,0.5)', fontSize: '0.7rem' }}> 实名</span></>
    : name;

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: '#1f2937' }}>
      <div style={{
        background: 'linear-gradient(135deg, #fffaf2 0%, #fffdf8 58%, #f7dfc0 100%)',
        borderBottom: '1px solid rgba(166,106,31,0.14)',
        padding: '34px 20px 28px',
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ width: 48, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginBottom: 14 }} />
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 8 }}>灵契红黑榜</h1>
            <p style={{ color: 'rgba(71,85,105,0.80)', fontSize: '0.95rem' }}>
              委托师、卡司、店家、玩家都可以被评价 · 点赞越高越靠前
            </p>
          </div>
          {auth && (
            <Link to="/wallet" style={{
              padding: '12px 20px', borderRadius: 10,
              border: '1px solid rgba(201,146,46,0.25)', background: 'rgba(201,146,46,0.06)',
              color: balance === null ? 'rgba(71,85,105,0.68)' : GOLD,
              textDecoration: 'none', fontWeight: 600, fontSize: '0.88rem',
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            }}>
              <span>💰</span>
              {walletLoading ? '...' : <>契约币 {balance || 0}</>}
            </Link>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 'min(100%, 340px)', display: 'flex', gap: 4, padding: 4, backgroundColor: '#fffdf8', border: '1px solid rgba(166,106,31,0.16)', borderRadius: 14, boxShadow: '0 8px 20px rgba(102,70,30,0.06)' }}>
            {tabBtn('red', '🏅 红榜', '#dc2626')}
            {tabBtn('black', '👎 黑榜', '#475569')}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 0, flex: '1 1 320px' }}>
            <FilterPill active={subjectTab === 'all'} onClick={() => setSubjectTab('all')}>全部</FilterPill>
            {SUBJECT_TYPES.map(st => (
              <FilterPill key={st} active={subjectTab === st} onClick={() => setSubjectTab(st)}>
                {SUBJECT_LABEL[st]}
              </FilterPill>
            ))}
          </div>
          <Link to="/rankings/new"
            style={{ padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', flexShrink: 0 }}>
            + 发布
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <p style={{ color: 'rgba(71,85,105,0.68)', fontSize: '0.78rem' }}>
            当前排序：点赞数优先 · 同赞按发布时间
          </p>
          <CityFilter
            city={city}
            open={cityOpen}
            query={cityQuery}
            options={cityOptions}
            onToggle={() => setCityOpen(v => !v)}
            onQuery={setCityQuery}
            onSelect={setCityAndClose}
            onClose={() => setCityOpen(false)}
          />
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 36, height: 36, border: '2px solid rgba(201,146,46,0.3)', borderTopColor: GOLD, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: 'rgba(71,85,105,0.70)' }}>加载中...</p>
          </div>
        )}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '72px 20px', border: '1px dashed rgba(166,106,31,0.22)', borderRadius: 12, background: '#fffdf8' }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.45 }}>✦</div>
            <p style={{ color: 'rgba(71,85,105,0.78)', marginBottom: 8 }}>红黑榜暂时没连上</p>
            <p style={{ color: 'rgba(248,113,113,0.78)', fontSize: '0.8rem', marginBottom: 16 }}>{error}</p>
            <button onClick={() => window.location.reload()}
              style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid rgba(217,168,87,0.25)', background: 'rgba(217,168,87,0.08)', color: GOLD, cursor: 'pointer', fontWeight: 700 }}>
              重新加载
            </button>
          </div>
        )}

        {!loading && !error && rankedItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.3 }}>{tab === 'red' ? '🏅' : '👎'}</div>
            <p style={{ color: 'rgba(71,85,105,0.68)', marginBottom: 20 }}>
              {subjectTab !== 'all' ? `${SUBJECT_LABEL[subjectTab] || subjectTab}暂无内容` : (tab === 'red' ? '红榜暂无内容' : '黑榜暂无内容')}
            </p>
            <Link to="/rankings/new" style={{ color: GOLD, fontSize: '0.875rem', textDecoration: 'underline' }}>
              成为第一个发布的人
            </Link>
          </div>
        )}

        {!loading && !error && rankedItems.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, alignItems: 'start' }}>
            {rankedItems.map((item, idx) => {
              const accentColor = item.type === 'red' ? RED2 : BLK;
              const comments = commentsMap[item.id] || [];
              const pinnedComments = comments.filter(c => c.is_pinned);
              const normalComments = comments.filter(c => !c.is_pinned);
              const votes = votesMap[item.id] || [];
              const showComments = openComments.has(item.id);
              const showVotes = openVotes.has(item.id);
              const left = daysLeft(item);

              return (
                <div key={item.id}
                  style={{
                    ...card,
                    borderLeft: `3px solid ${accentColor}`,
                    borderColor: item.type === 'red' ? 'rgba(220,38,38,0.3)' : 'rgba(148,163,184,0.2)',
                    borderLeftColor: accentColor,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: item.type === 'red' ? 'linear-gradient(135deg, #dc2626, #ef4444)' : 'linear-gradient(135deg, #374151, #4b5563)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: '0.82rem', color: '#fff',
                    }}>{idx + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem' }}>{item.subject_name}</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
                          background: item.type === 'red' ? 'rgba(220,38,38,0.12)' : 'rgba(148,163,184,0.12)',
                          color: item.type === 'red' ? '#f87171' : BLK,
                          border: `1px solid ${item.type === 'red' ? 'rgba(220,38,38,0.25)' : 'rgba(148,163,184,0.2)'}`,
                        }}>{SUBJECT_LABEL[item.subject_type] || item.subject_type}</span>
                        {item.subject_city && (
                          <span style={{ fontSize: '0.75rem', color: 'rgba(71,85,105,0.70)' }}>📍 {item.subject_city}</span>
                        )}
                        {item.subject_url && (
                          <a href={normalizeUrl(item.subject_url)} target="_blank" rel="noreferrer"
                            style={{ fontSize: '0.75rem', color: GOLD, textDecoration: 'none' }}>社交主页 ↗</a>
                        )}
                        {left !== null && left !== undefined && (
                          <span style={{
                            padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600,
                            background: left <= 7 ? 'rgba(248,113,113,0.15)' : 'rgba(148,163,184,0.1)',
                            color: left <= 7 ? '#fca5a5' : 'rgba(148,163,184,0.6)',
                          }}>
                            ⏳ {left <= 0 ? '已到期' : `剩余 ${left} 天`}
                          </span>
                        )}
                        {item.expiry_override && (
                          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600,
                            background: 'rgba(201,146,46,0.12)', color: GOLD }}>
                            {item.expiry_override === 'illegal' ? '⚠ 违规记录永久保留' : '🔥 高赞豁免'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p style={{
                    fontSize: '0.86rem',
                    color: 'rgba(31,41,55,0.86)',
                    lineHeight: 1.65,
                    marginBottom: 12,
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {renderContent(item.content)}
                  </p>

                  {item.files && item.files.length > 0 && (() => {
                    const pdfFiles = item.files.filter(f => {
                      if (f.type && (f.type.includes('pdf') || f.type === 'application/pdf')) return true;
                      if (f.name && f.name.toLowerCase().endsWith('.pdf')) return true;
                      return false;
                    });
                    if (pdfFiles.length === 0) return null;
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                        {pdfFiles.map((f, fi) => (
                          <button key={fi} onClick={() => window.open(f.url, '_blank')}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                              border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.08)',
                              color: '#f87171', fontSize: '0.8rem', fontWeight: 600,
                            }}>
                            📄 {f.name}
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(71,85,105,0.58)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      — {renderName(item.author_name, item.is_realname)}
                      {item.lc_profiles?.verified_shop && (
                        <span style={{ padding: '1px 5px', borderRadius: 999, fontSize: '0.62rem', fontWeight: 900, background: '#3b82f6', color: '#fff' }} title="已认证店家">蓝V</span>
                      )}
                      {item.lc_profiles?.verified_dm && (
                        <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: '0.62rem', fontWeight: 800, background: 'linear-gradient(135deg, #d9a857, #b8860b)', color: '#0F1117' }} title="已认证DM">DM</span>
                      )}
                      <span>· {item.created_at?.slice(0, 10)}</span>
                      <span>· 初始 {item.initial_amount} 契约币</span>
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openVoteModal(item.id, 'like')}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.08)', color: '#34d399', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                        👍 {item.likes} <span style={{ fontSize: '0.7rem', color: 'rgba(52,211,153,0.6)' }}>1币</span>
                      </button>
                      <button onClick={() => openVoteModal(item.id, 'dislike')}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.07)', color: RED, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                        👎 {item.dislikes} <span style={{ fontSize: '0.7rem', color: 'rgba(248,113,113,0.5)' }}>1币</span>
                      </button>
                    </div>
                  </div>

                  {pinnedComments.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      {pinnedComments.map(c => (
                        <div key={c.id} style={{
                          border: '1px solid rgba(166,106,31,0.22)',
                          background: 'linear-gradient(135deg, #fff7ed 0%, #fffdf8 100%)',
                          borderRadius: 10,
                          padding: '10px 12px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(166,106,31,0.12)', color: GOLD, fontSize: '0.7rem', fontWeight: 900 }}>
                              置顶 · {c.pin_label || '相关方回应'}
                            </span>
                            <span style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.72rem' }}>
                              {renderName(c.author_name, c.is_realname)} · {c.created_at?.slice(0, 10)}
                            </span>
                          </div>
                          <p style={{ color: 'rgba(31,41,55,0.88)', fontSize: '0.82rem', lineHeight: 1.65, margin: 0 }}>
                            {c.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid rgba(201,146,46,0.08)' }}>
                    <button onClick={() => toggleComments(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(71,85,105,0.68)', fontSize: '0.8rem', padding: '4px 0' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(71,85,105,0.68)')}>
                      💬 {showComments ? '收起评论' : `评论${comments.length ? ` (${comments.length})` : ''}`}
                    </button>
                    <button onClick={() => openCommentModal(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(71,85,105,0.68)', fontSize: '0.8rem', padding: '4px 0' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(71,85,105,0.68)')}>+ 发评论 1币</button>
                    <button onClick={() => toggleVotes(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(71,85,105,0.68)', fontSize: '0.8rem', padding: '4px 0' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(71,85,105,0.68)')}>
                      {showVotes ? '收起口碑' : '公开口碑'}
                    </button>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => openRelatedModal(item.id, item.subject_name)}
                      style={{ background: 'rgba(201,146,46,0.06)', border: '1px solid rgba(201,146,46,0.2)', borderRadius: 8, cursor: 'pointer', color: 'rgba(201,146,46,0.6)', fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px' }}
                      onMouseEnter={e => { e.currentTarget.style.color = GOLD; e.currentTarget.style.borderColor = GOLD; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(201,146,46,0.6)'; e.currentTarget.style.borderColor = 'rgba(201,146,46,0.2)'; }}>
                      我是相关方
                    </button>
                  </div>

                  {showVotes && (
                    <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {votes.length === 0 ? (
                        <span style={{ fontSize: '0.78rem', color: 'rgba(71,85,105,0.48)' }}>暂无公开口碑</span>
                      ) : votes.map(v => (
                        <span key={v.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '4px 10px', borderRadius: 999, fontSize: '0.74rem',
                          color: v.vote_type === 'like' ? '#34d399' : RED,
                          background: v.vote_type === 'like' ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
                          border: `1px solid ${v.vote_type === 'like' ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'}`,
                        }}>{v.vote_type === 'like' ? '👍' : '👎'} {v.voter_is_realname ? `⭐ ${v.voter_name}` : v.voter_name}</span>
                      ))}
                    </div>
                  )}

                  {showComments && (
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {normalComments.length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: 'rgba(71,85,105,0.48)', textAlign: 'center', padding: '12px 0' }}>暂无评论，等待审核中...</p>
                      ) : normalComments.map(c => (
                        <div key={c.id} style={{ backgroundColor: '#fff7ed', border: '1px solid rgba(166,106,31,0.12)', borderRadius: 10, padding: '10px 14px', fontSize: '0.84rem' }}>
                          <p style={{ color: 'rgba(31,41,55,0.86)', lineHeight: 1.7, marginBottom: 6 }}>{c.content}</p>
                          <span style={{ fontSize: '0.72rem', color: 'rgba(71,85,105,0.52)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            — {renderName(c.author_name, c.is_realname)} · {c.created_at?.slice(0, 10)}
                            <button onClick={() => likeComment(item.id, c.id)} disabled={likingComment === c.id}
                              style={{ marginLeft: 'auto', border: 'none', background: 'none', color: '#34d399', cursor: 'pointer', fontSize: '0.75rem' }}>👍 {c.likes}</button>
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

      {/* Vote Modal */}
      {voteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: '#fffdf8', color: '#1f2937', border: '1px solid rgba(166,106,31,0.22)', borderRadius: 20, padding: 32, maxWidth: 420, width: '100%', boxShadow: '0 22px 60px rgba(17,24,39,0.22)' }}>
            <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>{voteModal.voteType === 'like' ? '👍 点赞' : '👎 点踩'} · 1 契约币</h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(71,85,105,0.80)', lineHeight: 1.7, marginBottom: 12 }}>
              以 <strong style={{ color: GOLD }}>{auth?.displayName || '当前账号'}</strong> 的身份投票，扣 1 契约币
            </p>
            <p style={{ fontSize: '0.85rem', color: balance && balance >= 1 ? '#34d399' : RED, lineHeight: 1.7, marginBottom: 20 }}>
              当前契约币：{balance ?? '...'} {balance !== null && balance < 1 && <Link to="/wallet" style={{ color: GOLD }}>（契约币不足，去充值）</Link>}
            </p>
            {voteError && <p style={{ color: RED, fontSize: '0.8rem', marginBottom: 12 }}>{voteError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setVoteModal(null)}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(71,85,105,0.18)', background: '#fffaf2', color: 'rgba(71,85,105,0.74)', cursor: 'pointer', fontSize: '0.875rem' }}>取消</button>
              <button onClick={submitVote} disabled={voting || (balance !== null && balance < 1)}
                style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                  cursor: voting || (balance !== null && balance < 1) ? 'not-allowed' : 'pointer',
                  background: voting || (balance !== null && balance < 1) ? 'rgba(71,85,105,0.08)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                  color: voting || (balance !== null && balance < 1) ? 'rgba(71,85,105,0.52)' : C, fontWeight: 700, fontSize: '0.875rem',
                  opacity: voting ? 0.6 : 1 }}>
                {voting ? '提交中...' : '确认投票'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Related Party Comment Modal */}
      {relatedModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: '#fffdf8', color: '#1f2937', border: '1px solid rgba(166,106,31,0.22)', borderRadius: 20, padding: 32, maxWidth: 460, width: '100%', boxShadow: '0 22px 60px rgba(17,24,39,0.22)' }}>
            {relatedDone ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>相关方回应已提交</h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(71,85,105,0.80)', lineHeight: 1.7, marginBottom: 20 }}>审核通过后会置顶显示在主帖下方，所有人不用展开评论也能看到。</p>
                <button onClick={() => setRelatedModal(null)}
                  style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, fontWeight: 700, cursor: 'pointer' }}>关闭</button>
              </div>
            ) : (
              <>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 4 }}>我是相关方 · 1 契约币</h3>
                <p style={{ fontSize: '0.82rem', color: 'rgba(71,85,105,0.70)', marginBottom: 16 }}>
                  针对「{relatedModal.subjectName}」直接写回应。审核通过后，这条回应会作为置顶评论展示。
                </p>
                <p style={{ fontSize: '0.82rem', color: balance && balance >= 1 ? '#16a34a' : RED, marginBottom: 14 }}>
                  当前契约币：{balance ?? '...'} {balance !== null && balance < 1 && <Link to="/wallet" style={{ color: GOLD }}>契约币不足，去充值</Link>}
                </p>
                <textarea value={relatedText} onChange={e => setRelatedText(e.target.value)} placeholder="用你的身份直接回应这条记录，例如解释事实、补充证据、说明处理进展……" rows={5} style={{ ...inputStyle, resize: 'none' }} />
                {relatedError && <p style={{ color: RED, fontSize: '0.8rem', marginTop: 12 }}>{relatedError}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setRelatedModal(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(71,85,105,0.18)', background: '#fffaf2', color: 'rgba(71,85,105,0.74)', cursor: 'pointer', fontSize: '0.875rem' }}>取消</button>
                  <button onClick={submitRelatedComment} disabled={!relatedText.trim() || submittingRelated || (balance !== null && balance < 1)}
                    style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                      cursor: relatedText.trim() && !submittingRelated && (balance === null || balance >= 1) ? 'pointer' : 'not-allowed',
                      background: relatedText.trim() && (balance === null || balance >= 1) ? `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)` : 'rgba(71,85,105,0.08)',
                      color: relatedText.trim() && (balance === null || balance >= 1) ? C : 'rgba(71,85,105,0.52)', fontWeight: 700, fontSize: '0.875rem' }}>
                    {submittingRelated ? '提交中...' : '提交相关方回应'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {commentModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: '#fffdf8', color: '#1f2937', border: '1px solid rgba(166,106,31,0.22)', borderRadius: 20, padding: 32, maxWidth: 440, width: '100%', boxShadow: '0 22px 60px rgba(17,24,39,0.22)' }}>
            {commentDone ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>评论已提交</h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(71,85,105,0.80)', lineHeight: 1.7, marginBottom: 20 }}>审核通过后将显示在帖子下方。</p>
                <button onClick={() => setCommentModal(null)}
                  style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, fontWeight: 700, cursor: 'pointer' }}>关闭</button>
              </div>
            ) : (
              <>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>发表评论 · 1 契约币</h3>
                <p style={{ fontSize: '0.82rem', color: 'rgba(71,85,105,0.70)', marginBottom: 16 }}>
                  以 <strong style={{ color: GOLD }}>{auth?.displayName || '当前账号'}</strong> 的身份评论，扣 1 契约币。
                  当前契约币：<strong style={{ color: balance && balance >= 1 ? '#34d399' : RED }}>{balance ?? '...'}</strong>
                  {balance !== null && balance < 1 && <span> <Link to="/wallet" style={{ color: GOLD }}>契约币不足，去充值</Link></span>}
                </p>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(71,85,105,0.82)', marginBottom: 6 }}>评论内容 <span style={{ color: RED }}>*</span></label>
                  <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="写下你的看法..." rows={4} style={{ ...inputStyle, resize: 'none' }} />
                </div>
                {commentError && <p style={{ color: RED, fontSize: '0.8rem', marginTop: 12 }}>{commentError}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setCommentModal(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(71,85,105,0.18)', background: '#fffaf2', color: 'rgba(71,85,105,0.74)', cursor: 'pointer', fontSize: '0.875rem' }}>取消</button>
                  <button onClick={submitComment} disabled={!commentText.trim() || submittingComment || (balance !== null && balance < 1)}
                    style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                      cursor: commentText.trim() && !submittingComment && (balance === null || balance >= 1) ? 'pointer' : 'not-allowed',
                      background: commentText.trim() && (balance === null || balance >= 1) ? `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)` : 'rgba(71,85,105,0.08)',
                      color: commentText.trim() && (balance === null || balance >= 1) ? C : 'rgba(71,85,105,0.52)', fontWeight: 700, fontSize: '0.875rem' }}>
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
