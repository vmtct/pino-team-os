import type { AttendanceStatus, RosterSource } from "./tos-learning-api";

export interface SessionLearningOwner {
  sessionId: string;
  staffMemberId: string;
  assignedAt: string;
  assignedByUserId: string | null;
  assignmentSource: "OPERATOR" | "MIGRATION";
  changeReason: string | null;
  updatedAt: string;
  version: number;
}

export type AttendanceSettlementInput = {
  studentProfileId: string;
  sessionId: string;
  source: RosterSource;
  attendanceStatus: AttendanceStatus;
  recordedAt: string;
  syllabusId?: string;
};

type ErrorEnvelope = { error?: { code?: string; message?: string; details?: unknown } };

export class TosReceptionAttendanceApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/tos-learning/${path}`, {
    cache: "no-store",
    ...init,
    headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
  });
  const body = (await response.json()) as T & ErrorEnvelope;
  if (!response.ok) {
    throw new TosReceptionAttendanceApiError(
      response.status,
      body.error?.code ?? "UNKNOWN",
      body.error?.message ?? "Không thể ghi nhận điểm danh.",
      body.error?.details,
    );
  }
  return body;
}

function sourcePayload(source: RosterSource): Record<string, string> {
  if (source.sourceType === "ENROLLMENT") return { basis: "RECURRING", enrollmentId: source.sourceId };
  if (source.sourceType === "RENEWAL_GRACE") return { basis: "RENEWAL_GRACE", renewalGraceAuthorizationId: source.sourceId };
  return { basis: source.basis, bookingId: source.sourceId };
}

export function canSettleFromRosterSource(source: RosterSource) {
  return ["RECURRING", "EXPLORE", "MAKE_UP", "PAID_EXTRA", "CAMPAIGN_EVENT", "RENEWAL_GRACE"].includes(source.basis);
}

export const tosReceptionAttendanceApi = {
  learningOwner: (sessionId: string) =>
    request<{ data: SessionLearningOwner | null }>(`sessions/${encodeURIComponent(sessionId)}/learning-owner`),
  settle: (input: AttendanceSettlementInput, idempotencyKey: string) => {
    const body: Record<string, unknown> = {
      studentProfileId: input.studentProfileId,
      sessionId: input.sessionId,
      ...sourcePayload(input.source),
      attendanceStatus: input.attendanceStatus,
      recordedAt: input.recordedAt,
    };
    if (input.attendanceStatus === "PRESENT" && input.syllabusId) body.diary = { syllabusId: input.syllabusId };
    return request<{ data: unknown }>("participation/settle", {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify(body),
    });
  },
};
