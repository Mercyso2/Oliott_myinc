import { err, json, okOptions, readJson, requireUser, serviceClient } from "../_shared/v2-utils.ts";

function inferJobType(format: string) {
  const value = String(format || "").toLowerCase();
  if (value.includes("carrossel")) return "carousel_page";
  if (value.includes("reels") || value.includes("story") || value.includes("stories") || value.includes("vídeo") || value.includes("video")) return "video";
  return "image";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return okOptions(req);
  try {
    await requireUser(req);
    const body = await readJson(req) as Record<string, unknown>;
    const postIds = Array.isArray(body.postIds) ? body.postIds.map(String).filter(Boolean) : [];
    if (!postIds.length) throw new Error("Nenhum post informado para aplicar template.");
    const supabase = serviceClient();
    const batchId = crypto.randomUUID();
    const results: Array<Record<string, unknown>> = [];

    for (const postId of postIds) {
      try {
        const { data: post, error: postErr } = await supabase.from("posts").select("*").eq("id", postId).single();
        if (postErr || !post) throw postErr || new Error("post não encontrado");
        const jobType = inferJobType(String(post.format || ""));
        const { data: payload, error: payloadErr } = await supabase.rpc("build_prompt_payload", { p_post_id: postId, p_job_type: jobType });
        if (payloadErr) throw payloadErr;
        const pageCount = jobType === "carousel_page" ? Math.max(1, Math.min(8, Number(payload?.page_count || payload?.carousel_pages?.length || 5))) : 1;
        let queued = 0;
        for (let page = 1; page <= pageCount; page++) {
          const input = { ...(payload || {}), page, page_count: pageCount, force: true, instruction: "Render final Creative Engine V7 em lote." };
          const { error: jobErr } = await supabase.from("generation_jobs").insert({
            brand_id: post.brand_id,
            post_id: postId,
            batch_id: batchId,
            job_type: jobType,
            type: jobType,
            status: "queued",
            progress: 0,
            provider: "openai",
            priority: jobType === "video" ? 12 : 18 + page,
            input_json: input,
            payload: input,
            prompt_build_id: payload?.prompt_build_id || payload?.promptBuildId || null,
            idempotency_key: `render-batch-v7-${jobType}-${postId}-${page}-${crypto.randomUUID()}`,
            page_number: jobType === "carousel_page" ? page : null,
            item_index: jobType === "carousel_page" ? page : null,
            available_at: new Date().toISOString(),
            error_message: null,
          });
          if (jobErr) throw jobErr;
          queued++;
        }
        await supabase.from("posts").update({
          status: "em_fila",
          quality_review: { template_applied: true, template_engine: "creative-engine-v7-final-batch", checked_at: new Date().toISOString() },
          batch_id: batchId,
          updated_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", postId);
        results.push({ postId, ok: true, jobType, queued });
      } catch (error) {
        results.push({ postId, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return json(req, { ok: true, batchId, processed: results.filter((r) => r.ok).length, queued: results.reduce((sum, r) => sum + Number(r.queued || 0), 0), results, message: "Templates V7 enviados para o Motor Local." });
  } catch (error) {
    return err(req, error, 400);
  }
});
