import assert from "node:assert/strict";
import { test } from "node:test";
import type { BoLearnerLifecycle } from "./bo-model";
import { studentSubscriptionRows } from "./bo-student-subscription-rows";

function fixture(items: { id: string; owner: string; lifecycle?: string }[]): BoLearnerLifecycle {
  return {
    student: { id: "student-A", displayName: "Học viên A" },
    subscriptions: items.map(({ id, owner, lifecycle }) => ({
      subscription: {
        id, studentProfileId: owner, pathDisplayName: "ART " + id,
        lifecycle: lifecycle ?? "ACTIVE", weeklyCommitment: 2, effectiveAvailableUnits: 12,
        serviceStartsOn: "2026-10-01", contractualEndsOn: null, commercialReference: null,
      },
      enrollments: [],
    })),
  } as unknown as BoLearnerLifecycle;
}

test("Student relation filters foreign subscription IDs while including historical records", () => {
  const rows = studentSubscriptionRows(fixture([
    { id: "a1", owner: "student-A" },
    { id: "b1", owner: "student-B" },
    { id: "a2", owner: "student-A", lifecycle: "CANCELLED" },
  ]), "student-A");
  assert.deepEqual(rows.map(x => x.id), ["a1", "a2"]);
  assert.equal(rows[1].status, "CANCELLED");
  assert.equal(rows[0].name, "Học viên A");
});

test("Student relation rejects a mismatched lifecycle identity", () => {
  assert.throws(() => studentSubscriptionRows(fixture([]), "student-B"), /không khớp/);
});

test("Student relation rejects duplicated subscription IDs", () => {
  assert.throws(() => studentSubscriptionRows(fixture([
    { id: "same", owner: "student-A" }, { id: "same", owner: "student-A" },
  ]), "student-A"), /trùng/);
});
