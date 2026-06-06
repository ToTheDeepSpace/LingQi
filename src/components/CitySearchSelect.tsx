import { useMemo, useState } from 'react';
import type React from 'react';
import { CITIES, CITY_OPTIONS } from '../constants/cities';

const GOLD = '#a66a1f';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.72)';

type CitySearchSelectProps = {
  value: string;
  onChange: (value: string) => void;
  allowAll?: boolean;
  allowCustom?: boolean;
  label?: string;
  placeholder?: string;
  style?: React.CSSProperties;
};

function normalizeCity(value: string) {
  return value.trim().replace(/\s+/g, '').replace(/(市|地区|盟|自治州|特别行政区)$/u, '');
}

function findExactCity(term: string) {
  const normalized = normalizeCity(term);
  if (!normalized) return '';
  return CITIES.find(city => city === term.trim() || normalizeCity(city) === normalized) || '';
}

export default function CitySearchSelect({
  value,
  onChange,
  allowAll = false,
  allowCustom = false,
  label,
  placeholder = '搜索城市，例如：保定、上海',
  style,
}: CitySearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const selectedLabel = value === 'all' ? '全部城市' : value;
  const inputValue = open ? draft : selectedLabel;
  const term = normalizeCity(draft);

  const options = useMemo(() => {
    const q = draft.trim();
    if (!term) return CITY_OPTIONS;
    return CITY_OPTIONS.filter(option => {
      const normalizedCity = normalizeCity(option.city);
      const normalizedGroup = normalizeCity(option.group);
      return (
        option.city.includes(q) ||
        option.group.includes(q) ||
        normalizedCity.includes(term) ||
        normalizedGroup.includes(term) ||
        term.includes(normalizedCity)
      );
    });
  }, [draft, term]);

  const exactCity = findExactCity(draft);
  const canUseCustom = allowCustom && !!draft.trim() && !exactCity;

  const choose = (next: string) => {
    onChange(next);
    setDraft('');
    setOpen(false);
  };

  const finishEditing = () => {
    const trimmed = draft.trim();
    if (!trimmed && allowAll) choose('all');
    else if (exactCity) choose(exactCity);
    else if (allowCustom && trimmed) choose(trimmed);
    else {
      setDraft('');
      setOpen(false);
    }
  };

  const control = (
    <div style={{ position: 'relative', minWidth: 0, ...style }}>
      <input
        value={inputValue}
        onFocus={() => {
          setDraft(value === 'all' ? '' : value);
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(finishEditing, 120)}
        onChange={event => {
          const next = event.target.value;
          setDraft(next);
          setOpen(true);
          const exact = findExactCity(next);
          if (exact) onChange(exact);
        }}
        placeholder={placeholder}
        style={inputStyle}
      />
      {open && (
        <div style={menuStyle}>
          {allowAll && (
            <button type="button" onMouseDown={event => { event.preventDefault(); choose('all'); }} style={optionStyle(value === 'all')}>
              全部城市
            </button>
          )}
          {options.length > 0 && (
            <div style={sectionLabelStyle}>
              {term ? `匹配城市 · ${options.length} 个` : `完整城市库 · ${options.length} 个`}
            </div>
          )}
          {options.map(option => (
            <button
              key={`${option.group}-${option.city}`}
              type="button"
              onMouseDown={event => { event.preventDefault(); choose(option.city); }}
              style={optionStyle(value === option.city)}
            >
              <span style={optionContentStyle}>
                <span>{option.city}</span>
                <span style={optionMetaStyle}>{option.group}</span>
              </span>
            </button>
          ))}
          {canUseCustom && (
            <button type="button" onMouseDown={event => { event.preventDefault(); choose(draft.trim()); }} style={customOptionStyle}>
              使用“{draft.trim()}”
            </button>
          )}
          {options.length === 0 && !canUseCustom && (
            <div style={{ padding: '10px 12px', color: MUTED, fontSize: 13 }}>没搜到这个城市</div>
          )}
        </div>
      )}
    </div>
  );

  if (!label) return control;

  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>{label}</span>
      {control}
    </label>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', color: MUTED, fontSize: 13, fontWeight: 800, marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid rgba(166,106,31,0.20)',
  background: '#fff',
  color: INK,
  outline: 'none',
  fontSize: 14,
};
const menuStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 40,
  left: 0,
  right: 0,
  top: 'calc(100% + 6px)',
  maxHeight: 320,
  overflowY: 'auto',
  display: 'grid',
  gap: 4,
  padding: 8,
  borderRadius: 12,
  border: '1px solid rgba(166,106,31,0.18)',
  background: '#fff',
  boxShadow: '0 16px 34px rgba(31,41,55,0.14)',
};
const sectionLabelStyle: React.CSSProperties = {
  padding: '4px 10px 6px',
  color: MUTED,
  fontSize: 12,
  fontWeight: 800,
};
const optionContentStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  minWidth: 0,
};
const optionMetaStyle: React.CSSProperties = {
  color: MUTED,
  fontSize: 12,
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const optionStyle = (active: boolean): React.CSSProperties => ({
  width: '100%',
  border: 'none',
  borderRadius: 8,
  background: active ? 'rgba(166,106,31,0.12)' : 'transparent',
  color: active ? GOLD : INK,
  padding: '8px 10px',
  textAlign: 'left',
  cursor: 'pointer',
  fontWeight: active ? 900 : 700,
});
const customOptionStyle: React.CSSProperties = {
  ...optionStyle(false),
  border: '1px dashed rgba(166,106,31,0.26)',
  color: GOLD,
  background: 'rgba(255,250,242,0.82)',
};
