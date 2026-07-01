-- MYINC PATCH REVISAO GERAL V3
-- Execute uma vez no Supabase SQL Editor antes de testar o fluxo.

alter table if exists public.monthly_plans add column if not exists title text;
alter table if exists public.monthly_plans add column if not exists objective text;
alter table if exists public.posts add column if not exists video_poster_url text;
alter table if exists public.posts add column if not exists video_status text;
alter table if exists public.posts add column if not exists video_progress integer default 0;
alter table if exists public.posts add column if not exists video_storyboard_urls text[] default '{}';
alter table if exists public.posts add column if not exists deleted_at timestamptz;
alter table if exists public.posts add column if not exists published_url text;
alter table if exists public.posts add column if not exists meta_permalink text;
alter table if exists public.posts add column if not exists meta_post_id text;
alter table if exists public.posts add column if not exists meta_publish_id text;
alter table if exists public.generation_jobs add column if not exists type text;
alter table if exists public.generation_jobs add column if not exists payload jsonb default '{}'::jsonb;
alter table if exists public.generation_jobs add column if not exists result jsonb default '{}'::jsonb;
alter table if exists public.generation_jobs add column if not exists finished_at timestamptz;
alter table if exists public.generation_jobs add column if not exists technical_detail text;

create index if not exists idx_generation_jobs_v3_queue on public.generation_jobs(status, available_at, priority, created_at);
create index if not exists idx_generation_jobs_v3_post on public.generation_jobs(post_id, created_at desc);
create index if not exists idx_post_versions_v3_post on public.post_versions(post_id, created_at desc);
create unique index if not exists posts_source_idea_id_unique_idx on public.posts(source_idea_id) where source_idea_id is not null;

update public.app_users set email = replace(email, 'rodrigo', 'mauricio'), full_name = replace(coalesce(full_name, ''), 'Rodrigo', 'Mauricio') where email ilike '%rodrigo%' or full_name ilike '%Rodrigo%';
update public.worker_devices set name = replace(coalesce(name, ''), 'Rodrigo', 'Mauricio') where name ilike '%Rodrigo%';

insert into public.ai_brain_rules(brand_id, name, category, content, priority, active)
select b.id, 'Direção Criativa Premium 2026', 'visual',
'Criar imagens premium para incorporadora: arquitetura realista, composição editorial, luz natural, materiais nobres, paisagismo, alto padrão, sem texto na arte, sem logo falso, sem watermark, sem neon, sem poluição. Imagem deve parecer campanha profissional de construtora/incorporadora, não stock genérico.', 100, true
from public.brands b
where not exists (select 1 from public.ai_brain_rules r where r.brand_id=b.id and r.name='Direção Criativa Premium 2026');

insert into public.ai_brain_rules(brand_id, name, category, content, priority, active)
select b.id, 'Planejamento Real por IA', 'strategy',
'O planejamento mensal deve ser criado por IA com base na memória da marca, Cérebro IA, biblioteca, persona, público, região e objetivo do mês. Proibido usar lista fixa, mock, tema genérico repetido ou conteúdo sem conexão com a marca.', 99, true
from public.brands b
where not exists (select 1 from public.ai_brain_rules r where r.brand_id=b.id and r.name='Planejamento Real por IA');

create or replace function public.build_prompt_payload(p_post_id uuid, p_job_type text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_post public.posts;
  v_profile public.brand_profiles;
  v_rules jsonb;
  v_templates jsonb;
  v_refs jsonb;
  v_final_prompt text;
  v_size text;
  v_payload jsonb;
  v_prompt_id uuid;
  v_job_type text := lower(coalesce(p_job_type,'image'));
begin
  select * into v_post from public.posts where id=p_post_id;
  if not found then raise exception 'post não encontrado'; end if;
  select * into v_profile from public.brand_profiles where brand_id=v_post.brand_id;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.priority desc), '[]'::jsonb) into v_rules from public.ai_brain_rules r where r.brand_id=v_post.brand_id and coalesce(r.active,true)=true and r.archived_at is null;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.version desc), '[]'::jsonb) into v_templates from public.ai_prompt_templates t where (t.brand_id=v_post.brand_id or t.brand_id is null) and coalesce(t.active,true)=true and t.archived_at is null;
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_refs from (select * from public.library_items l where l.brand_id=v_post.brand_id and l.archived_at is null and coalesce(l.ai_allowed,true)=true limit 12) x;

  v_size := case
    when lower(coalesce(v_post.format,'')) like '%story%' or lower(coalesce(v_post.format,'')) like '%reels%' or lower(coalesce(v_post.format,'')) like '%vídeo%' or lower(coalesce(v_post.format,'')) like '%video%' then '1024x1536'
    when lower(coalesce(v_post.format,'')) like '%quadrado%' then '1024x1024'
    when lower(coalesce(v_post.format,'')) like '%facebook%' then '1536x1024'
    else '1024x1536'
  end;

  v_final_prompt := concat_ws(E'\n\n',
    'Você é o Cérebro IA MYINC, social media sênior para incorporadora/construtora premium.',
    'BRAND PROFILE: ' || coalesce(to_jsonb(v_profile)::text,'{}'),
    'REGRAS DO CÉREBRO IA: ' || coalesce(v_rules::text,'[]'),
    'TEMPLATES/PROMPTS ATIVOS: ' || coalesce(v_templates::text,'[]'),
    'REFERÊNCIAS/BIBLIOTECA: ' || coalesce(v_refs::text,'[]'),
    'POST: ' || to_jsonb(v_post)::text,
    case when v_job_type='content' then 'Tarefa: gerar copy final, legenda, hashtags, CTA, headline e briefing visual. Retorne JSON.' else 'Tarefa visual: gerar criativo premium de alto padrão. Sem texto na imagem. Sem logo falso. Sem watermark. Fotografia/render arquitetônico editorial, luz natural, composição de campanha, qualidade incorporadora premium.' end,
    'Formato: ' || coalesce(v_post.format,'Feed 1080x1350') || '. Canal: ' || coalesce(v_post.channel,'Instagram') || '. Tamanho OpenAI: ' || v_size
  );

  insert into public.prompt_builds(brand_id, post_id, build_type, final_prompt, payload)
  values(v_post.brand_id, p_post_id, v_job_type, v_final_prompt, jsonb_build_object('rules',v_rules,'templates',v_templates,'refs',v_refs,'post',to_jsonb(v_post)))
  returning id into v_prompt_id;

  v_payload := jsonb_build_object(
    'task', v_job_type,
    'model', case when v_job_type='content' then coalesce(current_setting('app.openai_text_model', true),'gpt-4o-mini') else coalesce(current_setting('app.openai_image_model', true),'gpt-image-1') end,
    'size', v_size,
    'quality', 'high',
    'format', 'png',
    'post', to_jsonb(v_post),
    'rules', v_rules,
    'templates', v_templates,
    'references', v_refs,
    'promptBuildId', v_prompt_id,
    'final_prompt', v_final_prompt,
    'page_count', case when lower(coalesce(v_post.format,'')) like '%8%' then 8 when lower(coalesce(v_post.format,'')) like '%carrossel%' then 5 else 1 end
  );
  return v_payload;
end; $$;

grant execute on function public.build_prompt_payload(uuid,text) to anon, authenticated;

create or replace function public.enqueue_post_generation(p_post_id uuid, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_post public.posts;
  v_batch uuid := gen_random_uuid();
  v_jobs jsonb := '[]'::jsonb;
  v_payload jsonb;
  v_type text;
  v_page_count int;
  i int;
  v_job public.generation_jobs;
begin
  select * into v_post from public.posts where id=p_post_id and deleted_at is null;
  if not found then raise exception 'post não encontrado ou excluído'; end if;

  v_payload := public.build_prompt_payload(p_post_id,'content');
  insert into public.generation_jobs(brand_id, post_id, batch_id, job_type, type, status, priority, provider, input_json, payload, prompt_build_id, idempotency_key, available_at)
  values(v_post.brand_id, p_post_id, v_batch, 'content', 'content', 'queued', 10, 'openai', v_payload, v_payload, (v_payload->>'promptBuildId')::uuid, 'content-'||p_post_id||'-'||v_batch, now()) returning * into v_job;
  v_jobs := v_jobs || to_jsonb(v_job);

  v_type := case
    when lower(coalesce(v_post.format,'')) like '%carrossel%' then 'carousel_page'
    when lower(coalesce(v_post.format,'')) like '%reels%' or lower(coalesce(v_post.format,'')) like '%vídeo%' or lower(coalesce(v_post.format,'')) like '%video%' then 'video'
    else 'image'
  end;
  v_payload := public.build_prompt_payload(p_post_id, v_type);
  v_page_count := greatest(1, least(8, coalesce((v_payload->>'page_count')::int,1)));

  if v_type='carousel_page' then
    for i in 1..v_page_count loop
      insert into public.generation_jobs(brand_id, post_id, batch_id, job_type, type, status, priority, provider, input_json, payload, prompt_build_id, idempotency_key, available_at)
      values(v_post.brand_id, p_post_id, v_batch, 'carousel_page', 'carousel_page', 'queued', 20+i, 'openai', v_payload || jsonb_build_object('page',i,'page_count',v_page_count), v_payload || jsonb_build_object('page',i,'page_count',v_page_count), (v_payload->>'promptBuildId')::uuid, 'carousel-'||p_post_id||'-'||i||'-'||v_batch, now()) returning * into v_job;
      v_jobs := v_jobs || to_jsonb(v_job);
    end loop;
  else
    insert into public.generation_jobs(brand_id, post_id, batch_id, job_type, type, status, priority, provider, input_json, payload, prompt_build_id, idempotency_key, available_at)
    values(v_post.brand_id, p_post_id, v_batch, v_type, v_type, 'queued', 20, 'openai', v_payload, v_payload, (v_payload->>'promptBuildId')::uuid, v_type||'-'||p_post_id||'-'||v_batch, now()) returning * into v_job;
    v_jobs := v_jobs || to_jsonb(v_job);
  end if;

  update public.posts set status='em_fila', batch_id=v_batch, error_message=null, updated_at=now() where id=p_post_id;
  return jsonb_build_object('ok',true,'batchId',v_batch,'queued',jsonb_array_length(v_jobs),'jobs',v_jobs);
end; $$;

grant execute on function public.enqueue_post_generation(uuid,boolean) to anon, authenticated;

update public.generation_jobs
set status='queued', error_message=null, error_code=null, progress=0, locked_by=null, locked_at=null, available_at=now(), updated_at=now()
where status='failed' and (error_message ilike '%response_format%' or error_message ilike '%timeout%' or error_message ilike '%unsupported file%');
