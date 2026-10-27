import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { STAFF_DETAIL_TABS } from "./bo-staff-detail-tabs";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const view = read("app/bo/staff/StaffManagementView.tsx");

test("PAP-792 integrated detail retains all eight canonical workspace tabs", () => {
  assert.deepEqual(STAFF_DETAIL_TABS.map(({ key }) => key), [
    "overview", "profile", "assignments", "training", "income", "access", "pinoria", "audit",
  ]);
  for (const required of [
    "StaffTrainingTab", "StaffCompensationTab", "StaffAuditTab", "staff-assignments-source",
  ]) assert.ok(view.includes(required), required);
  assert.ok(!view.includes('data-testid="staff-v2-unavailable"'), "No generic unfinished tab placeholder");
});

test("PAP-792 compensation remains explicit-reveal and selected-Staff-only", () => {
  const salary = read("app/bo/staff/StaffCompensationTab.tsx");
  assert.ok(!view.includes("boApi.staffCompensation("), "Never fetch salary in Staff shell");
  assert.match(salary, /await boApi\.staffCompensation\(requestedStaff/);
  assert.match(salary, /staffCompensationOnly\(entries, requestedStaff\)/);
  assert.match(salary, /fence\.current\.invalidate\(\)/);
  assert.match(salary, /Hiện lịch sử lương/);
});

test("PAP-792 preserves Shift Role source and Staff-filtered Workforce route", () => {
  const workforce = read("app/bo/workforce/WorkforcePlanningView.tsx");
  assert.match(view, /\/bo\/workforce\?staff=\$\{encodeURIComponent\(selectedId\)\}/);
  assert.match(workforce, /filterWorkforceStaff\(data\?\.staff \?\? \[\], staffFilterId\)/);
  assert.match(workforce, /workforce-staff-filter/);
});

test("PAP-792 Pinoria read is tab-bounded while Training uses actual Staff read-plane", () => {
  const training = read("app/bo/staff/StaffTrainingTab.tsx");
  assert.match(view, /shouldLoadStaffPinoria\(detailOnly, activeTab, selectedId\)/);
  assert.match(training, /boApi\.trainingStaffAssignments\(staffId\)/);
  assert.match(view, /activeTab === "training" && selectedId/);
});

test("PAP-792 audit does not fabricate or globally fetch an employment timeline", () => {
  const audit = read("app/bo/staff/StaffAuditTab.tsx");
  assert.match(audit, /StaffAuditTab/);
  assert.match(audit, /\/bo\/system\/audit/);
  assert.ok(!audit.includes("boApi.accessAudit("), "No global audit-event leakage in detail");
});
