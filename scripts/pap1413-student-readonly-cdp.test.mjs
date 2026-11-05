// PAP-1413 / PAP-1365 — test-only read-only CDP admission and result classification.
import test from "node:test";
import assert from "node:assert/strict";
import { validateAdmission, classifyReadSmoke } from "./pap1413-student-readonly-cdp.mjs";

test("requires explicit opt-in and rejects CI", () => {
  assert.match(validateAdmission({})[0], /opt-in/);
  assert.deepEqual(validateAdmission({ PAP1413_READ_ONLY: "1", CI: "true" }), ["Authenticated local CDP must not run in CI"]);
});

test("only admits fixed Manager CDP port and BO Staging route", () => {
  assert.deepEqual(validateAdmission({ PAP1413_READ_ONLY: "1" }), []);
  assert.deepEqual(validateAdmission({ PAP1413_READ_ONLY: "1", PAP1413_CDP_URL: "http://127.0.0.1:9337" }), ["Only i5 localhost Manager CDP 9335 allowed"]);
  assert.deepEqual(validateAdmission({ PAP1413_READ_ONLY: "1", PAP1413_BO_URL: "https://bo.pinohouse.art" }), ["Only fixed BO Staging origin/route allowed"]);
  assert.deepEqual(validateAdmission({ PAP1413_READ_ONLY: "1", PAP1413_CENTER_NAME: "not-authorized" }), ["Unexpected Center; no fallback or guessed Center"]);
});

test("a selected Center with Student, Drawer and Detail is READ_SMOKE only", () => {
  assert.deepEqual(classifyReadSmoke({ centerSelected: true, studentRows: 8, quickView: true, fullDetail: true, editControls: 0 }), { outcome: "PASS", reason: "READ_ONLY_TABLE_DRAWER_DETAIL" });
});

test("fails closed for missing authorized Center or Student fixture", () => {
  assert.equal(classifyReadSmoke({ centerSelected: false }).reason, "AUTHORIZED_CENTER_NOT_SELECTED");
  assert.equal(classifyReadSmoke({ centerSelected: true, studentRows: 0 }).outcome, "BLOCKED");
});

test("does not report PASS for broken Drawer or Detail", () => {
  assert.deepEqual(classifyReadSmoke({ centerSelected: true, studentRows: 1, quickView: false }), { outcome: "FAIL", reason: "STUDENT_QUICK_VIEW_NOT_OPEN" });
  assert.deepEqual(classifyReadSmoke({ centerSelected: true, studentRows: 1, quickView: true, fullDetail: false }), { outcome: "FAIL", reason: "STUDENT_DETAIL_NOT_OPEN" });
});

test("new Manager edit controls invalidate old baseline without mutating data", () => {
  assert.deepEqual(classifyReadSmoke({ centerSelected: true, studentRows: 1, quickView: true, fullDetail: true, editControls: 2 }), { outcome: "BLOCKED", reason: "PROFILE_EDIT_PERMISSION_CONTRACT_CHANGED" });
});
