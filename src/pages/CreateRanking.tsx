import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
type DossierOption = { id: string; dm_name: string; city?: string | null; workplace?: string | null; employment_status?: 'unknown' | 'store_affiliated' | 'freelance'; employer_store_id?: string | null };
type ScriptOption = { id: string; name: string };

const PROVINCES = Object.keys(PROVINCE_CITIES);
const ALL_CITY_OPTIONS = Object.entries(PROVINCE_CITIES).flatMap(([province, cities]) =>
  cities.map(city => ({ province, city })),
);

function provinceForCity(city: string) {
  return ALL_CITY_OPTIONS.find(option => option.city === city)?.province || '';
}

type RankingDraft = {
  type: RankingType;
  subjectType: string;
  subjectName: string;
  subjectCity: string;
  selectedProvince: string;
  subjectUrl: string;
  content: string;
  initialAmount: number;
  subjectDossierId: string;
  subjectMode: 'existing' | 'new';
  newSubjectWorkplace: string;
  employmentStatus: 'store_affiliated' | 'freelance';
  employerStoreId: string;
  subjectEmploymentUpdate: 'keep' | 'store_affiliated' | 'freelance';
  subjectEmployerStoreId: string;
  eventDate: string;
  eventScriptId: string;
  eventScriptName: string;
  eventStoreDossierId: string;
  eventStoreName: string;
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
  const [searchParams] = useSearchParams();
  const [auth] = useState(() => getAuth());
  const resubmitId = searchParams.get('resubmit') || '';

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
  const [dmOptions, setDmOptions] = useState<DossierOption[]>([]);
  const [storeOptions, setStoreOptions] = useState<DossierOption[]>([]);
  const [scriptOptions, setScriptOptions] = useState<ScriptOption[]>([]);
  const [subjectDossierId, setSubjectDossierId] = useState('');
  const [subjectMode, setSubjectMode] = useState<'existing' | 'new'>('existing');
  const [newSubjectWorkplace, setNewSubjectWorkplace] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<'store_affiliated' | 'freelance'>('store_affiliated');
  const [employerStoreId, setEmployerStoreId] = useState('');
  const [subjectEmploymentUpdate, setSubjectEmploymentUpdate] = useState<'keep' | 'store_affiliated' | 'freelance'>('keep');
  const [subjectEmployerStoreId, setSubjectEmployerStoreId] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventScriptId, setEventScriptId] = useState('');
  const [eventScriptName, setEventScriptName] = useState('');
  const [eventStoreDossierId, setEventStoreDossierId] = useState('');
  const [eventStoreName, setEventStoreName] = useState('');
  const [evidenceRequired, setEvidenceRequired] = useState(false);
  const [resubmitLoaded, setResubmitLoaded] = useState(!resubmitId);

  const effectiveAmount = type === 'red' ? initialAmount : 0;
  const selectedDm = subjectType === 'dm' ? dmOptions.find(item => item.id === subjectDossierId) : undefined;
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
    subjectDossierId,
    subjectMode,
    newSubjectWorkplace,
    employmentStatus,
    employerStoreId,
    subjectEmploymentUpdate,
    subjectEmployerStoreId,
    eventDate,
    eventScriptId,
    eventScriptName,
    eventStoreDossierId,
    eventStoreName,
  }), [content, employmentStatus, employerStoreId, eventDate, eventScriptId, eventScriptName, eventStoreDossierId, eventStoreName, initialAmount, newSubjectWorkplace, selectedProvince, subjectCity, subjectDossierId, subjectEmploymentUpdate, subjectEmployerStoreId, subjectMode, subjectName, subjectType, subjectUrl, type]);

  const rankingDraft = useDraftAutosave<RankingDraft>({
    key: 'lc:draft:ranking:new',
    version: 3,
    enabled: !done && !resubmitId,
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
      setSubjectDossierId(data.subjectDossierId || '');
      setSubjectMode(data.subjectMode === 'new' ? 'new' : 'existing');
      setNewSubjectWorkplace(data.newSubjectWorkplace || '');
      setEmploymentStatus(data.employmentStatus === 'freelance' ? 'freelance' : 'store_affiliated');
      setEmployerStoreId(data.employerStoreId || '');
      setSubjectEmploymentUpdate(data.subjectEmploymentUpdate === 'store_affiliated' || data.subjectEmploymentUpdate === 'freelance' ? data.subjectEmploymentUpdate : 'keep');
      setSubjectEmployerStoreId(data.subjectEmployerStoreId || '');
      setEventDate(data.eventDate || '');
      setEventScriptId(data.eventScriptId || '');
      setEventScriptName(data.eventScriptName || '');
      setEventStoreDossierId(data.eventStoreDossierId || '');
      setEventStoreName(data.eventStoreName || '');
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

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`${API}/lc/dm-dossiers?entityType=dm`, { signal: controller.signal }).then(r => r.json()),
      fetch(`${API}/lc/dm-dossiers?entityType=store`, { signal: controller.signal }).then(r => r.json()),
      fetch(`${API}/lc/scripts`, { signal: controller.signal }).then(r => r.json()),
    ]).then(([dmData, storeData, scriptData]) => {
      if (dmData.success) setDmOptions(dmData.data || []);
      if (storeData.success) setStoreOptions(storeData.data || []);
      if (scriptData.success) setScriptOptions((scriptData.data || []).map((item: ScriptOption) => ({ id: item.id, name: item.name })));
    }).catch(reason => {
      if (reason?.name !== 'AbortError') setError('DM、店家或剧本库加载失败，请刷新后重试');
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (resubmitId) return;
    const requestedType = searchParams.get('subjectType');
    const requestedDossierId = searchParams.get('subjectDossierId') || '';
    if (!['dm', 'store'].includes(requestedType || '') || !requestedDossierId) return;
    const options = requestedType === 'dm' ? dmOptions : storeOptions;
    const item = options.find(option => option.id === requestedDossierId);
    if (!item) return;
    const timer = window.setTimeout(() => {
      setSubjectType(requestedType || 'dm');
      setSubjectMode('existing');
      setSubjectDossierId(item.id);
      setSubjectName(item.dm_name);
      setSubjectCity(item.city || '');
      if (item.city) setSelectedProvince(provinceForCity(item.city) || PROVINCES[0] || '');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [dmOptions, resubmitId, searchParams, storeOptions]);

  useEffect(() => {
    if (!resubmitId || !auth) return;
    const controller = new AbortController();
    fetch(`${API}/lc/rankings/mine`, {
      headers: { Authorization: `Bearer ${auth.token || ''}` },
      signal: controller.signal,
    }).then(r => r.json()).then(data => {
      const item = data.success && Array.isArray(data.data)
        ? data.data.find((row: { id?: string }) => row.id === resubmitId)
        : null;
      if (!item || item.status !== 'rejected') throw new Error('没有找到可重新提交的红黑榜记录');
      setType(item.type || 'red');
      setSubjectType(item.subject_type || 'store');
      setSubjectName(item.subject_name || '');
      setSubjectCity(item.subject_city || '');
      if (item.subject_city) setSelectedProvince(provinceForCity(item.subject_city) || PROVINCES[0] || '');
      setSubjectUrl(item.subject_url || '');
      setSubjectDossierId(item.subject_dossier_id || '');
      setSubjectMode(item.subject_dossier_id ? 'existing' : 'new');
      setContent(item.content || '');
      setFiles(Array.isArray(item.files) ? item.files : []);
      setInitialAmount(item.type === 'red' ? Math.max(10, Number(item.initial_amount || 10)) : 10);
      setEventDate(item.event_date || '');
      setEventScriptId(item.event_script_id || '');
      setEventScriptName(item.event_script_name || '');
      setEventStoreDossierId(item.event_store_dossier_id || '');
      setEventStoreName(item.event_store_name || '');
      setSubjectEmploymentUpdate(item.dm_employment_status_suggestion === 'store_affiliated' || item.dm_employment_status_suggestion === 'freelance' ? item.dm_employment_status_suggestion : 'keep');
      setSubjectEmployerStoreId(item.dm_employer_store_id_suggestion || '');
      setEvidenceRequired(!!item.evidence_required);
      setError(item.reject_reason ? `审核意见：${item.reject_reason}` : '请按审核意见修改后重新提交');
      setResubmitLoaded(true);
    }).catch(reason => {
      if (reason?.name !== 'AbortError') {
        setError(reason instanceof Error ? reason.message : '重新提交记录加载失败');
        setResubmitLoaded(true);
      }
    });
    return () => controller.abort();
  }, [auth, resubmitId]);

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
        if (!f.type.startsWith('image/')) {
          alert(`${f.name} 不是支持的图片文件`);
          continue;
        }
        if (f.size > 8 * 1024 * 1024) {
          alert(`${f.name} 超过 8MB 限制`);
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
    if (['dm', 'store'].includes(subjectType) && subjectMode === 'existing' && !subjectDossierId) return setError(`请选择已有${subjectType === 'dm' ? 'DM' : '店家'}档案`);
    if (subjectType === 'dm' && subjectMode === 'new' && employmentStatus === 'store_affiliated' && !employerStoreId) return setError('请选择DM的受雇店家，或者选择“无受雇店家（自由DM）”');
    if (subjectType === 'dm' && subjectMode === 'existing' && subjectEmploymentUpdate === 'store_affiliated' && !subjectEmployerStoreId) return setError('请选择要绑定的受雇店家');
    if (subjectType === 'store' && subjectMode === 'new' && !newSubjectWorkplace.trim()) return setError('请填写店家地址、商圈或常驻位置');
    if (evidenceRequired && files.length === 0) return setError('管理员要求补充证据，请至少上传一张证据图片');
    if (!rulesAccepted) return setError('请先阅读并确认发布规则');
    if (!resubmitId && effectiveAmount > 0 && (balance || 0) < effectiveAmount) return setError('契约币不足，请先充值');

    setSubmitting(true);
    setError('');
    try {
      const selectedSubject = (subjectType === 'dm' ? dmOptions : storeOptions).find(item => item.id === subjectDossierId);
      const selectedEventScript = scriptOptions.find(item => item.id === eventScriptId);
      const selectedEventStore = storeOptions.find(item => item.id === eventStoreDossierId);
      const body = {
        type,
        subjectName: (selectedSubject?.dm_name || subjectName).trim(),
        subjectType,
        subjectCity: (selectedSubject?.city || subjectCity).trim(),
        subjectUrl: subjectUrl.trim() || null,
        subjectDossierId: subjectMode === 'existing' ? subjectDossierId || null : null,
        subjectEmploymentStatus: subjectType === 'dm' && subjectMode === 'existing' && subjectEmploymentUpdate !== 'keep' ? subjectEmploymentUpdate : null,
        subjectEmployerStoreId: subjectType === 'dm' && subjectMode === 'existing' && subjectEmploymentUpdate === 'store_affiliated' ? subjectEmployerStoreId : null,
        newSubject: ['dm', 'store'].includes(subjectType) && subjectMode === 'new' ? {
          name: subjectName.trim(),
          workplace: newSubjectWorkplace.trim(),
          employmentStatus: subjectType === 'dm' ? employmentStatus : 'unknown',
          employerStoreId: subjectType === 'dm' && employmentStatus === 'store_affiliated' ? employerStoreId : null,
        } : null,
        eventDate: eventDate || null,
        eventScriptId: eventScriptId || null,
        eventScriptName: (selectedEventScript?.name || eventScriptName).trim() || null,
        eventStoreDossierId: eventStoreDossierId || null,
        eventStoreName: (selectedEventStore?.dm_name || eventStoreName).trim() || null,
        content: content.trim(),
        initialAmount: effectiveAmount,
        files,
      };
      const r = await fetch(resubmitId ? `${API}/lc/rankings/${encodeURIComponent(resubmitId)}/resubmit` : `${API}/lc/rankings`, {
        method: resubmitId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token || ''}` },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) {
        setDone(true);
        rankingDraft.clearDraft();
        if (!resubmitId) setBalance(prev => Math.max(0, (prev || 0) - effectiveAmount));
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
  if (!resubmitLoaded) return <main className="ranking-new-page"><div style={{ maxWidth: 760, margin: '0 auto', padding: '80px 20px', color: 'rgba(71,85,105,0.72)' }}>正在加载被打回的记录...</div></main>;

  return (
    <main className="ranking-new-page">
      <header className="ranking-new-header">
        <div className="ranking-new-header-inner">
          <Link to="/rankings" className="ranking-new-back">← 返回红黑榜</Link>
          <div className="ranking-new-title-row">
            <h1 className="ranking-new-title">{resubmitId ? '修改并重新提交' : '发布红黑榜'}</h1>
            <Link to="/wallet" className="ranking-new-coin"><span>◉</span> 契约币 {balance ?? '...'}</Link>
          </div>
          <p className="ranking-new-subtitle">口碑票一人一票 · 真实口碑 · {publishCostText}</p>
        </div>
      </header>

      <section className="ranking-new-body">
        {done ? (
          <SuccessState
            type={type}
            effectiveAmount={effectiveAmount}
            resubmitted={!!resubmitId}
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
            <RankingTypeSelector type={type} disabled={!!resubmitId} onTypeChange={(next) => {
              setType(next);
              setInitialAmount(prev => next === 'red' ? Math.max(10, prev || 10) : 10);
            }} />

            <div className="ranking-new-main-grid">
              <div className="ranking-new-left">
                <SubjectTypeSelector subjectType={subjectType} disabled={!!resubmitId} setSubjectType={value => {
                  setSubjectType(value);
                  setSubjectDossierId('');
                  setSubjectMode(['dm', 'store'].includes(value) ? 'existing' : 'new');
                  setSubjectName('');
                  setSubjectEmploymentUpdate('keep');
                  setSubjectEmployerStoreId('');
                }} />

                <div className="ranking-grid-two">
                  {['dm', 'store'].includes(subjectType) ? (
                    <section className="ranking-new-section">
                      <label className="ranking-new-label">关联{subjectType === 'dm' ? 'DM' : '店家'}档案 *</label>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <button type="button" className={`ranking-subject-btn ${subjectMode === 'existing' ? 'is-active' : ''}`} onClick={() => setSubjectMode('existing')}>选择已有档案</button>
                        <button type="button" className={`ranking-subject-btn ${subjectMode === 'new' ? 'is-active' : ''}`} onClick={() => { setSubjectMode('new'); setSubjectDossierId(''); setSubjectEmploymentUpdate('keep'); setSubjectEmployerStoreId(''); }}>库里没有</button>
                      </div>
                      {subjectMode === 'existing' ? (
                        <select className="ranking-input" value={subjectDossierId} onChange={event => {
                          const id = event.target.value;
                          setSubjectDossierId(id);
                          setSubjectEmploymentUpdate('keep');
                          setSubjectEmployerStoreId('');
                          const item = (subjectType === 'dm' ? dmOptions : storeOptions).find(option => option.id === id);
                          if (item) {
                            setSubjectName(item.dm_name);
                            setSubjectCity(item.city || '');
                            if (item.city) setSelectedProvince(provinceForCity(item.city) || selectedProvince);
                          }
                        }}>
                          <option value="">请选择已有{subjectType === 'dm' ? 'DM' : '店家'}</option>
                          {subjectDossierId && !(subjectType === 'dm' ? dmOptions : storeOptions).some(item => item.id === subjectDossierId) && (
                            <option value={subjectDossierId}>{subjectName || '待审档案'} · 审核中</option>
                          )}
                          {(subjectType === 'dm' ? dmOptions : storeOptions).map(item => (
                            <option key={item.id} value={item.id}>{item.dm_name} · {item.city || '城市待补'}{item.workplace ? ` · ${item.workplace}` : ''}</option>
                          ))}
                        </select>
                      ) : (
                        <Input label={`${subjectType === 'dm' ? 'DM' : '店家'}名称 *`} value={subjectName} onChange={setSubjectName} placeholder={subjectType === 'dm' ? '填写DM名称' : '填写店家名称'} />
                      )}
                    </section>
                  ) : (
                    <Input label="对象名称 *" value={subjectName} onChange={setSubjectName} placeholder="外卖店 / 人名 / 服务者名" />
                  )}
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

                {subjectMode === 'new' && subjectType === 'dm' && (
                  <section className="ranking-new-section">
                    <label className="ranking-new-label">DM受雇店家 *</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <button type="button" className={`ranking-subject-btn ${employmentStatus === 'store_affiliated' ? 'is-active' : ''}`} onClick={() => setEmploymentStatus('store_affiliated')}>选择受雇店家</button>
                      <button type="button" className={`ranking-subject-btn ${employmentStatus === 'freelance' ? 'is-active' : ''}`} onClick={() => { setEmploymentStatus('freelance'); setEmployerStoreId(''); }}>无受雇店家（自由DM）</button>
                    </div>
                    {employmentStatus === 'store_affiliated' && (
                      <select className="ranking-input" value={employerStoreId} onChange={event => setEmployerStoreId(event.target.value)}>
                        <option value="">请选择已有店家</option>
                        {storeOptions.map(item => <option key={item.id} value={item.id}>{item.dm_name} · {item.city || '城市待补'}</option>)}
                      </select>
                    )}
                  </section>
                )}

                {subjectMode === 'existing' && subjectType === 'dm' && subjectDossierId && (
                  <section className="ranking-new-section">
                    <label className="ranking-new-label">DM受雇店家（可选纠正）</label>
                    <p style={{ margin: '0 0 8px', color: 'rgba(71,85,105,0.74)', fontSize: 12 }}>
                      当前档案：{selectedDm?.employment_status === 'freelance'
                        ? '无受雇店家（自由DM）'
                        : selectedDm?.employment_status === 'store_affiliated'
                          ? `受雇于 ${selectedDm.workplace || '已关联店家'}`
                          : selectedDm?.workplace || '受雇关系待核对'}
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <button type="button" className={`ranking-subject-btn ${subjectEmploymentUpdate === 'keep' ? 'is-active' : ''}`} onClick={() => { setSubjectEmploymentUpdate('keep'); setSubjectEmployerStoreId(''); }}>保持现有档案</button>
                      <button type="button" className={`ranking-subject-btn ${subjectEmploymentUpdate === 'store_affiliated' ? 'is-active' : ''}`} onClick={() => setSubjectEmploymentUpdate('store_affiliated')}>绑定已有店家</button>
                      <button type="button" className={`ranking-subject-btn ${subjectEmploymentUpdate === 'freelance' ? 'is-active' : ''}`} onClick={() => { setSubjectEmploymentUpdate('freelance'); setSubjectEmployerStoreId(''); }}>无受雇店家（自由DM）</button>
                    </div>
                    {subjectEmploymentUpdate === 'store_affiliated' && (
                      <select className="ranking-input" value={subjectEmployerStoreId} onChange={event => setSubjectEmployerStoreId(event.target.value)}>
                        <option value="">请选择已有店家</option>
                        {storeOptions.map(item => <option key={item.id} value={item.id}>{item.dm_name} · {item.city || '城市待补'}</option>)}
                      </select>
                    )}
                    {subjectEmploymentUpdate !== 'keep' && <p style={{ margin: '8px 0 0', color: 'rgba(71,85,105,0.66)', fontSize: 12 }}>这条关系会随红黑榜一起审核，通过后才更新DM档案。</p>}
                  </section>
                )}

                {subjectMode === 'new' && subjectType === 'store' && (
                  <Input label="店家地址 / 商圈 *" value={newSubjectWorkplace} onChange={setNewSubjectWorkplace} placeholder="例：朝阳区三里屯 / XX商场3层" />
                )}

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

                <section className="ranking-new-section">
                  <label className="ranking-new-label">事件上下文（全部选填）</label>
                  <div className="ranking-grid-two">
                    <input className="ranking-input" type="date" value={eventDate} onChange={event => setEventDate(event.target.value)} aria-label="事件日期（选填）" />
                    <select className="ranking-input" value={eventScriptId} onChange={event => { setEventScriptId(event.target.value); if (event.target.value) setEventScriptName(''); }} aria-label="关联剧本（选填）">
                      <option value="">不关联已有剧本</option>
                      {scriptOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    {!eventScriptId && <input className="ranking-input" value={eventScriptName} onChange={event => setEventScriptName(event.target.value)} placeholder="剧本名（选填）" />}
                    <select className="ranking-input" value={eventStoreDossierId} onChange={event => { setEventStoreDossierId(event.target.value); if (event.target.value) setEventStoreName(''); }} aria-label="事件发生店家（选填）">
                      <option value="">不关联已有店家</option>
                      {storeOptions.map(item => <option key={item.id} value={item.id}>{item.dm_name} · {item.city || '城市待补'}</option>)}
                    </select>
                    {!eventStoreDossierId && <input className="ranking-input" value={eventStoreName} onChange={event => setEventStoreName(event.target.value)} placeholder="其他发生场地（选填）" />}
                  </div>
                  <p style={{ margin: '8px 0 0', color: 'rgba(71,85,105,0.66)', fontSize: 12 }}>这些字段只补充红黑榜事件背景，不参与DM五星综合分。</p>
                </section>

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
                <AmountSection type={type} effectiveAmount={effectiveAmount} setInitialAmount={setInitialAmount} disabled={!!resubmitId} />
                {evidenceRequired && <div className="ranking-error">本次为审核要求补证据，重新提交前必须至少上传一张证据图片。</div>}
                {(error || rankingDraft.error) && <div className="ranking-error">{error || rankingDraft.error}</div>}
                <button className="ranking-submit" onClick={submit} disabled={submitting || !rulesAccepted}>
                  {submitting ? '提交中...' : !rulesAccepted ? '请先确认发布规则' : resubmitId ? '重新提交审核（不重复扣币）' : (effectiveAmount > 0 ? `发布 · 扣 ${effectiveAmount} 契约币` : `免费发布${type === 'black' ? '黑榜' : '白榜'}`)}
                </button>
              </aside>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function RankingTypeSelector({ type, onTypeChange, disabled = false }: { type: RankingType; onTypeChange: (type: RankingType) => void; disabled?: boolean }) {
  return (
    <section className="ranking-new-section">
      <label className="ranking-new-label">榜单类型</label>
      <div className="ranking-type-row">
        {(['red', 'white', 'black'] as const).map(t => (
          <button
            type="button"
            key={t}
            disabled={disabled}
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

function SubjectTypeSelector({ subjectType, setSubjectType, disabled = false }: { subjectType: string; setSubjectType: (value: string) => void; disabled?: boolean }) {
  return (
    <section className="ranking-new-section">
      <label className="ranking-new-label">对象类型</label>
      <div className="ranking-subject-row">
        {Object.entries(SUBJECT_LABEL).map(([key, label]) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
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
      <label className="ranking-new-label">上传证据图片（选填，单张 ≤8MB，第三方请打码）</label>
      <label className="ranking-upload-btn">
        <span>⌘</span>
        <span>选择文件</span>
        <input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={handleFileUpload} style={{ display: 'none' }} />
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

function AmountSection({ type, effectiveAmount, setInitialAmount, disabled = false }: { type: RankingType; effectiveAmount: number; setInitialAmount: (value: number) => void; disabled?: boolean }) {
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
        disabled={disabled}
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
      ? '黑榜要写清事实经过，不做人身攻击；证据初次提交选填，审核员认为必要时会要求补充。'
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
        <RuleLine><strong>上传证据</strong> — 红榜、黑榜、白榜首次提交都不强制上传；审核员认为现有内容不足时，可以打回并要求补证据。</RuleLine>
        <RuleLine><strong>保护隐私</strong> — 聊天记录、订单、群聊、照片等第三方信息请先打码，否则可能被驳回。</RuleLine>
        <RuleLine><strong>口碑票</strong> — 同一账号对同一帖只保留一张口碑票；打榜、踩榜按契约币金额累计，禁止多号刷票或重复提交同一事件。</RuleLine>
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
        <span>我已阅读并确认：我会尽量写清事实；如上传图片会先打码隐私，并接受人工审核及补充材料要求。</span>
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

function SuccessState({ type, effectiveAmount, onReset, resubmitted = false }: { type: RankingType; effectiveAmount: number; onReset: () => void; resubmitted?: boolean }) {
  return (
    <div className="ranking-success-card">
      <div className="ranking-success-icon">✓</div>
      <h2 className="ranking-success-title">发布成功</h2>
      <p className="ranking-success-copy">
        你的{type === 'red' ? '红榜' : type === 'black' ? '黑榜' : '白榜'}已提交审核。{resubmitted ? '本次重新提交不会重复扣除契约币。' : effectiveAmount > 0 ? `${effectiveAmount} 契约币已扣除。` : `${type === 'black' ? '黑榜' : '白榜'}本次免费发布。`}
      </p>
      <div className="ranking-success-actions">
        <Link to="/rankings" className="ranking-success-link">回红黑榜</Link>
        {!resubmitted && <button type="button" className="ranking-success-button" onClick={onReset}>再发一条</button>}
      </div>
    </div>
  );
}
