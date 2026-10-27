import assert from "node:assert/strict";
import { test } from "node:test";
import type { BoLearnerLifecycle } from "./bo-model";
import { studentSubscriptionRows, studentSubscriptionTableState } from "./bo-student-subscription-rows";
import { tableRows, type BoField } from "./bo-registration";

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

test("student detail embedded grid starts with date, hides learner, defaults newest first", () => {
  const fields: BoField[] = [
    { key: "name", label: "Học viên", type: "text", icon: "Aa", w: 150 },
    { key: "id", label: "ID", type: "id", icon: "#", w: 125 },
    { key: "start", label: "Ngày bắt đầu", type: "date", icon: "▦", w: 140 },
    { key: "path", label: "Path", type: "text", icon: "Aa", w: 160 },
  ];
  const state = studentSubscriptionTableState(fields);
  assert.equal(state.order[0], "start");
  assert.equal(state.visible.includes("name"), false);
  assert.equal(state.sort, "start");
  assert.equal(state.desc, true);
  const rows = tableRows([
    { id: "older", name: "Student A", start: "2026-01-10" },
    { id: "latest", name: "Student A", start: "2026-10-01" },
    { id: "middle", name: "Student A", start: "2026-06-05" },
  ], fields, state);
  assert.deepEqual(rows.map(row => row.id), ["latest", "middle", "older"]);
});