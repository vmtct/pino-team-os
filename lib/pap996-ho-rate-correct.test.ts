import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {decideHostBoundary} from "./host-boundary";
import {handleHoStaffRateRequest,normalizeHoRateCorrectionPayload,type HoStaffRateEnv} from "./ho-staff-rate-facade";
const ho="ho.staging.pinohouse.art";
const staff="01a171ee-1738-7151-9ac8-2866bdc83ff4";
const rate="01a185d5-03c9-7277-91c2-5393e14be2ff";
const endpoint="/api/ho/staff/"+staff+"/compensation/"+rate;
const env={APP_ENV:"staging"} as HoStaffRateEnv;
const patch=(host=ho,origin="https://"+ho,body:unknown={amountMinor:50000,expectedVersion:1,note:"PAP996 synthetic correction"})=>
 new Request("https://"+host+endpoint,{method:"PATCH",headers:{"host":host,"origin":origin,"content-type":"application/json"},body:JSON.stringify(body)});

test("PAP-996 exact HO Staging-only PATCH admission, never BO/TOS/Prod",()=>{
 assert.deepEqual(decideHostBoundary(ho,endpoint,"PATCH"),{action:"next"});
 for(const method of ["GET","POST","PUT","DELETE"]){
  assert.deepEqual(decideHostBoundary(ho,endpoint,method),{action:"not_found"},method);
 }
 for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art","bo.pinohouse.art","localhost"]){
  assert.deepEqual(decideHostBoundary(host,endpoint,"PATCH"),{action:"not_found"},host);
 }
 assert.deepEqual(decideHostBoundary(ho,endpoint+"/extra","PATCH"),{action:"not_found"});
 assert.deepEqual(decideHostBoundary(ho,"/api/ho/staff/"+staff+"/compensation","PATCH"),{action:"not_found"});
 const route=readFileSync("app/api/ho/staff/[staffId]/compensation/[entryId]/route.ts","utf8");
 assert.match(route,/export async function PATCH/);
 assert.doesNotMatch(route,/export (?:const|async function) (?:GET|POST|PUT|DELETE)/);
});

test("PAP-996 BFF checks HO-only host, Origin, protected auth, and staging fence",async()=>{
 assert.equal((await handleHoStaffRateRequest(patch("bo.staging.pinohouse.art"),env,staff,rate)).status,404);
 assert.equal((await handleHoStaffRateRequest(patch(ho,"https://forged.example"),env,staff,rate)).status,403);
 assert.equal((await handleHoStaffRateRequest(patch(),{...env,APP_ENV:"production"},staff,rate)).status,404);
 assert.equal((await handleHoStaffRateRequest(patch(),env,staff,"wrong-entry-id")).status,404);
 const noAuth=await handleHoStaffRateRequest(patch(),env,staff,rate);
 assert.equal(noAuth.status,401);
 assert.equal(noAuth.headers.get("cache-control"),"no-store");
});

test("PAP-996 correction payload requires CAS version and reason; does not admit effective-date mutation",async()=>{
 for(const body of [{amountMinor:50000,note:"reason"}, {amountMinor:50000,expectedVersion:0,note:"reason"},
   {amountMinor:50000,expectedVersion:1}, {amountMinor:50000,expectedVersion:1,note:""},
   {amountMinor:50000,expectedVersion:1,note:"reason",effectiveFrom:"2026-10-24"},
   {amountMinor:1.5,expectedVersion:1,note:"reason"}]){
  assert.equal(normalizeHoRateCorrectionPayload(body),null,JSON.stringify(body));
 }
 assert.deepEqual(normalizeHoRateCorrectionPayload({amountMinor:50000,expectedVersion:1,note:"  Valid reason "}),{amountMinor:50000,expectedVersion:1,note:"Valid reason"});
 // Authentication is intentionally checked before parsing the protected financial payload.
 assert.equal((await handleHoStaffRateRequest(patch(ho,"https://"+ho,{amountMinor:50000,note:"missing version"}),env,staff,rate)).status,401);
 assert.equal((await handleHoStaffRateRequest(new Request("https://"+ho+endpoint,{method:"GET",headers:{host:ho}}),env,staff,rate)).status,405);
});
