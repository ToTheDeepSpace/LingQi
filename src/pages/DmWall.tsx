import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import CitySearchSelect from '../components/CitySearchSelect';
import DossierClaimModal from '../components/DossierClaimModal';
import DraftAutosaveNotice from '../components/DraftAutosaveNotice';
import ImageFocusPicker from '../components/ImageFocusPicker';
import StoreSearchSelect from '../components/StoreSearchSelect';
import ImageUpload from '../components/ImageUpload';
import SocialPlatformLink, { InternalProfileLink } from '../components/SocialPlatformLink';
import {
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
import { sortDmDossiers, type DmDossierSortMode } from '../lib/dmDossierSort';
import './DmWall.css';

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
  chanto_summary?: {
    total: number;
    gift_count: number;
    supporter_count: number;
  };
};

type DmRatingExcerpt = {
  id: string;
  rating: number;
  content?: string | null;
  script_name?: string | null;
  played_on?: string | null;
};

type DmDossierDetail = {
  ratings?: DmRatingExcerpt[];
};

const RATING_FILTERS: { value: RatingFilter; label: string }[] = [
  { value: 'all', label: '全部评价' },
  { value: 'rated', label: '已有评价' },
  { value: '4.0', label: '4.0 分以上' },
  { value: '4.5', label: '4.5 分以上' },
  { value: 'unrated', label: '暂无评价' },
];

const SORT_OPTIONS: { value: DmDossierSortMode; label: string }[] = [
  { value: 'comprehensive', label: '综合排序' },
  { value: 'rating', label: '评分最高' },
  { value: 'verified', label: '已认证优先' },
  { value: 'photo', label: '有照片优先' },
  { value: 'newest', label: '最新收录' },
];

const DM_SORT_STORAGE_KEY = 'jumulu:dm-sort-mode';
const DM_CHANTO_SORT_STORAGE_KEY = 'jumulu:dm-chanto-first';
const DM_DIRECTORY_PAGE_SIZE = 8;

function readStoredSortMode(): DmDossierSortMode {
  if (typeof window === 'undefined') return 'comprehensive';
  const value = window.localStorage.getItem(DM_SORT_STORAGE_KEY);
  return SORT_OPTIONS.some(option => option.value === value) ? value as DmDossierSortMode : 'comprehensive';
}

function readStoredChantoFirst() {
  return typeof window !== 'undefined' && window.localStorage.getItem(DM_CHANTO_SORT_STORAGE_KEY) === 'true';
}

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
  const [searchParams] = useSearchParams();
  const auth = getAuth();
  const [items, setItems] = useState<DmDossier[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [city, setCity] = useState('all');
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [tagFilter, setTagFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [sortMode, setSortMode] = useState<DmDossierSortMode>(readStoredSortMode);
  const [chantoFirst, setChantoFirst] = useState(readStoredChantoFirst);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [detailDismissed, setDetailDismissed] = useState(false);
  const [selectedDetailState, setSelectedDetailState] = useState<{ id: string; detail: DmDossierDetail } | null>(null);
  const [isDirectoryDesktop, setIsDirectoryDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 981px)').matches);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DossierDraft>({ entityType: 'dm', dmName: '', city: '', workplace: '', profileUrl: '', photoUrl: '', photoFocusX: 50, photoFocusY: 25, note: '', tags: '', employmentStatus: 'store_affiliated', employerStoreId: '' });
  const [storeOptions, setStoreOptions] = useState<DmDossier[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [claimTarget, setClaimTarget] = useState<{ id: string; name: string; entityType: DossierEntityType } | null>(null);

  const requestKey = 'dm';
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
    const filtered = items.filter(item => {
      const displayTags = dossierDisplayTags(item);
      if (city !== 'all' && normalizeDossierSearch(item.city || '') !== normalizeDossierSearch(city)) return false;
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
    return sortDmDossiers(filtered, sortMode, chantoFirst);
  }, [chantoFirst, city, items, query, ratingFilter, sortMode, tagFilter]);

  const cityFacets = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach(item => {
      const label = item.city?.trim();
      if (!label) return;
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN'))
      .map(([label, count]) => ({ label, count }));
  }, [items]);

  const pageCount = Math.max(1, Math.ceil(visibleItems.length / DM_DIRECTORY_PAGE_SIZE));
  const pagedItems = useMemo(
    () => visibleItems.slice((page - 1) * DM_DIRECTORY_PAGE_SIZE, page * DM_DIRECTORY_PAGE_SIZE),
    [page, visibleItems],
  );

  const selectedIdOnPage = Boolean(selectedId && pagedItems.some(item => item.id === selectedId));
  const activeSelectedId = viewMode === 'cards'
    ? selectedIdOnPage
      ? selectedId
      : isDirectoryDesktop && !detailDismissed
        ? pagedItems[0]?.id || ''
        : ''
    : '';
  const selectedItem = useMemo(
    () => visibleItems.find(item => item.id === activeSelectedId) || null,
    [activeSelectedId, visibleItems],
  );
  const selectedDetail = selectedDetailState?.id === activeSelectedId ? selectedDetailState.detail : null;
  const selectedDetailLoading = Boolean(activeSelectedId && selectedDetailState?.id !== activeSelectedId);

  const changeSortMode = (value: DmDossierSortMode) => {
    setSortMode(value);
    setPage(1);
    setSelectedId('');
    setDetailDismissed(false);
    window.localStorage.setItem(DM_SORT_STORAGE_KEY, value);
  };

  const changeChantoFirst = (value: boolean) => {
    setChantoFirst(value);
    setPage(1);
    setSelectedId('');
    setDetailDismissed(false);
    window.localStorage.setItem(DM_CHANTO_SORT_STORAGE_KEY, String(value));
  };

  const resetDirectoryPage = () => {
    setPage(1);
    setSelectedId('');
    setDetailDismissed(false);
  };

  const changeDirectoryPage = (nextPage: number) => {
    setPage(Math.min(pageCount, Math.max(1, nextPage)));
    setSelectedId('');
    setDetailDismissed(false);
  };

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
    const nextKey = 'dm';
    const params = new URLSearchParams();
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
  }, []);

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

  useEffect(() => {
    const media = window.matchMedia('(min-width: 981px)');
    const syncViewport = () => {
      setIsDirectoryDesktop(media.matches);
      if (!media.matches) setSelectedId('');
    };
    media.addEventListener('change', syncViewport);
    return () => media.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (!activeSelectedId) return;
    const controller = new AbortController();
    fetch(`${API}/lc/dm-dossiers/${encodeURIComponent(activeSelectedId)}`, { signal: controller.signal })
      .then(response => response.json())
      .then(payload => {
        if (payload.success) {
          setSelectedDetailState({
            id: activeSelectedId,
            detail: { ratings: payload.data?.ratings || [] },
          });
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [activeSelectedId]);

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
      <header className="dm-directory-header">
        <div className="dm-directory-heading">
          <h1>查 DM</h1>
          <p>按独立玩家计算综合分，多次体验完整保留但不重复增加计分权重。</p>
        </div>
        <div className="dm-directory-header-actions">
          <Link to="/chanto" style={jumuluSecondaryLinkStyle}>缠头榜</Link>
          <button onClick={() => auth ? setShowForm(value => !value) : navigate('/login')} style={jumuluSecondaryLinkStyle}>
            {showForm ? '收起建档' : '创建档案'}
          </button>
        </div>
      </header>

      <section className="dm-dossier-filter-panel" style={{ ...jumuluFilterPanelStyle, padding: 8 }}>
        <div className="dm-filter-toolbar">
          <CitySearchSelect
            value={city}
            onChange={value => {
              setCity(value);
              setTagFilter('all');
              resetDirectoryPage();
            }}
            allowAll
            allowCustom
            style={{ minWidth: 0 }}
          />
          <input className="dm-filter-query" value={query} onChange={event => { setQuery(event.target.value); resetDirectoryPage(); }} placeholder="搜索名称、标签或常开剧本" style={{ ...inputStyle, minWidth: 0, width: '100%' }} />
          <Link className="dm-filter-city-link" to="/reputation/city" style={ghostButton}>看城市口碑</Link>
          <select aria-label="按标签筛选" value={tagFilter} onChange={event => { setTagFilter(event.target.value); resetDirectoryPage(); }} style={{ ...inputStyle, minWidth: 0, width: '100%' }}>
            <option value="all">全部标签</option>
            {availableTags.map(tag => <option key={tag.value} value={tag.value}>{tag.label}（{tag.count}）</option>)}
          </select>
          <select aria-label="按评价筛选" value={ratingFilter} onChange={event => { setRatingFilter(event.target.value as RatingFilter); resetDirectoryPage(); }} style={{ ...inputStyle, minWidth: 0, width: '100%' }}>
            {RATING_FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select aria-label="选择排序方式" value={sortMode} onChange={event => changeSortMode(event.target.value as DmDossierSortMode)} style={{ ...inputStyle, minWidth: 0, width: '100%' }}>
            {SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ChantoSortSwitch checked={chantoFirst} onChange={changeChantoFirst} />
          <ViewModeSwitch value={viewMode} onChange={value => { setViewMode(value); setSelectedId(''); setDetailDismissed(false); }} />
          <span className="dm-filter-count" style={{ color: MUTED, fontSize: 12, marginLeft: 'auto' }}>共 {visibleItems.length} 个档案</span>
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
                {form.employmentStatus === 'store_affiliated' && <StoreSearchSelect
                  value={form.employerStoreId}
                  options={storeOptions.map(item => ({ id: item.id, name: item.dm_name, city: item.city, workplace: item.workplace }))}
                  onChange={(id, store) => {
                    updateForm({ employerStoreId: id, workplace: store?.name || '' });
                    if (!form.city && store?.city) updateForm({ employerStoreId: id, workplace: store.name, city: store.city });
                  }}
                />}
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
          <div className={`dm-directory-workspace${selectedItem ? ' is-detail-open' : ''}`}>
            <aside className="dm-city-index" aria-label="城市索引">
              <div className="dm-city-index-heading">
                <strong>城市</strong>
                <span>{items.length}</span>
              </div>
              <button type="button" className={city === 'all' ? 'is-active' : ''} onClick={() => { setCity('all'); resetDirectoryPage(); }}>
                <span>全部城市</span>
                <b>{items.length}</b>
              </button>
              {cityFacets.slice(0, 12).map(facet => (
                <button key={facet.label} type="button" className={city === facet.label ? 'is-active' : ''} onClick={() => { setCity(facet.label); resetDirectoryPage(); }}>
                  <span>{facet.label}</span>
                  <b>{facet.count}</b>
                </button>
              ))}
              {cityFacets.length > 12 && <span className="dm-city-index-more">更多城市可在上方搜索</span>}
            </aside>

            <section className="dm-directory-list-panel" aria-label="DM档案列表">
              <div className="dm-directory-table-head" aria-hidden="true">
                <span>#</span>
                <span>DM信息</span>
                <span>认证 / 状态</span>
                <span>城市 / 店家</span>
                <span>代表剧本 / 擅长领域</span>
                <span>综合评分</span>
                <span>体验 / 评分人</span>
              </div>
              <div className="dm-directory-rows" role="list">
                {pagedItems.map((item, index) => (
                  <DmDirectoryRow
                    key={item.id}
                    item={item}
                    index={(page - 1) * DM_DIRECTORY_PAGE_SIZE + index + 1}
                    selected={activeSelectedId === item.id}
                    onSelect={() => { setSelectedId(item.id); setDetailDismissed(false); }}
                  />
                ))}
              </div>
              <nav className="dm-directory-pagination" aria-label="DM档案分页">
                <span>共 {visibleItems.length} 条</span>
                <div>
                  <button type="button" disabled={page === 1} onClick={() => changeDirectoryPage(page - 1)}>上一页</button>
                  {Array.from({ length: pageCount }, (_, index) => index + 1).map(pageNumber => (
                    <button
                      key={pageNumber}
                      type="button"
                      className={pageNumber === page ? 'is-active' : ''}
                      aria-current={pageNumber === page ? 'page' : undefined}
                      onClick={() => changeDirectoryPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  <button type="button" disabled={page === pageCount} onClick={() => changeDirectoryPage(page + 1)}>下一页</button>
                </div>
              </nav>
            </section>

            {selectedItem && (
              <>
                <button className="dm-detail-backdrop" type="button" aria-label="关闭DM档案预览" onClick={() => { setSelectedId(''); setDetailDismissed(true); }} />
                <DmDirectoryDetail
                  item={selectedItem}
                  detail={selectedDetail}
                  loading={selectedDetailLoading}
                  onClose={() => { setSelectedId(''); setDetailDismissed(true); }}
                  onClaim={() => openClaim(selectedItem)}
                />
              </>
            )}
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
    </JumuluPageFrame>
  );
}

function DmDirectoryRow({ item, index, selected, onSelect }: {
  item: DmDossier;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const displayTags = dossierDisplayTags(item);
  const scripts = item.common_scripts || [];
  const summary = item.rating_summary;
  const hasRatings = Boolean(summary && summary.player_count > 0 && summary.avg !== null);
  const affiliationText = dmAffiliationLabel({
    affiliation: item.affiliation,
    claimStatus: item.claim_status,
    employmentStatus: item.employment_status,
  });
  const statusVisible = ['approved', 'pending', 'withdrawn'].includes(item.claim_status || '');
  const workPrimary = scripts.length > 0
    ? scripts.slice(0, 2).map(script => `《${script.name}》`).join(' ')
    : displayTags.slice(0, 2).join(' · ') || item.note || '资料待补充';
  const workSecondary = scripts.length > 0
    ? displayTags.slice(0, 3).join(' · ') || item.note || '擅长领域待补充'
    : item.note || displayTags.slice(2, 5).join(' · ') || '更多资料待补充';

  return (
    <button
      type="button"
      role="listitem"
      className={`dm-directory-row${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="dm-row-index">{index}</span>
      <span className="dm-row-identity">
        <img
          src={dossierPhotoUrl(item)}
          alt=""
          style={{ objectPosition: `${item.photo_focus_x ?? 50}% ${item.photo_focus_y ?? 25}%` }}
        />
        <span className="dm-row-identity-copy">
          <span className="dm-row-name-line">
            <strong>{item.dm_name}</strong>
            {item.chanto_summary && item.chanto_summary.total > 0 && <small>缠头 {item.chanto_summary.total}</small>}
          </span>
          <span className="dm-row-traits">{displayTags.slice(0, 3).join(' · ') || item.note || '档案资料待补充'}</span>
        </span>
      </span>
      <span className="dm-row-status">
        {statusVisible ? (
          <b className={`is-${item.claim_status}`}>{dmClaimLabel(item.claim_status)}</b>
        ) : (
          <b className="is-unclaimed">未认证</b>
        )}
        <small>{item.affiliation?.status === 'approved' ? '任职已确认' : item.affiliation?.status === 'pending' ? '任职待确认' : '公开档案'}</small>
      </span>
      <span className="dm-row-location">
        <strong>{item.city || '未知城市'}</strong>
        <small title={affiliationText}>{item.workplace || affiliationText}</small>
      </span>
      <span className="dm-row-work">
        <strong>{workPrimary}</strong>
        <small>{workSecondary}</small>
      </span>
      <span className="dm-row-score">
        <strong>{hasRatings ? summary?.avg?.toFixed(1) : '—'}</strong>
        <small>{hasRatings ? '综合评分' : '暂无评分'}</small>
      </span>
      <span className="dm-row-counts">
        <strong>{summary?.review_count || 0} 次体验</strong>
        <small>{summary?.player_count || 0} 位玩家</small>
      </span>
    </button>
  );
}

function DmDirectoryDetail({ item, detail, loading, onClose, onClaim }: {
  item: DmDossier;
  detail: DmDossierDetail | null;
  loading: boolean;
  onClose: () => void;
  onClaim: () => void;
}) {
  const summary = item.rating_summary;
  const displayTags = dossierDisplayTags(item);
  const scripts = item.common_scripts || [];
  const ratingExcerpt = detail?.ratings?.find(rating => rating.content?.trim());
  const affiliationText = dmAffiliationLabel({
    affiliation: item.affiliation,
    claimStatus: item.claim_status,
    employmentStatus: item.employment_status,
  });
  const statusVisible = ['approved', 'pending', 'withdrawn'].includes(item.claim_status || '');
  const photoCount = Math.max(item.photo_files?.length || 0, item.photo_url ? 1 : 0);

  return (
    <aside className="dm-directory-detail" aria-label={`${item.dm_name}档案预览`}>
      <div className="dm-detail-scroll">
        <div className="dm-detail-hero">
          <img
            src={dossierPhotoUrl(item)}
            alt={`${item.dm_name}的档案照片`}
            style={{ objectPosition: `${item.photo_focus_x ?? 50}% ${item.photo_focus_y ?? 25}%` }}
          />
          <div className="dm-detail-photo-meta">
            <span>{statusVisible ? dmClaimLabel(item.claim_status) : '公开档案'}</span>
            <span>{photoCount > 0 ? `图集 ${photoCount} 张` : '暂无本人照片'}</span>
          </div>
          <button type="button" className="dm-detail-close" aria-label="关闭档案预览" onClick={onClose}>关闭</button>
        </div>

        <section className="dm-detail-intro">
          <div>
            <h2>{item.dm_name}</h2>
            <p>{item.city || '未知城市'} · {item.workplace || affiliationText}</p>
            <small>{summary?.review_count || 0} 次体验 · {summary?.player_count || 0} 位玩家</small>
          </div>
          <div className="dm-detail-score">
            <strong>{summary?.avg !== null && summary?.avg !== undefined ? summary.avg.toFixed(1) : '—'}</strong>
            <span>综合评分</span>
          </div>
        </section>

        <section className="dm-detail-section">
          <div className="dm-detail-section-heading">
            <h3>代表剧本</h3>
            <span>{scripts.length > 0 ? `共 ${scripts.length} 个` : '待补充'}</span>
          </div>
          {scripts.length > 0 ? (
            <div className="dm-detail-script-list">
              {scripts.slice(0, 4).map(script => <span key={script.id || script.name}>《{script.name}》</span>)}
            </div>
          ) : (
            <p className="dm-detail-empty">这份档案还没有补充代表剧本。</p>
          )}
        </section>

        <section className="dm-detail-section">
          <div className="dm-detail-section-heading">
            <h3>擅长特点</h3>
            <span>{displayTags.length > 0 ? `${displayTags.length} 项` : '待补充'}</span>
          </div>
          {displayTags.length > 0 ? (
            <div className="dm-detail-tags">
              {displayTags.slice(0, 8).map(tag => <span key={tag}>{tag}</span>)}
            </div>
          ) : (
            <p className="dm-detail-empty">暂时还没有形成稳定的玩家标签。</p>
          )}
        </section>

        <section className="dm-detail-section">
          <div className="dm-detail-section-heading">
            <h3>玩家评价摘要</h3>
            {ratingExcerpt && <strong>{Number(ratingExcerpt.rating || 0).toFixed(1)}</strong>}
          </div>
          <blockquote className="dm-detail-review">
            {loading ? '正在读取最近评价…' : ratingExcerpt?.content || item.note || '暂时还没有公开的文字评价。'}
          </blockquote>
          {ratingExcerpt?.script_name && <small className="dm-detail-review-source">来自《{ratingExcerpt.script_name}》的体验记录</small>}
        </section>
      </div>

      <div className="dm-detail-actions">
        <Link to={`/dm/${encodeURIComponent(item.id)}`} className="dm-detail-secondary-action">查看完整档案</Link>
        <Link to={`/dm/rate?dmId=${encodeURIComponent(item.id)}`} className="dm-detail-primary-action">去评分</Link>
        {item.claim_status !== 'approved' && item.claim_status !== 'pending' && item.claim_status !== 'withdrawn' && (
          <button type="button" className="dm-detail-text-action" onClick={onClaim}>本人认领</button>
        )}
        {item.profile_url && <SocialPlatformLink url={item.profile_url} />}
        {item.claim_status === 'approved' && item.claimed_by && <InternalProfileLink to={`/explore/${item.claimed_by}`} />}
      </div>
    </aside>
  );
}

function dossierPhotoUrl(item: DmDossier) {
  return item.photo_url || item.photo_files?.[0]?.url || generatedAvatarDataUrl(item.dm_name, item.id);
}

function ViewModeSwitch({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <div aria-label="展示方式" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', width: 152, height: 42, padding: 3, borderRadius: 8, border: '1px solid rgba(31,41,55,0.12)', background: '#f8fafc' }}>
      {([['cards', '列表'], ['graph', '关系图']] as const).map(([mode, label]) => (
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

function ChantoSortSwitch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{ height: 42, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 11px', borderRadius: 8, border: `1px solid ${checked ? 'rgba(166,106,31,0.38)' : 'rgba(31,41,55,0.12)'}`, background: checked ? 'rgba(255,248,235,0.96)' : '#fff', color: checked ? '#8a5417' : MUTED, fontSize: 12, fontWeight: 850, cursor: 'pointer', whiteSpace: 'nowrap' }}
    >
      <span aria-hidden="true" style={{ width: 30, height: 18, padding: 2, boxSizing: 'border-box', borderRadius: 9, background: checked ? GOLD : 'rgba(100,116,139,0.28)', display: 'flex', justifyContent: checked ? 'flex-end' : 'flex-start', transition: 'background 160ms ease' }}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.22)' }} />
      </span>
      缠头优先
    </button>
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
const formCard: React.CSSProperties = { ...jumuluCardStyle, padding: 16 };
const emptyStyle: React.CSSProperties = { padding: 28, borderRadius: 8, border: '1px dashed rgba(166,106,31,0.22)', background: '#fff', color: MUTED, textAlign: 'center', lineHeight: 1.8 };
