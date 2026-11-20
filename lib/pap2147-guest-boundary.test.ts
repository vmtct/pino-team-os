import assert from "node:assert/strict";
import test from "node:test";
import {guestHostDecision} from "./bo-mytime-guest-host-contract";
import {handleBoMyTimeGuestRequest,type BoMyTimeGuestEnv} from "./bo-mytime-guest-handler";
const BO="bo.staging.pinohouse.art",base="/api/bo/identity/mytime-guests",id="019d2144-0000-7000-8000-000000000001";
test("PAP-2147 Guest exact host+method boundary",()=>{
 for(const host of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art","localhost"]){
  for(const path of ["/bo/guests","/bo/mytime-guests",base,base+"/"+id,base+"/"+id+"/history"])assert.equal(guestHostDecision(host,path,"GET"),"not_found");
 }
 for(const [path,method] of [[base,"GET"],[base,"POST"],[base+"/"+id,"PATCH"],[base+"/"+id+"/history","GET"],["/bo/mytime-guests","HEAD"],["/bo/guests","GET"],["/bo/guests","HEAD"]])assert.equal(guestHostDecision(BO,path!,method!),"next");
 for(const [path,method] of [[base,"DELETE"],[base+"/"+id+"/history","PATCH"],[base+"/publish","POST"],[base+"/"+id+"/activity","GET"],[base+"/not-id","GET"],["/bo/mytime-guests/evil","GET"],["/bo/guests/evil","GET"],["/bo/guests","POST"]])assert.equal(guestHostDecision(BO,path!,method!),"not_found");
 assert.equal(guestHostDecision(BO,"/api/bo/identity/parents","GET"),null);
});
test("PAP-2147 facade denies bad origin/method/unscoped before attempting credentials",async()=>{
 const env={APP_ENV:"staging"} as BoMyTimeGuestEnv;
 for(const [host,path,method,status] of [[BO,base,"DELETE",405],[BO,base+"/"+id+"/history","PATCH",405],["bo.pinohouse.art",base,"GET",404],[BO,base+"?centerId="+id+"&centerId="+id,"GET",400],[BO,base+"?status=ACTIVE&centerId="+id,"GET",400],[BO,base+"?centerId="+id+"&limit=101","GET",400],[BO,base,"GET",400]] as const){
  const req=new Request("https://"+host+path,{method});
  const result=await handleBoMyTimeGuestRequest(req,env,new URL(req.url).pathname.slice("/api/bo/".length));
  assert.equal(result.status,status);assert.equal(result.headers.get("cache-control"),"no-store");
 }
});

import {safeBoStagingReturnTo} from "./bo-staging-return-to";
import {buildBoTargetUrl} from "./bo-url-contract";
test("PAP-2202 canonical Guest deep-link and legacy continuation preserve safe query only",()=>{
 const center="019d2144-0000-7000-8000-000000000001",record="019d2144-0000-7000-8000-000000000002";
 const path="/bo/guests?centerId="+center+"&record="+record;
 assert.equal(buildBoTargetUrl({moduleKey:"guests",surface:"drawer",recordId:record,query:{centerId:center}}),path);
 assert.equal(safeBoStagingReturnTo(path),path);
 assert.equal(safeBoStagingReturnTo(path.replace("/bo/guests","/bo/mytime-guests")),path);
 assert.equal(safeBoStagingReturnTo(path+"&returnTo=https://example.com"),null);
 assert.equal(safeBoStagingReturnTo(path+"&record="+record),null);
});
