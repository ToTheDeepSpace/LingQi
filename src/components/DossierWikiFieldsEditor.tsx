import { useMemo, useState } from 'react';
import type React from 'react';
import {
  MAX_DOSSIER_CAREER_ENTRIES,
  MAX_DOSSIER_COMMON_SCRIPTS,
  type DossierCareerEntry,
  type DossierFieldProvenance,
  type DossierNamedRef,
} from '../lib/dossierWiki';

const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.72)';
const MBTI_OPTIONS = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
];
const ZODIAC_OPTIONS = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'];

export type DossierWikiDraft = {
  dmStartedMonth: string;
  birthYear: string;
  heightCm: string;
  weightKg: string;
  mbti: string;
  zodiac: string;
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
  fieldProvenance?: DossierFieldProvenance;
  isOwner: boolean;
};

export default function DossierWikiFieldsEditor({ value, onChange, scriptOptions, storeOptions, fieldProvenance = {}, isOwner }: Props) {
  const [scriptId, setScriptId] = useState('');

  const availableScripts = useMemo(() => scriptOptions.filter(option => !value.commonScripts.some(item => item.id === option.id)), [scriptOptions, value.commonScripts]);
  const identityCount = [value.birthYear, value.heightCm, value.weightKg, value.mbti, value.zodiac].filter(Boolean).length;
  const careerCount = (value.dmStartedMonth ? 1 : 0) + value.commonScripts.length + value.careerHistory.length;
  const update = (patch: Partial<DossierWikiDraft>) => onChange({ ...value, ...patch });
  const locked = (field: string) => !isOwner && fieldProvenance[field]?.source === 'owner';
  const source = (field: string) => fieldProvenance[field]?.source;

  const addCareer = () => {
    if (value.careerHistory.length >= MAX_DOSSIER_CAREER_ENTRIES) return;
    update({ careerHistory: [...value.careerHistory, { store_dossier_id: null, store_name: '', started_month: null, ended_month: null, role_title: null, note: null }] });
  };

  const updateCareer = (index: number, patch: Partial<DossierCareerEntry>) => {
    update({ careerHistory: value.careerHistory.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry) });
  };

  const updateIntegerDraft = (field: 'heightCm' | 'weightKg', next: string) => {
    if (/^\d*$/.test(next)) update({ [field]: next });
  };

  return (
    <>
      <EditorDetails title="身体与性格" summary={identityCount > 0 ? `已填写 ${identityCount} 项` : '可选'}>
        <div style={fieldGridStyle}>
          <Field label="出生年份" source={source('birth_year')} locked={locked('birth_year')}>
            <input type="number" min={1900} max={new Date().getFullYear()} value={value.birthYear} onChange={event => update({ birthYear: event.target.value })} disabled={locked('birth_year')} style={inputStyle} />
          </Field>
          <Field label="身高（cm）" source={source('height_cm')} locked={locked('height_cm')}>
            <input type="number" min={100} max={250} step={1} inputMode="numeric" value={value.heightCm} onKeyDown={blockNonIntegerKey} onChange={event => updateIntegerDraft('heightCm', event.target.value)} disabled={locked('height_cm')} style={inputStyle} />
          </Field>
          <Field label="体重（kg）" source={source('weight_kg')} locked={locked('weight_kg')}>
            <input type="number" min={30} max={300} step={1} inputMode="numeric" value={value.weightKg} onKeyDown={blockNonIntegerKey} onChange={event => updateIntegerDraft('weightKg', event.target.value)} disabled={locked('weight_kg')} style={inputStyle} />
          </Field>
          <Field label="MBTI" source={source('mbti')} locked={locked('mbti')}>
            <select value={value.mbti} disabled={locked('mbti')} onChange={event => update({ mbti: event.target.value })} style={inputStyle}>
              <option value="">待补充</option>
              {MBTI_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
          <Field label="星座" source={source('zodiac')} locked={locked('zodiac')}>
            <select value={value.zodiac} disabled={locked('zodiac')} onChange={event => update({ zodiac: event.target.value })} style={inputStyle}>
              <option value="">待补充</option>
              {ZODIAC_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
        </div>
      </EditorDetails>

      <EditorDetails title="从业资料" summary={careerCount > 0 ? `已有 ${careerCount} 项` : '入行时间、常开剧本、履历'}>
        <div style={{ maxWidth: 240 }}>
          <Field label="开始做 DM 的月份" source={source('dm_started_month')} locked={locked('dm_started_month')}>
            <input type="month" value={value.dmStartedMonth} disabled={locked('dm_started_month')} onChange={event => update({ dmStartedMonth: event.target.value })} style={inputStyle} />
          </Field>
        </div>
        <h3 style={{ ...headingStyle, marginTop: 14 }}>常开剧本</h3>
        <div style={addRowStyle}>
          <select value={scriptId} disabled={locked('common_scripts')} onChange={event => setScriptId(event.target.value)} style={inputStyle}>
            <option value="">从共用剧本库选择</option>
            {availableScripts.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
          <button type="button" disabled={locked('common_scripts') || !scriptId || value.commonScripts.length >= MAX_DOSSIER_COMMON_SCRIPTS} onClick={() => {
            const option = scriptOptions.find(item => item.id === scriptId);
            if (option) update({ commonScripts: [...value.commonScripts, option] });
            setScriptId('');
          }} style={addButtonStyle}>添加</button>
        </div>
        <ChipList values={value.commonScripts} disabled={locked('common_scripts')} onRemove={id => update({ commonScripts: value.commonScripts.filter(item => item.id !== id) })} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(31,41,55,0.08)' }}>
          <h3 style={headingStyle}>任职履历</h3>
          <button type="button" onClick={addCareer} disabled={locked('career_history') || value.careerHistory.length >= MAX_DOSSIER_CAREER_ENTRIES} style={smallButtonStyle}>＋任职</button>
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {value.careerHistory.map((entry, index) => (
            <div key={`${entry.store_dossier_id || entry.store_name}-${index}`} style={{ paddingTop: 10, borderTop: '1px solid rgba(31,41,55,0.09)' }}>
              <div style={careerGridStyle}>
                <Field label="店家">
                  <select value={entry.store_dossier_id || ''} disabled={locked('career_history')} onChange={event => {
                    const option = storeOptions.find(item => item.id === event.target.value);
                    updateCareer(index, { store_dossier_id: option?.id || null, store_name: option?.name || '' });
                  }} style={inputStyle}>
                    <option value="">选择已收录店家</option>
                    {storeOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                </Field>
                <Field label="开始月份"><input type="month" value={entry.started_month || ''} disabled={locked('career_history')} onChange={event => updateCareer(index, { started_month: event.target.value || null })} style={inputStyle} /></Field>
                <Field label="结束月份"><input type="month" value={entry.ended_month || ''} disabled={locked('career_history')} onChange={event => updateCareer(index, { ended_month: event.target.value || null })} style={inputStyle} /></Field>
                <Field label="岗位 / 职责"><input value={entry.role_title || ''} disabled={locked('career_history')} onChange={event => updateCareer(index, { role_title: event.target.value.slice(0, 60) || null })} style={inputStyle} /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 34px', gap: 7, marginTop: 7 }}>
                <input value={entry.note || ''} disabled={locked('career_history')} onChange={event => updateCareer(index, { note: event.target.value.slice(0, 240) || null })} placeholder="履历备注（可选）" style={inputStyle} />
                <button type="button" disabled={locked('career_history')} title="删除任职" aria-label="删除任职" onClick={() => update({ careerHistory: value.careerHistory.filter((_, entryIndex) => entryIndex !== index) })} style={iconButtonStyle}>×</button>
              </div>
            </div>
          ))}
        </div>
      </EditorDetails>
    </>
  );

}

function EditorDetails({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return (
    <details style={detailsStyle}>
      <summary style={summaryStyle}>
        <span>{title}</span>
        <small style={{ color: MUTED, fontSize: 11, fontWeight: 750 }}>{summary}</small>
      </summary>
      <div style={detailsBodyStyle}>{children}</div>
    </details>
  );
}

function blockNonIntegerKey(event: React.KeyboardEvent<HTMLInputElement>) {
  if (['e', 'E', '+', '-', '.'].includes(event.key)) event.preventDefault();
}

function Field({ label, children, source, locked = false }: { label: string; children: React.ReactNode; source?: 'owner' | 'community'; locked?: boolean }) {
  return <label title={locked ? '该字段由 DM 本人提供，其他用户不能修改' : undefined} style={{ display: 'grid', gap: 5, marginTop: 8, color: INK, fontSize: 12, fontWeight: 850 }}><span>{label}{source && <small style={source === 'owner' ? ownerSourceStyle : communitySourceStyle}>{source === 'owner' ? 'DM本人提供' : '社区提供'}</small>}</span>{children}</label>;
}

function ChipList({ values, onRemove, disabled = false }: { values: DossierNamedRef[]; onRemove: (id: string) => void; disabled?: boolean }) {
  if (values.length === 0) return null;
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{values.map(item => <span key={item.id} style={chipStyle}>{item.name}{!disabled && <button type="button" title={`移除${item.name}`} aria-label={`移除${item.name}`} onClick={() => onRemove(item.id)} style={chipRemoveStyle}>×</button>}</span>)}</div>;
}

const headingStyle: React.CSSProperties = { margin: 0, color: INK, fontSize: 14 };
const fieldGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 118px), 1fr))', gap: 8 };
const careerGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 7 };
const addRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 7 };
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', minHeight: 38, padding: '8px 10px', borderRadius: 7, border: '1px solid rgba(31,41,55,0.14)', background: '#fff', color: INK, font: 'inherit' };
const addButtonStyle: React.CSSProperties = { minWidth: 68, minHeight: 38, borderRadius: 7, border: '1px solid rgba(31,41,55,0.14)', background: '#fff', color: INK, fontWeight: 900, cursor: 'pointer' };
const smallButtonStyle: React.CSSProperties = { minHeight: 30, padding: '0 9px', borderRadius: 6, border: '1px solid rgba(31,41,55,0.14)', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 900, cursor: 'pointer' };
const iconButtonStyle: React.CSSProperties = { width: 34, minHeight: 38, padding: 0, borderRadius: 7, border: '1px solid rgba(185,28,28,0.18)', background: '#fff', color: '#b91c1c', fontSize: 18, fontWeight: 900, cursor: 'pointer' };
const chipStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 27, padding: '0 5px 0 8px', borderRadius: 999, background: '#eff6ff', color: '#275389', fontSize: 12, fontWeight: 850 };
const chipRemoveStyle: React.CSSProperties = { width: 19, height: 19, display: 'grid', placeItems: 'center', padding: 0, border: 0, borderRadius: '50%', background: 'rgba(39,83,137,0.10)', color: '#275389', cursor: 'pointer' };
const detailsStyle: React.CSSProperties = { marginTop: 8, border: '1px solid rgba(31,41,55,0.10)', borderRadius: 7, background: '#fff' };
const summaryStyle: React.CSSProperties = { minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 12px', color: INK, fontSize: 13, fontWeight: 900, cursor: 'pointer' };
const detailsBodyStyle: React.CSSProperties = { padding: '2px 12px 13px', borderTop: '1px solid rgba(31,41,55,0.07)' };
const ownerSourceStyle: React.CSSProperties = { marginLeft: 6, color: '#8a5a19', fontSize: 10, fontWeight: 800 };
const communitySourceStyle: React.CSSProperties = { marginLeft: 6, color: '#64748b', fontSize: 10, fontWeight: 750 };
