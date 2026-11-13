/** PAP-764 · Epic PAP-759 · SCH-OPENING-EVIDENCE.
 * AP FSG1 BO Staging-only shell invariants. No Core/read/review admission.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const shell = read("app/bo/shell/BoApplicationShell.tsx");
const policy = read("app/bo/architecture/bo-staging-route-policy.ts");
const route = read("app/bo/opening-evidence/page.tsx");
const stage = read("app/bo/opening-evidence/OpeningEvidenceStageGate.tsx");
const productionNav = read("app/bo/navigation.ts");

test("PAP-764 Staging route is exactly admitted and Production is 404", () => {
  assert.match(policy, /"\/bo\/opening-evidence"/);
  assert.match(route, /host !== "bo\.staging\.pinohouse\.art"\) notFound\(\)/);
  assert.doesNotMatch(productionNav, /\/bo\/opening-evidence/);
});
test("PAP-764 owns one native BO shell destination, without second side menu", () => {
  assert.match(shell, /"opening-evidence": \{ label: "Mở lớp & ca", group: "Operations", fields: \[\] \}/);
  assert.match(shell, /modules: \{ \.\.\.unifiedBoWorkspaceSource\.modules, \.\.\.directModules \}/);
  assert.doesNotMatch(stage, /BoCenterSelectionProvider|loadAuthorizedDirectoryCenters/);
  assert.match(stage, /useBoCenterSelection/);
});
test("PAP-764 Stage truth is fail-closed for missing Center and Core", () => {
  assert.match(stage, /scope\.centers\.some\(center => center\.id === scope\.selected\)/);
  assert.match(stage, /role=\{denied \? "alert" : "status"\}/);
  assert.match(stage, /Chưa kết nối dữ liệu bằng chứng mở lớp và ca từ Core/);
  assert.doesNotMatch(stage, /fetch\(|localStorage|sessionStorage|BoDataGrid|<table|<button|approve\(|review\(|onClick=/);
  assert.match(stage, /data-opening-evidence-phase="AP_FSG1_NAV_ONLY"/);
});
test("PAP-1946 list density gate is explicitly not falsely passed by a nav-only placeholder", () => {
  assert.doesNotMatch(stage, /\.view-tabs|<table|BoDataGrid|BoDataTable/);
  assert.match(stage, /className="page-heading"/);
  assert.match(stage, /className="grid-card"/);
});
