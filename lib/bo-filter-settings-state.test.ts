import assert from "node:assert/strict";
import test from "node:test";
import { applyBoFilterSettings, validateBoFilterSettings, type BoFilterField } from "./bo-filter-settings-state";

const fields: readonly BoFilterField[] = [
  { key: "name", type: "text", filterable: true },
  { key: "salary", type: "number", filterable: false },
  { key: "active", type: "boolean", filterable: true },
];
const row = { name: "Mori", salary: 100, active: true };
test("settings filter allowed visible fields and preserve source", () => {
  const settings = { group: { combinator: "and" as const, filters: [{ field: "name", operator: "contains" as const, value: "or" }] }, visibleKeys: ["name"] };
  assert.equal(validateBoFilterSettings(settings, fields), true);
  assert.deepEqual(applyBoFilterSettings([row], settings, fields), [row]);
});
test("unmapped, nonfilterable and malformed settings fail closed", () => {
  for (const filter of [
    { field: "salary", operator: "equals" as const, value: "100" },
    { field: "missing", operator: "not_equals" as const, value: "x" },
    { field: "active", operator: "equals" as const, value: "yes" },
  ]) {
    const settings = { group: { combinator: "and" as const, filters: [filter] }, visibleKeys: ["name"] };
    assert.equal(validateBoFilterSettings(settings, fields), false);
    assert.deepEqual(applyBoFilterSettings([row], settings, fields), []);
  }
});
test("duplicate and unknown visible keys rejected", () => {
  const group = { combinator: "or" as const, filters: [] };
  assert.equal(validateBoFilterSettings({ group, visibleKeys: ["name", "name"] }, fields), false);
  assert.equal(validateBoFilterSettings({ group, visibleKeys: ["private"] }, fields), false);
});