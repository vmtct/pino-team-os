import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../app/ho/pinoria/starter-sets/HoStarterSets.tsx", import.meta.url), "utf8");
test("PAP-2117: View and Create use the same canonical read-only property groups", () => {
  assert.doesNotMatch(source, /<BoQuickView/);
  const view = source.split('{mode==="view"&&selected&&<DrawerFrame')[1]?.split("</DrawerFrame>")[0];
  const create = source.split('{mode==="create"&&canManage&&<DrawerFrame')[1]?.split("</DrawerFrame>")[0];
  assert.ok(view && create);
  assert.ok(view.includes('path="Pinoria · Starter Set"'));
  assert.ok(view.includes('fields={fields} record={toRow(selected)} sections={sections} variant="drawer"'));
  assert.doesNotMatch(view, /createFields=|canEdit=|onEdit=/);
  assert.ok(view.includes('id="full-detail"'));
  assert.ok(view.includes("starterDetailUrl(window.location.href,selected.id)"));
  assert.ok(view.includes("<Preview"));
  assert.ok(create.includes('fields={fields} record={toDraftRow(draft)} sections={sections} variant="drawer"'));
});
test("PAP-2117: opaque actor IDs are not displayed as audit names; explicit history remains", () => {
  assert.ok(source.includes('createdBy:"—",updatedBy:"—"'));
  assert.doesNotMatch(source, /createdBy:r.createdByUserId|updatedBy:r.updatedByUserId/);
  assert.ok(source.includes("<td>{h.actorUserId}</td>"));
});