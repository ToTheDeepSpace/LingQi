import { useMemo, useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Availability, Creator, Service, Portfolio, ProfileRolePreference, SocialSnapshot } from '../types';
import DraftAutosaveNotice from '../components/DraftAutosaveNotice';
import ReportModal from '../components/ReportModal';
import { generatedAvatarDataUrl } from '../lib/avatar';
import { readStoredCreatorAuth } from '../lib/authSession';
import { normalizeServiceCategory, primaryDisplayIdentityRole, serviceCategoryLabel } from '../lib/serviceCategories';
import { useDraftAutosave } from '../hooks/useDraftAutosave';

const API  = '/api';
const C    = '#fffdf8';
const C2   = '#eef6ff';
const GOLD = '#d9a857';
const INK  = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const ROLE_LABEL: Record<string, string> = {
  player: '玩家', dm: 'DM', shop: '店家', store: '店家',
  creator: '灵契师', coser: 'Coser', photographer: '摄影师', makeup: '妆造师',
  costume: '服装商', prop: '道具师',
};

const card: React.CSSProperties = {
  backgroundColor: '#fffaf2',
  border: '1px solid rgba(201,146,46,0.2)',
  borderRadius: 16, padding: 24,
  boxShadow: '0 14px 34px rgba(31,41,55,0.06)',
};

function getAuth(): { token: string } | null {
  const data = readStoredCreatorAuth();
  return data?.token ? { token: data.token } : null;
}

async function readJsonSafe(url: string) {
  const response = await fetch(url);
  if (!response.ok) return { success: false, data: null };
  try {
    return await response.json();
  } catch {
    return { success: false, data: null };
  }
}

type ContactRequestDraft = {
  name: string;
  wechat: string;
  message: string;
};

export default function CreatorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [creator, setCreator]     = useState<Creator | null>(null);
  const [services, setServices]   = useState<Service[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [availDates, setAvailDates] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading]     = useState(true);

  const [contactShown, setContactShown] = useState(false);
  const [formName, setFormName]         = useState('');
  const [formWechat, setFormWechat]     = useState('');
  const [formMsg, setFormMsg]           = useState('');
  const [paymentProof, setPaymentProof] = useState('');
  const [contactSent, setContactSent]   = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const contactDraftValue = useMemo<ContactRequestDraft>(() => ({
    name: formName,
    wechat: formWechat,
    message: formMsg,
  }), [formMsg, formName, formWechat]);
  const contactDraft = useDraftAutosave<ContactRequestDraft>({
    key: `lc:draft:creator-contact:${id || 'unknown'}`,
    version: 1,
    enabled: !!id && !contactSent,
    value: contactDraftValue,
    shouldSave: data => !!(data.name.trim() || data.wechat.trim() || data.message.trim()),
    onRestore: data => {
      setContactShown(true);
      setFormName(data.name || '');
      setFormWechat(data.wechat || '');
      setFormMsg(data.message || '');
    },
  });

  useEffect(() => {
    if (!id) return;
    Promise.all([
      readJsonSafe(`${API}/lc/creators/${id}`),
      readJsonSafe(`${API}/lc/creators/${id}/availability`),
    ]).then(([profileData, availData]) => {
      if (profileData.success && profileData.data) {
        const { services: svc, portfolio: port, ...profile } = profileData.data;
        setCreator(profile);
        setServices(svc || []);
        setPortfolio(port || []);
      }
      if (availData.success) {
        const items = (availData.data || []) as Availability[];
        setAvailability(items);
        setAvailDates(items.filter(a => !a.is_booked).map(a => a.date));
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const submitContact = async () => {
    if (!formName || !formWechat) return;
    await fetch(`${API}/lc/contact-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creatorId: id,
        requesterName: formName,
        requesterWechat: formWechat,
        message: formMsg,
        intentAmount: creator?.contact_unlock_enabled ? creator.contact_intent_amount || 0 : 0,
        paymentProof,
      }),
    });
    contactDraft.clearDraft();
    setContactSent(true);
  };

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.2)',
    backgroundColor: '#fff', color: INK, fontSize: '0.875rem',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  const openReport = () => {
    const auth = getAuth();
    if (!auth) {
      navigate('/login');
      return;
    }
    setReportOpen(true);
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
        <p style={{ color: MUTED, marginBottom: 20 }}>创作者不存在</p>
        <Link to="/explore" style={{ color: GOLD, fontSize: '0.875rem', textDecoration: 'underline' }}>返回灵契师主页</Link>
      </div>
    </div>
  );

  const availableSlots = availability.filter(item => !item.is_booked);
  const busySlots = availability.filter(item => item.is_booked);
  const profileTags = Array.isArray(creator.tags) ? creator.tags : [];
  const preferredStoryLines = Array.isArray(creator.preferred_story_lines) ? creator.preferred_story_lines : [];
  const identityRoles = Array.isArray(creator.identity_roles) ? creator.identity_roles : [];
  const availableCities = Array.isArray(creator.available_cities) ? creator.available_cities : [];
  const socialLinks = creator.social_links && typeof creator.social_links === 'object' && !Array.isArray(creator.social_links) ? creator.social_links : {};
  const profileTraits = [
    creator.gender && creator.gender !== '不公开' ? `性别：${creator.gender}` : '',
    creator.sexual_orientation && creator.sexual_orientation !== '不公开' ? `取向：${creator.sexual_orientation}` : '',
    ...preferredStoryLines.map(line => `吃${line}`),
  ].filter(Boolean);
  const displayRole = primaryDisplayIdentityRole(
    creator.role_type,
    identityRoles,
    !!creator.verified_dm,
    !!creator.verified_shop,
  );
  const rolePreferences = [...(creator.role_preferences || [])].sort((a, b) => {
    const recDiff = Number(!!b.is_recommended) - Number(!!a.is_recommended);
    if (recDiff !== 0) return recDiff;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
  const recommendedRoles = rolePreferences.filter(item => item.is_recommended);
  const roleGroups = rolePreferences.reduce<{ scriptName: string; roles: ProfileRolePreference[] }[]>((acc, item) => {
    const scriptName = item.script_name || '未命名剧本';
    const existing = acc.find(group => group.scriptName === scriptName);
    if (existing) existing.roles.push(item);
    else acc.push({ scriptName, roles: [item] });
    return acc;
  }, []);

  return (
    <div className="creator-profile-page" style={{ backgroundColor: C, minHeight: '100vh', color: INK }}>

      {/* 顶部 Header */}
      <div className="creator-profile-hero" style={{
        background: `radial-gradient(circle at 18% 0%, rgba(217,168,87,0.16), transparent 32%), linear-gradient(135deg, ${C2}, #fffaf2)`,
        borderBottom: '1px solid rgba(201,146,46,0.2)', padding: '34px 20px 30px',
      }}>
        <div className="creator-profile-hero-inner" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Link to="/explore" className="creator-profile-back-link" style={{ color: 'rgba(39,83,137,0.78)', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20 }}
            onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(39,83,137,0.78)')}>
            ← 返回灵契师主页
          </Link>
          <div className="creator-profile-identity" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div className="creator-profile-avatar" style={{
              width: 92, height: 92, borderRadius: 22, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(217,168,87,0.24), rgba(107,63,160,0.2))',
              border: '2px solid rgba(217,168,87,0.38)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, overflow: 'hidden',
              boxShadow: '0 18px 52px rgba(31,41,55,0.14)',
            }}>
              <img
                src={creator.avatar || generatedAvatarDataUrl(creator.display_name, creator.id)}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div className="creator-profile-title-block">
              <h1 className="creator-profile-title" style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.4rem, 3vw, 2rem)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {creator.display_name}
                {creator.verified_shop && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    padding: '2px 6px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 900,
                    background: '#3b82f6', color: '#fff',
                  }} title="已认证店家">✓ 蓝V</span>
                )}
                {!creator.verified_shop && creator.has_pending_shop_cert && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    padding: '2px 6px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 900,
                    background: '#93c5fd', color: '#1e3a5f',
                    cursor: 'help',
                  }} title="蓝V是官方认证的，淡蓝V是审核中的">✓ 蓝V</span>
                )}
                {creator.verified_dm && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    padding: '2px 8px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 800,
                    background: 'linear-gradient(135deg, #d9a857, #b8860b)', color: '#0F1117',
                  }} title="已认证DM">🎭 已认证DM</span>
                )}
                {!creator.verified_dm && creator.has_pending_dm_cert && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    padding: '2px 8px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700,
                    background: 'rgba(217,168,87,0.2)', color: '#d9a857', border: '1px solid rgba(217,168,87,0.4)',
                    cursor: 'help',
                  }} title="DM认证审核中">🎭 审核中</span>
                )}
              </h1>
              <p style={{ color: MUTED, fontSize: '0.92rem', marginBottom: 10 }}>
                {creator.city || '未知城市'} · {ROLE_LABEL[displayRole] || displayRole || '玩家'}
              </p>
              <div className="creator-profile-badges" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {creator.is_realname && <Badge>⭐ 实名</Badge>}
                {creator.travel_status && <Badge>{creator.travel_status}</Badge>}
                {creator.contact_unlock_enabled && <Badge>预约意向金 ¥{creator.contact_intent_amount || 0}</Badge>}
                <button
                  onClick={openReport}
                  style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(254,242,242,0.86)', border: '1px solid rgba(185,28,28,0.18)', color: 'rgba(185,28,28,0.78)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>
                  举报主页
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="creator-profile-body" style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px 80px' }}>
        <div className="creator-profile-layout" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>

          {/* ── 左侧边栏 ── */}
          <div className="creator-profile-sidebar" style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* 简介卡 */}
            <div className="creator-profile-card" style={card}>
              <h3 style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 12, color: INK }}>灵契师档案</h3>
              {creator.bio && (
                <p style={{ fontSize: '0.875rem', color: MUTED, lineHeight: 1.8, marginBottom: profileTags.length ? 16 : 0 }}>
                  {creator.bio}
                </p>
              )}
              {profileTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {profileTags.map((t, i) => (
                    <span key={i} style={{ padding: '4px 12px', borderRadius: 999, fontSize: '0.78rem', background: 'rgba(201,146,46,0.12)', border: '1px solid rgba(201,146,46,0.28)', color: GOLD }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {profileTraits.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: profileTags.length ? 12 : 0 }}>
                  {profileTraits.map(item => (
                    <span key={item} style={{ padding: '4px 12px', borderRadius: 999, fontSize: '0.78rem', background: 'rgba(239,246,255,0.9)', border: '1px solid rgba(59,130,246,0.16)', color: '#275389' }}>
                      {item}
                    </span>
                  ))}
                </div>
              )}
              {!creator.bio && !profileTags.length && profileTraits.length === 0 && (
                <p style={{ color: 'rgba(71,85,105,0.52)', fontSize: '0.875rem' }}>创作者还没有填写简介</p>
              )}
              {availableCities.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(217,168,87,0.16)' }}>
                  <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.78rem', marginBottom: 8 }}>可接城市</p>
                  <p style={{ color: '#925f18', fontSize: '0.86rem', lineHeight: 1.7 }}>{availableCities.join(' / ')}</p>
                </div>
              )}
            </div>

            {/* 社交快照 */}
            {Object.values(socialLinks).some(Boolean) && (
              <div className="creator-profile-card" style={card}>
                <h3 style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 12, color: INK }}>社交主页</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {Object.entries(socialLinks).filter(([, url]) => url).map(([key, url]) => (
                    <SocialCard key={key} kind={key} url={url} snapshot={creator.social_snapshots?.[key]} />
                  ))}
                </div>
              </div>
            )}

            {/* 联系卡 */}
            <div className="creator-profile-card" style={card}>
              <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8, color: INK }}>发起委托</h3>
              {creator.contact_unlock_enabled && (
                <p style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.78rem', lineHeight: 1.7, marginBottom: 12 }}>
                  对方开启了预约意向金，金额 ¥{creator.contact_intent_amount || 0}。用于确认真实委托意向，申请仍需人工处理。
                </p>
              )}
              {contactShown ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <DraftAutosaveNotice
                    savedAt={contactDraft.savedAt}
                    restoredAt={contactDraft.restoredAt}
                    error={contactDraft.error}
                    note="未提交的预约意向会自动保存到当前浏览器；支付凭证/备注不会保存。"
                  />
                  <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="你的称呼" style={inputStyle} />
                  <input value={formWechat} onChange={e => setFormWechat(e.target.value)} placeholder="你的微信号" style={inputStyle} />
                  <textarea value={formMsg} onChange={e => setFormMsg(e.target.value)} placeholder="想预约什么？（可选）" rows={3}
                    style={{ ...inputStyle, resize: 'none' }} />
                  {creator.contact_unlock_enabled && (
                    <input value={paymentProof} onChange={e => setPaymentProof(e.target.value)} placeholder="预约意向金支付凭证/备注（可选）" style={inputStyle} />
                  )}
                  <button onClick={submitContact} disabled={contactSent}
                    style={{
                      padding: '10px', borderRadius: 10, border: 'none', cursor: contactSent ? 'default' : 'pointer',
                      background: contactSent ? 'rgba(241,245,249,0.86)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                      color: contactSent ? 'rgba(71,85,105,0.6)' : INK,
                      fontWeight: 600, fontSize: '0.875rem',
                    }}>
                    {contactSent ? '已发送 ✓ 等待回复' : '提交预约意向'}
                  </button>
                  {!contactSent && (
                    <p style={{ fontSize: '0.75rem', color: 'rgba(71,85,105,0.56)', textAlign: 'center' }}>
                      通过后再进入联系方式沟通，不引导公开暴露微信。
                    </p>
                  )}
                </div>
              ) : (
                <button onClick={() => setContactShown(true)}
                  style={{
                    width: '100%', padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                    color: INK, fontWeight: 600, fontSize: '0.875rem',
                  }}>
                  申请预约
                </button>
              )}
            </div>
          </div>

          {/* ── 右侧内容 ── */}
          <div className="creator-profile-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {rolePreferences.length > 0 && (
              <div className="creator-profile-card" style={card}>
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 14, color: INK }}>可接本与角色</h3>
                {recommendedRoles.length > 0 && (
                  <div className="creator-role-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 14 }}>
                    {recommendedRoles.slice(0, 6).map((item, index) => (
                      <div key={`${item.script_name}-${item.role_name}-${index}`} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(217,168,87,0.12)', border: '1px solid rgba(201,146,46,0.25)' }}>
                        <span style={{ display: 'inline-flex', marginBottom: 6, padding: '2px 7px', borderRadius: 999, background: 'rgba(255,255,255,0.72)', color: '#925f18', fontSize: '0.68rem', fontWeight: 900 }}>推荐</span>
                        <p style={{ color: INK, fontSize: '0.86rem', fontWeight: 850, lineHeight: 1.45 }}>{item.role_name}{item.role_gender ? `（${item.role_gender}）` : ''}</p>
                        <p style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.74rem', marginTop: 4 }}>{item.script_name}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gap: 12 }}>
                  {roleGroups.map(group => (
                    <div key={group.scriptName} style={{ paddingTop: 12, borderTop: '1px solid rgba(201,146,46,0.12)' }}>
                      <p style={{ color: '#925f18', fontSize: '0.82rem', fontWeight: 900, marginBottom: 8 }}>{group.scriptName}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {group.roles.map((item, index) => (
                          <span key={`${item.role_name}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', padding: '6px 10px', borderRadius: 999, background: item.is_recommended ? 'rgba(217,168,87,0.13)' : 'rgba(255,255,255,0.76)', border: '1px solid rgba(201,146,46,0.18)', color: INK, fontSize: '0.78rem', fontWeight: 800 }}>
                            {item.is_recommended && <span style={{ color: '#925f18', fontSize: '0.68rem' }}>推荐</span>}
                            <span>{item.role_name}{item.role_gender ? `(${item.role_gender})` : ''}</span>
                            {item.role_tags?.slice(0, 2).map(tag => <span key={tag} style={{ color: 'rgba(71,85,105,0.58)', fontWeight: 700 }}>#{tag}</span>)}
                          </span>
                        ))}
                      </div>
                      {group.roles.some(item => item.note) && (
                        <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                          {group.roles.filter(item => item.note).map(item => (
                            <p key={`${item.role_name}-${item.note}`} style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.74rem', lineHeight: 1.6 }}>
                              {item.role_name}：{item.note}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 可接服务 */}
            {services.length > 0 && (
              <div className="creator-profile-card" style={card}>
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: INK }}>可接服务</h3>
                <div>
                  {services.map((s, i) => (
                    <div key={s.id} className="creator-service-row" style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0',
                      borderBottom: i < services.length - 1 ? '1px solid rgba(201,146,46,0.1)' : 'none',
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.925rem' }}>{s.service_type}</span>
                        {normalizeServiceCategory(s.service_type) !== 'custom' && (
                          <span style={{ marginLeft: 8, padding: '3px 8px', borderRadius: 999, background: 'rgba(39,83,137,0.09)', color: '#275389', fontSize: '0.72rem', fontWeight: 850 }}>
                            {serviceCategoryLabel(s.service_type)}
                          </span>
                        )}
                        {s.duration && <span style={{ fontSize: '0.82rem', color: 'rgba(71,85,105,0.62)', marginLeft: 8 }}>· {s.duration}</span>}
                        {s.description && <p style={{ fontSize: '0.8rem', color: 'rgba(71,85,105,0.62)', marginTop: 4 }}>{s.description}</p>}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', color: GOLD, marginLeft: 16, flexShrink: 0 }}>¥{s.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 可约日期 */}
            {availableSlots.length > 0 && (
              <div className="creator-profile-card" style={card}>
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: INK }}>可约日期与地点</h3>
                <div className="creator-date-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                  {availableSlots.slice(0, 40).map(item => (
                    <span key={item.id} style={{ padding: '8px 12px', borderRadius: 12, fontSize: '0.8rem', background: 'rgba(217,168,87,0.12)', border: '1px solid rgba(201,146,46,0.25)', color: '#925f18' }}>
                      <strong>{item.date.slice(5)}</strong>
                      {item.source === 'screenshot' && <span style={{ marginLeft: 6, color: 'rgba(146,95,24,0.62)', fontSize: '0.7rem' }}>截图</span>}
                      <br />
                      <span style={{ color: 'rgba(71,85,105,0.66)', fontSize: '0.75rem' }}>{item.city || creator.city || '地点可议'}{item.location ? ` · ${item.location}` : ''}</span>
                    </span>
                  ))}
                  {availableSlots.length > 40 && (
                    <span style={{ fontSize: '0.8rem', color: 'rgba(71,85,105,0.56)', alignSelf: 'center' }}>
                      +{availableSlots.length - 40} 天
                    </span>
                  )}
                </div>
              </div>
            )}

            {busySlots.length > 0 && (
              <div className="creator-profile-card" style={{ ...card, background: 'linear-gradient(135deg, rgba(239,246,255,0.82), rgba(255,250,242,0.96))', border: '1px solid rgba(59,130,246,0.18)' }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8, color: INK }}>已排档期</h3>
                <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.78rem', lineHeight: 1.7, marginBottom: 14 }}>
                  这些日期来自已排班或已同步档期，默认视为忙碌。
                </p>
                <div className="creator-date-grid creator-busy-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                  {busySlots.slice(0, 24).map(item => (
                    <span key={item.id} style={{ padding: '8px 12px', borderRadius: 12, fontSize: '0.8rem', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', color: '#1e40af' }}>
                      <strong>{item.date.slice(5)}</strong>
                      {item.source === 'juzhanggui' && <span style={{ marginLeft: 6, color: 'rgba(30,64,175,0.62)', fontSize: '0.7rem' }}>剧司辰</span>}
                      <br />
                      <span style={{ color: 'rgba(71,85,105,0.66)', fontSize: '0.75rem' }}>
                        {item.start_time ? `${item.start_time.slice(0, 5)} ` : ''}{item.location || item.city || creator.city || '地点待定'}
                      </span>
                      {item.note && (
                        <span style={{ display: 'block', color: 'rgba(71,85,105,0.56)', fontSize: '0.72rem', marginTop: 4, lineHeight: 1.5 }}>
                          {item.note.replace(/^剧司辰同步：/, '')}
                        </span>
                      )}
                    </span>
                  ))}
                  {busySlots.length > 24 && (
                    <span style={{ fontSize: '0.8rem', color: 'rgba(71,85,105,0.56)', alignSelf: 'center' }}>
                      +{busySlots.length - 24} 条
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 作品集 */}
            {portfolio.length > 0 && (
              <div className="creator-profile-card" style={card}>
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: INK }}>作品集</h3>
                <div className="creator-portfolio-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                  {portfolio.map(p => (
                    <div key={p.id} style={{ aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: 'rgba(201,146,46,0.08)', border: '1px solid rgba(201,146,46,0.12)' }}>
                      <img src={p.image_url} alt={p.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rolePreferences.length === 0 && services.length === 0 && availDates.length === 0 && busySlots.length === 0 && portfolio.length === 0 && (
              <div className="creator-profile-card creator-empty-card" style={{ ...card, textAlign: 'center', padding: '60px 24px' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🌙</div>
                <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.9rem' }}>创作者还没有发布内容</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {reportOpen && (
        <ReportModal
          targetType="profile"
          targetId={creator.id}
          targetTitle={creator.display_name}
          authToken={getAuth()?.token || ''}
          onClose={() => setReportOpen(false)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 760px) {
          .creator-profile-page {
            background: linear-gradient(180deg, #f7fbff 0%, #fffdf8 34%, #fffdf8 100%) !important;
          }
          .creator-profile-hero {
            padding: 14px 12px 12px !important;
            background: linear-gradient(145deg, #eef6ff 0%, #fffaf2 100%) !important;
          }
          .creator-profile-hero-inner {
            max-width: none !important;
          }
          .creator-profile-back-link {
            display: none !important;
          }
          .creator-profile-identity {
            align-items: flex-start !important;
            gap: 12px !important;
            flex-wrap: nowrap !important;
            padding: 12px !important;
            border-radius: 16px !important;
            background: rgba(255,255,255,0.76) !important;
            border: 1px solid rgba(201,146,46,0.16) !important;
            box-shadow: 0 10px 28px rgba(31,41,55,0.06) !important;
          }
          .creator-profile-avatar {
            width: 70px !important;
            height: 70px !important;
            border-radius: 18px !important;
          }
          .creator-profile-title-block {
            min-width: 0 !important;
            flex: 1 !important;
          }
          .creator-profile-title {
            font-size: 1.26rem !important;
            line-height: 1.2 !important;
            gap: 6px !important;
            margin-bottom: 4px !important;
          }
          .creator-profile-title span {
            max-width: 100%;
          }
          .creator-profile-badges {
            gap: 6px !important;
          }
          .creator-profile-badges button,
          .creator-profile-badges span {
            font-size: 0.7rem !important;
          }
          .creator-profile-body {
            padding: 12px 12px 64px !important;
          }
          .creator-profile-layout {
            flex-direction: column !important;
            gap: 12px !important;
            flex-wrap: nowrap !important;
          }
          .creator-profile-sidebar,
          .creator-profile-main {
            width: 100% !important;
            gap: 12px !important;
          }
          .creator-profile-card {
            padding: 14px !important;
            border-radius: 14px !important;
            box-shadow: 0 10px 26px rgba(31,41,55,0.05) !important;
          }
          .creator-profile-card h3 {
            margin-bottom: 10px !important;
          }
          .creator-role-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .creator-service-row {
            align-items: flex-start !important;
            gap: 10px !important;
            padding: 12px 0 !important;
          }
          .creator-service-row > div {
            min-width: 0 !important;
          }
          .creator-date-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .creator-busy-grid {
            grid-template-columns: 1fr !important;
          }
          .creator-portfolio-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }
          .creator-empty-card {
            padding: 36px 16px !important;
          }
        }

        @media (max-width: 380px) {
          .creator-profile-identity {
            flex-wrap: wrap !important;
          }
          .creator-role-grid,
          .creator-date-grid,
          .creator-portfolio-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(217,168,87,0.14)', border: '1px solid rgba(217,168,87,0.25)', color: '#925f18', fontSize: '0.75rem', fontWeight: 800 }}>
      {children}
    </span>
  );
}

function SocialCard({ kind, url, snapshot }: { kind: string; url: string; snapshot?: SocialSnapshot }) {
  const platform = kind === 'douyin' ? '抖音' : kind === 'xiaohongshu' ? '小红书' : '社交主页';
  return (
    <a href={url} target="_blank" rel="noreferrer"
      style={{ display: 'block', padding: 12, borderRadius: 12, border: '1px solid rgba(217,168,87,0.18)', background: 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(239,246,255,0.88))', textDecoration: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <strong style={{ color: INK, fontSize: '0.86rem' }}>{snapshot?.title || `${platform}主页`}</strong>
        <span style={{ color: '#925f18', fontSize: '0.74rem' }}>{platform}</span>
      </div>
      <p style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.76rem', lineHeight: 1.55, wordBreak: 'break-all' }}>
        {snapshot?.description || url}
      </p>
    </a>
  );
}
