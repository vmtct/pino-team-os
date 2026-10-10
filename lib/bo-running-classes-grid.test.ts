import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRunningClassGridRows, isRunningClassGridSortKey } from "./bo-running-classes-grid";
import type { F3Path, F3RunningClass } from "./f3-delivery-api";

const paths: F3Path[] = [
  { id: "path-art", code: "ART", displayName: "Art Foundation", status: "ACTIVE", version: 1 },
  { id: "path-piano", code: "PIANO", displayName: "Piano Foundation", status: "ACTIVE", version: 1 },
];

function runningClass(overrides: Partial<F3RunningClass> & Pick<F3RunningClass, "id" | "operationalName">): F3RunningClass {
  const { id, operationalName, ...rest } = overrides;
  return {
    id,
    centerId: "center-1",
    pathProgramId: "path-art",
    learningSpaceId: "space-1",
    operationalName,
    weekdayIso: 1,
    windowStartsLocal: "16:00",
    windowEndsLocal: "17:30",
    deliveryTopology: "FIXED_COHORT",
    defaultParticipationMinutes: 90,
    optimalConcurrentCapacity: 8,
    hardConcurrentCapacity: 10,
    status: "ACTIVE",
    version: 1,
    ...rest,
  };
}

const classes: F3RunningClass[] = [
  runningClass({ id: "class-b", operationalName: "B Piano", pathProgramId: "path-piano", weekdayIso: 3, optimalConcurrentCapacity: 6, hardConcurrentCapacity: null, status: "ACTIVE" }),
  runningClass({ id: "class-a", operationalName: "A Art", pathProgramId: "path-art", weekdayIso: 2, optimalConcurrentCapacity: 10, hardConcurrentCapacity: 12, status: "INACTIVE" }),
  runningClass({ id: "class-c", operationalName: "C Art", pathProgramId: "path-art", weekdayIso: 2, windowStartsLocal: "09:00", windowEndsLocal: "10:30", optimalConcurrentCapacity: 4, hardConcurrentCapacity: 8, status: "ARCHIVED" }),
];

test("Running Classes projection preserves canonical fields while search/filter remain view-local", () => {
  const rows = buildRunningClassGridRows(classes, paths, { search: "piano", status: "ACTIVE" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.item.id, "class-b");
  assert.equal(rows[0]?.programName, "Piano Foundation");
  assert.equal(rows[0]?.patternLabel, "Wed · 16:00–17:30");
  assert.equal(rows[0]?.capacityLabel, "6");
  assert.equal(classes.length, 3, "presentation filtering must not mutate canonical input");
});

test("Running Classes sorting is deterministic with canonical ID tie-break", () => {
  const capacity = buildRunningClassGridRows(classes, paths, { sortKey: "capacity", sortDirection: "desc" });
  assert.deepEqual(capacity.map((row) => row.item.id), ["class-a", "class-b", "class-c"]);
  const pattern = buildRunningClassGridRows(classes, paths, { sortKey: "pattern", sortDirection: "asc" });
  assert.deepEqual(pattern.map((row) => row.item.id), ["class-c", "class-a", "class-b"]);
  assert.equal(isRunningClassGridSortKey("status"), true);
  assert.equal(isRunningClassGridSortKey("version"), false);
});

test("Running Classes surface consumes PAP-383 shared mechanics instead of a page-specific table", () => {
  const source = readFileSync("app/bo/BoOperationalView.tsx", "utf8");
  const start = source.indexOf("function RunningClasses");
  const end = source.indexOf("function Sessions", start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.match(block, /useBoDataGridUrlState/);
  assert.match(block, /<BoDataGrid/);
  assert.match(block, /BoDataGridStatus/);
  assert.match(block, /BoDataGridCanonicalId/);
  assert.match(block, /setFilter\("status"/);
  assert.doesNotMatch(block, /<Table\b/);
  assert.doesNotMatch(block, /transitionRunningClass|createRunningClass|fetch\(/);
});
