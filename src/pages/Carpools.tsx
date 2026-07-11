import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { AuthData, Carpool, CarpoolApplication } from '../types';
import { CITIES } from '../constants/cities';
import { getJsonCached } from '../lib/apiCache';
import { formatDetailedSubsidy } from '../lib/carpoolMessage';
import { generatedAvatarDataUrl } from '../lib/avatar';
import { readStoredCreatorAuth } from '../lib/authSession';
import DraftAutosaveNotice from '../components/DraftAutosaveNotice';
import ReportModal from '../components/ReportModal';
import {
  JumuluCompactHeader,
  JumuluPageFrame,
} from '../components/JumuluPageChrome';
import { jumuluCardStyle, jumuluFilterPanelStyle, jumuluPrimaryLinkStyle, jumuluSecondaryLinkStyle } from '../styles/jumuluPageStyles';
import { useDraftAutosave } from '../hooks/useDraftAutosave';

const API = '/api';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

function getAuth(): AuthData | null {
  const data = readStoredCreatorAuth();
  return data?.token ? data as AuthData : null;
}

function roleKey(value?: string | null) {
  return (value || '').trim().replace(/\s+/g, '').toLowerCase();
}

function rolesForCarpool(item: Carpool) {
  const roles = Array.isArray(item.script_roles) ? item.script_roles.filter(role => role.role_name) : [];
  if (roles.length > 0) return roles;
  const fallbackName = item.role_name || '待定角色';
  const count = Math.max(1, item.needed_count || 1);
  return Array.from({ length: count }, (_, index) => ({
    role_name: count > 1 ? `${fallbackName} ${index + 1}` : fallbackName,
    gender: null,
    tags: [],
    status: index < (item.joined_count || 0) ? 'seated' as const : 'needed' as const,
    player_name: null,
    player_gender: null,
  }));
}

function applicationForRole(item: Carpool, roleName: string, used: Set<string>) {
  const apps = item.applications || [];
  const exact = apps.find(app => !used.has(app.id) && roleKey(app.role_name) === roleKey(roleName));
  if (exact) {
    used.add(exact.id);
    return exact;
  }
  const next = apps.find(app => !used.has(app.id));
  if (next) used.add(next.id);
  return next || null;
}

type CarpoolApplicationDraft = {
  role: string;
  message: string;
};

export default function Carpools() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<Carpool[]>([]);
  const [myItems, setMyItems] = useState<Carpool[]>([]);
  const [sentApplications, setSentApplications] = useState<{ id: string; carpool_id: string; status: string }[]>([]);
  const [receivedApplications, setReceivedApplications] = useState<CarpoolApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [city, setCity] = useState('all');
  const [date, setDate] = useState('');
  const [script, setScript] = useState('');
  const [view, setView] = useState<'active' | 'expired'>('active');
  const [cityOpen, setCityOpen] = useState(false);
  const [applyModal, setApplyModal] = useState<Carpool | null>(null);
  const [applyRole, setApplyRole] = useState('');
  const [applyMessage, setApplyMessage] = useState('');
  const [applyError, setApplyError] = useState('');
  const [applyDone, setApplyDone] = useState(false);
  const [submittingApply, setSubmittingApply] = useState(false);
  const [contactModal, setContactModal] = useState<{ item: Carpool; loading: boolean; error: string; contact?: { leader_contact: string; contact_note: string | null } } | null>(null);
  const [reportModal, setReportModal] = useState<Carpool | null>(null);
  const submitted = searchParams.get('published') === '1' || searchParams.get('submitted') === '1';
  const applyDraftKey = applyModal ? `lc:draft:carpool-application:${applyModal.id}` : 'lc:draft:carpool-application:none';
  const applyDraftValue = useMemo<CarpoolApplicationDraft>(() => ({ role: applyRole, message: applyMessage }), [applyMessage, applyRole]);
  const applyDraft = useDraftAutosave<CarpoolApplicationDraft>({
    key: applyDraftKey,
    version: 1,
    enabled: !!applyModal && !applyDone,
    value: applyDraftValue,
    shouldSave: data => !!(data.role.trim() || data.message.trim()),
    onRestore: data => {
      if (data.role) setApplyRole(data.role);
      setApplyMessage(data.message || '');
    },
  });

  const loadPublic = useMemo(() => async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (city !== 'all') qs.set('city', city);
      if (date) qs.set('date', date);
      if (script.trim()) qs.set('script', script.trim());
      const { data: d } = await getJsonCached<{ success: boolean; data?: Carpool[]; error?: string }>(
        `${API}/lc/carpools?${qs.toString()}`,
        undefined,
        15_000,
      );
      if (d.success) setItems(d.data || []);
      else setError(d.error || '加载失败');
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, [city, date, script]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPublic(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPublic]);

  useEffect(() => {
    const auth = getAuth();
    if (!auth) return;
    const headers = { Authorization: `Bearer ${auth.token}` };
    Promise.all([
      fetch(`${API}/lc/carpools/mine`, { headers }).then(r => r.json()),
      fetch(`${API}/lc/carpools/applications/sent`, { headers }).then(r => r.json()),
      fetch(`${API}/lc/carpools/applications/received`, { headers }).then(r => r.json()),
    ]).then(([mine, sent, received]) => {
      if (mine.success) setMyItems(mine.data || []);
      if (sent.success) setSentApplications(sent.data || []);
      if (received.success) setReceivedApplications(received.data || []);
    }).catch(() => {
      setMyItems([]);
      setSentApplications([]);
      setReceivedApplications([]);
    });
  }, []);

  const privateItems = myItems.filter(item => item.status !== 'approved');
  const sentIds = useMemo(() => new Set(sentApplications.map(item => item.carpool_id)), [sentApplications]);
  const sentStatus = useMemo(() => new Map(sentApplications.map(item => [item.carpool_id, item.status])), [sentApplications]);
  const activeItems = useMemo(() => items.filter(item => !item.is_expired), [items]);
  const expiredItems = useMemo(() => items.filter(item => item.is_expired), [items]);
  const visibleItems = view === 'active' ? activeItems : expiredItems;

  const openApply = (item: Carpool) => {
    if (item.is_expired) return;
    const auth = getAuth();
    if (!auth) return navigate('/login');
    const taken = new Set((item.applications || []).map(app => roleKey(app.role_name)));
    const firstOpenRole = rolesForCarpool(item).find(role => role.status !== 'seated' && !taken.has(roleKey(role.role_name)));
    setApplyModal(item);
    setApplyRole(firstOpenRole?.role_name || item.role_name || '');
    setApplyMessage('');
    setApplyError('');
    setApplyDone(false);
  };

  const closeApply = () => {
    setApplyModal(null);
    setApplyRole('');
    setApplyMessage('');
    setApplyError('');
    setApplyDone(false);
    setSubmittingApply(false);
  };

  const submitApply = async () => {
    if (!applyModal) return;
    const auth = getAuth();
    if (!auth) return navigate('/login');
    if (!applyMessage.trim()) return setApplyError('请写一段上车申请');
    setSubmittingApply(true);
    setApplyError('');
    try {
      const selectedRole = rolesForCarpool(applyModal).find(role => role.role_name === applyRole);
      const r = await fetch(`${API}/lc/carpools/${applyModal.id}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ roleName: applyRole.trim(), roleGender: selectedRole?.gender || '', message: applyMessage.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        applyDraft.clearDraft();
        setSentApplications(prev => [{ id: d.data.id, carpool_id: applyModal.id, status: 'submitted' }, ...prev]);
        setApplyDone(true);
      } else {
        setApplyError(d.error || '提交失败');
      }
    } catch {
      setApplyError('网络错误，请重试');
    } finally {
      setSubmittingApply(false);
    }
  };

  const openContact = async (item: Carpool) => {
    const auth = getAuth();
    if (!auth) return navigate('/login');
    setContactModal({ item, loading: true, error: '' });
    try {
      const r = await fetch(`${API}/lc/carpools/${item.id}/contact`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const d = await r.json();
      if (d.success) {
        setContactModal({ item, loading: false, error: '', contact: d.data });
      } else {
        setContactModal({ item, loading: false, error: d.error || '联系方式加载失败' });
      }
    } catch {
      setContactModal({ item, loading: false, error: '网络错误，请重试' });
    }
  };

  const openReport = (item: Carpool) => {
    const auth = getAuth();
    if (!auth) return navigate('/login');
    setReportModal(item);
  };

  const reviewApplication = async (id: string, action: 'accept' | 'reject') => {
    const auth = getAuth();
    if (!auth) return navigate('/login');
    try {
      const r = await fetch(`${API}/lc/carpools/applications/${id}/${action}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const d = await r.json();
      if (d.success) {
        setReceivedApplications(prev => prev.map(app => app.id === id ? { ...app, status: action === 'accept' ? 'accepted' : 'rejected' } : app));
        void loadPublic();
      }
    } catch {
      // 列表下次刷新会恢复真实状态。
    }
  };

  const applyRoles = applyModal ? rolesForCarpool(applyModal).filter(role => {
    const taken = new Set((applyModal.applications || []).map(app => roleKey(app.role_name)));
    return role.status !== 'seated' && !taken.has(roleKey(role.role_name));
  }) : [];

  return (
    <JumuluPageFrame currentLabel="拼车区">
      <JumuluCompactHeader
        eyebrow="同城拼车"
        title="找角色，找搭子"
        description="按日期、城市、剧本和角色寻找正在招募的车；补贴与票价折扣保持原始口径展示。"
        aside={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link to="/carpools/new" style={jumuluPrimaryLinkStyle}>发布拼车</Link>
            <Link to="/rankings" style={jumuluSecondaryLinkStyle}>看看红黑榜</Link>
          </div>
        }
      />
        {submitted && (
          <div style={{ marginBottom: 18, borderRadius: 12, border: '1px solid rgba(217,168,87,0.28)', background: 'rgba(217,168,87,0.12)', padding: '14px 16px', color: '#65401c', lineHeight: 1.7 }}>
            拼车已提交审核，通过后才会进入拼车区并同步剧司辰。急单会优先处理，平台会保留提交与审核记录。
          </div>
        )}

        {privateItems.length > 0 && (
          <section style={{ ...jumuluCardStyle, padding: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 900, marginBottom: 12 }}>我的拼车进度</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {privateItems.map(item => <CarpoolCard key={item.id} item={item} showStatus />)}
            </div>
          </section>
        )}

        {receivedApplications.length > 0 && (
          <section style={{ ...jumuluCardStyle, padding: 16, borderColor: 'rgba(39,83,137,0.16)', background: '#f8fbff' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 900, marginBottom: 12 }}>收到的上车申请</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {receivedApplications.map(app => (
                <article key={app.id} style={{ borderRadius: 8, background: '#fff', border: '1px solid rgba(39,83,137,0.14)', padding: 14 }}>
                  <Meta>{app.carpool?.title || '未知拼车'} · {app.created_at?.slice(0, 10)}</Meta>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
                    <img
                      src={app.applicant_avatar || generatedAvatarDataUrl(app.applicant_name, app.applicant_id)}
                      alt=""
                      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(59,130,246,0.2)' }}
                    />
                    <div>
                      <h3 style={{ fontWeight: 900, fontSize: '0.98rem', margin: 0, color: '#275389' }}>{app.applicant_is_realname ? '⭐ ' : ''}{app.applicant_name}{app.role_name ? ` · ${app.role_name}` : ''}</h3>
                      {(app.applicant_gender || app.role_gender) && (
                        <Meta>{app.applicant_gender ? `玩家${app.applicant_gender}` : ''}{app.applicant_gender && app.role_gender ? ' · ' : ''}{app.role_gender ? `角色${app.role_gender}` : ''}</Meta>
                      )}
                    </div>
                  </div>
                  <p style={{ color: MUTED, lineHeight: 1.7, fontSize: '0.84rem', whiteSpace: 'pre-wrap' }}>{app.message}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <StatusChip status={app.status} />
                    {app.status === 'submitted' && (
                      <>
                        <button onClick={() => void reviewApplication(app.id, 'accept')} style={{ ...smallActionStyle, borderColor: 'rgba(22,163,74,0.24)', color: '#166534', background: 'rgba(240,253,244,0.9)' }}>确认上车</button>
                        <button onClick={() => void reviewApplication(app.id, 'reject')} style={{ ...smallActionStyle, borderColor: 'rgba(185,28,28,0.18)', color: '#b91c1c', background: 'rgba(254,242,242,0.82)' }}>拒绝</button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section style={jumuluFilterPanelStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
            <div>
              <Label>日期</Label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <Label>剧本</Label>
              <input value={script} onChange={e => setScript(e.target.value)} placeholder="搜剧本名" style={inputStyle} />
            </div>
            <div style={{ position: 'relative' }}>
              <Label>城市</Label>
              <button onClick={() => setCityOpen(!cityOpen)} style={{ ...inputStyle, textAlign: 'left', cursor: 'pointer' }}>
                📍 {city === 'all' ? '全部城市' : city}
              </button>
              {cityOpen && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 20, maxHeight: 300, overflow: 'auto', padding: 8, borderRadius: 12, background: '#fffdf8', border: '1px solid rgba(217,168,87,0.28)', boxShadow: '0 16px 44px rgba(31,41,55,0.16)' }}>
                  <button onClick={() => { setCity('all'); setCityOpen(false); }} style={cityButton(city === 'all')}>全部城市</button>
                  {CITIES.map(c => <button key={c} onClick={() => { setCity(c); setCityOpen(false); }} style={cityButton(city === c)}>{c}</button>)}
                </div>
              )}
            </div>
            <div>
              <Label>状态</Label>
              <div style={viewSwitchStyle} role="group" aria-label="拼车状态">
                <ViewButton active={view === 'active'} onClick={() => setView('active')}>招募中 {activeItems.length}</ViewButton>
                <ViewButton active={view === 'expired'} onClick={() => setView('expired')}>已过期 {expiredItems.length}</ViewButton>
              </div>
            </div>
            <button onClick={() => void loadPublic()} style={{ ...jumuluPrimaryLinkStyle, width: '100%', minHeight: 44 }}>筛选</button>
          </div>
        </section>

        {loading && <StateText text="正在找车..." />}
        {error && <StateText text={error} danger />}
        {!loading && !error && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '92px 20px', border: '1px dashed rgba(217,168,87,0.26)', borderRadius: 8, background: 'rgba(255,250,242,0.82)' }}>
            <div style={{ fontSize: 48, opacity: 0.45, marginBottom: 14 }}>🚗</div>
            <p style={{ color: MUTED, marginBottom: 20 }}>这里还没有公开拼车</p>
            <Link to="/carpools/new" className="btn-gold" style={{ padding: '10px 22px', textDecoration: 'none' }}>发布第一辆车</Link>
          </div>
        )}

        {!loading && !error && items.length > 0 && visibleItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '76px 20px', border: '1px dashed rgba(217,168,87,0.26)', borderRadius: 8, background: 'rgba(255,250,242,0.82)' }}>
            <p style={{ color: MUTED, marginBottom: 16 }}>{view === 'active' ? '这个筛选下没有招募中的拼车' : '这个筛选下没有已过期拼车'}</p>
            <button onClick={() => setView(view === 'active' ? 'expired' : 'active')} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(217,168,87,0.28)', background: 'rgba(255,255,255,0.82)', color: '#925f18', cursor: 'pointer', fontWeight: 800 }}>
              看看{view === 'active' ? '已过期' : '招募中'}
            </button>
          </div>
        )}

        {!loading && !error && visibleItems.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
            {visibleItems.map(item => (
              <CarpoolCard
                key={item.id}
                item={item}
                onApply={() => openApply(item)}
                onContact={() => void openContact(item)}
                onReport={() => openReport(item)}
                applied={sentIds.has(item.id)}
                applicationStatus={sentStatus.get(item.id)}
                ownItem={getAuth()?.id === item.poster_id}
              />
            ))}
          </div>
        )}
      {applyModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(31,41,55,0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 520, borderRadius: 18, border: '1px solid rgba(217,168,87,0.28)', background: '#fffdf8', boxShadow: '0 24px 70px rgba(31,41,55,0.24)', padding: 28 }}>
            {applyDone ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>✅</div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.25rem', marginBottom: 8 }}>上车申请已提交</h3>
                <p style={{ color: MUTED, lineHeight: 1.8, marginBottom: 20 }}>申请已提交，等车头确认后才会点亮你的头像。</p>
                <button onClick={closeApply} className="btn-gold" style={{ padding: '10px 24px' }}>关闭</button>
              </div>
            ) : (
              <>
                <p style={{ color: GOLD, fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.04em', marginBottom: 8 }}>我要上车</p>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.25rem', marginBottom: 8 }}>{applyModal.title}</h3>
                {applyRoles.length > 0 ? (
                  <div>
                    <Label>想接/想玩的角色</Label>
                    <select value={applyRole} onChange={e => setApplyRole(e.target.value)} style={inputStyle}>
                      {applyRoles.map((role, index) => (
                        <option key={`${role.role_name}-${index}`} value={role.role_name}>
                          {role.role_name}{role.gender ? `（${role.gender}）` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <Input label="想接/想玩的角色" value={applyRole} onChange={setApplyRole} placeholder="可选，例如：姐姐 / NPC / 男A" />
                )}
                <div style={{ marginTop: 12 }}>
                  <DraftAutosaveNotice
                    savedAt={applyDraft.savedAt}
                    restoredAt={applyDraft.restoredAt}
                    error={applyDraft.error}
                    note="这条上车申请会自动保存到当前浏览器。"
                  />
                </div>
                <div style={{ marginTop: 12 }}>
                  <Label>申请说明 *</Label>
                  <textarea value={applyMessage} onChange={e => setApplyMessage(e.target.value)} rows={6}
                    placeholder="写清楚你能来的时间、想玩的角色、现金补贴或票价折扣预期、是否能接受反串/换角色..."
                    style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }} />
                </div>
                {applyError && <p style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: 10 }}>{applyError}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button onClick={closeApply} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(217,168,87,0.28)', background: 'transparent', color: MUTED, cursor: 'pointer', fontWeight: 700 }}>取消</button>
                  <button onClick={submitApply} disabled={!applyMessage.trim() || submittingApply} className="btn-gold"
                    style={{ flex: 2, padding: '11px', opacity: !applyMessage.trim() || submittingApply ? 0.55 : 1, cursor: !applyMessage.trim() || submittingApply ? 'not-allowed' : 'pointer' }}>
                    {submittingApply ? '提交中...' : '提交上车申请'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {contactModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(31,41,55,0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 460, borderRadius: 18, border: '1px solid rgba(217,168,87,0.28)', background: '#fffdf8', boxShadow: '0 24px 70px rgba(31,41,55,0.24)', padding: 26 }}>
            <p style={{ color: GOLD, fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.04em', marginBottom: 8 }}>联系车头</p>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.15rem', marginBottom: 12 }}>{contactModal.item.title}</h3>
            {contactModal.loading && <p style={{ color: MUTED, lineHeight: 1.8 }}>正在读取联系方式...</p>}
            {!contactModal.loading && contactModal.error && <p style={{ color: '#b91c1c', lineHeight: 1.8 }}>{contactModal.error}</p>}
            {!contactModal.loading && contactModal.contact && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ borderRadius: 12, background: 'rgba(239,246,255,0.82)', border: '1px solid rgba(59,130,246,0.16)', padding: 14 }}>
                  <Label>车头微信/联系方式</Label>
                  <p style={{ fontWeight: 900, color: INK, wordBreak: 'break-all' }}>{contactModal.contact.leader_contact || '发布者没有填写联系方式'}</p>
                </div>
                {contactModal.contact.contact_note && (
                  <p style={{ color: MUTED, lineHeight: 1.7, fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>{contactModal.contact.contact_note}</p>
                )}
              </div>
            )}
            <button onClick={() => setContactModal(null)} className="btn-gold" style={{ width: '100%', padding: '10px 18px', marginTop: 18 }}>关闭</button>
          </div>
        </div>
      )}

      {reportModal && (
        <ReportModal
          targetType="carpool"
          targetId={reportModal.id}
          targetTitle={reportModal.title}
          authToken={getAuth()?.token || ''}
          onClose={() => setReportModal(null)}
        />
      )}
    </JumuluPageFrame>
  );
}

function CarpoolCard({ item, showStatus, onApply, onContact, onReport, applied, applicationStatus, ownItem }: { item: Carpool; showStatus?: boolean; onApply?: () => void; onContact?: () => void; onReport?: () => void; applied?: boolean; applicationStatus?: string; ownItem?: boolean }) {
  const subsidyText = formatDetailedSubsidy(item);
  const roleRows = rolesForCarpool(item);
  const expired = !!item.is_expired;
  const seatedCount = roleRows.filter(role => role.status === 'seated').length;
  const acceptedCount = item.applications?.length || Math.max(0, (item.joined_count || 0) - seatedCount);
  const occupiedCount = Math.max(item.joined_count || 0, seatedCount + acceptedCount);
  const totalSlots = Math.max(roleRows.length, seatedCount + (item.needed_count || 1), 1);
  const full = roleRows.length > 0 && (acceptedCount >= Math.max(1, item.needed_count || 1) || occupiedCount >= totalSlots);
  return (
    <article className="content-card" style={{ ...jumuluCardStyle, padding: 14, borderColor: item.boost_amount > 0 ? 'rgba(217,168,87,0.45)' : 'rgba(31,41,55,0.08)' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {showStatus && <StatusPill status={item.status} />}
        {expired && <ExpiredPill />}
        {item.boost_amount > 0 && <Pill>置顶加权 {item.boost_amount}</Pill>}
        <Pill>{item.event_date}</Pill>
        {item.deadline_date && <Pill>截止 {item.deadline_date}{item.deadline_time ? ` ${item.deadline_time}` : ''}</Pill>}
        <Pill>{item.city}</Pill>
        <Pill>{subsidyText}</Pill>
      </div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, lineHeight: 1.3, fontWeight: 900, marginBottom: 6, color: INK }}>{item.title}</h2>
      <Meta>{item.script_name}{item.role_name ? ` · ${item.role_name}` : ''}{item.start_time ? ` · ${item.start_time}` : ''}</Meta>
      <SeatBoard item={item} />
      <p style={{ color: MUTED, lineHeight: 1.65, fontSize: 13, margin: '10px 0 12px', whiteSpace: 'pre-wrap' }}>{item.content}</p>
      <div style={{ display: 'grid', gap: 6, fontSize: 12, lineHeight: 1.55, color: 'rgba(71,85,105,0.66)' }}>
        {item.role_note && <span>角色说明：{item.role_note}</span>}
        <span>上车：{occupiedCount}/{totalSlots}</span>
        {item.store_name && <span>店家：{item.store_name}{item.store_address ? ` · ${item.store_address}` : ''}</span>}
        {showStatus && item.leader_contact && <span>车头联系方式：{item.leader_contact}</span>}
        {showStatus && item.contact_note && <span>联系说明：{item.contact_note}</span>}
        {item.juzhanggui_sync_status === 'synced' && <span>已同步到剧司辰排期草稿</span>}
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(217,168,87,0.16)', display: 'flex', justifyContent: 'space-between', gap: 12, color: 'rgba(71,85,105,0.58)', fontSize: 12 }}>
        <span>{item.poster_is_realname ? '⭐ ' : ''}{item.poster_name}</span>
        <span>{item.created_at?.slice(0, 10)}</span>
      </div>
      {(onApply || onContact || onReport) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8, marginTop: 12 }}>
          {onApply && (
            <button onClick={onApply} disabled={applied || ownItem || full || expired}
              style={{
                minHeight: 36, padding: '0 12px', borderRadius: 8,
                border: applied || ownItem || full || expired ? '1px solid rgba(125,147,170,0.18)' : '1px solid rgba(217,168,87,0.28)',
                background: applied || ownItem || full || expired ? 'rgba(241,245,249,0.8)' : 'linear-gradient(135deg, rgba(217,168,87,0.22), rgba(217,168,87,0.12))',
                color: applied || ownItem || full || expired ? 'rgba(71,85,105,0.52)' : '#925f18',
                cursor: applied || ownItem || full || expired ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 900,
              }}>
              {expired ? '已过期' : ownItem ? '自己的拼车' : applicationStatus === 'accepted' ? '已上车' : applicationStatus === 'rejected' ? '未通过' : applied ? '待车头确认' : full ? '已满' : '我要上车'}
            </button>
          )}
          {onContact && (
            <button onClick={onContact} disabled={expired}
              style={{
                minHeight: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(39,83,137,0.24)',
                background: expired ? 'rgba(241,245,249,0.8)' : 'rgba(239,246,255,0.86)',
                color: expired ? 'rgba(71,85,105,0.52)' : '#275389',
                cursor: expired ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 900,
              }}>
              {expired ? '已过期' : '联系车头'}
            </button>
          )}
          {onReport && (
            <button onClick={onReport}
              style={{
                minHeight: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(185,28,28,0.18)',
                background: 'rgba(254,242,242,0.82)', color: '#b91c1c', cursor: 'pointer', fontSize: 13, fontWeight: 900,
              }}>
              举报
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function StatusChip({ status }: { status: CarpoolApplication['status'] }) {
  const map = {
    submitted: { label: '待车头确认', color: '#925f18', bg: 'rgba(254,243,199,0.72)', border: 'rgba(245,158,11,0.22)' },
    accepted: { label: '已确认上车', color: '#166534', bg: 'rgba(240,253,244,0.9)', border: 'rgba(22,163,74,0.22)' },
    rejected: { label: '已拒绝', color: '#b91c1c', bg: 'rgba(254,242,242,0.82)', border: 'rgba(185,28,28,0.18)' },
  }[status];
  return <span style={{ padding: '6px 10px', borderRadius: 999, border: `1px solid ${map.border}`, background: map.bg, color: map.color, fontSize: '0.75rem', fontWeight: 900 }}>{map.label}</span>;
}

function SeatBoard({ item }: { item: Carpool }) {
  const used = new Set<string>();
  const roles = rolesForCarpool(item);
  if (roles.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(86px, 1fr))', gap: 10, marginTop: 14 }}>
      {roles.map((role, index) => {
        const app = applicationForRole(item, role.role_name, used);
        const occupied = !!app || role.status === 'seated';
        const name = app?.applicant_name || role.player_name || '';
        const gender = app?.applicant_gender || role.player_gender || '';
        const avatar = app?.applicant_avatar || (name ? generatedAvatarDataUrl(name, app?.applicant_id || `${item.id}-${index}`) : '');
        return (
          <div key={`${role.role_name}-${index}`} style={{
            minHeight: 112,
            borderRadius: 8,
            border: occupied ? '1px solid rgba(22,163,74,0.24)' : '1px dashed rgba(125,147,170,0.24)',
            background: occupied ? 'rgba(240,253,244,0.9)' : 'rgba(248,250,252,0.86)',
            padding: 10,
            display: 'grid',
            justifyItems: 'center',
            alignContent: 'center',
            gap: 6,
            textAlign: 'center',
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: occupied ? 'linear-gradient(135deg, rgba(217,168,87,0.28), rgba(34,197,94,0.22))' : 'rgba(226,232,240,0.9)',
              border: occupied ? '2px solid rgba(22,163,74,0.28)' : '2px solid rgba(148,163,184,0.2)',
              color: occupied ? '#166534' : 'rgba(100,116,139,0.58)',
              fontWeight: 900,
              fontSize: '0.9rem',
            }}>
              {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '空'}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: INK, fontSize: '0.78rem', fontWeight: 900, margin: 0, overflowWrap: 'anywhere' }}>{role.role_name}</p>
              <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.72rem', marginTop: 3, lineHeight: 1.45 }}>
                {role.gender ? `角色${role.gender}` : '角色性别未填'}
                {occupied && gender ? ` · 玩家${gender}` : ''}
              </p>
              <p style={{ color: occupied ? '#166534' : 'rgba(100,116,139,0.62)', fontSize: '0.72rem', fontWeight: 800, marginTop: 3, overflowWrap: 'anywhere' }}>
                {occupied ? (name || '已上车') : '待上车'}
              </p>
              {role.tags && role.tags.length > 0 && (
                <p style={{ color: '#925f18', fontSize: '0.68rem', fontWeight: 800, marginTop: 4, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                  {role.tags.slice(0, 3).join(' / ')}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '0.78rem', fontWeight: 800, marginBottom: 7, color: 'rgba(71,85,105,0.74)' }}>{children}</p>;
}

function Meta({ children }: { children: React.ReactNode }) {
  return <p style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.8rem', lineHeight: 1.7, margin: 0 }}>{children}</p>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(217,168,87,0.13)', border: '1px solid rgba(217,168,87,0.22)', color: '#925f18', fontSize: '0.75rem', fontWeight: 700 }}>{children}</span>;
}

function ExpiredPill() {
  return <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(241,245,249,0.92)', border: '1px solid rgba(100,116,139,0.22)', color: '#64748b', fontSize: '0.75rem', fontWeight: 800 }}>已过期</span>;
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      flex: 1,
      minWidth: 0,
      minHeight: 36,
      padding: '0 8px',
      borderRadius: 7,
      border: 'none',
      background: active ? 'rgba(217,168,87,0.18)' : 'transparent',
      color: active ? '#925f18' : 'rgba(71,85,105,0.68)',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 900,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: Carpool['status'] }) {
  const map = {
    pending: { label: '待审核', color: GOLD, bg: 'rgba(217,168,87,0.13)', border: 'rgba(217,168,87,0.24)' },
    rejected: { label: '未通过', color: '#b91c1c', bg: 'rgba(254,242,242,0.9)', border: 'rgba(220,38,38,0.24)' },
    approved: { label: '已公开', color: '#166534', bg: 'rgba(240,253,244,0.9)', border: 'rgba(34,197,94,0.22)' },
    closed: { label: '已关闭', color: '#64748b', bg: 'rgba(241,245,249,0.9)', border: 'rgba(100,116,139,0.22)' },
  }[status];
  return <span style={{ padding: '4px 9px', borderRadius: 999, background: map.bg, border: `1px solid ${map.border}`, color: map.color, fontSize: '0.75rem', fontWeight: 800 }}>{map.label}</span>;
}

function StateText({ text, danger }: { text: string; danger?: boolean }) {
  return <div style={{ textAlign: 'center', padding: '90px 0', color: danger ? '#b91c1c' : 'rgba(71,85,105,0.68)' }}>{text}</div>;
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 44,
  borderRadius: 10,
  border: '1px solid rgba(217,168,87,0.25)',
  background: '#fff',
  color: INK,
  padding: '0 12px',
  fontSize: 14,
  outline: 'none',
};

const viewSwitchStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  padding: 3,
  borderRadius: 10,
  border: '1px solid rgba(217,168,87,0.25)',
  background: '#fff',
};

const smallActionStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid rgba(217,168,87,0.24)',
  cursor: 'pointer',
  fontSize: '0.75rem',
  fontWeight: 900,
};
