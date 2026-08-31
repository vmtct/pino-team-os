import type {
  BoAccessRole,
  BoCenter,
  BoPathProgram,
  BoRegistration,
  BoSessionLearningOwner,
  BoSessionLearningOwnerCommand,
  BoSessionLearningOwnerProjection,
  BoLearnerDirectoryItem,
  BoLearnerLifecycle,
  BoOpenStudioOperations,
  BoOpenStudioListingCatalog,
  BoOpenStudioPass,
  BoRunningClass,
  BoSession,
  BoStaffOnboardingCommand,
  BoStaffOnboardingResult,
  BoStaffProfile,
  BoStaffProfilePatch,
  BoStaffRecord,
  BoSyllabus,
  BoWorkforceAssignment,
  BoWorkforceWeeklyPlanning,
} from "./bo-model";
import type { BoAccessAuditEvent, BoAccessPermission, BoAccessRoleDetail, BoAccessSystemUser } from "./bo-access-model";

export class BoApiError extends Error {
  constructor(readonly status: number, message: string, readonly requestId: string | null) {
    super(message);
    this.name = "BoApiError";
  }
}

export type OpenStudioPolicyKey = "monthly_path_pass.v1" | "bring_a_friend.v1" | "public_acquisition.v1" | "cancellation.v1";
export type OpenStudioPolicyTarget = { targetType: "GLOBAL"; targetId: null } | { targetType: "CENTER"; targetId: string };
export type OpenStudioResolvedPolicy<T> = { streamId: string; versionId: string; version: number; effectiveFrom: string; effectiveUntil: string | null; value: T };
export type OpenStudioPolicyInspection<T> = { stream: { id: string; revision: number; targetType: "GLOBAL" | "CENTER"; targetId: string | null }; versions: Array<{ id: string; version: number; storedState: "DRAFT" | "PUBLISHED"; effectiveFrom: string | null; effectiveUntil: string | null; value: T; changeReason: string }> };
export type OpenStudioPolicyDraft = { streamId: string; versionId: string; version: number; revision: number };

async function read<T>(path: string): Promise<T[]> {
  const response = await fetch(`/api/bo/${path}`, { cache: "no-store" });
  const body = await response.json() as { data?: T[]; error?: { message?: string; requestId?: string } };
  if (!response.ok || !body.data) throw apiError(response, body, "Back Office data could not be loaded.");
  return body.data;
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
  catch { throw new BoApiError(response.status, text.trim() || "Back Office command returned an invalid response.", response.headers.get("x-request-id")); }
  if (!response.ok || payload.data === undefined) throw apiError(response, payload, "Back Office command could not be completed.");
  return payload.data;
}

function apiError(response: Response, body: { error?: { message?: string; requestId?: string } }, fallback: string) {
  return new BoApiError(response.status, body.error?.message ?? fallback, response.headers.get("x-request-id") ?? body.error?.requestId ?? null);
}

type BoScopeBootstrap = {
  centers: Array<{ id: string; centerKey: string; displayName: string; timeZone: string; status: string }>;
  paths: Array<{ id: string; code: string; displayName: string; status: string }>;
  runningClasses: Array<{ id: string; pathProgramId: string; operationalName: string; weekdayIso: number; windowStartsLocal: string; windowEndsLocal: string; optimalConcurrentCapacity: number; status: string }>;
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
  scopeCatalog: async () => {
    const state = await readOne<BoScopeBootstrap>("delivery/bootstrap-state");
    return {
      centers: state.centers.map((item): BoCenter => ({ id: item.id, key: item.centerKey, displayName: item.displayName, timeZone: item.timeZone, status: item.status })),
      paths: state.paths.map((item): BoPathProgram => ({ id: item.id, code: item.code, displayName: item.displayName, status: item.status })),
      classes: state.runningClasses.map((item): BoRunningClass => ({ id: item.id, name: item.operationalName, pathProgramId: item.pathProgramId, timezone: "Asia/Ho_Chi_Minh", recurrenceWeekdays: [item.weekdayIso], startLocalTime: item.windowStartsLocal, endLocalTime: item.windowEndsLocal, defaultCapacity: item.optimalConcurrentCapacity, status: item.status })),
    };
  },
  centers: () => read<BoCenter>("centers"),
  pathPrograms: () => read<BoPathProgram>("path-programs"),
  runningClasses: () => read<BoRunningClass>("running-classes"),
  syllabi: () => read<BoSyllabus>("syllabi"),
  sessions: () => read<BoSession>("sessions"),
  registrations: (sessionId: string) => read<BoRegistration>(`sessions/${encodeURIComponent(sessionId)}/registrations`),
  learners: (query = "") => read<BoLearnerDirectoryItem>(`learners${query ? `?query=${encodeURIComponent(query)}` : ""}`),
  learnerLifecycle: (studentId: string) => readOne<BoLearnerLifecycle>(`students/${encodeURIComponent(studentId)}/lifecycle`),
  createSubscription: (body: { studentProfileId: string; pathProgramId: string; serviceStartsOn: string; weeklyCommitment: number; purchasedUnits: number; commercialReference?: string }) => write<unknown>("subscriptions", body, crypto.randomUUID()),
  renewSubscription: (subscriptionId: string, body: { serviceStartsOn?: string; weeklyCommitment: number; purchasedUnits: number; commercialReference?: string }) => write<unknown>(`subscriptions/${encodeURIComponent(subscriptionId)}/renew`, body, crypto.randomUUID()),
  cancelSubscription: (subscriptionId: string, body: { expectedVersion: number; reason: string }) => write<unknown>(`subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, body, crypto.randomUUID()),
  placeEnrollment: (body: { subscriptionId: string; runningClassId: string; effectiveFromLocalDate: string; plannedEntryLocalTime?: string | null; plannedDurationMinutes?: number | null; commandEffectiveLocalDate: string; policyEffectiveAt: string }) => write<unknown>("enrollments", body, crypto.randomUUID()),
  endEnrollment: (enrollmentId: string, body: { effectiveUntilExclusiveLocalDate: string; expectedVersion: number; reason: string }) => write<unknown>(`enrollments/${encodeURIComponent(enrollmentId)}/end`, body, crypto.randomUUID()),
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
  staffRecords: () => read<BoStaffRecord>("workforce/staff-records"),
  staffRecord: (staffMemberId: string) => readOne<BoStaffProfile>(`workforce/staff-records/${encodeURIComponent(staffMemberId)}`),
  workforcePlanning: (centerId: string, termWeekId: string) => readOne<BoWorkforceWeeklyPlanning>(`workforce/planning/weekly?centerId=${encodeURIComponent(centerId)}&termWeekId=${encodeURIComponent(termWeekId)}`),
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
  onboardStaff: (command: BoStaffOnboardingCommand, idempotencyKey: string) => write<BoStaffOnboardingResult>("workforce/staff-onboarding", command, idempotencyKey),
};

function policyTargetQuery(target: OpenStudioPolicyTarget): string {
  const params = new URLSearchParams({ targetType: target.targetType });
  if (target.targetType === "CENTER") params.set("targetId", target.targetId);
  return params.toString();
}
