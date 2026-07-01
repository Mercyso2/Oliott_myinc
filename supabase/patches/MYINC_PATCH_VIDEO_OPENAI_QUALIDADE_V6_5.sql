-- MYINC V6.5 — OpenAI Video API + cérebro visual/sonoro premium
-- Rode este arquivo no Supabase SQL Editor.

alter table public.posts add column if not exists video_poster_url text;
alter table public.posts add column if not exists audio_url text;
alter table public.posts add column if not exists sound_asset_url text;
alter table public.posts add column if not exists video_job_provider text;

alter table public.library_items add column if not exists usage_context text;
alter table public.library_items add column if not exists asset_role text;
alter table public.media_assets add column if not exists usage_context text;
alter table public.media_assets add column if not exists asset_role text;

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
  v_sound_assets jsonb;
  v_final_prompt text;
  v_size text;
  v_video_size text;
  v_payload jsonb;
  v_prompt_id uuid;
  v_post_text text;
  v_wants_people boolean;
  v_is_video boolean;
  v_rules_text text;
  v_templates_text text;
  v_sound_direction text;
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

  select string_agg(format('[%s] %s', coalesce(t.name, 'template'), left(coalesce(t.content, ''), 280)), E'\n')
    into v_templates_text
  from public.ai_prompt_templates t
  where (t.brand_id = v_post.brand_id or t.brand_id is null) and t.active = true and t.archived_at is null;

  v_post_text := lower(concat_ws(' ', coalesce(v_post.title, ''), coalesce(v_post.theme, ''), coalesce(v_post.headline, ''), coalesce(v_post.short_text, ''), coalesce(v_post.objective, ''), coalesce(v_post.creative_brief, '')));
  v_wants_people := v_post_text ~ '(depoimento|cliente|equipe|corretor|consultor|especialista|fundador|bastidor|hist[oó]ria|atendimento|lifestyle|rotina|prova social|quem somos)';
  v_is_video := lower(coalesce(p_job_type, '')) = 'video' or lower(coalesce(v_post.format, '')) similar to '%(reels|story|stories|video|vídeo)%';

  with assets as (
    select l.id, l.name, coalesce(nullif(l.public_url,''), nullif(l.url,''), nullif(l.source_url,'')) as url, l.notes, l.tags, l.status,
      coalesce(l.asset_role, l.usage_context, l.item_type, l.metadata->>'upload_type', 'reference') as kind,
      'library'::text as source
    from public.library_items l
    where l.brand_id = v_post.brand_id and l.archived_at is null and coalesce(l.ai_allowed,true)=true and coalesce(l.ai_usage_rule,'allowed') <> 'blocked'
    union all
    select b.id, b.name, coalesce(nullif(b.public_url,''), nullif(b.url,''), nullif(b.source_url,'')) as url, b.notes, array[]::text[] as tags, 'approved' as status,
      coalesce(b.asset_role, b.asset_type, 'brand_asset') as kind, 'brand_asset' as source
    from public.brand_assets b
    where b.brand_id = v_post.brand_id and b.archived_at is null and coalesce(b.ai_allowed,true)=true
  ), ranked as (
    select *,
      case
        when lower(kind) like '%som%' or lower(kind) like '%trilha%' or lower(kind) like '%audio%' then 'sound_reference'
        when lower(kind) like '%logo%' then 'logo'
        when v_wants_people and (lower(kind) like '%foto%' or lower(kind) like '%retrato%' or lower(kind) like '%pessoal%') then 'person_reference'
        when lower(status)='template' or lower(kind) like '%template%' then 'template_style'
        else 'style_reference'
      end as role,
      (case when lower(kind) like '%logo%' then 120 else 0 end +
       case when lower(status)='template' or lower(kind) like '%template%' then 120 else 0 end +
       case when v_wants_people and (lower(kind) like '%foto%' or lower(kind) like '%retrato%' or lower(kind) like '%pessoal%') then 160 else 0 end +
       case when lower(kind) like '%som%' or lower(kind) like '%trilha%' or lower(kind) like '%audio%' then 150 else 0 end +
       case when lower(status) similar to '%(referência aprovada|approved|ativo|active|template)%' then 80 else 0 end)::int as score
    from assets
    where url is not null
  )
  select
    coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'url',url,'notes',coalesce(notes,''),'tags',coalesce(tags,array[]::text[]),'role',role,'kind',kind,'source',source,'priority_score',score) order by score desc, name asc) filter (where role <> 'sound_reference'), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'url',url,'notes',coalesce(notes,''),'tags',coalesce(tags,array[]::text[]),'role',role,'kind',kind,'source',source,'priority_score',score) order by score desc, name asc) filter (where role = 'sound_reference'), '[]'::jsonb)
  into v_reference_assets, v_sound_assets
  from (select * from ranked order by score desc, name asc limit 12) q;

  v_size := case
    when lower(coalesce(v_post.format,'')) like '%facebook%' or lower(coalesce(v_post.format,'')) like '%1200x630%' then '1536x1024'
    when lower(coalesce(v_post.format,'')) like '%quadrado%' or lower(coalesce(v_post.format,'')) like '%1080x1080%' then '1024x1024'
    else '1024x1536'
  end;
  v_video_size := case
    when lower(coalesce(v_post.format,'')) like '%facebook%' then '1280x720'
    else '720x1280'
  end;
  v_sound_direction := 'Som premium discreto para incorporadora: ambiente cinematográfico claro, transições suaves, textura de luxo, whooshes leves, sem trilha agressiva, sem estética popular. Usar referências sonoras da biblioteca apenas como direção criativa.';

  v_final_prompt := concat_ws(E'\n\n',
    'VOCÊ É O DIRETOR CRIATIVO SÊNIOR DA MYINC. Crie uma peça com padrão premium 2026 de incorporadora: sofisticada, realista, clara, comercialmente responsável e alinhada à marca.',
    'TIPO DE JOB: ' || coalesce(p_job_type, 'image'),
    'FORMATO: ' || coalesce(v_post.format, 'Feed 1080x1350') || ' | IMAGE_SIZE: ' || v_size || ' | VIDEO_SIZE: ' || v_video_size,
    'POST: ' || coalesce(v_post.title,'') || ' / ' || coalesce(v_post.theme,''),
    'HEADLINE: ' || coalesce(v_post.headline,''),
    'OBJETIVO: ' || coalesce(v_post.objective,''),
    'COPY BASE: ' || coalesce(v_post.short_text,''),
    'CTA: ' || coalesce(v_post.cta,''),
    'BRIEF CRIATIVO: ' || coalesce(v_post.creative_brief,''),
    'PROMPT VISUAL BASE: ' || coalesce(v_post.image_prompt,''),
    'MANTRA: ' || coalesce(v_profile.mantra, 'Toda criação deve parecer uma peça premium de incorporadora.'),
    'IDENTIDADE VERBAL: ' || coalesce(v_profile.tone,'') || ' | ' || coalesce(v_profile.communication_style,''),
    'PÚBLICO/PERSONA: ' || coalesce(v_profile.primary_audience,'') || ' | ' || coalesce(v_profile.persona,''),
    'DIFERENCIAIS: ' || coalesce(v_profile.differentiators,'') || ' | BENEFÍCIOS: ' || coalesce(v_profile.benefits,''),
    'OBJEÇÕES: ' || coalesce(v_profile.objections,''),
    'IDENTIDADE VISUAL: ' || coalesce(v_profile.preferred_visual_style,'') || ' | ' || coalesce(v_profile.composition_rules,''),
    'REGRAS DO CÉREBRO: ' || coalesce(v_rules_text, 'sem regras adicionais'),
    'TEMPLATES / PADRÃO VISUAL: ' || coalesce(v_templates_text, 'sem templates textuais cadastrados'),
    'REFERÊNCIAS VISUAIS: usar reference_assets do payload. role=person_reference somente em contexto de pessoa/autoria/depoimento/bastidor. role=template_style define hierarquia e estética. role=logo orienta identidade sem distorcer.',
    'DIREÇÃO SONORA PARA VÍDEO: ' || v_sound_direction,
    'NEGATIVE PROMPT: sem watermark, sem logo inventado, sem texto embutido confuso, sem prédio torto, sem rostos/mãos deformados, sem visual barato, sem ruído visual, sem promessa irresponsável.',
    'SAÍDA ESPERADA: imagem/vídeo premium, crível, moderno, com atmosfera de alto padrão, confiança comercial e identidade MYINC.'
  );

  insert into public.prompt_builds(brand_id, post_id, build_type, final_prompt, payload, model_hint, status)
  values (
    v_post.brand_id,
    v_post.id,
    coalesce(p_job_type, 'image'),
    v_final_prompt,
    jsonb_build_object('post',to_jsonb(v_post),'profile',to_jsonb(v_profile),'rules',v_rules,'templates',v_templates,'reference_assets',v_reference_assets,'sound_assets',v_sound_assets,'sound_direction',v_sound_direction,'size',v_size,'video_size',v_video_size,'quality_tier','premium_2026'),
    case when v_is_video then 'sora-2' else 'gpt-image-1' end,
    'created'
  ) returning id into v_prompt_id;

  v_payload := jsonb_build_object(
    'prompt_build_id', v_prompt_id,
    'final_prompt', v_final_prompt,
    'size', v_size,
    'video_size', v_video_size,
    'video_seconds', '8',
    'post', to_jsonb(v_post),
    'brand_profile', to_jsonb(v_profile),
    'rules', v_rules,
    'templates', v_templates,
    'reference_assets', v_reference_assets,
    'sound_assets', v_sound_assets,
    'sound_direction', v_sound_direction,
    'use_personal_photo_reference', v_wants_people,
    'quality_tier', 'premium_2026',
    'model_hint', case when v_is_video then 'sora-2' else 'gpt-image-1' end
  );

  return v_payload;
end; $$;

grant execute on function public.build_prompt_payload(uuid, text) to authenticated, service_role;
