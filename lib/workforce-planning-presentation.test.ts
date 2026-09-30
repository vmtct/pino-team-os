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
  assert.match(source, /canonical assignment audit/);
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


test("WFM-PLAN BO uses Workforce bootstrap and governed ShiftTemplate administration", async () => {
  const source = await read("app/bo/workforce/WorkforcePlanningView.tsx");
  assert.match(source, /workforcePlanningBootstrap/);
  assert.doesNotMatch(source, /f3DeliveryApi|delivery\/bootstrap-state/);
  assert.match(source, /\+ Tạo ca/);
  assert.match(source, /createWorkforceShiftTemplate/);
  assert.match(source, /setWorkforceShiftTemplateStatus/);
  assert.match(source, /workforce\.shift_template\.manage/);
  assert.match(source, /Template đã dùng không sửa giờ trực tiếp/);
});


test("JCS04 BO exposes governed availability history and operator void only through planning edit authority", async () => {
  const source = await read("app/bo/workforce/WorkforcePlanningView.tsx");
  assert.match(source, /availabilityHistory/);
  assert.match(source, /canEditPlanning/);
  assert.match(source, /voidWorkforceAvailability/);
  assert.match(source, /Void availability/);
  assert.match(source, /history được giữ nguyên và không còn dùng làm planning input/);
  assert.doesNotMatch(source, /deleteWorkforceAvailability|reopenAvailability/);
});

test("WSRA BO plans FD/Teacher exact Session and derives primary owner authority", async () => {
  const [source, model] = await Promise.all([
    read("app/bo/workforce/WorkforcePlanningView.tsx"),
    read("lib/bo-model.ts"),
  ]);
  assert.match(source, /Front Desk/);
  assert.match(source, /> Teacher</);
  assert.match(source, /Phụ trách chính/);
  assert.match(source, /planOperationalWorkforceShift/);
  assert.match(source, /sessionId/);
  assert.match(source, /runningClassDisplayName/);
  assert.match(source, /disabled=\{!session\.canAssignLearningOwner\}/);
  assert.match(source, /Lý do bàn giao/);
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

  const source = await read("app/bo/workforce/WorkforcePlanningView.tsx");
  assert.match(source, /assignmentRoleSummary/);
  assert.match(source, /Owner chưa link TE/);
  assert.match(source, /Chưa có TE\/ca tương ứng/);
});
