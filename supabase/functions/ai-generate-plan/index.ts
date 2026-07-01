import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { err, json, okOptions, openAIJson, readJson, requireUser, serviceClient, safeString, readableEdgeError } from "../_shared/v2-utils.ts";

type FormatEntry = readonly [string, number];

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function requestedTotalFromPayload(payload: Record<string, unknown>) {
  return Math.max(1, Math.min(90, Math.floor(numberValue(payload.requestedTotalPosts ?? payload.totalPosts ?? payload.total_posts, 30))));
}

function normalizeFormats(raw: unknown, total: number): FormatEntry[] {
  const requestedTotal = Math.max(1, Math.floor(total));
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const entries = Object.entries(source)
    .map(([format, qty]) => [format, Math.max(0, Math.floor(numberValue(qty, 0)))] as const)
    .filter(([format]) => Boolean(String(format || "").trim()));

  if (!entries.length) return [["Feed 1080x1350", requestedTotal]] as const;

  const weightSum = entries.reduce((acc, [, qty]) => acc + qty, 0);
  if (weightSum <= 0) return [[entries[0]?.[0] || "Feed 1080x1350", requestedTotal]] as const;

  const rawScaled = entries.map(([format, qty]) => ({ format, exact: (qty / weightSum) * requestedTotal, weight: qty }));
  const normalized = rawScaled.map((item) => ({ format: item.format, qty: Math.floor(item.exact), remainder: item.exact - Math.floor(item.exact), weight: item.weight }));

  let diff = requestedTotal - normalized.reduce((acc, item) => acc + item.qty, 0);
  const byRemainder = [...normalized].sort((a, b) => b.remainder - a.remainder || b.weight - a.weight);
  let cursor = 0;
  while (diff > 0) {
    const target = byRemainder[cursor % byRemainder.length] ?? normalized[0];
    target.qty += 1;
    diff -= 1;
    cursor += 1;
  }
  while (diff < 0) {
    const target = normalized.find((item) => item.qty > 0) ?? normalized[0];
    target.qty = Math.max(0, target.qty - 1);
    diff += 1;
  }

  return normalized.filter((item) => item.qty > 0).map((item) => [item.format, item.qty] as const);
}

function buildFormatSequence(entries: FormatEntry[], total: number) {
  const sequence: string[] = [];
  for (const [format, qty] of entries) {
    for (let i = 0; i < qty; i += 1) sequence.push(format);
  }
  while (sequence.length < total) sequence.push(entries[sequence.length % entries.length]?.[0] || "Feed 1080x1350");
  return sequence.slice(0, total);
}

function normalizeIdea(raw: Record<string, unknown>, index: number, format: string, payload: Record<string, unknown>, suggestedAt: string) {
  const title = safeString(raw.title, safeString(raw.theme, `Ideia MYINC ${index + 1}`));
  const theme = safeString(raw.theme, title);
  const headline = safeString(raw.headline, title);
  const objective = safeString(raw.objective, safeString(payload.monthlyObjective, "Autoridade, relacionamento e conversão consultiva"));
  const hook = safeString(raw.hook, headline);
  const angle = safeString(raw.angle, safeString(raw.strategic_angle, "Valorização de patrimônio com linguagem consultiva"));
  const painPoint = safeString(raw.pain_point, "Insegurança na compra e dificuldade em perceber valor real do empreendimento.");
  const visualDirection = safeString(raw.visual_direction, safeString(raw.visual_idea, "Arquitetura premium realista, luz natural, composição editorial, ambiente limpo e sofisticado."));
  return {
    title,
    theme,
    headline,
    short_text: safeString(raw.short_text, safeString(raw.caption, `${hook}. ${angle}. Resolver a dor principal: ${painPoint}`)),
    cta: safeString(raw.cta, "Falar com consultor"),
    visual_idea: visualDirection,
    initial_prompt: safeString(
      raw.initial_prompt,
      safeString(raw.image_prompt, `Criativo premium para ${format}, incorporadora MYINC, tema ${theme}, ângulo ${angle}, arquitetura realista de alto padrão, luz natural, composição editorial sofisticada, sem texto na imagem, sem watermark, sem logo falso.`),
    ),
    objective,
    channel: safeString(raw.channel, "Instagram"),
    format: safeString(raw.format, format),
    suggested_at: safeString(raw.suggested_at, suggestedAt),
    predicted_score: Math.min(100, Math.max(0, Math.floor(numberValue(raw.predicted_score, 92)))),
    content_pillar: safeString(raw.content_pillar, "Venda consultiva"),
    why_this_post_matters: safeString(raw.why_this_post_matters, `Apoia percepção de valor da MYINC, reduz objeções e aumenta confiança comercial. Ângulo: ${angle}.`),
    metadata: {
      hook,
      angle,
      pain_point: painPoint,
      offer: safeString(raw.offer, "Posicionamento consultivo com foco em valor e confiança"),
      audience_intent: safeString(raw.audience_intent, "Pesquisa e consideração de compra"),
      visual_direction: visualDirection,
      reference_need: safeString(raw.reference_need, "usar referências aprovadas da marca quando disponíveis"),
    },
  };
}

function fallbackIdea(index: number, format: string, payload: Record<string, unknown>, suggestedAt: string) {
  const pillarsText = String(payload.pillars || "Venda consultiva, autoridade técnica, arquitetura, localização, lifestyle, prova social");
  const pillars = pillarsText.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
  const pillar = pillars[index % Math.max(1, pillars.length)] || "Venda consultiva";
  const brandName = safeString(payload.brandName, "MYINC");
  return normalizeIdea({
    title: `${pillar} MYINC`,
    theme: `${pillar} aplicado ao desejo de morar melhor`,
    headline: `${brandName}: decisão imobiliária com mais clareza e segurança`,
    short_text: `Conteúdo consultivo sobre ${pillar.toLowerCase()}, conectando arquitetura, patrimônio, localização e percepção de valor.`,
    hook: `Entenda como ${pillar.toLowerCase()} influencia sua decisão de compra.`,
    angle: "Compra mais segura e posicionamento premium sem exageros",
    pain_point: "O cliente quer diferenciar valor real de promessa superficial.",
    cta: "Falar com consultor",
    visual_direction: `Imagem premium realista de empreendimento residencial moderno, luz natural, composição clara, atmosfera sofisticada, foco em ${pillar.toLowerCase()}.`,
    initial_prompt: `Criativo premium para ${format}, incorporadora ${brandName}, tema ${pillar}, arquitetura realista de alto padrão, luz natural, composição editorial sofisticada, espaço negativo elegante, sem texto na imagem, sem watermark, sem logo falso, sem poluição visual.`,
    objective: safeString(payload.monthlyObjective, "Autoridade e conversão consultiva"),
    content_pillar: pillar,
    predicted_score: 90,
  }, index, format, payload, suggestedAt);
}

function pickBrandId(payload: Record<string, unknown>) {
  return safeString(payload.brandId) || safeString(payload.brand_id);
}

function compactRows(rows: Array<Record<string, unknown>> | null | undefined, max = 12) {
  return (rows || []).slice(0, max).map((row) => {
    const copy = { ...row };
    delete (copy as Record<string, unknown>).id;
    delete (copy as Record<string, unknown>).created_at;
    delete (copy as Record<string, unknown>).updated_at;
    return copy;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return okOptions(req);
  try {
    await requireUser(req);
    const body = await readJson(req) as Record<string, unknown>;
    const supabase = serviceClient();

    if (body.test) {
      return json(req, { ok: true, function: "ai-generate-plan", mode: "quality-planner-v6-4", message: "Função online e pronta para gerar planejamento detalhado com base na marca." });
    }

    let brandId = pickBrandId(body);
    if (!brandId) {
      const { data: brand, error } = await supabase.from("brands").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (error || !brand?.id) throw new Error("Nenhuma marca encontrada para gerar planejamento.");
      brandId = brand.id;
    }

    const mode = String(body.mode || "generate");
    const { data: brand } = await supabase.from("brands").select("*").eq("id", brandId).maybeSingle();
    const { data: profile } = await supabase.from("brand_profiles").select("*").eq("brand_id", brandId).maybeSingle();
    const { data: rules } = await supabase.from("ai_brain_rules").select("*").eq("brand_id", brandId).eq("active", true).order("priority", { ascending: false }).limit(40);
    const { data: templates } = await supabase.from("ai_prompt_templates").select("*").or(`brand_id.eq.${brandId},brand_id.is.null`).eq("active", true).limit(20);
    const { data: library } = await supabase.from("library_items").select("*").eq("brand_id", brandId).limit(30);

    const planningContext = {
      brand,
      profile,
      rules: compactRows(rules as Array<Record<string, unknown>>),
      templates: compactRows(templates as Array<Record<string, unknown>>),
      library: compactRows(library as Array<Record<string, unknown>>),
      requested_total_posts: requestedTotalFromPayload(body),
      monthlyObjective: safeString(body.monthlyObjective, "Gerar percepção de valor, relacionamento e oportunidades comerciais"),
      focusMode: safeString(body.focusMode, "equilibrado"),
      pillars: body.pillars,
      campaign: body.campaign,
      extra_instructions: body.instructions || body.instruction || "",
    };

    if (mode === "regenerate_idea") {
      const ideaId = safeString(body.ideaId);
      if (!ideaId) throw new Error("ideaId obrigatório para regenerar ideia.");
      const { data: idea, error: ideaErr } = await supabase.from("post_ideas").select("*").eq("id", ideaId).maybeSingle();
      if (ideaErr || !idea) throw new Error("Ideia não encontrada para regenerar.");
      const ai = await openAIJson([
        { role: "system", content: "Você é o Cérebro IA MYINC. Gere uma única ideia nova, mais forte, mais estratégica e mais premium. Retorne JSON válido." },
        { role: "user", content: JSON.stringify({ task: "regenerate_idea", instruction: body.instruction || "melhorar de forma marcante e mais profissional", planningContext, currentIdea: idea, required_schema: { idea: { title: 'string', theme: 'string', headline: 'string', hook: 'string', angle: 'string', pain_point: 'string', objective: 'string', short_text: 'string', cta: 'string', visual_direction: 'string', initial_prompt: 'string', why_this_post_matters: 'string', content_pillar: 'string', predicted_score: 90 } } }) },
      ], { temperature: 0.78, maxTokens: 4500, timeoutMs: 55000 });
      const next = ai.idea || ai;
      const normalized = normalizeIdea(next, Number(idea.priority || 1) - 1, safeString(idea.format, "Feed 1080x1350"), body, safeString(idea.suggested_at, new Date().toISOString()));
      const patch = { ...normalized, ai_response_json: ai, metadata: { ...(normalized.metadata || {}), upgraded_by: 'quality-planner-v6-4' }, updated_at: new Date().toISOString() };
      const { data: updated, error: updErr } = await supabase.from("post_ideas").update(patch).eq("id", ideaId).select("*").single();
      if (updErr) throw new Error(`Falha ao atualizar post_ideas: ${readableEdgeError(updErr)}`);
      return json(req, { ok: true, idea: updated });
    }

    const exactTotal = requestedTotalFromPayload(body);
    const month = Math.max(1, Math.min(12, Math.floor(numberValue(body.month, new Date().getMonth() + 1))));
    const year = Math.max(2025, Math.floor(numberValue(body.year, new Date().getFullYear())));
    const formatEntries = normalizeFormats(body.formats, exactTotal);
    const formatSequence = buildFormatSequence(formatEntries, exactTotal);

    let ai: Record<string, unknown> = {};
    try {
      ai = await openAIJson([
        {
          role: "system",
          content: [
            "Você é o estrategista-chefe de conteúdo da MYINC, especializado em incorporadoras premium, arquitetura, engenharia e vendas consultivas.",
            "Crie ideias com profundidade estratégica, linguagem sofisticada e visão de campanha 2026.",
            "Retorne apenas JSON válido.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "monthly_plan_real_ai_quality_v6_4",
            required_schema: {
              strategy: "string",
              ideas: [{
                title: "string",
                theme: "string",
                headline: "string",
                hook: "string",
                angle: "string",
                pain_point: "string",
                audience_intent: "string",
                objective: "string",
                short_text: "string",
                cta: "string",
                visual_direction: "string",
                reference_need: "string",
                sound_direction: "string",
                initial_prompt: "string",
                why_this_post_matters: "string",
                content_pillar: "string",
                channel: "Instagram|Facebook|Ambos",
                format: "string",
                suggested_at: "ISO",
                predicted_score: 90,
              }],
            },
            exactTotal,
            format_sequence: formatSequence,
            planningContext,
            business_rules: [
              "Cada ideia deve parecer criada por uma agência premium, não genérica.",
              "Equilibrar autoridade, desejo, prova social, diferenciação e conversão consultiva.",
              "Gerar prompts visuais detalhados, premium e prontos para motor de imagem.",
              "Para Reels/Vídeo, criar direção sonora: trilha, ambiente, efeitos, ritmo e silêncio intencional.",
              "Pensar em como a MYINC fala, vende, inspira confiança e se posiciona.",
              "Quando fizer sentido, sugerir uso de depoimentos, bastidores, lifestyle e prova social.",
              "Variar tipos de conteúdo: venda consultiva, objeções, arquitetura, localização, lifestyle, prova social, obra, bastidores, comparativos, perguntas frequentes e oportunidades de contato.",
            ],
          }),
        },
      ], { temperature: 0.72, maxTokens: Math.min(14000, Math.max(3000, exactTotal * 900)), timeoutMs: 58000 });
    } catch (error) {
      ai = { strategy: "Fallback controlado após falha/timeout do provedor de IA.", provider_error: error instanceof Error ? error.message : String(error), ideas: [] };
    }

    const rawIdeas = Array.isArray(ai.ideas) ? ai.ideas as Record<string, unknown>[] : [];
    const firstDay = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    const normalizedIdeas = Array.from({ length: exactTotal }, (_, index) => {
      const format = formatSequence[index] || formatEntries[index % formatEntries.length]?.[0] || "Feed 1080x1350";
      const day = new Date(firstDay);
      day.setUTCDate(1 + Math.floor(index * 28 / Math.max(1, exactTotal)));
      day.setUTCHours(index % 3 === 0 ? 12 : index % 3 === 1 ? 15 : 18, 0, 0, 0);
      const source = rawIdeas[index];
      return source ? normalizeIdea(source, index, format, body, day.toISOString()) : fallbackIdea(index, format, body, day.toISOString());
    });

    const { data: plan, error: planErr } = await supabase.from("monthly_plans").insert({
      brand_id: brandId,
      name: safeString(body.campaign, `Planejamento MYINC ${month}/${year}`),
      title: safeString(body.campaign, `Planejamento MYINC ${month}/${year}`),
      objective: safeString(body.monthlyObjective, "Planejamento editorial mensal com IA"),
      month,
      year,
      total_posts: exactTotal,
      status: "gerado",
      strategy: safeString(ai.strategy, "Estratégia gerada por IA usando Cérebro MYINC."),
      prompt_used: JSON.stringify({ formats: Object.fromEntries(formatEntries), exactTotal, body, version: 'quality-planner-v6-4' }),
      ai_response_json: { ...ai, normalized_count: exactTotal, provider_count: rawIdeas.length },
      metadata: { requested_total_posts: exactTotal, format_distribution: Object.fromEntries(formatEntries), provider_count: rawIdeas.length, planner_version: 'quality-planner-v6-4' },
    }).select("*").single();
    if (planErr) throw new Error(`Falha ao salvar monthly_plans: ${readableEdgeError(planErr)}`);

    const rows = normalizedIdeas.map((idea, index) => ({
      brand_id: brandId,
      monthly_plan_id: plan.id,
      title: idea.title,
      theme: idea.theme,
      headline: idea.headline,
      short_text: idea.short_text,
      cta: idea.cta,
      visual_idea: idea.visual_idea,
      initial_prompt: idea.initial_prompt,
      objective: idea.objective,
      channel: idea.channel,
      format: idea.format,
      suggested_at: idea.suggested_at,
      predicted_score: idea.predicted_score,
      content_pillar: idea.content_pillar,
      why_this_post_matters: idea.why_this_post_matters,
      priority: index + 1,
      focus_mode: safeString(body.focusMode, "equilibrado"),
      status: "rascunho",
      ai_response_json: { source: rawIdeas[index] || null, normalized_by: "ai-generate-plan-v6-4" },
      metadata: { requested_total_posts: exactTotal, provider_count: rawIdeas.length, normalized_index: index + 1, ...(idea.metadata || {}) },
    }));

    const { data: inserted, error: ideasErr } = await supabase.from("post_ideas").insert(rows).select("*");
    if (ideasErr) throw new Error(`Falha ao salvar post_ideas: ${readableEdgeError(ideasErr)}`);

    return json(req, {
      ok: true,
      monthlyPlan: plan,
      plan,
      ideas: inserted || [],
      strategy: ai.strategy,
      requestedTotal: exactTotal,
      providerCount: rawIdeas.length,
      normalizedCount: inserted?.length || rows.length,
      message: `Geradas ${inserted?.length || rows.length} ideia(s) detalhadas conforme o total solicitado.`,
    });
  } catch (error) {
    return err(req, error, 500);
  }
});
