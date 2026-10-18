import type { Assignment } from "./workforce-api";

export type TosAppId = "shift" | "reception" | "station" | "shift-lead" | "classroom";

function nextDate(value: string): string {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** A missing/ambiguous time window never grants role access. */
export function assignmentActiveNow(row: Assignment, nowLocal: string): boolean {
  if (row.status !== "ACTIVE" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(nowLocal)) return false;
  const windows = row.effectiveWork?.windows;
  if (windows?.length) {
    return windows.some(window =>
      window.startsLocal.slice(0, 16) <= nowLocal && nowLocal < window.endsLocal.slice(0, 16));
  }
  if (row.effectiveStartLocal && row.effectiveEndLocal) {
    return row.effectiveStartLocal.slice(0, 16) <= nowLocal &&
      nowLocal < row.effectiveEndLocal.slice(0, 16);
  }
  if (!row.shift?.startLocalTime || !row.shift.endLocalTime) return false;
  const start = row.workDate + "T" + row.shift.startLocalTime.slice(0, 5);
  const endClock = row.shift.endLocalTime.slice(0, 5);
  const end = (endClock <= row.shift.startLocalTime.slice(0, 5)
    ? nextDate(row.workDate) : row.workDate) + "T" + endClock;
  return start <= nowLocal && nowLocal < end;
}

/** Presentation only. Core endpoints enforce authorization for each action. */
export function resolveTosAppAccess(input: {
  assignments: Assignment[];
  centerId: string | null;
  nowLocal: string;
  desktop: boolean;
  scheduleReady: boolean;
}): Record<TosAppId, boolean> {
  const roles = new Set(input.scheduleReady && input.centerId
    ? input.assignments
      .filter(row => row.centerId === input.centerId && assignmentActiveNow(row, input.nowLocal))
      .flatMap(row => row.roleAssignments ?? [])
      .filter(role => role.targetId && (
        (role.roleType === "TEACHER" && role.targetType === "SESSION") ||
        ((role.roleType === "FRONT_DESK" || role.roleType === "SHIFT_LEADER") &&
          role.targetType === "CENTER" && role.targetId === input.centerId)))
      .map(role => role.roleType)
    : []);
  return {
    shift: true,
    reception: roles.has("FRONT_DESK"),
    station: input.desktop,
    "shift-lead": roles.has("SHIFT_LEADER"),
    classroom: roles.has("TEACHER"),
  };
}
