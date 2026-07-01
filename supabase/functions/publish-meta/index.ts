import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { env, err, json, okOptions, readJson, requireUser, serviceClient, safeString } from "../_shared/v2-utils.ts";

type AnyRecord = Record<string, any>;
const graphVersion = env("META_GRAPH_VERSION", false) || "v21.0";
const apiBase = () => `https://graph.facebook.com/${graphVersion}`;

function metaToken() {
  return env("META_PAGE_ACCESS_TOKEN");
}

async function metaPost(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, access_token: metaToken() }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (!data.id && !data.success)) throw new Error(`Meta erro em ${path}: ${JSON.stringify(data)}`);
  return data;
}

async function metaGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${apiBase()}${path}`);
  url.searchParams.set("access_token", metaToken());
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url.toString(), { method: "GET" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Meta erro em ${path}: ${JSON.stringify(data)}`);
  return data;
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
}

function cleanCaption(post: AnyRecord) {
  const hashtags = Array.isArray(post.hashtags) ? post.hashtags.join(" ") : safeString(post.hashtags);
  return [safeString(post.caption), hashtags].filter(Boolean).join("\n\n").trim();
}

function getMedia(post: AnyRecord) {
  const carousel = Array.isArray(post.carousel_media_urls) ? post.carousel_media_urls.filter(Boolean).map(String) : [];
  const video = safeString(post.video_url);
  const single = safeString(post.media_url || carousel[0]);
  const poster = safeString(post.video_poster_url || (!isVideoUrl(single) ? single : ""));
  return { carousel, video, single, poster };
}

function assertHttps(urls: string[]) {
  const invalid = urls.find((url) => !url.startsWith("https://"));
  if (invalid) throw new Error(`A mídia precisa ser URL HTTPS pública para a Meta: ${invalid}`);
}

async function waitInstagramContainer(containerId: string, maxMs = 180000) {
  const startedAt = Date.now();
  let last: AnyRecord = {};
  while (Date.now() - startedAt < maxMs) {
    last = await metaGet(`/${containerId}`, { fields: "status_code,status" });
    const code = String(last.status_code || last.status || "").toUpperCase();
    if (["FINISHED", "PUBLISHED"].includes(code)) return last;
    if (["ERROR", "EXPIRED", "FAILED"].includes(code)) throw new Error(`Container Instagram falhou: ${JSON.stringify(last)}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Timeout aguardando container Instagram ficar pronto: ${JSON.stringify(last)}`);
}

async function fetchPermalink(mediaId: string) {
  const data = await metaGet(`/${mediaId}`, { fields: "permalink" }).catch(() => ({}));
  return data?.permalink || null;
}

async function publishInstagramImage(mediaUrl: string, caption: string) {
  const igId = env("META_INSTAGRAM_BUSINESS_ID");
  const container = await metaPost(`/${igId}/media`, { image_url: mediaUrl, caption });
  await waitInstagramContainer(container.id, 90000).catch(() => null);
  const publish = await metaPost(`/${igId}/media_publish`, { creation_id: container.id });
  const permalink = await fetchPermalink(publish.id);
  return { platform: "instagram", mode: "image", container, publish, id: publish.id, permalink };
}

async function publishInstagramCarousel(mediaUrls: string[], caption: string) {
  const igId = env("META_INSTAGRAM_BUSINESS_ID");
  if (mediaUrls.length < 2) throw new Error("Carrossel exige pelo menos 2 imagens públicas.");
  const children: string[] = [];
  for (const url of mediaUrls.slice(0, 10)) {
    const child = await metaPost(`/${igId}/media`, { image_url: url, is_carousel_item: true });
    await waitInstagramContainer(child.id, 90000).catch(() => null);
    children.push(child.id);
  }
  const container = await metaPost(`/${igId}/media`, { media_type: "CAROUSEL", children, caption });
  await waitInstagramContainer(container.id, 90000).catch(() => null);
  const publish = await metaPost(`/${igId}/media_publish`, { creation_id: container.id });
  const permalink = await fetchPermalink(publish.id);
  return { platform: "instagram", mode: "carousel", children, container, publish, id: publish.id, permalink };
}

async function publishInstagramReels(videoUrl: string, caption: string) {
  const igId = env("META_INSTAGRAM_BUSINESS_ID");
  if (!isVideoUrl(videoUrl)) throw new Error("Reels exige video_url final em MP4/MOV/WebM. Gere o vídeo antes de publicar.");
  const container = await metaPost(`/${igId}/media`, { media_type: "REELS", video_url: videoUrl, caption });
  await waitInstagramContainer(container.id, 300000);
  const publish = await metaPost(`/${igId}/media_publish`, { creation_id: container.id });
  const permalink = await fetchPermalink(publish.id);
  return { platform: "instagram", mode: "reels", container, publish, id: publish.id, permalink };
}

async function publishInstagramStory(mediaUrl: string, caption: string) {
  const igId = env("META_INSTAGRAM_BUSINESS_ID");
  const payload = isVideoUrl(mediaUrl)
    ? { media_type: "STORIES", video_url: mediaUrl, caption }
    : { media_type: "STORIES", image_url: mediaUrl, caption };
  const container = await metaPost(`/${igId}/media`, payload);
  await waitInstagramContainer(container.id, isVideoUrl(mediaUrl) ? 300000 : 90000);
  const publish = await metaPost(`/${igId}/media_publish`, { creation_id: container.id });
  const permalink = await fetchPermalink(publish.id);
  return { platform: "instagram", mode: "story", container, publish, id: publish.id, permalink };
}

async function publishFacebookPhoto(mediaUrl: string, caption: string) {
  const pageId = env("META_PAGE_ID", false);
  if (!pageId) return null;
  const publish = await metaPost(`/${pageId}/photos`, { url: mediaUrl, caption, published: true });
  return { platform: "facebook", mode: "photo", publish, id: publish.id };
}

async function publishFacebookVideo(videoUrl: string, caption: string) {
  const pageId = env("META_PAGE_ID", false);
  if (!pageId) return null;
  const publish = await metaPost(`/${pageId}/videos`, { file_url: videoUrl, description: caption, published: true });
  return { platform: "facebook", mode: "video", publish, id: publish.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return okOptions(req);
  const supabase = serviceClient();
  try {
    const user = await requireUser(req);
    const body = await readJson(req) as Record<string, unknown>;
    const postId = safeString(body.postId || body.post_id);
    const publishFacebook = Boolean(body.publishFacebook ?? body.facebook ?? true);
    if (!postId) throw new Error("postId obrigatório.");
    if (!env("META_PAGE_ACCESS_TOKEN", false) || !env("META_INSTAGRAM_BUSINESS_ID", false)) {
      throw new Error("Meta não configurado. Defina META_PAGE_ACCESS_TOKEN e META_INSTAGRAM_BUSINESS_ID. Sucesso simulado é proibido.");
    }

    const { data: post, error: postErr } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
    if (postErr || !post) throw new Error("Post não encontrado.");
    if (post.deleted_at || post.archived_at) throw new Error("Post arquivado/excluído não pode ser publicado.");
    if (!["aprovado", "agendado", "aguardando_revisao", "pronto", "ready"].includes(String(post.status || "").toLowerCase()) && !post.approved_at) {
      throw new Error("Post precisa estar aprovado antes de publicar.");
    }

    const caption = cleanCaption(post);
    const { carousel, video, single } = getMedia(post);
    const format = String(post.format || "").toLowerCase();
    const responses: AnyRecord[] = [];

    if (format.includes("story") || format.includes("stories")) {
      const storyUrl = video || single;
      if (!storyUrl) throw new Error("Story sem mídia final. Gere mídia vertical antes de publicar.");
      assertHttps([storyUrl]);
      responses.push(await publishInstagramStory(storyUrl, caption));
      if (publishFacebook && storyUrl && !isVideoUrl(storyUrl)) responses.push(await publishFacebookPhoto(storyUrl, caption));
      if (publishFacebook && storyUrl && isVideoUrl(storyUrl)) responses.push(await publishFacebookVideo(storyUrl, caption));
    } else if (format.includes("carrossel") || carousel.length > 1) {
      assertHttps(carousel);
      responses.push(await publishInstagramCarousel(carousel, caption));
      if (publishFacebook && carousel[0]) responses.push(await publishFacebookPhoto(carousel[0], caption));
    } else if (format.includes("reels") || format.includes("vídeo") || format.includes("video")) {
      if (!video) throw new Error("Post de vídeo/Reels sem MP4 final. Clique em Gerar vídeo e processe o job antes de publicar.");
      assertHttps([video]);
      responses.push(await publishInstagramReels(video, caption));
      if (publishFacebook) responses.push(await publishFacebookVideo(video, caption));
    } else {
      const mediaUrl = single;
      if (!mediaUrl) throw new Error("Post sem mídia final para publicação.");
      assertHttps([mediaUrl]);
      responses.push(await publishInstagramImage(mediaUrl, caption));
      if (publishFacebook) responses.push(await publishFacebookPhoto(mediaUrl, caption));
    }

    const primary = responses.find(Boolean) || {};
    const metaPostId = primary.id || primary.publish?.id || null;
    const permalink = primary.permalink || null;
    const { data: updated, error: updateErr } = await supabase.from("posts").update({
      status: "publicado",
      published_at: new Date().toISOString(),
      meta_publish_id: metaPostId,
      meta_post_id: metaPostId,
      meta_permalink: permalink,
      published_url: permalink,
      error_message: null,
      technical_detail: null,
      updated_at: new Date().toISOString(),
    }).eq("id", postId).select("*").single();
    if (updateErr) throw updateErr;

    await supabase.from("publish_logs").insert({
      post_id: postId,
      brand_id: post.brand_id,
      channel: post.channel,
      status: "published",
      message: "Publicado na Meta com API real.",
      response_json: { responses },
      metadata: { source: "publish-meta-v6-5-5", user_id: user.id },
    });

    return json(req, { ok: true, post: updated, publishedUrl: permalink, responses, message: "Post publicado na Meta com API real." });
  } catch (error) {
    return err(req, error, 500);
  }
});
