/** PAP-764 · Epic PAP-759 · SCH-OPENING-EVIDENCE.
 * AP source-only fail-closed BO route preflight. Canonical TDD admission is not yet granted.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const shell = read("app/bo/shell/BoApplicationShell.tsx");
const policy = read("app/bo/architecture/bo-staging-route-policy.ts");
const layout = read("app/bo/layout.tsx");
const route = read("app/bo/opening-evidence/page.tsx");
const stage = read("app/bo/opening-evidence/OpeningEvidenceStageGate.tsx");
const productionNav = read("app/bo/navigation.ts");

test("PAP-764 source-only route stays unadmitted until canonical TDD/Core contract", () => {
  const literal = policy.match(/boStagingAdmittedRoutes\s*=\s*new Set\(\s*(\[[\s\S]*?\])\s*\)/);
  assert.ok(literal, "Staging policy must remain a literal list");
  const routes = JSON.parse(literal[1].replace(/,\s*\]$/, "]")) as string[];
  assert.ok(!routes.includes("/bo/opening-evidence"), "No unregistered Staging admission");
  assert.doesNotMatch(shell, /"opening-evidence":/);
  assert.doesNotMatch(productionNav, /\/bo\/opening-evidence/);
  assert.match(layout, /isBoStagingRouteAdmitted\(routePath\)/);
  assert.match(route, /host !== "bo\.staging\.pinohouse\.art"\) notFound\(\)/);
});

test("PAP-764 placeholder cannot create a second Center provider or authorizer", () => {
  assert.doesNotMatch(stage, /BoCenterSelectionProvider|loadAuthorizedDirectoryCenters/);
  assert.match(stage, /useBoCenterSelection/);
  assert.match(stage, /scope\.centers\.some\(center => center\.id === scope\.selected\)/);
});

test("PAP-764 native grid/drawer use real scoped Core; no local or synthetic data",()=>{
  assert.match(stage,/BoDataGridSidePeek/);
  assert.match(stage,/BoProperties/);
  assert.match(stage,/openingEvidenceApi\.list/);
  assert.match(stage,/DEV_FIRST_UNADMITTED/);
  assert.doesNotMatch(stage,/localStorage|sessionStorage|syntheticRows|demoRows/);
  assert.match(stage,/controller\.abort/);
});
test("PAP-1946 list skeleton uses one heading, one native grid and no KPI cards",()=>{
  assert.equal((stage.match(/<BoDataGrid rows=/g)??[]).length,1);
  assert.equal((stage.match(/<h1>/g)??[]).length,1);
  assert.match(stage,/className="view-tabs"/);
  assert.doesNotMatch(stage,/kpi-card|<table/);
});
