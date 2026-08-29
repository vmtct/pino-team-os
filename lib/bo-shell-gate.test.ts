import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { authorizeBoShell, BoShellGateError, type BoShellGateEnv } from "./bo-shell-gate";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";
import type { VerifiedBoIdentity } from "./bo-auth";

const domain = "team.cloudflareaccess.com";
const boAudience = "bo-audience";
const tosAudience = "tos-audience";

async function fixture(audience = boAudience, email = "founder@example.com") {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey); jwk.kid = "bo-shell";
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT({ email }).setProtectedHeader({ alg: "RS256", kid: "bo-shell" })
    .setIssuer(`https://${domain}`).setAudience(audience).setSubject("bo-shell-subject").setIssuedAt().setExpirationTime("5m").sign(privateKey);
  return { resolver, headers: new Headers({ "cf-access-jwt-assertion": token }) };
}

function env(binding: BoAccessCoreBinding): BoShellGateEnv {
  return { PINO_BO_CORE: binding, CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_BO_AUD: boAudience };
}
function context(identity: VerifiedBoIdentity) {
  return { status: 200, body: { data: { userId: "founder-user", email: identity.email, staffMemberId: null, surface: "BO", entitled: true } }, requestId: "context" };
}

function users(roleKey = "founder") {
  return { status: 200, body: { data: [{ id: "founder-user", status: "active", email: "founder@example.com", assignments: [{ roleKey, scopeType: "GLOBAL", scopeId: null, effectiveFrom: "2025-01-01T00:00:00.000Z", effectiveUntil: null }] }] }, requestId: "users" };
}

test("valid Founder must receive BO context and active canonical Founder proof before shell render", async () => {
  const f = await fixture();
  const requests: BoAccessRequest[] = []; let identity: VerifiedBoIdentity | undefined;
  const binding: BoAccessCoreBinding = { async execute(request, actor) {
    requests.push(request); identity = actor;
    return request.path === "context" ? context(actor) : users();
  } };
  const result = await authorizeBoShell(f.headers, env(binding), f.resolver);
  assert.deepEqual(requests, [{ method: "GET", path: "context" }, { method: "GET", path: "access/users" }]);
  assert.equal(identity?.subject, "bo-shell-subject");
  assert.equal(result.entitled, true);
});
test("BO-entitled non-Founder is denied even if Cloudflare admitted the identity", async () => {
  const f = await fixture();
  const binding: BoAccessCoreBinding = { async execute(request, actor) { return request.path === "context" ? context(actor) : users("bo-operator"); } };
  await assert.rejects(authorizeBoShell(f.headers, env(binding), f.resolver), (error: unknown) => error instanceof BoShellGateError && error.status === 403);
});

test("Core BO entitlement denial fails before Founder proof", async () => {
  const f = await fixture(); let calls = 0;
  const binding: BoAccessCoreBinding = { async execute() { calls += 1; return { status: 403, body: { error: { code: "ACCESS_SURFACE_DENIED" } }, requestId: "denied" }; } };
  await assert.rejects(authorizeBoShell(f.headers, env(binding), f.resolver), (error: unknown) => error instanceof BoShellGateError && error.status === 403);
  assert.equal(calls, 1);
});

test("TOS audience is rejected before canonical BO authorization", async () => {
  const f = await fixture(tosAudience); let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  await assert.rejects(authorizeBoShell(f.headers, env(binding), f.resolver), BoShellGateError);
  assert.equal(called, false);
});
test("Core outage fails the BO shell gate closed", async () => {
  const f = await fixture();
  const binding: BoAccessCoreBinding = { async execute() { throw new Error("core unavailable"); } };
  await assert.rejects(authorizeBoShell(f.headers, env(binding), f.resolver), (error: unknown) => error instanceof BoShellGateError && error.status === 503);
});

test("malformed successful Core projection cannot authorize the BO shell", async () => {
  const f = await fixture();
  const binding: BoAccessCoreBinding = { async execute(request, actor) {
    if (request.path === "context") return { ...context(actor), body: { data: { userId: "founder-user", email: "other@example.com", surface: "BO", entitled: true } } };
    return users();
  } };
  await assert.rejects(authorizeBoShell(f.headers, env(binding), f.resolver), (error: unknown) => error instanceof BoShellGateError && error.status === 403);
});
