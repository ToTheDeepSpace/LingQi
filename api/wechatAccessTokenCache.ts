export type WechatAccessTokenLoadResult = {
  token: string;
  expiresInSeconds: number;
};

export class WechatAccessTokenCache {
  private token = '';
  private expiresAt = 0;
  private pending: Promise<string> | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  async get(load: () => Promise<WechatAccessTokenLoadResult>): Promise<string> {
    if (this.token && this.now() < this.expiresAt) return this.token;
    if (this.pending) return this.pending;

    const pending = (async () => {
      const loaded = await load();
      if (!loaded.token) throw new Error('微信 access_token 为空');
      const usableSeconds = Math.max(60, Number(loaded.expiresInSeconds || 7200) - 300);
      this.token = loaded.token;
      this.expiresAt = this.now() + usableSeconds * 1000;
      return this.token;
    })();
    this.pending = pending;
    try {
      return await pending;
    } finally {
      if (this.pending === pending) this.pending = null;
    }
  }

  invalidate(expectedToken?: string): void {
    if (expectedToken && this.token && this.token !== expectedToken) return;
    this.token = '';
    this.expiresAt = 0;
  }
}
