import { useState } from 'react';
import type React from 'react';
import { MAX_DOSSIER_PHOTOS, type DossierPhoto } from '../lib/dossierWiki';
import ImageFocusPicker from './ImageFocusPicker';
import ImageUpload from './ImageUpload';

const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.72)';

type Props = {
  photos: DossierPhoto[];
  token: string;
  onChange: (photos: DossierPhoto[]) => void;
};

export default function DossierGalleryEditor({ photos, token, onChange }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeSelectedIndex = photos.length > 0 ? Math.min(selectedIndex, photos.length - 1) : 0;
  const selected = photos[safeSelectedIndex] || null;

  const updateSelected = (patch: Partial<DossierPhoto>) => {
    if (!selected) return;
    onChange(photos.map((photo, index) => index === safeSelectedIndex ? { ...photo, ...patch } : photo));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [photo] = next.splice(from, 1);
    next.splice(to, 0, photo);
    onChange(next);
    setSelectedIndex(to);
  };

  const remove = (index: number) => {
    onChange(photos.filter((_, photoIndex) => photoIndex !== index));
    setSelectedIndex(current => current > index ? current - 1 : Math.min(current, Math.max(0, photos.length - 2)));
  };

  return (
    <section style={{ paddingTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, color: INK, fontSize: 14 }}>照片图库</h3>
          <span style={{ color: MUTED, fontSize: 12 }}>{photos.length} / {MAX_DOSSIER_PHOTOS} 张</span>
        </div>
        {photos.length < MAX_DOSSIER_PHOTOS && (
          <ImageUpload
            token={token}
            scope="dossier-edit"
            label="添加照片"
            variant="compact"
            onUploaded={url => {
              const next = [...photos, { url, name: `DM照片 ${photos.length + 1}`, type: 'image/*', caption: null, focus_x: 50, focus_y: 25 }];
              onChange(next);
              setSelectedIndex(next.length - 1);
            }}
          />
        )}
      </div>

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8, marginTop: 10 }}>
          {photos.map((photo, index) => (
            <div key={`${photo.url}-${index}`} style={{ minWidth: 0 }}>
              <button
                type="button"
                onClick={() => setSelectedIndex(index)}
                aria-label={`编辑第${index + 1}张照片`}
                style={{ width: '100%', aspectRatio: '4 / 3', display: 'block', overflow: 'hidden', padding: 0, borderRadius: 7, border: index === safeSelectedIndex ? '2px solid #a66a1f' : '1px solid rgba(31,41,55,0.13)', background: '#fff', cursor: 'pointer' }}
              >
                <img src={photo.url} alt="" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', objectPosition: `${photo.focus_x ?? 50}% ${photo.focus_y ?? 25}%` }} />
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, marginTop: 4 }}>
                <ToolButton label="前移" disabled={index === 0} onClick={() => move(index, index - 1)}>↑</ToolButton>
                <ToolButton label={index === 0 ? '当前封面' : '设为封面'} disabled={index === 0} onClick={() => move(index, 0)}>封</ToolButton>
                <ToolButton label="删除" onClick={() => remove(index)}>×</ToolButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'minmax(220px, 0.9fr) minmax(240px, 1.1fr)', gap: 12, alignItems: 'start' }} className="dossier-gallery-editor-grid">
          <ImageFocusPicker
            src={selected.url}
            focusX={selected.focus_x ?? 50}
            focusY={selected.focus_y ?? 25}
            onChange={({ x, y }) => updateSelected({ focus_x: x, focus_y: y })}
          />
          <label style={{ display: 'grid', gap: 6, color: INK, fontSize: 12, fontWeight: 850 }}>
            图片说明
            <textarea
              value={selected.caption || ''}
              onChange={event => updateSelected({ caption: event.target.value.slice(0, 160) || null })}
              rows={4}
              placeholder="可选"
              style={{ boxSizing: 'border-box', width: '100%', minHeight: 94, padding: '9px 10px', borderRadius: 7, border: '1px solid rgba(31,41,55,0.14)', background: '#fff', color: INK, resize: 'vertical', font: 'inherit' }}
            />
          </label>
        </div>
      )}
      <style>{`@media (max-width: 620px) { .dossier-gallery-editor-grid { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

function ToolButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} style={{ minWidth: 0, height: 26, padding: 0, borderRadius: 5, border: '1px solid rgba(31,41,55,0.11)', background: '#fff', color: disabled ? '#cbd5e1' : '#475569', fontWeight: 900, cursor: disabled ? 'default' : 'pointer' }}>{children}</button>;
}
