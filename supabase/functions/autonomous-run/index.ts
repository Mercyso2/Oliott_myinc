import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { err, json, okOptions, readJson, requireUser, serviceClient, safeString, systemLog } from "../_shared/v2-utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return okOptions(req);
  const supabase = serviceClient();
  try {
    const user = await requireUser(req);
    const body = await readJson(req) as Record<string, unknown>;
    const brandId = safeString(body.brandId || body.brand_id);
    const limit = Math.max(1, Math.min(50, Number(body.limit || 30)));
    if (!brandId) throw new Error("brandId obrigatório para produção autônoma.");

    const { data: posts, error } = await supabase
      .from("posts")
      .select("*")
      .eq("brand_id", brandId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .in("status", ["rascunho", "tema_aprovado", "aprovado", "aguardando_revisao", "em_producao", "erro", "erro_ia"])
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;

    let queued = 0;
    const results: unknown[] = [];
    for (const post of posts || []) {
      try {
        const { data, error: rpcErr } = await supabase.rpc("enqueue_post_generation", { p_post_id: post.id, p_force: Boolean(body.force ?? false) });
        if (rpcErr) throw rpcErr;
        queued += Number((data as any)?.queued ?? 1);
        results.push({ postId: post.id, ok: true, result: data });
      } catch (e) {
        results.push({ postId: post.id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    await systemLog(supabase, {
      brand_id: brandId,
      user_id: user.id,
      module: "autonomous-run",
      type: "queue",
      status: "ok",
      friendly_message: "Produção autônoma criou/atualizou fila do motor local.",
      metadata: { requested: posts?.length || 0, queued, results },
    });

    return json(req, { ok: true, createdPosts: 0, produced: posts?.length || 0, generatedImages: 0, approved: 0, scheduled: 0, published: 0, queued, results });
  } catch (error) {
    return err(req, error, 500);
  }
});
