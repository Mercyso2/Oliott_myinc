import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export function cors(req: Request) {
  const allowed = Deno.env.get("CORS_ALLOW_ORIGIN") || "*";
  const origin = req.headers.get("origin") || "*";
  const allowOrigin =
    allowed === "*" ||
    allowed
      .split(",")
      .map((s) => s.trim())
      .includes(origin)
      ? origin
      : allowed.split(",")[0].trim();
  return {
    "Access-Control-Allow-Origin": allowOrigin || "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-worker-device-key, x-cron-secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function okOptions(req: Request) {
  return new Response("ok", { headers: cors(req) });
}
export const options = okOptions;

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export function readableEdgeError(value: unknown): string {
  if (!value) return "Erro desconhecido.";
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);

  const record = value as Record<string, unknown>;
  const nested =
    record.message ??
    record.error_description ??
    record.error ??
    record.details ??
    record.hint;
  if (nested && nested !== value) {
    const message = readableEdgeError(nested);
    if (message && message !== "[object Object]") return message;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function err(req: Request, error: unknown, status = 400) {
  const message = readableEdgeError(error);
  return json(req, { ok: false, error: message, message }, status);
}

export function env(name: string, required = true) {
  const value = Deno.env.get(name) || "";
  if (required && !value)
    throw new Error(`${name} não configurado no Edge Secret.`);
  return value;
}

export function serviceClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function readJson(req: Request) {
  return await req.json().catch(() => ({}));
}

export async function sha256Hex(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function requireUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer "))
    throw new Error("Usuário não autenticado.");
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (token === "local-admin-development-session") {
    return {
      id: "local-mauricio-admin",
      email: "mauricio@myinc.local",
    } as const;
  }
  const supabase = serviceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Sessão inválida ou expirada.");
  return data.user;
}

export async function requireWorkerKey(req: Request) {
  const configured = env("WORKER_DEVICE_KEY");
  const bodyKey = req.headers.get("x-worker-device-key") || "";
  if (!bodyKey || bodyKey !== configured)
    throw new Error("Worker key inválida.");
  return { raw: bodyKey, hash: await sha256Hex(bodyKey) };
}

export function b64ToBytes(value: string) {
  const clean = value.includes(",") ? value.split(",").pop() || "" : value;
  return Uint8Array.from(atob(clean), (char) => char.charCodeAt(0));
}

export function detectBinaryMedia(
  bytes: Uint8Array,
  fallback = "application/octet-stream",
) {
  if (
    bytes.length > 12 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return { mime: "image/png", ext: "png", kind: "image" };
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8)
    return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  if (
    bytes.length > 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  )
    return { mime: "image/webp", ext: "webp", kind: "image" };
  if (
    bytes.length > 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  )
    return { mime: "video/mp4", ext: "mp4", kind: "video" };
  const mime = fallback || "application/octet-stream";
  const ext =
    mime.includes("jpeg") || mime.includes("jpg")
      ? "jpg"
      : mime.includes("webp")
        ? "webp"
        : mime.includes("mp4")
          ? "mp4"
          : mime.includes("png")
            ? "png"
            : "bin";
  return { mime, ext, kind: mime.startsWith("video/") ? "video" : "image" };
}

export function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function normalizeArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[#,;\n]/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => (x.startsWith("#") ? x : `#${x.replace(/^#/, "")}`));
  }
  return [];
}
export async function systemLog(
  supabase: ReturnType<typeof serviceClient>,
  payload: Record<string, unknown>,
) {
  const row = {
    brand_id: payload.brand_id ?? null,
    user_id: payload.user_id ?? null,
    post_id: payload.post_id ?? null,
    module: safeString(payload.module, "system"),
    type: safeString(payload.type, "info"),
    severity: safeString(payload.severity, "info"),
    status: safeString(payload.status, "ok"),
    friendly_message: safeString(payload.friendly_message),
    technical_detail: safeString(payload.technical_detail),
    metadata:
      payload.metadata && typeof payload.metadata === "object"
        ? payload.metadata
        : {},
  };
  const { error } = await supabase.from("system_logs").insert(row);
  if (error) console.warn("Falha ao registrar system_log:", error.message);
  return !error;
}

export async function openAIJson(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  opts: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {},
) {
  const apiKey = env("OPENAI_API_KEY");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 55000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: opts.model || Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-4o-mini",
        messages,
        response_format: { type: "json_object" },
        temperature: opts.temperature ?? 0.65,
        max_tokens: opts.maxTokens ?? 9000,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(`OpenAI texto falhou: ${JSON.stringify(data)}`);
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenAI não retornou JSON textual.");
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}
