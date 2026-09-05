import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("public Staff registration status exposes only the intake decision", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app/api/staff-registration/route.ts"),
    "utf8",
  );
  assert.match(source, /data: \{ enabled: state\.enabled \}/);
  assert.doesNotMatch(source, /data: state/);
  assert.doesNotMatch(source, /updatedByUserId|version: state\.version|updatedAt: state\.updatedAt/);
});

test("public Staff registration forwards the Founder-approved local password contract", () => {
  const binding = fs.readFileSync(path.join(process.cwd(), "lib/staff-registration-core.ts"), "utf8");
  const route = fs.readFileSync(path.join(process.cwd(), "app/api/staff-registration/route.ts"), "utf8");
  const page = fs.readFileSync(path.join(process.cwd(), "app/staff/register/page.tsx"), "utf8");
  assert.match(binding, /email: string;\s+password: string;\s+mobile: string;/);
  assert.match(route, /password !== confirmPassword/);
  assert.match(route, /value\.length < 10 \|\| value\.length > 128/);
  assert.match(route, /return \{ displayLabel, email, password, mobile,/);
  assert.match(page, /name="password" type="password" autoComplete="new-password" minLength=\{10\} maxLength=\{128\}/);
  assert.match(page, /name="confirmPassword" type="password" autoComplete="new-password" minLength=\{10\} maxLength=\{128\}/);
});
