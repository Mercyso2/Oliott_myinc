-- V2 03 - RLS. Frontend autenticado opera dados. Motor opera por RPC/Edge validado.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='runtime_secrets') then
    execute 'alter table public.runtime_secrets enable row level security';
    execute 'revoke all on public.runtime_secrets from anon, authenticated';
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'app_users','brands','brand_profiles','brand_voice_rules','brand_visual_rules','ai_brain_rules','ai_prompt_templates',
    'campaigns','monthly_plans','post_ideas','posts','prompt_builds','post_versions','content_comments','brand_assets','library_items',
    'media_assets','worker_devices','generation_jobs','generation_job_events','publish_queue','publish_logs','app_settings','system_logs',
    'api_connections','brand_color_palette','brand_products','brand_services','brand_references','brand_preferred_terms','brand_forbidden_terms',
    'ai_feedbacks','campaign_posts','custom_campaign_themes','templates','settings','admin_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Dados do app: MVP interno autenticado. Refinar por brand_id depois se multi-cliente.
do $$
declare t text;
begin
  foreach t in array array[
    'app_users','brands','brand_profiles','brand_voice_rules','brand_visual_rules','ai_brain_rules','ai_prompt_templates',
    'campaigns','monthly_plans','post_ideas','posts','prompt_builds','post_versions','content_comments','brand_assets','library_items',
    'media_assets','publish_queue','publish_logs','app_settings','system_logs','api_connections','brand_color_palette','brand_products',
    'brand_services','brand_references','brand_preferred_terms','brand_forbidden_terms','ai_feedbacks','campaign_posts','custom_campaign_themes',
    'templates','settings','admin_settings'
  ] loop
    execute format('drop policy if exists "%s authenticated select" on public.%I', t, t);
    execute format('create policy "%s authenticated select" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s authenticated insert" on public.%I', t, t);
    execute format('create policy "%s authenticated insert" on public.%I for insert to authenticated with check (true)', t, t);
    execute format('drop policy if exists "%s authenticated update" on public.%I', t, t);
    execute format('create policy "%s authenticated update" on public.%I for update to authenticated using (true) with check (true)', t, t);
    execute format('drop policy if exists "%s authenticated delete" on public.%I', t, t);
    execute format('create policy "%s authenticated delete" on public.%I for delete to authenticated using (true)', t, t);
  end loop;
end $$;

-- Worker/fila: leitura autenticada no painel; escrita somente por RPC security definer/Edge service_role.
drop policy if exists "worker_devices authenticated select" on public.worker_devices;
drop policy if exists "generation_jobs authenticated select" on public.generation_jobs;
create policy "generation_jobs authenticated select" on public.generation_jobs for select to authenticated using (true);
drop policy if exists "generation_job_events authenticated select" on public.generation_job_events;
create policy "generation_job_events authenticated select" on public.generation_job_events for select to authenticated using (true);

revoke insert, update, delete on public.worker_devices from anon, authenticated;
revoke insert, update, delete on public.generation_jobs from anon, authenticated;
revoke insert, update, delete on public.generation_job_events from anon, authenticated;

