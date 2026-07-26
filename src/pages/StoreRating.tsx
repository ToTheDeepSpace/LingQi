import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import CitySearchSelect from '../components/CitySearchSelect';
import { JumuluCompactHeader, JumuluPageFrame } from '../components/JumuluPageChrome';
import MobileTaskAction from '../components/MobileTaskAction';
import { readStoredCreatorAuth } from '../lib/authSession';
import { jumuluCardStyle, jumuluPrimaryLinkStyle, jumuluSecondaryLinkStyle } from '../styles/jumuluPageStyles';

const API = '/api';
const INK = '#1f2937';
const GOLD = '#a66a1f';
const BLUE = '#275389';
const MUTED = 'rgba(71,85,105,0.72)';

type StoreOption = { id: string; dm_name: string; city?: string | null; workplace?: string | null };
type ScriptOption = { id: string; name: string };

function localDateInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function normalizeSearch(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[^\p{L}\p{N}]+/gu, '');
}

function responseError(value: unknown, fallback: string) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'message' in value) return String((value as { message?: unknown }).message || fallback);
  return fallback;
}

export default function StoreRating() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStoreId = searchParams.get('storeId') || '';
  const auth = readStoredCreatorAuth();
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [scripts, setScripts] = useState<ScriptOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [createNewStore, setCreateNewStore] = useState(false);
  const [storeId, setStoreId] = useState(initialStoreId);
  const [storeQuery, setStoreQuery] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCity, setNewStoreCity] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreProfileUrl, setNewStoreProfileUrl] = useState('');
  const [scriptId, setScriptId] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [visitedOn, setVisitedOn] = useState('');
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [website, setWebsite] = useState('');
  const [formStartedAt] = useState(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`${API}/lc/dm-dossiers?entityType=store`, { signal: controller.signal }).then(response => response.json()),
      fetch(`${API}/lc/scripts`, { signal: controller.signal }).then(response => response.json()),
    ]).then(([storePayload, scriptPayload]) => {
      const nextStores = storePayload.success ? (storePayload.data || []) as StoreOption[] : [];
      setStores(nextStores);
      if (scriptPayload.success) setScripts((scriptPayload.data || []).map((item: ScriptOption) => ({ id: item.id, name: item.name })));
      if (initialStoreId) {
        const initialStore = nextStores.find(store => store.id === initialStoreId);
        if (initialStore) setStoreQuery(`${initialStore.dm_name} · ${initialStore.city || '城市待补'}`);
      }
      if (!storePayload.success || !scriptPayload.success) setMessage({ ok: false, text: '店家或剧本库加载失败，请稍后刷新' });
    }).catch(error => {
      if (error?.name !== 'AbortError') setMessage({ ok: false, text: '店家或剧本库加载失败，请稍后刷新' });
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [initialStoreId]);

  const selectedStore = useMemo(() => stores.find(store => store.id === storeId) || null, [storeId, stores]);
  const selectedScript = useMemo(() => scripts.find(script => script.id === scriptId) || null, [scriptId, scripts]);
  const storeResults = useMemo(() => {
    const key = normalizeSearch(storeQuery);
    if (!key || selectedStore) return [];
    return stores.filter(store => normalizeSearch(`${store.dm_name} ${store.city || ''} ${store.workplace || ''}`).includes(key)).slice(0, 20);
  }, [selectedStore, storeQuery, stores]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth?.token) {
      const redirect = storeId ? `/stores/rate?storeId=${encodeURIComponent(storeId)}` : '/stores/rate';
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/lc/store-ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          storeDossierId: createNewStore ? null : storeId,
          newStore: createNewStore ? {
            storeName: newStoreName.trim(),
            city: newStoreCity.trim(),
            workplace: newStoreAddress.trim(),
            profileUrl: newStoreProfileUrl.trim(),
          } : null,
          scriptId: scriptId || null,
          scriptName: (selectedScript?.name || scriptName).trim(),
          visitedOn,
          rating,
          content: content.trim(),
          tags: tags.split(/[，,、/\n]/).map(tag => tag.trim()).filter(Boolean),
          website,
          formStartedAt,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setMessage({ ok: false, text: responseError(payload.error, '提交失败') });
        return;
      }
      const candidateCount = Array.isArray(payload.data?.similar_candidates) ? payload.data.similar_candidates.length : 0;
      setMessage({
        ok: true,
        text: `${payload.data?.message || '已提交审核'}${candidateCount ? `；后台发现 ${candidateCount} 个相似店家档案，会在审核时创建或合并。` : ''}`,
      });
      setContent('');
      setTags('');
      setRating(0);
    } catch {
      setMessage({ ok: false, text: '网络错误，请稍后再试' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <JumuluPageFrame currentLabel="给店家评分" maxWidth={980}>
      <JumuluCompactHeader
        eyebrow="每次真实到店都可以记录"
        title="给店家评分"
        description="日期、剧本和体验理由用于说明这次真实到店；综合分按独立玩家计算，多次到店不会重复增加个人权重。"
      />

      <form id="store-rating-form" onSubmit={submit} style={formStyle}>
        {message && <Notice value={message} />}

        <Section title="1. 选择店家" description="优先关联已有店家；库里没有时直接提交待审店家档案。">
          <div style={switchStyle}>
            <button type="button" onClick={() => setCreateNewStore(false)} style={switchButton(!createNewStore)}>选择已有店家</button>
            <button type="button" onClick={() => { setCreateNewStore(true); setStoreId(''); setStoreQuery(''); }} style={switchButton(createNewStore)}>库里没有，创建店家</button>
          </div>
          {!createNewStore ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <Field label="搜索店家 *">
                <input
                  value={storeQuery}
                  onChange={event => { setStoreQuery(event.target.value); setStoreId(''); }}
                  placeholder="输入店家名称、城市或地址"
                  autoComplete="off"
                  style={inputStyle}
                />
              </Field>
              {storeResults.length > 0 && (
                <div style={resultListStyle}>
                  {storeResults.map(store => (
                    <button key={store.id} type="button" onClick={() => { setStoreId(store.id); setStoreQuery(`${store.dm_name} · ${store.city || '城市待补'}`); }} style={resultButtonStyle}>
                      <strong>{store.dm_name}</strong>
                      <span>{store.city || '城市待补'}{store.workplace ? ` · ${store.workplace}` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
              {storeQuery.trim() && !selectedStore && storeResults.length === 0 && !loading && (
                <p style={helperStyle}>没有找到店家。请检查名称，或切换“库里没有，创建店家”。</p>
              )}
              {selectedStore && <p style={selectedStyle}>已选择：{selectedStore.dm_name} · {selectedStore.city || '城市待补'}{selectedStore.workplace ? ` · ${selectedStore.workplace}` : ''}</p>}
            </div>
          ) : (
            <div style={responsiveGridStyle}>
              <Field label="店家名称 *"><input value={newStoreName} onChange={event => setNewStoreName(event.target.value)} required style={inputStyle} /></Field>
              <CitySearchSelect label="所在城市 *" value={newStoreCity} onChange={setNewStoreCity} allowCustom />
              <Field label="地址 / 商圈 / 常驻位置 *"><input value={newStoreAddress} onChange={event => setNewStoreAddress(event.target.value)} required style={inputStyle} /></Field>
              <Field label="店铺主页链接（可选）"><input value={newStoreProfileUrl} onChange={event => setNewStoreProfileUrl(event.target.value)} placeholder="小红书、抖音或公众号主页" style={inputStyle} /></Field>
            </div>
          )}
        </Section>

        <Section title="2. 关联这次到店" description="到店日期和所玩剧本必填，用于区分每一次真实体验。">
          <div style={responsiveGridStyle}>
            <Field label="从剧本库选择">
              <select value={scriptId} onChange={event => setScriptId(event.target.value)} style={inputStyle}>
                <option value="">库里没有或暂不选择</option>
                {scripts.map(script => <option key={script.id} value={script.id}>{script.name}</option>)}
              </select>
            </Field>
            {!scriptId && <Field label="剧本名称 *"><input value={scriptName} onChange={event => setScriptName(event.target.value)} required style={inputStyle} /></Field>}
            <Field label="到店日期 *"><input type="date" value={visitedOn} onChange={event => setVisitedOn(event.target.value)} max={localDateInputValue()} required style={inputStyle} /></Field>
          </div>
        </Section>

        <Section title="3. 综合五星" description="第一版只做综合评分；请具体说明这一次到店体验。">
          <fieldset style={fieldsetStyle}>
            <legend style={labelStyle}>综合评分 *</legend>
            <div role="radiogroup" aria-label="店家综合评分" style={starRowStyle}>
              {[1, 2, 3, 4, 5].map(value => (
                <button key={value} type="button" role="radio" aria-checked={rating === value} onClick={() => setRating(value)} style={starButton(rating >= value)}>{value} 星</button>
              ))}
            </div>
          </fieldset>
          <Field label="体验理由 *">
            <textarea value={content} onChange={event => setContent(event.target.value)} minLength={12} maxLength={2400} rows={6} required placeholder="可以写接待、环境、排期组织、房间设备和整体服务。不要上传隐私信息。" style={{ ...inputStyle, minHeight: 132, padding: 12, resize: 'vertical' }} />
          </Field>
          <Field label="标签（可选）"><input value={tags} onChange={event => setTags(event.target.value)} placeholder="例：环境好、隔音好、组织清楚" style={inputStyle} /></Field>
        </Section>

        <label aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
          Website<input value={website} onChange={event => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" />
        </label>

        <div style={submitRowStyle}>
          <Link to="/stores" style={jumuluSecondaryLinkStyle}>返回店家列表</Link>
          <button type="submit" disabled={submitting || loading || rating === 0 || (!createNewStore && !storeId)} style={{ ...jumuluPrimaryLinkStyle, opacity: submitting || loading || rating === 0 || (!createNewStore && !storeId) ? 0.5 : 1 }}>
            {submitting ? '提交中...' : auth?.token ? '提交审核' : '登录后提交'}
          </button>
        </div>
      </form>
      <MobileTaskAction
        form="store-rating-form"
        label={submitting ? '提交中...' : auth?.token ? '提交审核' : '登录后提交'}
        disabled={submitting || loading || rating === 0 || (!createNewStore && !storeId)}
      />
    </JumuluPageFrame>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section style={sectionStyle}><h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2><p style={{ margin: '6px 0 16px', color: MUTED, lineHeight: 1.65, fontSize: 14 }}>{description}</p>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: 6 }}><span style={labelStyle}>{label}</span>{children}</label>;
}

function Notice({ value }: { value: { ok: boolean; text: string } }) {
  return <div style={{ padding: '12px 14px', borderRadius: 8, border: `1px solid ${value.ok ? 'rgba(22,163,74,0.22)' : 'rgba(220,38,38,0.22)'}`, background: value.ok ? '#f0fdf4' : '#fef2f2', color: value.ok ? '#166534' : '#b91c1c', fontSize: 14, fontWeight: 800 }}>{value.text}</div>;
}

function switchButton(active: boolean): React.CSSProperties {
  return { minHeight: 36, border: `1px solid ${active ? BLUE : 'rgba(39,83,137,0.16)'}`, borderRadius: 7, padding: '0 12px', background: active ? BLUE : '#fff', color: active ? '#fff' : BLUE, fontWeight: 900, cursor: 'pointer' };
}

function starButton(active: boolean): React.CSSProperties {
  return { minWidth: 58, minHeight: 40, borderRadius: 7, border: active ? `1px solid ${GOLD}` : '1px solid rgba(148,163,184,0.24)', background: active ? '#fff8e8' : '#fff', color: active ? '#7a4d14' : MUTED, fontWeight: 900, cursor: 'pointer' };
}

const formStyle: React.CSSProperties = { display: 'grid', gap: 12 };
const sectionStyle: React.CSSProperties = { ...jumuluCardStyle, padding: 16 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 42, border: '1px solid rgba(39,83,137,0.18)', borderRadius: 7, padding: '0 12px', background: '#fff', color: INK, fontSize: 14 };
const labelStyle: React.CSSProperties = { color: '#526170', fontSize: 13, fontWeight: 850 };
const switchStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 };
const responsiveGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 12 };
const resultListStyle: React.CSSProperties = { display: 'grid', borderTop: '1px solid rgba(31,41,55,0.08)' };
const resultButtonStyle: React.CSSProperties = { minHeight: 60, display: 'grid', gridTemplateColumns: 'minmax(120px, 0.5fr) minmax(0, 1fr)', gap: 12, alignItems: 'center', border: 0, borderBottom: '1px solid rgba(31,41,55,0.08)', padding: '9px 2px', background: '#fff', color: INK, textAlign: 'left', cursor: 'pointer' };
const selectedStyle: React.CSSProperties = { margin: 0, borderRadius: 7, padding: '10px 12px', background: '#eef6ff', color: BLUE, fontSize: 13, fontWeight: 850 };
const helperStyle: React.CSSProperties = { margin: 0, color: MUTED, fontSize: 13 };
const fieldsetStyle: React.CSSProperties = { margin: 0, border: 0, padding: 0 };
const starRowStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 14px' };
const submitRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' };
