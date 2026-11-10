import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoStudentCreate } from "../app/bo/components/registration/BoStudentCreate";

const src = () => readFile(new URL("../app/bo/components/registration/BoStudentCreate.tsx", import.meta.url), "utf8");

test("PAP-1767 Student CREATE uses the exact BoQuickView view shell, common PropertySections and BoTypedEditor", async () => {
  const source = await src();
  assert.match(source, /<BoQuickView moduleKey="students" module=\{studentModule\} record=\{null\}/);
  assert.match(source, /create=\{\{/);
  assert.match(source, /editorField: field =>/);
  assert.match(source, /<PropertySections variant="drawer"/);
  assert.doesNotMatch(source, /<DrawerFrame|<aside|className="drawer-scrim|<div className="property-row"/);
  assert.doesNotMatch(source, /TddRegistry|TddRenderer|createBoTddAdapter/);
});

test("PAP-1767 retains Core Intake, Parent selection freshness and uncertain-state idempotency", async () => {
  const source = await src();
  for (const token of [
    "boApi.createStudentIntake(currentAttempt.body, currentAttempt.idempotencyKey)",
    "attemptRef.current = currentAttempt", "crypto.randomUUID()", "existingParentUserId: selectedParentId!",
    "Chọn phụ huynh hiện có", "Tạo phụ huynh mới", "guardianDisplayName",
    "contactType", "contactValue", "canResetAttempt", "uncertainAttempt",
    "Thử lại cùng yêu cầu", "Sửa dữ liệu", "setSelectedParentId(null)",
  ]) assert.ok(source.includes(token), "missing " + token);
});

test("PAP-1767 shared View/Create Drawer renders typed editable Student fields and bounded Parent search", () => {
  const html = renderToStaticMarkup(React.createElement(BoStudentCreate, {
    onClose: () => {}, onCreated: () => {},
  }));
  assert.match(html, /id="drawer"/);
  assert.match(html, /data-tdd-shell="drawer"/);
  assert.match(html, /data-tdd-properties="drawer"/);
  for (const field of ["name","birthDate","relationshipType","parentMode","parentQuery","selectedParentId"]) {
    assert.ok(html.includes('data-tdd-field="' + field + '"'), "missing row " + field);
  }
  assert.match(html, /aria-label="Sửa Học viên"/);
  assert.match(html, /aria-label="Sửa Ngày sinh"/);
  assert.match(html, /Chọn phụ huynh hiện có/);
  assert.match(html, /Tạo phụ huynh mới/);
  assert.match(html, /id="create-save"/);
  assert.equal((html.match(/id="drawer"/g) || []).length, 1);
});
