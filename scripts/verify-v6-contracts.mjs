import { readFileSync, existsSync } from 'node:fs';

const mustExist = [
  'supabase/patches/MYINC_PATCH_COMPLETO_ESTABILIZACAO_V6_0.sql',
  'supabase/functions/admin-users/index.ts',
  'supabase/functions/generation-status/index.ts',
  'supabase/functions/autonomous-run/index.ts',
  'supabase/functions/publish-meta/index.ts',
  'supabase/functions/engine-save-result/index.ts',
  'supabase/functions/_shared/v2-utils.ts',
];

for (const file of mustExist) {
  if (!existsSync(file)) throw new Error(`Arquivo obrigatório ausente: ${file}`);
}

const sql = readFileSync('supabase/patches/MYINC_PATCH_COMPLETO_ESTABILIZACAO_V6_0.sql', 'utf8');
const requiredSql = [
  'approve_all_post_ideas',
  'convert_approved_ideas_to_posts',
  'approve_convert_enqueue_plan',
  'enqueue_post_generation',
  'claim_next_generation_job',
  'complete_generation_job',
  'fail_generation_job',
  'trigger_worker_now',
  'asset_role',
  'hashtags text[]',
  "('library', 'library', true",
];
for (const token of requiredSql) {
  if (!sql.includes(token)) throw new Error(`Contrato SQL V6 ausente: ${token}`);
}

const conteudos = readFileSync('src/routes/conteudos.tsx', 'utf8');
if (conteudos.includes('<PromptViewer post={post}')) throw new Error('Conteudos ainda usa PromptViewer com prop post.');
if (conteudos.includes('comments={post.comments}')) throw new Error('Conteudos ainda usa post.comments em vez de humanComments.');
if (conteudos.includes('onAdd={(comment)')) throw new Error('HumanCommentsPanel ainda usa onAdd em vez de onAddComment.');

const engineSave = readFileSync('supabase/functions/engine-save-result/index.ts', 'utf8');
if (engineSave.includes('normalizeArray(result.hashtags).join')) throw new Error('engine-save-result ainda converte hashtags para string.');
if (!engineSave.includes('media_assets') || !engineSave.includes('generation_job_assets')) throw new Error('engine-save-result não salva assets auditáveis.');

const shared = readFileSync('supabase/functions/_shared/v2-utils.ts', 'utf8');
if (!shared.includes('export async function systemLog')) throw new Error('systemLog não está exportado no _shared/v2-utils.ts.');

console.log('verify-v6-contracts ok');
