import type { BoWorkforceWeeklyPlanning } from "./bo-model";

/** Read-only canonical projection; never infer roles from shift names. */
export function runningClassWeeklyTeachers(planning: BoWorkforceWeeklyPlanning, runningClassId: string) {
  const assignments = new Map(planning.assignments.filter(item => item.status === "ACTIVE").map(item => [item.id, item]));
  const staff = new Map(planning.staff.map(item => [item.id, item.displayLabel]));
  return (planning.runningClassResponsibilities ?? []).filter(item => item.status === "ACTIVE" && item.runningClassId === runningClassId).flatMap(item => {
    const assignment = assignments.get(item.shiftAssignmentId);
    return assignment ? [{ id: item.id, role: item.roleType, name: staff.get(assignment.staffMemberId) ?? assignment.staffMemberId, date: assignment.workDate }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
}
