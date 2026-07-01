# Supabase V2

Execute os SQLs em ordem. O script 00 faz backup de `runtime_secrets`, e o 01 apaga apenas tabelas do app, nunca schemas internos.

Edge Functions obrigatórias:

- `enqueue-generation`: cria jobs, rápido.
- `build-prompt`: monta prompt payload, rápido.
- `engine-register-worker`: registra EXE local com `WORKER_DEVICE_KEY`.
- `engine-save-result`: salva resultado do EXE e completa job.
- `publish-scheduled-posts`: publica mídia pronta na Meta.
- `admin-status`: status sem vazar secrets.

Secrets obrigatórios no Supabase Edge:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WORKER_DEVICE_KEY=
PUBLISH_CRON_SECRET=
META_PAGE_ACCESS_TOKEN=
META_PAGE_ID=
META_INSTAGRAM_BUSINESS_ID=
```
