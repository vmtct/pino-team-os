import test from "node:test";
import assert from "node:assert/strict";
import { authorizedPublicViewRole } from "./bo-public-view-context-role";
import type { BoContext } from "./bo-model";
const base = { userId: "u", email: "actor@example.invalid", staffMemberId: null, displayName: "Actor", staffProfile: null, surface: "BO", entitled: true, permissionKeys: [] } as BoContext;
const keys = { readKey: "module.read", manageKey: "module.views.manage" };
test("public view role fail closed on missing read grant", () => {
  assert.equal(authorizedPublicViewRole(base, keys), null);
  assert.equal(authorizedPublicViewRole({ ...base, permissionKeys: ["module.views.manage"] }, keys), null);
});
test("staff receives no manager actions without exact manage grant", () => {
  assert.equal(authorizedPublicViewRole({ ...base, permissionKeys: ["module.read"] }, keys), "staff");
});
test("manager only with independently supplied exact read and manage grants", () => {
  assert.equal(authorizedPublicViewRole({ ...base, permissionKeys: ["module.read", "module.views.manage"] }, keys), "manager");
});
