import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const fn of ['enqueue-generation','engine-register-worker','engine-save-result','publish-scheduled-posts','admin-status','build-prompt']) {
  const path = `supabase/functions/${fn}/index.ts`;
  assert.ok(fs.existsSync(path), `${fn} ausente`);
  const content = fs.readFileSync(path,'utf8');
  assert.match(content, /OPTIONS/);
}
const enqueue = fs.readFileSync('supabase/functions/enqueue-generation/index.ts','utf8');
assert.ok(!enqueue.includes('api.openai.com'), 'enqueue-generation não pode chamar OpenAI');
console.log('v2-edge-contract ok');
