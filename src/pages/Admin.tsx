import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { isTokenExpired } from '../lib/authSession';
import { ADMIN_REVIEW_ACTIONS, moderationHistoryMetadataLines, summarizeProfileReviewPayload } from '../lib/adminReviewPresentation';
import {
  wechatSafetyMatchesFilter,
  wechatSafetyStatusPresentation,
  type WechatSafetyFilter,
} from '../lib/wechatSafetyPresentation';
import BrandLogo from '../components/BrandLogo';
import RankingEvidenceEditor from '../components/RankingEvidenceEditor';

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
  is_merged?: boolean;
  ban_reason?: string | null;
  banned_at?: string | null;
  merged_at?: string | null;
  restriction_scope?: 'publish' | 'account' | null;
  restriction_ends_at?: string | null;
  reject_reason?: string | null;
  role_type?: string;
  avatar?: string | null;
  bio?: string | null;
  tags?: string[];
  city?: string | null;
  social_links?: Record<string, string> | null;
  wechat?: string | null;
  available_cities?: string[];
  travel_status?: string | null;
  contact_unlock_enabled?: boolean;
  contact_intent_amount?: number;
  gender?: string | null;
  sexual_orientation?: string | null;
  preferred_story_lines?: string[];
  avatar_focus_x?: number;
  avatar_focus_y?: number;
};

type PrivateAccountDetails = {
  id: string;
  display_name?: string | null;
  phone?: string | null;
  email?: string | null;
  wechat?: string | null;
  wechat_nickname?: string | null;
  auth_provider?: string | null;
};

type PrivateAccountView = {
  profile: Profile;
  reason: string;
  loading: boolean;
  error: string;
  details: PrivateAccountDetails | null;
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

function securityActionLabel(action: string) {
  if (action === 'admin_profile_private_view') return '管理员查看账号隐私信息';
  return action;
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
  display_files?: ProofFile[];
  private_evidence_files?: DossierClaimProof[];
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

type RankingAuthorEditRequest = {
  id: string;
  ranking_id: string;
  author_id: string;
  request_kind: 'edit' | 'restore';
  before_snapshot: Record<string, unknown>;
  proposed_patch: Record<string, unknown>;
  changes: Array<{ field: string; label: string; before: unknown; after: unknown }>;
  change_metrics?: Record<string, number>;
  moderation_precheck?: ModerationPrecheck | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reject_reason?: string | null;
  created_at: string;
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
  status?: string | null;
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

type CommissionApplicationAudit = {
  id: string;
  commission_id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_is_realname?: boolean;
  letter: string;
  status: 'submitted' | 'accepted' | 'rejected';
  decided_at?: string | null;
  contact_unlocked_at?: string | null;
  created_at: string;
  commission?: {
    id: string;
    poster_id: string;
    poster_name: string;
    title: string;
    city?: string | null;
    needed_date?: string | null;
    status?: string;
  } | null;
};

type ProviderInquiryAudit = {
  id: string;
  provider_id: string;
  provider_name: string;
  requester_id: string;
  requester_name: string;
  message: string;
  status: 'submitted' | 'accepted' | 'rejected';
  decided_at?: string | null;
  contact_unlocked_at?: string | null;
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
  lc_profiles?: { display_name?: string };
};

type ServicePurchaseAudit = {
  id: string;
  profile_id: string;
  profile_name?: string | null;
  product_type: 'dossier_claim' | 'provider_listing' | 'provider_contact';
  target_id: string;
  target_name?: string | null;
  target_entity_type?: 'dm' | 'store' | null;
  amount_fen: number;
  currency: string;
  status: 'unpaid' | 'paid' | 'refunded';
  paid_at?: string | null;
  refunded_at?: string | null;
  refund_reason?: string | null;
  submission_status: 'not_submitted' | 'pending' | 'approved' | 'rejected' | 'access_granted';
  submission_id?: string | null;
  created_at: string;
  updated_at?: string | null;
};

type ProviderListingRecoveryModal = {
  purchaseId: string;
  profileName: string;
  posterUrl: string;
  posterUploadedAt: string;
  headline: string;
  description: string;
  heightCm: string;
  weightKg: string;
  roleTypesText: string;
  businessContact: string;
  contactAvailable: boolean;
  loading: boolean;
  saving: boolean;
  error: string;
  reviewId?: string | null;
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
  lc_profiles?: { display_name?: string };
};

type ReportReview = {
  id: string;
  target_type: string;
  target_id: string;
  target_sub_id?: string | null;
  target_title?: string | null;
  reporter_name: string;
  reason: string;
  description?: string | null;
  target_snapshot?: Record<string, unknown> | null;
  evidence_files?: DossierClaimProof[];
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

type WechatContentCheck = {
  id: string;
  profile_id?: string | null;
  profile_name?: string | null;
  check_type: 'text' | 'image';
  business_scene: string;
  target_type?: string | null;
  target_id?: string | null;
  status: 'pending' | 'pass' | 'review' | 'risky' | 'error';
  suggest?: string | null;
  label?: number | null;
  trace_id?: string | null;
  errcode?: number | null;
  error_message?: string | null;
  checked_at?: string | null;
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
  admin_reply?: string | null;
  evidence_urls?: string[];
  evidence_files?: DossierClaimProof[];
  payment_purchase_id?: string | null;
  moderation_precheck?: ModerationPrecheck | null;
  created_at: string;
  updated_at?: string;
};

type AccountAppeal = {
  id: string;
  profile_id: string;
  profile_name?: string | null;
  restriction_id: string;
  content: string;
  evidence_urls?: string[];
  status: 'pending' | 'needs_info' | 'approved' | 'rejected' | 'withdrawn';
  admin_reply?: string | null;
  created_at: string;
  updated_at?: string;
  restriction?: {
    id: string;
    scope: 'publish' | 'account';
    reason: string;
    starts_at?: string | null;
    ends_at?: string | null;
    status: string;
  } | null;
};

type PublicReview = {
  id: string;
  target_type: 'profile_update' | 'dossier_update' | 'provider_listing_update' | 'service_create' | 'portfolio_create' | 'availability_create' | 'tag_create' | 'script_rating_upsert' | 'entity_rating_upsert' | 'rating_discussion_create';
  profile_id?: string | null;
  profile_name?: string | null;
  title?: string | null;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  status: 'pending' | 'approved' | 'rejected';
  review_note?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  moderation_precheck?: ModerationPrecheck | null;
  created_at: string;
};

type DossierClaimProof = {
  id: string;
  name: string;
  type?: string;
  size?: number;
  width?: number;
  height?: number;
  url?: string;
  public_copy?: { url: string; published_at: string } | null;
};

type RankingEvidencePublishState = {
  rankingId: string;
  file: DossierClaimProof;
  sourceBlob: Blob | null;
  sourceLoading: boolean;
  processedFile: File | null;
  editActions: string[];
  processingNote: string;
  confirmed: boolean;
  saving: boolean;
  error: string;
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

type DmIdentityWithdrawalReview = {
  id: string;
  dm_dossier_id: string;
  profile_id?: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  dm_dossier?: {
    id: string;
    dm_name: string;
    city?: string | null;
    workplace?: string | null;
    claimed_by?: string | null;
    claim_status?: string;
  } | null;
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

type RejectType = 'profile' | 'ranking' | 'rankingEdit' | 'comment' | 'claim' | 'commission' | 'carpool' | 'transaction' | 'cert' | 'dmDossier' | 'dmRating' | 'storeRating' | 'publicReview' | 'guide' | 'guideWithdrawal';
type Tab = 'allPending' | 'siteData' | 'publishedDmDossiers' | 'publishedStoreDossiers' | 'pending' | 'accounts' | 'requests' | 'messages' | 'accountAppeals' | 'rankings' | 'rankingEdits' | 'publishedRankings' | 'publicReviews' | 'dmDossierEdits' | 'storeDossierEdits' | 'guides' | 'guideWithdrawals' | 'comments' | 'claims' | 'commissions' | 'commissionApplications' | 'carpools' | 'scriptContributions' | 'dmDossiers' | 'storeDossiers' | 'dmRatings' | 'storeRatings' | 'dmWithdrawals' | 'reports' | 'wallet' | 'servicePurchases' | 'dmCerts' | 'storeCerts' | 'realnameCerts' | 'security' | 'reviewHistory';
type AdminGroup = 'all' | 'data' | 'dm' | 'store' | 'content' | 'finance' | 'appeals' | 'history' | 'accounts';

function adminGroupForTab(tab: Tab): AdminGroup {
  if (['siteData', 'publishedDmDossiers', 'publishedStoreDossiers', 'publishedRankings'].includes(tab)) return 'data';
  if (['dmDossiers', 'dmDossierEdits', 'dmCerts', 'dmRatings', 'dmWithdrawals'].includes(tab)) return 'dm';
  if (['storeDossiers', 'storeDossierEdits', 'storeCerts', 'storeRatings'].includes(tab)) return 'store';
  if (['rankings', 'rankingEdits', 'publicReviews', 'comments', 'commissions', 'commissionApplications', 'carpools', 'scriptContributions', 'guides'].includes(tab)) return 'content';
  if (['wallet', 'servicePurchases', 'guideWithdrawals'].includes(tab)) return 'finance';
  if (['reports', 'messages', 'accountAppeals', 'claims', 'requests'].includes(tab)) return 'appeals';
  if (tab === 'reviewHistory') return 'history';
  if (['accounts', 'pending', 'realnameCerts', 'security'].includes(tab)) return 'accounts';
  return 'all';
}

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
  if (type === 'dossier_update') return '档案修改';
  if (type === 'provider_listing_update') return '委托师委托条';
  if (type === 'service_create') return '服务上线';
  if (type === 'portfolio_create') return '作品图片';
  if (type === 'availability_create') return '公开档期';
  if (type === 'tag_create') return '公开标签';
  if (type === 'script_rating_upsert') return '剧本评分';
  if (type === 'entity_rating_upsert') return '角色评分';
  if (type === 'rating_discussion_create') return '评价回应';
  return '公开内容';
}

function siteMessageCategoryLabel(category?: string | null) {
  if (category === 'dm_correction') return 'DM资料纠错';
  if (category === 'dossier_correction') return '档案纠错';
  if (category === 'appeal') return '申诉';
  if (category === 'bug') return '故障反馈';
  if (category === 'invalid_contact') return '联系方式无效';
  if (category === 'payment_refund') return '支付退款';
  if (category === 'report_abuse') return '举报滥用';
  if (category === 'account') return '账号问题';
  if (category === 'cooperation') return '合作共建';
  if (category === 'suggestion') return '功能建议';
  return '其他反馈';
}

function serviceProductLabel(productType: ServicePurchaseAudit['product_type']) {
  if (productType === 'dossier_claim') return '本人认领';
  if (productType === 'provider_listing') return '委托条上架';
  if (productType === 'provider_contact') return '联系方式解锁';
  return '付费服务';
}

function servicePurchaseStatusLabel(status: ServicePurchaseAudit['status']) {
  if (status === 'paid') return '已支付';
  if (status === 'refunded') return '已退款';
  return '待支付';
}

function serviceSubmissionStatusLabel(status: ServicePurchaseAudit['submission_status']) {
  if (status === 'pending') return '资料待审';
  if (status === 'approved') return '已审核通过';
  if (status === 'rejected') return '资料被驳回';
  if (status === 'access_granted') return '已永久解锁';
  return '尚未提交资料';
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
  } else if (item.target_type === 'dossier_update') {
    if (payload.entity_type) tags.push(payload.entity_type === 'store' ? '店家档案' : 'DM档案');
    if (Array.isArray(payload.changed_fields)) tags.push(...payload.changed_fields.slice(0, 4).map(field => `修改：${DOSSIER_EDIT_FIELD_LABELS[String(field)] || '资料'}`));
  }
  return Array.from(new Set(tags.filter(Boolean))).slice(0, 6);
}

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

function publicReviewValueText(key: string, value: unknown, phase: 'before' | 'after', dossiers: DossierOption[]) {
  if (key === 'employer_store_id' && !value) return '无关联店家';
  if (key === 'photo_url' && !value) return '无照片';
  if (value === null || value === undefined || value === '') return '留空';
  const imageField = ['avatar', 'image_url', 'photo_url', 'photo_files'].includes(key);
  if (imageField && (typeof value === 'string' || !Array.isArray(value))) {
    return phase === 'before' ? '原图片' : '已上传新图片（见下方缩略图）';
  }
  if (key === 'employment_status') {
    if (value === 'store_affiliated') return '已受雇于店家';
    if (value === 'freelance') return '无受雇店家（自由DM）';
    if (value === 'unknown') return '受雇状态待核对';
  }
  if (key === 'employer_store_id') {
    const store = dossiers.find(item => item.entity_type === 'store' && item.id === String(value));
    return store?.dm_name || (phase === 'before' ? '原关联店家' : '待核对店家');
  }
  if (key === 'photo_url') return phase === 'before' ? '原照片' : '已上传新照片（见下方缩略图）';
  if (!Array.isArray(value)) return typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (value.length === 0) return '留空';
  if (value.every(item => typeof item !== 'object' || item === null)) return value.join('、');
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object') return String(raw);
    const item = raw as Record<string, unknown>;
    if (item.url) {
      const submittedLabel = String(item.caption || item.name || '').trim();
      const safeLabel = submittedLabel && !normalizeAdminUrl(submittedLabel, true) && submittedLabel.length <= 80 ? submittedLabel : '照片';
      return `${index + 1}.${safeLabel}`;
    }
    if (item.store_name) {
      const period = [item.started_month, item.ended_month || (item.started_month ? '至今' : '')].filter(Boolean).join('~');
      return `${String(item.store_name)}${period ? `(${period})` : ''}`;
    }
    return String(item.name || item.label || item.id || `第${index + 1}项`);
  }).join('、');
}

function rankingEditValueText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '未填写';
  if (Array.isArray(value)) return value.length ? value.map(item => rankingEditValueText(item)).join('、') : '未填写';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function publicReviewSensitiveState(item: PublicReview) {
  if (item.target_type !== 'dossier_update') return { sensitiveFields: [] as string[], warning: '', blocked: false };
  const payload = item.payload || {};
  const sensitiveFields = Array.isArray(payload.sensitive_fields) ? payload.sensitive_fields.map(String) : [];
  if (sensitiveFields.length === 0) return { sensitiveFields, warning: '', blocked: false };
  const ownerStatus = String(payload.owner_response_status || 'not_required');
  const ownerConsented = Boolean(payload.submitter_is_owner) || ownerStatus === 'agreed';
  if (ownerConsented) return { sensitiveFields, warning: '包含敏感资料，DM 本人已明确同意公开。', blocked: false };
  if (ownerStatus === 'pending') return { sensitiveFields, warning: '包含敏感资料，正在等待 DM 本人确认。', blocked: true };
  const changedFields = Array.isArray(payload.changed_fields) ? payload.changed_fields.map(String) : [];
  const sensitiveOnly = changedFields.length > 0 && changedFields.every(field => sensitiveFields.includes(field));
  if (sensitiveOnly) return { sensitiveFields, warning: '仅包含敏感资料，未获得 DM 本人同意，不能公开。', blocked: true };
  return { sensitiveFields, warning: '未获得 DM 本人同意；通过时只应用其他资料，敏感字段会自动略过。', blocked: false };
}

function summarizePublicReviewPayload(
  payload?: Record<string, unknown> | null,
  fallbackProfile?: Record<string, unknown> | null,
  dossiers: DossierOption[] = [],
) {
  if (!payload || typeof payload !== 'object') return [];
  if (payload.patch && typeof payload.patch === 'object') {
    const postReviewPatch = payload.post_admin_review_patch && typeof payload.post_admin_review_patch === 'object'
      ? payload.post_admin_review_patch as Record<string, unknown>
      : {};
    const patch = { ...postReviewPatch, ...payload.patch as Record<string, unknown> };
    const before = payload.before_snapshot && typeof payload.before_snapshot === 'object' ? payload.before_snapshot as Record<string, unknown> : {};
    const lines = Object.entries(patch).map(([key, value]) => `${DOSSIER_EDIT_FIELD_LABELS[key] || '资料'}：${publicReviewValueText(key, before[key], 'before', dossiers)} → ${publicReviewValueText(key, value, 'after', dossiers)}`);
    if (payload.edit_reason) lines.unshift(`修改依据: ${String(payload.edit_reason)}`);
    if (Object.keys(postReviewPatch).length > 0) lines.unshift(`后审字段已先生效：${Object.keys(postReviewPatch).map(key => DOSSIER_EDIT_FIELD_LABELS[key] || key).join('、')}`);
    if (payload.owner_response_status === 'pending') lines.push(payload.owner_login_detected || !payload.owner_response_due_at
      ? '认领人状态：已上线，等待本人明确同意或反对'
      : `认领人状态：等待确认，截止 ${String(payload.owner_response_due_at)}`);
    if (payload.owner_response_status === 'agreed') lines.push(`认领人状态: 已同意${payload.owner_response_reason ? `，说明：${String(payload.owner_response_reason)}` : ''}`);
    if (payload.owner_response_status === 'opposed') lines.push(`认领人状态: 反对，说明：${String(payload.owner_response_reason || '未填写')}`);
    if (payload.owner_response_status === 'expired') lines.push('认领人状态: 3天内未上线，非敏感资料自动生效');
    return lines.slice(0, 16);
  }
  if (payload.profile_patch && typeof payload.profile_patch === 'object') {
    return summarizeProfileReviewPayload(payload, fallbackProfile);
  }
  const fallbackLabels: Record<string, string> = {
    tag: '标签', target_type: '对象类型', rating: '评分', score: '评分', content: '提交内容', comment: '点评内容',
    spoiler_level: '剧透程度', items: '提交档期', image_url: '上传图片', role_name: '角色', script_name: '剧本',
    poster_url: '委托条主图', headline: '一句话介绍', description: '补充说明', height_cm: '身高',
    weight_kg: '体重', role_types: '擅长角色类型',
  };
  const hiddenKeys = new Set(['social_snapshots', 'before_snapshot', 'changed_fields']);
  return Object.entries(payload)
    .filter(([key, value]) => !hiddenKeys.has(key) && value !== undefined && value !== null && value !== '')
    .slice(0, 12)
    .map(([key, value]) => `${fallbackLabels[key] || '提交资料'}：${['image_url', 'photo_url', 'avatar', 'poster_url'].includes(key) ? '已上传图片（见下方缩略图）' : Array.isArray(value) ? value.map(String).join('、').slice(0, 160) : typeof value === 'object' ? '已提交结构化资料' : String(value).slice(0, 160)}`);
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
  if (payload.patch && typeof payload.patch === 'object') {
    const patch = payload.patch as Record<string, unknown>;
    push(patch.photo_url, '待审档案封面');
    if (Array.isArray(patch.photo_files)) {
      patch.photo_files.forEach((raw, index) => {
        if (!raw || typeof raw !== 'object') return;
        const photo = raw as Record<string, unknown>;
        push(photo.url, String(photo.caption || photo.name || `待审档案照片 ${index + 1}`));
      });
    }
  }
  push(payload.image_url, '待审作品图片');
  push(payload.poster_url, '待审委托条主图');
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
  borderRadius: 8,
  padding: '12px 14px',
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
  if (decision === 'pass' && labels.length === 0 && Number(value.risk_score || 0) === 0) return null;
  return (
    <div style={{ marginTop: 6, padding: '6px 9px', borderRadius: 6, border: `1px solid ${borderColor}`, background: bg, color, fontSize: '0.74rem', lineHeight: 1.45 }}>
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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [managedProfiles, setManagedProfiles] = useState<Profile[]>([]);
  const [profilesTotal, setProfilesTotal] = useState(0);
  const [accountPage, setAccountPage] = useState(1);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [requests, setRequests] = useState<ContactReq[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [rankingEditRequests, setRankingEditRequests] = useState<RankingAuthorEditRequest[]>([]);
  const [approvedRankings, setApprovedRankings] = useState<Ranking[]>([]);
  const [comments, setComments] = useState<CommentReview[]>([]);
  const [claims, setClaims] = useState<ClaimReview[]>([]);
  const [commissions, setCommissions] = useState<CommissionReview[]>([]);
  const [commissionApplications, setCommissionApplications] = useState<CommissionApplicationAudit[]>([]);
  const [providerInquiries, setProviderInquiries] = useState<ProviderInquiryAudit[]>([]);
  const [rankingBatchLoading, setRankingBatchLoading] = useState(false);
  const [carpools, setCarpools] = useState<CarpoolReview[]>([]);
  const [scriptContributions, setScriptContributions] = useState<ScriptContributionReview[]>([]);
  const [dmDossiers, setDmDossiers] = useState<DmDossierReview[]>([]);
  const [dmRatings, setDmRatings] = useState<DmRatingReview[]>([]);
  const [storeRatings, setStoreRatings] = useState<StoreRatingReview[]>([]);
  const [dmIdentityWithdrawals, setDmIdentityWithdrawals] = useState<DmIdentityWithdrawalReview[]>([]);
  const [dossierOptions, setDossierOptions] = useState<DossierOption[]>([]);
  const [reports, setReports] = useState<ReportReview[]>([]);
  const [siteMessages, setSiteMessages] = useState<SiteMessage[]>([]);
  const [accountAppeals, setAccountAppeals] = useState<AccountAppeal[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [wechatContentChecks, setWechatContentChecks] = useState<WechatContentCheck[]>([]);
  const [wechatSafetyFilter, setWechatSafetyFilter] = useState<WechatSafetyFilter>('attention');
  const [wechatSafetyClock, setWechatSafetyClock] = useState(() => Date.now());
  const [wechatSafetyRefreshing, setWechatSafetyRefreshing] = useState(false);
  const [wechatSafetyError, setWechatSafetyError] = useState('');
  const [publicReviews, setPublicReviews] = useState<PublicReview[]>([]);
  const [reviewHistory, setReviewHistory] = useState<PublicReview[]>([]);
  const [guides, setGuides] = useState<GuideReview[]>([]);
  const [guideWithdrawals, setGuideWithdrawals] = useState<GuideWithdrawalReview[]>([]);
  const [transactions, setTransactions] = useState<TransactionReview[]>([]);
  const [servicePurchases, setServicePurchases] = useState<ServicePurchaseAudit[]>([]);
  const [certs, setCerts] = useState<CertReview[]>([]);
const [loading, setLoading] = useState(false);
const [transactionLoading, setTransactionLoading] = useState(false);
const [transactionMsg, setTransactionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [error, setError] = useState('');
  const [providerRecovery, setProviderRecovery] = useState<ProviderListingRecoveryModal | null>(null);
  const [tab, setTab] = useState<Tab>('allPending');
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: string; reason: string; type: RejectType; revisionKind: 'content' | 'evidence' }>({
    open: false,
    id: '',
    reason: '',
    type: 'profile',
    revisionKind: 'content',
  });
  const [rankingEdit, setRankingEdit] = useState<{ item: Ranking; form: RankingEditForm; saving: boolean; error: string } | null>(null);
  const [rankingEvidencePublish, setRankingEvidencePublish] = useState<RankingEvidencePublishState | null>(null);
  const [privateAccountView, setPrivateAccountView] = useState<PrivateAccountView | null>(null);

  const loadAccounts = useCallback(async (token: string | undefined, page: number, search: string) => {
    const t = token || getToken();
    if (!t) return;
    setAccountsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (search.trim()) params.set('q', search.trim());
      const response = await fetch(`${API}/lc/admin/profiles?${params.toString()}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const payload = await response.json();
      if (!payload.success) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '账号加载失败');
      const data = payload.data as { profiles?: Profile[]; total?: number; page?: number };
      setManagedProfiles(data.profiles || []);
      setProfilesTotal(Number(data.total || 0));
      if (data.page && data.page !== page) setAccountPage(data.page);
    } catch (accountError) {
      setError(accountError instanceof Error ? accountError.message : '账号加载失败');
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const refreshWechatSafety = useCallback(async (quiet = false) => {
    const token = getToken();
    if (!token) return;
    if (!quiet) setWechatSafetyRefreshing(true);
    try {
      const response = await fetch(`${API}/lc/admin/wechat-content-checks?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '安全记录加载失败');
      }
      setWechatContentChecks(payload.data || []);
      setWechatSafetyClock(Date.now());
      setWechatSafetyError('');
    } catch (refreshError) {
      setWechatSafetyError(refreshError instanceof Error ? refreshError.message : '安全记录加载失败');
    } finally {
      if (!quiet) setWechatSafetyRefreshing(false);
    }
  }, []);

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
        setRankingEditRequests((d.data as { rankingEditRequests: RankingAuthorEditRequest[] }).rankingEditRequests || []);
        setApprovedRankings((d.data as { approvedRankings: Ranking[] }).approvedRankings || []);
        setComments((d.data as { comments: CommentReview[] }).comments || []);
        setClaims((d.data as { claims: ClaimReview[] }).claims || []);
        setCommissions((d.data as { commissions: CommissionReview[] }).commissions || []);
        setCarpools((d.data as { carpools: CarpoolReview[] }).carpools || []);
        setScriptContributions((d.data as { scriptContributions: ScriptContributionReview[] }).scriptContributions || []);
        setDmDossiers((d.data as { dmDossiers: DmDossierReview[] }).dmDossiers || []);
        setDmRatings((d.data as { dmRatings: DmRatingReview[] }).dmRatings || []);
        setStoreRatings((d.data as { storeRatings: StoreRatingReview[] }).storeRatings || []);
        setDmIdentityWithdrawals((d.data as { dmIdentityWithdrawals: DmIdentityWithdrawalReview[] }).dmIdentityWithdrawals || []);
        setDossierOptions((d.data as { dossierOptions: DossierOption[] }).dossierOptions || []);
        setTransactions((d.data as { transactions: TransactionReview[] }).transactions || []);
        setCerts((d.data as { certifications: CertReview[] }).certifications || []);
        setReports((d.data as { reports: ReportReview[] }).reports || []);
        setSiteMessages((d.data as { siteMessages: SiteMessage[] }).siteMessages || []);
        setAccountAppeals((d.data as { accountAppeals: AccountAppeal[] }).accountAppeals || []);
        setSecurityEvents((d.data as { securityEvents: SecurityEvent[] }).securityEvents || []);
        setPublicReviews((d.data as { publicReviews: PublicReview[] }).publicReviews || []);
        setReviewHistory((d.data as { reviewHistory: PublicReview[] }).reviewHistory || []);
        setGuides((d.data as { guides: GuideReview[] }).guides || []);
        setGuideWithdrawals((d.data as { guideWithdrawals: GuideWithdrawalReview[] }).guideWithdrawals || []);
        setServicePurchases((d.data as { servicePurchases: ServicePurchaseAudit[] }).servicePurchases || []);
        const [applicationResponse, providerInquiryResponse, wechatContentResponse] = await Promise.all([
          fetch(`${API}/lc/admin/commission-applications`, { headers: { Authorization: `Bearer ${t}` } }),
          fetch(`${API}/lc/admin/provider-inquiries`, { headers: { Authorization: `Bearer ${t}` } }),
          fetch(`${API}/lc/admin/wechat-content-checks?limit=200`, { headers: { Authorization: `Bearer ${t}` } }),
        ]);
        const [applicationPayload, providerInquiryPayload, wechatContentPayload] = await Promise.all([
          applicationResponse.json(),
          providerInquiryResponse.json(),
          wechatContentResponse.json(),
        ]);
        if (applicationResponse.ok && applicationPayload.success) setCommissionApplications(applicationPayload.data || []);
        if (providerInquiryResponse.ok && providerInquiryPayload.success) setProviderInquiries(providerInquiryPayload.data || []);
        if (wechatContentResponse.ok && wechatContentPayload.success) setWechatContentChecks(wechatContentPayload.data || []);
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

  useEffect(() => {
    if (!authed) return;
    const timer = window.setTimeout(() => void loadAccounts(undefined, accountPage, accountSearch), 250);
    return () => window.clearTimeout(timer);
  }, [authed, accountPage, accountSearch, loadAccounts]);

  useEffect(() => {
    if (!authed || tab !== 'security') return;
    setWechatSafetyClock(Date.now());
    const timer = window.setInterval(() => void refreshWechatSafety(true), 60_000);
    return () => window.clearInterval(timer);
  }, [authed, tab, refreshWechatSafety]);

  const approveProfile = async (id: string) => {
    await fetch(`${API}/lc/admin/profile/${id}/unflag`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    void loadData();
    void loadAccounts(undefined, accountPage, accountSearch);
  };

  const hideProfile = async (id: string) => {
    await fetch(`${API}/lc/admin/profile/${id}/flag`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectReason: '管理员下线' }),
    });
    void loadData();
    void loadAccounts(undefined, accountPage, accountSearch);
  };

  const banProfile = async (id: string) => {
    const reason = window.prompt('限制账号原因（会记录到安全日志）', '违反平台规则，限制账号功能');
    if (reason === null) return;
    const scope = window.confirm('是否限制整个账号功能？\n\n确定：账号功能限制（不能正常浏览和操作）\n取消：仅限制发布（仍可浏览、登录和申诉）') ? 'account' : 'publish';
    const endsAtInput = window.prompt('限制结束时间（可留空表示长期有效；示例 2026-08-01 18:00）', '');
    if (endsAtInput === null) return;
    const parsedEndsAt = endsAtInput.trim() ? new Date(endsAtInput.trim()) : null;
    if (parsedEndsAt && !Number.isFinite(parsedEndsAt.getTime())) {
      setError('限制结束时间格式不正确');
      return;
    }
    const endsAt = parsedEndsAt?.toISOString() || null;
    const response = await fetch(`${API}/lc/admin/profile/${id}/ban`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, scope, endsAt }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setError(typeof payload.error === 'string' ? payload.error : payload.error?.message || '限制账号失败');
      return;
    }
    void loadData();
    void loadAccounts(undefined, accountPage, accountSearch);
  };

  const unbanProfile = async (id: string) => {
    const restoreProfile = window.confirm('解除限制后，是否同时恢复该用户的公开主页？\n\n确定：解除限制并恢复主页\n取消：只解除限制，主页保持当前状态');
    const response = await fetch(`${API}/lc/admin/profile/${id}/unban`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ restoreProfile, adminNote: restoreProfile ? '管理员解除限制并恢复公开主页' : '管理员解除限制，公开主页状态不变' }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setError(typeof payload.error === 'string' ? payload.error : payload.error?.message || '解除限制失败');
      return;
    }
    void loadData();
    void loadAccounts(undefined, accountPage, accountSearch);
  };

  const reviewAccountAppeal = async (id: string, decision: 'approved' | 'rejected' | 'needs_info') => {
    const defaults = decision === 'approved'
      ? '申诉已核实，解除账号限制。'
      : decision === 'needs_info'
        ? '请补充能够说明情况的具体信息。'
        : '已复核，当前限制继续生效。';
    const adminReply = window.prompt('填写给用户看的处理说明', defaults);
    if (adminReply === null || !adminReply.trim()) return;
    const restoreProfile = decision === 'approved'
      ? window.confirm('通过申诉并解除限制后，是否同时恢复用户公开主页？')
      : false;
    const response = await fetch(`${API}/lc/admin/account-appeals/${id}/review`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, adminReply: adminReply.trim(), restoreProfile }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setError(typeof payload.error === 'string' ? payload.error : payload.error?.message || '账号申诉处理失败');
      return;
    }
    setAccountAppeals(current => decision === 'needs_info' ? current.map(item => item.id === id ? { ...item, status: 'needs_info', admin_reply: adminReply.trim() } : item) : current.filter(item => item.id !== id));
    void loadData();
    void loadAccounts(undefined, accountPage, accountSearch);
  };

  const toggleRealname = async (id: string, value: boolean) => {
    await fetch(`${API}/lc/admin/profile/${id}/realname`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    void loadData();
    void loadAccounts(undefined, accountPage, accountSearch);
  };

  const revealPrivateAccount = async () => {
    if (!privateAccountView || privateAccountView.loading || privateAccountView.details) return;
    const reason = privateAccountView.reason.trim();
    if (reason.length < 4) {
      setPrivateAccountView(current => current ? { ...current, error: '请填写至少 4 个字的查看原因' } : current);
      return;
    }
    setPrivateAccountView(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      const response = await fetch(`${API}/lc/admin/profiles/${encodeURIComponent(privateAccountView.profile.id)}/private-access`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json();
      if (!payload.success) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '隐私信息读取失败');
      setPrivateAccountView(current => current ? { ...current, loading: false, details: payload.data as PrivateAccountDetails } : current);
    } catch (privateError) {
      setPrivateAccountView(current => current ? { ...current, loading: false, error: privateError instanceof Error ? privateError.message : '隐私信息读取失败' } : current);
    }
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

  const approveSafeRankings = async () => {
    const ids = rankings.filter(item => item.moderation_precheck?.decision === 'pass' && !item.dm_employment_status_suggestion).map(item => item.id);
    if (ids.length === 0) return;
    setRankingBatchLoading(true);
    try {
      const response = await fetch(`${API}/lc/admin/rankings/batch-approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '批量审核失败');
      const approved = Array.isArray(payload.data?.approved_ids) ? payload.data.approved_ids.length : 0;
      const skipped = Array.isArray(payload.data?.skipped) ? payload.data.skipped.length : 0;
      window.alert(`已通过 ${approved} 条${skipped ? `，另有 ${skipped} 条因档案或风险条件跳过` : ''}`);
      void loadData();
    } catch (batchError) {
      window.alert(batchError instanceof Error ? batchError.message : '批量审核失败');
    } finally {
      setRankingBatchLoading(false);
    }
  };

  const approveRankingEdit = async (id: string) => {
    const response = await fetch(`${API}/lc/admin/ranking-edits/${id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      window.alert(typeof payload.error === 'string' ? payload.error : payload.error?.message || '处理失败');
      return;
    }
    setRankingEditRequests(previous => previous.filter(item => item.id !== id));
    void loadData();
  };

  const moveRankingImageToEvidence = async (id: string, index: number) => {
    const response = await fetch(`${API}/lc/admin/rankings/${encodeURIComponent(id)}/display-files/${index}/private`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      window.alert(typeof payload.error === 'string' ? payload.error : payload.error?.message || '配图处理失败');
      return;
    }
    setRankings(previous => previous.map(item => item.id === id ? {
      ...item,
      display_files: payload.data.display_files || [],
      private_evidence_files: payload.data.private_evidence_files || [],
    } : item));
    setApprovedRankings(previous => previous.map(item => item.id === id ? {
      ...item,
      display_files: payload.data.display_files || [],
      private_evidence_files: payload.data.private_evidence_files || [],
    } : item));
  };

  const openRankingEvidencePublish = async (rankingId: string, file: DossierClaimProof) => {
    setRankingEvidencePublish({
      rankingId,
      file,
      sourceBlob: null,
      sourceLoading: true,
      processedFile: null,
      editActions: [],
      processingNote: '',
      confirmed: false,
      saving: false,
      error: '',
    });
    try {
      const response = await fetch(`${API}/lc/admin/rankings/${encodeURIComponent(rankingId)}/evidence/${encodeURIComponent(file.id)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) throw new Error('审核材料读取失败');
      const sourceBlob = await response.blob();
      setRankingEvidencePublish(current => current && current.rankingId === rankingId && current.file.id === file.id
        ? { ...current, sourceBlob, sourceLoading: false }
        : current);
    } catch (sourceError) {
      setRankingEvidencePublish(current => current && current.rankingId === rankingId && current.file.id === file.id
        ? { ...current, sourceLoading: false, error: sourceError instanceof Error ? sourceError.message : '审核材料读取失败' }
        : current);
    }
  };

  const adoptLegacyRankingEvidence = async (rankingId: string, index: number) => {
    const response = await fetch(`${API}/lc/admin/rankings/${encodeURIComponent(rankingId)}/legacy-evidence/${index}/adopt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '旧版材料处理失败');
    }
    const applyResult = (item: Ranking) => item.id === rankingId ? {
      ...item,
      private_evidence_files: payload.data.private_evidence_files || [],
    } : item;
    setRankings(previous => previous.map(applyResult));
    setApprovedRankings(previous => previous.map(applyResult));
    await openRankingEvidencePublish(rankingId, payload.data.file as DossierClaimProof);
  };

  const publishRankingEvidenceCopy = async () => {
    if (!rankingEvidencePublish || rankingEvidencePublish.saving) return;
    if (!rankingEvidencePublish.processedFile) {
      setRankingEvidencePublish(current => current ? { ...current, error: '请先在图片上完成至少一项编辑' } : current);
      return;
    }
    if (rankingEvidencePublish.processingNote.trim().length < 4) {
      setRankingEvidencePublish(current => current ? { ...current, error: '请填写至少4个字的处理说明' } : current);
      return;
    }
    if (!rankingEvidencePublish.confirmed) {
      setRankingEvidencePublish(current => current ? { ...current, error: '请确认公开副本已经完成隐私处理' } : current);
      return;
    }
    setRankingEvidencePublish(current => current ? { ...current, saving: true, error: '' } : current);
    try {
      const form = new FormData();
      form.append('processedImage', rankingEvidencePublish.processedFile, rankingEvidencePublish.processedFile.name);
      form.append('processingNote', rankingEvidencePublish.processingNote.trim());
      form.append('editActions', JSON.stringify(rankingEvidencePublish.editActions));
      form.append('confirmed', 'true');
      const response = await fetch(`${API}/lc/admin/rankings/${encodeURIComponent(rankingEvidencePublish.rankingId)}/evidence/${encodeURIComponent(rankingEvidencePublish.file.id)}/public-copy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '公开副本生成失败');
      const applyResult = (item: Ranking) => item.id === rankingEvidencePublish.rankingId ? {
        ...item,
        display_files: payload.data.display_files || [],
        private_evidence_files: payload.data.private_evidence_files || [],
      } : item;
      setRankings(previous => previous.map(applyResult));
      setApprovedRankings(previous => previous.map(applyResult));
      setRankingEvidencePublish(null);
    } catch (publishError) {
      setRankingEvidencePublish(current => current ? {
        ...current,
        saving: false,
        error: publishError instanceof Error ? publishError.message : '公开副本生成失败',
      } : current);
    }
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

  const reviewDmIdentityWithdrawal = async (id: string, action: 'approve' | 'reject') => {
    let reason = '';
    if (action === 'approve') {
      if (!window.confirm('确认撤销这份 DM 身份认证吗？档案、评分和历史记录会保留，但账号绑定及当前任职关系会解除。')) return;
    } else {
      const input = window.prompt('请输入拒绝原因', '请补充说明后再申请');
      if (input === null) return;
      reason = input.trim();
    }
    const response = await fetch(`${API}/lc/admin/dm-identity-withdrawals/${id}/${action}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setError(typeof payload.error === 'string' ? payload.error : payload.error?.message || '认证撤销审核失败');
      return;
    }
    setDmIdentityWithdrawals(prev => prev.filter(item => item.id !== id));
    void loadData();
  };

  const approvePublicReview = async (id: string) => {
    setError('');
    try {
      const response = await fetch(`${API}/lc/admin/public-reviews/${id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNote: '公开内容审核通过' }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '审核提交失败');
      }
      setPublicReviews(prev => prev.filter(item => item.id !== id));
      void loadData();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : '审核提交失败');
    }
  };

  const openProviderListingRecovery = async (item: ServicePurchaseAudit) => {
    setProviderRecovery({
      purchaseId: item.id,
      profileName: item.target_name || item.profile_name || '用户',
      posterUrl: '',
      posterUploadedAt: '',
      headline: '',
      description: '',
      heightCm: '',
      weightKg: '',
      roleTypesText: '',
      businessContact: '',
      contactAvailable: true,
      loading: true,
      saving: false,
      error: '',
    });
    try {
      const response = await fetch(`${API}/lc/admin/service-purchases/${item.id}/provider-recovery`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '异常订单资料读取失败');
      }
      const data = payload.data || {};
      setProviderRecovery(current => current?.purchaseId === item.id ? {
        ...current,
        profileName: data.profile_name || current.profileName,
        posterUrl: data.poster_url || '',
        posterUploadedAt: data.poster_uploaded_at || '',
        headline: data.headline || '',
        description: data.description || '',
        heightCm: data.height_cm ? String(data.height_cm) : '',
        weightKg: data.weight_kg ? String(data.weight_kg) : '',
        roleTypesText: Array.isArray(data.role_types) ? data.role_types.join('、') : '',
        businessContact: data.business_contact || '',
        contactAvailable: data.contact_available !== false,
        loading: false,
        error: data.poster_url ? '' : '没有找到付款前上传的委托条主图，暂时不能恢复。',
      } : current);
    } catch (recoveryError) {
      setProviderRecovery(current => current?.purchaseId === item.id ? {
        ...current,
        loading: false,
        error: recoveryError instanceof Error ? recoveryError.message : '异常订单资料读取失败',
      } : current);
    }
  };

  const submitProviderListingRecovery = async (approveImmediately: boolean) => {
    const current = providerRecovery;
    if (!current || current.loading || current.saving) return;
    if (!current.posterUrl) {
      setProviderRecovery({ ...current, error: '没有找回委托条主图，不能提交审核。' });
      return;
    }
    if (current.businessContact.trim().length < 2) {
      setProviderRecovery({ ...current, error: '请先补录委托师公开解锁用的业务联系方式。' });
      return;
    }
    setProviderRecovery({ ...current, saving: true, error: '' });
    let recoveredReviewId = current.reviewId || '';
    try {
      if (!recoveredReviewId) {
        const response = await fetch(`${API}/lc/admin/service-purchases/${current.purchaseId}/provider-recovery`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            headline: current.headline.trim(),
            description: current.description.trim(),
            heightCm: current.heightCm || null,
            weightKg: current.weightKg || null,
            roleTypes: current.roleTypesText.split(/[，,、\n]/).map(item => item.trim()).filter(Boolean).slice(0, 12),
            businessContact: current.businessContact.trim(),
            contactAvailable: current.contactAvailable,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '异常订单恢复失败');
        }
        recoveredReviewId = String(payload.data?.review_id || '');
        if (!recoveredReviewId) throw new Error('资料已恢复，但没有返回审核编号');
        setProviderRecovery(latest => latest?.purchaseId === current.purchaseId
          ? { ...latest, reviewId: recoveredReviewId }
          : latest);
      }
      if (approveImmediately) {
        const approvalResponse = await fetch(`${API}/lc/admin/public-reviews/${recoveredReviewId}/approve`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewNote: '历史支付异常订单恢复并审核通过' }),
        });
        const approvalPayload = await approvalResponse.json();
        if (!approvalResponse.ok || !approvalPayload.success) {
          throw new Error(typeof approvalPayload.error === 'string' ? approvalPayload.error : approvalPayload.error?.message || '资料已恢复，但审核通过失败');
        }
      }
      setProviderRecovery(null);
      await loadData();
      window.alert(approveImmediately ? '委托条已恢复并公开。' : '委托条资料已恢复，已进入待审列表。');
    } catch (recoveryError) {
      setProviderRecovery(latest => latest?.purchaseId === current.purchaseId ? {
        ...latest,
        reviewId: recoveredReviewId || latest.reviewId,
        saving: false,
        error: recoveryError instanceof Error ? recoveryError.message : '异常订单恢复失败',
      } : latest);
      if (recoveredReviewId) void loadData();
    }
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
    const adminReply = window.prompt('填写给用户的处理回复。该回复会进入用户的消息通知：', '');
    if (adminReply === null) return;
    if (!adminReply.trim()) {
      setError('请填写处理回复后再完成反馈');
      return;
    }
    await fetch(`${API}/lc/admin/site-messages/${id}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNote: '已处理并回复用户', adminReply: adminReply.trim() }),
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
    if (type === 'rankingEdit' && reason.trim().length < 2) {
      window.alert('请填写驳回原因，发布人会在“我的发布”中看到');
      return;
    }
    setRejectModal({ open: false, id: '', reason: '', type: 'profile', revisionKind: 'content' });

    const headers = { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
    const body = JSON.stringify({ rejectReason: reason, revisionKind });

    if (type === 'profile') {
      await fetch(`${API}/lc/admin/profile/${id}/flag`, { method: 'PUT', headers, body });
      setProfiles(prev => prev.filter(p => p.id !== id));
    } else if (type === 'ranking') {
      await fetch(`${API}/lc/admin/rankings/${id}/reject`, { method: 'PUT', headers, body });
      setRankings(prev => prev.filter(r => r.id !== id));
    } else if (type === 'rankingEdit') {
      await fetch(`${API}/lc/admin/ranking-edits/${id}/reject`, { method: 'PUT', headers, body });
      setRankingEditRequests(prev => prev.filter(item => item.id !== id));
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
    setDmIdentityWithdrawals([]);
    setDossierOptions([]);
    setRankingEditRequests([]);
    setReports([]);
    setSiteMessages([]);
    setAccountAppeals([]);
    setSecurityEvents([]);
    setWechatContentChecks([]);
    setPublicReviews([]);
    setReviewHistory([]);
    setGuides([]);
    setGuideWithdrawals([]);
    setTransactions([]);
    setServicePurchases([]);
    setCerts([]);
  };

  const pendingProfiles = profiles.filter(p => !p.is_visible && !p.reject_reason);
  const accountProfiles = managedProfiles;
  const accountTotalPages = Math.max(1, Math.ceil(profilesTotal / 50));
  const paidAwaitingSubmission = servicePurchases.filter(item =>
    item.status === 'paid'
    && item.submission_status === 'not_submitted'
    && item.product_type !== 'provider_contact'
  );
  const pendingReviewItems: PendingReviewItem[] = [
    ...paidAwaitingSubmission.map(item => ({
      id: `service-purchase-${item.id}`,
      tab: 'servicePurchases' as const,
      category: '已付费待补交',
      title: serviceProductLabel(item.product_type),
      meta: `用户：${item.profile_name || item.profile_id} · 对象：${item.target_name || item.target_id} · 已支付 ¥${(item.amount_fen / 100).toFixed(2)}`,
      createdAt: item.paid_at || item.created_at,
      accent: '#b45309',
      tags: ['款项已确认', '无需重复收费', '等待用户补交'],
    })),
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
    ...rankingEditRequests.map(item => ({
      id: `ranking-edit-${item.id}`,
      tab: 'rankingEdits' as const,
      category: item.request_kind === 'restore' ? '口碑恢复' : '口碑修改',
      title: String(item.before_snapshot?.subject_name || '未命名口碑'),
      meta: item.request_kind === 'restore'
        ? '原发布人申请重新公开已下架内容'
        : `原发布人申请修改 ${item.changes?.length || 0} 个字段`,
      createdAt: item.created_at,
      accent: item.request_kind === 'restore' ? '#15803d' : '#2563eb',
      tags: [item.request_kind === 'restore' ? '恢复公开' : '小幅修改', String(item.before_snapshot?.type || '')].filter(Boolean),
    })),
    ...publicReviews.map(item => ({
      id: `public-${item.id}`,
      tab: item.target_type === 'dossier_update'
        ? (item.payload?.entity_type === 'store' ? 'storeDossierEdits' as const : 'dmDossierEdits' as const)
        : 'publicReviews' as const,
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
      tab: item.entity_type === 'store' ? 'storeDossiers' as const : 'dmDossiers' as const,
      category: item.claim_status === 'pending' && item.status !== 'pending'
        ? '档案认领'
        : item.entity_type === 'store' ? '店家档案' : 'DM档案',
      title: item.dm_name,
      meta: `${item.city || '未知城市'}${item.workplace ? ` · ${item.workplace}` : ''}`,
      createdAt: item.created_at,
      accent: '#be185d',
      tags: item.tags || [],
    })),
    ...dmIdentityWithdrawals.map(item => ({
      id: `dm-withdrawal-${item.id}`,
      tab: 'dmWithdrawals' as const,
      category: 'DM认证撤销',
      title: item.dm_dossier?.dm_name || 'DM档案',
      meta: `${profileAccountById(profiles, item.profile_id)} · ${item.reason}`,
      createdAt: item.created_at,
      accent: '#9f1239',
      tags: ['保留档案', '解除账号绑定', '结束任职关系'],
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
    ...accountAppeals.map(item => ({
      id: `account-appeal-${item.id}`,
      tab: 'accountAppeals' as const,
      category: '账号申诉',
      title: item.profile_name || '未知用户',
      meta: `${item.restriction?.scope === 'account' ? '账号功能限制' : '发布限制'} · ${item.restriction?.reason || '原因待补'}`,
      createdAt: item.created_at,
      accent: '#b45309',
    })),
    ...transactions.map(tx => ({
      id: `transaction-${tx.id}`,
      tab: 'wallet' as const,
      category: '充值',
      title: `充值 ${tx.amount} 榜金`,
      meta: `用户：${tx.lc_profiles?.display_name || tx.profile_id}`,
      createdAt: tx.created_at,
      accent: '#15803d',
    })),
    ...certs.map(c => ({
      id: `cert-${c.id}`,
      tab: c.type === 'dm' ? 'dmCerts' as const : c.type === 'shop' ? 'storeCerts' as const : 'realnameCerts' as const,
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
      meta: `作者：${item.author_name || '未知用户'} · ${item.price || 0} 榜金`,
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

  const activeGroup = adminGroupForTab(tab);
  const dmDossierItems = dmDossiers.filter(item => item.entity_type !== 'store');
  const storeDossierItems = dmDossiers.filter(item => item.entity_type === 'store');
  const publishedDmDossiers = dossierOptions.filter(item => item.entity_type === 'dm');
  const publishedStoreDossiers = dossierOptions.filter(item => item.entity_type === 'store');
  const dmDossierEdits = publicReviews.filter(item => item.target_type === 'dossier_update' && item.payload?.entity_type !== 'store');
  const storeDossierEdits = publicReviews.filter(item => item.target_type === 'dossier_update' && item.payload?.entity_type === 'store');
  const contentPublicReviews = publicReviews.filter(item => item.target_type !== 'dossier_update');
  const visiblePublicReviews = tab === 'dmDossierEdits' ? dmDossierEdits : tab === 'storeDossierEdits' ? storeDossierEdits : contentPublicReviews;
  const visibleDossiers = tab === 'storeDossiers' ? storeDossierItems : dmDossierItems;
  const visiblePublishedDossiers = tab === 'publishedStoreDossiers' ? publishedStoreDossiers : publishedDmDossiers;
  const visibleCerts = certs.filter(item => tab === 'dmCerts' ? item.type === 'dm' : tab === 'storeCerts' ? item.type === 'shop' : item.type === 'realname');
  const historyEvents = securityEvents.filter(event => Boolean(ADMIN_REVIEW_ACTIONS[event.action]));
  const reviewHistoryById = new Map(reviewHistory.map(item => [item.id, item]));
  const today = new Date().toISOString().slice(0, 10);
  const reviewedToday = historyEvents.filter(event => event.created_at?.slice(0, 10) === today).length;
  const highRiskCount = [
    ...rankings.map(item => item.moderation_precheck),
    ...publicReviews.map(item => item.moderation_precheck),
    ...dmRatings.map(item => item.moderation_precheck),
    ...storeRatings.map(item => item.moderation_precheck),
    ...reports.map(item => item.moderation_precheck),
  ].filter(item => item?.decision === 'review' || item?.decision === 'block').length;

  const groupTabs: Record<Exclude<AdminGroup, 'all' | 'history'>, Array<{ tab: Tab; label: string; count?: number }>> = {
    data: [
      { tab: 'siteData', label: '数据总览' },
      { tab: 'publishedDmDossiers', label: 'DM档案', count: publishedDmDossiers.length },
      { tab: 'publishedStoreDossiers', label: '店家档案', count: publishedStoreDossiers.length },
      { tab: 'publishedRankings', label: '已发布榜单', count: approvedRankings.length },
    ],
    dm: [
      { tab: 'dmDossiers', label: '建档 / 认领', count: dmDossierItems.length },
      { tab: 'dmDossierEdits', label: '资料修改', count: dmDossierEdits.length },
      { tab: 'dmCerts', label: '身份认证', count: certs.filter(item => item.type === 'dm').length },
      { tab: 'dmRatings', label: 'DM评分', count: dmRatings.length },
      { tab: 'dmWithdrawals', label: '认证撤销', count: dmIdentityWithdrawals.length },
    ],
    store: [
      { tab: 'storeDossiers', label: '建档 / 认领', count: storeDossierItems.length },
      { tab: 'storeDossierEdits', label: '资料修改', count: storeDossierEdits.length },
      { tab: 'storeCerts', label: '店家认证', count: certs.filter(item => item.type === 'shop').length },
      { tab: 'storeRatings', label: '店家评分', count: storeRatings.length },
    ],
    content: [
      { tab: 'publicReviews', label: '主页与公开资料', count: contentPublicReviews.length },
      { tab: 'rankings', label: '红黑榜', count: rankings.length },
      { tab: 'rankingEdits', label: '口碑修改 / 恢复', count: rankingEditRequests.length },
      { tab: 'comments', label: '评论', count: comments.length },
      { tab: 'commissions', label: '委托', count: commissions.length },
      { tab: 'commissionApplications', label: '委托私信', count: commissionApplications.length + providerInquiries.length },
      { tab: 'carpools', label: '拼车', count: carpools.length },
      { tab: 'scriptContributions', label: '剧本库', count: scriptContributions.length },
      { tab: 'guides', label: '攻略', count: guides.length },
    ],
    finance: [
      { tab: 'wallet', label: '充值', count: transactions.length },
      { tab: 'servicePurchases', label: '付费服务', count: servicePurchases.length },
      { tab: 'guideWithdrawals', label: '提现', count: guideWithdrawals.length },
    ],
    appeals: [
      { tab: 'reports', label: '举报', count: reports.length },
      { tab: 'accountAppeals', label: '账号申诉', count: accountAppeals.length },
      { tab: 'messages', label: '建议 / 申诉', count: siteMessages.length },
      { tab: 'claims', label: '相关方申请', count: claims.length },
      { tab: 'requests', label: '联系申请', count: requests.length },
    ],
    accounts: [
      { tab: 'accounts', label: '账号管理', count: profilesTotal },
      { tab: 'pending', label: '创作者主页', count: pendingProfiles.length },
      { tab: 'realnameCerts', label: '实名认证', count: certs.filter(item => item.type === 'realname').length },
      { tab: 'security', label: '安全日志' },
    ],
  };
  const primaryGroups: Array<{ group: AdminGroup; label: string; tab: Tab; count?: number }> = [
    { group: 'all', label: '全部待审', tab: 'allPending', count: pendingReviewItems.length },
    { group: 'data', label: '站内数据', tab: 'siteData', count: dossierOptions.length + approvedRankings.length + accountProfiles.length },
    { group: 'dm', label: 'DM审核', tab: 'dmDossiers', count: dmDossierItems.length + dmDossierEdits.length + dmRatings.length + dmIdentityWithdrawals.length + certs.filter(item => item.type === 'dm').length },
    { group: 'store', label: '店家审核', tab: 'storeDossiers', count: storeDossierItems.length + storeDossierEdits.length + storeRatings.length + certs.filter(item => item.type === 'shop').length },
    { group: 'content', label: '内容审核', tab: 'publicReviews', count: contentPublicReviews.length + rankings.length + comments.length + commissions.length + carpools.length + scriptContributions.length + guides.length },
    { group: 'finance', label: '交易审核', tab: 'servicePurchases', count: transactions.length + guideWithdrawals.length + paidAwaitingSubmission.length },
    { group: 'appeals', label: '举报申诉', tab: 'reports', count: reports.length + accountAppeals.length + siteMessages.length + claims.length + requests.length },
    { group: 'history', label: '审核历史', tab: 'reviewHistory' },
    { group: 'accounts', label: '账号与安全', tab: 'accounts', count: pendingProfiles.length + certs.filter(item => item.type === 'realname').length },
  ];
  const wechatSafetyFilters: Array<{ value: WechatSafetyFilter; label: string }> = [
    { value: 'attention', label: '需处理' },
    { value: 'pending', label: '检查中' },
    { value: 'pass', label: '已通过' },
    { value: 'all', label: '全部' },
  ];
  const wechatSafetyFilterCounts = new Map(wechatSafetyFilters.map(filter => [
    filter.value,
    wechatContentChecks.filter(item => wechatSafetyMatchesFilter(
      item.status,
      item.check_type,
      item.created_at,
      filter.value,
      wechatSafetyClock,
    )).length,
  ]));
  const visibleWechatContentChecks = wechatContentChecks.filter(item => wechatSafetyMatchesFilter(
    item.status,
    item.check_type,
    item.created_at,
    wechatSafetyFilter,
    wechatSafetyClock,
  ));

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
          <h2 style={{ textAlign: 'center', fontWeight: 800, marginBottom: 10, color: INK }}>管理员登录</h2>
          <p style={{ color: MUTED, fontSize: '0.82rem', lineHeight: 1.7, textAlign: 'center', margin: '0 0 18px' }}>
            管理后台不再使用独立管理密码。请用已授予管理员权限的手机号或邮箱登录。
          </p>
          <Link to="/login?redirect=%2Fadmin"
            style={{ display: 'block', width: '100%', padding: '12px', borderRadius: 10, textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box', background: INK, color: BG, fontWeight: 800, fontSize: '0.9rem' }}>
            前往账号登录
          </Link>
          {error && <p style={{ textAlign: 'center', color: '#b91c1c', fontSize: '0.82rem', marginTop: 12 }}>{error}</p>}
        </div>
      </div>
    </div>
  );

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: '0 0 auto',
    minHeight: 38,
    padding: '0 13px',
    borderRadius: 8,
    border: active ? `1px solid ${INK}` : `1px solid ${LINE}`,
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 700,
    background: active ? INK : SURFACE,
    color: active ? BG : MUTED,
    whiteSpace: 'nowrap',
  });

  const subTabStyle = (active: boolean): React.CSSProperties => ({
    flex: '0 0 auto',
    minHeight: 32,
    padding: '0 10px',
    borderRadius: 7,
    border: 'none',
    cursor: 'pointer',
    background: active ? 'rgba(217,168,87,0.18)' : 'transparent',
    color: active ? '#8a5a19' : MUTED,
    fontSize: '0.78rem',
    fontWeight: active ? 900 : 700,
    whiteSpace: 'nowrap',
  });

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
        <section style={{ minWidth: 0, display: 'grid', gap: 14 }}>
            <div style={{ ...card, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '1.02rem', marginBottom: 3 }}>审核工作台</div>
                <div style={{ color: MUTED, fontSize: '0.8rem' }}>先看用户提交了什么，再处理风险和结果。</div>
              </div>
              <div style={{ display: 'flex', gap: 14, color: MUTED, fontSize: '0.78rem', fontWeight: 800, flexWrap: 'wrap' }}>
                <span>待审 <strong style={{ color: '#b91c1c' }}>{pendingReviewItems.length}</strong></span>
                <span>需关注 <strong style={{ color: '#c2410c' }}>{highRiskCount}</strong></span>
                <span>今日处理 <strong style={{ color: '#166534' }}>{reviewedToday}</strong></span>
              </div>
            </div>

            <div className="admin-tabs" style={{ display: 'grid', gap: 7, padding: 8, backgroundColor: 'rgba(255,255,255,0.72)', border: `1px solid ${LINE}`, borderRadius: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {primaryGroups.map(item => (
                  <button key={item.group} style={tabStyle(activeGroup === item.group)} onClick={() => setTab(item.tab)}>
                    {item.label}{typeof item.count === 'number' && item.count > 0 ? ` (${item.count})` : ''}
                  </button>
                ))}
              </div>
              {!['all', 'history'].includes(activeGroup) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, paddingTop: 6, borderTop: `1px solid ${LINE}` }}>
                  {groupTabs[activeGroup as Exclude<AdminGroup, 'all' | 'history'>].map(item => (
                    <button key={item.tab} style={subTabStyle(tab === item.tab)} onClick={() => setTab(item.tab)}>
                      {item.label}{typeof item.count === 'number' && item.count > 0 ? ` ${item.count}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: 0 }}>{error}</p>}

            {loading ? (
              <div style={{ ...card, textAlign: 'center', padding: '72px 0' }}>
                <div style={{ width: 36, height: 36, border: '2px solid rgba(201,146,46,0.3)', borderTopColor: GOLD, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ color: MUTED }}>加载中...</p>
              </div>
            ) : (
              <>
            {tab === 'siteData' && (
              <div style={{ ...card, padding: 18 }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 900, fontSize: '1rem', color: INK }}>网站数据总览</div>
                  <div style={{ marginTop: 4, color: MUTED, fontSize: '0.8rem' }}>这里是已经存在或已经发布的数据；新提交仍在各审核分组处理。</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                  {[
                    { label: '账号', value: profilesTotal, next: 'accounts' as Tab },
                    { label: 'DM档案', value: publishedDmDossiers.length, next: 'publishedDmDossiers' as Tab },
                    { label: '店家档案', value: publishedStoreDossiers.length, next: 'publishedStoreDossiers' as Tab },
                    { label: '已发布榜单', value: approvedRankings.length, next: 'publishedRankings' as Tab },
                  ].map(item => (
                    <button key={item.label} onClick={() => setTab(item.next)} style={{ minHeight: 84, padding: '14px 16px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fffdf8', color: INK, cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ color: MUTED, fontSize: '0.78rem', fontWeight: 800 }}>{item.label}</div>
                      <div style={{ marginTop: 5, fontSize: '1.55rem', lineHeight: 1, fontWeight: 900 }}>{item.value}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {['publishedDmDossiers', 'publishedStoreDossiers'].includes(tab) && (
              <ListEmpty empty={visiblePublishedDossiers.length === 0} text={tab === 'publishedStoreDossiers' ? '暂无店家档案' : '暂无DM档案'}>
                {visiblePublishedDossiers.map(item => {
                  const isStore = item.entity_type === 'store';
                  const href = isStore ? `/stores/${item.id}` : `/dm/${item.id}`;
                  const employer = !isStore && item.employer_store_id
                    ? publishedStoreDossiers.find(store => store.id === item.employer_store_id)?.dm_name
                    : null;
                  return (
                    <Row key={item.id} accent={isStore ? '#38bdf8' : '#f472b6'}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <TitleLine title={item.dm_name} pill={isStore ? '店家档案' : 'DM档案'} />
                        <Meta>
                          {item.city || '城市未填写'}
                          {item.workplace ? ` · ${item.workplace}` : ''}
                          {employer ? ` · 任职：${employer}` : ''}
                        </Meta>
                      </div>
                      <Actions>
                        <Link to={href} target="_blank" style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${LINE}`, background: SURFACE, color: INK, fontSize: '0.82rem', textDecoration: 'none', fontWeight: 800 }}>查看档案</Link>
                      </Actions>
                    </Row>
                  );
                })}
              </ListEmpty>
            )}

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
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ ...card, padding: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    value={accountSearch}
                    onChange={event => { setAccountSearch(event.target.value); setAccountPage(1); }}
                    placeholder="搜索手机号、邮箱、微信昵称或公开昵称"
                    style={{ flex: '1 1 280px', minWidth: 0, height: 40, padding: '0 12px', borderRadius: 8, border: `1px solid ${LINE}`, background: SURFACE, color: INK, fontSize: '0.86rem' }}
                  />
                  <span style={{ color: MUTED, fontSize: '0.8rem', fontWeight: 800 }}>
                    {accountsLoading ? '加载中...' : `共 ${profilesTotal} 个账号`}
                  </span>
                </div>
                <ListEmpty empty={!accountsLoading && accountProfiles.length === 0} text={accountSearch.trim() ? '没有匹配账号' : '暂无可管理账号'}>
                  {accountProfiles.map(p => (
                  <Row key={p.id}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{profileAccountSummary(p)}</span>
                        {p.is_realname && <span style={{ fontSize: '0.72rem', color: GOLD }}>⭐ 实名</span>}
                        {!p.is_visible && !p.reject_reason && <span style={{ fontSize: '0.72rem', color: '#925f18' }}>待审</span>}
                        {p.reject_reason && !p.is_merged && <span style={{ fontSize: '0.72rem', color: '#b91c1c' }}>已驳回</span>}
                        {p.is_merged
                          ? <span style={{ fontSize: '0.72rem', color: '#475569' }}>已合并</span>
                          : p.is_banned && <span style={{ fontSize: '0.72rem', color: '#b91c1c' }}>{p.restriction_scope === 'account' ? '账号受限' : '限制发布'}</span>}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: MUTED }}>
                        昵称：{profileNickname(p)} · 注册于 {p.created_at?.slice(0, 10)}
                        {profileAuthProviderLabel(p.auth_provider) && ` · ${profileAuthProviderLabel(p.auth_provider)}`}
                        {p.banned_at ? ` · 限制于 ${p.banned_at.slice(0, 10)}` : ''}
                        {p.restriction_ends_at ? ` · 至 ${p.restriction_ends_at.slice(0, 16).replace('T', ' ')}` : ''}
                        {p.merged_at ? ` · 合并于 ${p.merged_at.slice(0, 10)}` : ''}
                      </div>
                      {p.reject_reason && !p.is_merged && <Proof>驳回原因：{p.reject_reason}</Proof>}
                      {p.ban_reason && <Proof>{p.is_merged ? '账号状态' : '限制原因'}：{p.ban_reason}</Proof>}
                    </div>
                    <Actions>
                      <Link to={`/explore/${p.id}`} target="_blank" style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(217,168,87,0.30)', background: '#fff8e8', color: '#8a5a19', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 700 }}>主页</Link>
                      <ActionButton onClick={() => toggleRealname(p.id, !p.is_realname)}>{p.is_realname ? '取消实名' : '设为实名'}</ActionButton>
                      <ActionButton onClick={() => setPrivateAccountView({ profile: p, reason: '', loading: false, error: '', details: null })}>查看完整账号</ActionButton>
                      {!p.is_merged && (p.is_banned
                        ? <ActionButton kind="ok" onClick={() => unbanProfile(p.id)}>解除限制</ActionButton>
                        : <ActionButton kind="bad" onClick={() => banProfile(p.id)}>限制账号</ActionButton>)}
                      <ActionButton kind="bad" onClick={() => hideProfile(p.id)}>下线</ActionButton>
                    </Actions>
                  </Row>
                  ))}
                </ListEmpty>
                {accountTotalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
                    <ActionButton onClick={() => setAccountPage(page => Math.max(1, page - 1))} disabled={accountPage <= 1 || accountsLoading}>上一页</ActionButton>
                    <span style={{ color: MUTED, fontSize: '0.82rem', fontWeight: 800 }}>{accountPage} / {accountTotalPages}</span>
                    <ActionButton onClick={() => setAccountPage(page => Math.min(accountTotalPages, page + 1))} disabled={accountPage >= accountTotalPages || accountsLoading}>下一页</ActionButton>
                  </div>
                )}
              </div>
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
                      <TitleLine title={`充值 ${tx.amount} 榜金`} pill="钱包充值" />
                      <Meta>
                        用户：{tx.lc_profiles?.display_name || '未知用户'}
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

            {tab === 'servicePurchases' && (
              <ListEmpty empty={servicePurchases.length === 0} text="暂无付费服务记录">
                {servicePurchases.map(item => {
                  const awaitingSubmission = item.status === 'paid'
                    && item.submission_status === 'not_submitted'
                    && item.product_type !== 'provider_contact';
                  return (
                    <Row key={item.id} accent={awaitingSubmission ? '#b45309' : item.status === 'paid' ? '#15803d' : '#64748b'}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <TitleLine
                          title={`${serviceProductLabel(item.product_type)} · ${item.target_name || '未知对象'}`}
                          pill={servicePurchaseStatusLabel(item.status)}
                        />
                        <Meta>
                          用户：{item.profile_name || item.profile_id}
                          {` · ¥${(item.amount_fen / 100).toFixed(2)}`}
                          {item.paid_at ? ` · 支付于 ${item.paid_at.slice(0, 16).replace('T', ' ')}` : ` · 创建于 ${item.created_at.slice(0, 16).replace('T', ' ')}`}
                        </Meta>
                        <Proof>
                          业务状态：{serviceSubmissionStatusLabel(item.submission_status)}
                          {item.submission_id ? ` · 关联审核 ${item.submission_id}` : ''}
                        </Proof>
                        {awaitingSubmission && (
                          <ReviewNotice tone="gold">
                            {item.product_type === 'provider_listing'
                              ? '款项已经确认，但支付完成后没有生成审核记录。可从服务器找回已上传主图并由管理员补录缺失信息。'
                              : '款项已经确认，但用户尚未完成资料提交。付款资格会永久保留，请让用户回到原页面补交，不要重复收费。'}
                          </ReviewNotice>
                        )}
                        {item.status === 'refunded' && item.refund_reason && <ContentBox>退款说明：{item.refund_reason}</ContentBox>}
                      </div>
                      {awaitingSubmission && item.product_type === 'provider_listing' && (
                        <Actions>
                          <ActionButton kind="ok" onClick={() => void openProviderListingRecovery(item)}>找回资料并审核</ActionButton>
                        </Actions>
                      )}
                      {item.submission_status === 'pending' && item.submission_id && (
                        <Actions vertical>
                          <ActionButton kind="ok" onClick={() => approvePublicReview(item.submission_id!)}>通过并公开</ActionButton>
                          <ActionButton kind="bad" onClick={() => openRejectModal(item.submission_id!, 'publicReview')}>驳回修改</ActionButton>
                        </Actions>
                      )}
                    </Row>
                  );
                })}
              </ListEmpty>
            )}

            {tab === 'rankings' && (
              <ListEmpty empty={rankings.length === 0} text="暂无待审核的红黑榜帖子">
                {rankings.some(item => item.moderation_precheck?.decision === 'pass' && !item.dm_employment_status_suggestion) && (
                  <div style={{ ...card, marginBottom: 10, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div><strong>安全预审通过</strong><div style={{ marginTop: 3, color: MUTED, fontSize: '0.78rem' }}>仅批量处理无风险、无 DM 任职变更且档案已公开的帖子。</div></div>
                    <ActionButton kind="ok" disabled={rankingBatchLoading} onClick={() => void approveSafeRankings()}>{rankingBatchLoading ? '处理中...' : '批量通过安全项'}</ActionButton>
                  </div>
                )}
                {rankings.map(r => {
                  const linkedDossier = [...dossierOptions, ...dmDossiers].find(item => item.id === r.subject_dossier_id);
                  const linkedDossierPending = !!r.subject_dossier_id && !dossierOptions.some(item => item.id === r.subject_dossier_id);
                  const suggestedEmployer = dossierOptions.find(item => item.id === r.dm_employer_store_id_suggestion);
                  return (
                  <Row key={r.id} accent={r.type === 'red' ? '#dc2626' : r.type === 'black' ? '#475569' : '#d9a857'}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={r.subject_name} pill={r.type === 'red' ? '🏅 红榜' : r.type === 'black' ? '👎 黑榜' : '✨ 白榜'} />
                      <Meta>{SUBJECT_LABEL[r.subject_type] || r.subject_type} · {r.subject_city || '未知'} · 作者：{r.author_name} · {r.initial_amount === 0 ? '免费发布' : `历史初始：${r.initial_amount} 榜金`} · {r.created_at?.slice(0, 10)}</Meta>
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
                      <AdminRankingPublicImages rankingId={r.id} files={r.display_files || []} onMovePrivate={moveRankingImageToEvidence} />
                      <AdminRankingPrivateEvidence rankingId={r.id} files={r.private_evidence_files || []} onPreparePublic={openRankingEvidencePublish} />
                      {!!r.files?.length && <AdminRankingLegacyEvidence rankingId={r.id} files={r.files} onAdopt={adoptLegacyRankingEvidence} />}
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

            {tab === 'rankingEdits' && (
              <ListEmpty empty={rankingEditRequests.length === 0} text="暂无待审核的口碑修改或恢复申请">
                {rankingEditRequests.map(item => {
                  const snapshot = item.before_snapshot || {};
                  const isRestore = item.request_kind === 'restore';
                  return (
                    <Row key={item.id} accent={isRestore ? '#15803d' : '#2563eb'}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <TitleLine title={String(snapshot.subject_name || '未命名口碑')} pill={isRestore ? '申请恢复公开' : '原作者修改'} />
                        <Meta>
                          {rankingTypeLabel(String(snapshot.type || ''))} · {SUBJECT_LABEL[String(snapshot.subject_type || '')] || String(snapshot.subject_type || '未知对象')}
                          {snapshot.subject_city ? ` · ${String(snapshot.subject_city)}` : ''}
                          {snapshot.author_name ? ` · 发布人：${String(snapshot.author_name)}` : ''}
                          {item.created_at ? ` · ${item.created_at.slice(0, 10)}` : ''}
                        </Meta>
                        <ModerationPrecheckBadge value={item.moderation_precheck} />
                        {isRestore ? (
                          <ReviewSection title="申请恢复的原帖">
                            <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: INK, fontSize: '0.84rem', lineHeight: 1.7 }}>{String(snapshot.content || '')}</p>
                            <p style={{ margin: '8px 0 0', color: MUTED, fontSize: '0.76rem', lineHeight: 1.55 }}>通过后重新公开；黑榜会从恢复日重新计算 30 天公开期。</p>
                          </ReviewSection>
                        ) : (
                          <div style={{ display: 'grid', gap: 9, marginTop: 10 }}>
                            {(item.changes || []).map(change => (
                              <ReviewSection key={change.field} title={change.label || change.field}>
                                <div className="ranking-edit-compare" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                                  <div style={{ minWidth: 0, borderRadius: 7, padding: 9, background: '#fff5f5', color: '#7f1d1d', fontSize: '0.78rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                    <strong style={{ display: 'block', marginBottom: 4 }}>原版</strong>
                                    <s>{rankingEditValueText(change.before)}</s>
                                  </div>
                                  <div style={{ minWidth: 0, borderRadius: 7, padding: 9, background: '#f0fdf4', color: '#166534', fontSize: '0.78rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                    <strong style={{ display: 'block', marginBottom: 4 }}>修改版</strong>
                                    {rankingEditValueText(change.after)}
                                  </div>
                                </div>
                              </ReviewSection>
                            ))}
                          </div>
                        )}
                      </div>
                      <Actions vertical>
                        <ActionButton kind="ok" onClick={() => void approveRankingEdit(item.id)}>{isRestore ? '恢复公开' : '通过修改'}</ActionButton>
                        <ActionButton kind="bad" onClick={() => openRejectModal(item.id, 'rankingEdit')}>驳回</ActionButton>
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
                      <AdminRankingPublicImages rankingId={r.id} files={r.display_files || []} onMovePrivate={moveRankingImageToEvidence} />
                      <AdminRankingPrivateEvidence rankingId={r.id} files={r.private_evidence_files || []} onPreparePublic={openRankingEvidencePublish} />
                      {!!r.files?.length && <AdminRankingLegacyEvidence rankingId={r.id} files={r.files} onAdopt={adoptLegacyRankingEvidence} />}
                    </div>
                    <Actions vertical>
                      <ActionButton onClick={() => openRankingEdit(r)}>编辑并留痕</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {['publicReviews', 'dmDossierEdits', 'storeDossierEdits'].includes(tab) && (
              <ListEmpty empty={visiblePublicReviews.length === 0} text="暂无待审核内容">
                {visiblePublicReviews.map(item => {
                  const fallbackProfile = item.status === 'pending' ? profiles.find(profile => profile.id === item.profile_id) : undefined;
                  const details = summarizePublicReviewPayload(item.payload, fallbackProfile as Record<string, unknown> | undefined, dossierOptions);
                  const proofFiles = publicReviewProofFiles(item);
                  const waitingForDossierOwner = item.target_type === 'dossier_update' && item.payload?.owner_response_status === 'pending';
                  const displayedDetails = waitingForDossierOwner
                    ? details.filter(line => !line.startsWith('认领人状态'))
                    : details;
                  const sensitiveState = publicReviewSensitiveState(item);
                  const approvalBlocked = waitingForDossierOwner || sensitiveState.blocked;
                  const postReviewOnly = item.target_type === 'dossier_update' && item.payload?.review_mode === 'admin_post';
                  return (
                    <Row key={item.id} accent="#facc15">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <TitleLine title={item.title || publicReviewTypeLabel(item.target_type)} pill={publicReviewTypeLabel(item.target_type)} />
                        <Meta>
                          提交人：{item.profile_name || item.profile_id || '未知用户'}
                          {item.created_at ? ` · ${item.created_at.slice(0, 10)}` : ''}
                        </Meta>
                        {item.summary && displayedDetails.length === 0 && <ContentBox>{item.summary}</ContentBox>}
                        {waitingForDossierOwner && <ReviewNotice tone="gold">等待 DM 本人确认，管理员只读可见，不能代替本人通过。</ReviewNotice>}
                        {sensitiveState.warning && !waitingForDossierOwner && <ReviewNotice tone={sensitiveState.blocked ? 'red' : 'gold'}>{sensitiveState.warning}</ReviewNotice>}
                        {displayedDetails.length > 0 && (
                          <ReviewSection title={item.target_type === 'profile_update' || item.target_type === 'dossier_update' ? '修改对比' : '提交内容'}>
                            {displayedDetails.map(line => <ReviewDetailLine key={line} line={line} />)}
                          </ReviewSection>
                        )}
                        {proofFiles.length > 0 && <ReviewSection title="上传材料">
                          <AdminAttachmentLinks files={proofFiles} compact />
                        </ReviewSection>}
                        <ModerationPrecheckBadge value={item.moderation_precheck} />
                      </div>
                      <Actions vertical>
                        <ActionButton kind="ok" disabled={approvalBlocked} onClick={() => approvePublicReview(item.id)}>{waitingForDossierOwner ? '等待认领人确认' : sensitiveState.blocked ? '敏感资料不可公开' : postReviewOnly ? '确认保留' : sensitiveState.sensitiveFields.length > 0 && item.payload?.owner_response_status !== 'agreed' && !item.payload?.submitter_is_owner ? '通过其他资料' : '通过并公开'}</ActionButton>
                        <ActionButton kind="bad" onClick={() => openRejectModal(item.id, 'publicReview')}>{postReviewOnly ? '驳回并回滚' : '拒绝'}</ActionButton>
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
                        {` · ${item.price || 0} 榜金`}
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

            {tab === 'commissionApplications' && (
              <ListEmpty empty={commissionApplications.length === 0 && providerInquiries.length === 0} text="暂无委托私信">
                {providerInquiries.map(item => (
                  <Row key={`provider-${item.id}`} accent={item.status === 'accepted' ? '#16a34a' : item.status === 'rejected' ? '#94a3b8' : '#275389'}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={`${item.requester_name} → ${item.provider_name}`} pill={item.status === 'accepted' ? '已同意联系' : item.status === 'rejected' ? '已拒绝' : '待委托师处理'} />
                      <Meta>
                        委托条咨询
                        {item.created_at ? ` · ${item.created_at.slice(0, 10)}` : ''}
                      </Meta>
                      <ContentBox>{item.message}</ContentBox>
                      <Meta>管理员可查看申请内容和处理状态；双方联系方式不在后台列表接口返回。</Meta>
                    </div>
                  </Row>
                ))}
                {commissionApplications.map(item => (
                  <Row key={item.id} accent={item.status === 'accepted' ? '#16a34a' : item.status === 'rejected' ? '#94a3b8' : '#d9a857'}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={item.commission?.title || '委托已删除'} pill={item.status === 'accepted' ? '已同意' : item.status === 'rejected' ? '已拒绝' : '待委托人处理'} />
                      <Meta>
                        申请人：{item.applicant_is_realname ? `⭐ ${item.applicant_name}` : item.applicant_name}
                        {item.commission?.poster_name ? ` · 委托人：${item.commission.poster_name}` : ''}
                        {item.commission?.city ? ` · ${item.commission.city}` : ''}
                        {item.created_at ? ` · ${item.created_at.slice(0, 10)}` : ''}
                      </Meta>
                      <ContentBox>{item.letter}</ContentBox>
                      <Meta>管理员可查看申请内容和处理状态，但双方联系方式始终不在后台接口返回。</Meta>
                    </div>
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
                          {` · 奖励：${item.reward_amount || 0} 榜金`}
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

            {['dmDossiers', 'storeDossiers'].includes(tab) && (
              <ListEmpty empty={visibleDossiers.length === 0} text="暂无待审核档案或认领申请">
                {visibleDossiers.map(item => {
                  const entityType = item.entity_type === 'store' ? 'store' : 'dm';
                  const entityLabel = entityType === 'store' ? '店家' : 'DM';
                  const profileHref = normalizeAdminUrl(item.profile_url);
                  return (
                  <Row key={item.id} accent={entityType === 'store' ? '#38bdf8' : '#f472b6'}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={item.dm_name} pill={item.status === 'pending' ? `${entityLabel}建档` : `${entityLabel}认领`} />
                      <Meta>
                        {[item.city || '城市未填', item.workplace || (entityType === 'store' ? '地址未填' : '店家未填'), entityType === 'dm' && item.employment_status === 'freelance' ? '自由 DM' : '', `提交人：${item.submitted_by_name || '未知账号'}`, item.created_at ? item.created_at.slice(0, 16).replace('T', ' ') : '时间未知'].filter(Boolean).join(' · ')}
                        {profileHref && <> · <a href={profileHref} target="_blank" rel="noreferrer" style={{ color: '#275389', fontWeight: 850, textDecoration: 'none' }}>个人主页</a></>}
                      </Meta>
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
                      {((item.photo_files || []).length > 0 || item.photo_url) && <ReviewSection title="待审照片">
                        <AdminAttachmentLinks files={(item.photo_files || []).length > 0 ? item.photo_files || [] : [{ name: `${item.dm_name}照片`, url: item.photo_url || '', type: 'image/*' }]} compact />
                      </ReviewSection>}
                      {item.note && <ReviewSection title="补充说明">{item.note}</ReviewSection>}
                      {item.tags && item.tags.length > 0 && <TagCloud tags={item.tags} />}
                      <ModerationPrecheckBadge value={item.moderation_precheck} />
                      {item.status === 'pending' && (
                        <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${LINE}`, display: 'grid', gap: 6 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 900, color: INK }}>相似{entityLabel}候选</div>
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

            {tab === 'dmWithdrawals' && (
              <ListEmpty empty={dmIdentityWithdrawals.length === 0} text="暂无待审核的 DM 认证撤销申请">
                {dmIdentityWithdrawals.map(item => (
                  <Row key={item.id} accent="#fb7185">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={item.dm_dossier?.dm_name || 'DM档案'} pill="认证撤销" />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', columnGap: 20, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, marginTop: 12 }}>
                        <AdminDetail label="申请账号" value={profileAccountById(profiles, item.profile_id)} />
                        <AdminDetail label="城市" value={item.dm_dossier?.city || '未填写'} />
                        <AdminDetail label="当前档案店家" value={item.dm_dossier?.workplace || '无已确认店家'} />
                        <AdminDetail label="档案认领状态" value={item.dm_dossier?.claim_status || '未知'} />
                        <AdminDetail label="申请时间" value={item.created_at ? item.created_at.slice(0, 19).replace('T', ' ') : '未知'} />
                      </div>
                      <div style={{ marginTop: 14, fontSize: '0.82rem', fontWeight: 900, color: INK }}>撤销原因</div>
                      <ContentBox>{item.reason}</ContentBox>
                      <Proof>通过后保留这份 DM 档案、全部评分和任职历史；解除账号绑定，结束当前及待确认任职关系。若账号没有其他已认证 DM 档案，同时取消账号的 DM 身份认证。</Proof>
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => reviewDmIdentityWithdrawal(item.id, 'approve')}>确认撤销</ActionButton>
                      <ActionButton kind="bad" onClick={() => reviewDmIdentityWithdrawal(item.id, 'reject')}>拒绝申请</ActionButton>
                    </Actions>
                  </Row>
                ))}
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
                        <ReviewSection title="玩家评价">
                          <div>{item.content}</div>
                          {item.tags && item.tags.length > 0 && <div style={{ marginTop: 5 }}>标签：{item.tags.join(' / ')}</div>}
                        </ReviewSection>
                        {(typeof abuse.risk_score === 'number' || abuseLabels.length > 0) && (
                          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(194,65,12,0.26)', background: '#fff7ed', color: '#7c2d12', fontSize: '0.76rem', lineHeight: 1.6 }}>
                            <strong>反刷检查：风险 {abuse.risk_score || 0}</strong>
                            {abuseLabels.length > 0 ? ` · ${abuseLabels.join(' / ')}` : ''}
                            <div style={{ color: 'rgba(71,85,105,0.88)' }}>
                              账号近1小时 {abuse.account_hour_count || 0} 条 · 近24小时 {abuse.account_day_count || 0} 条 · 同IP近1小时 {abuse.ip_hour_count || 0} 条 · 重复文本 {abuse.duplicate_content_count || 0} 条
                            </div>
                          </div>
                        )}
                        <ModerationPrecheckBadge value={item.moderation_precheck} />
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
                      <TitleLine title={r.target_title || r.target_id} pill={r.target_type === 'dm_affiliation' ? '任职异议' : r.target_type === 'carpool' ? '拼车举报' : '举报'} />
                      <Meta>
                        举报人：{r.reporter_name}
                        {` · 原因：${r.reason}`}
                        {r.target_sub_id ? ` · 精确位置：${r.target_sub_id}` : ''}
                        {r.report_group_count && r.report_group_count > 1 ? ` · 同对象有效举报 ${r.report_group_count}` : ''}
                        {r.created_at ? ` · ${r.created_at.slice(0, 10)}` : ''}
                      </Meta>
                      {(r.auto_action === 'temporary_hidden' || r.auto_action === 'queued_priority') && (
                        <Proof>
                          {r.auto_action === 'temporary_hidden' ? '历史自动处置记录：曾临时折叠' : '历史自动处置记录：曾进入优先复核'}
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
                      {r.target_type === 'dm_affiliation' && <AdminPrivateClaimProofs claimId={r.id} files={r.evidence_files || []} route="affiliation" />}
                      {r.target_type !== 'dm_affiliation' && <AdminPrivateModerationEvidence recordId={r.id} files={r.evidence_files || []} kind="report" />}
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
                      <ActionButton kind="bad" onClick={() => resolveReport(r.id, 'resolved', true)}>{r.target_type === 'dm_affiliation' ? '确认异议并解除关联' : '下架并处理'}</ActionButton>
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
                      {m.payment_purchase_id && <Meta>关联付费记录：{m.payment_purchase_id}</Meta>}
                      <AdminPrivateModerationEvidence recordId={m.id} files={m.evidence_files || []} kind="feedback" />
                      {m.evidence_urls && m.evidence_urls.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                          {m.evidence_urls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" style={{ color: '#275389', fontSize: 12, fontWeight: 800 }}>查看图片 {index + 1}</a>)}
                        </div>
                      )}
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => resolveSiteMessage(m.id)}>回复并处理</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'accountAppeals' && (
              <ListEmpty empty={accountAppeals.length === 0} text="暂无待处理账号申诉">
                {accountAppeals.map(item => (
                  <Row key={item.id} accent="#b45309">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine
                        title={item.profile_name || '未知用户'}
                        pill={item.status === 'needs_info' ? '等待用户补充' : '账号申诉'}
                      />
                      <Meta>
                        {item.restriction?.scope === 'account' ? '账号功能限制' : '发布限制'}
                        {item.restriction?.starts_at ? ` · 开始于 ${item.restriction.starts_at.slice(0, 16).replace('T', ' ')}` : ''}
                        {item.restriction?.ends_at ? ` · 至 ${item.restriction.ends_at.slice(0, 16).replace('T', ' ')}` : ' · 长期有效'}
                        {item.created_at ? ` · 申诉于 ${item.created_at.slice(0, 16).replace('T', ' ')}` : ''}
                      </Meta>
                      {item.restriction?.reason && <Proof>限制原因：{item.restriction.reason}</Proof>}
                      <ContentBox>{item.content}</ContentBox>
                      {item.admin_reply && <Proof>上次回复：{item.admin_reply}</Proof>}
                      {Array.isArray(item.evidence_urls) && item.evidence_urls.length > 0 && (
                        <AdminAttachmentLinks files={item.evidence_urls.map((url, index) => ({ name: `申诉材料 ${index + 1}`, url }))} />
                      )}
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => void reviewAccountAppeal(item.id, 'approved')}>通过并解除</ActionButton>
                      <ActionButton onClick={() => void reviewAccountAppeal(item.id, 'needs_info')}>要求补充</ActionButton>
                      <ActionButton kind="bad" onClick={() => void reviewAccountAppeal(item.id, 'rejected')}>维持限制</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'reviewHistory' && (
              <ListEmpty empty={historyEvents.length === 0} text="暂无审核历史">
                {historyEvents.map(event => {
                  const actionInfo = ADMIN_REVIEW_ACTIONS[event.action];
                  const publicReview = event.target_type === 'public_review' && event.target_id ? reviewHistoryById.get(event.target_id) : undefined;
                  const details = publicReview ? summarizePublicReviewPayload(publicReview.payload, undefined, dossierOptions) : [];
                  const proofFiles = publicReview ? publicReviewProofFiles(publicReview) : [];
                  const metadataLines = moderationHistoryMetadataLines(event.metadata);
                  const outcomeText = actionInfo.outcome === 'approved' ? '已通过' : actionInfo.outcome === 'rejected' ? '已拒绝' : '已处理';
                  const accent = actionInfo.outcome === 'approved' ? '#16a34a' : actionInfo.outcome === 'rejected' ? '#dc2626' : '#275389';
                  return (
                    <Row key={event.id} accent={accent}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <TitleLine title={publicReview?.title || actionInfo.label} pill={`${actionInfo.label} · ${outcomeText}`} />
                        <Meta>
                          审核人：{profileAccountById(profiles, event.actor_id)}
                          {event.created_at ? ` · ${event.created_at.slice(0, 19).replace('T', ' ')}` : ''}
                        </Meta>
                        {publicReview?.summary && <ContentBox>{publicReview.summary}</ContentBox>}
                        {details.length > 0 && (
                          <ReviewSection title={publicReview?.target_type === 'profile_update' || publicReview?.target_type === 'dossier_update' ? '修改对比' : '提交内容'}>
                            {details.map(line => <ReviewDetailLine key={line} line={line} />)}
                          </ReviewSection>
                        )}
                        {proofFiles.length > 0 && (
                          <ReviewSection title="上传材料">
                            <AdminAttachmentLinks files={proofFiles} compact />
                          </ReviewSection>
                        )}
                        {(publicReview?.review_note || metadataLines.length > 0) && (
                          <ReviewSection title="处理说明">
                            {publicReview?.review_note && <div>{publicReview.review_note}</div>}
                            {metadataLines.map(line => <div key={line}>{line}</div>)}
                          </ReviewSection>
                        )}
                      </div>
                    </Row>
                  );
                })}
              </ListEmpty>
            )}

            {tab === 'security' && (
              <div style={{ display: 'grid', gap: 14 }}>
                <section>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '0.98rem' }}>微信内容安全检查</h2>
                      <Meta>最近 200 条 · 仅保存检查结果和哈希，不复制用户原文</Meta>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      {wechatSafetyFilters.map(filter => (
                        <button
                          key={filter.value}
                          type="button"
                          onClick={() => setWechatSafetyFilter(filter.value)}
                          style={{
                            minHeight: 28,
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: `1px solid ${wechatSafetyFilter === filter.value ? 'rgba(31,41,55,0.42)' : LINE}`,
                            background: wechatSafetyFilter === filter.value ? INK : SURFACE,
                            color: wechatSafetyFilter === filter.value ? BG : MUTED,
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {filter.label} {wechatSafetyFilterCounts.get(filter.value) || 0}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => void refreshWechatSafety()}
                        disabled={wechatSafetyRefreshing}
                        style={{
                          minHeight: 28,
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: `1px solid ${LINE}`,
                          background: SURFACE,
                          color: MUTED,
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          cursor: wechatSafetyRefreshing ? 'wait' : 'pointer',
                          opacity: wechatSafetyRefreshing ? 0.58 : 1,
                        }}
                      >
                        {wechatSafetyRefreshing ? '刷新中' : '刷新'}
                      </button>
                    </div>
                  </div>
                  {wechatSafetyError && <Proof>{wechatSafetyError}</Proof>}
                  <ListEmpty empty={visibleWechatContentChecks.length === 0} text={wechatSafetyFilter === 'attention' ? '暂无需要处理的微信安全记录' : '这个分类暂无检查记录'}>
                    {visibleWechatContentChecks.map(item => {
                      const presentation = wechatSafetyStatusPresentation(
                        item.status,
                        item.check_type,
                        item.created_at,
                      );
                      return (
                        <Row key={item.id} accent={presentation.accent}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <TitleLine
                              title={`${item.check_type === 'image' ? '图片' : '文字'} · ${item.business_scene}`}
                              pill={presentation.label}
                            />
                            <Meta>
                              用户：{item.profile_name || item.profile_id || '未知'}
                              {item.target_type ? ` · 对象：${item.target_type}/${item.target_id || '-'}` : ''}
                              {item.label !== null && item.label !== undefined ? ` · 标签：${item.label}` : ''}
                              {item.created_at ? ` · ${item.created_at.slice(0, 19).replace('T', ' ')}` : ''}
                            </Meta>
                            {(item.error_message || item.errcode) && (
                              <Proof>{item.error_message || '接口返回异常'}{item.errcode ? `（${item.errcode}）` : ''}</Proof>
                            )}
                            {presentation.note && <Proof>{presentation.note}</Proof>}
                            {item.trace_id && <Meta>微信 trace_id：{item.trace_id}</Meta>}
                          </div>
                        </Row>
                      );
                    })}
                  </ListEmpty>
                </section>
                <section>
                  <h2 style={{ margin: '0 0 8px', fontSize: '0.98rem' }}>平台安全日志</h2>
                  <ListEmpty empty={securityEvents.length === 0} text="暂无安全日志">
                    {securityEvents.map(event => (
                      <Row key={event.id} accent="#fb923c">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <TitleLine title={securityActionLabel(event.action)} pill={event.actor_role || 'unknown'} />
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
                </section>
              </div>
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

            {['dmCerts', 'storeCerts', 'realnameCerts'].includes(tab) && (
              <ListEmpty empty={visibleCerts.length === 0} text="暂无待审核认证">
                {visibleCerts.map(c => (
                  <Row key={c.id} accent="#3b82f6">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine
                        title={c.lc_profiles?.display_name || '未知用户'}
                        pill={certificationTypeLabel(c.type)}
                      />
                      <Meta>
                        用户：{c.lc_profiles?.display_name || '未知用户'}
                        {c.created_at ? ` · ${c.created_at.slice(0, 10)}` : ''}
                      </Meta>
                      {c.description && <ContentBox>{c.description}</ContentBox>}
                      {c.type === 'realname' && <Meta>身份证材料应已带“仅用于剧幕录实名认证”水印；审核通过后只给前台实名标识，不公开证件。</Meta>}
                      <ReviewSection title="上传材料">
                        <AdminAttachmentLinks files={c.files || []} emptyText="没有上传图片或附件" compact />
                      </ReviewSection>
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
      </div>

      {privateAccountView && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(31,41,55,0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 20 }}>
          <div style={{ backgroundColor: SURFACE, border: `1px solid ${LINE}`, borderRadius: 12, padding: 22, width: '100%', maxWidth: 480, boxShadow: '0 28px 80px rgba(31,41,55,0.22)' }}>
            <h3 style={{ margin: 0, color: INK, fontSize: '1.05rem' }}>查看完整账号信息</h3>
            <p style={{ margin: '7px 0 16px', color: MUTED, fontSize: '0.8rem', lineHeight: 1.65 }}>
              当前账号：{profileNickname(privateAccountView.profile)} · {profileAccountSummary(privateAccountView.profile)}。每次查看都会记录操作者、原因、时间和 IP。
            </p>
            {privateAccountView.details ? (
              <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fffdf8' }}>
                <AdminDetail label="手机号" value={privateAccountView.details.phone || '未绑定'} />
                <AdminDetail label="邮箱" value={privateAccountView.details.email || '未绑定'} />
                <AdminDetail label="微信号" value={privateAccountView.details.wechat || '未填写'} />
                <AdminDetail label="微信昵称" value={privateAccountView.details.wechat_nickname || '未绑定'} />
              </div>
            ) : (
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ color: INK, fontSize: '0.78rem', fontWeight: 850 }}>查看原因</span>
                <textarea
                  autoFocus
                  value={privateAccountView.reason}
                  onChange={event => setPrivateAccountView(current => current ? { ...current, reason: event.target.value, error: '' } : current)}
                  rows={3}
                  placeholder="例如：处理用户本人发起的账号申诉"
                  maxLength={200}
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 11, borderRadius: 8, border: `1px solid ${LINE}`, background: SURFACE, color: INK, fontSize: '0.86rem', lineHeight: 1.6 }}
                />
              </label>
            )}
            {privateAccountView.error && <p style={{ margin: '9px 0 0', color: '#b91c1c', fontSize: '0.78rem' }}>{privateAccountView.error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <ActionButton onClick={() => setPrivateAccountView(null)}>关闭</ActionButton>
              {!privateAccountView.details && <ActionButton kind="bad" disabled={privateAccountView.loading} onClick={() => void revealPrivateAccount()}>{privateAccountView.loading ? '读取中...' : '确认并留痕查看'}</ActionButton>}
            </div>
          </div>
        </div>
      )}

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

      {rankingEvidencePublish && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(31,41,55,0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 20 }}>
          <div className="ranking-evidence-editor-modal" style={{ backgroundColor: SURFACE, border: '1px solid rgba(39,83,137,0.20)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 960, maxHeight: '94vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(31,41,55,0.20)' }}>
            <h3 style={{ margin: 0, color: INK, fontSize: '1rem', fontWeight: 850 }}>处理后生成公开副本</h3>
            <p style={{ margin: '6px 0 14px', color: MUTED, fontSize: '0.76rem', lineHeight: 1.5 }}>
              直接在下方编辑副本。原始审核材料仍只保存在私密证据区，公开页面只显示编辑后的图片。
            </p>
            <div className="ranking-evidence-editor-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(250px, 0.75fr)', gap: 16, alignItems: 'start' }}>
              <div style={{ minWidth: 0 }}>
                {rankingEvidencePublish.sourceLoading && <div style={{ minHeight: 320, display: 'grid', placeItems: 'center', border: `1px solid ${LINE}`, borderRadius: 8, color: MUTED, fontSize: 12 }}>正在载入私密原图…</div>}
                {rankingEvidencePublish.sourceBlob && (
                  <RankingEvidenceEditor source={rankingEvidencePublish.sourceBlob} sourceName={rankingEvidencePublish.file.name} onChange={(processedFile, editActions) => {
                    setRankingEvidencePublish(current => current ? { ...current, processedFile, editActions, error: '' } : current);
                  }} />
                )}
              </div>
              <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
                <div style={{ padding: '9px 10px', border: '1px solid rgba(39,83,137,0.14)', borderRadius: 8, background: '#f8fbff', color: '#475569', fontSize: 11, lineHeight: 1.55 }}>
                  已编辑：{rankingEvidencePublish.editActions.length > 0 ? rankingEvidencePublish.editActions.join('、') : '尚未编辑'}
                </div>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ color: INK, fontSize: '0.76rem', fontWeight: 800 }}>处理说明</span>
                  <textarea value={rankingEvidencePublish.processingNote} onChange={event => setRankingEvidencePublish(current => current ? { ...current, processingNote: event.target.value, error: '' } : current)} rows={4}
                    placeholder="例如：已遮盖第三方手机号、微信号和头像"
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '9px 10px', border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', color: INK, fontSize: '0.78rem', lineHeight: 1.55 }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 10px', border: '1px solid rgba(39,83,137,0.14)', borderRadius: 8, background: '#f8fbff', color: '#334155', fontSize: '0.74rem', lineHeight: 1.5 }}>
                  <input type="checkbox" checked={rankingEvidencePublish.confirmed} onChange={event => setRankingEvidencePublish(current => current ? { ...current, confirmed: event.target.checked, error: '' } : current)} style={{ marginTop: 2 }} />
                  我已核对编辑后的图片，确认其中不含未获授权的第三方隐私或其他不应公开的信息。
                </label>
                {rankingEvidencePublish.error && <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.76rem' }}>{rankingEvidencePublish.error}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setRankingEvidencePublish(null)} disabled={rankingEvidencePublish.saving}
                    style={{ flex: 1, minHeight: 38, border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', color: MUTED, cursor: rankingEvidencePublish.saving ? 'not-allowed' : 'pointer', fontWeight: 750 }}>取消</button>
                  <button type="button" onClick={publishRankingEvidenceCopy} disabled={rankingEvidencePublish.saving || rankingEvidencePublish.sourceLoading}
                    style={{ flex: 1.5, minHeight: 38, border: 'none', borderRadius: 8, background: '#275389', color: '#fff', cursor: rankingEvidencePublish.saving ? 'not-allowed' : 'pointer', fontWeight: 850, opacity: rankingEvidencePublish.saving ? 0.6 : 1 }}>
                    {rankingEvidencePublish.saving ? '处理中…' : '确认公开副本'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {providerRecovery && (
        <div
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !providerRecovery.saving) setProviderRecovery(null);
          }}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(31,41,55,0.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 18 }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="provider-recovery-title"
            style={{ width: 'min(760px, 100%)', maxHeight: '94dvh', overflow: 'auto', borderRadius: 8, border: `1px solid ${LINE}`, background: SURFACE, boxShadow: '0 24px 80px rgba(15,23,42,0.26)' }}>
            <header style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ color: GOLD, fontSize: '0.72rem', fontWeight: 850 }}>异常支付订单恢复</div>
                <h3 id="provider-recovery-title" style={{ margin: '3px 0 0', color: INK, fontSize: '1.05rem' }}>{providerRecovery.profileName}的委托条</h3>
              </div>
              <button type="button" disabled={providerRecovery.saving} onClick={() => setProviderRecovery(null)}
                style={{ width: 32, height: 32, border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff', color: MUTED, cursor: providerRecovery.saving ? 'not-allowed' : 'pointer', fontSize: 18 }}>×</button>
            </header>
            <div style={{ padding: 18, display: 'grid', gap: 14 }}>
              {providerRecovery.loading ? (
                <div style={{ minHeight: 220, display: 'grid', placeItems: 'center', color: MUTED }}>正在找回已上传资料…</div>
              ) : (
                <>
                  <ReviewNotice tone="gold">
                    已付款但审核记录未生成。请先核对找回的原图并补录业务联系方式，再恢复为正式审核记录。
                  </ReviewNotice>
                  <div className="provider-recovery-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
                    <div style={{ minWidth: 0 }}>
                      {providerRecovery.posterUrl ? (
                        <a href={providerRecovery.posterUrl} target="_blank" rel="noreferrer" style={{ display: 'grid', gap: 6, color: '#275389', textDecoration: 'none', fontSize: '0.74rem', fontWeight: 800 }}>
                          <img src={providerRecovery.posterUrl} alt="找回的委托条主图"
                            style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 7, border: `1px solid ${LINE}`, background: '#fff' }} />
                          点击查看原图
                        </a>
                      ) : (
                        <div style={{ minHeight: 220, display: 'grid', placeItems: 'center', border: `1px dashed ${LINE}`, borderRadius: 7, color: MUTED, fontSize: '0.78rem' }}>未找到原图</div>
                      )}
                      {providerRecovery.posterUploadedAt && <Meta>上传于 {providerRecovery.posterUploadedAt.slice(0, 16).replace('T', ' ')}</Meta>}
                    </div>
                    <div style={{ display: 'grid', gap: 11, minWidth: 0 }}>
                      <label style={{ display: 'grid', gap: 5 }}>
                        <span style={{ color: INK, fontSize: '0.74rem', fontWeight: 800 }}>标题</span>
                        <input value={providerRecovery.headline} maxLength={80}
                          onChange={event => setProviderRecovery({ ...providerRecovery, headline: event.target.value, error: '' })}
                          style={{ minHeight: 36, padding: '7px 10px', border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff', color: INK, boxSizing: 'border-box' }} />
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                        <label style={{ display: 'grid', gap: 5 }}>
                          <span style={{ color: INK, fontSize: '0.74rem', fontWeight: 800 }}>身高（cm）</span>
                          <input type="number" min={100} max={250} step={1} value={providerRecovery.heightCm}
                            onChange={event => setProviderRecovery({ ...providerRecovery, heightCm: event.target.value, error: '' })}
                            style={{ minHeight: 36, padding: '7px 10px', border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff', color: INK, boxSizing: 'border-box', width: '100%' }} />
                        </label>
                        <label style={{ display: 'grid', gap: 5 }}>
                          <span style={{ color: INK, fontSize: '0.74rem', fontWeight: 800 }}>体重（kg）</span>
                          <input type="number" min={30} max={300} step={1} value={providerRecovery.weightKg}
                            onChange={event => setProviderRecovery({ ...providerRecovery, weightKg: event.target.value, error: '' })}
                            style={{ minHeight: 36, padding: '7px 10px', border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff', color: INK, boxSizing: 'border-box', width: '100%' }} />
                        </label>
                      </div>
                      <label style={{ display: 'grid', gap: 5 }}>
                        <span style={{ color: INK, fontSize: '0.74rem', fontWeight: 800 }}>擅长角色类型</span>
                        <input value={providerRecovery.roleTypesText} placeholder="用顿号或逗号分隔" maxLength={240}
                          onChange={event => setProviderRecovery({ ...providerRecovery, roleTypesText: event.target.value, error: '' })}
                          style={{ minHeight: 36, padding: '7px 10px', border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff', color: INK, boxSizing: 'border-box' }} />
                      </label>
                      <label style={{ display: 'grid', gap: 5 }}>
                        <span style={{ color: INK, fontSize: '0.74rem', fontWeight: 800 }}>业务联系方式 *</span>
                        <input value={providerRecovery.businessContact} placeholder="微信号、手机号或其他业务联系方式" maxLength={300}
                          onChange={event => setProviderRecovery({ ...providerRecovery, businessContact: event.target.value, error: '' })}
                          style={{ minHeight: 36, padding: '7px 10px', border: '1px solid rgba(180,83,9,0.42)', borderRadius: 6, background: '#fffbeb', color: INK, boxSizing: 'border-box' }} />
                      </label>
                    </div>
                  </div>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <span style={{ color: INK, fontSize: '0.74rem', fontWeight: 800 }}>委托说明</span>
                    <textarea value={providerRecovery.description} rows={3} maxLength={1200}
                      onChange={event => setProviderRecovery({ ...providerRecovery, description: event.target.value, error: '' })}
                      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff', color: INK, boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: INK, fontSize: '0.76rem', fontWeight: 750 }}>
                    <input type="checkbox" checked={providerRecovery.contactAvailable}
                      onChange={event => setProviderRecovery({ ...providerRecovery, contactAvailable: event.target.checked, error: '' })} />
                    允许付费用户解锁该联系方式
                  </label>
                  {providerRecovery.error && <div style={{ padding: '9px 10px', borderRadius: 6, background: '#fef2f2', color: '#b91c1c', fontSize: '0.76rem', lineHeight: 1.5 }}>{providerRecovery.error}</div>}
                </>
              )}
            </div>
            <footer style={{ padding: '12px 18px', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <ActionButton disabled={providerRecovery.saving} onClick={() => setProviderRecovery(null)}>取消</ActionButton>
              <ActionButton disabled={providerRecovery.loading || providerRecovery.saving || !providerRecovery.posterUrl} onClick={() => void submitProviderListingRecovery(false)}>
                {providerRecovery.saving ? '处理中…' : '恢复为待审'}
              </ActionButton>
              <ActionButton kind="ok" disabled={providerRecovery.loading || providerRecovery.saving || !providerRecovery.posterUrl} onClick={() => void submitProviderListingRecovery(true)}>
                {providerRecovery.saving ? '处理中…' : '恢复并通过'}
              </ActionButton>
            </footer>
          </section>
        </div>
      )}

      {rejectModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(31,41,55,0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: SURFACE, border: '1px solid rgba(217,168,87,0.24)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 28px 80px rgba(31,41,55,0.22)' }}>
            <h3 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 8, color: INK }}>{rejectModal.type === 'ranking' ? (rejectModal.revisionKind === 'evidence' ? '要求补证据' : '打回修改原因') : rejectModal.type === 'rankingEdit' ? '驳回修改 / 恢复申请' : '填写拒绝原因'}</h3>
            <p style={{ fontSize: '0.8rem', color: MUTED, marginBottom: 16 }}>
              {rejectModal.type === 'ranking'
                ? rejectModal.revisionKind === 'evidence'
                  ? '用户重新提交时必须至少上传一张证据图片；原帖和历史互动都会保留。'
                  : '用户可以修改原帖后重新提交，证据仍然选填；发布和重新提交都不扣榜金。'
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
        @media (max-width: 720px) {
          .ranking-edit-compare {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .ranking-evidence-editor-modal {
            padding: 14px !important;
            max-height: 96vh !important;
          }
          .ranking-evidence-editor-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .provider-recovery-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .admin-header-inner {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .admin-page-body {
            padding: 20px !important;
          }
          .admin-tabs {
            overflow: hidden !important;
          }
          .admin-tabs > div {
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
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
          .admin-review-diff {
            grid-template-columns: 68px minmax(0, 1fr) !important;
          }
          .admin-review-diff > :nth-child(3) {
            display: none !important;
          }
          .admin-review-diff > :nth-child(4) {
            grid-column: 2 !important;
          }
        }
      `}</style>
    </div>
  );
}

function Row({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="admin-row" style={{ ...card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, borderLeft: accent ? `3px solid ${accent}` : card.border }}>
      {children}
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode; vertical?: boolean }) {
  return <div className="admin-actions" style={{ display: 'flex', flexDirection: 'row', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{children}</div>;
}

function ActionButton({ children, onClick, kind, disabled }: { children: React.ReactNode; onClick: () => void; kind?: 'ok' | 'bad'; disabled?: boolean }) {
  const ok = kind === 'ok';
  const bad = kind === 'bad';
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ minHeight: 32, padding: '6px 10px', borderRadius: 6, border: `1px solid ${ok ? 'rgba(22,101,52,0.22)' : bad ? 'rgba(185,28,28,0.20)' : 'rgba(217,168,87,0.30)'}`, cursor: disabled ? 'not-allowed' : 'pointer', background: ok ? 'rgba(240,253,244,0.95)' : bad ? 'rgba(254,242,242,0.95)' : '#fff8e8', color: ok ? '#166534' : bad ? '#b91c1c' : '#8a5a19', fontWeight: 750, fontSize: '0.76rem', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap' }}>
      {children}
    </button>
  );
}

function AdminDetail({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0, padding: '6px 0' }}>
      <div style={{ color: MUTED, fontSize: '0.72rem', fontWeight: 800, marginBottom: 4 }}>{label}</div>
      <div style={{ color: INK, fontSize: '0.84rem', fontWeight: 850, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{children || value || '未填写'}</div>
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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: compact ? 0 : 7 }}>
      {valid.map(file => {
        const isImage = (file.type || '').startsWith('image/') || /\.(png|jpe?g|webp)(\?|$)/i.test(file.href || '') || (file.href || '').startsWith('/uploads/');
        const submittedName = String(file.name || '').trim();
        const displayName = submittedName && !normalizeAdminUrl(submittedName, true) && submittedName.length <= 80
          ? submittedName
          : `待审核图片 ${file.index + 1}`;
        if (isImage) return (
          <a key={`${file.href}-${file.index}`} href={file.href || '#'} target="_blank" rel="noreferrer"
            style={{ width: 112, maxWidth: '100%', display: 'grid', gap: 4, color: '#275389', fontSize: '0.7rem', fontWeight: 850, textDecoration: 'none' }}>
            <img src={file.href || ''} alt={displayName}
              style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>查看原图{valid.length > 1 ? ` ${file.index + 1}` : ''}</span>
          </a>
        );
        return (
          <a key={`${file.href}-${file.index}`} href={file.href || '#'} target="_blank" rel="noreferrer"
            style={{ padding: '7px 11px', borderRadius: 8, border: '1px solid rgba(39,83,137,0.22)', background: '#eff6ff', color: '#275389', fontSize: '0.78rem', fontWeight: 850, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            打开附件{valid.length > 1 ? ` ${file.index + 1}` : ''}
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

function AdminRankingPublicImages({ rankingId, files, onMovePrivate }: { rankingId: string; files: ProofFile[]; onMovePrivate: (rankingId: string, index: number) => void }) {
  return (
    <ReviewSection title="正文配图（通过后公开）">
      {files.length === 0 ? <Meta>没有公开配图</Meta> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 180px))', gap: 9 }}>
          {files.map((file, index) => (
            <div key={`${file.url}-${index}`} style={{ display: 'grid', gap: 5 }}>
              <a href={normalizeAdminUrl(file.url, true) || '#'} target="_blank" rel="noreferrer">
                <img src={normalizeAdminUrl(file.url, true) || ''} alt={file.name || `正文配图 ${index + 1}`} style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 7, border: `1px solid ${LINE}`, background: '#fff' }} />
              </a>
              <button type="button" onClick={() => onMovePrivate(rankingId, index)} style={{ minHeight: 30, border: '1px solid rgba(166,106,31,0.22)', borderRadius: 7, background: '#fffaf2', color: '#8a5a19', cursor: 'pointer', fontSize: 11, fontWeight: 850 }}>移出公开，转为审核材料</button>
            </div>
          ))}
        </div>
      )}
    </ReviewSection>
  );
}

function AdminRankingPrivateEvidence({ rankingId, files, onPreparePublic }: { rankingId: string; files: DossierClaimProof[]; onPreparePublic: (rankingId: string, file: DossierClaimProof) => void }) {
  return (
    <ReviewSection title="私密审核材料（仅管理员可见）">
      {files.length === 0 ? <Meta>没有私密审核材料</Meta> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 180px))', gap: 9 }}>
          {files.map((file, index) => <AdminRankingPrivateEvidenceImage key={file.id} rankingId={rankingId} file={file} index={index} onPreparePublic={onPreparePublic} />)}
        </div>
      )}
    </ReviewSection>
  );
}

function AdminRankingPrivateEvidenceImage({ rankingId, file, index, onPreparePublic }: { rankingId: string; file: DossierClaimProof; index: number; onPreparePublic: (rankingId: string, file: DossierClaimProof) => void }) {
  const [source, setSource] = useState('');
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    fetch(`${API}/lc/admin/rankings/${encodeURIComponent(rankingId)}/evidence/${encodeURIComponent(file.id)}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
      signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('审核材料读取失败');
      return response.blob();
    }).then(blob => {
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(reason => {
      if (reason?.name !== 'AbortError') setLoadError(reason instanceof Error ? reason.message : '审核材料读取失败');
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, rankingId]);
  if (loadError) return <div style={{ minHeight: 96, padding: 9, border: '1px solid rgba(185,28,28,0.18)', borderRadius: 7, background: '#fff', color: '#991b1b', fontSize: 11 }}>{loadError}</div>;
  if (!source) return <div style={{ minHeight: 96, display: 'grid', placeItems: 'center', border: `1px solid ${LINE}`, borderRadius: 7, background: '#fff', color: MUTED, fontSize: 11 }}>读取中…</div>;
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <a href={source} target="_blank" rel="noreferrer" style={{ display: 'block', color: '#275389', textDecoration: 'none' }}>
        <img src={source} alt={`审核材料 ${index + 1}`} style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 7, border: `1px solid ${LINE}`, background: '#fff' }} />
        <div style={{ overflow: 'hidden', marginTop: 4, fontSize: 10, fontWeight: 800, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name || `材料 ${index + 1}`}</div>
      </a>
      {file.public_copy ? (
        <a href={file.public_copy.url} target="_blank" rel="noreferrer" style={{ minHeight: 30, display: 'grid', placeItems: 'center', border: '1px solid rgba(22,101,52,0.18)', borderRadius: 7, background: '#f0fdf4', color: '#166534', fontSize: 11, fontWeight: 850, textDecoration: 'none' }}>已生成公开副本</a>
      ) : (
        <button type="button" onClick={() => onPreparePublic(rankingId, file)} style={{ minHeight: 30, border: '1px solid rgba(39,83,137,0.20)', borderRadius: 7, background: '#eff6ff', color: '#275389', cursor: 'pointer', fontSize: 11, fontWeight: 850 }}>打码后生成公开副本</button>
      )}
    </div>
  );
}

function AdminRankingLegacyEvidence({ rankingId, files, onAdopt }: { rankingId: string; files: ProofFile[]; onAdopt: (rankingId: string, index: number) => Promise<void> }) {
  return (
    <ReviewSection title="历史审核材料（原图仅后台可见）">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 180px))', gap: 9 }}>
        {files.map((file, index) => <AdminRankingLegacyEvidenceImage key={`${file.url}-${index}`} rankingId={rankingId} file={file} index={index} onAdopt={onAdopt} />)}
      </div>
    </ReviewSection>
  );
}

function AdminRankingLegacyEvidenceImage({ rankingId, file, index, onAdopt }: { rankingId: string; file: ProofFile; index: number; onAdopt: (rankingId: string, index: number) => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const href = normalizeAdminUrl(file.url, true) || '';
  const adopt = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await onAdopt(rankingId, index);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '旧版材料处理失败');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <a href={href || '#'} target="_blank" rel="noreferrer" style={{ color: '#275389', textDecoration: 'none' }}>
        <img src={href} alt={file.name || `历史材料 ${index + 1}`} style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 7, border: `1px solid ${LINE}`, background: '#fff' }} />
        <div style={{ overflow: 'hidden', marginTop: 4, fontSize: 10, fontWeight: 800, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name || `历史材料 ${index + 1}`}</div>
      </a>
      <button type="button" onClick={adopt} disabled={loading} style={{ minHeight: 30, border: '1px solid rgba(39,83,137,0.20)', borderRadius: 7, background: '#eff6ff', color: '#275389', cursor: loading ? 'wait' : 'pointer', fontSize: 11, fontWeight: 850 }}>
        {loading ? '读取中…' : '处理后公开'}
      </button>
      {error && <div style={{ color: '#991b1b', fontSize: 10, lineHeight: 1.4 }}>{error}</div>}
    </div>
  );
}

function AdminPrivateClaimProofs({ claimId, files, route = 'claim' }: { claimId: string; files: DossierClaimProof[]; route?: 'claim' | 'affiliation' }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 900, color: INK, marginBottom: 7 }}>私密身份凭证（仅管理员可见）</div>
      {files.length === 0 ? <Meta>没有可读取的凭证截图</Meta> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 180px))', gap: 9 }}>
          {files.map((file, index) => <AdminPrivateClaimProofImage key={file.id} claimId={claimId} file={file} index={index} route={route} />)}
        </div>
      )}
    </div>
  );
}

function AdminPrivateClaimProofImage({ claimId, file, index, route }: { claimId: string; file: DossierClaimProof; index: number; route: 'claim' | 'affiliation' }) {
  const [source, setSource] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    const proofPath = route === 'affiliation'
      ? `${API}/lc/admin/dm-affiliation-reports/${encodeURIComponent(claimId)}/proofs/${encodeURIComponent(file.id)}`
      : `${API}/lc/admin/dm-dossier-claims/${encodeURIComponent(claimId)}/proofs/${encodeURIComponent(file.id)}`;
    fetch(proofPath, {
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
  }, [claimId, file.id, route]);

  if (loadError) return <div style={{ minHeight: 96, padding: 9, border: '1px solid rgba(185,28,28,0.18)', borderRadius: 7, background: '#fff', color: '#991b1b', fontSize: 11 }}>{loadError}</div>;
  if (!source) return <div style={{ minHeight: 96, display: 'grid', placeItems: 'center', border: `1px solid ${LINE}`, borderRadius: 7, background: '#fff', color: MUTED, fontSize: 11 }}>读取中…</div>;
  return (
    <a href={source} target="_blank" rel="noreferrer" style={{ display: 'block', color: '#275389', textDecoration: 'none' }}>
      <img src={source} alt={`认领凭证 ${index + 1}`} style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 7, border: `1px solid ${LINE}`, background: '#fff' }} />
      <div style={{ overflow: 'hidden', marginTop: 4, fontSize: 10, fontWeight: 800, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name || `凭证 ${index + 1}`}</div>
    </a>
  );
}

function AdminPrivateModerationEvidence({
  recordId,
  files,
  kind,
}: {
  recordId: string;
  files: DossierClaimProof[];
  kind: 'report' | 'feedback';
}) {
  if (files.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 900, color: INK, marginBottom: 7 }}>
        私密{kind === 'report' ? '举报材料' : '反馈图片'}（仅管理员可见）
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 180px))', gap: 9 }}>
        {files.map((file, index) => (
          <AdminPrivateModerationEvidenceImage key={file.id} recordId={recordId} file={file} index={index} kind={kind} />
        ))}
      </div>
    </div>
  );
}

function AdminPrivateModerationEvidenceImage({
  recordId,
  file,
  index,
  kind,
}: {
  recordId: string;
  file: DossierClaimProof;
  index: number;
  kind: 'report' | 'feedback';
}) {
  const [source, setSource] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    const resource = kind === 'report'
      ? `${API}/lc/admin/reports/${encodeURIComponent(recordId)}/evidence/${encodeURIComponent(file.id)}`
      : `${API}/lc/admin/site-messages/${encodeURIComponent(recordId)}/evidence/${encodeURIComponent(file.id)}`;
    fetch(resource, {
      headers: { Authorization: `Bearer ${getToken()}` },
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error('私密图片读取失败');
        return response.blob();
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(reason => {
        if (reason?.name !== 'AbortError') setLoadError(reason instanceof Error ? reason.message : '私密图片读取失败');
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, kind, recordId]);

  if (loadError) return <div style={{ minHeight: 96, padding: 9, border: '1px solid rgba(185,28,28,0.18)', borderRadius: 7, background: '#fff', color: '#991b1b', fontSize: 11 }}>{loadError}</div>;
  if (!source) return <div style={{ minHeight: 96, display: 'grid', placeItems: 'center', border: `1px solid ${LINE}`, borderRadius: 7, background: '#fff', color: MUTED, fontSize: 11 }}>读取中…</div>;
  return (
    <a href={source} target="_blank" rel="noreferrer" style={{ display: 'block', color: '#275389', textDecoration: 'none' }}>
      <img src={source} alt={`${kind === 'report' ? '举报材料' : '反馈图片'} ${index + 1}`} style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 7, border: `1px solid ${LINE}`, background: '#fff' }} />
      <div style={{ overflow: 'hidden', marginTop: 4, fontSize: 10, fontWeight: 800, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name || `图片 ${index + 1}`}</div>
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
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>;
}

function TitleLine({ title, pill }: { title: string; pill: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, minWidth: 0 }}>
      <span style={{ minWidth: 0, overflow: 'hidden', fontWeight: 900, fontSize: '0.96rem', color: INK, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      <span style={{ flexShrink: 0, padding: '1px 6px', borderRadius: 5, fontSize: '0.68rem', background: '#fff8e8', color: '#8a5a19', border: '1px solid rgba(217,168,87,0.26)' }}>{pill}</span>
    </div>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <span className="admin-meta" style={{ display: 'inline', fontSize: '0.74rem', color: MUTED, marginRight: 10, lineHeight: 1.45 }}>{children}</span>;
}

function ContentBox({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '7px 10px', backgroundColor: '#fffdf8', border: `1px solid ${LINE}`, borderRadius: 6, fontSize: '0.79rem', color: 'rgba(31,41,55,0.82)', lineHeight: 1.55, marginTop: 6 }}>{children}</div>;
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 7, padding: '8px 10px', border: '1px solid rgba(217,168,87,0.34)', borderRadius: 6, background: '#fffaf0' }}>
      <div style={{ marginBottom: 4, color: '#8a5a19', fontSize: '0.7rem', fontWeight: 900 }}>{title}</div>
      <div style={{ color: INK, fontSize: '0.79rem', fontWeight: 650, lineHeight: 1.55 }}>{children}</div>
    </section>
  );
}

function ReviewDetailLine({ line }: { line: string }) {
  const separator = line.indexOf('：');
  const arrow = line.indexOf(' → ', separator + 1);
  if (separator < 0 || arrow < 0) return <div style={{ padding: '2px 0' }}>{line}</div>;

  const label = line.slice(0, separator);
  const before = line.slice(separator + 1, arrow);
  const after = line.slice(arrow + 3);
  return (
    <div className="admin-review-diff" style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(76px, auto) minmax(0, 1fr) 16px minmax(0, 1.25fr)',
      alignItems: 'center',
      gap: 6,
      padding: '4px 0',
    }}>
      <strong style={{ color: '#6b4a19', fontSize: '0.75rem' }}>{label}</strong>
      <span style={{ minWidth: 0, color: MUTED, fontWeight: 600, overflowWrap: 'anywhere' }}>{before}</span>
      <span aria-hidden="true" style={{ color: '#b7a88f', textAlign: 'center' }}>→</span>
      <span style={{ minWidth: 0, padding: '5px 7px', borderLeft: '3px solid #d69a2d', background: '#fff3d6', color: '#5f3b06', fontWeight: 900, overflowWrap: 'anywhere' }}>
        <small style={{ display: 'inline-block', marginRight: 6, color: '#9a5f18', fontSize: '0.62rem', fontWeight: 950 }}>新增</small>
        {after}
      </span>
    </div>
  );
}

function ReviewNotice({ children, tone }: { children: React.ReactNode; tone: 'gold' | 'red' }) {
  const red = tone === 'red';
  return <div style={{ marginTop: 6, padding: '5px 8px', borderLeft: `3px solid ${red ? '#dc2626' : '#d97706'}`, background: red ? '#fef2f2' : '#fff7ed', color: red ? '#991b1b' : '#9a5f18', fontSize: '0.74rem', fontWeight: 800, lineHeight: 1.4 }}>{children}</div>;
}

function Proof({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: 6, padding: '6px 9px', backgroundColor: '#fff8e8', border: '1px solid rgba(217,168,87,0.28)', borderRadius: 6, fontSize: '0.76rem', color: '#8a5a19', fontWeight: 700, lineHeight: 1.45 }}>{children}</div>;
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
