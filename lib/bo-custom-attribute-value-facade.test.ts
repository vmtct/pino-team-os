import test from "node:test";
import assert from "node:assert/strict";
import {handleBoCustomAttributeValueRequest as handle,isBoCustomAttributeValueMethod,type BoCustomAttributeValueEnv} from "./bo-custom-attribute-value-facade";
import type {BoAccessRequest,BoAccessCoreBinding} from "./bo-core";
const centerId="01a0b29a-3acd-7a18-a0f2-cf6016548ab5",entity="01a194f0-9bd0-7896-89a0-677a620e3ecd",definition="01a1e1a0-0000-7000-8000-000000000001";
const root="https://bo.staging.pinohouse.art",paths=["students/"+entity+"/custom-attributes","identity/parents/"+entity+"/custom-attributes"];
const command={expectedDefinitionRevision:1,expectedValueRevision:0,value:false};
function fixture(status=200,body:unknown={data:{scopeCenterId:centerId,items:[]}}){
 const seen:Array<{request:BoAccessRequest,token:string}>=[];
 const binding:BoAccessCoreBinding={async executeWithStaffPassword(request,token){seen.push({request,token});return {status,body,requestId:"local-request"};}};
 return {env:{PINO_BO_CORE:binding} as BoCustomAttributeValueEnv,seen};
}
function req(path:string,method="GET",query="?centerId="+centerId,body:unknown=command,host=root,origin=root,cookie=true){
 return new Request(host+"/api/bo/"+path+query,{method,headers:{origin,"content-type":"application/json",...(cookie?{cookie:"pino_staff_password_session=synthetic-local-token"}:{})},...(method==="PATCH"?{body:JSON.stringify(body)}:{})});
}
test("PAP-1671 both native GET routes forward exact Center and pagination via staff credential",async()=>{
 for(const path of paths){
  const f=fixture(),r=await handle(req(path,"GET","?centerId="+centerId+"&limit=100&afterDefinitionId="+definition),f.env,path);
  assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store");assert.equal(r.headers.get("x-request-id"),"local-request");
  assert.deepEqual(f.seen,[{request:{method:"GET",path:path+"?limit=100&afterDefinitionId="+definition,resource:{centerId}},token:"synthetic-local-token"}]);
 }
});
test("PAP-1671 both native PATCH routes forward only explicit CAS values and preserve Core status",async()=>{
 for(const base of paths)for(const status of [200,403,404,409,422]){
  const path=base+"/"+definition,f=fixture(status,{data:{revision:1}});
  assert.equal((await handle(req(path,"PATCH"),f.env,path)).status,status);
  assert.deepEqual(f.seen,[{request:{method:"PATCH",path,resource:{centerId},body:command},token:"synthetic-local-token"}]);
 }
});
test("PAP-1671 reject invalid or ambiguous query before Core",async()=>{
 const f=fixture(),path=paths[0]!;
 for(const query of ["","?centerId=bad","?centerId="+centerId+"&centerId="+centerId,"?centerId="+centerId+"&limit=101","?centerId="+centerId+"&afterDefinitionId=bad","?centerId="+centerId+"&actorId=x"]){
  assert.equal((await handle(req(path,"GET",query),f.env,path)).status,400);
 }
 assert.equal(f.seen.length,0);
});
test("PAP-1671 fail closed on host, verb, origin, identity and body mismatch",async()=>{
 const f=fixture(),base=paths[0]!,path=base+"/"+definition;
 assert.equal(isBoCustomAttributeValueMethod(base,"GET"),true);
 assert.equal(isBoCustomAttributeValueMethod(path,"GET"),false);
 for(const h of ["https://bo.pinohouse.art","https://ho.staging.pinohouse.art","https://tos.staging.pinohouse.art","https://bo.staging.pinohouse.art.evil.test"]){
  assert.equal((await handle(req(base,"GET","?centerId="+centerId,command,h),f.env,base)).status,404);
 }
 assert.equal((await handle(req(path,"GET"),f.env,path)).status,405);
 assert.equal((await handle(req(path,"PATCH","?centerId="+centerId,command,root,"https://evil.test"),f.env,path)).status,403);
 assert.equal((await handle(req(base,"GET","?centerId="+centerId,command,root,root,false),f.env,base)).status,401);
 for(const invalid of [{...command,actorId:entity},{...command,expectedValueRevision:-1},{...command,expectedDefinitionRevision:0},{...command,value:null}]){
  assert.equal((await handle(req(path,"PATCH","?centerId="+centerId,invalid),f.env,path)).status,400);
 }
 assert.equal(f.seen.length,0);
});
test("PAP-1671 positive GET without matching server Center receipt is not displayed",async()=>{
 const f=fixture(200,{data:{scopeCenterId:entity,items:[{value:"foreign"}]}});
 const r=await handle(req(paths[0]!),f.env,paths[0]!);
 assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/foreign/);assert.equal(f.seen.length,1);
});