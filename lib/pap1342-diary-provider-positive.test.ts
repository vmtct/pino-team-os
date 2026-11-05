import test from "node:test";
import assert from "node:assert/strict";
import {hoDiaryProvider,hoDiaryQueryForDay} from "@/app/ho/learning/diaries/schema";
import {diaryProvider,diaryQueryForDay} from "@/app/bo/classroom-diaries/schema";
const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5",id="01a19a44-faac-7e68-88f8-23e65f491949";
const mission="019d9880-1025-7000-8000-000000000031";
const entry={id,centerId:center,studentId:"019d9881-1025-7000-8000-000000000100",
 registeredByUserId:"019d9881-1025-7000-8000-000000000200",teachingContextKey:"class:2026-11-02",
 pathKey:"01a03c6e-cc58-78f3-aa4f-3e9b3ac2afe2",runningClassId:null,status:"REGISTERED",
 registeredAt:"2026-11-02T05:30:00.000Z",updatedAt:"2026-11-02T05:30:00.000Z",
 notes:null,interest:null,difficulty:null,version:1};
const label="QA-TOS-ART-01 — [QA TOS] Pha màu cơ bản";
const wrap=(data:unknown)=>Response.json({data});
function source(surface:"HO"|"BO"){
 const seen:string[]=[];
 const fn=async(input:RequestInfo|URL)=>{
  const url=String(input);seen.push(url);
  if(url.includes("/mission-links"))return wrap([{id:"01a19a47-1063-7f0d-a4a6-cf5c2a651abe",diaryId:id,missionId:mission,assignmentId:"01a19a44-20c2-7ae1-a306-a7146f73d95e"}]);
  if(url.includes("/missions/"))return wrap({id:mission,code:"QA-TOS-ART-01",name:"[QA TOS] Pha màu cơ bản"});
  if(url.includes("/path-diaries?"))return wrap({centerId:surface==="HO"?null:center,localDate:"2026-11-02",diaries:[entry],limit:100,offset:0,hasMore:false});
  if(url.includes("/path-diaries/"+id))return wrap(entry);
  throw Error("Unexpected TDD source "+url);
 };
 return {fn:fn as typeof fetch,seen};
}
test("PAP-1342 HO TDD Table/Drawer/Detail use actual Founder global linked Mission name",async()=>{
 const {fn,seen}=source("HO"),scope={surface:"HO" as const},signal=new AbortController().signal;
 const list=await hoDiaryProvider.list(hoDiaryQueryForDay("2026-11-02"),scope,fn,signal);
 assert.equal(list.records[0]?.row.mission,label);
 const detail=await hoDiaryProvider.detail(id,scope,fn,signal);
 assert.equal(detail?.row.mission,label);
 assert.ok(seen.some(x=>x.includes("/api/ho/learning/path-diaries/"+id+"/mission-links")));
 assert.ok(seen.some(x=>x.includes("/api/ho/learning/missions/"+mission)));
});
test("PAP-1342 BO TDD Table/Drawer/Detail source read retains Center on linked Mission",async()=>{
 const {fn,seen}=source("BO"),scope={surface:"BO" as const,centerId:center},signal=new AbortController().signal;
 const list=await diaryProvider.list(diaryQueryForDay("2026-11-02"),scope,fn,signal);
 assert.equal(list.records[0]?.row.mission,label);
 const detail=await diaryProvider.detail(id,scope,fn,signal);
 assert.equal(detail?.row.mission,label);
 assert.ok(seen.every(x=>!x.includes("/mission-links")||x.includes("?centerId="+center)));
 assert.ok(seen.every(x=>!x.includes("/missions/")||x.includes("?centerId="+center)));
});
