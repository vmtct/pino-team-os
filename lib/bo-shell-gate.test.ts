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

test("valid BO-entitled principal is authorized by canonical Core context before shell render", async () => {
  const f = await fixture();
  const requests: BoAccessRequest[] = []; let identity: VerifiedBoIdentity | undefined;
  const binding: BoAccessCoreBinding = { async execute(request, actor) {
    requests.push(request); identity = actor;
    return context(actor);
  } };
  const result = await authorizeBoShell(f.headers, env(binding), f.resolver);
  assert.deepEqual(requests, [{ method: "GET", path: "context" }]);
  assert.equal(identity?.subject, "bo-shell-subject");
  assert.equal(result.entitled, true);
});

test("COO-style BO entitlement is accepted without Founder role proof", async () => {
  const f = await fixture(boAudience, "coo@example.com");
  const binding: BoAccessCoreBinding = { async execute(_request, actor) {
    return { status: 200, body: { data: { userId: "coo-user", email: actor.email, staffMemberId: "staff-coo", surface: "BO", entitled: true } }, requestId: "context" };
  } };
  const result = await authorizeBoShell(f.headers, env(binding), f.resolver);
  assert.equal(result.userId, "coo-user");
  assert.equal(result.staffMemberId, "staff-coo");
});

test("Core BO entitlement denial fails closed", async () => {
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
    throw new Error("unexpected second Core read");
  } };
  await assert.rejects(authorizeBoShell(f.headers, env(binding), f.resolver), (error: unknown) => error instanceof BoShellGateError && error.status === 403);
});

test("workers.dev Workforce staging identity still requires canonical BO entitlement", async () => {
  const requests: BoAccessRequest[] = []; let identity: VerifiedBoIdentity | undefined;
  const binding: BoAccessCoreBinding = { async execute(request, actor) {
    requests.push(request); identity = actor;
    return context(actor);
  } };
  const headers = new Headers({ host: "pino-team-os-staging.example.workers.dev" });
  const result = await authorizeBoShell(headers, {
    ...env(binding),
    WORKFORCE_BO_STAGING_BYPASS: "enabled",
    WORKFORCE_STAGING_BO_EMAIL: "workforce-planning-staging-probe@pino.invalid",
  });
  assert.deepEqual(requests, [{ method: "GET", path: "context" }]);
  assert.equal(identity?.subject, "workforce-planning-staging-probe-v1");
  assert.equal(result.email, "workforce-planning-staging-probe@pino.invalid");
  assert.equal(result.entitled, true);
});

test("Workforce staging shell identity cannot activate on production BO host", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const headers = new Headers({ host: "bo.pinohouse.art" });
  await assert.rejects(authorizeBoShell(headers, {
    ...env(binding),
    WORKFORCE_BO_STAGING_BYPASS: "enabled",
    WORKFORCE_STAGING_BO_EMAIL: "workforce-planning-staging-probe@pino.invalid",
  }), BoShellGateError);
  assert.equal(called, false);
});

test("Workforce staging shell identity fails closed when canonical Core denies BO", async () => {
  const binding: BoAccessCoreBinding = { async execute() {
    return { status: 403, body: { error: { code: "ACCESS_SURFACE_DENIED" } }, requestId: "denied" };
  } };
  const headers = new Headers({ host: "pino-team-os-staging.example.workers.dev" });
  await assert.rejects(authorizeBoShell(headers, {
    ...env(binding),
    WORKFORCE_BO_STAGING_BYPASS: "enabled",
    WORKFORCE_STAGING_BO_EMAIL: "workforce-planning-staging-probe@pino.invalid",
  }), (error: unknown) => error instanceof BoShellGateError && error.status === 403);
});

test("Workforce staging shell accepts OpenNext forwarded host and still calls Core context", async () => {
  let identity: VerifiedBoIdentity | undefined;
  const binding: BoAccessCoreBinding = { async execute(_request, actor) {
    identity = actor;
    return context(actor);
  } };
  const headers = new Headers({ "x-forwarded-host": "pino-team-os-staging.example.workers.dev" });
  const result = await authorizeBoShell(headers, {
    ...env(binding),
    WORKFORCE_BO_STAGING_BYPASS: "enabled",
    WORKFORCE_STAGING_BO_EMAIL: "workforce-planning-staging-probe@pino.invalid",
  });
  assert.equal(identity?.subject, "workforce-planning-staging-probe-v1");
  assert.equal(result.entitled, true);
});
