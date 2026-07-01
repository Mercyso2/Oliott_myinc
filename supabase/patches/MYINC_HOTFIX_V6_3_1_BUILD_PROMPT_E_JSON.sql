-- ================================================================
-- MYINC HOTFIX V6.3.1 - BUILD_PROMPT_PAYLOAD AMBÍGUO + RELOAD POSTGREST
-- Corrige o erro:
-- Could not choose the best candidate function between:
-- public.build_prompt_payload(p_job_type => text, p_post_id => uuid),
-- public.build_prompt_payload(p_post_id => uuid, p_job_type => text)
--
-- O que faz:
-- 1) remove as duas versões conflitantes da RPC build_prompt_payload;
-- 2) recria somente a assinatura oficial: (p_post_id uuid, p_job_type text);
-- 3) dá grant para os roles do Supabase;
-- 4) força reload do schema cache do PostgREST.
-- ================================================================

begin;

-- Remove as duas assinaturas conflitantes, sem mexer no resto do schema.
drop function if exists public.build_prompt_payload(uuid, text);
drop function if exists public.build_prompt_payload(text, uuid);

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
  select * into v_post
  from public.posts
  where id = p_post_id;

  if not found then
    raise exception 'post não encontrado: %', p_post_id;
  end if;

  select coalesce(to_jsonb(bp), '{}'::jsonb)
  into v_profile
  from public.brand_profiles bp
  where bp.brand_id = v_post.brand_id
  limit 1;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.priority desc), '[]'::jsonb)
  into v_rules
  from public.ai_brain_rules r
  where r.brand_id = v_post.brand_id
    and coalesce(r.active, true) = true
    and r.deleted_at is null
    and r.archived_at is null;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.version desc), '[]'::jsonb)
  into v_templates
  from public.ai_prompt_templates t
  where (t.brand_id = v_post.brand_id or t.brand_id is null)
    and coalesce(t.active, true) = true
    and t.deleted_at is null
    and t.archived_at is null;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into v_refs
  from (
    select
      id,
      name,
      item_type,
      type,
      media_type,
      public_url,
      url,
      notes,
      tags,
      ai_usage_rule,
      usage_context
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
    when lower(coalesce(v_post.format, '')) like '%story%'
      or lower(coalesce(v_post.format, '')) like '%reels%'
      or lower(coalesce(v_post.format, '')) like '%vídeo%'
      or lower(coalesce(v_post.format, '')) like '%video%'
      then '1024x1536'
    when lower(coalesce(v_post.format, '')) like '%quadrado%'
      or lower(coalesce(v_post.format, '')) like '%1080x1080%'
      then '1024x1024'
    when lower(coalesce(v_post.format, '')) like '%facebook%'
      or lower(coalesce(v_post.format, '')) like '%horizontal%'
      then '1536x1024'
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
    'REGRAS DO CÉREBRO IA: ' || left(v_rules::text, 6000),
    'TEMPLATES: ' || left(v_templates::text, 6000),
    'REFERÊNCIAS APROVADAS: ' || left(v_refs::text, 6000),
    'REGRAS FIXAS: sem texto distorcido na imagem; sem logo falso; sem watermark; sem poluição visual; composição editorial; luz natural; alto padrão; pronto para Instagram/Facebook.'
  );

  insert into public.prompt_builds(
    brand_id,
    post_id,
    build_type,
    job_type,
    task,
    final_prompt,
    prompt,
    payload,
    input_json,
    model_hint,
    status,
    metadata
  ) values (
    v_post.brand_id,
    p_post_id,
    p_job_type,
    p_job_type,
    p_job_type,
    v_final_prompt,
    v_final_prompt,
    '{}'::jsonb,
    '{}'::jsonb,
    case when p_job_type = 'content' then 'gpt-4o-mini' else 'gpt-image-1' end,
    'created',
    jsonb_build_object('source', 'build_prompt_payload_hotfix_v6_3_1')
  ) returning id into v_prompt_id;

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
  set payload = v_payload,
      input_json = v_payload,
      updated_at = now()
  where id = v_prompt_id;

  return v_payload;
end;
$$;

grant execute on function public.build_prompt_payload(uuid, text) to anon, authenticated, service_role;

-- Limpa jobs que falharam especificamente por esse bug para poder reenfileirar.
update public.generation_jobs
set status = 'pending',
    progress = 0,
    locked_by = null,
    locked_at = null,
    heartbeat_at = null,
    started_at = null,
    failed_at = null,
    error_message = null,
    error_code = null,
    technical_detail = null,
    available_at = now(),
    updated_at = now()
where status in ('failed', 'retrying')
  and (
    coalesce(error_message, '') ilike '%build_prompt_payload%'
    or coalesce(technical_detail, '') ilike '%build_prompt_payload%'
    or coalesce(error_message, '') ilike '%best candidate function%'
    or coalesce(technical_detail, '') ilike '%best candidate function%'
  );

commit;

-- Força o Supabase/PostgREST a recarregar as RPCs.
notify pgrst, 'reload schema';

-- Conferência: depois de rodar, deve retornar apenas 1 linha.
select
  n.nspname as schema_name,
  p.proname as function_name,
  oidvectortypes(p.proargtypes) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'build_prompt_payload'
order by 1, 2, 3;
