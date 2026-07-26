import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { AuthData, Commission, CommissionApplication, ProviderInquiry } from '../types';
import { CITIES } from '../constants/cities';
import { getJsonCached } from '../lib/apiCache';
import { readStoredCreatorAuth } from '../lib/authSession';
import DraftAutosaveNotice from '../components/DraftAutosaveNotice';
import ReportModal from '../components/ReportModal';
import ProfileNameLink from '../components/ProfileNameLink';
import {
  JumuluCompactHeader,
  JumuluPageFrame,
} from '../components/JumuluPageChrome';
import { jumuluCardStyle, jumuluFilterPanelStyle, jumuluPrimaryLinkStyle, jumuluSecondaryLinkStyle } from '../styles/jumuluPageStyles';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import './Commissions.css';

const API = '/api';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 11,
  border: '1px solid rgba(217,168,87,0.25)',
  background: '#fff',
  color: INK,
  padding: '10px 12px',
  outline: 'none',
};

const TARGET_LABEL: Record<string, string> = {
  creator: '服务者',
  photographer: '摄影师',
  makeup: '妆造师',
  costume: '服装商',
  prop: '道具师',
};

type CommissionApplicationDraft = {
  letter: string;
  privateContact: string;
};

function getAuth(): AuthData | null {
  const data = readStoredCreatorAuth();
  return data?.token ? data as AuthData : null;
}

function commissionDateText(item?: Pick<Commission, 'needed_date' | 'needed_end_date'> | null) {
  if (!item?.needed_date) return '';
  if (!item.needed_end_date || item.needed_end_date === item.needed_date) return item.needed_date;
  return `${item.needed_date} 至 ${item.needed_end_date}`;
}

export default function Commissions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<Commission[]>([]);
  const [myItems, setMyItems] = useState<Commission[]>([]);
  const [receivedApplications, setReceivedApplications] = useState<CommissionApplication[]>([]);
  const [sentApplications, setSentApplications] = useState<CommissionApplication[]>([]);
  const [providerReceived, setProviderReceived] = useState<ProviderInquiry[]>([]);
  const [providerSent, setProviderSent] = useState<ProviderInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [city, setCity] = useState(() => {
    try { return localStorage.getItem('lc:commissions:last-city') || 'all'; } catch { return 'all'; }
  });
  const [targetType, setTargetType] = useState('all');
  const [query, setQuery] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [view, setView] = useState<'active' | 'expired'>('active');
  const [cityOpen, setCityOpen] = useState(false);
  const [applicationModal, setApplicationModal] = useState<Commission | null>(null);
  const [applicationLetter, setApplicationLetter] = useState('');
  const [applicationContact, setApplicationContact] = useState('');
  const [applicationError, setApplicationError] = useState('');
  const [applicationDone, setApplicationDone] = useState(false);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState('');
  const [decisionContacts, setDecisionContacts] = useState<Record<string, string>>({});
  const [decisionErrors, setDecisionErrors] = useState<Record<string, string>>({});
  const [providerDecisionContacts, setProviderDecisionContacts] = useState<Record<string, string>>({});
  const [providerDecisionErrors, setProviderDecisionErrors] = useState<Record<string, string>>({});
  const [reportTarget, setReportTarget] = useState<Commission | null>(null);
  const submitted = searchParams.get('submitted') === '1';
  const selectCity = (value: string) => {
    setCity(value);
    try { localStorage.setItem('lc:commissions:last-city', value); } catch { /* optional */ }
    setCityOpen(false);
  };
  const applicationDraftKey = applicationModal ? `lc:draft:commission-application:${applicationModal.id}` : 'lc:draft:commission-application:none';
  const applicationDraftValue = useMemo<CommissionApplicationDraft>(() => ({ letter: applicationLetter, privateContact: applicationContact }), [applicationContact, applicationLetter]);
  const applicationDraft = useDraftAutosave<CommissionApplicationDraft>({
    key: applicationDraftKey,
    version: 1,
    enabled: !!applicationModal && !applicationDone,
    value: applicationDraftValue,
    shouldSave: data => !!data.letter.trim() || !!data.privateContact.trim(),
    onRestore: data => {
      setApplicationLetter(data.letter || '');
      setApplicationContact(data.privateContact || '');
    },
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams();
        if (city !== 'all') qs.set('city', city);
        if (targetType !== 'all') qs.set('targetType', targetType);
        const { data: d } = await getJsonCached<{ success: boolean; data?: Commission[]; error?: string }>(
          `${API}/lc/commissions?${qs.toString()}`,
          undefined,
          15_000,
        );
        if (!alive) return;
        if (d.success) setItems(d.data || []);
        else setError(d.error || '加载失败');
      } catch {
        if (alive) setError('网络错误');
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => { alive = false; };
  }, [city, targetType]);

  useEffect(() => {
    let alive = true;
    const auth = getAuth();
    if (!auth) {
      return () => { alive = false; };
    }
    const loadMine = async () => {
      try {
        const headers = { Authorization: `Bearer ${auth.token}` };
        const [mineRes, receivedRes, sentRes, providerReceivedRes, providerSentRes] = await Promise.all([
          fetch(`${API}/lc/commissions/mine`, { headers }),
          fetch(`${API}/lc/commissions/applications/received`, { headers }),
          fetch(`${API}/lc/commissions/applications/sent`, { headers }),
          fetch(`${API}/lc/provider-inquiries/received`, { headers }),
          fetch(`${API}/lc/provider-inquiries/sent`, { headers }),
        ]);
        const [mine, received, sent, nextProviderReceived, nextProviderSent] = await Promise.all([
          mineRes.json(),
          receivedRes.json(),
          sentRes.json(),
          providerReceivedRes.json(),
          providerSentRes.json(),
        ]);
        if (alive && mine.success) setMyItems(mine.data || []);
        if (alive && received.success) setReceivedApplications(received.data || []);
        if (alive && sent.success) setSentApplications(sent.data || []);
        if (alive && nextProviderReceived.success) setProviderReceived(nextProviderReceived.data || []);
        if (alive && nextProviderSent.success) setProviderSent(nextProviderSent.data || []);
      } catch {
        if (alive) {
          setMyItems([]);
          setReceivedApplications([]);
          setSentApplications([]);
          setProviderReceived([]);
          setProviderSent([]);
        }
      }
    };
    void loadMine();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const auth = getAuth();
    if (!auth) return;
    try { if (localStorage.getItem('lc:commissions:last-city') !== null) return; } catch { /* optional */ }
    fetch(`${API}/lc/follows`, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then(response => response.json())
      .then(payload => {
        const followedCity = payload.success ? payload.data?.cities?.[0] : '';
        if (!followedCity) return;
        setCity(followedCity);
        try { localStorage.setItem('lc:commissions:last-city', followedCity); } catch { /* optional */ }
      })
      .catch(() => undefined);
  }, []);

  const privateItems = myItems.filter(item => item.status !== 'approved');
  const sentApplicationIds = useMemo(() => new Set(sentApplications.map(item => item.commission_id)), [sentApplications]);
  const filteredItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('zh-CN');
    return items.filter(item => {
      const itemStart = String(item.needed_date || '').slice(0, 10);
      const itemEnd = String(item.needed_end_date || item.needed_date || '').slice(0, 10);
      if (dateStart && (!itemEnd || itemEnd < dateStart)) return false;
      if (dateEnd && (!itemStart || itemStart > dateEnd)) return false;
      if (!needle) return true;
      return [item.title, item.content, item.script_name, item.desired_role]
        .join(' ')
        .toLocaleLowerCase('zh-CN')
        .includes(needle);
    });
  }, [dateEnd, dateStart, items, query]);
  const activeItems = useMemo(() => filteredItems.filter(item => !item.is_expired), [filteredItems]);
  const expiredItems = useMemo(() => filteredItems.filter(item => item.is_expired), [filteredItems]);
  const visibleItems = view === 'active' ? activeItems : expiredItems;

  const openApplicationModal = (item: Commission) => {
    if (item.is_expired) return;
    const auth = getAuth();
    if (!auth) {
      navigate('/login');
      return;
    }
    setApplicationModal(item);
    setApplicationLetter('');
    setApplicationContact('');
    setApplicationError('');
    setApplicationDone(false);
  };

  const openReport = (item: Commission) => {
    const auth = getAuth();
    if (!auth) {
      navigate('/login');
      return;
    }
    setReportTarget(item);
  };

  const closeApplicationModal = () => {
    setApplicationModal(null);
    setApplicationLetter('');
    setApplicationContact('');
    setApplicationError('');
    setApplicationDone(false);
    setSubmittingApplication(false);
  };

  const submitApplication = async () => {
    if (!applicationModal) return;
    const auth = getAuth();
    if (!auth) return navigate('/login');
    if (!applicationLetter.trim()) {
      setApplicationError('请先写一段申请信');
      return;
    }
    if (!applicationContact.trim()) {
      setApplicationError('请留下申请通过后用于联系的方式');
      return;
    }
    setSubmittingApplication(true);
    setApplicationError('');
    try {
      const r = await fetch(`${API}/lc/commissions/${applicationModal.id}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ letter: applicationLetter.trim(), privateContact: applicationContact.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        applicationDraft.clearDraft();
        setSentApplications(prev => [{
          id: d.data.id,
          commission_id: applicationModal.id,
          applicant_id: auth.id,
          applicant_name: auth.display_name,
          applicant_is_realname: false,
          letter: applicationLetter.trim(),
          status: 'submitted',
          created_at: new Date().toISOString(),
          commission: {
            id: applicationModal.id,
            title: applicationModal.title,
            city: applicationModal.city,
            needed_date: applicationModal.needed_date,
            has_private_contact: applicationModal.has_private_contact,
            accept_expedition: applicationModal.accept_expedition,
          },
        }, ...prev]);
        setApplicationDone(true);
      } else {
        setApplicationError(d.error || '提交失败');
      }
    } catch {
      setApplicationError('网络错误，请重试');
    } finally {
      setSubmittingApplication(false);
    }
  };

  const decideApplication = async (application: CommissionApplication, decision: 'accepted' | 'rejected') => {
    const auth = getAuth();
    if (!auth) return navigate('/login');
    const contact = decisionContacts[application.id]?.trim() || '';
    if (decision === 'accepted' && !application.commission?.has_private_contact && !contact) {
      setDecisionErrors(current => ({ ...current, [application.id]: '接受前请留下你的联系方式' }));
      return;
    }
    setDecisionBusy(application.id);
    setDecisionErrors(current => ({ ...current, [application.id]: '' }));
    try {
      const response = await fetch(`${API}/lc/commissions/applications/${application.id}/decision`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, privateContact: contact || undefined }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '处理失败');
      setReceivedApplications(current => current.map(item => item.id === application.id ? {
        ...item,
        status: decision,
        decided_at: new Date().toISOString(),
        contacts: payload.data?.contacts || null,
        commission: item.commission ? { ...item.commission, has_private_contact: decision === 'accepted' ? true : item.commission.has_private_contact } : item.commission,
      } : item));
    } catch (decisionError) {
      setDecisionErrors(current => ({ ...current, [application.id]: decisionError instanceof Error ? decisionError.message : '处理失败' }));
    } finally {
      setDecisionBusy('');
    }
  };

  const decideProviderInquiry = async (inquiry: ProviderInquiry, decision: 'accepted' | 'rejected') => {
    const auth = getAuth();
    if (!auth) return navigate('/login');
    const contact = providerDecisionContacts[inquiry.id]?.trim() || '';
    if (decision === 'accepted' && !contact) {
      setProviderDecisionErrors(current => ({ ...current, [inquiry.id]: '同意前请留下你的联系方式' }));
      return;
    }
    setDecisionBusy(inquiry.id);
    setProviderDecisionErrors(current => ({ ...current, [inquiry.id]: '' }));
    try {
      const response = await fetch(`${API}/lc/provider-inquiries/${encodeURIComponent(inquiry.id)}/decision`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, privateContact: contact || undefined }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '处理失败');
      setProviderReceived(current => current.map(item => item.id === inquiry.id ? {
        ...item,
        status: decision,
        decided_at: new Date().toISOString(),
        contacts: payload.data?.contacts || null,
      } : item));
    } catch (decisionError) {
      setProviderDecisionErrors(current => ({ ...current, [inquiry.id]: decisionError instanceof Error ? decisionError.message : '处理失败' }));
    } finally {
      setDecisionBusy('');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条委托需求吗？')) return;
    const auth = getAuth();
    if (!auth) return;
    try {
      const r = await fetch(`${API}/lc/commissions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const d = await r.json();
      if (d.success) {
        setMyItems(prev => prev.filter(item => item.id !== id));
        setItems(prev => prev.filter(item => item.id !== id));
      } else {
        alert(d.error || '删除失败');
      }
    } catch {
      alert('网络错误，请重试');
    }
  };

  return (
    <JumuluPageFrame currentLabel="委托需求">
      <JumuluCompactHeader
        eyebrow="委托需求墙"
        title="写下想见的角色"
        description="默认查看本地委托；发布人可以接受已声明可远征到执行城市的异地委托师。"
        aside={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link to="/commissions/new" style={jumuluPrimaryLinkStyle}>发布委托需求</Link>
            <Link to={city === 'all' ? '/explore' : `/explore?city=${encodeURIComponent(city)}`} style={jumuluSecondaryLinkStyle}>找本地与可远征委托师</Link>
          </div>
        }
      />
        {submitted && (
          <div style={{ marginBottom: 18, borderRadius: 12, border: '1px solid rgba(217,168,87,0.28)', background: 'rgba(217,168,87,0.12)', padding: '14px 16px', color: '#65401c', lineHeight: 1.7 }}>
            已提交成功，正在等待人工审核。审核通过后会公开展示在委托需求墙；在此之前，只有你能在下方“我的委托进度”看到它。
          </div>
        )}

        {privateItems.length > 0 && (
          <section style={{ ...jumuluCardStyle, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 900, marginBottom: 6 }}>我的委托进度</h2>
                <p style={{ color: MUTED, fontSize: '0.86rem', lineHeight: 1.7 }}>
                  这些内容暂时不公开，审核通过后才会进入委托需求墙。
                </p>
              </div>
              <Link to="/commissions/new" style={{ color: GOLD, textDecoration: 'none', fontSize: '0.84rem', fontWeight: 800 }}>继续发布</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {privateItems.map(item => <CommissionCard key={item.id} item={item} showStatus onDelete={() => handleDelete(item.id)} />)}
            </div>
          </section>
        )}

        {providerReceived.length > 0 && (
          <section style={{ ...jumuluCardStyle, padding: 16, borderColor: 'rgba(39,83,137,0.16)', background: '#f8fbff' }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 900, marginBottom: 6 }}>委托条收到的咨询</h2>
              <p style={{ color: MUTED, fontSize: '0.86rem', lineHeight: 1.7 }}>同意后双方立即互相显示各自留下的联系方式。</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {providerReceived.map(inquiry => (
                <article key={inquiry.id} style={{ borderRadius: 8, border: '1px solid rgba(39,83,137,0.14)', background: '#fff', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <ProfileNameLink profileId={inquiry.requester_id}>{inquiry.requester_name}</ProfileNameLink>
                    <ApplicationStatus status={inquiry.status} />
                  </div>
                  <p style={{ margin: '9px 0 0', color: MUTED, lineHeight: 1.7, fontSize: '0.84rem', whiteSpace: 'pre-wrap' }}>{inquiry.message}</p>
                  {inquiry.status === 'submitted' && (
                    <input
                      value={providerDecisionContacts[inquiry.id] || ''}
                      onChange={event => setProviderDecisionContacts(current => ({ ...current, [inquiry.id]: event.target.value }))}
                      placeholder="同意后向对方显示的微信号、手机号或其他联系方式"
                      style={{ ...inputStyle, marginTop: 12 }}
                    />
                  )}
                  {inquiry.contacts && <ProviderContactExchange contacts={inquiry.contacts} ownSide="provider" />}
                  {providerDecisionErrors[inquiry.id] && <p style={{ margin: '9px 0 0', color: '#b42318', fontSize: 12 }}>{providerDecisionErrors[inquiry.id]}</p>}
                  {inquiry.status === 'submitted' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button type="button" disabled={decisionBusy === inquiry.id} onClick={() => void decideProviderInquiry(inquiry, 'accepted')} style={decisionButtonStyle('accepted')}>同意联系</button>
                      <button type="button" disabled={decisionBusy === inquiry.id} onClick={() => void decideProviderInquiry(inquiry, 'rejected')} style={decisionButtonStyle('rejected')}>暂不合适</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {providerSent.length > 0 && (
          <section style={{ ...jumuluCardStyle, padding: 16 }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 900, marginBottom: 6 }}>我发出的委托咨询</h2>
              <p style={{ color: MUTED, fontSize: '0.86rem', lineHeight: 1.7 }}>委托师同意后，这里会立即显示双方联系方式。</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {providerSent.map(inquiry => (
                <article key={inquiry.id} style={{ borderRadius: 8, border: '1px solid rgba(31,41,55,0.1)', background: '#fff', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <ProfileNameLink profileId={inquiry.provider_id}>{inquiry.provider?.display_name || '委托师'}</ProfileNameLink>
                    <ApplicationStatus status={inquiry.status} />
                  </div>
                  <p style={{ margin: '9px 0 0', color: MUTED, lineHeight: 1.7, fontSize: '0.84rem', whiteSpace: 'pre-wrap' }}>{inquiry.message}</p>
                  {inquiry.contacts && <ProviderContactExchange contacts={inquiry.contacts} ownSide="requester" />}
                </article>
              ))}
            </div>
          </section>
        )}

        {receivedApplications.length > 0 && (
          <section style={{ ...jumuluCardStyle, padding: 16, borderColor: 'rgba(39,83,137,0.16)', background: '#f8fbff' }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 900, marginBottom: 6 }}>收到的接单申请</h2>
              <p style={{ color: MUTED, fontSize: '0.86rem', lineHeight: 1.7 }}>
                申请信直接送达，不经过内容审核。接受后双方立即互相显示各自留下的联系方式。
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {receivedApplications.map(app => (
                <article key={app.id} style={{ borderRadius: 8, border: '1px solid rgba(39,83,137,0.14)', background: '#fff', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10, color: 'rgba(71,85,105,0.6)', fontSize: '0.76rem' }}>
                    <span>{app.commission?.title || '委托需求'}</span>
                    <span>{app.created_at?.slice(0, 10)}</span>
                  </div>
                  <h3 style={{ fontWeight: 900, fontSize: '0.98rem', marginBottom: 8, color: '#275389' }}>
                    {app.applicant_is_realname ? '⭐ ' : ''}{app.applicant_name}
                  </h3>
                  <p style={{ color: MUTED, lineHeight: 1.7, fontSize: '0.84rem', whiteSpace: 'pre-wrap' }}>{app.letter}</p>
                  {app.status === 'submitted' && !app.commission?.has_private_contact && (
                    <input
                      value={decisionContacts[app.id] || ''}
                      onChange={event => setDecisionContacts(current => ({ ...current, [app.id]: event.target.value }))}
                      placeholder="接受后向对方显示的微信号、手机号或其他联系方式"
                      style={{ ...inputStyle, marginTop: 12 }}
                    />
                  )}
                  {app.contacts && (
                    <ContactExchange contacts={app.contacts} ownSide="poster" ownLabel="我的联系方式" otherLabel="对方联系方式" />
                  )}
                  {decisionErrors[app.id] && <p style={{ margin: '9px 0 0', color: '#b42318', fontSize: 12 }}>{decisionErrors[app.id]}</p>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {app.status === 'submitted' ? (
                      <>
                        <button type="button" disabled={decisionBusy === app.id} onClick={() => decideApplication(app, 'accepted')} style={decisionButtonStyle('accepted')}>{decisionBusy === app.id ? '处理中...' : '接受申请'}</button>
                        <button type="button" disabled={decisionBusy === app.id} onClick={() => decideApplication(app, 'rejected')} style={decisionButtonStyle('rejected')}>不合适</button>
                      </>
                    ) : <ApplicationStatus status={app.status} />}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {sentApplications.length > 0 && (
          <section style={{ ...jumuluCardStyle, padding: 16 }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 900, marginBottom: 6 }}>我的接单申请</h2>
              <p style={{ color: MUTED, fontSize: '0.86rem', lineHeight: 1.7 }}>委托人接受后，这里会立即显示双方联系方式。</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {sentApplications.map(app => (
                <article key={app.id} style={{ borderRadius: 8, border: '1px solid rgba(31,41,55,0.1)', background: '#fff', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <strong style={{ color: INK }}>{app.commission?.title || '委托需求'}</strong>
                    <ApplicationStatus status={app.status} />
                  </div>
                  <p style={{ margin: '8px 0 0', color: MUTED, fontSize: 12 }}>{[app.commission?.city, commissionDateText(app.commission)].filter(Boolean).join(' · ') || '时间地点待商量'}</p>
                  {app.contacts && <ContactExchange contacts={app.contacts} ownSide="applicant" ownLabel="我的联系方式" otherLabel="委托人联系方式" />}
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="commission-filter-panel" style={jumuluFilterPanelStyle}>
        <div className="commission-filter-top">
          <div className="commission-target-scroll">
            {[
              ['all', '全部'],
              ['creator', '服务者'],
              ['photographer', '摄影师'],
              ['makeup', '妆造师'],
              ['costume', '服装商'],
              ['prop', '道具师'],
            ].map(([key, label]) => {
              const active = targetType === key;
              return (
                <button key={key} onClick={() => setTargetType(key)}
                  style={{
                    padding: '8px 15px', borderRadius: 999, border: active ? `1px solid ${GOLD}` : '1px solid rgba(217,168,87,0.16)',
                    background: active ? 'rgba(217,168,87,0.16)' : 'rgba(255,255,255,0.86)',
                    color: active ? '#925f18' : 'rgba(71,85,105,0.78)', cursor: 'pointer', fontWeight: active ? 800 : 500,
                    whiteSpace: 'nowrap',
                  }}>
                  {label}
                </button>
              );
            })}
          </div>
          <div className="commission-city-filter">
            <button onClick={() => setCityOpen(!cityOpen)}
              style={{ padding: '8px 15px', borderRadius: 999, border: '1px solid rgba(217,168,87,0.24)', background: 'rgba(255,255,255,0.86)', color: city === 'all' ? 'rgba(71,85,105,0.78)' : '#925f18', cursor: 'pointer', fontWeight: 700 }}>
              📍 {city === 'all' ? '全部城市' : city}
            </button>
            {cityOpen && (
              <div style={{ position: 'absolute', right: 0, top: '115%', zIndex: 20, width: 280, maxHeight: 320, overflow: 'auto', padding: 8, borderRadius: 14, background: '#fffdf8', border: '1px solid rgba(217,168,87,0.28)', boxShadow: '0 16px 44px rgba(31,41,55,0.16)' }}>
                <button onClick={() => selectCity('all')} style={cityButton(city === 'all')}>全部城市</button>
                <div style={{ height: 1, background: 'rgba(217,168,87,0.18)', margin: '6px 0' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  {CITIES.map(c => <button key={c} onClick={() => selectCity(c)} style={cityButton(city === c)}>{c}</button>)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(31,41,55,0.08)' }}>
          <div className="commission-filter-grid">
            <div className="commission-filter-field commission-filter-field--query">
              <Label>搜索</Label>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索剧本或角色" style={inputStyle} />
            </div>
            <div className="commission-filter-field commission-filter-field--start">
              <Label>开始日期</Label>
              <input
                type="date"
                value={dateStart}
                onChange={event => {
                  const next = event.target.value;
                  setDateStart(next);
                  if (dateEnd && dateEnd < next) setDateEnd(next);
                }}
                style={inputStyle}
              />
            </div>
            <div className="commission-filter-field commission-filter-field--end">
              <Label>结束日期</Label>
              <input type="date" min={dateStart || undefined} value={dateEnd} onChange={event => setDateEnd(event.target.value)} style={inputStyle} />
            </div>
            <div className="commission-filter-field commission-filter-field--status">
              <Label>状态</Label>
              <div className="commission-status-switch">
              <ViewButton active={view === 'active'} onClick={() => setView('active')}>进行中 {activeItems.length}</ViewButton>
              <ViewButton active={view === 'expired'} onClick={() => setView('expired')}>已过期 {expiredItems.length}</ViewButton>
              </div>
            </div>
          </div>
        </div>
        </section>

        {loading && <StateText text="正在展开委托卷轴..." />}
        {error && <StateText text={error} danger />}
        {!loading && !error && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '92px 20px', border: '1px dashed rgba(217,168,87,0.26)', borderRadius: 8, background: 'rgba(255,250,242,0.82)' }}>
            <div style={{ fontSize: 48, opacity: 0.45, marginBottom: 14 }}>✦</div>
            <p style={{ color: MUTED, marginBottom: 20 }}>这里还没有公开委托</p>
            <Link to="/commissions/new" className="btn-gold" style={{ padding: '10px 22px', textDecoration: 'none' }}>发布第一条</Link>
          </div>
        )}

        {!loading && !error && items.length > 0 && visibleItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '76px 20px', border: '1px dashed rgba(217,168,87,0.26)', borderRadius: 8, background: 'rgba(255,250,242,0.82)' }}>
            <p style={{ color: MUTED, marginBottom: 16 }}>{view === 'active' ? '这个筛选下没有进行中的委托' : '这个筛选下没有已过期委托'}</p>
            <button onClick={() => setView(view === 'active' ? 'expired' : 'active')} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(217,168,87,0.28)', background: 'rgba(255,255,255,0.82)', color: '#925f18', cursor: 'pointer', fontWeight: 800 }}>
              看看{view === 'active' ? '已过期' : '进行中'}
            </button>
          </div>
        )}

        {!loading && !error && visibleItems.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {visibleItems.map(item => (
              <CommissionCard
                key={item.id}
                item={item}
                onApply={() => openApplicationModal(item)}
                onReport={() => openReport(item)}
                applied={sentApplicationIds.has(item.id)}
                ownItem={getAuth()?.id === item.poster_id}
              />
            ))}
          </div>
        )}
      {applicationModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(31,41,55,0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 520, borderRadius: 18, border: '1px solid rgba(217,168,87,0.28)', background: '#fffdf8', boxShadow: '0 24px 70px rgba(31,41,55,0.24)', padding: 28 }}>
            {applicationDone ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>✅</div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.25rem', marginBottom: 8 }}>接单申请已提交</h3>
                <p style={{ color: MUTED, lineHeight: 1.8, marginBottom: 20 }}>
                  申请信已经直接送达委托人。对方接受后，双方联系方式会立即在“我的接单申请”中显示。
                </p>
                <button onClick={closeApplicationModal} className="btn-gold" style={{ padding: '10px 24px' }}>关闭</button>
              </div>
            ) : (
              <>
                <p style={{ color: GOLD, fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.04em', marginBottom: 8 }}>我要接单</p>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.25rem', marginBottom: 8 }}>{applicationModal.title}</h3>
                <p style={{ color: MUTED, lineHeight: 1.75, fontSize: '0.86rem', marginBottom: 16 }}>
                  写清楚你能接什么、可用时间、城市和你希望委托人先知道的条件。不要在这里放敏感隐私。
                </p>
                <div style={{ marginBottom: 12 }}>
                  <DraftAutosaveNotice
                    savedAt={applicationDraft.savedAt}
                    restoredAt={applicationDraft.restoredAt}
                    error={applicationDraft.error}
                    note="这封申请信会自动保存到当前浏览器。"
                  />
                </div>
                <textarea value={applicationLetter} onChange={e => setApplicationLetter(e.target.value)}
                  rows={6}
                  placeholder="例：我可以接这个角色，6月初在上海/杭州都方便。我的风格更偏沉浸陪伴，可以先沟通角色设定和边界..."
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid rgba(217,168,87,0.28)', background: '#fff', color: INK, padding: '12px 14px', resize: 'none', outline: 'none', lineHeight: 1.7 }} />
                <input
                  value={applicationContact}
                  onChange={event => setApplicationContact(event.target.value)}
                  maxLength={300}
                  placeholder="对方接受后显示的微信号、手机号或其他联系方式"
                  style={{ ...inputStyle, marginTop: 12 }}
                />
                <p style={{ margin: '7px 0 0', color: MUTED, fontSize: 12, lineHeight: 1.6 }}>申请阶段不会向委托人显示，只有被接受后双方才会互相看到。</p>
                {applicationError && <p style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: 10 }}>{applicationError}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button onClick={closeApplicationModal}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(217,168,87,0.28)', background: 'transparent', color: MUTED, cursor: 'pointer', fontWeight: 700 }}>取消</button>
                  <button onClick={submitApplication} disabled={!applicationLetter.trim() || !applicationContact.trim() || submittingApplication}
                    className="btn-gold"
                    style={{ flex: 2, padding: '11px', opacity: !applicationLetter.trim() || !applicationContact.trim() || submittingApplication ? 0.55 : 1, cursor: !applicationLetter.trim() || !applicationContact.trim() || submittingApplication ? 'not-allowed' : 'pointer' }}>
                    {submittingApplication ? '提交中...' : '提交申请信'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {reportTarget && (
        <ReportModal
          targetType="commission"
          targetId={reportTarget.id}
          targetTitle={reportTarget.title}
          authToken={getAuth()?.token || ''}
          onClose={() => setReportTarget(null)}
        />
      )}
    </JumuluPageFrame>
  );
}

function CommissionCard({ item, showStatus, onDelete, onApply, onReport, applied, ownItem }: { item: Commission; showStatus?: boolean; onDelete?: () => void; onApply?: () => void; onReport?: () => void; applied?: boolean; ownItem?: boolean }) {
  const expired = !!item.is_expired;
  return (
    <article className="content-card" style={{ ...jumuluCardStyle, padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {showStatus && <StatusPill status={item.status} />}
        {expired && <ExpiredPill />}
        {item.script_name && <Pill>{item.script_name}</Pill>}
        {item.needed_date && <Pill>{commissionDateText(item)}</Pill>}
        {item.city && <Pill>{item.city}</Pill>}
        {item.accept_expedition && <Pill>接受远征</Pill>}
        {item.target_type && <Pill>{TARGET_LABEL[item.target_type] || item.target_type}</Pill>}
      </div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 900, marginBottom: 10, color: INK }}>{item.title}</h2>
      <p style={{ color: MUTED, lineHeight: 1.75, fontSize: '0.9rem', marginBottom: 16, whiteSpace: 'pre-wrap' }}>{item.content}</p>
      <div style={{ display: 'grid', gap: 7, fontSize: '0.8rem', color: 'rgba(71,85,105,0.66)' }}>
        {item.desired_role && <span>想要角色：{item.desired_role}</span>}
        {item.location && <span>地点补充：{item.location}</span>}
        {item.budget && <span>预算：{item.budget}</span>}
        {item.contact_note && <span>联系说明：{item.contact_note}</span>}
        {showStatus && item.status === 'rejected' && item.reject_reason && <span style={{ color: '#b91c1c' }}>未通过原因：{item.reject_reason}</span>}
      </div>
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(217,168,87,0.16)', display: 'flex', justifyContent: 'space-between', gap: 12, color: 'rgba(71,85,105,0.58)', fontSize: '0.78rem' }}>
        <ProfileNameLink profileId={item.poster_id}>{item.poster_is_realname ? '⭐ ' : ''}{item.poster_name}</ProfileNameLink>
        <span>{item.created_at?.slice(0, 10)}</span>
      </div>
      {onDelete && (
        <button onClick={onDelete}
          style={{ marginTop: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.24)', background: 'rgba(254,242,242,0.86)', color: '#b91c1c', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
          删除
        </button>
      )}
      {(onApply || onReport) && (
        <div style={{ display: 'grid', gridTemplateColumns: onApply && onReport ? '1fr auto' : '1fr', gap: 10, marginTop: 14, alignItems: 'center' }}>
          {onApply && (
            <button onClick={onApply} disabled={applied || ownItem || expired}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: applied || ownItem || expired ? '1px solid rgba(125,147,170,0.18)' : '1px solid rgba(217,168,87,0.28)',
                background: applied || ownItem || expired ? 'rgba(241,245,249,0.8)' : 'linear-gradient(135deg, rgba(217,168,87,0.22), rgba(217,168,87,0.12))',
                color: applied || ownItem || expired ? 'rgba(71,85,105,0.52)' : '#925f18',
                cursor: applied || ownItem || expired ? 'not-allowed' : 'pointer',
                fontWeight: 900,
              }}>
              {expired ? '已过期' : ownItem ? '自己的需求' : applied ? '已提交申请' : '我要接单'}
            </button>
          )}
          {onReport && !ownItem && (
            <button onClick={onReport} aria-label="举报这条委托" title="举报"
              style={{ width: 28, minWidth: 28, height: 28, minHeight: 28, padding: 0, borderRadius: 6, border: 0, background: 'transparent', color: 'rgba(71,85,105,0.72)', cursor: 'pointer', fontSize: 16 }}>
              ⚑
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(217,168,87,0.13)', border: '1px solid rgba(217,168,87,0.22)', color: '#925f18', fontSize: '0.75rem', fontWeight: 700 }}>{children}</span>;
}

function ExpiredPill() {
  return <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(241,245,249,0.92)', border: '1px solid rgba(100,116,139,0.22)', color: '#64748b', fontSize: '0.75rem', fontWeight: 800 }}>已过期</span>;
}

function StatusPill({ status }: { status: Commission['status'] }) {
  const map = {
    pending: { label: '待审核', color: GOLD, bg: 'rgba(217,168,87,0.13)', border: 'rgba(217,168,87,0.24)' },
    rejected: { label: '未通过', color: '#b91c1c', bg: 'rgba(254,242,242,0.9)', border: 'rgba(220,38,38,0.24)' },
    approved: { label: '已公开', color: '#166534', bg: 'rgba(240,253,244,0.9)', border: 'rgba(34,197,94,0.22)' },
    closed: { label: '已关闭', color: '#64748b', bg: 'rgba(241,245,249,0.9)', border: 'rgba(100,116,139,0.22)' },
  }[status];
  return <span style={{ padding: '4px 9px', borderRadius: 999, background: map.bg, border: `1px solid ${map.border}`, color: map.color, fontSize: '0.75rem', fontWeight: 800 }}>{map.label}</span>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '0.78rem', fontWeight: 800, marginBottom: 7, color: 'rgba(71,85,105,0.74)' }}>{children}</p>;
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '9px 14px',
      borderRadius: 999,
      border: active ? `1px solid ${GOLD}` : '1px solid rgba(217,168,87,0.18)',
      background: active ? 'rgba(217,168,87,0.16)' : 'rgba(255,255,255,0.86)',
      color: active ? '#925f18' : 'rgba(71,85,105,0.72)',
      cursor: 'pointer',
      fontWeight: 900,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  );
}

function StateText({ text, danger }: { text: string; danger?: boolean }) {
  return <div style={{ textAlign: 'center', padding: '90px 0', color: danger ? '#b91c1c' : 'rgba(71,85,105,0.68)' }}>{text}</div>;
}

function ApplicationStatus({ status }: { status: CommissionApplication['status'] }) {
  const meta = status === 'accepted'
    ? { label: '已接受', color: '#166534', background: '#f0fdf4', border: 'rgba(22,101,52,0.2)' }
    : status === 'rejected'
      ? { label: '不合适', color: '#b42318', background: '#fff6f5', border: 'rgba(180,35,24,0.18)' }
      : { label: '等待处理', color: '#925f18', background: '#fff8e8', border: 'rgba(146,95,24,0.2)' };
  return <span style={{ width: 'fit-content', padding: '4px 8px', borderRadius: 7, border: `1px solid ${meta.border}`, background: meta.background, color: meta.color, fontSize: 11, fontWeight: 900 }}>{meta.label}</span>;
}

function ContactExchange({ contacts, ownSide, ownLabel, otherLabel }: { contacts: { poster: string; applicant: string }; ownSide: 'poster' | 'applicant'; ownLabel: string; otherLabel: string }) {
  const rows = ownSide === 'poster'
    ? [{ label: ownLabel, value: contacts.poster }, { label: otherLabel, value: contacts.applicant }]
    : [{ label: ownLabel, value: contacts.applicant }, { label: otherLabel, value: contacts.poster }];
  return (
    <div style={{ display: 'grid', gap: 7, marginTop: 12, padding: 10, borderRadius: 7, border: '1px solid rgba(22,101,52,0.18)', background: '#f0fdf4' }}>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#475569', fontSize: 12 }}>{row.label}</span>
          <button type="button" onClick={() => navigator.clipboard?.writeText(row.value)} style={{ border: 0, background: 'transparent', color: '#166534', cursor: 'pointer', fontWeight: 900, overflowWrap: 'anywhere', textAlign: 'right' }}>{row.value || '未填写'}</button>
        </div>
      ))}
    </div>
  );
}

function ProviderContactExchange({ contacts, ownSide }: { contacts: { requester: string; provider: string }; ownSide: 'requester' | 'provider' }) {
  const rows = ownSide === 'provider'
    ? [{ label: '我的联系方式', value: contacts.provider }, { label: '咨询人联系方式', value: contacts.requester }]
    : [{ label: '我的联系方式', value: contacts.requester }, { label: '委托师联系方式', value: contacts.provider }];
  return (
    <div style={{ display: 'grid', gap: 7, marginTop: 12, padding: 10, borderRadius: 7, border: '1px solid rgba(22,101,52,0.18)', background: '#f0fdf4' }}>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#475569', fontSize: 12 }}>{row.label}</span>
          <button type="button" onClick={() => navigator.clipboard?.writeText(row.value)} style={{ border: 0, background: 'transparent', color: '#166534', cursor: 'pointer', fontWeight: 900, overflowWrap: 'anywhere', textAlign: 'right' }}>{row.value || '未填写'}</button>
        </div>
      ))}
    </div>
  );
}

function decisionButtonStyle(decision: 'accepted' | 'rejected'): React.CSSProperties {
  const accepted = decision === 'accepted';
  return {
    flex: accepted ? 1.4 : 1,
    minHeight: 38,
    padding: '8px 11px',
    borderRadius: 7,
    border: accepted ? '1px solid rgba(22,101,52,0.22)' : '1px solid rgba(180,35,24,0.18)',
    background: accepted ? '#f0fdf4' : '#fff6f5',
    color: accepted ? '#166534' : '#b42318',
    cursor: 'pointer',
    fontWeight: 900,
  };
}

function cityButton(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    textAlign: 'left',
    padding: '7px 10px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    background: active ? 'rgba(217,168,87,0.14)' : 'transparent',
    color: active ? '#925f18' : 'rgba(71,85,105,0.72)',
    fontWeight: active ? 800 : 500,
    fontSize: '0.82rem',
  };
}
