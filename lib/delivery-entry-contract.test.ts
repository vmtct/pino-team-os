import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const agents = readFileSync("AGENTS.md", "utf8");
const wrapper = readFileSync("scripts/delivery-entry.mjs", "utf8");

test("Team retains optional facts-only Core entry inspection", () => {
  assert.equal(pkg.scripts["delivery:enter"], "node scripts/delivery-entry.mjs");
  assert.equal(pkg.scripts["pino:resume"], "node scripts/delivery-entry.mjs");
  assert.match(wrapper, /PINO_CORE_PATH/);
  assert.match(wrapper, /--worktree/);
  assert.match(agents, /read-only compatibility fact inspectors/);
  assert.match(agents, /PAP-184/);
  assert.match(agents, /PAP-1051/);
  assert.match(agents, /PAP-980/);
  assert.match(agents, /Codex \*\*and\*\* GPT may implement/);
  assert.doesNotMatch(agents, /Codex is permitted only as the fresh independent PRE-MAIN reviewer|Codex is reviewer-only and must not perform/);
  assert.doesNotMatch(agents, /Mandatory continuation entry gate|Unclaimed work requires a claim|Fresh foreign care blocks duplicate material edits/);
});

test("Team does not expose retired Care mutation or coordination commands", () => {
  for (const key of ["delivery:care","delivery:claim","delivery:heartbeat","delivery:release","delivery:care:list"]) {
    assert.equal(pkg.scripts[key], undefined, key);
  }
  assert.equal(existsSync("scripts/delivery-care.mjs"), false);
  assert.match(agents, /Do not claim, heartbeat, reclaim, transfer, release or require historical PLT-CARE leases/);
});

test("optional Team entry inspector fails closed only if its chosen Core inspector is unavailable", () => {
  const env = { ...process.env };
  delete env.PINO_CORE_PATH;
  const result = spawnSync(process.execPath, ["scripts/delivery-entry.mjs", "--offline"], { encoding: "utf8", env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /set PINO_CORE_PATH or pass --core/);
});
