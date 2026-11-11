// PAP-1837 / PNR-IDENTITY — isolated staging-only, fail-closed member BFF.
// Browser never receives Core bearer tokens; Prod piner worker does not import this.
export const PINER_AUTH_PREFIX = "/api/piner/auth";
const SESSION_COOKIE = "__Host-piner_session";
const DEVICE_COOKIE = "__Host-piner_device";
const COOKIE_LIFETIME_SECONDS = 30 * 24 * 60 * 60;
const MAX_BODY_BYTES = 1_024;
const HOUR_MS = 60 * 60_000;
const STAGING_CORE = "https://core-staging.internal";

const headers = () => ({
  "Cache-Control": "no-store, private",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Content-Type": "application/json; charset=utf-8",
});
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers(), ...extra } });
}
const problem = (status, code) => json({ error: { code } }, status);
export function isPinerAuthPath(path) {
  return path === PINER_AUTH_PREFIX || path.startsWith(PINER_AUTH_PREFIX + "/");
}
function cleanPhone(raw) {
  if (typeof raw !== "string") return null;
  let value = raw.replace(/[\s().-]/g, "");
  if (value.startsWith("0") && value.length === 10) value = "+84" + value.slice(1);
  if (!/^\+84[35789]\d{8}$/.test(value)) return null;
  return value;
}
async function readBody(req) {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const length = Number(req.headers.get("content-length") || "0");
  if (!Number.isSafeInteger(length) || length > MAX_BODY_BYTES || length < 0) return null;
  if (!req.body) return null;
  const reader = req.body.getReader();
  let size = 0;
  const parts = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; } finally { reader.releaseLock(); }
}
function sameOriginWrite(req) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(req.url).origin
    && req.headers.get("sec-fetch-site") !== "cross-site"; } catch { return false; }
}
function cookieValue(req, name) {
  const raw = req.headers.get("cookie") || "";
  for (const field of raw.split(";")) {
    const [key, ...rest] = field.trim().split("=");
    if (key === name) return rest.join("=") || null;
  }
  return null;
}
const clearCookie = SESSION_COOKIE + "=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax";
const enc = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const dec = (text) => {
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length > 8192) throw new Error("Bad seal");
  const raw = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};
async function sealKey(env) {
  if (typeof env.PINER_SESSION_SEAL_KEY !== "string") return null;
  try {
    const raw = dec(env.PINER_SESSION_SEAL_KEY);
    if (raw.length !== 32) return null;
    return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  } catch { return null; }
}
async function seal(data, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(data));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({
    name: "AES-GCM", iv, additionalData: new TextEncoder().encode("PAP-1837/PNR-IDENTITY/v1"),
  }, key, plain));
  return enc(iv) + "." + enc(cipher);
}
async function unseal(req, key, now) {
  const raw = cookieValue(req, SESSION_COOKIE);
  if (!raw || raw.length > 8192) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  try {
    const iv = dec(parts[0]);
    if (iv.length !== 12) return null;
    const data = await crypto.subtle.decrypt({
      name: "AES-GCM", iv, additionalData: new TextEncoder().encode("PAP-1837/PNR-IDENTITY/v1"),
    }, key, dec(parts[1]));
    const session = JSON.parse(new TextDecoder().decode(data));
    if (typeof session.token !== "string" || session.token.length < 16 || session.token.length > 4096
      || !Number.isFinite(session.expiresAt) || session.expiresAt <= now
      || session.expiresAt > now + 30 * 24 * HOUR_MS) return null;
    return session;
  } catch { return null; }
}
function deviceId(req) {
  const value = cookieValue(req, DEVICE_COOKIE);
  return value && /^[a-zA-Z0-9_-]{32,64}$/.test(value) ? value : null;
}
async function digest(key) {
  return enc(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))));
}
async function rateGuard(env, req, type, phone = null) {
  const namespace = env.PINER_AUTH_RATE_GUARD;
  const ip = req.headers.get("cf-connecting-ip");
  if (!namespace?.idFromName || !namespace?.get || !ip || ip.length > 64) return null;
  const device = deviceId(req);
  const guards = [
    { kind: "ip", identity: await digest("ip:" + ip) },
    { kind: "device", identity: await digest("device:" + (device ?? (ip + ":" + (req.headers.get("user-agent") || "")))) },
  ];
  if (phone) guards.push({ kind: "phone", identity: await digest("phone:" + phone) });
  for (const { kind, identity } of guards) {
    try {
      const obj = namespace.get(namespace.idFromName(kind + ":" + identity));
      const response = await obj.fetch("https://piner-guard.internal/check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, type }),
      });
      if (response.status === 429) return false;
      if (!response.ok || (await response.json()).allowed !== true) return null;
    } catch { return null; }
  }
  return true;
}
async function coreFetch(env, path, method, data = null, token = null) {
  if (!env.PINO_MEMBER_CORE?.fetch) return null;
  const h = new Headers({ Accept: "application/json" });
  if (data !== null) h.set("Content-Type", "application/json");
  if (token) h.set("Authorization", "Bearer " + token);
  // Never expose or log the private Core token; only service binding receives it.
  if (path.startsWith("/v1/piner-auth/challenges")) {
    if (typeof env.PINER_AUTH_CORE_SERVICE_KEY !== "string") return null;
    h.set("x-piner-core-service-key", env.PINER_AUTH_CORE_SERVICE_KEY);
  }
  if (method === "POST" && token) h.set("Idempotency-Key", crypto.randomUUID());
  try {
    return await env.PINO_MEMBER_CORE.fetch(new Request(STAGING_CORE + path, {
      method, headers: h, ...(data !== null ? { body: JSON.stringify(data) } : {}),
    }));
  } catch { return null; }
}
async function coreData(response) {
  if (!response || !response.ok) return null;
  try {
    const obj = await response.json();
    return obj && typeof obj === "object" && obj.data ? obj.data : null;
  } catch { return null; }
}
function authUnavailable() { return problem(503, "AUTH_TEMPORARILY_UNAVAILABLE"); }
export async function handlePinerAuth(req, env, now = Date.now()) {
  const url = new URL(req.url);
  if (!isPinerAuthPath(url.pathname)) return null;
  if (url.protocol !== "https:" || env.PINER_AUTH_STAGING_ENABLED !== "true") return authUnavailable();
  const route = url.pathname.slice(PINER_AUTH_PREFIX.length);
  const methods = {
    "/otp/request": "POST", "/otp/verify": "POST", "/session": "GET",
    "/logout": "POST", "/logout-all": "POST", "/children": "GET",
  };
  if (!Object.hasOwn(methods, route)) return problem(404, "NOT_FOUND");
  if (req.method !== methods[route]) return problem(405, "METHOD_NOT_ALLOWED");
  if (req.method === "POST" && !sameOriginWrite(req)) return problem(403, "ORIGIN_DENIED");
  if (!env.PINO_MEMBER_CORE?.fetch) return authUnavailable();
  if ((route === "/otp/request" || route === "/otp/verify")
    && (typeof env.PINER_AUTH_CORE_SERVICE_KEY !== "string"
      || env.PINER_AUTH_CORE_SERVICE_KEY.length < 32
      || env.PINER_AUTH_CORE_SERVICE_KEY.length > 512)) return authUnavailable();
  const key = await sealKey(env);
  if (!key) return authUnavailable();

  if (route === "/otp/request") {
    const body = await readBody(req);
    const phone = cleanPhone(body?.phone);
    if (!phone || Object.keys(body).some(k => k !== "phone")) return problem(400, "INVALID_REQUEST");
    const rate = await rateGuard(env, req, "request", phone);
    if (rate === null) return authUnavailable();
    if (!rate) return problem(429, "OTP_RATE_LIMIT");
    const response = await coreFetch(env, "/v1/piner-auth/challenges", "POST", {
      identifierType: "PHONE", identifierValue: phone,
    });
    const data = await coreData(response);
    // No Core Piner runtime opt-in currently exists: 404/410 becomes neutral 503, never SMS fallback.
    if (!response || response.status !== 202 || !data || typeof data.challengeId !== "string"
      || typeof data.expiresAt !== "string") return authUnavailable();
    const device = deviceId(req) ?? enc(crypto.getRandomValues(new Uint8Array(24)));
    return json({ data: { challengeId: data.challengeId, expiresAt: data.expiresAt } }, 202, {
      "Set-Cookie": DEVICE_COOKIE + "=" + device + "; Path=/; Max-Age=" + COOKIE_LIFETIME_SECONDS
        + "; Secure; HttpOnly; SameSite=Lax",
    });
  }
  if (route === "/otp/verify") {
    const body = await readBody(req);
    if (!body || Object.keys(body).some(k => !["challengeId", "otp"].includes(k))
      || !/^[0-9a-f-]{36}$/.test(body.challengeId ?? "") || !/^\d{6}$/.test(body.otp ?? "")) return problem(400, "INVALID_REQUEST");
    const rate = await rateGuard(env, req, "verify");
    if (rate === null) return authUnavailable();
    if (!rate) return problem(429, "OTP_RATE_LIMIT");
    const response = await coreFetch(env, "/v1/piner-auth/challenges/" + body.challengeId + "/verify",
      "POST", { otp: body.otp });
    if (response?.status === 401) return problem(401, "OTP_INVALID");
    if (response?.status === 429) return problem(429, "OTP_RATE_LIMIT");
    const data = await coreData(response);
    const exp = Date.parse(data?.expiresAt);
    const delta = exp - now;
    if (!data || typeof data.token !== "string" || data.token.length < 16 || data.token.length > 4096
      || !Number.isFinite(exp) || delta < (30 * 24 * HOUR_MS) - 300_000
      || delta > (30 * 24 * HOUR_MS) + 60_000) return authUnavailable();
    const encoded = await seal({ token: data.token, expiresAt: exp }, key);
    return json({ data: { authenticated: true, expiresAt: data.expiresAt } }, 200, {
      "Set-Cookie": SESSION_COOKIE + "=" + encoded + "; Path=/; Max-Age="
        + Math.max(1, Math.min(COOKIE_LIFETIME_SECONDS, Math.floor(delta / 1000)))
        + "; Secure; HttpOnly; SameSite=Lax",
    });
  }
  if (route === "/logout-all") return problem(501, "CORE_LOGOUT_ALL_NOT_AVAILABLE");

  const session = await unseal(req, key, now);
  if (!session) return json({ error: { code: "AUTH_REQUIRED" } }, 401, { "Set-Cookie": clearCookie });
  if (route === "/logout") {
    const response = await coreFetch(env, "/v1/member/session/logout", "POST", null, session.token);
    if (!response?.ok) return authUnavailable();
    return json({ data: { revoked: true } }, 200, { "Set-Cookie": clearCookie });
  }
  const path = route === "/children" ? "/v1/member/students" : "/v1/member/session";
  const response = await coreFetch(env, path, "GET", null, session.token);
  if (response?.status === 401 || response?.status === 403) {
    return json({ error: { code: "AUTH_REQUIRED" } }, 401, { "Set-Cookie": clearCookie });
  }
  const data = await coreData(response);
  if (!data) return authUnavailable();
  return json({ data });
}

// Cloudflare Durable Object rate guard. No raw phone, IP, OTP or token persists.
export class PinerOtpRateGuard {
  constructor(state) { this.state = state; }
  async fetch(req) {
    if (req.method !== "POST" || new URL(req.url).pathname !== "/check") return problem(404, "NOT_FOUND");
    const body = await readBody(req);
    if (!body || !["phone", "ip", "device"].includes(body.kind)
      || !["request", "verify"].includes(body.type)) return problem(400, "INVALID_REQUEST");
    const now = Date.now();
    const max = body.kind === "phone" ? 5 : body.type === "verify" ? 30 : 20;
    const cooldown = body.kind === "phone" ? 60_000 : 0;
    const key = body.type;
    return this.state.storage.transaction(async (tx) => {
      const recent = (await tx.get(key) || []).filter(t => Number.isFinite(t) && t > now - HOUR_MS);
      if (recent.length >= max || (cooldown > 0 && recent.length && now - recent[recent.length - 1] < cooldown)) {
        return json({ allowed: false }, 429);
      }
      recent.push(now);
      await tx.put(key, recent);
      return json({ allowed: true });
    });
  }
}
