export type BoDutyExceptionStatus = "REQUESTED" | "APPROVED";

export interface BoDutyExceptionRecord {
  id: string;
  timekeepingSessionId: string;
  staffMemberId: string;
  centerId: string;
  reason: string;
  obligationRefs: string[];
  obligationSetHash: string;
  status: BoDutyExceptionStatus;
  requestedAt: string;
  requestedByUserId: string;
  approvedAt: string | null;
  approvedByUserId: string | null;
  approvalProofRef: string | null;
  version: number;
}

export interface BoDutyExceptionReview {
  exception: BoDutyExceptionRecord;
  staff: { id: string; displayLabel: string };
  center: { id: string; displayName: string };
  session: { id: string; status: "OPEN" | "CLOSED"; workDate: string; checkInAt: string; checkOutAt: string | null };
  shift: { displayLabel: string; startLocalTime: string; endLocalTime: string } | null;
}
