import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const release = readFileSync(".github/workflows/team-runtime-production-release.yml", "utf8");
const coreAuthority = readFileSync("scripts/assert-core-production-authority.sh", "utf8");
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

test("Team release binds exact Core authority and complete provider tuples", () => {
  for (const token of ["CORE_SHA", "CORE_DEPLOYMENT_ID", "CORE_RELEASE_ISSUE", "CORE_RELEASE_RUN_ID", "PINO_CORE_RELEASE_READ_TOKEN", "assert-core-production-authority.sh"]) assert.ok(release.includes(token), token);
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  const tuples = [...wrangler.matchAll(/\{"binding":"([^"]+)","service":"([^"]+)","entrypoint":"([^"]+)"\}/g)]
    .map(([, binding, service, entrypoint]) => `${binding}|${service}|${entrypoint}`);
  assert.equal(tuples.length, 9, "production service-binding inventory drifted");
  for (const tuple of tuples) assert.ok(release.includes(tuple), tuple);
  assert.match(release, /Core authority drifted before Team promotion/);
  assert.match(release, /Core authority drifted before Team PASS/);
  assert.match(coreAuthority, /core-production-release\.yml\/runs\?event=issues/);
  assert.match(coreAuthority, /superseded by a newer same-SHA attempt/);
});

test("Team hard-kill traffic recovery is durable and externally reconciled", () => {
  const watchdog = readFileSync(".github/workflows/production-release-recovery-watchdog.yml", "utf8");
  const recovery = readFileSync("scripts/recover-worker-promotion.sh", "utf8");
  const crossRepoFence = readFileSync("scripts/assert-no-core-verification-in-flight.sh", "utf8");
  const armedAt = release.indexOf("PINO_TEAM_PRODUCTION_RELEASE: **RECOVERY_ARMED**");
  const deployAt = release.indexOf("versions deploy \"${TEAM_VERSION}@100%\"");
  assert.ok(armedAt > 0 && deployAt > armedAt);
  assert.match(watchdog, /workflow_run:/);
  assert.match(watchdog, /Team Runtime Production Release/);
  assert.match(watchdog, /recover-worker-promotion\.sh/);
  assert.match(watchdog, /WATCHDOG_RECOVERED/);
  assert.match(watchdog, /assert-no-core-verification-in-flight\.sh/);
  assert.match(watchdog, /CORE_RELEASE_GH_TOKEN/);
  assert.match(watchdog, /overlap_clear/);
  assert.match(recovery, /current_marker/);
  assert.match(recovery, /previous_deployment/);
  assert.match(recovery, /REFUSE_OWNERSHIP/);
  assert.match(crossRepoFence, /pre-ga-production-local-auth-verification\.yml/);
  assert.match(crossRepoFence, /pre-ga-recovery-watchdog\.yml/);
  assert.match(release, /assert-no-core-verification-in-flight\.sh/);
});

test("Access evaluator runtime credential is isolated from control-plane authority", () => {
  const secretFlow = readFileSync(".github/workflows/access-sync-worker-secret.yml", "utf8");
  assert.match(secretFlow, /CF_ACCESS_EVALUATOR_API_TOKEN/);
  assert.match(secretFlow, /CONTROL_PLANE_ACCESS_TOKEN/);
  assert.match(secretFlow, /EVALUATOR_ACCESS_TOKEN/);
  assert.match(secretFlow, /control_hash/);
  assert.match(secretFlow, /evaluator_hash/);
  assert.match(secretFlow, /must not reuse the control-plane Access token/);
  assert.match(secretFlow, /group: pino-team-production/);
});

test("superseded production operators are executable-disabled", () => {
  for (const file of [
    "a-d-team-production-release.yml", "arrival-v0-core-build.yml", "arrival-v0-team-promote.yml",
    "arrival-v0-tos-attach.yml", "tos-staff-access-reconcile.yml", "train1-plt-tos-bo-production-release.yml",
    "train2-wfm-onb-team-production-release.yml",
  ]) {
    const text = readFileSync(`.github/workflows/${file}`, "utf8");
    assert.match(text, /PINO_RETIRED_SUPERSEDED_OPERATOR/);
    assert.match(text, /if: \$\{\{ false \}\}/);
  }
});
