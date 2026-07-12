import { useEffect, useState } from 'react';
import type React from 'react';
import CitySearchSelect from './CitySearchSelect';
import DossierGalleryEditor from './DossierGalleryEditor';
import DossierInlineReferenceEditor from './DossierInlineReferenceEditor';
import DossierWikiFieldsEditor, { type DossierWikiDraft } from './DossierWikiFieldsEditor';
import ImageUpload from './ImageUpload';
import StoreSearchSelect from './StoreSearchSelect';
import {
  MAX_DOSSIER_PHOTOS,
  normalizeDossierCareerHistory,
  normalizeDossierNamedRefs,
  normalizeDossierPhotos,
  type DossierCareerEntry,
  type DossierFieldProvenance,
  type DossierNamedRef,
  type DossierPhoto,
} from '../lib/dossierWiki';

const API = '/api';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.72)';
const GOLD = '#a66a1f';

export type EditableDossier = {
  id: string;
  entityType: 'dm' | 'store';
  name: string;
  city?: string | null;
  workplace?: string | null;
  employmentStatus?: 'unknown' | 'store_affiliated' | 'freelance';
  employerStoreId?: string | null;
  profileUrl?: string | null;
  photoUrl?: string | null;
  photoFiles?: DossierPhoto[];
  note?: string | null;
  tags?: string[];
  claimedBy?: string | null;
  dmStartedMonth?: string | null;
  birthYear?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  mbti?: string | null;
  zodiac?: string | null;
  bio?: string | null;
  commonScripts?: DossierNamedRef[];
  careerHistory?: DossierCareerEntry[];
  relatedProfiles?: DossierNamedRef[];
  relatedStores?: DossierNamedRef[];
  fieldProvenance?: DossierFieldProvenance;
};

type StoreOption = { id: string; dm_name: string; city?: string | null };
type ScriptOption = { id: string; name: string };

type Props = {
  open: boolean;
  dossier: EditableDossier;
  token: string;
  currentUserId?: string | null;
  onClose: () => void;
  onSubmitted: (message: string) => void;
};

export default function DossierEditModal({ open, dossier, token, currentUserId, onClose, onSubmitted }: Props) {
  const [name, setName] = useState(dossier.name);
  const [city, setCity] = useState(dossier.city || '');
  const [workplace, setWorkplace] = useState(dossier.workplace || '');
  const [employmentStatus, setEmploymentStatus] = useState<'unknown' | 'store_affiliated' | 'freelance'>(dossier.employmentStatus || 'unknown');
  const [employerStoreId, setEmployerStoreId] = useState(dossier.employerStoreId || '');
  const [profileUrl, setProfileUrl] = useState(dossier.profileUrl || '');
  const [photoUrl, setPhotoUrl] = useState(dossier.photoUrl || '');
  const [photoFiles, setPhotoFiles] = useState<DossierPhoto[]>(() => normalizeDossierPhotos(dossier.photoFiles, dossier.photoUrl));
  const [tags, setTags] = useState(dossier.tags || []);
  const [editReason, setEditReason] = useState('');
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);
  const [scriptOptions, setScriptOptions] = useState<ScriptOption[]>([]);
  const [wikiDraft, setWikiDraft] = useState<DossierWikiDraft>({
    dmStartedMonth: dossier.dmStartedMonth?.slice(0, 7) || '',
    birthYear: dossier.birthYear ? String(dossier.birthYear) : '',
    heightCm: dossier.heightCm ? String(dossier.heightCm) : '',
    weightKg: dossier.weightKg ? String(dossier.weightKg) : '',
    mbti: dossier.mbti || '',
    zodiac: dossier.zodiac || '',
    bio: dossier.bio || '',
    commonScripts: normalizeDossierNamedRefs(dossier.commonScripts),
    careerHistory: normalizeDossierCareerHistory(dossier.careerHistory),
    relatedProfiles: normalizeDossierNamedRefs(dossier.relatedProfiles),
    relatedStores: normalizeDossierNamedRefs(dossier.relatedStores),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isOwner = Boolean(dossier.claimedBy && dossier.claimedBy === currentUserId);
  const provenance = dossier.fieldProvenance || {};
  const isLocked = (field: string) => !isOwner && provenance[field]?.source === 'owner';
  const fieldSource = (field: string) => provenance[field]?.source;
  const employmentLocked = ['employment_status', 'employer_store_id', 'workplace'].some(isLocked);
  const entityLabel = dossier.entityType === 'store' ? '店家' : 'DM';

  useEffect(() => {
    if (!open || dossier.entityType !== 'dm') return;
    const controller = new AbortController();
    Promise.all([
      fetch(`${API}/lc/dm-dossiers?entityType=store`, { signal: controller.signal }).then(response => response.json()),
      fetch(`${API}/lc/scripts`, { signal: controller.signal }).then(response => response.json()),
    ])
      .then(([storePayload, scriptPayload]) => {
        if (storePayload.success) setStoreOptions(storePayload.data || []);
        if (scriptPayload.success) setScriptOptions((scriptPayload.data || []).map((item: ScriptOption) => ({ id: item.id, name: item.name })));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [dossier.entityType, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open, submitting]);

  if (!open) return null;

  const submit = async () => {
    if (!token) {
      setError('请先登录后再提交修改');
      return;
    }
    if (dossier.entityType === 'dm') {
      if (!isOptionalIntegerInRange(wikiDraft.heightCm, 100, 250)) {
        setError('身高必须填写 100–250 之间的整数');
        return;
      }
      if (!isOptionalIntegerInRange(wikiDraft.weightKg, 30, 300)) {
        setError('体重必须填写 30–300 之间的整数');
        return;
      }
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${API}/lc/dossier-edits/${encodeURIComponent(dossier.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          city: city.trim(),
          workplace: workplace.trim(),
          employmentStatus: dossier.entityType === 'dm' ? employmentStatus : 'unknown',
          employerStoreId: dossier.entityType === 'dm' && employmentStatus === 'store_affiliated' ? employerStoreId : null,
          profileUrl: profileUrl.trim(),
          photoUrl: dossier.entityType === 'dm' ? photoFiles[0]?.url || '' : photoUrl.trim(),
          photoFiles: dossier.entityType === 'dm' ? photoFiles : undefined,
          tags,
          dmStartedMonth: dossier.entityType === 'dm' ? wikiDraft.dmStartedMonth || null : undefined,
          birthYear: dossier.entityType === 'dm' ? wikiDraft.birthYear || null : undefined,
          heightCm: dossier.entityType === 'dm' ? wikiDraft.heightCm || null : undefined,
          weightKg: dossier.entityType === 'dm' ? wikiDraft.weightKg || null : undefined,
          mbti: dossier.entityType === 'dm' ? wikiDraft.mbti || null : undefined,
          zodiac: dossier.entityType === 'dm' ? wikiDraft.zodiac || null : undefined,
          bio: dossier.entityType === 'dm' ? wikiDraft.bio.trim() : undefined,
          commonScripts: dossier.entityType === 'dm' ? wikiDraft.commonScripts : undefined,
          careerHistory: dossier.entityType === 'dm' ? wikiDraft.careerHistory : undefined,
          relatedProfiles: dossier.entityType === 'dm' ? wikiDraft.relatedProfiles : undefined,
          relatedStores: dossier.entityType === 'dm' ? wikiDraft.relatedStores : undefined,
          editReason: editReason.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '修改提交失败');
      onSubmitted(payload.data?.message || (payload.data?.owner_response_status === 'pending'
        ? '修改已提交，等待认领人处理。'
        : '修改已提交。'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '修改提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={overlayStyle} role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <section style={modalStyle} role="dialog" aria-modal="true" aria-labelledby="dossier-edit-title">
        <header style={headerStyle}>
          <div>
            <p style={kickerStyle}>{isOwner ? `编辑我的${entityLabel}档案` : `补充 / 纠正${entityLabel}资料`}</p>
            <h2 id="dossier-edit-title" style={{ margin: 0, fontSize: 19 }}>修改「{dossier.name}」</h2>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} style={closeStyle} aria-label="关闭修改窗口">×</button>
        </header>

        <div style={bodyStyle}>
          <details style={noticeDetailsStyle}>
            <summary style={noticeSummaryStyle}>审核与生效说明</summary>
            <p style={{ margin: '8px 0 0', color: MUTED, fontSize: 12, lineHeight: 1.65 }}>
              {isOwner
                ? '身高、体重、MBTI、星座直接更新；城市先更新后审核；自由填写内容审核通过后公开。'
                : dossier.claimedBy
                  ? '认领人3天内上线则由本人确认；确认后结构化资料按规则生效，自由填写内容仍由管理员审核。'
                  : dossier.entityType === 'dm'
                    ? '结构化资料可直接补充，城市后审核；自由填写内容仍由管理员审核。'
                    : '档案尚未认领，提交后由管理员审核。'}
            </p>
          </details>

          <div className="dossier-basic-grid" style={basicGridStyle}>
            <Field label={`${entityLabel}名称 *`} value={name} onChange={setName} disabled={isLocked('dm_name')} source={fieldSource('dm_name')} />
            <FieldShell label="城市 *" source={fieldSource('city')} locked={isLocked('city')}>
              <CitySearchSelect value={city} onChange={setCity} disabled={isLocked('city')} style={{ minHeight: 38 }} />
            </FieldShell>
            {dossier.entityType === 'dm' && <div style={{ marginTop: 8 }}>
              <span style={labelStyle}>任职状态</span>
              <div style={segmentStyle}>
                <button type="button" disabled={employmentLocked} onClick={() => setEmploymentStatus('store_affiliated')} style={employmentStatus === 'store_affiliated' ? activeSegmentStyle : segmentButtonStyle}>关联店家</button>
                <button type="button" disabled={employmentLocked} onClick={() => { setEmploymentStatus('freelance'); setEmployerStoreId(''); setWorkplace(''); }} style={employmentStatus === 'freelance' ? activeSegmentStyle : segmentButtonStyle}>自由DM</button>
              </div>
            </div>}
          </div>

          {dossier.entityType === 'store' ? (
            <Field label="地址 / 商圈 / 常驻位置 *" value={workplace} onChange={setWorkplace} disabled={isLocked('workplace')} source={fieldSource('workplace')} />
          ) : (
            <div style={{ marginTop: 8 }}>
              {employmentStatus === 'store_affiliated' && <StoreSearchSelect
                value={employerStoreId}
                disabled={employmentLocked}
                options={storeOptions.map(store => ({ id: store.id, name: store.dm_name, city: store.city }))}
                onChange={(nextId, store) => {
                  setEmployerStoreId(nextId);
                  setWorkplace(store?.name || '');
                  if (!city && store?.city) setCity(store.city);
                }}
              />}
              {employmentStatus === 'unknown' && <span style={{ color: MUTED, fontSize: 12 }}>任职信息未填写</span>}
            </div>
          )}

          <div style={{ maxWidth: 460 }}><Field label={dossier.entityType === 'store' ? '店铺主页链接' : '个人主页链接'} value={profileUrl} onChange={setProfileUrl} placeholder="可留空" disabled={isLocked('profile_url')} source={fieldSource('profile_url')} /></div>

          {dossier.entityType === 'dm' && (
            <>
              <div style={{ marginTop: 8 }}>
                <span style={labelStyle}>人物简介<SourceLabel source={fieldSource('bio')} /></span>
                <DossierInlineReferenceEditor
                  value={wikiDraft.bio}
                  onChange={bio => setWikiDraft(current => ({ ...current, bio }))}
                  relatedProfiles={wikiDraft.relatedProfiles}
                  relatedStores={wikiDraft.relatedStores}
                  tags={tags}
                  onRelatedProfilesChange={relatedProfiles => setWikiDraft(current => ({ ...current, relatedProfiles }))}
                  onRelatedStoresChange={relatedStores => setWikiDraft(current => ({ ...current, relatedStores }))}
                  onTagsChange={setTags}
                  disabled={isLocked('bio')}
                  tagsLocked={isLocked('tags')}
                  referencesLocked={isLocked('related_profiles') || isLocked('related_stores')}
                />
              </div>
              <div style={photoSummaryStyle}>
                {photoFiles[0] ? <img src={photoFiles[0].url} alt="当前封面" style={{ width: 58, height: 58, borderRadius: 7, objectFit: 'cover', objectPosition: `${photoFiles[0].focus_x ?? 50}% ${photoFiles[0].focus_y ?? 25}%` }} /> : <div style={emptyPhotoStyle}>暂无照片</div>}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ display: 'block', color: INK, fontSize: 13 }}>当前照片</strong>
                  <span style={{ color: MUTED, fontSize: 11 }}>{photoFiles.length} / {MAX_DOSSIER_PHOTOS} 张，第一张作为封面</span>
                </div>
                {!isLocked('photo_files') && photoFiles.length < MAX_DOSSIER_PHOTOS && <ImageUpload token={token} scope="dossier-edit" label="添加照片" variant="compact" onUploaded={url => setPhotoFiles(current => [...current, { url, name: `DM照片 ${current.length + 1}`, type: 'image/*', caption: null, focus_x: 50, focus_y: 25 }])} />}
              </div>
              {!isLocked('photo_files') && <details style={compactDetailsStyle}>
                <summary style={compactSummaryStyle}><span>更多照片</span><small style={summaryMetaStyle}>排序、说明、调整显示位置</small></summary>
                <div style={compactDetailsBodyStyle}><DossierGalleryEditor photos={photoFiles} token={token} onChange={setPhotoFiles} /></div>
              </details>}
              <DossierWikiFieldsEditor
                value={wikiDraft}
                onChange={setWikiDraft}
                scriptOptions={scriptOptions}
                storeOptions={storeOptions.map(store => ({ id: store.id, name: store.dm_name }))}
                fieldProvenance={provenance}
                isOwner={isOwner}
              />
            </>
          )}

          {dossier.entityType === 'store' && <div style={twoColumnStyle}>
            <Field label="公开照片链接" value={photoUrl} onChange={setPhotoUrl} placeholder="可留空" />
            <div style={{ alignSelf: 'end', paddingBottom: 1 }}><ImageUpload token={token} scope="dossier-edit" label="上传新照片" variant="compact" onUploaded={setPhotoUrl} /></div>
          </div>}

          <label style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            <span style={labelStyle}>修改依据 *</span>
            <textarea value={editReason} onChange={event => setEditReason(event.target.value.slice(0, 600))} rows={2} placeholder="资料来源和修改原因，至少6个字" style={{ ...inputStyle, minHeight: 60, padding: '8px 11px', resize: 'vertical' }} />
          </label>

          {error && <div style={errorStyle} role="alert">{error}</div>}
        </div>
        <footer style={footerStyle}>
          <button type="button" onClick={onClose} disabled={submitting} style={secondaryButtonStyle}>取消</button>
          <button type="button" onClick={submit} disabled={submitting} style={primaryButtonStyle}>{submitting ? '提交中...' : isOwner ? '保存修改' : '提交修改'}</button>
        </footer>
        <style>{`@media (max-width: 720px){.dossier-basic-grid{grid-template-columns:1fr 1fr!important}.dossier-basic-grid>div:first-child,.dossier-basic-grid>label:first-child{grid-column:1/-1}}@media (max-width: 480px){.dossier-basic-grid{grid-template-columns:1fr!important}.dossier-basic-grid>*{grid-column:auto!important}}`}</style>
      </section>
    </div>
  );
}

function isOptionalIntegerInRange(value: string, min: number, max: number) {
  if (!value) return true;
  if (!/^\d+$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

function Field({ label, value, onChange, placeholder, disabled = false, source }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; disabled?: boolean; source?: 'owner' | 'community' }) {
  return <label title={disabled ? '该字段由 DM 本人提供，其他用户不能修改' : undefined} style={{ display: 'block', marginTop: 8 }}><span style={labelStyle}>{label}<SourceLabel source={source} /></span><input value={value} disabled={disabled} onChange={event => onChange(event.target.value)} placeholder={placeholder} style={inputStyle} /></label>;
}

function FieldShell({ label, source, locked, children }: { label: string; source?: 'owner' | 'community'; locked?: boolean; children: React.ReactNode }) {
  return <div title={locked ? '该字段由 DM 本人提供，其他用户不能修改' : undefined} style={{ marginTop: 8 }}><span style={labelStyle}>{label}<SourceLabel source={source} /></span>{children}</div>;
}

function SourceLabel({ source }: { source?: 'owner' | 'community' }) {
  if (!source) return null;
  return <small style={{ marginLeft: 6, color: source === 'owner' ? '#8a5a19' : '#64748b', fontSize: 10, fontWeight: 750 }}>{source === 'owner' ? 'DM本人提供' : '社区提供'}</small>;
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1300, display: 'grid', placeItems: 'center', padding: 12, background: 'rgba(15,23,42,0.48)', backdropFilter: 'blur(3px)' };
const modalStyle: React.CSSProperties = { width: 'min(860px, 100%)', maxHeight: '94dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 8, border: '1px solid rgba(31,41,55,0.12)', background: '#fffdf8', color: INK, boxShadow: '0 24px 80px rgba(15,23,42,0.24)' };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 14, padding: '13px 15px 11px', borderBottom: '1px solid rgba(31,41,55,0.09)', background: '#fff' };
const kickerStyle: React.CSSProperties = { margin: '0 0 5px', color: GOLD, fontSize: 11, fontWeight: 900 };
const closeStyle: React.CSSProperties = { width: 32, height: 32, flex: '0 0 32px', display: 'grid', placeItems: 'center', padding: 0, borderRadius: 6, border: '1px solid rgba(31,41,55,0.12)', background: '#fff', color: '#475569', fontSize: 21, cursor: 'pointer' };
const bodyStyle: React.CSSProperties = { padding: '8px 15px 14px', overflow: 'auto' };
const twoColumnStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 12 };
const basicGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(210px, 1.35fr) minmax(150px, 0.75fr) minmax(190px, 0.9fr)', gap: 10, alignItems: 'end' };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 5, color: INK, fontSize: 12, fontWeight: 900 };
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', minHeight: 38, borderRadius: 7, border: '1px solid rgba(39,83,137,0.18)', background: '#fff', padding: '0 10px', color: INK, font: 'inherit', fontSize: 13 };
const segmentStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 };
const segmentButtonStyle: React.CSSProperties = { minHeight: 36, borderRadius: 7, border: '1px solid rgba(31,41,55,0.12)', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 850, cursor: 'pointer' };
const activeSegmentStyle: React.CSSProperties = { ...segmentButtonStyle, borderColor: 'rgba(166,106,31,0.4)', background: '#fff8e8', color: '#8a5a19' };
const errorStyle: React.CSSProperties = { marginTop: 12, padding: '9px 11px', borderRadius: 6, background: '#fef2f2', color: '#b91c1c', fontSize: 12, fontWeight: 800 };
const footerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 15px', borderTop: '1px solid rgba(31,41,55,0.09)', background: '#fff' };
const secondaryButtonStyle: React.CSSProperties = { minWidth: 96, minHeight: 38, borderRadius: 7, border: '1px solid rgba(31,41,55,0.14)', background: '#fff', color: '#475569', fontWeight: 900, cursor: 'pointer' };
const primaryButtonStyle: React.CSSProperties = { minWidth: 130, minHeight: 38, borderRadius: 7, border: `1px solid ${INK}`, background: INK, color: '#fff', fontWeight: 900, cursor: 'pointer' };
const noticeDetailsStyle: React.CSSProperties = { marginBottom: 2, padding: '7px 9px', borderRadius: 7, background: '#fff8e8', border: '1px solid rgba(166,106,31,0.15)' };
const noticeSummaryStyle: React.CSSProperties = { color: '#8a5a19', fontSize: 11, fontWeight: 850, cursor: 'pointer' };
const photoSummaryStyle: React.CSSProperties = { minHeight: 68, display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: 8, borderRadius: 7, border: '1px solid rgba(31,41,55,0.10)', background: '#fff' };
const emptyPhotoStyle: React.CSSProperties = { width: 58, height: 58, display: 'grid', placeItems: 'center', borderRadius: 7, background: '#f1f5f9', color: MUTED, fontSize: 10, textAlign: 'center' };
const compactDetailsStyle: React.CSSProperties = { marginTop: 8, border: '1px solid rgba(31,41,55,0.10)', borderRadius: 7, background: '#fff' };
const compactSummaryStyle: React.CSSProperties = { minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 12px', color: INK, fontSize: 13, fontWeight: 900, cursor: 'pointer' };
const summaryMetaStyle: React.CSSProperties = { color: MUTED, fontSize: 11, fontWeight: 750 };
const compactDetailsBodyStyle: React.CSSProperties = { padding: '0 12px 12px', borderTop: '1px solid rgba(31,41,55,0.07)' };
