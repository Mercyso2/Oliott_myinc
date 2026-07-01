import {
  err,
  json,
  okOptions,
  readJson,
  requireUser,
  serviceClient,
} from "../_shared/v2-utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return okOptions(req);
  try {
    await requireUser(req);
    const body = (await readJson(req)) as Record<string, unknown>;
    const label = String(body.label ?? `backup-${new Date().toISOString()}`);
    const supabase = serviceClient();
    const tables = [
      "brands",
      "brand_profiles",
      "monthly_plans",
      "post_ideas",
      "posts",
      "generation_jobs",
    ];
    const summary: Record<
      string,
      { rows: number; filteredByBrand: boolean; error: string | null }
    > = {};
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true });
      summary[table] = {
        rows: count ?? 0,
        filteredByBrand: false,
        error: error?.message ?? null,
      };
    }
    await supabase.from("system_logs").insert({
      module: "backup",
      type: "manual",
      status: "ok",
      friendly_message: "Backup lógico registrado.",
      metadata: { label, summary },
    });
    return json(req, {
      ok: true,
      backup: {
        id: crypto.randomUUID(),
        label,
        createdAt: new Date().toISOString(),
        bucket: "logical",
        path: "system_logs",
        sizeBytes: 0,
        summary,
      },
      message: "Backup lógico registrado no histórico.",
    });
  } catch (error) {
    return err(req, error, 400);
  }
});
