import type { AttendanceStatus, RosterSource } from "./tos-learning-api";

export interface StudentVisit {
  id: string;
  studentProfileId: string;
  centerId: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  checkInReason: string | null;
  checkoutReason: string | null;
  version: number;
}

export interface SessionLearningOwner {
  sessionId: string;
  staffMemberId: string;
  assignedAt: string;
  version: number;
}

type ErrorEnvelope = { error?: { code?: string; message?: string; details?: unknown } };
export class TosDayOfLearningApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) { super(message); }
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/tos-learning/${path}`, {
    cache: "no-store",
    ...init,
    headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
  });
  const body = await response.json() as T & ErrorEnvelope;
  if (!response.ok) throw new TosDayOfLearningApiError(
    response.status,
    body.error?.code ?? "UNKNOWN",
    body.error?.message ?? "Không thể hoàn tất thao tác lớp học.",
    body.error?.details,
  );
  return body;
}

function sourcePayload(source: RosterSource): Record<string, string> {
  if (source.sourceType === "ENROLLMENT") return { basis: "RECURRING", enrollmentId: source.sourceId };
  if (source.sourceType === "RENEWAL_GRACE") return { basis: "RENEWAL_GRACE", renewalGraceAuthorizationId: source.sourceId };
  return { basis: source.basis, bookingId: source.sourceId };
}

export function canSettleSource(source: RosterSource) {
  return ["RECURRING", "EXPLORE", "MAKE_UP", "PAID_EXTRA", "CAMPAIGN_EVENT", "RENEWAL_GRACE"].includes(source.basis);
}
export const tosDayOfLearningApi = {
  learningOwner: (sessionId: string) =>
    request<{ data: { sessionId: string; owner: SessionLearningOwner | null } }>(`sessions/${encodeURIComponent(sessionId)}/learning-owner`),
  openVisit: (studentId: string, centerId: string) =>
    request<{ data: StudentVisit | null }>(`students/${encodeURIComponent(studentId)}/visits/open?centerId=${encodeURIComponent(centerId)}`),
  checkIn: (studentId: string, centerId: string, reason?: string) =>
    request<{ data: StudentVisit }>(`students/${encodeURIComponent(studentId)}/visits/open`, {
      method: "POST",
      body: JSON.stringify({ centerId, checkedInAt: new Date().toISOString(), ...(reason ? { reason } : {}) }),
    }),
  checkOut: (visit: StudentVisit, reason: string) =>
    request<{ data: StudentVisit }>(`visits/${encodeURIComponent(visit.id)}/check-out`, {
      method: "POST",
      body: JSON.stringify({ checkedOutAt: new Date().toISOString(), expectedVersion: visit.version, reason }),
    }),
  settle: (input: {
    studentProfileId: string;
    sessionId: string;
    source: RosterSource;
    attendanceStatus: AttendanceStatus;
    syllabusId?: string;
    learningNote?: string;
    observation?: string;
  }, idempotencyKey: string) => {
    const body: Record<string, unknown> = {
      studentProfileId: input.studentProfileId,
      sessionId: input.sessionId,
      ...sourcePayload(input.source),
      attendanceStatus: input.attendanceStatus,
      recordedAt: new Date().toISOString(),
    };
    if (input.attendanceStatus === "PRESENT" && input.syllabusId) body.diary = {
      syllabusId: input.syllabusId,
      ...(input.learningNote?.trim() ? { learningNote: input.learningNote.trim() } : {}),
      ...(input.observation?.trim() ? { observation: input.observation.trim() } : {}),
    };
    return request<{ data: unknown }>("participation/settle", {
      method: "POST", headers: { "idempotency-key": idempotencyKey }, body: JSON.stringify(body),
    });
  },
  correctAttendance: (input: {
    attendanceId: string;
    attendanceVersion: number;
    diaryVersion: number | null;
    nextStatus: AttendanceStatus;
    syllabusId?: string;
    learningNote?: string;
    observation?: string;
    reason: string;
  }, idempotencyKey: string) => {
    const body: Record<string, unknown> = {
      status: input.nextStatus,
      expectedAttendanceVersion: input.attendanceVersion,
      reason: input.reason,
    };
    if (input.diaryVersion) body.expectedDiaryVersion = input.diaryVersion;
    if (input.nextStatus === "PRESENT" && input.syllabusId) body.diary = {
      syllabusId: input.syllabusId,
      ...(input.learningNote?.trim() ? { learningNote: input.learningNote.trim() } : {}),
      ...(input.observation?.trim() ? { observation: input.observation.trim() } : {}),
    };
    return request<{ data: unknown }>(`attendances/${encodeURIComponent(input.attendanceId)}/correct`, {
      method: "POST", headers: { "idempotency-key": idempotencyKey }, body: JSON.stringify(body),
    });
  },
  openStudioDay: (centerId: string, localDate: string) =>
    request<{ data: { centerId: string; localDate: string; claims: OpenStudioDayClaim[] } }>(`open-studio/day?centerId=${encodeURIComponent(centerId)}&localDate=${encodeURIComponent(localDate)}`),
  settleOpenStudioOwner: (input: { claimId: string; attendanceStatus: AttendanceStatus; syllabusId?: string; learningNote?: string; observation?: string }, idempotencyKey: string) => {
    const body: Record<string, unknown> = { attendanceStatus: input.attendanceStatus, recordedAt: new Date().toISOString() };
    if (input.attendanceStatus === "PRESENT" && input.syllabusId) body.diary = {
      syllabusId: input.syllabusId,
      ...(input.learningNote?.trim() ? { learningNote: input.learningNote.trim() } : {}),
      ...(input.observation?.trim() ? { observation: input.observation.trim() } : {}),
    };
    return request<{ data: unknown }>(`open-studio/claims/${encodeURIComponent(input.claimId)}/outcome`, {
      method: "POST", headers: { "idempotency-key": idempotencyKey }, body: JSON.stringify(body),
    });
  },
};

export interface OpenStudioDayClaim {
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
