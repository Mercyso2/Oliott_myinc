import { callEdgeFunction, callRpc } from "@/lib/supabase/client";
import { BaseRepository } from "./base-repository";
import type { MonthlyPlanRow, PostIdeaRow } from "@/lib/supabase/types";

export const monthlyPlanRepository = new BaseRepository<MonthlyPlanRow>("monthly_plans");
export const postIdeaRepository = new BaseRepository<PostIdeaRow>("post_ideas");

function ensureOk<T extends { ok?: boolean; error?: unknown; message?: unknown }>(response: T, fallback: string): T {
  if (response && response.ok === false) {
    const detail = response.message || response.error || fallback;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return response;
}

export async function generateMonthlyPlan(token: string, payload: Record<string, unknown>) {
  const response = await callEdgeFunction<{
    ok: true | false;
    monthlyPlan?: MonthlyPlanRow;
    plan?: MonthlyPlanRow;
    ideas?: PostIdeaRow[];
    error?: unknown;
    message?: string;
  }>("ai-generate-plan", token, payload);
  const data = ensureOk(response, "Falha ao gerar planejamento.");
  return {
    ...data,
    monthlyPlan: data.monthlyPlan ?? data.plan,
    ideas: Array.isArray(data.ideas) ? data.ideas : [],
  } as { ok: true; monthlyPlan: MonthlyPlanRow; plan?: MonthlyPlanRow; ideas: PostIdeaRow[]; message?: string };
}

export async function regenerateIdea(token: string, payload: { ideaId: string; instruction?: string }) {
  const response = await callEdgeFunction<{ ok: true | false; idea?: PostIdeaRow; error?: unknown; message?: string }>("ai-generate-plan", token, {
    ...payload,
    mode: "regenerate_idea",
  });
  const data = ensureOk(response, "Falha ao regenerar ideia.");
  if (!data.idea) throw new Error("A IA não retornou a ideia regenerada.");
  return { ok: true as const, idea: data.idea };
}

export function approveAllPostIdeas(
  token: string,
  payload: { brandId?: string | null; monthlyPlanId?: string | null; onlyActive?: boolean } = {},
) {
  return callRpc<{ ok: true; approved: number }>("approve_all_post_ideas", token, {
    p_brand_id: payload.brandId || null,
    p_monthly_plan_id: payload.monthlyPlanId || null,
    p_only_active: payload.onlyActive ?? true,
  });
}

export function convertApprovedIdeasToPosts(
  token: string,
  payload: { brandId?: string | null; monthlyPlanId?: string | null; force?: boolean } = {},
) {
  return callRpc<{ ok: true; batch_id: string; created: number; updated: number }>("convert_approved_ideas_to_posts", token, {
    p_brand_id: payload.brandId || null,
    p_monthly_plan_id: payload.monthlyPlanId || null,
    p_force: payload.force ?? false,
  });
}

export function approveConvertEnqueuePlan(
  token: string,
  payload: { brandId?: string | null; monthlyPlanId?: string | null; force?: boolean } = {},
) {
  return callRpc<{
    ok: true;
    approved?: { ok: true; approved: number };
    converted?: { ok: true; batch_id: string; created: number; updated: number };
    queued?: number;
  }>("approve_convert_enqueue_plan", token, {
    p_brand_id: payload.brandId || null,
    p_monthly_plan_id: payload.monthlyPlanId || null,
    p_force: payload.force ?? true,
  });
}
