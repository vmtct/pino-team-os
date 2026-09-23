import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { handleFounderFacadeRequest, type FounderFacadeEnv } from "./founder-facade-handler";
import type { FounderRequest, FounderVerifiedIdentity, PinoCoreBinding } from "./founder-core";

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

test("Founder facade BO Cloudflare session uses canonical BO audience and reaches Core", async () => {
  const { jwt, keyResolver } = await jwtFixture(boAudience);
  let seenRequest: FounderRequest | undefined;
  let seenIdentity: FounderVerifiedIdentity | undefined;
  const binding: PinoCoreBinding = {
    async execute(request, identity) {
      seenRequest = request;
      seenIdentity = identity;
      return { status: 200, body: { data: [] }, requestId: "bo-founder" };
    },
    async executeWithStaffPassword() { throw new Error("unexpected password path"); },
  };
  const request = new Request("https://bo.pinohouse.art/api/founder/ai/change-sets", {
    headers: { "cf-access-jwt-assertion": jwt },
  });
  const response = await handleFounderFacadeRequest(request, env(binding), ["ai", "change-sets"], keyResolver);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "bo-founder");
  assert.deepEqual(seenRequest, { method: "GET", path: "/ai/change-sets", body: undefined, idempotencyKey: undefined });
  assert.equal(seenIdentity?.subject, "founder-subject");
  assert.deepEqual(seenIdentity?.audience, [boAudience]);
});

test("Founder facade BO rejects a TOS-audience Cloudflare assertion before Core", async () => {
  const { jwt, keyResolver } = await jwtFixture(tosAudience);
  let called = false;
  const binding: PinoCoreBinding = {
    async execute() { called = true; throw new Error("unexpected Core call"); },
    async executeWithStaffPassword() { called = true; throw new Error("unexpected password call"); },
  };
  const request = new Request("https://bo.pinohouse.art/api/founder/ai/change-sets", {
    headers: { "cf-access-jwt-assertion": jwt },
  });
  const response = await handleFounderFacadeRequest(request, env(binding), ["ai", "change-sets"], keyResolver);
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("Founder facade TOS Cloudflare session preserves canonical TOS audience", async () => {
  const { jwt, keyResolver } = await jwtFixture(tosAudience);
  let seenIdentity: FounderVerifiedIdentity | undefined;
  const binding: PinoCoreBinding = {
    async execute(_request, identity) {
      seenIdentity = identity;
      return { status: 200, body: { data: {} }, requestId: "tos-founder" };
    },
    async executeWithStaffPassword() { throw new Error("unexpected password path"); },
  };
  const request = new Request("https://tos.pinohouse.art/api/founder/running-classes", {
    headers: { "cf-access-jwt-assertion": jwt },
  });
  const response = await handleFounderFacadeRequest(request, env(binding), ["running-classes"], keyResolver);
  assert.equal(response.status, 200);
  assert.deepEqual(seenIdentity?.audience, [tosAudience]);
});



test("Founder facade normalizes trailing-dot BO host before audience selection", async () => {
  const valid = await jwtFixture(boAudience);
  const wrong = await jwtFixture(tosAudience);
  let calls = 0;
  const binding: PinoCoreBinding = {
    async execute() { calls++; return { status: 200, body: { data: [] }, requestId: "bo-trailing-dot" }; },
    async executeWithStaffPassword() { throw new Error("unexpected password path"); },
  };
  const good = await handleFounderFacadeRequest(new Request("https://bo.pinohouse.art./api/founder/ai/change-sets", {
    headers: { host: "bo.pinohouse.art.", "cf-access-jwt-assertion": valid.jwt },
  }), env(binding), ["ai", "change-sets"], valid.keyResolver);
  assert.equal(good.status, 200);
  assert.equal(calls, 1);
  const denied = await handleFounderFacadeRequest(new Request("https://bo.pinohouse.art./api/founder/ai/change-sets", {
    headers: { host: "bo.pinohouse.art.", "cf-access-jwt-assertion": wrong.jwt },
  }), env(binding), ["ai", "change-sets"], wrong.keyResolver);
  assert.equal(denied.status, 401);
  assert.equal(calls, 1);
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

