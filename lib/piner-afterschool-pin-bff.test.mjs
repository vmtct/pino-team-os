// PAP-1887 — Afterschool Secure PIN Session, Epic PAP-1832 PNR-IDENTITY.
// Pure synthetic BFF boundary tests: no real phone, Core credential or secret.
import assert from "node:assert/strict";
import { test } from "node:test";
import { handlePinerAfterschoolPinAuth } from "./piner-afterschool-pin-bff.mjs";

const NOW = Date.parse("2026-11-13T06:00:00.000Z");
const SEAL = Buffer.alloc(32, 0x47).toString("base64url");
const CAP = "pap1887-test-capability-only-never-provisioned-live";
const LOGIN = "/api/piner/afterschool/pin/login";
const CHANGE = "/api/piner/afterschool/pin/change";
const SESSION = "/api/piner/afterschool/session";
const LOGOUT = "/api/piner/afterschool/logout";
const ORIGIN = "https://piner.staging.invalid";
const tokenRestricted = "A".repeat(43);
const tokenFull = "B".repeat(43);
const temporary = "2026-11-13T06:15:00.000Z";
const absolute = "2026-12-13T06:00:00.000Z";

function request(path, method = "POST", body, opts = {}) {
  return new Request(ORIGIN + path, {
    method,
    headers: {
      "origin": opts.origin === undefined ? ORIGIN : opts.origin,
      "cf-connecting-ip": "203.0.113.9",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...(opts.csrf ? { "x-pino-csrf": opts.csrf } : {}),
      ...(opts.authorization ? { authorization: opts.authorization } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function rate(status = 200) {
  return { idFromName: (name) => name, get: () => ({
    fetch: async () => new Response("", { status }),
  }) };
}
function envFactory(overrides = {}) {
  const calls = [];
  const core = {
    async executePrivate(r, capability) {
      calls.push({ path: new URL(r.url).pathname, method: r.method,
        authorization: r.headers.get("authorization"), capability });
      if (capability !== CAP) return new Response(null, { status: 401 });
      switch (new URL(r.url).pathname) {
        case "/private/afterschool/pin/login":
          return Response.json({ data: { token: tokenRestricted, authState: "PIN_CHANGE_REQUIRED", expiresAt: temporary } });
        case "/private/afterschool/pin/change":
          return Response.json({ data: { token: tokenFull, authState: "AUTHENTICATED", expiresAt: absolute } });
        case "/private/afterschool/session":
          return Response.json({ data: { parent: { phone: "+84999999999", secret: "FORBIDDEN" }, session: { expiresAt: absolute } } });
        case "/private/afterschool/session/logout":
          return new Response(null, { status: 204 });
        default:
          return new Response(null, { status: 404 });
      }
    },
  };
  const env = {
    APP_ENV: "staging",
    PINER_AFTERSCHOOL_PIN_BFF_ENABLED: "true",
    PINER_AFTERSCHOOL_SESSION_SEAL_KEY: SEAL,
    AFTERSCHOOL_PIN_BFF_SERVICE_KEY: CAP,
    PINO_AFTERSCHOOL_CORE: core,
    PINER_AFTERSCHOOL_RATE_GUARD: rate(),
    ...overrides,
  };
  return { env, calls };
}
async function handle(r, env) {
  return handlePinerAfterschoolPinAuth(r, env, { now: () => NOW });
}
function loginRequest() {
  return request(LOGIN, "POST", { phone: "0912345678", pin: "123456" });
}
function cookieOf(response) {
  const raw = response.headers.get("set-cookie") ?? "";
  return raw.split(";")[0];
}
async function firstLogin(env) {
  const response = await handle(loginRequest(), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  return { cookie: cookieOf(response), csrf: body.data.csrfToken, response, body };
}
async function changedSession(env) {
  const first = await firstLogin(env);
  const response = await handle(request(CHANGE, "POST", { newPin: "654321" }, {
    cookie: first.cookie, csrf: first.csrf,
  }), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  return { cookie: cookieOf(response), csrf: body.data.csrfToken, response, body };
}

test("PAP-1887 S3-A: disabled by default and production always denied", async () => {
  const base = envFactory();
  for (const overrides of [
    { PINER_AFTERSCHOOL_PIN_BFF_ENABLED: undefined },
    { PINER_AFTERSCHOOL_PIN_BFF_ENABLED: "false" },
    { PINO_AFTERSCHOOL_CORE: undefined },
    { AFTERSCHOOL_PIN_BFF_SERVICE_KEY: undefined },
    { PINER_AFTERSCHOOL_RATE_GUARD: undefined },
    { APP_ENV: "production" },
  ]) {
    const x = envFactory(overrides);
    const response = await handle(loginRequest(), x.env);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(x.calls.length, 0);
  }
  assert.equal(base.calls.length, 0);
});

test("PAP-1887 S3-A: private route allowlist rejects unknown paths, methods and queries", async () => {
  const x = envFactory();
  for (const r of [
    request("/api/piner/afterschool/students"),
    request(LOGIN, "GET"),
    request(SESSION + "?students=1", "GET"),
    request(LOGOUT, "GET"),
    request("/api/piner/afterschool/pin/reset"),
  ]) assert.equal((await handle(r, x.env)).status, 404);
  assert.equal(x.calls.length, 0);
});

test("PAP-1887 S3-A: Origin is mandatory and forged cross-origin POST denied", async () => {
  const x = envFactory();
  for (const origin of ["https://evil.invalid", "null", ""]) {
    assert.equal((await handle(request(LOGIN, "POST", { phone: "0912345678", pin: "123456" }, { origin }), x.env)).status, 403);
  }
  assert.equal(x.calls.length, 0);
});

test("PAP-1887 S3-A: no IP or unavailable real rate guard fails closed; 429 isolated", async () => {
  const x = envFactory({ PINER_AFTERSCHOOL_RATE_GUARD: rate(429) });
  assert.equal((await handle(loginRequest(), x.env)).status, 429);
  assert.equal(x.calls.length, 0);
  const broken = envFactory({ PINER_AFTERSCHOOL_RATE_GUARD: rate(503) });
  assert.equal((await handle(loginRequest(), broken.env)).status, 503);
  assert.equal(broken.calls.length, 0);
});

test("PAP-1887 S3-A: six-digit PIN and phone validated without forwarding extra fields", async () => {
  const x = envFactory();
  for (const body of [
    { phone: "123", pin: "123456" },
    { phone: "0912345678", pin: "abcdef" },
    { phone: "0912345678", pin: "123456", sessionPolicy: "LEGACY" },
  ]) assert.equal((await handle(request(LOGIN, "POST", body), x.env)).status, 400);
  assert.equal(x.calls.length, 0);
});

test("PAP-1887 S3-A: first login stores restricted Core bearer only inside AES-GCM HttpOnly cookie", async () => {
  const x = envFactory();
  const result = await firstLogin(x.env);
  const cookie = result.response.headers.get("set-cookie");
  assert.match(cookie, /^__Host-PINO_AFTERSCHOOL=/);
  for (const attr of ["Secure", "HttpOnly", "SameSite=Strict", "Path=/"]) assert.ok(cookie.includes(attr));
  assert.equal(result.body.data.authState, "PIN_CHANGE_REQUIRED");
  assert.equal(result.body.data.expiresAt, temporary);
  assert.match(result.body.data.csrfToken, /^[A-Za-z0-9_-]{22}$/);
  assert.equal(JSON.stringify(result.body).includes(tokenRestricted), false);
  assert.equal(cookie.includes(tokenRestricted), false);
  assert.equal(result.response.headers.get("cache-control"), "no-store");
  assert.equal(x.calls[0].path, "/private/afterschool/pin/login");
  assert.equal(x.calls[0].capability, CAP);
  assert.equal(x.calls[0].authorization, null);
});

test("PAP-1887 S3-A: restricted cookie cannot read authenticated session", async () => {
  const x = envFactory();
  const first = await firstLogin(x.env);
  const response = await handle(request(SESSION, "GET", undefined, { cookie: first.cookie }), x.env);
  assert.equal(response.status, 409);
  assert.equal(x.calls.length, 1);
});

test("PAP-1887 S3-A: PIN change requires matching CSRF, rotates sealed cookie, hides bearer", async () => {
  const x = envFactory();
  const first = await firstLogin(x.env);
  const wrong = await handle(request(CHANGE, "POST", { newPin: "654321" }, {
    cookie: first.cookie, csrf: "X".repeat(22),
  }), x.env);
  assert.equal(wrong.status, 403);
  assert.equal(x.calls.length, 1);
  const full = await changedSession(x.env);
  assert.equal(full.body.data.authState, "AUTHENTICATED");
  assert.equal(full.body.data.expiresAt, absolute);
  assert.equal(JSON.stringify(full.body).includes(tokenFull), false);
  assert.equal(full.response.headers.get("set-cookie").includes(tokenFull), false);
  assert.ok(x.calls.some((call) => call.path.endsWith("/pin/change") && call.authorization === "Bearer " + tokenRestricted));
});

test("PAP-1887 S3-A: server validates session at Core, strips Parent/child PII", async () => {
  const x = envFactory();
  const full = await changedSession(x.env);
  const response = await handle(request(SESSION, "GET", undefined, {
    cookie: full.cookie, authorization: "Bearer " + "X".repeat(43),
  }), x.env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { data: { authenticated: true, csrfToken: full.csrf, expiresAt: absolute } });
  assert.equal(JSON.stringify(body).includes("FORBIDDEN"), false);
  assert.equal(JSON.stringify(body).includes(tokenFull), false);
  const sessionCall = x.calls.find((c) => c.path === "/private/afterschool/session");
  assert.equal(sessionCall.authorization, "Bearer " + tokenFull);
});

test("PAP-1887 S3-A: tampered cookie is denied and never forwarded to Core", async () => {
  const x = envFactory();
  const first = await firstLogin(x.env);
  const forged = first.cookie.slice(0, -3) + "ABC";
  const response = await handle(request(CHANGE, "POST", { newPin: "654321" }, {
    cookie: forged, csrf: first.csrf,
  }), x.env);
  assert.equal(response.status, 401);
  assert.equal(x.calls.length, 1);
});

test("PAP-1887 S3-A: valid logout revokes through Core and expires HttpOnly cookie", async () => {
  const x = envFactory();
  const full = await changedSession(x.env);
  const blocked = await handle(request(LOGOUT, "POST", undefined, { cookie: full.cookie }), x.env);
  assert.equal(blocked.status, 403);
  const response = await handle(request(LOGOUT, "POST", undefined, {
    cookie: full.cookie, csrf: full.csrf,
  }), x.env);
  assert.equal(response.status, 204);
  assert.ok(response.headers.get("set-cookie").includes("Max-Age=0"));
  assert.ok(x.calls.some((c) => c.path.endsWith("/session/logout") && c.authorization === "Bearer " + tokenFull));
});

test("PAP-1887 S3-A: legacy 90-day session cannot be minted by untrusted Core reply", async () => {
  const token = tokenRestricted;
  const x = envFactory({
    PINO_AFTERSCHOOL_CORE: {
      async executePrivate() {
        return Response.json({ data: {
          authState: "AUTHENTICATED", token, expiresAt: "2027-02-11T06:00:00.000Z",
        } });
      },
    },
  });
  const response = await handle(loginRequest(), x.env);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("set-cookie"), null);
});
