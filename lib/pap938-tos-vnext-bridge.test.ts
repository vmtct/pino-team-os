import test from "node:test";
import assert from "node:assert/strict";
import {SIX_TOS_APPS} from "../app/components/tos-vnext/identity";
import {
 TOS_BACKEND_MATRIX,assertOwnCenter,TosVNextScopeError,
 shiftReadModel,receptionVisitReadModel,classroomLegacyReadModel,ownLegacyTrainingReadModel,dutyContextReadModel
} from "../app/components/tos-vnext/core-adapters";

const ctx={userId:"auth-u",staffMemberId:"self-staff",email:"user@example.com",centers:[{id:"center-1",key:"NK",displayName:"Ninh Kiều",timeZone:"Asia/Ho_Chi_Minh"}],termWeeks:[]};
const session={id:"t1",centerId:"center-1",assignmentId:"a1",workDate:"2026-10-23",status:"OPEN",checkInAt:"2026-10-23T10:00:00Z",checkOutAt:null};
type MockResult={data?:unknown;status?:number;error?:unknown};
function mockFetch(handlers:(url:string,init:RequestInit)=>MockResult|Promise<MockResult>){
 const original=globalThis.fetch;const calls:Array<{url:string,method:string}>=[];
 globalThis.fetch=(async(input:RequestInfo|URL,init:RequestInit={})=>{
  const url=String(input),method=init.method??"GET";calls.push({url,method});
  const result=await handlers(url,init);
  return new Response(JSON.stringify(result.error?{error:result.error}:{data:result.data}),
    {status:result.status??200,headers:{"content-type":"application/json"}});
 }) as typeof fetch;
 return {calls,restore:()=>{globalThis.fetch=original}};
}
const dailyRow={workDate:"2026-10-23",status:"DRAFT",calculationStatus:"READY",paidMinutes:180,standardMinor:75000,extraTimeMinor:0,extraTimePending:false,amountMinor:75000};
function backend(url:string){
 if(url.startsWith("/api/tos-learning/workforce/payroll/income/daily?"))return {data:{data:[dailyRow]}};
 if(url==="/api/workforce/context")return {data:ctx};
 if(url.startsWith("/api/workforce/schedule?"))return {data:[{id:"a1",centerId:"center-1",workDate:"2026-10-23",status:"ACTIVE",roleAssignments:[]}]};
 if(url.startsWith("/api/workforce/timekeeping/current"))return {data:session};
 if(url.startsWith("/api/workforce/timekeeping/history?"))return {data:[session]};
 if(url.startsWith("/api/tos-learning/workforce/payroll/income?"))return {data:{data:[{periodId:"sep",name:"09/2026",status:"FINALIZED",amountMinor:1300000}],total:1,nextOffset:null}};
 if(url==="/api/tos-learning/students/st-1/visits/open?centerId=center-1")return {data:{id:"visit-1",studentProfileId:"st-1",centerId:"center-1",checkedInAt:"2026-10-23T10:00:00Z",checkedOutAt:null,version:1}};
 if(url.startsWith("/api/tos-learning/sessions/day?"))return {data:{centerId:"center-1",localDate:"2026-10-23",sessions:[{id:"legacy-s1",operationalName:"ART"}]}};
 if(url==="/api/workforce/training/self")return {data:{assignments:[{id:"legacy-training"}],qualifications:[]}};
 if(url.startsWith("/api/workforce/duty/board?"))return {data:{staffMemberId:"self-staff",centerId:"center-1",workDate:"2026-10-23",duties:[],briefing:null,acknowledgement:null,gate:{mode:"ADVISORY",allowed:true,obligations:[],blockers:[],unavailableSources:[]},checkoutException:null}};
 return {status:404,error:{code:"UNKNOWN",message:"Unmocked endpoint "+url}};
}
test("PAP-938 exactly six approved TOS app identities, no standalone Duty",()=>{
 assert.deepEqual(SIX_TOS_APPS.map(x=>x.id),["shift","reception","station","shift-lead","classroom","training"]);
 assert.equal(SIX_TOS_APPS.find(x=>x.id==="station")?.mode,"desktop");
 assert.equal(TOS_BACKEND_MATRIX.some(x=>x.app==="classroom"&&x.status==="CORE_PR_PENDING"),true);
 assert.equal(TOS_BACKEND_MATRIX.some(x=>x.app==="training"&&x.status==="LEGACY_ONLY"),true);
});
test("PAP-938 center must match authenticated Core Workforce context",()=>{
 assert.equal(assertOwnCenter(ctx,"center-1").displayName,"Ninh Kiều");
 assert.throws(()=>assertOwnCenter(ctx,"center-external"),TosVNextScopeError);
});
test("PAP-938 real Shift read wiring preserves Core session and salary self scope",async()=>{
 const mock=mockFetch((url)=>backend(url));
 try{
  const model=await shiftReadModel("center-1","2026-10-22","2026-10-30");
  assert.equal(model.current?.id,"t1");
  assert.ok(model.history,"history must be loaded in healthy Core case");
  assert.ok(model.income,"payroll must be loaded in healthy Core case");
  assert.equal(model.history[0]?.id,"t1");
  assert.equal(model.assignments.length,1);
  assert.ok(mock.calls.some(x=>x.url.includes("/api/workforce/timekeeping/history?")));
  assert.equal(model.income.data[0].status,"FINALIZED");
  assert.equal(model.income.data[0].amountMinor,1300000);
  assert.ok(mock.calls.some(x=>x.url.includes("/api/workforce/schedule?")));
  assert.ok(mock.calls.some(x=>x.url.includes("/api/tos-learning/workforce/payroll/income?")));
  assert.equal(mock.calls.some(x=>x.url.includes("staffId=")),false);
  assert.ok(mock.calls.every(x=>x.method==="GET"));
 }finally{mock.restore()}
});
test("PAP-938 Reception StudentVisit read delegates to existing authorized Core",async()=>{
 const mock=mockFetch((url)=>backend(url));
 try{
  const visit=await receptionVisitReadModel("center-1","st-1");
  assert.equal(visit?.id,"visit-1");
  assert.ok(mock.calls.some(x=>x.url==="/api/tos-learning/students/st-1/visits/open?centerId=center-1"));
  assert.ok(mock.calls.every(x=>x.method==="GET"));
 }finally{mock.restore()}
});
test("PAP-942 expired Core session must reject Student Visit rather than show empty visit",async()=>{
 const mock=mockFetch(url=>url==="/api/workforce/context"?{data:ctx}:
  url.includes("/visits/open?")?{status:401,error:{code:"UNAUTHORIZED",message:"Session expired"}}:backend(url));
 try{
  await assert.rejects(receptionVisitReadModel("center-1","st-1"),error=>error instanceof Error);
  assert.equal(mock.calls.filter(x=>x.url.includes("/visits/open?")).length,1);
  assert.ok(mock.calls.every(x=>x.method==="GET"));
 }finally{mock.restore()}
});
test("PAP-938 legacy Classroom projection never falsely marked V18b",async()=>{
 const mock=mockFetch((url)=>backend(url));
 try{
  const rows=await classroomLegacyReadModel("center-1","2026-10-23");
  assert.equal(rows[0].id,"legacy-s1");
  assert.ok(mock.calls.some(x=>x.url.includes("/api/tos-learning/sessions/day?")));
  assert.ok(TOS_BACKEND_MATRIX.some(x=>x.capability==="Path Diary REGISTERED/CLOSED"&&x.status==="CORE_PR_PENDING"));
 assert.ok(TOS_BACKEND_MATRIX.some(x=>x.app==="training"&&x.capability.includes("V5")&&x.status==="CORE_PR_PENDING"));
 }finally{mock.restore()}
});
test("PAP-938 Training F0 read and contextual Duty do not synthesize V5/standalone-app truth",async()=>{
 const mock=mockFetch((url)=>backend(url));
 try{
  const training=await ownLegacyTrainingReadModel();
  assert.equal(training.assignments.length,1);
  const duty=await dutyContextReadModel("center-1","2026-10-23");
  assert.equal(duty.staffMemberId,"self-staff");
  assert.ok(mock.calls.some(x=>x.url==="/api/workforce/training/self"));
  assert.ok(mock.calls.some(x=>x.url.includes("/api/workforce/duty/board?")));
  assert.ok(mock.calls.every(x=>x.method==="GET"));
 }finally{mock.restore()}
});
test("PAP-938 wrong-center request fails closed before visiting sensitive backend",async()=>{
 const mock=mockFetch((url)=>backend(url));
 try{
  await assert.rejects(receptionVisitReadModel("center-other","st-1"),TosVNextScopeError);
  assert.equal(mock.calls.some(x=>x.url.includes("/visits/")),false);
 }finally{mock.restore()}
});

test("PAP-941 optional income outage preserves Core-backed schedule and exposes unavailable marker",async()=>{
 const mock=mockFetch(url=>{
  if(url.startsWith("/api/tos-learning/workforce/payroll/income?"))
   return {status:503,error:{code:"SERVICE_UNAVAILABLE",message:"Payroll temporarily unavailable"}};
  return backend(url);
 });
 try{
  const model=await shiftReadModel("center-1","2026-10-23","2026-10-30");
  assert.equal(model.assignments.length,1,"authorization schedule must still load");
  assert.equal(model.current?.id,"t1");
  assert.equal(model.income,null,"outage is UNKNOWN, not zero VND");
  assert.equal(model.warnings.income,"Payroll temporarily unavailable");
  assert.equal(model.warnings.history,undefined);
  assert.ok(mock.calls.some(c=>c.url.includes("/api/workforce/schedule?")));
 }finally{mock.restore()}
});
test("PAP-941 optional history outage is not presented as empty history",async()=>{
 const mock=mockFetch(url=>url.startsWith("/api/workforce/timekeeping/history?")
  ?{status:503,error:{code:"SERVICE_UNAVAILABLE",message:"History offline"}}:backend(url));
 try{
  const model=await shiftReadModel("center-1","2026-10-23","2026-10-30");
  assert.equal(model.assignments.length,1);
  assert.equal(model.history,null,"outage must differ from successful empty array");
  assert.equal(model.warnings.history,"History offline");
 }finally{mock.restore()}
});
test("PAP-941 session 401 invalidates all optional reads and prevents stale access",async()=>{
 for(const target of ["timekeeping/current","timekeeping/history","workforce/payroll/income"]){
  const mock=mockFetch(url=>url.includes(target)
   ?{status:401,error:{code:"UNAUTHORIZED",message:"Session expired"}}:backend(url));
  try{
   await assert.rejects(shiftReadModel("center-1","2026-10-23","2026-10-30"),
    (e:unknown)=>e instanceof Error&&"status" in e&&e.status===401);
  }finally{mock.restore()}
 }
});
test("PAP-941 optional 403 masks only denied feature, preserves schedule permission truth",async()=>{
 for(const [target,key] of [
  ["timekeeping/current","timekeeping"],["timekeeping/history","history"],["workforce/payroll/income","income"]
 ] as const){
  const mock=mockFetch(url=>url.includes(target)
   ?{status:403,error:{code:"FORBIDDEN",message:"No permission"}}:backend(url));
  try{
   const model=await shiftReadModel("center-1","2026-10-23","2026-10-30");
   assert.equal(model.assignments.length,1);
   assert.ok(model.warnings[key],"Must explain restricted feature");
   if(key==="income")assert.equal(model.income,null);
   if(key==="history")assert.equal(model.history,null);
   if(key==="timekeeping")assert.equal(model.current,null);
  }finally{mock.restore()}
 }
});
test("PAP-941 schedule access failure stops before auxiliary private reads",async()=>{
 const mock=mockFetch(url=>url.startsWith("/api/workforce/schedule?")
  ?{status:403,error:{code:"FORBIDDEN",message:"Schedule denied"}}:backend(url));
 try{
  await assert.rejects(shiftReadModel("center-1","2026-10-23","2026-10-30"));
  assert.equal(mock.calls.some(c=>c.url.includes("/timekeeping/")||c.url.includes("/payroll/")),false);
 }finally{mock.restore()}
});

test("PAP-2429 daily income requests only current center month-to-date independently of period outage",async()=>{
 const mock=mockFetch(url=>url.includes("/income?")?{status:503,error:{message:"Period unavailable"}}:backend(url));
 try{
  const model=await shiftReadModel("center-1","2026-10-01","2026-11-06","2026-10-23");
  assert.equal(model.income,null);
  assert.deepEqual(model.dailyIncome?.data,[dailyRow]);
  assert.ok(mock.calls.some(c=>c.url==="/api/tos-learning/workforce/payroll/income/daily?centerId=center-1&startDate=2026-10-01&endDate=2026-10-23"));
 }finally{mock.restore()}
});
test("PAP-2429 daily income 403 masks daily only, 401 invalidates all shift data",async()=>{
 for(const status of [403,401]){
  const mock=mockFetch(url=>url.includes("/income/daily?")?{status,error:{message:"Denied"}}:backend(url));
  try{
   if(status===401){await assert.rejects(shiftReadModel("center-1","2026-10-01","2026-11-06","2026-10-23"));continue}
   const model=await shiftReadModel("center-1","2026-10-01","2026-11-06","2026-10-23");
   assert.equal(model.dailyIncome,null);assert.ok(model.warnings.dailyIncome);assert.ok(model.income);
  }finally{mock.restore()}
 }
});
test("PAP-938 the Staging home schedule is ready before optional payroll",{timeout:3000},async()=>{
 let release!:()=>void;
 const optional=new Promise<void>(resolve=>{release=resolve;});
 let publish!:(ids:string[])=>void;
 const ready=new Promise<string[]>(resolve=>{publish=resolve;});
 const mock=mockFetch(async url=>{
  if(url.includes("/payroll/income?"))await optional;
  return backend(url);
 });
 try{
  let complete=false;
  const model=shiftReadModel("center-1","2026-10-22","2026-10-30",undefined,{
   expectedStaff:ctx,onSchedule:rows=>publish(rows.map(r=>r.id)),
  }).then(value=>{complete=true;return value;});
  assert.deepEqual(await ready,["a1"]);
  assert.equal(complete,false);
  release();
  assert.equal((await model).current?.id,"t1");
 }finally{release();mock.restore()}
});
test("PAP-938 an observed optional 401 invalidates early schedule without waiting for slow payroll",{timeout:3000},async()=>{
 let release!:()=>void;
 const optional=new Promise<void>(resolve=>{release=resolve;});
 const mock=mockFetch(async url=>{
  if(url.includes("/payroll/income?"))await optional;
  if(url.includes("/timekeeping/history?"))return {status:401,error:{code:"UNAUTHORIZED",message:"Expired"}};
  return backend(url);
 });
 try{
  const seen:string[]=[];
  await assert.rejects(shiftReadModel("center-1","2026-10-22","2026-10-30",undefined,{
   expectedStaff:ctx,onSchedule:rows=>seen.push(...rows.map(r=>r.id)),
  }),{status:401});
  assert.deepEqual(seen,["a1"]);
 }finally{release();mock.restore()}
});
test("PAP-938 the Staging home never publishes a different actor or denied Center schedule",async()=>{
 const mock=mockFetch(url=>backend(url));
 try{
  const never=()=>assert.fail("must not publish a denied schedule");
  await assert.rejects(shiftReadModel("center-1","2026-10-22","2026-10-30",undefined,{
   expectedStaff:{...ctx,userId:"different-actor"},onSchedule:never,
  }),TosVNextScopeError);
  await assert.rejects(shiftReadModel("different-center","2026-10-22","2026-10-30",undefined,{
   expectedStaff:ctx,onSchedule:never,
  }),TosVNextScopeError);
  assert.equal(mock.calls.some(c=>c.url.includes("/schedule?")),false);
 }finally{mock.restore()}
});
