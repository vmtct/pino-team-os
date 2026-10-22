import test from "node:test";
import assert from "node:assert/strict";
import { filterRunningClassGridRows, runningClassFilterFields } from "./bo-running-classes-typed-filter";
import type { RunningClassGridRow } from "./bo-running-classes-grid";

const rows = [
  { item: { id: "one", operationalName: "Art Alpha", status: "ACTIVE" }, programName: "Art", patternLabel: "Mon", capacityLabel: "8" },
  { item: { id: "two", operationalName: "Piano Beta", status: "INACTIVE" }, programName: "Piano", patternLabel: "Tue", capacityLabel: "4" },
] as RunningClassGridRow[];
const settings = (field: string, value: string) => ({ visibleKeys: runningClassFilterFields.map((f) => f.key), group: { combinator: "and" as const, filters: [{ field, operator: "contains" as const, value }] } });

test("Classes typed filter maps canonical row fields without mutating input", () => {
  assert.deepEqual(filterRunningClassGridRows(rows, settings("program", "piano")).map((r) => r.item.id), ["two"]);
  assert.deepEqual(filterRunningClassGridRows(rows, settings("status", "active")).map((r) => r.item.id), ["one", "two"]);
  assert.deepEqual(filterRunningClassGridRows(rows, settings("id", "one")).map((r) => r.item.id), ["one"]);
  assert.equal(rows.length, 2);
});
