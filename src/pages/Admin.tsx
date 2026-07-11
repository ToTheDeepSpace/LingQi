import { useEffect, useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { isTokenExpired } from '../lib/authSession';
import BrandLogo from '../components/BrandLogo';

const API = '/api';
const BG = '#FFFDF8';
const SURFACE = '#FFFFFF';
const INK = '#1F2937';
const MUTED = 'rgba(31,41,55,0.62)';
const LINE = 'rgba(31,41,55,0.10)';
const GOLD = '#d9a857';

function getToken() {
  const adminToken = localStorage.getItem('lc_admin_token') || '';
  if (adminToken && !isTokenExpired(adminToken)) return adminToken;
  try {
    const creator = JSON.parse(localStorage.getItem('lc_creator') || '{}');
    if (creator?.role === 'admin' && creator?.token && !isTokenExpired(creator.token)) return creator.token;
  } catch {
    return '';
  }
  return '';
}

const SUBJECT_LABEL: Record<string, string> = {
  creator: '委托师',
  dm: '卡司',
  store: '店家',
  takeaway: '外卖',
  player: '玩家',
};

const SCRIPT_CREDIT_LABEL: Record<string, string> = {
  authors: '作者',
  publisher: '发行方',
  supervisor: '监制',
};

const DOSSIER_CLAIM_PROOF_LABEL: Record<DossierClaimSubmission['proof_type'], string> = {
  social_account: '社交账号后台',
  employment: '任职 / 排班证明',
  business_license: '营业执照 / 主体资料',
  store_backend: '店铺平台后台',
  other: '其他身份证明',
};

function formatCredits(value?: Record<string, string[]> | null) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value)
    .filter(([key, items]) => !!SCRIPT_CREDIT_LABEL[key] && Array.isArray(items) && items.length > 0)
    .map(([key, items]) => `${SCRIPT_CREDIT_LABEL[key]}：${items.join('、')}`);
}

function formatCarpoolSubsidy(item: {
  subsidy_mode: 'none' | 'asking' | 'offering';
  subsidy_type?: 'none' | 'half_price' | 'free_ticket' | 'discount' | 'a_subsidy' | 'fixed_deduct' | 'custom';
  subsidy_amount: number;
  subsidy_discount?: number | null;
  subsidy_note?: string | null;
}) {
  const type = item.subsidy_type || 'none';
  if (type === 'half_price') return item.subsidy_note || '半价';
  if (type === 'free_ticket') return item.subsidy_note || '免票';
  if (type === 'discount') return item.subsidy_note || `${item.subsidy_discount || ''}折`;
  if (type === 'a_subsidy') return item.subsidy_note || (item.subsidy_amount > 0 ? `A补 ${item.subsidy_amount}` : 'A补');
  if (type === 'fixed_deduct') return item.subsidy_note || (item.subsidy_amount > 0 ? `减 ${item.subsidy_amount}` : '减价');
  if (type === 'custom') return item.subsidy_note || '补贴说明';
  if (item.subsidy_mode === 'none') return '无补贴';
  const label = item.subsidy_mode === 'asking' ? '想吃补' : '车头出补';
  const amount = item.subsidy_amount > 0 ? `${item.subsidy_amount} 元` : '';
  const note = item.subsidy_note?.trim();
  if (amount && note) return `${label} ${amount} · ${note}`;
  if (amount) return `${label} ${amount}`;
  if (note) return `${label} · ${note}`;
  return label;
}

type ProofFile = { name?: string; url: string; type?: string };

type ModerationPrecheck = {
  decision?: 'pass' | 'review' | 'block';
  risk_score?: number;
  risk_labels?: string[];
  summary?: string;
  provider?: string;
  checked_at?: string;
};

type Profile = {
  id: string;
  display_name: string;
  phone?: string | null;
  email?: string | null;
  auth_provider?: string | null;
  wechat_nickname?: string | null;
  created_at: string;
  updated_at?: string;
  is_visible: boolean;
  is_realname?: boolean;
  is_banned?: boolean;
  ban_reason?: string | null;
  banned_at?: string | null;
  reject_reason?: string | null;
  role_type?: string;
  avatar?: string | null;
};

function profileNickname(profile: Profile) {
  const name = profile.display_name?.trim();
  if (!name) return '未设置昵称';
  if (name.includes('\uFFFD') || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(name)) return '昵称编码异常，待修复';
  return name;
}

function profileAccountSummary(profile: Profile) {
  const accounts: string[] = [];
  if (profile.phone) accounts.push(`手机 ${profile.phone}`);
  if (profile.email) accounts.push(`邮箱 ${profile.email}`);
  if (accounts.length === 0 && profile.wechat_nickname) accounts.push(`微信 ${profile.wechat_nickname}`);
  return accounts.length > 0 ? accounts.join(' · ') : '未绑定手机号或邮箱';
}

function profileAuthProviderLabel(provider?: string | null) {
  if (!provider) return '';
  const labels: Record<string, string> = {
    phone: '手机注册',
    email: '邮箱注册',
    wechat: '微信登录',
    wechat_miniapp: '微信小程序',
    juzhanggui_actor: '剧司辰同步',
    codex_framer_snapshot: '内部测试账号',
  };
  return labels[provider] || '其他来源';
}

function profileAccountById(profiles: Profile[], profileId?: string | null) {
  if (!profileId) return '未知账号';
  const profile = profiles.find(item => item.id === profileId);
  if (!profile) return '账号资料未载入';
  return `${profileAccountSummary(profile)} · 昵称：${profileNickname(profile)}`;
}

type ContactReq = {
  id: string;
  requester_name: string;
  requester_wechat: string;
  requester_message?: string;
  created_at: string;
  lc_profiles?: { display_name?: string };
};

type Ranking = {
  id: string;
  type: 'red' | 'black' | 'white';
  subject_name: string;
  subject_type: string;
  subject_city: string | null;
  subject_url?: string | null;
  content: string;
  author_name: string;
  initial_amount: number;
  likes?: number;
  dislikes?: number;
  joys?: number;
  status?: 'pending' | 'approved' | 'rejected';
  reject_reason?: string | null;
  payment_proof: string | null;
  files?: ProofFile[];
  subject_dossier_id?: string | null;
  event_date?: string | null;
  event_script_id?: string | null;
  event_script_name?: string | null;
  event_store_dossier_id?: string | null;
  event_store_name?: string | null;
  dm_employment_status_suggestion?: 'store_affiliated' | 'freelance' | null;
  dm_employer_store_id_suggestion?: string | null;
  evidence_required?: boolean;
  revision_kind?: 'content' | 'evidence' | null;
  moderation_precheck?: ModerationPrecheck | null;
  created_at: string;
};

type RankingEditForm = {
  type: 'red' | 'black' | 'white';
  subject_name: string;
  subject_type: string;
  subject_city: string;
  subject_url: string;
  content: string;
  subject_dossier_id: string;
};

type DossierOption = {
  id: string;
  entity_type: 'dm' | 'store';
  dm_name: string;
  city?: string | null;
  workplace?: string | null;
  employment_status?: 'unknown' | 'store_affiliated' | 'freelance';
  employer_store_id?: string | null;
  photo_url?: string | null;
  photo_files?: ProofFile[] | null;
};

type CommentReview = {
  id: string;
  content: string;
  author_name: string;
  is_realname?: boolean;
  is_pinned?: boolean;
  pin_label?: string | null;
  payment_proof?: string | null;
  related_note?: string | null;
  related_files?: ProofFile[] | null;
  moderation_precheck?: ModerationPrecheck | null;
  created_at: string;
  lc_rankings?: { subject_name?: string; type?: 'red' | 'black' | 'white' };
};

type ClaimReview = {
  id: string;
  claimant_name?: string | null;
  contact: string;
  message?: string | null;
  created_at: string;
  lc_rankings?: { subject_name?: string; type?: 'red' | 'black' | 'white' };
};

type CommissionReview = {
  id: string;
  poster_name: string;
  poster_is_realname?: boolean;
  title: string;
  content: string;
  desired_role?: string | null;
  target_type?: string | null;
  needed_date?: string | null;
  city?: string | null;
  location?: string | null;
  budget?: string | null;
  contact_note?: string | null;
  moderation_precheck?: ModerationPrecheck | null;
  created_at: string;
};

type CarpoolReview = {
  id: string;
  poster_name: string;
  poster_is_realname?: boolean;
  title: string;
  city: string;
  event_date: string;
  start_time?: string | null;
  deadline_date?: string | null;
  deadline_time?: string | null;
  script_name: string;
  role_name?: string | null;
  role_note?: string | null;
  needed_count: number;
  subsidy_mode: 'none' | 'asking' | 'offering';
  subsidy_type?: 'none' | 'half_price' | 'free_ticket' | 'discount' | 'a_subsidy' | 'fixed_deduct' | 'custom';
  subsidy_amount: number;
  subsidy_discount?: number | null;
  subsidy_note?: string | null;
  store_name?: string | null;
  store_address?: string | null;
  leader_contact?: string | null;
  contact_note?: string | null;
  content: string;
  boost_amount: number;
  juzhanggui_sync_status?: 'pending' | 'synced' | 'failed' | 'disabled';
  juzhanggui_schedule_id?: string | null;
  moderation_precheck?: ModerationPrecheck | null;
  created_at: string;
};

type ScriptContributionReview = {
  id: string;
  profile_id?: string | null;
  profile_name: string;
  script_id?: string | null;
  script_name: string;
  player_roles: { role_name?: string; gender?: string | null; tags?: string[] }[];
  credits_patch?: Record<string, string[]>;
  note?: string | null;
  moderation_precheck?: ModerationPrecheck | null;
  status: 'pending' | 'approved' | 'rejected';
  reward_amount: number;
  created_at: string;
};

type TransactionReview = {
  id: string;
  profile_id: string;
  amount: number;
  description: string;
  payment_proof?: string | null;
  created_at: string;
  lc_profiles?: { display_name?: string; phone?: string };
};

type CertReview = {
  id: string;
  profile_id: string;
  type: 'realname' | 'dm' | 'shop';
  status: 'pending' | 'approved' | 'rejected';
  files: ProofFile[];
  description: string | null;
  reject_reason: string | null;
  created_at: string;
  lc_profiles?: { display_name?: string; phone?: string };
};

type ReportReview = {
  id: string;
  target_type: 'carpool' | 'ranking' | 'comment' | 'commission' | 'profile';
  target_id: string;
  target_title?: string | null;
  reporter_name: string;
  reason: string;
  description?: string | null;
  target_snapshot?: Record<string, unknown> | null;
  risk_level?: 'normal' | 'high' | 'urgent';
  auto_action?: 'none' | 'temporary_hidden' | 'queued_priority';
  auto_action_reason?: string | null;
  report_group_count?: number;
  reviewer_summary?: {
    total?: number;
    hide_votes?: number;
    safe_votes?: number;
    decisions?: Record<string, number>;
  } | null;
  moderation_precheck?: ModerationPrecheck | null;
  created_at: string;
};

type SecurityEvent = {
  id: string;
  actor_id?: string | null;
  actor_role: string;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_path?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type SiteMessage = {
  id: string;
  sender_id?: string | null;
  sender_name: string;
  category?: string | null;
  subject: string;
  content: string;
  contact?: string | null;
  status: 'pending' | 'resolved';
  admin_note?: string | null;
  moderation_precheck?: ModerationPrecheck | null;
  created_at: string;
  updated_at?: string;
};

type PublicReview = {
  id: string;
  target_type: 'profile_update' | 'service_create' | 'portfolio_create' | 'availability_create' | 'tag_create' | 'script_rating_upsert' | 'entity_rating_upsert';
  profile_id?: string | null;
  profile_name?: string | null;
  title?: string | null;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  status: 'pending' | 'approved' | 'rejected';
  review_note?: string | null;
  moderation_precheck?: ModerationPrecheck | null;
  created_at: string;
};

type DossierClaimProof = {
  id: string;
  name: string;
  type: 'image/jpeg';
  size: number;
  width: number;
  height: number;
};

type DossierClaimSubmission = {
  id: string;
  claimant_id?: string | null;
  proof_type: 'social_account' | 'employment' | 'business_license' | 'store_backend' | 'other';
  claim_note: string;
  proof_files: DossierClaimProof[];
  created_at: string;
};

type DmDossierReview = {
  id: string;
  entity_type?: 'dm' | 'store' | null;
  dm_name: string;
  city?: string | null;
  workplace?: string | null;
  employment_status?: 'unknown' | 'store_affiliated' | 'freelance';
  employer_store_id?: string | null;
  profile_url?: string | null;
  photo_url?: string | null;
  photo_files?: ProofFile[] | null;
  note?: string | null;
  tags?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  submitted_by_name?: string | null;
  claim_status: 'unclaimed' | 'pending' | 'approved' | 'rejected';
  claim_note?: string | null;
  claimed_by?: string | null;
  claim_submission?: DossierClaimSubmission | null;
  moderation_precheck?: ModerationPrecheck | null;
  similar_candidates?: Array<{
    id: string;
    dm_name: string;
    city?: string | null;
    workplace?: string | null;
    photo_url?: string | null;
    score: number;
  }>;
  created_at: string;
};

type DmRatingReview = {
  id: string;
  dm_dossier_id: string;
  profile_id: string;
  profile_name: string;
  script_name: string;
  store_name: string;
  played_on: string;
  replay_number: number;
  rating: number;
  content: string;
  tags?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  moderation_precheck?: ModerationPrecheck | null;
  anti_abuse?: {
    risk_score?: number;
    risk_labels?: string[];
    elapsed_ms?: number | null;
    account_hour_count?: number;
    account_day_count?: number;
    ip_hour_count?: number;
    duplicate_content_count?: number;
  } | null;
  dm_dossier?: {
    id: string;
    dm_name: string;
    city?: string | null;
    workplace?: string | null;
    status?: string;
  } | null;
  created_at: string;
};

type StoreRatingReview = {
  id: string;
  store_dossier_id: string;
  profile_id: string;
  profile_name: string;
  script_name: string;
  visited_on: string;
  rating: number;
  content: string;
  tags?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  moderation_precheck?: ModerationPrecheck | null;
  anti_abuse?: {
    risk_score?: number;
    risk_labels?: string[];
    elapsed_ms?: number | null;
    account_hour_count?: number;
    account_day_count?: number;
    ip_hour_count?: number;
    duplicate_content_count?: number;
  } | null;
  store_dossier?: {
    id: string;
    entity_type?: 'store';
    dm_name: string;
    city?: string | null;
    workplace?: string | null;
    status?: string;
  } | null;
  created_at: string;
};

type GuideReview = {
  id: string;
  author_name: string;
  title: string;
  summary: string;
  content: string;
  price: number;
  spoiler_level: string;
  guide_type: string;
  target_name?: string | null;
  moderation_precheck?: ModerationPrecheck | null;
  created_at: string;
};

type GuideWithdrawalReview = {
  id: string;
  creator_id: string;
  amount: number;
  account_type: string;
  account_name: string;
  account_identifier: string;
  status: 'pending' | 'paid' | 'rejected' | 'cancelled';
  created_at: string;
};

type RejectType = 'profile' | 'ranking' | 'comment' | 'claim' | 'commission' | 'carpool' | 'transaction' | 'cert' | 'dmDossier' | 'dmRating' | 'storeRating' | 'publicReview' | 'guide' | 'guideWithdrawal';
type Tab = 'allPending' | 'pending' | 'accounts' | 'requests' | 'messages' | 'rankings' | 'publishedRankings' | 'publicReviews' | 'guides' | 'guideWithdrawals' | 'comments' | 'claims' | 'commissions' | 'carpools' | 'scriptContributions' | 'dmDossiers' | 'dmRatings' | 'storeRatings' | 'reports' | 'wallet' | 'certs' | 'security';

type PendingReviewItem = {
  id: string;
  tab: Tab;
  category: string;
  title: string;
  meta: string;
  createdAt?: string | null;
  accent: string;
  tags?: string[];
};

function certificationTypeLabel(type: string) {
  if (type === 'realname') return '⭐ 实名认证';
  if (type === 'dm') return '🎭 DM 开本记录认证';
  if (type === 'shop') return '🏪 店家营业执照认证';
  return '认证申请';
}

function publicReviewTypeLabel(type: string) {
  if (type === 'profile_update') return '主页资料';
  if (type === 'service_create') return '服务上线';
  if (type === 'portfolio_create') return '作品图片';
  if (type === 'availability_create') return '公开档期';
  if (type === 'tag_create') return '公开标签';
  if (type === 'script_rating_upsert') return '剧本评分';
  if (type === 'entity_rating_upsert') return '角色评分';
  return '公开内容';
}

function siteMessageCategoryLabel(category?: string | null) {
  if (category === 'dm_correction') return 'DM资料纠错';
  if (category === 'appeal') return '申诉';
  if (category === 'bug') return '故障反馈';
  if (category === 'account') return '账号问题';
  if (category === 'cooperation') return '合作共建';
  if (category === 'suggestion') return '功能建议';
  return '其他反馈';
}

function rankingTypeLabel(type: string) {
  if (type === 'red') return '红榜';
  if (type === 'black') return '黑榜';
  if (type === 'white') return '白榜';
  return '榜单';
}

function publicReviewTags(item: PublicReview) {
  const tags = [publicReviewTypeLabel(item.target_type)];
  const payload = item.payload || {};
  if (item.target_type === 'tag_create') {
    const tag = typeof payload.tag === 'string' ? payload.tag.trim() : '';
    const targetType = typeof payload.target_type === 'string' ? payload.target_type.trim() : '';
    if (tag) tags.push(`#${tag}`);
    if (targetType) tags.push(`对象:${targetType}`);
  } else if (item.target_type === 'script_rating_upsert' || item.target_type === 'entity_rating_upsert') {
    if (Array.isArray(payload.tags)) tags.push(...payload.tags.map(tag => `#${String(tag)}`).slice(0, 4));
    if (payload.spoiler_level) tags.push(`剧透:${String(payload.spoiler_level)}`);
  }
  return Array.from(new Set(tags.filter(Boolean))).slice(0, 6);
}

function summarizePublicReviewPayload(payload?: Record<string, unknown> | null) {
  if (!payload || typeof payload !== 'object') return [];
  if (payload.profile_patch && typeof payload.profile_patch === 'object') {
    const patch = payload.profile_patch as Record<string, unknown>;
    return Object.entries(patch)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .slice(0, 12)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join('、') : typeof value === 'object' ? JSON.stringify(value) : String(value).slice(0, 120)}`);
  }
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 12)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? `${value.length} 项` : typeof value === 'object' ? JSON.stringify(value).slice(0, 160) : String(value).slice(0, 160)}`);
}

function publicReviewProofFiles(item: PublicReview): ProofFile[] {
  const payload = item.payload || {};
  const files: ProofFile[] = [];
  const push = (value: unknown, name: string) => {
    if (typeof value === 'string' && value.trim()) files.push({ name, url: value.trim(), type: 'image/*' });
  };
  if (payload.profile_patch && typeof payload.profile_patch === 'object') {
    push((payload.profile_patch as Record<string, unknown>).avatar, '待审公开头像');
  }
  push(payload.image_url, '待审作品图片');
  if (Array.isArray(payload.items)) {
    payload.items.forEach((raw, index) => {
      if (!raw || typeof raw !== 'object') return;
      const sourcePayload = (raw as Record<string, unknown>).source_payload;
      if (!sourcePayload || typeof sourcePayload !== 'object') return;
      push((sourcePayload as Record<string, unknown>).screenshot_url, `档期截图 ${index + 1}`);
    });
  }
  const seen = new Set<string>();
  return files.filter(file => file.url && !seen.has(file.url) && seen.add(file.url));
}

const card: React.CSSProperties = {
  backgroundColor: SURFACE,
  border: `1px solid ${LINE}`,
  borderRadius: 12,
  padding: '16px 20px',
  boxShadow: '0 12px 28px rgba(31,41,55,0.05)',
};

const MODERATION_RISK_LABELS: Record<string, string> = {
  identity_number: '疑似身份证号',
  doxxing_or_privacy: '隐私泄露风险',
  illegal_or_crime: '违法犯罪风险',
  minor_high_risk: '未成年人高风险',
  phone_or_contact: '包含手机号或联系方式',
  wechat_or_qq: '包含微信或QQ',
  abuse_or_attack: '辱骂或人身攻击',
  rumor_or_defamation_risk: '传闻或诽谤风险',
  sexual_content: '性相关内容风险',
  image_needs_manual_review: '图片需要人工查看',
  suspected_automation: '疑似脚本批量提交',
  submitted_too_fast: '提交速度异常',
  duplicate_content_recently_seen: '近期出现重复文本',
  high_account_velocity: '账号提交过于频繁',
  high_ip_velocity: '同一网络提交过于频繁',
};

function moderationRiskLabel(value: string) {
  return MODERATION_RISK_LABELS[value] || '其他需要人工确认的风险项';
}

function normalizeAdminUrl(value?: string | null, allowUploadPath = false) {
  const raw = value?.trim() || '';
  if (!raw || ['?', '？', '-', '—', '无', '暂无', '没有', '待补'].includes(raw)) return null;
  if (allowUploadPath && /^\/uploads\//i.test(raw)) return raw;
  const candidate = /^https?:\/\//i.test(raw)
    ? raw
    : /^(?:www\.)?[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:[/:?#]|$)/.test(raw)
      ? `https://${raw}`
      : '';
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function ModerationPrecheckBadge({ value }: { value?: ModerationPrecheck | null }) {
  if (!value) return null;
  const decision = value.decision || 'pass';
  const color = decision === 'block' ? '#991b1b' : decision === 'review' ? '#7c2d12' : '#166534';
  const borderColor = decision === 'block' ? 'rgba(185,28,28,0.32)' : decision === 'review' ? 'rgba(194,65,12,0.32)' : 'rgba(22,101,52,0.24)';
  const bg = decision === 'block' ? '#fef2f2' : decision === 'review' ? '#fff7ed' : '#f0fdf4';
  const label = decision === 'block' ? '建议拦截' : decision === 'review' ? '需关注' : '通过';
  const labels = Array.isArray(value.risk_labels) ? value.risk_labels.map(moderationRiskLabel) : [];
  return (
    <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, border: `1px solid ${borderColor}`, background: bg, color, fontSize: '0.76rem', lineHeight: 1.6 }}>
      <strong>本地预审：{label}</strong>
      {typeof value.risk_score === 'number' ? ` · 风险 ${value.risk_score}` : ''}
      {labels.length > 0 ? ` · ${labels.join(' / ')}` : ''}
      {value.summary ? <div style={{ color: 'rgba(71,85,105,0.88)' }}>{value.summary}</div> : null}
    </div>
  );
}

function getRelatedProof(comment: CommentReview): { note: string; files: ProofFile[] } {
  const directFiles = Array.isArray(comment.related_files) ? comment.related_files : [];
  if (comment.related_note || directFiles.length > 0) {
    return { note: comment.related_note || '', files: directFiles };
  }
  if (!comment.payment_proof?.trim().startsWith('{')) return { note: '', files: [] };
  try {
    const parsed = JSON.parse(comment.payment_proof) as {
      kind?: string;
      related_note?: string;
      related_files?: ProofFile[];
    };
    if (parsed.kind !== 'related_party_certification') return { note: '', files: [] };
    return {
      note: parsed.related_note || '',
      files: Array.isArray(parsed.related_files) ? parsed.related_files : [],
    };
  } catch {
    return { note: '', files: [] };
  }
}

export default function Admin() {
  const [authed, setAuthed] = useState(() => {
    const t = getToken();
    return !!t && !isTokenExpired(t);
  });
  const [password, setPassword] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<ContactReq[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [approvedRankings, setApprovedRankings] = useState<Ranking[]>([]);
  const [comments, setComments] = useState<CommentReview[]>([]);
  const [claims, setClaims] = useState<ClaimReview[]>([]);
  const [commissions, setCommissions] = useState<CommissionReview[]>([]);
  const [carpools, setCarpools] = useState<CarpoolReview[]>([]);
  const [scriptContributions, setScriptContributions] = useState<ScriptContributionReview[]>([]);
  const [dmDossiers, setDmDossiers] = useState<DmDossierReview[]>([]);
  const [dmRatings, setDmRatings] = useState<DmRatingReview[]>([]);
  const [storeRatings, setStoreRatings] = useState<StoreRatingReview[]>([]);
  const [dossierOptions, setDossierOptions] = useState<DossierOption[]>([]);
  const [reports, setReports] = useState<ReportReview[]>([]);
  const [siteMessages, setSiteMessages] = useState<SiteMessage[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [publicReviews, setPublicReviews] = useState<PublicReview[]>([]);
  const [guides, setGuides] = useState<GuideReview[]>([]);
  const [guideWithdrawals, setGuideWithdrawals] = useState<GuideWithdrawalReview[]>([]);
  const [transactions, setTransactions] = useState<TransactionReview[]>([]);
  const [certs, setCerts] = useState<CertReview[]>([]);
const [loading, setLoading] = useState(false);
const [transactionLoading, setTransactionLoading] = useState(false);
const [transactionMsg, setTransactionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('allPending');
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: string; reason: string; type: RejectType; revisionKind: 'content' | 'evidence' }>({
    open: false,
    id: '',
    reason: '',
    type: 'profile',
    revisionKind: 'content',
  });
  const [rankingEdit, setRankingEdit] = useState<{ item: Ranking; form: RankingEditForm; saving: boolean; error: string } | null>(null);

  async function loadData(token?: string) {
    const t = token || getToken();
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/admin/pending`, { headers: { Authorization: `Bearer ${t}` } });
      const d = await r.json();
      if (d.success) {
        setProfiles((d.data as { profiles: Profile[] }).profiles || []);
        setRequests((d.data as { contactRequests: ContactReq[] }).contactRequests || []);
        setRankings((d.data as { rankings: Ranking[] }).rankings || []);
        setApprovedRankings((d.data as { approvedRankings: Ranking[] }).approvedRankings || []);
        setComments((d.data as { comments: CommentReview[] }).comments || []);
        setClaims((d.data as { claims: ClaimReview[] }).claims || []);
        setCommissions((d.data as { commissions: CommissionReview[] }).commissions || []);
        setCarpools((d.data as { carpools: CarpoolReview[] }).carpools || []);
        setScriptContributions((d.data as { scriptContributions: ScriptContributionReview[] }).scriptContributions || []);
        setDmDossiers((d.data as { dmDossiers: DmDossierReview[] }).dmDossiers || []);
        setDmRatings((d.data as { dmRatings: DmRatingReview[] }).dmRatings || []);
        setStoreRatings((d.data as { storeRatings: StoreRatingReview[] }).storeRatings || []);
        setDossierOptions((d.data as { dossierOptions: DossierOption[] }).dossierOptions || []);
        setTransactions((d.data as { transactions: TransactionReview[] }).transactions || []);
        setCerts((d.data as { certifications: CertReview[] }).certifications || []);
        setReports((d.data as { reports: ReportReview[] }).reports || []);
        setSiteMessages((d.data as { siteMessages: SiteMessage[] }).siteMessages || []);
        setSecurityEvents((d.data as { securityEvents: SecurityEvent[] }).securityEvents || []);
        setPublicReviews((d.data as { publicReviews: PublicReview[] }).publicReviews || []);
        setGuides((d.data as { guides: GuideReview[] }).guides || []);
        setGuideWithdrawals((d.data as { guideWithdrawals: GuideWithdrawalReview[] }).guideWithdrawals || []);
      } else {
        const errMsg = typeof d.error === 'string' ? d.error : (d.error?.message || '加载失败');
        setError(errMsg);
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authed) return;
    const t = getToken();
    if (!t || isTokenExpired(t)) {
      localStorage.removeItem('lc_admin_token');
      return;
    }
    const timer = window.setTimeout(() => void loadData(t), 0);
    return () => window.clearTimeout(timer);
  }, [authed]);

  const login = async () => {
    setError('');
    try {
      const r = await fetch(`${API}/lc/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const d = await r.json();
      if (d.success) {
        localStorage.setItem('lc_admin_token', d.data.token);
        localStorage.setItem('lc_admin_last_login_at', new Date().toISOString());
        window.dispatchEvent(new Event('lc-auth-changed'));
        setAuthed(true);
      } else {
        const errMsg = typeof d.error === 'string' ? d.error : (d.error?.message || '密码错误');
        setError(errMsg);
      }
    } catch {
      setError('网络错误');
    }
  };

  const approveProfile = async (id: string) => {
    await fetch(`${API}/lc/admin/profile/${id}/unflag`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    void loadData();
  };

  const hideProfile = async (id: string) => {
    await fetch(`${API}/lc/admin/profile/${id}/flag`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectReason: '管理员下线' }),
    });
    void loadData();
  };

  const banProfile = async (id: string) => {
    const reason = window.prompt('限制账号原因（会记录到安全日志）', '违反平台规则，限制账号功能');
    if (reason === null) return;
    await fetch(`${API}/lc/admin/profile/${id}/ban`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    void loadData();
  };

  const unbanProfile = async (id: string) => {
    await fetch(`${API}/lc/admin/profile/${id}/unban`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    void loadData();
  };

  const toggleRealname = async (id: string, value: boolean) => {
    await fetch(`${API}/lc/admin/profile/${id}/realname`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    void loadData();
  };

  const approveReq = async (id: string) => {
    await fetch(`${API}/lc/contact-requests/${id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    void loadData();
  };

  const rejectReq = async (id: string) => {
    await fetch(`${API}/lc/contact-requests/${id}/reject`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    void loadData();
  };

  const approveRanking = async (id: string, targetType?: 'red' | 'black' | 'white') => {
    await fetch(`${API}/lc/admin/rankings/${id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType }),
    });
    void loadData();
  };

  const openRankingEdit = (item: Ranking) => {
    setRankingEdit({
      item,
      saving: false,
      error: '',
      form: {
        type: item.type,
        subject_name: item.subject_name || '',
        subject_type: item.subject_type || 'creator',
        subject_city: item.subject_city || '',
        subject_url: item.subject_url || '',
        content: item.content || '',
        subject_dossier_id: item.subject_dossier_id || '',
      },
    });
  };

  const updateRankingEditForm = (patch: Partial<RankingEditForm>) => {
    setRankingEdit(prev => prev ? { ...prev, form: { ...prev.form, ...patch }, error: '' } : prev);
  };

  const saveRankingEdit = async () => {
    if (!rankingEdit) return;
    setRankingEdit(prev => prev ? { ...prev, saving: true, error: '' } : prev);
    try {
      const r = await fetch(`${API}/lc/admin/rankings/${rankingEdit.item.id}/edit`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(rankingEdit.form),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        const errMsg = typeof d.error === 'string' ? d.error : (d.error?.message || '保存失败');
        setRankingEdit(prev => prev ? { ...prev, saving: false, error: errMsg } : prev);
        return;
      }
      setRankingEdit(null);
      void loadData();
    } catch {
      setRankingEdit(prev => prev ? { ...prev, saving: false, error: '网络错误' } : prev);
    }
  };

  const approveComment = async (id: string) => {
    await fetch(`${API}/lc/admin/comments/${id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    void loadData();
  };

  const approveClaim = async (id: string) => {
    await fetch(`${API}/lc/admin/claims/${id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    void loadData();
  };

  const approveCommission = async (id: string) => {
    await fetch(`${API}/lc/admin/commissions/${id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    void loadData();
  };

  const approveCarpool = async (id: string) => {
    await fetch(`${API}/lc/admin/carpools/${id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    void loadData();
  };

  const approveScriptContribution = async (id: string) => {
    await fetch(`${API}/lc/admin/script-contributions/${id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNote: '剧本库维护通过' }),
    });
    void loadData();
  };

  const rejectScriptContribution = async (id: string) => {
    const reviewNote = window.prompt('拒绝原因（可不填）', '');
    if (reviewNote === null) return;
    await fetch(`${API}/lc/admin/script-contributions/${id}/reject`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNote }),
    });
    setScriptContributions(prev => prev.filter(item => item.id !== id));
    void loadData();
  };

  const approveDmDossier = async (id: string) => {
    const response = await fetch(`${API}/lc/admin/dm-dossiers/${id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setError(typeof payload.error === 'string' ? payload.error : payload.error?.message || '档案审核失败');
      return;
    }
    setDmDossiers(prev => prev.filter(item => item.id !== id));
    void loadData();
  };

  const mergeDmDossier = async (sourceId: string, target: NonNullable<DmDossierReview['similar_candidates']>[number]) => {
    if (!window.confirm(`确认把这条待审档案合并到“${target.dm_name}”吗？关联评分也会一并转移。`)) return;
    const response = await fetch(`${API}/lc/admin/dm-dossiers/${sourceId}/merge`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: target.id }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setError(typeof payload.error === 'string' ? payload.error : payload.error?.message || 'DM档案合并失败');
      return;
    }
    setDmDossiers(prev => prev.filter(item => item.id !== sourceId));
    void loadData();
  };

  const mergeStoreDossier = async (sourceId: string, target: NonNullable<DmDossierReview['similar_candidates']>[number]) => {
    if (!window.confirm(`确认把这条待审店家档案合并到“${target.dm_name}”吗？关联评分和店家关系也会一并转移。`)) return;
    const response = await fetch(`${API}/lc/admin/store-dossiers/${sourceId}/merge`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: target.id }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setError(typeof payload.error === 'string' ? payload.error : payload.error?.message || '店家档案合并失败');
      return;
    }
    setDmDossiers(prev => prev.filter(item => item.id !== sourceId));
    void loadData();
  };

  const approveDmRating = async (id: string) => {
    const response = await fetch(`${API}/lc/admin/dm-ratings/${id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNote: 'DM体验评分审核通过' }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setError(typeof payload.error === 'string' ? payload.error : payload.error?.message || 'DM评分审核失败');
      return;
    }
    setDmRatings(prev => prev.filter(item => item.id !== id));
    void loadData();
  };

  const approveStoreRating = async (id: string) => {
    const response = await fetch(`${API}/lc/admin/store-ratings/${id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNote: '店家到店评分审核通过' }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setError(typeof payload.error === 'string' ? payload.error : payload.error?.message || '店家评分审核失败');
      return;
    }
    setStoreRatings(prev => prev.filter(item => item.id !== id));
    void loadData();
  };

  const approvePublicReview = async (id: string) => {
    await fetch(`${API}/lc/admin/public-reviews/${id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNote: '公开内容审核通过' }),
    });
    setPublicReviews(prev => prev.filter(item => item.id !== id));
    void loadData();
  };

  const approveGuide = async (id: string) => {
    await fetch(`${API}/lc/admin/guides/${id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNote: '攻略审核通过' }),
    });
    setGuides(prev => prev.filter(item => item.id !== id));
    void loadData();
  };

  const approveGuideWithdrawal = async (id: string) => {
    await fetch(`${API}/lc/admin/guide-withdrawals/${id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNote: '已确认打款' }),
    });
    setGuideWithdrawals(prev => prev.filter(item => item.id !== id));
    void loadData();
  };

  const resolveReport = async (id: string, action: 'resolved' | 'dismissed', hideTarget = false, restoreTarget = false) => {
    await fetch(`${API}/lc/admin/reports/${id}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        hideTarget,
        restoreTarget,
        rejectReason: hideTarget ? '举报处理后下架' : undefined,
        handlerNote: restoreTarget ? '复核后恢复展示' : action === 'dismissed' ? '已看，暂不处理' : '已处理',
      }),
    });
    const target = reports.find(item => item.id === id);
    setReports(prev => target ? prev.filter(item => !(item.target_type === target.target_type && item.target_id === target.target_id)) : prev.filter(item => item.id !== id));
    if (hideTarget && target?.target_type === 'carpool') setCarpools(prev => prev.filter(item => item.id !== target.target_id));
    void loadData();
  };

  const resolveSiteMessage = async (id: string) => {
    await fetch(`${API}/lc/admin/site-messages/${id}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNote: '已处理' }),
    });
    setSiteMessages(prev => prev.filter(item => item.id !== id));
    void loadData();
  };

  const approveTransaction = async (id: string) => {
    setTransactionLoading(true);
    setTransactionMsg(null);
    try {
      const r = await fetch(`${API}/lc/admin/transactions/${id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        const errMsg = typeof d.error === 'string' ? d.error : (d.error?.message || '到账失败，请重试');
        setTransactionMsg({ text: errMsg, ok: false });
      } else {
        setTransactionMsg({ text: '已到账', ok: true });
      }
    } catch {
      setTransactionMsg({ text: '网络错误，请重试', ok: false });
    } finally {
      setTransactionLoading(false);
      void loadData();
    }
  };

  const approveCert = async (id: string) => {
    await fetch(`${API}/lc/admin/certifications/${id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    void loadData();
  };

  const openRejectModal = (id: string, type: RejectType, revisionKind: 'content' | 'evidence' = 'content') => {
    setRejectModal({ open: true, id, reason: '', type, revisionKind });
  };

  const confirmReject = async () => {
    const { id, reason, type, revisionKind } = rejectModal;
    setRejectModal({ open: false, id: '', reason: '', type: 'profile', revisionKind: 'content' });

    const headers = { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
    const body = JSON.stringify({ rejectReason: reason, revisionKind });

    if (type === 'profile') {
      await fetch(`${API}/lc/admin/profile/${id}/flag`, { method: 'PUT', headers, body });
      setProfiles(prev => prev.filter(p => p.id !== id));
    } else if (type === 'ranking') {
      await fetch(`${API}/lc/admin/rankings/${id}/reject`, { method: 'PUT', headers, body });
      setRankings(prev => prev.filter(r => r.id !== id));
    } else if (type === 'comment') {
      await fetch(`${API}/lc/admin/comments/${id}/reject`, { method: 'PUT', headers });
      setComments(prev => prev.filter(c => c.id !== id));
    } else if (type === 'claim') {
      await fetch(`${API}/lc/admin/claims/${id}/reject`, { method: 'PUT', headers });
      setClaims(prev => prev.filter(c => c.id !== id));
    } else if (type === 'commission') {
      await fetch(`${API}/lc/admin/commissions/${id}/reject`, { method: 'PUT', headers, body });
      setCommissions(prev => prev.filter(c => c.id !== id));
    } else if (type === 'carpool') {
      await fetch(`${API}/lc/admin/carpools/${id}/reject`, { method: 'PUT', headers, body });
      setCarpools(prev => prev.filter(c => c.id !== id));
    } else if (type === 'transaction') {
      await fetch(`${API}/lc/admin/transactions/${id}/reject`, { method: 'PUT', headers, body });
      setTransactions(prev => prev.filter(t => t.id !== id));
    } else if (type === 'cert') {
      await fetch(`${API}/lc/admin/certifications/${id}/reject`, { method: 'PUT', headers, body });
      setCerts(prev => prev.filter(c => c.id !== id));
    } else if (type === 'dmDossier') {
      await fetch(`${API}/lc/admin/dm-dossiers/${id}/reject`, { method: 'PUT', headers, body });
      setDmDossiers(prev => prev.filter(item => item.id !== id));
    } else if (type === 'dmRating') {
      await fetch(`${API}/lc/admin/dm-ratings/${id}/reject`, { method: 'PUT', headers, body });
      setDmRatings(prev => prev.filter(item => item.id !== id));
    } else if (type === 'storeRating') {
      await fetch(`${API}/lc/admin/store-ratings/${id}/reject`, { method: 'PUT', headers, body });
      setStoreRatings(prev => prev.filter(item => item.id !== id));
    } else if (type === 'publicReview') {
      await fetch(`${API}/lc/admin/public-reviews/${id}/reject`, { method: 'PUT', headers, body });
      setPublicReviews(prev => prev.filter(item => item.id !== id));
    } else if (type === 'guide') {
      await fetch(`${API}/lc/admin/guides/${id}/reject`, { method: 'PUT', headers, body });
      setGuides(prev => prev.filter(item => item.id !== id));
    } else if (type === 'guideWithdrawal') {
      await fetch(`${API}/lc/admin/guide-withdrawals/${id}/reject`, { method: 'PUT', headers, body });
      setGuideWithdrawals(prev => prev.filter(item => item.id !== id));
    }
  };

  const logout = () => {
    try {
      const creator = JSON.parse(localStorage.getItem('lc_creator') || '{}');
      if (creator?.role === 'admin') localStorage.removeItem('lc_creator');
    } catch {
      // Ignore malformed local auth state and continue clearing admin state.
    }
    localStorage.removeItem('lc_admin_token');
    window.dispatchEvent(new Event('lc-auth-changed'));
    setAuthed(false);
    setProfiles([]);
    setRequests([]);
    setRankings([]);
    setApprovedRankings([]);
    setComments([]);
    setClaims([]);
    setCommissions([]);
    setCarpools([]);
    setScriptContributions([]);
    setDmDossiers([]);
    setDmRatings([]);
    setStoreRatings([]);
    setDossierOptions([]);
    setReports([]);
    setSiteMessages([]);
    setSecurityEvents([]);
    setGuides([]);
    setGuideWithdrawals([]);
    setTransactions([]);
    setCerts([]);
  };

  const pendingProfiles = profiles.filter(p => !p.is_visible && !p.reject_reason);
  const accountProfiles = profiles;
  const pendingReviewItems: PendingReviewItem[] = [
    ...pendingProfiles.map(p => ({
      id: `profile-${p.id}`,
      tab: 'pending' as const,
      category: '创作者资料',
      title: profileNickname(p),
      meta: `${profileAccountSummary(p)}${p.role_type ? ` · ${p.role_type}` : ''}`,
      createdAt: p.created_at,
      accent: '#b91c1c',
    })),
    ...rankings.map(r => ({
      id: `ranking-${r.id}`,
      tab: 'rankings' as const,
      category: `${rankingTypeLabel(r.type)}帖子`,
      title: r.subject_name,
      meta: `${SUBJECT_LABEL[r.subject_type] || r.subject_type} · ${r.subject_city || '未知城市'} · 作者：${r.author_name}`,
      createdAt: r.created_at,
      accent: r.type === 'red' ? '#dc2626' : r.type === 'black' ? '#475569' : '#d9a857',
      tags: [rankingTypeLabel(r.type), SUBJECT_LABEL[r.subject_type] || r.subject_type, r.subject_city || '未知城市'],
    })),
    ...publicReviews.map(item => ({
      id: `public-${item.id}`,
      tab: 'publicReviews' as const,
      category: publicReviewTypeLabel(item.target_type),
      title: item.title || publicReviewTypeLabel(item.target_type),
      meta: `提交人：${item.profile_name || item.profile_id || '未知用户'}${item.summary ? ` · ${item.summary}` : ''}`,
      createdAt: item.created_at,
      accent: item.target_type === 'tag_create' ? '#7c3aed' : '#ca8a04',
      tags: publicReviewTags(item),
    })),
    ...comments.map(c => ({
      id: `comment-${c.id}`,
      tab: 'comments' as const,
      category: c.is_pinned ? '相关方回应' : '评论',
      title: c.lc_rankings?.subject_name || '未知帖子',
      meta: `作者：${c.author_name}`,
      createdAt: c.created_at,
      accent: '#0284c7',
      tags: [c.is_pinned ? '相关方' : '评论', rankingTypeLabel(c.lc_rankings?.type || '')],
    })),
    ...claims.map(c => ({
      id: `claim-${c.id}`,
      tab: 'claims' as const,
      category: '相关方申请',
      title: c.lc_rankings?.subject_name || '未知帖子',
      meta: `申请人：${c.claimant_name || '未知用户'} · ${c.contact || '未填联系方式'}`,
      createdAt: c.created_at,
      accent: '#ea580c',
    })),
    ...commissions.map(c => ({
      id: `commission-${c.id}`,
      tab: 'commissions' as const,
      category: '委托需求',
      title: c.title,
      meta: `发布人：${c.poster_name}${c.city ? ` · ${c.city}` : ''}${c.needed_date ? ` · ${c.needed_date}` : ''}`,
      createdAt: c.created_at,
      accent: '#b45309',
    })),
    ...carpools.map(c => ({
      id: `carpool-${c.id}`,
      tab: 'carpools' as const,
      category: '拼车',
      title: c.title,
      meta: `${c.city} · ${c.event_date} · ${c.script_name}`,
      createdAt: c.created_at,
      accent: '#0f766e',
    })),
    ...scriptContributions.map(item => ({
      id: `script-${item.id}`,
      tab: 'scriptContributions' as const,
      category: '剧本库',
      title: item.script_name,
      meta: `提交人：${item.profile_name || '未知用户'}`,
      createdAt: item.created_at,
      accent: '#a16207',
      tags: item.player_roles.flatMap(role => role.tags || []).slice(0, 6),
    })),
    ...dmDossiers.map(item => ({
      id: `dossier-${item.id}`,
      tab: 'dmDossiers' as const,
      category: item.claim_status === 'pending' && item.status !== 'pending'
        ? '档案认领'
        : item.entity_type === 'store' ? '店家档案' : 'DM档案',
      title: item.dm_name,
      meta: `${item.city || '未知城市'}${item.workplace ? ` · ${item.workplace}` : ''}`,
      createdAt: item.created_at,
      accent: '#be185d',
      tags: item.tags || [],
    })),
    ...dmRatings.map(item => ({
      id: `dm-rating-${item.id}`,
      tab: 'dmRatings' as const,
      category: 'DM评分',
      title: item.dm_dossier?.dm_name || '待关联DM',
      meta: `${item.profile_name || '未知玩家'} · ${item.script_name} · ${item.played_on} · 第${item.replay_number}刷`,
      createdAt: item.created_at,
      accent: '#c2410c',
      tags: [`${item.rating}星`, item.store_name, ...(item.tags || [])].filter(Boolean).slice(0, 6),
    })),
    ...storeRatings.map(item => ({
      id: `store-rating-${item.id}`,
      tab: 'storeRatings' as const,
      category: '店家评分',
      title: item.store_dossier?.dm_name || '待关联店家',
      meta: `${item.profile_name || '未知玩家'} · ${item.script_name} · ${item.visited_on}`,
      createdAt: item.created_at,
      accent: '#0f766e',
      tags: [`${item.rating}星`, ...(item.tags || [])].filter(Boolean).slice(0, 6),
    })),
    ...reports.map(r => ({
      id: `report-${r.id}`,
      tab: 'reports' as const,
      category: '举报',
      title: r.target_title || r.target_id,
      meta: `举报人：${r.reporter_name} · ${r.reason}`,
      createdAt: r.created_at,
      accent: '#dc2626',
      tags: [r.target_type, r.risk_level || 'normal'],
    })),
    ...siteMessages.map(item => ({
      id: `message-${item.id}`,
      tab: 'messages' as const,
      category: siteMessageCategoryLabel(item.category),
      title: item.subject,
      meta: `${item.sender_name || '匿名'}${item.contact ? ` · ${item.contact}` : ''}`,
      createdAt: item.created_at,
      accent: '#0369a1',
    })),
    ...transactions.map(tx => ({
      id: `transaction-${tx.id}`,
      tab: 'wallet' as const,
      category: '充值',
      title: `充值 ${tx.amount} 契约币`,
      meta: `用户：${tx.lc_profiles?.display_name || tx.profile_id}`,
      createdAt: tx.created_at,
      accent: '#15803d',
    })),
    ...certs.map(c => ({
      id: `cert-${c.id}`,
      tab: 'certs' as const,
      category: '认证',
      title: certificationTypeLabel(c.type),
      meta: `用户：${c.lc_profiles?.display_name || c.profile_id}`,
      createdAt: c.created_at,
      accent: '#2563eb',
    })),
    ...guides.map(item => ({
      id: `guide-${item.id}`,
      tab: 'guides' as const,
      category: '攻略',
      title: item.title,
      meta: `作者：${item.author_name || '未知用户'} · ${item.price || 0} 契约币`,
      createdAt: item.created_at,
      accent: '#be123c',
      tags: [item.guide_type, `剧透:${item.spoiler_level}`],
    })),
    ...guideWithdrawals.map(item => ({
      id: `withdrawal-${item.id}`,
      tab: 'guideWithdrawals' as const,
      category: '提现',
      title: `提现 ${item.amount}`,
      meta: `${item.account_name} · ${item.account_type}`,
      createdAt: item.created_at,
      accent: '#047857',
    })),
  ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  if (!authed) return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Link to="/" aria-label="剧幕录首页" style={{ display: 'inline-flex', textDecoration: 'none' }}>
            <BrandLogo />
          </Link>
          <p style={{ color: MUTED, fontSize: '0.875rem', marginTop: 8 }}>管理后台</p>
        </div>
        <div style={{ backgroundColor: SURFACE, border: '1px solid rgba(217,168,87,0.26)', borderRadius: 16, padding: '30px 28px', boxShadow: '0 24px 60px rgba(31,41,55,0.08)' }}>
          <div style={{ width: 48, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, margin: '0 auto 24px' }} />
          <h2 style={{ textAlign: 'center', fontWeight: 800, marginBottom: 24, color: INK }}>管理员登录</h2>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="管理密码"
            style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1px solid ${LINE}`, backgroundColor: SURFACE, color: INK, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
          <button onClick={login}
            style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: INK, color: BG, fontWeight: 800, fontSize: '0.9rem' }}>
            登录
          </button>
          {error && <p style={{ textAlign: 'center', color: '#f87171', fontSize: '0.82rem', marginTop: 12 }}>{error}</p>}
        </div>
      </div>
    </div>
  );

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: '0 0 auto',
    padding: '9px 12px',
    borderRadius: 10,
    border: active ? `1px solid ${INK}` : `1px solid ${LINE}`,
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 700,
    transition: 'all 0.2s',
    background: active ? INK : SURFACE,
    color: active ? BG : MUTED,
    boxShadow: active ? '0 8px 18px rgba(31,41,55,0.12)' : 'none',
    whiteSpace: 'nowrap',
  });

  const statCards = [
    { label: '全部待审', value: pendingReviewItems.length, color: '#b91c1c' },
    { label: '账号', value: accountProfiles.length, color: '#047857' },
    { label: '联系申请', value: requests.length, color: '#8a5a19' },
    { label: '充值', value: transactions.length, color: '#15803d' },
    { label: '委托需求', value: commissions.length, color: '#b45309' },
    { label: '拼车', value: carpools.length, color: '#0f766e' },
    { label: '剧本库', value: scriptContributions.length, color: '#a16207' },
    { label: '档案审核', value: dmDossiers.length, color: '#be185d' },
    { label: 'DM评分', value: dmRatings.length, color: '#c2410c' },
    { label: '店家评分', value: storeRatings.length, color: '#0f766e' },
    { label: '举报', value: reports.length, color: '#dc2626' },
    { label: '站内信', value: siteMessages.length, color: '#0369a1' },
    { label: '安全日志', value: securityEvents.length, color: '#c2410c' },
    { label: '红黑榜', value: rankings.length, color: '#7c3aed' },
    { label: '已发布榜单', value: approvedRankings.length, color: '#2563eb' },
    { label: '公开内容', value: publicReviews.length, color: '#ca8a04' },
    { label: '攻略', value: guides.length, color: '#be123c' },
    { label: '提现', value: guideWithdrawals.length, color: '#047857' },
    { label: '评论', value: comments.length, color: '#0284c7' },
    { label: '相关方', value: claims.length, color: '#ea580c' },
    { label: '认证', value: certs.length, color: '#2563eb' },
  ];

  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', color: INK }}>
      <div style={{ background: 'linear-gradient(180deg, #FFF8E8 0%, #FFFDF8 100%)', borderBottom: '1px solid rgba(217,168,87,0.18)', padding: '22px 40px' }}>
        <div className="admin-header-inner" style={{ maxWidth: 1360, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: 'rgba(217,168,87,0.14)', color: '#8a5a19', fontSize: '0.72rem', fontWeight: 800, marginBottom: 8 }}>
              超管审核台
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.85rem', marginBottom: 4, letterSpacing: 0 }}>剧幕录管理后台</h1>
            <p style={{ fontSize: '0.84rem', color: MUTED }}>审核队列、公开内容、账号治理和安全记录集中处理</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link to="/" style={{ fontSize: '0.82rem', color: MUTED, textDecoration: 'none', fontWeight: 700 }}>返回首页</Link>
            <button onClick={logout}
              style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${LINE}`, background: SURFACE, color: MUTED, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
              退出
            </button>
          </div>
        </div>
      </div>

      <div className="admin-page-body" style={{ maxWidth: 1360, margin: '0 auto', padding: '28px 40px 40px' }}>
        <div className="admin-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20, alignItems: 'start' }}>
          <section style={{ minWidth: 0, display: 'grid', gap: 16 }}>
            <div style={{ ...card, padding: '16px 18px' }}>
              <div style={{ fontWeight: 900, fontSize: '1.02rem', marginBottom: 4 }}>待审核队列</div>
              <div style={{ color: MUTED, fontSize: '0.82rem' }}>按类型切换处理，内容和证据优先显示，统计缩到右侧。</div>
            </div>

            <div className="admin-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 8, backgroundColor: 'rgba(255,255,255,0.72)', border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 8px 22px rgba(31,41,55,0.04)' }}>
              <button style={tabStyle(tab === 'allPending')} onClick={() => setTab('allPending')}>全部待审 {pendingReviewItems.length > 0 && `(${pendingReviewItems.length})`}</button>
              <button style={tabStyle(tab === 'accounts')} onClick={() => setTab('accounts')}>账号 ({accountProfiles.length})</button>
              <button style={tabStyle(tab === 'pending')} onClick={() => setTab('pending')}>创作者 {pendingProfiles.length > 0 && `(${pendingProfiles.length})`}</button>
              <button style={tabStyle(tab === 'requests')} onClick={() => setTab('requests')}>联系 {requests.length > 0 && `(${requests.length})`}</button>
              <button style={tabStyle(tab === 'wallet')} onClick={() => setTab('wallet')}>充值 {transactions.length > 0 && `(${transactions.length})`}</button>
              <button style={tabStyle(tab === 'commissions')} onClick={() => setTab('commissions')}>委托 {commissions.length > 0 && `(${commissions.length})`}</button>
              <button style={tabStyle(tab === 'carpools')} onClick={() => setTab('carpools')}>拼车 {carpools.length > 0 && `(${carpools.length})`}</button>
              <button style={tabStyle(tab === 'scriptContributions')} onClick={() => setTab('scriptContributions')}>剧本库 {scriptContributions.length > 0 && `(${scriptContributions.length})`}</button>
              <button style={tabStyle(tab === 'dmDossiers')} onClick={() => setTab('dmDossiers')}>档案审核 {dmDossiers.length > 0 && `(${dmDossiers.length})`}</button>
              <button style={tabStyle(tab === 'dmRatings')} onClick={() => setTab('dmRatings')}>DM评分 {dmRatings.length > 0 && `(${dmRatings.length})`}</button>
              <button style={tabStyle(tab === 'storeRatings')} onClick={() => setTab('storeRatings')}>店家评分 {storeRatings.length > 0 && `(${storeRatings.length})`}</button>
              <button style={tabStyle(tab === 'reports')} onClick={() => setTab('reports')}>举报 {reports.length > 0 && `(${reports.length})`}</button>
              <button style={tabStyle(tab === 'messages')} onClick={() => setTab('messages')}>站内信 {siteMessages.length > 0 && `(${siteMessages.length})`}</button>
              <button style={tabStyle(tab === 'security')} onClick={() => setTab('security')}>安全日志</button>
              <button style={tabStyle(tab === 'rankings')} onClick={() => setTab('rankings')}>榜单 {rankings.length > 0 && `(${rankings.length})`}</button>
              <button style={tabStyle(tab === 'publishedRankings')} onClick={() => setTab('publishedRankings')}>已发布 ({approvedRankings.length})</button>
              <button style={tabStyle(tab === 'publicReviews')} onClick={() => setTab('publicReviews')}>公开内容 {publicReviews.length > 0 && `(${publicReviews.length})`}</button>
              <button style={tabStyle(tab === 'guides')} onClick={() => setTab('guides')}>攻略 {guides.length > 0 && `(${guides.length})`}</button>
              <button style={tabStyle(tab === 'guideWithdrawals')} onClick={() => setTab('guideWithdrawals')}>提现 {guideWithdrawals.length > 0 && `(${guideWithdrawals.length})`}</button>
              <button style={tabStyle(tab === 'comments')} onClick={() => setTab('comments')}>评论 {comments.length > 0 && `(${comments.length})`}</button>
              <button style={tabStyle(tab === 'claims')} onClick={() => setTab('claims')}>相关方 {claims.length > 0 && `(${claims.length})`}</button>
              <button style={tabStyle(tab === 'certs')} onClick={() => setTab('certs')}>认证审核 {certs.length > 0 && `(${certs.length})`}</button>
            </div>

            {error && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: 0 }}>{error}</p>}

            {loading ? (
              <div style={{ ...card, textAlign: 'center', padding: '72px 0' }}>
                <div style={{ width: 36, height: 36, border: '2px solid rgba(201,146,46,0.3)', borderTopColor: GOLD, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ color: MUTED }}>加载中...</p>
              </div>
            ) : (
              <>
            {tab === 'allPending' && (
              <ListEmpty empty={pendingReviewItems.length === 0} text="没有待审核内容">
                {pendingReviewItems.map(item => (
                  <Row key={item.id} accent={item.accent}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={item.title} pill={item.category} />
                      <Meta>
                        {item.meta}
                        {item.createdAt ? ` · ${item.createdAt.slice(0, 10)}` : ''}
                      </Meta>
                      {item.tags && item.tags.length > 0 && (
                        <TagCloud tags={item.tags} />
                      )}
                    </div>
                    <Actions vertical>
                      <ActionButton onClick={() => setTab(item.tab)}>去处理</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'pending' && (
              <ListEmpty empty={pendingProfiles.length === 0} text="没有待审核的创作者">
                {pendingProfiles.map(p => (
                  <Row key={p.id}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>{profileNickname(p)}</div>
                      <div style={{ fontSize: '0.78rem', color: MUTED }}>{profileAccountSummary(p)} · 注册于 {p.created_at?.slice(0, 10)}{p.role_type && ` · ${p.role_type}`}</div>
                      {p.avatar && <AdminAttachmentLinks files={[{ name: '公开头像', url: p.avatar, type: 'image/*' }]} />}
                    </div>
                    <Actions>
                      <ActionButton kind="ok" onClick={() => approveProfile(p.id)}>通过</ActionButton>
                      <ActionButton kind="bad" onClick={() => openRejectModal(p.id, 'profile')}>拒绝</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'accounts' && (
              <ListEmpty empty={accountProfiles.length === 0} text="暂无可管理账号">
                {accountProfiles.map(p => (
                  <Row key={p.id}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{profileAccountSummary(p)}</span>
                        {p.is_realname && <span style={{ fontSize: '0.72rem', color: GOLD }}>⭐ 实名</span>}
                        {!p.is_visible && !p.reject_reason && <span style={{ fontSize: '0.72rem', color: '#925f18' }}>待审</span>}
                        {p.reject_reason && <span style={{ fontSize: '0.72rem', color: '#b91c1c' }}>已驳回</span>}
                        {p.is_banned && <span style={{ fontSize: '0.72rem', color: '#b91c1c' }}>已限制</span>}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: MUTED }}>
                        昵称：{profileNickname(p)} · 注册于 {p.created_at?.slice(0, 10)}
                        {profileAuthProviderLabel(p.auth_provider) && ` · ${profileAuthProviderLabel(p.auth_provider)}`}
                        {p.banned_at ? ` · 限制于 ${p.banned_at.slice(0, 10)}` : ''}
                      </div>
                      {p.reject_reason && <Proof>驳回原因：{p.reject_reason}</Proof>}
                      {p.ban_reason && <Proof>限制原因：{p.ban_reason}</Proof>}
                    </div>
                    <Actions>
                      <Link to={`/explore/${p.id}`} target="_blank" style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(217,168,87,0.30)', background: '#fff8e8', color: '#8a5a19', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 700 }}>主页</Link>
                      <ActionButton onClick={() => toggleRealname(p.id, !p.is_realname)}>{p.is_realname ? '取消实名' : '设为实名'}</ActionButton>
                      {p.is_banned
                        ? <ActionButton kind="ok" onClick={() => unbanProfile(p.id)}>解除限制</ActionButton>
                        : <ActionButton kind="bad" onClick={() => banProfile(p.id)}>限制账号</ActionButton>}
                      <ActionButton kind="bad" onClick={() => hideProfile(p.id)}>下线</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'requests' && (
              <ListEmpty empty={requests.length === 0} text="暂无待审核的联系申请">
                {requests.map(r => (
                  <Row key={r.id}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6 }}>{r.requester_name}</div>
                      <Meta>微信: {r.requester_wechat} · 发给: {r.lc_profiles?.display_name || '未知创作者'} · {r.created_at?.slice(0, 10)}</Meta>
                      {r.requester_message && <ContentBox>{r.requester_message}</ContentBox>}
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => approveReq(r.id)}>通过</ActionButton>
                      <ActionButton kind="bad" onClick={() => rejectReq(r.id)}>拒绝</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'wallet' && (
              <>
                {transactionMsg && (
                  <div style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    backgroundColor: transactionMsg.ok ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                    border: `1px solid ${transactionMsg.ok ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
                    color: transactionMsg.ok ? '#34d399' : '#f87171',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: 12,
                  }}>
                    {transactionMsg.text}
                  </div>
                )}
                <ListEmpty empty={transactions.length === 0} text="暂无待审核充值">
                {transactions.map(tx => (
                  <Row key={tx.id} accent="#22c55e">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={`充值 ${tx.amount} 契约币`} pill="钱包充值" />
                      <Meta>
                        用户：{tx.lc_profiles?.display_name || '未知用户'}
                        {tx.lc_profiles?.phone ? ` · ${tx.lc_profiles.phone}` : ''}
                        {tx.created_at ? ` · ${tx.created_at.slice(0, 10)}` : ''}
                      </Meta>
                      {tx.payment_proof && <AdminLinkedValue label="支付凭证" value={tx.payment_proof} />}
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" disabled={transactionLoading} onClick={() => approveTransaction(tx.id)}>到账</ActionButton>
                      <ActionButton kind="bad" onClick={() => openRejectModal(tx.id, 'transaction')}>拒绝</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
              </>
            )}

            {tab === 'rankings' && (
              <ListEmpty empty={rankings.length === 0} text="暂无待审核的红黑榜帖子">
                {rankings.map(r => {
                  const linkedDossier = [...dossierOptions, ...dmDossiers].find(item => item.id === r.subject_dossier_id);
                  const linkedDossierPending = !!r.subject_dossier_id && !dossierOptions.some(item => item.id === r.subject_dossier_id);
                  const suggestedEmployer = dossierOptions.find(item => item.id === r.dm_employer_store_id_suggestion);
                  return (
                  <Row key={r.id} accent={r.type === 'red' ? '#dc2626' : r.type === 'black' ? '#475569' : '#d9a857'}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={r.subject_name} pill={r.type === 'red' ? '🏅 红榜' : r.type === 'black' ? '👎 黑榜' : '✨ 白榜'} />
                      <Meta>{SUBJECT_LABEL[r.subject_type] || r.subject_type} · {r.subject_city || '未知'} · 作者：{r.author_name} · {r.type === 'white' && r.initial_amount === 0 ? '免费发布' : `初始：${r.initial_amount} 契约币`} · {r.created_at?.slice(0, 10)}</Meta>
                      {r.subject_url && <Meta>链接：{r.subject_url}</Meta>}
                      {['dm', 'store'].includes(r.subject_type) && (
                        <Proof>
                          关联档案：{linkedDossier ? `${linkedDossier.dm_name} · ${linkedDossier.city || '未知城市'}` : r.subject_dossier_id ? '待审新档案' : '旧记录尚未绑定档案'}
                          {linkedDossierPending ? <div style={{ marginTop: 4, color: '#b45309' }}>请先在“档案审核”中创建或合并该对象，再通过帖子。</div> : null}
                        </Proof>
                      )}
                      {r.dm_employment_status_suggestion && (
                        <Proof>
                          DM店家关系建议：{r.dm_employment_status_suggestion === 'freelance'
                            ? '无受雇店家（自由DM）'
                            : `绑定店家 ${suggestedEmployer?.dm_name || '所选店家待核对'}`}
                          <div style={{ marginTop: 4, color: MUTED }}>红黑榜通过后同步更新DM档案。</div>
                        </Proof>
                      )}
                      {(r.event_date || r.event_script_name || r.event_store_name) && <Meta>事件背景：{[r.event_date, r.event_script_name, r.event_store_name].filter(Boolean).join(' · ')}</Meta>}
                      <ModerationPrecheckBadge value={r.moderation_precheck} />
                      <ContentBox>{r.content}</ContentBox>
                      <AdminAttachmentLinks files={r.files || []} emptyText="未提交证据图片" />
                      {r.payment_proof && <AdminLinkedValue label="旧支付凭证" value={r.payment_proof} />}
                    </div>
                    <Actions vertical>
                      <ActionButton onClick={() => openRankingEdit(r)}>编辑</ActionButton>
                      <ActionButton kind="ok" disabled={linkedDossierPending} onClick={() => approveRanking(r.id)}>按{rankingTypeLabel(r.type)}通过</ActionButton>
                      {(['red', 'black', 'white'] as const).filter(type => type !== r.type).map(type => (
                        <ActionButton key={type} disabled={linkedDossierPending} onClick={() => approveRanking(r.id, type)}>改成{rankingTypeLabel(type)}并通过</ActionButton>
                      ))}
                      <ActionButton kind="bad" onClick={() => openRejectModal(r.id, 'ranking', 'content')}>打回修改</ActionButton>
                      <ActionButton kind="bad" onClick={() => openRejectModal(r.id, 'ranking', 'evidence')}>要求补证据</ActionButton>
                    </Actions>
                  </Row>
                  );
                })}
              </ListEmpty>
            )}

            {tab === 'publishedRankings' && (
              <ListEmpty empty={approvedRankings.length === 0} text="暂无已发布榜单">
                {approvedRankings.map(r => (
                  <Row key={r.id} accent={r.type === 'red' ? '#dc2626' : r.type === 'black' ? '#475569' : '#d9a857'}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={r.subject_name} pill={r.type === 'red' ? '🏅 红榜' : r.type === 'black' ? '👎 黑榜' : '✨ 白榜'} />
                      <Meta>
                        {SUBJECT_LABEL[r.subject_type] || r.subject_type} · {r.subject_city || '未知'}
                        {` · 作者：${r.author_name}`}
                        {` · 👍 ${r.likes ?? r.initial_amount}${r.initial_amount > 0 ? `（含初始 ${r.initial_amount}）` : ''}`}
                        {` · 👎 ${r.dislikes ?? 0}`}
                        {r.joys ? ` · 😂 ${r.joys}` : ''}
                        {r.created_at ? ` · ${r.created_at.slice(0, 10)}` : ''}
                      </Meta>
                      {r.subject_url && <Meta>链接：{r.subject_url}</Meta>}
                      <ContentBox>{r.content}</ContentBox>
                    </div>
                    <Actions vertical>
                      <ActionButton onClick={() => openRankingEdit(r)}>编辑并留痕</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'publicReviews' && (
              <ListEmpty empty={publicReviews.length === 0} text="暂无待审核公开内容">
                {publicReviews.map(item => {
                  const details = summarizePublicReviewPayload(item.payload);
                  const proofFiles = publicReviewProofFiles(item);
                  return (
                    <Row key={item.id} accent="#facc15">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <TitleLine title={item.title || publicReviewTypeLabel(item.target_type)} pill={publicReviewTypeLabel(item.target_type)} />
                        <Meta>
                          提交人：{item.profile_name || item.profile_id || '未知用户'}
                          {item.created_at ? ` · ${item.created_at.slice(0, 10)}` : ''}
                        </Meta>
                        {item.summary && <Meta>{item.summary}</Meta>}
                        <ModerationPrecheckBadge value={item.moderation_precheck} />
                        <TagCloud tags={publicReviewTags(item)} />
                        {details.length > 0 && (
                          <Proof>
                            {details.map(line => <div key={line}>{line}</div>)}
                          </Proof>
                        )}
                        <AdminAttachmentLinks files={proofFiles} />
                      </div>
                      <Actions vertical>
                        <ActionButton kind="ok" onClick={() => approvePublicReview(item.id)}>通过并公开</ActionButton>
                        <ActionButton kind="bad" onClick={() => openRejectModal(item.id, 'publicReview')}>拒绝</ActionButton>
                      </Actions>
                    </Row>
                  );
                })}
              </ListEmpty>
            )}

            {tab === 'guides' && (
              <ListEmpty empty={guides.length === 0} text="暂无待审核攻略">
                {guides.map(item => (
                  <Row key={item.id} accent="#fb7185">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={item.title} pill="攻略审核" />
                      <Meta>
                        作者：{item.author_name || '未知用户'}
                        {` · ${item.price || 0} 契约币`}
                        {item.target_name ? ` · 对象：${item.target_name}` : ''}
                        {item.created_at ? ` · ${item.created_at.slice(0, 10)}` : ''}
                      </Meta>
                      <Meta>类型：{item.guide_type} · 剧透等级：{item.spoiler_level}</Meta>
                      <ModerationPrecheckBadge value={item.moderation_precheck} />
                      <Proof>摘要：{item.summary}</Proof>
                      <ContentBox>{item.content}</ContentBox>
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => approveGuide(item.id)}>通过上架</ActionButton>
                      <ActionButton kind="bad" onClick={() => openRejectModal(item.id, 'guide')}>拒绝</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'guideWithdrawals' && (
              <ListEmpty empty={guideWithdrawals.length === 0} text="暂无待处理攻略提现">
                {guideWithdrawals.map(item => (
                  <Row key={item.id} accent="#34d399">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={`提现 ${item.amount}`} pill="创作者收入提现" />
                      <Meta>
                        创作者：{item.creator_id}
                        {item.created_at ? ` · ${item.created_at.slice(0, 10)}` : ''}
                      </Meta>
                      <Proof>
                        收款方式：{item.account_type}；收款人：{item.account_name}；账号：{item.account_identifier}
                      </Proof>
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => approveGuideWithdrawal(item.id)}>确认已打款</ActionButton>
                      <ActionButton kind="bad" onClick={() => openRejectModal(item.id, 'guideWithdrawal')}>拒绝</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'commissions' && (
              <ListEmpty empty={commissions.length === 0} text="暂无待审核委托需求">
                {commissions.map(c => (
                  <Row key={c.id} accent="#fbbf24">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={c.title} pill="委托需求" />
                      <Meta>
                        发布人：{c.poster_is_realname ? `⭐ ${c.poster_name}` : c.poster_name}
                        {c.needed_date ? ` · 日期：${c.needed_date}` : ''}
                        {c.city ? ` · 城市：${c.city}` : ''}
                        {c.location ? ` · ${c.location}` : ''}
                        {c.created_at ? ` · ${c.created_at.slice(0, 10)}` : ''}
                      </Meta>
                      {(c.desired_role || c.target_type || c.budget || c.contact_note) && (
                        <Meta>
                          {c.target_type ? `类型：${c.target_type} ` : ''}
                          {c.desired_role ? `角色：${c.desired_role} ` : ''}
                          {c.budget ? `预算：${c.budget} ` : ''}
                          {c.contact_note ? `联系：${c.contact_note}` : ''}
                        </Meta>
                      )}
                      <ModerationPrecheckBadge value={c.moderation_precheck} />
                      <ContentBox>{c.content}</ContentBox>
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => approveCommission(c.id)}>通过</ActionButton>
                      <ActionButton kind="bad" onClick={() => openRejectModal(c.id, 'commission')}>拒绝</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'carpools' && (
              <ListEmpty empty={carpools.length === 0} text="暂无待审核拼车">
                {carpools.map(c => (
                  <Row key={c.id} accent="#14b8a6">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={c.title} pill="拼车区" />
                      <Meta>
                        发布人：{c.poster_is_realname ? `⭐ ${c.poster_name}` : c.poster_name}
                        {` · ${c.city} · ${c.event_date}${c.start_time ? ` ${c.start_time}` : ''}`}
                        {c.deadline_date ? ` · 截止：${c.deadline_date}${c.deadline_time ? ` ${c.deadline_time}` : ''}` : ''}
                        {c.created_at ? ` · ${c.created_at.slice(0, 10)}` : ''}
                      </Meta>
                      <Meta>
                        本名：{c.script_name}
                        {c.role_name ? ` · 角色：${c.role_name}` : ''}
                        {` · 缺口：${c.needed_count}`}
                        {` · ${formatCarpoolSubsidy(c)}`}
                        {c.boost_amount > 0 ? ` · 加权 ${c.boost_amount}` : ''}
                      </Meta>
                      {(c.store_name || c.leader_contact || c.contact_note) && (
                        <Meta>
                          {c.store_name ? `店家：${c.store_name}${c.store_address ? ` · ${c.store_address}` : ''} ` : ''}
                          {c.leader_contact ? `车头：${c.leader_contact} ` : ''}
                          {c.contact_note ? `补充：${c.contact_note}` : ''}
                        </Meta>
                      )}
                      <ModerationPrecheckBadge value={c.moderation_precheck} />
                      {c.role_note && <ContentBox>{c.role_note}</ContentBox>}
                      <ContentBox>{c.content}</ContentBox>
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => approveCarpool(c.id)}>通过并同步剧司辰</ActionButton>
                      <ActionButton kind="bad" onClick={() => openRejectModal(c.id, 'carpool')}>拒绝</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'scriptContributions' && (
              <ListEmpty empty={scriptContributions.length === 0} text="暂无待审核剧本库维护">
                {scriptContributions.map(item => {
                  const contributionRoles = item.player_roles || [];
                  const canReward = contributionRoles.length > 0 && contributionRoles.every(role => role.role_name?.trim() && role.gender);
                  return (
                    <Row key={item.id} accent="#f59e0b">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <TitleLine title={item.script_name || '未命名剧本'} pill="剧本库维护" />
                        <Meta>
                          提交人：{item.profile_name || item.profile_id || '未知用户'}
                          {` · 奖励：${item.reward_amount || 0} 契约币`}
                          {item.created_at ? ` · ${item.created_at.slice(0, 10)}` : ''}
                        </Meta>
                        <Meta>基础有效维护：剧本名 + 角色名 + 角色性别；作品资料和 tag 作为补充。</Meta>
                        {!canReward && <Meta>缺角色或角色性别，不能通过发币。</Meta>}
                        {item.note && <ContentBox>{item.note}</ContentBox>}
                        {formatCredits(item.credits_patch).length > 0 && (
                          <Proof>
                            {formatCredits(item.credits_patch).map(line => (
                              <div key={line}>{line}</div>
                            ))}
                          </Proof>
                        )}
                        <ModerationPrecheckBadge value={item.moderation_precheck} />
                        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                          {contributionRoles.map((role, index) => (
                            <div key={`${role.role_name || 'role'}-${index}`} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fffdf8' }}>
                              <Meta>
                                {role.role_name || `角色 ${index + 1}`}
                                {role.gender ? ` · ${role.gender}` : ' · 性别未定义'}
                                {role.tags && role.tags.length > 0 ? ` · ${role.tags.join(' / ')}` : ''}
                              </Meta>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Actions vertical>
                        <ActionButton kind="ok" disabled={!canReward} onClick={() => approveScriptContribution(item.id)}>通过并发币</ActionButton>
                        <ActionButton kind="bad" onClick={() => rejectScriptContribution(item.id)}>拒绝</ActionButton>
                      </Actions>
                    </Row>
                  );
                })}
              </ListEmpty>
            )}

            {tab === 'dmDossiers' && (
              <ListEmpty empty={dmDossiers.length === 0} text="暂无待审核档案或认领申请">
                {dmDossiers.map(item => {
                  const entityType = item.entity_type === 'store' ? 'store' : 'dm';
                  const entityLabel = entityType === 'store' ? '店家' : 'DM';
                  const profileHref = normalizeAdminUrl(item.profile_url);
                  return (
                  <Row key={item.id} accent={entityType === 'store' ? '#38bdf8' : '#f472b6'}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={item.dm_name} pill={item.status === 'pending' ? `${entityLabel}建档` : `${entityLabel}认领`} />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', columnGap: 20, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, marginTop: 12 }}>
                        <AdminDetail label="档案类型" value={entityLabel} />
                        <AdminDetail label="城市" value={item.city || '未填写'} />
                        <AdminDetail label={entityType === 'store' ? '地址 / 商圈' : '常驻店家 / 工作地点'} value={item.workplace || '未填写'} />
                        {entityType === 'dm' && <AdminDetail label="受雇状态" value={item.employment_status === 'freelance' ? '无受雇店家（自由DM）' : item.employment_status === 'store_affiliated' ? `已关联店家：${dossierOptions.find(store => store.id === item.employer_store_id)?.dm_name || item.workplace || '待核对'}` : item.workplace ? `旧档案文本：${item.workplace}` : '待核对'} />}
                        <AdminDetail label="提交人" value={item.submitted_by_name || '未知账号'} />
                        <AdminDetail label="提交时间" value={item.created_at ? item.created_at.slice(0, 19).replace('T', ' ') : '未知'} />
                        <AdminDetail label="个人主页">
                          {profileHref
                            ? <a href={profileHref} target="_blank" rel="noreferrer" style={{ color: '#275389', fontWeight: 900, textDecoration: 'none', overflowWrap: 'anywhere' }}>打开个人主页</a>
                            : <span>未提供</span>}
                        </AdminDetail>
                      </div>
                      {item.claim_status === 'pending' && (
                        <div style={{ marginTop: 14, padding: 12, borderRadius: 8, border: '1px solid rgba(217,168,87,0.24)', background: '#fff8e8' }}>
                          <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#8a5a19' }}>认领核验材料</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 8 }}>
                            <AdminDetail label="申请账号" value={profileAccountById(profiles, item.claim_submission?.claimant_id || item.claimed_by)} />
                            <AdminDetail label="证明类型" value={item.claim_submission ? DOSSIER_CLAIM_PROOF_LABEL[item.claim_submission.proof_type] : '旧版认领申请'} />
                            <AdminDetail label="申请时间" value={item.claim_submission?.created_at ? item.claim_submission.created_at.slice(0, 19).replace('T', ' ') : item.created_at?.slice(0, 19).replace('T', ' ') || '未知'} />
                          </div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 900, color: INK }}>关系说明</div>
                          <ContentBox>{item.claim_submission?.claim_note || item.claim_note || '未填写认领说明'}</ContentBox>
                          {item.claim_submission ? (
                            <AdminPrivateClaimProofs claimId={item.claim_submission.id} files={item.claim_submission.proof_files || []} />
                          ) : (
                            <Meta>这是升级前提交的认领申请，没有私密截图材料，请谨慎核验。</Meta>
                          )}
                        </div>
                      )}
                      <ModerationPrecheckBadge value={item.moderation_precheck} />
                      <AdminPhotoPreview url={item.photo_url} />
                      <AdminAttachmentLinks files={item.photo_files || []} />
                      <div style={{ marginTop: 14, fontSize: '0.82rem', fontWeight: 900, color: INK }}>补充说明</div>
                      {item.note ? <ContentBox>{item.note}</ContentBox> : <Meta>未填写补充说明</Meta>}
                      <div style={{ marginTop: 12, fontSize: '0.82rem', fontWeight: 900, color: INK }}>标签</div>
                      {item.tags && item.tags.length > 0 ? <TagCloud tags={item.tags} /> : <Meta>未填写标签</Meta>}
                      {item.status === 'pending' && (
                        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LINE}`, display: 'grid', gap: 8 }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 900, color: INK }}>相似{entityLabel}候选</div>
                          {(item.similar_candidates || []).length === 0 ? (
                            <Meta>库内未找到明显相似的名称、城市和位置组合。</Meta>
                          ) : (item.similar_candidates || []).map(candidate => (
                            <div key={candidate.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 10px', border: `1px solid ${LINE}`, borderRadius: 8, background: '#fffdf8' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 900 }}>{candidate.dm_name}</div>
                                <Meta>{candidate.city || '未知城市'}{candidate.workplace ? ` · ${candidate.workplace}` : ''} · 相似度 {Math.round(candidate.score)}%</Meta>
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {candidate.photo_url && <AdminAttachmentLinks files={[{ name: `${candidate.dm_name}照片`, url: candidate.photo_url, type: 'image/*' }]} compact />}
                                <ActionButton onClick={() => entityType === 'store' ? mergeStoreDossier(item.id, candidate) : mergeDmDossier(item.id, candidate)}>合并到此{entityLabel}</ActionButton>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => approveDmDossier(item.id)}>
                        {item.claim_status === 'pending' && item.status !== 'pending' ? '通过认领' : entityType === 'dm' ? '创建新DM' : '创建新店家'}
                      </ActionButton>
                      <ActionButton kind="bad" onClick={() => openRejectModal(item.id, 'dmDossier')}>拒绝</ActionButton>
                    </Actions>
                  </Row>
                  );
                })}
              </ListEmpty>
            )}

            {tab === 'dmRatings' && (
              <ListEmpty empty={dmRatings.length === 0} text="暂无待审核DM评分">
                {dmRatings.map(item => {
                  const abuse = item.anti_abuse || {};
                  const abuseLabels = Array.isArray(abuse.risk_labels) ? abuse.risk_labels.map(moderationRiskLabel) : [];
                  return (
                    <Row key={item.id} accent="#fb923c">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <TitleLine title={item.dm_dossier?.dm_name || '待关联DM'} pill={`${item.rating} 星`} />
                        <Meta>
                          玩家：{item.profile_name || item.profile_id}
                          {item.dm_dossier?.city ? ` · ${item.dm_dossier.city}` : ''}
                          {item.dm_dossier?.workplace ? ` · ${item.dm_dossier.workplace}` : ''}
                          {item.created_at ? ` · 提交于 ${item.created_at.slice(0, 19).replace('T', ' ')}` : ''}
                        </Meta>
                        <Proof>
                          剧本：{item.script_name} · 店家：{item.store_name} · 体验日期：{item.played_on} · 第{item.replay_number}刷
                        </Proof>
                        <ModerationPrecheckBadge value={item.moderation_precheck} />
                        {(typeof abuse.risk_score === 'number' || abuseLabels.length > 0) && (
                          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(194,65,12,0.26)', background: '#fff7ed', color: '#7c2d12', fontSize: '0.76rem', lineHeight: 1.6 }}>
                            <strong>反刷检查：风险 {abuse.risk_score || 0}</strong>
                            {abuseLabels.length > 0 ? ` · ${abuseLabels.join(' / ')}` : ''}
                            <div style={{ color: 'rgba(71,85,105,0.88)' }}>
                              账号近1小时 {abuse.account_hour_count || 0} 条 · 近24小时 {abuse.account_day_count || 0} 条 · 同IP近1小时 {abuse.ip_hour_count || 0} 条 · 重复文本 {abuse.duplicate_content_count || 0} 条
                            </div>
                          </div>
                        )}
                        <ContentBox>{item.content}</ContentBox>
                        {item.tags && item.tags.length > 0 && <Meta>标签：{item.tags.join(' / ')}</Meta>}
                        {item.dm_dossier?.status !== 'approved' && <Meta>这条评分关联的新DM尚未建档，请先在“档案审核”处理。</Meta>}
                      </div>
                      <Actions vertical>
                        <ActionButton kind="ok" disabled={item.dm_dossier?.status !== 'approved'} onClick={() => approveDmRating(item.id)}>通过评分</ActionButton>
                        <ActionButton kind="bad" onClick={() => openRejectModal(item.id, 'dmRating')}>拒绝</ActionButton>
                      </Actions>
                    </Row>
                  );
                })}
              </ListEmpty>
            )}

            {tab === 'storeRatings' && (
              <ListEmpty empty={storeRatings.length === 0} text="暂无待审核店家评分">
                {storeRatings.map(item => {
                  const abuse = item.anti_abuse || {};
                  const abuseLabels = Array.isArray(abuse.risk_labels) ? abuse.risk_labels.map(moderationRiskLabel) : [];
                  return (
                    <Row key={item.id} accent="#14b8a6">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <TitleLine title={item.store_dossier?.dm_name || '待关联店家'} pill={`${item.rating} 星`} />
                        <Meta>
                          玩家：{item.profile_name || item.profile_id}
                          {item.store_dossier?.city ? ` · ${item.store_dossier.city}` : ''}
                          {item.store_dossier?.workplace ? ` · ${item.store_dossier.workplace}` : ''}
                          {item.created_at ? ` · 提交于 ${item.created_at.slice(0, 19).replace('T', ' ')}` : ''}
                        </Meta>
                        <Proof>剧本：{item.script_name} · 到店日期：{item.visited_on}</Proof>
                        <ModerationPrecheckBadge value={item.moderation_precheck} />
                        {(typeof abuse.risk_score === 'number' || abuseLabels.length > 0) && (
                          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(15,118,110,0.26)', background: '#f0fdfa', color: '#115e59', fontSize: '0.76rem', lineHeight: 1.6 }}>
                            <strong>反刷检查：风险 {abuse.risk_score || 0}</strong>
                            {abuseLabels.length > 0 ? ` · ${abuseLabels.join(' / ')}` : ''}
                            <div style={{ color: 'rgba(71,85,105,0.88)' }}>
                              账号近1小时 {abuse.account_hour_count || 0} 条 · 近24小时 {abuse.account_day_count || 0} 条 · 同IP近1小时 {abuse.ip_hour_count || 0} 条 · 重复文本 {abuse.duplicate_content_count || 0} 条
                            </div>
                          </div>
                        )}
                        <ContentBox>{item.content}</ContentBox>
                        {item.tags && item.tags.length > 0 && <Meta>标签：{item.tags.join(' / ')}</Meta>}
                        {item.store_dossier?.status !== 'approved' && <Meta>这条评分关联的新店家尚未建档，请先在“档案审核”创建或合并。</Meta>}
                      </div>
                      <Actions vertical>
                        <ActionButton kind="ok" disabled={item.store_dossier?.status !== 'approved'} onClick={() => approveStoreRating(item.id)}>通过评分</ActionButton>
                        <ActionButton kind="bad" onClick={() => openRejectModal(item.id, 'storeRating')}>拒绝</ActionButton>
                      </Actions>
                    </Row>
                  );
                })}
              </ListEmpty>
            )}

            {tab === 'reports' && (
              <ListEmpty empty={reports.length === 0} text="暂无待处理举报">
                {reports.map(r => (
                  <Row key={r.id} accent="#f87171">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={r.target_title || r.target_id} pill={r.target_type === 'carpool' ? '拼车举报' : '举报'} />
                      <Meta>
                        举报人：{r.reporter_name}
                        {` · 原因：${r.reason}`}
                        {r.report_group_count && r.report_group_count > 1 ? ` · 同对象有效举报 ${r.report_group_count}` : ''}
                        {r.created_at ? ` · ${r.created_at.slice(0, 10)}` : ''}
                      </Meta>
                      {(r.auto_action === 'temporary_hidden' || r.auto_action === 'queued_priority') && (
                        <Proof>
                          {r.auto_action === 'temporary_hidden' ? '已临时折叠，等待复核' : '已进入优先复核'}
                          {r.risk_level ? ` · 风险级别：${r.risk_level}` : ''}
                          {r.auto_action_reason ? <div style={{ marginTop: 6, lineHeight: 1.7 }}>{r.auto_action_reason}</div> : null}
                        </Proof>
                      )}
                      {r.reviewer_summary && Number(r.reviewer_summary.total || 0) > 0 && (
                        <Meta>
                          社区观察员建议：共 {r.reviewer_summary.total} 条
                          {typeof r.reviewer_summary.hide_votes === 'number' ? ` · 建议隐藏 ${r.reviewer_summary.hide_votes}` : ''}
                          {typeof r.reviewer_summary.safe_votes === 'number' ? ` · 建议保留 ${r.reviewer_summary.safe_votes}` : ''}
                        </Meta>
                      )}
                      <ModerationPrecheckBadge value={r.moderation_precheck} />
                      {r.description && <ContentBox>{r.description}</ContentBox>}
                      {r.target_snapshot && (
                        <Proof>
                          {typeof r.target_snapshot.city === 'string' ? `城市：${r.target_snapshot.city} ` : ''}
                          {typeof r.target_snapshot.event_date === 'string' ? `日期：${r.target_snapshot.event_date} ` : ''}
                          {typeof r.target_snapshot.script_name === 'string' ? `本名：${r.target_snapshot.script_name} ` : ''}
                          {typeof r.target_snapshot.poster_name === 'string' ? `发布者：${r.target_snapshot.poster_name}` : ''}
                          {typeof r.target_snapshot.content_preview === 'string' && (
                            <div style={{ marginTop: 6, lineHeight: 1.7 }}>内容摘录：{r.target_snapshot.content_preview}</div>
                          )}
                        </Proof>
                      )}
                    </div>
                    <Actions vertical>
                      {r.auto_action === 'temporary_hidden' && (
                        <ActionButton kind="ok" onClick={() => resolveReport(r.id, 'resolved', false, true)}>复核恢复展示</ActionButton>
                      )}
                      <ActionButton kind="bad" onClick={() => resolveReport(r.id, 'resolved', true)}>下架并处理</ActionButton>
                      <ActionButton kind="ok" onClick={() => resolveReport(r.id, 'resolved')}>标记已处理</ActionButton>
                      <ActionButton onClick={() => resolveReport(r.id, 'dismissed')}>暂不处理</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'messages' && (
              <ListEmpty empty={siteMessages.length === 0} text="暂无待处理站内信">
                {siteMessages.map(m => (
                  <Row key={m.id} accent="#38bdf8">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={m.subject} pill={siteMessageCategoryLabel(m.category)} />
                      <Meta>
                        发送人：{m.sender_name}
                        {m.contact ? ` · 联系方式：${m.contact}` : ''}
                        {m.created_at ? ` · ${m.created_at.slice(0, 19).replace('T', ' ')}` : ''}
                      </Meta>
                      <ModerationPrecheckBadge value={m.moderation_precheck} />
                      <ContentBox>{m.content}</ContentBox>
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => resolveSiteMessage(m.id)}>标记已处理</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'security' && (
              <ListEmpty empty={securityEvents.length === 0} text="暂无安全日志">
                {securityEvents.map(event => (
                  <Row key={event.id} accent="#fb923c">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={event.action} pill={event.actor_role || 'unknown'} />
                      <Meta>
                        {event.actor_id ? `操作者：${event.actor_id}` : '操作者：未登录'}
                        {event.target_type ? ` · 对象：${event.target_type}/${event.target_id || '-'}` : ''}
                        {event.ip_address ? ` · IP：${event.ip_address}` : ''}
                        {event.created_at ? ` · ${event.created_at.slice(0, 19).replace('T', ' ')}` : ''}
                      </Meta>
                      {event.request_path && <Meta>路径：{event.request_path}</Meta>}
                      {event.user_agent && <Proof>UA：{event.user_agent.slice(0, 220)}</Proof>}
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <ContentBox>{JSON.stringify(event.metadata, null, 2)}</ContentBox>
                      )}
                    </div>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'comments' && (
              <ListEmpty empty={comments.length === 0} text="暂无待审核评论">
                {comments.map(c => {
                  const relatedProof = getRelatedProof(c);
                  const isRelatedProof = c.is_pinned && (relatedProof.note || relatedProof.files.length > 0);
                  return (
                    <Row key={c.id}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <TitleLine title={c.lc_rankings?.subject_name || '未知帖子'} pill={c.is_pinned ? (c.pin_label || '相关方回应') : (c.lc_rankings?.type === 'black' ? '👎 黑榜评论' : c.lc_rankings?.type === 'white' ? '✨ 白榜评论' : '🏅 红榜评论')} />
                        <Meta>作者：{c.is_realname ? `⭐ ${c.author_name}` : c.author_name} · {c.created_at?.slice(0, 10)}</Meta>
                        <ModerationPrecheckBadge value={c.moderation_precheck} />
                        <ContentBox>{c.content}</ContentBox>
                        {isRelatedProof && (
                          <Proof>
                            <strong style={{ color: GOLD }}>相关方认证资料</strong>
                            {relatedProof.note && <div style={{ marginTop: 6, lineHeight: 1.7 }}>说明：{relatedProof.note}</div>}
                            {relatedProof.files.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                                {relatedProof.files.map((f, i) => (
                                  <a key={i} href={f.url} target="_blank" rel="noreferrer"
                                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(201,146,46,0.18)', background: 'rgba(201,146,46,0.08)', color: GOLD, fontSize: '0.76rem', fontWeight: 700, textDecoration: 'none' }}>
                                    🖼 {f.name || `图片 ${i + 1}`}
                                  </a>
                                ))}
                              </div>
                            )}
                          </Proof>
                        )}
                        {c.payment_proof && !isRelatedProof && <AdminLinkedValue label="旧评论凭证" value={c.payment_proof} />}
                      </div>
                      <Actions vertical>
                        <ActionButton kind="ok" onClick={() => approveComment(c.id)}>通过</ActionButton>
                        <ActionButton kind="bad" onClick={() => openRejectModal(c.id, 'comment')}>{c.is_pinned ? '拒绝置顶' : '拒绝'}</ActionButton>
                      </Actions>
                    </Row>
                  );
                })}
              </ListEmpty>
            )}

            {tab === 'claims' && (
              <ListEmpty empty={claims.length === 0} text="暂无相关方申请">
                {claims.map(c => (
                  <Row key={c.id}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={c.lc_rankings?.subject_name || '未知帖子'} pill="相关方申请" />
                      <Meta>申请人：{c.claimant_name || '未知用户'} · 联系方式：{c.contact} · {c.created_at?.slice(0, 10)}</Meta>
                      {c.message && <ContentBox>{c.message}</ContentBox>}
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => approveClaim(c.id)}>标记已处理</ActionButton>
                      <ActionButton kind="bad" onClick={() => openRejectModal(c.id, 'claim')}>拒绝</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'certs' && (
              <ListEmpty empty={certs.length === 0} text="暂无待审核认证">
                {certs.map(c => (
                  <Row key={c.id} accent="#3b82f6">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine
                        title={c.lc_profiles?.display_name || '未知用户'}
                        pill={certificationTypeLabel(c.type)}
                      />
                      <Meta>
                        用户：{c.lc_profiles?.display_name || '未知用户'}
                        {c.lc_profiles?.phone ? ` · ${c.lc_profiles.phone}` : ''}
                        {c.created_at ? ` · ${c.created_at.slice(0, 10)}` : ''}
                      </Meta>
                      {c.description && <ContentBox>{c.description}</ContentBox>}
                      {c.type === 'realname' && <Meta>身份证材料应已带“仅用于剧幕录实名认证”水印；审核通过后只给前台实名标识，不公开证件。</Meta>}
                      {c.files && c.files.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                          {c.files.map((f, i) => (
                            <a key={i} href={f.url} target="_blank" rel="noreferrer"
                              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.08)', color: '#3b82f6', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
                              📎 {f.name || `附件 ${i + 1}`}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => approveCert(c.id)}>通过</ActionButton>
                      <ActionButton kind="bad" onClick={() => openRejectModal(c.id, 'cert')}>拒绝</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}
              </>
            )}
          </section>

          <aside className="admin-stats" style={{ position: 'sticky', top: 18, display: 'grid', gap: 14 }}>
            <div style={{ ...card, padding: '16px 18px' }}>
              <div style={{ fontWeight: 900, fontSize: '1rem', marginBottom: 4 }}>数据概览</div>
              <div style={{ color: MUTED, fontSize: '0.8rem', lineHeight: 1.7 }}>右侧只放辅助判断，左侧保留审核主动作。</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {statCards.map(({ label, value, color }) => (
                <div key={label} style={{ ...card, padding: '13px 14px', minHeight: 72 }}>
                  <div style={{ fontSize: '1.55rem', fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: '0.72rem', color: MUTED, marginTop: 8, lineHeight: 1.35 }}>{label}</div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      {rankingEdit && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(31,41,55,0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: SURFACE, border: '1px solid rgba(217,168,87,0.24)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 28px 80px rgba(31,41,55,0.22)' }}>
            <h3 style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 8, color: INK }}>编辑榜单记录</h3>
            <p style={{ fontSize: '0.8rem', color: MUTED, lineHeight: 1.7, marginBottom: 18 }}>
              保存后会写入防篡改审计链，前台审计记录会展示原版、编辑版和变更时间。
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: '0.76rem', color: MUTED, marginBottom: 6 }}>榜单类型</span>
                <select value={rankingEdit.form.type} onChange={e => updateRankingEditForm({ type: e.target.value as RankingEditForm['type'] })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${LINE}`, backgroundColor: SURFACE, color: INK, outline: 'none' }}>
                  <option value="red">红榜</option>
                  <option value="black">黑榜</option>
                  <option value="white">白榜</option>
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: '0.76rem', color: MUTED, marginBottom: 6 }}>对象分类</span>
                <select value={rankingEdit.form.subject_type} onChange={e => updateRankingEditForm({ subject_type: e.target.value, subject_dossier_id: '' })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${LINE}`, backgroundColor: SURFACE, color: INK, outline: 'none' }}>
                  {Object.entries(SUBJECT_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: '0.76rem', color: MUTED, marginBottom: 6 }}>所在城市</span>
                <input value={rankingEdit.form.subject_city} onChange={e => updateRankingEditForm({ subject_city: e.target.value })}
                  placeholder="例：上海"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${LINE}`, backgroundColor: SURFACE, color: INK, outline: 'none' }} />
              </label>
            </div>

            {['dm', 'store'].includes(rankingEdit.form.subject_type) && (
              <label style={{ display: 'block', marginBottom: 12 }}>
                <span style={{ display: 'block', fontSize: '0.76rem', color: MUTED, marginBottom: 6 }}>关联已有{rankingEdit.form.subject_type === 'dm' ? 'DM' : '店家'}档案</span>
                <select value={rankingEdit.form.subject_dossier_id} onChange={e => {
                  const id = e.target.value;
                  const dossier = dossierOptions.find(item => item.id === id);
                  updateRankingEditForm({
                    subject_dossier_id: id,
                    ...(dossier ? { subject_name: dossier.dm_name, subject_city: dossier.city || rankingEdit.form.subject_city } : {}),
                  });
                }} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${LINE}`, backgroundColor: SURFACE, color: INK, outline: 'none' }}>
                  <option value="">暂不绑定（仅兼容旧记录）</option>
                  {dossierOptions.filter(item => item.entity_type === rankingEdit.form.subject_type).map(item => (
                    <option key={item.id} value={item.id}>{item.dm_name} · {item.city || '未知城市'}{item.workplace ? ` · ${item.workplace}` : ''}</option>
                  ))}
                </select>
              </label>
            )}

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: '0.76rem', color: MUTED, marginBottom: 6 }}>对象名称</span>
              <input value={rankingEdit.form.subject_name} onChange={e => updateRankingEditForm({ subject_name: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${LINE}`, backgroundColor: SURFACE, color: INK, outline: 'none' }} />
            </label>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: '0.76rem', color: MUTED, marginBottom: 6 }}>社交主页链接</span>
              <input value={rankingEdit.form.subject_url} onChange={e => updateRankingEditForm({ subject_url: e.target.value })}
                placeholder="可留空"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${LINE}`, backgroundColor: SURFACE, color: INK, outline: 'none' }} />
            </label>

            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: '0.76rem', color: MUTED, marginBottom: 6 }}>正文内容</span>
              <textarea value={rankingEdit.form.content} onChange={e => updateRankingEditForm({ content: e.target.value })}
                rows={8}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px 12px', borderRadius: 10, border: `1px solid ${LINE}`, backgroundColor: SURFACE, color: INK, outline: 'none', lineHeight: 1.7 }} />
            </label>

            {rankingEdit.error && <p style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: 12 }}>{rankingEdit.error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setRankingEdit(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${LINE}`, background: SURFACE, color: MUTED, cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
                取消
              </button>
              <button onClick={saveRankingEdit} disabled={rankingEdit.saving}
                style={{ flex: 1.4, padding: '10px', borderRadius: 10, border: 'none', background: INK, color: BG, cursor: rankingEdit.saving ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '0.875rem', opacity: rankingEdit.saving ? 0.6 : 1 }}>
                {rankingEdit.saving ? '保存中...' : '保存并留痕'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(31,41,55,0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: SURFACE, border: '1px solid rgba(217,168,87,0.24)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 28px 80px rgba(31,41,55,0.22)' }}>
            <h3 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 8, color: INK }}>{rejectModal.type === 'ranking' ? (rejectModal.revisionKind === 'evidence' ? '要求补证据' : '打回修改原因') : '填写拒绝原因'}</h3>
            <p style={{ fontSize: '0.8rem', color: MUTED, marginBottom: 16 }}>
              {rejectModal.type === 'ranking'
                ? rejectModal.revisionKind === 'evidence'
                  ? '用户重新提交时必须至少上传一张证据图片；原帖和已扣契约币都会保留。'
                  : '用户可以修改原帖后重新提交，证据仍然选填；不会重复扣除契约币。'
                : '原因可不填，主要给自己留审核记录。'}
            </p>
            <textarea value={rejectModal.reason} onChange={e => setRejectModal({ ...rejectModal, reason: e.target.value })}
              placeholder={rejectModal.type === 'ranking' ? (rejectModal.revisionKind === 'evidence' ? '例如：请补充聊天记录或订单截图，并打码第三方信息。' : '例如：请删去人身攻击，补清楚事件经过。') : '请说明拒绝原因（选填）...'} rows={4}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${LINE}`, backgroundColor: SURFACE, color: INK, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'none', outline: 'none' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setRejectModal({ open: false, id: '', reason: '', type: 'profile', revisionKind: 'content' })}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${LINE}`, background: SURFACE, color: MUTED, cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
                取消
              </button>
              <button onClick={confirmReject}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(185,28,28,0.20)', background: '#fef2f2', color: '#b91c1c', cursor: 'pointer', fontWeight: 800, fontSize: '0.875rem' }}>
                {rejectModal.type === 'ranking' ? (rejectModal.revisionKind === 'evidence' ? '确认要求补证据' : '确认打回修改') : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 980px) {
          .admin-main-grid {
            grid-template-columns: 1fr !important;
          }
          .admin-stats {
            position: static !important;
          }
        }
        @media (max-width: 720px) {
          .admin-header-inner {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .admin-page-body {
            padding: 20px !important;
          }
          .admin-tabs {
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
          }
          .admin-row {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .admin-actions {
            flex-direction: row !important;
            flex-wrap: wrap !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}

function Row({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="admin-row" style={{ ...card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, borderLeft: accent ? `3px solid ${accent}` : card.border }}>
      {children}
    </div>
  );
}

function Actions({ children, vertical }: { children: React.ReactNode; vertical?: boolean }) {
  return <div className="admin-actions" style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: 8, flexShrink: 0 }}>{children}</div>;
}

function ActionButton({ children, onClick, kind, disabled }: { children: React.ReactNode; onClick: () => void; kind?: 'ok' | 'bad'; disabled?: boolean }) {
  const ok = kind === 'ok';
  const bad = kind === 'bad';
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${ok ? 'rgba(22,101,52,0.22)' : bad ? 'rgba(185,28,28,0.20)' : 'rgba(217,168,87,0.30)'}`, cursor: disabled ? 'not-allowed' : 'pointer', background: ok ? 'rgba(240,253,244,0.95)' : bad ? 'rgba(254,242,242,0.95)' : '#fff8e8', color: ok ? '#166534' : bad ? '#b91c1c' : '#8a5a19', fontWeight: 700, fontSize: '0.82rem', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap' }}>
      {children}
    </button>
  );
}

function AdminDetail({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0, padding: '10px 0' }}>
      <div style={{ color: MUTED, fontSize: '0.72rem', fontWeight: 800, marginBottom: 4 }}>{label}</div>
      <div style={{ color: INK, fontSize: '0.9rem', fontWeight: 850, lineHeight: 1.55, overflowWrap: 'anywhere' }}>{children || value || '未填写'}</div>
    </div>
  );
}

function AdminAttachmentLinks({ files, emptyText, compact = false }: { files: ProofFile[]; emptyText?: string; compact?: boolean }) {
  const valid = (files || []).map((file, index) => ({
    ...file,
    index,
    href: normalizeAdminUrl(file.url, true),
  })).filter(file => file.href);
  if (valid.length === 0) return emptyText ? <Meta>{emptyText}</Meta> : null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: compact ? 0 : 10 }}>
      {valid.map(file => {
        const isImage = (file.type || '').startsWith('image/') || /\.(png|jpe?g|webp)(\?|$)/i.test(file.href || '') || (file.href || '').startsWith('/uploads/');
        return (
          <a key={`${file.href}-${file.index}`} href={file.href || '#'} target="_blank" rel="noreferrer"
            style={{ padding: '7px 11px', borderRadius: 8, border: '1px solid rgba(39,83,137,0.22)', background: '#eff6ff', color: '#275389', fontSize: '0.78rem', fontWeight: 850, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {isImage ? '查看图片' : '打开附件'}{valid.length > 1 ? ` ${file.index + 1}` : ''}
          </a>
        );
      })}
    </div>
  );
}

function AdminLinkedValue({ label, value }: { label: string; value: string }) {
  const href = normalizeAdminUrl(value, true);
  if (href) return (
    <Proof>
      <strong>{label}</strong>
      <AdminAttachmentLinks files={[{ name: label, url: href, type: 'image/*' }]} compact />
    </Proof>
  );
  return <Proof>{label}：{value}</Proof>;
}

function AdminPhotoPreview({ url }: { url?: string | null }) {
  const [failed, setFailed] = useState(false);
  const source = normalizeAdminUrl(url, true);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 900, color: INK, marginBottom: 8 }}>照片资料</div>
      {!source ? (
        <div style={{ color: MUTED, fontSize: '0.84rem', fontWeight: 750 }}>未提供照片</div>
      ) : failed ? (
        <div style={{ padding: '10px 12px', border: '1px solid rgba(185,28,28,0.18)', background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: '0.8rem', fontWeight: 800 }}>
          图片链接已失效或无法加载，请核对原地址。
          <a href={source} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: '#991b1b' }}>打开原地址</a>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <img src={source} alt="待审核档案照片" onError={() => setFailed(true)} style={{ width: 180, maxWidth: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fffdf8' }} />
          <a href={source} target="_blank" rel="noreferrer" style={{ color: '#275389', fontSize: '0.82rem', fontWeight: 900, textDecoration: 'none' }}>打开原图</a>
        </div>
      )}
    </div>
  );
}

function AdminPrivateClaimProofs({ claimId, files }: { claimId: string; files: DossierClaimProof[] }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 900, color: INK, marginBottom: 7 }}>私密身份凭证（仅管理员可见）</div>
      {files.length === 0 ? <Meta>没有可读取的凭证截图</Meta> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 180px))', gap: 9 }}>
          {files.map((file, index) => <AdminPrivateClaimProofImage key={file.id} claimId={claimId} file={file} index={index} />)}
        </div>
      )}
    </div>
  );
}

function AdminPrivateClaimProofImage({ claimId, file, index }: { claimId: string; file: DossierClaimProof; index: number }) {
  const [source, setSource] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    fetch(`${API}/lc/admin/dm-dossier-claims/${encodeURIComponent(claimId)}/proofs/${encodeURIComponent(file.id)}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error('凭证图片读取失败');
        return response.blob();
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(reason => {
        if (reason?.name !== 'AbortError') setLoadError(reason instanceof Error ? reason.message : '凭证图片读取失败');
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [claimId, file.id]);

  if (loadError) return <div style={{ minHeight: 96, padding: 9, border: '1px solid rgba(185,28,28,0.18)', borderRadius: 7, background: '#fff', color: '#991b1b', fontSize: 11 }}>{loadError}</div>;
  if (!source) return <div style={{ minHeight: 96, display: 'grid', placeItems: 'center', border: `1px solid ${LINE}`, borderRadius: 7, background: '#fff', color: MUTED, fontSize: 11 }}>读取中…</div>;
  return (
    <a href={source} target="_blank" rel="noreferrer" style={{ display: 'block', color: '#275389', textDecoration: 'none' }}>
      <img src={source} alt={`认领凭证 ${index + 1}`} style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 7, border: `1px solid ${LINE}`, background: '#fff' }} />
      <div style={{ overflow: 'hidden', marginTop: 4, fontSize: 10, fontWeight: 800, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name || `凭证 ${index + 1}`}</div>
    </a>
  );
}

function ListEmpty({ empty, text, children }: { empty: boolean; text: string; children: React.ReactNode }) {
  if (empty) return (
    <div style={{ ...card, textAlign: 'center', padding: '64px 0' }}>
      <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.45 }}>✓</div>
      <p style={{ color: MUTED, margin: 0 }}>{text}</p>
    </div>
  );
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>;
}

function TitleLine({ title, pill }: { title: string; pill: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 900, fontSize: '1.05rem', color: INK }}>{title}</span>
      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', background: '#fff8e8', color: '#8a5a19', border: '1px solid rgba(217,168,87,0.26)' }}>{pill}</span>
    </div>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.78rem', color: MUTED, marginBottom: 8, lineHeight: 1.55 }}>{children}</div>;
}

function ContentBox({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '10px 14px', backgroundColor: '#fffdf8', border: `1px solid ${LINE}`, borderRadius: 8, fontSize: '0.82rem', color: 'rgba(31,41,55,0.78)', lineHeight: 1.7, marginTop: 8 }}>{children}</div>;
}

function Proof({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: 8, padding: '8px 12px', backgroundColor: '#fff8e8', border: '1px solid rgba(217,168,87,0.24)', borderRadius: 8, fontSize: '0.78rem', color: '#8a5a19', lineHeight: 1.55 }}>{children}</div>;
}

function TagCloud({ tags }: { tags: string[] }) {
  const clean = Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean))).slice(0, 8);
  if (clean.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {clean.map(tag => (
        <span key={tag} style={{
          padding: '3px 8px',
          borderRadius: 999,
          border: '1px solid rgba(124,58,237,0.16)',
          background: 'rgba(245,243,255,0.82)',
          color: '#6d28d9',
          fontSize: '0.72rem',
          fontWeight: 800,
        }}>
          {tag}
        </span>
      ))}
    </div>
  );
}
