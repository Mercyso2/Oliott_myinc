import type {
  ContentFormat,
  CustomCampaignTheme,
  SocialChannel,
  SocialPost,
} from "@/lib/social-types";

export interface MonthlyPlanInput {
  brandName: string;
  niche: string;
  monthlyObjective: string;
  mainOffer: string;
  targetAudience: string;
  tone: string;
  region: string;
  totalPosts: number;
  channels: string[];
  formats: Record<ContentFormat, number>;
  campaignDistribution: Record<string, number>;
  importantDates: string;
  customThemes: CustomCampaignTheme[];
}

export class AIContentService {
  static generateMasterPrompt(post: Partial<SocialPost>) {
    return `PROMPT MESTRE OPERACIONAL\nTema: ${post.theme ?? "a definir"}\nObjetivo: ${post.objective ?? "a definir"}\nCanal: ${post.channel ?? "Instagram/Facebook"}\nFormato: ${post.format ?? "Feed 1080x1350"}\nCTA: ${post.cta ?? "ação direta"}\n\nEm produção, o prompt completo é montado nas Edge Functions com memória da marca, regras reais, biblioteca aprovada, comentários e feedbacks salvos no Supabase.`;
  }

  static calculateQualityScore(
    post: Pick<SocialPost, "caption" | "imagePrompt" | "theme" | "channel" | "format">,
  ) {
    let score = 62;
    if (post.caption.length > 80 && post.caption.length < 650) score += 8;
    if (post.imagePrompt.includes("premium")) score += 8;
    if (post.imagePrompt.includes("Negative prompt")) score += 7;
    if (post.theme.length > 8) score += 5;
    if (post.channel && post.format) score += 5;
    if (!/garantido|milagre|viralize instantaneamente/i.test(post.caption)) score += 5;
    return Math.max(0, Math.min(100, score));
  }

  static buildImagePrompt(post: Partial<SocialPost>, dimension = "1080x1350") {
    return `Crie uma publicação final premium para ${post.channel ?? "Instagram"}/${post.format ?? "Feed"}, no tamanho ${dimension}. Tema: ${post.theme ?? "conteúdo estratégico"}. Objetivo: ${post.objective ?? "atração e autoridade"}. Fluxo obrigatório: gerar base visual sofisticada sem texto/logo inventado e finalizar com renderizador do app aplicando logo real, paleta, headline, CTA, camadas e profundidade. Negative prompt: baixa qualidade, design amador, excesso de texto, letras distorcidas, logo falso, poluição visual, imagem genérica, baixa resolução.`;
  }

  static generateMonthlyPlan(input: MonthlyPlanInput) {
    throw new Error(
      `Planejamento local desativado para ${input.brandName}. Use a tela Planejamento V2 para criar rascunhos e envie os posts para o Motor Local para IA real.`,
    );
  }

  static generatePostCopy(post: Partial<SocialPost>) {
    throw new Error(
      `Geração local desativada para ${post.title ?? "post"}. Use a fila generation_jobs/Motor Local V2 para gerar conteúdo real.`,
    );
  }

  static generateImagePrompt(post: Partial<SocialPost>) {
    return this.buildImagePrompt(post);
  }
}
