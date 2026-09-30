import type { BoWorkforceAssignment, BoWorkforceTeachingSession } from "./bo-model";

export type WorkforceShiftTimeBasis = "SHIFT_TEMPLATE" | "TEACHING_SESSIONS";

export function canUseTeachingSessionTime(input:{frontDesk:boolean;teacherSessionCount:number}):boolean {
  return !input.frontDesk && input.teacherSessionCount > 0;
}

export function normalizeTimeBasis(
  requested: WorkforceShiftTimeBasis,
  input:{frontDesk:boolean;teacherSessionCount:number},
):WorkforceShiftTimeBasis {
  return requested === "TEACHING_SESSIONS" && canUseTeachingSessionTime(input)
    ? "TEACHING_SESSIONS"
    : "SHIFT_TEMPLATE";
}

export function assignmentTimeSummary(assignment:BoWorkforceAssignment):string {
  if (assignment.timeBasis !== "TEACHING_SESSIONS") return "Theo ca";
  if (assignment.effectiveWork?.reconciliationRequired) return "Theo giờ lớp · Cần xử lý";
  const windows = assignment.effectiveWork?.windows ?? [];
  if (!windows.length) return "Theo giờ lớp";
  return `Theo giờ lớp · ${windows.map((window)=>`${window.startsLocal.slice(11,16)}–${window.endsLocal.slice(11,16)}`).join(", ")}`;
}

export function learningOwnerBlocksShiftCancellation(
  session: BoWorkforceTeachingSession | undefined,
  assignmentStaffMemberId: string,
): boolean {
  return Boolean(
    session
    && session.status !== "CANCELLED"
    && session.learningOwner?.staffMemberId === assignmentStaffMemberId
  );
}
