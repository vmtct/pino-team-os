import test from "node:test";
import assert from "node:assert/strict";
import {decideHostBoundary,BO_STAGING_HOSTNAME,BO_HOSTNAME,TOS_STAGING_HOSTNAME} from "./host-boundary";
import {isBoPayrollPeriodPath,handleBoPayrollPeriodRequest,type BoPayrollPeriodEnv} from "./bo-payroll-period-handler";
import type {BoAccessRequest} from "./bo-core";

const center="0199f001-0000-7000-8000-000000000001";
const period="01a171ed-eb78-7941-b1de-dd4c020457b7";
const staff="01a18a28-6d8e-7db7-acbb-a18a942a5e72";
const founder="01a18a28-6d8e-7db7-acbb-a18a942a5e74";
const manager="01a18a28-6d8e-7db7-acbb-a18a942a5e75";
const path=`workforce/payroll/periods/${period}/staff/${staff}/adjustments`;
const target=`/api/bo/${path}`;
const url=`https://${BO_STAGING_HOSTNAME}${target}?centerId=${center}`;
const cookie="pino_staff_password_session=synthetic-only";
const reason="PAP-1211 Staging-only adjustment E2E";
const key="pap1211-adjust-01";
const post=(body:unknown,overrides:Record<string,string>={})=>new Request(url,{
 method:"POST",headers:{cookie,origin:`https://${BO_STAGING_HOSTNAME}`,
  "content-type":"application/json","idempotency-key":key,...overrides},
 body:JSON.stringify(body),
});
function fixture(actor=founder, envOverrides:Partial<BoPayrollPeriodEnv>={}){
 const calls:BoAccessRequest[]=[];
 const env={
  APP_ENV:"staging",
  HO_PILOT_FOUNDER_USER_IDS:founder,
  PINO_BO_CORE:{
   async executeWithStaffPassword(request:BoAccessRequest,token:string){
    assert.equal(token,"synthetic-only");
    calls.push(request);
    if(request.path==="context")return {status:200,requestId:"ctx",body:{
     data:{userId:actor,email:"synthetic@example.invalid",staffMemberId:null,
      displayName:"Synthetic",surface:"BO",entitled:true,permissionKeys:[]}}};
    if(request.path.endsWith("/adjustments?centerId="+center)){
     return {status:request.method==="POST"?201:200,requestId:"adj",body:{data:request.method==="POST"?
       {id:"01a18a28-6d8e-7db7-acbb-a18a942a5e99",amountMinor:1200}:
       {adjustments:[],totalMinor:0}}};
    }
    throw Error("Unexpected Core request");
   },
  },
  ...envOverrides,
 } as BoPayrollPeriodEnv;
 return {env,calls};
}
test("PAP-1211 exact Staging host/verb admission; Production and arbitrary routes fail closed",()=>{
 assert.equal(isBoPayrollPeriodPath(path),true);
 for(const method of ["GET","POST"]){
  assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME,target,method),{action:"next"});
  assert.deepEqual(decideHostBoundary(BO_HOSTNAME,target,method),{action:"not_found"});
  assert.deepEqual(decideHostBoundary(TOS_STAGING_HOSTNAME,target,method),{action:"not_found"});
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",target,method),{action:"not_found"});
 }
 for(const method of ["PATCH","PUT","DELETE","HEAD"]){
  assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME,target,method),{action:"not_found"});
 }
 assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME,target+"/delete","POST"),{action:"not_found"});
 assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME,target.replace(staff,manager),"POST"),{action:"not_found"});
});
test("PAP-1211 BFF deny outside Staging and deny unauthenticated before Core business read",async()=>{
 const f=fixture();
 const prod={...f.env,APP_ENV:"production"};
 assert.equal((await handleBoPayrollPeriodRequest(
  new Request(url,{headers:{cookie}}),prod,path)).status,404);
 assert.equal(f.calls.length,0);
 const res=await handleBoPayrollPeriodRequest(new Request(url),f.env,path);
 assert.equal(res.status,401);
 assert.equal(f.calls.length,0);
});
test("PAP-1211 Manager 403 even with valid BO context; no adjustment forwarded",async()=>{
 const f=fixture(manager);
 const res=await handleBoPayrollPeriodRequest(new Request(url,{headers:{cookie}}),f.env,path);
 assert.equal(res.status,403);
 assert.deepEqual(f.calls.map(x=>x.path),["context"]);
});
test("PAP-1211 Founder cannot mutate other Center, period or Staff",async()=>{
 const f=fixture();
 const otherCenter=url.replace(center,manager);
 assert.equal((await handleBoPayrollPeriodRequest(new Request(otherCenter,{headers:{cookie}}),f.env,path)).status,403);
 const altered=path.replace(staff,manager);
 assert.equal((await handleBoPayrollPeriodRequest(new Request(url.replace(target,"/api/bo/"+altered),{headers:{cookie}}),f.env,altered)).status,404);
 assert.deepEqual(f.calls.map(x=>x.path),["context","context"]);
});
test("PAP-1211 Founder GET uses authorized Core read and fixed Center only",async()=>{
 const f=fixture();
 const res=await handleBoPayrollPeriodRequest(new Request(url,{headers:{cookie}}),f.env,path);
 assert.equal(res.status,200);
 assert.deepEqual((await res.json()).data,{adjustments:[],totalMinor:0});
 assert.equal(f.calls.length,2);
 assert.deepEqual(f.calls[1],{method:"GET",path:path+"?centerId="+center,resource:{centerId:center}});
});
test("PAP-1211 Origin, idempotency, amount and reason are fixed",async()=>{
 const f=fixture();
 const correct={centerId:center,amountMinor:1200,reason};
 assert.equal((await handleBoPayrollPeriodRequest(post(correct,{origin:"https://other.invalid"}),f.env,path)).status,403);
 assert.equal((await handleBoPayrollPeriodRequest(post(correct,{"idempotency-key":"short"}),f.env,path)).status,400);
 assert.equal((await handleBoPayrollPeriodRequest(post({...correct,amountMinor:1201}),f.env,path)).status,400);
 assert.equal((await handleBoPayrollPeriodRequest(post({...correct,reason:"other"}),f.env,path)).status,400);
 assert.equal((await handleBoPayrollPeriodRequest(post({...correct,category:"override"}),f.env,path)).status,400);
 assert.equal(f.calls.some(x=>x.path.includes("/adjustments")),false);
});
test("PAP-1211 Founder POST forwards only +1200 authorized Core atomic command with idempotency",async()=>{
 const f=fixture();
 const res=await handleBoPayrollPeriodRequest(post({centerId:center,amountMinor:1200,reason}),f.env,path);
 assert.equal(res.status,201);
 assert.equal(res.headers.get("x-request-id"),"adj");
 assert.deepEqual(f.calls.at(-1),{
  method:"POST",path:path+"?centerId="+center,resource:{centerId:center},
  body:{centerId:center,amountMinor:1200,reason},idempotencyKey:key,
 });
 // Real replay/idempotency and immutable Draft/Finalized require live Staging Core E2E.
});
