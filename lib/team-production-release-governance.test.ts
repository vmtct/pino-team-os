import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const release = readFileSync(".github/workflows/team-runtime-production-release.yml", "utf8");
function decide(input: Record<string, string>) {
  return execFileSync(process.execPath, ["scripts/team-production-release-fence.mjs", JSON.stringify(input)], { encoding: "utf8" }).trim();
}
const base = { oldDeploymentId: "d-old", oldVersion: "v-old", candidateDeploymentId: "", candidateVersion: "v-new", candidateMarker: "run", currentDeploymentId: "d-new", currentVersion: "v-new", currentMarker: "run", previousDeploymentId: "d-old" };

test("Team rollback restores only exact run-owned successor", () => {
  assert.equal(decide(base), "RESTORE");
  assert.equal(decide({ ...base, currentMarker: "external" }), "REFUSE");
  assert.equal(decide({ ...base, previousDeploymentId: "d-external" }), "REFUSE");
  assert.equal(decide({ ...base, candidateDeploymentId: "d-new" }), "RESTORE");
});

test("Team rollback refuses same-version external redeploy and different-version drift", () => {
  assert.equal(decide({ ...base, currentVersion: "v-old", currentDeploymentId: "d-old" }), "NOOP");
  assert.equal(decide({ ...base, currentVersion: "v-old", currentDeploymentId: "d-external" }), "REFUSE");
  assert.equal(decide({ ...base, currentVersion: "v-third" }), "REFUSE");
});

test("Team production workflow late-binds runtime main and immutable deployment identity", () => {
  for (const token of ["old_deployment_id", "OLD_DEPLOYMENT_ID", "main_predeploy", "main_postdeploy", "final_main", "candidate_deployment_id", "PINO_TEAM_PRODUCTION_RELEASE:", "team-production-release-fence.mjs", "promotion_attempted=1"]) {
    assert.ok(release.includes(token), );
  }
  assert.ok(release.indexOf("promotion_attempted=1") < release.indexOf("WRANGLER_OUTPUT_FILE_PATH"));
});

test("legacy TOS readiness probe is retired fail-closed on local-auth clean reset", () => {
  const retired = readFileSync(".github/workflows/tos-live-readiness.yml", "utf8");
  assert.match(retired, /RETIRED_FAIL_CLOSED/);
  assert.match(retired, /cannot prove the canonical production local-password path/);
  assert.doesNotMatch(retired, /cloudflare_access|D1_DATABASE_ID|CF_API_TOKEN/);
});
