// PAP-2050 / PLT-ACCESS. Synthetic service binding; no live access mutation.
import test from "node:test";
import assert from "node:assert/strict";
import {handleBoWriteRequest,type BoWriteEnv} from "./bo-write-handler";
import {decideHostBoundary,BO_STAGING_HOSTNAME} from "./host-boundary";
import type {BoAccessRequest} from "./bo-core";
const root="access/founder-manager-policy";
const host=BO_STAGING_HOSTNAME,origin="https://"+host;
const policy="PAP-2025-STUDENT-OPERATIONAL-V1";
function request(path:string,body:unknown,opts:{host?:string;origin?:string;method?:string;auth?:boolean;query?:string;contentType?:string}={}){
 const method=opts.method??"POST";
 return new Request("https://"+(opts.host??host)+"/api/bo/"+path+(opts.query??""),{
  method,headers:{origin:opts.origin??origin,"content-type":opts.contentType??"application/json",...(opts.auth===false?{}:{cookie:"pino_staff_password_session=synthetic-token"})},
  ...(method==="GET"||method==="HEAD"?{}:{body:JSON.stringify(body)}),
 });
}
test("PAP-2050 original admit and revoke POST routes only on BO Staging",()=>{
 for(const action of ["admit","revoke"]){
  const path="/api/bo/"+root+"/"+action;
  assert.equal(decideHostBoundary(host,path,"POST").action,"next");
  for(const wrong of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art","localhost"])assert.equal(decideHostBoundary(wrong,path,"POST").action,"not_found");
  for(const method of ["GET","PATCH","DELETE","PUT","OPTIONS"])assert.equal(decideHostBoundary(host,path,method).action,"not_found");
 }
 for(const suffix of ["","/other","/admit/","/admit/extra","/ADMIT"])assert.equal(decideHostBoundary(host,"/api/bo/"+root+suffix,"POST").action,"not_found");
});
test("forwards exact fixed commands using original authenticated private Core binding; preserves Core denial",async()=>{
 const forwarded:BoAccessRequest[]=[];
 const env:BoWriteEnv={APP_ENV:"staging",PINO_BO_CORE:{async executeWithStaffPassword(req,token){
  assert.equal(token,"synthetic-token");forwarded.push(req);
  return {status:req.path.endsWith("/admit")?201:403,body:{data:{status:"synthetic"}},requestId:"synthetic-core"};
 }}};
 for(const [action,revision,status] of [["admit",0,201],["revoke",1,403]] as const){
  const path=root+"/"+action,body={policy,expectedRevision:revision};
  const response=await handleBoWriteRequest(request(path,body),env,path);
  assert.equal(response.status,status);assert.equal(response.headers.get("x-request-id"),"synthetic-core");
  assert.deepEqual(forwarded.at(-1),{method:"POST",path,body});
 }
 assert.equal(forwarded.length,2);
});
test("rejects wrong environment, host, origin, authentication, query, verb, revision and extra authority without calling Core",async()=>{
 let calls=0;
 const env:BoWriteEnv={APP_ENV:"staging",PINO_BO_CORE:{async executeWithStaffPassword(){calls++;throw new Error("unexpected Core call");}}};
 const path=root+"/admit",body={policy,expectedRevision:0};
 const call=(req:Request,p=path,e=env)=>handleBoWriteRequest(req,e,p);
 assert.equal((await call(request(path,body),path,{...env,APP_ENV:"production"})).status,404);
 assert.equal((await call(request(path,body),path,{...env,APP_ENV:undefined})).status,404);
 assert.equal((await call(request(path,body,{host:"bo.pinohouse.art"}))).status,404);
 assert.equal((await call(request(path,body,{origin:"https://attacker.invalid"}))).status,403);
 assert.equal((await call(request(path,body,{contentType:"text/plain"}))).status,403);
 assert.equal((await call(request(path,body,{auth:false}))).status,401);
 assert.equal((await call(request(path,body,{query:"?userId=forged"}))).status,404);
 assert.equal((await call(request(path,body,{method:"GET"}))).status,405);
 for(const invalid of [{...body,userId:"forged"},{...body,roleId:"forged"},{...body,permissionKeys:["*"]},{...body,policy:"other"},{...body,expectedRevision:1},{...body,expectedRevision:"0"},null,[]]){
  assert.equal((await call(request(path,invalid))).status,400);
 }
 for(const invalid of [-1,0,1.5,"1"]){
  const revoke=root+"/revoke";
  assert.equal((await call(request(revoke,{policy,expectedRevision:invalid}),revoke)).status,400);
 }
 assert.equal((await call(request(root+"/other",body),root+"/other")).status,404);
 assert.equal(calls,0);
});

test("PAP-2065 exact revision2 expansion only on authenticated BO Staging",async()=>{
 const path=root+"/expand",v2="PAP-2065-OPERATIONAL-V2-PLT-ATTR-2090",body={policy:v2,expectedRevision:1};
 assert.equal(decideHostBoundary(host,"/api/bo/"+path,"POST").action,"next");
 for(const wrong of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art","localhost"])assert.equal(decideHostBoundary(wrong,"/api/bo/"+path,"POST").action,"not_found");
 for(const method of ["GET","PATCH","DELETE","PUT","OPTIONS"])assert.equal(decideHostBoundary(host,"/api/bo/"+path,method).action,"not_found");
 for(const suffix of ["/","/extra"])assert.equal(decideHostBoundary(host,"/api/bo/"+path+suffix,"POST").action,"not_found");
 const forwarded:BoAccessRequest[]=[];
 const env:BoWriteEnv={APP_ENV:"staging",PINO_BO_CORE:{async executeWithStaffPassword(req,token){
  assert.equal(token,"synthetic-token");forwarded.push(req);return {status:200,body:{data:{revision:2,status:"active"}},requestId:"pap2065"};
 }}};
 const call=(b:unknown,opts:Parameters<typeof request>[2]={},e=env)=>handleBoWriteRequest(request(path,b,opts),e,path);
 for(const invalid of [{...body,policy},{...body,policy:"PAP-2065-OPERATIONAL-V2"},{...body,expectedRevision:0},{...body,expectedRevision:2},{...body,expectedRevision:"1"},{...body,permissionKeys:["*"]},{...body,roleId:"forged"}])assert.equal((await call(invalid)).status,400);
 assert.equal((await call(body,{origin:"https://attacker.invalid"})).status,403);
 assert.equal((await call(body,{auth:false})).status,401);
 assert.equal((await call(body,{query:"?roleId=forged"})).status,404);
 assert.equal((await call(body,{}, {...env,APP_ENV:"production"})).status,404);
 assert.equal(forwarded.length,0);
 const response=await call(body);
 assert.equal(response.status,200);
 assert.equal(response.headers.get("x-request-id"),"pap2065");
 assert.deepEqual(forwarded,[{method:"POST",path,body}]);
});
