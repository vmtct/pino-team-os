/** PAP-1334 / PAP-1491 SPEC-UNLOCK — isolated client, no legacy fallback. */
import assert from "node:assert/strict";
import {test} from "node:test";
import {BoApiError} from "./bo-api-error";
import {readSubscriptionCenterDetail,subscriptionCenterDetailUrl} from "./bo-subscription-center-detail-client";

const subscriptionId="01a1d9ae-9940-7b00-8b80-000000014981";
const centerId="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const expected="/api/bo/subscriptions/"+subscriptionId+"/center-detail?centerId="+centerId;

test("PAP-1334 client emits exact selected-Center route, never unscoped by-ID",()=>{
 assert.equal(subscriptionCenterDetailUrl(subscriptionId,centerId),expected);
 assert.equal(subscriptionCenterDetailUrl(subscriptionId,centerId+" &x=1").includes("&x=1"),false);
});
test("PAP-1334 client reads scoped DTO with no legacy fallback",async()=>{
 const saved=globalThis.fetch;
 let requests=0;
 try {
  globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
   requests++;
   assert.equal(String(input),expected);
   assert.equal(init?.method,"GET");
   assert.equal(init?.cache,"no-store");
   return new Response(JSON.stringify({data:{id:subscriptionId,centerId}}),{
    status:200,headers:{"content-type":"application/json"},
   });
  }) as typeof fetch;
  const result=await readSubscriptionCenterDetail(subscriptionId,centerId);
  assert.equal(result.id,subscriptionId);
  assert.equal(requests,1);
 } finally {globalThis.fetch=saved;}
});
test("PAP-1334 client fails closed on 403 and 404, without retry to legacy route",async()=>{
 const saved=globalThis.fetch;
 try {
  for(const status of [403,404]){
   let requests=0;
   globalThis.fetch=(async(input:RequestInfo|URL)=>{
    requests++;
    assert.equal(String(input),expected);
    return new Response(JSON.stringify({error:{message:"Permission or Center denied"}}),{
     status,headers:{"content-type":"application/json"},
    });
   }) as typeof fetch;
   await assert.rejects(readSubscriptionCenterDetail(subscriptionId,centerId),BoApiError);
   assert.equal(requests,1);
  }
 } finally {globalThis.fetch=saved;}
});
