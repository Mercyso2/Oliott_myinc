-- V2 08 - Compatibilidade com o frontend base do repositório Mercyso2/myinc.
-- Rode este arquivo depois dos scripts 00..07 se você aplicou o pacote V2 anterior.

alter table if exists public.brands add column if not exists owner_id uuid;

alter table if exists public.posts add column if not exists monthly_plan_id uuid;
alter table if exists public.posts add column if not exists post_idea_id uuid;
alter table if exists public.posts add column if not exists source_idea_id uuid;
alter table if exists public.posts add column if not exists headline text;
alter table if exists public.posts add column if not exists short_text text;
alter table if exists public.posts add column if not exists hashtags text[];
alter table if exists public.posts add column if not exists video_prompt text;
alter table if exists public.posts add column if not exists master_prompt text;
alter table if exists public.posts add column if not exists video_job_id text;
alter table if exists public.posts add column if not exists video_status text;
alter table if exists public.posts add column if not exists video_progress int;
alter table if exists public.posts add column if not exists video_poster_url text;
alter table if exists public.posts add column if not exists technical_detail text;
alter table if exists public.posts add column if not exists quality_review jsonb;
alter table if exists public.posts add column if not exists status_reason text;
alter table if exists public.posts add column if not exists published_at timestamptz;
alter table if exists public.posts add column if not exists meta_publish_id text;
alter table if exists public.posts add column if not exists meta_post_id text;
alter table if exists public.posts add column if not exists meta_permalink text;
alter table if exists public.posts add column if not exists published_url text;
alter table if exists public.posts add column if not exists error_message text;

alter table if exists public.post_versions add column if not exists version_label text;
alter table if exists public.post_versions add column if not exists human_feedback text;
alter table if exists public.post_versions add column if not exists updated_at timestamptz;
alter table if exists public.post_versions alter column version_label set default 'V2';

alter table if exists public.generation_jobs add column if not exists parent_job_id uuid;
alter table if exists public.generation_jobs add column if not exists type text;
alter table if exists public.generation_jobs add column if not exists payload jsonb;
alter table if exists public.generation_jobs add column if not exists result jsonb;
alter table if exists public.generation_jobs add column if not exists technical_detail text;
alter table if exists public.generation_jobs add column if not exists finished_at timestamptz;
alter table if exists public.generation_jobs add column if not exists next_attempt_at timestamptz;
update public.generation_jobs set type = coalesce(type, job_type), payload = coalesce(payload, input_json), result = coalesce(result, output_json) where type is null or payload is null or result is null;

alter table if exists public.publish_queue add column if not exists mode text;
alter table if exists public.publish_queue add column if not exists attempts int default 0;
alter table if exists public.publish_queue add column if not exists locked_at timestamptz;
alter table if exists public.publish_queue add column if not exists locked_by text;
alter table if exists public.publish_queue add column if not exists next_attempt_at timestamptz;
alter table if exists public.publish_queue add column if not exists last_error text;
alter table if exists public.publish_queue add column if not exists idempotency_key text;
alter table if exists public.publish_queue add column if not exists meta_response_json jsonb;
alter table if exists public.publish_queue add column if not exists cancelled_at timestamptz;

-- Garante leitura do painel para status do motor/fila.
drop policy if exists "worker_devices authenticated select" on public.worker_devices;
drop policy if exists "generation_jobs authenticated select" on public.generation_jobs;
create policy "generation_jobs authenticated select" on public.generation_jobs for select to authenticated using (true);
drop policy if exists "generation_job_events authenticated select" on public.generation_job_events;
create policy "generation_job_events authenticated select" on public.generation_job_events for select to authenticated using (true);

