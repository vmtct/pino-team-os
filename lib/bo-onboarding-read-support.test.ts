import test from "node:test";
import assert from "node:assert/strict";
import { isOperationalReadPath } from "./bo-read-handler";

test("BO read facade admits bounded onboarding and Access System catalogs", () => {
  for (const path of ["centers", "access/roles", "access/permissions", "access/audit", "access/users", "workforce/staff-records"]) {
    assert.equal(isOperationalReadPath(path), true, path);
  }
  for (const path of ["access/permissions/export", "access/audit/export", "workforce/staff-records/private", "workforce/staff-onboarding"]) {
    assert.equal(isOperationalReadPath(path), false, path);
  }
});
