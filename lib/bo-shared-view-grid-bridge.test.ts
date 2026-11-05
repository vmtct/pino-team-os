import assert from "node:assert/strict";
import test from "node:test";
import { defaultBoViewConfig } from "./bo-public-view-state";
import { fromSharedViewConfig, toSharedViewConfig } from "./bo-shared-view-grid-bridge";
import { runningClassFilterFields, filterRunningClassGridRows } from "./bo-running-classes-typed-filter";
import { BO_STUDENT_PILOT_FIELDS } from "./bo-student-pilot-fields";
import type { BoFilterSettings } from "./bo-filter-settings-state";

const classKeys = runningClassFilterFields.map((x) => x.key);
const sortKeys = ["class", "program", "pattern", "capacity", "status"];

test("Gate A: Shared View roundtrips class filters, sort, column order and visibility", () => {
  const typed: BoFilterSettings = {
    group: { combinator: "or", filters: [
      { field: "class", operator: "contains", value: "Chroma" },
      { field: "status", operator: "not_equals", value: "ARCHIVED" },
    ] }, visibleKeys: ["program", "class", "id"],
  };
  const next = toSharedViewConfig(defaultBoViewConfig(classKeys), typed, "Piano", "class", "desc",
    ["program", "class", "id", "pattern", "capacity", "status"]);
  assert.deepEqual(next.filters.map((x) => x.operator), ["contains", "is_not"]);
  const readback = fromSharedViewConfig(next, runningClassFilterFields, sortKeys);
  assert.deepEqual(readback.typed, typed);
  assert.equal(readback.sortKey, "class");
  assert.equal(readback.sortDirection, "desc");
  assert.equal(readback.search, "Piano");
  assert.deepEqual(readback.order.slice(0, 3), ["program", "class", "id"]);
});

test("Gate A: unsupported backend semantics fail closed, not partial filters", () => {
  const base = defaultBoViewConfig(classKeys);
  assert.throws(() => fromSharedViewConfig({ ...base, groupBy: "status" }, runningClassFilterFields, sortKeys), /nhóm dữ liệu/);
  assert.throws(() => fromSharedViewConfig({ ...base, filters: [{ field: "capacity", operator: "gte", value: 3 }] }, runningClassFilterFields, sortKeys), /bộ lọc/);
  assert.throws(() => fromSharedViewConfig({ ...base, sort: { field: "id", direction: "asc" } }, runningClassFilterFields, sortKeys), /sắp xếp/);
});

test("Gate A: Students ID is allowed as a configurable, public table field", () => {
  assert.ok(BO_STUDENT_PILOT_FIELDS.some((f) => f.key === "id" && f.filterable));
  const initial = defaultBoViewConfig(BO_STUDENT_PILOT_FIELDS.map((f) => f.key));
  assert.ok(fromSharedViewConfig(initial, BO_STUDENT_PILOT_FIELDS, ["name"]).typed.visibleKeys.includes("id"));
});

test("Gate A: Class domain filters match exactly once before pagination", () => {
  const row = {
    item: { id: "test-class", operationalName: "Chroma Sea", status: "ACTIVE" },
    programName: "PianoHouse", patternLabel: "Mon 18:00", capacityLabel: "3",
  };
  for (const [field, value] of [["class", "Chroma"], ["program", "Piano"], ["status", "ACTIVE"], ["id", "test-class"]]) {
    const typed: BoFilterSettings = { group: { combinator: "and", filters: [{ field, operator: "contains", value }] },
      visibleKeys: classKeys };
    assert.equal(filterRunningClassGridRows([row] as never[], typed).length, 1, field);
  }
});
