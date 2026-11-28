import test from "node:test";import assert from "node:assert/strict";
import {createTosWishHost,readWishActor,readReceptionWishCount} from "./tos-pls-wish-client";
import type {WishAttempt} from "./pls-wish-tos-contract";
const id="0198d050-56c1-7ac5-b9ab-b0e45d912345",other="0198d050-56c1-7ac5-b9ab-b0e45d912346",scope={centerId:id,learnerId:other};
test("TOS runtime pins actor scope and durable attempt before draw; same key on retry",async()=>{
 let actor=id,pending:WishAttempt|null=null;const requests:{path:string;init?:RequestInit}[]=[];
 const fetcher:typeof fetch=async(path,init)=>{requests.push({path:String(path),init});return Response.json({data:String(path).endsWith("session")?{actorId:actor}:{accepted:true}});};
 const journal={async read(){return pending;},async reserve(a:WishAttempt){pending=a;},async complete(){pending=null;}};
 const h=createTosWishHost(id,scope,journal,fetcher),a={key:"immutable",payload:{...scope,count:1,expectedCost:100,policyRevisionId:id,bannerRevisionId:other}};
 assert.equal(await readWishActor(new AbortController().signal,fetcher),id);
 await assert.rejects(h.draw(a));assert.equal(requests.filter(r=>r.path.endsWith("/draw")).length,0);
 await h.journal.reserve(a);await h.draw(a);await h.draw(a);
 const draws=requests.filter(r=>r.path.endsWith("/draw"));assert.equal(draws.length,2);for(const r of draws){assert.equal(new Headers(r.init?.headers).get("idempotency-key"),"immutable");assert.equal(new Headers(r.init?.headers).get("x-pino-expected-actor"),id);assert.deepEqual(JSON.parse(String(r.init?.body)),a.payload);}
 await assert.rejects(h.quote({...scope,learnerId:id},new AbortController().signal));
 actor=other;await assert.rejects(h.draw(a));await assert.rejects(h.journal.complete(a));assert.equal(pending,a);assert.equal(requests.filter(r=>r.path.endsWith("/draw")).length,2);
 actor=id;await h.journal.complete(a);assert.equal(pending,null);
});
test("PAP-2431 count validates exact Center/date, preserves zero vs unknown and rejects changed actor",async()=>{
 const workDate="2026-11-27",signal=new AbortController().signal;let actor=id,count:unknown=0,returnedCenter=id,changed=false;
 const fetcher:typeof fetch=async(path,init)=>{
  if(String(path).endsWith("session"))return Response.json({data:{actorId:actor}});
  assert.equal(new Headers(init?.headers).get("x-pino-expected-actor"),id);
  assert.match(String(path),/reception-count\?centerId=/);
  if(changed)actor=other;
  return Response.json({data:{centerId:returnedCenter,workDate,supportedCount:count}});
 };
 assert.equal(await readReceptionWishCount(id,workDate,signal,fetcher),0);
 count=null;assert.equal(await readReceptionWishCount(id,workDate,signal,fetcher),null);
 count=-1;await assert.rejects(readReceptionWishCount(id,workDate,signal,fetcher));
 count=2;returnedCenter=other;await assert.rejects(readReceptionWishCount(id,workDate,signal,fetcher));
 returnedCenter=id;changed=true;await assert.rejects(readReceptionWishCount(id,workDate,signal,fetcher));
});
