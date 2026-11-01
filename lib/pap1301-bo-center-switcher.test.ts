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
  assert.match(shell, /tabIndex=\{-1\}/);
  assert.match(shell, /event.key === "ArrowUp" \? items.at\(-1\)/);
  assert.match(shell, /if \(open\) \{ close\(true\); return; \}/);
  assert.match(shell, /className="nav-workspace-logo"><img/);
  const context = read("app/bo/components/registration/BoCenterSelection.tsx");
  assert.match(context, /setError\(cause instanceof Error \? cause.message/);
  assert.match(context, /if \(loading \|\| !centers.length\) return/);
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


test("PAP-1301: Core 401 and 403 Center discovery remain distinguishable", async () => {
  const { loadAuthorizedDirectoryCenters } = await import("../app/bo/pinoria-avatars/centers");
  const controller = new AbortController();
  const unauthenticated = (async () => new Response(null, { status: 401 })) as typeof fetch;
  await assert.rejects(
    loadAuthorizedDirectoryCenters(unauthenticated, controller.signal),
    /Vui lòng đăng nhập lại/,
  );
  const calls: string[] = [];
  const forbidden = (async (url: RequestInfo | URL) => {
    calls.push(String(url));
    return new Response(null, { status: 403 });
  }) as typeof fetch;
  await assert.rejects(
    loadAuthorizedDirectoryCenters(forbidden, controller.signal),
    /Không có nguồn cơ sở được cấp quyền/,
  );
  assert.deepEqual(calls, ["/api/bo/centers", "/api/bo/workforce/planning/bootstrap"]);
});
