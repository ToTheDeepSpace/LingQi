import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CitySearchSelect from '../components/CitySearchSelect';
import ImageUpload from '../components/ImageUpload';
import { generatedAvatarDataUrl } from '../lib/avatar';

const API = '/api';
const BG = '#fffdf8';
const GOLD = '#a66a1f';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

type AuthSession = { token: string; displayName: string; userId?: string };
type DossierEntityType = 'dm' | 'store';
type EntityFilter = 'all' | DossierEntityType;

type DmDossier = {
  id: string;
  entity_type?: DossierEntityType | null;
  dm_name: string;
  city?: string | null;
  workplace?: string | null;
  profile_url?: string | null;
  photo_url?: string | null;
  note?: string | null;
  tags?: string[];
  claim_status?: 'unclaimed' | 'pending' | 'approved' | 'rejected';
  claimed_by?: string | null;
  created_at?: string;
};

const ENTITY_COPY: Record<DossierEntityType, {
  filterLabel: string;
  kindLabel: string;
  nameLabel: string;
  workplaceLabel: string;
  profileLabel: string;
  photoLabel: string;
  notePlaceholder: string;
  tagsLabel: string;
  tagsPlaceholder: string;
}> = {
  dm: {
    filterLabel: 'DM 档案',
    kindLabel: 'DM',
    nameLabel: 'DM 名称 *',
    workplaceLabel: '工作地点 / 常驻店家 *',
    profileLabel: '个人主页链接 *',
    photoLabel: 'DM 照片 *',
    notePlaceholder: '例如擅长本、开本风格、常驻店家补充。不要写隐私手机号。',
    tagsLabel: '玩家标签',
    tagsPlaceholder: '例：控场稳 / 陪伴感强 / 会加亡夫戏',
  },
  store: {
    filterLabel: '店家档案',
    kindLabel: '店家',
    nameLabel: '店家名称 *',
    workplaceLabel: '地址 / 商圈 / 常驻位置 *',
    profileLabel: '店铺主页链接',
    photoLabel: '店铺照片',
    notePlaceholder: '例如房间环境、新本速度、常驻 DM、停车和交通情况。不要写隐私手机号。',
    tagsLabel: '店家标签',
    tagsPlaceholder: '例：环境好 / 隔音好 / 新本快 / 空调足',
  },
};

const ENTITY_FILTERS: { value: EntityFilter; label: string; helper: string }[] = [
  { value: 'all', label: '全部档案', helper: '爱D和店家一起看' },
  { value: 'dm', label: '爱D档案', helper: 'DM / 卡司' },
  { value: 'store', label: '店家档案', helper: '城市店铺' },
];

const ENTITY_FORM_TYPES: { value: DossierEntityType; label: string; helper: string }[] = [
  { value: 'dm', label: '爱D档案', helper: '给 DM / 卡司建档' },
  { value: 'store', label: '店家档案', helper: '给城市店家建档' },
];

function getAuth(): AuthSession | null {
  try {
    const stored = localStorage.getItem('lc_creator');
    if (!stored) return null;
    const data = JSON.parse(stored);
    if (!data?.token) return null;
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) return null;
    return { token: data.token, displayName: data.display_name || '用户', userId: payload.creatorId };
  } catch {
    return null;
  }
}

function normalizeUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function normalizeEntityType(value?: string | null): DossierEntityType {
  return value === 'store' ? 'store' : 'dm';
}

export default function DmWall() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [items, setItems] = useState<DmDossier[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [city, setCity] = useState('all');
  const [entityType, setEntityType] = useState<EntityFilter>('all');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ entityType: 'dm' as DossierEntityType, dmName: '', city: '', workplace: '', profileUrl: '', photoUrl: '', note: '', tags: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [claimingId, setClaimingId] = useState('');

  const requestKey = useMemo(() => `${city}|${entityType}|${query.trim()}`, [city, entityType, query]);
  const loading = loadedKey !== requestKey;
  const activeFormCopy = ENTITY_COPY[form.entityType];

  const loadDossiers = useCallback((signal?: AbortSignal) => {
    const nextKey = `${city}|${entityType}|${query.trim()}`;
    const params = new URLSearchParams();
    if (city !== 'all') params.set('city', city);
    if (entityType !== 'all') params.set('entityType', entityType);
    if (query.trim()) params.set('q', query.trim());
    fetch(`${API}/lc/dm-dossiers?${params}`, { signal })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setItems(d.data || []);
        } else {
          setItems([]);
          setMessage({ text: d.error || '爱D墙加载失败', ok: false });
        }
      })
      .catch(error => {
        if (error?.name !== 'AbortError') {
          setItems([]);
          setMessage({ text: '网络错误，爱D墙暂时加载失败', ok: false });
        }
      })
      .finally(() => {
        if (!signal?.aborted) setLoadedKey(nextKey);
      });
  }, [city, entityType, query]);

  useEffect(() => {
    const controller = new AbortController();
    loadDossiers(controller.signal);
    return () => controller.abort();
  }, [loadDossiers]);

  const updateForm = (patch: Partial<typeof form>) => {
    setForm(prev => ({ ...prev, ...patch }));
    setMessage(null);
  };

  const submit = async () => {
    const current = getAuth();
    if (!current) {
      navigate('/login');
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const r = await fetch(`${API}/lc/dm-dossiers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` },
        body: JSON.stringify({
          entityType: form.entityType,
          dmName: form.dmName.trim(),
          city: form.city.trim(),
          workplace: form.workplace.trim(),
          profileUrl: form.profileUrl.trim(),
          photoUrl: form.photoUrl.trim(),
          note: form.note.trim(),
          tags: form.tags.split(/[，,、/\n]/).map(tag => tag.trim()).filter(Boolean),
          photoFiles: form.photoUrl ? [{ name: `${ENTITY_COPY[form.entityType].kindLabel} 照片`, url: form.photoUrl, type: 'image/*' }] : [],
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        const errText = typeof d.error === 'string' ? d.error : (d.error?.message || '提交失败');
        setMessage({ text: errText, ok: false });
        return;
      }
      setMessage({ text: '已提交，管理员审核通过后会公开到档案墙。', ok: true });
      setShowForm(false);
      setForm({ entityType: form.entityType, dmName: '', city: '', workplace: '', profileUrl: '', photoUrl: '', note: '', tags: '' });
      loadDossiers();
    } catch {
      setMessage({ text: '网络错误，请稍后再试', ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const claim = async (item: DmDossier) => {
    const current = getAuth();
    if (!current) {
      navigate('/login');
      return;
    }
    const kind = normalizeEntityType(item.entity_type);
    const claimNote = window.prompt(
      `认领「${item.dm_name}」${ENTITY_COPY[kind].kindLabel}档案，请简单写明你如何证明这是你的主页或店铺`,
      kind === 'store' ? '我是该店家负责人，营业执照/店铺后台/实名信息可供后台核验' : '我是该 DM 本人，主页/手机号/实名信息可供后台核验',
    );
    if (claimNote === null) return;
    setClaimingId(item.id);
    setMessage(null);
    try {
      const r = await fetch(`${API}/lc/dm-dossiers/${item.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` },
        body: JSON.stringify({ claimNote }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        const errText = typeof d.error === 'string' ? d.error : (d.error?.message || '认领失败');
        setMessage({ text: errText, ok: false });
        return;
      }
      setMessage({ text: '认领申请已提交，后台审核通过后会绑定到你的灵契主页。', ok: true });
      loadDossiers();
    } catch {
      setMessage({ text: '网络错误，请稍后再试', ok: false });
    } finally {
      setClaimingId('');
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: BG, color: INK }}>
      <section style={{ background: 'linear-gradient(135deg, #fffaf2 0%, #eef6ff 100%)', borderBottom: '1px solid rgba(166,106,31,0.16)', padding: '44px 20px 30px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 760 }}>
            <p style={{ margin: '0 0 8px', color: '#92400e', fontWeight: 900, fontSize: 13 }}>未认证档案墙</p>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 5vw, 3.1rem)', lineHeight: 1.15 }}>爱D墙 / 店家档案</h1>
            <p style={{ margin: '14px 0 0', color: MUTED, lineHeight: 1.8 }}>
              玩家可以先为还没入驻灵契的 DM 和店家建档，补充主页、城市、工作地点或店铺位置；本人或店家入驻后可认领自己的档案，逐步沉淀成城市新人入门时能看懂的口碑百科。
            </p>
          </div>
          <button onClick={() => auth ? setShowForm(v => !v) : navigate('/login')} style={primaryButton}>
            {showForm ? '收起建档' : '+ 创建未认证档案'}
          </button>
        </div>
      </section>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 20px 82px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <CitySearchSelect
            value={city}
            onChange={setCity}
            allowAll
            allowCustom
            style={{ minWidth: 190, flex: '1 1 190px' }}
          />
          <EntityFilterSwitch value={entityType} onChange={setEntityType} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索 DM / 店家名称" style={{ ...inputStyle, minWidth: 180, flex: '1 1 220px' }} />
          <Link to="/reputation/city" style={ghostButton}>看城市口碑榜</Link>
          <Link to="/boundary-votes" style={ghostButton}>社交边界投票</Link>
        </div>

        {message && (
          <div style={{ marginBottom: 16, borderRadius: 12, padding: '12px 14px', border: `1px solid ${message.ok ? 'rgba(22,163,74,0.24)' : 'rgba(220,38,38,0.22)'}`, background: message.ok ? 'rgba(220,252,231,0.72)' : 'rgba(254,226,226,0.62)', color: message.ok ? '#15803d' : '#b91c1c', fontSize: 14, fontWeight: 700 }}>
            {message.text}
          </div>
        )}

        {showForm && (
          <section style={formCard}>
            <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-serif)', fontSize: '1.35rem' }}>创建未认证档案</h2>
            <EntityFormSwitch value={form.entityType} onChange={value => updateForm({ entityType: value })} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
              <CitySearchSelect
                label="城市 *"
                value={form.city}
                onChange={value => updateForm({ city: value })}
                allowCustom
                placeholder="搜索城市，例如：保定、上海"
              />
              <Field label={activeFormCopy.nameLabel} value={form.dmName} onChange={value => updateForm({ dmName: value })} />
              <Field label={activeFormCopy.workplaceLabel} value={form.workplace} onChange={value => updateForm({ workplace: value })} />
              <Field label={activeFormCopy.profileLabel} value={form.profileUrl} onChange={value => updateForm({ profileUrl: value })} placeholder={form.entityType === 'store' ? '大众点评 / 小红书 / 抖音店铺主页，可后补' : '抖音 / 小红书 / 微博主页'} />
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'end' }}>
              <Field label={activeFormCopy.photoLabel} value={form.photoUrl} onChange={value => updateForm({ photoUrl: value })} placeholder="上传后自动填入，也可粘贴图片链接" />
              {auth && <ImageUpload token={auth.token} scope="dm-dossier" label="上传照片" onUploaded={url => updateForm({ photoUrl: url })} />}
            </div>
            <label style={{ display: 'block', marginTop: 12 }}>
              <span style={labelStyle}>补充说明</span>
              <textarea value={form.note} onChange={e => updateForm({ note: e.target.value })} rows={4} placeholder={activeFormCopy.notePlaceholder} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
            </label>
            <Field label={activeFormCopy.tagsLabel} value={form.tags} onChange={value => updateForm({ tags: value })} placeholder={activeFormCopy.tagsPlaceholder} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button onClick={submit} disabled={submitting} style={{ ...primaryButton, opacity: submitting ? 0.55 : 1 }}>{submitting ? '提交中...' : '提交审核'}</button>
              <button onClick={() => setShowForm(false)} style={ghostButton}>取消</button>
            </div>
          </section>
        )}

        {loading ? (
          <p style={{ color: MUTED, padding: '36px 0' }}>加载中...</p>
        ) : items.length === 0 ? (
          <div style={emptyStyle}>当前筛选下暂无公开档案。你可以先创建一个，审核后会出现在档案墙。</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {items.map(item => {
              const kind = normalizeEntityType(item.entity_type);
              const copy = ENTITY_COPY[kind];
              return (
                <article key={item.id} style={cardStyle}>
                  <img src={item.photo_url || generatedAvatarDataUrl(item.dm_name, item.id)} alt="" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 10, background: '#fffaf2', marginBottom: 12 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7 }}>
                    <span style={{ ...badgeStyle, color: '#275389', background: 'rgba(239,246,255,0.88)' }}>{copy.kindLabel}</span>
                    <h2 style={{ margin: 0, fontSize: 18 }}>{item.dm_name}</h2>
                    <span style={{ ...badgeStyle, color: item.claim_status === 'approved' ? '#15803d' : GOLD, background: item.claim_status === 'approved' ? 'rgba(220,252,231,0.72)' : 'rgba(166,106,31,0.10)' }}>
                      {item.claim_status === 'approved' ? '已认领' : item.claim_status === 'pending' ? '认领审核中' : '未认领'}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px', color: MUTED, lineHeight: 1.7, fontSize: 14 }}>
                    {item.city || '未知城市'} · {item.workplace || (kind === 'store' ? '店铺位置待补充' : '工作地点待补充')}
                  </p>
                  {item.note && <p style={{ margin: '0 0 10px', color: 'rgba(31,41,55,0.78)', lineHeight: 1.7, fontSize: 14 }}>{item.note}</p>}
                  {item.tags && item.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {item.tags.slice(0, 6).map(tag => <span key={tag} style={tagStyle}>{tag}</span>)}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
                    {item.profile_url && <a href={normalizeUrl(item.profile_url)} target="_blank" rel="noreferrer" style={ghostButton}>{kind === 'store' ? '店铺主页' : '个人主页'}</a>}
                    {item.claim_status === 'approved' && item.claimed_by
                      ? (kind === 'dm' ? <Link to={`/explore/${item.claimed_by}`} style={ghostButton}>灵契主页</Link> : <span style={ghostStatic}>已绑定店家账号</span>)
                      : <button onClick={() => claim(item)} disabled={claimingId === item.id || item.claim_status === 'pending'} style={ghostButton}>
                          {claimingId === item.id ? '提交中...' : item.claim_status === 'pending' ? '认领审核中' : kind === 'store' ? '我是店家，认领' : '我是本人，认领'}
                        </button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function EntityFilterSwitch({ value, onChange }: { value: EntityFilter; onChange: (value: EntityFilter) => void }) {
  return (
    <div aria-label="档案类型筛选" style={{ ...segmentShell, flex: '2 1 360px' }}>
      {ENTITY_FILTERS.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          style={segmentButton(value === option.value)}
        >
          <span style={segmentLabel}>{option.label}</span>
          <span style={segmentHelper}>{option.helper}</span>
        </button>
      ))}
    </div>
  );
}

function EntityFormSwitch({ value, onChange }: { value: DossierEntityType; onChange: (value: DossierEntityType) => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={labelStyle}>档案类型 *</span>
      <div aria-label="建档类型" style={segmentShell}>
        {ENTITY_FORM_TYPES.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            style={segmentButton(value === option.value)}
          >
            <span style={segmentLabel}>{option.label}</span>
            <span style={segmentHelper}>{option.helper}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, width: '100%' }} />
    </label>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', color: 'rgba(71,85,105,0.72)', fontSize: 13, fontWeight: 800, marginBottom: 6 };
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', padding: '11px 12px', borderRadius: 10, border: '1px solid rgba(166,106,31,0.20)', background: '#fff', color: INK, outline: 'none', fontSize: 14 };
const segmentShell: React.CSSProperties = {
  boxSizing: 'border-box',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
  gap: 6,
  padding: 5,
  borderRadius: 12,
  border: '1px solid rgba(166,106,31,0.24)',
  background: 'rgba(255,250,242,0.92)',
  minWidth: 0,
};
const segmentLabel: React.CSSProperties = { fontSize: 14, fontWeight: 900, lineHeight: 1.2 };
const segmentHelper: React.CSSProperties = { fontSize: 11, fontWeight: 800, lineHeight: 1.2, opacity: 0.82 };
const segmentButton = (active: boolean): React.CSSProperties => ({
  minHeight: 52,
  border: active ? '1px solid rgba(166,106,31,0.42)' : '1px solid transparent',
  borderRadius: 9,
  background: active ? `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)` : '#fff',
  color: active ? '#fffdf8' : 'rgba(31,41,55,0.82)',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: '8px 10px',
  boxShadow: active ? '0 10px 20px rgba(166,106,31,0.22)' : 'none',
  textAlign: 'center',
});
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 10, background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: '#fffdf8', padding: '11px 18px', fontWeight: 900, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const ghostButton: React.CSSProperties = { border: '1px solid rgba(166,106,31,0.22)', borderRadius: 10, background: '#fffaf2', color: GOLD, padding: '9px 13px', fontWeight: 800, cursor: 'pointer', textDecoration: 'none', fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const ghostStatic: React.CSSProperties = { ...ghostButton, cursor: 'default' };
const formCard: React.CSSProperties = { marginBottom: 18, padding: 18, borderRadius: 14, border: '1px solid rgba(166,106,31,0.16)', background: '#fff', boxShadow: '0 10px 26px rgba(102,70,30,0.06)' };
const cardStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', padding: 14, borderRadius: 14, border: '1px solid rgba(166,106,31,0.16)', background: '#fff', boxShadow: '0 10px 26px rgba(102,70,30,0.06)', minHeight: 0 };
const badgeStyle: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(166,106,31,0.14)', fontSize: 12, fontWeight: 900 };
const tagStyle: React.CSSProperties = { padding: '3px 8px', borderRadius: 999, background: 'rgba(239,246,255,0.88)', color: '#275389', fontSize: 12, fontWeight: 800 };
const emptyStyle: React.CSSProperties = { padding: 28, borderRadius: 14, border: '1px dashed rgba(166,106,31,0.22)', background: '#fff', color: MUTED, textAlign: 'center', lineHeight: 1.8 };
