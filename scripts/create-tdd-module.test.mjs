import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
  assert.match(read(root, "lib/ho-routes.ts"), /missionSamples: "\/ho\/mission-samples"/);
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
