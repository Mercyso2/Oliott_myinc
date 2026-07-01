import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
function files(dir){return existsSync(dir) ? readdirSync(dir).flatMap(n=>{const p=join(dir,n);return statSync(p).isDirectory()?files(p):[p]}) : []}
for (const f of files('src')) {
  if (!/\.(ts|tsx|js|jsx)$/.test(f)) continue;
  if (f.includes('.server.') || f.includes('/api/')) continue;
  const text = readFileSync(f,'utf8');
  if (/SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY\s*=|META_PAGE_ACCESS_TOKEN\s*=|WORKER_DEVICE_KEY\s*=/.test(text)) throw new Error(`Secret proibida no frontend: ${f}`);
}
const engine = files('engine').map(f=>readFileSync(f,'utf8')).join('\n');
if (/SUPABASE_SERVICE_ROLE_KEY/.test(engine)) throw new Error('Motor local não pode usar service role.');
console.log('v2-no-secret-leak ok');
