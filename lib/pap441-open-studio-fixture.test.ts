import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanupPap441OpenStudioFixture,
  pap441SyntheticEmail,
  preparePap441OpenStudioFixture,
  type OpenStudioPolicyKey,
  type Pap441FixtureCheckpoint,
  type Pap441FixtureInput,
  type Pap441OpenStudioPort,
} from "./pap441-open-studio-fixture";

const runTag = "pap441-test";
const input: Pap441FixtureInput = {
  runTag,
  disposableCenterId: "center-e2e",
  disposableCenterConfirmed: true,
  sessionId: "session-1",
  syllabusId: "syllabus-1",
  pathProgramId: "path-1",
  effectiveAt: "2026-10-11T16:00:00.000Z",
  syntheticIdentity: {
    displayName: "PAP441 Synthetic Member",
    birthYear: 2014,
    birthMonth: 6,
    contactType: "EMAIL",
    contactValue: pap441SyntheticEmail(runTag),
  },
};

type FakeOptions = {
  identityDisposition?: "UNUSED" | "OWNED_BY_RUN" | "COLLISION";
  initialClaimStatus?: "RESERVED" | "RELEASED" | "CONSUMED";
  failPublicAcquireOnce?: boolean;
  failNeutralPolicyOnceAt?: number;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fakePort(options: FakeOptions = {}) {
  const calls: string[] = [];
  let checkpoint: Pap441FixtureCheckpoint | null = null;
  let claimStatus = options.initialClaimStatus ?? "RESERVED";
  let listingStatus: "PUBLISHED" | "CLOSED" | "CANCELLED" = "PUBLISHED";
  let memberCenterActive = false;
  let pathCenterActive = false;
  const revoked = new Set<string>();
  const neutralEffectiveAt = new Map<OpenStudioPolicyKey, string>();
  let failPublicAcquire = options.failPublicAcquireOnce ?? false;
  let identityOwnedByRun = options.identityDisposition === "OWNED_BY_RUN";
  let neutralPublishIndex = 0;
  let failNeutralPolicyOnceAt = options.failNeutralPolicyOnceAt ?? 0;

  const port: Pap441OpenStudioPort = {
    async loadCheckpoint(tag) {
      calls.push(`checkpoint:load:${tag}`);
      return checkpoint ? clone(checkpoint) : null;
    },
    async saveCheckpoint(value) {
      calls.push("checkpoint:save");
      checkpoint = clone(value);
    },
    async assertPrerequisites() { calls.push("prerequisites"); },
    async assertSyntheticIdentityAvailable(identity) {
      calls.push(`identity:${identity.contactValue}`);
      return {
        disposition: options.identityDisposition === "COLLISION" ? "COLLISION" : identityOwnedByRun ? "OWNED_BY_RUN" : "UNUSED",
        normalizedContact: identity.contactValue.toLowerCase(),
      };
    },
    async ensureCenterPolicy(key, _centerId, _value, effectiveAt, reason) {
      const phase = reason.includes("neutral") ? "neutral" : "active";
      calls.push(`policy:${key}:${phase}:${effectiveAt}`);
      if (phase === "neutral") {
        neutralPublishIndex += 1;
        if (failNeutralPolicyOnceAt === neutralPublishIndex) {
          failNeutralPolicyOnceAt = 0;
          throw new Error("synthetic neutral policy failure");
        }
        neutralEffectiveAt.set(key, effectiveAt);
      }
      return { effectiveFrom: effectiveAt };
    },
    async nextCenterPolicyEffectiveAt(key, _centerId, strictlyAfter) {
      calls.push(`policy-next:${key}:${strictlyAfter}`);
      return new Date(Date.parse(strictlyAfter) + 1_000).toISOString();
    },
    async readCenterPolicy(key, _centerId, effectiveAt) {
      calls.push(`policy-read:${key}:${effectiveAt}`);
      return { effectiveFrom: neutralEffectiveAt.get(key) ?? effectiveAt, matchesExpected: neutralEffectiveAt.get(key) === effectiveAt };
    },
    async createPublishedListing() { calls.push("listing:create"); return { listingId: "listing-1" }; },
    async publicAcquire() {
      calls.push("public-acquire");
      if (failPublicAcquire) {
        failPublicAcquire = false;
        throw new Error("synthetic public acquire failure");
      }
      return { registrationId: "registration-1" };
    },
    async firstPresent() { calls.push("first-present"); identityOwnedByRun = true; return { studentId: "student-1", houseMembershipId: "membership-1" }; },
    async assignMemberCenter() { calls.push("member-center:assign"); memberCenterActive = true; },
    async assignPathCenter() { calls.push("path-center:assign"); pathCenterActive = true; },
    async clearFixtureAssignments() { calls.push("assignments:clear"); memberCenterActive = false; pathCenterActive = false; },
    async readFixtureAssignments() { calls.push("assignments:read"); return { memberCenterActive, pathCenterActive }; },
    async issueMonthlyPathPasses() { calls.push("monthly-pass"); return ["monthly-1"]; },
    async issueBringAFriendPasses() { calls.push("baf-pass"); return ["baf-1"]; },
    async memberExplore() { calls.push("explore"); return { listingIds: ["listing-1"] }; },
    async memberOwnerEligibility() { calls.push("eligibility"); return { eligible: true, reasons: [] }; },
    async reserveOwner() { calls.push("reserve"); return { claimId: "claim-1" }; },
    async cancelClaim() { calls.push("claim:cancel"); if (claimStatus === "RESERVED") claimStatus = "RELEASED"; return { claimStatus }; },
    async readClaim() { calls.push("claim:read"); return { claimStatus }; },
    async revokePass({ passId }) { calls.push(`pass:revoke:${passId}`); revoked.add(passId); },
    async readPass({ passId }) { calls.push(`pass:read:${passId}`); return { revoked: revoked.has(passId) }; },
    async cancelListing() { calls.push("listing:cancel"); listingStatus = "CANCELLED"; },
    async closeListing() { calls.push("listing:close"); listingStatus = "CLOSED"; },
    async readListing() { calls.push("listing:read"); return { status: listingStatus }; },
  };

  return {
    port,
    calls,
    getCheckpoint: () => checkpoint ? clone(checkpoint) : null,
    setClaimStatus: (status: "RESERVED" | "RELEASED" | "CONSUMED") => { claimStatus = status; },
    setIdentityOwnedByRun: (value: boolean) => { identityOwnedByRun = value; },
  };
}

test("PAP-441 prepares replay-safe member fixture and fully cleans reserved-claim authority", async () => {
  const { port, calls, getCheckpoint } = fakePort();
  const state = await preparePap441OpenStudioFixture(port, input);

  assert.deepEqual(state, {
    registrationId: "registration-1",
    studentId: "student-1",
    houseMembershipId: "membership-1",
    listingId: "listing-1",
    monthlyPassIds: ["monthly-1"],
    bringAFriendPassIds: ["baf-1"],
    ownerClaimId: "claim-1",
  });
  assert.equal(calls.filter((call) => call === "reserve").length, 2);
  assert.equal(calls.filter((call) => call.includes(":active:")).length, 4);
  assert.ok(calls.indexOf(`identity:${input.syntheticIdentity.contactValue}`) < calls.indexOf("public-acquire"));
  assert.ok(calls.indexOf("checkpoint:save") < calls.findIndex((call) => call.startsWith("policy:")));

  await cleanupPap441OpenStudioFixture(port, input, state);

  assert.equal(calls.filter((call) => call === "claim:cancel").length, 2);
  assert.equal(calls.filter((call) => call.includes(":neutral:")).length, 4);
  assert.ok(calls.includes("pass:revoke:monthly-1"));
  assert.ok(calls.includes("pass:revoke:baf-1"));
  assert.ok(calls.includes("listing:cancel"));
  assert.ok(!calls.includes("listing:close"));
  assert.ok(calls.includes("assignments:clear"));
  assert.equal(calls.filter((call) => call.startsWith("policy-read:")).length, 4);
  for (const call of calls.filter((value) => value.includes(":neutral:"))) {
    const effectiveAt = call.split(":neutral:")[1]!;
    assert.ok(Date.parse(effectiveAt) > Date.parse(input.effectiveAt));
  }
  assert.equal(getCheckpoint()?.cleanup.completed, true);
});

test("PAP-441 refuses non-disposable Center before any port mutation", async () => {
  const { port, calls } = fakePort();
  const unsafe = { ...input, disposableCenterConfirmed: false } as unknown as Pap441FixtureInput;
  await assert.rejects(() => preparePap441OpenStudioFixture(port, unsafe), /refuses non-disposable Center mutation/);
  assert.deepEqual(calls, []);
});

test("PAP-441 enforces deterministic disposable contact namespace before any port mutation", async () => {
  const { port, calls } = fakePort();
  const unsafe = { ...input, syntheticIdentity: { ...input.syntheticIdentity, contactValue: "real-family@example.com" } };
  await assert.rejects(() => preparePap441OpenStudioFixture(port, unsafe), /deterministic disposable namespace/);
  assert.deepEqual(calls, []);
});

test("PAP-441 fails closed on authoritative synthetic-contact collision before policy mutation", async () => {
  const { port, calls } = fakePort({ identityDisposition: "COLLISION" });
  await assert.rejects(() => preparePap441OpenStudioFixture(port, input), /synthetic contact collision/);
  assert.equal(calls.filter((call) => call.startsWith("policy:")).length, 0);
  assert.equal(calls.filter((call) => call === "public-acquire").length, 0);
});

test("PAP-441 resumes prepare from durable checkpoint after a partial failure without replaying completed mutations", async () => {
  const { port, calls, getCheckpoint } = fakePort({ failPublicAcquireOnce: true });
  await assert.rejects(() => preparePap441OpenStudioFixture(port, input), /synthetic public acquire failure/);
  assert.equal(calls.filter((call) => call.includes(":active:")).length, 4);
  assert.equal(calls.filter((call) => call === "listing:create").length, 1);
  assert.equal(getCheckpoint()?.listingId, "listing-1");

  const state = await preparePap441OpenStudioFixture(port, input);
  assert.equal(state.registrationId, "registration-1");
  assert.equal(calls.filter((call) => call.includes(":active:")).length, 4);
  assert.equal(calls.filter((call) => call === "listing:create").length, 1);
  assert.equal(calls.filter((call) => call === "public-acquire").length, 2);
});

test("PAP-441 closes rather than cancels a listing when the owner claim is already consumed", async () => {
  const fake = fakePort();
  const state = await preparePap441OpenStudioFixture(fake.port, input);
  fake.setClaimStatus("CONSUMED");
  await cleanupPap441OpenStudioFixture(fake.port, input, state);

  assert.equal(fake.calls.filter((call) => call === "claim:cancel").length, 0);
  assert.ok(fake.calls.includes("listing:close"));
  assert.ok(!fake.calls.includes("listing:cancel"));
  assert.equal(fake.getCheckpoint()?.cleanup.claimTerminal, "CONSUMED");
  assert.equal(fake.getCheckpoint()?.cleanup.listingTerminal, "CLOSED");
});

test("PAP-441 resumes cleanup after neutral-policy failure and converges with full readback", async () => {
  const fake = fakePort({ failNeutralPolicyOnceAt: 2 });
  const state = await preparePap441OpenStudioFixture(fake.port, input);
  await assert.rejects(() => cleanupPap441OpenStudioFixture(fake.port, input, state), /synthetic neutral policy failure/);
  const afterFailure = fake.getCheckpoint();
  assert.equal(afterFailure?.cleanup.revokedPassIds.length, 2);
  assert.equal(afterFailure?.cleanup.listingTerminal, "CANCELLED");
  assert.equal(afterFailure?.cleanup.assignmentsCleared, true);
  assert.equal(Object.keys(afterFailure?.cleanup.neutralPolicies ?? {}).length, 1);

  await cleanupPap441OpenStudioFixture(fake.port, input, state);
  assert.equal(fake.calls.filter((call) => call === "pass:revoke:monthly-1").length, 1);
  assert.equal(fake.calls.filter((call) => call === "pass:revoke:baf-1").length, 1);
  assert.equal(fake.calls.filter((call) => call === "listing:cancel").length, 1);
  assert.equal(fake.calls.filter((call) => call === "assignments:clear").length, 1);
  assert.equal(fake.getCheckpoint()?.cleanup.completed, true);
  assert.equal(fake.calls.filter((call) => call.startsWith("policy-read:")).length, 4);
  assert.equal(fake.calls.filter((call) => call.startsWith("pass:read:")).length, 2);
  assert.ok(fake.calls.includes("assignments:read"));
});


test("PAP-441 cleanup rejects altered fixture provenance before destructive mutation", async () => {
  const fake = fakePort();
  const state = await preparePap441OpenStudioFixture(fake.port, input);
  const before = fake.calls.length;
  await assert.rejects(
    () => cleanupPap441OpenStudioFixture(fake.port, { ...input, disposableCenterId: "center-foreign" }, state),
    /checkpoint provenance mismatch/,
  );
  const cleanupCalls = fake.calls.slice(before);
  assert.deepEqual(cleanupCalls, [`checkpoint:load:${runTag}`]);
});

test("PAP-441 cleanup rejects caller resource IDs that diverge from durable checkpoint", async () => {
  const fake = fakePort();
  const state = await preparePap441OpenStudioFixture(fake.port, input);
  const before = fake.calls.length;
  await assert.rejects(
    () => cleanupPap441OpenStudioFixture(fake.port, input, { ...state, listingId: "listing-foreign" }),
    /cleanup state does not match durable checkpoint/,
  );
  const cleanupCalls = fake.calls.slice(before);
  assert.deepEqual(cleanupCalls, [`checkpoint:load:${runTag}`]);
});

test("PAP-441 cleanup revalidates run-owned synthetic identity before destructive mutation", async () => {
  const fake = fakePort();
  const state = await preparePap441OpenStudioFixture(fake.port, input);
  fake.setIdentityOwnedByRun(false);
  const before = fake.calls.length;
  await assert.rejects(
    () => cleanupPap441OpenStudioFixture(fake.port, input, state),
    /synthetic identity is not owned by run: UNUSED/,
  );
  const cleanupCalls = fake.calls.slice(before);
  assert.deepEqual(cleanupCalls, [`checkpoint:load:${runTag}`, "prerequisites", `identity:${input.syntheticIdentity.contactValue}`]);
});
