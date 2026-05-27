import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PROVINCE_CITIES } from '../constants/cities';

const API = '/api';
const C = '#0F1117';
const GOLD = '#d9a857';

const SUBJECT_LABEL: Record<string, string> = {
  creator: '委托师',
  dm: '卡司',
  store: '店家',
  player: '玩家',
};

const PROVINCES = Object.keys(PROVINCE_CITIES);
const ALL_CITY_OPTIONS = Object.entries(PROVINCE_CITIES).flatMap(([province, cities]) =>
  cities.map(city => ({ province, city }))
);

const DRAFT_KEY = 'lc_ranking_draft';

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d._v === 1) return d as DraftData;
    return null;
  } catch { return null; }
}

function saveDraft(data: DraftData) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* quota exceeded */ }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* */ }
}

interface DraftData {
  _v: number;
  type: 'red' | 'black';
  subjectType: string;
  subjectName: string;
  subjectCity: string;
  selectedProvince: string;
  subjectUrl: string;
  content: string;
  initialAmount: number;
}

const scrollPanelStyle: React.CSSProperties = {
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  WebkitOverflowScrolling: 'touch',
};

function getAuth() {
  try {
    const stored = localStorage.getItem('lc_creator');
    if (!stored) return null;
    const data = JSON.parse(stored);
    if (!data?.token) return null;
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) return null;
    return data;
  } catch { return null; }
}

export default function CreateRanking() {
  const navigate = useNavigate();
  const [auth] = useState(() => getAuth());

  const draft = useMemo(() => loadDraft(), []);
  const hasDraft = !!draft;

  const [type, setType] = useState<'red' | 'black'>(draft?.type || 'red');
  const [subjectType, setSubjectType] = useState<string>(draft?.subjectType || 'store');
  const [subjectName, setSubjectName] = useState(draft?.subjectName || '');
  const [subjectCity, setSubjectCity] = useState(draft?.subjectCity || '');
  const [selectedProvince, setSelectedProvince] = useState(draft?.selectedProvince || PROVINCES[0] || '');
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [subjectUrl, setSubjectUrl] = useState(draft?.subjectUrl || '');
  const [content, setContent] = useState(draft?.content || '');
  const [initialAmount, setInitialAmount] = useState(draft?.initialAmount || 10);
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [draftRestored, setDraftRestored] = useState(hasDraft);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  // Auto-save draft every 3 seconds
  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => {
      if (subjectName.trim() || content.trim()) {
        saveDraft({ _v: 1, type, subjectType, subjectName, subjectCity, selectedProvince, subjectUrl, content, initialAmount });
        setDraftSavedAt(Date.now());
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [done, type, subjectType, subjectName, subjectCity, selectedProvince, subjectUrl, content, initialAmount]);

  const dismissDraftNotice = () => {
    setDraftRestored(false);
    clearDraft();
  };

  useEffect(() => {
    if (!auth) { navigate('/login'); return; }
    fetch(`${API}/lc/wallet`, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setBalance(d.data.balance); });
  }, [auth, navigate]);

  const matchedCityOptions = useMemo(() => {
    const q = cityQuery.trim();
    if (q) {
      return ALL_CITY_OPTIONS.filter(({ province, city }) => province.includes(q) || city.includes(q));
    }
    return (PROVINCE_CITIES[selectedProvince] || []).map(city => ({ province: selectedProvince, city }));
  }, [cityQuery, selectedProvince]);

  const pickCity = (province: string, city: string) => {
    setSelectedProvince(province);
    setSubjectCity(city);
    setCityOpen(false);
    setCityQuery('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const newFiles: { name: string; url: string }[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        if (f.size > 10 * 1024 * 1024) { alert(`${f.name} 超过 10MB 限制`); continue; }
        // 存储为 base64 data URL（简化方案，适用于小文件）
        const url = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(f);
        });
        newFiles.push({ name: f.name, url });
      }
      setFiles(prev => [...prev, ...newFiles]);
    } finally { setUploading(false); }
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!auth) return navigate('/login');
    if (!subjectName.trim()) return setError('请填写对象名称');
    if (!content.trim()) return setError('请填写评价内容');
    if (!subjectType) return setError('请选择对象类型');
    if ((balance || 0) < initialAmount) return setError('契约币不足，请先充值');

    setSubmitting(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/rankings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          type, subjectName: subjectName.trim(), subjectType, subjectCity: subjectCity.trim() || null,
          subjectUrl: subjectUrl.trim() || null, content: content.trim(), initialAmount, files,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setDone(true);
        clearDraft();
        setBalance(prev => (prev || 0) - initialAmount);
      } else {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '提交失败');
        setError(msg);
      }
    } catch { setError('网络错误，请重试'); }
    finally { setSubmitting(false); }
  };

  if (!auth) return null;

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: '#fff' }}>
      <div style={{ backgroundColor: '#1A1D27', borderBottom: '1px solid rgba(201,146,46,0.12)', padding: '32px 20px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 4 }}>发布红黑榜</h1>
            <p style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.55)' }}>一人一票 · 真实口碑 · 契约币 {initialAmount} 起发</p>
          </div>
          <Link to="/wallet" style={{
            padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.25)',
            background: 'rgba(201,146,46,0.06)', color: GOLD, textDecoration: 'none',
            fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>💰</span> 契约币 {balance ?? '...'}
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '36px 20px 80px' }}>
        {/* 草稿恢复提示 */}
        {draftRestored && hasDraft && (
          <div style={{
            padding: '12px 16px', borderRadius: 10, marginBottom: 20,
            background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
            color: '#93c5fd', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>📝 已恢复上次未完成的草稿（文件需重新上传）</span>
            <button onClick={dismissDraftNotice} style={{ border: 'none', background: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>清除</button>
          </div>
        )}

        {/* 草稿已保存指示 */}
        {draftSavedAt && !done && (
          <div style={{
            padding: '6px 14px', borderRadius: 8, marginBottom: 8,
            background: 'rgba(201,146,46,0.04)', color: 'rgba(201,146,46,0.6)',
            fontSize: '0.73rem', textAlign: 'right',
          }}>
            💾 草稿已保存 {new Date(draftSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}
        {done ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.6rem', marginBottom: 12 }}>发布成功</h2>
            <p style={{ color: 'rgba(186,207,231,0.65)', lineHeight: 1.8, marginBottom: 32 }}>
              你的{type === 'red' ? '红榜' : '黑榜'}已提交审核。审核通过后将上线展示，{initialAmount} 契约币已扣除。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Link to="/rankings" style={{ padding: '12px 32px', borderRadius: 10, background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, fontWeight: 700, textDecoration: 'none' }}>
                回红黑榜
              </Link>
              <button onClick={() => { setDone(false); setSubjectName(''); setContent(''); setFiles([]); setError(''); }}
                style={{ padding: '12px 32px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.3)', background: 'none', color: GOLD, fontWeight: 600, cursor: 'pointer' }}>
                再发一条
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* 类型选择 */}
            <div>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10, color: 'rgba(186,207,231,0.75)' }}>红榜 / 黑榜</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['red', 'black'] as const).map(t => (
                  <button key={t} onClick={() => setType(t)}
                    style={{
                      flex: 1, padding: '12px 0', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem',
                      border: type === t ? `2px solid ${t === 'red' ? '#dc2626' : '#64748b'}` : '2px solid rgba(255,255,255,0.08)',
                      background: type === t ? `${t === 'red' ? 'rgba(220,38,38,0.15)' : 'rgba(100,116,139,0.12)'}` : 'rgba(255,255,255,0.03)',
                      color: type === t ? '#fff' : 'rgba(186,207,231,0.4)',
                    }}>{t === 'red' ? '🏅 红榜（夸）' : '👎 黑榜（踩）'}</button>
                ))}
              </div>
            </div>

            {/* 对象类型 */}
            <div>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10, color: 'rgba(186,207,231,0.75)' }}>对象类型</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(SUBJECT_LABEL).map(([k, v]) => (
                  <button key={k} onClick={() => setSubjectType(k)}
                    style={{
                      padding: '8px 18px', borderRadius: 999, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                      border: subjectType === k ? `1px solid ${GOLD}` : '1px solid rgba(201,146,46,0.15)',
                      background: subjectType === k ? 'rgba(201,146,46,0.12)' : 'transparent',
                      color: subjectType === k ? GOLD : 'rgba(186,207,231,0.45)',
                    }}>{v}</button>
                ))}
              </div>
            </div>

            {/* 金额 */}
            <div>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10, color: 'rgba(186,207,231,0.75)' }}>
                初始投入 · <span style={{ color: GOLD }}>{initialAmount} 契约币</span>
              </p>
              <input type="range" min={10} max={100} step={10} value={initialAmount}
                onChange={e => setInitialAmount(Number(e.target.value))}
                style={{ width: '100%', accentColor: GOLD }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', color: 'rgba(186,207,231,0.4)', marginTop: 4 }}>
                <span>10 契约币（最低）</span>
                <span>100 契约币（最高）</span>
              </div>
            </div>

            {/* 对象名称 */}
            <Input label="对象名称 *" value={subjectName} onChange={setSubjectName} placeholder="店名 / 人名 / DM名 / 灵契师名" />

            {/* 城市 */}
            <div style={{ position: 'relative' }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10, color: 'rgba(186,207,231,0.75)' }}>所在城市</p>
              <button type="button" onClick={() => setCityOpen(v => !v)}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(201,146,46,0.2)',
                  background: 'rgba(255,255,255,0.05)', color: subjectCity ? '#fff' : 'rgba(186,207,231,0.45)',
                  fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                <span>{subjectCity ? `${selectedProvince} · ${subjectCity}` : '选择省份 / 城市'}</span>
                <span style={{ color: GOLD }}>▾</span>
              </button>

              {cityOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setCityOpen(false)} />
                  <div style={{
                    position: 'absolute', left: 0, right: 0, top: 'calc(100% + 8px)', zIndex: 50,
                    padding: 12, borderRadius: 12, background: '#0d1f38',
                    border: '1px solid rgba(217,168,87,0.24)', boxShadow: '0 18px 48px rgba(0,0,0,0.48)',
                  }}
                    onWheel={e => e.stopPropagation()}
                    onTouchMove={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={cityQuery}
                      onChange={e => setCityQuery(e.target.value)}
                      placeholder="搜索城市，例如：河北、保定、上海"
                      style={{
                        width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
                        border: '1px solid rgba(217,168,87,0.24)', background: 'rgba(255,255,255,0.06)',
                        color: '#fff', outline: 'none', marginBottom: 10,
                      }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 10, minHeight: 0 }}>
                      <div style={{ ...scrollPanelStyle, maxHeight: 260, borderRight: '1px solid rgba(217,168,87,0.12)', paddingRight: 8 }}>
                        {PROVINCES.map(province => (
                          <button key={province} type="button" onClick={() => { setSelectedProvince(province); setCityQuery(''); }}
                            style={{
                              width: '100%', padding: '8px 9px', borderRadius: 8, border: 'none', cursor: 'pointer',
                              background: selectedProvince === province && !cityQuery ? 'rgba(217,168,87,0.16)' : 'transparent',
                              color: selectedProvince === province && !cityQuery ? GOLD : 'rgba(226,238,252,0.72)',
                              fontSize: '0.8rem', fontWeight: selectedProvince === province && !cityQuery ? 800 : 500,
                              textAlign: 'left',
                            }}>
                            {province}
                          </button>
                        ))}
                      </div>
                      <div style={{ ...scrollPanelStyle, maxHeight: 260, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4 }}>
                        {matchedCityOptions.length > 0 ? matchedCityOptions.map(({ province, city }) => (
                          <button key={`${province}-${city}`} type="button" onClick={() => pickCity(province, city)}
                            style={{
                              padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                              background: subjectCity === city && selectedProvince === province ? 'rgba(217,168,87,0.16)' : 'transparent',
                              color: subjectCity === city && selectedProvince === province ? GOLD : 'rgba(226,238,252,0.78)',
                              fontSize: '0.84rem', fontWeight: subjectCity === city && selectedProvince === province ? 800 : 500,
                              textAlign: 'left',
                            }}>
                            {cityQuery ? `${province} · ${city}` : city}
                          </button>
                        )) : (
                          <p style={{ gridColumn: '1 / -1', color: 'rgba(226,238,252,0.62)', fontSize: '0.84rem', padding: '16px 4px' }}>
                            没搜到这个城市，也可以先不填。
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 社交主页 */}
            <Input label="社交主页链接" value={subjectUrl} onChange={setSubjectUrl} placeholder="小红书/微博/抖音链接" />

            {/* 内容 */}
            <div>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10, color: 'rgba(186,207,231,0.75)' }}>
                评价内容 * <span style={{ fontSize: '0.72rem', color: 'rgba(186,207,231,0.4)' }}>（支持 @用户名 艾特已注册账户）</span>
              </p>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="写下你的真实体验..." rows={8}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: '1px solid rgba(201,146,46,0.2)',
                  background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.9rem',
                  resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.8,
                }} />
            </div>

            {/* 文件上传 */}
            <div>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10, color: 'rgba(186,207,231,0.75)' }}>
                上传证据文件 <span style={{ fontSize: '0.72rem', color: 'rgba(186,207,231,0.4)' }}>（PDF/图片，单文件 ≤10MB）</span>
              </p>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                border: '1px dashed rgba(201,146,46,0.3)', background: 'rgba(201,146,46,0.04)',
                color: GOLD, fontSize: '0.85rem', fontWeight: 600,
              }}>
                📎 选择文件
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
              {uploading && <span style={{ marginLeft: 12, fontSize: '0.82rem', color: GOLD }}>上传中...</span>}
              {files.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {files.map((f, i) => (
                    <span key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 500,
                      border: '1px solid rgba(201,146,46,0.2)', background: 'rgba(255,255,255,0.04)',
                      color: 'rgba(186,207,231,0.75)',
                    }}>
                      📎 {f.name}
                      <button onClick={() => removeFile(i)} style={{ border: 'none', background: 'none', color: 'rgba(248,113,113,0.7)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#fca5a5', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <button onClick={submit} disabled={submitting}
              style={{
                width: '100%', padding: '16px', borderRadius: 14, fontWeight: 800, fontSize: '1rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                background: submitting ? 'rgba(201,146,46,0.15)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                color: submitting ? 'rgba(201,146,46,0.4)' : C,
                border: 'none', opacity: submitting ? 0.7 : 1,
              }}>
              {submitting ? '提交中...' : `发布 · 扣 ${initialAmount} 契约币`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <p style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10, color: 'rgba(186,207,231,0.75)' }}>{label}</p>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(201,146,46,0.2)',
          background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.9rem',
          outline: 'none', boxSizing: 'border-box',
        }} />
    </div>
  );
}
