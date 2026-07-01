create extension if not exists pgcrypto;
-- V2 00 - Backup seguro de runtime_secrets, se existir.
create extension if not exists pgcrypto;
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='runtime_secrets') then
    execute 'create table if not exists public.runtime_secrets_backup_v2 as table public.runtime_secrets with no data';
    execute 'insert into public.runtime_secrets_backup_v2 select * from public.runtime_secrets on conflict do nothing';
  else
    create table if not exists public.runtime_secrets_backup_v2 (
      id uuid default gen_random_uuid(),
      note text default 'runtime_secrets não existia no momento do backup',
      created_at timestamptz default now()
    );
  end if;
end $$;
