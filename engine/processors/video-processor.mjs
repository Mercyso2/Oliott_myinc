import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeVideoSeconds(value = '8') {
  const raw = String(value || '8');
  return ['4', '8', '12'].includes(raw) ? raw : '8';
}

function normalizeVideoSize(value = '720x1280') {
  const raw = String(value || '720x1280').toLowerCase();
  if (raw === '1280x720') return '1280x720';
  if (raw === '720x1280') return '720x1280';
  if (raw.includes('horizontal') || raw.includes('facebook') || raw.includes('landscape') || raw.includes('1792x1024') || raw.includes('1536x1024') || raw.includes('1280x720')) return '1280x720';
  return '720x1280';
}

function dimensionsFromSize(size) {
  const normalized = normalizeVideoSize(size);
  return normalized === '1280x720' ? { width: 1280, height: 720, size: normalized } : { width: 720, height: 1280, size: '720x1280' };
}

function pickVideoReference(payload = {}) {
  const refs = Array.isArray(payload.reference_assets)
    ? payload.reference_assets
    : Array.isArray(payload.referenceAssets)
      ? payload.referenceAssets
      : [];
  const ranked = refs
    .filter((ref) => ref && typeof ref === 'object' && /^https?:\/\//i.test(String(ref.url || ref.public_url || ref.publicUrl || '')))
    .map((ref) => ({
      ...ref,
      url: String(ref.url || ref.public_url || ref.publicUrl),
      role: String(ref.role || ref.kind || 'style_reference'),
      score:
        String(ref.role || '').includes('person') ? 100 :
        String(ref.role || '').includes('template') ? 80 :
        String(ref.role || '').includes('style') ? 70 :
        String(ref.role || '').includes('logo') ? 20 : 40,
    }))
    .filter((ref) => !/logo|brand_kit|sound|audio|som|trilha/.test(String(ref.role || '').toLowerCase()))
    .sort((a, b) => b.score - a.score);
  return ranked[0] || null;
}

async function openAiJson(config, path, init = {}) {
  const response = await fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`OpenAI video ${path} HTTP ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

async function downloadVideoContent(config, videoId) {
  const response = await fetch(`https://api.openai.com/v1/videos/${videoId}/content`, {
    headers: { Authorization: `Bearer ${config.openaiApiKey}` },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Falha ao baixar conteúdo do vídeo OpenAI ${videoId}: HTTP ${response.status} ${text}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

async function tryOpenAiVideo(config, prompt, outputSize, seconds, payload) {
  const model = config.openaiVideoModel || 'sora-2';
  const inputReference = pickVideoReference(payload);
  const body = { model, prompt, seconds, size: outputSize };
  if (inputReference?.url) body.input_reference = { image_url: inputReference.url };

  console.log('[MYINC Engine] Criando MP4 com OpenAI Video API...', JSON.stringify({ model, seconds, size: outputSize, reference: inputReference?.role || null }));
  const created = await openAiJson(config, '/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const videoId = created?.id;
  if (!videoId) throw new Error(`OpenAI não retornou id do vídeo: ${JSON.stringify(created)}`);

  const startedAt = Date.now();
  let current = created;
  while (!['completed', 'failed', 'cancelled', 'canceled'].includes(String(current.status))) {
    if (Date.now() - startedAt > config.videoTimeoutMs) {
      throw new Error(`Timeout aguardando vídeo OpenAI ${videoId}. Último status: ${current.status || 'desconhecido'}`);
    }
    await sleep(config.videoPollMs || 5000);
    current = await openAiJson(config, `/videos/${videoId}`, { method: 'GET' });
    console.log('[MYINC Engine] status vídeo OpenAI', JSON.stringify({ videoId, status: current.status, progress: current.progress }));
  }

  if (current.status !== 'completed') {
    const err = current.error?.message || JSON.stringify(current.error || current);
    throw new Error(`Geração de vídeo OpenAI falhou: ${err}`);
  }

  const base64 = await downloadVideoContent(config, videoId);
  return {
    base64,
    provider: 'openai-videos',
    model,
    videoId,
    status: current.status,
    progress: current.progress ?? 100,
    mime: 'video/mp4',
    ext: 'mp4',
    seconds,
    size: outputSize,
    inputReference: inputReference ? { id: inputReference.id || null, role: inputReference.role, name: inputReference.name || null, url: inputReference.url } : null,
    raw: current,
  };
}

async function bufferFromArtifact(artifact) {
  if (!artifact) return null;
  if (artifact.base64) return Buffer.from(String(artifact.base64).split(',').pop() || '', 'base64');
  const url = String(artifact.url || '').trim();
  if (/^https?:\/\//i.test(url)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Falha ao baixar poster para fallback local: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  return null;
}

async function generateFfmpegFallback(config, posterArtifact, seconds, outputSize, reason) {
  const posterBuffer = await bufferFromArtifact(posterArtifact);
  if (!posterBuffer) throw new Error('Fallback local precisa de posterArtifact com base64 ou url.');

  const { width, height, size } = dimensionsFromSize(outputSize);
  const tmp = await mkdtemp(join(tmpdir(), 'myinc-video-'));
  const posterPath = join(tmp, 'poster.png');
  const outputPath = join(tmp, 'output.mp4');
  try {
    await writeFile(posterPath, posterBuffer);
    const vf = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z='min(zoom+0.0015,1.08)':d=${Number(seconds) * 25}:s=${width}x${height}:fps=25,format=yuv420p`;
    await execFileAsync(config.ffmpegPath || 'ffmpeg', [
      '-y',
      '-loop', '1',
      '-i', posterPath,
      '-f', 'lavfi',
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-vf', vf,
      '-t', String(seconds),
      '-shortest',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ], { maxBuffer: 1024 * 1024 * 10 });
    const mp4 = await readFile(outputPath);
    return {
      base64: mp4.toString('base64'),
      provider: 'local-ffmpeg-fallback',
      model: 'openai-image-plus-ffmpeg',
      status: 'completed',
      progress: 100,
      mime: 'video/mp4',
      ext: 'mp4',
      seconds,
      size,
      fallbackReason: reason,
    };
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function generateVideo(config, prompt, size = '720x1280', payload = {}, posterArtifact = null) {
  const seconds = normalizeVideoSeconds(payload.video_seconds || payload.seconds || config.openaiVideoSeconds || '8');
  const outputSize = normalizeVideoSize(payload.video_size || payload.size || config.openaiVideoSize || size);

  if (!config.openaiVideoEnabled) {
    return await generateFfmpegFallback(config, posterArtifact, seconds, outputSize, 'OPENAI_VIDEO_ENABLED não está ativo; usando MP4 local econômico com poster renderizado.');
  }

  try {
    return await tryOpenAiVideo(config, prompt, outputSize, seconds, payload);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn('[MYINC Engine] OpenAI Video API não entregou MP4. Tentando fallback local FFmpeg com poster OpenAI:', reason);
    if (String(config.videoFallbackMode || 'ffmpeg').toLowerCase() !== 'off') {
      try {
        return await generateFfmpegFallback(config, posterArtifact, seconds, outputSize, reason);
      } catch (fallbackError) {
        throw new Error(`OpenAI Video não entregou MP4 e o fallback local FFmpeg falhou: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}. Motivo OpenAI: ${reason}`);
      }
    }
    throw new Error(`OpenAI Video não entregou MP4 e VIDEO_FALLBACK_MODE está desativado. Motivo: ${reason}`);
  }
}
