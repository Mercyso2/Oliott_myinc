import { readFileSync, existsSync } from 'node:fs';
const root = readFileSync('src/routes/__root.tsx','utf8');
const pkg = JSON.parse(readFileSync('package.json','utf8'));
if (!existsSync('src/routes/__root.tsx')) throw new Error('Frontend TanStack em src/routes ausente.');
if (!existsSync('engine/runtime/main-loop.mjs')) throw new Error('Motor local ausente.');
if (!existsSync('supabase/v2/02_CREATE_V2_SCHEMA.sql')) throw new Error('Schema Supabase V2 ausente.');
if (/OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|META_PAGE_ACCESS_TOKEN|WORKER_DEVICE_KEY/.test(root)) throw new Error('Nome de secret encontrada no frontend root.');
if ((pkg.scripts?.['v2:verify'] || '').includes('apps/web')) throw new Error('v2:verify não pode apontar para apps/web simplificado.');
console.log('v2-architecture ok');
