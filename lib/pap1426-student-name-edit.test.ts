// PAP-1426 / SCH-STUDENT-MGMT — no implicit Center, status or Global Intake privilege.
import test from "node:test";
import assert from "node:assert/strict";
import { handleBoWriteRequest, type BoWriteEnv } from "./bo-write-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const id="0198d050-56c1-7ac5-b9ab-b0e45d912345";
const center="01912345-6789-7abc-8def-0123456789ab";
const path=`students/${id}`;
const nameOnly={displayName:"Renamed",expectedVersion:1};
const env=(binding:BoAccessCoreBinding):BoWriteEnv=>({PINO_BO_CORE:binding});
const req=(query:string,body:unknown=nameOnly)=>{
  return new Request(`https://bo.staging.pinohouse.art/api/bo/${path}${query}`,{
    method:"PATCH",headers:{"content-type":"application/json",cookie:"pino_staff_password_session=local-synthetic-test"},
    body:JSON.stringify(body)
  });
};
test("explicit selected Center is forwarded only as a Core resource, never a grant",async()=>{
  const calls:BoAccessRequest[]=[];
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){calls.push(request);return{status:200,body:{data:{id,displayName:"Renamed",status:"ACTIVE",version:2}},requestId:"pap1426-test"};}};
  const result=await handleBoWriteRequest(req(`?centerId=${center}`),env(binding),path);
  assert.equal(result.status,200);
  assert.equal(result.headers.get("x-request-id"),"pap1426-test");
  assert.deepEqual(calls,[{method:"PATCH",path,body:nameOnly,resource:{centerId:center}}]);
});
test("missing, duplicate, unexpected and malformed Center fail before Core access",async()=>{
  let count=0;
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(){count++;throw Error("Core should not be called")}};
  for(const q of ["", "?centerId=", "?centerId=bad", `?centerId=${center}&centerId=${center}`, `?centerId=${center}&permission=student.profile.edit`]){
    const response=await handleBoWriteRequest(req(q),env(binding),path);
    assert.equal(response.status,400,q);
  }
  assert.equal(count,0);
});
test("legacy status, archived or extraneous fields never reach Core",async()=>{
  let count=0;
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(){count++;throw Error("Core should not be called")}};
  for(const body of [{...nameOnly,status:"ARCHIVED"},{...nameOnly,status:"ACTIVE"},{...nameOnly,centerId:center},{displayName:"Only name"}]){
    assert.equal((await handleBoWriteRequest(req(`?centerId=${center}`,body),env(binding),path)).status,400);
  }
  assert.equal(count,0);
});
test("Core 403/409 denial is preserved with request ID",async()=>{
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(){return{status:403,body:{error:{code:"ACCESS_PERMISSION_DENIED"}},requestId:"pap1426-denied"}}};
  const response=await handleBoWriteRequest(req(`?centerId=${center}`),env(binding),path);
  assert.equal(response.status,403);
  assert.equal(response.headers.get("x-request-id"),"pap1426-denied");
});
