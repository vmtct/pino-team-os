import test from "node:test";
import assert from "node:assert/strict";
import { REVIEWED_ENROLLMENT_PLAN, REVIEWED_ENROLLMENT_UNRESOLVED } from "./f4-reviewed-enrollment-plan";

test("reviewed Enrollment plan keeps exactly 31 deterministic subscriptions and 62 recurring seats", () => {
  assert.equal(REVIEWED_ENROLLMENT_PLAN.length, 31);
  assert.equal(REVIEWED_ENROLLMENT_PLAN.reduce((sum, item) => sum + item.placements.length, 0), 62);
  assert.equal(REVIEWED_ENROLLMENT_UNRESOLVED.length, 2);
  assert.equal(new Set(REVIEWED_ENROLLMENT_PLAN.map((item) => item.subscriptionId)).size, 31);
  assert.equal(new Set(REVIEWED_ENROLLMENT_UNRESOLVED.map((item) => item.subscriptionId)).size, 2);
});

test("reviewed plan cadence is explicit and double-session exceptions stay outside the write set", () => {
  const placed = new Set(REVIEWED_ENROLLMENT_PLAN.map((item) => item.subscriptionId));
  for (const item of REVIEWED_ENROLLMENT_PLAN) {
    assert.equal(item.placements.length, item.expectedWeeklyCommitment);
    assert.equal(new Set(item.placements.map((placement) => placement.weekdayIso)).size, item.placements.length);
  }
  for (const item of REVIEWED_ENROLLMENT_UNRESOLVED) {
    assert.equal(item.expectedWeeklyCommitment, 2);
    assert.equal(item.reason, "DOUBLE_SESSION_ASSIGNMENT_MODEL_GAP");
    assert.equal(placed.has(item.subscriptionId), false);
  }
});
