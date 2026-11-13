// PAP-1887 — Afterschool Secure PIN Session, Epic PAP-1832 PNR-IDENTITY.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dispatchPinerAfterschoolPin } from "./piner-afterschool-pin-dispatch.mjs";
import { PinerAfterschoolRateGuard } from "./piner-afterschool-rate-guard.mjs";

const origin = "https://piner.staging.invalid";
const NO_ENV = { APP_ENV: "staging" };
function req(path, method = "POST", body = { phone: "0912345678", pin: "123456" }) {
  return new Request(origin + path, { method, headers: { origin, "content-type": "application/json" },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
}
function rateRequest(action) {
  return new Request("https://rate-guard.invalid/check", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
}
function memoryStore() {
  const map = new Map();
  return { transaction: async (callback) => callback({
    get: async (key) => map.get(key),
    put: async (key, value) => map.set(key, value),
  }) };
}

test("PAP-1887 S3-B: existing public Piner/Next routes untouched by pin dispatcher", async () => {
  for (const path of ["/", "/piner-space", "/piner-prototype", "/_next/static/a.js",
    "/api/piner/mytime/anything", "/api/piner/afterschoolish/pin/login"]) {
    assert.equal(await dispatchPinerAfterschoolPin(req(path), NO_ENV), null);
  }
});

test("PAP-1887 S3-B: public API login fails closed without all staging bindings", async () => {
  const response = await dispatchPinerAfterschoolPin(req("/api/piner/afterschool/pin/login"), NO_ENV);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("PAP-1887 S3-B: deny arbitrary child API and wrong methods with no credentials", async () => {
  for (const [p, method] of [
    ["/api/piner/afterschool/students", "POST"],
    ["/api/piner/afterschool/pin/login", "GET"],
    ["/api/piner/afterschool/session?includeParent=true", "GET"],
  ]) assert.equal((await dispatchPinerAfterschoolPin(req(p, method), NO_ENV)).status, 404);
});

test("PAP-1887 S3-B: Piner Worker source explicitly invokes dispatcher before OpenNext", () => {
  const source = readFileSync(new URL("../piner-staging-worker.mjs", import.meta.url), "utf8");
  const dispatch = source.indexOf("await dispatchPinerAfterschoolPin(request, env)");
  const next = source.indexOf("await openNextWorker.fetch(request, env, ctx)");
  assert.ok(dispatch > 0 && next > dispatch, "BFF must be considered before app/asset fallback");
  assert.match(source, /if \(afterschoolResponse\) return withNoIndex\(afterschoolResponse\)/);
});

test("PAP-1887 S3-B: DO rejects unknown methods/actions and oversized bodies", async () => {
  const limiter = new PinerAfterschoolRateGuard({ storage: memoryStore() });
  assert.equal((await limiter.fetch(new Request("https://rate-guard.invalid/check"))).status, 404);
  assert.equal((await limiter.fetch(rateRequest("give-me-admin"))).status, 400);
  assert.equal((await limiter.fetch(new Request("https://rate-guard.invalid/check", {
    method: "POST", body: "x".repeat(129),
  }))).status, 503);
});

test("PAP-1887 S3-B: DO blocks 11th login within window; resets at 15m", async () => {
  const limiter = new PinerAfterschoolRateGuard({ storage: memoryStore() });
  let now = 123000;
  limiter.clock = () => now;
  for (let i = 0; i < 10; i++) assert.equal((await limiter.fetch(rateRequest("login"))).status, 200);
  assert.equal((await limiter.fetch(rateRequest("login"))).status, 429);
  now += 15 * 60 * 1000;
  assert.equal((await limiter.fetch(rateRequest("login"))).status, 200);
});

test("PAP-1887 S3-B: DO fail-closed if transactional storage fails", async () => {
  const limiter = new PinerAfterschoolRateGuard({
    storage: { transaction: async () => { throw new Error("D1 unavailable"); } },
  });
  assert.equal((await limiter.fetch(rateRequest("login"))).status, 503);
});
