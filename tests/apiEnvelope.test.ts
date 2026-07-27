import assert from 'node:assert/strict';
import test from 'node:test';
import { readApiEnvelope } from '../src/lib/apiEnvelope.js';

test('readApiEnvelope returns successful data', async () => {
  const response = new Response(JSON.stringify({ success: true, data: { count: 3 } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

  assert.deepEqual(await readApiEnvelope<{ count: number }>(response, '加载失败'), { count: 3 });
});

test('readApiEnvelope keeps a structured API error', async () => {
  const response = new Response(JSON.stringify({ success: false, error: { message: '没有权限' } }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });

  await assert.rejects(() => readApiEnvelope(response, '加载失败'), /没有权限/);
});

test('readApiEnvelope hides empty or non-JSON transport responses', async () => {
  const emptyResponse = new Response('', { status: 502 });
  const htmlResponse = new Response('<html>proxy failure</html>', { status: 502 });

  await assert.rejects(() => readApiEnvelope(emptyResponse, '角色评分加载失败，请稍后重试'), /角色评分加载失败，请稍后重试/);
  await assert.rejects(() => readApiEnvelope(htmlResponse, '角色评分加载失败，请稍后重试'), /角色评分加载失败，请稍后重试/);
});
