import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  interpretWechatContentCheck,
  interpretWechatMediaCallback,
  interpretWechatMediaSubmission,
  joinWechatSafetyText,
  wechatSafetySceneNumber,
} from '../api/wechatMiniContentSafety.js';

test('allows content explicitly passed by WeChat', () => {
  assert.deepEqual(interpretWechatContentCheck({ errcode: 0, trace_id: 'text-1', result: { suggest: 'pass', label: 100 } }), {
    allowed: true,
    retryable: false,
    reason: '',
    label: 100,
    suggest: 'pass',
    traceId: 'text-1',
    errcode: 0,
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

test('accepts a media task only when WeChat returns a trace id', () => {
  assert.deepEqual(interpretWechatMediaSubmission({ errcode: 0, trace_id: 'media-1' }), {
    accepted: true,
    retryable: false,
    reason: '',
    traceId: 'media-1',
    errcode: 0,
  });
  assert.equal(interpretWechatMediaSubmission({ errcode: 0 }).accepted, false);
});

test('interprets asynchronous media callbacks without exposing media urls', () => {
  assert.deepEqual(interpretWechatMediaCallback({
    Event: 'wxa_media_check',
    trace_id: 'media-1',
    errcode: 0,
    result: { suggest: 'pass', label: 100 },
  }), {
    valid: true,
    retryable: false,
    status: 'pass',
    reason: '',
    suggest: 'pass',
    label: 100,
    traceId: 'media-1',
    errcode: 0,
  });
  assert.equal(interpretWechatMediaCallback({ Event: 'other', trace_id: 'media-2' }).valid, false);
});

test('maps business scenes and truncates combined content to WeChat limits', () => {
  assert.equal(wechatSafetySceneNumber('profile_update'), 1);
  assert.equal(wechatSafetySceneNumber('ranking_comment'), 2);
  assert.equal(wechatSafetySceneNumber('carpool_submit'), 3);
  assert.equal(joinWechatSafetyText([' a ', '', ['b', 'c']], 3), 'a\nb');
});

test('server business routes enforce miniapp text checks instead of trusting client preflight', () => {
  const source = readFileSync('api/index.ts', 'utf8');
  assert.match(source, /signProfileAuthToken\(profile,\s*'wechat-miniapp'\)/);
  assert.match(source, /app\.post\('\/api\/lc\/miniapp\/auth\/refresh'/);
  assert.match(source, /authenticatedClient === 'wechat-miniapp' \|\| authenticatedClient === 'web'/);
  const criticalRoutes = [
    '/api/lc/provider-listings/mine',
    '/api/lc/commissions',
    '/api/lc/entity-ratings',
    '/api/lc/carpools',
    '/api/lc/reports',
    '/api/lc/site-messages',
    '/api/lc/carpools/:id/applications',
    '/api/lc/commissions/:id/applications',
    '/api/lc/dm-dossiers',
    '/api/lc/dm-ratings',
    '/api/lc/store-ratings',
    '/api/lc/rankings',
    '/api/lc/rankings/:id/comments',
    '/api/lc/creators/:id',
  ];
  for (const route of criticalRoutes) {
    const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      source,
      new RegExp(`app\\.(?:post|put)\\(\\s*'${escapedRoute}'[\\s\\S]{0,2000}?wechatMiniTextSafetyMiddleware\\s*\\(\\s*\\{`),
      `missing server-enforced WeChat check for ${route}`,
    );
  }
});

test('public images use async WeChat checks and approval gates', () => {
  const source = readFileSync('api/index.ts', 'utf8');
  assert.match(source, /media_check_async/);
  assert.match(source, /app\.post\('\/api\/wechat\/mini\/events'/);
  assert.match(source, /startWechatMiniImageSafetyCheck\(req/);
  assert.match(source, /assertWechatImageChecksAllowApproval\(collectPotentialPublicImageUrls\(review\.payload\)\)/);
  assert.match(source, /assertWechatImageChecksAllowApproval\(collectPotentialPublicImageUrls\(r\.display_files\)\)/);
});
