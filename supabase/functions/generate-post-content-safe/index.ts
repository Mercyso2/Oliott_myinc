import { err, json, okOptions, openAIJson, readJson, requireUser, serviceClient } from "../_shared/v2-utils.ts";

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeHashtags(value: unknown) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\s,;#]+/)
      : [];
  return raw.map((x) => String(x || "").trim().replace(/^#/, "")).filter(Boolean).slice(0, 14).map((x) => `#${x}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return okOptions(req);
  try {
    await requireUser(req);
    const body = await readJson(req) as Record<string, unknown>;
    const postId = String(body.postId ?? body.post_id ?? "").trim();
    const instruction = String(body.instruction ?? "").trim();
    if (!postId) throw new Error("postId obrigatório.");

    const supabase = serviceClient();
    const { data: post, error: postError } = await supabase.from("posts").select("*").eq("id", postId).single();
    if (postError) throw postError;

    const { data: profile } = await supabase.from("brand_profiles").select("*").eq("brand_id", post.brand_id).maybeSingle();
    const { data: rules } = await supabase.from("ai_brain_rules").select("name,category,content,priority").eq("brand_id", post.brand_id).eq("active", true).is("archived_at", null).order("priority", { ascending: false }).limit(18);
    const { data: templates } = await supabase.from("ai_prompt_templates").select("name,content,note,version").or(`brand_id.eq.${post.brand_id},brand_id.is.null`).eq("active", true).is("archived_at", null).order("created_at", { ascending: false }).limit(8);
    const { data: library } = await supabase.from("library_items").select("name,notes,tags,item_type,asset_role,usage_context,status").eq("brand_id", post.brand_id).is("archived_at", null).limit(12);

    if (!(Deno.env.get("OPENAI_API_KEY") || "").trim()) {
      throw new Error("OPENAI_API_KEY não configurada. Conteúdo artificial é proibido — configure a chave para gerar conteúdo real com IA.");
    }
    // Sem fallback fabricado: se a IA falhar, o erro sobe e nada é salvo como se fosse conteúdo real.
    const ai = await openAIJson([
          {
            role: "system",
            content: [
              "Você é o Creative Engine V7 da MYINC: estrategista de conteúdo, diretor criativo e social media sênior para incorporadora premium.",
              "Crie posts com valor real: curiosidade, autoridade, novidade, conteúdo salvável, captação de seguidores e conversão consultiva.",
              "A imagem base deve ser sem texto e sem logo; o app finaliza com logo real, paleta, headline, CTA e camadas.",
              "Responda somente JSON válido.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              post,
              brand_profile: profile,
              rules: rules ?? [],
              templates: templates ?? [],
              library_summary: library ?? [],
              instruction,
              required: [
                "title", "headline", "caption", "short_text", "hashtags", "cta", "content_pillar", "creative_brief",
                "image_prompt", "video_prompt", "visual_recipe", "carousel_pages", "video_storyboard", "critic_checklist", "quality_score",
              ],
              quality_bar: "Precisa parecer conteúdo profissional de Instagram, não institucional genérico. Deve ser útil, salvável ou gerar desejo/autoridade.",
            }),
          },
        ], { maxTokens: 3600, temperature: 0.62, timeoutMs: 55000 });

    const content = ai as Record<string, unknown>;
    const caption = asText(content.caption);
    const imagePrompt = asText(content.image_prompt);
    if (!caption || !imagePrompt) {
      throw new Error("A IA retornou conteúdo incompleto (sem legenda ou prompt de imagem). Nada foi salvo — tente novamente.");
    }

    const hashtags = normalizeHashtags(content.hashtags).join(" ");
    const previousMetadata = post.metadata && typeof post.metadata === "object" ? post.metadata as Record<string, unknown> : {};
    const metadata = {
      ...previousMetadata,
      creative_engine_v7: {
        content_pillar: content.content_pillar,
        visual_recipe: content.visual_recipe,
        critic_checklist: content.critic_checklist,
        generated_at: new Date().toISOString(),
        mode: "final-direct",
      },
      carousel_pages: asArray(content.carousel_pages).slice(0, 8),
      video_storyboard: asArray(content.video_storyboard).slice(0, 8),
    };

    const { data: updated, error: updateError } = await supabase
      .from("posts")
      .update({
        title: asText(content.title, asText(post.title, asText(post.theme))),
        headline: asText(content.headline, asText(post.headline, asText(content.title))),
        caption,
        short_text: asText(content.short_text, asText(post.short_text)),
        hashtags,
        cta: asText(content.cta, asText(post.cta)),
        image_prompt: imagePrompt,
        video_prompt: asText(content.video_prompt, asText(post.video_prompt)),
        creative_brief: asText(content.creative_brief, asText(post.creative_brief)),
        quality_score: Number(content.quality_score) ? Math.min(100, Math.max(0, Number(content.quality_score))) : null,
        metadata,
        status: "aguardando_revisao",
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", postId)
      .select("*")
      .single();
    if (updateError) throw updateError;

    return json(req, { ok: true, post: updated, content, message: "Conteúdo Creative Engine V7 atualizado com estratégia, direção visual, carrossel e vídeo." });
  } catch (error) {
    return err(req, error, 400);
  }
});
