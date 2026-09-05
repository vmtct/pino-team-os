import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { StaffDutyObligation } from "./workforce-api";
import { dutyDeepLink, dutyIsOverdue, dutyStatusLabel, dutyTitle } from "./wfm-duty-ui";

function duty(overrides: Partial<StaffDutyObligation> = {}): StaffDutyObligation {
  return {
    obligationId: "session:abc:attendance",
    action: "TIMED_MILESTONE",
    kind: "SETTLEMENT",
    type: "LEARNING_SESSION_ATTENDANCE_SETTLEMENT",
    sourceDomain: "LEARNING",
    sourceRef: "session:abc:attendance",
    status: "PENDING",
    blocking: false,
    requiredBy: "LEARNING_OWNER",
    requiredAt: "2026-09-05T10:00:00.000Z",
    dueAt: "2026-09-05T10:10:00.000Z",
    ...overrides,
  };
}

test("WFM-DUTY presentation maps canonical source refs to owning surfaces", () => {
  assert.equal(dutyTitle(duty()), "Hoàn tất điểm danh lớp");
  assert.equal(dutyDeepLink(duty()), "/classroom?sessionId=abc&focus=attendance");
  assert.equal(dutyDeepLink(duty({ type: "CLASSROOM_DIARY_COMPLETION", sourceRef: "session:def:diary", kind: "SUBMISSION" })), "/classroom?sessionId=def&focus=diary");
});

test("WFM-DUTY overdue status is derived from Core timing without local completion truth", () => {
  const value = duty();
  assert.equal(dutyIsOverdue(value, Date.parse("2026-09-05T10:11:00.000Z")), true);
  assert.equal(dutyStatusLabel(value, Date.parse("2026-09-05T10:11:00.000Z")), "Quá hạn");
  assert.equal(dutyIsOverdue(duty({ status: "SATISFIED" }), Date.parse("2026-09-05T10:11:00.000Z")), false);
});

test("TOS Duty Board stays projection-only and deep-links Classroom by exact Session", async () => {
  const board = await readFile("app/tasks/DutyBoardView.tsx", "utf8");
  const classroom = await readFile("app/classroom/page.tsx", "utf8");
  assert.match(board, /workforceApi\.dutyBoard/);
  assert.match(board, /Completion không được tick tại đây/);
  assert.doesNotMatch(board, /localStorage|sessionStorage|markComplete|toggleComplete/);
  assert.match(classroom, /initialSessionId/);
});
