import type {
  BoAccessRole,
  BoCenter,
  BoCalendarExclusion,
  BoCalendarExclusionImpact,
  BoCalendarExclusionPublishResult,
  BoCalendarExclusionReason,
  BoPathProgram,
  BoRegistration,
  BoSessionLearningOwner,
  BoSessionLearningOwnerCommand,
  BoSessionLearningOwnerProjection,
  BoSessionSyllabusBindingCommand,
  BoSessionSyllabusBindingProjection,
  BoSessionSyllabusBindingResult,
  BoLearnerDirectoryItem,
  BoLearnerEnrollment,
  BoLearnerLifecycle,
  BoLearnerSubscription,
  BoStudentIntakeVoidResult,
  BoSubscriptionProjectedCompletion,
  BoBillSummary,
  BoPaymentMethod,
  BoPaymentTransaction,
  BoPaymentTransactionKind,
  BoProductPlan,
  BoProductPlanBadge,
  BoSaleResult,
  BoStudentPinoriaSummary,
  BoLearningSyllabus,
  BoLearningSyllabusDetail,
  BoLearningSyllabusDraftInput,
  BoLearningSyllabusOwner,
  BoLearningSyllabusOwnerCatalog,
  BoLearningSyllabusSummary,
  BoLearningSyllabusVersion,
  BoArtSyllabusProfile,
  BoPianoSyllabusProfile,
  BoLittlePinerSyllabusProfile,
  BoSyllabusRichContent,
  BoSyllabusWorksheetMedia,
  BoOpenStudioOperations,
  BoOpenStudioListingCatalog,
  BoOpenStudioPass,
  BoRunningClass,
  BoSession,
  BoStaffOnboardingCommand,
  BoStaffAccessAssignmentInput,
  BoStaffOnboardingResult,
  BoStaffRegistrationApprovalResult,
  BoStaffRegistrationRequest,
  BoStaffProfile,
  BoStaffPinoriaProjection,
  BoStaffProfilePatch,
  BoStaffRecord,
  BoSyllabus,
  BoWorkforceAssignment,
  BoWorkforcePlanningBootstrap,
  BoWorkforceShiftTemplate,
  BoWorkforceWeeklyPlanning,
  BoUnscheduledCheckInRequest,
  BoTimekeepingPage,
  BoTimekeepingCorrectionResult,
  BoTimekeepingMissedCheckoutResult,
} from "./bo-model";
import type { BoAccessAuditEvent, BoAccessPermission, BoAccessRoleDetail, BoAccessSystemUser } from "./bo-access-model";
import type { BoDutyExceptionReview, BoDutyExceptionRecord } from "./bo-workforce-duty-exception";
import type { BoPracticeAuthoringContext, BoPracticeCreateCommand, BoPracticeRepertoireAccessContext, BoPracticeRepertoireAccessProjection, BoPracticeRepertoireGrantCommand, BoPracticeRepertoireAccessGrant, BoPracticeResourceDetail, BoPracticeResourceVersion } from "./bo-practice-model";
import type { StaffQualification, TrainingAssignmentDetail, TrainingDraftInput, TrainingModule, TrainingModuleVersion } from "./training-model";
import { BoApiError } from "./bo-api-error";
import { recoverInvalidStaffPasswordSession } from "./staff-session-recovery";
import { uploadPracticeMedia } from "./bo-practice-media-client";
import { syllabusWorksheetPreviewUrl, uploadSyllabusWorksheetMedia } from "./bo-syllabus-media-client";
export { BoApiError } from "./bo-api-error";

export type OpenStudioPolicyKey = "monthly_path_pass.v1" | "bring_a_friend.v1" | "public_acquisition.v1" | "cancellation.v1";
export type OpenStudioPolicyTarget = { targetType: "GLOBAL"; targetId: null } | { targetType: "CENTER"; targetId: string };
export type OpenStudioResolvedPolicy<T> = { streamId: string; versionId: string; version: number; effectiveFrom: string; effectiveUntil: string | null; value: T };
export type OpenStudioPolicyInspection<T> = { stream: { id: string; revision: number; targetType: "GLOBAL" | "CENTER"; targetId: string | null }; versions: Array<{ id: string; version: number; storedState: "DRAFT" | "PUBLISHED"; effectiveFrom: string | null; effectiveUntil: string | null; value: T; changeReason: string }> };
export type OpenStudioPolicyDraft = { streamId: string; versionId: string; version: number; revision: number };
export type BoAcquisitionIntentStatus = "SUBMITTED" | "CONTACTED" | "CONTACT_VERIFIED" | "CLOSED";
export type BoAcquisitionIntent = {
  id: string;
  leadId: string;
  phone: string;
  sourceBrand: "PINO_HOUSE" | "TOPPI";
  sourceSurface: "PINO_HOUSE_WEB" | "TOPPI_WEB" | "STAFF";
  intentKind: "OPEN_STUDIO" | "PROGRAM_INTEREST" | "GENERAL_INQUIRY";
  childAge: number | null;
  provenance: Record<string, unknown>;
  status: BoAcquisitionIntentStatus;
  verificationMethod: string | null;
  contactedAt: string | null;
  verifiedAt: string | null;
  closedAt: string | null;
  closeReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

async function read<T>(path: string): Promise<T[]> {
  const response = await fetch(`/api/bo/${path}`, { cache: "no-store" });
  const body = await response.json() as { data?: T[]; error?: { message?: string; requestId?: string } };
  if (!response.ok || !body.data) throw apiError(response, body, "Back Office data could not be loaded.");
  return body.data;
}

async function readAllPages<T>(pathForCursor: (cursor: string | null) => string): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (;;) {
    if (cursor) {
      if (seen.has(cursor)) throw new BoApiError(502, "Back Office pagination cursor repeated.", null);
      seen.add(cursor);
    }
    const response = await fetch(`/api/bo/${pathForCursor(cursor)}`, { cache: "no-store" });
    const body = await response.json() as {
      data?: T[];
      page?: { nextCursor?: string | null };
      error?: { message?: string; requestId?: string };
    };
    if (!response.ok || !body.data) throw apiError(response, body, "Back Office paged data could not be loaded.");
    items.push(...body.data);
    const nextCursor = body.page?.nextCursor ?? null;
    if (!nextCursor) return items;
    cursor = nextCursor;
  }
}

async function readOne<T>(path: string): Promise<T> {
  const response = await fetch(`/api/bo/${path}`, { cache: "no-store" });
  const body = await response.json() as { data?: T; error?: { message?: string; requestId?: string } };
  if (!response.ok || body.data === undefined) throw apiError(response, body, "Back Office data could not be loaded.");
  return body.data;
}

async function write<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
  const response = await fetch(`/api/bo/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload: { data?: T; error?: { message?: string; requestId?: string } };
  try { payload = JSON.parse(text) as typeof payload; }
  catch { throw new BoApiError(response.status, text.trim() || "Back Office command returned an invalid response.", response.headers.get("x-request-id"), false); }
  if (!response.ok || payload.data === undefined) throw apiError(response, payload, "Back Office command could not be completed.");
  return payload.data;
}

function apiError(response: Response, body: { error?: { message?: string; requestId?: string } }, fallback: string) {
  if (response.status === 401 && typeof window !== "undefined") void recoverInvalidStaffPasswordSession();
  const canonicalMessage = typeof body.error?.message === "string" && body.error.message.trim().length > 0;
  return new BoApiError(
    response.status,
    canonicalMessage ? body.error!.message! : fallback,
    response.headers.get("x-request-id") ?? body.error?.requestId ?? null,
    canonicalMessage,
  );
}

type BoScopeBootstrap = {
  centers: Array<{ id: string; centerKey: string; displayName: string; timeZone: string; status: string }>;
  paths: Array<{ id: string; code: string; displayName: string; status: string }>;
  runningClasses: Array<{ id: string; centerId: string; pathProgramId: string; operationalName: string; weekdayIso: number; windowStartsLocal: string; windowEndsLocal: string; deliveryTopology: "FIXED_COHORT" | "FLEXIBLE_STUDIO" | "OVERLAPPING_COHORT"; defaultParticipationMinutes: number | null; optimalConcurrentCapacity: number; status: string }>;
};

type AccessAssignmentCommand = {
  userId: string;
  roleId: string;
  scopeType: "GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS";
  scopeId: string | null;
  effectiveFrom?: string;
  effectiveUntil?: string | null;
};

export const boApi = {
  calendarScope: async () => {
    const state = await readOne<BoScopeBootstrap>("delivery/calendar-scope");
    return { centers: state.centers.map((item): BoCenter => ({ id: item.id, key: item.centerKey, displayName: item.displayName, timeZone: item.timeZone, status: item.status })), paths: state.paths.map((item): BoPathProgram => ({ id: item.id, code: item.code, displayName: item.displayName, status: item.status })), classes: state.runningClasses.map((item): BoRunningClass => ({ id: item.id, centerId: item.centerId, name: item.operationalName, pathProgramId: item.pathProgramId, timezone: "Asia/Ho_Chi_Minh", recurrenceWeekdays: [item.weekdayIso], startLocalTime: item.windowStartsLocal, endLocalTime: item.windowEndsLocal, defaultCapacity: item.optimalConcurrentCapacity, deliveryTopology: item.deliveryTopology, defaultParticipationMinutes: item.defaultParticipationMinutes, status: item.status })) };
  },
  scopeCatalog: async () => {
    const state = await readOne<BoScopeBootstrap>("delivery/bootstrap-state");
    return {
      centers: state.centers.map((item): BoCenter => ({ id: item.id, key: item.centerKey, displayName: item.displayName, timeZone: item.timeZone, status: item.status })),
      paths: state.paths.map((item): BoPathProgram => ({ id: item.id, code: item.code, displayName: item.displayName, status: item.status })),
      classes: state.runningClasses.map((item): BoRunningClass => ({ id: item.id, centerId: item.centerId, name: item.operationalName, pathProgramId: item.pathProgramId, timezone: "Asia/Ho_Chi_Minh", recurrenceWeekdays: [item.weekdayIso], startLocalTime: item.windowStartsLocal, endLocalTime: item.windowEndsLocal, defaultCapacity: item.optimalConcurrentCapacity, deliveryTopology: item.deliveryTopology, defaultParticipationMinutes: item.defaultParticipationMinutes, status: item.status })),
    };
  },
  centers: () => read<BoCenter>("centers"),
  pathPrograms: () => read<BoPathProgram>("path-programs"),
  runningClasses: () => read<BoRunningClass>("running-classes"),
  calendarExclusions: (centerId: string, status?: "ACTIVE" | "ARCHIVED") => read<BoCalendarExclusion>(`delivery/calendar-exclusions?centerId=${encodeURIComponent(centerId)}${status ? `&status=${encodeURIComponent(status)}` : ""}`),
  previewCalendarExclusion: (body: { centerId:string; scopeType:"HOUSE"|"PATH"|"RUNNING_CLASS"; pathProgramId?:string; runningClassId?:string; startsOnLocalDate:string; endsBeforeLocalDate:string; effectiveAt:string }) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) if (value !== undefined) params.set(key, String(value));
    return readOne<BoCalendarExclusionImpact>(`delivery/calendar-exclusions/preview?${params.toString()}`);
  },
  createCalendarExclusion: (body: { centerId:string; scopeType:"HOUSE"|"PATH"|"RUNNING_CLASS"; pathProgramId?:string; runningClassId?:string; startsOnLocalDate:string; endsBeforeLocalDate:string; reason:BoCalendarExclusionReason; reasonDetail?:string|null }, idempotencyKey: string) => write<BoCalendarExclusionPublishResult>("delivery/calendar-exclusions", body, idempotencyKey),
  archiveCalendarExclusion: (id:string, expectedVersion:number, archiveReason:string) => write<BoCalendarExclusion>(`delivery/calendar-exclusions/${encodeURIComponent(id)}`, { action:"archive", expectedVersion, archiveReason }, crypto.randomUUID()),
  syllabi: () => read<BoSyllabus>("syllabi"),
  practiceAuthoringContext: () => readOne<BoPracticeAuthoringContext>("practice/authoring-context"),
  practiceRepertoireAccessContext: () => readOne<BoPracticeRepertoireAccessContext>("practice/repertoire-access/context"),
  practiceRepertoireAccess: (studentProfileId: string, pathProgramId: string, effectiveAt = new Date().toISOString()) => readOne<BoPracticeRepertoireAccessProjection>(`practice/repertoire-access?studentProfileId=${encodeURIComponent(studentProfileId)}&pathProgramId=${encodeURIComponent(pathProgramId)}&effectiveAt=${encodeURIComponent(effectiveAt)}`),
  grantPracticeRepertoireAccess: (body: BoPracticeRepertoireGrantCommand) => write<BoPracticeRepertoireAccessGrant>("practice/repertoire-access/grants", body, crypto.randomUUID()),
  revokePracticeRepertoireAccess: (grantId: string, reason: string) => write<BoPracticeRepertoireAccessGrant>(`practice/repertoire-access/grants/${encodeURIComponent(grantId)}/revoke`, { reason }, crypto.randomUUID()),
  practiceResources: (pathProgramId: string) => read<BoPracticeResourceDetail>(`practice/resources?pathProgramId=${encodeURIComponent(pathProgramId)}`),
  practiceResource: (resourceId: string) => readOne<BoPracticeResourceDetail>(`practice/resources/${encodeURIComponent(resourceId)}`),
  createPracticeResource: (body: BoPracticeCreateCommand, idempotencyKey: string) => write<BoPracticeResourceDetail>("practice/resources", body, idempotencyKey),
  ensurePracticeDraft: (resourceId: string) => write<BoPracticeResourceVersion>(`practice/resources/${encodeURIComponent(resourceId)}/drafts`, {}, crypto.randomUUID()),
  updatePracticeDraft: (versionId: string, title: string, expectedRevision: number) => write<BoPracticeResourceVersion>(`practice/versions/${encodeURIComponent(versionId)}`, { title, expectedRevision }, crypto.randomUUID()),
  replacePracticePages: (versionId: string, expectedRevision: number, pages: Array<{ sheetMediaAssetId: string; worksheetMediaAssetId: string | null }>) => write<BoPracticeResourceVersion>(`practice/versions/${encodeURIComponent(versionId)}/pages`, { expectedRevision, pages }, crypto.randomUUID()),
  publishPracticeVersion: (versionId: string, expectedRevision: number) => write<BoPracticeResourceDetail>(`practice/versions/${encodeURIComponent(versionId)}/publish`, { expectedRevision }, crypto.randomUUID()),
  uploadPracticeMedia,
  syllabusWorksheetMedia: () => read<BoSyllabusWorksheetMedia>("learning/syllabi/media"),
  uploadSyllabusWorksheetMedia,
  syllabusWorksheetPreviewUrl,
  learningSyllabusOwners: () => readOne<BoLearningSyllabusOwnerCatalog>("learning/syllabi/owners"),
  learningSyllabi: (owner?: BoLearningSyllabusOwner) => read<BoLearningSyllabusSummary>(`learning/syllabi${owner ? `?ownerType=${encodeURIComponent(owner.type)}&ownerId=${encodeURIComponent(owner.id)}` : ""}`),
  learningSyllabus: (syllabusId: string) => readOne<BoLearningSyllabusDetail>(`learning/syllabi/${encodeURIComponent(syllabusId)}`),
  createLearningSyllabus: (body: { owner: BoLearningSyllabusOwner; code: string; draft: BoLearningSyllabusDraftInput }) => write<BoLearningSyllabusDetail>("learning/syllabi", { ownerType: body.owner.type, ownerId: body.owner.id, code: body.code, ...body.draft }, crypto.randomUUID()),
  saveLearningSyllabusDraft: (syllabusId: string, expectedRevision: number, draft: BoLearningSyllabusDraftInput) => write<BoLearningSyllabusVersion>(`learning/syllabi/${encodeURIComponent(syllabusId)}/draft`, { expectedRevision, ...draft }, crypto.randomUUID()),
  publishLearningSyllabusDraft: (syllabusId: string, expectedRevision: number) => write<BoLearningSyllabusVersion>(`learning/syllabi/${encodeURIComponent(syllabusId)}/publish`, { expectedRevision }, crypto.randomUUID()),
  createNextLearningSyllabusDraft: (syllabusId: string) => write<BoLearningSyllabusVersion>(`learning/syllabi/${encodeURIComponent(syllabusId)}/next-draft`, {}, crypto.randomUUID()),
  archiveLearningSyllabus: (syllabusId: string, expectedRevision: number, reason: string) => write<BoLearningSyllabus>(`learning/syllabi/${encodeURIComponent(syllabusId)}/archive`, { expectedRevision, reason }, crypto.randomUUID()),
  artSyllabusProfile: (versionId: string) => readOne<BoArtSyllabusProfile | null>(`learning/syllabi/versions/${encodeURIComponent(versionId)}/artchitect-profile`),
  saveArtSyllabusProfile: (versionId: string, body: { richContent: BoSyllabusRichContent; worksheetMediaIds: string[]; toolTags: string[]; expectedRevision: number | null }) => write<BoArtSyllabusProfile>(`learning/syllabi/versions/${encodeURIComponent(versionId)}/artchitect-profile`, body, crypto.randomUUID()),
  pianoSyllabusProfile: (versionId: string) => readOne<BoPianoSyllabusProfile | null>(`learning/syllabi/versions/${encodeURIComponent(versionId)}/pianohouse-profile`),
  savePianoSyllabusProfile: (versionId: string, body: { practiceResourceId: string; practiceResourceVersionId: string; practicePageId: string; expectedRevision: number | null }) => write<BoPianoSyllabusProfile>(`learning/syllabi/versions/${encodeURIComponent(versionId)}/pianohouse-profile`, body, crypto.randomUUID()),
  littlePinerSyllabusProfile: (versionId: string) => readOne<BoLittlePinerSyllabusProfile | null>(`learning/syllabi/versions/${encodeURIComponent(versionId)}/little-piner-profile`),
  saveLittlePinerSyllabusProfile: (versionId: string, body: { richContent: BoSyllabusRichContent; worksheetMediaIds: string[]; toolTags: string[]; practiceResourceId: string; practiceResourceVersionId: string; practicePageId: string; expectedRevision: number | null }) => write<BoLittlePinerSyllabusProfile>(`learning/syllabi/versions/${encodeURIComponent(versionId)}/little-piner-profile`, body, crypto.randomUUID()),
  sessions: () => read<BoSession>("sessions"),
  sessionSyllabusBinding: (sessionId: string) => readOne<BoSessionSyllabusBindingProjection>(`delivery/sessions/${encodeURIComponent(sessionId)}/syllabus-binding`),
  bindSessionSyllabus: (sessionId: string, command: BoSessionSyllabusBindingCommand, idempotencyKey: string) => write<BoSessionSyllabusBindingResult>(`delivery/sessions/${encodeURIComponent(sessionId)}/syllabus-binding`, command, idempotencyKey),
  registrations: (sessionId: string) => read<BoRegistration>(`sessions/${encodeURIComponent(sessionId)}/registrations`),
  learners: (query = "", limit = 200, beforeStudentId?: string) => read<BoLearnerDirectoryItem>(`learners?limit=${encodeURIComponent(String(limit))}${beforeStudentId ? `&beforeStudentId=${encodeURIComponent(beforeStudentId)}` : ""}${query ? `&query=${encodeURIComponent(query)}` : ""}`),
  acquisitionIntents: (status?: BoAcquisitionIntentStatus, limit = 100) => read<BoAcquisitionIntent>(`acquisition/intents?limit=${encodeURIComponent(String(limit))}${status ? `&status=${encodeURIComponent(status)}` : ""}`),
  acquisitionIntent: (intentId: string) => readOne<BoAcquisitionIntent>(`acquisition/intents/${encodeURIComponent(intentId)}`),
  markAcquisitionContacted: (intentId: string, expectedVersion: number, idempotencyKey: string) => write<{ intentId: string; status: "CONTACTED"; version: number }>(`acquisition/intents/${encodeURIComponent(intentId)}/contacted`, { expectedVersion }, idempotencyKey),
  verifyAcquisitionContact: (intentId: string, expectedVersion: number, idempotencyKey: string) => write<{ intentId: string; status: "CONTACT_VERIFIED"; version: number }>(`acquisition/intents/${encodeURIComponent(intentId)}/verify-contact`, { expectedVersion }, idempotencyKey),
  closeAcquisitionIntent: (intentId: string, expectedVersion: number, reason: string, idempotencyKey: string) => write<{ intentId: string; status: "CLOSED"; version: number }>(`acquisition/intents/${encodeURIComponent(intentId)}/close`, { expectedVersion, reason }, idempotencyKey),
  createStudentIntake: async (body: { displayName: string; birthYear: number | null; birthMonth: number | null; birthDay: number | null; birthPrecision: "UNKNOWN" | "YEAR_ONLY" | "YEAR_MONTH" | "FULL_DATE"; guardianDisplayName: string | null; contactType: "PHONE" | "EMAIL"; contactValue: string; relationshipType: "PARENT" | "GUARDIAN" | "OTHER"; effectiveFrom: string }, idempotencyKey: string) => {
    const result = await write<{ studentProfileId: string; parentUserId: string; guardianRelationshipId: string; parentReused: boolean }>("student-intakes", body, idempotencyKey);
    const canonicalId = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
    if (!result || !canonicalId(result.studentProfileId) || !canonicalId(result.parentUserId) || !canonicalId(result.guardianRelationshipId) || typeof result.parentReused !== "boolean") {
      throw new BoApiError(502, "Student intake returned an invalid response.", null, false);
    }
    return result;
  },
  voidStudentIntake: (studentId: string, body: { expectedStudentVersion: number; reason: string }, idempotencyKey: string) =>
    write<BoStudentIntakeVoidResult>("student-intakes/" + encodeURIComponent(studentId) + "/void", body, idempotencyKey),
  learnerLifecycle: (studentId: string) => readOne<BoLearnerLifecycle>(`students/${encodeURIComponent(studentId)}/lifecycle`),
  learnerPinoria: (studentId: string) => readOne<BoStudentPinoriaSummary>(`students/${encodeURIComponent(studentId)}/pinoria`),
  feedLearnerCompanion: (studentId: string, companionId: string, idempotencyKey: string) => write<{ feedEventId: string; ledgerId: string; companionId: string; fruitBalanceAfter: number; materializationLevel: number; stageFeedCount: number; state: "GROWING" | "READY_FOR_RITUAL"; readinessRuleKey: "FEED_2" | "FEED_5_AND_WATER_SIGIL" | null }>(`students/${encodeURIComponent(studentId)}/pinoria/companions/${encodeURIComponent(companionId)}/feed`, {}, idempotencyKey),
  billingProductPlans: () => read<BoProductPlan>("billing/product-plans"),
  updateBillingProductPlan: (productPlanId: string, body: { listPriceMinor: number; enabled: boolean; badge: BoProductPlanBadge; expectedVersion: number }) => write<BoProductPlan>(`billing/product-plans/${encodeURIComponent(productPlanId)}/configure`, body, crypto.randomUUID()),
  createBillingSale: (body: { payerParentUserId: string; studentProfileId: string; pathProgramId: string; productPlanId: string; contractualStartsOn: string; itemDiscountMinor?: number; billDiscountMinor?: number; dueOn?: string; campaignReference?: string }, idempotencyKey: string) => write<BoSaleResult>("billing/sales", body, idempotencyKey),
  billingBill: (billId: string) => readOne<BoBillSummary>(`billing/bills/${encodeURIComponent(billId)}`),
  recordBillingTransaction: (billId: string, body: { transactionKind: BoPaymentTransactionKind; amountMinor: number; occurredAt: string; method: BoPaymentMethod; reference?: string; note?: string }, idempotencyKey: string) => write<BoPaymentTransaction>(`billing/bills/${encodeURIComponent(billId)}/transactions`, body, idempotencyKey),
  voidBillingTransaction: (transactionId: string, body: { expectedVersion: number; reason: string }, idempotencyKey: string) => write<BoPaymentTransaction>(`billing/transactions/${encodeURIComponent(transactionId)}/void`, body, idempotencyKey),
  voidBill: (billId: string, body: { expectedVersion: number; reason: string }, idempotencyKey: string) => write<BoBillSummary>(`billing/bills/${encodeURIComponent(billId)}/void`, body, idempotencyKey),
  createSubscription: (body: { studentProfileId: string; pathProgramId: string; serviceStartsOn: string; contractualEndsOn: string; weeklyCommitment: number; purchasedUnits: number; commercialReference?: string }, idempotencyKey: string) => write<unknown>("subscriptions", body, idempotencyKey),
  renewSubscription: (subscriptionId: string, body: { serviceStartsOn?: string; contractualEndsOn: string; weeklyCommitment: number; purchasedUnits: number; commercialReference?: string }, idempotencyKey: string) => write<unknown>(`subscriptions/${encodeURIComponent(subscriptionId)}/renew`, body, idempotencyKey),
  subscriptionProjectedCompletion: (subscriptionId: string, effectiveAt: string) => readOne<BoSubscriptionProjectedCompletion>(`subscriptions/${encodeURIComponent(subscriptionId)}/projected-completion?effectiveAt=${encodeURIComponent(effectiveAt)}`),
  cancelSubscription: (subscriptionId: string, body: { expectedVersion: number; reason: string }, idempotencyKey: string) => write<unknown>(`subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, body, idempotencyKey),
  neutralizeSubscription: (subscriptionId: string, body: { expectedVersion: number; releaseLocalDate: string; reason: string }, idempotencyKey: string) => write<{ subscription: BoLearnerSubscription; enrollments: BoLearnerEnrollment[]; endedEnrollmentIds: string[]; releasedEnrollmentCount: number; releaseLocalDate: string }>(`subscriptions/${encodeURIComponent(subscriptionId)}/neutralize`, body, idempotencyKey),
  placeEnrollment: (body: { subscriptionId: string; runningClassId: string; effectiveFromLocalDate: string; plannedEntryLocalTime?: string | null; plannedDurationMinutes?: number | null; commandEffectiveLocalDate: string; policyEffectiveAt: string }, idempotencyKey: string) => write<unknown>("enrollments", body, idempotencyKey),
  preflightBulkEnrollments: (body: { subscriptions: Array<{ subscriptionId: string; expectedPathProgramId: string; expectedWeeklyCommitment: number; placements: Array<{ runningClassId: string; effectiveFromLocalDate: string; plannedEntryLocalTime?: string | null; plannedDurationMinutes?: number | null }> }>; pendingSubscriptions: Array<{ subscriptionId: string; expectedPathProgramId: string; expectedWeeklyCommitment: number }>; commandEffectiveLocalDate: string }) => write<{ placedSubscriptions: number; pendingSubscriptions: number; enrollments: number; missing: number; reused: number }>("enrollments/bulk-preflight", body, crypto.randomUUID()),
  placeBulkEnrollments: (body: { subscriptions: Array<{ subscriptionId: string; expectedPathProgramId: string; expectedWeeklyCommitment: number; placements: Array<{ runningClassId: string; effectiveFromLocalDate: string; plannedEntryLocalTime?: string | null; plannedDurationMinutes?: number | null }> }>; pendingSubscriptions: Array<{ subscriptionId: string; expectedPathProgramId: string; expectedWeeklyCommitment: number }>; commandEffectiveLocalDate: string; policyEffectiveAt: string }, idempotencyKey: string) => write<{ placedSubscriptions: number; pendingSubscriptions: number; enrollments: number; created: number; reused: number }>("enrollments/bulk-place", body, idempotencyKey),
  endEnrollment: (enrollmentId: string, body: { effectiveUntilExclusiveLocalDate: string; expectedVersion: number; reason: string }, idempotencyKey: string) => write<unknown>(`enrollments/${encodeURIComponent(enrollmentId)}/end`, body, idempotencyKey),
  resetParentPin: (parentUserId: string) => write<{ command: string; temporaryPin: string; expiresAt: string; credentialVersion: number }>(`identity/parents/${encodeURIComponent(parentUserId)}/pin/reset`, {}, crypto.randomUUID()),
  openStudioOperations: (centerId?: string) => readOne<BoOpenStudioOperations>(`open-studio/operations${centerId ? `?centerId=${encodeURIComponent(centerId)}` : ""}`),
  openStudioListingCatalog: (centerId?: string) => readOne<BoOpenStudioListingCatalog>(`open-studio/listing-catalog?effectiveAt=${encodeURIComponent(new Date().toISOString())}${centerId ? `&centerId=${encodeURIComponent(centerId)}` : ""}`),
  openStudioLearners: (query = "") => read<BoLearnerDirectoryItem>(`open-studio/learners${query ? `?query=${encodeURIComponent(query)}` : ""}`),
  openStudioLearnerLifecycle: (studentId: string) => readOne<BoLearnerLifecycle>(`open-studio/students/${encodeURIComponent(studentId)}/lifecycle`),
  openStudioPasses: (houseMembershipId: string, effectiveAt: string) => read<BoOpenStudioPass>(`open-studio/passes?houseMembershipId=${encodeURIComponent(houseMembershipId)}&effectiveAt=${encodeURIComponent(effectiveAt)}`),
  createOpenStudioListing: (body: { sessionId: string; syllabusId: string; experienceType: "KHAM_PHA" | "CAO_CAP" | "CHUYEN_DE"; bookingOpensAt?: string | null; bookingClosesAt?: string | null }) => write<unknown>("open-studio/listings", body, crypto.randomUUID()),
  publishOpenStudioListing: (listingId: string, expectedVersion: number) => write<unknown>(`open-studio/listings/${encodeURIComponent(listingId)}/publish`, { expectedVersion, publishedAt: new Date().toISOString() }, crypto.randomUUID()),
  closeOpenStudioListing: (listingId: string, expectedVersion: number, reason: string) => write<unknown>(`open-studio/listings/${encodeURIComponent(listingId)}/close`, { expectedVersion, closedAt: new Date().toISOString(), reason }, crypto.randomUUID()),
  cancelOpenStudioListing: (listingId: string, expectedVersion: number, reason: string) => write<unknown>(`open-studio/listings/${encodeURIComponent(listingId)}/cancel`, { expectedVersion, cancelledAt: new Date().toISOString(), reason }, crypto.randomUUID()),
  assignOpenStudioPathCenter: (body: { houseMembershipId: string; pathProgramId: string; centerId: string; effectiveFrom: string }) => write<unknown>("open-studio/member-path-centers/assign", body, crypto.randomUUID()),
  assignOpenStudioMemberCenter: (body: { houseMembershipId: string; centerId: string; effectiveFrom: string }) => write<unknown>("open-studio/member-centers/assign", body, crypto.randomUUID()),
  reassignOpenStudioMemberCenter: (body: { houseMembershipId: string; centerId: string; effectiveFrom: string; assignmentReason: string }) => write<unknown>("open-studio/member-centers/reassign", body, crypto.randomUUID()),
  issueOpenStudioMonthlyPass: (body: { houseMembershipId: string; pathProgramId: string; effectiveAt: string }) => write<unknown[]>("open-studio/passes/issue-monthly-path", body, crypto.randomUUID()),
  issueOpenStudioBringAFriendPass: (body: { houseMembershipId: string; effectiveAt: string }) => write<unknown[]>("open-studio/passes/issue-bring-a-friend", body, crypto.randomUUID()),
  revokeOpenStudioPass: (passId: string, body: { revokedAt: string; reason: string }) => write<unknown>(`open-studio/passes/${encodeURIComponent(passId)}/revoke`, body, crypto.randomUUID()),
  openStudioPolicyStream: <T>(key: OpenStudioPolicyKey, target: OpenStudioPolicyTarget) => readOne<OpenStudioPolicyInspection<T> | null>(`policies/open_studio/${key}/stream?${policyTargetQuery(target)}`),
  openStudioPolicyEffective: <T>(key: OpenStudioPolicyKey, target: OpenStudioPolicyTarget, effectiveAt: string) => readOne<OpenStudioResolvedPolicy<T>>(`policies/open_studio/${key}/effective?${policyTargetQuery(target)}&effectiveAt=${encodeURIComponent(effectiveAt)}`),
  createOpenStudioPolicyDraft: <T>(key: OpenStudioPolicyKey, target: OpenStudioPolicyTarget, value: T, changeReason: string, expectedRevision: number) => write<OpenStudioPolicyDraft>(`policies/open_studio/${key}/versions`, { ...target, value, changeReason, expectedRevision }, crypto.randomUUID()),
  publishOpenStudioPolicy: (key: OpenStudioPolicyKey, versionId: string, target: OpenStudioPolicyTarget, effectiveFrom: string, expectedRevision: number) => write<{ published: boolean }>(`policies/open_studio/${key}/versions/${encodeURIComponent(versionId)}/publish`, { ...target, effectiveFrom, expectedRevision }, crypto.randomUUID()),
  openStudioEligibility: (passId: string, body: { listingId: string; participantMode: "OWNER"; studentProfileId: string; effectiveAt: string }) => readOne<{ eligible: boolean; reasons: string[] }>(`open-studio/passes/${encodeURIComponent(passId)}/claim-eligibility?listingId=${encodeURIComponent(body.listingId)}&participantMode=OWNER&studentProfileId=${encodeURIComponent(body.studentProfileId)}&effectiveAt=${encodeURIComponent(body.effectiveAt)}`),
  admitOpenStudioOwner: (body: { passId: string; listingId: string; studentProfileId: string; effectiveAt: string }) => write<unknown>("open-studio/admission", { ...body, participantMode: "OWNER" }, crypto.randomUUID()),
  learningOwner: (sessionId: string) => readOne<BoSessionLearningOwnerProjection>(`sessions/${encodeURIComponent(sessionId)}/learning-owner`),
  assignLearningOwner: (sessionId: string, command: BoSessionLearningOwnerCommand, idempotencyKey: string) => write<BoSessionLearningOwner>(`sessions/${encodeURIComponent(sessionId)}/learning-owner`, command, idempotencyKey),
  accessRoles: () => read<BoAccessRole>("access/roles"),
  accessRole: (roleId: string) => readOne<BoAccessRoleDetail>(`access/roles/${encodeURIComponent(roleId)}`),
  accessPermissions: () => read<BoAccessPermission>("access/permissions"),
  accessAudit: (limit = 100) => read<BoAccessAuditEvent>(`access/audit?limit=${encodeURIComponent(String(limit))}`),
  accessUsers: () => read<BoAccessSystemUser>("access/users"),
  trainingCatalog: () => read<TrainingModule>("workforce/training/catalog"),
  trainingStaffAssignments: (staffMemberId: string) => read<TrainingAssignmentDetail>(`workforce/training/staff/${encodeURIComponent(staffMemberId)}`),
  createTrainingModule: (moduleKey: string, draft: TrainingDraftInput) => write<TrainingModule>("workforce/training/modules", { moduleKey, ...draft }, crypto.randomUUID()),
  saveTrainingDraft: (versionId: string, expectedRevision: number, draft: TrainingDraftInput) => write<TrainingModuleVersion>(`workforce/training/versions/${encodeURIComponent(versionId)}/draft`, { expectedRevision, ...draft }, crypto.randomUUID()),
  publishTrainingVersion: (versionId: string, expectedRevision: number) => write<TrainingModuleVersion>(`workforce/training/versions/${encodeURIComponent(versionId)}/publish`, { expectedRevision }, crypto.randomUUID()),
  createNextTrainingDraft: (moduleId: string) => write<TrainingModuleVersion>(`workforce/training/modules/${encodeURIComponent(moduleId)}/next-draft`, {}, crypto.randomUUID()),
  retireTrainingModule: (moduleId: string, reason: string) => write<TrainingModule>(`workforce/training/modules/${encodeURIComponent(moduleId)}/retire`, { reason }, crypto.randomUUID()),
  assignTraining: (body: { staffMemberId: string; moduleVersionId: string; dueDate?: string | null; reason: string }) => write<TrainingAssignmentDetail>("workforce/training/assignments", body, crypto.randomUUID()),
  signOffTraining: (assignmentId: string, note?: string | null) => write<TrainingAssignmentDetail>(`workforce/training/assignments/${encodeURIComponent(assignmentId)}/signoff`, { note: note ?? null }, crypto.randomUUID()),
  revokeTrainingQualification: (qualificationId: string, reason: string) => write<StaffQualification>(`workforce/training/qualifications/${encodeURIComponent(qualificationId)}/revoke`, { reason }, crypto.randomUUID()),
  staffRecords: () => read<BoStaffRecord>("workforce/staff-records"),
  staffRegistrationIntake: () => readOne<{ enabled: boolean; updatedAt: string | null; updatedByUserId: string | null; version: number }>("workforce/staff-registration-settings"),
  setStaffRegistrationIntake: (enabled: boolean) => write<{ enabled: boolean; updatedAt: string | null; updatedByUserId: string | null; version: number }>("workforce/staff-registration-settings", { enabled }, crypto.randomUUID()),
  staffRegistrationRequests: () => read<BoStaffRegistrationRequest>("workforce/staff-registration-requests"),
  approveStaffRegistration: (requestId: string, assignments: BoStaffAccessAssignmentInput[], idempotencyKey: string, existingStaffMemberId?: string) => write<BoStaffRegistrationApprovalResult>(`workforce/staff-registration-requests/${encodeURIComponent(requestId)}/approve`, { assignments, ...(existingStaffMemberId ? { existingStaffMemberId } : {}) }, idempotencyKey),
  rejectStaffRegistration: (requestId: string, reason: string, idempotencyKey: string) => write<{ registrationRequestId: string; status: "REJECTED" }>(`workforce/staff-registration-requests/${encodeURIComponent(requestId)}/reject`, { reason }, idempotencyKey),
  staffRecord: (staffMemberId: string) => readOne<BoStaffProfile>(`workforce/staff-records/${encodeURIComponent(staffMemberId)}`),
  staffPinoria: (staffMemberId: string) => readOne<BoStaffPinoriaProjection>(`workforce/staff-records/${encodeURIComponent(staffMemberId)}/pinoria`),
  workforcePlanningBootstrap: () => readOne<BoWorkforcePlanningBootstrap>("workforce/planning/bootstrap"),
  workforceShiftTemplates: (centerId: string) => read<BoWorkforceShiftTemplate>(`workforce/planning/shift-templates?centerId=${encodeURIComponent(centerId)}`),
  createWorkforceShiftTemplate: (body: { centerId: string; code: string; displayLabel: string; startLocalTime: string; endLocalTime: string }, idempotencyKey: string) => write<BoWorkforceShiftTemplate>("workforce/planning/shift-templates", body, idempotencyKey),
  setWorkforceShiftTemplateStatus: (templateId: string, centerId: string, status: "ACTIVE" | "INACTIVE", idempotencyKey: string) => write<BoWorkforceShiftTemplate>(`workforce/planning/shift-templates/${encodeURIComponent(templateId)}/status`, { centerId, status }, idempotencyKey),
  workforcePlanning: (centerId: string, termWeekId: string) => readOne<BoWorkforceWeeklyPlanning>(`workforce/planning/weekly?centerId=${encodeURIComponent(centerId)}&termWeekId=${encodeURIComponent(termWeekId)}`),
  workforceCheckInExceptionCenters: () => read<BoCenter>("workforce/planning/check-in-exceptions/centers"),
  workforceCheckInExceptions: (centerId: string, status?: BoUnscheduledCheckInRequest["status"]) => read<BoUnscheduledCheckInRequest>(`workforce/planning/check-in-exceptions?centerId=${encodeURIComponent(centerId)}${status ? `&status=${encodeURIComponent(status)}` : ""}`),
  workforceCheckInException: (requestId: string) => readOne<BoUnscheduledCheckInRequest>(`workforce/planning/check-in-exceptions/${encodeURIComponent(requestId)}`),
  approveWorkforceCheckInException: (requestId: string, expectedVersion: number, idempotencyKey: string) => write<BoUnscheduledCheckInRequest>(`workforce/planning/check-in-exceptions/${encodeURIComponent(requestId)}/approve`, { expectedVersion }, idempotencyKey),
  declineWorkforceCheckInException: (requestId: string, expectedVersion: number, reason: string | null, idempotencyKey: string) => write<BoUnscheduledCheckInRequest>(`workforce/planning/check-in-exceptions/${encodeURIComponent(requestId)}/decline`, { expectedVersion, reason }, idempotencyKey),
  timekeeping: (params: { centerId: string; workDate?: string; startDate?: string; endDate?: string; staffMemberId?: string; status?: "OPEN" | "CLOSED"; limit?: number; cursor?: string }) => { const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); }); return readOne<BoTimekeepingPage>(`workforce/timekeeping?${query.toString()}`); },
  correctTimekeeping: (sessionId: string, body: { correctionType: "CHECK_IN_AT" | "CHECK_OUT_AT"; correctedAt: string; reason: string; expectedLatestCorrectionId: string | null }, idempotencyKey: string) => write<BoTimekeepingCorrectionResult>(`workforce/timekeeping/${encodeURIComponent(sessionId)}/corrections`, body, idempotencyKey),
  resolveMissedCheckout: (sessionId: string, body: { checkOutAt: string; reason: string }, idempotencyKey: string) => write<BoTimekeepingMissedCheckoutResult>(`workforce/timekeeping/${encodeURIComponent(sessionId)}/resolve-missed-checkout`, body, idempotencyKey),
  dutyExceptions: (centerId: string) => readAllPages<BoDutyExceptionReview>((cursor) => `workforce/duty/checkout-exceptions?centerId=${encodeURIComponent(centerId)}&limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`),
  approveDutyException: (exceptionId: string, centerId: string, expectedVersion: number, password: string) => write<BoDutyExceptionRecord>(`workforce/duty/checkout-exceptions/${encodeURIComponent(exceptionId)}/approve?centerId=${encodeURIComponent(centerId)}`, { expectedVersion, password }, crypto.randomUUID()),
  assignWorkforceShift: (body: { staffMemberId: string; centerId: string; workDate: string; shiftTemplateId: string; termWeekId?: string; replacesAssignmentId?: string }, idempotencyKey: string) => write<BoWorkforceAssignment>("workforce/planning/assignment", body, idempotencyKey),
  cancelWorkforceAssignment: (assignmentId: string, reason: string, idempotencyKey: string) => write<BoWorkforceAssignment>("workforce/planning/assignment/cancel", { assignmentId, reason }, idempotencyKey),
  updateStaff: (staffMemberId: string, patch: BoStaffProfilePatch) => write<BoStaffProfile>(`workforce/staff-records/${encodeURIComponent(staffMemberId)}`, patch, crypto.randomUUID()),
  setStaffStatus: (staffMemberId: string, status: "active" | "inactive") => write<{ status: string }>(`workforce/staff-records/${encodeURIComponent(staffMemberId)}/status`, { status }, crypto.randomUUID()),
  createAccessRole: (body: { roleKey: string; displayName: string; description?: string | null; permissionKeys: string[] }) => write<{ id: string }>("access/roles", body, crypto.randomUUID()),
  duplicateAccessRole: (roleId: string, body: { roleKey: string; displayName: string; description?: string | null }) => write<{ id: string }>(`access/roles/${encodeURIComponent(roleId)}/duplicate`, body, crypto.randomUUID()),
  updateAccessRole: (roleId: string, body: { displayName: string; description?: string | null; permissionKeys: string[]; expectedUpdatedAt: string }) => write<{ id: string }>(`access/roles/${encodeURIComponent(roleId)}/update`, body, crypto.randomUUID()),
  archiveAccessRole: (roleId: string) => write<{ id: string; status: string }>(`access/roles/${encodeURIComponent(roleId)}/archive`, {}, crypto.randomUUID()),
  assignAccessRole: (body: AccessAssignmentCommand) => write<{ id: string }>("access/assignments", body, crypto.randomUUID()),
  removeAccessAssignment: (assignmentId: string) => write<{ assignmentId: string; status: string }>("access/assignments/remove", { assignmentId }, crypto.randomUUID()),
  setAccessUserStatus: (userId: string, status: "active" | "suspended", reason?: string) => write<{ status: string }>("access/users/status", { userId, status, ...(reason ? { reason } : {}) }, crypto.randomUUID()),
  reconcileTosAccess: () => write<{ state: string; emailCount: number; policyId: string | null }>("access/perimeter-reconcile", {}, crypto.randomUUID()),
  resetStaffPin: (userId: string, idempotencyKey: string) => write<BoStaffOnboardingResult>(`access/users/${encodeURIComponent(userId)}/staff-pin/reset`, {}, idempotencyKey),
  onboardStaff: (command: BoStaffOnboardingCommand, idempotencyKey: string) => write<BoStaffOnboardingResult>("workforce/staff-onboarding", command, idempotencyKey),
};

function policyTargetQuery(target: OpenStudioPolicyTarget): string {
  const params = new URLSearchParams({ targetType: target.targetType });
  if (target.targetType === "CENTER") params.set("targetId", target.targetId);
  return params.toString();
}
