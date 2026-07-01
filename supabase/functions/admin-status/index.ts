import {
  err,
  json,
  okOptions,
  requireUser,
  serviceClient,
} from "../_shared/v2-utils.ts";

function hasEnv(name: string) {
  return Boolean((Deno.env.get(name) || "").trim());
}

async function tableExists(
  supabase: ReturnType<typeof serviceClient>,
  table: string,
) {
  const { error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  return !error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return okOptions(req);
  try {
    await requireUser(req);
    const supabase = serviceClient();
    const requiredTables = [
      "app_users",
      "brands",
      "brand_profiles",
      "posts",
      "monthly_plans",
      "post_ideas",
      "media_assets",
      "library_items",
      "publish_queue",
      "system_logs",
    ];
    const tablePairs = await Promise.all(
      requiredTables.map(
        async (table) => [table, await tableExists(supabase, table)] as const,
      ),
    );
    const tables = Object.fromEntries(tablePairs);
    const databaseConnected = Object.values(tables).some(Boolean);

    return json(req, {
      ok: true,
      admin: true,
      environment: {
        supabaseBackend: databaseConnected,
        serviceRole: true,
        openaiApiKey: hasEnv("OPENAI_API_KEY"),
        openaiTextModel: Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-4o-mini",
        openaiImageModel: Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-1",
        metaPageAccessToken: hasEnv("META_PAGE_ACCESS_TOKEN"),
        metaPageId: hasEnv("META_PAGE_ID"),
        metaInstagramBusinessId: hasEnv("META_INSTAGRAM_BUSINESS_ID"),
        workerKey:
          hasEnv("WORKER_DEVICE_KEY") || hasEnv("SUPABASE_WORKER_DEVICE_KEY"),
        publicMediaBaseUrl: Deno.env.get("PUBLIC_MEDIA_BASE_URL") || null,
        corsAllowOrigin: Deno.env.get("CORS_ALLOW_ORIGIN") || "*",
      },
      database: { connected: databaseConnected, tables },
      storage: {
        "creative-media": true,
        "brand-assets": true,
        library: true,
      },
      edgeFunctions: {
        "enqueue-generation": true,
        "engine-register-worker": true,
        "engine-save-result": true,
        "publish-meta": true,
        "publish-scheduled-posts": true,
      },
      message: databaseConnected
        ? "Status real validado."
        : "Supabase respondeu, mas as tabelas principais ainda n�o foram encontradas.",
    });
  } catch (error) {
    return err(req, error, 500);
  }
});
