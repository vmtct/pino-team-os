import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { handleBoContextRequest, type BoContextEnv } from "./bo-context-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";
import type { VerifiedBoIdentity } from "./bo-auth";

const domain = "team.cloudflareaccess.com";
const audience = "bo-audience";

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "bo-handler";
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT({ email: "bo.user@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "bo-handler" })
    .setIssuer(`https://${domain}`)
    .setAudience(audience)
    .setSubject("canonical-bo-subject")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  return { resolver, token };
}

function request(token?: string) {
  return new Request("https://bo.pinohouse.art/api/bo/context?userId=forged&staffMemberId=forged", {
    headers: token ? { "cf-access-jwt-assertion": token } : {},
  });
}

function env(binding: BoAccessCoreBinding): BoContextEnv {
  return { PINO_BO_CORE: binding, CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_BO_AUD: audience };
}

test("BO context forwards only GET context and the verified identity to PINO_BO_CORE", async () => {
  const f = await fixture();
  let forwardedRequest: BoAccessRequest | undefined;
  let forwardedIdentity: VerifiedBoIdentity | undefined;
  const binding: BoAccessCoreBinding = {
    async execute(coreRequest, identity) {
      forwardedRequest = coreRequest;
      forwardedIdentity = identity;
      return {
        status: 200,
        body: { data: { userId: "canonical-user", email: identity.email, staffMemberId: null, surface: "BO", entitled: true } },
        requestId: "bo-request-id",
      };
    },
  };

  const response = await handleBoContextRequest(request(f.token), env(binding), f.resolver);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "bo-request-id");
  assert.deepEqual(forwardedRequest, { method: "GET", path: "context" });
  assert.equal(forwardedIdentity?.subject, "canonical-bo-subject");
  assert.equal(forwardedIdentity?.email, "bo.user@example.com");
  assert.equal(Object.hasOwn(forwardedRequest ?? {}, "body"), false);
  assert.equal(Object.hasOwn(forwardedRequest ?? {}, "resource"), false);
});

test("BO context fails before Core when the Access assertion is missing", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const response = await handleBoContextRequest(request(), env(binding));
  assert.equal(response.status, 401);
  assert.equal(called, false);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "IDENTITY_AUTHENTICATION_FAILED");
});

test("Core BO entitlement denial propagates without local permission fallback", async () => {
  const f = await fixture();
  const binding: BoAccessCoreBinding = {
    async execute() {
      return {
        status: 403,
        body: { error: { code: "ACCESS_SURFACE_DENIED", message: "Access to this PINO Team surface is denied" } },
        requestId: "denied-request-id",
      };
    },
  };
  const response = await handleBoContextRequest(request(f.token), env(binding), f.resolver);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-request-id"), "denied-request-id");
  assert.equal((await response.json() as { error: { code: string } }).error.code, "ACCESS_SURFACE_DENIED");
});

test("the Team OS BO facade exposes no feature operation", async () => {
  const f = await fixture();
  const paths: string[] = [];
  const binding: BoAccessCoreBinding = {
    async execute(coreRequest) {
      paths.push(`${coreRequest.method} ${coreRequest.path}`);
      return { status: 200, body: { data: { entitled: true } }, requestId: "request" };
    },
  };
  await handleBoContextRequest(request(f.token), env(binding), f.resolver);
  assert.deepEqual(paths, ["GET context"]);
});

test("workers.dev BO context uses the bounded Workforce staging shell principal", async () => {
  let identity: VerifiedBoIdentity | undefined;
  const binding: BoAccessCoreBinding = { async execute(coreRequest, actor) {
    identity = actor;
    assert.deepEqual(coreRequest, { method: "GET", path: "context" });
    return { status: 200, body: { data: { userId: "staging", email: actor.email, staffMemberId: null, surface: "BO", entitled: true } }, requestId: "staging-context" };
  } };
  const stagingRequest = new Request("https://pino-team-os-staging.example.workers.dev/api/bo/context");
  const response = await handleBoContextRequest(stagingRequest, {
    ...env(binding),
    WORKFORCE_BO_STAGING_BYPASS: "enabled",
    WORKFORCE_STAGING_BO_EMAIL: "workforce-planning-staging-probe@pino.invalid",
  });
  assert.equal(response.status, 200);
  assert.equal(identity?.subject, "workforce-planning-staging-probe-v1");
  assert.equal(identity?.email, "workforce-planning-staging-probe@pino.invalid");
});
