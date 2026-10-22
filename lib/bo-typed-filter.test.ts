import assert from "node:assert/strict";
import test from "node:test";
import { matchesBoTypedFilter, matchesBoTypedFilterGroup } from "./bo-typed-filter";

test("typed filters support positive/negative contains and case insensitive equality", () => {
  const row = { name: "Nguyễn An", status: "ACTIVE", age: 10 };
  assert.equal(matchesBoTypedFilter(row, { field: "name", operator: "contains", value: "an" }), true);
  assert.equal(matchesBoTypedFilter(row, { field: "name", operator: "not_contains", value: "XYZ" }), true);
  assert.equal(matchesBoTypedFilter(row, { field: "status", operator: "equals", value: "active" }), true);
  assert.equal(matchesBoTypedFilter(row, { field: "age", operator: "not_equals", value: "12" }), true);
});
test("missing property fails closed, including negative filters", () => {
  assert.equal(matchesBoTypedFilter({}, { field: "private", operator: "not_contains", value: "x" }), false);
  assert.equal(matchesBoTypedFilter({}, { field: "private", operator: "is_empty" }), false);
  assert.equal(matchesBoTypedFilter({ value: null }, { field: "value", operator: "is_empty" }), true);
});
test("groups use AND/OR semantics, empty groups do not narrow results", () => {
  const row = { name: "Mori", active: true };
  const filters = [{ field: "name", operator: "contains" as const, value: "ori" }, { field: "active", operator: "equals" as const, value: "false" }];
  assert.equal(matchesBoTypedFilterGroup(row, { combinator: "and", filters }), false);
  assert.equal(matchesBoTypedFilterGroup(row, { combinator: "or", filters }), true);
  assert.equal(matchesBoTypedFilterGroup(row, { combinator: "and", filters: [] }), true);
});
