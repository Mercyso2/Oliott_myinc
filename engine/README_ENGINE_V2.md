# MYINC Motor Local V2

Este motor é a terceira camada da arquitetura:

- Frontend web/Vercel: painel e controle.
- Supabase: banco, fila, storage e logs.
- Motor local EXE: processamento pesado com OpenAI.

Configure `.env.engine` na raiz do projeto e rode:

```bash
npm run engine:dev
```

O frontend nunca deve receber a chave OpenAI nem a service role do Supabase.
