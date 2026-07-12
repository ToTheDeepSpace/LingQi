import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CitySearchSelect from '../components/CitySearchSelect';
import DossierClaimModal from '../components/DossierClaimModal';
import DraftAutosaveNotice from '../components/DraftAutosaveNotice';
import ImageFocusPicker from '../components/ImageFocusPicker';
import ImageUpload from '../components/ImageUpload';
import SocialPlatformLink, { InternalProfileLink } from '../components/SocialPlatformLink';
import {
  JumuluCompactHeader,
  JumuluPageFrame,
} from '../components/JumuluPageChrome';
import { jumuluCardStyle, jumuluFilterPanelStyle, jumuluPrimaryLinkStyle, jumuluSecondaryLinkStyle } from '../styles/jumuluPageStyles';
import { generatedAvatarDataUrl } from '../lib/avatar';
import { readStoredCreatorAuth } from '../lib/authSession';
import { extractSharedUrl } from '../lib/socialLinks';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import type { DossierNamedRef, DossierPhoto } from '../lib/dossierWiki';
import type { DmGraphDossier } from '../components/DmRelationshipGraph';
import { dmAffiliationLabel, dmClaimLabel, type PublicDmAffiliation } from '../lib/dmDossierPresentation';

const DmRelationshipGraph = lazy(() => import('../components/DmRelationshipGraph'));

const API = '/api';
const GOLD = '#a66a1f';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

type AuthSession = { token: string; displayName: string; userId?: string };
type DossierEntityType = 'dm' | 'store';
type RatingFilter = 'all' | 'rated' | '4.0' | '4.5' | 'unrated';
type ViewMode = 'cards' | 'graph';
type DossierDraft = {
  entityType: DossierEntityType;
  dmName: string;
  city: string;
  workplace: string;
  profileUrl: string;
  photoUrl: string;
  photoFocusX: number;
  photoFocusY: number;
  note: string;
  tags: string;
  employmentStatus: 'store_affiliated' | 'freelance';
  employerStoreId: string;
};

type DmDossier = {
  id: string;
  entity_type?: DossierEntityType | null;
  dm_name: string;
  city?: string | null;
  workplace?: string | null;
  employment_status?: 'unknown' | 'store_affiliated' | 'freelance';
  employer_store_id?: string | null;
  profile_url?: string | null;
  photo_url?: string | null;
  photo_focus_x?: number | null;
  photo_focus_y?: number | null;
  photo_files?: DossierPhoto[];
  note?: string | null;
  tags?: string[];
  rating_tags?: string[];
  common_scripts?: DossierNamedRef[];
  related_profiles?: DossierNamedRef[];
  related_stores?: DossierNamedRef[];
  claim_status?: 'unclaimed' | 'pending' | 'approved' | 'rejected' | 'withdrawn';
  claimed_by?: string | null;
  affiliation?: PublicDmAffiliation & {
    id?: string | null;
    store_city?: string | null;
    reviewed_at?: string | null;
    confirmed_at?: string | null;
  } | null;
  created_at?: string;
  rating_summary?: {
    avg: number | null;
    review_count: number;
    player_count: number;
    sample_status: 'insufficient' | 'stable';
  };
};

const RATING_FILTERS: { value: RatingFilter; label: string }[] = [
  { value: 'all', label: '全部评价' },
  { value: 'rated', label: '已有评价' },
  { value: '4.0', label: '4.0 分以上' },
  { value: '4.5', label: '4.5 分以上' },
  { value: 'unrated', label: '暂无评价' },
];

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
    filterLabel: 'DM档案',
    kindLabel: 'DM',
    nameLabel: 'DM 名称 *',
    workplaceLabel: '工作地点 / 常驻店家 *',
    profileLabel: '个人主页链接（选填）',
    photoLabel: 'DM 照片（选填）',
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

const ENTITY_FORM_TYPES: { value: DossierEntityType; label: string; helper: string }[] = [
  { value: 'dm', label: 'DM档案', helper: '给剧本杀DM建档' },
  { value: 'store', label: '店家档案', helper: '给城市店家建档' },
];

function getAuth(): AuthSession | null {
  const data = readStoredCreatorAuth();
  if (!data?.token) return null;
  return { token: data.token, displayName: data.display_name || '用户', userId: data.id };
}

function normalizeEntityType(value?: string | null): DossierEntityType {
  return value === 'store' ? 'store' : 'dm';
}

function normalizeDossierSearch(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ').trim();
}

function dossierDisplayTags(item: DmDossier) {
  const seen = new Set<string>();
  return [...(item.tags || []), ...(item.rating_tags || [])].filter(tag => {
    const key = normalizeDossierSearch(tag);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchesRatingFilter(item: DmDossier, filter: RatingFilter) {
  const summary = item.rating_summary;
  const hasRatings = Boolean(summary && summary.player_count > 0 && summary.avg !== null);
  if (filter === 'rated') return hasRatings;
  if (filter === 'unrated') return !hasRatings;
  if (filter === '4.0') return hasRatings && Number(summary?.avg || 0) >= 4;
  if (filter === '4.5') return hasRatings && Number(summary?.avg || 0) >= 4.5;
  return true;
}

function shouldSaveDossierDraft(data: DossierDraft) {
  return [
    data.dmName,
    data.city,
    data.workplace,
    data.profileUrl,
    data.photoUrl,
    data.note,
    data.tags,
    data.employerStoreId,
  ].some(item => item.trim()) || data.entityType !== 'dm';
}

export default function DmWall() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [items, setItems] = useState<DmDossier[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [city, setCity] = useState('all');
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DossierDraft>({ entityType: 'dm', dmName: '', city: '', workplace: '', profileUrl: '', photoUrl: '', photoFocusX: 50, photoFocusY: 25, note: '', tags: '', employmentStatus: 'store_affiliated', employerStoreId: '' });
  const [storeOptions, setStoreOptions] = useState<DmDossier[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [claimTarget, setClaimTarget] = useState<{ id: string; name: string; entityType: DossierEntityType } | null>(null);

  const requestKey = useMemo(() => `${city}|dm`, [city]);
  const loading = loadedKey !== requestKey;
  const activeFormCopy = ENTITY_COPY[form.entityType];

  const availableTags = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    items.forEach(item => dossierDisplayTags(item).forEach(tag => {
      const key = normalizeDossierSearch(tag);
      const current = counts.get(key);
      counts.set(key, { label: current?.label || tag, count: (current?.count || 0) + 1 });
    }));
    return Array.from(counts.entries())
      .sort((left, right) => right[1].count - left[1].count || left[1].label.localeCompare(right[1].label, 'zh-CN'))
      .map(([value, meta]) => ({ value, ...meta }));
  }, [items]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = normalizeDossierSearch(query);
    return items.filter(item => {
      const displayTags = dossierDisplayTags(item);
      if (tagFilter !== 'all' && !displayTags.some(tag => normalizeDossierSearch(tag) === tagFilter)) return false;
      if (!matchesRatingFilter(item, ratingFilter)) return false;
      if (!normalizedQuery) return true;
      const searchable = [
        item.dm_name,
        item.city,
        item.workplace,
        item.note,
        ...displayTags,
        ...(item.common_scripts || []).map(script => script.name),
      ].filter(Boolean).join(' ');
      return normalizeDossierSearch(searchable).includes(normalizedQuery);
    });
  }, [items, query, ratingFilter, tagFilter]);

  const dossierDraft = useDraftAutosave<DossierDraft>({
    key: 'lc:draft:dm-wall:dossier-form',
    version: 1,
    enabled: !!auth,
    value: form,
    shouldSave: shouldSaveDossierDraft,
    onRestore: data => {
      setForm({
        entityType: normalizeEntityType(data.entityType),
        dmName: data.dmName || '',
        city: data.city || '',
        workplace: data.workplace || '',
        profileUrl: data.profileUrl || '',
        photoUrl: data.photoUrl || '',
        photoFocusX: Number.isFinite(data.photoFocusX) ? data.photoFocusX : 50,
        photoFocusY: Number.isFinite(data.photoFocusY) ? data.photoFocusY : 25,
        note: data.note || '',
        tags: data.tags || '',
        employmentStatus: data.employmentStatus === 'freelance' ? 'freelance' : 'store_affiliated',
        employerStoreId: data.employerStoreId || '',
      });
    },
  });

  const loadDossiers = useCallback((signal?: AbortSignal) => {
    const nextKey = `${city}|dm`;
    const params = new URLSearchParams();
    if (city !== 'all') params.set('city', city);
    params.set('entityType', 'dm');
    fetch(`${API}/lc/dm-dossiers?${params}`, { signal })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setItems(d.data || []);
        } else {
          setItems([]);
          setMessage({ text: d.error || 'DM评分加载失败', ok: false });
        }
      })
      .catch(error => {
        if (error?.name !== 'AbortError') {
          setItems([]);
          setMessage({ text: '网络错误，DM评分暂时加载失败', ok: false });
        }
      })
      .finally(() => {
        if (!signal?.aborted) setLoadedKey(nextKey);
      });
  }, [city]);

  useEffect(() => {
    const controller = new AbortController();
    loadDossiers(controller.signal);
    return () => controller.abort();
  }, [loadDossiers]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/lc/dm-dossiers?entityType=store`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => { if (data.success) setStoreOptions(data.data || []); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

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
          employmentStatus: form.entityType === 'dm' ? form.employmentStatus : 'unknown',
          employerStoreId: form.entityType === 'dm' && form.employmentStatus === 'store_affiliated' ? form.employerStoreId : null,
          profileUrl: form.profileUrl.trim(),
          photoUrl: form.photoUrl.trim(),
          photoFocusX: form.photoFocusX,
          photoFocusY: form.photoFocusY,
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
      dossierDraft.clearDraft();
      setShowForm(false);
      setForm({ entityType: form.entityType, dmName: '', city: '', workplace: '', profileUrl: '', photoUrl: '', photoFocusX: 50, photoFocusY: 25, note: '', tags: '', employmentStatus: 'store_affiliated', employerStoreId: '' });
      loadDossiers();
    } catch {
      setMessage({ text: '网络错误，请稍后再试', ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const openClaim = (item: DmDossier) => {
    const current = getAuth();
    if (!current) {
      navigate('/login');
      return;
    }
    setClaimTarget({ id: item.id, name: item.dm_name, entityType: normalizeEntityType(item.entity_type) });
  };

  return (
    <JumuluPageFrame currentLabel="DM评分">
      <JumuluCompactHeader
        eyebrow="剧本杀 DM 评分"
        title="查 DM，评体验"
        description="每次体验都可以留下评分；综合分按独立玩家计算，多次体验完整展示但不重复增加计分权重。"
        aside={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link to="/dm/rate" style={jumuluPrimaryLinkStyle}>给 DM 评分</Link>
            <Link to="/chanto" style={jumuluSecondaryLinkStyle}>缠头榜</Link>
            <button onClick={() => auth ? setShowForm(v => !v) : navigate('/login')} style={jumuluSecondaryLinkStyle}>{showForm ? '收起建档' : '创建档案'}</button>
          </div>
        }
      />

      <section style={jumuluFilterPanelStyle}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <CitySearchSelect
            value={city}
            onChange={value => {
              setCity(value);
              setTagFilter('all');
            }}
            allowAll
            allowCustom
            style={{ minWidth: 190, flex: '1 1 190px' }}
          />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索名称、标签或常开剧本" style={{ ...inputStyle, minWidth: 190, flex: '1 1 230px' }} />
          <Link to="/reputation/city" style={ghostButton}>看城市口碑</Link>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          <select aria-label="按标签筛选" value={tagFilter} onChange={event => setTagFilter(event.target.value)} style={{ ...inputStyle, minWidth: 170, flex: '1 1 190px' }}>
            <option value="all">全部标签</option>
            {availableTags.map(tag => <option key={tag.value} value={tag.value}>{tag.label}（{tag.count}）</option>)}
          </select>
          <select aria-label="按评价筛选" value={ratingFilter} onChange={event => setRatingFilter(event.target.value as RatingFilter)} style={{ ...inputStyle, minWidth: 150, flex: '0 1 180px' }}>
            {RATING_FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ViewModeSwitch value={viewMode} onChange={setViewMode} />
          <span style={{ color: MUTED, fontSize: 12, marginLeft: 'auto' }}>共 {visibleItems.length} 个档案</span>
        </div>
      </section>

        {message && (
          <div style={{ marginBottom: 16, borderRadius: 12, padding: '12px 14px', border: `1px solid ${message.ok ? 'rgba(22,163,74,0.24)' : 'rgba(220,38,38,0.22)'}`, background: message.ok ? 'rgba(220,252,231,0.72)' : 'rgba(254,226,226,0.62)', color: message.ok ? '#15803d' : '#b91c1c', fontSize: 14, fontWeight: 700 }}>
            {message.text}
          </div>
        )}

        {showForm && (
          <section style={formCard}>
            <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-serif)', fontSize: '1.35rem' }}>创建未认证档案</h2>
            <div style={{ marginBottom: 12 }}>
              <DraftAutosaveNotice
                savedAt={dossierDraft.savedAt}
                restoredAt={dossierDraft.restoredAt}
                error={dossierDraft.error}
                note="未提交的建档内容会自动保存到当前浏览器。"
              />
            </div>
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
              {form.entityType === 'store' && <Field label={activeFormCopy.workplaceLabel} value={form.workplace} onChange={value => updateForm({ workplace: value })} />}
              <SocialShareLinkField label={activeFormCopy.profileLabel} value={form.profileUrl} onChange={value => updateForm({ profileUrl: value })} placeholder={form.entityType === 'store' ? '可直接粘贴大众点评 / 小红书 / 抖音分享文案' : '可直接粘贴抖音 / 小红书分享文案'} />
            </div>
            {form.entityType === 'dm' && (
              <div style={{ marginTop: 12 }}>
                <span style={labelStyle}>受雇店家 *</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <button type="button" onClick={() => updateForm({ employmentStatus: 'store_affiliated' })} style={form.employmentStatus === 'store_affiliated' ? primaryButton : ghostButton}>选择已有店家</button>
                  <button type="button" onClick={() => updateForm({ employmentStatus: 'freelance', employerStoreId: '', workplace: '' })} style={form.employmentStatus === 'freelance' ? primaryButton : ghostButton}>无受雇店家（自由DM）</button>
                </div>
                {form.employmentStatus === 'store_affiliated' && (
                  <select value={form.employerStoreId} onChange={event => {
                    const id = event.target.value;
                    const store = storeOptions.find(item => item.id === id);
                    updateForm({ employerStoreId: id, workplace: store?.dm_name || '' });
                    if (!form.city && store?.city) updateForm({ employerStoreId: id, workplace: store.dm_name, city: store.city });
                  }} style={inputStyle}>
                    <option value="">请选择已有店家档案</option>
                    {storeOptions.map(item => <option key={item.id} value={item.id}>{item.dm_name} · {item.city || '城市待补'}</option>)}
                  </select>
                )}
              </div>
            )}
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'end' }}>
              <Field label={activeFormCopy.photoLabel} value={form.photoUrl} onChange={value => updateForm({ photoUrl: value })} placeholder="上传后自动填入，也可粘贴图片链接" />
              {auth && <ImageUpload token={auth.token} scope="dm-dossier" label="上传照片" onUploaded={url => updateForm({ photoUrl: url })} />}
            </div>
            {form.photoUrl && (
              <div style={{ marginTop: 10 }}>
                <ImageFocusPicker
                  src={form.photoUrl}
                  focusX={form.photoFocusX}
                  focusY={form.photoFocusY}
                  onChange={({ x, y }) => updateForm({ photoFocusX: x, photoFocusY: y })}
                />
              </div>
            )}
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
        ) : visibleItems.length === 0 ? (
          <div style={emptyStyle}>当前筛选下暂无公开档案。你可以先创建一个，审核后会出现在档案墙。</div>
        ) : viewMode === 'graph' ? (
          <Suspense fallback={<div style={emptyStyle}>关系图加载中...</div>}>
            <DmRelationshipGraph items={visibleItems as DmGraphDossier[]} />
          </Suspense>
        ) : (
          <div className="dm-dossier-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {visibleItems.map(item => {
              const kind = normalizeEntityType(item.entity_type);
              const dossierHref = kind === 'store' ? `/stores/${encodeURIComponent(item.id)}` : `/dm/${encodeURIComponent(item.id)}`;
              const displayTags = dossierDisplayTags(item);
              const hasRatings = kind === 'dm' && item.rating_summary && item.rating_summary.player_count > 0 && item.rating_summary.avg !== null;
              const affiliationText = dmAffiliationLabel({
                affiliation: item.affiliation,
                claimStatus: item.claim_status,
                employmentStatus: item.employment_status,
              });
              const showClaimStatus = ['approved', 'pending', 'withdrawn'].includes(item.claim_status || '');
              return (
                <article key={item.id} className="dm-dossier-card" style={cardStyle}>
                  <Link to={dossierHref} aria-label={`查看${item.dm_name}${copy.kindLabel}专属页`} style={cardOverlayLinkStyle} />
                  <div className="dm-dossier-summary">
                    <img className="dm-dossier-photo" src={item.photo_url || generatedAvatarDataUrl(item.dm_name, item.id)} alt="" style={{ objectPosition: `${item.photo_focus_x ?? 50}% ${item.photo_focus_y ?? 25}%` }} />
                    <div className="dm-dossier-summary-copy">
                      <div className="dm-dossier-title-row" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', overflow: 'hidden', marginBottom: 6 }}>
                        <h2 style={{ margin: 0, fontSize: 17, flex: '0 0 auto' }}>{item.dm_name}</h2>
                        <span className="dm-dossier-inline-meta" title={`${item.city || '未知城市'} · ${affiliationText}`} style={{ minWidth: 0, flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: MUTED, fontSize: 11.5, fontWeight: 700 }}>
                          {item.city || '未知城市'} · {affiliationText}
                        </span>
                        {showClaimStatus && <span className="dm-dossier-status-badge" style={{ ...badgeStyle, flex: '0 0 auto', color: item.claim_status === 'approved' ? '#15803d' : item.claim_status === 'withdrawn' ? '#9f1239' : GOLD, background: item.claim_status === 'approved' ? 'rgba(220,252,231,0.72)' : item.claim_status === 'withdrawn' ? 'rgba(255,228,230,0.76)' : 'rgba(166,106,31,0.10)' }}>
                          {dmClaimLabel(item.claim_status)}
                        </span>}
                        {item.claim_status !== 'approved' && item.claim_status !== 'pending' && item.claim_status !== 'withdrawn' && (
                          <button type="button" title="本人认领" onClick={() => openClaim(item)} style={{ ...claimButtonStyle, flex: '0 0 auto' }}>
                            认领
                          </button>
                        )}
                      </div>
                      {item.note && <p className="dm-dossier-note" style={{ margin: 0, color: 'rgba(31,41,55,0.74)', lineHeight: 1.55, fontSize: 13 }}>{item.note}</p>}
                    </div>
                  </div>
                  {hasRatings && item.rating_summary && (
                    <div className="dm-dossier-rating-line" style={{ display: 'flex', alignItems: 'center', gap: 7, color: MUTED, fontSize: 12, marginBottom: 8, whiteSpace: 'nowrap' }}>
                      <strong style={{ color: '#9a5f18', fontSize: 13 }}>★ {item.rating_summary.avg?.toFixed(1)}</strong>
                      <span>{item.rating_summary.player_count} 位玩家</span>
                      <span>{item.rating_summary.review_count} 次体验</span>
                      {item.rating_summary.sample_status === 'insufficient' && <span style={{ color: '#b45309' }}>样本较少</span>}
                    </div>
                  )}
                  {displayTags.length > 0 && (
                    <div className="dm-dossier-tags" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {displayTags.slice(0, 6).map(tag => <span key={tag} style={tagStyle}>{tag}</span>)}
                    </div>
                  )}
                  <div className="dm-dossier-actions" style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'nowrap', marginTop: 'auto' }}>
                    {kind === 'dm' && <Link to={`/dm/rate?dmId=${encodeURIComponent(item.id)}`} title="写一条评价" style={compactGhostButton}>＋评价</Link>}
                    {item.profile_url && <SocialPlatformLink url={item.profile_url} />}
                    {item.claim_status === 'approved' && item.claimed_by
                      ? (kind === 'dm' ? <InternalProfileLink to={`/explore/${item.claimed_by}`} /> : null)
                      : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      <DossierClaimModal
        open={!!claimTarget}
        dossier={claimTarget}
        token={auth?.token || ''}
        displayName={auth?.displayName || '当前用户'}
        onClose={() => setClaimTarget(null)}
        onSubmitted={() => {
          setClaimTarget(null);
          setMessage({ text: '认领申请已提交，审核通过后会绑定到你的账号。', ok: true });
          loadDossiers();
        }}
      />
      <style>{`
        .dm-dossier-summary {
          display: block;
          margin-bottom: 10px;
        }
        .dm-dossier-photo {
          display: block;
          width: 100%;
          aspect-ratio: 16 / 9;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid rgba(31,41,55,0.06);
          background: #fffaf2;
          margin-bottom: 10px;
        }
        .dm-dossier-note {
          display: -webkit-box;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }
        @media (max-width: 640px) {
          .dm-dossier-grid {
            grid-template-columns: 1fr !important;
            gap: 9px !important;
          }
          .dm-dossier-card {
            padding: 8px !important;
          }
          .dm-dossier-summary {
            display: grid;
            grid-template-columns: 72px minmax(0, 1fr);
            gap: 8px;
            align-items: start;
            margin-bottom: 5px;
          }
          .dm-dossier-photo {
            width: 72px;
            height: 72px;
            aspect-ratio: 1;
            margin: 0;
          }
          .dm-dossier-title-row {
            gap: 5px !important;
            margin-bottom: 4px !important;
          }
          .dm-dossier-title-row h2 {
            font-size: 16px !important;
          }
          .dm-dossier-title-row .dm-dossier-status-badge {
            padding: 2px 6px !important;
            font-size: 10px !important;
          }
          .dm-dossier-location,
          .dm-dossier-note {
            font-size: 12px !important;
            line-height: 1.45 !important;
          }
          .dm-dossier-location {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .dm-dossier-note {
            -webkit-line-clamp: 1 !important;
          }
          .dm-dossier-tags > :nth-child(n + 3) {
            display: none !important;
          }
          .dm-dossier-rating-line {
            margin-bottom: 4px !important;
            overflow-x: auto;
            scrollbar-width: none;
          }
          .dm-dossier-tags {
            margin-bottom: 4px !important;
          }
          .dm-dossier-actions {
            overflow-x: auto;
            scrollbar-width: none;
          }
        }
      `}</style>
    </JumuluPageFrame>
  );
}

function ViewModeSwitch({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <div aria-label="展示方式" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', width: 152, height: 42, padding: 3, borderRadius: 8, border: '1px solid rgba(31,41,55,0.12)', background: '#f8fafc' }}>
      {([['cards', '卡片'], ['graph', '关系图']] as const).map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          style={{ border: 0, borderRadius: 6, background: value === mode ? '#fff' : 'transparent', color: value === mode ? INK : MUTED, boxShadow: value === mode ? '0 1px 4px rgba(15,23,42,0.10)' : 'none', fontSize: 12, fontWeight: 850, cursor: 'pointer' }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function EntityFormSwitch({ value, onChange }: { value: DossierEntityType; onChange: (value: DossierEntityType) => void }) {
  const activeIndex = Math.max(0, ENTITY_FORM_TYPES.findIndex(option => option.value === value));
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={labelStyle}>档案类型 *</span>
      <div aria-label="建档类型" style={segmentShell(ENTITY_FORM_TYPES.length)}>
        <span className="segment-switch-indicator" aria-hidden="true" style={segmentIndicator(activeIndex, ENTITY_FORM_TYPES.length)} />
        {ENTITY_FORM_TYPES.map(option => (
          <button
            key={option.value}
            className="segment-switch-button"
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

function SocialShareLinkField({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const normalize = (raw: string) => onChange(extractSharedUrl(raw) || raw);
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={event => onChange(event.target.value)}
        onBlur={event => normalize(event.target.value)}
        onPaste={event => {
          const extracted = extractSharedUrl(event.clipboardData.getData('text'));
          if (!extracted) return;
          event.preventDefault();
          onChange(extracted);
        }}
        placeholder={placeholder}
        style={{ ...inputStyle, width: '100%' }}
      />
    </label>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', color: 'rgba(71,85,105,0.72)', fontSize: 13, fontWeight: 800, marginBottom: 6 };
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', padding: '11px 12px', borderRadius: 10, border: '1px solid rgba(166,106,31,0.20)', background: '#fff', color: INK, outline: 'none', fontSize: 14 };
const segmentShell = (count: number): React.CSSProperties => ({
  boxSizing: 'border-box',
  display: 'grid',
  gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
  gap: 6,
  padding: 5,
  borderRadius: 12,
  border: '1px solid rgba(166,106,31,0.24)',
  background: 'rgba(255,250,242,0.92)',
  minWidth: 0,
  position: 'relative',
  overflow: 'hidden',
});
const segmentLabel: React.CSSProperties = { fontSize: 14, fontWeight: 900, lineHeight: 1.2 };
const segmentHelper: React.CSSProperties = { fontSize: 11, fontWeight: 800, lineHeight: 1.2, opacity: 0.82 };
const segmentIndicator = (index: number, count: number): React.CSSProperties => ({
  position: 'absolute',
  zIndex: 0,
  left: 5,
  top: 5,
  bottom: 5,
  width: `calc((100% - 10px - ${6 * (count - 1)}px) / ${count})`,
  borderRadius: 9,
  background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
  boxShadow: '0 10px 20px rgba(166,106,31,0.22)',
  transform: `translateX(calc(${index} * (100% + 6px)))`,
  transition: 'transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease',
});
const segmentButton = (active: boolean): React.CSSProperties => ({
  minHeight: 52,
  border: '1px solid transparent',
  borderRadius: 9,
  background: active ? 'transparent' : 'rgba(255,255,255,0.82)',
  color: active ? '#fffdf8' : 'rgba(31,41,55,0.82)',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: '8px 10px',
  boxShadow: active ? 'none' : 'inset 0 0 0 1px rgba(166,106,31,0.06)',
  textAlign: 'center',
  position: 'relative',
  zIndex: 1,
  transition: 'color 180ms ease, background 180ms ease, transform 140ms ease, box-shadow 180ms ease',
});
const primaryButton: React.CSSProperties = { ...jumuluPrimaryLinkStyle, minHeight: 36, padding: '0 12px' };
const ghostButton: React.CSSProperties = { ...jumuluSecondaryLinkStyle, minHeight: 36, padding: '0 12px' };
const compactGhostButton: React.CSSProperties = { ...jumuluSecondaryLinkStyle, minHeight: 28, padding: '0 8px', borderRadius: 7, fontSize: 11 };
const formCard: React.CSSProperties = { ...jumuluCardStyle, padding: 16 };
const cardStyle: React.CSSProperties = { ...jumuluCardStyle, position: 'relative', display: 'flex', flexDirection: 'column', padding: 14, minHeight: 0 };
const cardOverlayLinkStyle: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 1, borderRadius: 8 };
const badgeStyle: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(166,106,31,0.14)', fontSize: 12, fontWeight: 900 };
const tagStyle: React.CSSProperties = { padding: '3px 8px', borderRadius: 999, background: 'rgba(239,246,255,0.88)', color: '#275389', fontSize: 12, fontWeight: 800 };
const claimButtonStyle: React.CSSProperties = { position: 'relative', zIndex: 2, padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(166,106,31,0.22)', background: '#fffdf8', color: '#8a5a19', fontSize: 11, fontWeight: 900, cursor: 'pointer' };
const emptyStyle: React.CSSProperties = { padding: 28, borderRadius: 8, border: '1px dashed rgba(166,106,31,0.22)', background: '#fff', color: MUTED, textAlign: 'center', lineHeight: 1.8 };
