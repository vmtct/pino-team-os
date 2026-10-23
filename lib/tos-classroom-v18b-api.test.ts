import test from "node:test";
import assert from "node:assert/strict";
import {tosClassroomV18bApi,V18bCoreError,V18B_WRITE_ADMITTED} from "./tos-classroom-v18b-api";

test("PAP-945 reads session-free Classroom Today scoped by center and local date",async()=>{
 const old=globalThis.fetch,paths:string[]=[];
 globalThis.fetch=(async(input:RequestInfo|URL,init:RequestInit={})=>{
  assert.equal(init.method,"GET");paths.push(String(input));
  return new Response(JSON.stringify({data:{centerId:"center-1",localDate:"2026-10-23",timeZone:"Asia/Ho_Chi_Minh",
   occurrences:[],suppressed:[],diagnostics:[]}}),{status:200,headers:{"content-type":"application/json"}});
 }) as typeof fetch;
 try{
  const r=await tosClassroomV18bApi.today("center-1","2026-10-23");
  assert.equal(r.occurrences.length,0);
  assert.deepEqual(paths,["/api/tos-learning/classroom/day?centerId=center-1&localDate=2026-10-23"]);
 }finally{globalThis.fetch=old}
});
test("PAP-945 source-owned 403/404 failures surface rather than legacy mock fallback",async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=(async()=>new Response(JSON.stringify({error:{code:"ACCESS_PERMISSION_DENIED",message:"Forbidden"}}),
  {status:403,headers:{"content-type":"application/json"}})) as typeof fetch;
 try{
  await assert.rejects(tosClassroomV18bApi.today("center-1","2026-10-23"),
   (e:unknown)=>e instanceof V18bCoreError&&e.status===403&&e.code==="ACCESS_PERMISSION_DENIED");
 }finally{globalThis.fetch=old}
});
test("PAP-945 malformed scope denied before any sensitive fetch",async()=>{
 const old=globalThis.fetch;let called=false;
 globalThis.fetch=(async()=>{called=true;throw new Error("Unexpected fetch")}) as typeof fetch;
 try{
  assert.throws(()=>tosClassroomV18bApi.today("","2026-10-23"),V18bCoreError);
  assert.throws(()=>tosClassroomV18bApi.today("center-1","23/10/2026"),V18bCoreError);
  assert.throws(()=>tosClassroomV18bApi.today("center-1","2026-02-30"),V18bCoreError);
  assert.equal(called,false);
 }finally{globalThis.fetch=old}
});
test("PAP-945 every Path Diary mutation fails closed until PAP-724 private R2 is verified",async()=>{
 assert.equal(V18B_WRITE_ADMITTED,false);
 const old=globalThis.fetch;let called=false;
 globalThis.fetch=(async()=>{called=true;throw new Error("Unexpected mutation")}) as typeof fetch;
 const fail=(e:unknown)=>e instanceof V18bCoreError&&e.code==="CORE_V18B_WRITE_NOT_ADMITTED";
 try{
  await assert.rejects(tosClassroomV18bApi.register({centerId:"c",runningClassId:"r",studentId:"s",
   pathKey:"p",teachingContextKey:"k",mission:{missionId:"m",code:"X",name:"Mission"}},"key"),fail);
  await assert.rejects(tosClassroomV18bApi.saveDraft("d",{centerId:"c",expectedVersion:1,outcomes:{}}, "key"),fail);
  await assert.rejects(tosClassroomV18bApi.appendMission("d",{centerId:"c",expectedVersion:1,
   mission:{missionId:"m",code:"X",name:"Mission"}},"key"),fail);
  await assert.rejects(tosClassroomV18bApi.uploadEvidence("d",{centerId:"c",mimeType:"image/jpeg",base64:"abc"},"key"),fail);
  await assert.rejects(tosClassroomV18bApi.close("d",{centerId:"c",expectedVersion:1,interest:1,notes:"note",
   difficulty:"hard"},"key"),fail);
  assert.equal(called,false);
 }finally{globalThis.fetch=old}
});
