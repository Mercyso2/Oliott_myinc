-- HOTFIX / PATCH V6.4
-- build_prompt_payload reforçado para usar cérebro da marca, templates, biblioteca,
-- foto pessoal/retrato como referência em casos adequados e saída pronta para o motor visual.

drop function if exists public.build_prompt_payload(uuid, text) cascade;

create or replace function public.build_prompt_payload(p_post_id uuid, p_job_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.posts;
  v_profile public.brand_profiles;
  v_rules jsonb;
  v_templates jsonb;
  v_reference_assets jsonb;
  v_final_prompt text;
  v_size text;
  v_payload jsonb;
  v_prompt_id uuid;
  v_post_text text;
  v_wants_people boolean;
  v_is_video boolean;
  v_rules_text text;
  v_templates_text text;
  v_reference_count int := 0;
begin
  select * into v_post from public.posts where id = p_post_id;
  if not found then raise exception 'post não encontrado'; end if;

  select * into v_profile from public.brand_profiles where brand_id = v_post.brand_id order by created_at asc limit 1;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.priority desc), '[]'::jsonb)
    into v_rules
  from public.ai_brain_rules r
  where r.brand_id = v_post.brand_id and r.active = true and r.archived_at is null;

  select string_agg(format('[%s | %s] %s', coalesce(r.name, 'regra'), coalesce(r.category, 'geral'), coalesce(r.content, '')), E'\n')
    into v_rules_text
  from public.ai_brain_rules r
  where r.brand_id = v_post.brand_id and r.active = true and r.archived_at is null;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.version desc), '[]'::jsonb)
    into v_templates
  from public.ai_prompt_templates t
  where (t.brand_id = v_post.brand_id or t.brand_id is null) and t.active = true and t.archived_at is null;

  select string_agg(format('[%s] %s', coalesce(t.name, 'template'), left(coalesce(t.content, ''), 260)), E'\n')
    into v_templates_text
  from public.ai_prompt_templates t
  where (t.brand_id = v_post.brand_id or t.brand_id is null) and t.active = true and t.archived_at is null;

  v_post_text := lower(concat_ws(' ', coalesce(v_post.title, ''), coalesce(v_post.theme, ''), coalesce(v_post.headline, ''), coalesce(v_post.short_text, ''), coalesce(v_post.objective, ''), coalesce(v_post.creative_brief, '')));
  v_wants_people := v_post_text ~ '(depoimento|cliente|equipe|corretor|consultor|especialista|fundador|bastidor|hist[oó]ria|atendimento|lifestyle|rotina|prova social|quem somos)';
  v_is_video := lower(coalesce(p_job_type, '')) = 'video' or lower(coalesce(v_post.format, '')) similar to '%(reels|story|stories|video|vídeo)%';

  with asset_pool as (
    select
      l.id,
      l.name,
      coalesce(nullif(l.public_url, ''), nullif(l.url, '')) as asset_url,
      l.notes,
      l.tags,
      l.status,
      coalesce(nullif(l.item_type, ''), nullif(l.metadata->>'upload_type', ''), 'reference') as asset_kind,
      coalesce(l.metadata->>'upload_type', l.item_type, 'reference') as upload_type,
      'library'::text as source
    from public.library_items l
    where l.brand_id = v_post.brand_id
      and l.archived_at is null
      and coalesce(l.ai_usage_rule, 'allowed') <> 'blocked'
      and coalesce(nullif(l.public_url, ''), nullif(l.url, '')) is not null

    union all

    select
      b.id,
      b.name,
      coalesce(nullif(b.public_url, ''), nullif(b.url, '')) as asset_url,
      b.notes,
      array[]::text[] as tags,
      'approved'::text as status,
      coalesce(nullif(b.asset_type, ''), 'brand_asset') as asset_kind,
      coalesce(nullif(b.asset_type, ''), 'brand_asset') as upload_type,
      'brand_asset'::text as source
    from public.brand_assets b
    where b.brand_id = v_post.brand_id
      and b.archived_at is null
      and coalesce(b.ai_allowed, true) = true
      and coalesce(nullif(b.public_url, ''), nullif(b.url, '')) is not null
  ), ranked as (
    select *,
      case
        when lower(upload_type) like '%logo%' or lower(asset_kind) like '%logo%' then 'logo'
        when v_wants_people and (lower(upload_type) like '%foto%' or lower(upload_type) like '%retrato%' or lower(asset_kind) like '%foto%' or lower(asset_kind) like '%retrato%') then 'person_reference'
        when lower(status) = 'template' or lower(upload_type) like '%template%' or lower(asset_kind) like '%template%' then 'template_style'
        else 'style_reference'
      end as role,
      (
        case when lower(status) = 'template' then 130 else 0 end +
        case when lower(status) similar to '%(referência aprovada|approved|ativo|active)%' then 80 else 0 end +
        case when lower(upload_type) like '%logo%' or lower(asset_kind) like '%logo%' then 120 else 0 end +
        case when v_wants_people and (lower(upload_type) like '%foto%' or lower(upload_type) like '%retrato%' or lower(asset_kind) like '%foto%' or lower(asset_kind) like '%retrato%') then 140 else 0 end +
        case when lower(upload_type) like '%template%' or lower(asset_kind) like '%template%' then 100 else 0 end
      )::int as score
    from asset_pool
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'name', name,
    'url', asset_url,
    'notes', coalesce(notes, ''),
    'tags', coalesce(tags, array[]::text[]),
    'role', role,
    'kind', asset_kind,
    'source', source,
    'priority_score', score
  ) order by score desc, name asc), '[]'::jsonb)
    into v_reference_assets
  from (
    select * from ranked
    where asset_url is not null
    order by score desc, name asc
    limit 8
  ) q;

  select coalesce(jsonb_array_length(v_reference_assets), 0) into v_reference_count;

  v_size := case
    when lower(coalesce(v_post.format,'')) like '%story%' or lower(coalesce(v_post.format,'')) like '%reels%' or lower(coalesce(v_post.format,'')) like '%vídeo%' or lower(coalesce(v_post.format,'')) like '%video%' then '1024x1536'
    when lower(coalesce(v_post.format,'')) like '%square%' or lower(coalesce(v_post.format,'')) like '%1080x1080%' then '1024x1024'
    when lower(coalesce(v_post.format,'')) like '%facebook%' or lower(coalesce(v_post.format,'')) like '%1200x630%' then '1536x1024'
    else '1024x1536'
  end;

  v_final_prompt := concat_ws(E'\n\n',
    'VOCÊ É O DIRETOR CRIATIVO SÊNIOR DA MYINC. Sua missão é criar uma peça com padrão premium de incorporadora 2026, visual sofisticado, comercialmente convincente e sem aparência genérica.',
    'TIPO DE JOB: ' || coalesce(p_job_type, 'image'),
    'FORMATO / SIZE: ' || coalesce(v_post.format, 'Feed 1080x1350') || ' | gerar em ' || v_size,
    'OBJETIVO DO POST: ' || coalesce(v_post.objective, ''),
    'TEMA DO POST: ' || coalesce(v_post.theme, ''),
    'HEADLINE / TÍTULO: ' || coalesce(v_post.headline, v_post.title, ''),
    'TEXTO CURTO / COPY-BASE: ' || coalesce(v_post.short_text, ''),
    'CTA: ' || coalesce(v_post.cta, ''),
    'BRIEF CRIATIVO: ' || coalesce(v_post.creative_brief, ''),
    'PROMPT BASE EXISTENTE: ' || coalesce(v_post.image_prompt, ''),
    'MANTRA DA MARCA: ' || coalesce(v_profile.mantra, 'Aja como núcleo criativo premium da MYINC.'),
    'TOM DE VOZ: ' || coalesce(v_profile.tone, '') || ' | ESTILO DE COMUNICAÇÃO: ' || coalesce(v_profile.communication_style, ''),
    'PÚBLICO / PERSONA: ' || coalesce(v_profile.primary_audience, '') || ' | ' || coalesce(v_profile.persona, ''),
    'BENEFÍCIOS / DIFERENCIAIS: ' || coalesce(v_profile.benefits, '') || ' | ' || coalesce(v_profile.differentiators, ''),
    'OBJEÇÕES A TRATAR: ' || coalesce(v_profile.objections, ''),
    'ESTILO VISUAL PREFERIDO: ' || coalesce(v_profile.preferred_visual_style, ''),
    'IMAGENS PREFERIDAS: ' || coalesce(v_profile.preferred_images, ''),
    'REGRAS DE COMPOSIÇÃO: ' || coalesce(v_profile.composition_rules, ''),
    'REGRAS DE TEXTO EM IMAGEM: ' || coalesce(v_profile.image_text_rules, 'evitar texto embutido; quando possível, entregar arte base sem texto'),
    'REGRAS ATIVAS DO CÉREBRO IA: ' || coalesce(v_rules_text, 'sem regras adicionais'),
    'TEMPLATES ATIVOS / LINGUAGEM VISUAL: ' || coalesce(v_templates_text, 'sem template textual cadastrado'),
    case when v_reference_count > 0 then 'REFERÊNCIAS VISUAIS DISPONÍVEIS: use os assets enviados no payload reference_assets. Se houver role=person_reference e o tema for adequado, preserve a identidade da pessoa. Se houver role=template_style, seguir linguagem, ritmo, hierarquia e sofisticação sem copiar texto. Se houver role=logo, respeitar identidade visual sem distorção.' else 'REFERÊNCIAS VISUAIS DISPONÍVEIS: nenhuma referência visual aprovada foi encontrada; compor de forma premium com base na memória da marca.' end,
    case when v_wants_people then 'USAR FOTO PESSOAL / RETRATO: SIM, quando houver reference_assets com role=person_reference.' else 'USAR FOTO PESSOAL / RETRATO: NÃO OBRIGATÓRIO; só usar se a referência e o contexto combinarem.' end,
    case when v_is_video then 'PARA VÍDEO / REELS: pensar em cenas elegantes, ritmo suave, ganchos visuais fortes, arquitetura, lifestyle, detalhes de obra/empreendimento e sensação cinematográfica.' else 'PARA IMAGEM / CARROSSEL: priorizar capa ou cena hero premium, impacto visual limpo, acabamento de agência e clareza de mensagem.' end,
    'NEGATIVE PROMPT / RESTRIÇÕES: sem texto embutido confuso, sem watermark, sem logo inventado, sem poluição visual, sem rostos deformados, sem mãos erradas, sem prédio torto, sem estética barata, sem aparência de banco de imagem genérico, sem exagero publicitário popular.',
    'RESULTADO ESPERADO: uma peça premium, crível, sofisticada, valorizando patrimônio, arquitetura, conforto, confiança comercial e posicionamento de alto padrão.'
  );

  insert into public.prompt_builds(brand_id, post_id, build_type, final_prompt, payload, model_hint, status)
  values (
    v_post.brand_id,
    v_post.id,
    coalesce(p_job_type, 'image'),
    v_final_prompt,
    jsonb_build_object(
      'post', to_jsonb(v_post),
      'profile', to_jsonb(v_profile),
      'rules', v_rules,
      'templates', v_templates,
      'reference_assets', v_reference_assets,
      'size', v_size,
      'use_personal_photo_reference', v_wants_people,
      'planner_version', 'quality-prompt-v6-4'
    ),
    case when v_is_video then 'replicate-or-openai-hybrid' else 'gpt-image-1' end,
    'created'
  ) returning id into v_prompt_id;

  v_payload := jsonb_build_object(
    'prompt_build_id', v_prompt_id,
    'final_prompt', v_final_prompt,
    'size', v_size,
    'post', to_jsonb(v_post),
    'brand_profile', to_jsonb(v_profile),
    'rules', v_rules,
    'templates', v_templates,
    'reference_assets', v_reference_assets,
    'use_personal_photo_reference', v_wants_people,
    'quality_tier', 'premium_2026',
    'model_hint', case when v_is_video then 'replicate-or-openai-hybrid' else 'gpt-image-1' end
  );

  return v_payload;
end; $$;

grant execute on function public.build_prompt_payload(uuid, text) to authenticated, service_role;

-- V9.1 final queue/worker RPCs.
-- Mantem compatibilidade com o frontend novo, Edge Functions e Motor Local.

alter table if exists public.worker_devices add column if not exists archived_at timestamptz;
alter table if exists public.worker_devices add column if not exists deleted_at timestamptz;

alter table if exists public.generation_jobs add column if not exists parent_job_id uuid;
alter table if exists public.generation_jobs add column if not exists type text;
alter table if exists public.generation_jobs add column if not exists payload jsonb not null default '{}'::jsonb;
alter table if exists public.generation_jobs add column if not exists result jsonb not null default '{}'::jsonb;
alter table if exists public.generation_jobs add column if not exists attempts integer not null default 0;
alter table if exists public.generation_jobs add column if not exists finished_at timestamptz;
alter table if exists public.generation_jobs add column if not exists next_attempt_at timestamptz;
alter table if exists public.generation_jobs add column if not exists technical_detail text;
alter table if exists public.generation_jobs add column if not exists archived_at timestamptz;
alter table if exists public.generation_jobs add column if not exists deleted_at timestamptz;

update public.generation_jobs
set
  type = coalesce(type, job_type),
  payload = coalesce(payload, input_json, '{}'::jsonb),
  result = coalesce(result, output_json, '{}'::jsonb),
  attempts = coalesce(attempts, attempt_count, 0)
where type is null
   or payload is null
   or result is null
   or attempts is null;

create index if not exists generation_jobs_v91_pick_idx
  on public.generation_jobs(status, available_at, priority, created_at)
  where deleted_at is null and archived_at is null;

create index if not exists generation_jobs_v91_post_idx
  on public.generation_jobs(post_id, created_at desc)
  where deleted_at is null;

create unique index if not exists generation_jobs_v91_idempotency_idx
  on public.generation_jobs(idempotency_key)
  where idempotency_key is not null;

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
  if nullif(trim(coalesce(p_device_key_hash, '')), '') is null then
    raise exception 'device_key_hash obrigatorio';
  end if;

  insert into public.worker_devices(name, device_key_hash, status, last_seen_at, app_version, machine_info, metadata, archived_at, deleted_at, updated_at)
  values (
    coalesce(nullif(trim(p_name), ''), 'MYINC Local Engine'),
    p_device_key_hash,
    'online',
    now(),
    p_app_version,
    coalesce(p_machine_info, '{}'::jsonb),
    jsonb_build_object('registered_by', 'register_worker_device_v91'),
    null,
    null,
    now()
  )
  on conflict (device_key_hash) do update set
    name = excluded.name,
    status = 'online',
    last_seen_at = now(),
    app_version = excluded.app_version,
    machine_info = excluded.machine_info,
    archived_at = null,
    deleted_at = null,
    updated_at = now()
  returning * into v_worker;

  return v_worker;
end;
$$;

create or replace function public.worker_heartbeat(
  p_worker_id uuid,
  p_device_key_hash text
)
returns public.worker_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker public.worker_devices;
begin
  update public.worker_devices
  set status = 'online', last_seen_at = now(), updated_at = now()
  where id = p_worker_id
    and device_key_hash = p_device_key_hash
    and deleted_at is null
  returning * into v_worker;

  if not found then
    raise exception 'worker invalido ou chave incorreta';
  end if;

  update public.generation_jobs
  set heartbeat_at = now(), updated_at = now()
  where locked_by = p_worker_id
    and status = 'processing'
    and deleted_at is null;

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
  v_count integer := 0;
begin
  update public.generation_jobs
  set
    status = 'retrying',
    locked_by = null,
    locked_at = null,
    worker_id = null,
    available_at = now(),
    error_message = coalesce(error_message, 'Job destravado por heartbeat expirado.'),
    updated_at = now()
  where status = 'processing'
    and deleted_at is null
    and archived_at is null
    and coalesce(heartbeat_at, locked_at, started_at, created_at) < now() - interval '15 minutes';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.claim_next_generation_job(
  p_worker_id uuid,
  p_device_key_hash text
)
returns public.generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.generation_jobs;
begin
  perform public.worker_heartbeat(p_worker_id, p_device_key_hash);
  perform public.requeue_stale_generation_jobs();

  select *
  into v_job
  from public.generation_jobs
  where status in ('queued', 'retrying')
    and deleted_at is null
    and archived_at is null
    and coalesce(available_at, now()) <= now()
    and coalesce(attempts, attempt_count, 0) < coalesce(max_attempts, 3)
  order by priority asc, created_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.generation_jobs
  set
    status = 'processing',
    progress = greatest(coalesce(progress, 0), 5),
    locked_by = p_worker_id,
    worker_id = p_worker_id::text,
    locked_at = now(),
    heartbeat_at = now(),
    started_at = coalesce(started_at, now()),
    attempts = coalesce(attempts, attempt_count, 0) + 1,
    attempt_count = coalesce(attempt_count, attempts, 0) + 1,
    type = coalesce(type, job_type),
    payload = coalesce(payload, input_json, '{}'::jsonb),
    updated_at = now()
  where id = v_job.id
  returning * into v_job;

  update public.worker_devices
  set current_job_id = v_job.id, status = 'busy', last_seen_at = now(), updated_at = now()
  where id = p_worker_id;

  insert into public.generation_job_events(job_id, worker_id, event_type, status_from, status_to, message, data)
  values (v_job.id, p_worker_id, 'claim', 'queued', 'processing', 'Job reclamado pelo Motor Local.', jsonb_build_object('worker_id', p_worker_id))
  on conflict do nothing;

  return v_job;
end;
$$;

create or replace function public.claim_next_generation_job(p_worker_id uuid)
returns public.generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select device_key_hash into v_hash
  from public.worker_devices
  where id = p_worker_id
    and deleted_at is null
  limit 1;

  if v_hash is null then
    raise exception 'worker invalido para claim_next_generation_job';
  end if;

  return public.claim_next_generation_job(p_worker_id, v_hash);
end;
$$;

create or replace function public.complete_generation_job(
  p_worker_id uuid,
  p_device_key_hash text,
  p_job_id uuid,
  p_output_json jsonb default '{}'::jsonb
)
returns public.generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.generation_jobs;
begin
  perform public.worker_heartbeat(p_worker_id, p_device_key_hash);

  update public.generation_jobs
  set
    status = 'completed',
    progress = 100,
    output_json = coalesce(p_output_json, '{}'::jsonb),
    result = coalesce(p_output_json, '{}'::jsonb),
    provider_response = coalesce(provider_response, '{}'::jsonb) || jsonb_build_object('completed_at', now()),
    completed_at = now(),
    finished_at = now(),
    locked_by = null,
    locked_at = null,
    heartbeat_at = now(),
    worker_id = p_worker_id::text,
    error_message = null,
    error_code = null,
    updated_at = now()
  where id = p_job_id
    and (locked_by = p_worker_id or locked_by is null)
    and deleted_at is null
  returning * into v_job;

  if not found then
    raise exception 'job nao encontrado ou bloqueado por outro worker';
  end if;

  update public.worker_devices
  set current_job_id = null, status = 'online', last_seen_at = now(), updated_at = now()
  where id = p_worker_id;

  insert into public.generation_job_events(job_id, worker_id, event_type, status_from, status_to, message, data)
  values (p_job_id, p_worker_id, 'complete', 'processing', 'completed', 'Job concluido pelo Motor Local.', coalesce(p_output_json, '{}'::jsonb))
  on conflict do nothing;

  return v_job;
end;
$$;

create or replace function public.fail_generation_job(
  p_worker_id uuid,
  p_device_key_hash text,
  p_job_id uuid,
  p_error_message text,
  p_error_code text default null,
  p_provider_response jsonb default '{}'::jsonb
)
returns public.generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.generation_jobs;
  v_attempts integer;
  v_max integer;
  v_next_status text;
begin
  perform public.worker_heartbeat(p_worker_id, p_device_key_hash);

  select coalesce(attempts, attempt_count, 0), coalesce(max_attempts, 3)
  into v_attempts, v_max
  from public.generation_jobs
  where id = p_job_id;

  v_next_status := case when v_attempts < v_max then 'retrying' else 'failed' end;

  update public.generation_jobs
  set
    status = v_next_status,
    progress = 0,
    error_message = left(coalesce(p_error_message, 'Falha desconhecida no Motor Local.'), 2000),
    error_code = p_error_code,
    provider_response = coalesce(p_provider_response, '{}'::jsonb),
    failed_at = case when v_next_status = 'failed' then now() else failed_at end,
    next_attempt_at = case when v_next_status = 'retrying' then now() + interval '2 minutes' else null end,
    available_at = case when v_next_status = 'retrying' then now() + interval '2 minutes' else available_at end,
    locked_by = null,
    locked_at = null,
    heartbeat_at = null,
    worker_id = p_worker_id::text,
    updated_at = now()
  where id = p_job_id
    and (locked_by = p_worker_id or locked_by is null)
    and deleted_at is null
  returning * into v_job;

  if not found then
    raise exception 'job nao encontrado para falha';
  end if;

  update public.worker_devices
  set current_job_id = null, status = 'online', last_seen_at = now(), updated_at = now()
  where id = p_worker_id;

  insert into public.generation_job_events(job_id, worker_id, event_type, status_from, status_to, message, data)
  values (p_job_id, p_worker_id, 'fail', 'processing', v_next_status, left(coalesce(p_error_message, ''), 500), coalesce(p_provider_response, '{}'::jsonb))
  on conflict do nothing;

  return v_job;
end;
$$;

create or replace function public.enqueue_post_generation(
  p_post_id uuid,
  p_job_type text default 'content',
  p_force boolean default false,
  p_instruction text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.posts;
  v_payload jsonb;
  v_job public.generation_jobs;
  v_batch uuid := gen_random_uuid();
  v_type text := case when p_job_type in ('content','image','carousel_page','video') then p_job_type else 'content' end;
  v_key text;
begin
  select * into v_post
  from public.posts
  where id = p_post_id
    and deleted_at is null
    and archived_at is null;

  if not found then
    raise exception 'post nao encontrado ou arquivado';
  end if;

  -- Fluxo final: sempre entra por content. A Edge engine-save-result cria midia depois do conteudo salvo.
  v_type := 'content';
  v_payload := public.build_prompt_payload(p_post_id, v_type)
    || jsonb_build_object('force', coalesce(p_force, false), 'instruction', p_instruction);
  v_key := 'content-' || p_post_id::text || '-' || v_batch::text;

  insert into public.generation_jobs(
    brand_id, post_id, batch_id, job_type, type, provider, status, priority, progress,
    input_json, payload, prompt_build_id, idempotency_key, available_at, error_message
  )
  values (
    v_post.brand_id, p_post_id, v_batch, v_type, v_type, 'openai', 'queued', 10, 0,
    v_payload, v_payload, nullif(v_payload->>'prompt_build_id', '')::uuid, v_key, now(), null
  )
  returning * into v_job;

  update public.posts
  set status = 'em_fila', batch_id = v_batch, error_message = null, updated_at = now()
  where id = p_post_id;

  return jsonb_build_object('ok', true, 'batchId', v_batch, 'queued', 1, 'job', to_jsonb(v_job));
end;
$$;

drop function if exists public.list_generation_jobs_light(integer);

create or replace function public.list_generation_jobs_light(p_limit integer default 80)
returns table (
  id uuid,
  post_id uuid,
  brand_id uuid,
  batch_id uuid,
  job_type text,
  type text,
  status text,
  priority integer,
  progress integer,
  attempts integer,
  attempt_count integer,
  max_attempts integer,
  error_message text,
  technical_detail text,
  created_at timestamptz,
  updated_at timestamptz,
  available_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    gj.id,
    gj.post_id,
    gj.brand_id,
    gj.batch_id,
    gj.job_type,
    coalesce(gj.type, gj.job_type) as type,
    gj.status,
    gj.priority,
    gj.progress,
    coalesce(gj.attempts, gj.attempt_count, 0) as attempts,
    coalesce(gj.attempt_count, gj.attempts, 0) as attempt_count,
    coalesce(gj.max_attempts, 3) as max_attempts,
    gj.error_message,
    gj.technical_detail,
    gj.created_at,
    gj.updated_at,
    gj.available_at,
    gj.started_at,
    coalesce(gj.finished_at, gj.completed_at, gj.failed_at) as finished_at
  from public.generation_jobs gj
  where gj.deleted_at is null
    and gj.archived_at is null
  order by gj.created_at desc
  limit greatest(1, least(coalesce(p_limit, 80), 300));
$$;

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
  set
    status = 'retrying',
    progress = 0,
    locked_by = null,
    locked_at = null,
    heartbeat_at = null,
    worker_id = null,
    attempts = 0,
    attempt_count = 0,
    available_at = now(),
    next_attempt_at = null,
    error_message = null,
    error_code = null,
    technical_detail = null,
    updated_at = now()
  where id = p_job_id
    and deleted_at is null
  returning * into v_job;

  if not found then
    raise exception 'job nao encontrado para retry';
  end if;

  return v_job;
end;
$$;

create or replace function public.trigger_worker_now(
  p_limit integer default 50,
  p_retry_failed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requeued integer := 0;
  v_available integer := 0;
begin
  if coalesce(p_retry_failed, false) then
    update public.generation_jobs
    set status = 'retrying',
        progress = 0,
        locked_by = null,
        locked_at = null,
        heartbeat_at = null,
        worker_id = null,
        available_at = now(),
        next_attempt_at = null,
        updated_at = now()
    where id in (
      select id
      from public.generation_jobs
      where status in ('failed', 'cancelled')
        and deleted_at is null
        and archived_at is null
      order by updated_at asc nulls first
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    );
    get diagnostics v_requeued = row_count;
  end if;

  update public.generation_jobs
  set available_at = now(), updated_at = now()
  where id in (
    select id
    from public.generation_jobs
    where status in ('queued', 'retrying')
      and deleted_at is null
      and archived_at is null
    order by priority asc, created_at asc
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  );
  get diagnostics v_available = row_count;

  return jsonb_build_object('ok', true, 'made_available', v_available, 'requeued_failed', v_requeued);
end;
$$;

grant execute on function public.register_worker_device(text, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.worker_heartbeat(uuid, text) to anon, authenticated, service_role;
grant execute on function public.requeue_stale_generation_jobs() to anon, authenticated, service_role;
grant execute on function public.claim_next_generation_job(uuid, text) to anon, authenticated, service_role;
grant execute on function public.claim_next_generation_job(uuid) to anon, authenticated, service_role;
grant execute on function public.complete_generation_job(uuid, text, uuid, jsonb) to anon, authenticated, service_role;
grant execute on function public.fail_generation_job(uuid, text, uuid, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.enqueue_post_generation(uuid, text, boolean, text) to authenticated, service_role;
grant execute on function public.list_generation_jobs_light(integer) to anon, authenticated, service_role;
grant execute on function public.retry_generation_job(uuid) to authenticated, service_role;
grant execute on function public.trigger_worker_now(integer, boolean) to authenticated, service_role;
