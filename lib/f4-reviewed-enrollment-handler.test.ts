import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";
import type { F3BootstrapState, F3RunningClass } from "./f3-delivery-api";
import { handleReviewedEnrollmentActivation, REVIEWED_ENROLLMENT_CENTER_ID, REVIEWED_ENROLLMENT_EFFECTIVE_FROM } from "./f4-reviewed-enrollment-handler";
import { REVIEWED_ENROLLMENT_PLAN, REVIEWED_ENROLLMENT_UNRESOLVED } from "./f4-reviewed-enrollment-plan";

const domain = "team.cloudflareaccess.com";
const audience = "bo-audience";
const centerId = REVIEWED_ENROLLMENT_CENTER_ID;
const pathIds: Record<string, string> = {
  "little-piner-art": "00000000-0000-7000-8000-000000000011",
  "little-piner-piano": "00000000-0000-7000-8000-000000000012",
  artchitect: "00000000-0000-7000-8000-000000000013",
  pianohouse: "00000000-0000-7000-8000-000000000014",
};
const spaceIds: Record<string, string> = {
  "little-piner-art": "00000000-0000-7000-8000-000000000021",
  "little-piner-piano": "00000000-0000-7000-8000-000000000021",
  artchitect: "00000000-0000-7000-8000-000000000022",
  pianohouse: "00000000-0000-7000-8000-000000000023",
};
async function authFixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey); jwk.kid = "f4-enrollment";
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT({ email: "founder@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "f4-enrollment" })
    .setIssuer(`https://${domain}`).setAudience(audience).setSubject("founder-subject")
    .setIssuedAt().setExpirationTime("5m").sign(privateKey);
  return { resolver, token };
}

function request(token: string) {
  return new Request("https://bo.pinohouse.art/api/bo/delivery/enrollment-activation", {
    method: "POST",
    headers: { "cf-access-jwt-assertion": token, "content-type": "application/json", "idempotency-key": "reviewed-v1" },
    body: JSON.stringify({ centerId }),
  });
}

function state(): F3BootstrapState {
  const classes = buildClasses();
  return {
    asOf: "2026-08-27T12:30:00.000Z",
    centers: [{ id: centerId, centerKey: "pino-house", displayName: "PINO House", timeZone: "Asia/Ho_Chi_Minh", status: "ACTIVE" }],
    paths: Object.entries(pathIds).map(([code, id]) => ({ id, code, displayName: code, status: "ACTIVE", version: 1 })),
    learningSpaces: [
      { id: spaceIds.artchitect, centerId, code: "artchitect", displayName: "Artchitect", optimalConcurrentCapacity: 8, hardConcurrentCapacity: 10, status: "ACTIVE", version: 1 },
      { id: spaceIds.pianohouse, centerId, code: "pianohouse", displayName: "PianoHouse", optimalConcurrentCapacity: 8, hardConcurrentCapacity: 9, status: "ACTIVE", version: 1 },
      { id: spaceIds["little-piner-art"], centerId, code: "little-piner", displayName: "Little Piner", optimalConcurrentCapacity: 8, hardConcurrentCapacity: 10, status: "ACTIVE", version: 1 },
    ],
    runningClasses: classes, runningClassBlocks: [], terms: [], termWeeks: [], upcomingSessions: [], materializationPolicyStreams: [],
  };
}
function buildClasses(): F3RunningClass[] {
  const artWindows: Record<number, [string, string]> = {
    1: ["18:00", "19:30"], 2: ["18:00", "21:00"], 3: ["18:00", "21:00"], 4: ["18:00", "21:00"],
    5: ["18:00", "21:00"], 6: ["18:00", "20:00"], 7: ["18:00", "19:30"],
  };
  const unique = new Map<string, { pathCode: string; weekdayIso: number; starts: string; ends: string }>();
  for (const item of REVIEWED_ENROLLMENT_PLAN) for (const placement of item.placements) {
    const [starts, ends] = item.pathCode === "artchitect" ? artWindows[placement.weekdayIso]! : [placement.classStartsLocal!, placement.classEndsLocal!];
    unique.set(`${item.pathCode}|${placement.weekdayIso}|${starts}|${ends}`, { pathCode: item.pathCode, weekdayIso: placement.weekdayIso, starts, ends });
  }
  assert.equal(unique.size, 27);
  const classes: F3RunningClass[] = [...unique.values()].map((item, index): F3RunningClass => ({
    id: `00000000-0000-7000-8001-${String(index + 1).padStart(12, "0")}`,
    centerId, pathProgramId: pathIds[item.pathCode]!, learningSpaceId: spaceIds[item.pathCode]!,
    operationalName: `${item.pathCode}-${item.weekdayIso}-${item.starts}`,
    weekdayIso: item.weekdayIso, windowStartsLocal: item.starts, windowEndsLocal: item.ends,
    deliveryTopology: item.pathCode === "artchitect" ? "FLEXIBLE_STUDIO" : item.pathCode === "pianohouse" ? "FIXED_COHORT" : "OVERLAPPING_COHORT",
    defaultParticipationMinutes: 90, optimalConcurrentCapacity: 8,
    hardConcurrentCapacity: item.pathCode === "pianohouse" ? 9 : 10, status: "ACTIVE", version: 1,
  }));
  classes.push({
    id: "00000000-0000-7000-8001-000000000028", centerId, pathProgramId: pathIds.pianohouse!, learningSpaceId: spaceIds.pianohouse!,
    operationalName: "pianohouse-5-18:00-unassigned", weekdayIso: 5, windowStartsLocal: "18:00", windowEndsLocal: "19:30",
    deliveryTopology: "FIXED_COHORT", defaultParticipationMinutes: 90, optimalConcurrentCapacity: 8, hardConcurrentCapacity: 9, status: "ACTIVE", version: 1,
  });
  return classes;
}

type StoredEnrollment = { id: string; subscriptionId: string; runningClassId: string; effectiveFromLocalDate: string; effectiveUntilExclusiveLocalDate: null; plannedEntryLocalTime: string | null; plannedDurationMinutes: number | null };
function fakeCore(coreState: F3BootstrapState, initialFutureDays?: number) {
  const enrollments = new Map<string, StoredEnrollment[]>();
  const subscriptions = new Map<string, { id: string; pathProgramId: string; lifecycle: string; weeklyCommitment: number }>();
  for (const item of [...REVIEWED_ENROLLMENT_PLAN, ...REVIEWED_ENROLLMENT_UNRESOLVED]) {
    subscriptions.set(item.subscriptionId, { id: item.subscriptionId, pathProgramId: pathIds[item.pathCode]!, lifecycle: "ACTIVE", weeklyCommitment: item.expectedWeeklyCommitment });
  }
  let created = 0;
  let policyWrites = 0;
  let calls = 0;
  let policy: { stream: { revision: number }; versions: Array<{ id: string; storedState: "DRAFT" | "PUBLISHED"; effectiveFrom: string | null; effectiveUntil: string | null; value: { maxDaysAhead: number } }> } | null = initialFutureDays === undefined ? null : { stream: { revision: 2 }, versions: [{ id: "00000000-0000-7000-a001-000000000001", storedState: "PUBLISHED", effectiveFrom: "2026-08-27T14:00:00.000Z", effectiveUntil: null, value: { maxDaysAhead: initialFutureDays } }] };
  const binding: BoAccessCoreBinding = {
    async execute(request: BoAccessRequest) {
      calls += 1;
      if (request.method === "GET" && request.path === "policies/delivery/future_reservation.v1/stream") return ok(policy);
      if (request.method === "POST" && request.path === "policies/delivery/future_reservation.v1/versions") {
        if (policy !== null) return { status: 409, body: { error: { message: "unexpected existing policy" } }, requestId: "fake-policy-conflict" };
        const body = request.body as { value: { maxDaysAhead: number } };
        policyWrites += 1;
        policy = { stream: { revision: 1 }, versions: [{ id: "00000000-0000-7000-a001-000000000001", storedState: "DRAFT", effectiveFrom: null, effectiveUntil: null, value: { maxDaysAhead: body.value.maxDaysAhead } }] };
        return ok({ versionId: policy.versions[0]!.id, revision: 1 }, 201);
      }
      const policyPublish = /^policies\/delivery\/future_reservation\.v1\/versions\/([0-9a-f-]{36})\/publish$/.exec(request.path);
      if (request.method === "POST" && policyPublish) {
        const body = request.body as { effectiveFrom: string };
        const version = policy?.versions.find((item) => item.id === policyPublish[1]);
        if (!policy || !version || version.storedState !== "DRAFT") return { status: 404, body: { error: { message: "policy draft missing" } }, requestId: "fake-policy-404" };
        policyWrites += 1; version.storedState = "PUBLISHED"; version.effectiveFrom = body.effectiveFrom; policy.stream.revision = 2;
        return ok({ published: true });
      }
      if (request.method === "POST" && request.path === "enrollments/bulk-preflight") {
        const body = request.body as { subscriptions: Array<{ subscriptionId: string; placements: Array<{ runningClassId: string; effectiveFromLocalDate: string; plannedEntryLocalTime: string | null; plannedDurationMinutes: number | null }> }>; pendingSubscriptions: Array<{ subscriptionId: string }> };
        const total = body.subscriptions.reduce((sum, item) => sum + item.placements.length, 0);
        let reused = 0;
        for (const group of body.subscriptions) for (const placement of group.placements) {
          if ((enrollments.get(group.subscriptionId) ?? []).some((item) => item.runningClassId === placement.runningClassId && item.effectiveFromLocalDate === placement.effectiveFromLocalDate && item.plannedEntryLocalTime === placement.plannedEntryLocalTime && item.plannedDurationMinutes === placement.plannedDurationMinutes)) reused += 1;
        }
        return ok({ placedSubscriptions: body.subscriptions.length, pendingSubscriptions: body.pendingSubscriptions.length, enrollments: total, missing: total - reused, reused });
      }
      if (request.method === "POST" && request.path === "enrollments/bulk-place") {
        const body = request.body as { subscriptions: Array<{ subscriptionId: string; placements: Array<{ runningClassId: string; effectiveFromLocalDate: string; plannedEntryLocalTime: string | null; plannedDurationMinutes: number | null }> }>; pendingSubscriptions: Array<{ subscriptionId: string }> };
        let bulkCreated = 0, reused = 0, total = 0;
        for (const group of body.subscriptions) for (const placement of group.placements) {
          total += 1;
          const current = enrollments.get(group.subscriptionId) ?? [];
          const exact = current.some((item) => item.runningClassId === placement.runningClassId && item.effectiveFromLocalDate === placement.effectiveFromLocalDate && item.plannedEntryLocalTime === placement.plannedEntryLocalTime && item.plannedDurationMinutes === placement.plannedDurationMinutes);
          if (exact) { reused += 1; continue; }
          const item: StoredEnrollment = { id: `00000000-0000-7000-9001-${String(++created).padStart(12, "0")}`, subscriptionId: group.subscriptionId, runningClassId: placement.runningClassId, effectiveFromLocalDate: placement.effectiveFromLocalDate, effectiveUntilExclusiveLocalDate: null, plannedEntryLocalTime: placement.plannedEntryLocalTime, plannedDurationMinutes: placement.plannedDurationMinutes };
          enrollments.set(group.subscriptionId, [...current, item]); bulkCreated += 1;
        }
        return ok({ placedSubscriptions: body.subscriptions.length, pendingSubscriptions: body.pendingSubscriptions.length, enrollments: total, created: bulkCreated, reused }, 201);
      }
      if (request.method === "GET" && request.path === "delivery/bootstrap-state") return ok(coreState);
      if (request.method === "GET" && request.path === "enrollments/capacity") {
        const body = request.body as { runningClassId: string; targetLocalDate: string };
        const runningClass = coreState.runningClasses.find((item) => item.id === body.runningClassId);
        const target = new Date(body.targetLocalDate + "T00:00:00.000Z");
        const targetIso = target.getUTCDay() === 0 ? 7 : target.getUTCDay();
        if (!runningClass || targetIso !== runningClass.weekdayIso) {
          return { status: 400, body: { error: { message: "Capacity target must be the Running Class weekday" } }, requestId: "fake-capacity-weekday" };
        }
        return ok({ status: "AVAILABLE", bottlenecks: [] });
      }
      const enrollmentList = /^subscriptions\/([0-9a-f-]{36})\/enrollments$/.exec(request.path);
      if (request.method === "GET" && enrollmentList) return ok(enrollments.get(enrollmentList[1]!) ?? []);
      const placement = /^subscriptions\/([0-9a-f-]{36})\/placement$/.exec(request.path);
      if (request.method === "GET" && placement) {
        const subscription = subscriptions.get(placement[1]!)!;
        const count = (enrollments.get(placement[1]!) ?? []).length;
        return ok({ placementState: count === 0 ? "PENDING_PLACEMENT" : count < subscription.weeklyCommitment ? "PARTIALLY_PLACED" : "PLACED", effectiveEnrollmentCount: count, weeklySessionCommitment: subscription.weeklyCommitment });
      }
      const subscription = /^subscriptions\/([0-9a-f-]{36})$/.exec(request.path);
      if (request.method === "GET" && subscription) return ok(subscriptions.get(subscription[1]!)!);
      if (request.method === "POST" && request.path === "enrollments") {
        const body = request.body as Record<string, unknown>;
        const item: StoredEnrollment = {
          id: `00000000-0000-7000-9001-${String(++created).padStart(12, "0")}`,
          subscriptionId: String(body.subscriptionId), runningClassId: String(body.runningClassId),
          effectiveFromLocalDate: String(body.effectiveFromLocalDate), effectiveUntilExclusiveLocalDate: null,
          plannedEntryLocalTime: body.plannedEntryLocalTime === null ? null : String(body.plannedEntryLocalTime),
          plannedDurationMinutes: body.plannedDurationMinutes === null ? null : Number(body.plannedDurationMinutes),
        };
        enrollments.set(item.subscriptionId, [...(enrollments.get(item.subscriptionId) ?? []), item]);
        return ok({ enrollment: item, capacityDecision: { status: "AVAILABLE", bottlenecks: [] } }, 201);
      }
      return { status: 404, body: { error: { message: `unexpected ${request.method} ${request.path}` } }, requestId: "fake-404" };
    },
  };
  return { binding, enrollments, created: () => created, policyWrites: () => policyWrites, calls: () => calls };
}
function ok(data: unknown, status = 200) {
  return { status, body: { data }, requestId: `fake-${status}` };
}

test("reviewed Enrollment activation places 62 deterministic seats and is retry-safe", async () => {
  const auth = await authFixture();
  const core = fakeCore(state());
  const env = { PINO_BO_CORE: core.binding, CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_BO_AUD: audience };

  const first = await handleReviewedEnrollmentActivation(request(auth.token), env, auth.resolver);
  assert.equal(first.status, 200);
  const firstBody = await first.json() as { data: { placedSubscriptions: number; enrollments: number; created: number; reused: number; unresolvedSubscriptions: number; effectiveFromLocalDate: string } };
  assert.deepEqual(firstBody.data, {
    placedSubscriptions: 31, enrollments: 62, created: 62, reused: 0,
    unresolvedSubscriptions: 2, effectiveFromLocalDate: REVIEWED_ENROLLMENT_EFFECTIVE_FROM,
  });
  assert.equal(core.created(), 62);
  assert.equal(core.policyWrites(), 2);
  assert.equal(core.calls(), 7);
  for (const item of REVIEWED_ENROLLMENT_UNRESOLVED) assert.equal((core.enrollments.get(item.subscriptionId) ?? []).length, 0);

  const second = await handleReviewedEnrollmentActivation(request(auth.token), env, auth.resolver);
  assert.equal(second.status, 200);
  const secondBody = await second.json() as { data: { created: number; reused: number } };
  assert.equal(secondBody.data.created, 0);
  assert.equal(secondBody.data.reused, 62);
  assert.equal(core.created(), 62);
  assert.equal(core.policyWrites(), 2);
  assert.equal(core.calls(), 11);
});

test("reviewed Enrollment activation rejects a conflicting active future-reservation policy before Enrollment writes", async () => {
  const auth = await authFixture();
  const core = fakeCore(state(), 14);
  const env = { PINO_BO_CORE: core.binding, CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_BO_AUD: audience };
  const response = await handleReviewedEnrollmentActivation(request(auth.token), env, auth.resolver);
  assert.equal(response.status, 409);
  assert.equal(core.created(), 0);
  assert.equal(core.policyWrites(), 0);
});

test("reviewed Enrollment activation requires authenticated BO identity and idempotency", async () => {
  const auth = await authFixture();
  const core = fakeCore(state());
  const env = { PINO_BO_CORE: core.binding, CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_BO_AUD: audience };
  const unauthenticated = new Request("https://bo.pinohouse.art/api/bo/delivery/enrollment-activation", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "reviewed-v1" }, body: JSON.stringify({ centerId }) });
  const missingKey = new Request("https://bo.pinohouse.art/api/bo/delivery/enrollment-activation", { method: "POST", headers: { "cf-access-jwt-assertion": auth.token, "content-type": "application/json" }, body: JSON.stringify({ centerId }) });
  assert.equal((await handleReviewedEnrollmentActivation(unauthenticated, env, auth.resolver)).status, 401);
  assert.equal((await handleReviewedEnrollmentActivation(missingKey, env, auth.resolver)).status, 400);
  assert.equal(core.created(), 0);
});

test("reviewed Enrollment activation is locked to the canonical PINO House Center", async () => {
  const auth = await authFixture();
  const core = fakeCore(state());
  const env = { PINO_BO_CORE: core.binding, CF_ACCESS_TEAM_DOMAIN: domain, CF_ACCESS_BO_AUD: audience };
  const wrongCenter = new Request("https://bo.pinohouse.art/api/bo/delivery/enrollment-activation", {
    method: "POST",
    headers: { "cf-access-jwt-assertion": auth.token, "content-type": "application/json", "idempotency-key": "reviewed-v1" },
    body: JSON.stringify({ centerId: "00000000-0000-7000-8000-000000000099" }),
  });
  const response = await handleReviewedEnrollmentActivation(wrongCenter, env, auth.resolver);
  assert.equal(response.status, 409);
  assert.equal(core.created(), 0);
});
