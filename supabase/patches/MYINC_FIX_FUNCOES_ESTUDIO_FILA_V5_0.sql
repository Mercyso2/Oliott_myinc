-- MYINC V5.0 - FUNÇÕES, RLS E FILA ESTÁVEL PARA ESTÚDIO/FILA
-- Execute no Supabase SQL Editor depois dos patches V4.8/V4.9.
-- Pode executar mais de uma vez.

begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 1) GARANTIR COLUNAS MÍNIMAS PARA A FILA
-- =========================================================

-- Posts mínimos para botões do Estúdio
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid,
  title text default 'Post MYINC',
  status text default 'draft',
  headline text,
  caption text,
  hashtags text[] default '{}',
  cta text,
  image_prompt text,
  creative_brief text,
  media_url text,
  quality_score integer default 0,
  quality_review jsonb default '{}'::jsonb,
  status_reason text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);
alter table public.posts add column if not exists brand_id uuid;
alter table public.posts add column if not exists title text default 'Post MYINC';
alter table public.posts add column if not exists status text default 'draft';
alter table public.posts add column if not exists headline text;
alter table public.posts add column if not exists caption text;
alter table public.posts add column if not exists hashtags text[] default '{}';
alter table public.posts add column if not exists cta text;
alter table public.posts add column if not exists image_prompt text;
alter table public.posts add column if not exists creative_brief text;
alter table public.posts add column if not exists media_url text;
alter table public.posts add column if not exists quality_score integer default 0;
alter table public.posts add column if not exists quality_review jsonb default '{}'::jsonb;
alter table public.posts add column if not exists status_reason text;
alter table public.posts add column if not exists updated_at timestamptz default now();
alter table public.posts add column if not exists created_at timestamptz default now();


create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid,
  post_id uuid,
  batch_id uuid,
  job_type text default 'image',
  type text,
  content_type text,
  provider text default 'local-engine',
  status text default 'queued',
  priority integer default 100,
  progress integer default 0,
  input_json jsonb default '{}'::jsonb,
  payload jsonb default '{}'::jsonb,
  output_json jsonb default '{}'::jsonb,
  result jsonb default '{}'::jsonb,
  idempotency_key text,
  attempts integer default 0,
  attempt_count integer default 0,
  max_attempts integer default 3,
  locked_at timestamptz,
  worker_id text,
  available_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.generation_jobs add column if not exists brand_id uuid;
alter table public.generation_jobs add column if not exists post_id uuid;
alter table public.generation_jobs add column if not exists batch_id uuid;
alter table public.generation_jobs add column if not exists job_type text default 'image';
alter table public.generation_jobs add column if not exists type text;
alter table public.generation_jobs add column if not exists content_type text;
alter table public.generation_jobs add column if not exists provider text default 'local-engine';
alter table public.generation_jobs add column if not exists status text default 'queued';
alter table public.generation_jobs add column if not exists priority integer default 100;
alter table public.generation_jobs add column if not exists progress integer default 0;
alter table public.generation_jobs add column if not exists input_json jsonb default '{}'::jsonb;
alter table public.generation_jobs add column if not exists payload jsonb default '{}'::jsonb;
alter table public.generation_jobs add column if not exists output_json jsonb default '{}'::jsonb;
alter table public.generation_jobs add column if not exists result jsonb default '{}'::jsonb;
alter table public.generation_jobs add column if not exists idempotency_key text;
alter table public.generation_jobs add column if not exists attempts integer default 0;
alter table public.generation_jobs add column if not exists attempt_count integer default 0;
alter table public.generation_jobs add column if not exists max_attempts integer default 3;
alter table public.generation_jobs add column if not exists locked_at timestamptz;
alter table public.generation_jobs add column if not exists worker_id text;
alter table public.generation_jobs add column if not exists available_at timestamptz default now();
alter table public.generation_jobs add column if not exists started_at timestamptz;
alter table public.generation_jobs add column if not exists completed_at timestamptz;
alter table public.generation_jobs add column if not exists failed_at timestamptz;
alter table public.generation_jobs add column if not exists error_message text;
alter table public.generation_jobs add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.generation_jobs add column if not exists created_at timestamptz default now();
alter table public.generation_jobs add column if not exists updated_at timestamptz default now();

create table if not exists public.system_logs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid,
  post_id uuid,
  module text,
  type text,
  status text,
  friendly_message text,
  technical_detail text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- =========================================================
-- 2) ÍNDICES
-- =========================================================

create index if not exists generation_jobs_status_available_v50
  on public.generation_jobs(status, available_at, priority, created_at);

create index if not exists generation_jobs_post_v50
  on public.generation_jobs(post_id, created_at desc);

create unique index if not exists generation_jobs_idempotency_v50
  on public.generation_jobs(idempotency_key)
  where idempotency_key is not null;

-- =========================================================
-- 3) DROPAR FUNÇÕES COM RETORNO ANTIGO
-- =========================================================

drop function if exists public.list_generation_jobs_light(integer) cascade;
drop function if exists public.retry_all_failed_generation_jobs(integer) cascade;
drop function if exists public.retry_generation_job(uuid) cascade;
drop function if exists public.trigger_worker_now(integer, boolean) cascade;

-- =========================================================
-- 4) FUNÇÃO LEVE DA FILA
-- =========================================================

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
  order by gj.created_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 80), 200));
$$;

grant execute on function public.list_generation_jobs_light(integer) to anon, authenticated, service_role;

-- =========================================================
-- 5) FUNÇÕES DE REPROCESSAMENTO
-- =========================================================

create or replace function public.retry_generation_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.generation_jobs
  set
    status = 'queued',
    attempts = 0,
    attempt_count = 0,
    progress = 0,
    error_message = null,
    locked_at = null,
    worker_id = null,
    started_at = null,
    completed_at = null,
    failed_at = null,
    available_at = now(),
    updated_at = now()
  where id = p_job_id;

  get diagnostics v_count = row_count;

  return jsonb_build_object('ok', v_count > 0, 'job_id', p_job_id, 'requeued', v_count);
end;
$$;

grant execute on function public.retry_generation_job(uuid) to anon, authenticated, service_role;

create or replace function public.retry_all_failed_generation_jobs(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.generation_jobs
  set
    status = 'queued',
    attempts = 0,
    attempt_count = 0,
    progress = 0,
    error_message = null,
    locked_at = null,
    worker_id = null,
    started_at = null,
    completed_at = null,
    failed_at = null,
    available_at = now(),
    updated_at = now()
  where id in (
    select id
    from public.generation_jobs
    where lower(coalesce(status, '')) in ('failed', 'erro', 'erro_ia', 'timeout', 'error')
    order by updated_at desc nulls last, created_at desc nulls last
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  );

  get diagnostics v_count = row_count;

  return jsonb_build_object('ok', true, 'requeued', v_count);
end;
$$;

grant execute on function public.retry_all_failed_generation_jobs(integer) to anon, authenticated, service_role;

create or replace function public.trigger_worker_now(p_limit integer default 50, p_retry_failed boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retry jsonb := null;
  v_queued integer := 0;
begin
  if p_retry_failed then
    v_retry := public.retry_all_failed_generation_jobs(p_limit);
  end if;

  update public.generation_jobs
  set
    status = 'queued',
    locked_at = null,
    worker_id = null,
    started_at = null,
    available_at = now(),
    updated_at = now(),
    error_message = null
  where lower(coalesce(status, '')) in ('processing', 'running')
    and locked_at < now() - interval '20 minutes';

  select count(*) into v_queued
  from public.generation_jobs
  where lower(coalesce(status, '')) in ('queued', 'pending', 'retrying');

  return jsonb_build_object('ok', true, 'queued', v_queued, 'retry', v_retry, 'message', 'Fila pronta. O Motor Local processa no próximo polling.');
end;
$$;

grant execute on function public.trigger_worker_now(integer, boolean) to anon, authenticated, service_role;

-- =========================================================
-- 6) RLS/GRANTS
-- =========================================================

alter table public.posts enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.system_logs enable row level security;

drop policy if exists "myinc_posts_all_local_v50" on public.posts;
create policy "myinc_posts_all_local_v50"
on public.posts
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "myinc_generation_jobs_all_local_v50" on public.generation_jobs;
create policy "myinc_generation_jobs_all_local_v50"
on public.generation_jobs
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "myinc_system_logs_all_local_v50" on public.system_logs;
create policy "myinc_system_logs_all_local_v50"
on public.system_logs
for all
to anon, authenticated
using (true)
with check (true);

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.posts to anon, authenticated, service_role;
grant select, insert, update, delete on public.generation_jobs to anon, authenticated, service_role;
grant select, insert, update, delete on public.system_logs to anon, authenticated, service_role;

commit;

-- TESTE FINAL
select public.trigger_worker_now(50, false);
select * from public.list_generation_jobs_light(20);
