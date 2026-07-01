# Revisão do Frontend — Correção de tela branca

## Problema encontrado
O frontend importava o cliente Supabase imediatamente e chamava validação obrigatória das variáveis públicas no carregamento do módulo. Quando `.env` ainda não estava preenchido, o React nem chegava a renderizar a tela de login/configuração. O resultado prático no navegador era uma tela branca.

## Correção aplicada
1. Removida a validação que derrubava o frontend no carregamento do módulo.
2. Criada flag `isSupabaseConfigured`.
3. Criada tela `SetupRequired`, exibida quando faltam as variáveis públicas do Supabase.
4. Adicionado `ErrorBoundary` global para impedir tela branca em erro runtime.
5. Melhorado o CSS da tela inicial com visual MYINC premium, dark/cobre/off-white.
6. `v2:verify` agora também executa o build do frontend.
7. Criado teste `v2-frontend-blank-screen.test.mjs`.

## Como testar
```powershell
npm install
npm --prefix apps/web install
npm run v2:verify
npm run web:dev
```

Sem `.env`, o painel deve mostrar uma tela de configuração, não branco.
Com `.env` preenchido, o painel deve abrir a tela de login Supabase.
