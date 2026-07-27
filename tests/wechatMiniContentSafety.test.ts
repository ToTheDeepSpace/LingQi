import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  isWechatAccessTokenInvalid,
  isWechatEventTimestampFresh,
  interpretWechatContentCheck,
  interpretWechatMediaCallback,
  interpretWechatMediaSubmission,
  joinWechatSafetyText,
  splitWechatSafetyText,
  wechatSafetySceneNumber,
} from '../api/wechatMiniContentSafety.js';

test('retries every documented WeChat access-token invalidation code', () => {
  assert.equal(isWechatAccessTokenInvalid(40001), true);
  assert.equal(isWechatAccessTokenInvalid(40014), true);
  assert.equal(isWechatAccessTokenInvalid(42001), true);
  assert.equal(isWechatAccessTokenInvalid(43104), false);
  assert.equal(isWechatAccessTokenInvalid(undefined), false);
});

test('rejects stale or malformed WeChat event timestamps', () => {
  const now = Date.UTC(2026, 6, 28, 0, 0, 0);
  const current = String(Math.floor(now / 1000));
  const tenMinutesAgo = String(Math.floor((now - 10 * 60 * 1000) / 1000));
  const tooOld = String(Math.floor((now - 10 * 60 * 1000 - 1000) / 1000));
  assert.equal(isWechatEventTimestampFresh(current, now), true);
  assert.equal(isWechatEventTimestampFresh(tenMinutesAgo, now), true);
  assert.equal(isWechatEventTimestampFresh(tooOld, now), false);
  assert.equal(isWechatEventTimestampFresh('not-a-time', now), false);
});

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

test('accepts the official media callback payload shape', () => {
  const verdict = interpretWechatMediaCallback({
    Event: 'wxa_media_check',
    appid: 'wx8f16a5be77871234',
    trace_id: '60f96f1d-3845297a-1976a3ae',
    errcode: 0,
    errmsg: 'ok',
    result: { suggest: 'pass', label: 100 },
  });
  assert.equal(verdict.valid, true);
  assert.equal(verdict.status, 'pass');
  assert.equal(verdict.traceId, '60f96f1d-3845297a-1976a3ae');
});

test('maps business scenes and truncates combined content to WeChat limits', () => {
  assert.equal(wechatSafetySceneNumber('profile_update'), 1);
  assert.equal(wechatSafetySceneNumber('ranking_comment'), 2);
  assert.equal(wechatSafetySceneNumber('carpool_submit'), 3);
  assert.equal(joinWechatSafetyText([' a ', '', ['b', 'c']], 3), 'a\nb');
});

test('splits long content without leaving an unchecked tail', () => {
  const content = `${'前'.repeat(2500)}违规尾部`;
  const chunks = splitWechatSafetyText([content]);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0]?.length, 2500);
  assert.equal(chunks.join(''), content);
});

test('server business routes enforce miniapp text checks instead of trusting client preflight', () => {
  const source = readFileSync('api/index.ts', 'utf8');
  assert.match(source, /signProfileAuthToken\(profile,\s*'wechat-miniapp'\)/);
  assert.match(source, /app\.post\('\/api\/lc\/miniapp\/auth\/refresh'/);
  assert.match(source, /authenticatedClient === 'wechat-miniapp' \|\| authenticatedClient === 'web'/);
  assert.match(source, /AUTH_CHANNEL_REFRESH_REQUIRED/);
  assert.match(source, /authenticatedClient !== 'web' && authenticatedClient !== 'wechat-miniapp'/);
  const criticalRoutes = [
    '/api/lc/account/appeals',
    '/api/lc/provider-listings/mine',
    '/api/lc/commissions',
    '/api/lc/scripts/:id/ratings',
    '/api/lc/entity-ratings',
    '/api/lc/carpools',
    '/api/lc/reports',
    '/api/lc/site-messages',
    '/api/lc/carpools/:id/applications',
    '/api/lc/commissions/:id/applications',
    '/api/lc/dm-dossiers',
    '/api/lc/services',
    '/api/lc/portfolio',
    '/api/lc/dm-ratings',
    '/api/lc/store-ratings',
    '/api/lc/rankings',
    '/api/lc/rankings/:id/vote',
    '/api/lc/rankings/:id/comments',
    '/api/lc/creators/:id',
    '/api/lc/availability',
    '/api/lc/availability/import-text',
    '/api/lc/contact-request',
    '/api/lc/tags',
    '/api/lc/scripts/contributions',
    '/api/lc/moderation/reviews',
    '/api/lc/carpools/applications/:id/accept',
    '/api/lc/carpools/applications/:id/reject',
    '/api/lc/guides',
    '/api/lc/dm-dossiers/:id/gifts',
    '/api/lc/rating-discussions/:ratingType/:ratingId/official-response',
    '/api/lc/rating-discussions/:ratingType/:ratingId/follow-up',
    '/api/lc/dossier-edits/:dossierId',
    '/api/lc/dossier-edits/:id/owner-response',
    '/api/lc/dm-dossiers/:id/affiliations',
    '/api/lc/dm-affiliations/:id/disputes',
    '/api/lc/dm-dossiers/:id/affiliations/freelance',
    '/api/lc/dm-dossiers/:id/withdraw-certification',
    '/api/lc/dm-dossiers/:id/claim',
    '/api/lc/rankings/:id/edit-requests',
    '/api/lc/rankings/:id/resubmit',
    '/api/lc/rankings/:id/comments/:cid/related-certify',
    '/api/lc/rankings/:id/claim',
    '/api/lc/shop/dm-affiliations/:id/reject',
    '/api/lc/shop/dm-affiliations/:id/end',
    '/api/lc/shop/profile',
    '/api/lc/shop/review/:id/reply',
    '/api/lc/shop/review/:id/appeal',
    '/api/lc/certifications',
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

test('miniapp text checks exclude private credentials and identity evidence payloads', () => {
  const source = readFileSync('api/index.ts', 'utf8');
  const routeSection = (route: string, length = 900) => {
    const start = source.indexOf(`'${route}'`);
    assert.notEqual(start, -1, `missing route ${route}`);
    return source.slice(start, start + length);
  };
  const shopProfile = routeSection('/api/lc/shop/profile');
  assert.match(shopProfile, /shop_name/);
  assert.match(shopProfile, /shop_description/);
  assert.match(shopProfile, /address/);
  assert.doesNotMatch(shopProfile.slice(0, shopProfile.indexOf('async (req, res)')), /contact_phone|contact_wechat/);

  const certification = routeSection('/api/lc/certifications', 500);
  assert.match(certification, /content:\s*req\s*=>\s*\[req\.body\?\.description\]/);
  assert.doesNotMatch(certification.slice(0, certification.indexOf('async (req, res)')), /files/);

  const legacyClaim = routeSection('/api/lc/rankings/:id/claim', 500);
  assert.match(legacyClaim, /content:\s*req\s*=>\s*\[req\.body\?\.message\]/);
  assert.doesNotMatch(legacyClaim.slice(0, legacyClaim.indexOf('async (req, res)')), /contact/);

  const availabilityImport = routeSection('/api/lc/availability/import-text', 500);
  assert.doesNotMatch(availabilityImport.slice(0, availabilityImport.indexOf('async (req, res)')), /rawText/);
});

test('shop public profile changes and replies enter human review before publication', () => {
  const server = readFileSync('api/index.ts', 'utf8');
  const dashboard = readFileSync('src/pages/ShopDashboard.tsx', 'utf8');
  assert.match(server, /\|\s*'shop_profile_update'/);
  assert.match(server, /\|\s*'shop_reply_create'/);
  assert.match(server, /targetType:\s*'shop_profile_update'/);
  assert.match(server, /targetType:\s*'shop_reply_create'/);
  assert.match(server, /if \(review\.target_type === 'shop_profile_update'\)/);
  assert.match(server, /if \(review\.target_type === 'shop_reply_create'\)/);
  assert.match(server, /shop_review_reply_submitted_for_review/);
  assert.match(server, /shop_profile_update_submitted_for_review/);
  assert.doesNotMatch(dashboard, /setReviews\(prev\s*=>\s*prev\.map\(rv\s*=>\s*rv\.id === reviewId \? \{ \.\.\.rv, shop_reply:/);
  assert.match(dashboard, /店家回复审核中/);
});

test('public images use async WeChat checks and approval gates', () => {
  const source = readFileSync('api/index.ts', 'utf8');
  assert.match(source, /media_check_async/);
  assert.match(source, /app\.post\('\/api\/wechat\/mini\/events'/);
  assert.match(source, /isWechatEventTimestampFresh\(timestamp\)/);
  assert.match(source, /startWechatMiniImageSafetyCheck\(req/);
  assert.match(source, /ensureWechatMiniImageSafetyChecks\(req/);
  assert.match(source, /businessScene:\s*'profile_avatar_submit'/);
  assert.match(source, /businessScene:\s*'provider_listing_image_submit'/);
  assert.match(source, /businessScene:\s*'ranking_display_image_submit'/);
  assert.match(source, /businessScene:\s*entityType === 'store' \? 'store_dossier_image_submit' : 'dm_dossier_image_submit'/);
  assert.match(source, /businessScene:\s*'store_dossier_image_submit_with_dm_rating'/);
  assert.match(source, /businessScene:\s*'dm_dossier_image_submit_with_rating'/);
  assert.match(source, /businessScene:\s*'store_dossier_image_submit_with_rating'/);
  assert.match(source, /objectPayload\(review\.moderation_precheck\)\.wechat_image_safety_required === true/);
  assert.match(source, /objectPayload\(dossier\.moderation_precheck\)\.wechat_image_safety_required === true/);
  assert.match(source, /objectPayload\(r\.moderation_precheck\)\.wechat_image_safety_required === true/);
  assert.match(source, /precheck\.wechat_image_safety_required === true/);
  assert.equal(
    (source.match(/moderation_precheck:\s*\{[\s\S]{0,120}?wechat_image_safety_required:\s*isWechatMiniClient\(req\)/g) || []).length,
    5,
  );
  const publicReviewCalls = source.match(/createPublicReview\(\{[\s\S]*?\n\s{4}\}\);/g) || [];
  assert.equal(publicReviewCalls.length, 14);
  for (const call of publicReviewCalls) {
    assert.match(call, /wechatImageSafetyRequired:\s*(?:isWechatMiniClient\(req\)|false)/);
  }
  assert.equal(publicReviewCalls.filter(call => /wechatImageSafetyRequired:\s*false/.test(call)).length, 2);
});

test('all WeChat safety network calls have a bounded timeout', () => {
  const source = readFileSync('api/index.ts', 'utf8');
  assert.match(source, /const WECHAT_MINI_API_TIMEOUT_MS = 8_000/);
  assert.equal(
    source.match(/signal: wechatMiniApiSignal\(\)/g)?.length,
    3,
  );
  assert.equal(
    source.match(/if \(!isWechatAccessTokenInvalid\(payload\.errcode\)\) break;/g)?.length,
    2,
  );
});

test('production acceptance content checks are rate limited', () => {
  const source = readFileSync('api/index.ts', 'utf8');
  assert.match(source, /miniappContentCheckRateLimit = createRateLimiter\('miniapp-content-check', 10 \* 60 \* 1000, 12\)/);
  assert.match(source, /path === '\/api\/lc\/miniapp\/content-check'\) return miniappContentCheckRateLimit\(req, res, next\)/);
  assert.match(source, /miniappBusinessContentRateLimit = createRateLimiter\([\s\S]{0,180}10 \* 60 \* 1000,[\s\S]{0,80}80/);
  assert.match(source, /miniappBusinessContentRateLimit\(req, res,/);
  assert.match(source, /creatorId \|\| ''/);
});

test('server checks every content chunk before allowing publication', () => {
  const source = readFileSync('api/index.ts', 'utf8');
  assert.match(source, /for \(const chunk of chunks\)/);
  assert.match(source, /checkWechatMiniText\(\s*chunk,/);
  assert.match(source, /if \(!verdict\.allowed\) break/);
});

test('rating and ranking checks include nested dossier drafts', () => {
  const source = readFileSync('api/index.ts', 'utf8');
  for (const scene of ['dm_rating_submit', 'store_rating_submit', 'ranking_submit']) {
    const start = source.indexOf(`businessScene: '${scene}'`);
    assert.notEqual(start, -1, `missing ${scene} middleware`);
    const routeSection = source.slice(start, start + 2400);
    assert.match(routeSection, /objectPayload\((?:req\.body|body)(?:\?\.|\.)(?:newDm|newStore|newSubject)/);
    assert.match(routeSection, /\.workplace/);
    assert.match(routeSection, /\.note/);
    assert.match(routeSection, /\.tags/);
  }
});

test('keeps the review guide aligned with the enforced server-only flow', () => {
  const guide = readFileSync('docs/wechat-miniapp-content-safety.md', 'utf8');
  const readme = readFileSync('miniapp/jumulu/README.md', 'utf8');

  assert.match(guide, /客户端不再先调用独立预检接口/);
  assert.match(guide, /private-contact/);
  assert.match(guide, /wechat_image_safety_required/);
  assert.match(guide, /任务提交失败时，服务端会删除刚写入的本机文件或 COS 对象/);
  assert.match(guide, /每次重定向都会重新验证来源，读取 8 秒超时/);
  assert.match(guide, /单次请求合计最多 18MB/);
  assert.match(guide, /0\.1\.41/);
  assert.match(guide, /服务端在调用微信 `jscode2session` 前验证主动同意与版本/);
  assert.match(guide, /红黑榜信息流卡片、详情页主帖和评论均使用统一举报入口/);
  assert.match(guide, /退出状态不会显示可填写的发布、评价、认领、反馈或账号修改表单/);
  assert.doesNotMatch(guide, /客户端的预检只改善反馈速度/);
  assert.match(readme, /当前 0\.1\.41 范围/);
  assert.match(readme, /登录前主动同意用户协议与隐私政策/);
  assert.match(readme, /红黑榜信息流无需先进入详情即可举报/);
  assert.match(readme, /客户端不再重复预检/);
});
