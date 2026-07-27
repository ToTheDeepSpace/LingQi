import assert from 'node:assert/strict';
import test from 'node:test';
import { WechatAccessTokenCache } from '../api/wechatAccessTokenCache.js';

test('deduplicates concurrent WeChat access token loads', async () => {
  const cache = new WechatAccessTokenCache(() => 1_000);
  let loads = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const load = async () => {
    loads += 1;
    await gate;
    return { token: 'shared-token', expiresInSeconds: 7200 };
  };

  const first = cache.get(load);
  const second = cache.get(load);
  release?.();

  assert.deepEqual(await Promise.all([first, second]), ['shared-token', 'shared-token']);
  assert.equal(loads, 1);
});

test('keeps a newer token when a stale request reports invalid credentials', async () => {
  let now = 1_000;
  const cache = new WechatAccessTokenCache(() => now);
  const oldToken = await cache.get(async () => ({ token: 'old-token', expiresInSeconds: 60 }));
  cache.invalidate(oldToken);
  const newToken = await cache.get(async () => ({ token: 'new-token', expiresInSeconds: 7200 }));

  cache.invalidate(oldToken);
  now += 1;

  assert.equal(await cache.get(async () => ({ token: 'unexpected', expiresInSeconds: 7200 })), newToken);
});

test('allows a fresh load after a failed WeChat token request', async () => {
  const cache = new WechatAccessTokenCache();
  await assert.rejects(cache.get(async () => { throw new Error('network'); }), /network/);
  assert.equal(
    await cache.get(async () => ({ token: 'recovered-token', expiresInSeconds: 7200 })),
    'recovered-token',
  );
});
