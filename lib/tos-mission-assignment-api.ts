/**
 * PAP-1488 / Epic PAP-1188 (MISSION): canonical Core Assignment transport.
 * Founder-approved TOS Classroom "Nhiệm Vụ" cards are Assignment, not Diary
 * children (PAP-1509 / PAP-1188 decision 2026-11-05). The existing tab is
 * the approved placement: do not create a second nested Assignment panel.
 * Runtime UI wiring and PAP-1195 authenticated C1 acceptance remain pending.
 * The default singleton fails closed for all writes until a separately
 * authorized, server-scoped Teacher/Center path is verified.
 */
export type TosAssignmentStatus = "ASSIGNED" | "CANCELLED";

export interface TosMissionAssignmentScope {
  centerId: string;
  studentId: string;
  runningClassId: string;
  localDate: string;
  teachingContextKey: string;
}
export interface TosMissionAssignmentListInput extends TosMissionAssignmentScope {
  status?: TosAssignmentStatus;
  limit?: number;
  offset?: number;
}
export interface TosMissionAssignmentCreateInput extends TosMissionAssignmentScope {
  missionId: string;
  contextLabel?: string | null;
}
export interface TosMissionAssignmentContextInput {
  expectedVersion: number;
  contextLabel: string | null;
}
export interface TosMissionAssignmentCancelInput {
  expectedVersion: number;
  reason: string;
}

/** Must match Core's StudentMissionAssignmentRecord; never substitute Diary IDs. */
export interface TosMissionAssignmentRecord {
  id: string;
  centerId: string;
  studentId: string;
  missionId: string;
  missionCodeSnapshot: string;
  missionNameSnapshot: string;
  contextKey: string;
  contextLabel: string | null;
  status: TosAssignmentStatus;
  assignedAt: string;
  assignedByUserId: string;
  updatedAt: string;
  updatedByUserId: string;
  cancelledAt: string | null;
  cancelledReason: string | null;
  version: number;
}

export class TosMissionAssignmentApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "TosMissionAssignmentApiError";
  }
}
type ErrorEnvelope = { error?: { code?: string; message?: string; details?: unknown } };
const base = "/api/tos-learning/learning/mission-assignments";
const canonicalId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const reject = (code: string, message: string): never => {
  throw new TosMissionAssignmentApiError(400, code, message);
};
function id(value: string, name: string): string {
  if (typeof value !== "string" || !canonicalId.test(value.trim())) {
    return reject("MISSION_ASSIGNMENT_ID_INVALID", "Mã " + name + " không hợp lệ.");
  }
  return value.trim();
}
function scopeOf(value: TosMissionAssignmentScope): TosMissionAssignmentScope {
  const centerId = id(value?.centerId, "trung tâm");
  const studentId = id(value?.studentId, "học viên");
  const runningClassId = id(value?.runningClassId, "lớp học");
  const localDate = value?.localDate;
  if (typeof localDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(localDate) ||
    !Number.isFinite(Date.parse(localDate + "T12:00:00Z")) ||
    new Date(localDate + "T12:00:00Z").toISOString().slice(0, 10) !== localDate) {
    return reject("MISSION_ASSIGNMENT_DATE_INVALID", "Ngày lớp không hợp lệ.");
  }
  const teachingContextKey = runningClassId + ":" + localDate;
  if (value.teachingContextKey !== teachingContextKey) {
    return reject("MISSION_ASSIGNMENT_SCOPE_INVALID", "Ngữ cảnh lớp không hợp lệ.");
  }
  return { centerId, studentId, runningClassId, localDate, teachingContextKey };
}
function positiveVersion(version: number): number {
  if (!Number.isSafeInteger(version) || version < 1) {
    return reject("MISSION_ASSIGNMENT_VERSION_INVALID", "Phiên bản nhiệm vụ không hợp lệ.");
  }
  return version;
}
function replayKey(value: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 200) {
    return reject("MISSION_ASSIGNMENT_REPLAY_KEY_INVALID", "Thiếu khóa chống gửi trùng.");
  }
  return value.trim();
}
function boundedText(value: string | null | undefined, max: number, name: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || value.trim().length > max) {
    return reject("MISSION_ASSIGNMENT_TEXT_INVALID", name + " không hợp lệ.");
  }
  return value.trim() || null;
}
const queryOf = (scope: TosMissionAssignmentScope) => new URLSearchParams({
  centerId: scope.centerId, studentId: scope.studentId, runningClassId: scope.runningClassId,
  localDate: scope.localDate, teachingContextKey: scope.teachingContextKey,
}).toString();
async function unwrap<T>(response: Response, shape: "record" | "records"): Promise<T> {
  const body = await response.json().catch(() => null) as (ErrorEnvelope & { data?: unknown }) | null;
  if (!response.ok) {
    throw new TosMissionAssignmentApiError(
      response.status, body?.error?.code ?? "MISSION_ASSIGNMENT_CORE_UNAVAILABLE",
      body?.error?.message ?? "Không thể thực hiện thao tác nhiệm vụ.", body?.error?.details,
    );
  }
  const data = body?.data;
  if (shape === "records") {
    if (Array.isArray(data) && data.every(isRecord)) return data as T;
  } else if (isRecord(data)) {
    return data as T;
  }
  throw new TosMissionAssignmentApiError(response.status, "MISSION_ASSIGNMENT_INVALID_RESPONSE",
    "Dữ liệu nhiệm vụ trả về không hợp lệ.");
}
function isRecord(value: unknown): value is TosMissionAssignmentRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.centerId === "string" &&
    typeof row.studentId === "string" && typeof row.missionId === "string" &&
    Number.isSafeInteger(row.version) && (row.status === "ASSIGNED" || row.status === "CANCELLED");
}
/**
 * A factory is supplied for isolated contract tests and the later guarded integration.
 * The production singleton below ALWAYS fails closed for mutations.
 */
export function createTosMissionAssignmentApiTransport(
  writeAdmitted: boolean,
  transport: typeof fetch = (...args) => fetch(...args),
) {
  const admitted = () => {
    if (!writeAdmitted) {
      throw new TosMissionAssignmentApiError(503, "TOS_MISSION_ASSIGNMENT_WRITE_NOT_ADMITTED",
        "Chức năng giao nhiệm vụ chưa được nghiệm thu.");
    }
  };
  async function mutate(
    path: string, method: "POST" | "PUT", body: object, idempotencyKey: string,
  ): Promise<TosMissionAssignmentRecord> {
    admitted();
    const key = replayKey(idempotencyKey);
    const response = await transport(path, {
      method, cache: "no-store",
      headers: { "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify(body),
    });
    return unwrap<TosMissionAssignmentRecord>(response, "record");
  }
  const list = async (input: TosMissionAssignmentListInput): Promise<TosMissionAssignmentRecord[]> => {
    const scope = scopeOf(input);
    const query = new URLSearchParams(queryOf(scope));
    if (input.status !== undefined) {
      if (input.status !== "ASSIGNED" && input.status !== "CANCELLED") {
        return reject("MISSION_ASSIGNMENT_STATUS_INVALID", "Trạng thái nhiệm vụ không hợp lệ.");
      }
      query.set("status", input.status);
    }
    if (input.limit !== undefined) {
      if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
        return reject("MISSION_ASSIGNMENT_PAGE_INVALID", "Trang nhiệm vụ không hợp lệ.");
      }
      query.set("limit", String(input.limit));
    }
    if (input.offset !== undefined) {
      if (!Number.isSafeInteger(input.offset) || input.offset < 0 || input.offset > 10000) {
        return reject("MISSION_ASSIGNMENT_PAGE_INVALID", "Trang nhiệm vụ không hợp lệ.");
      }
      query.set("offset", String(input.offset));
    }
    return unwrap<TosMissionAssignmentRecord[]>(
      await transport(base + "?" + query, { method: "GET", cache: "no-store" }), "records",
    );
  };
  return {
    list,
    get: async (input: TosMissionAssignmentScope, assignmentId: string): Promise<TosMissionAssignmentRecord> =>
      unwrap<TosMissionAssignmentRecord>(await transport(
        base + "/" + id(assignmentId, "Assignment") + "?" + queryOf(scopeOf(input)),
        { method: "GET", cache: "no-store" },
      ), "record"),
    create: async (input: TosMissionAssignmentCreateInput, key: string): Promise<TosMissionAssignmentRecord> => {
      admitted();
      return mutate(base, "POST", {
        ...scopeOf(input), missionId: id(input.missionId, "Mission"),
        expectedVersion: 0, ...(input.contextLabel === undefined
          ? {} : { contextLabel: boundedText(input.contextLabel, 200, "Ngữ cảnh") }),
      }, key);
    },
    updateContext: async (
      input: TosMissionAssignmentScope, assignmentId: string,
      change: TosMissionAssignmentContextInput, key: string,
    ): Promise<TosMissionAssignmentRecord> => {
      admitted();
      return mutate(base + "/" + id(assignmentId, "Assignment") + "/context", "PUT", {
        ...scopeOf(input), expectedVersion: positiveVersion(change.expectedVersion),
        contextLabel: boundedText(change.contextLabel, 200, "Ngữ cảnh"),
      }, key);
    },
    cancel: async (
      input: TosMissionAssignmentScope, assignmentId: string,
      change: TosMissionAssignmentCancelInput, key: string,
    ): Promise<TosMissionAssignmentRecord> => {
      admitted();
      const reason = typeof change.reason === "string" ? change.reason.trim() : "";
      if (!reason || reason.length > 500) {
        return reject("MISSION_ASSIGNMENT_CANCEL_REASON_INVALID", "Lý do hủy không hợp lệ.");
      }
      return mutate(base + "/" + id(assignmentId, "Assignment") + "/cancel", "POST", {
        ...scopeOf(input), expectedVersion: positiveVersion(change.expectedVersion), reason,
      }, key);
    },
  };
}

/** Existing TOS tab is approved; runtime mount and legitimate E2E grant remain pending. */
export const tosMissionAssignmentApi = createTosMissionAssignmentApiTransport(false);
