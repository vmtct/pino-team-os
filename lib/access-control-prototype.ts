export type PrototypePermission = {
  key: string;
  label: string;
  group: "Access Control" | "Workforce" | "Sessions" | "Students";
  description: string;
};

export type PrototypeRole = {
  id: string;
  key: string;
  name: string;
  type: "SYSTEM" | "CUSTOM";
  status: "ACTIVE" | "ARCHIVED";
  description: string;
  permissionKeys: string[];
  protected?: boolean;
};

export type PrototypeAssignment = {
  id: string;
  roleId: string;
  scopeType: "GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS";
  scopeLabel: string;
};

export type PrototypeUser = {
  id: string;
  name: string;
  staffLabel: string;
  status: "ACTIVE" | "SUSPENDED";
  assignments: PrototypeAssignment[];
};

export type PrototypeAuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  summary: string;
};

export const prototypePermissions: PrototypePermission[] = [
  { key: "access.user.view", label: "View users", group: "Access Control", description: "View TOS access identities and effective access." },
  { key: "access.user.manage", label: "Manage user access", group: "Access Control", description: "Suspend or reactivate user access subject to protected-Founder rules." },
  { key: "access.role.view", label: "View roles", group: "Access Control", description: "View system/custom roles and permission membership." },
  { key: "access.role.create", label: "Create roles", group: "Access Control", description: "Create custom permission bundles." },
  { key: "access.role.edit", label: "Edit roles", group: "Access Control", description: "Edit custom role labels, descriptions and permission bundles." },
  { key: "access.role.archive", label: "Archive roles", group: "Access Control", description: "Archive custom roles; protected system roles are excluded." },
  { key: "access.role.assign", label: "Assign roles", group: "Access Control", description: "Assign/remove roles at an allowed scope." },
  { key: "access.audit.view", label: "View access audit", group: "Access Control", description: "View access-management audit history." },
  { key: "workforce.plan.view", label: "View workforce plans", group: "Workforce", description: "Read monthly/weekly/daily workforce planning surfaces." },
  { key: "workforce.plan.edit", label: "Edit workforce plans", group: "Workforce", description: "Edit workforce planning inputs and assignments." },
  { key: "workforce.plan.publish", label: "Publish workforce plans", group: "Workforce", description: "Publish/finalize workforce plans." },
  { key: "workforce.assignment.assign", label: "Assign workforce", group: "Workforce", description: "Assign staff to coverage demand." },
  { key: "workforce.policy.manage", label: "Manage staffing policy", group: "Workforce", description: "Change Founder staffing/capability policy." },
  { key: "session.attendance.submit", label: "Submit attendance", group: "Sessions", description: "Submit attendance when contextual assignment policy allows." },
  { key: "session.evidence.submit", label: "Submit evidence", group: "Sessions", description: "Submit evidence for an assigned/covered Session." },
  { key: "student.profile.view", label: "View student profiles", group: "Students", description: "View student profile data inside the actor's allowed context." },
];

const allPermissionKeys = prototypePermissions.map(permission => permission.key);

export const prototypeRoles: PrototypeRole[] = [
  {
    id: "role_founder",
    key: "founder_admin",
    name: "Founder Admin",
    type: "SYSTEM",
    status: "ACTIVE",
    protected: true,
    description: "Protected break-glass role. Cannot be archived or removed from the last active Founder user.",
    permissionKeys: allPermissionKeys,
  },
  {
    id: "role_workforce_manager",
    key: "workforce_manager",
    name: "Workforce Manager",
    type: "CUSTOM",
    status: "ACTIVE",
    description: "Plan, assign and publish workforce operations without access-control administration.",
    permissionKeys: [
      "workforce.plan.view",
      "workforce.plan.edit",
      "workforce.plan.publish",
      "workforce.assignment.assign",
    ],
  },
  {
    id: "role_teacher",
    key: "teacher",
    name: "Teacher",
    type: "CUSTOM",
    status: "ACTIVE",
    description: "Session-level teaching actions; contextual policy still restricts actions to assigned/covered Sessions.",
    permissionKeys: [
      "session.attendance.submit",
      "session.evidence.submit",
      "student.profile.view",
    ],
  },
  {
    id: "role_access_reviewer",
    key: "access_reviewer",
    name: "Access Reviewer",
    type: "CUSTOM",
    status: "ACTIVE",
    description: "Read-only review of access users, roles and audit history.",
    permissionKeys: ["access.user.view", "access.role.view", "access.audit.view"],
  },
];

export const prototypeUsers: PrototypeUser[] = [
  {
    id: "user_founder",
    name: "Founder",
    staffLabel: "Founder · linked StaffMember",
    status: "ACTIVE",
    assignments: [{ id: "asg_founder", roleId: "role_founder", scopeType: "GLOBAL", scopeLabel: "All PINO" }],
  },
  {
    id: "user_hang",
    name: "Hằng",
    staffLabel: "Manager · linked StaffMember",
    status: "ACTIVE",
    assignments: [{ id: "asg_hang_workforce", roleId: "role_workforce_manager", scopeType: "GLOBAL", scopeLabel: "All PINO" }],
  },
  {
    id: "user_bao",
    name: "Bảo",
    staffLabel: "Teacher · linked StaffMember",
    status: "ACTIVE",
    assignments: [{ id: "asg_bao_teacher", roleId: "role_teacher", scopeType: "PATH", scopeLabel: "PianoHouse" }],
  },
  {
    id: "user_trang",
    name: "Trang",
    staffLabel: "Mentor · linked StaffMember",
    status: "SUSPENDED",
    assignments: [{ id: "asg_trang_teacher", roleId: "role_teacher", scopeType: "CENTER", scopeLabel: "Cần Thơ" }],
  },
];

export const prototypeAudit: PrototypeAuditEvent[] = [
  { id: "evt_1", at: "16/08/2026 · 09:12", actor: "Founder", action: "ACCESS_ROLE_ASSIGNED", target: "Hằng", summary: "Assigned Workforce Manager · GLOBAL" },
  { id: "evt_2", at: "16/08/2026 · 09:18", actor: "Founder", action: "ACCESS_ROLE_UPDATED", target: "Workforce Manager", summary: "Added workforce.plan.publish" },
  { id: "evt_3", at: "16/08/2026 · 10:04", actor: "Founder", action: "ACCESS_USER_SUSPENDED", target: "Trang", summary: "System access suspended; StaffMember remains unchanged" },
  { id: "evt_4", at: "16/08/2026 · 10:20", actor: "Founder", action: "ACCESS_ROLE_CREATED", target: "Access Reviewer", summary: "Created read-only access-review role" },
];

export function roleById(id: string): PrototypeRole | undefined {
  return prototypeRoles.find(role => role.id === id);
}

export function permissionsForRole(role: PrototypeRole): PrototypePermission[] {
  return role.permissionKeys
    .map(key => prototypePermissions.find(permission => permission.key === key))
    .filter((permission): permission is PrototypePermission => Boolean(permission));
}

export function effectivePermissionKeys(user: PrototypeUser): string[] {
  if (user.status !== "ACTIVE") return [];
  return [...new Set(user.assignments.flatMap(assignment => roleById(assignment.roleId)?.permissionKeys ?? []))].sort();
}
