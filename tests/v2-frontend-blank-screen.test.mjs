import { readFileSync } from 'node:fs';

const root = readFileSync('src/routes/__root.tsx','utf8');
const supabase = readFileSync('src/lib/supabase/client.ts','utf8');

if (!root.includes('SetupRequired')) throw new Error('Frontend precisa ter tela de configuração para não ficar branco sem .env.');
if (!root.includes('isSupabaseConfigured')) throw new Error('Frontend precisa checar env antes de chamar Supabase.');
if (!supabase.includes('isSupabaseConfigured')) throw new Error('Supabase client precisa expor isSupabaseConfigured.');
if (!root.includes('ErrorBoundary') && !root.includes('ErrorComponent')) throw new Error('Frontend precisa de ErrorBoundary/ErrorComponent para não ficar branco em erro runtime.');
console.log('v2-frontend-blank-screen ok');
