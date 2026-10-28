import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {decideHostBoundary} from "./host-boundary";
import {handleHoStaffRateRequest,type HoStaffRateEnv} from "./ho-staff-rate-facade";
const staff="00000000-0000-4000-8000-000000000099";
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
test("HO Staff details use common TDD shell and BO remains read-only",()=>{
 const detail=readFileSync("app/bo/components/registration/BoFullDetail.tsx","utf8");
 const component=readFileSync("app/ho/staff/HoStaffRateTab.tsx","utf8");
 assert.match(detail,/surface==="ho" && moduleKey==="staffs"/);
 assert.match(detail,/activeTab==="Rate lương"/);
 assert.match(component,/showToolbar=\{false\}/);
 assert.doesNotMatch(component,/localStorage|sessionStorage/);
 assert.match(component,/Ngày hiệu lực/);assert.match(component,/Ngày kết thúc/);assert.match(component,/Mức lương/);assert.match(component,/Lý do/);
});
