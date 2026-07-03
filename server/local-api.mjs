import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
let DatabaseSync = null;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch {
  DatabaseSync = null;
}

const rootDir = path.resolve(__dirname, "..");
const dataDir = path.resolve(rootDir, process.env.DATA_DIR || "data");
const uploadDir = path.resolve(dataDir, "uploads");
const dbPath = path.resolve(dataDir, "myinc-local-db.json");
const backupDir = path.resolve(dataDir, "backups");

loadEnv(path.resolve(rootDir, ".env.local"));
loadEnv(path.resolve(rootDir, ".env"));

const DB_DRIVER = String(process.env.DATABASE_DRIVER || process.env.DATABASE_TYPE || "sqlite")
  .toLowerCase()
  .includes("sqlite")
  ? "sqlite"
  : "json";
const sqlitePath = path.resolve(dataDir, process.env.SQLITE_PATH || "myinc.sqlite");
function activeDbPath() {
  return DB_DRIVER === "sqlite" && DatabaseSync ? sqlitePath : dbPath;
}

const PORT = Number(process.env.LOCAL_API_PORT || process.env.APP_PORT || 8787);
const HOST = process.env.LOCAL_API_HOST || "127.0.0.1";
const IS_PRODUCTION = process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
const CORS_ORIGIN = process.env.CORS_ALLOW_ORIGIN || (IS_PRODUCTION ? "null" : "*");
const PUBLIC_BASE = (
  process.env.PUBLIC_MEDIA_BASE_URL ||
  `http://${HOST}:${PORT}/storage/v1/object/public/creative-media`
).replace(/\/$/, "");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const TABLES = [
  "app_users",
  "brands",
  "brand_profiles",
  "brand_voice_rules",
  "brand_visual_rules",
  "brand_products",
  "brand_services",
  "brand_references",
  "brand_forbidden_terms",
  "brand_preferred_terms",
  "brand_assets",
  "brand_color_palette",
  "campaigns",
  "monthly_plans",
  "custom_campaign_themes",
  "post_ideas",
  "posts",
  "post_versions",
  "content_comments",
  "media_assets",
  "library_items",
  "publish_queue",
  "publish_logs",
  "api_connections",
  "admin_settings",
  "settings",
  "templates",
  "ai_brain_rules",
  "ai_prompt_templates",
  "ai_feedbacks",
  "generation_jobs",
  "system_logs",
];

function now() {
  return new Date().toISOString();
}

function uuid() {
  return crypto.randomUUID();
}

function defaultDb() {
  const brandId = uuid();
  const userId = uuid();
  const profileId = uuid();
  const db = Object.fromEntries(TABLES.map((table) => [table, []]));
  db.brands.push({
    id: brandId,
    owner_id: userId,
    name: "MYINC",
    public_name: "MYINC Incorporadora",
    status: "active",
    archived_at: null,
    created_at: now(),
    updated_at: now(),
  });
  db.app_users.push({
    id: userId,
    auth_user_id: "local-admin-user",
    email: (process.env.LOCAL_ADMIN_EMAIL || "rodrigocarvalhosantos@hotmail.com").toLowerCase(),
    full_name: process.env.LOCAL_ADMIN_NAME || "Mauricio",
    role: "admin",
    brand_id: brandId,
    status: "active",
    last_login_at: null,
    created_at: now(),
    updated_at: now(),
  });
  db.brand_profiles.push({
    id: profileId,
    brand_id: brandId,
    site: "https://myinc.com.br",
    instagram: "@myinc",
    facebook: "MYINC",
    whatsapp: "",
    commercial_email: "",
    region: "Londrina e região",
    niche: "Incorporadora e construtora premium",
    segment: "Empreendimentos imobiliários de alto padrão",
    primary_audience:
      "Famílias, investidores e compradores exigentes que buscam imóveis de alto padrão, segurança, localização estratégica e valorização patrimonial.",
    secondary_audience:
      "Pessoas interessadas em arquitetura, acabamento, inovação, qualidade de vida e empreendimentos premium.",
    persona:
      "Cliente visual, racional, exigente e sensível a confiança, acabamento, localização e reputação.",
    problems_solved:
      "Reduz insegurança na compra, transmite confiança e mostra diferenciais reais dos empreendimentos.",
    benefits:
      "Sofisticação, arquitetura funcional, localização estratégica, qualidade construtiva e proximidade com o cliente.",
    differentiators:
      "Arquitetura premium, comunicação elegante, atendimento próximo e foco na experiência do cliente.",
    products: "Empreendimentos residenciais e comerciais premium.",
    services: "Incorporação, construção, atendimento comercial e relacionamento com clientes.",
    average_ticket: "Alto padrão",
    objections:
      "Medo de comprar errado, dúvida sobre valorização, acabamento, entrega, localização e confiança.",
    guarantees:
      "Comunicação transparente, acompanhamento de obras, materiais comerciais e atendimento próximo.",
    social_proof:
      "Empreendimentos, renders, obras, materiais institucionais e histórico de relacionamento.",
    cases: "",
    testimonials: "",
    faq: "Dúvidas sobre empreendimentos, obras, diferenciais, localização, investimento e atendimento.",
    tone: "Premium, humano, claro, sofisticado e direto. Linguagem de incorporadora de alto padrão, sem exageros.",
    communication_style: "Pouco texto, muita clareza, elegância comercial e CTAs objetivos.",
    primary_palette: "Grafite, off-white e laranja/cobre MYINC.",
    secondary_palette: "Tons neutros, areia, preto suave e branco premium.",
    forbidden_colors: "Azul genérico, verde neon, cores infantis ou excesso de saturação.",
    brand_fonts: "Montserrat e fontes sans-serif modernas.",
    preferred_visual_style:
      "Arquitetura premium, luz natural, composição limpa, materiais nobres, lifestyle elegante e pouco texto.",
    forbidden_visual_style:
      "Visual amador, poluído, com texto demais, imagens genéricas ou promessas exageradas.",
    logo_rules: "Preservar respiro, contraste e uso da marca branca em fundos escuros.",
    composition_rules: "Hierarquia forte, foco em imagem, CTA claro e espaço negativo.",
    image_text_rules: "Texto curto, sem poluição e sem frases longas dentro da arte.",
    approved_references:
      "Criativos de incorporadoras premium, arquitetura contemporânea e comunicação sofisticada.",
    bad_references:
      "Posts infantis, sensacionalistas, excesso de emoji ou arte com aparência de panfleto.",
    mantra:
      "Você é o núcleo de inteligência criativa da MYINC, uma incorporadora/construtora premium. Aja como estrategista de social media, copywriter, diretor de arte e revisor de qualidade para conteúdo imobiliário de alto padrão.",
    created_at: now(),
    updated_at: now(),
  });
  const rules = [
    [
      "Mantra MYINC",
      "Planejamento",
      "Agir sempre como social media premium especializado em incorporadoras, construção, arquitetura e mercado imobiliário de alto padrão.",
      10,
    ],
    [
      "Tom de voz",
      "Copy",
      "Comunicação sofisticada, objetiva, elegante, confiante e próxima. Evitar exagero, clichê, sensacionalismo e promessas impossíveis.",
      9,
    ],
    [
      "Direção de arte",
      "Design",
      "Criativos devem transmitir arquitetura premium, luz natural, composição limpa, materiais nobres, pouco texto e aparência de agência.",
      9,
    ],
    [
      "CTA padrão",
      "Copy",
      "Usar CTA claro, elegante e comercial: conheça, fale com a equipe, descubra o empreendimento ou agende uma conversa.",
      8,
    ],
    [
      "Proibido genérico",
      "Imagem",
      "Nunca entregar conteúdo genérico, infantil, poluído, com texto demais na arte ou imagem com aparência amadora.",
      10,
    ],
  ];
  for (const [name, category, content, priority] of rules) {
    db.ai_brain_rules.push({
      id: uuid(),
      brand_id: brandId,
      name,
      category,
      content,
      active: true,
      priority,
      default_content: content,
      archived_at: null,
      created_at: now(),
      updated_at: now(),
    });
  }
  const promptTemplates = [
    {
      name: "Prompt mestre de post premium",
      note: "Base para feed, story, carrossel e Facebook.",
      content:
        "Crie conteúdo premium para a MYINC, incorporadora/construtora de alto padrão. Use arquitetura, sofisticação, confiança, qualidade de vida e CTA claro. Evite linguagem genérica, infantil, sensacionalista e excesso de texto na arte.",
    },
    {
      name: "Prompt visual MYINC",
      note: "Direção de arte para geração de imagens.",
      content:
        "Direção de arte: arquitetura contemporânea, luz natural, materiais nobres, composição limpa, grafite/off-white/laranja-cobre, alto padrão, pouco texto, aparência de agência premium especializada em incorporadoras.",
    },
    {
      name: "Prompt de carrossel",
      note: "Estrutura página a página.",
      content:
        "Para carrossel, criar narrativa página a página: página 1 hook forte, páginas intermediárias valor/diferencial/prova, última página CTA. Cada página precisa ter title, text e visual_prompt próprios.",
    },
    {
      name: "Prompt de Reels/Vídeo",
      note: "Roteiro para Reels com hook nos 3 primeiros segundos.",
      content:
        "Para Reels ou vídeo curto, criar hook_3s, cenas, narração, textos de tela e CTA final. Ritmo premium, visual limpo e foco em empreendimento/arquitetura/benefício real.",
    },
  ];
  for (const template of promptTemplates) {
    db.ai_prompt_templates.push({
      id: uuid(),
      brand_id: brandId,
      ...template,
      active: true,
      version_history: ["seed-local-v1"],
      archived_at: null,
      created_at: now(),
      updated_at: now(),
    });
  }
  db.system_logs.push({
    id: uuid(),
    brand_id: brandId,
    user_id: userId,
    module: "local",
    type: "bootstrap",
    severity: "info",
    status: "sucesso",
    friendly_message: "Banco local MYINC inicializado.",
    technical_detail: "JSON DB local criado com usuário admin e memória da marca.",
    created_at: now(),
  });
  return db;
}

function ensureDbUpgrades(db) {
  for (const table of TABLES) if (!Array.isArray(db[table])) db[table] = [];
  const brand = db.brands[0];
  if (!brand) return db;
  const brandId = brand.id;

  const promptSeeds = [
    [
      "Prompt mestre de post premium",
      "Base para feed, story, carrossel e Facebook.",
      "Crie conteúdo premium para a MYINC, incorporadora/construtora de alto padrão. Use arquitetura, sofisticação, confiança, qualidade de vida e CTA claro. Evite linguagem genérica, infantil, sensacionalista e excesso de texto na arte.",
    ],
    [
      "Prompt visual MYINC",
      "Direção de arte para geração de imagens.",
      "Direção de arte: arquitetura contemporânea, luz natural, materiais nobres, composição limpa, grafite/off-white/laranja-cobre, alto padrão, pouco texto, aparência de agência premium especializada em incorporadoras.",
    ],
    [
      "Prompt de carrossel",
      "Estrutura página a página.",
      "Para carrossel, criar narrativa página a página: página 1 hook forte, páginas intermediárias valor/diferencial/prova, última página CTA. Cada página precisa ter title, text e visual_prompt próprios.",
    ],
    [
      "Prompt de Reels/Vídeo",
      "Roteiro para Reels com hook nos 3 primeiros segundos.",
      "Para Reels ou vídeo curto, criar hook_3s, cenas, narração, textos de tela e CTA final. Ritmo premium, visual limpo e foco em empreendimento/arquitetura/benefício real.",
    ],
  ];
  for (const [name, note, content] of promptSeeds) {
    if (!db.ai_prompt_templates.some((item) => item.brand_id === brandId && item.name === name)) {
      db.ai_prompt_templates.push({
        id: uuid(),
        brand_id: brandId,
        name,
        note,
        content,
        active: true,
        version_history: ["auto-upgrade-local"],
        archived_at: null,
        created_at: now(),
        updated_at: now(),
      });
    }
  }

  for (const post of db.posts) {
    if (!Array.isArray(post.carousel_media_urls)) post.carousel_media_urls = [];
    if (!Array.isArray(post.video_storyboard_urls)) post.video_storyboard_urls = [];
  }
  return db;
}

function createSQLiteClient() {
  if (!DatabaseSync) return null;
  fs.mkdirSync(dataDir, { recursive: true });
  const sqlite = new DatabaseSync(sqlitePath);
  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS local_state (
      table_name TEXT PRIMARY KEY,
      rows_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS local_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return sqlite;
}

function readSQLiteDb() {
  const sqlite = createSQLiteClient();
  if (!sqlite) return null;
  try {
    const rows = sqlite.prepare("select table_name, rows_json from local_state").all();
    if (!rows.length) {
      const initial = fs.existsSync(dbPath)
        ? JSON.parse(fs.readFileSync(dbPath, "utf8"))
        : defaultDb();
      writeSQLiteDb(ensureDbUpgrades(initial));
      return ensureDbUpgrades(initial);
    }
    const db = Object.fromEntries(TABLES.map((table) => [table, []]));
    for (const row of rows) {
      try {
        db[row.table_name] = JSON.parse(row.rows_json || "[]");
      } catch {
        db[row.table_name] = [];
      }
    }
    return ensureDbUpgrades(db);
  } finally {
    sqlite.close();
  }
}

function writeSQLiteDb(db) {
  const sqlite = createSQLiteClient();
  if (!sqlite) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    return;
  }
  try {
    const stamp = now();
    const stmt = sqlite.prepare(`
      insert into local_state (table_name, rows_json, updated_at)
      values (?, ?, ?)
      on conflict(table_name) do update set
        rows_json = excluded.rows_json,
        updated_at = excluded.updated_at
    `);
    sqlite.exec("BEGIN IMMEDIATE");
    for (const table of TABLES) stmt.run(table, JSON.stringify(db[table] || []), stamp);
    sqlite
      .prepare(
        `
      insert into local_meta (key, value, updated_at) values ('schema_version', '3.0.0-local-production-100', ?)
      on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at
    `,
      )
      .run(stamp);
    sqlite.exec("COMMIT");
  } catch (error) {
    try {
      sqlite.exec("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    sqlite.close();
  }
}

function readDb() {
  if (DB_DRIVER === "sqlite" && DatabaseSync) {
    const db = readSQLiteDb();
    if (db) return db;
  }
  if (!fs.existsSync(dbPath)) writeDb(defaultDb());
  const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  return ensureDbUpgrades(db);
}

function writeDb(db) {
  fs.mkdirSync(dataDir, { recursive: true });
  if (DB_DRIVER === "sqlite" && DatabaseSync) {
    writeSQLiteDb(ensureDbUpgrades(db));
    fs.writeFileSync(dbPath, JSON.stringify(ensureDbUpgrades(db), null, 2));
    return;
  }
  fs.writeFileSync(dbPath, JSON.stringify(ensureDbUpgrades(db), null, 2));
}

function requestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function send(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,prefer,x-upsert",
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text, headers = {}) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,prefer,x-upsert",
    ...headers,
  });
  res.end(text);
}

function getAuthUser(db, req) {
  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const parts = token.split(":");
  if (parts[0] === "local" && parts[1]) {
    return db.app_users.find((u) => u.auth_user_id === parts[1]) || db.app_users[0] || null;
  }
  return db.app_users[0] || null;
}

function normalizeLogin(login) {
  return String(login || "").includes("@") ? String(login).toLowerCase() : `${login}@myinc.local`;
}

function comparePassword(password) {
  const configured = process.env.LOCAL_ADMIN_PASSWORD;
  if (!configured) return false;
  return String(password || "") === String(configured);
}

function normalizeFunctionName(name = "") {
  const raw = String(name || "").trim();
  const aliases = {
    generate_images_batch: "generate-images-batch",
    generateImagesBatch: "generate-images-batch",
    "generate-all-images": "generate-images-batch",
    "generate-media-batch": "generate-images-batch",
    "generate-medias-batch": "generate-images-batch",
    generate_videos_batch: "generate-videos-batch",
    generateVideosBatch: "generate-videos-batch",
    "generate-video-batch": "generate-videos-batch",
    autonomous_run: "autonomous-run",
    autonomousRun: "autonomous-run",
    "auto-run": "autonomous-run",
    "run-autonomous": "autonomous-run",
  };
  return aliases[raw] || raw;
}

function matchesFilter(row, key, opValue) {
  const [op, ...rest] = opValue.split(".");
  const value = rest.join(".");
  const rowValue = row[key];
  if (op === "eq") return String(rowValue ?? "") === decodeURIComponent(value);
  if (op === "neq") return String(rowValue ?? "") !== decodeURIComponent(value);
  if (op === "is") {
    if (value === "null") return rowValue === null || rowValue === undefined;
    if (value === "true") return rowValue === true;
    if (value === "false") return rowValue === false;
  }
  if (op === "not" && value === "is.null") return rowValue !== null && rowValue !== undefined;
  if (op === "in") {
    const clean = value.replace(/^\(/, "").replace(/\)$/, "");
    const set = clean.split(",").map((item) => decodeURIComponent(item.trim()));
    return set.includes(String(rowValue));
  }
  return true;
}

function applyQuery(rows, url) {
  let result = [...rows];
  const ignored = new Set(["select", "order", "limit", "offset", "on_conflict"]);
  for (const [key, value] of url.searchParams.entries()) {
    if (ignored.has(key)) continue;
    result = result.filter((row) => matchesFilter(row, key, value));
  }
  const order = url.searchParams.get("order");
  if (order) {
    const [field, direction = "asc"] = order.split(".");
    result.sort((a, b) => {
      const av = a[field] ?? "";
      const bv = b[field] ?? "";
      if (av < bv) return direction === "desc" ? 1 : -1;
      if (av > bv) return direction === "desc" ? -1 : 1;
      return 0;
    });
  }
  const limit = Number(url.searchParams.get("limit") || 0);
  if (limit > 0) result = result.slice(0, limit);
  return result;
}

function ensureRow(row) {
  const current = now();
  return {
    id: row.id || uuid(),
    created_at: row.created_at || current,
    updated_at: row.updated_at || current,
    ...row,
  };
}

function tableUpsert(db, table, rows, onConflict) {
  const records = Array.isArray(rows) ? rows : [rows];
  const target = db[table] || (db[table] = []);
  const conflictKey = onConflict || "id";
  const out = [];
  for (const raw of records) {
    const row = ensureRow(raw);
    const existingIndex = target.findIndex(
      (item) =>
        item[conflictKey] &&
        row[conflictKey] &&
        String(item[conflictKey]) === String(row[conflictKey]),
    );
    if (existingIndex >= 0) {
      target[existingIndex] = {
        ...target[existingIndex],
        ...row,
        id: target[existingIndex].id,
        updated_at: now(),
      };
      out.push(target[existingIndex]);
    } else {
      target.push(row);
      out.push(row);
    }
  }
  return out;
}

function log(db, patch) {
  const user = db.app_users[0];
  const brandId = patch.brand_id || user?.brand_id || db.brands[0]?.id || null;
  db.system_logs.unshift({
    id: uuid(),
    brand_id: brandId,
    user_id: patch.user_id || user?.id || null,
    module: patch.module || "local",
    type: patch.type || "system",
    severity: patch.severity || "info",
    status: patch.status || "sucesso",
    friendly_message: patch.friendly_message || "Ação local executada.",
    technical_detail: patch.technical_detail || "",
    post_id: patch.post_id || null,
    created_at: now(),
  });
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function distributeFormats(formats) {
  if (!formats || typeof formats !== "object") return [];
  const out = [];
  for (const [format, quantity] of Object.entries(formats)) {
    for (let i = 0; i < Number(quantity || 0); i++) out.push(format);
  }
  return out.length
    ? out
    : ["Feed 1080x1350", "Story 1080x1920", "Reels 1080x1920", "Carrossel 5 páginas"];
}

// Gera ideias reais chamando a IA com o contexto de marca do Cérebro IA local.
// Sem template fixo: se a IA falhar ou não retornar ideias, o erro sobe
// intacto e nenhum plano é salvo — conteúdo artificial é proibido.
async function generateIdeasWithAI(db, payload, brandIdForContext) {
  const total = Math.max(1, Math.min(120, Number(payload.totalPosts || 30)));
  const formats = distributeFormats(payload.formats);
  const channels =
    Array.isArray(payload.channels) && payload.channels.length
      ? payload.channels
      : ["Instagram", "Facebook"];
  const context = buildBrainContext(db, brandIdForContext);
  const formatSequence = Array.from({ length: total }, (_, i) => formats[i % formats.length] || "Feed 1080x1350");
  const channelSequence = Array.from({ length: total }, (_, i) => channels[i % channels.length] || "Instagram");

  const system = [
    "Você é o estrategista-chefe de conteúdo da MYINC, especializado em incorporadoras premium, arquitetura, engenharia e vendas consultivas.",
    "Crie ideias com profundidade estratégica, linguagem sofisticada e visão de campanha real; nunca genéricas ou repetitivas entre si.",
    "Responda somente JSON válido com as chaves strategy (string) e ideas (array).",
  ].join("\n");
  const userPrompt = JSON.stringify({
    task: "monthly_plan_local",
    context: context.text,
    exact_total: total,
    format_sequence: formatSequence,
    channel_sequence: channelSequence,
    monthly_objective: payload.monthlyObjective || payload.objective || "Autoridade e conversão consultiva",
    pillars: payload.pillars,
    campaign: payload.campaign,
    required_schema: {
      strategy: "string",
      ideas: [{
        theme: "string", headline: "string", hook: "string", angle: "string",
        pain_point: "string", objective: "string", short_text: "string",
        cta: "string", visual_idea: "string", initial_prompt: "string", why_this_post_matters: "string",
        content_pillar: "string", channel: "Instagram|Facebook|Ambos", format: "string", predicted_score: 90,
      }],
    },
  });

  const ai = await askOpenAIJson(system, userPrompt);
  const rawIdeas = Array.isArray(ai.ideas) ? ai.ideas : [];
  return { ai, rawIdeas, total, formatSequence, channelSequence };
}

// Sem fallback fabricado: conteúdo artificial é proibido. IA ausente/falhando
// deve gerar um erro real, nunca um objeto de template disfarçado de IA.
async function askOpenAIJson(system, user) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY ausente. Conteúdo artificial é proibido — configure a chave para gerar com IA real.",
    );
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-5.2",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI texto falhou.");
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI não retornou conteúdo.");
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`JSON inválido retornado pela IA: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function getMimeByPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  return "application/octet-stream";
}

async function uploadPublicMedia(filePath, publicId, resourceType = "auto") {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !apiKey || !apiSecret || !fs.existsSync(filePath)) return null;
  const folder = process.env.CLOUDINARY_FOLDER || "myinc-social-media-ai";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const safePublicId = `${folder}/${makeSafeFileText(publicId || path.basename(filePath, path.extname(filePath)), 80)}`;
  const toSign = `public_id=${safePublicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append(
    "file",
    new Blob([buffer], { type: getMimeByPath(filePath) }),
    path.basename(filePath),
  );
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  form.append("public_id", safePublicId);
  const endpoint = `https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/upload`;
  const response = await fetch(endpoint, { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data?.error?.message || "Falha ao enviar mídia pública para Cloudinary.");
  return data.secure_url || data.url || null;
}

async function publicUrlForGeneratedFile(filePath, fileName, publicId, resourceType = "auto") {
  try {
    const cloudinaryUrl = await uploadPublicMedia(filePath, publicId || fileName, resourceType);
    if (cloudinaryUrl) return cloudinaryUrl;
  } catch (error) {
    // Não bloqueia o fluxo local; apenas registra que a URL pública falhou.
    console.warn("Cloudinary indisponível:", error instanceof Error ? error.message : error);
  }
  return `${PUBLIC_BASE}/${fileName}`;
}

function truthyEnv(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") return defaultValue;
  return ["1", "true", "yes", "sim", "on"].includes(String(value).toLowerCase());
}

function strictAiMode() {
  // Estrito por padrão: imagem é IA real ou o job falha. Placeholder SVG só
  // com AI_STRICT_MODE=false explícito (prévia local, nunca produção).
  return truthyEnv("AI_STRICT_MODE", true) || truthyEnv("PRODUCTION_MEDIA_STRICT", false);
}

function isValidPublicHttps(url) {
  return /^https:\/\//i.test(String(url || ""));
}

function chooseImageSizeForPost(post, suffix = "") {
  const format = String(post.format || "").toLowerCase();
  const channel = String(post.channel || "").toLowerCase();
  if (
    format.includes("story") ||
    format.includes("reels") ||
    format.includes("vídeo") ||
    format.includes("video") ||
    suffix.includes("video")
  ) {
    return "1024x1536";
  }
  if (format.includes("facebook") && !format.includes("story")) return "1536x1024";
  if (format.includes("quadrado") || format.includes("square") || channel.includes("avatar"))
    return "1024x1024";
  return "1024x1536";
}

function mediaExtensionFromFormat(format = "png") {
  const clean = String(format || "png").toLowerCase();
  if (["jpg", "jpeg"].includes(clean)) return "jpg";
  if (clean === "webp") return "webp";
  if (clean === "mp4") return "mp4";
  if (clean === "svg") return "svg";
  return "png";
}

function detectImageMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)
    return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.slice(0, 4).toString("ascii") === "RIFF" &&
    buffer.slice(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp";
  return null;
}

function detectVideoMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  // MP4 normalmente contém ftyp nos primeiros bytes.
  if (buffer.slice(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  return null;
}

function assertGeneratedImageBuffer(buffer, expected = "image") {
  const mime = detectImageMime(buffer);
  if (!mime) throw new Error(`${expected}: o provedor não retornou PNG/JPEG/WEBP válido.`);
  if (buffer.length < 20_000)
    throw new Error(
      `${expected}: arquivo muito pequeno para ser imagem final (${buffer.length} bytes).`,
    );
  return mime;
}

function assertGeneratedVideoBuffer(buffer) {
  const mime = detectVideoMime(buffer);
  if (!mime) throw new Error("OpenAI Videos não retornou MP4 válido.");
  if (buffer.length < 80_000)
    throw new Error(`MP4 muito pequeno para vídeo final (${buffer.length} bytes).`);
  return mime;
}

function buildProductionImagePrompt(db, post, promptOverride = "", suffix = "") {
  const context = buildBrainContext(db, post.brand_id);
  const profile = context.profile || {};
  const format = post.format || "Feed 4:5";
  const isVertical = chooseImageSizeForPost(post, suffix) === "1024x1536";
  const base =
    promptOverride || post.image_prompt || post.creative_brief || post.visual_idea || post.title;
  const safeText = [post.headline, post.cta].filter(Boolean).join(" | ").slice(0, 130);
  return [
    `Crie uma imagem PUBLICITÁRIA premium para social media da MYINC Incorporadora.`,
    `Tema/post: ${post.title || post.theme || "MYINC"}.`,
    `Brief principal: ${base}.`,
    `Formato: ${format}; proporção ${isVertical ? "vertical 4:5 ou 9:16" : "horizontal/quadrado conforme canal"}; size ${chooseImageSizeForPost(post, suffix)}.`,
    `Direção de arte obrigatória: arquitetura contemporânea brasileira de alto padrão, luz natural cinematográfica, materiais nobres, concreto/vidro/madeira/pedra, composição limpa, espaço negativo elegante, profundidade realista, estética de agência premium imobiliária.`,
    `Paleta MYINC: grafite profundo, off-white, areia, cobre/laranja discreto; contraste sofisticado; sem cores neon.`,
    `Texto na arte: mínimo e legível. Use no máximo uma frase curta se necessário: "${safeText || "MYINC"}". Se houver dúvida, prefira SEM texto e deixe espaço seguro para overlay no editor.`,
    `Marca: não inventar logo, não deformar marca, não colocar marcas de terceiros.`,
    `Qualidade: render/foto hiper-realista, sem aparência genérica de banco de imagem, sem pessoas deformadas, sem mãos, sem placas ilegíveis, sem letras quebradas, sem excesso de elementos.`,
    `Contexto da marca: ${profile.tone || "premium, humano, claro, sofisticado e direto"}. ${profile.preferred_visual_style || "Arquitetura premium, luz natural, composição limpa e pouco texto."}`,
    `Regras do cérebro IA: ${context.rules
      .slice(0, 8)
      .map((r) => `${r.name}: ${r.content}`)
      .join(" | ")}`,
    `Negative prompt: baixa qualidade, amador, panfleto, texto longo, texto distorcido, watermark, logo falso, mockup genérico, excesso de emoji, infantil, saturação exagerada, layout poluído, erro anatômico, arte barata.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function saveMediaBuffer(buffer, post, suffix, ext, resourceType) {
  const safeSuffix = suffix ? `-${makeSafeFileText(suffix, 40)}` : "";
  const fileName = `${post.id}${safeSuffix}-${Date.now()}.${ext}`;
  const storagePath = path.join(uploadDir, "creative-media");
  fs.mkdirSync(storagePath, { recursive: true });
  const filePath = path.join(storagePath, fileName);
  fs.writeFileSync(filePath, buffer);
  return { fileName, filePath, publicId: `${post.id}${safeSuffix}`, resourceType };
}

async function callOpenAIImage(prompt, post, suffix = '') {
  const key = process.env.OPENAI_API_KEY || process.env.IMAGE_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY ausente. Gere imagens reais configurando a chave no .env.');

  const isGpt = (model = '') => String(model).toLowerCase().startsWith('gpt-image');
  const isDalle = (model = '') => String(model).toLowerCase().startsWith('dall-e');
  const normalizeFormat = (format = 'png') => {
    const f = String(format || 'png').trim().toLowerCase().replace('jpg', 'jpeg');
    return ['png', 'jpeg', 'webp'].includes(f) ? f : 'png';
  };
  const parseSize = (size = '') => {
    const match = String(size).match(/(\d+)\s*x\s*(\d+)/i);
    return match ? { w: Number(match[1]), h: Number(match[2]) } : { w: 1024, h: 1536 };
  };
  const normalizeSize = (model, requestedSize) => {
    const { w, h } = parseSize(requestedSize);
    const square = Math.abs(w - h) < Math.max(w, h) * 0.08;
    const landscape = w > h;
    const m = String(model || '').toLowerCase();
    if (isGpt(m)) return square ? '1024x1024' : landscape ? '1536x1024' : '1024x1536';
    if (m === 'dall-e-3') return square ? '1024x1024' : landscape ? '1792x1024' : '1024x1792';
    if (m === 'dall-e-2') return '1024x1024';
    return square ? '1024x1024' : landscape ? '1536x1024' : '1024x1536';
  };
  const normalizeQuality = (model, quality = 'medium') => {
    const q = String(quality || 'medium').trim().toLowerCase();
    const m = String(model || '').toLowerCase();
    if (m === 'dall-e-3') return q === 'high' || q === 'hd' ? 'hd' : 'standard';
    if (m === 'dall-e-2') return undefined;
    return ['low', 'medium', 'high'].includes(q) ? q : 'medium';
  };
  const buildBody = (model) => {
    const size = normalizeSize(model, chooseImageSizeForPost(post, suffix));
    const outputFormat = normalizeFormat(process.env.OPENAI_IMAGE_FORMAT || 'png');
    const quality = normalizeQuality(model, process.env.OPENAI_IMAGE_QUALITY || 'medium');
    const base = { model, prompt, size, n: 1 };
    if (isGpt(model)) return { body: { ...base, quality, output_format: outputFormat }, size, quality, outputFormat };
    if (isDalle(model)) {
      const body = { ...base, response_format: 'b64_json' };
      if (quality) body.quality = quality;
      return { body, size, quality, outputFormat: 'png' };
    }
    return { body: { ...base, quality, output_format: outputFormat }, size, quality, outputFormat };
  };

  const requestedModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const fallbackModels = (process.env.OPENAI_IMAGE_FALLBACK_MODELS || 'gpt-image-1,gpt-image-1-mini').split(',').map((x) => x.trim()).filter(Boolean);
  const models = [...new Set([requestedModel, ...fallbackModels])];
  const errors = [];

  for (const model of models) {
    const request = buildBody(model);
    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`${data?.error?.message || `OpenAI imagem falhou com ${model}`} | payload=${JSON.stringify({ model, size: request.size, quality: request.quality, output_format: request.outputFormat })}`);

      let buffer = null;
      const b64 = data?.data?.[0]?.b64_json;
      if (b64) buffer = Buffer.from(b64, 'base64');
      else if (data?.data?.[0]?.url) {
        const media = await fetch(data.data[0].url);
        if (!media.ok) throw new Error(`Download da URL retornada pela OpenAI falhou: HTTP ${media.status}`);
        buffer = Buffer.from(await media.arrayBuffer());
      }
      if (!buffer) throw new Error(`OpenAI ${model} não retornou b64_json nem URL.`);
      const mime = assertGeneratedImageBuffer(buffer, `OpenAI ${model}`);
      return { buffer, model, mime, revisedPrompt: data?.data?.[0]?.revised_prompt || null, usage: data?.usage || null };
    } catch (error) {
      errors.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Falha em todos os modelos de imagem. ${errors.join(' | ')}`);
}


async function renderSafeTemplateFallback(db, post, suffix = "feed", page = null) {
  if (strictAiMode()) {
    throw new Error(
      "Imagem real não foi gerada e AI_STRICT_MODE está ativo. Nenhum placeholder foi aceito como produção.",
    );
  }
  const storagePath = path.join(uploadDir, "creative-media");
  fs.mkdirSync(storagePath, { recursive: true });
  const safeSuffix = suffix ? `-${makeSafeFileText(suffix, 40)}` : "";
  const fileName = `${post.id}${safeSuffix}-${Date.now()}.svg`;
  const filePath = path.join(storagePath, fileName);
  fs.writeFileSync(filePath, templateSvgForPost(post, suffix, page));
  const url = await publicUrlForGeneratedFile(
    filePath,
    fileName,
    `${post.id}${safeSuffix}`,
    "image",
  );
  log(db, {
    brand_id: post.brand_id,
    post_id: post.id,
    module: "media-fallback",
    severity: "warning",
    status: "alerta",
    friendly_message:
      "Imagem real indisponível; gerado template SVG seguro para prévia, não marcado como IA final.",
    technical_detail: `fallback=${fileName}`,
  });
  return { url, fileName, filePath, kind: "template_svg", isAiGenerated: false };
}

function buildVideoPrompt(db, post, script) {
  const context = buildBrainContext(db, post.brand_id);
  const scenes = Array.isArray(script?.scenes)
    ? script.scenes.join(" | ")
    : JSON.stringify(script || {});
  return [
    `Vídeo/Reels vertical premium para MYINC Incorporadora, arquitetura contemporânea brasileira de alto padrão.`,
    `Tema: ${post.title || post.theme || post.headline}.`,
    `Hook 0-3s: ${script?.hook_3s || post.headline || "Um novo olhar para viver bem"}.`,
    `Cenas: ${scenes}.`,
    `Movimento: câmera suave, travelling lento, reveal de fachada/interiores, detalhes de materiais nobres, luz natural cinematográfica, sem movimentos bruscos.`,
    `Estética: imobiliário alto padrão, sofisticado, limpo, premium, grafite/off-white/cobre discreto, sem visual genérico.`,
    `Texto na tela: mínimo, legível, português do Brasil, sem letras distorcidas. CTA final: ${post.cta || "Fale com a equipe MYINC"}.`,
    `Evitar: pessoas deformadas, mãos, logo falso, watermark, textos quebrados, visual panfleto, excesso de elementos, promessas exageradas.`,
    `Tom da marca: ${context.profile.tone || "premium, humano, claro, sofisticado e direto"}.`,
  ].join("\n");
}

async function openAiVideoCreateAndDownload(db, post, script) {
  if (!truthyEnv("ENABLE_OPENAI_VIDEO", false)) return null;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY ausente para geração real de vídeo.");
  const prompt = buildVideoPrompt(db, post, script);
  const model = process.env.OPENAI_VIDEO_MODEL || "sora-2-pro";
  const seconds = String(process.env.OPENAI_VIDEO_SECONDS || "8");
  const size = process.env.OPENAI_VIDEO_SIZE || "1080x1920";
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("seconds", seconds);
  form.append("size", size);
  const started = await fetch("https://api.openai.com/v1/videos", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const startJson = await started.json().catch(() => ({}));
  if (!started.ok) throw new Error(startJson?.error?.message || JSON.stringify(startJson));
  const videoId = startJson.id;
  if (!videoId) throw new Error("OpenAI Videos não retornou id do job.");
  post.video_job_id = videoId;
  post.video_status = startJson.status || "queued";
  const maxSeconds = Number(process.env.OPENAI_VIDEO_POLL_TIMEOUT_SECONDS || 240);
  const pollEvery = Math.max(5, Number(process.env.OPENAI_VIDEO_POLL_INTERVAL_SECONDS || 12));
  const deadline = Date.now() + maxSeconds * 1000;
  let status = startJson;
  while (["queued", "in_progress"].includes(String(status.status)) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollEvery * 1000));
    const res = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    status = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(status?.error?.message || `Falha ao consultar vídeo ${videoId}`);
    post.video_status = status.status || post.video_status;
    post.video_progress = status.progress ?? post.video_progress ?? 0;
  }
  if (String(status.status) !== "completed") {
    log(db, {
      brand_id: post.brand_id,
      post_id: post.id,
      module: "openai-video",
      severity: "warning",
      status: "alerta",
      friendly_message: "Vídeo OpenAI ainda não concluiu dentro do tempo configurado.",
      technical_detail: JSON.stringify({
        videoId,
        status: status.status,
        progress: status.progress,
      }),
    });
    return { pending: true, videoId, status };
  }
  const content = await fetch(`https://api.openai.com/v1/videos/${videoId}/content`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!content.ok) throw new Error(`Falha ao baixar MP4 do vídeo ${videoId}: ${content.status}`);
  const buffer = Buffer.from(await content.arrayBuffer());
  assertGeneratedVideoBuffer(buffer);
  const saved = saveMediaBuffer(buffer, post, "reels-openai", "mp4", "video");
  const url = await publicUrlForGeneratedFile(
    saved.filePath,
    saved.fileName,
    saved.publicId,
    "video",
  );
  return { url, prompt, model, videoId, status, fileName: saved.fileName };
}

function localFileFromPublicUrl(url) {
  try {
    const name = decodeURIComponent(
      String(url || "")
        .split("/")
        .pop() || "",
    );
    if (!name) return null;
    const filePath = path.join(uploadDir, "creative-media", name);
    return fs.existsSync(filePath) ? filePath : null;
  } catch {
    return null;
  }
}

async function generateLocalVideoMp4(db, post, script) {
  // Primeiro tenta vídeo IA real com OpenAI Videos/Sora, quando habilitado.
  try {
    const openAiVideo = await openAiVideoCreateAndDownload(db, post, script);
    if (openAiVideo?.url) return openAiVideo.url;
    if (openAiVideo?.pending) return null;
  } catch (error) {
    log(db, {
      brand_id: post.brand_id,
      post_id: post.id,
      module: "openai-video",
      severity: strictAiMode() ? "error" : "warning",
      status: strictAiMode() ? "erro" : "alerta",
      friendly_message: strictAiMode()
        ? "Vídeo real falhou e modo estrito bloqueou fallback."
        : "Vídeo OpenAI falhou; mantendo storyboard/capa e tentando preview FFmpeg se habilitado.",
      technical_detail: error instanceof Error ? error.message : String(error),
    });
    if (strictAiMode()) throw error;
  }

  // Fallback honesto: MP4 simples de prévia, nunca vendido como vídeo IA final.
  if (!truthyEnv("ENABLE_LOCAL_FFMPEG_VIDEO", false)) return null;
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const fileName = `${post.id}-video-preview-${Date.now()}.mp4`;
  const filePath = path.join(uploadDir, "creative-media", fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const duration = Number(process.env.LOCAL_VIDEO_DURATION_SECONDS || 8);
  const title = makeSafeFileText(post.headline || post.title || "MYINC", 70);
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0x0d0a08:s=1080x1920:d=${duration}`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=220:duration=${duration}`,
    "-vf",
    `drawtext=text='MYINC':fontcolor=0xF58220:fontsize=72:x=90:y=150,drawtext=text='${title.replace(/[:'\\]/g, " ")}':fontcolor=white:fontsize=48:x=90:y=760:box=1:boxcolor=black@0.25:boxborderw=24`,
    "-shortest",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    filePath,
  ];
  const result = spawnSync(ffmpeg, args, { stdio: "ignore" });
  if (result.status !== 0 || !fs.existsSync(filePath)) {
    log(db, {
      brand_id: post.brand_id,
      post_id: post.id,
      module: "video-render",
      severity: "warning",
      status: "alerta",
      friendly_message: "FFmpeg não gerou MP4; mantendo storyboard e capa.",
      technical_detail: `Comando FFmpeg indisponível ou falhou para ${title}. Instale ffmpeg ou habilite OPENAI_VIDEO.`,
    });
    return null;
  }
  return publicUrlForGeneratedFile(filePath, fileName, `${post.id}-video-preview`, "video");
}

async function generateImage(db, post, promptOverride, suffix = "") {
  const prompt = buildProductionImagePrompt(db, post, promptOverride, suffix);
  try {
    const result = await callOpenAIImage(prompt, post, suffix);
    const ext = mediaExtensionFromFormat(
      process.env.OPENAI_IMAGE_FORMAT ||
        (result.mime === "image/webp" ? "webp" : result.mime === "image/jpeg" ? "jpg" : "png"),
    );
    const saved = saveMediaBuffer(result.buffer, post, suffix || "feed", ext, "image");
    const url = await publicUrlForGeneratedFile(
      saved.filePath,
      saved.fileName,
      saved.publicId,
      "image",
    );
    log(db, {
      brand_id: post.brand_id,
      post_id: post.id,
      module: "openai-image",
      status: "sucesso",
      friendly_message: "Imagem real gerada, validada e salva.",
      technical_detail: JSON.stringify({
        model: result.model,
        mime: result.mime,
        size: chooseImageSizeForPost(post, suffix),
        file: saved.fileName,
        usage: result.usage,
      }),
    });
    return url;
  } catch (error) {
    log(db, {
      brand_id: post.brand_id,
      post_id: post.id,
      module: "openai-image",
      severity: strictAiMode() ? "error" : "warning",
      status: strictAiMode() ? "erro" : "alerta",
      friendly_message: strictAiMode()
        ? "Imagem real falhou e modo estrito bloqueou fallback."
        : "Imagem real falhou; gerando template seguro de prévia sem fingir PNG.",
      technical_detail: error instanceof Error ? error.message : String(error),
    });
    if (strictAiMode()) throw error;
    const fallback = await renderSafeTemplateFallback(db, post, suffix || "feed");
    return fallback.url;
  }
}

function escapeXml(str) {
  return String(str).replace(
    /[<>&'"]/g,
    (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[ch],
  );
}

function getBrandProfile(db, brandId) {
  return (
    db.brand_profiles.find((profile) => profile.brand_id === brandId) || db.brand_profiles[0] || {}
  );
}

function getBrainRules(db, brandId) {
  return db.ai_brain_rules
    .filter((rule) => rule.brand_id === brandId && rule.active !== false && !rule.archived_at)
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
}

function getPromptTemplates(db, brandId) {
  return db.ai_prompt_templates
    .filter(
      (prompt) => prompt.brand_id === brandId && prompt.active !== false && !prompt.archived_at,
    )
    .slice(0, 10);
}

function getApprovedLibraryRefs(db, brandId) {
  return db.library_items
    .filter(
      (item) =>
        item.brand_id === brandId &&
        !item.archived_at &&
        item.ai_allowed !== false &&
        ["referência aprovada", "referencia_aprovada", "template", "ativo"].includes(item.status),
    )
    .slice(0, 8);
}

function buildBrainContext(db, brandId) {
  const profile = getBrandProfile(db, brandId);
  const rules = getBrainRules(db, brandId);
  const references = getApprovedLibraryRefs(db, brandId);
  const promptTemplates = getPromptTemplates(db, brandId);
  const mantra =
    profile.mantra ||
    "Você é o núcleo de inteligência criativa da MYINC, uma incorporadora/construtora premium.";
  return {
    profile,
    rules,
    references,
    mantra,
    text: [
      `MANTRA: ${mantra}`,
      `NICHO: ${profile.niche || "Incorporadora e construtora premium"}`,
      `PÚBLICO: ${profile.primary_audience || "compradores e investidores de alto padrão"}`,
      `TOM: ${profile.tone || "premium, claro, sofisticado e direto"}`,
      `BENEFÍCIOS: ${profile.benefits || "arquitetura, localização, confiança e qualidade de vida"}`,
      `DIFERENCIAIS: ${profile.differentiators || "alto padrão, experiência e proximidade"}`,
      `REGRAS DO CÉREBRO IA:\n${rules.map((r) => `- [${r.category}] ${r.name}: ${r.content}`).join("\n")}`,
      promptTemplates.length
        ? `PROMPTS BASE ATIVOS:\n${promptTemplates
            .map((p) => `- ${p.name}: ${p.content}${p.note ? ` (${p.note})` : ""}`)
            .join("\n")}`
        : "PROMPTS BASE ATIVOS: nenhum prompt base ativo cadastrado.",
      references.length
        ? `REFERÊNCIAS APROVADAS DA BIBLIOTECA:\n${references
            .map(
              (r) =>
                `- ${r.name}: ${r.notes || r.ai_usage_rule || r.url || "usar como referência visual"}`,
            )
            .join("\n")}`
        : "REFERÊNCIAS APROVADAS DA BIBLIOTECA: nenhuma referência ativa cadastrada.",
    ].join("\n\n"),
  };
}

function isCarouselFormat(format = "") {
  return String(format).toLowerCase().includes("carrossel");
}

function isVideoFormat(format = "") {
  const normalized = String(format).toLowerCase();
  return (
    normalized.includes("reels") || normalized.includes("vídeo") || normalized.includes("video")
  );
}

function isStoryFormat(format = "") {
  return String(format).toLowerCase().includes("story");
}

function carouselPageCount(format = "") {
  return String(format).includes("8") ? 8 : 5;
}

function normalizeHashtags(value, fallback) {
  if (Array.isArray(value) && value.length)
    return value.map((tag) => (String(tag).startsWith("#") ? String(tag) : `#${tag}`));
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[\s,]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
  }
  return fallback;
}

function fallbackCarouselPages(post, count) {
  return Array.from({ length: count }, (_, index) => ({
    page: index + 1,
    title:
      index === 0
        ? post.headline || post.title
        : index === count - 1
          ? post.cta || "Fale com a MYINC"
          : `${post.theme || "MYINC"} — detalhe ${index}`,
    text:
      index === 0
        ? "Um convite visual para descobrir o alto padrão MYINC."
        : index === count - 1
          ? "Conheça o empreendimento ideal com a equipe MYINC."
          : "Arquitetura, funcionalidade, confiança e qualidade de vida em cada escolha.",
    visual_prompt: `Página ${index + 1} de carrossel premium MYINC, composição limpa, arquitetura contemporânea, pouco texto, grafite/off-white/laranja-cobre. Tema: ${post.title}.`,
  }));
}


// Sem fallback fabricado: exige os campos reais que a IA retornou. Se algo
// obrigatório faltar, o chamador deve tratar como falha (post fica com erro
// honesto), nunca preencher com texto de template disfarçado de IA.
function normalizePostGenerationResult(post, result) {
  const count = carouselPageCount(post.format);
  const headline = String(result.headline || "").trim();
  const caption = String(result.caption || "").trim();
  const cta = String(result.cta || "").trim();
  const imagePrompt = String(result.image_prompt || "").trim();
  if (!headline || !caption || !cta || !imagePrompt) {
    throw new Error(
      "A IA retornou conteúdo incompleto (faltou headline, caption, cta ou image_prompt). Nada foi salvo.",
    );
  }
  if (isCarouselFormat(post.format)) {
    const pages = Array.isArray(result.carousel_pages) ? result.carousel_pages : [];
    if (pages.length < 2) {
      throw new Error("A IA não retornou carousel_pages suficientes para o carrossel. Nada foi salvo.");
    }
  }
  if (isVideoFormat(post.format)) {
    const scenes = result.video_script && Array.isArray(result.video_script.scenes) ? result.video_script.scenes : [];
    if (!scenes.length) {
      throw new Error("A IA não retornou video_script com cenas para o Reels/Vídeo. Nada foi salvo.");
    }
  }
  if (isStoryFormat(post.format) && (!Array.isArray(result.story_sequence) || !result.story_sequence.length)) {
    throw new Error("A IA não retornou story_sequence para o Story. Nada foi salvo.");
  }

  return {
    headline,
    caption,
    hashtags: normalizeHashtags(result.hashtags, []),
    cta,
    image_prompt: imagePrompt,
    creative_brief: String(result.creative_brief || "").trim() || imagePrompt,
    // Score honesto: só o que a IA declarou; ausente vira null, nunca um piso inventado.
    quality_score: Number(result.quality_score) || null,
    master_prompt: result.master_prompt || null,
    carousel_pages: isCarouselFormat(post.format) ? result.carousel_pages.slice(0, count) : [],
    video_script: isVideoFormat(post.format) ? result.video_script : null,
    story_sequence: isStoryFormat(post.format) ? result.story_sequence : [],
  };
}

async function generateMediaForPost(db, post, options = {}) {
  const force = Boolean(options.force);
  if (post.media_url && !force) return { postId: post.id, skipped: true, mediaUrl: post.media_url };

  const version =
    db.post_versions.find((v) => v.id === post.current_version_id) ||
    db.post_versions.filter((v) => v.post_id === post.id).at(-1);
  const output = version?.output_json || {};
  const urls = [];

  if (isCarouselFormat(post.format)) {
    const pages = Array.isArray(output.carousel_pages) ? output.carousel_pages : [];
    if (!pages.length) {
      throw new Error("Post sem carousel_pages gerados pela IA. Gere o conteúdo antes de criar as imagens.");
    }
    for (const page of pages.slice(0, carouselPageCount(post.format))) {
      const prompt = `${page.visual_prompt || post.image_prompt}\n\nFormato: página ${page.page} de carrossel MYINC. Texto curto sugerido: ${page.title || "MYINC"}. Não gerar texto distorcido. Composição premium, limpa, alto padrão.`;
      const url = await generateImage(db, post, prompt, `p${page.page || urls.length + 1}`);
      urls.push(url);
      db.media_assets.push({
        id: uuid(),
        brand_id: post.brand_id,
        post_id: post.id,
        name: `Carrossel ${post.title} — página ${page.page || urls.length}`,
        media_type: "Imagem gerada",
        url,
        preview_url: url,
        status: "ativo",
        tags: ["ia", "myinc", "carrossel", `pagina-${page.page || urls.length}`],
        notes: page.text || "Página de carrossel gerada pela IA local.",
        origin: "local-ai-carousel",
        ai_allowed: false,
        storage_bucket: "creative-media",
        storage_path: url.split("/").pop(),
        is_final: urls.length === 1,
        used_in_publish: false,
        archived_at: null,
        created_at: now(),
        updated_at: now(),
      });
    }
    post.media_url = urls[0] || post.media_url;
    post.carousel_media_urls = urls;
    if (version?.output_json) version.output_json.carousel_media_urls = urls;
  } else if (isVideoFormat(post.format)) {
    const script = output.video_script;
    const scenes = script && Array.isArray(script.scenes) ? script.scenes : [];
    if (!scenes.length) {
      throw new Error("Post sem video_script gerado pela IA. Gere o conteúdo antes de criar o vídeo.");
    }
    const storyboardUrls = [];
    const posterPrompt = `${post.image_prompt || post.creative_brief}

Criar CAPA premium para Reels/Vídeo MYINC. Hook: ${script.hook_3s || post.headline}. Estética cinematográfica, arquitetura premium, formato vertical, pouco texto, luz natural, alto padrão.`;
    const posterUrl = await generateImage(db, post, posterPrompt, "video-poster");
    storyboardUrls.push(posterUrl);
    for (const [index, scene] of scenes.slice(0, 4).entries()) {
      const framePrompt = `${post.image_prompt || post.creative_brief}

FRAME ${index + 1} para storyboard de Reels/Vídeo MYINC. Cena: ${scene}. Visual cinematográfico vertical 9:16, arquitetura premium, movimento sugerido, pouco texto, aparência de agência.`;
      const frameUrl = await generateImage(db, post, framePrompt, `video-frame-${index + 1}`);
      storyboardUrls.push(frameUrl);
    }
    const mp4Url = await generateLocalVideoMp4(db, post, script);
    post.media_url = mp4Url || posterUrl;
    post.video_url = mp4Url || null;
    post.video_poster_url = posterUrl;
    post.video_prompt = JSON.stringify(script, null, 2);
    post.video_storyboard_urls = storyboardUrls;
    if (version?.output_json) {
      version.output_json.video_storyboard_urls = storyboardUrls;
      version.output_json.video_url = mp4Url || null;
      version.output_json.video_poster_url = posterUrl;
    }
    storyboardUrls.forEach((url, index) => {
      db.media_assets.push({
        id: uuid(),
        brand_id: post.brand_id,
        post_id: post.id,
        name: `${index === 0 ? "Capa" : `Frame ${index}`} — Vídeo/Reels ${post.title}`,
        media_type: "Vídeo gerado",
        url,
        preview_url: url,
        status: "ativo",
        tags: [
          "ia",
          "myinc",
          "video",
          "reels",
          "storyboard",
          index === 0 ? "capa" : `frame-${index}`,
        ],
        notes: `Roteiro/storyboard: ${JSON.stringify(script)}`,
        origin: "local-ai-video-storyboard",
        ai_allowed: false,
        storage_bucket: "creative-media",
        storage_path: url.split("/").pop(),
        is_final: index === 0,
        used_in_publish: false,
        archived_at: null,
        created_at: now(),
        updated_at: now(),
      });
    });
  } else {
    const url = await generateImage(db, post, post.image_prompt || post.creative_brief, "feed");
    post.media_url = url;
    db.media_assets.push({
      id: uuid(),
      brand_id: post.brand_id,
      post_id: post.id,
      name: `Imagem ${post.title}`,
      media_type: "Imagem gerada",
      url,
      preview_url: url,
      status: "ativo",
      tags: ["ia", "myinc", "feed"],
      notes: "Imagem gerada pela fila local.",
      origin: "local-ai",
      ai_allowed: false,
      storage_bucket: "creative-media",
      storage_path: url.split("/").pop(),
      is_final: true,
      used_in_publish: false,
      archived_at: null,
      created_at: now(),
      updated_at: now(),
    });
  }

  post.status = ["rascunho", "tema_aprovado", "em_producao"].includes(post.status)
    ? "aguardando_revisao"
    : post.status;
  post.updated_at = now();
  log(db, {
    brand_id: post.brand_id,
    module: isCarouselFormat(post.format)
      ? "carousel"
      : isVideoFormat(post.format)
        ? "video"
        : "image",
    status: "sucesso",
    post_id: post.id,
    friendly_message: isCarouselFormat(post.format)
      ? `Carrossel com ${post.carousel_media_urls?.length || 0} páginas gerado.`
      : isVideoFormat(post.format)
        ? "Roteiro/capa de vídeo ou Reels gerado."
        : "Imagem gerada/salva no storage local.",
  });
  return {
    postId: post.id,
    mediaUrl: post.media_url,
    videoUrl: post.video_url || null,
    videoPosterUrl: post.video_poster_url || null,
    videoStatus: post.video_status || null,
    carouselMediaUrls: post.carousel_media_urls || [],
  };
}

function makeSafeFileText(value, max = 60) {
  return (
    String(value || "myinc")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max) || "myinc"
  );
}

function templateSvgForPost(post, variant = "feed", page = null) {
  const isStory =
    String(post.format || "")
      .toLowerCase()
      .includes("story") ||
    String(post.format || "")
      .toLowerCase()
      .includes("reels") ||
    String(post.format || "")
      .toLowerCase()
      .includes("vídeo") ||
    String(post.format || "")
      .toLowerCase()
      .includes("video");
  const width = isStory ? 1080 : variant === "facebook" ? 1200 : 1080;
  const height = isStory ? 1920 : variant === "facebook" ? 630 : 1350;
  const headline = page?.title || post.headline || post.title || "MYINC";
  const text =
    page?.text ||
    post.caption ||
    post.short_text ||
    post.creative_brief ||
    "Arquitetura premium, localização estratégica e alto padrão.";
  const cta = post.cta || "Fale com a equipe MYINC";
  const pageLabel = page ? `PÁGINA ${page.page}` : String(post.format || "FEED").toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d0a08"/><stop offset=".55" stop-color="#20130d"/><stop offset="1" stop-color="#4a2108"/></linearGradient>
    <radialGradient id="glow" cx="78%" cy="12%" r="42%"><stop stop-color="#f58220" stop-opacity=".36"/><stop offset="1" stop-color="#f58220" stop-opacity="0"/></radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity=".35"/></filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <rect x="${width * 0.075}" y="${height * 0.075}" width="${width * 0.85}" height="${height * 0.85}" rx="46" fill="#fffaf4" opacity=".055" stroke="#f58220" stroke-opacity=".38"/>
  <path d="M ${width * 0.1} ${height * 0.78} C ${width * 0.26} ${height * 0.66}, ${width * 0.39} ${height * 0.86}, ${width * 0.56} ${height * 0.72} S ${width * 0.82} ${height * 0.68}, ${width * 0.93} ${height * 0.58}" fill="none" stroke="#f58220" stroke-opacity=".18" stroke-width="16"/>
  <text x="${width * 0.1}" y="${height * 0.14}" fill="#f58220" font-family="Montserrat, Arial, sans-serif" font-size="${Math.round(width * 0.044)}" font-weight="800" letter-spacing="3">MYINC</text>
  <text x="${width * 0.1}" y="${height * 0.19}" fill="#d8c7b6" font-family="Montserrat, Arial, sans-serif" font-size="${Math.round(width * 0.018)}" font-weight="700" letter-spacing="4">${escapeXml(pageLabel)}</text>
  <foreignObject x="${width * 0.1}" y="${height * 0.36}" width="${width * 0.78}" height="${height * 0.25}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Montserrat,Arial,sans-serif;color:#fffaf4;font-weight:800;font-size:${Math.round(width * 0.055)}px;line-height:1.04;letter-spacing:-1px;text-wrap:balance;">${escapeXml(headline)}</div></foreignObject>
  <foreignObject x="${width * 0.1}" y="${height * 0.62}" width="${width * 0.76}" height="${height * 0.14}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Montserrat,Arial,sans-serif;color:#d7c9bd;font-size:${Math.round(width * 0.026)}px;line-height:1.35;">${escapeXml(String(text).slice(0, 180))}</div></foreignObject>
  <rect x="${width * 0.1}" y="${height * 0.82}" width="${width * 0.52}" height="${Math.round(height * 0.055)}" rx="${Math.round(height * 0.027)}" fill="#f58220" filter="url(#shadow)"/>
  <text x="${width * 0.13}" y="${height * 0.855}" fill="#1a100b" font-family="Montserrat, Arial, sans-serif" font-size="${Math.round(width * 0.022)}" font-weight="800">${escapeXml(cta.slice(0, 42))}</text>
  <text x="${width * 0.1}" y="${height * 0.93}" fill="#fffaf4" opacity=".52" font-family="Montserrat, Arial, sans-serif" font-size="${Math.round(width * 0.016)}">myinc.com.br • arquitetura • sofisticação • confiança</text>
</svg>`;
}

function renderTemplateForPost(db, post, options = {}) {
  const storagePath = path.join(uploadDir, "creative-media");
  fs.mkdirSync(storagePath, { recursive: true });
  const urls = [];
  if (isCarouselFormat(post.format)) {
    const version =
      db.post_versions.find((v) => v.id === post.current_version_id) ||
      db.post_versions.filter((v) => v.post_id === post.id).at(-1);
    const pages = version?.output_json?.carousel_pages?.length
      ? version.output_json.carousel_pages
      : fallbackCarouselPages(post, carouselPageCount(post.format));
    for (const page of pages.slice(0, carouselPageCount(post.format))) {
      const fileName = `${post.id}-template-p${page.page || urls.length + 1}-${Date.now()}.svg`;
      fs.writeFileSync(
        path.join(storagePath, fileName),
        templateSvgForPost(post, "carousel", page),
      );
      urls.push(`${PUBLIC_BASE}/${fileName}`);
    }
    post.media_url = urls[0] || post.media_url;
    post.carousel_media_urls = urls;
  } else {
    const variant = String(post.format || "")
      .toLowerCase()
      .includes("facebook")
      ? "facebook"
      : "feed";
    const fileName = `${post.id}-template-${makeSafeFileText(post.format)}-${Date.now()}.svg`;
    fs.writeFileSync(path.join(storagePath, fileName), templateSvgForPost(post, variant));
    urls.push(`${PUBLIC_BASE}/${fileName}`);
    post.media_url = urls[0];
  }
  post.status =
    post.status === "tema_aprovado" || post.status === "em_producao"
      ? "aguardando_revisao"
      : post.status;
  post.updated_at = now();
  db.media_assets.push({
    id: uuid(),
    brand_id: post.brand_id,
    post_id: post.id,
    name: `Template MYINC aplicado — ${post.title}`,
    media_type: "Imagem gerada",
    url: urls[0],
    preview_url: urls[0],
    status: "template",
    tags: ["template", "myinc", "identidade", "final"],
    notes: "Arte renderizada localmente com template MYINC, logo, CTA, paleta e área segura.",
    origin: "local-template-renderer",
    ai_allowed: false,
    storage_bucket: "creative-media",
    storage_path: urls[0]?.split("/").pop(),
    is_final: true,
    used_in_publish: false,
    archived_at: null,
    created_at: now(),
    updated_at: now(),
  });
  log(db, {
    brand_id: post.brand_id,
    post_id: post.id,
    module: "template-renderer",
    status: "sucesso",
    friendly_message: "Template visual MYINC aplicado ao criativo.",
  });
  return {
    ok: true,
    post,
    mediaUrl: post.media_url,
    carouselMediaUrls: post.carousel_media_urls || [],
  };
}

function calculateQualityReview(post) {
  let copy = 68;
  let visual = 65;
  let brand = 72;
  let cta = 60;
  const caption = String(post.caption || "");
  const prompt = String(post.image_prompt || post.creative_brief || "");
  const ctaText = String(post.cta || "");
  if (caption.length > 160) copy += 10;
  if (/MYINC|arquitetura|sofistica|alto padrão|premium|confiança|localização/i.test(caption))
    brand += 15;
  if (/arquitetura|luz natural|materiais|grafite|off-white|cobre|composição|premium/i.test(prompt))
    visual += 20;
  if (post.media_url) visual += 8;
  if (ctaText.length > 8) cta += 18;
  if (/fale|conheça|agende|descubra|equipe/i.test(ctaText)) cta += 12;
  if (caption.length > 950) copy -= 10;
  const score = Math.max(0, Math.min(100, Math.round((copy + visual + brand + cta) / 4)));
  const problems = [];
  const suggestions = [];
  if (copy < 82) {
    problems.push("Copy ainda pode ficar mais persuasiva e objetiva.");
    suggestions.push("Usar gancho mais forte nos primeiros 120 caracteres.");
  }
  if (visual < 82) {
    problems.push("Prompt visual ainda pode ficar mais diretor de arte.");
    suggestions.push("Adicionar luz, composição, materiais, paleta MYINC e restrições visuais.");
  }
  if (brand < 85) {
    problems.push("Aderência à marca pode melhorar.");
    suggestions.push("Reforçar sofisticação, confiança, arquitetura e alto padrão MYINC.");
  }
  if (cta < 85) {
    problems.push("CTA pode ser mais claro.");
    suggestions.push("Usar chamada direta para falar com a equipe ou conhecer o empreendimento.");
  }
  return {
    overall_score: score,
    copy_score: Math.min(100, copy),
    visual_score: Math.min(100, visual),
    brand_score: Math.min(100, brand),
    cta_score: Math.min(100, cta),
    approved: score >= 85,
    problems,
    suggestions,
  };
}

function createBackup(db, label = "manual") {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${stamp}-${makeSafeFileText(label, 36)}.json`;
  const filePath = path.join(backupDir, fileName);
  const payload = {
    created_at: now(),
    label,
    databaseDriver: DB_DRIVER === "sqlite" && DatabaseSync ? "sqlite" : "json",
    db,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  let sqliteCopy = null;
  if (DB_DRIVER === "sqlite" && DatabaseSync && fs.existsSync(sqlitePath)) {
    const sqliteName = fileName.replace(/\.json$/, ".sqlite");
    const sqliteDest = path.join(backupDir, sqliteName);
    try {
      fs.copyFileSync(sqlitePath, sqliteDest);
      sqliteCopy = sqliteName;
    } catch {}
  }
  return { fileName, filePath, sqliteCopy, createdAt: now(), size: fs.statSync(filePath).size };
}

function listBackups() {
  fs.mkdirSync(backupDir, { recursive: true });
  return fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const stat = fs.statSync(path.join(backupDir, name));
      return { fileName: name, size: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function convertApprovedIdeasToPosts(db, brandId) {
  const batchId = uuid();
  const approvedIdeas = db.post_ideas.filter(
    (idea) =>
      idea.brand_id === brandId &&
      idea.status === "tema_aprovado" &&
      !idea.converted_post_id &&
      !idea.archived_at &&
      !idea.deleted_at,
  );
  const posts = [];
  for (const idea of approvedIdeas) {
    const existing = db.posts.find((post) => post.source_idea_id === idea.id);
    if (existing) {
      idea.converted_post_id = existing.id;
      posts.push(existing);
      continue;
    }
    const post = {
      id: uuid(),
      brand_id: idea.brand_id,
      monthly_plan_id: idea.monthly_plan_id,
      source_idea_id: idea.id,
      batch_id: batchId,
      title: idea.theme || idea.headline || "Post MYINC",
      channel: idea.channel || "Instagram",
      format: idea.format || "Feed 1080x1350",
      scheduled_at: idea.suggested_at || now(),
      objective: idea.objective,
      theme: idea.theme,
      headline: idea.headline,
      short_text: idea.short_text,
      caption: idea.short_text,
      hashtags: [],
      cta: idea.cta,
      image_prompt: idea.initial_prompt,
      creative_brief: idea.visual_idea,
      media_url: null,
      carousel_media_urls: [],
      quality_score: Number(idea.predicted_score) || null,
      status: "tema_aprovado",
      archived_at: null,
      deleted_at: null,
      created_at: now(),
      updated_at: now(),
    };
    db.posts.push(post);
    idea.converted_post_id = post.id;
    idea.updated_at = now();
    posts.push(post);
  }
  return posts;
}

async function handleFunction(name, payload, db, req) {
  const user = getAuthUser(db, req) || db.app_users[0];
  const brandId = payload.brandId || user?.brand_id || db.brands[0]?.id;
  if (name === "admin-status") {
    log(db, {
      brand_id: brandId,
      module: "admin",
      type: "status",
      status: "sucesso",
      friendly_message: "Status local verificado.",
      technical_detail: "Backend local respondeu sem Supabase.",
    });
    return {
      ok: true,
      admin: true,
      mode: "local",
      environment: {
        localMode: true,
        openaiApiKey: Boolean(process.env.OPENAI_API_KEY),
        openaiTextModel: process.env.OPENAI_TEXT_MODEL || "gpt-5.2",
        openaiImageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5",
        metaPageAccessToken: Boolean(process.env.META_PAGE_ACCESS_TOKEN),
        metaPageId: process.env.META_PAGE_ID || null,
        metaInstagramBusinessId: process.env.META_INSTAGRAM_BUSINESS_ID || null,
        publicMediaBaseUrl: PUBLIC_BASE,
        cloudinaryConfigured: Boolean(
          process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET,
        ),
        ffmpegVideoEnabled: process.env.ENABLE_LOCAL_FFMPEG_VIDEO === "true",
        storageDir: uploadDir,
        backupDir,
        databasePath: activeDbPath(),
        sqliteAvailable: Boolean(DatabaseSync),
        sqlitePath,
      },
      database: {
        connected: true,
        type: DB_DRIVER === "sqlite" && DatabaseSync ? "sqlite" : "json-local-com-backup",
        path: activeDbPath(),
        backups: listBackups().slice(0, 5),
        tables: Object.fromEntries(TABLES.map((t) => [t, Array.isArray(db[t])])),
      },
      storage: { "brand-assets": true, "creative-media": true, library: true },
      edgeFunctions: {
        localApi: true,
        "ai-generate-plan": true,
        "generate-post-content": true,
        "generate-image": true,
        "generate-images-batch": true,
        "generate-videos-batch": true,
        "autonomous-run": true,
        "publish-meta": true,
      },
    };
  }

  if (name === "admin-users") {
    const email = normalizeLogin(payload.email || payload.login || "novo@myinc.local");
    const existing = db.app_users.find((u) => String(u.email).toLowerCase() === email);
    const row = existing || { id: uuid(), created_at: now() };
    Object.assign(row, {
      auth_user_id: row.auth_user_id || uuid(),
      email,
      full_name: payload.fullName || payload.full_name || "Usuário MYINC",
      role: payload.role || "editor",
      status: "active",
      brand_id: brandId,
      updated_at: now(),
    });
    if (!existing) db.app_users.push(row);
    log(db, {
      brand_id: brandId,
      module: "admin-users",
      status: "sucesso",
      friendly_message: `Usuário ${email} salvo no modo local.`,
    });
    return { ok: true, userId: row.id };
  }

  if (name === "ai-generate-plan") {
    if (payload.mode === "regenerate_idea" && payload.ideaId) {
      const idea = db.post_ideas.find((x) => x.id === payload.ideaId);
      if (!idea) throw new Error("Ideia não encontrada.");
      const context = buildBrainContext(db, idea.brand_id || brandId);
      const system = [
        "Você é o Cérebro IA MYINC. Gere uma única ideia nova, mais forte, mais estratégica e mais premium que a atual.",
        "Responda somente JSON válido com um objeto idea contendo: theme, headline, hook, angle, pain_point, objective, short_text, cta, visual_idea, initial_prompt, why_this_post_matters, content_pillar, predicted_score.",
      ].join("\n");
      const userPrompt = JSON.stringify({
        context: context.text,
        current_idea: idea,
        instruction: payload.instruction || "melhorar de forma marcante e mais profissional",
      });
      // Sem fallback fabricado: se a IA falhar, o erro sobe e a ideia não é alterada.
      const raw = await askOpenAIJson(system, userPrompt);
      const next = raw.idea || raw;
      const headline = String(next.headline || next.theme || "").trim();
      if (!headline) throw new Error("A IA não retornou uma ideia válida para regenerar.");
      Object.assign(idea, {
        theme: String(next.theme || idea.theme),
        headline,
        short_text: String(next.short_text || idea.short_text || ""),
        cta: String(next.cta || idea.cta || ""),
        visual_idea: String(next.visual_idea || next.visual_direction || idea.visual_idea || ""),
        initial_prompt: String(next.initial_prompt || idea.initial_prompt || ""),
        objective: String(next.objective || idea.objective || ""),
        content_pillar: String(next.content_pillar || idea.content_pillar || ""),
        why_this_post_matters: String(next.why_this_post_matters || idea.why_this_post_matters || ""),
        predicted_score: Number(next.predicted_score) || null,
        regenerate_count: Number(idea.regenerate_count || 0) + 1,
        updated_at: now(),
      });
      log(db, {
        brand_id: idea.brand_id,
        module: "planejamento",
        status: "sucesso",
        friendly_message: "Ideia regenerada com IA real.",
        post_id: idea.converted_post_id || null,
      });
      return { ok: true, idea };
    }

    // Sem fallback fabricado: se a IA falhar ou não retornar ideias, o erro
    // sobe e nenhum plano é salvo.
    const { ai, rawIdeas, total, formatSequence, channelSequence } = await generateIdeasWithAI(db, payload, brandId);
    if (!rawIdeas.length) {
      throw new Error("A IA não retornou nenhuma ideia válida. Nenhum plano foi salvo — tente gerar novamente.");
    }

    const monthlyPlan = {
      id: uuid(),
      brand_id: brandId,
      name: payload.campaign || `Planejamento MYINC ${payload.month}/${payload.year}`,
      month: Number(payload.month || new Date().getMonth() + 1),
      year: Number(payload.year || new Date().getFullYear()),
      objective:
        payload.monthlyObjective || payload.objective || "Gerar autoridade e leads qualificados.",
      total_posts: 0,
      channels: payload.channels || [],
      formats_distribution: payload.formats || {},
      campaign_distribution: {},
      plan_brief: payload,
      strategy: ai.strategy || null,
      status: "generated",
      archived_at: null,
      created_at: now(),
      updated_at: now(),
    };

    const start = new Date(
      Number(payload.year || new Date().getFullYear()),
      Number(payload.month || new Date().getMonth() + 1) - 1,
      1,
      9,
      0,
      0,
    );
    const ideas = [];
    for (let i = 0; i < Math.min(total, rawIdeas.length); i++) {
      const raw = rawIdeas[i] || {};
      const headline = String(raw.headline || raw.theme || "").trim();
      if (!headline) continue; // ideia malformada da IA: pulada, não fabricada
      const scheduled = addDays(start, i);
      scheduled.setHours(9 + (i % 4) * 3, 0, 0, 0);
      const channel = String(raw.channel || channelSequence[i] || "Instagram");
      ideas.push({
        id: uuid(),
        monthly_plan_id: monthlyPlan.id,
        brand_id: brandId,
        suggested_at: scheduled.toISOString(),
        channel: channel.includes("Facebook") ? "Facebook" : channel.includes("Ambos") ? "Ambos" : "Instagram",
        format: String(raw.format || formatSequence[i] || "Feed 1080x1350"),
        theme: String(raw.theme || headline),
        objective: String(raw.objective || monthlyPlan.objective),
        headline,
        short_text: String(raw.short_text || ""),
        cta: String(raw.cta || ""),
        visual_idea: String(raw.visual_idea || raw.visual_direction || ""),
        initial_prompt: String(raw.initial_prompt || ""),
        content_pillar: String(raw.content_pillar || ""),
        why_this_post_matters: String(raw.why_this_post_matters || ""),
        predicted_score: Number(raw.predicted_score) || null,
        status: "rascunho",
        archived_at: null,
        deleted_at: null,
        created_at: now(),
        updated_at: now(),
      });
    }
    if (!ideas.length) {
      throw new Error("A IA retornou ideias incompletas (sem headline/theme). Nenhum plano foi salvo — tente novamente.");
    }
    monthlyPlan.total_posts = ideas.length;
    db.monthly_plans.push(monthlyPlan);
    db.post_ideas.push(...ideas);
    log(db, {
      brand_id: brandId,
      module: "planejamento",
      status: "sucesso",
      friendly_message: `${ideas.length} ideia(s) reais geradas pela IA.`,
    });
    return {
      ok: true,
      monthlyPlan,
      ideas,
      message: ideas.length < total
        ? `A IA gerou ${ideas.length} de ${total} ideia(s) solicitadas — todas reais, nenhuma preenchida artificialmente.`
        : `Geradas ${ideas.length} ideia(s) reais pela IA.`,
    };
  }

  if (name === "process-production-queue") {
    const batchId = payload.batchId || uuid();
    const postIds = payload.postIds || [];
    let processed = 0;
    let failed = 0;
    for (const postId of postIds) {
      const post = db.posts.find((p) => p.id === postId);
      if (!post) continue;
      post.status = "em_producao";
      post.batch_id = post.batch_id || batchId;
      post.updated_at = now();

      const context = buildBrainContext(db, post.brand_id || brandId);
      const system = [
        "Você é o Cérebro IA local da MYINC.",
        "Aja como estrategista de social media, copywriter, diretor de arte, roteirista e revisor de qualidade.",
        "Use obrigatoriamente a memória da marca, regras ativas do Cérebro IA e referências aprovadas.",
        "Responda somente JSON válido.",
        "Campos obrigatórios: headline, caption, hashtags, cta, image_prompt, creative_brief, quality_score.",
        "Se quality_score ficar abaixo de 88, melhore automaticamente antes de responder.",
        "Se for carrossel, inclua carousel_pages com page, title, text e visual_prompt para cada página.",
        "Se for Reels/vídeo, inclua video_script com hook_3s, scenes, narration, screen_text e cta.",
        "Se for Story, inclua story_sequence.",
      ].join("\n");
      const userPrompt = [
        context.text,
        `POST: ${JSON.stringify(post)}`,
        `FORMATO: ${post.format}`,
        `CANAL: ${post.channel}`,
        `INSTRUÇÃO HUMANA: ${payload.instruction || "Produzir versão premium definitiva."}`,
        "Nunca gere conteúdo genérico. A saída precisa parecer feita por uma agência premium especializada em incorporadoras.",
      ].join("\n\n");

      // Sem fallback fabricado: se a IA falhar ou faltar campo obrigatório,
      // o post fica com erro honesto e o lote continua para os demais.
      let result;
      try {
        const rawResult = await askOpenAIJson(system, userPrompt);
        result = normalizePostGenerationResult(post, rawResult);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        post.status = "erro";
        post.error_message = message;
        post.updated_at = now();
        log(db, {
          brand_id: post.brand_id,
          module: "production-queue",
          status: "erro",
          post_id: post.id,
          friendly_message: "Falha ao gerar conteúdo real com IA; nada foi fabricado.",
          technical_detail: message,
        });
        failed++;
        continue;
      }

      Object.assign(post, {
        headline: result.headline,
        caption: result.caption,
        hashtags: result.hashtags,
        cta: result.cta,
        image_prompt: result.image_prompt,
        video_prompt: result.video_script
          ? JSON.stringify(result.video_script, null, 2)
          : post.video_prompt,
        creative_brief: result.creative_brief,
        master_prompt: userPrompt,
        quality_score: result.quality_score,
        status: "aguardando_revisao",
        error_message: null,
        updated_at: now(),
      });
      const version = {
        id: uuid(),
        post_id: post.id,
        version_label: `v${db.post_versions.filter((v) => v.post_id === post.id).length + 1}`,
        version_type: isCarouselFormat(post.format)
          ? "carousel"
          : isVideoFormat(post.format)
            ? "video"
            : isStoryFormat(post.format)
              ? "story"
              : "content",
        generated_by: "ai-local",
        caption: post.caption,
        hashtags: post.hashtags,
        cta: post.cta,
        image_prompt: post.image_prompt,
        video_prompt: post.video_prompt || null,
        media_url: post.media_url || null,
        quality_score: post.quality_score,
        human_feedback: payload.instruction || null,
        prompt_snapshot: {
          mode: "local",
          context: context.text,
          instruction: payload.instruction || null,
        },
        output_json: result,
        is_current: true,
        created_at: now(),
      };
      db.post_versions.forEach((v) => {
        if (v.post_id === post.id) v.is_current = false;
      });
      db.post_versions.push(version);
      post.current_version_id = version.id;
      db.generation_jobs.push({
        id: uuid(),
        brand_id: post.brand_id,
        post_id: post.id,
        batch_id: batchId,
        job_type: isCarouselFormat(post.format)
          ? "carousel_generation"
          : isVideoFormat(post.format)
            ? "video_script_generation"
            : "full_post_generation",
        status: "completed",
        step: "done",
        attempts: 1,
        max_attempts: 3,
        input_json: { instruction: payload.instruction || null, format: post.format },
        output_json: result,
        created_at: now(),
        updated_at: now(),
      });
      processed++;
    }
    log(db, {
      brand_id: brandId,
      module: "production-queue",
      status: failed ? "alerta" : "sucesso",
      friendly_message: `${processed} post(s) gerados com IA real${failed ? `; ${failed} falharam e ficaram com erro honesto (sem conteúdo fabricado)` : ""}.`,
    });
    return { ok: true, batchId, queued: postIds.length, processed, failed };
  }

  if (name === "generate-post-content") {
    const post = db.posts.find((p) => p.id === payload.postId);
    if (!post) throw new Error("Post não encontrado.");
    return handleFunction(
      "process-production-queue",
      {
        brandId: post.brand_id,
        postIds: [post.id],
        instruction: payload.instruction || "Gerar conteúdo",
      },
      db,
      req,
    ).then(() => ({ ok: true, post }));
  }

  if (name === "generate-image") {
    const post = db.posts.find((p) => p.id === payload.postId);
    if (!post) throw new Error("Post não encontrado.");
    const result = await generateMediaForPost(db, post, { force: payload.force });
    return { ok: true, post, mediaUrl: post.media_url, result };
  }

  if (name === "generate-images-batch") {
    const ids =
      Array.isArray(payload.postIds) && payload.postIds.length
        ? payload.postIds
        : db.posts
            .filter(
              (post) =>
                (payload.brandId ? post.brand_id === payload.brandId : true) &&
                !post.archived_at &&
                !post.deleted_at &&
                (!payload.onlyMissing || !post.media_url) &&
                !["publicado", "arquivado"].includes(post.status),
            )
            .map((post) => post.id);
    const results = [];
    for (const id of ids) {
      const post = db.posts.find((p) => p.id === id);
      if (!post) continue;
      results.push(await generateMediaForPost(db, post, { force: payload.force }));
    }
    log(db, {
      brand_id: payload.brandId || brandId,
      module: "image-batch",
      status: "sucesso",
      friendly_message: `${results.length} mídias processadas em fila local.`,
    });
    return { ok: true, processed: ids.length, generated: results.length, results };
  }

  if (name === "generate-videos-batch") {
    const ids =
      Array.isArray(payload.postIds) && payload.postIds.length
        ? payload.postIds
        : db.posts
            .filter(
              (post) =>
                (payload.brandId ? post.brand_id === payload.brandId : true) &&
                isVideoFormat(post.format) &&
                !post.archived_at &&
                !post.deleted_at &&
                !["publicado", "arquivado"].includes(post.status),
            )
            .map((post) => post.id);
    const results = [];
    for (const id of ids) {
      const post = db.posts.find((p) => p.id === id);
      if (!post) continue;
      results.push(await generateMediaForPost(db, post, { force: payload.force ?? true }));
    }
    log(db, {
      brand_id: payload.brandId || brandId,
      module: "video-batch",
      status: "sucesso",
      friendly_message: `${results.length} vídeos/Reels processados em fila local.`,
    });
    return { ok: true, processed: ids.length, generated: results.length, results };
  }

  if (name === "review-post-quality") {
    const post = db.posts.find((p) => p.id === payload.postId);
    if (!post) throw new Error("Post não encontrado.");
    const review = calculateQualityReview(post);
    post.quality_score = review.overall_score;
    post.quality_review = review;
    post.status_reason = review.approved
      ? "Revisor IA aprovou o criativo."
      : review.suggestions.join(" ");
    post.updated_at = now();
    log(db, {
      brand_id: post.brand_id,
      post_id: post.id,
      module: "quality-review",
      status: review.approved ? "sucesso" : "alerta",
      friendly_message: `Revisor IA: score ${review.overall_score}/100.`,
    });
    return { ok: true, post, review };
  }

  if (name === "improve-post") {
    const post = db.posts.find((p) => p.id === payload.postId);
    if (!post) throw new Error("Post não encontrado.");
    const mode = payload.mode || "premium";
    const instructions = {
      copy: "Melhore somente copy/legenda: mais clara, objetiva, persuasiva, premium e com CTA forte.",
      premium:
        "Deixe mais premium, sofisticado, elegante, alto padrão, com linguagem de incorporadora de luxo.",
      commercial:
        "Deixe mais comercial, orientado a lead, desejo, objeções e chamada para atendimento.",
      institutional: "Deixe mais institucional, confiável, elegante e alinhado à marca MYINC.",
      visual:
        "Melhore o prompt visual como diretor de arte: luz, câmera, composição, materiais, paleta, restrições e área segura.",
      shorter: "Crie versão mais curta, objetiva, com CTA limpo e sem perda de sofisticação.",
      carousel: "Melhore o carrossel página por página, com hook forte, progressão e CTA final.",
    };
    const result = await handleFunction(
      "process-production-queue",
      {
        brandId: post.brand_id,
        postIds: [post.id],
        instruction: instructions[mode] || String(payload.instruction || instructions.premium),
      },
      db,
      req,
    );
    if (payload.regenerateMedia) await generateMediaForPost(db, post, { force: true });
    const review = calculateQualityReview(post);
    post.quality_score = Math.max(post.quality_score || 0, review.overall_score);
    post.quality_review = review;
    post.updated_at = now();
    return { ok: true, result, post, review };
  }

  if (name === "render-template") {
    const post = db.posts.find((p) => p.id === payload.postId);
    if (!post) throw new Error("Post não encontrado.");
    return renderTemplateForPost(db, post, payload);
  }

  if (name === "render-templates-batch") {
    const ids =
      Array.isArray(payload.postIds) && payload.postIds.length
        ? payload.postIds
        : db.posts
            .filter(
              (post) =>
                (payload.brandId ? post.brand_id === payload.brandId : true) &&
                !post.archived_at &&
                !post.deleted_at &&
                !["publicado", "arquivado"].includes(post.status),
            )
            .map((post) => post.id);
    const results = [];
    for (const id of ids) {
      const post = db.posts.find((p) => p.id === id);
      if (post) results.push(renderTemplateForPost(db, post, payload));
    }
    return { ok: true, processed: results.length, results };
  }

  if (name === "backup-create") {
    const backup = createBackup(db, payload.label || "manual");
    log(db, {
      brand_id: brandId,
      module: "backup",
      status: "sucesso",
      friendly_message: `Backup local criado: ${backup.fileName}`,
    });
    return { ok: true, backup, backups: listBackups() };
  }

  if (name === "backup-list") {
    return {
      ok: true,
      backups: listBackups(),
      dbPath: activeDbPath(),
      backupDir,
      uploadDir,
      databaseDriver: DB_DRIVER === "sqlite" && DatabaseSync ? "sqlite" : "json",
    };
  }

  if (name === "backup-restore") {
    const fileName = path.basename(String(payload.fileName || ""));
    const filePath = path.join(backupDir, fileName);
    if (!fileName || !fs.existsSync(filePath)) throw new Error("Backup não encontrado.");
    createBackup(db, "before-restore");
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const nextDb = parsed.db || parsed;
    writeDb(ensureDbUpgrades(nextDb));
    return { ok: true, restored: fileName };
  }

  if (name === "export-project") {
    const backup = createBackup(db, payload.label || "export-project");
    return {
      ok: true,
      backup,
      message:
        "Projeto exportado como backup JSON local. Copie também a pasta data/uploads para backup completo de mídia.",
    };
  }

  if (name === "autonomous-run") {
    const targetBrandId = payload.brandId || brandId;
    const createdPosts = convertApprovedIdeasToPosts(db, targetBrandId);
    const candidates = db.posts.filter(
      (post) =>
        post.brand_id === targetBrandId &&
        !post.archived_at &&
        !post.deleted_at &&
        !["publicado", "arquivado"].includes(post.status),
    );
    const toProduce = candidates.filter((post) =>
      ["rascunho", "tema_aprovado", "ajuste_solicitado", "erro"].includes(post.status),
    );
    let produced = 0;
    if (toProduce.length) {
      const production = await handleFunction(
        "process-production-queue",
        {
          brandId: targetBrandId,
          postIds: toProduce.map((post) => post.id),
          instruction:
            "Modo 100% automático: produzir copy, carrossel, roteiro de vídeo/reels, story, prompt visual e score usando Cérebro IA MYINC.",
        },
        db,
        req,
      );
      produced = Number(production.processed || 0);
    }

    let generatedImages = 0;
    if (payload.generateImages !== false) {
      const mediaTargets = db.posts.filter(
        (post) =>
          post.brand_id === targetBrandId &&
          !post.archived_at &&
          !post.deleted_at &&
          !["publicado", "arquivado"].includes(post.status) &&
          !post.media_url,
      );
      for (const post of mediaTargets) {
        await generateMediaForPost(db, post, { force: false });
        generatedImages++;
      }
    }

    let approved = 0;
    if (payload.approve !== false) {
      for (const post of db.posts.filter(
        (p) =>
          p.brand_id === targetBrandId &&
          !p.archived_at &&
          !p.deleted_at &&
          ["aguardando_revisao", "tema_aprovado", "ajuste_solicitado"].includes(p.status),
      )) {
        post.status = "aprovado";
        post.approved_at = post.approved_at || now();
        post.updated_at = now();
        approved++;
      }
    }

    let scheduled = 0;
    if (payload.schedule !== false) {
      const approvedPosts = db.posts.filter(
        (p) =>
          p.brand_id === targetBrandId &&
          p.status === "aprovado" &&
          !p.archived_at &&
          !p.deleted_at,
      );
      let index = 0;
      for (const post of approvedPosts) {
        const scheduledAt = post.scheduled_at || addDays(new Date(), index + 1).toISOString();
        await handleFunction(
          "process-publish-queue",
          { action: "schedule", postId: post.id, channel: post.channel, scheduledAt },
          db,
          req,
        );
        scheduled++;
        index++;
      }
    }

    let published = 0;
    if (payload.applyTemplates !== false) {
      for (const post of db.posts.filter(
        (p) =>
          p.brand_id === targetBrandId &&
          !p.archived_at &&
          !p.deleted_at &&
          ["aguardando_revisao", "aprovado", "agendado"].includes(p.status),
      )) {
        renderTemplateForPost(db, post, {});
      }
    }

    if (payload.reviewQuality !== false) {
      for (const post of db.posts.filter(
        (p) =>
          p.brand_id === targetBrandId &&
          !p.archived_at &&
          !p.deleted_at &&
          !["publicado", "arquivado"].includes(p.status),
      )) {
        const review = calculateQualityReview(post);
        post.quality_score = Math.max(post.quality_score || 0, review.overall_score);
        post.quality_review = review;
      }
    }

    if (payload.publish !== false) {
      const queues = db.publish_queue.filter(
        (q) => q.brand_id === targetBrandId && ["queued", "failed"].includes(q.status),
      );
      for (const queue of queues) {
        const post = db.posts.find((p) => p.id === queue.post_id);
        if (!post) continue;
        const result = await handleFunction("publish-meta", { postId: post.id }, db, req);
        queue.status = "published";
        queue.updated_at = now();
        queue.meta_response_json = result;
        published++;
      }
    }

    log(db, {
      brand_id: targetBrandId,
      module: "autonomous",
      status: "sucesso",
      friendly_message: `Automação 100% concluída: ${createdPosts.length} posts criados, ${produced} produzidos, ${generatedImages} mídias, ${approved} aprovados, ${scheduled} agendados, ${published} publicados/registrados.`,
    });
    return {
      ok: true,
      createdPosts: createdPosts.length,
      produced,
      generatedImages,
      approved,
      scheduled,
      published,
    };
  }

  if (name === "process-publish-queue") {
    if (payload.action === "schedule") {
      const post = db.posts.find((p) => p.id === payload.postId);
      if (!post) throw new Error("Post não encontrado.");
      const scheduledAt = payload.scheduledAt || post.scheduled_at || now();
      post.scheduled_at = scheduledAt;
      post.status = "agendado";
      post.updated_at = now();
      const key = `${post.id}:${payload.channel || post.channel}:${scheduledAt}`;
      let queue = db.publish_queue.find((q) => q.idempotency_key === key);
      if (!queue) {
        queue = {
          id: uuid(),
          brand_id: post.brand_id,
          post_id: post.id,
          channel: payload.channel || post.channel,
          scheduled_at: scheduledAt,
          mode: "semi_automatico",
          status: "queued",
          attempts: 0,
          max_attempts: 3,
          locked_at: null,
          locked_by: null,
          next_attempt_at: null,
          last_error: null,
          idempotency_key: key,
          meta_response_json: {},
          cancelled_at: null,
          created_at: now(),
          updated_at: now(),
        };
        db.publish_queue.push(queue);
      }
      log(db, {
        brand_id: post.brand_id,
        module: "publish-queue",
        status: "sucesso",
        post_id: post.id,
        friendly_message: "Post agendado na fila local.",
      });
      return { ok: true, post, queue };
    }
    let processed = 0;
    const due = db.publish_queue
      .filter(
        (q) => q.status === "queued" && (!q.scheduled_at || new Date(q.scheduled_at) <= new Date()),
      )
      .slice(0, Number(payload.limit || 5));
    for (const queue of due) {
      const post = db.posts.find((p) => p.id === queue.post_id);
      if (!post) continue;
      try {
        await handleFunction("publish-meta", { postId: post.id, queueId: queue.id }, db, req);
        queue.status = "published";
      } catch (error) {
        queue.status = "failed";
        queue.last_error = error instanceof Error ? error.message : String(error);
        queue.next_attempt_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        post.status = post.status === "publicando" ? "erro" : post.status;
        post.error_message = queue.last_error;
        db.publish_logs.push({
          id: uuid(),
          brand_id: post.brand_id,
          post_id: post.id,
          queue_id: queue.id,
          channel: queue.channel,
          status: "failed",
          friendly_message: "Publicação real não executada. Configure Meta + mídia HTTPS pública.",
          technical_detail: queue.last_error,
          created_at: now(),
        });
      }
      queue.updated_at = now();
      post.updated_at = now();
      processed++;
    }
    return { ok: true, processed };
  }

  if (name === "publish-meta") {
    const post = db.posts.find((p) => p.id === payload.postId);
    if (!post) throw new Error("Post não encontrado.");
    post.status = "publicando";
    post.updated_at = now();
    const canTryMeta = Boolean(
      process.env.META_PAGE_ACCESS_TOKEN &&
      (process.env.META_PAGE_ID || process.env.META_INSTAGRAM_BUSINESS_ID) &&
      post.media_url &&
      /^https:\/\//.test(post.media_url),
    );
    if (!canTryMeta) {
      if (truthyEnv("ALLOW_LOCAL_PUBLISH_SIMULATION", false)) {
        post.status = "simulado";
        post.published_at = now();
        post.meta_publish_id = `local-simulado-${uuid()}`;
        post.published_url = post.media_url || `local://simulated/${post.id}`;
        post.updated_at = now();
        db.publish_logs.push({
          id: uuid(),
          brand_id: post.brand_id,
          post_id: post.id,
          channel: post.channel,
          status: "simulated_local",
          friendly_message: "Publicação apenas simulada no modo local.",
          technical_detail: "ALLOW_LOCAL_PUBLISH_SIMULATION=true. Não foi enviado para Meta.",
          meta_publish_id: post.meta_publish_id,
          published_url: post.published_url,
          created_at: now(),
        });
        return {
          ok: true,
          post,
          publishedUrl: post.published_url,
          localMode: true,
          simulated: true,
        };
      }
      post.status = "erro";
      post.error_message =
        "Publicação real bloqueada: configure META_PAGE_ACCESS_TOKEN, META IDs e mídia com URL pública HTTPS.";
      post.updated_at = now();
      throw new Error(post.error_message);
    }
    if (isVideoFormat(post.format) && !isValidPublicHttps(post.video_url)) {
      throw new Error(
        "Reels/Vídeo exige video_url MP4 pública HTTPS. Gere vídeo real ou envie MP4 público antes de publicar.",
      );
    }
    const graphVersion = process.env.META_GRAPH_VERSION || "v23.0";
    const token = process.env.META_PAGE_ACCESS_TOKEN;
    const caption = [
      post.caption || post.headline || post.title,
      Array.isArray(post.hashtags) ? post.hashtags.join(" ") : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    async function graphPost(pathname, params) {
      const response = await fetch(`https://graph.facebook.com/${graphVersion}/${pathname}`, {
        method: "POST",
        body: new URLSearchParams({ ...params, access_token: token }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || `Erro Meta Graph em ${pathname}`);
      return data;
    }
    let metaResult;
    if (
      String(post.channel || "")
        .toLowerCase()
        .includes("facebook") &&
      process.env.META_PAGE_ID
    ) {
      if (
        String(post.format || "")
          .toLowerCase()
          .includes("video") ||
        String(post.format || "")
          .toLowerCase()
          .includes("reels")
      ) {
        metaResult = await graphPost(`${process.env.META_PAGE_ID}/videos`, {
          file_url: post.video_url || post.media_url,
          description: caption,
        });
      } else {
        metaResult = await graphPost(`${process.env.META_PAGE_ID}/photos`, {
          url: post.media_url,
          caption,
          published: "true",
        });
      }
    } else if (process.env.META_INSTAGRAM_BUSINESS_ID) {
      const ig = process.env.META_INSTAGRAM_BUSINESS_ID;
      if (
        isCarouselFormat(post.format) &&
        Array.isArray(post.carousel_media_urls) &&
        post.carousel_media_urls.length > 1
      ) {
        const children = [];
        for (const imageUrl of post.carousel_media_urls) {
          const child = await graphPost(`${ig}/media`, {
            image_url: imageUrl,
            is_carousel_item: "true",
          });
          children.push(child.id);
        }
        const container = await graphPost(`${ig}/media`, {
          media_type: "CAROUSEL",
          children: children.join(","),
          caption,
        });
        metaResult = await graphPost(`${ig}/media_publish`, { creation_id: container.id });
      } else if (isVideoFormat(post.format) && (post.video_url || post.media_url)) {
        const container = await graphPost(`${ig}/media`, {
          media_type: "REELS",
          video_url: post.video_url || post.media_url,
          caption,
        });
        metaResult = await graphPost(`${ig}/media_publish`, { creation_id: container.id });
      } else {
        const container = await graphPost(`${ig}/media`, {
          image_url: post.media_url,
          caption,
        });
        metaResult = await graphPost(`${ig}/media_publish`, { creation_id: container.id });
      }
    } else {
      throw new Error(
        "Configure META_PAGE_ID ou META_INSTAGRAM_BUSINESS_ID para publicar de verdade.",
      );
    }
    post.status = "publicado";
    post.published_at = now();
    post.meta_publish_id =
      metaResult.id || metaResult.post_id || metaResult.creation_id || `meta-${uuid()}`;
    post.published_url = post.media_url;
    post.error_message = null;
    post.updated_at = now();
    db.publish_logs.push({
      id: uuid(),
      brand_id: post.brand_id,
      post_id: post.id,
      queue_id: payload.queueId || null,
      channel: post.channel,
      status: "published_meta",
      friendly_message: "Publicação enviada para Meta Graph API.",
      technical_detail: JSON.stringify({ id: post.meta_publish_id }),
      meta_publish_id: post.meta_publish_id,
      published_url: post.published_url,
      created_at: now(),
    });
    return { ok: true, post, metaResult, localMode: false };
  }

  throw new Error(`Função local não implementada: ${name}`);
}

async function handleRest(req, res, url, db) {
  const [, , , table] = url.pathname.split("/");
  if (!TABLES.includes(table))
    return send(res, 404, { error: `Tabela local não existe: ${table}` });
  if (req.method === "GET") return send(res, 200, applyQuery(db[table], url));
  if (req.method === "POST") {
    const payload = JSON.parse((await requestBody(req)).toString("utf8") || "[]");
    const out = tableUpsert(db, table, payload, url.searchParams.get("on_conflict"));
    writeDb(db);
    return send(res, 200, out);
  }
  if (req.method === "PATCH") {
    const payload = JSON.parse((await requestBody(req)).toString("utf8") || "{}");
    const rows = applyQuery(db[table], url);
    for (const row of rows) Object.assign(row, payload, { updated_at: now() });
    writeDb(db);
    return send(res, 200, rows);
  }
  if (req.method === "DELETE") {
    const rows = new Set(applyQuery(db[table], url).map((r) => r.id));
    db[table] = db[table].filter((r) => !rows.has(r.id));
    writeDb(db);
    return send(res, 200, []);
  }
  return send(res, 405, { error: "Método não permitido" });
}

async function handleStorage(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const isPublic = parts[3] === "public";
  const bucket = isPublic ? parts[4] : parts[3];
  const relative = parts.slice(isPublic ? 5 : 4).join("/");
  const bucketDir = path.join(uploadDir, bucket);
  fs.mkdirSync(bucketDir, { recursive: true });
  const filePath = path.join(bucketDir, relative);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (req.method === "GET") {
    if (!fs.existsSync(filePath)) return send(res, 404, { error: "Arquivo não encontrado" });
    const type = getMimeByPath(filePath);
    res.writeHead(200, { "Access-Control-Allow-Origin": CORS_ORIGIN, "Content-Type": type });
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  if (req.method === "POST" || req.method === "PUT") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, await requestBody(req));
    return send(res, 200, { Key: `${bucket}/${relative}`, path: relative });
  }
  if (req.method === "DELETE") {
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
    return send(res, 200, { ok: true, deleted: `${bucket}/${relative}` });
  }
  return send(res, 405, { error: "Método storage não permitido" });
}

function contentTypeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".mp4": "video/mp4",
    ".woff2": "font/woff2",
  };
  return map[ext] || "application/octet-stream";
}

function tryServeFrontend(req, res, url) {
  const clientDir = path.join(rootDir, "dist", "client");
  if (!fs.existsSync(clientDir)) return false;
  let requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  if (requested.includes("..")) requested = "/index.html";
  let filePath = path.join(clientDir, requested);
  if (!filePath.startsWith(clientDir)) filePath = path.join(clientDir, "index.html");
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(clientDir, "index.html");
  }
  if (!fs.existsSync(filePath)) return false;
  res.writeHead(200, {
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Content-Type": contentTypeForFile(filePath),
    "Cache-Control": filePath.endsWith("index.html")
      ? "no-cache"
      : "public, max-age=31536000, immutable",
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function localApiKeyMatches(req) {
  const configured = process.env.LOCAL_API_KEY || process.env.APP_API_KEY;
  if (!configured) return false;
  const provided = req.headers["x-api-key"] || req.headers.apikey || req.headers["x-local-api-key"];
  return String(provided || "") === String(configured);
}

function isLocalAuthRequired(url) {
  if (!truthyEnv("LOCAL_AUTH_REQUIRED", true)) return false;
  if (url.pathname === "/health") return false;
  if (url.pathname.startsWith("/auth/v1/")) return false;
  if (
    url.pathname.startsWith("/storage/v1/object/public/") &&
    url.searchParams.get("download") !== "1"
  )
    return false;
  if (
    url.pathname.startsWith("/rest/v1/") ||
    url.pathname.startsWith("/functions/v1/") ||
    url.pathname.startsWith("/storage/v1/object/")
  )
    return true;
  return false;
}

function assertLocalAuthorized(req, res, url, db) {
  if (!isLocalAuthRequired(url)) return true;
  if (localApiKeyMatches(req)) return true;
  if (getAuthUser(db, req)) return true;
  send(res, 401, {
    error: "Backend local protegido. Faça login ou envie Authorization Bearer local / x-api-key.",
  });
  return false;
}

async function handler(req, res) {
  if (req.method === "OPTIONS") return sendText(res, 204, "");
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const db = readDb();
  try {
    if (!assertLocalAuthorized(req, res, url, db)) return;
    if (url.pathname === "/health")
      return send(res, 200, {
        ok: true,
        mode: "local",
        dbPath: activeDbPath(),
        databaseDriver: DB_DRIVER === "sqlite" && DatabaseSync ? "sqlite" : "json",
        mediaEngine: {
          imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5",
          imageStrict: strictAiMode(),
          openAiVideo: truthyEnv("ENABLE_OPENAI_VIDEO", false),
          localAuthRequired: truthyEnv("LOCAL_AUTH_REQUIRED", true),
          publicMediaHttps: isValidPublicHttps(PUBLIC_BASE),
        },
      });
    if (url.pathname.startsWith("/auth/v1/token")) {
      const body = JSON.parse((await requestBody(req)).toString("utf8") || "{}");
      const email = normalizeLogin(body.email);
      const user = db.app_users.find((u) => String(u.email).toLowerCase() === email);
      if (!user || !comparePassword(body.password))
        return send(res, 401, { error: "Login local inválido" });
      user.last_login_at = now();
      user.updated_at = now();
      writeDb(db);
      return send(res, 200, {
        access_token: `local:${user.auth_user_id || user.id}`,
        refresh_token: `local-refresh:${user.id}`,
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
        token_type: "bearer",
        user: { id: user.auth_user_id || user.id, email: user.email },
      });
    }
    if (url.pathname === "/auth/v1/logout") return send(res, 200, {});
    if (url.pathname.startsWith("/rest/v1/")) return handleRest(req, res, url, db);
    if (url.pathname.startsWith("/functions/v1/")) {
      const name = normalizeFunctionName(url.pathname.split("/").filter(Boolean).pop());
      const payload = JSON.parse((await requestBody(req)).toString("utf8") || "{}");
      const result = await handleFunction(name, payload, db, req);
      writeDb(db);
      return send(res, 200, result);
    }
    if (url.pathname.startsWith("/storage/v1/object/")) return handleStorage(req, res, url);
    if (tryServeFrontend(req, res, url)) return;
    return send(res, 404, { error: "Rota local não encontrada", path: url.pathname });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      log(db, {
        module: "local-api",
        status: "erro",
        severity: "error",
        friendly_message: "Erro no backend local.",
        technical_detail: message,
      });
      writeDb(db);
    } catch {}
    return send(res, 500, { error: message });
  }
}

const server = http.createServer(handler);
server.listen(PORT, HOST, () => {
  console.log(`MYINC Local API rodando em http://${HOST}:${PORT}`);
  console.log(
    `Banco local: ${activeDbPath()} (${DB_DRIVER === "sqlite" && DatabaseSync ? "sqlite" : "json"})`,
  );
  console.log(`Uploads: ${uploadDir}`);
});
