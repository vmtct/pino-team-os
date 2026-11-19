import {test} from "node:test";
import assert from "node:assert/strict";
import {ictWorkshopInstant,parseWorkshopDto,workshopApi} from "../app/components/mytime-workshop/api-client";
const id=(n:number)=>"01a03c6e-cc58-7d81-ac8e-"+String(n).padStart(12,"0");
const start="2026-11-29T07:00:00.000Z",end="2026-11-29T10:00:00.000Z";
const row={id:id(1),name:"Workshop",centerId:id(2),startAt:start,endAt:end,missionIds:[id(3)],specialtyId:null,capacity:10,note:null,eventLeadStaffId:id(4),academicLeadStaffId:null,otherStaffIds:[id(5)],facebookUrl:null,status:"SCHEDULED",version:1,createdAt:start,updatedAt:start,createdByName:null,updatedByName:null,references:{center:{id:id(2),label:"Center"},missions:[{id:id(3),label:"Mission"}],specialty:null,eventLead:{id:id(4),label:"Same name"},academicLead:null,otherStaff:[{id:id(5),label:"Same name"}]}};
test("PAP-2164 verifies reference IDs and keeps BO scoped to authorized Center",()=>{
 const s={surface:"BO" as const,centerId:id(2)};
 assert.equal(parseWorkshopDto(row,s).references.eventLead?.id,id(4));
 assert.throws(()=>parseWorkshopDto({...row,centerId:id(6)},s));
 assert.throws(()=>parseWorkshopDto({...row,references:{...row.references,eventLead:{id:id(5),label:"Same name"}}},s));
 assert.throws(()=>parseWorkshopDto({...row,missionIds:[]},s));
 assert.throws(()=>parseWorkshopDto({...row,version:0},s));
});
test("PAP-2164 Vietnamese datetime independent of browser zone",()=>{
 assert.equal(ictWorkshopInstant("2026-11-29T14:00"),start);
 assert.equal(ictWorkshopInstant(start),start);
 assert.throws(()=>ictWorkshopInstant("2026-11-29"));
});
test("PAP-2164 BO carries Center on each page; no writer or staff directory call",async()=>{
 const seen:string[]=[];
 const fetcher:typeof fetch=async(input,init)=>{
  seen.push(String(input));
  assert.equal(init?.credentials,"same-origin");assert.equal(init?.method,"GET");
  return Response.json({data:{events:[row],scopeCenterId:id(2),nextBeforeId:null}});
 };
 const api=workshopApi({surface:"BO",centerId:id(2)},fetcher),signal=new AbortController().signal;
 assert.equal((await api.allRows(signal))[0]?.id,id(1));
 await assert.rejects(api.choices("staff",signal));
 await assert.rejects(api.cancel(id(1),1,"a".repeat(20),signal));
 assert.equal(seen.length,1);assert.match(seen[0]!,/centerId=01a03c6e/);
});
test("PAP-2164 rejects mismatched scope and sends indempotent versioned patch",async()=>{
 const signal=new AbortController().signal;
 const mismatch=workshopApi({surface:"BO",centerId:id(2)},async()=>Response.json({data:{events:[],nextBeforeId:null,scopeCenterId:id(6)}}));
 await assert.rejects(mismatch.allRows(signal));
 const api=workshopApi({surface:"HO"},async(input,init)=>{
  assert.equal(String(input),"/api/ho/learning/mytime-workshops/"+id(1));
  assert.equal(init?.method,"PATCH");
  assert.deepEqual(JSON.parse(String(init?.body)),{name:"Changed",expectedVersion:1});
  assert.equal(new Headers(init?.headers).get("idempotency-key"),"a".repeat(20));
  return Response.json({data:{event:{...row,name:"Changed",version:2},committedVersion:2,replayed:false}});
 });
 assert.equal((await api.patch(id(1),{name:"Changed"},1,"a".repeat(20),signal)).version,2);
});

test("PAP-2199 canonical date validation rejects normalized impossible or incomplete dates",()=>{
 for(const v of ["2026-02-30T14:00","2026-11-31T09:00","2026-11-29T24:00","2026-11-29T14:61","2026-11-29","2026-02-30T07:00:00Z"])assert.throws(()=>ictWorkshopInstant(v),v);
 assert.equal(ictWorkshopInstant("2024-02-29T23:59"),"2024-02-29T16:59:00.000Z");
});
