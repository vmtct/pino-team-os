import type { BoLearnerLifecycle, BoLearnerSubscription, BoProductPlan, BoSaleResult } from "./bo-model";
import type { F3BootstrapState, F3LearningSpace, F3Path, F3RunningClass } from "./f3-delivery-api";

const E2E_CENTER_KEY = "e2e-comparator";
const PREFIX = "[E2E] PAP-437";

export interface Pap437FixturePort {
  get<T>(path: string): Promise<T>;
  command<T>(method: "POST" | "PATCH", path: string, body: unknown, idempotencyKey?: string): Promise<T>;
}

export function createPap437FetchPort(
  baseUrl = "",
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
  extraHeaders: HeadersInit = {},
): Pap437FixturePort {
  const root = baseUrl.replace(/\/$/, "");
  const invoke = async <T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown, idempotencyKey?: string): Promise<T> => {
    const headers = new Headers(extraHeaders);
    if (body !== undefined) headers.set("content-type", "application/json");
    if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
    const response = await fetcher(`${root}/api/bo/${path}`, {
      method, headers, credentials: "include", ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json() as { data?: T; error?: { message?: string; requestId?: string } };
    if (!response.ok || payload.data === undefined) {
      const detail = payload.error?.message ?? `PAP-437 BO ${method} ${path} failed (${response.status}).`;
      throw new Error(payload.error?.requestId ? `${detail} [request ${payload.error.requestId}]` : detail);
    }
    return payload.data;
  };
  return {
    get: <T>(path: string) => invoke<T>("GET", path),
    command: <T>(method: "POST" | "PATCH", path: string, body: unknown, idempotencyKey?: string) => invoke<T>(method, path, body, idempotencyKey),
  };
}

export interface Pap437StudentIntake {
  studentProfileId: string;
  parentUserId: string;
  guardianRelationshipId: string;
  parentReused: boolean;
}

export interface Pap437Fixture {
  runTag: string;
  centerId: string;
  path: F3Path;
  space: F3LearningSpace;
  happyClasses: [F3RunningClass, F3RunningClass];
  blockedClass: F3RunningClass;
  productPlan: BoProductPlan;
  learners: { a: Pap437StudentIntake; b: Pap437StudentIntake; guard: Pap437StudentIntake };
  sales: { a: BoSaleResult; b: BoSaleResult };
  guardSubscription: BoLearnerSubscription;
  guardEnrollmentId: string;
  replay: {
    saleA: { idempotencyKey: string; body: Record<string, unknown> };
    saleB: { idempotencyKey: string; body: Record<string, unknown> };
  };
}

export type Pap437BulkBody = {
  subscriptions: Array<{
    subscriptionId: string;
    expectedPathProgramId: string;
    expectedWeeklyCommitment: number;
    placements: Array<{ runningClassId: string; effectiveFromLocalDate: string }>;
  }>;
  pendingSubscriptions: [];
  commandEffectiveLocalDate: string;
  policyEffectiveAt: string;
};

type LifecycleResult = { id: string; version: number; status: string };
type EnrollmentResult = { enrollment?: { id: string }; id?: string };

export async function preparePap437CommercialFixture(
  port: Pap437FixturePort,
  runId: string,
  now = new Date(),
): Promise<Pap437Fixture> {
  const runTag = normalizeRunTag(runId);
  const localDate = houseLocalDate(now);
  const bootstrap = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  const centers = bootstrap.centers.filter((item) => item.centerKey === E2E_CENTER_KEY && item.status.toLowerCase() === "active");
  if (centers.length !== 1) throw new Error(`PAP-437 requires exactly one active ${E2E_CENTER_KEY} Center; found ${centers.length}.`);
  const centerId = centers[0]!.id;

  const productPlans = await port.get<BoProductPlan[]>("billing/product-plans");
  const productPlan = productPlans.find((item) => item.enabled && item.cadence === 2 && item.termWeeks === 12);
  if (!productPlan) throw new Error("PAP-437 requires an enabled 2x/week 12-week Product Plan; fixture will not mutate global plan config.");

  const path = await ensurePath(port, bootstrap, runTag);
  const space = await ensureSpace(port, bootstrap, centerId, runTag);
  const happyA = await ensureClass(port, bootstrap, centerId, path.id, space.id, runTag, "happy-a", 1, 8);
  const happyB = await ensureClass(port, bootstrap, centerId, path.id, space.id, runTag, "happy-b", 3, 8);
  const blockedClass = await ensureClass(port, bootstrap, centerId, path.id, space.id, runTag, "blocked", 5, 1);

  assertSyntheticTopology(centerId, path, space, [happyA, happyB, blockedClass], runTag);

  const learnerA = await createLearner(port, runTag, "a", localDate);
  const learnerB = await createLearner(port, runTag, "b", localDate, learnerA.parentUserId);
  const guard = await createLearner(port, runTag, "guard", localDate, learnerA.parentUserId);

  const saleABody = saleBody(learnerA, path.id, centerId, productPlan.id, localDate, runTag, "a");
  const saleBBody = saleBody(learnerB, path.id, centerId, productPlan.id, localDate, runTag, "b");
  const saleAKey = replayKey(runTag, "sale-a");
  const saleBKey = replayKey(runTag, "sale-b");
  const saleA = await port.command<BoSaleResult>("POST", "billing/sales", saleABody, saleAKey);
  const saleB = await port.command<BoSaleResult>("POST", "billing/sales", saleBBody, saleBKey);
  assertSale(saleA, learnerA.studentProfileId, path.id, productPlan.id);
  assertSale(saleB, learnerB.studentProfileId, path.id, productPlan.id);

  const guardSubscription = await port.command<BoLearnerSubscription>("POST", "subscriptions", {
    studentProfileId: guard.studentProfileId,
    pathProgramId: path.id,
    serviceStartsOn: localDate,
    contractualEndsOn: houseLocalDate(addDays(now, 84)),
    weeklyCommitment: 1,
    purchasedUnits: 12,
    commercialReference: `${PREFIX} ${runTag} capacity-guard`,
  }, replayKey(runTag, "guard-subscription"));
  if (guardSubscription.studentProfileId !== guard.studentProfileId || guardSubscription.pathProgramId !== path.id || guardSubscription.weeklyCommitment !== 1) {
    throw new Error("PAP-437 guard Subscription did not bind to the synthetic learner/path.");
  }

  const guardEnrollment = await port.command<EnrollmentResult>("POST", "enrollments", {
    subscriptionId: guardSubscription.id,
    runningClassId: blockedClass.id,
    effectiveFromLocalDate: localDate,
    commandEffectiveLocalDate: localDate,
    policyEffectiveAt: now.toISOString(),
  }, replayKey(runTag, "guard-placement"));
  const guardEnrollmentId = guardEnrollment.enrollment?.id ?? guardEnrollment.id;
  if (!guardEnrollmentId) throw new Error("PAP-437 capacity guard placement returned no canonical Enrollment id.");

  return {
    runTag,
    centerId,
    path,
    space,
    happyClasses: [happyA, happyB],
    blockedClass,
    productPlan,
    learners: { a: learnerA, b: learnerB, guard },
    sales: { a: saleA, b: saleB },
    guardSubscription,
    guardEnrollmentId,
    replay: {
      saleA: { idempotencyKey: saleAKey, body: saleABody },
      saleB: { idempotencyKey: saleBKey, body: saleBBody },
    },
  };
}

export function pap437HappyBulkBody(fixture: Pap437Fixture, effectiveFromLocalDate: string, policyEffectiveAt: string): Pap437BulkBody {
  return bulkBody(fixture, effectiveFromLocalDate, policyEffectiveAt, false);
}

export function pap437AtomicFailureBulkBody(fixture: Pap437Fixture, effectiveFromLocalDate: string, policyEffectiveAt: string): Pap437BulkBody {
  return bulkBody(fixture, effectiveFromLocalDate, policyEffectiveAt, true);
}

export async function cleanupPap437CommercialFixture(port: Pap437FixturePort, fixture: Pap437Fixture, now = new Date()) {
  const releaseLocalDate = houseLocalDate(now);
  const studentIds = [fixture.learners.a.studentProfileId, fixture.learners.b.studentProfileId, fixture.learners.guard.studentProfileId];

  for (const studentId of studentIds) {
    const lifecycle = await port.get<BoLearnerLifecycle>(`students/${studentId}/lifecycle`);
    for (const entry of lifecycle.subscriptions) {
      if (entry.subscription.lifecycle !== "ACTIVE") continue;
      await port.command("POST", `subscriptions/${entry.subscription.id}/neutralize`, {
        expectedVersion: entry.subscription.version,
        releaseLocalDate,
        reason: `${PREFIX} ${fixture.runTag} cleanup`,
      }, replayKey(fixture.runTag, `neutralize-${entry.subscription.id}`));
    }
  }

  for (const sale of [fixture.sales.a, fixture.sales.b]) {
    const bill = await port.get<{ bill: { id: string; version: number; voidedAt: string | null } }>(`billing/bills/${sale.bill.bill.id}`);
    if (!bill.bill.voidedAt) {
      await port.command("POST", `billing/bills/${bill.bill.id}/void`, {
        expectedVersion: bill.bill.version,
        reason: `${PREFIX} ${fixture.runTag} cleanup`,
      }, replayKey(fixture.runTag, `void-bill-${bill.bill.id}`));
    }
  }

  const latestBootstrap = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  for (const runningClass of [fixture.happyClasses[0], fixture.happyClasses[1], fixture.blockedClass]) {
    const latest = latestBootstrap.runningClasses.find((item) => item.id === runningClass.id);
    if (latest?.status === "ACTIVE") await port.command<LifecycleResult>("POST", `delivery/running-classes/${latest.id}/lifecycle`, { status: "ARCHIVED", expectedVersion: latest.version });
  }
  const latestSpace = latestBootstrap.learningSpaces.find((item) => item.id === fixture.space.id);
  if (latestSpace?.status === "ACTIVE") await port.command<LifecycleResult>("POST", `delivery/learning-spaces/${latestSpace.id}/lifecycle`, { status: "ARCHIVED", expectedVersion: latestSpace.version });

  for (const studentId of studentIds) {
    const lifecycle = await port.get<BoLearnerLifecycle>(`students/${studentId}/lifecycle`);
    if (lifecycle.student.status !== "ARCHIVED") {
      await port.command("POST", `student-intakes/${studentId}/void`, {
        expectedStudentVersion: lifecycle.student.version,
        reason: `${PREFIX} ${fixture.runTag} cleanup`,
      }, replayKey(fixture.runTag, `void-student-${studentId}`));
    }
  }

  const finalBootstrap = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  const finalPath = finalBootstrap.paths.find((item) => item.id === fixture.path.id);
  if (finalPath?.status === "ACTIVE") {
    await port.command<F3Path>("PATCH", `catalog/paths/${finalPath.id}`, {
      code: finalPath.code,
      displayName: finalPath.displayName,
      status: "ARCHIVED",
      expectedVersion: finalPath.version,
    });
  }

  const readback = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  const stillActive = [
    ...readback.paths.filter((item) => item.id === fixture.path.id && item.status === "ACTIVE"),
    ...readback.learningSpaces.filter((item) => item.id === fixture.space.id && item.status === "ACTIVE"),
    ...readback.runningClasses.filter((item) => [fixture.happyClasses[0].id, fixture.happyClasses[1].id, fixture.blockedClass.id].includes(item.id) && item.status === "ACTIVE"),
  ];
  if (stillActive.length) throw new Error("PAP-437 cleanup readback found active synthetic topology.");
  return { cleaned: true as const, readbackAt: readback.asOf };
}

function bulkBody(fixture: Pap437Fixture, effectiveFromLocalDate: string, policyEffectiveAt: string, blocked: boolean): Pap437BulkBody {
  const placements = (subscriptionId: string, useBlocked: boolean) => ({
    subscriptionId,
    expectedPathProgramId: fixture.path.id,
    expectedWeeklyCommitment: fixture.productPlan.cadence,
    placements: [
      { runningClassId: useBlocked ? fixture.blockedClass.id : fixture.happyClasses[0].id, effectiveFromLocalDate },
      { runningClassId: fixture.happyClasses[1].id, effectiveFromLocalDate },
    ],
  });
  return {
    subscriptions: [placements(fixture.sales.a.subscriptionId, false), placements(fixture.sales.b.subscriptionId, blocked)],
    pendingSubscriptions: [],
    commandEffectiveLocalDate: houseLocalDateFromInstant(policyEffectiveAt),
    policyEffectiveAt,
  };
}

async function ensurePath(port: Pap437FixturePort, bootstrap: F3BootstrapState, runTag: string): Promise<F3Path> {
  const code = `e2e-pap437-${runTag}`;
  const name = `${PREFIX} ${runTag}`;
  const existing = bootstrap.paths.find((item) => item.code === code);
  if (existing) {
    assertSyntheticName(existing.displayName, runTag, "Path");
    if (existing.status === "ACTIVE") return existing;
    return port.command<F3Path>("PATCH", `catalog/paths/${existing.id}`, { code, displayName: name, status: "ACTIVE", expectedVersion: existing.version });
  }
  return port.command<F3Path>("POST", "catalog/paths", { code, displayName: name, status: "ACTIVE" });
}

async function ensureSpace(port: Pap437FixturePort, bootstrap: F3BootstrapState, centerId: string, runTag: string): Promise<F3LearningSpace> {
  const code = `pap437-${runTag}`;
  const name = `${PREFIX} ${runTag} Space`;
  const existing = bootstrap.learningSpaces.find((item) => item.centerId === centerId && item.code === code);
  if (existing) {
    assertSyntheticName(existing.displayName, runTag, "Learning Space");
    if (existing.status === "ACTIVE") return existing;
    return port.command<F3LearningSpace>("POST", `delivery/learning-spaces/${existing.id}/lifecycle`, { status: "ACTIVE", expectedVersion: existing.version });
  }
  return port.command<F3LearningSpace>("POST", "delivery/learning-spaces", {
    centerId, code, displayName: name, optimalConcurrentCapacity: 8, hardConcurrentCapacity: 8, status: "ACTIVE",
  });
}

async function ensureClass(port: Pap437FixturePort, bootstrap: F3BootstrapState, centerId: string, pathId: string, spaceId: string, runTag: string, suffix: string, weekdayIso: number, hard: number): Promise<F3RunningClass> {
  const name = `${PREFIX} ${runTag} ${suffix}`;
  const existing = bootstrap.runningClasses.find((item) => item.centerId === centerId && item.operationalName === name);
  if (existing) {
    if (existing.pathProgramId !== pathId || existing.learningSpaceId !== spaceId) throw new Error(`PAP-437 ${suffix} class collides with a non-fixture topology.`);
    if (existing.status === "ACTIVE") return existing;
    return port.command<F3RunningClass>("POST", `delivery/running-classes/${existing.id}/lifecycle`, { status: "ACTIVE", expectedVersion: existing.version });
  }
  return port.command<F3RunningClass>("POST", "delivery/running-classes", {
    centerId,
    pathProgramId: pathId,
    learningSpaceId: spaceId,
    operationalName: name,
    weekdayIso,
    windowStartsLocal: "18:00",
    windowEndsLocal: "19:30",
    deliveryTopology: "FIXED_COHORT",
    defaultParticipationMinutes: 90,
    optimalConcurrentCapacity: hard,
    hardConcurrentCapacity: hard,
    status: "ACTIVE",
  });
}

async function createLearner(port: Pap437FixturePort, runTag: string, suffix: string, effectiveFrom: string, existingParentUserId?: string) {
  const common = {
    displayName: `${PREFIX} ${runTag} ${suffix.toUpperCase()}`,
    birthYear: 2018,
    birthMonth: null,
    birthDay: null,
    birthPrecision: "YEAR_ONLY",
    relationshipType: "PARENT",
    effectiveFrom,
  };
  const body = existingParentUserId
    ? { ...common, existingParentUserId }
    : { ...common, existingParentUserId: null, guardianDisplayName: `${PREFIX} ${runTag} Parent`, contactType: "EMAIL", contactValue: `pap437+${runTag}@example.invalid` };
  return port.command<Pap437StudentIntake>("POST", "student-intakes", body, replayKey(runTag, `intake-${suffix}`));
}

function saleBody(learner: Pap437StudentIntake, pathProgramId: string, centerId: string, productPlanId: string, contractualStartsOn: string, runTag: string, suffix: string) {
  return {
    payerParentUserId: learner.parentUserId,
    studentProfileId: learner.studentProfileId,
    pathProgramId,
    centerId,
    productPlanId,
    contractualStartsOn,
    itemDiscountMinor: 0,
    billDiscountMinor: 0,
    campaignReference: `${PREFIX} ${runTag} ${suffix}`,
  };
}

function assertSale(sale: BoSaleResult, studentId: string, pathId: string, productPlanId: string) {
  if (sale.billItem.studentProfileId !== studentId || sale.billItem.productPlanId !== productPlanId || !sale.subscriptionId) throw new Error("PAP-437 Billing sale did not bind to the expected synthetic learner/Product Plan.");
  if (!sale.billItem.subscriptionId || sale.billItem.subscriptionId !== sale.subscriptionId) throw new Error("PAP-437 Billing sale Subscription identity is inconsistent.");
  if (!sale.productPlan || sale.productPlan.id !== productPlanId || sale.productPlan.cadence !== 2) throw new Error("PAP-437 Billing sale changed Product Plan semantics.");
  if (!pathId) throw new Error("PAP-437 synthetic Path identity is missing.");
}

function assertSyntheticTopology(centerId: string, path: F3Path, space: F3LearningSpace, classes: F3RunningClass[], runTag: string) {
  assertSyntheticName(path.displayName, runTag, "Path");
  assertSyntheticName(space.displayName, runTag, "Learning Space");
  if (space.centerId !== centerId) throw new Error("PAP-437 Learning Space escaped E2E Comparator Center.");
  for (const item of classes) {
    assertSyntheticName(item.operationalName, runTag, "Running Class");
    if (item.centerId !== centerId || item.pathProgramId !== path.id || item.learningSpaceId !== space.id) throw new Error("PAP-437 Running Class escaped synthetic topology.");
  }
}

function assertSyntheticName(value: string, runTag: string, kind: string) {
  if (!value.startsWith(`${PREFIX} ${runTag}`)) throw new Error(`PAP-437 ${kind} is not a synthetic ${PREFIX} resource.`);
}

export function normalizeRunTag(runId: string) {
  const value = runId.trim().toLowerCase();
  if (!/^[a-z0-9]{1,16}$/.test(value)) throw new Error("PAP-437 run id must be 1-16 lowercase alphanumeric characters.");
  return value;
}

function replayKey(runTag: string, action: string) {
  return `pap437:${runTag}:${action}`;
}

function houseLocalDate(value: Date) {
  if (Number.isNaN(value.getTime())) throw new Error("PAP-437 requires a valid instant.");
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function houseLocalDateFromInstant(value: string) {
  return houseLocalDate(new Date(value));
}

function addDays(value: Date, days: number) {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
