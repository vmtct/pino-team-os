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
    contactType: "PHONE" | "EMAIL";
    contactValue: string;
  };
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

export interface Pap441OpenStudioPort {
  assertPrerequisites(input: Pick<Pap441FixtureInput, "sessionId" | "syllabusId" | "pathProgramId" | "disposableCenterId">): Promise<void>;
  ensureCenterPolicy(key: OpenStudioPolicyKey, centerId: string, value: OpenStudioPolicyValue, effectiveAt: string, reason: string): Promise<void>;
  createPublishedListing(input: { sessionId: string; syllabusId: string; experienceType: "KHAM_PHA"; effectiveAt: string; runTag: string }): Promise<{ listingId: string }>;
  publicAcquire(input: Pap441FixtureInput["syntheticIdentity"] & { listingId: string; idempotencyKey: string }): Promise<{ registrationId: string }>;
  firstPresent(input: { registrationId: string; recordedAt: string; idempotencyKey: string }): Promise<{ studentId: string; houseMembershipId: string }>;
  assignMemberCenter(input: { houseMembershipId: string; centerId: string; effectiveFrom: string; runTag: string }): Promise<void>;
  assignPathCenter(input: { houseMembershipId: string; pathProgramId: string; centerId: string; effectiveFrom: string; runTag: string }): Promise<void>;
  issueMonthlyPathPasses(input: { houseMembershipId: string; pathProgramId: string; effectiveAt: string; runTag: string }): Promise<string[]>;
  issueBringAFriendPasses(input: { houseMembershipId: string; effectiveAt: string; runTag: string }): Promise<string[]>;
  memberExplore(input: { studentId: string; effectiveAt: string }): Promise<{ listingIds: string[] }>;
  memberOwnerEligibility(input: { studentId: string; passId: string; listingId: string; effectiveAt: string }): Promise<{ eligible: boolean; reasons: string[] }>;
  reserveOwner(input: { studentId: string; passId: string; listingId: string; idempotencyKey: string }): Promise<{ claimId: string }>;
  cancelClaim(input: { studentId: string; claimId: string; reason: string; idempotencyKey: string }): Promise<{ claimStatus: string }>;
  readClaim(input: { claimId: string }): Promise<{ claimStatus: string }>;
  revokePass(input: { passId: string; revokedAt: string; reason: string }): Promise<void>;
  cancelListing(input: { listingId: string; reason: string }): Promise<void>;
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

export async function preparePap441OpenStudioFixture(port: Pap441OpenStudioPort, input: Pap441FixtureInput): Promise<Pap441FixtureState> {
  if (input.disposableCenterConfirmed !== true) throw new Error("PAP-441 refuses non-disposable Center mutation");
  await port.assertPrerequisites(input);
  for (const [key, value] of ACTIVE_POLICIES) {
    await port.ensureCenterPolicy(key, input.disposableCenterId, value, input.effectiveAt, `${input.runTag}: active E2E override`);
  }
  const { listingId } = await port.createPublishedListing({ sessionId: input.sessionId, syllabusId: input.syllabusId, experienceType: "KHAM_PHA", effectiveAt: input.effectiveAt, runTag: input.runTag });
  const { registrationId } = await port.publicAcquire({ ...input.syntheticIdentity, listingId, idempotencyKey: `${input.runTag}:public-acquire` });
  const promoted = await port.firstPresent({ registrationId, recordedAt: input.effectiveAt, idempotencyKey: `${input.runTag}:first-present` });
  await port.assignMemberCenter({ houseMembershipId: promoted.houseMembershipId, centerId: input.disposableCenterId, effectiveFrom: input.effectiveAt, runTag: input.runTag });
  await port.assignPathCenter({ houseMembershipId: promoted.houseMembershipId, pathProgramId: input.pathProgramId, centerId: input.disposableCenterId, effectiveFrom: input.effectiveAt, runTag: input.runTag });
  const monthlyPassIds = await port.issueMonthlyPathPasses({ houseMembershipId: promoted.houseMembershipId, pathProgramId: input.pathProgramId, effectiveAt: input.effectiveAt, runTag: input.runTag });
  const bringAFriendPassIds = await port.issueBringAFriendPasses({ houseMembershipId: promoted.houseMembershipId, effectiveAt: input.effectiveAt, runTag: input.runTag });
  const ownerPassId = monthlyPassIds[0];
  if (!ownerPassId) throw new Error("PAP-441 monthly-path pass issuance returned no pass");
  const explore = await port.memberExplore({ studentId: promoted.studentId, effectiveAt: input.effectiveAt });
  if (!explore.listingIds.includes(listingId)) throw new Error("PAP-441 listing missing from member Explore");
  const eligibility = await port.memberOwnerEligibility({ studentId: promoted.studentId, passId: ownerPassId, listingId, effectiveAt: input.effectiveAt });
  if (!eligibility.eligible) throw new Error(`PAP-441 owner eligibility failed: ${eligibility.reasons.join(", ")}`);
  const first = await port.reserveOwner({ studentId: promoted.studentId, passId: ownerPassId, listingId, idempotencyKey: `${input.runTag}:owner-reserve` });
  const replay = await port.reserveOwner({ studentId: promoted.studentId, passId: ownerPassId, listingId, idempotencyKey: `${input.runTag}:owner-reserve` });
  if (first.claimId !== replay.claimId) throw new Error("PAP-441 owner reserve replay diverged");
  return { registrationId, studentId: promoted.studentId, houseMembershipId: promoted.houseMembershipId, listingId, monthlyPassIds, bringAFriendPassIds, ownerClaimId: first.claimId };
}

export async function cleanupPap441OpenStudioFixture(port: Pap441OpenStudioPort, input: Pap441FixtureInput, state: Pap441FixtureState): Promise<void> {
  const cancelled = await port.cancelClaim({ studentId: state.studentId, claimId: state.ownerClaimId, reason: `${input.runTag}: cleanup`, idempotencyKey: `${input.runTag}:owner-cancel` });
  const replay = await port.cancelClaim({ studentId: state.studentId, claimId: state.ownerClaimId, reason: `${input.runTag}: cleanup`, idempotencyKey: `${input.runTag}:owner-cancel` });
  if (cancelled.claimStatus !== replay.claimStatus) throw new Error("PAP-441 cancel replay diverged");
  for (const passId of [...state.monthlyPassIds, ...state.bringAFriendPassIds]) await port.revokePass({ passId, revokedAt: input.effectiveAt, reason: `${input.runTag}: cleanup` });
  await port.cancelListing({ listingId: state.listingId, reason: `${input.runTag}: cleanup` });
  for (const [key, value] of NEUTRAL_POLICIES) {
    await port.ensureCenterPolicy(key, input.disposableCenterId, value, input.effectiveAt, `${input.runTag}: neutral E2E cleanup`);
  }
  const claim = await port.readClaim({ claimId: state.ownerClaimId });
  if (claim.claimStatus === "RESERVED") throw new Error("PAP-441 cleanup left a RESERVED claim");
}
