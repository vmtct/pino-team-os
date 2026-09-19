import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Workforce staging artifact is bound to exact source and trusted workflow run", async () => {
  const workflow = await readFile(".github/workflows/workforce-team-staging-deploy.yml", "utf8");
  assert.match(workflow, /Workforce Team staging deploy #\{0\} @ \{1\}/);
  assert.match(workflow, /IGNORED Workforce Team staging issue #\{0\} @ \{1\}/);
  assert.match(workflow, /Requested SHA is not current Team main/);
  assert.match(workflow, /Source PR merge SHA does not equal requested Team SHA/);
  assert.match(workflow, /PR Validation/);
  assert.match(workflow, /Cloudflare Build \+ Serving Truth/);
  assert.match(workflow, /head_sha=\$\{team_sha\}&event=push&per_page=30/);
  assert.match(workflow, /workforce-staging-\$\{short_sha\}-run-\$\{GITHUB_RUN_ID\}/);
  assert.match(workflow, /Workforce staging \$\{TEAM_SHA\} run \$\{GITHUB_RUN_ID\}/);
  assert.match(workflow, /Trusted workflow run: \$\{GITHUB_RUN_ID\}/);
  assert.match(workflow, /const required = new Set\(\['PINO_CORE', 'PINO_WORKFORCE_CORE', 'PINO_WORKFORCE_NETWORK_CORE'/);
  assert.match(workflow, /'PINORIA_STAGING_STAFF_EMAIL', 'WORKFORCE_CENTER_NETWORK_STAGING_INGRESS'\]\)/);
});
