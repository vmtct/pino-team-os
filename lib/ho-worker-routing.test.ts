import test from "node:test";
import assert from "node:assert/strict";
import { handleHoStagingRequest } from "./ho-worker-routing";
const ho="ho.staging.pinohouse.art", bo="bo.staging.pinohouse.art", tos="tos.staging.pinohouse.art", fallback="pino-team-os-staging.minhtri-van42.workers.dev";
async function route(host: string, path: string, method="GET") { const calls: string[]=[];const r=await handleHoStagingRequest(new Request("https://"+host+path,{method}),{ASSETS:{async fetch(){calls.push("asset");return new Response("asset");}}},async()=>{calls.push("application");return new Response("application");});return {status:r.status,calls,location:r.headers.get("location"),body:await r.text()}; }
test("HO Worker enforces exact host and method fences before static or application handlers",async()=>{
 for(const p of ["/bo","/dashboard","/api/bo/learners","/bo-authority-source/styles.css","/team-legacy-global.css","/pap659-build-provenance.json"]) {const r=await route(ho,p);assert.equal(r.status,404,p);assert.deepEqual(r.calls,[],p);}
 for(const method of ["POST","PUT","PATCH","DELETE","OPTIONS","HEAD"]) {const r=await route(ho,"/api/bo/centers",method);assert.equal(r.status,404,method);assert.deepEqual(r.calls,[]);}
 for(const host of [bo,tos,fallback,"unknown.example","ho.pinohouse.art"]){const r=await route(host,"/ho/centers");assert.equal(r.status,404);assert.deepEqual(r.calls,[]);}
});
test("HO Worker serves only admitted static assets; authentication and APIs stay in Next",async()=>{
 for(const host of [ho,bo,tos,fallback])for(const method of ["GET","HEAD"]){assert.deepEqual((await route(host,"/_next/static/chunks/chunk.js",method)).calls,["asset"]);}
 assert.deepEqual((await route(fallback,"/pap659-build-provenance.json")).calls,["asset"]);
 assert.deepEqual((await route(tos,"/team-legacy-global.css")).calls,["asset"]);
 for(const p of ["/ho/centers","/api/bo/centers","/api/bo/context","/bo-skeleton/ho-scoped.css","/staff-login"]){assert.deepEqual((await route(ho,p)).calls,["application"],p);}
 for(const p of ["/bo-skeleton/styles.css","/bo-skeleton/playground.css"]){assert.deepEqual((await route(ho,p)).calls,[],p);}
 assert.deepEqual((await route(ho,"/api/staff-auth/login","POST")).calls,["application"]);
 assert.deepEqual((await route(ho,"/_next/static/chunks/%2f..%2fsource.js")).calls,[]);
});
test("HO Worker keeps root redirects on the same hostname and BO/TOS behavior",async()=>{
 const r=await route(ho,"/");assert.equal(r.status,307);assert.equal(r.location,"https://"+ho+"/ho/centers");assert.deepEqual(r.calls,[]);
 assert.equal((await route(bo,"/")).location,"https://"+bo+"/bo");
 assert.deepEqual((await route(tos,"/dashboard")).calls,["application"]);
 assert.deepEqual((await route(fallback,"/api/health")).calls,["application"]);
});
