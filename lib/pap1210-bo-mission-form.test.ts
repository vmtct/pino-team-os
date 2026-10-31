import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssignmentFields, assignmentFormError, emptyAssignmentDraft } from "../app/bo/missions/AssignmentFields";

const center = "01900000-0000-7000-8000-000000000001";
const render = (mode: "create" | "edit" | "cancel") => renderToStaticMarkup(createElement(AssignmentFields, {
  centerId: center, mode, value: emptyAssignmentDraft, setValue: () => {}, disabled: false,
  target: { studentId: "01900000-0000-7000-8000-000000000002", missionName: "Đường nét", status: "ASSIGNED" },
}));
test("PAP-1210: shared form uses source-backed Student+ACTIVE Mission selectors, not canonical ID text fields", () => {
  const html = render("create");
  assert.match(html, /Tìm học viên trong Center/);
  assert.match(html, /Mission ACTIVE/);
  assert.match(html, /<select/);
  assert.doesNotMatch(html, /Student ID|Mission ID|input[^>]+value="0190/);
  assert.match(html, /v25-form-fields/);
  assert.match(html, /v25-form-field/);
});
test("PAP-1210: edit limits to context, Cancel uses explicit reason; actions remain TDD-owned", () => {
  const edit = render("edit"), cancel = render("cancel");
  assert.match(edit, /Chỉ sửa bối cảnh/);
  assert.doesNotMatch(edit, /<select/);
  assert.match(cancel, /Lý do hủy/);
  assert.match(cancel, /giữ lại bản ghi lịch sử/);
  assert.doesNotMatch(cancel, /<button/);
});
test("PAP-1210: client-side validation denies missing source selection and empty Cancel reason", () => {
  assert.match(assignmentFormError("create", emptyAssignmentDraft) ?? "", /Chọn học viên/);
  assert.match(assignmentFormError("cancel", emptyAssignmentDraft) ?? "", /Lý do/);
  assert.equal(assignmentFormError("create", { ...emptyAssignmentDraft,
    studentId: "01900000-0000-7000-8000-000000000002",
    missionId: "01900000-0000-7000-8000-000000000003" }), null);
  assert.match(assignmentFormError("edit", { ...emptyAssignmentDraft,
    contextLabel: "x".repeat(201) }) ?? "", /200/);
});
