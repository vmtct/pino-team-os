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
const rootLayout = "app/layout.tsx";
const source = "app/bo/architecture/bo-unified-workspace-source.ts";
const gateway = "app/bo/architecture/BoWorkforceRoute.tsx";
const cd = ".github/workflows/candidate-staging-deploy.yml";
const pages = ["workforce-shift-plans", "workforce-availability", "workforce-assignments"];

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pap901-staging-routes-"));
  const write = (file, value) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
  };
  const read = file => fs.readFileSync(path.join(root, file), "utf8");
  for (const file of [policy, layout, rootLayout, source, gateway, cd, ci, ...pages.map(name => `app/bo/${name}/page.tsx`)])
    write(file, fs.readFileSync(path.join(repo, file), "utf8"));
  try { return run({ root, read, write }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("PAP-901 current canonical routes use one admitted BO workspace with required stylesheet", () => {
  assert.deepEqual(verifyBoStagingRoutePolicy(repo), { issues: [], canonical: 3, admitted: 3, deferred: 0 });
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

test("admitted staging route without one authority stylesheet fails", () => fixture(({root,read,write}) => {
  write(rootLayout, read(rootLayout).replace('isBoStagingRouteAdmitted(path ?? "")', "false"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /authority CSS/);
}));

test("removing staging deny fallback or CI gate fails", () => fixture(({ root, read, write }) => {
  write(layout, read(layout).replace('if (!isBoStagingRouteAdmitted(routePath) && routePath !== "/bo" && routePath !== "/bo/") redirect("/bo")', ""));
  write(ci, read(ci).replace("node scripts/verify-bo-staging-route-policy.mjs", ""));
  const issues = verifyBoStagingRoutePolicy(root).issues.join("\n");
  assert.match(issues, /remain denied/);
  assert.match(issues, /PR CI must enforce/);
}));
test("unified workspace route cannot silently revert to legacy standalone shell", () => fixture(({root,read,write}) => {
  write(layout, read(layout).replace('<BoRuntimeBoundary currentUser=', '<BoShell currentUser='));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /single React workspace/);
}));
test("all three registered Workforce routes must stay in canonical nav", () => fixture(({root,read,write}) => {
  write(source,read(source).replace("modules: { ...school.modules, ...moduleDefinitions }", "modules: school.modules"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /Unified BO navigation/);
}));
test("Core adapter cannot be replaced with silent empty fallback data", () => fixture(({root,read,write}) => {
  write(source,read(source).replace("await adapters[key].list(fetcher)", "Promise.resolve([])"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /authorized and read-only/);
}));
test("staging route must use BO authority CSS rather than unstyled legacy shell", () => fixture(({root,read,write}) => {
  write(rootLayout,read(rootLayout).replace('"/bo-skeleton/" + file','"/team-legacy-global.css"'));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /authority CSS/);
}));

test("auto CD cannot silently skip CSS runtime checks", () => fixture(({root,read,write})=>{
  write(cd,read(cd).replace("for css in team-legacy-global.css bo-legacy-foundation.css","for css in unapproved.css"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/Automatic staging CD must smoke test/);
}));
test("staging nav cannot expose unadmitted future modules", () => fixture(({root,read,write})=>{
  write(source,read(source).replace("boModuleRegistry.filter(def => isBoStagingRouteAdmitted(def.href))","boModuleRegistry"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/Unified BO navigation/);
}));

test("automatic CD must validate BO public hostname, not workers.dev",()=>fixture(({root,read,write})=>{
  write(cd,read(cd).replace("https://bo.staging.pinohouse.art/$css","https://wrong.example/$css"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/Automatic staging CD must smoke test/);
}));

test("PAP-1030 retired BO deep-link smoke must run on canonical BO staging host", () => fixture(({root,read,write}) => {
  const source = read(cd);
  assert.match(source, /bo_host='https:\/\/bo\.staging\.pinohouse\.art'/);
  write(cd, source.replace("bo_host='https://bo.staging.pinohouse.art'", "bo_host='https://pino-team-os-staging.minhtri-van42.workers.dev'"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /retired BO route smoke must target canonical BO staging host/);
}));
