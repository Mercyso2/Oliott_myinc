import { generateVideo } from './video-processor.mjs';
import { renderFinalDesignV2 } from '../renderers/design-renderer-v2.mjs';

function inferMediaSize(job, payload) {
  return payload.size || payload.output_size || job.input_json?.size || '1024x1536';
}

function asText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getPost(payload = {}) {
  return payload.post && typeof payload.post === 'object' ? payload.post : {};
}

function inferPillar(payload = {}) {
  const post = getPost(payload);
  const text = `${post.title || ''} ${post.theme || ''} ${post.objective || ''} ${post.creative_brief || ''}`.toLowerCase();
  if (/curiosidade|voce sabia|você sabia|mito|verdade|dica/.test(text)) return 'curiosidade que gera salvamento';
  if (/novidade|lançamento|lancamento|obra|evolução|evolucao/.test(text)) return 'novidade com percepção de valor';
  if (/autoridade|especialista|processo|método|metodo|bastidor/.test(text)) return 'autoridade e confiança';
  if (/depoimento|cliente|prova social/.test(text)) return 'prova social premium';
  if (/carrossel|educativo|salvável|salvavel/.test(text)) return 'educativo salvável';
  return 'editorial premium';
}

function referenceSummary(payload = {}) {
  const refs = Array.isArray(payload.reference_assets) ? payload.reference_assets : Array.isArray(payload.referenceAssets) ? payload.referenceAssets : [];
  if (!refs.length) return 'Sem referência externa obrigatória; usar identidade do brand kit e briefing.';
  return refs.slice(0, 8).map((ref, index) => {
    const role = ref.role || ref.kind || 'style_reference';
    const name = ref.name || ref.title || `referência ${index + 1}`;
    const notes = ref.notes ? ` — ${String(ref.notes).slice(0, 180)}` : '';
    return `${index + 1}. ${role}: ${name}${notes}`;
  }).join('\n');
}

function buildImageBasePrompt(basePrompt, payload, type) {
  const post = getPost(payload);
  const pillar = inferPillar(payload);
  const mode = type === 'carousel_page' ? 'carousel slide background' : 'final post background';
  const pageData = payload.carousel_page && typeof payload.carousel_page === 'object' ? payload.carousel_page : null;
  const visualRecipe = payload.visual_recipe && typeof payload.visual_recipe === 'object' ? JSON.stringify(payload.visual_recipe) : String(payload.visual_recipe || '');
  const page = type === 'carousel_page'
    ? [
        `Carousel page: ${payload.page || 1}/${payload.total_pages || payload.page_count || 5}. Make this slide visually distinct from the other pages.`,
        pageData?.headline ? `Slide headline in Portuguese for final overlay: ${pageData.headline}` : '',
        pageData?.body ? `Slide body/context in Portuguese for final overlay: ${pageData.body}` : '',
        pageData?.visual_note ? `Slide visual direction: ${pageData.visual_note}` : '',
      ].filter(Boolean).join('\n')
    : '';

  const sections = [
    'MYINC CREATIVE ENGINE V9.1 — PREMIUM BACKGROUND IMAGE',
    'Write and reason in English for image quality, but all final overlay text will be Portuguese and applied later by the MYINC renderer.',
    `Mode: ${mode}.`,
    `Strategic pillar: ${pillar}.`,
    `Theme in Portuguese: ${asText(post.theme || post.title, 'conteúdo premium MYINC')}.`,
    `Objective in Portuguese: ${asText(post.objective, 'gerar autoridade, desejo e confiança')}.`,
    `Brief: ${asText(post.creative_brief || post.image_prompt, basePrompt)}`,
    visualRecipe ? `Brand visual recipe from app: ${visualRecipe}` : '',
    page,
    'Generate ONLY the premium photographic/design background. Do not place text, captions, fake logos, watermarks, signs, UI, labels or typography in the image.',
    'Composition rules: light premium mood, Brazilian contemporary real estate, natural daylight, noble materials, clean editorial art direction, realistic depth, agency-level finish, no generic stock-photo look.',
    'Quality bar: the base image must look like a premium real-estate campaign, with believable architecture, intentional art direction, refined textures, natural light and enough negative space for a clean editorial layout.',
    'Invisible safe margins: keep the bottom 18% clean for the real MYINC logo and CTA; keep the central-lower area calm for Portuguese overlay text; do not put faces, hands, important architecture details or high-contrast objects under those zones.',
    'Layering: foreground texture/material/lifestyle detail, midground architecture/environment, background with soft light and depth. Leave negative space for final design.',
    'Brand use: respect MYINC light palette, off-white/white/light gray/warm neutral backgrounds with orange accent potential. Never invent or redraw the logo.',
    'People/photo rule: use a person reference only when the post context is authority, backstage, service, testimonial, lifestyle or humanization; preserve identity respectfully and avoid distorted faces.',
    `Available references:\n${referenceSummary(payload)}`,
    'Negative prompt: unreadable text, letters, fake logo, watermark, dark card, gloomy scene, black background, crooked building, distorted hands, distorted face, clutter, cheap flyer, generic AI style, low resolution, messy composition, cropped subject, important element outside safe area.',
    `APP ORIGINAL PROMPT:\n${basePrompt}`,
  ];

  return sections.filter(Boolean).join('\n\n');
}

function buildVideoPrompt(basePrompt, payload) {
  const post = getPost(payload);
  const pillar = inferPillar(payload);
  const soundDirection = payload.sound_direction || payload.soundDirection || 'Som elegante, cinematográfico e discreto: ambiente premium, whooshes suaves, transições leves, sem trilha agressiva, sem ruído popular.';
  const visualRecipe = payload.visual_recipe && typeof payload.visual_recipe === 'object' ? JSON.stringify(payload.visual_recipe) : String(payload.visual_recipe || '');
  const storyboard = Array.isArray(post.metadata?.video_storyboard)
    ? post.metadata.video_storyboard
    : Array.isArray(payload.video_storyboard)
      ? payload.video_storyboard
      : [];
  return [
    'MYINC CREATIVE ENGINE V9.1 — ECONOMICAL PREMIUM VERTICAL VIDEO',
    'Reason in English for video/image quality. Any visible text, if later added by renderer, must be Portuguese. Do not generate fake logo or embedded captions.',
    `Strategic pillar: ${pillar}.`,
    `Theme in Portuguese: ${asText(post.theme || post.title, 'conteúdo premium MYINC')}.`,
    `Objective in Portuguese: ${asText(post.objective, 'atrair, reter e gerar confiança')}.`,
    visualRecipe ? `Brand visual recipe from app: ${visualRecipe}` : '',
    storyboard.length ? `Storyboard beats from app: ${JSON.stringify(storyboard.slice(0, 6))}` : '',
    'Preferred production mode is economical local MP4 from a high-quality vertical poster unless OPENAI_VIDEO_ENABLED=true.',
    'Structure if using OpenAI Video: strong visual hook in first 2 seconds, 3 to 5 micro-scenes, smooth transitions, architecture, lifestyle, noble materials, premium trust and patrimonial value.',
    'Camera: slow push-in, subtle parallax, close-up on materials, elegant reveal, never noisy, never cheap, never gloomy.',
    `Sound direction: ${soundDirection}`,
    'Invisible safe margins: keep bottom logo/CTA zone clean; avoid critical subjects near edges; no dark title cards.',
    'Use authorized person reference only for authority, backstage, testimonial, service or lifestyle contexts; preserve identity and avoid distorted faces.',
    `BASE PROMPT:\n${basePrompt}`,
  ].join('\n\n');
}

export async function processJob(job, openai) {
  const payload = job.input_json || job.payload || {};
  const type = String(job.job_type || job.type || payload.task || 'image').toLowerCase();
  const basePrompt = payload.final_prompt || payload.prompt || `Criativo MYINC premium para ${payload?.post?.title || 'post'}`;
  const size = inferMediaSize(job, payload);

  if (type === 'content') {
    const result = await openai.generateContentJson(basePrompt, payload);
    return { type, result };
  }

  if (type === 'video') {
    const videoPrompt = buildVideoPrompt(basePrompt, payload);
    const posterPrompt = `${videoPrompt}\n\nGenerate a premium static vertical 9:16 poster/background for the Reel. No embedded text, no fake logo. Leave bottom 18% and central-lower area clean because the MYINC renderer will apply Portuguese headline, CTA and the real logo.`;
    const posterBase = await openai.generateImage(posterPrompt, { ...payload, size: '1024x1536' }).catch((error) => {
      console.warn('[MYINC Engine] Falha ao gerar poster base do vídeo:', error.message);
      return null;
    });
    let posterArtifact = posterBase;
    let posterRender = null;
    if (posterBase) {
      const rendered = await renderFinalDesignV2({ baseArtifact: posterBase, payload: { ...payload, final_size: '1080x1920' }, type: 'video_cover' });
      posterArtifact = rendered.artifact;
      posterRender = rendered.details;
    }
    const artifact = await generateVideo(openai.config, videoPrompt, '720x1280', payload, posterArtifact);
    return {
      type,
      artifact,
      posterArtifact,
      result: {
        media_type: 'video',
        media_kind: artifact.provider === 'openai-videos' ? 'openai_video' : 'local_fallback_video',
        prompt_used: videoPrompt,
        video_prompt: videoPrompt,
        sound_direction: payload.sound_direction || payload.soundDirection || null,
        quality_score: artifact.provider === 'openai-videos' ? 93 : artifact.provider === 'local-ffmpeg-fallback' ? 84 : 45,
        provider: artifact.provider,
        openai_video_id: artifact.videoId || null,
        seconds: artifact.seconds,
        size: artifact.size,
        input_reference: artifact.inputReference,
        fallback_reason: artifact.fallbackReason || null,
        final_render: posterRender,
        creative_engine_version: 'v7-final',
      },
    };
  }

  const imageBasePrompt = buildImageBasePrompt(basePrompt, payload, type);
  const baseArtifact = await openai.generateImage(imageBasePrompt, payload);
  const rendered = await renderFinalDesignV2({ baseArtifact, payload, type });
  const artifact = rendered.artifact || baseArtifact;
  const renderedOk = Boolean(rendered.details?.rendered);

  return {
    type,
    artifact,
    result: {
      media_type: type,
      media_kind: renderedOk ? 'final_designed_image' : 'base_image_fallback',
      prompt_used: imageBasePrompt,
      base_prompt_used: basePrompt,
      quality_score: renderedOk ? 94 : 86,
      used_references: baseArtifact.usedReferences || [],
      final_render: rendered.details,
      creative_engine_version: 'v7-final',
    },
  };
}
