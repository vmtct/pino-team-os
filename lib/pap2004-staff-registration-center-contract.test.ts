import test from "node:test";
import assert from "node:assert/strict";
import {handleBoOperationalReadRequest} from "./bo-read-handler";
import {handleBoWriteRequest} from "./bo-write-handler";
import type {BoAccessRequest,BoAccessCoreBinding} from "./bo-core";
import {decideHostBoundary} from "./host-boundary";
const centerId="01912345-6789-7abc-8def-0123456789ab";
const id="01912345-6789-7abc-8def-0123456789ac";
const root="https://bo.staging.pinohouse.art/api/bo/";
const queue="workforce/staff-registration-requests",roles="workforce/staff-registration-eligible-roles";
function fixture(){
 const requests:BoAccessRequest[]=[];
 const binding:BoAccessCoreBinding={async executeWithStaffPassword(request,token){assert.equal(token,"local-qa-token");requests.push(request);return{status:200,body:{data:[]},requestId:"qa"}}};
 return{requests,env:{PINO_BO_CORE:binding}};
}
function req(path:string,query:string,body?:unknown,auth=true,key=true){
 return new Request(root+path+query,{method:body===undefined?"GET":"POST",headers:{...(auth?{cookie:"pino_staff_password_session=local-qa-token"}:{}),...(key?{"idempotency-key":"qa-attempt"}:{}),"content-type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
test("PAP-2004 read paths forward exact selected Center; only legacy queue accepts absent scope",async()=>{
 const{env,requests}=fixture();
 for(const p of [queue,roles]){
 assert.equal((await handleBoOperationalReadRequest(req(p,"?centerId="+centerId),env,p)).status,200);
 for(const q of ["?centerId=bad","?centerId="+centerId+"&centerId="+centerId,"?centerId="+centerId+"&userId=forged","?scope=GLOBAL"])assert.equal((await handleBoOperationalReadRequest(req(p,q),env,p)).status,400);
 }
 assert.equal((await handleBoOperationalReadRequest(req(roles,""),env,roles)).status,400);
 assert.equal((await handleBoOperationalReadRequest(req(queue,""),env,queue)).status,200);
 assert.equal((await handleBoOperationalReadRequest(req(queue,"?centerId="+centerId,undefined,false),env,queue)).status,401);
 assert.deepEqual(requests,[{method:"GET",path:queue,resource:{centerId}},{method:"GET",path:roles,resource:{centerId}},{method:"GET",path:queue}]);
});
test("PAP-2004 write scopes and expected version are preserved, invalid selector and replay inputs denied",async()=>{
 const{env,requests}=fixture();
 for(const op of ["approve","reject"]){
 const p=queue+"/"+id+"/"+op;
 const body=op==="approve"?{expectedVersion:1,assignments:[{roleId:id,scopeType:"CENTER",scopeId:centerId}],pinoriaIdentity:{mode:"CREATE_STAFF_ONLY_PERSON"}}:{expectedVersion:1,reason:"QA"};
 assert.equal((await handleBoWriteRequest(req(p,"?centerId="+centerId,body),env,p)).status,200);
 for(const q of ["?centerId=bad","?centerId="+centerId+"&centerId="+centerId,"?centerId="+centerId+"&userId=forged"])assert.equal((await handleBoWriteRequest(req(p,q,body),env,p)).status,400);
 for(const invalid of [{...body,expectedVersion:0},{...body,expectedVersion:"1"},{...body,userId:id},{...body,existingStaffMemberId:id}])assert.equal((await handleBoWriteRequest(req(p,"?centerId="+centerId,invalid),env,p)).status,400);
 assert.equal((await handleBoWriteRequest(req(p,"?centerId="+centerId,body,true,false),env,p)).status,400);
 assert.equal((await handleBoWriteRequest(req(p,"?centerId="+centerId,body,false),env,p)).status,401);
 assert.deepEqual(requests.at(-1),{method:"POST",path:p,resource:{centerId},body,idempotencyKey:"qa-attempt"});
 }
 assert.equal(requests.length,2);
});
test("PAP-2004 role picker requires BO session; never public join or TOS",()=>{
 const p="/api/bo/"+roles;
 assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",p,"GET"),{action:"next"});
 assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",p,"POST"),{action:"not_found"});
 for(const host of ["join.pinohouse.art","bo.pinohouse.art","tos.staging.pinohouse.art","ho.staging.pinohouse.art"])assert.deepEqual(decideHostBoundary(host,p,"GET"),{action:"not_found"});
});
