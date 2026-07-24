import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Availability, Creator, Service, Portfolio, ProfileRolePreference, ScriptCatalogItem, SocialSnapshot } from '../types';
import ReportModal from '../components/ReportModal';
import ReportFlagButton from '../components/ReportFlagButton';
import SocialPlatformLink from '../components/SocialPlatformLink';
import { generatedAvatarDataUrl } from '../lib/avatar';
import { readStoredCreatorAuth } from '../lib/authSession';
import { normalizeServiceCategory, primaryDisplayIdentityRole, serviceCategoryLabel } from '../lib/serviceCategories';
import { formatTravelStatus } from '../lib/travelStatus';

const API  = '/api';
const C    = '#fffdf8';
const GOLD = '#d9a857';
const INK  = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const ROLE_LABEL: Record<string, string> = {
  player: '玩家', dm: 'DM', shop: '店家', store: '店家',
  creator: '服务者', coser: 'Coser', photographer: '摄影师', makeup: '妆造师',
  costume: '服装商', prop: '道具师',
};

const card: React.CSSProperties = {
  backgroundColor: '#fff',
  border: '1px solid rgba(31,41,55,0.08)',
  borderRadius: 8,
  padding: 16,
  boxShadow: 'none',
};

function getAuth(): { token: string } | null {
  const data = readStoredCreatorAuth();
  return data?.token ? { token: data.token } : null;
}

async function readJsonSafe(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) return { success: false, data: null };
  try {
    return await response.json();
  } catch {
    return { success: false, data: null };
  }
}

type PlayerExperience = {
  script_id: string;
  script_name: string;
  is_hidden: boolean;
  sources: Array<{ key: string; label: string }>;
  roles: Array<{ target_id: string; role_name: string; review_lanes: string[] }>;
  updated_at?: string | null;
};

export default function CreatorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [creator, setCreator]     = useState<Creator | null>(null);
  const [services, setServices]   = useState<Service[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [availDates, setAvailDates] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [experiences, setExperiences] = useState<PlayerExperience[]>([]);
  const [scriptCatalog, setScriptCatalog] = useState<ScriptCatalogItem[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState('');
  const [experienceMessage, setExperienceMessage] = useState('');
  const [savingExperience, setSavingExperience] = useState(false);
  const [loading, setLoading]     = useState(true);

  const [contactShown, setContactShown] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [unlockedContact, setUnlockedContact] = useState('');
  const [contactError, setContactError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const auth = readStoredCreatorAuth();
    const authHeaders = auth?.token ? { Authorization: `Bearer ${auth.token}` } : undefined;
    Promise.all([
      readJsonSafe(`${API}/lc/creators/${id}`, { headers: authHeaders }),
      readJsonSafe(`${API}/lc/creators/${id}/availability`),
      readJsonSafe(`${API}/lc/creators/${id}/experiences`, { headers: authHeaders }),
      auth?.id === id ? readJsonSafe(`${API}/lc/scripts`) : Promise.resolve({ success: true, data: [] }),
    ]).then(([profileData, availData, experienceData, scriptData]) => {
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
      if (experienceData.success) setExperiences(experienceData.data?.items || []);
      if (scriptData.success) setScriptCatalog(scriptData.data || []);
    }).finally(() => setLoading(false));
  }, [id]);

  const reloadExperiences = async () => {
    const auth = readStoredCreatorAuth();
    if (!id || !auth?.token) return;
    const payload = await readJsonSafe(`${API}/lc/creators/${id}/experiences`, { headers: { Authorization: `Bearer ${auth.token}` } });
    if (payload.success) setExperiences(payload.data?.items || []);
  };

  const registerScript = async () => {
    const auth = readStoredCreatorAuth();
    if (!auth?.token || !selectedScriptId) return;
    setSavingExperience(true);
    setExperienceMessage('');
    try {
      const response = await fetch(`${API}/lc/player-script-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ scriptId: selectedScriptId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || '登记失败');
      setSelectedScriptId('');
      setExperienceMessage('已登记');
      await reloadExperiences();
    } catch (error) {
      setExperienceMessage(error instanceof Error ? error.message : '登记失败');
    } finally {
      setSavingExperience(false);
    }
  };

  const setExperienceHidden = async (scriptId: string, isHidden: boolean) => {
    const auth = readStoredCreatorAuth();
    if (!auth?.token) return;
    const response = await fetch(`${API}/lc/player-script-records/${encodeURIComponent(scriptId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ isHidden }),
    });
    if (response.ok) await reloadExperiences();
  };

  const openContactForm = async () => {
    const auth = readStoredCreatorAuth();
    if (!auth?.token) {
      navigate(`/login?redirect=${encodeURIComponent(`/creators/${id || ''}`)}`);
      return;
    }
    setContactShown(true);
    setContactLoading(true);
    setContactError('');
    setUnlockedContact('');
    try {
      const response = await fetch(`${API}/lc/provider-listings/${encodeURIComponent(id || '')}/contact-access`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '联系方式读取失败');
      if (!payload.data?.paid) {
        setContactError('请在剧幕录微信小程序支付 8.88 元。支付后同一账号可永久查看这位委托师当前审核通过的业务联系方式。');
      } else if (!payload.data?.contact_available || !payload.data?.business_contact) {
        setContactError('这位委托师暂未开放联系方式。你的永久解锁资格不会失效。');
      } else {
        setUnlockedContact(payload.data.business_contact);
      }
    } catch (error) {
      setContactError(error instanceof Error ? error.message : '联系方式读取失败');
    } finally {
      setContactLoading(false);
    }
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
        <Link to="/explore" style={{ color: GOLD, fontSize: '0.875rem', textDecoration: 'underline' }}>返回服务主页</Link>
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
  const auth = readStoredCreatorAuth();
  const isOwnProfile = auth?.id === creator.id;
  const registeredScriptIds = new Set(experiences.map(item => item.script_id));
  const availableScripts = scriptCatalog.filter(script => !registeredScriptIds.has(script.id));
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

      {/* 公开主页身份区 */}
      <div className="creator-profile-hero" style={{
        background: C,
        padding: '12px 20px 0',
      }}>
        <div className="creator-profile-hero-inner" style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="creator-profile-identity" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: 16, borderRadius: 8, border: '1px solid rgba(31,41,55,0.08)', background: '#fff' }}>
            <div className="creator-profile-avatar" style={{
              width: 80, height: 80, borderRadius: 8, flexShrink: 0,
              background: '#eef6ff',
              border: '1px solid rgba(39,83,137,0.16)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, overflow: 'hidden',
            }}>
              <img
                src={creator.avatar || generatedAvatarDataUrl(creator.display_name, creator.id)}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${creator.avatar_focus_x ?? 50}% ${creator.avatar_focus_y ?? 25}%` }}
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
                {creator.travel_status && <Badge>{formatTravelStatus(creator.travel_status, creator.city)}</Badge>}
                {!isOwnProfile && <button
                  onClick={openReport}
                  aria-label="举报主页"
                  title="举报"
                  style={{ width: 28, height: 28, padding: 0, borderRadius: 6, background: 'transparent', border: 0, color: 'rgba(71,85,105,0.72)', fontSize: 16, cursor: 'pointer' }}>
                  ⚑
                </button>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="creator-profile-body" style={{ maxWidth: 1280, margin: '0 auto', padding: '12px 20px 80px' }}>
        <div className="creator-profile-layout" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>

          {/* ── 左侧边栏 ── */}
          <div className="creator-profile-sidebar" style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* 简介卡 */}
            <div className="creator-profile-card" style={card}>
              <h3 style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 12, color: INK }}>{services.length > 0 || rolePreferences.length > 0 ? '服务者档案' : '个人档案'}</h3>
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
            {creator.provider_listing && <div className="creator-profile-card" style={card}>
              <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8, color: INK }}>联系委托师</h3>
              <p style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.78rem', lineHeight: 1.7, marginBottom: 12 }}>
                同一账号联系同一位委托师只支付一次，永久解锁其审核通过的业务联系方式。
              </p>
              {contactShown ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {contactLoading && <p style={{ margin: 0, color: MUTED, fontSize: '0.8rem' }}>正在读取解锁状态...</p>}
                  {unlockedContact && (
                    <button type="button" onClick={() => void navigator.clipboard.writeText(unlockedContact)} style={{ padding: 11, borderRadius: 7, border: '1px solid rgba(39,83,137,.18)', background: '#eef4fb', color: '#275389', fontWeight: 850, cursor: 'pointer' }}>
                      {unlockedContact} · 点击复制
                    </button>
                  )}
                  {contactError && <p style={{ margin: 0, padding: 10, borderRadius: 7, background: '#fff8e8', color: '#7a4a0c', fontSize: '0.78rem', lineHeight: 1.6 }}>{contactError}</p>}
                </div>
              ) : (
                <button onClick={openContactForm}
                  style={{
                    width: '100%', padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                    color: INK, fontWeight: 600, fontSize: '0.875rem',
                  }}>
                  查看联系方式
                </button>
              )}
            </div>}
          </div>

          {/* ── 右侧内容 ── */}
          <div className="creator-profile-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {creator.provider_listing && (
              <div className="creator-profile-card creator-provider-listing" style={{ ...card, display: 'grid', gridTemplateColumns: 'minmax(220px, 0.8fr) minmax(260px, 1.2fr)', gap: 16 }}>
                <div style={{ position: 'relative', minHeight: 220 }}>
                  <a href={creator.provider_listing.poster_url} target="_blank" rel="noreferrer" style={{ display: 'block', height: '100%' }}>
                    <img
                      src={creator.provider_listing.poster_url}
                      alt={`${creator.display_name}的委托条`}
                      style={{ width: '100%', height: '100%', maxHeight: 380, objectFit: 'cover', borderRadius: 6, background: '#f2ece4' }}
                    />
                  </a>
                  <span style={{ position: 'absolute', right: 5, bottom: 5, borderRadius: 6, background: 'rgba(255,255,255,.9)' }}>
                    <ReportFlagButton targetType="provider_listing" targetId={creator.id} targetSubId="poster:0" targetTitle={`${creator.display_name}的委托条图片`} ownerId={creator.id} />
                  </span>
                </div>
                <div style={{ minWidth: 0, alignSelf: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <p style={{ margin: 0, color: '#925f18', fontWeight: 850, fontSize: 12 }}>委托条</p>
                    <ReportFlagButton targetType="provider_listing" targetId={creator.id} targetTitle={`${creator.display_name}的委托条`} ownerId={creator.id} />
                  </div>
                  <h2 style={{ margin: '7px 0 0', color: INK, fontFamily: 'var(--font-serif)', fontSize: '1.35rem' }}>
                    {creator.provider_listing.headline || `${creator.display_name}的委托资料`}
                  </h2>
                  <p style={{ margin: '9px 0 0', color: MUTED, fontSize: 13 }}>
                    {[
                      creator.provider_listing.height_cm ? `${creator.provider_listing.height_cm}cm` : '',
                      creator.provider_listing.weight_kg ? `${creator.provider_listing.weight_kg}kg` : '',
                    ].filter(Boolean).join(' · ') || '身高体重未填写'}
                  </p>
                  {creator.provider_listing.role_types.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                      {creator.provider_listing.role_types.map(role => <Badge key={role}>{role}</Badge>)}
                    </div>
                  )}
                  {creator.provider_listing.description && (
                    <p style={{ margin: '12px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                      {creator.provider_listing.description}
                    </p>
                  )}
                  {!isOwnProfile && (
                    <button type="button" onClick={openContactForm} style={{ marginTop: 16, padding: '10px 18px', borderRadius: 7, border: 0, background: '#b9781f', color: '#fff', fontWeight: 850, cursor: 'pointer' }}>
                      查看联系方式
                    </button>
                  )}
                </div>
              </div>
            )}

            {(experiences.length > 0 || isOwnProfile) && (
              <div className="creator-profile-card" style={card}>
                <div style={experienceHeaderStyle}>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0, color: INK }}>体验记录</h3>
                    <p style={experienceDescriptionStyle}>登记打过的剧本；公开评价和带明确剧本的红黑榜会自动归档。</p>
                  </div>
                  <span style={experienceCountStyle}>{experiences.filter(item => !item.is_hidden).length} 个本</span>
                </div>

                {isOwnProfile && (
                  <div style={experienceRegisterStyle}>
                    <select value={selectedScriptId} onChange={event => setSelectedScriptId(event.target.value)} style={experienceSelectStyle}>
                      <option value="">选择打过的剧本</option>
                      {availableScripts.map(script => <option key={script.id} value={script.id}>{script.name}</option>)}
                    </select>
                    <button type="button" onClick={() => void registerScript()} disabled={!selectedScriptId || savingExperience} style={experienceAddButtonStyle}>
                      {savingExperience ? '登记中...' : '登记'}
                    </button>
                    {experienceMessage && <span style={experienceMessageStyle}>{experienceMessage}</span>}
                  </div>
                )}

                <div style={experienceListStyle}>
                  {experiences.map(item => (
                    <div key={item.script_id} style={{ ...experienceRowStyle, opacity: item.is_hidden ? 0.56 : 1 }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ color: INK, fontSize: 14 }}>《{item.script_name}》</strong>
                        <div style={experienceSourcesStyle}>
                          {item.sources.map(source => <span key={source.key}>{source.label}</span>)}
                        </div>
                        {item.roles.length > 0 && (
                          <div style={experiencedRolesStyle}>
                            {item.roles.map(role => (
                              <Link key={role.target_id} to={`/scripts/roles/${encodeURIComponent(role.target_id)}`} style={experiencedRoleLinkStyle}>
                                {role.role_name}{role.review_lanes.includes('deep_spoiler') ? ' · 有深评' : ''}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                      {isOwnProfile && (
                        <button type="button" onClick={() => void setExperienceHidden(item.script_id, !item.is_hidden)} style={experienceVisibilityButtonStyle}>
                          {item.is_hidden ? '公开' : '隐藏'}
                        </button>
                      )}
                    </div>
                  ))}
                  {experiences.length === 0 && isOwnProfile && <p style={experienceEmptyStyle}>还没有体验记录，可以先登记一个打过的剧本。</p>}
                </div>
              </div>
            )}

            {rolePreferences.length > 0 && (
              <div className="creator-profile-card" style={card}>
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 14, color: INK }}>可接本与角色</h3>
                {recommendedRoles.length > 0 && (
                  <div className="creator-role-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 14 }}>
                    {recommendedRoles.slice(0, 6).map((item, index) => (
                      <div key={`${item.script_name}-${item.role_name}-${index}`} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(217,168,87,0.10)', border: '1px solid rgba(201,146,46,0.20)' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 16, flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: GOLD }}>¥{s.price}</span>
                        <ReportFlagButton targetType="service" targetId={s.id} targetTitle={`${creator.display_name}的服务`} ownerId={creator.id} />
                      </div>
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
                    <span key={item.id} style={{ padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', background: 'rgba(217,168,87,0.10)', border: '1px solid rgba(201,146,46,0.20)', color: '#925f18' }}>
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
              <div className="creator-profile-card" style={{ ...card, background: '#f8fbff', border: '1px solid rgba(39,83,137,0.14)' }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8, color: INK }}>已排档期</h3>
                <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.78rem', lineHeight: 1.7, marginBottom: 14 }}>
                  这些日期来自已排班或已同步档期，默认视为忙碌。
                </p>
                <div className="creator-date-grid creator-busy-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                  {busySlots.slice(0, 24).map(item => (
                    <span key={item.id} style={{ padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', background: 'rgba(39,83,137,0.07)', border: '1px solid rgba(39,83,137,0.14)', color: '#1e40af' }}>
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
                    <div key={p.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'rgba(201,146,46,0.08)', border: '1px solid rgba(201,146,46,0.12)' }}>
                      <img src={p.image_url} alt={p.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span style={{ position: 'absolute', right: 4, bottom: 4, borderRadius: 6, background: 'rgba(255,255,255,.9)' }}>
                        <ReportFlagButton targetType="portfolio_image" targetId={p.id} targetSubId="image:0" targetTitle={`${creator.display_name}的作品图片`} ownerId={creator.id} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {experiences.length === 0 && !isOwnProfile && !creator.provider_listing && rolePreferences.length === 0 && services.length === 0 && availDates.length === 0 && busySlots.length === 0 && portfolio.length === 0 && (
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
            background: #fffdf8 !important;
          }
          .creator-profile-hero {
            padding: 10px 12px 0 !important;
            background: #fffdf8 !important;
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
            border-radius: 8px !important;
            background: #fff !important;
            border: 1px solid rgba(31,41,55,0.08) !important;
            box-shadow: none !important;
          }
          .creator-profile-avatar {
            width: 70px !important;
            height: 70px !important;
            border-radius: 8px !important;
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
            padding: 10px 12px 64px !important;
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
            border-radius: 8px !important;
            box-shadow: none !important;
          }
          .creator-profile-card h3 {
            margin-bottom: 10px !important;
          }
          .creator-provider-listing {
            grid-template-columns: 1fr !important;
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

const experienceHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 };
const experienceDescriptionStyle: React.CSSProperties = { margin: '5px 0 0', color: MUTED, fontSize: 12, lineHeight: 1.55 };
const experienceCountStyle: React.CSSProperties = { flex: '0 0 auto', color: '#925f18', fontSize: 12, fontWeight: 900 };
const experienceRegisterStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: '1px solid rgba(31,41,55,0.08)', flexWrap: 'wrap' };
const experienceSelectStyle: React.CSSProperties = { minWidth: 210, minHeight: 38, flex: '1 1 260px', border: '1px solid rgba(39,83,137,0.18)', borderRadius: 7, padding: '0 10px', background: '#fff', color: INK, fontSize: 13 };
const experienceAddButtonStyle: React.CSSProperties = { minHeight: 38, border: 0, borderRadius: 7, padding: '0 14px', background: '#275389', color: '#fff', fontWeight: 900, cursor: 'pointer' };
const experienceMessageStyle: React.CSSProperties = { color: MUTED, fontSize: 12 };
const experienceListStyle: React.CSSProperties = { display: 'grid' };
const experienceRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(31,41,55,0.07)' };
const experienceSourcesStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, color: MUTED, fontSize: 11 };
const experiencedRolesStyle: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 };
const experiencedRoleLinkStyle: React.CSSProperties = { borderRadius: 6, padding: '4px 8px', background: '#eef6ff', color: '#275389', fontSize: 11, fontWeight: 850, textDecoration: 'none' };
const experienceVisibilityButtonStyle: React.CSSProperties = { flex: '0 0 auto', minHeight: 30, border: '1px solid rgba(39,83,137,0.16)', borderRadius: 6, padding: '0 9px', background: '#fff', color: '#275389', fontSize: 11, fontWeight: 850, cursor: 'pointer' };
const experienceEmptyStyle: React.CSSProperties = { margin: '12px 0 0', color: MUTED, fontSize: 13 };

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, border: '1px solid rgba(31,41,55,0.08)', background: '#fff' }}>
      <SocialPlatformLink url={url} compact={false} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <strong style={{ display: 'block', color: INK, fontSize: '0.84rem', marginBottom: 3 }}>{snapshot?.title || `${platform}主页`}</strong>
        <p style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.73rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {snapshot?.description || '点击左侧图标打开主页'}
        </p>
      </div>
    </div>
  );
}
