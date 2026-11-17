// PAP-1886 — guard the canonical drawer content against off-canvas class reuse.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../app/bo/afterschool-accounts/AfterschoolPinDrawer.tsx", import.meta.url), "utf8");
test("PAP-1886: form and receipt stay inside the canonical drawer, not a settings overlay", () => {
  assert.match(source, /<DrawerFrame\b/);
  assert.match(source, /<form id="afterschool-pin-form" onSubmit=\{submit\}/);
  assert.match(source, /<PropertySections variant="drawer"/);
  assert.match(source, /receipt \? <section className="property-section" role="status"/);
  assert.doesNotMatch(source, /className="settings-panel/);
  assert.match(source, /form="afterschool-pin-form"/);
});
test("PAP-1886: loaded, loading, empty and error states remain explicit", () => {
  for (const marker of ["Đang tải danh sách phụ huynh", "Không có phụ huynh tại cơ sở này", "Không tìm thấy phụ huynh phù hợp", "role=\"alert\""]) assert.ok(source.includes(marker));
  assert.match(source, /<select id="afterschool-parent"[^>]*required/);
  assert.match(source, /name="confirmedPhone"[^>]*required/);
  assert.match(source, /type="checkbox" required/);
  assert.match(source, /disabled=\{!selected \|\| busy\}/);
});
