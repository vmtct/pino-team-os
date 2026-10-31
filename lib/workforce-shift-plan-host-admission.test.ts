import test from "node:test";
import assert from "node:assert/strict";
import { BO_HOSTNAME, BO_STAGING_HOSTNAME, HO_STAGING_HOSTNAME, TOS_HOSTNAME, TOS_STAGING_HOSTNAME, decideHostBoundary } from "./host-boundary";
import { isBoWorkforcePlanningPath } from "./bo-workforce-planning-handler";

const path = "/api/bo/workforce/planning/shift-plan";

test("PAP-1125 exactly admits canonical Shift Plan POST to BO only, not any other verb", () => {
  for (const host of [BO_STAGING_HOSTNAME, BO_HOSTNAME]) {
    assert.deepEqual(decideHostBoundary(host, path, "POST"), { action: "next" });
    for (const verb of ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "DELETE"]) {
      assert.deepEqual(decideHostBoundary(host, path, verb), { action: "not_found" }, host + " " + verb);
    }
  }
  assert.equal(isBoWorkforcePlanningPath(path.slice("/api/bo/".length)), true);
});

test("PAP-1125 prevents host pivot, path suffix, case and broad workforce admission", () => {
  for (const host of [HO_STAGING_HOSTNAME, TOS_STAGING_HOSTNAME, TOS_HOSTNAME]) {
    assert.deepEqual(decideHostBoundary(host, path, "POST"), { action: "not_found" }, host);
  }
  for (const candidate of [path + "/", path + "/extra", path + "-delete", path.toUpperCase(), "/api/bo/workforce/planning/shift-plans", "/api/bo/workforce/planning/unknown"]) {
    assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, candidate, "POST"), { action: "not_found" }, candidate);
  }
  assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, "/api/bo/workforce/planning/week-control", "GET"), { action: "next" });
  assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, "/api/bo/workforce/planning/operational-assignment", "POST"), { action: "next" });
});
