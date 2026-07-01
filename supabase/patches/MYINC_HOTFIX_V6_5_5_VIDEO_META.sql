-- MYINC HOTFIX V6.5.5 — vídeo garantido + Meta real
-- Pode rodar mais de uma vez.

alter table if exists public.posts add column if not exists video_url text;
alter table if exists public.posts add column if not exists video_poster_url text;
alter table if exists public.posts add column if not exists video_status text;
alter table if exists public.posts add column if not exists video_progress integer;
alter table if exists public.posts add column if not exists audio_url text;
alter table if exists public.posts add column if not exists sound_asset_url text;
alter table if exists public.posts add column if not exists published_at timestamptz;
alter table if exists public.posts add column if not exists meta_publish_id text;
alter table if exists public.posts add column if not exists meta_post_id text;
alter table if exists public.posts add column if not exists meta_permalink text;
alter table if exists public.posts add column if not exists published_url text;

alter table if exists public.post_versions add column if not exists video_url text;
alter table if exists public.post_versions add column if not exists carousel_media_urls text[] default '{}';

alter table if exists public.publish_logs add column if not exists response_json jsonb default '{}'::jsonb;
alter table if exists public.publish_logs add column if not exists metadata jsonb default '{}'::jsonb;

-- Recoloca posts de vídeo que ficaram só com capa em estado de reprocessamento opcional.
-- Não altera aprovados/publicados; só limpa erro visual de jobs incompletos se o MP4 ainda não existir.
update public.posts
set video_status = coalesce(video_status, 'aguardando_mp4'),
    video_progress = coalesce(video_progress, 0),
    updated_at = now()
where (lower(coalesce(format,'')) like '%reels%' or lower(coalesce(format,'')) like '%video%' or lower(coalesce(format,'')) like '%vídeo%')
  and coalesce(video_url, '') = ''
  and status <> 'publicado';
