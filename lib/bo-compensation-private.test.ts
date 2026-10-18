import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isOperationalReadPath, isStaffCompensationPath } from "./bo-read-handler";
import { isAllowedPostPath } from "./bo-write-handler";

const staff="0199a000-0000-7000-8000-000000000001";
const entry="0199a000-0000-7000-8000-000000000002";
const privatePath="workforce/staff-records/"+staff+"/private/compensation";
const view=readFileSync(new URL("../app/bo/workforce/compensation/StaffCompensationView.tsx",import.meta.url),"utf8");

test("PAP-731 BO Core facade admits only explicit private compensation read and writes",()=>{
  assert.equal(isStaffCompensationPath(privatePath),true);
  assert.equal(isOperationalReadPath(privatePath),true);
  assert.equal(isAllowedPostPath(privatePath),true);
  assert.equal(isAllowedPostPath(privatePath+"/"+entry),true);
  assert.equal(isStaffCompensationPath("workforce/staff-records/"+staff+"/compensation"),false);
  assert.equal(isOperationalReadPath("workforce/staff-records/"+staff+"/private/compensation/"+entry),false);
  assert.equal(isStaffCompensationPath(privatePath+"/export"),false);
});

test("PAP-731 private UI uses explicit reveal, clears data, never persists salary",()=>{
  assert.match(view,/boApi\.staffRecords\(\)/);
  assert.match(view,/Hiện lịch sử lương/);
  assert.match(view,/boApi\.staffCompensation\(staffId/);
  assert.match(view,/setPrivateState\(\{status:"idle"\}\)/);
  assert.match(view,/visibilitychange/);
  assert.match(view,/BoDataGridSidePeek/);
  assert.doesNotMatch(view,/localStorage|sessionStorage|URLSearchParams/);
  const normalStaff=readFileSync(new URL("../app/bo/staff/StaffManagementView.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(normalStaff,/staffCompensation/);
});
