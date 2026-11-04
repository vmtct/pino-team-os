import test from "node:test";
import assert from "node:assert/strict";
import {createV18bApiTransport,V18B_WRITE_ADMITTED} from "./tos-classroom-v18b-api";
import {reconcileUnknownDiaryRegister,type OriginalRegisterProof} from "./tos-diary-register-receipt-recovery";

const request:OriginalRegisterProof={
 registration:{centerId:"center-1",runningClassId:"class-1",studentId:"student-1",
  pathKey:"path-1",teachingContextKey:"class-1:2026-11-02"},
 submissionKey:"orig-uuid-1",
 localDate:"2026-11-02",
 selectedMissionIds:["mission-1"],
};
type Config={receiptStatus?:number;malformedReceipt?:boolean;noNote?:boolean;
 noLink?:boolean;wrongAssignment?:boolean;missingCatalog?:boolean;network?:boolean};
function setup(config:Config={}){
 const calls:Array<{method:string,url:string,key:string|null;body:string|null}>=[];
 const respond=(data:unknown,status=200)=>new Response(JSON.stringify({data}),{status});
 const error=(status:number)=>new Response(JSON.stringify({error:{
  code:status===404?"DIARY_REGISTER_RECEIPT_NOT_FOUND":"REJECTED",message:"Rejected"}}),{status});
 const transport:typeof fetch=async(url,init)=>{
  const u=String(url),method=init?.method??"GET";
  calls.push({method,url:u,key:new Headers(init?.headers).get("idempotency-key"),
   body:typeof init?.body==="string"?init.body:null});
  if(config.network)throw Error("Network down");
  if(u.endsWith("/register-receipt")){
   if(config.receiptStatus)return error(config.receiptStatus);
   return respond({
    id:"diary-1",...request.registration,
    studentId:config.malformedReceipt?"student-else":"student-1",
    status:"REGISTERED",version:2,interest:3,notes:"Authentic note",difficulty:null,
   });
  }
  if(u.includes("/missions/eligible?")){
   if(config.missingCatalog)return error(503);
   return respond({
    centerId:"center-1",runningClassId:"class-1",studentId:"student-1",
    localDate:"2026-11-02",teachingContextKey:"class-1:2026-11-02",
    pathProgramId:"path-1",hasMore:false,
    items:[{missionId:"mission-1",code:"M1",name:"Real Mission",level:1,
     assignmentId:"assignment-1"}],
   });
  }
  if(u.includes("/path-diaries/diary-1/mission-links?"))
   return respond(config.noLink?[]:[{
    id:"link-1",diaryId:"diary-1",missionId:"mission-1",
    assignmentId:config.wrongAssignment?"assignment-other":"assignment-1",
   }]);
  if(u.includes("/path-diaries/diary-1?"))
   return respond({id:"diary-1",...request.registration,
    status:"REGISTERED",version:2,notes:config.noNote?null:"Authentic note",
    interest:config.noNote?null:3,difficulty:null,
    draftSavedAt:config.noNote?null:"2026-11-02T13:01:00Z",closedAt:null});
  throw Error("Unexpected "+u);
 };
 return {api:createV18bApiTransport(false,transport),calls};
}

test("PAP-1400 original key recovery verifies single Diary read-only, no Register or Mission write",async()=>{
 const f=setup();
 assert.equal(V18B_WRITE_ADMITTED,false);
 const result=await reconcileUnknownDiaryRegister(f.api,request);
 assert.equal(result.state,"RECEIPT_FOUND_READONLY");
 assert.equal(result.diaryId,"diary-1");
 assert.equal(result.inspection?.state,"LINK_VERIFIED_READONLY");
 assert.equal(result.canCreate,false);assert.equal(result.canRetry,false);
 assert.equal(f.calls.length,4);
 assert.deepEqual(f.calls.map(x=>x.method),["POST","GET","GET","GET"]);
 assert.equal(f.calls[0]?.url,"/api/tos-learning/learning/path-diaries/register-receipt");
 assert.equal(f.calls[0]?.key,"pap945:orig-uuid-1:register");
 assert.equal(f.calls[0]?.body,JSON.stringify(request.registration));
 assert.equal(f.calls.some(x=>x.url.endsWith("/learning/path-diaries")),false);
});

test("PAP-1400 404 UNSEEN, 401/403 denied, 409 conflict, 503 and network error never retry Register",async()=>{
 const expected:[[number,string],[number,string],[number,string],[number,string],[number,string]]=[
  [404,"RECEIPT_UNSEEN"],[401,"RECEIPT_DENIED"],[403,"RECEIPT_DENIED"],
  [409,"RECEIPT_CONFLICT"],[503,"RECEIPT_UNVERIFIED"],
 ];
 for(const [receiptStatus,state] of expected){
  const f=setup({receiptStatus});
  const result=await reconcileUnknownDiaryRegister(f.api,request);
  assert.equal(result.state,state);assert.equal(result.diaryId,null);
  assert.equal(result.canCreate,false);assert.equal(result.canRetry,false);
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0]?.url.endsWith("/register-receipt"),true);
 }
 const f=setup({network:true});
 assert.equal((await reconcileUnknownDiaryRegister(f.api,request)).state,"RECEIPT_UNVERIFIED");
 assert.equal(f.calls.length,1);
});

test("PAP-1400 invalid or replaced submission proof refuses before network",async()=>{
 const f=setup();
 for(const invalid of [
  {...request,submissionKey:""},
  {...request,submissionKey:" orig-uuid-1 "},
  {...request,registration:{...request.registration,extra:"unexpected"}},
  {...request,localDate:"2026-11-03"},
  {...request,selectedMissionIds:[]},
  {...request,selectedMissionIds:["mission-1","mission-1"]},
  {...request,registration:{...request.registration,studentId:""}},
  {...request,registration:{...request.registration,teachingContextKey:"class-other:2026-11-02"}},
 ]){
  const result=await reconcileUnknownDiaryRegister(f.api,invalid);
  assert.equal(result.state,"RECEIPT_UNVERIFIED");
  assert.equal(result.diaryId,null);
 }
 assert.equal(f.calls.length,0);
});

test("PAP-1400 source mismatch and incomplete observation or links do not grant write authority",async()=>{
 for(const testCase of [
  {config:{malformedReceipt:true},state:"RECEIPT_UNVERIFIED",id:null},
  {config:{noNote:true},state:"RECEIPT_FOUND_INCOMPLETE",id:"diary-1"},
  {config:{noLink:true},state:"RECEIPT_FOUND_INCOMPLETE",id:"diary-1"},
  {config:{wrongAssignment:true},state:"RECEIPT_FOUND_INCOMPLETE",id:"diary-1"},
  {config:{missingCatalog:true},state:"RECEIPT_FOUND_INCOMPLETE",id:"diary-1"},
 ]){
  const f=setup(testCase.config);
  const result=await reconcileUnknownDiaryRegister(f.api,request);
  assert.equal(result.state,testCase.state);
  assert.equal(result.diaryId,testCase.id);
  assert.equal(result.canCreate,false);assert.equal(result.canRetry,false);
  assert.equal(f.calls.filter(x=>x.method==="POST").length,1);
 }
});
