import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const workflow=readFileSync('.github/workflows/pr-validation.yml','utf8');
const template=readFileSync('.github/pull_request_template.md','utf8');
test('Team CI no longer blocks material PRs on Project-Code',()=>{
  assert.doesNotMatch(workflow,/Verify Project-Code metadata|verify-pr-project-code/);
  assert.equal(existsSync('scripts/verify-pr-project-code.mjs'),false);
  assert.doesNotMatch(template,/Project-Code:/);
  assert.match(workflow,/bun install --frozen-lockfile/);
  assert.match(workflow,/bun run lint/);
  assert.match(workflow,/bun run test/);
  assert.match(workflow,/bun run build/);
});
