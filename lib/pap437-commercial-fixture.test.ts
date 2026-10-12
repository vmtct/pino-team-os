import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanupPap437CommercialFixture,
  createPap437FetchPort,
  normalizeRunTag,
  pap437AtomicFailureBulkBody,
  pap437HappyBulkBody,
  preparePap437CommercialFixture,
  Pap437RollbackIncompleteError,
  resumePap437CommercialRollback,
  type Pap437FixturePort,
} from "./pap437-commercial-fixture";
import type { BoLearnerLifecycle, BoLearnerSubscription, BoParentSearchResult, BoProductPlan, BoSaleResult } from "./bo-model";
import type { F3BootstrapState, F3LearningSpace, F3Path, F3RunningClass } from "./f3-delivery-api";

const uuid = (n: number) => `01990000-${String(n).padStart(4,"0")}-7000-8000-${String(n).padStart(12,"0")}`;
const now = new Date("2026-10-10T06:00:00.000Z");

test("PAP-437 prepares only E2E Comparator commercial topology and exposes exact happy/atomic batches", async () => {
  const port = new FakePort();
  const fixture = await preparePap437CommercialFixture(port, "run01", now);

  assert.equal(fixture.centerId, port.e2eCenterId);
  assert.match(fixture.path.displayName, /^\[E2E\] PAP-437 run01/);
  assert.equal(fixture.space.centerId, port.e2eCenterId);
  assert.deepEqual(fixture.happyClasses.map((item) => item.hardConcurrentCapacity), [8, 8]);
  assert.equal(fixture.blockedClass.hardConcurrentCapacity, 1);
  assert.equal(fixture.productPlan.cadence, 2);
  assert.equal(fixture.productPlan.termWeeks, 12);
  assert.equal(fixture.sales.a.billItem.studentProfileId, fixture.learners.a.studentProfileId);
  assert.equal(fixture.sales.b.billItem.studentProfileId, fixture.learners.b.studentProfileId);
  assert.equal(fixture.guardSubscription.weeklyCommitment, 1);
  assert.ok(fixture.guardEnrollmentId);
  assert.equal(fixture.learners.a.parentReused, false);
  assert.ok(fixture.learners.a.createdContactIdentifierId);
  assert.equal(fixture.learners.b.parentReused, true);
  assert.equal(fixture.learners.guard.parentReused, true);
  assert.equal(fixture.learners.b.parentUserId, fixture.learners.a.parentUserId);
  assert.equal(fixture.learners.guard.parentUserId, fixture.learners.a.parentUserId);
  assert.equal(fixture.parentContactValue, "pap437+run01@example.invalid");

  const futureDate = "2026-10-17";
  const policyAt = "2026-10-10T06:30:00.000Z";
  const happy = pap437HappyBulkBody(fixture, futureDate, policyAt);
  assert.equal(happy.subscriptions.length, 2);
  assert.equal(happy.commandEffectiveLocalDate, "2026-10-10");
  assert.equal(happy.subscriptions[0]!.placements[0]!.effectiveFromLocalDate, futureDate);
  assert.ok(happy.subscriptions.every((item) => item.placements.length === 2));
  assert.ok(happy.subscriptions.every((item) => item.placements.every((placement) => placement.runningClassId !== fixture.blockedClass.id)));

  const atomic = pap437AtomicFailureBulkBody(fixture, futureDate, policyAt);
  assert.equal(atomic.subscriptions.length, 2);
  assert.equal(atomic.subscriptions[1]!.placements[0]!.runningClassId, fixture.blockedClass.id);
  assert.equal(atomic.subscriptions[0]!.placements[0]!.runningClassId, fixture.happyClasses[0].id);

  assert.ok(port.calls.some((call) => call.path === "catalog/paths" && call.method === "POST"));
  assert.ok(port.calls.some((call) => call.path === "billing/sales" && call.key === fixture.replay.saleA.idempotencyKey));
  assert.ok(port.calls.some((call) => call.path === "enrollments" && call.body && JSON.stringify(call.body).includes(fixture.blockedClass.id)));
  assert.equal(port.calls.some((call) => JSON.stringify(call.body ?? {}).includes(port.operationalCenterId)), false);
});

test("PAP-437 exact billing replay is stable and conflicting replay fails closed", async () => {
  const port = new FakePort();
  const fixture = await preparePap437CommercialFixture(port, "replay1", now);
  const exact = await port.command<BoSaleResult>("POST", "billing/sales", fixture.replay.saleA.body, fixture.replay.saleA.idempotencyKey);
  assert.equal(exact.subscriptionId, fixture.sales.a.subscriptionId);
  await assert.rejects(
    () => port.command("POST", "billing/sales", { ...fixture.replay.saleA.body, billDiscountMinor: 1 }, fixture.replay.saleA.idempotencyKey),
    /conflicting replay/i,
  );
});

test("PAP-437 cleanup neutralizes commercial state and archives every synthetic topology resource", async () => {
  const port = new FakePort();
  const fixture = await preparePap437CommercialFixture(port, "clean01", now);
  const result = await cleanupPap437CommercialFixture(port, fixture, now);
  assert.equal(result.cleaned, true);
  assert.equal(result.parentArchived, true);
  assert.equal(port.parentStatus(fixture.learners.a.parentUserId), "ARCHIVED");

  const bootstrap = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  assert.equal(bootstrap.paths.find((item) => item.id === fixture.path.id)?.status, "ARCHIVED");
  assert.equal(bootstrap.learningSpaces.find((item) => item.id === fixture.space.id)?.status, "ARCHIVED");
  for (const runningClass of [...fixture.happyClasses, fixture.blockedClass]) {
    assert.equal(bootstrap.runningClasses.find((item) => item.id === runningClass.id)?.status, "ARCHIVED");
  }
  for (const studentId of [fixture.learners.a.studentProfileId, fixture.learners.b.studentProfileId, fixture.learners.guard.studentProfileId]) {
    const lifecycle = await port.get<BoLearnerLifecycle>(`students/${studentId}/lifecycle`);
    assert.equal(lifecycle.student.status, "ARCHIVED");
    assert.ok(lifecycle.subscriptions.every((entry) => entry.subscription.lifecycle !== "ACTIVE"));
  }
  for (const sale of [fixture.sales.a, fixture.sales.b]) {
    const bill = await port.get<{bill:{voidedAt:string|null}}>(`billing/bills/${sale.bill.bill.id}`);
    assert.ok(bill.bill.voidedAt);
  }
  const activeParents = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(fixture.parentContactValue)}&limit=25`);
  assert.deepEqual(activeParents, []);
});

test("PAP-437 ordinary cleanup exact-binds dependent Student identity before owner cleanup", async () => {
  const port = new FakePort();
  const fixture = await preparePap437CommercialFixture(port, "badcleanstudent", now);
  port.corruptNextDependentVoid("WRONG_STUDENT");
  await assert.rejects(() => cleanupPap437CommercialFixture(port, fixture, now), /wrong Student identity/i);
  assert.equal(port.parentStatus(fixture.learners.a.parentUserId), "ACTIVE");
  await assert.rejects(() => cleanupPap437CommercialFixture(port, fixture, now), /wrong Student identity/i);
  assert.equal(port.parentStatus(fixture.learners.a.parentUserId), "ACTIVE");
});

test("PAP-437 ordinary cleanup rejects dependent Parent-contact retirement before owner cleanup", async () => {
  const port = new FakePort();
  const fixture = await preparePap437CommercialFixture(port, "badcleancontact", now);
  port.corruptNextDependentVoid("CONTACT_RETIRED");
  await assert.rejects(() => cleanupPap437CommercialFixture(port, fixture, now), /unexpectedly retired Parent contact authority/i);
  assert.equal(port.parentStatus(fixture.learners.a.parentUserId), "ACTIVE");
  await assert.rejects(() => cleanupPap437CommercialFixture(port, fixture, now), /unexpectedly retired Parent contact authority/i);
  assert.equal(port.parentStatus(fixture.learners.a.parentUserId), "ACTIVE");
});

test("PAP-437 ordinary cleanup replays an archived dependent void after lost response before owner cleanup", async () => {
  const port = new FakePort();
  const fixture = await preparePap437CommercialFixture(port, "cleanvoidloss", now);
  port.loseResponseAfterNthStudentVoid(1);
  await assert.rejects(() => cleanupPap437CommercialFixture(port, fixture, now), /simulated response loss/i);
  assert.equal(port.parentStatus(fixture.learners.a.parentUserId), "ACTIVE");
  const firstGuardVoid = port.calls.find((call) => call.path === `student-intakes/${fixture.learners.guard.studentProfileId}/void`);
  assert.ok(firstGuardVoid?.key);
  const result = await cleanupPap437CommercialFixture(port, fixture, now);
  assert.equal(result.cleaned, true);
  const guardVoids = port.calls.filter((call) => call.path === `student-intakes/${fixture.learners.guard.studentProfileId}/void`);
  assert.equal(guardVoids.length, 2);
  assert.equal(guardVoids[0]!.key, guardVoids[1]!.key);
  assert.deepEqual(guardVoids[0]!.body, guardVoids[1]!.body);
  assert.equal(port.parentStatus(fixture.learners.a.parentUserId), "ARCHIVED");
});

test("PAP-437 rejects a pre-existing exact Parent contact before any mutable fixture topology or Student is created", async () => {
  const port = new FakePort();
  const contact = "pap437+collision01@example.invalid";
  const existingParentId = port.seedExistingParent(contact);
  await assert.rejects(() => preparePap437CommercialFixture(port, "collision01", now), /already belongs to an active Parent/i);
  assert.equal(port.parentStatus(existingParentId), "ACTIVE");
  assert.equal(port.students.size, 0);
  assert.equal(port.bootstrap.paths.length, 0);
  assert.equal(port.bootstrap.learningSpaces.length, 0);
  assert.equal(port.bootstrap.runningClasses.length, 0);
});

test("PAP-437 rolls back a contact-resolution race without touching the concurrently claimed Parent", async () => {
  const port = new FakePort();
  const contact = "pap437+race01@example.invalid";
  port.raceParentOnNextIntake(contact);
  await assert.rejects(() => preparePap437CommercialFixture(port, "race01", now), /concurrently claimed/i);
  assert.equal([...port.students.values()].every((item) => item.lifecycle.student.status === "ARCHIVED"), true);
  assert.equal(port.bootstrap.paths.every((item) => item.status === "ARCHIVED"), true);
  assert.equal(port.bootstrap.learningSpaces.every((item) => item.status === "ARCHIVED"), true);
  assert.equal(port.bootstrap.runningClasses.every((item) => item.status === "ARCHIVED"), true);
  const activeParents = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(contact)}&limit=25`);
  assert.equal(activeParents.length, 1);
  assert.equal(activeParents[0]!.parent.status, "ACTIVE");
});

test("PAP-437 reconciles post-lookup Parent uniqueness conflict into concurrent-claim rollback", async () => {
  const port = new FakePort();
  const contact = "pap437+atomic01@example.invalid";
  port.conflictParentAfterLookupOnNextIntake(contact);
  await assert.rejects(() => preparePap437CommercialFixture(port, "atomic01", now), /synthetic Parent contact was concurrently claimed.*rolled back/i);
  assert.equal([...port.students.values()].every((item) => item.lifecycle.student.status === "ARCHIVED"), true);
  assert.equal(port.bootstrap.paths.every((item) => item.status === "ARCHIVED"), true);
  assert.equal(port.bootstrap.learningSpaces.every((item) => item.status === "ARCHIVED"), true);
  assert.equal(port.bootstrap.runningClasses.every((item) => item.status === "ARCHIVED"), true);
  const activeParents = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(contact)}&limit=25`);
  assert.equal(activeParents.length, 1);
  assert.equal(activeParents[0]!.parent.status, "ACTIVE");
  const retry = await preparePap437CommercialFixture(port, "atomic01", now);
  assert.equal(retry.generation, 2);
  assert.equal(retry.parentContactValue, "pap437+atomic01g2@example.invalid");
  assert.notEqual(retry.learners.a.parentUserId, activeParents[0]!.parent.id);
  await cleanupPap437CommercialFixture(port, retry, now);
  assert.equal(port.bootstrap.paths.filter((item) => item.status === "ACTIVE").length, 0);
});

test("PAP-437 rolls back partial topology after response loss at every topology stage and permits same-run recovery", async () => {
  const scenarios = [
    { path: "catalog/paths", nth: 1 },
    { path: "delivery/learning-spaces", nth: 1 },
    { path: "delivery/running-classes", nth: 1 },
    { path: "delivery/running-classes", nth: 2 },
    { path: "delivery/running-classes", nth: 3 },
  ];
  for (const [index, scenario] of scenarios.entries()) {
    const runTag = `topo${index + 1}`;
    const port = new FakePort();
    port.loseResponseAfterNth(scenario.path, scenario.nth);
    await assert.rejects(() => preparePap437CommercialFixture(port, runTag, now), /topology prepare failed.*rolled back/i);
    const failed = await port.get<F3BootstrapState>("delivery/bootstrap-state");
    assert.equal(failed.paths.filter((item) => item.status === "ACTIVE").length, 0);
    assert.equal(failed.learningSpaces.filter((item) => item.status === "ACTIVE").length, 0);
    assert.equal(failed.runningClasses.filter((item) => item.status === "ACTIVE").length, 0);
    assert.equal(port.students.size, 0);
    assert.deepEqual(await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(`pap437+${runTag}@example.invalid`)}&limit=25`), []);
    const retry = await preparePap437CommercialFixture(port, runTag, now);
    await cleanupPap437CommercialFixture(port, retry, now);
  }
});

test("PAP-437 reconciles first-intake commit response loss through the same idempotency key", async () => {
  const port = new FakePort();
  const contact = "pap437+intake01@example.invalid";
  port.loseResponseAfterNext("student-intakes");
  const fixture = await preparePap437CommercialFixture(port, "intake01", now);
  assert.equal(fixture.parentContactValue, contact);
  const intakeCalls = port.calls.filter((call) => call.path === "student-intakes" && call.key?.endsWith(":intake-a"));
  assert.equal(intakeCalls.length, 2);
  assert.equal(intakeCalls[0]!.key, intakeCalls[1]!.key);
  assert.equal(port.students.size, 3);
  await cleanupPap437CommercialFixture(port, fixture, now);
  assert.deepEqual(await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(contact)}&limit=25`), []);
});

test("PAP-437 persists an unknown first-intake outcome and resume reconciles it before cleanup", async () => {
  const port = new FakePort();
  const contact = "pap437+unknowna@example.invalid";
  port.loseResponseAfterNext("student-intakes", 3);
  let incomplete: Pap437RollbackIncompleteError | null = null;
  try {
    await preparePap437CommercialFixture(port, "unknowna", now);
  } catch (error) {
    assert.ok(error instanceof Pap437RollbackIncompleteError);
    incomplete = error;
  }
  assert.ok(incomplete);
  assert.equal(incomplete.rollbackState.learnerIds.length, 0);
  assert.equal(incomplete.rollbackState.pendingOperations.length, 1);
  assert.equal(incomplete.rollbackState.pendingOperations[0]!.kind, "INTAKE");
  assert.equal(incomplete.rollbackState.pendingOperations[0]!.label, "a");
  assert.equal(JSON.parse(JSON.stringify(incomplete.rollbackState)).pendingOperations.length, 1);
  await resumePap437CommercialRollback(port, incomplete.rollbackState);
  assert.equal(incomplete.rollbackState.pendingOperations.length, 0);
  assert.equal([...port.students.values()].every((item) => item.lifecycle.student.status === "ARCHIVED"), true);
  assert.deepEqual(await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(contact)}&limit=25`), []);
});

test("PAP-437 persists an unknown committed sale until resume can name and void its Bill", async () => {
  const port = new FakePort();
  port.loseResponseAfterNext("billing/sales", 3);
  let incomplete: Pap437RollbackIncompleteError | null = null;
  try {
    await preparePap437CommercialFixture(port, "unknownsale", now);
  } catch (error) {
    assert.ok(error instanceof Pap437RollbackIncompleteError);
    incomplete = error;
  }
  assert.ok(incomplete);
  assert.equal(incomplete.rollbackState.pendingOperations.length, 1);
  assert.equal(incomplete.rollbackState.pendingOperations[0]!.kind, "SALE");
  assert.equal(incomplete.rollbackState.billIds.length, 0);
  assert.equal(port.activeBillCount(), 1);
  await resumePap437CommercialRollback(port, incomplete.rollbackState);
  assert.equal(incomplete.rollbackState.pendingOperations.length, 0);
  assert.equal(incomplete.rollbackState.billIds.length, 1);
  assert.equal(port.activeBillCount(), 0);
});

test("PAP-437 persists unknown sibling operation outcomes until resume can reconcile and clean them", async () => {
  const scenarios = [
    { name: "intake-b", path: "student-intakes", nth: 2, kind: "INTAKE", label: "b" },
    { name: "intake-guard", path: "student-intakes", nth: 3, kind: "INTAKE", label: "guard" },
    { name: "sale-b", path: "billing/sales", nth: 2, kind: "SALE", label: "b" },
    { name: "guard-subscription", path: "subscriptions", nth: 1, kind: "SUBSCRIPTION", label: "guard" },
  ] as const;
  for (const [index, scenario] of scenarios.entries()) {
    const port = new FakePort();
    port.loseResponseAfterNth(scenario.path, scenario.nth, 3);
    let incomplete: Pap437RollbackIncompleteError | null = null;
    try {
      await preparePap437CommercialFixture(port, `unknown${index + 1}`, now);
    } catch (error) {
      assert.ok(error instanceof Pap437RollbackIncompleteError, scenario.name);
      incomplete = error;
    }
    assert.ok(incomplete, scenario.name);
    assert.equal(incomplete.rollbackState.pendingOperations.length, 1, scenario.name);
    assert.equal(incomplete.rollbackState.pendingOperations[0]!.kind, scenario.kind, scenario.name);
    assert.equal(incomplete.rollbackState.pendingOperations[0]!.label, scenario.label, scenario.name);
    await resumePap437CommercialRollback(port, incomplete.rollbackState);
    assert.equal(incomplete.rollbackState.pendingOperations.length, 0, scenario.name);
    assert.equal([...port.students.values()].every((item) => item.lifecycle.student.status === "ARCHIVED"), true, scenario.name);
    assert.equal(port.activeBillCount(), 0, scenario.name);
    const readback = await port.get<F3BootstrapState>("delivery/bootstrap-state");
    assert.equal(readback.paths.every((item) => item.status === "ARCHIVED"), true, scenario.name);
    assert.equal(readback.learningSpaces.every((item) => item.status === "ARCHIVED"), true, scenario.name);
    assert.equal(readback.runningClasses.every((item) => item.status === "ARCHIVED"), true, scenario.name);
  }
});

test("PAP-437 neutralizes a committed guard enrollment when its response is lost", async () => {
  const port = new FakePort();
  port.loseResponseAfterNext("enrollments");
  await assert.rejects(() => preparePap437CommercialFixture(port, "guardloss", now), /post-ownership prepare failed.*rolled back/i);
  assert.equal([...port.students.values()].every((item) => item.lifecycle.student.status === "ARCHIVED"), true);
  assert.equal(port.activeBillCount(), 0);
  for (const state of port.students.values()) {
    for (const entry of state.lifecycle.subscriptions) {
      assert.notEqual(entry.subscription.lifecycle, "ACTIVE");
      assert.ok(entry.enrollments.every((item) => item.effectiveUntilExclusiveLocalDate !== null));
    }
  }
  const retry = await preparePap437CommercialFixture(port, "guardloss", now);
  await cleanupPap437CommercialFixture(port, retry, now);
});

test("PAP-437 returns durable rollback state and converges when resumed after partial rollback failure", async () => {
  const port = new FakePort();
  const contact = "pap437+resume01@example.invalid";
  port.loseResponseAfterNext("billing/sales");
  port.failNextCommandContaining("/void");
  let incomplete: Pap437RollbackIncompleteError | null = null;
  try {
    await preparePap437CommercialFixture(port, "resume01", now);
  } catch (error) {
    assert.ok(error instanceof Pap437RollbackIncompleteError);
    incomplete = error;
  }
  assert.ok(incomplete);
  assert.equal(incomplete.rollbackState.runTag, "resume01");
  assert.equal(incomplete.rollbackState.learnerIds.length, 3);
  assert.ok(incomplete.rollbackErrors.length > 0);
  assert.equal(JSON.parse(JSON.stringify(incomplete.rollbackState)).runTag, "resume01");
  await resumePap437CommercialRollback(port, incomplete.rollbackState);
  assert.equal([...port.students.values()].every((item) => item.lifecycle.student.status === "ARCHIVED"), true);
  assert.equal(port.activeBillCount(), 0);
  assert.deepEqual(await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(contact)}&limit=25`), []);
  const readback = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  assert.equal(readback.paths.every((item) => item.status === "ARCHIVED"), true);
  assert.equal(readback.learningSpaces.every((item) => item.status === "ARCHIVED"), true);
  assert.equal(readback.runningClasses.every((item) => item.status === "ARCHIVED"), true);
});

test("PAP-437 rolls back post-ownership response loss and allows a clean same-run retry", async () => {
  const port = new FakePort();
  const contact = "pap437+recover01@example.invalid";
  port.loseResponseAfterNext("billing/sales");
  await assert.rejects(
    () => preparePap437CommercialFixture(port, "recover01", now),
    /post-ownership prepare failed.*rolled back/i,
  );
  assert.equal(port.activeBillCount(), 0);
  assert.equal([...port.students.values()].every((item) => item.lifecycle.student.status === "ARCHIVED"), true);
  const failedBootstrap = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  assert.equal(failedBootstrap.paths.every((item) => item.status === "ARCHIVED"), true);
  assert.equal(failedBootstrap.learningSpaces.every((item) => item.status === "ARCHIVED"), true);
  assert.equal(failedBootstrap.runningClasses.every((item) => item.status === "ARCHIVED"), true);
  assert.deepEqual(await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(contact)}&limit=25`), []);

  const retry = await preparePap437CommercialFixture(port, "recover01", now);
  assert.equal(retry.generation, 2);
  assert.match(retry.parentContactValue, /^pap437\+recover01g2@example\.invalid$/);
  assert.notEqual(retry.operationTag, "recover01:v1");
  assert.equal(port.calls.some((call) => /delivery\/(learning-spaces|running-classes)\/.+\/lifecycle/.test(call.path) && (call.body as any)?.status === "ACTIVE"), false);
  const activeParents = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(retry.parentContactValue)}&limit=25`);
  assert.equal(activeParents.length, 1);
  assert.equal(activeParents[0]!.parent.id, retry.learners.a.parentUserId);
});

test("PAP-437 collision rollback returns a durable resumable state when the owned Student void fails", async () => {
  const port = new FakePort();
  const contact = "pap437+racevoid@example.invalid";
  port.raceParentOnNextIntake(contact);
  port.failNextCommandContaining("/void");
  let incomplete: Pap437RollbackIncompleteError | null = null;
  try {
    await preparePap437CommercialFixture(port, "racevoid", now);
  } catch (error) {
    assert.ok(error instanceof Pap437RollbackIncompleteError);
    incomplete = error;
  }
  assert.ok(incomplete);
  assert.equal(incomplete.rollbackState.ownsParentContact, false);
  assert.equal(incomplete.rollbackState.learnerIds.length, 1);
  await resumePap437CommercialRollback(port, incomplete.rollbackState);
  const ownedStudent = port.students.get(incomplete.rollbackState.learnerIds[0]!)!;
  assert.equal(ownedStudent.lifecycle.student.status, "ARCHIVED");
  const foreign = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(contact)}&limit=25`);
  assert.equal(foreign.length, 1);
  assert.equal(foreign[0]!.parent.status, "ACTIVE");
});

test("PAP-437 preserves commercial prerequisites across repeated pre-commit sale failures until replay resolves", async () => {
  const port = new FakePort();
  port.failBeforeNextCommit("billing/sales", 3);
  let incomplete: Pap437RollbackIncompleteError | null = null;
  try {
    await preparePap437CommercialFixture(port, "precommit", now);
  } catch (error) {
    assert.ok(error instanceof Pap437RollbackIncompleteError);
    incomplete = error;
  }
  assert.ok(incomplete);
  assert.equal(incomplete.rollbackState.pendingOperations.length, 1);
  assert.equal(incomplete.rollbackState.pendingOperations[0]!.kind, "SALE");
  const pendingStudentId = String(incomplete.rollbackState.pendingOperations[0]!.body.studentProfileId);
  assert.equal((await port.get<BoLearnerLifecycle>(`students/${pendingStudentId}/lifecycle`)).student.status, "ACTIVE");
  assert.equal((await port.get<F3BootstrapState>("delivery/bootstrap-state")).paths.some((item) => item.id === incomplete!.rollbackState.pathId && item.status === "ACTIVE"), true);
  await resumePap437CommercialRollback(port, incomplete.rollbackState);
  assert.equal(incomplete.rollbackState.pendingOperations.length, 0);
  assert.equal(port.activeBillCount(), 0);
  assert.equal([...port.students.values()].every((item) => item.lifecycle.student.status === "ARCHIVED"), true);
  const finalState = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  assert.equal(finalState.paths.every((item) => item.status !== "ACTIVE"), true);
});

test("PAP-437 accepts Core PRESERVED_SHARED as a terminal foreign-parent boundary and retries with a new generation", async () => {
  const port = new FakePort();
  port.preserveOwnedParentAsShared();
  port.failNextCommandContaining("enrollments");
  await assert.rejects(() => preparePap437CommercialFixture(port, "shared01", now), /post-ownership prepare failed.*rolled back/i);
  const sharedContact = "pap437+shared01@example.invalid";
  const preserved = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(sharedContact)}&limit=25`);
  assert.equal(preserved.length, 1);
  assert.equal(preserved[0]!.parent.status, "ACTIVE");
  const retry = await preparePap437CommercialFixture(port, "shared01", now);
  assert.equal(retry.generation, 2);
  assert.equal(retry.parentContactValue, "pap437+shared01g2@example.invalid");
  assert.notEqual(retry.learners.a.parentUserId, preserved[0]!.parent.id);
  const cleaned = await cleanupPap437CommercialFixture(port, retry, now);
  assert.equal(cleaned.parentDisposition, "ARCHIVED");
  const stillPreserved = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(sharedContact)}&limit=25`);
  assert.equal(stillPreserved.length, 1);
  const replayedCleanup = await cleanupPap437CommercialFixture(port, retry, now);
  assert.equal(replayedCleanup.cleaned, true);
  assert.equal(replayedCleanup.parentDisposition, "ARCHIVED");
});

test("PAP-437 resumes a lost owner-void response and recovers canonical PRESERVED_SHARED disposition", async () => {
  const port = new FakePort();
  port.preserveOwnedParentAsShared();
  port.failNextCommandContaining("enrollments");
  port.loseResponseAfterNthStudentVoid(3);
  let incomplete: Pap437RollbackIncompleteError | null = null;
  try {
    await preparePap437CommercialFixture(port, "sharedloss", now);
  } catch (error) {
    assert.ok(error instanceof Pap437RollbackIncompleteError);
    incomplete = error;
  }
  assert.ok(incomplete);
  const pendingVoid = incomplete.rollbackState.pendingOperations.find((operation) => operation.kind === "VOID_INTAKE");
  assert.ok(pendingVoid);
  assert.equal(pendingVoid.label, "a");
  assert.equal(incomplete.rollbackState.parentDisposition, null);
  assert.equal((await port.get<BoLearnerLifecycle>(`students/${pendingVoid.studentProfileId}/lifecycle`)).student.status, "ARCHIVED");
  const preservedBeforeResume = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(incomplete.rollbackState.parentContactValue)}&limit=25`);
  assert.equal(preservedBeforeResume.length, 1);
  await resumePap437CommercialRollback(port, incomplete.rollbackState);
  assert.equal(incomplete.rollbackState.pendingOperations.length, 0);
  assert.equal(incomplete.rollbackState.parentDisposition, "PRESERVED_SHARED");
  assert.equal(incomplete.rollbackState.ownsParentContact, false);
  const preservedAfterResume = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(incomplete.rollbackState.parentContactValue)}&limit=25`);
  assert.equal(preservedAfterResume.length, 1);
});

test("PAP-437 fails closed when owned owner-void falsely reports REUSED_UNCHANGED", async () => {
  const port = new FakePort();
  port.corruptNextOwnedParentVoid("REUSED_UNCHANGED");
  port.failNextCommandContaining("enrollments");
  let incomplete: Pap437RollbackIncompleteError | null = null;
  try {
    await preparePap437CommercialFixture(port, "badreused", now);
  } catch (error) {
    assert.ok(error instanceof Pap437RollbackIncompleteError);
    incomplete = error;
  }
  assert.ok(incomplete);
  assert.match(incomplete.rollbackErrors.join(" | "), /REUSED_UNCHANGED.*fixture-owned Parent\/contact/i);
  assert.equal(incomplete.rollbackState.ownsParentContact, true);
  assert.equal(incomplete.rollbackState.parentDisposition, null);
  assert.ok(incomplete.rollbackState.parentUserId);
  const activeParents = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(incomplete.rollbackState.parentContactValue)}&limit=25`);
  assert.equal(activeParents.some((item) => item.parent.id === incomplete!.rollbackState.parentUserId), true);
  await assert.rejects(() => resumePap437CommercialRollback(port, incomplete!.rollbackState), Pap437RollbackIncompleteError);
});

test("PAP-437 fails closed when owner-void reports the wrong Parent identity", async () => {
  const port = new FakePort();
  port.corruptNextOwnedParentVoid("WRONG_PARENT");
  port.failNextCommandContaining("enrollments");
  let incomplete: Pap437RollbackIncompleteError | null = null;
  try {
    await preparePap437CommercialFixture(port, "badparent", now);
  } catch (error) {
    assert.ok(error instanceof Pap437RollbackIncompleteError);
    incomplete = error;
  }
  assert.ok(incomplete);
  assert.match(incomplete.rollbackErrors.join(" | "), /wrong Parent identity/i);
  assert.equal(incomplete.rollbackState.ownsParentContact, true);
  assert.equal(incomplete.rollbackState.parentDisposition, null);
  assert.ok(incomplete.rollbackState.parentUserId);
  assert.equal(JSON.parse(JSON.stringify(incomplete.rollbackState)).parentUserId, incomplete.rollbackState.parentUserId);
  await assert.rejects(() => resumePap437CommercialRollback(port, incomplete!.rollbackState), Pap437RollbackIncompleteError);
});

test("PAP-437 fails closed when dependent intake replay returns the wrong Parent", async () => {
  const port = new FakePort();
  port.corruptNextDependentIntake("WRONG_PARENT");
  port.loseResponseAfterNth("student-intakes", 2, 2);
  let incomplete: Pap437RollbackIncompleteError | null = null;
  try { await preparePap437CommercialFixture(port, "baddepreplay", now); } catch (error) { assert.ok(error instanceof Pap437RollbackIncompleteError); incomplete = error; }
  assert.ok(incomplete);
  assert.match(incomplete.rollbackErrors.join(" | "), /B intake did not reuse the fixture-owned Parent exactly/i);
  assert.ok(incomplete.rollbackState.pendingOperations.some((operation) => operation.kind === "INTAKE" && operation.label === "b"));
  await assert.rejects(() => resumePap437CommercialRollback(port, incomplete!.rollbackState), Pap437RollbackIncompleteError);
});

test("PAP-437 persists and rejects a dependent void replay with the wrong Parent", async () => {
  const port = new FakePort();
  port.corruptNextDependentVoid("WRONG_PARENT");
  port.failNextCommandContaining("enrollments");
  let incomplete: Pap437RollbackIncompleteError | null = null;
  try { await preparePap437CommercialFixture(port, "baddepvoidparent", now); } catch (error) { assert.ok(error instanceof Pap437RollbackIncompleteError); incomplete = error; }
  assert.ok(incomplete);
  assert.match(incomplete.rollbackErrors.join(" | "), /dependent intake cleanup returned the wrong Parent identity/i);
  assert.ok(incomplete.rollbackState.pendingOperations.some((operation) => operation.kind === "VOID_INTAKE" && operation.label === "dependent"));
  await assert.rejects(() => resumePap437CommercialRollback(port, incomplete!.rollbackState), Pap437RollbackIncompleteError);
});

test("PAP-437 rejects dependent cleanup that mutates Parent disposition", async () => {
  const port = new FakePort();
  port.corruptNextDependentVoid("ARCHIVED");
  port.failNextCommandContaining("enrollments");
  let incomplete: Pap437RollbackIncompleteError | null = null;
  try { await preparePap437CommercialFixture(port, "baddepvoiddisp", now); } catch (error) { assert.ok(error instanceof Pap437RollbackIncompleteError); incomplete = error; }
  assert.ok(incomplete);
  assert.match(incomplete.rollbackErrors.join(" | "), /must return REUSED_UNCHANGED/i);
  assert.ok(incomplete.rollbackState.pendingOperations.some((operation) => operation.kind === "VOID_INTAKE" && operation.label === "dependent"));
});

test("PAP-437 concurrent same-run attempts cannot archive the surviving attempt topology", async () => {
  const port = new FakePort();
  const outcomes = await Promise.allSettled([
    preparePap437CommercialFixture(port, "parallel01", now),
    preparePap437CommercialFixture(port, "parallel01", now),
  ]);
  const fulfilled = outcomes.filter((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof preparePap437CommercialFixture>>> => item.status === "fulfilled");
  const rejected = outcomes.filter((item): item is PromiseRejectedResult => item.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  const winner = fulfilled[0]!.value;
  const pathCreates = port.calls.filter((call) => call.method === "POST" && call.path === "catalog/paths");
  assert.ok(pathCreates.length >= 1);
  const pathCodes = pathCreates.map((call) => String((call.body as Record<string, unknown>).code));
  assert.equal(new Set(pathCodes).size, pathCodes.length);
  if (pathCodes.length > 1) assert.ok(pathCodes.every((code) => /-g1-a[a-f0-9]{16}$/.test(code)));
  const live = await port.get<F3BootstrapState>("delivery/bootstrap-state");
  const activePaths = live.paths.filter((item) => item.status === "ACTIVE");
  const activeSpaces = live.learningSpaces.filter((item) => item.status === "ACTIVE");
  const activeClasses = live.runningClasses.filter((item) => item.status === "ACTIVE");
  assert.deepEqual(activePaths.map((item) => item.id), [winner.path.id]);
  assert.deepEqual(activeSpaces.map((item) => item.id), [winner.space.id]);
  assert.deepEqual(new Set(activeClasses.map((item) => item.id)), new Set([...winner.happyClasses, winner.blockedClass].map((item) => item.id)));
  await cleanupPap437CommercialFixture(port, winner, now);
});

test("PAP-437 preserves durable rollback state when the owner lifecycle read fails", async () => {
  const port = new FakePort();
  port.failNextCommandContaining("enrollments");
  port.failNthGetContaining("/lifecycle", 6);
  let incomplete: Pap437RollbackIncompleteError | null = null;
  try {
    await preparePap437CommercialFixture(port, "ownerread", now);
  } catch (error) {
    assert.ok(error instanceof Pap437RollbackIncompleteError);
    incomplete = error;
  }
  assert.ok(incomplete);
  assert.match(incomplete.rollbackErrors.join(" | "), /read owner lifecycle/i);
  assert.equal(incomplete.rollbackState.runTag, "ownerread");
  assert.equal(JSON.parse(JSON.stringify(incomplete.rollbackState)).runTag, "ownerread");
  assert.equal([...port.students.values()].some((item) => item.lifecycle.student.status === "ACTIVE"), true);
  await resumePap437CommercialRollback(port, incomplete.rollbackState);
  assert.equal([...port.students.values()].every((item) => item.lifecycle.student.status === "ARCHIVED"), true);
});

test("PAP-437 rejects missing topology attempt identity instead of falsely certifying ambiguous cleanup", async () => {
  const port = new FakePort();
  port.loseResponseAfterNext("catalog/paths");
  port.failNthGetContaining("delivery/bootstrap-state", 2);
  let incomplete: Pap437RollbackIncompleteError | null = null;
  try {
    await preparePap437CommercialFixture(port, "losttoken", now);
  } catch (error) {
    assert.ok(error instanceof Pap437RollbackIncompleteError);
    incomplete = error;
  }
  assert.ok(incomplete);
  assert.equal(incomplete.rollbackState.pathId, null);
  assert.match(incomplete.rollbackState.attemptToken ?? "", /^[a-f0-9]{16}$/);
  assert.equal(port.bootstrap.paths.some((item) => item.status === "ACTIVE"), true);
  incomplete.rollbackState.attemptToken = null;
  await assert.rejects(
    () => resumePap437CommercialRollback(port, incomplete!.rollbackState),
    (error: unknown) => error instanceof Pap437RollbackIncompleteError && /ownership identity is missing or malformed/i.test(error.rollbackErrors.join(" | ")),
  );
  assert.equal(port.bootstrap.paths.some((item) => item.status === "ACTIVE"), true);
});
test("PAP-437 fails closed without exactly one active E2E Comparator Center or a bounded run tag", async () => {
  const missing = new FakePort();
  missing.bootstrap.centers = missing.bootstrap.centers.filter((item) => item.centerKey !== "e2e-comparator");
  await assert.rejects(() => preparePap437CommercialFixture(missing, "safe01", now), /exactly one active e2e-comparator/i);

  const duplicate = new FakePort();
  duplicate.bootstrap.centers.push({ ...duplicate.bootstrap.centers[0]!, id: uuid(999), displayName: "E2E Comparator duplicate" });
  await assert.rejects(() => preparePap437CommercialFixture(duplicate, "safe02", now), /exactly one active e2e-comparator/i);

  assert.throws(() => normalizeRunTag("../../prod"), /lowercase alphanumeric/i);
  assert.throws(() => normalizeRunTag("THIS-IS-NOT-BOUNDED"), /lowercase alphanumeric/i);
});

type Call = { method: string; path: string; body?: unknown; key?: string };
type IntakeState = { parentUserId:string; parentReused:boolean; createdContactIdentifierId:string|null; guardianRelationshipId:string };
type StudentState = { lifecycle: BoLearnerLifecycle; intake: IntakeState };
type ParentState = { id:string; displayName:string; status:"ACTIVE"|"ARCHIVED"; version:number; contact:{id:string;normalizedValue:string;retiredAt:string|null}|null };

class FakePort implements Pap437FixturePort {
  readonly e2eCenterId = uuid(1);
  readonly operationalCenterId = uuid(2);
  readonly calls: Call[] = [];
  readonly replay = new Map<string, { fingerprint: string; result: unknown }>();
  readonly students = new Map<string, StudentState>();
  readonly parents = new Map<string, ParentState>();
  readonly bills = new Map<string, BoSaleResult["bill"]>();
  private raceParentContact: string | null = null;
  private conflictAfterLookupContact: string | null = null;
  private responseLosses = new Map<string, { skip: number; remaining: number }>();
  private getFailures = new Map<string, { skip: number; remaining: number }>();
  private studentVoidResponseLoss: { skip: number; remaining: number } | null = null;
  private preCommitFailures = new Map<string, { skip: number; remaining: number }>();
  private failNextCommandFragment: string | null = null;
  private preserveNextOwnedParentShared = false;
  private corruptNextOwnedParentVoidResult: "REUSED_UNCHANGED" | "WRONG_PARENT" | null = null;
  private corruptNextDependentIntakeResult: "WRONG_PARENT" | null = null;
  private corruptNextDependentVoidResult: "WRONG_PARENT" | "ARCHIVED" | "WRONG_STUDENT" | "CONTACT_RETIRED" | null = null;
  private externalParentDependents = new Map<string, number>();
  private next = 10;
  readonly plan: BoProductPlan = {
    id: uuid(3), cadence: 2, termWeeks: 12, purchasedUnits: 24, listPriceMinor: 3900000,
    currency: "VND", enabled: true, badge: "HERO", createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 1,
  };
  bootstrap: F3BootstrapState = {
    asOf: now.toISOString(),
    centers: [
      { id: this.e2eCenterId, centerKey: "e2e-comparator", displayName: "E2E Comparator", timeZone: "Asia/Ho_Chi_Minh", status: "active" },
      { id: this.operationalCenterId, centerKey: "can-tho", displayName: "Cần Thơ", timeZone: "Asia/Ho_Chi_Minh", status: "active" },
    ],
    paths: [], learningSpaces: [], activeLearningSpaces: [], runningClasses: [], activeRunningClasses: [], runningClassBlocks: [], terms: [], termWeeks: [], upcomingSessions: [], materializationPolicyStreams: [],
  };

  async get<T>(path: string): Promise<T> {
    this.calls.push({ method: "GET", path });
    this.maybeFailGet(path);
    if (path === "delivery/bootstrap-state") return structuredClone(this.bootstrap) as T;
    if (path === "billing/product-plans") return [this.plan] as T;
    if (path.startsWith("identity/parents?")) {
      const query = new URLSearchParams(path.split("?")[1] ?? "").get("query") ?? "";
      const rows: BoParentSearchResult[] = [...this.parents.values()]
        .filter((parent) => parent.status === "ACTIVE" && (parent.displayName.includes(query) || parent.contact?.normalizedValue.includes(query)))
        .map((parent) => ({
          parent: { id:parent.id, displayName:parent.displayName, status:parent.status, createdAt:now.toISOString(), updatedAt:now.toISOString(), version:parent.version },
          contacts: parent.contact && parent.contact.retiredAt === null ? [{ id:parent.contact.id, parentUserId:parent.id, identifierType:"EMAIL", normalizedValue:parent.contact.normalizedValue, isPrimary:true, verifiedAt:null, createdAt:now.toISOString(), retiredAt:null }] : [],
        }));
      return structuredClone(rows) as T;
    }
    if (path.startsWith("students/") && path.endsWith("/lifecycle")) {
      const studentId = path.split("/")[1]!;
      const state = this.students.get(studentId);
      if (!state) throw new Error(`missing student ${studentId}`);
      return structuredClone(state.lifecycle) as T;
    }
    if (path.startsWith("billing/bills/")) {
      const id = path.split("/")[2]!;
      const bill = this.bills.get(id);
      if (!bill) throw new Error(`missing bill ${id}`);
      return structuredClone(bill) as T;
    }
    throw new Error(`unexpected GET ${path}`);
  }

  async command<T>(method: "POST" | "PATCH", path: string, body: unknown, key?: string): Promise<T> {
    this.calls.push({ method, path, body: structuredClone(body), key });
    if (this.failNextCommandFragment && path.includes(this.failNextCommandFragment)) {
      const fragment = this.failNextCommandFragment;
      this.failNextCommandFragment = null;
      throw new Error(`simulated command failure for ${fragment}`);
    }
    this.maybeFailBeforeCommit(path);
    if (key) {
      const fingerprint = JSON.stringify({ method, path, body });
      const previous = this.replay.get(key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new Error("conflicting replay");
        this.maybeLoseResponse(path);
        return structuredClone(previous.result) as T;
      }
      const result = await this.execute(method, path, body);
      this.replay.set(key, { fingerprint, result: structuredClone(result) });
      this.maybeLoseResponse(path);
      return structuredClone(result) as T;
    }
    const result = await this.execute(method, path, body);
    this.maybeLoseResponse(path);
    return structuredClone(result) as T;
  }

  private async execute(method: "POST" | "PATCH", path: string, body: unknown): Promise<unknown> {
    const input = body as Record<string, any>;
    if (method === "POST" && path === "catalog/paths") {
      const item: F3Path = { id: this.id(), code: input.code, displayName: input.displayName, status: input.status, version: 1 };
      this.bootstrap.paths.push(item); return item;
    }
    const pathUpdate = /^catalog\/paths\/(.+)$/.exec(path);
    if (method === "PATCH" && pathUpdate) {
      const item = this.bootstrap.paths.find((candidate) => candidate.id === pathUpdate[1])!;
      if (item.status === "ARCHIVED" && input.status !== "ARCHIVED") throw new Error("ARCHIVED_RECORD_IMMUTABLE");
      Object.assign(item, { code: input.code, displayName: input.displayName, status: input.status, version: item.version + 1 }); return item;
    }
    if (method === "POST" && path === "delivery/learning-spaces") {
      const item: F3LearningSpace = { id: this.id(), centerId: input.centerId, code: input.code, displayName: input.displayName, optimalConcurrentCapacity: input.optimalConcurrentCapacity, hardConcurrentCapacity: input.hardConcurrentCapacity, status: input.status, version: 1 };
      this.bootstrap.learningSpaces.push(item); this.syncActive(); return item;
    }
    if (method === "POST" && path === "delivery/running-classes") {
      const item: F3RunningClass = { id: this.id(), centerId: input.centerId, pathProgramId: input.pathProgramId, learningSpaceId: input.learningSpaceId, operationalName: input.operationalName, weekdayIso: input.weekdayIso, windowStartsLocal: input.windowStartsLocal, windowEndsLocal: input.windowEndsLocal, deliveryTopology: input.deliveryTopology, defaultParticipationMinutes: input.defaultParticipationMinutes, optimalConcurrentCapacity: input.optimalConcurrentCapacity, hardConcurrentCapacity: input.hardConcurrentCapacity, status: input.status, version: 1 };
      this.bootstrap.runningClasses.push(item); this.syncActive(); return item;
    }
    const lifecycleClass = /^delivery\/(running-classes|learning-spaces)\/(.+)\/lifecycle$/.exec(path);
    if (method === "POST" && lifecycleClass) {
      const list = lifecycleClass[1] === "running-classes" ? this.bootstrap.runningClasses : this.bootstrap.learningSpaces;
      const item = list.find((candidate) => candidate.id === lifecycleClass[2])!;
      if (input.status === "ACTIVE") throw new Error("canonical lifecycle endpoint does not support ACTIVE reactivation");
      if (item.status === "ARCHIVED" && input.status !== "ARCHIVED") throw new Error("ARCHIVED_RECORD_IMMUTABLE");
      Object.assign(item, { status: input.status, version: item.version + 1 }); this.syncActive(); return item;
    }
    if (method === "POST" && path === "student-intakes") {
      const studentProfileId = this.id();
      const requestedContact = input.existingParentUserId ? null : String(input.contactValue).toLowerCase();
      if (requestedContact && this.raceParentContact === requestedContact) { this.seedExistingParent(requestedContact); this.raceParentContact = null; }
      if (requestedContact && this.conflictAfterLookupContact === requestedContact) { this.seedExistingParent(requestedContact); this.conflictAfterLookupContact = null; throw new Error("Parent contact already belongs to an active Parent"); }
      let parent = input.existingParentUserId ? this.parents.get(input.existingParentUserId) ?? null : [...this.parents.values()].find((item) => item.status === "ACTIVE" && item.contact?.retiredAt === null && item.contact.normalizedValue === requestedContact) ?? null;
      const parentReused = parent !== null;
      let createdContactIdentifierId: string | null = null;
      if (!parent) {
        const parentUserId = this.id();
        createdContactIdentifierId = this.id();
        parent = { id:parentUserId, displayName:input.guardianDisplayName ?? "E2E Parent", status:"ACTIVE", version:1, contact:{id:createdContactIdentifierId,normalizedValue:String(input.contactValue).toLowerCase(),retiredAt:null} };
        this.parents.set(parentUserId, parent);
        if (this.preserveNextOwnedParentShared) {
          this.externalParentDependents.set(parentUserId, 1);
          this.preserveNextOwnedParentShared = false;
        }
      }
      const guardianRelationshipId = this.id();
      const result = { studentProfileId, parentUserId:parent.id, guardianRelationshipId, createdContactIdentifierId, parentReused };
      this.students.set(studentProfileId, { lifecycle: this.lifecycle(studentProfileId, input.displayName, parent.id, guardianRelationshipId), intake:{parentUserId:parent.id,parentReused,createdContactIdentifierId,guardianRelationshipId} });
      if (parentReused && this.corruptNextDependentIntakeResult === "WRONG_PARENT") {
        this.corruptNextDependentIntakeResult = null;
        return { ...result, parentUserId: this.seedExistingParent(`wrong-dependent-${parent.contact?.normalizedValue ?? "parent@example.invalid"}`) };
      }
      return result;
    }
    if (method === "POST" && path === "billing/sales") {
      const subscription = this.subscription(input.studentProfileId, input.pathProgramId, 2, this.plan.purchasedUnits, this.plan.id, `bill:${uuid(this.next + 1)}`);
      const billId = this.id();
      subscription.commercialReference = `bill:${billId}`;
      const billItemId = this.id();
      const bill = { bill: { id: billId, payerParentUserId: input.payerParentUserId, currency: "VND", billDiscountMinor: 0, dueOn: null, campaignReference: input.campaignReference ?? null, voidedAt: null, createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 1 }, items: [{ id: billItemId, billId, productPlanId: this.plan.id, studentProfileId: input.studentProfileId, subscriptionId: subscription.id, quantity: 1, unitPriceMinor: this.plan.listPriceMinor, discountAmountMinor: 0, descriptionSnapshot: "E2E", createdAt: now.toISOString() }], specialtyItems: [], transactions: [], grossAmountMinor: this.plan.listPriceMinor, itemDiscountMinor: 0, netAmountMinor: this.plan.listPriceMinor, collectedAmountMinor: 0, balanceMinor: this.plan.listPriceMinor, paymentState: "OPEN" as const, isOverdue: false };
      const student = this.students.get(input.studentProfileId)!;
      student.lifecycle.subscriptions.push({ subscription, enrollments: [] });
      this.bills.set(billId, bill);
      const result: BoSaleResult = { productPlan: this.plan, bill, billItem: bill.items[0]!, subscriptionId: subscription.id, contractualStartsOn: input.contractualStartsOn, contractualEndsOn: "2027-01-02", purchasedUnits: this.plan.purchasedUnits };
      return result;
    }
    if (method === "POST" && path === "subscriptions") {
      const subscription = this.subscription(input.studentProfileId, input.pathProgramId, input.weeklyCommitment, input.purchasedUnits, null, input.commercialReference ?? null);
      this.students.get(input.studentProfileId)!.lifecycle.subscriptions.push({ subscription, enrollments: [] });
      return subscription;
    }
    if (method === "POST" && path === "enrollments") {
      const student = [...this.students.values()].find((state) => state.lifecycle.subscriptions.some((entry) => entry.subscription.id === input.subscriptionId))!;
      const entry = student.lifecycle.subscriptions.find((candidate) => candidate.subscription.id === input.subscriptionId)!;
      const enrollment = { id: this.id(), subscriptionId: input.subscriptionId, runningClassId: input.runningClassId, runningClassName: "blocked", effectiveFromLocalDate: input.effectiveFromLocalDate, effectiveUntilExclusiveLocalDate: null, plannedEntryLocalTime: null, plannedDurationMinutes: null, predecessorEnrollmentId: null, transitionType: null, version: 1 };
      entry.enrollments.push(enrollment); return { enrollment };
    }
    const neutralize = /^subscriptions\/(.+)\/neutralize$/.exec(path);
    if (method === "POST" && neutralize) {
      for (const state of this.students.values()) for (const entry of state.lifecycle.subscriptions) if (entry.subscription.id === neutralize[1]) { entry.subscription.lifecycle = "CANCELLED"; entry.subscription.version += 1; for (const enrollment of entry.enrollments) enrollment.effectiveUntilExclusiveLocalDate = input.releaseLocalDate; return { subscription: entry.subscription, enrollments: entry.enrollments, endedEnrollmentIds: entry.enrollments.map((item) => item.id), releasedEnrollmentCount: entry.enrollments.length, releaseLocalDate: input.releaseLocalDate }; }
    }
    const voidBill = /^billing\/bills\/(.+)\/void$/.exec(path);
    if (method === "POST" && voidBill) {
      const bill = this.bills.get(voidBill[1]!)!; bill.bill.voidedAt = now.toISOString(); bill.bill.version += 1; bill.paymentState = "VOID"; return bill;
    }
    const voidStudent = /^student-intakes\/(.+)\/void$/.exec(path);
    if (method === "POST" && voidStudent) {
      const state = this.students.get(voidStudent[1]!)!;
      const parent = this.parents.get(state.intake.parentUserId)!;
      const otherActiveGuardians = [...this.students.entries()].filter(([id,item]) => id !== voidStudent[1] && item.intake.parentUserId === parent.id && item.lifecycle.student.status === "ACTIVE").length + (this.externalParentDependents.get(parent.id) ?? 0);
      let parentDisposition: "REUSED_UNCHANGED"|"PRESERVED_SHARED"|"ARCHIVED" = state.intake.parentReused ? "REUSED_UNCHANGED" : "PRESERVED_SHARED";
      let retiredContactCount = 0;
      const corruption = !state.intake.parentReused ? this.corruptNextOwnedParentVoidResult : null;
      const dependentCorruption = state.intake.parentReused ? this.corruptNextDependentVoidResult : null;
      if (corruption) this.corruptNextOwnedParentVoidResult = null;
      if (dependentCorruption) this.corruptNextDependentVoidResult = null;
      if (!state.intake.parentReused && state.intake.createdContactIdentifierId && otherActiveGuardians === 0 && corruption !== "REUSED_UNCHANGED") {
        parent.status = "ARCHIVED"; parent.version += 1; if (parent.contact) parent.contact.retiredAt = now.toISOString(); parentDisposition = "ARCHIVED"; retiredContactCount = 1;
      }
      state.lifecycle.student.status = "ARCHIVED"; state.lifecycle.student.version += 1;
      const reportedParentUserId = corruption === "WRONG_PARENT" || dependentCorruption === "WRONG_PARENT" ? this.seedExistingParent(`wrong-${parent.contact?.normalizedValue ?? "parent@example.invalid"}`) : parent.id;
      const reportedDisposition = corruption === "REUSED_UNCHANGED" ? "REUSED_UNCHANGED" : dependentCorruption === "ARCHIVED" ? "ARCHIVED" : parentDisposition;
      const reportedRetiredContactCount = dependentCorruption === "ARCHIVED" || dependentCorruption === "CONTACT_RETIRED" ? 1 : retiredContactCount;
      const reportedStudentProfileId = dependentCorruption === "WRONG_STUDENT" ? this.id() : state.lifecycle.student.id;
      return { studentProfileId: reportedStudentProfileId, studentStatus: "ARCHIVED", guardianRelationshipId:state.intake.guardianRelationshipId, guardianStatus:"ENDED", parentUserId:reportedParentUserId, parentDisposition:reportedDisposition, retiredContactCount:reportedRetiredContactCount };
    }
    throw new Error(`unexpected ${method} ${path}`);
  }

  seedExistingParent(normalizedContact:string) {
    const id=this.id(),contactId=this.id(); this.parents.set(id,{id,displayName:"Existing Parent",status:"ACTIVE",version:1,contact:{id:contactId,normalizedValue:normalizedContact.toLowerCase(),retiredAt:null}}); return id;
  }
  raceParentOnNextIntake(normalizedContact:string){ this.raceParentContact = normalizedContact.toLowerCase(); }
  conflictParentAfterLookupOnNextIntake(normalizedContact:string){ this.conflictAfterLookupContact = normalizedContact.toLowerCase(); }
  loseResponseAfterNext(path:string, count = 1){ this.loseResponseAfterNth(path, 1, count); }
  loseResponseAfterNth(path:string, nth:number, count = 1){ if (nth < 1 || count < 1) throw new Error("response-loss schedule must be positive"); this.responseLosses.set(path, { skip: nth - 1, remaining: count }); }
  loseResponseAfterNthStudentVoid(nth:number, count = 1){ if (nth < 1 || count < 1) throw new Error("response-loss schedule must be positive"); this.studentVoidResponseLoss = { skip: nth - 1, remaining: count }; }
  private maybeLoseResponse(path:string){
    if (path.startsWith("student-intakes/") && path.endsWith("/void") && this.studentVoidResponseLoss) {
      const plan = this.studentVoidResponseLoss;
      if (plan.skip > 0) plan.skip -= 1;
      else { plan.remaining -= 1; if (plan.remaining <= 0) this.studentVoidResponseLoss = null; throw new Error(`simulated response loss after ${path}`); }
    }
    const plan = this.responseLosses.get(path); if (!plan) return; if (plan.skip > 0) { plan.skip -= 1; return; } plan.remaining -= 1; if (plan.remaining <= 0) this.responseLosses.delete(path); throw new Error(`simulated response loss after ${path}`);
  }
  failNthGetContaining(fragment:string, nth:number, count = 1){ if (nth < 1 || count < 1) throw new Error("GET failure schedule must be positive"); this.getFailures.set(fragment, { skip: nth - 1, remaining: count }); }
  private maybeFailGet(path:string){
    for (const [fragment, plan] of this.getFailures) {
      if (!path.includes(fragment)) continue;
      if (plan.skip > 0) { plan.skip -= 1; return; }
      plan.remaining -= 1;
      if (plan.remaining <= 0) this.getFailures.delete(fragment);
      throw new Error(`simulated GET failure for ${path}`);
    }
  }
  failBeforeNextCommit(path:string, count = 1){ this.failBeforeNthCommit(path, 1, count); }
  failBeforeNthCommit(path:string, nth:number, count = 1){ if (nth < 1 || count < 1) throw new Error("pre-commit failure schedule must be positive"); this.preCommitFailures.set(path, { skip: nth - 1, remaining: count }); }
  private maybeFailBeforeCommit(path:string){ const plan = this.preCommitFailures.get(path); if (!plan) return; if (plan.skip > 0) { plan.skip -= 1; return; } plan.remaining -= 1; if (plan.remaining <= 0) this.preCommitFailures.delete(path); throw new Error(`simulated pre-commit transport failure for ${path}`); }
  failNextCommandContaining(fragment:string){ this.failNextCommandFragment = fragment; }
  preserveOwnedParentAsShared(){ this.preserveNextOwnedParentShared = true; }
  corruptNextOwnedParentVoid(mode: "REUSED_UNCHANGED" | "WRONG_PARENT"){ this.corruptNextOwnedParentVoidResult = mode; }
  corruptNextDependentIntake(mode: "WRONG_PARENT"){ this.corruptNextDependentIntakeResult = mode; }
  corruptNextDependentVoid(mode: "WRONG_PARENT" | "ARCHIVED" | "WRONG_STUDENT" | "CONTACT_RETIRED"){ this.corruptNextDependentVoidResult = mode; }
  activeBillCount(){ return [...this.bills.values()].filter((bill) => !bill.bill.voidedAt).length; }
  parentStatus(parentId:string){ return this.parents.get(parentId)?.status ?? null; }

  private lifecycle(studentId: string, displayName: string, parentId: string, relationshipId: string): BoLearnerLifecycle {
    return { student: { id: studentId, displayName, birthYear: 2018, birthPrecision: "YEAR_ONLY", status: "ACTIVE", houseMember: false, activeSubscriptions: 0, activePaths: [], birthMonth: null, birthDay: null, version: 1 }, houseMembership: null, guardians: [{ relationshipId, relationshipType: "PARENT", parent: { id: parentId, displayName: "E2E Parent", status: "ACTIVE", contacts: [] } }], subscriptions: [] };
  }

  private subscription(studentProfileId: string, pathProgramId: string, weeklyCommitment: number, units: number, productPlanId: string | null, commercialReference: string | null): BoLearnerSubscription {
    return { id: this.id(), studentProfileId, pathProgramId, pathDisplayName: "E2E", lifecycle: "ACTIVE", serviceStartsOn: "2026-10-10", contractualStartsOn: "2026-10-10", contractualEndsOn: "2027-01-02", productPlanId, termWeeks: productPlanId ? 12 : null, weeklyCommitment, predecessorSubscriptionId: null, transitionType: null, commercialReference, completedAt: null, version: 1, historicalBalance: units, effectiveAvailableUnits: units };
  }

  private id() { return uuid(this.next++); }
  private syncActive() { this.bootstrap.activeLearningSpaces = this.bootstrap.learningSpaces.filter((item) => item.status === "ACTIVE"); this.bootstrap.activeRunningClasses = this.bootstrap.runningClasses.filter((item) => item.status === "ACTIVE"); }
}


test("PAP-437 fetch adapter preserves canonical envelope and exact replay header", async () => {
  const seen: Array<{url:string;init?:RequestInit}> = [];
  const port = createPap437FetchPort("https://bo.pinohouse.art/", async (input, init) => {
    seen.push({url:String(input),init});
    return Response.json({data:{ok:true}}, {status:200});
  });
  assert.deepEqual(await port.get<{ok:boolean}>("delivery/bootstrap-state"), {ok:true});
  assert.deepEqual(await port.command<{ok:boolean}>("POST", "billing/sales", {x:1}, "pap437:adapter:sale"), {ok:true});
  assert.deepEqual(await port.command<{ok:boolean}>("POST", "catalog/paths", {code:"e2e",displayName:"E2E",status:"ACTIVE"}), {ok:true});
  assert.deepEqual(await port.command<{ok:boolean}>("PATCH", `catalog/paths/${uuid(999)}`, {code:"e2e",displayName:"E2E",status:"ARCHIVED",expectedVersion:1}), {ok:true});
  assert.equal(seen[0]!.url, "https://bo.pinohouse.art/api/bo/delivery/bootstrap-state");
  assert.equal(seen[1]!.url, "https://bo.pinohouse.art/api/bo/billing/sales");
  assert.equal(seen[2]!.url, "https://bo.pinohouse.art/api/bo/catalog/paths");
  assert.equal(seen[3]!.url, `https://bo.pinohouse.art/api/bo/catalog/paths/${uuid(999)}`);
  assert.equal(new Headers(seen[1]!.init?.headers).get("idempotency-key"), "pap437:adapter:sale");
  assert.equal(seen[3]!.init?.method, "PATCH");
  assert.equal(seen[1]!.init?.credentials, "include");
});
