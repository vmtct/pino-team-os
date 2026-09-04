import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { handleBoOperationalReadRequest, isPracticeReadPath, type BoReadEnv } from "./bo-read-handler";
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
  const paths = ["delivery/bootstrap-state", "path-programs", "running-classes", "syllabi", "practice/resources", "practice/resources/0198d050-56c1-7ac5-b9ab-b0e45d912345", "sessions", "workforce/staff-registration-settings", "workforce/staff-registration-requests", "workforce/staff-records/0198d050-56c1-7ac5-b9ab-b0e45d912345", "sessions/0198d050-56c1-7ac5-b9ab-b0e45d912345/registrations", "sessions/0198d050-56c1-7ac5-b9ab-b0e45d912345/learning-owner"];

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
  const learnerRequest = new Request("https://bo.pinohouse.art/api/bo/learners?query=Mai&limit=20&offset=200&userId=forged", { headers: { "cf-access-jwt-assertion": f.token } });
  const learner = await handleBoOperationalReadRequest(learnerRequest, env(binding), "learners", f.resolver);
  const studentId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
  const lifecycle = await handleBoOperationalReadRequest(request(`students/${studentId}/lifecycle`, f.token), env(binding), `students/${studentId}/lifecycle`, f.resolver);
  assert.equal(learner.status, 200);
  assert.equal(lifecycle.status, 200);
  assert.deepEqual(forwarded, [
    { method: "GET", path: "learners", body: { query: "Mai", limit: 20, offset: 200 } },
    { method: "GET", path: `students/${studentId}/lifecycle` },
  ]);
});

test("Open Studio operational reads forward only canonical query fields", async () => {
  const f = await fixture();
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async execute(coreRequest) { forwarded.push(coreRequest); return { status: 200, body: { data: {} }, requestId: "core-open-studio-read" }; } };
  const centerId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
  const passId = "0198d050-56c1-7ac5-b9ab-b0e45d912346";
  const listingId = "0198d050-56c1-7ac5-b9ab-b0e45d912347";
  const operationsRequest = new Request(`https://bo.pinohouse.art/api/bo/open-studio/operations?centerId=${centerId}&userId=forged`, { headers: { "cf-access-jwt-assertion": f.token } });
  const eligibilityRequest = new Request(`https://bo.pinohouse.art/api/bo/open-studio/passes/${passId}/claim-eligibility?listingId=${listingId}&participantMode=OWNER&studentProfileId=${centerId}&effectiveAt=2026-08-30T12%3A00%3A00.000Z&userId=forged`, { headers: { "cf-access-jwt-assertion": f.token } });
  assert.equal((await handleBoOperationalReadRequest(operationsRequest, env(binding), "open-studio/operations", f.resolver)).status, 200);
  assert.equal((await handleBoOperationalReadRequest(eligibilityRequest, env(binding), `open-studio/passes/${passId}/claim-eligibility`, f.resolver)).status, 200);
  assert.deepEqual(forwarded, [
    { method: "GET", path: "open-studio/operations", body: { centerId } },
    { method: "GET", path: `open-studio/passes/${passId}/claim-eligibility`, body: { listingId, participantMode: "OWNER", studentProfileId: centerId, effectiveAt: "2026-08-30T12:00:00.000Z" } },
  ]);
});
test("workers.dev Workforce staging identity can read allowlisted BO operations through canonical Core", async () => {
  let identity: VerifiedBoIdentity | undefined;
  const binding: BoAccessCoreBinding = { async execute(coreRequest, actor) {
    identity = actor;
    assert.deepEqual(coreRequest, { method: "GET", path: "delivery/bootstrap-state" });
    return { status: 200, body: { data: { centers: [], terms: [], termWeeks: [] } }, requestId: "staging-bootstrap" };
  } };
  const stagingRequest = new Request("https://pino-team-os-staging.example.workers.dev/api/bo/delivery/bootstrap-state");
  const response = await handleBoOperationalReadRequest(stagingRequest, {
    ...env(binding),
    WORKFORCE_BO_STAGING_BYPASS: "enabled",
    WORKFORCE_STAGING_BO_EMAIL: "workforce-planning-staging-probe@pino.invalid",
  }, "delivery/bootstrap-state");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "staging-bootstrap");
  assert.equal(identity?.subject, "workforce-planning-staging-probe-v1");
  assert.equal(identity?.email, "workforce-planning-staging-probe@pino.invalid");
});



test("WFM-ONB protected reads never inherit the Workforce workers.dev staging identity", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const stagedEnv: BoReadEnv = {
    ...env(binding),
    WORKFORCE_BO_STAGING_BYPASS: "enabled",
    WORKFORCE_STAGING_BO_EMAIL: "workforce-planning-staging-probe@pino.invalid",
  };
  for (const protectedPath of ["workforce/staff-registration-settings", "workforce/staff-registration-requests"]) {
    const stagedRequest = new Request(`https://pino-team-os-staging.example.workers.dev/api/bo/${protectedPath}`);
    const response = await handleBoOperationalReadRequest(stagedRequest, stagedEnv, protectedPath);
    assert.equal(response.status, 401, protectedPath);
  }
  assert.equal(called, false);
});

test("Workforce staging BO read identity cannot activate on production host", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const response = await handleBoOperationalReadRequest(request("delivery/bootstrap-state"), {
    ...env(binding),
    WORKFORCE_BO_STAGING_BYPASS: "enabled",
    WORKFORCE_STAGING_BO_EMAIL: "workforce-planning-staging-probe@pino.invalid",
  }, "delivery/bootstrap-state");
  assert.equal(response.status, 401);
  assert.equal(called, false);
});


test("Open Studio policy reads expose only target and effective-time query fields", async () => {
  const f = await fixture();
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async execute(coreRequest) { forwarded.push(coreRequest); return { status: 200, body: { data: {} }, requestId: "core-open-studio-policy-read" }; } };
  const centerId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
  const streamPath = "policies/open_studio/monthly_path_pass.v1/stream";
  const effectivePath = "policies/open_studio/cancellation.v1/effective";
  const streamRequest = new Request(`https://bo.pinohouse.art/api/bo/${streamPath}?targetType=CENTER&targetId=${centerId}&userId=forged`, { headers: { "cf-access-jwt-assertion": f.token } });
  const effectiveRequest = new Request(`https://bo.pinohouse.art/api/bo/${effectivePath}?targetType=GLOBAL&targetId=forged&effectiveAt=2026-08-30T13%3A00%3A00.000Z&email=attacker`, { headers: { "cf-access-jwt-assertion": f.token } });
  assert.equal((await handleBoOperationalReadRequest(streamRequest, env(binding), streamPath, f.resolver)).status, 200);
  assert.equal((await handleBoOperationalReadRequest(effectiveRequest, env(binding), effectivePath, f.resolver)).status, 200);
  assert.deepEqual(forwarded, [
    { method: "GET", path: streamPath, body: { targetType: "CENTER", targetId: centerId } },
    { method: "GET", path: effectivePath, body: { targetType: "GLOBAL", targetId: null, effectiveAt: "2026-08-30T13:00:00.000Z" } },
  ]);
});

test("Open Studio config dependencies use dedicated canonical read paths", async () => {
  const f = await fixture();
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async execute(coreRequest) { forwarded.push(coreRequest); return { status: 200, body: { data: {} }, requestId: "open-studio-config-read" }; } };
  const centerId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
  const studentId = "0198d050-56c1-7ac5-b9ab-b0e45d912346";
  const catalogRequest = new Request(`https://bo.pinohouse.art/api/bo/open-studio/listing-catalog?centerId=${centerId}&effectiveAt=2026-08-30T15%3A00%3A00.000Z&userId=forged`, { headers: { "cf-access-jwt-assertion": f.token } });
  const learnersRequest = new Request("https://bo.pinohouse.art/api/bo/open-studio/learners?query=Mai&limit=20&email=forged", { headers: { "cf-access-jwt-assertion": f.token } });
  assert.equal((await handleBoOperationalReadRequest(catalogRequest, env(binding), "open-studio/listing-catalog", f.resolver)).status, 200);
  assert.equal((await handleBoOperationalReadRequest(learnersRequest, env(binding), "open-studio/learners", f.resolver)).status, 200);
  assert.equal((await handleBoOperationalReadRequest(request(`open-studio/students/${studentId}/lifecycle`, f.token), env(binding), `open-studio/students/${studentId}/lifecycle`, f.resolver)).status, 200);
  assert.deepEqual(forwarded, [
    { method: "GET", path: "open-studio/listing-catalog", body: { centerId, effectiveAt: "2026-08-30T15:00:00.000Z" } },
    { method: "GET", path: "open-studio/learners", body: { query: "Mai", limit: 20 } },
    { method: "GET", path: `open-studio/students/${studentId}/lifecycle` },
  ]);
});

test("workers.dev Open Studio BO reads use the dedicated staging principal", async () => {
  let identity: VerifiedBoIdentity | undefined;
  const binding: BoAccessCoreBinding = { async execute(coreRequest, actor) {
    identity = actor;
    assert.deepEqual(coreRequest, { method: "GET", path: "open-studio/operations" });
    return { status: 200, body: { data: { listings: [] } }, requestId: "open-studio-staging-read" };
  } };
  const stagingRequest = new Request("https://pino-team-os-staging.example.workers.dev/api/bo/open-studio/operations");
  const response = await handleBoOperationalReadRequest(stagingRequest, {
    ...env(binding),
    OPEN_STUDIO_BO_STAGING_BYPASS: "enabled",
    OPEN_STUDIO_STAGING_BO_EMAIL: "open-studio-control-loop-staging-probe@pino.invalid",
  }, "open-studio/operations");
  assert.equal(response.status, 200);
  assert.equal(identity?.subject, "open-studio-control-loop-staging-probe-v1");
  assert.equal(identity?.email, "open-studio-control-loop-staging-probe@pino.invalid");
});

test("Open Studio staging identity is not reused for non-Open-Studio BO reads", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const stagingRequest = new Request("https://pino-team-os-staging.example.workers.dev/api/bo/delivery/bootstrap-state");
  const response = await handleBoOperationalReadRequest(stagingRequest, {
    ...env(binding),
    OPEN_STUDIO_BO_STAGING_BYPASS: "enabled",
    OPEN_STUDIO_STAGING_BO_EMAIL: "open-studio-control-loop-staging-probe@pino.invalid",
  }, "delivery/bootstrap-state");
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("Practice reads never inherit the Workforce workers.dev staging identity", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const practiceRequest = new Request("https://pino-team-os-staging.example.workers.dev/api/bo/practice/resources");
  const response = await handleBoOperationalReadRequest(practiceRequest, {
    ...env(binding),
    WORKFORCE_BO_STAGING_BYPASS: "enabled",
    WORKFORCE_STAGING_BO_EMAIL: "workforce-planning-staging-probe@pino.invalid",
  }, "practice/resources");
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("Practice read allowlist includes only bounded F1 access projections", () => {
  assert.equal(isPracticeReadPath("practice/repertoire-access/context"), true);
  assert.equal(isPracticeReadPath("practice/repertoire-access"), true);
  assert.equal(isPracticeReadPath("practice/repertoire-access/grants"), false);
});
