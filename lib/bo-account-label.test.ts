import test from "node:test";
import assert from "node:assert/strict";
import { resolveBoAccountLabel } from "./bo-account-label";

test("BO uses authenticated email instead of mock Core displayName", () => {
  assert.deepEqual(resolveBoAccountLabel("Manager mock", "manager@example.test"), { name: "manager@example.test", subtitle: "Back Office" });
  assert.deepEqual(resolveBoAccountLabel("Founder Mock", "founder@example.test"), { name: "founder@example.test", subtitle: "Back Office" });
  assert.deepEqual(resolveBoAccountLabel("Tài khoản", "user@example.test"), { name: "user@example.test", subtitle: "Back Office" });
  assert.deepEqual(resolveBoAccountLabel(null, "founder@example.test"), { name: "founder@example.test", subtitle: "Back Office" });
});

test("BO retains real staff name and shows authenticated email", () => {
  assert.deepEqual(resolveBoAccountLabel("  Hằng  ", "hang@example.test"), { name: "Hằng", subtitle: "hang@example.test" });
});
