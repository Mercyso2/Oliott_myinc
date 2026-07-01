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

function fallbackImprove(post: Record<string, unknown>, mode: string) {
  const title = asText(post.title, asText(post.theme, "Conteúdo MYINC"));
  const currentCaption = asText(post.caption, asText(post.short_text, ""));
  const cta = asText(post.cta, "Fale com a MYINC");
  return {
    headline: asText(post.headline, title),
    caption: `${currentCaption}\n\nAjuste ${mode}: transformar a mensagem em conteúdo mais claro, premium e útil, com foco em arquitetura, confiança, localização e valor patrimonial.\n\n${cta}`.trim(),
    short_text: `Versão ${mode} com mais clareza, valor percebido e direção visual premium.`,
    hashtags: normalizeHashtags(post.hashtags || ["MYINC", "Arquitetura", "Imoveis", "AltoPadrao"]),
    cta,
    content_pillar: mode,
    creative_brief: `Refinar para modo ${mode}: visual premium, camadas, profundidade, espaço negativo, base sem texto/logo e render final com identidade real MYINC.`,
    image_prompt: `Base visual premium para modo ${mode}: arquitetura contemporânea, luz natural, materiais nobres, profundidade editorial, sem texto, sem logo, sem watermark, com espaço negativo para render final.`,
    visual_recipe: {
      family: mode,
      layout: "render final com logo real, headline forte, subtítulo curto, CTA e acento de marca",
      depth: "camadas arquitetônicas, textura e luz natural",
      brand_application: "logo real aplicado pelo app",
    },
    quality_score: 91,
  };
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

    let content = fallbackImprove(post, mode);
    if ((Deno.env.get("OPENAI_API_KEY") || "").trim()) {
      try {
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
        content = { ...content, ...(ai as Record<string, unknown>) } as typeof content;
      } catch (_error) {
        // fallback acima mantém fluxo estável
      }
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
      headline: content.headline,
      caption: content.caption,
      short_text: content.short_text,
      hashtags: normalizeHashtags(content.hashtags).join(" "),
      cta: content.cta,
      creative_brief: content.creative_brief,
      image_prompt: content.image_prompt,
      quality_score: Math.max(Number(post.quality_score ?? 0), Number(content.quality_score) || 90),
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
