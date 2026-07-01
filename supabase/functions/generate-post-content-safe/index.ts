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

function fallbackCopy(post: Record<string, unknown>, profile: Record<string, unknown> = {}, instruction = "") {
  const title = asText(post.title, asText(post.theme, "MYINC: arquitetura, localização e valor patrimonial"));
  const headline = asText(post.headline, title);
  const cta = asText(post.cta, "Fale com a MYINC");
  const benefit = asText(profile.benefits, "conforto, segurança, arquitetura contemporânea e valorização patrimonial");
  return {
    title,
    headline,
    caption: `${headline}\n\nNa MYINC, cada detalhe precisa comunicar algo maior do que estética: precisa traduzir confiança, conforto e visão de longo prazo.\n\nQuando arquitetura, localização e execução caminham juntas, o imóvel deixa de ser apenas uma escolha de moradia e passa a ser uma decisão de patrimônio.\n\n${cta}`,
    short_text: `Conteúdo premium sobre ${title}, conectando desejo, critério e valor percebido.`,
    hashtags: ["#MYINC", "#Imoveis", "#Arquitetura", "#AltoPadrao", "#MorarBem", "#Incorporadora"],
    cta,
    content_pillar: "autoridade premium",
    creative_brief: `Peça premium MYINC sobre ${title}. Usar base visual sofisticada, arquitetura contemporânea, luz natural, materiais nobres e espaço negativo para render final. ${instruction}`,
    image_prompt: `Base visual premium para publicação MYINC sobre ${title}. Arquitetura contemporânea brasileira, luz natural, materiais nobres, profundidade editorial, primeiro plano com textura, plano médio arquitetônico, fundo com atmosfera. Sem texto, sem logo, sem watermark, sem estética genérica. ${instruction}`,
    video_prompt: `Reels vertical premium MYINC sobre ${title}: gancho visual forte, 3 a 5 microcenas com arquitetura, lifestyle, detalhes de acabamento e sensação de patrimônio. Som elegante, transições suaves, sem texto confuso e sem logo inventado.`,
    visual_recipe: {
      family: "editorial premium",
      layout: "base visual premium + render final com logo real, headline, subtítulo curto, CTA e acento de marca",
      depth: "primeiro plano com textura/material, plano médio arquitetônico, fundo com luz e profundidade",
      brand_application: "logo real aplicado pelo renderizador; nunca inventar logo na IA",
      color_direction: "usar paleta oficial do brand profile; fallback neutro premium com acento de marca",
    },
    carousel_pages: [
      { index: 1, headline, body: "Um olhar mais criterioso sobre arquitetura, localização e valor percebido.", visual_note: "Capa impactante com arquitetura premium e espaço negativo.", cta: "arraste para entender" },
      { index: 2, headline: "O que realmente valoriza", body: `Projetos melhores unem ${benefit} com execução consistente.`, visual_note: "Detalhe arquitetônico, luz natural e elemento gráfico discreto.", cta: "continue" },
      { index: 3, headline: "Critério antes da decisão", body: "Avaliar um imóvel é entender experiência de uso, entorno, entrega e visão de longo prazo.", visual_note: "Slide educativo limpo, com camadas e respiro.", cta: "salve este ponto" },
      { index: 4, headline: "MYINC traduz isso em projeto", body: "A marca conecta estética, funcionalidade e confiança para quem busca morar melhor ou investir com clareza.", visual_note: "Fechamento premium com CTA e logo real no render.", cta },
    ],
    video_storyboard: [
      { second: "0-2", scene: "gancho com detalhe arquitetônico ou fachada", motion: "push-in suave", sound: "whoosh discreto" },
      { second: "2-5", scene: "materiais, iluminação e experiência de uso", motion: "parallax lento", sound: "textura ambiente premium" },
      { second: "5-8", scene: "fechamento com sensação de patrimônio e confiança", motion: "transição limpa", sound: "finalização elegante" },
    ],
    critic_checklist: ["gancho forte", "valor real", "logo real no render", "visual premium", "não genérico", "legível", "salvável"],
    quality_score: 90,
  };
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

    let content = fallbackCopy(post, profile ?? {}, instruction);
    if ((Deno.env.get("OPENAI_API_KEY") || "").trim()) {
      try {
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
        content = { ...content, ...(ai as Record<string, unknown>) } as typeof content;
      } catch (_error) {
        // Fallback mantém o botão funcional mesmo se a IA oscilar.
      }
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
        title: content.title,
        headline: content.headline,
        caption: content.caption,
        short_text: content.short_text,
        hashtags,
        cta: content.cta,
        image_prompt: content.image_prompt,
        video_prompt: content.video_prompt,
        creative_brief: content.creative_brief,
        quality_score: Math.min(100, Math.max(0, Number(content.quality_score) || 90)),
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
