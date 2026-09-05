import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

type ExemptionClass =
  | 'private-credential'
  | 'private-contact'
  | 'private-evidence'
  | 'public-media'
  | 'financial'
  | 'state-only'
  | 'explicit-safety-endpoint';

type ServerWriteRoute = {
  key: string;
  line: number;
  authenticated: boolean;
  adminOnly: boolean;
  wechatTextChecked: boolean;
  wechatImageChecked: boolean;
  acceptsInput: boolean;
};

const EXEMPTIONS = new Map<string, ExemptionClass>([
  ['POST /api/lc/account/wechat-notifications/confirm', 'state-only'],
  ['POST /api/lc/dm-dossiers/:id/store-code-preview', 'private-credential'],
  ['POST /api/lc/auth/bind-phone', 'private-credential'],
  ['POST /api/lc/auth/set-password', 'private-credential'],
  ['POST /api/lc/miniapp/content-check', 'explicit-safety-endpoint'],
  ['POST /api/lc/service-payments/create', 'financial'],
  ['POST /api/lc/miniapp/virtual-service-payments/create', 'financial'],
  ['PUT /api/lc/follows/cities', 'state-only'],
  ['PUT /api/lc/follows/stores/:id', 'state-only'],
  ['PUT /api/lc/provider-listings/mine/active', 'state-only'],
  ['PUT /api/lc/provider-listings/mine/contact-available', 'state-only'],
  ['PUT /api/lc/provider-inquiries/:id/decision', 'private-contact'],
  ['POST /api/lc/upload', 'public-media'],
  ['POST /api/lc/player-script-records', 'state-only'],
  ['PATCH /api/lc/player-script-records/:scriptId', 'state-only'],
  ['POST /api/lc/reports/:id/evidence', 'private-evidence'],
  ['POST /api/lc/site-messages/:id/evidence', 'private-evidence'],
  ['PUT /api/lc/commissions/applications/:id/decision', 'state-only'],
  ['POST /api/lc/guides/withdrawals', 'financial'],
  ['PUT /api/lc/rating-reactions/:targetType/:targetId', 'state-only'],
  ['PUT /api/lc/rankings/:id/withdraw', 'state-only'],
  ['DELETE /api/lc/rankings/:id/vote', 'state-only'],
  ['POST /api/lc/wallet/recharge', 'financial'],
  ['POST /api/lc/wallet/alipay/create', 'financial'],
  ['POST /api/lc/wallet/wechat/create', 'financial'],
]);

function discoverFileRoutes(filePath: string): ServerWriteRoute[] {
  const sourceText = readFileSync(filePath, 'utf8');
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const routes: ServerWriteRoute[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text.toUpperCase();
      const owner = node.expression.expression.getText(source);
      if (owner === 'app' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const routeArgument = node.arguments[0];
        const route = routeArgument && ts.isStringLiteralLike(routeArgument)
          ? routeArgument.text
          : routeArgument?.getText(source) || '<dynamic>';
        const middleware = node.arguments.slice(1, -1).map(argument => argument.getText(source));
        const handler = node.arguments.at(-1)?.getText(source) || '';
        routes.push({
          key: `${method} ${route}`,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          authenticated: middleware.some(value => /\bauthMiddleware\b|\baccountStateMiddleware\b|\bdeps\.auth\b/.test(value)),
          adminOnly: middleware.some(value => /\badminMiddleware\b|\bdeps\.admin\b/.test(value)),
          wechatTextChecked: middleware.some(value => /\bwechatMiniTextSafetyMiddleware\b/.test(value)),
          wechatImageChecked: /\b(?:start|ensure)WechatMiniImageSafetyCheck(?:s)?\s*\(/.test(handler),
          acceptsInput: /req\.body|rankingRequestBody\(req\)|req\.file|req\.files/.test(handler),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return routes;
}

function discoverServerWriteRoutes(): ServerWriteRoute[] {
  return ['api/index.ts','api/storeCertificationRoutes.ts','api/wechatNotificationRoutes.ts'].flatMap(discoverFileRoutes);
}

test('store entitlement routes remain authenticated and revocation admin-only', () => {
  const routes = discoverFileRoutes('api/storeCertificationRoutes.ts');
  assert.equal(routes.length,5);
  assert.ok(routes.every(route => route.authenticated));
  assert.ok(routes.find(route => route.key.endsWith('/:id/revoke'))?.adminOnly);
});

test('notification preference writes remain authenticated', () => {
  const routes = discoverFileRoutes('api/wechatNotificationRoutes.ts');
  assert.equal(routes.length, 3);
  assert.ok(routes.every(route => route.authenticated));
});

test('every authenticated non-admin server write with input is checked or explicitly classified', () => {
  const routes = discoverServerWriteRoutes();
  const unchecked = routes.filter(route =>
    route.authenticated
    && !route.adminOnly
    && route.acceptsInput
    && !route.wechatTextChecked);
  const unclassified = unchecked.filter(route => !EXEMPTIONS.has(route.key));
  const staleExemptions = [...EXEMPTIONS.keys()].filter(key => !unchecked.some(route => route.key === key));

  assert.deepEqual(
    unclassified,
    [],
    `classify or protect new server writes:\n${unclassified.map(route => `${route.key} at api/index.ts:${route.line}`).join('\n')}`,
  );
  assert.deepEqual(
    staleExemptions,
    [],
    `remove stale server write exemptions:\n${staleExemptions.join('\n')}`,
  );
});

test('server write exemptions never use a generic UGC escape hatch', () => {
  const allowedClasses = new Set<ExemptionClass>([
    'private-credential',
    'private-contact',
    'private-evidence',
    'public-media',
    'financial',
    'state-only',
    'explicit-safety-endpoint',
  ]);
  for (const [route, classification] of EXEMPTIONS) {
    assert.ok(allowedClasses.has(classification), `${route} uses an invalid exemption class`);
  }
});

test('every public-media exemption performs a server-side WeChat image check', () => {
  const routes = discoverServerWriteRoutes();
  const missingImageChecks = routes.filter(route =>
    EXEMPTIONS.get(route.key) === 'public-media' && !route.wechatImageChecked);

  assert.deepEqual(
    missingImageChecks,
    [],
    `public media writes need a server-side image check:\n${missingImageChecks
      .map(route => `${route.key} at api/index.ts:${route.line}`)
      .join('\n')}`,
  );
});
