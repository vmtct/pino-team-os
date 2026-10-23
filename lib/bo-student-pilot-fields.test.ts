import assert from "node:assert/strict";
import test from "node:test";
import { BO_STUDENT_PILOT_FIELDS, BO_STUDENT_PILOT_DEFAULT_COLUMNS, studentPilotFilterRow } from "./bo-student-pilot-fields";
import { applyBoFilterSettings, validateBoFilterSettings } from "./bo-filter-settings-state";
test("only canonical directory displayName and learning state are filterable", () => {
  assert.deepEqual(BO_STUDENT_PILOT_FIELDS.filter((x) => x.filterable).map((x) => x.key), ["name", "learning"]);
  assert.equal(BO_STUDENT_PILOT_DEFAULT_COLUMNS.length, 6);
  assert.deepEqual(studentPilotFilterRow({ displayName: "Mori", activeSubscriptions: 1 }), { name: "Mori", learning: "active" });
});
test("private fields cannot enter pilot settings", () => {
  assert.equal(validateBoFilterSettings({group:{combinator:"and",filters:[{field:"guardianPhone",operator:"contains",value:"09"}]},visibleKeys:["name"]},BO_STUDENT_PILOT_FIELDS),false);
});
test("Learning typed filter preserves active and inactive semantics", () => {
  const rows = [
    studentPilotFilterRow({ displayName: "Mori", activeSubscriptions: 2 }),
    studentPilotFilterRow({ displayName: "Doro", activeSubscriptions: 0 }),
  ];
  const settings = (value: string) => ({ group: { combinator: "and" as const, filters: [{ field: "learning", operator: "equals" as const, value }] }, visibleKeys: BO_STUDENT_PILOT_DEFAULT_COLUMNS });
  assert.deepEqual(applyBoFilterSettings(rows, settings("active"), BO_STUDENT_PILOT_FIELDS).map((row) => row.name), ["Mori"]);
  assert.deepEqual(applyBoFilterSettings(rows, settings("inactive"), BO_STUDENT_PILOT_FIELDS).map((row) => row.name), ["Doro"]);
});
