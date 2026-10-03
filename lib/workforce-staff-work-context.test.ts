import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  activeAssignments,
  availabilityRegistrationWeeks,
  assignmentTime,
  assignmentsInWeek,
  compactWorkDate,
  nextAssignment,
  staffInitials,
  workDateParts,
} from "./workforce-staff-work-context";
import type { Assignment, WorkforceContext } from "./workforce-api";

const shift = { code: "EVENING_PA", displayLabel: "Ca tối PA", startLocalTime: "17:30", endLocalTime: "21:00" };
const assignment = (id: string, workDate: string, start = "17:30"): Assignment => ({
  id, centerId: "center-1", workDate, shiftTemplateId: "shift-1", termWeekId: "week-1", status: "ACTIVE",
  shift: { ...shift, startLocalTime: start },
});

test("TOSCTX-001 renders deterministic Vietnamese DOW/date and assignment time", () => {
  assert.deepEqual(workDateParts("2026-09-28"), { weekday: "T2", day: "28", month: "09" });
  assert.equal(compactWorkDate("2026-09-27"), "CN, 27/09");
  assert.equal(assignmentTime(assignment("a", "2026-09-28")), "17:30–21:00");
});

test("TOSCTX-003 derives weekly count and next shift without changing assignment authority", () => {
  const week = { id:"w", termId:"t", centerId:"center-1", code:"W1", ordinal:1, startDate:"2026-09-28", endDate:"2026-10-04" } satisfies WorkforceContext["termWeeks"][number];
  const rows = [assignment("late","2026-10-02","18:00"), assignment("first","2026-09-28","17:30"), assignment("older","2026-09-27","17:30")];
  assert.equal(assignmentsInWeek(rows, week).length, 2);
  assert.equal(nextAssignment(rows, "2026-09-28")?.id, "first");
  assert.equal(staffInitials("Nguyễn Văn An"), "NA");
});

test("TOSCTX-006 availability registration uses only Core-open TermWeeks and never infers current/next week", () => {
  const context: WorkforceContext = {
    userId:"user",staffMemberId:"staff",email:"staff@pino.invalid",
    centers:[{id:"center-1",key:"pino",displayName:"PINO",timeZone:"Asia/Ho_Chi_Minh"}],
    termWeeks:[
      {id:"w05",termId:"term",centerId:"center-1",code:"05",ordinal:5,startDate:"2026-09-28",endDate:"2026-10-04"},
      {id:"w06",termId:"term",centerId:"center-1",code:"06",ordinal:6,startDate:"2026-10-05",endDate:"2026-10-11"},
      {id:"w07",termId:"term",centerId:"center-1",code:"07",ordinal:7,startDate:"2026-10-12",endDate:"2026-10-18"},
    ],
  };
  assert.deepEqual(availabilityRegistrationWeeks(context,"center-1",["w07","w06"]).map((week)=>week.id),["w06","w07"]);
  assert.deepEqual(availabilityRegistrationWeeks(context,"center-1",[]),[]);
});

test("TOSCTX-001/002 Today, Schedule and Check-in use human date and hide raw shift code", async () => {
  const source = await readFile("app/components/WorkforceWorkspace.tsx", "utf8");
  assert.match(source, /workDateParts\(row\.workDate\)/);
  assert.match(source, /compactWorkDate\(state\.assignment\.workDate\)/);
  assert.match(source, /assignmentTime\(row\)/);
  assert.doesNotMatch(source, /row\.shift\.code/);
});

test("TOSCTX-005 cancelled assignments leave operational schedule and background refresh is wired", async () => {
  const rows = [assignment("active", "2026-09-28"), { ...assignment("cancelled", "2026-09-29"), status: "CANCELLED" }];
  assert.deepEqual(activeAssignments(rows).map((row) => row.id), ["active"]);
  const source = await readFile("app/components/WorkforceWorkspace.tsx", "utf8");
  assert.match(source, /activeAssignments\(assignments\)/);
  assert.match(source, /setInterval\(\(\) => \{ void refreshSchedule\(\); \}, 30_000\)/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /window\.addEventListener\("focus", onFocus\)/);
});

test("TOSCTX-004 profile is read-only by default and edit keeps existing PATCH contract", async () => {
  const source = await readFile("app/components/WorkforceWorkspace.tsx", "utf8");
  assert.match(source, /Công việc/);
  assert.match(source, /Ca kế tiếp/);
  assert.match(source, /Chỉnh sửa/);
  assert.match(source, /profile\.status\.toLowerCase\(\) === "active"/);
  assert.match(source, /Xem lịch của tôi/);
  assert.match(source, /editing \? <div className="grid">/);
  assert.match(source, /workforceApi\.updateProfile\(\{ email, mobile, legalAddress \}\)/);
});
