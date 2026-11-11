/** PAP-1831 / Epic PAP-1665 PLT-ATTR: canonical DSA in View/Create shared Drawer. */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PropertySections } from "../app/components/workspace-renderer/Properties";
import type { BoField } from "../lib/bo-registration";

const fields = [
  { key: "displayName", label: "Tên thuộc tính", icon: "Aa", type: "text" },
  { key: "scope", label: "Phạm vi", icon: "Aa", type: "text" },
  { key: "centerId", label: "Trung tâm", icon: "Aa", type: "text" }
] as unknown as BoField[];
const record = { id: "", name: "QA", displayName: "QA", scope: "GLOBAL", centerId: "" };
const sections = [{ id: "properties", label: "Thuộc tính", fields: ["displayName", "scope", "centerId"] }];
const render = (props: Record<string, unknown> = {}) => renderToStaticMarkup(
  createElement(PropertySections, {
    fields, record, sections, variant: "drawer",
    canEdit: (field: BoField) => field.key === "displayName",
    onEdit: () => undefined,
    ...props
  } as Parameters<typeof PropertySections>[0])
);

test("PAP-1831: Drawer inline editable is the DSA v24 button with single integrated glyph, not legacy property-control", () => {
  const html = render();
  assert.match(html, /<button[^>]*class="v24-prop-value writable"[^>]*data-detail-edit="displayName"[^>]*>/);
  assert.match(html, /<span class="v24-edit-glyph" aria-hidden="true">✎<\/span><\/button>/);
  assert.doesNotMatch(html, /<button[^>]*class="property-control"/);
  assert.doesNotMatch(html, /<button[^>]*disabled=""/);
});
test("PAP-1831: readonly Drawer uses exact DSA div and lock, never inert button", () => {
  const html = render();
  assert.match(html, /<div class="v24-prop-value readonly" aria-label="Chỉ đọc Phạm vi" data-prop="scope">/);
  assert.match(html, /<div class="v24-prop-value readonly" aria-label="Chỉ đọc Trung tâm" data-prop="centerId">/);
  assert.match(html, /<span class="v24-lock" aria-hidden="true">⌁<\/span>/);
  assert.equal((html.match(/class="v24-prop-value readonly"/g) || []).length, 2);
});
test("PAP-1831: Student/Parent create controls still use shared row and exact caller-supplied input", () => {
  const html = render({
    createFields: { displayName: { id: "student-name", value: "A", onChange: () => undefined, required: true } }
  });
  assert.match(html, /id="student-name"[^>]*class="property-control os-create-select"/);
  assert.match(html, /data-tdd-create=""/);
  assert.equal((html.match(/class="v24-prop-value readonly"/g) || []).length, 2);
});
test("PAP-1831: detail renderer remains canonical and unchanged in shape", () => {
  const html = renderToStaticMarkup(createElement(PropertySections, {
    fields, record, sections, variant: "detail",
    canEdit: (field: BoField) => field.key === "displayName", onEdit: () => undefined
  }));
  assert.match(html, /class="v24-prop-value writable"/);
  assert.match(html, /class="v24-prop-value readonly"/);
});
