import { BaseRepository } from "./base-repository";
import type { BrandProfileRow, BrandRow } from "@/lib/supabase/types";

export const brandRepository = new BaseRepository<BrandRow>("brands");
export const brandProfileRepository = new BaseRepository<BrandProfileRow>("brand_profiles");
export const brandVoiceRuleRepository = new BaseRepository<{
  id: string;
  brand_id: string;
  archived_at?: string | null;
  updated_at?: string | null;
}>("brand_voice_rules");
export const brandVisualRuleRepository = new BaseRepository<{
  id: string;
  brand_id: string;
  archived_at?: string | null;
  updated_at?: string | null;
}>("brand_visual_rules");
export const brandProductRepository = new BaseRepository<{
  id: string;
  brand_id: string;
  archived_at?: string | null;
  updated_at?: string | null;
}>("brand_products");
export const brandServiceRepository = new BaseRepository<{
  id: string;
  brand_id: string;
  archived_at?: string | null;
  updated_at?: string | null;
}>("brand_services");
export const brandReferenceRepository = new BaseRepository<{
  id: string;
  brand_id: string;
  archived_at?: string | null;
  updated_at?: string | null;
}>("brand_references");
export const brandColorPaletteRepository = new BaseRepository<{
  id: string;
  brand_id: string;
  archived_at?: string | null;
  updated_at?: string | null;
}>("brand_color_palette");

export const DEFAULT_MYINC_BRAND_MEMORY: Record<string, string> = {
  name: "MYINC",
  public_name: "MYINC",
  site: "https://myinc.com.br",
  instagram: "",
  facebook: "",
  whatsapp: "",
  commercial_email: "",
  region: "Brasil",
  niche: "Incorporação imobiliária, arquitetura, engenharia e imóveis de alto padrão",
  segment: "Incorporadora premium",
  primary_audience:
    "Famílias, investidores e compradores exigentes que buscam imóveis seguros, bem localizados, com arquitetura contemporânea e alto padrão de execução.",
  secondary_audience:
    "Corretores, parceiros estratégicos, investidores, arquitetos, engenheiros e público interessado em patrimônio imobiliário.",
  persona:
    "Cliente criterioso, racional e emocional ao mesmo tempo; valoriza segurança, localização, estética, solidez da construtora, clareza comercial e valorização patrimonial.",
  problems_solved:
    "Reduz insegurança na compra, mostra qualidade técnica, traduz diferenciais do empreendimento e aumenta confiança na decisão.",
  benefits:
    "Segurança patrimonial, conforto, arquitetura moderna, localização estratégica, acabamento premium, valorização e experiência de morar melhor.",
  differentiators:
    "Autoridade técnica, padrão arquitetônico, comunicação clara, obra bem executada, visão consultiva e posicionamento sofisticado.",
  products: "Apartamentos, casas, empreendimentos residenciais e soluções imobiliárias premium.",
  services: "Venda consultiva, apresentação de empreendimentos, atendimento comercial e relacionamento com compradores e investidores.",
  average_ticket: "Alto padrão / médio-alto padrão",
  objections:
    "Preço, prazo de obra, financiamento, confiança na construtora, comparação com outros imóveis, documentação, localização e percepção de valor.",
  guarantees:
    "Comunicação transparente, documentação organizada, qualidade técnica, acompanhamento comercial e entrega alinhada ao posicionamento da marca.",
  social_proof:
    "Obras, clientes, empreendimentos entregues, bastidores técnicos, evolução da construção, depoimentos, visitas e diferenciais comprováveis.",
  cases: "Use cases reais e bastidores dos empreendimentos quando disponíveis na biblioteca.",
  testimonials: "Priorizar depoimentos reais quando enviados para a Biblioteca.",
  faq:
    "Explique com clareza financiamento, localização, acabamento, cronograma, diferenciais, segurança da compra e próximos passos.",
  tone: "Premium, consultivo, claro, humano, técnico sem ser frio, sofisticado e seguro.",
  communication_style:
    "Frases objetivas, linguagem de autoridade, sem exagero comercial, com clareza visual e foco em confiança.",
  preferred_words:
    "alto padrão, segurança, valorização, arquitetura, localização, conforto, projeto, acabamento, confiança, exclusividade, morar bem, patrimônio",
  forbidden_words:
    "baratinho, imperdível demais, milagre, garantido sem comprovação, renda fácil, oportunidade única exagerada",
  usual_phrases:
    "Um projeto pensado para quem valoriza qualidade, segurança e bem-estar. / Mais do que morar: construir patrimônio com inteligência.",
  never_use_phrases:
    "Compre agora ou vai perder tudo. / Lucro garantido. / O melhor do Brasil sem prova.",
  forbidden_phrases:
    "lucro garantido, valorização garantida, renda garantida, aprovação garantida, obra sem risco",
  forbidden_promises:
    "Não prometer valorização, lucro, aprovação financeira, prazo ou garantia que não esteja documentada.",
  allowed_technical_terms:
    "implantação, fachada, metragem, planta, acabamento, infraestrutura, área comum, padrão construtivo, insolação, ventilação, localização",
  avoided_technical_terms:
    "Jargões excessivamente técnicos sem explicação simples para o cliente final.",
  primary_palette: "Preto, branco, tons neutros, laranja MYINC e variações sofisticadas.",
  secondary_palette: "Cinza, areia, off-white, concreto, madeira, tons naturais e arquitetura contemporânea.",
  forbidden_colors: "Neon excessivo, cores infantis, poluição visual, paletas que pareçam varejo popular.",
  brand_fonts: "Montserrat e fontes sans-serif modernas, limpas e premium.",
  preferred_visual_style:
    "Arquitetura realista premium, luz natural, composição limpa, fachadas elegantes, interiores sofisticados, pessoas com aparência natural e pouco texto na imagem.",
  forbidden_visual_style:
    "Imagem poluída, texto distorcido, logo falsa, watermark, mockup genérico pobre, estética infantil, baixa resolução e excesso de elementos.",
  preferred_images:
    "Fachadas realistas, detalhes de acabamento, lifestyle sofisticado, plantas humanizadas, bastidores de obra premium e imagens de arquitetura bem iluminadas.",
  avoided_images:
    "Imagens genéricas de banco sem identidade, prédios tortos, textos ilegíveis, pessoas artificiais demais e cenas com aparência fake.",
  logo_rules:
    "Preservar respiro, contraste e proporção. Nunca distorcer, redesenhar ou inventar logo. Usar logo oficial enviada na Biblioteca quando disponível.",
  composition_rules:
    "Composição elegante, hierarquia clara, pouco texto, foco no imóvel/benefício, contraste correto e aparência de agência premium.",
  image_text_rules:
    "Evitar texto dentro da imagem gerada por IA. Quando necessário, usar texto curto, legível e aplicado pelo frontend/template, não pela IA da imagem.",
  approved_references:
    "Usar referências aprovadas na Biblioteca: logo, imagens de empreendimentos, identidade visual, materiais comerciais e exemplos validados.",
  bad_references:
    "Não usar referências antigas, imagens sem qualidade, materiais fora da identidade MYINC ou peças com visual amador.",
  mantra:
    "Toda criação da MYINC deve parecer uma peça premium de incorporadora: visual limpo, arquitetura sofisticada, texto consultivo, promessa responsável e alta confiança comercial.",
};

function encode(value: string) {
  return encodeURIComponent(value);
}

export async function getFirstAccessibleBrand(token: string) {
  const [brand] = await brandRepository.list(
    token,
    "select=*&status=eq.active&archived_at=is.null&order=created_at.asc&limit=1",
  );
  return brand ?? null;
}

async function getFirstBrandProfile(token: string, brandId: string) {
  const [profile] = await brandProfileRepository.list(
    token,
    `select=*&brand_id=eq.${encode(brandId)}&archived_at=is.null&order=created_at.asc&limit=1`,
  );
  return profile ?? null;
}

export async function ensureEditableMyincBrand(token: string, preferredBrandId?: string | null) {
  let created = false;
  let brand = preferredBrandId ? await brandRepository.getById(token, preferredBrandId) : null;
  if (!brand) brand = await getFirstAccessibleBrand(token);

  if (!brand) {
    brand = await brandRepository.create(token, {
      name: "MYINC",
      public_name: "MYINC",
      slug: "myinc",
      status: "active",
      metadata: {
        seed: "frontend-memoria-da-marca-v4-1",
        owner_name: "Mauricio",
      },
    } as never);
    created = true;
  }

  let profile = await getFirstBrandProfile(token, brand.id);
  if (!profile) {
    profile = await brandProfileRepository.create(token, {
      brand_id: brand.id,
      ...Object.fromEntries(
        Object.entries(DEFAULT_MYINC_BRAND_MEMORY).filter(
          ([key]) => !["name", "public_name"].includes(key),
        ),
      ),
      metadata: {
        seed: "frontend-memoria-da-marca-v4-1",
        editable: true,
      },
    } as never);
    created = true;
  }

  return { brand, profile, created };
}

export async function ensureFirstBrand(token: string) {
  const { brand } = await ensureEditableMyincBrand(token);
  return brand;
}
