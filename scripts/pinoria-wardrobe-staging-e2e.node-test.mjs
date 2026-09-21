import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/pinoria-wardrobe-staging-e2e.yml", import.meta.url),
  "utf8",
);
const spec = readFileSync(
  new URL("../e2e/pinoria-wardrobe-staging.spec.ts", import.meta.url),
  "utf8",
);

test("Ward staging E2E is issue-governed and bound to exact Team/Core source plus fixture receipt", () => {
  assert.match(workflow, /\[GPT\] Pinoria Wardrobe staging E2E/);
  assert.match(workflow, /CONFIRM:\[\[:space:\]\]\*RUN_PINORIA_WARDROBE_STAGING_E2E/);
  assert.match(
    workflow,
    /CORE_FIXTURE_RUN_ID:\[\[:space:\]\]\*\(\[1-9\]\[0-9\]\*\)/,
  );
  assert.match(workflow, /fixture_lines < <\(printf '%s\\n' "\$ISSUE_BODY"/);
  assert.doesNotMatch(workflow, /fixture_lines < <\(printf '%s\\\\n' "\$ISSUE_BODY"/);
  assert.match(workflow, /Requested Core SHA is not current Core main/);
  assert.match(workflow, /actions\/runs\/\$\{fixture_run_id\}/);
  assert.match(workflow, /\.head_sha == \$sha/);
  assert.match(workflow, /\.event == "issues"/);
  assert.match(workflow, /\.status == "completed"/);
  assert.match(workflow, /\.conclusion == "success"/);
  assert.match(workflow, /\.actor\.login == "vmtct"/);
  assert.match(workflow, /\.triggering_actor\.login == "vmtct"/);
  assert.match(
    workflow,
    /\.path == "\.github\/workflows\/pinoria-wardrobe-staging-fixture\.yml"/,
  );
  assert.match(
    workflow,
    /\.display_title == "\[GPT\] Pinoria wardrobe staging fixture"/,
  );
  assert.match(workflow, /echo "CORE_FIXTURE_RUN_ID=\$fixture_run_id" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /actions\/runs\/\$\{CORE_FIXTURE_RUN_ID\}/);
});

test("Ward staging E2E revalidates immutable runtime evidence and reports only Ward journey semantics", () => {
  assert.match(workflow, /Revalidate exact runtime and fixture receipt before Golden Journey/);
  assert.match(workflow, /Team staging version changed after admission/);
  assert.match(workflow, /Core staging deployment changed after admission/);
  assert.match(workflow, /Core fixture receipt no longer verifies/);
  assert.match(workflow, /PINORIA_WARDROBE_STAGING_E2E: PASS/);
  assert.match(workflow, /Golden Journey: GJ-PNR-WARD-01/);
  assert.doesNotMatch(workflow, /WORKFORCE_EXCEPTION_STAGING_E2E/);
  assert.doesNotMatch(workflow, /assert-wfm-exc-staging-authority/);
  assert.doesNotMatch(workflow, /GJ-WFM-EXCEPTION-01/);
  assert.doesNotMatch(workflow, /BO manager approval/);
});

test("Ward real-runtime spec proves all eight render variants and suppresses presentation mutation", () => {
  assert.match(spec, /\/api\/pinoria-tv\/snapshot\?centerId=/);
  assert.match(spec, /expect\(wardRender\.mode\)\.toBe\("LAYERED"\)/);
  assert.match(spec, /expect\(wardRender\.variants\)\.toHaveLength\(8\)/);
  assert.match(spec, /data-ward-layer=/);
  assert.match(spec, /data-ward-render-mode=/);
  assert.match(spec, /page\.route\("\*\*\/api\/pinoria-tv\/presentation\*\*"/);
  assert.match(spec, /route\.fulfill/);
  assert.doesNotMatch(spec, /request\.(post|put|patch|delete)\(/);
});
