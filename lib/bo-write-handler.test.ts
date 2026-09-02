import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { handleBoStaffOnboardingRequest, isPracticeWritePath, type BoWriteEnv } from "./bo-write-handler";
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

test("Staff PIN reset facade forwards an empty replay-protected command and rejects Manager-selected PIN", async () => {
  const f = await fixture();
  const resetPath = "access/users/0198d050-56c1-7ac5-b9ab-b0e45d912345/staff-pin/reset";
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async execute(coreRequest) { forwarded.push(coreRequest); return { status: 200, body: { data: { commandType: "RESET_STAFF_PIN", initialPin: "482061" } }, requestId: "core-pin-reset" }; } };
  const makeResetRequest = (body: string, idempotencyKey?: string) => new Request(`https://bo.pinohouse.art/api/bo/${resetPath}`, { method: "POST", headers: { "cf-access-jwt-assertion": f.token, "content-type": "application/json", ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) }, body });
  const response = await handleBoStaffOnboardingRequest(makeResetRequest("{}", "pin-reset-1"), env(binding), resetPath, f.resolver);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(forwarded, [{ method: "POST", path: resetPath, body: {}, idempotencyKey: "pin-reset-1" }]);
  const [missingKey, selectedPin] = await Promise.all([
    handleBoStaffOnboardingRequest(makeResetRequest("{}"), env(binding), resetPath, f.resolver),
    handleBoStaffOnboardingRequest(makeResetRequest(JSON.stringify({ pin: "123456" }), "pin-reset-2"), env(binding), resetPath, f.resolver),
  ]);
  assert.equal(missingKey.status, 400);
  assert.equal(selectedPin.status, 400);
  assert.equal(forwarded.length, 1);
});

test("workers.dev staging bypass cannot authorize Staff PIN reset", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const resetPath = "access/users/0198d050-56c1-7ac5-b9ab-b0e45d912345/staff-pin/reset";
  const stagingRequest = new Request(`https://pino-team-os-staging.example.workers.dev/api/bo/${resetPath}`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "staging-reset" }, body: "{}" });
  const response = await handleBoStaffOnboardingRequest(stagingRequest, { ...env(binding), WORKFORCE_BO_STAGING_BYPASS: "enabled", WORKFORCE_STAGING_BO_EMAIL: "workforce-planning-staging-probe@pino.invalid" }, resetPath);
  assert.equal(response.status, 401);
  assert.equal(called, false);
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

test("workers.dev Staff onboarding uses the bounded Workforce staging Manager identity", async () => {
  let identity: VerifiedBoIdentity | undefined;
  const binding: BoAccessCoreBinding = { async execute(coreRequest, actor) {
    identity = actor;
    assert.equal(coreRequest.path, path);
    return { status: 201, body: { data: { staffMemberId: "00000000-0000-7000-8000-000000000011" } }, requestId: "workforce-staging-write" };
  } };
  const stagingRequest = new Request(`https://pino-team-os-staging.example.workers.dev/api/bo/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "staging-onboarding" },
    body: JSON.stringify(onboardingBody),
  });
  const response = await handleBoStaffOnboardingRequest(stagingRequest, {
    ...env(binding),
    WORKFORCE_BO_STAGING_BYPASS: "enabled",
    WORKFORCE_STAGING_BO_EMAIL: "workforce-planning-staging-probe@pino.invalid",
  }, path);
  assert.equal(response.status, 201);
  assert.equal(identity?.subject, "workforce-planning-staging-probe-v1");
  assert.equal(identity?.email, "workforce-planning-staging-probe@pino.invalid");
});

test("Workforce staging Manager identity stays fail-closed on production and unrelated BO writes", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const stagedEnv: BoWriteEnv = {
    ...env(binding),
    WORKFORCE_BO_STAGING_BYPASS: "enabled",
    WORKFORCE_STAGING_BO_EMAIL: "workforce-planning-staging-probe@pino.invalid",
  };
  const productionRequest = new Request(`https://bo.pinohouse.art/api/bo/${path}`, {
    method: "POST", headers: { "content-type": "application/json", "idempotency-key": "production-rejected" }, body: JSON.stringify(onboardingBody),
  });
  const unrelatedRequest = new Request("https://pino-team-os-staging.example.workers.dev/api/bo/access/roles", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  });
  const [production, unrelated] = await Promise.all([
    handleBoStaffOnboardingRequest(productionRequest, stagedEnv, path),
    handleBoStaffOnboardingRequest(unrelatedRequest, stagedEnv, "access/roles"),
  ]);
  assert.equal(production.status, 401);
  assert.equal(unrelated.status, 401);
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

test("F3 delivery facade forwards exact governed writes without inventing idempotency or identity", async () => {
  const f = await fixture();
  const forwarded: Array<{ request: BoAccessRequest; identity: VerifiedBoIdentity }> = [];
  const binding: BoAccessCoreBinding = {
    async execute(coreRequest, identity) {
      forwarded.push({ request: coreRequest, identity });
      return { status: 201, body: { data: { id: "00000000-0000-7000-8000-000000000020" } }, requestId: "core-f3" };
    },
  };
  const f3Path = "delivery/learning-spaces";
  const body = { centerId: "00000000-0000-7000-8000-000000000001", code: "room-a", displayName: "Room A", optimalConcurrentCapacity: 6, hardConcurrentCapacity: 8, status: "ACTIVE" };

  const response = await handleBoStaffOnboardingRequest(
    request(f.token, { body: JSON.stringify(body) }),
    env(binding),
    f3Path,
    f.resolver,
  );

  assert.equal(response.status, 201);
  assert.deepEqual(forwarded[0]!.request, { method: "POST", path: f3Path, body });
  assert.equal(Object.hasOwn(forwarded[0]!.request, "idempotencyKey"), false);
  assert.equal(forwarded[0]!.identity.subject, "verified-founder-subject");
});

test("F3 delivery facade rejects path expansion beyond the exact allowlist", async () => {
  const f = await fixture();
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const response = await handleBoStaffOnboardingRequest(
    request(f.token, { body: "{}" }),
    env(binding),
    "delivery/learning-spaces/anything",
    f.resolver,
  );
  assert.equal(response.status, 404);
  assert.equal(called, false);
});


test("Learning Owner facade requires replay evidence and forwards the exact BO command", async () => {
  const f = await fixture();
  const forwarded: Array<{ request: BoAccessRequest; identity: VerifiedBoIdentity }> = [];
  const binding: BoAccessCoreBinding = {
    async execute(coreRequest, identity) {
      forwarded.push({ request: coreRequest, identity });
      return { status: 200, body: { data: { sessionId: "0198d050-56c1-7ac5-b9ab-b0e45d912345", staffMemberId: "0198d050-56c1-7ac5-b9ab-b0e45d912346", version: 2 } }, requestId: "core-owner" };
    },
  };
  const ownerPath = "sessions/0198d050-56c1-7ac5-b9ab-b0e45d912345/learning-owner";
  const body = { staffMemberId: "0198d050-56c1-7ac5-b9ab-b0e45d912346", expectedVersion: 1, reason: "Coverage handoff" };
  const response = await handleBoStaffOnboardingRequest(
    request(f.token, { idempotencyKey: "owner-command-1", body: JSON.stringify(body) }),
    env(binding),
    ownerPath,
    f.resolver,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(forwarded[0]!.request, { method: "POST", path: ownerPath, body, idempotencyKey: "owner-command-1" });
  assert.equal(forwarded[0]!.identity.subject, "verified-founder-subject");
});

test("Learning Owner facade rejects mutation without Idempotency-Key before Core", async () => {
  const f = await fixture();
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const response = await handleBoStaffOnboardingRequest(
    request(f.token, { body: JSON.stringify({ staffMemberId: "0198d050-56c1-7ac5-b9ab-b0e45d912346" }) }),
    env(binding),
    "sessions/0198d050-56c1-7ac5-b9ab-b0e45d912345/learning-owner",
    f.resolver,
  );
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

const parentId = "0198d050-56c1-7ac5-b9ab-b0e45d912399";

test("Parent PIN facade forwards only exact issue/reset commands with an empty body", async () => {
  const f = await fixture();
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = {
    async execute(coreRequest) {
      forwarded.push(coreRequest);
      return { status: 201, body: { data: { command: "ISSUE_INITIAL_PARENT_PIN", temporaryPin: "123456" } }, requestId: "core-parent-pin" };
    },
  };
  for (const action of ["issue-initial", "reset"] as const) {
    const pinPath = `identity/parents/${parentId}/pin/${action}`;
    const response = await handleBoStaffOnboardingRequest(
      request(f.token, { body: "{}" }), env(binding), pinPath, f.resolver,
    );
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("x-request-id"), "core-parent-pin");
  }
  assert.deepEqual(forwarded, [
    { method: "POST", path: `identity/parents/${parentId}/pin/issue-initial`, body: {} },
    { method: "POST", path: `identity/parents/${parentId}/pin/reset`, body: {} },
  ]);
});
test("Parent PIN facade rejects non-empty payloads before Core", async () => {
  const f = await fixture();
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const response = await handleBoStaffOnboardingRequest(
    request(f.token, { body: JSON.stringify({ temporaryPin: "000000" }) }),
    env(binding), `identity/parents/${parentId}/pin/issue-initial`, f.resolver,
  );
  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.deepEqual(await response.json(), {
    error: { code: "PLATFORM_INVALID_INPUT", message: "Parent PIN command body must be empty" },
  });
});

test("Parent PIN facade keeps neighboring identity routes fail-closed", async () => {
  const f = await fixture();
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const response = await handleBoStaffOnboardingRequest(
    request(f.token, { body: "{}" }), env(binding),
    `identity/parents/${parentId}/pin/export`, f.resolver,
  );
  assert.equal(response.status, 404);
  assert.equal(called, false);
});
test("Learner lifecycle writes remain bounded and forward replay evidence to Core", async () => {
  const f = await fixture();
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async execute(coreRequest) { forwarded.push(coreRequest); return { status: 201, body: { data: { ok: true } }, requestId: "core-lifecycle" }; } };
  const subscriptionId = "0198d050-56c1-7ac5-b9ab-b0e45d912410";
  const enrollmentId = "0198d050-56c1-7ac5-b9ab-b0e45d912411";
  const cases = [
    { route: "subscriptions", key: "sub-create", body: { studentProfileId: parentId, pathProgramId: parentId, serviceStartsOn: "2026-09-01", weeklyCommitment: 2, purchasedUnits: 24 } },
    { route: `subscriptions/${subscriptionId}/renew`, key: "sub-renew", body: { weeklyCommitment: 2, purchasedUnits: 24 } },
    { route: "enrollments", key: "enrollment-place", body: { subscriptionId, runningClassId: parentId, effectiveFromLocalDate: "2026-09-01", commandEffectiveLocalDate: "2026-08-29", policyEffectiveAt: "2026-08-29T12:00:00.000Z" } },
    { route: `enrollments/${enrollmentId}/end`, key: "enrollment-end", body: { effectiveUntilExclusiveLocalDate: "2026-10-01", expectedVersion: 1, reason: "Schedule ended" } },
  ];
  for (const item of cases) {
    const response = await handleBoStaffOnboardingRequest(request(f.token, { idempotencyKey: item.key, body: JSON.stringify(item.body) }), env(binding), item.route, f.resolver);
    assert.ok(response.status >= 200 && response.status < 300);
  }
  assert.deepEqual(forwarded.map((item) => ({ path: item.path, idempotencyKey: item.idempotencyKey })), cases.map((item) => ({ path: item.route, idempotencyKey: item.key })));
});

test("Open Studio BO writes stay on the explicit facade allowlist with replay evidence", async () => {
  const f = await fixture();
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async execute(coreRequest) { forwarded.push(coreRequest); return { status: 201, body: { data: { ok: true } }, requestId: "core-open-studio-write" }; } };
  const id = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
  const cases = [
    { route: "open-studio/listings", key: "listing-create", body: { sessionId: id, syllabusId: id, experienceType: "KHAM_PHA" } },
    { route: "open-studio/member-path-centers/assign", key: "center-assign", body: { houseMembershipId: id, pathProgramId: id, centerId: id, effectiveFrom: "2026-08-30T00:00:00.000Z" } },
    { route: "open-studio/passes/issue-monthly-path", key: "pass-issue", body: { houseMembershipId: id, pathProgramId: id, effectiveAt: "2026-08-30T00:00:00.000Z" } },
    { route: "open-studio/admission", key: "owner-admission", body: { passId: id, listingId: id, participantMode: "OWNER", studentProfileId: id, effectiveAt: "2026-08-30T00:00:00.000Z" } },
  ];
  for (const item of cases) {
    const response = await handleBoStaffOnboardingRequest(request(f.token, { idempotencyKey: item.key, body: JSON.stringify(item.body) }), env(binding), item.route, f.resolver);
    assert.equal(response.status, 201);
  }
  assert.deepEqual(forwarded.map((item) => ({ path: item.path, idempotencyKey: item.idempotencyKey })), cases.map((item) => ({ path: item.route, idempotencyKey: item.key })));
});

test("Open Studio policy draft and publish commands stay on the governed BO facade", async () => {
  const f = await fixture();
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async execute(coreRequest) { forwarded.push(coreRequest); return { status: 200, body: { data: { ok: true } }, requestId: "core-open-studio-policy-write" }; } };
  const versionId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
  const draftPath = "policies/open_studio/monthly_path_pass.v1/versions";
  const publishPath = `policies/open_studio/monthly_path_pass.v1/versions/${versionId}/publish`;
  const target = { targetType: "GLOBAL", targetId: null };
  const value = { quantityPerPath: 2, periodKind: "CALENDAR_MONTH", carryForwardPeriods: 1, allowedParticipantModes: ["OWNER"], allowedExperienceTypes: ["KHAM_PHA", "CHUYEN_DE"] };
  const draftBody = { ...target, value, changeReason: "September Open Studio policy", expectedRevision: 3 };
  const publishBody = { ...target, effectiveFrom: "2026-09-01T00:00:00.000Z", expectedRevision: 4 };
  assert.equal((await handleBoStaffOnboardingRequest(request(f.token, { idempotencyKey: "policy-draft", body: JSON.stringify(draftBody) }), env(binding), draftPath, f.resolver)).status, 200);
  assert.equal((await handleBoStaffOnboardingRequest(request(f.token, { idempotencyKey: "policy-publish", body: JSON.stringify(publishBody) }), env(binding), publishPath, f.resolver)).status, 200);
  assert.deepEqual(forwarded, [
    { method: "POST", path: draftPath, body: draftBody, idempotencyKey: "policy-draft" },
    { method: "POST", path: publishPath, body: publishBody, idempotencyKey: "policy-publish" },
  ]);
});

test("workers.dev Open Studio BO writes use the dedicated staging principal", async () => {
  let identity: VerifiedBoIdentity | undefined;
  const binding: BoAccessCoreBinding = { async execute(coreRequest, actor) {
    identity = actor;
    assert.equal(coreRequest.path, "open-studio/listings");
    return { status: 201, body: { data: { ok: true } }, requestId: "open-studio-staging-write" };
  } };
  const stagingRequest = new Request("https://pino-team-os-staging.example.workers.dev/api/bo/open-studio/listings", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "staging-listing-create" },
    body: JSON.stringify({ sessionId: parentId, syllabusId: parentId, experienceType: "KHAM_PHA" }),
  });
  const response = await handleBoStaffOnboardingRequest(stagingRequest, {
    ...env(binding),
    OPEN_STUDIO_BO_STAGING_BYPASS: "enabled",
    OPEN_STUDIO_STAGING_BO_EMAIL: "open-studio-control-loop-staging-probe@pino.invalid",
  }, "open-studio/listings");
  assert.equal(response.status, 201);
  assert.equal(identity?.subject, "open-studio-control-loop-staging-probe-v1");
  assert.equal(identity?.email, "open-studio-control-loop-staging-probe@pino.invalid");
});

test("Open Studio staging identity is not reused for non-Open-Studio BO writes", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = { async execute() { called = true; throw new Error("unexpected"); } };
  const stagingRequest = new Request("https://pino-team-os-staging.example.workers.dev/api/bo/delivery/learning-spaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ centerId: parentId, code: "room", displayName: "Room", optimalConcurrentCapacity: 4, hardConcurrentCapacity: 6, status: "ACTIVE" }),
  });
  const response = await handleBoStaffOnboardingRequest(stagingRequest, {
    ...env(binding),
    OPEN_STUDIO_BO_STAGING_BYPASS: "enabled",
    OPEN_STUDIO_STAGING_BO_EMAIL: "open-studio-control-loop-staging-probe@pino.invalid",
  }, "delivery/learning-spaces");
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("Practice write allowlist accepts exact Core authoring and F1 access commands", () => {
  const id = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
  assert.equal(isPracticeWritePath("practice/repertoire-access/grants"), true);
  assert.equal(isPracticeWritePath(`practice/repertoire-access/grants/${id}/revoke`), true);
  assert.equal(isPracticeWritePath(`practice/repertoire-access/grants/${id}`), false);
  assert.equal(isPracticeWritePath("practice/resources"), true);
  assert.equal(isPracticeWritePath(`practice/resources/${id}/drafts`), true);
  assert.equal(isPracticeWritePath(`practice/versions/${id}`), true);
  assert.equal(isPracticeWritePath(`practice/versions/${id}/pages`), true);
  assert.equal(isPracticeWritePath(`practice/versions/${id}/publish`), true);
  assert.equal(isPracticeWritePath(`practice/resources/${id}/draft`), false);
  assert.equal(isPracticeWritePath(`practice/resources/${id}/publish`), false);
  assert.equal(isPracticeWritePath("practice/media"), false);
  assert.equal(isPracticeWritePath("practice/resources/not-a-canonical-id/drafts"), false);
});

test("Practice BO commands require idempotency and preserve exact bounded payload", async () => {
  const f = await fixture();
  const versionId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
  const sheetId = "0198d050-56c1-7ac5-b9ab-b0e45d912346";
  const worksheetId = "0198d050-56c1-7ac5-b9ab-b0e45d912347";
  const practicePath = `practice/versions/${versionId}/pages`;
  const body = {
    expectedRevision: 3,
    pages: [
      { sheetMediaAssetId: sheetId, worksheetMediaAssetId: worksheetId },
      { sheetMediaAssetId: sheetId, worksheetMediaAssetId: null },
    ],
  };
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async execute(coreRequest) {
    forwarded.push(coreRequest);
    return { status: 200, body: { data: { id: versionId, revision: 4 } }, requestId: "core-practice-pages" };
  } };
  const ok = await handleBoStaffOnboardingRequest(
    request(f.token, { idempotencyKey: "practice-pages-1", body: JSON.stringify(body) }),
    env(binding),
    practicePath,
    f.resolver,
  );
  assert.equal(ok.status, 200);
  assert.deepEqual(forwarded, [{ method: "POST", path: practicePath, body, idempotencyKey: "practice-pages-1" }]);

  const missingKey = await handleBoStaffOnboardingRequest(
    request(f.token, { body: JSON.stringify(body) }),
    env(binding),
    practicePath,
    f.resolver,
  );
  assert.equal(missingKey.status, 400);
  assert.equal(forwarded.length, 1);
});
