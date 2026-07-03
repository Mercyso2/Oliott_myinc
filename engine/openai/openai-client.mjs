function withTimeout(ms = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(timer) };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Repete chamadas à OpenAI em caso de rate limit (429) ou instabilidade (5xx/timeout).
async function fetchOpenAIWithRetry(url, buildInit, { retries = 3, timeoutMs = 120000 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const timeout = withTimeout(timeoutMs);
    try {
      const response = await fetch(url, { ...buildInit(), signal: timeout.controller.signal });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return data;
      const retryable = response.status === 429 || response.status >= 500;
      lastError = new Error(`OpenAI HTTP ${response.status}: ${JSON.stringify(data).slice(0, 1200)}`);
      if (!retryable || attempt === retries) throw lastError;
    } catch (error) {
      lastError = error;
      const aborted = error?.name === 'AbortError' || /abort/i.test(String(error?.message || ''));
      const retryable = aborted || /HTTP (429|5\d\d)/.test(String(error?.message || '')) || /fetch failed|network|ECONNRESET|ETIMEDOUT/i.test(String(error?.message || ''));
      if (!retryable || attempt === retries) throw error;
    } finally {
      timeout.clear();
    }
    await wait(Math.min(2000 * 2 ** attempt, 20000));
  }
  throw lastError;
}

function normalizeSize(size = '1024x1536') {
  const s = String(size || '').toLowerCase();
  if (s.includes('1536x1024') || s.includes('1200x630') || s.includes('horizontal') || s.includes('facebook')) return '1536x1024';
  if (s.includes('1024x1024') || s.includes('1080x1080') || s.includes('quadrado')) return '1024x1024';
  return '1024x1536';
}

function normalizeQuality(q = 'high') {
  const value = String(q || 'high').toLowerCase();
  return ['low', 'medium', 'high'].includes(value) ? value : 'high';
}

function normalizeFormat(f = 'png') {
  const value = String(f || 'png').toLowerCase();
  return ['png', 'jpeg', 'webp'].includes(value) ? value : 'png';
}

function limitText(value, max = 1200) {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeJsonStringify(value, maxChars = 10000) {
  const seen = new WeakSet();
  const json = JSON.stringify(value, (key, val) => {
    if (typeof val === 'string') return limitText(val, 1800);
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) return undefined;
      seen.add(val);
    }
    return val;
  });
  if (json.length <= maxChars) return json;
  return JSON.stringify({
    truncated: true,
    instruction: 'Payload compactado com JSON valido. Use estes dados como resumo estruturado.',
    summary: limitText(json, maxChars - 220),
  });
}

function stripCodeFence(text) {
  const fenced = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1] ? fenced[1].trim() : String(text || '').trim();
}

function extractJsonObject(text) {
  if (!text) throw new Error('Resposta vazia da IA.');
  const clean = stripCodeFence(text).replace(/^\uFEFF/, '').trim();
  try { return JSON.parse(clean); } catch {}
  const firstObj = clean.indexOf('{');
  const lastObj = clean.lastIndexOf('}');
  if (firstObj >= 0 && lastObj > firstObj) {
    try { return JSON.parse(clean.slice(firstObj, lastObj + 1)); } catch {}
  }
  const firstArr = clean.indexOf('[');
  const lastArr = clean.lastIndexOf(']');
  if (firstArr >= 0 && lastArr > firstArr) {
    try { return { items: JSON.parse(clean.slice(firstArr, lastArr + 1)) }; } catch {}
  }
  throw new Error('Não foi possível extrair JSON válido da resposta da IA.');
}

function normalizeHashtags(value) {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,;#]+/)
      : [];
  return items
    .map((x) => String(x || '').trim().replace(/^#/, ''))
    .filter(Boolean)
    .slice(0, 14)
    .map((x) => `#${x}`);
}

function normalizeCarouselPages(value, fallbackHeadline, fallbackCta) {
  const source = Array.isArray(value) ? value : [];
  const normalized = source.slice(0, 8).map((item, index) => ({
    index: index + 1,
    headline: limitText(item?.headline || item?.title || (index === 0 ? fallbackHeadline : `Ponto ${index + 1}`), 90),
    body: limitText(item?.body || item?.text || item?.description || 'Mensagem curta, clara e salvável para o público MYINC.', 220),
    visual_note: limitText(item?.visual_note || item?.visual || 'Manter estética premium, limpa e consistente com a coleção.', 240),
    cta: limitText(item?.cta || (index === source.length - 1 ? fallbackCta : 'arraste para continuar'), 70),
  }));
  if (normalized.length) return normalized;
  return [
    { index: 1, headline: fallbackHeadline, body: 'Um ponto essencial para entender valor, localização, arquitetura e decisão imobiliária com mais clareza.', visual_note: 'Capa impactante com espaço negativo e imagem arquitetônica premium.', cta: 'arraste para entender' },
    { index: 2, headline: 'O detalhe que muda a percepção', body: 'Projetos melhores comunicam conforto, segurança e valorização antes mesmo da visita.', visual_note: 'Detalhe de acabamento, luz natural e composição editorial.', cta: 'continue' },
    { index: 3, headline: 'Valor não é só metragem', body: 'Localização, execução, experiência de uso e qualidade construtiva criam percepção real de patrimônio.', visual_note: 'Composição com camadas e elemento gráfico discreto.', cta: 'salve este ponto' },
    { index: 4, headline: 'Como olhar com mais critério', body: 'Avalie projeto, entorno, padrão de entrega, conforto e coerência da proposta antes de decidir.', visual_note: 'Visual educativo com base arquitetônica e respiro.', cta: 'fale com a MYINC' },
  ];
}

function normalizeContentResult(result, payload = {}, prompt = '') {
  const post = payload.post || {};
  const profile = payload.brand_profile || payload.profile || {};
  const title = limitText(result.title || post.title || post.theme || 'Conteúdo MYINC', 120);
  const headline = limitText(result.headline || post.headline || title, 140);
  const cta = limitText(result.cta || post.cta || 'Falar com a MYINC', 90);
  const caption = limitText(
    result.caption || result.copy || post.caption || post.short_text ||
      `${headline}\n\nA MYINC desenvolve empreendimentos pensados para unir arquitetura, segurança, conforto e valorização patrimonial. Cada detalhe comunica confiança para quem busca morar melhor ou investir com mais clareza.\n\n${cta}`,
    2200,
  );
  const hashtags = normalizeHashtags(result.hashtags || post.hashtags || ['MYINC', 'Arquitetura', 'Imóveis', 'AltoPadrão', 'MorarBem']);
  const contentPillar = limitText(result.content_pillar || result.pillar || payload.content_pillar || 'editorial premium', 90);
  const visualRecipe = result.visual_recipe && typeof result.visual_recipe === 'object'
    ? result.visual_recipe
    : {
        family: result.visual_family || 'editorial premium',
        layout: result.layout || 'base visual premium + render final com logo real, headline, CTA e camadas de marca',
        depth: 'primeiro plano com textura/material, plano médio arquitetônico, fundo com luz e atmosfera',
        brand_application: 'logo real aplicado somente pelo renderizador final, nunca inventado pela IA',
        color_direction: 'usar paleta oficial do brand profile; fallback neutro premium com acento laranja',
      };
  const carouselPages = normalizeCarouselPages(result.carousel_pages || result.slides, headline, cta);
  const creativeBrief = limitText(
    result.creative_brief || result.visual_idea || post.creative_brief ||
      `Peça ${contentPillar} para incorporadora premium: arquitetura realista, luz natural, composição limpa, espaço negativo, materiais nobres, estética sofisticada, sem texto embutido e sem logo falso.`,
    2200,
  );
  const imagePrompt = limitText(
    result.image_prompt || result.visual_prompt || post.image_prompt ||
      `${creativeBrief}\nBase visual premium MYINC, arquitetura contemporânea, composição editorial, luz natural, alto padrão, sem texto na imagem, sem watermark, sem logo inventado.`,
    3200,
  );
  const videoPrompt = limitText(
    result.video_prompt || post.video_prompt ||
      `Reels vertical premium para MYINC: hook visual forte, cenas de arquitetura, lifestyle, detalhes de acabamento, transições suaves e sensação de confiança comercial. Direção sonora elegante e cinematográfica discreta.`,
    3200,
  );

  return {
    title,
    headline,
    caption,
    short_text: limitText(result.short_text || post.short_text || caption, 520),
    hashtags,
    cta,
    image_prompt: imagePrompt,
    video_prompt: videoPrompt,
    creative_brief: creativeBrief,
    master_prompt: limitText(result.master_prompt || prompt, 4200),
    content_pillar: contentPillar,
    visual_recipe: visualRecipe,
    carousel_pages: carouselPages,
    video_storyboard: Array.isArray(result.video_storyboard) ? result.video_storyboard.slice(0, 8) : [
      { second: '0-2', scene: 'gancho visual com arquitetura/lifestyle premium', motion: 'push-in lento' },
      { second: '2-5', scene: 'detalhe de acabamento ou localização', motion: 'parallax suave' },
      { second: '5-8', scene: 'fechamento com sensação de confiança e desejo', motion: 'transição elegante' },
    ],
    critic_checklist: Array.isArray(result.critic_checklist) ? result.critic_checklist.slice(0, 12) : [
      'parece peça de marca premium?',
      'tem gancho real para Instagram?',
      'não parece genérico?',
      'o render final usará logo real?',
      'há respiro para leitura?',
    ],
    production_tier: result.production_tier || payload.production_tier || 'balanced-premium',
    // Score honesto: só o valor que a IA declarou, sem piso inventado; ausente vira null.
    quality_score: Number(result.quality_score) ? Math.min(100, Math.max(0, Number(result.quality_score))) : null,
    ai_quality_notes: result.ai_quality_notes || 'Conteúdo normalizado pelo Creative Engine V7 para estratégia, direção visual, carrossel e render final.',
    brand_alignment: result.brand_alignment || profile.mantra || 'Alinhado ao posicionamento premium MYINC.',
    creative_engine_version: 'v7-final',
  };
}

function buildContentPrompt(prompt, payload = {}) {
  const post = payload.post || {};
  const profile = payload.brand_profile || payload.profile || {};
  const referenceAssets = asArray(payload.reference_assets).length ? asArray(payload.reference_assets) : asArray(payload.referenceAssets);
  const refs = referenceAssets.slice(0, 10).map((ref) => ({
    role: ref.role,
    name: ref.name,
    notes: limitText(ref.notes, 220),
    tags: asArray(ref.tags).slice(0, 8),
  }));
  const rules = asArray(payload.rules).slice(0, 18).map((rule) => ({
    name: rule.name,
    category: rule.category,
    content: limitText(rule.content, 360),
    priority: rule.priority,
  }));
  const templates = asArray(payload.templates).slice(0, 8).map((tpl) => ({
    name: tpl.name,
    type: tpl.type,
    content: limitText(tpl.content, 380),
  }));

  return {
    task: 'Criar estratégia, copy, direção criativa, prompt visual, carrossel e storyboard para post premium da MYINC.',
    hard_rule: 'Retorne SOMENTE um objeto JSON válido, sem markdown, sem array na raiz e sem comentários. Não escreva texto fora do JSON.',
    creative_principle: 'A IA gera estratégia e base visual; o app finaliza com logo real, paleta, headline, CTA e camadas. Nunca pedir para a IA inventar a logo.',
    reference_policy: {
      logo: 'Logo oficial deve ser aplicado somente pelo renderizador final. Nao pedir para a IA redesenhar, recriar ou escrever o logo.',
      person_reference: 'Fotos pessoais autorizadas so devem ser usadas quando o contexto pedir autoridade, bastidor, atendimento, prova social ou humanizacao. Preservar identidade geral, sem caricatura, sem exageros e sem uso sensivel.',
      architecture_reference: 'Referencias de empreendimento orientam materiais, fachada, atmosfera, luz, acabamento e padrao visual.',
      template_style: 'Templates orientam hierarquia, respiro, ritmo e sofisticacao, sem copiar textos literais.',
    },
    schema: {
      title: 'string até 120 caracteres',
      headline: 'headline forte e curta para sobrepor no design final',
      caption: 'legenda pronta para Instagram/Facebook com valor real, não institucional genérica',
      short_text: 'texto curto de apoio para card',
      hashtags: ['array de hashtags strings'],
      cta: 'CTA curto',
      content_pillar: 'curiosidade | autoridade | novidade | educativo salvável | prova social | lifestyle | conversão',
      creative_brief: 'brief visual e estratégico para designer',
      image_prompt: 'prompt da BASE VISUAL, sem texto e sem logo, com profundidade e espaço negativo',
      video_prompt: 'prompt de reels/vídeo com hook, cenas e direção sonora',
      carousel_pages: [{ index: 1, headline: 'string', body: 'string curta', visual_note: 'direção visual', cta: 'string curta' }],
      video_storyboard: [{ second: '0-2', scene: 'descrição', motion: 'movimento', sound: 'som' }],
      visual_recipe: {
        family: 'editorial premium | educativo salvável | lifestyle humanizado | lançamento',
        layout: 'como o renderizador deve compor a peça',
        depth: 'camadas visuais e profundidade',
        brand_application: 'como aplicar logo real e paleta no render final',
        color_direction: 'orientação de paleta',
      },
      critic_checklist: ['critérios objetivos de qualidade'],
      quality_score: 93,
      brand_alignment: 'por que está alinhado à marca',
    },
    brand: {
      name: profile.public_name || post.brand_name || 'MYINC',
      niche: profile.niche || 'incorporadora premium',
      segment: profile.segment,
      audience: profile.primary_audience,
      persona: profile.persona,
      tone: profile.tone,
      communication_style: profile.communication_style,
      benefits: profile.benefits,
      differentiators: profile.differentiators,
      visual_style: profile.preferred_visual_style,
      composition_rules: profile.composition_rules,
      mantra: profile.mantra,
    },
    content_strategy: {
      required_outcome: 'conteúdo interessante de Instagram, com potencial de salvar, compartilhar, gerar autoridade e atrair seguidores qualificados',
      avoid: ['post institucional vazio', 'texto genérico', 'promessa exagerada', 'layout poluído', 'cara de IA', 'logo inventado', 'texto dentro da imagem base'],
      preferred_angles: ['curiosidade útil', 'diferencial explicado', 'novidade com contexto', 'autoridade sem arrogância', 'educativo salvável', 'lifestyle com sofisticação'],
    },
    post: {
      title: post.title,
      theme: post.theme,
      headline: post.headline,
      objective: post.objective,
      short_text: post.short_text,
      cta: post.cta,
      format: post.format,
      creative_brief: post.creative_brief,
      image_prompt: post.image_prompt,
      video_prompt: post.video_prompt,
      metadata: post.metadata,
    },
    rules,
    templates,
    reference_assets_summary: refs,
    base_prompt: limitText(prompt, 4200),
  };
}

function safeSlug(value = 'ref') {
  return String(value || 'ref').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'ref';
}

function isHumanizedContext(payload = {}) {
  const post = payload.post || {};
  const text = `${post.title || ''} ${post.theme || ''} ${post.objective || ''} ${post.creative_brief || ''} ${payload.content_pillar || ''}`.toLowerCase();
  return /autoridade|bastidor|depoimento|prova social|atendimento|equipe|time|consultor|humaniz|lifestyle|especialista|apresenta/.test(text);
}

function referenceGroup(item) {
  const role = String(item.role || '').toLowerCase();
  const tags = item.tags.map((tag) => tag.toLowerCase()).join(' ');
  if (/person|pessoal|retrato|rosto|foto/.test(role) || /foto-pessoal|retrato|rosto|person/.test(tags)) return 'person';
  if (/architecture|arquitet|empreendimento|obra|fachada/.test(role)) return 'architecture';
  if (role.includes('template')) return 'template';
  if (role.includes('style')) return 'style';
  return 'other';
}

function normalizeReferenceAssets(payload = {}, max = 4) {
  const raw = Array.isArray(payload.reference_assets)
    ? payload.reference_assets
    : Array.isArray(payload.referenceAssets)
      ? payload.referenceAssets
      : [];
  const scored = raw
    .map((item) => (item && typeof item === 'object' ? item : null))
    .filter(Boolean)
    .map((item) => ({
      id: item.id || null,
      name: item.name || item.title || 'reference',
      role: String(item.role || item.kind || 'style_reference'),
      url: String(item.url || item.public_url || item.publicUrl || '').trim(),
      notes: String(item.notes || ''),
      tags: Array.isArray(item.tags) ? item.tags.map((x) => String(x)) : [],
      source: String(item.source || 'library'),
    }))
    .filter((item) => /^https?:\/\//i.test(item.url))
    .filter((item) => !String(item.role || '').toLowerCase().includes('logo'))
    .map((item) => ({
      ...item,
      group: referenceGroup(item),
      score:
        referenceGroup(item) === 'person' ? 100 :
        referenceGroup(item) === 'architecture' ? 90 :
        referenceGroup(item) === 'template' ? 80 :
        referenceGroup(item) === 'style' ? 70 :
        50,
    }))
    .sort((a, b) => b.score - a.score);

  // Mínimo viável: a melhor referência de cada categoria já orienta a geração;
  // enviar duplicatas só aumenta custo/latência sem ganho visual.
  // Foto pessoal entra apenas quando o contexto do post é humanizado.
  const humanized = isHumanizedContext(payload);
  const effectiveMax = humanized ? max : Math.min(max, 3);
  const picks = [];
  const seenGroups = new Set();
  for (const item of scored) {
    if (picks.length >= effectiveMax) break;
    if (item.group === 'person' && !humanized) continue;
    if (seenGroups.has(item.group)) continue;
    seenGroups.add(item.group);
    picks.push(item);
  }
  // Sobrando espaço, só uma 2ª foto de arquitetura agrega (ângulo/acabamento extra do empreendimento).
  const extraArchitecture = scored.find((item) => item.group === 'architecture' && !picks.includes(item));
  if (extraArchitecture && picks.length < effectiveMax) picks.push(extraArchitecture);
  return picks.map(({ group: _group, ...item }) => item);
}

function buildReferenceInstruction(references = []) {
  if (!references.length) return '';
  const lines = references.map((ref, index) => {
    const note = ref.notes ? ` | notas: ${limitText(ref.notes, 180)}` : '';
    const tags = ref.tags?.length ? ` | tags: ${ref.tags.slice(0, 8).join(', ')}` : '';
    return `Ref ${index + 1} | role=${ref.role} | name=${ref.name}${note}${tags}`;
  });
  return [
    'Use the attached reference images carefully. Instructions are in English for image quality; all final marketing text must remain Portuguese and will be rendered later by the app.',
    'REFERENCE RULES:',
    '- role=person_reference: preserve identity, general facial traits, hair and appearance only in suitable contexts: authority, backstage, service, testimonial, lifestyle or humanization.',
    '- Never use a person reference for unrelated real-estate scenery. If the post is not humanized, use the person only as brand context and keep the visual focused on architecture.',
    '- role=architecture_reference: preserve the project/material/design language, facade proportions, light mood and premium finish without inventing impossible geometry.',
    '- role=template_style: follow visual language, rhythm, framing, negative space and sophistication; do not copy literal text.',
    '- role=style_reference: follow materials, facade, architecture, colors, mood and finishing.',
    '- Never generate fake logos, watermarks or embedded captions. The real logo is applied by the MYINC renderer after generation.',
    '- Keep invisible safe margins: bottom 18% clean for logo/CTA and central-lower area calm for Portuguese overlay text.',
    ...lines,
  ].join('\n');
}

async function fetchReferenceBlob(reference, index) {
  const response = await fetch(reference.url);
  if (!response.ok) throw new Error(`Falha ao baixar referência visual ${reference.url}: HTTP ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'image/png';
  const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : contentType.includes('png') ? 'png' : 'bin';
  const fileName = `${String(index + 1).padStart(2, '0')}-${safeSlug(reference.role)}-${safeSlug(reference.name)}.${ext}`;
  return { blob: new Blob([arrayBuffer], { type: contentType }), fileName, contentType };
}

export class OpenAIClient {
  constructor(config) { this.config = config; }

  async generateContentJson(prompt, payload = {}) {
    const contentPayload = buildContentPrompt(prompt, payload);
    const body = JSON.stringify({
      model: this.config.textModel,
      messages: [
        {
          role: 'system',
          content: [
            'You are MYINC Creative Brain V9.1: senior content strategist, premium real-estate creative director and social media lead.',
            'Think in English for precision, but every user-facing copy field must be written in Brazilian Portuguese.',
            'Create useful, specific content that drives curiosity, authority, saves, qualified followers and brand value; never deliver empty institutional copy.',
            'Every caption must open with a scroll-stopping first line (hook), deliver one concrete idea the reader can keep, and close with a natural CTA. Avoid clichés like "sonho da casa própria".',
            'Return only valid JSON, no markdown, no root array, no comments. Hashtags must be a valid JSON array.',
            'Image prompts must be written mostly in English for better generation quality: describe subject, environment, composition, camera angle, lens feel, natural lighting, materials and mood in concrete visual language, while explicitly saying that final overlay texts are Portuguese and rendered later by the app.',
            'Protect brand assets: never ask the image model to invent or redraw the MYINC logo. Use person references only when contextually appropriate and respectful.',
          ].join(' '),
        },
        { role: 'user', content: safeJsonStringify(contentPayload, 30000) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.62,
      max_tokens: 3200,
    });
    let text = '';
    try {
      const data = await fetchOpenAIWithRetry(
        'https://api.openai.com/v1/chat/completions',
        () => ({
          method: 'POST',
          headers: { Authorization: `Bearer ${this.config.openaiApiKey}`, 'Content-Type': 'application/json' },
          body,
        }),
        { retries: 3, timeoutMs: 90000 },
      );
      text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error('OpenAI texto não retornou conteúdo.');
    } catch (error) {
      throw new Error(`Falha ao gerar conteúdo final com IA: ${error.message}`);
    }
    try {
      return normalizeContentResult(extractJsonObject(text), payload, prompt);
    } catch (parseError) {
      // Sem fallback fabricado: conteúdo artificial é proibido. O job falha
      // honestamente e pode ser retentado pela fila.
      throw new Error(`JSON de conteúdo inválido retornado pela IA (nada foi salvo): ${parseError.message}`);
    }
  }

  async generateImage(prompt, payload = {}) {
    const model = payload.model || this.config.imageModel || 'gpt-image-1';
    const outputFormat = normalizeFormat(payload.format || this.config.imageFormat);
    const size = normalizeSize(payload.size);
    const quality = normalizeQuality(payload.quality || this.config.imageQuality);
    const references = normalizeReferenceAssets(payload, this.config.maxReferenceImages || 4);
    const referenceInstruction = buildReferenceInstruction(references);
    const finalPrompt = referenceInstruction ? `${referenceInstruction}\n\nPROMPT PRINCIPAL:\n${prompt}` : prompt;

    const toArtifact = (data, label) => {
      const item = data?.data?.[0] || {};
      const b64 = item.b64_json || item.base64;
      if (!b64 && !item.url) throw new Error(`${label} retornou sem b64/url: ${JSON.stringify(data).slice(0, 1200)}`);
      return {
        base64: b64,
        url: item.url,
        mime: `image/${outputFormat === 'jpeg' ? 'jpeg' : outputFormat}`,
        ext: outputFormat === 'jpeg' ? 'jpg' : outputFormat,
        raw: data,
        usedReferences: references,
      };
    };

    if (references.length && String(model).startsWith('gpt-image')) {
      const blobs = await Promise.all(references.map((reference, index) => fetchReferenceBlob(reference, index)));
      const data = await fetchOpenAIWithRetry(
        'https://api.openai.com/v1/images/edits',
        () => {
          // FormData novo a cada tentativa: streams de multipart não podem ser reenviados.
          const form = new FormData();
          form.append('model', model);
          form.append('prompt', finalPrompt);
          form.append('size', size);
          form.append('quality', quality);
          form.append('output_format', outputFormat);
          blobs.forEach((item) => form.append('image[]', item.blob, item.fileName));
          return {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.config.openaiApiKey}` },
            body: form,
          };
        },
        { retries: 2, timeoutMs: 180000 },
      );
      return toArtifact(data, 'OpenAI imagem+referência');
    }

    const body = {
      model,
      prompt: finalPrompt,
      n: 1,
      size,
      quality,
    };
    if (String(model).startsWith('gpt-image')) {
      body.output_format = outputFormat;
    } else {
      body.response_format = 'b64_json';
    }
    const data = await fetchOpenAIWithRetry(
      'https://api.openai.com/v1/images/generations',
      () => ({
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.openaiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { retries: 2, timeoutMs: 180000 },
    );
    return toArtifact(data, 'OpenAI imagem');
  }
}
