import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import type { StaffPasswordEnv } from "./staff-password-core";
import { loginStaffWithTransition } from "./staff-password-transition";

const domain="team.pino.invalid", audience="tos-aud", email="staff@pino.invalid", password="new-transition-password";
async function assertion(){
  const {privateKey,publicKey}=await generateKeyPair("RS256");
  const jwt=await new SignJWT({email}).setProtectedHeader({alg:"RS256"}).setIssuer(`https://${domain}`).setAudience(audience).setSubject("cf-staff-subject").setExpirationTime("2h").sign(privateKey);
  return {jwt,keyResolver:(async()=>publicKey) as JWTVerifyGetKey};
}
function environment(){
  let established=false,establishCalls=0;
  const env:StaffPasswordEnv={CF_ACCESS_TEAM_DOMAIN:domain,CF_ACCESS_TOS_AUD:audience,PINO_STAFF_PASSWORD_CORE:{
    async establishFromCloudflare(identity,input){assert.equal(identity.email,email);assert.equal(input.password,password);established=true;establishCalls+=1;return{state:"CREATED",loginIdentifier:email};},
    async login(input){if(!established)throw new Error("local login denied");assert.deepEqual(input,{email,password});return{token:"local-session",expiresAt:"2026-10-05T00:00:00.000Z",userId:"user-1",staffMemberId:"staff-1",email};},
    async status(){return{userId:"user-1",staffMemberId:"staff-1",email};},async logout(){return{revoked:true};},
  }};
  return {env,getEstablishCalls:()=>establishCalls};
}
test("Cloudflare Staff establishes local password through normal login path",async()=>{
  const {jwt,keyResolver}=await assertion(),state=environment();
  const request=new Request("https://tos.pinohouse.art/api/staff-auth/login",{headers:{"cf-access-jwt-assertion":jwt}});
  const result=await loginStaffWithTransition(request,state.env,{email,password},keyResolver);
  assert.equal(result.token,"local-session");assert.equal(state.getEstablishCalls(),1);
});
test("verified identity must match typed login email",async()=>{
  const {jwt,keyResolver}=await assertion(),state=environment();
  const request=new Request("https://tos.pinohouse.art/api/staff-auth/login",{headers:{"cf-access-jwt-assertion":jwt}});
  await assert.rejects(()=>loginStaffWithTransition(request,state.env,{email:"other@pino.invalid",password},keyResolver),/local login denied/);
  assert.equal(state.getEstablishCalls(),0);
});
