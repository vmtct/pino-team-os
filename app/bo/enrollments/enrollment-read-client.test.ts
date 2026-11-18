import test from "node:test";
import assert from "node:assert/strict";
import {readEnrollmentRows,enrollmentRelationLinks} from "./enrollment-read-client";
const id=(n:number)=>"019d2181-0000-7000-8000-"+String(n).padStart(12,"0");
const center=id(100),row={id:id(1),subscriptionId:id(2),studentProfileId:id(3),runningClassId:id(4),studentDisplayName:"Synthetic learner",subscriptionDisplayName:"Piano · 12 tuần",runningClassName:"Piano",pathDisplayName:"PianoHouse",effectiveFromLocalDate:"2026-11-01",effectiveUntilExclusiveLocalDate:null,weekdayIso:3,scheduleStartsLocal:"12:30",scheduleEndsLocal:"13:15",createdAt:"2026-11-01T00:00:00Z",updatedAt:null};
const signal=()=>new AbortController().signal;
const response=(items:unknown[],nextCursor:unknown=null)=>Response.json({data:{items,nextCursor}});
test("PAP-2181 reads every authorized subscription page, including empty pages, without persisting schedule occurrences",async()=>{
 const requests:string[]=[];const cursor={id:id(9),createdAt:"2026-11-01T00:00:00Z"},cursor2={id:id(8),createdAt:"2026-10-01T00:00:00Z"};
 const fetcher=(async(input,init)=>{const url=new URL(String(input),"https://fixture.invalid");assert.equal(url.pathname,"/api/bo/school/enrollments");assert.equal(url.searchParams.get("centerId"),center);assert.equal(init?.method,"GET");assert.equal(init?.cache,"no-store");requests.push(url.search);
 return requests.length===1?response([row],cursor):requests.length===2?response([],cursor2):response([{...row,id:id(5),weekdayIso:7}]);}) as typeof fetch;
 const list=await readEnrollmentRows(fetcher,center,signal());
 assert.equal(list.length,2);assert.equal(list[0]?.row.schedule,"Thứ 4 · 12:30–13:15");assert.equal(list[1]?.row.schedule,"Chủ nhật · 12:30–13:15");assert.match(requests[1]!,/beforeSubscriptionId/);
 assert.equal(list[0]?.row.createdBy,null);assert.equal(list[0]?.row.updatedBy,null);
 assert.ok(enrollmentRelationLinks(list[0]!.relations,center).every(r=>new URL(r.href,"https://fixture.invalid").searchParams.get("centerId")===center));
});
test("missing schedule or audit remains unknown, not inferred from name or login",async()=>{
 const results=await readEnrollmentRows(async()=>response([{...row,weekdayIso:null,createdAt:null,updatedAt:null}]),center,signal());
 assert.equal(results[0]?.row.schedule,null);assert.equal(results[0]?.row.createdAt,null);
});
test("denial, duplicate IDs, invalid interval and repeated cursor fail closed",async()=>{
 await assert.rejects(()=>readEnrollmentRows(async()=>new Response(null,{status:403}),center,signal()));
 await assert.rejects(()=>readEnrollmentRows(async()=>response([row,row]),center,signal()),/trùng/);
 await assert.rejects(()=>readEnrollmentRows(async()=>response([{...row,effectiveUntilExclusiveLocalDate:"2026-10-31"}]),center,signal()),/Khoảng/);
 await assert.rejects(()=>readEnrollmentRows(async()=>response([],{id:id(9),createdAt:"2026-11-01T00:00:00Z"}),center,signal()),/lặp/);
});
