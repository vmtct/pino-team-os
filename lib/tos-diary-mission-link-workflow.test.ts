import test from "node:test";
import assert from "node:assert/strict";
import {createV18bApiTransport,tosClassroomV18bApi,V18bCoreError} from "./tos-classroom-v18b-api";
import {createDiaryWithMissionLinks,resumeDiaryMissionLinks,validateMissionLinkChoices} from "./tos-diary-mission-link-workflow";

const registration={centerId:"center-1",runningClassId:"class-1",studentId:"student-1",pathKey:"path-1",teachingContextKey:"ctx-1"};
const selection=[{missionId:"mission-1"},{missionId:"mission-2",assignmentId:"assignment-2"}];
const data=(value:unknown,status=200)=>new Response(JSON.stringify({data:value}),{status,headers:{"content-type":"application/json"}});
const error=(status:number,code:string)=>new Response(JSON.stringify({error:{code,message:code}}),{status});
const fixture=()=>{
 const stored=new Map<string,string>();const calls:Array<{method:string,url:string,key:string|null;body:Record<string,unknown>|null}>=[];
 let failOneLink=false, failPostRead=false, registerFailure=false, wrongReadDiary=false, wrongReceipt=false;
 const fetcher=(async(input:RequestInfo|URL,init:RequestInit={})=>{
  const url=String(input),method=init.method??"GET";
  const key=new Headers(init.headers).get("idempotency-key");
  const body=init.body?JSON.parse(String(init.body)) as Record<string,unknown>:null;
  calls.push({method,url,key,body});
  if(url.endsWith("/path-diaries")&&method==="POST"){
   if(registerFailure)return error(503,"CORE_UNAVAILABLE");
   return data({id:"diary-1",studentId:"student-1",centerId:"center-1",status:"REGISTERED",version:1},201);
  }
  if(url.includes("/mission-links")&&method==="GET"){
   if(failPostRead&&stored.size>0)return error(503,"READBACK_UNAVAILABLE");
   return data([...stored].map(([missionId,assignmentId])=>({id:"link-"+missionId,diaryId:wrongReadDiary?"diary-foreign":"diary-1",missionId,assignmentId:assignmentId||null})));
  }
  if(url.includes("/mission-links")&&method==="POST"){
   const missionId=String(body?.missionId),assignmentId=String(body?.assignmentId??"");
   stored.set(missionId,assignmentId);
   if(failOneLink){failOneLink=false;return error(503,"LINK_ACK_LOST")}
   return data({id:"link-"+missionId,diaryId:wrongReceipt?"diary-foreign":"diary-1",missionId,assignmentId:assignmentId||null},201);
  }
  throw new Error("Unexpected path "+url);
 }) as typeof fetch;
 return {client:createV18bApiTransport(true,fetcher),calls,stored,
  failLinkOnce:()=>{failOneLink=true},failReadback:()=>{failPostRead=true},
  failRegister:()=>{registerFailure=true},foreignRead:()=>{wrongReadDiary=true},foreignReceipt:()=>{wrongReceipt=true}};
};
test("PAP-945 complete link readback of two selected Missions uses one Diary and separate idempotent commands",async()=>{
 const f=fixture();
 const state=await createDiaryWithMissionLinks(f.client,{registration,submissionKey:"submit-1",selected:selection,eligibleMissionIds:["mission-1","mission-2"]});
 assert.equal(state.state,"LINK_VERIFIED");
 if(state.state!=="LINK_VERIFIED")return;
 assert.equal(state.plan.diaryId,"diary-1");
 assert.deepEqual(state.verifiedMissionIds,["mission-1","mission-2"]);
 assert.deepEqual(state.pendingMissionIds,[]);
 assert.equal(f.calls.filter(x=>x.method==="POST"&&x.url.endsWith("/path-diaries")).length,1);
 assert.equal(f.calls.filter(x=>x.method==="POST"&&x.url.endsWith("/mission-links")).length,2);
 assert.deepEqual(f.calls.filter(x=>x.method==="POST").map(x=>x.key),[
  "pap945:submit-1:register","pap945:submit-1:link:mission-1","pap945:submit-1:link:mission-2"]);
 assert.equal(f.calls[0]?.body?.mission,undefined);
 assert.equal(f.calls[0]?.body?.outcomes,undefined);
 assert.equal(f.calls.some(x=>/mission-results|progression|\/missions$/.test(x.url)),false);
});
test("PAP-945 partial link failure retains durable diaryId and resumes without a second Register",async()=>{
 const f=fixture();f.failLinkOnce();
 const first=await createDiaryWithMissionLinks(f.client,{registration,submissionKey:"submit-2",selected:selection,eligibleMissionIds:["mission-1","mission-2"]});
 assert.equal(first.state,"LINK_PENDING");
 if(first.state!=="LINK_PENDING")return;
 assert.equal(first.plan.diaryId,"diary-1");assert.equal(first.errorCode,"LINK_ACK_LOST");
 const resumed=await resumeDiaryMissionLinks(f.client,first.plan);
 assert.equal(resumed.state,"LINK_VERIFIED");
 assert.equal(f.calls.filter(x=>x.method==="POST"&&x.url.endsWith("/path-diaries")).length,1,"retry MUST NOT register again");
 assert.equal(f.calls.filter(x=>x.method==="POST"&&x.url.endsWith("/mission-links")&&x.body?.missionId==="mission-1").length,1,"already-linked Mission NOT posted twice");
 assert.equal(f.stored.size,2);
});
test("PAP-945 response lost after Mission POST remains LINK_PENDING until readback, no invented success",async()=>{
 const f=fixture();f.failReadback();
 const first=await createDiaryWithMissionLinks(f.client,{registration,submissionKey:"submit-3",selected:[selection[0]],eligibleMissionIds:["mission-1"]});
 assert.equal(first.state,"LINK_PENDING");
 if(first.state!=="LINK_PENDING")return;
 assert.equal(first.plan.diaryId,"diary-1");assert.notEqual(first.state,"LINK_VERIFIED");
 assert.equal(f.stored.size,1);
});
test("PAP-945 uncertain Register never retries blindly or loses evidence of ambiguity",async()=>{
 const f=fixture();f.failRegister();
 const first=await createDiaryWithMissionLinks(f.client,{registration,submissionKey:"submit-4",selected:[selection[0]],eligibleMissionIds:["mission-1"]});
 assert.equal(first.state,"REGISTER_UNCERTAIN");
 if(first.state!=="REGISTER_UNCERTAIN")return;
 assert.equal(first.diaryId,null);assert.equal(first.errorCode,"CORE_UNAVAILABLE");
 assert.equal(f.calls.filter(x=>x.method==="POST").length,1);
});
test("PAP-945 refuses forged/fk-ineligible/empty/duplicate selections before Register",async()=>{
 const f=fixture();
 const payload={registration,submissionKey:"submit-5",eligibleMissionIds:["mission-1"]};
 for(const selected of [[],[{missionId:"mission-foreign"}],[{missionId:"mission-1"},{missionId:"mission-1"}],[{missionId:" "}]]){
  await assert.rejects(createDiaryWithMissionLinks(f.client,{...payload,selected}),(e:unknown)=>e instanceof V18bCoreError&&[400,403,409].includes(e.status));
 }
 assert.equal(f.calls.length,0);
 assert.deepEqual(validateMissionLinkChoices([{missionId:"mission-1"}],["mission-1"]),[{missionId:"mission-1"}]);
});
test("PAP-945 cross-Diary link readback or receipt never counts as verified",async()=>{
 const f=fixture();f.foreignReceipt();
 const state=await createDiaryWithMissionLinks(f.client,{registration,submissionKey:"submit-6",selected:[selection[0]],eligibleMissionIds:["mission-1"]});
 assert.equal(state.state,"LINK_PENDING");assert.equal(state.plan.diaryId,"diary-1");
 const g=fixture();g.stored.set("mission-1","");g.foreignRead();
 const replay=await resumeDiaryMissionLinks(g.client,{diaryId:"diary-1",centerId:"center-1",submissionKey:"submit-6",selected:[selection[0]]});
 assert.equal(replay.state,"LINK_PENDING");assert.equal(replay.errorCode,"DIARY_LINK_READBACK_MISMATCH");
});
test("PAP-945 normal V18b UI transport remains fail-closed (no newly enabled live writes)",async()=>{
 const old=globalThis.fetch;let called=false;
 globalThis.fetch=(async()=>{called=true;throw new Error("Must not call network")}) as typeof fetch;
 try{
  const r=await createDiaryWithMissionLinks(tosClassroomV18bApi,{registration,submissionKey:"disabled",selected:[selection[0]],eligibleMissionIds:["mission-1"]});
  assert.equal(r.state,"REGISTER_UNCERTAIN");assert.equal(r.errorCode,"CORE_V18B_WRITE_NOT_ADMITTED");
  assert.equal(called,false);
 }finally{globalThis.fetch=old}
});
