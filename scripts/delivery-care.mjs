import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const values = process.argv.slice(2);
let corePath = process.env.PINO_CORE_PATH ?? null;
const forwarded = [];

for (let index = 0; index < values.length; index += 1) {
  if (values[index] === "--core") corePath = values[++index];
  else forwarded.push(values[index]);
}

if (!corePath) {
  console.error("PINO slice care blocked: set PINO_CORE_PATH or pass --core <pino-core worktree>. Core owns canonical PLT-CARE coordination.");
  process.exit(2);
}

const coreScript = join(resolve(corePath), "scripts/slice-care.mjs");
if (!existsSync(coreScript)) {
  console.error(`PINO slice care blocked: Core care gate not found at ${coreScript}. Use a Core checkout containing PLT-CARE.`);
  process.exit(2);
}
const result = spawnSync(process.execPath, [coreScript, ...forwarded], {
  cwd: root,
  encoding: "utf8",
  stdio: "inherit",
});

if (result.error) {
  console.error(`PINO slice care blocked: ${result.error.message}`);
  process.exit(2);
}

process.exit(result.status ?? 2);
