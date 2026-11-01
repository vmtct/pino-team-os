import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parentCenterUrl, restoreParentCenter } from "../app/bo/parents/navigation";

const read = (path: string) => readFileSync(path, "utf8");
const centerA = { id: "0199f001-0000-7000-8000-000000000001", displayName: "Center A" };
const centerB = { id: "0199f001-0000-7000-8000-000000000002", displayName: "Center B" };

test("PAP-1301: only Staging Parents TDD pilot activates the canonical BO shell switcher", () => {
  const runtime = read("app/bo/components/registration/BoRuntimeBoundary.tsx");
  const shell = read("app/bo/components/registration/BoCenterSwitcher.tsx");
  const pilot = read("app/bo/parents/ParentTdd.tsx");
  assert.match(runtime, /const isParentPilot = moduleKey === "parents" && parentTddPilot/);
  assert.match(runtime, /isParentPilot \? <BoCenterSelectionProvider>/);
  assert.match(shell, /useBoCenterSelection\(\)/);
  assert.match(shell, /className="workspace-switcher"/);
  assert.match(shell, /role="listbox"/);
  assert.match(shell, /role="option"/);
  assert.match(shell, /aria-selected=\{c.id === selection.selected\}/);
  assert.match(shell, /aria-expanded=\{open\}/);
  assert.match(shell, /Escape/);
  assert.match(shell, /ArrowDown/);
  assert.match(shell, /ArrowUp/);
  assert.match(shell, /pointerdown/);
  assert.match(shell, /disabled/);
  assert.doesNotMatch(pilot, /tdd-parent-center|<select|<option/);
  assert.match(pilot, /useBoCenterSelection\(\)/);
  assert.match(pilot, /ready\?\.centerId === selected/);
  assert.match(pilot, /active\?\.dispose\(\)/);
});

test("PAP-1301: selection is restricted to Core-authorized candidate list and clears prior record state", () => {
  const provider = read("app/bo/components/registration/BoCenterSelection.tsx");
  assert.match(provider, /loadAuthorizedDirectoryCenters\(fetch, ctl.signal\)/);
  assert.match(provider, /if \(!centers.some\(c => c.id === centerId\)\) return/);
  assert.match(provider, /url.searchParams.delete\("record"\)/);
  assert.match(provider, /delete state\["pino:tdd:BO:parents"\]/);
  assert.match(provider, /window.addEventListener\("popstate", restore\)/);
  assert.doesNotMatch(provider, /localStorage|sessionStorage/);
  const initial = new URL("https://bo.staging.pinohouse.art/bo?module=parents&pilot=tdd");
  const chosen = new URL(parentCenterUrl(initial, centerB.id), initial.origin);
  assert.equal(restoreParentCenter([centerA, centerB], chosen), centerB.id);
  assert.equal(restoreParentCenter([centerA], chosen), "");
  chosen.searchParams.set("centerId", "forged");
  assert.equal(restoreParentCenter([centerA, centerB], chosen), "");
  assert.equal(restoreParentCenter([centerA, centerB], initial), "");
});

test("PAP-1301: legacy BO and Production routes cannot opt in implicitly", () => {
  const page = read("app/bo/page.tsx");
  const runtime = read("app/bo/components/registration/BoRuntimeBoundary.tsx");
  assert.match(page, /query.module === "parents" && query.pilot === "tdd"/);
  assert.match(runtime, /moduleKey === "parents" && parentTddPilot \? <ParentTdd \/>/);
  assert.match(runtime, /return isParentPilot \? <BoCenterSelectionProvider>/);
});
