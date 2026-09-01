import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { handleBoOperationalReadRequest, type BoReadEnv } from "./bo-read-handler";
import { handleBoWriteRequest, type BoWriteEnv } from "./bo-write-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const domain="team.cloudflareaccess.com",audience="bo-audience",id="0198d050-56c1-7ac5-b9ab-b0e45d912345";
async function fixture(){const {privateKey,publicKey}=await generateKeyPair("RS256");const jwk=await exportJWK(publicKey);jwk.kid="syllabus";const resolver=createLocalJWKSet({keys:[jwk]});const token=await new SignJWT({email:"founder@example.com"}).setProtectedHeader({alg:"RS256",kid:"syllabus"}).setIssuer(`https://${domain}`).setAudience(audience).setSubject("verified-founder").setIssuedAt().setExpirationTime("5m").sign(privateKey);return{resolver,token};}
function env(binding:BoAccessCoreBinding):BoReadEnv&BoWriteEnv{return{PINO_BO_CORE:binding,CF_ACCESS_TEAM_DOMAIN:domain,CF_ACCESS_BO_AUD:audience};}

test("Learning Syllabus reads forward only governed catalog paths and owner filters",async()=>{const f=await fixture(),forwarded:BoAccessRequest[]=[];const binding:BoAccessCoreBinding={async execute(request){forwarded.push(request);return{status:200,body:{data:[]},requestId:"core-read"};}};const headers={"cf-access-jwt-assertion":f.token};const cases=[
  ["learning/syllabi/owners","learning/syllabi/owners"],
  [`learning/syllabi?ownerType=HOUSE_PATH&ownerId=${id}&userId=forged`,`learning/syllabi?ownerType=HOUSE_PATH&ownerId=${id}`],
  [`learning/syllabi/${id}`,`learning/syllabi/${id}`],
] as const;for(const [browserPath,corePath] of cases){const path=browserPath.split("?")[0]!;const response=await handleBoOperationalReadRequest(new Request(`https://bo.pinohouse.art/api/bo/${browserPath}`,{headers}),env(binding),path,f.resolver);assert.equal(response.status,200);assert.equal(forwarded.at(-1)?.path,corePath);}assert.ok(forwarded.every(request=>request.method==="GET"&&!Object.hasOwn(request,"resource")));});

test("Learning Syllabus writes use POST-only BO facade, replay evidence, and verified identity",async()=>{const f=await fixture(),forwarded:BoAccessRequest[]=[];const binding:BoAccessCoreBinding={async execute(request,identity){assert.equal(identity.subject,"verified-founder");forwarded.push(request);return{status:200,body:{data:{ok:true}},requestId:"core-write"};}};const cases=[
  ["learning/syllabi",{ownerType:"HOUSE_PATH",ownerId:id,code:"color",title:"Color"}],
  [`learning/syllabi/${id}/draft`,{expectedRevision:1,title:"Edited"}],
  [`learning/syllabi/${id}/publish`,{expectedRevision:2}],
  [`learning/syllabi/${id}/next-draft`,{}],
  [`learning/syllabi/${id}/archive`,{expectedRevision:1,reason:"Retired"}],
] as const;for(const [path,body] of cases){const response=await handleBoWriteRequest(new Request(`https://bo.pinohouse.art/api/bo/${path}`,{method:"POST",headers:{"cf-access-jwt-assertion":f.token,"content-type":"application/json","idempotency-key":`key-${forwarded.length}`},body:JSON.stringify(body)}),env(binding),path,f.resolver);assert.equal(response.status,200);}assert.deepEqual(forwarded.map(x=>x.path),cases.map(x=>x[0]));assert.ok(forwarded.every(x=>x.method==="POST"&&Boolean(x.idempotencyKey)));});

test("Learning Syllabus facade fails closed on missing replay evidence and preserves Core forbidden",async()=>{const f=await fixture();let called=0;const binding:BoAccessCoreBinding={async execute(){called++;return{status:403,body:{error:{code:"ACCESS_PERMISSION_DENIED",message:"Denied"}},requestId:"core-denied"};}};const missing=await handleBoWriteRequest(new Request("https://bo.pinohouse.art/api/bo/learning/syllabi",{method:"POST",headers:{"cf-access-jwt-assertion":f.token,"content-type":"application/json"},body:"{}"}),env(binding),"learning/syllabi",f.resolver);assert.equal(missing.status,400);assert.equal(called,0);const denied=await handleBoWriteRequest(new Request(`https://bo.pinohouse.art/api/bo/learning/syllabi/${id}/publish`,{method:"POST",headers:{"cf-access-jwt-assertion":f.token,"content-type":"application/json","idempotency-key":"publish"},body:'{"expectedRevision":1}'}),env(binding),`learning/syllabi/${id}/publish`,f.resolver);assert.equal(denied.status,403);assert.equal(denied.headers.get("x-request-id"),"core-denied");assert.equal(called,1);});
