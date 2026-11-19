import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const [surface, mode = "local", feature, ...extra] = process.argv.slice(2);
if (!["bo", "ho", "tos"].includes(surface) || !["list", "local", "preview"].includes(mode) || extra.length) {
  throw Error("Usage: node qa/run.mjs bo|ho|tos [list|local|preview] [feature]");
}
const directory = resolve(root, "qa", "cases", surface);
const files = (await readdir(directory)).filter(f => f.endsWith(".json")).sort();
const selected = files.filter(f => !feature || f === feature + ".json");
if (!selected.length) throw Error("No matching QA cases");
if (mode === "local") {
  const start = Date.now();
  const shared = spawnSync(process.execPath, ["--test", "qa/staging.test.mjs"], {cwd: root, stdio: "inherit"});
  const result = shared.status === 0 && !shared.error ? "PASS" : "FAIL";
  console.log(JSON.stringify({surface, feature:"shared-staging-proof", mode, result, elapsedMs:Date.now()-start}));
  if (result !== "PASS") process.exitCode = 1;
}
for (const file of selected) {
  const key = file.slice(0, -5);
  const contract = JSON.parse(await readFile(resolve(directory, file), "utf8"));
  if (mode === "list") {
    console.log(surface, key, [ "local", ...(contract.tdd ? ["TDD preview"] : []), ...(contract.stagingList ? ["admitted staging list"] : []) ].join(" + "));
    continue;
  }
  const start = Date.now();
  let result = "PASS";
  if (mode === "local") {
    const run = spawnSync(process.execPath, ["--import", "tsx", "--test", ...contract.tests], {cwd: root, stdio: "inherit"});
    if (run.error || run.status !== 0) result = "FAIL";
  } else {
    const { runPreview } = await import("./preview.mjs");
    result = await runPreview(surface, key, contract);
  }
  console.log(JSON.stringify({surface, feature: key, mode, result, elapsedMs: Date.now() - start}));
  if (result !== "PASS") process.exitCode = 1;
}
