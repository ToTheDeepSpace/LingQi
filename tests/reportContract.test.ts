import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function sourceFiles(root: string, extension: RegExp): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath, extension);
    return extension.test(entry.name) ? [fullPath] : [];
  });
}

function literalMatches(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map(match => String(match[1] || '')).filter(Boolean);
}

function serverReportTypes() {
  const server = readFileSync('api/index.ts', 'utf8');
  const declaration = server.match(/const REPORT_TARGET_TYPES:[\s\S]*?=\s*\[([\s\S]*?)\];/)?.[1] || '';
  return new Set(literalMatches(declaration, /'([^']+)'/g));
}

test('website and miniapp report controls only use server-supported targets', () => {
  const supported = serverReportTypes();
  assert.ok(supported.size > 0);

  const miniapp = sourceFiles('miniapp/jumulu/src', /\.vue$/)
    .map(file => readFileSync(file, 'utf8'))
    .join('\n');
  const website = sourceFiles('src', /\.tsx$/)
    .map(file => readFileSync(file, 'utf8'))
    .join('\n');
  const used = new Set([
    ...literalMatches(miniapp, /<ReportFlag\b[^>]*\btarget-type="([^"]+)"/g),
    ...literalMatches(website, /<ReportFlagButton\b[^>]*\btargetType="([^"]+)"/g),
  ]);

  assert.ok(used.size > 0);
  assert.deepEqual([...used].filter(type => !supported.has(type)).sort(), []);
});

test('miniapp reusable report flags identify and hide owner content', () => {
  for (const file of sourceFiles('miniapp/jumulu/src', /\.vue$/)) {
    const source = readFileSync(file, 'utf8');
    const tags = source.match(/<ReportFlag\b[^>]*\/>/g) || [];
    for (const tag of tags) {
      assert.match(tag, /:own=/, `${file} must identify owner content before rendering a report flag`);
    }
  }
});

test('miniapp ranking detail uses the guarded report control for posts and comments', () => {
  const source = readFileSync('miniapp/jumulu/src/pages/rankings/detail.vue', 'utf8');
  assert.match(source, /<ReportFlag target-type="ranking"/);
  assert.match(source, /<ReportFlag target-type="comment"/);
  assert.doesNotMatch(source, /function report\(/);
  assert.doesNotMatch(source, /\/pages\/report\/index\?/);
});

test('the report API rate limits abuse and rejects reporting your own content', () => {
  const server = readFileSync('api/index.ts', 'utf8');
  assert.match(server, /path === '\/api\/lc\/reports'[\s\S]*?reportRateLimit/);
  assert.match(server, /if \(targetOwnerId && targetOwnerId === profile\.id\)/);
  assert.match(server, /自己的内容请使用编辑、撤回或下架入口/);
});
