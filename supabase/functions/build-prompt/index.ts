import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { err, json, okOptions, requireUser, serviceClient } from "../_shared/v2-utils.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return okOptions(req);
  try {
    await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const postId = String(body.postId || '');
    const jobType = String(body.jobType || 'image');
    if (!postId) throw new Error('postId obrigatório.');
    const { data, error } = await serviceClient().rpc('build_prompt_payload', { p_post_id: postId, p_job_type: jobType });
    if (error) throw error;
    return json(req, { ok:true, payload:data });
  } catch (error) { return err(req, error); }
});
