import type { Assignment, WorkforceContext } from "@/lib/workforce-api";

const VI_WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

export function workDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return {
    weekday: VI_WEEKDAYS[date.getUTCDay()],
    day: String(day).padStart(2, "0"),
    month: String(month).padStart(2, "0"),
  };
}

export function compactWorkDate(value: string) {
  const part = workDateParts(value);
  return `${part.weekday}, ${part.day}/${part.month}`;
}

export function assignmentTime(row: Assignment) {
  const windows=row.effectiveWork?.windows ?? [];
  if(windows.length)return windows.map((window)=>`${window.startsLocal.slice(11,16)}–${window.endsLocal.slice(11,16)}`).join(", ");
  if(row.effectiveStartLocal&&row.effectiveEndLocal)return `${row.effectiveStartLocal.slice(11,16)}–${row.effectiveEndLocal.slice(11,16)}`;
  return row.shift ? `${row.shift.startLocalTime}–${row.shift.endLocalTime}` : row.status;
}

export function activeAssignments(rows: Assignment[]) {
  return rows.filter((row) => row.status === "ACTIVE");
}

export function assignmentsInWeek(rows: Assignment[], week: WorkforceContext["termWeeks"][number] | null) {
  if (!week) return [];
  return rows.filter((row) => row.workDate >= week.startDate && row.workDate <= week.endDate);
}

export function availabilityRegistrationWeeks(context: WorkforceContext, centerId: string, openWeekIds: readonly string[]) {
  const open = new Set(openWeekIds);
  return context.termWeeks
    .filter((week) => week.centerId === centerId && open.has(week.id))
    .sort((left, right) => left.startDate.localeCompare(right.startDate) || left.ordinal - right.ordinal || left.id.localeCompare(right.id));
}

export function nextAssignment(rows: Assignment[], fromDate: string) {
  return [...rows]
    .filter((row) => row.workDate >= fromDate && row.status !== "CANCELLED")
    .sort((a, b) => {
      const byDate = a.workDate.localeCompare(b.workDate);
      if (byDate) return byDate;
      return (a.shift?.startLocalTime ?? "").localeCompare(b.shift?.startLocalTime ?? "");
    })[0] ?? null;
}

export function staffInitials(displayLabel: string) {
  const words = displayLabel.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)?.[0] ?? ""}` : words[0]?.slice(0, 2) ?? "P").toUpperCase();
}

/** Presentation facts only; Core remains the authority for every action. */
export function shiftResponsibilityLabels(row: Assignment): string[] {
  if (row.status !== "ACTIVE") return [];
  const names = new Set((row.roleAssignments ?? []).filter((role) =>
    (role.targetType === "SESSION" && role.roleType === "TEACHER") ||
    (role.targetType === "RUNNING_CLASS" && (role.roleType === "TEACHER" || role.roleType === "TEACHING_ASSISTANT")) ||
    (role.targetType === "CENTER" && (role.roleType === "FRONT_DESK" || role.roleType === "SHIFT_LEADER"))
  ).map((role) => role.roleType));
  return (["FRONT_DESK", "TEACHER", "TEACHING_ASSISTANT", "SHIFT_LEADER"] as const)
    .filter((role) => names.has(role))
    .map((role) => role === "FRONT_DESK" ? "Lễ tân" : role === "TEACHER" ? "Giảng dạy" : role === "TEACHING_ASSISTANT" ? "Trợ giảng" : "Trưởng ca");
}
