import assert from "node:assert/strict";
import test from "node:test";
import { workforceWeekDisplayLabel } from "./workforce-week-display";

test("PAP-1216: ShiftPlan presentation label preserves week code and actual dates", () => {
  assert.equal(workforceWeekDisplayLabel("pap901-bo-workforce-20261027-W3 · 2026-11-30 → 2026-12-06"), "W3 · 30/11–06/12/2026");
  assert.equal(workforceWeekDisplayLabel("2026-11-30 → 2026-12-06"), "30/11–06/12/2026");
  assert.equal(workforceWeekDisplayLabel("Term week without dates"), "Term week without dates");
});
