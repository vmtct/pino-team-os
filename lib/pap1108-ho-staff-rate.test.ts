import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {decideHostBoundary} from "./host-boundary";
import {handleHoStaffRateRequest,type HoStaffRateEnv} from "./ho-staff-rate-facade";
const staff="01a18a28-6d8e-7db7-acbb-a18a942a5e72";
const ho="ho.staging.pinohouse.art";
const rate="/api/ho/staff/"+staff+"/compensation";
const fake={APP_ENV:"staging"} as HoStaffRateEnv;
function req(host:string,method:"GET"|"POST",origin?:string):Request{
 return new Request("https://"+host+rate,{method,headers:{"host":host,...(origin?{"origin":origin}:{}),...(method==="POST"?{"content-type":"application/json"}:{})},...(method==="POST"?{body:JSON.stringify({amountMinor:32000,effectiveFrom:"2026-11-01",note:"Fixture"})}:{})});
}
test("PAP-1108 HO host admits only exact authorized rate GET/POST; rejects BO, TOS, production",()=>{
 assert.deepEqual(decideHostBoundary(ho,rate,"GET"),{action:"next"});
 assert.deepEqual(decideHostBoundary(ho,rate,"POST"),{action:"next"});
 for(const method of ["PUT","DELETE","PATCH"] as const)assert.deepEqual(decideHostBoundary(ho,rate,method),{action:"not_found"});
 for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","bo.pinohouse.art","localhost"])
  for(const method of ["GET","POST"] as const)assert.deepEqual(decideHostBoundary(host,rate,method),{action:"not_found"},host+method);
 assert.deepEqual(decideHostBoundary(ho,"/api/ho/staff/not-uuid/compensation","POST"),{action:"not_found"});
});
test("Rate BFF denies invalid host before auth/API and cross-origin POST",async()=>{
 assert.equal((await handleHoStaffRateRequest(req("bo.staging.pinohouse.art","GET"),fake,staff)).status,404);
 assert.equal((await handleHoStaffRateRequest(req(ho,"POST","https://evil.example"),fake,staff)).status,403);
 assert.equal((await handleHoStaffRateRequest(req(ho,"GET"),{...fake,APP_ENV:"production"},staff)).status,404);
 assert.equal((await handleHoStaffRateRequest(req(ho,"POST","https://"+ho),fake,"not-uuid")).status,404);
});
test("Rate BFF never issues a salary write before real HO staff-password authentication",async()=>{
 const denied=await handleHoStaffRateRequest(req(ho,"POST","https://"+ho),fake,staff);
 assert.equal(denied.status,401);
 assert.equal(denied.headers.get("cache-control"),"no-store");
});
test("HO Staff Rate only consumes typed TDD provider; legacy salary shell is retired",()=>{
 const schema=readFileSync("app/ho/staff/schema.ts","utf8");
 const workspace=readFileSync("app/ho/staff/StaffTdd.tsx","utf8");
 const provider=readFileSync("app/ho/staff/staff-rate-provider.ts","utf8");
 assert.match(schema,/TddRegistry/);
 assert.match(schema,/kind: "form"/);
 assert.match(schema,/submitPermission: "staff.compensation.manage"/);
 assert.match(workspace,/SurfaceWorkspace/);
 assert.match(workspace,/businessForms=\{\[staffRateProvider\]\}/);
 assert.match(provider,/\/api\/ho\/staff\//);
 assert.doesNotMatch(provider,/localStorage|sessionStorage/);
});

test("PAP-1142 noncanonical UUIDv4, malformed and uppercase Staff IDs fail safely before auth/Core",async()=>{
 for(const id of ["00000000-0000-4000-8000-000000000099",
  "01A18A28-6D8E-7DB7-ACBB-A18A942A5E72","not-uuid"]){
  for(const method of ["GET","POST"] as const){
   const response=await handleHoStaffRateRequest(req(ho,method,"https://"+ho),fake,id);
   assert.equal(response.status,404,id+" "+method);
   assert.equal((await response.json()).error.code,"PLATFORM_NOT_FOUND");
  }
 }
});
test("PAP-1142 compensation PATCH rejects invalid UUIDv4 rate before Core",async()=>{
 const request=new Request("https://"+ho+rate+"/00000000-0000-4000-8000-000000000010",{
  method:"PATCH",headers:{host:ho,origin:"https://"+ho,"content-type":"application/json"},
  body:JSON.stringify({amountMinor:50000,note:"Correction",expectedVersion:1})});
 const denied=await handleHoStaffRateRequest(request,fake,staff,"00000000-0000-4000-8000-000000000010");
 assert.equal(denied.status,404);
 assert.equal((await denied.json()).error.code,"PLATFORM_NOT_FOUND");
});
