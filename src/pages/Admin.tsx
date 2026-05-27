import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API = '/api';
const C = '#0F1117';
const C2 = '#1A1D27';
const GOLD = '#d9a857';

function getToken() { return localStorage.getItem('lc_admin_token') || ''; }

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch { return true; }
}

const SUBJECT_LABEL: Record<string, string> = {
  creator: '委托师',
  dm: '卡司',
  store: '店家',
  player: '玩家',
};

type Profile = {
  id: string;
  display_name: string;
  phone: string;
  created_at: string;
  updated_at?: string;
  is_visible: boolean;
  is_realname?: boolean;
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
  type: 'red' | 'black';
  subject_name: string;
  subject_type: string;
  subject_city: string | null;
  subject_url?: string | null;
  content: string;
  author_name: string;
  initial_amount: number;
  payment_proof: string | null;
  created_at: string;
};

type CommentReview = {
  id: string;
  content: string;
  author_name: string;
  is_realname?: boolean;
  is_pinned?: boolean;
  pin_label?: string | null;
  payment_proof?: string | null;
  created_at: string;
  lc_rankings?: { subject_name?: string; type?: 'red' | 'black' };
};

type ClaimReview = {
  id: string;
  claimant_name?: string | null;
  contact: string;
  message?: string | null;
  created_at: string;
  lc_rankings?: { subject_name?: string; type?: 'red' | 'black' };
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
  type: 'dm' | 'shop';
  status: 'pending' | 'approved' | 'rejected';
  files: { name: string; url: string }[];
  description: string | null;
  reject_reason: string | null;
  created_at: string;
  lc_profiles?: { display_name?: string; phone?: string };
};

type RejectType = 'profile' | 'ranking' | 'comment' | 'claim' | 'commission' | 'transaction' | 'cert';
type Tab = 'pending' | 'active' | 'requests' | 'rankings' | 'comments' | 'claims' | 'commissions' | 'wallet' | 'certs';

const card: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(201,146,46,0.15)',
  borderRadius: 14,
  padding: '16px 20px',
};

export default function Admin() {
  const [authed, setAuthed] = useState(() => {
    const t = getToken();
    return !!t && !isTokenExpired(t);
  });
  const [password, setPassword] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<ContactReq[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [comments, setComments] = useState<CommentReview[]>([]);
  const [claims, setClaims] = useState<ClaimReview[]>([]);
  const [commissions, setCommissions] = useState<CommissionReview[]>([]);
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
        setComments((d.data as { comments: CommentReview[] }).comments || []);
        setClaims((d.data as { claims: ClaimReview[] }).claims || []);
        setCommissions((d.data as { commissions: CommissionReview[] }).commissions || []);
        setTransactions((d.data as { transactions: TransactionReview[] }).transactions || []);
        setCerts((d.data as { certifications: CertReview[] }).certifications || []);
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

  const approveRanking = async (id: string) => {
    await fetch(`${API}/lc/admin/rankings/${id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    void loadData();
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
    } else if (type === 'transaction') {
      await fetch(`${API}/lc/admin/transactions/${id}/reject`, { method: 'PUT', headers, body });
      setTransactions(prev => prev.filter(t => t.id !== id));
    } else if (type === 'cert') {
      await fetch(`${API}/lc/admin/certifications/${id}/reject`, { method: 'PUT', headers, body });
      setCerts(prev => prev.filter(c => c.id !== id));
    }
  };

  const logout = () => {
    localStorage.removeItem('lc_admin_token');
    window.dispatchEvent(new Event('lc-auth-changed'));
    setAuthed(false);
    setProfiles([]);
    setRequests([]);
    setRankings([]);
    setComments([]);
    setClaims([]);
    setCommissions([]);
    setTransactions([]);
    setCerts([]);
  };

  const pendingProfiles = profiles.filter(p => !p.is_visible && !p.reject_reason);
  const activeProfiles = profiles.filter(p => p.is_visible);

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
            { label: '已上线创作者', value: activeProfiles.length, color: '#34d399' },
            { label: '联系申请', value: requests.length, color: GOLD },
            { label: '充值', value: transactions.length, color: '#22c55e' },
            { label: '委托需求', value: commissions.length, color: '#fbbf24' },
            { label: '红黑榜', value: rankings.length, color: '#a78bfa' },
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
          <button style={tabStyle(tab === 'active')} onClick={() => setTab('active')}>已上线 ({activeProfiles.length})</button>
          <button style={tabStyle(tab === 'requests')} onClick={() => setTab('requests')}>联系 {requests.length > 0 && `(${requests.length})`}</button>
          <button style={tabStyle(tab === 'wallet')} onClick={() => setTab('wallet')}>充值 {transactions.length > 0 && `(${transactions.length})`}</button>
          <button style={tabStyle(tab === 'commissions')} onClick={() => setTab('commissions')}>委托 {commissions.length > 0 && `(${commissions.length})`}</button>
          <button style={tabStyle(tab === 'rankings')} onClick={() => setTab('rankings')}>榜单 {rankings.length > 0 && `(${rankings.length})`}</button>
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
              <ListEmpty empty={activeProfiles.length === 0} text="还没有上线的创作者">
                {activeProfiles.map(p => (
                  <Row key={p.id}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.display_name}</span>
                        {p.is_realname && <span style={{ fontSize: '0.72rem', color: GOLD }}>⭐ 实名</span>}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'rgba(186,207,231,0.65)' }}>{p.phone} · 注册于 {p.created_at?.slice(0, 10)}</div>
                    </div>
                    <Actions>
                      <Link to={`/explore/${p.id}`} target="_blank" style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(201,146,46,0.2)', color: GOLD, fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>主页</Link>
                      <ActionButton onClick={() => toggleRealname(p.id, !p.is_realname)}>{p.is_realname ? '取消实名' : '设为实名'}</ActionButton>
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
                  <Row key={r.id} accent={r.type === 'red' ? '#dc2626' : '#475569'}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={r.subject_name} pill={r.type === 'red' ? '🏅 红榜' : '👎 黑榜'} />
                      <Meta>{SUBJECT_LABEL[r.subject_type] || r.subject_type} · {r.subject_city || '未知'} · 作者：{r.author_name} · 初始：{r.initial_amount} 契约币 · {r.created_at?.slice(0, 10)}</Meta>
                      {r.subject_url && <Meta>链接：{r.subject_url}</Meta>}
                      <ContentBox>{r.content}</ContentBox>
                      {r.payment_proof && <Proof>支付凭证：{r.payment_proof}</Proof>}
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => approveRanking(r.id)}>通过</ActionButton>
                      <ActionButton kind="bad" onClick={() => openRejectModal(r.id, 'ranking')}>拒绝</ActionButton>
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

            {tab === 'comments' && (
              <ListEmpty empty={comments.length === 0} text="暂无待审核评论">
                {comments.map(c => (
                  <Row key={c.id}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <TitleLine title={c.lc_rankings?.subject_name || '未知帖子'} pill={c.is_pinned ? (c.pin_label || '相关方回应') : (c.lc_rankings?.type === 'black' ? '👎 黑榜评论' : '🏅 红榜评论')} />
                      <Meta>作者：{c.is_realname ? `⭐ ${c.author_name}` : c.author_name} · {c.created_at?.slice(0, 10)}</Meta>
                      <ContentBox>{c.content}</ContentBox>
                      {c.payment_proof && <Proof>支付凭证：{c.payment_proof}</Proof>}
                    </div>
                    <Actions vertical>
                      <ActionButton kind="ok" onClick={() => approveComment(c.id)}>通过</ActionButton>
                      <ActionButton kind="bad" onClick={() => openRejectModal(c.id, 'comment')}>拒绝</ActionButton>
                    </Actions>
                  </Row>
                ))}
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
                        pill={c.type === 'dm' ? '🎭 DM 开本记录认证' : '🏪 店家营业执照认证'}
                      />
                      <Meta>
                        用户：{c.lc_profiles?.display_name || '未知用户'}
                        {c.lc_profiles?.phone ? ` · ${c.lc_profiles.phone}` : ''}
                        {c.created_at ? ` · ${c.created_at.slice(0, 10)}` : ''}
                      </Meta>
                      {c.description && <ContentBox>{c.description}</ContentBox>}
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
