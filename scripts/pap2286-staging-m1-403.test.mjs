import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("PAP-2286 canonical staging route always selects fixture shell after BO admission; production stays live gated", () => {
  const page = fs.readFileSync("app/bo/sales/leads/page.tsx", "utf8");
  const view = fs.readFileSync("app/bo/sales/leads/SalesLeadPipelineView.tsx", "utf8");
  const shell = fs.readFileSync("app/bo/shell/BoApplicationShell.tsx", "utf8");
  const preview = fs.readFileSync("app/bo/sales/leads/LeadHouseholdM1Preview.tsx", "utf8");
  assert.match(page, /await authorizeBoShell\([\s\S]*?APP_ENV === "staging"\)\s*\{[\s\S]*?return <LeadHouseholdM1Preview \/>;/);
  assert.match(page, /if \(!actor\.permissionKeys\.includes\("acquisition\.lead\.manage"\)\) forbidden\(\);\s*return <SalesLeadPipelineView \/>;/);
  assert.match(page, /redirect\(safeBoStagingReturnTo\(/);
  assert.doesNotMatch(view, /m1Preview|LeadHouseholdM1Preview/);
  assert.match(view, /return <SalesLeadIntentPipelineView \/>;/);
  assert.doesNotMatch(shell, /sales\/leads\?m1Preview/);
  assert.doesNotMatch(preview, /<a href=\{pathname\}>Acquisition Intent/);
  assert.match(preview, /const backToTable = localReview \? pathname \+ "\?m1Preview=1" : pathname/);
});
