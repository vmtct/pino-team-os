import test from "node:test";
import assert from "node:assert/strict";
import {createV18bApiTransport,tosClassroomV18bApi,V18bCoreError,V18B_WRITE_ADMITTED} from "./tos-classroom-v18b-api";

const reply=(data:unknown,status=200)=>new Response(JSON.stringify({data}),{status,headers:{"content-type":"application/json"}});
test("PAP-945 reads canonical Classroom Today scoped by Center/day",async()=>{
 const old=globalThis.fetch,paths:string[]=[];
 globalThis.fetch=(async(input:RequestInfo|URL,init:RequestInit={})=>{
  assert.equal(init.method,"GET");paths.push(String(input));
  return reply({centerId:"center-1",localDate:"2026-10-23",timeZone:"Asia/Ho_Chi_Minh",occurrences:[],suppressed:[],diagnostics:[]});
 }) as typeof fetch;
 try {
  const r=await tosClassroomV18bApi.today(" center-1 ","2026-10-23");
  assert.equal(r.occurrences.length,0);
  assert.deepEqual(paths,["/api/tos-learning/classroom/day?centerId=center-1&localDate=2026-10-23"]);
 }finally{globalThis.fetch=old;}
});
test("PAP-945 403/404 errors never fall back to a synthetic roster",async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=(async()=>new Response(JSON.stringify({error:{code:"ACCESS_PERMISSION_DENIED",message:"Forbidden"}}),{status:403})) as typeof fetch;
 try {
  await assert.rejects(tosClassroomV18bApi.today("center-1","2026-10-23"),
   (e:unknown)=>e instanceof V18bCoreError&&e.status===403&&e.code==="ACCESS_PERMISSION_DENIED");
 }finally{globalThis.fetch=old;}
});
test("PAP-945 malformed scope fails before network",async()=>{
 const old=globalThis.fetch;let called=false;
 globalThis.fetch=(async()=>{called=true;throw new Error("Unexpected fetch")}) as typeof fetch;
 try {
  assert.throws(()=>tosClassroomV18bApi.today("","2026-10-23"),V18bCoreError);
  assert.throws(()=>tosClassroomV18bApi.today("center-1","23/10/2026"),V18bCoreError);
  assert.throws(()=>tosClassroomV18bApi.today("center-1","2026-02-30"),V18bCoreError);
  assert.equal(called,false);
 }finally{globalThis.fetch=old;}
});
test("PAP-945 V18b runtime singleton keeps every Core mutation disabled",async()=>{
 assert.equal(V18B_WRITE_ADMITTED,false);
 const old=globalThis.fetch;let called=false;
 globalThis.fetch=(async()=>{called=true;throw new Error("Unexpected mutation")}) as typeof fetch;
 const fail=(e:unknown)=>e instanceof V18bCoreError&&e.code==="CORE_V18B_WRITE_NOT_ADMITTED";
 try {
  await assert.rejects(tosClassroomV18bApi.register({centerId:"c",runningClassId:"r",studentId:"s",pathKey:"p",teachingContextKey:"k"},"key"),fail);
  await assert.rejects(tosClassroomV18bApi.saveDraft("d",{centerId:"c",expectedVersion:1,interest:2},"key"),fail);
  await assert.rejects(tosClassroomV18bApi.linkMission("d",{centerId:"c",missionId:"m",assignmentId:"a"},"key"),fail);
  await assert.rejects(tosClassroomV18bApi.uploadEvidence("d",{centerId:"c",mimeType:"image/jpeg",base64:"abc"},"key"),fail);
  await assert.rejects(tosClassroomV18bApi.close("d",{centerId:"c",expectedVersion:1,interest:1,notes:"Note"},"key"),fail);
  assert.equal(called,false);
 }finally{globalThis.fetch=old;}
});
test("PAP-945 simulation creates observation-only Diary; link is a separate idempotent command",async()=>{
 const log:Array<{url:string;method:string;body:unknown;key:string|null}>=[];
 const fake=(async(input:RequestInfo|URL,init:RequestInit={})=>{
  const url=String(input);
  log.push({url,method:init.method??"GET",body:init.body?JSON.parse(String(init.body)):null,key:new Headers(init.headers).get("idempotency-key")});
  if(url.endsWith("/mission-links"))return reply({id:"link-1",diaryId:"diary-1",missionId:"mission-1",assignmentId:"assignment-1"},201);
  return reply({id:"diary-1",version:1,status:"REGISTERED",studentId:"student-1"},201);
 }) as typeof fetch;
 const api=createV18bApiTransport(true,fake);
 const diary=await api.register({centerId:"center-1",runningClassId:"class-1",studentId:"student-1",pathKey:"path-1",teachingContextKey:"ctx-1"},"idem-register-1");
 assert.equal(diary.id,"diary-1");
 const link=await api.linkMission(diary.id,{centerId:"center-1",missionId:"mission-1",assignmentId:"assignment-1"},"idem-link-1");
 assert.equal(link.diaryId,diary.id);
 assert.equal(log.length,2);
 assert.equal(log[0]?.key,"idem-register-1");
 assert.equal(log[1]?.key,"idem-link-1");
 assert.equal(log[0]?.body&&Object.prototype.hasOwnProperty.call(log[0]?.body,"mission"),false);
 assert.deepEqual(log[1]?.body,{centerId:"center-1",missionId:"mission-1",assignmentId:"assignment-1"});
 assert.equal(log[1]?.url,"/api/tos-learning/learning/path-diaries/diary-1/mission-links");
});
test("PAP-945 fetches explicit Mission links; no inferred or legacy outcomes",async()=>{
 const api=createV18bApiTransport(false,(async(input:RequestInfo|URL,init:RequestInit={})=>{
  assert.equal(init.method,"GET");
  assert.equal(String(input),"/api/tos-learning/learning/path-diaries/diary-1/mission-links?centerId=center-1");
  return reply([{id:"link-1",missionId:"mission-1",diaryId:"diary-1",assignmentId:null}]);
 }) as typeof fetch);
 const links=await api.missionLinks("diary-1","center-1");
 assert.equal(links.length,1);
 assert.equal(links[0]?.missionId,"mission-1");
});
test("PAP-945 legacy Mission/Result payloads are rejected without any Core call",async()=>{
 let called=false;
 const api=createV18bApiTransport(true,(async()=>{called=true;throw new Error("unexpected")}) as typeof fetch);
 assert.throws(()=>api.register({centerId:"c",runningClassId:"r",studentId:"s",pathKey:"p",teachingContextKey:"x",mission:{missionId:"m"}} as never,"idem"),
  (e:unknown)=>e instanceof V18bCoreError&&e.status===409);
 assert.throws(()=>api.saveDraft("d",{centerId:"c",expectedVersion:1,outcomes:{"mission-1":true}} as never,"idem"),
  (e:unknown)=>e instanceof V18bCoreError&&e.status===409);
 await assert.rejects(api.appendMission(),(e:unknown)=>e instanceof V18bCoreError&&e.status===409);
 assert.throws(()=>api.saveDraft("d",{centerId:"c",expectedVersion:1,interest:5},"idem"),
  (e:unknown)=>e instanceof V18bCoreError&&e.status===400);
 assert.equal(called,false);
});
test("PAP-945 independent link failure never invents a success receipt or erases known Diary ID",async()=>{
 const api=createV18bApiTransport(true,(async(input:RequestInfo|URL)=>{
  if(String(input).endsWith("/mission-links"))
   return new Response(JSON.stringify({error:{code:"DIARY_LINK_MISSION_NOT_ELIGIBLE",message:"Not eligible"}}),{status:409});
  return reply({id:"diary-1",version:1,status:"REGISTERED"},201);
 }) as typeof fetch);
 const d=await api.register({centerId:"c",runningClassId:"r",studentId:"s",pathKey:"p",teachingContextKey:"t"},"idem-r");
 await assert.rejects(api.linkMission(d.id,{centerId:"c",missionId:"m",assignmentId:"a"},"idem-m"),
  (e:unknown)=>e instanceof V18bCoreError&&e.status===409&&e.code==="DIARY_LINK_MISSION_NOT_ELIGIBLE");
 assert.equal(d.id,"diary-1");
});
test("PAP-2275 resolves the exact occurrence and verifies the source Diary identity",async()=>{
 const scope={centerId:"center-a",runningClassId:"class-a",studentId:"student-a",pathKey:"path-a",localDate:"2026-11-02"};
 const diary={id:"diary-a",centerId:"center-a",runningClassId:"class-a",studentId:"student-a",
  teachingContextKey:"class-a:2026-11-02",pathKey:"path-a",status:"REGISTERED",version:1,
  interest:null,notes:null,difficulty:null};
 let url="";
 const api=createV18bApiTransport(false,(async(input:RequestInfo|URL,init:RequestInit={})=>{
  url=String(input);assert.equal(init.method,"GET");return reply({state:"REGISTERED",diary});
 }) as typeof fetch);
 const resolved=await api.resolveDiary(scope);
 assert.equal(resolved.state,"REGISTERED");assert.equal(resolved.diary?.id,"diary-a");
 assert.equal(url,"/api/tos-learning/learning/path-diaries/resolve?centerId=center-a&runningClassId=class-a&studentId=student-a&pathKey=path-a&localDate=2026-11-02");
});
test("PAP-2275 resolver rejects invalid dates and mismatched scope before any write",async()=>{
 let calls=0;
 const api=createV18bApiTransport(false,(async()=>{calls++;return new Response(JSON.stringify({error:{code:"CORE_UNAVAILABLE"}}),{status:503})}) as typeof fetch);
 assert.throws(()=>api.resolveDiary({centerId:"c",runningClassId:"r",studentId:"s",pathKey:"p",localDate:"2026-02-30"}),V18bCoreError);
 await assert.rejects(api.resolveDiary({centerId:"c",runningClassId:"r",studentId:"s",pathKey:"p",localDate:"2026-11-02"}),
  (e:unknown)=>e instanceof V18bCoreError&&e.code==="CORE_UNAVAILABLE");
 assert.equal(calls,1);
});
test("PAP-2276 generic Diary transport preserves optional-link compatibility",async()=>{
 const calls:Array<{url:string;body:unknown}>=[];
 const api=createV18bApiTransport(true,(async(input:RequestInfo|URL,init:RequestInit={})=>{
  calls.push({url:String(input),body:init.body?JSON.parse(String(init.body)):null});
  return reply({id:"link-a",diaryId:"diary-a",missionId:"mission-a",assignmentId:null},201);
 }) as typeof fetch);
 await api.linkMission("diary-a",{centerId:"c",missionId:"mission-a"},"key");
 assert.equal(calls[0]?.url,"/api/tos-learning/learning/path-diaries/diary-a/mission-links");
 assert.deepEqual(calls[0]?.body,{centerId:"c",missionId:"mission-a"});
});
