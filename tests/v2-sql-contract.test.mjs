import fs from 'node:fs';
import assert from 'node:assert/strict';

const drop = fs.readFileSync('supabase/v2/01_DROP_APP_TABLES_ONLY.sql','utf8').toLowerCase();
assert.ok(!drop.includes('drop schema public cascade'), 'drop schema public cascade proibido');
assert.ok(drop.includes('runtime_secrets') === false || drop.includes('runtime_secrets_backup'), 'runtime_secrets deve ser preservada');
const rpc = fs.readFileSync('supabase/v2/06_CREATE_RPC_QUEUE_FUNCTIONS.sql','utf8');
assert.match(rpc, /claim_next_generation_job/);
assert.match(rpc, /for update skip locked/);
assert.match(rpc, /enqueue_post_generation/);
const compat = fs.readFileSync('supabase/v2/08_FRONTEND_BASE_COMPATIBILITY.sql','utf8');
assert.match(compat, /monthly_plan_id/);
assert.match(compat, /worker_devices authenticated select/);
console.log('v2-sql-contract ok');
