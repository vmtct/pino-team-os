import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { scaffoldTddModule } from "./create-tdd-module.mjs";

const setup = t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pap1077-tdd-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ["config", "app/bo", "app/ho", "lib"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(root, "config/tdd-admission.json"), JSON.stringify({ version: 1, modules: [], approvals: [] }));
  fs.writeFileSync(path.join(root, "app/bo/navigation.ts"),
    'export const boNavigation = [{items: [{ href: "/bo", label: "Hôm nay" }]}];');
  fs.writeFileSync(path.join(root, "lib/ho-routes.ts"),
    'export const HO_PAGE_PATHS = {\n  staff: "/ho/staff",\n} as const;');
  fs.writeFileSync(path.join(root, "lib/bo-url-contract.ts"), "export const BO_TARGET_ROUTES = [\n];");
  fs.writeFileSync(path.join(root, "lib/host-boundary.ts"), '    if (pathname === "/bo/pinoria-avatars") {');
  return root;
};
const read = (root, file) => fs.readFileSync(path.join(root, file), "utf8");
const params = (root, surface) => ({
  root, surface, key: "mission-samples", label: "Mission Samples",
  permission: "mission.samples.view",
});
test("PAP-1077 BO starter uses canonical schema/adapter, nav and admission but denies Core", t => {
  const root = setup(t), out = scaffoldTddModule(params(root, "bo"));
  assert.equal(out.status, "DENY_FIRST_PENDING_CORE_AND_G2_G4");
  const manifest = JSON.parse(read(root, "config/tdd-admission.json"));
  assert.equal(manifest.modules.length, 1);
  const [entry] = manifest.modules;
  assert.equal(entry.profile, "TDD_DEFAULT");
  assert.equal(entry.surface, "BO");
  assert.equal(entry.binding.kind, "SURFACE_WORKSPACE_ADAPTER");
  assert.match(read(root, entry.binding.file), /createBoTddAdapter/);
  assert.match(read(root, entry.binding.file), /SurfaceWorkspace/);
  assert.match(read(root, entry.binding.file), /TODO_TDD_AUTHORIZED_CENTER/);
  assert.match(read(root, entry.schema.file), /new TddRegistry/);
  assert.match(read(root, entry.schema.file), /businessTabs: \[\], history:/);
  assert.match(read(root, entry.schema.file), /TODO_TDD_CORE_BACKED_LIST/);
  assert.match(read(root, "app/bo/navigation.ts"), /mission-samples/);
  assert.match(read(root, "app/bo/mission-samples/module.test.ts"), /assert\.fail/);
  assert.doesNotMatch(read(root, entry.binding.file), /LegacyBoModuleFactory|createElement\("table"/);
  assert.throws(() => scaffoldTddModule(params(root, "bo")), /already admitted|exists/);
});
test("PAP-1077 HO starter uses canonical adapter + exact HO route, no BO session", t => {
  const root = setup(t), out = scaffoldTddModule(params(root, "ho"));
  const entry = JSON.parse(read(root, "config/tdd-admission.json")).modules[0];
  assert.equal(entry.surface, "HO");
  assert.equal(out.route, "/ho/mission-samples");
  assert.match(read(root, entry.binding.file), /createHoTddAdapter/);
  assert.doesNotMatch(read(root, entry.binding.file), /createBoTddAdapter/);
  assert.match(read(root, "lib/ho-routes.ts"), /"mission-samples": "\/ho\/mission-samples"/);
  assert.match(read(root, entry.schema.file), /surface: "HO"/);
  assert.match(read(root, entry.schema.file), /TddRegistry\.register|registry\.register/);
});
test("PAP-1077 refuse ambiguous or malicious CLI and avoid all file side effects", t => {
  const root = setup(t), before = read(root, "config/tdd-admission.json");
  for (const override of [
    { key: "../evil" }, { key: "bad/route" }, { surface: "tos" },
    { permission: "TODO_PERMISSION" }, { permission: "a;rm -rf /" },
    { label: "<x>".repeat(40) }, { permission: "" },
  ]) assert.throws(() => scaffoldTddModule({ ...params(root, "bo"), ...override }));
  assert.equal(read(root, "config/tdd-admission.json"), before);
  assert.equal(fs.existsSync(path.join(root, "app/bo/mission-samples")), false);
});
test("PAP-1077 unknown BO nav template fails without generating route", t => {
  const root = setup(t);
  fs.writeFileSync(path.join(root, "app/bo/navigation.ts"), "export default []");
  assert.throws(() => scaffoldTddModule(params(root, "bo")), /anchor/);
  assert.equal(fs.existsSync(path.join(root, "app/bo/mission-samples")), false);
});
test("PAP-1077 multiple modules remain separately registered with immutable files", t => {
  const root = setup(t);
  scaffoldTddModule(params(root, "ho"));
  scaffoldTddModule({ ...params(root, "bo"), key: "shift-samples", permission: "shift.samples.read" });
  const entries = JSON.parse(read(root, "config/tdd-admission.json")).modules;
  assert.deepEqual(entries.map(e => e.route), ["/ho/mission-samples", "/bo/shift-samples"]);
  assert.equal(entries.every(e => e.files.every(f => fs.existsSync(path.join(root, f)))), true);
});

for (const surface of ["bo", "ho"]) test(`PAP-1077 ${surface} generated G2/G3/G4 skeletons fail without evidence`, t => {
  const root = setup(t);
  const result = scaffoldTddModule(params(root, surface));
  const base = `app/${surface}/mission-samples`;
  const fixture = JSON.parse(read(root, `${base}/acceptance.fixture.json`));
  assert.equal(fixture.synthetic, true);
  assert.equal(fixture.surface, surface.toUpperCase());
  assert.deepEqual(fixture.rows.map(row => row.id), ["019d2000-0001-7000-8000-000000000001", "019d2000-0001-7000-8000-000000000002"]);
  assert.ok(fixture.rows.every(row => row.name.startsWith("SYNTHETIC DEMO")));
  assert.equal(fixture.authorizedPrincipal, undefined);
  const plan = JSON.parse(read(root, `${base}/acceptance.plan.json`));
  assert.deepEqual(plan.gates.map(gate => gate.id), ["G0", "G1", "G2", "G3", "G4"]);
  assert.ok(plan.gates.every(gate => gate.status === "PENDING"));
  assert.deepEqual(plan.viewports, [1440, 1024, 768, 390, 320]);
  assert.equal(plan.route, result.route);
  assert.equal(plan.dsPackage, "@pino/design-system");
  const entry = JSON.parse(read(root, "config/tdd-admission.json")).modules[0];
  assert.ok(entry.tests.includes(`${base}/acceptance.gates.test.mjs`));
  assert.ok(entry.files.every(file => !/acceptance\./.test(file)));
  const run = spawnSync(process.execPath, ["--test", `${base}/acceptance.gates.test.mjs`], { cwd: root, encoding: "utf8", env: { ...process.env, NODE_TEST_CONTEXT: undefined } });
  assert.notEqual(run.status, 0);
  for (const gate of ["G2", "G3", "G4"]) assert.match(run.stdout + run.stderr, new RegExp(`TODO_TDD_${gate}_ACCEPTANCE`));
  assert.doesNotMatch(run.stdout + run.stderr, /tests? skipped|# skipped [1-9]/);
});

test("PAP-1077 generated BO route has exact URL key and Staging-only GET/HEAD admission", t => {
  const root = setup(t); scaffoldTddModule(params(root, "bo"));
  assert.match(read(root, "lib/bo-url-contract.ts"), /key: "mission-samples", path: "\/bo\/mission-samples", tabs: \["overview", "history"\]/);
  assert.match(read(root, "lib/host-boundary.ts"), /pathname === "\/bo\/mission-samples"/);
  assert.match(read(root, "lib/host-boundary.ts"), /hostname === BO_STAGING_HOSTNAME && \(method === "GET" \|\| method === "HEAD"\)/);
  assert.doesNotMatch(read(root, "lib/host-boundary.ts"), /sample.*startsWith|method === "POST"/);
});

test("PAP-1077 unknown BO route authority fails before any generated files or admission writes", t => {
  const root = setup(t), before = read(root, "config/tdd-admission.json");
  fs.writeFileSync(path.join(root, "lib/bo-url-contract.ts"), "export default [];");
  assert.throws(() => scaffoldTddModule(params(root, "bo")), /URL registry anchor/);
  assert.equal(read(root, "config/tdd-admission.json"), before);
  assert.equal(fs.existsSync(path.join(root, "app/bo/mission-samples")), false);
});
