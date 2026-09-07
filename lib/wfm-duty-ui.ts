import type { StaffDutyObligation } from "./workforce-api";

const TITLES: Record<string, string> = {
  SHIFT_BRIEFING_ACKNOWLEDGEMENT: "Đọc briefing trước ca",
  SHIFT_ASSIGNMENT_ACKNOWLEDGEMENT: "Xác nhận phân công ca",
  START_OF_SHIFT_READINESS: "Hoàn tất readiness đầu ca",
  LEARNING_SESSION_ATTENDANCE_SETTLEMENT: "Hoàn tất điểm danh lớp",
  CLASSROOM_DIARY_COMPLETION: "Hoàn tất Classroom Diary",
  WORK_SUBMISSION: "Hoàn tất work submission",
  CLEANUP_EVIDENCE: "Bổ sung cleanup evidence",
  INCIDENT_HANDOFF: "Hoàn tất incident handoff",
  SHIFT_HANDOFF_NOTE: "Hoàn tất shift handoff",
};

export function dutyTitle(duty: StaffDutyObligation) { return TITLES[duty.type] ?? duty.type.replaceAll("_", " "); }
export function dutyIsResolved(duty: StaffDutyObligation) { return duty.status === "SATISFIED" || duty.status === "WAIVED"; }
export function dutyIsOverdue(duty: StaffDutyObligation, now = Date.now()) {
  return !dutyIsResolved(duty) && Boolean(duty.dueAt) && Date.parse(duty.dueAt!) < now;
}

export function dutySourceLabel(duty: StaffDutyObligation) {
  if (duty.sourceDomain === "LEARNING") return "Learning";
  if (duty.sourceDomain === "WORKFORCE") return "Workforce";
  return duty.sourceDomain;
}

export function dutyDeepLink(duty: StaffDutyObligation) {
  const session = duty.sourceRef.match(/^session:([^:]+):(attendance|diary)$/);
  if (duty.sourceDomain === "LEARNING" && session) return `/classroom?sessionId=${encodeURIComponent(session[1]!)}&focus=${session[2]}`;
  if (duty.type === "SHIFT_BRIEFING_ACKNOWLEDGEMENT") return "/check-in?briefing=1";
  if (duty.type === "SHIFT_ASSIGNMENT_ACKNOWLEDGEMENT") return "/schedule";
  if (duty.sourceDomain === "WORKFORCE") return "/dashboard";
  return null;
}

export function dutyStatusLabel(duty: StaffDutyObligation, now = Date.now()) {
  if (duty.status === "SATISFIED") return "Đã xong";
  if (duty.status === "WAIVED") return "Đã waive";
  if (duty.status === "BLOCKED") return "Bị chặn";
  if (dutyIsOverdue(duty, now)) return "Quá hạn";
  return "Cần làm";
}

export function sourceRefSummary(sourceRef: string) {
  const session = sourceRef.match(/^session:([^:]+):(attendance|diary)$/);
  return session ? `Session ${session[1]!.slice(0, 8)}` : sourceRef;
}
