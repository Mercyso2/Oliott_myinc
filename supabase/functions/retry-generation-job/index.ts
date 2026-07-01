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
    const all =
      body.all === true || body.mode === "all" || body.retryAll === true;
    const limit = Math.max(1, Math.min(Number(body.limit ?? 50) || 50, 200));

    if (all) {
      const { data, error } = await supabase.rpc(
        "retry_all_failed_generation_jobs",
        { p_limit: limit },
      );
      if (error) throw error;
      return json(req, {
        ok: true,
        mode: "all",
        result: data,
        message: "Falhas reenfileiradas para o Motor Local.",
      });
    }

    const jobId = String(body.jobId ?? body.job_id ?? body.id ?? "").trim();
    if (!jobId)
      throw new Error("Informe jobId ou all=true para reprocessar falhas.");

    const { data, error } = await supabase.rpc("retry_generation_job", {
      p_job_id: jobId,
    });
    if (error) {
      const fallback = await supabase
        .from("generation_jobs")
        .update({
          status: "queued",
          attempts: 0,
          progress: 0,
          error_message: null,
          started_at: null,
          completed_at: null,
          failed_at: null,
          locked_at: null,
          worker_id: null,
          available_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .select("id,status")
        .single();
      if (fallback.error) throw fallback.error;
      return json(req, {
        ok: true,
        mode: "single",
        job: fallback.data,
        message: "Job reenfileirado para o Motor Local.",
      });
    }

    return json(req, {
      ok: true,
      mode: "single",
      result: data,
      message: "Job reenfileirado para o Motor Local.",
    });
  } catch (error) {
    return err(req, error, 400);
  }
});
