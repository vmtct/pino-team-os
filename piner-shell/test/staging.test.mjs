// PAP-1952 — Cloudflare Worker Custom Domain must not inject analytics into strict CSP.
import test from "node:test";
import assert from "node:assert/strict";
import staging from "../src/staging-worker.mjs";
const req = (path,method="GET") => new Request("https://app.staging.pinohouse.art"+path,{method});
test("PAP-1952 staging HTML is no-store/no-transform and CSP stays strict",async()=>{
 const r=await staging.fetch(new Request("https://app.staging.pinohouse.art/",{headers:{cookie:"__Host-PINO_AFTERSCHOOL=fixture-only"}}),{AFTERSCHOOL_PIN_WORKER:{fetch:async()=>Response.json({data:{authenticated:true,expiresAt:"2099-01-01T00:00:00Z"}})}});
 assert.equal(r.status,200);
 assert.match(r.headers.get("Cache-Control"),/no-store/);
 assert.match(r.headers.get("Cache-Control"),/no-transform/);
 assert.match(r.headers.get("Content-Security-Policy"),/script-src 'self'/);
 assert.match(r.headers.get("X-Robots-Tag"),/noindex/);
 assert.equal(r.headers.get("X-Piner-Environment"),"staging");
});
test("PAP-1952 denial and R2 public asset caching preserve original semantics",async()=>{
 for(const [p,expected] of [["/piner/public",404],["/api/piner/context",404]]){
  const r=await staging.fetch(req(p),{PINER_BRAND_R2:{async get(){return null;}}});assert.equal(r.status,expected);
 }
 const deny=await staging.fetch(req("/piner/house","POST"));assert.equal(deny.status,405);
 const asset=await staging.fetch(req("/piner_journey_background.png"),{PINER_BRAND_R2:{async get(key){
  assert.equal(key,"piner_journey_background.png");
  return {body:new Blob(["R2-asset"]).stream(),httpEtag:'"fixture"',writeHttpMetadata(h){h.set("Content-Type","image/png")}};
 }}});
 assert.equal(asset.status,200);
 assert.match(asset.headers.get("Cache-Control"),/public/);
 assert.doesNotMatch(asset.headers.get("Cache-Control"),/no-transform/);
 assert.equal(asset.headers.get("X-Piner-Environment"),"staging");
});

test("PAP-2042 preserves the same-origin PIN request and response", async () => {
 const request = new Request("https://app.staging.pinohouse.art/api/piner/afterschool/pin/change", {
  method: "POST",
  headers: { origin: "https://app.staging.pinohouse.art", "sec-fetch-site": "same-origin", "x-pino-csrf": "fixture" },
  body: "{}"
 });
 const response = await staging.fetch(request, { AFTERSCHOOL_PIN_WORKER: {
  async fetch(received) {
   assert.equal(received, request);
   assert.equal(await received.text(), "{}");
   return new Response("{}", { headers: {
    "set-cookie": "__Host-PINO_AFTERSCHOOL=fixture; Secure; HttpOnly; Path=/",
    "cache-control": "no-store"
   } });
  }
 } });
 assert.equal(response.status, 200);
 assert.match(response.headers.get("set-cookie"), /^__Host-PINO_AFTERSCHOOL=fixture/);
 assert.match(response.headers.get("cache-control"), /no-store/);
});

test("PAP-2042 admits only the five method and path pairs", async () => {
 const paths = [
  ["/pin/login", "POST"], ["/pin/change", "POST"],
  ["/session", "GET"], ["/students", "GET"], ["/logout", "POST"]
 ];
 const prefix = "/api/piner/afterschool";
 const service = { AFTERSCHOOL_PIN_WORKER: { fetch: async () => new Response(null, { status: 204 }) } };
 for (const [path, method] of paths) {
  assert.equal((await staging.fetch(req(prefix + path, method), service)).status, 204);
  const denied = await staging.fetch(req(prefix + path, method === "GET" ? "POST" : "GET"), service);
  assert.equal(denied.status, 405);
  assert.equal(denied.headers.get("allow"), method);
 }
 assert.equal((await staging.fetch(req(prefix + "/other"), service)).status, 404);
 const unavailable = await staging.fetch(req(prefix + "/session"));
 assert.equal(unavailable.status, 503);
 assert.match(unavailable.headers.get("cache-control"), /no-store/);
});

test("PAP-2044 serves only read-only PIN login and Next static asset requests", async () => {
 const seen = [];
 const env = {
  PINER_BRAND_R2: { get: async () => null },
  AFTERSCHOOL_PIN_WORKER: { fetch: async request => {
   seen.push([new URL(request.url).pathname, request.method]);
   return new Response(null, { status: 200 });
  } }
 };
 const login = "/login";
 const asset = "/_next/static/chunks/app/piner-space/afterschool/login/page-546c04ab6ef5f833.js";
 const page = await staging.fetch(req(login), env);
 assert.equal(page.status, 200);
 assert.equal(page.headers.get("x-frame-options"), "DENY");
 assert.match(page.headers.get("cache-control"), /no-store/);
 assert.equal((await staging.fetch(req(asset, "HEAD"), env)).status, 200);
 assert.equal((await staging.fetch(req(asset, "POST"), env)).status, 405);
 assert.equal((await staging.fetch(req("/_next/data/private.json"), env)).status, 404);
 assert.deepEqual(seen, [["/piner-space/afterschool/login", "GET"], [asset, "HEAD"]]);
});

test("PAP-2044 exposes same-origin login only in bound Afterschool staging shell", async () => {
 const calls = [];
 const env = { AFTERSCHOOL_PIN_WORKER: { fetch: async request => {
  calls.push([new URL(request.url).pathname, request.method]);
  return new Response("PIN form", { headers: { "content-type": "text/html" } });
 } } };
 const login = "/login";
 const marker = /<a href="\/login" data-afterschool-login>/;
 for (const path of ["/piner/house", "/piner/house/grid", "/piner/house/reels", "/piner/house/community"]) {
  const response = await staging.fetch(req(path), env);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://app.staging.pinohouse.art/login");
  assert.equal(await response.text(), "");
  assert.equal((await staging.fetch(req(path))).status,302);
 }
 for (const path of ["/", "/piner", "/piner/mytime", "/piner/mytime/community"]) {
  assert.doesNotMatch(await (await staging.fetch(req(path), env)).text(), marker);
 }
 const { handleRequest } = await import("../src/worker.mjs");
 assert.doesNotMatch(await (await handleRequest(req("/piner/house"), env)).text(), marker);
 assert.equal(calls.length, 0);
 assert.equal((await staging.fetch(req(login), env)).status, 200);
 assert.deepEqual(calls, [["/piner-space/afterschool/login", "GET"]]);
});

test("PAP-2190 canonical login forwards only GET/HEAD and legacy redirects without query", async () => {
 const calls = [];
 const env = { PINER_BRAND_R2: { get: async () => null }, AFTERSCHOOL_PIN_WORKER: { fetch: async request => {
  calls.push([new URL(request.url).pathname, new URL(request.url).search, request.method]);
  return new Response(null, { status: 200 });
 } } };
 for (const method of ["GET", "HEAD"]) {
  const page = await staging.fetch(req("/login?next=https://example.invalid", method), env);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("referrer-policy"), "no-referrer");
  assert.match(page.headers.get("cache-control"), /no-store/);
  assert.match(page.headers.get("x-robots-tag"), /noindex/);
  const legacy = await staging.fetch(req("/piner-space/afterschool/login?next=https://example.invalid", method), env);
  assert.equal(legacy.status, 308);
  assert.equal(legacy.headers.get("location"), "https://app.staging.pinohouse.art/login");
  assert.match(legacy.headers.get("cache-control"), /no-store/);
 }
 for (const path of ["/login", "/piner-space/afterschool/login"]) {
  const deny = await staging.fetch(req(path, "POST"), env);
  assert.equal(deny.status, 405);
  assert.equal(deny.headers.get("allow"), "GET, HEAD");
 }
 for (const path of ["/login/", "/login/anything", "/api/piner/afterschool/other"]) {
  assert.equal((await staging.fetch(req(path), env)).status, 404);
 }
 assert.equal((await staging.fetch(req("/login"))).status, 503);
 assert.deepEqual(calls, [["/piner-space/afterschool/login", "", "GET"], ["/piner-space/afterschool/login", "", "HEAD"]]);
});