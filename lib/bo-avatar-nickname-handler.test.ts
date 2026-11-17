import test from "node:test";
import assert from "node:assert/strict";
import {handleBoAvatarNicknameRequest,isBoAvatarNicknamePath,type BoAvatarNicknameEnv} from "./bo-avatar-nickname-handler";
import type {BoAccessCoreBinding,BoAccessRequest} from "./bo-core";

const centerId="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const avatarId="01a194f0-9bd0-7896-89a0-677a620e3ecd";
const path="pinoria/avatars/"+avatarId;
const url="https://bo.staging.pinohouse.art/api/bo/"+path;
const fixture=(status=200)=>{
 const seen:Array<{request:BoAccessRequest,token:string}>=[];
 const binding:BoAccessCoreBinding={async executeWithStaffPassword(request,token) {
   seen.push({request,token});
   return {status,body:status===200?{data:{selfVersion:2,nickname:"Mây"}}:{error:{code:status===409?"VERSION_CONFLICT":"ACCESS_PERMISSION_DENIED"}},requestId:"pap1847-request"};
 }};
 return {env:{PINO_BO_CORE:binding} as BoAvatarNicknameEnv,seen};
};
const req=(body:unknown,query="?centerId="+centerId,cookie=true)=>new Request(url+query,{
 method:"PATCH",headers:{"content-type":"application/json",...(cookie?{cookie:"pino_staff_password_session=synthetic-local-token"}:{})},body:JSON.stringify(body)
});
test("PAP-1847 forwards only exact nickname/version and selected Center with real credential",async()=>{
 const f=fixture();
 const r=await handleBoAvatarNicknameRequest(req({nickname:"  Ma\u0302y  ",expectedSelfVersion:1}),f.env,path);
 assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store");
 assert.equal(r.headers.get("x-request-id"),"pap1847-request");
 assert.deepEqual(f.seen,[{request:{method:"PATCH",path,resource:{centerId},body:{nickname:"Mây",expectedSelfVersion:1}},token:"synthetic-local-token"}]);
});
test("PAP-1847 accepts explicit null clear, rejects empty string",async()=>{
 const f=fixture();
 assert.equal((await handleBoAvatarNicknameRequest(req({nickname:null,expectedSelfVersion:3}),f.env,path)).status,200);
 assert.deepEqual(f.seen[0]?.request.body,{nickname:null,expectedSelfVersion:3});
 assert.equal((await handleBoAvatarNicknameRequest(req({nickname:"  ",expectedSelfVersion:3}),f.env,path)).status,400);
 assert.equal(f.seen.length,1);
});
test("PAP-1847 rejects extra keys, wrong path/Center, invalid version and control chars before Core",async()=>{
 const f=fixture();
 assert.equal(isBoAvatarNicknamePath(path),true);
 for(const bad of [path+"/loadout",path.toUpperCase(),"pinoria/avatars/bad"]){
   assert.equal((await handleBoAvatarNicknameRequest(req({nickname:"Mây",expectedSelfVersion:1}),f.env,bad)).status,404);
 }
 for(const query of ["","?centerId=bad","?centerId="+centerId+"&role=founder","?centerId="+centerId+"&centerId="+centerId]){
   assert.equal((await handleBoAvatarNicknameRequest(req({nickname:"Mây",expectedSelfVersion:1},query),f.env,path)).status,400);
 }
 for(const body of [{nickname:"a",expectedSelfVersion:0},{nickname:"a",expectedSelfVersion:1,actorId:"founder"},
 {nickname:"a",expectedSelfVersion:1,centerId},{nickname:"n".repeat(41),expectedSelfVersion:1},
 {nickname:"x\ny",expectedSelfVersion:1},{nickname:7,expectedSelfVersion:1},
 {expectedSelfVersion:1},{nickname:"a"},[]]){
  assert.equal((await handleBoAvatarNicknameRequest(req(body),f.env,path)).status,400);
 }
 assert.equal(f.seen.length,0);
});
test("PAP-1847 denies unauthenticated, propagates Core 403/404/409 without bypass",async()=>{
 const f=fixture(409);
 assert.equal((await handleBoAvatarNicknameRequest(req({nickname:"Mây",expectedSelfVersion:1},"?centerId="+centerId,false),f.env,path)).status,401);
 assert.equal(f.seen.length,0);
 for(const status of [403,404,409]) {
  const s=fixture(status), r=await handleBoAvatarNicknameRequest(req({nickname:"Mây",expectedSelfVersion:1}),s.env,path);
  assert.equal(r.status,status);assert.equal(r.headers.get("x-request-id"),"pap1847-request");
  assert.equal(s.seen.length,1);
 }
});
