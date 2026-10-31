import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { handleBoOperationalReadRequest, isOperationalReadPath } from "./bo-read-handler";
import type { BoReadEnv } from "./bo-read-handler";

const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const principal="pino_staff_password_session=test-only-placeholder";
function envFor(calls:unknown[]):BoReadEnv {
 return { PINO_BO_CORE: {
   async executeWithStaffPassword(request:{method:string;path:string;resource?:{centerId?:string}},token:string) {
     calls.push({request,token});
     return {status:200,requestId:"pap1252-qa",body:{data:{centerId:center,deviceSessions:[]}}};
   },
 }} as unknown as BoReadEnv;
}
test("PAP-1252 BO TV health route is explicitly admitted with scoped Core resource",async()=>{
 const calls:unknown[]=[];
 assert.equal(isOperationalReadPath("tv/operator-health"),true);
 const req=new Request("https://bo.staging.pinohouse.art/api/bo/tv/operator-health?centerId="+center,{
   headers:{cookie:principal},
 });
 const response=await handleBoOperationalReadRequest(req,envFor(calls),"tv/operator-health");
 assert.equal(response.status,200);
 assert.deepEqual((await response.json()).data,{centerId:center,deviceSessions:[]});
 assert.equal(calls.length,1);
 const payload=calls[0] as {request:{method:string;path:string;resource:{centerId:string}};token:string};
 assert.equal(payload.request.method,"GET");
 assert.equal(payload.request.path,"tv/operator-health");
 assert.deepEqual(payload.request.resource,{centerId:center});
 assert.equal(payload.token,"test-only-placeholder");
});
test("PAP-1252 BO TV health rejects absent or ambiguous Center before Core",async()=>{
 for(const query of ["","?centerId=invalid","?centerId="+center+"&centerId="+center,"?centerId="+center+"&anything=1"]){
  const calls:unknown[]=[];
  const r=await handleBoOperationalReadRequest(new Request("https://bo.staging.pinohouse.art/api/bo/tv/operator-health"+query,{headers:{cookie:principal}}),envFor(calls),"tv/operator-health");
  assert.equal(r.status,400,query);
  assert.equal(calls.length,0);
 }
});
test("PAP-1252 BO diagnostic client never borrows TOS operator or runtime session credentials",()=>{
 const s=readFileSync(new URL("../app/bo/pinoria-tv-operator/TvDeviceDiagnostics.tsx",import.meta.url),"utf8");
 assert.match(s,/\/api\/bo\/tv\/operator-health\?centerId=/);
 assert.doesNotMatch(s,/operatorPresentationClient\.operatorHealth|\/api\/tos-learning\/|\/api\/tv\/runtime\/|PINO_TV_SESSION/);
 assert.match(s,/Heartbeat không phải renderer ACK/);
});
