# MYINC Creative Engine V7 Final

Esta atualização entra direto como versão final do motor criativo, sem modo teste paralelo.

## O que muda

1. A imagem deixa de ser apenas uma mídia base.
2. O motor agora gera uma base visual premium sem texto/logo inventado.
3. Depois o `design-renderer-v2` aplica logo real, headline, subtítulo, CTA, paleta e camadas.
4. Carrosséis usam estrutura editorial por página.
5. Reels/vídeos ganham capa renderizada com identidade real e storyboard/direção sonora.
6. O app desktop/tray foi corrigido para localizar o build real e iniciar o motor local com `.env.engine`.

## Arquivos principais alterados

- `engine/processors/job-processor.mjs`
- `engine/openai/openai-client.mjs`
- `engine/renderers/design-renderer-v2.mjs`
- `engine/runtime/env.mjs`
- `engine/runtime/main-loop.mjs`
- `engine/runtime/status-store.mjs`
- `electron/main.cjs`
- `electron/engine-process.cjs`
- `electron/tray.cjs`
- `supabase/functions/generate-post-content-safe/index.ts`
- `supabase/functions/improve-post/index.ts`
- `supabase/functions/render-template/index.ts`
- `supabase/functions/render-templates-batch/index.ts`
- `supabase/functions/engine-save-result/index.ts`
- `src/lib/repositories/post-repository.ts`
- `src/lib/services/ai-content-service.ts`
- `package.json`
- `.env.engine.example`
- `supabase/patches/MYINC_FINAL_CREATIVE_ENGINE_V7_0.sql`

## Ordem de instalação

1. Faça backup do projeto atual.
2. Copie os arquivos deste patch por cima do projeto.
3. Rode:

```bash
npm install
```

4. No Supabase SQL Editor, rode:

```txt
supabase/patches/MYINC_FINAL_CREATIVE_ENGINE_V7_0.sql
```

5. Faça deploy das Edge Functions alteradas:

```bash
supabase functions deploy generate-post-content-safe --project-ref SEU_PROJECT_REF
supabase functions deploy improve-post --project-ref SEU_PROJECT_REF
supabase functions deploy render-template --project-ref SEU_PROJECT_REF
supabase functions deploy render-templates-batch --project-ref SEU_PROJECT_REF
supabase functions deploy engine-save-result --project-ref SEU_PROJECT_REF
```

6. Rode a validação local:

```bash
npm run creative:v7:check
npm run build
```

7. Rode o motor local:

```bash
npm run engine:dev
```

## Sobre custo

- `CREATIVE_COST_MODE=balanced` mantém qualidade boa sem exagerar.
- `OPENAI_IMAGE_QUALITY=high` aumenta qualidade, mas também custo.
- Para economizar, use `OPENAI_IMAGE_QUALITY=medium` e mantenha `CREATIVE_FINAL_RENDER=1`.
- O render final com logo/texto/paleta é local e não gasta imagem de IA.

## Sobre a logo real

O renderizador procura automaticamente:

- `src/assets/myinc-logo-white.png`
- `src/assets/myinc-logo-dark.png`
- `assets/tray.png`, se existir para a bandeja

Também aceita caminhos manuais no `.env.engine`:

```env
MYINC_LOGO_WHITE_PATH=C:\\caminho\\myinc-logo-white.png
MYINC_LOGO_DARK_PATH=C:\\caminho\\myinc-logo-dark.png
```

## Sobre fotos do rosto

Cadastre as fotos na Biblioteca com `asset_role` ou `usage_context` como:

- `person_reference`
- `rosto`
- `foto pessoal`
- `retrato`
- `autoridade`
- `bastidor`

O motor só usa referência pessoal quando o tema pede autoridade, atendimento, bastidor, depoimento, lifestyle ou prova social.

## Correção do app local na bandeja

O app desktop agora:

- procura `dist/client/index.html`, não mais `apps/web/dist/index.html`;
- inclui `engine/**/*` no pacote desktop;
- usa `asarUnpack` para o motor local;
- procura `.env.engine` no diretório correto;
- cria ícone fallback para a bandeja;
- mostra status do motor em `.myinc-engine/status.json`.
