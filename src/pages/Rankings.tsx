import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CITIES } from '../constants/cities';
import { getJsonCached } from '../lib/apiCache';
import { generatedAvatarDataUrl } from '../lib/avatar';
import ResponsibilityNotice from '../components/ResponsibilityNotice';
import ReportModal, { type ReportTargetType } from '../components/ReportModal';

const API = '/api';
const C = '#f6efe4';
const GOLD = '#a66a1f';
const RED = '#f87171';
const BLK = '#94a3b8';

const SUBJECT_LABEL: Record<string, string> = {
  creator: '委托师',
  dm: '卡司',
  store: '店家',
  takeaway: '外卖',
  player: '玩家',
};

const SUBJECT_TYPES = ['creator', 'dm', 'store', 'takeaway', 'player'] as const;
const POPULAR_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '重庆', '武汉', '南京', '长沙', '西安', '天津'];
const TAB_HINT: Record<'red' | 'white' | 'black', string> = {
  red: '红榜：表扬值得推荐的人、店和服务，记录具体事件，并沉淀到对象档案。',
  white: '白榜：免费发帖，适合记录中性事实、补充线索、普通提醒，先留下公开记录。',
  black: '黑榜：记录违约、失联、骚扰、欺诈、严重服务不符等负面事件，公开期 30 天，不做砸币攻击榜。',
};
const RANKINGS_RETENTION_NOTE = '黑榜 30 天公开期不是删除记录，而是把“持续公开挂人”和“长期行业学习”分开：公开期结束后，必要记录仍可用于争议处理和安全审计，后续也会优先做去标识化的共性问题总结。欢迎投资机构、沉浸式娱乐从业者、店家、DM、委托师和技术合作者提供样本、规则建议与共建资源。';

type AuthSession = { token: string; displayName: string; userId?: string; city?: string | null; availableCities: string[] };

type MyVote = {
  id: string;
  vote_type: 'like' | 'dislike' | 'joy';
  created_at: string;
  cancel_deadline: string;
  can_cancel: boolean;
  refund_amount: number;
};

type Ranking = {
  id: string;
  poster_id?: string | null;
  type: 'red' | 'black' | 'white';
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
  joys?: number;
  created_at: string;
  expires_at?: string;
  expiry_override?: string;
  files?: { name: string; url: string; type?: string }[];
  lc_profiles?: { display_name?: string; avatar?: string | null; verified_dm?: boolean; verified_shop?: boolean; role?: string };
  my_vote?: MyVote | null;
  audit_proof?: {
    event_type: string;
    entry_hash: string;
    content_hash: string;
    chain_date: string;
    created_at: string;
  } | null;
  pinned_comments?: Comment[];
};

type Comment = {
  id: string;
  content: string;
  author_id?: string | null;
  author_name: string;
  is_realname: boolean;
  is_pinned?: boolean;
  pin_label?: string | null;
  likes: number;
  created_at: string;
};

type VoteRecord = {
  id: string;
  vote_type: 'like' | 'dislike' | 'joy';
  voter_name: string;
  voter_is_realname: boolean;
  created_at: string;
};

type VoteModal = { id: string; voteType: 'like' | 'dislike' | 'joy' } | null;
type CommentModal = { rankingId: string } | null;
type RelatedFile = { name: string; url: string; type?: string };
type RelatedCertModal = { rankingId: string; commentId: string } | null;
type ReportTarget = { targetType: ReportTargetType; targetId: string; targetTitle: string };
type AuditChange = { field: string; label?: string; before?: unknown; after?: unknown };
type AuditEntry = {
  id: string;
  event_type: string;
  content_hash: string;
  previous_hash?: string | null;
  entry_hash: string;
  chain_date: string;
  created_at: string;
  canonical_payload?: Record<string, unknown> | null;
  metadata?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    changes?: AuditChange[];
    [key: string]: unknown;
  } | null;
};
type AuditData = {
  entries: AuditEntry[];
  daily_roots: { audit_date: string; root_hash: string; entry_count: number; generated_at?: string }[];
  target?: Record<string, unknown> | null;
};
type AuditModal = { item: Ranking; loading: boolean; error: string; data?: AuditData } | null;

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
    const availableCities = Array.isArray(data.available_cities)
      ? data.available_cities.map((item: unknown) => String(item || '').trim()).filter(Boolean)
      : [];
    const fallbackCity = String(data.city || '').trim();
    return {
      token: data.token,
      displayName: data.display_name || '用户',
      userId: payload.creatorId,
      city: fallbackCity || null,
      availableCities: availableCities.length > 0 ? availableCities : (fallbackCity ? [fallbackCity] : []),
    };
  } catch { return null; }
}

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function dossierUrl(item: Pick<Ranking, 'subject_name' | 'subject_type' | 'subject_city'>) {
  const params = new URLSearchParams({
    subjectName: item.subject_name,
    subjectType: item.subject_type,
  });
  if (item.subject_city) params.set('city', item.subject_city);
  return `/reputation/dossier?${params}`;
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

function voteCopy(voteType: MyVote['vote_type']) {
  if (voteType === 'like') return { label: '赞扬', icon: '赞', paid: true };
  if (voteType === 'dislike') return { label: '关注风险', icon: '险', paid: true };
  return { label: '共鸣', icon: '共', paid: false };
}

function voteCost(voteType: MyVote['vote_type']) {
  return voteType === 'joy' ? 0 : 1;
}

function voteCanCancel(myVote: MyVote | null | undefined) {
  if (!myVote) return false;
  return myVote.can_cancel && new Date(myVote.cancel_deadline).getTime() > Date.now();
}

function voteDeadlineText(myVote: MyVote | null | undefined) {
  if (!myVote) return '';
  return new Date(myVote.cancel_deadline).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortHash(hash?: string | null) {
  if (!hash) return '';
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

const AUDIT_EVENT_LABEL: Record<string, string> = {
  ranking_approved: '审核通过',
  ranking_reclassified_approved: '审核改类通过',
  ranking_admin_edited: '管理员编辑',
  comment_approved: '评论通过',
  related_reply_pinned: '相关方回应置顶',
  commission_approved: '委托需求通过',
  carpool_approved: '拼车通过',
};

const AUDIT_FIELD_LABEL: Record<string, string> = {
  type: '榜单类型',
  subject_name: '对象名称',
  subject_type: '对象分类',
  subject_city: '所在城市',
  subject_url: '社交主页',
  content: '正文内容',
  expires_at: '黑榜到期时间',
};

function formatAuditValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '未填写';
  if (field === 'type') {
    if (value === 'red') return '红榜';
    if (value === 'black') return '黑榜';
    if (value === 'white') return '白榜';
  }
  if (field === 'subject_type' && typeof value === 'string') return SUBJECT_LABEL[value] || value;
  if (field.endsWith('_at') && typeof value === 'string') {
    return new Date(value).toLocaleString('zh-CN', { hour12: false });
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function formatAuditTime(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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

function AuthorAvatar({
  name,
  src,
  seed,
  size = 34,
}: {
  name: string;
  src?: string | null;
  seed?: string | null;
  size?: number;
}) {
  return (
    <img
      src={src || generatedAvatarDataUrl(name, seed)}
      alt=""
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        objectFit: 'cover',
        flexShrink: 0,
        border: '1px solid rgba(166,106,31,0.18)',
        background: '#fffaf2',
      }}
    />
  );
}

function CityFilter({
  city, preferredCities, open, query, options, onToggle, onQuery, onSelect, onClose,
}: {
  city: string;
  preferredCities: string[];
  open: boolean;
  query: string;
  options: string[];
  onToggle: () => void;
  onQuery: (value: string) => void;
  onSelect: (city: string) => void;
  onClose: () => void;
}) {
  const cityLabel = city === 'preferred'
    ? `我的城市${preferredCities.length > 0 ? `：${preferredCities.slice(0, 2).join('、')}${preferredCities.length > 2 ? '等' : ''}` : ''}`
    : city === 'all' ? '全部城市' : city;

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
        📍 {cityLabel} ▾
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
              {preferredCities.length > 0 && (
                <FilterPill active={city === 'preferred'} onClick={() => onSelect('preferred')}>我的城市</FilterPill>
              )}
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
  const initialPreferredCities = getAuth()?.availableCities || [];
  const [tab, setTab] = useState<'red' | 'black' | 'white'>('red');
  const [subjectTab, setSubjectTab] = useState<string>('all');
  const [city, setCity] = useState(initialPreferredCities.length > 0 ? 'preferred' : 'all');
  const [preferredCities, setPreferredCities] = useState<string[]>(initialPreferredCities);
  const [cityTouched, setCityTouched] = useState(false);
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

  const [certifyingComment, setCertifyingComment] = useState('');
  const [relatedModal, setRelatedModal] = useState<RelatedCertModal>(null);
  const [relatedNote, setRelatedNote] = useState('');
  const [relatedFiles, setRelatedFiles] = useState<RelatedFile[]>([]);
  const [relatedError, setRelatedError] = useState('');
  const [relatedDone, setRelatedDone] = useState(false);
  const [uploadingRelatedFiles, setUploadingRelatedFiles] = useState(false);

  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({});
  const [commentModal, setCommentModal] = useState<CommentModal>(null);
  const [commentText, setCommentText] = useState('');
  const [commentDone, setCommentDone] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [likingComment, setLikingComment] = useState('');
  const [deletingComment, setDeletingComment] = useState('');

  const [openVotes, setOpenVotes] = useState<Set<string>>(new Set());
  const [votesMap, setVotesMap] = useState<Record<string, VoteRecord[]>>({});
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [auditModal, setAuditModal] = useState<AuditModal>(null);

  const auth = getAuth();
  const preferredCityParam = preferredCities.join(',');

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
        const { data: d } = await getJsonCached<{ success: boolean; data?: { id: string } }>(
          `${API}/lc/profiles/lookup?name=${encodeURIComponent(name)}`,
          undefined,
          60_000,
        );
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

  useEffect(() => {
    const current = getAuth();
    if (!current) return;
    let alive = true;
    fetch(`${API}/lc/me`, { headers: { Authorization: `Bearer ${current.token}` } })
      .then(r => r.json())
      .then(d => {
        if (!alive || !d.success) return;
        const profileCities = Array.isArray(d.data?.available_cities)
          ? d.data.available_cities.map((item: unknown) => String(item || '').trim()).filter(Boolean)
          : [];
        const fallbackCity = String(d.data?.city || '').trim();
        const nextCities = profileCities.length > 0 ? profileCities : (fallbackCity ? [fallbackCity] : []);
        setPreferredCities(nextCities);
        if (!cityTouched && nextCities.length > 0) setCity('preferred');
      })
      .catch(() => { /* profile city preference is optional */ });
    return () => { alive = false; };
  }, [cityTouched]);

  useEffect(() => {
    let alive = true;
    const loadRankings = async () => {
      setLoading(true);
      setError('');
      fetchWallet();
      try {
        const params = new URLSearchParams({ type: tab });
        if (subjectTab !== 'all') params.set('subjectType', subjectTab);
        if (city === 'preferred' && preferredCityParam) params.set('cities', preferredCityParam);
        else if (city !== 'all' && city !== 'preferred') params.set('city', city);
        const current = getAuth();
        const r = await fetch(`${API}/lc/rankings?${params}`, {
          headers: current ? { Authorization: `Bearer ${current.token}` } : undefined,
        });
        if (!r.ok) throw new Error(`请求失败 (${r.status})`);
        const d = await r.json();
        if (alive && d.success) {
          const list = d.data || [];
          setItems(list);
          void fetchMentions(list);
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
  }, [tab, subjectTab, city, preferredCityParam, fetchWallet]);

  const setCityAndClose = (nextCity: string) => {
    setCityTouched(true);
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
        setItems(prev => prev.map(i => i.id === voteModal.id ? {
          ...i,
          likes: d.data.likes,
          dislikes: d.data.dislikes,
          joys: d.data.joys,
          my_vote: d.data.myVote || null,
        } : i));
        fetchVotes(voteModal.id);
        fetchWallet();
        setVoteModal(null);
      } else {
        if (d.data?.myVote) {
          setItems(prev => prev.map(i => i.id === voteModal.id ? { ...i, my_vote: d.data.myVote } : i));
        }
        setVoteError(d.error || '操作失败');
      }
    } catch { setVoteError('网络错误'); }
    finally { setVoting(false); }
  };

  const cancelVote = async () => {
    if (!voteModal) return;
    const current = requireAuth();
    if (!current) return;
    setVoting(true);
    setVoteError('');
    try {
      const r = await fetch(`${API}/lc/rankings/${voteModal.id}/vote`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${current.token}` },
      });
      const d = await r.json();
      if (d.success) {
        setItems(prev => prev.map(i => i.id === voteModal.id ? {
          ...i,
          likes: d.data.likes,
          dislikes: d.data.dislikes,
          joys: d.data.joys,
          my_vote: null,
        } : i));
        fetchVotes(voteModal.id);
        fetchWallet();
        setVoteModal(null);
      } else {
        setVoteError(d.error || '撤销失败');
      }
    } catch { setVoteError('网络错误'); }
    finally { setVoting(false); }
  };

  const openRelatedCertModal = (rankingId: string, commentId: string) => {
    const current = requireAuth();
    if (!current) return;
    setRelatedModal({ rankingId, commentId });
    setRelatedNote('');
    setRelatedFiles([]);
    setRelatedError('');
    setRelatedDone(false);
  };

  const closeRelatedCertModal = () => {
    setRelatedModal(null);
    setRelatedNote('');
    setRelatedFiles([]);
    setRelatedError('');
    setRelatedDone(false);
    setUploadingRelatedFiles(false);
  };

  const handleRelatedFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    const current = requireAuth();
    if (!current) return;
    setUploadingRelatedFiles(true);
    setRelatedError('');
    try {
      const nextFiles: RelatedFile[] = [];
      for (const file of selectedFiles) {
        if (!file.type.startsWith('image/')) {
          setRelatedError('相关方认证资料目前只支持图片');
          continue;
        }
        if (file.size > 4 * 1024 * 1024) {
          setRelatedError(`${file.name} 超过 4MB，请压缩后再传`);
          continue;
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('scope', 'related-party-proof');
        const r = await fetch(`${API}/lc/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${current.token}` },
          body: formData,
        });
        const d = await r.json();
        if (!r.ok || !d.success) {
          const msg = typeof d.error === 'string' ? d.error : (d.error?.message || `${file.name} 上传失败`);
          throw new Error(msg);
        }
        nextFiles.push({ name: d.data?.name || file.name, url: d.data?.url, type: d.data?.type || file.type });
      }
      setRelatedFiles(prev => [...prev, ...nextFiles].slice(0, 4));
    } catch (e) {
      setRelatedError(e instanceof Error ? e.message : '图片上传失败，请换一张图试试');
    } finally {
      setUploadingRelatedFiles(false);
      e.target.value = '';
    }
  };

  const removeRelatedFile = (index: number) => {
    setRelatedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const submitRelatedCert = async () => {
    if (!relatedModal) return;
    const current = requireAuth();
    if (!current) return;
    if (!relatedNote.trim() && relatedFiles.length === 0) {
      setRelatedError('请写明你的相关关系，或上传能证明身份/关联的图片材料');
      return;
    }
    setCertifyingComment(relatedModal.commentId);
    setRelatedError('');
    try {
      const r = await fetch(`${API}/lc/rankings/${relatedModal.rankingId}/comments/${relatedModal.commentId}/related-certify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` },
        body: JSON.stringify({ relatedNote: relatedNote.trim(), relatedFiles }),
      });
      const d = await r.json();
      if (d.success) {
        setRelatedDone(true);
        fetchComments(relatedModal.rankingId);
      }
      else setRelatedError(d.error || '认证失败');
    } catch { setRelatedError('网络错误'); }
    finally { setCertifyingComment(''); }
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

  const deleteOwnComment = async (rankingId: string, commentId: string) => {
    const current = requireAuth();
    if (!current) return;
    const confirmed = window.confirm('删除自己的评论后将不再公开显示。24小时内删除会退回 1 契约币，超过 24 小时不退款。确认删除吗？');
    if (!confirmed) return;
    setDeletingComment(commentId);
    try {
      const r = await fetch(`${API}/lc/rankings/${rankingId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${current.token}` },
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '删除失败');
        window.alert(msg);
        return;
      }
      setCommentsMap(prev => ({
        ...prev,
        [rankingId]: (prev[rankingId] || []).filter(c => c.id !== commentId),
      }));
      setItems(prev => prev.map(item => item.id === rankingId
        ? { ...item, pinned_comments: (item.pinned_comments || []).filter(c => c.id !== commentId) }
        : item));
      fetchWallet();
    } catch {
      window.alert('网络错误，请稍后再试');
    } finally {
      setDeletingComment('');
    }
  };

  const openVoteModal = (id: string, voteType: 'like' | 'dislike' | 'joy') => {
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

  const openReportModal = (target: ReportTarget) => {
    const current = requireAuth();
    if (!current) return;
    setReportTarget(target);
  };

  const openAuditModal = async (item: Ranking) => {
    setAuditModal({ item, loading: true, error: '' });
    try {
      const r = await fetch(`${API}/lc/audit/ranking/${item.id}`);
      const d = await r.json();
      if (!r.ok || !d.success) {
        const errMsg = typeof d.error === 'string' ? d.error : (d.error?.message || '审计记录加载失败');
        setAuditModal({ item, loading: false, error: errMsg });
        return;
      }
      setAuditModal({ item, loading: false, error: '', data: d.data });
    } catch {
      setAuditModal({ item, loading: false, error: '网络错误' });
    }
  };

  const tabBtn = (t: 'red' | 'black' | 'white', label: string, color: string) => (
    <button onClick={() => setTab(t)}
      style={{
        flex: 1, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
        fontWeight: 700, fontSize: '1rem', transition: 'all 0.2s',
        background: tab === t ? `${color}18` : 'transparent',
        color: tab === t ? color : 'rgba(71,85,105,0.70)',
        boxShadow: tab === t ? `inset 0 0 0 1px ${color}36` : 'none',
      }}>{label}</button>
  );

  const renderName = (name: string, isRealname: boolean) => isRealname
    ? <><span style={{ color: GOLD, fontWeight: 700 }}>⭐ {name}</span><span style={{ color: 'rgba(201,146,46,0.5)', fontSize: '0.7rem' }}> 实名</span></>
    : name;

  const voteModalItem = voteModal ? items.find(item => item.id === voteModal.id) : undefined;
  const existingMyVote = voteModalItem?.my_vote || null;
  const existingVoteCopy = existingMyVote ? voteCopy(existingMyVote.vote_type) : null;
  const requestedVoteCopy = voteModal ? voteCopy(voteModal.voteType) : null;
  const canCancelExistingVote = voteCanCancel(existingMyVote);
  const isChangingVote = !!existingMyVote && !!voteModal && existingMyVote.vote_type !== voteModal.voteType;
  const voteBalanceDelta = existingMyVote && voteModal ? voteCost(existingMyVote.vote_type) - voteCost(voteModal.voteType) : 0;
  const changingVoteNeedsBalance = isChangingVote && voteBalanceDelta < 0;
  const changingVoteBalanceNotEnough = changingVoteNeedsBalance && balance !== null && balance < Math.abs(voteBalanceDelta);

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
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 8 }}>灵契红黑榜事件榜</h1>
            <p style={{ color: 'rgba(71,85,105,0.80)', fontSize: '0.95rem' }}>
              玩家遇到的具体事件在这里公开记录，再沉淀到爱D墙、城市口碑榜和对象档案。
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
          <div style={{ width: 'min(100%, 420px)', display: 'flex', gap: 4, padding: 4, backgroundColor: '#fffdf8', border: '1px solid rgba(166,106,31,0.16)', borderRadius: 14, boxShadow: '0 8px 20px rgba(102,70,30,0.06)' }}>
            {tabBtn('red', '🏅 红榜', '#b91c1c')}
            {tabBtn('white', '✨ 白榜', '#b8860b')}
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
          <Link to="/reputation/city"
            style={{ padding: '11px 16px', borderRadius: 12, border: '1px solid rgba(166,106,31,0.22)', color: GOLD, background: '#fffdf8', fontWeight: 800, fontSize: '0.86rem', textDecoration: 'none', flexShrink: 0 }}>
            城市口碑榜
          </Link>
          <Link to="/dm-wall"
            style={{ padding: '11px 16px', borderRadius: 12, border: '1px solid rgba(166,106,31,0.22)', color: GOLD, background: '#fffdf8', fontWeight: 800, fontSize: '0.86rem', textDecoration: 'none', flexShrink: 0 }}>
            爱D墙
          </Link>
        </div>
        <p style={{ margin: '-2px 0 16px', color: 'rgba(71,85,105,0.62)', fontSize: '0.78rem', lineHeight: 1.7 }}>
          {TAB_HINT[tab]}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <p style={{ color: 'rgba(71,85,105,0.68)', fontSize: '0.78rem' }}>
            当前排序：赞扬值优先 · 同赞扬按发布时间；黑榜只作公共风险记录。
          </p>
          <CityFilter
            city={city}
            preferredCities={preferredCities}
            open={cityOpen}
            query={cityQuery}
            options={cityOptions}
            onToggle={() => setCityOpen(v => !v)}
            onQuery={setCityQuery}
            onSelect={setCityAndClose}
            onClose={() => setCityOpen(false)}
          />
        </div>

        <div style={{
          marginBottom: 18,
          padding: '13px 16px',
          borderRadius: 12,
          background: '#fffdf8',
          border: '1px solid rgba(166,106,31,0.16)',
          boxShadow: '0 8px 20px rgba(102,70,30,0.05)',
          color: 'rgba(31,41,55,0.78)',
          fontSize: '0.82rem',
          lineHeight: 1.7,
        }}>
          <strong style={{ color: GOLD }}>审核规则：</strong>
          审核员尽量保持中立客观；主帖必须附带证据；涉及第三方隐私的信息请先打码；微信认证后一人一票，不可多投。相关方可先发表普通评论，评论通过后再认证为置顶回应。
        </div>
        <div style={{ marginBottom: 18 }}>
          <ResponsibilityNotice compact />
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
            <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.3 }}>{tab === 'red' ? '🏅' : tab === 'black' ? '👎' : '✨'}</div>
            <p style={{ color: 'rgba(71,85,105,0.68)', marginBottom: 20 }}>
              {subjectTab !== 'all' ? `${SUBJECT_LABEL[subjectTab] || subjectTab}暂无内容` : (tab === 'red' ? '红榜暂无内容' : tab === 'black' ? '黑榜暂无内容' : '白榜暂无内容')}
            </p>
            <Link to="/rankings/new" style={{ color: GOLD, fontSize: '0.875rem', textDecoration: 'underline' }}>
              成为第一个发布的人
            </Link>
          </div>
        )}

        {!loading && !error && rankedItems.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, alignItems: 'start' }}>
            {rankedItems.map((item, idx) => {
              const accentColor = item.type === 'red' ? '#b91c1c' : item.type === 'black' ? BLK : GOLD;
              const subtleAccentBg = item.type === 'red' ? 'rgba(185,28,28,0.08)' : item.type === 'black' ? 'rgba(148,163,184,0.10)' : 'rgba(166,106,31,0.10)';
              const subtleAccentBorder = item.type === 'red' ? 'rgba(185,28,28,0.16)' : item.type === 'black' ? 'rgba(148,163,184,0.20)' : 'rgba(166,106,31,0.24)';
              const loadedComments = commentsMap[item.id];
              const comments = loadedComments || item.pinned_comments || [];
              const pinnedComments = (loadedComments || item.pinned_comments || []).filter(c => c.is_pinned);
              const normalComments = (loadedComments || []).filter(c => !c.is_pinned);
              const votes = votesMap[item.id] || [];
              const showComments = openComments.has(item.id);
              const showVotes = openVotes.has(item.id);
              const left = daysLeft(item);
              const myVote = item.my_vote || null;

              return (
                <div key={item.id}
                  className="content-card"
                  style={{
                    ...card,
                    borderLeft: `3px solid ${accentColor}`,
                    borderColor: subtleAccentBorder,
                    borderLeftColor: accentColor,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 38, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <AuthorAvatar name={item.author_name} src={item.lc_profiles?.avatar} seed={item.poster_id || item.id} size={34} />
                      <span style={{
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: subtleAccentBg,
                        border: `1px solid ${subtleAccentBorder}`,
                        color: accentColor,
                        fontSize: '0.68rem',
                        fontWeight: 900,
                      }}>#{idx + 1}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '0.95rem',
                        color: 'rgba(17,24,39,0.92)',
                        lineHeight: 1.72,
                        margin: '0 0 10px',
                        fontWeight: 560,
                        display: '-webkit-box',
                        WebkitLineClamp: 5,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {renderContent(item.content)}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <Link to={dossierUrl(item)}
                          style={{ fontWeight: 800, fontSize: '0.9rem', color: 'rgba(31,41,55,0.86)', textDecoration: 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(31,41,55,0.86)')}>
                          {item.subject_name}
                        </Link>
                        <span style={{
                          padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
                          background: subtleAccentBg,
                          color: accentColor,
                          border: `1px solid ${subtleAccentBorder}`,
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 9px',
                          borderRadius: 999,
                          background: 'rgba(166,106,31,0.08)',
                          border: '1px solid rgba(166,106,31,0.14)',
                          color: 'rgba(71,85,105,0.86)',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                        }}>
                          发布人 {renderName(item.author_name, item.is_realname)}
                        </span>
                        {item.lc_profiles?.verified_shop && (
                          <span style={{ padding: '1px 5px', borderRadius: 999, fontSize: '0.62rem', fontWeight: 900, background: '#3b82f6', color: '#fff' }} title="已认证店家">蓝V</span>
                        )}
                        {item.lc_profiles?.verified_dm && (
                          <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: '0.62rem', fontWeight: 800, background: 'linear-gradient(135deg, #d9a857, #b8860b)', color: '#0F1117' }} title="已认证DM">DM</span>
                        )}
                      </div>
                    </div>
                  </div>

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

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    <button onClick={() => openVoteModal(item.id, 'like')}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 9, border: myVote?.vote_type === 'like' ? '1px solid rgba(22,163,74,0.45)' : '1px solid rgba(52,211,153,0.22)', background: myVote?.vote_type === 'like' ? 'rgba(220,252,231,0.72)' : 'rgba(52,211,153,0.08)', color: myVote?.vote_type === 'like' ? '#15803d' : '#219669', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 800 }}>
                      {myVote?.vote_type === 'like' ? '已赞扬' : '赞扬'} {item.likes}
                      {item.initial_amount > 0 && <span style={{ fontSize: '0.68rem', color: 'rgba(71,85,105,0.56)' }}>含初始 {item.initial_amount}</span>}
                      <span style={{ fontSize: '0.68rem', color: myVote?.vote_type === 'like' ? '#15803d' : 'rgba(33,150,105,0.58)' }}>1币</span>
                    </button>
                    <button onClick={() => openVoteModal(item.id, 'joy')}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 9, border: myVote?.vote_type === 'joy' ? '1px solid rgba(166,106,31,0.42)' : '1px solid rgba(217,168,87,0.25)', background: myVote?.vote_type === 'joy' ? 'rgba(217,168,87,0.16)' : 'rgba(217,168,87,0.10)', color: GOLD, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 800 }}>
                      {myVote?.vote_type === 'joy' ? '已共鸣' : '共鸣'} {item.joys || 0} <span style={{ fontSize: '0.68rem', color: 'rgba(166,106,31,0.55)' }}>免费</span>
                    </button>
                    <button onClick={() => openVoteModal(item.id, 'dislike')}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 9, border: myVote?.vote_type === 'dislike' ? '1px solid rgba(220,38,38,0.38)' : '1px solid rgba(248,113,113,0.2)', background: myVote?.vote_type === 'dislike' ? 'rgba(254,226,226,0.72)' : 'rgba(248,113,113,0.07)', color: myVote?.vote_type === 'dislike' ? '#b91c1c' : RED, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 800 }}>
                      {myVote?.vote_type === 'dislike' ? '已关注风险' : '关注风险'} {item.dislikes} <span style={{ fontSize: '0.68rem', color: myVote?.vote_type === 'dislike' ? '#b91c1c' : 'rgba(248,113,113,0.5)' }}>1币</span>
                    </button>
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
                            {auth?.userId && c.author_id === auth.userId && (
                              <button onClick={() => deleteOwnComment(item.id, c.id)} disabled={deletingComment === c.id}
                                style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'rgba(71,85,105,0.50)', cursor: deletingComment === c.id ? 'not-allowed' : 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                                {deletingComment === c.id ? '删除中...' : '删除'}
                              </button>
                            )}
                            <button
                              onClick={() => openReportModal({ targetType: 'comment', targetId: c.id, targetTitle: `${item.subject_name} 的置顶回应` })}
                              style={{ marginLeft: auth?.userId && c.author_id === auth.userId ? 0 : 'auto', border: 'none', background: 'transparent', color: 'rgba(71,85,105,0.40)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                              举报
                            </button>
                          </div>
                          <p style={{ color: 'rgba(31,41,55,0.88)', fontSize: '0.82rem', lineHeight: 1.65, margin: 0 }}>
                            {c.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid rgba(201,146,46,0.08)', flexWrap: 'wrap' }}>
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
                        {showVotes ? '收起记录' : '谁赞扬/共鸣'}
                    </button>
                    <button
                      onClick={() => openReportModal({ targetType: 'ranking', targetId: item.id, targetTitle: item.subject_name })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(71,85,105,0.42)', fontSize: '0.78rem', padding: '4px 0', fontWeight: 600 }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(185,28,28,0.78)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(71,85,105,0.42)')}>
                      举报
                    </button>
                    {item.audit_proof && (
                      <button
                        type="button"
                        onClick={() => openAuditModal(item)}
                        title={`内容校验码：${item.audit_proof.content_hash}`}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'rgba(71,85,105,0.38)',
                          padding: '4px 0',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#275389')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(71,85,105,0.38)')}
                      >
                        审计 {shortHash(item.audit_proof.entry_hash)}
                      </button>
                    )}
                    <div style={{ flex: 1 }} />
                    <span style={{ marginLeft: 'auto', color: 'rgba(71,85,105,0.42)', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                      {item.created_at?.slice(0, 10)}
                    </span>
                  </div>

                  {showVotes && (
                    <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {votes.length === 0 ? (
                        <span style={{ fontSize: '0.78rem', color: 'rgba(71,85,105,0.48)' }}>暂无赞扬记录</span>
                      ) : votes.map(v => (
                        <span key={v.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '4px 10px', borderRadius: 999, fontSize: '0.74rem',
                          color: v.vote_type === 'like' ? '#34d399' : v.vote_type === 'dislike' ? RED : GOLD,
                          background: v.vote_type === 'like' ? 'rgba(52,211,153,0.08)' : v.vote_type === 'dislike' ? 'rgba(248,113,113,0.08)' : 'rgba(217,168,87,0.10)',
                          border: `1px solid ${v.vote_type === 'like' ? 'rgba(52,211,153,0.18)' : v.vote_type === 'dislike' ? 'rgba(248,113,113,0.18)' : 'rgba(166,106,31,0.18)'}`,
                        }}>{v.vote_type === 'like' ? '👍' : v.vote_type === 'dislike' ? '👎' : '😂'} {v.voter_is_realname ? `⭐ ${v.voter_name}` : v.voter_name}</span>
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
                            {auth?.userId && c.author_id === auth.userId && !c.is_pinned && (
                              <button onClick={() => openRelatedCertModal(item.id, c.id)} disabled={certifyingComment === c.id}
                                style={{ border: '1px solid rgba(166,106,31,0.2)', background: 'rgba(166,106,31,0.08)', color: GOLD, borderRadius: 999, cursor: certifyingComment === c.id ? 'not-allowed' : 'pointer', fontSize: '0.72rem', padding: '2px 8px', fontWeight: 800 }}>
                                {certifyingComment === c.id ? '提交中...' : '我是相关方，我要发表置顶回应'}
                              </button>
                            )}
                            <button onClick={() => likeComment(item.id, c.id)} disabled={likingComment === c.id}
                              style={{ marginLeft: 'auto', border: 'none', background: 'none', color: '#34d399', cursor: 'pointer', fontSize: '0.75rem' }}>👍 {c.likes}</button>
                            {auth?.userId && c.author_id === auth.userId && (
                              <button onClick={() => deleteOwnComment(item.id, c.id)} disabled={deletingComment === c.id}
                                style={{ border: 'none', background: 'none', color: 'rgba(71,85,105,0.48)', cursor: deletingComment === c.id ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                                {deletingComment === c.id ? '删除中...' : '删除'}
                              </button>
                            )}
                            <button
                              onClick={() => openReportModal({ targetType: 'comment', targetId: c.id, targetTitle: `${item.subject_name} 的评论` })}
                              style={{ border: 'none', background: 'none', color: 'rgba(71,85,105,0.42)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                              举报
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
        <p style={{ margin: '18px 0 0', padding: '14px 16px', borderRadius: 12, border: '1px solid #fde68a', backgroundColor: 'rgba(255,255,255,0.68)', color: '#4b5563', lineHeight: 1.7, fontSize: 14 }}>
          {RANKINGS_RETENTION_NOTE}
        </p>
      </div>

      {/* Vote Modal */}
      {voteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: '#fffdf8', color: '#1f2937', border: '1px solid rgba(166,106,31,0.22)', borderRadius: 20, padding: 32, maxWidth: 420, width: '100%', boxShadow: '0 22px 60px rgba(17,24,39,0.22)' }}>
            {existingMyVote && existingVoteCopy ? (
              <>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>
                  {isChangingVote && requestedVoteCopy
                    ? <>改票：{existingVoteCopy.icon} {existingVoteCopy.label} → {requestedVoteCopy.icon} {requestedVoteCopy.label}</>
                    : <>已投过：{existingVoteCopy.icon} {existingVoteCopy.label}</>}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(71,85,105,0.80)', lineHeight: 1.7, marginBottom: 12 }}>
                  每个账号对同一条内容只能保留一票。你已经以 <strong style={{ color: GOLD }}>{auth?.displayName || '当前账号'}</strong> 的身份投过票。
                </p>
                <div style={{
                  border: '1px solid rgba(166,106,31,0.16)',
                  background: '#fffaf2',
                  borderRadius: 12,
                  padding: '12px 14px',
                  marginBottom: 14,
                  color: 'rgba(71,85,105,0.78)',
                  fontSize: '0.82rem',
                  lineHeight: 1.7,
                }}>
                  {isChangingVote
                    ? voteBalanceDelta > 0
                      ? <>改为共鸣会退回 {voteBalanceDelta} 契约币；公开记录会从{existingVoteCopy.label}直接变成{requestedVoteCopy?.label}。</>
                      : voteBalanceDelta < 0
                        ? <>共鸣免费，改为{requestedVoteCopy?.label}需要扣 {Math.abs(voteBalanceDelta)} 契约币。</>
                        : <>{existingVoteCopy.label}和{requestedVoteCopy?.label}互改不再扣币，也不退款，只调整公开口碑方向。</>
                    : canCancelExistingVote
                      ? <>24 小时内可以撤销。{existingMyVote.refund_amount > 0 ? `撤销后退回 ${existingMyVote.refund_amount} 契约币。` : '共鸣免费，撤销不涉及退币。'}截止：{voteDeadlineText(existingMyVote)}</>
                      : <>这票已经超过 24 小时撤销期，只保留公开口碑记录。</>}
                </div>
                {isChangingVote && voteBalanceDelta < 0 && (
                  <p style={{ fontSize: '0.85rem', color: changingVoteBalanceNotEnough ? RED : '#34d399', lineHeight: 1.7, marginBottom: 12 }}>
                    当前契约币：{balance ?? '...'} {changingVoteBalanceNotEnough && <Link to="/wallet" style={{ color: GOLD }}>（契约币不足，去充值）</Link>}
                  </p>
                )}
                {voteError && <p style={{ color: RED, fontSize: '0.8rem', marginBottom: 12 }}>{voteError}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setVoteModal(null)}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(71,85,105,0.18)', background: '#fffaf2', color: 'rgba(71,85,105,0.74)', cursor: 'pointer', fontSize: '0.875rem' }}>
                    关闭
                  </button>
                  {isChangingVote ? (
                    <button onClick={submitVote} disabled={voting || changingVoteBalanceNotEnough}
                      style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                        cursor: voting || changingVoteBalanceNotEnough ? 'not-allowed' : 'pointer',
                        background: voting || changingVoteBalanceNotEnough ? 'rgba(71,85,105,0.08)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                        color: voting || changingVoteBalanceNotEnough ? 'rgba(71,85,105,0.52)' : C,
                        fontWeight: 800, fontSize: '0.875rem', opacity: voting ? 0.6 : 1 }}>
                      {voting ? '改票中...' : `改为${requestedVoteCopy?.label || '此票'}`}
                    </button>
                  ) : (
                    <button onClick={cancelVote} disabled={voting || !canCancelExistingVote}
                    style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                      cursor: voting || !canCancelExistingVote ? 'not-allowed' : 'pointer',
                      background: voting || !canCancelExistingVote ? 'rgba(71,85,105,0.08)' : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                      color: voting || !canCancelExistingVote ? 'rgba(71,85,105,0.52)' : '#fff',
                      fontWeight: 800, fontSize: '0.875rem', opacity: voting ? 0.6 : 1 }}>
                    {voting ? '撤销中...' : canCancelExistingVote ? '撤销投票' : '不可撤销'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>
                  {requestedVoteCopy?.icon} {requestedVoteCopy?.label} · {requestedVoteCopy?.paid ? '1 契约币' : '免费'}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(71,85,105,0.80)', lineHeight: 1.7, marginBottom: 12 }}>
                  以 <strong style={{ color: GOLD }}>{auth?.displayName || '当前账号'}</strong> 的身份互动。{voteModal.voteType === 'joy' ? '共鸣不扣契约币，但同样占用一人一票名额。' : '赞扬/关注风险扣 1 契约币，24 小时内撤销可退回。'}
                </p>
                {voteModal.voteType !== 'joy' && (
                  <p style={{ fontSize: '0.85rem', color: balance && balance >= 1 ? '#34d399' : RED, lineHeight: 1.7, marginBottom: 20 }}>
                    当前契约币：{balance ?? '...'} {balance !== null && balance < 1 && <Link to="/wallet" style={{ color: GOLD }}>（契约币不足，去充值）</Link>}
                  </p>
                )}
                {voteError && <p style={{ color: RED, fontSize: '0.8rem', marginBottom: 12 }}>{voteError}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setVoteModal(null)}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(71,85,105,0.18)', background: '#fffaf2', color: 'rgba(71,85,105,0.74)', cursor: 'pointer', fontSize: '0.875rem' }}>取消</button>
                  <button onClick={submitVote} disabled={voting || (voteModal.voteType !== 'joy' && balance !== null && balance < 1)}
                    style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                      cursor: voting || (voteModal.voteType !== 'joy' && balance !== null && balance < 1) ? 'not-allowed' : 'pointer',
                      background: voting || (voteModal.voteType !== 'joy' && balance !== null && balance < 1) ? 'rgba(71,85,105,0.08)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                      color: voting || (voteModal.voteType !== 'joy' && balance !== null && balance < 1) ? 'rgba(71,85,105,0.52)' : C, fontWeight: 700, fontSize: '0.875rem',
                      opacity: voting ? 0.6 : 1 }}>
                    {voting ? '提交中...' : '确认投票'}
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

      {/* Related Party Certification Modal */}
      {relatedModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 20 }}>
          <div style={{ backgroundColor: '#fffdf8', color: '#1f2937', border: '1px solid rgba(166,106,31,0.22)', borderRadius: 20, padding: 30, maxWidth: 520, width: '100%', boxShadow: '0 22px 60px rgba(17,24,39,0.22)' }}>
            {relatedDone ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>✅</div>
                <h3 style={{ fontWeight: 900, fontSize: '1.12rem', marginBottom: 8 }}>相关方认证已提交</h3>
                <p style={{ fontSize: '0.86rem', color: 'rgba(71,85,105,0.78)', lineHeight: 1.8, marginBottom: 20 }}>
                  审核通过后，这条评论会作为相关方回应置顶展示在主帖下方。认证材料只给审核员判断使用，不会公开展示。
                </p>
                <button onClick={closeRelatedCertModal}
                  style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, fontWeight: 800, cursor: 'pointer' }}>关闭</button>
              </div>
            ) : (
              <>
                <h3 style={{ fontWeight: 900, fontSize: '1.12rem', marginBottom: 8 }}>相关方认证</h3>
                <p style={{ fontSize: '0.84rem', color: 'rgba(71,85,105,0.72)', lineHeight: 1.75, marginBottom: 16 }}>
                  这不是删帖入口，是把你已经发表的评论申请为置顶回应。请提交能证明你与帖子对象有关的资料，审核通过后置顶。
                </p>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 6 }}>相关关系说明</label>
                  <textarea value={relatedNote} onChange={e => setRelatedNote(e.target.value)} rows={4}
                    placeholder="例：我是被评价本人 / 店家负责人 / 当局玩家 / 当日同行人员。请说明关系和能核验的线索。"
                    style={{ ...inputStyle, resize: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 6 }}>图片材料</label>
                  <label style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 72,
                    border: '1px dashed rgba(166,106,31,0.35)', borderRadius: 12,
                    background: 'rgba(166,106,31,0.06)', color: GOLD, cursor: relatedFiles.length >= 4 ? 'not-allowed' : 'pointer',
                    fontSize: '0.84rem', fontWeight: 800, opacity: relatedFiles.length >= 4 ? 0.55 : 1,
                  }}>
                    {uploadingRelatedFiles ? '读取图片中...' : relatedFiles.length >= 4 ? '最多上传 4 张图片' : '+ 上传截图/凭证图片（最多 4 张）'}
                    <input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={relatedFiles.length >= 4}
                      onChange={handleRelatedFileUpload} style={{ display: 'none' }} />
                  </label>
                  {relatedFiles.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 10, marginTop: 12 }}>
                      {relatedFiles.map((file, i) => (
                        <div key={`${file.name}-${i}`} style={{ border: '1px solid rgba(166,106,31,0.16)', borderRadius: 10, overflow: 'hidden', background: '#fff7ed' }}>
                          <img src={file.url} alt={file.name} style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }} />
                          <div style={{ padding: '7px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span title={file.name} style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'rgba(71,85,105,0.72)', fontSize: '0.72rem' }}>{file.name}</span>
                            <button onClick={() => removeRelatedFile(i)} style={{ border: 'none', background: 'transparent', color: RED, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 800 }}>删除</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p style={{ fontSize: '0.76rem', color: 'rgba(71,85,105,0.54)', lineHeight: 1.7, marginTop: 10 }}>
                  请先自行打码第三方手机号、微信号、身份证号等隐私信息；未打码材料可能被驳回。
                </p>
                {relatedError && <p style={{ color: RED, fontSize: '0.8rem', marginTop: 12 }}>{relatedError}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button onClick={closeRelatedCertModal}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(71,85,105,0.18)', background: '#fffaf2', color: 'rgba(71,85,105,0.74)', cursor: 'pointer', fontSize: '0.875rem' }}>取消</button>
                  <button onClick={submitRelatedCert} disabled={certifyingComment === relatedModal.commentId || (!relatedNote.trim() && relatedFiles.length === 0)}
                    style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                      cursor: certifyingComment === relatedModal.commentId || (!relatedNote.trim() && relatedFiles.length === 0) ? 'not-allowed' : 'pointer',
                      background: (!relatedNote.trim() && relatedFiles.length === 0) ? 'rgba(71,85,105,0.08)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                      color: (!relatedNote.trim() && relatedFiles.length === 0) ? 'rgba(71,85,105,0.52)' : C, fontWeight: 800, fontSize: '0.875rem', opacity: certifyingComment === relatedModal.commentId ? 0.6 : 1 }}>
                    {certifyingComment === relatedModal.commentId ? '提交中...' : '提交认证资料'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {auditModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,17,23,0.58)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 20 }}>
          <div style={{ backgroundColor: '#fffdf8', color: '#1f2937', border: '1px solid rgba(166,106,31,0.22)', borderRadius: 20, padding: 26, maxWidth: 720, width: '100%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 22px 60px rgba(17,24,39,0.24)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
              <div>
                <h3 style={{ fontWeight: 900, fontSize: '1.08rem', marginBottom: 6 }}>审计记录</h3>
                <p style={{ fontSize: '0.82rem', color: 'rgba(71,85,105,0.72)', lineHeight: 1.7, margin: 0 }}>
                  {auditModal.item.subject_name} · 每次审核通过或管理员编辑都会生成校验码。
                </p>
              </div>
              <button onClick={() => setAuditModal(null)}
                style={{ border: '1px solid rgba(71,85,105,0.14)', background: '#fffaf2', color: 'rgba(71,85,105,0.70)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}>
                关闭
              </button>
            </div>

            {auditModal.loading && (
              <p style={{ color: 'rgba(71,85,105,0.68)', fontSize: '0.84rem', padding: '24px 0' }}>审计记录加载中...</p>
            )}
            {!auditModal.loading && auditModal.error && (
              <p style={{ color: RED, fontSize: '0.84rem', padding: '18px 0' }}>{auditModal.error}</p>
            )}
            {!auditModal.loading && !auditModal.error && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(auditModal.data?.entries || []).length === 0 && (
                  <p style={{ color: 'rgba(71,85,105,0.60)', fontSize: '0.84rem', padding: '16px 0' }}>暂无审计记录。</p>
                )}
                {(auditModal.data?.entries || []).map(entry => {
                  const changes = entry.metadata?.changes || [];
                  const payload = entry.canonical_payload || {};
                  return (
                    <div key={entry.id} style={{ border: '1px solid rgba(166,106,31,0.14)', background: '#fffaf2', borderRadius: 14, padding: '13px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                        <strong style={{ color: GOLD, fontSize: '0.86rem' }}>
                          {AUDIT_EVENT_LABEL[entry.event_type] || entry.event_type}
                        </strong>
                        <span style={{ color: 'rgba(71,85,105,0.56)', fontSize: '0.74rem' }}>{formatAuditTime(entry.created_at)}</span>
                      </div>
                      {changes.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {changes.map(change => (
                            <div key={`${entry.id}-${change.field}`} style={{ fontSize: '0.8rem', color: 'rgba(31,41,55,0.82)', lineHeight: 1.7 }}>
                              <span style={{ display: 'inline-block', minWidth: 82, color: 'rgba(71,85,105,0.58)', fontWeight: 800 }}>
                                {change.label || AUDIT_FIELD_LABEL[change.field] || change.field}
                              </span>
                              <del style={{ color: 'rgba(185,28,28,0.72)', background: 'rgba(254,226,226,0.55)', padding: '1px 4px', borderRadius: 4 }}>
                                {formatAuditValue(change.field, change.before)}
                              </del>
                              <span style={{ color: 'rgba(71,85,105,0.42)', margin: '0 6px' }}>→</span>
                              <span style={{ color: '#15803d', background: 'rgba(220,252,231,0.72)', padding: '1px 4px', borderRadius: 4 }}>
                                {formatAuditValue(change.field, change.after)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'rgba(31,41,55,0.78)', lineHeight: 1.75 }}>
                          <div><strong style={{ color: 'rgba(71,85,105,0.68)' }}>对象：</strong>{formatAuditValue('subject_name', payload.subject_name)} · {formatAuditValue('type', payload.type)}</div>
                          {typeof payload.content === 'string' && (
                            <div style={{ marginTop: 5 }}><strong style={{ color: 'rgba(71,85,105,0.68)' }}>原文：</strong>{payload.content}</div>
                          )}
                        </div>
                      )}
                      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, color: 'rgba(71,85,105,0.44)', fontSize: '0.7rem' }}>
                        <span>entry {shortHash(entry.entry_hash)}</span>
                        <span>content {shortHash(entry.content_hash)}</span>
                        {entry.previous_hash && <span>prev {shortHash(entry.previous_hash)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {reportTarget && (
        <ReportModal
          targetType={reportTarget.targetType}
          targetId={reportTarget.targetId}
          targetTitle={reportTarget.targetTitle}
          authToken={getAuth()?.token || ''}
          onClose={() => setReportTarget(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
