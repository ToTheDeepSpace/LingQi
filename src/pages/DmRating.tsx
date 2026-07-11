import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type React from 'react';
import CitySearchSelect from '../components/CitySearchSelect';
import ImageUpload from '../components/ImageUpload';
import { readStoredCreatorAuth } from '../lib/authSession';
import { CHANTO_FREEZE_DAYS, CHANTO_MAX_AMOUNT } from '../lib/chanto';

const API = '/api';
const BG = '#fffdf8';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.74)';
const GOLD = '#a66a1f';

type AuthSession = { token: string; displayName: string };
type DmOption = { id: string; dm_name: string; city?: string | null; workplace?: string | null; employment_status?: 'unknown' | 'store_affiliated' | 'freelance'; claim_status?: string; claimed_by?: string | null };
type LibraryOption = { id: string; name: string; city?: string | null };
type StoreOption = LibraryOption & {
  linkedStoreId?: string | null;
  linkedStoreDossierId?: string | null;
};

function getAuth(): AuthSession | null {
  const data = readStoredCreatorAuth();
  return data?.token ? { token: data.token, displayName: data.display_name || '匿名玩家' } : null;
}

function responseError(value: unknown, fallback: string) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'message' in value) return String((value as { message?: unknown }).message || fallback);
  return fallback;
}

function localDateInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function normalizeCatalogSearch(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[^\p{L}\p{N}]+/gu, '');
}

export default function DmRating() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = getAuth();
  const [dms, setDms] = useState<DmOption[]>([]);
  const [scripts, setScripts] = useState<LibraryOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [employerStores, setEmployerStores] = useState<DmOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [createNewDm, setCreateNewDm] = useState(false);
  const [dmId, setDmId] = useState(searchParams.get('dmId') || '');
  const [dmName, setDmName] = useState('');
  const [dmCity, setDmCity] = useState('');
  const [dmEmploymentStatus, setDmEmploymentStatus] = useState<'store_affiliated' | 'freelance'>('store_affiliated');
  const [dmEmployerStoreId, setDmEmployerStoreId] = useState('');
  const [dmProfileUrl, setDmProfileUrl] = useState('');
  const [dmPhotoUrl, setDmPhotoUrl] = useState('');
  const [scriptId, setScriptId] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [storeDossierId, setStoreDossierId] = useState('');
  const [storeCatalogId, setStoreCatalogId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [playedOn, setPlayedOn] = useState('');
  const [replayNumber, setReplayNumber] = useState('1');
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [chantoAmount, setChantoAmount] = useState('0');
  const [chantoMessage, setChantoMessage] = useState('');
  const [chantoAnonymous, setChantoAnonymous] = useState(false);
  const [paidBalance, setPaidBalance] = useState<number | null>(null);
  const [website, setWebsite] = useState('');
  const [formStartedAt] = useState(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`${API}/lc/dm-dossiers?entityType=dm`, { signal: controller.signal }).then(r => r.json()),
      fetch(`${API}/lc/scripts`, { signal: controller.signal }).then(r => r.json()),
      fetch(`${API}/lc/stores?catalog=reputation`, { signal: controller.signal }).then(r => r.json()),
      fetch(`${API}/lc/dm-dossiers?entityType=store`, { signal: controller.signal }).then(r => r.json()),
    ]).then(([dmData, scriptData, storeData, employerStoreData]) => {
      if (dmData.success) setDms(dmData.data || []);
      if (scriptData.success) setScripts((scriptData.data || []).map((item: { id: string; name: string }) => ({ id: item.id, name: item.name })));
      if (storeData.success) setStores((storeData.data || []).map((item: { id: string; linked_store_id?: string | null; linked_store_dossier_id?: string | null; name: string; city?: string | null }) => ({
        id: item.id,
        linkedStoreId: item.linked_store_id || null,
        linkedStoreDossierId: item.linked_store_dossier_id || null,
        name: item.name,
        city: item.city,
      })));
      if (employerStoreData.success) setEmployerStores(employerStoreData.data || []);
    }).catch(error => {
      if (error?.name !== 'AbortError') setMessage({ text: 'DM、店家或剧本库加载失败，请稍后刷新', ok: false });
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!auth?.token) return;
    const controller = new AbortController();
    fetch(`${API}/lc/wallet`, { headers: { Authorization: `Bearer ${auth.token}` }, signal: controller.signal })
      .then(response => response.json())
      .then(body => { if (body.success) setPaidBalance(Number(body.data?.paid_balance || 0)); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [auth?.token]);

  const selectedDm = useMemo(() => dms.find(item => item.id === dmId) || null, [dmId, dms]);
  const selectedScript = useMemo(() => scripts.find(item => item.id === scriptId) || null, [scriptId, scripts]);
  const selectedStore = useMemo(() => stores.find(item => item.id === storeCatalogId) || null, [storeCatalogId, stores]);
  const selectedDmCanReceiveChanto = Boolean(selectedDm?.claim_status === 'approved' && selectedDm.claimed_by);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth) {
      navigate(`/login?redirect=${encodeURIComponent('/dm/rate')}`);
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const body = {
        dmId: createNewDm ? null : dmId,
        newDm: createNewDm ? {
          dmName: dmName.trim(),
          city: dmCity.trim(),
          employmentStatus: dmEmploymentStatus,
          employerStoreId: dmEmploymentStatus === 'store_affiliated' ? dmEmployerStoreId : null,
          profileUrl: dmProfileUrl.trim(),
          photoUrl: dmPhotoUrl.trim(),
        } : null,
        scriptId: scriptId || null,
        scriptName: (selectedScript?.name || scriptName).trim(),
        storeId: storeId || null,
        storeDossierId: storeDossierId || null,
        storeName: (selectedStore?.name || storeName).trim(),
        playedOn,
        replayNumber: Number(replayNumber),
        rating,
        content: content.trim(),
        tags: tags.split(/[，,、/\n]/).map(item => item.trim()).filter(Boolean),
        website,
        formStartedAt,
      };
      const response = await fetch(`${API}/lc/dm-ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setMessage({ text: responseError(data.error, '提交失败'), ok: false });
        return;
      }
      const candidateCount = Array.isArray(data.data?.similar_candidates) ? data.data.similar_candidates.length : 0;
      let chantoResult = '';
      const giftAmount = Number(chantoAmount || 0);
      if (giftAmount > 0 && selectedDmCanReceiveChanto && data.data?.dm_id) {
        const giftResponse = await fetch(`${API}/lc/dm-dossiers/${encodeURIComponent(data.data.dm_id)}/gifts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
          body: JSON.stringify({
            amount: giftAmount,
            message: chantoMessage.trim() || null,
            isAnonymous: chantoAnonymous,
            ratingId: data.data.id,
            requestKey: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `dm-rating-gift-${Date.now()}`,
          }),
        });
        const giftData = await giftResponse.json();
        if (giftResponse.ok && giftData.success) {
          chantoResult = `；${giftAmount} 缠头已送出`;
          setPaidBalance(Number(giftData.data?.paid_balance || 0));
          setChantoAmount('0');
          setChantoMessage('');
        } else {
          chantoResult = `；评分已提交，但缠头未送出：${responseError(giftData.error, '发送失败')}`;
        }
      }
      setMessage({
        text: `${data.data?.message || '已提交审核'}${candidateCount ? `；后台发现 ${candidateCount} 个相似DM档案，会在审核时创建或合并。` : ''}${chantoResult}`,
        ok: true,
      });
      setContent('');
      setTags('');
      setRating(0);
    } catch {
      setMessage({ text: '网络错误，请稍后再试', ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: BG, color: INK }}>
      <section style={{ borderBottom: '1px solid rgba(166,106,31,0.16)', background: '#fffaf2', padding: '34px 20px 26px' }}>
        <div style={{ maxWidth: 940, margin: '0 auto' }}>
          <p style={{ margin: '0 0 8px', color: GOLD, fontWeight: 900, fontSize: 13 }}>每一次体验都可以记录</p>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>给 DM 评分</h1>
          <p style={{ margin: '12px 0 0', color: MUTED, lineHeight: 1.75 }}>综合分按独立玩家计算。同一个人多次体验会全部展示，但不会因为刷很多次获得更多计分权重。</p>
        </div>
      </section>

      <form onSubmit={submit} style={{ maxWidth: 940, margin: '0 auto', padding: '24px 20px 72px', display: 'grid', gap: 16 }}>
        {message && <Notice value={message} />}
        <Section title="1. 选择 DM" description="优先关联库里已有的DM；没找到时直接创建待审档案。">
          <div style={switchStyle}>
            <button type="button" onClick={() => setCreateNewDm(false)} style={switchButton(!createNewDm)}>选择已有DM</button>
            <button type="button" onClick={() => setCreateNewDm(true)} style={switchButton(createNewDm)}>库里没有，创建DM</button>
          </div>
          {!createNewDm ? (
            <Field label="DM *">
              <select value={dmId} onChange={event => setDmId(event.target.value)} required style={inputStyle}>
                <option value="">请选择DM</option>
                {dms.map(item => <option key={item.id} value={item.id}>{item.dm_name} · {item.city || '城市待补'} · {item.employment_status === 'freelance' ? '自由DM' : item.workplace || '店家待补'}</option>)}
              </select>
              {selectedDm && <Helper>{selectedDm.city || '城市待补'} · {selectedDm.employment_status === 'freelance' ? '无受雇店家（自由DM）' : selectedDm.workplace || '受雇店家待补'}</Helper>}
            </Field>
          ) : (
            <div style={responsiveGrid}>
              <Field label="DM名称 *"><input value={dmName} onChange={event => setDmName(event.target.value)} required style={inputStyle} /></Field>
              <CitySearchSelect label="城市 *" value={dmCity} onChange={setDmCity} allowCustom />
              <Field label="受雇店家 *">
                <div style={switchStyle}>
                  <button type="button" onClick={() => setDmEmploymentStatus('store_affiliated')} style={switchButton(dmEmploymentStatus === 'store_affiliated')}>选择已有店家</button>
                  <button type="button" onClick={() => { setDmEmploymentStatus('freelance'); setDmEmployerStoreId(''); }} style={switchButton(dmEmploymentStatus === 'freelance')}>无受雇店家（自由DM）</button>
                </div>
                {dmEmploymentStatus === 'store_affiliated' && (
                  <select value={dmEmployerStoreId} onChange={event => {
                    const id = event.target.value;
                    setDmEmployerStoreId(id);
                    const store = employerStores.find(item => item.id === id);
                    if (!dmCity && store?.city) setDmCity(store.city);
                  }} required style={inputStyle}>
                    <option value="">请选择已有店家档案</option>
                    {employerStores.map(item => <option key={item.id} value={item.id}>{item.dm_name} · {item.city || '城市待补'}</option>)}
                  </select>
                )}
              </Field>
              <Field label="个人主页链接（可选）"><input value={dmProfileUrl} onChange={event => setDmProfileUrl(event.target.value)} style={inputStyle} /></Field>
              <Field label="DM照片（可选）">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={dmPhotoUrl} onChange={event => setDmPhotoUrl(event.target.value)} placeholder="上传后自动填入" style={{ ...inputStyle, flex: 1 }} />
                  {auth && <ImageUpload token={auth.token} scope="dm-dossier" label="上传" onUploaded={setDmPhotoUrl} />}
                </div>
              </Field>
            </div>
          )}
        </Section>

        <Section title="2. 关联这次体验" description="剧本、日期、第几刷和店家/场地都是必填。">
          <div style={responsiveGrid}>
            <Field label="从剧本库选择">
              <select value={scriptId} onChange={event => setScriptId(event.target.value)} style={inputStyle}>
                <option value="">库里没有或暂不选择</option>
                {scripts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            {!scriptId && <Field label="剧本名称 *"><input value={scriptName} onChange={event => setScriptName(event.target.value)} required style={inputStyle} /></Field>}
            <StoreSearchField
              label="店家或场地 *"
              value={storeName}
              stores={stores}
              required
              onChange={value => {
                setStoreName(value);
                setStoreId('');
                setStoreDossierId('');
                setStoreCatalogId('');
              }}
              onSelect={item => {
                setStoreName(item.name);
                setStoreId(item.linkedStoreId || '');
                setStoreDossierId(item.linkedStoreDossierId || '');
                setStoreCatalogId(item.id);
              }}
            />
            <Field label="体验日期 *"><input type="date" value={playedOn} onChange={event => setPlayedOn(event.target.value)} required max={localDateInputValue()} style={inputStyle} /></Field>
            <Field label="这是你第几刷 *"><input type="number" min={1} max={99} value={replayNumber} onChange={event => setReplayNumber(event.target.value)} required style={inputStyle} /></Field>
          </div>
          <p style={{ margin: '12px 0 0', color: MUTED, fontSize: 13 }}>剧本资料不完整时，可以稍后去 <Link to="/scripts/contribute" style={{ color: GOLD, fontWeight: 900 }}>共建剧本库</Link>。</p>
        </Section>

        <Section title="3. 综合五星" description="第一版只做综合评分，评价理由必须填写。">
          <div role="radiogroup" aria-label="综合评分" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[1, 2, 3, 4, 5].map(value => (
              <button key={value} type="button" role="radio" aria-checked={rating === value} onClick={() => setRating(value)} style={starButton(rating >= value)}>{value} 星</button>
            ))}
          </div>
          <Field label="评价理由 *"><textarea value={content} onChange={event => setContent(event.target.value)} minLength={12} maxLength={2400} rows={7} required placeholder="具体写这一次的控场、信息表达、节奏和玩家体验。不要上传隐私信息。" style={{ ...inputStyle, resize: 'vertical' }} /></Field>
          <Field label="标签（可选）"><input value={tags} onChange={event => setTags(event.target.value)} placeholder="例：节奏稳、信息清楚、情绪承接" style={inputStyle} /></Field>
        </Section>

        {!createNewDm && selectedDm && <Section title="4. 顺便送缠头（可选）" description="缠头是给已认证 DM 的自愿支持，与评分结果、审核和口碑排序完全分开。">
          {selectedDmCanReceiveChanto ? <>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {[0, 10, 30, 50, 100].map(value => <button key={value} type="button" onClick={() => setChantoAmount(String(value))} style={chantoButton(Number(chantoAmount) === value)}>{value === 0 ? '不送' : `${value} 缠头`}</button>)}
            </div>
            {Number(chantoAmount) > 0 && <div style={{ ...responsiveGrid, marginTop: 12 }}>
              <Field label={`自定义数量（1-${CHANTO_MAX_AMOUNT}）`}><input inputMode="numeric" value={chantoAmount} onChange={event => setChantoAmount(event.target.value.replace(/\D/g, '').slice(0, 4))} style={inputStyle} /></Field>
              <Field label="附言（选填，仅收款方可见）"><input value={chantoMessage} maxLength={200} onChange={event => setChantoMessage(event.target.value)} style={inputStyle} /></Field>
            </div>}
            {Number(chantoAmount) > 0 && <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: MUTED, fontSize: 13 }}><input type="checkbox" checked={chantoAnonymous} onChange={event => setChantoAnonymous(event.target.checked)} />公开记录中匿名</label>}
            <p style={{ margin: '10px 0 0', color: MUTED, fontSize: 12, lineHeight: 1.65 }}>只使用充值榜金，赠送榜金不能转为可提现收入。可用充值榜金 {paidBalance ?? '查询中'}；平台服务费 20%，DM 收入 T+{CHANTO_FREEZE_DAYS} 可提现。</p>
          </> : <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>这位 DM 尚未完成本人认领与收款身份认证，当前只提交评分。</p>}
        </Section>}

        <label aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
          Website<input value={website} onChange={event => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" />
        </label>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Link to="/dm" style={secondaryButton}>返回DM库</Link>
          <button type="submit" disabled={submitting || loading || rating === 0} style={{ ...primaryButton, opacity: submitting || loading || rating === 0 ? 0.52 : 1 }}>
            {submitting ? '提交中...' : auth ? '提交审核' : '登录后提交'}
          </button>
        </div>
      </form>
    </main>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section style={sectionStyle}><h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2><p style={{ margin: '6px 0 16px', color: MUTED, lineHeight: 1.65, fontSize: 14 }}>{description}</p>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 13, fontWeight: 850 }}>{label}</span>{children}</label>;
}

function Helper({ children }: { children: React.ReactNode }) {
  return <span style={{ color: MUTED, fontSize: 12 }}>{children}</span>;
}

function StoreSearchField({
  label,
  value,
  stores,
  required = false,
  onChange,
  onSelect,
}: {
  label: string;
  value: string;
  stores: StoreOption[];
  required?: boolean;
  onChange: (value: string) => void;
  onSelect: (item: StoreOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const query = normalizeCatalogSearch(value);
  const matches = stores
    .map(item => {
      const normalizedName = normalizeCatalogSearch(item.name);
      const normalizedHaystack = normalizeCatalogSearch(`${item.name}${item.city || ''}`);
      const score = !query
        ? 3
        : normalizedName === query ? 0 : normalizedName.startsWith(query) ? 1 : normalizedHaystack.includes(query) ? 2 : 99;
      return { item, score };
    })
    .filter(match => match.score < 99)
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name, 'zh-CN'))
    .slice(0, 12)
    .map(match => match.item);

  return (
    <div style={{ display: 'grid', gap: 6, position: 'relative' }}>
      <span style={{ color: MUTED, fontSize: 13, fontWeight: 850 }}>{label}</span>
      <input
        value={value}
        onChange={event => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        required={required}
        autoComplete="off"
        placeholder="输入店家名称搜索，也可以直接填写"
        style={inputStyle}
      />
      {open && (matches.length > 0 || value.trim()) && (
        <div style={suggestionListStyle}>
          {matches.map(item => (
            <button
              key={item.id}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                onSelect(item);
                setOpen(false);
              }}
              style={suggestionButtonStyle}
            >
              <strong>{item.name}</strong>
              <span style={{ color: MUTED, fontSize: 12 }}>{item.city || '城市待补'}</span>
            </button>
          ))}
          {matches.length === 0 && <span style={{ padding: '11px 12px', color: MUTED, fontSize: 13 }}>没有匹配店家，可直接使用当前填写内容</span>}
        </div>
      )}
    </div>
  );
}

function Notice({ value }: { value: { text: string; ok: boolean } }) {
  return <div style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${value.ok ? 'rgba(21,128,61,0.22)' : 'rgba(185,28,28,0.22)'}`, background: value.ok ? '#f0fdf4' : '#fef2f2', color: value.ok ? '#166534' : '#b91c1c', fontWeight: 800, lineHeight: 1.65 }}>{value.text}</div>;
}

const sectionStyle: React.CSSProperties = { padding: 18, borderRadius: 8, border: '1px solid rgba(31,41,55,0.10)', background: '#fff' };
const responsiveGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 };
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', minHeight: 44, border: '1px solid rgba(31,41,55,0.14)', borderRadius: 7, background: '#fff', color: INK, padding: '10px 12px', fontSize: 14 };
const suggestionListStyle: React.CSSProperties = { position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, display: 'grid', maxHeight: 280, overflowY: 'auto', marginTop: 4, border: '1px solid rgba(31,41,55,0.14)', borderRadius: 7, background: '#fff', boxShadow: '0 12px 30px rgba(31,41,55,0.14)' };
const suggestionButtonStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', minHeight: 44, border: 0, borderBottom: '1px solid rgba(31,41,55,0.08)', background: '#fff', color: INK, padding: '10px 12px', textAlign: 'left', cursor: 'pointer' };
const switchStyle: React.CSSProperties = { display: 'inline-grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, borderRadius: 8, background: '#f3f4f6', marginBottom: 14, maxWidth: '100%' };
const switchButton = (active: boolean): React.CSSProperties => ({ border: 0, borderRadius: 6, padding: '9px 12px', background: active ? '#fff' : 'transparent', color: active ? INK : MUTED, fontWeight: 850, cursor: 'pointer', boxShadow: active ? '0 1px 4px rgba(31,41,55,0.10)' : 'none' });
const starButton = (active: boolean): React.CSSProperties => ({ minWidth: 64, minHeight: 42, borderRadius: 7, border: `1px solid ${active ? '#a66a1f' : 'rgba(31,41,55,0.14)'}`, background: active ? '#fff4d6' : '#fff', color: active ? '#8a5a19' : MUTED, fontWeight: 900, cursor: 'pointer' });
const chantoButton = (active: boolean): React.CSSProperties => ({ minHeight: 38, borderRadius: 7, border: `1px solid ${active ? '#a66a1f' : 'rgba(31,41,55,0.14)'}`, background: active ? '#fff4d6' : '#fff', color: active ? '#8a5a19' : MUTED, padding: '8px 11px', fontWeight: 900, cursor: 'pointer' });
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 7, background: INK, color: '#fff', padding: '12px 20px', fontWeight: 900, cursor: 'pointer' };
const secondaryButton: React.CSSProperties = { border: '1px solid rgba(31,41,55,0.14)', borderRadius: 7, background: '#fff', color: INK, padding: '11px 16px', fontWeight: 850, textDecoration: 'none' };
