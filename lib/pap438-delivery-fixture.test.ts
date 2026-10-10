import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanupPap438DeliveryFixture,
  createPap438FetchPort,
  preparePap438DeliveryFixture,
  provePap438DraftOnlyBehavior,
  publishAndMaterializePap438Fixture,
  type Pap438FixturePort,
} from "./pap438-delivery-fixture";
import type { F3BootstrapState, F3LearningSpace, F3Path, F3PolicyStream, F3RunningClass, F3Session } from "./f3-delivery-api";

const uuid = (n: number) => `01990000-${String(n).padStart(4,"0")}-7000-8000-${String(n).padStart(12,"0")}`;
const now = new Date("2026-10-10T06:00:00.000Z");

test("PAP-438 first-run Draft stays non-effective until publish, then exactly one bounded Session materializes", async () => {
  const port = new FakePort();
  const fixture = await preparePap438DeliveryFixture(port, "run01", now, 3);
  assert.equal(fixture.initialPolicyMode, "ABSENT");
  assert.equal(fixture.initialGlobalPolicyMode, "ABSENT");
  assert.equal(fixture.centerId, port.e2eCenterId);
  assert.equal(port.stream?.draftValue?.horizonDays, 3);
  assert.equal(port.stream?.publishedValue, null);

  const draftProbe = await provePap438DraftOnlyBehavior(port, fixture, now.toISOString());
  assert.equal(draftProbe.mode, "NO_EFFECTIVE_POLICY_BLOCKED");
  assert.equal(port.bootstrap.upcomingSessions.length, 0);

  const active = await publishAndMaterializePap438Fixture(port, fixture, new Date("2026-10-10T06:10:00.000Z"));
  assert.equal(active.materialization.policy.horizonDays, 3);
  assert.equal(active.materialization.attempted, 1);
  assert.equal(active.materialization.materialized, 1);
  assert.equal(active.session.runningClassId, fixture.runningClass.id);
  assert.equal(active.session.localDate, fixture.startsOnLocalDate);

  const replay = await port.command<typeof active.materialization>("POST", "delivery/materializations", {
    centerId: fixture.centerId, startsOnLocalDate: fixture.startsOnLocalDate, effectiveAt: active.policyEffectiveAt,
  }, "pap438:run01:materialize-replay");
  assert.equal(replay.existing, 1);
  assert.equal(replay.materialized, 0);
});

test("PAP-438 cleanup supersedes test policy with idle horizon=1 and archives topology while retaining inert Session provenance", async () => {
  const port = new FakePort();
  const fixture = await preparePap438DeliveryFixture(port, "clean01", now, 4);
  await provePap438DraftOnlyBehavior(port, fixture, now.toISOString());
  const active = await publishAndMaterializePap438Fixture(port, fixture, new Date("2026-10-10T06:10:00.000Z"));
  const result = await cleanupPap438DeliveryFixture(port, active, new Date("2026-10-10T06:20:00.000Z"));

  assert.deepEqual(result, { cleaned: true, idleHorizonDays: 1, retainedSessionId: active.session.id });
  assert.equal(port.stream?.publishedValue?.horizonDays, 1);
  assert.equal(port.stream?.draftVersionId, null);
  assert.equal(port.bootstrap.paths.find((item) => item.id === fixture.path.id)?.status, "ARCHIVED");
  assert.equal(port.bootstrap.learningSpaces.find((item) => item.id === fixture.space.id)?.status, "ARCHIVED");
  assert.equal(port.bootstrap.runningClasses.find((item) => item.id === fixture.runningClass.id)?.status, "ARCHIVED");
  assert.equal(port.bootstrap.upcomingSessions.find((item) => item.id === active.session.id)?.status, "SCHEDULED");
});

test("PAP-438 subsequent run accepts only idle baseline and does not claim Draft-only block", async () => {
  const port = new FakePort();
  port.installIdleBaseline();
  const fixture = await preparePap438DeliveryFixture(port, "run02", now, 2);
  assert.equal(fixture.initialPolicyMode, "IDLE_BASELINE");
  const behavior = await provePap438DraftOnlyBehavior(port, fixture, now.toISOString());
  assert.deepEqual(behavior, {
    mode: "BASELINE_REMAINS_EFFECTIVE",
    horizonDays: 1,
    note: "A Draft never overrides the already-published E2E idle baseline until explicit publish.",
  });

  const drift = new FakePort();
  drift.installPublishedPolicy(9);
  await assert.rejects(() => preparePap438DeliveryFixture(drift, "drift01", now, 3), /idle horizon=1/i);
});

test("PAP-438 recognizes GLOBAL fallback without executing a mutating Draft-only probe", async () => {
  const port = new FakePort();
  port.installGlobalPublishedPolicy(5);
  const fixture = await preparePap438DeliveryFixture(port, "global01", now, 3);
  assert.equal(fixture.initialGlobalPolicyMode, "EFFECTIVE");
  const behavior = await provePap438DraftOnlyBehavior(port, fixture, now.toISOString());
  assert.equal(behavior.mode, "GLOBAL_FALLBACK_REMAINS_EFFECTIVE");
  assert.equal(port.bootstrap.upcomingSessions.length, 0);
});

test("PAP-438 refuses any pre-existing active E2E topology, including same-run-prefix drift", async () => {
  const port = new FakePort();
  port.bootstrap.runningClasses.push({
    id: uuid(899), centerId: port.e2eCenterId, pathProgramId: uuid(901), learningSpaceId: uuid(902), operationalName: "[E2E] PAP-438 safe01 drift",
    weekdayIso: 7, windowStartsLocal: "18:00", windowEndsLocal: "19:00", deliveryTopology: "FLEXIBLE_STUDIO", defaultParticipationMinutes: 60,
    optimalConcurrentCapacity: 4, hardConcurrentCapacity: 4, status: "ACTIVE", version: 1,
  });
  port.syncActive();
  await assert.rejects(() => preparePap438DeliveryFixture(port, "safe01", now), /zero active Running Classes/i);
});

test("PAP-438 rechecks exact active topology before publish/materialization", async () => {
  const port = new FakePort();
  const fixture = await preparePap438DeliveryFixture(port, "drift02", now, 3);
  port.bootstrap.runningClasses.push({
    id: uuid(898), centerId: port.e2eCenterId, pathProgramId: fixture.path.id, learningSpaceId: fixture.space.id, operationalName: "[E2E] PAP-438 drift02 extra",
    weekdayIso: 7, windowStartsLocal: "18:00", windowEndsLocal: "19:00", deliveryTopology: "FLEXIBLE_STUDIO", defaultParticipationMinutes: 60,
    optimalConcurrentCapacity: 4, hardConcurrentCapacity: 4, status: "ACTIVE", version: 1,
  });
  port.syncActive();
  await assert.rejects(() => publishAndMaterializePap438Fixture(port, fixture, new Date("2026-10-10T06:10:00.000Z")), /exactly one active E2E Comparator Running Class/i);
  assert.equal(port.bootstrap.upcomingSessions.length, 0);
});

test("PAP-438 refuses foreign active E2E topology and malformed run ids", async () => {
  const port = new FakePort();
  port.bootstrap.runningClasses.push({
    id: uuid(900), centerId: port.e2eCenterId, pathProgramId: uuid(901), learningSpaceId: uuid(902), operationalName: "foreign",
    weekdayIso: 1, windowStartsLocal: "18:00", windowEndsLocal: "19:00", deliveryTopology: "FLEXIBLE_STUDIO", defaultParticipationMinutes: 60,
    optimalConcurrentCapacity: 4, hardConcurrentCapacity: 4, status: "ACTIVE", version: 1,
  });
  port.syncActive();
  await assert.rejects(() => preparePap438DeliveryFixture(port, "safe01", now), /zero active Running Classes/i);

  const bad = new FakePort();
  await assert.rejects(() => preparePap438DeliveryFixture(bad, "../prod", now), /lowercase alphanumeric/i);
});

test("PAP-438 fetch adapter preserves canonical BO envelope and replay header", async () => {
  const seen: Array<{url:string;init?:RequestInit}> = [];
  const port = createPap438FetchPort("https://bo.pinohouse.art/", async (input, init) => {
    seen.push({url:String(input),init});
    return Response.json({data:{ok:true}}, {status:200});
  });
  assert.deepEqual(await port.get<{ok:boolean}>("delivery/bootstrap-state"), {ok:true});
  assert.deepEqual(await port.command<{ok:boolean}>("POST", "delivery/materializations", {centerId:"x"}, "pap438:key"), {ok:true});
  assert.equal(seen[0]!.url, "https://bo.pinohouse.art/api/bo/delivery/bootstrap-state");
  assert.equal(seen[1]!.url, "https://bo.pinohouse.art/api/bo/delivery/materializations");
  assert.equal(new Headers(seen[1]!.init?.headers).get("idempotency-key"), "pap438:key");
  assert.equal(seen[1]!.init?.credentials, "include");
});

type StoredPolicy = F3PolicyStream & { draftValue: {horizonDays:number}|null; publishedValue: {horizonDays:number}|null };

class FakePort implements Pap438FixturePort {
  readonly e2eCenterId = uuid(1);
  readonly operationalCenterId = uuid(2);
  private next = 10;
  stream: StoredPolicy | null = null;
  globalStream: StoredPolicy | null = null;
  bootstrap: F3BootstrapState = {
    asOf: now.toISOString(),
    centers: [
      { id: this.e2eCenterId, centerKey: "e2e-comparator", displayName: "E2E Comparator", timeZone: "Asia/Ho_Chi_Minh", status: "active" },
      { id: this.operationalCenterId, centerKey: "can-tho", displayName: "Cần Thơ", timeZone: "Asia/Ho_Chi_Minh", status: "active" },
    ],
    paths: [], learningSpaces: [], activeLearningSpaces: [], runningClasses: [], activeRunningClasses: [], runningClassBlocks: [], terms: [], termWeeks: [], upcomingSessions: [], materializationPolicyStreams: [],
  };

  async get<T>(path: string): Promise<T> {
    if (path !== "delivery/bootstrap-state") throw new Error(`unexpected GET ${path}`);
    this.syncPolicy();
    return structuredClone(this.bootstrap) as T;
  }

  async command<T>(method: "POST" | "PATCH", path: string, body: unknown, _key?: string): Promise<T> {
    const input = body as Record<string, any>;
    if (method === "POST" && path === "catalog/paths") {
      const item: F3Path = { id: this.id(), code: input.code, displayName: input.displayName, status: input.status, version: 1 };
      this.bootstrap.paths.push(item); return structuredClone(item) as T;
    }
    const pathUpdate = /^catalog\/paths\/(.+)$/.exec(path);
    if (method === "PATCH" && pathUpdate) {
      const item = this.bootstrap.paths.find((candidate) => candidate.id === pathUpdate[1])!;
      Object.assign(item, { code: input.code, displayName: input.displayName, status: input.status, version: item.version + 1 }); return structuredClone(item) as T;
    }
    if (method === "POST" && path === "delivery/learning-spaces") {
      const item: F3LearningSpace = { id: this.id(), centerId: input.centerId, code: input.code, displayName: input.displayName, optimalConcurrentCapacity: input.optimalConcurrentCapacity, hardConcurrentCapacity: input.hardConcurrentCapacity, status: input.status, version: 1 };
      this.bootstrap.learningSpaces.push(item); this.syncActive(); return structuredClone(item) as T;
    }
    if (method === "POST" && path === "delivery/running-classes") {
      const item: F3RunningClass = { id: this.id(), centerId: input.centerId, pathProgramId: input.pathProgramId, learningSpaceId: input.learningSpaceId, operationalName: input.operationalName, weekdayIso: input.weekdayIso, windowStartsLocal: input.windowStartsLocal, windowEndsLocal: input.windowEndsLocal, deliveryTopology: input.deliveryTopology, defaultParticipationMinutes: input.defaultParticipationMinutes, optimalConcurrentCapacity: input.optimalConcurrentCapacity, hardConcurrentCapacity: input.hardConcurrentCapacity, status: input.status, version: 1 };
      this.bootstrap.runningClasses.push(item); this.syncActive(); return structuredClone(item) as T;
    }
    const lifecycle = /^delivery\/(running-classes|learning-spaces)\/(.+)\/lifecycle$/.exec(path);
    if (method === "POST" && lifecycle) {
      const list = lifecycle[1] === "running-classes" ? this.bootstrap.runningClasses : this.bootstrap.learningSpaces;
      const item = list.find((candidate) => candidate.id === lifecycle[2])!;
      Object.assign(item, { status: input.status, version: item.version + 1 }); this.syncActive(); return structuredClone(item) as T;
    }
    if (method === "POST" && path === "policies/delivery/materialization.v1/versions") {
      if (!this.stream) this.stream = this.newStream();
      if (this.stream.draftVersionId) throw new Error("existing draft");
      if (input.expectedRevision !== undefined && input.expectedRevision !== this.stream.revision) throw new Error("stale policy revision");
      const versionId = this.id();
      this.stream.revision += 1;
      this.stream.draftVersionId = versionId;
      this.stream.draftVersion = (this.stream.publishedVersion ?? 0) + 1;
      this.stream.draftValue = structuredClone(input.value);
      this.syncPolicy();
      return structuredClone({ streamId: this.stream.streamId, versionId, version: this.stream.draftVersion, revision: this.stream.revision }) as T;
    }
    const publish = /^policies\/delivery\/materialization\.v1\/versions\/(.+)\/publish$/.exec(path);
    if (method === "POST" && publish) {
      if (!this.stream || this.stream.draftVersionId !== publish[1] || input.expectedRevision !== this.stream.revision) throw new Error("policy publish conflict");
      this.stream.publishedVersionId = this.stream.draftVersionId;
      this.stream.publishedVersion = this.stream.draftVersion;
      this.stream.publishedValue = this.stream.draftValue;
      this.stream.effectiveFrom = input.effectiveFrom;
      this.stream.effectiveUntil = null;
      this.stream.draftVersionId = null; this.stream.draftVersion = null; this.stream.draftValue = null;
      this.stream.revision += 1; this.syncPolicy(); return structuredClone({ published: true }) as T;
    }
    if (method === "POST" && path === "delivery/materializations") {
      if (!this.stream?.publishedValue) throw new Error("Policy resolution unavailable");
      const runningClasses = this.bootstrap.runningClasses.filter((item) => item.centerId === input.centerId && item.status === "ACTIVE");
      let attempted=0, materialized=0, existing=0;
      for (const item of runningClasses) {
        for (let offset=0; offset<this.stream.publishedValue.horizonDays; offset++) {
          const localDate = plusLocalDays(input.startsOnLocalDate, offset);
          if (isoWeekday(localDate)!==item.weekdayIso) continue;
          attempted += 1;
          const prior = this.bootstrap.upcomingSessions.find((session) => session.runningClassId === item.id && session.localDate === localDate);
          if (prior) { existing += 1; continue; }
          this.bootstrap.upcomingSessions.push(this.session(item, localDate)); materialized += 1;
        }
      }
      return structuredClone({ policy: this.stream.publishedValue, attempted, materialized, existing, excluded:0, noOccurrence:0 }) as T;
    }
    throw new Error(`unexpected ${method} ${path}`);
  }

  installIdleBaseline() { this.installPublishedPolicy(1); }
  installGlobalPublishedPolicy(horizonDays:number) {
    this.globalStream = this.newStream("GLOBAL", null);
    this.globalStream.revision = 2;
    this.globalStream.publishedVersionId = this.id();
    this.globalStream.publishedVersion = 1;
    this.globalStream.publishedValue = {horizonDays};
    this.globalStream.effectiveFrom = "2026-10-01T00:00:00.000Z";
    this.syncPolicy();
  }
  installPublishedPolicy(horizonDays:number) {
    this.stream = this.newStream();
    this.stream.revision = 2;
    this.stream.publishedVersionId = this.id();
    this.stream.publishedVersion = 1;
    this.stream.publishedValue = {horizonDays};
    this.stream.effectiveFrom = "2026-10-01T00:00:00.000Z";
    this.syncPolicy();
  }
  syncActive() {
    this.bootstrap.activeLearningSpaces = this.bootstrap.learningSpaces.filter((item) => item.status === "ACTIVE");
    this.bootstrap.activeRunningClasses = this.bootstrap.runningClasses.filter((item) => item.status === "ACTIVE");
  }
  private syncPolicy(){ this.bootstrap.materializationPolicyStreams = [...(this.stream ? [structuredClone(this.stream)] : []), ...(this.globalStream ? [structuredClone(this.globalStream)] : [])]; }
  private newStream(targetType:"CENTER"|"GLOBAL"="CENTER", targetId:string|null=this.e2eCenterId): StoredPolicy { return { streamId:this.id(),targetType,targetId,revision:0,draftVersionId:null,draftVersion:null,draftValue:null,publishedVersionId:null,publishedVersion:null,effectiveFrom:null,effectiveUntil:null,publishedValue:null }; }
  private session(item:F3RunningClass, localDate:string):F3Session { return {id:this.id(),centerId:item.centerId,pathProgramId:item.pathProgramId,learningSpaceId:item.learningSpaceId,runningClassId:item.id,primarySyllabusId:null,learningSyllabusVersionId:null,localDate,startsLocal:item.windowStartsLocal,endsLocal:item.windowEndsLocal,startsAt:`${localDate}T11:00:00.000Z`,endsAt:`${localDate}T12:30:00.000Z`,timeZone:"Asia/Ho_Chi_Minh",optimalConcurrentCapacity:item.optimalConcurrentCapacity,hardConcurrentCapacity:item.hardConcurrentCapacity,status:"SCHEDULED"}; }
  private id(){ return uuid(this.next++); }
}

function plusLocalDays(localDate:string,days:number){const d=new Date(`${localDate}T12:00:00+07:00`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function isoWeekday(localDate:string){const d=new Date(`${localDate}T12:00:00+07:00`).getUTCDay();return d===0?7:d;}
