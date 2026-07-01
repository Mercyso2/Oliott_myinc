-- V2 02 - Schema principal em 3 camadas.
create extension if not exists pgcrypto;
create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  full_name text,
  role text not null default 'admin',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.app_users(id) on delete set null,
  name text not null unique,
  public_name text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null unique references public.brands(id) on delete cascade,
  site text, instagram text, facebook text, whatsapp text, commercial_email text, region text, niche text, segment text,
  primary_audience text, secondary_audience text, persona text, problems_solved text, benefits text, differentiators text,
  products text, services text, average_ticket text, objections text, guarantees text, social_proof text, cases text,
  testimonials text, faq text, tone text, communication_style text, primary_palette text, secondary_palette text,
  forbidden_colors text, brand_fonts text, preferred_visual_style text, forbidden_visual_style text, logo_rules text,
  composition_rules text, image_text_rules text, approved_references text, bad_references text, mantra text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.brand_voice_rules (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id) on delete cascade,
  rule_type text not null, content text not null, active boolean not null default true, priority int not null default 0,
  metadata jsonb not null default '{}'::jsonb, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.brand_visual_rules (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id) on delete cascade,
  rule_type text not null, content text not null, active boolean not null default true, priority int not null default 0,
  metadata jsonb not null default '{}'::jsonb, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.ai_brain_rules (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null, category text not null, content text not null, active boolean not null default true, priority int not null default 0,
  default_content text, metadata jsonb not null default '{}'::jsonb, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(brand_id,name)
);

create table public.ai_prompt_templates (
  id uuid primary key default gen_random_uuid(), brand_id uuid references public.brands(id) on delete cascade,
  name text not null, type text not null default 'general', note text, content text not null, active boolean not null default true,
  version int not null default 1, version_history jsonb not null default '[]'::jsonb, metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(brand_id,name,type)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null, objective text, month int, year int, total_posts int not null default 0, status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.monthly_plans (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null, name text, month int, year int, strategy text,
  prompt_used text, ai_response_json jsonb, total_posts int, status text not null default 'draft', metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.post_ideas (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id) on delete cascade,
  monthly_plan_id uuid references public.monthly_plans(id) on delete cascade, campaign_id uuid references public.campaigns(id) on delete set null,
  title text, theme text, headline text, short_text text, cta text, visual_idea text, initial_prompt text, objective text,
  channel text default 'Instagram', format text default 'Feed 1080x1350', suggested_at timestamptz, priority int default 100,
  predicted_score int, focus_mode text, content_pillar text, engagement_goal text, target_audience text, buyer_objection text,
  proof_or_argument text, connection_angle text, informational_value text, story_frequency text, use_authority_photo boolean default false,
  authority_photo_reason text, carousel_task_count int default 0, video_complement text, why_this_post_matters text, brand_score int,
  status text not null default 'rascunho', ai_response_json jsonb, converted_post_id uuid, approved_at timestamptz, archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null, monthly_plan_id uuid references public.monthly_plans(id) on delete set null,
  source_idea_id uuid references public.post_ideas(id) on delete set null, title text not null, theme text, headline text, short_text text,
  objective text, channel text not null default 'instagram', format text not null default 'Feed 1080x1350', status text not null default 'draft',
  status_reason text, scheduled_at timestamptz, approved_at timestamptz, approved_by uuid references public.app_users(id) on delete set null,
  caption text, hashtags text, cta text, image_prompt text, video_prompt text, creative_brief text, media_url text,
  carousel_media_urls text[] not null default '{}', video_url text, current_version_id uuid, batch_id uuid, quality_score int, quality_review jsonb,
  master_prompt text, error_message text, technical_detail text, metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.prompt_builds (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade, job_id uuid, build_type text not null, final_prompt text not null,
  payload jsonb not null default '{}'::jsonb, model_hint text, status text not null default 'created', created_at timestamptz not null default now()
);

create table public.post_versions (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade, version_number int not null default 1, version_label text,
  is_current boolean not null default false, source text not null default 'system', caption text, image_prompt text, media_url text,
  carousel_media_urls text[] not null default '{}', video_url text, output_json jsonb not null default '{}'::jsonb, prompt_used text,
  quality_score int, created_at timestamptz not null default now()
);

create table public.content_comments (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid references public.app_users(id) on delete set null, comment text not null, type text not null default 'human_feedback',
  resolved boolean not null default false, created_at timestamptz not null default now()
);

create table public.brand_assets (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null, asset_type text not null, bucket text, path text, url text, public_url text, source_url text, notes text,
  asset_role text, usage_context text, ai_allowed boolean not null default true,
  metadata jsonb not null default '{}'::jsonb, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.library_items (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null, item_type text not null default 'reference', bucket text, path text, url text, public_url text, source_url text, notes text,
  tags text[] not null default '{}', ai_usage_rule text not null default 'allowed', status text not null default 'active',
  asset_role text, usage_context text, ai_allowed boolean not null default true,
  metadata jsonb not null default '{}'::jsonb, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null, job_id uuid, name text not null, media_type text not null,
  bucket text, path text, url text, public_url text, source_url text, preview_url text, mime_type text, size_bytes bigint, width int, height int,
  duration_seconds int, status text not null default 'active', tags text[] not null default '{}', origin text, usage_context text,
  asset_role text, ai_allowed boolean not null default true, is_final boolean not null default false, used_in_publish boolean not null default false, notes text,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.worker_devices (
  id uuid primary key default gen_random_uuid(), name text not null, device_key_hash text not null unique, status text not null default 'offline',
  last_seen_at timestamptz, current_job_id uuid, app_version text, machine_info jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade, batch_id uuid, job_type text not null, provider text not null default 'local-engine',
  status text not null default 'queued', priority int not null default 100, progress int not null default 0,
  input_json jsonb not null default '{}'::jsonb, output_json jsonb not null default '{}'::jsonb,
  prompt_build_id uuid references public.prompt_builds(id) on delete set null, idempotency_key text, attempt_count int not null default 0,
  max_attempts int not null default 3, locked_by uuid references public.worker_devices(id) on delete set null, locked_at timestamptz,
  heartbeat_at timestamptz, available_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz,
  failed_at timestamptz, error_message text, error_code text, provider_response jsonb, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists generation_jobs_idempotency_key_idx on public.generation_jobs(idempotency_key) where idempotency_key is not null;
create index if not exists generation_jobs_pick_idx on public.generation_jobs(status, available_at, priority, created_at);
create index if not exists generation_jobs_post_idx on public.generation_jobs(post_id, created_at);

create table public.generation_job_events (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references public.generation_jobs(id) on delete cascade,
  worker_id uuid references public.worker_devices(id) on delete set null, event_type text not null, status_from text, status_to text, message text,
  data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table public.publish_queue (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade, channel text not null default 'instagram', status text not null default 'scheduled',
  scheduled_at timestamptz not null, published_at timestamptz, attempt_count int not null default 0, max_attempts int not null default 3,
  media_asset_id uuid references public.media_assets(id) on delete set null, payload jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb, error_message text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists publish_queue_due_idx on public.publish_queue(status, scheduled_at, attempt_count);

create table public.publish_logs (
  id uuid primary key default gen_random_uuid(), publish_queue_id uuid references public.publish_queue(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null, brand_id uuid references public.brands(id) on delete set null, channel text,
  status text not null, message text, technical_detail text, response_json jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(), brand_id uuid references public.brands(id) on delete cascade,
  key text not null, value jsonb not null default '{}'::jsonb, is_public boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(brand_id,key)
);

create table public.system_logs (
  id uuid primary key default gen_random_uuid(), brand_id uuid references public.brands(id) on delete set null,
  user_id uuid references public.app_users(id) on delete set null, post_id uuid references public.posts(id) on delete set null,
  module text not null, type text not null default 'info', severity text not null default 'info', status text not null default 'ok',
  friendly_message text, technical_detail text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table public.api_connections (
  id uuid primary key default gen_random_uuid(), brand_id uuid references public.brands(id) on delete cascade,
  provider text not null, status text not null default 'not_configured', public_config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(brand_id,provider)
);

-- Compatibilidade mínima com telas antigas.
create table public.brand_color_palette (id uuid primary key default gen_random_uuid(), brand_id uuid references public.brands(id) on delete cascade, name text, value text, active boolean default true, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.brand_products (id uuid primary key default gen_random_uuid(), brand_id uuid references public.brands(id) on delete cascade, name text not null, description text, active boolean default true, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.brand_services (id uuid primary key default gen_random_uuid(), brand_id uuid references public.brands(id) on delete cascade, name text not null, description text, active boolean default true, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.brand_references (id uuid primary key default gen_random_uuid(), brand_id uuid references public.brands(id) on delete cascade, name text not null, notes text, active boolean default true, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.brand_preferred_terms (id uuid primary key default gen_random_uuid(), brand_id uuid references public.brands(id) on delete cascade, term text not null, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.brand_forbidden_terms (id uuid primary key default gen_random_uuid(), brand_id uuid references public.brands(id) on delete cascade, term text not null, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.ai_feedbacks (id uuid primary key default gen_random_uuid(), brand_id uuid references public.brands(id) on delete cascade, post_id uuid references public.posts(id) on delete set null, feedback text, metadata jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.campaign_posts (id uuid primary key default gen_random_uuid(), campaign_id uuid references public.campaigns(id) on delete cascade, post_id uuid references public.posts(id) on delete cascade, created_at timestamptz default now());
create table public.custom_campaign_themes (id uuid primary key default gen_random_uuid(), brand_id uuid references public.brands(id) on delete cascade, name text not null, description text, active boolean default true, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.templates (id uuid primary key default gen_random_uuid(), brand_id uuid references public.brands(id) on delete cascade, name text not null, content jsonb default '{}'::jsonb, active boolean default true, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.settings (id uuid primary key default gen_random_uuid(), key text not null unique, value jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.admin_settings (id uuid primary key default gen_random_uuid(), key text not null unique, value jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now());

do $$
declare r record;
begin
  for r in select table_name from information_schema.columns where table_schema='public' and column_name='updated_at'
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', r.table_name, r.table_name);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', r.table_name, r.table_name);
  end loop;
end $$;
