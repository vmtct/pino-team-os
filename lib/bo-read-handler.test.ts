import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { handleBoOperationalReadRequest, type BoReadEnv } from "./bo-read-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";
import type { VerifiedBoIdentity } from "./bo-auth";

const domain = "team.cloudflareaccess.com";
const audience = "bo-audience";

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "bo-read-handler";
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT({ email: "founder@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "bo-read-handler" })
    .setIssuer(`https://${domain}`)
    .setAudience(audience)
    .setSubject("verified-founder-subject")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  return { resolver, token };
}

function request(path: string, token?: string, method = "GET") {
  return new Request(`https://bo.pinohouse.art/api/bo/${path}?email=attacker@example.com&userId=forged&staffMemberId=forged&username=founder`, {
    method,
    headers: token ? { "cf-access-jwt-assertion": token } : {},
  });
}

function env(binding: BoAccessCoreBinding): BoReadEnv {
  return { PINO_BO_CORE: binding, CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_BO_AUD: audience };
}

test("BO operational facade forwards only exact GET paths and the verified identity", async () => {
  const f = await fixture();
  const forwarded: Array<{ request: BoAccessRequest; identity: VerifiedBoIdentity }> = [];
  const binding: BoAccessCoreBinding = {
    async execute(coreRequest, identity) {
      forwarded.push({ request: coreRequest, identity });
      return { status: 200, body: { data: [] }, requestId: `request-${forwarded.length}` };
    },
  };
  const paths = ["delivery/bootstrap-state", "path-programs", "running-classes", "syllabi", "sessions", "workforce/staff-records/0198d050-56c1-7ac5-b9ab-b0e45d912345", "sessions/0198d050-56c1-7ac5-b9ab-b0e45d912345/registrations", "sessions/0198d050-56c1-7ac5-b9ab-b0e45d912345/learning-owner"];

  const responses = await Promise.all(paths.map((path) => handleBoOperationalReadRequest(request(path, f.token), env(binding), path, f.resolver)));

  assert.deepEqual(
    forwarded.map((item) => item.request).sort((left, right) => left.path.localeCompare(right.path)),
    paths.map((path) => ({ method: "GET", path })).sort((left, right) => left.path.localeCompare(right.path)),
  );
  assert.ok(forwarded.every((item) => item.identity.subject === "verified-founder-subject" && item.identity.email === "founder@example.com"));
  assert.ok(forwarded.every((item) => !Object.hasOwn(item.request, "body") && !Object.hasOwn(item.request, "resource")));
  assert.ok(responses.every((response) => response.status === 200 && response.headers.get("cache-control") === "no-store" && response.headers.get("x-request-id")));
});

test("missing BO Access identity fails before Core", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };

  const response = await handleBoOperationalReadRequest(request("sessions"), env(binding), "sessions");

  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("Core authorization denial and request ID pass through unchanged", async () => {
  const f = await fixture();
  const binding: BoAccessCoreBinding = {
    async execute() {
      return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED", message: "This action is not permitted" } }, requestId: "core-denied" };
    },
  };

  const response = await handleBoOperationalReadRequest(request("running-classes", f.token), env(binding), "running-classes", f.resolver);

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-request-id"), "core-denied");
  assert.equal((await response.json() as { error: { code: string } }).error.code, "ACCESS_PERMISSION_DENIED");
});

test("unknown routes and every non-read method fail without calling Core", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const f = await fixture();

  const [unknown, mutation] = await Promise.all([
    handleBoOperationalReadRequest(request("bookings", f.token), env(binding), "bookings", f.resolver),
    handleBoOperationalReadRequest(request("sessions", f.token, "POST"), env(binding), "sessions", f.resolver),
  ]);

  assert.equal(unknown.status, 404);
  assert.equal(mutation.status, 405);
  assert.equal(called, false);
});

test("Learner directory query and lifecycle detail stay on the private BO read contract", async () => {
  const f = await fixture();
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async execute(coreRequest) { forwarded.push(coreRequest); return { status: 200, body: { data: [] }, requestId: "core-learners" }; } };
  const learnerRequest = new Request("https://bo.pinohouse.art/api/bo/learners?query=Mai&limit=20&userId=forged", { headers: { "cf-access-jwt-assertion": f.token } });
  const learner = await handleBoOperationalReadRequest(learnerRequest, env(binding), "learners", f.resolver);
  const studentId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
  const lifecycle = await handleBoOperationalReadRequest(request(`students/${studentId}/lifecycle`, f.token), env(binding), `students/${studentId}/lifecycle`, f.resolver);
  assert.equal(learner.status, 200);
  assert.equal(lifecycle.status, 200);
  assert.deepEqual(forwarded, [
    { method: "GET", path: "learners", body: { query: "Mai", limit: 20 } },
    { method: "GET", path: `students/${studentId}/lifecycle` },
  ]);
});
