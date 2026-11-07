import assert from "node:assert/strict";
import test from "node:test";
import { staffAccessCanRevoke, staffAccessScopeValid } from "./bo-staff-access-scope";

const catalog = {
  centers: [{ id: "center-a" }, { id: "center-b" }],
  paths: [{ id: "path-a" }],
  classes: [{ id: "class-a" }],
};

test("PAP-784 only accepts real scoped Access targets from canonical catalog", () => {
  assert.equal(staffAccessScopeValid("GLOBAL", "", catalog), true);
  assert.equal(staffAccessScopeValid("GLOBAL", "center-a", catalog), false);
  assert.equal(staffAccessScopeValid("CENTER", "center-a", catalog), true);
  assert.equal(staffAccessScopeValid("CENTER", "path-a", catalog), false);
  assert.equal(staffAccessScopeValid("PATH", "path-a", catalog), true);
  assert.equal(staffAccessScopeValid("RUNNING_CLASS", "class-a", catalog), true);
  assert.equal(staffAccessScopeValid("RUNNING_CLASS", "", catalog), false);
});

test("PAP-784 never exposes casual Founder assignment revoke", () => {
  assert.equal(staffAccessCanRevoke({ roleKey: "founder" }), false);
  assert.equal(staffAccessCanRevoke({ roleKey: "teacher" }), true);
  assert.equal(staffAccessCanRevoke(null), false);
});
