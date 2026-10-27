import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const ci = readFileSync(new URL('../.github/workflows/pr-validation.yml', import.meta.url), 'utf8');
const cd = readFileSync(new URL('../.github/workflows/candidate-staging-deploy.yml', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../.github/workflows/bot-merge-main-ci-bridge.yml', import.meta.url), 'utf8');

test('PR Validation retains pull_request/push and permits guarded main workflow dispatch', () => {
  assert.match(ci, /workflow_dispatch:/);
  assert.match(ci, /pull_request:/);
  assert.match(ci, /push:/);
  assert.match(ci, /branches: \[main\]/);
  assert.match(ci, /dispatch_staging_after_main_validation:/);
  assert.match(ci, /needs: \[validate\]/);
  assert.match(ci, /needs\.validate\.result == 'success'/);
  assert.match(ci, /actions: write/);
  assert.match(ci, /candidate-staging-deploy\.yml\/dispatches/);
});

test('CD admits only exact main with completed green CI proof for both triggers', () => {
  assert.match(cd, /workflow_dispatch:/);
  assert.match(cd, /validation_run_id:/);
  assert.match(cd, /source_sha:/);
  assert.match(cd, /workflow_run\.event == 'push'/);
  assert.match(cd, /github\.event_name == 'workflow_dispatch'/);
  assert.match(cd, /ci_admitted=0/);
  assert.match(cd, /\.conclusion=="success"/);
  assert.match(cd, /\.head_sha==\$sha/);
  assert.match(cd, /\.head_branch=="main"/);
  assert.match(cd, /commits\/main --jq \.sha/);
  assert.match(cd, /\.path==\"\.github\/workflows\/pr-validation\.yml\"/);
  assert.match(cd, /ROLLBACK_HOLD/);
});

test('bridge only dispatches current-main validation after exact bot merge from green PR CI', () => {
  assert.match(bridge, /workflow_run\.event == 'pull_request'/);
  assert.match(bridge, /workflow_run\.conclusion == 'success'/);
  assert.match(bridge, /commits\/\$RUN_SHA\/pulls/);
  assert.match(bridge, /\.head\.sha==\$sha/);
  assert.match(bridge, /\.merged_by\.login==\"github-actions\[bot\]\"/);
  assert.match(bridge, /if \[ "\$current_main" != "\$merge_sha" \]/);
  assert.match(bridge, /workflows\/pr-validation\.yml\/dispatches/);
  assert.doesNotMatch(bridge, /actions\/checkout/);
});

test('PAP-1091 bridge waits bounded for post-CI native merge admission',()=>{
 assert.match(bridge, /if \[ "\$attempt" -ge 7 \]/);
 assert.match(bridge, /native auto-merge not enabled within bounded admission window/);
 assert.doesNotMatch(bridge, /if \[ "\$attempt" -eq 1 \] && jq -e/);
 assert.match(bridge, /merged_by\.login==\"github-actions\[bot\]\"/);
});
