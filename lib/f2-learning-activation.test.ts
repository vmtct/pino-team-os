import test from "node:test";
import assert from "node:assert/strict";
import {
  activateF2LearningOperator,
  F2_CENTER_ID,
  F2_LEARNING_PERMISSION_KEYS,
  F2_LEARNING_ROLE_KEY,
  F2_LEARNING_ROLE_NAME,
  F2_TARGET_ACCESS_USER_ID,
  type F2ActivationApi,
} from "./f2-learning-activation";
import type { BoAccessRole, BoAccessUser } from "./bo-model";

const role = (patch: Partial<BoAccessRole> = {}): BoAccessRole => ({
  id: "01a00000-0000-7000-8000-000000000111",
  roleKey: F2_LEARNING_ROLE_KEY,
  displayName: F2_LEARNING_ROLE_NAME,
  roleType: "custom",
  status: "active",
  description: "reviewed",
  permissionCount: 6,
  assignmentCount: 0,
  ...patch,
});

const user = (assignments: BoAccessUser["assignments"] = []): BoAccessUser => ({
  id: F2_TARGET_ACCESS_USER_ID,
  staffMemberId: "01a00000-0000-7000-8000-000000000222",
  status: "active",
  email: null,
  assignments,
});

test("creates the exact F2 role then assigns only the reviewed CENTER target", async () => {
  const calls: Array<{ name: string; input: unknown }> = [];
  const api: F2ActivationApi = {
    listRoles: async () => [],
    listUsers: async () => [user()],
    createRole: async (input) => { calls.push({ name: "createRole", input }); return { id: role().id }; },
    assignRole: async (input) => { calls.push({ name: "assignRole", input }); return { id: "assignment-1" }; },
  };

  const result = await activateF2LearningOperator(api);
  assert.deepEqual(calls, [
    { name: "createRole", input: { roleKey: F2_LEARNING_ROLE_KEY, displayName: F2_LEARNING_ROLE_NAME, description: "Day-of-learning attendance, participation, arrival, roster, profile, and evidence operations", permissionKeys: F2_LEARNING_PERMISSION_KEYS } },
    { name: "assignRole", input: { userId: F2_TARGET_ACCESS_USER_ID, roleId: role().id, scopeType: "CENTER", scopeId: F2_CENTER_ID } },
  ]);
  assert.deepEqual(result, { roleId: role().id, assignmentId: "assignment-1", roleCreated: true, assignmentCreated: true });
});

test("retry reuses the reviewed role and exact existing CENTER assignment without writes", async () => {
  let writes = 0;
  const existing = { assignmentId: "assignment-1", roleId: role().id, roleKey: F2_LEARNING_ROLE_KEY, roleName: F2_LEARNING_ROLE_NAME, scopeType: "CENTER" as const, scopeId: F2_CENTER_ID, effectiveFrom: "2026-08-27T00:00:00Z", effectiveUntil: null };
  const api: F2ActivationApi = {
    listRoles: async () => [role({ assignmentCount: 1 })],
    listUsers: async () => [user([existing])],
    createRole: async () => { writes++; return { id: "unexpected" }; },
    assignRole: async () => { writes++; return { id: "unexpected" }; },
  };
  const result = await activateF2LearningOperator(api);
  assert.equal(writes, 0);
  assert.deepEqual(result, { roleId: role().id, assignmentId: "assignment-1", roleCreated: false, assignmentCreated: false });
});

test("fails safe when an existing role does not match reviewed metadata", async () => {
  const api: F2ActivationApi = {
    listRoles: async () => [role({ permissionCount: 7 })],
    listUsers: async () => { throw new Error("should not read users"); },
    createRole: async () => { throw new Error("should not create"); },
    assignRole: async () => { throw new Error("should not assign"); },
  };
  await assert.rejects(() => activateF2LearningOperator(api), /does not match the reviewed F2 contract/);
});
