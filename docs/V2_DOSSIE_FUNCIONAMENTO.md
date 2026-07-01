# Dossiê de Funcionamento - MYINC Social Media AI V2

## Arquitetura

A aplicação V2 é dividida em três camadas independentes:

1. Frontend web na Vercel: painel visual, login, aprovação, calendário, fila, logs, memória da marca e cérebro da IA. Não processa imagem nem vídeo.
2. Supabase: banco central, autenticação, storage, fila, logs, RPCs, Edge Functions leves e publicador agendado.
3. Motor local EXE: worker pesado que roda no computador, claima jobs, chama OpenAI, salva resultados e atualiza status.

## Fluxo principal

1. Usuário acessa o painel web e faz login pelo Supabase Auth.
2. Usuário cria ou aprova posts.
3. Frontend chama a Edge Function `enqueue-generation`.
4. Supabase monta o prompt com `build_prompt_payload` e cria registros em `generation_jobs`.
5. O motor local registra heartbeat, claima um job por vez com lock e processa localmente.
6. O motor local envia o resultado para `engine-save-result`.
7. A Edge Function salva mídia no Storage, cria `media_assets`, cria `post_versions`, atualiza `posts` e completa o job.
8. Usuário revisa no Estúdio e agenda no Calendário.
9. Publicador leve `publish-scheduled-posts` publica mídia pronta na Meta, sem gerar IA.

## Garantias técnicas da revisão

- Não existe chamada OpenAI no frontend.
- Não existe service role no frontend.
- Edge Functions de geração pesada foram proibidas.
- EXE não usa service role.
- EXE salva resultados por Edge Function segura.
- `runtime_secrets` é preservada.
- `drop schema public cascade` não é usado.
- Jobs têm lock, retry, fail e evento.
- Publicação não simula sucesso.
- Vídeo falha claramente sem provider real configurado.

## Limitações reais

- A confirmação 100% em produção depende de aplicar os SQLs no Supabase real, configurar Edge Secrets, configurar `.env.engine`, instalar dependências e executar um teste com chaves reais.
- Publicação via Meta exige permissões e conta Business válidas.
- O modelo de vídeo precisa de provider real antes de liberar jobs de vídeo.
