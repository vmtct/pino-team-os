import type { F3BootstrapState, F3LearningSpace, F3Path, F3PolicyStream, F3RunningClass, F3Session } from "./f3-delivery-api";

const E2E_CENTER_KEY = "e2e-comparator";
const PREFIX = "[E2E] PAP-438";
const IDLE_HORIZON_DAYS = 1;

export interface Pap438FixturePort {
  get<T>(path: string): Promise<T>;
  command<T>(method: "POST" | "PATCH", path: string, body: unknown, idempotencyKey?: string): Promise<T>;
}

export function createPap438FetchPort(
  baseUrl = "",
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
  extraHeaders: HeadersInit = {},
): Pap438FixturePort {
  const root = baseUrl.replace(/\/$/, "");
  const invoke = async <T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown, idempotencyKey?: string): Promise<T> => {
    const headers = new Headers(extraHeaders);
    if (body !== undefined) headers.set("content-type", "application/json");
    if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
    const response = await fetcher(`${root}/api/bo/${path}`, {
      method,
      headers,
      credentials: "include",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json() as { data?: T; error?: { message?: string; requestId?: string } };
    if (!response.ok || payload.data === undefined) {
      const detail = payload.error?.message ?? `PAP-438 BO ${method} ${path} failed (${response.status}).`;
      throw new Error(payload.error?.requestId ? `${detail} [request ${payload.error.requestId}]` : detail);
    }
    return payload.data;
  };
  return {
    get: <T>(path: string) => invoke<T>("GET", path),
    command: <T>(method: "POST" | "PATCH", path: string, body: unknown, idempotencyKey?: string) => invoke<T>(method, path, body, idempotencyKey),
  };
}

export interface Pap438DeliveryFixture {
  runTag: string;
  centerId: string;
  path: F3Path;
  space: F3LearningSpace;
  runningClass: F3RunningClass;
  startsOnLocalDate: string;
  testHorizonDays: number;
  initialPolicyMode: "ABSENT" | "IDLE_BASELINE";
  initialGlobalPolicyMode: "ABSENT" | "EFFECTIVE";
  draft: { streamId: string; versionId: string; version: number; revision: number };
}

export type Pap438MaterializationResult = { policy: { horizonDays: number }; attempted: number; materialized: number; existing: number; excluded: number; noOccurrence: number };

export interface Pap438MaterializedFixture extends Pap438DeliveryFixture {
  policyEffectiveAt: string;
  materialization: Pap438MaterializationResult;
  session: F3Session;
}

export async function preparePap438DeliveryFixture(
  port: Pap438FixturePort,
  runId: string,
  now = new Date(),
  testHorizonDays = 3,
): Promise<Pap438DeliveryFixture> {
  const runTag = normalizeRunTag(runId);
  if (!Number.isInteger(testHorizonDays) || testHorizonDays < 2 || testHorizonDays > 6) {
    throw new Error("PAP-438 test horizon must be an integer from 2 to 6 days.");
  }
  const state = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  const centers = state.centers.filter((item) => item.centerKey === E2E_CENTER_KEY && item.status.toLowerCase() === "active");
  if (centers.length !== 1) throw new Error(`PAP-438 requires exactly one active ${E2E_CENTER_KEY} Center; found ${centers.length}.`);
  const centerId = centers[0]!.id;

  const preexistingActiveClasses = state.activeRunningClasses.filter((item) => item.centerId === centerId);
  if (preexistingActiveClasses.length) throw new Error("PAP-438 requires the E2E Comparator Center to have zero active Running Classes before fixture preparation.");

  const globalStreams = state.materializationPolicyStreams.filter((item) => item.targetType === "GLOBAL");
  if (globalStreams.length > 1) throw new Error("PAP-438 found multiple GLOBAL materialization streams.");
  const globalStream = globalStreams[0] ?? null;
  const initialGlobalPolicyMode = globalStream?.publishedVersionId && globalStream.publishedValue ? "EFFECTIVE" as const : "ABSENT" as const;

  const centerStreams = state.materializationPolicyStreams.filter((item) => item.targetType === "CENTER" && item.targetId === centerId);
  if (centerStreams.length > 1) throw new Error("PAP-438 found multiple CENTER materialization streams.");
  const stream = centerStreams[0] ?? null;
  const initialPolicyMode = validateIdlePolicy(stream);

  const startsOnLocalDate = houseLocalDate(addDays(now, 1));
  const weekdayIso = isoWeekday(startsOnLocalDate);
  const path = await ensurePath(port, state, runTag);
  const space = await ensureSpace(port, state, centerId, runTag);
  const runningClass = await ensureClass(port, state, centerId, path.id, space.id, runTag, weekdayIso);
  const preparedState = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  assertExactActiveClass(preparedState, centerId, runningClass, path.id, space.id, runTag);

  const draftBody = {
    targetType: "CENTER",
    targetId: centerId,
    value: { horizonDays: testHorizonDays },
    changeReason: `${PREFIX} ${runTag} bounded materialization proof`,
    ...(stream ? { expectedRevision: stream.revision } : {}),
  };
  const draft = await port.command<{ streamId: string; versionId: string; version: number; revision: number }>(
    "POST",
    "policies/delivery/materialization.v1/versions",
    draftBody,
    replayKey(runTag, "policy-draft"),
  );

  return { runTag, centerId, path, space, runningClass, startsOnLocalDate, testHorizonDays, initialPolicyMode, initialGlobalPolicyMode, draft };
}

export async function provePap438DraftOnlyBehavior(port: Pap438FixturePort, fixture: Pap438DeliveryFixture, probeEffectiveAt = new Date().toISOString()) {
  if (fixture.initialPolicyMode === "ABSENT") {
    if (fixture.initialGlobalPolicyMode === "EFFECTIVE") {
      return { mode: "GLOBAL_FALLBACK_REMAINS_EFFECTIVE" as const, note: "The CENTER Draft is non-effective, but an already-published GLOBAL policy remains authoritative; no materialization probe is executed." };
    }
    try {
      await port.command("POST", "delivery/materializations", {
        centerId: fixture.centerId,
        startsOnLocalDate: fixture.startsOnLocalDate,
        effectiveAt: probeEffectiveAt,
      }, replayKey(fixture.runTag, "draft-only-probe"));
    } catch (error) {
      return { mode: "NO_EFFECTIVE_POLICY_BLOCKED" as const, message: error instanceof Error ? error.message : String(error) };
    }
    throw new Error("PAP-438 draft-only probe unexpectedly materialized without any effective CENTER/GLOBAL policy.");
  }
  return {
    mode: "BASELINE_REMAINS_EFFECTIVE" as const,
    horizonDays: IDLE_HORIZON_DAYS,
    note: "A Draft never overrides the already-published E2E idle baseline until explicit publish.",
  };
}

export async function publishAndMaterializePap438Fixture(
  port: Pap438FixturePort,
  fixture: Pap438DeliveryFixture,
  publishAt = new Date(),
): Promise<Pap438MaterializedFixture> {
  const beforePublish = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  assertExactActiveClass(beforePublish, fixture.centerId, fixture.runningClass, fixture.path.id, fixture.space.id, fixture.runTag);
  const effectiveFrom = publishAt.toISOString();
  await port.command("POST", `policies/delivery/materialization.v1/versions/${fixture.draft.versionId}/publish`, {
    targetType: "CENTER",
    targetId: fixture.centerId,
    effectiveFrom,
    expectedRevision: fixture.draft.revision,
  }, replayKey(fixture.runTag, "policy-publish"));

  const policyEffectiveAt = new Date(publishAt.getTime() + 1000).toISOString();
  const materialization = await port.command<Pap438MaterializationResult>("POST", "delivery/materializations", {
    centerId: fixture.centerId,
    startsOnLocalDate: fixture.startsOnLocalDate,
    effectiveAt: policyEffectiveAt,
  }, replayKey(fixture.runTag, "materialize"));
  if (materialization.policy.horizonDays !== fixture.testHorizonDays) throw new Error("PAP-438 materializer did not resolve the published test horizon.");
  if (materialization.materialized + materialization.existing !== 1 || materialization.attempted !== 1 || materialization.excluded !== 0 || materialization.noOccurrence !== 0) {
    throw new Error("PAP-438 bounded materialization did not reconcile to exactly one synthetic occurrence.");
  }

  const readback = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  const sessions = readback.upcomingSessions.filter((item) => item.runningClassId === fixture.runningClass.id && item.localDate === fixture.startsOnLocalDate && item.centerId === fixture.centerId);
  if (sessions.length !== 1) throw new Error(`PAP-438 expected exactly one synthetic Session readback; found ${sessions.length}.`);
  return { ...fixture, policyEffectiveAt, materialization, session: sessions[0]! };
}

export async function cleanupPap438DeliveryFixture(
  port: Pap438FixturePort,
  fixture: Pap438MaterializedFixture,
  cleanupAt = new Date(),
) {
  const state = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  const stream = requireSingleCenterStream(state, fixture.centerId);
  if (stream.draftVersionId) throw new Error("PAP-438 cleanup refuses unresolved policy Draft state.");
  if (stream.publishedValue?.horizonDays !== fixture.testHorizonDays) throw new Error("PAP-438 cleanup refuses policy drift away from its exact test horizon.");

  const baselineDraft = await port.command<{ streamId: string; versionId: string; version: number; revision: number }>("POST", "policies/delivery/materialization.v1/versions", {
    targetType: "CENTER",
    targetId: fixture.centerId,
    value: { horizonDays: IDLE_HORIZON_DAYS },
    changeReason: `${PREFIX} idle baseline after ${fixture.runTag}`,
    expectedRevision: stream.revision,
  }, replayKey(fixture.runTag, "baseline-draft"));
  await port.command("POST", `policies/delivery/materialization.v1/versions/${baselineDraft.versionId}/publish`, {
    targetType: "CENTER",
    targetId: fixture.centerId,
    effectiveFrom: cleanupAt.toISOString(),
    expectedRevision: baselineDraft.revision,
  }, replayKey(fixture.runTag, "baseline-publish"));

  const latest = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  const runningClass = latest.runningClasses.find((item) => item.id === fixture.runningClass.id);
  if (runningClass?.status === "ACTIVE") await port.command("POST", `delivery/running-classes/${runningClass.id}/lifecycle`, { status: "ARCHIVED", expectedVersion: runningClass.version });
  const space = latest.learningSpaces.find((item) => item.id === fixture.space.id);
  if (space?.status === "ACTIVE") await port.command("POST", `delivery/learning-spaces/${space.id}/lifecycle`, { status: "ARCHIVED", expectedVersion: space.version });
  const path = latest.paths.find((item) => item.id === fixture.path.id);
  if (path?.status === "ACTIVE") await port.command("PATCH", `catalog/paths/${path.id}`, {
    code: path.code,
    displayName: path.displayName,
    status: "ARCHIVED",
    expectedVersion: path.version,
  });

  const finalState = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  const finalStream = requireSingleCenterStream(finalState, fixture.centerId);
  if (finalStream.draftVersionId || finalStream.publishedValue?.horizonDays !== IDLE_HORIZON_DAYS) throw new Error("PAP-438 final policy readback is not the canonical idle baseline.");
  const activeTopology = [
    ...finalState.paths.filter((item) => item.id === fixture.path.id && item.status === "ACTIVE"),
    ...finalState.learningSpaces.filter((item) => item.id === fixture.space.id && item.status === "ACTIVE"),
    ...finalState.runningClasses.filter((item) => item.id === fixture.runningClass.id && item.status === "ACTIVE"),
  ];
  if (activeTopology.length) throw new Error("PAP-438 cleanup readback found active synthetic topology.");
  const retained = finalState.upcomingSessions.filter((item) => item.id === fixture.session.id);
  if (retained.length !== 1) throw new Error("PAP-438 cleanup lost the bounded synthetic Session provenance required downstream.");
  return { cleaned: true as const, idleHorizonDays: IDLE_HORIZON_DAYS, retainedSessionId: fixture.session.id };
}

function assertExactActiveClass(state: F3BootstrapState, centerId: string, runningClass: F3RunningClass, pathId: string, spaceId: string, runTag: string) {
  const active = state.activeRunningClasses.filter((item) => item.centerId === centerId);
  if (active.length !== 1 || active[0]!.id !== runningClass.id) throw new Error("PAP-438 requires exactly one active E2E Comparator Running Class and it must be the exact fixture class before materialization.");
  const current = active[0]!;
  const expectedName = `${PREFIX} ${runTag} Horizon`;
  if (current.operationalName !== expectedName || current.pathProgramId !== pathId || current.learningSpaceId !== spaceId || current.status !== "ACTIVE") {
    throw new Error("PAP-438 active fixture Running Class drifted from its exact synthetic topology.");
  }
}

function validateIdlePolicy(stream: F3PolicyStream | null): "ABSENT" | "IDLE_BASELINE" {
  if (!stream) return "ABSENT";
  if (stream.draftVersionId) throw new Error("PAP-438 requires no pre-existing CENTER materialization Draft.");
  if (stream.publishedValue?.horizonDays !== IDLE_HORIZON_DAYS || !stream.publishedVersionId) throw new Error("PAP-438 requires the E2E Comparator materialization stream to be absent or at idle horizon=1.");
  return "IDLE_BASELINE";
}

function requireSingleCenterStream(state: F3BootstrapState, centerId: string) {
  const streams = state.materializationPolicyStreams.filter((item) => item.targetType === "CENTER" && item.targetId === centerId);
  if (streams.length !== 1) throw new Error(`PAP-438 expected one CENTER materialization stream; found ${streams.length}.`);
  return streams[0]!;
}

async function ensurePath(port: Pap438FixturePort, state: F3BootstrapState, runTag: string) {
  const code = `e2e-pap438-${runTag}`;
  const displayName = `${PREFIX} ${runTag}`;
  const existing = state.paths.find((item) => item.code === code);
  if (existing) {
    assertSynthetic(existing.displayName, runTag, "Path");
    if (existing.status === "ACTIVE") return existing;
    return port.command<F3Path>("PATCH", `catalog/paths/${existing.id}`, { code, displayName, status: "ACTIVE", expectedVersion: existing.version });
  }
  return port.command<F3Path>("POST", "catalog/paths", { code, displayName, status: "ACTIVE" }, replayKey(runTag, "path-create"));
}

async function ensureSpace(port: Pap438FixturePort, state: F3BootstrapState, centerId: string, runTag: string) {
  const code = `pap438-${runTag}`;
  const displayName = `${PREFIX} ${runTag} Space`;
  const existing = state.learningSpaces.find((item) => item.centerId === centerId && item.code === code);
  if (existing) {
    assertSynthetic(existing.displayName, runTag, "Learning Space");
    if (existing.status === "ACTIVE") return existing;
    return port.command<F3LearningSpace>("POST", `delivery/learning-spaces/${existing.id}/lifecycle`, { status: "ACTIVE", expectedVersion: existing.version });
  }
  return port.command<F3LearningSpace>("POST", "delivery/learning-spaces", { centerId, code, displayName, optimalConcurrentCapacity: 4, hardConcurrentCapacity: 4, status: "ACTIVE" });
}

async function ensureClass(port: Pap438FixturePort, state: F3BootstrapState, centerId: string, pathId: string, spaceId: string, runTag: string, weekdayIso: number) {
  const operationalName = `${PREFIX} ${runTag} Horizon`;
  const existing = state.runningClasses.find((item) => item.centerId === centerId && item.operationalName === operationalName);
  if (existing) {
    if (existing.pathProgramId !== pathId || existing.learningSpaceId !== spaceId) throw new Error("PAP-438 Running Class collides with non-fixture topology.");
    if (existing.status === "ACTIVE") return existing;
    return port.command<F3RunningClass>("POST", `delivery/running-classes/${existing.id}/lifecycle`, { status: "ACTIVE", expectedVersion: existing.version });
  }
  return port.command<F3RunningClass>("POST", "delivery/running-classes", {
    centerId,
    pathProgramId: pathId,
    learningSpaceId: spaceId,
    operationalName,
    weekdayIso,
    windowStartsLocal: "18:00",
    windowEndsLocal: "19:30",
    deliveryTopology: "FLEXIBLE_STUDIO",
    defaultParticipationMinutes: 90,
    optimalConcurrentCapacity: 4,
    hardConcurrentCapacity: 4,
    status: "ACTIVE",
  });
}

function assertSynthetic(value: string, runTag: string, kind: string) {
  if (!value.startsWith(`${PREFIX} ${runTag}`)) throw new Error(`PAP-438 ${kind} is not a bounded synthetic resource.`);
}

export function normalizeRunTag(runId: string) {
  const value = runId.trim().toLowerCase();
  if (!/^[a-z0-9]{1,16}$/.test(value)) throw new Error("PAP-438 run id must be 1-16 lowercase alphanumeric characters.");
  return value;
}

function replayKey(runTag: string, action: string) { return `pap438:${runTag}:${action}`; }

function houseLocalDate(value: Date) {
  if (Number.isNaN(value.getTime())) throw new Error("PAP-438 requires a valid instant.");
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(value: Date, days: number) { const next = new Date(value.getTime()); next.setUTCDate(next.getUTCDate() + days); return next; }
function isoWeekday(localDate: string) { const day = new Date(`${localDate}T12:00:00+07:00`).getUTCDay(); return day === 0 ? 7 : day; }
