import { useEffect, useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { isTokenExpired } from '../lib/authSession';

const API = '/api';
const C = '#0F1117';
const C2 = '#1A1D27';
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

type Profile = {
  id: string;
  display_name: string;
  phone: string;
  created_at: string;
  updated_at?: string;
  is_visible: boolean;
  is_realname?: boolean;
  is_banned?: boolean;
  ban_reason?: string | null;
  banned_at?: string | null;
  reject_reason?: string | null;
  role_type?: string;
};

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
  payment_proof: string | null;
  created_at: string;
};

type RankingEditForm = {
  type: 'red' | 'black' | 'white';
  subject_name: string;
  subject_type: string;
  subject_city: string;
  subject_url: string;
  content: string;
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
  subject: string;
  content: string;
  contact?: string | null;
  status: 'pending' | 'resolved';
  admin_note?: string | null;
  created_at: string;
  updated_at?: string;
};

type DmDossierReview = {
  id: string;
  entity_type?: 'dm' | 'store' | null;
  dm_name: string;
  city?: string | null;
  workplace?: string | null;
  profile_url?: string | null;
  photo_url?: string | null;
  note?: string | null;
  tags?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  submitted_by_name?: string | null;
  claim_status: 'unclaimed' | 'pending' | 'approved' | 'rejected';
  claim_note?: string | null;
  claimed_by?: string | null;
  created_at: string;
};

type RejectType = 'profile' | 'ranking' | 'comment' | 'claim' | 'commission' | 'carpool' | 'transaction' | 'cert' | 'dmDossier';
type Tab = 'pending' | 'active' | 'requests' | 'messages' | 'rankings' | 'publishedRankings' | 'comments' | 'claims' | 'commissions' | 'carpools' | 'scriptContributions' | 'dmDossiers' | 'reports' | 'wallet' | 'certs' | 'security';

function certificationTypeLabel(type: string) {
  if (type === 'realname') return '⭐ 实名认证';
  if (type === 'dm') return '🎭 DM 开本记录认证';
  if (type === 'shop') return '🏪 店家营业执照认证';
  return '认证申请';
}

const card: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(201,146,46,0.15)',
  borderRadius: 14,
  padding: '16px 20px',
};

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
  const [reports, setReports] = useState<ReportReview[]>([]);
  const [siteMessages, setSiteMessages] = useState<SiteMessage[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [transactions, setTransactions] = useState<TransactionReview[]>([]);
  const [certs, setCerts] = useState<CertReview[]>([]);
const [loading, setLoading] = useState(false);
const [transactionLoading, setTransactionLoading] = useState(false);
const [transactionMsg, setTransactionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('pending');
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: string; reason: string; type: RejectType }>({
    open: false,
    id: '',
    reason: '',
    type: 'profile',
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
        setTransactions((d.data as { transactions: TransactionReview[] }).transactions || []);
        setCerts((d.data as { certifications: CertReview[] }).certifications || []);
        setReports((d.data as { reports: ReportReview[] }).reports || []);
        setSiteMessages((d.data as { siteMessages: SiteMessage[] }).siteMessages || []);
        setSecurityEvents((d.data as { securityEvents: SecurityEvent[] }).securityEvents || []);
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
    await fetch(`${API}/lc/admin/dm-dossiers/${id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setDmDossiers(prev => prev.filter(item => item.id !== id));
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

  const openRejectModal = (id: string, type: RejectType) => {
    setRejectModal({ open: true, id, reason: '', type });
  };

  const confirmReject = async () => {
    const { id, reason, type } = rejectModal;
    setRejectModal({ open: false, id: '', reason: '', type: 'profile' });

    const headers = { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
    const body = JSON.stringify({ rejectReason: reason });

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
    setReports([]);
    setSiteMessages([]);
    setSecurityEvents([]);
    setTransactions([]);
    setCerts([]);
  };

  const pendingProfiles = profiles.filter(p => !p.is_visible && !p.reject_reason);
  const activeProfiles = profiles.filter(p => p.is_visible || p.is_banned);

  if (!authed) return (
    <div style={{ backgroundColor: C, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ textDecoration: 'none', fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '2.5rem', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            灵契
          </Link>
          <p style={{ color: 'rgba(186,207,231,0.65)', fontSize: '0.875rem', marginTop: 8 }}>管理后台</p>
        </div>
        <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,146,46,0.15)', borderRadius: 20, padding: '32px 28px' }}>
          <div style={{ width: 48, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, margin: '0 auto 24px' }} />
          <h2 style={{ textAlign: 'center', fontWeight: 700, marginBottom: 24, color: 'rgba(186,207,231,0.8)' }}>管理员登录</h2>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="管理密码"
            style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.2)', backgroundColor: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
          <button onClick={login}
            style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, fontWeight: 700, fontSize: '0.9rem' }}>
            登录
          </button>
          {error && <p style={{ textAlign: 'center', color: '#f87171', fontSize: '0.82rem', marginTop: 12 }}>{error}</p>}
        </div>
      </div>
    </div>
  );

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s',
    background: active ? `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)` : 'transparent',
    color: active ? C : 'rgba(186,207,231,0.5)',
  });

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: '#fff' }}>
      <div style={{ backgroundColor: C2, borderBottom: '1px solid rgba(201,146,46,0.12)', padding: '24px 20px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 4 }}>灵契管理后台</h1>
            <p style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.65)' }}>主页、红黑榜、评论、相关方申请审核</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link to="/" style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.65)', textDecoration: 'none' }}>返回首页</Link>
            <button onClick={logout}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(201,146,46,0.2)', background: 'none', color: 'rgba(186,207,231,0.5)', cursor: 'pointer', fontSize: '0.82rem' }}>
              退出
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 20px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12, marginBottom: 28 }}>
          {[
            { label: '待审核创作者', value: pendingProfiles.length, color: '#fb7185' },
            { label: '账号', value: activeProfiles.length, color: '#34d399' },
            { label: '联系申请', value: requests.length, color: GOLD },
            { label: '充值', value: transactions.length, color: '#22c55e' },
            { label: '委托需求', value: commissions.length, color: '#fbbf24' },
            { label: '拼车', value: carpools.length, color: '#14b8a6' },
            { label: '剧本库', value: scriptContributions.length, color: '#f59e0b' },
            { label: '未认证档案', value: dmDossiers.length, color: '#f472b6' },
            { label: '举报', value: reports.length, color: '#f87171' },
            { label: '站内信', value: siteMessages.length, color: '#38bdf8' },
            { label: '安全日志', value: securityEvents.length, color: '#fb923c' },
            { label: '红黑榜', value: rankings.length, color: '#a78bfa' },
            { label: '已发布榜单', value: approvedRankings.length, color: '#60a5fa' },
            { label: '评论', value: comments.length, color: '#38bdf8' },
            { label: '相关方', value: claims.length, color: '#f97316' },
            { label: '认证', value: certs.length, color: '#3b82f6' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...card, textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(186,207,231,0.55)' }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 4, padding: 4, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,146,46,0.1)', borderRadius: 14, marginBottom: 20 }}>
          <button style={tabStyle(tab === 'pending')} onClick={() => setTab('pending')}>待审核 {pendingProfiles.length > 0 && `(${pendingProfiles.length})`}</button>
          <button style={tabStyle(tab === 'active')} onClick={() => setTab('active')}>账号 ({activeProfiles.length})</button>
          <button style={tabStyle(tab === 'requests')} onClick={() => setTab('requests')}>联系 {requests.length > 0 && `(${requests.length})`}</button>
          <button style={tabStyle(tab === 'wallet')} onClick={() => setTab('wallet')}>充值 {transactions.length > 0 && `(${transactions.length})`}</button>
          <button style={tabStyle(tab === 'commissions')} onClick={() => setTab('commissions')}>委托 {commissions.length > 0 && `(${commissions.length})`}</button>
          <button style={tabStyle(tab === 'carpools')} onClick={() => setTab('carpools')}>拼车 {carpools.length > 0 && `(${carpools.length})`}</button>
          <button style={tabStyle(tab === 'scriptContributions')} onClick={() => setTab('scriptContributions')}>剧本库 {scriptContributions.length > 0 && `(${scriptContributions.length})`}</button>
          <button style={tabStyle(tab === 'dmDossiers')} onClick={() => setTab('dmDossiers')}>未认证档案 {dmDossiers.length > 0 && `(${dmDossiers.length})`}</button>
          <button style={tabStyle(tab === 'reports')} onClick={() => setTab('reports')}>举报 {reports.length > 0 && `(${reports.length})`}</button>
          <button style={tabStyle(tab === 'messages')} onClick={() => setTab('messages')}>站内信 {siteMessages.length > 0 && `(${siteMessages.length})`}</button>
          <button style={tabStyle(tab === 'security')} onClick={() => setTab('security')}>安全日志</button>
          <button style={tabStyle(tab === 'rankings')} onClick={() => setTab('rankings')}>榜单 {rankings.length > 0 && `(${rankings.length})`}</button>
          <button style={tabStyle(tab === 'publishedRankings')} onClick={() => setTab('publishedRankings')}>已发布 ({approvedRankings.length})</button>
          <button style={tabStyle(tab === 'comments')} onClick={() => setTab('comments')}>评论 {comments.length > 0 && `(${comments.length})`}</button>
          <button style={tabStyle(tab === 'claims')} onClick={() => setTab('claims')}>相关方 {claims.length > 0 && `(${claims.length})`}</button>
          <button style={tabStyle(tab === 'certs')} onClick={() => setTab('certs')}>认证审核 {certs.length > 0 && `(${certs.length})`}</button>
        </div>

        {error && <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: 16 }}>{error}</p>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 36, height: 36, border: '2px solid rgba(201,146,46,0.3)', borderTopColor: GOLD, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: 'rgba(186,207,231,0.65)' }}>加载中...</p>
          </div>
        ) : (
          <>
            {tab === 'pending' && (
              <ListEmpty empty={pendingProfiles.length === 0} text="没有待审核的创作者">
                {pendingProfiles.map(p => (
                  <Row key={p.id}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>{p.display_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'rgba(186,207,231,0.65)' }}>{p.phone} · 注册于 {p.created_at?.slice(0, 10)}{p.role_type && ` · ${p.role_type}`}</div>
                    </div>
                    <Actions>
                      <ActionButton kind="ok" onClick={() => approveProfile(p.id)}>通过</ActionButton>
                      <ActionButton kind="bad" onClick={() => openRejectModal(p.id, 'profile')}>拒绝</ActionButton>
                    </Actions>
                  </Row>
                ))}
              </ListEmpty>
            )}

            {tab === 'active' && (
              <ListEmpty empty={activeProfiles.length === 0} text="暂无可管理账号">
                {activeProfiles.map(p => (
                  <Row key={p.id}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.display_name}</span>
                        {p.is_realname && <span style={{ fontSize: '0.72rem', color: GOLD }}>⭐ 实名</span>}
                        {p.is_banned && <span style={{ fontSize: '0.72rem', color: '#f87171' }}>已限制</span>}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'rgba(186,207,231,0.65)' }}>{p.phone} · 注册于 {p.created_at?.slice(0, 10)}{p.banned_at ? ` · 限制于 ${p.banned_at.slice(0, 10)}` : ''}</div>
                      {p.ban_reason && <Proof>限制原因：{p.ban_reason}</Proof>}
                    </div>
                    <Actions>
                      <Link to={`/explore/${p.id}`} target="_blank" style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(201,146,46,0.2)', color: GOLD, fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>主页</Link>
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
                      {tx.payment_proof && <Proof>支付凭证：{tx.payment_proof}</Proof>}
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
                {rankings.map(r => (
                  <Row key={r.id} accent={r.type === 'red' ? '#dc2626' : r.type === 'black' ? '#475569' : '#d9a857'}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={r.subject_name} pill={r.type === 'red' ? '🏅 红榜' : r.type === 'black' ? '👎 黑榜' : '✨ 白榜'} />
                      <Meta>{SUBJECT_LABEL[r.subject_type] || r.subject_type} · {r.subject_city || '未知'} · 作者：{r.author_name} · {r.type === 'white' && r.initial_amount === 0 ? '免费发布' : `初始：${r.initial_amount} 契约币`} · {r.created_at?.slice(0, 10)}</Meta>
                      {r.subject_url && <Meta>链接：{r.subject_url}</Meta>}
                      <ContentBox>{r.content}</ContentBox>
                      {r.payment_proof && <Proof>支付凭证：{r.payment_proof}</Proof>}
                    </div>
                    <Actions vertical>
                      <ActionButton onClick={() => openRankingEdit(r)}>编辑</ActionButton>
                      <ActionButton kind="ok" onClick={() => approveRanking(r.id)}>通过</ActionButton>
                      {r.type === 'white' && (
                        <>
                          <ActionButton onClick={() => approveRanking(r.id, 'red')}>转红榜</ActionButton>
                          <ActionButton onClick={() => approveRanking(r.id, 'black')}>转黑榜</ActionButton>
                        </>
                      )}
                      <ActionButton kind="bad" onClick={() => openRejectModal(r.id, 'ranking')}>拒绝</ActionButton>
                    </Actions>
                  </Row>
                ))}
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
                          {` · 奖励：${item.reward_amount || 0} 灵契币`}
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
                        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                          {contributionRoles.map((role, index) => (
                            <div key={`${role.role_name || 'role'}-${index}`} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(201,146,46,0.12)', background: 'rgba(255,255,255,0.03)' }}>
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
              <ListEmpty empty={dmDossiers.length === 0} text="暂无待审核未认证档案">
                {dmDossiers.map(item => {
                  const entityType = item.entity_type === 'store' ? 'store' : 'dm';
                  const entityLabel = entityType === 'store' ? '店家' : 'DM';
                  return (
                  <Row key={item.id} accent={entityType === 'store' ? '#38bdf8' : '#f472b6'}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={item.dm_name} pill={item.status === 'pending' ? `${entityLabel}建档` : `${entityLabel}认领`} />
                      <Meta>
                        {item.city || '未知城市'}
                        {item.workplace ? ` · ${item.workplace}` : ''}
                        {item.submitted_by_name ? ` · 提交人：${item.submitted_by_name}` : ''}
                        {item.created_at ? ` · ${item.created_at.slice(0, 10)}` : ''}
                      </Meta>
                      {item.profile_url && <Meta>主页：{item.profile_url}</Meta>}
                      {item.claim_status === 'pending' && (
                        <Proof>
                          认领申请：{item.claimed_by || '未知账号'}
                          {item.claim_note ? ` · ${item.claim_note}` : ''}
                        </Proof>
                      )}
                      {item.note && <ContentBox>{item.note}</ContentBox>}
                      {item.tags && item.tags.length > 0 && <Meta>标签：{item.tags.join(' / ')}</Meta>}
                      {item.photo_url && (
                        <a href={item.photo_url} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', marginTop: 10, color: GOLD, fontSize: '0.78rem', fontWeight: 800, textDecoration: 'none' }}>
                          查看照片
                        </a>
                      )}
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => approveDmDossier(item.id)}>
                        {item.claim_status === 'pending' && item.status !== 'pending' ? '通过认领' : '通过公开'}
                      </ActionButton>
                      <ActionButton kind="bad" onClick={() => openRejectModal(item.id, 'dmDossier')}>拒绝</ActionButton>
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
                      <TitleLine title={m.subject} pill="站内信" />
                      <Meta>
                        发送人：{m.sender_name}
                        {m.contact ? ` · 联系方式：${m.contact}` : ''}
                        {m.created_at ? ` · ${m.created_at.slice(0, 19).replace('T', ' ')}` : ''}
                      </Meta>
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
                        {c.payment_proof && !isRelatedProof && <Proof>支付凭证：{c.payment_proof}</Proof>}
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
                      {c.type === 'realname' && <Meta>身份证材料应已带“仅用于灵契实名认证”水印；审核通过后只给前台实名标识，不公开证件。</Meta>}
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
      </div>

      {rankingEdit && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: C2, border: '1px solid rgba(201,146,46,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 8, color: 'rgba(186,207,231,0.92)' }}>编辑榜单记录</h3>
            <p style={{ fontSize: '0.8rem', color: 'rgba(186,207,231,0.55)', lineHeight: 1.7, marginBottom: 18 }}>
              保存后会写入防篡改审计链，前台审计记录会展示原版、编辑版和变更时间。
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: '0.76rem', color: 'rgba(186,207,231,0.62)', marginBottom: 6 }}>榜单类型</span>
                <select value={rankingEdit.form.type} onChange={e => updateRankingEditForm({ type: e.target.value as RankingEditForm['type'] })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.2)', backgroundColor: 'rgba(255,255,255,0.04)', color: '#fff', outline: 'none' }}>
                  <option value="red">红榜</option>
                  <option value="black">黑榜</option>
                  <option value="white">白榜</option>
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: '0.76rem', color: 'rgba(186,207,231,0.62)', marginBottom: 6 }}>对象分类</span>
                <select value={rankingEdit.form.subject_type} onChange={e => updateRankingEditForm({ subject_type: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.2)', backgroundColor: 'rgba(255,255,255,0.04)', color: '#fff', outline: 'none' }}>
                  {Object.entries(SUBJECT_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: '0.76rem', color: 'rgba(186,207,231,0.62)', marginBottom: 6 }}>所在城市</span>
                <input value={rankingEdit.form.subject_city} onChange={e => updateRankingEditForm({ subject_city: e.target.value })}
                  placeholder="例：上海"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.2)', backgroundColor: 'rgba(255,255,255,0.04)', color: '#fff', outline: 'none' }} />
              </label>
            </div>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: '0.76rem', color: 'rgba(186,207,231,0.62)', marginBottom: 6 }}>对象名称</span>
              <input value={rankingEdit.form.subject_name} onChange={e => updateRankingEditForm({ subject_name: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.2)', backgroundColor: 'rgba(255,255,255,0.04)', color: '#fff', outline: 'none' }} />
            </label>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: '0.76rem', color: 'rgba(186,207,231,0.62)', marginBottom: 6 }}>社交主页链接</span>
              <input value={rankingEdit.form.subject_url} onChange={e => updateRankingEditForm({ subject_url: e.target.value })}
                placeholder="可留空"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.2)', backgroundColor: 'rgba(255,255,255,0.04)', color: '#fff', outline: 'none' }} />
            </label>

            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: '0.76rem', color: 'rgba(186,207,231,0.62)', marginBottom: 6 }}>正文内容</span>
              <textarea value={rankingEdit.form.content} onChange={e => updateRankingEditForm({ content: e.target.value })}
                rows={8}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.2)', backgroundColor: 'rgba(255,255,255,0.04)', color: '#fff', outline: 'none', lineHeight: 1.7 }} />
            </label>

            {rankingEdit.error && <p style={{ color: '#f87171', fontSize: '0.82rem', marginTop: 12 }}>{rankingEdit.error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setRankingEdit(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'rgba(186,207,231,0.6)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                取消
              </button>
              <button onClick={saveRankingEdit} disabled={rankingEdit.saving}
                style={{ flex: 1.4, padding: '10px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, cursor: rankingEdit.saving ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '0.875rem', opacity: rankingEdit.saving ? 0.6 : 1 }}>
                {rankingEdit.saving ? '保存中...' : '保存并留痕'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: C2, border: '1px solid rgba(201,146,46,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8, color: 'rgba(186,207,231,0.9)' }}>填写拒绝原因</h3>
            <p style={{ fontSize: '0.8rem', color: 'rgba(186,207,231,0.5)', marginBottom: 16 }}>原因可不填，主要给自己留审核记录。</p>
            <textarea value={rejectModal.reason} onChange={e => setRejectModal({ ...rejectModal, reason: e.target.value })}
              placeholder="请说明拒绝原因（选填）..." rows={4}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.2)', backgroundColor: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box', resize: 'none', outline: 'none' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setRejectModal({ open: false, id: '', reason: '', type: 'profile' })}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'rgba(186,207,231,0.6)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                取消
              </button>
              <button onClick={confirmReject}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.12)', color: '#f87171', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Row({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ ...card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, borderLeft: accent ? `3px solid ${accent}` : card.border }}>
      {children}
    </div>
  );
}

function Actions({ children, vertical }: { children: React.ReactNode; vertical?: boolean }) {
  return <div style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: 8, flexShrink: 0 }}>{children}</div>;
}

function ActionButton({ children, onClick, kind, disabled }: { children: React.ReactNode; onClick: () => void; kind?: 'ok' | 'bad'; disabled?: boolean }) {
  const ok = kind === 'ok';
  const bad = kind === 'bad';
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${ok ? 'rgba(52,211,153,0.3)' : bad ? 'rgba(248,113,113,0.25)' : 'rgba(201,146,46,0.2)'}`, cursor: disabled ? 'not-allowed' : 'pointer', background: ok ? 'rgba(52,211,153,0.12)' : bad ? 'rgba(248,113,113,0.08)' : 'transparent', color: ok ? '#34d399' : bad ? '#f87171' : GOLD, fontWeight: 600, fontSize: '0.82rem', opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}

function ListEmpty({ empty, text, children }: { empty: boolean; text: string; children: React.ReactNode }) {
  if (empty) return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>✅</div>
      <p style={{ color: 'rgba(186,207,231,0.65)' }}>{text}</p>
    </div>
  );
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>;
}

function TitleLine({ title, pill }: { title: string; pill: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{title}</span>
      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', background: 'rgba(201,146,46,0.08)', color: GOLD, border: '1px solid rgba(201,146,46,0.2)' }}>{pill}</span>
    </div>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.78rem', color: 'rgba(186,207,231,0.55)', marginBottom: 8 }}>{children}</div>;
}

function ContentBox({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,146,46,0.1)', borderRadius: 8, fontSize: '0.82rem', color: 'rgba(186,207,231,0.7)', lineHeight: 1.7, marginTop: 8 }}>{children}</div>;
}

function Proof({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: 8, padding: '8px 12px', backgroundColor: 'rgba(201,146,46,0.06)', border: '1px solid rgba(201,146,46,0.15)', borderRadius: 8, fontSize: '0.78rem', color: 'rgba(186,207,231,0.65)' }}>{children}</div>;
}
