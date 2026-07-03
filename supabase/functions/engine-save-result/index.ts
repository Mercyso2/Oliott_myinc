import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { b64ToBytes, detectBinaryMedia, err, json, normalizeArray, okOptions, readJson, requireWorkerKey, serviceClient, safeString } from "../_shared/v2-utils.ts";

async function publicUpload(supabase: ReturnType<typeof serviceClient>, bucket: string, path: string, bytes: Uint8Array, mime: string) {
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function inferMediaJobType(post: Record<string, unknown>) {
  const format = String(post.format || "").toLowerCase();
  if (format.includes("carrossel")) return "carousel_page";
  if (format.includes("reels") || format.includes("vídeo") || format.includes("video") || format.includes("story")) return "video";
  return "image";
}

async function enqueueMediaJobsAfterContent(
  supabase: ReturnType<typeof serviceClient>,
  job: Record<string, unknown>,
  postId: string,
  contentResult: Record<string, unknown>,
) {
  const { data: post, error: postErr } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
  if (postErr || !post) throw new Error("Post não encontrado para criar jobs de mídia após conteúdo.");
  const type = inferMediaJobType(post);
  const { data: payload, error: payloadErr } = await supabase.rpc("build_prompt_payload", { p_post_id: postId, p_job_type: type });
  if (payloadErr) throw payloadErr;

  const pages = Array.isArray(contentResult.carousel_pages) ? contentResult.carousel_pages : [];
  const pageCount = type === "carousel_page" ? Math.max(2, Math.min(8, pages.length || Number(payload?.page_count || 5))) : 1;
  const batchId = safeString(job.batch_id) || crypto.randomUUID();
  const now = new Date().toISOString();

  for (let page = 1; page <= pageCount; page++) {
    const pageContent = type === "carousel_page" ? pages[page - 1] || null : null;
    const input = {
      ...(payload || {}),
      page,
      page_count: pageCount,
      total_pages: pageCount,
      carousel_page: pageContent,
      force: Boolean((job.input_json as Record<string, unknown> | null)?.force || (job.payload as Record<string, unknown> | null)?.force),
      instruction: (job.input_json as Record<string, unknown> | null)?.instruction || (job.payload as Record<string, unknown> | null)?.instruction || null,
    };
    const { error: insertErr } = await supabase.from("generation_jobs").insert({
      brand_id: job.brand_id,
      post_id: postId,
      batch_id: batchId,
      parent_job_id: job.id,
      job_type: type,
      type,
      status: "queued",
      progress: 0,
      provider: "openai",
      priority: 20 + page,
      input_json: input,
      payload: input,
      prompt_build_id: payload?.promptBuildId || payload?.prompt_build_id || null,
      idempotency_key: `${type}-${postId}-${page}-${crypto.randomUUID()}`,
      available_at: now,
      error_message: null,
    });
    if (insertErr) throw insertErr;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return okOptions(req);
  try {
    const workerKey = await requireWorkerKey(req);
    const body = await readJson(req) as Record<string, unknown>;
    const supabase = serviceClient();
    const workerId = safeString(body.workerId || body.worker_id);
    const jobId = safeString(body.jobId || body.job_id);
    if (!workerId || !jobId) throw new Error("workerId e jobId são obrigatórios.");
    const { data: job, error: jobErr } = await supabase.from("generation_jobs").select("*").eq("id", jobId).maybeSingle();
    if (jobErr || !job) throw new Error("Job não encontrado para salvar resultado.");
    const postId = safeString(job.post_id);
    const type = safeString(job.job_type || job.type || body.type || body.jobType, "image");
    const result = (body.result || body.output || {}) as Record<string, unknown>;
    const artifact = (body.artifact || result.artifact || {}) as Record<string, unknown>;
    const posterArtifact = (body.posterArtifact || result.poster_artifact || result.posterArtifact || {}) as Record<string, unknown>;
    let mediaUrl = safeString(result.media_url || result.mediaUrl || artifact.url);
    let mime = safeString(artifact.mime || artifact.mime_type, type === "video" ? "video/mp4" : "image/png");
    let posterUrl = safeString(result.poster_url || result.posterUrl || posterArtifact.url);
    const audioUrl = safeString(result.audio_url || result.audioUrl || result.sound_asset_url || result.soundAssetUrl);
    const soundDirection = safeString(result.sound_direction || result.soundDirection);

    if (!mediaUrl && artifact.base64) {
      const bytes = b64ToBytes(String(artifact.base64));
      const detected = detectBinaryMedia(bytes, mime);
      mime = detected.mime;
      const path = `${postId || "jobs"}/${jobId}-${Date.now()}.${detected.ext}`;
      mediaUrl = await publicUpload(supabase, "creative-media", path, bytes, mime);
    }

    if (!posterUrl && posterArtifact.base64) {
      const bytes = b64ToBytes(String(posterArtifact.base64));
      const detected = detectBinaryMedia(bytes, "image/png");
      const path = `${postId || "jobs"}/${jobId}-poster-${Date.now()}.${detected.ext}`;
      posterUrl = await publicUpload(supabase, "creative-media", path, bytes, detected.mime);
    }

    if (postId) {
      if (type === "content") {
        const hashtags = normalizeArray(result.hashtags).join(" ");
        const previousMetadata = ((job.input_json as Record<string, unknown>)?.post as Record<string, unknown> | undefined)?.metadata;
        await supabase.from("posts").update({
          title: safeString(result.title, undefined as unknown as string) || undefined,
          headline: safeString(result.headline, undefined as unknown as string) || undefined,
          caption: safeString(result.caption || result.copy, undefined as unknown as string) || undefined,
          short_text: safeString(result.short_text, undefined as unknown as string) || undefined,
          hashtags: hashtags || undefined,
          cta: safeString(result.cta, undefined as unknown as string) || undefined,
          image_prompt: safeString(result.image_prompt || result.visual_prompt, undefined as unknown as string) || undefined,
          video_prompt: safeString(result.video_prompt, undefined as unknown as string) || undefined,
          creative_brief: safeString(result.creative_brief || result.visual_idea, undefined as unknown as string) || undefined,
          master_prompt: safeString(result.master_prompt || result.prompt_used, safeString(job.input_json?.final_prompt || job.payload?.final_prompt)),
          // Score honesto: só o valor real vindo do motor; ausente fica null.
          quality_score: Number(result.quality_score) ? Math.min(100, Math.max(0, Number(result.quality_score))) : null,
          metadata: {
            ...((previousMetadata && typeof previousMetadata === "object") ? previousMetadata as Record<string, unknown> : {}),
            creative_engine_v7: {
              content_pillar: result.content_pillar || null,
              visual_direction: result.visual_direction || result.visual_recipe || null,
              headline_design: result.headline_design || result.headline || null,
              subheadline_design: result.subheadline_design || result.short_text || null,
              cta_design: result.cta_design || result.cta || null,
              visual_recipe: result.visual_recipe || null,
              critic_checklist: result.critic_checklist || null,
              production_tier: result.production_tier || null,
              brand_alignment: result.brand_alignment || null,
              ai_quality_notes: result.ai_quality_notes || null,
              generated_at: new Date().toISOString(),
            },
            carousel_pages: Array.isArray(result.carousel_pages) ? result.carousel_pages : undefined,
            video_storyboard: Array.isArray(result.video_storyboard) ? result.video_storyboard : undefined,
          },
          status: "em_producao",
          error_message: null,
          updated_at: new Date().toISOString(),
        }).eq("id", postId);
        await enqueueMediaJobsAfterContent(supabase, job, postId, result);
      } else if (type === "carousel_page") {
        const { data: current } = await supabase.from("posts").select("carousel_media_urls, metadata").eq("id", postId).maybeSingle();
        const page = Math.max(1, Number(job.input_json?.page || job.payload?.page || body.page || 1));
        const pageCount = Math.max(1, Number(job.input_json?.page_count || job.input_json?.total_pages || job.payload?.page_count || 1));
        // Slots por página em metadata: ordem estável mesmo se as páginas terminarem
        // fora de sequência (retry/paralelismo); array compactado corrompia a ordem.
        const currentMetadata = current?.metadata && typeof current.metadata === "object" ? current.metadata as Record<string, unknown> : {};
        const slots = { ...((currentMetadata.carousel_page_urls && typeof currentMetadata.carousel_page_urls === "object") ? currentMetadata.carousel_page_urls as Record<string, string> : {}) };
        if (mediaUrl) slots[String(page)] = mediaUrl;
        const orderedUrls = Object.keys(slots).map(Number).sort((a, b) => a - b).map((key) => slots[String(key)]).filter(Boolean);
        const complete = orderedUrls.length >= pageCount;
        await supabase.from("posts").update({
          carousel_media_urls: orderedUrls,
          media_url: orderedUrls[0] || mediaUrl || null,
          metadata: { ...currentMetadata, carousel_page_urls: slots },
          // Só vai para revisão com todos os slides prontos.
          status: complete ? "aguardando_revisao" : "em_producao",
          error_message: null,
          updated_at: new Date().toISOString(),
        }).eq("id", postId);
      } else if (type === "video") {
        const { data: currentPost } = await supabase.from("posts").select("metadata").eq("id", postId).maybeSingle();
        const currentMetadata = currentPost?.metadata && typeof currentPost.metadata === "object" ? currentPost.metadata as Record<string, unknown> : {};
        await supabase.from("posts").update({
          media_url: posterUrl || mediaUrl || undefined,
          video_url: mediaUrl || undefined,
          video_poster_url: posterUrl || undefined,
          video_status: mediaUrl ? "video_pronto" : "storyboard_pronto",
          video_progress: mediaUrl ? 100 : 70,
          video_prompt: safeString(result.video_prompt || job.input_json?.final_prompt || job.payload?.final_prompt),
          audio_url: audioUrl || undefined,
          sound_asset_url: audioUrl || undefined,
          metadata: {
            ...currentMetadata,
            video_generation: {
              provider: result.provider || null,
              sound_direction: soundDirection || null,
              openai_video_id: safeString(result.openai_video_id) || null,
              generated_at: new Date().toISOString(),
            },
          },
          status: "aguardando_revisao",
          error_message: null,
          updated_at: new Date().toISOString(),
        }).eq("id", postId);
      } else {
        await supabase.from("posts").update({ media_url: mediaUrl || undefined, status: "aguardando_revisao", error_message: null, updated_at: new Date().toISOString() }).eq("id", postId);
      }
      if (mediaUrl || type === "content") {
        await supabase.from("post_versions").insert({
          brand_id: job.brand_id,
          post_id: postId,
          version_label: `motor-${type}`,
          source: "motor-local-v7-final",
          media_url: posterUrl || mediaUrl || null,
          video_url: type === "video" ? mediaUrl || null : null,
          output_json: { ...result, mediaUrl, posterUrl, mime, type },
          prompt_used: safeString(job.input_json?.final_prompt || job.payload?.final_prompt),
          quality_score: Number(result.quality_score) ? Math.min(100, Math.max(0, Number(result.quality_score))) : null,
          is_current: true,
        });
      }
    }

    const { data: completed, error: completeErr } = await supabase.rpc("complete_generation_job", { p_worker_id: workerId, p_device_key_hash: workerKey.hash, p_job_id: jobId, p_output_json: { ...result, mediaUrl, posterUrl, mime, type } });
    if (completeErr) throw completeErr;
    await supabase.from("generation_jobs").update({ result: { ...result, mediaUrl, posterUrl, mime, type }, finished_at: new Date().toISOString(), technical_detail: null }).eq("id", jobId);
    return json(req, { ok: true, job: completed, mediaUrl, posterUrl });
  } catch (error) { return err(req, error, 500); }
});
