import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const agents = readFileSync("AGENTS.md", "utf8");
const wrapper = readFileSync("scripts/delivery-entry.mjs", "utf8");
const careWrapper = readFileSync("scripts/delivery-care.mjs", "utf8");

test("Team exposes the Core-owned delivery entry wrapper", () => {
  assert.equal(pkg.scripts["delivery:enter"], "node scripts/delivery-entry.mjs");
  assert.equal(pkg.scripts["pino:resume"], "node scripts/delivery-entry.mjs");
  assert.match(wrapper, /PINO_CORE_PATH/);
  assert.match(wrapper, /--worktree/);
});

test("Team working contract requires continuation reconciliation", () => {
  assert.match(agents, /Mandatory continuation entry gate/);
  assert.match(agents, /featureCode.*featureId/);
  assert.match(agents, /non-authoritative delivery memory/);
  assert.match(agents, /NONE[\s\S]*SAFE[\s\S]*CONTRACT[\s\S]*DESTRUCTIVE/);
});

test("Team exposes Core-owned PLT-CARE coordination", () => {
  assert.equal(pkg.scripts["delivery:care"], "node scripts/delivery-care.mjs");
  assert.equal(pkg.scripts["delivery:claim"], "node scripts/delivery-care.mjs claim");
  assert.match(careWrapper, /slice-care\.mjs/);
  assert.match(careWrapper, /PINO_CORE_PATH/);
  assert.match(agents, /Cross-Project slice care/);
  assert.match(agents, /Fresh foreign care blocks duplicate material edits/);
});

test("Team entry wrapper fails closed when Core governance is unavailable", () => {
  const env = { ...process.env };
  delete env.PINO_CORE_PATH;
  const result = spawnSync(process.execPath, ["scripts/delivery-entry.mjs", "--offline"], { encoding: "utf8", env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /set PINO_CORE_PATH or pass --core/);
});

test("Team care wrapper fails closed when Core governance is unavailable", () => {
  const env = { ...process.env };
  delete env.PINO_CORE_PATH;
  const result = spawnSync(process.execPath, ["scripts/delivery-care.mjs", "status", "--feature", "PLT-CARE"], { encoding: "utf8", env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /set PINO_CORE_PATH or pass --core/);
});
