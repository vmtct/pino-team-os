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

test("Classes typed filters support conjunction, exact status, and no-match results", () => {
  const exact = (field: string, value: string) => ({ field, operator: "equals" as const, value });
  const filter = (filters: ReturnType<typeof exact>[]) => ({
    visibleKeys: runningClassFilterFields.map((field) => field.key),
    group: { combinator: "and" as const, filters },
  });
  assert.deepEqual(filterRunningClassGridRows(rows, filter([exact("status", "ACTIVE")])).map((row) => row.item.id), ["one"]);
  assert.deepEqual(filterRunningClassGridRows(rows, filter([exact("program", "Piano"), exact("status", "INACTIVE")])).map((row) => row.item.id), ["two"]);
  assert.deepEqual(filterRunningClassGridRows(rows, filter([exact("program", "Piano"), exact("status", "ACTIVE")])).map((row) => row.item.id), []);
  assert.deepEqual(filterRunningClassGridRows(rows, filter([])).map((row) => row.item.id), ["one", "two"]);
});
