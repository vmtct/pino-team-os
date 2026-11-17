import test from "node:test";
import assert from "node:assert/strict";
import { BO_STAGING_HOSTNAME, decideHostBoundary } from "./host-boundary";

for (const [path, verb] of [
  ["/api/bo/identity/parents/center-search", "GET"],
  ["/api/bo/student-intakes/center", "POST"],
]) {
  test("PAP-1918 allows only the exact Staging route: " + path, () => {
    assert.equal(decideHostBoundary(BO_STAGING_HOSTNAME, path, verb).action, "next");
    for (const method of ["GET", "POST", "PATCH", "DELETE"].filter(method => method !== verb)) {
      assert.equal(decideHostBoundary(BO_STAGING_HOSTNAME, path, method).action, "not_found");
    }
    for (const host of ["bo.pinohouse.art", "ho.staging.pinohouse.art", "tos.staging.pinohouse.art", "localhost"]) {
      assert.equal(decideHostBoundary(host, path, verb).action, "not_found");
    }
    for (const suffix of ["/", "/extra"]) {
      assert.equal(decideHostBoundary(BO_STAGING_HOSTNAME, path + suffix, verb).action, "not_found");
    }
  });
}
