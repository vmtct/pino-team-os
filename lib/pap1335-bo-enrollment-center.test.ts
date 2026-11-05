import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { scopedEnrollmentFetcher } from "../app/bo/components/registration/BoScopedEnrollmentRead";
import { boCenterModuleScope, boScopedModuleHref } from "../app/bo/components/registration/BoGlobalCenterPolicy";
const { load } = createRequire(import.meta.url)("../public/bo-authority-source/school-adapters.js");
const A="0199f001-0000-7000-8000-000000000001";
const B="0199f001-0000-7000-8000-000000000002";
const id="0199f001-0000-7000-8000-000000000003";
const subscription="0199f001-0000-7000-8000-000000000004";
const classId="0199f001-0000-7000-8000-000000000005";
const row={id,studentDisplayName:"Synthetic Student",subscriptionId:subscription,runningClassName:"Synthetic Class",runningClassId:classId,pathDisplayName:"Art",effectiveFromLocalDate:"2026-11-01",effectiveUntilExclusiveLocalDate:null,plannedEntryLocalTime:null,plannedDurationMinutes:90};
const ok=(items:unknown[],nextCursor:unknown=null)=>new Response(JSON.stringify({data:{items,limit:100,nextCursor}}),{status:200});

test("PAP-1335: Enrollments is a Center-scoped read, not an unverified global list",async()=>{
 assert.equal(boCenterModuleScope("enrollments"),"CENTER");
 assert.equal(boCenterModuleScope("subscriptions"),"MIXED");
 assert.equal(boScopedModuleHref("/bo?module=enrollments&record=stale#detail","enrollments",A,[A]),"/bo?module=enrollments&centerId="+A);
 const calls:string[]=[];
 const fetcher=(async(input:RequestInfo|URL)=>{calls.push(String(input));return ok([row])}) as typeof fetch;
 const rows=await load("enrollments",scopedEnrollmentFetcher(fetcher,A),{centerId:A});
 assert.equal(rows.length,1);
 assert.equal(rows[0].id,id);
 assert.deepEqual(calls,["/api/bo/school/enrollments?limit=100&centerId="+A]);
});

test("PAP-1335: pagination keeps selected Center on every Enrollment page",async()=>{
 const calls:string[]=[];
 const fetcher=(async(input:RequestInfo|URL)=>{
   const url=new URL(String(input),"https://bo.invalid");
   calls.push(String(input));
   assert.equal(url.searchParams.get("centerId"),A);
   return calls.length===1?ok([row],{createdAt:"2026-11-01T00:00:00Z",id:subscription}):ok([]);
 }) as typeof fetch;
 await load("enrollments",scopedEnrollmentFetcher(fetcher,A),{centerId:A});
 assert.equal(calls.length,2);
 assert.ok(calls[1]?.includes("beforeSubscriptionId="+subscription));
});

test("PAP-1335: fail closed on forged, duplicate and cross-domain queries",async()=>{
 let count=0;
 const original=(async()=>{count++;return ok([row])}) as typeof fetch;
 assert.throws(()=>scopedEnrollmentFetcher(original,"invalid"),/xác thực/);
 const secure=scopedEnrollmentFetcher(original,A);
 for(const request of [
   "/api/bo/school/enrollments?centerId="+B,
   "/api/bo/school/enrollments?centerId="+A+"&centerId="+A,
   "/api/bo/school/enrollments?offset=5",
   "/api/bo/students",
   "https://not-bo.invalid/api/bo/school/enrollments"
 ]) await assert.rejects(secure(request),/khác cơ sở|không hợp lệ|ngoài phạm vi/);
 assert.equal(count,0);
});

test("PAP-1335: Core 403 never becomes unscoped retry or stale rows",async()=>{
 const calls:string[]=[];
 await assert.rejects(load("enrollments",scopedEnrollmentFetcher((async(input:RequestInfo|URL)=>{
   calls.push(String(input));
   return new Response(null,{status:403});
 }) as typeof fetch,A),{centerId:A}),/Core từ chối/);
 assert.deepEqual(calls,["/api/bo/school/enrollments?limit=100&centerId="+A]);
});
