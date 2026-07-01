import { existsSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

function loadEnvFile(file) {
  const path = join(projectRoot, file);
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.engine");
loadEnvFile(".env.local");
loadEnvFile(".env");

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || "";
const BRAND_ID_ENV = process.env.MYINC_BRAND_ID || process.env.BRAND_ID || "";

if (!SUPABASE_URL) {
  console.error("ERRO: SUPABASE_URL ou VITE_SUPABASE_URL não encontrado no .env.engine/.env.local.");
  process.exit(1);
}
if (!SERVICE_KEY) {
  console.error("ERRO: SUPABASE_SERVICE_ROLE_KEY não encontrado.");
  console.error("Coloque temporariamente sua service role key no .env.engine assim:");
  console.error("SUPABASE_SERVICE_ROLE_KEY=SEU_SERVICE_ROLE_KEY");
  console.error("Depois de importar os templates, pode remover essa linha do arquivo local.");
  process.exit(1);
}

const headersJson = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function rest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { ...headersJson, ...(options.headers || {}) },
  });
  const text = await response.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path} falhou HTTP ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

async function ensureBucket() {
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: headersJson,
      body: JSON.stringify({ id: "library", name: "library", public: true, file_size_limit: 52428800 }),
    });
    console.log("Bucket library criado.");
  } catch {}
}

async function findBrandId() {
  if (BRAND_ID_ENV) return BRAND_ID_ENV;
  const rows = await rest('/rest/v1/brands?select=id,name,public_name,slug,status,archived_at&archived_at=is.null&order=created_at.asc&limit=50');
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Nenhuma marca encontrada em public.brands.");
  const myinc = rows.find((b) => `${b.name || ""} ${b.public_name || ""} ${b.slug || ""}`.toLowerCase().includes("myinc"));
  const active = rows.find((b) => String(b.status || "").toLowerCase() === "active");
  return (myinc || active || rows[0]).id;
}

function safePathName(value) {
  return String(value || "template").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

async function uploadFile(brandId, item) {
  const filePath = join(projectRoot, "public", "myinc", "templates", item.file);
  if (!existsSync(filePath)) throw new Error(`Arquivo não encontrado: ${filePath}`);
  const buffer = readFileSync(filePath);
  const storagePath = `${brandId}/library/templates-v6-7/${safePathName(item.file)}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/library/${storagePath}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "image/png", "x-upsert": "true" },
    body: buffer,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Upload ${item.file} falhou HTTP ${response.status}: ${text}`);
  return { storagePath, publicUrl: `${SUPABASE_URL}/storage/v1/object/public/library/${storagePath}`, size: statSync(filePath).size };
}

async function cleanupOldPack(brandId) {
  const q = `brand_id=eq.${encodeURIComponent(brandId)}&origin=eq.template-pack-v6-7`;
  await rest(`/rest/v1/library_items?${q}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  await rest(`/rest/v1/media_assets?${q}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

async function insertRows(brandId, item, upload) {
  const commonMeta = { template_pack: "MYINC_TEMPLATES_VISUAIS_V6_7", template_kind: item.template_kind, visual_policy: "light_background_only", prompt_instruction: item.usage_rule, approved_in_chat: true };
  const mediaPayload = {
    brand_id: brandId, name: item.name, type: "Template", media_type: "Template", bucket: "library", path: upload.storagePath,
    url: upload.publicUrl, source_url: upload.publicUrl, public_url: upload.publicUrl, preview_url: upload.publicUrl,
    mime_type: "image/png", size_bytes: upload.size, status: "template", tags: item.tags, notes: item.notes,
    origin: "template-pack-v6-7", campaign: "MYINC Templates Visuais V6.7", format: item.format,
    usage_context: `template_style:${item.template_kind}`, ai_allowed: true, storage_bucket: "library", storage_path: upload.storagePath,
    is_final: false, used_in_publish: false, metadata: commonMeta,
  };
  const media = await rest('/rest/v1/media_assets', { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(mediaPayload) });
  const mediaId = Array.isArray(media) ? media[0]?.id : media?.id;
  const libraryPayload = {
    brand_id: brandId, media_asset_id: mediaId || null, name: item.name, item_type: "Template", type: "Template", media_type: "image/png",
    bucket: "library", path: upload.storagePath, url: upload.publicUrl, source_url: upload.publicUrl, public_url: upload.publicUrl,
    notes: item.notes, tags: item.tags, ai_usage_rule: item.usage_rule, status: "template", origin: "template-pack-v6-7",
    campaign: "MYINC Templates Visuais V6.7", format: item.format, usage_context: `template_style:${item.template_kind}`,
    ai_allowed: true, storage_bucket: "library", storage_path: upload.storagePath, metadata: commonMeta,
  };
  await rest('/rest/v1/library_items', { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(libraryPayload) });
}

async function main() {
  const manifestPath = join(projectRoot, "public", "myinc", "templates", "manifest.json");
  if (!existsSync(manifestPath)) throw new Error("manifest.json não encontrado. Rode primeiro o APLICAR_PATCH_TEMPLATES_VISUAIS_V6_7.py.");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  await ensureBucket();
  const brandId = await findBrandId();
  console.log(`Marca selecionada: ${brandId}`);
  await cleanupOldPack(brandId);
  for (const item of manifest) {
    console.log(`Importando: ${item.name}`);
    const upload = await uploadFile(brandId, item);
    await insertRows(brandId, item, upload);
  }
  console.log("\nTemplates visuais MYINC V6.7 importados com sucesso.");
  console.log("Abra o app > Biblioteca > Templates e clique em Atualizar/Ctrl+F5.");
}

main().catch((error) => { console.error("\nFalha ao importar templates:"); console.error(error instanceof Error ? error.message : error); process.exit(1); });
