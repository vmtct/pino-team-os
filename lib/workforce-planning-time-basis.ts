import type { BoWorkforceAssignment, BoWorkforceTeachingSession } from "./bo-model";

export type WorkforceShiftTimeBasis = "SHIFT_TEMPLATE" | "TEACHING_SESSIONS";
export type WorkforceShiftCoverageMode = "FULL_SHIFT" | "CLASSROOM_TIME" | "CUSTOM_RANGE";

export function canUseTeachingSessionTime(input:{frontDesk:boolean;teacherSessionCount:number}):boolean {
  return !input.frontDesk && input.teacherSessionCount > 0;
}

// Legacy compatibility for callers that still send timeBasis. New Manager UI sends coverageMode.
export function normalizeTimeBasis(requested:WorkforceShiftTimeBasis,input:{frontDesk:boolean;teacherSessionCount:number}):WorkforceShiftTimeBasis {
  return requested === "TEACHING_SESSIONS" && canUseTeachingSessionTime(input) ? "TEACHING_SESSIONS" : "SHIFT_TEMPLATE";
}

export function assignmentTimeSummary(assignment:BoWorkforceAssignment):string {
  const mode=assignment.coverageMode ?? (assignment.timeBasis === "TEACHING_SESSIONS" ? "CLASSROOM_TIME" : "FULL_SHIFT");
  if(assignment.effectiveWork?.reconciliationRequired)return mode === "CLASSROOM_TIME" ? "Theo giờ lớp · Cần xử lý" : "Cần xử lý";
  const windows=assignment.effectiveWork?.windows ?? [];
  const range=windows.length ? windows.map(window=>`${window.startsLocal.slice(11,16)}–${window.endsLocal.slice(11,16)}`).join(", ") : null;
  if(mode === "CUSTOM_RANGE")return range ? `Tuỳ chỉnh · ${range}` : "Tuỳ chỉnh";
  if(mode === "CLASSROOM_TIME")return range ? `Theo giờ lớp · ${range}` : "Theo giờ lớp";
  return range ? `Toàn ca · ${range}` : "Toàn ca";
}

export function learningOwnerBlocksShiftCancellation(session:BoWorkforceTeachingSession|undefined,assignmentStaffMemberId:string):boolean {
  return Boolean(session && session.status !== "CANCELLED" && session.learningOwner?.staffMemberId === assignmentStaffMemberId);
}
