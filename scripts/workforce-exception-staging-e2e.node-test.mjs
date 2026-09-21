import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/workforce-exception-staging-e2e.yml", import.meta.url), "utf8");
const authority = readFileSync(new URL("./assert-wfm-exc-staging-authority.sh", import.meta.url), "utf8");

test("WFM staging E2E uses canonical Core read token for cross-repo provenance", () => {
  assert.match(workflow, /CORE_RELEASE_GH_TOKEN: \${{ secrets\.PINO_CORE_RELEASE_READ_TOKEN }}/);
  assert.match(workflow, /core_token="\${CORE_RELEASE_GH_TOKEN:\?PINO_CORE_RELEASE_READ_TOKEN unavailable}"/);
  assert.match(workflow, /GH_TOKEN="\$core_token" gh api "\/repos\/\${CORE_REPOSITORY}\/actions\/runs\/\${core_run_id}"/);
  assert.match(authority, /CORE_RELEASE_GH_TOKEN:\?PINO_CORE_RELEASE_READ_TOKEN unavailable/);
  assert.match(authority, /core_api\(\) \{ GH_TOKEN="\$CORE_RELEASE_GH_TOKEN" gh api "\$@"; \}/);
  assert.match(authority, /core_run="\$\(core_api "\/repos\/\${CORE_REPOSITORY}\/actions\/runs\/\${CORE_STAGING_DEPLOY_RUN_ID}"\)"/);
  assert.doesNotMatch(authority, /core_run="\$\(gh api "\/repos\/\${CORE_REPOSITORY}/);
});
