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

test("PAP-764 native staging entry admits only exact scoped pages and no production navigation", () => {
  const literal = policy.match(/boStagingAdmittedRoutes\s*=\s*new Set\(\s*(\[[\s\S]*?\])\s*\)/);
  assert.ok(literal, "Staging policy must remain a literal list");
  const routes = JSON.parse(literal[1].replace(/,\s*\]$/, "]")) as string[];
  assert.ok(routes.includes("/bo/opening-evidence"), "Exact native Staging admission");
  assert.match(shell, /"opening-evidence":/);
  assert.match(shell,/openingEvidenceBoModule\(pathname\)/);
  assert.match(policy,/openingEvidenceBoModule\(path\)/);
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
  assert.match(stage,/NATIVE_STAGING_CANDIDATE/);
  assert.doesNotMatch(stage,/localStorage|sessionStorage|syntheticRows|demoRows/);
  assert.match(stage,/controller\.abort/);
});
test("PAP-1946 list skeleton uses one heading, one native grid and no KPI cards",()=>{
  assert.equal((stage.match(/<BoDataGrid rows=/g)??[]).length,1);
  assert.equal((stage.match(/<h1>/g)??[]).length,1);
  assert.match(stage,/className="view-tabs"/);
  assert.doesNotMatch(stage,/kpi-card|<table/);
});

test("PAP-767 Quick Drawer and Full Detail share authorized private gallery with scope reset",()=>{
  const gallery=read("app/bo/opening-evidence/OpeningEvidenceGallery.tsx");
  const detail=read("app/bo/opening-evidence/[subjectType]/[receiptId]/OpeningEvidenceDetail.tsx");
  assert.match(stage,/<OpeningEvidenceDrawerGallery row={row} formatTime={evidenceTime}\/>/);
  assert.match(detail,/<OpeningEvidenceGallery data={data} formatTime={evidenceTime}\/>/);
  assert.match(gallery,/key={JSON\.stringify\(\[row\.centerId,row\.subjectType,row\.openingReceiptId,row\.version\]\)}/);
  assert.match(gallery,/openingEvidenceApi\.detail\(centerId,subjectType,openingReceiptId,controller\.signal\)/);
  assert.match(gallery,/result\.row\.version<version/);
  assert.match(gallery,/openingEvidenceApi\.photo\(row,assetId,controller\.signal\)/);
  assert.match(gallery,/URL\.revokeObjectURL/);
  assert.match(gallery,/privateAssetIds\?\?/);
  assert.doesNotMatch(gallery,/localStorage|sessionStorage|openingEvidenceApi\.review/);
});
