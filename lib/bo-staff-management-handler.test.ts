import test from "node:test";
import assert from "node:assert/strict";
import { handleBoWriteRequest, type BoWriteEnv } from "./bo-write-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const staffId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
const session = "local-session-token";
function env(binding: BoAccessCoreBinding): BoWriteEnv { return { PINO_BO_CORE: binding }; }
function request(path: string, body: unknown) { return new Request(`https://bo.pinohouse.art/api/bo/${path}`, { method: "POST", headers: { cookie: `pino_staff_password_session=${session}`, "content-type": "application/json" }, body: JSON.stringify(body) }); }

test("Staff management facade forwards exact governed writes through local password session", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = {  async executeWithStaffPassword(coreRequest, token) { assert.equal(token, session); forwarded.push(coreRequest); return { status: 200, body: { data: {} }, requestId: `core-${forwarded.length}` }; } };
  const commands: Array<[string, unknown]> = [[`workforce/staff-records/${staffId}`, { department: "Music" }], [`workforce/staff-records/${staffId}/status`, { status: "inactive" }], ["access/assignments/remove", { assignmentId: "0198d050-56c1-7ac5-b9ab-b0e45d912346" }], ["access/users/status", { userId: "0198d050-56c1-7ac5-b9ab-b0e45d912347", status: "suspended", reason: "Offboarding" }]];
  for (const [path, body] of commands) assert.equal((await handleBoWriteRequest(request(path, body), env(binding), path)).status, 200);
  assert.deepEqual(forwarded, commands.map(([path, body]) => ({ method: "POST", path, body })));
});

test("Staff management facade rejects path expansion before Core", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = {  async executeWithStaffPassword() { called = true; throw new Error("unexpected"); } };
  const path = `workforce/staff-records/${staffId}/documents`;
  const response = await handleBoWriteRequest(request(path, {}), env(binding), path);
  assert.equal(response.status, 404);
  assert.equal(called, false);
});
