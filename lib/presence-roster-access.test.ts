import test from "node:test";
import assert from "node:assert/strict";
import {
  ensurePresenceRosterAccess,
  removePresenceRosterAccess,
  PRESENCE_ROSTER_PERMISSION_KEYS,
  PRESENCE_ROSTER_ROLE_KEY,
  PRESENCE_ROSTER_ROLE_NAME,
  type PresenceRosterAccessApi,
} from "./presence-roster-access";
import type { BoAccessRole, BoAccessUser } from "./bo-model";
import type { BoAccessRoleDetail } from "./bo-access-model";

const centerId = "01a02354-6be1-7c77-a2dd-513052a18b98";
const userId = "01a04173-1a99-7292-8718-bb970c7126e5";
const roleId = "01a04173-1a99-7292-8718-bb970c7126e6";

function role(permissionCount = 2): BoAccessRole {
  return {
    id: roleId,
    roleKey: PRESENCE_ROSTER_ROLE_KEY,
    displayName: PRESENCE_ROSTER_ROLE_NAME,
    roleType: "custom",
    status: "active",
    description: null,
    permissionCount,
    assignmentCount: 0,
  };
}

function detail(permissionKeys: string[] = [...PRESENCE_ROSTER_PERMISSION_KEYS]): BoAccessRoleDetail {
  return { ...role(permissionKeys.length), createdAt: "2026-09-27T00:00:00.000Z", updatedAt: "2026-09-27T00:00:00.000Z", permissionKeys };
}

function user(assignments: BoAccessUser["assignments"] = []): BoAccessUser {
  return { id: userId, staffMemberId: "01a04173-1a99-7292-8718-bb970c7126e7", status: "active", email: "staff@example.com", assignments };
}

function api(overrides: Partial<PresenceRosterAccessApi> = {}): PresenceRosterAccessApi {
  return {
    listRoles: async () => [],
    getRole: async () => detail(),
    listUsers: async () => [user()],
    createRole: async () => ({ id: roleId }),
    assignRole: async () => ({ id: "01a04173-1a99-7292-8718-bb970c7126e8" }),
    removeAssignment: async () => undefined,
    ...overrides,
  };
}

test("creates the reusable role with exactly arrival + roster authority and assigns CENTER scope", async () => {
  const calls: Array<{ name: string; input: unknown }> = [];
  const result = await ensurePresenceRosterAccess(api({
    createRole: async (input) => { calls.push({ name: "createRole", input }); return { id: roleId }; },
    assignRole: async (input) => { calls.push({ name: "assignRole", input }); return { id: "assignment-1" }; },
  }), { userId, centerId });

  assert.deepEqual(calls, [
    {
      name: "createRole",
      input: {
        roleKey: PRESENCE_ROSTER_ROLE_KEY,
        displayName: PRESENCE_ROSTER_ROLE_NAME,
        description: "House learner arrival plus bounded day Session/roster discovery for Reception operations.",
        permissionKeys: ["session.roster.view", "student.arrival.manage"],
      },
    },
    { name: "assignRole", input: { userId, roleId, scopeType: "CENTER", scopeId: centerId } },
  ]);
  assert.deepEqual(result, { roleId, assignmentId: "assignment-1", roleCreated: true, assignmentCreated: true });
});

test("reuses an exact role and existing CENTER assignment without another write", async () => {
  let writes = 0;
  const assignment = {
    assignmentId: "assignment-1",
    roleId,
    roleKey: PRESENCE_ROSTER_ROLE_KEY,
    roleName: PRESENCE_ROSTER_ROLE_NAME,
    scopeType: "CENTER" as const,
    scopeId: centerId,
    effectiveFrom: "2026-09-27T00:00:00.000Z",
    effectiveUntil: null,
  };
  const result = await ensurePresenceRosterAccess(api({
    listRoles: async () => [role()],
    getRole: async () => detail(),
    listUsers: async () => [user([assignment])],
    createRole: async () => { writes++; return { id: "unexpected" }; },
    assignRole: async () => { writes++; return { id: "unexpected" }; },
  }), { userId, centerId });
  assert.equal(writes, 0);
  assert.deepEqual(result, { roleId, assignmentId: "assignment-1", roleCreated: false, assignmentCreated: false });
});

test("fails closed when the reusable role was broadened", async () => {
  await assert.rejects(
    () => ensurePresenceRosterAccess(api({
      listRoles: async () => [role(3)],
      getRole: async () => detail(["session.roster.view", "student.arrival.manage", "session.attendance.submit"]),
    }), { userId, centerId }),
    /permission drift/,
  );
});

test("cleanup removes only the matching temporary CENTER assignment", async () => {
  const removed: string[] = [];
  const assignments: BoAccessUser["assignments"] = [
    { assignmentId: "target", roleId, roleKey: PRESENCE_ROSTER_ROLE_KEY, roleName: PRESENCE_ROSTER_ROLE_NAME, scopeType: "CENTER", scopeId: centerId, effectiveFrom: "2026-09-27T00:00:00.000Z", effectiveUntil: null },
    { assignmentId: "other", roleId, roleKey: PRESENCE_ROSTER_ROLE_KEY, roleName: PRESENCE_ROSTER_ROLE_NAME, scopeType: "CENTER", scopeId: "01a02354-6be1-7c77-a2dd-513052a18b99", effectiveFrom: "2026-09-27T00:00:00.000Z", effectiveUntil: null },
  ];
  const result = await removePresenceRosterAccess(api({
    listRoles: async () => [role()],
    listUsers: async () => [user(assignments)],
    removeAssignment: async (assignmentId) => { removed.push(assignmentId); },
  }), { userId, centerId });
  assert.deepEqual(removed, ["target"]);
  assert.deepEqual(result, { removedAssignmentId: "target" });
});

test("does not grant authority to an inactive or unlinked Access user", async () => {
  await assert.rejects(
    () => ensurePresenceRosterAccess(api({ listUsers: async () => [{ ...user(), staffMemberId: null }] }), { userId, centerId }),
    /active Access user linked/,
  );
});
