import test from "node:test";
import assert from "node:assert/strict";
import { decideHostBoundary } from "./host-boundary";

// PAP-1932 / SCH-STUDENT-MGMT. This exact Staging-only ingress is not
// a role grant; BFF + Core must independently enforce Center ACL and CAS.
const id = "01a1d33c-7e9c-74db-85d2-a3b1eb63c377";
const path = `/api/bo/students/${id}/gender`;
const staging = "bo.staging.pinohouse.art";

test("PAP-1932 gender PATCH is admitted only on BO Staging with a canonical Student ID", () => {
  assert.deepEqual(decideHostBoundary(staging, path, "PATCH"), { action: "next" });
  for (const method of ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"]) {
    assert.deepEqual(decideHostBoundary(staging, path, method), { action: "not_found" }, method);
  }
  for (const host of ["bo.pinohouse.art", "ho.staging.pinohouse.art", "tos.staging.pinohouse.art", "ho.pinohouse.art", "localhost"]) {
    assert.deepEqual(decideHostBoundary(host, path, "PATCH"), { action: "not_found" }, host);
  }
});

test("PAP-1932 rejects malformed UUIDs and sibling/descendant Gender routes", () => {
  const rejected = [
    `/api/bo/students/${id}/gender/`,
    `/api/bo/students/${id}/gender/extra`,
    `/api/bo/students/${id}/genders`,
    `/api/bo/students/${id}/gender/delete`,
    "/api/bo/students/invalid/gender",
    "/api/bo/students/00000000-0000-4000-8000-000000000025/gender",
    "/api/bo/students/01a1d33c-7e9c-74db-05d2-a3b1eb63c377/gender",
  ];
  for (const route of rejected) assert.deepEqual(decideHostBoundary(staging, route, "PATCH"), { action: "not_found" }, route);
  // Existing name edit route remains isolated and unchanged.
  assert.deepEqual(decideHostBoundary(staging, `/api/bo/students/${id}`, "PATCH"), { action: "next" });
});
