import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { err, json, okOptions, readJson, requireUser, serviceClient, safeString } from "../_shared/v2-utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return okOptions(req);
  try {
    await requireUser(req);
    const body = await readJson(req) as Record<string, unknown>;
    const supabase = serviceClient();
    const jobId = safeString(body.jobId || body.job_id);
    const postId = safeString(body.postId || body.post_id);
    if (!jobId && !postId) throw new Error("Informe jobId ou postId.");

    let job: Record<string, unknown> | null = null;
    let jobs: unknown[] = [];
    if (jobId) {
      const { data, error } = await supabase.from("generation_jobs").select("*").eq("id", jobId).maybeSingle();
      if (error) throw error;
      job = data;
      jobs = data ? [data] : [];
    } else {
      const { data, error } = await supabase.from("generation_jobs").select("*").eq("post_id", postId).order("created_at", { ascending: false }).limit(80);
      if (error) throw error;
      jobs = data || [];
      job = (data || [])[0] || null;
    }

    const ids = jobs.map((item: any) => item.id).filter(Boolean);
    let events: unknown[] = [];
    let assets: unknown[] = [];
    if (ids.length) {
      const { data: eventRows } = await supabase.from("generation_job_events").select("*").in("job_id", ids).order("created_at", { ascending: false }).limit(300);
      events = eventRows || [];
      const { data: assetRows } = await supabase.from("generation_job_assets").select("*").in("job_id", ids).order("created_at", { ascending: false }).limit(300);
      assets = assetRows || [];
    }

    let post = null;
    const resolvedPostId = postId || safeString((job as any)?.post_id);
    if (resolvedPostId) {
      const { data } = await supabase.from("posts").select("*").eq("id", resolvedPostId).maybeSingle();
      post = data;
    }
    return json(req, { ok: true, job, jobs, children: jobs, events, assets, post });
  } catch (error) {
    return err(req, error, 500);
  }
});
