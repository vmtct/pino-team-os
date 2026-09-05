import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { authenticateTeam, teamCredential, TeamAuthError } from "./team-auth";

const domain="team.pino.invalid", tosAudience="tos-aud";
async function fixture(audience=tosAudience,email="Staff@PINO.INVALID"){
  const {privateKey,publicKey}=await generateKeyPair("RS256");
  const jwt=await new SignJWT({email}).setProtectedHeader({alg:"RS256"}).setIssuer(`https://${domain}`).setAudience(audience).setSubject("cf-subject-1").setExpirationTime("2h").sign(privateKey);
  const keyResolver:JWTVerifyGetKey=async()=>publicKey;
  return {jwt,keyResolver};
}

test("password session takes precedence without Cloudflare config",async()=>{
  const request=new Request("https://tos.pinohouse.art/api/workforce/context",{headers:{cookie:"pino_staff_password_session=local-token"}});
  assert.deepEqual(await teamCredential(request,{},"TOS"),{kind:"password",token:"local-token"});
});

test("Cloudflare verifier checks issuer/audience and normalizes email",async()=>{
  const {jwt,keyResolver}=await fixture();
  const identity=await authenticateTeam(new Headers({"cf-access-jwt-assertion":jwt}),{CF_ACCESS_TEAM_DOMAIN:domain,CF_ACCESS_TOS_AUD:tosAudience},"TOS",keyResolver);
  assert.equal(identity.provider,"cloudflare_access");assert.equal(identity.subject,"cf-subject-1");assert.equal(identity.email,"staff@pino.invalid");assert.deepEqual(identity.audience,[tosAudience]);
});

test("Cloudflare verifier fails closed",async()=>{
  const {jwt,keyResolver}=await fixture("wrong-aud");
  await assert.rejects(()=>authenticateTeam(new Headers({"cf-access-jwt-assertion":jwt}),{CF_ACCESS_TEAM_DOMAIN:domain,CF_ACCESS_TOS_AUD:tosAudience},"TOS",keyResolver),(e:unknown)=>e instanceof TeamAuthError&&e.status===401);
  await assert.rejects(()=>authenticateTeam(new Headers(),{CF_ACCESS_TEAM_DOMAIN:domain,CF_ACCESS_TOS_AUD:tosAudience},"TOS"),(e:unknown)=>e instanceof TeamAuthError&&e.status===401);
  await assert.rejects(()=>authenticateTeam(new Headers({"cf-access-jwt-assertion":jwt}),{},"TOS",keyResolver),(e:unknown)=>e instanceof TeamAuthError&&e.status===503);
});
