import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FALLBACK_COLORS = {
  dark: '#111111',
  graphite: '#252525',
  muted: '#9EA3A7',
  light: '#FFFFFF',
  paper: '#F7F5F1',
  accent: '#F05A28',
};

function clean(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function stripHtml(value = '') {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function decodeBase64(value = '') {
  const cleanValue = String(value || '').includes(',') ? String(value).split(',').pop() : String(value || '');
  return Buffer.from(cleanValue || '', 'base64');
}

async function artifactToBuffer(artifact) {
  if (!artifact) return null;
  if (artifact.base64) return decodeBase64(artifact.base64);
  if (artifact.url && /^https?:\/\//i.test(String(artifact.url))) {
    const response = await fetch(String(artifact.url));
    if (!response.ok) throw new Error(`Falha ao baixar base visual para render: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  return null;
}

function parseSize(value, format = '') {
  const raw = `${value || ''} ${format || ''}`.toLowerCase();
  if (raw.includes('story') || raw.includes('stories') || raw.includes('reels') || raw.includes('1080x1920') || raw.includes('720x1280')) {
    return { width: 1080, height: 1920, label: 'story/reels' };
  }
  if (raw.includes('quadrado') || raw.includes('1080x1080') || raw.includes('1024x1024')) {
    return { width: 1080, height: 1080, label: 'feed-square' };
  }
  if (raw.includes('facebook') || raw.includes('1200x630') || raw.includes('1536x1024') || raw.includes('horizontal')) {
    return { width: 1200, height: 630, label: 'facebook-horizontal' };
  }
  return { width: 1080, height: 1350, label: 'feed-portrait' };
}

function escapeXml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text, maxChars, maxLines = 4) {
  const words = stripHtml(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/[.,;:!?]*$/, '') + '…';
  }
  return lines.length ? lines : ['MYINC'];
}

function svgTextLines(lines, x, y, lineHeight, options = {}) {
  const weight = options.weight || 700;
  const size = options.size || 72;
  const fill = options.fill || FALLBACK_COLORS.light;
  const anchor = options.anchor || 'start';
  return lines.map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" font-family="Montserrat, Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="${options.letterSpacing || 0}" fill="${fill}" text-anchor="${anchor}">${escapeXml(line)}</text>`).join('\n');
}

function resolveLogoPath(kind = 'white') {
  const explicit = kind === 'dark' ? process.env.MYINC_LOGO_DARK_PATH : process.env.MYINC_LOGO_WHITE_PATH;
  const candidates = [
    explicit,
    resolve(process.cwd(), 'src/assets', kind === 'dark' ? 'myinc-logo-dark.png' : 'myinc-logo-white.png'),
    resolve(process.cwd(), 'assets', kind === 'dark' ? 'myinc-logo-dark.png' : 'myinc-logo-white.png'),
    resolve(__dirname, '../../src/assets', kind === 'dark' ? 'myinc-logo-dark.png' : 'myinc-logo-white.png'),
    resolve(__dirname, '../../assets', kind === 'dark' ? 'myinc-logo-dark.png' : 'myinc-logo-white.png'),
  ].filter(Boolean);
  return candidates.find((item) => existsSync(item)) || null;
}

async function logoDataUri(kind = 'white') {
  const logoPath = resolveLogoPath(kind);
  if (!logoPath) return null;
  const data = await readFile(logoPath);
  return `data:image/png;base64,${data.toString('base64')}`;
}

async function logoDataUriFromPayload(payload = {}, kind = 'dark') {
  const refs = Array.isArray(payload.reference_assets)
    ? payload.reference_assets
    : Array.isArray(payload.referenceAssets)
      ? payload.referenceAssets
      : [];
  const logos = refs.filter((ref) => {
    const role = String(ref?.role || ref?.kind || ref?.type || '').toLowerCase();
    const tags = Array.isArray(ref?.tags) ? ref.tags.map((tag) => String(tag).toLowerCase()).join(' ') : '';
    return role.includes('logo') || tags.includes('logo');
  });
  const logo = logos.find((ref) => {
    const haystack = [
      ref.name,
      ref.title,
      ref.notes,
      ref.kind,
      ref.role,
      ref.type,
      ref.usage_context,
      ...asArray(ref.tags),
    ].map((item) => String(item || '').toLowerCase()).join(' ');
    if (kind === 'dark') return /(dark|preto|grafite|escuro|black)/.test(haystack);
    return /(white|branco|claro|light)/.test(haystack);
  }) || logos[0];
  const url = String(logo?.url || logo?.public_url || logo?.publicUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) return logoDataUri(kind);
  const response = await fetch(url);
  if (!response.ok) return logoDataUri(kind);
  const contentType = response.headers.get('content-type') || 'image/png';
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString('base64')}`;
}

function pickPalette(payload = {}) {
  const profile = payload.brand_profile || payload.profile || {};
  const metadata = profile.metadata || payload.brand_metadata || {};
  const palette = metadata.palette || profile.palette || payload.palette || {};
  return {
    dark: clean(palette.dark || palette.black || profile.primary_color, FALLBACK_COLORS.dark),
    graphite: clean(palette.graphite || palette.secondary_color, FALLBACK_COLORS.graphite),
    muted: clean(palette.muted || palette.gray, FALLBACK_COLORS.muted),
    light: clean(palette.light || palette.white, FALLBACK_COLORS.light),
    paper: clean(palette.paper || palette.background, FALLBACK_COLORS.paper),
    accent: clean(palette.accent || profile.accent_color, FALLBACK_COLORS.accent),
  };
}

function inferContentPillar(payload = {}, type = 'image') {
  const post = payload.post || {};
  const text = `${post.title || ''} ${post.theme || ''} ${post.objective || ''} ${post.creative_brief || ''}`.toLowerCase();
  if (type === 'carousel_page') return 'conteúdo salvável';
  if (/curiosidade|você sabia|voce sabia|mito|verdade|dica/.test(text)) return 'curiosidade';
  if (/lançamento|lancamento|novidade|obra|evolução|evolucao/.test(text)) return 'novidade';
  if (/autoridade|especialista|método|metodo|processo|bastidor/.test(text)) return 'autoridade';
  if (/depoimento|cliente|prova social/.test(text)) return 'prova social';
  return 'editorial premium';
}

function layoutMode(payload = {}, type = 'image') {
  const post = payload.post || {};
  const format = String(post.format || payload.format || '').toLowerCase();
  if (type === 'carousel_page') return 'carousel';
  if (format.includes('story') || format.includes('reels')) return 'story';
  if (format.includes('quadrado')) return 'square';
  return 'feed';
}

function textContent(payload = {}, type = 'image') {
  const post = payload.post || {};
  const metadata = post.metadata || {};
  const carouselPages = Array.isArray(metadata.carousel_pages) ? metadata.carousel_pages : Array.isArray(payload.carousel_pages) ? payload.carousel_pages : [];
  const page = Math.max(1, Number(payload.page || payload.page_number || 1));
  const pageData = type === 'carousel_page'
    ? (payload.carousel_page && typeof payload.carousel_page === 'object' ? payload.carousel_page : carouselPages[page - 1] || null)
    : null;
  const headline = clean(pageData?.headline || pageData?.title || post.headline || post.title || post.theme, 'MYINC');
  const supporting = clean(pageData?.body || pageData?.text || post.short_text || post.objective || post.creative_brief, 'Conteúdo premium para quem valoriza arquitetura, localização e patrimônio.');
  const cta = clean(pageData?.cta || post.cta, type === 'carousel_page' && page < Number(payload.page_count || payload.total_pages || 5) ? 'arraste para entender' : 'fale com a MYINC');
  return { headline, supporting, cta, page, pageCount: Number(payload.page_count || payload.total_pages || 1) || 1 };
}

function buildOverlaySvg({ width, height, payload, type, logoWhite, logoDark }) {
  const palette = pickPalette(payload);
  const mode = layoutMode(payload, type);
  const pillar = inferContentPillar(payload, type).toUpperCase();
  const { headline, supporting, cta, page, pageCount } = textContent(payload, type);
  const safe = Math.round(width * 0.075);
  const titleSize = mode === 'story' ? 68 : mode === 'square' ? 54 : 60;
  const supportSize = mode === 'story' ? 32 : 29;
  const titleMax = mode === 'story' ? 17 : mode === 'square' ? 19 : 22;
  const supportMax = mode === 'story' ? 30 : 36;
  const panelWidth = mode === 'story' ? Math.round(width * 0.82) : Math.round(width * 0.76);
  const panelX = safe;
  const panelY = mode === 'story' ? Math.round(height * 0.52) : mode === 'square' ? Math.round(height * 0.50) : Math.round(height * 0.57);
  const headlineLines = wrapText(headline, titleMax, mode === 'story' ? 3 : 3);
  const supportLines = wrapText(supporting, supportMax, mode === 'story' ? 2 : 2);
  const logo = logoDark || logoWhite;
  const logoW = mode === 'story' ? 210 : 176;
  const logoH = mode === 'story' ? 86 : 72;
  const logoY = height - safe - logoH;
  const ctaWidth = Math.min(width - safe * 2, Math.max(210, Math.min(360, cta.length * 13)));
  const ctaLabel = cta.length > 28 ? `${cta.slice(0, 25).trim()}...` : cta;
  const ctaText = escapeXml(ctaLabel.toUpperCase());
  const progress = type === 'carousel_page' && pageCount > 1
    ? `<text x="${width - safe}" y="${safe + 38}" font-family="Montserrat, Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="${palette.graphite}" text-anchor="end">${page}/${pageCount}</text>`
    : '';

  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="${palette.paper}" stop-opacity="0.82"/>
        <stop offset="0.45" stop-color="${palette.light}" stop-opacity="0.28"/>
        <stop offset="1" stop-color="${palette.paper}" stop-opacity="0.92"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000000" flood-opacity="0.14"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#shade)"/>
    <rect x="${safe * 0.55}" y="${safe * 0.55}" width="${width - safe * 1.1}" height="${height - safe * 1.1}" rx="0" fill="none" stroke="${palette.light}" stroke-opacity="0.0"/>
    <rect x="${panelX - 18}" y="${panelY - 46}" width="${panelWidth + 36}" height="${Math.round(height * 0.27)}" rx="18" fill="${palette.paper}" opacity="0.92" filter="url(#shadow)"/>
    <rect x="${panelX}" y="${panelY - 22}" width="${Math.min(230, Math.round(panelWidth * 0.34))}" height="7" rx="4" fill="${palette.accent}"/>
    <text x="${panelX}" y="${panelY + 30}" font-family="Montserrat, Inter, Arial, sans-serif" font-size="19" font-weight="800" letter-spacing="2.8" fill="${palette.accent}">${escapeXml(pillar)}</text>
    ${svgTextLines(headlineLines, panelX, panelY + 100, Math.round(titleSize * 1.04), { size: titleSize, weight: 850, fill: palette.dark })}
    ${svgTextLines(supportLines, panelX, panelY + 114 + headlineLines.length * Math.round(titleSize * 1.04) + 24, Math.round(supportSize * 1.28), { size: supportSize, weight: 500, fill: palette.graphite })}
    <g transform="translate(${width - safe - ctaWidth}, ${logoY - 64})">
      <rect x="0" y="0" width="${ctaWidth}" height="46" rx="23" fill="${palette.accent}"/>
      <text x="22" y="30" font-family="Montserrat, Inter, Arial, sans-serif" font-size="19" font-weight="800" letter-spacing="1.2" fill="${palette.light}">${ctaText}</text>
    </g>
    ${logo ? `<image href="${logo}" x="${safe}" y="${logoY}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMinYMid meet" opacity="0.98"/>` : `<text x="${safe}" y="${height - safe}" font-family="Montserrat, Inter, Arial, sans-serif" font-size="34" font-weight="800" fill="${palette.dark}">MYINC</text>`}
    ${progress}
  </svg>`;
}

export async function renderFinalDesignV2({ baseArtifact, payload = {}, type = 'image' }) {
  const disabled = String(process.env.CREATIVE_FINAL_RENDER || '1').toLowerCase() === '0';
  if (disabled) return { artifact: baseArtifact, details: { rendered: false, reason: 'CREATIVE_FINAL_RENDER=0' } };
  const baseBuffer = await artifactToBuffer(baseArtifact);
  if (!baseBuffer) return { artifact: baseArtifact, details: { rendered: false, reason: 'base visual ausente' } };

  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (error) {
    return { artifact: baseArtifact, details: { rendered: false, reason: `sharp não instalado: ${error.message}` } };
  }

  const post = payload.post || {};
  const sizeInfo = parseSize(payload.final_size || payload.output_size || payload.size, post.format || payload.format || '');
  const logoDark = await logoDataUriFromPayload(payload, 'dark').catch(() => null);
  const logoWhite = await logoDataUriFromPayload(payload, 'white').catch(() => null);
  const base = await sharp(baseBuffer)
    .resize(sizeInfo.width, sizeInfo.height, { fit: 'cover', position: 'attention' })
    .modulate({ saturation: 0.96, brightness: 0.94 })
    .png()
    .toBuffer();
  const overlay = Buffer.from(buildOverlaySvg({ width: sizeInfo.width, height: sizeInfo.height, payload, type, logoWhite, logoDark }));
  const output = await sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png({ compressionLevel: 8, quality: 96 })
    .toBuffer();

  return {
    artifact: {
      ...baseArtifact,
      base64: output.toString('base64'),
      url: undefined,
      mime: 'image/png',
      ext: 'png',
      renderEngine: 'myinc-design-renderer-v2',
    },
    details: {
      rendered: true,
      engine: 'myinc-design-renderer-v2',
      outputSize: `${sizeInfo.width}x${sizeInfo.height}`,
      format: sizeInfo.label,
      logoApplied: Boolean(logoWhite || logoDark),
      layout: layoutMode(payload, type),
      pillar: inferContentPillar(payload, type),
    },
  };
}
