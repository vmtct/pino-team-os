import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const agents = readFileSync("AGENTS.md", "utf8");
const wrapper = readFileSync("scripts/delivery-entry.mjs", "utf8");

test("Team exposes the Core-owned delivery entry wrapper", () => {
  assert.equal(pkg.scripts["delivery:enter"], "node scripts/delivery-entry.mjs");
  assert.match(wrapper, /PINO_CORE_PATH/);
  assert.match(wrapper, /--worktree/);
});

test("Team working contract requires continuation reconciliation", () => {
  assert.match(agents, /Mandatory continuation entry gate/);
  assert.match(agents, /featureCode.*featureId/);
  assert.match(agents, /non-authoritative delivery memory/);
});

test("Team wrapper fails closed when Core governance is unavailable", () => {
  const env = { ...process.env };
  delete env.PINO_CORE_PATH;
  const result = spawnSync(process.execPath, ["scripts/delivery-entry.mjs", "--offline"], { encoding: "utf8", env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /set PINO_CORE_PATH or pass --core/);
});
