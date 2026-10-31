import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createSpecialRequest, parseSpecialRequestArgs } from "./create-tdd-special-request.mjs";
import { validateSpecial } from "./verify-tdd-authority.mjs";

const identity = { surface: "ho", key: "special-demo", route: "/ho/special-demo", owner: "PAP-1085" };
const now = Date.parse("2026-10-31T00:00:00Z");
const entry = request => ({ ...request, approval: request.id });
for (const surface of ["bo", "ho"]) test(surface + " request needs an actual Founder record and alternative profile before admission", () => {
  const request = createSpecialRequest({ ...identity, surface, route: `/${surface}/special-demo` });
  assert.equal(request.status, "requested");
  assert.equal(request.permanent, false);
  assert.equal(request.surface, surface.toUpperCase());
  assert.equal(request.approvedBy, null);
  assert.ok(validateSpecial(entry(request), [request], [], now).length);
  // A developer changing only the status/name cannot turn a request into approval.
  const renamed = { ...request, status: "approved", approvedBy: "Founder" };
  assert.ok(validateSpecial(entry(renamed), [renamed], [], now).length);
  const completed = { ...request, status: "approved", approvedBy: "Founder", reference: "https://vmtct97.atlassian.net/browse/PAP-1085?focusedCommentId=12345", approvedAt: "2026-10-30T00:00:00Z", expiresAt: "2026-11-01T00:00:00Z", justification: "Synthetic approved test only", designAuthority: "Synthetic alternate design", fallback: "Return to TDD", permissions: ["existing.read"], tests: { security: ["e2e/special.spec.ts"], authorization: ["e2e/special.spec.ts"], accessibility: ["e2e/special.spec.ts"], responsive: ["e2e/special.spec.ts"] } };
  // Compatibility proof only. G0 still requires authority from the immutable merged base.
  assert.deepEqual(validateSpecial(entry(completed), [completed], [], now), []);
});
for (const [label, input] of [
  ["wrong surface", { surface: "tos" }], ["cross-surface route", { route: "/bo/special-demo" }],
  ["root host", { route: "/ho" }], ["wildcard", { route: "/ho/*" }],
  ["traversal", { route: "/ho/../admin" }], ["encoded path", { route: "/ho/%2fadmin" }],
  ["query alias", { route: "/ho/special-demo?skip=tdd" }], ["fragment", { route: "/ho/special-demo#overview" }],
  ["full URL", { route: "https://ho.staging.pinohouse.art/ho/special-demo" }],
  ["trailing slash", { route: "/ho/special-demo/" }], ["wildcard key", { key: "*" }],
  ["unscoped owner", { owner: "Developer" }],
]) test("request rejects " + label, () => assert.throws(() => createSpecialRequest({ ...identity, ...input }), /Usage/));
for (const args of [[], ["--skip-tdd"], ["--surface=ho", "--surface=bo"], ["--approvedBy=Founder"], ["--output=config/tdd-approved-special.json"]]) {
  test("CLI refuses missing, duplicate or authority/write flags: " + args.join(" "), () => assert.throws(() => parseSpecialRequestArgs(args), /Usage/));
}
test("real CLI emits only pending JSON and leaves working folder and approval registry untouched", t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "pap1085-request-"));
  t.after(() => fs.rmdirSync(folder));
  const script = fileURLToPath(new URL("./create-tdd-special-request.mjs", import.meta.url));
  const registry = fileURLToPath(new URL("../config/tdd-approved-special.json", import.meta.url));
  const before = fs.readFileSync(registry);
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [script, "--surface=ho", "--key=special-demo", "--route=/ho/special-demo", "--owner=PAP-1085"], { cwd: folder, encoding: "utf8", env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const request = JSON.parse(result.stdout);
  assert.equal(request.status, "requested");
  assert.equal(request.permanent, false);
  assert.ok(validateSpecial(entry(request), [request], [], now).length);
  assert.deepEqual(fs.readdirSync(folder), []);
  assert.deepEqual(fs.readFileSync(registry), before);
  const denied = spawnSync(process.execPath, [script, "--skip-tdd"], { cwd: folder, encoding: "utf8", env });
  assert.notEqual(denied.status, 0);
  assert.equal(denied.stdout, "");
});
