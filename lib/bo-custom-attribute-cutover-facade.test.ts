import {decideHostBoundary} from "./host-boundary";
import test from "node:test";
import assert from "node:assert/strict";
import {handleBoCutoverRequest,isBoCutoverPath,isExactBoCutoverMethod,type BoCutoverEnv} from "./bo-custom-attribute-cutover-facade";
import type {BoAccessRequest} from "./bo-core";
const root="access/custom-attribute-cutover",host="bo.staging.pinohouse.art",origin="https://"+host;
const command={policy:"PAP-2098-ONE-SHOT-STAGING-CUSTOM-ATTRIBUTE",digest:"a".repeat(64)};
function req(path:string,method:string,body:unknown=command,opts:{host?:string;origin?:string;auth?:boolean;query?:string}={}){
 return new Request("https://"+(opts.host??host)+"/api/bo/"+path+(opts.query??""),{method,headers:{origin:opts.origin??origin,"content-type":"application/json",...(opts.auth===false?{}:{cookie:"pino_staff_password_session=synthetic-token"})},...(method==="GET"?{}:{body:JSON.stringify(body)})});
}
test("exact methods and namespace; Core retains authority and no caching",async()=>{
 const calls:BoAccessRequest[]=[];
 const env:BoCutoverEnv={APP_ENV:"staging",PINO_BO_CORE:{async executeWithStaffPassword(r,t){assert.equal(t,"synthetic-token");calls.push(r);return {status:r.method==="GET"?200:403,body:{data:"synthetic"},requestId:"synthetic"};}}};
 for(const [action,method,status] of [["preview","GET",200],["execute","POST",403]] as const){
  const path=root+"/"+action;
  assert.equal(isBoCutoverPath(path),true);assert.equal(isExactBoCutoverMethod(path,method),true);
  const response=await handleBoCutoverRequest(req(path,method),env,path);
  assert.equal(response.status,status);assert.equal(response.headers.get("cache-control"),"no-store");
  assert.equal(response.headers.get("x-request-id"),"synthetic");
 }
 assert.deepEqual(calls,[{method:"GET",path:root+"/preview"},{method:"POST",path:root+"/execute",body:command}]);
});
test("wrong host, verb, origin, session, query, body and environment never forward",async()=>{
 let calls=0;const env:BoCutoverEnv={APP_ENV:"staging",PINO_BO_CORE:{async executeWithStaffPassword(){calls++;throw Error("unexpected");}}};
 const path=root+"/execute";
 const call=(r:Request,p=path,e=env)=>handleBoCutoverRequest(r,e,p);
 assert.equal((await call(req(path,"POST"),path,{...env,APP_ENV:"production"})).status,404);
 assert.equal((await call(req(path,"POST",command,{host:"bo.pinohouse.art"}))).status,404);
 assert.equal((await call(req(path,"POST",command,{query:"?centerId=forged"}))).status,404);
 assert.equal((await call(req(path,"GET"))).status,405);
 assert.equal((await call(req(path,"POST",command,{origin:"https://attacker.invalid"}))).status,403);
 assert.equal((await call(req(path,"POST",command,{auth:false}))).status,401);
 for(const b of [{...command,approvalReceipt:"PAP-2098#1"},{...command,founderUserId:"forged"},{...command,digest:"wrong"},{...command,policy:"other"},null,[]])assert.equal((await call(req(path,"POST",b))).status,400);
 assert.equal((await call(req(root+"/other","POST"),root+"/other")).status,404);
 assert.equal(calls,0);
});

test("canonical host boundary admits only exact BO Staging preview and execute",()=>{
 for(const [action,verb] of [["preview","GET"],["execute","POST"]] as const){
  const p="/api/bo/"+root+"/"+action;
  assert.equal(decideHostBoundary(host,p,verb).action,"next");
  for(const wrong of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art","localhost"])assert.equal(decideHostBoundary(wrong,p,verb).action,"not_found");
  for(const wrong of ["GET","POST","PATCH","PUT","DELETE","HEAD","OPTIONS"].filter(x=>x!==verb))assert.equal(decideHostBoundary(host,p,wrong).action,"not_found");
  for(const suffix of ["/","/extra"])assert.equal(decideHostBoundary(host,p+suffix,verb).action,"not_found");
 }
 assert.equal(decideHostBoundary(host,"/api/bo/"+root+"/other","POST").action,"not_found");
});