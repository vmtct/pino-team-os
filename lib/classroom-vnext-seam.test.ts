import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {classroomSeamEnv,classroomVNextSeam,type ClassroomSeamEnv} from "./classroom-vnext-seam";
import {TosV4GateError,TOS_V4_STAGING_HOSTS} from "./tos-v4-staging-gate";
import {classroomFixture} from "./test-fixtures/classroom-v4";
import {renderClassroom} from "./test-support/classroom-v4-render";

const host=TOS_V4_STAGING_HOSTS[0];
const requestHeaders=()=>new Headers({host,cookie:"pino_staff_password_session=opaque"});
const now=new Date("2026-11-06T18:00:00Z");
function fixture(){
 const calls:string[]=[];
 const context:{userId:string;staffMemberId:string;centers:unknown}={userId:"user",staffMemberId:"staff",centers:[{id:"core-center",timeZone:"Asia/Ho_Chi_Minh"}]};
 const env:ClassroomSeamEnv={APP_ENV:"staging",PAP945_CLASSROOM_READ_ONLY:"true",
  PINO_WORKFORCE_CORE:{executeWithStaffPassword:async(req,token)=>{
   calls.push("context");assert.deepEqual(req,{method:"GET",path:"/context"});assert.equal(token,"opaque");
   return {status:200,body:{data:context},requestId:"context"};
  }},
  PINO_TOS_LEARNING_CORE:{executeWithStaffPassword:async(req,token)=>{
   calls.push("classroom");assert.equal(token,"opaque");
   assert.deepEqual(req,{method:"GET",path:"/classroom/day",body:{centerId:"core-center",localDate:"2026-11-07"}});
   return {status:200,body:{data:{...(req.body as object),occurrences:[]}},requestId:"day"};
  }},
 };
 return {env,calls,context};
}
const denied=(status:number)=>(e:unknown)=>e instanceof TosV4GateError&&e.status===status;
test("PAP-945 missing Cloudflare context falls back only in disabled non-staging development",async()=>{
 const error=new Error("Cloudflare context unavailable");
 const missing=async():Promise<ClassroomSeamEnv>=>{throw error};
 const local=new Headers({host:"localhost:3000"});
 for(const flag of [undefined,"false","TRUE","1",""]){
  assert.equal(await classroomSeamEnv(missing,local,{NODE_ENV:"development",PAP945_CLASSROOM_READ_ONLY:flag}),null);
 }
 for(const runtime of [
  {},{NODE_ENV:"production"},{NODE_ENV:"test"},
  {NODE_ENV:"development",APP_ENV:"staging"},
  {NODE_ENV:"development",PAP945_CLASSROOM_READ_ONLY:"true"},
 ])await assert.rejects(classroomSeamEnv(missing,local,runtime),(e:unknown)=>e===error);
 for(const stagingHost of TOS_V4_STAGING_HOSTS)
  await assert.rejects(classroomSeamEnv(missing,new Headers({host:stagingHost}),{NODE_ENV:"development"}),(e:unknown)=>e===error);
 const {env}=fixture();
 assert.equal(await classroomSeamEnv(async()=>env,local,{NODE_ENV:"development"}),env);
 await assert.rejects(classroomVNextSeam(local,env,now),denied(404));
});
test("PAP-945 seam defaults off without any Core reads, including query-like headers",async()=>{
 for(const flag of [undefined,"false","TRUE","1",""]){
  const {env,calls}=fixture();env.PAP945_CLASSROOM_READ_ONLY=flag;
  const headers=requestHeaders();headers.set("x-forwarded-host",host);headers.set("PAP945_CLASSROOM_READ_ONLY","true");
  assert.equal(await classroomVNextSeam(headers,env,now),null);assert.deepEqual(calls,[]);
 }
});
test("PAP-945 enabled seam rejects non-staging env/hosts before identity or classroom",async()=>{
 for(const APP_ENV of [undefined,"production","development"]){const {env,calls}=fixture();await assert.rejects(classroomVNextSeam(requestHeaders(),{...env,APP_ENV},now),denied(404));assert.deepEqual(calls,[])}
 for(const value of ["tos.pinohouse.art","bo.staging.pinohouse.art","localhost",host+".evil"]){const {env,calls}=fixture();const headers=requestHeaders();headers.set("host",value);headers.set("x-forwarded-host",host);await assert.rejects(classroomVNextSeam(headers,env,now),denied(404));assert.deepEqual(calls,[])}
});
test("PAP-945 Core owns Center and date; only authenticated GET contracts run",async()=>{
 const {env,calls}=fixture();assert.deepEqual(await classroomVNextSeam(requestHeaders(),env,now),{centerId:"core-center",localDate:"2026-11-07"});assert.deepEqual(calls,["context","classroom"]);
});
test("PAP-945 authentication/context denial never reaches classroom",async()=>{
 const {env,calls}=fixture();await assert.rejects(classroomVNextSeam(new Headers({host}),env,now),(e:unknown)=>e instanceof Error&&"status" in e&&e.status===401);assert.deepEqual(calls,[]);
 for(const status of [401,403,503]){
  const f=fixture();f.env.PINO_WORKFORCE_CORE.executeWithStaffPassword=async()=>({status,body:{},requestId:"deny"});
  await assert.rejects(classroomVNextSeam(requestHeaders(),f.env,now),denied(status));assert.deepEqual(f.calls,[]);
 }
 for(const centers of [undefined,null,{},"center",[],[null],[42],["center"],[[]],[{}],
  [{id:42,timeZone:"UTC"}],[{id:"",timeZone:"UTC"}],[{id:"x"}],
  [{id:"x",timeZone:42}],[{id:"x",timeZone:""}],[{id:"x",timeZone:"invalid"}]]){
  const f=fixture();f.context.centers=centers;await assert.rejects(classroomVNextSeam(requestHeaders(),f.env,now),denied(403));assert.deepEqual(f.calls,["context"]);
 }
});
test("PAP-945 classroom role/Center denial, outage and mismatched read fail closed",async()=>{
 for(const status of [401,403,503]){
  const {env}=fixture();env.PINO_TOS_LEARNING_CORE.executeWithStaffPassword=async()=>({status,body:{},requestId:"deny"});
  await assert.rejects(classroomVNextSeam(requestHeaders(),env,now),denied(status));
 }
 for(const data of [null,{}, {centerId:"foreign",localDate:"2026-11-07",occurrences:[]},{centerId:"core-center",localDate:"2026-11-06",occurrences:[]}]){
  const {env}=fixture();env.PINO_TOS_LEARNING_CORE.executeWithStaffPassword=async()=>({status:200,body:{data},requestId:"invalid"});
  await assert.rejects(classroomVNextSeam(requestHeaders(),env,now),denied(403));
 }
 const {env}=fixture();env.PINO_TOS_LEARNING_CORE.executeWithStaffPassword=async()=>{throw Error("offline")};
 await assert.rejects(classroomVNextSeam(requestHeaders(),env,now),denied(503));
});
test("PAP-945 canonical mount has no query opt-in or six-app import; legacy stays disabled fallback",()=>{
 const page=readFileSync("app/classroom/page.tsx","utf8");
 assert.match(page,/if\(scope\)return <ClassroomReadOnlySeam/);assert.match(page,/<ClassroomView initialSessionId=\{params.sessionId \?\? ""\}/);
 assert.ok(page.indexOf("classroomVNextSeam(requestHeaders,env)")<page.indexOf("await searchParams"));
 assert.match(page,/classroomSeamEnv\(async\(\)=>/);
 assert.match(page,/status===401\)redirect\("\/staff-login"\)/);assert.match(page,/forbidden\(\)/);
 const mount=readFileSync("app/classroom/ClassroomReadOnlySeam.tsx","utf8");
 assert.match(mount,/<TosShell/);assert.match(mount,/<TosVNextClassroom[^>]* readOnly\/>/);
 assert.doesNotMatch(mount,/IntegrationClient|workforceApi|DiaryCapturePanel|searchParams/);
});
test("PAP-945 read-only mount excludes the Diary writer even with staging write configuration",async()=>{
 const previous=process.env.NEXT_PUBLIC_PINO_DIARY_STAGING_WRITE;
 process.env.NEXT_PUBLIC_PINO_DIARY_STAGING_WRITE="true";
 try{
  const model=classroomFixture();const initial={classId:model.classes[0].id,tab:"diaries" as const};
  const read=await renderClassroom(model,initial,true);
  assert.match(read,/tos-classroom-panel-diaries/);assert.doesNotMatch(read,/Soạn Nhật ký lớp học từ dữ liệu Core|Gửi Nhật ký/);
  const existing=await renderClassroom(model,initial);assert.match(existing,/Soạn Nhật ký lớp học từ dữ liệu Core/);
 }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_PINO_DIARY_STAGING_WRITE;else process.env.NEXT_PUBLIC_PINO_DIARY_STAGING_WRITE=previous}
});
