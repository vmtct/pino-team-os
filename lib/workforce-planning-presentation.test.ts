import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { BoWorkforceWeeklyPlanning } from "./bo-model";
import { assignmentRoleSummary, hasOwnerTeacherLinkGap } from "./workforce-planning-role-summary";

const read = (path: string) => readFile(path, "utf8");

test("WFM-PLAN TOS availability keeps submission distinct from final assignment", async () => {
  const source = await read("app/components/WorkforceWorkspace.tsx");
  assert.match(source, /Đăng ký ca tuần/);
  assert.match(source, /Gửi cho Manager/);
  assert.match(source, /Đây chưa phải lịch làm việc chính thức/);
  assert.match(source, /aria-pressed=\{selected\}/);
  assert.match(source, /availability\?\.status === "SUBMITTED"/);
  assert.match(source, /workforceApi\.submitAvailability/);
  assert.doesNotMatch(source, /self-assign|assignWorkforceShift/);
  assert.match(source, /availability\?\.status === "VOIDED"/);
  assert.match(source, /Staff không thể sửa hoặc mở lại nội dung này/);
});

test("WFM-PLAN BO uses inline governed reasons instead of browser prompts", async () => {
  const source = await read("app/bo/workforce/WorkforcePlanningView.tsx");
  assert.match(source, /Xác nhận ca & phân công/);
  assert.match(source, /Lý do thay đổi/);
  assert.match(source, /lịch sử thay đổi phân công/);
  assert.match(
    source,
    /cancelWorkforceAssignment\(\s*assignment\.id,\s*cancellationReason/,
  );
  assert.match(
    source,
    /cancelWorkforceAssignment\(\s*assignment\.id,\s*correctionReason/,
  );
  assert.doesNotMatch(source, /prompt\(/);
});


test("WFM-PLAN BO uses Workforce bootstrap and leaves template CRUD to HO", async () => {
  const source = await read("app/bo/workforce/WorkforcePlanningView.tsx");
  assert.match(source, /workforcePlanningBootstrap/);
  assert.match(source, /Tuần này đã bị khóa từ Head Office/);
  assert.match(source, /globalWeekLocked/);
  assert.match(source, /Chốt xếp ca/);
  assert.match(source, /Mở khóa xếp ca/);
  assert.doesNotMatch(source, /createWorkforceShiftTemplate|setWorkforceShiftTemplateStatus|\+ Tạo ca/);
});

test("JCS04 BO exposes governed availability history and operator void only through planning edit authority", async () => {
  const source = await read("app/bo/workforce/WorkforcePlanningView.tsx");
  assert.match(source, /availabilityHistory/);
  assert.match(source, /canEditPlanning/);
  assert.match(source, /voidWorkforceAvailability/);
  assert.match(source, /Hủy đăng ký ca/);
  assert.match(source, /history được giữ nguyên và không còn dùng làm planning input/);
  assert.doesNotMatch(source, /deleteWorkforceAvailability|reopenAvailability/);
});

test("PAP-1113 BO plans independent RunningClass roles and retains only historical Learning Owner read guards", async () => {
  const [source, model] = await Promise.all([
    read("app/bo/workforce/WorkforcePlanningView.tsx"),
    read("lib/bo-model.ts"),
  ]);
  assert.match(source, /Tiếp tân/);
  assert.match(source, /> Giáo viên</);
  assert.match(source, /> Trợ giảng</);
  assert.match(source, /checked=\{shiftLeader\}/);
  assert.match(source, /checked=\{teacherSelected\}/);
  assert.match(source, /checked=\{assistantSelected\}/);
  assert.match(source, /buildIndependentRoleCommands/);
  assert.match(source, /planOperationalWorkforceShift/);
  assert.match(source, /eligibleShiftRunningClasses/);
  assert.match(source, /canUseTeachingSessionTime/);
  assert.doesNotMatch(source, /makeLearningOwner:/);
  assert.doesNotMatch(source, /learningOwnerHandoffReason:/);
  assert.match(source, /hasOwnerRole/);
  assert.match(source, /School → Classes → Sessions/);
  assert.doesNotMatch(model, /isLearningOwner\s*:/);
});

test("WSRA weekly grid summarizes roles and exposes Learning Owner link drift", async () => {
  const assignment = { id: "shift-1", staffMemberId: "staff-1", workDate: "2026-10-06", status: "ACTIVE" };
  const data = {
    assignments: [assignment],
    roleAssignments: [
      { shiftAssignmentId: "shift-1", roleType: "FRONT_DESK", targetId: "center-1", status: "ACTIVE" },
      { shiftAssignmentId: "shift-1", roleType: "TEACHER", targetId: "session-1", status: "ACTIVE" },
    ],
    sessions: [{
      id: "session-1", localDate: "2026-10-06", runningClassDisplayName: "Piano A",
      learningOwner: { staffMemberId: "staff-1" },
    }],
  } as unknown as BoWorkforceWeeklyPlanning;

  assert.equal(assignmentRoleSummary(data, assignment as never), "FD · TE · Piano A");
  assert.equal(hasOwnerTeacherLinkGap(data, "staff-1", "2026-10-06"), false);
  data.sessions[0]!.learningOwner = { staffMemberId: "staff-2" } as never;
  assert.equal(hasOwnerTeacherLinkGap(data, "staff-2", "2026-10-06"), true);

  const calendar = await read("app/bo/components/workforce/BoWorkforceWeekPlanner.tsx");
  assert.match(calendar, /assignmentRoleSummary/);
  assert.match(calendar, /Owner chưa link TE/);
  assert.match(calendar, /Chưa có TE\/ca tương ứng/);
});
