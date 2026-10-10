import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanupPap437CommercialFixture,
  createPap437FetchPort,
  normalizeRunTag,
  pap437AtomicFailureBulkBody,
  pap437HappyBulkBody,
  preparePap437CommercialFixture,
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

test("PAP-437 rolls back prepared topology when post-lookup Parent uniqueness conflict returns no intake result", async () => {
  const port = new FakePort();
  const contact = "pap437+atomic01@example.invalid";
  port.conflictParentAfterLookupOnNextIntake(contact);
  await assert.rejects(() => preparePap437CommercialFixture(port, "atomic01", now), /first intake failed.*topology was rolled back/i);
  assert.equal(port.students.size, 0);
  assert.equal(port.bootstrap.paths.every((item) => item.status === "ARCHIVED"), true);
  assert.equal(port.bootstrap.learningSpaces.every((item) => item.status === "ARCHIVED"), true);
  assert.equal(port.bootstrap.runningClasses.every((item) => item.status === "ARCHIVED"), true);
  const activeParents = await port.get<BoParentSearchResult[]>(`identity/parents?query=${encodeURIComponent(contact)}&limit=25`);
  assert.equal(activeParents.length, 1);
  assert.equal(activeParents[0]!.parent.status, "ACTIVE");
  await assert.rejects(() => preparePap437CommercialFixture(port, "atomic01", now), /already belongs to an active Parent/i);
  assert.equal(port.bootstrap.paths.filter((item) => item.status === "ACTIVE").length, 0);
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
    if (key) {
      const fingerprint = JSON.stringify({ method, path, body });
      const previous = this.replay.get(key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new Error("conflicting replay");
        return structuredClone(previous.result) as T;
      }
      const result = await this.execute(method, path, body);
      this.replay.set(key, { fingerprint, result: structuredClone(result) });
      return structuredClone(result) as T;
    }
    return structuredClone(await this.execute(method, path, body)) as T;
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
      }
      const guardianRelationshipId = this.id();
      const result = { studentProfileId, parentUserId:parent.id, guardianRelationshipId, createdContactIdentifierId, parentReused };
      this.students.set(studentProfileId, { lifecycle: this.lifecycle(studentProfileId, input.displayName, parent.id, guardianRelationshipId), intake:{parentUserId:parent.id,parentReused,createdContactIdentifierId,guardianRelationshipId} });
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
      const otherActiveGuardians = [...this.students.entries()].filter(([id,item]) => id !== voidStudent[1] && item.intake.parentUserId === parent.id && item.lifecycle.student.status === "ACTIVE").length;
      let parentDisposition: "REUSED_UNCHANGED"|"PRESERVED_SHARED"|"ARCHIVED" = state.intake.parentReused ? "REUSED_UNCHANGED" : "PRESERVED_SHARED";
      let retiredContactCount = 0;
      if (!state.intake.parentReused && state.intake.createdContactIdentifierId && otherActiveGuardians === 0) {
        parent.status = "ARCHIVED"; parent.version += 1; if (parent.contact) parent.contact.retiredAt = now.toISOString(); parentDisposition = "ARCHIVED"; retiredContactCount = 1;
      }
      state.lifecycle.student.status = "ARCHIVED"; state.lifecycle.student.version += 1;
      return { studentProfileId: state.lifecycle.student.id, studentStatus: "ARCHIVED", guardianRelationshipId:state.intake.guardianRelationshipId, guardianStatus:"ENDED", parentUserId:parent.id, parentDisposition, retiredContactCount };
    }
    throw new Error(`unexpected ${method} ${path}`);
  }

  seedExistingParent(normalizedContact:string) {
    const id=this.id(),contactId=this.id(); this.parents.set(id,{id,displayName:"Existing Parent",status:"ACTIVE",version:1,contact:{id:contactId,normalizedValue:normalizedContact.toLowerCase(),retiredAt:null}}); return id;
  }
  raceParentOnNextIntake(normalizedContact:string){ this.raceParentContact = normalizedContact.toLowerCase(); }
  conflictParentAfterLookupOnNextIntake(normalizedContact:string){ this.conflictAfterLookupContact = normalizedContact.toLowerCase(); }
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
  assert.equal(seen[0]!.url, "https://bo.pinohouse.art/api/bo/delivery/bootstrap-state");
  assert.equal(seen[1]!.url, "https://bo.pinohouse.art/api/bo/billing/sales");
  assert.equal(new Headers(seen[1]!.init?.headers).get("idempotency-key"), "pap437:adapter:sale");
  assert.equal(seen[1]!.init?.credentials, "include");
});
