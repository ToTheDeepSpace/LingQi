import { useMemo, useState } from 'react';
import type React from 'react';

export type StoreSearchOption = {
  id: string;
  name: string;
  city?: string | null;
  workplace?: string | null;
};

type Props = {
  label?: string;
  value: string;
  options: StoreSearchOption[];
  onChange: (id: string, option: StoreSearchOption | null) => void;
  placeholder?: string;
  excludedIds?: string[];
  disabled?: boolean;
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[\s·・•.\-_—]/g, '');
}

export default function StoreSearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder = '输入店家名称或城市搜索',
  excludedIds = [],
  disabled = false,
}: Props) {
  const selected = options.find(option => option.id === value) || null;
  const [query, setQuery] = useState(selected?.name || '');
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const excluded = new Set(excludedIds);
    const needle = normalize(query);
    return options
      .filter(option => !excluded.has(option.id) || option.id === value)
      .map(option => {
        const name = normalize(option.name);
        const haystack = normalize(`${option.name}${option.city || ''}${option.workplace || ''}`);
        const score = !needle ? 3 : name === needle ? 0 : name.startsWith(needle) ? 1 : haystack.includes(needle) ? 2 : 99;
        return { option, score };
      })
      .filter(item => item.score < 99)
      .sort((left, right) => left.score - right.score || left.option.name.localeCompare(right.option.name, 'zh-CN'))
      .slice(0, 12)
      .map(item => item.option);
  }, [excludedIds, options, query, value]);

  return (
    <label style={wrapperStyle}>
      {label && <span style={labelStyle}>{label}</span>}
      <div style={{ position: 'relative' }}>
        <div style={inputShellStyle}>
          <span aria-hidden="true" style={{ color: '#94a3b8', fontSize: 15 }}>⌕</span>
          <input
            value={open ? query : selected?.name || ''}
            disabled={disabled}
            autoComplete="off"
            placeholder={placeholder}
            onFocus={() => { setQuery(selected?.name || ''); setOpen(true); }}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onChange={event => {
              setQuery(event.target.value);
              if (value) onChange('', null);
              setOpen(true);
            }}
            style={inputStyle}
          />
          {(value || (open && query)) && !disabled && (
            <button type="button" title="清空店家" aria-label="清空店家" onMouseDown={event => event.preventDefault()} onClick={() => { setQuery(''); onChange('', null); setOpen(true); }} style={clearButtonStyle}>×</button>
          )}
        </div>
        {open && !disabled && (
          <div style={resultsStyle}>
            {matches.length > 0 ? matches.map(option => (
              <button
                key={option.id}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => { onChange(option.id, option); setQuery(option.name); setOpen(false); }}
                style={{ ...resultButtonStyle, background: option.id === value ? '#fff8e8' : '#fff' }}
              >
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{option.name}</strong>
                  {option.workplace && <small style={resultMetaStyle}>{option.workplace}</small>}
                </span>
                <span style={{ ...resultMetaStyle, flex: '0 0 auto' }}>{option.city || '城市待补'}</span>
              </button>
            )) : <span style={{ padding: '11px 12px', color: '#64748b', fontSize: 13 }}>没有找到已收录店家</span>}
          </div>
        )}
      </div>
      {selected && <span style={selectedStyle}>已选择：{selected.name}{selected.city ? ` · ${selected.city}` : ''}</span>}
    </label>
  );
}

const wrapperStyle: React.CSSProperties = { display: 'grid', gap: 5, minWidth: 0 };
const labelStyle: React.CSSProperties = { color: 'rgba(71,85,105,0.78)', fontSize: 12, fontWeight: 850 };
const inputShellStyle: React.CSSProperties = { minHeight: 38, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px 0 10px', border: '1px solid rgba(31,41,55,0.14)', borderRadius: 7, background: '#fff' };
const inputStyle: React.CSSProperties = { minWidth: 0, flex: 1, height: 36, padding: 0, border: 0, outline: 0, background: 'transparent', color: '#1f2937', font: 'inherit', fontSize: 13 };
const clearButtonStyle: React.CSSProperties = { width: 24, height: 24, display: 'grid', placeItems: 'center', padding: 0, border: 0, borderRadius: 5, background: '#f1f5f9', color: '#64748b', fontSize: 16, cursor: 'pointer' };
const resultsStyle: React.CSSProperties = { position: 'absolute', zIndex: 40, top: 'calc(100% + 4px)', left: 0, right: 0, display: 'grid', maxHeight: 270, overflowY: 'auto', border: '1px solid rgba(31,41,55,0.14)', borderRadius: 7, background: '#fff', boxShadow: '0 14px 34px rgba(31,41,55,0.16)' };
const resultButtonStyle: React.CSSProperties = { minWidth: 0, minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 11px', border: 0, borderBottom: '1px solid rgba(31,41,55,0.07)', color: '#1f2937', textAlign: 'left', cursor: 'pointer' };
const resultMetaStyle: React.CSSProperties = { display: 'block', marginTop: 2, color: '#64748b', fontSize: 11, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const selectedStyle: React.CSSProperties = { color: '#8a5a19', fontSize: 11, fontWeight: 800 };
