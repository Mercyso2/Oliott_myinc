# Revisão pós-prompt — MYINC Social Media AI v2.0.0 Local Engine

Data: 2026-06-15

## Resumo executivo

O projeto já tinha uma boa base visual e várias pastas da arquitetura V2, porém ainda havia conflitos importantes entre o frontend antigo, Edge Functions antigas e o novo Motor Local. A revisão removeu as chamadas quebradas de geração pesada pelo frontend/Vercel, corrigiu contratos de fila/publicação e tornou o `v2:verify` realmente forte.

## O que estava avançado

- Frontend principal preservado em `src/`, com rotas de planejamento, conteúdo, calendário, fila, cérebro, biblioteca, logs, admin e motor local.
- Pasta `supabase/v2/` criada com SQL de schema, RLS, buckets, seeds, RPCs, cron/publicação e README.
- Edge Functions V2 presentes: `enqueue-generation`, `build-prompt`, `engine-register-worker`, `engine-save-result`, `publish-scheduled-posts`, `admin-status`.
- Pasta `engine/` criada com runtime local, OpenAI client, processadores, Supabase client e status store.
- Testes V2 iniciais presentes em `tests/`.

## Problemas críticos encontrados

1. `npm run v2:verify` passava sem rodar `typecheck` e `build`, então dava falsa sensação de pronto.
2. `npm run typecheck` falhava em `calendar.tsx`, `conteudos.tsx` e `index.tsx`.
3. `engine-register-worker` estava em modo DEBUG e retornava worker falso.
4. `enqueue-generation` inseria colunas incompatíveis com a tabela V2 (`type`/`payload`), quebrando a criação real de jobs.
5. `engine/runtime/main-loop.mjs` só mantinha heartbeat; ainda não claimava/processava jobs.
6. `conteudos.tsx` chamava `trigger-worker-now`, uma função antiga inexistente/incompatível com a regra de ouro V2.
7. `post-repository.ts` chamava Edge Functions antigas inexistentes: `generation-status`, `publish-meta`, `render-template`, `render-templates-batch`, `autonomous-run`, `improve-post`.
8. `planning-repository.ts` chamava `ai-generate-plan`, que não existe na arquitetura V2 entregue.
9. Administração aceitava/mostrava nomes exatos de secrets no frontend; isso foi endurecido para evitar vazamento no bundle.
10. A tela Fila V2 não tinha retry/cancel/ver prompt/ver erro.

## Correções aplicadas

### Frontend

- Corrigido typecheck em `src/components/ui/calendar.tsx` e adicionado shim `src/types/react-day-picker.d.ts`.
- Ajustado `src/lib/social-types.ts` para reconhecer os status V2 usados no app.
- Ajustado `src/routes/conteudos.tsx` para usar Motor Local, não worker Vercel/Edge pesado.
- `publishPostNow` agora cria entrada em `publish_queue` e não finge publicação.
- `renderPostTemplate` agora apenas marca revisão visual; não roda render pesado no frontend.
- `improvePost` agora cria jobs reais na fila do Motor Local.
- `planning-repository.ts` agora cria rascunho local seguro de planejamento e ideias, sem depender de Edge inexistente.
- `fila-v2.tsx` agora mostra payload/prompt, erro/saída, retry e cancelamento via RPC.
- `motor-local.tsx` agora mostra contadores de jobs pendentes/processando/falhas/concluídos.
- Admin e release foram endurecidos para não carregar nomes exatos de secrets sensíveis no bundle.

### Supabase / Edge

- `engine-register-worker` agora valida `x-worker-device-key` e registra worker real.
- `enqueue-generation` agora cria jobs compatíveis com schema V2 e usa `build_prompt_payload`/`enqueue_post_generation`.
- `_shared/v2-utils.ts` teve export duplicado corrigido.

### Motor local

- `engine/runtime/main-loop.mjs` agora registra worker, envia heartbeat, claima job, processa e salva resultado ou falha.
- Fluxo de resultado passa pela Edge `engine-save-result`, mantendo Storage/tabelas protegidos no Supabase.

### Testes/scripts

- `test:v2` passou a validar frontend preservado, ausência de worker pesado, contrato Edge, contrato Engine, contrato SQL, vazamento de secrets e sintaxe do main-loop.
- `v2:verify` agora roda `typecheck`, `build` e `test:v2`.

## Validação executada nesta revisão

- `npm run typecheck`: aprovado.
- `npm run test:v2`: aprovado.
- `node --check engine/runtime/main-loop.mjs`: aprovado dentro de `test:v2`.
- `npm run build`: não pôde ser validado neste sandbox porque o `node_modules` veio do ZIP em formato Windows/incompleto para Linux; o Vite/Rollup acusou ausência do binário opcional `@rollup/rollup-linux-x64-gnu`. Em máquina limpa, rode `rm -rf node_modules package-lock.json` se necessário, `npm install`, depois `npm run build`.

## Pendências reais que ainda precisam de teste com Supabase real

1. Aplicar SQL em `supabase/v2/` em ambiente de teste e confirmar RLS/RPCs.
2. Confirmar `build_prompt_payload` com dados reais de marca, regras e biblioteca.
3. Rodar `npm run engine:dev` com `.env.engine` real e verificar heartbeat/claim.
4. Testar geração real de imagem com `OPENAI_API_KEY` local.
5. Confirmar upload no bucket `creative-media` e criação de `media_assets`/`post_versions`.
6. Configurar cron de publicação e Meta Graph API antes de publicar post real.
7. Confirmar que `publish-scheduled-posts` não precisa do PC ligado quando cron estiver ativo.

## Ordem recomendada agora

1. Subir esta versão em branch separada.
2. Rodar SQL 00 até 07 no Supabase, respeitando backup e preservação de secrets.
3. Configurar Vercel apenas com variáveis públicas.
4. Configurar `.env.engine` local com anon key, worker key e OpenAI key.
5. Rodar `npm run typecheck`, `npm run build`, `npm run test:v2` após `npm install` limpo.
6. Criar uma campanha de 5 posts, aprovar, enviar para produção, ligar o motor e acompanhar Fila V2.
