import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { handleBoStaffOnboardingRequest, type BoWriteEnv } from "./bo-write-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";
import type { VerifiedBoIdentity } from "./bo-auth";

const domain = "team.cloudflareaccess.com";
const audience = "bo-audience";
const path = "workforce/staff-onboarding";

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "bo-write-handler";
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT({ email: "founder@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "bo-write-handler" })
    .setIssuer(`https://${domain}`)
    .setAudience(audience)
    .setSubject("verified-founder-subject")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  return { resolver, token };
}

function request(token?: string, options: { method?: string; idempotencyKey?: string; body?: string } = {}) {
  const headers: Record<string, string> = {};
  if (token) headers["cf-access-jwt-assertion"] = token;
  if (options.idempotencyKey) headers["idempotency-key"] = options.idempotencyKey;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  return new Request(`https://bo.pinohouse.art/api/bo/${path}?email=attacker@example.com&userId=forged`, {
    method: options.method ?? "POST",
    headers,
    ...(options.body === undefined ? {} : { body: options.body }),
  });
}

function env(binding: BoAccessCoreBinding): BoWriteEnv {
  return { PINO_BO_CORE: binding, CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_BO_AUD: audience };
}

const onboardingBody = {
  commandType: "ONBOARD_STAFF_WITH_ACCESS",
  staff: { displayLabel: "Staff A" },
  email: "staff@example.com",
  assignments: [{ roleId: "00000000-0000-7000-8000-000000000001", scopeType: "GLOBAL", scopeId: null }],
};

test("BO onboarding facade forwards only the bounded POST command, body, idempotency key, and verified identity", async () => {
  const f = await fixture();
  const forwarded: Array<{ request: BoAccessRequest; identity: VerifiedBoIdentity }> = [];
  const binding: BoAccessCoreBinding = {
    async execute(coreRequest, identity) {
      forwarded.push({ request: coreRequest, identity });
      return { status: 201, body: { data: { staffMemberId: "00000000-0000-7000-8000-000000000010" } }, requestId: "core-created" };
    },
  };

  const response = await handleBoStaffOnboardingRequest(
    request(f.token, { idempotencyKey: "command-1", body: JSON.stringify(onboardingBody) }),
    env(binding),
    path,
    f.resolver,
  );

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-request-id"), "core-created");
  assert.equal(forwarded.length, 1);
  assert.deepEqual(forwarded[0]!.request, { method: "POST", path, body: onboardingBody, idempotencyKey: "command-1" });
  assert.equal(forwarded[0]!.identity.subject, "verified-founder-subject");
  assert.equal(forwarded[0]!.identity.email, "founder@example.com");
});

test("missing BO Access identity fails before Core", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const response = await handleBoStaffOnboardingRequest(
    request(undefined, { idempotencyKey: "command-1", body: JSON.stringify(onboardingBody) }),
    env(binding),
    path,
  );
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("missing idempotency key and invalid JSON fail without calling Core", async () => {
  const f = await fixture();
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const [missingKey, invalidJson] = await Promise.all([
    handleBoStaffOnboardingRequest(request(f.token, { body: JSON.stringify(onboardingBody) }), env(binding), path, f.resolver),
    handleBoStaffOnboardingRequest(request(f.token, { idempotencyKey: "command-2", body: "{" }), env(binding), path, f.resolver),
  ]);
  assert.equal(missingKey.status, 400);
  assert.equal(invalidJson.status, 400);
  assert.equal(called, false);
});

test("unknown write paths and non-POST methods fail without calling Core", async () => {
  const f = await fixture();
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const [unknown, wrongMethod] = await Promise.all([
    handleBoStaffOnboardingRequest(request(f.token, { idempotencyKey: "command-3", body: "{}" }), env(binding), "access/users", f.resolver),
    handleBoStaffOnboardingRequest(request(f.token, { method: "GET" }), env(binding), path, f.resolver),
  ]);
  assert.equal(unknown.status, 404);
  assert.equal(wrongMethod.status, 405);
  assert.equal(called, false);
});

test("Core authorization failure and request ID pass through unchanged", async () => {
  const f = await fixture();
  const binding: BoAccessCoreBinding = {
    async execute() {
      return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED", message: "This action is not permitted" } }, requestId: "core-denied" };
    },
  };
  const response = await handleBoStaffOnboardingRequest(
    request(f.token, { idempotencyKey: "command-4", body: JSON.stringify(onboardingBody) }),
    env(binding),
    path,
    f.resolver,
  );
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-request-id"), "core-denied");
  assert.equal((await response.json() as { error: { code: string } }).error.code, "ACCESS_PERMISSION_DENIED");
});
