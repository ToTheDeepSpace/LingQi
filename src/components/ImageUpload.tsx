import { useState, useRef } from 'react';

interface Props {
  onUploaded: (url: string) => void;
  token: string;
  api?: string;
}

export default function ImageUpload({ onUploaded, token, api = '/api' }: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const r = await fetch(`${api}/lc/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const d = await r.json();
      if (d.success) { onUploaded(d.data.url); setPreview(null); if (inputRef.current) inputRef.current.value = ''; }
      else setError(d.error || '上传失败');
    } catch { setError('网络错误，上传失败'); }
    finally { setUploading(false); }
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" id="image-upload-input" />
      <label htmlFor="image-upload-input"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold-50 text-gold-700 text-sm rounded-[0.75rem] hover:bg-gold-100 cursor-pointer border border-gold-200/60 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        {uploading ? '上传中...' : '选择图片'}
      </label>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      {preview && (
        <div className="mt-2 relative inline-block">
          <img src={preview} className="w-24 h-24 object-cover rounded-lg" alt="预览" />
          {uploading && (
            <div className="absolute inset-0 bg-ink-900/40 rounded-lg flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
