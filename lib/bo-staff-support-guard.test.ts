import assert from "node:assert/strict";
import test from "node:test";
import { canOpenStaffSupport } from "./bo-staff-support-guard";

const perm = ["access.support.impersonate"];

test("PAP-785 support action requires canonical permission and active Staff + Access", () => {
  assert.equal(canOpenStaffSupport(perm, "active", "active", "Investigate attendance"), true);
  assert.equal(canOpenStaffSupport([], "active", "active", "Investigate attendance"), false);
  assert.equal(canOpenStaffSupport(perm, "inactive", "active", "Investigate attendance"), false);
  assert.equal(canOpenStaffSupport(perm, "active", "suspended", "Investigate attendance"), false);
});

test("PAP-785 requires bounded explicit support reason", () => {
  assert.equal(canOpenStaffSupport(perm, "active", "active", "  "), false);
  assert.equal(canOpenStaffSupport(perm, "active", "active", "x".repeat(501)), false);
  assert.equal(canOpenStaffSupport(perm, "active", "active", "bug"), true);
});
