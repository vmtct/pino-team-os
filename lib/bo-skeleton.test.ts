import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { boSkeletonEnabled, BO_SKELETON_HOST, BO_AUTHORITY_ASSETS, serveBoSkeleton, type BoSkeletonEnv } from "./bo-skeleton";

const base = "public/bo-authority-source/";
const manifest = JSON.parse(readFileSync(base + "manifest.json", "utf8"));
test("Hồ sơ đăng ký is the sole immutable source; every shipped authority byte matches its digest", () => {
  assert.equal(manifest.soleStylingModule, "Hồ sơ đăng ký (playground.html)");
  assert.equal(Object.keys(manifest.files).length, 8);
  for (const [file, digest] of Object.entries(manifest.files)) assert.equal(createHash("sha256").update(readFileSync(base + file)).digest("hex"), digest, file);
  assert.ok(!manifest.files["app.js"] && !manifest.files["index.html"]);
  const cssNames=[...readFileSync(base+"playground.html","utf8").matchAll(/href="\.\/([^" ]+\.css)"/g)].map(m=>m[1]);
  assert.equal(cssNames.length,6);assert.ok(cssNames.every(n=>manifest.files[n]));
});
test("skeleton requires explicit staging flag AND exact shared staging hostname", () => {
  assert.equal(boSkeletonEnabled({APP_ENV:"staging",BO_UI_ONLY:"enabled"},BO_SKELETON_HOST),true);
  for(const host of ["bo.pinohouse.art","tos.pinohouse.art","pino-team-os.minhtri-van42.workers.dev"])assert.equal(boSkeletonEnabled({APP_ENV:"staging",BO_UI_ONLY:"enabled"},host),false);
  assert.equal(boSkeletonEnabled({APP_ENV:"production",BO_UI_ONLY:"enabled"},BO_SKELETON_HOST),false);
  assert.equal(boSkeletonEnabled({APP_ENV:"staging"},BO_SKELETON_HOST),false);
});
test("React owns the runtime; only six authority CSS assets are executable through controller",()=>{
  assert.equal(BO_AUTHORITY_ASSETS.size,6);
  assert.ok([...BO_AUTHORITY_ASSETS].every(file=>file.endsWith('.css')));
});
function env(status=200):BoSkeletonEnv{return {APP_ENV:"staging",BO_UI_ONLY:"enabled",PINO_BO_CORE:{async executeWithStaffPassword(){return {status,requestId:"fixture",body:status===200?{data:{userId:"u",email:"fixture@example.test",surface:"BO",entitled:true}}:{error:{code:"ACCESS_SURFACE_DENIED"}}};}},ASSETS:{async fetch(request){const name=new URL(request.url).pathname.split('/').at(-1)!;try{return new Response(readFileSync(base+name),{headers:{"content-type":name.endsWith('.html')?'text/html':'text/css'}});}catch{return new Response(null,{status:404});}}}};}
const request=(file:string,cookie=true)=>new Request(`https://${BO_SKELETON_HOST}/bo-skeleton/${file}`,{headers:cookie?{cookie:"pino_staff_password_session=fixture-only"}:{}});
test("controller preserves authentication, ACL denial, private caching and asset allowlist",async()=>{
  assert.equal((await serveBoSkeleton(request("playground.html",false),env(),"playground.html")).status,404);
  assert.equal((await serveBoSkeleton(request("styles.css",false),env(),"styles.css")).status,401);
  assert.equal((await serveBoSkeleton(request("styles.css"),env(403),"styles.css")).status,403);
  assert.equal((await serveBoSkeleton(request("styles.css"),env(409),"styles.css")).status,409);
  assert.equal((await serveBoSkeleton(request("manifest.json"),env(),"manifest.json")).status,404);
  assert.equal((await serveBoSkeleton(request("index.html"),env(),"index.html")).status,404);
  const css=await serveBoSkeleton(request("styles.css"),env(),"styles.css");
  assert.equal(css.headers.get("cache-control"),"private, no-store");assert.equal(await css.text(),readFileSync(base+"styles.css","utf8"));
  for(const file of ['playground.js','school-adapters.js','skeleton-bridge.js','manifest.json']) assert.equal((await serveBoSkeleton(request(file),env(),file)).status,404);
});
