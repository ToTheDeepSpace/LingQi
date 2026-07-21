import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CITIES } from '../constants/cities';
import { getJsonCached } from '../lib/apiCache';
import ProfileNameLink from '../components/ProfileNameLink';
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
import { ReputationHubShell } from '../components/ReputationHubChrome';
import { JumuluCompactHeader } from '../components/JumuluPageChrome';
import { jumuluFilterPanelStyle, jumuluPrimaryLinkStyle } from '../styles/jumuluPageStyles';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { cityReputationTitle } from '../lib/reputationNaming';

const API = '/api';
const C = '#f6efe4';
const GOLD = '#a66a1f';
const RED = '#f87171';

const SUBJECT_LABEL: Record<string, string> = {
  creator: '委托师',
  dm: '卡司',
  store: '店家',
  takeaway: '外卖',
  player: '玩家',
};

const SUBJECT_TYPES = ['creator', 'dm', 'store', 'takeaway', 'player'] as const;
const POPULAR_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '重庆', '武汉', '南京', '长沙', '西安', '天津'];
const RANKING_CITY_STORAGE_PREFIX = 'lc:rankings:last-city';
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
  display_files?: Array<{ name: string; url: string; type?: string; size?: number }>;
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
  last_activity_at?: string | null;
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

type VoteModal = { id: string; voteType: 'like' | 'dislike' | 'joy' } | null;
type CommentModal = { rankingId: string } | null;
type RelatedFile = { name: string; url: string; type?: string };
type RelatedCertModal = { rankingId: string; commentId: string } | null;
type ReportTarget = { targetType: ReportTargetType; targetId: string; targetTitle: string };
type RankingCommentDraft = { content: string };
type RelatedCertDraft = { note: string };
type AuditChange = { field: string; label?: string };
type AuditEntry = {
  id: string;
  event_type: string;
  content_hash: string;
  previous_hash?: string | null;
  entry_hash: string;
  chain_date: string;
  created_at: string;
  metadata?: {
    changed_fields?: string[];
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
type FeedMode = 'latest' | 'discussed';

function rankingCityStorageKey(userId?: string) {
  return `${RANKING_CITY_STORAGE_PREFIX}:${userId || 'guest'}`;
}

function readStoredRankingCity(userId?: string) {
  try {
    return localStorage.getItem(rankingCityStorageKey(userId)) || '';
  } catch {
    return '';
  }
}

function storeRankingCity(city: string, userId?: string) {
  try {
    localStorage.setItem(rankingCityStorageKey(userId), city);
  } catch {
    // Browser storage is optional; the current selection still works in memory.
  }
}

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

const filterBarStyle: React.CSSProperties = {
  ...jumuluFilterPanelStyle,
  minHeight: 52,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
};

const filterGroupStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const rankingGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 10, alignItems: 'start' };
const rankingThumbLinkStyle: React.CSSProperties = { position: 'relative', display: 'block', width: 82, maxWidth: '28%', marginTop: 7, textDecoration: 'none' };
const rankingThumbStyle: React.CSSProperties = { display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 7, border: '1px solid rgba(31,41,55,0.1)', background: '#f8fafc' };
const rankingThumbCountStyle: React.CSSProperties = { position: 'absolute', right: 5, bottom: 5, padding: '2px 5px', borderRadius: 5, background: 'rgba(17,24,39,0.72)', color: '#fff', fontSize: 10, fontWeight: 800 };
const compactActionRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 7, borderTop: '1px solid rgba(31,41,55,0.06)' };
const compactActionButtonStyle: React.CSSProperties = { border: 'none', background: 'transparent', color: 'rgba(71,85,105,0.66)', cursor: 'pointer', fontSize: '0.78rem', padding: '4px 0', fontWeight: 800 };
const overflowActionStyle: React.CSSProperties = { border: 'none', borderRadius: 5, background: 'transparent', color: 'rgba(31,41,55,0.72)', cursor: 'pointer', padding: '7px 8px', textAlign: 'left', fontSize: '0.74rem', fontWeight: 750 };
const commentMinorActionStyle: React.CSSProperties = { border: 'none', background: 'transparent', color: 'rgba(39,83,137,0.72)', cursor: 'pointer', padding: 0, fontSize: '0.68rem', fontWeight: 760 };
const freeVoteZoneStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  borderTop: '1px solid rgba(39,83,137,0.16)',
  padding: '6px 0 2px',
};

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
  const firstBreak = normalized.search(/[。！？!?；;]/);
  if (firstBreak < 0) return '';
  return normalized.slice(firstBreak + 1).trim();
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mobilePanelTop, setMobilePanelTop] = useState(0);
  const cityLabel = city === 'preferred'
    ? `我的城市${preferredCities.length > 0 ? `：${preferredCities.slice(0, 2).join('、')}${preferredCities.length > 2 ? '等' : ''}` : ''}`
    : city === 'all' ? '全部城市' : city;

  useEffect(() => {
    if (!open) return;
    const updatePanelTop = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setMobilePanelTop(Math.min(window.innerHeight - 96, Math.max(12, rect.bottom + 8)));
    };
    updatePanelTop();
    window.addEventListener('resize', updatePanelTop);
    window.addEventListener('scroll', updatePanelTop, true);
    return () => {
      window.removeEventListener('resize', updatePanelTop);
      window.removeEventListener('scroll', updatePanelTop, true);
    };
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} onClick={onToggle}
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
          <div className="ranking-city-panel" style={{
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
            '--ranking-city-panel-top': `${mobilePanelTop}px`,
          } as React.CSSProperties & { '--ranking-city-panel-top': string }}
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
            <div className="ranking-city-scroll" style={{ ...cityPanelScroll, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4 }}>
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
  const initialAuth = getAuth();
  const initialPreferredCities = initialAuth?.availableCities || [];
  const storedCity = readStoredRankingCity(initialAuth?.userId);
  const [tab, setTab] = useState<'red' | 'black' | 'white'>('red');
  const [feedMode, setFeedMode] = useState<FeedMode>('latest');
  const [blackView, setBlackView] = useState<'active' | 'expired'>('active');
  const [subjectTab, setSubjectTab] = useState<string>('all');
  const [city, setCity] = useState(storedCity || (initialPreferredCities.length > 0 ? 'preferred' : 'all'));
  const [preferredCities, setPreferredCities] = useState<string[]>(initialPreferredCities);
  const [cityTouched, setCityTouched] = useState(Boolean(storedCity));
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [items, setItems] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mentionMap, setMentionMap] = useState<Record<string, string>>({});

  const [voteModal, setVoteModal] = useState<VoteModal>(null);
  const [voteCommentText, setVoteCommentText] = useState('');
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
    fetch(`${API}/lc/follows`, { headers: { Authorization: `Bearer ${current.token}` } })
      .then(r => r.json())
      .then(d => {
        if (!alive || !d.success) return;
        const nextCities = Array.isArray(d.data?.cities)
          ? d.data.cities.map((item: unknown) => String(item || '').trim()).filter(Boolean)
          : [];
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
      try {
        const params = new URLSearchParams({ type: tab });
        params.set('sort', feedMode);
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
  }, [tab, blackView, subjectTab, city, preferredCityParam, feedMode]);

  const setCityAndClose = (nextCity: string) => {
    setCityTouched(true);
    setCity(nextCity);
    storeRankingCity(nextCity, getAuth()?.userId);
    setCityOpen(false);
    setCityQuery('');
  };

  const cityOptions = useMemo(() => {
    const q = cityQuery.trim();
    if (!q) return CITIES;
    return CITIES.filter(c => c.includes(q));
  }, [cityQuery]);

  const rankedItems = items;

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

  const toggleComments = (id: string) => {
    const next = new Set(openComments);
    if (next.has(id)) next.delete(id);
    else { next.add(id); fetchComments(id); }
    setOpenComments(next);
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
	        if (voteCommentText.trim()) fetchComments(voteModal.id);
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
  const commentsViewerId = Array.from(openComments)[0] || '';
  const commentsViewerItem = commentsViewerId ? items.find(item => item.id === commentsViewerId) : undefined;
  const commentsViewerComments = commentsViewerId ? commentsMap[commentsViewerId] || [] : [];
	  const existingMyVote = voteModalItem?.my_vote || null;
	  const existingVoteCopy = existingMyVote ? voteCopy(existingMyVote.vote_type, voteModalItem?.type) : null;
	  const requestedVoteCopy = voteModal ? voteCopy(voteModal.voteType, voteModalItem?.type) : null;
	  const canCancelExistingVote = voteCanCancel(existingMyVote);
	  const isChangingVote = !!existingMyVote && !!voteModal && existingMyVote.vote_type !== voteModal.voteType;
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
	        placeholder="可以顺手补一句你的理由。评论会进入审核队列，不扣榜金。"
	        style={{ ...inputStyle, resize: 'none' }}
	      />
	    </div>
	  ) : null;

  return (
    <div style={{ backgroundColor: '#fffdf8', minHeight: '100vh', color: '#1f2937' }}>
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
              先看这里，剧幕录最热闹的是口碑
            </h2>
            <p style={{ color: 'rgba(71,85,105,0.74)', fontSize: '0.88rem', lineHeight: 1.75, marginBottom: 14 }}>
              你已经有登录账号了。登录账号是手机号或邮箱；昵称只是公开展示名。这里可以看红黑白榜、给剧本/角色/店家/DM/玩家沉淀口碑，也可以以后再慢慢补个人主页。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                ['红黑白榜', '红榜夸好事，黑榜记录风险，白榜放事实、笑话和普通线索。'],
                ['事件与档案分开', '事件榜看最近发生的事；搜索某位 DM 时，到其档案看长期评分和全部关联事件。'],
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
      >
        <JumuluCompactHeader
          eyebrow="沉浸式娱乐事件口碑"
          title="红黑榜"
          description="看最近发生的事，也把每条事件沉淀进对象档案。帖子不再接受付费打榜。"
          aside={<div style={filterGroupStyle}>
            <button onClick={() => setFeedMode('latest')} style={hubToggleStyle(feedMode === 'latest', '#275389')}>最新动态</button>
            <button onClick={() => setFeedMode('discussed')} style={hubToggleStyle(feedMode === 'discussed', GOLD)}>近期热议</button>
            <Link to="/rankings/new" style={jumuluPrimaryLinkStyle}>发布评价</Link>
          </div>}
        />

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
            {TAB_HINT[tab]} {feedMode === 'latest'
              ? '按审核通过的新进展排序，普通评论和投票不会把旧帖顶回来。'
              : '按近期独立参与人数与时间衰减排序，只反映最近讨论热度。'}
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
              主帖证据首次提交选填；审核员认为内容不足时可以打回并要求补充。涉及第三方隐私的信息请先打码。口碑票一人一票，可改票；事件帖不接受付费打榜。发布者对事实、证据、隐私打码和言论后果负责。
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
              const subtleAccentBorder = item.type === 'red' ? 'rgba(185,28,28,0.16)' : item.type === 'black' ? 'rgba(148,163,184,0.20)' : 'rgba(166,106,31,0.24)';
              const pinnedComment = (item.pinned_comments || []).find(comment => comment.is_pinned);
              const left = daysLeft(item);
              const myVote = item.my_vote || null;
              const kind = eventKindCopy(item.type);
              const heading = eventTitle(item.content);
              const summary = eventSummary(item.content);
              const activityDate = (item.last_activity_at || item.created_at)?.slice(0, 10);

              return (
                <div key={item.id}
                  id={`ranking-${item.id}`}
                  className="content-card"
                  role="link"
                  tabIndex={0}
                  aria-label={`查看${heading}详情`}
                  onClick={event => {
                    if ((event.target as HTMLElement).closest('a,button,input,textarea,select,label')) return;
                    navigate(`/rankings/${encodeURIComponent(item.id)}`);
                  }}
                  onKeyDown={event => {
                    if ((event.target as HTMLElement).closest('a,button,input,textarea,select,label')) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/rankings/${encodeURIComponent(item.id)}`);
                    }
                  }}
                  style={{
                    ...card,
                    position: 'relative',
                    overflow: 'hidden',
                    paddingLeft: 16,
                    paddingRight: 16,
                    borderColor: subtleAccentBorder,
                    cursor: 'pointer',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
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
                      <Link to={dossierUrl(item)} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'rgba(31,41,55,0.9)', fontSize: '0.82rem', fontWeight: 950, textDecoration: 'none' }}>{item.subject_name}</Link>
                      {item.event_date && item.event_store_name && (
                        <span style={{ padding: '2px 6px', borderRadius: 5, border: '1px solid rgba(39,83,137,0.16)', background: '#eef6ff', color: '#275389', fontSize: '0.62rem', fontWeight: 850 }}>时间地点已补充</span>
                      )}
                      <span style={{ marginLeft: 'auto', color: 'rgba(71,85,105,0.48)', fontSize: '0.66rem', fontWeight: 800 }}>
                        {feedMode === 'latest' ? `动态 ${idx + 1}` : `热议 ${idx + 1}`}
                      </span>
                    </div>
                    <h2 style={{ margin: 0, color: '#111827', fontSize: '1rem', lineHeight: 1.45, fontWeight: 900, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{renderContent(heading)}</h2>
                    {summary && (
                      <div style={{ margin: '5px 0 0' }}>
                        <p style={{
                          fontSize: '0.82rem',
                          color: 'rgba(71,85,105,0.76)',
                          lineHeight: 1.5,
                          margin: '0',
                          fontWeight: 600,
                          display: '-webkit-box',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          overflow: 'hidden',
                        }}>
                          {renderContent(summary)}
                        </p>
                      </div>
                    )}
                    <div style={{ marginTop: 6, color: 'rgba(71,85,105,0.58)', fontSize: '0.68rem', fontWeight: 760 }}>
                      {SUBJECT_LABEL[item.subject_type] || item.subject_type}{item.subject_city ? ` · ${item.subject_city}` : ''}
                    </div>
                    {!!item.display_files?.[0]?.url && (
                      <Link to={`/rankings/${encodeURIComponent(item.id)}`} style={rankingThumbLinkStyle} aria-label="查看正文配图">
                        <img src={item.display_files[0].url} alt={item.display_files[0].name || '榜单正文配图'} style={rankingThumbStyle} />
                        {item.display_files.length > 1 && <span style={rankingThumbCountStyle}>共 {item.display_files.length} 张</span>}
                      </Link>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        color: 'rgba(71,85,105,0.64)',
                        fontSize: '0.7rem',
                        fontWeight: 760,
                        }}>
                        发布人 <ProfileNameLink profileId={item.poster_id}>{renderName(item.author_name, item.is_realname)}</ProfileNameLink>
                      </span>
                      {item.lc_profiles?.verified_shop && (
                        <span style={{ padding: '1px 5px', borderRadius: 999, fontSize: '0.62rem', fontWeight: 900, background: '#3b82f6', color: '#fff' }} title="已认证店家">蓝V</span>
                      )}
                      {item.lc_profiles?.verified_dm && (
                        <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: '0.62rem', fontWeight: 800, background: 'linear-gradient(135deg, #d9a857, #b8860b)', color: '#0F1117' }} title="已认证DM">DM</span>
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

                  <div style={freeVoteZoneStyle}>
                    <button onClick={() => openVoteModal(item.id, 'like')}
                      style={{ ...compactActionButtonStyle, color: myVote?.vote_type === 'like' ? '#8f3732' : 'rgba(71,85,105,0.66)' }}>
                      {myVote?.vote_type === 'like' ? '已同意' : '同意'} {agreeCount(item)}
                    </button>
                    <button onClick={() => openVoteModal(item.id, 'joy')}
                      style={{ ...compactActionButtonStyle, color: myVote?.vote_type === 'joy' ? GOLD : 'rgba(71,85,105,0.66)' }}>
                      欢乐 {item.joys || 0}
                    </button>
                    <button onClick={() => openVoteModal(item.id, 'dislike')}
                      style={{ ...compactActionButtonStyle, color: myVote?.vote_type === 'dislike' ? '#303846' : 'rgba(71,85,105,0.66)' }}>
                      {myVote?.vote_type === 'dislike' ? '已反对' : '反对'} {opposeCount(item)}
                    </button>
                    <button onClick={() => toggleComments(item.id)} style={compactActionButtonStyle}>评论</button>
                  </div>

                  {pinnedComment && (
                    <Link to={`/rankings/${encodeURIComponent(item.id)}`} style={{ display: 'flex', gap: 6, alignItems: 'baseline', minWidth: 0, margin: '7px 0', padding: '7px 9px', border: '1px solid rgba(166,106,31,0.18)', borderRadius: 7, background: '#fffaf2', color: 'rgba(31,41,55,0.78)', textDecoration: 'none', fontSize: '0.72rem' }}>
                      <strong style={{ flex: '0 0 auto', color: GOLD }}>{pinnedComment.pin_label || '相关方已回应'}</strong>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pinnedComment.content}</span>
                    </Link>
                  )}

                  <div style={compactActionRowStyle}>
                    <Link to={`/rankings/${encodeURIComponent(item.id)}`} style={{ color: '#275389', fontSize: '0.74rem', fontWeight: 850, textDecoration: 'none' }}>全文与评论</Link>
                    <details style={{ position: 'relative', marginLeft: 'auto' }}>
                      <summary aria-label="更多操作" style={{ listStyle: 'none', cursor: 'pointer', color: 'rgba(71,85,105,0.42)', fontSize: '1rem', lineHeight: 1 }}>···</summary>
                      <div style={{ position: 'absolute', right: 0, bottom: 24, zIndex: 4, display: 'grid', minWidth: 116, padding: 6, border: '1px solid rgba(31,41,55,0.10)', borderRadius: 7, background: '#fff', boxShadow: '0 8px 24px rgba(31,41,55,0.12)' }}>
                        <button onClick={() => openReportModal({ targetType: 'ranking', targetId: item.id, targetTitle: heading })} style={overflowActionStyle}>举报</button>
                        {item.audit_proof && <button onClick={() => openAuditModal(item)} style={overflowActionStyle}>查看审计</button>}
                      </div>
                    </details>
                    <span style={{ color: 'rgba(71,85,105,0.42)', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>{activityDate}</span>
                    </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </ReputationHubShell>

      {commentsViewerId && commentsViewerItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 96, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(17,24,39,0.58)' }}>
          <section style={{ width: 'min(560px, 100%)', maxHeight: 'min(720px, 86vh)', overflowY: 'auto', borderRadius: 10, border: '1px solid rgba(31,41,55,0.12)', background: '#fffdf8', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1f2937', fontSize: '0.94rem' }}>{eventTitle(commentsViewerItem.content)}</strong>
                <span style={{ color: 'rgba(71,85,105,0.56)', fontSize: '0.7rem' }}>{commentsViewerComments.length} 条公开评论</span>
              </div>
              <button onClick={() => setOpenComments(new Set())} aria-label="关闭评论" style={{ border: 'none', background: 'transparent', color: 'rgba(71,85,105,0.55)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {commentsViewerComments.map(comment => (
                <article key={comment.id} style={{ border: comment.is_pinned ? '1px solid rgba(166,106,31,0.2)' : '1px solid rgba(31,41,55,0.08)', borderRadius: 7, background: comment.is_pinned ? '#fffaf2' : '#fff', padding: 10 }}>
                  {comment.is_pinned && <strong style={{ display: 'block', marginBottom: 5, color: GOLD, fontSize: '0.7rem' }}>{comment.pin_label || '相关方回应'}</strong>}
                  <p style={{ margin: 0, color: 'rgba(31,41,55,0.86)', fontSize: '0.82rem', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{comment.content}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 7, color: 'rgba(71,85,105,0.5)', fontSize: '0.68rem' }}>
                    <ProfileNameLink profileId={comment.author_id}>{renderName(comment.author_name, comment.is_realname)}</ProfileNameLink>
                    <span>{comment.created_at?.slice(0, 10)}</span>
                    {auth?.userId && comment.author_id === auth.userId && !comment.is_pinned && <button onClick={() => openRelatedCertModal(commentsViewerId, comment.id)} style={commentMinorActionStyle}>认证为相关方回应</button>}
                    <button onClick={() => likeComment(commentsViewerId, comment.id)} disabled={likingComment === comment.id} style={{ ...commentMinorActionStyle, marginLeft: 'auto' }}>赞 {comment.likes}</button>
                    {auth?.userId && comment.author_id === auth.userId && <button onClick={() => deleteOwnComment(commentsViewerId, comment.id)} disabled={deletingComment === comment.id} style={commentMinorActionStyle}>删除</button>}
                    <button onClick={() => openReportModal({ targetType: 'comment', targetId: comment.id, targetTitle: `${eventTitle(commentsViewerItem.content)}的评论` })} style={commentMinorActionStyle}>举报</button>
                  </div>
                </article>
              ))}
              {commentsViewerComments.length === 0 && <p style={{ margin: 0, padding: '28px 0', color: 'rgba(71,85,105,0.5)', textAlign: 'center', fontSize: '0.8rem' }}>还没有公开评论。</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => openCommentModal(commentsViewerId)} style={{ flex: 1, minHeight: 38, border: 'none', borderRadius: 7, background: '#275389', color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 850 }}>发表评论</button>
              <Link to={`/rankings/${encodeURIComponent(commentsViewerId)}`} style={{ flex: 1, minHeight: 38, display: 'grid', placeItems: 'center', border: '1px solid rgba(39,83,137,0.16)', borderRadius: 7, background: '#fff', color: '#275389', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 850 }}>进入详情页</Link>
            </div>
          </section>
        </div>
      )}

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
                              <span style={{ color: 'rgba(71,85,105,0.72)', fontWeight: 800 }}>
                                {change.label || AUDIT_FIELD_LABEL[change.field] || change.field}
                              </span>
                              <span style={{ color: 'rgba(71,85,105,0.58)' }}> 已修改；原版仅保留校验存证，公开页展示审核后的当前版本。</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'rgba(31,41,55,0.78)', lineHeight: 1.75 }}>
                          本次公开版本已生成内容校验值。正文请以帖子当前详情为准。
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
