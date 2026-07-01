import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { err, json, okOptions, readJson, requireUser, serviceClient, safeString, systemLog } from "../_shared/v2-utils.ts";

function randomPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  return Array.from(crypto.getRandomValues(new Uint8Array(18))).map((n) => alphabet[n % alphabet.length]).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return okOptions(req);
  const supabase = serviceClient();
  try {
    const requester = await requireUser(req);
    const body = await readJson(req) as Record<string, unknown>;
    const email = safeString(body.email).toLowerCase();
    const fullName = safeString(body.fullName || body.full_name, email.split("@")[0] || "Usuário MYINC");
    const role = safeString(body.role, "editor");
    const brandId = safeString(body.brandId || body.brand_id) || null;
    const password = safeString(body.password) || randomPassword();
    if (!email || !email.includes("@")) throw new Error("E-mail válido obrigatório.");

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role, brand_id: brandId },
    });
    if (createErr && !String(createErr.message || "").toLowerCase().includes("already")) throw createErr;

    let authUserId = created?.user?.id || null;
    if (!authUserId) {
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) throw listErr;
      authUserId = list.users.find((user) => user.email?.toLowerCase() === email)?.id || null;
    }

    const { data: userRow, error: upsertErr } = await supabase.from("app_users").upsert({
      auth_user_id: authUserId,
      brand_id: brandId,
      email,
      full_name: fullName,
      avatar_initial: fullName.slice(0, 1).toUpperCase() || "M",
      role,
      status: safeString(body.status, "active"),
      preferences: {},
      metadata: { source: "admin-users-v6" },
      updated_at: new Date().toISOString(),
    }, { onConflict: "email" }).select("*").single();
    if (upsertErr) throw upsertErr;

    await systemLog(supabase, {
      brand_id: brandId,
      user_id: requester.id,
      module: "admin-users",
      type: "create_user",
      status: "ok",
      friendly_message: "Usuário criado/atualizado no Supabase Auth e app_users.",
      metadata: { email, auth_user_id: authUserId },
    });

    return json(req, { ok: true, userId: userRow.id, authUserId, temporaryPassword: body.password ? undefined : password, user: userRow });
  } catch (error) {
    return err(req, error, 500);
  }
});
