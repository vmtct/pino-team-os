import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(resolve(root, ".github/workflows/pr-validation.yml"), "utf8");
const template = readFileSync(resolve(root, ".github/pull_request_template.md"), "utf8");

test("PAP-599: retired PLT metadata is not a Team PR admission gate", () => {
  assert.doesNotMatch(workflow, /verify-pr-project-code|Verify Project-Code|PINO_PR_BODY|PINO_PR_CREATED_AT/);
  assert.equal(existsSync(resolve(root, "scripts/verify-pr-project-code.mjs")), false);
  assert.doesNotMatch(template, /Project-Code|Feature-Code|Feature-Id|Entry-Class|NON_MATERIAL_APP_LOCAL/);
  assert.ok(workflow.includes("node --test scripts/verify-pr-validation-retirement.test.mjs"));
});

test("PAP-599: mandatory CI safety steps remain active", () => {
  for (const step of [
    "Enforce BO Architecture Contract",
    "Check BO V2.3 pilot parity contract",
    "Lint",
    "Unit tests",
    "Release confidence smoke and recovery regression tests",
    "Build",
    "Verify PAP-659 build manifest provenance",
    "Verify PAP-659 OpenNext asset packaging",
  ]) assert.ok(workflow.includes("- name: " + step), "Missing protected step: " + step);
  assert.ok(workflow.includes("pull_request:"));
  assert.ok(workflow.includes("push:"));
});
