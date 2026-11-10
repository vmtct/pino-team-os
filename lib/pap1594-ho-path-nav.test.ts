/** PAP-1594 / PAP-1592 / HO-PATH-READ — founder-approved S1 navigation evidence.
 * S1-only test. Does not imply Founder acceptance of S1 or approval of S2–S6.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { hoModules, hoRoutes } from "./ho-system";
import { HO_PAGE_PATHS, safeHoReturnTo } from "./ho-routes";
import { BO_STAGING_HOSTNAME, HO_STAGING_HOSTNAME, decideHostBoundary } from "./host-boundary";

const target = "/ho/learning/paths";
const read = (path: string): string => readFileSync(path, "utf8");

test("PAP-1594 S1: HO Learning navigation has one Path target with exact Founder-approved label and route", () => {
  assert.equal(hoModules.paths.label, "Path");
  assert.equal(hoModules.paths.group, "Learning");
  assert.equal(hoRoutes.paths, target);
  assert.equal(HO_PAGE_PATHS.paths, target);
  assert.equal(Object.values(hoRoutes).filter(path => path === target).length, 1);
  assert.equal(Object.entries(hoModules).filter(([, entry]) => entry.label === "Path").length, 1);
  assert.deepEqual(decideHostBoundary(HO_STAGING_HOSTNAME, target, "GET"), { action: "next" });
  assert.equal(safeHoReturnTo(target), target);
  assert.equal(decideHostBoundary(BO_STAGING_HOSTNAME, target, "GET").action, "not_found");
});

test("PAP-1594 S1: shared HO navigation retains grouping, selected item, keyboard-accessible links and mobile close", () => {
  const ho = read("app/ho/HoWorkspace.tsx");
  const shell = read("app/bo/components/registration/BoRegistrationWorkspace.tsx");
  assert.match(ho, /modules:\{\.\.\.hoModules,languageMappings:\{/);
  assert.match(ho, /surface:"ho",readOnly:true/);
  assert.match(ho, /routeForModule:key=>key==="languageMappings"/);
  assert.match(ho, /hoRoutes\[key as HoModule\]/);
  assert.match(ho, /"\/ho\/language-mappings"/);
  assert.match(shell, /Object\.values\(navModules\)\.map\(m => m\.group\)/);
  assert.match(shell, /m\.group === group && \(pinoLocaleSearchMatches/);
  assert.match(shell, /pinoLocalizedLabel\(surface, "Nav Group"/);
  assert.match(shell, /aria-current=\{key === moduleKey \? "page"/);
  assert.match(shell, /href=\{source\.routeForModule\?\.\(key\)/);
  assert.match(shell, /prefetch=\{false\}/);
  assert.match(shell, /onClick=\{\(\) => setMobileOpen\(false\)\}/);
  assert.match(shell, /aria-expanded=\{expanded\}/);
  assert.match(shell, /aria-label="Tìm module"/);
});

test("PAP-1594 S1: selected Path page uses the canonical HO shell and does not create a second nav", () => {
  const page = read("app/ho/learning/paths/page.tsx");
  const componentSource = read("app/ho/learning/paths/HoPaths.tsx");
  assert.match(page, /HoPaths/);
  assert.match(componentSource, /<HoWorkspace module="paths" content=\{content\}/);
  assert.doesNotMatch(componentSource, /<aside|<nav|<header/);
});
