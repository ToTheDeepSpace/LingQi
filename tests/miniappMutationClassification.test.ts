import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

type MutationClass = 'public-ugc' | 'private-content' | 'private-contact' | 'state-only';

type MutationPolicy = {
  method: 'POST' | 'PUT' | 'DELETE';
  route: string;
  class: MutationClass;
  serverRoute?: string;
};

const MUTATION_POLICIES: MutationPolicy[] = [
  { method: 'POST', route: '/lc/account/appeals', class: 'private-content', serverRoute: '/api/lc/account/appeals' },
  { method: 'PUT', route: '/lc/account/notifications/read-all', class: 'state-only' },
  { method: 'PUT', route: '/lc/account/notifications/:param/read', class: 'state-only' },
  { method: 'POST', route: '/lc/auth/bind-phone', class: 'state-only' },
  { method: 'POST', route: '/lc/auth/send-code', class: 'state-only' },
  { method: 'POST', route: '/lc/carpools', class: 'public-ugc', serverRoute: '/api/lc/carpools' },
  { method: 'POST', route: '/lc/carpools/:param/applications', class: 'private-content', serverRoute: '/api/lc/carpools/:id/applications' },
  { method: 'PUT', route: '/lc/carpools/applications/:param/:param', class: 'state-only' },
  { method: 'PUT', route: '/lc/carpools/:param/close', class: 'state-only' },
  { method: 'POST', route: '/lc/commissions', class: 'public-ugc', serverRoute: '/api/lc/commissions' },
  { method: 'POST', route: '/lc/commissions/:param/applications', class: 'private-content', serverRoute: '/api/lc/commissions/:id/applications' },
  { method: 'PUT', route: '/lc/commissions/applications/:param/decision', class: 'state-only' },
  { method: 'PUT', route: '/lc/commissions/:param/close', class: 'state-only' },
  { method: 'PUT', route: '/lc/creators/:param', class: 'public-ugc', serverRoute: '/api/lc/creators/:id' },
  { method: 'POST', route: '/lc/daily-checkin', class: 'state-only' },
  { method: 'DELETE', route: '/lc/dossier-edits/:param', class: 'state-only' },
  { method: 'POST', route: '/lc/dm-dossiers', class: 'public-ugc', serverRoute: '/api/lc/dm-dossiers' },
  { method: 'POST', route: '/lc/dm-ratings', class: 'public-ugc', serverRoute: '/api/lc/dm-ratings' },
  { method: 'POST', route: '/lc/entity-ratings', class: 'public-ugc', serverRoute: '/api/lc/entity-ratings' },
  { method: 'PUT', route: '/lc/follows/cities', class: 'state-only' },
  { method: 'PUT', route: '/lc/follows/stores/:param', class: 'state-only' },
  { method: 'POST', route: '/lc/miniapp/auth/refresh', class: 'state-only' },
  { method: 'POST', route: '/lc/miniapp/auth/wechat', class: 'state-only' },
  { method: 'POST', route: '/lc/provider-listings/mine', class: 'public-ugc', serverRoute: '/api/lc/provider-listings/mine' },
  { method: 'PUT', route: '/lc/provider-listings/mine/active', class: 'state-only' },
  { method: 'PUT', route: '/lc/provider-listings/mine/contact-available', class: 'state-only' },
  { method: 'PUT', route: '/lc/provider-inquiries/:param/decision', class: 'private-contact' },
  { method: 'DELETE', route: '/lc/rankings/:param/comments/:param', class: 'state-only' },
  { method: 'POST', route: '/lc/rankings', class: 'public-ugc', serverRoute: '/api/lc/rankings' },
  { method: 'POST', route: '/lc/rankings/:param/comments', class: 'public-ugc', serverRoute: '/api/lc/rankings/:id/comments' },
  { method: 'DELETE', route: '/lc/rankings/:param/vote?voteType=:param', class: 'state-only' },
  { method: 'POST', route: '/lc/rankings/:param/vote', class: 'public-ugc', serverRoute: '/api/lc/rankings/:id/vote' },
  { method: 'PUT', route: '/lc/rankings/:param/withdraw', class: 'state-only' },
  { method: 'POST', route: '/lc/reports', class: 'private-content', serverRoute: '/api/lc/reports' },
  { method: 'POST', route: '/lc/service-payments/create', class: 'state-only' },
  { method: 'POST', route: '/lc/site-messages', class: 'private-content', serverRoute: '/api/lc/site-messages' },
  { method: 'POST', route: '/lc/store-ratings', class: 'public-ugc', serverRoute: '/api/lc/store-ratings' },
];

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(?:ts|vue)$/.test(entry.name) ? [fullPath] : [];
  });
}

function scriptSource(filePath: string): string {
  const source = readFileSync(filePath, 'utf8');
  if (!filePath.endsWith('.vue')) return source;
  return source.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] || '';
}

function propertyName(node: ts.PropertyName, source: ts.SourceFile): string {
  return node.getText(source).replace(/^['"]|['"]$/g, '');
}

function normalizedRoute(node: ts.Expression): string {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return node.templateSpans.reduce(
      (route, span) => `${route}:param${span.literal.text}`,
      node.head.text,
    );
  }
  return '<dynamic>';
}

function mutationKey(method: string, route: string): string {
  return `${method} ${route}`;
}

function discoveredMiniappMutations(): Map<string, string[]> {
  const mutations = new Map<string, string[]>();
  for (const filePath of sourceFiles('miniapp/jumulu/src')) {
    const sourceText = scriptSource(filePath);
    if (!sourceText) continue;
    const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'apiRequest') {
        const options = node.arguments[1];
        if (options && ts.isObjectLiteralExpression(options)) {
          const methodProperty = options.properties.find(
            (property): property is ts.PropertyAssignment =>
              ts.isPropertyAssignment(property) && propertyName(property.name, source) === 'method',
          );
          if (methodProperty && ts.isStringLiteralLike(methodProperty.initializer)) {
            const method = methodProperty.initializer.text.toUpperCase();
            if (method !== 'GET') {
              const route = node.arguments[0] ? normalizedRoute(node.arguments[0]) : '<missing>';
              const key = mutationKey(method, route);
              const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
              mutations.set(key, [...(mutations.get(key) || []), `${filePath}:${line}`]);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return mutations;
}

function directUploadLocations(): string[] {
  const locations: string[] = [];
  for (const filePath of sourceFiles('miniapp/jumulu/src')) {
    const sourceText = scriptSource(filePath);
    if (!sourceText) continue;
    const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node)
        && ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === 'uni'
        && node.expression.name.text === 'uploadFile'
      ) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        locations.push(`${filePath}:${line}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return locations;
}

test('every miniapp API mutation has an explicit content classification', () => {
  const discovered = discoveredMiniappMutations();
  const classified = new Set(MUTATION_POLICIES.map(policy => mutationKey(policy.method, policy.route)));
  const unclassified = [...discovered.keys()].filter(key => !classified.has(key)).sort();
  const stale = [...classified].filter(key => !discovered.has(key)).sort();

  assert.deepEqual(
    unclassified,
    [],
    `classify new miniapp mutations before merging:\n${unclassified.map(key => `${key} at ${discovered.get(key)?.join(', ')}`).join('\n')}`,
  );
  assert.deepEqual(stale, [], `remove or update stale miniapp mutation policies:\n${stale.join('\n')}`);
});

test('every miniapp text UGC mutation is protected by a server-side WeChat check', () => {
  const serverSource = readFileSync('api/index.ts', 'utf8');
  const textPolicies = MUTATION_POLICIES.filter(
    policy => policy.class === 'public-ugc' || policy.class === 'private-content',
  );
  assert.ok(textPolicies.length > 0);

  for (const policy of textPolicies) {
    assert.ok(policy.serverRoute, `missing server route mapping for ${mutationKey(policy.method, policy.route)}`);
    const escapedRoute = policy.serverRoute!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      serverSource,
      new RegExp(`app\\.(?:post|put)\\(\\s*'${escapedRoute}'[\\s\\S]{0,2000}?wechatMiniTextSafetyMiddleware\\s*\\(\\s*\\{`),
      `miniapp text UGC is not protected on the server: ${mutationKey(policy.method, policy.route)}`,
    );
  }
});

test('private contact exchange stays explicitly classified without sending credentials to WeChat', () => {
  const contactPolicies = MUTATION_POLICIES.filter(policy => policy.class === 'private-contact');
  assert.deepEqual(contactPolicies.map(policy => mutationKey(policy.method, policy.route)), [
    'PUT /lc/provider-inquiries/:param/decision',
  ]);
});

test('miniapp relies on enforced business-route checks instead of duplicate preflight calls', () => {
  const source = sourceFiles('miniapp/jumulu/src')
    .map(filePath => scriptSource(filePath))
    .join('\n');
  assert.doesNotMatch(source, /checkMiniContent|\/lc\/miniapp\/content-check/);
});

test('miniapp upload helpers keep public media and private evidence on separate routes', () => {
  const source = readFileSync('miniapp/jumulu/src/utils/api.ts', 'utf8');
  const uploadLocations = directUploadLocations();
  assert.equal(uploadLocations.length, 3, `classify new miniapp uploads before merging:\n${uploadLocations.join('\n')}`);
  assert.ok(uploadLocations.every(location => location.startsWith('miniapp/jumulu/src/utils/api.ts:')));
  assert.match(source, /uploadImageFile[\s\S]*?url: `\$\{API_BASE\}\/lc\/upload`/);
  assert.match(source, /uploadPrivateEvidence[\s\S]*?\/lc\/reports\/\$\{encoded\(recordId\)\}\/evidence/);
  assert.match(source, /uploadPrivateEvidence[\s\S]*?\/lc\/site-messages\/\$\{encoded\(recordId\)\}\/evidence/);
  assert.match(source, /submitDossierClaim[\s\S]*?\/lc\/dm-dossiers\/\$\{encoded\(input\.dossierId\)\}\/claim/);
});
