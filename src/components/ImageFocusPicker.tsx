import { useCallback, useRef } from 'react';

type FaceDetectorResult = { boundingBox: { x: number; y: number; width: number; height: number } };
type FaceDetectorInstance = { detect: (source: HTMLImageElement) => Promise<FaceDetectorResult[]> };
type FaceDetectorConstructor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorInstance;

type Props = {
  src: string;
  focusX: number;
  focusY: number;
  onChange: (focus: { x: number; y: number }) => void;
  label?: string;
};

function clampFocus(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : fallback;
}

export default function ImageFocusPicker({ src, focusX, focusY, onChange, label = '缩略图展示位置' }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const detectedSourceRef = useRef('');
  const draggingRef = useRef(false);
  const faceDetectionAvailable = typeof window !== 'undefined' && 'FaceDetector' in window;
  const x = clampFocus(focusX, 50);
  const y = clampFocus(focusY, 25);

  const detectFace = useCallback(async () => {
    const image = imageRef.current;
    const FaceDetector = (window as typeof window & { FaceDetector?: FaceDetectorConstructor }).FaceDetector;
    if (!image || !FaceDetector || !image.complete || !image.naturalWidth || !image.naturalHeight) return false;
    try {
      const faces = await new FaceDetector({ fastMode: true, maxDetectedFaces: 3 }).detect(image);
      if (faces.length === 0) return false;
      const box = [...faces].sort((a, b) => (b.boundingBox.width * b.boundingBox.height) - (a.boundingBox.width * a.boundingBox.height))[0].boundingBox;
      onChange({
        x: clampFocus(((box.x + box.width / 2) / image.naturalWidth) * 100, 50),
        y: clampFocus(((box.y + box.height * 0.42) / image.naturalHeight) * 100, 25),
      });
      return true;
    } catch {
      return false;
    }
  }, [onChange]);

  const handleImageLoad = () => {
    if (!src || detectedSourceRef.current === src) return;
    detectedSourceRef.current = src;
    void detectFace();
  };

  const setFromPointer = (clientX: number, clientY: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    onChange({
      x: clampFocus(((clientX - rect.left) / rect.width) * 100, 50),
      y: clampFocus(((clientY - rect.top) / rect.height) * 100, 25),
    });
  };

  if (!src) return null;
  return (
    <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'rgba(71,85,105,0.72)', fontSize: 12, fontWeight: 800 }}>{label}</span>
        {faceDetectionAvailable && (
          <button type="button" onClick={() => void detectFace()} style={{ minHeight: 24, padding: '0 7px', borderRadius: 6, border: '1px solid rgba(39,83,137,0.14)', background: '#eef6ff', color: '#275389', fontSize: 11, fontWeight: 850, cursor: 'pointer' }}>
            自动找脸
          </button>
        )}
      </div>
      <div
        role="slider"
        aria-label="选择图片展示中心"
        aria-valuetext={`横向 ${Math.round(x)}%，纵向 ${Math.round(y)}%`}
        tabIndex={0}
        onPointerDown={event => {
          draggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          setFromPointer(event.clientX, event.clientY, event.currentTarget);
        }}
        onPointerMove={event => {
          if (draggingRef.current) setFromPointer(event.clientX, event.clientY, event.currentTarget);
        }}
        onPointerUp={() => { draggingRef.current = false; }}
        onPointerCancel={() => { draggingRef.current = false; }}
        style={{ width: 168, height: 112, position: 'relative', overflow: 'hidden', borderRadius: 8, border: '1px solid rgba(39,83,137,0.16)', background: '#eef6ff', cursor: 'crosshair', touchAction: 'none' }}
      >
        <img ref={imageRef} src={src} alt="裁切位置预览" onLoad={handleImageLoad} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', objectPosition: `${x}% ${y}%`, pointerEvents: 'none' }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(31,41,55,0.55)', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />
      </div>
      <span style={{ color: 'rgba(71,85,105,0.62)', fontSize: 11 }}>点击或拖动，把脸或主体放到圆点附近</span>
    </div>
  );
}
