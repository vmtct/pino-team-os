import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/candidate-staging-deploy.yml', 'utf8');

test('CD admits only successful main PR Validation push/dispatch receipts', () => {
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_repository\.full_name == 'vmtct\/pino-team-os'/);
  assert.match(workflow, /\.head_sha==\$sha and \(\.event=="push" or \.event=="workflow_dispatch"\)/);
  assert.match(workflow, /\.path=="\.github\/workflows\/pr-validation\.yml"/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$SHA"/);
});

test('staging candidate is in main history, never from a diverged or forced branch', () => {
  assert.match(workflow, /compare\/\$SHA\.\.\.\$latest_main/);
  assert.match(workflow, /case "\$relation" in identical\|ahead\)/);
  assert.match(workflow, /STAGING_ADMISSION_NOT_MAIN_ANCESTOR/);
  assert.match(workflow, /STAGING_CANDIDATE_DIVERGED/);
  assert.equal((workflow.match(/verify_candidate_in_current_main/g) ?? []).length, 3);
});

test('staging serving progression is monotonic and fail-closed on unknown provenance', () => {
  assert.match(workflow, /STAGED_SHA="\$\(jq -er /);
  assert.match(workflow, /capture\("staging sha=\(\?<sha>\[0-9a-f\]\{40\}\)"\)/);
  assert.match(workflow, /compare\/\$STAGED_SHA\.\.\.\$SHA/);
  assert.match(workflow, /case "\$staged_relation" in ahead\|identical\)/);
  assert.match(workflow, /STAGING_NON_MONOTONIC/);
  assert.match(workflow, /get "\$WORKER" > before\.json/);
});

test('CAS, staging isolation, safe rollback and production boundary remain enforced', () => {
  assert.match(workflow, /group: pino-team-staging-worker-mutation/);
  assert.match(workflow, /npx wrangler deploy -c wrangler\.ho-staging\.json/);
  assert.match(workflow, /pino-team-os-staging/);
  assert.match(workflow, /service==='pino-core-staging'/);
  assert.match(workflow, /active "\$WORKER"/);
  assert.match(workflow, /ROLLBACK_HOLD/);
  assert.match(workflow, /productionMutation:false/);
  assert.match(workflow, /authenticatedVisualAcceptance:"PENDING"/);
});
