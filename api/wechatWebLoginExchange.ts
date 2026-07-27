import { randomBytes } from 'node:crypto';

type ExchangeEntry<T> = {
  payload: T;
  expiresAt: number;
};

export class WechatWebLoginExchangeStore<T> {
  private readonly entries = new Map<string, ExchangeEntry<T>>();

  constructor(
    private readonly ttlMs = 2 * 60 * 1000,
    private readonly maxEntries = 5_000,
    private readonly now: () => number = Date.now,
    private readonly createToken: () => string = () => randomBytes(32).toString('base64url'),
  ) {}

  issue(payload: T): string {
    this.removeExpired();
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (!oldest) break;
      this.entries.delete(oldest);
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const token = this.createToken();
      if (!token || this.entries.has(token)) continue;
      this.entries.set(token, {
        payload,
        expiresAt: this.now() + this.ttlMs,
      });
      return token;
    }
    throw new Error('微信登录临时凭证生成失败，请重试');
  }

  consume(token: string): T | null {
    const entry = this.entries.get(token);
    if (!entry) return null;
    this.entries.delete(token);
    if (entry.expiresAt <= this.now()) return null;
    return entry.payload;
  }

  private removeExpired(): void {
    const now = this.now();
    for (const [token, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(token);
    }
  }
}
