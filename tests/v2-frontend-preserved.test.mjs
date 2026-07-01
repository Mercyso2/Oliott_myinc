import fs from 'node:fs';
import assert from 'node:assert/strict';

const mustExist = [
  'src/components/app-layout.tsx',
  'src/components/sidebar-nav.tsx',
  'src/routes/index.tsx',
  'src/routes/fila-v2.tsx',
  'src/routes/motor-local.tsx',
  'src/lib/repositories/post-repository.ts',
  'engine/runtime/main-loop.mjs',
  'supabase/v2/08_FRONTEND_BASE_COMPATIBILITY.sql'
];
for (const file of mustExist) assert.ok(fs.existsSync(file), `${file} ausente`);

const layout = fs.readFileSync('src/components/app-layout.tsx', 'utf8');
assert.match(layout, /APP_VERSION = "2\.0 · Local Engine"/);
const nav = fs.readFileSync('src/components/sidebar-nav.tsx', 'utf8');
assert.match(nav, /Fila V2/);
assert.match(nav, /Motor Local/);

console.log('v2-frontend-preserved ok');
