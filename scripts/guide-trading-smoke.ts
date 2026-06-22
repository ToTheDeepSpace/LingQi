import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assertContains(file: string, needle: string) {
  const text = read(file);
  if (!text.includes(needle)) {
    throw new Error(`${file} missing ${needle}`);
  }
}

[
  ['src/App.tsx', '/guides'],
  ['src/App.tsx', '/guides/new'],
  ['src/App.tsx', '/guides/income'],
  ['src/lib/routePreload.ts', 'guideIncome'],
  ['src/pages/Guides.tsx', '购买攻略'],
  ['src/pages/CreateGuide.tsx', '盗版'],
  ['src/pages/GuideIncome.tsx', '创作者收入'],
  ['api/index.ts', '/api/lc/guides'],
  ['api/index.ts', 'lc_purchase_guide'],
  ['supabase/migrations/20260623023000_guide_trading.sql', 'CREATE TABLE IF NOT EXISTS public.lc_guides'],
  ['supabase/migrations/20260623023000_guide_trading.sql', 'CREATE OR REPLACE FUNCTION public.lc_purchase_guide'],
].forEach(([file, needle]) => assertContains(file, needle));

console.log('guide trading smoke passed');
