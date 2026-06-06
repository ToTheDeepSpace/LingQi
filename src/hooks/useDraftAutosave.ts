import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type DraftEnvelope<T> = {
  version: number;
  savedAt: number;
  value: T;
};

type DraftAutosaveOptions<T> = {
  key: string;
  value: T;
  version?: number;
  enabled?: boolean;
  delayMs?: number;
  shouldSave: (value: T) => boolean;
  onRestore: (value: T) => void;
};

export function useDraftAutosave<T>({
  key,
  value,
  version = 1,
  enabled = true,
  delayMs = 700,
  shouldSave,
  onRestore,
}: DraftAutosaveOptions<T>) {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const onRestoreRef = useRef(onRestore);
  const readyRef = useRef(false);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    let cancelled = false;
    readyRef.current = false;

    const finish = (next: { savedAt: number | null; restoredAt: number | null; error: string; value?: T }) => {
      if (cancelled) return;
      if (next.value !== undefined) onRestoreRef.current(next.value);
      setSavedAt(next.savedAt);
      setRestoredAt(next.restoredAt);
      setError(next.error);
      readyRef.current = true;
    };

    if (!enabled) {
      const timer = window.setTimeout(() => finish({ savedAt: null, restoredAt: null, error: '' }), 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    let next: { savedAt: number | null; restoredAt: number | null; error: string; value?: T } = {
      savedAt: null,
      restoredAt: null,
      error: '',
    };
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        const timer = window.setTimeout(() => finish(next), 0);
        return () => {
          cancelled = true;
          window.clearTimeout(timer);
        };
      }
      const parsed = JSON.parse(raw) as DraftEnvelope<T>;
      if (parsed.version === version && typeof parsed.savedAt === 'number') {
        next = {
          savedAt: parsed.savedAt,
          restoredAt: parsed.savedAt,
          error: '',
          value: parsed.value,
        };
      }
    } catch {
      next = { savedAt: null, restoredAt: null, error: '草稿读取失败' };
    }

    const timer = window.setTimeout(() => finish(next), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, key, version]);

  useEffect(() => {
    if (!enabled || !readyRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        if (!shouldSave(value)) {
          localStorage.removeItem(key);
          setSavedAt(null);
          return;
        }
        const nextSavedAt = Date.now();
        const envelope: DraftEnvelope<T> = { version, savedAt: nextSavedAt, value };
        localStorage.setItem(key, JSON.stringify(envelope));
        setSavedAt(nextSavedAt);
        setError('');
      } catch {
        setError('草稿保存失败');
      }
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [delayMs, enabled, key, shouldSave, value, version]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setSavedAt(null);
      setRestoredAt(null);
      setError('');
    } catch {
      setError('草稿清除失败');
    }
  }, [key]);

  return useMemo(() => ({ savedAt, restoredAt, error, clearDraft }), [clearDraft, error, restoredAt, savedAt]);
}
