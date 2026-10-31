/** PAP-1074: explicit authenticated Staging-only runner; never falsely green by skip. */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { validateG4RunnerEnv } from "../lib/tdd-g4-staging-config.ts";

const errors = validateG4RunnerEnv(process.env);
for (const name of ["TDD_G4_FOUNDER_STATE", "TDD_G4_MANAGER_STATE"]) {
  const file = process.env[name];
  if (file && !fs.existsSync(file)) errors.push(name + " private local storage state not found");
}
if (errors.length) {
  console.error("G4 ADMISSION HOLD: " + errors.join("; "));
  process.exitCode = 1;
} else {
  console.log("G4 staging-only admission: configuration accepted; roles and live E2E still must PASS.");
  try {
    execFileSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "e2e/tdd-g4-staging-readonly.spec.ts", "--reporter=list", "--workers=1", "--retries=0"], {
      stdio: "inherit",
      env: { ...process.env, TDD_G4_RUN: "1" },
      timeout: 15 * 60 * 1000,
    });
  } catch (error) {
    console.error("G4 HOLD: authenticated browser test failed; DO NOT mark Staging accepted.");
    process.exitCode = 1;
  }
}
