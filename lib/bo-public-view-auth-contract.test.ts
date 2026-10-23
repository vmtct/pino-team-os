import assert from "node:assert/strict";
import test from "node:test";
import { authorizedBoSharedViewRole, BO_PILOT_PUBLIC_VIEW_CONTRACT } from "./bo-public-view-auth-contract";

const base = { surface: "BO" as const, entitled: true as const };
test("Students shared view allows scoped read-only staff", () => {
  assert.equal(authorizedBoSharedViewRole({ ...base, permissionKeys: ["student.profile.view"] }, "student.profile.view"), "staff");
});
test("Students shared view requires explicit Manager grant for mutations", () => {
  assert.equal(authorizedBoSharedViewRole({ ...base, permissionKeys: ["student.profile.view", "bo.shared_view.manage"] }, "student.profile.view"), "manager");
  assert.equal(authorizedBoSharedViewRole({ ...base, permissionKeys: ["bo.shared_view.manage"] }, "student.profile.view"), null);
});
test("BO Shared Views fail closed on missing scope, context, or unregistered Classes", () => {
  assert.equal(authorizedBoSharedViewRole(null, "student.profile.view"), null);
  assert.equal(authorizedBoSharedViewRole({ ...base, permissionKeys: [] }, "student.profile.view"), null);
  assert.equal(authorizedBoSharedViewRole({ ...base, permissionKeys: ["student.profile.view"] }, ""), null);
  assert.equal(Object.hasOwn(BO_PILOT_PUBLIC_VIEW_CONTRACT, "classes"), false);
});
