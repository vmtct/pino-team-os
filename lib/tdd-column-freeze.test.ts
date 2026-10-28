import test from "node:test";
import assert from "node:assert/strict";
import { frozenPrefix, normalizeFreezeBoundary } from "./tdd-column-freeze";
test("PAP-1105: visible frozen prefix is contiguous and uses measured offsets", () => {
  const order = ["name","count","status","date"];
  const widths = { name: 225, count: 130, status: 150, date: 180 };
  assert.deepEqual(frozenPrefix(order,"status",widths,37,1024), [
    {key:"name",left:37},{key:"count",left:262},{key:"status",left:392},
  ]);
  assert.deepEqual(frozenPrefix(order,"status",widths,37,390), [{key:"name",left:37}]);
  assert.deepEqual(frozenPrefix(order,null,widths,37,1024), [{key:"name",left:37}]);
});
test("PAP-1105: disappearing or hidden freeze boundary is cleared", () => {
  assert.equal(normalizeFreezeBoundary("status",["name","count","status"],["name","count"]),null);
  assert.equal(normalizeFreezeBoundary("name",["name","count"],["name","count"]),null);
  assert.equal(normalizeFreezeBoundary("count",["name","count"],["name","count"]),"count");
  assert.equal(normalizeFreezeBoundary("private",["name","count"],["name","count"]),null);
});
