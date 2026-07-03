// Validação estrutural real da imagem final antes de salvar o resultado.
// Substitui o antigo quality-checker que retornava um score fixo.

function decodeBase64(value = '') {
  const cleanValue = String(value || '').includes(',') ? String(value).split(',').pop() : String(value || '');
  return Buffer.from(cleanValue || '', 'base64');
}

async function artifactToBuffer(artifact) {
  if (!artifact) return null;
  if (artifact.base64) return decodeBase64(artifact.base64);
  if (artifact.url && /^https?:\/\//i.test(String(artifact.url))) {
    const response = await fetch(String(artifact.url));
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }
  return null;
}

const MIN_BYTES = 25000;
const MIN_SHORT_SIDE = 1000;

/**
 * Checa a imagem final: decodificável, resolução mínima, não em branco,
 * não escura demais (a identidade MYINC é clara) e logo aplicada pelo renderer.
 * Falha crítica (corrompida/em branco) deve reprovar o job; os demais
 * problemas apenas reduzem o score e viram notas para a revisão humana.
 */
export async function checkImageQuality({ artifact, expectedSize = '', logoApplied = null, rendered = null } = {}) {
  const notes = [];
  let score = 100;
  let critical = false;

  const buffer = await artifactToBuffer(artifact).catch(() => null);
  if (!buffer || buffer.length < MIN_BYTES) {
    return {
      ok: false,
      critical: true,
      score: 0,
      notes: [`Imagem ausente ou corrompida (${buffer ? `${buffer.length} bytes` : 'sem dados'}).`],
      checks: { bytes: buffer ? buffer.length : 0 },
    };
  }

  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    // Sem sharp não há como inspecionar pixels; aprova com nota para revisão humana.
    return {
      ok: true,
      critical: false,
      score: 88,
      notes: ['sharp indisponível: validação de pixels pulada, revisar manualmente.'],
      checks: { bytes: buffer.length, pixelInspection: false },
    };
  }

  let meta;
  let stats;
  try {
    const image = sharp(buffer);
    meta = await image.metadata();
    stats = await image.stats();
  } catch (error) {
    return {
      ok: false,
      critical: true,
      score: 0,
      notes: [`Imagem não decodificável: ${error.message}`],
      checks: { bytes: buffer.length },
    };
  }

  const width = meta.width || 0;
  const height = meta.height || 0;
  const [expWidth, expHeight] = String(expectedSize || '').split('x').map((item) => Number(item) || 0);
  const matchesExpected = expWidth > 0 && expHeight > 0 && width === expWidth && height === expHeight;
  if (expWidth && expHeight && !matchesExpected) {
    score -= 8;
    notes.push(`Dimensões divergem do formato do post: ${width}x${height} vs ${expWidth}x${expHeight}.`);
  }
  // Resolução mínima só reprova quando a peça não está no tamanho oficial do
  // formato (ex.: Facebook 1200x630 é correto mesmo com lado menor de 630px).
  if (!matchesExpected && Math.min(width, height) < MIN_SHORT_SIDE) {
    score -= 15;
    notes.push(`Resolução abaixo do ideal: ${width}x${height} (mínimo ${MIN_SHORT_SIDE}px no lado menor).`);
  }

  const channels = stats.channels || [];
  const maxStdev = Math.max(...channels.map((channel) => channel.stdev || 0), 0);
  const meanLuma = channels.length
    ? channels.slice(0, 3).reduce((acc, channel) => acc + (channel.mean || 0), 0) / Math.min(3, channels.length)
    : 0;
  if (maxStdev < 4) {
    critical = true;
    notes.push('Imagem praticamente uniforme (em branco ou cor sólida): geração falhou.');
  }
  if (meanLuma < 22) {
    score -= 10;
    notes.push('Imagem muito escura para a identidade clara MYINC.');
  }

  if (rendered === false) {
    score -= 6;
    notes.push('Render final não aplicado; publicando base sem camadas de marca.');
  }
  if (logoApplied === false) {
    score -= 10;
    notes.push('Logo real não encontrada/aplicada no render final.');
  }

  score = critical ? 0 : Math.max(40, Math.min(100, score));
  return {
    ok: !critical,
    critical,
    score,
    notes,
    checks: {
      bytes: buffer.length,
      width,
      height,
      maxStdev: Math.round(maxStdev * 100) / 100,
      meanLuma: Math.round(meanLuma * 100) / 100,
      logoApplied,
      rendered,
      pixelInspection: true,
    },
  };
}
