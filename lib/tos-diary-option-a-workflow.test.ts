import test from "node:test";
import assert from "node:assert/strict";
import {createV18bApiTransport,type V18bPathDiary} from "./tos-classroom-v18b-api";
import {beginDiaryDraftWithLinks,resumeDiaryPartialDraft,resumeDiaryClose,type DiaryClosePlan} from "./tos-diary-observation-workflow";
import type {PreparedDiarySubmission} from "./tos-diary-submit-preflight";

const scope={centerId:"center-a",runningClassId:"class-a",studentId:"student-a",pathKey:"path-a",localDate:"2026-11-02"};
const registration={centerId:scope.centerId,runningClassId:scope.runningClassId,studentId:scope.studentId,
 pathKey:scope.pathKey,teachingContextKey:"class-a:2026-11-02"};
const prepared=(missionId="mission-a",assignmentId="assignment-a",submissionKey="request-a"):PreparedDiarySubmission=>({
 registration,selected:[{missionId,assignmentId}],eligibleMissionIds:[missionId],submissionKey,
});
const reply=(data:unknown,status=200)=>new Response(JSON.stringify({data}),{status,headers:{"content-type":"application/json"}});
const err=(code:string,status=503)=>new Response(JSON.stringify({error:{code,message:code}}),{status});
function record(status:"REGISTERED"|"CLOSED"="REGISTERED",version=1):V18bPathDiary{
 return {id:"diary-a",centerId:scope.centerId,runningClassId:scope.runningClassId,
  studentId:scope.studentId,teachingContextKey:registration.teachingContextKey,pathKey:scope.pathKey,
  status,version,interest:null,notes:null,difficulty:null,draftSavedAt:null};
}
function fixture(){
 let diary:V18bPathDiary|null=null;
 const links=new Map<string,{id:string;diaryId:string;missionId:string;assignmentId:string}>();
 const calls:{url:string;method:string;body:Record<string,unknown>|null;key:string|null}[]=[];
 let dropDraftAck=false,dropCloseAck=false;
 const fetcher=(async(input:RequestInfo|URL,init:RequestInit={})=>{
  const url=String(input),method=init.method??"GET";
  const body=init.body?JSON.parse(String(init.body)) as Record<string,unknown>:null;
  calls.push({url,method,body,key:new Headers(init.headers).get("idempotency-key")});
  if(url.includes("/learning/path-diaries/resolve?")&&method==="GET"){
   return reply(!diary?{state:"NOT_FOUND",diary:null}:
    diary.status==="REGISTERED"?{state:"REGISTERED",diary}:{state:"ALREADY_SUBMITTED",diary});
  }
  if(url.endsWith("/learning/path-diaries")&&method==="POST"){
   if(!diary)diary=record();
   return reply(diary,201);
  }
  if(url.includes("/learning/path-diaries/diary-a/mission-links?")&&method==="GET")
   return reply([...links.values()]);
  if(url.endsWith("/learning/path-diaries/diary-a/mission-links")&&method==="POST"){
   const missionId=String(body?.missionId),assignmentId=String(body?.assignmentId);
   const link={id:"link-"+missionId,diaryId:"diary-a",missionId,assignmentId};
   links.set(missionId,link);return reply(link,201);
  }
  if(url.includes("/learning/path-diaries/diary-a?")&&method==="GET")
   return diary?reply(diary):err("DIARY_NOT_FOUND",404);
  if(url.endsWith("/learning/path-diaries/diary-a/draft")&&method==="POST"){
   if(!diary)return err("DIARY_NOT_FOUND",404);
   diary={...diary,version:diary.version+1,interest:body?.interest===undefined?diary.interest:body.interest as number|null,
    notes:body?.notes===undefined?diary.notes:body.notes as string|null,
    difficulty:body?.difficulty===undefined?diary.difficulty:body.difficulty as string|null,draftSavedAt:"2026-11-02T08:00:00Z"};
   if(dropDraftAck){dropDraftAck=false;return err("DRAFT_ACK_LOST");}
   return reply(diary);
  }
  if(url.endsWith("/learning/path-diaries/diary-a/close")&&method==="POST"){
   if(!diary)return err("DIARY_NOT_FOUND",404);
   diary={...diary,status:"CLOSED",version:diary.version+1,interest:Number(body?.interest),
    notes:String(body?.notes),difficulty:body?.difficulty===null?null:String(body?.difficulty),closedAt:"2026-11-02T09:00:00Z"};
   if(dropCloseAck){dropCloseAck=false;return err("CLOSE_ACK_LOST");}
   return reply(diary);
  }
  return err("UNEXPECTED_ROUTE",404);
 }) as typeof fetch;
 return {client:createV18bApiTransport(true,fetcher),calls,links,
  get diary(){return diary;},seedDiary(value:V18bPathDiary){diary=value;},
  seedLink(missionId:string,assignmentId:string){links.set(missionId,{id:"link-"+missionId,diaryId:"diary-a",missionId,assignmentId});},
  dropDraftAck(){dropDraftAck=true;},dropCloseAck(){dropCloseAck=true;},
  count(method:string,suffix:string){return calls.filter(call=>call.method===method&&call.url.endsWith(suffix)).length;},
 };
}
function closePlan(diary:V18bPathDiary,closeKey="close-key"):DiaryClosePlan{
 return {diaryId:diary.id,centerId:scope.centerId,studentId:scope.studentId,
  runningClassId:scope.runningClassId,teachingContextKey:registration.teachingContextKey,pathKey:scope.pathKey,
  expectedVersion:diary.version,closeKey,selected:[{missionId:"mission-a",assignmentId:"assignment-a"}],
  observation:{interest:3,notes:"Quan sát tốt.",difficulty:null}};
}
test("PAP-2277 explicit Start creates a blank Diary draft and links only the verified Assignment",async()=>{
 const f=fixture();
 const outcome=await beginDiaryDraftWithLinks(f.client,{prepared:prepared(),localDate:scope.localDate,beforeRegister:()=>true});
 assert.equal(outcome.state,"DRAFT_READY");
 if(outcome.state!=="DRAFT_READY")return;
 assert.equal(outcome.diary.status,"REGISTERED");assert.equal(outcome.diary.notes,null);
 assert.deepEqual(outcome.links.map(link=>[link.missionId,link.assignmentId]),[["mission-a","assignment-a"]]);
 assert.equal(f.count("POST","/learning/path-diaries"),1);
 assert.equal(f.count("POST","/draft"),0);assert.equal(f.count("POST","/close"),0);
});
test("PAP-2277 TOS Start refuses Mission selection without an explicit Assignment before Core access",async()=>{
 const f=fixture();
 const request={
  ...prepared(),
  selected:[{missionId:"mission-a"}],
 } as unknown as PreparedDiarySubmission;
 const outcome=await beginDiaryDraftWithLinks(f.client,{
  prepared:request,
  localDate:scope.localDate,
  beforeRegister:()=>true,
 });
 assert.equal(outcome.state,"DRAFT_PENDING");
 if(outcome.state==="DRAFT_PENDING")assert.equal(outcome.errorCode,"DIARY_ASSIGNMENT_REQUIRED");
 assert.equal(f.calls.length,0);
});
test("PAP-2277 Continue reuses one Diary for a second Mission and never Registers again",async()=>{
 const f=fixture();
 const first=await beginDiaryDraftWithLinks(f.client,{prepared:prepared(),localDate:scope.localDate,beforeRegister:()=>true});
 assert.equal(first.state,"DRAFT_READY");
 const second=await beginDiaryDraftWithLinks(f.client,{prepared:prepared("mission-b","assignment-b","request-b"),
  localDate:scope.localDate,beforeRegister:()=>{throw new Error("must reuse");}});
 assert.equal(second.state,"DRAFT_READY");
 if(second.state!=="DRAFT_READY")return;
 assert.equal(second.diary.id,"diary-a");assert.equal(second.links.length,2);
 assert.equal(f.count("POST","/learning/path-diaries"),1);
});
test("PAP-2277 existing CLOSED occurrence returns Submitted without a write",async()=>{
 const f=fixture();f.seedDiary({...record("CLOSED",2),interest:3,notes:"Sent",closedAt:"2026-11-02T09:00:00Z"});
 const result=await beginDiaryDraftWithLinks(f.client,{prepared:prepared(),localDate:scope.localDate,beforeRegister:()=>{throw new Error("must not register");}});
 assert.equal(result.state,"ALREADY_SUBMITTED");
 assert.equal(f.count("POST","/learning/path-diaries"),0);
 assert.equal(f.count("POST","/learning/path-diaries/diary-a/mission-links"),0);
});
test("PAP-2277 partial SaveDraft persists incomplete fields and readback makes retry idempotent",async()=>{
 const f=fixture();f.seedDiary(record());
 const plan={diaryId:"diary-a",centerId:scope.centerId,studentId:scope.studentId,
  runningClassId:scope.runningClassId,teachingContextKey:registration.teachingContextKey,pathKey:scope.pathKey,
  expectedVersion:1,saveKey:"save-key",fields:{interest:null,notes:"Ghi nhận đang làm.",difficulty:null}};
 const first=await resumeDiaryPartialDraft(f.client,plan);
 assert.equal(first.state,"DRAFT_SAVED");assert.equal(first.diary?.notes,"Ghi nhận đang làm.");
 const retry=await resumeDiaryPartialDraft(f.client,plan);
 assert.equal(retry.state,"DRAFT_SAVED");assert.equal(f.count("POST","/draft"),1);
});
test("PAP-2277 lost partial SaveDraft ACK is reconciled by the same Diary readback",async()=>{
 const f=fixture();f.seedDiary(record());f.dropDraftAck();
 const outcome=await resumeDiaryPartialDraft(f.client,{diaryId:"diary-a",centerId:scope.centerId,
  studentId:scope.studentId,runningClassId:scope.runningClassId,teachingContextKey:registration.teachingContextKey,
  pathKey:scope.pathKey,expectedVersion:1,saveKey:"save-key",
  fields:{interest:2,notes:null,difficulty:null}});
 assert.equal(outcome.state,"DRAFT_SAVED");assert.equal(outcome.diary?.interest,2);
 assert.equal(f.count("POST","/draft"),1);
});
test("PAP-2277 Close reports Submitted only after Core readback",async()=>{
 const f=fixture();f.seedDiary(record());f.seedLink("mission-a","assignment-a");
 const outcome=await resumeDiaryClose(f.client,closePlan(record()));
 assert.equal(outcome.state,"CLOSED_VERIFIED");assert.equal(outcome.diary?.status,"CLOSED");
 assert.equal(outcome.diary?.notes,"Quan sát tốt.");assert.equal(f.count("POST","/close"),1);
});
test("PAP-2277 lost Close ACK reads the closed Diary and never closes twice",async()=>{
 const f=fixture();f.seedDiary(record());f.seedLink("mission-a","assignment-a");f.dropCloseAck();
 const outcome=await resumeDiaryClose(f.client,closePlan(record()));
 assert.equal(outcome.state,"CLOSED_VERIFIED");assert.equal(outcome.diary?.status,"CLOSED");
 assert.equal(f.count("POST","/close"),1);
});
test("PAP-2277 stale Diary version and missing link fail closed before Close",async()=>{
 const f=fixture();f.seedDiary(record("REGISTERED",2));f.seedLink("mission-a","assignment-a");
 const stale=await resumeDiaryClose(f.client,closePlan(record("REGISTERED",1)));
 assert.equal(stale.state,"CLOSE_PENDING");assert.equal(stale.errorCode,"DIARY_CLOSE_VERSION_CONFLICT");
 assert.equal(f.count("POST","/close"),0);
 const g=fixture();g.seedDiary(record());
 const noLink=await resumeDiaryClose(g.client,closePlan(record()));
 assert.equal(noLink.state,"CLOSE_PENDING");assert.equal(noLink.errorCode,"DIARY_LINK_READBACK_INCOMPLETE");
 assert.equal(g.count("POST","/close"),0);
});


test("PAP-1400 stages the original ticket after occurrence miss and before Register",async()=>{
 const f=fixture();
 let callsWhenTicketStaged=-1;
 let stagedKey="";
 const outcome=await beginDiaryDraftWithLinks(f.client,{
  prepared:prepared("mission-a","assignment-a","request-a"),
  localDate:scope.localDate,
  beforeRegister:key=>{callsWhenTicketStaged=f.calls.length;stagedKey=key;return true;},
 });
 assert.equal(outcome.state,"DRAFT_READY");
 assert.equal(stagedKey,"request-a");
 assert.equal(callsWhenTicketStaged,1);
 assert.match(f.calls[0].url,/\/learning\/path-diaries\/resolve\?/);
 const register=f.calls[callsWhenTicketStaged];
 assert.equal(register.method,"POST");
 assert.ok(register.url.endsWith("/learning/path-diaries"));
 assert.equal(f.count("POST","/learning/path-diaries"),1);
});

test("PAP-1400 unavailable original ticket blocks Register",async()=>{
 const f=fixture();
 let staged=false;
 const outcome=await beginDiaryDraftWithLinks(f.client,{
  prepared:prepared(),localDate:scope.localDate,
  beforeRegister:()=>{staged=true;return false;},
 });
 assert.equal(staged,true);
 assert.equal(outcome.state,"DRAFT_PENDING");
 if(outcome.state==="DRAFT_PENDING")assert.equal(outcome.errorCode,"DIARY_REGISTER_TICKET_UNAVAILABLE");
 assert.equal(f.count("POST","/learning/path-diaries"),0);
 assert.equal(f.calls.some(call=>call.method==="POST"),false);
});
