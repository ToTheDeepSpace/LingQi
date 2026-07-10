import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type React from 'react';
import DraftAutosaveNotice from '../components/DraftAutosaveNotice';
import { readStoredCreatorAuth } from '../lib/authSession';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import type { AuthData, ScriptCatalogItem } from '../types';

const API = '/api';
const BG = '#fffdf8';
const PANEL = '#fffaf2';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

type RoleDraft = {
  id: string;
  role_name: string;
  gender: string;
  tags: string[];
};

type Contribution = {
  id: string;
  script_name: string;
  player_roles: RoleDraft[];
  credits_patch?: Record<string, string[]>;
  note?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reward_amount: number;
  review_note?: string | null;
  created_at: string;
};

const roleGenderOptions = ['', '男', '女', '可男可女', '其他'];
const creditFields = [
  { key: 'authors', label: '作者' },
  { key: 'publisher', label: '发行方' },
  { key: 'supervisor', label: '监制' },
] as const;

type CreditKey = typeof creditFields[number]['key'];
type CreditDraft = Record<CreditKey, string>;
type ScriptContributionDraft = {
  scriptId: string;
  scriptName: string;
  roles: RoleDraft[];
  credits: CreditDraft;
  note: string;
};

function getAuth(): AuthData | null {
  const data = readStoredCreatorAuth();
  return data?.token ? data as AuthData : null;
}

function makeRoleId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function blankRole(): RoleDraft {
  return { id: makeRoleId(), role_name: '', gender: '', tags: [] };
}

function rolesFromScript(script: ScriptCatalogItem): RoleDraft[] {
  const roles = script.player_roles || [];
  if (roles.length === 0) return [blankRole()];
  return roles.map(role => ({
    id: makeRoleId(),
    role_name: role.role_name,
    gender: role.gender || '',
    tags: role.tags || [],
  }));
}

function cleanTags(value: string) {
  return Array.from(new Set(value.split(/[，,、/\n]/).map(item => item.trim()).filter(Boolean))).slice(0, 8);
}

function cleanCreditValues(value: string) {
  return Array.from(new Set(value.split(/[，,、/\n]/).map(item => item.trim()).filter(Boolean))).slice(0, 16);
}

function blankCredits(): CreditDraft {
  return creditFields.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {} as CreditDraft);
}

function creditsFromScript(script: ScriptCatalogItem): CreditDraft {
  const source = script.credits || {};
  return creditFields.reduce((acc, field) => ({
    ...acc,
    [field.key]: Array.isArray(source[field.key]) ? source[field.key].join(', ') : '',
  }), {} as CreditDraft);
}

function cleanCredits(value: CreditDraft) {
  return creditFields.reduce<Record<string, string[]>>((acc, field) => {
    const items = cleanCreditValues(value[field.key]);
    if (items.length) acc[field.key] = items;
    return acc;
  }, {});
}

function shouldSaveScriptContributionDraft(data: ScriptContributionDraft) {
  return !!(
    data.scriptName.trim()
    || data.roles.some(role => role.role_name.trim() || role.gender || (role.tags || []).length)
    || Object.values(data.credits).some(value => value.trim())
    || data.note.trim()
  );
}

function statusCopy(status: Contribution['status']) {
  if (status === 'approved') return { text: '已通过', color: '#166534', bg: 'rgba(240,253,244,0.9)' };
  if (status === 'rejected') return { text: '未通过', color: '#b91c1c', bg: 'rgba(254,242,242,0.86)' };
  return { text: '待审核', color: '#925f18', bg: 'rgba(254,243,199,0.72)' };
}

export default function ScriptContribute() {
  const navigate = useNavigate();
  const [auth] = useState(() => getAuth());
  const [scripts, setScripts] = useState<ScriptCatalogItem[]>([]);
  const [history, setHistory] = useState<Contribution[]>([]);
  const [scriptId, setScriptId] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [roles, setRoles] = useState<RoleDraft[]>([blankRole()]);
  const [credits, setCredits] = useState<CreditDraft>(() => blankCredits());
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const draftValue = useMemo<ScriptContributionDraft>(() => ({
    scriptId,
    scriptName,
    roles,
    credits,
    note,
  }), [credits, note, roles, scriptId, scriptName]);

  const scriptDraft = useDraftAutosave<ScriptContributionDraft>({
    key: 'lc:draft:script-contribution:new',
    version: 1,
    enabled: !!auth?.token,
    value: draftValue,
    shouldSave: shouldSaveScriptContributionDraft,
    onRestore: data => {
      setScriptId(data.scriptId || '');
      setScriptName(data.scriptName || '');
      setRoles((data.roles || []).length > 0
        ? data.roles.map(role => ({ id: role.id || makeRoleId(), role_name: role.role_name || '', gender: role.gender || '', tags: role.tags || [] }))
        : [blankRole()]);
      setCredits({ ...blankCredits(), ...(data.credits || {}) });
      setNote(data.note || '');
    },
  });

  const selectedScript = useMemo(() => scripts.find(item => item.id === scriptId) || null, [scriptId, scripts]);

  const load = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    setError('');
    try {
      const [scriptRes, mineRes] = await Promise.all([
        fetch(`${API}/lc/scripts`).then(r => r.json()),
        fetch(`${API}/lc/scripts/contributions/mine`, { headers: { Authorization: `Bearer ${auth.token}` } }).then(r => r.json()),
      ]);
      if (scriptRes.success) setScripts(scriptRes.data || []);
      if (mineRes.success) setHistory(mineRes.data || []);
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!auth?.token) {
      navigate('/login');
      return;
    }
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [auth, load, navigate]);

  const selectScript = (id: string) => {
    const script = scripts.find(item => item.id === id) || null;
    setScriptId(id);
    if (script) {
      setScriptName(script.name);
      setRoles(rolesFromScript(script));
      setCredits(creditsFromScript(script));
    } else {
      setScriptName('');
      setRoles([blankRole()]);
      setCredits(blankCredits());
    }
    setMessage('');
    setError('');
  };

  const updateRole = (id: string, patch: Partial<RoleDraft>) => {
    setRoles(prev => prev.map(role => role.id === id ? { ...role, ...patch } : role));
  };

  const removeRole = (id: string) => {
    setRoles(prev => prev.length <= 1 ? prev : prev.filter(role => role.id !== id));
  };

  const cleanRoles = useMemo(() => roles
    .map(role => ({
      role_name: role.role_name.trim(),
      gender: role.gender,
      tags: role.tags || [],
    }))
    .filter(role => role.role_name), [roles]);
  const cleanCreditPatch = useMemo(() => cleanCredits(credits), [credits]);
  const rolesMissingGender = useMemo(() => cleanRoles.some(role => !role.gender), [cleanRoles]);
  const submitDisabled = submitting || !scriptName.trim() || cleanRoles.length === 0 || rolesMissingGender;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return navigate('/login');
    if (!scriptName.trim()) {
      setError('请填写或选择剧本名');
      return;
    }
    if (cleanRoles.length === 0) {
      setError('请至少填写一个角色名和角色性别');
      return;
    }
    if (rolesMissingGender) {
      setError('请给每个角色选择性别。维护剧本名、角色名和性别即可拿基础奖励，作品资料可以作为补充。');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch(`${API}/lc/scripts/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          scriptId: scriptId || null,
          scriptName: scriptName.trim(),
          playerRoles: cleanRoles,
          creditsPatch: cleanCreditPatch,
          note: note.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        setError(d.error || '提交失败');
        return;
      }
      setMessage('已提交剧本库维护，后台通过后会发放 5 契约币。');
      scriptDraft.clearDraft();
      setScriptId('');
      setScriptName('');
      setRoles([blankRole()]);
      setCredits(blankCredits());
      setNote('');
      setHistory(prev => [d.data, ...prev]);
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth?.token) return null;

  return (
    <main style={{ minHeight: '100vh', background: BG, color: INK }}>
      <section style={{ background: `linear-gradient(135deg, ${PANEL} 0%, #eef6ff 100%)`, borderBottom: '1px solid rgba(217,168,87,0.18)', padding: '48px 20px 36px' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <Link to="/carpools/new" style={{ color: '#275389', textDecoration: 'none', fontSize: '0.84rem', fontWeight: 800 }}>返回发布拼车</Link>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 950, fontSize: 'clamp(1.9rem, 5vw, 2.7rem)', margin: '18px 0 10px' }}>维护剧本库</h1>
          <p style={{ color: MUTED, lineHeight: 1.8, maxWidth: 760, margin: 0 }}>
            维护剧本名称、角色名和角色性别即可算一条基础有效维护。角色 tag 和作品资料可以补充，后台审核通过后会写入共用剧本库，并奖励 5 契约币。
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1060, margin: '0 auto', padding: '28px 20px 82px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(260px, 0.65fr)', gap: 18 }} className="script-contribute-layout">
        <form onSubmit={submit} style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <DraftAutosaveNotice
              savedAt={scriptDraft.savedAt}
              restoredAt={scriptDraft.restoredAt}
              error={scriptDraft.error}
              note="未提交的剧本库维护会自动保存到当前浏览器。"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, marginBottom: 16 }}>
            <label>
              <Label>选择已有剧本</Label>
              <select value={scriptId} onChange={e => selectScript(e.target.value)} style={inputStyle}>
                <option value="">手动新增 / 搜不到的剧本</option>
                {scripts.map(script => (
                  <option key={script.id} value={script.id}>{script.name}</option>
                ))}
              </select>
            </label>
            <label>
              <Label>剧本名</Label>
              <input value={scriptName} onChange={e => { setScriptId(''); setScriptName(e.target.value); }} placeholder="例如：流氓叙事" maxLength={100} style={inputStyle} />
            </label>
          </div>

          {selectedScript && (
            <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(39,83,137,0.14)', background: 'rgba(239,246,255,0.86)', color: '#275389', fontSize: '0.84rem', lineHeight: 1.7 }}>
              已载入《{selectedScript.name}》当前角色。你可以补充空缺性别，也可以给角色增加 tag。
            </div>
          )}

          <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.02rem', fontWeight: 900, margin: 0 }}>作品资料</h2>
            <p style={{ margin: 0, color: MUTED, lineHeight: 1.7, fontSize: '0.82rem' }}>现阶段只收作者、发行方和监制，其他制作链先不展开。</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
              {creditFields.map(field => (
                <label key={field.key}>
                  <Label>{field.label}</Label>
                  <input
                    value={credits[field.key]}
                    onChange={e => setCredits(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder="可填多个，用逗号分隔"
                    maxLength={180}
                    style={inputStyle}
                  />
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <h2 style={{ fontSize: '1.02rem', fontWeight: 900, margin: 0 }}>玩家角色</h2>
            <button type="button" onClick={() => setRoles(prev => [...prev, blankRole()])} style={smallButtonStyle}>添加角色</button>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {roles.map((role, index) => (
              <div key={role.id} style={{ borderRadius: 12, border: '1px solid rgba(217,168,87,0.18)', background: '#fffaf2', padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 1fr) 120px minmax(150px, 1fr) auto', gap: 10, alignItems: 'end' }} className="script-role-row">
                  <label>
                    <Label>角色名</Label>
                    <input value={role.role_name} onChange={e => updateRole(role.id, { role_name: e.target.value })} placeholder={`角色 ${index + 1}`} maxLength={80} style={inputStyle} />
                  </label>
                  <label>
                    <Label>角色性别</Label>
                    <select value={role.gender} onChange={e => updateRole(role.id, { gender: e.target.value })} style={inputStyle}>
                      {roleGenderOptions.map(option => <option key={option || 'none'} value={option}>{option || '未定义'}</option>)}
                    </select>
                  </label>
                  <label>
                    <Label>角色 tag</Label>
                    <input value={(role.tags || []).join(', ')} onChange={e => updateRole(role.id, { tags: cleanTags(e.target.value) })} placeholder="例：亡夫, 高光, 情感线" maxLength={160} style={inputStyle} />
                  </label>
                  <button type="button" onClick={() => removeRole(role.id)} disabled={roles.length <= 1} style={{ ...smallButtonStyle, opacity: roles.length <= 1 ? 0.48 : 1, cursor: roles.length <= 1 ? 'not-allowed' : 'pointer' }}>删除</button>
                </div>
              </div>
            ))}
          </div>

          <label style={{ display: 'block', marginTop: 16 }}>
            <Label>补充说明</Label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={5} maxLength={800} placeholder="可以写来源、为什么这样定义、哪些角色还不确定。" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }} />
          </label>

          {error && <p style={{ color: '#b91c1c', fontSize: '0.84rem', marginTop: 14 }}>{error}</p>}
          {message && <p style={{ color: '#166534', fontSize: '0.84rem', marginTop: 14 }}>{message}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <Link to="/carpools/new" style={{ flex: 1, textAlign: 'center', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(71,85,105,0.16)', color: MUTED, textDecoration: 'none', fontWeight: 800 }}>取消</Link>
            <button type="submit" disabled={submitDisabled} style={{
              flex: 2,
              padding: '12px 14px',
              borderRadius: 10,
              border: 'none',
              background: submitDisabled ? 'rgba(71,85,105,0.12)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
              color: submitDisabled ? 'rgba(71,85,105,0.52)' : BG,
              fontWeight: 900,
              cursor: submitDisabled ? 'not-allowed' : 'pointer',
            }}>
              {submitting ? '提交中...' : '提交维护'}
            </button>
          </div>
        </form>

        <aside style={{ display: 'grid', gap: 14, alignSelf: 'start' }}>
          <section style={cardStyle}>
            <p style={{ color: GOLD, fontSize: '0.78rem', fontWeight: 900, margin: '0 0 8px' }}>共建奖励</p>
            <h2 style={{ margin: '0 0 10px', fontSize: '1.08rem', fontWeight: 950 }}>通过后 +5 契约币</h2>
            <p style={{ margin: 0, color: MUTED, lineHeight: 1.75, fontSize: '0.86rem' }}>
              第一版标准放宽：剧本名、角色名、角色性别齐了就算基础有效维护。作品资料和 tag 是补充项，不单独触发奖励。
            </p>
          </section>

          <section style={cardStyle}>
            <h2 style={{ margin: '0 0 12px', fontSize: '1.02rem', fontWeight: 900 }}>我的维护记录</h2>
            {loading ? (
              <p style={{ color: MUTED, fontSize: '0.86rem' }}>加载中...</p>
            ) : history.length === 0 ? (
              <p style={{ color: MUTED, fontSize: '0.86rem', lineHeight: 1.7 }}>还没有提交过剧本库维护。</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {history.map(item => {
                  const status = statusCopy(item.status);
                  const roleCount = Array.isArray(item.player_roles) ? item.player_roles.length : 0;
                  return (
                    <article key={item.id} style={{ borderRadius: 12, border: '1px solid rgba(217,168,87,0.16)', background: '#fffaf2', padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <strong style={{ color: INK, fontSize: '0.9rem' }}>{item.script_name || '未命名剧本'}</strong>
                        <span style={{ borderRadius: 999, padding: '4px 8px', background: status.bg, color: status.color, fontSize: '0.72rem', fontWeight: 900 }}>{status.text}</span>
                      </div>
                      <p style={{ margin: 0, color: MUTED, fontSize: '0.78rem', lineHeight: 1.65 }}>
                        {roleCount} 个角色 · 奖励 {item.reward_amount || 0} · {item.created_at?.slice(0, 10)}
                      </p>
                      {item.review_note && <p style={{ margin: '6px 0 0', color: MUTED, fontSize: '0.78rem', lineHeight: 1.65 }}>审核备注：{item.review_note}</p>}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
      </section>

      <style>{`
        @media (max-width: 820px) {
          .script-contribute-layout { grid-template-columns: 1fr !important; }
          .script-role-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ display: 'block', color: MUTED, fontSize: '0.78rem', fontWeight: 800, marginBottom: 7 }}>{children}</span>;
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid rgba(217,168,87,0.22)',
  borderRadius: 16,
  padding: 22,
  boxShadow: '0 14px 34px rgba(31,41,55,0.06)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid rgba(217,168,87,0.24)',
  background: '#fff',
  color: INK,
  outline: 'none',
  fontSize: '0.9rem',
};

const smallButtonStyle: React.CSSProperties = {
  minHeight: 38,
  padding: '0 12px',
  borderRadius: 9,
  border: '1px solid rgba(217,168,87,0.24)',
  background: 'rgba(217,168,87,0.1)',
  color: '#925f18',
  fontWeight: 900,
  cursor: 'pointer',
};
