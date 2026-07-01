# MYINC V2 — Frontend base preservado

Este patch corrige a direção da V2:

- O frontend visual oficial é o `src/` do repositório `Mercyso2/myinc`.
- A pasta `apps/web`, criada por versões simplificadas anteriores, não deve ser usada.
- A arquitetura V2 entra por baixo:
  - Frontend/Vercel controla e enfileira.
  - Supabase organiza banco, fila, storage e logs.
  - Motor Local EXE processa imagem, carrossel e vídeo.

## Validação

```bash
npm install
npm run v2:verify
npm run web:dev
```

O painel deve voltar ao visual base: sidebar escura, logo MYINC, header `MYINC Creative Studio`, cards premium, páginas originais e rotas novas `Fila V2` e `Motor Local`.
