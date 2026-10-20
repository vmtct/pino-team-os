import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const guardian = readFileSync(new URL("../.github/workflows/cloudflare-build-guardian.yml", import.meta.url), "utf8");
const manual = readFileSync(new URL("../.github/workflows/e2e-production-smoke.yml", import.meta.url), "utf8");

test("PAP-820 never auto-dispatches Production Playwright from serving guardian", () => {
  assert.doesNotMatch(guardian, /gh workflow run e2e-production-smoke\.yml/);
  assert.match(guardian, /Cloudflare build outcome/);
  assert.match(guardian, /runtime_affecting/);
  assert.match(guardian, /cloudflare-status\.md/);
});
test("PAP-820 retains explicit manual diagnostic workflow without mandatory merge or ship linkage", () => {
  assert.match(manual, /workflow_dispatch:/);
  assert.match(manual, /bun run test:e2e/);
  assert.doesNotMatch(manual, /\bworkflow_run:/);
});
