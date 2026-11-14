// PAP-1952 — Cloudflare Worker Custom Domain must not inject analytics into strict CSP.
import test from "node:test";
import assert from "node:assert/strict";
import staging from "../src/staging-worker.mjs";
const req = (path,method="GET") => new Request("https://app.staging.pinohouse.art"+path,{method});
test("PAP-1952 staging HTML is no-store/no-transform and CSP stays strict",async()=>{
 const r=await staging.fetch(req("/"));
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
