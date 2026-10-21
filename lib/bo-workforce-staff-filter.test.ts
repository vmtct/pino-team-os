import assert from "node:assert/strict";
import test from "node:test";
import { filterWorkforceStaff } from "./bo-workforce-staff-filter";

const staff = [{ id: "alpha", displayLabel: "Staff A" }, { id: "beta", displayLabel: "Staff B" }];
test("PAP-787 Staff deep link filters only the given scoped planning projection", () => {
  assert.deepEqual(filterWorkforceStaff(staff, "alpha"), [staff[0]]);
  assert.deepEqual(filterWorkforceStaff(staff, "outside"), []);
  assert.deepEqual(filterWorkforceStaff(staff, ""), staff);
});
