import test from "node:test";
import assert from "node:assert/strict";
import {handleBoOperationalReadRequest,isOperationalReadPath,readQueryBody,type BoReadEnv} from "./bo-read-handler";
import type {BoAccessCoreBinding,BoAccessRequest} from "./bo-core";
const subscription="019d9881-1025-7000-8000-000000001244";
const cls="019d9881-1025-7000-8000-000000001243";
const enrollment="019d9881-1025-7000-8000-000000001245";
const endpoint=(path:string,qs="")=>new Request("https://bo.staging.pinohouse.art/api/bo/"+path+qs,{headers:{cookie:"pino_staff_password_session=test-only"}});
test("PAP-1035 all explicit S3 GET facade routes forward to Core, never delegate mutation",async()=>{
 const calls:BoAccessRequest[]=[];
 const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){calls.push(request);return {status:200,body:{data:[]},requestId:"s3"}}};
 const env={PINO_BO_CORE:binding} as BoReadEnv;
 const paths=[
  ["subscriptions/"+subscription,"",undefined],
  ["subscriptions/"+subscription+"/enrollments","",undefined],
  ["subscriptions/"+subscription+"/placement","?targetLocalDate=2026-10-27",{targetLocalDate:"2026-10-27"}],
  ["enrollments/"+enrollment,"",undefined],
  ["enrollments/capacity","?runningClassId="+cls+"&targetLocalDate=2026-10-27&subscriptionId="+subscription+"&plannedEntryLocalTime=18%3A00&plannedDurationMinutes=90",
   {runningClassId:cls,targetLocalDate:"2026-10-27",subscriptionId:subscription,plannedEntryLocalTime:"18:00",plannedDurationMinutes:90}]
 ] as const;
 for(const [path,qs,body] of paths){
  assert.equal(isOperationalReadPath(path),true,path);
  const r=await handleBoOperationalReadRequest(endpoint(path,qs),env,path);
  assert.equal(r.status,200,path);
  assert.equal(r.headers.get("x-request-id"),"s3");
  assert.deepEqual(calls.at(-1),{method:"GET",path,...(body?{body}:{})});
 }
});
test("S3 facade strictly refuses unknown and malformed dynamic paths",async()=>{
 const denied=["subscriptions/bad-id","subscriptions/"+subscription+"/notes",
   "subscriptions/"+subscription+"/enrollments/extra","enrollments/"+enrollment+"/transfer",
   "enrollments/none","enrollments/capacity/other"];
 for(const path of denied)assert.equal(isOperationalReadPath(path),false,path);
});
test("S3 query validators fail closed; no caller identity or ACL spoof",()=>{
 const placement="subscriptions/"+subscription+"/placement";
 for(const qs of ["","?targetLocalDate=bad","?targetLocalDate=2026-02-30",
  "?targetLocalDate=2026-10-27&targetLocalDate=2026-10-28","?targetLocalDate=2026-10-27&userId=forged"]){
  assert.throws(()=>readQueryBody(placement,new URL("https://bo.staging.pinohouse.art/api/bo/"+placement+qs)),RangeError,qs);
 }
 for(const qs of ["","?targetLocalDate=2026-10-27",
  "?runningClassId="+cls+"&targetLocalDate=bad",
  "?runningClassId="+cls+"&targetLocalDate=2026-10-27&plannedDurationMinutes=-10",
  "?runningClassId="+cls+"&targetLocalDate=2026-10-27&plannedEntryLocalTime=33:12",
  "?runningClassId="+cls+"&targetLocalDate=2026-10-27&centerId=forged",
  "?runningClassId="+cls+"&targetLocalDate=2026-10-27&runningClassId="+cls]){
  assert.throws(()=>readQueryBody("enrollments/capacity",new URL("https://bo.staging.pinohouse.art/api/bo/enrollments/capacity"+qs)),RangeError,qs);
 }
});
test("S3 detail read preserves real Core permission failure and denies unauthenticated access",async()=>{
 let calls=0;
 const binding:BoAccessCoreBinding={async executeWithStaffPassword(){calls++;return{status:403,body:{error:{code:"ACCESS_PERMISSION_DENIED"}},requestId:"core-denied"}}};
 const env={PINO_BO_CORE:binding} as BoReadEnv,route="subscriptions/"+subscription;
 const denied=await handleBoOperationalReadRequest(endpoint(route),env,route);
 assert.equal(denied.status,403);assert.equal(denied.headers.get("x-request-id"),"core-denied");
 const anon=await handleBoOperationalReadRequest(new Request("https://bo.staging.pinohouse.art/api/bo/"+route),env,route);
 assert.equal(anon.status,401);assert.equal(calls,1);
});
