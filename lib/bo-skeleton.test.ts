import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { boSkeletonEnabled, BO_SKELETON_HOST, injectStudentsBridge, serveBoSkeleton, type BoSkeletonEnv } from "./bo-skeleton";

const base = "public/bo-authority-source/";
const manifest = JSON.parse(readFileSync(base + "manifest.json", "utf8"));
test("Hồ sơ đăng ký is the sole immutable source; every shipped authority byte matches its digest", () => {
  assert.equal(manifest.soleStylingModule, "Hồ sơ đăng ký (playground.html)");
  assert.equal(Object.keys(manifest.files).length, 8);
  for (const [file, digest] of Object.entries(manifest.files)) assert.equal(createHash("sha256").update(readFileSync(base + file)).digest("hex"), digest, file);
  assert.ok(!manifest.files["app.js"] && !manifest.files["index.html"]);
  const bridge=readFileSync(base+"skeleton-bridge.js","utf8");
  assert.doesNotMatch(bridge,/\.style\b|<style|setAttribute\(['"]style|createElement\(['"]style/);
  const cssNames=[...readFileSync(base+"playground.html","utf8").matchAll(/href="\.\/([^" ]+\.css)"/g)].map(m=>m[1]);
  assert.equal(cssNames.length,6);assert.ok(cssNames.every(n=>manifest.files[n]));
});
test("skeleton requires explicit staging flag AND exact shared staging hostname", () => {
  assert.equal(boSkeletonEnabled({APP_ENV:"staging",BO_UI_ONLY:"enabled"},BO_SKELETON_HOST),true);
  for(const host of ["bo.pinohouse.art","tos.pinohouse.art","pino-team-os.minhtri-van42.workers.dev"])assert.equal(boSkeletonEnabled({APP_ENV:"staging",BO_UI_ONLY:"enabled"},host),false);
  assert.equal(boSkeletonEnabled({APP_ENV:"production",BO_UI_ONLY:"enabled"},BO_SKELETON_HOST),false);
  assert.equal(boSkeletonEnabled({APP_ENV:"staging"},BO_SKELETON_HOST),false);
});
test("both injection seams fail closed on source drift",()=>{
  const source=readFileSync(base+"playground.js","utf8"),bridge=readFileSync(base+"skeleton-bridge.js","utf8");
  assert.ok(injectStudentsBridge(source,bridge).includes(bridge));
  assert.throws(()=>injectStudentsBridge(source+source,bridge),/drift/);
  assert.throws(()=>injectStudentsBridge(source.replace('return categories.map','return [];//'),bridge),/drift/);
});
function env(status=200):BoSkeletonEnv{return {APP_ENV:"staging",BO_UI_ONLY:"enabled",PINO_BO_CORE:{async executeWithStaffPassword(){return {status,requestId:"fixture",body:status===200?{data:{userId:"u",email:"fixture@example.test",surface:"BO",entitled:true}}:{error:{code:"ACCESS_SURFACE_DENIED"}}};}},ASSETS:{async fetch(request){const name=new URL(request.url).pathname.split('/').at(-1)!;try{return new Response(readFileSync(base+name),{headers:{"content-type":name.endsWith('.html')?'text/html':'text/css'}});}catch{return new Response(null,{status:404});}}}};}
const request=(file:string,cookie=true)=>new Request(`https://${BO_SKELETON_HOST}/bo-skeleton/${file}`,{headers:cookie?{cookie:"pino_staff_password_session=fixture-only"}:{}});
test("controller preserves authentication, ACL denial, private caching and asset allowlist",async()=>{
  assert.equal((await serveBoSkeleton(request("playground.html",false),env(),"playground.html")).status,307);
  assert.equal((await serveBoSkeleton(request("styles.css",false),env(),"styles.css")).status,401);
  assert.equal((await serveBoSkeleton(request("playground.html"),env(403),"playground.html")).status,403);
  assert.equal((await serveBoSkeleton(request("playground.html"),env(409),"playground.html")).status,409);
  assert.equal((await serveBoSkeleton(request("manifest.json"),env(),"manifest.json")).status,404);
  assert.equal((await serveBoSkeleton(request("index.html"),env(),"index.html")).status,404);
  const css=await serveBoSkeleton(request("styles.css"),env(),"styles.css");
  assert.equal(css.headers.get("cache-control"),"private, no-store");assert.equal(await css.text(),readFileSync(base+"styles.css","utf8"));
  const html=await serveBoSkeleton(request("playground.html"),env(),"playground.html");
  const body=await html.text();assert.match(body,/<base href="\/bo-skeleton\/">/);
  assert.match(body,/<script src="\.\/school-adapters.js"><\/script><script src="\.\/playground.js">/);
  const adapter=await serveBoSkeleton(request("school-adapters.js"),env(),"school-adapters.js");
  assert.match(adapter.headers.get("content-type")!,/javascript/);
});
