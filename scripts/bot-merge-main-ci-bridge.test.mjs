import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const ci = readFileSync(new URL('../.github/workflows/pr-validation.yml', import.meta.url), 'utf8');
const cd = readFileSync(new URL('../.github/workflows/candidate-staging-deploy.yml', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../.github/workflows/bot-merge-main-ci-bridge.yml', import.meta.url), 'utf8');

test('main CI retains push, PR and adds authenticated workflow_dispatch', () => {
  assert.match(ci, /workflow_dispatch:/);
  assert.match(ci, /pull_request:/);
  assert.match(ci, /push:/);
  assert.match(ci, /branches: \[main\]/);
});

test('staging CD accepts exact main successful push or dispatched main CI only', () => {
  assert.match(cd, /workflow_run\.conclusion == 'success'/);
  assert.match(cd, /workflow_run\.event == 'push' \|\| github\.event\.workflow_run\.event == 'workflow_dispatch'/);
  assert.match(cd, /\.head_sha==\$sha/);
  assert.match(cd, /commits\/main --jq \.sha/);
  assert.match(cd, /\.path==\"\.github\/workflows\/pr-validation\.yml\"/);
});

test('bridge is limited to passed PR CI and exact GitHub Actions bot merge', () => {
  assert.match(bridge, /workflow_run\.event == 'pull_request'/);
  assert.match(bridge, /workflow_run\.conclusion == 'success'/);
  assert.match(bridge, /commits\/\$RUN_SHA\/pulls/);
  assert.match(bridge, /\.head\.sha==\$sha/);
  assert.match(bridge, /\.merged_by\.login==\"github-actions\[bot\]\"/);
  assert.match(bridge, /if \[ "\$current_main" != "\$merge_sha" \]/);
  assert.match(bridge, /workflows\/pr-validation\.yml\/dispatches/);
  assert.doesNotMatch(bridge, /actions\/checkout/);
});
