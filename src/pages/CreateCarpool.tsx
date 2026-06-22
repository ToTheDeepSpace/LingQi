import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AuthData, CarpoolRole, CarpoolSubsidyType, ScriptCatalogItem, StoreCatalogItem } from '../types';
import { CITIES } from '../constants/cities';
import { formatDetailedSubsidy, generateCarpoolMessage, parseCarpoolMessage } from '../lib/carpoolMessage';
import DraftAutosaveNotice from '../components/DraftAutosaveNotice';
import InfoTip from '../components/InfoTip';
import ResponsibilityNotice from '../components/ResponsibilityNotice';
import { readStoredCreatorAuth } from '../lib/authSession';
import { useDraftAutosave } from '../hooks/useDraftAutosave';

const API = '/api';
const C = '#fffdf8';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const subsidyOptions: { value: CarpoolSubsidyType; label: string }[] = [
  { value: 'none', label: '不写补贴' },
  { value: 'half_price', label: '半价' },
  { value: 'free_ticket', label: '免票' },
  { value: 'discount', label: '折扣' },
  { value: 'a_subsidy', label: 'A补' },
  { value: 'fixed_deduct', label: '减金额' },
  { value: 'custom', label: '自定义' },
];

type RoleDraft = CarpoolRole & { id: string };

type CarpoolDraft = {
  rawMessage: string;
  generatedMessage: string;
  showMore: boolean;
  title: string;
  city: string;
  eventDate: string;
  dateExpired: boolean;
  startTime: string;
  deadlineDate: string;
  deadlineTime: string;
  scriptId: string;
  scriptName: string;
  scriptRoles: RoleDraft[];
  roleName: string;
  roleNote: string;
  neededCount: number;
  subsidyType: CarpoolSubsidyType;
  subsidyAmount: number;
  subsidyDiscount: string;
  subsidyNote: string;
  storeName: string;
  storeId: string;
  storeAddress: string;
  storeSourceUrl: string;
  storeVerifyNote: string;
  leaderContact: string;
  contactNote: string;
  content: string;
  boostAmount: number;
};

const roleGenderOptions = ['', '男', '女', '可男可女', '其他'];
const playerGenderOptions = ['', '男', '女', '其他', '不公开'];

const backLinkStyle: React.CSSProperties = {
  color: 'rgba(39,83,137,0.82)',
  textDecoration: 'none',
  fontSize: '0.86rem',
  fontWeight: 800,
};

function getAuth(): AuthData | null {
  const data = readStoredCreatorAuth();
  return data?.token ? data as AuthData : null;
}

function defaultDeadline(dateText: string) {
  if (!dateText) return '';
  const [year, month, day] = dateText.split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function modeFromType(type: CarpoolSubsidyType): 'none' | 'asking' | 'offering' {
  if (type === 'none') return 'none';
  if (type === 'a_subsidy') return 'asking';
  return 'offering';
}

function makeRoleId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeRoleText(text: string) {
  return text.trim().replace(/\s+/g, ' ');
}

function rolesFromText(text: string): RoleDraft[] {
  return text
    .split(/[、，,/\n]/)
    .map(normalizeRoleText)
    .filter(Boolean)
    .slice(0, 20)
    .map(role_name => ({
      id: makeRoleId(),
      role_name,
      gender: '',
      tags: [],
      status: 'needed',
      player_name: '',
      player_gender: '',
    }));
}

function rolesFromScript(script: ScriptCatalogItem): RoleDraft[] {
  return (script.player_roles || []).map(role => ({
    id: makeRoleId(),
    role_name: role.role_name,
    gender: role.gender || '',
    tags: role.tags || [],
    status: 'needed',
    player_name: '',
    player_gender: '',
  }));
}

function hasRoleDraft(roles: RoleDraft[]) {
  return roles.some(role =>
    !!(
      role.role_name?.trim()
      || role.gender
      || (role.tags || []).length
      || role.player_name?.trim()
      || role.player_gender
    ),
  );
}

function shouldSaveCarpoolDraft(data: CarpoolDraft) {
  return [
    data.rawMessage,
    data.generatedMessage,
    data.title,
    data.city,
    data.eventDate,
    data.startTime,
    data.deadlineDate,
    data.scriptName,
    data.roleName,
    data.roleNote,
    data.subsidyDiscount,
    data.subsidyNote,
    data.storeName,
    data.storeAddress,
    data.storeSourceUrl,
    data.storeVerifyNote,
    data.leaderContact,
    data.contactNote,
    data.content,
  ].some(item => item.trim())
    || hasRoleDraft(data.scriptRoles)
    || data.neededCount !== 1
    || data.subsidyType !== 'none'
    || data.subsidyAmount > 0
    || data.boostAmount > 0
    || data.showMore;
}

export default function CreateCarpool() {
  const navigate = useNavigate();
  const [auth] = useState(() => getAuth());
  const [balance, setBalance] = useState<number | null>(null);
  const [scriptCatalog, setScriptCatalog] = useState<ScriptCatalogItem[]>([]);
  const [storeCatalog, setStoreCatalog] = useState<StoreCatalogItem[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [rawMessage, setRawMessage] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [copyMsg, setCopyMsg] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [dateExpired, setDateExpired] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('18:00');
  const [scriptId, setScriptId] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [scriptRoles, setScriptRoles] = useState<RoleDraft[]>([]);
  const [roleName, setRoleName] = useState('');
  const [roleNote, setRoleNote] = useState('');
  const [neededCount, setNeededCount] = useState(1);
  const [subsidyType, setSubsidyType] = useState<CarpoolSubsidyType>('none');
  const [subsidyAmount, setSubsidyAmount] = useState(0);
  const [subsidyDiscount, setSubsidyDiscount] = useState('');
  const [subsidyNote, setSubsidyNote] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeSourceUrl, setStoreSourceUrl] = useState('');
  const [storeVerifyNote, setStoreVerifyNote] = useState('');
  const [leaderContact, setLeaderContact] = useState('');
  const [contactNote, setContactNote] = useState('');
  const [content, setContent] = useState('');
  const [boostAmount, setBoostAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth) { navigate('/login'); return; }
    fetch(`${API}/lc/wallet`, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setBalance(d.data.balance); })
      .catch(() => setBalance(null));
    fetch(`${API}/lc/scripts`)
      .then(r => r.json())
      .then(d => { if (d.success) setScriptCatalog(d.data || []); })
      .catch(() => setScriptCatalog([]));
  }, [auth, navigate]);

  useEffect(() => {
    if (!auth || !city) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStoreLoading(true);
      fetch(`${API}/lc/stores?city=${encodeURIComponent(city)}`, { signal: controller.signal })
        .then(r => r.json())
        .then(d => {
          const stores = d.success ? (d.data || []) : [];
          setStoreCatalog(stores);
          setStoreId(current => (current && stores.some((store: StoreCatalogItem) => store.id === current)) ? current : '');
        })
        .catch(() => {
          if (!controller.signal.aborted) setStoreCatalog([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setStoreLoading(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [auth, city]);

  useEffect(() => {
    if (city) return;
    const timer = window.setTimeout(() => {
      setStoreCatalog([]);
      setStoreId('');
      setStoreLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [city]);

  const cleanRoles = useMemo(() => scriptRoles
    .map(role => ({
      ...role,
      role_name: normalizeRoleText(role.role_name || ''),
      gender: role.gender || '',
      tags: role.tags || [],
      status: role.status === 'seated' ? 'seated' : 'needed',
      player_name: role.player_name || '',
      player_gender: role.player_gender || '',
    }))
    .filter(role => role.role_name), [scriptRoles]);

  const derivedRoleName = useMemo(() => {
    const needed = cleanRoles.filter(role => role.status !== 'seated');
    const names = needed.map(role => role.gender ? `${role.role_name}(${role.gender})` : role.role_name);
    return names.join('、') || roleName;
  }, [cleanRoles, roleName]);

  const derivedNeededCount = useMemo(() => {
    const count = cleanRoles.filter(role => role.status !== 'seated').length;
    return count > 0 ? count : neededCount;
  }, [cleanRoles, neededCount]);

  const currentGeneratedMessage = useMemo(() => generateCarpoolMessage({
    eventDate,
    startTime,
    city,
    scriptName,
    roleName: derivedRoleName,
    neededCount: derivedNeededCount,
    subsidyType,
    subsidyAmount,
    subsidyDiscount: subsidyDiscount ? Number(subsidyDiscount) : null,
    subsidyNote,
    deadlineDate,
    deadlineTime,
    leaderContact,
    content,
  }), [city, content, deadlineDate, deadlineTime, derivedNeededCount, derivedRoleName, eventDate, leaderContact, scriptName, startTime, subsidyAmount, subsidyDiscount, subsidyNote, subsidyType]);

  const draftValue = useMemo<CarpoolDraft>(() => ({
    rawMessage,
    generatedMessage,
    showMore,
    title,
    city,
    eventDate,
    dateExpired,
    startTime,
    deadlineDate,
    deadlineTime,
    scriptId,
    scriptName,
    scriptRoles,
    roleName,
    roleNote,
    neededCount,
    subsidyType,
    subsidyAmount,
    subsidyDiscount,
    subsidyNote,
    storeName,
    storeId,
    storeAddress,
    storeSourceUrl,
    storeVerifyNote,
    leaderContact,
    contactNote,
    content,
    boostAmount,
  }), [boostAmount, city, contactNote, content, dateExpired, deadlineDate, deadlineTime, eventDate, generatedMessage, leaderContact, neededCount, rawMessage, roleName, roleNote, scriptId, scriptName, scriptRoles, showMore, startTime, storeAddress, storeId, storeName, storeSourceUrl, storeVerifyNote, subsidyAmount, subsidyDiscount, subsidyNote, subsidyType, title]);

  const carpoolDraft = useDraftAutosave<CarpoolDraft>({
    key: 'lc:draft:carpool:new',
    version: 1,
    value: draftValue,
    shouldSave: shouldSaveCarpoolDraft,
    onRestore: data => {
      setRawMessage(data.rawMessage || '');
      setGeneratedMessage(data.generatedMessage || '');
      setShowMore(!!data.showMore);
      setTitle(data.title || '');
      setCity(data.city || '');
      setEventDate(data.eventDate || '');
      setDateExpired(!!data.dateExpired);
      setStartTime(data.startTime || '');
      setDeadlineDate(data.deadlineDate || '');
      setDeadlineTime(data.deadlineTime || '18:00');
      setScriptId(data.scriptId || '');
      setScriptName(data.scriptName || '');
      setScriptRoles((data.scriptRoles || []).map(role => ({ ...role, id: role.id || makeRoleId() })));
      setRoleName(data.roleName || '');
      setRoleNote(data.roleNote || '');
      setNeededCount(data.neededCount || 1);
      setSubsidyType(data.subsidyType || 'none');
      setSubsidyAmount(data.subsidyAmount || 0);
      setSubsidyDiscount(data.subsidyDiscount || '');
      setSubsidyNote(data.subsidyNote || '');
      setStoreName(data.storeName || '');
      setStoreId(data.storeId || '');
      setStoreAddress(data.storeAddress || '');
      setStoreSourceUrl(data.storeSourceUrl || '');
      setStoreVerifyNote(data.storeVerifyNote || '');
      setLeaderContact(data.leaderContact || '');
      setContactNote(data.contactNote || '');
      setContent(data.content || '');
      setBoostAmount(data.boostAmount || 0);
    },
  });

  const applyParsed = () => {
    if (!rawMessage.trim()) {
      setParseWarnings(['先粘贴一段车头消息。']);
      return;
    }
    const parsed = parseCarpoolMessage(rawMessage);
    setParseWarnings(parsed.warnings);
    setDateExpired(parsed.dateExpired);
    if (parsed.eventDate) {
      setEventDate(parsed.eventDate);
      if (!deadlineDate) setDeadlineDate(defaultDeadline(parsed.eventDate));
    } else if (parsed.dateExpired) {
      setEventDate('');
    }
    if (parsed.startTime) setStartTime(parsed.startTime);
    if (parsed.scriptName) updateScriptName(parsed.scriptName);
    if (parsed.roleName) {
      setRoleName(parsed.roleName);
      if (scriptRoles.length === 0) setScriptRoles(rolesFromText(parsed.roleName));
    }
    if (parsed.roleNote) setRoleNote(parsed.roleNote);
    setSubsidyType(parsed.subsidyType);
    setSubsidyAmount(parsed.subsidyAmount);
    setSubsidyDiscount(parsed.subsidyDiscount ? String(parsed.subsidyDiscount) : '');
    setSubsidyNote(parsed.subsidyNote);
    if (parsed.leaderContact) setLeaderContact(parsed.leaderContact);
    if (parsed.content) setContent(parsed.content);
    if (parsed.title) setTitle(parsed.title);
    const message = generateCarpoolMessage({
      eventDate: parsed.eventDate || '',
      startTime: parsed.startTime,
      city,
      scriptName: parsed.scriptName || '',
      roleName: parsed.roleName || derivedRoleName,
      neededCount: derivedNeededCount,
      subsidyType: parsed.subsidyType,
      subsidyAmount: parsed.subsidyAmount,
      subsidyDiscount: parsed.subsidyDiscount,
      subsidyNote: parsed.subsidyNote,
      deadlineDate: parsed.eventDate ? (deadlineDate || defaultDeadline(parsed.eventDate)) : '',
      deadlineTime,
      leaderContact: parsed.leaderContact || leaderContact,
      content: parsed.content,
    });
    setGeneratedMessage(message);
  };

  const refreshGenerated = () => {
    setGeneratedMessage(currentGeneratedMessage);
    setCopyMsg('已生成，可复制到微信。');
  };

  const copyGenerated = async () => {
    const text = generatedMessage || currentGeneratedMessage;
    if (!text.trim()) {
      setCopyMsg('先生成一段拼车消息。');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg('已复制。');
    } catch {
      setCopyMsg('复制失败，可以手动选中文案复制。');
    }
  };

  const applyScriptFromCatalog = (id: string) => {
    setScriptId(id);
    const selected = scriptCatalog.find(item => item.id === id);
    if (!selected) return;
    setScriptName(selected.name);
    setScriptRoles(rolesFromScript(selected));
    setRoleName('');
    setNeededCount(Math.max(1, selected.player_roles?.length || 1));
  };

  const applyStoreFromCatalog = (id: string) => {
    setStoreId(id);
    const selected = storeCatalog.find(item => item.id === id);
    if (!selected) return;
    setStoreName(selected.name);
    setStoreAddress(selected.address || '');
    setStoreSourceUrl('');
    setStoreVerifyNote('');
  };

  const updateScriptName = (value: string) => {
    setScriptName(value);
    const exact = scriptCatalog.find(item => item.name === value);
    if (exact) {
      setScriptId(exact.id);
      setScriptRoles(rolesFromScript(exact));
      setRoleName('');
    } else {
      setScriptId('');
    }
  };

  const updateRole = (id: string, patch: Partial<RoleDraft>) => {
    setScriptRoles(prev => prev.map(role => role.id === id ? { ...role, ...patch } : role));
  };

  const addRole = () => {
    setScriptRoles(prev => [...prev, {
      id: makeRoleId(),
      role_name: '',
      gender: '',
      tags: [],
      status: 'needed',
      player_name: '',
      player_gender: '',
    }]);
  };

  const removeRole = (id: string) => {
    setScriptRoles(prev => prev.filter(role => role.id !== id));
  };

  const submit = async () => {
    if (!auth) return navigate('/login');
    if (dateExpired || !eventDate) return setError('日期已过期或未确认，请手动选择有效日期');
    if (!city || !deadlineDate || !scriptName.trim() || !leaderContact.trim()) {
      return setError('请填写城市、报名截止日期、本名和车头微信');
    }
    if (!scriptId && cleanRoles.length === 0) {
      return setError('库里没有这个本时，请手动添加至少一个角色');
    }
    if (cleanRoles.some(role => role.status === 'seated' && !role.player_gender)) {
      return setError('已上车角色需要备注玩家性别');
    }
    const finalContent = content.trim() || currentGeneratedMessage.replace(/联系：.+$/m, '').trim();
    if (!finalContent) return setError('请填写公开说明，联系方式不会公开展示');
    if (boostAmount > 0 && balance !== null && balance < boostAmount) {
      return setError('契约币不足，请先充值');
    }
    setSubmitting(true);
    setError('');
    try {
      const subsidyMode = modeFromType(subsidyType);
      const r = await fetch(`${API}/lc/carpools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          title: title.trim(),
          city,
          eventDate,
          startTime,
          deadlineDate,
          deadlineTime,
          scriptId,
          scriptName: scriptName.trim(),
          scriptRoles: cleanRoles.map(role => ({
            role_name: role.role_name,
            gender: role.gender || '',
            tags: role.tags || [],
            status: role.status,
            player_name: role.player_name || '',
            player_gender: role.player_gender || '',
          })),
          roleName: derivedRoleName.trim(),
          roleNote: roleNote.trim(),
          neededCount: derivedNeededCount,
          subsidyMode,
          subsidyType,
          subsidyAmount,
          subsidyDiscount: subsidyDiscount ? Number(subsidyDiscount) : null,
          subsidyNote: subsidyNote.trim(),
          storeName: storeName.trim(),
          storeId,
          storeAddress: storeAddress.trim(),
          storeSourceUrl: storeSourceUrl.trim(),
          storeVerifyNote: storeVerifyNote.trim(),
          leaderContact: leaderContact.trim(),
          contactNote: contactNote.trim(),
          content: finalContent,
          rawMessage: rawMessage.trim(),
          generatedMessage: (generatedMessage || currentGeneratedMessage).trim(),
          boostAmount,
        }),
      });
      const d = await r.json();
      if (d.success) {
        carpoolDraft.clearDraft();
        navigate('/carpools?submitted=1');
      }
      else setError(typeof d.error === 'string' ? d.error : (d.error?.message || '提交失败'));
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth) return null;

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: INK }}>
      <div style={{ background: 'linear-gradient(135deg, #eef6ff, #fffaf2)', borderBottom: '1px solid rgba(201,146,46,0.2)', padding: '32px 20px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <Link to="/carpools" style={backLinkStyle}>← 返回拼车区</Link>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.55rem', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              发布拼车
              <InfoTip>先把群消息解析成车次，也可以直接填车次，再单独生成可粘贴文案。</InfoTip>
            </h1>
          </div>
          <Link to="/wallet" style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.25)', background: 'rgba(255,255,255,0.78)', color: '#925f18', textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem' }}>
            契约币 {balance ?? '...'}
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '30px 20px 80px' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <DraftAutosaveNotice
            savedAt={carpoolDraft.savedAt}
            restoredAt={carpoolDraft.restoredAt}
            error={carpoolDraft.error}
            note="未发布的拼车会自动保存到当前浏览器，包含车次、角色座位和店家线索。"
          />
          <section style={heroCardStyle}>
            <h2 style={sectionTitleStyle}>粘贴消息解析车次</h2>
            <Field label="原始群消息">
              <textarea
                value={rawMessage}
                onChange={e => setRawMessage(e.target.value)}
                rows={7}
                placeholder={'例：🚗6.14 晚场 无限x琳琅=祝魇cp（各半价）\n也可以直接写你想发到群里的拼车消息。'}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 150, lineHeight: 1.75 }}
              />
            </Field>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={applyParsed} style={secondaryButtonStyle}>解析为车次字段</button>
            </div>
            {parseWarnings.length > 0 && (
              <div style={{ display: 'grid', gap: 6 }}>
                {parseWarnings.map(item => <p key={item} style={warningStyle}>{item}</p>)}
              </div>
            )}
          </section>

          <ResponsibilityNotice />

          <section style={heroCardStyle}>
            <h2 style={sectionTitleStyle}>确认四个关键信息</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field label="日期 *"><input type="date" value={eventDate} onChange={e => { setEventDate(e.target.value); setDateExpired(false); if (!deadlineDate) setDeadlineDate(defaultDeadline(e.target.value)); }} style={inputStyle} /></Field>
              <Field label="城市 *">
                <select value={city} onChange={e => { setCity(e.target.value); setStoreId(''); setStoreCatalog([]); }} style={inputStyle}>
                  <option value="">选择城市</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="本名 *">
                <input
                  list="shared-script-options"
                  value={scriptName}
                  onChange={e => updateScriptName(e.target.value)}
                  placeholder="例：流氓叙事 / 琳琅"
                  style={inputStyle}
                />
                <datalist id="shared-script-options">
                  {scriptCatalog.map(item => <option key={item.id} value={item.name} />)}
                </datalist>
              </Field>
              <Input label="车头微信 *" value={leaderContact} onChange={setLeaderContact} placeholder="登录后才给用户查看" />
            </div>
            {scriptCatalog.length > 0 && (
              <Field label="从剧司辰剧本库选择">
                <select value={scriptId} onChange={e => applyScriptFromCatalog(e.target.value)} style={inputStyle}>
                  <option value="">手动输入或库外新本</option>
                  {scriptCatalog.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </Field>
            )}
            {dateExpired && <p style={warningStyle}>这条消息里的日期已经过了。请确认它仍有效，并手动选择新的有效日期。</p>}
          </section>

          <section style={heroCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <h2 style={sectionTitleStyle}>角色座位</h2>
                <p style={{ marginTop: 6, color: MUTED, fontSize: '0.82rem', lineHeight: 1.7 }}>
                  库外新本要先补角色；已上车的角色填玩家性别，缺人的角色会进入拼车缺口。
                </p>
              </div>
              <button onClick={addRole} style={secondaryButtonStyle}>添加角色</button>
            </div>

            {scriptRoles.length === 0 && (
              <div style={{ borderRadius: 12, border: '1px dashed rgba(217,168,87,0.28)', background: 'rgba(255,250,242,0.74)', padding: 14, color: 'rgba(71,85,105,0.66)', fontSize: '0.84rem', lineHeight: 1.7 }}>
                从剧司辰剧本库选择会自动带角色；如果是库里没有的新本，点“添加角色”手动补。
              </div>
            )}

            {scriptRoles.length > 0 && (
              <div style={{ display: 'grid', gap: 10 }}>
                {scriptRoles.map((role, index) => (
                  <div key={role.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, alignItems: 'end' }}>
                    <Field label={index === 0 ? '角色' : ' '}>
                      <input value={role.role_name || ''} onChange={e => updateRole(role.id, { role_name: e.target.value })} placeholder="角色名" style={inputStyle} />
                    </Field>
                    <Field label={index === 0 ? '角色性别' : ' '}>
                      <select value={role.gender || ''} onChange={e => updateRole(role.id, { gender: e.target.value })} style={inputStyle}>
                        {roleGenderOptions.map(item => <option key={item || 'empty'} value={item}>{item || '未填'}</option>)}
                      </select>
                    </Field>
                    <Field label={index === 0 ? '状态' : ' '}>
                      <select value={role.status || 'needed'} onChange={e => updateRole(role.id, { status: e.target.value as RoleDraft['status'] })} style={inputStyle}>
                        <option value="needed">缺人</option>
                        <option value="seated">已上车</option>
                      </select>
                    </Field>
                    <Field label={index === 0 ? '角色标签' : ' '}>
                      <input
                        value={(role.tags || []).join(', ')}
                        onChange={e => updateRole(role.id, { tags: e.target.value.split(/[，,、/]/).map(t => t.trim()).filter(Boolean) })}
                        placeholder="例：高光, 亡夫, 情感"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label={index === 0 ? '已上车玩家' : ' '}>
                      <input value={role.player_name || ''} onChange={e => updateRole(role.id, { player_name: e.target.value })} placeholder="可选昵称" style={inputStyle} />
                    </Field>
                    <Field label={index === 0 ? '玩家性别' : ' '}>
                      <select value={role.player_gender || ''} onChange={e => updateRole(role.id, { player_gender: e.target.value })} style={inputStyle}>
                        {playerGenderOptions.map(item => <option key={item || 'empty'} value={item}>{item || '未填'}</option>)}
                      </select>
                    </Field>
                    <button onClick={() => removeRole(role.id)} title="删除角色" style={{ height: 42, borderRadius: 10, border: '1px solid rgba(220,38,38,0.18)', background: 'rgba(254,242,242,0.82)', color: '#b91c1c', cursor: 'pointer', fontWeight: 900 }}>×</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: 'rgba(71,85,105,0.66)', fontSize: '0.8rem', fontWeight: 800 }}>
                  <span>缺人 {derivedNeededCount}</span>
                  <span>已上车 {cleanRoles.filter(role => role.status === 'seated').length}</span>
                  {derivedRoleName && <span>缺口：{derivedRoleName}</span>}
                </div>
              </div>
            )}

            <Field label="角色补充">
              <textarea value={roleNote} onChange={e => setRoleNote(e.target.value)} rows={3} placeholder="性别、反串、是否可换角色、需要什么风格..." style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }} />
            </Field>
          </section>

          <section style={heroCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <h2 style={sectionTitleStyle}>车次生成粘贴文案</h2>
              <span style={{ color: '#925f18', fontWeight: 900, fontSize: '0.82rem' }}>{formatDetailedSubsidy({ subsidy_type: subsidyType, subsidy_amount: subsidyAmount, subsidy_discount: subsidyDiscount ? Number(subsidyDiscount) : null, subsidy_note: subsidyNote })}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={refreshGenerated} style={secondaryButtonStyle}>生成可转发消息</button>
              <button onClick={() => void copyGenerated()} className="btn-gold" style={{ padding: '10px 18px' }}>复制消息</button>
              {copyMsg && <span style={{ alignSelf: 'center', color: '#166534', fontSize: '0.8rem', fontWeight: 800 }}>{copyMsg}</span>}
            </div>
            <Field label="可转发拼车消息">
              <textarea
                value={generatedMessage || currentGeneratedMessage}
                onChange={e => setGeneratedMessage(e.target.value)}
                rows={7}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.75, background: '#fffaf2' }}
              />
            </Field>
            <Field label="公开说明（不公开车头微信）">
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="除了日期、本名、角色、补贴之外的介绍信息写在这里；联系方式不要写进公开说明。" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.75 }} />
            </Field>
          </section>

          <button onClick={() => setShowMore(!showMore)} style={{ ...secondaryButtonStyle, justifySelf: 'start' }}>
            {showMore ? '收起更多设置' : '展开更多设置'}
          </button>

          {showMore && (
            <div style={{ display: 'grid', gap: 18 }}>
              <Section title="标题与截止时间">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                  <Input label="标题" value={title} onChange={setTitle} placeholder="可不填，系统自动生成" />
                  <Input label="时间" value={startTime} onChange={setStartTime} placeholder="例：19:30" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                  <Field label="报名截止日期 *"><input type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} style={inputStyle} /></Field>
                  <Input label="截止时间" value={deadlineTime} onChange={setDeadlineTime} placeholder="例：18:00" />
                </div>
                {cleanRoles.length === 0 && (
                  <Field label="兜底缺口人数">
                    <input type="number" min={1} max={20} value={neededCount} onChange={e => setNeededCount(Number(e.target.value) || 1)} style={inputStyle} />
                  </Field>
                )}
              </Section>

              <Section title="补贴与展示">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {subsidyOptions.map(item => (
                    <button key={item.value} onClick={() => setSubsidyType(item.value)}
                      style={{
                        padding: '9px 15px', borderRadius: 999, border: subsidyType === item.value ? `1px solid ${GOLD}` : '1px solid rgba(217,168,87,0.2)',
                        background: subsidyType === item.value ? 'rgba(217,168,87,0.14)' : '#fff',
                        color: subsidyType === item.value ? '#925f18' : MUTED, cursor: 'pointer', fontWeight: 800,
                      }}>{item.label}</button>
                  ))}
                </div>
                {subsidyType !== 'none' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                      {(subsidyType === 'a_subsidy' || subsidyType === 'fixed_deduct') && (
                        <Field label="金额">
                          <input type="number" min={0} value={subsidyAmount} onChange={e => setSubsidyAmount(Number(e.target.value) || 0)} style={inputStyle} />
                        </Field>
                      )}
                      {subsidyType === 'discount' && (
                        <Input label="折扣" value={subsidyDiscount} onChange={setSubsidyDiscount} placeholder="例：8.5" />
                      )}
                    </div>
                    <Field label="补贴原话">
                      <input value={subsidyNote} onChange={e => setSubsidyNote(e.target.value)} placeholder="例：各半价 / A补50 / 补100 / 免票" style={inputStyle} />
                    </Field>
                  </>
                )}
                <Field label={`加权展示 · ${boostAmount} 契约币`}>
                  <input type="range" min={0} max={100} step={10} value={boostAmount} onChange={e => setBoostAmount(Number(e.target.value))} style={{ width: '100%', accentColor: GOLD }} />
                  <p style={{ marginTop: 6, color: 'rgba(71,85,105,0.66)', fontSize: '0.76rem' }}>加权展示是平台排序功能，和拼车现金补贴不是一回事。</p>
                </Field>
              </Section>

              <Section title="店家线索">
                <Field label="选择城市店家">
                  <select value={storeId} onChange={e => applyStoreFromCatalog(e.target.value)} disabled={!city || storeLoading} style={inputStyle}>
                    <option value="">{city ? '手动填写店家 / 暂不选择' : '先选择城市'}</option>
                    {storeCatalog.map(store => (
                      <option key={store.id} value={store.id}>
                        {store.name}{store.city && store.city !== '未设置' ? ` · ${store.city}` : ''}{store.address ? ` · ${store.address}` : ''}
                      </option>
                    ))}
                  </select>
                  <p style={{ marginTop: 6, color: 'rgba(71,85,105,0.6)', fontSize: '0.76rem', lineHeight: 1.6 }}>
                    {storeLoading ? '正在读取城市店家...' : '选已有店家会直接关联；没有就手动填写，后续可由店家认领。'}
                  </p>
                </Field>
                <Input label="店家名称" value={storeName} onChange={(value) => { setStoreId(''); setStoreName(value); }} placeholder="例：某某沉浸式剧场" />
                <Input label="店家地址" value={storeAddress} onChange={(value) => { setStoreId(''); setStoreAddress(value); }} placeholder="可选，城市内具体商圈/地址" />
                <Input label="店家主页/资料链接" value={storeSourceUrl} onChange={(value) => { setStoreId(''); setStoreSourceUrl(value); }} placeholder="抖音/小红书/地图/公众号链接" />
                <Field label="店家说明">
                  <textarea value={storeVerifyNote} onChange={e => setStoreVerifyNote(e.target.value)} rows={3} placeholder="你为什么认为这是这家店？有没有公开资料或剧司辰店铺链接？" style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }} />
                </Field>
              </Section>

              <Section title="联系补充">
                <Input label="联系补充" value={contactNote} onChange={setContactNote} placeholder="例：加微信备注灵契拼车 / 先站内申请" />
              </Section>
            </div>
          )}

          {error && <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(254,242,242,0.92)', border: '1px solid rgba(220,38,38,0.24)', color: '#b91c1c', fontSize: '0.85rem' }}>{error}</div>}

          <button onClick={submit} disabled={submitting}
            style={{
              width: '100%', padding: '16px', borderRadius: 14, fontWeight: 900, fontSize: '1rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              background: submitting ? 'rgba(201,146,46,0.15)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
              color: submitting ? 'rgba(201,146,46,0.4)' : INK,
              border: 'none',
            }}>
            {submitting ? '发布中...' : (boostAmount > 0 ? `发布拼车 · 扣 ${boostAmount} 契约币` : '发布拼车')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 14, borderRadius: 16, border: '1px solid rgba(217,168,87,0.2)', background: 'rgba(255,255,255,0.78)', padding: 18, boxShadow: '0 12px 30px rgba(31,41,55,0.05)' }}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <Field label={label}>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: 8, color: 'rgba(71,85,105,0.74)' }}>{label}</p>
      {children}
    </div>
  );
}

const heroCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  borderRadius: 18,
  border: '1px solid rgba(217,168,87,0.22)',
  background: 'rgba(255,255,255,0.82)',
  padding: 18,
  boxShadow: '0 14px 36px rgba(31,41,55,0.06)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-serif)',
  fontSize: '1.08rem',
  fontWeight: 900,
  margin: 0,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid rgba(217,168,87,0.28)',
  background: '#fff',
  color: '#925f18',
  cursor: 'pointer',
  fontWeight: 900,
};

const warningStyle: React.CSSProperties = {
  color: '#b45309',
  background: 'rgba(254,243,199,0.72)',
  border: '1px solid rgba(245,158,11,0.22)',
  borderRadius: 10,
  padding: '9px 12px',
  fontSize: '0.8rem',
  fontWeight: 800,
};

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
