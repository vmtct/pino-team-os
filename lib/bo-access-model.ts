import type { BoAccessRole, BoAccessUser } from "./bo-model";

export interface BoAccessRoleDetail extends BoAccessRole {
  createdAt: string;
  updatedAt: string;
  permissionKeys: string[];
}

export interface BoAccessPermission {
  key: string;
  domain: string;
  displayLabel: string;
  description: string;
  accessKind: "read" | "mutation";
  surfaceApplicability: "TOS" | "BO" | "BOTH";
  allowedScopes: Array<"GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS">;
  contextualPolicy: "SELF_STAFF_ONLY" | null;
}

export interface BoAccessAuditEvent {
  id: string;
  occurredAt: string;
  requestId: string;
  actorType: string;
  actorId: string | null;
  action: string;
  subjectType: string;
  subjectId: string | null;
  outcome: string;
  payload: unknown;
}

export type BoAccessSystemUser = Omit<BoAccessUser, "assignments"> & {
  assignments: Array<BoAccessUser["assignments"][number] & {
    roleType?: "system" | "custom";
    roleStatus?: "active" | "archived";
    tosApplicable?: boolean;
  }>;
};
