type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: unknown;
};

function errorMessage(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    return typeof message === 'string' ? message.trim() : '';
  }
  return '';
}

export async function readApiEnvelope<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success) {
    throw new Error(errorMessage(payload?.error) || fallbackMessage);
  }
  return payload.data as T;
}
