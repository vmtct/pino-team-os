import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { modules, load } = require("../public/bo-authority-source/school-adapters.js");
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const respond = data => new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } });
const parent = (id = first, maskedContact = "09••••••12") => ({
  id, displayName: "Đã được cấp quyền", linkedStudentCount: 2,
  centers: ["Cơ sở 1"], updatedAt: "2026-10-27T00:00:00Z",
  maskedContact, attention: "NONE"
});
test("Parent uses shared BO module without a bespoke layout", () => {
  assert.equal(modules.parents.group, "SCHOOL");
  assert.ok(modules.parents.fields.some(field => field.key === "maskedContact" && field.readonly));
  assert.equal(readFileSync("app/bo/components/registration/BoParentReadTabs.tsx", "utf8").includes('const tabs = ["Overview", "Students", "Contacts", "Audit"]'), true);
});
test("Parent V2.5 detail and read-only create gate survive Student Subscription and HO main updates", () => {
  const detail = readFileSync("app/bo/components/registration/BoFullDetail.tsx", "utf8");
  const workspace = readFileSync("app/bo/components/registration/BoRegistrationWorkspace.tsx", "utf8");
  assert.match(detail, /moduleKey === "parents"/);
  assert.match(detail, /<BoParentReadTabs module=\{module\} record=\{record\}/);
  assert.match(detail, /BoStudentSubscriptionRelation/);
  assert.match(workspace, /enableStudentSubscriptions=\{!ho && moduleKey === "students"\}/);
  assert.match(workspace, /!readOnly && !parentReadOnly/);
  assert.match(workspace, /<BoQuickView moduleKey=\{moduleKey\}/);
  const quick = readFileSync("app/bo/components/registration/BoQuickView.tsx", "utf8");
  assert.match(quick, /moduleKey === "parents"/);
  assert.match(quick, /detailLoading \|\| Boolean\(detailError\)/);
  assert.match(workspace, /Pino%20Logo\.png/);
});
test("Parent directory always uses a distinct Core authorized endpoint and paginates", async () => {
  const calls = [];
  const rows = await load("parents", async url => {
    calls.push(url);
    assert.ok(url.startsWith("/api/bo/identity/parents/directory?"));
    return respond(calls.length === 1 ? { items: [parent()], total: 2 } : { items: [parent(second)], total: 2 });
  });
  assert.equal(rows.length, 2);
  assert.match(calls[1], /offset=1/);
  assert.equal(rows[0].maskedContact, "09••••••12");
  assert.deepEqual(rows.map(r => r.id), [first, second]);
});
test("nullable canonical Core Parent fields remain display-safe without faking attention", async () => {
  const rows = await load("parents", async () => respond({ items: [{ ...parent(), displayName: null, attention: null }], total: 1 }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Chưa có tên");
  assert.equal(rows[0].attention, null);
});
test("Parent rejects unsafe responses and never falls back to intake lookup", async () => {
  await assert.rejects(load("parents", async () => respond({ items: [parent(first, "0901234567")], total: 1 })), /che/);
  await assert.rejects(load("parents", async () => respond({ items: [], total: 1 })), /không tiến/);
  await assert.rejects(load("parents", async () => respond({ items: [parent(), parent()], total: 2 })), /ID trùng/);
  await assert.rejects(load("parents", async () => respond([{ parent: { id: first } }])), /chưa sẵn sàng/);
  await assert.rejects(load("parents", async () => new Response(null, { status: 403 })), /quyền/);
});

test("Parent shared React JSX parses without syntax diagnostics", () => {
  const ts = require("typescript");
  for (const file of [
    "app/bo/components/registration/BoParentReadTabs.tsx",
    "app/bo/components/registration/BoQuickView.tsx",
    "app/bo/components/registration/BoFullDetail.tsx",
    "app/bo/components/registration/BoRegistrationWorkspace.tsx",
  ]) {
    const tree = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(tree.parseDiagnostics.length, 0, file + " JSX parse failed");
  }
});
