import test from "node:test";
import assert from "node:assert/strict";
import {handleBoAvatarWorldRequest,isBoAvatarWorldPath,type BoAvatarWorldEnv} from "./bo-avatar-world-handler";
import type {BoAccessRequest} from "./bo-core";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const selfId=id(1),centerId=id(2),worldId=id(3),instanceId=id(4);
const path="pinoria/avatars/"+selfId+"/world",cmd=path+"/commands";
const url=(p:string)=>"https://bo.staging.pinohouse.art/api/bo/"+p+"?centerId="+centerId;
function fixture(status=200){
 const calls:{request:BoAccessRequest;token:string}[]=[];
 const env={PINO_BO_CORE:{async executeWithStaffPassword(request:BoAccessRequest,token:string){calls.push({request,token});return {status,body:{data:{instanceId,version:1}},requestId:"qa-world"}}}} as BoAvatarWorldEnv;
 return {calls,env};
}
function req(p:string,method="GET",body?:unknown,query=url(p),key="qa-world-original"){
 return new Request(query,{method,headers:{cookie:"pino_staff_password_session=synthetic-test-token",...(body===undefined?{}:{"content-type":"application/json","idempotency-key":key})},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
test("exact World GET and POST forwarding, authoritative statuses and request ID",async()=>{
 const f=fixture();const r=await handleBoAvatarWorldRequest(req(path),f.env,path);
 assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store");assert.equal(r.headers.get("x-request-id"),"qa-world");
 assert.deepEqual(f.calls[0],{request:{method:"GET",path,resource:{centerId}},token:"synthetic-test-token"});
 const cases=[{kind:"grant",worldId,label:"QA",expectedVersion:1},{kind:"live",instanceId,expectedVersion:2},{kind:"scene",instanceId,sceneId:id(5),accessible:true,expectedVersion:2},{kind:"layer",instanceId,layerId:id(6),unlocked:false,expectedVersion:3}];
 for(const body of cases){const g=fixture(body.kind==="grant"?201:200);const out=await handleBoAvatarWorldRequest(req(cmd,"POST",body),g.env,cmd);assert.equal(out.status,body.kind==="grant"?201:200);assert.deepEqual(g.calls[0]?.request,{method:"POST",path:cmd,resource:{centerId},body,idempotencyKey:"qa-world-original"})}
});
test("invalid path verb scope command and key never reach Core",async()=>{
 const f=fixture(),body={kind:"grant",worldId,label:"QA",expectedVersion:1};
 for(const wrong of [path+"/extra",path.replace(selfId,"bad"),"pinoria/worlds"]){assert.equal(isBoAvatarWorldPath(wrong),false);assert.equal((await handleBoAvatarWorldRequest(req(path),f.env,wrong)).status,404)}
 for(const [p,m] of [[path,"POST"],[cmd,"GET"],[cmd,"DELETE"]])assert.equal((await handleBoAvatarWorldRequest(req(p,m),f.env,p)).status,405);
 for(const query of [url(path)+"&centerId="+centerId,url(path)+"&actor=Founder",url(path).replace(centerId,"bad")])assert.equal((await handleBoAvatarWorldRequest(req(path,"GET",undefined,query),f.env,path)).status,400);
 for(const bad of [{...body,actor:"Founder"},{...body,expectedVersion:0},{...body,worldId:"bad"},{...body,label:" "},{kind:"revoke",instanceId,expectedVersion:2}])assert.equal((await handleBoAvatarWorldRequest(req(cmd,"POST",bad),f.env,cmd)).status,400);
 assert.equal((await handleBoAvatarWorldRequest(req(cmd,"POST",body,url(cmd),"short"),f.env,cmd)).status,400);assert.equal(f.calls.length,0);
});
test("unauthenticated and upstream denied/conflict are never converted to success",async()=>{
 const f=fixture();assert.equal((await handleBoAvatarWorldRequest(new Request(url(path)),f.env,path)).status,401);assert.equal(f.calls.length,0);
 for(const status of [403,404,409,503]){const g=fixture(status);assert.equal((await handleBoAvatarWorldRequest(req(path),g.env,path)).status,status);assert.equal(g.calls.length,1)}
});
