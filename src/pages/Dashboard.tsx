import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import DraftAutosaveNotice from '../components/DraftAutosaveNotice';
import ImageFocusPicker from '../components/ImageFocusPicker';
import InfoTip from '../components/InfoTip';
import ImageUpload from '../components/ImageUpload';
import StoreSearchSelect from '../components/StoreSearchSelect';
import { generatedAvatarDataUrl } from '../lib/avatar';
import { isTokenExpired, readStoredCreatorAuth } from '../lib/authSession';
import { SERVICE_CATEGORY_OPTIONS, normalizeServiceCategory, serviceCategoryLabel } from '../lib/serviceCategories';
import { RESIDENT_TRAVEL_STATUS, formatTravelStatus, normalizeTravelStatus } from '../lib/travelStatus';
import { extractSharedUrl } from '../lib/socialLinks';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import type { Creator, Service, Portfolio, AuthData, Availability, ProfileRolePreference, ScriptCatalogItem, Certification } from '../types';

const API  = '/api';
const C    = '#fffdf8';
const GOLD = '#d9a857';
const INK  = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

function getToken(): string {
  try {
    const stored = localStorage.getItem('lc_creator');
    return stored ? (JSON.parse(stored) as AuthData).token : '';
  } catch { return ''; }
}

type DashboardSection =
  | 'overview'
  | 'profile'
  | 'services'
  | 'serviceWorks'
  | 'serviceAvailability'
  | 'wallet'
  | 'account'
  | 'identity'
  | 'posts'
  | 'referral';

const DASHBOARD_LABELS: Record<DashboardSection, string> = {
  overview: '总览',
  profile: '公开资料',
  services: '提供服务',
  serviceWorks: '作品集',
  serviceAvailability: '可约档期',
  wallet: '钱包余额',
  account: '账号安全',
  identity: '认证身份',
  posts: '我的发布',
  referral: '邀请奖励',
};

const DASHBOARD_NAV: Array<{ key: DashboardSection; label: string; path: string; child?: boolean }> = [
  { key: 'overview', label: '总览', path: '/dashboard' },
  { key: 'profile', label: '公开资料', path: '/dashboard/profile' },
  { key: 'services', label: '服务与作品', path: '/dashboard/services' },
  { key: 'serviceWorks', label: '作品集', path: '/dashboard/services/works', child: true },
  { key: 'serviceAvailability', label: '可约档期', path: '/dashboard/services/availability', child: true },
  { key: 'wallet', label: '钱包余额', path: '/dashboard/wallet' },
  { key: 'account', label: '账号安全', path: '/dashboard/account' },
  { key: 'identity', label: '认证身份', path: '/dashboard/certification' },
  { key: 'posts', label: '我的发布', path: '/dashboard/posts' },
  { key: 'referral', label: '邀请奖励', path: '/dashboard/referrals' },
] as const;

type MyRanking = {
  id: string;
  type: 'red' | 'black' | 'white';
  subject_name: string;
  subject_city?: string | null;
  subject_url?: string | null;
  content: string;
  event_date?: string | null;
  event_script_name?: string | null;
  event_store_name?: string | null;
  initial_amount: number;
  likes: number;
  dislikes: number;
  joys: number;
  boost_amount?: number;
  negative_boost_amount?: number;
  agree_count?: number;
  oppose_count?: number;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reject_reason?: string | null;
  latest_edit_request?: {
    id: string;
    request_kind: 'edit' | 'restore';
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    reject_reason?: string | null;
    created_at: string;
  } | null;
  evidence_required?: boolean;
  revision_kind?: 'content' | 'evidence' | null;
  created_at: string;
};

type MyCommission = {
  id: string;
  title: string;
  city?: string | null;
  needed_date?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'closed';
  created_at: string;
};

type MyCarpool = {
  id: string;
  title: string;
  city: string;
  event_date: string;
  deadline_date?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'closed';
  juzhanggui_sync_status?: 'pending' | 'synced' | 'failed' | 'disabled';
  created_at: string;
};

type WalletTransaction = {
  id: string;
  type: 'recharge' | 'spend' | 'refund';
  amount: number;
  paid_amount?: number | null;
  bonus_amount?: number | null;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason?: string | null;
  created_at: string;
};

type WalletDashboardData = {
  balance: number;
  paid_balance?: number | null;
  bonus_balance?: number | null;
  transactions?: WalletTransaction[];
};

type DossierEditReview = {
  id: string;
  dossier_id: string;
  entity_type: 'dm' | 'store';
  dossier_name: string;
  changed_fields: string[];
  sensitive_fields?: string[];
  owner_confirmation_fields?: string[];
  omitted_sensitive_fields?: string[];
  patch: Record<string, unknown>;
  before_snapshot: Record<string, unknown>;
  edit_reason?: string | null;
  submitter_name: string;
  owner_response_status: 'not_required' | 'pending' | 'agreed' | 'opposed' | 'expired';
  owner_response_due_at?: string | null;
  owner_response_reason?: string | null;
  review_mode?: 'direct' | 'owner' | 'admin_pre' | 'admin_post' | 'admin_mixed' | 'none';
  owner_login_detected?: boolean;
  created_at: string;
};

type DossierEditDashboardData = {
  awaiting_owner_response: DossierEditReview[];
  my_submissions: DossierEditReview[];
};

type ReferralDashboardItem = {
  id: string;
  status: 'registered' | 'qualified' | 'converted' | 'rejected';
  invitee: {
    id: string;
    display_name: string;
    avatar?: string | null;
  };
  invitee_bonus_awarded_at?: string | null;
  stage1_awarded_at?: string | null;
  stage2_awarded_at?: string | null;
  created_at: string;
};

type ReferralDashboardData = {
  referral_code: string;
  share_url: string;
  community_role?: 'community_referrer' | 'community_observer' | 'founding_referrer' | null;
  community_role_expires_at?: string | null;
  stats: {
    registered_invites: number;
    valid_invites: number;
    converted_invites: number;
    invitee_bonus_count: number;
    referrer_reward_total: number;
    next_milestone: {
      target: number;
      title: string;
      remaining: number;
    };
  };
  rules: {
    new_user_base_bonus: number;
    invitee_extra_bonus: number;
    referrer_stage1_bonus: number;
    referrer_stage2_bonus: number;
  };
  referrals: ReferralDashboardItem[];
};

type DmAffiliationRecord = {
  id: string;
  dm_dossier_id: string;
  store_dossier_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'ended' | 'cancelled' | 'legacy_unverified';
  request_kind: 'join' | 'change' | 'legacy';
  requested_by_role?: 'dm' | 'store' | 'admin' | 'legacy' | 'community';
  request_note?: string | null;
  reject_reason?: string | null;
  end_reason?: string | null;
  created_at: string;
  store_dossier?: { id: string; dm_name: string; city?: string | null; workplace?: string | null } | null;
};

type DmIdentityDossier = {
  id: string;
  dm_name: string;
  city?: string | null;
  claim_status: 'approved' | 'withdrawn';
  employment_status?: 'unknown' | 'store_affiliated' | 'freelance';
  affiliations: DmAffiliationRecord[];
  withdrawal?: { id: string; status: 'pending' | 'approved' | 'rejected' | 'cancelled'; reason: string; reject_reason?: string | null; created_at: string } | null;
};

type DmIdentityManagementData = {
  dossiers: DmIdentityDossier[];
  stores: Array<{ id: string; dm_name: string; city?: string | null; workplace?: string | null; claim_status?: string }>;
};

type RolePreferenceDraft = {
  script_id: string;
  script_name: string;
  role_name: string;
  role_gender: string;
  role_tags: string[];
  is_recommended: boolean;
  note: string;
};

type ProfileForm = {
  display_name: string;
  avatar: string;
  avatar_focus_x: number;
  avatar_focus_y: number;
  bio: string;
  city: string;
  wechat: string;
  tags: string;
  douyin: string;
  xiaohongshu: string;
  available_cities: string;
  travel_status: string;
  gender: string;
  sexual_orientation: string;
  preferred_story_lines: string;
  contact_unlock_enabled: boolean;
  contact_intent_amount: string;
};

type ProfileDraft = {
  form: ProfileForm;
  baseForm: ProfileForm;
  rolePreferences: RolePreferenceDraft[];
  baseRolePreferences: RolePreferenceDraft[];
  roleDraft: RolePreferenceDraft;
};

type ServiceDraft = {
  service_type: string;
  price: string;
  duration: string;
  description: string;
};

type ServiceSetupDraft = {
  current: ServiceDraft;
  pending: ServiceDraft[];
};

type AvailabilityImportDraft = {
  city: string;
  location: string;
  text: string;
};

const card: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid rgba(31,41,55,0.08)',
  borderRadius: 8,
  padding: 16,
  boxShadow: 'none',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px solid rgba(201,146,46,0.2)', outline: 'none',
  backgroundColor: '#fff', color: INK,
  fontSize: '0.875rem', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600,
  color: 'rgba(71,85,105,0.78)', marginBottom: 8,
};

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateKeyAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

function blankServiceDraft(): ServiceDraft {
  return { service_type: '', price: '', duration: '', description: '' };
}

function sanitizeIntegerInput(value: string, maxLength = 6) {
  return value.replace(/[^\d]/g, '').slice(0, maxLength);
}

function serviceDraftKey(item: ServiceDraft) {
  return [
    item.service_type.trim(),
    item.price.trim(),
    item.duration.trim(),
    item.description.trim(),
  ].join('|').replace(/\s+/g, ' ').toLowerCase();
}

function recentlyVerifiedAt(value?: string | null) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() - time < 15 * 60 * 1000;
}

function rolePreferenceKey(item: Pick<RolePreferenceDraft, 'script_name' | 'role_name'>) {
  return `${item.script_name.replace(/\s+/g, '').toLowerCase()}:${item.role_name.replace(/\s+/g, '').toLowerCase()}`;
}

function blankRolePreferenceDraft(): RolePreferenceDraft {
  return { script_id: '', script_name: '', role_name: '', role_gender: '', role_tags: [], is_recommended: true, note: '' };
}

function blankProfileForm(): ProfileForm {
  return {
    display_name: '',
    avatar: '',
    avatar_focus_x: 50,
    avatar_focus_y: 25,
    bio: '',
    city: '',
    wechat: '',
    tags: '',
    douyin: '',
    xiaohongshu: '',
    available_cities: '',
    travel_status: RESIDENT_TRAVEL_STATUS,
    gender: '',
    sexual_orientation: '',
    preferred_story_lines: '',
    contact_unlock_enabled: false,
    contact_intent_amount: '',
  };
}

function profileToForm(profile: Creator | null): ProfileForm {
  if (!profile) return blankProfileForm();
  return {
    display_name: profile.display_name || '',
    avatar: profile.avatar || '',
    avatar_focus_x: Number.isFinite(profile.avatar_focus_x) ? Number(profile.avatar_focus_x) : 50,
    avatar_focus_y: Number.isFinite(profile.avatar_focus_y) ? Number(profile.avatar_focus_y) : 25,
    bio: profile.bio || '',
    city: profile.city || '',
    wechat: profile.wechat || '',
    tags: (profile.tags || []).join(', '),
    gender: profile.gender || '',
    sexual_orientation: profile.sexual_orientation || '',
    preferred_story_lines: (profile.preferred_story_lines || []).join(', '),
    douyin: profile.social_links?.douyin || '',
    xiaohongshu: profile.social_links?.xiaohongshu || '',
    available_cities: (profile.available_cities || []).join(', '),
    travel_status: normalizeTravelStatus(profile.travel_status),
    contact_unlock_enabled: !!profile.contact_unlock_enabled,
    contact_intent_amount: profile.contact_intent_amount ? String(profile.contact_intent_amount) : '',
  };
}

function rolePreferencesFromProfile(profile: Creator | null): RolePreferenceDraft[] {
  return (((profile?.role_preferences || []) as ProfileRolePreference[]).map(item => ({
    script_id: item.script_id || '',
    script_name: item.script_name || '',
    role_name: item.role_name || '',
    role_gender: item.role_gender || '',
    role_tags: item.role_tags || [],
    is_recommended: !!item.is_recommended,
    note: item.note || '',
  })).filter(item => item.script_name && item.role_name));
}

function shouldSaveProfileDraft(data: ProfileDraft) {
  return JSON.stringify(data.form) !== JSON.stringify(data.baseForm)
    || JSON.stringify(data.rolePreferences) !== JSON.stringify(data.baseRolePreferences)
    || JSON.stringify(data.roleDraft) !== JSON.stringify(blankRolePreferenceDraft());
}

function hasServiceSetup(_form: ProfileForm, services: Service[], rolePreferences: RolePreferenceDraft[]) {
  return services.length > 0
    || rolePreferences.length > 0;
}

function dashboardSectionFromPath(pathname: string): DashboardSection {
  if (pathname === '/dashboard/profile') return 'profile';
  if (pathname === '/dashboard/services') return 'services';
  if (pathname === '/dashboard/services/works') return 'serviceWorks';
  if (pathname === '/dashboard/services/availability') return 'serviceAvailability';
  if (pathname === '/dashboard/wallet') return 'wallet';
  if (pathname === '/dashboard/account') return 'account';
  if (pathname === '/dashboard/certification') return 'identity';
  if (pathname === '/dashboard/posts') return 'posts';
  if (pathname === '/dashboard/referrals') return 'referral';
  return 'overview';
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function referralRoleLabel(role?: ReferralDashboardData['community_role']) {
  if (role === 'founding_referrer') return '创始推荐人';
  if (role === 'community_observer') return '社区观察员';
  if (role === 'community_referrer') return '社区推荐人';
  return '普通用户';
}

function referralItemStatus(item: ReferralDashboardItem) {
  if (item.stage2_awarded_at) return '已完成有效互动';
  if (item.stage1_awarded_at) return '已完成手机号验证';
  if (item.invitee_bonus_awarded_at) return '已注册';
  return item.status === 'rejected' ? '已驳回' : '等待完成';
}

const CERT_TYPE_LABELS: Record<Certification['type'], string> = {
  realname: '实名认证',
  dm: 'DM 开本记录认证',
  shop: '店家认证',
};

const CERT_STATUS_LABELS: Record<Certification['status'], string> = {
  pending: '审核中',
  approved: '已通过',
  rejected: '未通过',
};

const DOSSIER_EDIT_FIELD_LABELS: Record<string, string> = {
  dm_name: '名称',
  city: '城市',
  workplace: '店家 / 地址',
  employment_status: '受雇状态',
  employer_store_id: '受雇店家',
  profile_url: '主页链接',
  photo_url: '封面照片',
  photo_files: '照片图库',
  note: '档案说明',
  tags: '标签',
  dm_started_month: 'DM 入行时间',
  birth_year: '出生年份',
  height_cm: '身高',
  weight_kg: '体重',
  mbti: 'MBTI',
  zodiac: '星座',
  bio: '人物简介',
  common_scripts: '常开剧本',
  career_history: '任职履历',
  related_profiles: '圈人',
  related_stores: '圈店',
};

function certTone(status: Certification['status']): ToneName {
  if (status === 'approved') return 'green';
  if (status === 'rejected') return 'red';
  return 'gold';
}

async function fetchDmIdentityManagement(token: string) {
  const response = await fetch(`${API}/lc/dm/identity-management`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) throw new Error(data?.error || 'DM 身份与店家关系加载失败');
  return (data.data || { dossiers: [], stores: [] }) as DmIdentityManagementData;
}

function dossierEditDisplayValue(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length === 0) return '留空';
    if (value.every(item => typeof item !== 'object' || item === null)) return value.join('、');
    return value.map((raw, index) => {
      if (!raw || typeof raw !== 'object') return String(raw);
      const item = raw as Record<string, unknown>;
      if (item.url) return `${index + 1}.${String(item.caption || item.name || '照片')}`;
      if (item.store_name) {
        const period = [item.started_month, item.ended_month || (item.started_month ? '至今' : '')].filter(Boolean).join('~');
        return `${String(item.store_name)}${period ? `(${period})` : ''}`;
      }
      return String(item.name || item.label || item.id || `第${index + 1}项`);
    }).join('、');
  }
  if (value === null || value === undefined || value === '') return '留空';
  if (value === 'store_affiliated') return '关联店家';
  if (value === 'freelance') return '自由DM';
  if (value === 'unknown') return '待核验';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function dossierEditStatusLabel(status: DossierEditReview['owner_response_status'], reviewMode?: DossierEditReview['review_mode']) {
  if (status === 'pending') return '等待认领人确认';
  if (reviewMode === 'admin_post') return '已更新 · 管理员后审';
  if (reviewMode === 'admin_mixed') return '部分已更新 · 其余待审';
  if (reviewMode === 'admin_pre') return '待管理员审核';
  if (status === 'agreed') return '认领人已同意';
  if (status === 'opposed') return '认领人已反对';
  if (status === 'expired') return '3天未上线 · 已自动处理';
  return '待平台审核';
}

function getProfileCompletion(form: ProfileForm, services: Service[], portfolio: Portfolio[], rolePreferences: RolePreferenceDraft[]) {
  const checks = [
    form.display_name.trim(),
    form.city.trim(),
    form.bio.trim(),
    form.tags.trim(),
    form.avatar.trim(),
    form.available_cities.trim(),
    services.length > 0,
    portfolio.length > 0,
    rolePreferences.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeSection = dashboardSectionFromPath(pathname);
  const [creator, setCreator]   = useState<Creator | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [myRankings, setMyRankings] = useState<MyRanking[]>([]);
  const [myCommissions, setMyCommissions] = useState<MyCommission[]>([]);
  const [myCarpools, setMyCarpools] = useState<MyCarpool[]>([]);
  const [scripts, setScripts] = useState<ScriptCatalogItem[]>([]);
  const [rolePreferences, setRolePreferences] = useState<RolePreferenceDraft[]>([]);
  const [roleDraft, setRoleDraft] = useState<RolePreferenceDraft>(() => blankRolePreferenceDraft());
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [rankingEdit, setRankingEdit] = useState<{
    item: MyRanking;
    content: string;
    subject_url: string;
    event_date: string;
    event_script_name: string;
    event_store_name: string;
    saving: boolean;
    error: string;
  } | null>(null);

  const [form, setForm] = useState<ProfileForm>(() => blankProfileForm());
  const [newSvc, setNewSvc] = useState<ServiceDraft>(() => blankServiceDraft());
  const [pendingServices, setPendingServices] = useState<ServiceDraft[]>([]);
  const [submittingServices, setSubmittingServices] = useState(false);
  const [availDates, setAvailDates] = useState<string[]>([]);
  const [availItems, setAvailItems] = useState<Availability[]>([]);
  const [selectedAvailDates, setSelectedAvailDates] = useState<string[]>([]);
  const [submittingAvailability, setSubmittingAvailability] = useState(false);
  const [availCity, setAvailCity] = useState('');
  const [availLocation, setAvailLocation] = useState('');
  const [syncingJzg, setSyncingJzg] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [screenshotText, setScreenshotText] = useState('');
  const [importingScreenshot, setImportingScreenshot] = useState(false);
  const [bindPhone, setBindPhone] = useState('');
  const [bindCode, setBindCode] = useState('');
  const [bindPassword, setBindPassword] = useState('');
  const [showAccountBindForm, setShowAccountBindForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordVerifyType, setPasswordVerifyType] = useState<'phone' | 'email'>('email');
  const [passwordVerifyCode, setPasswordVerifyCode] = useState('');
  const [sendingPasswordVerifyCode, setSendingPasswordVerifyCode] = useState(false);
  const [sendingBindCode, setSendingBindCode] = useState(false);
  const [bindingPhone, setBindingPhone] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [offersServices, setOffersServices] = useState(false);
  const [walletData, setWalletData] = useState<WalletDashboardData | null>(null);
  const [referralData, setReferralData] = useState<ReferralDashboardData | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [dmIdentityData, setDmIdentityData] = useState<DmIdentityManagementData>({ dossiers: [], stores: [] });
  const [dmStoreChoices, setDmStoreChoices] = useState<Record<string, string>>({});
  const [identityAction, setIdentityAction] = useState('');
  const [dossierEditData, setDossierEditData] = useState<DossierEditDashboardData>({ awaiting_owner_response: [], my_submissions: [] });
  const [ownerResponseNotes, setOwnerResponseNotes] = useState<Record<string, string>>({});
  const [respondingDossierEditId, setRespondingDossierEditId] = useState('');
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleError, setModuleError] = useState('');
  const [copiedInvite, setCopiedInvite] = useState('');

  const token = getToken();

  const applyAvailability = (items: Availability[]) => {
    const nextItems = items || [];
    const approvedDates = Array.from(new Set(nextItems.filter(a => !a.is_booked).map(a => a.date)));
    const blockedDates = new Set(nextItems.map(a => a.date));
    setAvailItems(nextItems);
    setAvailDates(approvedDates);
    setSelectedAvailDates(prev => prev.filter(date => !blockedDates.has(date)));
  };

  useEffect(() => {
    const data = readStoredCreatorAuth() as AuthData | null;
    if (!data?.id || !data.token) { navigate('/login'); return; }
    if (isTokenExpired(data.token)) {
      localStorage.removeItem('lc_creator');
      window.dispatchEvent(new Event('lc-auth-changed'));
      navigate('/login');
      return;
    }

    Promise.all([
      fetch(`${API}/lc/creators/${data.id}`, { headers: { Authorization: `Bearer ${data.token}` } }).then(r => r.json()),
      fetch(`${API}/lc/creators/${data.id}/availability?from=${dateKeyAfterDays(0)}&to=${dateKeyAfterDays(120)}`).then(r => r.json()),
      fetch(`${API}/lc/rankings/mine`, { headers: { Authorization: `Bearer ${data.token}` } }).then(r => r.json()),
      fetch(`${API}/lc/commissions/mine`, { headers: { Authorization: `Bearer ${data.token}` } }).then(r => r.json()),
      fetch(`${API}/lc/carpools/mine`, { headers: { Authorization: `Bearer ${data.token}` } }).then(r => r.json()),
      fetch(`${API}/lc/scripts`).then(r => r.json()),
    ]).then(([profileData, availData, rankingsData, commissionsData, carpoolsData, scriptsData]) => {
      if (profileData.success && profileData.data) {
        const { services: svc, portfolio: port, ...profile } = profileData.data;
        setCreator(profile);
        setServices(svc || []);
        setPortfolio(port || []);
        setRolePreferences(rolePreferencesFromProfile(profile));
        setForm(profileToForm(profile));
        setOffersServices(hasServiceSetup(profileToForm(profile), svc || [], rolePreferencesFromProfile(profile)));
      } else { setError(profileData.error || '加载失败'); }
      if (availData.success) {
        applyAvailability(availData.data || []);
      }
      if (rankingsData.success) setMyRankings(rankingsData.data || []);
      if (commissionsData.success) setMyCommissions(commissionsData.data || []);
      if (carpoolsData.success) setMyCarpools(carpoolsData.data || []);
      if (scriptsData.success) setScripts(scriptsData.data || []);
    }).catch(() => setError('网络错误')).finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    if (!creator) return;
    if (passwordVerifyType === 'email' && !creator.email && creator.phone) {
      const timer = window.setTimeout(() => setPasswordVerifyType('phone'), 0);
      return () => window.clearTimeout(timer);
    }
    if (passwordVerifyType === 'phone' && !creator.phone && creator.email) {
      const timer = window.setTimeout(() => setPasswordVerifyType('email'), 0);
      return () => window.clearTimeout(timer);
    }
  }, [creator, passwordVerifyType]);

  const selectedScript = scripts.find(script => script.id === roleDraft.script_id) || null;
  const selectedScriptRoles = selectedScript?.player_roles || [];
  const selectedRole = selectedScriptRoles.find(role => role.role_name === roleDraft.role_name) || null;
  const profileDraftValue = useMemo<ProfileDraft>(() => ({
    form,
    baseForm: profileToForm(creator),
    rolePreferences,
    baseRolePreferences: rolePreferencesFromProfile(creator),
    roleDraft,
  }), [creator, form, roleDraft, rolePreferences]);
  const profileDraft = useDraftAutosave<ProfileDraft>({
    key: 'lc:draft:dashboard:profile',
    version: 1,
    enabled: !!creator,
    value: profileDraftValue,
    shouldSave: shouldSaveProfileDraft,
    onRestore: data => {
      setForm(data.form || blankProfileForm());
      setRolePreferences(data.rolePreferences || []);
      setRoleDraft(data.roleDraft || blankRolePreferenceDraft());
    },
  });
  const serviceDraftValue = useMemo<ServiceSetupDraft>(() => ({
    current: newSvc,
    pending: pendingServices,
  }), [newSvc, pendingServices]);
  const serviceDraft = useDraftAutosave<ServiceSetupDraft>({
    key: 'lc:draft:dashboard:service',
    version: 2,
    enabled: !!creator,
    value: serviceDraftValue,
    shouldSave: data => {
      const current = data.current || blankServiceDraft();
      return (data.pending || []).length > 0
        || !!(current.service_type.trim() || current.price.trim() || current.duration.trim() || current.description.trim());
    },
    onRestore: data => {
      const current = data.current || blankServiceDraft();
      setNewSvc({
        service_type: current.service_type || '',
        price: sanitizeIntegerInput(current.price || ''),
        duration: current.duration || '',
        description: current.description || '',
      });
      setPendingServices((data.pending || []).map(item => ({
        service_type: item.service_type || '',
        price: sanitizeIntegerInput(item.price || ''),
        duration: item.duration || '',
        description: item.description || '',
      })).filter(item => item.service_type && item.price));
    },
  });
  const availabilityImportDraftValue = useMemo<AvailabilityImportDraft>(() => ({
    city: availCity,
    location: availLocation,
    text: screenshotText,
  }), [availCity, availLocation, screenshotText]);
  const availabilityImportDraft = useDraftAutosave<AvailabilityImportDraft>({
    key: 'lc:draft:dashboard:availability-import',
    version: 1,
    enabled: !!creator,
    value: availabilityImportDraftValue,
    shouldSave: data => !!(data.city.trim() || data.location.trim() || data.text.trim()),
    onRestore: data => {
      setAvailCity(data.city || '');
      setAvailLocation(data.location || '');
      setScreenshotText(data.text || '');
    },
  });

  useEffect(() => {
    if (!creator || !token) return;
    if (!['wallet', 'referral', 'identity'].includes(activeSection)) return;
    let cancelled = false;
    const loadModule = async () => {
      setModuleLoading(true);
      setModuleError('');
      try {
        if (activeSection === 'wallet') {
          const response = await fetch(`${API}/lc/wallet`, { headers: { Authorization: `Bearer ${token}` } });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.error || '钱包信息加载失败');
          if (!cancelled) setWalletData(data.data || null);
        }
        if (activeSection === 'referral') {
          const response = await fetch(`${API}/lc/referrals/me`, { headers: { Authorization: `Bearer ${token}` } });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.error || '邀请信息加载失败');
          if (!cancelled) setReferralData(data.data || null);
        }
        if (activeSection === 'identity') {
          const [certificationResponse, identityData, editResponse] = await Promise.all([
            fetch(`${API}/lc/certifications/my`, { headers: { Authorization: `Bearer ${token}` } }),
            fetchDmIdentityManagement(token),
            fetch(`${API}/lc/dossier-edits/my`, { headers: { Authorization: `Bearer ${token}` } }),
          ]);
          const [data, editData] = await Promise.all([
            certificationResponse.json().catch(() => null),
            editResponse.json().catch(() => null),
          ]);
          if (!certificationResponse.ok || !data?.success) throw new Error(data?.error || '认证记录加载失败');
          if (!editResponse.ok || !editData?.success) throw new Error(editData?.error || '档案修改记录加载失败');
          if (!cancelled) {
            setCertifications(data.data || []);
            setDmIdentityData(identityData);
            setDossierEditData(editData.data || { awaiting_owner_response: [], my_submissions: [] });
          }
        }
      } catch (moduleErr) {
        if (!cancelled) setModuleError(moduleErr instanceof Error ? moduleErr.message : '加载失败');
      } finally {
        if (!cancelled) setModuleLoading(false);
      }
    };
    void loadModule();
    return () => { cancelled = true; };
  }, [activeSection, creator, token]);

  const respondToDossierEdit = async (item: DossierEditReview, decision: 'agree' | 'oppose') => {
    const reason = (ownerResponseNotes[item.id] || '').trim();
    if (decision === 'oppose' && reason.length < 4) {
      setModuleError('反对修改时请写明原因');
      return;
    }
    setRespondingDossierEditId(item.id);
    setModuleError('');
    try {
      const response = await fetch(`${API}/lc/dossier-edits/${encodeURIComponent(item.id)}/owner-response`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decision, reason }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || '确认失败');
      setDossierEditData(current => ({
        ...current,
        awaiting_owner_response: current.awaiting_owner_response.filter(edit => edit.id !== item.id),
      }));
      setOwnerResponseNotes(current => ({ ...current, [item.id]: '' }));
      setMsg(data.data?.message || (decision === 'agree' ? '已同意这次资料修改。' : '已反对，这次资料修改不会生效。'));
    } catch (responseError) {
      setModuleError(responseError instanceof Error ? responseError.message : '确认失败');
    } finally {
      setRespondingDossierEditId('');
    }
  };

  const withdrawDossierEdit = async (item: DossierEditReview) => {
    if (!confirm(`确定撤回对“${item.dossier_name}”的这条档案修改吗？撤回后可以重新提交。`)) return;
    setRespondingDossierEditId(item.id);
    setModuleError('');
    try {
      const response = await fetch(`${API}/lc/dossier-edits/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || '撤回失败');
      setDossierEditData(current => ({
        ...current,
        my_submissions: current.my_submissions.filter(edit => edit.id !== item.id),
      }));
      setMsg('档案修改已撤回，可以重新提交。');
    } catch (responseError) {
      setModuleError(responseError instanceof Error ? responseError.message : '撤回失败');
    } finally {
      setRespondingDossierEditId('');
    }
  };

  const selectRoleScript = (scriptId: string) => {
    const script = scripts.find(item => item.id === scriptId);
    setRoleDraft(prev => ({
      ...prev,
      script_id: script?.id || '',
      script_name: script?.name || '',
      role_name: '',
      role_gender: '',
      role_tags: [],
    }));
  };

  const selectRoleName = (roleName: string) => {
    const role = selectedScriptRoles.find(item => item.role_name === roleName);
    setRoleDraft(prev => ({
      ...prev,
      role_name: role?.role_name || '',
      role_gender: role?.gender || '',
      role_tags: role?.tags || [],
    }));
  };

  const addRolePreference = () => {
    if (!selectedScript || !selectedRole) {
      setError('请先从剧本库选择剧本和角色；库里没有就先维护剧本库。');
      return;
    }
    const next = {
      ...roleDraft,
      script_id: selectedScript.id,
      script_name: selectedScript.name,
      role_name: selectedRole.role_name,
      role_gender: selectedRole.gender || '',
      role_tags: selectedRole.tags || [],
      note: roleDraft.note.trim(),
    };
    setError('');
    const key = rolePreferenceKey(next);
    setRolePreferences(prev => {
      const existingIndex = prev.findIndex(item => rolePreferenceKey(item) === key);
      if (existingIndex === -1) return [...prev, next];
      return prev.map((item, index) => index === existingIndex ? {
        ...item,
        ...next,
        role_tags: Array.from(new Set([...(item.role_tags || []), ...(next.role_tags || [])])),
        is_recommended: item.is_recommended || next.is_recommended,
      } : item);
    });
    setRoleDraft(blankRolePreferenceDraft());
  };

  const removeRolePreference = (index: number) => {
    setRolePreferences(prev => prev.filter((_, i) => i !== index));
  };

  const toggleRolePreferenceRecommended = (index: number) => {
    setRolePreferences(prev => prev.map((item, i) => i === index ? { ...item, is_recommended: !item.is_recommended } : item));
  };

  const saveProfile = async (avatarOverride?: string) => {
    if (!creator) return;
    setSaving(true); setError('');
    try {
      const tags = form.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      const available_cities = form.available_cities.split(',').map((t: string) => t.trim()).filter(Boolean);
      const preferred_story_lines = form.preferred_story_lines.split(/[，,、/]/).map((t: string) => t.trim()).filter(Boolean);
      const social_links = {
        douyin: extractSharedUrl(form.douyin),
        xiaohongshu: extractSharedUrl(form.xiaohongshu),
      };
      const r = await fetch(`${API}/lc/creators/${creator.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          display_name: form.display_name,
          avatar: avatarOverride ?? form.avatar,
          avatar_focus_x: form.avatar_focus_x,
          avatar_focus_y: form.avatar_focus_y,
          bio: form.bio,
          city: form.city,
          wechat: form.wechat,
          tags,
          gender: form.gender,
          sexual_orientation: form.sexual_orientation,
          preferred_story_lines,
          social_links,
          available_cities,
          travel_status: form.travel_status,
          contact_unlock_enabled: form.contact_unlock_enabled,
          contact_intent_amount: form.contact_intent_amount,
          role_preferences: rolePreferences.map((item, index) => ({
            script_id: item.script_id || null,
            script_name: item.script_name,
            role_name: item.role_name,
            role_gender: item.role_gender,
            role_tags: item.role_tags,
            is_recommended: item.is_recommended,
            note: item.note,
            sort_order: index,
          })),
        }),
      });
      const d = await r.json();
      if (d.success) {
        profileDraft.clearDraft();
        setMsg(d.data?.message || '已提交审核，通过后才会公开展示');
        setTimeout(() => setMsg(''), 3200);
      }
      else setError(d.error || '保存失败');
    } catch { setError('网络错误，请重试'); }
    finally { setSaving(false); }
  };

  const handleAvatarUploaded = (url: string) => {
    setForm(prev => ({ ...prev, avatar: url, avatar_focus_x: 50, avatar_focus_y: 25 }));
    setMsg('图片已上传，请调整展示位置后点击保存资料');
    setTimeout(() => setMsg(''), 3200);
  };

  const normalizeSocialField = (field: 'douyin' | 'xiaohongshu', raw: string) => {
    const normalized = extractSharedUrl(raw);
    setForm(prev => ({ ...prev, [field]: normalized || raw }));
  };

  const refreshStoredAuth = (patch: Partial<AuthData>) => {
    try {
      const raw = localStorage.getItem('lc_creator');
      if (!raw) return;
      localStorage.setItem('lc_creator', JSON.stringify({ ...JSON.parse(raw), ...patch }));
      window.dispatchEvent(new Event('lc-auth-changed'));
    } catch {
      // ignore local storage corruption; token guard will send user back to login.
    }
  };

  const sendBindPhoneCode = async () => {
    const targetPhone = bindPhone.trim();
    if (!targetPhone || targetPhone.replace(/\D/g, '').length !== 11) { setError('请填写正确的手机号'); return; }
    setSendingBindCode(true);
    setError('');
    setMsg('');
    try {
      const r = await fetch(`${API}/lc/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || '验证码发送失败');
      setBindPhone(targetPhone);
      setMsg('验证码已发送');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '验证码发送失败');
    } finally {
      setSendingBindCode(false);
    }
  };

  const bindPhoneToAccount = async () => {
    const targetPhone = bindPhone.trim();
    if (!targetPhone || targetPhone.replace(/\D/g, '').length !== 11) { setError('请填写正确的手机号'); return; }
    if (!bindCode.trim()) { setError('请填写验证码'); return; }
    setBindingPhone(true);
    setError('');
    setMsg('');
    try {
      const r = await fetch(`${API}/lc/auth/bind-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: targetPhone, code: bindCode.trim() }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || '绑定手机号失败');
      setCreator(prev => prev ? { ...prev, phone: d.data.phone, phone_verified_at: d.data.phone_verified_at, has_password: d.data.has_password } : prev);
      refreshStoredAuth({ phone: d.data.phone, token: d.data.token });
      setBindCode('');
      setShowAccountBindForm(false);
      setMsg('手机号已绑定，同一个账号可在网页端使用验证码登录');
      setTimeout(() => setMsg(''), 3200);
    } catch (e) {
      setError(e instanceof Error ? e.message : '绑定手机号失败');
    } finally {
      setBindingPhone(false);
    }
  };

  const sendPasswordVerifyCode = async () => {
    if (!creator) return;
    const target = passwordVerifyType === 'phone' ? creator.phone : creator.email;
    if (!target) { setError(passwordVerifyType === 'phone' ? '当前账号没有手机号' : '当前账号没有邮箱'); return; }
    setSendingPasswordVerifyCode(true);
    setError('');
    setMsg('');
    try {
      const r = await fetch(passwordVerifyType === 'phone' ? `${API}/lc/auth/send-code` : `${API}/lc/auth/email/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordVerifyType === 'phone' ? { phone: target } : { email: target }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || '验证码发送失败');
      setMsg('改密验证码已发送');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '验证码发送失败');
    } finally {
      setSendingPasswordVerifyCode(false);
    }
  };

  const setWebPassword = async () => {
    if (!creator) return;
    if (!bindPassword.trim() || bindPassword.length < 4) { setError('密码至少4位'); return; }
    const recentlyVerified = recentlyVerifiedAt(creator.phone_verified_at) || recentlyVerifiedAt(creator.email_verified_at);
    if (!recentlyVerified && !passwordVerifyCode.trim()) {
      setError('修改密码前请先获取并填写当前手机号或邮箱验证码');
      return;
    }
    setSettingPassword(true);
    setError('');
    setMsg('');
    try {
      const r = await fetch(`${API}/lc/auth/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          password: bindPassword.trim(),
          verificationType: recentlyVerified ? undefined : passwordVerifyType,
          verificationCode: recentlyVerified ? undefined : passwordVerifyCode.trim(),
        }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || '设置密码失败');
      setCreator(prev => prev ? { ...prev, has_password: true } : prev);
      setBindPassword('');
      setPasswordVerifyCode('');
      setShowPasswordForm(false);
      setMsg('网页登录密码已设置，之后可用手机号或邮箱 + 密码登录同一个账号');
      setTimeout(() => setMsg(''), 3200);
    } catch (e) {
      setError(e instanceof Error ? e.message : '设置密码失败');
    } finally {
      setSettingPassword(false);
    }
  };

  const refreshAvailability = async () => {
    if (!creator) return;
    const r = await fetch(`${API}/lc/creators/${creator.id}/availability?from=${dateKeyAfterDays(0)}&to=${dateKeyAfterDays(120)}`);
    const d = await r.json();
    if (d.success) applyAvailability(d.data || []);
  };

  const syncJuzhangguiAvailability = async () => {
    if (!creator) return;
    setSyncingJzg(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/availability/sync-juzhanggui`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!d.success) {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '同步失败');
        setError(msg);
        return;
      }
      await refreshAvailability();
      setMsg(d.data?.matched === false ? d.data.message : `已同步 ${d.data?.imported || 0} 条剧司辰档期`);
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSyncingJzg(false);
    }
  };

  const importScreenshotAvailability = async () => {
    if (!creator || !screenshotText.trim()) {
      setError('请粘贴截图中的文字');
      return;
    }
    setImportingScreenshot(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/availability/import-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rawText: screenshotText,
          screenshotUrl,
          city: availCity || form.city || null,
          location: availLocation || null,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '导入失败');
        setError(msg);
        return;
      }
      availabilityImportDraft.clearDraft();
      setScreenshotUrl('');
      setScreenshotText('');
      setAvailCity('');
      setAvailLocation('');
      setMsg(d.data?.message || '截图档期已提交审核，通过后才会公开展示');
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setImportingScreenshot(false);
    }
  };

  const addServiceDraft = () => {
    const next: ServiceDraft = {
      service_type: newSvc.service_type.trim(),
      price: sanitizeIntegerInput(newSvc.price),
      duration: newSvc.duration.trim(),
      description: newSvc.description.trim(),
    };
    if (!next.service_type || !next.price) {
      setError('请先选择服务类目并填写纯数字价格');
      return;
    }
    if (Number.parseInt(next.price, 10) <= 0) {
      setError('价格必须大于 0');
      return;
    }
    const nextKey = serviceDraftKey(next);
    const duplicated = pendingServices.some(item => serviceDraftKey(item) === nextKey)
      || services.some(item => serviceDraftKey({
        service_type: item.service_type || '',
        price: String(item.price ?? ''),
        duration: item.duration || '',
        description: item.description || '',
      }) === nextKey);
    if (duplicated) {
      setError('这项服务已经添加过了');
      return;
    }
    setError('');
    setPendingServices(prev => [...prev, next]);
    setNewSvc(blankServiceDraft());
    setMsg('已加入上线清单，确认无误后再统一提交审核');
    setTimeout(() => setMsg(''), 2500);
  };

  const submitServicesForReview = async () => {
    if (!creator) return;
    if (pendingServices.length === 0) {
      setError('请先把服务加入上线清单');
      return;
    }
    setSubmittingServices(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ creatorId: creator.id, services: pendingServices }),
      });
      const d = await r.json();
      if (d.success) {
        serviceDraft.clearDraft();
        setPendingServices([]);
        setNewSvc(blankServiceDraft());
        setMsg(d.data?.message || '服务上线清单已提交审核，通过后才会公开展示');
        setTimeout(() => setMsg(''), 3000);
      } else {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '提交失败');
        setError(msg);
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSubmittingServices(false);
    }
  };

  const deleteService = async (id: string) => {
    const r = await fetch(`${API}/lc/services/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (d.success) setServices(services.filter(s => s.id !== id));
  };

  const addPortfolio = async (url: string) => {
    if (!creator) return;
    const r = await fetch(`${API}/lc/portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ creatorId: creator.id, imageUrl: url }),
    });
    const d = await r.json();
    if (d.success) {
      setMsg(d.data?.message || '作品已提交审核，通过后才会公开展示');
      setTimeout(() => setMsg(''), 3000);
    } else {
      setError(d.error || '上传失败');
    }
  };

  const deletePortfolio = async (id: string) => {
    const r = await fetch(`${API}/lc/portfolio/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (d.success) setPortfolio(portfolio.filter(p => p.id !== id));
  };

  const closeCarpool = async (id: string) => {
    if (!confirm('确定关闭这条拼车吗？关闭后不会继续公开展示。')) return;
    setError('');
    try {
      const r = await fetch(`${API}/lc/carpools/${id}/close`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) {
        setMyCarpools(prev => prev.map(item => item.id === id ? { ...item, status: 'closed' } : item));
        setMsg('拼车已关闭');
        setTimeout(() => setMsg(''), 2500);
      } else {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '关闭失败');
        setError(msg);
      }
    } catch {
      setError('网络错误，请重试');
    }
  };

  const withdrawRanking = async (id: string) => {
    const item = myRankings.find(ranking => ranking.id === id);
    const message = item?.status === 'approved'
      ? '确定下架这条已发布口碑吗？下架后公开页面会立即消失，历史互动、证据和版本仍由平台留存；以后恢复需要重新审核。'
      : '确定撤回这条口碑吗？撤回后不会继续进入审核队列。';
    if (!confirm(message)) return;
    setError('');
    try {
      const r = await fetch(`${API}/lc/rankings/${id}/withdraw`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) {
        setMyRankings(prev => prev.map(item => item.id === id ? { ...item, status: 'withdrawn' } : item));
        setMsg(item?.status === 'approved' ? '口碑已下架，公开端已隐藏' : '口碑已撤回');
        setTimeout(() => setMsg(''), 2500);
      } else {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '撤回失败');
        setError(msg);
      }
    } catch {
      setError('网络错误，请重试');
    }
  };

  const requestRankingRestore = async (id: string) => {
    setError('');
    try {
      const response = await fetch(`${API}/lc/rankings/${id}/restore-request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '恢复申请提交失败');
      setMyRankings(previous => previous.map(item => item.id === id ? {
        ...item,
        latest_edit_request: { id: payload.data.id, request_kind: 'restore', status: 'pending', created_at: new Date().toISOString() },
      } : item));
      setMsg('恢复申请已提交');
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : '恢复申请提交失败');
    }
  };

  const openRankingAuthorEdit = (item: MyRanking) => {
    setRankingEdit({
      item,
      content: item.content || '',
      subject_url: item.subject_url || '',
      event_date: item.event_date || '',
      event_script_name: item.event_script_name || '',
      event_store_name: item.event_store_name || '',
      saving: false,
      error: '',
    });
  };

  const submitRankingAuthorEdit = async () => {
    if (!rankingEdit) return;
    setRankingEdit(current => current ? { ...current, saving: true, error: '' } : current);
    try {
      const response = await fetch(`${API}/lc/rankings/${rankingEdit.item.id}/edit-requests`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: rankingEdit.content,
          subject_url: rankingEdit.subject_url,
          event_date: rankingEdit.event_date,
          event_script_name: rankingEdit.event_script_name,
          event_store_name: rankingEdit.event_store_name,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '修改申请提交失败');
      setMyRankings(previous => previous.map(item => item.id === rankingEdit.item.id ? {
        ...item,
        latest_edit_request: { id: payload.data.id, request_kind: 'edit', status: 'pending', created_at: new Date().toISOString() },
      } : item));
      setRankingEdit(null);
      setMsg('修改申请已提交，审核前仍展示原版');
    } catch (editError) {
      setRankingEdit(current => current ? { ...current, saving: false, error: editError instanceof Error ? editError.message : '修改申请提交失败' } : current);
    }
  };

  const closeCommission = async (id: string) => {
    if (!confirm('确定关闭这条委托需求吗？关闭后不会继续公开展示。')) return;
    setError('');
    try {
      const r = await fetch(`${API}/lc/commissions/${id}/close`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) {
        setMyCommissions(prev => prev.map(item => item.id === id ? { ...item, status: 'closed' } : item));
        setMsg('委托需求已关闭');
        setTimeout(() => setMsg(''), 2500);
      } else {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '关闭失败');
        setError(msg);
      }
    } catch {
      setError('网络错误，请重试');
    }
  };

  const deleteAvailabilityItem = async (item: Availability) => {
    if (!creator) return;
    const r = await fetch(`${API}/lc/availability/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (d.success) {
      setAvailDates(prev => prev.filter(ds => ds !== item.date));
      setAvailItems(prev => prev.filter(a => a.id !== item.id));
    } else {
      const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '删除失败');
      setError(msg);
    }
  };

  const toggleDate = (date: Date) => {
    if (!creator) return;
    const dateStr = formatDateKey(date);
    if (busyDateSet.has(dateStr)) {
      setMsg('这天已经被剧司辰档期标记为忙碌，不会作为可预约日期展示');
      setTimeout(() => setMsg(''), 2600);
      return;
    }
    if (availDates.includes(dateStr)) {
      setMsg('这天已经公开可约；如果要取消，请点下方已公开日期旁边的 ×');
      setTimeout(() => setMsg(''), 2600);
      return;
    }
    setSelectedAvailDates(prev => (
      prev.includes(dateStr)
        ? prev.filter(ds => ds !== dateStr)
        : [...prev, dateStr].sort()
    ));
  };

  const submitSelectedAvailability = async () => {
    if (!creator) return;
    if (selectedAvailDates.length === 0) {
      setError('请先在日历里选择要提交的可约日期');
      return;
    }
    setSubmittingAvailability(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          creatorId: creator.id,
          dates: selectedAvailDates,
          startTime: '09:00',
          endTime: '22:00',
          city: availCity || form.city || null,
          location: availLocation || null,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setSelectedAvailDates([]);
        await refreshAvailability();
        const skipped = Array.isArray(d.data?.skipped_dates) && d.data.skipped_dates.length > 0
          ? `；已跳过重复日期：${d.data.skipped_dates.join('、')}`
          : '';
        setMsg(`${d.data?.message || '选中档期已提交审核，通过后才会公开展示'}${skipped}`);
        setTimeout(() => setMsg(''), 3000);
      } else {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '提交失败');
        setError(msg);
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSubmittingAvailability(false);
    }
  };

  const copyInviteText = async (label: string, text: string) => {
    try {
      await copyTextToClipboard(text);
      setCopiedInvite(label);
      window.setTimeout(() => setCopiedInvite(''), 1600);
    } catch {
      setModuleError('复制失败，请手动选中复制');
    }
  };

  const refreshDmIdentity = async () => {
    const data = await fetchDmIdentityManagement(token);
    setDmIdentityData(data);
    setCreator(current => current ? { ...current, verified_dm: data.dossiers.some(dossier => dossier.claim_status === 'approved') } : current);
  };

  const requestDmStoreConfirmation = async (dossier: DmIdentityDossier) => {
    const storeDossierId = dmStoreChoices[dossier.id] || '';
    if (!storeDossierId) {
      setModuleError('请先选择要申请确认的店家');
      return;
    }
    const requestNote = window.prompt('可以补充你的任职说明（选填）', '') ?? null;
    if (requestNote === null) return;
    setIdentityAction(`request:${dossier.id}`);
    setModuleError('');
    try {
      const response = await fetch(`${API}/lc/dm-dossiers/${encodeURIComponent(dossier.id)}/affiliations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeDossierId, requestNote: requestNote.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || '申请提交失败');
      await refreshDmIdentity();
      setMsg('任职店家已按本人声明立即展示；店家认领后可确认或否认。');
    } catch (actionError) {
      setModuleError(actionError instanceof Error ? actionError.message : '申请提交失败');
    } finally {
      setIdentityAction('');
    }
  };

  const cancelDmStoreRequest = async (dossier: DmIdentityDossier, affiliationId: string) => {
    if (!window.confirm('确认取消这条店家确认申请吗？')) return;
    setIdentityAction(`cancel:${affiliationId}`);
    setModuleError('');
    try {
      const response = await fetch(`${API}/lc/dm-dossiers/${encodeURIComponent(dossier.id)}/affiliations/${encodeURIComponent(affiliationId)}/cancel`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || '取消失败');
      await refreshDmIdentity();
    } catch (actionError) {
      setModuleError(actionError instanceof Error ? actionError.message : '取消失败');
    } finally {
      setIdentityAction('');
    }
  };

  const declareFreelanceDm = async (dossier: DmIdentityDossier) => {
    if (!window.confirm('确认解除当前店家关系，并将公开状态改为“自由 DM（本人声明）”吗？')) return;
    const reason = window.prompt('请填写解除原因（选填）', '') ?? null;
    if (reason === null) return;
    setIdentityAction(`freelance:${dossier.id}`);
    setModuleError('');
    try {
      const response = await fetch(`${API}/lc/dm-dossiers/${encodeURIComponent(dossier.id)}/affiliations/freelance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || '解除关联失败');
      await refreshDmIdentity();
      setMsg('店家关联已解除；公开档案将显示为自由 DM（本人声明）。');
    } catch (actionError) {
      setModuleError(actionError instanceof Error ? actionError.message : '解除关联失败');
    } finally {
      setIdentityAction('');
    }
  };

  const requestDmIdentityWithdrawal = async (dossier: DmIdentityDossier) => {
    const reason = window.prompt('请说明为什么要撤销 DM 身份认证（至少 6 个字）', '') ?? null;
    if (reason === null) return;
    if (reason.trim().length < 6) {
      setModuleError('撤销原因至少填写 6 个字');
      return;
    }
    if (!window.confirm('撤销通过后会解除账号与 DM 档案的公开绑定，并结束所有店家关系；历史评分和档案仍会保留。确认提交吗？')) return;
    setIdentityAction(`withdraw:${dossier.id}`);
    setModuleError('');
    try {
      const response = await fetch(`${API}/lc/dm-dossiers/${encodeURIComponent(dossier.id)}/withdraw-certification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || '撤销申请提交失败');
      await refreshDmIdentity();
      setMsg('DM 身份撤销申请已提交审核。');
    } catch (actionError) {
      setModuleError(actionError instanceof Error ? actionError.message : '撤销申请提交失败');
    } finally {
      setIdentityAction('');
    }
  };

  const closeOnboarding = () => {
    setShowOnboarding(false);
  };

  if (loading) return (
    <div style={{ backgroundColor: C, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '2px solid rgba(201,146,46,0.3)', borderTopColor: GOLD, borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: MUTED }}>加载中...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!creator) return (
    <div style={{ backgroundColor: C, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.3 }}>🌊</div>
        <p style={{ color: MUTED, marginBottom: 20 }}>{error || '加载失败'}</p>
        <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: GOLD, cursor: 'pointer', textDecoration: 'underline', fontSize: '0.875rem' }}>返回登录</button>
      </div>
    </div>
  );

  const profileAvatarUrl = form.avatar || generatedAvatarDataUrl(form.display_name || creator.display_name, creator.id);
  const phoneVerified = !!creator.phone_verified_at;
  const emailVerified = !!creator.email_verified_at;
  const contactVerified = phoneVerified || emailVerified;
  const recentlyVerified = recentlyVerifiedAt(creator.phone_verified_at) || recentlyVerifiedAt(creator.email_verified_at);
  const accountBindExpanded = showAccountBindForm || !contactVerified;
  const passwordExpanded = contactVerified && (showPasswordForm || !creator.has_password);
  const availableItems = availItems.filter(item => !item.is_booked);
  const busyItems = availItems.filter(item => item.is_booked);
  const availableDateSet = new Set(availableItems.map(item => item.date));
  const busyDateSet = new Set(busyItems.map(item => item.date));
  const selectedAvailDateSet = new Set(selectedAvailDates);
  const profileCompletion = getProfileCompletion(form, services, portfolio, rolePreferences);
  const pendingItems = [
    !creator.is_visible,
    myRankings.some(item => item.status === 'pending'),
    myCommissions.some(item => item.status === 'pending'),
    myCarpools.some(item => item.status === 'pending'),
  ].filter(Boolean).length;
  const currentDashboardLabel = DASHBOARD_LABELS[activeSection];
  const roleBasedServiceSelected = services.some(service => ['creator', 'dm'].includes(normalizeServiceCategory(service.service_type)))
    || pendingServices.some(service => ['creator', 'dm'].includes(normalizeServiceCategory(service.service_type)))
    || ['creator', 'dm'].includes(normalizeServiceCategory(newSvc.service_type));

  return (
    <div className="dashboard-page" style={{ backgroundColor: C, minHeight: '100vh', color: INK }}>
      {rankingEdit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, background: 'rgba(15,23,42,0.45)' }}>
          <section style={{ width: '100%', maxWidth: 660, maxHeight: 'calc(100svh - 28px)', overflowY: 'auto', borderRadius: 14, border: '1px solid rgba(201,146,46,0.24)', background: '#fffdf8', boxShadow: '0 28px 80px rgba(15,23,42,0.22)', padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ margin: 0, color: '#925f18', fontSize: 12, fontWeight: 900 }}>小幅修改申请</p>
                <h2 style={{ margin: '4px 0 0', color: INK, fontSize: 18 }}>修改“{rankingEdit.item.subject_name}”的口碑</h2>
              </div>
              <button type="button" aria-label="关闭" onClick={() => setRankingEdit(null)} style={{ border: 0, background: 'transparent', color: MUTED, fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ margin: '9px 0 14px', color: MUTED, fontSize: 12, lineHeight: 1.65 }}>
              可订正错字、补充上下文和事件信息。榜单类型、评价对象、城市、关联档案与发布人不能变更；审核通过前继续展示当前版本。
            </p>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: INK, fontSize: 12, fontWeight: 850 }}>正文内容</span>
              <textarea rows={7} maxLength={4000} value={rankingEdit.content} onChange={event => setRankingEdit(current => current ? { ...current, content: event.target.value, error: '' } : current)} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: '1px solid rgba(201,146,46,0.22)', borderRadius: 9, padding: 11, background: '#fff', color: INK, fontSize: 14, lineHeight: 1.7 }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 9, marginTop: 10 }}>
              {([
                ['event_date', '事件日期', '例：2026-07-17'],
                ['event_script_name', '相关剧本', '可留空'],
                ['event_store_name', '相关店家', '可留空'],
              ] as const).map(([field, label, placeholder]) => (
                <label key={field} style={{ display: 'grid', gap: 5 }}>
                  <span style={{ color: INK, fontSize: 11, fontWeight: 800 }}>{label}</span>
                  <input type={field === 'event_date' ? 'date' : 'text'} value={rankingEdit[field]} placeholder={placeholder} onChange={event => setRankingEdit(current => current ? { ...current, [field]: event.target.value, error: '' } : current)} style={{ minWidth: 0, height: 38, boxSizing: 'border-box', border: '1px solid rgba(201,146,46,0.22)', borderRadius: 8, padding: '0 10px', background: '#fff', color: INK }} />
                </label>
              ))}
            </div>
            <label style={{ display: 'grid', gap: 5, marginTop: 10 }}>
              <span style={{ color: INK, fontSize: 11, fontWeight: 800 }}>对象社交主页</span>
              <input value={rankingEdit.subject_url} placeholder="可留空" onChange={event => setRankingEdit(current => current ? { ...current, subject_url: event.target.value, error: '' } : current)} style={{ height: 38, boxSizing: 'border-box', border: '1px solid rgba(201,146,46,0.22)', borderRadius: 8, padding: '0 10px', background: '#fff', color: INK }} />
            </label>
            {rankingEdit.error && <p style={{ margin: '10px 0 0', color: '#b91c1c', fontSize: 12, lineHeight: 1.55 }}>{rankingEdit.error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setRankingEdit(null)} style={{ ...miniButtonStyle, minWidth: 74 }}>取消</button>
              <button type="button" disabled={rankingEdit.saving} onClick={() => void submitRankingAuthorEdit()} style={{ ...darkActionStyle, minHeight: 36, padding: '7px 14px', opacity: rankingEdit.saving ? 0.6 : 1 }}>{rankingEdit.saving ? '提交中...' : '提交修改审核'}</button>
            </div>
          </section>
        </div>
      )}
      {showOnboarding && (
        <div className="onboarding-backdrop" style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(15,23,42,0.42)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <div className="onboarding-card" style={{
            width: '100%',
            maxWidth: 760,
            maxHeight: 'calc(100svh - 32px)',
            overflowY: 'auto',
            borderRadius: 18,
            background: '#fffdf8',
            border: '1px solid rgba(201,146,46,0.28)',
            boxShadow: '0 28px 80px rgba(15,23,42,0.22)',
            padding: 22,
          }}>
            <p style={{ color: '#925f18', fontWeight: 900, fontSize: '0.78rem', marginBottom: 8 }}>新手教程</p>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.4rem', color: INK, marginBottom: 10 }}>
              先认识一下剧幕录
            </h2>
            <p style={{ color: MUTED, fontSize: '0.88rem', lineHeight: 1.75, marginBottom: 14 }}>
              你已经有登录账号了。登录账号是手机号或邮箱；昵称只是公开展示名，先进来，再慢慢补头像、昵称和主页资料。
            </p>
            <div className="onboarding-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                ['看红黑白榜', '夸人、避雷、记录离谱事；主帖进入审核，证据初次提交选填，相关方可以回应。'],
                ['给万物评分', '剧本、角色、店家、DM/卡司、玩家等都可以沉淀口碑和 tag。'],
                ['打榜与投票', '榜金只表达正向支持强度；同意、反对、离谱这类一人一票态度单独保留。'],
                ['讨论圈内行为', '比如睡车、加戏、拒绝边界等，可以通过投票和口碑记录形成共识。'],
                ['设置个人主页', '头像、昵称、常用城市先补上；公开资料提交后会进入审核。'],
                ['成为服务者', '只有填写并通过服务审核的人，才会出现在服务大厅。'],
              ].map(([title, desc]) => (
                <div key={title} className="onboarding-item" style={{ padding: '11px 12px', borderRadius: 12, background: 'rgba(239,246,255,0.78)', border: '1px solid rgba(125,147,170,0.14)' }}>
                  <p style={{ color: INK, fontWeight: 900, fontSize: '0.86rem', marginBottom: 4 }}>{title}</p>
                  <p style={{ color: 'rgba(71,85,105,0.68)', fontSize: '0.78rem', lineHeight: 1.65 }}>{desc}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => { closeOnboarding(); navigate('/rankings'); }} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.22)', background: '#fff', color: '#925f18', fontWeight: 850, cursor: 'pointer' }}>
                看红黑榜
              </button>
              <button type="button" onClick={() => { closeOnboarding(); setOffersServices(true); navigate('/dashboard/services'); }} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.22)', background: '#fff', color: '#925f18', fontWeight: 850, cursor: 'pointer' }}>
                我要提供服务
              </button>
              <button type="button" onClick={() => { closeOnboarding(); navigate('/dashboard/profile'); }} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${GOLD}, #c9922e)`, color: INK, fontWeight: 900, cursor: 'pointer' }}>
                设置头像昵称
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-body" style={{ maxWidth: 1440, margin: '0 auto', padding: '12px 20px 80px' }}>

        <div className="dashboard-context" style={{ minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 2px 10px', borderBottom: '1px solid rgba(31,41,55,0.08)', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0 }}>
            <span style={{ color: '#925f18', fontSize: 12, fontWeight: 900 }}>个人后台</span>
            <strong style={{ color: INK, fontSize: 16 }}>{currentDashboardLabel}</strong>
          </div>
          <Link to={`/explore/${creator.id}`} style={{ ...secondaryActionStyle, minHeight: 34 }}>预览公开主页</Link>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(254,242,242,0.92)', border: '1px solid rgba(220,38,38,0.24)', borderRadius: 10, fontSize: '0.875rem', color: '#b91c1c', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* 审核状态 banner */}
        {!creator.is_visible && (
          <div style={{
            padding: '14px 18px', borderRadius: 12, marginBottom: 20,
            backgroundColor: creator.reject_reason ? 'rgba(254,242,242,0.92)' : 'rgba(201,146,46,0.1)',
            border: `1px solid ${creator.reject_reason ? 'rgba(220,38,38,0.24)' : 'rgba(201,146,46,0.25)'}`,
            fontSize: '0.875rem',
            color: creator.reject_reason ? '#b91c1c' : '#925f18',
          }}>
            {creator.reject_reason
              ? `您的入驻申请已被拒绝。原因：${creator.reject_reason}`
              : '您的主页当前未公开。账号仍可正常使用，发布到红黑榜的内容会单独进入人工审核。'}
          </div>
        )}

        <div className="dashboard-layout" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

          {/* ── 左侧导航 ── */}
          <div className="dashboard-tabs" style={{ width: 216, minHeight: 0, flexShrink: 0, position: 'sticky', top: 78, ...card, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="dashboard-side-head" style={{ display: 'grid', gap: 6, paddingBottom: 8 }}>
              <p style={{ color: INK, fontSize: 14, fontWeight: 900, lineHeight: 1 }}>主页管理</p>
              <p style={{ color: 'rgba(71,85,105,0.70)', fontSize: 12, fontWeight: 700, lineHeight: 1.35 }}>
                {form.display_name || creator.display_name}{services.length > 0 ? ` · ${services.slice(0, 2).map(item => serviceCategoryLabel(item.service_type)).join(' / ')}` : ' · 普通用户'}
              </p>
            </div>
            <nav className="dashboard-side-nav" style={{ display: 'grid', gap: 4, paddingTop: 8 }}>
              {DASHBOARD_NAV.map(item => {
                const active = item.key === activeSection;
                return (
                  <Link key={item.key} to={item.path} className="dashboard-tab-btn" style={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: item.child ? 34 : 38,
                    padding: item.child ? '0 10px 0 22px' : '0 10px',
                    borderRadius: 8,
                    border: active ? '1px solid rgba(39,83,137,0.14)' : '1px solid transparent',
                    background: active ? '#EEF6FF' : 'transparent',
                    color: active ? '#275389' : 'rgba(71,85,105,0.70)',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: active ? 900 : 750,
                  }}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ── 主内容区 ── */}
          <div className="dashboard-main" style={{ flex: 1, minWidth: 0 }}>

            {activeSection === 'overview' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <PageIntro
                  eyebrow="HOME BASE"
                  title="个人主页"
                  subtitle="主屏只放公开展示和经营状态；账号、余额、安全都拆到独立页。"
                  action={<Link to="/dashboard/services" style={primaryActionStyle}>发布新服务</Link>}
                />
                <div className="dashboard-metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                  <MetricCard label="资料完整度" value={`${profileCompletion}%`} tone="blue" />
                  <MetricCard label="可展示服务" value={`${services.length} 项`} tone="green" />
                  <MetricCard label="待处理" value={`${pendingItems} 件`} tone="gold" />
                </div>
                <section style={{ ...card, minHeight: 198 }}>
                  <h2 style={{ color: INK, fontSize: 15, fontWeight: 900, marginBottom: 12 }}>今日处理</h2>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <OverviewRow label="公开页" value={creator.is_visible ? '可访问' : '资料审核中'} tone={creator.is_visible ? 'green' : 'gold'} />
                    <OverviewRow label="服务身份" value={services.length > 0 ? `${services.length} 项` : '未添加'} tone={services.length > 0 ? 'green' : 'red'} />
                    <OverviewRow label="本周档期" value={`${availableItems.length} 天可约`} tone={availableItems.length > 0 ? 'green' : 'gray'} />
                  </div>
                </section>
                <div className="dashboard-quick-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                  {[
                    { title: '公开资料', copy: '编辑别人看到的主页信息。', to: '/dashboard/profile' },
                    { title: '服务与作品', copy: '维护摄影、委托和作品集。', to: '/dashboard/services' },
                    { title: '我的发布', copy: '查看发布内容与审核状态。', to: '/dashboard/posts' },
                  ].map(item => (
                    <Link key={item.title} to={item.to} style={{ ...card, minHeight: 110, display: 'grid', gap: 10, textDecoration: 'none' }}>
                      <span style={{ color: INK, fontSize: 15, fontWeight: 900 }}>{item.title}</span>
                      <span style={{ color: MUTED, fontSize: 13, fontWeight: 700, lineHeight: 1.55 }}>{item.copy}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 资料 */}
            {activeSection === 'profile' && (
              <div className="dashboard-card profile-editor-card" style={card}>
                <h2 style={{ fontWeight: 900, fontSize: '1.05rem', marginBottom: 16, color: INK }}>公开主页资料</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, border: '1px solid rgba(31,41,55,0.08)', background: '#FFFDF8', marginBottom: 14 }}>
                  <img src={profileAvatarUrl} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', objectPosition: `${form.avatar_focus_x}% ${form.avatar_focus_y}%`, border: '1px solid rgba(39,83,137,0.16)', background: '#EEF6FF' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: INK, fontSize: 13, fontWeight: 900, marginBottom: 5 }}>公开头像</p>
                    <p style={{ color: MUTED, fontSize: 12, fontWeight: 650, lineHeight: 1.5 }}>头像上传后会提交审核，通过后显示在公开页。</p>
                  </div>
                  <ImageUpload onUploaded={handleAvatarUploaded} token={token} api={API} scope="avatar" label="更换头像" variant="compact" hidePreview />
                </div>
                {form.avatar && (
                  <div style={{ margin: '-2px 0 14px' }}>
                    <ImageFocusPicker
                      src={form.avatar}
                      focusX={form.avatar_focus_x}
                      focusY={form.avatar_focus_y}
                      label="头像展示位置"
                      onChange={({ x, y }) => setForm(prev => ({ ...prev, avatar_focus_x: x, avatar_focus_y: y }))}
                    />
                  </div>
                )}
                <div className="dashboard-panel account-panel" style={{
                  padding: '16px',
                  borderRadius: 14,
                  marginBottom: 20,
                  backgroundColor: 'rgba(255,255,255,0.78)',
                  border: '1px solid rgba(125,147,170,0.16)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
                    <div>
                      <p style={{ color: INK, fontWeight: 900, fontSize: '0.92rem', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        账号互通
                        <InfoTip>
                          小程序微信登录、邮箱验证和手机号验证会进入同一个剧幕录账号。设置密码后，可用手机号或邮箱加密码登录。
                        </InfoTip>
                      </p>
                    </div>
                    <span style={{
                      padding: '5px 10px',
                      borderRadius: 999,
                      background: contactVerified && creator.has_password ? 'rgba(220,252,231,0.86)' : 'rgba(255,247,237,0.96)',
                      color: contactVerified && creator.has_password ? '#15803d' : '#925f18',
                      fontWeight: 900,
                      fontSize: '0.75rem',
                    }}>
                      {contactVerified ? (creator.has_password ? '网页登录已完整开通' : '已可验证码登录') : '待验证账号'}
                    </span>
                  </div>
                  <div className="account-emoji-row">
                    <EmojiStatus icon="📱" tone={phoneVerified ? 'ok' : 'warn'} label={phoneVerified ? '✓' : '未绑'}>
                      {creator.phone ? (
                        <>
                          <strong>手机号：{creator.phone}</strong>
                          <br />
                          用于找回账号和更敏感的身份校验。
                        </>
                      ) : '暂未绑定手机号，可点击下方按钮绑定或更换。'}
                    </EmojiStatus>
                    <EmojiStatus icon="✉️" tone={emailVerified ? 'ok' : 'warn'} label={emailVerified ? '✓' : '未绑'}>
                      {creator.email ? (
                        <>
                          <strong>邮箱：{creator.email}</strong>
                          <br />
                          可用于注册、登录、找回密码和接收平台通知。
                        </>
                      ) : '暂未绑定邮箱，可点击下方按钮绑定。'}
                    </EmojiStatus>
                    <EmojiStatus icon="🔐" tone={creator.has_password ? 'ok' : 'warn'} label={creator.has_password ? '✓' : '未设'}>
                      {creator.has_password ? '日常登录可直接使用账号加密码。' : '设置后可以减少验证码发送次数。'}
                    </EmojiStatus>
                  </div>

                  <div className="account-action-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: (accountBindExpanded || passwordExpanded) ? 12 : 0 }}>
                    <button type="button" onClick={() => setShowAccountBindForm(v => !v)} style={{
                      padding: '5px 10px',
                      border: '1px solid rgba(201,146,46,0.28)',
                      borderRadius: 999,
                      background: showAccountBindForm ? 'rgba(217,168,87,0.14)' : '#fffaf2',
                      color: '#925f18',
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}>
                      {showAccountBindForm ? '收起' : phoneVerified ? '更换手机号' : '绑定手机号'}
                    </button>
                    <button type="button" onClick={() => setShowPasswordForm(v => !v)} disabled={!contactVerified} style={{
                      padding: '5px 10px',
                      border: '1px solid rgba(201,146,46,0.28)',
                      borderRadius: 999,
                      background: !contactVerified ? 'rgba(226,232,240,0.72)' : showPasswordForm ? 'rgba(217,168,87,0.14)' : '#fffaf2',
                      color: contactVerified ? '#925f18' : 'rgba(71,85,105,0.52)',
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      cursor: !contactVerified ? 'not-allowed' : 'pointer',
                    }}>
                      {showPasswordForm ? '收起' : creator.has_password ? '修改密码' : '设置密码'}
                    </button>
                  </div>

                  {accountBindExpanded && (
                    <div className="account-bind-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
                      <input
                        type="tel"
                        value={bindPhone}
                        onChange={e => setBindPhone(e.target.value)}
                        placeholder={phoneVerified ? '输入新的手机号' : '绑定手机号'}
                        style={inputStyle}
                      />
                      <input
                        type="text"
                        value={bindCode}
                        onChange={e => setBindCode(e.target.value)}
                        placeholder="短信验证码"
                        style={inputStyle}
                      />
                      <button type="button" onClick={sendBindPhoneCode} disabled={sendingBindCode} style={{
                        border: '1px solid rgba(201,146,46,0.28)',
                        borderRadius: 10,
                        background: '#fffaf2',
                        color: '#925f18',
                        fontWeight: 900,
                        cursor: sendingBindCode ? 'wait' : 'pointer',
                      }}>
                        {sendingBindCode ? '发送中...' : '发送验证码'}
                      </button>
                      <button type="button" onClick={bindPhoneToAccount} disabled={bindingPhone} style={{
                        border: 'none',
                        borderRadius: 10,
                        background: `linear-gradient(135deg, ${GOLD}, #c9922e)`,
                        color: INK,
                        fontWeight: 900,
                        cursor: bindingPhone ? 'wait' : 'pointer',
                      }}>
                        {bindingPhone ? '保存中...' : phoneVerified ? '保存新手机号' : '绑定手机号'}
                      </button>
                    </div>
                  )}

                  {passwordExpanded && (
                    <>
                      {!recentlyVerified && contactVerified && (
                        <div className="password-verify-grid" style={{ display: 'grid', gridTemplateColumns: '112px minmax(160px, 1fr) auto', gap: 10, marginBottom: 10 }}>
                          <select
                            value={passwordVerifyType}
                            onChange={e => setPasswordVerifyType(e.target.value as 'phone' | 'email')}
                            style={inputStyle}
                          >
                            <option value="email" disabled={!creator.email}>邮箱</option>
                            <option value="phone" disabled={!creator.phone}>手机号</option>
                          </select>
                          <input
                            type="text"
                            value={passwordVerifyCode}
                            onChange={e => setPasswordVerifyCode(e.target.value)}
                            placeholder="修改密码验证码"
                            style={inputStyle}
                          />
                          <button type="button" onClick={sendPasswordVerifyCode} disabled={sendingPasswordVerifyCode} style={{
                            padding: '0 14px',
                            border: '1px solid rgba(201,146,46,0.28)',
                            borderRadius: 10,
                            background: '#fffaf2',
                            color: '#925f18',
                            fontWeight: 900,
                            cursor: sendingPasswordVerifyCode ? 'wait' : 'pointer',
                          }}>
                            {sendingPasswordVerifyCode ? '发送中...' : '发送改密验证码'}
                          </button>
                        </div>
                      )}
                      <div className="password-set-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) auto', gap: 10 }}>
                        <input
                          type="password"
                          value={bindPassword}
                          onChange={e => setBindPassword(e.target.value)}
                          placeholder={creator.has_password ? '输入新密码可修改' : '设置网页登录密码'}
                          style={inputStyle}
                        />
                        <button type="button" onClick={setWebPassword} disabled={settingPassword || !contactVerified} style={{
                          padding: '0 18px',
                          border: '1px solid rgba(201,146,46,0.28)',
                          borderRadius: 10,
                          background: contactVerified ? '#fffaf2' : 'rgba(226,232,240,0.72)',
                          color: contactVerified ? '#925f18' : 'rgba(71,85,105,0.52)',
                          fontWeight: 900,
                          cursor: settingPassword ? 'wait' : contactVerified ? 'pointer' : 'not-allowed',
                        }}>
                          {settingPassword ? '保存中...' : creator.has_password ? '修改密码' : '设置密码'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="identity-check-row">
                  <CompactStatus ok={creator.is_realname} tone={creator.is_realname ? 'gold' : 'muted'} label={creator.is_realname ? '实名已认证' : '实名未认证'}>
                    实名由后台审核，前台只显示星标和昵称，不公开真实姓名。需要认证时可提交水印身份证材料。
                  </CompactStatus>
                  <Link to="/dashboard/certification" className="inline-action-link">
                    {creator.is_realname ? '查看认证' : '去认证'}
                  </Link>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <DraftAutosaveNotice
                    savedAt={profileDraft.savedAt}
                    restoredAt={profileDraft.restoredAt}
                    error={profileDraft.error}
                    note="未保存的主页资料会自动保存到当前浏览器。"
                  />
                </div>
                <div className="profile-grid-compact" style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1.1fr) minmax(120px, 0.8fr) minmax(110px, 0.7fr) minmax(130px, 0.8fr)', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>昵称 / 艺名</label>
                    <input type="text" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>城市</label>
                    <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="如：上海" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>性别</label>
                    <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} style={inputStyle}>
                      <option value="">不填写</option>
                      <option value="男">男</option>
                      <option value="女">女</option>
                      <option value="其他">其他</option>
                      <option value="不公开">不公开</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>性取向</label>
                    <select value={form.sexual_orientation} onChange={e => setForm({ ...form, sexual_orientation: e.target.value })} style={inputStyle}>
                      <option value="">不填写</option>
                      <option value="异性恋">异性恋</option>
                      <option value="同性恋">同性恋</option>
                      <option value="双性恋">双性恋</option>
                      <option value="泛性恋">泛性恋</option>
                      <option value="无性恋">无性恋</option>
                      <option value="其他">其他</option>
                      <option value="不公开">不公开</option>
                    </select>
                  </div>
                </div>
                <div className="profile-grid-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>吃什么线（逗号分隔）</label>
                    <input type="text" value={form.preferred_story_lines} onChange={e => setForm({ ...form, preferred_story_lines: e.target.value })} placeholder="亲情线, 爱情线, 权谋线, 事业线" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>标签（逗号分隔）</label>
                    <input type="text" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                      placeholder="恋陪, 情感本, 日系" style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>简介</label>
                  <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3}
                    style={{ ...inputStyle, resize: 'none' }} />
                </div>
                <div className="profile-grid-2 social-link-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>抖音主页链接</label>
                    <input type="text" value={form.douyin} onChange={e => setForm({ ...form, douyin: e.target.value })} onBlur={e => normalizeSocialField('douyin', e.target.value)} onPaste={e => { const url = extractSharedUrl(e.clipboardData.getData('text')); if (url) { e.preventDefault(); normalizeSocialField('douyin', url); } }} placeholder="可直接粘贴整段抖音分享文案" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>小红书主页链接</label>
                    <input type="text" value={form.xiaohongshu} onChange={e => setForm({ ...form, xiaohongshu: e.target.value })} onBlur={e => normalizeSocialField('xiaohongshu', e.target.value)} onPaste={e => { const url = extractSharedUrl(e.clipboardData.getData('text')); if (url) { e.preventDefault(); normalizeSocialField('xiaohongshu', url); } }} placeholder="可直接粘贴整段小红书分享文案" style={inputStyle} />
                  </div>
                </div>
                <div className="profile-grid-compact" style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 0.7fr) minmax(190px, 1.2fr) minmax(150px, 0.9fr)', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>常驻城市 / 流动状态</label>
                    <select value={form.travel_status} onChange={e => setForm({ ...form, travel_status: e.target.value })} style={inputStyle}>
                      <option value={RESIDENT_TRAVEL_STATUS}>{formatTravelStatus(RESIDENT_TRAVEL_STATUS, form.city)}</option>
                      <option value="全国流动">全国流动</option>
                      <option value="巡游中">巡游中</option>
                      <option value="远程可接">远程可接</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>可接城市（逗号分隔）</label>
                    <input type="text" value={form.available_cities} onChange={e => setForm({ ...form, available_cities: e.target.value })} placeholder="北京, 上海, 杭州" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>微信（通过申请后可见）</label>
                    <input type="text" value={form.wechat} onChange={e => setForm({ ...form, wechat: e.target.value })} placeholder="不公开展示" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button onClick={() => saveProfile()} disabled={saving}
                    style={{
                      padding: '11px 28px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                      background: saving ? 'rgba(241,245,249,0.86)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                      color: saving ? 'rgba(71,85,105,0.52)' : INK, fontWeight: 700, fontSize: '0.9rem',
                    }}>
                    {saving ? '保存中...' : '保存资料'}
                  </button>
                  {msg && <span style={{ fontSize: '0.875rem', color: '#15803d', fontWeight: 600 }}>{msg}</span>}
                </div>
              </div>
            )}

            {activeSection === 'account' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <PageIntro
                  eyebrow="SECURITY"
                  title="账号与安全"
                  subtitle="手机号、邮箱、密码和登录状态单独收纳，不再挤在公开主页资料首屏。"
                  action={contactVerified ? <button type="button" onClick={() => setShowPasswordForm(v => !v)} style={darkActionStyle}>{creator.has_password ? '修改密码' : '设置密码'}</button> : null}
                />
                <div className="dashboard-metric-grid account-security-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                  <SecurityCard title="手机号" value={creator.phone || '未绑定'} status={phoneVerified ? '已验证' : '待验证'} tone={phoneVerified ? 'green' : 'gold'} />
                  <SecurityCard title="邮箱" value={creator.email || '未绑定'} status={emailVerified ? '已验证' : '待验证'} tone={emailVerified ? 'green' : 'gold'} />
                  <SecurityCard title="网页登录密码" value={creator.has_password ? '已设置' : '未设置'} status={creator.has_password ? '可用' : '建议设置'} tone={creator.has_password ? 'green' : 'red'} />
                </div>
                <section style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                    <div>
                      <h2 style={{ color: INK, fontSize: 15, fontWeight: 900, marginBottom: 5 }}>账号操作</h2>
                      <p style={{ color: MUTED, fontSize: 13, fontWeight: 650 }}>登录账号是手机号或邮箱；昵称只用于公开展示。</p>
                    </div>
                    <div className="account-action-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button type="button" onClick={() => setShowAccountBindForm(v => !v)} style={secondaryActionStyle}>
                        {showAccountBindForm ? '收起' : phoneVerified ? '更换手机号' : '绑定手机号'}
                      </button>
                      <button type="button" onClick={() => setShowPasswordForm(v => !v)} disabled={!contactVerified} style={{ ...secondaryActionStyle, opacity: contactVerified ? 1 : 0.56, cursor: contactVerified ? 'pointer' : 'not-allowed' }}>
                        {showPasswordForm ? '收起' : creator.has_password ? '修改密码' : '设置密码'}
                      </button>
                    </div>
                  </div>

                  {accountBindExpanded && (
                    <div className="account-bind-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
                      <input type="tel" value={bindPhone} onChange={e => setBindPhone(e.target.value)} placeholder={phoneVerified ? '输入新的手机号' : '绑定手机号'} style={inputStyle} />
                      <input type="text" value={bindCode} onChange={e => setBindCode(e.target.value)} placeholder="短信验证码" style={inputStyle} />
                      <button type="button" onClick={sendBindPhoneCode} disabled={sendingBindCode} style={secondaryActionStyle}>
                        {sendingBindCode ? '发送中...' : '发送验证码'}
                      </button>
                      <button type="button" onClick={bindPhoneToAccount} disabled={bindingPhone} style={primaryButtonStyle}>
                        {bindingPhone ? '保存中...' : phoneVerified ? '保存新手机号' : '绑定手机号'}
                      </button>
                    </div>
                  )}

                  {passwordExpanded && (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {!recentlyVerified && contactVerified && (
                        <div className="password-verify-grid" style={{ display: 'grid', gridTemplateColumns: '112px minmax(160px, 1fr) auto', gap: 10 }}>
                          <select value={passwordVerifyType} onChange={e => setPasswordVerifyType(e.target.value as 'phone' | 'email')} style={inputStyle}>
                            <option value="email" disabled={!creator.email}>邮箱</option>
                            <option value="phone" disabled={!creator.phone}>手机号</option>
                          </select>
                          <input type="text" value={passwordVerifyCode} onChange={e => setPasswordVerifyCode(e.target.value)} placeholder="修改密码验证码" style={inputStyle} />
                          <button type="button" onClick={sendPasswordVerifyCode} disabled={sendingPasswordVerifyCode} style={secondaryActionStyle}>
                            {sendingPasswordVerifyCode ? '发送中...' : '发送改密验证码'}
                          </button>
                        </div>
                      )}
                      <div className="password-set-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) auto', gap: 10 }}>
                        <input type="password" value={bindPassword} onChange={e => setBindPassword(e.target.value)} placeholder={creator.has_password ? '输入新密码可修改' : '设置网页登录密码'} style={inputStyle} />
                        <button type="button" onClick={setWebPassword} disabled={settingPassword || !contactVerified} style={{ ...primaryButtonStyle, opacity: contactVerified ? 1 : 0.56, cursor: settingPassword ? 'wait' : contactVerified ? 'pointer' : 'not-allowed' }}>
                          {settingPassword ? '保存中...' : creator.has_password ? '修改密码' : '设置密码'}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
                <section style={{ ...card, minHeight: 150 }}>
                  <h2 style={{ color: INK, fontSize: 15, fontWeight: 900, marginBottom: 12 }}>登录设备</h2>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <OverviewRow label="当前浏览器" value="当前会话" tone="green" />
                    <OverviewRow label="异常处理" value="如发现账号异常，请先修改密码" tone="gray" />
                  </div>
                </section>
                {msg && <p style={{ color: '#15803d', fontSize: 13, fontWeight: 800 }}>{msg}</p>}
                {error && <p style={{ color: '#b91c1c', fontSize: 13, fontWeight: 800 }}>{error}</p>}
              </div>
            )}

            {/* 服务 */}
            {activeSection === 'services' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <PageIntro
                  eyebrow="SERVICES"
                  title="服务与作品"
                  subtitle="先决定是否提供服务；作品集和可约档期已经拆到独立子页。"
                />
                <div className="dashboard-panel service-choice-panel" style={{ ...card, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontWeight: 900, color: INK, fontSize: '0.94rem', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        是否在剧幕录上提供服务
                        <InfoTip>选择提供服务后，再填写服务类目和报价；审核通过后会展示在服务大厅。选择暂不提供时，本页不再显示服务表单。</InfoTip>
                      </p>
                    </div>
                    <div className="service-choice-buttons" style={{ display: 'inline-flex', gap: 6, padding: 4, borderRadius: 999, background: 'rgba(241,245,249,0.86)', border: '1px solid rgba(125,147,170,0.14)' }}>
                      <button type="button" onClick={() => setOffersServices(true)}
                        style={{
                          padding: '7px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                          background: offersServices ? `linear-gradient(135deg, ${GOLD}, #c9922e)` : 'transparent',
                          color: offersServices ? INK : 'rgba(71,85,105,0.72)', fontWeight: 900, fontSize: '0.78rem',
                        }}>
                        提供服务
                      </button>
                      <button type="button" onClick={() => setOffersServices(false)}
                        style={{
                          padding: '7px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                          background: !offersServices ? '#fff' : 'transparent',
                          color: !offersServices ? INK : 'rgba(71,85,105,0.62)', fontWeight: 900, fontSize: '0.78rem',
                        }}>
                        暂不提供
                      </button>
                    </div>
                  </div>
                </div>
                {offersServices && (
                  <>
                <div className="dashboard-panel" style={{ ...card, background: '#EEF6FF', border: '1px solid rgba(39,83,137,0.14)' }}>
                  <p style={{ color: '#275389', fontSize: '0.86rem', fontWeight: 850, lineHeight: 1.65 }}>
                    服务通过人工审核后，会出现在服务大厅；未审核通过前不会公开展示。
                  </p>
                </div>

                {roleBasedServiceSelected && (
                <div className="dashboard-panel role-panel" style={{ ...card }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                    <div>
                      <p style={{ fontWeight: 800, color: INK, fontSize: '0.92rem', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        可接本与角色
                        <InfoTip>只能从剧本库选择。库里没有的本或角色，先维护剧本库，审核通过后再添加到主页。</InfoTip>
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Link to="/scripts/contribute" style={{ padding: '6px 12px', borderRadius: 10, background: 'rgba(31,41,55,0.92)', color: '#fffaf2', textDecoration: 'none', fontSize: '0.76rem', fontWeight: 850 }}>
                        维护剧本库
                      </Link>
                      <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(217,168,87,0.12)', color: '#925f18', fontSize: '0.76rem', fontWeight: 800 }}>
                        {rolePreferences.length} 个角色
                      </span>
                    </div>
                  </div>

                  <div className="profile-grid-auto" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>从剧本库选择</label>
                      <select value={roleDraft.script_id} onChange={e => selectRoleScript(e.target.value)} style={inputStyle}>
                        <option value="">请选择剧本</option>
                        {scripts.map(script => (
                          <option key={script.id} value={script.id}>{script.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>从角色库选择</label>
                      <select value={roleDraft.role_name} onChange={e => selectRoleName(e.target.value)} disabled={selectedScriptRoles.length === 0} style={{ ...inputStyle, opacity: selectedScriptRoles.length === 0 ? 0.65 : 1 }}>
                        <option value="">{selectedScript ? '请选择角色' : '先选择剧本'}</option>
                        {selectedScriptRoles.map(role => (
                          <option key={role.role_name} value={role.role_name}>{role.role_name}{role.gender ? `（${role.gender}）` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>角色性别</label>
                      <input value={roleDraft.role_gender || (selectedRole ? '剧本库未填' : '')} readOnly placeholder="从剧本库带出" style={{ ...inputStyle, backgroundColor: 'rgba(241,245,249,0.72)', color: 'rgba(71,85,105,0.72)' }} />
                    </div>
                    <div>
                      <label style={labelStyle}>备注</label>
                      <input value={roleDraft.note} onChange={e => setRoleDraft(prev => ({ ...prev, note: e.target.value }))} placeholder="如：最推荐 / 情绪线更稳" style={inputStyle} />
                    </div>
                  </div>

                  {(scripts.length === 0 || (selectedScript && selectedScriptRoles.length === 0)) && (
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,247,237,0.88)', border: '1px solid rgba(217,168,87,0.2)', color: '#925f18', fontSize: '0.78rem', lineHeight: 1.7, marginBottom: 12 }}>
                      {scripts.length === 0 ? '当前剧本库还没有可选剧本。' : '这个剧本还没有角色。'}
                      <Link to="/scripts/contribute" style={{ color: '#925f18', fontWeight: 900, marginLeft: 6, textDecoration: 'underline' }}>去维护剧本库</Link>
                    </div>
                  )}

                  {roleDraft.role_tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {roleDraft.role_tags.map(tag => (
                        <span key={tag} style={{ padding: '3px 9px', borderRadius: 999, background: 'rgba(239,246,255,0.9)', border: '1px solid rgba(59,130,246,0.16)', color: '#275389', fontSize: '0.74rem', fontWeight: 700 }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: rolePreferences.length ? 14 : 0 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'rgba(71,85,105,0.78)', fontSize: '0.82rem', fontWeight: 700 }}>
                      <input type="checkbox" checked={roleDraft.is_recommended} onChange={e => setRoleDraft(prev => ({ ...prev, is_recommended: e.target.checked }))} />
                      推荐角色
                    </label>
                    <button type="button" onClick={addRolePreference} disabled={!selectedScript || !selectedRole}
                      style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: selectedScript && selectedRole ? 'rgba(31,41,55,0.92)' : 'rgba(148,163,184,0.38)', color: selectedScript && selectedRole ? '#fffaf2' : 'rgba(71,85,105,0.58)', fontWeight: 800, fontSize: '0.82rem', cursor: selectedScript && selectedRole ? 'pointer' : 'not-allowed' }}>
                      加入清单
                    </button>
                  </div>

                  {rolePreferences.length > 0 && (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {rolePreferences.map((item, index) => (
                        <div key={`${item.script_name}-${item.role_name}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(201,146,46,0.16)', background: 'rgba(255,250,242,0.86)' }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: INK, fontSize: '0.86rem', fontWeight: 800, marginBottom: 4 }}>
                              {item.script_name} · {item.role_name}
                              {item.role_gender && <span style={{ color: 'rgba(71,85,105,0.6)', fontWeight: 700 }}>（{item.role_gender}）</span>}
                            </p>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {item.is_recommended && <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(217,168,87,0.16)', color: '#925f18', fontSize: '0.7rem', fontWeight: 900 }}>推荐</span>}
                              {item.role_tags.map(tag => <span key={tag} style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.74rem' }}>#{tag}</span>)}
                              {item.note && <span style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.74rem' }}>{item.note}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            <button type="button" onClick={() => toggleRolePreferenceRecommended(index)}
                              style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid rgba(201,146,46,0.22)', background: item.is_recommended ? 'rgba(217,168,87,0.16)' : '#fff', color: '#925f18', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}>
                              {item.is_recommended ? '取消推荐' : '设为推荐'}
                            </button>
                            <button type="button" onClick={() => removeRolePreference(index)}
                              style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid rgba(185,28,28,0.18)', background: 'rgba(254,242,242,0.72)', color: '#b91c1c', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}>
                              删除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ color: INK, fontSize: 15, fontWeight: 900, marginBottom: 4 }}>提供什么服务</h2>
                    <p style={{ color: MUTED, fontSize: 13, fontWeight: 650 }}>选择清楚的服务类目，比大段自我介绍更容易进入大厅筛选。</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link to="/dashboard/services/works" style={secondaryActionStyle}>作品集</Link>
                    <Link to="/dashboard/services/availability" style={secondaryActionStyle}>可约档期</Link>
                  </div>
                </div>

                {services.map(s => (
                  <div key={s.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.service_type}</span>
                      {normalizeServiceCategory(s.service_type) !== 'custom' && (
                        <span style={{ marginLeft: 8, padding: '3px 8px', borderRadius: 999, background: 'rgba(39,83,137,0.09)', color: '#275389', fontSize: '0.72rem', fontWeight: 850 }}>
                          {serviceCategoryLabel(s.service_type)}
                        </span>
                      )}
                      {s.duration && <span style={{ fontSize: '0.82rem', color: 'rgba(71,85,105,0.62)', marginLeft: 8 }}>· {s.duration}</span>}
                      {s.description && <p style={{ fontSize: '0.8rem', color: 'rgba(71,85,105,0.62)', marginTop: 4 }}>{s.description}</p>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontWeight: 700, color: GOLD }}>¥{s.price}</span>
                      <button onClick={() => deleteService(s.id)}
                        style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.82rem' }}>删除</button>
                    </div>
                  </div>
                ))}
                <div style={{ ...card, border: '1px dashed rgba(201,146,46,0.25)' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: INK }}>新增服务</p>
                  <div style={{ marginBottom: 12 }}>
                    <DraftAutosaveNotice
                      savedAt={serviceDraft.savedAt}
                      restoredAt={serviceDraft.restoredAt}
                      error={serviceDraft.error}
                      note="未添加的服务会自动保存到当前浏览器。"
                    />
                  </div>
                  <div className="service-add-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(100px, 0.55fr) minmax(130px, 0.7fr)', gap: 12, marginBottom: 12 }}>
                    <select value={newSvc.service_type} onChange={e => setNewSvc({ ...newSvc, service_type: e.target.value })} style={inputStyle}>
                      <option value="">选择服务类目</option>
                      {SERVICE_CATEGORY_OPTIONS.map(option => (
                        <option key={option.key} value={option.label}>{option.label}（{option.examples}）</option>
                      ))}
                    </select>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={newSvc.price} onChange={e => setNewSvc({ ...newSvc, price: sanitizeIntegerInput(e.target.value) })}
                      placeholder="价格（元）" style={inputStyle} />
                    <input type="text" value={newSvc.duration} onChange={e => setNewSvc({ ...newSvc, duration: e.target.value })}
                      placeholder="时长（如：2小时）" style={inputStyle} />
                  </div>
                  <textarea value={newSvc.description} onChange={e => setNewSvc({ ...newSvc, description: e.target.value })}
                    placeholder="服务说明：例如可拍什么风格、是否可跟车、交付多少张图、是否可异地等"
                    style={{ ...inputStyle, minHeight: 82, resize: 'vertical', marginBottom: 12 }} />
                  <button onClick={addServiceDraft}
                    style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.28)', cursor: 'pointer', background: 'rgba(255,250,242,0.92)', color: '#925f18', fontWeight: 800, fontSize: '0.875rem' }}>
                    加入上线清单
                  </button>
                  {pendingServices.length > 0 && (
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(201,146,46,0.14)' }}>
                      <p style={{ fontWeight: 800, fontSize: '0.86rem', color: INK, marginBottom: 10 }}>待提交上线清单</p>
                      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                        {pendingServices.map((item, index) => (
                          <div key={`${serviceDraftKey(item)}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 10px', borderRadius: 10, background: 'rgba(255,250,242,0.9)', border: '1px solid rgba(201,146,46,0.16)' }}>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontWeight: 800, fontSize: '0.84rem', color: INK }}>{item.service_type} · ¥{item.price}</p>
                              {(item.duration || item.description) && (
                                <p style={{ fontSize: '0.76rem', color: 'rgba(71,85,105,0.62)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {[item.duration, item.description].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>
                            <button onClick={() => setPendingServices(prev => prev.filter((_, itemIndex) => itemIndex !== index))}
                              style={{ flex: '0 0 auto', background: 'transparent', border: 'none', color: 'rgba(146,95,24,0.74)', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem' }}>
                              移除
                            </button>
                          </div>
                        ))}
                      </div>
                      <button onClick={submitServicesForReview} disabled={submittingServices}
                        style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: submittingServices ? 'not-allowed' : 'pointer', background: submittingServices ? 'rgba(201,146,46,0.34)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: INK, fontWeight: 850, fontSize: '0.875rem' }}>
                        {submittingServices ? '提交中...' : '提交服务上线审核'}
                      </button>
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>
            )}

            {/* 档期 */}
            {activeSection === 'serviceAvailability' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <PageIntro
                  eyebrow="AVAILABILITY"
                  title="可约档期"
                  subtitle="手动标记可约日期，或同步剧司辰已排档期作为忙碌时间。"
                  action={<Link to="/dashboard/services" style={secondaryActionStyle}>返回服务</Link>}
                />
                <div style={card}>
                  <p style={{ fontWeight: 800, fontSize: '0.96rem', marginBottom: 12, color: INK, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    手动标记可约日期
                    <InfoTip>新标记的日期会先提交审核，通过后显示在公开主页上，代表可以被委托人预约。</InfoTip>
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 560, marginBottom: 18 }}>
                    <input value={availCity} onChange={e => setAvailCity(e.target.value)} placeholder="这批档期所在城市（默认用常驻城市）" style={inputStyle} />
                    <input value={availLocation} onChange={e => setAvailLocation(e.target.value)} placeholder="地点补充，如展会/区县/可商量" style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, fontSize: '0.76rem', color: 'rgba(71,85,105,0.66)' }}>
                    <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(201,146,46,0.16)', border: '1px solid rgba(201,146,46,0.24)', color: '#925f18', fontWeight: 800 }}>已公开可约</span>
                    <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.22)', color: '#15803d', fontWeight: 800 }}>本次选中</span>
                    <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.18)', color: '#1d4ed8', fontWeight: 800 }}>剧司辰忙碌</span>
                    <span>一次可选择多个日期，再统一提交审核。</span>
                  </div>
                  <div style={{ maxWidth: 400 }}>
                    <Calendar
                      onClickDay={toggleDate}
                      tileClassName={({ date }) => {
                        const ds = formatDateKey(date);
                        if (busyDateSet.has(ds)) return 'busy-tile';
                        if (availableDateSet.has(ds)) return 'avail-tile';
                        if (selectedAvailDateSet.has(ds)) return 'draft-avail-tile';
                        return '';
                      }}
                      className="dark-cal"
                      minDate={new Date()}
                    />
                  </div>
                  {selectedAvailDates.length > 0 && (
                    <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'rgba(240,253,244,0.75)', border: '1px solid rgba(22,163,74,0.18)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                        <p style={{ fontWeight: 850, fontSize: '0.86rem', color: '#166534' }}>本次选中 {selectedAvailDates.length} 天</p>
                        <button onClick={submitSelectedAvailability} disabled={submittingAvailability}
                          style={{ padding: '9px 16px', borderRadius: 10, border: 'none', cursor: submittingAvailability ? 'not-allowed' : 'pointer', background: submittingAvailability ? 'rgba(34,197,94,0.24)' : '#16a34a', color: '#fff', fontWeight: 850, fontSize: '0.82rem' }}>
                          {submittingAvailability ? '提交中...' : '提交选中档期审核'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {selectedAvailDates.map(date => (
                          <span key={date} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, fontSize: '0.76rem', background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(22,163,74,0.22)', color: '#15803d', fontWeight: 750 }}>
                            {date}
                            <button onClick={() => setSelectedAvailDates(prev => prev.filter(item => item !== date))}
                              style={{ background: 'none', border: 'none', color: 'rgba(21,128,61,0.66)', cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {availableItems.map(item => (
                      <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, fontSize: '0.78rem', background: 'rgba(201,146,46,0.1)', border: '1px solid rgba(201,146,46,0.25)', color: '#925f18' }}>
                        {item.date}{item.city ? ` · ${item.city}` : ''}{item.location ? ` · ${item.location}` : ''}{item.source === 'screenshot' ? ' · 截图导入' : ''}
                        <button onClick={() => deleteAvailabilityItem(item)}
                          style={{ background: 'none', border: 'none', color: 'rgba(146,95,24,0.62)', cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
                      </span>
                    ))}
                    {availableItems.length === 0 && (
                      <p style={{ fontSize: '0.82rem', color: 'rgba(71,85,105,0.52)' }}>还没有标记可约日期</p>
                    )}
                  </div>
                </div>

                <div style={{ ...card, border: '1px solid rgba(59,130,246,0.18)', background: 'linear-gradient(135deg, rgba(239,246,255,0.86), rgba(255,250,242,0.96))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: '0.96rem', color: INK, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        剧司辰已排档期
                        <InfoTip>这里同步的是已排班/忙碌时间，不会当成可约日期展示。</InfoTip>
                      </p>
                    </div>
                    <button onClick={syncJuzhangguiAvailability} disabled={syncingJzg}
                      style={{
                        padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(59,130,246,0.24)',
                        background: syncingJzg ? 'rgba(241,245,249,0.86)' : 'rgba(255,255,255,0.86)',
                        color: syncingJzg ? 'rgba(71,85,105,0.52)' : '#1d4ed8',
                        cursor: syncingJzg ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '0.84rem',
                      }}>
                      {syncingJzg ? '同步中...' : '同步剧司辰'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {busyItems.map(item => (
                      <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, fontSize: '0.78rem', background: 'rgba(59,130,246,0.09)', border: '1px solid rgba(59,130,246,0.18)', color: '#1e40af' }}>
                        {item.date}{item.start_time ? ` ${item.start_time.slice(0, 5)}` : ''}{item.city ? ` · ${item.city}` : ''}{item.location ? ` · ${item.location}` : ''}{item.note ? ` · ${item.note.replace(/^剧司辰同步：/, '')}` : ''}
                      </span>
                    ))}
                    {busyItems.length === 0 && (
                      <p style={{ fontSize: '0.82rem', color: 'rgba(71,85,105,0.52)' }}>还没有同步到剧司辰已排档期</p>
                    )}
                  </div>
                </div>

                <div style={{ ...card, border: '1px dashed rgba(201,146,46,0.25)' }}>
                  <p style={{ fontWeight: 800, fontSize: '0.96rem', marginBottom: 12, color: INK, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    截图快速导入
                    <InfoTip>上传档期截图留档，再粘贴截图中的文字，系统会把未过期日期导入为可约档期。</InfoTip>
                  </p>
                  <div style={{ marginBottom: 12 }}>
                    <DraftAutosaveNotice
                      savedAt={availabilityImportDraft.savedAt}
                      restoredAt={availabilityImportDraft.restoredAt}
                      error={availabilityImportDraft.error}
                      note="未导入的档期文字会自动保存到当前浏览器；图片文件不会保存。"
                    />
                  </div>
                  <div style={{ display: 'grid', gap: 12, maxWidth: 620 }}>
                    <ImageUpload onUploaded={setScreenshotUrl} token={token} api={API} scope="availability-screenshot" label="上传档期截图" />
                    {screenshotUrl && <p style={{ color: '#15803d', fontSize: '0.78rem', fontWeight: 700 }}>截图已上传</p>}
                    <textarea value={screenshotText} onChange={e => setScreenshotText(e.target.value)} rows={5}
                      placeholder="粘贴截图里的档期文字，比如：6.11 上海 可约 / 6月14日 北京可接"
                      style={{ ...inputStyle, resize: 'vertical', minHeight: 110 }} />
                    <button onClick={importScreenshotAvailability} disabled={importingScreenshot}
                      style={{
                        justifySelf: 'start', padding: '10px 18px', borderRadius: 10, border: 'none',
                        cursor: importingScreenshot ? 'not-allowed' : 'pointer',
                        background: importingScreenshot ? 'rgba(241,245,249,0.86)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                        color: importingScreenshot ? 'rgba(71,85,105,0.52)' : INK,
                        fontWeight: 800, fontSize: '0.84rem',
                      }}>
                      {importingScreenshot ? '导入中...' : '导入截图档期'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 作品集 */}
            {activeSection === 'serviceWorks' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <PageIntro
                  eyebrow="WORKS"
                  title="作品集"
                  subtitle="上传公开展示作品；通过审核后才会显示在个人主页。"
                  action={<Link to="/dashboard/services" style={secondaryActionStyle}>返回服务</Link>}
                />
                {portfolio.length > 0 && (
                  <div style={card}>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: INK }}>已上传作品</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                      {portfolio.map(p => (
                        <div key={p.id} style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', position: 'relative', border: '1px solid rgba(201,146,46,0.15)' }}
                          onMouseEnter={e => { const btn = e.currentTarget.querySelector('button') as HTMLElement | null; if (btn) btn.style.opacity = '1'; }}
                          onMouseLeave={e => { const btn = e.currentTarget.querySelector('button') as HTMLElement | null; if (btn) btn.style.opacity = '0'; }}>
                          <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button onClick={() => deletePortfolio(p.id)}
                            style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', opacity: 0, transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ ...card, border: '1px dashed rgba(201,146,46,0.25)' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: INK, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    上传作品
                    <InfoTip>支持 JPG、PNG、GIF，最大 10MB。上传后进入审核，通过后才会显示在公开页；请只上传你有权公开展示的图片。</InfoTip>
                  </p>
                  <ImageUpload onUploaded={addPortfolio} token={token} api={API} scope="portfolio" label="上传作品并提交审核" />
                </div>
              </div>
            )}

            {activeSection === 'wallet' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <PageIntro
                  eyebrow="WALLET"
                  title="钱包余额"
                  subtitle="榜金余额、充值榜金、赠送榜金和最近流水统一放在后台里查看。"
                  action={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link to="/income" style={secondaryActionStyle}>创作者收入</Link><Link to="/wallet" style={darkActionStyle}>充值 / 完整流水</Link></div>}
                />
                {moduleError && <ModuleNotice tone="red">{moduleError}</ModuleNotice>}
                {moduleLoading && !walletData ? (
                  <section style={card}><p style={{ color: MUTED, fontSize: 13, fontWeight: 750 }}>钱包信息加载中...</p></section>
                ) : (
                  <>
                    <div className="dashboard-metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                      <MetricCard label="总榜金" value={`${walletData?.balance ?? 0}`} tone="gold" />
                      <MetricCard label="充值榜金" value={`${walletData?.paid_balance ?? 0}`} tone="green" />
                      <MetricCard label="赠送榜金" value={`${walletData?.bonus_balance ?? 0}`} tone="blue" />
                    </div>
                    <section style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div>
                          <h2 style={{ color: INK, fontSize: 15, fontWeight: 900, marginBottom: 4 }}>最近流水</h2>
                          <p style={{ color: MUTED, fontSize: 13, fontWeight: 650 }}>消费默认先扣赠送榜金，再扣充值榜金。</p>
                        </div>
                        <Link to="/wallet" style={secondaryActionStyle}>查看全部</Link>
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {(walletData?.transactions || []).slice(0, 5).map(tx => (
                          <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 12px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.14)', background: '#fff' }}>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ color: INK, fontSize: 13, fontWeight: 850, marginBottom: 3 }}>{tx.description}</p>
                              <p style={{ color: 'rgba(71,85,105,0.56)', fontSize: 12, fontWeight: 650 }}>{tx.created_at?.slice(0, 10)} · {tx.status === 'approved' ? '已完成' : tx.status === 'pending' ? '处理中' : '未通过'}</p>
                              {tx.reject_reason && <p style={{ color: '#b91c1c', fontSize: 12, marginTop: 3 }}>{tx.reject_reason}</p>}
                            </div>
                            <strong style={{ color: tx.amount >= 0 ? '#15803d' : '#b91c1c', fontSize: 14, whiteSpace: 'nowrap' }}>
                              {tx.amount > 0 ? '+' : ''}{tx.amount}
                            </strong>
                          </div>
                        ))}
                        {(walletData?.transactions || []).length === 0 && (
                          <p style={{ color: MUTED, fontSize: 13, fontWeight: 700, padding: '18px 0' }}>暂无交易记录</p>
                        )}
                      </div>
                    </section>
                  </>
                )}
              </div>
            )}

            {activeSection === 'identity' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <PageIntro
                  eyebrow="IDENTITY"
                  title="认证身份"
                  subtitle="实名认证、DM 记录和店家认证都在这里看状态；材料仍走原审核流。"
                  action={<Link to="/certification" style={darkActionStyle}>提交认证材料</Link>}
                />
                {moduleError && <ModuleNotice tone="red">{moduleError}</ModuleNotice>}
                {dossierEditData.awaiting_owner_response.length > 0 && (
                  <section style={{ ...card, borderColor: 'rgba(166,106,31,0.32)', background: '#fffdf8' }}>
                    <div style={{ marginBottom: 10 }}>
                      <h2 style={{ color: INK, fontSize: 15, fontWeight: 900, marginBottom: 4 }}>待你确认的档案修改</h2>
                      <p style={{ color: MUTED, fontSize: 13, fontWeight: 650 }}>照片、主页链接及个人资料需要你明确同意或反对；其他公开履历由管理员核验。</p>
                    </div>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {dossierEditData.awaiting_owner_response.map(item => (
                        <div key={item.id} style={{ paddingTop: 12, borderTop: '1px solid rgba(31,41,55,0.09)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <strong style={{ color: INK, fontSize: 14 }}>{item.dossier_name} · {item.entity_type === 'store' ? '店家档案' : 'DM档案'}</strong>
                            <span style={{ color: '#8a5a19', fontSize: 12, fontWeight: 850 }}>{item.owner_response_due_at ? `自动生效观察至：${item.owner_response_due_at.slice(0, 10)}` : '已检测到你上线，请明确处理'}</span>
                          </div>
                          <p style={{ margin: '6px 0 0', color: MUTED, fontSize: 12 }}>提交人：{item.submitter_name} · 依据：{item.edit_reason || '未填写'}</p>
                          <div style={{ display: 'grid', gap: 5, marginTop: 9 }}>
                            {item.changed_fields.map(field => (
                              <div key={field} style={{ color: '#475569', fontSize: 12, lineHeight: 1.55 }}>
                                <strong>{DOSSIER_EDIT_FIELD_LABELS[field] || field}：</strong>
                                {dossierEditDisplayValue(item.before_snapshot[field])} → {dossierEditDisplayValue(item.patch[field])}
                              </div>
                            ))}
                          </div>
                          {(item.sensitive_fields?.length || 0) > 0 && (
                            <p style={{ margin: '9px 0 0', padding: '8px 10px', borderRadius: 7, background: '#fff7ed', color: '#9a5f18', fontSize: 12, fontWeight: 750, lineHeight: 1.55 }}>
                              包含{item.sensitive_fields?.map(field => DOSSIER_EDIT_FIELD_LABELS[field] || field).join('、')}；点击“同意修改”即表示你明确同意这些资料公开。
                            </p>
                          )}
                          <textarea
                            value={ownerResponseNotes[item.id] || ''}
                            onChange={event => setOwnerResponseNotes(current => ({ ...current, [item.id]: event.target.value.slice(0, 500) }))}
                            rows={2}
                            placeholder="可补充说明；反对时请写明原因"
                            style={{ boxSizing: 'border-box', width: '100%', minHeight: 62, marginTop: 9, padding: '8px 10px', borderRadius: 7, border: '1px solid rgba(31,41,55,0.13)', background: '#fff', color: INK, resize: 'vertical' }}
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                            <button type="button" disabled={respondingDossierEditId === item.id} onClick={() => respondToDossierEdit(item, 'agree')} style={darkActionStyle}>同意修改</button>
                            <button type="button" disabled={respondingDossierEditId === item.id} onClick={() => respondToDossierEdit(item, 'oppose')} style={secondaryActionStyle}>反对并提交说明</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <div className="dashboard-metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                  <MetricCard label="实名状态" value={creator.is_realname ? '已认证' : '未认证'} tone={creator.is_realname ? 'green' : 'gold'} />
                  <MetricCard label="DM 认证" value={creator.verified_dm ? '已认证' : creator.has_pending_dm_cert ? '审核中' : '未认证'} tone={creator.verified_dm ? 'green' : creator.has_pending_dm_cert ? 'gold' : 'gray'} />
                  <MetricCard label="店家认证" value={creator.verified_shop ? '已认证' : creator.has_pending_shop_cert ? '审核中' : '未认证'} tone={creator.verified_shop ? 'green' : creator.has_pending_shop_cert ? 'gold' : 'gray'} />
                </div>
                {creator.verified_dm && (
                  <section style={card}>
                    <div style={{ marginBottom: 14 }}>
                      <h2 style={{ color: INK, fontSize: 15, fontWeight: 900, marginBottom: 4 }}>DM 身份与任职店家</h2>
                      <p style={{ color: MUTED, fontSize: 13, fontWeight: 650, lineHeight: 1.65 }}>DM 可先声明任职店家并立即展示；店家确认只核验任职关系，不代表能力背书。</p>
                    </div>
                    {dmIdentityData.dossiers.length === 0 ? (
                      <p style={{ color: MUTED, fontSize: 13, fontWeight: 700, padding: '14px 0' }}>当前账号已标记为 DM，但尚未找到已绑定的 DM 档案，请通过建议反馈处理。</p>
                    ) : (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {dmIdentityData.dossiers.map(dossier => {
                          const activeAffiliation = dossier.affiliations.find(item => item.status === 'approved');
                          const pendingAffiliation = dossier.affiliations.find(item => item.status === 'pending');
                          const legacyAffiliation = dossier.affiliations.find(item => item.status === 'legacy_unverified');
                          const currentStore = activeAffiliation?.store_dossier;
                          return (
                            <article key={dossier.id} style={{ borderRadius: 8, border: '1px solid rgba(31,41,55,0.08)', padding: 14, background: '#fff' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                    <strong style={{ color: INK, fontSize: 15 }}>{dossier.dm_name}</strong>
                                    <span style={identityStatusBadgeStyle('verified')}>身份已认证</span>
                                  </div>
                                  <p style={{ margin: '6px 0 0', color: MUTED, fontSize: 13 }}>
                                    {activeAffiliation
                                      ? `${currentStore?.dm_name || '店家'}已确认任职`
                                      : pendingAffiliation
                                        ? `本人声明任职于${pendingAffiliation.store_dossier?.dm_name || '店家'}（未核验）`
                                        : legacyAffiliation
                                          ? `${legacyAffiliation.store_dossier?.dm_name || '历史店家'}关联待确认`
                                          : dossier.employment_status === 'freelance' ? '自由 DM（本人声明）' : '暂无已确认店家'}
                                  </p>
                                  {dossier.withdrawal?.status === 'pending' && <p style={{ margin: '7px 0 0', color: '#b45309', fontSize: 12, fontWeight: 850 }}>身份撤销申请审核中</p>}
                                </div>
                                <Link to={`/dm/${encodeURIComponent(dossier.id)}`} style={secondaryActionStyle}>查看公开档案</Link>
                              </div>

                              {pendingAffiliation ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(31,41,55,0.07)' }}>
                                    <span style={{ color: MUTED, fontSize: 12 }}>声明于 {pendingAffiliation.created_at?.slice(0, 10)}；店家确认前按“本人声明”公开。</span>
                                  <button type="button" disabled={identityAction === `cancel:${pendingAffiliation.id}`} onClick={() => cancelDmStoreRequest(dossier, pendingAffiliation.id)} style={identitySecondaryButtonStyle}>取消申请</button>
                                </div>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) auto', gap: 8, alignItems: 'end', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(31,41,55,0.07)' }}>
                                  <StoreSearchSelect
                                    label={activeAffiliation ? '声明更换店家' : '声明任职店家'}
                                    value={dmStoreChoices[dossier.id] || ''}
                                    options={dmIdentityData.stores.map(store => ({ id: store.id, name: store.dm_name, city: store.city, workplace: store.workplace }))}
                                    excludedIds={activeAffiliation ? [activeAffiliation.store_dossier_id] : []}
                                    onChange={id => setDmStoreChoices(current => ({ ...current, [dossier.id]: id }))}
                                  />
                                  <button type="button" disabled={identityAction === `request:${dossier.id}`} onClick={() => requestDmStoreConfirmation(dossier)} style={identityPrimaryButtonStyle}>立即关联</button>
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                                {(activeAffiliation || pendingAffiliation || dossier.employment_status !== 'freelance') && (
                                  <button type="button" disabled={identityAction === `freelance:${dossier.id}`} onClick={() => declareFreelanceDm(dossier)} style={identitySecondaryButtonStyle}>解除店家 / 改为自由 DM</button>
                                )}
                                {!dossier.withdrawal || dossier.withdrawal.status !== 'pending' ? (
                                  <button type="button" disabled={identityAction === `withdraw:${dossier.id}`} onClick={() => requestDmIdentityWithdrawal(dossier)} style={identityDangerButtonStyle}>申请撤销 DM 身份认证</button>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}
                <section style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div>
                      <h2 style={{ color: INK, fontSize: 15, fontWeight: 900, marginBottom: 4 }}>认证记录</h2>
                      <p style={{ color: MUTED, fontSize: 13, fontWeight: 650 }}>前台只展示认证标识，不公开证件材料。</p>
                    </div>
                    <Link to="/certification" style={secondaryActionStyle}>上传材料</Link>
                  </div>
                  {moduleLoading && certifications.length === 0 ? (
                    <p style={{ color: MUTED, fontSize: 13, fontWeight: 750 }}>认证记录加载中...</p>
                  ) : certifications.length === 0 ? (
                    <p style={{ color: MUTED, fontSize: 13, fontWeight: 700, padding: '18px 0' }}>暂无认证记录</p>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {certifications.map(cert => (
                        <div key={cert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.14)', background: '#fff' }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: INK, fontSize: 13, fontWeight: 850, marginBottom: 3 }}>{CERT_TYPE_LABELS[cert.type]}</p>
                            <p style={{ color: 'rgba(71,85,105,0.56)', fontSize: 12, fontWeight: 650 }}>{cert.created_at?.slice(0, 10)}</p>
                            {cert.reject_reason && <p style={{ color: '#b91c1c', fontSize: 12, marginTop: 3 }}>原因：{cert.reject_reason}</p>}
                          </div>
                          <span style={{
                            height: 26,
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0 9px',
                            borderRadius: 999,
                            border: `1px solid ${toneStyles[certTone(cert.status)].border}`,
                            background: toneStyles[certTone(cert.status)].bg,
                            color: toneStyles[certTone(cert.status)].color,
                            fontSize: 12,
                            fontWeight: 900,
                            whiteSpace: 'nowrap',
                          }}>
                            {CERT_STATUS_LABELS[cert.status]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                {dossierEditData.my_submissions.length > 0 && (
                  <section style={card}>
                    <div style={{ marginBottom: 10 }}>
                      <h2 style={{ color: INK, fontSize: 15, fontWeight: 900, marginBottom: 4 }}>我提交的档案修改</h2>
                      <p style={{ color: MUTED, fontSize: 13, fontWeight: 650 }}>当前只展示仍在审核中的修改。</p>
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {dossierEditData.my_submissions.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 10, borderTop: '1px solid rgba(31,41,55,0.09)' }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: INK, fontSize: 13, fontWeight: 850, marginBottom: 3 }}>{item.dossier_name}</p>
                            <p style={{ color: MUTED, fontSize: 12 }}>{item.changed_fields.map(field => DOSSIER_EDIT_FIELD_LABELS[field] || field).join('、')}</p>
                            {(item.sensitive_fields?.length || 0) > 0 && item.owner_response_status === 'pending' && (
                              <p style={{ color: '#9a5f18', fontSize: 11, marginTop: 3 }}>敏感资料须由 DM 本人明确同意后才能公开</p>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <span style={{ color: '#8a5a19', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' }}>
                              {dossierEditStatusLabel(item.owner_response_status, item.review_mode)}
                            </span>
                            <button type="button" disabled={respondingDossierEditId === item.id} onClick={() => withdrawDossierEdit(item)} style={{ ...secondaryActionStyle, minHeight: 32, padding: '6px 10px' }}>撤回</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {activeSection === 'referral' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <PageIntro
                  eyebrow="REFERRALS"
                  title="邀请奖励"
                  subtitle="邀请码、邀请链接、奖励规则和邀请记录统一收在个人后台。"
                  action={<Link to="/wallet" style={secondaryActionStyle}>榜金记录</Link>}
                />
                {moduleError && <ModuleNotice tone="red">{moduleError}</ModuleNotice>}
                {moduleLoading && !referralData ? (
                  <section style={card}><p style={{ color: MUTED, fontSize: 13, fontWeight: 750 }}>邀请信息加载中...</p></section>
                ) : referralData ? (
                  <>
                    <section style={{ ...card, display: 'grid', gap: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: GOLD, fontSize: 11, fontWeight: 900, marginBottom: 7 }}>专属邀请码</p>
                          <strong style={{ color: '#925f18', fontSize: 32, fontWeight: 950, lineHeight: 1 }}>{referralData.referral_code}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => copyInviteText('邀请码', referralData.referral_code)} style={secondaryActionStyle}>复制邀请码</button>
                          <button type="button" onClick={() => copyInviteText('邀请链接', referralData.share_url)} style={primaryActionStyle}>复制链接</button>
                        </div>
                      </div>
                      <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.14)', background: '#fff', color: 'rgba(71,85,105,0.72)', fontSize: 13, fontWeight: 700, overflowWrap: 'anywhere' }}>
                        {referralData.share_url}
                      </div>
                      {copiedInvite && <p style={{ color: '#15803d', fontSize: 13, fontWeight: 800 }}>{copiedInvite}已复制</p>}
                    </section>
                    <div className="dashboard-metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                      <MetricCard label="已邀请注册" value={`${referralData.stats.registered_invites}`} tone="blue" />
                      <MetricCard label="有效邀请" value={`${referralData.stats.valid_invites}`} tone="green" />
                      <MetricCard label="完成互动" value={`${referralData.stats.converted_invites}`} tone="gold" />
                      <MetricCard label="奖励合计" value={`${referralData.stats.referrer_reward_total}`} tone="green" />
                    </div>
                    <section style={card}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }} className="dashboard-two-col">
                        <div>
                          <h2 style={{ color: INK, fontSize: 15, fontWeight: 900, marginBottom: 8 }}>当前身份</h2>
                          <p style={{ color: '#925f18', fontSize: 16, fontWeight: 950, marginBottom: 6 }}>{referralRoleLabel(referralData.community_role)}</p>
                          <p style={{ color: MUTED, fontSize: 13, fontWeight: 650, lineHeight: 1.65 }}>
                            {referralData.community_role_expires_at ? `有效期至 ${referralData.community_role_expires_at.slice(0, 10)}` : '社区荣誉不会给到审核、删除、看隐私或改余额权限。'}
                          </p>
                        </div>
                        <div>
                          <h2 style={{ color: INK, fontSize: 15, fontWeight: 900, marginBottom: 8 }}>下一阶段</h2>
                          <p style={{ color: '#275389', fontSize: 16, fontWeight: 950, marginBottom: 6 }}>{referralData.stats.next_milestone.title}</p>
                          <p style={{ color: MUTED, fontSize: 13, fontWeight: 650 }}>
                            {referralData.stats.next_milestone.remaining > 0 ? `还差 ${referralData.stats.next_milestone.remaining} 个有效邀请` : '已达成当前最高里程碑'}
                          </p>
                        </div>
                      </div>
                    </section>
                    <section style={card}>
                      <h2 style={{ color: INK, fontSize: 15, fontWeight: 900, marginBottom: 12 }}>邀请记录</h2>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {referralData.referrals.slice(0, 8).map(item => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.14)', background: '#fff' }}>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ color: INK, fontSize: 13, fontWeight: 850, marginBottom: 3 }}>{item.invitee.display_name}</p>
                              <p style={{ color: 'rgba(71,85,105,0.56)', fontSize: 12, fontWeight: 650 }}>{item.created_at?.slice(0, 10)} 注册</p>
                            </div>
                            <span style={{ color: '#925f18', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' }}>{referralItemStatus(item)}</span>
                          </div>
                        ))}
                        {referralData.referrals.length === 0 && (
                          <p style={{ color: MUTED, fontSize: 13, fontWeight: 700, padding: '18px 0' }}>还没有邀请记录</p>
                        )}
                      </div>
                    </section>
                  </>
                ) : (
                  <section style={card}><p style={{ color: MUTED, fontSize: 13, fontWeight: 750 }}>暂无邀请信息</p></section>
                )}
              </div>
            )}

            {activeSection === 'posts' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <PageIntro
                  eyebrow="CONTENT"
                  title="我的发布"
                  subtitle="红黑白、委托、拼车和攻略等内容按状态归档。"
                  action={<Link to="/rankings/new" style={darkActionStyle}>发布内容</Link>}
                />
                <MineSection title="红黑白榜" emptyText="还没有发布过口碑">
                  {myRankings.map(item => (
                    <MineRow key={item.id}
                      title={item.subject_name}
                      meta={`${item.type === 'red' ? '红榜' : item.type === 'black' ? '黑榜' : '白榜'} · ${item.subject_city || '未填城市'} · 免费发布 · 打榜${item.boost_amount ?? (item.type === 'black' ? 0 : item.likes || 0)}${item.negative_boost_amount ? ` · 历史踩榜${item.negative_boost_amount}` : ''} · 同意${item.agree_count ?? 0} 反对${item.oppose_count ?? 0} 离谱${item.joys || 0}`}
                      status={item.status}
                      note={item.status === 'rejected' && item.reject_reason
                        ? `${item.evidence_required ? '需补证据' : '打回修改'}：${item.reject_reason}`
                        : item.latest_edit_request?.status === 'rejected' && item.latest_edit_request.reject_reason
                          ? `${item.latest_edit_request.request_kind === 'restore' ? '恢复申请' : '修改申请'}未通过：${item.latest_edit_request.reject_reason}`
                          : item.latest_edit_request?.status === 'pending'
                            ? (item.latest_edit_request.request_kind === 'restore' ? '恢复申请审核中' : '修改审核中，当前公开版保持不变')
                            : undefined}
                      to={item.status === 'approved' ? `/rankings/${item.id}` : '/rankings'}
                      action={item.status === 'rejected' ? (
                        <Link to={`/rankings/new?resubmit=${encodeURIComponent(item.id)}`} style={miniButtonStyle}>
                          {item.evidence_required ? '补证据并重新提交' : '修改并重新提交'}
                        </Link>
                      ) : item.status === 'pending' && item.initial_amount === 0 ? (
                        <button onClick={() => withdrawRanking(item.id)} style={miniButtonStyle}>
                          撤回
                        </button>
                      ) : item.status === 'approved' ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {item.latest_edit_request?.status !== 'pending' && <button onClick={() => openRankingAuthorEdit(item)} style={miniButtonStyle}>修改</button>}
                          <button onClick={() => withdrawRanking(item.id)} style={miniButtonStyle}>下架</button>
                        </div>
                      ) : item.status === 'withdrawn' && item.latest_edit_request?.status !== 'pending' ? (
                        <button onClick={() => requestRankingRestore(item.id)} style={miniButtonStyle}>申请恢复</button>
                      ) : null}
                    />
                  ))}
                </MineSection>

                <MineSection title="委托需求" emptyText="还没有发布过委托">
                  {myCommissions.map(item => (
                    <MineRow key={item.id}
                      title={item.title}
                      meta={`${item.city || '未填城市'}${item.needed_date ? ` · ${item.needed_date}` : ''}`}
                      status={item.status}
                      to="/commissions"
                      action={item.status === 'approved' || item.status === 'pending' ? (
                        <button onClick={() => closeCommission(item.id)} style={miniButtonStyle}>
                          关闭
                        </button>
                      ) : null}
                    />
                  ))}
                </MineSection>

                <MineSection title="拼车" emptyText="还没有发布过拼车">
                  {myCarpools.map(item => (
                    <MineRow key={item.id}
                      title={item.title}
                      meta={`${item.city} · ${item.event_date}${item.deadline_date ? ` · 截止 ${item.deadline_date}` : ''}${item.juzhanggui_sync_status === 'synced' ? ' · 已同步剧司辰' : item.juzhanggui_sync_status === 'failed' ? ' · 同步失败' : ''}`}
                      status={item.status}
                      to="/carpools"
                      action={item.status === 'approved' || item.status === 'pending' ? (
                        <button onClick={() => closeCarpool(item.id)} style={miniButtonStyle}>
                          关闭
                        </button>
                      ) : null}
                    />
                  ))}
                </MineSection>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .dashboard-identity-badges {
          display: none;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 8px;
        }
        .dashboard-avatar-stack {
          max-width: 100%;
        }
        .dashboard-avatar-action {
          max-width: 130px;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          max-width: 100%;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid rgba(125,147,170,0.16);
          background: rgba(255,255,255,0.72);
          color: rgba(71,85,105,0.72);
          font-size: 0.7rem;
          font-weight: 900;
          line-height: 1.2;
          white-space: nowrap;
        }
        .status-badge.ok {
          border-color: rgba(22,163,74,0.16);
          background: rgba(220,252,231,0.72);
          color: #15803d;
        }
        .status-badge.warn {
          border-color: rgba(217,168,87,0.22);
          background: rgba(255,247,237,0.84);
          color: #925f18;
        }
        .status-badge.gold {
          border-color: rgba(217,168,87,0.24);
          background: rgba(217,168,87,0.14);
          color: #925f18;
        }
        .status-badge.info {
          border-color: rgba(59,130,246,0.14);
          background: rgba(239,246,255,0.88);
          color: #275389;
        }
        .status-badge.muted {
          border-color: rgba(125,147,170,0.14);
          background: rgba(241,245,249,0.78);
          color: rgba(71,85,105,0.72);
        }
        .compact-status-grid,
        .identity-check-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .intent-setting-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 22px;
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid rgba(201,146,46,0.16);
          background: rgba(255,250,242,0.62);
        }
        .compact-status-pill {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-height: 28px;
          max-width: 100%;
          padding: 5px 8px;
          border-radius: 999px;
          border: 1px solid rgba(125,147,170,0.16);
          background: rgba(255,255,255,0.78);
          color: #475569;
          font-size: 0.74rem;
          font-weight: 900;
        }
        .compact-status-pill.ok {
          border-color: rgba(22,163,74,0.18);
          background: rgba(220,252,231,0.64);
          color: #15803d;
        }
        .compact-status-pill.warn {
          border-color: rgba(217,168,87,0.22);
          background: rgba(255,247,237,0.86);
          color: #925f18;
        }
        .compact-status-pill.danger {
          border-color: rgba(185,28,28,0.18);
          background: rgba(254,242,242,0.82);
          color: #b91c1c;
        }
        .compact-status-pill.gold {
          border-color: rgba(217,168,87,0.24);
          background: rgba(217,168,87,0.14);
          color: #925f18;
        }
        .compact-status-pill.muted {
          border-color: rgba(125,147,170,0.14);
          background: rgba(241,245,249,0.78);
          color: rgba(71,85,105,0.76);
        }
        .compact-status-main {
          display: flex;
          align-items: center;
          gap: 7px;
          min-width: 0;
        }
        .compact-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
          flex: 0 0 auto;
        }
        .compact-status-label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .compact-status-value {
          color: rgba(71,85,105,0.64);
          font-size: 0.7rem;
          font-weight: 800;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .info-tip-wrap {
          position: relative;
          display: inline-flex;
          flex: 0 0 auto;
          vertical-align: middle;
        }
        .info-tip-button {
          width: 18px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid rgba(100,116,139,0.18);
          background: rgba(255,255,255,0.82);
          color: rgba(71,85,105,0.72);
          cursor: pointer;
          font-size: 0.68rem;
          font-weight: 900;
          line-height: 1;
        }
        .info-tip-popover {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 60;
          width: min(260px, 72vw);
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(125,147,170,0.18);
          background: rgba(255,255,255,0.98);
          color: rgba(30,41,59,0.82);
          box-shadow: 0 18px 42px rgba(31,41,55,0.16);
          font-size: 0.78rem;
          font-weight: 700;
          line-height: 1.6;
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: break-word;
          text-align: left;
          pointer-events: auto;
        }
        .info-tip-popover strong {
          color: ${INK};
          font-weight: 900;
        }
        .account-emoji-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }
        .emoji-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 30px;
          padding: 5px 7px;
          border-radius: 999px;
          border: 1px solid rgba(125,147,170,0.16);
          background: rgba(255,255,255,0.78);
          color: rgba(71,85,105,0.78);
          font-size: 0.74rem;
          font-weight: 900;
          white-space: nowrap;
        }
        .emoji-status.ok {
          border-color: rgba(22,163,74,0.16);
          background: rgba(220,252,231,0.66);
          color: #15803d;
        }
        .emoji-status.warn {
          border-color: rgba(217,168,87,0.22);
          background: rgba(255,247,237,0.86);
          color: #925f18;
        }
        .emoji-status-icon {
          font-size: 0.9rem;
          line-height: 1;
        }
        .inline-action-link {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 5px 10px;
          border-radius: 999px;
          border: 1px solid rgba(201,146,46,0.22);
          background: rgba(255,250,242,0.86);
          color: #925f18;
          text-decoration: none;
          font-size: 0.74rem;
          font-weight: 900;
        }
        .onboarding-card {
          scrollbar-gutter: stable;
        }
        .onboarding-card::-webkit-scrollbar {
          width: 8px;
        }
        .onboarding-card::-webkit-scrollbar-thumb {
          background: rgba(201,146,46,0.24);
          border-radius: 999px;
        }
        .profile-editor-card > .account-panel {
          display: none;
        }

        @media (max-height: 720px) and (min-width: 761px) {
          .onboarding-backdrop {
            padding: 12px !important;
          }
          .onboarding-card {
            max-height: calc(100svh - 24px) !important;
            padding: 16px !important;
          }
          .onboarding-card h2 {
            font-size: 1.18rem !important;
            margin-bottom: 6px !important;
          }
          .onboarding-card > p {
            margin-bottom: 6px !important;
          }
          .onboarding-grid {
            gap: 8px !important;
            margin-bottom: 12px !important;
          }
          .onboarding-item {
            padding: 9px 10px !important;
          }
          .onboarding-item p:first-child {
            font-size: 0.82rem !important;
            margin-bottom: 2px !important;
          }
          .onboarding-item p:last-child {
            font-size: 0.74rem !important;
            line-height: 1.48 !important;
          }
        }

        @media (max-width: 760px) {
          .dashboard-page {
            background: #fffdf8 !important;
          }
          .onboarding-backdrop {
            padding: 10px !important;
            align-items: flex-start !important;
          }
          .onboarding-card {
            max-height: calc(100svh - 20px) !important;
            padding: 14px !important;
            border-radius: 16px !important;
          }
          .onboarding-card h2 {
            font-size: 1.16rem !important;
            margin-bottom: 6px !important;
          }
          .onboarding-card > p {
            margin-bottom: 7px !important;
          }
          .onboarding-grid {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
            margin-bottom: 12px !important;
          }
          .onboarding-item {
            padding: 9px 10px !important;
          }
          .onboarding-item p:first-child {
            font-size: 0.82rem !important;
            margin-bottom: 2px !important;
          }
          .onboarding-item p:last-child {
            font-size: 0.74rem !important;
            line-height: 1.5 !important;
          }
          .onboarding-card button {
            min-height: 36px !important;
            flex: 1 1 auto !important;
            padding: 8px 10px !important;
            font-size: 0.78rem !important;
          }
          .dashboard-hero {
            padding: 14px 14px 12px !important;
            background: linear-gradient(145deg, #eef6ff 0%, #fffaf2 100%) !important;
          }
          .dashboard-hero-inner {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 12px !important;
            align-items: stretch !important;
          }
          .dashboard-identity {
            padding: 12px !important;
            border-radius: 16px !important;
            background: rgba(255,255,255,0.74) !important;
            border: 1px solid rgba(201,146,46,0.16) !important;
            box-shadow: 0 10px 28px rgba(31,41,55,0.06) !important;
          }
          .dashboard-avatar-stack {
            align-self: flex-start !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 6px !important;
          }
          .dashboard-avatar-action {
            max-width: 96px !important;
          }
          .dashboard-avatar-action .info-tip-wrap {
            display: none !important;
          }
          .dashboard-identity-avatar {
            width: 64px !important;
            height: 64px !important;
            border-radius: 18px !important;
          }
          .dashboard-identity h1 {
            font-size: 1.28rem !important;
            margin-bottom: 2px !important;
          }
          .dashboard-identity-badges { display: flex !important; }
          .dashboard-actions {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            width: 100% !important;
          }
          .dashboard-actions a,
          .dashboard-actions button {
            display: flex !important;
            align-items: center !important;
            min-height: 38px !important;
            padding: 8px 10px !important;
            border-radius: 10px !important;
            text-align: center !important;
            justify-content: center !important;
            font-size: 0.78rem !important;
            white-space: nowrap !important;
          }
          .dashboard-actions button {
            grid-column: 1 / -1 !important;
            min-height: 34px !important;
            justify-self: stretch !important;
          }
          .dashboard-body {
            padding: 10px 12px 64px !important;
          }
          .dashboard-context {
            align-items: center !important;
            padding-bottom: 8px !important;
            margin-bottom: 10px !important;
          }
          .dashboard-context a {
            min-height: 32px !important;
            padding: 0 10px !important;
            font-size: 0.76rem !important;
          }
          .dashboard-layout {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .dashboard-tabs {
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            position: sticky !important;
            top: 68px !important;
            z-index: 20 !important;
            display: block !important;
            gap: 8px !important;
            overflow-x: auto !important;
            padding: 8px !important;
            border-radius: 8px !important;
            background: rgba(255,253,248,0.96) !important;
            backdrop-filter: blur(12px) !important;
            box-shadow: none !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .dashboard-tabs::-webkit-scrollbar {
            display: none;
          }
          .dashboard-side-head {
            display: none !important;
          }
          .dashboard-side-nav {
            display: flex !important;
            gap: 8px !important;
            overflow-x: auto !important;
            padding: 0 !important;
            -webkit-overflow-scrolling: touch !important;
            scrollbar-width: none !important;
          }
          .dashboard-side-nav::-webkit-scrollbar {
            display: none;
          }
          .dashboard-tab-btn {
            width: auto !important;
            flex: 0 0 auto !important;
            padding: 9px 12px !important;
            border-radius: 999px !important;
            white-space: nowrap !important;
            font-size: 0.82rem !important;
          }
          .dashboard-tab-btn svg {
            width: 15px !important;
            height: 15px !important;
          }
          .dashboard-main {
            width: 100% !important;
          }
          .dashboard-metric-grid,
          .dashboard-quick-grid,
          .account-security-grid,
          .dashboard-two-col {
            grid-template-columns: 1fr !important;
          }
          .dashboard-card,
          .dashboard-panel,
          .dashboard-main section {
            border-radius: 8px !important;
            padding: 14px !important;
            box-shadow: none !important;
          }
          .profile-editor-card > h2 {
            margin-bottom: 14px !important;
            font-size: 1rem !important;
          }
          .account-bind-grid,
          .password-verify-grid,
          .password-set-grid,
          .profile-grid-auto,
          .social-link-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .profile-grid-compact,
          .profile-grid-2,
          .service-settings-grid,
          .service-add-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }
          .service-settings-grid > div:nth-child(2),
          .service-add-grid > select:first-child {
            grid-column: 1 / -1 !important;
          }
          .compact-status-pill {
            min-height: 28px !important;
          }
          .info-tip-popover {
            position: fixed !important;
            left: 12px !important;
            right: 12px !important;
            bottom: 16px !important;
            top: auto !important;
            width: auto !important;
            max-width: none !important;
            max-height: min(42vh, 260px) !important;
            overflow-y: auto !important;
            transform: none !important;
            border-radius: 14px !important;
          }
          .intent-setting-row {
            align-items: stretch !important;
            flex-direction: column !important;
          }
          .intent-setting-row input[type="number"] {
            max-width: none !important;
          }
          .account-action-row {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 6px !important;
          }
          .account-action-row button {
            min-height: 30px !important;
            width: auto !important;
          }
          .password-verify-grid button,
          .password-set-grid button,
          .account-bind-grid button {
            min-height: 42px !important;
            padding: 0 12px !important;
          }
          .account-panel {
            margin-bottom: 14px !important;
          }
          .account-panel > div:first-child {
            gap: 8px !important;
          }
          .role-panel {
            padding: 12px !important;
          }
          .role-panel > div:first-child {
            align-items: flex-start !important;
          }
          .role-panel a,
          .role-panel button {
            min-height: 36px !important;
          }
          .profile-editor-card input,
          .profile-editor-card select,
          .profile-editor-card textarea {
            font-size: 16px !important;
            border-radius: 10px !important;
          }
          .profile-editor-card textarea {
            min-height: 94px !important;
          }
        }

        /* Light calendar overrides */
        .dark-cal { background: transparent !important; border: none !important; width: 100% !important; color: #1f2937 !important; }
        .dark-cal .react-calendar__navigation { background: transparent !important; margin-bottom: 12px; }
        .dark-cal .react-calendar__navigation button { color: rgba(71,85,105,0.85) !important; background: transparent !important; font-size: 0.9rem !important; font-weight: 600 !important; border-radius: 8px !important; }
        .dark-cal .react-calendar__navigation button:hover { background: rgba(217,168,87,0.10) !important; }
        .dark-cal .react-calendar__navigation button:disabled { color: rgba(71,85,105,0.3) !important; }
        .dark-cal .react-calendar__month-view__weekdays { color: rgba(71,85,105,0.55) !important; font-size: 0.72rem !important; }
        .dark-cal .react-calendar__tile { background: transparent !important; color: rgba(71,85,105,0.82) !important; border-radius: 8px !important; padding: 8px !important; }
        .dark-cal .react-calendar__tile:hover { background: rgba(217,168,87,0.10) !important; }
        .dark-cal .react-calendar__tile--now { background: rgba(201,146,46,0.12) !important; color: ${GOLD} !important; }
        .dark-cal .react-calendar__tile--active { background: rgba(201,146,46,0.12) !important; }
        .dark-cal .react-calendar__tile.avail-tile { background: rgba(201,146,46,0.2) !important; color: ${GOLD} !important; font-weight: 700 !important; border: 1px solid rgba(201,146,46,0.4) !important; }
        .dark-cal .react-calendar__tile.draft-avail-tile { background: rgba(22,163,74,0.15) !important; color: #15803d !important; font-weight: 800 !important; border: 1px solid rgba(22,163,74,0.35) !important; box-shadow: inset 0 0 0 1px rgba(22,163,74,0.12) !important; }
        .dark-cal .react-calendar__tile.busy-tile { background: rgba(59,130,246,0.12) !important; color: #1d4ed8 !important; font-weight: 700 !important; border: 1px solid rgba(59,130,246,0.25) !important; }
        .dark-cal .react-calendar__month-view__days__day--neighboringMonth { color: rgba(71,85,105,0.25) !important; }
        .dark-cal abbr { text-decoration: none !important; }
      `}</style>
    </div>
  );
}

type StatusTone = 'ok' | 'warn' | 'danger' | 'gold' | 'info' | 'muted';

function EmojiStatus({
  icon,
  tone,
  label,
  children,
}: {
  icon: string;
  tone: Extract<StatusTone, 'ok' | 'warn'>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`emoji-status ${tone}`}>
      <span className="emoji-status-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <InfoTip>{children}</InfoTip>
    </span>
  );
}

function CompactStatus({
  label,
  value,
  tone,
  children,
}: {
  ok: boolean;
  label: string;
  value?: string;
  tone: StatusTone;
  children: React.ReactNode;
}) {
  return (
    <div className={`compact-status-pill ${tone}`}>
      <span className="compact-status-main">
        <span className="compact-status-dot" />
        <span className="compact-status-label">{label}</span>
        {value && <span className="compact-status-value">{value}</span>}
      </span>
      <InfoTip>{children}</InfoTip>
    </div>
  );
}

function MineSection({ title, emptyText, children }: { title: string; emptyText: string; children: React.ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section style={card}>
      <h2 style={{ fontWeight: 800, fontSize: '1rem', color: INK, marginBottom: 14 }}>{title}</h2>
      {hasItems ? <div style={{ display: 'grid', gap: 10 }}>{children}</div> : <p style={{ color: MUTED, fontSize: '0.86rem' }}>{emptyText}</p>}
    </section>
  );
}

const miniButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(100,116,139,0.2)',
  background: 'rgba(241,245,249,0.85)',
  color: '#475569',
  borderRadius: 8,
  padding: '5px 9px',
  cursor: 'pointer',
  fontSize: '0.76rem',
  fontWeight: 800,
};

const primaryActionStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 14px',
  borderRadius: 8,
  border: 'none',
  background: `linear-gradient(135deg, ${GOLD}, #c9922e)`,
  color: INK,
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 900,
  cursor: 'pointer',
};

const darkActionStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 14px',
  borderRadius: 8,
  border: 'none',
  background: INK,
  color: '#fffdf8',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 900,
  cursor: 'pointer',
};

const secondaryActionStyle: React.CSSProperties = {
  minHeight: 38,
  padding: '0 14px',
  border: '1px solid rgba(201,146,46,0.24)',
  borderRadius: 8,
  background: '#fffaf2',
  color: '#925f18',
  fontSize: 13,
  fontWeight: 900,
  cursor: 'pointer',
};

function identityStatusBadgeStyle(status: 'verified' | 'pending'): React.CSSProperties {
  return {
    padding: '3px 7px',
    borderRadius: 999,
    border: status === 'verified' ? '1px solid rgba(22,101,52,0.15)' : '1px solid rgba(217,168,87,0.24)',
    background: status === 'verified' ? '#ECFDF3' : '#FFF8E8',
    color: status === 'verified' ? '#166534' : '#8A5A19',
    fontSize: 11,
    fontWeight: 900,
  };
}

const identityPrimaryButtonStyle: React.CSSProperties = {
  minHeight: 38,
  padding: '0 12px',
  borderRadius: 7,
  border: `1px solid ${INK}`,
  background: INK,
  color: '#fff',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
};

const identitySecondaryButtonStyle: React.CSSProperties = {
  ...identityPrimaryButtonStyle,
  border: '1px solid rgba(31,41,55,0.14)',
  background: '#fff',
  color: INK,
};

const identityDangerButtonStyle: React.CSSProperties = {
  ...identitySecondaryButtonStyle,
  border: '1px solid rgba(185,28,28,0.16)',
  color: '#b91c1c',
};

const primaryButtonStyle: React.CSSProperties = {
  ...primaryActionStyle,
  minHeight: 42,
};

type ToneName = 'blue' | 'green' | 'gold' | 'red' | 'gray';

const toneStyles: Record<ToneName, { bg: string; border: string; color: string }> = {
  blue: { bg: '#EEF6FF', border: 'rgba(39,83,137,0.16)', color: '#275389' },
  green: { bg: '#ECFDF3', border: 'rgba(22,101,52,0.14)', color: '#166534' },
  gold: { bg: '#FFF8E8', border: 'rgba(217,168,87,0.26)', color: '#8A5A19' },
  red: { bg: '#FFF1F2', border: 'rgba(159,18,57,0.12)', color: '#9F1239' },
  gray: { bg: '#F8FAFC', border: 'rgba(31,41,55,0.08)', color: 'rgba(71,85,105,0.72)' },
};

function PageIntro({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '2px 0 4px' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 5 }}>
        <span style={{ color: GOLD, fontSize: 11, fontWeight: 900, lineHeight: 1 }}>{eyebrow}</span>
        <h1 style={{ margin: 0, color: INK, fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 900, lineHeight: 1.1 }}>{title}</h1>
        <p style={{ margin: 0, color: MUTED, fontSize: 13, fontWeight: 700, lineHeight: 1.45 }}>{subtitle}</p>
      </div>
      {action}
    </section>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: ToneName }) {
  const colors = toneStyles[tone];
  return (
    <section style={{ ...card, minHeight: 94, background: colors.bg }}>
      <p style={{ marginBottom: 9, color: MUTED, fontSize: 12, fontWeight: 800, lineHeight: 1 }}>{label}</p>
      <strong style={{ color: INK, fontSize: 24, fontWeight: 950, lineHeight: 1 }}>{value}</strong>
    </section>
  );
}

function OverviewRow({ label, value, tone }: { label: string; value: string; tone: ToneName }) {
  const colors = toneStyles[tone];
  return (
    <div style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1, color: INK, fontSize: 13, fontWeight: 800, lineHeight: 1.25 }}>{label}</span>
      <span style={{ height: 28, display: 'inline-flex', alignItems: 'center', padding: '0 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.color, fontSize: 12, fontWeight: 900 }}>
        {value}
      </span>
    </div>
  );
}

function SecurityCard({ title, value, status, tone }: { title: string; value: string; status: string; tone: ToneName }) {
  const colors = toneStyles[tone];
  return (
    <section style={{ ...card, minHeight: 112, display: 'grid', gap: 8 }}>
      <p style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>{title}</p>
      <strong style={{ color: INK, fontSize: 17, fontWeight: 950, overflowWrap: 'anywhere' }}>{value}</strong>
      <span style={{ justifySelf: 'start', height: 26, display: 'inline-flex', alignItems: 'center', padding: '0 9px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.color, fontSize: 12, fontWeight: 900 }}>
        {status}
      </span>
    </section>
  );
}

function ModuleNotice({ tone, children }: { tone: ToneName; children: React.ReactNode }) {
  const colors = toneStyles[tone];
  return (
    <div style={{
      padding: '11px 13px',
      borderRadius: 10,
      border: `1px solid ${colors.border}`,
      background: colors.bg,
      color: colors.color,
      fontSize: 13,
      fontWeight: 800,
      lineHeight: 1.55,
    }}>
      {children}
    </div>
  );
}

function MineRow({ title, meta, status, to, action, note }: { title: string; meta: string; status: string; to: string; action?: React.ReactNode; note?: string }) {
  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: '待审核', color: '#925f18', bg: 'rgba(217,168,87,0.12)' },
    approved: { label: '已公开', color: '#15803d', bg: 'rgba(220,252,231,0.78)' },
    rejected: { label: '未通过', color: '#b91c1c', bg: 'rgba(254,242,242,0.9)' },
    closed: { label: '已关闭', color: '#64748b', bg: 'rgba(241,245,249,0.9)' },
    withdrawn: { label: '已下架', color: '#64748b', bg: 'rgba(241,245,249,0.9)' },
  };
  const item = statusMap[status] || statusMap.pending;
  return (
    <article style={{ borderRadius: 12, border: '1px solid rgba(201,146,46,0.16)', background: '#fff', padding: 14, display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ fontWeight: 800, fontSize: '0.92rem', color: INK, marginBottom: 5 }}>{title}</h3>
        <p style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.78rem', lineHeight: 1.6 }}>{meta}</p>
        {note && <p style={{ color: '#b91c1c', fontSize: '0.76rem', lineHeight: 1.55, marginTop: 4 }}>{note}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ padding: '4px 8px', borderRadius: 999, background: item.bg, color: item.color, fontSize: '0.74rem', fontWeight: 800 }}>{item.label}</span>
        {action}
        <Link to={to} style={{ color: '#925f18', fontSize: '0.8rem', fontWeight: 800, textDecoration: 'none' }}>查看</Link>
      </div>
    </article>
  );
}
