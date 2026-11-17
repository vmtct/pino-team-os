// PAP-1887 — Afterschool Secure PIN Session (Epic PAP-1832 PNR-IDENTITY).
// Staging-only adapter. NEVER register this with public routing until all
// Worker secret, service-binding, Durable Object and live Guardian/Center gates.
const COOKIE = "__Host-PINO_AFTERSCHOOL";
const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const AUTH_ROUTES = Object.freeze({
  "/api/piner/afterschool/pin/login": ["POST", "/private/afterschool/pin/login", "login"],
  "/api/piner/afterschool/pin/change": ["POST", "/private/afterschool/pin/change", "change"],
  "/api/piner/afterschool/session": ["GET", "/private/afterschool/session", "session"],
  "/api/piner/afterschool/logout": ["POST", "/private/afterschool/session/logout", "logout"],
});
function json(status, data, cookie) {
  const headers = new Headers({ ...NO_STORE, "content-type": "application/json; charset=utf-8" });
  if (cookie) headers.set("set-cookie", cookie);
  return new Response(JSON.stringify(data), { status, headers });
}
function error(status, code) {
  return json(status, { error: { code } });
}
function b64(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function unb64(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("seal format");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
function keyBytes(env) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(env.PINER_AFTERSCHOOL_SESSION_SEAL_KEY ?? "")) throw new Error("session key");
  const bytes = unb64(env.PINER_AFTERSCHOOL_SESSION_SEAL_KEY);
  if (bytes.length !== 32) throw new Error("session key length");
  return bytes;
}
async function aesKey(env) {
  return crypto.subtle.importKey("raw", keyBytes(env), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function seal(env, payload) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({
    name: "AES-GCM", iv, additionalData: new TextEncoder().encode("PAP-1887:AFTERSCHOOL:v1"),
  }, await aesKey(env), bytes);
  return b64(iv) + "." + b64(new Uint8Array(encrypted));
}
async function unseal(env, value) {
  const parts = value?.split(".");
  if (parts?.length !== 2) throw new Error("cookie shape");
  const iv = unb64(parts[0]), data = unb64(parts[1]);
  if (iv.length !== 12 || data.length > 4096) throw new Error("cookie length");
  const decrypted = await crypto.subtle.decrypt({
    name: "AES-GCM", iv, additionalData: new TextEncoder().encode("PAP-1887:AFTERSCHOOL:v1"),
  }, await aesKey(env), data);
  const result = JSON.parse(new TextDecoder().decode(decrypted));
  if (!result || !/^[A-Za-z0-9_-]{43}$/.test(result.token)
    || !/^[A-Za-z0-9_-]{22}$/.test(result.csrf)
    || !["PIN_CHANGE_REQUIRED", "AUTHENTICATED"].includes(result.authState)
    || !Number.isFinite(Date.parse(result.expiresAt))) throw new Error("cookie payload");
  return result;
}
function sessionCookie(value, seconds) {
  return COOKIE + "=" + value + "; Path=/; Max-Age=" + seconds
    + "; Secure; HttpOnly; SameSite=Strict";
}
function clientCookie(request) {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.split(";").map((v) => v.trim()).find((v) => v.startsWith(COOKIE + "="));
  return match?.slice(COOKIE.length + 1) ?? "";
}
function safeOrigin(request) {
  const expected = new URL(request.url);
  return expected.protocol === "https:"
    && request.headers.get("origin") === expected.origin
    && !["cross-site", "none"].includes(request.headers.get("sec-fetch-site"));
}
function rateNamespace(env) {
  const ns = env.PINER_AFTERSCHOOL_RATE_GUARD;
  return ns && typeof ns.idFromName === "function" && typeof ns.get === "function" ? ns : null;
}
async function rateCheck(env, request, action) {
  // Never implement a local-process-memory rate counter for distributed Workers.
  const namespace = rateNamespace(env);
  if (!namespace) return 503;
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  if (!/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return 503;
  try {
    const stub = namespace.get(namespace.idFromName("pap1887-v1:" + action + ":" + ip));
    const response = await stub.fetch(new Request("https://rate-guard.invalid/check", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    }));
    return response.status === 429 ? 429 : response.status === 200 ? 200 : 503;
  } catch {
    return 503;
  }
}
async function inputJson(request, allowed) {
  const raw = await request.text();
  if (raw.length > 1024) throw new Error("oversize");
  const body = JSON.parse(raw);
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).some((k) => !allowed.includes(k))) throw new Error("body fields");
  return body;
}
function csrfAllowed(request, session) {
  const supplied = request.headers.get("x-pino-csrf") ?? "";
  return supplied.length === 22 && supplied === session.csrf;
}
async function coreCall(env, request, target, body, bearer) {
  const core = env.PINO_AFTERSCHOOL_CORE;
  const capability = env.AFTERSCHOOL_PIN_BFF_SERVICE_KEY;
  const headers = { ...(body ? { "content-type": "application/json" } : {}),
    ...(bearer ? { authorization: "Bearer " + bearer } : {}) };
  return core.executePrivate(new Request(new URL(target, request.url), {
    method: body || target.includes("logout") ? "POST" : "GET",
    headers, ...(body ? { body: JSON.stringify(body) } : {}),
  }), capability);
}
async function extractSessionResult(response, now, restrictedAllowed) {
  if (response.status !== 200) return null;
  const result = (await response.json())?.data;
  if (!result || !/^[A-Za-z0-9_-]{43}$/.test(result.token ?? "")
    || !["PIN_CHANGE_REQUIRED", "AUTHENTICATED"].includes(result.authState)
    || (!restrictedAllowed && result.authState !== "AUTHENTICATED")) return null;
  const expires = Date.parse(result.expiresAt);
  if (!Number.isFinite(expires) || expires <= now
    || expires > now + (result.authState === "PIN_CHANGE_REQUIRED" ? 15 * 60 * 1000 : THIRTY_DAYS)) return null;
  return { authState: result.authState, token: result.token, expiresAt: result.expiresAt };
}
function publicResult(session) {
  return { data: { authState: session.authState, expiresAt: session.expiresAt, csrfToken: session.csrf } };
}
/**
 * Server-side BFF boundary only. Caller MUST separately wire named Core
 * service binding, actual rate-guard Durable Object, safe Origin routing, and
 * registered auth/Center consumers before enabling this handler on Staging.
 * Never expose raw Core bearer to browser JavaScript.
 */
export async function handlePinerAfterschoolPinAuth(request, env, { now = () => Date.now() } = {}) {
  const url = new URL(request.url);
  const route = AUTH_ROUTES[url.pathname];
  if (!route || url.search || request.method !== route[0]) return error(404, "NOT_FOUND");
  const core = env?.PINO_AFTERSCHOOL_CORE;
  if (env?.APP_ENV !== "staging" || env?.PINER_AFTERSCHOOL_PIN_BFF_ENABLED !== "true"
    || !core || typeof core.executePrivate !== "function"
    || typeof env.AFTERSCHOOL_PIN_BFF_SERVICE_KEY !== "string"
    || env.AFTERSCHOOL_PIN_BFF_SERVICE_KEY.length < 32 || !rateNamespace(env)) {
    return error(503, "AUTH_UNAVAILABLE");
  }
  try {
    keyBytes(env);
    if (request.method === "POST" && !safeOrigin(request)) return error(403, "ORIGIN_DENIED");
    const action = route[2];
    const rateStatus = await rateCheck(env, request, action);
    if (rateStatus !== 200) return error(rateStatus, rateStatus === 429 ? "RATE_LIMITED" : "AUTH_UNAVAILABLE");
    if (action === "login") {
      let input;
      try { input = await inputJson(request, ["phone", "pin"]); } catch { return error(400, "INVALID_CREDENTIALS"); }
      if (!/^0[35789]\d{8}$/.test(input.phone ?? "") || !/^\d{6}$/.test(input.pin ?? "")) {
        return error(400, "INVALID_CREDENTIALS");
      }
      const reply = await coreCall(env, request, route[1], {
        identifierType: "PHONE", identifierValue: input.phone, pin: input.pin,
      });
      if (reply.status !== 200) return error([401, 403, 404, 423, 429].includes(reply.status) ? reply.status : 503, "LOGIN_DENIED");
      const result = await extractSessionResult(reply, now(), true);
      if (!result) return error(503, "AUTH_UNAVAILABLE");
      const csrf = b64(crypto.getRandomValues(new Uint8Array(16)));
      const value = await seal(env, { ...result, csrf });
      const seconds = Math.min(Math.floor((Date.parse(result.expiresAt) - now()) / 1000), 30 * 86400);
      return json(200, publicResult({ ...result, csrf }), sessionCookie(value, Math.max(1, seconds)));
    }
    let session;
    try { session = await unseal(env, clientCookie(request)); } catch { return error(401, "SESSION_REQUIRED"); }
    if (Date.parse(session.expiresAt) <= now()) return error(401, "SESSION_EXPIRED");
    if (action === "change" || action === "logout") {
      if (!csrfAllowed(request, session)) return error(403, "CSRF_DENIED");
    }
    if (action === "change") {
      if (session.authState !== "PIN_CHANGE_REQUIRED") return error(403, "CHANGE_NOT_REQUIRED");
      let input;
      try { input = await inputJson(request, ["newPin"]); } catch { return error(400, "INVALID_PIN"); }
      if (!/^\d{6}$/.test(input.newPin ?? "")) return error(400, "INVALID_PIN");
      const reply = await coreCall(env, request, route[1], { newPin: input.newPin }, session.token);
      if (reply.status !== 200) return error([401, 403, 404, 409, 423, 429].includes(reply.status) ? reply.status : 503, "CHANGE_DENIED");
      const result = await extractSessionResult(reply, now(), false);
      if (!result) return error(503, "AUTH_UNAVAILABLE");
      const csrf = b64(crypto.getRandomValues(new Uint8Array(16)));
      const value = await seal(env, { ...result, csrf });
      const seconds = Math.min(Math.floor((Date.parse(result.expiresAt) - now()) / 1000), 30 * 86400);
      return json(200, publicResult({ ...result, csrf }), sessionCookie(value, Math.max(1, seconds)));
    }
    if (action === "session") {
      if (session.authState !== "AUTHENTICATED") return error(409, "PIN_CHANGE_REQUIRED");
      const reply = await coreCall(env, request, route[1], null, session.token);
      if (reply.status !== 200) return error(reply.status === 401 ? 401 : 503, "SESSION_DENIED");
      // Deliberately NEVER forward parent, student, authorization token or PII.
      return json(200, { data: { authenticated: true, expiresAt: session.expiresAt, csrfToken: session.csrf } });
    }
    const reply = await coreCall(env, request, route[1], null, session.token);
    if (![200, 204].includes(reply.status)) return error(reply.status === 401 ? 401 : 503, "LOGOUT_DENIED");
    const headers = new Headers(NO_STORE);
    headers.set("set-cookie", sessionCookie("", 0));
    return new Response(null, { status: 204, headers });
  } catch {
    // Never echo Worker/Core errors, rate details, bearer or PIN.
    return error(503, "AUTH_UNAVAILABLE");
  }
}
