-- MYINC PATCH CÉREBRO / MEMÓRIA DA MARCA V6.6.4
-- Corrige o caso em que o pack foi aplicado em uma marca diferente da marca ativa do frontend.
-- Esta versão aplica o pack em TODAS as marcas ativas e não arquivadas.
-- Não usa tabela temporária, não usa brands.site_url e não depende de uma única brand_id.

begin;

-- Garante que exista pelo menos uma marca ativa chamada MYINC, caso o banco esteja vazio/incompleto.
insert into public.brands (name, public_name, slug, status, metadata, created_at, updated_at)
select 'MYINC', 'MYINC', 'myinc', 'active', jsonb_build_object('seed','MYINC V6.6.4'), now(), now()
where not exists (select 1 from public.brands);

-- Se houver uma marca MYINC inativa/arquivada, torna visível para o frontend.
update public.brands
set status = 'active', archived_at = null, deleted_at = null, updated_at = now()
where lower(coalesce(name,'')) like '%myinc%'
   or lower(coalesce(public_name,'')) like '%myinc%'
   or lower(coalesce(slug,'')) like '%myinc%';

-- Atualiza perfil das marcas ativas, que são exatamente as marcas que o frontend consegue carregar.
with target_brands as (
  select id
  from public.brands
  where coalesce(status, 'active') = 'active'
    and archived_at is null
    and deleted_at is null
), upd as (
  update public.brand_profiles bp
  set
    site = 'https://myinc.com.br',
    instagram = coalesce(nullif(bp.instagram, ''), '@myinc'),
    region = coalesce(nullif(bp.region, ''), 'Brasil'),
    niche = 'incorporadora',
    segment = 'Incorporação, imóveis de alto padrão, arquitetura, engenharia e construção civil',
    primary_audience = 'Famílias, investidores e compradores exigentes que buscam imóvel de alto padrão com segurança, qualidade, funcionalidade e valorização responsável.',
    secondary_audience = 'Arquitetos, corretores, proprietários de terreno, parceiros e público premium interessado em construção civil.',
    persona = 'Pessoa que busca conteúdo útil sobre construção civil, compra de imóvel, arquitetura, legislação, obra, acabamento, valorização responsável e decisões imobiliárias mais inteligentes.',
    problems_solved = 'Dúvidas sobre construção civil, leis, documentação, etapas de obra, qualidade construtiva, escolha de imóvel, acabamento, localização, arquitetura e segurança na decisão.',
    benefits = 'Conteúdo confiável, visão técnica, educação imobiliária, segurança de decisão, entendimento de leis, arquitetura de alto padrão, qualidade de vida e patrimônio.',
    differentiators = 'Olhar premium, conteúdo educativo, abordagem consultiva, inteligência de mercado, arquitetura contemporânea, acabamento de qualidade e experiência prática como incorporadora e construtora.',
    objections = 'Medo de tomar decisão errada, dúvidas sobre obra e documentação, insegurança sobre qualidade construtiva, receio de promessa exagerada, dificuldade para entender leis e etapas da construção.',
    tone = 'sofisticado, humano, claro, consultivo, seguro, didático e premium',
    communication_style = 'frases claras e curtas, autoridade sem arrogância, linguagem acessível, tom elegante e explicativo, foco em confiança e utilidade',
    preferred_words = 'alto padrão, sofisticação, confiança, projeto, localização, acabamento, arquitetura, conforto, segurança, escolha inteligente, patrimônio, qualidade de vida, funcionalidade, valorização responsável',
    forbidden_words = 'barato, imperdível, corra, última chance, renda garantida, lucro garantido, milionário, fórmula, panfleto, oportunidade explosiva',
    usual_phrases = 'Um projeto pensado para quem valoriza qualidade, segurança e bem-estar. / Mais do que morar: construir patrimônio com inteligência. / Entenda antes de decidir.',
    never_use_phrases = 'Compre agora ou vai perder tudo. / Lucro garantido. / O melhor do Brasil sem prova. / Renda garantida.',
    forbidden_phrases = 'lucro garantido, valorização garantida, renda garantida, aprovação garantida, compre agora ou perca tudo',
    forbidden_promises = 'não prometer valorização garantida, retorno financeiro garantido, renda garantida, aprovação garantida ou qualquer promessa absoluta',
    allowed_technical_terms = 'incorporação, memorial descritivo, habite-se, alvará, norma técnica, projeto arquitetônico, estrutura, impermeabilização, acabamento, implantação, retrofit, documentação, viabilidade, lote, matrícula, escritura, convenção, memorial de incorporação',
    avoided_technical_terms = 'termos técnicos sem explicação, juridiquês excessivo, engenharia complexa sem contexto, siglas sem definição',
    primary_palette = 'off-white, areia, bege claro, cinza claro, grafite suave, cobre discreto, madeira natural e verde sutil',
    secondary_palette = 'tons claros, texturas naturais, iluminação natural, cinza quente, bege, branco quente e detalhes sofisticados',
    forbidden_colors = 'fundo escuro, preto dominante, neon, cores infantis, saturação exagerada, vermelho agressivo, visual poluído',
    brand_fonts = 'Montserrat, sans serif moderna e premium',
    preferred_visual_style = 'fundo claro obrigatório, arquitetura contemporânea brasileira, fotografia editorial, render realista premium, luz natural, composição limpa, materiais nobres, visual luminoso e sofisticado',
    forbidden_visual_style = 'fundo escuro, template barato, panfleto, excesso de texto, montagem amadora, visual genérico, render plástico, estética pesada',
    preferred_images = 'fachadas, interiores, hall, paisagismo, detalhes construtivos, cidade, canteiro organizado, equipe técnica, materiais nobres, texturas, luz natural, áreas de convivência, plantas e detalhes de obra',
    avoided_images = 'pessoas deformadas, texto dentro da imagem, logos falsos, watermark, objetos duplicados, geometria impossível, fundo escuro, visual amador',
    logo_rules = 'usar logo apenas quando houver asset aprovado. Nunca inventar logo. Manter proporção, respiro e contraste elegante.',
    composition_rules = 'sempre usar fundo claro; privilegiar off-white, areia, bege claro e luz natural; manter hierarquia visual limpa, pouco texto, respiro, grids consistentes e visual editorial premium.',
    image_text_rules = 'preferir arte com pouco texto. Quando houver texto, usar headline curta, alta legibilidade e contraste elegante. Para imagens base geradas por IA, priorizar sem texto embutido.',
    approved_references = 'site myinc.com.br, arquitetura contemporânea, construção civil, alto padrão, design funcional, obra, detalhes construtivos, documentação e conteúdo educativo.',
    bad_references = 'fundo escuro, estética genérica de banco de imagem, panfleto, cores neon, texto excessivo, render plástico, promessa exagerada.',
    mantra = 'MYINC é uma incorporadora e construtora premium. Cada conteúdo deve unir arquitetura, funcionalidade, confiança, clareza, educação e sofisticação. A promessa central é construir patrimônio com inteligência, sempre mais próximos de você.',
    target_audience = 'Famílias, investidores, compradores exigentes e proprietários de terreno que buscam informação clara, segurança e projetos de alto padrão.',
    tone_of_voice = 'premium, didático, consultivo, humano e seguro',
    verbal_identity = 'educar com clareza, autoridade sem arrogância, linguagem elegante, útil e próxima',
    visual_identity = 'fundo claro obrigatório, estética premium, luz natural, arquitetura, materiais nobres, composição limpa',
    color_palette = jsonb_build_object('primary', array['off-white','areia','bege claro','cinza claro','grafite suave'], 'accent', array['cobre discreto','madeira natural','verde sutil'], 'forbidden', array['fundo escuro','preto dominante','neon','vermelho agressivo']),
    typography = 'Montserrat ou sans serif moderna e premium',
    logo_notes = 'usar somente logo aprovado da biblioteca, sem distorção e com respiro',
    restrictions = 'fundo claro obrigatório; evitar promessa absoluta; evitar texto longo em arte; evitar fundo escuro; evitar linguagem apelativa',
    metadata = coalesce(bp.metadata, '{}'::jsonb) || jsonb_build_object('brand_memory_patch', 'V6.6.4', 'visual_must', 'fundo claro obrigatório'),
    archived_at = null,
    deleted_at = null,
    updated_at = now()
  from target_brands tb
  where bp.brand_id = tb.id
  returning bp.brand_id
)
insert into public.brand_profiles (brand_id, site, instagram, region, niche, segment, primary_audience, secondary_audience, persona, problems_solved, benefits, differentiators, objections, tone, communication_style, preferred_words, forbidden_words, usual_phrases, never_use_phrases, forbidden_phrases, forbidden_promises, allowed_technical_terms, avoided_technical_terms, primary_palette, secondary_palette, forbidden_colors, brand_fonts, preferred_visual_style, forbidden_visual_style, preferred_images, avoided_images, logo_rules, composition_rules, image_text_rules, approved_references, bad_references, mantra, target_audience, tone_of_voice, verbal_identity, visual_identity, color_palette, typography, logo_notes, restrictions, metadata, created_at, updated_at)
select tb.id, 'https://myinc.com.br', '@myinc', 'Brasil', 'incorporadora', 'Incorporação, imóveis de alto padrão, arquitetura, engenharia e construção civil',
'Famílias, investidores e compradores exigentes que buscam imóvel de alto padrão com segurança, qualidade, funcionalidade e valorização responsável.',
'Arquitetos, corretores, proprietários de terreno, parceiros e público premium interessado em construção civil.',
'Pessoa que busca conteúdo útil sobre construção civil, compra de imóvel, arquitetura, legislação, obra, acabamento, valorização responsável e decisões imobiliárias mais inteligentes.',
'Dúvidas sobre construção civil, leis, documentação, etapas de obra, qualidade construtiva, escolha de imóvel, acabamento, localização, arquitetura e segurança na decisão.',
'Conteúdo confiável, visão técnica, educação imobiliária, segurança de decisão, entendimento de leis, arquitetura de alto padrão, qualidade de vida e patrimônio.',
'Olhar premium, conteúdo educativo, abordagem consultiva, inteligência de mercado, arquitetura contemporânea, acabamento de qualidade e experiência prática como incorporadora e construtora.',
'Medo de tomar decisão errada, dúvidas sobre obra e documentação, insegurança sobre qualidade construtiva, receio de promessa exagerada, dificuldade para entender leis e etapas da construção.',
'sofisticado, humano, claro, consultivo, seguro, didático e premium',
'frases claras e curtas, autoridade sem arrogância, linguagem acessível, tom elegante e explicativo, foco em confiança e utilidade',
'alto padrão, sofisticação, confiança, projeto, localização, acabamento, arquitetura, conforto, segurança, escolha inteligente, patrimônio, qualidade de vida, funcionalidade, valorização responsável',
'barato, imperdível, corra, última chance, renda garantida, lucro garantido, milionário, fórmula, panfleto, oportunidade explosiva',
'Um projeto pensado para quem valoriza qualidade, segurança e bem-estar. / Mais do que morar: construir patrimônio com inteligência. / Entenda antes de decidir.',
'Compre agora ou vai perder tudo. / Lucro garantido. / O melhor do Brasil sem prova. / Renda garantida.',
'lucro garantido, valorização garantida, renda garantida, aprovação garantida, compre agora ou perca tudo',
'não prometer valorização garantida, retorno financeiro garantido, renda garantida, aprovação garantida ou qualquer promessa absoluta',
'incorporação, memorial descritivo, habite-se, alvará, norma técnica, projeto arquitetônico, estrutura, impermeabilização, acabamento, implantação, retrofit, documentação, viabilidade, lote, matrícula, escritura, convenção, memorial de incorporação',
'termos técnicos sem explicação, juridiquês excessivo, engenharia complexa sem contexto, siglas sem definição',
'off-white, areia, bege claro, cinza claro, grafite suave, cobre discreto, madeira natural e verde sutil',
'tons claros, texturas naturais, iluminação natural, cinza quente, bege, branco quente e detalhes sofisticados',
'fundo escuro, preto dominante, neon, cores infantis, saturação exagerada, vermelho agressivo, visual poluído',
'Montserrat, sans serif moderna e premium',
'fundo claro obrigatório, arquitetura contemporânea brasileira, fotografia editorial, render realista premium, luz natural, composição limpa, materiais nobres, visual luminoso e sofisticado',
'fundo escuro, template barato, panfleto, excesso de texto, montagem amadora, visual genérico, render plástico, estética pesada',
'fachadas, interiores, hall, paisagismo, detalhes construtivos, cidade, canteiro organizado, equipe técnica, materiais nobres, texturas, luz natural, áreas de convivência, plantas e detalhes de obra',
'pessoas deformadas, texto dentro da imagem, logos falsos, watermark, objetos duplicados, geometria impossível, fundo escuro, visual amador',
'usar logo apenas quando houver asset aprovado. Nunca inventar logo. Manter proporção, respiro e contraste elegante.',
'sempre usar fundo claro; privilegiar off-white, areia, bege claro e luz natural; manter hierarquia visual limpa, pouco texto, respiro, grids consistentes e visual editorial premium.',
'preferir arte com pouco texto. Quando houver texto, usar headline curta, alta legibilidade e contraste elegante. Para imagens base geradas por IA, priorizar sem texto embutido.',
'site myinc.com.br, arquitetura contemporânea, construção civil, alto padrão, design funcional, obra, detalhes construtivos, documentação e conteúdo educativo.',
'fundo escuro, estética genérica de banco de imagem, panfleto, cores neon, texto excessivo, render plástico, promessa exagerada.',
'MYINC é uma incorporadora e construtora premium. Cada conteúdo deve unir arquitetura, funcionalidade, confiança, clareza, educação e sofisticação. A promessa central é construir patrimônio com inteligência, sempre mais próximos de você.',
'Famílias, investidores, compradores exigentes e proprietários de terreno que buscam informação clara, segurança e projetos de alto padrão.',
'premium, didático, consultivo, humano e seguro',
'educar com clareza, autoridade sem arrogância, linguagem elegante, útil e próxima',
'fundo claro obrigatório, estética premium, luz natural, arquitetura, materiais nobres, composição limpa',
jsonb_build_object('primary', array['off-white','areia','bege claro','cinza claro','grafite suave'], 'accent', array['cobre discreto','madeira natural','verde sutil'], 'forbidden', array['fundo escuro','preto dominante','neon','vermelho agressivo']),
'Montserrat ou sans serif moderna e premium',
'usar somente logo aprovado da biblioteca, sem distorção e com respiro',
'fundo claro obrigatório; evitar promessa absoluta; evitar texto longo em arte; evitar fundo escuro; evitar linguagem apelativa',
jsonb_build_object('brand_memory_patch','V6.6.4','visual_must','fundo claro obrigatório'), now(), now()
from target_brands tb
where not exists (select 1 from public.brand_profiles bp where bp.brand_id = tb.id);

-- Limpa somente regras/prompts do pack anterior nas marcas ativas, para não apagar regras manuais futuras.
with target_brands as (
  select id from public.brands where coalesce(status, 'active') = 'active' and archived_at is null and deleted_at is null
)
delete from public.ai_brain_rules r
using target_brands tb
where r.brand_id = tb.id
  and (r.metadata->>'pack' like 'MYINC V6.6%' or r.name in ('Posicionamento central da marca', 'Objetivo do Instagram', 'Pilares editoriais obrigatórios', 'Tom de voz', 'Voz consultiva', 'Palavras preferidas', 'Palavras proibidas', 'Promessas proibidas', 'Assinatura conceitual', 'Base factual do site', 'Construção civil educativa', 'Leis e normas', 'Dúvidas frequentes', 'Curiosidades e repertório', 'Autoridade técnica', 'Prova social e institucional', 'CTA elegante', 'Estrutura de copy', 'Fundo claro obrigatório', 'Estética visual premium', 'Cores permitidas', 'Cores proibidas', 'Imagens preferidas', 'Imagens evitadas', 'Carrossel capa', 'Carrossel páginas internas', 'Stories', 'Reels e vídeos', 'Uso de foto pessoal', 'Uso de biblioteca', 'Score mínimo de qualidade', 'Negative prompt visual', 'Foco em construção civil', 'Identidade de alto padrão'));

with target_brands as (
  select id from public.brands where coalesce(status, 'active') = 'active' and archived_at is null and deleted_at is null
)
delete from public.ai_prompt_templates p
using target_brands tb
where p.brand_id = tb.id
  and (p.metadata->>'pack' like 'MYINC V6.6%' or p.name in ('Prompt mestre MYINC V6.6.4', 'Template de planejamento editorial', 'Template feed / imagem estática', 'Template carrossel educativo', 'Template Reels / vídeo curto', 'Template conteúdo legal / dúvidas / curiosidades'));

-- Insere regras em TODAS as marcas ativas, inclusive a que o frontend escolhe.
with target_brands as (
  select id from public.brands where coalesce(status, 'active') = 'active' and archived_at is null and deleted_at is null
), rules(name, category, content, priority) as (
  values
    ('Posicionamento central da marca', 'posicionamento', 'A MYINC deve ser percebida como incorporadora e construtora premium, confiável, técnica e próxima. O conteúdo deve transmitir inteligência, segurança, qualidade de vida, funcionalidade e sofisticação sem exagero publicitário.', 1000),
    ('Objetivo do Instagram', 'estrategia', 'O Instagram da MYINC deve educar, gerar autoridade, relacionamento e oportunidades comerciais qualificadas. Os conteúdos precisam ensinar sobre construção civil, legislação, dúvidas frequentes, ideias, curiosidades, arquitetura, obras, design, compra inteligente e valorização responsável.', 995),
    ('Pilares editoriais obrigatórios', 'estrategia', 'Usar como pilares editoriais: construção civil, legislação e normas, dúvidas frequentes, curiosidades do setor, arquitetura e design, obra e bastidores, compra inteligente, valorização responsável, localização e qualidade de vida, prova social, institucional e relacionamento.', 990),
    ('Tom de voz', 'copy', 'Tom sempre sofisticado, humano, claro, consultivo, didático e premium. Explicar com simplicidade sem parecer raso. Falar como especialista que orienta e acolhe, não como panfleto comercial.', 985),
    ('Voz consultiva', 'copy', 'Priorizar linguagem de orientação: entenda, veja, saiba, vale observar, um ponto importante, na prática, isso significa. Evitar pressão comercial exagerada.', 980),
    ('Palavras preferidas', 'copy', 'Favorecer palavras como: alto padrão, sofisticação, confiança, projeto, localização, acabamento, arquitetura, conforto, segurança, escolha inteligente, patrimônio, qualidade de vida, funcionalidade, valorização responsável.', 975),
    ('Palavras proibidas', 'copy', 'Evitar: barato, imperdível, corra, última chance, renda garantida, lucro garantido, milionário, fórmula, panfleto, oportunidade explosiva, compre já ou vai perder tudo.', 970),
    ('Promessas proibidas', 'compliance', 'Jamais prometer valorização garantida, retorno garantido, lucro certo, aprovação automática, prazos irreais ou qualquer promessa absoluta. Sempre usar comunicação responsável.', 965),
    ('Assinatura conceitual', 'marca', 'Sempre que fizer sentido, reforçar o espírito de proximidade e personalização da MYINC, alinhado à ideia de Mais Próximos de Você.', 960),
    ('Base factual do site', 'marca', 'Quando precisar resumir a marca, destacar: experiência no mercado imobiliário, criação e desenvolvimento do projeto até a entrega, compreensão das necessidades e estilo de vida do cliente, design, funcionalidade e excelência.', 955),
    ('Construção civil educativa', 'conteudo', 'A IA deve gerar conteúdo realmente útil sobre construção civil: etapas da obra, documentação, leis, normas, curiosidades, manutenção, estrutura, acabamento, planejamento, escolhas técnicas e decisões inteligentes.', 950),
    ('Leis e normas', 'conteudo', 'Criar conteúdos explicativos sobre legislação, normas, documentação, aprovações, condomínio, responsabilidade técnica, regularização, compra e construção, sempre com linguagem educativa e cautelosa.', 945),
    ('Dúvidas frequentes', 'conteudo', 'Criar conteúdos em formato FAQ: o que é, como funciona, qual a diferença, o que observar, quando vale a pena, quais erros evitar. A utilidade deve ser evidente.', 940),
    ('Curiosidades e repertório', 'conteudo', 'Criar posts de curiosidades inteligentes: materiais, arquitetura, urbanismo, tendências, iluminação, ventilação, layouts, sustentabilidade, engenharia e comportamento do morador.', 935),
    ('Autoridade técnica', 'conteudo', 'Explicar temas técnicos de forma acessível. Demonstrar conhecimento sem jargão excessivo. A marca deve soar segura e preparada.', 930),
    ('Prova social e institucional', 'conteudo', 'Intercalar conteúdos educativos com institucional, obra, bastidores, equipe, posicionamento, projetos, depoimentos e visão de mercado, sempre com elegância.', 925),
    ('CTA elegante', 'copy', 'As chamadas para ação devem ser elegantes e consultivas: Fale com nossa equipe, Converse com a MYINC, Tire sua dúvida, Descubra mais, Saiba como escolher melhor, Conheça nossos projetos.', 920),
    ('Estrutura de copy', 'copy', 'Toda copy deve buscar: gancho claro, explicação objetiva, utilidade prática e fechamento com CTA elegante. Nunca soar vazio ou genérico.', 915),
    ('Fundo claro obrigatório', 'visual', 'Toda publicação deve ter predominância de fundo claro. Proibir fundos escuros. Preferir off-white, areia, bege claro, cinza claro, iluminação natural e visual luminoso.', 910),
    ('Estética visual premium', 'visual', 'A estética deve parecer de incorporadora premium em 2026: sofisticada, clara, limpa, realista, com luz natural, materiais nobres, composição editorial e aparência refinada.', 905),
    ('Cores permitidas', 'visual', 'Usar grafite suave, off-white, areia, bege, cinza claro, cobre discreto, madeira natural, verde sutil e tons claros. A paleta principal deve transmitir luminosidade e elegância.', 900),
    ('Cores proibidas', 'visual', 'Evitar neon, cores infantis, saturação exagerada, vermelho agressivo, fundos pretos, marrom fechado e qualquer combinação que traga visual amador ou pesado.', 895),
    ('Imagens preferidas', 'visual', 'Preferir imagens de fachadas, interiores, hall, áreas comuns, paisagismo, cidade, detalhes construtivos, equipe técnica, materiais nobres, texturas e cenas de vida real relacionadas à moradia e construção.', 890),
    ('Imagens evitadas', 'visual', 'Evitar pessoas deformadas, excesso de texto dentro da imagem, logos falsos, watermark, render plástico, objetos duplicados, geometrias impossíveis e estética genérica.', 885),
    ('Carrossel capa', 'formato', 'Em carrosséis, a capa precisa ser forte, clara e organizada. Headline curta, fundo claro, visual elegante e promessa de aprendizado claro.', 880),
    ('Carrossel páginas internas', 'formato', 'Nas páginas internas do carrossel, manter consistência visual, ensinar um ponto por slide, usar hierarquia simples e evitar poluição. Cada página precisa ser útil isoladamente.', 875),
    ('Stories', 'formato', 'Stories devem ser rápidos, leves e diretos, mantendo padrão premium. Fundo claro, pouco texto e CTA simples.', 870),
    ('Reels e vídeos', 'formato', 'Reels devem ter começo forte, cenas claras, ritmo elegante, sensação premium, arquitetura, obra, bastidores ou explicação educativa. Evitar visual escuro e agressivo.', 865),
    ('Uso de foto pessoal', 'visual', 'Se houver foto da liderança, corretor, consultor ou equipe aprovada na biblioteca, usar como referência em conteúdos de autoridade, bastidor, institucional, prova social e atendimento.', 860),
    ('Uso de biblioteca', 'motor', 'Sempre que existirem referências aprovadas na biblioteca, o motor deve utilizá-las como guia visual para identidade, estilo, logo, foto pessoal, arquitetura, materiais e templates.', 855),
    ('Score mínimo de qualidade', 'qualidade', 'Antes de considerar uma peça pronta, avaliar força da copy, clareza da mensagem, aderência à marca, qualidade do prompt visual, potencial de conversão, utilidade do conteúdo e consistência visual. Meta: 85+.', 850),
    ('Negative prompt visual', 'visual', 'Negative prompt fixo: sem fundo escuro, sem poluição visual, sem texto longo embutido, sem panfleto, sem watermark, sem logos falsos, sem estética amadora, sem render plástico, sem pessoas deformadas.', 845),
    ('Foco em construção civil', 'estrategia', 'Em caso de dúvida entre tema institucional e educativo, priorizar o eixo educativo da construção civil: leis, ideias, dúvidas, curiosidades e entendimento do setor.', 840),
    ('Identidade de alto padrão', 'marca', 'Mesmo em conteúdo educativo, o conteúdo deve ter cara de alto padrão. Nunca parecer página genérica de curiosidades. A estética e a linguagem precisam carregar sofisticação.', 835)
)
insert into public.ai_brain_rules (brand_id, name, category, content, active, priority, default_content, metadata, archived_at, deleted_at, created_at, updated_at)
select tb.id, r.name, r.category, r.content, true, r.priority, r.content,
       jsonb_build_object('pack','MYINC V6.6.4','category',r.category,'applied_to','all_active_brands'),
       null, null, now(), now()
from target_brands tb cross join rules r;

-- Insere prompts base em TODAS as marcas ativas.
with target_brands as (
  select id from public.brands where coalesce(status, 'active') = 'active' and archived_at is null and deleted_at is null
), prompts(name, type, note, content) as (
  values
    ('Prompt mestre MYINC V6.6.4', 'master', 'Pack de prompt base MYINC V6.6.4', 'Você é o núcleo criativo sênior da MYINC. Sua missão é transformar estratégia de marca, regras do cérebro, memória da marca, biblioteca, feedback humano e objetivo do post em uma saída premium. A MYINC é uma incorporadora e construtora premium; o Instagram tem foco em construção civil, leis, ideias, dúvidas, curiosidades, arquitetura, obra e compra inteligente; todo conteúdo deve ser útil, claro, confiável e sofisticado; toda peça visual deve ter fundo claro; nunca usar fundo escuro como base principal; priorizar linguagem consultiva, educativa e premium; evitar promessas absolutas e linguagem apelativa; se houver ativos aprovados na biblioteca, usar como referência real; se houver foto pessoal/equipe aprovada e o tema permitir, usar como referência em conteúdos de autoridade, bastidores, institucional e prova social.'),
    ('Template de planejamento editorial', 'planning', 'Pack de prompt base MYINC V6.6.4', 'Gere ideias extremamente detalhadas para MYINC. Para cada ideia, retornar título, tema, objetivo, público, dor principal, insight educativo, ângulo estratégico, formato recomendado, headline, resumo da copy, CTA elegante, direção visual e prompt inicial. Priorizar construção civil, leis, dúvidas frequentes, curiosidades, arquitetura, design, obra, bastidores, escolhas inteligentes, manutenção, acabamento, valorização responsável e estilo de vida.'),
    ('Template feed / imagem estática', 'feed', 'Pack de prompt base MYINC V6.6.4', 'Criar uma peça de feed premium para MYINC. Visual obrigatório: fundo claro, composição limpa, sofisticação editorial, luz natural, arquitetura ou construção civil, pouco ou nenhum texto embutido. Copy obrigatória: gancho claro, explicação útil, tom premium e consultivo, CTA elegante. Negative prompt: sem fundo escuro, sem poluição visual, sem panfleto, sem aparência amadora, sem watermark, sem texto exagerado dentro da imagem.'),
    ('Template carrossel educativo', 'carousel', 'Pack de prompt base MYINC V6.6.4', 'Criar carrossel educativo premium para MYINC. Estrutura: capa com headline forte, contexto do problema, explicação simples, detalhe técnico, erro comum, conclusão e CTA elegante. Cada slide precisa ensinar algo. Manter fundo claro em todos os slides, headline curta, evitar excesso de texto e manter estética editorial premium.'),
    ('Template Reels / vídeo curto', 'video', 'Pack de prompt base MYINC V6.6.4', 'Criar roteiro e direção criativa de Reels premium para MYINC. Objetivo: educar, gerar autoridade e manter sofisticação. Estrutura: hook inicial forte, 3 a 5 cenas/blocos, explicação objetiva, imagens claras, arquitetura/obra/detalhes/equipe/lifestyle e encerramento com CTA suave. Visual sempre com fundo claro e sensação de incorporadora premium.'),
    ('Template conteúdo legal / dúvidas / curiosidades', 'education', 'Pack de prompt base MYINC V6.6.4', 'Criar conteúdo educativo premium para MYINC com base em leis, dúvidas ou curiosidades da construção civil. Explicar em português claro, soar como especialista confiável, evitar juridiquês excessivo, mostrar relevância prática e concluir com convite suave para conversar com a equipe ou acompanhar mais conteúdos.')
)
insert into public.ai_prompt_templates (brand_id, name, type, note, content, active, version, version_history, metadata, archived_at, deleted_at, created_at, updated_at)
select tb.id, p.name, p.type, p.note, p.content, true, 66,
       jsonb_build_array(jsonb_build_object('version',66,'label','MYINC V6.6.4')),
       jsonb_build_object('pack','MYINC V6.6.4','type',p.type,'applied_to','all_active_brands'),
       null, null, now(), now()
from target_brands tb cross join prompts p;

commit;

-- Resultado de conferência: esta tela deve retornar regras/prompts para a marca ativa do frontend.
select
  b.id as brand_id,
  b.name,
  b.public_name,
  b.status,
  count(distinct r.id) filter (where r.archived_at is null and r.deleted_at is null and r.active = true) as regras_ativas,
  count(distinct p.id) filter (where p.archived_at is null and p.deleted_at is null and p.active = true) as prompts_ativos
from public.brands b
left join public.ai_brain_rules r on r.brand_id = b.id
left join public.ai_prompt_templates p on p.brand_id = b.id
where coalesce(b.status, 'active') = 'active'
  and b.archived_at is null
  and b.deleted_at is null
group by b.id, b.name, b.public_name, b.status
order by b.created_at asc;
