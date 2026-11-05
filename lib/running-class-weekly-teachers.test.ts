import test from "node:test";
import assert from "node:assert/strict";
import type { BoWorkforceWeeklyPlanning } from "./bo-model";
import { runningClassWeeklyTeachers } from "./running-class-weekly-teachers";

test("PAP-893 shows only active class responsibilities backed by active shifts, sorted by date", () => {
  const planning = {
    staff: [{ id: "staff-1", displayLabel: "Teacher A" }],
    assignments: [
      { id: "shift-1", staffMemberId: "staff-1", workDate: "2026-10-24", status: "ACTIVE" },
      { id: "shift-2", staffMemberId: "staff-2", workDate: "2026-10-23", status: "ACTIVE" },
      { id: "shift-3", staffMemberId: "staff-1", workDate: "2026-10-22", status: "CANCELLED" },
    ],
    runningClassResponsibilities: [
      { id: "r1", shiftAssignmentId: "shift-1", runningClassId: "class-1", roleType: "TEACHER", status: "ACTIVE" },
      { id: "r2", shiftAssignmentId: "shift-2", runningClassId: "class-1", roleType: "TEACHING_ASSISTANT", status: "ACTIVE" },
      { id: "r3", shiftAssignmentId: "shift-3", runningClassId: "class-1", roleType: "TEACHER", status: "ACTIVE" },
      { id: "r4", shiftAssignmentId: "shift-1", runningClassId: "class-2", roleType: "TEACHER", status: "ACTIVE" },
      { id: "r5", shiftAssignmentId: "shift-1", runningClassId: "class-1", roleType: "TEACHER", status: "CANCELLED" },
    ],
  } as unknown as BoWorkforceWeeklyPlanning;
  assert.deepEqual(runningClassWeeklyTeachers(planning, "class-1").map(({ id, date, name }) => ({ id, date, name })), [
    { id: "r2", date: "2026-10-23", name: "staff-2" },
    { id: "r1", date: "2026-10-24", name: "Teacher A" },
  ]);
  assert.deepEqual(runningClassWeeklyTeachers({ ...planning, runningClassResponsibilities: undefined }, "class-1"), []);
});
