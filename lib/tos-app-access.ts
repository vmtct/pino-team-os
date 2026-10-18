import type { Assignment } from "./workforce-api";

export type TosAppId = "shift" | "reception" | "station" | "shift-lead" | "classroom";

/** Client presentation only. The Core endpoint remains the mutation authority. */
export function resolveTosAppAccess(input: {
  assignments: Assignment[];
  centerId: string | null;
  today: string;
  nowLocal: string;
  desktop: boolean;
  scheduleReady: boolean;
}): Record<TosAppId, boolean> {
  const todayAssignments = input.scheduleReady && input.centerId
    ? input.assignments.filter((row) =>
      row.centerId === input.centerId && row.status === "ACTIVE" && row.workDate === input.today && Boolean(row.shift) && (row.workDate + "T" + row.shift!.startLocalTime.slice(0,5)) <= input.nowLocal && input.nowLocal < (row.workDate + "T" + row.shift!.endLocalTime.slice(0,5)))
    : [];
  const roles = new Set(todayAssignments.flatMap((row) => row.roleAssignments ?? [])
    .filter((role) => role.targetId && (
      (role.roleType === "TEACHER" && role.targetType === "SESSION") ||
      ((role.roleType === "FRONT_DESK" || role.roleType === "SHIFT_LEADER") &&
        role.targetType === "CENTER" && role.targetId === input.centerId)
    )).map((role) => role.roleType));
  return {
    shift: true,
    reception: roles.has("FRONT_DESK"),
    station: input.desktop,
    "shift-lead": roles.has("SHIFT_LEADER"),
    classroom: roles.has("TEACHER"),
  };
}
