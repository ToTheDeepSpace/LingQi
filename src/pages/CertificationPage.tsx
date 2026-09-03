import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Certification } from '../types';
import { readStoredCreatorAuth } from '../lib/authSession';

const API = '/api';
const C = '#fffdf8';
const C2 = '#eef6ff';
const GOLD = '#d9a857';
const BLUE = '#3b82f6';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

type AuthSession = { token: string; id: string };
type CertificationType = 'realname' | 'dm' | 'shop';
type CertFile = { name: string; url: string; type?: string; size?: number; watermark?: string };

const REALNAME_WATERMARK_TEXT = '仅用于剧幕录实名认证';
const certTypeMeta: Record<CertificationType, {
  label: string;
  shortLabel: string;
  title: string;
  uploadLabel: string;
  descriptionLabel: string;
  placeholder: string;
  accent: string;
}> = {
  realname: {
    label: '实名认证',
    shortLabel: '实名',
    title: '实名认证',
    uploadLabel: '上传身份证照片',
    descriptionLabel: '补充说明（可选）',
    placeholder: '例如：用于剧幕录实名认证审核。前台只展示实名标识，不公开证件信息。',
    accent: GOLD,
  },
  dm: {
    label: 'DM 开本记录认证',
    shortLabel: 'DM',
    title: 'DM 开本记录认证',
    uploadLabel: '上传开本记录截图（可多张）',
    descriptionLabel: '开本说明（开本次数、剧本类型等）',
    placeholder: '例如：主持过 20+ 场剧本杀，擅长情感本、硬核推理...',
    accent: GOLD,
  },
  shop: {
    label: '店家营业执照认证',
    shortLabel: '店家',
    title: '店家营业执照认证',
    uploadLabel: '上传营业执照',
    descriptionLabel: '店铺说明（可选）',
    placeholder: '例如：XX剧本杀店，位于XX城市...',
    accent: BLUE,
  },
};

function getAuth(): AuthSession | null {
  const data = readStoredCreatorAuth();
  return data?.token && data.id ? { token: data.token, id: data.id } : null;
}

const card: React.CSSProperties = {
  backgroundColor: '#fffaf2',
  border: '1px solid rgba(201,146,46,0.22)',
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 14px 34px rgba(31,41,55,0.06)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid rgba(201,146,46,0.2)',
  backgroundColor: '#fff',
  color: INK,
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const STATUS_LABEL: Record<string, string> = {
  pending: '审核中',
  approved: '已通过',
  rejected: '已拒绝',
};

const STATUS_COLOR: Record<string, string> = {
  pending: '#fbbf24',
  approved: '#15803d',
  rejected: '#b91c1c',
};

function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败'));
    };
    image.src = url;
  });
}

async function addRealnameWatermark(file: File) {
  const image = await readImage(file);
  const maxSide = 2200;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('图片处理失败');

  ctx.drawImage(image, 0, 0, width, height);
  const fontSize = Math.max(24, Math.round(Math.min(width, height) / 16));
  const stepX = Math.max(280, fontSize * 12);
  const stepY = Math.max(140, fontSize * 5);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = 'rgba(185, 28, 28, 0.26)';
  for (let y = -height; y <= height; y += stepY) {
    for (let x = -width; x <= width; x += stepX) {
      ctx.fillText(REALNAME_WATERMARK_TEXT, x, y);
    }
  }
  ctx.restore();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('水印图片生成失败')), 'image/jpeg', 0.88);
  });
  const safeName = file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'identity';
  return new File([blob], `${safeName}-watermarked.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

export default function CertificationPage() {
  const navigate = useNavigate();
  const auth = useMemo(() => getAuth(), []);
  const [type, setType] = useState<CertificationType>('realname');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<CertFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [myCerts, setMyCerts] = useState<Certification[]>([]);
  const [certsLoading, setCertsLoading] = useState(true);

  const loadMyCerts = async () => {
    const current = getAuth();
    if (!current) return;
    setCertsLoading(true);
    try {
      const r = await fetch(`${API}/lc/certifications/my`, {
        headers: { Authorization: `Bearer ${current.token}` },
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.success) setMyCerts(d.data || []);
    } catch {
      // Keep the page usable if the record list cannot be loaded.
    } finally {
      setCertsLoading(false);
    }
  };

  useEffect(() => {
    if (!auth) {
      navigate('/login');
      return;
    }
    const timer = window.setTimeout(() => void loadMyCerts(), 0);
    return () => window.clearTimeout(timer);
  }, [auth, navigate]);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    const current = getAuth();
    if (!current) {
      navigate('/login');
      return;
    }
    setUploadError('');
    setUploading(true);

    const newFiles: CertFile[] = [];

    for (const file of selectedFiles) {
      if (!file.type.startsWith('image/')) {
        setUploadError('只支持图片文件');
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        setUploadError('文件大小不能超过 8MB');
        continue;
      }
      try {
        const uploadFile = type === 'realname' ? await addRealnameWatermark(file) : file;
        if (uploadFile.size > 8 * 1024 * 1024) {
          setUploadError('水印处理后的图片仍超过 8MB，请换一张更小的图片');
          continue;
        }
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('scope', type === 'realname' ? 'realname-certification' : 'certification-proof');
        const r = await fetch(`${API}/lc/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${current.token}` },
          body: formData,
        });
        const d = await r.json();
        if (!r.ok || !d.success) {
          const msg = typeof d.error === 'string' ? d.error : (d.error?.message || `${file.name} 上传失败`);
          throw new Error(msg);
        }
        newFiles.push({
          name: d.data?.name || uploadFile.name,
          url: d.data?.url,
          type: d.data?.type || uploadFile.type,
          size: d.data?.size || uploadFile.size,
          watermark: type === 'realname' ? REALNAME_WATERMARK_TEXT : undefined,
        });
      } catch (uploadErr) {
        setUploadError(uploadErr instanceof Error ? uploadErr.message : '部分文件上传失败');
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
    setUploading(false);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!auth) return;
    if (files.length === 0) {
      setSubmitError('请至少上传一张图片');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const r = await fetch(`${API}/lc/certifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ type, files, description }),
      });
      const d = await r.json();
      if (d.success) {
        setSubmitDone(true);
        setFiles([]);
        setDescription('');
        loadMyCerts();
      } else {
        setSubmitError(d.error || '提交失败');
      }
    } catch {
      setSubmitError('网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  const hasApproved: Record<CertificationType, boolean> = {
    realname: myCerts.some(c => c.type === 'realname' && c.status === 'approved'),
    dm: myCerts.some(c => c.type === 'dm' && c.status === 'approved'),
    shop: myCerts.some(c => c.type === 'shop' && c.status === 'approved'),
  };
  const currentMeta = certTypeMeta[type];

  if (!auth) return null;

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: INK }}>
      <div style={{
        background: `radial-gradient(circle at 18% 0%, rgba(59,130,246,0.12), transparent 40%), linear-gradient(135deg, ${C2}, #fffaf2)`,
        borderBottom: '1px solid rgba(201,146,46,0.2)',
        padding: '34px 20px 30px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ width: 48, height: 2, background: `linear-gradient(90deg, transparent, ${BLUE}, transparent)`, marginBottom: 14 }} />
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.4rem, 3vw, 2rem)', marginBottom: 8 }}>
            身份认证
          </h1>
          <p style={{ color: MUTED, fontSize: '0.95rem' }}>
            提交材料完成认证，获得官方标识
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div style={card}>
            <h3 style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 16, color: INK }}>
              选择认证类型
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 10 }}>
              {(Object.keys(certTypeMeta) as CertificationType[]).map(item => {
                const meta = certTypeMeta[item];
                const active = type === item;
                return (
                  <button key={item} onClick={() => { setType(item); setSubmitDone(false); setFiles([]); setUploadError(''); }}
                    style={{
                      padding: '14px', borderRadius: 12, border: active ? `2px solid ${meta.accent}` : '1px solid rgba(201,146,46,0.2)',
                      background: active ? (item === 'shop' ? 'rgba(59,130,246,0.12)' : 'rgba(201,146,46,0.12)') : '#fff',
                      color: active ? (item === 'shop' ? BLUE : '#925f18') : 'rgba(71,85,105,0.66)', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
                      transition: 'all 0.2s',
                    }}>
                    {item === 'realname' ? '⭐' : item === 'dm' ? '🎭' : '🏪'} {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {submitDone ? (
            <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>认证申请已提交</h3>
              <p style={{ color: MUTED, fontSize: '0.875rem', lineHeight: 1.7, marginBottom: 20 }}>
                管理员审核通过后，你的主页将显示认证标识。
              </p>
              <button onClick={() => setSubmitDone(false)}
                style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${GOLD}`, background: 'rgba(201,146,46,0.08)', color: GOLD, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                继续提交
              </button>
            </div>
          ) : type !== 'realname' ? (
            <div style={card}>
              <h3>{type === 'shop' ? '店家永久认证（暂行）· 90元' : 'DM本人认领 · 9元或店家认证码'}</h3>
              <p style={{ color: MUTED, lineHeight: 1.8 }}>
                {type === 'shop'
                  ? '请在剧幕录微信小程序找到店家档案，点击“经营者认证”，提交证明并支付90元。人工审核通过后获得11个一次性DM认证码；每90元可加购11个。'
                  : '请在剧幕录微信小程序的DM档案提交本人认领。支付9元或使用店家认证码免付，均需人工审核；用码通过后自动绑定发码店家。'}
              </p>
              <p style={{ color: MUTED }}>原身份认证入口已统一到档案认领，历史认证记录仍保留。</p>
            </div>
          ) : (
            <div style={card}>
              <h3 style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 16, color: INK }}>
                {currentMeta.title}
                {hasApproved[type] && (
                  <span style={{ marginLeft: 10, padding: '2px 10px', borderRadius: 999, fontSize: '0.75rem', background: 'rgba(240,253,244,0.9)', color: '#15803d', border: '1px solid rgba(34,197,94,0.22)', fontWeight: 500 }}>
                    已认证
                  </span>
                )}
              </h3>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'rgba(71,85,105,0.78)', marginBottom: 6 }}>
                  {currentMeta.uploadLabel}
                </label>
                {type === 'realname' && (
                  <p style={{ color: MUTED, fontSize: '0.78rem', lineHeight: 1.7, margin: '-2px 0 10px' }}>
                    选择身份证照片后，会先在本机浏览器内加上“{REALNAME_WATERMARK_TEXT}”水印，再上传审核；后台只看水印后的图片。
                  </p>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFiles}
                  disabled={uploading}
                  style={{ display: 'none' }}
                  id="cert-file-input"
                />
                <label htmlFor="cert-file-input"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(201,146,46,0.1)', border: `1px solid rgba(201,146,46,0.3)`,
                    color: GOLD, fontSize: '0.875rem', fontWeight: 600,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,146,46,0.18)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(201,146,46,0.1)')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {uploading ? '处理中...' : type === 'realname' ? '上传并加水印' : '上传图片'}
                </label>
                {uploadError && <p style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: 8 }}>{uploadError}</p>}
              </div>

              {files.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ position: 'relative', width: 88, height: 88, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(201,146,46,0.2)' }}>
                      <img src={f.url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => removeFile(i)}
                        style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(248,113,113,0.8)', color: '#fff', cursor: 'pointer', fontSize: '0.7rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'rgba(71,85,105,0.78)', marginBottom: 6 }}>
                  {currentMeta.descriptionLabel}
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={currentMeta.placeholder}
                  rows={4}
                  style={{ ...inputStyle, resize: 'none' }}
                />
              </div>

              {submitError && <p style={{ color: '#b91c1c', fontSize: '0.82rem', marginBottom: 12 }}>{submitError}</p>}

              <button onClick={submit} disabled={submitting || files.length === 0}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                  cursor: submitting || files.length === 0 ? 'not-allowed' : 'pointer',
                  background: submitting || files.length === 0 ? 'rgba(241,245,249,0.86)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                  color: submitting || files.length === 0 ? 'rgba(71,85,105,0.42)' : INK,
                  fontWeight: 700, fontSize: '0.9rem',
                }}>
                {submitting ? '提交中...' : '提交认证申请'}
              </button>
            </div>
          )}

          <div style={card}>
            <h3 style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 16, color: INK }}>
              我的认证记录
            </h3>
            {certsLoading ? (
              <p style={{ color: 'rgba(71,85,105,0.52)', fontSize: '0.875rem' }}>加载中...</p>
            ) : myCerts.length === 0 ? (
              <p style={{ color: 'rgba(71,85,105,0.52)', fontSize: '0.875rem' }}>暂无认证记录</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myCerts.map(cert => (
                  <div key={cert.id} style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: '1px solid rgba(201,146,46,0.15)',
                    background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: 10,
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', marginRight: 10 }}>
                        {cert.type === 'realname' ? '⭐ 实名认证' : cert.type === 'dm' ? '🎭 DM 认证' : '🏪 店家认证'}
                      </span>
                      <span style={{
                        padding: '2px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
                        background: `${STATUS_COLOR[cert.status]}15`,
                        color: STATUS_COLOR[cert.status],
                        border: `1px solid ${STATUS_COLOR[cert.status]}30`,
                      }}>
                        {STATUS_LABEL[cert.status]}
                      </span>
                      {cert.reject_reason && (
                        <p style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: 4 }}>拒绝原因：{cert.reject_reason}</p>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(71,85,105,0.5)' }}>
                      {cert.created_at?.slice(0, 10)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
