import { err, json, okOptions, openAIJson, readJson, requireUser, serviceClient } from "../_shared/v2-utils.ts";

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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
    const mode = String(body.mode ?? "premium").trim();
    if (!postId) throw new Error("postId obrigatório.");
    const supabase = serviceClient();
    const { data: post, error } = await supabase.from("posts").select("*").eq("id", postId).single();
    if (error) throw error;
    const { data: profile } = await supabase.from("brand_profiles").select("*").eq("brand_id", post.brand_id).maybeSingle();

    if (!(Deno.env.get("OPENAI_API_KEY") || "").trim()) {
      throw new Error("OPENAI_API_KEY não configurada. Refinamento artificial é proibido — configure a chave para refinar com IA real.");
    }
    // Sem fallback fabricado: se a IA falhar, o erro sobe e o post não é alterado.
    const ai = await openAIJson([
          {
            role: "system",
            content: "Você é o Creative Engine V7 da MYINC. Reescreva e refine o post para ficar mais premium, útil, não genérico e com direção visual pronta para render final com logo real. Responda somente JSON válido.",
          },
          {
            role: "user",
            content: JSON.stringify({
              mode,
              post,
              brand_profile: profile,
              required: ["headline", "caption", "short_text", "hashtags", "cta", "content_pillar", "creative_brief", "image_prompt", "visual_recipe", "quality_score"],
              modes: {
                premium: "sofisticação, arquitetura e desejo",
                authority: "autoridade consultiva e clareza técnica",
                educational: "conteúdo salvável e explicativo",
                curiosity: "gancho de curiosidade para atrair seguidores",
                conversion: "CTA consultivo sem parecer venda agressiva",
                humanized: "aproximação, bastidor e confiança",
                launch: "novidade com percepção de valor",
                luxury: "alto padrão, elegância e exclusividade discreta",
              },
            }),
          },
        ], { maxTokens: 2600, temperature: 0.58, timeoutMs: 45000 });

    const content = ai as Record<string, unknown>;
    const caption = asText(content.caption);
    if (!caption) {
      throw new Error("A IA retornou refinamento incompleto (sem legenda). O post não foi alterado — tente novamente.");
    }

    const previousMetadata = post.metadata && typeof post.metadata === "object" ? post.metadata as Record<string, unknown> : {};
    const metadata = {
      ...previousMetadata,
      creative_engine_v7: {
        ...((previousMetadata.creative_engine_v7 && typeof previousMetadata.creative_engine_v7 === "object") ? previousMetadata.creative_engine_v7 as Record<string, unknown> : {}),
        improve_mode: mode,
        content_pillar: content.content_pillar,
        visual_recipe: content.visual_recipe,
        improved_at: new Date().toISOString(),
      },
    };

    const patch = {
      status: "aguardando_revisao",
      headline: asText(content.headline, asText(post.headline)),
      caption,
      short_text: asText(content.short_text, asText(post.short_text)),
      hashtags: normalizeHashtags(content.hashtags).join(" "),
      cta: asText(content.cta, asText(post.cta)),
      creative_brief: asText(content.creative_brief, asText(post.creative_brief)),
      image_prompt: asText(content.image_prompt, asText(post.image_prompt)),
      quality_score: Number(content.quality_score) ? Math.min(100, Math.max(0, Number(content.quality_score))) : post.quality_score ?? null,
      metadata,
      updated_at: new Date().toISOString(),
      error_message: null,
    };
    const { data: updated, error: updateError } = await supabase.from("posts").update(patch).eq("id", postId).select("*").single();
    if (updateError) throw updateError;
    return json(req, { ok: true, post: updated, review: content, message: "Post refinado pelo Creative Engine V7 e enviado para revisão." });
  } catch (error) {
    return err(req, error, 400);
  }
});
