import assert from "node:assert/strict";
import test from "node:test";
import type { BoAccessUser, BoStaffRecord } from "./bo-model";
import { buildStaffQuickPeekModel } from "./bo-staff-quick-peek";

test("PAP-781 quick peek allowlists only five operational facts", () => {
  const staff = {
    id: "staff-01",
    displayLabel: "Staff Example",
    status: "active",
    department: "Art",
    roleLabel: "Teacher",
    salary: "PAY_SECRET_DO_NOT_DISPLAY",
    governmentId: "GOV_ID_SECRET_DO_NOT_DISPLAY",
    bank: "BANK_SECRET_DO_NOT_DISPLAY",
  } as unknown as BoStaffRecord;
  const access = {
    status: "suspended",
    email: "EMAIL_SECRET_DO_NOT_DISPLAY",
    temporaryPassword: "PASSWORD_SECRET_DO_NOT_DISPLAY",
    assignments: [],
  } as unknown as BoAccessUser;
  const model = buildStaffQuickPeekModel(staff, access, "Access suspended");
  assert.deepEqual(model.facts.map((item) => item.label), ["Staff", "Access", "Department", "Role label", "Attention"]);
  assert.deepEqual(model.facts.map((item) => item.value), ["active", "suspended", "Art", "Teacher", "Access suspended"]);
  const serialized = JSON.stringify(model);
  for (const secret of ["PAY_SECRET", "GOV_ID_SECRET", "BANK_SECRET", "EMAIL_SECRET", "PASSWORD_SECRET"]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
});

test("PAP-781 quick peek does not imply an Access account when it has not been provisioned", () => {
  const staff = { id: "staff-02", displayLabel: "New Staff", status: "active" } as BoStaffRecord;
  const model = buildStaffQuickPeekModel(staff, null, "No Access");
  assert.equal(model.displayLabel, "New Staff");
  assert.equal(model.facts.find((item) => item.label === "Access")?.value, "Not provisioned");
  assert.equal(model.facts.find((item) => item.label === "Attention")?.value, "No Access");
});

test("PAP-781 quick peek permits loading without leaking an unrelated selected person", () => {
  const model = buildStaffQuickPeekModel(null, null, "Loading", "staff-pending");
  assert.equal(model.staffId, "staff-pending");
  assert.equal(model.displayLabel, "Đang tải Staff...");
  assert.equal(model.facts.find((item) => item.label === "Staff")?.value, "Loading");
});
