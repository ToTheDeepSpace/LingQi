import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

type EditorTool = 'none' | 'crop' | 'mosaic' | 'blur' | 'blackout';
type Point = { x: number; y: number };
type Selection = { x: number; y: number; width: number; height: number };
type Snapshot = { blob: Blob; actions: string[] };

type Props = {
  source: Blob;
  sourceName: string;
  onChange: (file: File | null, actions: string[]) => void;
};

const MAX_EDITOR_EDGE = 1800;

const TOOL_LABELS: Record<EditorTool, string> = {
  none: '浏览',
  crop: '裁剪',
  mosaic: '马赛克',
  blur: '模糊',
  blackout: '遮挡',
};

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片导出失败')), 'image/jpeg', 0.9);
  });
}

function loadBlobImage(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const source = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(source);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error('审核材料读取失败'));
    };
    image.src = source;
  });
}

function editorSize(width: number, height: number) {
  const scale = Math.min(1, MAX_EDITOR_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function normalizedSelection(start: Point, end: Point, canvas: HTMLCanvasElement): Selection {
  const left = Math.max(0, Math.min(start.x, end.x));
  const top = Math.max(0, Math.min(start.y, end.y));
  const right = Math.min(canvas.width, Math.max(start.x, end.x));
  const bottom = Math.min(canvas.height, Math.max(start.y, end.y));
  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.max(0, Math.round(right - left)),
    height: Math.max(0, Math.round(bottom - top)),
  };
}

function pointFromPointer(event: ReactPointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function fileNameFor(sourceName: string) {
  const base = sourceName.replace(/\.[^.]+$/, '').trim() || '审核材料';
  return `${base}-公开副本.jpg`;
}

export default function RankingEvidenceEditor({ source, sourceName, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onChangeRef = useRef(onChange);
  const historyRef = useRef<Snapshot[]>([]);
  const historyIndexRef = useRef(0);
  const dragStartRef = useRef<Point | null>(null);
  const [tool, setTool] = useState<EditorTool>('none');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [historyStatus, setHistoryStatus] = useState({ index: 0, length: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const emitSnapshot = (snapshot: Snapshot) => {
    if (snapshot.actions.length === 0) onChangeRef.current(null, []);
    else onChangeRef.current(new File([snapshot.blob], fileNameFor(sourceName), { type: 'image/jpeg' }), snapshot.actions);
  };

  const commit = async (actions: string[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      const blob = await canvasBlob(canvas);
      const snapshots = historyRef.current.slice(0, historyIndexRef.current + 1);
      snapshots.push({ blob, actions });
      if (snapshots.length > 16) snapshots.splice(1, snapshots.length - 16);
      historyRef.current = snapshots;
      historyIndexRef.current = snapshots.length - 1;
      setHistoryStatus({ index: historyIndexRef.current, length: snapshots.length });
      emitSnapshot(snapshots[historyIndexRef.current]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '图片处理失败');
    } finally {
      setBusy(false);
    }
  };

  const restore = async (index: number) => {
    const canvas = canvasRef.current;
    const snapshot = historyRef.current[index];
    if (!canvas || !snapshot) return;
    setBusy(true);
    setError('');
    try {
      const image = await loadBlobImage(snapshot.blob);
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      setCanvasSize({ width: canvas.width, height: canvas.height });
      const context = canvas.getContext('2d');
      if (!context) throw new Error('浏览器不支持图片编辑');
      context.drawImage(image, 0, 0);
      historyIndexRef.current = index;
      setHistoryStatus({ index, length: historyRef.current.length });
      emitSnapshot(snapshot);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '图片恢复失败');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    loadBlobImage(source).then(async image => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const size = editorSize(image.naturalWidth, image.naturalHeight);
      canvas.width = size.width;
      canvas.height = size.height;
      setCanvasSize(size);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('浏览器不支持图片编辑');
      context.drawImage(image, 0, 0, size.width, size.height);
      const blob = await canvasBlob(canvas);
      if (cancelled) return;
      historyRef.current = [{ blob, actions: [] }];
      historyIndexRef.current = 0;
      setHistoryStatus({ index: 0, length: 1 });
      onChangeRef.current(null, []);
    }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '图片载入失败');
    }).finally(() => {
      if (!cancelled) setBusy(false);
    });
    return () => { cancelled = true; };
  }, [source, sourceName]);

  const applyRotation = async (clockwise: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas || busy) return;
    const buffer = document.createElement('canvas');
    buffer.width = canvas.height;
    buffer.height = canvas.width;
    const context = buffer.getContext('2d');
    if (!context) return;
    context.translate(buffer.width / 2, buffer.height / 2);
    context.rotate((clockwise ? 1 : -1) * Math.PI / 2);
    context.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    canvas.width = buffer.width;
    canvas.height = buffer.height;
    setCanvasSize({ width: buffer.width, height: buffer.height });
    canvas.getContext('2d')?.drawImage(buffer, 0, 0);
    const actions = [...(historyRef.current[historyIndexRef.current]?.actions || []), clockwise ? '向右旋转' : '向左旋转'];
    await commit(actions);
  };

  const applySelection = async (area: Selection) => {
    const canvas = canvasRef.current;
    if (!canvas || area.width < 8 || area.height < 8 || busy || tool === 'none') return;
    const context = canvas.getContext('2d');
    if (!context) return;
    if (tool === 'crop') {
      const buffer = document.createElement('canvas');
      buffer.width = area.width;
      buffer.height = area.height;
      buffer.getContext('2d')?.drawImage(canvas, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
      canvas.width = area.width;
      canvas.height = area.height;
      setCanvasSize({ width: area.width, height: area.height });
      canvas.getContext('2d')?.drawImage(buffer, 0, 0);
    } else if (tool === 'blackout') {
      context.fillStyle = '#111827';
      context.fillRect(area.x, area.y, area.width, area.height);
    } else {
      const buffer = document.createElement('canvas');
      buffer.width = area.width;
      buffer.height = area.height;
      const bufferContext = buffer.getContext('2d');
      if (!bufferContext) return;
      bufferContext.drawImage(canvas, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
      if (tool === 'mosaic') {
        const mosaic = document.createElement('canvas');
        mosaic.width = Math.max(2, Math.round(area.width / 16));
        mosaic.height = Math.max(2, Math.round(area.height / 16));
        const mosaicContext = mosaic.getContext('2d');
        if (!mosaicContext) return;
        mosaicContext.drawImage(buffer, 0, 0, mosaic.width, mosaic.height);
        context.save();
        context.imageSmoothingEnabled = false;
        context.drawImage(mosaic, area.x, area.y, area.width, area.height);
        context.restore();
      } else {
        context.save();
        context.filter = 'blur(14px)';
        context.drawImage(buffer, area.x, area.y, area.width, area.height);
        context.restore();
      }
    }
    const actions = [...(historyRef.current[historyIndexRef.current]?.actions || []), TOOL_LABELS[tool]];
    await commit(actions);
  };

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || tool === 'none' || busy) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const point = pointFromPointer(event, canvas);
    dragStartRef.current = point;
    setSelection({ x: point.x, y: point.y, width: 0, height: 0 });
  };

  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !dragStartRef.current || tool === 'none') return;
    event.preventDefault();
    setSelection(normalizedSelection(dragStartRef.current, pointFromPointer(event, canvas), canvas));
  };

  const pointerUp = async (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !dragStartRef.current || tool === 'none') return;
    event.preventDefault();
    const area = normalizedSelection(dragStartRef.current, pointFromPointer(event, canvas), canvas);
    dragStartRef.current = null;
    setSelection(null);
    await applySelection(area);
  };

  const currentIndex = historyStatus.index;
  const historyLength = historyStatus.length;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <button type="button" title="撤销" disabled={busy || currentIndex <= 0} onClick={() => void restore(currentIndex - 1)} style={iconButtonStyle}>↶</button>
        <button type="button" title="重做" disabled={busy || currentIndex >= historyLength - 1} onClick={() => void restore(currentIndex + 1)} style={iconButtonStyle}>↷</button>
        <button type="button" title="向左旋转" disabled={busy} onClick={() => void applyRotation(false)} style={toolButtonStyle(false)}>左转</button>
        <button type="button" title="向右旋转" disabled={busy} onClick={() => void applyRotation(true)} style={toolButtonStyle(false)}>右转</button>
        {(['crop', 'mosaic', 'blur', 'blackout'] as EditorTool[]).map(value => (
          <button key={value} type="button" disabled={busy} onClick={() => setTool(current => current === value ? 'none' : value)} style={toolButtonStyle(tool === value)}>{TOOL_LABELS[value]}</button>
        ))}
        <button type="button" title="恢复原始证据预览" disabled={busy || currentIndex === 0} onClick={() => void restore(0)} style={toolButtonStyle(false)}>重置</button>
      </div>
      <div style={{ color: '#64748b', fontSize: 11, lineHeight: 1.5 }}>
        {tool === 'none' ? '选择裁剪、马赛克、模糊或遮挡后，在图片上拖出处理区域。' : `当前：${TOOL_LABELS[tool]}，请在图片上拖动框选。`}
      </div>
      <div style={{ maxHeight: '58vh', overflow: 'auto', padding: 8, border: '1px solid rgba(31,41,55,0.10)', borderRadius: 8, background: '#f8fafc', textAlign: 'center' }}>
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', lineHeight: 0 }}>
          <canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { dragStartRef.current = null; setSelection(null); }}
            style={{ display: 'block', width: '100%', maxWidth: '100%', height: 'auto', borderRadius: 6, cursor: tool === 'none' ? 'default' : 'crosshair', touchAction: tool === 'none' ? 'auto' : 'none', background: '#fff' }} />
          {selection ? <div style={{ position: 'absolute', pointerEvents: 'none', left: `${selection.x / canvasSize.width * 100}%`, top: `${selection.y / canvasSize.height * 100}%`, width: `${selection.width / canvasSize.width * 100}%`, height: `${selection.height / canvasSize.height * 100}%`, border: '2px solid #2563eb', background: tool === 'crop' ? 'rgba(37,99,235,0.10)' : 'rgba(15,23,42,0.18)', boxSizing: 'border-box' }} /> : null}
        </div>
      </div>
      {busy && <div style={{ color: '#64748b', fontSize: 11 }}>正在处理图片…</div>}
      {error && <div style={{ color: '#b91c1c', fontSize: 11 }}>{error}</div>}
    </div>
  );
}

const iconButtonStyle = {
  width: 32,
  height: 32,
  padding: 0,
  border: '1px solid rgba(31,41,55,0.14)',
  borderRadius: 7,
  background: '#fff',
  color: '#334155',
  cursor: 'pointer',
  fontSize: 17,
  fontWeight: 800,
} as const;

function toolButtonStyle(active: boolean) {
  return {
    minHeight: 32,
    padding: '5px 9px',
    border: `1px solid ${active ? '#2563eb' : 'rgba(31,41,55,0.14)'}`,
    borderRadius: 7,
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#1d4ed8' : '#334155',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 800,
  } as const;
}
