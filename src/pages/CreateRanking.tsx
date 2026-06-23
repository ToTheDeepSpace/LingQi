import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PROVINCE_CITIES } from '../constants/cities';
import { RESPONSIBILITY_TEXT } from '../components/ResponsibilityNotice';
import { readStoredCreatorAuth } from '../lib/authSession';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import './CreateRanking.css';

const API = '/api';

const SUBJECT_LABEL: Record<string, string> = {
  creator: '委托人',
  dm: '卡司',
  store: '店家',
  takeaway: '外卖',
  player: '玩家',
};

type RankingType = 'red' | 'black' | 'white';
type EvidenceFile = { name: string; url: string; type?: string; size?: number };

const PROVINCES = Object.keys(PROVINCE_CITIES);
const ALL_CITY_OPTIONS = Object.entries(PROVINCE_CITIES).flatMap(([province, cities]) =>
  cities.map(city => ({ province, city })),
);

type RankingDraft = {
  type: RankingType;
  subjectType: string;
  subjectName: string;
  subjectCity: string;
  selectedProvince: string;
  subjectUrl: string;
  content: string;
  initialAmount: number;
};

const TYPE_META: Record<RankingType, { label: string; icon: string; className: string }> = {
  red: { label: '红榜', icon: '🏆', className: 'is-red' },
  white: { label: '白榜', icon: '✧', className: 'is-white' },
  black: { label: '黑榜', icon: '☟', className: 'is-black' },
};

function getAuth() {
  return readStoredCreatorAuth();
}

export default function CreateRanking() {
  const navigate = useNavigate();
  const [auth] = useState(() => getAuth());

  const [type, setType] = useState<RankingType>('red');
  const [subjectType, setSubjectType] = useState<string>('store');
  const [subjectName, setSubjectName] = useState('');
  const [subjectCity, setSubjectCity] = useState('');
  const [selectedProvince, setSelectedProvince] = useState(PROVINCES[0] || '');
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [subjectUrl, setSubjectUrl] = useState('');
  const [content, setContent] = useState('');
  const [initialAmount, setInitialAmount] = useState(10);
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);

  const effectiveAmount = type === 'red' ? initialAmount : 0;
  const publishCostText = type === 'red'
    ? '契约币 10 起发'
    : type === 'black'
      ? '黑榜免费提交'
      : '白榜免费发布';

  const draftValue = useMemo<RankingDraft>(() => ({
    type,
    subjectType,
    subjectName,
    subjectCity,
    selectedProvince,
    subjectUrl,
    content,
    initialAmount,
  }), [content, initialAmount, selectedProvince, subjectCity, subjectName, subjectType, subjectUrl, type]);

  const rankingDraft = useDraftAutosave<RankingDraft>({
    key: 'lc:draft:ranking:new',
    version: 2,
    enabled: !done,
    value: draftValue,
    shouldSave: data => !!(data.subjectName.trim() || data.subjectCity.trim() || data.subjectUrl.trim() || data.content.trim()),
    onRestore: data => {
      setType(data.type || 'red');
      setSubjectType(data.subjectType || 'store');
      setSubjectName(data.subjectName || '');
      setSubjectCity(data.subjectCity || '');
      setSelectedProvince(data.selectedProvince || PROVINCES[0] || '');
      setSubjectUrl(data.subjectUrl || '');
      setContent(data.content || '');
      setInitialAmount(data.type === 'red' ? Math.max(10, data.initialAmount || 10) : 10);
    },
  });

  useEffect(() => {
    if (!auth) {
      navigate('/login');
      return;
    }
    fetch(`${API}/lc/wallet`, { headers: { Authorization: `Bearer ${auth.token || ''}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setBalance(d.data.balance); });
  }, [auth, navigate]);

  const matchedCityOptions = useMemo(() => {
    const q = cityQuery.trim();
    if (q) return ALL_CITY_OPTIONS.filter(({ province, city }) => province.includes(q) || city.includes(q));
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
    if (!auth) return navigate('/login');
    setUploading(true);
    setError('');
    try {
      const newFiles: EvidenceFile[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        if (f.size > 10 * 1024 * 1024) {
          alert(`${f.name} 超过 10MB 限制`);
          continue;
        }
        const formData = new FormData();
        formData.append('file', f);
        formData.append('scope', 'ranking-evidence');
        const r = await fetch(`${API}/lc/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${auth.token || ''}` },
          body: formData,
        });
        const d = await r.json();
        if (!r.ok || !d.success) {
          const msg = typeof d.error === 'string' ? d.error : (d.error?.message || `${f.name} 上传失败`);
          throw new Error(msg);
        }
        newFiles.push({
          name: d.data?.name || f.name,
          url: d.data?.url,
          type: d.data?.type || f.type,
          size: d.data?.size || f.size,
        });
      }
      setFiles(prev => [...prev, ...newFiles]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '文件上传失败，请重试');
    } finally {
      setUploading(false);
      e.currentTarget.value = '';
    }
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!auth) return navigate('/login');
    if (!subjectName.trim()) return setError('请填写对象名称');
    if (!subjectCity.trim()) return setError('请选择所在城市');
    if (!content.trim()) return setError('请填写评价内容');
    if (!subjectType) return setError('请选择对象类型');
    if (!rulesAccepted) return setError('请先阅读并确认发布规则');
    if (effectiveAmount > 0 && (balance || 0) < effectiveAmount) return setError('契约币不足，请先充值');

    setSubmitting(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/rankings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token || ''}` },
        body: JSON.stringify({
          type,
          subjectName: subjectName.trim(),
          subjectType,
          subjectCity: subjectCity.trim(),
          subjectUrl: subjectUrl.trim() || null,
          content: content.trim(),
          initialAmount: effectiveAmount,
          files,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setDone(true);
        rankingDraft.clearDraft();
        setBalance(prev => Math.max(0, (prev || 0) - effectiveAmount));
      } else {
        const msg = typeof d.error === 'string' ? d.error : (d.error?.message || '提交失败');
        setError(msg);
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth) return null;

  return (
    <main className="ranking-new-page">
      <header className="ranking-new-header">
        <div className="ranking-new-header-inner">
          <Link to="/rankings" className="ranking-new-back">← 返回红黑榜</Link>
          <div className="ranking-new-title-row">
            <h1 className="ranking-new-title">发布红黑榜</h1>
            <Link to="/wallet" className="ranking-new-coin"><span>◉</span> 契约币 {balance ?? '...'}</Link>
          </div>
          <p className="ranking-new-subtitle">免费态度一人一票 · 真实口碑 · {publishCostText}</p>
        </div>
      </header>

      <section className="ranking-new-body">
        {done ? (
          <SuccessState
            type={type}
            effectiveAmount={effectiveAmount}
            onReset={() => {
              setDone(false);
              setSubjectName('');
              setSubjectCity('');
              setSubjectUrl('');
              setContent('');
              setFiles([]);
              setError('');
              setRulesAccepted(false);
            }}
          />
        ) : (
          <div className="ranking-new-column">
            <RankingTypeSelector type={type} onTypeChange={(next) => {
              setType(next);
              setInitialAmount(prev => next === 'red' ? Math.max(10, prev || 10) : 10);
            }} />

            <div className="ranking-new-main-grid">
              <div className="ranking-new-left">
                <SubjectTypeSelector subjectType={subjectType} setSubjectType={setSubjectType} />

                <div className="ranking-grid-two">
                  <Input label="对象名称 *" value={subjectName} onChange={setSubjectName} placeholder="店名 / 外卖店 / 人名 / DM名 / 灵契师名" />
                  <CityPicker
                    selectedProvince={selectedProvince}
                    subjectCity={subjectCity}
                    cityOpen={cityOpen}
                    cityQuery={cityQuery}
                    matchedCityOptions={matchedCityOptions}
                    setCityOpen={setCityOpen}
                    setCityQuery={setCityQuery}
                    setSelectedProvince={setSelectedProvince}
                    pickCity={pickCity}
                  />
                </div>

                <div className="ranking-new-section">
                  <div className="ranking-new-label-row">
                    <label className="ranking-new-label">评价内容 *（支持 @用户名 艾特已注册账户）</label>
                  </div>
                  <div className="ranking-textarea-wrap">
                    <textarea
                      className="ranking-textarea"
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder="写下你的真实体验..."
                      rows={6}
                    />
                    <span className="ranking-autosave">✓ {rankingDraft.savedAt || rankingDraft.restoredAt ? '已自动保存' : '自动保存'}</span>
                  </div>
                </div>

                <div className="ranking-grid-two">
                  <Input label="社交主页链接" value={subjectUrl} onChange={setSubjectUrl} placeholder="小红书/微博/抖音链接" />
                  <UploadField
                    files={files}
                    uploading={uploading}
                    handleFileUpload={handleFileUpload}
                    removeFile={removeFile}
                  />
                </div>
              </div>

              <aside className="ranking-new-right">
                <RankingRulesNotice type={type} accepted={rulesAccepted} onAcceptedChange={setRulesAccepted} />
                <AmountSection type={type} effectiveAmount={effectiveAmount} setInitialAmount={setInitialAmount} />
                {(error || rankingDraft.error) && <div className="ranking-error">{error || rankingDraft.error}</div>}
                <button className="ranking-submit" onClick={submit} disabled={submitting || !rulesAccepted}>
                  {submitting ? '提交中...' : !rulesAccepted ? '请先确认发布规则' : (effectiveAmount > 0 ? `发布 · 扣 ${effectiveAmount} 契约币` : `免费发布${type === 'black' ? '黑榜' : '白榜'}`)}
                </button>
              </aside>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function RankingTypeSelector({ type, onTypeChange }: { type: RankingType; onTypeChange: (type: RankingType) => void }) {
  return (
    <section className="ranking-new-section">
      <label className="ranking-new-label">榜单类型</label>
      <div className="ranking-type-row">
        {(['red', 'white', 'black'] as const).map(t => (
          <button
            type="button"
            key={t}
            onClick={() => onTypeChange(t)}
            className={`ranking-type-btn ${type === t ? TYPE_META[t].className : ''}`}
          >
            <span>{TYPE_META[t].icon}</span>
            <span>{TYPE_META[t].label}</span>
          </button>
        ))}
      </div>
      <p className="ranking-type-note">红榜写夸奖，黑榜写负面体验，白榜收录非夸非踩的奇闻、笑料与七嘴八舌的趣事。</p>
    </section>
  );
}

function SubjectTypeSelector({ subjectType, setSubjectType }: { subjectType: string; setSubjectType: (value: string) => void }) {
  return (
    <section className="ranking-new-section">
      <label className="ranking-new-label">对象类型</label>
      <div className="ranking-subject-row">
        {Object.entries(SUBJECT_LABEL).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubjectType(key)}
            className={`ranking-subject-btn ${subjectType === key ? 'is-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function CityPicker({
  selectedProvince,
  subjectCity,
  cityOpen,
  cityQuery,
  matchedCityOptions,
  setCityOpen,
  setCityQuery,
  setSelectedProvince,
  pickCity,
}: {
  selectedProvince: string;
  subjectCity: string;
  cityOpen: boolean;
  cityQuery: string;
  matchedCityOptions: { province: string; city: string }[];
  setCityOpen: (value: boolean | ((old: boolean) => boolean)) => void;
  setCityQuery: (value: string) => void;
  setSelectedProvince: (value: string) => void;
  pickCity: (province: string, city: string) => void;
}) {
  return (
    <div className="ranking-new-section ranking-city-field">
      <label className="ranking-new-label">所在城市 *</label>
      <button type="button" className="ranking-city-button" onClick={() => setCityOpen(v => !v)}>
        <span className={subjectCity ? '' : 'ranking-city-placeholder'}>{subjectCity ? `${selectedProvince} · ${subjectCity}` : '选择省份 / 城市'}</span>
        <span>⌄</span>
      </button>
      {cityOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setCityOpen(false)} />
          <div className="ranking-city-dropdown" onWheel={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
            <input
              autoFocus
              className="ranking-city-search"
              value={cityQuery}
              onChange={e => setCityQuery(e.target.value)}
              placeholder="搜索城市，例如：河北、保定、上海"
            />
            <div className="ranking-city-picker">
              <div className="ranking-province-list">
                {PROVINCES.map(province => (
                  <button
                    key={province}
                    type="button"
                    onClick={() => { setSelectedProvince(province); setCityQuery(''); }}
                    className={`ranking-province-option ${selectedProvince === province && !cityQuery ? 'is-active' : ''}`}
                  >
                    {province}
                  </button>
                ))}
              </div>
              <div className="ranking-city-list">
                {matchedCityOptions.length > 0 ? matchedCityOptions.map(({ province, city }) => (
                  <button
                    key={`${province}-${city}`}
                    type="button"
                    onClick={() => pickCity(province, city)}
                    className={`ranking-city-option ${subjectCity === city && selectedProvince === province ? 'is-active' : ''}`}
                  >
                    {cityQuery ? `${province} · ${city}` : city}
                  </button>
                )) : (
                  <p style={{ gridColumn: '1 / -1', color: 'rgba(71,85,105,0.62)', fontSize: '0.84rem', padding: '16px 4px' }}>
                    没搜到这个城市，可以换关键词或手动选择省份。
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UploadField({
  files,
  uploading,
  handleFileUpload,
  removeFile,
}: {
  files: EvidenceFile[];
  uploading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: (idx: number) => void;
}) {
  return (
    <section className="ranking-new-section">
      <label className="ranking-new-label">上传证据文件（选填，图片/PDF ≤10MB，第三方请打码）</label>
      <label className="ranking-upload-btn">
        <span>⌘</span>
        <span>选择文件</span>
        <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileUpload} style={{ display: 'none' }} />
      </label>
      {uploading && <span className="ranking-uploading">上传中...</span>}
      {files.length > 0 && (
        <div className="ranking-file-list">
          {files.map((file, index) => (
            <span key={`${file.url}-${index}`} className="ranking-file-chip">
              <span>{file.type?.includes('pdf') ? 'PDF' : 'IMG'}</span>
              <span>{file.name}</span>
              <button type="button" onClick={() => removeFile(index)}>×</button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function AmountSection({ type, effectiveAmount, setInitialAmount }: { type: RankingType; effectiveAmount: number; setInitialAmount: (value: number) => void }) {
  if (type !== 'red') {
    return (
      <div className="ranking-free-note">
        {type === 'black'
          ? '黑榜免费提交，进入人工审核；它是公共风险记录，不开放砸币攻击。'
          : '白榜免费发布，适合奇闻、笑料、怪事和中性观察。'}
      </div>
    );
  }

  return (
    <section className="ranking-amount">
      <label className="ranking-amount-label">初始投入 · {effectiveAmount} 契约币</label>
      <input
        className="ranking-range"
        type="range"
        min={10}
        max={100}
        step={10}
        value={effectiveAmount}
        onChange={e => setInitialAmount(Number(e.target.value))}
      />
      <div className="ranking-range-labels">
        <span>10 契约币（最低）</span>
        <span>100 契约币（最高）</span>
      </div>
    </section>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <section className="ranking-new-section">
      <label className="ranking-new-label">{label}</label>
      <input className="ranking-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </section>
  );
}

function RankingRulesNotice({ type, accepted, onAcceptedChange }: { type: RankingType; accepted: boolean; onAcceptedChange: (value: boolean) => void }) {
  const typeTip = type === 'red'
    ? '红榜适合写清楚推荐理由、对方做对了什么、哪段体验值得被看见。'
    : type === 'black'
      ? '黑榜必须写事实经过，不做人身攻击；证据越完整越容易通过审核。'
      : '白榜不是低成本阴阳怪气；如果内容实际构成负面指控，审核时可能被转黑榜或驳回。';

  return (
    <section className="ranking-rules-card is-side">
      <div className="ranking-rules-head">
        <div>
          <p className="ranking-rules-kicker">发布前必读</p>
          <h2 className="ranking-rules-title">这条内容会进入人工审核</h2>
        </div>
        <Link to="/rules" target="_blank" className="ranking-rules-link">查看完整规则</Link>
      </div>

      <div className="ranking-rule-list">
        <RuleLine><strong>写什么</strong> — {typeTip}</RuleLine>
        <RuleLine><strong>上传证据</strong> — 红榜、黑榜建议上传证据；白榜可选，涉及具体人或店时建议附材料。</RuleLine>
        <RuleLine><strong>保护隐私</strong> — 聊天记录、订单、群聊、照片等第三方信息请先打码，否则可能被驳回。</RuleLine>
        <RuleLine><strong>一人一票</strong> — 同一账号对同一帖只保留一个免费态度；打榜、踩榜按契约币金额累计，禁止多号刷票或重复提交同一事件。</RuleLine>
        <RuleLine><strong>审核边界</strong> — 审核通过仅代表符合展示规则，不代表平台已核实全部陈述。</RuleLine>
        <RuleLine><strong>相关方回应</strong> — 回应不是删帖入口；先发普通评论，通过后再提交关系材料申请置顶。</RuleLine>
        <RuleLine><strong>黑榜期限</strong> — 黑榜默认公开展示 30 天后进入已过期记录，后续可去标识化沉淀为共性问题和礼仪建议。</RuleLine>
      </div>

      <div className="ranking-responsibility">
        <p className="ranking-responsibility-title">发布即负责。</p>
        <p className="ranking-responsibility-text">{RESPONSIBILITY_TEXT}</p>
      </div>

      <label className="ranking-accept-label">
        <input type="checkbox" checked={accepted} onChange={e => onAcceptedChange(e.target.checked)} />
        <span>我已阅读并确认：我会尽量写事实、上传证据、打码隐私，并接受人工审核结果。</span>
      </label>
    </section>
  );
}

function RuleLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="ranking-rule-line">
      <span className="ranking-rule-dot">•</span>
      <span>{children}</span>
    </div>
  );
}

function SuccessState({ type, effectiveAmount, onReset }: { type: RankingType; effectiveAmount: number; onReset: () => void }) {
  return (
    <div className="ranking-success-card">
      <div className="ranking-success-icon">✓</div>
      <h2 className="ranking-success-title">发布成功</h2>
      <p className="ranking-success-copy">
        你的{type === 'red' ? '红榜' : type === 'black' ? '黑榜' : '白榜'}已提交审核。审核通过后将上线展示，{effectiveAmount > 0 ? `${effectiveAmount} 契约币已扣除。` : `${type === 'black' ? '黑榜' : '白榜'}本次免费发布。`}
      </p>
      <div className="ranking-success-actions">
        <Link to="/rankings" className="ranking-success-link">回红黑榜</Link>
        <button type="button" className="ranking-success-button" onClick={onReset}>再发一条</button>
      </div>
    </div>
  );
}
