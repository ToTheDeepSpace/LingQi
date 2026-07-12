import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import CitySearchSelect from './CitySearchSelect';
import DossierGalleryEditor from './DossierGalleryEditor';
import DossierWikiFieldsEditor, { type DossierWikiDraft } from './DossierWikiFieldsEditor';
import ImageUpload from './ImageUpload';
import {
  normalizeDossierCareerHistory,
  normalizeDossierNamedRefs,
  normalizeDossierPhotos,
  type DossierCareerEntry,
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
  const [note, setNote] = useState(dossier.note || '');
  const [tags, setTags] = useState((dossier.tags || []).join(' / '));
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

  const parsedTags = useMemo(() => tags.split(/[，,、/\n]/).map(value => value.trim()).filter(Boolean).slice(0, 10), [tags]);

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
          note: note.trim(),
          tags: parsedTags,
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
            <h2 id="dossier-edit-title" style={{ margin: 0, fontSize: 22 }}>修改「{dossier.name}」</h2>
            <p style={{ margin: '7px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.6 }}>
              {isOwner
                ? '身高、体重、MBTI、星座直接更新；城市先更新后审核；自由填写内容审核通过后公开。'
                : dossier.claimedBy
                  ? '认领人3天内上线则由本人确认；确认后受限字段按规则生效，自由填写内容仍由管理员审核。'
                  : dossier.entityType === 'dm'
                    ? '关联已有店家会作为“社区补充·未核验”立即展示，不需要证据；其他资料仍由管理员审核。'
                    : '档案尚未认领，提交后由管理员审核。'}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} style={closeStyle} aria-label="关闭修改窗口">×</button>
        </header>

        <div style={bodyStyle}>
          <div style={twoColumnStyle}>
            <Field label={`${entityLabel}名称 *`} value={name} onChange={setName} />
            <CitySearchSelect label="城市 *" value={city} onChange={setCity} />
          </div>

          {dossier.entityType === 'store' ? (
            <Field label="地址 / 商圈 / 常驻位置 *" value={workplace} onChange={setWorkplace} />
          ) : (
            <div style={{ marginTop: 14 }}>
              <span style={labelStyle}>受雇状态</span>
              <div style={segmentStyle}>
                <button type="button" onClick={() => setEmploymentStatus('store_affiliated')} style={employmentStatus === 'store_affiliated' ? activeSegmentStyle : segmentButtonStyle}>关联店家</button>
                <button type="button" onClick={() => { setEmploymentStatus('freelance'); setEmployerStoreId(''); setWorkplace(''); }} style={employmentStatus === 'freelance' ? activeSegmentStyle : segmentButtonStyle}>自由DM</button>
                <button type="button" onClick={() => { setEmploymentStatus('unknown'); setEmployerStoreId(''); }} style={employmentStatus === 'unknown' ? activeSegmentStyle : segmentButtonStyle}>待核验</button>
              </div>
              {employmentStatus === 'store_affiliated' && (
                <select value={employerStoreId} onChange={event => {
                  const nextId = event.target.value;
                  const store = storeOptions.find(item => item.id === nextId);
                  setEmployerStoreId(nextId);
                  setWorkplace(store?.dm_name || '');
                  if (!city && store?.city) setCity(store.city);
                }} style={inputStyle}>
                  <option value="">请选择已有店家档案</option>
                  {storeOptions.map(store => <option key={store.id} value={store.id}>{store.dm_name} · {store.city || '城市待补'}</option>)}
                </select>
              )}
              {employmentStatus === 'unknown' && <Field label="常驻店家 / 工作地点（待核验）" value={workplace} onChange={setWorkplace} />}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <Field label={dossier.entityType === 'store' ? '店铺主页链接' : '个人主页链接'} value={profileUrl} onChange={setProfileUrl} placeholder="可留空" />
            {dossier.entityType === 'store' && <div>
              <Field label="公开照片链接" value={photoUrl} onChange={setPhotoUrl} placeholder="可留空" />
              <ImageUpload token={token} scope="dossier-edit" label="上传新照片" variant="compact" onUploaded={setPhotoUrl} style={{ marginTop: 7 }} />
            </div>}
          </div>

          {dossier.entityType === 'dm' && (
            <>
              <DossierGalleryEditor photos={photoFiles} token={token} onChange={setPhotoFiles} />
              <DossierWikiFieldsEditor
                value={wikiDraft}
                onChange={setWikiDraft}
                scriptOptions={scriptOptions}
                storeOptions={storeOptions.map(store => ({ id: store.id, name: store.dm_name }))}
                sensitiveMode={isOwner ? 'owner' : dossier.claimedBy ? 'requires_consent' : 'unavailable'}
              />
            </>
          )}

          <label style={{ display: 'block', marginTop: 14 }}>
            <span style={labelStyle}>档案说明</span>
            <textarea value={note} onChange={event => setNote(event.target.value.slice(0, 600))} rows={3} style={{ ...inputStyle, minHeight: 86, padding: '10px 12px', resize: 'vertical' }} />
          </label>
          <Field label="标签" value={tags} onChange={setTags} placeholder="用逗号或斜杠分隔，最多10个" />
          <label style={{ display: 'block', marginTop: 14 }}>
            <span style={labelStyle}>修改依据 *</span>
            <textarea value={editReason} onChange={event => setEditReason(event.target.value.slice(0, 600))} rows={3} placeholder="请说明资料来自哪里、为什么需要修改，至少6个字" style={{ ...inputStyle, minHeight: 86, padding: '10px 12px', resize: 'vertical' }} />
          </label>

          {error && <div style={errorStyle} role="alert">{error}</div>}
        </div>
        <footer style={footerStyle}>
          <button type="button" onClick={onClose} disabled={submitting} style={secondaryButtonStyle}>取消</button>
          <button type="button" onClick={submit} disabled={submitting} style={primaryButtonStyle}>{submitting ? '提交中...' : isOwner ? '保存修改' : '提交修改'}</button>
        </footer>
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

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label style={{ display: 'block', marginTop: 14 }}><span style={labelStyle}>{label}</span><input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} style={inputStyle} /></label>;
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1300, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(15,23,42,0.48)', backdropFilter: 'blur(3px)' };
const modalStyle: React.CSSProperties = { width: 'min(940px, 100%)', maxHeight: '92dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 8, border: '1px solid rgba(31,41,55,0.12)', background: '#fffdf8', color: INK, boxShadow: '0 24px 80px rgba(15,23,42,0.24)' };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '18px 20px 15px', borderBottom: '1px solid rgba(31,41,55,0.09)', background: '#fff' };
const kickerStyle: React.CSSProperties = { margin: '0 0 5px', color: GOLD, fontSize: 11, fontWeight: 900 };
const closeStyle: React.CSSProperties = { width: 32, height: 32, flex: '0 0 32px', display: 'grid', placeItems: 'center', padding: 0, borderRadius: 6, border: '1px solid rgba(31,41,55,0.12)', background: '#fff', color: '#475569', fontSize: 21, cursor: 'pointer' };
const bodyStyle: React.CSSProperties = { padding: '4px 20px 18px', overflow: 'auto' };
const twoColumnStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 12 };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 7, color: INK, fontSize: 12, fontWeight: 900 };
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', minHeight: 40, borderRadius: 7, border: '1px solid rgba(39,83,137,0.18)', background: '#fff', padding: '0 11px', color: INK, font: 'inherit' };
const segmentStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7, marginBottom: 9 };
const segmentButtonStyle: React.CSSProperties = { minHeight: 36, borderRadius: 7, border: '1px solid rgba(31,41,55,0.12)', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 850, cursor: 'pointer' };
const activeSegmentStyle: React.CSSProperties = { ...segmentButtonStyle, borderColor: 'rgba(166,106,31,0.4)', background: '#fff8e8', color: '#8a5a19' };
const errorStyle: React.CSSProperties = { marginTop: 12, padding: '9px 11px', borderRadius: 6, background: '#fef2f2', color: '#b91c1c', fontSize: 12, fontWeight: 800 };
const footerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '12px 20px', borderTop: '1px solid rgba(31,41,55,0.09)', background: '#fff' };
const secondaryButtonStyle: React.CSSProperties = { minWidth: 96, minHeight: 38, borderRadius: 7, border: '1px solid rgba(31,41,55,0.14)', background: '#fff', color: '#475569', fontWeight: 900, cursor: 'pointer' };
const primaryButtonStyle: React.CSSProperties = { minWidth: 130, minHeight: 38, borderRadius: 7, border: `1px solid ${INK}`, background: INK, color: '#fff', fontWeight: 900, cursor: 'pointer' };
