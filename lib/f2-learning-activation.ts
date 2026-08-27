import type { BoAccessRole, BoAccessUser } from "./bo-model";

export const F2_LEARNING_ROLE_KEY = "tos-learning-operator";
export const F2_LEARNING_ROLE_NAME = "TOS Learning Operator";
export const F2_LEARNING_ROLE_DESCRIPTION = "Day-of-learning attendance, participation, arrival, roster, profile, and evidence operations";
export const F2_LEARNING_PERMISSION_KEYS = [
  "session.roster.view",
  "student.profile.view",
  "student.arrival.manage",
  "session.participation.manage",
  "session.attendance.submit",
  "session.evidence.submit",
] as const;
export const F2_TARGET_ACCESS_USER_ID = "01a04173-1a99-7292-8718-bb970c7126e5";
export const F2_CENTER_ID = "01a02354-6be1-7c77-a2dd-513052a18b98";

export interface F2ActivationApi {
  listRoles(): Promise<BoAccessRole[]>;
  listUsers(): Promise<BoAccessUser[]>;
  createRole(input: { roleKey: string; displayName: string; description: string; permissionKeys: readonly string[] }): Promise<{ id: string }>;
  assignRole(input: { userId: string; roleId: string; scopeType: "CENTER"; scopeId: string }): Promise<{ id: string }>;
}

export interface F2ActivationResult {
  roleId: string;
  assignmentId: string | null;
  roleCreated: boolean;
  assignmentCreated: boolean;
}

export async function activateF2LearningOperator(api: F2ActivationApi): Promise<F2ActivationResult> {
  const matches = (await api.listRoles()).filter((role) => role.roleKey === F2_LEARNING_ROLE_KEY);
  if (matches.length > 1) throw new Error("Multiple TOS Learning Operator roles exist; activation stopped.");

  let roleId: string;
  let roleCreated = false;
  if (matches.length === 1) {
    const role = matches[0];
    if (role.status !== "active" || role.roleType !== "custom" || role.displayName !== F2_LEARNING_ROLE_NAME || role.permissionCount !== F2_LEARNING_PERMISSION_KEYS.length) {
      throw new Error("Existing TOS Learning Operator role does not match the reviewed F2 contract.");
    }
    roleId = role.id;
  } else {
    const created = await api.createRole({
      roleKey: F2_LEARNING_ROLE_KEY,
      displayName: F2_LEARNING_ROLE_NAME,
      description: F2_LEARNING_ROLE_DESCRIPTION,
      permissionKeys: F2_LEARNING_PERMISSION_KEYS,
    });
    roleId = created.id;
    roleCreated = true;
  }

  const users = await api.listUsers();
  const target = users.filter((user) => user.id === F2_TARGET_ACCESS_USER_ID);
  if (target.length !== 1 || target[0].status !== "active") throw new Error("Reviewed F2 target Access user is not uniquely active.");

  const existingAssignments = target[0].assignments.filter((assignment) =>
    assignment.roleId === roleId
    && assignment.scopeType === "CENTER"
    && assignment.scopeId === F2_CENTER_ID,
  );
  if (existingAssignments.length > 1) throw new Error("Duplicate F2 CENTER assignments exist; activation stopped.");
  if (existingAssignments.length === 1) {
    return { roleId, assignmentId: existingAssignments[0].assignmentId, roleCreated, assignmentCreated: false };
  }

  const assigned = await api.assignRole({
    userId: F2_TARGET_ACCESS_USER_ID,
    roleId,
    scopeType: "CENTER",
    scopeId: F2_CENTER_ID,
  });
  return { roleId, assignmentId: assigned.id, roleCreated, assignmentCreated: true };
}
