import { readFileSync, existsSync } from 'node:fs';

const required = [
  'engine/processors/video-processor.mjs',
  'engine/processors/job-processor.mjs',
  'src/components/video-review-player.tsx',
  'src/components/social-components.tsx',
  'src/routes/biblioteca.tsx',
  'supabase/patches/MYINC_PATCH_VIDEO_OPENAI_QUALIDADE_V6_5.sql',
];

for (const file of required) {
  if (!existsSync(file)) throw new Error(`Arquivo ausente: ${file}`);
}
const video = readFileSync('engine/processors/video-processor.mjs', 'utf8');
if (!video.includes('/videos') || !video.includes('sora-2')) throw new Error('Video processor não está usando OpenAI Videos API.');
const player = readFileSync('src/components/video-review-player.tsx', 'utf8');
if (!player.includes('<video') || !player.includes('controls')) throw new Error('Player de vídeo não tem controle de review.');
const sql = readFileSync('supabase/patches/MYINC_PATCH_VIDEO_OPENAI_QUALIDADE_V6_5.sql', 'utf8');
if (!sql.includes('sound_assets') || !sql.includes('reference_assets')) throw new Error('SQL não está levando biblioteca/cérebro para o payload.');
console.log('V6.5 OK: OpenAI video, player, som e cérebro premium presentes.');
