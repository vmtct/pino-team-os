import test from "node:test";
import assert from "node:assert/strict";
import { assignmentRoleSummary } from "./workforce-planning-role-summary";
import type { BoWorkforceWeeklyPlanning, BoWorkforceAssignment } from "./bo-model";

test("PAP-621 role summary includes Shift Leader and RunningClass Teacher/TA", () => {
  const assignment = { id: "assignment-1" } as BoWorkforceAssignment;
  const data = {
    roleAssignments: [{ shiftAssignmentId: "assignment-1", status: "ACTIVE", roleType: "SHIFT_LEADER" }],
    runningClassResponsibilities: [
      { shiftAssignmentId: "assignment-1", status: "ACTIVE", roleType: "TEACHER", runningClassId: "class-1" },
      { shiftAssignmentId: "assignment-1", status: "ACTIVE", roleType: "TEACHING_ASSISTANT", runningClassId: "class-2" },
      { shiftAssignmentId: "assignment-2", status: "ACTIVE", roleType: "TEACHER", runningClassId: "class-3" },
      { shiftAssignmentId: "assignment-1", status: "CANCELLED", roleType: "TEACHER", runningClassId: "class-4" },
    ],
    sessions: [],
  } as unknown as BoWorkforceWeeklyPlanning;
  assert.equal(assignmentRoleSummary(data, assignment), "Shift Leader · TE · RunningClass ×1 · TA · RunningClass ×1");
});