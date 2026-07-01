-- ================================================================
-- MYINC V6.1 - PATCH COMPLETO DE ESTABILIZAÇÃO
-- Data: 2026-06-16
-- Objetivo: alinhar Frontend + Supabase + Edge Functions + Motor Local.
-- Pode executar mais de uma vez no Supabase SQL Editor.
-- ================================================================

begin;

create extension if not exists pgcrypto;

-- ================================================================
-- HOTFIX V6.1: DROP SEGURO DAS RPCS ANTES DO CREATE OR REPLACE
-- Motivo: Supabase/Postgres não permite remover/alterar defaults de parâmetros
-- em função existente usando CREATE OR REPLACE. Este bloco evita o erro 42P13.
-- ================================================================
drop function if exists public.trigger_worker_now(integer, boolean) cascade;
drop function if exists public.retry_all_failed_generation_jobs(integer) cascade;
drop function if exists public.retry_generation_job(uuid) cascade;
drop function if exists public.list_generation_jobs_light(integer) cascade;
drop function if exists public.approve_convert_enqueue_plan(uuid, uuid, boolean, boolean) cascade;
drop function if exists public.enqueue_post_generation(uuid, boolean) cascade;
drop function if exists public.build_prompt_payload(uuid, text) cascade;
drop function if exists public.fail_generation_job(uuid, text, uuid, text, text, jsonb) cascade;
drop function if exists public.complete_generation_job(uuid, text, uuid, jsonb) cascade;
drop function if exists public.claim_next_generation_job(uuid, text) cascade;
drop function if exists public.requeue_stale_generation_jobs() cascade;
drop function if exists public.worker_heartbeat(uuid, text) cascade;
drop function if exists public.register_worker_device(text, text, text, jsonb) cascade;
drop function if exists public.validate_worker(uuid, text) cascade;
drop function if exists public.convert_approved_ideas_to_posts(uuid, uuid, boolean) cascade;
drop function if exists public.approve_all_post_ideas(uuid, uuid, boolean) cascade;


-- ================================================================
-- 1) COLUNAS E TABELAS OBRIGATÓRIAS
-- ================================================================

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'MYINC',
  public_name text,
  slug text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  brand_id uuid,
  email text not null unique,
  full_name text,
  avatar_initial text not null default 'M',
  role text not null default 'admin',
  status text not null default 'active',
  preferences jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users add column if not exists auth_user_id uuid;
alter table public.app_users add column if not exists brand_id uuid;
alter table public.app_users add column if not exists avatar_initial text not null default 'M';
alter table public.app_users add column if not exists preferences jsonb not null default '{}'::jsonb;
alter table public.app_users add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_users add column if not exists archived_at timestamptz;
alter table public.app_users add column if not exists deleted_at timestamptz;
create unique index if not exists app_users_email_v60 on public.app_users(lower(email));

alter table public.brands add column if not exists owner_id uuid;
alter table public.brands add column if not exists owner_user_id uuid;
alter table public.brands add column if not exists public_name text;
alter table public.brands add column if not exists slug text;
alter table public.brands add column if not exists description text;
alter table public.brands add column if not exists status text not null default 'active';
alter table public.brands add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.brands add column if not exists archived_at timestamptz;
alter table public.brands add column if not exists deleted_at timestamptz;
alter table public.brands add column if not exists created_at timestamptz not null default now();
alter table public.brands add column if not exists updated_at timestamptz not null default now();


create table if not exists public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  site text,
  instagram text,
  facebook text,
  whatsapp text,
  commercial_email text,
  region text,
  niche text,
  segment text,
  primary_audience text,
  secondary_audience text,
  persona text,
  problems_solved text,
  benefits text,
  differentiators text,
  products text,
  services text,
  average_ticket text,
  objections text,
  guarantees text,
  social_proof text,
  cases text,
  testimonials text,
  faq text,
  tone text,
  communication_style text,
  preferred_words text,
  forbidden_words text,
  preferred_visual_style text,
  forbidden_visual_style text,
  logo_rules text,
  composition_rules text,
  image_text_rules text,
  approved_references text,
  bad_references text,
  mantra text,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.brand_profiles add column if not exists brand_id uuid;
alter table public.brand_profiles add column if not exists mantra text;
alter table public.brand_profiles add column if not exists preferred_visual_style text;
alter table public.brand_profiles add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.brand_profiles add column if not exists archived_at timestamptz;
alter table public.brand_profiles add column if not exists deleted_at timestamptz;
create unique index if not exists brand_profiles_brand_id_v60 on public.brand_profiles(brand_id);

create table if not exists public.ai_brain_rules (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  name text not null,
  category text not null default 'geral',
  content text not null,
  active boolean not null default true,
  priority integer not null default 0,
  default_content text,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_brain_rules add column if not exists active boolean not null default true;
alter table public.ai_brain_rules add column if not exists priority integer not null default 0;
alter table public.ai_brain_rules add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.ai_brain_rules add column if not exists deleted_at timestamptz;

create table if not exists public.ai_prompt_templates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid,
  name text not null,
  type text not null default 'general',
  note text,
  content text not null,
  active boolean not null default true,
  version integer not null default 1,
  version_history jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_prompt_templates add column if not exists active boolean not null default true;
alter table public.ai_prompt_templates add column if not exists version integer not null default 1;
alter table public.ai_prompt_templates add column if not exists version_history jsonb not null default '[]'::jsonb;
alter table public.ai_prompt_templates add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.ai_prompt_templates add column if not exists deleted_at timestamptz;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  name text not null,
  objective text,
  month integer,
  year integer,
  total_posts integer not null default 0,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monthly_plans (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  campaign_id uuid,
  name text,
  title text,
  objective text,
  month integer,
  year integer,
  strategy text,
  prompt_used text,
  ai_response_json jsonb not null default '{}'::jsonb,
  total_posts integer,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.monthly_plans add column if not exists title text;
alter table public.monthly_plans add column if not exists objective text;
alter table public.monthly_plans add column if not exists ai_response_json jsonb not null default '{}'::jsonb;
alter table public.monthly_plans add column if not exists archived_at timestamptz;
alter table public.monthly_plans add column if not exists deleted_at timestamptz;

create table if not exists public.post_ideas (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  monthly_plan_id uuid,
  campaign_id uuid,
  converted_post_id uuid,
  title text not null default 'Ideia MYINC',
  theme text,
  headline text,
  short_text text,
  cta text,
  visual_idea text,
  initial_prompt text,
  objective text,
  channel text default 'Instagram',
  format text default 'Feed 1080x1350',
  scheduled_at timestamptz,
  suggested_at timestamptz,
  priority integer default 100,
  predicted_score integer,
  status text not null default 'rascunho',
  ai_response_json jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.post_ideas add column if not exists brand_id uuid;
alter table public.post_ideas add column if not exists monthly_plan_id uuid;
alter table public.post_ideas add column if not exists campaign_id uuid;
alter table public.post_ideas add column if not exists converted_post_id uuid;
alter table public.post_ideas add column if not exists title text;
alter table public.post_ideas add column if not exists theme text;
alter table public.post_ideas add column if not exists headline text;
alter table public.post_ideas add column if not exists short_text text;
alter table public.post_ideas add column if not exists cta text;
alter table public.post_ideas add column if not exists visual_idea text;
alter table public.post_ideas add column if not exists initial_prompt text;
alter table public.post_ideas add column if not exists objective text;
alter table public.post_ideas add column if not exists channel text default 'Instagram';
alter table public.post_ideas add column if not exists format text default 'Feed 1080x1350';
alter table public.post_ideas add column if not exists scheduled_at timestamptz;
alter table public.post_ideas add column if not exists suggested_at timestamptz;
alter table public.post_ideas add column if not exists priority integer default 100;
alter table public.post_ideas add column if not exists predicted_score integer;
alter table public.post_ideas add column if not exists focus_mode text;
alter table public.post_ideas add column if not exists content_pillar text;
alter table public.post_ideas add column if not exists engagement_goal text;
alter table public.post_ideas add column if not exists target_audience text;
alter table public.post_ideas add column if not exists buyer_objection text;
alter table public.post_ideas add column if not exists proof_or_argument text;
alter table public.post_ideas add column if not exists connection_angle text;
alter table public.post_ideas add column if not exists informational_value text;
alter table public.post_ideas add column if not exists story_frequency text;
alter table public.post_ideas add column if not exists use_authority_photo boolean default false;
alter table public.post_ideas add column if not exists authority_photo_reason text;
alter table public.post_ideas add column if not exists carousel_task_count integer;
alter table public.post_ideas add column if not exists video_complement text;
alter table public.post_ideas add column if not exists why_this_post_matters text;
alter table public.post_ideas add column if not exists brand_score integer;
alter table public.post_ideas add column if not exists notes text;
alter table public.post_ideas add column if not exists prompt_seed text;
alter table public.post_ideas add column if not exists status text not null default 'rascunho';
alter table public.post_ideas add column if not exists ai_response_json jsonb not null default '{}'::jsonb;
alter table public.post_ideas add column if not exists approved_at timestamptz;
alter table public.post_ideas add column if not exists archived_at timestamptz;
alter table public.post_ideas add column if not exists deleted_at timestamptz;
alter table public.post_ideas add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.post_ideas add column if not exists created_at timestamptz not null default now();
alter table public.post_ideas add column if not exists updated_at timestamptz not null default now();

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  campaign_id uuid,
  monthly_plan_id uuid,
  post_idea_id uuid,
  source_idea_id uuid,
  title text not null default 'Post MYINC',
  theme text,
  headline text,
  short_text text,
  objective text,
  channel text not null default 'Instagram',
  format text not null default 'Feed 1080x1350',
  status text not null default 'rascunho',
  status_reason text,
  scheduled_at timestamptz,
  approved_at timestamptz,
  caption text,
  hashtags text[] default '{}'::text[],
  cta text,
  image_prompt text,
  video_prompt text,
  creative_brief text,
  master_prompt text,
  media_url text,
  carousel_media_urls text[] not null default '{}'::text[],
  video_url text,
  batch_id uuid,
  quality_score integer default 0,
  quality_review jsonb not null default '{}'::jsonb,
  error_message text,
  technical_detail text,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts add column if not exists brand_id uuid;
alter table public.posts add column if not exists campaign_id uuid;
alter table public.posts add column if not exists monthly_plan_id uuid;
alter table public.posts add column if not exists post_idea_id uuid;
alter table public.posts add column if not exists source_idea_id uuid;
alter table public.posts add column if not exists title text default 'Post MYINC';
alter table public.posts add column if not exists theme text;
alter table public.posts add column if not exists headline text;
alter table public.posts add column if not exists short_text text;
alter table public.posts add column if not exists objective text;
alter table public.posts add column if not exists channel text default 'Instagram';
alter table public.posts add column if not exists format text default 'Feed 1080x1350';
alter table public.posts add column if not exists status text default 'rascunho';
alter table public.posts add column if not exists status_reason text;
alter table public.posts add column if not exists scheduled_at timestamptz;
alter table public.posts add column if not exists approved_at timestamptz;
alter table public.posts add column if not exists approved_by uuid;
alter table public.posts add column if not exists published_at timestamptz;
alter table public.posts add column if not exists caption text;
alter table public.posts add column if not exists hashtags text[] default '{}'::text[];
alter table public.posts add column if not exists cta text;
alter table public.posts add column if not exists image_prompt text;
alter table public.posts add column if not exists video_prompt text;
alter table public.posts add column if not exists creative_brief text;
alter table public.posts add column if not exists master_prompt text;
alter table public.posts add column if not exists media_url text;
alter table public.posts add column if not exists carousel_media_urls text[] not null default '{}'::text[];
alter table public.posts add column if not exists video_url text;
alter table public.posts add column if not exists video_job_id text;
alter table public.posts add column if not exists video_status text;
alter table public.posts add column if not exists video_progress integer;
alter table public.posts add column if not exists video_poster_url text;
alter table public.posts add column if not exists current_version_id uuid;
alter table public.posts add column if not exists batch_id uuid;
alter table public.posts add column if not exists quality_score integer default 0;
alter table public.posts add column if not exists quality_review jsonb not null default '{}'::jsonb;
alter table public.posts add column if not exists meta_publish_id text;
alter table public.posts add column if not exists meta_post_id text;
alter table public.posts add column if not exists meta_permalink text;
alter table public.posts add column if not exists published_url text;
alter table public.posts add column if not exists error_message text;
alter table public.posts add column if not exists technical_detail text;
alter table public.posts add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.posts add column if not exists archived_at timestamptz;
alter table public.posts add column if not exists deleted_at timestamptz;
alter table public.posts add column if not exists created_at timestamptz not null default now();
alter table public.posts add column if not exists updated_at timestamptz not null default now();

-- Converte posts.hashtags antigo text -> text[] quando necessário.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='posts' and column_name='hashtags' and data_type in ('text','character varying')
  ) then
    alter table public.posts alter column hashtags drop default;
    alter table public.posts alter column hashtags type text[] using case
      when hashtags is null or btrim(hashtags::text) = '' then '{}'::text[]
      else regexp_split_to_array(regexp_replace(hashtags::text, '[#;\n\r]+', ',', 'g'), '\s*,\s*')
    end;
    alter table public.posts alter column hashtags set default '{}'::text[];
  end if;
end $$;

create table if not exists public.prompt_builds (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid,
  post_id uuid,
  job_id uuid,
  build_type text,
  final_prompt text,
  payload jsonb default '{}'::jsonb,
  model_hint text,
  status text default 'created',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.prompt_builds add column if not exists job_id uuid;
alter table public.prompt_builds add column if not exists build_type text;
alter table public.prompt_builds add column if not exists final_prompt text;
alter table public.prompt_builds add column if not exists payload jsonb default '{}'::jsonb;
alter table public.prompt_builds add column if not exists model_hint text;
alter table public.prompt_builds add column if not exists status text default 'created';
alter table public.prompt_builds add column if not exists task text;
alter table public.prompt_builds add column if not exists job_type text;
alter table public.prompt_builds add column if not exists prompt text;
alter table public.prompt_builds add column if not exists input_json jsonb not null default '{}'::jsonb;
alter table public.prompt_builds add column if not exists output_json jsonb not null default '{}'::jsonb;
alter table public.prompt_builds add column if not exists error_message text;
alter table public.prompt_builds add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.prompt_builds add column if not exists created_at timestamptz not null default now();
alter table public.prompt_builds add column if not exists updated_at timestamptz not null default now();

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid,
  post_id uuid,
  parent_job_id uuid,
  batch_id uuid,
  job_type text not null default 'image',
  type text,
  content_type text,
  provider text not null default 'openai',
  status text not null default 'queued',
  priority integer not null default 100,
  progress integer not null default 0,
  input_json jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  prompt_build_id uuid,
  idempotency_key text,
  attempts integer not null default 0,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  locked_by uuid,
  worker_id text,
  locked_at timestamptz,
  heartbeat_at timestamptz,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  finished_at timestamptz,
  failed_at timestamptz,
  next_attempt_at timestamptz,
  error_message text,
  error_code text,
  technical_detail text,
  provider_response jsonb not null default '{}'::jsonb,
  page_number integer,
  item_index integer,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.generation_jobs add column if not exists brand_id uuid;
alter table public.generation_jobs add column if not exists post_id uuid;
alter table public.generation_jobs add column if not exists parent_job_id uuid;
alter table public.generation_jobs add column if not exists batch_id uuid;
alter table public.generation_jobs add column if not exists job_type text not null default 'image';
alter table public.generation_jobs add column if not exists type text;
alter table public.generation_jobs add column if not exists content_type text;
alter table public.generation_jobs add column if not exists provider text not null default 'openai';
alter table public.generation_jobs add column if not exists status text not null default 'queued';
alter table public.generation_jobs add column if not exists priority integer not null default 100;
alter table public.generation_jobs add column if not exists progress integer not null default 0;
alter table public.generation_jobs add column if not exists input_json jsonb not null default '{}'::jsonb;
alter table public.generation_jobs add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.generation_jobs add column if not exists output_json jsonb not null default '{}'::jsonb;
alter table public.generation_jobs add column if not exists result jsonb not null default '{}'::jsonb;
alter table public.generation_jobs add column if not exists prompt_build_id uuid;
alter table public.generation_jobs add column if not exists idempotency_key text;
alter table public.generation_jobs add column if not exists attempts integer not null default 0;
alter table public.generation_jobs add column if not exists attempt_count integer not null default 0;
alter table public.generation_jobs add column if not exists max_attempts integer not null default 3;
alter table public.generation_jobs add column if not exists locked_by uuid;
alter table public.generation_jobs add column if not exists worker_id text;
alter table public.generation_jobs add column if not exists locked_at timestamptz;
alter table public.generation_jobs add column if not exists heartbeat_at timestamptz;
alter table public.generation_jobs add column if not exists available_at timestamptz not null default now();
alter table public.generation_jobs add column if not exists started_at timestamptz;
alter table public.generation_jobs add column if not exists completed_at timestamptz;
alter table public.generation_jobs add column if not exists finished_at timestamptz;
alter table public.generation_jobs add column if not exists failed_at timestamptz;
alter table public.generation_jobs add column if not exists next_attempt_at timestamptz;
alter table public.generation_jobs add column if not exists error_message text;
alter table public.generation_jobs add column if not exists error_code text;
alter table public.generation_jobs add column if not exists technical_detail text;
alter table public.generation_jobs add column if not exists provider_response jsonb not null default '{}'::jsonb;
alter table public.generation_jobs add column if not exists page_number integer;
alter table public.generation_jobs add column if not exists item_index integer;
alter table public.generation_jobs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.generation_jobs add column if not exists archived_at timestamptz;
alter table public.generation_jobs add column if not exists deleted_at timestamptz;
alter table public.generation_jobs add column if not exists created_at timestamptz not null default now();
alter table public.generation_jobs add column if not exists updated_at timestamptz not null default now();

create table if not exists public.worker_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  device_key_hash text not null,
  status text not null default 'offline',
  last_seen_at timestamptz,
  current_job_id uuid,
  app_version text,
  machine_info jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.worker_devices add column if not exists device_key_hash text;
alter table public.worker_devices add column if not exists current_job_id uuid;
alter table public.worker_devices add column if not exists app_version text;
alter table public.worker_devices add column if not exists machine_info jsonb not null default '{}'::jsonb;
alter table public.worker_devices add column if not exists metadata jsonb not null default '{}'::jsonb;
create unique index if not exists worker_devices_key_hash_v60 on public.worker_devices(device_key_hash) where device_key_hash is not null;

create table if not exists public.generation_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  worker_id uuid,
  worker_id_text text,
  event_type text not null,
  status_from text,
  status_to text,
  message text,
  data jsonb not null default '{}'::jsonb,
  detail jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.generation_job_events add column if not exists worker_id_text text;
alter table public.generation_job_events add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.generation_job_events add column if not exists detail jsonb not null default '{}'::jsonb;
alter table public.generation_job_events add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  post_id uuid,
  job_id uuid,
  name text not null,
  type text,
  asset_role text,
  media_type text not null default 'image',
  bucket text,
  path text,
  url text,
  public_url text,
  preview_url text,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  duration_seconds integer,
  status text not null default 'ready',
  tags text[] not null default '{}'::text[],
  notes text,
  origin text,
  campaign text,
  format text,
  related_campaign_id uuid,
  usage_context text,
  ai_allowed boolean not null default true,
  uploaded_at timestamptz,
  storage_bucket text,
  storage_path text,
  is_final boolean not null default false,
  used_in_publish boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.media_assets add column if not exists job_id uuid;
alter table public.media_assets add column if not exists asset_role text;
alter table public.media_assets add column if not exists preview_url text;
alter table public.media_assets add column if not exists is_final boolean not null default false;
alter table public.media_assets add column if not exists used_in_publish boolean not null default false;
alter table public.media_assets add column if not exists storage_bucket text;
alter table public.media_assets add column if not exists storage_path text;

create table if not exists public.generation_job_assets (
  id uuid primary key default gen_random_uuid(),
  job_id uuid,
  post_id uuid,
  brand_id uuid,
  media_asset_id uuid,
  asset_type text,
  page_number integer,
  storage_bucket text,
  storage_path text,
  bucket text,
  path text,
  url text,
  public_url text,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  bytes integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);
alter table public.generation_job_assets add column if not exists media_asset_id uuid;
alter table public.generation_job_assets add column if not exists bucket text;
alter table public.generation_job_assets add column if not exists path text;
alter table public.generation_job_assets add column if not exists url text;
alter table public.generation_job_assets add column if not exists public_url text;
alter table public.generation_job_assets add column if not exists bytes integer;

create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  media_asset_id uuid,
  name text not null,
  item_type text not null default 'reference',
  type text,
  media_type text,
  asset_role text,
  bucket text,
  path text,
  url text,
  source_url text,
  public_url text,
  notes text,
  tags text[] not null default '{}'::text[],
  ai_usage_rule text not null default 'allowed',
  status text not null default 'active',
  ai_allowed boolean not null default true,
  uploaded_at timestamptz,
  storage_bucket text,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  forbidden_reason text,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.library_items add column if not exists asset_role text;
alter table public.library_items add column if not exists type text;
alter table public.library_items add column if not exists media_type text;
alter table public.library_items add column if not exists source_url text;
alter table public.library_items add column if not exists ai_allowed boolean not null default true;
alter table public.library_items add column if not exists storage_bucket text;
alter table public.library_items add column if not exists storage_path text;
alter table public.library_items add column if not exists forbidden_reason text;

create table if not exists public.post_versions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  brand_id uuid not null,
  version_number integer not null default 1,
  version_label text not null default 'v1',
  is_current boolean not null default false,
  source text not null default 'system',
  caption text,
  image_prompt text,
  media_url text,
  carousel_media_urls text[] not null default '{}'::text[],
  video_url text,
  output_json jsonb not null default '{}'::jsonb,
  prompt_used text,
  quality_score integer,
  human_feedback text,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);
alter table public.post_versions add column if not exists carousel_media_urls text[] not null default '{}'::text[];
alter table public.post_versions add column if not exists video_url text;
alter table public.post_versions add column if not exists human_feedback text;
alter table public.post_versions add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.post_versions add column if not exists updated_at timestamptz default now();

create table if not exists public.content_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  brand_id uuid,
  user_id uuid,
  author_name text,
  author text,
  comment text,
  message text,
  body text,
  type text not null default 'human_feedback',
  status text not null default 'aberto',
  resolved boolean not null default false,
  feedback_for_ai boolean default true,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);
alter table public.content_comments add column if not exists brand_id uuid;
alter table public.content_comments add column if not exists author_name text;
alter table public.content_comments add column if not exists author text;
alter table public.content_comments add column if not exists message text;
alter table public.content_comments add column if not exists body text;
alter table public.content_comments add column if not exists status text not null default 'aberto';
alter table public.content_comments add column if not exists feedback_for_ai boolean default true;
alter table public.content_comments add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.content_comments add column if not exists archived_at timestamptz;
alter table public.content_comments add column if not exists deleted_at timestamptz;
alter table public.content_comments add column if not exists updated_at timestamptz default now();

create table if not exists public.publish_queue (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid,
  post_id uuid not null,
  channel text not null default 'Instagram',
  mode text,
  status text not null default 'scheduled',
  scheduled_at timestamptz,
  published_at timestamptz,
  attempt_count integer not null default 0,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  locked_at timestamptz,
  locked_by text,
  next_attempt_at timestamptz,
  media_asset_id uuid,
  payload jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  meta_response_json jsonb not null default '{}'::jsonb,
  error_message text,
  last_error text,
  idempotency_key text,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.publish_queue add column if not exists mode text;
alter table public.publish_queue add column if not exists attempts integer not null default 0;
alter table public.publish_queue add column if not exists locked_by text;
alter table public.publish_queue add column if not exists next_attempt_at timestamptz;
alter table public.publish_queue add column if not exists meta_response_json jsonb not null default '{}'::jsonb;
alter table public.publish_queue add column if not exists last_error text;
alter table public.publish_queue add column if not exists idempotency_key text;
alter table public.publish_queue add column if not exists cancelled_at timestamptz;

create table if not exists public.publish_logs (
  id uuid primary key default gen_random_uuid(),
  publish_queue_id uuid,
  post_id uuid,
  brand_id uuid,
  channel text,
  status text not null,
  message text,
  technical_detail text,
  response_json jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create table if not exists public.system_logs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid,
  user_id uuid,
  post_id uuid,
  module text not null default 'system',
  type text not null default 'event',
  severity text not null default 'info',
  status text not null default 'ok',
  friendly_message text,
  technical_detail text,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);
alter table public.system_logs add column if not exists user_id uuid;
alter table public.system_logs add column if not exists severity text not null default 'info';
alter table public.system_logs add column if not exists updated_at timestamptz default now();

-- Defaults defensivos para JSON/arrays usados pelo código.
alter table public.posts alter column hashtags set default '{}'::text[];
alter table public.posts alter column carousel_media_urls set default '{}'::text[];
alter table public.posts alter column quality_review set default '{}'::jsonb;
alter table public.generation_jobs alter column input_json set default '{}'::jsonb;
alter table public.generation_jobs alter column payload set default '{}'::jsonb;
alter table public.generation_jobs alter column output_json set default '{}'::jsonb;
alter table public.generation_jobs alter column result set default '{}'::jsonb;
alter table public.generation_jobs alter column provider_response set default '{}'::jsonb;

-- ================================================================
-- 2) ÍNDICES
-- ================================================================

create index if not exists post_ideas_brand_plan_status_v60 on public.post_ideas(brand_id, monthly_plan_id, status, priority, created_at);
create index if not exists posts_brand_status_v60 on public.posts(brand_id, status, updated_at desc);
create index if not exists posts_source_idea_v60 on public.posts(source_idea_id) where source_idea_id is not null;
create index if not exists posts_post_idea_v60 on public.posts(post_idea_id) where post_idea_id is not null;
create index if not exists generation_jobs_status_available_v60 on public.generation_jobs(status, available_at, priority, created_at);
create index if not exists generation_jobs_post_v60 on public.generation_jobs(post_id, created_at desc);
create unique index if not exists generation_jobs_idempotency_v60 on public.generation_jobs(idempotency_key) where idempotency_key is not null;
create index if not exists generation_job_events_job_v60 on public.generation_job_events(job_id, created_at desc);
create index if not exists generation_job_assets_job_v60 on public.generation_job_assets(job_id, created_at desc);
create index if not exists media_assets_post_v60 on public.media_assets(post_id, created_at desc);
create index if not exists publish_queue_due_v60 on public.publish_queue(status, scheduled_at, attempt_count);

-- ================================================================
-- 3) STORAGE: BUCKETS E POLICIES COMPATÍVEIS COM FRONT/IA/META
-- ================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('creative-media', 'creative-media', true, 104857600, array['image/png','image/jpeg','image/webp','video/mp4','video/webm','video/quicktime']::text[]),
  ('brand-assets', 'brand-assets', true, 52428800, array['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf']::text[]),
  ('library', 'library', true, 104857600, array['image/png','image/jpeg','image/webp','video/mp4','video/webm','application/pdf']::text[])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "creative-media public read" on storage.objects;
create policy "creative-media public read" on storage.objects for select to public using (bucket_id = 'creative-media');

drop policy if exists "brand-assets public read" on storage.objects;
create policy "brand-assets public read" on storage.objects for select to public using (bucket_id = 'brand-assets');

drop policy if exists "library public read" on storage.objects;
create policy "library public read" on storage.objects for select to public using (bucket_id = 'library');

drop policy if exists "authenticated manage myinc public buckets" on storage.objects;
create policy "authenticated manage myinc public buckets" on storage.objects for all to authenticated
using (bucket_id in ('creative-media','brand-assets','library'))
with check (bucket_id in ('creative-media','brand-assets','library'));

-- ================================================================
-- 4) RPCS DE APROVAÇÃO -> POSTS -> FILA
-- ================================================================

drop function if exists public.approve_all_post_ideas(uuid, uuid, boolean) cascade;
create or replace function public.approve_all_post_ideas(
  p_brand_id uuid default null,
  p_monthly_plan_id uuid default null,
  p_only_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.post_ideas pi
  set status = 'tema_aprovado',
      approved_at = coalesce(pi.approved_at, now()),
      archived_at = null,
      updated_at = now()
  where (p_brand_id is null or pi.brand_id = p_brand_id)
    and (p_monthly_plan_id is null or pi.monthly_plan_id = p_monthly_plan_id)
    and (not p_only_active or (pi.archived_at is null and pi.deleted_at is null))
    and coalesce(pi.status, 'rascunho') not in ('reprovado','arquivado','excluido','excluído','deleted','deletado');
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'approved', v_count);
end;
$$;

drop function if exists public.convert_approved_ideas_to_posts(uuid, uuid, boolean) cascade;
create or replace function public.convert_approved_ideas_to_posts(
  p_brand_id uuid default null,
  p_monthly_plan_id uuid default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_idea record;
  v_post_id uuid;
  v_batch_id uuid := gen_random_uuid();
  v_created integer := 0;
  v_updated integer := 0;
  v_post_ids uuid[] := '{}'::uuid[];
  v_caption text;
  v_master_prompt text;
begin
  for v_idea in
    select *
    from public.post_ideas pi
    where (p_brand_id is null or pi.brand_id = p_brand_id)
      and (p_monthly_plan_id is null or pi.monthly_plan_id = p_monthly_plan_id)
      and pi.archived_at is null
      and pi.deleted_at is null
      and coalesce(pi.status, '') in ('tema_aprovado','aprovado','approved')
    order by coalesce(pi.priority, 999999), pi.created_at
  loop
    v_caption := concat_ws(E'\n\n', nullif(v_idea.short_text, ''), nullif(v_idea.cta, ''));
    v_master_prompt := concat_ws(E'\n\n',
      'POST MYINC GERADO A PARTIR DO PLANEJAMENTO',
      'Tema: ' || coalesce(v_idea.theme, v_idea.title, ''),
      'Headline: ' || coalesce(v_idea.headline, ''),
      'Ideia visual: ' || coalesce(v_idea.visual_idea, ''),
      'Prompt inicial: ' || coalesce(v_idea.initial_prompt, '')
    );

    if v_idea.converted_post_id is not null and not p_force then
      v_post_id := v_idea.converted_post_id;
      v_post_ids := array_append(v_post_ids, v_post_id);
      continue;
    end if;

    select p.id into v_post_id
    from public.posts p
    where p.source_idea_id = v_idea.id or p.post_idea_id = v_idea.id
    order by p.created_at asc
    limit 1;

    if v_post_id is null then
      insert into public.posts(
        brand_id, campaign_id, monthly_plan_id, post_idea_id, source_idea_id,
        title, theme, headline, short_text, objective, channel, format,
        scheduled_at, approved_at, caption, hashtags, cta,
        image_prompt, video_prompt, creative_brief, master_prompt,
        status, batch_id, quality_score, quality_review, metadata
      ) values (
        v_idea.brand_id, v_idea.campaign_id, v_idea.monthly_plan_id, v_idea.id, v_idea.id,
        coalesce(nullif(v_idea.title, ''), nullif(v_idea.theme, ''), 'Post MYINC'),
        v_idea.theme, v_idea.headline, v_idea.short_text, v_idea.objective,
        coalesce(nullif(v_idea.channel, ''), 'Instagram'),
        coalesce(nullif(v_idea.format, ''), 'Feed 1080x1350'),
        coalesce(v_idea.scheduled_at, v_idea.suggested_at),
        coalesce(v_idea.approved_at, now()),
        v_caption,
        '{}'::text[],
        v_idea.cta,
        coalesce(nullif(v_idea.initial_prompt, ''), nullif(v_idea.visual_idea, '')),
        v_idea.video_complement,
        v_idea.visual_idea,
        v_master_prompt,
        'em_producao',
        v_batch_id,
        coalesce(v_idea.predicted_score, v_idea.brand_score, 85),
        jsonb_build_object('source', 'convert_approved_ideas_to_posts_v6', 'needs_media', true),
        jsonb_build_object('source_idea_id', v_idea.id, 'converted_by', 'v6_patch')
      ) returning id into v_post_id;
      v_created := v_created + 1;
    else
      update public.posts
      set title = coalesce(nullif(v_idea.title, ''), posts.title),
          theme = coalesce(v_idea.theme, posts.theme),
          headline = coalesce(v_idea.headline, posts.headline),
          short_text = coalesce(v_idea.short_text, posts.short_text),
          objective = coalesce(v_idea.objective, posts.objective),
          channel = coalesce(nullif(v_idea.channel, ''), posts.channel),
          format = coalesce(nullif(v_idea.format, ''), posts.format),
          scheduled_at = coalesce(v_idea.scheduled_at, v_idea.suggested_at, posts.scheduled_at),
          approved_at = coalesce(posts.approved_at, v_idea.approved_at, now()),
          caption = coalesce(nullif(v_caption, ''), posts.caption),
          cta = coalesce(v_idea.cta, posts.cta),
          image_prompt = coalesce(nullif(v_idea.initial_prompt, ''), nullif(v_idea.visual_idea, ''), posts.image_prompt),
          video_prompt = coalesce(v_idea.video_complement, posts.video_prompt),
          creative_brief = coalesce(v_idea.visual_idea, posts.creative_brief),
          master_prompt = coalesce(nullif(v_master_prompt, ''), posts.master_prompt),
          status = case when posts.status in ('publicado','agendado') then posts.status else 'em_producao' end,
          batch_id = coalesce(posts.batch_id, v_batch_id),
          error_message = null,
          technical_detail = null,
          updated_at = now()
      where posts.id = v_post_id;
      v_updated := v_updated + 1;
    end if;

    update public.post_ideas
    set converted_post_id = v_post_id,
        status = 'enviado_producao',
        approved_at = coalesce(approved_at, now()),
        updated_at = now()
    where id = v_idea.id;

    v_post_ids := array_append(v_post_ids, v_post_id);
  end loop;

  return jsonb_build_object('ok', true, 'batch_id', v_batch_id, 'created', v_created, 'updated', v_updated, 'post_ids', v_post_ids);
end;
$$;

-- ================================================================
-- 5) RPCS DO MOTOR LOCAL / FILA
-- ================================================================

create or replace function public.validate_worker(p_worker_id uuid, p_device_key_hash text)
returns public.worker_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker public.worker_devices;
begin
  select * into v_worker
  from public.worker_devices
  where id = p_worker_id
    and device_key_hash = p_device_key_hash
    and deleted_at is null;
  if not found then
    raise exception 'worker inválido ou chave incorreta';
  end if;
  return v_worker;
end;
$$;

create or replace function public.register_worker_device(p_name text, p_device_key_hash text, p_app_version text, p_machine_info jsonb)
returns public.worker_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker public.worker_devices;
begin
  if coalesce(trim(p_device_key_hash), '') = '' then
    raise exception 'device_key_hash obrigatório';
  end if;

  insert into public.worker_devices(name, device_key_hash, status, last_seen_at, app_version, machine_info, metadata)
  values (coalesce(nullif(trim(p_name), ''), 'MYINC Local Engine'), p_device_key_hash, 'online', now(), p_app_version, coalesce(p_machine_info, '{}'::jsonb), jsonb_build_object('source','register_worker_device_v6'))
  on conflict (device_key_hash) where device_key_hash is not null
  do update set name = excluded.name,
                status = 'online',
                last_seen_at = now(),
                app_version = excluded.app_version,
                machine_info = excluded.machine_info,
                updated_at = now()
  returning * into v_worker;
  return v_worker;
end;
$$;

create or replace function public.worker_heartbeat(p_worker_id uuid, p_device_key_hash text)
returns public.worker_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker public.worker_devices;
begin
  v_worker := public.validate_worker(p_worker_id, p_device_key_hash);
  update public.worker_devices
  set status = 'online', last_seen_at = now(), updated_at = now()
  where id = p_worker_id
  returning * into v_worker;

  update public.generation_jobs
  set heartbeat_at = now(), updated_at = now()
  where locked_by = p_worker_id and status = 'processing';
  return v_worker;
end;
$$;

create or replace function public.requeue_stale_generation_jobs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.generation_jobs
  set status = 'retrying',
      locked_by = null,
      worker_id = null,
      locked_at = null,
      heartbeat_at = null,
      available_at = now(),
      error_message = coalesce(error_message, 'Lock antigo liberado automaticamente'),
      updated_at = now()
  where status = 'processing'
    and locked_at < now() - interval '15 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.claim_next_generation_job(p_worker_id uuid, p_device_key_hash text)
returns public.generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.generation_jobs;
  v_old_status text;
begin
  perform public.validate_worker(p_worker_id, p_device_key_hash);
  perform public.requeue_stale_generation_jobs();

  select * into v_job
  from public.generation_jobs
  where status in ('queued','retrying')
    and coalesce(available_at, now()) <= now()
    and deleted_at is null
  order by priority asc, created_at asc
  for update skip locked
  limit 1;

  if not found then
    update public.worker_devices
    set current_job_id = null, status = 'idle', last_seen_at = now(), updated_at = now()
    where id = p_worker_id;
    return null;
  end if;

  v_old_status := v_job.status;
  update public.generation_jobs
  set status = 'processing',
      progress = 5,
      locked_by = p_worker_id,
      worker_id = p_worker_id::text,
      locked_at = now(),
      heartbeat_at = now(),
      started_at = coalesce(started_at, now()),
      attempt_count = coalesce(attempt_count, 0) + 1,
      attempts = coalesce(attempts, 0) + 1,
      updated_at = now()
  where id = v_job.id
  returning * into v_job;

  update public.worker_devices
  set current_job_id = v_job.id, status = 'processing', last_seen_at = now(), updated_at = now()
  where id = p_worker_id;

  insert into public.generation_job_events(job_id, worker_id, worker_id_text, event_type, status_from, status_to, message, data)
  values(v_job.id, p_worker_id, p_worker_id::text, 'claimed', v_old_status, 'processing', 'Job travado pelo motor local', jsonb_build_object('attempt_count', v_job.attempt_count));
  return v_job;
end;
$$;

create or replace function public.complete_generation_job(p_worker_id uuid, p_device_key_hash text, p_job_id uuid, p_output_json jsonb)
returns public.generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.generation_jobs;
begin
  perform public.validate_worker(p_worker_id, p_device_key_hash);
  update public.generation_jobs
  set status = 'completed',
      progress = 100,
      output_json = coalesce(p_output_json, '{}'::jsonb),
      result = coalesce(p_output_json, '{}'::jsonb),
      completed_at = now(),
      finished_at = now(),
      locked_by = null,
      worker_id = null,
      locked_at = null,
      heartbeat_at = null,
      error_message = null,
      error_code = null,
      technical_detail = null,
      updated_at = now()
  where id = p_job_id and locked_by = p_worker_id
  returning * into v_job;

  if not found then
    raise exception 'job não pertence ao worker ou não existe';
  end if;

  update public.worker_devices
  set current_job_id = null, status = 'online', last_seen_at = now(), updated_at = now()
  where id = p_worker_id;

  insert into public.generation_job_events(job_id, worker_id, worker_id_text, event_type, status_from, status_to, message, data)
  values(p_job_id, p_worker_id, p_worker_id::text, 'completed', 'processing', 'completed', 'Job concluído pelo motor local', coalesce(p_output_json, '{}'::jsonb));
  return v_job;
end;
$$;

create or replace function public.fail_generation_job(p_worker_id uuid, p_device_key_hash text, p_job_id uuid, p_error_message text, p_error_code text, p_provider_response jsonb)
returns public.generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.generation_jobs;
  v_next_status text;
  v_available_at timestamptz;
begin
  perform public.validate_worker(p_worker_id, p_device_key_hash);
  select * into v_job
  from public.generation_jobs
  where id = p_job_id and locked_by = p_worker_id
  for update;
  if not found then
    raise exception 'job não pertence ao worker ou não existe';
  end if;

  if coalesce(v_job.attempt_count, 0) < coalesce(v_job.max_attempts, 3) then
    v_next_status := 'retrying';
    v_available_at := now() + make_interval(secs => least(900, greatest(30, coalesce(v_job.attempt_count, 1) * 60)));
  else
    v_next_status := 'failed';
    v_available_at := now();
  end if;

  update public.generation_jobs
  set status = v_next_status,
      progress = case when v_next_status = 'failed' then 100 else 0 end,
      failed_at = case when v_next_status = 'failed' then now() else failed_at end,
      locked_by = null,
      worker_id = null,
      locked_at = null,
      heartbeat_at = null,
      available_at = v_available_at,
      next_attempt_at = v_available_at,
      error_message = p_error_message,
      error_code = p_error_code,
      provider_response = coalesce(p_provider_response, '{}'::jsonb),
      technical_detail = p_error_message,
      updated_at = now()
  where id = p_job_id
  returning * into v_job;

  update public.worker_devices
  set current_job_id = null, status = 'online', last_seen_at = now(), updated_at = now()
  where id = p_worker_id;

  if v_next_status = 'failed' and v_job.post_id is not null then
    update public.posts
    set status = 'erro_ia', error_message = p_error_message, technical_detail = p_error_message, updated_at = now()
    where id = v_job.post_id;
  end if;

  insert into public.generation_job_events(job_id, worker_id, worker_id_text, event_type, status_from, status_to, message, data)
  values(p_job_id, p_worker_id, p_worker_id::text, 'failed', 'processing', v_next_status, p_error_message, jsonb_build_object('error_code', p_error_code));
  return v_job;
end;
$$;

create or replace function public.build_prompt_payload(p_post_id uuid, p_job_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.posts;
  v_profile jsonb := '{}'::jsonb;
  v_rules jsonb := '[]'::jsonb;
  v_templates jsonb := '[]'::jsonb;
  v_refs jsonb := '[]'::jsonb;
  v_final_prompt text;
  v_size text;
  v_payload jsonb;
  v_prompt_id uuid;
begin
  select * into v_post from public.posts where id = p_post_id;
  if not found then
    raise exception 'post não encontrado';
  end if;

  select coalesce(to_jsonb(bp), '{}'::jsonb) into v_profile from public.brand_profiles bp where bp.brand_id = v_post.brand_id limit 1;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.priority desc), '[]'::jsonb) into v_rules from public.ai_brain_rules r where r.brand_id = v_post.brand_id and coalesce(r.active, true) = true and r.deleted_at is null and r.archived_at is null;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.version desc), '[]'::jsonb) into v_templates from public.ai_prompt_templates t where (t.brand_id = v_post.brand_id or t.brand_id is null) and coalesce(t.active, true) = true and t.deleted_at is null and t.archived_at is null;
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_refs from (
    select id, name, item_type, type, media_type, public_url, url, notes, tags, ai_usage_rule, usage_context
    from public.library_items l
    where l.brand_id = v_post.brand_id
      and l.deleted_at is null
      and l.archived_at is null
      and coalesce(l.ai_allowed, true) = true
      and coalesce(l.ai_usage_rule, 'allowed') <> 'blocked'
    order by l.created_at desc
    limit 20
  ) x;

  v_size := case
    when lower(coalesce(v_post.format, '')) like '%story%' or lower(coalesce(v_post.format, '')) like '%reels%' or lower(coalesce(v_post.format, '')) like '%vídeo%' or lower(coalesce(v_post.format, '')) like '%video%' then '1024x1536'
    when lower(coalesce(v_post.format, '')) like '%quadrado%' or lower(coalesce(v_post.format, '')) like '%1080x1080%' then '1024x1024'
    when lower(coalesce(v_post.format, '')) like '%facebook%' or lower(coalesce(v_post.format, '')) like '%horizontal%' then '1536x1024'
    else '1024x1536'
  end;

  v_final_prompt := concat_ws(E'\n\n',
    'Você é o Cérebro IA MYINC, social media premium para incorporadora/construtora.',
    'TIPO DE JOB: ' || coalesce(p_job_type, 'image'),
    'CANAL/FORMATO: ' || coalesce(v_post.channel, 'Instagram') || ' / ' || coalesce(v_post.format, 'Feed 1080x1350'),
    'TÍTULO: ' || coalesce(v_post.title, ''),
    'TEMA: ' || coalesce(v_post.theme, ''),
    'HEADLINE: ' || coalesce(v_post.headline, ''),
    'OBJETIVO: ' || coalesce(v_post.objective, ''),
    'COPY ATUAL: ' || coalesce(v_post.caption, v_post.short_text, ''),
    'CTA: ' || coalesce(v_post.cta, ''),
    'BRIEF CRIATIVO: ' || coalesce(v_post.creative_brief, ''),
    'PROMPT VISUAL BASE: ' || coalesce(v_post.image_prompt, ''),
    'MANTRA/PERFIL DA MARCA: ' || coalesce(v_profile->>'mantra', v_profile->>'preferred_visual_style', 'Visual claro/lite, premium, arquitetura realista, alto padrão, elegante.'),
    'REGRAS DO CÉREBRO IA: ' || v_rules::text,
    'TEMPLATES: ' || v_templates::text,
    'REFERÊNCIAS APROVADAS: ' || v_refs::text,
    'REGRAS FIXAS: sem texto distorcido na imagem; sem logo falso; sem watermark; sem poluição visual; composição editorial; luz natural; alto padrão; pronto para Instagram/Facebook.'
  );

  insert into public.prompt_builds(brand_id, post_id, build_type, job_type, task, final_prompt, prompt, payload, input_json, model_hint, status, metadata)
  values(v_post.brand_id, p_post_id, p_job_type, p_job_type, p_job_type, v_final_prompt, v_final_prompt, '{}'::jsonb, '{}'::jsonb,
    case when p_job_type = 'content' then 'gpt-4o-mini' else 'gpt-image-1' end,
    'created', jsonb_build_object('source', 'build_prompt_payload_v6'))
  returning id into v_prompt_id;

  v_payload := jsonb_build_object(
    'task', p_job_type,
    'brand_id', v_post.brand_id,
    'post_id', v_post.id,
    'format', v_post.format,
    'channel', v_post.channel,
    'size', v_size,
    'model', case when p_job_type = 'content' then 'gpt-4o-mini' else 'gpt-image-1' end,
    'quality', 'high',
    'format_output', 'png',
    'final_prompt', v_final_prompt,
    'prompt', v_final_prompt,
    'negative_prompt', 'texto distorcido, logo falso, watermark, baixa resolução, neon, infantil, poluído, panfleto, amador',
    'references', v_refs,
    'post', to_jsonb(v_post),
    'post_context', to_jsonb(v_post),
    'brand_context', v_profile,
    'rules', v_rules,
    'templates', v_templates,
    'prompt_build_id', v_prompt_id
  );

  update public.prompt_builds
  set payload = v_payload, input_json = v_payload, updated_at = now()
  where id = v_prompt_id;
  return v_payload;
end;
$$;

create or replace function public.enqueue_post_generation(p_post_id uuid, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.posts;
  v_batch uuid;
  v_payload jsonb;
  v_page integer;
  v_pages integer;
  v_inserted integer := 0;
  v_total integer := 0;
  v_key text;
  v_job_type text;
begin
  select * into v_post from public.posts where id = p_post_id and deleted_at is null and archived_at is null;
  if not found then
    raise exception 'post não encontrado ou arquivado';
  end if;

  v_batch := coalesce(v_post.batch_id, gen_random_uuid());
  update public.posts
  set status = 'em_fila', batch_id = v_batch, error_message = null, technical_detail = null, updated_at = now()
  where id = p_post_id;

  -- Sempre atualiza copy/prompt primeiro.
  v_payload := public.build_prompt_payload(p_post_id, 'content');
  v_key := p_post_id::text || ':content' || case when p_force then ':' || gen_random_uuid()::text else '' end;
  insert into public.generation_jobs(brand_id, post_id, batch_id, job_type, type, provider, status, priority, progress, input_json, payload, prompt_build_id, idempotency_key, available_at)
  values(v_post.brand_id, p_post_id, v_batch, 'content', 'content', 'openai', 'queued', 10, 0, v_payload, v_payload, (v_payload->>'prompt_build_id')::uuid, v_key, now())
  on conflict (idempotency_key) where idempotency_key is not null do nothing;
  get diagnostics v_inserted = row_count;
  v_total := v_total + v_inserted;

  if lower(coalesce(v_post.format, '')) like '%carrossel%' then
    v_pages := case when lower(coalesce(v_post.format, '')) like '%8%' then 8 when lower(coalesce(v_post.format, '')) like '%7%' then 7 else 5 end;
    for v_page in 1..v_pages loop
      v_payload := public.build_prompt_payload(p_post_id, 'carousel_page') || jsonb_build_object('page', v_page, 'page_count', v_pages, 'total_pages', v_pages);
      v_key := p_post_id::text || ':carousel:' || v_page || case when p_force then ':' || gen_random_uuid()::text else '' end;
      insert into public.generation_jobs(brand_id, post_id, batch_id, job_type, type, provider, status, priority, progress, input_json, payload, prompt_build_id, idempotency_key, page_number, item_index, available_at)
      values(v_post.brand_id, p_post_id, v_batch, 'carousel_page', 'carousel_page', 'openai', 'queued', 100 + v_page, 0, v_payload, v_payload, (v_payload->>'prompt_build_id')::uuid, v_key, v_page, v_page, now())
      on conflict (idempotency_key) where idempotency_key is not null do nothing;
      get diagnostics v_inserted = row_count;
      v_total := v_total + v_inserted;
    end loop;
  elsif lower(coalesce(v_post.format, '')) like '%reels%' or lower(coalesce(v_post.format, '')) like '%video%' or lower(coalesce(v_post.format, '')) like '%vídeo%' then
    v_job_type := 'video';
    v_payload := public.build_prompt_payload(p_post_id, v_job_type);
    v_key := p_post_id::text || ':video' || case when p_force then ':' || gen_random_uuid()::text else '' end;
    insert into public.generation_jobs(brand_id, post_id, batch_id, job_type, type, provider, status, priority, progress, input_json, payload, prompt_build_id, idempotency_key, available_at)
    values(v_post.brand_id, p_post_id, v_batch, v_job_type, v_job_type, 'openai', 'queued', 100, 0, v_payload, v_payload, (v_payload->>'prompt_build_id')::uuid, v_key, now())
    on conflict (idempotency_key) where idempotency_key is not null do nothing;
    get diagnostics v_inserted = row_count;
    v_total := v_total + v_inserted;
  else
    v_job_type := 'image';
    v_payload := public.build_prompt_payload(p_post_id, v_job_type);
    v_key := p_post_id::text || ':image' || case when p_force then ':' || gen_random_uuid()::text else '' end;
    insert into public.generation_jobs(brand_id, post_id, batch_id, job_type, type, provider, status, priority, progress, input_json, payload, prompt_build_id, idempotency_key, available_at)
    values(v_post.brand_id, p_post_id, v_batch, v_job_type, v_job_type, 'openai', 'queued', 100, 0, v_payload, v_payload, (v_payload->>'prompt_build_id')::uuid, v_key, now())
    on conflict (idempotency_key) where idempotency_key is not null do nothing;
    get diagnostics v_inserted = row_count;
    v_total := v_total + v_inserted;
  end if;

  insert into public.system_logs(brand_id, post_id, module, type, severity, status, friendly_message, technical_detail, metadata)
  values(v_post.brand_id, p_post_id, 'generation-queue', 'queue', 'info', 'ok', 'Jobs criados para motor local.', 'enqueue_post_generation v6 concluído', jsonb_build_object('batch_id', v_batch, 'queued', v_total));

  return jsonb_build_object('ok', true, 'post_id', p_post_id, 'batch_id', v_batch, 'queued', v_total);
end;
$$;

drop function if exists public.approve_convert_enqueue_plan(uuid, uuid, boolean) cascade;
create or replace function public.approve_convert_enqueue_plan(
  p_brand_id uuid default null,
  p_monthly_plan_id uuid default null,
  p_force boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approved jsonb;
  v_converted jsonb;
  v_post_id uuid;
  v_queue jsonb;
  v_queued integer := 0;
  v_results jsonb := '[]'::jsonb;
begin
  v_approved := public.approve_all_post_ideas(p_brand_id, p_monthly_plan_id, true);
  v_converted := public.convert_approved_ideas_to_posts(p_brand_id, p_monthly_plan_id, p_force);

  for v_post_id in select jsonb_array_elements_text(coalesce(v_converted->'post_ids', '[]'::jsonb))::uuid loop
    begin
      v_queue := public.enqueue_post_generation(v_post_id, p_force);
      v_queued := v_queued + coalesce((v_queue->>'queued')::integer, 0);
      v_results := v_results || jsonb_build_array(jsonb_build_object('post_id', v_post_id, 'ok', true, 'result', v_queue));
    exception when others then
      v_results := v_results || jsonb_build_array(jsonb_build_object('post_id', v_post_id, 'ok', false, 'error', sqlerrm));
    end;
  end loop;

  return jsonb_build_object('ok', true, 'approved', v_approved, 'converted', v_converted, 'queued', v_queued, 'results', v_results);
end;
$$;

create or replace function public.list_generation_jobs_light(p_limit integer default 80)
returns table (
  id uuid,
  brand_id uuid,
  post_id uuid,
  batch_id uuid,
  job_type text,
  type text,
  content_type text,
  status text,
  priority integer,
  progress integer,
  attempts integer,
  attempt_count integer,
  max_attempts integer,
  worker_id text,
  error_message text,
  created_at timestamptz,
  updated_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    gj.id,
    gj.brand_id,
    gj.post_id,
    gj.batch_id,
    coalesce(gj.job_type, gj.type, gj.content_type, 'job') as job_type,
    gj.type,
    gj.content_type,
    gj.status,
    gj.priority,
    gj.progress,
    coalesce(gj.attempts, gj.attempt_count, 0) as attempts,
    coalesce(gj.attempt_count, gj.attempts, 0) as attempt_count,
    coalesce(gj.max_attempts, 3) as max_attempts,
    gj.worker_id,
    left(coalesce(gj.error_message, ''), 900) as error_message,
    gj.created_at,
    gj.updated_at,
    gj.started_at,
    gj.completed_at,
    gj.failed_at
  from public.generation_jobs gj
  where gj.deleted_at is null
  order by gj.created_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 80), 200));
$$;

create or replace function public.retry_generation_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.generation_jobs;
begin
  update public.generation_jobs
  set status = 'retrying',
      available_at = now(),
      next_attempt_at = now(),
      locked_by = null,
      worker_id = null,
      locked_at = null,
      heartbeat_at = null,
      progress = 0,
      error_message = null,
      error_code = null,
      technical_detail = null,
      updated_at = now()
  where id = p_job_id
    and status in ('failed','cancelled','erro','erro_ia','retrying')
  returning * into v_job;

  if not found then
    raise exception 'Job não pode ser reenfileirado neste estado';
  end if;

  insert into public.generation_job_events(job_id, event_type, status_to, message, data)
  values(p_job_id, 'retry', 'retrying', 'Reprocessamento solicitado pelo painel', '{}'::jsonb);
  return jsonb_build_object('ok', true, 'job', to_jsonb(v_job));
end;
$$;

create or replace function public.retry_all_failed_generation_jobs(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with picked as (
    select id from public.generation_jobs
    where status in ('failed','cancelled')
    order by updated_at asc nulls first
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  )
  update public.generation_jobs gj
  set status = 'retrying', available_at = now(), next_attempt_at = now(), locked_by = null, worker_id = null, locked_at = null, heartbeat_at = null, progress = 0, error_message = null, updated_at = now()
  from picked
  where gj.id = picked.id;
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'retried', v_count);
end;
$$;

create or replace function public.trigger_worker_now(p_limit integer default 50, p_retry_failed boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retried integer := 0;
  v_queued integer := 0;
begin
  if coalesce(p_retry_failed, false) then
    with picked as (
      select id from public.generation_jobs where status in ('failed','cancelled') order by updated_at asc nulls first limit greatest(1, least(coalesce(p_limit, 50), 200))
    )
    update public.generation_jobs gj
    set status = 'retrying', available_at = now(), next_attempt_at = now(), locked_by = null, worker_id = null, locked_at = null, heartbeat_at = null, progress = 0, error_message = null, updated_at = now()
    from picked where gj.id = picked.id;
    get diagnostics v_retried = row_count;
  end if;

  update public.generation_jobs
  set available_at = now(), updated_at = now()
  where status in ('queued','retrying')
    and coalesce(available_at, now()) > now()
    and id in (
      select id from public.generation_jobs where status in ('queued','retrying') order by priority asc, created_at asc limit greatest(1, least(coalesce(p_limit, 50), 200))
    );

  select count(*) into v_queued from public.generation_jobs where status in ('queued','retrying') and deleted_at is null;
  return jsonb_build_object('ok', true, 'queued', v_queued, 'retried', v_retried, 'message', 'Fila acordada. Deixe o Motor Local ligado para processar.');
end;
$$;

-- ================================================================
-- 6) PERMISSÕES
-- ================================================================

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;

grant execute on function public.approve_all_post_ideas(uuid, uuid, boolean) to anon, authenticated, service_role;
grant execute on function public.convert_approved_ideas_to_posts(uuid, uuid, boolean) to anon, authenticated, service_role;
grant execute on function public.approve_convert_enqueue_plan(uuid, uuid, boolean) to anon, authenticated, service_role;
grant execute on function public.register_worker_device(text, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.worker_heartbeat(uuid, text) to anon, authenticated, service_role;
grant execute on function public.claim_next_generation_job(uuid, text) to anon, authenticated, service_role;
grant execute on function public.complete_generation_job(uuid, text, uuid, jsonb) to anon, authenticated, service_role;
grant execute on function public.fail_generation_job(uuid, text, uuid, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.requeue_stale_generation_jobs() to anon, authenticated, service_role;
grant execute on function public.build_prompt_payload(uuid, text) to anon, authenticated, service_role;
grant execute on function public.enqueue_post_generation(uuid, boolean) to anon, authenticated, service_role;
grant execute on function public.list_generation_jobs_light(integer) to anon, authenticated, service_role;
grant execute on function public.retry_generation_job(uuid) to anon, authenticated, service_role;
grant execute on function public.retry_all_failed_generation_jobs(integer) to anon, authenticated, service_role;
grant execute on function public.trigger_worker_now(integer, boolean) to anon, authenticated, service_role;

-- ================================================================
-- 7) LOG DE INSTALAÇÃO
-- ================================================================

insert into public.system_logs(module, type, severity, status, friendly_message, technical_detail, metadata)
values('migration', 'patch', 'info', 'ok', 'MYINC V6.0 aplicado.', 'Patch completo de estabilização aplicado com sucesso.', jsonb_build_object('patch','MYINC_PATCH_COMPLETO_ESTABILIZACAO_V6_0'));

commit;
