export type OpenStudioPolicyKey =
  | "monthly_path_pass.v1"
  | "bring_a_friend.v1"
  | "public_acquisition.v1"
  | "cancellation.v1";

export type OpenStudioPolicyValue =
  | { quantityPerPath: number; periodKind: "CALENDAR_MONTH"; carryForwardPeriods: number; allowedParticipantModes: Array<"OWNER" | "SIBLING">; allowedExperienceTypes: Array<"KHAM_PHA" | "CAO_CAP" | "CHUYEN_DE"> }
  | { enabled: boolean; allowedExperienceTypes: Array<"KHAM_PHA" | "CAO_CAP" | "CHUYEN_DE">; cadence: "MONTHLY"; quantityPerPeriod: number; validityMode: "CALENDAR_PERIOD"; carryUnused: false }
  | { enabled: boolean; allowedExperienceTypes: Array<"KHAM_PHA" | "CAO_CAP" | "CHUYEN_DE">; maxActiveRegistrationsPerContact: number; maxActiveRegistrationsPerSession: number; activeWindowDays: number }
  | { passReleaseCutoffMinutesBeforeStart: number };

export interface Pap441FixtureInput {
  runTag: string;
  disposableCenterId: string;
  disposableCenterConfirmed: true;
  sessionId: string;
  syllabusId: string;
  pathProgramId: string;
  effectiveAt: string;
  syntheticIdentity: {
    displayName: string;
    birthYear: number;
    birthMonth: number;
    contactType: "EMAIL";
    contactValue: string;
  };
}

export function pap441SyntheticEmail(runTag: string): string {
  const token = Array.from(runTag).map((value) => (value.codePointAt(0) ?? 0).toString(16).padStart(6, "0")).join("");
  return `pap441+${token}@e2e.invalid`;
}

export interface Pap441FixtureState {
  registrationId: string;
  studentId: string;
  houseMembershipId: string;
  listingId: string;
  monthlyPassIds: string[];
  bringAFriendPassIds: string[];
  ownerClaimId: string;
}

type PolicyTimes = Partial<Record<OpenStudioPolicyKey, string>>;

export interface Pap441FixtureProvenance {
  disposableCenterId: string;
  sessionId: string;
  syllabusId: string;
  pathProgramId: string;
  effectiveAt: string;
  syntheticIdentity: Pap441FixtureInput["syntheticIdentity"];
}

export interface Pap441FixtureCheckpoint extends Partial<Pap441FixtureState> {
  runTag: string;
  provenance: Pap441FixtureProvenance;
  activePolicies: PolicyTimes;
  memberCenterAssigned?: boolean;
  pathCenterAssigned?: boolean;
  cleanup: {
    claimTerminal?: "RELEASED" | "CONSUMED";
    revokedPassIds: string[];
    listingTerminal?: "CLOSED" | "CANCELLED";
    assignmentsCleared?: boolean;
    neutralPolicyEffectiveAt: PolicyTimes;
    neutralPolicies: PolicyTimes;
    completed?: boolean;
  };
}

export interface Pap441OpenStudioPort {
  loadCheckpoint(runTag: string): Promise<Pap441FixtureCheckpoint | null>;
  saveCheckpoint(checkpoint: Pap441FixtureCheckpoint): Promise<void>;
  assertPrerequisites(input: Pick<Pap441FixtureInput, "sessionId" | "syllabusId" | "pathProgramId" | "disposableCenterId">): Promise<void>;
  assertSyntheticIdentityAvailable(input: Pap441FixtureInput["syntheticIdentity"] & { runTag: string }): Promise<{ disposition: "UNUSED" | "OWNED_BY_RUN" | "COLLISION"; normalizedContact: string }>;
  ensureCenterPolicy(key: OpenStudioPolicyKey, centerId: string, value: OpenStudioPolicyValue, effectiveAt: string, reason: string): Promise<{ effectiveFrom: string }>;
  nextCenterPolicyEffectiveAt(key: OpenStudioPolicyKey, centerId: string, strictlyAfter: string): Promise<string>;
  readCenterPolicy(key: OpenStudioPolicyKey, centerId: string, effectiveAt: string, expectedValue: OpenStudioPolicyValue): Promise<{ effectiveFrom: string; matchesExpected: boolean }>;
  createPublishedListing(input: { sessionId: string; syllabusId: string; experienceType: "KHAM_PHA"; effectiveAt: string; runTag: string }): Promise<{ listingId: string }>;
  publicAcquire(input: Pap441FixtureInput["syntheticIdentity"] & { listingId: string; idempotencyKey: string }): Promise<{ registrationId: string }>;
  firstPresent(input: { registrationId: string; recordedAt: string; idempotencyKey: string }): Promise<{ studentId: string; houseMembershipId: string }>;
  assignMemberCenter(input: { houseMembershipId: string; centerId: string; effectiveFrom: string; runTag: string }): Promise<void>;
  assignPathCenter(input: { houseMembershipId: string; pathProgramId: string; centerId: string; effectiveFrom: string; runTag: string }): Promise<void>;
  clearFixtureAssignments(input: { houseMembershipId: string; pathProgramId: string; centerId: string; effectiveAt: string; runTag: string }): Promise<void>;
  readFixtureAssignments(input: { houseMembershipId: string; pathProgramId: string; centerId: string; effectiveAt: string }): Promise<{ memberCenterActive: boolean; pathCenterActive: boolean }>;
  issueMonthlyPathPasses(input: { houseMembershipId: string; pathProgramId: string; effectiveAt: string; runTag: string }): Promise<string[]>;
  issueBringAFriendPasses(input: { houseMembershipId: string; effectiveAt: string; runTag: string }): Promise<string[]>;
  memberExplore(input: { studentId: string; effectiveAt: string }): Promise<{ listingIds: string[] }>;
  memberOwnerEligibility(input: { studentId: string; passId: string; listingId: string; effectiveAt: string }): Promise<{ eligible: boolean; reasons: string[] }>;
  reserveOwner(input: { studentId: string; passId: string; listingId: string; idempotencyKey: string }): Promise<{ claimId: string }>;
  cancelClaim(input: { studentId: string; claimId: string; reason: string; idempotencyKey: string }): Promise<{ claimStatus: "RESERVED" | "RELEASED" | "CONSUMED" }>;
  readClaim(input: { claimId: string }): Promise<{ claimStatus: "RESERVED" | "RELEASED" | "CONSUMED" }>;
  revokePass(input: { passId: string; revokedAt: string; reason: string }): Promise<void>;
  readPass(input: { passId: string }): Promise<{ revoked: boolean }>;
  cancelListing(input: { listingId: string; reason: string; idempotencyKey: string }): Promise<void>;
  closeListing(input: { listingId: string; reason: string; idempotencyKey: string }): Promise<void>;
  readListing(input: { listingId: string }): Promise<{ status: "DRAFT" | "PUBLISHED" | "CLOSED" | "CANCELLED" }>;
}

const ACTIVE_POLICIES: ReadonlyArray<[OpenStudioPolicyKey, OpenStudioPolicyValue]> = [
  ["monthly_path_pass.v1", { quantityPerPath: 1, periodKind: "CALENDAR_MONTH", carryForwardPeriods: 0, allowedParticipantModes: ["OWNER"], allowedExperienceTypes: ["KHAM_PHA"] }],
  ["bring_a_friend.v1", { enabled: true, allowedExperienceTypes: ["KHAM_PHA"], cadence: "MONTHLY", quantityPerPeriod: 1, validityMode: "CALENDAR_PERIOD", carryUnused: false }],
  ["public_acquisition.v1", { enabled: true, allowedExperienceTypes: ["KHAM_PHA"], maxActiveRegistrationsPerContact: 4, maxActiveRegistrationsPerSession: 40, activeWindowDays: 30 }],
  ["cancellation.v1", { passReleaseCutoffMinutesBeforeStart: 0 }],
];

const NEUTRAL_POLICIES: ReadonlyArray<[OpenStudioPolicyKey, OpenStudioPolicyValue]> = [
  ["monthly_path_pass.v1", { quantityPerPath: 0, periodKind: "CALENDAR_MONTH", carryForwardPeriods: 0, allowedParticipantModes: ["OWNER"], allowedExperienceTypes: ["KHAM_PHA"] }],
  ["bring_a_friend.v1", { enabled: false, allowedExperienceTypes: ["KHAM_PHA"], cadence: "MONTHLY", quantityPerPeriod: 0, validityMode: "CALENDAR_PERIOD", carryUnused: false }],
  ["public_acquisition.v1", { enabled: false, allowedExperienceTypes: ["KHAM_PHA"], maxActiveRegistrationsPerContact: 1, maxActiveRegistrationsPerSession: 1, activeWindowDays: 1 }],
  ["cancellation.v1", { passReleaseCutoffMinutesBeforeStart: 10080 }],
];

function fixtureProvenance(input: Pap441FixtureInput): Pap441FixtureProvenance {
  return {
    disposableCenterId: input.disposableCenterId,
    sessionId: input.sessionId,
    syllabusId: input.syllabusId,
    pathProgramId: input.pathProgramId,
    effectiveAt: input.effectiveAt,
    syntheticIdentity: {
      ...input.syntheticIdentity,
      contactValue: input.syntheticIdentity.contactValue.trim().toLowerCase(),
    },
  };
}

function freshCheckpoint(input: Pap441FixtureInput): Pap441FixtureCheckpoint {
  return {
    runTag: input.runTag,
    provenance: fixtureProvenance(input),
    activePolicies: {},
    cleanup: { revokedPassIds: [], neutralPolicyEffectiveAt: {}, neutralPolicies: {} },
  };
}

function assertCheckpointProvenance(checkpoint: Pap441FixtureCheckpoint, input: Pap441FixtureInput): void {
  if (checkpoint.runTag !== input.runTag) throw new Error("PAP-441 checkpoint runTag mismatch");
  const expected = fixtureProvenance(input);
  if (JSON.stringify(checkpoint.provenance) !== JSON.stringify(expected)) {
    throw new Error("PAP-441 checkpoint provenance mismatch");
  }
}

function assertCheckpointState(checkpoint: Pap441FixtureCheckpoint, state: Pap441FixtureState): void {
  const durable = finalState(checkpoint);
  if (JSON.stringify(durable) !== JSON.stringify(state)) {
    throw new Error("PAP-441 cleanup state does not match durable checkpoint");
  }
}

async function save(port: Pap441OpenStudioPort, checkpoint: Pap441FixtureCheckpoint): Promise<void> {
  await port.saveCheckpoint(checkpoint);
}

function finalState(checkpoint: Pap441FixtureCheckpoint): Pap441FixtureState {
  const { registrationId, studentId, houseMembershipId, listingId, monthlyPassIds, bringAFriendPassIds, ownerClaimId } = checkpoint;
  if (!registrationId || !studentId || !houseMembershipId || !listingId || !monthlyPassIds || !bringAFriendPassIds || !ownerClaimId) {
    throw new Error("PAP-441 checkpoint is incomplete");
  }
  return { registrationId, studentId, houseMembershipId, listingId, monthlyPassIds, bringAFriendPassIds, ownerClaimId };
}

export async function preparePap441OpenStudioFixture(port: Pap441OpenStudioPort, input: Pap441FixtureInput): Promise<Pap441FixtureState> {
  if (input.disposableCenterConfirmed !== true) throw new Error("PAP-441 refuses non-disposable Center mutation");
  const expectedSyntheticContact = pap441SyntheticEmail(input.runTag);
  if (input.syntheticIdentity.contactValue.toLowerCase() !== expectedSyntheticContact) {
    throw new Error("PAP-441 synthetic contact must use the deterministic disposable namespace");
  }
  const loaded = await port.loadCheckpoint(input.runTag);
  const checkpoint = loaded ?? freshCheckpoint(input);
  assertCheckpointProvenance(checkpoint, input);
  await port.assertPrerequisites(input);
  const identity = await port.assertSyntheticIdentityAvailable({ ...input.syntheticIdentity, runTag: input.runTag });
  if (identity.disposition === "COLLISION") throw new Error(`PAP-441 synthetic contact collision: ${identity.normalizedContact}`);
  if (!loaded) await save(port, checkpoint);

  for (const [key, value] of ACTIVE_POLICIES) {
    if (checkpoint.activePolicies[key]) continue;
    const applied = await port.ensureCenterPolicy(key, input.disposableCenterId, value, input.effectiveAt, `${input.runTag}: active E2E override`);
    checkpoint.activePolicies[key] = applied.effectiveFrom;
    await save(port, checkpoint);
  }
  if (!checkpoint.listingId) {
    checkpoint.listingId = (await port.createPublishedListing({ sessionId: input.sessionId, syllabusId: input.syllabusId, experienceType: "KHAM_PHA", effectiveAt: input.effectiveAt, runTag: input.runTag })).listingId;
    await save(port, checkpoint);
  }
  if (!checkpoint.registrationId) {
    checkpoint.registrationId = (await port.publicAcquire({ ...input.syntheticIdentity, listingId: checkpoint.listingId, idempotencyKey: `${input.runTag}:public-acquire` })).registrationId;
    await save(port, checkpoint);
  }
  if (!checkpoint.studentId || !checkpoint.houseMembershipId) {
    const promoted = await port.firstPresent({ registrationId: checkpoint.registrationId, recordedAt: input.effectiveAt, idempotencyKey: `${input.runTag}:first-present` });
    checkpoint.studentId = promoted.studentId;
    checkpoint.houseMembershipId = promoted.houseMembershipId;
    await save(port, checkpoint);
  }
  if (!checkpoint.memberCenterAssigned) {
    await port.assignMemberCenter({ houseMembershipId: checkpoint.houseMembershipId, centerId: input.disposableCenterId, effectiveFrom: input.effectiveAt, runTag: input.runTag });
    checkpoint.memberCenterAssigned = true;
    await save(port, checkpoint);
  }
  if (!checkpoint.pathCenterAssigned) {
    await port.assignPathCenter({ houseMembershipId: checkpoint.houseMembershipId, pathProgramId: input.pathProgramId, centerId: input.disposableCenterId, effectiveFrom: input.effectiveAt, runTag: input.runTag });
    checkpoint.pathCenterAssigned = true;
    await save(port, checkpoint);
  }
  if (!checkpoint.monthlyPassIds) {
    checkpoint.monthlyPassIds = await port.issueMonthlyPathPasses({ houseMembershipId: checkpoint.houseMembershipId, pathProgramId: input.pathProgramId, effectiveAt: input.effectiveAt, runTag: input.runTag });
    await save(port, checkpoint);
  }
  if (!checkpoint.bringAFriendPassIds) {
    checkpoint.bringAFriendPassIds = await port.issueBringAFriendPasses({ houseMembershipId: checkpoint.houseMembershipId, effectiveAt: input.effectiveAt, runTag: input.runTag });
    await save(port, checkpoint);
  }
  const ownerPassId = checkpoint.monthlyPassIds[0];
  if (!ownerPassId) throw new Error("PAP-441 monthly-path pass issuance returned no pass");
  const explore = await port.memberExplore({ studentId: checkpoint.studentId, effectiveAt: input.effectiveAt });
  if (!explore.listingIds.includes(checkpoint.listingId)) throw new Error("PAP-441 listing missing from member Explore");
  const eligibility = await port.memberOwnerEligibility({ studentId: checkpoint.studentId, passId: ownerPassId, listingId: checkpoint.listingId, effectiveAt: input.effectiveAt });
  if (!eligibility.eligible) throw new Error(`PAP-441 owner eligibility failed: ${eligibility.reasons.join(", ")}`);
  if (!checkpoint.ownerClaimId) {
    const first = await port.reserveOwner({ studentId: checkpoint.studentId, passId: ownerPassId, listingId: checkpoint.listingId, idempotencyKey: `${input.runTag}:owner-reserve` });
    const replay = await port.reserveOwner({ studentId: checkpoint.studentId, passId: ownerPassId, listingId: checkpoint.listingId, idempotencyKey: `${input.runTag}:owner-reserve` });
    if (first.claimId !== replay.claimId) throw new Error("PAP-441 owner reserve replay diverged");
    checkpoint.ownerClaimId = first.claimId;
    await save(port, checkpoint);
  }
  return finalState(checkpoint);
}

export async function cleanupPap441OpenStudioFixture(port: Pap441OpenStudioPort, input: Pap441FixtureInput, state: Pap441FixtureState): Promise<void> {
  if (input.disposableCenterConfirmed !== true) throw new Error("PAP-441 refuses non-disposable Center cleanup");
  const expectedSyntheticContact = pap441SyntheticEmail(input.runTag);
  if (input.syntheticIdentity.contactValue.trim().toLowerCase() !== expectedSyntheticContact) {
    throw new Error("PAP-441 cleanup synthetic contact must use the deterministic disposable namespace");
  }

  const checkpoint = await port.loadCheckpoint(input.runTag);
  if (!checkpoint) throw new Error("PAP-441 cleanup requires a durable checkpoint");
  assertCheckpointProvenance(checkpoint, input);
  assertCheckpointState(checkpoint, state);
  if (checkpoint.cleanup.completed) return;

  await port.assertPrerequisites(input);
  const identity = await port.assertSyntheticIdentityAvailable({ ...checkpoint.provenance.syntheticIdentity, runTag: checkpoint.runTag });
  if (identity.disposition !== "OWNED_BY_RUN") {
    throw new Error(`PAP-441 cleanup synthetic identity is not owned by run: ${identity.disposition}`);
  }

  const durable = finalState(checkpoint);
  const { disposableCenterId, pathProgramId, effectiveAt } = checkpoint.provenance;

  let claim = await port.readClaim({ claimId: durable.ownerClaimId });
  if (claim.claimStatus === "RESERVED") {
    const cancelled = await port.cancelClaim({ studentId: durable.studentId, claimId: durable.ownerClaimId, reason: `${checkpoint.runTag}: cleanup`, idempotencyKey: `${checkpoint.runTag}:owner-cancel` });
    const replay = await port.cancelClaim({ studentId: durable.studentId, claimId: durable.ownerClaimId, reason: `${checkpoint.runTag}: cleanup`, idempotencyKey: `${checkpoint.runTag}:owner-cancel` });
    if (cancelled.claimStatus !== replay.claimStatus || replay.claimStatus === "RESERVED") throw new Error("PAP-441 cancel replay diverged");
    claim = replay;
  }
  checkpoint.cleanup.claimTerminal = claim.claimStatus === "CONSUMED" ? "CONSUMED" : "RELEASED";
  await save(port, checkpoint);

  for (const passId of [...durable.monthlyPassIds, ...durable.bringAFriendPassIds]) {
    if (checkpoint.cleanup.revokedPassIds.includes(passId)) continue;
    await port.revokePass({ passId, revokedAt: effectiveAt, reason: `${checkpoint.runTag}: cleanup` });
    checkpoint.cleanup.revokedPassIds.push(passId);
    await save(port, checkpoint);
  }

  if (!checkpoint.cleanup.listingTerminal) {
    const listing = await port.readListing({ listingId: durable.listingId });
    if (listing.status === "CLOSED" || listing.status === "CANCELLED") checkpoint.cleanup.listingTerminal = listing.status;
    else if (checkpoint.cleanup.claimTerminal === "CONSUMED") {
      await port.closeListing({ listingId: durable.listingId, reason: `${checkpoint.runTag}: consumed-claim cleanup`, idempotencyKey: `${checkpoint.runTag}:listing-close` });
      checkpoint.cleanup.listingTerminal = "CLOSED";
    } else {
      await port.cancelListing({ listingId: durable.listingId, reason: `${checkpoint.runTag}: cleanup`, idempotencyKey: `${checkpoint.runTag}:listing-cancel` });
      checkpoint.cleanup.listingTerminal = "CANCELLED";
    }
    await save(port, checkpoint);
  }

  if (!checkpoint.cleanup.assignmentsCleared) {
    await port.clearFixtureAssignments({ houseMembershipId: durable.houseMembershipId, pathProgramId, centerId: disposableCenterId, effectiveAt, runTag: checkpoint.runTag });
    checkpoint.cleanup.assignmentsCleared = true;
    await save(port, checkpoint);
  }

  for (const [key, value] of NEUTRAL_POLICIES) {
    if (checkpoint.cleanup.neutralPolicies[key]) continue;
    const activeAt = checkpoint.activePolicies[key] ?? effectiveAt;
    let cleanupAt = checkpoint.cleanup.neutralPolicyEffectiveAt[key];
    if (!cleanupAt) {
      cleanupAt = await port.nextCenterPolicyEffectiveAt(key, disposableCenterId, activeAt);
      if (Date.parse(cleanupAt) <= Date.parse(activeAt)) throw new Error(`PAP-441 cleanup policy time is not strictly later for ${key}`);
      checkpoint.cleanup.neutralPolicyEffectiveAt[key] = cleanupAt;
      await save(port, checkpoint);
    }
    const applied = await port.ensureCenterPolicy(key, disposableCenterId, value, cleanupAt, `${checkpoint.runTag}: neutral E2E cleanup`);
    checkpoint.cleanup.neutralPolicies[key] = applied.effectiveFrom;
    await save(port, checkpoint);
  }

  const finalClaim = await port.readClaim({ claimId: durable.ownerClaimId });
  if (finalClaim.claimStatus === "RESERVED") throw new Error("PAP-441 cleanup left a RESERVED claim");
  const finalListing = await port.readListing({ listingId: durable.listingId });
  if (finalListing.status !== "CLOSED" && finalListing.status !== "CANCELLED") throw new Error("PAP-441 cleanup left a non-terminal listing");
  for (const passId of [...durable.monthlyPassIds, ...durable.bringAFriendPassIds]) {
    if (!(await port.readPass({ passId })).revoked) throw new Error(`PAP-441 cleanup left pass active: ${passId}`);
  }
  const assignments = await port.readFixtureAssignments({ houseMembershipId: durable.houseMembershipId, pathProgramId, centerId: disposableCenterId, effectiveAt });
  if (assignments.memberCenterActive || assignments.pathCenterActive) throw new Error("PAP-441 cleanup left Center assignment authority active");
  for (const [key, value] of NEUTRAL_POLICIES) {
    const cleanupAt = checkpoint.cleanup.neutralPolicyEffectiveAt[key];
    if (!cleanupAt) throw new Error(`PAP-441 cleanup missing neutral policy checkpoint: ${key}`);
    const policy = await port.readCenterPolicy(key, disposableCenterId, cleanupAt, value);
    if (!policy.matchesExpected || policy.effectiveFrom !== cleanupAt) throw new Error(`PAP-441 cleanup policy readback failed: ${key}`);
  }
  checkpoint.cleanup.completed = true;
  await save(port, checkpoint);
}
