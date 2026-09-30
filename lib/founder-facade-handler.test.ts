import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { handleFounderFacadeRequest, type FounderFacadeEnv } from "./founder-facade-handler";
import type { PinoCoreBinding } from "./founder-core";

const domain = "team.pino.invalid";
const boAudience = "bo-aud";
const tosAudience = "tos-aud";

async function jwtFixture(audience: string) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwt = await new SignJWT({ email: "founder@pino.invalid" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(`https://${domain}`)
    .setAudience(audience)
    .setSubject("founder-subject")
    .setExpirationTime("2h")
    .sign(privateKey);
  const keyResolver: JWTVerifyGetKey = async () => publicKey;
  return { jwt, keyResolver };
}

function env(binding: PinoCoreBinding): FounderFacadeEnv {
  return {
    PINO_CORE: binding,
    CF_ACCESS_TEAM_DOMAIN: domain,
    CF_ACCESS_BO_AUD: boAudience,
    CF_ACCESS_TOS_AUD: tosAudience,
  };
}

test("Founder facade rejects Cloudflare-only BO access before Core", async () => {
  const { jwt, keyResolver } = await jwtFixture(boAudience);
  let called = false;
  const binding: PinoCoreBinding = {
    async execute() { called = true; throw new Error("unexpected compatibility call"); },
    async executeWithStaffPassword() { called = true; throw new Error("unexpected password call"); },
  };
  const request = new Request("https://bo.pinohouse.art/api/founder/ai/change-sets", {
    headers: { "cf-access-jwt-assertion": jwt },
  });
  const response = await handleFounderFacadeRequest(request, env(binding), ["ai", "change-sets"], keyResolver);
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("Founder facade rejects Cloudflare-only TOS access before Core", async () => {
  const { jwt, keyResolver } = await jwtFixture(tosAudience);
  let called = false;
  const binding: PinoCoreBinding = {
    async execute() { called = true; throw new Error("unexpected compatibility call"); },
    async executeWithStaffPassword() { called = true; throw new Error("unexpected password call"); },
  };
  const request = new Request("https://tos.pinohouse.art/api/founder/running-classes", {
    headers: { "cf-access-jwt-assertion": jwt },
  });
  const response = await handleFounderFacadeRequest(request, env(binding), ["running-classes"], keyResolver);
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("Founder facade keeps local-password compatibility independent of Cloudflare audience", async () => {
  let password = "";
  const binding: PinoCoreBinding = {
    async executeWithStaffPassword(request, token) {
      password = token;
      assert.equal(request.path, "/ai/change-sets");
      return { status: 200, body: { data: [] }, requestId: "password-founder" };
    },
  };
  const request = new Request("https://bo.pinohouse.art/api/founder/ai/change-sets", {
    headers: { cookie: "pino_staff_password_session=local-founder" },
  });
  const response = await handleFounderFacadeRequest(request, env(binding), ["ai", "change-sets"]);
  assert.equal(response.status, 200);
  assert.equal(password, "local-founder");
});

