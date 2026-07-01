import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type JsonRecord = Record<string, unknown>;

function safeStringify(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch (_) { return String(value); }
}

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-device-key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" }
  });
}

function envAny(names: string[], required = true): string {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value && value.trim()) return value.trim();
  }
  if (required) throw new Error(`Secret ausente nas Edge Functions: ${names.join(" ou ")}. Configure em Supabase > Edge Functions > Secrets ou via supabase secrets set.`);
  return "";
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeBody(body: JsonRecord) {
  return {
    name: String(body.name || body.workerName || body.worker_name || "MYINC Local Engine Mauricio"),
    appVersion: String(body.appVersion || body.app_version || "v3.2-worker-hotfix"),
    machineInfo: (body.machineInfo || body.machine_info || {}) as JsonRecord,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors(req) });
  if (req.method !== "POST" && req.method !== "GET") return json(req, { ok: false, error: "Método não permitido." }, 405);

  try {
    const expectedWorkerKey = envAny(["WORKER_DEVICE_KEY", "SUPABASE_WORKER_DEVICE_KEY"]);
    const receivedWorkerKey = req.headers.get("x-worker-device-key") || "";

    if (!receivedWorkerKey) {
      return json(req, { ok: false, error: "Header x-worker-device-key ausente no Motor Local." }, 401);
    }
    if (receivedWorkerKey !== expectedWorkerKey) {
      return json(req, { ok: false, error: "WORKER_DEVICE_KEY diferente da chave enviada pelo Motor Local. Confira Edge Secrets e .env.engine." }, 401);
    }

    const supabaseUrl = envAny(["SUPABASE_URL"]);
    const serviceRoleKey = envAny(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SERVICE_ROLE_KEY"]);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    let rawBody: JsonRecord = {};
    try { rawBody = await req.json(); } catch (_) { rawBody = {}; }
    const body = normalizeBody(rawBody);
    const deviceKeyHash = await sha256Hex(receivedWorkerKey);

    const rpcPayload = {
      p_name: body.name,
      p_device_key_hash: deviceKeyHash,
      p_app_version: body.appVersion,
      p_machine_info: body.machineInfo || {}
    };

    const { data: rpcData, error: rpcError } = await supabase.rpc("register_worker_device", rpcPayload);

    let worker: JsonRecord | null = null;

    if (rpcError) {
      // Fallback direto para eliminar travas de RPC desatualizada. O SQL do hotfix também recria a RPC correta.
      const { data: upsertData, error: upsertError } = await supabase
        .from("worker_devices")
        .upsert({
          name: body.name,
          device_key_hash: deviceKeyHash,
          status: "online",
          last_seen_at: new Date().toISOString(),
          app_version: body.appVersion,
          machine_info: body.machineInfo || {},
          updated_at: new Date().toISOString()
        }, { onConflict: "device_key_hash" })
        .select("*")
        .single();

      if (upsertError) {
        return json(req, {
          ok: false,
          error: "Falha ao registrar worker no Supabase.",
          rpc_error: safeStringify(rpcError),
          upsert_error: safeStringify(upsertError),
          hint: "Execute o SQL MYINC_HOTFIX_ENGINE_REGISTER_WORKER_V3_2.sql e confira SUPABASE_SERVICE_ROLE_KEY / WORKER_DEVICE_KEY nos Edge Secrets."
        }, 500);
      }
      worker = upsertData as JsonRecord;
    } else {
      worker = Array.isArray(rpcData) ? rpcData[0] as JsonRecord : rpcData as JsonRecord;
    }

    if (!worker || !worker.id) {
      return json(req, {
        ok: false,
        error: "Registro do worker não retornou ID UUID.",
        data: worker,
        hint: "A função register_worker_device precisa retornar a linha de public.worker_devices. Execute o SQL do hotfix."
      }, 500);
    }

    return json(req, {
      ok: true,
      workerId: worker.id,
      worker,
      name: worker.name,
      appVersion: body.appVersion,
      message: "worker registrado e online"
    }, 200);
  } catch (error) {
    return json(req, {
      ok: false,
      error: safeStringify(error),
      hint: "Erro no boot da Edge Function engine-register-worker. Confira Edge Secrets e deploy da function."
    }, 500);
  }
});
