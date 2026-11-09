import test from "node:test";
import assert from "node:assert/strict";
import { parentDefinition, parentQuery, parentFields } from "@/app/bo/parents/schema";

test("PAP-1755 FSG4: Drawer has one shared Dsa section with exactly eight primary visible fields", () => {
  assert.equal(parentDefinition.drawer.density, "one-column");
  assert.equal(parentDefinition.drawer.sections.length, 1);
  assert.equal(parentDefinition.drawer.sections[0].label, "Thông tin chính");
  assert.deepEqual(parentDefinition.drawer.sections.flatMap(section => [...section.fields]), parentQuery.visible);
});

test("PAP-1755 FSG4: Detail splits main and audit properties per approved i5 prototype without dropping any visible field", () => {
  assert.deepEqual(parentDefinition.detail.overview.sections.map(section => [section.id, section.label]), [
    ["overview", "Thông tin chính"],
    ["system", "Thông tin hệ thống"],
  ]);
  assert.deepEqual([...parentDefinition.detail.overview.sections[0].fields], [
    "name", "maskedContact", "studentCount", "centers",
  ]);
  assert.deepEqual([...parentDefinition.detail.overview.sections[1].fields], [
    "createdAt", "createdBy", "updatedAt", "updatedBy",
  ]);
  assert.deepEqual(parentDefinition.detail.overview.sections.flatMap(section => [...section.fields]), parentQuery.visible);
  assert.equal(parentFields.find(field => field.key === "createdAt")?.type, "datetime");
  assert.equal(parentFields.find(field => field.key === "updatedAt")?.type, "datetime");
});

test("PAP-1755 FSG4: no additional hidden Table fields in approved Drawer/Detail visible grid", () => {
  const visible = new Set(parentDefinition.detail.overview.sections.flatMap(section => section.fields as readonly string[]));
  for (const key of ["id", "attention"]) {
    assert.ok(!visible.has(key), key);
    assert.ok(parentQuery.order.includes(key as (typeof parentQuery.order)[number]), "hidden Table field remains defined");
  }
  assert.equal(parentDefinition.detail.businessTabs.length, 2, "current Students and Contacts tabs unchanged");
  assert.equal(parentDefinition.detail.history.kind, "unavailable", "audit authorization still handled by dedicated history provider");
});