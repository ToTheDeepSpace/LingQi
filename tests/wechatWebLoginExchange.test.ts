import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { WechatWebLoginExchangeStore } from '../api/wechatWebLoginExchange.js';

test('issues an opaque WeChat web login code that can only be consumed once', () => {
  const store = new WechatWebLoginExchangeStore(120_000, 10, () => 1_000, () => 'opaque-code');
  const code = store.issue({ token: 'login-token', profileId: 'profile-1' });

  assert.equal(code, 'opaque-code');
  assert.deepEqual(store.consume(code), { token: 'login-token', profileId: 'profile-1' });
  assert.equal(store.consume(code), null);
});

test('rejects expired WeChat web login exchange codes', () => {
  let now = 1_000;
  const store = new WechatWebLoginExchangeStore(2_000, 10, () => now, () => 'expiring-code');
  const code = store.issue({ profileId: 'profile-1' });

  now = 3_000;
  assert.equal(store.consume(code), null);
});

test('bounds pending WeChat web login exchanges', () => {
  const codes = ['first', 'second', 'third'];
  const store = new WechatWebLoginExchangeStore(
    120_000,
    2,
    () => 1_000,
    () => codes.shift() || 'fallback',
  );

  store.issue({ id: 1 });
  store.issue({ id: 2 });
  store.issue({ id: 3 });

  assert.equal(store.consume('first'), null);
  assert.deepEqual(store.consume('second'), { id: 2 });
  assert.deepEqual(store.consume('third'), { id: 3 });
});

test('never transports the authenticated session token in the WeChat callback URL', () => {
  const server = readFileSync('api/index.ts', 'utf8');
  const login = readFileSync('src/pages/Login.tsx', 'utf8');

  assert.doesNotMatch(server, /login\?wechat_login=/);
  assert.doesNotMatch(login, /params\.get\(['"]wechat_login['"]\)/);
  assert.match(server, /wechatWebLoginExchangeStore\.issue\(/);
  assert.match(server, /\/api\/lc\/auth\/wechat\/exchange/);
  assert.match(login, /params\.get\(['"]wechat_code['"]\)/);
  assert.match(
    server,
    /profile_setup_completed:\s*false,\s*\n\s*auth_provider:\s*'wechat'/,
  );
});
