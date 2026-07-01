-- V2 05 - Seed idempotente MYINC.
insert into public.app_users(email, full_name, role, status)
values ('m2pinturaslondrina@gmail.com', 'Rodrigo Carvalho Santos', 'admin', 'active')
on conflict (email) do update set full_name=excluded.full_name, role=excluded.role, status='active';

insert into public.brands(owner_user_id, name, public_name, status)
select u.id, 'MYINC', 'MYINC Incorporadora', 'active' from public.app_users u where u.email='m2pinturaslondrina@gmail.com'
on conflict (name) do update set public_name=excluded.public_name, status='active';

insert into public.brand_profiles(
  brand_id, site, instagram, region, niche, segment, primary_audience, benefits, differentiators, tone, communication_style,
  primary_palette, secondary_palette, forbidden_colors, brand_fonts, preferred_visual_style, forbidden_visual_style, logo_rules,
  composition_rules, image_text_rules, mantra, metadata
)
select b.id, 'https://myinc.com.br', '@myinc', 'Londrina e região', 'Incorporadora/construtora premium', 'Imobiliário alto padrão',
  'Famílias, investidores e compradores exigentes que buscam imóvel de alto padrão, segurança, localização e valorização.',
  'Qualidade de vida, localização estratégica, arquitetura funcional, obra bem conduzida e atendimento consultivo.',
  'Sofisticação, clareza, engenharia confiável, design contemporâneo e comunicação humana.',
  'Premium, humano, claro, sofisticado e direto.', 'Autoridade consultiva sem exagero comercial.',
  'grafite, off-white, areia', 'cobre/laranja discreto', 'neon, infantil, excesso de saturação', 'Montserrat',
  'Visual claro/lite, premium, arquitetura contemporânea, muito respiro, luz natural.',
  'Visual amador, panfleto, poluição visual, letras distorcidas, logo falso, watermark.',
  'Não criar logo falso. Não distorcer marca. Preferir arte sem texto quando a aplicação for compor depois.',
  'Pouco texto, hierarquia forte, áreas seguras, estética editorial imobiliária.',
  'Evitar renderizar texto pequeno na imagem. Se necessário, texto curto e conferido na revisão humana.',
  'Você é o núcleo de inteligência criativa da MYINC, uma incorporadora/construtora premium. Aja como estrategista de social media, copywriter, diretor de arte e revisor de qualidade para conteúdo imobiliário de alto padrão.',
  jsonb_build_object('version','v2.0.0-local-engine')
from public.brands b where b.name='MYINC'
on conflict (brand_id) do update set
  tone=excluded.tone, communication_style=excluded.communication_style, primary_palette=excluded.primary_palette,
  secondary_palette=excluded.secondary_palette, preferred_visual_style=excluded.preferred_visual_style,
  forbidden_visual_style=excluded.forbidden_visual_style, mantra=excluded.mantra, metadata=excluded.metadata;

insert into public.ai_brain_rules(brand_id, name, category, content, active, priority, default_content)
select b.id, v.name, v.category, v.content, true, v.priority, v.content
from public.brands b,
(values
('Regra de ouro visual', 'visual', 'Visual claro/lite, premium, sem poluição, sem neon, sem letras distorcidas e sem logo falso.', 100),
('Tom de voz', 'voice', 'Humano, sofisticado, direto, consultivo e claro. Sem promessas exageradas de valorização.', 90),
('Imagem sem texto por padrão', 'image', 'Gerar arte base preferencialmente sem texto/logos. Texto final pode ser aplicado pela camada visual do app.', 80),
('CTA comercial elegante', 'copy', 'Chamar para conversar, conhecer empreendimento ou agendar atendimento sem pressão excessiva.', 70)
) as v(name, category, content, priority)
where b.name='MYINC'
on conflict (brand_id,name) do update set content=excluded.content, active=true, priority=excluded.priority;

insert into public.ai_prompt_templates(brand_id, name, type, content, active, version)
select b.id, v.name, v.type, v.content, true, 1
from public.brands b,
(values
('Prompt Mestre MYINC', 'master', 'Use o mantra da marca, perfil, regras visuais, regras de voz e contexto do post para criar conteúdo premium imobiliário.'),
('Prompt de Imagem', 'image', 'Imagem premium de arquitetura contemporânea brasileira, luz natural, fundo claro/lite, sem texto, sem logo, sem watermark, composição editorial.'),
('Prompt de Carrossel', 'carousel', 'Criar páginas visuais coesas, cada página com uma ideia central, com respiro e hierarquia visual premium.'),
('Prompt de Reels', 'video', 'Criar roteiro visual para vídeo curto premium. Se não houver provider real, o motor deve falhar claramente sem simular sucesso.'),
('Negative Prompt', 'negative', 'texto distorcido, logo falso, watermark, neon, infantil, poluído, panfleto, baixa resolução, pessoas deformadas')
) as v(name,type,content)
where b.name='MYINC'
on conflict (brand_id,name,type) do update set content=excluded.content, active=true;

insert into public.app_settings(brand_id, key, value, is_public)
select b.id, 'v2_runtime', jsonb_build_object('architecture','local-engine','heavy_generation','local_exe','publisher','scheduled_edge_function'), true
from public.brands b where b.name='MYINC'
on conflict (brand_id,key) do update set value=excluded.value, is_public=excluded.is_public;
