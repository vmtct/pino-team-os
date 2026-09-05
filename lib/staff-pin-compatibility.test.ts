import assert from "node:assert/strict";
import test from "node:test";
import {generateKeyPair,SignJWT,type JWTVerifyGetKey} from "jose";
import {handleStaffPinChange,handleStaffPinStatus,type StaffPinAccessEnv} from "./staff-pin-access-handler";

const domain="team.pino.invalid",audience="tos-aud";
async function cfRequest(path:string,body?:unknown){
  const {privateKey,publicKey}=await generateKeyPair("RS256");
  const jwt=await new SignJWT({email:"staff@pino.invalid"}).setProtectedHeader({alg:"RS256"}).setIssuer(`https://${domain}`).setAudience(audience).setSubject("cf-staff").setExpirationTime("2h").sign(privateKey);
  const request=new Request(`https://tos.pinohouse.art/api/staff-pin/${path}`,{method:body===undefined?"GET":"POST",headers:{"cf-access-jwt-assertion":jwt,...(body===undefined?{}:{"content-type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return{request,keyResolver:(async()=>publicKey) as JWTVerifyGetKey};
}
function environment(overrides:Partial<StaffPinAccessEnv["PINO_STAFF_PIN_CORE"]>):StaffPinAccessEnv{
  return{CF_ACCESS_TEAM_DOMAIN:domain,CF_ACCESS_TOS_AUD:audience,PINO_STAFF_PIN_CORE:{login:async()=>({status:200,body:{},requestId:"login"}),logout:async()=>({status:204,body:null,requestId:"logout"}),statusWithStaffPassword:async()=>({status:200,body:{},requestId:"pw-status"}),configureWithStaffPassword:async()=>({status:200,body:{},requestId:"pw-config"}),rotateWithStaffPassword:async()=>({status:200,body:{},requestId:"pw-rotate"}),...overrides}};
}
test("Cloudflare Staff can read existing PIN status during transition",async()=>{
  const {request,keyResolver}=await cfRequest("status");let subject="";
  const response=await handleStaffPinStatus(request,environment({status:async identity=>{subject=identity.subject;return{status:200,body:{data:{state:"ACTIVE"}},requestId:"legacy-status"};}}),keyResolver);
  assert.equal(response.status,200);assert.equal(subject,"cf-staff");assert.equal(response.headers.get("x-request-id"),"legacy-status");
});
test("Cloudflare-only Staff cannot create a new PIN before password transition",async()=>{
  const {request,keyResolver}=await cfRequest("change",{pin:"135790"});let called=false;
  const response=await handleStaffPinChange(request,environment({rotate:async()=>{called=true;return{status:200,body:{},requestId:"unexpected"};}}),keyResolver);
  assert.equal(response.status,409);assert.equal(called,false);
});
test("Cloudflare Staff can rotate an existing PIN during transition",async()=>{
  const {request,keyResolver}=await cfRequest("change",{currentPin:"135790",pin:"246810"});let seen:unknown;
  const response=await handleStaffPinChange(request,environment({rotate:async(identity,input)=>{seen={subject:identity.subject,...input};return{status:200,body:{data:{state:"ACTIVE"}},requestId:"legacy-rotate"};}}),keyResolver);
  assert.equal(response.status,200);assert.deepEqual(seen,{subject:"cf-staff",currentPin:"135790",pin:"246810"});
});
