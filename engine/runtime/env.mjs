import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegStaticPath from 'ffmpeg-static';

const __dirname = dirname(fileURLToPath(import.meta.url));

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

export function loadDotenv(path = '.env.engine') {
  const candidates = unique([
    process.env.MYINC_ENGINE_ENV_FILE,
    resolve(process.cwd(), path),
    resolve(process.env.MYINC_ENGINE_CWD || '', path),
    resolve(process.env.MYINC_ENGINE_ROOT || '', path),
    resolve(dirname(process.execPath || process.cwd()), path),
    resolve(__dirname, '../../', path),
    resolve(__dirname, '../../../', path),
  ]);
  const envPath = candidates.find((item) => item && existsSync(item));
  if (!envPath) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
  process.env.MYINC_ENGINE_ENV_FILE = envPath;
}

function normalizeVideoSeconds(value = '8') {
  const raw = String(value || '8');
  return ['4', '8', '12'].includes(raw) ? raw : '8';
}

function normalizeSoraVideoSize(value = '720x1280') {
  const raw = String(value || '720x1280').toLowerCase();
  if (raw === '1280x720') return '1280x720';
  if (raw === '720x1280') return '720x1280';
  if (
    raw.includes('horizontal') ||
    raw.includes('landscape') ||
    raw.includes('facebook') ||
    raw.includes('1280x720') ||
    raw.includes('1792x1024') ||
    raw.includes('1536x1024') ||
    raw.includes('1200x630')
  ) return '1280x720';
  return '720x1280';
}

export function getConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const workerDeviceKey = process.env.SUPABASE_WORKER_DEVICE_KEY || process.env.WORKER_DEVICE_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
  if (!workerDeviceKey) missing.push('SUPABASE_WORKER_DEVICE_KEY');
  if (!openaiApiKey) missing.push('OPENAI_API_KEY');
  if (missing.length) throw new Error(`Variáveis ausentes no .env.engine: ${missing.join(', ')}`);
  const costMode = String(process.env.CREATIVE_COST_MODE || 'balanced').toLowerCase();
  const defaultImageQuality = costMode === 'economy' ? 'medium' : process.env.OPENAI_IMAGE_QUALITY || 'high';
  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    supabaseAnonKey,
    workerDeviceKey,
    openaiApiKey,
    workerName: process.env.ENGINE_WORKER_NAME || 'MYINC Local Engine',
    pollMs: Math.max(1000, Number(process.env.ENGINE_POLL_INTERVAL_MS || 5000)),
    textModel: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
    imageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    imageQuality: defaultImageQuality,
    imageFormat: process.env.OPENAI_IMAGE_FORMAT || 'png',
    videoProvider: String(process.env.OPENAI_VIDEO_ENABLED || '').toLowerCase() === 'true' ? 'openai-with-local-fallback' : 'local-ffmpeg',
    openaiVideoEnabled: String(process.env.OPENAI_VIDEO_ENABLED || '').toLowerCase() === 'true',
    openaiVideoModel: process.env.OPENAI_VIDEO_MODEL || 'sora-2',
    openaiVideoSeconds: normalizeVideoSeconds(process.env.OPENAI_VIDEO_SECONDS || process.env.VIDEO_MAX_SECONDS || '4'),
    openaiVideoSize: normalizeSoraVideoSize(process.env.OPENAI_VIDEO_SIZE || '720x1280'),
    maxReferenceImages: Math.max(1, Math.min(6, Number(process.env.OPENAI_MAX_REFERENCE_IMAGES || 4))),
    videoPollMs: Math.max(3000, Number(process.env.OPENAI_VIDEO_POLL_MS || 5000)),
    videoTimeoutMs: Math.max(120000, Number(process.env.OPENAI_VIDEO_TIMEOUT_MS || 600000)),
    ffmpegPath: process.env.FFMPEG_PATH || ffmpegStaticPath || 'ffmpeg',
    videoFallbackMode: process.env.VIDEO_FALLBACK_MODE || 'ffmpeg',
    creativeCostMode: costMode,
    finalRender: String(process.env.CREATIVE_FINAL_RENDER || '1') !== '0',
    maxConcurrency: 1,
  };
}
