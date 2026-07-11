import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import {
  MAX_DOSSIER_CAREER_ENTRIES,
  MAX_DOSSIER_COMMON_SCRIPTS,
  MAX_DOSSIER_RELATED_ENTITIES,
  type DossierCareerEntry,
  type DossierNamedRef,
} from '../lib/dossierWiki';

const API = '/api';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.72)';

export type DossierWikiDraft = {
  dmStartedMonth: string;
  birthYear: string;
  heightCm: string;
  weightKg: string;
  bio: string;
  commonScripts: DossierNamedRef[];
  careerHistory: DossierCareerEntry[];
  relatedProfiles: DossierNamedRef[];
  relatedStores: DossierNamedRef[];
};

type Props = {
  value: DossierWikiDraft;
  onChange: (value: DossierWikiDraft) => void;
  scriptOptions: DossierNamedRef[];
  storeOptions: DossierNamedRef[];
  sensitiveMode: 'owner' | 'requires_consent' | 'unavailable';
};

type ProfileSearchResult = DossierNamedRef & { city?: string | null };

export default function DossierWikiFieldsEditor({ value, onChange, scriptOptions, storeOptions, sensitiveMode }: Props) {
  const [scriptId, setScriptId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [profileQuery, setProfileQuery] = useState('');
  const [profileResults, setProfileResults] = useState<ProfileSearchResult[]>([]);

  useEffect(() => {
    const query = profileQuery.trim();
    if (!query) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`${API}/lc/profiles/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(response => response.json())
        .then(payload => { if (payload.success) setProfileResults(payload.data || []); })
        .catch(() => undefined);
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [profileQuery]);

  const availableScripts = useMemo(() => scriptOptions.filter(option => !value.commonScripts.some(item => item.id === option.id)), [scriptOptions, value.commonScripts]);
  const availableStores = useMemo(() => storeOptions.filter(option => !value.relatedStores.some(item => item.id === option.id)), [storeOptions, value.relatedStores]);
  const update = (patch: Partial<DossierWikiDraft>) => onChange({ ...value, ...patch });

  const addCareer = () => {
    if (value.careerHistory.length >= MAX_DOSSIER_CAREER_ENTRIES) return;
    update({ careerHistory: [...value.careerHistory, { store_dossier_id: null, store_name: '', started_month: null, ended_month: null, role_title: null, note: null }] });
  };

  const updateCareer = (index: number, patch: Partial<DossierCareerEntry>) => {
    update({ careerHistory: value.careerHistory.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry) });
  };

  return (
    <>
      <section style={sectionStyle}>
        <h3 style={headingStyle}>百科资料</h3>
        <div style={fieldGridStyle}>
          <Field label="开始做 DM 的月份">
            <input type="month" value={value.dmStartedMonth} onChange={event => update({ dmStartedMonth: event.target.value })} style={inputStyle} />
          </Field>
          <Field label="出生年份">
            <input type="number" min={1900} max={new Date().getFullYear()} value={value.birthYear} onChange={event => update({ birthYear: event.target.value })} disabled={sensitiveMode === 'unavailable'} style={inputStyle} />
          </Field>
          <Field label="身高（cm）">
            <input type="number" min={100} max={250} value={value.heightCm} onChange={event => update({ heightCm: event.target.value })} disabled={sensitiveMode === 'unavailable'} style={inputStyle} />
          </Field>
          <Field label="体重（kg）">
            <input type="number" min={25} max={300} step="0.1" value={value.weightKg} onChange={event => update({ weightKg: event.target.value })} disabled={sensitiveMode === 'unavailable'} style={inputStyle} />
          </Field>
        </div>
        {sensitiveMode !== 'owner' && (
          <p style={{ margin: '8px 0 0', color: sensitiveMode === 'unavailable' ? MUTED : '#9a6700', fontSize: 12, lineHeight: 1.55 }}>
            {sensitiveMode === 'unavailable' ? '出生年份、身高和体重需由本人认领档案后填写。' : '出生年份、身高和体重只有 DM 本人明确同意后才会公开。'}
          </p>
        )}
        <Field label="人物简介">
          <textarea value={value.bio} onChange={event => update({ bio: event.target.value.slice(0, 3000) })} rows={5} style={{ ...inputStyle, minHeight: 118, resize: 'vertical' }} />
        </Field>
      </section>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>常开剧本</h3>
        <div style={addRowStyle}>
          <select value={scriptId} onChange={event => setScriptId(event.target.value)} style={inputStyle}>
            <option value="">从共用剧本库选择</option>
            {availableScripts.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
          <button type="button" disabled={!scriptId || value.commonScripts.length >= MAX_DOSSIER_COMMON_SCRIPTS} onClick={() => {
            const option = scriptOptions.find(item => item.id === scriptId);
            if (option) update({ commonScripts: [...value.commonScripts, option] });
            setScriptId('');
          }} style={addButtonStyle}>添加</button>
        </div>
        <ChipList values={value.commonScripts} onRemove={id => update({ commonScripts: value.commonScripts.filter(item => item.id !== id) })} />
      </section>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <h3 style={headingStyle}>任职履历</h3>
          <button type="button" onClick={addCareer} disabled={value.careerHistory.length >= MAX_DOSSIER_CAREER_ENTRIES} style={smallButtonStyle}>＋任职</button>
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {value.careerHistory.map((entry, index) => (
            <div key={`${entry.store_dossier_id || entry.store_name}-${index}`} style={{ paddingTop: 10, borderTop: '1px solid rgba(31,41,55,0.09)' }}>
              <div style={careerGridStyle}>
                <Field label="店家">
                  <select value={entry.store_dossier_id || ''} onChange={event => {
                    const option = storeOptions.find(item => item.id === event.target.value);
                    updateCareer(index, { store_dossier_id: option?.id || null, store_name: option?.name || '' });
                  }} style={inputStyle}>
                    <option value="">选择已收录店家</option>
                    {storeOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                </Field>
                <Field label="开始月份"><input type="month" value={entry.started_month || ''} onChange={event => updateCareer(index, { started_month: event.target.value || null })} style={inputStyle} /></Field>
                <Field label="结束月份"><input type="month" value={entry.ended_month || ''} onChange={event => updateCareer(index, { ended_month: event.target.value || null })} style={inputStyle} /></Field>
                <Field label="岗位 / 职责"><input value={entry.role_title || ''} onChange={event => updateCareer(index, { role_title: event.target.value.slice(0, 60) || null })} style={inputStyle} /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 34px', gap: 7, marginTop: 7 }}>
                <input value={entry.note || ''} onChange={event => updateCareer(index, { note: event.target.value.slice(0, 240) || null })} placeholder="履历备注（可选）" style={inputStyle} />
                <button type="button" title="删除任职" aria-label="删除任职" onClick={() => update({ careerHistory: value.careerHistory.filter((_, entryIndex) => entryIndex !== index) })} style={iconButtonStyle}>×</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>圈人 / 圈店</h3>
        <div style={fieldGridStyle}>
          <div style={{ position: 'relative' }}>
            <Field label="圈人">
              <input value={profileQuery} onChange={event => setProfileQuery(event.target.value)} placeholder="搜索公开用户名" style={inputStyle} />
            </Field>
            {profileQuery.trim() && profileResults.length > 0 && (
              <div style={resultListStyle}>
                {profileResults.filter(item => !value.relatedProfiles.some(ref => ref.id === item.id)).slice(0, 8).map(item => (
                  <button type="button" key={item.id} onClick={() => {
                    if (value.relatedProfiles.length < MAX_DOSSIER_RELATED_ENTITIES) update({ relatedProfiles: [...value.relatedProfiles, { id: item.id, name: item.name }] });
                    setProfileQuery('');
                    setProfileResults([]);
                  }} style={resultButtonStyle}><strong>{item.name}</strong><span>{item.city || '城市待补'}</span></button>
                ))}
              </div>
            )}
            <ChipList values={value.relatedProfiles} onRemove={id => update({ relatedProfiles: value.relatedProfiles.filter(item => item.id !== id) })} />
          </div>
          <div>
            <Field label="圈店">
              <div style={addRowStyle}>
                <select value={storeId} onChange={event => setStoreId(event.target.value)} style={inputStyle}>
                  <option value="">选择店家</option>
                  {availableStores.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
                <button type="button" disabled={!storeId || value.relatedStores.length >= MAX_DOSSIER_RELATED_ENTITIES} onClick={() => {
                  const option = storeOptions.find(item => item.id === storeId);
                  if (option) update({ relatedStores: [...value.relatedStores, option] });
                  setStoreId('');
                }} style={addButtonStyle}>添加</button>
              </div>
            </Field>
            <ChipList values={value.relatedStores} onRemove={id => update({ relatedStores: value.relatedStores.filter(item => item.id !== id) })} />
          </div>
        </div>
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: 6, marginTop: 10, color: INK, fontSize: 12, fontWeight: 850 }}>{label}{children}</label>;
}

function ChipList({ values, onRemove }: { values: DossierNamedRef[]; onRemove: (id: string) => void }) {
  if (values.length === 0) return null;
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{values.map(item => <span key={item.id} style={chipStyle}>{item.name}<button type="button" title={`移除${item.name}`} aria-label={`移除${item.name}`} onClick={() => onRemove(item.id)} style={chipRemoveStyle}>×</button></span>)}</div>;
}

const sectionStyle: React.CSSProperties = { marginTop: 16, paddingTop: 15, borderTop: '1px solid rgba(31,41,55,0.09)' };
const headingStyle: React.CSSProperties = { margin: 0, color: INK, fontSize: 14 };
const fieldGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 10 };
const careerGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 7 };
const addRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 7 };
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', minHeight: 38, padding: '8px 10px', borderRadius: 7, border: '1px solid rgba(31,41,55,0.14)', background: '#fff', color: INK, font: 'inherit' };
const addButtonStyle: React.CSSProperties = { minWidth: 68, minHeight: 38, borderRadius: 7, border: '1px solid rgba(31,41,55,0.14)', background: '#fff', color: INK, fontWeight: 900, cursor: 'pointer' };
const smallButtonStyle: React.CSSProperties = { minHeight: 30, padding: '0 9px', borderRadius: 6, border: '1px solid rgba(31,41,55,0.14)', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 900, cursor: 'pointer' };
const iconButtonStyle: React.CSSProperties = { width: 34, minHeight: 38, padding: 0, borderRadius: 7, border: '1px solid rgba(185,28,28,0.18)', background: '#fff', color: '#b91c1c', fontSize: 18, fontWeight: 900, cursor: 'pointer' };
const chipStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 27, padding: '0 5px 0 8px', borderRadius: 999, background: '#eff6ff', color: '#275389', fontSize: 12, fontWeight: 850 };
const chipRemoveStyle: React.CSSProperties = { width: 19, height: 19, display: 'grid', placeItems: 'center', padding: 0, border: 0, borderRadius: '50%', background: 'rgba(39,83,137,0.10)', color: '#275389', cursor: 'pointer' };
const resultListStyle: React.CSSProperties = { position: 'absolute', zIndex: 12, top: 69, left: 0, right: 0, maxHeight: 230, overflowY: 'auto', border: '1px solid rgba(31,41,55,0.14)', borderRadius: 7, background: '#fff', boxShadow: '0 12px 30px rgba(31,41,55,0.14)' };
const resultButtonStyle: React.CSSProperties = { width: '100%', minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', border: 0, borderBottom: '1px solid rgba(31,41,55,0.08)', background: '#fff', color: INK, textAlign: 'left', cursor: 'pointer' };
