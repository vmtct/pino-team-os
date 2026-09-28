import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import type { BoWorkforceAssignment, BoWorkforceTeachingSession } from "./bo-model";
import { assignmentTimeSummary, canUseTeachingSessionTime, learningOwnerBlocksShiftCancellation, normalizeTimeBasis } from "./workforce-planning-time-basis";

test("WFTB planner enables class-time only for Teacher-only plans", () => {
  assert.equal(canUseTeachingSessionTime({frontDesk:false,teacherSessionCount:1}), true);
  assert.equal(canUseTeachingSessionTime({frontDesk:true,teacherSessionCount:1}), false);
  assert.equal(canUseTeachingSessionTime({frontDesk:false,teacherSessionCount:0}), false);
  assert.equal(normalizeTimeBasis("TEACHING_SESSIONS",{frontDesk:true,teacherSessionCount:1}), "SHIFT_TEMPLATE");
  assert.equal(normalizeTimeBasis("TEACHING_SESSIONS",{frontDesk:false,teacherSessionCount:1}), "TEACHING_SESSIONS");
});

test("WFTB weekly summary shows exact class windows and reconciliation state", () => {
  const assignment:BoWorkforceAssignment={
    id:"a",staffMemberId:"s",centerId:"c",workDate:"2026-10-06",shiftTemplateId:"t",
    timeBasis:"TEACHING_SESSIONS",termWeekId:null,status:"ACTIVE",assignedByUserId:"u",assignedAt:"",
    cancelledByUserId:null,cancelledAt:null,cancellationReason:null,replacesAssignmentId:null,createdAt:"",updatedAt:"",
    effectiveWork:{
      assignmentId:"a",timeBasis:"TEACHING_SESSIONS",
      windows:[
        {startsLocal:"2026-10-06T18:00",endsLocal:"2026-10-06T19:30",sourceType:"SESSION",sourceIds:["s1"]},
        {startsLocal:"2026-10-06T20:00",endsLocal:"2026-10-06T21:00",sourceType:"SESSION",sourceIds:["s2"]},
      ],
      reconciliationRequired:false,
    },
  };
  assert.equal(assignmentTimeSummary(assignment),"Theo giờ lớp · 18:00–19:30, 20:00–21:00");
  assignment.effectiveWork!.reconciliationRequired=true;
  assignment.effectiveWork!.windows=[];
  assert.equal(assignmentTimeSummary(assignment),"Theo giờ lớp · Cần xử lý");
});

test("WFTB planner renders explicit Theo ca / Theo giờ lớp controls", async () => {
  const source=await readFile("app/bo/workforce/WorkforcePlanningView.tsx","utf8");
  assert.match(source,/Giờ làm/);
  assert.match(source,/Theo ca/);
  assert.match(source,/Theo giờ lớp/);
  assert.match(source,/timeBasis: normalizedTimeBasis/);
});

test("WFTB cancelled Learning Owner Session does not block assignment cancellation", async () => {
  const scheduled={status:"SCHEDULED",learningOwner:{staffMemberId:"staff-1"}} as unknown as BoWorkforceTeachingSession;
  const cancelled={status:"CANCELLED",learningOwner:{staffMemberId:"staff-1"}} as unknown as BoWorkforceTeachingSession;
  assert.equal(learningOwnerBlocksShiftCancellation(scheduled,"staff-1"),true);
  assert.equal(learningOwnerBlocksShiftCancellation(cancelled,"staff-1"),false);
  const source=await readFile("app/bo/workforce/WorkforcePlanningView.tsx","utf8");
  assert.match(source,/learningOwnerBlocksShiftCancellation/);
  assert.match(source,/disabled=\{!reason\.trim\(\) \|\| hasOwnerRole \|\| !!busy\}/);
});
