-- MYINC HOTFIX V3.2 - engine-register-worker HTTP 500 / [object Object]
-- Execute no Supabase SQL Editor antes de publicar a function.

create extension if not exists pgcrypto;

create table if not exists public.worker_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'MYINC Local Engine Mauricio',
  device_key_hash text not null unique,
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

alter table public.worker_devices add column if not exists name text not null default 'MYINC Local Engine Mauricio';
alter table public.worker_devices add column if not exists device_key_hash text;
alter table public.worker_devices add column if not exists status text not null default 'offline';
alter table public.worker_devices add column if not exists last_seen_at timestamptz;
alter table public.worker_devices add column if not exists current_job_id uuid;
alter table public.worker_devices add column if not exists app_version text;
alter table public.worker_devices add column if not exists machine_info jsonb not null default '{}'::jsonb;
alter table public.worker_devices add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.worker_devices add column if not exists archived_at timestamptz;
alter table public.worker_devices add column if not exists deleted_at timestamptz;
alter table public.worker_devices add column if not exists created_at timestamptz not null default now();
alter table public.worker_devices add column if not exists updated_at timestamptz not null default now();

create unique index if not exists worker_devices_device_key_hash_uidx on public.worker_devices(device_key_hash) where device_key_hash is not null;
create index if not exists worker_devices_status_seen_idx on public.worker_devices(status, last_seen_at desc);

create or replace function public.register_worker_device(
  p_name text,
  p_device_key_hash text,
  p_app_version text default null,
  p_machine_info jsonb default '{}'::jsonb
)
returns public.worker_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker public.worker_devices;
begin
  if nullif(p_device_key_hash, '') is null then
    raise exception 'p_device_key_hash ausente';
  end if;

  insert into public.worker_devices(
    name,
    device_key_hash,
    status,
    last_seen_at,
    app_version,
    machine_info,
    updated_at
  )
  values(
    coalesce(nullif(p_name,''), 'MYINC Local Engine Mauricio'),
    p_device_key_hash,
    'online',
    now(),
    nullif(p_app_version,''),
    coalesce(p_machine_info, '{}'::jsonb),
    now()
  )
  on conflict (device_key_hash) do update set
    name = excluded.name,
    status = 'online',
    last_seen_at = now(),
    app_version = coalesce(excluded.app_version, public.worker_devices.app_version),
    machine_info = coalesce(excluded.machine_info, public.worker_devices.machine_info),
    deleted_at = null,
    archived_at = null,
    updated_at = now()
  returning * into v_worker;

  return v_worker;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on public.worker_devices to service_role;
grant execute on function public.register_worker_device(text,text,text,jsonb) to service_role;
grant execute on function public.register_worker_device(text,text,text,jsonb) to anon;
grant execute on function public.register_worker_device(text,text,text,jsonb) to authenticated;

update public.worker_devices
set name = replace(coalesce(name, ''), 'Rodrigo', 'Mauricio'), updated_at = now()
where name ilike '%Rodrigo%';

-- Diagnóstico rápido depois de executar:
-- select id, name, status, app_version, last_seen_at from public.worker_devices order by updated_at desc limit 10;
