import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanupPap441OpenStudioFixture,
  preparePap441OpenStudioFixture,
  type Pap441FixtureInput,
  type Pap441OpenStudioPort,
} from "./pap441-open-studio-fixture";

const input: Pap441FixtureInput = {
  runTag: "pap441-test",
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
    contactValue: "pap441@example.invalid",
  },
};

function fakePort() {
  const calls: string[] = [];
  let claimStatus = "RESERVED";
  const port: Pap441OpenStudioPort = {
    async assertPrerequisites() { calls.push("prerequisites"); },
    async ensureCenterPolicy(key, _centerId, value, _effectiveAt, reason) {
      calls.push(`policy:${key}:${reason.includes("neutral") ? "neutral" : "active"}:${JSON.stringify(value)}`);
    },
    async createPublishedListing() { calls.push("listing"); return { listingId: "listing-1" }; },
    async publicAcquire() { calls.push("public-acquire"); return { registrationId: "registration-1" }; },
    async firstPresent() { calls.push("first-present"); return { studentId: "student-1", houseMembershipId: "membership-1" }; },
    async assignMemberCenter() { calls.push("member-center"); },
    async assignPathCenter() { calls.push("path-center"); },
    async issueMonthlyPathPasses() { calls.push("monthly-pass"); return ["monthly-1"]; },
    async issueBringAFriendPasses() { calls.push("baf-pass"); return ["baf-1"]; },
    async memberExplore() { calls.push("explore"); return { listingIds: ["listing-1"] }; },
    async memberOwnerEligibility() { calls.push("eligibility"); return { eligible: true, reasons: [] }; },
    async reserveOwner() { calls.push("reserve"); return { claimId: "claim-1" }; },
    async cancelClaim() { calls.push("cancel"); claimStatus = "RELEASED"; return { claimStatus }; },
    async readClaim() { calls.push("read-claim"); return { claimStatus }; },
    async revokePass({ passId }) { calls.push(`revoke:${passId}`); },
    async cancelListing() { calls.push("cancel-listing"); },
  };
  return { port, calls };
}

test("PAP-441 prepares replay-safe member fixture and cleans it to neutral disposable Center state", async () => {
  const { port, calls } = fakePort();
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

  await cleanupPap441OpenStudioFixture(port, input, state);

  assert.equal(calls.filter((call) => call === "cancel").length, 2);
  assert.equal(calls.filter((call) => call.includes(":neutral:")).length, 4);
  assert.ok(calls.includes("revoke:monthly-1"));
  assert.ok(calls.includes("revoke:baf-1"));
  assert.ok(calls.includes("cancel-listing"));
  assert.equal(calls.at(-1), "read-claim");
});

test("PAP-441 fails closed when caller cannot truthfully confirm a disposable E2E Center", async () => {
  const { port, calls } = fakePort();
  const unsafe = { ...input, disposableCenterConfirmed: false } as unknown as Pap441FixtureInput;
  await assert.rejects(() => preparePap441OpenStudioFixture(port, unsafe), /refuses non-disposable Center mutation/);
  assert.deepEqual(calls, []);
});
