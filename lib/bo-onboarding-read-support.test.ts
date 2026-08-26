import test from "node:test";
import assert from "node:assert/strict";
import { isOperationalReadPath } from "./bo-read-handler";

test("BO read facade admits only the bounded onboarding support catalogs", () => {
  for (const path of ["centers", "access/roles", "access/users", "workforce/staff-records"]) {
    assert.equal(isOperationalReadPath(path), true, path);
  }
  for (const path of ["access/permissions", "access/audit", "workforce/staff-records/private", "workforce/staff-onboarding"]) {
    assert.equal(isOperationalReadPath(path), false, path);
  }
});
