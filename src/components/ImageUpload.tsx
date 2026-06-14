import { useId, useState, useRef } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';

const GOLD = '#d9a857';

interface Props {
  onUploaded: (url: string) => void;
  token: string;
  api?: string;
  scope?: string;
  label?: string;
  variant?: 'default' | 'compact';
  hidePreview?: boolean;
  className?: string;
  style?: CSSProperties;
}

export default function ImageUpload({
  onUploaded,
  token,
  api = '/api',
  scope = 'portfolio',
  label = '选择图片',
  variant = 'default',
  hidePreview = false,
  className,
  style,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState<string | null>(null);
  const [error, setError]         = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const isCompact = variant === 'compact';
  const idleBg = isCompact ? 'rgba(255,255,255,0.78)' : 'rgba(201,146,46,0.1)';
  const hoverBg = isCompact ? 'rgba(255,250,242,0.94)' : 'rgba(201,146,46,0.18)';
  const labelStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isCompact ? 5 : 8,
    minHeight: isCompact ? 28 : undefined,
    padding: isCompact ? '5px 9px' : '10px 20px',
    borderRadius: isCompact ? 999 : 10,
    cursor: 'pointer',
    background: idleBg,
    border: `1px solid ${isCompact ? 'rgba(201,146,46,0.22)' : 'rgba(201,146,46,0.3)'}`,
    color: isCompact ? '#925f18' : GOLD,
    fontSize: isCompact ? '0.72rem' : '0.875rem',
    fontWeight: isCompact ? 900 : 600,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('只支持图片文件'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('文件大小不能超过 10MB'); return; }
    setError('');
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('scope', scope);
      const r = await fetch(`${api}/lc/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      const d = await r.json();
      if (d.success) {
        onUploaded(d.data.url);
        setPreview(null);
        if (inputRef.current) inputRef.current.value = '';
      } else { setError(d.error || '上传失败'); }
    } catch { setError('网络错误，上传失败'); }
    finally { setUploading(false); }
  };

  return (
    <div className={className} style={style}>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} id={inputId} />
      <label htmlFor={inputId}
        style={labelStyle}
        onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
        onMouseLeave={e => (e.currentTarget.style.background = idleBg)}>
        <svg width={isCompact ? 13 : 16} height={isCompact ? 13 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {uploading ? '上传中...' : label}
      </label>
      {error && <p style={{ fontSize: '0.78rem', color: '#f87171', marginTop: 8 }}>{error}</p>}
      {preview && !hidePreview && (
        <div style={{ marginTop: 10, position: 'relative', display: 'inline-block' }}>
          <img src={preview} style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 10, display: 'block' }} alt="预览" />
          {uploading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,26,48,0.6)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 20, height: 20, border: '2px solid rgba(217,168,87,0.4)', borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
