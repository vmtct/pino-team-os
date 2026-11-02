import test from "node:test";
import assert from "node:assert/strict";
import {readDiaryMissionLabels} from "./diary-mission-projection";

const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const other="01a0beba-bd4f-7d9f-b76f-cc3338c027e4";
const diary="01a19a44-faac-7e68-88f8-23e65f491949";
const mission="019d9880-1025-7000-8000-000000000031";
const assignment="01a19a44-20c2-7ae1-a306-a7146f73d95e";
const link="01a19a47-1063-7f0d-a4a6-cf5c2a651abe";
const rows=[{id:diary,centerId:center}];
const response=(data:unknown,status=200)=>Response.json({data},{status});
type Source={links?:unknown;status?:number;mission?:unknown};
function source(opt:Source={}){
 const urls:string[]=[];
 const fn=async (input:RequestInfo|URL)=>{
  const u=String(input);urls.push(u);
  if(u.includes("/mission-links"))return response(opt.links??[{id:link,diaryId:diary,missionId:mission,assignmentId:assignment}],opt.status??200);
  if(u.includes("/missions/"))return response(opt.mission??{id:mission,code:"QA-TOS-ART-01",name:"[QA TOS] Pha màu cơ bản"},opt.status??200);
  throw Error("Unexpected source path "+u);
 };
 return {fn:fn as typeof fetch,urls};
}
test("PAP-1342 HO GLOBAL source link + Core Mission Code/Name truth",async()=>{
 const s=source();
 const labels=await readDiaryMissionLabels(s.fn,rows,"HO","",new AbortController().signal);
 assert.equal(labels.get(diary),"QA-TOS-ART-01 — [QA TOS] Pha màu cơ bản");
 assert.deepEqual(s.urls,[
  "/api/ho/learning/path-diaries/"+diary+"/mission-links",
  "/api/ho/learning/missions/"+mission,
 ]);
});
test("PAP-1342 BO has Center on both source reads, not inferred from row",async()=>{
 const s=source();
 const labels=await readDiaryMissionLabels(s.fn,rows,"BO",center,new AbortController().signal);
 assert.equal(labels.get(diary),"QA-TOS-ART-01 — [QA TOS] Pha màu cơ bản");
 assert.deepEqual(s.urls,[
  "/api/bo/learning/path-diaries/"+diary+"/mission-links?centerId="+center,
  "/api/bo/learning/missions/"+mission+"?centerId="+center,
 ]);
});
test("PAP-1342 genuinely empty source link produces only truthful no-link label",async()=>{
 const s=source({links:[]});
 const labels=await readDiaryMissionLabels(s.fn,rows,"HO","",new AbortController().signal);
 assert.equal(labels.get(diary),"Chưa liên kết nhiệm vụ");
 assert.equal(s.urls.length,1);
});
test("PAP-1342 BO rejects wrong Center before contacting Core",async()=>{
 const s=source();
 await assert.rejects(readDiaryMissionLabels(s.fn,rows,"BO",other,new AbortController().signal),/Center mismatch/);
 assert.equal(s.urls.length,0);
});
test("PAP-1342 no link success on denied, missing, or malformed Core data",async()=>{
 for(const status of [401,403,404,503]){
  const s=source({status});
  await assert.rejects(readDiaryMissionLabels(s.fn,rows,"HO","",new AbortController().signal),new RegExp(String(status)));
 }
 for(const links of [[{id:link,diaryId:other,missionId:mission,assignmentId:assignment}],
   [{id:link,diaryId:diary,missionId:"not-uuid",assignmentId:null}],
   [{id:link,diaryId:diary,missionId:mission,assignmentId:assignment},{id:link,diaryId:diary,missionId:mission,assignmentId:assignment}]])
  await assert.rejects(readDiaryMissionLabels(source({links}).fn,rows,"HO","",new AbortController().signal),/Invalid|Duplicate/);
 await assert.rejects(readDiaryMissionLabels(source({mission:{id:other,code:"Q",name:"Wrong"}}).fn,rows,"HO","",new AbortController().signal),/identity/);
});
test("PAP-1342 no partial/misleading source on duplicate Diary IDs or aborted view",async()=>{
 const s=source();
 await assert.rejects(readDiaryMissionLabels(s.fn,[...rows,...rows],"BO",center,new AbortController().signal),/Duplicate|identity/);
 const ac=new AbortController();ac.abort();
 await assert.rejects(readDiaryMissionLabels(s.fn,rows,"HO","",ac.signal),/aborted/i);
});
