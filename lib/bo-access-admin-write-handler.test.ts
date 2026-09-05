import test from "node:test";
import assert from "node:assert/strict";
import { handleBoWriteRequest, type BoWriteEnv } from "./bo-write-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const roleId = "00000000-0000-7000-8000-000000000002";
const session = "local-session-token";

function request(path: string, authenticated = true, body: unknown = {}) {
  return new Request(`https://bo.pinohouse.art/api/bo/${path}?userId=forged&centerId=forged`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(authenticated ? { cookie: `pino_staff_password_session=${session}` } : {}) },
    body: JSON.stringify(body),
  });
}

function env(binding: BoAccessCoreBinding): BoWriteEnv { return { PINO_BO_CORE: binding }; }
test("BO access admin facade forwards only whitelisted writes through local password session", async () => {
  const forwarded: BoAccessRequest[] = [];
  const tokens: string[] = [];
  const binding: BoAccessCoreBinding = {

    async executeWithStaffPassword(coreRequest, token) {
      forwarded.push(coreRequest);
      tokens.push(token);
      return { status: 200, body: { data: { id: "created" } }, requestId: `core-${forwarded.length}` };
    },
  };
  const roleBody = { roleKey: "tos-learning-operator", displayName: "TOS Learning Operator", permissionKeys: ["session.roster.view"] };
  const duplicateBody = { roleKey: "tos-learning-operator-copy", displayName: "TOS Learning Operator Copy" };
  const updateBody = { displayName: "TOS Learning Operator Reviewed", permissionKeys: ["session.roster.view"], expectedUpdatedAt: "2026-08-31T00:00:00.000Z" };
  const assignmentBody = { userId: "00000000-0000-7000-8000-000000000001", roleId, scopeType: "CENTER", scopeId: "00000000-0000-7000-8000-000000000003" };
  const cases = [["access/roles", roleBody], [`access/roles/${roleId}/duplicate`, duplicateBody], [`access/roles/${roleId}/update`, updateBody], [`access/roles/${roleId}/archive`, {}], ["access/assignments", assignmentBody]] as const;
  for (const [path, body] of cases) assert.equal((await handleBoWriteRequest(request(path, true, body), env(binding), path)).status, 200);
  assert.deepEqual(forwarded, cases.map(([path, body]) => ({ method: "POST", path, body })));
  assert.ok(tokens.every(token => token === session));
});test("access admin writes require local password session and reject unlisted paths before Core", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = {

    async executeWithStaffPassword() { called = true; throw new Error("unexpected"); },
  };
  const [unauthenticated, unknown, deleteRole] = await Promise.all([
    handleBoWriteRequest(request("access/roles", false), env(binding), "access/roles"),
    handleBoWriteRequest(request("access/users"), env(binding), "access/users"),
    handleBoWriteRequest(request(`access/roles/${roleId}/delete`), env(binding), `access/roles/${roleId}/delete`),
  ]);
  assert.equal(unauthenticated.status, 401);
  assert.equal(unknown.status, 404);
  assert.equal(deleteRole.status, 404);
  assert.equal(called, false);
});
