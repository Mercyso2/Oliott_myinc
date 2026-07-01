import fs from 'node:fs';
import assert from 'node:assert/strict';

assert.ok(fs.existsSync('engine/runtime/main-loop.mjs'), 'engine/runtime/main-loop.mjs ausente');
assert.ok(fs.existsSync('engine/supabase/supabase-client.mjs'), 'engine/supabase/supabase-client.mjs ausente');
const supabase = fs.readFileSync('engine/supabase/supabase-client.mjs','utf8');
assert.match(supabase, /engine-save-result/);
assert.match(supabase, /x-worker-device-key/);
assert.ok(!supabase.includes('SUPABASE_SERVICE_ROLE_KEY'), 'motor local não deve usar service role');
console.log('v2-engine-contract ok');
