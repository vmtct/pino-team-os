import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { boNavigation } from "../app/bo/navigation";
import { boModuleRegistry } from "../app/bo/architecture/registry";
import { isBoStagingRouteAdmitted } from "../app/bo/architecture/bo-staging-route-policy";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const removed = [
  "/bo/workforce-term-weeks",
  "/bo/pinoria-world",
  "/bo/pinoria-ward",
  "/bo/pinoria-ward/sets",
  "/bo/system/users",
  "/bo/system/roles",
] as const;

type NavItem = { href?: string; children?: NavItem[] };
function allLinks(items: readonly NavItem[]): string[] {
  return items.flatMap((item) => [
    ...(item.href ? [item.href] : []),
    ...allLinks(item.children ?? []),
  ]);
}

test("retired BO modules cannot be opened from sidebar, deep links or runtime route registry", () => {
  const hrefs = boNavigation.flatMap((group) => allLinks(group.items));
  const hostBoundarySource = readFileSync(join(root, "lib/host-boundary.ts"), "utf8");
  for (const path of removed) {
    assert.equal(hrefs.includes(path), false, `Navigation re-exposes ${path}`);
    assert.equal(existsSync(join(root, `app${path}/page.tsx`)), false, `Route still active: ${path}`);
    assert.equal(hostBoundarySource.includes(`"${path}",`), false, `Host allowlist re-exposes ${path}`);
    assert.equal(isBoStagingRouteAdmitted(path), false, `Staging still admits ${path}`);
    assert.equal(boModuleRegistry.some((entry) => entry.href === path), false, `Module registry re-exposes ${path}`);
  }
});

test("Pinoria Loadouts and System policies remain reachable after removal", () => {
  const hrefs = boNavigation.flatMap((group) => allLinks(group.items));
  for (const href of ["/bo/pinoria-ward/learners", "/bo/system/policies", "/bo/system/audit", "/bo/workforce-shift-plans"]) {
    assert.ok(hrefs.includes(href), `Kept module missing: ${href}`);
    assert.ok(existsSync(join(root, `app${href}/page.tsx`)), `Kept route missing: ${href}`);
  }
  const loadouts = readFileSync(join(root, "app/bo/pinoria-ward/learners/WardLearnerManager.tsx"), "utf8");
  assert.equal(loadouts.includes('<a href="/bo/pinoria-ward">'), false);
  assert.equal(loadouts.includes('<a href="/bo/pinoria-ward/sets">'), false);
});
