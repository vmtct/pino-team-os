import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Workforce staging artifact is bound to exact source and trusted workflow run", async () => {
  const workflow = await readFile(".github/workflows/workforce-team-staging-deploy.yml", "utf8");
  assert.match(workflow, /Requested SHA is not current Team main/);
  assert.match(workflow, /Source PR merge SHA does not equal requested Team SHA/);
  assert.match(workflow, /PR Validation/);
  assert.match(workflow, /Cloudflare Build \+ Serving Truth/);
  assert.match(workflow, /workforce-staging-\$\{short_sha\}-run-\$\{GITHUB_RUN_ID\}/);
  assert.match(workflow, /Workforce staging \$\{TEAM_SHA\} run \$\{GITHUB_RUN_ID\}/);
  assert.match(workflow, /Trusted workflow run: \$\{GITHUB_RUN_ID\}/);
});
