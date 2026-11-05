import assert from "node:assert/strict";
import { test } from "node:test";
import { STAFFS_VIEWS, staffsViewRows } from "../app/bo/components/registration/BoStaffsViews";
import type { BoRecord } from "./bo-registration";

const records: BoRecord[] = [
  { id: "staff-active", name: "Demo active", status: "active" },
  { id: "staff-inactive", name: "Demo inactive", status: "inactive" },
  { id: "staff-other", name: "Demo pending", status: "PENDING" },
];

test("PAP-1407: Staffs uses exactly four built-in TDD views", () => {
  assert.deepEqual(STAFFS_VIEWS.map(view => view.key), ["all", "register", "active", "deactivated"]);
});

test("PAP-1407: All/Active/Deactivated show only intended status projections", () => {
  assert.deepEqual(staffsViewRows(records, "all").map(row => row.id), [
    "staff-active", "staff-inactive",
  ]);
  assert.deepEqual(staffsViewRows(records, "active").map(row => row.id), ["staff-active"]);
  assert.deepEqual(staffsViewRows(records, "deactivated").map(row => row.id), ["staff-inactive"]);
});

test("PAP-1407: Registration never falls back to the global Staff directory", () => {
  assert.deepEqual(staffsViewRows(records, "register"), []);
  assert.deepEqual(staffsViewRows([{ id: "forged", name: "PII", status: "PENDING" }], "register"), []);
});

test("PAP-1407: Staff filters do not mutate the authorized source snapshot", () => {
  const snapshot = structuredClone(records);
  const rows = staffsViewRows(records, "active");
  rows.push({ id: "not-source", name: "new", status: "active" });
  assert.deepEqual(records, snapshot);
});
