import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Certification } from '../types';

const API = '/api';
const C = '#0F1117';
const C2 = '#1A1D27';
const GOLD = '#d9a857';
const BLUE = '#3b82f6';

type AuthSession = { token: string; id: string };

function getAuth(): AuthSession | null {
  try {
    const stored = localStorage.getItem('lc_creator');
    if (!stored) return null;
    const data = JSON.parse(stored);
    if (!data?.token) return null;
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) return null;
    return { token: data.token, id: payload.creatorId };
  } catch { return null; }
}

const card: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(201,146,46,0.18)',
  borderRadius: 16,
  padding: 24,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid rgba(201,146,46,0.2)',
  backgroundColor: 'rgba(255,255,255,0.05)',
  color: '#fff',
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
  approved: '#34d399',
  rejected: '#f87171',
};

export default function CertificationPage() {
  const navigate = useNavigate();
  const auth = useMemo(() => getAuth(), []);
  const [type, setType] = useState<'dm' | 'shop'>('dm');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
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
      const d = await r.json();
      if (d.success) setMyCerts(d.data || []);
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
    setUploadError('');
    setUploading(true);

    const newFiles: { name: string; url: string }[] = [];

    for (const file of selectedFiles) {
      if (!file.type.startsWith('image/')) {
        setUploadError('只支持图片文件');
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('文件大小不能超过 10MB');
        continue;
      }
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('读取失败'));
          reader.readAsDataURL(file);
        });
        newFiles.push({ name: file.name, url: dataUrl });
      } catch {
        setUploadError('部分文件读取失败');
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

  const hasApprovedDm = myCerts.some(c => c.type === 'dm' && c.status === 'approved');
  const hasApprovedShop = myCerts.some(c => c.type === 'shop' && c.status === 'approved');

  if (!auth) return null;

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: '#fff' }}>
      <div style={{
        background: `radial-gradient(circle at 18% 0%, rgba(59,130,246,0.15), transparent 40%), linear-gradient(135deg, ${C2}, #21262d)`,
        borderBottom: '1px solid rgba(201,146,46,0.12)',
        padding: '34px 20px 30px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ width: 48, height: 2, background: `linear-gradient(90deg, transparent, ${BLUE}, transparent)`, marginBottom: 14 }} />
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.4rem, 3vw, 2rem)', marginBottom: 8 }}>
            身份认证
          </h1>
          <p style={{ color: 'rgba(186,207,231,0.65)', fontSize: '0.95rem' }}>
            提交材料完成认证，获得官方标识
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div style={card}>
            <h3 style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 16, color: 'rgba(220,230,243,0.88)' }}>
              选择认证类型
            </h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setType('dm'); setSubmitDone(false); }}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12, border: type === 'dm' ? `2px solid ${GOLD}` : '1px solid rgba(201,146,46,0.2)',
                  background: type === 'dm' ? 'rgba(201,146,46,0.12)' : 'rgba(255,255,255,0.03)',
                  color: type === 'dm' ? GOLD : 'rgba(186,207,231,0.55)', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
                  transition: 'all 0.2s',
                }}>
                🎭 DM 开本记录认证
              </button>
              <button onClick={() => { setType('shop'); setSubmitDone(false); }}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12, border: type === 'shop' ? `2px solid ${BLUE}` : '1px solid rgba(201,146,46,0.2)',
                  background: type === 'shop' ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                  color: type === 'shop' ? BLUE : 'rgba(186,207,231,0.55)', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
                  transition: 'all 0.2s',
                }}>
                🏪 店家营业执照认证
              </button>
            </div>
          </div>

          {submitDone ? (
            <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>认证申请已提交</h3>
              <p style={{ color: 'rgba(186,207,231,0.65)', fontSize: '0.875rem', lineHeight: 1.7, marginBottom: 20 }}>
                管理员审核通过后，你的主页将显示认证标识。
              </p>
              <button onClick={() => setSubmitDone(false)}
                style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${GOLD}`, background: 'rgba(201,146,46,0.08)', color: GOLD, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                继续提交
              </button>
            </div>
          ) : (
            <div style={card}>
              <h3 style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 16, color: 'rgba(220,230,243,0.88)' }}>
                {type === 'dm' ? 'DM 开本记录认证' : '店家营业执照认证'}
                {type === 'dm' && hasApprovedDm && (
                  <span style={{ marginLeft: 10, padding: '2px 10px', borderRadius: 999, fontSize: '0.75rem', background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)', fontWeight: 500 }}>
                    已认证
                  </span>
                )}
                {type === 'shop' && hasApprovedShop && (
                  <span style={{ marginLeft: 10, padding: '2px 10px', borderRadius: 999, fontSize: '0.75rem', background: 'rgba(59,130,246,0.1)', color: BLUE, border: '1px solid rgba(59,130,246,0.2)', fontWeight: 500 }}>
                    已认证
                  </span>
                )}
              </h3>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(186,207,231,0.7)', marginBottom: 6 }}>
                  {type === 'dm' ? '上传开本记录截图（可多张）' : '上传营业执照'}
                </label>
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
                  {uploading ? '上传中...' : '上传图片'}
                </label>
                {uploadError && <p style={{ fontSize: '0.78rem', color: '#f87171', marginTop: 8 }}>{uploadError}</p>}
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
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(186,207,231,0.7)', marginBottom: 6 }}>
                  {type === 'dm' ? '开本说明（开本次数、剧本类型等）' : '店铺说明（可选）'}
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={type === 'dm' ? '例如：主持过 20+ 场剧本杀，擅长情感本、硬核推理...' : '例如：XX剧本杀店，位于XX城市...'}
                  rows={4}
                  style={{ ...inputStyle, resize: 'none' }}
                />
              </div>

              {submitError && <p style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: 12 }}>{submitError}</p>}

              <button onClick={submit} disabled={submitting || files.length === 0}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                  cursor: submitting || files.length === 0 ? 'not-allowed' : 'pointer',
                  background: submitting || files.length === 0 ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                  color: submitting || files.length === 0 ? 'rgba(186,207,231,0.4)' : C,
                  fontWeight: 700, fontSize: '0.9rem',
                }}>
                {submitting ? '提交中...' : '提交认证申请'}
              </button>
            </div>
          )}

          <div style={card}>
            <h3 style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 16, color: 'rgba(220,230,243,0.88)' }}>
              我的认证记录
            </h3>
            {certsLoading ? (
              <p style={{ color: 'rgba(186,207,231,0.45)', fontSize: '0.875rem' }}>加载中...</p>
            ) : myCerts.length === 0 ? (
              <p style={{ color: 'rgba(186,207,231,0.45)', fontSize: '0.875rem' }}>暂无认证记录</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myCerts.map(cert => (
                  <div key={cert.id} style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: '1px solid rgba(201,146,46,0.15)',
                    background: 'rgba(255,255,255,0.03)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: 10,
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', marginRight: 10 }}>
                        {cert.type === 'dm' ? '🎭 DM 认证' : '🏪 店家认证'}
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
                        <p style={{ fontSize: '0.78rem', color: '#f87171', marginTop: 4 }}>拒绝原因：{cert.reject_reason}</p>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(186,207,231,0.4)' }}>
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
