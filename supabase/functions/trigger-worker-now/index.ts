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
    const supabase = serviceClient();
    const retryFailed = body.retryFailed === true || body.retry_failed === true;

    if (retryFailed) {
      await supabase.rpc("retry_all_failed_generation_jobs", {
        p_limit: Math.min(Number(body.limit ?? 50) || 50, 200),
      });
    }

    // Libera jobs presos há mais de 20 minutos. O processamento pesado continua no motor local.
    await supabase
      .from("generation_jobs")
      .update({
        status: "queued",
        locked_at: null,
        worker_id: null,
        started_at: null,
        available_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .in("status", ["processing", "running"])
      .lt("locked_at", new Date(Date.now() - 20 * 60 * 1000).toISOString());

    const { count: queued } = await supabase
      .from("generation_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["queued", "pending", "retrying"]);

    return json(req, {
      ok: true,
      processed: 0,
      passes: Number(body.passes ?? 1) || 1,
      queued: queued ?? 0,
      results: [],
      message:
        "Fila acordada. O Motor Local processa automaticamente no próximo ciclo de polling.",
    });
  } catch (error) {
    return err(req, error, 400);
  }
});
