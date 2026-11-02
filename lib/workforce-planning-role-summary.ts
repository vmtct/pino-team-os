import type { BoWorkforceAssignment, BoWorkforceWeeklyPlanning } from "./bo-model";

export function assignmentRoleSummary(data: BoWorkforceWeeklyPlanning, assignment: BoWorkforceAssignment): string {
  const roles = data.roleAssignments.filter((role) =>
    role.shiftAssignmentId === assignment.id && role.status === "ACTIVE"
  );
  const runningRoles = (data.runningClassResponsibilities ?? []).filter((role) => role.shiftAssignmentId === assignment.id && role.status === "ACTIVE");
  if (!roles.length && !runningRoles.length) return "Chưa phân công vai trò";

  const parts: string[] = [];
  if (roles.some((role) => role.roleType === "FRONT_DESK")) parts.push("FD");
  if (roles.some((role) => role.roleType === "SHIFT_LEADER")) parts.push("Shift Leader");
  const teachers = roles.filter((role) => role.roleType === "TEACHER");
  if (teachers.length === 1) {
    const session = data.sessions.find((item) => item.id === teachers[0]!.targetId);
    parts.push(`TE · ${session?.runningClassDisplayName ?? "Session"}`);
  } else if (teachers.length > 1) {
    parts.push(`TE ×${teachers.length}`);
  }
  const classTeachers = runningRoles.filter((role) => role.roleType === "TEACHER");
  const classAssistants = runningRoles.filter((role) => role.roleType === "TEACHING_ASSISTANT");
  if (classTeachers.length) parts.push(`TE · RunningClass ×${classTeachers.length}`);
  if (classAssistants.length) parts.push(`TA · RunningClass ×${classAssistants.length}`);
  return parts.join(" · ");
}

export function hasOwnerTeacherLinkGap(data: BoWorkforceWeeklyPlanning, staffMemberId: string, workDate: string): boolean {
  return data.sessions.some((session) => {
    if (session.localDate !== workDate || session.learningOwner?.staffMemberId !== staffMemberId) return false;
    return !data.roleAssignments.some((role) => {
      if (role.status !== "ACTIVE" || role.roleType !== "TEACHER" || role.targetId !== session.id) return false;
      const assignment = data.assignments.find((item) =>
        item.id === role.shiftAssignmentId && item.status === "ACTIVE"
      );
      return assignment?.staffMemberId === staffMemberId && assignment.workDate === workDate;
    });
  });
}
