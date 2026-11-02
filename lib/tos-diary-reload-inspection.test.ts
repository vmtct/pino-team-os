import test from "node:test";
import assert from "node:assert/strict";
import {createV18bApiTransport} from "./tos-classroom-v18b-api";
import {inspectDiaryAfterReload,type ReloadScope} from "./tos-diary-reload-inspection";
const scope:ReloadScope={centerId:"center-1",runningClassId:"class-1",studentId:"student-1",localDate:"2026-11-02",teachingContextKey:"class-1:2026-11-02",diaryId:"diary-1",selectedMissionIds:["mission-1","mission-2"]};
type Config={wrongCenter?:boolean;wrongStudent?:boolean;wrongPath?:boolean;notSaved?:boolean;missingLink?:boolean;wrongAssignment?:boolean;hasMore?:boolean;deny?:number;badLinkDiary?:boolean;closed?:boolean};
const response=(data:unknown)=>new Response(JSON.stringify({data}),{status:200});
const failed=(code:number)=>new Response(JSON.stringify({error:{code:"REJECTED",message:"rejected"}}),{status:code});
function fixture(c:Config={}){
 const calls:{method:string;url:string}[]=[];
 const api=createV18bApiTransport(false,(async(url:RequestInfo|URL,init:RequestInit={})=>{
  const u=String(url);calls.push({method:init.method??"GET",url:u});
  if(c.deny)return failed(c.deny);
  if(u.includes("/learning/missions/eligible?"))return response({
   centerId:scope.centerId,runningClassId:scope.runningClassId,studentId:scope.studentId,
   localDate:scope.localDate,teachingContextKey:scope.teachingContextKey,
   pathProgramId:"path-1",hasMore:Boolean(c.hasMore),
   items:[{missionId:"mission-1",code:"A",name:"First",level:1,assignmentId:"assignment-1"},
          {missionId:"mission-2",code:"B",name:"Second",level:2,assignmentId:null}],
  });
  if(u.includes("/learning/path-diaries/diary-1/mission-links?"))return response([
   {id:"link-1",diaryId:c.badLinkDiary?"diary-else":"diary-1",missionId:"mission-1",
    assignmentId:c.wrongAssignment?"assignment-else":"assignment-1",missionCode:"A",
    missionName:"First",missionStatus:"ACTIVE",linkedAt:"2026-11-02",linkedByUserId:"staff-1"},
   ...(c.missingLink?[]:[{id:"link-2",diaryId:"diary-1",missionId:"mission-2",
    assignmentId:null,missionCode:"B",missionName:"Second",missionStatus:"ACTIVE",
    linkedAt:"2026-11-02",linkedByUserId:"staff-1"}]),
  ]);
  if(u.includes("/learning/path-diaries/diary-1?"))return response({
   id:"diary-1",centerId:c.wrongCenter?"center-else":scope.centerId,
   studentId:c.wrongStudent?"student-else":scope.studentId,
   teachingContextKey:scope.teachingContextKey,pathKey:c.wrongPath?"path-else":"path-1",
   status:c.closed?"CLOSED":"REGISTERED",version:2,
   notes:c.notSaved?null:"Observed actual progress",interest:c.notSaved?null:3,difficulty:null,
   draftSavedAt:c.notSaved?null:"2026-11-02T11:00:00Z",closedAt:c.closed?"2026-11-02T11:01:00Z":null,
  });
  return failed(404);
 }) as typeof fetch);
 return {api,calls};
}
test("PAP-945 authenticated source readback verifies same Diary and all selected links without POST",async()=>{
 const f=fixture();const got=await inspectDiaryAfterReload(f.api,scope);
 assert.equal(got.state,"LINK_VERIFIED_READONLY");assert.equal(got.diaryId,"diary-1");
 assert.deepEqual(got.verifiedMissionIds,["mission-1","mission-2"]);
 assert.equal(got.canCreate,false);assert.equal(got.canRetry,false);
 assert.equal(f.calls.length,3);assert.equal(f.calls.every(c=>c.method==="GET"),true);
});
test("PAP-945 verified note with incomplete Mission links reports pending read-only not a retry command",async()=>{
 const f=fixture({missingLink:true});const got=await inspectDiaryAfterReload(f.api,scope);
 assert.equal(got.state,"LINK_PENDING_READONLY");assert.deepEqual(got.pendingMissionIds,["mission-2"]);
 assert.equal(got.canRetry,false);assert.equal(f.calls.some(c=>c.method!=="GET"),false);
});
test("PAP-945 incomplete observation stops before link lookup and cannot re-register",async()=>{
 const f=fixture({notSaved:true});const got=await inspectDiaryAfterReload(f.api,scope);
 assert.equal(got.state,"OBSERVATION_UNVERIFIED");assert.equal(got.diaryId,"diary-1");
 assert.equal(got.canRetry,false);assert.equal(f.calls.length,2);
});
test("PAP-945 cross-Center, Student, Path and Assignment fail closed",async()=>{
 for(const c of [{wrongCenter:true},{wrongStudent:true},{wrongPath:true},{wrongAssignment:true},{badLinkDiary:true}]){
  const f=fixture(c),got=await inspectDiaryAfterReload(f.api,scope);
  assert.equal(got.state,"SOURCE_UNVERIFIED");
  assert.equal(got.diaryId,null);assert.equal(got.canRetry,false);
  assert.equal(f.calls.every(x=>x.method==="GET"),true);
 }
});
test("PAP-945 401/403/404/409/503 and network fail closed, no writes",async()=>{
 for(const status of [401,403,404,409,503]){
  const f=fixture({deny:status}),got=await inspectDiaryAfterReload(f.api,scope);
  assert.equal(got.state,"SOURCE_UNVERIFIED");
  assert.equal(got.canCreate,false);assert.equal(got.canRetry,false);
  assert.equal(f.calls.every(x=>x.method==="GET"),true);
 }
 const f=createV18bApiTransport(false,(async()=>{throw Error("network down")}) as typeof fetch);
 assert.equal((await inspectDiaryAfterReload(f,scope)).state,"SOURCE_UNVERIFIED");
});
test("PAP-945 no guessed IDs, duplicate Mission, wrong context, incomplete catalog",async()=>{
 const f=fixture();for(const change of [{diaryId:""},{selectedMissionIds:[]},{selectedMissionIds:["mission-1","mission-1"]},
 {teachingContextKey:"class-else:2026-11-02"},{selectedMissionIds:["foreign"]}]){
  const got=await inspectDiaryAfterReload(f.api,{...scope,...change});
  assert.equal(got.state,"SOURCE_UNVERIFIED");
 }
 assert.equal((await inspectDiaryAfterReload(fixture({hasMore:true}).api,scope)).state,"SOURCE_UNVERIFIED");
});
test("PAP-945 CLOSED Diary readback can be verified without re-opening or mutation",async()=>{
 const f=fixture({closed:true}),got=await inspectDiaryAfterReload(f.api,scope);
 assert.equal(got.state,"LINK_VERIFIED_READONLY");assert.equal(got.canRetry,false);
 assert.equal(f.calls.every(c=>c.method==="GET"),true);
});
