import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { JumuluCompactHeader, JumuluPageFrame } from '../components/JumuluPageChrome';
import { readStoredCreatorAuth } from '../lib/authSession';
import '../styles/account-center.css';

type Restriction = {
  id?: string | null;
  scope: 'publish' | 'account';
  reason: string;
  starts_at?: string | null;
  ends_at?: string | null;
};

type Appeal = {
  id: string;
  content: string;
  evidence_urls?: string[];
  status: 'pending' | 'needs_info' | 'approved' | 'rejected' | 'withdrawn';
  admin_reply?: string | null;
  created_at: string;
};

type Notice = {
  id: string;
  type: string;
  title: string;
  content: string;
  action_url?: string | null;
  related_type?: string | null;
  related_id?: string | null;
  read_at?: string | null;
  created_at: string;
};

type SubmissionState = 'pending' | 'approved' | 'action' | 'closed';

type SubmissionItem = {
  id: string;
  kind: string;
  group: string;
  type_label: string;
  title: string;
  content: string;
  status: string;
  state: SubmissionState;
  created_at: string;
  updated_at?: string | null;
  reject_reason?: string | null;
  thumbnail_url?: string | null;
  action_url?: string | null;
};

type SubmissionPayload = {
  items: SubmissionItem[];
  summary: {
    total: number;
    pending: number;
    approved: number;
    action_required: number;
    closed: number;
  };
};

type StatusPayload = {
  state: 'active' | 'restricted' | 'merged';
  message: string;
  restriction: Restriction | null;
  appeal: Appeal | null;
  unread_count: number;
};

const EMPTY_SUBMISSIONS: SubmissionPayload = {
  items: [],
  summary: { total: 0, pending: 0, approved: 0, action_required: 0, closed: 0 },
};

function dateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : value;
}

function appealStatusLabel(status?: Appeal['status']) {
  if (status === 'pending') return '处理中';
  if (status === 'needs_info') return '待补充';
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '维持限制';
  return '未提交';
}

function submissionStatusLabel(item: SubmissionItem) {
  const labels: Record<string, string> = {
    pending: '审核中',
    pending_owner: '待本人确认',
    submitted: '已提交',
    processing: '处理中',
    approved: '已公开',
    resolved: '已处理',
    replied: '已回复',
    on_sale: '已上架',
    paid: '已支付',
    rejected: '需修改',
    needs_submission: '待补交',
    needs_info: '待补充',
    withdrawn: '已撤回',
    closed: '已关闭',
    hidden: '已隐藏',
    deleted_by_author: '已删除',
    cancelled: '已取消',
    off_sale: '已下架',
    suspended: '已暂停',
  };
  return labels[item.status] || (item.state === 'approved' ? '已完成' : item.state === 'action' ? '需处理' : item.state === 'pending' ? '处理中' : '已结束');
}

function safeInternalPath(value?: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

function submissionActionLabel(item: SubmissionItem) {
  if (item.status === 'needs_submission') return '补交资料';
  if (item.state === 'action') return '查看并处理';
  if (item.kind === 'feedback' || item.kind === 'report') return '查看记录';
  if (item.kind === 'provider_listing') return '查看委托条';
  return '查看详情';
}

export default function AccountStatus() {
  const auth = readStoredCreatorAuth();
  const token = auth?.token || '';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionPayload>(EMPTY_SUBMISSIONS);
  const [activeTab, setActiveTabState] = useState<'notices' | 'submissions'>(
    searchParams.get('tab') === 'submissions' ? 'submissions' : 'notices',
  );
  const [stateFilter, setStateFilter] = useState<'all' | SubmissionState>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showAccountDetail, setShowAccountDetail] = useState(false);
  const [content, setContent] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [loading, setLoading] = useState(Boolean(auth?.token));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statusResponse, noticeResponse, submissionResponse] = await Promise.all([
        fetch('/api/lc/account/status', { headers }),
        fetch('/api/lc/account/notifications', { headers }),
        fetch('/api/lc/account/submissions', { headers }),
      ]);
      const [statusBody, noticeBody, submissionBody] = await Promise.all([
        statusResponse.json(),
        noticeResponse.json(),
        submissionResponse.json(),
      ]);
      if (!statusResponse.ok || !statusBody.success) throw new Error(statusBody.error || '消息中心加载失败');
      setStatus(statusBody.data);
      if (noticeResponse.ok && noticeBody.success) setNotices(noticeBody.data || []);
      if (submissionResponse.ok && submissionBody.success) setSubmissions(submissionBody.data || EMPTY_SUBMISSIONS);
      if (!submissionResponse.ok || !submissionBody.success) throw new Error(submissionBody.error || '提交记录加载失败');
      if (statusBody.data?.appeal?.status === 'needs_info') {
        setContent(statusBody.data.appeal.content || '');
        setEvidenceText((statusBody.data.appeal.evidence_urls || []).join('\n'));
      }
      if (statusBody.data?.state === 'merged') {
        localStorage.removeItem('lc_creator');
        localStorage.removeItem('lc_admin_token');
        window.dispatchEvent(new Event('lc-auth-changed'));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '消息中心加载失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const unreadCount = notices.filter(item => !item.read_at).length;
  const submissionTypes = useMemo(
    () => Array.from(new Set(submissions.items.map(item => item.type_label))).sort((left, right) => left.localeCompare(right, 'zh-CN')),
    [submissions.items],
  );
  const visibleSubmissions = useMemo(
    () => submissions.items.filter(item => (
      (stateFilter === 'all' || item.state === stateFilter)
      && (typeFilter === 'all' || item.type_label === typeFilter)
    )),
    [stateFilter, submissions.items, typeFilter],
  );

  const setActiveTab = (tab: 'notices' | 'submissions') => {
    setActiveTabState(tab);
    setSearchParams(tab === 'submissions' ? { tab: 'submissions' } : {});
  };

  const submitAppeal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || content.trim().length < 10) return;
    setSubmitting(true);
    setError('');
    try {
      const evidenceUrls = evidenceText.split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, 6);
      const response = await fetch('/api/lc/account/appeals', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), evidenceUrls }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || '申诉提交失败');
      setContent('');
      setEvidenceText('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '申诉提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const markRead = async (item: Notice) => {
    if (!token) return;
    if (!item.read_at) {
      const response = await fetch(`/api/lc/account/notifications/${encodeURIComponent(item.id)}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setNotices(current => current.map(notice => notice.id === item.id ? { ...notice, read_at: new Date().toISOString() } : notice));
      }
    }
    const path = safeInternalPath(item.action_url);
    if (path && path !== '/account-status') navigate(path);
  };

  const markAllRead = async () => {
    if (!token || unreadCount === 0) return;
    const response = await fetch('/api/lc/account/notifications/read-all', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const readAt = new Date().toISOString();
      setNotices(current => current.map(item => ({ ...item, read_at: item.read_at || readAt })));
    }
  };

  if (!auth?.token) {
    return (
      <JumuluPageFrame currentLabel="消息中心" maxWidth={1120}>
        <JumuluCompactHeader eyebrow="我的剧幕录" title="消息中心" description="登录后查看通知、审核结果和全部提交。" />
        <section className="account-center-empty">
          <p>当前没有登录。</p>
          <Link to="/login?redirect=%2Faccount-status" className="account-center-primary-link">登录账号</Link>
        </section>
      </JumuluPageFrame>
    );
  }

  return (
    <JumuluPageFrame currentLabel="消息中心" maxWidth={1120}>
      <JumuluCompactHeader
        eyebrow="我的剧幕录"
        title="消息中心"
        description="通知、审核结果和你提交过的内容都在这里。"
        aside={activeTab === 'notices' && unreadCount > 0
          ? <button type="button" className="account-center-link-button" onClick={() => void markAllRead()}>全部标为已读</button>
          : undefined}
      />

      {loading && <section className="account-center-loading">正在读取消息和提交记录...</section>}
      {error && <section className="account-center-error">{error}</section>}

      {status?.state === 'merged' && (
        <section className="account-center-empty">
          <h2>临时账号已合并</h2>
          <p>{status.message}</p>
          <Link to="/login?redirect=%2Faccount-status" className="account-center-primary-link">重新登录原网站账号</Link>
        </section>
      )}

      {status && status.state !== 'merged' && (
        <>
          <section className={`account-center-status-strip ${status.state === 'restricted' ? 'is-restricted' : ''}`}>
            <span className="account-center-status-dot" />
            <strong>{status.state === 'restricted' ? '账号当前受限' : '账号状态正常'}</strong>
            <span>{status.restriction?.reason || '可以正常浏览、评价和提交内容'}</span>
            {status.state === 'restricted' && (
              <button type="button" onClick={() => setShowAccountDetail(current => !current)}>
                {showAccountDetail ? '收起' : '查看限制与申诉'}
              </button>
            )}
          </section>

          {status.state === 'restricted' && showAccountDetail && (
            <section className="account-center-account-detail">
              <div className="account-center-restriction-copy">
                <div>
                  <span>限制范围</span>
                  <strong>{status.restriction?.scope === 'account' ? '账号全部功能' : '内容发布功能'}</strong>
                </div>
                <div>
                  <span>开始时间</span>
                  <strong>{dateTime(status.restriction?.starts_at) || '未记录'}</strong>
                </div>
                <div>
                  <span>结束时间</span>
                  <strong>{dateTime(status.restriction?.ends_at) || '长期有效'}</strong>
                </div>
                {status.appeal && (
                  <div>
                    <span>申诉进度</span>
                    <strong>{appealStatusLabel(status.appeal.status)}</strong>
                  </div>
                )}
              </div>
              {status.appeal?.admin_reply && <div className="account-center-reply"><strong>管理员回复：</strong>{status.appeal.admin_reply}</div>}
              {(!status.appeal || status.appeal.status === 'needs_info' || ['approved', 'rejected', 'withdrawn'].includes(status.appeal.status)) && (
                <form onSubmit={submitAppeal} className="account-center-appeal">
                  <label>申诉说明
                    <textarea value={content} onChange={event => setContent(event.target.value)} rows={4} maxLength={2000} placeholder="说明具体情况、相关时间和希望如何处理，至少 10 个字。" />
                  </label>
                  <label>补充材料链接（可选）
                    <textarea value={evidenceText} onChange={event => setEvidenceText(event.target.value)} rows={2} placeholder="每行一个链接，最多 6 个" />
                  </label>
                  <button type="submit" disabled={submitting || content.trim().length < 10}>
                    {submitting ? '提交中...' : status.appeal?.status === 'needs_info' ? '补充并重新提交' : '提交申诉'}
                  </button>
                </form>
              )}
              {status.appeal?.status === 'pending' && <p className="account-center-pending">申诉正在处理中，不需要重复提交。</p>}
            </section>
          )}
        </>
      )}

      {status?.state !== 'merged' && (
        <section className="account-center-workspace">
          <div className="account-center-tabs" role="tablist" aria-label="消息中心内容">
            <button type="button" className={activeTab === 'notices' ? 'is-active' : ''} onClick={() => setActiveTab('notices')}>
              通知{unreadCount > 0 && <span>{unreadCount}</span>}
            </button>
            <button type="button" className={activeTab === 'submissions' ? 'is-active' : ''} onClick={() => setActiveTab('submissions')}>
              我的提交<span>{submissions.summary.total}</span>
            </button>
          </div>

          {activeTab === 'notices' ? (
            <div className="account-center-list">
              {notices.length === 0 ? <div className="account-center-list-empty">暂无站内通知。</div> : notices.map(item => (
                <button key={item.id} type="button" className={`account-center-notice ${item.read_at ? '' : 'is-unread'}`} onClick={() => void markRead(item)}>
                  <span className="account-center-notice-dot" />
                  <span className="account-center-notice-copy">
                    <strong>{item.title}</strong>
                    <span>{item.content}</span>
                  </span>
                  <time>{dateTime(item.created_at)}</time>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="account-center-filters">
                <div className="account-center-filter-tabs">
                  {([
                    ['all', `全部 ${submissions.summary.total}`],
                    ['pending', `审核中 ${submissions.summary.pending}`],
                    ['action', `需处理 ${submissions.summary.action_required}`],
                    ['approved', `已公开 ${submissions.summary.approved}`],
                  ] as const).map(([value, label]) => (
                    <button key={value} type="button" className={stateFilter === value ? 'is-active' : ''} onClick={() => setStateFilter(value)}>{label}</button>
                  ))}
                </div>
                <label className="account-center-type-filter">
                  <span>类型</span>
                  <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
                    <option value="all">全部类型</option>
                    {submissionTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
              </div>
              <div className="account-center-list">
                {visibleSubmissions.length === 0 ? <div className="account-center-list-empty">这里还没有符合条件的提交记录。</div> : visibleSubmissions.map(item => (
                  <article key={`${item.kind}-${item.id}`} className="account-center-submission">
                    <div className="account-center-thumbnail">
                      <img src={item.thumbnail_url || '/brand/jumulu-mark.svg'} alt="" />
                    </div>
                    <div className="account-center-submission-copy">
                      <div className="account-center-submission-meta">
                        <span>{item.type_label}</span>
                        <time>{dateTime(item.updated_at || item.created_at)}</time>
                      </div>
                      <h2>{item.title}</h2>
                      {item.content && <p>{item.content}</p>}
                      {item.reject_reason && <div className="account-center-reject"><strong>处理意见：</strong>{item.reject_reason}</div>}
                    </div>
                    <div className="account-center-submission-action">
                      <span className={`account-center-state is-${item.state}`}>{submissionStatusLabel(item)}</span>
                      {safeInternalPath(item.action_url) && (
                        <Link to={safeInternalPath(item.action_url) || '/account-status'}>{submissionActionLabel(item)}</Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </JumuluPageFrame>
  );
}
