import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  handleBoWorkforcePlanningRequest,
  type BoWorkforcePlanningEnv,
  type WorkforcePlanningCoreBinding,
  type WorkforcePlanningRequest,
} from "./bo-workforce-planning-handler";
import type { VerifiedBoIdentity } from "./bo-auth";

const domain = "team.cloudflareaccess.com";
const audience = "bo-audience";

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "bo-workforce-planning";
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT({ email: "manager@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "bo-workforce-planning" })
    .setIssuer(`https://${domain}`)
    .setAudience(audience)
    .setSubject("manager-subject")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  return { resolver, token };
}

function env(binding: WorkforcePlanningCoreBinding): BoWorkforcePlanningEnv {
  return { PINO_WORKFORCE_CORE: binding, CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_BO_AUD: audience };
}

test("BO weekly planner forwards bounded query and verified BO identity", async () => {
  const f = await fixture();
  const forwarded: Array<{ request: WorkforcePlanningRequest; identity: VerifiedBoIdentity }> = [];
  const binding: WorkforcePlanningCoreBinding = { async executePlanning(request, identity) {
    forwarded.push({ request, identity });
    return { status: 200, body: { data: { staff: [] } }, requestId: "core-weekly" };
  } };
  const request = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/weekly?centerId=center-1&termWeekId=week-1&userId=forged", {
    headers: { "cf-access-jwt-assertion": f.token },
  });
  const response = await handleBoWorkforcePlanningRequest(request, env(binding), "workforce/planning/weekly", f.resolver);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "core-weekly");
  assert.deepEqual(forwarded[0]?.request, { method: "GET", path: "weekly", body: { centerId: "center-1", termWeekId: "week-1" } });
  assert.equal(forwarded[0]?.identity.subject, "manager-subject");
  assert.equal(forwarded[0]?.identity.email, "manager@example.com");
});

test("assignment and cancellation forward exact idempotency keys", async () => {
  const f = await fixture();
  const forwarded: WorkforcePlanningRequest[] = [];
  const binding: WorkforcePlanningCoreBinding = { async executePlanning(request) {
    forwarded.push(request);
    return { status: 200, body: { data: { id: "assignment" } }, requestId: "core-write" };
  } };
  const assignmentBody = { staffMemberId: "staff", centerId: "center", workDate: "2026-09-01", shiftTemplateId: "shift", termWeekId: "week" };
  const create = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/assignment", {
    method: "POST", headers: { "cf-access-jwt-assertion": f.token, "content-type": "application/json", "idempotency-key": "create-key" },
    body: JSON.stringify(assignmentBody),
  });
  const cancel = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/assignment/cancel", {
    method: "POST", headers: { "cf-access-jwt-assertion": f.token, "content-type": "application/json", "idempotency-key": "cancel-key" },
    body: JSON.stringify({ assignmentId: "assignment", reason: "Correction" }),
  });
  assert.equal((await handleBoWorkforcePlanningRequest(create, env(binding), "workforce/planning/assignment", f.resolver)).status, 200);
  assert.equal((await handleBoWorkforcePlanningRequest(cancel, env(binding), "workforce/planning/assignment/cancel", f.resolver)).status, 200);
  assert.deepEqual(forwarded, [
    { method: "POST", path: "assignment", body: assignmentBody, idempotencyKey: "create-key" },
    { method: "POST", path: "assignment/cancel", body: { assignmentId: "assignment", reason: "Correction" }, idempotencyKey: "cancel-key" },
  ]);
});

test("missing mutation idempotency key and missing BO identity fail before Core", async () => {
  const f = await fixture();
  let called = false;
  const binding: WorkforcePlanningCoreBinding = { async executePlanning() { called = true; throw new Error("unexpected"); } };
  const noKey = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/assignment", {
    method: "POST", headers: { "cf-access-jwt-assertion": f.token, "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const noIdentity = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/weekly?centerId=c&termWeekId=w");
  assert.equal((await handleBoWorkforcePlanningRequest(noKey, env(binding), "workforce/planning/assignment", f.resolver)).status, 400);
  assert.equal((await handleBoWorkforcePlanningRequest(noIdentity, env(binding), "workforce/planning/weekly", f.resolver)).status, 401);
  assert.equal(called, false);
});

test("unknown routes and wrong methods fail closed before Core", async () => {
  const f = await fixture();
  let called = false;
  const binding: WorkforcePlanningCoreBinding = { async executePlanning() { called = true; throw new Error("unexpected"); } };
  const unknown = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/templates", { headers: { "cf-access-jwt-assertion": f.token } });
  const wrongMethod = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/weekly", { method: "PUT", headers: { "cf-access-jwt-assertion": f.token } });
  assert.equal((await handleBoWorkforcePlanningRequest(unknown, env(binding), "workforce/planning/templates", f.resolver)).status, 404);
  assert.equal((await handleBoWorkforcePlanningRequest(wrongMethod, env(binding), "workforce/planning/weekly", f.resolver)).status, 405);
  assert.equal(called, false);
});

test("Core authorization denial and request ID pass through unchanged", async () => {
  const f = await fixture();
  const binding: WorkforcePlanningCoreBinding = { async executePlanning() {
    return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED", message: "Denied" } }, requestId: "core-denied" };
  } };
  const request = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/weekly?centerId=c&termWeekId=w", { headers: { "cf-access-jwt-assertion": f.token } });
  const response = await handleBoWorkforcePlanningRequest(request, env(binding), "workforce/planning/weekly", f.resolver);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-request-id"), "core-denied");
  assert.equal((await response.json() as { error: { code: string } }).error.code, "ACCESS_PERMISSION_DENIED");
});

test("staging BO Workforce bypass is workers.dev-only and forwards fixed fixture identity", async () => {
  const forwarded: VerifiedBoIdentity[] = [];
  const binding: WorkforcePlanningCoreBinding = { async executePlanning(_request, identity) {
    forwarded.push(identity);
    return { status: 200, body: { data: { staff: [] } }, requestId: "staging-weekly" };
  } };
  const stagingEnv: BoWorkforcePlanningEnv = {
    ...env(binding),
    WORKFORCE_BO_STAGING_BYPASS: "enabled",
    WORKFORCE_STAGING_BO_EMAIL: "workforce-planning-staging-probe@pino.invalid",
  };
  const staging = new Request("https://pino-team-os-staging.minhtri-van42.workers.dev/api/bo/workforce/planning/weekly?centerId=c&termWeekId=w");
  const response = await handleBoWorkforcePlanningRequest(staging, stagingEnv, "workforce/planning/weekly");
  assert.equal(response.status, 200);
  assert.equal(forwarded[0]?.email, "workforce-planning-staging-probe@pino.invalid");
  assert.equal(forwarded[0]?.subject, "workforce-planning-staging-probe-v1");

  const production = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/weekly?centerId=c&termWeekId=w");
  const denied = await handleBoWorkforcePlanningRequest(production, stagingEnv, "workforce/planning/weekly");
  assert.equal(denied.status, 401);
  assert.equal(forwarded.length, 1);
});
