import test from "node:test";
import assert from "node:assert/strict";
import {createV18bApiTransport,tosClassroomV18bApi} from "./tos-classroom-v18b-api";
import {createDiaryObservationWithLinks,resumeDiaryObservationWithLinks} from "./tos-diary-observation-workflow";

const prepared={
 registration:{centerId:"center-a",runningClassId:"class-a",studentId:"student-a",pathKey:"path-a",teachingContextKey:"class-a:2026-11-02"},
 selected:[{missionId:"mission-a",assignmentId:"assignment-a"}],eligibleMissionIds:["mission-a"],submissionKey:"request-a",
};
const observation={interest:3,notes:"Đã quan sát học viên.",difficulty:null};
const data=(v:unknown,status=200)=>new Response(JSON.stringify({data:v}),{status,headers:{"content-type":"application/json"}});
const err=(code:string,status=503)=>new Response(JSON.stringify({error:{code,message:code}}),{status});
type Diary={id:string;centerId:string;studentId:string;teachingContextKey:string;pathKey:string;status:"REGISTERED";version:number;interest:number|null;notes:string|null;difficulty:string|null;draftSavedAt:string|null};
function fixture(){
 let diary:Diary|null=null;
 const links=new Map<string,{id:string;diaryId:string;missionId:string;assignmentId:string|null}>();
 const calls:{method:string;url:string;body:Record<string,unknown>|null;key:string|null}[]=[];
 let failDraftBefore=false,dropDraftAck=false,failReadback=false,dropLinkAck=false,foreignStudent=false;
 const fetcher=(async(url:RequestInfo|URL,init:RequestInit={})=>{
  const name=String(url),method=init.method??"GET";
  const body=init.body?JSON.parse(String(init.body)) as Record<string,unknown>:null;
  const key=new Headers(init.headers).get("idempotency-key");calls.push({method,url:name,body,key});
  if(name.endsWith("/learning/path-diaries")&&method==="POST"){
   if(diary)return err("DUPLICATE_REGISTER",409);
   diary={id:"diary-a",centerId:"center-a",studentId:"student-a",teachingContextKey:"class-a:2026-11-02",pathKey:"path-a",status:"REGISTERED",version:1,interest:null,notes:null,difficulty:null,draftSavedAt:null};
   return data(diary,201);
  }
  if(name.includes("/learning/path-diaries/diary-a?")&&method==="GET"){
   if(!diary)return err("NOT_FOUND",404);
   if(failReadback)return err("READBACK_UNAVAILABLE");
   return data(foreignStudent?{...diary,studentId:"wrong-student"}:diary);
  }
  if(name.includes("/learning/path-diaries/diary-a/draft")&&method==="POST"){
   if(!diary)return err("NOT_FOUND",404);
   if(failDraftBefore)return err("DRAFT_FAILED");
   diary={...diary,version:diary.version+1,interest:Number(body?.interest),notes:String(body?.notes),difficulty:body?.difficulty===null?null:String(body?.difficulty),draftSavedAt:"2026-11-02T07:00:00Z"};
   if(dropDraftAck){dropDraftAck=false;return err("DRAFT_ACK_LOST")}
   return data(diary);
  }
  if(name.includes("/learning/path-diaries/diary-a/mission-links")&&method==="GET")
   return data([...links.values()]);
  if(name.includes("/learning/path-diaries/diary-a/mission-links")&&method==="POST"){
   const missionId=String(body?.missionId);
   const receipt={id:"link-"+missionId,diaryId:"diary-a",missionId,assignmentId:String(body?.assignmentId??"")||null};
   links.set(missionId,receipt);
   if(dropLinkAck){dropLinkAck=false;return err("LINK_ACK_LOST")}
   return data(receipt,201);
  }
  return err("UNEXPECTED_ROUTE",404);
 }) as typeof fetch;
 return {client:createV18bApiTransport(true,fetcher),calls,links,
  get diary(){return diary},failDraftBefore:()=>{failDraftBefore=true},clearDraftFailure:()=>{failDraftBefore=false},
  dropDraftAck:()=>{dropDraftAck=true},dropLinkAck:()=>{dropLinkAck=true},
  failReadback:()=>{failReadback=true},restoreReadback:()=>{failReadback=false},
  foreignStudent:()=>{foreignStudent=true},
  changeDiary:()=>{if(diary)diary={...diary,version:2,notes:"Other editor"}}
 };
}
const count=(f:ReturnType<typeof fixture>,suffix:string)=>f.calls.filter(c=>c.method==="POST"&&c.url.endsWith(suffix)).length;
test("PAP-945 observation-only Register -> verified Draft -> durable Mission link keeps same Diary ID",async()=>{
 const f=fixture();const result=await createDiaryObservationWithLinks(f.client,{prepared,observation});
 assert.equal(result.state,"LINK_VERIFIED");
 if(result.state!=="LINK_VERIFIED")return;
 assert.equal(result.plan.diaryId,"diary-a");assert.deepEqual(result.verifiedMissionIds,["mission-a"]);
 assert.equal(count(f,"/learning/path-diaries"),1);
 assert.equal(count(f,"/draft"),1);assert.equal(count(f,"/mission-links"),1);
 assert.equal(f.calls[0]?.body?.mission,undefined);assert.equal(f.calls[0]?.body?.outcomes,undefined);
 assert.deepEqual(f.calls.filter(c=>c.method==="POST").map(c=>c.key),[
  "pap945:request-a:register","pap945:request-a:draft","pap945:request-a:link:mission-a"]);
 assert.equal(f.diary?.notes,observation.notes);assert.equal(f.links.size,1);
});
test("PAP-945 draft failure retains Diary and retries only draft on same ID, never re-Register",async()=>{
 const f=fixture();f.failDraftBefore();
 const first=await createDiaryObservationWithLinks(f.client,{prepared,observation});
 assert.equal(first.state,"OBSERVATION_PENDING");if(first.state!=="OBSERVATION_PENDING")return;
 assert.equal(first.plan.diaryId,"diary-a");assert.equal(first.errorCode,"DRAFT_FAILED");
 assert.equal(f.links.size,0);f.clearDraftFailure();
 const resumed=await resumeDiaryObservationWithLinks(f.client,first.plan);
 assert.equal(resumed.state,"LINK_VERIFIED");assert.equal(count(f,"/learning/path-diaries"),1);assert.equal(count(f,"/draft"),2);
 assert.equal(f.calls.filter(c=>c.method==="POST"&&c.url.endsWith("/draft")).every(c=>c.key==="pap945:request-a:draft"),true);
});
test("PAP-945 lost Draft acknowledgment verifies Core before retry; no duplicate Draft or Register",async()=>{
 const f=fixture();f.dropDraftAck();
 const first=await createDiaryObservationWithLinks(f.client,{prepared,observation});
 assert.equal(first.state,"OBSERVATION_PENDING");if(first.state!=="OBSERVATION_PENDING")return;
 const second=await resumeDiaryObservationWithLinks(f.client,first.plan);
 assert.equal(second.state,"LINK_VERIFIED");
 assert.equal(count(f,"/learning/path-diaries"),1);assert.equal(count(f,"/draft"),1);
});
test("PAP-945 Draft readback unavailable never fakes success or links Mission",async()=>{
 const f=fixture();f.failReadback();
 const first=await createDiaryObservationWithLinks(f.client,{prepared,observation});
 assert.equal(first.state,"OBSERVATION_PENDING");if(first.state!=="OBSERVATION_PENDING")return;
 assert.equal(f.links.size,0);f.restoreReadback();
 const second=await resumeDiaryObservationWithLinks(f.client,first.plan);
 assert.equal(second.state,"LINK_VERIFIED");assert.equal(count(f,"/learning/path-diaries"),1);
});
test("PAP-945 independent Mission link failure stays LINK_PENDING; resume never creates new Diary",async()=>{
 const f=fixture();f.dropLinkAck();
 const first=await createDiaryObservationWithLinks(f.client,{prepared,observation});
 assert.equal(first.state,"LINK_PENDING");if(first.state!=="LINK_PENDING")return;
 assert.equal(first.plan.diaryId,"diary-a");assert.deepEqual(first.pendingMissionIds,["mission-a"]);
 assert.equal(count(f,"/learning/path-diaries"),1);assert.equal(count(f,"/draft"),1);
 const {resumeDiaryMissionLinks}=await import("./tos-diary-mission-link-workflow");
 const second=await resumeDiaryMissionLinks(f.client,first.plan);
 assert.equal(second.state,"LINK_VERIFIED");
 assert.equal(count(f,"/learning/path-diaries"),1);assert.equal(count(f,"/mission-links"),1);
});
test("PAP-945 foreign-student Diary readback and version conflict fail closed without overwriting",async()=>{
 const f=fixture();f.failDraftBefore();
 const first=await createDiaryObservationWithLinks(f.client,{prepared,observation});
 assert.equal(first.state,"OBSERVATION_PENDING");if(first.state!=="OBSERVATION_PENDING")return;
 f.clearDraftFailure();f.foreignStudent();
 const foreign=await resumeDiaryObservationWithLinks(f.client,first.plan);
 assert.equal(foreign.state,"OBSERVATION_PENDING");if(foreign.state==="OBSERVATION_PENDING")assert.equal(foreign.errorCode,"DIARY_OBSERVATION_SCOPE_MISMATCH");
 const g=fixture();g.failDraftBefore();
 const initial=await createDiaryObservationWithLinks(g.client,{prepared,observation});
 assert.equal(initial.state,"OBSERVATION_PENDING");if(initial.state!=="OBSERVATION_PENDING")return;
 g.clearDraftFailure();g.changeDiary();
 const stale=await resumeDiaryObservationWithLinks(g.client,initial.plan);
 assert.equal(stale.state,"OBSERVATION_PENDING");if(stale.state==="OBSERVATION_PENDING")assert.equal(stale.errorCode,"DIARY_OBSERVATION_VERSION_CONFLICT");
 assert.equal(count(g,"/draft"),1);assert.equal(g.links.size,0);
});
test("PAP-945 disabled UI transport refuses any new Register and never enters write path",async()=>{
 const previous=globalThis.fetch;let invoked=false;globalThis.fetch=(async()=>{invoked=true;throw Error("NO NETWORK")}) as typeof fetch;
 try{
  const result=await createDiaryObservationWithLinks(tosClassroomV18bApi,{prepared,observation});
  assert.equal(result.state,"REGISTER_UNCERTAIN");assert.equal(invoked,false);
 }finally{globalThis.fetch=previous}
});
