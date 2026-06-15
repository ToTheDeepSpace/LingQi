import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import DraftAutosaveNotice from '../components/DraftAutosaveNotice';
import ImageUpload from '../components/ImageUpload';
import { generatedAvatarDataUrl } from '../lib/avatar';
import { isTokenExpired, readStoredCreatorAuth } from '../lib/authSession';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import type { Creator, Service, Portfolio, AuthData, Availability, ProfileRolePreference, ScriptCatalogItem } from '../types';

const API  = '/api';
const C    = '#fffdf8';
const C2   = '#eef6ff';
const GOLD = '#d9a857';
const INK  = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';
const ONBOARDING_STORAGE_KEY = 'lc_onboarding_pending';

function getToken(): string {
  try {
    const stored = localStorage.getItem('lc_creator');
    return stored ? (JSON.parse(stored) as AuthData).token : '';
  } catch { return ''; }
}

const TABS = [
  { id: 'profile',      label: '资料',   icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0z M12 14c-3.3 0-6 1.8-6 4v1h12v-1c0-2.2-2.7-4-6-4z' },
  { id: 'services',    label: '服务',   icon: 'M4 6h16M4 10h16M4 14h12 M8 18l2 2 4-4' },
  { id: 'availability',label: '档期',   icon: 'M8 2v4M16 2v4M3 10h18M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7' },
  { id: 'portfolio',   label: '作品',   icon: 'M4 16l4.6-4.6 3.4 3.4L18 9l4 4V6a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2h12 M6 7h.01' },
  { id: 'posts',       label: '我的发布', icon: 'M4 5h16M4 12h16M4 19h10' },
] as const;

type MyRanking = {
  id: string;
  type: 'red' | 'black' | 'white';
  subject_name: string;
  subject_city?: string | null;
  initial_amount: number;
  likes: number;
  dislikes: number;
  joys: number;
  boost_amount?: number;
  negative_boost_amount?: number;
  agree_count?: number;
  oppose_count?: number;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
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

type AvailabilityImportDraft = {
  city: string;
  location: string;
  text: string;
};

const card: React.CSSProperties = {
  backgroundColor: '#fffaf2',
  border: '1px solid rgba(201,146,46,0.22)',
  borderRadius: 16, padding: 24,
  boxShadow: '0 14px 34px rgba(31,41,55,0.06)',
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
    bio: '',
    city: '',
    wechat: '',
    tags: '',
    douyin: '',
    xiaohongshu: '',
    available_cities: '',
    travel_status: '常驻本地',
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
    travel_status: profile.travel_status || '常驻本地',
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

function hasServiceSetup(form: ProfileForm, services: Service[], rolePreferences: RolePreferenceDraft[]) {
  return services.length > 0
    || rolePreferences.length > 0
    || !!form.available_cities.trim()
    || !!form.wechat.trim()
    || !!form.contact_unlock_enabled
    || !!form.contact_intent_amount.trim();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [creator, setCreator]   = useState<Creator | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [myRankings, setMyRankings] = useState<MyRanking[]>([]);
  const [myCommissions, setMyCommissions] = useState<MyCommission[]>([]);
  const [myCarpools, setMyCarpools] = useState<MyCarpool[]>([]);
  const [scripts, setScripts] = useState<ScriptCatalogItem[]>([]);
  const [rolePreferences, setRolePreferences] = useState<RolePreferenceDraft[]>([]);
  const [roleDraft, setRoleDraft] = useState<RolePreferenceDraft>(() => blankRolePreferenceDraft());
  const [tab, setTab]           = useState('profile');
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(true);

  const [form, setForm] = useState<ProfileForm>(() => blankProfileForm());
  const [newSvc, setNewSvc] = useState<ServiceDraft>({ service_type: '', price: '', duration: '', description: '' });
  const [availDates, setAvailDates] = useState<string[]>([]);
  const [availItems, setAvailItems] = useState<Availability[]>([]);
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
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1');
  const [offersServices, setOffersServices] = useState(false);

  const token = getToken();

  const applyAvailability = (items: Availability[]) => {
    setAvailItems(items || []);
    setAvailDates((items || []).filter(a => !a.is_booked).map(a => a.date));
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
      fetch(`${API}/lc/creators/${data.id}/availability`).then(r => r.json()),
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
  const serviceDraft = useDraftAutosave<ServiceDraft>({
    key: 'lc:draft:dashboard:service',
    version: 1,
    enabled: !!creator,
    value: newSvc,
    shouldSave: data => !!(data.service_type.trim() || data.price.trim() || data.duration.trim() || data.description.trim()),
    onRestore: data => setNewSvc({
      service_type: data.service_type || '',
      price: data.price || '',
      duration: data.duration || '',
      description: data.description || '',
    }),
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
        douyin: form.douyin.trim(),
        xiaohongshu: form.xiaohongshu.trim(),
      };
      const r = await fetch(`${API}/lc/creators/${creator.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          display_name: form.display_name,
          avatar: avatarOverride ?? form.avatar,
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
    setForm(prev => ({ ...prev, avatar: url }));
    void saveProfile(url);
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
    const r = await fetch(`${API}/lc/creators/${creator.id}/availability`);
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

  const addService = async () => {
    if (!creator || !newSvc.service_type || !newSvc.price) return;
    setError('');
    const r = await fetch(`${API}/lc/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ creatorId: creator.id, serviceType: newSvc.service_type, price: parseFloat(newSvc.price), duration: newSvc.duration, description: newSvc.description }),
    });
    const d = await r.json();
    if (d.success) {
      serviceDraft.clearDraft();
      setNewSvc({ service_type: '', price: '', duration: '', description: '' });
      setMsg(d.data?.message || '服务已提交审核，通过后才会公开展示');
      setTimeout(() => setMsg(''), 3000);
    }
    else setError(d.error || '添加失败');
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
    if (!confirm('确定撤回这条待审核口碑吗？撤回后不会进入审核队列。')) return;
    setError('');
    try {
      const r = await fetch(`${API}/lc/rankings/${id}/withdraw`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) {
        setMyRankings(prev => prev.map(item => item.id === id ? { ...item, status: 'withdrawn' } : item));
        setMsg('口碑已撤回');
        setTimeout(() => setMsg(''), 2500);
      } else {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '撤回失败');
        setError(msg);
      }
    } catch {
      setError('网络错误，请重试');
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

  const toggleDate = async (date: Date) => {
    if (!creator) return;
    const dateStr = formatDateKey(date);
    const isSet = availDates.includes(dateStr);
    if (isSet) {
      const item = availItems.find(a => !a.is_booked && a.date === dateStr);
      if (item) {
        const r = await fetch(`${API}/lc/availability/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (d.success) {
          setAvailDates(availDates.filter(ds => ds !== dateStr));
          setAvailItems(availItems.filter(a => a.id !== item.id));
        }
      }
    } else {
      const r = await fetch(`${API}/lc/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          creatorId: creator.id, date: dateStr, startTime: '09:00', endTime: '22:00',
          city: availCity || form.city || null,
          location: availLocation || null,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg(d.data?.message || '档期已提交审核，通过后才会公开展示');
        setTimeout(() => setMsg(''), 3000);
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('lc_creator');
    window.dispatchEvent(new Event('lc-auth-changed'));
    navigate('/login');
  };

  const closeOnboarding = () => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
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

  const tabBtn = (id: string, label: string, iconPath: string) => (
    <button key={id} className="dashboard-tab-btn" onClick={() => setTab(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
        fontWeight: 600, fontSize: '0.875rem', textAlign: 'left', width: '100%',
        background: tab === id ? `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)` : 'transparent',
        color: tab === id ? INK : 'rgba(71,85,105,0.74)',
        transition: 'all 0.2s',
      }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={iconPath} />
      </svg>
      {label}
    </button>
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
  const busyDateSet = new Set(busyItems.map(item => item.date));

  return (
    <div className="dashboard-page" style={{ backgroundColor: C, minHeight: '100vh', color: INK }}>
      {showOnboarding && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(15,23,42,0.42)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            width: '100%',
            maxWidth: 520,
            borderRadius: 18,
            background: '#fffdf8',
            border: '1px solid rgba(201,146,46,0.28)',
            boxShadow: '0 28px 80px rgba(15,23,42,0.22)',
            padding: 24,
          }}>
            <p style={{ color: '#925f18', fontWeight: 900, fontSize: '0.78rem', marginBottom: 8 }}>新手教程</p>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.4rem', color: INK, marginBottom: 10 }}>
              欢迎来到灵契
            </h2>
            <p style={{ color: MUTED, fontSize: '0.88rem', lineHeight: 1.8, marginBottom: 16 }}>
              你已经有登录账号了。登录账号是手机号或邮箱；昵称只是公开展示名，之后可以在“资料”里改。
            </p>
            <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
              {[
                ['先补资料', '设置昵称、头像、常用城市和公开主页，让别人知道你是谁。'],
                ['再逛功能', '红黑白榜看口碑，剧本口碑看评分，拼车和委托需求看近期机会。'],
                ['发布会审核', '公开内容会进入审核；手机号或邮箱验证过就能发言，实名和微信是更高可信等级。'],
                ['契约币', '契约币用于充值、打榜、踩榜等站内服务；先按需小额使用。'],
              ].map(([title, desc]) => (
                <div key={title} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(239,246,255,0.78)', border: '1px solid rgba(125,147,170,0.14)' }}>
                  <p style={{ color: INK, fontWeight: 900, fontSize: '0.86rem', marginBottom: 4 }}>{title}</p>
                  <p style={{ color: 'rgba(71,85,105,0.68)', fontSize: '0.78rem', lineHeight: 1.65 }}>{desc}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={closeOnboarding} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.22)', background: '#fff', color: '#925f18', fontWeight: 850, cursor: 'pointer' }}>
                先逛逛
              </button>
              <button type="button" onClick={() => { closeOnboarding(); setTab('profile'); }} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${GOLD}, #c9922e)`, color: INK, fontWeight: 900, cursor: 'pointer' }}>
                去设置昵称
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="dashboard-hero" style={{ background: `linear-gradient(135deg, ${C2}, #fffaf2)`, borderBottom: '1px solid rgba(201,146,46,0.2)', padding: '24px 20px' }}>
        <div className="dashboard-hero-inner" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="dashboard-identity" style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div className="dashboard-avatar-stack" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <img className="dashboard-identity-avatar" src={profileAvatarUrl} alt="" style={{ width: 54, height: 54, borderRadius: 16, objectFit: 'cover', border: '2px solid rgba(217,168,87,0.32)', background: '#fffaf2', boxShadow: '0 10px 24px rgba(31,41,55,0.08)' }} />
              <div className="dashboard-avatar-action" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ImageUpload
                  onUploaded={handleAvatarUploaded}
                  token={token}
                  api={API}
                  scope="avatar"
                  label="更换头像"
                  variant="compact"
                  hidePreview
                />
                <InfoTip>头像上传后会提交审核，通过后显示在公开页；请只上传可公开图片。</InfoTip>
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 4 }}>我的主页</h1>
              <p style={{ fontSize: '0.85rem', color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{creator.display_name}</p>
              <div className="dashboard-identity-badges">
                <StatusBadge tone={contactVerified ? 'ok' : 'warn'}>{contactVerified ? '已验证' : '待验证'}</StatusBadge>
                <StatusBadge tone={creator.is_realname ? 'gold' : 'muted'}>{creator.is_realname ? '实名' : '未实名'}</StatusBadge>
                {creator.city && <StatusBadge tone="info">{creator.city}</StatusBadge>}
              </div>
            </div>
          </div>
          <div className="dashboard-actions" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link to={`/explore/${creator.id}`}
              style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.28)', color: '#925f18', background: 'rgba(255,255,255,0.72)', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>
              查看公开页 →
            </Link>
            <Link to="/referrals"
              style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.28)', color: '#925f18', background: 'rgba(255,255,255,0.72)', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>
              我的邀请
            </Link>
            <button onClick={logout}
              style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(220,38,38,0.22)', background: 'rgba(254,242,242,0.78)', color: '#b91c1c', cursor: 'pointer', fontSize: '0.82rem' }}>
              退出
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-body" style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' }}>

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

        <div className="dashboard-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* ── 左侧 Tab 栏 ── */}
          <div className="dashboard-tabs" style={{ width: 180, flexShrink: 0, ...card, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map(t => tabBtn(t.id, t.label, t.icon))}
          </div>

          {/* ── 主内容区 ── */}
          <div className="dashboard-main" style={{ flex: 1, minWidth: 0 }}>

            {/* 资料 */}
            {tab === 'profile' && (
              <div className="dashboard-card profile-editor-card" style={card}>
                <h2 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 24, color: INK }}>编辑资料</h2>
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
                          小程序微信登录、邮箱验证和手机号验证会进入同一个灵契账号。设置密码后，可用手机号或邮箱加密码登录。
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
                  <Link to="/certification" className="inline-action-link">
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
                    <input type="url" value={form.douyin} onChange={e => setForm({ ...form, douyin: e.target.value })} placeholder="https://v.douyin.com/..." style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>小红书主页链接</label>
                    <input type="url" value={form.xiaohongshu} onChange={e => setForm({ ...form, xiaohongshu: e.target.value })} placeholder="https://www.xiaohongshu.com/..." style={inputStyle} />
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

            {/* 服务 */}
            {tab === 'services' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="dashboard-panel service-choice-panel" style={{ ...card, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontWeight: 900, color: INK, fontSize: '0.94rem', marginBottom: 4 }}>是否在灵契上提供服务</p>
                      <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.78rem', lineHeight: 1.65 }}>先决定要不要接委托；选择提供服务后，再填写城市、联系方式、角色和报价。</p>
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
                {!offersServices && (
                  <div className="dashboard-panel" style={{ ...card, padding: '14px 16px', background: 'rgba(255,255,255,0.72)' }}>
                    <p style={{ color: 'rgba(71,85,105,0.72)', fontSize: '0.82rem', lineHeight: 1.75 }}>
                      当前不会引导你填写报价、可接角色或联系方式。以后想接委托时，回来切到“提供服务”再填写。
                    </p>
                  </div>
                )}
                {offersServices && (
                  <>
                <div className="dashboard-panel service-settings-panel" style={{ ...card }}>
                  <p style={{ fontWeight: 800, color: INK, fontSize: '0.96rem', marginBottom: 12 }}>委托与服务设置</p>
                  <div style={{ marginBottom: 12 }}>
                    <DraftAutosaveNotice
                      savedAt={profileDraft.savedAt}
                      restoredAt={profileDraft.restoredAt}
                      error={profileDraft.error}
                      note="未保存的服务设置和角色清单会自动保存到当前浏览器。"
                    />
                  </div>
                  <div className="service-settings-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 0.72fr) minmax(190px, 1.2fr) minmax(150px, 0.9fr) minmax(170px, 1fr)', gap: 12, marginBottom: 12, alignItems: 'end' }}>
                    <div>
                      <label style={labelStyle}>流动状态</label>
                      <select value={form.travel_status} onChange={e => setForm({ ...form, travel_status: e.target.value })} style={inputStyle}>
                        <option value="常驻本地">常驻本地</option>
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
                      <label style={labelStyle}>微信</label>
                      <input type="text" value={form.wechat} onChange={e => setForm({ ...form, wechat: e.target.value })}
                        placeholder="粉丝通过申请后可见" style={inputStyle} />
                    </div>
                    <div className="intent-setting-row">
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'rgba(71,85,105,0.82)', fontSize: '0.82rem', fontWeight: 850 }}>
                        <input type="checkbox" checked={form.contact_unlock_enabled} onChange={e => setForm({ ...form, contact_unlock_enabled: e.target.checked })} />
                        预约意向金
                        <InfoTip>
                          页面会写成预约意向确认，用来减少无效打扰，不写成“加微信门槛费”。
                        </InfoTip>
                      </label>
                      <input type="number" value={form.contact_intent_amount} onChange={e => setForm({ ...form, contact_intent_amount: e.target.value })} placeholder="金额，0 表示不收" style={{ ...inputStyle }} />
                    </div>
                  </div>
                  <button onClick={() => saveProfile()} disabled={saving}
                    style={{
                      padding: '10px 20px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                      background: saving ? 'rgba(241,245,249,0.86)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                      color: saving ? 'rgba(71,85,105,0.52)' : INK, fontWeight: 800, fontSize: '0.86rem',
                    }}>
                    {saving ? '保存中...' : '保存服务设置'}
                  </button>
                  {msg && <span style={{ marginLeft: 12, fontSize: '0.82rem', color: '#15803d', fontWeight: 700 }}>{msg}</span>}
                </div>

                <div className="dashboard-panel role-panel" style={{ ...card }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                    <div>
                      <p style={{ fontWeight: 800, color: INK, fontSize: '0.92rem', marginBottom: 4 }}>可接本与角色</p>
                      <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.78rem', lineHeight: 1.65 }}>只能从剧本库选择。库里没有的本或角色，先维护剧本库，审核通过后再添加到主页。</p>
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

                {services.map(s => (
                  <div key={s.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.service_type}</span>
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
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: INK }}>添加服务</p>
                  <div style={{ marginBottom: 12 }}>
                    <DraftAutosaveNotice
                      savedAt={serviceDraft.savedAt}
                      restoredAt={serviceDraft.restoredAt}
                      error={serviceDraft.error}
                      note="未添加的服务会自动保存到当前浏览器。"
                    />
                  </div>
                  <div className="service-add-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(100px, 0.55fr) minmax(130px, 0.7fr)', gap: 12, marginBottom: 12 }}>
                    <input type="text" value={newSvc.service_type} onChange={e => setNewSvc({ ...newSvc, service_type: e.target.value })}
                      placeholder="服务类型" style={inputStyle} />
                    <input type="number" value={newSvc.price} onChange={e => setNewSvc({ ...newSvc, price: e.target.value })}
                      placeholder="价格（元）" style={inputStyle} />
                    <input type="text" value={newSvc.duration} onChange={e => setNewSvc({ ...newSvc, duration: e.target.value })}
                      placeholder="时长（如：2小时）" style={inputStyle} />
                  </div>
                  <button onClick={addService}
                    style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: INK, fontWeight: 700, fontSize: '0.875rem' }}>
                    添加
                  </button>
                </div>
                  </>
                )}
              </div>
            )}

            {/* 档期 */}
            {tab === 'availability' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={card}>
                  <p style={{ fontWeight: 800, fontSize: '0.96rem', marginBottom: 8, color: INK }}>手动标记可约日期</p>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(71,85,105,0.58)', marginBottom: 16 }}>新标记的日期会先提交审核，通过后显示在公开主页上，代表可以被委托人预约。</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 560, marginBottom: 18 }}>
                    <input value={availCity} onChange={e => setAvailCity(e.target.value)} placeholder="这批档期所在城市（默认用常驻城市）" style={inputStyle} />
                    <input value={availLocation} onChange={e => setAvailLocation(e.target.value)} placeholder="地点补充，如展会/区县/可商量" style={inputStyle} />
                  </div>
                  <div style={{ maxWidth: 400 }}>
                    <Calendar
                      onClickDay={toggleDate}
                      tileClassName={({ date }) => {
                        const ds = formatDateKey(date);
                        if (availDates.includes(ds)) return 'avail-tile';
                        if (busyDateSet.has(ds)) return 'busy-tile';
                        return '';
                      }}
                      className="dark-cal"
                      minDate={new Date()}
                    />
                  </div>
                  <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {availableItems.map(item => (
                      <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, fontSize: '0.78rem', background: 'rgba(201,146,46,0.1)', border: '1px solid rgba(201,146,46,0.25)', color: '#925f18' }}>
                        {item.date}{item.city ? ` · ${item.city}` : ''}{item.location ? ` · ${item.location}` : ''}{item.source === 'screenshot' ? ' · 截图导入' : ''}
                        <button onClick={() => toggleDate(new Date(item.date + 'T00:00:00'))}
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
                      <p style={{ fontWeight: 800, fontSize: '0.96rem', color: INK, marginBottom: 4 }}>剧司辰已排档期</p>
                      <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.8rem', lineHeight: 1.7 }}>这里同步的是已排班/忙碌时间，不会当成可约日期展示。</p>
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
                  <p style={{ fontWeight: 800, fontSize: '0.96rem', marginBottom: 8, color: INK }}>截图快速导入</p>
                  <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.8rem', lineHeight: 1.7, marginBottom: 14 }}>上传档期截图留档，再粘贴截图中的文字，系统会把未过期日期导入为可约档期。</p>
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
            {tab === 'portfolio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: INK }}>上传作品</p>
                  <ImageUpload onUploaded={addPortfolio} token={token} api={API} scope="portfolio" label="上传作品并提交审核" />
                  <p style={{ fontSize: '0.78rem', color: 'rgba(71,85,105,0.52)', marginTop: 12, lineHeight: 1.65 }}>
                    支持 JPG、PNG、GIF，最大 10MB。上传后进入审核，通过后才会显示在公开页；请只上传你有权公开展示的图片。
                  </p>
                </div>
              </div>
            )}

            {tab === 'posts' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <MineSection title="红黑白榜" emptyText="还没有发布过口碑">
                  {myRankings.map(item => (
                    <MineRow key={item.id}
                      title={item.subject_name}
                      meta={`${item.type === 'red' ? '红榜' : item.type === 'black' ? '黑榜' : '白榜'} · ${item.subject_city || '未填城市'} · ${item.initial_amount === 0 ? '免费发布' : `初始 ${item.initial_amount} 契约币`} · 打榜${item.boost_amount ?? (item.type === 'black' ? 0 : item.likes || 0)} 踩榜${item.negative_boost_amount || 0} 同意${item.agree_count ?? (item.type === 'black' ? item.likes || 0 : 0)} 反对${item.oppose_count ?? item.dislikes ?? 0} 离谱${item.joys || 0}`}
                      status={item.status}
                      to="/rankings"
                      action={item.status === 'pending' && item.initial_amount === 0 ? (
                        <button onClick={() => withdrawRanking(item.id)} style={miniButtonStyle}>
                          撤回
                        </button>
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

        @media (max-width: 760px) {
          .dashboard-page {
            background: linear-gradient(180deg, #f7fbff 0%, #fffdf8 32%, #fffdf8 100%) !important;
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
            padding: 14px 12px 64px !important;
          }
          .dashboard-layout {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .dashboard-tabs {
            width: 100% !important;
            max-width: none !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 20 !important;
            display: flex !important;
            flex-direction: row !important;
            gap: 8px !important;
            overflow-x: auto !important;
            padding: 8px !important;
            border-radius: 14px !important;
            background: rgba(255,250,242,0.94) !important;
            backdrop-filter: blur(12px) !important;
            box-shadow: 0 8px 24px rgba(31,41,55,0.08) !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .dashboard-tabs::-webkit-scrollbar {
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
          .dashboard-card,
          .dashboard-panel,
          .dashboard-main section {
            border-radius: 14px !important;
            padding: 14px !important;
            box-shadow: 0 10px 26px rgba(31,41,55,0.05) !important;
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
          .service-add-grid > input:first-child {
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
        .dark-cal .react-calendar__tile.busy-tile { background: rgba(59,130,246,0.12) !important; color: #1d4ed8 !important; font-weight: 700 !important; border: 1px solid rgba(59,130,246,0.25) !important; }
        .dark-cal .react-calendar__month-view__days__day--neighboringMonth { color: rgba(71,85,105,0.25) !important; }
        .dark-cal abbr { text-decoration: none !important; }
      `}</style>
    </div>
  );
}

function InfoTip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const tipRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeTimer = window.setTimeout(() => setOpen(false), 7000);
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      if (tipRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('touchstart', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.clearTimeout(closeTimer);
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('touchstart', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <span className="info-tip-wrap" ref={tipRef}>
      <button
        type="button"
        className="info-tip-button"
        aria-label={open ? '收起说明' : '查看说明'}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(value => !value);
        }}
      >
        ?
      </button>
      {open && <span className="info-tip-popover">{children}</span>}
    </span>
  );
}

type StatusTone = 'ok' | 'warn' | 'danger' | 'gold' | 'info' | 'muted';

function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}

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

function MineRow({ title, meta, status, to, action }: { title: string; meta: string; status: string; to: string; action?: React.ReactNode }) {
  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: '待审核', color: '#925f18', bg: 'rgba(217,168,87,0.12)' },
    approved: { label: '已公开', color: '#15803d', bg: 'rgba(220,252,231,0.78)' },
    rejected: { label: '未通过', color: '#b91c1c', bg: 'rgba(254,242,242,0.9)' },
    closed: { label: '已关闭', color: '#64748b', bg: 'rgba(241,245,249,0.9)' },
    withdrawn: { label: '已撤回', color: '#64748b', bg: 'rgba(241,245,249,0.9)' },
  };
  const item = statusMap[status] || statusMap.pending;
  return (
    <article style={{ borderRadius: 12, border: '1px solid rgba(201,146,46,0.16)', background: '#fff', padding: 14, display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ fontWeight: 800, fontSize: '0.92rem', color: INK, marginBottom: 5 }}>{title}</h3>
        <p style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.78rem', lineHeight: 1.6 }}>{meta}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ padding: '4px 8px', borderRadius: 999, background: item.bg, color: item.color, fontSize: '0.74rem', fontWeight: 800 }}>{item.label}</span>
        {action}
        <Link to={to} style={{ color: '#925f18', fontSize: '0.8rem', fontWeight: 800, textDecoration: 'none' }}>查看</Link>
      </div>
    </article>
  );
}
