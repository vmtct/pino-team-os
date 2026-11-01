import test from "node:test";
import assert from "node:assert/strict";
import {handleBoOperationalReadRequest,isOperationalReadPath,type BoReadEnv} from "./bo-read-handler";
import type {BoAccessCoreBinding, BoAccessRequest} from "./bo-core";
import {isAllowedPostPath} from "./bo-write-handler";
import {decideHostBoundary} from "./host-boundary";

test("PAP-1092 BO BFF admits only one-use Pass inventory and write whitelist",()=>{
 assert.equal(isOperationalReadPath("open-studio/walkin/inventory"),true);
 assert.equal(isOperationalReadPath("open-studio/walkin/history"),true);
 assert.equal(isOperationalReadPath("open-studio/walkin/lookup"),false);
 assert.equal(isOperationalReadPath("open-studio/walkin/consume"),false);
 for(const p of ["batches","assign","revoke"]) assert.equal(isAllowedPostPath("open-studio/walkin/"+p),true,p);
 for(const p of ["consume","lookup","refund","delete","foo"])assert.equal(isAllowedPostPath("open-studio/walkin/"+p),false,p);
});
test("PAP-1092 BO endpoint cannot cross HO/TOS host boundary",()=>{
 for(const suffix of ["inventory","batches","assign","revoke"]){
  const path="/api/bo/open-studio/walkin/"+suffix;
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path,suffix==="inventory"?"GET":"POST"),{action:"next"});
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",path,suffix==="inventory"?"GET":"POST"),{action:"not_found"});
  assert.deepEqual(decideHostBoundary("tos.staging.pinohouse.art",path,suffix==="inventory"?"GET":"POST"),{action:"not_found"});
 }
});
test("PAP-1092 TOS binding is not routed via BO BFF",()=>{
 assert.deepEqual(decideHostBoundary("tos.staging.pinohouse.art","/api/tos-learning/open-studio/walkin/lookup","GET"),{action:"next"});
 assert.deepEqual(decideHostBoundary("tos.staging.pinohouse.art","/api/tos-learning/open-studio/walkin/consume","POST"),{action:"next"});
});

test("PAP-1092 HO Open Studio Pass host route is isolated and verb-limited",()=>{
 for(const [route,method] of [["inventory","GET"],["batches","POST"],["revoke","POST"]] as const){
  const path="/api/ho/open-studio/walkin/"+route;
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",path,method),{action:"next"});
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path,method),{action:"not_found"});
  assert.deepEqual(decideHostBoundary("tos.staging.pinohouse.art",path,method),{action:"not_found"});
 }
 assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art","/api/ho/open-studio/walkin/assign","POST"),{action:"not_found"});
 assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art","/api/ho/open-studio/walkin/batches","GET"),{action:"not_found"});
});
test("BO Pass history read binds exact canonical IDs and rejects query injection before Core",async()=>{
 const center="01912345-6789-7abc-8def-0123456789ab";
 const pass="01912345-6789-7abc-8def-0123456789ac";
 const path="open-studio/walkin/history";
 const forwarded:BoAccessRequest[]=[];
 const binding:BoAccessCoreBinding={async executeWithStaffPassword(input){forwarded.push(input);return {status:200,body:{data:[]},requestId:"walkin-history"};}};
 const env:BoReadEnv={PINO_BO_CORE:binding};
 const request=(q:string,auth=true)=>new Request("https://bo.staging.pinohouse.art/api/bo/"+path+q,{
  headers:auth?{cookie:"pino_staff_password_session=test-staff-password"}:{},
 });
 const valid=await handleBoOperationalReadRequest(request("?passId="+pass+"&centerId="+center),env,path);
 assert.equal(valid.status,200);
 assert.deepEqual(forwarded,[{method:"GET",path:path+"?passId="+pass+"&centerId="+center}]);
 for(const q of ["", "?centerId="+center,"?passId="+pass,"?centerId="+center+"&passId="+pass+"&passId="+pass,
 "?centerId="+center+"&passId=forged","?centerId="+center+"&passId="+pass+"&userId=forged",
 "?centerId="+center+"&passId="+pass+"&centerId="+center]){
  assert.equal((await handleBoOperationalReadRequest(request(q),env,path)).status,400,q);
 }
 assert.equal((await handleBoOperationalReadRequest(request("?passId="+pass+"&centerId="+center,false),env,path)).status,401);
 assert.equal(forwarded.length,1,"no unauthorized Core request");
});

test("PAP-1248 Parent exact-contact lookup and proof are POST-only and staging BO-only",()=>{
 for(const suffix of ["parent-contact-lookup","parent-center-proofs"]){
  const endpoint="open-studio/walkin/"+suffix;
  const path="/api/bo/"+endpoint;
  assert.equal(isAllowedPostPath(endpoint),true);
  assert.equal(isOperationalReadPath(endpoint),false);
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path,"POST"),{action:"next"});
  for(const host of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art"])
   assert.deepEqual(decideHostBoundary(host,path,"POST"),{action:"not_found"},host);
  for(const method of ["GET","PUT","DELETE"])
   assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path,method),{action:"not_found"},method);
 }
 assert.equal(isAllowedPostPath("open-studio/walkin/parent-contact-lookup-all"),false);
});
