import type { JWTVerifyGetKey } from "jose";
import { authenticateBo, BoAuthError } from "./bo-auth";
import { callBoAccessCore, type BoAccessCoreBinding, type BoAccessRequest } from "./bo-core";
import type { F3BootstrapState, F3RunningClass } from "./f3-delivery-api";
import { REVIEWED_ENROLLMENT_PLAN, REVIEWED_ENROLLMENT_UNRESOLVED, type ReviewedEnrollmentPlacement } from "./f4-reviewed-enrollment-plan";

export const REVIEWED_ENROLLMENT_CENTER_ID = "01a02354-6be1-7c77-a2dd-513052a18b98";
export const REVIEWED_ENROLLMENT_EFFECTIVE_FROM = "2026-08-27";
export const REVIEWED_ENROLLMENT_FUTURE_MAX_DAYS = 0;
export const REVIEWED_ENROLLMENT_ACTIVATION_PATH = "delivery/enrollment-activation";

export interface ReviewedEnrollmentEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_BO_AUD: string;
}

interface Subscription { id: string; pathProgramId: string; lifecycle: string; weeklyCommitment: number }
interface Enrollment { id: string; subscriptionId: string; runningClassId: string; effectiveFromLocalDate: string; effectiveUntilExclusiveLocalDate: string | null; plannedEntryLocalTime: string | null; plannedDurationMinutes: number | null }
interface CapacityDecision { status: "AVAILABLE" | "ABOVE_OPTIMAL" | "HARD_BLOCKED"; bottlenecks: string[] }
interface PlacementState { placementState: "PENDING_PLACEMENT" | "PARTIALLY_PLACED" | "PLACED"; effectiveEnrollmentCount: number; weeklySessionCommitment: number }
interface FutureReservationPolicyVersion { id: string; storedState: "DRAFT" | "PUBLISHED"; effectiveFrom: string | null; effectiveUntil: string | null; value: { maxDaysAhead: number } }
interface FutureReservationPolicyInspection { stream: { revision: number }; versions: FutureReservationPolicyVersion[] }
interface PolicyDraftResult { versionId: string; revision: number }
interface ResolvedPlacement { subscriptionId: string; runningClass: F3RunningClass; placement: ReviewedEnrollmentPlacement }

class CoreFailure extends Error {
  constructor(readonly status: number, message: string, readonly requestId: string | null) { super(message); }
}
export async function handleReviewedEnrollmentActivation(
  request: Request,
  env: ReviewedEnrollmentEnv,
  keyResolver?: JWTVerifyGetKey,
): Promise<Response> {
  try {
    if (request.method !== "POST") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    const identity = await authenticateBo(request.headers, { teamDomain: env.CF_ACCESS_TEAM_DOMAIN, audience: env.CF_ACCESS_BO_AUD }, keyResolver);
    const activationKey = request.headers.get("idempotency-key")?.trim();
    if (!activationKey) return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "Idempotency-Key is required" } }, 400);
    const body = await parseBody(request);
    const centerId = requiredUuid(body.centerId, "centerId");
    if (centerId !== REVIEWED_ENROLLMENT_CENTER_ID) throw new Error("Reviewed Enrollment activation is locked to the canonical PINO House Center.");
    const core = <T>(coreRequest: BoAccessRequest) => coreData<T>(env.PINO_BO_CORE, coreRequest, identity);

    const state = await core<F3BootstrapState>({ method: "GET", path: "delivery/bootstrap-state" });
    const center = state.centers.find((item) => item.id === centerId);
    if (!center) throw new Error("Reviewed Enrollment Center is not present in canonical state.");
    const activeSpaces = state.learningSpaces.filter((item) => item.centerId === centerId && item.status === "ACTIVE");
    const activeClasses = state.runningClasses.filter((item) => item.centerId === centerId && item.status === "ACTIVE");
    if (activeSpaces.length !== 3 || activeClasses.length !== 28) {
      throw new Error(`Reviewed Enrollment activation requires exactly 3 active Learning Spaces and 28 active Running Classes; found ${activeSpaces.length}/${activeClasses.length}.`);
    }
    const resolved = resolvePlacements(state, centerId);
    assertReviewedPlanCapacity(state, resolved);

    const existingBySubscription = new Map<string, Enrollment[]>();
    for (const item of REVIEWED_ENROLLMENT_PLAN) {
      const subscription = await core<Subscription>({ method: "GET", path: `subscriptions/${item.subscriptionId}` });
      const path = state.paths.find((candidate) => candidate.code === item.pathCode);
      if (!path || subscription.pathProgramId !== path.id || subscription.lifecycle !== "ACTIVE" || subscription.weeklyCommitment !== item.expectedWeeklyCommitment) {
        throw new Error(`Subscription ${item.subscriptionId} conflicts with reviewed Enrollment plan.`);
      }
      const enrollments = await core<Enrollment[]>({ method: "GET", path: `subscriptions/${item.subscriptionId}/enrollments` });
      assertExistingSubset(item.subscriptionId, enrollments, resolved.filter((candidate) => candidate.subscriptionId === item.subscriptionId));
      existingBySubscription.set(item.subscriptionId, enrollments);
    }
    for (const item of REVIEWED_ENROLLMENT_UNRESOLVED) {
      const subscription = await core<Subscription>({ method: "GET", path: `subscriptions/${item.subscriptionId}` });
      const path = state.paths.find((candidate) => candidate.code === item.pathCode);
      if (!path || subscription.pathProgramId !== path.id || subscription.lifecycle !== "ACTIVE" || subscription.weeklyCommitment !== item.expectedWeeklyCommitment) {
        throw new Error(`Unresolved subscription ${item.subscriptionId} conflicts with reviewed plan.`);
      }
      const enrollments = await core<Enrollment[]>({ method: "GET", path: `subscriptions/${item.subscriptionId}/enrollments` });
      if (enrollments.length) throw new Error(`Unresolved double-session subscription ${item.subscriptionId} already has Enrollment data; activation stopped.`);
    }

    const missing = resolved.filter((candidate) => !hasExact(existingBySubscription.get(candidate.subscriptionId) ?? [], candidate));
    for (const candidate of missing) {
      const decision = await core<CapacityDecision>({ method: "GET", path: "enrollments/capacity", body: capacityBody(candidate) });
      if (decision.status === "HARD_BLOCKED") throw new Error(`Capacity preflight blocked ${candidate.runningClass.operationalName}: ${decision.bottlenecks.join(", ")}.`);
    }
    const policyEffectiveAt = await ensureFutureReservationPolicy(core, centerId);

    let created = 0;
    for (const candidate of missing) {
      await core<{ enrollment: Enrollment; capacityDecision: CapacityDecision }>({
        method: "POST", path: "enrollments", idempotencyKey: placementKey(activationKey, candidate),
        body: {
          subscriptionId: candidate.subscriptionId, runningClassId: candidate.runningClass.id,
          effectiveFromLocalDate: REVIEWED_ENROLLMENT_EFFECTIVE_FROM,
          plannedEntryLocalTime: candidate.placement.plannedEntryLocalTime,
          plannedDurationMinutes: candidate.placement.plannedDurationMinutes,
          commandEffectiveLocalDate: REVIEWED_ENROLLMENT_EFFECTIVE_FROM,
          policyEffectiveAt,
        },
      });
      created += 1;
    }
    let placedSubscriptions = 0;
    for (const item of REVIEWED_ENROLLMENT_PLAN) {
      const enrollments = await core<Enrollment[]>({ method: "GET", path: `subscriptions/${item.subscriptionId}/enrollments` });
      const expected = resolved.filter((candidate) => candidate.subscriptionId === item.subscriptionId);
      assertExactEnrollmentSet(item.subscriptionId, enrollments, expected);
      const placement = await core<PlacementState>({ method: "GET", path: `subscriptions/${item.subscriptionId}/placement`, body: { targetLocalDate: REVIEWED_ENROLLMENT_EFFECTIVE_FROM } });
      if (placement.placementState !== "PLACED" || placement.effectiveEnrollmentCount !== item.expectedWeeklyCommitment) {
        throw new Error(`Subscription ${item.subscriptionId} did not reconcile to PLACED.`);
      }
      placedSubscriptions += 1;
    }
    for (const item of REVIEWED_ENROLLMENT_UNRESOLVED) {
      const placement = await core<PlacementState>({ method: "GET", path: `subscriptions/${item.subscriptionId}/placement`, body: { targetLocalDate: REVIEWED_ENROLLMENT_EFFECTIVE_FROM } });
      if (placement.placementState !== "PENDING_PLACEMENT" || placement.effectiveEnrollmentCount !== 0) {
        throw new Error(`Unresolved double-session subscription ${item.subscriptionId} must remain PENDING_PLACEMENT.`);
      }
    }

    return json({ data: {
      effectiveFromLocalDate: REVIEWED_ENROLLMENT_EFFECTIVE_FROM,
      placedSubscriptions,
      enrollments: resolved.length,
      created,
      reused: resolved.length - created,
      unresolvedSubscriptions: REVIEWED_ENROLLMENT_UNRESOLVED.length,
    } }, 200);
  } catch (error) {
    if (error instanceof BoAuthError) return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, error.status);
    if (error instanceof CoreFailure) return json({ error: { code: "CORE_COMMAND_FAILED", message: error.message, requestId: error.requestId } }, error.status, error.requestId ? { "x-request-id": error.requestId } : {});
    console.error("Reviewed Enrollment activation stopped", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_CONFLICT", message: error instanceof Error ? error.message : "Reviewed Enrollment activation stopped" } }, 409);
  }
}
async function ensureFutureReservationPolicy(
  core: <T>(request: BoAccessRequest) => Promise<T>,
  centerId: string,
): Promise<string> {
  const target = { targetType: "CENTER", targetId: centerId };
  const inspect = () => core<FutureReservationPolicyInspection | null>({
    method: "GET", path: "policies/delivery/future_reservation.v1/stream", body: target,
  });
  let state = await inspect();
  if (state === null) {
    const draft = await core<PolicyDraftResult>({
      method: "POST", path: "policies/delivery/future_reservation.v1/versions",
      body: { ...target, value: { maxDaysAhead: REVIEWED_ENROLLMENT_FUTURE_MAX_DAYS }, changeReason: "Founder-approved F4 reviewed learner roster prerequisite" },
    });
    await core<{ published: boolean }>({
      method: "POST", path: `policies/delivery/future_reservation.v1/versions/${draft.versionId}/publish`,
      body: { ...target, effectiveFrom: new Date().toISOString(), expectedRevision: draft.revision },
    });
    state = await inspect();
  } else {
    const drafts = state.versions.filter((version) => version.storedState === "DRAFT");
    const active = activeFutureReservationVersions(state);
    if (active.length === 0 && drafts.length === 1 && drafts[0]!.value.maxDaysAhead === REVIEWED_ENROLLMENT_FUTURE_MAX_DAYS) {
      await core<{ published: boolean }>({
        method: "POST", path: `policies/delivery/future_reservation.v1/versions/${drafts[0]!.id}/publish`,
        body: { ...target, effectiveFrom: new Date().toISOString(), expectedRevision: state.stream.revision },
      });
      state = await inspect();
    }
  }
  if (state === null || state.versions.some((version) => version.storedState === "DRAFT")) {
    throw new Error("Reviewed future-reservation policy has unresolved draft state.");
  }
  const active = activeFutureReservationVersions(state);
  if (active.length !== 1 || active[0]!.value.maxDaysAhead !== REVIEWED_ENROLLMENT_FUTURE_MAX_DAYS || !active[0]!.effectiveFrom) {
    throw new Error("Reviewed Enrollment activation requires exactly one active CENTER future-reservation policy at 0 days.");
  }
  return active[0]!.effectiveFrom;
}

function activeFutureReservationVersions(state: FutureReservationPolicyInspection) {
  return state.versions.filter((version) => version.storedState === "PUBLISHED" && version.effectiveUntil === null);
}
async function coreData<T>(binding: BoAccessCoreBinding, request: BoAccessRequest, identity: Awaited<ReturnType<typeof authenticateBo>>): Promise<T> {
  const result = await callBoAccessCore(binding, request, identity);
  const payload = result.body as { data?: T; error?: { message?: string } };
  if (result.status < 200 || result.status >= 300 || payload.data === undefined) {
    throw new CoreFailure(result.status, payload.error?.message ?? `Core command failed: ${request.method} ${request.path}`, result.requestId ?? null);
  }
  return payload.data;
}

function resolvePlacements(state: F3BootstrapState, centerId: string): ResolvedPlacement[] {
  const pathByCode = new Map(state.paths.filter((item) => item.status === "ACTIVE").map((item) => [item.code, item]));
  const resolved: ResolvedPlacement[] = [];
  for (const item of REVIEWED_ENROLLMENT_PLAN) {
    const path = pathByCode.get(item.pathCode);
    if (!path) throw new Error(`Reviewed Path is missing: ${item.pathCode}.`);
    for (const placement of item.placements) {
      const matches = state.runningClasses.filter((candidate) => candidate.centerId === centerId && candidate.pathProgramId === path.id
        && candidate.weekdayIso === placement.weekdayIso && candidate.status === "ACTIVE" && classMatches(candidate, item.pathCode, placement));
      if (matches.length !== 1) throw new Error(`Reviewed placement must resolve to exactly one Running Class: ${item.pathCode}/${placement.weekdayIso}.`);
      resolved.push({ subscriptionId: item.subscriptionId, runningClass: matches[0]!, placement });
    }
  }
  if (resolved.length !== 62) throw new Error(`Reviewed Enrollment plan expected 62 placements; resolved ${resolved.length}.`);
  return resolved;
}

function classMatches(candidate: F3RunningClass, pathCode: string, placement: ReviewedEnrollmentPlacement): boolean {
  if (pathCode === "artchitect") {
    if (candidate.deliveryTopology !== "FLEXIBLE_STUDIO" || placement.plannedEntryLocalTime === null || placement.plannedDurationMinutes !== 90) return false;
    const start = minutes(placement.plannedEntryLocalTime), end = start + placement.plannedDurationMinutes;
    return start >= minutes(candidate.windowStartsLocal) && end <= minutes(candidate.windowEndsLocal);
  }
  const expectedTopology = pathCode === "pianohouse" ? "FIXED_COHORT" : "OVERLAPPING_COHORT";
  return candidate.deliveryTopology === expectedTopology && candidate.windowStartsLocal === placement.classStartsLocal
    && candidate.windowEndsLocal === placement.classEndsLocal && placement.plannedEntryLocalTime === null && placement.plannedDurationMinutes === null;
}
function assertReviewedPlanCapacity(state: F3BootstrapState, resolved: ResolvedPlacement[]) {
  const byClass = new Map<string, Array<[number, number]>>();
  const bySpaceDay = new Map<string, Array<[number, number]>>();
  for (const candidate of resolved) {
    const interval = placementInterval(candidate);
    byClass.set(candidate.runningClass.id, [...(byClass.get(candidate.runningClass.id) ?? []), interval]);
    const key = `${candidate.runningClass.learningSpaceId}|${candidate.runningClass.weekdayIso}`;
    bySpaceDay.set(key, [...(bySpaceDay.get(key) ?? []), interval]);
  }
  for (const [classId, intervals] of byClass) {
    const runningClass = state.runningClasses.find((item) => item.id === classId)!;
    if (runningClass.hardConcurrentCapacity !== null && peak(intervals) > runningClass.hardConcurrentCapacity) {
      throw new Error(`Reviewed plan exceeds Running Class hard capacity: ${runningClass.operationalName}.`);
    }
  }
  for (const [key, intervals] of bySpaceDay) {
    const [spaceId] = key.split("|");
    const space = state.learningSpaces.find((item) => item.id === spaceId);
    if (!space) throw new Error(`Learning Space disappeared from reviewed plan: ${spaceId}.`);
    if (space.hardConcurrentCapacity !== null && peak(intervals) > space.hardConcurrentCapacity) {
      throw new Error(`Reviewed plan exceeds Learning Space hard capacity: ${space.displayName}.`);
    }
  }
}

function placementInterval(candidate: ResolvedPlacement): [number, number] {
  if (candidate.runningClass.deliveryTopology === "FLEXIBLE_STUDIO") {
    const start = minutes(candidate.placement.plannedEntryLocalTime!);
    return [start, start + candidate.placement.plannedDurationMinutes!];
  }
  return [minutes(candidate.runningClass.windowStartsLocal), minutes(candidate.runningClass.windowEndsLocal)];
}

function peak(intervals: Array<[number, number]>): number {
  const events = intervals.flatMap(([start, end]) => [{ at: start, delta: 1, order: 1 }, { at: end, delta: -1, order: 0 }]);
  events.sort((a, b) => a.at - b.at || a.order - b.order);
  let current = 0, maximum = 0;
  for (const event of events) { current += event.delta; maximum = Math.max(maximum, current); }
  return maximum;
}
function assertExistingSubset(subscriptionId: string, existing: Enrollment[], expected: ResolvedPlacement[]) {
  for (const enrollment of existing) {
    const matches = expected.filter((candidate) => enrollmentMatches(enrollment, candidate));
    if (matches.length !== 1) throw new Error(`Subscription ${subscriptionId} has unexpected existing Enrollment data.`);
  }
  const unique = new Set(existing.map((item) => item.id));
  if (unique.size !== existing.length) throw new Error(`Subscription ${subscriptionId} has duplicate Enrollment IDs.`);
}

function assertExactEnrollmentSet(subscriptionId: string, existing: Enrollment[], expected: ResolvedPlacement[]) {
  assertExistingSubset(subscriptionId, existing, expected);
  if (existing.length !== expected.length || expected.some((candidate) => !hasExact(existing, candidate))) {
    throw new Error(`Subscription ${subscriptionId} Enrollment reconciliation failed.`);
  }
}

function hasExact(existing: Enrollment[], candidate: ResolvedPlacement): boolean {
  return existing.some((enrollment) => enrollmentMatches(enrollment, candidate));
}

function enrollmentMatches(enrollment: Enrollment, candidate: ResolvedPlacement): boolean {
  return enrollment.subscriptionId === candidate.subscriptionId && enrollment.runningClassId === candidate.runningClass.id
    && enrollment.effectiveFromLocalDate === REVIEWED_ENROLLMENT_EFFECTIVE_FROM && enrollment.effectiveUntilExclusiveLocalDate === null
    && enrollment.plannedEntryLocalTime === candidate.placement.plannedEntryLocalTime
    && enrollment.plannedDurationMinutes === candidate.placement.plannedDurationMinutes;
}

function capacityBody(candidate: ResolvedPlacement) {
  return {
    runningClassId: candidate.runningClass.id,
    targetLocalDate: REVIEWED_ENROLLMENT_EFFECTIVE_FROM,
    subscriptionId: candidate.subscriptionId,
    plannedEntryLocalTime: candidate.placement.plannedEntryLocalTime,
    plannedDurationMinutes: candidate.placement.plannedDurationMinutes,
  };
}

function placementKey(activationKey: string, candidate: ResolvedPlacement) {
  return `${activationKey}:${candidate.subscriptionId}:${candidate.runningClass.id}:${candidate.placement.plannedEntryLocalTime ?? "full"}`;
}
async function parseBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    return value as Record<string, unknown>;
  } catch {
    throw new Error("A JSON request body is required.");
  }
}

function requiredUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${field} must be a canonical UUID.`);
  }
  return value.toLowerCase();
}

function minutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid reviewed local time: ${value}.`);
  return Number(match[1]) * 60 + Number(match[2]);
}

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
