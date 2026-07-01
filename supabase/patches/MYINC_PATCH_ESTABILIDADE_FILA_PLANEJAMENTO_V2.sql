-- MYINC PATCH ESTABILIDADE V2
-- Corrige compatibilidade da fila, retry, jobs antigos quebrados e colunas usadas pelo frontend/motor.

alter table if exists public.generation_jobs add column if not exists type text;
alter table if exists public.generation_jobs add column if not exists payload jsonb not null default '{}'::jsonb;
alter table if exists public.generation_jobs add column if not exists result jsonb not null default '{}'::jsonb;
alter table if exists public.generation_jobs add column if not exists technical_detail text;
alter table if exists public.generation_jobs add column if not exists next_attempt_at timestamptz;

update public.generation_jobs
set type = coalesce(type, job_type)
where type is null;

create index if not exists generation_jobs_status_updated_idx on public.generation_jobs(status, updated_at desc);
create index if not exists generation_jobs_batch_idx on public.generation_jobs(batch_id, created_at desc);

create or replace function public.retry_generation_job(p_job_id uuid)
returns public.generation_jobs
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
      next_attempt_at = null,
      locked_by = null,
      locked_at = null,
      heartbeat_at = null,
      progress = 0,
      error_message = null,
      error_code = null,
      technical_detail = null,
      updated_at = now()
  where id = p_job_id
    and status in ('failed','cancelled','erro','erro_ia')
  returning * into v_job;

  if not found then
    raise exception 'Job não pode ser reenfileirado neste estado';
  end if;

  insert into public.generation_job_events(job_id, event_type, status_to, message, data)
  values(p_job_id, 'retry', 'retrying', 'Reprocessamento solicitado pelo painel', '{}'::jsonb);

  return v_job;
end;
$$;

grant execute on function public.retry_generation_job(uuid) to authenticated, service_role;

-- Limpa falhas antigas causadas pelos bugs já corrigidos neste patch.
update public.generation_jobs
set status = 'retrying',
    available_at = now(),
    next_attempt_at = null,
    locked_by = null,
    locked_at = null,
    heartbeat_at = null,
    progress = 0,
    error_message = null,
    error_code = null,
    technical_detail = null,
    updated_at = now()
where status = 'failed'
  and (
    coalesce(error_message,'') ilike '%response_format%'
    or coalesce(error_message,'') ilike '%unsupported file type%'
    or coalesce(error_message,'') ilike '%final_prompt%'
    or coalesce(error_message,'') ilike '%size%'
    or coalesce(error_message,'') ilike '%Unknown parameter%'
  );

update public.posts
set status = case when status in ('erro','erro_ia','failed') then 'em_fila' else status end,
    error_message = null,
    technical_detail = null,
    updated_at = now()
where id in (
  select distinct post_id
  from public.generation_jobs
  where status in ('queued','retrying','processing','completed')
    and post_id is not null
);
