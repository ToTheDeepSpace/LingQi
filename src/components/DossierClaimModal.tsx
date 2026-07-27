import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_IMAGE_UPLOAD_BYTES, MAX_MULTIPART_UPLOAD_BYTES, totalFileBytes } from '../lib/uploadLimits';

const API = '/api';
const MAX_PROOF_FILES = 3;

type EntityType = 'dm' | 'store';
type ProofType = 'social_account' | 'employment' | 'business_license' | 'store_backend' | 'other';

type ClaimHistory = {
  id: string;
  proof_type: ProofType;
  claim_note: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reject_reason?: string | null;
  created_at: string;
  reviewed_at?: string | null;
};

type ClaimState = {
  claim: ClaimHistory | null;
  payment: {
    paid?: boolean;
    amount_yuan?: string;
  };
};

type Props = {
  open: boolean;
  dossier: { id: string; name: string; entityType: EntityType } | null;
  token: string;
  displayName: string;
  onClose: () => void;
  onSubmitted: () => void;
};

type OpenProps = Omit<Props, 'open' | 'dossier'> & { dossier: NonNullable<Props['dossier']> };
type SelectedProofFile = { file: File; previewUrl: string };

const PROOF_OPTIONS: Record<EntityType, Array<{ value: ProofType; label: string; helper: string }>> = {
  dm: [
    { value: 'social_account', label: '社交账号后台', helper: '能看到账号名称或管理界面的截图' },
    { value: 'employment', label: '任职 / 排班证明', helper: '店家排班、员工信息或工作群相关截图' },
    { value: 'other', label: '其他证明', helper: '能够说明你是档案本人的其他材料' },
  ],
  store: [
    { value: 'business_license', label: '营业执照 / 主体资料', helper: '可遮住证件号、住址等无关敏感信息' },
    { value: 'store_backend', label: '店铺平台后台', helper: '大众点评、抖音、小红书等店铺管理页截图' },
    { value: 'other', label: '其他证明', helper: '能够说明你是店家负责人或运营者的材料' },
  ],
};

function errorMessage(value: unknown, fallback: string) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'message' in value && typeof value.message === 'string') return value.message;
  return fallback;
}

export default function DossierClaimModal(props: Props) {
  if (!props.open || !props.dossier) return null;
  return (
    <DossierClaimDialog
      key={props.dossier.id}
      dossier={props.dossier}
      token={props.token}
      displayName={props.displayName}
      onClose={props.onClose}
      onSubmitted={props.onSubmitted}
    />
  );
}

function DossierClaimDialog({ dossier, token, displayName, onClose, onSubmitted }: OpenProps) {
  const dossierId = dossier.id;
  const dossierName = dossier.name;
  const entityType = dossier.entityType;
  const options = useMemo(() => PROOF_OPTIONS[entityType], [entityType]);
  const [proofType, setProofType] = useState<ProofType>(options[0].value);
  const [claimNote, setClaimNote] = useState('');
  const [files, setFiles] = useState<SelectedProofFile[]>([]);
  const [truthConfirmed, setTruthConfirmed] = useState(false);
  const [history, setHistory] = useState<ClaimHistory | null>(null);
  const [paymentPaid, setPaymentPaid] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef(new Set<string>());

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/lc/dm-dossiers/${encodeURIComponent(dossierId)}/my-claim`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async response => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok || !body.success) throw new Error(errorMessage(body.error, '认领记录读取失败'));
        const state = body.data as ClaimState;
        const latest = state?.claim || null;
        setHistory(latest);
        setPaymentPaid(Boolean(state?.payment?.paid));
        if (latest?.status === 'rejected') {
          setClaimNote(latest.claim_note || '');
          if (PROOF_OPTIONS[entityType].some(option => option.value === latest.proof_type)) setProofType(latest.proof_type);
        }
      })
      .catch(reason => {
        if (reason?.name !== 'AbortError') setError(reason instanceof Error ? reason.message : '认领记录读取失败');
      })
      .finally(() => setLoadingHistory(false));
    return () => controller.abort();
  }, [dossierId, entityType, token]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, submitting]);

  const entityLabel = entityType === 'store' ? '店家' : 'DM';

  const addFiles = (selected: FileList | null) => {
    if (!selected) return;
    const incoming = Array.from(selected);
    const invalidType = incoming.find(file => !file.type.startsWith('image/'));
    if (invalidType) {
      setError('认领材料只支持图片截图');
      return;
    }
    const oversized = incoming.find(file => file.size > MAX_IMAGE_UPLOAD_BYTES);
    if (oversized) {
      setError('每张图片不能超过 8MB');
      return;
    }
    if (totalFileBytes([...files.map(item => item.file), ...incoming]) > MAX_MULTIPART_UPLOAD_BYTES) {
      setError('本次上传的截图合计不能超过 18MB');
      return;
    }
    const availableSlots = Math.max(0, MAX_PROOF_FILES - files.length);
    const accepted = incoming.slice(0, availableSlots).map(file => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      return { file, previewUrl };
    });
    setFiles(current => [...current, ...accepted]);
    setError(incoming.length + files.length > MAX_PROOF_FILES ? `最多上传 ${MAX_PROOF_FILES} 张截图，已保留前 ${MAX_PROOF_FILES} 张` : '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(current => {
      const removed = current[index];
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrlsRef.current.delete(removed.previewUrl);
      }
      return current.filter((_, fileIndex) => fileIndex !== index);
    });
  };

  const submit = async () => {
    if (claimNote.trim().length < 6) {
      setError('请至少写 6 个字，说明你与这份档案的关系');
      return;
    }
    if (files.length < 1) {
      setError('请至少上传 1 张能够证明身份的截图');
      return;
    }
    if (!truthConfirmed) {
      setError('请确认材料真实且你有权提交');
      return;
    }
    if (!paymentPaid) {
      setError('请先在剧幕录微信小程序支付 8.88 元认领审核服务费');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const body = new FormData();
      body.set('proofType', proofType);
      body.set('claimNote', claimNote.trim());
      body.set('truthConfirmed', 'true');
      files.forEach(item => body.append('proofFiles', item.file));
      const response = await fetch(`${API}/lc/dm-dossiers/${encodeURIComponent(dossierId)}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(errorMessage(payload.error, '认领申请提交失败'));
      onSubmitted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '认领申请提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dossier-claim-overlay" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <section className="dossier-claim-modal" role="dialog" aria-modal="true" aria-labelledby="dossier-claim-title">
        <header className="dossier-claim-header">
          <div>
            <div className="dossier-claim-kicker">{entityLabel}档案认领</div>
            <h2 id="dossier-claim-title">认领「{dossierName}」</h2>
            <p>当前以 <strong>{displayName}</strong> 的账号提交。审核通过后，这份档案会绑定到你的账号。</p>
          </div>
          <button className="dossier-claim-close" type="button" onClick={onClose} disabled={submitting} aria-label="关闭认领窗口">×</button>
        </header>

        <div className="dossier-claim-body">
          {history?.status === 'rejected' && (
            <div className="dossier-claim-rejected">
              <strong>上次申请未通过</strong>
              <span>{history.reject_reason || '材料暂不足以确认身份，请补充后重新提交。'}</span>
            </div>
          )}
          {history?.status === 'pending' && <div className="dossier-claim-pending">这份认领申请正在审核，无需重复提交。</div>}
          {!paymentPaid && (
            <div className="dossier-claim-payment">
              本人认领审核服务费为 8.88 元，请先在剧幕录微信小程序完成支付。认领成功后的资料修改不再收费，但仍需审核。
            </div>
          )}

          <fieldset disabled={loadingHistory || history?.status === 'pending' || submitting}>
            <legend>你准备提交哪类证明？</legend>
            <div className="dossier-claim-proof-options">
              {options.map(option => (
                <button key={option.value} type="button" className={proofType === option.value ? 'is-active' : ''} onClick={() => setProofType(option.value)}>
                  <strong>{option.label}</strong>
                  <span>{option.helper}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="dossier-claim-field">
            <span>说明你与这份档案的关系</span>
            <textarea
              value={claimNote}
              onChange={event => setClaimNote(event.target.value.slice(0, 600))}
              placeholder={entityType === 'store' ? '例如：我是该店负责人，截图为我的店铺管理后台。' : '例如：这是我的 DM 档案，截图为我的社交账号后台。'}
              rows={3}
              disabled={loadingHistory || history?.status === 'pending' || submitting}
            />
            <small>{claimNote.length}/600</small>
          </label>

          <div className="dossier-claim-upload">
            <div className="dossier-claim-upload-heading">
              <div><strong>身份凭证截图</strong><span>上传 1–3 张，每张不超过 8MB</span></div>
              {files.length < MAX_PROOF_FILES && history?.status !== 'pending' && (
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={submitting}>选择图片</button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={event => addFiles(event.target.files)} />
            {files.length === 0 ? (
              <button className="dossier-claim-upload-empty" type="button" onClick={() => fileInputRef.current?.click()} disabled={history?.status === 'pending' || submitting}>
                <strong>上传能够证明身份的截图</strong>
                <span>请先遮住身份证号、手机号、聊天对象等无关信息</span>
              </button>
            ) : (
              <div className="dossier-claim-previews">
                {files.map((item, index) => (
                  <figure key={`${item.file.name}-${item.file.lastModified}-${index}`}>
                    <img src={item.previewUrl} alt={`身份凭证 ${index + 1}`} />
                    <figcaption>{item.file.name}</figcaption>
                    <button type="button" onClick={() => removeFile(index)} disabled={submitting} aria-label={`移除第 ${index + 1} 张截图`}>×</button>
                  </figure>
                ))}
              </div>
            )}
          </div>

          <div className="dossier-claim-privacy">
            <strong>材料仅用于管理员核验</strong>
            <span>认领截图不会公开展示，也不会进入公开图片目录。请只提交必要信息。</span>
          </div>

          <label className="dossier-claim-confirm">
            <input type="checkbox" checked={truthConfirmed} onChange={event => setTruthConfirmed(event.target.checked)} disabled={history?.status === 'pending' || submitting} />
            <span>我确认材料真实、本人有权提交，并同意平台为认领审核保存该材料。</span>
          </label>

          {error && <div className="dossier-claim-error" role="alert">{error}</div>}
        </div>

        <footer className="dossier-claim-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={submitting}>取消</button>
          <button type="button" className="primary" onClick={submit} disabled={loadingHistory || history?.status === 'pending' || submitting || !paymentPaid}>
            {submitting ? '提交中…' : history?.status === 'pending' ? '审核中' : paymentPaid ? '提交认领审核' : '请先在小程序支付 8.88 元'}
          </button>
        </footer>
      </section>
      <style>{`
        .dossier-claim-overlay{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.48);backdrop-filter:blur(3px)}
        .dossier-claim-modal{width:min(680px,100%);max-height:min(90vh,760px);display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(31,41,55,.12);border-radius:8px;background:#fffdf8;box-shadow:0 24px 80px rgba(15,23,42,.24);color:#1f2937}
        .dossier-claim-header{display:flex;justify-content:space-between;gap:18px;padding:20px 22px 16px;border-bottom:1px solid rgba(31,41,55,.09);background:#fff}
        .dossier-claim-kicker{margin-bottom:5px;color:#9a5b18;font-size:12px;font-weight:900}
        .dossier-claim-header h2{margin:0;font-family:var(--font-serif);font-size:22px;letter-spacing:0}
        .dossier-claim-header p{margin:7px 0 0;color:rgba(71,85,105,.78);font-size:13px;line-height:1.6}
        .dossier-claim-close{width:32px;height:32px;display:grid;place-items:center;flex:0 0 32px;padding:0;border:1px solid rgba(31,41,55,.12);border-radius:6px;background:#fff;color:#475569;font-size:22px;line-height:1;cursor:pointer}
        .dossier-claim-body{padding:18px 22px;overflow:auto}
        .dossier-claim-rejected,.dossier-claim-pending,.dossier-claim-payment{display:grid;gap:3px;margin-bottom:14px;padding:10px 12px;border-radius:7px;font-size:13px;line-height:1.55}
        .dossier-claim-rejected{border:1px solid rgba(185,28,28,.16);background:#fff5f5;color:#991b1b}.dossier-claim-pending{border:1px solid rgba(166,106,31,.18);background:#fff8e8;color:#8a5a19;font-weight:800}
        .dossier-claim-payment{border:1px solid rgba(166,106,31,.22);background:#fff8e8;color:#7a4a0c}
        .dossier-claim-body fieldset{margin:0 0 15px;padding:0;border:0}.dossier-claim-body legend,.dossier-claim-field>span{display:block;margin-bottom:8px;font-size:13px;font-weight:900}
        .dossier-claim-proof-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
        .dossier-claim-proof-options button{min-height:70px;padding:10px;text-align:left;border:1px solid rgba(31,41,55,.12);border-radius:7px;background:#fff;color:#1f2937;cursor:pointer}
        .dossier-claim-proof-options button.is-active{border-color:#a66a1f;background:#fff8e8;box-shadow:inset 0 0 0 1px rgba(166,106,31,.12)}
        .dossier-claim-proof-options strong,.dossier-claim-proof-options span{display:block}.dossier-claim-proof-options strong{font-size:13px}.dossier-claim-proof-options span{margin-top:4px;color:rgba(71,85,105,.72);font-size:11px;line-height:1.45}
        .dossier-claim-field{display:block;position:relative;margin-bottom:15px}.dossier-claim-field textarea{box-sizing:border-box;width:100%;min-height:82px;padding:10px 12px 24px;border:1px solid rgba(31,41,55,.14);border-radius:7px;background:#fff;color:#1f2937;font:inherit;line-height:1.6;resize:vertical}.dossier-claim-field textarea:focus{outline:2px solid rgba(166,106,31,.18);border-color:#a66a1f}.dossier-claim-field small{position:absolute;right:10px;bottom:8px;color:rgba(71,85,105,.55);font-size:11px}
        .dossier-claim-upload{margin-bottom:14px;padding:13px;border:1px dashed rgba(166,106,31,.28);border-radius:7px;background:#fff}
        .dossier-claim-upload-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.dossier-claim-upload-heading>div{display:grid;gap:3px}.dossier-claim-upload-heading strong{font-size:13px}.dossier-claim-upload-heading span{color:rgba(71,85,105,.67);font-size:11px}.dossier-claim-upload-heading button,.dossier-claim-upload-empty{border:1px solid rgba(166,106,31,.25);border-radius:6px;background:#fff8e8;color:#8a5a19;font-weight:900;cursor:pointer}.dossier-claim-upload-heading button{padding:7px 10px;font-size:12px}
        .dossier-claim-upload-empty{width:100%;display:grid;gap:4px;margin-top:10px;padding:18px 12px}.dossier-claim-upload-empty span{font-size:11px;font-weight:600;color:rgba(71,85,105,.68)}
        .dossier-claim-previews{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:11px}.dossier-claim-previews figure{position:relative;min-width:0;margin:0}.dossier-claim-previews img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;border:1px solid rgba(31,41,55,.1)}.dossier-claim-previews figcaption{overflow:hidden;margin-top:4px;color:#64748b;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.dossier-claim-previews figure button{position:absolute;top:5px;right:5px;width:24px;height:24px;padding:0;border:0;border-radius:50%;background:rgba(15,23,42,.78);color:#fff;font-size:17px;cursor:pointer}
        .dossier-claim-privacy{display:grid;gap:3px;padding:9px 11px;border-left:3px solid #275389;background:#eff6ff;color:#275389;font-size:12px;line-height:1.5}.dossier-claim-privacy span{color:rgba(39,83,137,.78)}
        .dossier-claim-confirm{display:flex;align-items:flex-start;gap:8px;margin-top:13px;color:rgba(31,41,55,.76);font-size:12px;line-height:1.55}.dossier-claim-confirm input{margin-top:3px;accent-color:#a66a1f}
        .dossier-claim-error{margin-top:11px;padding:8px 10px;border-radius:6px;background:#fef2f2;color:#b91c1c;font-size:12px;font-weight:800}
        .dossier-claim-actions{display:flex;justify-content:flex-end;gap:9px;padding:13px 22px;border-top:1px solid rgba(31,41,55,.09);background:#fff}.dossier-claim-actions button{min-width:108px;padding:9px 14px;border-radius:7px;font-weight:900;cursor:pointer}.dossier-claim-actions .secondary{border:1px solid rgba(31,41,55,.14);background:#fff;color:#475569}.dossier-claim-actions .primary{border:1px solid #1f2937;background:#1f2937;color:#fff}.dossier-claim-actions button:disabled,.dossier-claim-body button:disabled{cursor:not-allowed;opacity:.5}
        @media(max-width:640px){.dossier-claim-overlay{align-items:end;padding:0}.dossier-claim-modal{max-height:94dvh;border-radius:8px 8px 0 0}.dossier-claim-header{padding:16px}.dossier-claim-body{padding:15px 16px}.dossier-claim-proof-options{grid-template-columns:1fr}.dossier-claim-proof-options button{min-height:0}.dossier-claim-actions{padding:11px 16px calc(11px + env(safe-area-inset-bottom))}.dossier-claim-actions button{flex:1;min-width:0}}
      `}</style>
    </div>
  );
}
