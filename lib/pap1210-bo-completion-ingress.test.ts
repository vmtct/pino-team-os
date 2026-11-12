import test from "node:test";
import assert from "node:assert/strict";
import {
  BO_STAGING_HOSTNAME, BO_HOSTNAME, TOS_STAGING_HOSTNAME,
  HO_STAGING_HOSTNAME, decideHostBoundary,
} from "./host-boundary";

/** PAP-1210 / Epic PAP-1676 MISSION-ASSIGNMENT: Worker ingress before BO BFF. */
const id = "01a1bdfc-808f-7e7c-8833-2831bb891456";
const base = "/api/bo/learning/mission-assignments/" + id;

test("PAP-1210: exact Staging-only BO Completion GET and narrow Manager Reopen POST are admitted", () => {
  for (const kind of ["execution", "completion-history"]) {
    assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, base + "/" + kind, "GET"), { action: "next" }, kind);
  }
  assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, base + "/reopen", "POST"), { action: "next" });
  assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, base, "GET"), { action: "next" });
});

test("PAP-1210: methods and foreign hosts remain closed for every Completion endpoint", () => {
  const paths = [base + "/execution", base + "/completion-history", base + "/reopen"];
  for (const path of paths) {
    for (const host of [BO_HOSTNAME, HO_STAGING_HOSTNAME, TOS_STAGING_HOSTNAME, "unknown.invalid"]) {
      for (const method of ["GET", "POST"]) {
        assert.deepEqual(decideHostBoundary(host, path, method), { action: "not_found" }, host + " " + method + " " + path);
      }
    }
    for (const method of ["PATCH", "PUT", "DELETE", "HEAD"]) {
      assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, path, method), { action: "not_found" }, method + " " + path);
    }
  }
  for (const kind of ["execution", "completion-history"]) {
    assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, base + "/" + kind, "POST"), { action: "not_found" });
  }
  assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, base + "/reopen", "GET"), { action: "not_found" });
});

test("PAP-1210: malformed routes and unknown descendants stay 404; legacy read paths intact", () => {
  for (const path of [
    "/api/bo/learning/mission-assignments/not-uuid/reopen",
    base + "/reopen/approve", base + "/completion-history/events",
    base + "/execution/actor", base + "/reopen/delete",
    base + "/complete", base + "/approve",
  ]) {
    assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, path, "POST"), { action: "not_found" }, path);
  }
  for (const path of [base, base + "/history", base + "/diaries"]) {
    assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, path, "GET"), { action: "next" }, path);
  }
  assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, base + "/cancel", "POST"), { action: "next" });
});
