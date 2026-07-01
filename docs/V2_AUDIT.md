# V2 Audit — decisão arquitetural

O V11 deve ser usado como base de UX/design e conceitos aproveitáveis, não como fluxo final de processamento.

## Problemas corrigidos nesta revisão

1. Fluxo antigo podia processar fila por Edge Function (`process-next-generation-job`), causando timeout e custo em request HTTP.
2. Pacote anterior permitia o motor tentar escrever `posts`, `media_assets`, `post_versions` e Storage com anon key; isso falharia com RLS em produção.
3. Registro/claim do worker precisava validar a chave do EXE em todos os passos.
4. Publicação precisava ser função leve separada, sem depender de geração.
5. Frontend precisava ser aplicação individual e não apenas patch visual.

## Arquitetura validada

- Frontend Vercel: interface, auth, aprovação e chamada de Edge leve.
- Supabase: banco, fila, RLS, Storage, logs, prompt payload e publicação.
- EXE local: geração pesada com OpenAI, 1 job por vez.
- Edge `engine-save-result`: canal seguro para salvar arte gerada e completar job.

## O que não pode voltar

- Chamada OpenAI no frontend.
- Geração pesada no Supabase Edge/Vercel.
- Service role no frontend ou no EXE.
- Sucesso simulado em publicação/vídeo.

## Complemento da revisão de 2026-06-15

Após comparar a implementação com o prompt de arquitetura V2, foram encontrados conflitos remanescentes entre o app antigo e o novo fluxo local-first. Os principais pontos corrigidos foram: `v2:verify` fraco, typecheck quebrado, Edge de registro do worker em DEBUG, `enqueue-generation` incompatível com o schema V2, runtime do motor sem claim/processamento real, frontend chamando funções antigas inexistentes e publicação direta pelo frontend.

Relatório detalhado: `docs/V2_REVIEW_AFTER_PROMPT.md`.
