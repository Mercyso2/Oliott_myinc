import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { err, json, okOptions, readJson, requireUser, serviceClient, safeString } from "../_shared/v2-utils.ts";

function inferJobTypes(_format: string, explicit?: string) {
  if (explicit === "content" || explicit === "image" || explicit === "video" || explicit === "carousel_page") return ["content"];
  return ["content"];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return okOptions(req);
  try {
    await requireUser(req);
    const body = await readJson(req) as Record<string, unknown>;
    const supabase = serviceClient();
    const rawIds = Array.isArray(body.postIds) ? body.postIds : body.postId ? [body.postId] : [];
    const postIds = Array.from(new Set(rawIds.map((x) => String(x)).filter(Boolean)));
    if (!postIds.length) throw new Error("postIds obrigatório para criar fila.");
    const batchId = crypto.randomUUID();
    const jobs: unknown[] = [];
    const skipped: unknown[] = [];

    for (const postId of postIds) {
      const { data: post, error: postErr } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
      if (postErr || !post) { skipped.push({ postId, reason: "post não encontrado" }); continue; }
      if (post.deleted_at || post.archived_at || ["arquivado","excluido","excluído","deleted"].includes(String(post.status || "").toLowerCase())) {
        skipped.push({ postId, reason: "post arquivado/excluído" }); continue;
      }
      const types = inferJobTypes(String(post.format || ""), safeString(body.jobType));
      for (const type of types) {
        const { data: payload, error: payloadErr } = await supabase.rpc("build_prompt_payload", { p_post_id: postId, p_job_type: type });
        if (payloadErr) throw payloadErr;
        const pageCount = 1;
        for (let page = 1; page <= pageCount; page++) {
          const input = { ...(payload || {}), page, page_count: pageCount, force: Boolean(body.force), instruction: body.instruction || null };
          const { data: job, error: jobErr } = await supabase.from("generation_jobs").insert({
            brand_id: post.brand_id,
            post_id: postId,
            batch_id: batchId,
            job_type: type,
            type,
            status: "queued",
            progress: 0,
            provider: "openai",
            priority: type === "content" ? 10 : 20 + page,
            input_json: input,
            payload: input,
            prompt_build_id: payload?.promptBuildId || payload?.prompt_build_id || null,
            idempotency_key: `${type}-${postId}-${page}-${crypto.randomUUID()}`,
            available_at: new Date().toISOString(),
            error_message: null,
          }).select("*").single();
          if (jobErr) throw jobErr;
          jobs.push(job);
        }
      }
      await supabase.from("posts").update({ status: "em_fila", batch_id: batchId, error_message: null, updated_at: new Date().toISOString() }).eq("id", postId);
    }
    return json(req, { ok: true, batchId, queued: jobs.length, jobs, skipped });
  } catch (error) {
    return err(req, error, 500);
  }
});
