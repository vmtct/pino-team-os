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

test("Access evaluator runtime credential and provider authority are isolated and immutable", () => {
  const secretFlow = readFileSync(".github/workflows/access-sync-worker-secret.yml", "utf8");
  const evaluatorAuthority = readFileSync("scripts/assert-evaluator-provider-authority.sh", "utf8");
  const externalEval = readFileSync(".github/workflows/tos-canonical-external-eval.yml", "utf8");
  const policyTest = readFileSync("scripts/run-access-evaluator-policy-test.sh", "utf8");
  for (const token of ["CF_ACCESS_EVALUATOR_API_TOKEN", "CONTROL_PLANE_ACCESS_TOKEN", "EVALUATOR_ACCESS_TOKEN", "sha256sum", "must not reuse control-plane Access token", "GITHUB_RUN_ATTEMPT", "Evaluator version", "Evaluator deployment", "Evaluator deployment marker"]) assert.match(secretFlow, new RegExp(token));
  for (const token of ["access-sync-worker-secret.yml", "run_attempt==1", "Authorization body hash", "pino-access-evaluator/deployments", "Evaluator live deployment drifted", "Evaluator live version drifted", "Evaluator deployment marker drifted"]) assert.ok(evaluatorAuthority.includes(token), token);
  for (const token of ["EVALUATOR_SECRET_ISSUE", "EVALUATOR_SECRET_RUN_ID", "assert-evaluator-provider-authority.sh", "CF_ACCESS_POLICY_TEST_TOKEN", "run-access-evaluator-policy-test.sh", "Credential-dependent Access policy test"]) assert.ok(externalEval.includes(token), token);
  assert.match(policyTest, /access\/policy-tests/);
  assert.match(policyTest, /status=="approved"/);
  assert.match(policyTest, /status=="blocked"/);
  assert.match(secretFlow, /group: pino-team-production/);
});

test("Team candidate producer is non-promoting and retroactive authorization is forbidden", () => {
  const boundary = JSON.parse(readFileSync("ops/team-production-build-boundary.json", "utf8"));
  const guardian = readFileSync(".github/workflows/cloudflare-build-guardian.yml", "utf8");
  const readme = readFileSync("README.md", "utf8");
  assert.equal(boundary.automaticTrafficPromotion, false);
  assert.equal(boundary.deployCommand, 'npx wrangler versions upload --tag "$WORKERS_CI_COMMIT_SHA" --message "pino-team-os candidate $WORKERS_CI_COMMIT_SHA"');
  assert.match(release, /builds\/workers\/\$\{worker_tag\}\/triggers/);
  assert.match(release, /canonical non-serving candidate command/);
  assert.match(release, /retroactive production authorization is forbidden/);
  assert.doesNotMatch(release, /PASS_ALREADY_ACTIVE/);
  assert.match(guardian, /reconcile_non_promoting_build/);
  assert.match(guardian, /-X PATCH/);
  assert.match(guardian, /ops\/team-production-build-boundary\.json/);
  assert.doesNotMatch(readme, /^npx wrangler deploy$/m);
});

test("Access mutation recovery is run-owned and refuses blind overwrite", () => {
  const bo = readFileSync(".github/workflows/bo-manager-access-reconcile.yml", "utf8");
  const idp = readFileSync(".github/workflows/tos-google-idp-reconcile.yml", "utf8");
  const evalFlow = readFileSync(".github/workflows/tos-canonical-external-eval.yml", "utf8");
  const watchdog = readFileSync(".github/workflows/access-control-recovery-watchdog.yml", "utf8");
  assert.match(bo, /Recovery policy name:/);
  assert.match(bo, /\[run:\$\{GITHUB_RUN_ID\}\]/);
  assert.match(watchdog, /BO recovery policy name is not run-owned/);
  assert.match(idp, /Desired app payload b64:/);
  assert.match(evalFlow, /Desired policy payload b64:/);
  assert.match(watchdog, /live state no longer equals this run's desired state or baseline/);
  assert.match(watchdog, /policy no longer equals this run's desired state or baseline/);
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
