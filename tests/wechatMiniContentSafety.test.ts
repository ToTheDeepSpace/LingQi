import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretWechatContentCheck } from '../api/wechatMiniContentSafety.js';

test('allows content explicitly passed by WeChat', () => {
  assert.deepEqual(interpretWechatContentCheck({ errcode: 0, result: { suggest: 'pass', label: 100 } }), {
    allowed: true,
    retryable: false,
    reason: '',
    label: 100,
  });
});

test('blocks risky content without exposing raw content', () => {
  const verdict = interpretWechatContentCheck({ errcode: 0, result: { suggest: 'risky', label: 20001 } });
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.retryable, false);
  assert.equal(verdict.label, 20001);
});

test('fails closed when WeChat is unavailable or returns an unknown result', () => {
  assert.equal(interpretWechatContentCheck({ errcode: 40001, errmsg: 'invalid credential' }).retryable, true);
  assert.equal(interpretWechatContentCheck({ errcode: 0, result: {} }).allowed, false);
});
