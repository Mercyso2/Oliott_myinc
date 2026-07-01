import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(path, snippets) {
  const text = read(path);
  for (const snippet of snippets) {
    assert(
      text.includes(snippet),
      `${path} nao contem trecho obrigatorio: ${snippet}`,
    );
  }
}

includes("engine/runtime/main-loop.mjs", [
  "posterArtifact: output.posterArtifact || null",
  "engine-save-result",
]);

includes("engine/processors/job-processor.mjs", [
  "carousel_page",
  "Brand visual recipe from app",
  "Quality bar: the base image must look like a premium real-estate campaign",
  "posterArtifact",
]);

includes("engine/openai/openai-client.mjs", [
  "reference_policy",
  "Protect brand assets",
  "role=person_reference",
  "role=architecture_reference",
  "Never generate fake logos",
]);

includes("engine/renderers/design-renderer-v2.mjs", [
  "logoDataUriFromPayload",
  "ctaWidth",
  "payload.carousel_page",
  "logoApplied",
]);

includes("engine/processors/video-processor.mjs", [
  "input_reference",
  "logo|brand_kit|sound|audio|som|trilha",
  "local-ffmpeg-fallback",
]);

includes("supabase/patches/MYINC_FINAL_CREATIVE_ENGINE_V7_0.sql", [
  "alter table public.library_items add column if not exists source_url text",
  "alter table public.brand_assets add column if not exists asset_role text",
  "reference_assets",
  "render_mode",
]);

includes("supabase/v2/02_CREATE_V2_SCHEMA.sql", [
  "source_url text",
  "asset_role text",
  "usage_context text",
]);

const distIndex = join(root, "dist", "client", "index.html");
if (existsSync(join(root, "dist"))) {
  assert(
    existsSync(distIndex),
    "dist/client/index.html ausente. Rode npm run build.",
  );
}

console.log("[verify-creative-journey] Jornada criativa validada.");
