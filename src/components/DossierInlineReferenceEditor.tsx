import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { DossierNamedRef } from '../lib/dossierWiki';

const API = '/api';

type ReferenceResult = DossierNamedRef & {
  type: 'profile' | 'dm' | 'store';
  city?: string | null;
};

type Trigger = { type: '@' | '#'; query: string; start: number; end: number };

type Props = {
  value: string;
  onChange: (value: string) => void;
  relatedProfiles: DossierNamedRef[];
  relatedStores: DossierNamedRef[];
  tags: string[];
  onRelatedProfilesChange: (value: DossierNamedRef[]) => void;
  onRelatedStoresChange: (value: DossierNamedRef[]) => void;
  onTagsChange: (value: string[]) => void;
  disabled?: boolean;
  tagsLocked?: boolean;
  referencesLocked?: boolean;
};

function activeTrigger(value: string, caret: number): Trigger | null {
  const beforeCaret = value.slice(0, caret);
  const match = beforeCaret.match(/([@#])([^@#\s]*)$/u);
  if (!match || match.index === undefined) return null;
  return { type: match[1] as '@' | '#', query: match[2], start: match.index, end: caret };
}

export default function DossierInlineReferenceEditor({
  value,
  onChange,
  relatedProfiles,
  relatedStores,
  tags,
  onRelatedProfilesChange,
  onRelatedStoresChange,
  onTagsChange,
  disabled = false,
  tagsLocked = false,
  referencesLocked = false,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [entities, setEntities] = useState<ReferenceResult[]>([]);
  const [tagResults, setTagResults] = useState<string[]>([]);
  const triggerType = trigger?.type;
  const triggerQuery = trigger?.query || '';

  useEffect(() => {
    if (!triggerType) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`${API}/lc/dossier-references/search?q=${encodeURIComponent(triggerQuery)}`, { signal: controller.signal })
        .then(response => response.json())
        .then(payload => {
          if (!payload.success) return;
          setEntities(payload.data?.entities || []);
          setTagResults(payload.data?.tags || []);
        })
        .catch(() => undefined);
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [triggerQuery, triggerType]);

  const refreshTrigger = (nextValue: string, caret: number) => setTrigger(activeTrigger(nextValue, caret));

  const insertText = (text: string) => {
    if (!trigger) return;
    const nextValue = `${value.slice(0, trigger.start)}${text} ${value.slice(trigger.end)}`;
    const nextCaret = trigger.start + text.length + 1;
    onChange(nextValue);
    setTrigger(null);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const selectEntity = (entity: ReferenceResult) => {
    const reference = { id: entity.id, name: entity.name, type: entity.type } satisfies DossierNamedRef;
    if (entity.type === 'store') {
      onRelatedStoresChange([...relatedStores.filter(item => item.id !== entity.id), reference].slice(0, 12));
    } else {
      onRelatedProfilesChange([...relatedProfiles.filter(item => item.id !== entity.id), reference].slice(0, 12));
    }
    insertText(`@${entity.name}`);
  };

  const selectTag = (tag: string) => {
    if (!tagsLocked) onTagsChange(Array.from(new Set([...tags, tag])).slice(0, 10));
    insertText(`#${tag}`);
  };

  const removeReference = (reference: DossierNamedRef) => {
    const token = `@${reference.name}`;
    onChange(value.replace(token, '').replace(/ {2,}/g, ' ').trim());
    if (reference.type === 'store') onRelatedStoresChange(relatedStores.filter(item => item.id !== reference.id));
    else onRelatedProfilesChange(relatedProfiles.filter(item => item.id !== reference.id));
  };

  const removeTag = (tag: string) => {
    onChange(value.replace(`#${tag}`, '').replace(/ {2,}/g, ' ').trim());
    onTagsChange(tags.filter(item => item !== tag));
  };

  const visibleEntities = trigger?.type === '@' && !referencesLocked ? entities : [];
  const visibleTags = trigger?.type === '#' && !tagsLocked
    ? (trigger.query && !tagResults.some(tag => tag.toLowerCase() === trigger.query.toLowerCase())
        ? [trigger.query, ...tagResults]
        : tagResults)
    : [];

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        rows={4}
        placeholder="人物经历、风格、常开内容"
        onBlur={() => window.setTimeout(() => setTrigger(null), 140)}
        onClick={event => refreshTrigger(event.currentTarget.value, event.currentTarget.selectionStart)}
        onKeyUp={event => refreshTrigger(event.currentTarget.value, event.currentTarget.selectionStart)}
        onChange={event => {
          const nextValue = event.target.value.slice(0, 3000);
          onChange(nextValue);
          refreshTrigger(nextValue, event.target.selectionStart);
        }}
        style={textareaStyle}
      />
      {trigger && (visibleEntities.length > 0 || visibleTags.length > 0) && (
        <div style={menuStyle}>
          {visibleEntities.map(entity => (
            <button type="button" key={`${entity.type}-${entity.id}`} onMouseDown={event => event.preventDefault()} onClick={() => selectEntity(entity)} style={optionStyle}>
              <span><strong>@{entity.name}</strong>{entity.city && <small style={metaStyle}>{entity.city}</small>}</span>
              <small style={kindStyle}>{entity.type === 'store' ? '店家' : entity.type === 'dm' ? 'DM' : '用户'}</small>
            </button>
          ))}
          {visibleTags.map(tag => (
            <button type="button" key={tag} onMouseDown={event => event.preventDefault()} onClick={() => selectTag(tag)} style={optionStyle}>
              <strong>#{tag}</strong><small style={kindStyle}>{tagResults.includes(tag) ? '已有标签' : '新标签'}</small>
            </button>
          ))}
        </div>
      )}
      {(relatedProfiles.length > 0 || relatedStores.length > 0 || tags.length > 0) && (
        <div style={referenceRowStyle}>
          {[...relatedProfiles, ...relatedStores].map(reference => (
            <span key={`${reference.type || 'profile'}-${reference.id}`} style={referenceChipStyle}>@{reference.name}{!disabled && !referencesLocked && <button type="button" title={`移除@${reference.name}`} onClick={() => removeReference(reference)} style={removeStyle}>×</button>}</span>
          ))}
          {tags.map(tag => <span key={tag} style={tagChipStyle}>#{tag}{!disabled && !tagsLocked && <button type="button" title={`移除#${tag}`} onClick={() => removeTag(tag)} style={removeStyle}>×</button>}</span>)}
        </div>
      )}
    </div>
  );
}

const textareaStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', minHeight: 92, padding: '9px 11px', resize: 'vertical', borderRadius: 7, border: '1px solid rgba(39,83,137,0.18)', background: '#fff', color: '#1f2937', font: 'inherit', fontSize: 13, lineHeight: 1.65 };
const menuStyle: React.CSSProperties = { position: 'absolute', zIndex: 30, left: 0, right: 0, top: 'calc(100% - 2px)', maxHeight: 250, overflowY: 'auto', border: '1px solid rgba(31,41,55,0.14)', borderRadius: 7, background: '#fff', boxShadow: '0 14px 34px rgba(31,41,55,0.16)' };
const optionStyle: React.CSSProperties = { width: '100%', minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 11px', border: 0, borderBottom: '1px solid rgba(31,41,55,0.07)', background: '#fff', color: '#1f2937', textAlign: 'left', cursor: 'pointer' };
const metaStyle: React.CSSProperties = { marginLeft: 7, color: '#64748b', fontSize: 11, fontWeight: 650 };
const kindStyle: React.CSSProperties = { flex: '0 0 auto', color: '#8a5a19', fontSize: 10, fontWeight: 800 };
const referenceRowStyle: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 };
const referenceChipStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 25, padding: '0 5px 0 8px', borderRadius: 999, background: '#eff6ff', color: '#275389', fontSize: 11, fontWeight: 800 };
const tagChipStyle: React.CSSProperties = { ...referenceChipStyle, background: '#fff8e8', color: '#8a5a19' };
const removeStyle: React.CSSProperties = { width: 18, height: 18, display: 'grid', placeItems: 'center', padding: 0, border: 0, borderRadius: '50%', background: 'rgba(31,41,55,0.08)', color: 'currentColor', cursor: 'pointer' };
