import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflow = readFileSync(resolve('.github/workflows/cloudflare-build-trigger-repair.yml'), 'utf8');

test('Team build-trigger repair is one-shot, exact-main, and deploy-command-only', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /REPAIR_TEAM_BUILD_TRIGGER/);
  assert.match(workflow, /git\/ref\/heads\/main/);
  assert.match(workflow, /Repair workflow must run from exact current main/);
  assert.match(workflow, /Expected exactly one active pino-team-os main build trigger/);
  assert.match(workflow, /trigger_uuid/);
  assert.match(workflow, /-X PATCH/);
  assert.match(workflow, /builds\/triggers\/\$\{trigger_uuid\}/);
  assert.match(workflow, /\{deploy_command:\$deploy_command\}/);
  assert.match(workflow, /Post-repair trigger identity changed/);
  assert.match(workflow, /Post-repair deploy command still drifted/);
  assert.doesNotMatch(workflow, /versions deploy/);
  assert.doesNotMatch(workflow, /wrangler deploy/);
  assert.doesNotMatch(workflow, /workers\/scripts\/.*deployments/);
});
