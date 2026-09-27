import type { BoAccessRole, BoAccessUser } from "./bo-model";
import type { BoAccessRoleDetail } from "./bo-access-model";

export const PRESENCE_ROSTER_ROLE_KEY = "tos-presence-roster-operator";
export const PRESENCE_ROSTER_ROLE_NAME = "TOS Presence & Roster Operator";
export const PRESENCE_ROSTER_ROLE_DESCRIPTION = "House learner arrival plus bounded day Session/roster discovery for Reception operations.";
export const PRESENCE_ROSTER_PERMISSION_KEYS = [
  "session.roster.view",
  "student.arrival.manage",
] as const;

export interface PresenceRosterAccessApi {
  listRoles(): Promise<BoAccessRole[]>;
  getRole(roleId: string): Promise<BoAccessRoleDetail>;
  listUsers(): Promise<BoAccessUser[]>;
  createRole(input: { roleKey: string; displayName: string; description: string; permissionKeys: string[] }): Promise<{ id: string }>;
  assignRole(input: { userId: string; roleId: string; scopeType: "CENTER"; scopeId: string }): Promise<{ id: string }>;
  removeAssignment(assignmentId: string): Promise<unknown>;
}

export interface PresenceRosterAccessResult {
  roleId: string;
  assignmentId: string | null;
  roleCreated: boolean;
  assignmentCreated: boolean;
}

function exactPermissions(keys: readonly string[]): boolean {
  const actual = [...keys].sort();
  const expected = [...PRESENCE_ROSTER_PERMISSION_KEYS].sort();
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

async function resolveRole(api: PresenceRosterAccessApi): Promise<{ roleId: string; roleCreated: boolean }> {
  const matches = (await api.listRoles()).filter((role) => role.roleKey === PRESENCE_ROSTER_ROLE_KEY);
  if (matches.length > 1) throw new Error("Multiple Presence & Roster operator roles exist; access change stopped.");

  if (!matches.length) {
    const created = await api.createRole({
      roleKey: PRESENCE_ROSTER_ROLE_KEY,
      displayName: PRESENCE_ROSTER_ROLE_NAME,
      description: PRESENCE_ROSTER_ROLE_DESCRIPTION,
      permissionKeys: [...PRESENCE_ROSTER_PERMISSION_KEYS],
    });
    return { roleId: created.id, roleCreated: true };
  }

  const role = matches[0]!;
  if (role.status !== "active" || role.roleType !== "custom") {
    throw new Error("Existing Presence & Roster operator role is not an active custom role.");
  }
  const detail = await api.getRole(role.id);
  if (!exactPermissions(detail.permissionKeys)) {
    throw new Error("Existing Presence & Roster operator role has permission drift; review it in System → Roles before assigning.");
  }
  return { roleId: role.id, roleCreated: false };
}

function targetUser(users: BoAccessUser[], userId: string): BoAccessUser {
  const matches = users.filter((user) => user.id === userId);
  if (matches.length !== 1) throw new Error("Target Access user is not uniquely available.");
  const user = matches[0]!;
  if (user.status !== "active" || !user.staffMemberId) {
    throw new Error("Target must be an active Access user linked to an active StaffMember.");
  }
  return user;
}

export async function ensurePresenceRosterAccess(
  api: PresenceRosterAccessApi,
  input: { userId: string; centerId: string },
): Promise<PresenceRosterAccessResult> {
  const user = targetUser(await api.listUsers(), input.userId);
  const { roleId, roleCreated } = await resolveRole(api);
  const existing = user.assignments.filter((assignment) =>
    assignment.roleId === roleId
    && assignment.scopeType === "CENTER"
    && assignment.scopeId === input.centerId,
  );
  if (existing.length > 1) throw new Error("Duplicate Presence & Roster CENTER assignments exist; access change stopped.");
  if (existing.length === 1) {
    return { roleId, assignmentId: existing[0]!.assignmentId, roleCreated, assignmentCreated: false };
  }

  const assigned = await api.assignRole({
    userId: input.userId,
    roleId,
    scopeType: "CENTER",
    scopeId: input.centerId,
  });
  return { roleId, assignmentId: assigned.id, roleCreated, assignmentCreated: true };
}

export async function removePresenceRosterAccess(
  api: PresenceRosterAccessApi,
  input: { userId: string; centerId: string },
): Promise<{ removedAssignmentId: string | null }> {
  const user = targetUser(await api.listUsers(), input.userId);
  const roles = (await api.listRoles()).filter((role) => role.roleKey === PRESENCE_ROSTER_ROLE_KEY);
  if (roles.length > 1) throw new Error("Multiple Presence & Roster operator roles exist; cleanup stopped.");
  if (!roles.length) return { removedAssignmentId: null };

  const role = roles[0]!;
  const assignments = user.assignments.filter((assignment) =>
    assignment.roleId === role.id
    && assignment.scopeType === "CENTER"
    && assignment.scopeId === input.centerId,
  );
  if (assignments.length > 1) throw new Error("Duplicate Presence & Roster CENTER assignments exist; cleanup stopped.");
  if (!assignments.length) return { removedAssignmentId: null };

  const assignmentId = assignments[0]!.assignmentId;
  await api.removeAssignment(assignmentId);
  return { removedAssignmentId: assignmentId };
}
