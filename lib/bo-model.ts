export interface BoCenter {
  id: string;
  key: string;
  displayName: string;
  timeZone: string;
  status: string;
}

export interface BoPathProgram {
  id: string;
  code: string;
  displayName: string;
  status: string;
}

export interface BoRunningClass {
  id: string;
  name: string;
  pathProgramId: string;
  timezone: "Asia/Ho_Chi_Minh";
  recurrenceWeekdays: number[];
  startLocalTime: string;
  endLocalTime: string;
  defaultCapacity: number;
  status: string;
}

export interface BoSyllabus {
  id: string;
  pathProgramId: string;
  curriculumWeek: number;
  title: string;
  shortDescription: string | null;
  skillSummary: string | null;
  ageMin: number | null;
  ageMax: number | null;
  thumbnailUrl: string | null;
  coverUrl: string | null;
  publicationStatus: string;
}

export type BoLearningSyllabusOwnerType = "HOUSE_PATH" | "HOUSE_CURRICULUM" | "TOPPI_PROGRAM";
export interface BoLearningSyllabusOwner { type: BoLearningSyllabusOwnerType; id: string }
export interface BoLearningSyllabus { id:string; owner:BoLearningSyllabusOwner; code:string; lifecycle:"ACTIVE"|"ARCHIVED"; revision:number; createdByUserId:string; createdAt:string; archivedByUserId:string|null; archivedAt:string|null; archiveReason:string|null }
export interface BoLearningSyllabusVersion { id:string; syllabusId:string; versionNumber:number; state:"DRAFT"|"PUBLISHED"; title:string; shortDescription:string|null; publicDescription:string|null; tags:string[]; thumbnailMediaId:string|null; coverMediaId:string|null; sourceType:string|null; sourceRef:string|null; provenance:Record<string,unknown>|null; revision:number; createdByUserId:string; createdAt:string; updatedAt:string; publishedByUserId:string|null; publishedAt:string|null }
export interface BoLearningSyllabusSummary { syllabus:BoLearningSyllabus; currentDraftVersionNumber:number|null; latestPublishedVersionNumber:number|null; latestPublishedTitle:string|null }
export interface BoLearningSyllabusDetail { syllabus:BoLearningSyllabus; versions:BoLearningSyllabusVersion[]; currentDraft:BoLearningSyllabusVersion|null; latestPublished:BoLearningSyllabusVersion|null }
export interface BoLearningSyllabusOwnerCatalog { housePaths:Array<{id:string;code:string;displayName:string;status:string}>; houseCurricula:Array<{id:string;code:string;lifecycle:string}>; toppiPrograms:Array<{id:string;code:string}> }
export interface BoLearningSyllabusDraftInput { title:string; shortDescription?:string|null; publicDescription?:string|null; tags?:string[]; thumbnailMediaId?:string|null; coverMediaId?:string|null; sourceType?:string|null; sourceRef?:string|null; provenance?:Record<string,unknown>|null }

export type BoLearningSyllabusProfileKind = "ARTCHITECT" | "PIANOHOUSE" | "LITTLE_PINER";
export interface BoSyllabusRichContent { type:"doc"; content:Array<Record<string,unknown>> }
export interface BoArtSyllabusProfile { syllabusVersionId:string; richContent:BoSyllabusRichContent; toolTags:string[]; worksheetMediaIds:string[]; revision:number; updatedAt:string }
export interface BoPianoSyllabusProfile { syllabusVersionId:string; practiceResourceId:string; practiceResourceVersionId:string; practicePageId:string; revision:number; updatedAt:string }
export interface BoLittlePinerSyllabusProfile extends BoArtSyllabusProfile { practiceResourceId:string; practiceResourceVersionId:string; practicePageId:string }

export interface BoSession {
  id: string;
  runningClassId: string | null;
  pathProgramId: string | null;
  syllabusId: string | null;
  localDate: string | null;
  startsAt: string;
  endsAt: string;
  bookingOpensAt: string;
  bookingClosesAt: string;
  availability: { capacity: number; remainingSeats: number; isFull: boolean };
  registrationCount: number;
  accessOffers: Array<{ offerType: string }>;
  status: string;
}

export interface BoSessionLearningOwner {
  sessionId: string;
  staffMemberId: string;
  assignedAt: string;
  assignedByUserId: string | null;
  assignmentSource: "OPERATOR" | "MIGRATION";
  changeReason: string | null;
  updatedAt: string;
  version: number;
}

export interface BoSessionLearningOwnerProjection {
  sessionId: string;
  owner: BoSessionLearningOwner | null;
}

export interface BoSessionLearningOwnerCommand {
  staffMemberId: string;
  expectedVersion?: number;
  reason?: string;
}

export interface BoRegistration {
  id: string;
  sessionId: string;
  status: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  childName: string;
  childDateOfBirth: string | null;
  canonicalStudentId: string | null;
  createdAt: string;
}

export interface BoAccessRole {
  id: string;
  roleKey: string;
  displayName: string;
  roleType: "system" | "custom";
  status: "active" | "archived";
  description: string | null;
  permissionCount: number;
  assignmentCount: number;
}

export interface BoAccessAssignment {
  assignmentId: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  scopeType: "GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS";
  scopeId: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export interface BoAccessUser {
  id: string;
  staffMemberId: string | null;
  status: string;
  email: string | null;
  assignments: BoAccessAssignment[];
}

export interface BoStaffRecord {
  id: string;
  displayLabel: string;
  status: "active" | "inactive";
  department: string | null;
  roleLabel: string | null;
}

export interface BoStaffProfile extends BoStaffRecord {
  email: string | null;
  mobile: string | null;
  employmentType: string | null;
  startDate: string | null;
}

export type BoStaffProfilePatch = Partial<Pick<BoStaffProfile, "displayLabel" | "email" | "mobile" | "employmentType" | "department" | "roleLabel" | "startDate">>;

export type BoStaffOnboardingCommand =
  | { commandType: "ONBOARD_STAFF_RECORD_ONLY"; staff: { displayLabel: string; email?: string; mobile?: string; department?: string; roleLabel?: string; employmentType?: string; startDate?: string } }
  | { commandType: "ONBOARD_STAFF_WITH_ACCESS"; staff: { displayLabel: string; email?: string; mobile?: string; department?: string; roleLabel?: string; employmentType?: string; startDate?: string }; email: string; assignments: BoStaffAccessAssignmentInput[] }
  | { commandType: "PROVISION_ACCESS_FOR_STAFF"; staffMemberId: string; email: string; assignments: BoStaffAccessAssignmentInput[] }
  | { commandType: "RESET_STAFF_PIN"; userId: string };

export interface BoStaffAccessAssignmentInput {
  roleId: string;
  scopeType: "GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS";
  scopeId: string | null;
}

export interface BoStaffOnboardingResult {
  commandType: BoStaffOnboardingCommand["commandType"];
  staffMemberId: string;
  userId?: string;
  externalIdentityId?: string;
  assignmentIds: string[];
  accessState: "NOT_PROVISIONED" | "PROVISIONED_AWAITING_LOGIN" | "PIN_RESET_REQUIRED";
  staffPinState?: "ROTATION_REQUIRED" | "ACTIVE";
  initialPin?: string;
}

export interface BoStaffRegistrationRequest {
  id: string;
  status: "PENDING";
  displayLabel: string;
  email: string;
  mobile: string | null;
  governmentIdLast4: string;
  bankAccountLast4: string;
  documents: { front: boolean; back: boolean };
  submittedAt: string;
  version: number;
}

export interface BoStaffRegistrationApprovalResult {
  registrationRequestId: string;
  status: "APPROVED";
  staffMemberId: string;
  userId: string;
  externalIdentityId: string;
  assignmentIds: string[];
  accessState: "PROVISIONED_AWAITING_LOGIN";
  staffPinState: "ROTATION_REQUIRED" | "ACTIVE";
  initialPin?: string;
}

export interface BoContext {
  userId: string;
  email: string;
  staffMemberId: string | null;
  surface: "BO";
  entitled: true;
}

export interface BoLearnerDirectoryItem {
  id: string;
  displayName: string;
  birthYear: number | null;
  birthPrecision: string;
  status: string;
  houseMember: boolean;
  activeSubscriptions: number;
  activePaths: Array<{ id: string; displayName: string }>;
}

export interface BoLearnerSubscription {
  id: string;
  studentProfileId: string;
  pathProgramId: string;
  pathDisplayName: string;
  lifecycle: string;
  serviceStartsOn: string | null;
  weeklyCommitment: number;
  predecessorSubscriptionId: string | null;
  transitionType: string | null;
  commercialReference: string | null;
  completedAt: string | null;
  version: number;
  historicalBalance: number;
  effectiveAvailableUnits: number;
}
export interface BoLearnerEnrollment {
  id: string;
  subscriptionId: string;
  runningClassId: string;
  runningClassName: string;
  effectiveFromLocalDate: string;
  effectiveUntilExclusiveLocalDate: string | null;
  plannedEntryLocalTime: string | null;
  plannedDurationMinutes: number | null;
  predecessorEnrollmentId: string | null;
  transitionType: string | null;
  version: number;
}

export interface BoLearnerLifecycle {
  student: BoLearnerDirectoryItem & { birthMonth: number | null; birthDay: number | null; version: number };
  houseMembership: { id: string; joinedAt: string } | null;
  guardians: Array<{ relationshipId: string; relationshipType: string; parent: { id: string; displayName: string | null; status: string; contacts: Array<{ id: string; type: string; value: string; primary: boolean; verifiedAt: string | null }> } }>;
  subscriptions: Array<{ subscription: BoLearnerSubscription; enrollments: BoLearnerEnrollment[] }>;
}

export type BoCompanionFeedUnavailableReason = "NO_OPEN_VISIT" | "MULTIPLE_OPEN_VISITS" | "NO_FRUIT" | "RITUAL_READY" | "FEED_LIMIT_REACHED" | "LEVEL_UNDEFINED" | "NOT_AUTHORIZED" | null;
export interface BoStudentPinoriaSummary {
  fruitBalance: number;
  waterSigil: { credentialId: string; awardedAt: string } | null;
  operationContext: { visitState: "NONE" | "OPEN" | "AMBIGUOUS"; openVisit: { visitId: string; centerId: string; checkedInAt: string } | null; feedAuthorized: boolean };
  companions: Array<{
    companionId: string; acquiredAt: string; status: string;
    species: { id: string; key: string; displayName: string; companionAssetKey: string; sigilAssetKey: string | null };
    materializationLevel: number; state: string; stageFeedCount: number; readinessRuleKey: string | null; version: number;
    actions: { feed: { available: boolean; reason: BoCompanionFeedUnavailableReason } };
  }>;
}

export interface BoOpenStudioListing {
  id: string;
  sessionId: string;
  syllabusId: string;
  experienceType: "KHAM_PHA" | "CAO_CAP" | "CHUYEN_DE";
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "CANCELLED";
  version: number;
  bookingOpensAt: string | null;
  bookingClosesAt: string | null;
  centerId: string;
  localDate: string;
  scheduledStartsLocal: string;
  scheduledEndsLocal: string;
  pathProgramId: string;
  pathDisplayName: string;
  syllabusTitle: string;
  claimCount: number;
}
export interface BoOpenStudioClaim {
  id: string;
  passId: string;
  listingId: string;
  participantMode: "OWNER" | "SIBLING" | "GUEST";
  status: "RESERVED" | "CONSUMED" | "RELEASED";
  bookingId: string | null;
  registrationId: string | null;
  studentProfileId: string | null;
  studentDisplayName: string | null;
  passClass: "MONTHLY_PATH" | "BRING_A_FRIEND";
  sessionId: string;
  centerId: string;
  localDate: string;
  scheduledStartsLocal: string;
  scheduledEndsLocal: string;
  experienceType: string;
  reservationStatus: string | null;
  participantOutcome: string | null;
  settlementState: string;
}
export interface BoOpenStudioOperations {
  listings: BoOpenStudioListing[];
  claims: BoOpenStudioClaim[];
}
export interface BoOpenStudioListingCatalog {
  sessions: Array<{ id: string; centerId: string; pathProgramId: string; localDate: string; scheduledStartsAt: string; scheduledEndsAt: string; status: string; version: number }>;
  syllabi: Array<{ id: string; pathProgramId: string; title: string; publicationStatus: string; specialtyModuleId: string | null; specialtyConflict: boolean }>;
}

export interface BoOpenStudioPass {
  pass: {
    id: string;
    passClass: "MONTHLY_PATH" | "BRING_A_FRIEND";
    houseMembershipId: string;
    ownerStudentProfileId: string | null;
    pathProgramId: string | null;
    issuanceCenterId: string;
    issuancePeriodKey: string;
    validFrom: string;
    validUntilExclusive: string;
    revokedAt: string | null;
  };
  effectiveNow: boolean;
}

export interface BoWorkforceShiftTemplate {
  id: string;
  centerId: string;
  code: string;
  displayLabel: string;
  startLocalTime: string;
  endLocalTime: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export interface BoWorkforceAvailability {
  id: string;
  staffMemberId: string;
  centerId: string;
  termWeekId: string;
  status: "DRAFT" | "SUBMITTED";
  version: number;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{ workDate: string; shiftTemplateId: string }>;
}

export interface BoWorkforceAssignment {
  id: string;
  staffMemberId: string;
  centerId: string;
  workDate: string;
  shiftTemplateId: string;
  termWeekId: string | null;
  status: "ACTIVE" | "CANCELLED";
  assignedByUserId: string;
  assignedAt: string;
  cancelledByUserId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  replacesAssignmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoWorkforceWeeklyPlanning {
  centerId: string;
  termWeekId: string;
  startDate: string;
  endDate: string;
  staff: Array<{ id: string; displayLabel: string }>;
  templates: BoWorkforceShiftTemplate[];
  availability: BoWorkforceAvailability[];
  assignments: BoWorkforceAssignment[];
}
