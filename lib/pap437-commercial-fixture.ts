import type { BoLearnerLifecycle, BoLearnerSubscription, BoParentSearchResult, BoProductPlan, BoSaleResult, BoStudentIntakeVoidResult } from "./bo-model";
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
  createdContactIdentifierId: string | null;
  parentReused: boolean;
}

export interface Pap437Fixture {
  runTag: string;
  generation: number;
  attemptToken: string | null;
  operationTag: string;
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
  parentContactValue: string;
  replay: {
    saleA: { idempotencyKey: string; body: Record<string, unknown> };
    saleB: { idempotencyKey: string; body: Record<string, unknown> };
  };
}

export type Pap437RollbackPendingOperation =
  | { kind: "INTAKE"; label: "a" | "b" | "guard"; idempotencyKey: string; body: Record<string, unknown> }
  | { kind: "SALE"; label: "a" | "b"; idempotencyKey: string; body: Record<string, unknown> }
  | { kind: "SUBSCRIPTION"; label: "guard"; idempotencyKey: string; body: Record<string, unknown> }
  | { kind: "VOID_INTAKE"; label: "a" | "dependent"; studentProfileId: string; idempotencyKey: string; body: Record<string, unknown> };

export interface Pap437RollbackState {
  runTag: string;
  generation: number;
  attemptToken: string | null;
  operationTag: string;
  nowIso: string;
  parentContactValue: string;
  parentUserId: string | null;
  ownsParentContact: boolean | null;
  parentDisposition: BoStudentIntakeVoidResult["parentDisposition"] | null;
  centerId: string;
  pathId: string | null;
  spaceId: string | null;
  classIds: string[];
  learnerIds: string[];
  billIds: string[];
  pendingOperations: Pap437RollbackPendingOperation[];
}

export class Pap437RollbackIncompleteError extends Error {
  constructor(
    message: string,
    public readonly rollbackState: Pap437RollbackState,
    public readonly rollbackErrors: string[],
  ) {
    super(message);
    this.name = "Pap437RollbackIncompleteError";
  }
}

export async function resumePap437CommercialRollback(port: Pap437FixturePort, state: Pap437RollbackState) {
  const errors = await rollbackPap437OwnedPreparation(port, state);
  if (errors.length) {
    throw new Pap437RollbackIncompleteError(
      `PAP-437 rollback remains incomplete: ${errors.join(" | ")}`,
      state,
      errors,
    );
  }
  return { cleaned: true as const, rollbackState: state };
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
  const generation = nextTopologyGeneration(bootstrap, centerId, runTag);
  const attemptToken = newTopologyAttemptToken();

  const productPlans = await port.get<BoProductPlan[]>("billing/product-plans");
  const productPlan = productPlans.find((item) => item.enabled && item.cadence === 2 && item.termWeeks === 12);
  if (!productPlan) throw new Error("PAP-437 requires an enabled 2x/week 12-week Product Plan; fixture will not mutate global plan config.");

  const parentContactValue = syntheticParentContact(runTag, generation);
  const collisions = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(parentContactValue)}&limit=25`);
  if (collisions.some((item) => item.parent.status === "ACTIVE" && item.contacts.some((contact) => contact.retiredAt === null && contact.identifierType === "EMAIL" && contact.normalizedValue === parentContactValue))) {
    throw new Error("PAP-437 synthetic Parent contact already belongs to an active Parent; choose a new run id.");
  }

  let path: F3Path | undefined;
  let space: F3LearningSpace | undefined;
  let happyA: F3RunningClass | undefined;
  let happyB: F3RunningClass | undefined;
  let blockedClass: F3RunningClass | undefined;
  try {
    path = await ensurePath(port, bootstrap, runTag, generation, attemptToken);
    space = await ensureSpace(port, bootstrap, centerId, runTag, generation, attemptToken);
    happyA = await ensureClass(port, bootstrap, centerId, path.id, space.id, runTag, generation, attemptToken, "happy-a", 1, 8);
    happyB = await ensureClass(port, bootstrap, centerId, path.id, space.id, runTag, generation, attemptToken, "happy-b", 3, 8);
    blockedClass = await ensureClass(port, bootstrap, centerId, path.id, space.id, runTag, generation, attemptToken, "blocked", 5, 1);
  } catch (error) {
    const rollbackState: Pap437RollbackState = {
      runTag,
      generation,
      attemptToken,
      operationTag: `${runTag}:g${generation}:a${attemptToken}:topology`,
      nowIso: now.toISOString(),
      parentContactValue,
      parentUserId: null,
      ownsParentContact: false,
      parentDisposition: null,
      centerId,
      pathId: path?.id ?? null,
      spaceId: space?.id ?? null,
      classIds: [happyA, happyB, blockedClass].filter((item): item is F3RunningClass => item !== undefined).map((item) => item.id),
      learnerIds: [],
      billIds: [],
      pendingOperations: [],
    };
    const rollbackErrors = await rollbackPap437OwnedPreparation(port, rollbackState);
    const detail = error instanceof Error ? error.message : String(error);
    if (rollbackErrors.length) {
      throw new Pap437RollbackIncompleteError(
        `PAP-437 topology prepare failed and rollback was incomplete: ${rollbackErrors.join(" | ")}. Original: ${detail}`,
        rollbackState,
        rollbackErrors,
      );
    }
    throw new Error(`PAP-437 topology prepare failed; deterministic synthetic topology was rolled back. ${detail}`);
  }
  if (!path || !space || !happyA || !happyB || !blockedClass) throw new Error("PAP-437 topology preparation returned incomplete synthetic identities.");

  assertSyntheticTopology(centerId, path, space, [happyA, happyB, blockedClass], runTag, generation, attemptToken);
  const operationTag = `${runTag}:g${generation}:a${attemptToken}:v${path.version}`;

  const intakeABody = studentIntakeBody(runTag, generation, "a", localDate);
  const intakeAKey = replayKey(operationTag, "intake-a");
  let learnerA: Pap437StudentIntake;
  try {
    learnerA = await port.command<Pap437StudentIntake>("POST", "student-intakes", intakeABody, intakeAKey);
  } catch (error) {
    try {
      learnerA = await port.command<Pap437StudentIntake>("POST", "student-intakes", intakeABody, intakeAKey);
    } catch (reconcileError) {
      const rollbackState = createRollbackState({
        runTag, generation, attemptToken, operationTag, now, parentContactValue, centerId, path, space, classes: [happyA, happyB, blockedClass],
        learners: [], sales: [],
        pendingOperations: [{ kind: "INTAKE", label: "a", idempotencyKey: intakeAKey, body: intakeABody }],
      });
      const rollbackErrors = await rollbackPap437OwnedPreparation(port, rollbackState);
      const detail = error instanceof Error ? error.message : String(error);
      const reconcileDetail = reconcileError instanceof Error ? reconcileError.message : String(reconcileError);
      if (rollbackErrors.length) {
        throw new Pap437RollbackIncompleteError(
          `PAP-437 first intake outcome remained unknown and rollback is incomplete: ${rollbackErrors.join(" | ")}. Original: ${detail} | replay: ${reconcileDetail}`,
          rollbackState,
          rollbackErrors,
        );
      }
      throw new Error(`PAP-437 first intake failed before fixture Parent ownership was established; idempotent outcome reconciliation completed and synthetic state was rolled back. ${detail} | replay: ${reconcileDetail}`);
    }
  }
  if (learnerA.parentReused || !learnerA.createdContactIdentifierId) {
    const rollbackState = createRollbackState({
      runTag, generation, attemptToken, operationTag, now, parentContactValue, centerId, path, space, classes: [happyA, happyB, blockedClass],
      learners: [learnerA], sales: [],
    });
    const rollbackErrors = await rollbackPap437OwnedPreparation(port, rollbackState);
    if (rollbackErrors.length) {
      throw new Pap437RollbackIncompleteError(
        `PAP-437 synthetic Parent contact was concurrently claimed and rollback was incomplete: ${rollbackErrors.join(" | ")}`,
        rollbackState,
        rollbackErrors,
      );
    }
    throw new Error("PAP-437 synthetic Parent contact was concurrently claimed; fresh intake and synthetic topology were rolled back without mutating the foreign Parent.");
  }
  let learnerB: Pap437StudentIntake | undefined;
  let guard: Pap437StudentIntake | undefined;
  let saleA: BoSaleResult | undefined;
  let saleB: BoSaleResult | undefined;
  let guardSubscription: BoLearnerSubscription | undefined;
  let saleABody: Record<string, unknown> | undefined;
  let saleBBody: Record<string, unknown> | undefined;
  let guardSubscriptionBody: Record<string, unknown> | undefined;
  const intakeBBody = studentIntakeBody(runTag, generation, "b", localDate, learnerA.parentUserId);
  const guardIntakeBody = studentIntakeBody(runTag, generation, "guard", localDate, learnerA.parentUserId);
  const intakeBKey = replayKey(operationTag, "intake-b");
  const guardIntakeKey = replayKey(operationTag, "intake-guard");
  const saleAKey = replayKey(operationTag, "sale-a");
  const saleBKey = replayKey(operationTag, "sale-b");
  const guardSubscriptionKey = replayKey(operationTag, "guard-subscription");
  let learnerBAttempted = false;
  let guardAttempted = false;
  let saleAAttempted = false;
  let saleBAttempted = false;
  let guardSubscriptionAttempted = false;

  try {
    learnerBAttempted = true;
    const preparedB = await port.command<Pap437StudentIntake>("POST", "student-intakes", intakeBBody, intakeBKey);
    learnerB = preparedB;
    guardAttempted = true;
    const preparedGuard = await port.command<Pap437StudentIntake>("POST", "student-intakes", guardIntakeBody, guardIntakeKey);
    guard = preparedGuard;
    assertReusedParentIntake(preparedB, learnerA.parentUserId, "B");
    assertReusedParentIntake(preparedGuard, learnerA.parentUserId, "guard");

    saleABody = saleBody(learnerA, path.id, centerId, productPlan.id, localDate, runTag, "a");
    saleBBody = saleBody(preparedB, path.id, centerId, productPlan.id, localDate, runTag, "b");
    saleAAttempted = true;
    saleA = await port.command<BoSaleResult>("POST", "billing/sales", saleABody, saleAKey);
    saleBAttempted = true;
    saleB = await port.command<BoSaleResult>("POST", "billing/sales", saleBBody, saleBKey);
    assertSale(saleA, learnerA.studentProfileId, path.id, productPlan.id);
    assertSale(saleB, preparedB.studentProfileId, path.id, productPlan.id);

    guardSubscriptionBody = {
      studentProfileId: preparedGuard.studentProfileId,
      pathProgramId: path.id,
      serviceStartsOn: localDate,
      contractualEndsOn: houseLocalDate(addDays(now, 84)),
      weeklyCommitment: 1,
      purchasedUnits: 12,
      commercialReference: `${PREFIX} ${runTag} capacity-guard`,
    };
    guardSubscriptionAttempted = true;
    guardSubscription = await port.command<BoLearnerSubscription>("POST", "subscriptions", guardSubscriptionBody, guardSubscriptionKey);
    if (guardSubscription.studentProfileId !== preparedGuard.studentProfileId || guardSubscription.pathProgramId !== path.id || guardSubscription.weeklyCommitment !== 1) {
      throw new Error("PAP-437 guard Subscription did not bind to the synthetic learner/path.");
    }

    const guardEnrollment = await port.command<EnrollmentResult>("POST", "enrollments", {
      subscriptionId: guardSubscription.id,
      runningClassId: blockedClass.id,
      effectiveFromLocalDate: localDate,
      commandEffectiveLocalDate: localDate,
      policyEffectiveAt: now.toISOString(),
    }, replayKey(operationTag, "guard-placement"));
    const guardEnrollmentId = guardEnrollment.enrollment?.id ?? guardEnrollment.id;
    if (!guardEnrollmentId) throw new Error("PAP-437 capacity guard placement returned no canonical Enrollment id.");

    return {
      runTag,
      generation,
      attemptToken,
      operationTag,
      centerId,
      path,
      space,
      happyClasses: [happyA, happyB],
      blockedClass,
      productPlan,
      learners: { a: learnerA, b: preparedB, guard: preparedGuard },
      sales: { a: saleA, b: saleB },
      guardSubscription,
      guardEnrollmentId,
      parentContactValue,
      replay: {
        saleA: { idempotencyKey: saleAKey, body: saleABody },
        saleB: { idempotencyKey: saleBKey, body: saleBBody },
      },
    };
  } catch (error) {
    const recoveryErrors: string[] = [];
    const recover = async (label: string, action: () => Promise<void>) => {
      try { await action(); } catch (recoveryError) { recoveryErrors.push(`${label}: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`); }
    };
    if (learnerBAttempted && !learnerB) await recover("recover intake B", async () => {
      const recovered = await port.command<Pap437StudentIntake>("POST", "student-intakes", intakeBBody, intakeBKey);
      assertReusedParentIntake(recovered, learnerA.parentUserId, "B");
      learnerB = recovered;
    });
    if (guardAttempted && !guard) await recover("recover guard intake", async () => {
      const recovered = await port.command<Pap437StudentIntake>("POST", "student-intakes", guardIntakeBody, guardIntakeKey);
      assertReusedParentIntake(recovered, learnerA.parentUserId, "guard");
      guard = recovered;
    });
    if (saleAAttempted && !saleA && saleABody) await recover("recover sale A", async () => { saleA = await port.command<BoSaleResult>("POST", "billing/sales", saleABody!, saleAKey); });
    if (saleBAttempted && !saleB && saleBBody) await recover("recover sale B", async () => { saleB = await port.command<BoSaleResult>("POST", "billing/sales", saleBBody!, saleBKey); });
    if (guardSubscriptionAttempted && !guardSubscription && guardSubscriptionBody) await recover("recover guard Subscription", async () => { guardSubscription = await port.command<BoLearnerSubscription>("POST", "subscriptions", guardSubscriptionBody!, guardSubscriptionKey); });
    const pendingOperations: Pap437RollbackPendingOperation[] = [];
    if (learnerBAttempted && !learnerB) pendingOperations.push({ kind: "INTAKE", label: "b", idempotencyKey: intakeBKey, body: intakeBBody });
    if (guardAttempted && !guard) pendingOperations.push({ kind: "INTAKE", label: "guard", idempotencyKey: guardIntakeKey, body: guardIntakeBody });
    if (saleAAttempted && !saleA && saleABody) pendingOperations.push({ kind: "SALE", label: "a", idempotencyKey: saleAKey, body: saleABody });
    if (saleBAttempted && !saleB && saleBBody) pendingOperations.push({ kind: "SALE", label: "b", idempotencyKey: saleBKey, body: saleBBody });
    if (guardSubscriptionAttempted && !guardSubscription && guardSubscriptionBody) pendingOperations.push({ kind: "SUBSCRIPTION", label: "guard", idempotencyKey: guardSubscriptionKey, body: guardSubscriptionBody });
    const rollbackState = createRollbackState({
      runTag, generation, attemptToken, operationTag, now, parentContactValue, centerId, path, space, classes: [happyA, happyB, blockedClass],
      learners: [learnerA, learnerB, guard].filter((item): item is Pap437StudentIntake => item !== undefined),
      sales: [saleA, saleB].filter((item): item is BoSaleResult => item !== undefined),
      pendingOperations,
    });
    recoveryErrors.push(...await rollbackPap437OwnedPreparation(port, rollbackState));
    const detail = error instanceof Error ? error.message : String(error);
    if (recoveryErrors.length) {
      throw new Pap437RollbackIncompleteError(
        `PAP-437 post-ownership prepare failed and rollback was incomplete: ${recoveryErrors.join(" | ")}. Original: ${detail}`,
        rollbackState,
        recoveryErrors,
      );
    }
    throw new Error(`PAP-437 post-ownership prepare failed; fixture-owned Parent/commercial/topology state was rolled back. ${detail}`);
  }
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
      }, replayKey(fixture.operationTag, `neutralize-${entry.subscription.id}`));
    }
  }

  for (const sale of [fixture.sales.a, fixture.sales.b]) {
    const bill = await port.get<{ bill: { id: string; version: number; voidedAt: string | null } }>(`billing/bills/${sale.bill.bill.id}`);
    if (!bill.bill.voidedAt) {
      await port.command("POST", `billing/bills/${bill.bill.id}/void`, {
        expectedVersion: bill.bill.version,
        reason: `${PREFIX} ${fixture.runTag} cleanup`,
      }, replayKey(fixture.operationTag, `void-bill-${bill.bill.id}`));
    }
  }

  const latestBootstrap = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  for (const runningClass of [fixture.happyClasses[0], fixture.happyClasses[1], fixture.blockedClass]) {
    const latest = latestBootstrap.runningClasses.find((item) => item.id === runningClass.id);
    if (latest?.status === "ACTIVE") await port.command<LifecycleResult>("POST", `delivery/running-classes/${latest.id}/lifecycle`, { status: "ARCHIVED", expectedVersion: latest.version });
  }
  const latestSpace = latestBootstrap.learningSpaces.find((item) => item.id === fixture.space.id);
  if (latestSpace?.status === "ACTIVE") await port.command<LifecycleResult>("POST", `delivery/learning-spaces/${latestSpace.id}/lifecycle`, { status: "ARCHIVED", expectedVersion: latestSpace.version });

  const voidOrder: Array<{ label: "guard" | "b" | "a"; intake: Pap437StudentIntake }> = [
    { label: "guard", intake: fixture.learners.guard },
    { label: "b", intake: fixture.learners.b },
    { label: "a", intake: fixture.learners.a },
  ];
  let ownerParentDisposition: "ARCHIVED" | "PRESERVED_SHARED" = "ARCHIVED";
  for (const item of voidOrder) {
    const lifecycle = await port.get<BoLearnerLifecycle>(`students/${item.intake.studentProfileId}/lifecycle`);
    if (lifecycle.student.status === "ARCHIVED") {
      if (item.label === "a") {
        const activeParents = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(fixture.parentContactValue)}&limit=25`);
        ownerParentDisposition = activeParents.some((candidate) => candidate.parent.id === fixture.learners.a.parentUserId && candidate.contacts.some((contact) => contact.retiredAt === null && contact.normalizedValue === fixture.parentContactValue))
          ? "PRESERVED_SHARED"
          : "ARCHIVED";
      }
      continue;
    }
    const result = await port.command<BoStudentIntakeVoidResult>("POST", `student-intakes/${item.intake.studentProfileId}/void`, {
      expectedStudentVersion: lifecycle.student.version,
      reason: `${PREFIX} ${fixture.runTag} cleanup`,
    }, replayKey(fixture.operationTag, `void-student-${item.intake.studentProfileId}`));
    if (result.parentUserId !== fixture.learners.a.parentUserId) throw new Error(`PAP-437 ${item.label} intake cleanup returned the wrong Parent.`);
    if (item.label !== "a") {
      if (result.parentDisposition !== "REUSED_UNCHANGED") throw new Error(`PAP-437 ${item.label} intake cleanup returned unexpected Parent disposition.`);
      continue;
    }
    if (result.parentDisposition === "ARCHIVED") {
      if (result.retiredContactCount !== 1) throw new Error("PAP-437 owner intake cleanup did not retire the synthetic Parent contact.");
      ownerParentDisposition = "ARCHIVED";
    } else if (result.parentDisposition === "PRESERVED_SHARED") {
      if (result.retiredContactCount !== 0) throw new Error("PAP-437 shared Parent preservation unexpectedly retired contact authority.");
      ownerParentDisposition = "PRESERVED_SHARED";
    } else {
      throw new Error("PAP-437 owner intake cleanup returned an invalid reused-Parent disposition.");
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
  const activeParents = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(fixture.parentContactValue)}&limit=25`);
  const exactActiveParent = activeParents.find((item) => item.parent.id === fixture.learners.a.parentUserId && item.contacts.some((contact) => contact.retiredAt === null && contact.normalizedValue === fixture.parentContactValue));
  if (ownerParentDisposition === "ARCHIVED" && exactActiveParent) throw new Error("PAP-437 cleanup readback found the synthetic Parent/contact still active after ARCHIVED disposition.");
  if (ownerParentDisposition === "PRESERVED_SHARED" && !exactActiveParent) throw new Error("PAP-437 cleanup readback lost a Parent/contact that Core explicitly preserved as shared.");
  return {
    cleaned: true as const,
    readbackAt: readback.asOf,
    parentArchived: ownerParentDisposition === "ARCHIVED",
    parentDisposition: ownerParentDisposition,
  };
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

async function ensurePath(port: Pap437FixturePort, bootstrap: F3BootstrapState, runTag: string, generation: number, attemptToken: string): Promise<F3Path> {
  const code = fixturePathCode(runTag, generation, attemptToken);
  const name = fixturePathName(runTag, generation, attemptToken);
  const existing = bootstrap.paths.find((item) => item.code === code);
  if (existing) throw new Error(`PAP-437 topology generation ${generation} Path already exists; reconcile prior fixture state before preparing again.`);
  return port.command<F3Path>("POST", "catalog/paths", { code, displayName: name, status: "ACTIVE" });
}

async function ensureSpace(port: Pap437FixturePort, bootstrap: F3BootstrapState, centerId: string, runTag: string, generation: number, attemptToken: string): Promise<F3LearningSpace> {
  const code = fixtureSpaceCode(runTag, generation, attemptToken);
  const name = fixtureSpaceName(runTag, generation, attemptToken);
  const existing = bootstrap.learningSpaces.find((item) => item.centerId === centerId && item.code === code);
  if (existing) throw new Error(`PAP-437 topology generation ${generation} Learning Space already exists; reconcile prior fixture state before preparing again.`);
  return port.command<F3LearningSpace>("POST", "delivery/learning-spaces", {
    centerId, code, displayName: name, optimalConcurrentCapacity: 8, hardConcurrentCapacity: 8, status: "ACTIVE",
  });
}

async function ensureClass(port: Pap437FixturePort, bootstrap: F3BootstrapState, centerId: string, pathId: string, spaceId: string, runTag: string, generation: number, attemptToken: string, suffix: string, weekdayIso: number, hard: number): Promise<F3RunningClass> {
  const name = fixtureClassName(runTag, generation, attemptToken, suffix);
  const existing = bootstrap.runningClasses.find((item) => item.centerId === centerId && item.operationalName === name);
  if (existing) throw new Error(`PAP-437 topology generation ${generation} ${suffix} Running Class already exists; reconcile prior fixture state before preparing again.`);
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

function nextTopologyGeneration(bootstrap: F3BootstrapState, centerId: string, runTag: string): number {
  const pathBase = `e2e-pap437-${runTag}`;
  const spaceBase = `pap437-${runTag}`;
  const classBase = `${PREFIX} ${runTag}`;
  const matchingPaths = bootstrap.paths.filter((item) => item.code === pathBase || item.code.startsWith(`${pathBase}-g`));
  const matchingSpaces = bootstrap.learningSpaces.filter((item) => item.centerId === centerId && (item.code === spaceBase || item.code.startsWith(`${spaceBase}-g`)));
  const matchingClasses = bootstrap.runningClasses.filter((item) => item.centerId === centerId && (item.operationalName.startsWith(`${classBase} `) || item.operationalName === classBase));
  if (matchingPaths.some((item) => item.status === "ACTIVE") || matchingSpaces.some((item) => item.status === "ACTIVE") || matchingClasses.some((item) => item.status === "ACTIVE")) {
    throw new Error("PAP-437 found active prior synthetic topology for this run id; reconcile/cleanup it before starting a new generation.");
  }
  let maxGeneration = 0;
  for (const item of matchingPaths) {
    if (item.code === pathBase) maxGeneration = Math.max(maxGeneration, 1);
    else {
      const match = new RegExp(`^${escapeRegex(pathBase)}-g([1-9][0-9]*)(?:-a[a-f0-9]{16})?$`).exec(item.code);
      if (match) maxGeneration = Math.max(maxGeneration, Number(match[1]));
    }
  }
  return maxGeneration + 1;
}

function isValidTopologyAttemptToken(value: string | null | undefined): value is string { return typeof value === "string" && /^[a-f0-9]{16}$/.test(value); }
function newTopologyAttemptToken() { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }
function fixturePathCode(runTag: string, generation: number, attemptToken: string) { return `e2e-pap437-${runTag}-g${generation}-a${attemptToken}`; }
function fixtureSpaceCode(runTag: string, generation: number, attemptToken: string) { return `pap437-${runTag}-g${generation}-a${attemptToken}`; }
function fixturePathName(runTag: string, generation: number, attemptToken: string) { return `${PREFIX} ${runTag} g${generation} a${attemptToken}`; }
function fixtureSpaceName(runTag: string, generation: number, attemptToken: string) { return `${fixturePathName(runTag, generation, attemptToken)} Space`; }
function fixtureClassName(runTag: string, generation: number, attemptToken: string, suffix: string) { return `${fixturePathName(runTag, generation, attemptToken)} ${suffix}`; }
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

type Pap437OwnedPreparationRollbackInput = {
  runTag: string;
  generation: number;
  attemptToken: string | null;
  operationTag: string;
  now: Date;
  parentContactValue: string;
  centerId: string;
  path: F3Path;
  space: F3LearningSpace;
  classes: F3RunningClass[];
  learners: Pap437StudentIntake[];
  sales: BoSaleResult[];
  pendingOperations?: Pap437RollbackPendingOperation[];
};

function createRollbackState(input: Pap437OwnedPreparationRollbackInput): Pap437RollbackState {
  return {
    runTag: input.runTag,
    generation: input.generation,
    attemptToken: input.attemptToken,
    operationTag: input.operationTag,
    nowIso: input.now.toISOString(),
    parentContactValue: input.parentContactValue,
    parentUserId: input.learners.length ? input.learners[0]!.parentUserId : null,
    ownsParentContact: input.learners.length ? (!input.learners[0]!.parentReused && input.learners[0]!.createdContactIdentifierId !== null) : null,
    parentDisposition: null,
    centerId: input.centerId,
    pathId: input.path.id,
    spaceId: input.space.id,
    classIds: [...new Set(input.classes.map((item) => item.id))],
    learnerIds: [...new Set(input.learners.map((item) => item.studentProfileId))],
    billIds: [...new Set(input.sales.map((item) => item.bill.bill.id))],
    pendingOperations: (input.pendingOperations ?? []).map((item) => ({ ...item, body: { ...item.body } })),
  };
}

async function rollbackPap437OwnedPreparation(port: Pap437FixturePort, state: Pap437RollbackState): Promise<string[]> {
  const errors: string[] = [];
  if (!isValidTopologyAttemptToken(state.attemptToken)) {
    errors.push("topology ownership identity is missing or malformed; rollback cannot prove which synthetic resources belong to this attempt");
    return errors;
  }
  const record = async (label: string, action: () => Promise<void>) => {
    try {
      await action();
      return true;
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };
  const releaseLocalDate = houseLocalDate(new Date(state.nowIso));
  const unresolved: Pap437RollbackPendingOperation[] = [];
  for (const operation of state.pendingOperations ?? []) {
    const reconciled = await record(`reconcile ${operation.kind.toLowerCase()} ${operation.label}`, async () => {
      if (operation.kind === "INTAKE") {
        const intake = await port.command<Pap437StudentIntake>("POST", "student-intakes", operation.body, operation.idempotencyKey);
        if (operation.label === "a") {
          state.parentUserId = intake.parentUserId;
          state.ownsParentContact = !intake.parentReused && intake.createdContactIdentifierId !== null;
          state.learnerIds = [intake.studentProfileId, ...state.learnerIds.filter((id) => id !== intake.studentProfileId)];
        } else {
          if (!state.parentUserId) throw new Error(`dependent ${operation.label} intake cannot be reconciled without the durable owner Parent identity`);
          assertReusedParentIntake(intake, state.parentUserId, operation.label === "b" ? "B" : "guard");
          if (!state.learnerIds.includes(intake.studentProfileId)) state.learnerIds.push(intake.studentProfileId);
        }
        return;
      }
      if (operation.kind === "SALE") {
        const sale = await port.command<BoSaleResult>("POST", "billing/sales", operation.body, operation.idempotencyKey);
        if (!state.billIds.includes(sale.bill.bill.id)) state.billIds.push(sale.bill.bill.id);
        if (!state.learnerIds.includes(sale.billItem.studentProfileId)) state.learnerIds.push(sale.billItem.studentProfileId);
        return;
      }
      if (operation.kind === "VOID_INTAKE") {
        const result = await port.command<BoStudentIntakeVoidResult>("POST", `student-intakes/${operation.studentProfileId}/void`, operation.body, operation.idempotencyKey);
        if (operation.label === "a") applyOwnerVoidResult(state, result, operation.studentProfileId);
        else applyDependentVoidResult(state, result, operation.studentProfileId);
        return;
      }
      await port.command<BoLearnerSubscription>("POST", "subscriptions", operation.body, operation.idempotencyKey);
    });
    if (!reconciled) unresolved.push(operation);
  }
  state.pendingOperations = unresolved;
  const unresolvedCommercial = unresolved.some((operation) => operation.kind === "SALE" || operation.kind === "SUBSCRIPTION");
  const learnerIds = [...new Set(state.learnerIds)];
  for (const studentId of learnerIds) {
    await record(`neutralize ${studentId}`, async () => {
      const lifecycle = await port.get<BoLearnerLifecycle>(`students/${studentId}/lifecycle`);
      for (const entry of lifecycle.subscriptions) {
        if (entry.subscription.lifecycle !== "ACTIVE") continue;
        await port.command("POST", `subscriptions/${entry.subscription.id}/neutralize`, {
          expectedVersion: entry.subscription.version,
          releaseLocalDate,
          reason: `${PREFIX} ${state.runTag} failed-prepare rollback`,
        }, replayKey(state.operationTag, `rollback-neutralize-${entry.subscription.id}`));
      }
    });
  }
  for (const billId of [...new Set(state.billIds)]) {
    await record(`void bill ${billId}`, async () => {
      const current = await port.get<{ bill: { id: string; version: number; voidedAt: string | null } }>(`billing/bills/${billId}`);
      if (current.bill.voidedAt) return;
      await port.command("POST", `billing/bills/${current.bill.id}/void`, {
        expectedVersion: current.bill.version,
        reason: `${PREFIX} ${state.runTag} failed-prepare rollback`,
      }, replayKey(state.operationTag, `rollback-void-bill-${current.bill.id}`));
    });
  }
  if (unresolvedCommercial) {
    errors.push("commercial prerequisite cleanup deferred until unknown sale/subscription outcome is reconciled");
    await record("commercial prerequisite readback", async () => {
      const latest = await port.get<F3BootstrapState>("delivery/bootstrap-state");
      const resolved = resolveRollbackTopology(latest, state);
      if (!resolved.path || resolved.path.status !== "ACTIVE") throw new Error("synthetic Path is not ACTIVE while a commercial outcome is unresolved");
      for (const operation of unresolved) {
        if (operation.kind !== "SALE" && operation.kind !== "SUBSCRIPTION") continue;
        const studentId = String(operation.body.studentProfileId ?? "");
        if (!studentId) throw new Error(`pending ${operation.kind} is missing studentProfileId`);
        const lifecycle = await port.get<BoLearnerLifecycle>(`students/${studentId}/lifecycle`);
        if (lifecycle.student.status !== "ACTIVE") throw new Error(`student ${studentId} is not ACTIVE while ${operation.kind} is unresolved`);
      }
    });
  } else {
    await record("archive synthetic topology", async () => {
      const latest = await port.get<F3BootstrapState>("delivery/bootstrap-state");
      const resolved = resolveRollbackTopology(latest, state);
      if (resolved.path) state.pathId = resolved.path.id;
      if (resolved.space) state.spaceId = resolved.space.id;
      state.classIds = [...new Set([...state.classIds, ...resolved.classes.map((item) => item.id)])];
      for (const current of resolved.classes) {
        if (current.status === "ACTIVE") await port.command<LifecycleResult>("POST", `delivery/running-classes/${current.id}/lifecycle`, { status: "ARCHIVED", expectedVersion: current.version });
      }
      if (resolved.space?.status === "ACTIVE") await port.command<LifecycleResult>("POST", `delivery/learning-spaces/${resolved.space.id}/lifecycle`, { status: "ARCHIVED", expectedVersion: resolved.space.version });
      if (resolved.path?.status === "ACTIVE") await port.command<F3Path>("PATCH", `catalog/paths/${resolved.path.id}`, { code: resolved.path.code, displayName: resolved.path.displayName, status: "ARCHIVED", expectedVersion: resolved.path.version });
    });
  }

  const ownerId = learnerIds[0];
  const dependentIds = learnerIds.slice(1).reverse();
  const unresolvedDependentIntake = state.pendingOperations.some((operation) => operation.kind === "INTAKE" && operation.label !== "a");
  let dependentsClean = !unresolvedDependentIntake;
  if (unresolvedCommercial) {
    errors.push("identity cleanup deferred until unknown commercial outcome is reconciled");
  } else {
    if (unresolvedDependentIntake && ownerId) errors.push(`void owner ${ownerId}: deferred until unknown dependent intake outcome is reconciled`);
    for (const studentId of dependentIds) {
      const existingPendingVoid = state.pendingOperations.find((operation): operation is Extract<Pap437RollbackPendingOperation, { kind: "VOID_INTAKE" }> => operation.kind === "VOID_INTAKE" && operation.label === "dependent" && operation.studentProfileId === studentId);
      if (existingPendingVoid) {
        dependentsClean = false;
        continue;
      }
      const lifecycle = await port.get<BoLearnerLifecycle>(`students/${studentId}/lifecycle`);
      if (lifecycle.student.status === "ARCHIVED") continue;
      const body = {
        expectedStudentVersion: lifecycle.student.version,
        reason: `${PREFIX} ${state.runTag} failed-prepare rollback`,
      };
      const idempotencyKey = replayKey(state.operationTag, `rollback-void-student-${studentId}`);
      const ok = await record(`void intake ${studentId}`, async () => {
        const result = await port.command<BoStudentIntakeVoidResult>("POST", `student-intakes/${studentId}/void`, body, idempotencyKey);
        applyDependentVoidResult(state, result, studentId);
      });
      if (!ok) {
        dependentsClean = false;
        state.pendingOperations.push({ kind: "VOID_INTAKE", label: "dependent", studentProfileId: studentId, idempotencyKey, body: { ...body } });
      }
    }
    if (ownerId) {
      if (dependentsClean) {
        let lifecycle: BoLearnerLifecycle | null = null;
        const lifecycleReadable = await record(`read owner lifecycle ${ownerId}`, async () => {
          lifecycle = await port.get<BoLearnerLifecycle>(`students/${ownerId}/lifecycle`);
        });
        const ownerLifecycle = lifecycle as BoLearnerLifecycle | null;
        if (lifecycleReadable && ownerLifecycle) {
          const existingPendingVoid = state.pendingOperations.find((operation): operation is Extract<Pap437RollbackPendingOperation, { kind: "VOID_INTAKE" }> => operation.kind === "VOID_INTAKE" && operation.studentProfileId === ownerId);
          if (existingPendingVoid || ownerLifecycle.student.status !== "ARCHIVED") {
            const body = existingPendingVoid?.body ?? {
              expectedStudentVersion: ownerLifecycle.student.version,
              reason: `${PREFIX} ${state.runTag} failed-prepare rollback`,
            };
            const idempotencyKey = existingPendingVoid?.idempotencyKey ?? replayKey(state.operationTag, `rollback-void-student-${ownerId}`);
            const ok = await record(`void intake ${ownerId}`, async () => {
              const result = await port.command<BoStudentIntakeVoidResult>("POST", `student-intakes/${ownerId}/void`, body, idempotencyKey);
              applyOwnerVoidResult(state, result, ownerId);
            });
            if (!ok && !existingPendingVoid) {
              state.pendingOperations.push({ kind: "VOID_INTAKE", label: "a", studentProfileId: ownerId, idempotencyKey, body: { ...body } });
            }
          }
        }
      } else {
        errors.push(`void owner ${ownerId}: deferred until dependent intake cleanup converges`);
      }
    }
  }
  if (!unresolvedCommercial && state.ownsParentContact === true && !state.pendingOperations.some((operation) => operation.kind === "INTAKE")) {
    await record("Parent/contact readback", async () => {
      if (!state.parentUserId) throw new Error("owned Parent identity is missing from rollback state");
      const activeParents = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(state.parentContactValue)}&limit=25`);
      const exactActiveParent = activeParents.some((item) => item.parent.id === state.parentUserId && item.parent.status === "ACTIVE" && item.contacts.some((contact) => contact.retiredAt === null && contact.identifierType === "EMAIL" && contact.normalizedValue === state.parentContactValue));
      if (exactActiveParent) throw new Error("synthetic Parent/contact remains active");
      if (activeParents.some((item) => item.parent.id !== state.parentUserId && item.parent.status === "ACTIVE" && item.contacts.some((contact) => contact.retiredAt === null && contact.identifierType === "EMAIL" && contact.normalizedValue === state.parentContactValue))) throw new Error("synthetic Parent contact was rebound to an unexpected Parent during rollback");
    });
  } else if (!unresolvedCommercial && (state.parentDisposition === "PRESERVED_SHARED" || state.parentDisposition === "REUSED_UNCHANGED")) {
    await record(`${state.parentDisposition} Parent preservation readback`, async () => {
      if (!state.parentUserId) throw new Error("preserved Parent identity is missing from rollback state");
      const activeParents = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(state.parentContactValue)}&limit=25`);
      if (!activeParents.some((item) => item.parent.id === state.parentUserId && item.parent.status === "ACTIVE" && item.contacts.some((contact) => contact.retiredAt === null && contact.identifierType === "EMAIL" && contact.normalizedValue === state.parentContactValue))) throw new Error(`expected Parent/contact disappeared after ${state.parentDisposition} disposition`);
    });
  }
  if (!unresolvedCommercial) await record("topology readback", async () => {
    const latest = await port.get<F3BootstrapState>("delivery/bootstrap-state");
    const resolved = resolveRollbackTopology(latest, state);
    if (resolved.path?.status === "ACTIVE" || resolved.space?.status === "ACTIVE" || resolved.classes.some((item) => item.status === "ACTIVE")) throw new Error("synthetic topology remains active");
  });
  return errors;
}

function applyOwnerVoidResult(state: Pap437RollbackState, result: BoStudentIntakeVoidResult, expectedStudentProfileId: string) {
  if (result.studentProfileId !== expectedStudentProfileId) throw new Error("owner intake cleanup returned the wrong Student identity");
  if (!state.parentUserId) throw new Error("owner Parent identity is missing from rollback state");
  if (result.parentUserId !== state.parentUserId) throw new Error("owner intake cleanup returned the wrong Parent identity");
  if (state.ownsParentContact === true && result.parentDisposition === "REUSED_UNCHANGED") throw new Error("owner intake cleanup returned REUSED_UNCHANGED for a fixture-owned Parent/contact");
  if (state.ownsParentContact === false && result.parentDisposition === "ARCHIVED") throw new Error("owner intake cleanup archived a Parent/contact that rollback did not own");
  state.parentDisposition = result.parentDisposition;
  if (result.parentDisposition === "PRESERVED_SHARED" || result.parentDisposition === "REUSED_UNCHANGED") state.ownsParentContact = false;
}

function applyDependentVoidResult(state: Pap437RollbackState, result: BoStudentIntakeVoidResult, expectedStudentProfileId: string) {
  if (result.studentProfileId !== expectedStudentProfileId) throw new Error("dependent intake cleanup returned the wrong Student identity");
  if (!state.parentUserId) throw new Error("dependent intake cleanup cannot validate Parent identity because rollback state is missing the owner Parent");
  if (result.parentUserId !== state.parentUserId) throw new Error("dependent intake cleanup returned the wrong Parent identity");
  if (result.parentDisposition !== "REUSED_UNCHANGED") throw new Error("dependent intake cleanup must return REUSED_UNCHANGED for the fixture-owned Parent");
  if (result.retiredContactCount !== 0) throw new Error("dependent intake cleanup unexpectedly retired Parent contact authority");
}

function resolveRollbackTopology(bootstrap: F3BootstrapState, state: Pap437RollbackState) {
  const generation = state.generation || 1;
  const attemptToken = state.attemptToken;
  const pathCode = attemptToken ? fixturePathCode(state.runTag, generation, attemptToken) : null;
  const spaceCode = attemptToken ? fixtureSpaceCode(state.runTag, generation, attemptToken) : null;
  const classNames = attemptToken ? new Set(["happy-a", "happy-b", "blocked"].map((suffix) => fixtureClassName(state.runTag, generation, attemptToken, suffix))) : new Set<string>();
  const pathMatches = bootstrap.paths.filter((item) => item.id === state.pathId || (pathCode !== null && item.code === pathCode));
  if (pathMatches.length > 1) throw new Error(`multiple synthetic Path matches for ${state.runTag} generation ${generation}`);
  const path = pathMatches[0];
  if (path) assertSyntheticName(path.displayName, state.runTag, "Path");
  const spaceMatches = bootstrap.learningSpaces.filter((item) => item.centerId === state.centerId && (item.id === state.spaceId || (spaceCode !== null && item.code === spaceCode)));
  if (spaceMatches.length > 1) throw new Error(`multiple synthetic Learning Space matches for ${state.runTag} generation ${generation}`);
  const space = spaceMatches[0];
  if (space) assertSyntheticName(space.displayName, state.runTag, "Learning Space");
  const classes = bootstrap.runningClasses.filter((item) => state.classIds.includes(item.id) || (attemptToken !== null && item.centerId === state.centerId && classNames.has(item.operationalName)));
  for (const item of classes) {
    if (item.centerId !== state.centerId) throw new Error(`synthetic Running Class ${item.id} escaped E2E Comparator Center`);
    if (path && item.pathProgramId !== path.id) throw new Error(`synthetic Running Class ${item.id} escaped the fixture Path`);
    if (space && item.learningSpaceId !== space.id) throw new Error(`synthetic Running Class ${item.id} escaped the fixture Learning Space`);
    if (attemptToken !== null && !classNames.has(item.operationalName)) throw new Error(`synthetic Running Class ${item.id} has unexpected identity`);
  }
  return { path, space, classes: [...new Map(classes.map((item) => [item.id, item])).values()] };
}

async function archivePreparedTopology(port: Pap437FixturePort, path: F3Path, space: F3LearningSpace, classes: F3RunningClass[]) {
  for (const runningClass of classes) {
    if (runningClass.status === "ACTIVE") await port.command<LifecycleResult>("POST", `delivery/running-classes/${runningClass.id}/lifecycle`, { status: "ARCHIVED", expectedVersion: runningClass.version });
  }
  if (space.status === "ACTIVE") await port.command<LifecycleResult>("POST", `delivery/learning-spaces/${space.id}/lifecycle`, { status: "ARCHIVED", expectedVersion: space.version });
  if (path.status === "ACTIVE") await port.command<F3Path>("PATCH", `catalog/paths/${path.id}`, { code: path.code, displayName: path.displayName, status: "ARCHIVED", expectedVersion: path.version });
}

function studentIntakeBody(runTag: string, generation: number, suffix: string, effectiveFrom: string, existingParentUserId?: string): Record<string, unknown> {
  const common = {
    displayName: `${PREFIX} ${runTag} ${suffix.toUpperCase()}`,
    birthYear: 2018,
    birthMonth: null,
    birthDay: null,
    birthPrecision: "YEAR_ONLY",
    relationshipType: "PARENT",
    effectiveFrom,
  };
  return existingParentUserId
    ? { ...common, existingParentUserId }
    : { ...common, existingParentUserId: null, guardianDisplayName: `${PREFIX} ${runTag} Parent`, contactType: "EMAIL", contactValue: syntheticParentContact(runTag, generation) };
}

function assertReusedParentIntake(intake: Pap437StudentIntake, expectedParentUserId: string, label: string) {
  if (!intake.parentReused || intake.createdContactIdentifierId !== null || intake.parentUserId !== expectedParentUserId) {
    throw new Error(`PAP-437 ${label} intake did not reuse the fixture-owned Parent exactly.`);
  }
}

function syntheticParentContact(runTag: string, generation = 1) { return generation === 1 ? `pap437+${runTag}@example.invalid` : `pap437+${runTag}g${generation}@example.invalid`; }

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

function assertSyntheticTopology(centerId: string, path: F3Path, space: F3LearningSpace, classes: F3RunningClass[], runTag: string, generation: number, attemptToken: string) {
  if (path.displayName !== fixturePathName(runTag, generation, attemptToken)) throw new Error("PAP-437 Path generation identity is inconsistent.");
  if (space.displayName !== fixtureSpaceName(runTag, generation, attemptToken)) throw new Error("PAP-437 Learning Space generation identity is inconsistent.");
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
