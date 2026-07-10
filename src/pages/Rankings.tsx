import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CITIES } from '../constants/cities';
import { getJsonCached } from '../lib/apiCache';
import { readStoredCreatorAuth } from '../lib/authSession';
import {
  nextOnboardingViewCount,
  ONBOARDING_DISMISSED_KEY,
  ONBOARDING_PENDING_KEY,
  ONBOARDING_VIEW_COUNT_KEY,
  shouldShowOnboarding,
} from '../lib/postLoginFlow';
import DraftAutosaveNotice from '../components/DraftAutosaveNotice';
import ReportModal, { type ReportTargetType } from '../components/ReportModal';
import { ReputationButton, ReputationHubShell } from '../components/ReputationHubChrome';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { cityReputationTitle } from '../lib/reputationNaming';

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
  red: '红榜：记录让人觉得值得推荐、值得记住的具体事件。',
  white: '白榜：免费发帖，适合记录事实、补充线索、普通提醒，先留下公开记录。',
  black: '黑榜：记录违约、失联、骚扰、欺诈、严重服务不符等负面事件，公开期 30 天。',
};

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
  subject_dossier_id?: string | null;
  event_date?: string | null;
  event_script_name?: string | null;
  event_store_name?: string | null;
  content: string;
  author_name: string;
  is_realname: boolean;
  initial_amount: number;
  likes: number;
  dislikes: number;
  joys?: number;
  boost_amount?: number;
  negative_boost_amount?: number;
  agree_count?: number;
  oppose_count?: number;
  created_at: string;
  expires_at?: string;
  expiry_override?: string;
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

type BoostRecord = {
  id: string;
  direction: 'boost' | 'negative_boost';
  contributor_name: string;
  contributor_is_realname: boolean;
  amount: number;
  created_at: string;
  is_initial?: boolean;
};

type VoteModal = { id: string; voteType: 'like' | 'dislike' | 'joy' } | null;
type PaidBoostModal = { id: string; direction: 'boost' | 'negative_boost' } | null;
type CommentModal = { rankingId: string } | null;
type RelatedFile = { name: string; url: string; type?: string };
type RelatedCertModal = { rankingId: string; commentId: string } | null;
type ReportTarget = { targetType: ReportTargetType; targetId: string; targetTitle: string };
type RankingCommentDraft = { content: string };
type RelatedCertDraft = { note: string };
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
type BoardMode = 'reputation' | 'money';

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid rgba(31,41,55,0.08)',
  borderRadius: 8,
  padding: 14,
  boxShadow: 'none',
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

const walletChipStyle: React.CSSProperties = {
  minHeight: 34,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  border: '1px solid rgba(217,168,87,0.28)',
  background: '#fff8e8',
  color: GOLD,
  padding: '0 12px',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 900,
};

function hubToggleStyle(active: boolean, color: string): React.CSSProperties {
  return {
    minHeight: 34,
    borderRadius: 999,
    border: `1px solid ${active ? color : 'rgba(31,41,55,0.10)'}`,
    background: active ? color : (color === GOLD ? '#fff8e8' : '#fff'),
    color: active ? '#fff' : (color === GOLD ? GOLD : 'rgba(31,41,55,0.72)'),
    padding: '0 12px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
  };
}

const compactHeroStyle: React.CSSProperties = {
  minHeight: 88,
  borderRadius: 12,
  border: '1px solid rgba(31,41,55,0.08)',
  background: '#fff',
  padding: '18px 18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
};

const compactTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-serif)',
  fontSize: 'clamp(1.9rem, 3.2vw, 2.45rem)',
  lineHeight: 1.05,
  letterSpacing: 0,
};

const compactLeadStyle: React.CSSProperties = {
  margin: '6px 0 0',
  color: 'rgba(31,41,55,0.72)',
  lineHeight: 1.55,
  fontSize: 14,
  fontWeight: 700,
};

const filterBarStyle: React.CSSProperties = {
  minHeight: 54,
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap',
  padding: '10px 12px',
  borderRadius: 10,
  background: '#f8fafc',
  border: '1px solid rgba(31,41,55,0.06)',
};

const filterGroupStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const rankingGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 10, alignItems: 'start' };
const compactActionRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 7, borderTop: '1px solid rgba(31,41,55,0.06)' };
const compactActionButtonStyle: React.CSSProperties = { border: 'none', background: 'transparent', color: 'rgba(71,85,105,0.66)', cursor: 'pointer', fontSize: '0.78rem', padding: '4px 0', fontWeight: 800 };
const voteZoneGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 4, marginBottom: 5 };
const paidVoteZoneStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  borderTop: '1px solid rgba(166,106,31,0.22)',
  padding: '6px 0 2px',
};
const freeVoteZoneStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  borderTop: '1px solid rgba(39,83,137,0.16)',
  padding: '6px 0 2px',
};
const voteZoneKickerStyle: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 950 };

function getAuth(): AuthSession | null {
  const data = readStoredCreatorAuth();
  if (!data?.token) return null;
  const availableCities = Array.isArray(data.available_cities)
    ? data.available_cities.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    : [];
  const fallbackCity = String(data.city || '').trim();
  return {
    token: data.token,
    displayName: data.display_name || '用户',
    userId: data.id,
    city: fallbackCity || null,
    availableCities: availableCities.length > 0 ? availableCities : (fallbackCity ? [fallbackCity] : []),
  };
}

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function dossierUrl(item: Pick<Ranking, 'subject_name' | 'subject_type' | 'subject_city' | 'subject_dossier_id'>) {
  if (item.subject_type === 'dm' && item.subject_dossier_id) return `/dm/${encodeURIComponent(item.subject_dossier_id)}`;
  const params = new URLSearchParams({
    subjectName: item.subject_name,
    subjectType: item.subject_type,
  });
  if (item.subject_city) params.set('city', item.subject_city);
  if (item.subject_dossier_id) params.set('subjectDossierId', item.subject_dossier_id);
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

function eventTitle(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return '未命名事件';
  const firstSentence = normalized.split(/[。！？!?；;]/)[0]?.trim() || normalized;
  if (firstSentence.length <= 24) return firstSentence;
  return `${firstSentence.slice(0, 24)}...`;
}

function eventSummary(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized;
}

function eventKindCopy(type: Ranking['type']) {
  if (type === 'red') return { label: '红', color: '#8f4c43', bg: '#f8eee7', border: '#e6c7bd' };
  if (type === 'black') return { label: '黑', color: '#404a58', bg: '#f2f4f7', border: '#d7dce4' };
  return { label: '白', color: '#9b6a1e', bg: '#fffaf2', border: '#e4d4b3' };
}

function voteCopy(voteType: MyVote['vote_type'], rankingType?: Ranking['type']) {
  void rankingType;
  if (voteType === 'like') return { label: '同意', icon: '同' };
  if (voteType === 'dislike') return { label: '反对', icon: '反' };
  return { label: '欢乐', icon: '😂' };
}

function paidBoostCopy(direction: 'boost' | 'negative_boost') {
  return direction === 'negative_boost'
    ? { label: '踩榜', icon: '踩' }
    : { label: '打榜', icon: '榜' };
}

function boostAmount(item: Ranking) {
  return item.boost_amount ?? (item.type === 'black' ? 0 : item.likes || 0);
}

function negativeBoostAmount(item: Ranking) {
  return item.negative_boost_amount ?? 0;
}

function agreeCount(item: Ranking) {
  return item.agree_count ?? 0;
}

function opposeCount(item: Ranking) {
  return item.oppose_count ?? 0;
}

function applyMetricPatch(item: Ranking, data: Partial<Ranking>) {
  return {
    ...item,
    likes: data.likes ?? item.likes,
    dislikes: data.dislikes ?? item.dislikes,
    joys: data.joys ?? item.joys,
    boost_amount: data.boost_amount ?? item.boost_amount,
    negative_boost_amount: data.negative_boost_amount ?? item.negative_boost_amount,
    agree_count: data.agree_count ?? item.agree_count,
    oppose_count: data.oppose_count ?? item.oppose_count,
  };
}

function reputationScore(item: Ranking) {
  return agreeCount(item) - opposeCount(item);
}

function reputationParticipation(item: Ranking) {
  return agreeCount(item) + opposeCount(item) + (item.joys || 0);
}

function moneyScore(item: Ranking) {
  return boostAmount(item) + negativeBoostAmount(item);
}

function boardRankScore(item: Ranking, mode: BoardMode) {
  if (mode === 'money') return moneyScore(item);
  return reputationScore(item);
}

function voteRecordText(vote: VoteRecord, itemType?: Ranking['type']) {
  void itemType;
  if (vote.vote_type === 'like') return '同意';
  if (vote.vote_type === 'dislike') return '反对';
  return '欢乐';
}

function voteRecordIcon(vote: VoteRecord, itemType?: Ranking['type']) {
  void itemType;
  if (vote.vote_type === 'like') return '同';
  if (vote.vote_type === 'dislike') return '反';
  return '😂';
}

function votesToggleLabel(item: Ranking, showVotes: boolean) {
  void item;
  if (showVotes) return '收起票数';
  return '票数明细';
}

function emptyVoteRecordText(item: Ranking) {
  void item;
  return '暂无同意、反对或欢乐记录';
}

function isVoteAllowed(item: Ranking | undefined, voteType: MyVote['vote_type']) {
  if (!item) return false;
  return voteType === 'like' || voteType === 'dislike' || voteType === 'joy';
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

function paidBoostBreakdown(item: Ranking) {
  const total = boostAmount(item);
  const initial = Math.max(0, Math.trunc(Number(item.initial_amount || 0)));
  return {
    total,
    initial,
    paid: Math.max(0, total - initial),
  };
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
  const [boardMode, setBoardMode] = useState<BoardMode>('reputation');
  const [blackView, setBlackView] = useState<'active' | 'expired'>('active');
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
  const [voteCommentText, setVoteCommentText] = useState('');
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState('');
  const [paidBoostModal, setPaidBoostModal] = useState<PaidBoostModal>(null);
  const [paidBoostAmount, setPaidBoostAmount] = useState('10');
  const [paidBoostComment, setPaidBoostComment] = useState('');
  const [paidBoosting, setPaidBoosting] = useState(false);
  const [paidBoostError, setPaidBoostError] = useState('');

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
  const [openBoosts, setOpenBoosts] = useState<Set<string>>(new Set());
  const [boostsMap, setBoostsMap] = useState<Record<string, BoostRecord[]>>({});
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [auditModal, setAuditModal] = useState<AuditModal>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return shouldShowOnboarding({
        pending: localStorage.getItem(ONBOARDING_PENDING_KEY) === '1',
        dismissed: localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1',
        viewCount: localStorage.getItem(ONBOARDING_VIEW_COUNT_KEY),
      });
    } catch {
      return false;
    }
  });
  const concreteCityForReputation = city !== 'all' && city !== 'preferred' ? city : '';
  const cityReputationHref = concreteCityForReputation ? `/reputation/city?city=${encodeURIComponent(concreteCityForReputation)}` : '/reputation/city';
  const cityReputationLabel = cityReputationTitle(concreteCityForReputation);
  const commentDraftKey = commentModal ? `lc:draft:ranking-comment:${commentModal.rankingId}` : 'lc:draft:ranking-comment:none';
  const commentDraftValue = useMemo<RankingCommentDraft>(() => ({ content: commentText }), [commentText]);
  const commentDraft = useDraftAutosave<RankingCommentDraft>({
    key: commentDraftKey,
    version: 1,
    enabled: !!commentModal && !commentDone,
    value: commentDraftValue,
    shouldSave: data => !!data.content.trim(),
    onRestore: data => setCommentText(data.content || ''),
  });
  const relatedDraftKey = relatedModal ? `lc:draft:related-cert:${relatedModal.rankingId}:${relatedModal.commentId}` : 'lc:draft:related-cert:none';
  const relatedDraftValue = useMemo<RelatedCertDraft>(() => ({ note: relatedNote }), [relatedNote]);
  const relatedDraft = useDraftAutosave<RelatedCertDraft>({
    key: relatedDraftKey,
    version: 1,
    enabled: !!relatedModal && !relatedDone,
    value: relatedDraftValue,
    shouldSave: data => !!data.note.trim(),
    onRestore: data => setRelatedNote(data.note || ''),
  });

  const auth = getAuth();
  const preferredCityParam = preferredCities.join(',');

  useEffect(() => {
    if (!showOnboarding) return;
    const nextCount = nextOnboardingViewCount(localStorage.getItem(ONBOARDING_VIEW_COUNT_KEY));
    localStorage.setItem(ONBOARDING_VIEW_COUNT_KEY, String(nextCount));
  }, [showOnboarding]);

  const closeOnboarding = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
    localStorage.removeItem(ONBOARDING_PENDING_KEY);
    setShowOnboarding(false);
  };

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
        if (tab === 'black' && blackView === 'expired') params.set('expired', 'true');
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
  }, [tab, blackView, subjectTab, city, preferredCityParam, fetchWallet]);

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
      const byScore = boardRankScore(b, boardMode) - boardRankScore(a, boardMode);
      if (byScore !== 0) return byScore;
      if (boardMode === 'reputation') {
        const byParticipation = reputationParticipation(b) - reputationParticipation(a);
        if (byParticipation !== 0) return byParticipation;
      }
      if (boardMode === 'money') {
        const byNetBoost = (boostAmount(b) - negativeBoostAmount(b)) - (boostAmount(a) - negativeBoostAmount(a));
        if (byNetBoost !== 0) return byNetBoost;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [items, boardMode]);

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

  const fetchBoosts = (rankingId: string) => {
    fetch(`${API}/lc/rankings/${rankingId}/boosts`)
      .then(r => r.json())
      .then(d => { if (d.success) setBoostsMap(prev => ({ ...prev, [rankingId]: d.data || [] })); });
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

  const toggleBoosts = (id: string) => {
    const next = new Set(openBoosts);
    if (next.has(id)) next.delete(id);
    else { next.add(id); fetchBoosts(id); }
    setOpenBoosts(next);
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
	        body: JSON.stringify({
	          voteType: voteModal.voteType,
	          comment: voteCommentText.trim() || undefined,
	        }),
	      });
      const d = await r.json();
      if (d.success) {
        setItems(prev => prev.map(i => i.id === voteModal.id ? {
          ...applyMetricPatch(i, d.data),
          my_vote: d.data.myVote || null,
        } : i));
	        fetchVotes(voteModal.id);
	        if (voteCommentText.trim()) fetchComments(voteModal.id);
	        fetchWallet();
	        setVoteModal(null);
	        setVoteCommentText('');
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
          ...applyMetricPatch(i, d.data),
          my_vote: null,
        } : i));
	        fetchVotes(voteModal.id);
	        fetchWallet();
	        setVoteModal(null);
	        setVoteCommentText('');
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
        relatedDraft.clearDraft();
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
	        commentDraft.clearDraft();
	        setCommentDone(true);
	        fetchComments(commentModal.rankingId);
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
	    const confirmed = window.confirm('删除自己的评论后将不再公开显示。评论免费发布，删除不涉及退币。确认删除吗？');
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
	    } catch {
      window.alert('网络错误，请稍后再试');
    } finally {
      setDeletingComment('');
    }
  };

	  const openVoteModal = (id: string, voteType: 'like' | 'dislike' | 'joy') => {
    const current = requireAuth();
    if (!current) return;
	    const item = items.find(ranking => ranking.id === id);
		    if (!isVoteAllowed(item, voteType) && item?.my_vote?.vote_type !== voteType) {
		      window.alert('这个互动不符合当前红黑榜规则。');
		      return;
		    }
		    setVoteModal({ id, voteType });
	    setVoteCommentText('');
		    setVoteError('');
		  };

  const openPaidBoostModal = (id: string, direction: 'boost' | 'negative_boost') => {
    const current = requireAuth();
    if (!current) return;
    setPaidBoostModal({ id, direction });
    setPaidBoostAmount('10');
    setPaidBoostComment('');
    setPaidBoostError('');
    fetchWallet();
  };

  const closePaidBoostModal = () => {
    setPaidBoostModal(null);
    setPaidBoostAmount('10');
    setPaidBoostComment('');
    setPaidBoostError('');
  };

  const submitPaidBoost = async () => {
    if (!paidBoostModal) return;
    const current = requireAuth();
    if (!current) return;
    const amount = Number.parseInt(paidBoostAmount, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaidBoostError('请输入大于 0 的整数金额');
      return;
    }
    setPaidBoosting(true);
    setPaidBoostError('');
    try {
      const r = await fetch(`${API}/lc/rankings/${paidBoostModal.id}/paid-boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` },
        body: JSON.stringify({
          direction: paidBoostModal.direction,
          amount,
          comment: paidBoostComment.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setItems(prev => prev.map(i => i.id === paidBoostModal.id ? applyMetricPatch(i, d.data) : i));
        if (openBoosts.has(paidBoostModal.id)) fetchBoosts(paidBoostModal.id);
        if (paidBoostComment.trim()) fetchComments(paidBoostModal.id);
        fetchWallet();
        closePaidBoostModal();
      } else {
        setPaidBoostError(d.error || '操作失败');
      }
    } catch {
      setPaidBoostError('网络错误');
    } finally {
      setPaidBoosting(false);
    }
  };

	  const closeVoteModal = () => {
	    setVoteModal(null);
	    setVoteCommentText('');
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
        minHeight: 34,
        padding: '0 13px',
        borderRadius: 999,
        border: tab === t ? `1px solid ${color}` : '1px solid rgba(31,41,55,0.12)',
        cursor: 'pointer',
        fontWeight: 900,
        fontSize: 12,
        transition: 'all 0.2s',
        background: tab === t ? color : (t === 'white' ? '#fff8e8' : '#fff'),
        color: tab === t ? '#fff' : (t === 'white' ? GOLD : 'rgba(31,41,55,0.74)'),
        whiteSpace: 'nowrap',
      }}>{label}</button>
  );

  const renderName = (name: string, isRealname: boolean) => isRealname
    ? <><span style={{ color: GOLD, fontWeight: 700 }}>⭐ {name}</span><span style={{ color: 'rgba(201,146,46,0.5)', fontSize: '0.7rem' }}> 实名</span></>
    : name;

	  const voteModalItem = voteModal ? items.find(item => item.id === voteModal.id) : undefined;
	  const existingMyVote = voteModalItem?.my_vote || null;
	  const existingVoteCopy = existingMyVote ? voteCopy(existingMyVote.vote_type, voteModalItem?.type) : null;
	  const requestedVoteCopy = voteModal ? voteCopy(voteModal.voteType, voteModalItem?.type) : null;
	  const canCancelExistingVote = voteCanCancel(existingMyVote);
	  const isChangingVote = !!existingMyVote && !!voteModal && existingMyVote.vote_type !== voteModal.voteType;
  const paidBoostItem = paidBoostModal ? items.find(item => item.id === paidBoostModal.id) : undefined;
  const paidBoostRequestCopy = paidBoostModal ? paidBoostCopy(paidBoostModal.direction) : null;
  const paidBoostAmountNumber = Number.parseInt(paidBoostAmount, 10);
  const paidBoostAmountValid = Number.isFinite(paidBoostAmountNumber) && paidBoostAmountNumber > 0;
  const paidBoostBalanceNotEnough = paidBoostAmountValid && balance !== null && balance < paidBoostAmountNumber;
	  const showVoteCommentBox = !!voteModal;
	  const voteCommentField = showVoteCommentBox ? (
	    <div style={{ marginBottom: 14 }}>
	      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 6 }}>
	        顺带评论 <span style={{ color: 'rgba(71,85,105,0.50)', fontWeight: 600 }}>免费，可选</span>
	      </label>
	      <textarea
	        value={voteCommentText}
	        onChange={e => setVoteCommentText(e.target.value)}
	        rows={3}
	        maxLength={600}
	        placeholder="可以顺手补一句你的理由。评论会进入审核队列，不扣契约币。"
	        style={{ ...inputStyle, resize: 'none' }}
	      />
	    </div>
	  ) : null;

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: '#1f2937' }}>
      {showOnboarding && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          background: 'rgba(15,23,42,0.38)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 18,
        }}>
          <div style={{
            position: 'relative',
            width: 'min(100%, 760px)',
            maxHeight: 'calc(100svh - 28px)',
            overflowY: 'auto',
            borderRadius: 18,
            background: '#fffdf8',
            border: '1px solid rgba(166,106,31,0.18)',
            boxShadow: '0 28px 80px rgba(15,23,42,0.24)',
            padding: '22px 22px 18px',
          }}>
            <button
              type="button"
              onClick={closeOnboarding}
              aria-label="关闭新手教程"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 32,
                height: 32,
                borderRadius: 999,
                border: '1px solid rgba(166,106,31,0.16)',
                background: '#fffaf2',
                color: 'rgba(71,85,105,0.72)',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
            <p style={{ color: GOLD, fontWeight: 900, fontSize: '0.76rem', marginBottom: 8 }}>新手教程</p>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.36rem', marginBottom: 8 }}>
              先看这里，灵契最热闹的是口碑
            </h2>
            <p style={{ color: 'rgba(71,85,105,0.74)', fontSize: '0.88rem', lineHeight: 1.75, marginBottom: 14 }}>
              你已经有登录账号了。登录账号是手机号或邮箱；昵称只是公开展示名。这里可以看红黑白榜、给剧本/角色/店家/DM/玩家沉淀口碑，也可以以后再慢慢补个人主页。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                ['红黑白榜', '红榜夸好事，黑榜记录风险，白榜放事实、笑话和普通线索。'],
                ['口碑榜 / 真金榜', '口碑榜看一人一票，真金榜看真实打榜值，两套榜单分开看。'],
                ['万物皆可评分', '剧本、角色、DM、店家、玩家、圈内行为都可以继续沉淀 tag 和评价。'],
                ['公开内容会审核', '证据首次提交选填；审核需要时会要求补充，涉及第三方隐私必须打码。'],
              ].map(([title, desc]) => (
                <div key={title} style={{ padding: '11px 12px', borderRadius: 12, background: 'rgba(255,250,242,0.92)', border: '1px solid rgba(166,106,31,0.12)' }}>
                  <p style={{ fontWeight: 900, fontSize: '0.86rem', marginBottom: 4 }}>{title}</p>
                  <p style={{ color: 'rgba(71,85,105,0.66)', fontSize: '0.78rem', lineHeight: 1.65 }}>{desc}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: 'rgba(71,85,105,0.54)', fontSize: '0.76rem' }}>本提示最多自动出现 3 次，关闭后不再打扰。</span>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => { closeOnboarding(); navigate('/dashboard'); }} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(166,106,31,0.16)', background: '#fff', color: '#925f18', fontWeight: 850, cursor: 'pointer' }}>
                  设置个人主页
                </button>
                <Link onClick={closeOnboarding} to="/rankings/new" style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(166,106,31,0.16)', background: '#fff', color: '#925f18', fontWeight: 850, textDecoration: 'none' }}>
                  发布口碑
                </Link>
                <button type="button" onClick={closeOnboarding} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${GOLD}, #c9922e)`, color: '#fffdf8', fontWeight: 900, cursor: 'pointer' }}>
                  先看榜
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ReputationHubShell
        active="rankings"
        cityTitle={cityReputationLabel}
        cityHref={cityReputationHref}
        currentLabel="红黑榜"
        actions={(
          <>
            {auth && (
              <Link to="/wallet" style={walletChipStyle}>
                {walletLoading ? '契约币 ...' : `契约币 ${balance || 0}`}
              </Link>
            )}
            <ReputationButton to="/rankings/new">发布评价</ReputationButton>
          </>
        )}
      >
        <section style={compactHeroStyle}>
          <div>
            <h1 style={compactTitleStyle}>灵契·红黑榜</h1>
            <p style={compactLeadStyle}>红黑榜是评分榜的事件媒介。口碑票看真实人数，真金打榜看契约币加权；两套数据分开判断。</p>
          </div>
          <div style={filterGroupStyle}>
            <button onClick={() => setBoardMode('reputation')} style={hubToggleStyle(boardMode === 'reputation', '#275389')}>口碑榜</button>
            <button onClick={() => setBoardMode('money')} style={hubToggleStyle(boardMode === 'money', GOLD)}>真金榜</button>
            <ReputationButton to="/rankings/new">发布评价</ReputationButton>
          </div>
        </section>

        <section style={filterBarStyle}>
          <div style={filterGroupStyle}>
            {tabBtn('red', '红', '#9a3412')}
            {tabBtn('white', '白', '#d9a857')}
            {tabBtn('black', '黑', '#1f2937')}
          </div>
          <div style={filterGroupStyle}>
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
            <FilterPill active={subjectTab === 'all'} onClick={() => setSubjectTab('all')}>全部对象</FilterPill>
            {SUBJECT_TYPES.map(st => (
              <FilterPill key={st} active={subjectTab === st} onClick={() => setSubjectTab(st)}>
                {SUBJECT_LABEL[st]}
              </FilterPill>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.76rem', lineHeight: 1.7 }}>
            {TAB_HINT[tab]} {boardMode === 'reputation'
              ? '口碑榜按口碑票排序，优先看一人一票的真实参与人数。'
              : '真金榜按付费打榜和踩榜排序，只代表契约币加权热度。'}
          </span>
          {tab === 'black' && (
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <FilterPill active={blackView === 'active'} onClick={() => setBlackView('active')}>公开中</FilterPill>
              <FilterPill active={blackView === 'expired'} onClick={() => setBlackView('expired')}>已过期</FilterPill>
            </span>
          )}
          <details style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.76rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 800, color: GOLD }}>规则与发布责任</summary>
            <div style={{
              marginTop: 8,
              padding: '10px 12px',
              borderRadius: 10,
              background: '#fffdf8',
              border: '1px solid rgba(166,106,31,0.14)',
              color: 'rgba(31,41,55,0.78)',
              lineHeight: 1.7,
              maxWidth: 860,
            }}>
              主帖证据首次提交选填；审核员认为内容不足时可以打回并要求补充。涉及第三方隐私的信息请先打码。口碑票一人一票，可改票；真金打榜和踩榜按实际契约币金额累计，影响热度，不代表平台事实裁判。发布者对事实、证据、隐私打码和言论后果负责。
            </div>
          </details>
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
              {subjectTab !== 'all'
                ? `${SUBJECT_LABEL[subjectTab] || subjectTab}暂无内容`
                : (tab === 'red' ? '暂无红榜记录' : tab === 'black' ? (blackView === 'expired' ? '暂无已过期黑榜记录' : '暂无黑榜记录') : '暂无白榜记录')}
            </p>
            <Link to="/rankings/new" style={{ color: GOLD, fontSize: '0.875rem', textDecoration: 'underline' }}>
              成为第一个发布的人
            </Link>
          </div>
        )}

        {!loading && !error && rankedItems.length > 0 && (
          <div style={rankingGridStyle}>
            {rankedItems.map((item, idx) => {
              const accentColor = item.type === 'red' ? '#b91c1c' : item.type === 'black' ? BLK : GOLD;
              const subtleAccentBg = item.type === 'red' ? 'rgba(185,28,28,0.08)' : item.type === 'black' ? 'rgba(148,163,184,0.10)' : 'rgba(166,106,31,0.10)';
              const subtleAccentBorder = item.type === 'red' ? 'rgba(185,28,28,0.16)' : item.type === 'black' ? 'rgba(148,163,184,0.20)' : 'rgba(166,106,31,0.24)';
              const loadedComments = commentsMap[item.id];
              const comments = loadedComments || item.pinned_comments || [];
              const pinnedComments = (loadedComments || item.pinned_comments || []).filter(c => c.is_pinned);
              const normalComments = (loadedComments || []).filter(c => !c.is_pinned);
              const votes = votesMap[item.id] || [];
              const boosts = boostsMap[item.id] || [];
              const showComments = openComments.has(item.id);
              const showVotes = openVotes.has(item.id);
              const showBoosts = openBoosts.has(item.id);
              const left = daysLeft(item);
              const myVote = item.my_vote || null;
              const boostStats = paidBoostBreakdown(item);
              const kind = eventKindCopy(item.type);
              const heading = eventTitle(item.content);
              const summary = eventSummary(item.content);
              const currentBoardScore = boardRankScore(item, boardMode);

              return (
                <div key={item.id}
                  className="content-card"
                  style={{
                    ...card,
                    position: 'relative',
                    overflow: 'hidden',
                    paddingLeft: 16,
                    paddingRight: 16,
                    borderColor: subtleAccentBorder,
                  }}>
                  {(item.type === 'red' || item.type === 'white') && (
                    <div aria-hidden="true" style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 5,
                      background: item.type === 'red' ? '#d5a29a' : '#d9b56d',
                    }} />
                  )}
                  {item.type === 'black' && (
                    <div aria-hidden="true" style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 5,
                      background: '#626b78',
                    }} />
                  )}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 9 }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: kind.bg,
                        border: `1px solid ${kind.border}`,
                        color: kind.color,
                        fontSize: '0.68rem',
                        fontWeight: 950,
                        whiteSpace: 'nowrap',
                      }}>{kind.label}</span>
                      <span style={{
                        padding: '1px 7px',
                        borderRadius: 999,
                        background: subtleAccentBg,
                        border: `1px solid ${subtleAccentBorder}`,
                        color: accentColor,
                        fontSize: '0.64rem',
                        fontWeight: 900,
                        marginLeft: 'auto',
                      }}>{boardMode === 'reputation' ? '口碑' : '真金'} #{idx + 1} · {currentBoardScore}</span>
                    </div>
                    <div style={{ marginBottom: summary ? 6 : 0 }}>
                      <Link to={dossierUrl(item)}
                        style={{ display: 'inline', color: 'rgba(31,41,55,0.94)', fontSize: '1.12rem', lineHeight: 1.3, fontWeight: 950, textDecoration: 'none', overflowWrap: 'anywhere' }}
                        onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(31,41,55,0.94)')}>
                        {item.subject_name}
                      </Link>
                      <span style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.7rem', fontWeight: 760 }}>
                        {' · '}{SUBJECT_LABEL[item.subject_type] || item.subject_type}{item.subject_city ? ` · ${item.subject_city}` : ''}
                      </span>
                    </div>
                    {summary && (
                      <p style={{
                        fontSize: '0.9rem',
                        color: 'rgba(31,41,55,0.92)',
                        lineHeight: 1.6,
                        margin: '0',
                        fontWeight: 650,
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        overflow: 'hidden',
                      }}>
                        {renderContent(summary)}
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        color: 'rgba(71,85,105,0.64)',
                        fontSize: '0.7rem',
                        fontWeight: 760,
                        }}>
                        发布人 {renderName(item.author_name, item.is_realname)}
                      </span>
                      {item.lc_profiles?.verified_shop && (
                        <span style={{ padding: '1px 5px', borderRadius: 999, fontSize: '0.62rem', fontWeight: 900, background: '#3b82f6', color: '#fff' }} title="已认证店家">蓝V</span>
                      )}
                      {item.lc_profiles?.verified_dm && (
                        <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: '0.62rem', fontWeight: 800, background: 'linear-gradient(135deg, #d9a857, #b8860b)', color: '#0F1117' }} title="已认证DM">DM</span>
                      )}
                      {item.subject_url && (
                        <a href={normalizeUrl(item.subject_url)} target="_blank" rel="noreferrer"
                          style={{ fontSize: '0.7rem', color: GOLD, textDecoration: 'none' }}>主页 ↗</a>
                      )}
                      {left !== null && left !== undefined && (
                        <span style={{
                          padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 750,
                          background: left <= 7 ? 'rgba(248,113,113,0.12)' : 'rgba(148,163,184,0.1)',
                          color: left <= 7 ? '#8f3732' : 'rgba(71,85,105,0.62)',
                        }}>
                          ⏳ {left <= 0 ? '已到期' : `剩余 ${left} 天`}
                        </span>
                      )}
                      {item.expiry_override && (
                        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 750,
                          background: 'rgba(201,146,46,0.12)', color: GOLD }}>
                          {item.expiry_override === 'illegal' ? '⚠ 违规记录永久保留' : '🔥 高赞豁免'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={voteZoneGridStyle}>
                    <div style={paidVoteZoneStyle}>
                      <span style={{ ...voteZoneKickerStyle, color: GOLD }}>真金打榜</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 auto', flexWrap: 'wrap' }}>
                        <button onClick={() => openPaidBoostModal(item.id, 'boost')}
                          aria-label={`给事件「${heading}」打榜`}
                          style={{ ...compactActionButtonStyle, color: boostStats.total > 0 ? GOLD : 'rgba(71,85,105,0.66)', fontSize: '0.84rem' }}>
                          打榜 {boostStats.total}
                        </button>
                        <button onClick={() => openPaidBoostModal(item.id, 'negative_boost')}
                          aria-label={`给事件「${heading}」踩榜`}
                          style={{ ...compactActionButtonStyle, color: negativeBoostAmount(item) > 0 ? '#475569' : 'rgba(71,85,105,0.66)', fontSize: '0.84rem' }}>
                          踩榜 {negativeBoostAmount(item)}
                        </button>
                        <button type="button" onClick={() => toggleBoosts(item.id)} style={{ ...compactActionButtonStyle, marginLeft: 'auto' }}>
                          {showBoosts ? '收起记录' : '打榜记录'}
                        </button>
                      </div>
                    </div>
                    <div style={freeVoteZoneStyle}>
                      <span style={{ ...voteZoneKickerStyle, color: '#275389' }}>口碑票</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 auto', flexWrap: 'wrap' }}>
                        <button onClick={() => openVoteModal(item.id, 'like')}
                          style={{ ...compactActionButtonStyle, color: myVote?.vote_type === 'like' ? '#8f3732' : 'rgba(71,85,105,0.66)', fontSize: '0.84rem' }}>
                          {myVote?.vote_type === 'like' ? '已同意' : '同意'} {agreeCount(item)}
                        </button>
                        <button onClick={() => openVoteModal(item.id, 'joy')}
                          style={{ ...compactActionButtonStyle, color: myVote?.vote_type === 'joy' ? GOLD : 'rgba(71,85,105,0.66)', fontSize: '0.84rem' }}>
                          欢乐 {item.joys || 0}
                        </button>
                        <button onClick={() => openVoteModal(item.id, 'dislike')}
                          style={{ ...compactActionButtonStyle, color: myVote?.vote_type === 'dislike' ? '#303846' : 'rgba(71,85,105,0.66)', fontSize: '0.84rem' }}>
                          {myVote?.vote_type === 'dislike' ? '已反对' : '反对'} {opposeCount(item)}
                        </button>
                      </div>
                    </div>
                  </div>

                  {showBoosts && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, paddingBottom: 12 }}>
                      {boosts.length === 0 ? (
                        <span style={{ fontSize: '0.74rem', color: 'rgba(71,85,105,0.48)' }}>暂无真金白银记录</span>
                      ) : boosts.map(record => (
                        <span key={record.id} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '4px 9px',
                          borderRadius: 999,
                          border: record.direction === 'negative_boost' ? '1px solid rgba(48,56,70,0.18)' : '1px solid rgba(143,55,50,0.18)',
                          background: record.direction === 'negative_boost' ? 'rgba(71,85,105,0.07)' : 'rgba(201,120,112,0.10)',
                          color: record.direction === 'negative_boost' ? '#303846' : '#8f3732',
                          fontSize: '0.72rem',
                          fontWeight: 850,
                        }}>
                          {record.direction === 'negative_boost' ? '踩榜' : (record.is_initial ? '初始' : '打榜')} {record.amount}
                          <span style={{ color: 'rgba(71,85,105,0.58)', fontWeight: 750 }}>
                            · {record.contributor_is_realname ? `⭐ ${record.contributor_name}` : record.contributor_name}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}

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
                              onClick={() => openReportModal({ targetType: 'comment', targetId: c.id, targetTitle: `${heading} 的置顶回应` })}
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

                  <div style={compactActionRowStyle}>
                    <button onClick={() => toggleComments(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(71,85,105,0.68)', fontSize: '0.8rem', padding: '4px 0' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(71,85,105,0.68)')}>
                      💬 {showComments ? '收起评论' : `评论 ${comments.length}`}
                    </button>
	                    <button onClick={() => openCommentModal(item.id)}
	                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(71,85,105,0.68)', fontSize: '0.8rem', padding: '4px 0' }}
	                      onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
	                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(71,85,105,0.68)')}>写评论</button>
                    <button onClick={() => toggleVotes(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(71,85,105,0.68)', fontSize: '0.8rem', padding: '4px 0' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(71,85,105,0.68)')}>
                        {votesToggleLabel(item, showVotes)}
                    </button>
                    <button
                      onClick={() => openReportModal({ targetType: 'ranking', targetId: item.id, targetTitle: heading })}
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
                    {(item.event_date || item.event_script_name || item.event_store_name) && (
                      <div style={{ color: 'rgba(71,85,105,0.66)', fontSize: '0.76rem', fontWeight: 720, marginBottom: 10 }}>
                        事件背景：{[item.event_date, item.event_script_name, item.event_store_name].filter(Boolean).join(' · ')}
                      </div>
                    )}

                  {showVotes && (
                    <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {votes.length === 0 ? (
                        <span style={{ fontSize: '0.78rem', color: 'rgba(71,85,105,0.48)' }}>{emptyVoteRecordText(item)}</span>
                      ) : votes.map(v => (
                        <span key={v.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '4px 10px', borderRadius: 999, fontSize: '0.74rem',
                          color: v.vote_type === 'like' ? '#34d399' : v.vote_type === 'dislike' ? RED : GOLD,
                          background: v.vote_type === 'like' ? 'rgba(52,211,153,0.08)' : v.vote_type === 'dislike' ? 'rgba(248,113,113,0.08)' : 'rgba(217,168,87,0.10)',
                          border: `1px solid ${v.vote_type === 'like' ? 'rgba(52,211,153,0.18)' : v.vote_type === 'dislike' ? 'rgba(248,113,113,0.18)' : 'rgba(166,106,31,0.18)'}`,
	                        }}>{voteRecordIcon(v, item.type)} {voteRecordText(v, item.type)} · {v.voter_is_realname ? `⭐ ${v.voter_name}` : v.voter_name}</span>
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
                              onClick={() => openReportModal({ targetType: 'comment', targetId: c.id, targetTitle: `${heading} 的评论` })}
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
        </div>
      </ReputationHubShell>

      {/* Free Vote Modal */}
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
                  每个账号对同一条内容只能保留一张口碑票。当前账号：<strong style={{ color: GOLD }}>{auth?.displayName || '当前账号'}</strong>。
                </p>
                <div style={{ border: '1px solid rgba(166,106,31,0.16)', background: '#fffaf2', borderRadius: 12, padding: '12px 14px', marginBottom: 14, color: 'rgba(71,85,105,0.78)', fontSize: '0.82rem', lineHeight: 1.7 }}>
                  {isChangingVote
                    ? <>{existingVoteCopy.label}和{requestedVoteCopy?.label}互改免费，只调整公开态度方向。</>
                    : canCancelExistingVote
                      ? <>24 小时内可以撤销。口碑票撤销不涉及退币。截止：{voteDeadlineText(existingMyVote)}</>
                      : <>这票已经超过 24 小时撤销期，只保留公开态度记录。</>}
                </div>
                {isChangingVote && voteCommentField}
                {voteError && <p style={{ color: RED, fontSize: '0.8rem', marginBottom: 12 }}>{voteError}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={closeVoteModal}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(71,85,105,0.18)', background: '#fffaf2', color: 'rgba(71,85,105,0.74)', cursor: 'pointer', fontSize: '0.875rem' }}>
                    关闭
                  </button>
                  {isChangingVote ? (
                    <button onClick={submitVote} disabled={voting}
                      style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', cursor: voting ? 'not-allowed' : 'pointer', background: voting ? 'rgba(71,85,105,0.08)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: voting ? 'rgba(71,85,105,0.52)' : C, fontWeight: 800, fontSize: '0.875rem', opacity: voting ? 0.6 : 1 }}>
                      {voting ? '改票中...' : `改为${requestedVoteCopy?.label || '此票'}`}
                    </button>
                  ) : (
                    <button onClick={cancelVote} disabled={voting || !canCancelExistingVote}
                    style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', cursor: voting || !canCancelExistingVote ? 'not-allowed' : 'pointer', background: voting || !canCancelExistingVote ? 'rgba(71,85,105,0.08)' : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: voting || !canCancelExistingVote ? 'rgba(71,85,105,0.52)' : '#fff', fontWeight: 800, fontSize: '0.875rem', opacity: voting ? 0.6 : 1 }}>
                    {voting ? '撤销中...' : canCancelExistingVote ? '撤销态度' : '不可撤销'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>
                  {requestedVoteCopy?.icon} {requestedVoteCopy?.label} · 免费
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(71,85,105,0.80)', lineHeight: 1.7, marginBottom: 12 }}>
                  以 <strong style={{ color: GOLD }}>{auth?.displayName || '当前账号'}</strong> 的身份投口碑票。一人一票，可以顺带写一条评论。
                </p>
                {voteCommentField}
                {voteError && <p style={{ color: RED, fontSize: '0.8rem', marginBottom: 12 }}>{voteError}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={closeVoteModal}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(71,85,105,0.18)', background: '#fffaf2', color: 'rgba(71,85,105,0.74)', cursor: 'pointer', fontSize: '0.875rem' }}>取消</button>
                  <button onClick={submitVote} disabled={voting}
                    style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', cursor: voting ? 'not-allowed' : 'pointer', background: voting ? 'rgba(71,85,105,0.08)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: voting ? 'rgba(71,85,105,0.52)' : C, fontWeight: 700, fontSize: '0.875rem', opacity: voting ? 0.6 : 1 }}>
                    {voting ? '提交中...' : '确认态度'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Paid Boost Modal */}
      {paidBoostModal && paidBoostRequestCopy && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: '#fffdf8', color: '#1f2937', border: '1px solid rgba(166,106,31,0.22)', borderRadius: 20, padding: 32, maxWidth: 440, width: '100%', boxShadow: '0 22px 60px rgba(17,24,39,0.22)' }}>
            <h3 style={{ fontWeight: 900, fontSize: '1.16rem', marginBottom: 8 }}>
              {paidBoostRequestCopy.icon} {paidBoostRequestCopy.label}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(71,85,105,0.80)', lineHeight: 1.7, marginBottom: 14 }}>
              {paidBoostItem?.content ? `给事件「${eventTitle(paidBoostItem.content)}」` : '给这条事件'}投入契约币。金额按实际输入累计，没有单次 1 币限制。
            </p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'rgba(71,85,105,0.82)', marginBottom: 6 }}>契约币数量</label>
              <input
                value={paidBoostAmount}
                onChange={e => setPaidBoostAmount(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                placeholder="输入金额"
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {[10, 50, 100, 500].map(amount => (
                  <button key={amount} type="button" onClick={() => setPaidBoostAmount(String(amount))}
                    style={{ padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(166,106,31,0.18)', background: '#fffaf2', color: GOLD, cursor: 'pointer', fontSize: '0.76rem', fontWeight: 800 }}>
                    {amount}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 6 }}>
                顺带评论 <span style={{ color: 'rgba(71,85,105,0.50)', fontWeight: 600 }}>免费，可选</span>
              </label>
              <textarea
                value={paidBoostComment}
                onChange={e => setPaidBoostComment(e.target.value)}
                rows={3}
                maxLength={600}
                placeholder="可以补一句为什么打榜或踩榜。评论会进入审核队列。"
                style={{ ...inputStyle, resize: 'none' }}
              />
            </div>
            <p style={{ fontSize: '0.85rem', color: paidBoostBalanceNotEnough ? RED : '#219669', lineHeight: 1.7, marginBottom: 12 }}>
              当前契约币：{walletLoading ? '...' : balance ?? 0} {paidBoostBalanceNotEnough && <Link to="/wallet" style={{ color: GOLD }}>（契约币不足，去充值）</Link>}
            </p>
            {paidBoostError && <p style={{ color: RED, fontSize: '0.8rem', marginBottom: 12 }}>{paidBoostError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closePaidBoostModal}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(71,85,105,0.18)', background: '#fffaf2', color: 'rgba(71,85,105,0.74)', cursor: 'pointer', fontSize: '0.875rem' }}>取消</button>
              <button onClick={submitPaidBoost} disabled={paidBoosting || !paidBoostAmountValid || paidBoostBalanceNotEnough}
                style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', cursor: paidBoosting || !paidBoostAmountValid || paidBoostBalanceNotEnough ? 'not-allowed' : 'pointer', background: paidBoosting || !paidBoostAmountValid || paidBoostBalanceNotEnough ? 'rgba(71,85,105,0.08)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: paidBoosting || !paidBoostAmountValid || paidBoostBalanceNotEnough ? 'rgba(71,85,105,0.52)' : C, fontWeight: 850, fontSize: '0.875rem', opacity: paidBoosting ? 0.6 : 1 }}>
                {paidBoosting ? '提交中...' : `确认${paidBoostRequestCopy.label}`}
              </button>
            </div>
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
	                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>发表评论 · 免费</h3>
	                <p style={{ fontSize: '0.82rem', color: 'rgba(71,85,105,0.70)', marginBottom: 16 }}>
	                  以 <strong style={{ color: GOLD }}>{auth?.displayName || '当前账号'}</strong> 的身份评论，评论免费，审核通过后公开显示。
	                </p>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(71,85,105,0.82)', marginBottom: 6 }}>评论内容 <span style={{ color: RED }}>*</span></label>
                  <div style={{ marginBottom: 10 }}>
                    <DraftAutosaveNotice
                      savedAt={commentDraft.savedAt}
                      restoredAt={commentDraft.restoredAt}
                      error={commentDraft.error}
                      note="这条评论会自动保存到当前浏览器。"
                    />
                  </div>
                  <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="写下你的看法..." rows={4} style={{ ...inputStyle, resize: 'none' }} />
                </div>
                {commentError && <p style={{ color: RED, fontSize: '0.8rem', marginTop: 12 }}>{commentError}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setCommentModal(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(71,85,105,0.18)', background: '#fffaf2', color: 'rgba(71,85,105,0.74)', cursor: 'pointer', fontSize: '0.875rem' }}>取消</button>
	                  <button onClick={submitComment} disabled={!commentText.trim() || submittingComment}
	                    style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none',
	                      cursor: commentText.trim() && !submittingComment ? 'pointer' : 'not-allowed',
	                      background: commentText.trim() ? `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)` : 'rgba(71,85,105,0.08)',
	                      color: commentText.trim() ? C : 'rgba(71,85,105,0.52)', fontWeight: 700, fontSize: '0.875rem' }}>
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
                  <div style={{ marginBottom: 10 }}>
                    <DraftAutosaveNotice
                      savedAt={relatedDraft.savedAt}
                      restoredAt={relatedDraft.restoredAt}
                      error={relatedDraft.error}
                      note="相关关系说明会自动保存到当前浏览器；图片材料不会保存，刷新后需要重新上传。"
                    />
                  </div>
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
