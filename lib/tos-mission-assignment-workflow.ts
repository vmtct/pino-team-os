/**
 * PAP-1488 / Epic PAP-1188 MISSION — independent Assignment tab workflow.
 *
 * No rendering, Diary writer, or UI activation here. A V18b occurrence plus a
 * CANDIDATE roster member is the only source for the Core Assignment scope.
 * All mutations use the canonical PAP-1487 transport, with explicit caller
 * idempotency keys and no automatic retry or invented success.
 */
import {
  TosMissionAssignmentApiError,
  type TosMissionAssignmentRecord,
  type TosMissionAssignmentScope,
  type TosMissionAssignmentCreateInput,
  type TosMissionAssignmentContextInput,
  type TosMissionAssignmentCancelInput,
} from "./tos-mission-assignment-api";

type CoreAssignmentApi = {
  list(input: TosMissionAssignmentScope & { status?: "ASSIGNED" | "CANCELLED"; limit?: number; offset?: number }): Promise<TosMissionAssignmentRecord[]>;
  create(input: TosMissionAssignmentCreateInput, key: string): Promise<TosMissionAssignmentRecord>;
  updateContext(scope: TosMissionAssignmentScope, id: string, input: TosMissionAssignmentContextInput, key: string): Promise<TosMissionAssignmentRecord>;
  cancel(scope: TosMissionAssignmentScope, id: string, input: TosMissionAssignmentCancelInput, key: string): Promise<TosMissionAssignmentRecord>;
};

export type AssignmentRosterCandidate = {
  studentProfileId: string;
  status: "CANDIDATE" | "CONFLICT" | string;
};
export type AssignmentV18bOccurrence = {
  runningClassId: string;
  teachingContextKey: string;
  occurrence: { localDate: string; status: string; pathProgramId: string };
  roster: readonly AssignmentRosterCandidate[];
};
export type AssignmentV18bToday = {
  centerId: string;
  localDate: string;
  occurrences: readonly AssignmentV18bOccurrence[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (code: string, message: string, status = 403): never => {
  throw new TosMissionAssignmentApiError(status, code, message);
};

/** Admission can only use a Core-projected class, not a legacy session ID. */
export function assignmentScopeForCandidate(
  day: AssignmentV18bToday,
  occurrence: AssignmentV18bOccurrence,
  studentId: string,
): TosMissionAssignmentScope {
  if (!day || !uuid.test(day.centerId) || !uuid.test(studentId) ||
    !Array.isArray(day.occurrences) || !day.occurrences.includes(occurrence) ||
    !uuid.test(occurrence?.runningClassId) ||
    occurrence.occurrence?.localDate !== day.localDate ||
    occurrence.occurrence?.status !== "PROJECTED" ||
    !uuid.test(occurrence.occurrence.pathProgramId) ||
    occurrence.teachingContextKey !== occurrence.runningClassId + ":" + day.localDate ||
    !Array.isArray(occurrence.roster) ||
    !occurrence.roster.some((student) => student.studentProfileId === studentId && student.status === "CANDIDATE")) {
    return invalid("MISSION_ASSIGNMENT_ROSTER_SCOPE_DENIED",
      "Không thể giao Nhiệm vụ ngoài học viên và lớp được phân công.");
  }
  return {
    centerId: day.centerId,
    studentId,
    runningClassId: occurrence.runningClassId,
    localDate: day.localDate,
    teachingContextKey: occurrence.teachingContextKey,
  };
}

function verify(
  record: TosMissionAssignmentRecord, scope: TosMissionAssignmentScope,
  expected?: Partial<Pick<TosMissionAssignmentRecord, "id" | "missionId" | "status" | "version">>,
): TosMissionAssignmentRecord {
  if (!record || !uuid.test(record.id) || !uuid.test(record.missionId) ||
    record.centerId !== scope.centerId || record.studentId !== scope.studentId ||
    record.contextKey !== scope.teachingContextKey ||
    !Number.isSafeInteger(record.version) || record.version < 1 ||
    (record.status !== "ASSIGNED" && record.status !== "CANCELLED") ||
    Object.entries(expected ?? {}).some(([key, value]) =>
      record[key as keyof TosMissionAssignmentRecord] !== value)) {
    return invalid("MISSION_ASSIGNMENT_SOURCE_MISMATCH",
      "Phản hồi Nhiệm vụ không khớp lớp hoặc phiên bản.", 502);
  }
  return record;
}

function assertActive(record: TosMissionAssignmentRecord, scope: TosMissionAssignmentScope): void {
  verify(record, scope, { status: "ASSIGNED" });
}

export async function loadAssignmentsInOccurrence(
  api: CoreAssignmentApi, scope: TosMissionAssignmentScope,
): Promise<readonly TosMissionAssignmentRecord[]> {
  // PAP-1488: Core list is student+center-wide, ordered by assignedAt/id.
  // Fetch every bounded page before projecting exact teachingContextKey to the UI.
  // Never render a partial result when a later page fails or exceeds Core's
  // maximum offset 10000; duplicate IDs also fail closed across page boundaries.
  const result: TosMissionAssignmentRecord[] = [];
  const byId = new Set<string>();
  for (let offset = 0; offset <= 10000; offset += 100) {
    const page = await api.list({ ...scope, status: "ASSIGNED", limit: 100, offset });
    if (!Array.isArray(page) || page.length > 100) {
      return invalid("MISSION_ASSIGNMENT_PAGE_INCOMPLETE",
        "Không thể hiển thị đầy đủ Nhiệm vụ; cần tải trang tiếp theo.", 409);
    }
    for (const record of page) {
      if (record.centerId !== scope.centerId || record.studentId !== scope.studentId) {
        return invalid("MISSION_ASSIGNMENT_SOURCE_MISMATCH", "Dữ liệu Nhiệm vụ sai cơ sở.", 502);
      }
      if (byId.has(record.id)) {
        return invalid("MISSION_ASSIGNMENT_DUPLICATE_ID", "Nhiệm vụ bị lặp ID.", 502);
      }
      byId.add(record.id);
      // Other dated occurrences may belong to the same student; never render them.
      if (record.contextKey !== scope.teachingContextKey) continue;
      verify(record, scope, { status: "ASSIGNED" });
      result.push(record);
    }
    if (page.length < 100) return result;
  }
  return invalid("MISSION_ASSIGNMENT_PAGE_INCOMPLETE",
    "Không thể hiển thị đầy đủ Nhiệm vụ; cần tải trang tiếp theo.", 409);
}

/** Create only Assignment. Never create Diary or a DiaryMission child. */
export async function createMissionAssignment(
  api: CoreAssignmentApi,
  scope: TosMissionAssignmentScope,
  missionId: string,
  idempotencyKey: string,
  contextLabel?: string | null,
): Promise<TosMissionAssignmentRecord> {
  if (!uuid.test(missionId)) {
    return invalid("MISSION_ASSIGNMENT_MISSION_ID_INVALID", "Mission không hợp lệ.", 400);
  }
  const created = await api.create({ ...scope, missionId, contextLabel }, idempotencyKey);
  return verify(created, scope, { missionId, status: "ASSIGNED", version: 1 });
}

export async function editMissionAssignmentContext(
  api: CoreAssignmentApi, scope: TosMissionAssignmentScope,
  active: TosMissionAssignmentRecord, contextLabel: string | null, key: string,
): Promise<TosMissionAssignmentRecord> {
  assertActive(active, scope);
  return verify(await api.updateContext(scope, active.id, {
    expectedVersion: active.version, contextLabel,
  }, key), scope, { id: active.id, missionId: active.missionId, version: active.version + 1, status: "ASSIGNED" });
}

export async function cancelMissionAssignment(
  api: CoreAssignmentApi, scope: TosMissionAssignmentScope,
  active: TosMissionAssignmentRecord, reason: string, key: string,
): Promise<TosMissionAssignmentRecord> {
  assertActive(active, scope);
  if (typeof reason !== "string" || !reason.trim()) {
    return invalid("MISSION_ASSIGNMENT_CANCEL_REASON_REQUIRED", "Cần lý do hủy Nhiệm vụ.", 400);
  }
  return verify(await api.cancel(scope, active.id, {
    expectedVersion: active.version, reason: reason.trim(),
  }, key), scope, { id: active.id, missionId: active.missionId, version: active.version + 1, status: "CANCELLED" });
}

export type AssignmentReplacement =
  | { state: "REPLACED"; cancelled: TosMissionAssignmentRecord; created: TosMissionAssignmentRecord }
  | { state: "PENDING_CREATE"; cancelled: TosMissionAssignmentRecord; missionId: string; createKey: string; error: unknown };

/**
 * Mission ID is immutable in Core: "Đổi" = CANCEL old, then CREATE new.
 * Failures after a confirmed CANCEL cannot roll back the audit record. Expose
 * PENDING_CREATE and retain the same createKey for an explicit safe retry.
 */
export async function replaceMissionAssignment(
  api: CoreAssignmentApi, scope: TosMissionAssignmentScope,
  old: TosMissionAssignmentRecord, nextMissionId: string,
  reason: string, cancelKey: string, createKey: string,
): Promise<AssignmentReplacement> {
  assertActive(old, scope);
  if (!uuid.test(nextMissionId) || nextMissionId === old.missionId) {
    return invalid("MISSION_ASSIGNMENT_REPLACEMENT_INVALID", "Mission thay thế không hợp lệ.", 400);
  }
  if (!cancelKey.trim() || !createKey.trim() || cancelKey === createKey) {
    return invalid("MISSION_ASSIGNMENT_REPLAY_KEY_INVALID", "Thiếu khóa thao tác độc lập.", 400);
  }
  const cancelled = await cancelMissionAssignment(api, scope, old, reason, cancelKey);
  try {
    const created = await createMissionAssignment(api, scope, nextMissionId, createKey);
    return { state: "REPLACED", cancelled, created };
  } catch (error) {
    return { state: "PENDING_CREATE", cancelled, missionId: nextMissionId, createKey, error };
  }
}

export async function resumeMissionReplacement(
  api: CoreAssignmentApi, scope: TosMissionAssignmentScope,
  pending: Extract<AssignmentReplacement, { state: "PENDING_CREATE" }>,
): Promise<AssignmentReplacement> {
  verify(pending.cancelled, scope, { status: "CANCELLED" });
  if (pending.missionId === pending.cancelled.missionId) {
    return invalid("MISSION_ASSIGNMENT_REPLACEMENT_INVALID", "Mission thay thế không hợp lệ.", 400);
  }
  try {
    const created = await createMissionAssignment(api, scope, pending.missionId, pending.createKey);
    return { state: "REPLACED", cancelled: pending.cancelled, created };
  } catch (error) {
    return { ...pending, error };
  }
}
