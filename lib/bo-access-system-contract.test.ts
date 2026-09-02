import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isOperationalReadPath } from "./bo-read-handler";
import { isAllowedPostPath, shouldReconcileTosAccess } from "./bo-write-handler";

const roleId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";

test("BO Access System facade exposes only bounded administration paths", () => {
  for (const readPath of ["access/users", "access/roles", "access/permissions", "access/audit", `access/roles/${roleId}`]) assert.equal(isOperationalReadPath(readPath), true, readPath);
  for (const writePath of ["access/roles", `access/roles/${roleId}/duplicate`, `access/roles/${roleId}/update`, `access/roles/${roleId}/archive`, "access/assignments", "access/assignments/remove", "access/users/status"]) assert.equal(isAllowedPostPath(writePath), true, writePath);
  assert.equal(isOperationalReadPath("access/audit/export"), false);
  assert.equal(isAllowedPostPath(`access/roles/${roleId}/delete`), false);
  assert.equal(isAllowedPostPath("access/users/create"), false);
});

test("TOS perimeter reconciles entitlement-changing writes, not inert role copies", () => {
  assert.equal(shouldReconcileTosAccess(`access/roles/${roleId}/update`), true);
  assert.equal(shouldReconcileTosAccess(`access/roles/${roleId}/archive`), true);
  assert.equal(shouldReconcileTosAccess("access/assignments"), true);
  assert.equal(shouldReconcileTosAccess("access/assignments/remove"), true);
  assert.equal(shouldReconcileTosAccess(`workforce/staff-registration-requests/${roleId}/approve`), true);
  assert.equal(shouldReconcileTosAccess(`workforce/staff-registration-requests/${roleId}/reject`), false);
  assert.equal(shouldReconcileTosAccess("workforce/staff-registration-settings"), false);
  assert.equal(shouldReconcileTosAccess(`access/roles/${roleId}/duplicate`), false);
});
test("BO Staff surface renders the pending registration review queue", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/bo/staff/page.tsx"), "utf8");
  assert.match(source, /<StaffRegistrationReviewQueue \/>/);
});
test("BO shell places Access administration under canonical System responsibility", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/bo/navigation.ts"), "utf8");
  assert.match(source, /label: "System"/);
  assert.match(source, /label: "Access"/);
  assert.match(source, /href: "\/bo\/system\/users", label: "Users"/);
  assert.match(source, /href: "\/bo\/system\/roles", label: "Roles"/);
  assert.match(source, /label: "Policies"/);
  assert.match(source, /href: "\/bo\/system\/audit", label: "Audit"/);
});
