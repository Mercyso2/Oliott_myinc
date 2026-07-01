export const APP_RELEASE = {
  name: "MYINC Social Media AI",
  version: "v2.0.0-local-engine",
  channel: "production-candidate",
  label: "Arquitetura V2 Local Engine",
  date: "2026-06-15",
  githubTag: "v2.0.0-local-engine",
  description:
    "Versão V2 em 3 camadas: frontend controla, Supabase organiza fila/storage/logs, Motor Local EXE executa geração pesada e publicador Edge cuida apenas de mídia pronta.",
} as const;

export const STABILITY_GATES = [
  {
    area: "Segurança",
    status: "aprovado",
    detail:
      "Segredos ficam em variáveis de ambiente/server-side e campos sensíveis são mascarados no Painel ADM.",
  },
  {
    area: "Publicação Meta",
    status: "aprovado",
    detail:
      "Publicação real só ocorre após validação de token, IDs, aprovação do post e URL pública HTTPS.",
  },
  {
    area: "Fluxo editorial",
    status: "aprovado",
    detail:
      "Planejamento, produção, revisão, comentários, calendário e fila estão conectados por estados consistentes.",
  },
  {
    area: "Banco de dados",
    status: "aprovado",
    detail: "Migração Supabase/Postgres inclui as tabelas principais e índices de operação.",
  },
  {
    area: "Build",
    status: "aprovado",
    detail: "Versão validada com lint, build e captura visual da central.",
  },
] as const;

export const REQUIRED_ENV_GROUPS = [
  { group: "Frontend público", keys: ["URL pública do Supabase", "chave anon pública", "URL do app", "ambiente"] },
  { group: "Edge Secrets", keys: ["chave service role", "chave do worker", "segredo do cron", "credenciais Meta"] },
  { group: "Motor Local", keys: ["URL Supabase", "chave anon", "chave do worker", "chave OpenAI local"] },
] as const;
