import assert from "node:assert/strict";
import test from "node:test";
import { staffProfileDraftDirty, staffProfileDraftErrors } from "./bo-staff-profile-edit";

const original = { displayLabel: "Hằng", email: "hang@example.test", mobile: "", department: "School", roleLabel: "Ops", employmentType: "", startDate: "2026-01-02" };

test("PAP-783 compares only editable Staff fields", () => {
  assert.equal(staffProfileDraftDirty(original, { ...original }), false);
  assert.equal(staffProfileDraftDirty(original, { ...original, displayLabel: "Hằng M." }), true);
  assert.equal(staffProfileDraftDirty(original, { ...original, department: "Growth" }), true);
});

test("PAP-783 validates display name", () => {
  assert.deepEqual(staffProfileDraftErrors({ ...original, displayLabel: "   " }), ["Tên hiển thị là bắt buộc."]);
  assert.deepEqual(staffProfileDraftErrors({ ...original, displayLabel: "x".repeat(201) }), ["Tên hiển thị quá dài."]);
  assert.deepEqual(staffProfileDraftErrors(original), []);
});

test("PAP-783 validates optional email", () => {
  assert.deepEqual(staffProfileDraftErrors({ ...original, email: "" }), []);
  assert.deepEqual(staffProfileDraftErrors({ ...original, email: "bad@" }), ["Email hồ sơ không hợp lệ."]);
});

test("PAP-783 rejects impossible calendar dates", () => {
  assert.deepEqual(staffProfileDraftErrors({ ...original, startDate: "2026-02-30" }), ["Ngày bắt đầu không hợp lệ."]);
  assert.deepEqual(staffProfileDraftErrors({ ...original, startDate: "" }), []);
});
