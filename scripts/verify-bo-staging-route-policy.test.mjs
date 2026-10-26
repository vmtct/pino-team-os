import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyBoStagingRoutePolicy } from "./verify-bo-staging-route-policy.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = "app/bo/architecture/bo-staging-route-policy.ts";
const layout = "app/bo/layout.tsx";
const ci = ".github/workflows/pr-validation.yml";
const pages = ["workforce-term-weeks", "workforce-shift-plans", "workforce-availability", "workforce-assignments"];

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pap901-staging-routes-"));
  const write = (file, value) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
  };
  const read = file => fs.readFileSync(path.join(root, file), "utf8");
  for (const file of [policy, layout, ci, ...pages.map(name => `app/bo/${name}/page.tsx`)])
    write(file, fs.readFileSync(path.join(repo, file), "utf8"));
  try { return run({ root, read, write }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("PAP-901 current canonical routes have explicit staging decisions and styled shell", () => {
  assert.deepEqual(verifyBoStagingRoutePolicy(repo), { issues: [], canonical: 4, admitted: 4, deferred: 0 });
});

test("new canonical module without a staging decision fails closed", () => fixture(({ root, write }) => {
  write("app/bo/new-module/page.tsx", "return <BoModuleFactory moduleKey=\"new-module\" />;");
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /new-module.*exactly one staging decision/);
}));

test("an explicitly deferred module may merge without staging route exposure", () => fixture(({ root, read, write }) => {
  write("app/bo/new-module/page.tsx", "return <BoModuleFactory moduleKey=\"new-module\" />;");
  write(policy, read(policy).replace("new Set<string>([])", 'new Set<string>(["/bo/new-module"])'));
  assert.deepEqual(verifyBoStagingRoutePolicy(root).issues, []);
}));

test("staging admission cannot point at an absent or legacy route", () => fixture(({ root, read, write }) => {
  write(policy, read(policy).replace('"/bo/workforce-assignments",', '"/bo/workforce-assignments",\n  "/bo/staff",'));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /\/bo\/staff.*canonical BoModuleFactory page/);
}));

test("admitted staging shell without foundation stylesheet fails", () => fixture(({ root, read, write }) => {
  write(layout, read(layout).replace(
    '<link rel="stylesheet" href="/bo-legacy-foundation.css" /><BoSessionBoundary />',
    "<BoSessionBoundary />"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /must load scoped V2.3 foundation CSS/);
}));

test("removing staging deny fallback or CI gate fails", () => fixture(({ root, read, write }) => {
  write(layout, read(layout).replace('if (routePath !== "/bo" && routePath !== "/bo/") redirect("/bo")', ""));
  write(ci, read(ci).replace("node scripts/verify-bo-staging-route-policy.mjs", ""));
  const issues = verifyBoStagingRoutePolicy(root).issues.join("\n");
  assert.match(issues, /remain denied/);
  assert.match(issues, /PR CI must enforce/);
}));
