# MYINC Social Media AI v2.0.0 — Arquitetura em 3 Camadas

Esta entrega é uma aplicação V2 nova, individual e limpa, usando o V11 apenas como referência visual/UX e reaproveitamento conceitual. A arquitetura final separa responsabilidades:

1. **Frontend Web na Vercel (`apps/web`)**
   - Painel visual, login, dashboard, planejamento, aprovação, memória da marca, cérebro da IA, biblioteca, estúdio criativo, calendário, fila, logs e configurações.
   - Usa apenas `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`, `VITE_APP_ENV`.
   - Não chama OpenAI, não possui service role, não processa imagem pesada e não simula sucesso.

2. **Supabase (`supabase/`)**
   - Banco central, Storage, fila, logs, prompts, runtime, Edge Functions leves e publicação agendada.
   - Scripts SQL preservam secrets e nunca usam `reset total do schema public`.
   - Edge Functions leves: enfileirar, montar prompt, registrar/salvar resultado do motor, status e publicação.

3. **Motor Local EXE (`engine/` + `electron/`)**
   - Worker local que roda no computador, em loop, 1 job por vez.
   - Chama OpenAI localmente, salva resultado pelo canal seguro `engine-save-result` e atualiza a fila.
   - Pode rodar oculto/minimizado via Electron/tray.

## Como aplicar

1. Crie uma branch nova:

```bash
git checkout main
git pull
git checkout -b v2/local-engine-architecture
```

2. Copie todo o conteúdo deste pacote para o repositório.

3. Configure Vercel com:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SEU_ANON_KEY
VITE_APP_URL=https://seu-app.vercel.app
VITE_APP_ENV=production
```

4. No Supabase SQL Editor, rode os scripts em ordem:

```txt
supabase/v2/00_BACKUP_RUNTIME_SECRETS.sql
supabase/v2/01_DROP_APP_TABLES_ONLY.sql
supabase/v2/02_CREATE_V2_SCHEMA.sql
supabase/v2/03_CREATE_RLS_POLICIES.sql
supabase/v2/04_CREATE_STORAGE_BUCKETS.sql
supabase/v2/05_SEED_MYINC_BRAIN.sql
supabase/v2/06_CREATE_RPC_QUEUE_FUNCTIONS.sql
supabase/v2/07_CREATE_PUBLISH_SCHEDULE.sql
```

5. Configure Edge Secrets no Supabase:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_key
WORKER_DEVICE_KEY=uma-chave-grande-para-o-exe
PUBLISH_CRON_SECRET=uma-chave-para-cron
META_PAGE_ACCESS_TOKEN=token-da-pagina
META_PAGE_ID=id-da-pagina
META_INSTAGRAM_BUSINESS_ID=id-instagram-business
```

6. Configure o motor local com `.env.engine` baseado em `.env.engine.example`.

7. Rode validação estática:

```bash
npm run v2:verify
```

8. Rode web e motor:

```bash
npm run web:dev
npm run engine:dev
```

## Regras blindadas

- Frontend não gera mídia pesada.
- Supabase Edge não gera imagem/vídeo pesado.
- EXE local executa o processamento pesado.
- Publicação usa função leve e só publica mídia já pronta.
- Nenhuma secret crítica fica no bundle web.
- O motor usa `SUPABASE_WORKER_DEVICE_KEY` e só grava resultado por Edge Function validada.
- Sem `reset total do schema public`.
- Sem n8n e sem VPS obrigatórios.

## Limite honesto

Este pacote foi revisado estaticamente e os scripts Node foram verificados com `node --check`. O funcionamento 100% em produção depende de executar os SQLs no Supabase real, publicar as Edge Functions, configurar secrets reais e testar com uma chave OpenAI/Meta válida.
