import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { env, err, json, okOptions, serviceClient, systemLog } from "../_shared/v2-utils.ts";

type PublishItem = Record<string, any>;
const GRAPH_VERSION = env('META_GRAPH_VERSION', false) || 'v21.0';
const apiBase = () => `https://graph.facebook.com/${GRAPH_VERSION}`;
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;
const MAX_ATTEMPTS = 3;

// Códigos transitórios da Meta: 1/2 (temporário), 4/17/32/613 (rate limit), 80007 (throttle IG)
const TRANSIENT_META_CODES = new Set([1, 2, 4, 17, 32, 613, 80007]);
// 9007 / subcode 2207027: mídia ainda não pronta para media_publish
const MEDIA_NOT_READY_CODES = new Set([9007, 2207027]);

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeToken(text: string) {
  return text.replace(/access_token=[^&\s"]+/gi, 'access_token=***');
}

class MetaApiError extends Error {
  status: number;
  code: number;
  subcode: number;
  constructor(label: string, status: number, data: Record<string, any>) {
    const detail = data?.error?.message || JSON.stringify(data);
    super(sanitizeToken(`Meta erro ${label} (HTTP ${status}): ${detail}`));
    this.status = status;
    this.code = Number(data?.error?.code || 0);
    this.subcode = Number(data?.error?.error_subcode || 0);
  }
  get isTransient() {
    return this.status === 429 || this.status >= 500 || TRANSIENT_META_CODES.has(this.code);
  }
  get isMediaNotReady() {
    return MEDIA_NOT_READY_CODES.has(this.code) || MEDIA_NOT_READY_CODES.has(this.subcode);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function metaRequest(url: string, init: RequestInit, options: { retryMediaNotReady?: boolean } = {}) {
  const label = sanitizeToken(url.replace(apiBase(), ''));
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error) throw new MetaApiError(label, response.status, data);
      return data;
    } catch (error) {
      lastError = error;
      const transient = error instanceof MetaApiError
        ? error.isTransient || (options.retryMediaNotReady && error.isMediaNotReady)
        : true; // timeout/rede: vale tentar de novo
      if (!transient || attempt === MAX_RETRIES) throw error;
      await wait(Math.min(2000 * 2 ** attempt, 15000));
    }
  }
  throw lastError;
}

async function metaPost(path: string, payload: Record<string, unknown>, options: { retryMediaNotReady?: boolean } = {}) {
  const token = env('META_PAGE_ACCESS_TOKEN');
  const data = await metaRequest(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, access_token: token }),
  }, options);
  if (!data.id) throw new Error(`Meta respondeu sem id em ${path}: ${JSON.stringify(data)}`);
  return data;
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
}

async function metaGet(path: string, params: Record<string, string> = {}) {
  const token = env('META_PAGE_ACCESS_TOKEN');
  const url = new URL(`${apiBase()}${path}`);
  url.searchParams.set('access_token', token);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return metaRequest(url.toString(), { method: 'GET' });
}

async function waitInstagramContainer(containerId: string, maxMs = 180000) {
  const startedAt = Date.now();
  let last: Record<string, unknown> = {};
  while (Date.now() - startedAt < maxMs) {
    last = await metaGet(`/${containerId}`, { fields: 'status_code,status' });
    const code = String(last.status_code || last.status || '').toUpperCase();
    if (['FINISHED', 'PUBLISHED'].includes(code)) return last;
    if (['ERROR', 'EXPIRED', 'FAILED'].includes(code)) throw new Error(`Container Instagram falhou: ${JSON.stringify(last)}`);
    await wait(5000);
  }
  throw new Error(`Timeout aguardando container Instagram ficar pronto: ${JSON.stringify(last)}`);
}

async function publishContainer(igId: string, containerId: string) {
  return metaPost(`/${igId}/media_publish`, { creation_id: containerId }, { retryMediaNotReady: true });
}

async function publishInstagramSingleImage(mediaUrl: string, caption: string) {
  const igId = env('META_INSTAGRAM_BUSINESS_ID');
  const container = await metaPost(`/${igId}/media`, { image_url: mediaUrl, caption });
  await waitInstagramContainer(container.id, 90000);
  const publish = await publishContainer(igId, container.id);
  return { mode: 'IMAGE', container, publish };
}

async function publishInstagramCarousel(mediaUrls: string[], caption: string) {
  const igId = env('META_INSTAGRAM_BUSINESS_ID');
  if (mediaUrls.length < 2) throw new Error('CAROUSEL exige pelo menos 2 mídias.');
  const children = [];
  for (const url of mediaUrls.slice(0, 10)) {
    const child = await metaPost(`/${igId}/media`, { image_url: url, is_carousel_item: true });
    await waitInstagramContainer(child.id, 90000);
    children.push(child.id);
  }
  const container = await metaPost(`/${igId}/media`, { media_type: 'CAROUSEL', children, caption });
  await waitInstagramContainer(container.id, 90000);
  const publish = await publishContainer(igId, container.id);
  return { mode: 'CAROUSEL', children, container, publish };
}

async function publishInstagramReels(videoUrl: string, caption: string) {
  const igId = env('META_INSTAGRAM_BUSINESS_ID');
  if (!isVideoUrl(videoUrl)) throw new Error('Reels exige video_url final em MP4/MOV/WebM.');
  const container = await metaPost(`/${igId}/media`, { media_type: 'REELS', video_url: videoUrl, caption });
  await waitInstagramContainer(container.id, 300000);
  const publish = await publishContainer(igId, container.id);
  return { mode: 'REELS', container, publish };
}

async function publishInstagramStory(mediaUrl: string, caption: string) {
  const igId = env('META_INSTAGRAM_BUSINESS_ID');
  const payload = isVideoUrl(mediaUrl)
    ? { media_type: 'STORIES', video_url: mediaUrl, caption }
    : { media_type: 'STORIES', image_url: mediaUrl, caption };
  const container = await metaPost(`/${igId}/media`, payload);
  await waitInstagramContainer(container.id, isVideoUrl(mediaUrl) ? 300000 : 90000);
  const publish = await publishContainer(igId, container.id);
  return { mode: 'STORY', container, publish };
}

function getMedia(item: PublishItem) {
  const post = item.posts || {};
  const payload = item.payload || {};
  const carousel = Array.isArray(payload.carousel_media_urls) ? payload.carousel_media_urls : Array.isArray(post.carousel_media_urls) ? post.carousel_media_urls : [];
  const video = payload.video_url || post.video_url || '';
  const single = payload.media_url || post.media_url || carousel[0] || video || '';
  return { post, carousel: carousel.filter(Boolean), video: String(video || ''), single: String(single || '') };
}

async function publishItem(item: PublishItem) {
  const { post, carousel, video, single } = getMedia(item);
  const caption = String(post.caption || item.payload?.caption || '').slice(0, 2200);
  const format = String(post.format || item.payload?.format || '').toLowerCase();
  if (!post.approved_at && post.status !== 'approved' && post.status !== 'aguardando_revisao') throw new Error('Post não aprovado para publicação.');
  if (format.includes('story') || format.includes('stories')) {
    const storyUrl = video || single;
    if (!storyUrl) throw new Error('Story sem mídia final.');
    if (!storyUrl.startsWith('https://')) throw new Error('Mídia do Story precisa ser HTTPS pública.');
    return publishInstagramStory(storyUrl, caption);
  }
  if (format.includes('carrossel') || carousel.length > 1) {
    if (!carousel.every((url: string) => url.startsWith('https://'))) throw new Error('Todas as mídias do CAROUSEL precisam ser HTTPS públicas.');
    return publishInstagramCarousel(carousel, caption);
  }
  const mediaUrl = video || single;
  if (!mediaUrl) throw new Error('Post sem mídia pública HTTPS.');
  if (!mediaUrl.startsWith('https://')) throw new Error('Mídia precisa ser HTTPS pública.');
  if (format.includes('reels') || format.includes('vídeo') || format.includes('video') || isVideoUrl(mediaUrl)) return publishInstagramReels(mediaUrl, caption);
  return publishInstagramSingleImage(mediaUrl, caption);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return okOptions(req);
  const supabase = serviceClient();
  try {
    const secret = env('PUBLISH_CRON_SECRET');
    if (req.headers.get('x-cron-secret') !== secret) throw new Error('PUBLISH_CRON_SECRET obrigatório ou inválido.');
    if (!env('META_PAGE_ACCESS_TOKEN', false) || !env('META_INSTAGRAM_BUSINESS_ID', false)) throw new Error('Meta não configurado. Publicação real bloqueada; sucesso simulado é proibido.');

    const { data: due, error } = await supabase.from('publish_queue').select('*, posts(*)').eq('status','scheduled').lte('scheduled_at', new Date().toISOString()).lt('attempt_count', MAX_ATTEMPTS).order('scheduled_at').limit(5);
    if (error) throw error;
    const results = [];
    for (const item of due || []) {
      try {
        const response = await publishItem(item);
        await supabase.from('publish_queue').update({ status:'published', published_at:new Date().toISOString(), response_json:response, error_message:null, updated_at:new Date().toISOString() }).eq('id', item.id);
        await supabase.from('posts').update({ status:'publicado', published_at:new Date().toISOString(), meta_post_id:response.publish?.id || null, error_message:null, updated_at:new Date().toISOString() }).eq('id', item.post_id).then(() => null, () => null);
        await supabase.from('publish_logs').insert({ publish_queue_id:item.id, post_id:item.post_id, brand_id:item.brand_id, channel:item.channel, status:'published', message:'Publicado na Meta.', response_json:response });
        results.push({ id:item.id, ok:true, mode: response.mode });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const attempts = Number(item.attempt_count || 0) + 1;
        // Erro transitório (rate limit/instabilidade) volta para a fila até esgotar as tentativas.
        const transient = e instanceof MetaApiError ? e.isTransient || e.isMediaNotReady : /timeout|abort|network/i.test(msg);
        const nextStatus = transient && attempts < MAX_ATTEMPTS ? 'scheduled' : 'error';
        await supabase.from('publish_queue').update({ status:nextStatus, attempt_count:attempts, error_message:msg.slice(0, 2000), updated_at:new Date().toISOString() }).eq('id', item.id);
        await supabase.from('publish_logs').insert({ publish_queue_id:item.id, post_id:item.post_id, brand_id:item.brand_id, channel:item.channel, status:'error', message: nextStatus === 'scheduled' ? `Falha transitória; nova tentativa agendada (${attempts}/${MAX_ATTEMPTS}).` : 'Falha de publicação.', technical_detail:msg.slice(0, 2000) });
        results.push({ id:item.id, ok:false, willRetry: nextStatus === 'scheduled', error:msg });
      }
    }
    await systemLog(supabase, { module:'publish-scheduled-posts', type:'publish', status:'ok', friendly_message:'Publicador executado.', metadata:{ count: results.length } });
    return json(req, { ok:true, processed:results.length, results });
  } catch (error) { return err(req, error); }
});
