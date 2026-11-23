import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("PAP-2286 staging M1 fixture preview does not require live Leads permission", () => {
  const page = fs.readFileSync("app/bo/sales/leads/page.tsx", "utf8");
  const view = fs.readFileSync("app/bo/sales/leads/SalesLeadPipelineView.tsx", "utf8");
  assert.match(page, /await authorizeBoShell\(/);
  assert.match(page, /APP_ENV === "staging" && previewRequested/);
  assert.match(page, /if \(!previewAllowed && !actor\.permissionKeys\.includes\("acquisition\.lead\.manage"\)\) forbidden\(\)/);
  assert.match(page, /forceM1Preview=\{previewAllowed\}/);
  assert.match(view, /forceM1Preview \|\|/);
  assert.match(view, /previewEnabled \? <LeadHouseholdM1Preview \/> : <SalesLeadIntentPipelineView \/>/);
});
