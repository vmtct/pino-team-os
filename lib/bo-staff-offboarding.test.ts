import test from "node:test";
import assert from "node:assert/strict";
import { offboardStaff } from "./bo-staff-offboarding";

test("offboarding suspends Access before deactivating Staff", async () => {
  const calls: string[] = [];
  const result = await offboardStaff(
    { staffActive: true, accessActive: true },
    "Employment ended",
    {
      async suspendAccess(reason) { calls.push(`access:${reason}`); },
      async deactivateStaff() { calls.push("staff:inactive"); },
    },
  );

  assert.deepEqual(calls, ["access:Employment ended", "staff:inactive"]);
  assert.deepEqual(result, { accessSuspended: true, staffDeactivated: true });
});

test("offboarding stops before Staff mutation when Access suspension fails", async () => {
  const calls: string[] = [];
  await assert.rejects(
    offboardStaff(
      { staffActive: true, accessActive: true },
      "Employment ended",
      {
        async suspendAccess() { calls.push("access"); throw new Error("Access command failed"); },
        async deactivateStaff() { calls.push("staff"); },
      },
    ),
    /Access command failed/,
  );
  assert.deepEqual(calls, ["access"]);
});

test("offboarding reports safe partial completion when Staff deactivation fails", async () => {
  await assert.rejects(
    offboardStaff(
      { staffActive: true, accessActive: true },
      "Employment ended",
      {
        async suspendAccess() {},
        async deactivateStaff() { throw new Error("Staff command failed"); },
      },
    ),
    /Access đã suspended nhưng Staff chưa deactivate: Staff command failed/,
  );
});

test("offboarding can finish an already-inactive Staff with active Access", async () => {
  const calls: string[] = [];
  const result = await offboardStaff(
    { staffActive: false, accessActive: true },
    "Finish offboarding",
    {
      async suspendAccess() { calls.push("access"); },
      async deactivateStaff() { calls.push("staff"); },
    },
  );
  assert.deepEqual(calls, ["access"]);
  assert.deepEqual(result, { accessSuspended: true, staffDeactivated: true });
});

test("offboarding requires a reason only when Access is active", async () => {
  await assert.rejects(
    offboardStaff(
      { staffActive: true, accessActive: true },
      "   ",
      { async suspendAccess() {}, async deactivateStaff() {} },
    ),
    /Cần lý do/,
  );

  let deactivated = false;
  await offboardStaff(
    { staffActive: true, accessActive: false },
    "",
    { async suspendAccess() {}, async deactivateStaff() { deactivated = true; } },
  );
  assert.equal(deactivated, true);
});
